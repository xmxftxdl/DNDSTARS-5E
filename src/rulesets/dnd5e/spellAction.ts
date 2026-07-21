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
  dnd5eTargetArmorClassForAttack,
  dnd5eTargetIsUnseenForAttack,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eFrightenedAttackDisadvantage,
  dnd5eHelpAttackApplies,
  dnd5eTranquilityWardCheck,
  resolveDnd5eHeadlessAction,
  type Dnd5eActionResult,
  type Dnd5eCuttingWordsUse,
  type Dnd5eCounterspellReaction,
  type Dnd5eEmpoweredSpellReroll,
  type Dnd5eSpellForcedMovement,
  type Dnd5eHeadlessCombatState,
  type Dnd5eSpellTargetAttackRoll,
  type Dnd5eSpellTargetSavingThrowRoll,
  type Dnd5eTargetTranquilitySaveRoll,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eStandAgainstTideUse,
} from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, dnd5eMapTokenCanThreatenRangedAttacker, planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import { dnd5eCanEmpowerSpell, dnd5eCanOverchannelSpell, dnd5eCanSculptSpell, dnd5eCarefulSpellMaximumTargets, dnd5eDraconicElementalResistanceType, dnd5eFreeSpellCastSource, dnd5eHeightenedSavingThrowMode, dnd5eMetamagicAvailableForSpell, dnd5eMetamagicCost, dnd5eSculptSpellMaximumTargets, dnd5eSpellcastingClassIdForSpell, dnd5eSpellAllowsRepeatedTargets, dnd5eSpellConcentrationDurationRounds, dnd5eSpellDamageDiceCounts, dnd5eSpellDelayedDamageDiceCount, dnd5eSpellDiceCount, dnd5eSpellHigherSlotDamageChoices, dnd5eSpellMaximumTargets, dnd5eSpellProjectileCount, dnd5eSpellUsesSequencedAttacks, getDnd5eSrdCombatSpell, type Dnd5eSrdSpellDefinition } from './spells'
import { imposeDnd5eRollDisadvantage, resolveDnd5eRollMode } from './rollMode'
import { dnd5eHasViciousMockeryAttackDisadvantage, dnd5ePreventsAttackAdvantage, dnd5eSavingThrowMode, dnd5eTargetGrantsAttackAdvantage, dnd5eTargetIsDodging } from './passiveDefenses'
import { dnd5eConditionSavingThrowAutomaticallyFails } from './conditions'
import {
  mapGeometryCoverFromPoint,
  mapGeometryLineOfEffectBlocked,
  mapGeometryMovementBlocked,
  mapGeometryRuntimeForMap,
} from '../../lib/mapGeometry'
import { createDnd5eCoreSpellArea, getDnd5eCoreSpellAreaDeclaration } from './coreSpellAreas'
import { dnd5eCharacterClassLevel } from './multiclass'

