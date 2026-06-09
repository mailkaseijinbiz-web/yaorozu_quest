# iOS ネイティブプッシュ（APNs）

iOS アプリ（Capacitor）は WKWebView 内なので Web Push が使えない。代わりに **APNs**（Apple Push Notification service）で直接プッシュする。Firebase は不要。Web/PWA は従来どおり Web Push のまま（自動で切り替わる）。

## 仕組み（実装済み）
- **クライアント**: `Capacitor.isNativePlatform()` で iOS を検出し、`@capacitor/push-notifications` で APNs デバイストークンを取得 → `/api/push/subscribe` に `{ platform: 'ios', token }` で保存（`src/lib/native-push.ts`）。
- **サーバ**: `src/lib/apns-server.ts` が `.p8` 認証キーで ES256 JWT を署名し、HTTP/2 で APNs へ送信。`sendToAll()`（`push-server.ts`）が Web Push と APNs の両方へ配信するので、管理画面の一斉送信も新クエストの自動通知も iOS に届く。
- **保存先**: Supabase テーブル `apns_tokens`（無効時はメモリにフォールバック）。

## ⚠️ 前提：有料 Apple Developer Program が必須
APNs（Push Notifications）は **有料の Apple Developer Program（年 $99）** でのみ利用可能。
**無料の Apple ID（Personal Team）は Apple が Push を許可していない**ため、`aps-environment`
entitlement を含めると署名・ビルドに失敗する（`Personal development teams ... do not support
the Push Notifications capability`）。そのため本リポジトリでは entitlements を**ビルドに紐付けて
いない**（無料アカウントでも実機ビルドできるよう据え置き）。下記は有料登録後の手順。

## 有効化に必要な作業（各自の環境）

### 0. Apple Developer Program に登録（有料）
[developer.apple.com](https://developer.apple.com/programs/) で年額登録。これで .p8 作成と
Push capability が使えるようになる。

### 1. APNs 認証キー(.p8) を作成
[Apple Developer](https://developer.apple.com/account) → Certificates, Identifiers & Profiles → **Keys** → ＋ → **Apple Push Notifications service (APNs)** を有効化して作成 → `AuthKey_XXXXXXXXXX.p8` をダウンロード（**1回しか落とせない**）。
- **Key ID**（10桁）を控える。
- **Team ID** = `576D2UUHH5`。
- Bundle ID = `biz.kaseijin.yaorozu`。

### 2. App ID に Push を有効化（entitlements を紐付ける）
Xcode で App ターゲット → Signing & Capabilities → **＋ Capability → Push Notifications** を追加。
自動署名が App ID に Push を登録し、`CODE_SIGN_ENTITLEMENTS` が同梱の `ios/App/App/App.entitlements`
（`aps-environment` = development）に設定される。
> 同梱の `App.entitlements` は無料アカウントのビルドを壊さないよう**未参照**にしてある。上記の
> capability 追加で初めてビルドに紐付く。CLI なら build 設定に `CODE_SIGN_ENTITLEMENTS = App/App.entitlements;` を戻す。

### 3. Vercel 環境変数
```
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=576D2UUHH5
APNS_BUNDLE_ID=biz.kaseijin.yaorozu
APNS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...（.p8 の中身。改行は \n でも実改行でも可）...\n-----END PRIVATE KEY-----
APNS_PRODUCTION=false   # 開発ビルド=Sandbox。App Store/TestFlight 配布時は true
```
> `.env.local` にも同様に置けばローカル送信もテスト可。

### 4. Supabase テーブル
`src/lib/schema.sql` の `apns_tokens` を Supabase SQL エディタで実行。

## Sandbox と本番の切り替え（重要）
- **開発ビルド（実機に Xcode/CLI で入れたもの）** のトークンは **Sandbox APNs**（`api.sandbox.push.apple.com`）でしか届かない → `APNS_PRODUCTION=false`。
- **TestFlight / App Store 配布** のトークンは **本番 APNs**（`api.push.apple.com`）→ `APNS_PRODUCTION=true`。
- 同じ `.p8` 認証キーが両環境で使える。entitlements の `aps-environment` は配布時に Xcode が production へ切り替える。

## 動作確認
1. 実機アプリでクエスト参加など `subscribePush()` が呼ばれる操作をする（初回は通知許可ダイアログ）。
2. 管理画面（`/admin` → System タブ）→「登録端末全員に送信」で iOS に通知が届く。
3. 通知タップで payload の `url` に遷移する。
