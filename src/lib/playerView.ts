import type { Character } from '../types/character'
import { playerSlotFromPort, playerSlotLabel, type PlayerSlot } from './appMode'
import { getRoomSession } from './roomSession'
import { getAccountSession } from './accountSession'

export const PLAYER_ASSIGNMENT_EVENT = 'stars-player-assignment-changed'

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage
}

export function currentPlayerSlot(): PlayerSlot {
  return playerSlotFromPort() ?? 'player1'
}

export function playerAssignmentStorageKey(slot = currentPlayerSlot()): string {
  const session = getRoomSession()
  if (session?.role === 'player') return `stars-player-character-id:${session.roomId}:${session.memberId}`
  return session?.roomId
    ? `stars-player-character-id:${session.roomId}:${slot}`
    : `stars-player-character-id:${slot}`
}

export function getAssignedPlayerCharacterId(slot = currentPlayerSlot()): string | null {
  if (!storageAvailable()) return null
  const key = playerAssignmentStorageKey(slot)
  const assigned = window.localStorage.getItem(key)
  if (assigned) return assigned
  const session = getRoomSession()
  if (session?.role !== 'player') return null
  // 从旧版“房间 + 席位”键迁移；成员重连后即使换到空闲新席位也继续控制原角色。
  const legacyKey = `stars-player-character-id:${session.roomId}:${slot}`
  const legacy = window.localStorage.getItem(legacyKey)
  if (legacy) window.localStorage.setItem(key, legacy)
  return legacy
}

export function setAssignedPlayerCharacterId(id: string | null, slot = currentPlayerSlot()): void {
  if (!storageAvailable()) return
  const key = playerAssignmentStorageKey(slot)
  if (id) window.localStorage.setItem(key, id)
  else window.localStorage.removeItem(key)
  window.dispatchEvent(new Event(PLAYER_ASSIGNMENT_EVENT))
}

function playerAliases(slot: PlayerSlot): string[] {
  const label = playerSlotLabel(slot)
  const index = slot.slice(-1)
  return [slot, label, `玩家 ${index}`, `player${index}`, `player-${index}`, `Player ${index}`]
}

export function roomOwnedPlayerCharacters(
  characters: Character[],
  roomId: string,
  memberId: string,
): Character[] {
  const accountId = getAccountSession()?.accountId
  return characters.filter((character) =>
    character.visibleToPlayers !== false &&
    character.roomId === roomId &&
    (character.roomMemberId === memberId || (!!accountId && character.ownerAccountId === accountId)))
}

export function roomCharactersOwnedByMembers(
  characters: readonly Character[],
  roomId: string,
  memberIds: ReadonlySet<string>,
): Character[] {
  return characters.filter((character) =>
    character.visibleToPlayers !== false &&
    character.roomId === roomId &&
    typeof character.roomMemberId === 'string' &&
    memberIds.has(character.roomMemberId))
}

export function planRoomCharacterOwnershipRecovery(
  characters: readonly Character[],
  roomId: string,
  currentPlayers: readonly { memberId: string; displayName: string }[],
): Array<{ characterId: string; memberId: string }> {
  const currentMemberIds = new Set(currentPlayers.map((player) => player.memberId))
  const displayNameCounts = new Map<string, number>()
  for (const player of currentPlayers) {
    const name = player.displayName.trim()
    displayNameCounts.set(name, (displayNameCounts.get(name) ?? 0) + 1)
  }
  return currentPlayers.flatMap((player) => {
    const displayName = player.displayName.trim()
    if (!displayName || displayNameCounts.get(displayName) !== 1) return []
    const alreadyOwned = characters.some((character) =>
      character.roomId === roomId && character.roomMemberId === player.memberId)
    if (alreadyOwned) return []
    return characters.flatMap((character) => {
      const formerOwner = character.roomMemberId
      if (
        character.visibleToPlayers === false ||
        character.roomId !== roomId ||
        typeof formerOwner !== 'string' ||
        currentMemberIds.has(formerOwner) ||
        character.player.trim() !== displayName
      ) return []
      return [{ characterId: character.id, memberId: player.memberId }]
    })
  })
}

/** 玩家版只展示的本角色 */
export function getPlayerCharacter(
  characters: Character[],
  opts?: { slot?: PlayerSlot | null; assignedCharacterId?: string | null },
): Character | undefined {
  const visible = characters.filter((c) => c.visibleToPlayers !== false)
  const roomSession = getRoomSession()
  const roomOwned = roomSession?.role === 'player'
    ? roomOwnedPlayerCharacters(visible, roomSession.roomId, roomSession.memberId)
    : null
  const candidates = roomOwned ?? visible
  const slot = opts?.slot ?? currentPlayerSlot()
  const assignedCharacterId = opts?.assignedCharacterId ?? getAssignedPlayerCharacterId(slot)
  if (assignedCharacterId) {
    const assigned = candidates.find((c) => c.id === assignedCharacterId)
    if (assigned) return assigned
  }
  if (roomOwned) return roomOwned[0]
  const aliases = new Set(playerAliases(slot))
  const byOwner = visible.find((c) => aliases.has(c.player))
  if (byOwner) return byOwner
  return visible.length === 1 ? visible[0] : undefined
}

export function playerViewCharacters(
  characters: Character[],
  opts?: { slot?: PlayerSlot | null; assignedCharacterId?: string | null },
): Character[] {
  const roomSession = getRoomSession()
  if (roomSession?.role === 'player') {
    return roomOwnedPlayerCharacters(characters, roomSession.roomId, roomSession.memberId)
  }
  const mine = getPlayerCharacter(characters, opts)
  return mine ? [mine] : []
}
