# Vercel デプロイ手順

「八百万クエスト」（Next.js 16 / App Router）を Vercel に GitHub 連携で自動デプロイするための手順。

## 前提

- 本番ビルドは `npm run build` で成功することを確認済み（Next.js 16 / Turbopack）。
- Node.js は **20.9 以上（推奨 v22）**。`.nvmrc` と `package.json` の `engines` で指定済みなので Vercel が自動で合わせる。
- このリポジトリは Vercel が Next.js を自動検出するため、`vercel.json` は不要。

## 1. Vercel プロジェクトを作成（初回のみ）

1. https://vercel.com/new にアクセスし、GitHub アカウントを連携。
2. リポジトリ `mailkaseijinbiz-web/yaorozu_quest` を **Import**。
3. Framework Preset は **Next.js** が自動選択される。Build / Output 設定はデフォルトのままでよい。
4. **Environment Variables** に下記（後述）を登録してから **Deploy**。

## 2. 環境変数（Vercel: Project Settings → Environment Variables）

`.env.example` を参照。Production / Preview の両方に設定する。

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | ✅ 必須 | 管理画面 `/admin` のログイン。**本番は必ず強固な値に。** |
| `SUPABASE_URL` | ✅ 推奨 | データ永続化（サーバー専用）。 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ 推奨 | 同上。サービスロールキー。**クライアントに露出させない。** |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ 推奨 | ブラウザ側 Supabase 参照。 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ 推奨 | 同上。anon キー。 |
| `GEMINI_API_KEY` | 任意 | 神との AI チャット。未設定時はルールベースにフォールバック。 |
| `OPENAI_API_KEY` | 任意 | AI チャット（代替）。 |
| `VAPID_PUBLIC_KEY` | 任意 | Web Push 通知。 |
| `VAPID_PRIVATE_KEY` | 任意 | 同上。 |
| `VAPID_SUBJECT` | 任意 | 同上（例 `mailto:admin@example.com`）。 |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | 任意 | ブラウザ側の Push 購読用公開鍵。 |

> Supabase 未設定でもアプリは起動するが、データはブラウザの localStorage のみとなり端末間同期されない。

## 3. Supabase スキーマ

初回は `supabase/schema.sql` を Supabase の SQL Editor で実行し、`user_snapshots`（および Push 用テーブル）を作成しておく。

## 4. 自動デプロイ（2回目以降）

GitHub 連携を済ませた後は、対象ブランチへの push で自動的にデプロイされる。

- **本番（Production）**: 通常は `main` への push / マージ。
- **プレビュー（Preview）**: それ以外のブランチ（例 `claude/vercel-deployment-k600zo`）への push ごとに一意の Preview URL が発行される。

このリポジトリの作業は `claude/vercel-deployment-k600zo` ブランチで進めている。Vercel に連携済みであれば、このブランチへの push で Preview デプロイが走る。本番反映は `main` へマージする。
