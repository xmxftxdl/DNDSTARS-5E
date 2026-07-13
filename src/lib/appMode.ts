export type AppMode = 'dm' | 'player'
export type PlayerSlot = 'player1' | 'player2' | 'player3'

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
  return slot === 'player1' || slot === 'player2' || slot === 'player3' ? slot : null
}

export function modeFromPort(): AppMode | null {
  const envMode = modeFromEnv()
  if (envMode) return envMode
  const port = typeof window !== 'undefined' ? window.location.port : ''
  if (DM_PORTS.has(port)) return 'dm'
  if (PLAYER_PORT_TO_SLOT[port]) return 'player'
  return null
}

export function playerSlotFromPort(port?: string): PlayerSlot | null {
  const resolvedPort = port ?? (typeof window !== 'undefined' ? window.location.port : '')
  return playerSlotFromEnv() ?? PLAYER_PORT_TO_SLOT[resolvedPort] ?? null
}

export function playerSlotLabel(slot: PlayerSlot | null | undefined): string {
  if (slot === 'player2') return '玩家2'
  if (slot === 'player3') return '玩家3'
  return '玩家1'
}

export function isPlayerPort(): boolean {
  return modeFromPort() === 'player'
}

export function canWriteSharedState(): boolean {
  return modeFromPort() !== 'player'
}
