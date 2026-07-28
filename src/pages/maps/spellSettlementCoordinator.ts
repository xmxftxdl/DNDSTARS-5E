import type { BattleMap } from '../../store/maps'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'

export interface FireballPresentationSettlement {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetCell: { col: number; row: number }
  radiusFeet: number
}

export interface GuidancePresentationSettlement {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}

export type PreRollSpellPresentation = {
  spellId:
    | 'fire-bolt'
    | 'ray-of-frost'
    | 'eldritch-blast'
    | 'produce-flame'
    | 'shocking-grasp'
    | 'chill-touch'
    | 'sacred-flame'
    | 'sanctuary'
    | 'spare-the-dying'
    | 'acid-splash'
    | 'poison-spray'
    | 'vicious-mockery'
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
}

export function hasSpellActionBannerPresentation(spellId: string): boolean {
  return spellId.trim().length > 0
}

export function spellPresentationsBeforeRoll(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  targetTokenIds: readonly string[]
}): PreRollSpellPresentation[] {
  const supported = new Set<PreRollSpellPresentation['spellId']>([
    'fire-bolt',
    'ray-of-frost',
    'eldritch-blast',
    'produce-flame',
    'shocking-grasp',
    'chill-touch',
    'sacred-flame',
    'sanctuary',
    'spare-the-dying',
    'acid-splash',
    'poison-spray',
    'vicious-mockery',
  ])
  if (!supported.has(input.spellId as PreRollSpellPresentation['spellId'])) return []
  const spellId = input.spellId as PreRollSpellPresentation['spellId']
  return input.targetTokenIds.map((targetTokenId, index) => ({
    spellId,
    id: `${input.transactionId}:${spellId}:${index}`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    targetTokenId,
  }))
}

export function fireballPresentationForSettlement(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  areaAnchorCell?: { col: number; row: number }
  radiusFeet?: number
}): FireballPresentationSettlement | null {
  if (
    input.spellId !== 'fireball' ||
    !input.areaAnchorCell ||
    !Number.isInteger(input.areaAnchorCell.col) ||
    !Number.isInteger(input.areaAnchorCell.row) ||
    input.areaAnchorCell.col < 0 ||
    input.areaAnchorCell.row < 0 ||
    !Number.isFinite(input.radiusFeet) ||
    input.radiusFeet! <= 0
  ) return null
  return {
    id: `${input.transactionId}:fireball`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    targetCell: { ...input.areaAnchorCell },
    radiusFeet: input.radiusFeet!,
  }
}

export function guidancePresentationsForTargets(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  targetTokenIds: readonly string[]
}): GuidancePresentationSettlement[] {
  if (input.spellId !== 'guidance') return []
  return [...new Set(input.targetTokenIds)].map((targetTokenId, index) => ({
    id: `${input.transactionId}:guidance:${index}`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    targetTokenId,
  }))
}

export function resistancePresentationsForTargets(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  targetTokenIds: readonly string[]
}): GuidancePresentationSettlement[] {
  if (input.spellId !== 'resistance') return []
  return [...new Set(input.targetTokenIds)].map((targetTokenId, index) => ({
    id: `${input.transactionId}:resistance:${index}`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    targetTokenId,
  }))
}

export function sanctuaryPresentationsForTargets(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  targetTokenIds: readonly string[]
}): GuidancePresentationSettlement[] {
  if (input.spellId !== 'sanctuary') return []
  return [...new Set(input.targetTokenIds)].map((targetTokenId, index) => ({
    id: `${input.transactionId}:sanctuary:${index}`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    targetTokenId,
  }))
}

export function hasGuidancePresentationEffect(combatState: {
  concentrationEffectsBySource?: Readonly<Record<string, string>>
  activeEffects?: readonly { source: { rulesId?: string } }[]
} | undefined): boolean {
  return Object.values(combatState?.concentrationEffectsBySource ?? {}).includes('guidance') ||
    (combatState?.activeEffects ?? []).some((effect) => effect.source.rulesId === 'guidance')
}

