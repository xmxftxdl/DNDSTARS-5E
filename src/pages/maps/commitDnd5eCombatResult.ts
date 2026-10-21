import type { Dnd5eMapResultPlan } from '../../rulesets/dnd5e'
import type { Character } from '../../types/character'
import type { BattleMap, Token } from '../../store/maps'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'
import { expireDnd5eSourceBoundInventoryRoster } from '../../rulesets/dnd5e/items'
import {
  compensateDnd5eCompletedLongCastEffects,
  reconcileDnd5eCharacterCampaignTime,
} from '../../rulesets/dnd5e/campaignTimeRules'

export interface Dnd5eCombatResultCommitReceipt {
  mapId: string
  characterIds: readonly string[]
  tokenIds: readonly string[]
}

interface Dnd5eCombatResultApplicationPort {
  application: Dnd5eMapResultPlan
  mapId: string
  applyCharacter: (characterId: string, character: Character, patch?: Partial<Character>) => void
  applyToken: (mapId: string, tokenId: string, token: Token, patch?: Partial<Token>) => void
  /**
   * 地图级事务（召唤、持续区域）使用单次完整地图提交，避免先写 Token、
   * 再写区域时被同步读取到半完成状态。调用方必须先把结果重基线到最新地图。
   */
  applyMap?: (mapId: string, map: BattleMap) => void
  applicationMode?: 'entities' | 'map'
  applySpentReaction?: (tokenId: string, round: number) => void
}

