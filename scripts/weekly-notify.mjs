// 週次LINE通知スクリプト
// GitHub Actionsから毎週日曜21時(JST)に実行される
// Supabaseから過去7日分のデータを取得し、サマリーをLINEにPush送信

import { createClient } from '@supabase/supabase-js';

// ========================
// 環境変数チェック
// ========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_USER_ID = process.env.LINE_USER_ID;

const missing = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_KEY],
  ['LINE_CHANNEL_ACCESS_TOKEN', LINE_TOKEN],
  ['LINE_USER_ID', LINE_USER_ID],
].filter(([, v]) => !v).map(([k]) => k);

if (missing.length > 0) {
  console.error('❌ 環境変数が未設定です:', missing.join(', '));
  process.exit(1);
}

// ========================
// 日付ユーティリティ（JST基準）
// ========================
function toJST(date) {
  // UTC→JSTはUTC+9時間オフセット
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}
function formatDateJST(date) {
  const jst = toJST(date);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatMonthDay(dateStr) {
  // "2024-01-15" → "1/15"
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}
function getDayLabel(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return ['日', '月', '火', '水', '木', '金', '土'][date.getUTCDay()];
}

// ========================
// メイン処理
// ========================
async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // 今日（JST）と過去7日の範囲
  const now = new Date();
  const today = formatDateJST(now);
  const sevenDaysAgo = formatDateJST(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));

  // 過去7日のworkoutsを取得
  const { data: workouts, error: wErr } = await supabase
    .from('workouts')
    .select('date, menu_id')
    .gte('date', sevenDaysAgo)
    .lte('date', today)
    .order('date', { ascending: true });
  if (wErr) throw wErr;

  // 過去7日のsquat_recordsを取得
  const { data: squats, error: sErr } = await supabase
    .from('squat_records')
    .select('date, reps, sets')
    .gte('date', sevenDaysAgo)
    .lte('date', today);
  if (sErr) throw sErr;

  // menus取得（メニュー名表示用）
  const { data: menus } = await supabase.from('menus').select('id, title');
  const menuTitle = {};
  (menus || []).forEach(m => { menuTitle[m.id] = m.title; });

  // squat_settings取得（単位表示用）
  const { data: settings } = await supabase
    .from('squat_settings').select('unit, condition_value').eq('id', 1).maybeSingle();
  const squatUnit = settings?.unit || '回';
  const bonusPer = settings?.condition_value || 100;

  // 集計
  const gymDays = new Set((workouts || []).map(w => w.date));
  const gymDayCount = gymDays.size;
  const squatTotal = (squats || []).reduce((sum, r) => sum + (r.reps * r.sets), 0);
  const bonusPoints = Math.floor(squatTotal / bonusPer);

  // 日別ログ作成
  const lines = [];
  const dailyMap = new Map();
  (workouts || []).forEach(w => {
    if (!dailyMap.has(w.date)) dailyMap.set(w.date, { menu: null, squat: 0 });
    dailyMap.get(w.date).menu = menuTitle[w.menu_id] || `メニュー${w.menu_id}`;
  });
  (squats || []).forEach(r => {
    if (!dailyMap.has(r.date)) dailyMap.set(r.date, { menu: null, squat: 0 });
    dailyMap.get(r.date).squat += r.reps * r.sets;
  });

  const sortedDates = [...dailyMap.keys()].sort();
  sortedDates.forEach(d => {
    const entry = dailyMap.get(d);
    const parts = [];
    if (entry.menu) parts.push(entry.menu);
    if (entry.squat > 0) parts.push(`スクワット${entry.squat}${squatUnit}`);
    if (parts.length > 0) {
      lines.push(`・${formatMonthDay(d)}(${getDayLabel(d)}) ${parts.join(' + ')}`);
    }
  });

  // 最終活動日
  const lastActivityDate = sortedDates[sortedDates.length - 1];
  let daysSinceLast = null;
  if (lastActivityDate) {
    const lastD = new Date(lastActivityDate + 'T12:00:00Z');
    const todayD = new Date(today + 'T12:00:00Z');
    daysSinceLast = Math.floor((todayD - lastD) / (24 * 60 * 60 * 1000));
  }

  // ========================
  // メッセージ組み立て
  // ========================
  const weekRangeLabel = `${formatMonthDay(sevenDaysAgo)}〜${formatMonthDay(today)}`;

  let message = '';
  if (gymDayCount === 0 && squatTotal === 0) {
    // 全く活動がなかった週
    message = `💪 週間レポート（${weekRangeLabel}）\n\n`;
    message += `😴 今週は記録がありませんでした\n`;
    if (daysSinceLast !== null) {
      message += `📅 最終トレーニング: ${daysSinceLast}日前\n`;
    }
    message += `\n少しずつで大丈夫。\n明日、久しぶりに動いてみませんか？🔥`;
  } else {
    const emoji = gymDayCount >= 3 ? '🔥' : gymDayCount >= 1 ? '👍' : '💪';
    message = `💪 週間レポート（${weekRangeLabel}）${emoji}\n\n`;
    message += `🏋️ ジム通い: ${gymDayCount}日\n`;
    message += `🦵 スクワット: ${squatTotal}${squatUnit}`;
    if (bonusPoints > 0) message += `（+${bonusPoints}pt）`;
    message += `\n`;
    if (lines.length > 0) {
      message += `\n【活動ログ】\n${lines.join('\n')}\n`;
    }
    message += `\n`;
    if (gymDayCount >= 3) {
      message += `素晴らしいペース！🎉 来週もこの調子で！`;
    } else if (gymDayCount >= 1) {
      message += `良いペース！来週はもう1日プラスを目指そう💪`;
    } else {
      message += `スクワット頑張りました！来週はジムにも行ってみよう🔥`;
    }
  }

  console.log('📝 メッセージ:\n', message);

  // ========================
  // LINEにPush送信
  // ========================
  const res = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: LINE_USER_ID,
      messages: [{ type: 'text', text: message }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LINE API error ${res.status}: ${errText}`);
  }

  console.log('✅ LINE送信成功');
}

main().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});
