import { supabase, isSupabaseEnabled } from './supabase';

// ============================================================
// 設計方針（2026-09-09 データ消失を受けて全面改修）
//
// 1. クラウドからの読み込みが成功するまで、書き込みは一切しない。
//    （旧実装は読み込み失敗時に空データでクラウドを全削除していた）
// 2. 「全削除 → 全挿入」をやめ、「upsert → 今回に無いキーだけ削除」にした。
//    途中で通信が切れてもデータが消えない。
// 3. 同期の成否を必ず画面に出す。黙って失敗させない。
// ============================================================

// --- 書き込みロック --------------------------------------------------
// loadAllFromSupabase() が成功して初めて true になる。
let writeEnabled = false;
export function setWriteEnabled(value) {
  writeEnabled = Boolean(value);
}
export function isWriteEnabled() {
  return writeEnabled;
}

// --- 同期ステータス通知 ----------------------------------------------
// state: 'local-only' | 'loading' | 'synced' | 'saving' | 'error'
let statusListener = null;
export function onSyncStatus(fn) {
  statusListener = fn;
}
function report(state, detail) {
  if (statusListener) statusListener({ state, detail: detail || '', at: Date.now() });
}

// 生のエラーをそのまま出しても原因が分からないので日本語に言い換える
export function humanizeError(message) {
  const m = String(message || '');
  if (/Failed to fetch|NetworkError|ERR_NAME_NOT_RESOLVED/i.test(m)) {
    return 'クラウドに接続できません（オフライン、またはSupabaseプロジェクトが停止・削除されています）';
  }
  if (/タイムアウト/.test(m)) return m;
  if (/does not exist|schema cache|relation/i.test(m)) {
    return 'クラウド側のテーブルがありません（supabase/schema.sql を実行してください）';
  }
  if (/JWT|apikey|Invalid API key|401|403/i.test(m)) {
    return 'クラウドのキーが正しくありません（VITE_SUPABASE_PUBLISHABLE_KEY を確認してください）';
  }
  return m;
}
export { report as reportSyncStatus };

