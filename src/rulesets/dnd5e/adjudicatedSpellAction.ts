import type { InitiativeEntry } from '../../components/map/InitiativeTracker'
import type {
  Dnd5eAdjudicatedSpellPayload,
  Dnd5eAdjudicatedSpellCastingVariant,
  Dnd5eTurnEconomyCounts,
  SharedPlayerActionState,
} from '../../lib/sharedCombatTypes'
import type {
  DmAdjudicationEffect,
  DmAdjudicationInterruptResponse,
} from '../../lib/combatInterruptProtocol'
import type { BattleMap, Token } from '../../store/maps'
import {
  cellDistance,
  mapCellExtent,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  type GridCell,
} from '../../lib/gridCombat'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { Character } from '../../types/character'
import { dnd5eClassDefinition, dnd5ePactSlotLevel, type Dnd5eClassId } from './classes'
import {
  endDnd5eConcentration,
  type Dnd5eActionResult,
  type Dnd5eHeadlessCombatState,
} from './headlessCombatEngine'
import {
  resolveDnd5eActionWithAirborneFallPreview,
  type Dnd5eAirborneFallDamageRolls,
  type Dnd5eAirborneFallPreview,
} from './airborneFallActionResolution'
import {
  createDnd5eMapCombatSnapshot,
  dnd5eRequestedInitiativeActorIndex,
  planDnd5eMapResultApplication,
  prepareDnd5eExplorationActor,
  type Dnd5eMapResultPlan,
} from './mapBridge'
import {
  dnd5eFreeSpellCastSource,
  dnd5eSpellcastingClassIdForSpell,
} from './spells'
import {
  dnd5eSpellbookEntryHasFullHeadlessAutomation,
  type Dnd5eSpellbookEntry,
} from './spellbook'
import {
  dnd5eSpellSupportsNarrativeObjectAlternative,
  dnd5eSpellUsesNarrativeEnvironmentResolution,
  dnd5eSpellUsesNarrativeResolution,
} from './spellNarrativeResolution'
import { dnd5eCharacterClassLevel } from './multiclass'
import { dnd5eWearingUnproficientArmor } from './equipment'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
  type Dnd5eSpellComponentRequirements,
} from './spellComponents'
import { dnd5ePersistentAreaOccupantModifiersAt } from './persistentAreaGeometry'
import {
  dnd5eCoreSpellMaterialRequirement,
  settleDnd5eSpellMaterialConsumption,
  type Dnd5eSpellMaterialConsumptionPlan,
} from './spellMaterials'
import {
  dnd5eEffectiveSpellSelections,
  dnd5eEffectiveSpellcastingSource,
  dnd5eSubclassSpellSchoolAllowed,
  dnd5eSubclassUnrestrictedSpellLimit,
} from './subclassSpellcasting'
import type { Dnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'
import {
  normalizeDnd5eSendingDeclarationV1,
  normalizeDnd5eSendingResolutionV1,
} from './sending'
import {
  dnd5eAnimalMessengerDurationRounds,
  dnd5eAnimalMessengerTokenIsTinyBeast,
  normalizeDnd5eAnimalMessengerDeclarationV1,
  normalizeDnd5eAnimalMessengerResolutionV1,
} from './animalMessenger'
import {
  normalizeDnd5eSequesterDeclarationV1,
  normalizeDnd5eSequesterResolutionV1,
} from './sequester'
import { normalizeDnd5eWishDeclarationV1 } from './wish'
import {
  dnd5eWordOfRecallSanctuary,
  normalizeDnd5eWordOfRecallDeclarationV1,
  normalizeDnd5eWordOfRecallResolutionV1,
} from './wordOfRecall'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'
import {
  dnd5eAnimateDeadAnimationCapacity,
  dnd5eAnimateDeadControlledUndead,
  dnd5eAnimateDeadReassertionCapacity,
  dnd5eAnimateDeadRemainsKind,
  dnd5eCreateUndeadCapacity,
  dnd5eCreateUndeadControlledUndead,
  dnd5eCreateUndeadIsNight,
  normalizeDnd5eAnimateDeadDeclarationV1,
  normalizeDnd5eAnimateDeadResolutionV1,
} from './animateDead'
import {
  dnd5eAnimateObjectsCapacity,
  dnd5eAnimateObjectsCapacityUsed,
  dnd5eAnimateObjectsMonsterId,
  dnd5eAnimateObjectsProfile,
  normalizeDnd5eAnimateObjectsDeclarationV1,
  normalizeDnd5eAnimateObjectsResolutionV1,
} from './animateObjects'
import {
  dnd5eCreationDurationMinutes,
  dnd5eCreationMaximumEdgeFeet,
  normalizeDnd5eCreationDeclarationV1,
} from './creation'
import {
  dnd5eCreateOrDestroyWaterCubeEdgeFeet,
  dnd5eCreateOrDestroyWaterFogAreaIds,
  dnd5eCreateOrDestroyWaterMaximumGallons,
  normalizeDnd5eCreateOrDestroyWaterDeclarationV1,
} from './createOrDestroyWater'
import {
  dnd5eRestoredSummonedOriginalObject,
  planDnd5eSummonedCreature,
} from './summonedCreatures'

function normalizedNarrativeContext(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  return normalized && normalized.length <= 360 ? normalized : undefined
}

function animateDeadPlacementCells(origin: GridCell): GridCell[] {
  const cells: GridCell[] = [{ ...origin }]
  // Remains may share a tactical cell with another token. The resulting
  // creature cannot, so prefer the original cell and then the nearest legal
  // cell. This keeps a multi-target cast atomic without silently losing it.
  for (let radius = 1; radius <= 2; radius++) {
    for (let row = origin.row - radius; row <= origin.row + radius; row++) {
      for (let col = origin.col - radius; col <= origin.col + radius; col++) {
        if (Math.max(Math.abs(col - origin.col), Math.abs(row - origin.row)) !== radius) continue
        cells.push({ col, row })
      }
    }
  }
  return cells
}

function animateObjectPlacementCells(origin: GridCell): GridCell[] {
  const cells: GridCell[] = [{ ...origin }]
  // Unlike a normal summon, an animated object already exists at the chosen
  // point and can legally have been sharing space with a creature or another
  // unattended object before it becomes a creature. Search a wider, nearest-
  // first ring so the atomic replacement can settle into the nearest legal
  // footprint instead of failing after the DM has approved the cast.
  for (let radius = 1; radius <= 8; radius++) {
    for (let row = origin.row - radius; row <= origin.row + radius; row++) {
      for (let col = origin.col - radius; col <= origin.col + radius; col++) {
        if (Math.max(Math.abs(col - origin.col), Math.abs(row - origin.row)) !== radius) continue
        cells.push({ col, row })
      }
    }
  }
  return cells
}

export type Dnd5eAdjudicatedSpellRejectReason =
  | 'invalid-action'
  | 'invalid-actor'
  | 'spell-unavailable'
  | 'spell-not-known-or-prepared'
  | 'spellcasting-class-unavailable'
  | 'spell-school-restricted'
  | 'wild-shape-spellcasting-unavailable'
  | 'armor-proficiency-required'
  | 'component-unavailable'
  | 'verbal-component-unavailable'
  | 'somatic-component-unavailable'
  | 'material-component-unavailable'
  | 'costly-material-unavailable'
  | 'slot-unavailable'
  | 'ritual-unavailable'
  | 'action-unavailable'
  | 'bonus-action-unavailable'
  | 'combatant-missing'
  | 'invalid-adjudication'

export interface PreparedDnd5eAdjudicatedSpell {
  action: SharedPlayerActionState
  payload: Dnd5eAdjudicatedSpellPayload
  spell: Dnd5eSpellbookEntry
  castingTime: 'action' | 'bonus-action' | 'reaction' | 'long'
  /** Whole campaign-clock minutes elapsed before the spell takes effect. */
  elapsedCastingMinutes: number
  concentration: boolean
  suggestedConcentrationRounds?: number
  description: string
  map: BattleMap
  characters: readonly Character[]
  characterIdByCombatantId: Record<string, string>
  state: Dnd5eHeadlessCombatState
  actor: Character
  castingClassId: Dnd5eClassId
  castingClassLevel: number
  actorToken: Token
  spellMaterialPlan?: Dnd5eSpellMaterialConsumptionPlan
  slotLevel: number
  ritual: boolean
}

function dnd5eAdjudicatedSpellComponentRequirements(
  spell: Dnd5eSpellbookEntry,
  context?: { createUndeadCorpseCount?: number },
): Dnd5eSpellComponentRequirements {
  if (!spell.imported) {
    const base = dnd5eCoreSpellComponentRequirements(spell.id)
    return {
      ...base,
      specificMaterial: dnd5eCoreSpellMaterialRequirement(spell.id, context),
    }
  }
  return {
    verbal: spell.imported.components.verbal,
    somatic: spell.imported.components.somatic,
    material: spell.imported.components.material,
    costlyMaterial: (spell.imported.components.materialCostGp ?? 0) > 0,
    consumedMaterial: spell.imported.components.materialConsumed === true,
    specificMaterial: spell.imported.components.materialRequirement ??
      dnd5eCoreSpellMaterialRequirement(spell.id, context),
  }
}

/**
 * Whole campaign-clock minutes consumed by a DM-adjudicated spell outside
 * initiative. Action-sized casts are below the shared clock's one-minute
 * resolution, while rituals add ten minutes to the printed casting time.
 */
export function dnd5eAdjudicatedSpellElapsedCastingMinutes(
  spell: Dnd5eSpellbookEntry,
  ritual: boolean,
  castingVariant?: Dnd5eAdjudicatedSpellCastingVariant,
): number {
  if (spell.id === 'plant-growth') {
    return castingVariant === 'plant-growth-8-hours' ? 8 * 60 : 0
  }
  let printedMinutes = 0
  if (spell.imported) {
    const { value, unit } = spell.imported.castingTime
    printedMinutes = unit === 'hour' ? value * 60 : unit === 'minute' ? value : 0
  } else {
    const castingTime = spell.reference?.castingTime ?? ''
    const amount = Number(castingTime.match(/\d+(?:\.\d+)?/)?.[0] ?? 0)
    if (/小时|hour/i.test(castingTime)) printedMinutes = amount * 60
    else if (/分钟|minute/i.test(castingTime)) printedMinutes = amount
  }
  return Math.max(0, Math.floor(printedMinutes + (ritual ? 10 : 0)))
}

export function dnd5eSpellbookEntryCastingTime(
  spell: Dnd5eSpellbookEntry,
): 'action' | 'bonus-action' | 'reaction' | 'unsupported' {
  if (spell.imported) {
    if (spell.imported.castingTime.value !== 1) return 'unsupported'
    const unit = spell.imported.castingTime.unit
    return unit === 'action' || unit === 'bonus-action' || unit === 'reaction' ? unit : 'unsupported'
  }
  const value = spell.reference?.castingTime ?? ''
  if (/附赠动作|bonus\s*action/i.test(value)) return 'bonus-action'
  if (/反应|reaction/i.test(value)) return 'reaction'
  if (/动作|action/i.test(value)) return 'action'
  return 'unsupported'
}

export function dnd5eSpellbookEntryIsConcentration(spell: Dnd5eSpellbookEntry): boolean {
  return spell.imported?.duration.concentration === true || /专注|concentration/i.test(spell.reference?.duration ?? '')
}

const DND5E_ADJUDICATED_CONCENTRATION_REMOVAL_SLOT: Readonly<Record<string, number>> = {
  'bestow-curse': 5,
  'major-image': 6,
}

function dnd5eSpellbookEntryIsConcentrationAtSlot(
  spell: Dnd5eSpellbookEntry,
  slotLevel: number,
): boolean {
  const removalSlot = DND5E_ADJUDICATED_CONCENTRATION_REMOVAL_SLOT[spell.id]
  return dnd5eSpellbookEntryIsConcentration(spell) &&
    (removalSlot == null || slotLevel < removalSlot)
}

export function dnd5eSpellbookEntrySuggestedConcentrationRounds(
  spell: Dnd5eSpellbookEntry,
): number | undefined {
  if (!dnd5eSpellbookEntryIsConcentration(spell)) return undefined
  if (spell.imported?.duration.type === 'timed') {
    const value = Math.max(1, Math.floor(spell.imported.duration.value ?? 1))
    const multiplier = spell.imported.duration.unit === 'round'
      ? 1
      : spell.imported.duration.unit === 'minute'
        ? 10
        : spell.imported.duration.unit === 'hour'
          ? 600
          : 14_400
    return Math.min(14_400, value * multiplier)
  }
  const duration = spell.reference?.duration ?? ''
  const amount = Math.max(1, Number(duration.match(/\d+/)?.[0] ?? 1))
  if (/轮|round/i.test(duration)) return Math.min(14_400, amount)
  if (/分钟|minute/i.test(duration)) return Math.min(14_400, amount * 10)
  if (/小时|hour/i.test(duration)) return Math.min(14_400, amount * 600)
  if (/日|天|day/i.test(duration)) return 14_400
  return 10
}

export function dnd5eSpellbookEntryDescription(spell: Dnd5eSpellbookEntry): string {
  const description = spell.imported?.description ?? spell.reference?.description ?? ''
  const higherLevels = spell.imported?.higherLevels ?? spell.reference?.higherLevels
  return higherLevels ? `${description}\n\n升环施法：${higherLevels}` : description
}

export function prepareDnd5eAdjudicatedSpell(input: {
  action: SharedPlayerActionState
  spell: Dnd5eSpellbookEntry | undefined
  spellbookEntries?: readonly Dnd5eSpellbookEntry[]
  map: BattleMap
  characters: readonly Character[]
  initiativeOrder: readonly InitiativeEntry[]
  turnEconomy?: Dnd5eTurnEconomyCounts
  turnEconomyByToken?: Readonly<Record<string, Dnd5eTurnEconomyCounts>>
  effectiveRules?: Dnd5eEffectiveRulesContextV1 | null
}): { ok: true; prepared: PreparedDnd5eAdjudicatedSpell } | { ok: false; reason: Dnd5eAdjudicatedSpellRejectReason } {
  const payload = input.action.dnd5eAdjudicatedSpell
  const narrativeOnly = payload?.narrativeOnly === true
  if (
    input.action.type !== 'dnd5e-adjudicated-spell' || !payload || !input.spell ||
    (dnd5eSpellbookEntryHasFullHeadlessAutomation(input.spell) && payload.ritual !== true &&
      !(narrativeOnly && (
        dnd5eSpellUsesNarrativeResolution(input.spell.id) ||
        dnd5eSpellSupportsNarrativeObjectAlternative(input.spell.id)
      )))
  ) {
    return { ok: false, reason: 'invalid-action' }
  }
  if (
    payload.spellId !== input.spell.id || !Number.isInteger(payload.slotLevel) ||
    payload.slotLevel < 0 || payload.slotLevel > 9
  ) return { ok: false, reason: 'invalid-action' }
  if (narrativeOnly && (
    payload.sending != null || payload.animalMessenger != null || payload.animateDead != null ||
    payload.animateObjects != null || payload.creation != null || payload.createOrDestroyWater != null || payload.sequester != null || payload.wordOfRecall != null ||
    payload.wish != null
  )) return { ok: false, reason: 'invalid-action' }
  const environmentNarrativeContext = narrativeOnly && dnd5eSpellUsesNarrativeEnvironmentResolution(input.spell.id)
    ? normalizedNarrativeContext(payload.narrativeContext)
    : undefined
  if (
    (payload.narrativeContext != null && (!narrativeOnly || !dnd5eSpellUsesNarrativeEnvironmentResolution(input.spell.id))) ||
    (narrativeOnly && dnd5eSpellUsesNarrativeEnvironmentResolution(input.spell.id) && !environmentNarrativeContext)
  ) return { ok: false, reason: 'invalid-action' }
  const sending = !narrativeOnly && input.spell.id === 'sending'
    ? normalizeDnd5eSendingDeclarationV1(payload.sending)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'sending' && !sending) ||
    (input.spell.id !== 'sending' && payload.sending != null)
  ) return { ok: false, reason: 'invalid-action' }
  const animalMessenger = !narrativeOnly && input.spell.id === 'animal-messenger'
    ? normalizeDnd5eAnimalMessengerDeclarationV1(payload.animalMessenger)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'animal-messenger' && !animalMessenger) ||
    (input.spell.id !== 'animal-messenger' && payload.animalMessenger != null)
  ) return { ok: false, reason: 'invalid-action' }
  const usesUndeadCreationDeclaration = input.spell.id === 'animate-dead' || input.spell.id === 'create-undead'
  const animateDead = !narrativeOnly && usesUndeadCreationDeclaration
    ? normalizeDnd5eAnimateDeadDeclarationV1(payload.animateDead)
    : undefined
  if (
    (!narrativeOnly && usesUndeadCreationDeclaration && !animateDead) ||
    (!usesUndeadCreationDeclaration && payload.animateDead != null) ||
    (input.spell.id === 'animate-dead' && animateDead?.undeadKind != null) ||
    (input.spell.id === 'create-undead' && animateDead?.undeadKind == null)
  ) return { ok: false, reason: 'invalid-action' }
  const animateObjects = !narrativeOnly && input.spell.id === 'animate-objects'
    ? normalizeDnd5eAnimateObjectsDeclarationV1(payload.animateObjects)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'animate-objects' && !animateObjects) ||
    (input.spell.id !== 'animate-objects' && payload.animateObjects != null)
  ) return { ok: false, reason: 'invalid-action' }
  const creation = !narrativeOnly && input.spell.id === 'creation'
    ? normalizeDnd5eCreationDeclarationV1(payload.creation)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'creation' && !creation) ||
    (input.spell.id !== 'creation' && payload.creation != null)
  ) return { ok: false, reason: 'invalid-action' }
  const createOrDestroyWater = !narrativeOnly && input.spell.id === 'create-or-destroy-water'
    ? normalizeDnd5eCreateOrDestroyWaterDeclarationV1(payload.createOrDestroyWater)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'create-or-destroy-water' && !createOrDestroyWater) ||
    (input.spell.id !== 'create-or-destroy-water' && payload.createOrDestroyWater != null)
  ) return { ok: false, reason: 'invalid-action' }
  const sequester = !narrativeOnly && input.spell.id === 'sequester'
    ? normalizeDnd5eSequesterDeclarationV1(payload.sequester)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'sequester' && !sequester) ||
    (input.spell.id !== 'sequester' && payload.sequester != null)
  ) return { ok: false, reason: 'invalid-action' }
  const wish = !narrativeOnly && input.spell.id === 'wish'
    ? normalizeDnd5eWishDeclarationV1(payload.wish)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'wish' && !wish) ||
    (input.spell.id !== 'wish' && payload.wish != null)
  ) return { ok: false, reason: 'invalid-action' }
  const wordOfRecall = !narrativeOnly && input.spell.id === 'word-of-recall'
    ? normalizeDnd5eWordOfRecallDeclarationV1(payload.wordOfRecall)
    : undefined
  if (
    (!narrativeOnly && input.spell.id === 'word-of-recall' && !wordOfRecall) ||
    (input.spell.id !== 'word-of-recall' && payload.wordOfRecall != null)
  ) return { ok: false, reason: 'invalid-action' }
  const castingVariant = input.spell.id === 'plant-growth'
    ? payload.castingVariant ?? 'plant-growth-action'
    : payload.castingVariant
  if (
    castingVariant != null && !(
      input.spell.id === 'plant-growth' &&
      (castingVariant === 'plant-growth-action' || castingVariant === 'plant-growth-8-hours')
    )
  ) return { ok: false, reason: 'invalid-action' }
  const actor = input.characters.find((character) => character.id === input.action.characterId)
  const actorToken = input.map.tokens.find((token) =>
    token.id === input.action.actorTokenId && token.characterId === input.action.characterId,
  )
  const enforceSpellcastingPrerequisites =
    input.effectiveRules?.houseRules.spellcastingPrerequisitesEnabled !== false
  if (!actor || !actorToken || actor.currentHp <= 0) return { ok: false, reason: 'invalid-actor' }
  if (creation) {
    const maximumEdgeFeet = dnd5eCreationMaximumEdgeFeet(payload.slotLevel)
    const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
    const casterCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
    const extent = mapCellExtent(input.map)
    const footprintCells = Math.max(1, Math.ceil(creation.edgeFeet / feetPerCell))
    const matchesActionCell = input.action.targetCell?.col === creation.targetCell.col &&
      input.action.targetCell?.row === creation.targetCell.row
    if (
      maximumEdgeFeet < 1 || creation.edgeFeet > maximumEdgeFeet || !matchesActionCell ||
      cellDistance(casterCell, creation.targetCell) * feetPerCell > 30 ||
      creation.targetCell.col + footprintCells > extent.cols ||
      creation.targetCell.row + footprintCells > extent.rows
    ) return { ok: false, reason: 'invalid-action' }
  }
  if (createOrDestroyWater) {
    const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
    const casterCell = tokenAnchorCellFromPixel(actorToken.x, actorToken.y, actorToken, input.map)
    const extent = mapCellExtent(input.map)
    const matchesActionCell = input.action.targetCell?.col === createOrDestroyWater.targetCell.col &&
      input.action.targetCell?.row === createOrDestroyWater.targetCell.row
    if (!matchesActionCell) return { ok: false, reason: 'invalid-action' }
    if (createOrDestroyWater.mode === 'create-container' || createOrDestroyWater.mode === 'destroy-container') {
      const target = input.map.tokens.find((candidate) =>
        candidate.id === createOrDestroyWater.targetObjectId && candidate.type === 'obstacle')
      const container = normalizeDnd5eMapObjectStateV1(target?.dnd5eObjectState)?.waterContainer
      const targetCell = target
        ? tokenAnchorCellFromPixel(target.x, target.y, target, input.map)
        : undefined
      const distanceFeet = target
        ? tokenFootprintDistanceCells(actorToken, target, input.map) * feetPerCell
        : Number.POSITIVE_INFINITY
      const maximumGallons = dnd5eCreateOrDestroyWaterMaximumGallons(payload.slotLevel)
      const gallons = createOrDestroyWater.gallons ?? 0
      if (
        !target || target.label !== createOrDestroyWater.targetObjectName || !container?.open || !targetCell ||
        createOrDestroyWater.targetCell.col !== targetCell.col || createOrDestroyWater.targetCell.row !== targetCell.row ||
        distanceFeet > 30 || gallons > maximumGallons ||
        (createOrDestroyWater.mode === 'create-container' && gallons > container.capacityGallons - container.waterGallons) ||
        (createOrDestroyWater.mode === 'destroy-container' && gallons > container.waterGallons)
      ) return { ok: false, reason: 'invalid-action' }
    } else {
      const expectedEdgeFeet = dnd5eCreateOrDestroyWaterCubeEdgeFeet(payload.slotLevel)
      const edgeCells = Math.max(1, Math.ceil(expectedEdgeFeet / feetPerCell))
      if (
        createOrDestroyWater.areaEdgeFeet !== expectedEdgeFeet ||
        cellDistance(casterCell, createOrDestroyWater.targetCell) * feetPerCell > 30 ||
        createOrDestroyWater.targetCell.col + edgeCells > extent.cols ||
        createOrDestroyWater.targetCell.row + edgeCells > extent.rows
      ) return { ok: false, reason: 'invalid-action' }
      if (createOrDestroyWater.mode === 'destroy-fog') {
        const expectedFogAreaIds = dnd5eCreateOrDestroyWaterFogAreaIds({
          map: input.map,
          targetCell: createOrDestroyWater.targetCell,
          areaEdgeFeet: expectedEdgeFeet,
        })
        if (
          expectedFogAreaIds.length < 1 ||
          JSON.stringify(expectedFogAreaIds) !== JSON.stringify(createOrDestroyWater.fogAreaIds)
        ) return { ok: false, reason: 'invalid-action' }
      }
    }
  }
  if (animalMessenger) {
    const target = input.map.tokens.find((candidate) => candidate.id === animalMessenger.targetTokenId)
    const distanceFeet = target
      ? tokenFootprintDistanceCells(actorToken, target, input.map) * Math.max(1, input.map.feetPerCell ?? 5)
      : Number.POSITIVE_INFINITY
    if (
      !target || target.label !== animalMessenger.targetName ||
      !dnd5eAnimalMessengerTokenIsTinyBeast(target) || distanceFeet > 30
    ) return { ok: false, reason: 'invalid-action' }
  }
  if (animateDead) {
    const spellId = input.spell.id
    const maximumTargets = input.spell.id === 'create-undead'
      ? dnd5eCreateUndeadCapacity(payload.slotLevel, animateDead.undeadKind!)
      : animateDead.mode === 'animate'
        ? dnd5eAnimateDeadAnimationCapacity(payload.slotLevel)
        : dnd5eAnimateDeadReassertionCapacity(payload.slotLevel)
    const targetsValid = maximumTargets > 0 && animateDead.targets.length <= maximumTargets &&
      animateDead.targets.every((declaredTarget) => {
        const target = input.map.tokens.find((candidate) => candidate.id === declaredTarget.tokenId)
        const distanceFeet = target
          ? tokenFootprintDistanceCells(actorToken, target, input.map) *
            Math.max(1, input.map.feetPerCell ?? 5)
          : Number.POSITIVE_INFINITY
        if (!target || target.label !== declaredTarget.targetName || distanceFeet > 10) return false
        if (animateDead.mode === 'animate') {
          const remainsKind = dnd5eAnimateDeadRemainsKind(target)
          return spellId === 'create-undead'
            ? remainsKind === 'humanoid-corpse' && declaredTarget.remainsKind === 'humanoid-corpse'
            : remainsKind === declaredTarget.remainsKind
        }
        return spellId === 'create-undead'
          ? dnd5eCreateUndeadControlledUndead(target, actor.id, animateDead.undeadKind)
          : dnd5eAnimateDeadControlledUndead(target, actor.id)
      })
    if (!targetsValid) return { ok: false, reason: 'invalid-action' }
  }
  if (animateObjects) {
    const targets = animateObjects.targets.map((declaredTarget) =>
      input.map.tokens.find((candidate) => candidate.id === declaredTarget.tokenId))
    const capacity = dnd5eAnimateObjectsCapacity(payload.slotLevel)
    const targetsValid = capacity > 0 && targets.length > 0 && targets.every((target, index) => {
      const declaredTarget = animateObjects.targets[index]!
      const distanceFeet = target
        ? tokenFootprintDistanceCells(actorToken, target, input.map) * Math.max(1, input.map.feetPerCell ?? 5)
        : Number.POSITIVE_INFINITY
      return !!target && target.label === declaredTarget.targetName && distanceFeet <= 120 &&
        dnd5eAnimateObjectsProfile(target) != null
    }) && dnd5eAnimateObjectsCapacityUsed(targets.filter((target): target is Token => !!target)) <= capacity
    if (!targetsValid) return { ok: false, reason: 'invalid-action' }
  }
  if (sequester) {
    const target = input.map.tokens.find((candidate) => candidate.id === sequester.targetTokenId)
    const targetKindMatches = sequester.targetKind === 'object'
      ? target?.type === 'obstacle' && !target.dnd5eSpellEffect
      : target?.type === 'player' || target?.type === 'enemy'
    const distanceFeet = target
      ? tokenFootprintDistanceCells(actorToken, target, input.map) * Math.max(1, input.map.feetPerCell ?? 5)
      : Number.POSITIVE_INFINITY
    if (
      !target || !targetKindMatches || target.label !== sequester.targetName ||
      distanceFeet > 5 || target.dnd5eObjectState?.sequester != null
    ) return { ok: false, reason: 'invalid-action' }
  }
  if (wish && 'targets' in wish) {
    const targetsValid = wish.targets.every((declaredTarget) => {
      const target = input.map.tokens.find((candidate) => candidate.id === declaredTarget.tokenId)
      return !!target && target.type !== 'obstacle' && target.label === declaredTarget.name
    })
    if (!targetsValid) return { ok: false, reason: 'invalid-action' }
  }
  if (wordOfRecall?.mode === 'recall') {
    if (!dnd5eWordOfRecallSanctuary(actor)) return { ok: false, reason: 'invalid-action' }
    const seen = new Set<string>()
    const targetsValid = wordOfRecall.targets.every((declaredTarget) => {
      const target = input.map.tokens.find((candidate) => candidate.id === declaredTarget.tokenId)
      const distanceFeet = target
        ? tokenFootprintDistanceCells(actorToken, target, input.map) * Math.max(1, input.map.feetPerCell ?? 5)
        : Number.POSITIVE_INFINITY
      if (
        !target || target.type === 'obstacle' || target.id === actorToken.id ||
        target.label !== declaredTarget.name || distanceFeet > 5 || seen.has(target.id)
      ) return false
      seen.add(target.id)
      return true
    })
    if (!targetsValid) return { ok: false, reason: 'invalid-action' }
  }
  if (enforceSpellcastingPrerequisites && dnd5eWearingUnproficientArmor(actor)) {
    return { ok: false, reason: 'armor-proficiency-required' }
  }
  const castingClassId = dnd5eSpellcastingClassIdForSpell(
    actor,
    input.spell.id,
    payload.castingClassId,
    input.spell.classes,
  )
  if (!castingClassId) return { ok: false, reason: 'spell-not-known-or-prepared' }
  const effectiveSource = castingClassId
    ? dnd5eEffectiveSpellcastingSource(actor, castingClassId)
    : undefined
  const definition = effectiveSource?.definition ??
    (castingClassId ? dnd5eClassDefinition(castingClassId) : undefined)
  const castingClassLevel = castingClassId ? dnd5eCharacterClassLevel(actor, castingClassId) : 0
  if (!definition?.spellcasting || castingClassLevel < 1) {
    return { ok: false, reason: 'spellcasting-class-unavailable' }
  }
  if (
    enforceSpellcastingPrerequisites && actor.dnd5eCombatState?.wildShapeFormId &&
    (definition.id !== 'druid' || castingClassLevel < 18)
  ) return { ok: false, reason: 'wild-shape-spellcasting-unavailable' }
  let spellMaterialPlan: Dnd5eSpellMaterialConsumptionPlan | undefined
  if (enforceSpellcastingPrerequisites) {
    const areaModifiers = dnd5ePersistentAreaOccupantModifiersAt({
      map: input.map,
      token: actorToken,
      position: actorToken,
    })
    const componentCheck = dnd5eSpellComponentCheck(
      areaModifiers.preventsVerbalComponents
        ? { ...actor, conditions: [...actor.conditions, 'silenced'] }
        : actor,
      dnd5eAdjudicatedSpellComponentRequirements(input.spell, {
        createUndeadCorpseCount: input.spell.id === 'create-undead' && animateDead
          ? animateDead.mode === 'animate' ? animateDead.targets.length : 0
          : undefined,
      }),
      castingClassId,
    )
    if (!dnd5eSpellComponentsAvailable(componentCheck)) {
      if (componentCheck.verbal === 'unavailable-silenced') {
        return { ok: false, reason: 'verbal-component-unavailable' }
      }
      if (componentCheck.somatic === 'unavailable-hands-occupied') {
        return { ok: false, reason: 'somatic-component-unavailable' }
      }
      if (componentCheck.material === 'missing-focus-or-pouch') {
        return { ok: false, reason: 'material-component-unavailable' }
      }
      if (
        componentCheck.material === 'missing-specific-material' ||
        componentCheck.material === 'unsupported-costly-material'
      ) return { ok: false, reason: 'costly-material-unavailable' }
      if (componentCheck.material === 'specific-material-hands-occupied') {
        return { ok: false, reason: 'material-component-unavailable' }
      }
      return { ok: false, reason: 'component-unavailable' }
    }
    // Voice narrative leaves the *target object* outcome to the table, but it
    // is still a real spell cast.  Host authority validates V/S/M and settles
    // an allocated consumed component atomically; a narrative-only route must
    // never turn an explicitly consumed component into a free spell.
    spellMaterialPlan = componentCheck.materialPlan
  }
  const ritual = payload.ritual === true
  const spellIsRitual = input.spell.imported?.ritual === true || input.spell.reference?.ritual === true
  if (ritual && (
    !spellIsRitual ||
    input.spell.level < 1 ||
    definition.spellcasting.ritualCasting !== true
  )) return { ok: false, reason: 'ritual-unavailable' }
  const declaredCastingTime = dnd5eSpellbookEntryCastingTime(input.spell)
  const castingTime = ritual || castingVariant === 'plant-growth-8-hours'
    ? 'long'
    : declaredCastingTime === 'unsupported' ? 'long' : declaredCastingTime
  const elapsedCastingMinutes = dnd5eAdjudicatedSpellElapsedCastingMinutes(
    input.spell,
    ritual,
    castingVariant,
  )

  const slotLevel = input.spell.level === 0
    ? 0
    : definition.spellcasting.kind === 'pact' && input.spell.level <= 5
      ? dnd5ePactSlotLevel(castingClassLevel)
      : payload.slotLevel
  const selections = effectiveSource
    ? dnd5eEffectiveSpellSelections(actor, effectiveSource)
    : actor.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {}
  if (effectiveSource?.declarative && input.spell.level > 0) {
    const entriesById = new Map(
      [...(input.spellbookEntries ?? []), input.spell].map((entry) => [entry.id, entry]),
    )
    const unrestrictedSelected = (selections[effectiveSource.spellSelectionKey] ?? [])
      .map((spellId) => entriesById.get(spellId))
      .filter((entry): entry is Dnd5eSpellbookEntry =>
        !!entry && entry.level > 0 && !dnd5eSubclassSpellSchoolAllowed(effectiveSource, entry),
      )
    if (
      !dnd5eSubclassSpellSchoolAllowed(effectiveSource, input.spell) &&
      (
        unrestrictedSelected.length > dnd5eSubclassUnrestrictedSpellLimit(effectiveSource) ||
        !unrestrictedSelected.some((entry) => entry.id === input.spell!.id)
      )
    ) return { ok: false, reason: 'spell-school-restricted' }
  }
  if (input.spell.level > 0 && !ritual) {
    const resourceKey = definition.spellcasting.kind === 'pact' && input.spell.level <= 5
      ? 'dnd5e-pact-slot'
      : `dnd5e-spell-slot-${slotLevel}`
    const freeCastSource = dnd5eFreeSpellCastSource({
      classId: definition.id,
      level: castingClassLevel,
      classSelections: selections,
      classResources: actor.classResources ?? {},
    }, { id: input.spell.id, level: input.spell.level }, slotLevel)
    if (
      slotLevel < input.spell.level ||
      (!freeCastSource && (actor.classResources?.[resourceKey]?.current ?? 0) < 1)
    ) return { ok: false, reason: 'slot-unavailable' }
  }
  const snapshot = createDnd5eMapCombatSnapshot({
    combatId: input.action.combatId ?? `map-${input.map.id}`,
    round: input.action.round,
    turnSlotId: input.initiativeOrder[input.action.initiativeIndex]?.slotId,
    map: input.map,
    characters: input.characters,
    initiativeOrder: input.initiativeOrder,
  })
  if (!input.action.combatId?.trim()) {
    // Exploration casts are standalone transactions. The shared map snapshot
    // persists the previous synthetic turn so ongoing effects survive, but
    // its action pools and per-turn spell markers must not make a later
    // out-of-combat cast look like a second spell in the same combat turn.
    // Fully automated and plugin spell transactions enforce the same boundary.
    const explorationActor = prepareDnd5eExplorationActor(snapshot.state, actorToken.id)
    if (explorationActor) {
      explorationActor.turn = {
        ...explorationActor.turn,
        actionAvailable: true,
        bonusActionAvailable: true,
        reactionAvailable: true,
        objectInteractionAvailable: true,
        movementRemaining: explorationActor.speed,
      }
      explorationActor.classState.bonusActionSpellTurnKey = undefined
      explorationActor.classState.leveledSpellTurnKey = undefined
    }
  }
  const actorIndex = dnd5eRequestedInitiativeActorIndex(
    snapshot.state,
    actorToken.id,
    input.action.initiativeIndex,
  )
  const actorCombatant = snapshot.state.combatants[actorToken.id]
  if (actorIndex < 0 || !actorCombatant) return { ok: false, reason: 'combatant-missing' }
  // The live Character boundary above has already authenticated this spell for
  // the selected casting class. Preserve that Host-validated entitlement in
  // the ephemeral combat snapshot as well. Some legitimate sources (for
  // example data-driven build grants, and a character update that reaches the
  // action authority before the derived combat projection refreshes) do not
  // otherwise appear in classSelectionsByClass. The Headless transaction
  // independently re-validates the projected entitlement before spending any
  // resource, so projecting it here keeps the two authority checks consistent
  // without trusting a player-supplied spell id.
  const entitlementKey = input.spell.level === 0
    ? effectiveSource?.cantripSelectionKey ?? 'spell-cantrips'
    : effectiveSource?.spellSelectionKey ?? 'spell-prepared'
  const classSelections = actorCombatant.classSelectionsByClass?.[castingClassId] ?? {}
  const entitledSpellIds = [...new Set([
    ...(classSelections[entitlementKey] ?? []),
    input.spell.id,
  ])]
  actorCombatant.classSelections = {
    ...actorCombatant.classSelections,
    [entitlementKey]: [...new Set([
      ...(actorCombatant.classSelections[entitlementKey] ?? []),
      input.spell.id,
    ])],
  }
  actorCombatant.classSelectionsByClass = {
    ...(actorCombatant.classSelectionsByClass ?? {}),
    [castingClassId]: {
      ...classSelections,
      [entitlementKey]: entitledSpellIds,
    },
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
  const concentration = dnd5eSpellbookEntryIsConcentrationAtSlot(input.spell, slotLevel)
  return {
    ok: true,
    prepared: {
      action: input.action,
      payload: {
        ...payload,
        ...(sending ? { sending } : {}),
        ...(animalMessenger ? { animalMessenger } : {}),
        ...(animateDead ? { animateDead } : {}),
        ...(animateObjects ? { animateObjects } : {}),
        ...(creation ? { creation } : {}),
        ...(sequester ? { sequester } : {}),
        ...(wordOfRecall ? { wordOfRecall } : {}),
        ...(wish ? { wish } : {}),
        ...(environmentNarrativeContext ? { narrativeContext: environmentNarrativeContext } : {}),
      },
      spell: input.spell,
      castingTime,
      elapsedCastingMinutes,
      concentration,
      suggestedConcentrationRounds: concentration
        ? dnd5eSpellbookEntrySuggestedConcentrationRounds(input.spell)
        : undefined,
      description: [
        castingVariant === 'plant-growth-action'
          ? '本次施法模式：1 动作；100 尺半径茂密疯长，区域内每移动 1 尺消耗 4 尺移动力。'
          : castingVariant === 'plant-growth-8-hours'
            ? '本次施法模式：8 小时；半里半径土地肥沃 1 年，食物产量加倍。'
            : '',
        dnd5eSpellbookEntryDescription(input.spell),
      ].filter(Boolean).join('\n\n'),
      map: input.map,
      characters: input.characters,
      characterIdByCombatantId: snapshot.characterIdByCombatantId,
      state: { ...snapshot.state, initiativeIndex: actorIndex },
      actor,
      castingClassId,
      castingClassLevel,
      actorToken,
      spellMaterialPlan,
      slotLevel,
      ritual,
    },
  }
}

