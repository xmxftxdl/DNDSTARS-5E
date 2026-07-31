import { modeFromPort } from '../lib/appMode'
import { submitDnd5eInventoryMutation } from '../lib/inventoryAuthority'
import { RoomCommandBus, type RoomCommandEnvelope } from '../lib/roomCommandBus'
import { getRoomSession } from '../lib/roomSession'
import type { Character } from '../types/character'
import type { Dnd5eInventoryMutation, Dnd5eInventoryMutationResult } from '../types/inventory'
import { useCharacterStore } from './characters'
import { useMapStore } from './maps'

type SpellChoicePatch = Pick<Character, 'dnd5eClassChoices'>
const ROOM_SHARED_STATE_AGGREGATE_ID = 'room:shared-state'

export type AppRoomCommand =
  | (RoomCommandEnvelope & {
      type: 'character.hit-points.set'
      characterId?: string
      mapId?: string
      tokenId?: string
      currentHp: number
      maxHp: number
      temporaryHp?: number
      manuallySetMaximum?: boolean
    })
  | (RoomCommandEnvelope & {
      type: 'map.token.move'
      mapId: string
      tokenId: string
      x: number
      y: number
      elevationFeet?: number
    })
  | (RoomCommandEnvelope & {
      type: 'character.spell-selections.replace'
      characterId: string
      patch: SpellChoicePatch
    })
  | (RoomCommandEnvelope & {
      type: 'character.inventory.mutate'
      mutation: Dnd5eInventoryMutation
    })

export interface AppRoomCommandResult {
  status: 'applied' | 'submitted' | 'rejected'
  message?: string
  inventory?: Dnd5eInventoryMutationResult
}

