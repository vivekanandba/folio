// A minimal DOM, hand-written.
//
// Article I forbids dependencies and the dev box is offline, so jsdom is not
// an option — `npm install` is a no-op here. This stub exists so modules that
// render can be IMPORTED and their logic exercised under `node:test`, which is
// what lets the whole of src/ enter the coverage denominator instead of only
// the five files the pure-logic tests happened to touch.
//
// It is deliberately small and honest: it models the subset the app actually
// uses (create, attribute, class, append, query, events). It is NOT a browser.
// Anything depending on layout, painting, or GPU belongs in the real-browser
// e2e suite, not here.

class StubClassList {
  private set = new Set<string>()
  private owner: StubElement
  // Parameter properties are unsupported in Node's strip-only TS mode.
  constructor(owner: StubElement) {
    this.owner = owner
  }
  add(...names: string[]): void {
    for (const n of names) if (n) this.set.add(n)
    this.sync()
  }
  remove(...names: string[]): void {
    for (const n of names) this.set.delete(n)
    this.sync()
  }
  toggle(name: string, force?: boolean): boolean {
    const on = force ?? !this.set.has(name)
    if (on) this.set.add(name)
    else this.set.delete(name)
    this.sync()
    return on
  }
  contains(name: string): boolean {
    return this.set.has(name)
  }
  get value(): string {
    return [...this.set].join(' ')
  }
  replaceAll(value: string): void {
    this.set = new Set(value.split(/\s+/).filter(Boolean))
    // sync() like every other mutator. This was the ONE that skipped it,
    // invisible while className read from the token set and exposed the
    // moment className became the attribute: `c.className = 'a'` then
    // `c.classList.replaceAll('zz')` left className "a", `.zz` matching,
    // `[class="zz"]` not matching and outerHTML saying class="a" — the same
    // "one element answers three contradictory things" the removeAttribute
    // comment above claims is now impossible. Both callers happened to be
    // safe (the className setter writes the attribute itself, and
    // removeAttribute has already deleted it), which is exactly why it
    // would have come back silently.
    this.sync()
  }
  private sync(): void {
    // The DOM's own rule, which is narrower than either thing this has been
    // before. DOMTokenList's update steps say: if the element has no class
    // attribute AND the token set is empty, do nothing; otherwise write the
    // serialised set.
    //
    // So `classList.remove('x')` on an element that never had a class does
    // NOT create one — the false positive that made `[class]` match every
    // element something had ever called remove() on. But an explicit
    // `setAttribute('class', '')` DOES leave the attribute present, and
    // `[class]` matches it, exactly as in a browser. An earlier fix deleted
    // the attribute whenever the set was empty, which cured the first case
    // by breaking the second — and contradicted this file's own rule, forty
    // lines below, that a presence test matches an attribute written as ''.
    if (!this.owner.attributes.has('class') && this.set.size === 0) return
    this.owner.attributes.set('class', this.value)
  }
}

/** `dataset.someKey` ⇄ `data-some-key`, the DOM's own mapping. */
function kebab(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

/** The inverse, for enumerating `dataset` back out of the attributes map. */
function camel(attr: string): string {
  return attr.slice('data-'.length).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

/**
 * Split a selector LIST on its top-level commas only.
 *
 * `sel.split(',')` cut `[title="a, b"]` in half, and both halves then failed
 * the compound parse — so the whole selector quietly matched nothing. In a
 * matcher whose stated contract is that it refuses loudly what it cannot do,
 * that is the same failing-invisibly category as the single-quoted attribute
 * value: the caller gets `false` and no indication the selector was never
 * understood.
 */
function splitSelectorList(sel: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i]
    if (c === '[') depth += 1
    else if (c === ']') depth -= 1
    else if (c === ',' && depth === 0) {
      parts.push(sel.slice(start, i))
      start = i + 1
    }
  }
  parts.push(sel.slice(start))
  return parts
}