function sanitizeEffects(
  prepared: PreparedDnd5eAdjudicatedSpell,
  effects: readonly DmAdjudicationEffect[],
) {
  return effects.slice(0, 32).map((effect) => ({
    targetId: effect.targetTokenId,
    ...(effect.operation ? { operation: effect.operation } : {}),
    ...(effect.amount != null ? { amount: effect.amount } : {}),
    ...(effect.damageType != null ? { damageType: effect.damageType } : {}),
    ...(effect.addCondition?.trim() ? { addCondition: effect.addCondition.trim() } : {}),
    ...(Number.isInteger(effect.conditionDurationRounds) &&
      effect.conditionDurationRounds! >= 1 &&
      effect.conditionDurationRounds! <= 14_400 &&
      ['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end']
        .includes(effect.conditionDurationTickOn ?? '')
      ? {
          conditionDuration: {
            type: 'rounds' as const,
            remainingRounds: effect.conditionDurationRounds!,
            tickOn: effect.conditionDurationTickOn!,
          },
        }
      : {}),
    ...(effect.removeCondition?.trim() ? { removeCondition: effect.removeCondition.trim() } : {}),
  })).filter((effect) => {
    const token = prepared.map.tokens.find((candidate) => candidate.id === effect.targetId)
    return !!token && token.type !== 'obstacle'
  })
}

