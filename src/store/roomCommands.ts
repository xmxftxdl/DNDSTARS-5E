import { modeFromPort } from '../lib/appMode'
import { submitDnd5eInventoryMutation } from '../lib/inventoryAuthority'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eConditionLabel,
  dnd5eConditionSourceCreatureTypes,
  dnd5eConditionsFromActiveEffects,
  dnd5eIncomingConditionImmunityBlocks,
  normalizeDnd5eActiveEffects,
  removeDnd5eActiveEffectsForEvent,
  removeDnd5eSpellEffectFromMap,
  validateDnd5eSourceBoundConditions,
  type Dnd5eActiveEffectInstance,
} from '../rulesets/dnd5e'
import { RoomCommandBus, type RoomCommandEnvelope } from '../application/commands/RoomCommandBus'
import { browserRoomCommandTelemetry } from '../adapters/browser/performanceCommandTelemetry'
import { appRoomAuthorityScheduler } from '../lib/roomAuthorityScheduler'
import { getRoomSession } from '../lib/roomSession'
import { getClassResource, spendClassResource } from '../lib/classResources'
import { DND5E_CORE_INSPIRATION_RESOURCE_KEY } from '../lib/d20InterruptPolicy'
import { browserSharedRoomService } from '../composition/browserSharedRoomService'
import type { Character } from '../types/character'
import type { Dnd5eInventoryMutation, Dnd5eInventoryMutationResult } from '../types/inventory'
import { useCharacterStore } from './characters'
import { useMapStore, type BattleMap, type Token } from './maps'
import { getDnd5eSrdMonster } from '../rulesets/dnd5e/monsters'
import {
  dnd5eMonsterRuntimeStatusCapabilities,
  type Dnd5eMonsterRuntimeStatusId,
} from '../rulesets/dnd5e/tokenStatusMarkers'
import {
  normalizeDnd5eHitPointMaximumReductionLedger,
  recoverDnd5eHitPointMaximumReductionsForEffect,
} from '../rulesets/dnd5e/hitPointMaximumReductions'
import { dnd5eRestoredSummonedOriginalObject } from '../rulesets/dnd5e/summonedCreatures'

type SpellChoicePatch = Pick<Character, 'dnd5eClassChoices'>

interface OptimisticHitPointEdit {
  key: string
  revision: number
  previousCharacter?: Character
  previousToken?: Token
}

