import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type { Dnd5eCombatEvent } from '../../application/combat/dnd5eCombatRules'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eTurnEconomyByToken, Dnd5eTurnEconomyCounts } from '../../lib/sharedCombatTypes'
import { cellDistance, type GridCell } from '../../lib/gridCombat'
import { removePersistentAreaByDm } from './dmWallOfFireRemoval'
import {
  COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS,
  isCombatPresentationAreaSpellId,
} from '../../../shared/combat-presentation-contract.mjs'
import type { CombatPresentationAreaSpellId } from '../../../shared/combat-presentation-contract.mjs'

export function dnd5eSpellAttackPresentationOrigin(input: {
  map: BattleMap
  actorToken: Token
  sustainedEffectAreaId?: string
  sustainedAttackOrigin?: 'caster' | 'effect-token' | 'persistent-area'
}): Token {
  if (input.sustainedAttackOrigin !== 'effect-token' || !input.sustainedEffectAreaId) {
    return input.actorToken
  }
  const area = input.map.dnd5ePluginAreas?.find((candidate) =>
    candidate.id === input.sustainedEffectAreaId && candidate.anchorMode === 'effect-token',
  )
  if (!area?.anchorTokenId) return input.actorToken
  return input.map.tokens.find((token) => token.id === area.anchorTokenId) ?? input.actorToken
}

export function dnd5eSpellResolutionInitiativeOrder(input: {
  combatActive: boolean
  map: BattleMap
  actorTokenId: string
  initiativeOrder: readonly InitiativeEntry[]
}): readonly InitiativeEntry[] {
  const ordinaryOrder = input.combatActive
    ? [...input.initiativeOrder]
    : input.map.tokens
    .filter((token) => token.type === 'player' || token.type === 'enemy' || token.type === 'npc')
    .sort((left, right) => left.id === input.actorTokenId
      ? -1
      : right.id === input.actorTokenId ? 1 : left.id.localeCompare(right.id))
    .map((token, index) => ({
      slotId: `exploration:${token.id}`,
      tokenId: token.id,
      label: token.label,
      emoji: token.emoji,
      color: token.color,
      roll: Math.max(1, 20 - index),
    }))
  if (!input.combatActive) return ordinaryOrder
  const representedTokenIds = new Set(ordinaryOrder.map((entry) => entry.tokenId))
  const npcTargets = input.map.tokens
    .filter((token) => token.type === 'npc' && !representedTokenIds.has(token.id))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((token) => ({
      slotId: `spell-resolution:npc:${token.id}`,
      tokenId: token.id,
      label: token.label,
      emoji: token.emoji,
      color: token.color,
      roll: 1,
    }))
  return [...ordinaryOrder, ...npcTargets]
}

/**
 * A new concentration spell removes the caster's previous concentration area
 * during the headless spell application. Some areas (notably Delayed Blast
 * Fireball) must resolve an on-detonate wave when that removal happens, so the
 * UI authority boundary needs the exact removed area snapshot before it is
 * discarded.
 */
export function dnd5eConcentrationReplacementDetonationAreas(input: {
  beforeMap: BattleMap
  afterMap: BattleMap
  sourceCharacterId: string
  sourceTokenId: string
  replacementConcentrationId?: string
  concentrationEnded?: boolean
}): Dnd5ePluginArea[] {
  const liveAreaIds = new Set((input.afterMap.dnd5ePluginAreas ?? []).map((area) => area.id))
  return (input.beforeMap.dnd5ePluginAreas ?? []).filter((area) =>
    !!area.concentrationId &&
    (
      input.concentrationEnded === true ||
      !liveAreaIds.has(area.id) ||
      (!!input.replacementConcentrationId && area.concentrationId !== input.replacementConcentrationId)
    ) &&
    (
      area.sourceCharacterId === input.sourceCharacterId ||
      area.sourceTokenId === input.sourceTokenId
    ) &&
    (area.triggers ?? []).some((trigger) => trigger.timing === 'on-detonate')
  )
}

