import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor 設定。
 *
 * このアプリは Next.js の API ルート（/api/chat, /api/persist, /api/generate-quest）に
 * 依存しており静的エクスポートできないため、ネイティブ殻は「ホスト済みの Web アプリ」を
 * WKWebView で読み込む方式を採る（推奨）。
 *
 * 既定では本番URL（Vercel）を読み込む。別URL（ステージング/ローカル等）を使う場合のみ
 * CAP_SERVER_URL で上書きする:
 *
 *   CAP_SERVER_URL=https://staging.example.com npx cap sync ios
 *
 * 詳細は docs/IOS.md を参照。
 */
const serverUrl = process.env.CAP_SERVER_URL ?? 'https://yaorozu-quest.vercel.app';

const config: CapacitorConfig = {
  appId: 'biz.mailkaseijin.yaorozuquest',
  appName: '八百万クエスト',
  webDir: 'cap-www',
  ios: {
    contentInset: 'always',
  },
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