// 圏外・プロジェクト消滅などで永久に待たされないよう上限を設ける
const TIMEOUT_MS = 12000;
function withTimeout(promise, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: 接続がタイムアウトしました`)), TIMEOUT_MS)
    ),
  ]);
}

// Supabase のエラーは throw されず { error } で返るので、明示的に拾う
function unwrap(res, label) {
  if (res && res.error) {
    throw new Error(`${label}: ${res.error.message}`);
  }
  return res ? res.data : null;
}

// ============================================================
// Load: Supabase → アプリ内形式
// 戻り値: { ok: true, data: {...} } / { ok: false, error: '...' }
// ============================================================
export async function loadAllFromSupabase() {
  if (!isSupabaseEnabled) {
    return { ok: false, error: 'Supabaseの設定（URL・キー）がありません' };
  }

  report('loading');

  try {
    const [workoutsRes, squatsRes, reservationsRes, menusRes, settingsRes] = await withTimeout(
      Promise.all([
        supabase.from('workouts').select('*'),
        supabase.from('squat_records').select('*').order('date', { ascending: true }),
        supabase.from('reservations').select('*'),
        supabase.from('menus').select('*'),
        supabase.from('squat_settings').select('*').eq('id', 1).maybeSingle(),
      ]),
      'クラウド読み込み'
    );

    const workouts = unwrap(workoutsRes, 'workouts');
    const squats = unwrap(squatsRes, 'squat_records');
    const reservationRows = unwrap(reservationsRes, 'reservations');
    const menuRows = unwrap(menusRes, 'menus');
    const settingsRow = unwrap(settingsRes, 'squat_settings');

    // workouts → { "2024-01-01": "A" }
    const history = {};
    (workouts || []).forEach(row => {
      history[row.date] = row.menu_id;
    });

    // squat_records → { "2024-01-01": [{id, reps, sets}, ...] }
    const squatHistory = {};
    (squats || []).forEach(row => {
      if (!squatHistory[row.date]) squatHistory[row.date] = [];
      squatHistory[row.date].push({
        id: row.client_id,
        reps: row.reps,
        sets: row.sets,
      });
    });

    // reservations → { "2024-01-01": true }
    const reservations = {};
    (reservationRows || []).forEach(row => {
      reservations[row.date] = true;
    });

    // menus → { A: {...}, B: {...} }
    const menus = {};
    (menuRows || []).forEach(row => {
      menus[row.id] = {
        id: row.id,
        title: row.title,
        color: row.color,
        borderColor: row.border_color,
        textColor: row.text_color,
        bgColor: row.bg_color,
        items: row.items || [],
        isActive: row.is_active,
      };
    });

    const squatSettings = settingsRow ? {
      name: settingsRow.name,
      defaultReps: settingsRow.default_reps,
      defaultSets: settingsRow.default_sets,
      unit: settingsRow.unit,
      countCondition: settingsRow.count_condition,
      conditionValue: settingsRow.condition_value,
    } : null;

    report('synced', '読み込み完了');

    return {
      ok: true,
      data: {
        // 空オブジェクトと「データ無し」を区別できるよう、件数も返す
        history,
        squatHistory,
        reservations,
        menus,
        squatSettings,
        isEmpty:
          Object.keys(history).length === 0 &&
          Object.keys(squatHistory).length === 0 &&
          Object.keys(reservations).length === 0 &&
          Object.keys(menus).length === 0,
      },
    };
  } catch (err) {
    console.error('Supabase load error:', err);
    const msg = humanizeError(err.message);
    report('error', msg);
    return { ok: false, error: msg };
  }
}

// ============================================================
// Save: アプリ内形式 → Supabase
// すべて「upsert → 今回に無いキーだけ削除」方式
// ============================================================

// 1回の同期で消してよい上限。これを超える削除はバグを疑って中止する。
// （記録が大量に消えるくらいなら、ゴミが残るほうがマシ）
const MAX_DELETE_PER_SYNC = 50;

// 共通処理：rows を upsert し、手元に無くなった行だけを削除する
//
// 「keepKeys に無い行を全部消す」を1本のクエリでやると、
// 記録が増えたときにURLが長くなりすぎて壊れる。
// そこで「今クラウドにあるキー」を取ってきて差分だけ消す。
async function upsertAndPrune({ table, rows, keyColumn, keepKeys, conflict }) {
  if (rows.length > 0) {
    unwrap(
      await supabase.from(table).upsert(rows, { onConflict: conflict || keyColumn }),
      `${table} upsert`
    );
  }

  const existing = unwrap(
    await supabase.from(table).select(keyColumn),
    `${table} keys`
  );

  const keep = new Set(keepKeys.map(String));
  const toDelete = (existing || [])
    .map(row => String(row[keyColumn]))
    .filter(key => !keep.has(key));

  if (toDelete.length === 0) return;

  if (toDelete.length > MAX_DELETE_PER_SYNC) {
    throw new Error(
      `${table}: ${toDelete.length}件を削除しようとしたため中止しました（安全装置）。` +
      `クラウドのデータはそのまま残しています。`
    );
  }

  unwrap(
    await supabase.from(table).delete().in(keyColumn, toDelete),
    `${table} prune`
  );
}

// 書き込み前の共通ガード
async function guardedWrite(label, fn) {
  if (!isSupabaseEnabled) return;
  if (!writeEnabled) {
    // 読み込みに成功していないので書かない（これが今回のデータ消失の再発防止）
    console.warn(`⛔ ${label}: クラウド読み込み未完了のため書き込みを中止しました`);
    return;
  }
  try {
    report('saving');
    await withTimeout(fn(), label);
    report('synced', '保存しました');
  } catch (err) {
    console.error(`${label} error:`, err);
    report('error', humanizeError(err.message));
  }
}

export async function syncHistory(history) {
  await guardedWrite('syncHistory', async () => {
    const dates = Object.keys(history);
    await upsertAndPrune({
      table: 'workouts',
      keyColumn: 'date',
      keepKeys: dates,
      rows: dates.map(date => ({
        date,
        menu_id: history[date],
        updated_at: new Date().toISOString(),
      })),
    });
  });
}

export async function syncSquatHistory(squatHistory) {
  await guardedWrite('syncSquatHistory', async () => {
    const rows = [];
    Object.entries(squatHistory).forEach(([date, records]) => {
      (records || []).forEach(r => {
        rows.push({
          client_id: String(r.id),
          date,
          reps: Number(r.reps) || 0,
          sets: Number(r.sets) || 0,
        });
      });
    });
    await upsertAndPrune({
      table: 'squat_records',
      keyColumn: 'client_id',
      keepKeys: rows.map(r => r.client_id),
      rows,
    });
  });
}

export async function syncReservations(reservations) {
  await guardedWrite('syncReservations', async () => {
    const dates = Object.keys(reservations).filter(d => reservations[d]);
    await upsertAndPrune({
      table: 'reservations',
      keyColumn: 'date',
      keepKeys: dates,
      rows: dates.map(date => ({ date })),
    });
  });
}

export async function syncMenus(menus) {
  await guardedWrite('syncMenus', async () => {
    const rows = Object.values(menus).map(m => ({
      id: m.id,
      title: m.title,
      color: m.color,
      border_color: m.borderColor,
      text_color: m.textColor,
      bg_color: m.bgColor,
      items: m.items || [],
      is_active: m.isActive,
      updated_at: new Date().toISOString(),
    }));
    // メニューは削除ではなく上書きのみ（誤って全メニューが消えるのを防ぐ）
    if (rows.length > 0) {
      unwrap(await supabase.from('menus').upsert(rows, { onConflict: 'id' }), 'menus upsert');
    }
  });
}

export async function syncSquatSettings(settings) {
  await guardedWrite('syncSquatSettings', async () => {
    unwrap(
      await supabase.from('squat_settings').upsert({
        id: 1,
        name: settings.name,
        default_reps: Number(settings.defaultReps) || 30,
        default_sets: Number(settings.defaultSets) || 1,
        unit: settings.unit,
        count_condition: settings.countCondition,
        condition_value: Number(settings.conditionValue) || 100,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }),
      'squat_settings upsert'
    );
  });
}

// デバウンス用ユーティリティ
export function debounce(fn, ms = 1500) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