function commandId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`
}

function directDmMutationAllowed(): boolean {
  const session = getRoomSession()
  return session ? session.role === 'dm' : modeFromPort() !== 'player'
}

function characterMutationAllowed(character: Character): boolean {
  const session = getRoomSession()
  if (!session || session.role === 'dm') return true
  return session.role === 'player' && character.roomMemberId === session.memberId
}

async function persistRoomStores(resources: readonly ('characters' | 'maps')[]): Promise<void> {
  await Promise.all(resources.map((resource) =>
    resource === 'characters'
      ? useCharacterStore.getState().saveSharedNow()
      : useMapStore.getState().saveSharedNow()))
}

async function handleAppRoomCommand(command: AppRoomCommand): Promise<AppRoomCommandResult> {
  if (command.type === 'character.hit-points.set') {
    if (!directDmMutationAllowed()) return { status: 'rejected', message: '只有 DM 可以直接调整生命值。' }
    const characterState = useCharacterStore.getState()
    const mapState = useMapStore.getState()
    const character = command.characterId
      ? characterState.characters.find((candidate) => candidate.id === command.characterId)
      : undefined
    const map = command.mapId
      ? mapState.maps.find((candidate) => candidate.id === command.mapId)
      : undefined
    const token = command.tokenId
      ? map?.tokens.find((candidate) => candidate.id === command.tokenId)
      : undefined
    if (!character && !token) return { status: 'rejected', message: '找不到生命值调整目标。' }

    const maxHp = Math.max(1, Math.floor(command.maxHp))
    const currentHp = Math.max(0, Math.min(maxHp, Math.floor(command.currentHp)))
    const temporaryHp = Math.max(0, Math.floor(command.temporaryHp ?? character?.tempHp ?? 0))
    const previousCharacter = character ? structuredClone(character) : undefined
    const previousToken = token ? structuredClone(token) : undefined
    if (character) {
      characterState.applyAuthorityUpdate(character.id, {
        currentHp,
        maxHp,
        tempHp: temporaryHp,
        ...(command.manuallySetMaximum && character.rulesetId === 'dnd5e-2014-srd-5.1'
          ? { hitPointMaximumMode: 'manual', hitPointRolls: undefined }
          : {}),
      })
    }
    if (map && token) {
      mapState.applyAuthorityTokenUpdate(map.id, token.id, { hp: currentHp, maxHp })
    }
    try {
      await persistRoomStores([
        ...(character ? ['characters' as const] : []),
        ...(map && token ? ['maps' as const] : []),
      ])
      return { status: 'applied' }
    } catch (error) {
      if (previousCharacter) characterState.applyAuthorityUpdate(previousCharacter.id, previousCharacter)
      if (map && previousToken) mapState.applyAuthorityTokenUpdate(map.id, previousToken.id, previousToken)
      throw error
    }
  }

  if (command.type === 'map.token.move') {
    if (!directDmMutationAllowed()) return { status: 'rejected', message: '玩家移动必须经过 DM 权威验证。' }
    if (![command.x, command.y, command.elevationFeet ?? 0].every(Number.isFinite)) {
      return { status: 'rejected', message: 'Token 目标坐标无效。' }
    }
    const state = useMapStore.getState()
    const map = state.maps.find((candidate) => candidate.id === command.mapId)
    const token = map?.tokens.find((candidate) => candidate.id === command.tokenId)
    if (!map || !token) return { status: 'rejected', message: '找不到待移动的 Token。' }
    const previous = structuredClone(token)
    state.applyAuthorityTokenUpdate(map.id, token.id, {
      x: command.x,
      y: command.y,
      elevationFeet: command.elevationFeet,
      movementAnimation: undefined,
    })
    try {
      await state.saveAuthorityTokenPatch(map.id, token.id, {
        x: command.x,
        y: command.y,
        elevationFeet: command.elevationFeet,
        movementAnimation: undefined,
      })
      return { status: 'applied' }
    } catch (error) {
      state.applyAuthorityTokenUpdate(map.id, token.id, previous)
      throw error
    }
  }

  if (command.type === 'character.spell-selections.replace') {
    const state = useCharacterStore.getState()
    const character = state.characters.find((candidate) => candidate.id === command.characterId)
    if (!character || !characterMutationAllowed(character)) {
      return { status: 'rejected', message: '当前成员无权修改该角色的法术准备。' }
    }
    const previous = structuredClone(character)
    state.applyAuthorityUpdate(character.id, command.patch)
    try {
      await persistRoomStores(['characters'])
      return { status: 'applied' }
    } catch (error) {
      state.applyAuthorityUpdate(previous.id, previous)
      throw error
    }
  }

  if (command.mutation.type === 'grant') {
    if (!directDmMutationAllowed()) return { status: 'rejected', message: '只有 DM 可以分发物品。' }
    const inventory = useCharacterStore.getState().applyInventoryMutation(command.mutation)
    return {
      status: inventory.ok ? 'applied' : 'rejected',
      message: inventory.message,
      inventory,
    }
  }
  const submitted = submitDnd5eInventoryMutation(command.mutation)
  return {
    status: submitted.status,
    message: submitted.message,
    inventory: submitted.result,
  }
}

export const appRoomCommandBus = new RoomCommandBus<AppRoomCommand, AppRoomCommandResult>(
  handleAppRoomCommand,
)

export function setRoomCharacterHitPoints(input: {
  characterId?: string
  mapId?: string
  tokenId?: string
  currentHp: number
  maxHp: number
  temporaryHp?: number
  manuallySetMaximum?: boolean
}): Promise<AppRoomCommandResult> {
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('hp'),
    type: 'character.hit-points.set',
    aggregateId: ROOM_SHARED_STATE_AGGREGATE_ID,
    issuedAt: Date.now(),
  })
}

export function moveRoomToken(input: {
  mapId: string
  tokenId: string
  x: number
  y: number
  elevationFeet?: number
}): Promise<AppRoomCommandResult> {
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('move'),
    type: 'map.token.move',
    aggregateId: ROOM_SHARED_STATE_AGGREGATE_ID,
    issuedAt: Date.now(),
  })
}

export function replaceRoomCharacterSpellSelections(
  characterId: string,
  patch: SpellChoicePatch,
): Promise<AppRoomCommandResult> {
  return appRoomCommandBus.dispatch({
    id: commandId('spells'),
    type: 'character.spell-selections.replace',
    aggregateId: ROOM_SHARED_STATE_AGGREGATE_ID,
    issuedAt: Date.now(),
    characterId,
    patch,
  })
}

export function mutateRoomCharacterInventory(
  mutation: Dnd5eInventoryMutation,
): Promise<AppRoomCommandResult> {
  return appRoomCommandBus.dispatch({
    id: commandId('inventory'),
    type: 'character.inventory.mutate',
    aggregateId: ROOM_SHARED_STATE_AGGREGATE_ID,
    issuedAt: Date.now(),
    mutation,
  })
}
