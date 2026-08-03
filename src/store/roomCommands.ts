import { modeFromPort } from '../lib/appMode'
import { submitDnd5eInventoryMutation } from '../lib/inventoryAuthority'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eConditionLabel,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  removeDnd5eSpellEffectFromMap,
  validateDnd5eSourceBoundConditions,
  type Dnd5eActiveEffectInstance,
} from '../rulesets/dnd5e'
import { RoomCommandBus, type RoomCommandEnvelope } from '../lib/roomCommandBus'
import { appRoomAuthorityScheduler } from '../lib/roomAuthorityScheduler'
import { getRoomSession } from '../lib/roomSession'
import { saveSharedResourcesAtomically } from '../lib/sharedApi'
import type { Character } from '../types/character'
import type { Dnd5eInventoryMutation, Dnd5eInventoryMutationResult } from '../types/inventory'
import { useCharacterStore } from './characters'
import { useMapStore, type BattleMap, type Token } from './maps'

type SpellChoicePatch = Pick<Character, 'dnd5eClassChoices'>

interface OptimisticHitPointEdit {
  key: string
  revision: number
  previousCharacter?: Character
  previousToken?: Token
}

let hitPointEditRevision = 0
const latestHitPointEditRevisionByKey = new Map<string, number>()

interface RoomCommandAggregateTarget {
  characterIds?: readonly (string | undefined)[]
  mapId?: string
  tokenId?: string
  tokenIds?: readonly (string | undefined)[]
  fallback: string
}

function roomCharacterAggregateId(characterId: string): string {
  return `room:characters:${characterId}`
}

function roomTokenAggregateId(mapId: string | undefined, tokenId: string): string {
  return mapId
    ? `room:maps:${mapId}:tokens:${tokenId}`
    : `room:maps:tokens:${tokenId}`
}

function roomCommandAggregateTarget(
  target: RoomCommandAggregateTarget,
): Pick<RoomCommandEnvelope, 'aggregateId' | 'relatedAggregateIds'> {
  const aggregateIds = [...new Set([
    ...(target.characterIds ?? [])
      .filter((characterId): characterId is string => Boolean(characterId))
      .map(roomCharacterAggregateId),
    ...[target.tokenId, ...(target.tokenIds ?? [])]
      .filter((tokenId): tokenId is string => Boolean(tokenId))
      .map((tokenId) => roomTokenAggregateId(target.mapId, tokenId)),
  ])]
  return {
    aggregateId: aggregateIds[0] ?? target.fallback,
    relatedAggregateIds: aggregateIds.slice(1),
  }
}