export class StubNode {
  parentNode: StubElement | null = null
  childNodes: StubNode[] = []
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('')
  }
  /**
   * Whether this node is still attached to the document. Real code asks:
   * fx.ts checks it before firing a burst at a stamp that may have been
   * replaced, and the session page checks it before singing to a learner who
   * has navigated away. Returning `undefined` made every such guard look
   * false, so those paths were never exercised here.
   */
  get isConnected(): boolean {
    let node: StubNode | null = this
    while (node) {
      if (node === stubDocument.body || node === stubDocument.documentElement) return true
      node = node.parentNode
    }
    return false
  }
}

export class StubText extends StubNode {
  data: string
  constructor(data: string) {
    super()
    this.data = data
  }
  override get textContent(): string {
    return this.data
  }
}

export class StubElement extends StubNode {
  attributes = new Map<string, string>()
  classList = new StubClassList(this)
  /** Both spellings the app uses: `style.foo = x` and `style.setProperty(...)`. */
  style: Record<string, unknown> = {
    setProperty(this: Record<string, unknown>, name: string, value: string) {
      this[name] = value
    },
    getPropertyValue(this: Record<string, unknown>, name: string) {
      return (this[name] as string) ?? ''
    },
    removeProperty(this: Record<string, unknown>, name: string) {
      delete this[name]
    },
  }
  /**
   * A live view over the `data-*` attributes, not a detached bag.
   *
   * It used to be a plain object with no link to `attributes`, so
   * `el.dataset.uid = '3'` left `[data-uid="3"]` matching nothing — the exact
   * silent-null failure that kept blueprint.ts's wiring untestable and that
   * the attribute matcher was taught selectors to fix. src/ writes
   * `el({'data-uid': …})` today, so nothing hit it; a refactor to `dataset`
   * would have restored the vacuum with no test turning red, which is the
   * worst way for a gap to come back.
   */
  dataset: Record<string, string> = new Proxy({} as Record<string, string>, {
    // Symbols are passed through to the target instead of being kebab-cased.
    // `${el.dataset}` and any other symbol-keyed access (Symbol.toPrimitive,
    // Symbol.toStringTag, util.inspect) reach these traps too, and a bare
    // key.replace() threw "key.replace is not a function" — an error naming
    // nothing a reader could act on, from a stub whose job is to make test
    // failures legible.
    get: (t, key) => {
      if (typeof key === 'symbol') return (t as Record<symbol, unknown>)[key]
      const name = `data-${kebab(key)}`
      if (this.attributes.has(name)) return this.attributes.get(name)
      // Fall through to the target for anything that is not a data-*
      // attribute, so the object still behaves like an object. Returning
      // attributes.get() unconditionally meant `toString` and `valueOf`
      // resolved to undefined, and `\`${el.dataset}\`` died with "Cannot
      // convert object to primitive value" — where a browser says
      // "[object DOMStringMap]". Unknown data keys still read undefined,
      // because the target is empty.
      return (t as Record<string, unknown>)[key]
    },
    set: (t, key, value) => {
      if (typeof key === 'symbol') (t as Record<symbol, unknown>)[key] = value
      else this.attributes.set(`data-${kebab(key)}`, String(value))
      return true
    },
    deleteProperty: (t, key) => {
      if (typeof key === 'symbol') delete (t as Record<symbol, unknown>)[key]
      else this.attributes.delete(`data-${kebab(key)}`)
      return true
    },
    has: (t, key) =>
      typeof key === 'symbol' ? key in t : this.attributes.has(`data-${kebab(key)}`),
    // ENUMERATION, so Object.keys(el.dataset), {...el.dataset} and for…in
    // see the data-* attributes. Without these two traps they all returned
    // nothing — which is the same silent vacuum the Proxy was added to
    // close, just reached by a different access path. ownKeys alone is not
    // enough: Object.keys filters on enumerability, so a descriptor has to
    // come back for each key too.
    ownKeys: () => [...this.attributes.keys()].filter((k) => k.startsWith('data-')).map(camel),
    getOwnPropertyDescriptor: (_t, key) => {
      if (typeof key === 'symbol') return undefined
      const name = `data-${kebab(key)}`
      if (!this.attributes.has(name)) return undefined
      return { value: this.attributes.get(name), enumerable: true, configurable: true, writable: true }
    },
  })
  private listeners = new Map<string, ((ev: unknown) => void)[]>()
  /** Set directly by callers that assign innerHTML; not parsed. */
  rawHtml = ''

