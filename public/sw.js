// 八百万クエスト Service Worker — PWA インストール対応 ＋ プッシュ通知
// キャッシュは行わない（Next の配信に委ね、古いアプリシェルを掴まないため）。

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// インストール可能性の判定を満たすための fetch ハンドラ（パススルー）
self.addEventListener('fetch', () => { /* ネットワークに委ねる */ });

// サーバープッシュ（Web Push）受信 → 通知を表示
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data && event.data.text() }; }
  const title = data.title || '八百万クエスト';
  const options = {
    body: data.body || '新しいクエストが現れました。',
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知タップ → アプリを前面に
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