interface Dnd5eCombatResultCommitInput extends Dnd5eCombatResultApplicationPort {
  saveCharacters?: () => Promise<unknown>
  saveMap?: () => Promise<unknown>
  saveAll?: (receipt: Dnd5eCombatResultCommitReceipt) => Promise<unknown>
  /** 区域、召唤等地图级字段变化不一定包含 changedTokenIds。 */
  forceSaveCharacters?: boolean
  forceSaveMap?: boolean
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

/**
 * Adds a non-Headless authoritative field (for example an inventory reward) to
 * an existing Headless application. Merely replacing `application.characters`
 * is not sufficient: entity commits deliberately apply `characterPatches`
 * when present so stale combat snapshots cannot overwrite newer sheet data.
 */
export function mergeDnd5eCharacterPatchIntoResult(
  application: Dnd5eMapResultPlan,
  characterId: string,
  patch: Partial<Character>,
): Dnd5eMapResultPlan {
  const characterIndex = application.characters.findIndex((character) => character.id === characterId)
  if (characterIndex < 0) throw new Error(`combat-result-character-missing:${characterId}`)
  const characters = [...application.characters]
  characters[characterIndex] = { ...characters[characterIndex], ...patch }
  return {
    ...application,
    characters,
    changedCharacterIds: unique([...application.changedCharacterIds, characterId]),
    characterPatches: {
      ...(application.characterPatches ?? {}),
      [characterId]: {
        ...(application.characterPatches?.[characterId] ?? {}),
        ...patch,
      },
    },
  }
}

/** Preserve map-handoff deltas when the entity commit already has Headless patches. */
export function mergeDnd5eMapTokenChangesIntoResult(
  application: Dnd5eMapResultPlan,
  map: BattleMap,
): Dnd5eMapResultPlan {
  if (map.id !== application.map.id) throw new Error('combat-result-map-mismatch')
  const before = new Map(application.map.tokens.map(token => [token.id, token]))
  const tokenPatches = { ...application.tokenPatches }
  const changedTokenIds = new Set(application.changedTokenIds)
  for (const token of map.tokens) {
    const prior = before.get(token.id)
    if (!prior) continue // New entities are committed by the structural map path.
    const patch: Partial<Token> = {}
    for (const key of new Set([...Object.keys(prior), ...Object.keys(token)])) {
      const field = key as keyof Token
      if (JSON.stringify(prior[field]) !== JSON.stringify(token[field])) {
        Object.assign(patch, { [field]: token[field] })
      }
    }
    if (!Object.keys(patch).length) continue
    tokenPatches[token.id] = { ...tokenPatches[token.id], ...patch }
    changedTokenIds.add(token.id)
  }
  return { ...application, map, tokenPatches, changedTokenIds: [...changedTokenIds] }
}

/**
 * Headless transactions carry a full character snapshot, but class choices are
 * durable character-sheet data rather than combat-owned state. A transaction
 * that finishes after the sheet changed must not restore its stale copy (most
 * visibly, a wizard's `spell-prepared` selection).
 */
export function mergeDnd5eCombatCharacterResult(
  current: Character,
  resolved: Character,
  patch?: Partial<Character>,
): Character {
  if (patch) return { ...current, ...patch }
  return {
    ...resolved,
    dnd5eClassChoices: current.dnd5eClassChoices,
    dnd5eRestActivityWindow: current.dnd5eRestActivityWindow,
  }
}

/** Only records established by this completed cast begin at its completion clock. */
export function rebaseDnd5eCompletedBenefitHistoryApplication(
  application: Dnd5eMapResultPlan,
  recordIdsByCharacterId: ReadonlyMap<string, ReadonlySet<string>>,
  recordIdsByTokenId: ReadonlyMap<string, ReadonlySet<string>>,
  completionWorldMinute: number,
): Dnd5eMapResultPlan {
  if (!Number.isSafeInteger(completionWorldMinute) || completionWorldMinute < 0) throw new Error('invalid-benefit-completion-clock')
  const rebase = <T extends { spellAuthorityRecords?: Record<string, import('../../rulesets/dnd5e/spellAuthorityState').Dnd5eSpellAuthorityRecordV1> }>(
    state: T | undefined, selectors: ReadonlySet<string> | undefined,
  ): T | undefined => {
    if (!state?.spellAuthorityRecords || !selectors?.size) return state
    let changed = false
    const records = Object.fromEntries(Object.entries(state.spellAuthorityRecords).map(([id, record]) => {
      if (!selectors.has(id) || record.kind !== 'benefit-history' || record.createdWorldMinute === completionWorldMinute) return [id, record]
      if (record.createdWorldMinute > completionWorldMinute) throw new Error('benefit-completion-clock-before-record')
      changed = true
      return [id, { ...record, createdWorldMinute: completionWorldMinute }]
    }))
    return changed ? { ...state, spellAuthorityRecords: records } : state
  }
  let result = application
  for (const character of application.characters) {
    const selectors = recordIdsByCharacterId.get(character.id)
    const materialized = { ...character, ...application.characterPatches?.[character.id] }
    const state = rebase(materialized.dnd5eCombatState, selectors)
    if (selectors?.size && state !== character.dnd5eCombatState) result = mergeDnd5eCharacterPatchIntoResult(result, character.id, { dnd5eCombatState: state })
  }
  const tokenPatches = { ...result.tokenPatches }
  const changedTokenIds = new Set(result.changedTokenIds)
  let tokenChanged = false
  const tokens = result.map.tokens.map(token => {
    const selectors = recordIdsByTokenId.get(token.id)
    const materialized = { ...token, ...result.tokenPatches?.[token.id] }
    const state = rebase(materialized.dnd5eCombatState, selectors)
    if (!selectors?.size || state === token.dnd5eCombatState) return token
    tokenChanged = true
    changedTokenIds.add(token.id)
    tokenPatches[token.id] = { ...tokenPatches[token.id], dnd5eCombatState: state }
    return { ...materialized, dnd5eCombatState: state }
  })
  return tokenChanged ? { ...result, map: { ...result.map, tokens }, tokenPatches, changedTokenIds: [...changedTokenIds] } : result
}

/**
 * Keeps the full resolved snapshots and their authoritative partial patches in
 * lockstep. Entity-mode commits prefer characterPatches, so compensating only
 * `characters` would silently discard the duration correction at commit time.
 */
export function compensateDnd5eCompletedLongCastApplication(
  application: Dnd5eMapResultPlan,
  effectIdsByCharacterId: ReadonlyMap<string, ReadonlySet<string>>,
  elapsedCastingMinutes: number,
  completionClock: SharedCampaignTimeState,
  completedConcentrationSpellIdByCharacterId: ReadonlyMap<string, string> = new Map(),
  effectIdsByTokenId: ReadonlyMap<string, ReadonlySet<string>> = new Map(),
  ageAllActors = false,
): Dnd5eMapResultPlan {
  if (
    elapsedCastingMinutes < 1 ||
    (
      !ageAllActors && effectIdsByCharacterId.size === 0 &&
      completedConcentrationSpellIdByCharacterId.size === 0 &&
      effectIdsByTokenId.size === 0
    )
  ) return application
  const timedCharacters = application.characters.map((character) => {
    const materialized = application.characterPatches?.[character.id]
      ? { ...character, ...application.characterPatches[character.id] }
      : character
    const compensated = compensateDnd5eCompletedLongCastEffects(
      materialized, [...(effectIdsByCharacterId.get(character.id) ?? [])], elapsedCastingMinutes,
      completedConcentrationSpellIdByCharacterId.get(character.id),
    )
    const reconciled = reconcileDnd5eCharacterCampaignTime(compensated, completionClock).character
    const completedEffectSelectors = effectIdsByCharacterId.get(character.id)
    if (!completedEffectSelectors?.size) return reconciled

    // A completed long-cast effect begins at the completion clock. Duration and
    // body-restoration counters are compensated above before the pre-cast
    // snapshot is reconciled, but periodic healing must also be excluded from
    // the elapsed casting interval. Reconcile a mechanically identical shadow
    // without only the new effects' periodic healing, then retain its HP while
    // preserving the authoritative effects from the normal reconciliation.
    let suppressedPeriodicHealing = false
    const activeEffects = (compensated.dnd5eCombatState?.activeEffects ?? []).map((effect) => {
      if (
        !effect.periodicHealing ||
        (!completedEffectSelectors?.has(effect.id) && !completedEffectSelectors?.has(effect.definitionId))
      ) return effect
      suppressedPeriodicHealing = true
      return { ...effect, periodicHealing: undefined }
    })
    if (!suppressedPeriodicHealing) return reconciled
    const withoutCompletedPeriodicHealing = reconcileDnd5eCharacterCampaignTime({
      ...compensated,
      dnd5eCombatState: {
        ...compensated.dnd5eCombatState,
        activeEffects,
      },
    }, completionClock).character
    return {
      ...reconciled,
      currentHp: withoutCompletedPeriodicHealing.currentHp,
    }
  })
  const characters = expireDnd5eSourceBoundInventoryRoster(timedCharacters)
  const inventoryChanged = characters.filter((character, index) => character !== timedCharacters[index])
  const inventoryPatches = Object.fromEntries(inventoryChanged.map(character => [character.id, {
    dnd5eInventory: character.dnd5eInventory, equipment: character.equipment, dnd5eCombatState: character.dnd5eCombatState,
  }]))
  const compensatedCharacterById = new Map(characters.map((character) => [character.id, character]))
  const characterPatches = application.characterPatches
    ? Object.fromEntries(Object.entries(application.characterPatches).map(([characterId, patch]) => {
        if (
          !effectIdsByCharacterId.has(characterId) &&
          !completedConcentrationSpellIdByCharacterId.has(characterId)
        ) return [characterId, patch]
        const compensated = compensatedCharacterById.get(characterId)
        return [characterId, compensated
          ? {
              ...patch,
              currentHp: compensated.currentHp,
              conditions: compensated.conditions,
              concentrating: compensated.concentrating,
              dnd5eCombatState: compensated.dnd5eCombatState,
              dnd5eWorldTimeAppliedMinute: compensated.dnd5eWorldTimeAppliedMinute,
            }
          : patch]
      }))
    : application.characterPatches

  const compensateToken = (token: Token): Token => {
    const completedEffectSelectors = effectIdsByTokenId.get(token.id)
    if (!completedEffectSelectors?.size && (!ageAllActors || token.characterId)) return token
    const syntheticCharacter = {
      id: token.id,
      name: token.label,
      rulesetId: 'dnd5e-2014-srd-5.1',
      currentHp: token.hp ?? token.maxHp ?? 1,
      maxHp: token.maxHp ?? token.hp ?? 1,
      conditions: token.dnd5eCombatState?.conditions ?? [],
      concentrating: token.dnd5eCombatState?.concentrationSpellId != null,
      dnd5eCombatState: token.dnd5eCombatState,
      dnd5eWorldTimeAppliedMinute: token.dnd5eWorldTimeAppliedMinute,
    } as Character
    const compensated = compensateDnd5eCompletedLongCastEffects(
      syntheticCharacter,
      [...(completedEffectSelectors ?? [])],
      elapsedCastingMinutes,
    )
    let reconciled = reconcileDnd5eCharacterCampaignTime(compensated, completionClock).character

    // As with linked characters, healing granted by a newly completed spell
    // starts at completion and must not tick through its own casting interval.
    let suppressedPeriodicHealing = false
    const activeEffects = (compensated.dnd5eCombatState?.activeEffects ?? []).map((effect) => {
      if (
        !effect.periodicHealing ||
        (!completedEffectSelectors?.has(effect.id) && !completedEffectSelectors?.has(effect.definitionId))
      ) return effect
      suppressedPeriodicHealing = true
      return { ...effect, periodicHealing: undefined }
    })
    if (suppressedPeriodicHealing) {
      const withoutCompletedPeriodicHealing = reconcileDnd5eCharacterCampaignTime({
        ...compensated,
        dnd5eCombatState: {
          ...compensated.dnd5eCombatState,
          activeEffects,
        },
      }, completionClock).character
      reconciled = { ...reconciled, currentHp: withoutCompletedPeriodicHealing.currentHp }
    }
    return {
      ...token,
      hp: token.hp == null ? token.hp : reconciled.currentHp,
      dnd5eCombatState: reconciled.dnd5eCombatState,
      dnd5eWorldTimeAppliedMinute: reconciled.dnd5eWorldTimeAppliedMinute,
    }
  }

  const tokens = application.map.tokens.map((token) => {
    const materialized = application.tokenPatches?.[token.id]
      ? { ...token, ...application.tokenPatches[token.id] }
      : token
    return compensateToken(materialized)
  })
  const compensatedTokenById = new Map(tokens.map((token) => [token.id, token]))
  const tokenPatches = application.tokenPatches
    ? Object.fromEntries(Object.entries(application.tokenPatches).map(([tokenId, patch]) => {
        if (!effectIdsByTokenId.has(tokenId)) return [tokenId, patch]
        const compensated = compensatedTokenById.get(tokenId)
        return [tokenId, compensated
          ? {
              ...patch,
              hp: compensated.hp,
              dnd5eCombatState: compensated.dnd5eCombatState,
              dnd5eWorldTimeAppliedMinute: compensated.dnd5eWorldTimeAppliedMinute,
            }
          : patch]
      }))
    : application.tokenPatches
  return {
    ...application,
    map: { ...application.map, tokens },
    characters,
    changedCharacterIds: unique([...application.changedCharacterIds, ...inventoryChanged.map(character => character.id), ...(ageAllActors ? characters.map(character => character.id) : [])]),
    changedTokenIds: ageAllActors ? unique([...application.changedTokenIds, ...tokens.filter(token => !token.characterId).map(token => token.id)]) : application.changedTokenIds,
    characterPatches: ageAllActors ? Object.fromEntries(characters.map(character => [character.id, { ...characterPatches?.[character.id], ...character }]))
      : inventoryChanged.length ? { ...characterPatches, ...Object.fromEntries(inventoryChanged.map(character => [character.id, { ...characterPatches?.[character.id], ...inventoryPatches[character.id] }])) } : characterPatches,
    tokenPatches: ageAllActors ? Object.fromEntries(tokens.filter(token => !token.characterId || tokenPatches?.[token.id]).map(token => [token.id, { ...tokenPatches?.[token.id], ...token }])) : tokenPatches,
  }
}

function prepareCommit(input: Pick<Dnd5eCombatResultApplicationPort, 'application' | 'mapId' | 'applicationMode'>) {
  if (input.application.map.id !== input.mapId) {
    throw new Error(`combat-result-map-mismatch:${input.application.map.id}:${input.mapId}`)
  }
  const characterIds = unique(input.application.changedCharacterIds)
  const tokenIds = unique(input.application.changedTokenIds)
  const characterById = new Map(input.application.characters.map((character) => [character.id, character]))
  const tokenById = new Map(input.application.map.tokens.map((token) => [token.id, token]))
  const missingCharacterId = characterIds.find((id) => !characterById.has(id))
  if (missingCharacterId) throw new Error(`combat-result-character-missing:${missingCharacterId}`)
  // Entity commits need a resolved snapshot for every patched token. A map
  // commit replaces the full token collection atomically, so a changed token
  // may intentionally be absent (for example an object consumed by True
  // Polymorph or a destroyed map entity).
  const missingTokenId = tokenIds.find((id) => !tokenById.has(id))
  if (missingTokenId && input.applicationMode !== 'map') {
    throw new Error(`combat-result-token-missing:${missingTokenId}`)
  }
  if (new Set(input.application.map.tokens.map((token) => token.id)).size !== input.application.map.tokens.length) {
    throw new Error('combat-result-token-duplicate')
  }
  const spent = input.application.spentReactions
  if (spent && (!Number.isInteger(spent.round) || spent.round < 1 || spent.tokenIds.some(id => !tokenById.has(id)))) {
    throw new Error('combat-result-reaction-receipt-invalid')
  }
  return { characterIds, tokenIds, characterById, tokenById }
}

/** 同步应用权威结果；预检完成前不会写入任何 Store。 */
export function applyDnd5eCombatResultApplication(
  input: Dnd5eCombatResultApplicationPort,
): Dnd5eCombatResultCommitReceipt {
  const prepared = prepareCommit(input)
  if (input.applicationMode === 'map' && !input.applyMap) {
    throw new Error('combat-result-map-application-port-missing')
  }
  for (const characterId of prepared.characterIds) {
    input.applyCharacter(
      characterId,
      prepared.characterById.get(characterId)!,
      input.application.characterPatches?.[characterId],
    )
  }
  if (input.applicationMode === 'map') {
    input.applyMap!(input.mapId, input.application.map)
  } else {
    for (const tokenId of prepared.tokenIds) {
      input.applyToken(
        input.mapId,
        tokenId,
        prepared.tokenById.get(tokenId)!,
        input.application.tokenPatches?.[tokenId],
      )
    }
  }
  if (input.application.spentReactions) for (const id of unique(input.application.spentReactions.tokenIds)) {
    input.applySpentReaction?.(id, input.application.spentReactions.round)
  }
  return { mapId: input.mapId, characterIds: prepared.characterIds, tokenIds: prepared.tokenIds }
}

/** 应用后等待地图/角色共享快照落盘，调用方再发送动作 ACK 或关闭 Interrupt。 */
export async function commitDnd5eCombatResult(
  input: Dnd5eCombatResultCommitInput,
): Promise<Dnd5eCombatResultCommitReceipt> {
  const receipt = applyDnd5eCombatResultApplication(input)
  if (input.saveAll) {
    await input.saveAll(receipt)
    return receipt
  }
  const writes: Promise<unknown>[] = []
  if (input.saveCharacters && (input.forceSaveCharacters || receipt.characterIds.length > 0)) {
    writes.push(input.saveCharacters())
  }
  if (input.saveMap && (input.forceSaveMap || input.applicationMode === 'map' || receipt.tokenIds.length > 0)) {
    writes.push(input.saveMap())
  }
  await Promise.all(writes)
  return receipt
}
