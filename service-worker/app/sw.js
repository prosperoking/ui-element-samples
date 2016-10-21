const VERSION = 'v1';

self.addEventListener('install', event =>
  event.waitUntil(
    caches.open(`static-${VERSION}`)
      .then(cache => cache.addAll([
        '/header.partial.html',
        '/footer.partial.html',
        '{{addHash "/static/images/spinner.png"}}',
        '{{addHash "/static/app.js"}}',
        '{{addHash "/static/sc-router.js"}}',
        '{{addHash "/static/sc-view.js"}}',
        '{{addHash "/static/superstyles.css"}}'
      ]))
      .then(_ => self.skipWaiting())
  )
);

self.addEventListener('activate', event =>
  event.waitUntil(self.clients.claim())
);

self.addEventListener('fetch', event => {
  if (event.request.path.startsWith('/static')) {
    return staticFetchHandler(event);
  }
  return event.respondWith(fetch(event.request));
});

// Implements stale-while-revalidate
function staticFetchHandler (event) {
  const fetched = fetch(event.request);
  const cached = caches.match(event.request);
  // Call respondWith() ASAP
  event.respondWith(Promise.race([
    fetched.then(resp => resp || cached),
    cached
  ]));

  // Update the cache with the version we fetched
  event.waitUntil(
    Promise.all([fetched, caches.open(`static-${VERSION}`)])
      .then(([response, cache]) => cache.put(event.request, response))
  );
}