export function dnd5eSpellAuthorityResolutionContext(input: {
  combatActive: boolean
  combatId?: string
  map: BattleMap
  actorTokenId: string
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Dnd5eTurnEconomyByToken
}) {
  const exploration = !input.combatActive && !input.combatId?.trim()
  return {
    exploration,
    initiativeOrder: dnd5eSpellResolutionInitiativeOrder({
      combatActive: !exploration,
      map: input.map,
      actorTokenId: input.actorTokenId,
      initiativeOrder: input.initiativeOrder,
    }),
    turnEconomy: exploration ? undefined : input.turnEconomy,
    turnEconomyByToken: exploration ? undefined : input.turnEconomyByToken,
  }
}

export interface FireballPresentationSettlement {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetCell: { col: number; row: number }
  radiusFeet: number
}

export interface AreaSpellPresentationSettlement {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  spellId: CombatPresentationAreaSpellId
  targetCell: { col: number; row: number }
  shape: 'cone' | 'line' | 'circle' | 'rect'
  lengthFeet?: number
  widthFeet?: number
  heightFeet?: number
  radiusFeet?: number
  wallOfFireShape?: 'line' | 'ring'
  wallOfFireAngleDegrees?: number
  areaAngleDegrees?: number
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
    | 'magic-missile'
    | 'scorching-ray'
    | 'guiding-bolt'
    | 'acid-arrow'
    | 'cure-wounds'
    | 'healing-word'
    | 'inflict-wounds'
    | 'bless'
    | 'bane'
    | 'shield-of-faith'
    | 'mage-armor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'hunters-mark'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness'
    | 'blight'
    | 'chain-lightning'
    | 'disintegrate'
    | 'finger-of-death'
    | 'power-word-stun'
    | 'power-word-kill'
    | 'false-life'
    | 'hypnotic-pattern'
    | 'slow'
    | 'phantasmal-killer'
    | 'banishment'
    | 'misty-step'
    | 'hold-monster'
    | 'dispel-magic'
    | 'lesser-restoration'
    | 'heal'
    | 'mass-cure-wounds'
    | 'mass-heal'
    | 'mass-healing-word'
    | 'prayer-of-healing'
    | 'dancing-lights'
    | 'thaumaturgy'
    | 'shillelagh'
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
    'magic-missile',
    'scorching-ray',
    'guiding-bolt',
    'acid-arrow',
    'cure-wounds',
    'healing-word',
    'inflict-wounds',
    'bless',
    'bane',
    'shield-of-faith',
    'mage-armor',
    'jump',
    'darkvision',
    'see-invisibility',
    'warding-bond',
    'fly',
    'heroism',
    'enlarge-reduce',
    'enhance-ability',
    'divine-favor',
    'hunters-mark',
    'magic-weapon',
    'flame-blade',
    'invisibility',
    'blur',
    'barkskin',
    'protection-from-poison',
    'longstrider',
    'protection-from-energy',
    'death-ward',
    'greater-invisibility',
    'charm-person',
    'hideous-laughter',
    'hold-person',
    'blindness-deafness',
    'blight',
    'chain-lightning',
    'disintegrate',
    'finger-of-death',
    'power-word-stun',
    'power-word-kill',
    'false-life',
    'hypnotic-pattern',
    'slow',
    'phantasmal-killer',
    'banishment',
    'misty-step',
    'hold-monster',
    'dispel-magic',
    'lesser-restoration',
    'heal',
    'mass-cure-wounds',
    'mass-heal',
    'mass-healing-word',
    'prayer-of-healing',
    'dancing-lights',
    'thaumaturgy',
    'shillelagh',
  ])
  if (!supported.has(input.spellId as PreRollSpellPresentation['spellId'])) return []
  const spellId = input.spellId as PreRollSpellPresentation['spellId']
  const selfManifestation = spellId === 'misty-step' || spellId === 'dancing-lights' ||
    spellId === 'thaumaturgy' || spellId === 'shillelagh'
  const targetTokenIds = selfManifestation && input.targetTokenIds.length === 0
    ? [input.actorTokenId]
    : input.targetTokenIds
  return targetTokenIds.map((targetTokenId, index) => ({
    spellId,
    id: `${input.transactionId}:${spellId}:${index}`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: spellId === 'chain-lightning' && index > 0
      ? input.targetTokenIds[0]
      : input.actorTokenId,
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

export function areaSpellPresentationForSettlement(input: {
  spellId: string
  transactionId: string
  mapId: string
  actorTokenId: string
  areaAnchorCell?: { col: number; row: number }
  areaTargetOrientation?: 0 | 1 | 2 | 3
  wallOfFireGeometry?: {
    shape: 'line' | 'ring'
    angleDegrees: number
    lengthFeet?: number
    diameterFeet?: number
  }
}): AreaSpellPresentationSettlement | null {
  if (
    !input.areaAnchorCell ||
    !Number.isInteger(input.areaAnchorCell.col) ||
    !Number.isInteger(input.areaAnchorCell.row) ||
    input.areaAnchorCell.col < 0 ||
    input.areaAnchorCell.row < 0
  ) return null
  // Grease is rendered exclusively by the authoritative persistent-area layer.
  // Do not publish the transient area atlas first: it duplicates the oil pool
  // and delays settlement before the ground effect can be installed.
  if (input.spellId === 'grease') return null
  if (!isCombatPresentationAreaSpellId(input.spellId)) return null
  const area = COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS[input.spellId]
  return {
    id: `${input.transactionId}:${input.spellId}:area`,
    mapId: input.mapId,
    transactionId: input.transactionId,
    sourceTokenId: input.actorTokenId,
    spellId: input.spellId,
    targetCell: { ...input.areaAnchorCell },
    ...area,
    ...((input.spellId === 'wind-wall' || input.spellId === 'wall-of-force' ||
      input.spellId === 'wall-of-stone' || input.spellId === 'wall-of-ice' ||
      input.spellId === 'wall-of-thorns') && input.areaTargetOrientation != null ? {
      areaAngleDegrees: input.areaTargetOrientation * 90,
    } : {}),
    ...((input.spellId === 'wall-of-fire' || input.spellId === 'blade-barrier') && input.wallOfFireGeometry ? {
      wallOfFireShape: input.wallOfFireGeometry.shape,
      wallOfFireAngleDegrees: input.wallOfFireGeometry.angleDegrees,
      widthFeet: input.wallOfFireGeometry.shape === 'ring'
        ? input.wallOfFireGeometry.diameterFeet ?? (input.spellId === 'blade-barrier' ? 60 : 20)
        : input.wallOfFireGeometry.lengthFeet ?? (input.spellId === 'blade-barrier' ? 100 : 60),
      heightFeet: 5,
    } : {}),
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

export function hasBlessPresentationEffect(combatState: {
  concentrationEffectsBySource?: Readonly<Record<string, string>>
} | undefined): boolean {
  return Object.values(combatState?.concentrationEffectsBySource ?? {}).includes('bless')
}

export function hasBanePresentationEffect(combatState: {
  concentrationEffectsBySource?: Readonly<Record<string, string>>
} | undefined): boolean {
  return Object.values(combatState?.concentrationEffectsBySource ?? {}).includes('bane')
}

export function hasShieldOfFaithPresentationEffect(combatState: {
  concentrationEffectsBySource?: Readonly<Record<string, string>>
} | undefined): boolean {
  return Object.values(combatState?.concentrationEffectsBySource ?? {}).includes('shield-of-faith')
}

export function hasMageArmorPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return (combatState?.activeEffects ?? []).some((effect) =>
    effect.source.rulesId === 'mage-armor' ||
    effect.definitionId === 'srd-5.1:spell:mage-armor',
  )
}

function hasActiveSpellPresentationEffect(
  combatState: {
    activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
  } | undefined,
  spellId:
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness',
): boolean {
  return (combatState?.activeEffects ?? []).some((effect) =>
    effect.source.rulesId === spellId ||
    effect.definitionId === `srd-5.1:spell:${spellId}`,
  )
}

export function hasJumpPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'jump')
}

export function hasDarkvisionPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'darkvision')
}