function linkedCharacterIdForToken(mapId: string | undefined, tokenId: string | undefined): string | undefined {
  if (!mapId || !tokenId) return undefined
  return useMapStore.getState().maps
    .find((candidate) => candidate.id === mapId)
    ?.tokens.find((candidate) => candidate.id === tokenId)
    ?.characterId
}

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
      optimisticEdit?: OptimisticHitPointEdit
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
      type: 'map.spell-effect.remove'
      mapId: string
      tokenId: string
    })
  | (RoomCommandEnvelope & {
      type: 'combat.active-effects.replace'
      characterId?: string
      mapId: string
      tokenId: string
      activeEffects: readonly Dnd5eActiveEffectInstance[]
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

function hitPointEditKey(
  target: Pick<RoomCommandEnvelope, 'aggregateId' | 'relatedAggregateIds'>,
): string {
  return [target.aggregateId, ...(target.relatedAggregateIds ?? [])]
    .sort()
    .join('|')
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
  if (resources.includes('characters') && resources.includes('maps')) {
    const now = Date.now()
    const characters = useCharacterStore.getState()
    const maps = useMapStore.getState()
    await saveSharedResourcesAtomically([
      {
        name: 'characters',
        data: { characters: characters.characters, selectedId: characters.selectedId ?? null, updatedAt: now },
      },
      {
        name: 'maps',
        data: { maps: maps.maps, selectedId: maps.selectedId ?? null, updatedAt: now },
      },
    ], {
      transactionId: `room-command:${now}:${Math.random().toString(36).slice(2)}`,
      undoLabel: '房间权威调整',
    })
    return
  }
  await Promise.all(resources.map((resource) =>
    resource === 'characters'
      ? useCharacterStore.getState().saveSharedNow()
      : useMapStore.getState().saveSharedNow()))
}

export interface RoomSpellEffectRemovalPlan {
  status: 'missing' | 'invalid' | 'removed'
  map: BattleMap
  characters: Character[]
  concentrationEndedCharacterId?: string
  concentrationEndedTokenId?: string
}

/**
 * Builds the complete out-of-combat-safe removal transaction. No initiative
 * snapshot is required: the spell entity metadata and its anchored area are
 * the authority links, and concentration is cleared only when every link still
 * names the caster's current Flaming Sphere concentration.
 */
export function planRoomSpellEffectRemoval(input: {
  map: BattleMap
  characters: readonly Character[]
  tokenId: string
}): RoomSpellEffectRemovalPlan {
  const token = input.map.tokens.find((candidate) => candidate.id === input.tokenId)
  if (!token) {
    return { status: 'missing', map: input.map, characters: [...input.characters] }
  }
  const effect = token.dnd5eSpellEffect
  if (!effect || effect.spellId !== 'flaming-sphere') {
    return { status: 'invalid', map: input.map, characters: [...input.characters] }
  }
  const removal = removeDnd5eSpellEffectFromMap(input.map, token.id)
  if (!removal) {
    return { status: 'invalid', map: input.map, characters: [...input.characters] }
  }

  const concentrationId = effect.concentrationId
  const exactFlamingSphereRelation = effect.spellId === 'flaming-sphere' &&
    concentrationId === 'flaming-sphere' &&
    removal.removedAreas.some((area) =>
      area.sourceKind === 'core-spell' &&
      area.coreSpellId === effect.spellId &&
      area.sourceCharacterId === effect.sourceCharacterId &&
      area.sourceTokenId === effect.sourceTokenId &&
      area.anchorMode === 'effect-token' &&
      area.anchorTokenId === token.id &&
      area.concentrationId === concentrationId,
    )
  if (!exactFlamingSphereRelation) {
    return { status: 'removed', map: removal.map, characters: [...input.characters] }
  }

  const sourceToken = input.map.tokens.find((candidate) => candidate.id === effect.sourceTokenId)
  const sourceCharacter = input.characters.find((candidate) => candidate.id === effect.sourceCharacterId)
  if (
    sourceCharacter &&
    sourceToken?.characterId === sourceCharacter.id &&
    sourceCharacter.dnd5eCombatState?.concentrationSpellId === concentrationId
  ) {
    const previousCombatState = sourceCharacter.dnd5eCombatState
    const activeEffects = previousCombatState.activeEffects?.filter((activeEffect) =>
      !(activeEffect.duration.type === 'concentration' &&
        activeEffect.duration.sourceActorId === sourceToken.id &&
        (!activeEffect.duration.concentrationId ||
          activeEffect.duration.concentrationId === concentrationId)),
    )
    const nextSource: Character = {
      ...sourceCharacter,
      concentrating: false,
      dnd5eCombatState: {
        ...previousCombatState,
        activeEffects: activeEffects && activeEffects.length > 0 ? activeEffects : undefined,
        concentrationSpellId: undefined,
        concentrationSpellLevel: undefined,
        concentrationTargetIds: undefined,
        concentrationRoundsRemaining: undefined,
        huntersMarkTargetId: undefined,
      },
    }
    return {
      status: 'removed',
      map: removal.map,
      characters: input.characters.map((candidate) =>
        candidate.id === nextSource.id ? nextSource : candidate),
      concentrationEndedCharacterId: nextSource.id,
    }
  }

  // Unlinked monster casters persist their class state on the Token itself.
  // They have no top-level `concentrating` flag, so the exact current spell id
  // is the sole current-concentration authority marker.
  if (
    sourceToken &&
    !sourceToken.characterId &&
    sourceToken.dnd5eCombatState?.concentrationSpellId === concentrationId
  ) {
    const nextSourceToken: Token = {
      ...sourceToken,
      dnd5eCombatState: {
        ...sourceToken.dnd5eCombatState,
        concentrationSpellId: undefined,
        concentrationSpellLevel: undefined,
        concentrationTargetIds: undefined,
        concentrationRoundsRemaining: undefined,
      },
    }
    return {
      status: 'removed',
      map: {
        ...removal.map,
        tokens: removal.map.tokens.map((candidate) =>
          candidate.id === nextSourceToken.id ? nextSourceToken : candidate),
      },
      characters: [...input.characters],
      concentrationEndedTokenId: nextSourceToken.id,
    }
  }

  return { status: 'removed', map: removal.map, characters: [...input.characters] }
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
    const previousCharacter = command.optimisticEdit?.previousCharacter ?? (character ? structuredClone(character) : undefined)
    const previousToken = command.optimisticEdit?.previousToken ?? (token ? structuredClone(token) : undefined)
    if (!command.optimisticEdit) {
      if (character) {
        characterState.applyAuthorityUpdate(character.id, {
          currentHp,
          maxHp,
          tempHp: temporaryHp,
          ...(command.manuallySetMaximum && character.rulesetId === 'dnd5e-2014-srd-5.1'
            ? { hitPointMaximumMode: 'manual', hitPointRolls: undefined }
            : {}),
        }, { protectHitPointsUntilAcknowledged: true })
      }
      if (map && token) {
        mapState.applyAuthorityTokenUpdate(
          map.id,
          token.id,
          { hp: currentHp, maxHp },
          { protectHitPointsUntilAcknowledged: true },
        )
      }
    }
    try {
      await persistRoomStores([
        ...(character ? ['characters' as const] : []),
        ...(map && token ? ['maps' as const] : []),
      ])
      if (
        command.optimisticEdit &&
        latestHitPointEditRevisionByKey.get(command.optimisticEdit.key) === command.optimisticEdit.revision
      ) latestHitPointEditRevisionByKey.delete(command.optimisticEdit.key)
      return { status: 'applied' }
    } catch (error) {
      // Clear the optimistic HP guards before reading the winner. Leaving the
      // rejected value protected would make loadShared project it over the
      // authoritative healing/damage result. The previous snapshots are only
      // a network-failure fallback; a successful reload replaces them.
      const canRollback = !command.optimisticEdit ||
        latestHitPointEditRevisionByKey.get(command.optimisticEdit.key) === command.optimisticEdit.revision
      if (canRollback) {
        if (previousCharacter) characterState.applyAuthorityUpdate(previousCharacter.id, previousCharacter)
        if (map && previousToken) mapState.applyAuthorityTokenUpdate(map.id, previousToken.id, previousToken)
        if (command.optimisticEdit) latestHitPointEditRevisionByKey.delete(command.optimisticEdit.key)
      }
      await Promise.allSettled([
        ...(previousCharacter ? [characterState.loadShared()] : []),
        ...(map && previousToken ? [mapState.loadShared()] : []),
      ])
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
      // A conflict may mean another authoritative write already moved this
      // Token. Reload the winning server snapshot instead of restoring the
      // stale pre-drag closure, which would manufacture a visible rollback.
      try {
        await state.loadShared()
      } catch {
        state.applyAuthorityTokenUpdate(map.id, token.id, previous)
      }
      throw error
    }
  }

  if (command.type === 'map.spell-effect.remove') {
    if (!directDmMutationAllowed()) {
      return { status: 'rejected', message: '只有 DM 可以删除法术实体。' }
    }
    const mapState = useMapStore.getState()
    const characterState = useCharacterStore.getState()
    const map = mapState.maps.find((candidate) => candidate.id === command.mapId)
    if (!map) return { status: 'rejected', message: '找不到法术实体所在地图。' }
    const plan = planRoomSpellEffectRemoval({
      map,
      characters: characterState.characters,
      tokenId: command.tokenId,
    })
    // Replayed/duplicated delete commands are successful no-ops.
    if (plan.status === 'missing') return { status: 'applied' }
    if (plan.status === 'invalid') {
      return { status: 'rejected', message: '目标不是可删除的 Headless 法术实体。' }
    }

    const previousMap = structuredClone(map)
    const changedCharacterId = plan.concentrationEndedCharacterId
    const previousCharacter = changedCharacterId
      ? characterState.characters.find((candidate) => candidate.id === changedCharacterId)
      : undefined
    const nextCharacter = changedCharacterId
      ? plan.characters.find((candidate) => candidate.id === changedCharacterId)
      : undefined
    mapState.applyAuthorityMapUpdate(map.id, {
      tokens: plan.map.tokens,
      dnd5ePluginAreas: plan.map.dnd5ePluginAreas,
    })
    if (nextCharacter) characterState.applyAuthorityUpdate(nextCharacter.id, nextCharacter)
    try {
      await persistRoomStores(nextCharacter ? ['characters', 'maps'] : ['maps'])
      return { status: 'applied' }
    } catch (error) {
      mapState.applyAuthorityMapUpdate(previousMap.id, previousMap)
      if (previousCharacter) {
        characterState.applyAuthorityUpdate(previousCharacter.id, previousCharacter)
      }
      await Promise.allSettled([
        mapState.loadShared(),
        ...(previousCharacter ? [characterState.loadShared()] : []),
      ])
      throw error
    }
  }

  if (command.type === 'combat.active-effects.replace') {
    if (!directDmMutationAllowed()) {
      return { status: 'rejected', message: '只有 DM 可以直接调整战斗状态。' }
    }
    const characterState = useCharacterStore.getState()
    const mapState = useMapStore.getState()
    const map = mapState.maps.find((candidate) => candidate.id === command.mapId)
    const token = map?.tokens.find((candidate) => candidate.id === command.tokenId)
    const characterId = command.characterId ?? token?.characterId
    const character = characterId
      ? characterState.characters.find((candidate) => candidate.id === characterId)
      : undefined
    if (!map || !token || (characterId && !character)) {
      return { status: 'rejected', message: '找不到待调整状态的目标。' }
    }

    const activeEffects = normalizeDnd5eActiveEffects(command.activeEffects)
    if (activeEffects.length !== command.activeEffects.length) {
      return { status: 'rejected', message: '状态数据未通过 Headless 校验。' }
    }
    const creatureSourceIds = new Set(map.tokens
      .filter((candidate) => candidate.type === 'player' || candidate.type === 'enemy' || candidate.type === 'npc')
      .map((candidate) => candidate.id))
    const sourceValidation = validateDnd5eSourceBoundConditions({
      effects: activeEffects,
      targetActorId: token.id,
      availableActorIds: creatureSourceIds,
    })
    if (!sourceValidation.ok && sourceValidation.effect?.standardCondition) {
      return {
        status: 'rejected',
        message: `${dnd5eConditionLabel(sourceValidation.effect.standardCondition)}必须指定同一地图上的其他来源生物。`,
      }
    }
    const conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    const previousCharacter = character ? structuredClone(character) : undefined
    const previousToken = structuredClone(token)
    if (character) {
      characterState.applyAuthorityUpdate(character.id, {
        conditions,
        dnd5eCombatState: {
          ...(character.dnd5eCombatState ?? {}),
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
        },
      })
    } else {
      mapState.applyAuthorityTokenUpdate(map.id, token.id, {
        dnd5eCombatState: {
          ...(token.dnd5eCombatState ?? {}),
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          conditions: conditions.length > 0 ? conditions : undefined,
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
        },
      })
    }
    try {
      await persistRoomStores(character ? ['characters'] : ['maps'])
      return { status: 'applied' }
    } catch (error) {
      if (previousCharacter) {
        characterState.applyAuthorityUpdate(previousCharacter.id, previousCharacter)
      } else {
        mapState.applyAuthorityTokenUpdate(map.id, previousToken.id, previousToken)
      }
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
  (command) => appRoomAuthorityScheduler.run(command.id, () => handleAppRoomCommand(command)),
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
  if (!directDmMutationAllowed()) {
    return Promise.resolve({ status: 'rejected', message: '只有 DM 可以直接调整生命值。' })
  }
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [
      input.characterId,
      linkedCharacterIdForToken(input.mapId, input.tokenId),
    ],
    mapId: input.mapId,
    tokenId: input.tokenId,
    fallback: 'room:invalid:hit-points',
  })
  const characterState = useCharacterStore.getState()
  const mapState = useMapStore.getState()
  const character = input.characterId
    ? characterState.characters.find((candidate) => candidate.id === input.characterId)
    : undefined
  const map = input.mapId
    ? mapState.maps.find((candidate) => candidate.id === input.mapId)
    : undefined
  const token = input.tokenId
    ? map?.tokens.find((candidate) => candidate.id === input.tokenId)
    : undefined
  if (!character && !token) {
    return Promise.resolve({ status: 'rejected', message: '找不到生命值调整目标。' })
  }

  const maxHp = Math.max(1, Math.floor(input.maxHp))
  const currentHp = Math.max(0, Math.min(maxHp, Math.floor(input.currentHp)))
  const temporaryHp = Math.max(0, Math.floor(input.temporaryHp ?? character?.tempHp ?? 0))
  const optimisticKey = hitPointEditKey(aggregateTarget)
  const optimisticEdit: OptimisticHitPointEdit = {
    key: optimisticKey,
    revision: ++hitPointEditRevision,
    previousCharacter: character ? structuredClone(character) : undefined,
    previousToken: token ? structuredClone(token) : undefined,
  }
  latestHitPointEditRevisionByKey.set(optimisticKey, optimisticEdit.revision)

  if (character) {
    characterState.applyAuthorityUpdate(character.id, {
      currentHp,
      maxHp,
      tempHp: temporaryHp,
      ...(input.manuallySetMaximum && character.rulesetId === 'dnd5e-2014-srd-5.1'
        ? { hitPointMaximumMode: 'manual', hitPointRolls: undefined }
        : {}),
    }, { protectHitPointsUntilAcknowledged: true })
  }
  if (map && token) {
    mapState.applyAuthorityTokenUpdate(
      map.id,
      token.id,
      { hp: currentHp, maxHp },
      { protectHitPointsUntilAcknowledged: true },
    )
  }

  const dispatched = appRoomCommandBus.dispatchLatest({
    ...input,
    currentHp,
    maxHp,
    temporaryHp,
    id: commandId('hp'),
    type: 'character.hit-points.set',
    ...aggregateTarget,
    issuedAt: Date.now(),
    optimisticEdit,
  }, `hit-points:${optimisticKey}`)
  void dispatched.finally(() => {
    if (latestHitPointEditRevisionByKey.get(optimisticKey) === optimisticEdit.revision) {
      latestHitPointEditRevisionByKey.delete(optimisticKey)
    }
  }).catch(() => undefined)
  return dispatched
}

export function moveRoomToken(input: {
  mapId: string
  tokenId: string
  x: number
  y: number
  elevationFeet?: number
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [linkedCharacterIdForToken(input.mapId, input.tokenId)],
    mapId: input.mapId,
    tokenId: input.tokenId,
    fallback: 'room:invalid:token-move',
  })
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('move'),
    type: 'map.token.move',
    ...aggregateTarget,
    issuedAt: Date.now(),
  })
}

