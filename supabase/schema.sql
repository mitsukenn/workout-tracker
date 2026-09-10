-- ============================================================
-- 筋トレ記録アプリ スキーマ
--
-- 使い方:
--   Supabase ダッシュボード → SQL Editor → New query
--   このファイルの中身を全部貼り付けて Run
--
-- 新規プロジェクトでも、既存プロジェクト（2025年に作ったもの）でも
-- そのまま実行できる。何度実行しても壊れない。
-- 既存データは消さない。
-- ============================================================

-- ------------------------------------------------------------
-- 1. テーブル（無ければ作る）
-- ------------------------------------------------------------

create table if not exists public.workouts (
  id      uuid primary key default gen_random_uuid(),
  date    date not null,
  menu_id text not null
);

create table if not exists public.squat_records (
  id   uuid primary key default gen_random_uuid(),
  date date not null,
  reps integer not null default 0,
  sets integer not null default 0
);

create table if not exists public.reservations (
  id   uuid primary key default gen_random_uuid(),
  date date not null
);

create table if not exists public.menus (
  id           text primary key,
  title        text,
  color        text,
  border_color text,
  text_color   text,
  bg_color     text,
  items        jsonb not null default '[]'::jsonb,
  is_active    boolean not null default true
);

create table if not exists public.squat_settings (
  id              integer primary key,
  name            text,
  default_reps    integer,
  default_sets    integer,
  unit            text,
  count_condition text,
  condition_value integer
);

-- ------------------------------------------------------------
-- 2. 列の追加（既存テーブルに足りないものを補う）
--    アプリは updated_at / created_at を書きに行くので必須
-- ------------------------------------------------------------

alter table public.workouts       add column if not exists updated_at timestamptz not null default now();
alter table public.workouts       add column if not exists created_at timestamptz not null default now();
alter table public.squat_records  add column if not exists created_at timestamptz not null default now();
alter table public.reservations   add column if not exists created_at timestamptz not null default now();
alter table public.menus          add column if not exists updated_at timestamptz not null default now();
alter table public.menus          add column if not exists items jsonb not null default '[]'::jsonb;
alter table public.menus          add column if not exists is_active boolean not null default true;
alter table public.squat_settings add column if not exists updated_at timestamptz not null default now();

-- ------------------------------------------------------------
-- 3. client_id を text の完全UNIQUEにする
--
--    旧: client_id bigint ＋ 部分UNIQUE索引（WHERE client_id IS NOT NULL）
--    部分索引は ON CONFLICT の対象にできず、upsert が失敗する。
--    アプリ側のIDは文字列で扱うので text に統一する。
-- ------------------------------------------------------------

alter table public.squat_records add column if not exists client_id text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'squat_records'
      and column_name = 'client_id' and data_type <> 'text'
  ) then
    alter table public.squat_records alter column client_id type text using client_id::text;
  end if;
end $$;

-- 既存行で client_id が空のものを埋める（消さずに残すため）
update public.squat_records set client_id = id::text where client_id is null;

alter table public.squat_records alter column client_id set not null;

-- 部分索引を捨てて、条件なしのUNIQUEを張り直す
drop index if exists public.squat_records_client_id_key;
create unique index if not exists squat_records_client_id_uniq
  on public.squat_records (client_id);

-- ------------------------------------------------------------
-- 4. upsert の衝突先になるUNIQUE（date）
-- ------------------------------------------------------------

create unique index if not exists workouts_date_key     on public.workouts (date);
create unique index if not exists reservations_date_key on public.reservations (date);
create index        if not exists squat_records_date_idx on public.squat_records (date);

-- ------------------------------------------------------------
-- 5. RLS（アクセス制御）
--
--    ログイン無しで使う個人用アプリなので、公開キー(anon)に読み書きを許可する。
--    ＝ URLと公開キーを知っている人は誰でも読み書きできる。
--    ログイン方式にしたくなったらここを変える。
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 6. 初期データ（ジム外メニュー設定の1行）
-- ------------------------------------------------------------

insert into public.squat_settings (id, name, default_reps, default_sets, unit, count_condition, condition_value)
values (1, '自重スクワット', 30, 1, '回', 'conditional', 100)
on conflict (id) do nothing;
