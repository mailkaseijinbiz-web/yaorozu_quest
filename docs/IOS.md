# iOS アプリ化ガイド（PWA ＋ Capacitor）

八百万クエストを iOS で配布する方法は2系統あります。本リポジトリは両方をセットアップ済みです。

- **A. PWA（ホーム画面に追加）** — すぐ使える。App Store 不要。
- **B. Capacitor ネイティブ化** — 実 `.ipa` を生成し App Store に提出可能。**Mac + Xcode が必要**。

---

## A. PWA（Add to Home Screen）

実装済みのもの:

- `public/manifest.webmanifest` … アプリ名・アイコン・表示モード（standalone）・テーマ色
- `public/icons/*` … アプリアイコン（192/512、maskable）。元データは `public/icons/icon.svg`
- `public/apple-touch-icon.png` … iOS ホーム画面用アイコン（180×180）
- `public/sw.js` + `public/offline.html` … 最小サービスワーカー（オフライン フォールバック）
- `src/app/pwa-register.tsx` … 本番ビルド時のみ SW を登録
- `src/app/layout.tsx` … manifest / `appleWebApp` / アイコンのメタデータ

### 使い方

1. 本番ビルドをデプロイ（**HTTPS 必須**。Vercel 等）。
   ```bash
   npm run build && npm run start   # またはホスティングへデプロイ
   ```
2. iPhone の **Safari** で公開URLを開く → 共有メニュー → **「ホーム画面に追加」**。
3. ホーム画面のアイコンから全画面（standalone）で起動します。

> 注意: サービスワーカーは**本番（NODE_ENV=production）でのみ登録**されます。開発時は HMR と
> 競合しないよう自動で解除されます。

### アイコンを差し替える

`public/icons/icon.svg` を編集し、再生成:

```bash
node -e '
const sharp=require("sharp"),fs=require("fs");
const svg=fs.readFileSync("public/icons/icon.svg");
(async()=>{for(const [o,s] of [["public/icons/icon-192.png",192],["public/icons/icon-512.png",512],["public/icons/icon-maskable-512.png",512],["public/apple-touch-icon.png",180]])await sharp(svg,{density:384}).resize(s,s).png().toFile(o);})();
'
```

---

## B. Capacitor ネイティブアプリ（.ipa / App Store）

このアプリは Next.js の **API ルート**（`/api/chat`・`/api/persist`・`/api/generate-quest`）に依存し、
静的エクスポートできません。そのため Capacitor の殻は **ホスト済みの Web アプリを WKWebView で読み込む**
方式を採ります（`capacitor.config.ts` の `server.url`）。

既定の読み込み先は本番URL **https://yaorozu-quest.vercel.app** です（`capacitor.config.ts` に設定済み）。
別URL（ステージング等）にする場合のみ `CAP_SERVER_URL` で上書きします。

セットアップ済みのもの:

- `@capacitor/core` / `@capacitor/ios` / `@capacitor/cli`（package.json）
- `capacitor.config.ts` … `appId: biz.mailkaseijin.yaorozuquest` / `CAP_SERVER_URL` 対応
- `cap-www/` … `server.url` 未接続時に表示されるローカル ローディング画面（webDir）
- npm スクリプト: `ios:add` / `ios:sync` / `ios:open`
- `.gitignore` … iOS ビルド成果物（Pods 等）を除外

### 前提（Mac 側）

- macOS + **Xcode**（App Store からインストール）
- **CocoaPods**（`sudo gem install cocoapods` または `brew install cocoapods`）
- Apple Developer アカウント（実機配布・App Store 提出時）

### 手順（Mac で実行）

```bash
# 1) 依存をインストール
npm install

# 2) iOS ネイティブプロジェクトを生成（初回のみ）。ios/ が作られる
npm run ios:add

# 3) 同期（既定で https://yaorozu-quest.vercel.app を読み込む）
npm run ios:sync
#   別URLにする場合のみ:
#   CAP_SERVER_URL="https://staging.example.com" npm run ios:sync

# 4) Xcode で開く → 署名(Team)設定 → 実機/シミュレータで Run、Archive で .ipa
npm run ios:open
```

### 補足

- `CAP_SERVER_URL` を変えたら再度 `ios:sync` を実行してください。
- ローカルの dev サーバー（`http://`）を実機から読む場合は `cleartext` が自動で有効になりますが、
  本番は必ず HTTPS を使用してください。
- カメラ（AR・写真投稿）・位置情報を使うため、Xcode の **Info.plist** に利用目的の文言を追加します:
  - `NSCameraUsageDescription`（例: 「AR撮影・写真の奉納にカメラを使用します」）
  - `NSLocationWhenInUseUsageDescription`（例: 「近くの神社・スポットの探索に位置情報を使用します」）
  - `NSPhotoLibraryAddUsageDescription`（撮影画像の保存用、必要に応じて）
- 純ネイティブのカメラ/位置情報/共有が必要になれば `@capacitor/camera`・`@capacitor/geolocation`・
  `@capacitor/share` を追加して Web 実装から差し替え可能です（現状は Web API で動作）。

---

## どちらを使う？

| | PWA | Capacitor |
| --- | --- | --- |
| 配布 | URL / ホーム画面に追加 | App Store / TestFlight |
| 必要環境 | なし（ブラウザのみ） | Mac + Xcode + Developer 登録 |
| 審査 | 不要 | 必要 |
| ネイティブ機能 | Web API の範囲 | プラグインで拡張可 |

まずは **PWA** で素早く配布し、ストア配信が必要になった段階で **Capacitor** に進むのが推奨です。
