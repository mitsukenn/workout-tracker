// ============================================================
// 端末内保存とバックアップ
//
// localStorage は「オフラインでも開けるようにするキャッシュ」であって
// 最終的な保管場所ではない（iOSは7日程度で勝手に消す）。
// クラウドが使えないときの最後の砦としてJSON書き出し/取り込みを用意する。
// ============================================================

export const STORAGE_KEYS = {
  history: 'workoutHistory',
  squatHistory: 'workoutSquatHistory',
  reservations: 'workoutReservations',
  menus: 'workoutMenus',
  squatSettings: 'workoutSquatSettings',
};

// プライベートブラウズや容量超過で throw するので必ず包む
export function safeGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn(`localStorage読み込み失敗 (${key}):`, err);
    return null;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`localStorage保存失敗 (${key}):`, err);
    return false;
  }
}

// --- バックアップ ----------------------------------------------------

export function buildBackup(state) {
  return {
    format: 'workout-tracker-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    history: state.history || {},
    squatHistory: state.squatHistory || {},
    reservations: state.reservations || {},
    menus: state.menus || {},
    squatSettings: state.squatSettings || null,
  };
}

export function downloadBackup(state) {
  const backup = buildBackup(state);
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workout-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 取り込み。既存データは消さず、日付キー単位でマージする（安全側）
export function applyBackup(backup, current) {
  if (!backup || backup.format !== 'workout-tracker-backup') {
    throw new Error('バックアップファイルの形式が違います');
  }

  const mergedSquat = { ...(current.squatHistory || {}) };
  Object.entries(backup.squatHistory || {}).forEach(([date, records]) => {
    const existing = mergedSquat[date] || [];
    const existingIds = new Set(existing.map(r => String(r.id)));
    const added = (records || []).filter(r => !existingIds.has(String(r.id)));
    mergedSquat[date] = [...existing, ...added];
  });

  return {
    history: { ...(backup.history || {}), ...(current.history || {}) },
    squatHistory: mergedSquat,
    reservations: { ...(backup.reservations || {}), ...(current.reservations || {}) },
    menus: Object.keys(current.menus || {}).length > 0 ? current.menus : (backup.menus || {}),
    squatSettings: current.squatSettings || backup.squatSettings,
  };
}
