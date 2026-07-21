export type ThemePref = 'light' | 'dark'

const KEY = 'folio-theme'

// Light is the default. Dark is opt-in only (we do not follow the OS setting),
// so a dark-OS user is never auto-dropped into the dark theme.
export function getThemePref(): ThemePref {
  return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
}

function applyTheme(pref: ThemePref): void {
  document.documentElement.setAttribute('data-theme', pref)
}

export function setThemePref(pref: ThemePref): void {
  localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

/** Topbar theme toggle. Cycles light ⇄ dark; defaults to light. */
export function initThemeToggle(): HTMLElement {
  const btn = document.createElement('button')
  btn.className = 'theme-toggle'
  btn.type = 'button'

  const sync = () => {
    const dark = getThemePref() === 'dark'
    btn.setAttribute('aria-pressed', String(dark))
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme')
    btn.title = dark ? 'Light theme' : 'Dark theme'
    btn.textContent = dark ? '☀' : '☾'
  }

  btn.addEventListener('click', () => {
    setThemePref(getThemePref() === 'dark' ? 'light' : 'dark')
    sync()
  })

  sync()
  return btn
}
