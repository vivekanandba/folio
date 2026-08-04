/* Folio service worker — the pocket museum.
 *
 * Hand-written (no deps). Strategy:
 *  - navigations: network-first (fresh deploys win), cache fallback offline
 *  - everything else same-origin GET: stale-while-revalidate
 * After one online visit, the whole museum — shell, packs, machines — works
 * on a plane. Bump VERSION to drop old caches on activate.
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