export function hasSeeInvisibilityPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'see-invisibility')
}

export function hasWardingBondPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'warding-bond')
}

export function hasFlyPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'fly')
}

export function hasHeroismPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'heroism')
}

export function hasEnlargeReducePresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'enlarge-reduce')
}

export function hasEnhanceAbilityPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'enhance-ability')
}

export function hasDivineFavorPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'divine-favor')
}

export function hasHuntersMarkPresentationEffect(combatState: {
  concentrationEffectsBySource?: Readonly<Record<string, string>>
} | undefined): boolean {
  return Object.values(combatState?.concentrationEffectsBySource ?? {}).includes('hunters-mark')
}

export function hasMagicWeaponPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'magic-weapon')
}

export function hasFlameBladePresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'flame-blade')
}

export function hasInvisibilityPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'invisibility')
}

export function hasBlurPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'blur')
}

export function hasBarkskinPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'barkskin')
}

export function hasProtectionFromPoisonPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'protection-from-poison')
}

export function hasLongstriderPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'longstrider')
}

export function hasProtectionFromEnergyPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'protection-from-energy')
}

export function hasDeathWardPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'death-ward')
}

export function hasGreaterInvisibilityPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'greater-invisibility')
}

export function hasCharmPersonPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'charm-person')
}

export function hasHideousLaughterPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'hideous-laughter')
}

