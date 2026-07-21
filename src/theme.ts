export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'folio-theme'

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function applyTheme(pref: ThemePref): void {
  const root = document.documentElement
  if (pref === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', pref)
}

export function setThemePref(pref: ThemePref): void {
  if (pref === 'system') localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

function systemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function effectiveIsDark(): boolean {
  const pref = getThemePref()
  return pref === 'dark' || (pref === 'system' && systemDark())
}

/** Topbar theme toggle. Cycles light ⇄ dark (relative to whatever is currently showing). */
export function initThemeToggle(): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'theme-toggle'
  btn.type = 'button'

  const sync = () => {
    const dark = effectiveIsDark()
    btn.setAttribute('aria-pressed', String(dark))
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
    btn.title = dark ? 'Light theme' : 'Dark theme'
    btn.textContent = dark ? '☀' : '☾'
  }

  btn.addEventListener('click', () => {
    setThemePref(effectiveIsDark() ? 'light' : 'dark')
    sync()
  })

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (getThemePref() === 'system') sync()
    })

  sync()
  return btn
}
