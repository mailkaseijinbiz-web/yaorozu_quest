// 通知ヘルパー（PWA）。新しいクエストが追加されたときなどに端末通知を出す。
// サーバープッシュ（オフライン配信）には別途 VAPID 鍵と送信エンドポイントが必要。
// ここではアプリ起動中／インストール済みでの「ローカル通知」を担う（iOS 16.4+ の PWA も対応）。

/** 通知許可を確認・要求する（ユーザー操作のハンドラ内から呼ぶこと）。許可されたら true。 */
export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch {
    return false;
  }
}

/** 新しいクエストの通知を出す（許可済みのときのみ）。Service Worker 経由を優先。 */
export async function notifyNewQuest(title: string, body: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url: '/' } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, options); return; }
  } catch {
    /* fall through to direct Notification */
  }
  try { new Notification(title, options); } catch { /* 非対応環境は無視 */ }
}