export function removeRoomSpellEffectToken(input: {
  mapId: string
  tokenId: string
}): Promise<AppRoomCommandResult> {
  const currentToken = useMapStore.getState().maps
    .find((candidate) => candidate.id === input.mapId)
    ?.tokens.find((candidate) => candidate.id === input.tokenId)
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [currentToken?.dnd5eSpellEffect?.sourceCharacterId],
    mapId: input.mapId,
    tokenIds: [input.tokenId, currentToken?.dnd5eSpellEffect?.sourceTokenId],
    fallback: 'room:invalid:spell-effect-remove',
  })
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('remove-spell-effect'),
    type: 'map.spell-effect.remove',
    ...aggregateTarget,
    issuedAt: Date.now(),
  })
}

export function replaceRoomCombatantActiveEffects(input: {
  characterId?: string
  mapId: string
  tokenId: string
  activeEffects: readonly Dnd5eActiveEffectInstance[]
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [input.characterId, linkedCharacterIdForToken(input.mapId, input.tokenId)],
    mapId: input.mapId,
    tokenId: input.tokenId,
    fallback: 'room:invalid:active-effects',
  })
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('active-effects'),
    type: 'combat.active-effects.replace',
    ...aggregateTarget,
    issuedAt: Date.now(),
  })
}

export function replaceRoomCharacterSpellSelections(
  characterId: string,
  patch: SpellChoicePatch,
): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [characterId],
    fallback: 'room:invalid:spell-selections',
  })
  return appRoomCommandBus.dispatch({
    id: commandId('spells'),
    type: 'character.spell-selections.replace',
    ...aggregateTarget,
    issuedAt: Date.now(),
    characterId,
    patch,
  })
}

export function mutateRoomCharacterInventory(
  mutation: Dnd5eInventoryMutation,
): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [
      mutation.characterId,
      mutation.type === 'transfer' ? mutation.targetCharacterId : undefined,
    ],
    fallback: 'room:invalid:inventory',
  })
  return appRoomCommandBus.dispatch({
    id: commandId('inventory'),
    type: 'character.inventory.mutate',
    ...aggregateTarget,
    issuedAt: Date.now(),
    mutation,
  })
}
