import type { BattleMap, Token } from '../store/maps'
import type { ClassFeatureKey } from '../types/character'
import type { Character } from '../types/character'
import { findClassTrait } from './classFeatures'
import type { HeadlessActivateFeatureAction, HeadlessFeatureTargetPacket } from './headlessDmCombatEngine'
import type { SharedPlayerActionState } from './sharedCombatTypes'

const PLAYER_DM_READY_FEATURE_KEYS = new Set<ClassFeatureKey>([
  'doubleArrow',
  'preciseStrike',
  'eagleEye',
  'stillWater',
  'finale',
  'flexibleBody',
  'showtime',
  'windBlade',
])

export type HeadlessActiveFeatureKey = HeadlessActivateFeatureAction['featureKey']

const HEADLESS_ACTIVE_FEATURE_KEYS = new Set<HeadlessActiveFeatureKey>([
  'eagleEye',
  'doubleArrow',
  'preciseStrike',
  'stillWater',
  'finale',
  'illusionDance',
  'shadowVeil',
  'trackingArrow',
  'flexibleBody',
  'showtime',
  'windBlade',
])

export function shouldSendPlayerReadyFeatureToDm(featureKey: ClassFeatureKey): boolean {
  return PLAYER_DM_READY_FEATURE_KEYS.has(featureKey)
}

export function isHeadlessActiveFeatureKey(featureKey: ClassFeatureKey | undefined): featureKey is HeadlessActiveFeatureKey {
  return !!featureKey && HEADLESS_ACTIVE_FEATURE_KEYS.has(featureKey as HeadlessActiveFeatureKey)
}

export function uniqueFeatureTargetIds(ids: Array<string | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => !!id)))
}

export function illusionDanceTargetLimit(caster: Character): number {
  const trait = findClassTrait(caster, 'illusionDance')
  return Math.min(3, Math.max(1, trait?.level ?? 1))
}

export type PlayerFeatureActivationPrepareResult =
  | {
      ok: false
      reason: 'unsupported-feature'
    }
  | {
      ok: true
      kind: 'illusionDance'
      actor: Character
      map: BattleMap
      targetIds: string[]
      rollTargetIds: string[]
      buildHeadlessAction: (targetPackets: HeadlessFeatureTargetPacket[]) => HeadlessActivateFeatureAction
    }
  | {
      ok: true
      kind: 'standard'
      actor: Character
      map: BattleMap
      target?: Token
      featureKey: Exclude<HeadlessActiveFeatureKey, 'illusionDance'>
      finaleWillTrigger: boolean
      finaleExtraD8Count: number
      buildHeadlessAction: (finaleDamageValues?: number[]) => HeadlessActivateFeatureAction
    }

export function preparePlayerFeatureActivationAction(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: Character[]
}): PlayerFeatureActivationPrepareResult {
  const { action, map, characters } = input
  const actor = characters.find((character) => character.id === action.characterId)
  if (action.type !== 'activate-feature' || !actor || !isHeadlessActiveFeatureKey(action.featureKey)) {
    return { ok: false, reason: 'unsupported-feature' }
  }

  if (action.featureKey === 'illusionDance') {
    const targetIds = uniqueFeatureTargetIds([
      ...(action.targetTokenIds ?? []),
      action.targetTokenId,
    ])
    const rollTargetIds = targetIds.slice(0, illusionDanceTargetLimit(actor))
    return {
      ok: true,
      kind: 'illusionDance',
      actor,
      map,
      targetIds,
      rollTargetIds,
      buildHeadlessAction: (targetPackets) => ({
        type: 'activate-feature',
        actorTokenId: action.actorTokenId,
        characterId: action.characterId,
        featureKey: 'illusionDance',
        targetTokenIds: targetIds,
        targetPackets,
      }),
    }
  }

  const featureKey = action.featureKey
  const target = action.targetTokenId ? map.tokens.find((token) => token.id === action.targetTokenId) : undefined
  const finaleWillTrigger = !!(
    featureKey === 'trackingArrow' &&
    target &&
    (target.huntingMarkStacks ?? 0) >= 3 &&
    actor.combatBuffs?.finaleReady
  )
  const finaleTrait = findClassTrait(actor, 'finale')
  const finaleExtraD8Count = finaleWillTrigger && finaleTrait && finaleTrait.level > 1 ? finaleTrait.level - 1 : 0

  return {
    ok: true,
    kind: 'standard',
    actor,
    map,
    target,
    featureKey,
    finaleWillTrigger,
    finaleExtraD8Count,
    buildHeadlessAction: (finaleDamageValues) => ({
      type: 'activate-feature',
      actorTokenId: action.actorTokenId,
      characterId: action.characterId,
      featureKey,
      targetTokenId: action.targetTokenId,
      finaleDamageValues,
    }),
  }
}

type RollFeatureValues = (count: number, sides: number, label: string, targetName: string) => Promise<number[]>

export async function buildIllusionDanceTargetPackets(input: {
  prepared: Extract<PlayerFeatureActivationPrepareResult, { ok: true; kind: 'illusionDance' }>
  rollValues: RollFeatureValues
}): Promise<HeadlessFeatureTargetPacket[]> {
  const { prepared, rollValues } = input
  const targetPackets: HeadlessFeatureTargetPacket[] = []
  for (const targetId of prepared.rollTargetIds) {
    const target = prepared.map.tokens.find((token) => token.id === targetId)
    const values = await rollValues(1, 20, '迷幻舞步感知豁免', target?.label ?? '目标')
    targetPackets.push({ targetTokenId: targetId, saveD20: values[0] ?? 1 })
  }
  return targetPackets
}

export async function buildFinaleDamageValues(input: {
  prepared: Extract<PlayerFeatureActivationPrepareResult, { ok: true; kind: 'standard' }>
  rollValues: RollFeatureValues
}): Promise<number[] | undefined> {
  const { prepared, rollValues } = input
  if (!prepared.finaleWillTrigger) return undefined
  const targetName = prepared.target?.label ?? '目标'
  const values = await rollValues(6, 10, '曲终力场伤害', targetName)
  if (prepared.finaleExtraD8Count <= 0) return values
  return [
    ...values,
    ...(await rollValues(prepared.finaleExtraD8Count, 8, '曲终等级额外伤害', targetName)),
  ]
}
