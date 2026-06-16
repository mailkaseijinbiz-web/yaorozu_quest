// クライアント側：この端末を Web Push に購読する。
// 公開鍵は NEXT_PUBLIC_VAPID_PUBLIC_KEY（無ければ /api/push/subscribe の GET から取得）。

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type SubscribeResult = 'subscribed' | 'denied' | 'unsupported' | 'unconfigured' | 'error';

/** この端末の通知許可状態。'granted'＝許可済み（購読ボタンを出す必要なし）。 */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function subscribePush(): Promise<SubscribeResult> {
  // ネイティブ(iOS Capacitor)アプリ内では Web Push が使えないため APNs を使う。
  if (typeof window !== 'undefined') {
    try {
      const { isNativePush, subscribeNativePush } = await import('./native-push');
      if (isNativePush()) return await subscribeNativePush();
    } catch { /* プラグイン未解決などは Web Push へフォールバック */ }
  }
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  // 公開鍵を解決（env → サーバ）
  let key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
  if (!key) {
    try {
      const r = await fetch('/api/push/subscribe');
      const j = await r.json();
      key = j?.publicKey || '';
    } catch { /* ignore */ }
  }
  if (!key) return 'unconfigured';

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
    });
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok ? 'subscribed' : 'error';
  } catch {
    return 'error';
  }
}
