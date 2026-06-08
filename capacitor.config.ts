import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 設定。
 *
 * このアプリは Next.js の API ルート（/api/chat, /api/persist, /api/generate-quest）に
 * 依存しており静的エクスポートできないため、ネイティブ殻は「ホスト済みの Web アプリ」を
 * WKWebView で読み込む方式を採る（推奨）。
 *
 *   CAP_SERVER_URL=https://<your-deployed-site> npx cap sync ios
 *
 * CAP_SERVER_URL を未指定の場合は webDir(cap-www) のローカル読み込み画面が使われる。
 * 詳細は docs/IOS.md を参照。
 */
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'biz.mailkaseijin.yaorozuquest',
  appName: '八百万クエスト',
  webDir: 'cap-www',
  ios: {
    contentInset: 'always',
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith('http://'),
        },
      }
    : {}),
};

export default config;
