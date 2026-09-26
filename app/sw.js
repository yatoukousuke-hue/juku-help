// ホーム画面追加（PWA）のための最小限の Service Worker。
// キャッシュはしない（更新したファイルがすぐ反映されるように、常にネットワークから取得）。
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
// 講師画面の通知をタップしたら講師画面を前面に出す
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const w = list.find((c) => c.url.includes('teacher.html'));
    if (w) return w.focus();
    return self.clients.openWindow('./teacher.html');
  }));
});
