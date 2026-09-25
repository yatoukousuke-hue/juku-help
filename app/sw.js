// ホーム画面追加（PWA）のための最小限の Service Worker。
// キャッシュはしない（更新したファイルがすぐ反映されるように、常にネットワークから取得）。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
