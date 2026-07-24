import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import {
  DND_FEET_PER_CELL,
  cellKey,
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
} from '../../lib/gridCombat'
import { areOpposedCombatTokens } from '../../lib/opportunityAttacks'
import type { Dnd5eSpellMetamagicPayload, Dnd5eTurnEconomyCounts, SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { aoeOrientFromCell, canPlaceAoe, cellsForAoe, tokensInCells } from '../../lib/skillTargeting'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'
import { dnd5eClassDefinition, dnd5ePactSlotLevel, type Dnd5eClassId } from './classes'
import {
  dnd5eAttackerIsUnseenForAttack,
  dnd5eBlurImposesAttackDisadvantage,
  dnd5eCombatantPairKey,
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  endDnd5eConcentration,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTranquilityWardCheck,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCuttingWordsUse,
  type Dnd5eCounterspellReaction,
  type Dnd5eDispelMagicCheck,
  type Dnd5eEmpoweredSpellReroll,
  type Dnd5eSpellForcedMovement,
  type Dnd5eHeadlessCombatState,
  type Dnd5eSpellTargetAttackRoll,
  type Dnd5eSpellTargetSavingThrowRoll,
  type Dnd5eTargetTranquilitySaveRoll,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
} from './headlessCombatEngine'
import { applyDnd5eAttackCoverOverride, createDnd5eMapCombatSnapshot, dnd5eMapTokenCanThreatenRangedAttacker, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eCanEmpowerSpell, dnd5eCanOverchannelSpell, dnd5eCanSculptSpell, dnd5eCarefulSpellMaximumTargets, dnd5eDraconicElementalResistanceType, dnd5eFreeSpellCastSource, dnd5eHeightenedSavingThrowMode, dnd5eMetamagicAvailableForSpell, dnd5eMetamagicCost, dnd5eSculptSpellMaximumTargets, dnd5eSpellcastingClassIdForSpell, dnd5eSpellAllowsRepeatedTargets, dnd5eSpellConcentrationDurationRounds, dnd5eSpellDamageDiceCounts, dnd5eSpellDelayedDamageDiceCount, dnd5eSpellDiceCount, dnd5eSpellHigherSlotDamageChoices, dnd5eSpellMaximumTargets, dnd5eSpellProjectileCount, dnd5eSpellUsesSequencedAttacks, dnd5eSustainedSpellAttackDiceCount, getDnd5eSrdCombatSpell, type Dnd5eSrdSpellDefinition } from './spells'
import { normalizeDnd5eActiveEffects } from './activeEffects'
import { dnd5eWearingUnproficientArmor } from './equipment'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { dnd5eConditionSavingThrowAutomaticallyFails } from './conditions'
import {
  mapGeometryCoverFromPoint,
  mapGeometryLineOfEffectBlocked,
  mapGeometryMovementBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
} from '../../lib/mapGeometry'
import { createDnd5eCoreSpellArea, dnd5eWallOfFireDamagingSideCells, getDnd5eCoreSpellAreaDeclaration, moveDnd5eCoreSpellArea, resolveDnd5eCoreSpellLightingConflicts } from './coreSpellAreas'
import { dnd5eCharacterClassLevel } from './multiclass'

export type Dnd5eSpellCastRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'effect-line-blocked'
  | 'spell-unavailable'
  | 'armor-proficiency-required'
  | 'slot-unavailable'
  | 'combatant-missing'

export interface PreparedDnd5eSpellCast {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  castingClassId: Dnd5eClassId
  castingClassLevel: number
  actorToken: Token
  targetToken: Token
  targetTokens: readonly Token[]
  projectileTargetIds?: readonly string[]
  spell: Dnd5eSrdSpellDefinition
  slotLevel: number
  diceCount: number
  damageDiceCounts: readonly number[]
  delayedDamageDiceCount: number
  higherSlotDamageType?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['higherSlotDamageType']
  effectBonus: number
  attackMode?: 'normal' | 'advantage' | 'disadvantage'
  targetSpellAttacks?: readonly {
    targetToken: Token
    mode: 'normal' | 'advantage' | 'disadvantage'
    armorClass: number
  }[]
  attackBlessed: boolean
  attackBaned: boolean
  savingThrow?: { modifier: number; dc: number; mode: 'normal' | 'advantage' | 'disadvantage' }
  savingThrowBlessed: boolean
  savingThrowBaned: boolean
  targetSavingThrows?: readonly {
    targetToken: Token
    modifier: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    blessed: boolean
    baned: boolean
  }[]
  tranquilityWard?: ReturnType<typeof dnd5eTranquilityWardCheck>
  targetTranquilityWards?: readonly {
    targetToken: Token
    ward: NonNullable<ReturnType<typeof dnd5eTranquilityWardCheck>>
  }[]
  overchannel: boolean
  overchannelSelfDamageDiceCount: number
  sculptedTargetIds: readonly string[]
  metamagic?: Dnd5eSpellMetamagicPayload
  empowered: boolean
  carefulTargetIds: readonly string[]
  draconicResistance: boolean
  repellingBlast: boolean
  conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
  effectDamageType?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['effectDamageType']
  enlargeReduceChoice?: NonNullable<SharedPlayerActionState['dnd5eSpellCast']>['enlargeReduceChoice']
  healingAllocations?: readonly { targetId: string; amount: number }[]
  areaCells?: readonly { col: number; row: number }[]
  areaAnchorCell?: { col: number; row: number }
  areaTargetOrientation?: 0 | 1 | 2 | 3
  areaDurationRounds?: number
  /** 当前事务是在使用既有持续法术效果，而不是再次施法。 */
  sustainedEffectAttack?: 'flame-blade' | 'spiritual-weapon' | 'call-lightning'
  sustainedEffectAreaId?: string
}

/**
 * DM 地图桥为“斥力魔爆”计算一段远离施法者的合法直线位移。
 * 每道命中射线都重新调用，因此同一目标可被连续推动；边界、障碍和其他 Token 会截短位移。
 */
export function dnd5eRepellingBlastPushDestination(
  map: BattleMap,
  actor: Token,
  target: Token,
): { to: { x: number; y: number }; distanceFeet: number } {
  const feetPerCell = Math.max(1, map.feetPerCell ?? DND_FEET_PER_CELL)
  const maximumSteps = Math.max(0, Math.floor(10 / feetPerCell))
  const actorAnchor = tokenAnchorCellFromPixel(actor.x, actor.y, actor, map)
  const targetAnchor = tokenAnchorCellFromPixel(target.x, target.y, target, map)
  const dc = Math.sign(targetAnchor.col - actorAnchor.col)
  const dr = Math.sign(targetAnchor.row - actorAnchor.row)
  if (maximumSteps < 1 || (dc === 0 && dr === 0)) return { to: { x: target.x, y: target.y }, distanceFeet: 0 }
  const blocked = occupiedCells(map.tokens, map, target.id)
  const columns = Math.max(1, Math.floor((map.width - map.gridOffsetX) / Math.max(1, map.gridSize)))
  const rows = Math.max(1, Math.floor((map.height - map.gridOffsetY) / Math.max(1, map.gridSize)))
  let destination = { x: target.x, y: target.y }
  let steps = 0
  const geometry = mapGeometryRuntimeForMap(map.id)
  for (let step = 1; step <= maximumSteps; step += 1) {
    const anchor = { col: targetAnchor.col + dc * step, row: targetAnchor.row + dr * step }
    const position = tokenCenterForAnchorCell(anchor, target, map)
    const footprint = tokenOccupiedCellsAt(target, map, position)
    if (footprint.some((cell) =>
      cell.col < 0 || cell.row < 0 || cell.col >= columns || cell.row >= rows || blocked.has(cellKey(cell)),
    )) break
    if (mapGeometryMovementBlocked({
      geometry, map, token: { ...target, ...destination }, to: position,
    }).blocked) break
    destination = position
    steps = step
  }
  return { to: destination, distanceFeet: steps * feetPerCell }
}

export function prepareDnd5eSpellCast(input: {
  action: SharedPlayerActionState
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
}): { ok: true; prepared: PreparedDnd5eSpellCast } | { ok: false; reason: Dnd5eSpellCastRejectReason } {
  const payload = input.action.dnd5eSpellCast
  if (input.action.type !== 'dnd5e-spell-cast' || !payload) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) => token.id === input.action.actorTokenId && token.characterId === input.action.characterId)
  const spell = getDnd5eSrdCombatSpell(payload.spellId)
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (!payload.sustainedEffectAttack && dnd5eWearingUnproficientArmor(actor)) {
    return { ok: false, reason: 'armor-proficiency-required' }
  }
  const sustainedEffectAttack = payload.sustainedEffectAttack
  const sustainedAttack = sustainedEffectAttack && spell?.sustainedAttack?.id === sustainedEffectAttack
    ? spell.sustainedAttack
    : undefined
  if ((sustainedEffectAttack != null) !== (sustainedAttack != null)) {
    return { ok: false, reason: 'invalid-action' }
  }
  const sustainedUsesArea = sustainedAttack?.origin === 'effect-token' ||
    sustainedAttack?.origin === 'persistent-area'
  const sustainedEffectAreaId = sustainedUsesArea
    ? payload.sustainedEffectAreaId
    : undefined
  if (
    (sustainedUsesArea && !sustainedEffectAreaId) ||
    (!sustainedUsesArea && payload.sustainedEffectAreaId != null)
  ) return { ok: false, reason: 'invalid-action' }
  const sustainedArea = sustainedEffectAreaId
    ? input.map.dnd5ePluginAreas?.find((area) =>
        area.id === sustainedEffectAreaId &&
        area.sourceKind === 'core-spell' &&
        area.coreSpellId === spell?.id &&
        area.sourceCharacterId === actor.id &&
        area.sourceTokenId === actorToken.id &&
        area.anchorMode === (sustainedAttack?.origin === 'effect-token' ? 'effect-token' : 'fixed') &&
        (sustainedAttack?.origin !== 'effect-token' || !!area.anchorTokenId) &&
        !!area.anchorCell &&
        Number.isInteger(area.slotLevel) &&
        input.action.round <= area.expiresAfterRound,
      )
    : undefined
  const sustainedEffect = spell && sustainedAttack
    ? normalizeDnd5eActiveEffects(actor.dnd5eCombatState?.activeEffects).find((effect) =>
        effect.source.kind === 'spell' &&
        effect.source.actorId === actorToken.id &&
        effect.source.rulesId === spell.id &&
        effect.definitionId === `srd-5.1:spell:${spell.id}` &&
        (sustainedAttack.origin === 'caster' || sustainedAttack.origin === 'persistent-area'
          ? effect.duration.type === 'concentration' && effect.duration.sourceActorId === actorToken.id
          : effect.duration.type === 'rounds' && effect.stackingKey === sustainedEffectAreaId),
      )
    : undefined
  if (
    sustainedAttack && (
      !sustainedEffect || !Number.isInteger(sustainedEffect.potency) ||
      sustainedEffect.potency! < (spell?.level ?? 1) || sustainedEffect.potency! > 9 ||
      (sustainedAttack.origin === 'effect-token' && (
        !sustainedArea || sustainedArea.slotLevel !== sustainedEffect.potency ||
        !input.map.tokens.some((token) =>
          token.id === sustainedArea.anchorTokenId &&
          token.dnd5eSpellEffect?.spellId === spell?.id &&
          token.dnd5eSpellEffect?.sourceCharacterId === actor.id &&
          token.dnd5eSpellEffect?.sourceTokenId === actorToken.id
        )
      )) ||
      (sustainedAttack.origin === 'persistent-area' && (
        !sustainedArea || sustainedArea.slotLevel !== sustainedEffect.potency ||
        sustainedArea.concentrationId !== spell?.id ||
        actor.dnd5eCombatState?.concentrationSpellId !== spell?.id
      ))
    )
  ) return { ok: false, reason: 'spell-unavailable' }
  const authorizedSustainedEffectAreaId = spell?.sustainedAttack?.origin === 'effect-token'
    ? sustainedEffectAreaId ?? `core-spell-area:${input.action.id}`
    : sustainedAttack?.origin === 'persistent-area'
      ? sustainedEffectAreaId
    : undefined
  const sustainedAreaMovement = sustainedAttack?.origin === 'effect-token' && sustainedArea && payload.areaTargetCell
    ? moveDnd5eCoreSpellArea({
        map: input.map,
        geometry: mapGeometryRuntimeForMap(input.map.id),
        areaId: sustainedArea.id,
        sourceTokenId: actorToken.id,
        targetCell: payload.areaTargetCell,
      })
    : undefined
  if (sustainedArea && !payload.areaTargetCell) return { ok: false, reason: 'invalid-target' }
  if (sustainedAreaMovement && !sustainedAreaMovement.ok) {
    return {
      ok: false,
      reason: sustainedAreaMovement.reason === 'target-out-of-range'
        ? 'target-out-of-range'
        : 'invalid-target',
    }
  }
  const castingClassId = spell
    ? dnd5eSpellcastingClassIdForSpell(actor, spell.id, payload.castingClassId, spell.classes)
    : undefined
  const definition = castingClassId ? dnd5eClassDefinition(castingClassId) : undefined
  const castingClassLevel = castingClassId ? dnd5eCharacterClassLevel(actor, castingClassId) : 0
  if (!spell || !definition?.spellcasting || !castingClassId || castingClassLevel < 1) {
    return { ok: false, reason: 'spell-unavailable' }
  }
  if (actor.dnd5eCombatState?.wildShapeFormId && (definition.id !== 'druid' || castingClassLevel < 18)) {
    return { ok: false, reason: 'spell-unavailable' }
  }
  if (spell.castingTime === 'reaction') return { ok: false, reason: 'invalid-action' }

  const slotLevel = sustainedAttack
    ? sustainedEffect!.potency!
    : spell.level === 0
    ? 0
    : definition.spellcasting.kind === 'pact' && spell.level <= 5
      ? dnd5ePactSlotLevel(castingClassLevel)
      : payload.slotLevel
  const higherSlotDamageChoices = dnd5eSpellHigherSlotDamageChoices(spell, slotLevel)
  if (
    (higherSlotDamageChoices.length > 0 && !payload.higherSlotDamageType) ||
    (payload.higherSlotDamageType != null && !higherSlotDamageChoices.includes(payload.higherSlotDamageType))
  ) return { ok: false, reason: 'invalid-action' }
  if (spell.level > 0 && !sustainedAttack) {
    const resourceKey = definition.spellcasting.kind === 'pact' && spell.level <= 5 ? 'dnd5e-pact-slot' : `dnd5e-spell-slot-${slotLevel}`
    const slot = actor.classResources?.[resourceKey]
    const freeCastSource = dnd5eFreeSpellCastSource({
      classId: definition.id,
      level: castingClassLevel,
      classSelections: actor.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {},
      classResources: actor.classResources ?? {},
    }, spell, slotLevel)
    if (
      !Number.isInteger(slotLevel) || slotLevel < spell.level ||
      (!freeCastSource && (!slot || slot.current < 1))
    ) return { ok: false, reason: 'slot-unavailable' }
  }
  const overchannel = payload.overchannel === true
  if (sustainedAttack && (
    overchannel || payload.empowered || payload.draconicResistance || payload.repellingBlast ||
    payload.metamagic || payload.higherSlotDamageType || payload.conditionChoice ||
    payload.effectDamageType || payload.enlargeReduceChoice || payload.healingAllocations?.length ||
    (sustainedAttack.origin === 'caster' && payload.areaTargetCell) ||
    payload.areaTargetOrientation != null ||
    payload.projectileTargetIds?.length || payload.sculptedTargetIds?.length ||
    (sustainedAttack.resolution !== 'saving-throw' && (payload.targetTokenIds?.length ?? 0) > 1)
  )) return { ok: false, reason: 'invalid-action' }
  if (overchannel && !dnd5eCanOverchannelSpell({
    classId: definition.id,
    subclassId: actor.dnd5eClassChoices?.classes?.[definition.id]?.subclass,
    level: castingClassLevel,
  }, spell, slotLevel)) return { ok: false, reason: 'invalid-action' }
  const overchannelUses = Math.max(0, Math.floor(actor.dnd5eCombatState?.overchannelUsesSinceLongRest ?? 0))
  const overchannelSelfDamageDiceCount = overchannel && overchannelUses > 0
    ? (overchannelUses + 1) * slotLevel
    : 0
  const metamagic = payload.metamagic
  const classSelections = actor.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {}
  const sorceryPoints = actor.classResources?.['dnd5e-sorcery-points']
  const metamagicCost = metamagic ? dnd5eMetamagicCost(metamagic.kind, slotLevel) : 0
  if (metamagic) {
    const selectedMetamagic = classSelections.metamagic ?? []
    if (
      definition.id !== 'sorcerer' || castingClassLevel < 3 || !selectedMetamagic.includes(metamagic.kind) ||
      !dnd5eMetamagicAvailableForSpell(metamagic.kind, spell, slotLevel)
    ) return { ok: false, reason: 'invalid-action' }
  }
  const empowered = payload.empowered === true
  if (
    empowered && (
      definition.id !== 'sorcerer' || castingClassLevel < 3 ||
      !(classSelections.metamagic ?? []).includes('empowered') ||
      !dnd5eCanEmpowerSpell(spell) || overchannel
    )
  ) return { ok: false, reason: 'invalid-action' }
  const draconicResistance = payload.draconicResistance === true
  const invocations = classSelections['eldritch-invocations'] ?? []
  const repellingBlast = payload.repellingBlast === true
  if (
    repellingBlast &&
    (definition.id !== 'warlock' || spell.id !== 'eldritch-blast' || !invocations.includes('repelling-blast'))
  ) return { ok: false, reason: 'invalid-action' }
  const draconicResistanceType = dnd5eDraconicElementalResistanceType({
    classId: definition.id,
    subclassId: actor.dnd5eClassChoices?.classes?.[definition.id]?.subclass,
    level: castingClassLevel,
    classSelections,
  }, spell)
  const totalSorceryPointCost = metamagicCost + (empowered ? 1 : 0) + (draconicResistance ? 1 : 0)
  if (
    (draconicResistance && !draconicResistanceType) ||
    (totalSorceryPointCost > 0 && (!sorceryPoints || sorceryPoints.current < totalSorceryPointCost))
  ) return { ok: false, reason: 'invalid-action' }
  const diceCount = sustainedAttack || spell.sustainedAttack?.immediateAttack
    ? dnd5eSustainedSpellAttackDiceCount(spell, slotLevel)
    : dnd5eSpellDiceCount(spell, actor.level, slotLevel)
  const projectileCount = dnd5eSpellProjectileCount(spell, actor.level, slotLevel)
  const repeatedTargets = dnd5eSpellAllowsRepeatedTargets(spell)
  const projectileTargetIds = repeatedTargets ? payload.projectileTargetIds : undefined
  if (
    (repeatedTargets && projectileTargetIds?.length !== projectileCount) ||
    (!repeatedTargets && (payload.projectileTargetIds?.length ?? 0) > 0)
  ) return { ok: false, reason: 'invalid-target' }
  const persistentArea = spell.effect === 'persistent-area'
  let requestedTargetIds = persistentArea || (spell.area && spell.target === 'area')
    ? []
    : [...new Set(
        projectileTargetIds?.length
          ? projectileTargetIds
          : payload.targetTokenIds !== undefined
            ? payload.targetTokenIds
            : [payload.targetTokenId],
      )]
  const conditionChoice = payload.conditionChoice
  if (
    (spell.conditionOptions?.length && (!conditionChoice || !spell.conditionOptions.includes(conditionChoice))) ||
    (!spell.conditionOptions?.length && conditionChoice != null)
  ) return { ok: false, reason: 'invalid-action' }
  const effectDamageType = payload.effectDamageType
  if (
    (spell.effectDamageTypeOptions?.length && (!effectDamageType || !spell.effectDamageTypeOptions.includes(effectDamageType))) ||
    (!spell.effectDamageTypeOptions?.length && effectDamageType != null)
  ) return { ok: false, reason: 'invalid-action' }
  const enlargeReduceChoice = payload.enlargeReduceChoice
  if (
    (spell.enlargeReduceOptions?.length &&
      (!enlargeReduceChoice || !spell.enlargeReduceOptions.includes(enlargeReduceChoice))) ||
    (!spell.enlargeReduceOptions?.length && enlargeReduceChoice != null)
  ) return { ok: false, reason: 'invalid-action' }
  const maximumTargets = sustainedAttack
    ? sustainedAttack.resolution === 'saving-throw'
      ? dnd5eSpellMaximumTargets(spell, slotLevel, actor.level)
      : 1
    : metamagic?.kind === 'twinned' ? 2 : dnd5eSpellMaximumTargets(spell, slotLevel, actor.level)
  if (
    (!persistentArea && !spell.area && requestedTargetIds.length < 1) || requestedTargetIds.length > maximumTargets ||
    (metamagic?.kind === 'twinned' && requestedTargetIds.length !== 2)
  ) {
    return { ok: false, reason: 'invalid-target' }
  }
  const targetTokens = requestedTargetIds.map((id) => input.map.tokens.find((token) => token.id === id))
  if (targetTokens.some((token) =>
    !token || token.type === 'obstacle' ||
    (token.id === actorToken.id && (
      spell.target === 'hostile' ||
      (sustainedAttack != null && sustainedAttack.relation !== 'any')
    )),
  )) {
    return { ok: false, reason: 'invalid-target' }
  }
  let validTargetTokens = targetTokens as Token[]
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  let areaCells: readonly { col: number; row: number }[] | undefined
  let areaAnchorCell: { col: number; row: number } | undefined
  const areaTargeting = spell.area && sustainedUsesArea
    ? {
        ...spell.area,
        placeRangeFeet: sustainedAttack?.origin === 'effect-token'
          ? sustainedAttack.movementFeet
          : sustainedAttack?.rangeFeet,
      }
    : spell.area
  if (areaTargeting) {
    const casterCell = sustainedArea?.anchorCell ??
      tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
    const areaCell = areaTargeting.shape === 'circle' && areaTargeting.origin === 'self'
      ? casterCell
      : payload.areaTargetCell
    const orientation = payload.areaTargetOrientation
    const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
    const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
    if (
      !areaCell || !Number.isInteger(areaCell.col) || !Number.isInteger(areaCell.row) ||
      areaCell.col < 0 || areaCell.row < 0 || areaCell.col >= columns || areaCell.row >= rows ||
      !canPlaceAoe(areaTargeting, casterCell, areaCell) ||
      (orientation != null && (
        areaTargeting.shape !== 'rect' || !areaTargeting.rotatable ||
        !Number.isInteger(orientation) || orientation < 0 || orientation > 3
      ))
    ) return { ok: false, reason: 'invalid-target' }
    if (areaTargeting.origin === 'point') {
      const areaPoint = {
        x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
      }
      const areaPointElevation = mapGeometryTerrainElevationAtPoint(geometry, areaPoint)
      if (sustainedAttack?.origin !== 'effect-token' && mapGeometryLineOfEffectBlocked({
        geometry,
        from: actorToken,
        to: areaPoint,
        fromElevationFeet: mapGeometryTokenElevation(geometry, actorToken),
        toElevationFeet: areaPointElevation,
      })) return { ok: false, reason: 'effect-line-blocked' }
      if (spell.id === 'flaming-sphere' && input.map.tokens.some((candidate) =>
        candidate.type !== 'obstacle' && tokenOccupiedCellsAt(candidate, input.map, candidate)
          .some((cell) => cellKey(cell) === cellKey(areaCell)),
      )) return { ok: false, reason: 'invalid-target' }
    }
    const orientFrom = aoeOrientFromCell(areaTargeting, casterCell, areaCell, { rectRotation: orientation })
    const cells = cellsForAoe(areaTargeting, orientFrom, areaCell)
    areaCells = cells
    areaAnchorCell = areaCell
    const effectOrigin = areaTargeting.origin === 'point'
      ? {
          x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
          y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
        }
      : actorToken
    const effectOriginElevation = areaTargeting.origin === 'point'
      ? mapGeometryTerrainElevationAtPoint(geometry, effectOrigin)
      : mapGeometryTokenElevation(geometry, actorToken)
    const authoritativeTargets = tokensInCells(input.map, input.map.tokens, cells).filter((candidate) => {
      if (candidate.type === 'obstacle' || (candidate.id === actorToken.id && !spell.areaIncludesSelf)) return false
      const opposed = areOpposedCombatTokens(actorToken, candidate)
      if (spell.target === 'hostile' && !opposed) return false
      if (spell.target === 'ally' && opposed) return false
      return !mapGeometryLineOfEffectBlocked({
        geometry,
        from: effectOrigin,
        to: candidate,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, candidate),
      })
    })
    const authoritativeIds = new Set(authoritativeTargets.map((candidate) => candidate.id))
    if (spell.target !== 'area' && requestedTargetIds.some((targetId) => !authoritativeIds.has(targetId))) {
      return { ok: false, reason: 'invalid-target' }
    }
    if (!persistentArea) {
      if (spell.target === 'area') {
        // The player submits only the point/template. The DM Host owns target
        // discovery, including hidden creatures and line-of-effect changes that
        // may not exist in the player's projected or slightly stale map.
        requestedTargetIds = authoritativeTargets.map((candidate) => candidate.id)
        if (requestedTargetIds.length > maximumTargets) return { ok: false, reason: 'invalid-target' }
        validTargetTokens = [...authoritativeTargets]
      }
    }
  } else if (payload.areaTargetCell != null || payload.areaTargetOrientation != null) {
    return { ok: false, reason: 'invalid-target' }
  }
  for (let targetIndex = 0; targetIndex < validTargetTokens.length; targetIndex += 1) {
    const target = validTargetTokens[targetIndex]
    const opposed = areOpposedCombatTokens(actorToken, target)
    if (
      (sustainedAttack && sustainedAttack.relation !== 'any' && !opposed) ||
      (!sustainedAttack && ((spell.target === 'hostile' && !opposed) || (spell.target === 'ally' && opposed)))
    ) return { ok: false, reason: 'invalid-target' }
    if (spell.secondaryTargetsWithinFeetOfFirst != null && targetIndex > 0) continue
    if (sustainedUsesArea) continue
    const distanceFeet = tokenFootprintDistanceCells(actorToken, target, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    const invocationRange = sustainedAttack
      ? sustainedAttack.rangeFeet
      : spell.id === 'eldritch-blast' && invocations.includes('eldritch-spear')
      ? 300
      : spell.rangeFeet
    const placementRange = metamagic?.kind === 'distant' ? invocationRange * 2 : invocationRange
    const areaReach = areaTargeting?.shape === 'circle'
      ? areaTargeting.radiusFeet
      : areaTargeting?.shape === 'line' || areaTargeting?.shape === 'cone'
        ? areaTargeting.lengthFeet
        : areaTargeting?.heightFeet ?? 0
    const effectiveRange = areaTargeting?.origin === 'self' ? areaReach : placementRange + areaReach
    if (distanceFeet > effectiveRange) {
      return { ok: false, reason: 'target-out-of-range' }
    }
  }
  if (spell.maximumTargetSeparationFeet != null && validTargetTokens.length > 1) {
    for (let leftIndex = 0; leftIndex < validTargetTokens.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < validTargetTokens.length; rightIndex += 1) {
        const separationFeet = tokenFootprintDistanceCells(
          validTargetTokens[leftIndex],
          validTargetTokens[rightIndex],
          input.map,
        ) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
        if (separationFeet > spell.maximumTargetSeparationFeet) return { ok: false, reason: 'invalid-target' }
      }
    }
  }
  if (spell.secondaryTargetsWithinFeetOfFirst != null && validTargetTokens.length > 1) {
    const firstTarget = validTargetTokens[0]
    for (const secondaryTarget of validTargetTokens.slice(1)) {
      const separationFeet = tokenFootprintDistanceCells(firstTarget, secondaryTarget, input.map) *
        Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
      if (separationFeet > spell.secondaryTargetsWithinFeetOfFirst) return { ok: false, reason: 'invalid-target' }
    }
  }
  const targetToken = validTargetTokens[0] ?? actorToken
  const entityAttackOriginToken = spell.sustainedAttack?.origin === 'effect-token' && payload.areaTargetCell
    ? {
        ...actorToken,
        id: authorizedSustainedEffectAreaId ?? `${actorToken.id}:spell-effect-origin`,
        characterId: undefined,
        type: 'obstacle' as const,
        size: 1,
        ...tokenCenterForAnchorCell(payload.areaTargetCell, { size: 1 }, input.map),
      }
    : undefined
  const suppliedSculptedTargetIds = payload.sculptedTargetIds ?? []
  const sculptedTargetIds = [...new Set(suppliedSculptedTargetIds)]
  const canSculpt = dnd5eCanSculptSpell({
    classId: definition.id,
    subclassId: actor.dnd5eClassChoices?.classes?.[definition.id]?.subclass,
    level: castingClassLevel,
  }, spell)
  if (
    sculptedTargetIds.length !== suppliedSculptedTargetIds.length ||
    (!canSculpt && sculptedTargetIds.length > 0) ||
    sculptedTargetIds.length > dnd5eSculptSpellMaximumTargets(spell) ||
    sculptedTargetIds.some((targetId) => targetId === actorToken.id || !requestedTargetIds.includes(targetId))
  ) return { ok: false, reason: 'invalid-target' }
  const sculptedTargetIdSet = new Set(sculptedTargetIds)
  const suppliedCarefulTargetIds = metamagic?.carefulTargetIds ?? []
  const carefulTargetIds = [...new Set(suppliedCarefulTargetIds)]
  if (
    carefulTargetIds.length !== suppliedCarefulTargetIds.length ||
    (metamagic?.kind === 'careful' && carefulTargetIds.length < 1) ||
    (metamagic?.kind !== 'careful' && carefulTargetIds.length > 0) ||
    carefulTargetIds.length > dnd5eCarefulSpellMaximumTargets(actor.abilities.cha) ||
    carefulTargetIds.some((targetId) => targetId === actorToken.id || !requestedTargetIds.includes(targetId))
  ) return { ok: false, reason: 'invalid-target' }
  const carefulTargetIdSet = new Set(carefulTargetIds)
  const heightenedTargetId = metamagic?.heightenedTargetId
  if (
    (metamagic?.kind === 'heightened' && (!heightenedTargetId || !requestedTargetIds.includes(heightenedTargetId))) ||
    (metamagic?.kind !== 'heightened' && heightenedTargetId != null)
  ) return { ok: false, reason: 'invalid-target' }
  const distanceFeet = tokenFootprintDistanceCells(entityAttackOriginToken ?? actorToken, targetToken, input.map) *
    Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)

  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  const actorIndex = snapshot.state.initiativeOrder.indexOf(actorToken.id)
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  const targetCombatant = snapshot.state.combatants[targetToken.id]
  if (
    actorIndex < 0 || !actorCombatant || !targetCombatant ||
    validTargetTokens.some((target) => !snapshot.state.combatants[target.id])
  ) return { ok: false, reason: 'combatant-missing' }
  const targetCombatants = validTargetTokens.map((token) => snapshot.state.combatants[token.id])
  const isUndeadOrConstruct = (creatureType: string | undefined) =>
    ['构装体', 'construct', '亡灵', 'undead'].includes((creatureType ?? '').toLowerCase())
  if (
    ((spell.id === 'false-life' || spell.id === 'blur' || spell.id === 'divine-favor') && targetToken.id !== actorToken.id) ||
    (spell.id === 'spare-the-dying' && (
      targetCombatant.currentHp !== 0 || targetCombatant.deathSaves.dead || isUndeadOrConstruct(targetCombatant.creatureType)
    )) ||
    (spell.id === 'hold-person' && targetCombatants.some((combatant) => {
      const type = (combatant.creatureType ?? '').toLowerCase()
      return type !== 'humanoid' && !type.includes('类人')
    })) ||
    (spell.id === 'hideous-laughter' && targetCombatants.some((combatant) => combatant.abilities.int <= 4)) ||
    (spell.id === 'hold-monster' && targetCombatants.some((combatant) => ['亡灵', 'undead'].includes((combatant.creatureType ?? '').toLowerCase())))
  ) return { ok: false, reason: 'invalid-target' }
  const healingAllocations = payload.healingAllocations?.map((allocation) => ({
    targetId: allocation.targetTokenId,
    amount: allocation.amount,
  }))
  if (spell.effect === 'healing-pool') {
    if (
      !healingAllocations || healingAllocations.length !== requestedTargetIds.length ||
      new Set(healingAllocations.map((allocation) => allocation.targetId)).size !== healingAllocations.length ||
      healingAllocations.some((allocation) =>
        !requestedTargetIds.includes(allocation.targetId) || !Number.isInteger(allocation.amount) || allocation.amount <= 0
      ) ||
      healingAllocations.reduce((sum, allocation) => sum + allocation.amount, 0) > (spell.healingPool ?? 0)
    ) return { ok: false, reason: 'invalid-action' }
  } else if (healingAllocations?.length) return { ok: false, reason: 'invalid-action' }
  const areaCell = payload.areaTargetCell
  const effectOrigin = spell.area?.origin === 'point' && areaCell
    ? {
        x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
      }
    : actorToken
  const effectOriginElevation = spell.area?.origin === 'point' && areaCell
    ? mapGeometryTerrainElevationAtPoint(geometry, effectOrigin)
    : mapGeometryTokenElevation(geometry, actorToken)
  if (validTargetTokens.some((currentTarget) => mapGeometryLineOfEffectBlocked({
    geometry,
    from: effectOrigin,
    to: currentTarget,
    fromElevationFeet: effectOriginElevation,
    toElevationFeet: mapGeometryTokenElevation(geometry, currentTarget),
  }))) return { ok: false, reason: 'effect-line-blocked' }
  if (entityAttackOriginToken) {
    const pairKey = dnd5eCombatantPairKey(actorToken.id, targetToken.id)
    snapshot.state.distanceFeetByCombatantPair ??= {}
    snapshot.state.distanceFeetByCombatantPair[pairKey] = distanceFeet
    const cover = mapGeometryCoverFromPoint({
      geometry,
      from: effectOrigin,
      to: targetToken,
      fromElevationFeet: effectOriginElevation,
      toElevationFeet: mapGeometryTokenElevation(geometry, targetToken),
    })
    applyDnd5eAttackCoverOverride(
      snapshot.state,
      actorToken.id,
      targetToken.id,
      cover.blocksLineOfEffect
        ? 'total'
        : cover.armorClassBonus === 5
          ? 'three-quarters'
          : cover.armorClassBonus === 2
            ? 'half'
            : 'none',
    )
  }
  if (spell.saveAbility === 'dex' && spell.id !== 'sacred-flame') {
    for (const currentTarget of validTargetTokens) {
      const combatant = snapshot.state.combatants[currentTarget.id]
      const cover = mapGeometryCoverFromPoint({
        geometry,
        from: effectOrigin,
        to: currentTarget,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: mapGeometryTokenElevation(geometry, currentTarget),
      })
      if (cover.armorClassBonus > 0) {
        combatant.savingThrowBonuses.dex =
          (combatant.savingThrowBonuses.dex ?? rules.abilityModifier(combatant.abilities.dex)) + cover.armorClassBonus
      }
    }
  }
  for (const [tokenId, economy] of Object.entries(input.turnEconomyByToken ?? {})) {
    const combatant = snapshot.state.combatants[tokenId]
    if (!combatant) continue
    combatant.turn = {
      ...combatant.turn,
      actionAvailable: economy.action.current > 0,
      bonusActionAvailable: economy.bonusAction.current > 0,
      reactionAvailable: economy.reaction.current > 0,
      movementRemaining: economy.movement.current,
    }
  }
  if (input.turnEconomy) {
    actorCombatant.turn = {
      ...actorCombatant.turn,
      actionAvailable: input.turnEconomy.action.current > 0,
      bonusActionAvailable: input.turnEconomy.bonusAction.current > 0,
      reactionAvailable: input.turnEconomy.reaction.current > 0,
      movementRemaining: input.turnEconomy.movement.current,
    }
  }
  const abilityModifier = rules.abilityModifier(actor.abilities[definition.spellcasting.ability])
  const damageDiceCounts = sustainedAttack || spell.sustainedAttack?.immediateAttack
    ? [dnd5eSustainedSpellAttackDiceCount(spell, slotLevel)]
    : dnd5eSpellDamageDiceCounts(
        spell,
        actor.level,
        slotLevel,
        payload.higherSlotDamageType,
      )
  const usesSpellAttackRoll = spell.effect === 'spell-attack' ||
    sustainedAttack?.resolution === 'spell-attack' ||
    (sustainedAttack != null && sustainedAttack.resolution == null)
  const effectiveSpellAttackRangeFeet = sustainedAttack?.rangeFeet ?? spell.rangeFeet
  const rangedSpellThreatened = usesSpellAttackRoll && effectiveSpellAttackRangeFeet > 5 && input.map.tokens.some((candidate) => {
    const candidateCombatant = snapshot.state.combatants[candidate.id]
    return candidate.id !== actorToken.id && candidate.type !== 'obstacle' && areOpposedCombatTokens(actorToken, candidate) &&
      dnd5eMapTokenCanThreatenRangedAttacker(actorCombatant, candidate, candidateCombatant) &&
      tokenFootprintDistanceCells(actorToken, candidate, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL) <= 5
  })
  const actorProne = actorCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const targetProne = targetCombatant.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
  const advantage = !dnd5ePreventsAttackAdvantage(targetCombatant) &&
    (dnd5eTargetGrantsAttackAdvantage(targetCombatant) || (spell.id === 'shocking-grasp' && targetCombatant.wearingMetalArmor) || actorCombatant.classState.hiddenCheckTotal != null || !!targetCombatant.classState.recklessAttackTurnKey || !!targetCombatant.classState.stunnedByActorId ||
      dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) ||
      dnd5eHelpAttackApplies(snapshot.state, actorCombatant, targetCombatant) || (targetProne && distanceFeet <= 5))
  const disadvantage = rangedSpellThreatened || actorCombatant.exhaustionLevel >= 3 || dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant) || dnd5eTargetIsDodging(targetCombatant) ||
    dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, targetToken.id) ||
    dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) ||
    dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || actorProne || (targetProne && distanceFeet > 5)
  const attackMode = usesSpellAttackRoll && metamagic?.kind !== 'twinned' && spell.id !== 'eldritch-blast'
    ? resolveDnd5eRollMode({
        advantage: [{ active: advantage, reason: 'spell-attack-advantage' }],
        disadvantage: [{ active: disadvantage, reason: 'spell-attack-disadvantage' }],
      }).mode
    : undefined
  const sequencedSpellAttackTargets = dnd5eSpellUsesSequencedAttacks(spell)
    ? projectileTargetIds!.map((targetId) => validTargetTokens.find((token) => token.id === targetId)!)
    : validTargetTokens
  const targetSpellAttacks = usesSpellAttackRoll &&
    (metamagic?.kind === 'twinned' || dnd5eSpellUsesSequencedAttacks(spell))
    ? sequencedSpellAttackTargets.map((currentTargetToken, targetIndex) => {
        const currentTarget = snapshot.state.combatants[currentTargetToken.id]!
        const currentDistanceFeet = tokenFootprintDistanceCells(actorToken, currentTargetToken, input.map) *
          Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
        const currentTargetProne = currentTarget.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
        const currentAdvantage = !dnd5ePreventsAttackAdvantage(currentTarget) &&
          (dnd5eTargetGrantsAttackAdvantage(currentTarget) ||
            (spell.id === 'shocking-grasp' && currentTarget.wearingMetalArmor) ||
            (targetIndex === 0 && actorCombatant.classState.hiddenCheckTotal != null) ||
            !!currentTarget.classState.recklessAttackTurnKey || !!currentTarget.classState.stunnedByActorId ||
            dnd5eAttackerIsUnseenForAttack(snapshot.state, actorToken.id, currentTarget.id) ||
            (currentTargetProne && currentDistanceFeet <= 5))
        const currentDisadvantage = rangedSpellThreatened || actorCombatant.exhaustionLevel >= 3 || dnd5eTargetIsDodging(currentTarget) ||
          dnd5eBlurImposesAttackDisadvantage(snapshot.state, actorToken.id, currentTarget.id) ||
          (targetIndex === 0 && dnd5eHasViciousMockeryAttackDisadvantage(actorCombatant)) ||
          dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, currentTarget.id) || actorProne ||
          (currentTargetProne && currentDistanceFeet > 5)
        return {
          targetToken: currentTargetToken,
          mode: resolveDnd5eRollMode({
            advantage: [{ active: currentAdvantage, reason: 'spell-target-attack-advantage' }],
            disadvantage: [{ active: currentDisadvantage, reason: 'spell-target-attack-disadvantage' }],
          }).mode,
          armorClass: dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, currentTargetToken.id),
        }
      })
    : undefined
  const savingThrowAbility = spell.saveAbility ?? spell.unwillingSaveAbility
  const unwillingTargetTokens = spell.unwillingSaveAbility
    ? validTargetTokens.filter((candidate) => areOpposedCombatTokens(actorToken, candidate))
    : []
  const spellSavingThrowMode = (combatant: typeof targetCombatant, targetId: string) => {
    let mode = dnd5eHeightenedSavingThrowMode(
      dnd5eSavingThrowMode(combatant, savingThrowAbility!, {
        effectVisible: true,
        sourceCreatureType: actorCombatant.creatureType,
        sourceIsSpell: true,
      }),
      heightenedTargetId === targetId,
    )
    const creatureType = (combatant.creatureType ?? '').trim().toLowerCase()
    if (spell.id === 'blight' && (creatureType === 'plant' || creatureType.includes('植物'))) {
      mode = dnd5eHeightenedSavingThrowMode(mode, true)
    }
    if (
      spell.id === 'sunburst' &&
      (creatureType === 'undead' || creatureType.includes('亡灵') || creatureType === 'ooze' || creatureType.includes('泥怪'))
    ) mode = dnd5eHeightenedSavingThrowMode(mode, true)
    return mode
  }
  const usesSingleSavingThrow = (
    spell.effect === 'saving-throw' &&
    validTargetTokens.length === 1 &&
    sculptedTargetIds.length === 0 &&
    carefulTargetIds.length === 0
  ) || (
    spell.effect === 'active-effect' &&
    unwillingTargetTokens.length === 1 &&
    validTargetTokens.length === 1
  )
  const savingThrow = usesSingleSavingThrow
    ? {
        modifier: targetCombatant.savingThrowBonuses[savingThrowAbility!] ??
          rules.abilityModifier(targetCombatant.abilities[savingThrowAbility!]),
        dc: 8 + actorCombatant.proficiencyBonus + abilityModifier,
        mode: spellSavingThrowMode(targetCombatant, targetToken.id),
      }
    : undefined
  const targetSavingThrows = spell.effect === 'attack-save-debuff' ||
    (spell.effect === 'saving-throw' &&
      (validTargetTokens.length > 1 || sculptedTargetIds.length > 0 || carefulTargetIds.length > 0)) ||
    (spell.effect === 'active-effect' && unwillingTargetTokens.length > 0 && validTargetTokens.length > 1)
    ? (spell.effect === 'active-effect' ? unwillingTargetTokens : validTargetTokens).filter((currentTargetToken) =>
      !sculptedTargetIdSet.has(currentTargetToken.id) && !carefulTargetIdSet.has(currentTargetToken.id),
    ).map((currentTargetToken) => {
        const currentTarget = snapshot.state.combatants[currentTargetToken.id]!
        return {
          targetToken: currentTargetToken,
          modifier: currentTarget.savingThrowBonuses[savingThrowAbility!] ??
            rules.abilityModifier(currentTarget.abilities[savingThrowAbility!]),
          dc: 8 + actorCombatant.proficiencyBonus + abilityModifier,
          mode: spellSavingThrowMode(currentTarget, currentTargetToken.id),
          blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, currentTargetToken.id, 'bless'),
          baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, currentTargetToken.id, 'bane'),
        }
      })
    : undefined
  const includeNatureSanctuary = usesSpellAttackRoll
  const hostileAction = spell.target === 'hostile' || sustainedAttack != null
  const targetTranquilityWards = hostileAction &&
    (spell.effect === 'attack-save-debuff' || validTargetTokens.length > 1)
    ? validTargetTokens.flatMap((currentTargetToken) => {
        const ward = dnd5eTranquilityWardCheck(
          actorCombatant,
          snapshot.state.combatants[currentTargetToken.id]!,
          snapshot.state,
          includeNatureSanctuary,
        )
        return ward ? [{ targetToken: currentTargetToken, ward }] : []
      })
    : undefined
  return {
    ok: true,
    prepared: {
      action: input.action,
      map: sustainedAreaMovement?.ok ? sustainedAreaMovement.map : input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      castingClassId,
      castingClassLevel,
      actorToken,
      targetToken,
      targetTokens: validTargetTokens,
      projectileTargetIds,
      spell,
      slotLevel,
      diceCount: damageDiceCounts[0],
      damageDiceCounts,
      delayedDamageDiceCount: dnd5eSpellDelayedDamageDiceCount(spell, slotLevel),
      higherSlotDamageType: payload.higherSlotDamageType,
      effectBonus: spell.dice.bonus + (spell.bonusPerDie ? diceCount : 0) +
        (spell.addSpellcastingModifier ? abilityModifier : 0) +
        (spell.id === 'eldritch-blast' && invocations.includes('agonizing-blast') ? abilityModifier : 0),
      attackMode,
      targetSpellAttacks,
      attackBlessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bless'),
      attackBaned: dnd5eCombatantHasConcentrationEffect(snapshot.state, actorToken.id, 'bane'),
      savingThrow,
      savingThrowBlessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetToken.id, 'bless'),
      savingThrowBaned: dnd5eCombatantHasConcentrationEffect(snapshot.state, targetToken.id, 'bane'),
      targetSavingThrows,
      tranquilityWard: hostileAction && spell.effect !== 'attack-save-debuff' && validTargetTokens.length === 1
        ? dnd5eTranquilityWardCheck(actorCombatant, targetCombatant, snapshot.state, includeNatureSanctuary)
        : undefined,
      targetTranquilityWards,
      overchannel,
      overchannelSelfDamageDiceCount,
      sculptedTargetIds,
      metamagic,
      empowered,
      carefulTargetIds,
      draconicResistance,
      repellingBlast,
      conditionChoice,
      effectDamageType,
      enlargeReduceChoice,
      healingAllocations,
      areaCells,
      areaAnchorCell,
      areaTargetOrientation: payload.areaTargetOrientation,
      sustainedEffectAttack,
      sustainedEffectAreaId: authorizedSustainedEffectAreaId,
      areaDurationRounds: spell.concentration
        ? Math.min(
            14_400,
            dnd5eSpellConcentrationDurationRounds(spell, slotLevel) * (metamagic?.kind === 'extended' ? 2 : 1),
          )
        : spell.effect === 'persistent-area'
          ? Math.min(
              14_400,
              (spell.effectDurationRounds ?? 0) * (metamagic?.kind === 'extended' ? 2 : 1),
            )
          : undefined,
    },
  }
}