function sanitizeEtherealnessEffects(
  prepared: PreparedDnd5eAdjudicatedSpell,
  effects: readonly DmAdjudicationEffect[],
) {
  const maximumTargets = prepared.slotLevel === 7 ? 1 : 3 * (prepared.slotLevel - 7)
  if (prepared.slotLevel < 7 || effects.length < 1 || effects.length > maximumTargets) return null
  const seen = new Set<string>()
  const normalized = [] as ReturnType<typeof sanitizeEffects>
  for (const effect of effects) {
    const target = prepared.map.tokens.find((candidate) =>
      candidate.id === effect.targetTokenId && candidate.type !== 'obstacle')
    const distanceFeet = target
      ? tokenFootprintDistanceCells(prepared.actorToken, target, prepared.map) *
        Math.max(1, prepared.map.feetPerCell ?? 5)
      : Number.POSITIVE_INFINITY
    if (
      !target || seen.has(target.id) ||
      effect.operation != null || effect.amount != null || effect.damageType != null ||
      effect.addCondition?.trim() !== '以太化' || effect.removeCondition?.trim() ||
      effect.conditionDurationRounds !== 4_800 ||
      effect.conditionDurationTickOn !== 'target-turn-end' ||
      (prepared.slotLevel === 7 && target.id !== prepared.actorToken.id) ||
      (prepared.slotLevel > 7 && distanceFeet > 10)
    ) return null
    seen.add(target.id)
    normalized.push({
      targetId: target.id,
      addCondition: '以太化',
      conditionDuration: {
        type: 'rounds',
        remainingRounds: 4_800,
        tickOn: 'target-turn-end',
      },
    })
  }
  return normalized
}