  tagName: string
  constructor(tagName: string) {
    super()
    this.tagName = tagName
  }

  get className(): string {
    // The ATTRIBUTE, raw — not the normalised token set. In the DOM,
    // className, getAttribute('class') and classList.value all return the
    // attribute value verbatim, so `setAttribute('class', '  a  b ')` leaves
    // all three reading '  a  b '. Returning the serialised set here made
    // className and getAttribute('class') disagree for any value with
    // irregular spacing, and matches() then answered `[class="a b"]` through
    // whichever of them it happened to consult.
    return this.attributes.get('class') ?? ''
  }
  set className(v: string) {
    // Assigning className ALWAYS sets the attribute, including to '', which
    // is why this writes directly rather than leaning on replaceAll's
    // sync(): sync() declines to create an attribute for an empty token set,
    // and that is right for classList.remove() but wrong for an explicit
    // assignment. Order matters — replaceAll syncs first, then the raw value
    // lands, so the attribute keeps the spacing the caller wrote.
    this.classList.replaceAll(v)
    this.attributes.set('class', v)
  }
  get id(): string {
    return this.attributes.get('id') ?? ''
  }
  set id(v: string) {
    this.attributes.set('id', v)
  }
  get innerHTML(): string {
    return this.rawHtml || this.childNodes.map((c) => (c instanceof StubElement ? c.outerHTML : c.textContent)).join('')
  }
  set innerHTML(v: string) {
    this.rawHtml = v
    this.childNodes = []
  }
  override get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('')
  }
  set textContent(v: string) {
    this.childNodes = [new StubText(v)]
    this.rawHtml = ''
  }
  get outerHTML(): string {
    const attrs = [...this.attributes].map(([k, v]) => ` ${k}="${v}"`).join('')
    return `<${this.tagName}${attrs}>${this.innerHTML}</${this.tagName}>`
  }
  get children(): StubElement[] {
    return this.childNodes.filter((c): c is StubElement => c instanceof StubElement)
  }
  get firstChild(): StubNode | null {
    return this.childNodes[0] ?? null
  }

  setAttribute(k: string, v: string): void {
    if (k === 'class') this.className = v
    else this.attributes.set(k, v)
  }
  getAttribute(k: string): string | null {
    return this.attributes.get(k) ?? null
  }
  hasAttribute(k: string): boolean {
    return this.attributes.has(k)
  }
  removeAttribute(k: string): void {
    this.attributes.delete(k)
    // …and the token set with it. Leaving classList populated made one
    // element answer three contradictory things at once: `[class]` false
    // (the map was consulted), `[class="foo"]` true and `.foo` true (the
    // token set was), and the next classList.add() resurrected the removed
    // name back into the attribute.
    if (k === 'class') this.classList.replaceAll('')
  }

  append(...nodes: (StubNode | string)[]): void {
    for (const n of nodes) {
      const node = typeof n === 'string' ? new StubText(n) : n
      if (node instanceof StubElement) node.parentNode = this
      this.childNodes.push(node)
    }
    this.rawHtml = ''
  }
  appendChild<T extends StubNode>(node: T): T {
    this.append(node)
    return node
  }
  replaceChildren(...nodes: (StubNode | string)[]): void {
    this.childNodes = []
    this.rawHtml = ''
    this.append(...nodes)
  }
  remove(): void {
    const p = this.parentNode
    if (!p) return
    p.childNodes = p.childNodes.filter((c) => c !== this)
    this.parentNode = null
  }
  replaceWith(...nodes: (StubNode | string)[]): void {
    const p = this.parentNode
    if (!p) return
    const at = p.childNodes.indexOf(this)
    const built = nodes.map((n) => (typeof n === 'string' ? new StubText(n) : n))
    for (const n of built) if (n instanceof StubElement) n.parentNode = p
    p.childNodes.splice(at, 1, ...built)
    this.parentNode = null
  }
  closest(sel: string): StubElement | null {
    let cur: StubElement | null = this
    while (cur) {
      if (cur.matches(sel)) return cur
      cur = cur.parentNode
    }
    return null
  }
  /** Supports `.class`, `#id`, `tag`, and comma-separated lists of those. */
  /**
   * A COMPOUND selector matcher: tag, #id, .class, [attr] and [attr="value"],
   * in any combination, plus comma lists. Still no combinators — descendant
   * and child selectors stay the browser suite's job.
   *
   * Attribute selectors were the missing piece for src/sessions/blueprint.ts,
   * which finds its wire endpoints with `[data-uid="…"]`: without them those
   * queries returned null, the loop around them did nothing, and an
   * interaction that was merely UNSUPPORTED looked untestable.
   *
   * NOT classify. Its drop target is `[data-bucket="…"] .bucket-drop`, a
   * DESCENDANT selector, which this matcher still refuses — so classify's
   * drop path remains browser-only. An earlier version of this comment
   * claimed otherwise, which would have had the next reader assume a
   * coverage gap was closed when it was not (CON-DATA-001).
   */
  matches(sel: string): boolean {
    return splitSelectorList(sel).some((part) => {
      const s = part.trim()
      if (!s) return false
      // Split a compound into its pieces: `button.foo[data-x="1"]#id`.
      const pieces = s.match(/(^[a-zA-Z][\w-]*)|(\.[\w-]+)|(#[\w-]+)|(\[[^\]]+\])/g)
      if (!pieces || pieces.join('') !== s) return false
      return pieces.every((piece) => {
        if (piece.startsWith('.')) return this.classList.contains(piece.slice(1))
        if (piece.startsWith('#')) return this.id === piece.slice(1)
        if (piece.startsWith('[')) {
          // Quoting: ", ' or none. The earlier form stripped only double
          // quotes, so `[data-uid='u1']` captured `'u1'` WITH the quotes and
          // silently never matched — a matcher whose stated contract is that
          // it refuses what it cannot do, failing invisibly instead. Single
          // quotes are valid CSS and the two forms must agree.
          const m = /^\[([\w-]+)(?:(=)(?:"([^"]*)"|'([^']*)'|([^'"\]]*)))?\]$/.exec(piece)
          // Only presence and exact `=`. An earlier version accepted
          // ~= |= ^= $= *= and collapsed all five to `includes`, which FAILS
          // OPEN: [href^="/a"] would have matched "/b/a". A matcher that
          // approximates is worse than one that refuses, because the wrong
          // match is a green test on a false premise.
          if (!m) return false
          // `class` is read off classList, which is the live value; the
          // attributes map is kept in step by sync() and the className
          // setter, so this is belt-and-braces rather than a fix for a stale
          // entry. Two earlier comments here each gave a WRONG reason for it
          // — that setAttribute diverts class and id away from the map, then
          // that classList.add leaves the map stale — and neither is true
          // (CON-DATA-001). `id` needs nothing special.
          const name = m[1]
          // Presence asks hasAttribute, because className is '' (not null) on
          // an element that never had a class — so `[class]` would otherwise
          // match EVERY element, where CSS matches only those carrying the
          // attribute.
          if (!m[2]) return this.hasAttribute(name)
          // No special case for `class` any more: className IS the attribute
          // now, so consulting one or the other cannot give two answers.
          const actual = this.getAttribute(name)
          // Presence matches an EMPTY value, the way CSS does: an attribute
          // written as `data-x=""` is present. Note that properties set
          // directly on a stub element — `el.hidden = true`, `dialog.open` —
          // never reach the attributes map at all, so `[hidden]` and `[open]`
          // match nothing here however they are written.
          if (actual == null) return false
          // Exactly one of the three value groups is set, by construction.
          return actual === (m[3] ?? m[4] ?? m[5])
        }
        return this.tagName.toLowerCase() === piece.toLowerCase()
      })
    })
  }
  /** Depth-first descendants, self excluded. */
  private descendants(): StubElement[] {
    const out: StubElement[] = []
    const walk = (n: StubNode): void => {
      for (const c of n.childNodes) {
        if (c instanceof StubElement) {
          out.push(c)
          walk(c)
        }
      }
    }
    walk(this)
    return out
  }
  querySelector(sel: string): StubElement | null {
    return this.descendants().find((e) => e.matches(sel)) ?? null
  }
  querySelectorAll(sel: string): StubElement[] {
    return this.descendants().filter((e) => e.matches(sel))
  }

  addEventListener(type: string, fn: (ev: unknown) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(fn)
    this.listeners.set(type, list)
  }
  removeEventListener(type: string, fn: (ev: unknown) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn))
  }
  /** Fires listeners on this node, then bubbles to ancestors. */
  dispatchEvent(ev: { type: string; target?: StubElement; [k: string]: unknown }): boolean {
    ev.target ??= this
    for (const fn of this.listeners.get(ev.type) ?? []) fn(ev)
    if (this.parentNode) this.parentNode.dispatchEvent(ev)
    return true
  }
  /** Convenience used by tests: synthesise a click on this element. */
  click(): void {
    this.dispatchEvent({ type: 'click', target: this })
  }
  focus(): void {
    stubDocument.activeElement = this
  }
  getBoundingClientRect(): Record<string, number> {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  }
  scrollIntoView(): void {}
  /** Pointer capture: the floor canvas claims the pointer while panning. */
  setPointerCapture(): void {}
  releasePointerCapture(): void {}
  hasPointerCapture(): boolean {
    return false
  }

  /** <dialog>: the command palette opens modally, so model open/close state. */
  open = false
  showModal(): void {
    this.open = true
  }
  show(): void {
    this.open = true
  }
  close(): void {
    this.open = false
    this.dispatchEvent({ type: 'close', target: this })
  }

  /**
   * Canvas support, deliberately shallow: a 2D context whose every method is a
   * no-op, so drawing code RUNS (and its arithmetic is exercised) without
   * pretending anything was painted. WebGL returns null on purpose — that is
   * the real-world no-GPU case, and it exercises the fallback path rather than
   * faking a renderer. Whether pixels are correct is a question for the
   * browser e2e suite; this only proves the code path doesn't explode.
   */
  getContext(kind: string): unknown {
    if (kind !== '2d') return null
    const canvas = this
    const noop = (): void => {}
    const target: Record<string, unknown> = {
      canvas,
      measureText: (t: string) => ({ width: String(t).length * 6 }),
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop }),
      createPattern: () => null,
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(Math.max(1, w) * Math.max(1, h) * 4),
        width: w,
        height: h,
      }),
    }
    return new Proxy(target, {
      get(obj, prop: string) {
        if (prop in obj) return obj[prop]
        // Unknown members: callable no-op, so any drawing API is tolerated.
        return noop
      },
      set(obj, prop: string, value) {
        obj[prop] = value
        return true
      },
    })
  }
}

