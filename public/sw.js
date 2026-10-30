/* Folio service worker — the pocket museum.
 *
 * Hand-written (no deps). Strategy:
 *  - navigations: network-first (fresh deploys win), cache fallback offline
 *  - everything else same-origin GET: stale-while-revalidate
 * After one online visit, the whole museum — shell, packs, machines — works
 * on a plane.
 *
 * VERSION is rewritten at build time by tools/stamp-sw.mjs with a digest of
 * the built tree, so `activate` drops every older cache on each deploy. The
 * placeholder below is what that script looks for — if you rename it, the
 * build fails loudly rather than shipping a worker that never cleans up.
 */

const VERSION = 'folio-sw-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return // fonts etc. stay browser-managed

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION)
        try {
          const fresh = await fetch(request)
          if (fresh.ok) cache.put(request, fresh.clone()) // never replay an error page offline
          return fresh
        } catch {
          const hit = (await cache.match(request)) ?? (await cache.match(self.registration.scope))
          return hit ?? Response.error()
        }
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION)
      const hit = await cache.match(request)
      const refresh = fetch(request)
        .then((fresh) => {
          if (fresh.ok) cache.put(request, fresh.clone())
          return fresh
        })
        .catch(() => undefined)
      return hit ?? (await refresh) ?? Response.error()
    })(),
  )
})