export type Dnd5eSpellCastRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'invalid-target'
  | 'target-out-of-range'
  | 'effect-line-blocked'
  | 'spell-unavailable'
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
  healingAllocations?: readonly { targetId: string; amount: number }[]
  areaCells?: readonly { col: number; row: number }[]
  areaAnchorCell?: { col: number; row: number }
  areaDurationRounds?: number
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

  const slotLevel = spell.level === 0
    ? 0
    : definition.spellcasting.kind === 'pact' && spell.level <= 5
      ? dnd5ePactSlotLevel(castingClassLevel)
      : payload.slotLevel
  const higherSlotDamageChoices = dnd5eSpellHigherSlotDamageChoices(spell, slotLevel)
  if (
    (higherSlotDamageChoices.length > 0 && !payload.higherSlotDamageType) ||
    (payload.higherSlotDamageType != null && !higherSlotDamageChoices.includes(payload.higherSlotDamageType))
  ) return { ok: false, reason: 'invalid-action' }
  if (spell.level > 0) {
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
  const diceCount = dnd5eSpellDiceCount(spell, actor.level, slotLevel)
  const projectileCount = dnd5eSpellProjectileCount(spell, actor.level, slotLevel)
  const repeatedTargets = dnd5eSpellAllowsRepeatedTargets(spell)
  const projectileTargetIds = repeatedTargets ? payload.projectileTargetIds : undefined
  if (
    (repeatedTargets && projectileTargetIds?.length !== projectileCount) ||
    (!repeatedTargets && (payload.projectileTargetIds?.length ?? 0) > 0)
  ) return { ok: false, reason: 'invalid-target' }
  const persistentArea = spell.effect === 'persistent-area'
  const requestedTargetIds = persistentArea ? [] : [...new Set(
    projectileTargetIds?.length ? projectileTargetIds : payload.targetTokenIds?.length ? payload.targetTokenIds : [payload.targetTokenId],
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
  const maximumTargets = metamagic?.kind === 'twinned' ? 2 : dnd5eSpellMaximumTargets(spell, slotLevel, actor.level)
  if (
    (!persistentArea && requestedTargetIds.length < 1) || requestedTargetIds.length > maximumTargets ||
    (metamagic?.kind === 'twinned' && requestedTargetIds.length !== 2)
  ) {
    return { ok: false, reason: 'invalid-target' }
  }
  const targetTokens = requestedTargetIds.map((id) => input.map.tokens.find((token) => token.id === id))
  if (targetTokens.some((token) => !token || token.type === 'obstacle' || token.id === actorToken.id && spell.target === 'hostile')) {
    return { ok: false, reason: 'invalid-target' }
  }
  const validTargetTokens = targetTokens as Token[]
  const geometry = mapGeometryRuntimeForMap(input.map.id)
  let areaCells: readonly { col: number; row: number }[] | undefined
  let areaAnchorCell: { col: number; row: number } | undefined
  if (spell.area) {
    const casterCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
    const areaCell = spell.area.shape === 'circle' && spell.area.origin === 'self'
      ? casterCell
      : payload.areaTargetCell
    const orientation = payload.areaTargetOrientation
    const columns = Math.max(1, Math.floor((input.map.width - input.map.gridOffsetX) / Math.max(1, input.map.gridSize)))
    const rows = Math.max(1, Math.floor((input.map.height - input.map.gridOffsetY) / Math.max(1, input.map.gridSize)))
    if (
      !areaCell || !Number.isInteger(areaCell.col) || !Number.isInteger(areaCell.row) ||
      areaCell.col < 0 || areaCell.row < 0 || areaCell.col >= columns || areaCell.row >= rows ||
      !canPlaceAoe(spell.area, casterCell, areaCell) ||
      (orientation != null && (
        spell.area.shape !== 'rect' || !spell.area.rotatable ||
        !Number.isInteger(orientation) || orientation < 0 || orientation > 3
      ))
    ) return { ok: false, reason: 'invalid-target' }
    if (spell.area.origin === 'point') {
      const areaPoint = {
        x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
        y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
      }
      if (mapGeometryLineOfEffectBlocked({
        geometry,
        from: actorToken,
        to: areaPoint,
        fromElevationFeet: actorToken.elevationFeet ?? 0,
        toElevationFeet: 0,
      })) return { ok: false, reason: 'effect-line-blocked' }
      if (spell.id === 'flaming-sphere' && input.map.tokens.some((candidate) =>
        candidate.type !== 'obstacle' && tokenOccupiedCellsAt(candidate, input.map, candidate)
          .some((cell) => cellKey(cell) === cellKey(areaCell)),
      )) return { ok: false, reason: 'invalid-target' }
    }
    const orientFrom = aoeOrientFromCell(spell.area, casterCell, areaCell, { rectRotation: orientation })
    const cells = cellsForAoe(spell.area, orientFrom, areaCell)
    areaCells = cells
    areaAnchorCell = areaCell
    const effectOrigin = spell.area.origin === 'point'
      ? {
          x: input.map.gridOffsetX + (areaCell.col + 0.5) * input.map.gridSize,
          y: input.map.gridOffsetY + (areaCell.row + 0.5) * input.map.gridSize,
        }
      : actorToken
    const effectOriginElevation = spell.area.origin === 'point' ? 0 : actorToken.elevationFeet ?? 0
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
        toElevationFeet: candidate.elevationFeet ?? 0,
      })
    })
    const authoritativeIds = new Set(authoritativeTargets.map((candidate) => candidate.id))
    if (requestedTargetIds.some((targetId) => !authoritativeIds.has(targetId))) {
      return { ok: false, reason: 'invalid-target' }
    }
    if (
      spell.target === 'area' && !persistentArea &&
      (requestedTargetIds.length !== authoritativeIds.size || [...authoritativeIds].some((targetId) => !requestedTargetIds.includes(targetId)))
    ) return { ok: false, reason: 'invalid-target' }
  } else if (payload.areaTargetCell != null || payload.areaTargetOrientation != null) {
    return { ok: false, reason: 'invalid-target' }
  }
  for (let targetIndex = 0; targetIndex < validTargetTokens.length; targetIndex += 1) {
    const target = validTargetTokens[targetIndex]
    const opposed = areOpposedCombatTokens(actorToken, target)
    if ((spell.target === 'hostile' && !opposed) || (spell.target === 'ally' && opposed)) return { ok: false, reason: 'invalid-target' }
    if (spell.secondaryTargetsWithinFeetOfFirst != null && targetIndex > 0) continue
    const distanceFeet = tokenFootprintDistanceCells(actorToken, target, input.map) * Math.max(1, input.map.feetPerCell ?? DND_FEET_PER_CELL)
    const invocationRange = spell.id === 'eldritch-blast' && invocations.includes('eldritch-spear')
      ? 300
      : spell.rangeFeet
    const placementRange = metamagic?.kind === 'distant' ? invocationRange * 2 : invocationRange
    const areaReach = spell.area?.shape === 'circle'
      ? spell.area.radiusFeet
      : spell.area?.shape === 'line' || spell.area?.shape === 'cone'
        ? spell.area.lengthFeet
        : spell.area?.heightFeet ?? 0
    const effectiveRange = spell.area?.origin === 'self' ? areaReach : placementRange + areaReach
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
  const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, input.map) *
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
    (spell.id === 'false-life' && targetToken.id !== actorToken.id) ||
    (spell.id === 'spare-the-dying' && (
      targetCombatant.currentHp !== 0 || targetCombatant.deathSaves.dead || isUndeadOrConstruct(targetCombatant.creatureType)
    )) ||
    (spell.id === 'hold-person' && targetCombatants.some((combatant) => {
      const type = (combatant.creatureType ?? '').toLowerCase()
      return type !== 'humanoid' && !type.includes('类人')
    })) ||
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
  const effectOriginElevation = spell.area?.origin === 'point' && areaCell ? 0 : actorToken.elevationFeet ?? 0
  if (validTargetTokens.some((currentTarget) => mapGeometryLineOfEffectBlocked({
    geometry,
    from: effectOrigin,
    to: currentTarget,
    fromElevationFeet: effectOriginElevation,
    toElevationFeet: currentTarget.elevationFeet ?? 0,
  }))) return { ok: false, reason: 'effect-line-blocked' }
  if (spell.saveAbility === 'dex' && spell.id !== 'sacred-flame') {
    for (const currentTarget of validTargetTokens) {
      const combatant = snapshot.state.combatants[currentTarget.id]
      const cover = mapGeometryCoverFromPoint({
        geometry,
        from: effectOrigin,
        to: currentTarget,
        fromElevationFeet: effectOriginElevation,
        toElevationFeet: currentTarget.elevationFeet ?? 0,
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
  const damageDiceCounts = dnd5eSpellDamageDiceCounts(
    spell,
    actor.level,
    slotLevel,
    payload.higherSlotDamageType,
  )
  const rangedSpellThreatened = spell.effect === 'spell-attack' && spell.rangeFeet > 5 && input.map.tokens.some((candidate) => {
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
    dnd5eFrightenedAttackDisadvantage(snapshot.state, actorCombatant) ||
    dnd5eTargetIsUnseenForAttack(snapshot.state, actorToken.id, targetToken.id) || actorProne || (targetProne && distanceFeet > 5)
  const attackMode = spell.effect === 'spell-attack' && metamagic?.kind !== 'twinned' && spell.id !== 'eldritch-blast'
    ? resolveDnd5eRollMode({
        advantage: [{ active: advantage, reason: 'spell-attack-advantage' }],
        disadvantage: [{ active: disadvantage, reason: 'spell-attack-disadvantage' }],
      }).mode
    : undefined
  const sequencedSpellAttackTargets = dnd5eSpellUsesSequencedAttacks(spell)
    ? projectileTargetIds!.map((targetId) => validTargetTokens.find((token) => token.id === targetId)!)
    : validTargetTokens
  const targetSpellAttacks = spell.effect === 'spell-attack' &&
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
  const spellSavingThrowMode = (combatant: typeof targetCombatant, targetId: string) => {
    let mode = dnd5eHeightenedSavingThrowMode(
      dnd5eSavingThrowMode(combatant, spell.saveAbility!, {
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
  const savingThrow = spell.effect === 'saving-throw' && validTargetTokens.length === 1 &&
    sculptedTargetIds.length === 0 && carefulTargetIds.length === 0
    ? {
        modifier: targetCombatant.savingThrowBonuses[spell.saveAbility!] ?? rules.abilityModifier(targetCombatant.abilities[spell.saveAbility!]),
        dc: 8 + actorCombatant.proficiencyBonus + abilityModifier,
        mode: spellSavingThrowMode(targetCombatant, targetToken.id),
      }
    : undefined
  const targetSavingThrows = spell.effect === 'attack-save-debuff' ||
    (spell.effect === 'saving-throw' &&
      (validTargetTokens.length > 1 || sculptedTargetIds.length > 0 || carefulTargetIds.length > 0))
    ? validTargetTokens.filter((currentTargetToken) =>
        !sculptedTargetIdSet.has(currentTargetToken.id) && !carefulTargetIdSet.has(currentTargetToken.id),
      ).map((currentTargetToken) => {
        const currentTarget = snapshot.state.combatants[currentTargetToken.id]!
        return {
          targetToken: currentTargetToken,
          modifier: currentTarget.savingThrowBonuses[spell.saveAbility!] ??
            rules.abilityModifier(currentTarget.abilities[spell.saveAbility!]),
          dc: 8 + actorCombatant.proficiencyBonus + abilityModifier,
          mode: spellSavingThrowMode(currentTarget, currentTargetToken.id),
          blessed: dnd5eCombatantHasConcentrationEffect(snapshot.state, currentTargetToken.id, 'bless'),
          baned: dnd5eCombatantHasConcentrationEffect(snapshot.state, currentTargetToken.id, 'bane'),
        }
      })
    : undefined
  const includeNatureSanctuary = spell.effect === 'spell-attack'
  const targetTranquilityWards = spell.target === 'hostile' &&
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
      map: input.map,
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
      tranquilityWard: spell.target === 'hostile' && spell.effect !== 'attack-save-debuff' && validTargetTokens.length === 1
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
      healingAllocations,
      areaCells,
      areaAnchorCell,
      areaDurationRounds: spell.concentration
        ? Math.min(
            14_400,
            dnd5eSpellConcentrationDurationRounds(spell, slotLevel) * (metamagic?.kind === 'extended' ? 2 : 1),
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
  const rolls = prepared.savingThrow.mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveSavingThrow({ rolls, mode: prepared.savingThrow.mode, modifier: prepared.savingThrow.modifier + (blessRoll ?? 0) - (baneRoll ?? 0), dc: prepared.savingThrow.dc })
  const target = prepared.state.combatants[prepared.targetToken.id]
  return target && prepared.spell.saveAbility && dnd5eConditionSavingThrowAutomaticallyFails(target, prepared.spell.saveAbility)
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
  const rolls = savingThrow.mode === 'normal' ? [d20] : [d20, d20Second ?? d20]
  const resolved = rules.resolveSavingThrow({
    rolls,
    mode: savingThrow.mode,
    modifier: savingThrow.modifier + (blessRoll ?? 0) - (baneRoll ?? 0),
    dc: savingThrow.dc,
  })
  const target = prepared.state.combatants[savingThrow.targetToken.id]
  return target && prepared.spell.saveAbility && dnd5eConditionSavingThrowAutomaticallyFails(target, prepared.spell.saveAbility)
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
  tranquilitySave?: Dnd5eTranquilitySaveRoll
  uncannyDodge?: boolean
  effectRolls: readonly number[]
  additionalEffectRolls?: readonly (readonly number[])[]
  delayedEffectRolls?: readonly number[]
}): { result: Dnd5eActionResult; application?: Dnd5eMapResultPlan } {
  const { prepared } = input
  const result = resolveDnd5eHeadlessAction(prepared.state, {
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
  const application = planDnd5eMapResultApplication({
      state: result.state,
      map: prepared.map,
      characters: prepared.characters,
      characterIdByCombatantId: prepared.characterIdByCombatantId,
    })
  const declaration = getDnd5eCoreSpellAreaDeclaration(prepared.spell.id)
  if (declaration && prepared.areaCells && prepared.areaAnchorCell) {
    const actorCombatant = result.state.combatants[prepared.actorToken.id]
    const definition = dnd5eClassDefinition(prepared.castingClassId)
    if (actorCombatant && definition?.spellcasting) {
      const sourceSaveDc = 8 + actorCombatant.proficiencyBonus +
        rules.abilityModifier(actorCombatant.abilities[definition.spellcasting.ability])
      const effectTokenId = declaration.anchorMode === 'effect-token'
        ? `core-spell-effect:${prepared.action.id}`
        : undefined
      const area = createDnd5eCoreSpellArea({
        declaration,
        actionId: prepared.action.id,
        sourceCharacterId: prepared.actor.id,
        sourceTokenId: prepared.actorToken.id,
        slotLevel: prepared.slotLevel,
        sourceSaveDc,
        round: result.state.round,
        cells: prepared.areaCells,
        anchorCell: prepared.areaAnchorCell,
        durationRounds: prepared.areaDurationRounds,
        sourceAlignment: prepared.actor.alignment,
        anchorTokenId: effectTokenId,
      })
      const effectToken = effectTokenId
        ? {
            id: effectTokenId,
            label: declaration.label,
            ...tokenCenterForAnchorCell(prepared.areaAnchorCell, { size: 1 }, application.map),
            color: declaration.color,
            emoji: prepared.spell.id === 'flaming-sphere' ? '🔥' : '✦',
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
      application.map = {
        ...application.map,
        tokens: [
          ...application.map.tokens.filter((candidate) =>
            candidate.dnd5eSpellEffect?.sourceTokenId !== prepared.actorToken.id ||
            !candidate.dnd5eSpellEffect.concentrationId,
          ),
          ...(effectToken ? [effectToken] : []),
        ],
        dnd5ePluginAreas: [
          ...(application.map.dnd5ePluginAreas ?? []).filter((candidate) =>
            candidate.sourceTokenId !== prepared.actorToken.id || !candidate.concentrationId,
          ),
          area,
        ],
      }
    }
  }
  return {
    result,
    application,
  }
}