export function dnd5eSpellAttackModeWithProtection(
  mode: NonNullable<PreparedDnd5eSpellCast['attackMode']>,
  protectedAttack: boolean,
): NonNullable<PreparedDnd5eSpellCast['attackMode']> {
  return protectedAttack ? imposeDnd5eRollDisadvantage(mode, 'protection').mode : mode
}

export function previewDnd5eSpellAttack(prepared: PreparedDnd5eSpellCast, d20: number, d20Second?: number, protectedAttack = false, blessRoll?: number, baneRoll?: number) {
  if (!prepared.attackMode) throw new TypeError('spell does not use a spell attack')
  const definition = dnd5eClassDefinition(prepared.castingClassId)!
  const mode = dnd5eSpellAttackModeWithProtection(prepared.attackMode, protectedAttack)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  return rules.resolveAttack({
    rolls,
    mode,
    modifier: rules.proficiencyBonus(prepared.actor.level) + rules.abilityModifier(prepared.actor.abilities[definition.spellcasting!.ability]) + (blessRoll ?? 0) - (baneRoll ?? 0),
    targetAc: dnd5eTargetArmorClassForAttack(prepared.state, prepared.actorToken.id, prepared.targetToken.id),
  })
}

export function previewDnd5eSpellTargetAttack(
  prepared: PreparedDnd5eSpellCast,
  targetIndex: number,
  d20: number,
  d20Second?: number,
  protectedAttack = false,
  blessRoll?: number,
  baneRoll?: number,
) {
  const target = prepared.targetSpellAttacks?.[targetIndex]
  if (!target) throw new RangeError('spell does not use a target spell attack at this index')
  const definition = dnd5eClassDefinition(prepared.castingClassId)!
  const mode = dnd5eSpellAttackModeWithProtection(target.mode, protectedAttack)
  const rolls = mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  return rules.resolveAttack({
    rolls,
    mode,
    modifier: rules.proficiencyBonus(prepared.actor.level) +
      rules.abilityModifier(prepared.actor.abilities[definition.spellcasting!.ability]) +
      (blessRoll ?? 0) - (baneRoll ?? 0),
    targetAc: target.armorClass,
  })
}