export function hasResistancePresentationEffect(combatState: {
  concentrationEffectsBySource?: Readonly<Record<string, string>>
  activeEffects?: readonly { source: { rulesId?: string } }[]
} | undefined): boolean {
  return Object.values(combatState?.concentrationEffectsBySource ?? {}).includes('resistance') ||
    (combatState?.activeEffects ?? []).some((effect) => effect.source.rulesId === 'resistance')
}

export function hasSanctuaryPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return (combatState?.activeEffects ?? []).some((effect) =>
    effect.source.rulesId === 'sanctuary' ||
    effect.definitionId === 'srd-5.1:spell:sanctuary',
  )
}

export function spellPresentationEffectSourceActorId(
  combatState: {
    concentrationEffectsBySource?: Readonly<Record<string, string>>
    activeEffects?: readonly {
      source: { actorId?: string; rulesId?: string }
      definitionId?: string
    }[]
  } | undefined,
  spellId: 'guidance' | 'resistance' | 'sanctuary',
): string | undefined {
  const activeEffect = (combatState?.activeEffects ?? []).find((effect) =>
    effect.source.rulesId === spellId ||
    effect.definitionId === `srd-5.1:spell:${spellId}`,
  )
  if (activeEffect?.source.actorId) return activeEffect.source.actorId
  return Object.entries(combatState?.concentrationEffectsBySource ?? {})
    .find(([, activeSpellId]) => activeSpellId === spellId)?.[0]
}

export function spellSettlementMapLayerChanges(before: BattleMap, after: BattleMap) {
  return {
    areasChanged: JSON.stringify(after.dnd5ePluginAreas ?? []) !==
      JSON.stringify(before.dnd5ePluginAreas ?? []),
    effectTokensChanged: JSON.stringify(after.tokens.filter((token) => token.dnd5eSpellEffect)) !==
      JSON.stringify(before.tokens.filter((token) => token.dnd5eSpellEffect)),
  }
}

/**
 * 只把本次法术事务实际改动的区域合并进最新地图。
 * Interrupt／掷骰等待期间由其他事务创建的区域必须保留，不能用 prepare 阶段的旧数组整表覆盖。
 */
export function mergeDnd5eSpellAreaDelta(input: {
  currentMap: BattleMap
  beforeMap: BattleMap
  afterMap: BattleMap
}) {
  const beforeById = new Map((input.beforeMap.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const afterById = new Map((input.afterMap.dnd5ePluginAreas ?? []).map((area) => [area.id, area]))
  const changedIds = new Set<string>()
  for (const id of new Set([...beforeById.keys(), ...afterById.keys()])) {
    if (JSON.stringify(beforeById.get(id)) !== JSON.stringify(afterById.get(id))) changedIds.add(id)
  }
  if (changedIds.size === 0) return input.currentMap.dnd5ePluginAreas ?? []

  const merged = (input.currentMap.dnd5ePluginAreas ?? [])
    .filter((area) => !changedIds.has(area.id) || afterById.has(area.id))
    .map((area) => changedIds.has(area.id) ? afterById.get(area.id)! : area)
  const mergedIds = new Set(merged.map((area) => area.id))
  for (const id of changedIds) {
    const added = afterById.get(id)
    if (added && !mergedIds.has(id)) {
      merged.push(added)
      mergedIds.add(id)
    }
  }
  return merged
}

export function spellSettlementSpentTurnResource(
  events: readonly Dnd5eCombatEvent[],
): 'action' | 'bonusAction' | undefined {
  const spent = events.find((event) =>
    event.type === 'turn-resource-spent' &&
    (event.resource === 'action' || event.resource === 'bonusAction'),
  )
  return spent?.type === 'turn-resource-spent' &&
    (spent.resource === 'action' || spent.resource === 'bonusAction')
    ? spent.resource
    : undefined
}
