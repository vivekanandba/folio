import { navigate } from './router'
import { buildIndex, query, type SearchDoc } from './search'

/**
 * Command palette over the search index. Uses a native <dialog> for free focus-trapping,
 * Esc-to-close, and an inert background. Returns an `open()` to wire to a button/shortcut.
 */
export function initPalette(): { open: () => void } {
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
    if (!docs.length) docs = await buildIndex()
    refresh()
    input.focus()
  }

  return { open }
}