function sanitizeSpeakWithPlantsTerrainEffects(
  prepared: PreparedDnd5eAdjudicatedSpell,
  response: DmAdjudicationInterruptResponse,
): Array<{ areaId: string; movementCostMultiplier: 1 | 2 }> | null {
  if (response.terrainEffects == null) return []
  if (!Array.isArray(response.terrainEffects) || prepared.spell.id !== 'speak-with-plants') return null
  if (response.terrainEffects.length > 8) return null

  const gridSize = Math.max(1, prepared.map.gridSize)
  const feetPerCell = Math.max(1, prepared.map.feetPerCell ?? 5)
  const gridOffsetX = prepared.map.gridOffsetX ?? 0
  const gridOffsetY = prepared.map.gridOffsetY ?? 0
  const seen = new Set<string>()
  const normalized: Array<{ areaId: string; movementCostMultiplier: 1 | 2 }> = []
  for (const effect of response.terrainEffects) {
    if (
      !effect || typeof effect.areaId !== 'string' || seen.has(effect.areaId) ||
      (effect.movementCostMultiplier !== 1 && effect.movementCostMultiplier !== 2)
    ) return null
    const area = prepared.map.dnd5ePluginAreas?.find((candidate) => candidate.id === effect.areaId)
    const plantArea = area && (
      area.coreSpellId === 'entangle' ||
      area.coreSpellId === 'plant-growth' ||
      /(?:entangle|plant-growth)/i.test(area.featureId)
    )
    if (!plantArea) return null
    const intersectsThirtyFeet = area.cells.some((cell) => {
      const centerX = gridOffsetX + (cell.col + 0.5) * gridSize
      const centerY = gridOffsetY + (cell.row + 0.5) * gridSize
      return Math.hypot(centerX - prepared.actorToken.x, centerY - prepared.actorToken.y) /
        gridSize * feetPerCell <= 30
    })
    if (!intersectsThirtyFeet) return null
    seen.add(effect.areaId)
    normalized.push({
      areaId: effect.areaId,
      movementCostMultiplier: effect.movementCostMultiplier,
    })
  }
  return normalized
}

