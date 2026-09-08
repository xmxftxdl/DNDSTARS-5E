import type { Character } from '../types/character'
import { playerSlotFromPort, playerSlotLabel, type PlayerSlot } from './appMode'
import { getRoomSession } from './roomSession'
import { getAccountSession } from './accountSession'
import type { RoomCharacterAssignment } from './roomApi'

export const PLAYER_ASSIGNMENT_EVENT = 'stars-player-assignment-changed'

export interface CachedRoomCharacterAssignment extends RoomCharacterAssignment {
  roomId: string
  memberId: string
}

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

function roomCharacterAssignmentStorageKey(): string | null {
  const session = getRoomSession()
  return session?.role === 'player'
    ? `stars-dm-character-assignment:${session.roomId}:${session.memberId}`
    : null
}

export function getRoomCharacterAssignment(): CachedRoomCharacterAssignment | null {
  if (!storageAvailable()) return null
  const session = getRoomSession()
  const key = roomCharacterAssignmentStorageKey()
  if (!key || !session) return null
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? 'null') as Partial<CachedRoomCharacterAssignment> | null
    if (!value || value.roomId !== session.roomId || value.memberId !== session.memberId) return null
    const characterId = typeof value.characterId === 'string' && value.characterId ? value.characterId : null
    const enforced = value.enforced === true && characterId !== null
    return {
      roomId: session.roomId,
      memberId: session.memberId,
      revision: Number.isSafeInteger(value.revision) ? Math.max(0, Number(value.revision)) : 0,
      enforced,
      characterId: enforced ? characterId : null,
      characterName: enforced && typeof value.characterName === 'string' ? value.characterName : null,
    }
  } catch {
    window.localStorage.removeItem(key)
    return null
  }
}

export function applyRoomCharacterAssignment(assignment: RoomCharacterAssignment): boolean {
  if (!storageAvailable()) return false
  const session = getRoomSession()
  const key = roomCharacterAssignmentStorageKey()
  if (!session || !key) return false
  const previous = getRoomCharacterAssignment()
  if (assignment.revision < (previous?.revision ?? 0)) return false
  const next: CachedRoomCharacterAssignment = {
    roomId: session.roomId,
    memberId: session.memberId,
    revision: Math.max(0, assignment.revision),
    enforced: assignment.enforced && !!assignment.characterId,
    characterId: assignment.enforced ? assignment.characterId : null,
    characterName: assignment.enforced ? assignment.characterName : null,
  }
  window.localStorage.setItem(key, JSON.stringify(next))
  let changed = JSON.stringify(previous) !== JSON.stringify(next)
  if (next.enforced && next.characterId && getAssignedPlayerCharacterId(session.slot) !== next.characterId) {
    const assignmentKey = playerAssignmentStorageKey(session.slot)
    window.localStorage.setItem(assignmentKey, next.characterId)
    changed = true
  }
  if (changed) window.dispatchEvent(new Event(PLAYER_ASSIGNMENT_EVENT))
  return changed
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
  return characters.filter((character) => {
    if (character.visibleToPlayers === false || character.roomId !== roomId) return false
    if (typeof character.roomMemberId === 'string' && character.roomMemberId) {
      return character.roomMemberId === memberId
    }
    return !!accountId && character.ownerAccountId === accountId
  })
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

export function assignableRoomCharactersForPlayer(
  characters: readonly Character[],
  roomId: string,
  targetMemberId: string,
): Character[] {
  return characters.filter((character) =>
    character.visibleToPlayers !== false &&
    character.roomId === roomId &&
    (!character.roomMemberId || character.roomMemberId === targetMemberId))
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

/**
 * The player's explicit room assignment is the character they are asking to
 * view and edit. Shared character-store selection can lag behind a room sync,
 * so it must not pull the full sheet back to a previously selected character.
 */
export function playerCharacterPageActiveId(
  visibleCharacters: readonly { id: string }[],
  options: {
    isDM: boolean
    assignedCharacterId?: string | null
    selectedCharacterId?: string | null
  },
): string | null {
  if (
    !options.isDM &&
    options.assignedCharacterId &&
    visibleCharacters.some((character) => character.id === options.assignedCharacterId)
  ) return options.assignedCharacterId
  if (
    options.selectedCharacterId &&
    visibleCharacters.some((character) => character.id === options.selectedCharacterId)
  ) return options.selectedCharacterId
  return visibleCharacters[0]?.id ?? null
}
