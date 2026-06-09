# iOS アプリ化（Capacitor）

八百万クエストは API ルート（`/api/*`）を使うため**静的エクスポートはできません**。
そこで Capacitor の「ネイティブシェルがデプロイ済みの Web アプリ URL を読み込む」方式を採用します。

## 前提
- macOS + Xcode（最新）
- Apple Developer アカウント（App Store 配布・実機テスト・APNs に必要）
- デプロイ済みの本番 URL（例：Vercel）

> 注意：App Store への申請・コード署名・Apple アカウント作成や認証情報の入力は、各自の環境で行ってください（このリポジトリでは自動化しません）。

## セットアップ手順

1. 依存をインストール
   ```bash
   npm install
   ```
   （`@capacitor/cli` は devDependencies、`@capacitor/core` / `@capacitor/ios` は optionalDependencies に追加済み）

2. `capacitor.config.json` の `server.url` をデプロイ済み URL に置き換える
   ```json
   "server": { "url": "https://your-app.vercel.app", "cleartext": false }
   ```
   - これにより、ネイティブシェルは本番の Web アプリを読み込みます（API ルートもそのまま動作）。
   - ローカル開発機の Next を実機で見る場合は `http://<LAN-IP>:3000` ＋ `"cleartext": true`。

3. iOS プラットフォームを追加して同期
   ```bash
   npx cap add ios
   npx cap sync ios
   ```

4. Xcode で開く
   ```bash
   npx cap open ios
   ```
   - 署名チーム（Apple Developer）を設定し、実機 or シミュレータで実行。

## 通知（APNs）
- Web Push（PWA）は `public/sw.js` で実装済み。ネイティブ push（APNs）を使う場合は
  `@capacitor/push-notifications` を追加し、Xcode で Push Notifications capability と
  APNs 鍵を設定してください。

## 権限（Info.plist）
- 位置情報：`NSLocationWhenInUseUsageDescription`
- カメラ（写真・アバター・証拠写真）：`NSCameraUsageDescription`
- フォトライブラリ：`NSPhotoLibraryUsageDescription`
をそれぞれ追記してください。

## 補足：将来 PWA を直接ラップしたい場合
`server.url` を使わず Web 資産を同梱するには、API を別ホスト（または Edge Functions）に分離し
`next build && next export` 相当の静的化が必要です。現構成では `server.url` 方式が最短・確実です。
