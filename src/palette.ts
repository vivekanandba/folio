import { navigate } from './router'
import { buildIndex, query, type SearchDoc } from './search'

/**
 * Command palette over the search index. Uses a native <dialog> for free focus-trapping,
 * Esc-to-close, and an inert background. Returns an `open()` to wire to a button/shortcut.
 */
export function initPalette(): { open: () => Promise<void> } {
  const dialog = document.createElement('dialog')
  dialog.className = 'cmdk'

  const box = document.createElement('div')
  box.className = 'cmdk-box'

  const input = document.createElement('input')
  input.className = 'cmdk-input'
  input.type = 'text'
  input.placeholder = 'Search packs, concepts, sessions…'
  input.setAttribute('role', 'combobox')
  input.setAttribute('aria-expanded', 'true')
  input.setAttribute('aria-controls', 'cmdk-list')
  input.setAttribute('aria-autocomplete', 'list')
  input.setAttribute('aria-label', 'Search')

  const list = document.createElement('ul')
  list.className = 'cmdk-list'
  list.id = 'cmdk-list'
  list.setAttribute('role', 'listbox')

  box.append(input, list)
  dialog.append(box)
  document.body.append(dialog)

  /**
   * The index could not be built. Held as STATE, not written straight into
   * the list, because the input listener is still live while the message is
   * on screen: the first character the reader types calls render(), which
   * replaced the explanation with "No matches" — landing them in exactly the
   * blank-looking list the message exists to prevent.
   */
  let indexFailed = false
  const INDEX_FAILED = 'The index could not be loaded. Close and open again to retry.'
  let docs: SearchDoc[] = []
  let results: SearchDoc[] = []
  let active = 0

  const syncActive = () => {
    ;[...list.children].forEach((c, i) => {
      c.classList.toggle('active', i === active)
      c.setAttribute('aria-selected', String(i === active))
    })
    input.setAttribute('aria-activedescendant', results.length ? `cmdk-opt-${active}` : '')
    ;(list.children[active] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' })
  }

  const render = () => {
    list.replaceChildren()
    if (indexFailed) {
      const li = document.createElement('li')
      li.className = 'cmdk-empty'
      li.textContent = INDEX_FAILED
      list.append(li)
      return
    }
    if (!results.length) {
      const li = document.createElement('li')
      li.className = 'cmdk-empty'
      li.textContent = 'No matches'
      list.append(li)
      return
    }
    results.forEach((d, i) => {
      const li = document.createElement('li')
      li.className = 'cmdk-item'
      li.id = `cmdk-opt-${i}`
      li.setAttribute('role', 'option')
      const type = document.createElement('span')
      type.className = `cmdk-type type-${d.type}`
      type.textContent = d.type
      const title = document.createElement('span')
      title.className = 'cmdk-title'
      title.textContent = d.title
      const sub = document.createElement('span')
      sub.className = 'cmdk-sub'
      sub.textContent = d.subtitle
      li.append(type, title, sub)
      li.addEventListener('click', () => choose(i))
      li.addEventListener('mousemove', () => {
        if (active !== i) {
          active = i
          syncActive()
        }
      })
      list.append(li)
    })
    syncActive()
  }

  const refresh = () => {
    results = query(docs, input.value)
    active = 0
    render()
  }

  const close = () => {
    if (dialog.open) dialog.close()
  }

  const choose = (i: number) => {
    const d = results[i]
    if (!d) return
    close()
    navigate(d.route)
  }

  input.addEventListener('input', refresh)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      active = Math.min(active + 1, results.length - 1)
      syncActive()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      active = Math.max(active - 1, 0)
      syncActive()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(active)
    } else if (e.key === 'Home') {
      e.preventDefault()
      active = 0
      syncActive()
    } else if (e.key === 'End') {
      e.preventDefault()
      active = results.length - 1
      syncActive()
    }
  })
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) close()
  })

  const open = async () => {
    if (dialog.open) return
    dialog.showModal()
    input.value = ''
    list.replaceChildren()
    indexFailed = false
    if (!docs.length) {
      try {
        docs = await buildIndex()
      } catch {
        // Say so, rather than showing an empty list that looks like "no
        // matches for a query you have not typed yet". The index can be
        // rebuilt — buildIndex no longer caches the failure — so this is
        // worth retrying rather than reporting as fatal.
        indexFailed = true
        render()
        input.focus()
        return
      }
    }
    refresh()
    input.focus()
  }

  return { open }
}
