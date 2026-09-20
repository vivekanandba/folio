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
  }
  private sync(): void {
    this.owner.attributes.set('class', this.value)
  }
}

export class StubNode {
  parentNode: StubElement | null = null
  childNodes: StubNode[] = []
  get textContent(): string {
    return this.childNodes.map((c) => c.textContent).join('')
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
  style: Record<string, string> = {}
  dataset: Record<string, string> = {}
  private listeners = new Map<string, ((ev: unknown) => void)[]>()
  /** Set directly by callers that assign innerHTML; not parsed. */
  rawHtml = ''

  tagName: string
  constructor(tagName: string) {
    super()
    this.tagName = tagName
  }

  get className(): string {
    return this.classList.value
  }
  set className(v: string) {
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
  closest(sel: string): StubElement | null {
    let cur: StubElement | null = this
    while (cur) {
      if (cur.matches(sel)) return cur
      cur = cur.parentNode
    }
    return null
  }
  matches(sel: string): boolean {
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1))
    if (sel.startsWith('#')) return this.id === sel.slice(1)
    return this.tagName.toLowerCase() === sel.toLowerCase()
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
}

class StubDocument extends StubElement {
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
    g.requestAnimationFrame = (fn: (t: number) => void): number => {
      // Run on the macrotask queue so animation code doesn't recurse forever.
      setTimeout(() => fn(0), 0)
      return 0
    }
    g.cancelAnimationFrame = (): void => {}
    g.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })
    g.getComputedStyle = () => ({ getPropertyValue: () => '' })
    g.window = {
      document: stubDocument,
      localStorage: g.localStorage,
      location: { hash: '', pathname: '/', href: 'http://localhost/', search: '' },
      matchMedia: g.matchMedia,
      requestAnimationFrame: g.requestAnimationFrame,
      cancelAnimationFrame: g.cancelAnimationFrame,
      addEventListener: () => {},
      removeEventListener: () => {},
      scrollTo: () => {},
      innerWidth: 1280,
      innerHeight: 800,
      devicePixelRatio: 1,
      getComputedStyle: g.getComputedStyle,
    }
    // Node 22 defines `navigator` as a getter-only global, so plain assignment
    // throws — redefine it instead.
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'node-dom-stub', serviceWorker: undefined, maxTouchPoints: 0 },
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
    },
  }
}
