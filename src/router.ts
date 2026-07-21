export type Route =
  | { name: 'hub' }
  | { name: 'today' }
  | { name: 'pack'; packId: string }
  | { name: 'concept'; packId: string; conceptId: string }
  | { name: 'session'; packId: string; sessionId: string }
  | { name: 'notfound' }

export function parseHash(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  const parts = raw.split('/').filter(Boolean)
  if (parts.length === 0) return { name: 'hub' }
  if (parts[0] === 'today') return { name: 'today' }
  if (parts[0] === 'pack' && parts[1]) {
    if (parts[2] === 'concept' && parts[3]) {
      return { name: 'concept', packId: parts[1], conceptId: parts[3] }
    }
    if (parts[2] === 'session' && parts[3]) {
      return { name: 'session', packId: parts[1], sessionId: parts[3] }
    }
    return { name: 'pack', packId: parts[1] }
  }
  return { name: 'notfound' }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'hub':
      return '#/'
    case 'today':
      return '#/today'
    case 'pack':
      return `#/pack/${route.packId}`
    case 'concept':
      return `#/pack/${route.packId}/concept/${route.conceptId}`
    case 'session':
      return `#/pack/${route.packId}/session/${route.sessionId}`
    case 'notfound':
      return '#/'
  }
}

export function navigate(route: Route): void {
  location.hash = href(route).slice(1)
}

export function onRoute(handler: (route: Route) => void): () => void {
  const run = () => handler(parseHash())
  window.addEventListener('hashchange', run)
  run()
  return () => window.removeEventListener('hashchange', run)
}