class StubDocument extends StubElement {
  /** Settable, so a test can be a backgrounded tab. */
  hidden = false
  documentElement = new StubElement('html')
  body = new StubElement('body')
  head = new StubElement('head')
  activeElement: StubElement | null = null
  constructor() {
    super('#document')
    this.append(this.documentElement)
    this.documentElement.append(this.head, this.body)
  }
  createElement(tag: string): StubElement {
    return new StubElement(tag)
  }
  /** SVG elements (blueprint board, icons) go through the namespaced form. */
  createElementNS(_ns: string, tag: string): StubElement {
    return new StubElement(tag)
  }
  createTextNode(data: string): StubText {
    return new StubText(data)
  }
  createDocumentFragment(): StubElement {
    return new StubElement('#fragment')
  }
  getElementById(id: string): StubElement | null {
    return this.body.querySelector(`#${id}`)
  }
  override querySelector(sel: string): StubElement | null {
    return this.documentElement.matches(sel) ? this.documentElement : this.documentElement.querySelector(sel)
  }
  override querySelectorAll(sel: string): StubElement[] {
    return this.documentElement.querySelectorAll(sel)
  }
}

const stubDocument = new StubDocument()

class StubStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string): void {
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null
  }
  get length(): number {
    return this.map.size
  }
}

