import { getAccountSession } from './accountSession'
import { currentPlayerSlot } from './playerView'
import { getRoomSession } from './roomSession'

const PREFIX = 'stars-character-creation-draft:v1:'

/** Keep unfinished builds private to the account, campaign and player seat. */
export function characterCreationDraftKey(section = 'setup'): string {
  const room = getRoomSession()
  return PREFIX + JSON.stringify([
    getAccountSession()?.accountId ?? room?.accountId ?? 'local',
    room?.campaignId ?? room?.roomId ?? 'local',
    currentPlayerSlot(),
    section,
  ])
}

export function readCharacterCreationDraft<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const stored = JSON.parse(raw)
    if (stored?.schemaVersion !== 1 || !stored.values || typeof stored.values !== 'object' || Array.isArray(stored.values)) return fallback
    // Only restore known fields, with the same basic shape as their defaults.
    return Object.fromEntries(Object.entries(fallback).map(([field, initial]) => {
      const value = stored.values[field]
      const valid = initial === undefined ? value === undefined || (value !== null && typeof value === 'object')
        : Array.isArray(initial) ? Array.isArray(value)
        : initial !== null && typeof initial === 'object' ? value !== null && typeof value === 'object' && !Array.isArray(value)
        : typeof value === typeof initial
      return [field, valid ? value : initial]
    })) as T
  } catch {
    return fallback
  }
}

export function writeCharacterCreationDraft(key: string, values: object): boolean {
  try {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, values }))
    return true
  } catch {
    return false
  }
}

export function clearCharacterCreationDraft(key: string): void {
  try { localStorage.removeItem(key) } catch { /* Keep the in-memory draft usable. */ }
}

export function hasCharacterCreationDraft(key: string): boolean {
  try { return localStorage.getItem(key) !== null } catch { return false }
}

export function copyCharacterCreationDraft(source: string, destination: string): boolean {
  try {
    const raw = localStorage.getItem(source)
    if (!raw) return false
    localStorage.setItem(destination, raw)
    return true
  } catch { return false }
}
