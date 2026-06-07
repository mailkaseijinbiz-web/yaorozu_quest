# 開発ステータス（まだ開発途中のもの）

最終更新: 2026-06-08

「八百万クエスト」のうち、**まだ本実装ではない／モック・仮実装の機能**を一覧化したものです。
本番デモは動作しますが、以下は実運用にあたって追加実装が必要です。

---

## ✅ 完了（旧・最優先）

### 1. データの永続化（バックエンド）— Supabase で稼働中
- **方式**: snapshot 方式。ユーザーごとのデータ(JSON)を `user_snapshots` テーブルに1行で保存・復元。
- **構成**:
  - `supabase/schema.sql` … `user_snapshots` テーブル
  - `src/lib/supabase.ts` … サーバー専用クライアント（secretキーはAPI Routeのみ）
  - `src/app/api/persist/route.ts` … 保存(POST)／復元(GET)
  - `src/lib/cloud-sync.ts` … 起動時 `pullSnapshot`、書込時 `schedulePush`（デバウンス）
  - `src/lib/db.ts` の `save()` で自動同期、`src/app/page.tsx` 起動時に復元
- **同期対象**: 徳・ユーザー・UGC投稿・チャレンジ進捗・証拠写真（重い生成データSPOTS等は除外）。
- **本番**: 環境変数 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 設定済み。エンドツーエンド動作確認済み。
- **今後**: 認証導入で「端末固定の user-self」から「実ユーザー単位」へ拡張。Storage への写真移行。

---

## 🟡 機能はあるが「仮実装」

### 2. AR機能（`src/components/ArTab.tsx`）
- 背景は**描画によるシミュレーション**（"Simulated mystical shrine background"）。
- 実カメラ合成・3Dモデル表示は未実装。共有も "Simulated native share"。

### 3. スポットへの写真投稿（`src/components/SpotDetail.tsx`）
- **端末カメラ／ファイルからの実写真取り込みを実装済み**（`capture="environment"`）。
  選択画像は canvas で長辺1280pxに縮小し JPEG 圧縮して data URL 化（localStorage＋クラウド同期のサイズ対策）。
- ※チャレンジの「証拠写真」も端末カメラ/ファイルから取得する実装あり。
- **残課題**: 保存先が localStorage（snapshot 同期）のため、本番は Supabase Storage へ移行して URL 参照に置き換えるのが望ましい。

### 4. 3Dアバター
- `avatar3dUrl` は **Placeholder**。実際は絵文字／イラストで代用。

### 5. クリエイター/神の編集（`src/components/CreatorTab.tsx`）
- 保存処理が "Simulate database write"＝ localStorage更新のみ（上記1に依存）。

---

## 🟢 デモデータ（生成物のため要差し替え）

### 6. スポット・チャレンジ・蘊蓄
- 東京の約1000スポット、チャレンジ（約1000件）、蘊蓄、神の依頼は**乱数シードによる自動生成**。
- 実在検証済みデータではない（座標・名称・説明は擬似生成）。

### 7. フォロワー/フォロー数など
- `src/lib/db.ts` に「デモ用」のダミー加算処理あり。

---

## ✅ 実装済み（参考）

- AIチャット（神との会話）… **Gemini API（gemini-2.5-flash）で本実装済み**。キー未設定時はルールベースの定型文にフォールバック。
- チャレンジ参加→達成演出→証拠写真→マイページで写真つき振り返りシェア（Web Share API）。
- 近くのクエスト一覧・フィルタ（すべて／未達成／達成）・進捗インジケータ・レベルロック表示。
- 地図（Leaflet）・現在地＋方角マーカー・スポット詳細・UGC投稿（口コミ/写真の奉納と却下）。
- 管理コンソール（神タスク・チャレンジ・蘊蓄の管理）。

---

## 推奨する着手順

1. **①バックエンド永続化（Supabase）** … 最重要。まずチャレンジ進捗・徳・証拠写真から段階的に。
2. **③写真アップロードの実装**（端末カメラ→Supabase Storage）
3. **⑥デモデータの実データ差し替え**
4. **②AR の実カメラ対応**