export function resolvePreparedDnd5eAdjudicatedSpell(input: {
  prepared: PreparedDnd5eAdjudicatedSpell
  response: DmAdjudicationInterruptResponse
  /** Authoritative completion time. Required for Animate Dead's 24-hour control window. */
  worldMinute?: number
  airborneFallDamageRollsByCombatantId?: Dnd5eAirborneFallDamageRolls
}): {
  result: Dnd5eActionResult
  application?: Dnd5eMapResultPlan
  airborneFalls?: readonly Dnd5eAirborneFallPreview[]
} {
  const { prepared, response } = input
  if (response.decision !== 'approved') {
    return {
      result: {
        ok: false,
        state: prepared.state,
        events: [],
        reason: 'invalid-class-feature',
      },
    }
  }
  if (prepared.payload.narrativeOnly === true) {
    if (
      (Array.isArray(response.effects) && response.effects.length > 0) ||
      response.sending != null || response.animalMessenger != null || response.animateDead != null ||
      response.animateObjects != null || response.sequester != null || response.wordOfRecall != null
    ) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'invalid-class-feature' },
      }
    }
    const { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
      type: 'adjudicated-spell',
      actorId: prepared.actorToken.id,
      castingClassId: prepared.castingClassId,
      spellId: prepared.spell.id,
      spellName: prepared.spell.name,
      castInstanceId: prepared.action.id,
      spellLevel: prepared.spell.level,
      slotLevel: prepared.slotLevel,
      castingTime: prepared.castingTime,
      ritual: prepared.ritual || undefined,
      effects: [],
      settlementMode: 'narrative-slot-only',
    }, input.airborneFallDamageRollsByCombatantId)
    if (!result.ok) return { result, airborneFalls }
    // The Headless action intentionally has slot-only settlement so that a
    // voice-narrative cast cannot alter targets or ordinary objects.  Its
    // separately allocated consumed spell component remains a Host-owned
    // cast cost and must settle before the application becomes visible.
    const materialSettlement = settleDnd5eSpellMaterialConsumption(
      prepared.characters,
      prepared.actor.id,
      prepared.spellMaterialPlan,
    )
    if (!materialSettlement.ok) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
        airborneFalls,
      }
    }
    return {
      result,
      application: planDnd5eMapResultApplication({
        state: result.state,
        map: prepared.map,
        characters: materialSettlement.characters,
        baselineCharacters: prepared.characters,
        characterIdByCombatantId: prepared.characterIdByCombatantId,
        events: [...result.events],
      }),
      airborneFalls,
    }
  }
  const sendingResolution = prepared.spell.id === 'sending'
    ? normalizeDnd5eSendingResolutionV1(response.sending)
    : undefined
  const animalMessengerDeclaration = prepared.spell.id === 'animal-messenger'
    ? prepared.payload.animalMessenger
    : undefined
  const animalMessengerResolution = animalMessengerDeclaration
    ? normalizeDnd5eAnimalMessengerResolutionV1(response.animalMessenger)
    : undefined
  const animateDeadDeclaration = prepared.spell.id === 'animate-dead' || prepared.spell.id === 'create-undead'
    ? prepared.payload.animateDead
    : undefined
  const animateDeadResolution = animateDeadDeclaration
    ? normalizeDnd5eAnimateDeadResolutionV1(response.animateDead)
    : undefined
  const animateObjectsDeclaration = prepared.spell.id === 'animate-objects'
    ? prepared.payload.animateObjects
    : undefined
  const animateObjectsResolution = animateObjectsDeclaration
    ? normalizeDnd5eAnimateObjectsResolutionV1(response.animateObjects)
    : undefined
  const creationDeclaration = prepared.spell.id === 'creation'
    ? prepared.payload.creation
    : undefined
  const createOrDestroyWaterDeclaration = prepared.spell.id === 'create-or-destroy-water'
    ? prepared.payload.createOrDestroyWater
    : undefined
  const responseEffects = Array.isArray(response.effects) ? response.effects : []
  const terrainEffects = sanitizeSpeakWithPlantsTerrainEffects(prepared, response)
  const sequesterDeclaration = prepared.spell.id === 'sequester'
    ? prepared.payload.sequester
    : undefined
  const sequesterResolution = sequesterDeclaration
    ? normalizeDnd5eSequesterResolutionV1(response.sequester)
    : undefined
  const wordOfRecallDeclaration = prepared.spell.id === 'word-of-recall'
    ? prepared.payload.wordOfRecall
    : undefined
  const wordOfRecallResolution = wordOfRecallDeclaration
    ? normalizeDnd5eWordOfRecallResolutionV1(response.wordOfRecall)
    : undefined
  if (
    terrainEffects == null ||
    (prepared.spell.id === 'sending' && (!prepared.payload.sending || !sendingResolution || responseEffects.length > 0)) ||
    (prepared.spell.id !== 'sending' && response.sending != null) ||
    (prepared.spell.id === 'animal-messenger' && (
      !animalMessengerDeclaration || !animalMessengerResolution || responseEffects.length > 0 ||
      !animalMessengerResolution.destinationPreviouslyVisitedConfirmed ||
      !animalMessengerResolution.targetVisibleConfirmed
    )) ||
    (prepared.spell.id !== 'animal-messenger' && response.animalMessenger != null) ||
    ((prepared.spell.id === 'animate-dead' || prepared.spell.id === 'create-undead') && (
      !animateDeadDeclaration || !animateDeadResolution || responseEffects.length > 0 ||
      !animateDeadResolution.targetsConfirmed ||
      !Number.isSafeInteger(input.worldMinute) || Number(input.worldMinute) < 0 ||
      (prepared.spell.id === 'create-undead' && !dnd5eCreateUndeadIsNight(Number(input.worldMinute)))
    )) ||
    (prepared.spell.id !== 'animate-dead' && prepared.spell.id !== 'create-undead' && response.animateDead != null) ||
    (prepared.spell.id === 'animate-objects' && (
      !animateObjectsDeclaration || !animateObjectsResolution || responseEffects.length > 0 ||
      !animateObjectsResolution.targetsConfirmed || response.concentrationRounds !== 10
    )) ||
    (prepared.spell.id !== 'animate-objects' && response.animateObjects != null) ||
    (prepared.spell.id === 'creation' && (
      !creationDeclaration || responseEffects.length > 0 ||
      !Number.isSafeInteger(input.worldMinute) || Number(input.worldMinute) < 0
    )) ||
    (prepared.spell.id === 'create-or-destroy-water' && (
      !createOrDestroyWaterDeclaration || responseEffects.length > 0
    )) ||
    (prepared.spell.id === 'sequester' && (
      !sequesterDeclaration || !sequesterResolution || responseEffects.length > 0 ||
      (sequesterDeclaration.targetKind === 'creature' && !sequesterResolution.willingCreatureConfirmed)
    )) ||
    (prepared.spell.id !== 'sequester' && response.sequester != null) ||
    (prepared.spell.id === 'word-of-recall' && (
      !wordOfRecallDeclaration || !wordOfRecallResolution || responseEffects.length > 0 ||
      (wordOfRecallDeclaration.mode === 'designate-sanctuary'
        ? !wordOfRecallResolution.sanctuaryConsecratedConfirmed
        : !wordOfRecallResolution.willingCreaturesConfirmed)
    )) ||
    (prepared.spell.id !== 'word-of-recall' && response.wordOfRecall != null)
  ) {
    return {
      result: {
        ok: false,
        state: prepared.state,
        events: [],
        reason: 'invalid-class-feature',
      },
    }
  }
  const etherealnessEffects = prepared.spell.id === 'etherealness'
    ? sanitizeEtherealnessEffects(prepared, responseEffects)
    : undefined
  const effects = animalMessengerDeclaration
    ? [{
        targetId: animalMessengerDeclaration.targetTokenId,
        addCondition: '动物信使',
        conditionDuration: {
          type: 'rounds' as const,
          remainingRounds: dnd5eAnimalMessengerDurationRounds(prepared.slotLevel),
          tickOn: 'target-turn-end' as const,
        },
      }]
    : sequesterDeclaration?.targetKind === 'creature'
    ? [{ targetId: sequesterDeclaration.targetTokenId, addCondition: '隔离术·假死' }]
    : etherealnessEffects ?? sanitizeEffects(prepared, responseEffects)
  if (
    (prepared.spell.id === 'etherealness' && etherealnessEffects == null) ||
    (!animalMessengerDeclaration && !animateDeadDeclaration && !animateObjectsDeclaration && !creationDeclaration && !createOrDestroyWaterDeclaration && !sequesterDeclaration && prepared.spell.id !== 'etherealness' && effects.length !== responseEffects.length)
  ) {
    return {
      result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
    }
  }
  const concentrationRounds = prepared.concentration && response.concentrationRounds != null
    ? response.concentrationRounds
    : undefined
  let { result, airborneFalls } = resolveDnd5eActionWithAirborneFallPreview(prepared.state, {
    type: 'adjudicated-spell',
    actorId: prepared.actorToken.id,
    castingClassId: prepared.castingClassId,
    spellId: prepared.spell.id,
    spellName: prepared.spell.name,
    castInstanceId: prepared.action.id,
    spellLevel: prepared.spell.level,
    slotLevel: prepared.slotLevel,
    castingTime: prepared.castingTime,
    ritual: prepared.ritual || undefined,
    effects,
    requiresConcentration: prepared.concentration,
    concentrationRounds,
    // Terrain/world-state concentration spells can legitimately have no
    // creature effect rows in the DM adjudication response.  Keep the caster
    // as the Host-owned concentration participant so the character snapshot
    // still records concentration, its source, and remaining rounds.
    concentrationTargetIds: concentrationRounds != null && effects.length === 0
      ? [prepared.actorToken.id]
      : undefined,
    settlementMode: 'dm-slot-only',
  }, input.airborneFallDamageRollsByCombatantId)
  if (!result.ok) return { result, airborneFalls }
  if (createOrDestroyWaterDeclaration?.mode === 'destroy-fog') {
    const removedAreaIds = new Set(createOrDestroyWaterDeclaration.fogAreaIds ?? [])
    const removedAreas = (prepared.map.dnd5ePluginAreas ?? []).filter((area) =>
      removedAreaIds.has(area.id))
    const survivingAreas = (prepared.map.dnd5ePluginAreas ?? []).filter((area) =>
      !removedAreaIds.has(area.id))
    const events = [...result.events]
    const endedSources = new Set<string>()
    for (const area of removedAreas) {
      if (!area.concentrationId) continue
      const sourceKey = `${area.sourceTokenId}:${area.concentrationId}`
      if (endedSources.has(sourceKey)) continue
      const sameConcentrationSurvives = survivingAreas.some((candidate) =>
        candidate.sourceTokenId === area.sourceTokenId &&
        candidate.concentrationId === area.concentrationId)
      if (sameConcentrationSurvives) continue
      const source = result.state.combatants[area.sourceTokenId]
      if (source?.classState.concentrationSpellId !== area.concentrationId) continue
      endDnd5eConcentration(result.state, source, events)
      endedSources.add(sourceKey)
    }
    if (endedSources.size > 0) result = { ...result, events }
  }
  const materialSettlement = settleDnd5eSpellMaterialConsumption(
    prepared.characters,
    prepared.actor.id,
    prepared.spellMaterialPlan,
  )
  if (!materialSettlement.ok) {
    return {
      result: { ok: false, state: prepared.state, events: [], reason: 'item-resource-unavailable' },
      airborneFalls,
    }
  }
  let application = planDnd5eMapResultApplication({
    state: result.state,
    map: prepared.map,
    characters: materialSettlement.characters,
    baselineCharacters: prepared.characters,
    characterIdByCombatantId: prepared.characterIdByCombatantId,
    events: [...result.events],
  })
  if (terrainEffects.length > 0) {
    const movementCostByAreaId = new Map(terrainEffects.map((effect) => [
      effect.areaId,
      effect.movementCostMultiplier,
    ]))
    application = {
      ...application,
      map: {
        ...application.map,
        dnd5ePluginAreas: (application.map.dnd5ePluginAreas ?? []).map((area) => {
          const movementCostMultiplier = movementCostByAreaId.get(area.id)
          return movementCostMultiplier == null ? area : { ...area, movementCostMultiplier }
        }),
      },
    }
  }
  if (sequesterDeclaration?.targetKind === 'object') {
    const target = application.map.tokens.find((candidate) =>
      candidate.id === sequesterDeclaration.targetTokenId && candidate.type === 'obstacle')
    if (!target) {
      return {
        result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
        airborneFalls,
      }
    }
    const currentObjectState = normalizeDnd5eMapObjectStateV1(target.dnd5eObjectState) ?? { schemaVersion: 1 as const }
    const patchedTarget: Token = {
      ...target,
      dnd5eObjectState: {
        ...currentObjectState,
        sequester: {
          schemaVersion: 1,
          sourceTokenId: prepared.actorToken.id,
          sourceCharacterId: prepared.actor.id,
          sourceActionId: prepared.action.id,
          slotLevel: prepared.slotLevel,
          endingCondition: sequesterDeclaration.endingCondition,
        },
      },
    }
    application.map = {
      ...application.map,
      tokens: application.map.tokens.map((candidate) =>
        candidate.id === patchedTarget.id ? patchedTarget : candidate),
    }
    application.changedTokenIds = [...new Set([...application.changedTokenIds, patchedTarget.id])]
    application.tokenPatches = {
      ...(application.tokenPatches ?? {}),
      [patchedTarget.id]: { dnd5eObjectState: patchedTarget.dnd5eObjectState },
    }
  }
  if (creationDeclaration) {
    const worldMinute = Number(input.worldMinute)
    const durationMinutes = dnd5eCreationDurationMinutes(creationDeclaration.materials)
    const feetPerCell = Math.max(1, application.map.feetPerCell ?? 5)
    const size = creationDeclaration.edgeFeet / feetPerCell
    const placement = tokenCenterForAnchorCell(creationDeclaration.targetCell, { size }, application.map)
    const createdToken: Token = {
      id: `${prepared.action.id}:creation-object`,
      label: creationDeclaration.objectDescription,
      x: placement.x,
      y: placement.y,
      color: '#a78bfa',
      emoji: '📦',
      size,
      type: 'obstacle',
      hp: 10,
      maxHp: 10,
      showHpOnToken: false,
      showDetailOnToken: true,
      dnd5eObjectState: {
        schemaVersion: 1,
        magical: false,
        wornOrCarried: false,
        creation: {
          schemaVersion: 1,
          sourceTokenId: prepared.actorToken.id,
          sourceCharacterId: prepared.actor.id,
          sourceActionId: prepared.action.id,
          slotLevel: prepared.slotLevel,
          objectDescription: creationDeclaration.objectDescription,
          materials: [...creationDeclaration.materials],
          edgeFeet: creationDeclaration.edgeFeet,
          createdWorldMinute: worldMinute,
          expiresAtWorldMinute: worldMinute + durationMinutes,
          cannotBeSpellMaterial: true,
        },
      },
    }
    application = {
      ...application,
      map: { ...application.map, tokens: [...application.map.tokens, createdToken] },
      changedTokenIds: [...new Set([...application.changedTokenIds, createdToken.id])],
    }
  }
  if (createOrDestroyWaterDeclaration) {
    if (
      createOrDestroyWaterDeclaration.mode === 'create-container' ||
      createOrDestroyWaterDeclaration.mode === 'destroy-container'
    ) {
      const target = application.map.tokens.find((candidate) =>
        candidate.id === createOrDestroyWaterDeclaration.targetObjectId && candidate.type === 'obstacle')
      const currentObjectState = normalizeDnd5eMapObjectStateV1(target?.dnd5eObjectState)
      const container = currentObjectState?.waterContainer
      if (!target || !currentObjectState || !container) {
        return {
          result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
          airborneFalls,
        }
      }
      const gallons = createOrDestroyWaterDeclaration.gallons ?? 0
      const waterGallons = createOrDestroyWaterDeclaration.mode === 'create-container'
        ? container.waterGallons + gallons
        : container.waterGallons - gallons
      const patchedTarget: Token = {
        ...target,
        dnd5eObjectState: {
          ...currentObjectState,
          schemaVersion: 1,
          waterContainer: { ...container, waterGallons },
          consumable: waterGallons > 0
            ? { kind: 'drink', contaminants: currentObjectState.consumable?.contaminants ?? [] }
            : undefined,
        },
      }
      application = {
        ...application,
        map: {
          ...application.map,
          tokens: application.map.tokens.map((candidate) =>
            candidate.id === patchedTarget.id ? patchedTarget : candidate),
        },
        changedTokenIds: [...new Set([...application.changedTokenIds, patchedTarget.id])],
        tokenPatches: {
          ...(application.tokenPatches ?? {}),
          [patchedTarget.id]: { dnd5eObjectState: patchedTarget.dnd5eObjectState },
        },
      }
    } else if (createOrDestroyWaterDeclaration.mode === 'destroy-fog') {
      const removedAreaIds = new Set(createOrDestroyWaterDeclaration.fogAreaIds ?? [])
      application = {
        ...application,
        map: {
          ...application.map,
          dnd5ePluginAreas: (application.map.dnd5ePluginAreas ?? [])
            .filter((area) => !removedAreaIds.has(area.id)),
        },
      }
    }
  }
  if (animateDeadDeclaration) {
    const controlExpiresAtWorldMinute = Number(input.worldMinute) + 24 * 60
    const createUndeadKind = prepared.spell.id === 'create-undead'
      ? animateDeadDeclaration.undeadKind
      : undefined
    const summonFeatureId = createUndeadKind ? 'spell:create-undead' : 'spell:animate-dead'
    if (animateDeadDeclaration.mode === 'animate') {
      const remainsById = new Map(application.map.tokens.map((token) => [token.id, token]))
      const selectedIds = new Set(animateDeadDeclaration.targets.map((target) => target.tokenId))
      let nextMap = {
        ...application.map,
        tokens: application.map.tokens.filter((token) => !selectedIds.has(token.id)),
      }
      const addedIds: string[] = []
      for (const [index, declaredTarget] of animateDeadDeclaration.targets.entries()) {
        const remains = remainsById.get(declaredTarget.tokenId)
        if (!remains) {
          return {
            result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
            airborneFalls,
          }
        }
        const monsterId = createUndeadKind
          ? `srd-5.1:${createUndeadKind}`
          : declaredTarget.remainsKind === 'bone-pile'
            ? 'srd-5.1:skeleton'
            : 'srd-5.1:zombie'
        const targetCell = tokenAnchorCellFromPixel(remains.x, remains.y, remains, application.map)
        let planned: ReturnType<typeof planDnd5eSummonedCreature> = {
          ok: false,
          reason: 'summon-position-blocked',
        }
        for (const placementCell of animateDeadPlacementCells(targetCell)) {
          planned = planDnd5eSummonedCreature({
            map: nextMap,
            actorToken: prepared.actorToken,
            sourceCharacterId: prepared.actor.id,
            featureId: summonFeatureId,
            pluginId: 'core-srd-spell',
            actionId: prepared.action.id,
            occurrenceIndex: index,
            createdWorldMinute: Number(input.worldMinute),
            round: prepared.state.round,
            targetCell: placementCell,
            initiativeD20: 10,
            summon: {
              monsterId,
              label: `${createUndeadKind === 'ghoul' ? '受控食尸鬼' :
                createUndeadKind === 'ghast' ? '受控尸妖' :
                  createUndeadKind === 'wight' ? '受控尸鬼' :
                    createUndeadKind === 'mummy' ? '受控木乃伊' :
                      monsterId === 'srd-5.1:skeleton' ? '受控骷髅' : '受控僵尸'} ${index + 1}`,
              durationRounds: 14_400,
              persistent: true,
              side: 'ally',
            },
          })
          if (planned.ok) break
        }
        if (!planned.ok) {
          return {
            result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
            airborneFalls,
          }
        }
        const summoned: Token = {
          ...planned.plan.token,
          dnd5eSummon: {
            ...planned.plan.token.dnd5eSummon!,
            controlExpiresAtWorldMinute,
          },
        }
        nextMap = { ...nextMap, tokens: [...nextMap.tokens, summoned] }
        addedIds.push(summoned.id)
      }
      application = {
        ...application,
        map: nextMap,
        changedTokenIds: [...new Set([
          ...application.changedTokenIds,
          ...animateDeadDeclaration.targets.map((target) => target.tokenId),
          ...addedIds,
        ])],
      }
    } else {
      const selectedIds = new Set(animateDeadDeclaration.targets.map((target) => target.tokenId))
      const tokenPatches = { ...(application.tokenPatches ?? {}) }
      const tokens = application.map.tokens.map((token) => {
        if (!selectedIds.has(token.id) || !token.dnd5eSummon) return token
        const dnd5eSummon = {
          ...token.dnd5eSummon,
          sourceCharacterId: prepared.actor.id,
          sourceTokenId: prepared.actorToken.id,
          controlEnded: undefined,
          controlExpiresAtWorldMinute,
        }
        tokenPatches[token.id] = { dnd5eSummon }
        return { ...token, dnd5eSummon }
      })
      application = {
        ...application,
        map: { ...application.map, tokens },
        changedTokenIds: [...new Set([...application.changedTokenIds, ...selectedIds])],
        tokenPatches,
      }
    }
  }
  if (animateObjectsDeclaration) {
    // Beginning any new concentration ends the previous casting. A same-spell
    // recast still has the same concentrationSpellId, so restore this caster's
    // earlier animated objects explicitly before creating the new set.
    const restoredPriorAnimatedObjectIds: string[] = []
    const priorAnimatedObjectTokenIds: string[] = []
    const tokensAfterPriorRestoration = application.map.tokens.flatMap((token) => {
      if (
        token.dnd5eSummon?.featureId !== 'spell:animate-objects' ||
        token.dnd5eSummon.sourceCharacterId !== prepared.actor.id
      ) return [token]
      const restoredObject = dnd5eRestoredSummonedOriginalObject(token)
      if (!restoredObject) return [token]
      priorAnimatedObjectTokenIds.push(token.id)
      restoredPriorAnimatedObjectIds.push(restoredObject.id)
      return [restoredObject]
    })
    if (priorAnimatedObjectTokenIds.length > 0) {
      application = {
        ...application,
        map: { ...application.map, tokens: tokensAfterPriorRestoration },
        changedTokenIds: [...new Set([
          ...application.changedTokenIds,
          ...priorAnimatedObjectTokenIds,
          ...restoredPriorAnimatedObjectIds,
        ])],
      }
    }
    const objectsById = new Map(application.map.tokens.map((token) => [token.id, token]))
    const selectedIds = new Set(animateObjectsDeclaration.targets.map((target) => target.tokenId))
    let nextMap = {
      ...application.map,
      tokens: application.map.tokens.filter((token) => !selectedIds.has(token.id)),
    }
    const addedIds: string[] = []
    for (const [index, declaredTarget] of animateObjectsDeclaration.targets.entries()) {
      const object = objectsById.get(declaredTarget.tokenId)
      const profile = object ? dnd5eAnimateObjectsProfile(object) : undefined
      if (!object || !profile) {
        return {
          result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
          airborneFalls,
        }
      }
      const targetCell = tokenAnchorCellFromPixel(object.x, object.y, object, application.map)
      let planned: ReturnType<typeof planDnd5eSummonedCreature> = {
        ok: false,
        reason: 'summon-position-blocked',
      }
      for (const placementCell of animateObjectPlacementCells(targetCell)) {
        planned = planDnd5eSummonedCreature({
          map: nextMap,
          actorToken: prepared.actorToken,
          sourceCharacterId: prepared.actor.id,
          featureId: 'spell:animate-objects',
          pluginId: 'core-srd-spell',
          actionId: prepared.action.id,
          occurrenceIndex: index,
          // Concentration state is keyed by the spell id in the Headless
          // engine. Using the request id here makes the reconciliation pass
          // immediately treat a freshly animated object as abandoned.
          concentrationId: prepared.spell.id,
          round: prepared.state.round,
          targetCell: placementCell,
          initiativeD20: 10,
          // This is an in-place transformation of a target the Host and DM
          // already validated, not a creature being summoned through the
          // intervening walls. Reusing the summon planner for token creation
          // must not introduce a second, unrelated line-of-effect rejection.
          geometry: createEmptyMapGeometry(nextMap.id),
          summon: {
            monsterId: dnd5eAnimateObjectsMonsterId(profile),
            label: `活化物件 ${index + 1} · ${object.label}`,
            durationRounds: 10,
            concentration: true,
            side: 'ally',
          },
        })
        if (planned.ok) break
      }
      if (!planned.ok) {
        return {
          result: { ok: false, state: prepared.state, events: [], reason: 'invalid-target' },
          airborneFalls,
        }
      }
      const summoned: Token = {
        ...planned.plan.token,
        dnd5eSummon: {
          ...planned.plan.token.dnd5eSummon!,
          // The generic original-object snapshot is restored at the animated
          // creature's current position when concentration ends or it reaches 0 HP.
          truePolymorphOriginalObject: {
            schemaVersion: 1,
            id: object.id,
            label: object.label,
            x: object.x,
            y: object.y,
            color: object.color,
            emoji: object.emoji,
            size: object.size,
            hp: object.hp,
            maxHp: object.maxHp,
            obstacleKind: object.obstacleKind,
            elevationFeet: object.elevationFeet,
            portraitImageId: object.portraitImageId,
            tokenPortraitImageId: object.tokenPortraitImageId,
            showHpOnToken: object.showHpOnToken,
            showDetailOnToken: object.showDetailOnToken,
            visibilityMode: object.visibilityMode,
            lightSource: object.lightSource ? structuredClone(object.lightSource) : undefined,
            dnd5eObjectState: object.dnd5eObjectState ? structuredClone(object.dnd5eObjectState) : undefined,
          },
        },
      }
      nextMap = { ...nextMap, tokens: [...nextMap.tokens, summoned] }
      addedIds.push(summoned.id)
    }
    application = {
      ...application,
      map: nextMap,
      changedTokenIds: [...new Set([
        ...application.changedTokenIds,
        ...animateObjectsDeclaration.targets.map((target) => target.tokenId),
        ...addedIds,
      ])],
    }
  }
  return {
    result,
    airborneFalls,
    application,
  }
}
