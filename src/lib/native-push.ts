// Capacitor ネイティブ(iOS)アプリ内での APNs 購読。
// アプリはリモートURL(server.url)を WKWebView で読み込むため、この Web コードが
// Capacitor ブリッジ越しに @capacitor/push-notifications プラグインを呼ぶ。
// 通常ブラウザ／PWA では何もしない（従来の Web Push が使われる）。
import { Capacitor } from '@capacitor/core';

export function isNativePush(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

let listenersReady = false;

/** 通知タップ時の遷移など、グローバルなリスナーを一度だけ設定する。 */
async function ensureListeners(): Promise<void> {
  if (listenersReady || !isNativePush()) return;
  listenersReady = true;
  const { PushNotifications } = await import('@capacitor/push-notifications');

  // 通知をタップしてアプリを開いたとき、payload の url へ遷移する。
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = (action.notification?.data as { url?: string } | undefined)?.url;
    if (url && typeof window !== 'undefined') {
      try { window.location.assign(url); } catch { /* ignore */ }
    }
  });
}

/** この端末を APNs に登録し、デバイストークンをサーバへ保存する。 */
export async function subscribeNativePush(): Promise<'subscribed' | 'denied' | 'error' | 'unsupported'> {
  if (!isNativePush()) return 'unsupported';
  const { PushNotifications } = await import('@capacitor/push-notifications');

  await ensureListeners();

  // 権限の確認・要求（ユーザー操作のハンドラ内から呼ぶこと）。
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return 'denied';

  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: 'subscribed' | 'denied' | 'error') => {
      if (settled) return;
      settled = true;
      regHandle?.remove();
      errHandle?.remove();
      resolve(r);
    };

    let regHandle: { remove: () => void } | undefined;
    let errHandle: { remove: () => void } | undefined;

    PushNotifications.addListener('registration', async (token) => {
      try {
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: 'ios', token: token.value }),
        });
        finish(res.ok ? 'subscribed' : 'error');
      } catch {
        finish('error');
      }
    }).then((h) => { regHandle = h; });

    PushNotifications.addListener('registrationError', () => finish('error'))
      .then((h) => { errHandle = h; });

    // APNs 登録を開始（成功時に 'registration' イベントでトークンが返る）。
    PushNotifications.register().catch(() => finish('error'));

    // 応答が無い場合の保険。
    setTimeout(() => finish('error'), 15000);
  });
}
