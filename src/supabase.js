import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// プレースホルダのまま残っていないかも見る
const looksReal = (v) => Boolean(v) && !v.includes('ここに') && !v.includes('YOUR_');

export const isSupabaseEnabled = looksReal(supabaseUrl) && looksReal(supabaseKey);

// 未設定の理由（画面に出して原因を分かるようにする）
export const supabaseDisabledReason = isSupabaseEnabled
  ? null
  : !looksReal(supabaseUrl)
    ? 'VITE_SUPABASE_URL が未設定です'
    : 'VITE_SUPABASE_PUBLISHABLE_KEY が未設定です';

if (!isSupabaseEnabled) {
  console.warn(`⚠️ ${supabaseDisabledReason}。この端末のlocalStorageのみで動作します（端末のデータ削除で消えます）。`);
}

export const supabase = isSupabaseEnabled
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    })
  : null;