export function previewDnd5eSpellSavingThrow(prepared: PreparedDnd5eSpellCast, d20: number, d20Second?: number, blessRoll?: number, baneRoll?: number) {
  if (!prepared.savingThrow) throw new TypeError('spell does not use a saving throw')
  const ability = prepared.spell.saveAbility ?? prepared.spell.unwillingSaveAbility
  if (!ability) throw new TypeError('spell does not define a saving throw ability')
  const rolls = prepared.savingThrow.mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveSavingThrow({ rolls, mode: prepared.savingThrow.mode, modifier: prepared.savingThrow.modifier + (blessRoll ?? 0) - (baneRoll ?? 0), dc: prepared.savingThrow.dc })
  const target = prepared.state.combatants[prepared.targetToken.id]
  return target && dnd5eConditionSavingThrowAutomaticallyFails(target, ability)
    ? { ...resolved, success: false }
    : resolved
}

export function previewDnd5eSpellTargetSavingThrow(
  prepared: PreparedDnd5eSpellCast,
  targetIndex: number,
  d20: number,
  d20Second?: number,
  blessRoll?: number,
  baneRoll?: number,
) {
  const savingThrow = prepared.targetSavingThrows?.[targetIndex]
  if (!savingThrow) throw new RangeError('spell does not use a target saving throw at this index')
  const ability = prepared.spell.saveAbility ?? prepared.spell.unwillingSaveAbility
  if (!ability) throw new TypeError('spell does not define a saving throw ability')
  const rolls = savingThrow.mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveSavingThrow({
    rolls,
    mode: savingThrow.mode,
    modifier: savingThrow.modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
    dc: savingThrow.dc,
  })
  const target = prepared.state.combatants[savingThrow.targetToken.id]
  return target && dnd5eConditionSavingThrowAutomaticallyFails(target, ability)
    ? { ...resolved, success: false }
    : resolved
}

