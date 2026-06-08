# デプロイ手順（Vercel × GitHub 連携）

Next.js 16 アプリなので **Vercel** が最適です。GitHub 連携にすると、対象ブランチへ push する
たびに自動でデプロイされます。

> このリポジトリはサンドボックス環境からは認証付きデプロイを実行できないため、
> 以下は **vercel.com 側で一度だけ行う接続作業**です。完了後はコード push だけでデプロイされます。

## 1. リポジトリを Vercel に Import

1. https://vercel.com にログイン（GitHub アカウントで可）。
2. **Add New… → Project** → GitHub の `mailkaseijinbiz-web/yaorozu_quest` を **Import**。
3. Framework Preset は **Next.js** が自動検出されます（Build/Output 設定の変更は不要）。
   - Build Command: `next build`（自動）
   - Install Command: `npm install`（自動）
   - Root Directory: `/`（変更不要）

## 2. 環境変数を設定（任意・あとからでも可）

Project Settings → **Environment Variables** に、必要なものだけ登録します
（`.env.example` 参照。未設定でもフォールバックで動作します）。

| 変数名 | 用途 | 未設定時 |
| --- | --- | --- |
| `SUPABASE_URL` | クラウド永続化 | localStorage のみ |
| `SUPABASE_SERVICE_ROLE_KEY` | 同上（**秘密値**） | 同上 |
| `GEMINI_API_KEY` | AIチャット（推奨） | 定型応答にフォールバック |
| `OPENAI_API_KEY` | AIチャット（代替） | 同上 |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` は秘密鍵です。**`NEXT_PUBLIC_` を付けない**こと
> （サーバーの API Route 内でのみ使用しています）。

## 3. デプロイするブランチ

- **本番（Production）**: 既定では `main` への push が本番デプロイになります。
- **プレビュー（Preview）**: それ以外のブランチ（例: `claude/coding-capability-jQlU3`）への
  push ごとに、固有URLのプレビューデプロイが自動生成されます。

今回の変更は `claude/coding-capability-jQlU3` にあります。確認用URLが欲しい場合は、
Import 後にこのブランチがそのままプレビューとしてデプロイされます。本番に出す場合は
`main` へマージしてください。

## 4. デプロイ後の確認（PWA）

- iPhone の **Safari** で本番URLを開く → 共有 → **「ホーム画面に追加」**。
- 全画面（standalone）で起動すれば PWA 化成功です。
- サービスワーカーは **本番でのみ**有効です。

## 補足: Capacitor（App Store）と連動

`docs/IOS.md` の Capacitor 手順で、ここでデプロイした本番URLを `CAP_SERVER_URL` に指定すると、
ネイティブアプリ（WKWebView）がこの公開サイトを読み込みます。

```bash
CAP_SERVER_URL="https://<Vercelの本番URL>" npm run ios:sync
```
