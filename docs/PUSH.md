# Web Push（VAPID）セットアップ

アプリ非起動時にもサーバから通知を配信する本物の Web Push を実装済み。

## 仕組み
- 端末は Service Worker（`public/sw.js`）の `pushManager` で購読し、購読情報を `/api/push/subscribe` に保存。
- サーバは `web-push` ＋ VAPID 鍵で `/api/push/send` から全端末へ送信。SW の `push` イベントが通知を表示。
- 購読の保存先は Supabase テーブル `push_subscriptions`（無効/未作成時はサーバ内メモリにフォールバック）。

## 必要な環境変数（.env / Vercel）
```
VAPID_PUBLIC_KEY=...            # 公開鍵
VAPID_PRIVATE_KEY=...           # 秘密鍵（公開しない）
VAPID_SUBJECT=mailto:you@example.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...# 公開鍵（クライアント用・VAPID_PUBLIC_KEY と同値）
```
鍵の生成:
```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
# または: npx web-push generate-vapid-keys
```
> ローカル用に `.env.local` には開発鍵を設定済み。本番は Vercel の環境変数に**本番用の鍵**を設定してください。

## Supabase テーブル
`src/lib/schema.sql` の `push_subscriptions` を Supabase SQL エディタで実行してください。
（未作成でもメモリ保存で動作しますが、サーバ再起動・サーバレスのコールドスタートで購読が消えます。本番は必須。）

## 使い方（管理画面 System タブ）
1. 「プッシュ通知」セクションの **この端末で受信を有効化** をタップ（許可ダイアログ→購読保存）。
2. タイトル・本文を入力し **登録端末全員に送信**。

## 依存
- `web-push`（dependencies）。`npm install` 済みであること。

## 注意
- iOS は **ホーム画面に追加した PWA（standalone）** かつ iOS 16.4+ で Web Push 対応。
- 新クエストのサーバ自動通知を行う場合は、サーバ側の生成処理や Cron から `/api/push/send` を呼び出してください。
