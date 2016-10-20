const VERSION = 'v1';

self.addEventListener('install', event =>
  event.waitUntil(
    caches.open(`static-${VERSION}`)
      .then(cache => cache.putAll([
        '{{addHash "/static/header.partial.html"}}',
        '{{addHash "/static/footer.partial.html"}}',
        '{{addHash "/static/images/spinner.png"}}',
        '{{addHash "/static/app.js"}}',
        '{{addHash "/static/sc-router.js"}}',
        '{{addHash "/static/sc-view.js"}}',
        '{{addHash "/static/superstyles.css"}}'
      ]))
  )
);

self.addEventListener('fetch', event => {
  switch (event.request.path) {
  }
  event.respondWith(
    caches.match(evt.request)
      .then(response =>
  )
});