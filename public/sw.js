// 八百万クエスト — minimal, conservative service worker.
// 目的: PWA インストール可能化 + オフライン時の最低限のフォールバック。
// 方針:
//  - /api/* と非GETは一切キャッシュしない（常にネットワーク）。
//  - /_next/static/* などハッシュ付き不変アセットは cache-first。
//  - ページ遷移(navigate)は network-first、失敗時にオフラインフォールバック。
const VERSION = 'yaorozu-v1';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // クロスオリジンはそのまま
  if (url.pathname.startsWith('/api/')) return;     // APIは常にネットワーク

  // ハッシュ付き不変アセット: cache-first
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          return res;
        })
      )
    );
    return;
  }

  // ページ遷移: network-first, 失敗時はオフラインフォールバック
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }
});
