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

## 自動プッシュ（リテンション）
ユーザーが操作しなくても届く、サーバー駆動の通知が3種ある。いずれもプッシュ鍵
（VAPID/APNs）未設定なら静かにスキップ（best-effort）。

| 種別 | きっかけ | 実装 |
|---|---|---|
| 新しい神様が現れた | 近接の主スポット生成時 | `POST /api/generate-spot`（body `notify:true` のときのみ送信）＋アプリ内トースト |
| 神様からの手紙（週次） | Cron（既定: 月曜 08:00 JST） | `GET /api/cron/weekly-letter` → 先週の巡礼を要約・AI で物語化し各スナップショットへ追記 → user-self へプッシュ |
| ストリークリマインダー（日次） | Cron（既定: 19:00 JST） | `GET /api/cron/streak-reminder` → 連続参拝中かつ本日未参拝なら1通だけプッシュ |

### Cron の構成
- スケジュールは `vercel.json` の `crons`（UTC 表記）。
- 認可は `CRON_SECRET`。**未設定だと cron ルートは 503 で no-op**（安全側）。Vercel は
  `CRON_SECRET` を登録すると実行時に `Authorization: Bearer <CRON_SECRET>` を自動付与する。
  手動・外部 cron からは `?key=<CRON_SECRET>` でも叩ける。
- 手紙は同期キー `yaorozu_letters` としてスナップショットへ追記され、クライアントは起動時の
  `pullSnapshot` で受け取り、受信箱（`LetterInbox`）で読み返す。プッシュ `url:'/?letters=1'`
  から起動すると受信箱が自動で開く。
- プッシュは現状ブロードキャスト（購読↔userId 紐付けが無い）。そのためストリーク／手紙の
  プッシュはデモの基準ユーザー `user-self` を起点に1回だけ送る。個別配信は将来の課題。
