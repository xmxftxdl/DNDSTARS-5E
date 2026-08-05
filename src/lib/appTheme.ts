export type AppTheme = 'dark' | 'light'

export const APP_THEME_STORAGE_KEY = 'astraltrace-app-theme:v1'
export const DEFAULT_APP_THEME: AppTheme = 'dark'

const listeners = new Set<() => void>()
let currentTheme: AppTheme = DEFAULT_APP_THEME
let storageListenerAttached = false

export function normalizeAppTheme(value: unknown): AppTheme {
  return value === 'light' ? 'light' : DEFAULT_APP_THEME
}

function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readStoredAppTheme(storage: Pick<Storage, 'getItem'> | null = browserStorage()): AppTheme {
  if (!storage) return DEFAULT_APP_THEME
  try {
    return normalizeAppTheme(storage.getItem(APP_THEME_STORAGE_KEY))
  } catch {
    return DEFAULT_APP_THEME
  }
}

function applyAppTheme(theme: AppTheme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'light' ? '#f8fafc' : '#06070f',
  )
}

function publishTheme(theme: AppTheme) {
  if (currentTheme === theme) {
    applyAppTheme(theme)
    return
  }
  currentTheme = theme
  applyAppTheme(theme)
  listeners.forEach((listener) => listener())
}

function attachStorageListener() {
  if (storageListenerAttached || typeof window === 'undefined') return
  storageListenerAttached = true
  window.addEventListener('storage', (event) => {
    if (event.key !== APP_THEME_STORAGE_KEY) return
    publishTheme(normalizeAppTheme(event.newValue))
  })
}

export function initializeAppTheme(): AppTheme {
  const theme = readStoredAppTheme()
  currentTheme = theme
  applyAppTheme(theme)
  attachStorageListener()
  return theme
}

export function getAppTheme(): AppTheme {
  return currentTheme
}

export function setAppTheme(theme: AppTheme): void {
  const normalized = normalizeAppTheme(theme)
  const storage = browserStorage()
  try {
    storage?.setItem(APP_THEME_STORAGE_KEY, normalized)
  } catch {
    // 隐私模式或存储空间不足时仍允许当前页面切换主题。
  }
  publishTheme(normalized)
}

export function subscribeAppTheme(listener: () => void): () => void {
  attachStorageListener()
  listeners.add(listener)
  return () => listeners.delete(listener)
}
