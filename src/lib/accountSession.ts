export const ACCOUNT_SESSION_STORAGE_KEY = 'stars-account-session:v1'
export const ACCOUNT_RECOVERY_HINT_STORAGE_KEY = 'stars-account-recovery-hint:v1'
export const ACCOUNT_SESSION_EVENT = 'stars-account-session-changed'

export interface AccountSession {
  accountId: string
  displayName: string
  username?: string
  contactChannel?: 'email' | 'phone'
  contactLabel?: string
  sessionToken: string
  createdAt: number
}

export interface AccountRecoveryReceipt {
  session: AccountSession
  recoveryCode: string
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function isAccountSession(value: unknown): value is AccountSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<AccountSession>
  return /^[A-HJ-NP-Z2-9]{12}$/.test(session.accountId ?? '') &&
    typeof session.displayName === 'string' && session.displayName.length > 0 &&
    (session.username == null || (typeof session.username === 'string' && session.username.length > 0)) &&
    (session.contactChannel == null || session.contactChannel === 'email' || session.contactChannel === 'phone') &&
    (session.contactLabel == null || typeof session.contactLabel === 'string') &&
    typeof session.sessionToken === 'string' && session.sessionToken.length >= 32 &&
    Number.isFinite(session.createdAt)
}

export function getAccountSession(): AccountSession | null {
  if (!storageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isAccountSession(parsed)) return parsed
  } catch {
    // Invalid browser state is discarded below.
  }
  window.localStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY)
  return null
}

export function saveAccountSession(session: AccountSession): void {
  if (!storageAvailable() || !isAccountSession(session)) return
  window.localStorage.setItem(ACCOUNT_SESSION_STORAGE_KEY, JSON.stringify(session))
  window.localStorage.setItem(ACCOUNT_RECOVERY_HINT_STORAGE_KEY, session.accountId)
  window.dispatchEvent(new Event(ACCOUNT_SESSION_EVENT))
}

export function clearAccountSession(): void {
  if (!storageAvailable()) return
  window.localStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY)
  window.dispatchEvent(new Event(ACCOUNT_SESSION_EVENT))
}

export function accountRecoveryHint(): string | null {
  if (!storageAvailable()) return null
  const value = window.localStorage.getItem(ACCOUNT_RECOVERY_HINT_STORAGE_KEY)
  return value && /^[A-HJ-NP-Z2-9]{12}$/.test(value) ? value : null
}

export function subscribeAccountSession(listener: (session: AccountSession | null) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const notify = () => listener(getAccountSession())
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNT_SESSION_STORAGE_KEY) notify()
  }
  window.addEventListener(ACCOUNT_SESSION_EVENT, notify)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(ACCOUNT_SESSION_EVENT, notify)
    window.removeEventListener('storage', onStorage)
  }
}