function manualDamageActiveEffectPatch(input: {
  previousHitPoints: number
  currentHitPoints: number
  manuallySetMaximum?: boolean
  combatState: Character['dnd5eCombatState'] | Token['dnd5eCombatState']
}): Character['dnd5eCombatState'] | Token['dnd5eCombatState'] | undefined {
  if (
    input.manuallySetMaximum ||
    input.currentHitPoints >= input.previousHitPoints
  ) return undefined
  const resolved = removeDnd5eActiveEffectsForEvent({
    effects: input.combatState?.activeEffects,
    trigger: 'takes-damage',
  })
  if (resolved.removed.length === 0) return undefined
  return {
    ...(input.combatState ?? {}),
    activeEffects: resolved.effects.length > 0 ? resolved.effects : undefined,
  }
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
      type: 'combat.concentration.end'
      characterId?: string
      mapId: string
      tokenId: string
      expectedConcentrationId: string
    })
  | (RoomCommandEnvelope & {
      type: 'combat.monster-berserk.set'
      mapId: string
      tokenId: string
      active: boolean
    })
  | (RoomCommandEnvelope & {
      type: 'combat.monster-runtime-status.set'
      mapId: string
      tokenId: string
      statusId: Dnd5eMonsterRuntimeStatusId
      active: boolean
      sourceActorId?: string
    })
  | (RoomCommandEnvelope & {
      type: 'character.spell-selections.replace'
      characterId: string
      patch: SpellChoicePatch
    })
  | (RoomCommandEnvelope & {
      type: 'character.spell-slot.set'
      characterId: string
      resourceKey: string
      current: number
    })
  | (RoomCommandEnvelope & {
      type: 'character.class-resources.spend'
      characterId: string
      costs: readonly { resourceKey: string; amount: number }[]
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

export function isEditableDnd5eSpellSlotResourceKey(resourceKey: string): boolean {
  return resourceKey === 'dnd5e-pact-slot' || /^dnd5e-spell-slot-[1-9]$/.test(resourceKey)
}

async function persistRoomStores(resources: readonly ('characters' | 'maps')[]): Promise<void> {
  if (resources.includes('characters') && resources.includes('maps')) {
    const now = Date.now()
    const characters = useCharacterStore.getState()
    const maps = useMapStore.getState()
    await browserSharedRoomService.saveSharedResourcesAtomically([
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
 * names the caster's current concentration.
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
  if (!effect) {
    return { status: 'invalid', map: input.map, characters: [...input.characters] }
  }
  const removal = removeDnd5eSpellEffectFromMap(input.map, token.id)
  if (!removal) {
    return { status: 'invalid', map: input.map, characters: [...input.characters] }
  }

  const concentrationId = effect.concentrationId
  const exactPersistentSpellRelation = !!concentrationId &&
    removal.removedAreas.some((area) =>
      area.sourceKind === 'core-spell' &&
      area.coreSpellId === effect.spellId &&
      area.sourceCharacterId === effect.sourceCharacterId &&
      area.sourceTokenId === effect.sourceTokenId &&
      area.anchorMode === 'effect-token' &&
      area.anchorTokenId === token.id &&
      area.concentrationId === concentrationId,
    )
  if (!exactPersistentSpellRelation) {
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

    const maxHp = token?.dnd5eSimulacrum
      ? token.dnd5eSimulacrum.maximumHitPoints
      : Math.max(1, Math.floor(command.maxHp))
    const currentHp = Math.max(0, Math.min(maxHp, Math.floor(command.currentHp)))
    const temporaryHp = Math.max(0, Math.floor(
      command.temporaryHp ?? character?.tempHp ?? token?.dnd5eCombatState?.temporaryHp ?? 0,
    ))
    const previousCharacter = command.optimisticEdit?.previousCharacter ?? (character ? structuredClone(character) : undefined)
    const previousToken = command.optimisticEdit?.previousToken ?? (token ? structuredClone(token) : undefined)
    if (!command.optimisticEdit) {
      const characterDamageState = character
        ? manualDamageActiveEffectPatch({
            previousHitPoints: character.currentHp,
            currentHitPoints: currentHp,
            manuallySetMaximum: command.manuallySetMaximum,
            combatState: character.dnd5eCombatState,
          })
        : undefined
      const tokenDamageState = !character && token
        ? manualDamageActiveEffectPatch({
            previousHitPoints: token.hp ?? token.maxHp ?? maxHp,
            currentHitPoints: currentHp,
            manuallySetMaximum: command.manuallySetMaximum,
            combatState: token.dnd5eCombatState,
          })
        : undefined
      if (character) {
        characterState.applyAuthorityUpdate(character.id, {
          currentHp,
          maxHp,
          tempHp: temporaryHp,
          ...(characterDamageState ? {
            dnd5eCombatState: characterDamageState,
            conditions: dnd5eConditionsFromActiveEffects(characterDamageState.activeEffects),
          } : {}),
          ...(command.manuallySetMaximum && character.rulesetId === 'dnd5e-2014-srd-5.1'
            ? { hitPointMaximumMode: 'manual', hitPointRolls: undefined }
            : {}),
        }, { protectHitPointsUntilAcknowledged: true })
      }
      if (map && token) {
        if (token.dnd5eSimulacrum && currentHp === 0) {
          mapState.applyAuthorityMapUpdate(map.id, {
            tokens: map.tokens.filter((candidate) => candidate.id !== token.id),
          })
        } else {
          mapState.applyAuthorityTokenUpdate(
            map.id,
            token.id,
            {
              hp: currentHp,
              maxHp,
              ...(!character ? {
              dnd5eCombatState: {
                ...(token.dnd5eCombatState ?? {}),
                temporaryHp,
                ...(tokenDamageState ? {
                  activeEffects: tokenDamageState.activeEffects,
                  conditions: dnd5eConditionsFromActiveEffects(tokenDamageState.activeEffects),
                } : {}),
              },
              } : {}),
            },
            { protectHitPointsUntilAcknowledged: true },
          )
        }
      }
    }
    if (command.optimisticEdit && map && token?.dnd5eSimulacrum && currentHp === 0) {
      mapState.applyAuthorityMapUpdate(map.id, {
        tokens: map.tokens.filter((candidate) => candidate.id !== token.id),
      })
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
        if (map && previousToken) {
          const latestMap = mapState.maps.find((candidate) => candidate.id === map.id)
          if (latestMap && !latestMap.tokens.some((candidate) => candidate.id === previousToken.id)) {
            mapState.applyAuthorityMapUpdate(map.id, { tokens: [...latestMap.tokens, previousToken] })
          } else {
            mapState.applyAuthorityTokenUpdate(map.id, previousToken.id, previousToken)
          }
        }
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
    const currentActiveEffects = normalizeDnd5eActiveEffects(
      character?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects,
    )
    const sourceCreatureTypesByActorId = Object.fromEntries(map.tokens.map((sourceToken) => {
      const sourceCharacter = sourceToken.characterId
        ? characterState.characters.find((candidate) => candidate.id === sourceToken.characterId)
        : undefined
      return [
        sourceToken.id,
        dnd5eConditionSourceCreatureTypes(sourceToken, sourceCharacter),
      ]
    }))
    const immunityBlocks = dnd5eIncomingConditionImmunityBlocks({
      currentEffects: currentActiveEffects,
      nextEffects: activeEffects,
      conditionImmunities: token.poolId
        ? getDnd5eSrdMonster(token.poolId)?.conditionImmunities ?? []
        : [],
      sourceCreatureTypesByActorId,
    })
    if (immunityBlocks.length > 0) {
      const block = immunityBlocks[0]
      const sourceLabel = block.sourceCreatureTypes.length > 0
        ? `来自${block.sourceCreatureTypes.join('、')}的`
        : ''
      return {
        status: 'rejected',
        message: `目标现有防护使其免疫${sourceLabel}${dnd5eConditionLabel(block.condition)}。`,
      }
    }
    const conditions = dnd5eConditionsFromActiveEffects(activeEffects)
    const retainedEffectIds = new Set(activeEffects.map((effect) => effect.id))
    const removedEffectIds = currentActiveEffects
      .filter((effect) => !retainedEffectIds.has(effect.id))
      .map((effect) => effect.id)
    let maximumReductionLedger = normalizeDnd5eHitPointMaximumReductionLedger(
      character?.dnd5eCombatState?.hitPointMaximumReductionLedger ??
        token.dnd5eCombatState?.hitPointMaximumReductionLedger,
    )
    let restoredMaximum: number | undefined
    for (const effectId of removedEffectIds) {
      const recovery = recoverDnd5eHitPointMaximumReductionsForEffect(
        maximumReductionLedger,
        effectId,
      )
      maximumReductionLedger = recovery.ledger
      if (recovery.maximum != null) restoredMaximum = recovery.maximum
    }
    const previousCharacter = character ? structuredClone(character) : undefined
    const previousToken = structuredClone(token)
    if (character) {
      characterState.applyAuthorityUpdate(character.id, {
        conditions,
        ...(restoredMaximum == null
          ? {}
          : {
              maxHp: restoredMaximum,
              currentHp: Math.min(character.currentHp, restoredMaximum),
            }),
        dnd5eCombatState: {
          ...(character.dnd5eCombatState ?? {}),
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
          hitPointMaximumReductionLedger: maximumReductionLedger,
        },
      })
      // Linked characters and their map tokens are both inputs to the combat
      // snapshot. Keep the token's mirrored effect state authoritative too:
      // otherwise a direct DM removal only clears the character sheet while a
      // stale token effect continues to affect targeting and Headless rules.
      mapState.applyAuthorityTokenUpdate(map.id, token.id, {
        ...(restoredMaximum == null
          ? {}
          : {
              maxHp: restoredMaximum,
              hp: Math.min(token.hp ?? restoredMaximum, restoredMaximum),
            }),
        dnd5eCombatState: {
          ...(token.dnd5eCombatState ?? {}),
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          conditions: conditions.length > 0 ? conditions : undefined,
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
          hitPointMaximumReductionLedger: maximumReductionLedger,
        },
      })
    } else {
      mapState.applyAuthorityTokenUpdate(map.id, token.id, {
        ...(restoredMaximum == null
          ? {}
          : {
              maxHp: restoredMaximum,
              hp: Math.min(token.hp ?? restoredMaximum, restoredMaximum),
            }),
        dnd5eCombatState: {
          ...(token.dnd5eCombatState ?? {}),
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          conditions: conditions.length > 0 ? conditions : undefined,
          activeEffects: activeEffects.length > 0 ? activeEffects : undefined,
          hitPointMaximumReductionLedger: maximumReductionLedger,
        },
      })
    }
    try {
      await persistRoomStores(character ? ['characters', 'maps'] : ['maps'])
      return { status: 'applied' }
    } catch (error) {
      if (previousCharacter) {
        characterState.applyAuthorityUpdate(previousCharacter.id, previousCharacter)
      }
      mapState.applyAuthorityTokenUpdate(map.id, previousToken.id, previousToken)
      throw error
    }
  }

  if (command.type === 'combat.concentration.end') {
    if (!directDmMutationAllowed()) {
      return { status: 'rejected', message: '玩家只能结束自己角色的专注。' }
    }
    const characterState = useCharacterStore.getState()
    const mapState = useMapStore.getState()
    const previousCharacters = structuredClone(characterState.characters)
    const previousMaps = structuredClone(mapState.maps)
    const plan = planRoomConcentrationEnd({
      maps: mapState.maps,
      characters: characterState.characters,
      mapId: command.mapId,
      tokenId: command.tokenId,
      characterId: command.characterId,
      expectedConcentrationId: command.expectedConcentrationId,
    })
    // A repeated click after the first command committed is an idempotent no-op.
    if (plan.status === 'missing') return { status: 'applied' }
    if (plan.status === 'stale') {
      return { status: 'rejected', message: '该角色已经开始维持另一项专注；旧窗口未执行删除。' }
    }
    useCharacterStore.setState({ characters: plan.characters })
    useMapStore.setState({ maps: plan.maps })
    try {
      await persistRoomStores(['characters', 'maps'])
      return { status: 'applied' }
    } catch (error) {
      useCharacterStore.setState({ characters: previousCharacters })
      useMapStore.setState({ maps: previousMaps })
      await Promise.allSettled([
        characterState.loadShared(),
        mapState.loadShared(),
      ])
      throw error
    }
  }

  if (command.type === 'combat.monster-berserk.set' || command.type === 'combat.monster-runtime-status.set') {
    if (!directDmMutationAllowed()) {
      return { status: 'rejected', message: '只有 DM 可以直接调整怪物专属状态。' }
    }
    const characterState = useCharacterStore.getState()
    const mapState = useMapStore.getState()
    const map = mapState.maps.find((candidate) => candidate.id === command.mapId)
    const token = map?.tokens.find((candidate) => candidate.id === command.tokenId)
    if (!map || !token || token.type !== 'enemy') {
      return { status: 'rejected', message: '找不到待调整状态的怪物。' }
    }
    const character = token.characterId
      ? characterState.characters.find((candidate) => candidate.id === token.characterId)
      : undefined
    if (token.characterId && !character) {
      return { status: 'rejected', message: '怪物关联角色数据已经失效。' }
    }
    const statusId: Dnd5eMonsterRuntimeStatusId = command.type === 'combat.monster-berserk.set'
      ? 'monster-berserk'
      : command.statusId
    const monster = token.poolId ? getDnd5eSrdMonster(token.poolId) : undefined
    if (!dnd5eMonsterRuntimeStatusCapabilities(monster).some((status) => status.id === statusId)) {
      return { status: 'rejected', message: '该怪物没有声明这个专属状态，不能写入其 Headless 数据。' }
    }
    const requestedSourceActorId = command.type === 'combat.monster-runtime-status.set'
      ? command.sourceActorId
      : undefined
    if (requestedSourceActorId && !map.tokens.some((candidate) => candidate.id === requestedSourceActorId)) {
      return { status: 'rejected', message: '专属状态的来源生物不在当前地图。' }
    }

    const previousCharacter = character ? structuredClone(character) : undefined
    const previousToken = structuredClone(token)
    const previousState = character?.dnd5eCombatState ?? token.dnd5eCombatState
    const nextState = {
      ...(previousState ?? {}),
      schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
      ...(statusId === 'monster-berserk'
        ? { monsterBerserk: command.active ? true : undefined }
        : statusId === 'monster-damage-aversion'
          ? {
            monsterDamageAversionActive: command.active ? true : undefined,
            monsterDamageAversionSourceActorId: command.active ? requestedSourceActorId : undefined,
          }
          : {
              monsterRegenerationSuppressedDamageTypes: command.active
                ? monster?.traits.flatMap((trait) => trait.rule?.kind === 'regeneration'
                  ? trait.rule.suppressedByDamageTypes
                  : [])
                : undefined,
            }),
    }
    if (character) {
      characterState.applyAuthorityUpdate(character.id, { dnd5eCombatState: nextState })
    } else {
      mapState.applyAuthorityTokenUpdate(map.id, token.id, { dnd5eCombatState: nextState })
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
    state.applyAuthorityUpdate(character.id, command.patch, {
      protectClassChoicesUntilAcknowledged: true,
    })
    try {
      await persistRoomStores(['characters'])
      return { status: 'applied' }
    } catch (error) {
      state.applyAuthorityUpdate(previous.id, previous)
      throw error
    }
  }

  if (command.type === 'character.spell-slot.set') {
    const state = useCharacterStore.getState()
    const character = state.characters.find((candidate) => candidate.id === command.characterId)
    if (!character || !characterMutationAllowed(character)) {
      return { status: 'rejected', message: '当前成员无权修改该角色的法术位。' }
    }
    if (!isEditableDnd5eSpellSlotResourceKey(command.resourceKey)) {
      return { status: 'rejected', message: '该资源不是可手动调整的法术位。' }
    }
    const resource = getClassResource(character, command.resourceKey)
    if (!resource || resource.max < 1) {
      return { status: 'rejected', message: '该角色没有对应法术位。' }
    }
    if (!Number.isSafeInteger(command.current) || command.current < 0 || command.current > resource.max) {
      return { status: 'rejected', message: `法术位必须是 0 到 ${resource.max} 之间的整数。` }
    }
    const previous = structuredClone(character)
    state.applyAuthorityUpdate(character.id, {
      classResources: {
        ...(character.classResources ?? {}),
        [command.resourceKey]: { current: command.current, max: resource.max },
      },
    }, { protectClassResourcesUntilAcknowledged: true })
    try {
      await persistRoomStores(['characters'])
      return { status: 'applied' }
    } catch (error) {
      state.applyAuthorityUpdate(previous.id, previous)
      throw error
    }
  }

  if (command.type === 'character.class-resources.spend') {
    const state = useCharacterStore.getState()
    const character = state.characters.find((candidate) => candidate.id === command.characterId)
    if (!character || !characterMutationAllowed(character)) {
      return { status: 'rejected', message: '当前成员无权消耗该角色的资源。' }
    }
    if (
      !Array.isArray(command.costs) || command.costs.length < 1 || command.costs.length > 16 ||
      command.costs.some((cost) => !cost.resourceKey.trim() ||
        !Number.isSafeInteger(cost.amount) || cost.amount < 1 || cost.amount > 1_000_000) ||
      new Set(command.costs.map((cost) => cost.resourceKey)).size !== command.costs.length
    ) return { status: 'rejected', message: '资源消耗配置无效。' }
    let resolved: Character | null = character
    for (const cost of command.costs) {
      if (!resolved) break
      if (cost.resourceKey === DND5E_CORE_INSPIRATION_RESOURCE_KEY) {
        const currentInspiration: number = Number.isSafeInteger(resolved.inspiration)
          ? Math.max(0, resolved.inspiration)
          : 0
        resolved = currentInspiration >= cost.amount
          ? { ...resolved, inspiration: currentInspiration - cost.amount }
          : null
        continue
      }
      resolved = spendClassResource(resolved, cost.resourceKey, cost.amount)
    }
    if (!resolved) return { status: 'rejected', message: '角色资源不足或资源不存在。' }
    const previous = structuredClone(character)
    state.applyAuthorityUpdate(character.id, {
      classResources: resolved.classResources,
      inspiration: resolved.inspiration,
    }, { protectClassResourcesUntilAcknowledged: true })
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
    const state = useCharacterStore.getState()
    const previousCharacters = structuredClone(state.characters)
    const inventory = state.applyInventoryMutation(command.mutation)
    if (inventory.ok) {
      try {
        // A DM grant is authoritative as soon as the UI reports success.  The
        // inventory store's ordinary debounced save is not sufficient here:
        // another room snapshot can arrive first and erase the just-granted
        // material while the success notice is still visible.
        await persistRoomStores(['characters'])
      } catch (error) {
        useCharacterStore.setState({ characters: previousCharacters })
        throw error
      }
    }
    return {
      status: inventory.ok ? 'applied' : 'rejected',
      message: inventory.message,
      inventory,
    }
  }
  const submitted = await submitDnd5eInventoryMutation(command.mutation)
  return {
    status: submitted.status,
    message: submitted.message,
    inventory: submitted.result,
  }
}

export const appRoomCommandBus = new RoomCommandBus<AppRoomCommand, AppRoomCommandResult>(
  (command) => appRoomAuthorityScheduler.run(command.id, () => handleAppRoomCommand(command)),
  { telemetry: browserRoomCommandTelemetry },
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

  const maxHp = token?.dnd5eSimulacrum
    ? token.dnd5eSimulacrum.maximumHitPoints
    : Math.max(1, Math.floor(input.maxHp))
  const currentHp = Math.max(0, Math.min(maxHp, Math.floor(input.currentHp)))
  const temporaryHp = Math.max(0, Math.floor(
    input.temporaryHp ?? character?.tempHp ?? token?.dnd5eCombatState?.temporaryHp ?? 0,
  ))
  const optimisticKey = hitPointEditKey(aggregateTarget)
  const optimisticEdit: OptimisticHitPointEdit = {
    key: optimisticKey,
    revision: ++hitPointEditRevision,
    previousCharacter: character ? structuredClone(character) : undefined,
    previousToken: token ? structuredClone(token) : undefined,
  }
  latestHitPointEditRevisionByKey.set(optimisticKey, optimisticEdit.revision)

  const characterDamageState = character
    ? manualDamageActiveEffectPatch({
        previousHitPoints: character.currentHp,
        currentHitPoints: currentHp,
        manuallySetMaximum: input.manuallySetMaximum,
        combatState: character.dnd5eCombatState,
      })
    : undefined
  const tokenDamageState = !character && token
    ? manualDamageActiveEffectPatch({
        previousHitPoints: token.hp ?? token.maxHp ?? maxHp,
        currentHitPoints: currentHp,
        manuallySetMaximum: input.manuallySetMaximum,
        combatState: token.dnd5eCombatState,
      })
    : undefined

  if (character) {
    characterState.applyAuthorityUpdate(character.id, {
      currentHp,
      maxHp,
      tempHp: temporaryHp,
      ...(characterDamageState ? {
        dnd5eCombatState: characterDamageState,
        conditions: dnd5eConditionsFromActiveEffects(characterDamageState.activeEffects),
      } : {}),
      ...(input.manuallySetMaximum && character.rulesetId === 'dnd5e-2014-srd-5.1'
        ? { hitPointMaximumMode: 'manual', hitPointRolls: undefined }
        : {}),
    }, { protectHitPointsUntilAcknowledged: true })
  }
  if (map && token) {
    mapState.applyAuthorityTokenUpdate(
      map.id,
      token.id,
      {
        hp: currentHp,
        maxHp,
        ...(!character ? {
          dnd5eCombatState: {
            ...(token.dnd5eCombatState ?? {}),
            temporaryHp,
            ...(tokenDamageState ? {
              activeEffects: tokenDamageState.activeEffects,
              conditions: dnd5eConditionsFromActiveEffects(tokenDamageState.activeEffects),
            } : {}),
          },
        } : {}),
      },
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

export function endRoomConcentration(input: {
  characterId?: string
  mapId: string
  tokenId: string
  expectedConcentrationId: string
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [input.characterId, linkedCharacterIdForToken(input.mapId, input.tokenId)],
    mapId: input.mapId,
    tokenId: input.tokenId,
    fallback: 'room:invalid:concentration-end',
  })
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('end-concentration'),
    type: 'combat.concentration.end',
    ...aggregateTarget,
    issuedAt: Date.now(),
  })
}

export function setRoomMonsterBerserk(input: {
  mapId: string
  tokenId: string
  active: boolean
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [linkedCharacterIdForToken(input.mapId, input.tokenId)],
    mapId: input.mapId,
    tokenId: input.tokenId,
    fallback: 'room:invalid:monster-berserk',
  })
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('monster-berserk'),
    type: 'combat.monster-berserk.set',
    ...aggregateTarget,
    issuedAt: Date.now(),
  })
}

export interface RoomConcentrationEndPlan {
  status: 'missing' | 'stale' | 'ended'
  maps: BattleMap[]
  characters: Character[]
  endedConcentrationId?: string
  removedEffectIds: string[]
}

const DND5E_CREATURE_FORM_STATE_KEYS = [
  'wildShapeFormId',
  'wildShapeMode',
  'wildShapeSourceActorId',
  'wildShapeSourceActivityId',
  'wildShapeMaximumChallengeRating',
  'wildShapeMaximumSizeRank',
  'shapechangeEquipmentDisposition',
  'wildShapeCurrentHp',
  'wildShapeRoundsRemaining',
  'wildShapePermanent',
  'wildShapePermanentAfterConcentrationCompletes',
  'wildShapeOriginalCurrentHp',
  'wildShapeOriginalMaxHp',
  'wildShapeOriginalArmorClass',
  'wildShapeOriginalSpeed',
  'wildShapeOriginalMovementSpeeds',
  'wildShapeOriginalSizeRank',
  'wildShapeOriginalAbilities',
  'wildShapeOriginalSavingThrowBonuses',
  'wildShapeOriginalSavingThrowProficiencies',
  'wildShapeOriginalSkillProficiencies',
  'wildShapeOriginalPassivePerception',
  'wildShapeOriginalStatBlockId',
  'wildShapeOriginalCreatureType',
  'wildShapeOriginalDamageVulnerabilities',
  'wildShapeOriginalDamageResistances',
  'wildShapeOriginalDamageImmunities',
  'wildShapeOriginalDamageDefenseRules',
  'wildShapeOriginalMagicResistance',
  'wildShapeOriginalLimitedMagicImmunity',
  'wildShapeOriginalWeaponAttacksMagical',
  'wildShapeOriginalConditionImmunities',
] as const

type RoomCombatState = NonNullable<Character['dnd5eCombatState'] | Token['dnd5eCombatState']>

function concentrationLinkedCreatureForm(
  state: Character['dnd5eCombatState'] | Token['dnd5eCombatState'],
  sourceActorIds: ReadonlySet<string>,
): state is RoomCombatState {
  return !!state?.wildShapeFormId &&
    state.wildShapeMode !== 'wild-shape' &&
    !!state.wildShapeSourceActorId &&
    sourceActorIds.has(state.wildShapeSourceActorId)
}

function clearConcentrationLinkedCreatureForm<T extends RoomCombatState>(state: T): T {
  const next = { ...state }
  for (const key of DND5E_CREATURE_FORM_STATE_KEYS) delete next[key]
  return next
}

function tokenSizeForDnd5eSizeRank(sizeRank: number | undefined): number | undefined {
  if (!Number.isFinite(sizeRank)) return undefined
  return [1, 1, 1, 2, 3, 4][Math.max(0, Math.min(5, Math.floor(sizeRank!)))]
}

function concentrationIdentity(character: Character | undefined, token: Token): string | undefined {
  const structured = (
    character?.dnd5eCombatState?.concentrationSpellId ??
    token.dnd5eCombatState?.concentrationSpellId
  )?.trim()
  if (structured) return structured
  return character?.concentrating === true ? 'manual-concentration' : undefined
}

/**
 * Ends one exact concentration instance and every source-linked projection in
 * the same room snapshot. The expected id prevents a delayed click from
 * deleting a newer spell that replaced the badge while the dialog was open.
 */
export function planRoomConcentrationEnd(input: {
  maps: readonly BattleMap[]
  characters: readonly Character[]
  mapId: string
  tokenId: string
  characterId?: string
  expectedConcentrationId: string
}): RoomConcentrationEndPlan {
  const sourceMap = input.maps.find((candidate) => candidate.id === input.mapId)
  const sourceToken = sourceMap?.tokens.find((candidate) => candidate.id === input.tokenId)
  if (!sourceMap || !sourceToken) {
    return {
      status: 'missing',
      maps: [...input.maps],
      characters: [...input.characters],
      removedEffectIds: [],
    }
  }
  const sourceCharacterId = input.characterId ?? sourceToken.characterId
  const sourceCharacter = sourceCharacterId
    ? input.characters.find((candidate) => candidate.id === sourceCharacterId)
    : undefined
  const currentConcentrationId = concentrationIdentity(sourceCharacter, sourceToken)
  if (!currentConcentrationId) {
    return {
      status: 'missing',
      maps: [...input.maps],
      characters: [...input.characters],
      removedEffectIds: [],
    }
  }
  if (currentConcentrationId !== input.expectedConcentrationId) {
    return {
      status: 'stale',
      maps: [...input.maps],
      characters: [...input.characters],
      endedConcentrationId: currentConcentrationId,
      removedEffectIds: [],
    }
  }

  const sourceActorIds = new Set<string>([
    sourceToken.id,
    ...(sourceCharacterId ? [sourceCharacterId] : []),
    ...input.maps.flatMap((map) => map.tokens
      .filter((token) => !!sourceCharacterId && token.characterId === sourceCharacterId)
      .map((token) => token.id)),
  ])
  const isMatchingConcentrationEffect = (effect: Dnd5eActiveEffectInstance) =>
    effect.duration.type === 'concentration' &&
    sourceActorIds.has(effect.duration.sourceActorId) &&
    (
      currentConcentrationId === 'manual-concentration' ||
      !effect.duration.concentrationId ||
      effect.duration.concentrationId === currentConcentrationId
    )
  const removedEffectIds: string[] = []
  const clearLinkedCombatState = <T extends Character['dnd5eCombatState'] | Token['dnd5eCombatState']>(
    state: T,
    endOwnConcentration: boolean,
  ): T => {
    if (!state) return state
    const endsCreatureForm = concentrationLinkedCreatureForm(state, sourceActorIds)
    const activeEffects = normalizeDnd5eActiveEffects(state.activeEffects)
    const remainingEffects = activeEffects.filter((effect) => {
      const remove = isMatchingConcentrationEffect(effect)
      if (remove) removedEffectIds.push(effect.id)
      return !remove
    })
    const effectsChanged = remainingEffects.length !== activeEffects.length
    const concentrationEffectsBySource = Object.fromEntries(
      Object.entries(state.concentrationEffectsBySource ?? {})
        .filter(([actorId]) => !sourceActorIds.has(actorId)),
    )
    const sourceLinksChanged = Object.keys(concentrationEffectsBySource).length !==
      Object.keys(state.concentrationEffectsBySource ?? {}).length
    if (!effectsChanged && !sourceLinksChanged && !endOwnConcentration && !endsCreatureForm) return state
    const nextState = {
      ...state,
      ...(effectsChanged
        ? {
            activeEffects: remainingEffects.length > 0 ? remainingEffects : undefined,
            conditions: remainingEffects.length > 0
              ? dnd5eConditionsFromActiveEffects(remainingEffects)
              : undefined,
          }
        : {}),
      ...(sourceLinksChanged
        ? {
            concentrationEffectsBySource: Object.keys(concentrationEffectsBySource).length > 0
              ? concentrationEffectsBySource
              : undefined,
          }
        : {}),
      ...(endOwnConcentration
        ? {
            concentrationSpellId: undefined,
            concentrationSpellLevel: undefined,
            concentrationTargetIds: undefined,
            concentrationRoundsRemaining: undefined,
            concentrationStartedTurnKey: undefined,
            huntersMarkTargetId: undefined,
          }
        : {}),
    } as RoomCombatState
    return (endsCreatureForm
      ? clearConcentrationLinkedCreatureForm(nextState)
      : nextState) as T
  }

  const revertedCharacterForms = new Map<string, {
    currentHp: number
    maxHp: number
    size: number | undefined
  }>()
  const nextCharacters = input.characters.map((character) => {
    const endsOwn = character.id === sourceCharacterId
    const previousState = character.dnd5eCombatState
    if (concentrationLinkedCreatureForm(previousState, sourceActorIds)) {
      revertedCharacterForms.set(character.id, {
        // Character persistence deliberately retains the original body's HP
        // while the form pool lives in wildShapeCurrentHp.
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        size: tokenSizeForDnd5eSizeRank(previousState.wildShapeOriginalSizeRank),
      })
    }
    const nextState = clearLinkedCombatState(previousState, endsOwn)
    if (!endsOwn && nextState === previousState) return character
    return {
      ...character,
      ...(endsOwn ? { concentrating: false } : {}),
      ...(nextState !== previousState && nextState
        ? { conditions: dnd5eConditionsFromActiveEffects(nextState.activeEffects) }
        : {}),
      dnd5eCombatState: nextState,
    }
  })

  const entityMatches = (entity: {
    sourceCharacterId?: string
    sourceTokenId?: string
    concentrationId?: string
  }) => (
    !!entity.concentrationId &&
    (sourceActorIds.has(entity.sourceTokenId ?? '') ||
      (!!sourceCharacterId && entity.sourceCharacterId === sourceCharacterId)) &&
    (currentConcentrationId === 'manual-concentration' || entity.concentrationId === currentConcentrationId)
  )
  const nextMaps = input.maps.map((map) => {
    const removedAreas = (map.dnd5ePluginAreas ?? []).filter(entityMatches)
    const removedAreaAnchorIds = new Set(removedAreas.flatMap((area) =>
      area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : []))
    const dnd5ePluginAreas = (map.dnd5ePluginAreas ?? []).filter((area) => !entityMatches(area))
    const tokens = map.tokens.flatMap((token) => {
      if (removedAreaAnchorIds.has(token.id) || (token.dnd5eSpellEffect && entityMatches(token.dnd5eSpellEffect))) {
        return []
      }
      if (token.dnd5eSummon && entityMatches(token.dnd5eSummon)) {
        if (token.dnd5eSummon.becomesHostileAfterConcentrationEnds === true) {
          return [{
            ...token,
            dnd5eSummon: {
              ...token.dnd5eSummon,
              concentrationId: undefined,
              becomesHostileAfterConcentrationEnds: undefined,
              side: token.dnd5eSummon.side === 'player' ? 'enemy' as const : 'player' as const,
              controlEnded: true as const,
            },
          }]
        }
        const restored = dnd5eRestoredSummonedOriginalObject(token)
        return restored ? [restored] : []
      }
      const tokenOwnConcentrationId = token.dnd5eCombatState?.concentrationSpellId?.trim()
      const endsOwn = sourceActorIds.has(token.id) && (
        token.characterId === sourceCharacterId ||
        tokenOwnConcentrationId === currentConcentrationId ||
        (currentConcentrationId === 'manual-concentration' && !tokenOwnConcentrationId)
      )
      const previousState = token.dnd5eCombatState
      const linkedCharacterReversion = token.characterId
        ? revertedCharacterForms.get(token.characterId)
        : undefined
      const tokenCreatureFormReversion = concentrationLinkedCreatureForm(previousState, sourceActorIds)
        ? {
            currentHp: previousState.wildShapeOriginalCurrentHp,
            maxHp: previousState.wildShapeOriginalMaxHp,
            size: tokenSizeForDnd5eSizeRank(previousState.wildShapeOriginalSizeRank),
            formId: previousState.wildShapeFormId,
            originalStatBlockId: previousState.wildShapeOriginalStatBlockId,
          }
        : undefined
      const nextState = clearLinkedCombatState(previousState, endsOwn)
      const reversion = linkedCharacterReversion ?? tokenCreatureFormReversion
      const currentForm = tokenCreatureFormReversion?.formId
        ? getDnd5eSrdMonster(tokenCreatureFormReversion.formId)
        : undefined
      const originalForm = tokenCreatureFormReversion?.originalStatBlockId
        ? getDnd5eSrdMonster(tokenCreatureFormReversion.originalStatBlockId)
        : undefined
      return nextState === previousState && !reversion
        ? [token]
        : [{
            ...token,
            ...(reversion?.currentHp != null ? { hp: reversion.currentHp } : {}),
            ...(reversion?.maxHp != null ? { maxHp: reversion.maxHp } : {}),
            ...(reversion?.size != null ? { size: reversion.size } : {}),
            ...(tokenCreatureFormReversion
              ? {
                  poolId: tokenCreatureFormReversion.originalStatBlockId,
                  ...(currentForm && originalForm && token.label === currentForm.name
                    ? { label: originalForm.name }
                    : {}),
                }
              : {}),
            ...(nextState !== previousState ? { dnd5eCombatState: nextState } : {}),
          }]
    })
    const areasChanged = dnd5ePluginAreas.length !== (map.dnd5ePluginAreas ?? []).length
    const tokensChanged = tokens.length !== map.tokens.length ||
      tokens.some((token, index) => token !== map.tokens[index])
    return !areasChanged && !tokensChanged
      ? map
      : {
          ...map,
          tokens,
          dnd5ePluginAreas: dnd5ePluginAreas.length > 0 ? dnd5ePluginAreas : undefined,
        }
  })

  return {
    status: 'ended',
    maps: nextMaps,
    characters: nextCharacters,
    endedConcentrationId: currentConcentrationId,
    removedEffectIds: [...new Set(removedEffectIds)],
  }
}

export function setRoomMonsterRuntimeStatus(input: {
  mapId: string
  tokenId: string
  statusId: Dnd5eMonsterRuntimeStatusId
  active: boolean
  sourceActorId?: string
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [linkedCharacterIdForToken(input.mapId, input.tokenId)],
    mapId: input.mapId,
    tokenIds: [input.tokenId, input.sourceActorId],
    fallback: 'room:invalid:monster-runtime-status',
  })
  return appRoomCommandBus.dispatch({
    ...input,
    id: commandId('monster-runtime-status'),
    type: 'combat.monster-runtime-status.set',
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

export function setRoomCharacterSpellSlot(input: {
  characterId: string
  resourceKey: string
  current: number
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [input.characterId],
    fallback: 'room:invalid:spell-slot',
  })
  return appRoomCommandBus.dispatchLatest({
    ...input,
    id: commandId('spell-slot'),
    type: 'character.spell-slot.set',
    ...aggregateTarget,
    issuedAt: Date.now(),
  }, `spell-slot:${input.characterId}:${input.resourceKey}`)
}

export function spendRoomCharacterClassResources(input: {
  characterId: string
  costs: readonly { resourceKey: string; amount: number }[]
  transactionId: string
}): Promise<AppRoomCommandResult> {
  const aggregateTarget = roomCommandAggregateTarget({
    characterIds: [input.characterId],
    fallback: 'room:invalid:class-resources-spend',
  })
  return appRoomCommandBus.dispatch({
    id: `class-resource-spend:${input.transactionId}`,
    type: 'character.class-resources.spend',
    ...aggregateTarget,
    issuedAt: Date.now(),
    characterId: input.characterId,
    costs: input.costs.map((cost) => ({ ...cost })),
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