export function hasHoldPersonPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'hold-person')
}

export function hasBlindnessDeafnessPresentationEffect(combatState: {
  activeEffects?: readonly { source: { rulesId?: string }; definitionId?: string }[]
} | undefined): boolean {
  return hasActiveSpellPresentationEffect(combatState, 'blindness-deafness')
}

export function spellPresentationEffectSourceActorId(
  combatState: {
    concentrationEffectsBySource?: Readonly<Record<string, string>>
    activeEffects?: readonly {
      source: { actorId?: string; rulesId?: string }
      definitionId?: string
    }[]
  } | undefined,
  spellId:
    | 'guidance'
    | 'resistance'
    | 'sanctuary'
    | 'bless'
    | 'bane'
    | 'shield-of-faith'
    | 'mage-armor'
    | 'jump'
    | 'darkvision'
    | 'see-invisibility'
    | 'warding-bond'
    | 'fly'
    | 'heroism'
    | 'enlarge-reduce'
    | 'enhance-ability'
    | 'divine-favor'
    | 'hunters-mark'
    | 'magic-weapon'
    | 'flame-blade'
    | 'invisibility'
    | 'blur'
    | 'barkskin'
    | 'protection-from-poison'
    | 'longstrider'
    | 'protection-from-energy'
    | 'death-ward'
    | 'greater-invisibility'
    | 'charm-person'
    | 'hideous-laughter'
    | 'hold-person'
    | 'blindness-deafness',
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

export interface Dnd5eCrossMapConcentrationProjectionCleanup {
  mapId: string
  dnd5ePluginAreas: Dnd5ePluginArea[]
  tokens: Token[]
}

/**
 * A character owns one concentration state across the campaign, not one per
 * map. When a new concentration area is committed, remove that character's
 * old area/effect-token projections from every other map in the same atomic
 * room snapshot.
 */
export function planDnd5eCrossMapConcentrationProjectionCleanup(input: {
  maps: readonly BattleMap[]
  currentMapId: string
  createdArea: Pick<Dnd5ePluginArea, 'concentrationId' | 'sourceCharacterId'>
}): Dnd5eCrossMapConcentrationProjectionCleanup[] {
  if (!input.createdArea.concentrationId || !input.createdArea.sourceCharacterId) return []
  return input.maps.flatMap((map) => {
    if (map.id === input.currentMapId) return []
    const dnd5ePluginAreas = (map.dnd5ePluginAreas ?? []).filter((area) =>
      !(area.concentrationId && area.sourceCharacterId === input.createdArea.sourceCharacterId),
    )
    const tokens = map.tokens.filter((token) =>
      !(
        token.dnd5eSpellEffect?.concentrationId &&
        token.dnd5eSpellEffect.sourceCharacterId === input.createdArea.sourceCharacterId
      ),
    )
    if (
      dnd5ePluginAreas.length === (map.dnd5ePluginAreas ?? []).length &&
      tokens.length === map.tokens.length
    ) return []
    return [{ mapId: map.id, dnd5ePluginAreas, tokens }]
  })
}

export interface SunburstDarknessDispelSettlement {
  map: BattleMap
  characters: Character[]
  removedAreaIds: string[]
  changedCharacterIds: string[]
  changedTokenIds: string[]
}

/**
 * Sunburst ends every spell-created darkness volume touched by its 60-foot
 * sphere. Removing the map area and its exact concentration controller in one
 * pure settlement prevents the UI from leaving an invisible, still-active
 * Darkness concentration behind after the visual volume disappears.
 */
export function settleSunburstSpellDarknessDispels(input: {
  map: BattleMap
  characters: readonly Character[]
  anchorCell: GridCell
  radiusFeet: number
}): SunburstDarknessDispelSettlement {
  let map = input.map
  let characters = [...input.characters]
  const maximumCells = Math.floor(input.radiusFeet / Math.max(1, input.map.feetPerCell ?? 5))
  const candidateIds = (input.map.dnd5ePluginAreas ?? []).flatMap((area) =>
    area.sourceKind === 'core-spell' &&
    area.lighting?.kind === 'magical-darkness' &&
    area.cells.some((cell) => cellDistance(input.anchorCell, cell) <= maximumCells)
      ? [area.id]
      : [],
  )
  const removedAreaIds: string[] = []
  const changedCharacterIds = new Set<string>()
  const changedTokenIds = new Set<string>()
  for (const areaId of candidateIds) {
    const beforeTokens = new Map(map.tokens.map((token) => [token.id, token]))
    const removal = removePersistentAreaByDm({ map, characters, areaId })
    if (!removal) continue
    map = removal.map
    removedAreaIds.push(areaId)
    if (removal.character) {
      characters = characters.map((character) =>
        character.id === removal.character!.id ? removal.character! : character,
      )
      changedCharacterIds.add(removal.character.id)
    }
    for (const token of map.tokens) {
      if (JSON.stringify(beforeTokens.get(token.id)) !== JSON.stringify(token)) changedTokenIds.add(token.id)
    }
    for (const tokenId of beforeTokens.keys()) {
      if (!map.tokens.some((token) => token.id === tokenId)) changedTokenIds.add(tokenId)
    }
  }
  return {
    map,
    characters,
    removedAreaIds,
    changedCharacterIds: [...changedCharacterIds],
    changedTokenIds: [...changedTokenIds],
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

/**
 * Select only the saves declared by the spell cast itself. Damage can enqueue
 * concentration or other follow-up saves in the same Headless transaction;
 * those are real events, but must not inflate the cast summary's target-save
 * count. The first matching event is authoritative because primary spell saves
 * are emitted before damage-triggered follow-up saves.
 */
export function spellSettlementPrimarySavingThrows(
  events: readonly Dnd5eCombatEvent[],
  expected: readonly { targetId: string; ability?: AbilityKey; dc: number }[],
): Extract<Dnd5eCombatEvent, { type: 'saving-throw-resolved' }>[] {
  const matched = new Set<string>()
  const saves: Extract<Dnd5eCombatEvent, { type: 'saving-throw-resolved' }>[] = []
  for (const event of events) {
    if (event.type !== 'saving-throw-resolved') continue
    const declaration = expected.find((candidate) =>
      candidate.targetId === event.targetId &&
      candidate.dc === event.dc &&
      (candidate.ability == null || candidate.ability === event.ability),
    )
    if (!declaration) continue
    const key = `${declaration.targetId}\u0000${declaration.ability ?? event.ability}\u0000${declaration.dc}`
    if (matched.has(key)) continue
    matched.add(key)
    saves.push(event)
  }
  return saves
}