/**
 * Install the stub as globals, once. Returns a reset() for tests that want a
 * clean document between cases.
 */
export function installDomStub(): { document: StubDocument; reset: () => void } {
  const g = globalThis as Record<string, unknown>
  if (!g.document) {
    g.document = stubDocument
    g.HTMLElement = StubElement
    g.Element = StubElement
    g.Node = StubNode
    g.localStorage = new StubStorage()
    g.sessionStorage = new StubStorage()
    // Animation frames: bounded, and never a reason for the process to stay
    // alive. Mounting a lab or a sim starts a render loop that re-requests a
    // frame forever; under an unbounded stub that loop pinned the test runner
    // until it was killed (observed: session-mount never exited). A few frames
    // let first-paint logic run; the timer is unref'd so the loop can never
    // hold the runner open. Sustained animation belongs to the browser suite.
    let frames = 0
    const FRAME_BUDGET = 3
    // The budget is MODULE-level and shared by every test in a file, so one
    // test that needs three frames leaves none for the next — and a test that
    // never gets a frame passes vacuously while appearing to exercise an
    // animation. Reset it per test that cares (CON-VER-008: a suite whose
    // outcome depends on order is a defect in the suite).
    g.__resetFrames = () => { frames = 0 }
    g.requestAnimationFrame = (fn: (t: number) => void): number => {
      if (frames >= FRAME_BUDGET) return 0
      frames += 1
      // performance.now(), NOT a frame counter. The real rAF timestamp shares
      // a clock with performance.now(), and code that measures elapsed time
      // by subtracting one from the other — fx.ts's countUp does — got a
      // huge negative number here and rendered nonsense. A stub that lies
      // about an API's contract tests the lie.
      const id = setTimeout(() => fn(performance.now()), 0)
      if (typeof id === 'object' && id && 'unref' in id) (id as { unref: () => void }).unref()
      return frames
    }
    g.cancelAnimationFrame = (): void => {}
    // Media queries are answered from a mutable map so a test can simulate a
    // desktop mouse (hover/fine pointer) or a reduced-motion preference. With
    // a hard `matches: false`, modules that guard on a media query — tilt.ts
    // does — return immediately and can never be exercised.
    const mediaState: Record<string, boolean> = {}
    g.__setMedia = (query: string, matches: boolean) => { mediaState[query] = matches }
    g.__resetMedia = () => { for (const k of Object.keys(mediaState)) delete mediaState[k] }
    g.matchMedia = (query: string) => ({
      matches: mediaState[query] ?? false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    g.getComputedStyle = () => ({ getPropertyValue: () => '' })
    // Observers: construct and accept calls, never fire. Layout-driven
    // behaviour is the browser suite's job, not this stub's.
    class StubObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): unknown[] {
        return []
      }
    }
    g.ResizeObserver = StubObserver
    g.IntersectionObserver = StubObserver
    g.MutationObserver = StubObserver
    // `location` is real enough to route with: assigning `hash` fires
    // hashchange, which is the contract src/router.ts is written against.
    const windowListeners = new Map<string, ((ev: unknown) => void)[]>()
    const fire = (type: string): void => {
      for (const fn of windowListeners.get(type) ?? []) fn({ type })
    }
    let hash = ''
    const location = {
      pathname: '/',
      href: 'http://localhost/',
      search: '',
      get hash(): string {
        return hash
      },
      set hash(v: string) {
        const next = v.startsWith('#') ? v : `#${v}`
        if (next === hash) return
        hash = next
        fire('hashchange')
      },
    }
    g.location = location
    g.window = {
      document: stubDocument,
      localStorage: g.localStorage,
      location,
      matchMedia: g.matchMedia,
      requestAnimationFrame: g.requestAnimationFrame,
      cancelAnimationFrame: g.cancelAnimationFrame,
      addEventListener: (type: string, fn: (ev: unknown) => void) => {
        windowListeners.set(type, [...(windowListeners.get(type) ?? []), fn])
      },
      removeEventListener: (type: string, fn: (ev: unknown) => void) => {
        windowListeners.set(type, (windowListeners.get(type) ?? []).filter((f) => f !== fn))
      },
      scrollTo: () => {},
      // Timers via window.*, which several session renderers use for feedback
      // pacing. Unref'd so a pending timer can never hold the runner open.
      setTimeout: (fn: () => void, ms?: number) => {
        const id = setTimeout(fn, ms)
        if (typeof id === 'object' && id && 'unref' in id) (id as { unref: () => void }).unref()
        return id
      },
      clearTimeout: (id: unknown) => clearTimeout(id as never),
      setInterval: (fn: () => void, ms?: number) => {
        const id = setInterval(fn, ms)
        if (typeof id === 'object' && id && 'unref' in id) (id as { unref: () => void }).unref()
        return id
      },
      clearInterval: (id: unknown) => clearInterval(id as never),
      innerWidth: 1280,
      innerHeight: 800,
      devicePixelRatio: 1,
      getComputedStyle: g.getComputedStyle,
    }
    g.addEventListener = g.window.addEventListener
    g.removeEventListener = g.window.removeEventListener
    // Web Audio: a RECORDER, not a synthesiser. There is no sound card here
    // and nothing to listen to, so the only honest assertion a headless box
    // can make is *what the app asked for* — which tone, at which pitch, in
    // which order. Each scheduled oscillator lands in __audioLog as
    // { type, freq, startAt, stopAt }, which is exactly enough to prove the
    // scale climbs across a run and drops back after a miss.
    const audioLog: { type: string; freq: number; startAt: number; stopAt: number }[] = []
    g.__audioLog = audioLog
    g.__resetAudio = () => { audioLog.length = 0 }
    class StubParam {
      value = 0
      setValueAtTime(v: number): StubParam { this.value = v; return this }
      linearRampToValueAtTime(v: number): StubParam { this.value = v; return this }
      exponentialRampToValueAtTime(v: number): StubParam { this.value = v; return this }
      cancelScheduledValues(): StubParam { return this }
    }
    class StubAudioNode {
      connect(to: unknown): unknown { return to }
      disconnect(): void {}
    }
    class StubGain extends StubAudioNode {
      gain = new StubParam()
    }
    class StubOscillator extends StubAudioNode {
      type = 'sine'
      frequency = new StubParam()
      private startAt = 0
      start(t = 0): void { this.startAt = t }
      stop(t = 0): void {
        audioLog.push({ type: this.type, freq: this.frequency.value, startAt: this.startAt, stopAt: t })
      }
    }
    class StubAudioContext {
      state = 'running'
      /**
       * A REAL clock, not a frozen 0. With currentTime stuck at zero every
       * note looks like it starts at the same instant, so a test could not
       * tell "the chord waits for the bell" from "both fired together" — the
       * very thing the pacing logic exists to prevent.
       */
      private born = Date.now()
      get currentTime(): number {
        return (Date.now() - this.born) / 1000
      }
      destination = new StubAudioNode()
      createOscillator(): StubOscillator { return new StubOscillator() }
      createGain(): StubGain { return new StubGain() }
      async resume(): Promise<void> { this.state = 'running' }
      async close(): Promise<void> { this.state = 'closed' }
    }
    g.AudioContext = StubAudioContext
    // Node 22 defines `navigator` as a getter-only global, so plain assignment
    // throws — redefine it instead. `vibrate` records rather than buzzes, for
    // the same reason the audio stub does.
    const vibrateLog: (number | number[])[] = []
    g.__vibrateLog = vibrateLog
    g.__resetVibrate = () => { vibrateLog.length = 0 }
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        userAgent: 'node-dom-stub',
        serviceWorker: undefined,
        maxTouchPoints: 0,
        vibrate: (pattern: number | number[]) => { vibrateLog.push(pattern); return true },
      },
      configurable: true,
      writable: true,
    })
  }
  return {
    document: stubDocument,
    reset: () => {
      stubDocument.body.replaceChildren()
      stubDocument.head.replaceChildren()
      stubDocument.activeElement = null
      // Frames too. The budget is module-level, so without this every file
      // that calls reset() still inherits whatever earlier tests spent — and
      // a test that gets no frame passes while appearing to drive an
      // animation. __resetFrames only helped the one file that knew to call
      // it (CON-VER-008: order-dependence is a defect in the suite).
      const reset = (globalThis as Record<string, unknown>).__resetFrames
      if (typeof reset === 'function') (reset as () => void)()
    },
  }
}
