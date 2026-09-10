// 毎日のバックアップ兼キープアライブ
//
// 目的は2つ:
//   1. Supabase無料枠は「1週間アクセスが無いと自動停止 → 放置で削除」される。
//      毎日1回触ることで停止させない。（2026-09にこれでプロジェクトごと消えた）
//   2. 全テーブルをJSONに書き出し、GitHub Actionsのアーティファクトとして残す。
//      誤って全消ししても、ここから戻せる。

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です');
  process.exit(1);
}

const TABLES = ['workouts', 'squat_records', 'reservations', 'menus', 'squat_settings'];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

const backup = {
  format: 'workout-tracker-supabase-dump',
  version: 1,
  exportedAt: new Date().toISOString(),
  tables: {},
};

let total = 0;

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*');
  if (error) {
    console.error(`❌ ${table}: ${error.message}`);
    process.exit(1);
  }
  backup.tables[table] = data || [];
  total += (data || []).length;
  console.log(`  ${table}: ${(data || []).length} 件`);
}

await mkdir('backup', { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const path = `backup/workout-backup-${stamp}.json`;
await writeFile(path, JSON.stringify(backup, null, 2), 'utf8');

console.log(`✅ 合計 ${total} 件を ${path} に保存しました`);

// 中身が空のときは気づけるようにする（全消し事故の検知）
if (total === 0) {
  console.warn('⚠️ データが1件もありません。全削除された可能性があります。');
}
