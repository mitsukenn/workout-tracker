-- ============================================================
-- 筋トレ記録アプリ テーブル定義
--
-- 使い方:
--   Supabase ダッシュボード → 左メニュー SQL Editor → New query
--   このファイルの中身を全部貼り付けて Run
--   （何度実行しても壊れないように書いてあります）
-- ============================================================

-- ジムでのトレーニング記録（1日1件）
create table if not exists public.workouts (
  date       date primary key,
  menu_id    text not null,
  updated_at timestamptz not null default now()
);

-- ジム外アクティビティ（スクワット等・1日に複数件）
-- client_id はアプリ側で採番するID。これを主キーにすることで
-- 「同じ記録を二重に入れない」「消えた記録だけを消す」が成立する。
create table if not exists public.squat_records (
  client_id  text primary key,
  date       date not null,
  reps       integer not null default 0,
  sets       integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists squat_records_date_idx on public.squat_records (date);

-- ジムの予約日
create table if not exists public.reservations (
  date       date primary key,
  created_at timestamptz not null default now()
);

-- メニュー設定（A/B/C/D）
create table if not exists public.menus (
  id           text primary key,
  title        text,
  color        text,
  border_color text,
  text_color   text,
  bg_color     text,
  items        jsonb not null default '[]'::jsonb,
  is_active    boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- ジム外メニューの設定（1行のみ・id は常に 1）
create table if not exists public.squat_settings (
  id              integer primary key,
  name            text,
  default_reps    integer,
  default_sets    integer,
  unit            text,
  count_condition text,
  condition_value integer,
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- RLS（アクセス制御）
--
-- このアプリはログイン無しで使う個人用アプリなので、
-- 公開キー（anon）に読み書きを許可する。
-- ＝ URLと公開キーを知っている人は誰でも読み書きできる。
-- 気になる場合はログイン方式に変えられるので相談してください。
-- ============================================================

alter table public.workouts       enable row level security;
alter table public.squat_records  enable row level security;
alter table public.reservations   enable row level security;
alter table public.menus          enable row level security;
alter table public.squat_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['workouts','squat_records','reservations','menus','squat_settings']
  loop
    execute format('drop policy if exists anon_all on public.%I', t);
    execute format(
      'create policy anon_all on public.%I for all to anon, authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

-- ============================================================
-- 初期データ（ジム外メニュー設定の1行）
-- ============================================================
insert into public.squat_settings (id, name, default_reps, default_sets, unit, count_condition, condition_value)
values (1, '自重スクワット', 30, 1, '回', 'conditional', 100)
on conflict (id) do nothing;
