-- ============================================================
-- YAOROZU QUEST — Supabase schema (snapshot 方式)
-- Supabase ダッシュボードの SQL Editor に貼り付けて実行してください。
--
-- localStorage を信頼できる単一ソースとして扱い、ユーザーごとの
-- 「データのまるごとスナップショット(JSON)」を1行で保存・復元します。
-- 端末をまたいだ永続化／消失防止が目的。アプリ側の呼び出し箇所を
-- 大改修せずに導入できます。
-- ============================================================

create table if not exists public.user_snapshots (
  user_id    text primary key,
  data       jsonb not null default '{}'::jsonb,  -- 同期対象キーの { key: value } 集合
  updated_at timestamptz not null default now()
);

-- 書き込みはサーバー(API Route)のサービスロールでのみ行うため、
-- RLS を有効化しつつ anon 用ポリシーは付与しない（＝直接アクセス不可）。
alter table public.user_snapshots enable row level security;
