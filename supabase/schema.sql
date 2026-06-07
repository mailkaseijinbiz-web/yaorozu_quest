-- ============================================================
-- YAOROZU QUEST — Supabase schema
-- Supabase SQL Editor に貼り付けて実行してください。
-- 永続化対象は「ユーザー生成データ」のみ。
-- スポット/神/チャレンジは手続き生成のシードのためDB化不要。
-- ============================================================

-- 1. ユーザー（プロフィール＋累計徳）
create table if not exists public.users (
  id text primary key,
  display_name text not null default '巡礼者',
  avatar_url text not null default '',
  total_toku integer not null default 0,
  current_title text not null default '',
  avatar_frame_color text,
  updated_at timestamptz not null default now()
);

-- 2. ユーザー統計（訪問・タスク達成などの集計を1行JSONで保持）
create table if not exists public.user_stats (
  user_id text primary key references public.users(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 3. UGC投稿（口コミ・できごと等）
create table if not exists public.ugc_posts (
  id text primary key,
  user_id text not null,
  user_display_name text not null,
  spot_id text not null,
  content text not null,
  image_url text,
  likes_count integer not null default 0,
  liked_by jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists ugc_posts_spot_idx on public.ugc_posts (spot_id);

-- 4. スポット投稿写真
create table if not exists public.spot_photos (
  id bigint generated always as identity primary key,
  spot_id text not null,
  url text not null,
  user_id text not null,
  user_display_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists spot_photos_spot_idx on public.spot_photos (spot_id);

-- 5. スポットの「楽しみ方」（UGCで成長）
create table if not exists public.spot_enjoyments (
  id bigint generated always as identity primary key,
  spot_id text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists spot_enjoyments_spot_idx on public.spot_enjoyments (spot_id);

-- 6. チャレンジ進捗（ユーザーごと1行）
create table if not exists public.challenge_progress (
  user_id text primary key references public.users(id) on delete cascade,
  active_id text,
  done jsonb not null default '{}'::jsonb,        -- { [challengeId]: stepId[] }
  completed jsonb not null default '[]'::jsonb,   -- challengeId[]
  updated_at timestamptz not null default now()
);

-- 7. チャレンジ証拠写真（振り返り用）
create table if not exists public.challenge_photos (
  id bigint generated always as identity primary key,
  user_id text not null,
  challenge_id text not null,
  step_id text not null,
  data_url text not null,        -- 当面はdataURL。将来Storageに移行可
  created_at timestamptz not null default now(),
  unique (user_id, challenge_id, step_id)
);
create index if not exists challenge_photos_user_idx on public.challenge_photos (user_id);

-- ============================================================
-- RLS: デモ段階はサーバー(API Route)経由のサービスロールでのみ書込。
-- 公開読み取りを許可し、書込はサービスロール限定にする例。
-- ============================================================
alter table public.users enable row level security;
alter table public.user_stats enable row level security;
alter table public.ugc_posts enable row level security;
alter table public.spot_photos enable row level security;
alter table public.spot_enjoyments enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.challenge_photos enable row level security;

-- 公開読み取り（anonでもSELECT可）
do $$
declare t text;
begin
  foreach t in array array['users','user_stats','ugc_posts','spot_photos','spot_enjoyments','challenge_progress','challenge_photos']
  loop
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format('create policy %I_read on public.%I for select using (true);', t, t);
  end loop;
end $$;
-- 書込はサービスロール(API Route)のみ。anonキーには write ポリシーを与えない。
