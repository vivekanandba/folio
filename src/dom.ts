export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else if (k === 'html') node.innerHTML = v
    else node.setAttribute(k, v)
  }
  for (const child of children) {
    node.append(typeof child === 'string' ? document.createTextNode(child) : child)
  }
  return node
}

export function clear(node: HTMLElement): void {
  node.replaceChildren()
}

export function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    quiz: 'Quiz',
    classify: 'Classify',
    detective: 'Detective',
    calculator: 'Lab',
    audit: 'Audit',
    decision: 'Decision',
  }
  return map[kind] ?? kind
}

export function kindBlurb(kind: string): string {
  const map: Record<string, string> = {
    quiz: 'Check what stuck',
    classify: 'Sort the signal',
    detective: 'Clues → diagnosis',
    calculator: 'Hands-on numbers',
    audit: 'Map your gaps',
    decision: 'Forking judgment',
  }
  return map[kind] ?? ''
}
