# App Store 提出チェックリスト（八百万クエスト）

Capacitor iOS アプリ（`biz.kaseijin.yaorozu` / 表示名「八百万クエスト」）を App Store に出すための手順。
**太字＝あなたしかできない作業**、それ以外はリポジトリ側で準備済み。

## 0. 前提
- **有料 Apple Developer Program（年 $99）への登録**（APNs と App Store 配布の両方に必須）。
- **App Store 申請・コード署名・アーカイブは安定版（リリース版）Xcode で行う**。beta Xcode のバイナリは受理されない。
- 実機は iOS 27.0（beta OS）。**提出用アーカイブはリリース版 iOS をターゲットに**（deployment target は 15.0 設定済み）。

## 1. リポジトリ側で準備済み ✅
- **アプリアイコン**: `Assets.xcassets/AppIcon`（1024px・不透過・角丸/透過なし＝赤地に白い鳥居）。Capacitor 既定ロゴから差し替え済み。
- **スプラッシュ**: 赤地＋白い鳥居（`Splash.imageset`、`scaleAspectFill` で全面）。
- **権限の説明文**（Info.plist）: 位置情報・カメラ・写真ライブラリ。
- **プライバシーマニフェスト** `PrivacyInfo.xcprivacy`: トラッキング無し＋Required Reason API 申告（UserDefaults/FileTimestamp/SystemBootTime/DiskSpace）。
- **暗号化コンプラ** `ITSAppUsesNonExemptEncryption=false`（標準HTTPSのみ→毎回の輸出申告を省略）。
- UIScene 対応・セーフエリア・iOS 15.0 デプロイ先。

## 2. App Store Connect でやること（**要あなた**）
1. [App Store Connect](https://appstoreconnect.apple.com) で **新規 App** を作成（プラットフォーム iOS、Bundle ID `biz.kaseijin.yaorozu`、SKU 任意）。
2. **App 情報**: 名前「八百万クエスト」、サブタイトル、カテゴリ（例: ゲーム/ナビゲーション/ライフスタイル）、年齢制限（コンテンツに応じ）。
3. **プライバシーポリシー URL**（必須）。位置情報・写真・アカウントを扱うため、ポリシーページを用意して URL を登録。
4. **App プライバシー（データ収集の設問）**: 以下を申告
   - 位置情報（**正確な位置**）: アプリ機能のため。トラッキングには使わない。
   - 写真/動画: アプリ機能（証拠写真・アバター）のため。
   - （OAuth ログイン使用時）アカウント/メール等。
5. **スクリーンショット**（必須・最低 6.7"/6.5" iPhone）:
   - 6.9" or 6.7"（iPhone 15/16 Pro Max など）1290×2796 等。最低 1 枚、推奨 3〜5 枚。
   - クエスト一覧／マップ／クエスト進行などを撮ると良い（実機 or シミュレータで撮影）。
6. **説明文・キーワード・サポートURL・著作権**。

## 3. ⚠️ 審査リスク（Guideline 4.2 Minimum Functionality）
本アプリは本番Webを WKWebView で読み込む方式のため、「単なる Web ラッパー」と見なされ却下されうる。
**緩和策**（推奨、未対応なら検討）:
- 位置情報・カメラ・AR などネイティブ機能を**実際にネイティブプラグイン**で使う（`@capacitor/geolocation` 等）。
- 審査メモに「位置情報AR体験を提供するネイティブ機能を含む」旨を明記。
- プッシュ通知（APNs）対応も加点要素（[docs/APNS.md](APNS.md)）。

## 4. 審査メモ（App Review Information）
- **デモ手順**: 位置情報が無い審査環境向けに、`?debug=1` でデバッグパネルから現在地を手動指定できる旨を記載（`src/lib/debug.ts`）。
- 管理画面 `/admin` を見せる必要があれば `ADMIN_PASSWORD` を審査メモに記載（本番値）。
- 連絡先（氏名・電話・メール）。

## 5. ビルド＆アップロード（**要あなた**・安定版 Xcode）
1. `git pull` で最新を取得し、`npx cap sync ios`（DEVELOPER_DIR は安定版）。
2. Xcode で開く: `npx cap open ios`。
3. **Signing & Capabilities**: Team を選択（**有料登録後**は本番の配布署名）。APNs を使うなら **Push Notifications capability** を追加。
4. `MARKETING_VERSION`（例 1.0.0）と `CURRENT_PROJECT_VERSION`（ビルド番号、提出ごとに +1）を設定。
5. 端末/Generic iOS Device を選び **Product → Archive**。
6. Organizer から **Distribute App → App Store Connect** でアップロード。
7. App Store Connect でビルドを選び、TestFlight で動作確認 → 審査提出。

## 6. 提出前の最終チェック
- [ ] 有料 Developer Program 登録済み
- [ ] アイコン/スプラッシュがブランドに差し替わっている（✅準備済み）
- [ ] 権限ダイアログの文言が表示される（✅）
- [ ] プライバシーポリシー URL 登録
- [ ] App プライバシー設問を申告
- [ ] スクリーンショット
- [ ] 審査メモにデモ手順
- [ ] リリース版 Xcode でアーカイブ
