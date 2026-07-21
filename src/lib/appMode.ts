import { getRoomSession, isRoomPlayerSlot, type RoomPlayerSlot } from './roomSession'

export type AppMode = 'dm' | 'player'
export type PlayerSlot = RoomPlayerSlot

const DM_PORTS = new Set(['5273'])
const PLAYER_PORT_TO_SLOT: Record<string, PlayerSlot> = {
  '5274': 'player1',
  '5275': 'player2',
  '5276': 'player3',
  '6174': 'player1',
  '6175': 'player2',
  '6176': 'player3',
}

function modeFromEnv(): AppMode | null {
  const mode = import.meta.env.VITE_APP_MODE
  return mode === 'dm' || mode === 'player' ? mode : null
}

function playerSlotFromEnv(): PlayerSlot | null {
  const slot = import.meta.env.VITE_PLAYER_SLOT
  return isRoomPlayerSlot(slot) ? slot : null
}

export function modeFromPort(): AppMode | null {
  const sessionMode = getRoomSession()?.role
  if (sessionMode === 'spectator') return 'player'
  if (sessionMode === 'dm' || sessionMode === 'player') return sessionMode
  const envMode = modeFromEnv()
  if (envMode) return envMode
  const port = typeof window !== 'undefined' ? window.location.port : ''
  if (DM_PORTS.has(port)) return 'dm'
  if (PLAYER_PORT_TO_SLOT[port]) return 'player'
  return null
}

export function playerSlotFromPort(port?: string): PlayerSlot | null {
  const session = getRoomSession()
  if (session?.role === 'spectator') return null
  const sessionSlot = session?.slot
  if (isRoomPlayerSlot(sessionSlot)) return sessionSlot
  const resolvedPort = port ?? (typeof window !== 'undefined' ? window.location.port : '')
  return playerSlotFromEnv() ?? PLAYER_PORT_TO_SLOT[resolvedPort] ?? null
}

export function playerSlotLabel(slot: PlayerSlot | null | undefined): string {
  return `玩家${slot?.replace('player', '') || '1'}`
}

export function isPlayerPort(): boolean {
  return modeFromPort() === 'player'
}

export function canWriteSharedState(): boolean {
  const session = getRoomSession()
  if (session?.role === 'spectator') return false
  return modeFromPort() !== 'player'
}
