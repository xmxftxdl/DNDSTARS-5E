export const ROOM_SESSION_STORAGE_KEY = 'stars-room-session:v1'
export const ROOM_CLIENT_ID_STORAGE_KEY = 'stars-room-client-id:v1'
export const ROOM_PLAYER_RESUME_STORAGE_KEY = 'stars-room-player-resume:v1'
export const ROOM_SESSION_EVENT = 'stars-room-session-changed'

export const DND5E_2014_RULESET_ID = 'dnd5e-2014-srd-5.1'
export const DND5E_2014_RULESET_LABEL = 'D&D 5e 2014 · SRD 5.1'

export type RoomRole = 'dm' | 'player' | 'spectator'
export type RoomPlayerSlot = 'player1' | 'player2' | 'player3' | 'player4' | 'player5' | 'player6' | 'player7' | 'player8'

export interface RoomPluginRequirement {
  id: string
  version: string
  integrity: string
  stateSchemaVersion: number
}

export interface RoomPluginMetadata extends RoomPluginRequirement {
  name: string
  publisher: string
  license: string
}

export interface RoomPluginReadiness {
  ready: boolean
  missing: RoomPluginRequirement[]
  mismatched: RoomPluginRequirement[]
}

export interface RoomRulesSnapshot {
  roomId: string
  rulesetId: typeof DND5E_2014_RULESET_ID
  revision: number
  updatedAt: number
  requiredPlugins: RoomPluginRequirement[]
  plugins: RoomPluginMetadata[]
  member: RoomPluginReadiness
}

export interface RoomSession {
  roomId: string
  roomName: string
  rulesetId: typeof DND5E_2014_RULESET_ID
  memberId: string
  /** Stable account owner. Room membership remains replaceable and room-scoped. */
  accountId?: string
  clientId: string
  role: RoomRole
  slot?: RoomPlayerSlot
  displayName: string
  createdAt: number
}

export interface RoomPlayerResumeIdentity {
  roomId: string
  memberId: string
  clientId: string
  displayName: string
  updatedAt: number
}

function localStorageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function isRoomPlayerSlot(value: unknown): value is RoomPlayerSlot {
  return typeof value === 'string' && /^player[1-8]$/.test(value)
}

export function isRoomSession(value: unknown): value is RoomSession {
  if (!value || typeof value !== 'object') return false
  const session = value as Partial<RoomSession>
  if (
    !/^[A-HJ-NP-Z2-9]{6}$/.test(session.roomId ?? '') ||
    session.rulesetId !== DND5E_2014_RULESET_ID ||
    (session.role !== 'dm' && session.role !== 'player' && session.role !== 'spectator') ||
    typeof session.memberId !== 'string' ||
    (session.accountId != null && !/^[A-HJ-NP-Z2-9]{12}$/.test(session.accountId)) ||
    typeof session.clientId !== 'string' ||
    typeof session.displayName !== 'string' ||
    typeof session.roomName !== 'string' ||
    typeof session.createdAt !== 'number'
  ) return false
  return session.role === 'player' ? isRoomPlayerSlot(session.slot) : session.slot == null
}

export function getRoomClientId(): string {
  if (!localStorageAvailable()) return randomId()
  const existing = window.localStorage.getItem(ROOM_CLIENT_ID_STORAGE_KEY)
  if (existing) return existing
  const id = randomId()
  window.localStorage.setItem(ROOM_CLIENT_ID_STORAGE_KEY, id)
  return id
}

export function getRoomSession(): RoomSession | null {
  if (!localStorageAvailable()) return null
  try {
    const raw = window.localStorage.getItem(ROOM_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (isRoomSession(parsed)) {
      rememberRoomPlayerIdentity(parsed)
      return parsed
    }
    window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
  } catch {
    window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
  }
  return null
}

function roomPlayerResumeIdentities(): Record<string, RoomPlayerResumeIdentity> {
  if (!localStorageAvailable()) return {}
  try {
    const raw = window.localStorage.getItem(ROOM_PLAYER_RESUME_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).flatMap(([roomId, value]) => {
      if (!value || typeof value !== 'object') return []
      const identity = value as Partial<RoomPlayerResumeIdentity>
      if (
        !/^[A-HJ-NP-Z2-9]{6}$/.test(roomId) ||
        identity.roomId !== roomId ||
        typeof identity.memberId !== 'string' || identity.memberId.length < 8 ||
        typeof identity.clientId !== 'string' ||
        typeof identity.displayName !== 'string'
      ) return []
      return [[roomId, {
        roomId,
        memberId: identity.memberId,
        clientId: identity.clientId,
        displayName: identity.displayName,
        updatedAt: Number.isFinite(identity.updatedAt) ? Number(identity.updatedAt) : 0,
      } satisfies RoomPlayerResumeIdentity]]
    }))
  } catch {
    return {}
  }
}

export function getRoomPlayerResumeIdentity(roomId: string): RoomPlayerResumeIdentity | null {
  if (!localStorageAvailable()) return null
  const normalizedRoomId = roomId.trim().toUpperCase()
  const identity = roomPlayerResumeIdentities()[normalizedRoomId]
  if (!identity || identity.clientId !== getRoomClientId()) return null
  return identity
}

export function getRecentRoomPlayerResumeIdentity(): RoomPlayerResumeIdentity | null {
  if (!localStorageAvailable()) return null
  const clientId = getRoomClientId()
  return Object.values(roomPlayerResumeIdentities())
    .filter((identity) => identity.clientId === clientId)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
}

function rememberRoomPlayerIdentity(session: RoomSession, touch = false): void {
  if (!localStorageAvailable() || (session.role !== 'player' && session.role !== 'spectator')) return
  const identities = roomPlayerResumeIdentities()
  const existing = identities[session.roomId]
  if (
    !touch && existing &&
    existing.memberId === session.memberId &&
    existing.clientId === session.clientId &&
    existing.displayName === session.displayName
  ) return
  identities[session.roomId] = {
    roomId: session.roomId,
    memberId: session.memberId,
    clientId: session.clientId,
    displayName: session.displayName,
    updatedAt: Date.now(),
  }
  // Keep the most recently used room identities without allowing unbounded growth.
  const recent = Object.fromEntries(Object.entries(identities)
    .sort(([, left], [, right]) => right.updatedAt - left.updatedAt)
    .slice(0, 24))
  window.localStorage.setItem(ROOM_PLAYER_RESUME_STORAGE_KEY, JSON.stringify(recent))
}

export function saveRoomSession(session: RoomSession): void {
  if (!localStorageAvailable() || !isRoomSession(session)) return
  rememberRoomPlayerIdentity(session, true)
  window.localStorage.setItem(ROOM_SESSION_STORAGE_KEY, JSON.stringify(session))
  window.dispatchEvent(new Event(ROOM_SESSION_EVENT))
}

export function clearRoomSession(): void {
  if (!localStorageAvailable()) return
  window.localStorage.removeItem(ROOM_SESSION_STORAGE_KEY)
  window.dispatchEvent(new Event(ROOM_SESSION_EVENT))
}

export function subscribeRoomSession(listener: (session: RoomSession | null) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const notify = () => listener(getRoomSession())
  const onStorage = (event: StorageEvent) => {
    if (event.key === ROOM_SESSION_STORAGE_KEY) notify()
  }
  window.addEventListener(ROOM_SESSION_EVENT, notify)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(ROOM_SESSION_EVENT, notify)
    window.removeEventListener('storage', onStorage)
  }
}
