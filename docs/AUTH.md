# 本格Auth（Supabase Auth / Google・Apple OAuth）

OAuth ログインを実装済み。アプリは anon キーで Supabase Auth に接続し、ログイン中はクラウドデータを
**認証ユーザー単位**（スナップショットID = `auth.uid()`）に分離します。未ログインは従来どおりゲスト（`user-self`）。

## コード側（実装済み）
- `src/lib/supabase-browser.ts`：anon クライアント、`signInWithProvider('google'|'apple')`、`signOutAuth`、`profileFromUser`。
- `src/app/page.tsx`：オンボーディングに「Google / Apple で続ける」ボタン（anon キー設定時のみ表示。未設定ならゲスト登録のみ）。
  セッション監視（リダイレクト復帰）→ プロフィール（名前・アバター）反映＋`setSyncUser(uid)`でクラウド分離。マイページにログアウト。
- `src/lib/cloud-sync.ts`：`setSyncUser(id)` でスナップショットIDを切替。

## 環境変数（設定済み：.env.local / Vercel 本番）
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## あなた側の設定（これが無いとボタンを押してもプロバイダ画面でエラー）
1. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://yaorozu-quest.vercel.app`
   - Redirect URLs に**実際に使う全ドメイン**を追加:
     - `https://yaorozu-quest.vercel.app`
     - `https://yaorozuquestremote.vercel.app` ← remote プロジェクトで遊ぶ場合は必須
     - `http://localhost:3000`
     - （プレビューも使うなら）`https://*-keitayasuis-projects.vercel.app/**`
   - アプリは `redirectTo: window.location.origin` で開いているドメインへ戻る。
     **ここに登録の無いドメインから開始すると、ログイン後に戻れず「機能していない」ように見える。**
2. **Google プロバイダ**（Authentication → Providers → Google）
   - Google Cloud Console で OAuth 2.0 クライアントID/シークレットを作成。
   - 承認済みリダイレクト URI に `https://dwjkvgsvscprhcirewim.supabase.co/auth/v1/callback` を追加。
   - クライアントID/シークレットを Supabase に登録し有効化。
3. **Apple プロバイダ**（任意）
   - Apple Developer で Sign in with Apple のサービスID・キーを作成し Supabase に登録。

## 動作
- 「Google で続ける」→ Google ログイン → アプリへ戻り、名前・アバターが Google のものに。クラウドデータはそのユーザー専用。
- マイページ「ログアウト」でゲストに戻る。

## 「機能しない」ときのチェックリスト
1. **ボタン自体が出ない** → `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が
   **そのデプロイの Vercel プロジェクト**（yaorozu-quest と yaorozu_quest_remote は別プロジェクト！）に
   設定されているか確認。`NEXT_PUBLIC_*` は**ビルド時に焼き込まれる**ため、設定後は再デプロイが必要。
   マイページ下部に「SNSログインは未設定」と表示される場合がこれ。
2. **ボタンを押すとエラーアラート** → アラート内のメッセージを確認（プロバイダ未有効化など）。
   Supabase → Authentication → Providers で Google が Enabled か、
   Google Cloud 側のリダイレクト URI（`https://<project>.supabase.co/auth/v1/callback`）を確認。
3. **Google ログイン後にアプリへ戻らない / 戻ってもゲストのまま** →
   上記 Redirect URLs に「開いているドメイン」が登録されているか確認（remote ドメインの登録漏れが典型）。
4. iOS Safari / ホーム画面追加（PWA）でログインが完了しない問題への対策として、
   認証フローは PKCE（`?code=` 交換方式）にしてある（`supabase-browser.ts`）。

## 注意・今後
- 現在はローカルの DB キーは `user-self` のまま（プロフィールを認証アイデンティティで上書き）、クラウドは uid 単位で分離。
- さらに厳密な per-user 分離（ローカルキーの uid 化）や RLS による行レベル保護は次段階で拡張可能。