export function resolvePreparedDnd5eSpellCast(input: {
  prepared: PreparedDnd5eSpellCast
  d20?: number
  d20Second?: number
  attackBlessRoll?: number
  attackBaneRoll?: number
  cuttingWords?: Dnd5eCuttingWordsUse
  cuttingWordsDamage?: Dnd5eCuttingWordsUse
  standAgainstTide?: Dnd5eStandAgainstTideUse
  savingThrowD20?: number
  savingThrowD20Second?: number
  savingThrowBlessRoll?: number
  savingThrowBaneRoll?: number
  targetSavingThrows?: readonly Dnd5eSpellTargetSavingThrowRoll[]
  forcedMovements?: readonly Dnd5eSpellForcedMovement[]
  targetAttacks?: readonly Dnd5eSpellTargetAttackRoll[]
  empoweredRerolls?: readonly Dnd5eEmpoweredSpellReroll[]
  targetTranquilitySaves?: readonly Dnd5eTargetTranquilitySaveRoll[]
  savingThrowRerollD20?: number
  savingThrowRerollD20Second?: number
  bardicInspirationRoll?: number
  darkOnesOwnLuckRoll?: number
  hurlThroughHellDamageRolls?: readonly number[]
  overchannelSelfDamageRolls?: readonly number[]
  protectionReactionActorId?: string
  shieldSpellReaction?: boolean
  counterspellReaction?: Dnd5eCounterspellReaction
  shieldSpellReactionTargetIds?: readonly string[]
  legendaryResistanceTargetIds?: readonly string[]
  dispelMagicChecks?: readonly Dnd5eDispelMagicCheck[]
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  uncannyDodge?: boolean
  effectRolls: readonly number[]
  additionalEffectRolls?: readonly (readonly number[])[]
  delayedEffectRolls?: readonly number[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  let result = resolveDnd5eHeadlessAction(prepared.state, {
    type: 'cast-spell',
    actorId: prepared.actorToken.id,
    castingClassId: prepared.castingClassId,
    targetId: prepared.targetToken.id,
    targetIds: prepared.targetTokens.map((target) => target.id),
    projectileTargetIds: prepared.projectileTargetIds,
    sculptedTargetIds: prepared.sculptedTargetIds,
    metamagic: prepared.metamagic,
    empowered: prepared.empowered,
    empoweredRerolls: input.empoweredRerolls,
    draconicResistance: prepared.draconicResistance,
    repellingBlast: prepared.repellingBlast,
    conditionChoice: prepared.conditionChoice,
    effectDamageType: prepared.effectDamageType,
    enlargeReduceChoice: prepared.enlargeReduceChoice,
    sustainedEffectAttack: prepared.sustainedEffectAttack,
    sustainedEffectAreaId: prepared.sustainedEffectAreaId,
    healingAllocations: prepared.healingAllocations,
    counterspellReaction: input.counterspellReaction,
    spellId: prepared.spell.id,
    slotLevel: prepared.slotLevel,
    higherSlotDamageType: prepared.higherSlotDamageType,
    d20: input.d20,
    d20Second: input.d20Second,
    attackBlessRoll: input.attackBlessRoll,
    attackBaneRoll: input.attackBaneRoll,
    cuttingWords: input.cuttingWords,
    cuttingWordsDamage: input.cuttingWordsDamage,
    standAgainstTide: input.standAgainstTide,
    mode: prepared.attackMode,
    targetAttacks: input.targetAttacks,
    protectionReactionActorId: input.protectionReactionActorId,
    shieldSpellReaction: input.shieldSpellReaction,
    shieldSpellReactionTargetIds: input.shieldSpellReactionTargetIds,
    legendaryResistanceTargetIds: input.legendaryResistanceTargetIds,
    dispelMagicChecks: input.dispelMagicChecks,
    tranquilitySave: input.tranquilitySave,
    targetTranquilitySaves: input.targetTranquilitySaves,
    savingThrowD20: input.savingThrowD20,
    savingThrowD20Second: input.savingThrowD20Second,
    savingThrowBlessRoll: input.savingThrowBlessRoll,
    savingThrowBaneRoll: input.savingThrowBaneRoll,
    targetSavingThrows: input.targetSavingThrows,
    forcedMovements: input.forcedMovements,
    savingThrowRerollD20: input.savingThrowRerollD20,
    savingThrowRerollD20Second: input.savingThrowRerollD20Second,
    bardicInspirationRoll: input.bardicInspirationRoll,
    darkOnesOwnLuckRoll: input.darkOnesOwnLuckRoll,
      hurlThroughHellDamageRolls: input.hurlThroughHellDamageRolls,
      overchannel: input.prepared.overchannel,
      overchannelSelfDamageRolls: input.overchannelSelfDamageRolls,
      uncannyDodge: input.uncannyDodge,
    effectRolls: input.effectRolls,
    additionalEffectRolls: input.additionalEffectRolls,
    delayedEffectRolls: input.delayedEffectRolls,
  })
  if (!result.ok) return { result }
  let application = planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    })
  const declaration = getDnd5eCoreSpellAreaDeclaration(prepared.spell.id)
  const counterspelled = result.events.some((event) =>
    event.type === 'counterspell-resolved' &&
    event.casterId === prepared.actorToken.id &&
    event.spellId === prepared.spell.id &&
    event.success,
  )
  if (
    declaration &&
    prepared.areaCells &&
    prepared.areaAnchorCell &&
    !prepared.sustainedEffectAttack &&
    !counterspelled
  ) {
    const actorCombatant = result.state.combatants[prepared.actorToken.id]
    const definition = dnd5eClassDefinition(prepared.castingClassId)
    if (actorCombatant && definition?.spellcasting) {
      const sourceSaveDc = 8 + actorCombatant.proficiencyBonus +
        rules.abilityModifier(actorCombatant.abilities[definition.spellcasting.ability])
      const effectTokenId = declaration.anchorMode === 'effect-token'
        ? `core-spell-effect:${prepared.action.id}`
        : undefined
      const coreAreaAnchorCell = declaration.spellId === 'call-lightning'
        ? tokenAnchorCellFromPixel(
            prepared.actorToken.x,
            prepared.actorToken.y,
            prepared.actorToken,
            application.map,
          )
        : prepared.areaAnchorCell
      const coreAreaCells = declaration.spellId === 'call-lightning'
        ? cellsForAoe(declaration.template, coreAreaAnchorCell, coreAreaAnchorCell)
        : prepared.areaCells
      const wallDamageCells = declaration.spellId === 'wall-of-fire'
        ? dnd5eWallOfFireDamagingSideCells({
            wallCells: coreAreaCells,
            orientation: prepared.areaTargetOrientation ?? 0,
            map: application.map,
          })
        : undefined
      const area = createDnd5eCoreSpellArea({
        declaration,
        actionId: prepared.action.id,
        sourceCharacterId: prepared.actor.id,
        sourceTokenId: prepared.actorToken.id,
        slotLevel: prepared.slotLevel,
        sourceSaveDc,
        round: result.state.round,
        cells: coreAreaCells,
        anchorCell: coreAreaAnchorCell,
        durationRounds: prepared.areaDurationRounds,
        sourceAlignment: prepared.actor.alignment,
        anchorTokenId: effectTokenId,
        triggerCellsById: wallDamageCells
          ? { 'wall-of-fire-turn-end': wallDamageCells }
          : undefined,
      })
      const effectToken = effectTokenId
        ? {
            id: effectTokenId,
            label: declaration.label,
            ...tokenCenterForAnchorCell(prepared.areaAnchorCell, { size: 1 }, application.map),
            color: declaration.color,
            emoji: prepared.spell.id === 'flaming-sphere'
              ? '🔥'
              : prepared.spell.id === 'spiritual-weapon'
                ? '⚔'
                : '✦',
            size: 1,
            type: 'obstacle' as const,
            showHpOnToken: false,
            showDetailOnToken: false,
            dnd5eSpellEffect: {
              schemaVersion: 1 as const,
              spellId: prepared.spell.id,
              sourceCharacterId: prepared.actor.id,
              sourceTokenId: prepared.actorToken.id,
              createdRound: result.state.round,
              expiresAfterRound: area.expiresAfterRound,
              concentrationId: area.concentrationId,
            },
          }
        : undefined
      const existingAreas = (application.map.dnd5ePluginAreas ?? []).filter((candidate) =>
        candidate.sourceTokenId !== prepared.actorToken.id || !candidate.concentrationId,
      )
      const lightingConflict = resolveDnd5eCoreSpellLightingConflicts(existingAreas, area)
      const endedConcentrationSources = [
        ...lightingConflict.removedAreas,
        ...(!lightingConflict.applied && area.concentrationId ? [area] : []),
      ]
      if (endedConcentrationSources.length > 0) {
        const events = [...result.events]
        for (const endedArea of endedConcentrationSources) {
          if (!endedArea.concentrationId) continue
          const source = result.state.combatants[endedArea.sourceTokenId]
          if (source?.classState.concentrationSpellId === endedArea.concentrationId) {
            endDnd5eConcentration(result.state, source, events)
          }
        }
        result = { ...result, events }
        application = planDnd5eMapResultApplication({
          state: result.state,
          map: prepared.map,
          characters: prepared.characters,
          characterIdByCombatantId: prepared.characterIdByCombatantId,
        })
      }
      const liveEffectTokenIds = new Set(lightingConflict.areas.flatMap((candidate) =>
        candidate.anchorMode === 'effect-token' && candidate.anchorTokenId ? [candidate.anchorTokenId] : [],
      ))
      application.map = {
        ...application.map,
        tokens: [
          ...application.map.tokens.filter((candidate) =>
            (!candidate.dnd5eSpellEffect || liveEffectTokenIds.has(candidate.id)) &&
            (candidate.dnd5eSpellEffect?.sourceTokenId !== prepared.actorToken.id ||
              !candidate.dnd5eSpellEffect.concentrationId),
          ),
          ...(effectToken && lightingConflict.applied ? [effectToken] : []),
        ],
        dnd5ePluginAreas: lightingConflict.areas,
      }
    }
  }
  return {
    result,
    application,
  }
}
