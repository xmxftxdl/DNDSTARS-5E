import { validDnd5eOptionalBonusDieSourceConstraint } from '../optionalBonusDieEligibility'
import { validDnd5eInherentFeatureLight } from '../inherentFeatureLightContract'
import { isDnd5eAutonomousBoundHpRetaliation } from './dnd5eAutonomousRetaliationContract'
import { validDnd5eHeldWeaponBaseIds } from '../heldMeleeWeaponRequirement'
import { isDnd5eSourceAuraRequirement } from '../sourceAuraRequirement'
import { dnd5eRestSpellSensorActivity } from './dnd5eRestSpellSensor'
import { normalizeDnd5ePersistentAreaGroundCover } from '../persistentAreaGroundCover'
import {validDnd5eEffectEndSavingThrow} from '../effectEndSavingThrow'
import {normalizeSurfaceDrawing} from '../surfaceDrawing'
import { isDnd5eLethalBodyPartDestruction } from '../lethalBodyPart'
import {validDnd5eFortressFurnishingCatalog} from '../fortressFurnishingDefinition'
import { validDnd5eEntityMaterial } from '../entityMaterial'
import { normalizeDnd5eSolidMaterialTraversal } from '../solidMaterialTraversal'
import { validMapSurfaceMaterials } from '../../../lib/mapSurfaceMaterials'
import { isDnd5eCompanionTaskCommand } from '../companionTask'
import { isDnd5eCompanionReadyCommand } from '../companionReady'
import { createDnd5eEffectGrantCharges } from '../effectGrantCharges'
import { isDnd5eCompanionAttackKind } from '../companionAttackKind'
import { validTerrainClearing } from '../../../../shared/terrain-clearing.mjs'
import { validDnd5eEntityDestructionTerrain } from '../entityDestructionTerrain'
import { validDnd5eSourceProximityAttack } from '../sourceProximityAttack'
import { validDnd5eCohortProximity } from '../cohortArmorClass'
import { validDnd5eBenefitRenewalPolicy } from '../benefitHistoryRenewal'
import { validDnd5eCastingConstraints } from '../castingProximity'
import { normalizeDnd5eAbilityCheckRules } from '../abilityCheckRules'
import { DND5E_AREA_MODE_FIELDS, normalizeDnd5ePersistentAreaModeDeclarations } from '../persistentAreaModes'
import { isDnd5eLegacyCoreResourceId } from '../coreResourceIds'
import { validWeaponFocusClassIds } from '../weaponFocus'
import { validDnd5eOwnedCompanionProximity } from '../ownedCompanionProximity'
import { validDnd5eAbilityCheckRule } from '../abilityCheckRules'
import { validateDnd5eActivityContinuationV1 } from './dnd5eActivityContinuation'
import { isDnd5eSummonLingerPolicy } from '../summonedControl'
import { normalizePersistentAreaCreatureTypes } from '../persistentAreaCreatureFilter'
import {
  validateAutomationCapability,
  type AutomationPhase,
} from '../../../domain/automation/automationCapability'
import { SKILLS, type AbilityKey } from '../../../lib/dnd'
import { DND5E_STANDARD_CONDITION_IDS } from '../conditions'
import { DND5E_DAMAGE_TYPES } from '../damageTypes'
import type {
  Dnd5eActivityDefinitionV1,
  Dnd5eActivityActivationV1,
  Dnd5eActivityInvocationV1,
  Dnd5eActivityOperationV1,
  Dnd5eActivityTargetV1,
} from './dnd5eActivityContracts'
import {
  DND5E_CHARACTER_CAPABILITY_IDS_V1,
  DND5E_TRIGGER_EVENT_IDS_V1,
  type Dnd5eEffectDefinitionV1,
  type Dnd5eEffectDurationV1,
  type Dnd5ePredicateV1,
  type Dnd5eTriggerDefinitionV1,
} from './dnd5eEffectContracts'
import { collectDnd5eFormulaRollDeclarations, validateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './dnd5eFormula'
import { isDnd5eTrackableDefinitionIdV1 } from './dnd5eActivityIdentity'
import type { Dnd5eSpellbookSchoolId } from '../spellbook'
import {
  normalizeDnd5ePersistentAreaGrantedActivity,
  normalizeDnd5ePersistentAreaBlocking,
  normalizeDnd5eDirectionalMovementDeclaration,
  normalizeDnd5ePersistentAreaOccupantModifiers,
  normalizeDnd5ePersistentAreaTurnLifecycle,
  validDnd5ePersistentAreaSurfaceCloud,
  normalizeDnd5ePersistentAreaTriggerDeclaration,
  normalizeDnd5ePersistentAreaWeaponHitBonusDamage,
  normalizeDnd5ePersistentAreaLighting,
} from '../persistentAreaTypes'

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,255}$/
const ABILITIES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha'])
const DAMAGE_TYPES = new Set<string>(DND5E_DAMAGE_TYPES)
const CONDITIONS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)
const TRIGGER_EVENTS = new Set<string>(DND5E_TRIGGER_EVENT_IDS_V1)
const SPELL_SCHOOLS = new Set<Dnd5eSpellbookSchoolId>([
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation',
])
const CHARACTER_CAPABILITIES = new Set<string>(DND5E_CHARACTER_CAPABILITY_IDS_V1)
const NUMERIC_CHARACTER_CAPABILITIES = new Set<string>([
  'swimSpeedMinimumFeet',
  'unarmoredArmorClassBase',
  'initiativeBonus', 'hitPointsPerLevelBonus', 'passivePerceptionBonus', 'passiveInvestigationBonus',
  'minimumHitDieHealingConstitutionMultiplier', 'mediumArmorDexterityCapBonus',
  'dualWieldMeleeArmorClassBonus', 'climbWithoutSpeedCostMultiplier', 'runningJumpMinimumApproachFeet',
  'standFromProneMovementCostFeet', 'spellAttackRangeMultiplier', 'spellSavingThrowAdvantageWithinFeet',
  'combatManeuverDieSidesOverride',
])
const STRING_LIST_CHARACTER_CAPABILITIES = new Set<string>(['opportunityAttacksOnEnterReachWeaponIds'])

function finiteInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
}

function finiteNumber(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && ID_PATTERN.test(value)
}

function appendFormulaErrors(errors: string[], value: unknown, label: string): void {
  errors.push(...validateDnd5eFormulaV1(value, label))
}

function validateInvocation(invocation: Dnd5eActivityInvocationV1 | undefined, errors: string[]): void {
  if (!invocation) return
  if (invocation.kind === 'active') {
    if ('expireGrantAtWindowEnd' in invocation) errors.push('activity.invocation.expireGrantAtWindowEnd requires triggered invocation')
    if ('effectGrantScope' in invocation) errors.push('activity.invocation.effectGrantScope requires triggered invocation')
    if (invocation.confirmation != null && !['actor-choice', 'dm-approval'].includes(invocation.confirmation)) {
      errors.push('activity.invocation.confirmation is invalid')
    }
    return
  }
  if (!TRIGGER_EVENTS.has(invocation.event)) errors.push('activity.invocation.event is invalid')
  if (invocation.expireGrantAtWindowEnd != null && (invocation.expireGrantAtWindowEnd !== true ||
    invocation.effectGrantScope !== 'trigger-execution' || invocation.retention !== 'single-event' ||
    !['temporary-hit-points-gained', 'feature-used', 'spell-resolved', 'item-used', 'action-resolved'].includes(invocation.event))) {
    errors.push('activity.invocation.expireGrantAtWindowEnd requires a single-event execution-bound completion window')
  }
  if (invocation.effectGrantScope != null && invocation.effectGrantScope !== 'trigger-execution') {
    errors.push('activity.invocation.effectGrantScope is invalid')
  }
  if (invocation.releaseSingleUseGrantOnDecline != null &&
    (invocation.releaseSingleUseGrantOnDecline !== true || invocation.confirmation === 'automatic')) {
    errors.push('activity.invocation.releaseSingleUseGrantOnDecline requires an explicit decision')
  }
  if (!['automatic', 'actor-choice', 'target-choice', 'dm-approval'].includes(invocation.confirmation)) {
    errors.push('activity.invocation.confirmation is invalid')
  }
  if (invocation.retention != null && ![
    'single-event', 'until-triggered', 'until-turn-end', 'until-round-end',
  ].includes(invocation.retention)) errors.push('activity.invocation.retention is invalid')
}

function validatePredicate(predicate: Dnd5ePredicateV1, label: string, errors: string[]): void {
  if (predicate.kind === 'target-relation') {
    if (!['self', 'ally', 'enemy', 'any'].includes(predicate.relation) ||
      (predicate.orCharmedByActor !== undefined && (predicate.orCharmedByActor !== true || predicate.relation !== 'ally'))) {
      errors.push(`${label} target relation or charm alternative is invalid`)
    }
    return
  }
  if (predicate.kind === 'combat-active') return
  if (predicate.kind === 'ethereal-access') {
    if (!['known', 'available', 'unavailable'].includes(predicate.state)) errors.push(`${label} ethereal access is invalid`)
    return
  }
  if (predicate.kind === 'class-level') {
    if (!validId(predicate.classId) || !finiteInteger(predicate.minimum, 0, 20) ||
      (predicate.maximum != null && (!finiteInteger(predicate.maximum, predicate.minimum, 20)))) errors.push(`${label} class-level range is invalid`)
    return
  }
  if (predicate.kind === 'turn-owner') {
    if (predicate.owner !== 'actor' && predicate.owner !== 'other') errors.push(`${label}.owner is invalid`)
    return
  }
  if (predicate.kind === 'hp-value') {
    if (!['actor', 'target'].includes(predicate.subject) ||
      !['below', 'at-most', 'at-least', 'above'].includes(predicate.comparison)) {
      errors.push(`${label} hp-value selector is invalid`)
    }
    if (typeof predicate.value === 'number') {
      if (!finiteNumber(predicate.value, -1_000_000, 1_000_000)) errors.push(`${label}.value is invalid`)
    } else {
      appendFormulaErrors(errors, predicate.value, `${label}.value`)
    }
    return
  }
  if (predicate.kind === 'speed') {
    if (!['actor', 'target'].includes(predicate.subject) ||
      !['below', 'at-most', 'at-least', 'above'].includes(predicate.comparison) ||
      !finiteNumber(predicate.value, 0, 1_000_000)) errors.push(`${label} speed selector is invalid`)
    return
  }
  if (predicate.kind === 'ability-score') {
    if (!['actor', 'target'].includes(predicate.subject) || !ABILITIES.has(predicate.ability) ||
      !['below', 'at-most', 'at-least', 'above'].includes(predicate.comparison) ||
      !finiteInteger(predicate.value, 0, 30)) errors.push(`${label} ability-score selector is invalid`)
    return
  }
  if (predicate.kind === 'illumination') {
    if (
      !['actor', 'target'].includes(predicate.subject) || predicate.values.length < 1 ||
      predicate.values.some((value) => !['bright', 'dim', 'darkness', 'magical-darkness'].includes(value)) ||
      new Set(predicate.values).size !== predicate.values.length
    ) errors.push(`${label} illumination selector is invalid`)
    return
  }
  if (predicate.kind === 'airborne-state') {
    if (!['actor', 'target'].includes(predicate.subject) || ![
      'airborne', 'unsupported-airborne', 'grounded',
    ].includes(predicate.state)) errors.push(`${label} airborne-state selector is invalid`)
    return
  }
  if (predicate.kind === 'rage-state') {
    if (!['actor', 'target'].includes(predicate.subject) || typeof predicate.active !== 'boolean' ||
      Object.keys(predicate).some(key => !['kind', 'subject', 'active'].includes(key))) errors.push(`${label} rage-state selector is invalid`)
    return
  }
  if (predicate.kind === 'target-identity') {
    if (!['self', 'other'].includes(predicate.identity)) errors.push(`${label}.identity is invalid`)
    return
  }
  if (predicate.kind === 'owned-companion') {
    if (predicate.source != null && (typeof predicate.source !== 'object' || Array.isArray(predicate.source) ||
      !validId(predicate.source.packageId) || !validId(predicate.source.activityId))) errors.push(`${label}.source is invalid`)
    if(predicate.bondKey!=null && !validId(predicate.bondKey))errors.push(`${label}.bondKey is invalid`)
    if (predicate.subject !== 'target') errors.push(`${label}.subject is invalid`)
    return
  }
  if (predicate.kind === 'can-hear-source') return
  if (predicate.kind === 'shared-language') return
  if (predicate.kind === 'can-understand-source-language') return
  if (predicate.kind === 'can-speak') {
    if (!['actor', 'target'].includes(predicate.subject)) errors.push(`${label}.subject is invalid`)
    return
  }
  if (predicate.kind === 'effect-bound-temporary-hit-points') {
    if (!['actor', 'target'].includes(predicate.subject) || !validId(predicate.effectId)) {
      errors.push(`${label} effect-bound temporary hit points selector is invalid`)
    }
    return
  }
  if (predicate.kind === 'active-effect') {
    const validSelector = predicate.anyOf == null ? validId(predicate.effectId) :
      predicate.effectId == null && Array.isArray(predicate.anyOf) && predicate.anyOf.length > 0 && predicate.anyOf.length <= 32 &&
      predicate.anyOf.every(selector => {
        if (!selector || typeof selector !== 'object' || Array.isArray(selector)) return false
        if (Object.keys(selector).some(key => key !== 'effectId' && key !== 'tags')) return false
        return selector.effectId != null ? validId(selector.effectId) && selector.tags == null :
          Array.isArray(selector.tags) && selector.tags.length > 0 && selector.tags.length <= 32 &&
          new Set(selector.tags).size === selector.tags.length && selector.tags.every((tag: unknown) => validId(tag) && tag.length <= 80)
      })
    if (!validSelector || !['actor', 'target'].includes(predicate.subject) ||
      !['any', 'self', 'target'].includes(predicate.source) || typeof predicate.present !== 'boolean' ||
      (predicate.source === 'target' && predicate.subject !== 'actor')) {
      errors.push(`${label} active-effect selector is invalid`)
    }
    return
  }
  if (predicate.kind === 'resource-capacity') {
    if (!(validId(predicate.resourceId) || isDnd5eLegacyCoreResourceId(predicate.resourceId))) errors.push(`${label}.resourceId is invalid`)
    appendFormulaErrors(errors, predicate.minimumMissing, `${label}.minimumMissing`)
    return
  }
  if (predicate.kind === 'activity-definition') {
    if (!isDnd5eTrackableDefinitionIdV1(predicate.definitionId)) errors.push(`${label}.definitionId is invalid`)
    return
  }
  if (predicate.kind === 'event-source') {
    if (predicate.sourceId != null && !validId(predicate.sourceId)) errors.push(`${label}.sourceId is invalid`)
    if (predicate.activityId != null && !validId(predicate.activityId)) errors.push(`${label}.activityId is invalid`)
    return
  }
  if (predicate.kind === 'weapon-property') {
    if (!validId(predicate.property)) errors.push(`${label}.property is invalid`)
    return
  }
  if (predicate.kind === 'skill-proficiency' && (!SKILLS.some(skill => skill.key === predicate.skill) || ![0,1,2].includes(predicate.rank))) errors.push(`${label} skill proficiency selector is invalid`)
  if (predicate.kind === 'attack-magical') {
    if (typeof predicate.magical !== 'boolean') errors.push(`${label}.magical is invalid`)
    return
  }
  if (predicate.kind === 'attack-proficiency') {
    if (typeof predicate.proficient !== 'boolean') errors.push(`${label}.proficient is invalid`)
    return
  }
  if (predicate.kind === 'attack-category') {
    if (!['weapon', 'spell'].includes(predicate.category)) errors.push(`${label}.category is invalid`)
    return
  }
  if (predicate.kind === 'upward-clearance') {
    if (!['actor', 'target'].includes(predicate.subject) || typeof predicate.blocked !== 'boolean' ||
      (predicate.distanceFeet !== 'area-height' && !finiteNumber(predicate.distanceFeet, 0.1, 10000))) {
      errors.push(`${label} upward-clearance selector is invalid`)
    }
    return
  }
  if (predicate.kind === 'attack-delivery') {
    if (!['melee', 'ranged'].includes(predicate.delivery)) errors.push(`${label}.delivery is invalid`)
    return
  }
  if (predicate.kind === 'attack-weapon') {
    if (predicate.identity != null && !['instance', 'base'].includes(predicate.identity)) errors.push(`${label}.identity is invalid`)
    if (
      predicate.weaponIds.length < 1 || predicate.weaponIds.length > 64 ||
      predicate.weaponIds.some((id) => !validId(id)) ||
      new Set(predicate.weaponIds).size !== predicate.weaponIds.length
    ) errors.push(`${label}.weaponIds is invalid`)
    return
  }
  if (predicate.kind === 'attack-weapon-category') {
    if (!Array.isArray(predicate.categories) || predicate.categories.length < 1 || predicate.categories.length > 2 ||
      predicate.categories.some(category => !['simple', 'martial'].includes(category)) ||
      new Set(predicate.categories).size !== predicate.categories.length) errors.push(`${label}.categories is invalid`)
    return
  }
  if (predicate.kind === 'attack-origin') {
    if (
      predicate.origins.length < 1 || predicate.origins.length > 4 ||
      predicate.origins.some((origin) => !['attack-action', 'bonus-action', 'reaction', 'other'].includes(origin)) ||
      new Set(predicate.origins).size !== predicate.origins.length
    ) errors.push(`${label} attack origin selector is invalid`)
    return
  }
  if (predicate.kind === 'attack-hands') {
    if (predicate.hands !== 1 && predicate.hands !== 2) errors.push(`${label}.hands is invalid`)
    return
  }
  if (predicate.kind === 'attack-outcome') {
    if (
      predicate.outcomes.length < 1 || predicate.outcomes.length > 2 ||
      predicate.outcomes.some((outcome) => !['critical-hit', 'target-dropped-to-zero'].includes(outcome)) ||
      new Set(predicate.outcomes).size !== predicate.outcomes.length ||
      (predicate.match != null && !['any', 'all'].includes(predicate.match))
    ) errors.push(`${label} attack outcome selector is invalid`)
    return
  }
  if (predicate.kind === 'armor-equipped') {
    if (
      !['actor', 'target'].includes(predicate.subject) ||
      predicate.categories.length < 1 || predicate.categories.length > 4 ||
      predicate.categories.some((category) => !['none', 'light', 'medium', 'heavy'].includes(category)) ||
      new Set(predicate.categories).size !== predicate.categories.length ||
      (predicate.proficient != null && typeof predicate.proficient !== 'boolean')
    ) errors.push(`${label} armor selector is invalid`)
    return
  }
  if (predicate.kind === 'armor-proficiency') {
    if (
      !['actor', 'target'].includes(predicate.subject) ||
      predicate.categories.length < 1 || predicate.categories.length > 4 ||
      predicate.categories.some((category) => !['light', 'medium', 'heavy', 'shield'].includes(category)) ||
      new Set(predicate.categories).size !== predicate.categories.length ||
      (predicate.match != null && !['any', 'all'].includes(predicate.match))
    ) errors.push(`${label} armor proficiency selector is invalid`)
    return
  }
  if (predicate.kind === 'held-item') {
    if (
      !['actor', 'target'].includes(predicate.subject) ||
      !['main-hand', 'off-hand', 'either-hand'].includes(predicate.slot) ||
      (predicate.roles != null && (
        predicate.roles.length < 1 ||
        predicate.roles.some((role) => !['weapon', 'shield', 'spellcasting-focus', 'other'].includes(role)) ||
        new Set(predicate.roles).size !== predicate.roles.length
      )) ||
      (predicate.itemIds != null && (
        predicate.itemIds.length < 1 || predicate.itemIds.some((id) => !validId(id)) ||
        new Set(predicate.itemIds).size !== predicate.itemIds.length
      )) ||
      (predicate.weaponModes != null && (
        predicate.weaponModes.length < 1 ||
        predicate.weaponModes.some((mode) => !['melee', 'ranged'].includes(mode)) ||
        new Set(predicate.weaponModes).size !== predicate.weaponModes.length
      )) ||
      (predicate.requiredWeaponProperties != null && (
        predicate.requiredWeaponProperties.length < 1 ||
        predicate.requiredWeaponProperties.some((property) => !validId(property)) ||
        new Set(predicate.requiredWeaponProperties).size !== predicate.requiredWeaponProperties.length
      )) ||
      (predicate.proficient != null && typeof predicate.proficient !== 'boolean')
    ) errors.push(`${label} held-item selector is invalid`)
    return
  }
  if (predicate.kind === 'free-hands') {
    if (!['actor', 'target'].includes(predicate.subject) || !finiteInteger(predicate.minimum, 0, 2)) {
      errors.push(`${label} free-hands selector is invalid`)
    }
    return
  }
  if (predicate.kind === 'spellcasting-capability') {
    if (
      !['actor', 'target'].includes(predicate.subject) || typeof predicate.capable !== 'boolean' ||
      (predicate.classIds != null && (
        predicate.classIds.length < 1 || predicate.classIds.length > 32 ||
        predicate.classIds.some((id) => !validId(id)) || new Set(predicate.classIds).size !== predicate.classIds.length
      ))
    ) errors.push(`${label} spellcasting selector is invalid`)
    return
  }
  if (predicate.kind === 'attack-mode') {
    const modes = predicate.modes ?? (predicate.mode ? [predicate.mode] : [])
    if (
      (predicate.mode == null) === (predicate.modes == null) ||
      modes.length < 1 || modes.length > 4 ||
      modes.some((mode) => !['melee', 'ranged', 'spell', 'unarmed'].includes(mode)) ||
      new Set(modes).size !== modes.length
    ) errors.push(`${label}.mode is invalid`)
    return
  }
  if (predicate.kind === 'damage-type') {
    if (predicate.damageTypes.length < 1 || predicate.damageTypes.some((damageType) => !DAMAGE_TYPES.has(damageType))) {
      errors.push(`${label}.damageTypes is invalid`)
    }
    return
  }
  if (predicate.kind === 'damage-event') {
    const values = [
      predicate.minimumAmount,
      predicate.maximumAmount,
      predicate.minimumTemporaryHitPointsBefore,
      predicate.maximumTemporaryHitPointsAfter,
    ]
    if (values.every((value) => value == null) || values.some((value) =>
      value != null && !finiteNumber(value, 0, 1_000_000_000))) {
      errors.push(`${label} damage event selector is invalid`)
    }
    if (
      predicate.minimumAmount != null && predicate.maximumAmount != null &&
      predicate.minimumAmount > predicate.maximumAmount
    ) errors.push(`${label} damage amount range is inverted`)
    return
  }
  if (predicate.kind === 'size-rank') {
    if (predicate.minimum != null && !finiteInteger(predicate.minimum, 0, 5)) errors.push(`${label}.minimum is invalid`)
    if (predicate.maximum != null && !finiteInteger(predicate.maximum, 0, 5)) errors.push(`${label}.maximum is invalid`)
    if (predicate.minimum != null && predicate.maximum != null && predicate.minimum > predicate.maximum) {
      errors.push(`${label} range is inverted`)
    }
    return
  }
  if (predicate.kind === 'creature-type') {
    if (
      predicate.types.length < 1 || predicate.types.length > 32 ||
      predicate.types.some((type) => !type.trim() || type.length > 80) ||
      new Set(predicate.types.map((type) => type.trim().toLocaleLowerCase())).size !== predicate.types.length
    ) errors.push(`${label}.types is invalid`)
    return
  }
  if (predicate.kind === 'initial-space-exit' || predicate.kind === 'initial-space-melee-crossing') {
    if (!validId(predicate.effectTag) || predicate.effectTag.length > 80) errors.push(`${label}.effectTag is invalid`)
    return
  }
  if (predicate.kind === 'movement-distance' || predicate.kind === 'movement-source-distance') {
    if (predicate.kind === 'movement-distance' && predicate.basis != null && !['event', 'straight-streak', 'before-attack-straight-streak'].includes(predicate.basis)) errors.push(`${label}.basis is invalid`)
    if (predicate.minimumFeet != null && !finiteNumber(predicate.minimumFeet, 0, 100_000)) errors.push(`${label}.minimumFeet is invalid`)
    if (predicate.maximumFeet != null && !finiteNumber(predicate.maximumFeet, 0, 100_000)) errors.push(`${label}.maximumFeet is invalid`)
    if (predicate.minimumFeet != null && predicate.maximumFeet != null && predicate.minimumFeet > predicate.maximumFeet) {
      errors.push(`${label} range is inverted`)
    }
    return
  }
  if (predicate.kind === 'movement-property') {
    if (
      (predicate.straightLine == null && predicate.dashedThisTurn == null && predicate.movementKind == null) ||
      (predicate.straightLine != null && typeof predicate.straightLine !== 'boolean') ||
      (predicate.dashedThisTurn != null && typeof predicate.dashedThisTurn !== 'boolean') ||
      (predicate.movementKind != null && !['voluntary', 'mounted', 'forced', 'teleport'].includes(predicate.movementKind))
    ) errors.push(`${label} movement property is invalid`)
    return
  }
  if (predicate.kind === 'spell-used') {
    if (predicate.spellId != null && !validId(predicate.spellId)) errors.push(`${label}.spellId is invalid`)
    if (predicate.castingClassIds != null && (
      !Array.isArray(predicate.castingClassIds) || predicate.castingClassIds.length < 1 ||
      predicate.castingClassIds.some((id) => !validId(id)) ||
      new Set(predicate.castingClassIds).size !== predicate.castingClassIds.length
    )) errors.push(`${label}.castingClassIds is invalid`)
    if (predicate.schools != null && (
      !Array.isArray(predicate.schools) || predicate.schools.length < 1 ||
      predicate.schools.some((school) => !SPELL_SCHOOLS.has(school)) ||
      new Set(predicate.schools).size !== predicate.schools.length
    )) errors.push(`${label}.schools is invalid`)
    if (predicate.minimumLevel != null && !finiteInteger(predicate.minimumLevel, 0, 9)) errors.push(`${label}.minimumLevel is invalid`)
    if (predicate.maximumLevel != null && !finiteInteger(predicate.maximumLevel, 0, 9)) errors.push(`${label}.maximumLevel is invalid`)
    if (predicate.minimumLevel != null && predicate.maximumLevel != null && predicate.minimumLevel > predicate.maximumLevel) {
      errors.push(`${label} level range is inverted`)
    }
    return
  }
  if (predicate.kind === 'skill-used' && predicate.skillId != null && !validId(predicate.skillId)) {
    errors.push(`${label}.skillId is invalid`)
  }
}

function validateDuration(duration: Dnd5eEffectDurationV1, label: string, errors: string[]): void {
  if (!duration || typeof duration !== 'object' || Array.isArray(duration)) {
    errors.push(`${label} is invalid`)
    return
  }
  if (duration.kind === 'instantaneous' || duration.kind === 'permanent') return
  if (duration.kind === 'rounds') {
    if (duration.includeCreationTurn != null && (typeof duration.includeCreationTurn !== 'boolean' ||
      duration.rounds !== 1 || !['source-turn-end', 'target-turn-end'].includes(duration.expiresAt))) {
      errors.push(`${label}.includeCreationTurn requires one round and an end-of-turn boundary`)
    }
    // Long-lived deterministic Effects (for example 24-hour wards) still use
    // combat rounds as the canonical Host clock when a combat is active.
    if (!finiteInteger(duration.rounds, 1, 5_256_000)) errors.push(`${label}.rounds is invalid`)
    if (!['source-turn-start', 'source-turn-end', 'target-turn-start', 'target-turn-end'].includes(duration.expiresAt)) {
      errors.push(`${label}.expiresAt is invalid`)
    }
    return
  }
  if (duration.kind === 'concentration') {
    if (!finiteInteger(duration.maximumRounds, 1, 14_400)) errors.push(`${label}.maximumRounds is invalid`)
    return
  }
  if (duration.kind === 'save-ends') {
    if (!finiteInteger(duration.maximumRounds, 1, 5_256_000)) errors.push(`${label}.maximumRounds is invalid`)
    if (!ABILITIES.has(duration.ability)) errors.push(`${label}.ability is invalid`)
    if (duration.abilityOptions != null && !validAbilityOptions(duration.abilityOptions, duration.ability)) {
      errors.push(`${label}.abilityOptions is invalid`)
    }
    if (!['target-turn-start', 'target-turn-end'].includes(duration.timing)) errors.push(`${label}.timing is invalid`)
    if (duration.requiresSourceNotVisible != null && typeof duration.requiresSourceNotVisible !== 'boolean') {
      errors.push(`${label}.requiresSourceNotVisible is invalid`)
    }
    appendFormulaErrors(errors, duration.dc, `${label}.dc`)
    if (duration.damageOnFailure) {
      if (duration.damageOnFailure.destroysBodyOnDeath != null && typeof duration.damageOnFailure.destroysBodyOnDeath !== 'boolean') errors.push(`${label}.damageOnFailure.destroysBodyOnDeath is invalid`)
      if (!finiteInteger(duration.damageOnFailure.count, 1, 40)) errors.push(`${label}.damageOnFailure.count is invalid`)
      if (!finiteInteger(duration.damageOnFailure.sides, 2, 100)) errors.push(`${label}.damageOnFailure.sides is invalid`)
      if (!DAMAGE_TYPES.has(duration.damageOnFailure.type)) errors.push(`${label}.damageOnFailure.type is invalid`)
      if (duration.damageOnFailure.modifier) {
        appendFormulaErrors(errors, duration.damageOnFailure.modifier, `${label}.damageOnFailure.modifier`)
      }
    }
    const successesRequired = duration.successesRequired ?? 1
    const failuresRequired = duration.failuresRequired
    const initialSuccesses = duration.initialSuccesses ?? 0
    const initialFailures = duration.initialFailures ?? 0
    if (!finiteInteger(successesRequired, 1, 10)) errors.push(`${label}.successesRequired is invalid`)
    if (failuresRequired != null && !finiteInteger(failuresRequired, 1, 10)) {
      errors.push(`${label}.failuresRequired is invalid`)
    }
    if (!finiteInteger(initialSuccesses, 0, Math.max(0, successesRequired - 1))) {
      errors.push(`${label}.initialSuccesses is invalid`)
    }
    if (!finiteInteger(initialFailures, 0, Math.max(0, (failuresRequired ?? 1) - 1))) {
      errors.push(`${label}.initialFailures is invalid`)
    }
    if ((failuresRequired == null) !== (duration.onFailureThreshold == null)) {
      errors.push(`${label} failure threshold and transition must be declared together`)
    }
    if (duration.onFailureThreshold) {
      const transition = duration.onFailureThreshold
      if (transition.outcome !== 'retain-effect' && (
        (transition.outcome != null && transition.outcome !== 'replace-condition') ||
        !CONDITIONS.has(transition.replaceWithCondition) ||
        !['permanent', 'source-concentration-then-permanent'].includes(transition.duration)
      )) errors.push(`${label}.onFailureThreshold is invalid`)
    }
    return
  }
  errors.push(`${label}.kind is invalid`)
}

function validateActivation(activation: Dnd5eActivityActivationV1, errors: string[]): void {
  if (!['action', 'bonus-action', 'reaction', 'free', 'movement', 'minute', 'hour', 'passive', 'special'].includes(activation.kind)) {
    errors.push('activity.activation.kind is invalid')
    return
  }
  if (activation.kind === 'minute' || activation.kind === 'hour') {
    if (!finiteInteger(activation.value, 1, 10_000)) errors.push('activity.activation.value is invalid')
    return
  }
  if (activation.kind === 'passive' || activation.kind === 'special') {
    if (activation.timing != null && (!activation.timing.trim() || activation.timing.length > 500)) {
      errors.push('activity.activation.timing is invalid')
    }
    return
  }
  if (
    activation.kind === 'action' || activation.kind === 'bonus-action' ||
    activation.kind === 'reaction' || activation.kind === 'free' || activation.kind === 'movement'
  ) {
    if (activation.cost != null && !finiteInteger(activation.cost, 0, 10)) errors.push('activity.activation.cost is invalid')
    if (activation.kind === 'reaction' && activation.reactionEvent != null && (
      !activation.reactionEvent.trim() || activation.reactionEvent.length > 500
    )) errors.push('activity.activation.reactionEvent is invalid')
  }
}

function validateTrigger(trigger: Dnd5eTriggerDefinitionV1, label: string, errors: string[]): void {
  if (!validId(trigger.id)) errors.push(`${label}.id is invalid`)
  if (!TRIGGER_EVENTS.has(trigger.event)) errors.push(`${label}.event is invalid`)
  if (!trigger.activityId && !trigger.effectId) errors.push(`${label} must reference an activity or effect`)
  if (trigger.activityId && !validId(trigger.activityId)) errors.push(`${label}.activityId is invalid`)
  if (trigger.effectId && !validId(trigger.effectId)) errors.push(`${label}.effectId is invalid`)
  if (trigger.activityId && trigger.effectId) errors.push(`${label} cannot reference both an activity and effect`)
  if (trigger.limit && (
    !finiteInteger(trigger.limit.uses, 1, 1_000) ||
    !['turn', 'round', 'combat', 'short-rest', 'long-rest', 'never'].includes(trigger.limit.reset)
  )) errors.push(`${label}.limit is invalid`)
}

function validateEffect(effect: Dnd5eEffectDefinitionV1, label: string, errors: string[]): void {
  if (effect.magical != null && effect.magical !== true) errors.push(`${label}.magical must be true when present`)
  if (effect.schemaVersion !== 1) errors.push(`${label}.schemaVersion is invalid`)
  if (!validId(effect.id)) errors.push(`${label}.id is invalid`)
  if (effect.exclusiveGroup != null && !validId(effect.exclusiveGroup)) errors.push(`${label}.exclusiveGroup is invalid`)
  if (effect.exclusiveGroupScope != null && (!effect.exclusiveGroup ||
    !['source', 'bearer'].includes(effect.exclusiveGroupScope))) errors.push(`${label}.exclusiveGroupScope is invalid`)
  if (!effect.name.trim() || effect.name.length > 160) errors.push(`${label}.name is invalid`)
  if (effect.sourceAttitude != null && effect.sourceAttitude !== 'friendly') errors.push(`${label}.sourceAttitude is invalid`)
  if (effect.endSavingThrow != null && !validDnd5eEffectEndSavingThrow(effect.endSavingThrow)) errors.push(`${label}.endSavingThrow is invalid`)
  if (effect.onEndAwareness != null && (effect.onEndAwareness !== 'charmed-by-source' || !effect.conditions?.includes('charmed'))) errors.push(`${label}.onEndAwareness is invalid`)
  if (effect.disposition != null && !['buff', 'debuff'].includes(effect.disposition)) {
    errors.push(`${label}.disposition is invalid`)
  }
  if (effect.tags != null && (
    effect.tags.length < 1 || effect.tags.length > 32 ||
    new Set(effect.tags).size !== effect.tags.length || effect.tags.some((tag) => !validId(tag) || tag.length > 80)
  )) errors.push(`${label}.tags is invalid`)
  if (effect.captureInitialSpace != null && effect.captureInitialSpace !== true) {
    errors.push(`${label}.captureInitialSpace must be true`)
  }
  if (effect.bindToGrantingArea != null && (effect.bindToGrantingArea !== true ||
    effect.conditions?.length !== 1 || effect.conditions[0] !== 'restrained')) {
    errors.push(`${label}.bindToGrantingArea requires a single restrained condition`)
  }
  if (effect.grants != null && (
    effect.grants.length < 1 || effect.grants.length > 32 ||
    new Set(effect.grants).size !== effect.grants.length ||
    effect.grants.some((activityId) => !validId(activityId))
  )) errors.push(`${label}.grants is invalid`)
  if (effect.grantsSingleUse != null && (effect.grantsSingleUse !== true || !effect.grants?.length)) {
    errors.push(`${label}.grantsSingleUse requires nonempty grants and must be true`)
  }
  if (effect.grantCharges != null) {
    const charges = effect.grantCharges
    if (typeof charges !== 'object' || Array.isArray(charges) || !effect.grants?.length ||
        effect.grantsSingleUse != null ||
        Object.keys(charges).some(key => !['initial', 'baseCastLevel', 'additionalPerSlotLevel', 'endWhenEmpty', 'lightTiers'].includes(key)) ||
        !createDnd5eEffectGrantCharges(charges, charges.baseCastLevel) ||
        !createDnd5eEffectGrantCharges(charges, 9)) {
      errors.push(`${label}.grantCharges requires valid finite charges and nonempty, non-single-use grants`)
    }
  }
  if (effect.completionGrant != null) {
    const grant = effect.completionGrant
    if (typeof grant !== 'object' || Array.isArray(grant) ||
        !Array.isArray(grant.activityIds) || grant.activityIds.length < 1 || grant.activityIds.length > 32 ||
        grant.activityIds.some(id => !validId(id)) || new Set(grant.activityIds).size !== grant.activityIds.length ||
        !finiteInteger(grant.availableRounds, 1, 14400) ||
        Object.keys(grant).some(key => !['activityIds', 'availableRounds', 'recipient', 'bindTarget', 'singleUse', 'continueUntilUsed'].includes(key)) ||
        (grant.singleUse != null && grant.singleUse !== true) ||
        (grant.continueUntilUsed != null && (grant.continueUntilUsed !== true || grant.singleUse !== true || grant.recipient != null)) ||
        (grant.recipient != null && grant.recipient !== 'source') ||
        (grant.bindTarget != null && !['source', 'bearer'].includes(grant.bindTarget)) ||
        effect.duration.kind !== 'rounds' || effect.concentration === true ||
        effect.completionReward != null || (effect.castLevelProfiles?.length ?? 0) > 0) {
      errors.push(`${label}.completionGrant requires valid activities and a non-concentration round timer`)
    }
  }
  validateDuration(effect.duration, `${label}.duration`, errors)
  if (effect.castLevelProfiles != null) {
    const minimumLevels = effect.castLevelProfiles.map((profile) => profile.minimumCastLevel)
    if (
      effect.castLevelProfiles.length < 1 || effect.castLevelProfiles.length > 9 ||
      minimumLevels.some((level) => !finiteInteger(level, 0, 9)) ||
      new Set(minimumLevels).size !== minimumLevels.length ||
      minimumLevels.some((level, index) => index > 0 && level <= minimumLevels[index - 1])
    ) errors.push(`${label}.castLevelProfiles is invalid`)
    effect.castLevelProfiles.forEach((profile, index) => {
      validateDuration(profile.duration, `${label}.castLevelProfiles[${index}].duration`, errors)
      if (typeof profile.concentration !== 'boolean') {
        errors.push(`${label}.castLevelProfiles[${index}].concentration is invalid`)
      }
      if (profile.concentration && profile.duration.kind !== 'concentration' && profile.duration.kind !== 'save-ends') {
        errors.push(`${label}.castLevelProfiles[${index}] concentration duration is invalid`)
      }
    })
  }
  if (effect.persistAfterConcentrationCompletes != null && (
    effect.persistAfterConcentrationCompletes !== true ||
    effect.concentration !== true ||
    effect.duration.kind !== 'concentration'
  )) errors.push(`${label}.persistAfterConcentrationCompletes is invalid`)
  if (effect.conditions?.some((condition) => !CONDITIONS.has(condition))) errors.push(`${label}.conditions is invalid`)
  if (effect.completionReward != null && (
    (effect.duration.kind === 'rounds' && effect.duration.includeCreationTurn === true) ||
    effect.completionReward.kind !== 'short-rest' ||
    !CONDITIONS.has(effect.completionReward.requiresCondition) ||
    effect.conditions?.length !== 1 || effect.conditions[0] !== effect.completionReward.requiresCondition ||
    effect.duration.kind !== 'rounds' || effect.concentration === true ||
    effect.extensionCondition != null || (effect.castLevelProfiles?.length ?? 0) > 0
  )) errors.push(`${label}.completionReward requires a single timed condition and short-rest reward`)
  if (effect.extensionCondition != null && !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(effect.extensionCondition)) {
    errors.push(`${label}.extensionCondition is invalid`)
  }
  if (effect.breakOn?.some((trigger) => ![
    'takes-damage', 'targeted-by-spell', 'targeted-by-attack', 'hit-by-attack', 'makes-attack', 'makes-weapon-attack',
    'casts-spell', 'forces-saving-throw', 'deals-damage', 'moves', 'spends-action', 'spends-action-except-granted', 'spends-bonus-action', 'spends-reaction',
    'attacked-by-source-or-ally', 'damaged-by-source-or-ally', 'forced-save-by-source-or-ally',
    'attacked-by-condition-entity', 'damaged-by-condition-entity', 'forced-save-by-condition-entity',
    'attacked-by-source-ally', 'damaged-by-source-ally', 'forced-save-by-source-ally', 'attacked-by-source',
    'witnesses-ally-attacked', 'witnesses-ally-damaged', 'witnesses-source-attack-ally', 'witnesses-source-damage-ally',
    'awakened', 'magical-healing', 'reduced-to-zero', 'short-rest-complete', 'long-rest-complete', 'source-dies', 'source-long-rest-complete',
  ].includes(trigger))) errors.push(`${label}.breakOn is invalid`)
  if (effect.sourceLink) {
    const link = effect.sourceLink
    if (
      link.sourceAttacksOtherTarget !== true &&
      link.sourceCastsSpellOnOtherTarget !== true &&
      link.targetHarmedBySourceAlly !== true &&
      link.sourceRequiresEffect == null &&
      link.sourceRequiresEffectAtSourceTurnEnd == null &&
      link.maximumDistanceFeetAtSourceTurnEnd == null &&
      link.maximumDistanceFeet == null &&
      link.requiresLineOfEffect !== true &&
      link.sourceMustBeConsciousAndAbleToSpeak !== true &&
      link.sourceMustNotBeIncapacitated !== true &&
      link.sourceRequiresHeldMeleeWeaponBaseIds == null &&
      link.requiresSourceCommunication !== true && link.requiresSharedLanguage !== true
    ) errors.push(`${label}.sourceLink is empty`)
    if (
      link.maximumDistanceFeetAtSourceTurnEnd != null &&
      (!Number.isFinite(link.maximumDistanceFeetAtSourceTurnEnd) ||
        link.maximumDistanceFeetAtSourceTurnEnd < 0 ||
        link.maximumDistanceFeetAtSourceTurnEnd > 10_000)
    ) errors.push(`${label}.sourceLink.maximumDistanceFeetAtSourceTurnEnd is invalid`)
    if (
      link.sourceRequiresEffect != null &&
      !validId(link.sourceRequiresEffect)
    ) errors.push(`${label}.sourceLink.sourceRequiresEffect is invalid`)
    if (link.sourceRequiresEffectSameApplication != null &&
      (link.sourceRequiresEffectSameApplication !== true || link.sourceRequiresEffect == null)) {
      errors.push(`${label}.sourceLink.sourceRequiresEffectSameApplication requires a source effect`)
    }
    if (
      link.sourceRequiresEffectAtSourceTurnEnd != null &&
      !validId(link.sourceRequiresEffectAtSourceTurnEnd)
    ) errors.push(`${label}.sourceLink.sourceRequiresEffectAtSourceTurnEnd is invalid`)
    if (
      link.maximumDistanceFeet != null &&
      (!Number.isFinite(link.maximumDistanceFeet) || link.maximumDistanceFeet < 0 || link.maximumDistanceFeet > 10_000)
    ) errors.push(`${label}.sourceLink.maximumDistanceFeet is invalid`)
    if (
      link.sourceMustBeConsciousAndAbleToSpeak != null &&
      link.sourceMustBeConsciousAndAbleToSpeak !== true
    ) errors.push(`${label}.sourceLink.sourceMustBeConsciousAndAbleToSpeak is invalid`)
    if (link.sourceRequiresHeldMeleeWeaponBaseIds != null && !validDnd5eHeldWeaponBaseIds(link.sourceRequiresHeldMeleeWeaponBaseIds)) errors.push(`${label}.sourceLink.sourceRequiresHeldMeleeWeaponBaseIds is invalid`)
    if (link.sourceMustNotBeIncapacitated !== undefined && link.sourceMustNotBeIncapacitated !== true) errors.push(`${label}.sourceLink.sourceMustNotBeIncapacitated is invalid`)
    for (const key of ['requiresSourceCommunication', 'requiresSharedLanguage'] as const) {
      if (link[key] !== undefined && link[key] !== true) errors.push(`${label}.sourceLink.${key} is invalid`)
    }
  }
  if (effect.breakOn && new Set(effect.breakOn).size !== effect.breakOn.length) {
    errors.push(`${label}.breakOn is duplicated`)
  }
  if (effect.attackAttemptWard != null) {
    const ward = effect.attackAttemptWard
    if (!ward || typeof ward !== 'object' || Array.isArray(ward) ||
      !ABILITIES.has(ward.ability) || ward.frequency !== 'once-per-turn' ||
      ward.onFailure !== 'cannot-target-this-turn' ||
      (ward.onSuccess != null && ward.onSuccess !== 'source-next-turn-spell-save-disadvantage') ||
      Object.keys(ward).some(key => !['ability','dc','frequency','onFailure','onSuccess'].includes(key))) {
      errors.push(`${label}.attackAttemptWard is invalid`)
    } else {
      appendFormulaErrors(errors, ward.dc, `${label}.attackAttemptWard.dc`)
      if (formulaContainsDice(ward.dc)) errors.push(`${label}.attackAttemptWard.dc cannot roll dice`)
    }
  }
  if (effect.spellcastingSave) {
    if (!ABILITIES.has(effect.spellcastingSave.ability)) errors.push(`${label}.spellcastingSave.ability is invalid`)
    appendFormulaErrors(errors, effect.spellcastingSave.dc, `${label}.spellcastingSave.dc`)
    if (formulaContainsDice(effect.spellcastingSave.dc)) errors.push(`${label}.spellcastingSave.dc cannot roll dice`)
  }
  if(effect.repeatSaveAtTurnBoundary){
    const repeat=effect.repeatSaveAtTurnBoundary
    if(!ABILITIES.has(repeat.ability)||!['target-turn-start','target-turn-end'].includes(repeat.timing))errors.push(`${label}.repeatSaveAtTurnBoundary is invalid`)
    if(effect.duration.kind==='save-ends'||effect.repeatSaveOnDamage||effect.repeatSaveAfterMovement)errors.push(`${label}.repeatSaveAtTurnBoundary conflicts with another repeat save`)
    appendFormulaErrors(errors,repeat.dc,`${label}.repeatSaveAtTurnBoundary.dc`)
    if(formulaContainsDice(repeat.dc))errors.push(`${label}.repeatSaveAtTurnBoundary.dc cannot roll dice`)
  }
  if (effect.repeatSaveOnDamage) {
    const repeat = effect.repeatSaveOnDamage
    if (
      !ABILITIES.has(repeat.ability) ||
      !['normal', 'advantage'].includes(repeat.mode) ||
      (repeat.sourceFilter != null && !['any', 'source-or-allies'].includes(repeat.sourceFilter)) ||
      (repeat.advantageIfSourceOrAllies != null && repeat.advantageIfSourceOrAllies !== true)
    ) errors.push(`${label}.repeatSaveOnDamage is invalid`)
    appendFormulaErrors(errors, repeat.dc, `${label}.repeatSaveOnDamage.dc`)
    if (formulaContainsDice(repeat.dc)) errors.push(`${label}.repeatSaveOnDamage.dc cannot roll dice`)
  }
  if (effect.repeatSaveAfterMovement) {
    const repeat = effect.repeatSaveAfterMovement
    if (!ABILITIES.has(repeat.ability)) errors.push(`${label}.repeatSaveAfterMovement is invalid`)
    appendFormulaErrors(errors, repeat.dc, `${label}.repeatSaveAfterMovement.dc`)
    if (formulaContainsDice(repeat.dc)) errors.push(`${label}.repeatSaveAfterMovement.dc cannot roll dice`)
  }
  if (effect.escapeCheck && effect.conditions?.length !== 1 && effect.extensionCondition !== 'banished') {
    errors.push(`${label} escape requires exactly one condition carrier`)
  }
  if (effect.escapeCheck) {
    const escape = effect.escapeCheck
    if (
      !ABILITIES.has(escape.ability) ||
      (escape.alternativeAbility != null && !ABILITIES.has(escape.alternativeAbility)) ||
      (escape.skill != null && !['athletics', 'acrobatics'].includes(escape.skill)) ||
      (escape.alternativeSkill != null && !['athletics', 'acrobatics'].includes(escape.alternativeSkill)) ||
      (escape.automaticSuccessStatBlockIds != null && (
        escape.automaticSuccessStatBlockIds.length > 32 ||
        new Set(escape.automaticSuccessStatBlockIds).size !== escape.automaticSuccessStatBlockIds.length ||
        escape.automaticSuccessStatBlockIds.some((id) => !/^[a-z0-9][a-z0-9:._-]{0,159}$/i.test(id))
      )) ||
      escape.economy !== 'action'
    ) errors.push(`${label}.escapeCheck is invalid`)
    appendFormulaErrors(errors, escape.dc, `${label}.escapeCheck.dc`)
    if (formulaContainsDice(escape.dc)) errors.push(`${label}.escapeCheck.dc cannot roll dice`)
  }
  if (effect.escapeSavingThrow) {
    const escape = effect.escapeSavingThrow
    if (!ABILITIES.has(escape.ability) || escape.economy !== 'action') {
      errors.push(`${label}.escapeSavingThrow is invalid`)
    }
    appendFormulaErrors(errors, escape.dc, `${label}.escapeSavingThrow.dc`)
    if (formulaContainsDice(escape.dc)) errors.push(`${label}.escapeSavingThrow.dc cannot roll dice`)
  }
  if (effect.removalAction) {
    const removal = effect.removalAction
    if (
      !removal.label.trim() || removal.label.length > 160 ||
      (removal.economy !== 'action' && !(removal.economy === 'free' &&
        removal.selfOnly === true && removal.maxDistanceFeet === 0 && removal.abilityCheck == null)) ||
      (removal.selfOnly !== undefined && removal.selfOnly !== true) ||
      !Number.isFinite(removal.maxDistanceFeet) ||
      removal.maxDistanceFeet < 0 || removal.maxDistanceFeet > 10_000 ||
      (removal.abilityCheck != null && (
        !ABILITIES.has(removal.abilityCheck.ability) ||
        (removal.abilityCheck.skill != null && !['medicine', 'arcana', 'athletics'].includes(removal.abilityCheck.skill))
      ))
    ) errors.push(`${label}.removalAction is invalid`)
    if (removal.abilityCheck) {
      appendFormulaErrors(errors, removal.abilityCheck.dc, `${label}.removalAction.abilityCheck.dc`)
      if (formulaContainsDice(removal.abilityCheck.dc)) {
        errors.push(`${label}.removalAction.abilityCheck.dc cannot roll dice`)
      }
    }
  }
  if (effect.onDamageCondition && (
    !CONDITIONS.has(effect.onDamageCondition.condition) ||
    effect.onDamageCondition.duration !== 'until-target-next-turn-end'
  )) errors.push(`${label}.onDamageCondition is invalid`)
  if (effect.afterEffectEnds && (
    !['until-target-next-turn-end', 'rounds'].includes(effect.afterEffectEnds.duration) ||
    (effect.afterEffectEnds.duration === 'rounds' && !finiteInteger(effect.afterEffectEnds.rounds, 1, 14_400)) ||
    (effect.afterEffectEnds.duration !== 'rounds' && effect.afterEffectEnds.rounds != null) ||
    (effect.afterEffectEnds.trigger != null &&
      !['any-removal', 'manual-removal', 'non-manual-removal'].includes(effect.afterEffectEnds.trigger)) ||
    (effect.afterEffectEnds.requiresAirborne != null && typeof effect.afterEffectEnds.requiresAirborne !== 'boolean') ||
    typeof effect.afterEffectEnds.preventActions !== 'boolean' ||
    typeof effect.afterEffectEnds.preventMovement !== 'boolean' ||
    (effect.afterEffectEnds.controlledDescent != null && (
      !finiteInteger(effect.afterEffectEnds.controlledDescent.maximumFeetPerRound, 1, 10_000) ||
      effect.afterEffectEnds.controlledDescent.safeLanding !== true ||
      effect.afterEffectEnds.controlledDescent.endsOnLanding !== true
    )) ||
    (!effect.afterEffectEnds.preventActions && !effect.afterEffectEnds.preventMovement &&
      effect.afterEffectEnds.controlledDescent == null)
  )) errors.push(`${label}.afterEffectEnds is invalid`)
  if (effect.suspendWhileEffectId != null && !ID_PATTERN.test(effect.suspendWhileEffectId)) {
    errors.push(`${label}.suspendWhileEffectId is invalid`)
  }
  if (effect.periodicDamage) {
    const periodic = effect.periodicDamage
    if (
      !['target-turn-start', 'target-turn-end', 'source-turn-start'].includes(periodic.timing) ||
      !finiteInteger(periodic.count, 1, 40) ||
      !finiteInteger(periodic.sides, 2, 100) ||
      !DAMAGE_TYPES.has(periodic.type) ||
      (periodic.magical != null && typeof periodic.magical !== 'boolean')
    ) errors.push(`${label}.periodicDamage is invalid`)
    if (periodic.modifier) {
      appendFormulaErrors(errors, periodic.modifier, `${label}.periodicDamage.modifier`)
      if (formulaContainsDice(periodic.modifier)) errors.push(`${label}.periodicDamage.modifier cannot roll dice`)
    }
  }
  if (effect.periodicHealing) {
    const periodic = effect.periodicHealing
    if (!['target-turn-start', 'target-turn-end'].includes(periodic.timing)) {
      errors.push(`${label}.periodicHealing is invalid`)
    }
    appendFormulaErrors(errors, periodic.amount, `${label}.periodicHealing.amount`)
    if (formulaContainsDice(periodic.amount)) {
      errors.push(`${label}.periodicHealing.amount cannot roll dice`)
    }
  }
  if (effect.undeadCreationProtection != null && (
    !effect.undeadCreationProtection || typeof effect.undeadCreationProtection !== 'object' ||
    Array.isArray(effect.undeadCreationProtection) ||
    effect.undeadCreationProtection.minimumPower !== 'wish' ||
    Object.keys(effect.undeadCreationProtection).some(key => key !== 'minimumPower')
  )) errors.push(`${label}.undeadCreationProtection is invalid`)
  if (effect.bodyRestoration && (
    !Number.isInteger(effect.bodyRestoration.afterRounds) ||
    effect.bodyRestoration.afterRounds < 1 ||
    effect.bodyRestoration.afterRounds > 5_256_000
  )) {
    errors.push(`${label}.bodyRestoration.afterRounds is invalid`)
  }
  if (effect.calendarRepeatSave) {
    const repeat = effect.calendarRepeatSave
    if (
      !Number.isSafeInteger(repeat.intervalMinutes) ||
      repeat.intervalMinutes < 1 ||
      repeat.intervalMinutes > 5_256_000 ||
      !ABILITIES.has(repeat.ability) ||
      repeat.onSuccess !== 'remove'
    ) errors.push(`${label}.calendarRepeatSave is invalid`)
    appendFormulaErrors(errors, repeat.dc, `${label}.calendarRepeatSave.dc`)
    if (formulaContainsDice(repeat.dc)) {
      errors.push(`${label}.calendarRepeatSave.dc cannot roll dice`)
    }
  }
  if (effect.planarBanishment && (
    effect.planarBanishment.foreignDuration !== 'permanent' ||
    !finiteInteger(effect.planarBanishment.localDurationRounds, 1, 14_400) ||
    !Array.isArray(effect.planarBanishment.foreignCreatureTypes) ||
    effect.planarBanishment.foreignCreatureTypes.length < 1 ||
    effect.planarBanishment.foreignCreatureTypes.length > 32 ||
    effect.planarBanishment.foreignCreatureTypes.some((type) =>
      typeof type !== 'string' || type.trim().length < 1 || type.length > 80)
  )) errors.push(`${label}.planarBanishment is invalid`)
  if ((effect.modifiers ?? []).filter(modifier => modifier.kind === 'armor-enchantment' || modifier.kind === 'weapon-enchantment').length > 1) {
    errors.push(`${label} must bind at most one physical item; use separate effects for separate items`)
  }
  if ((effect.modifiers ?? []).filter(modifier => modifier.kind === 'roll-dice').length > 16) {
    errors.push(`${label} exceeds the maximum number of roll-dice modifiers`)
  }
  if ((effect.modifiers ?? []).filter(modifier => modifier.kind === 'armor-class' && modifier.cohortProximity).length > 1) {
    errors.push(`${label} supports only one cohort-proximity armor-class modifier`)
  }
  for (const [index, modifier] of (effect.modifiers ?? []).entries()) {
    const modifierLabel = `${label}.modifiers[${index}]`
    if (modifier.kind === 'roll-dice' && !normalizeDnd5eRollDiceModifiers([modifier.dice])) {
      errors.push(`${modifierLabel} roll-dice is invalid`)
    }
    if (modifier.kind === 'optional-bonus-die') {
      if (
        ![4, 6, 8, 10, 12].includes(modifier.sides) || typeof modifier.consumeOnUse !== 'boolean' ||
        !Array.isArray(modifier.appliesTo) || modifier.appliesTo.length < 1 || modifier.appliesTo.length > 2 ||
        modifier.appliesTo.some((kind) => kind !== 'ability-check' && kind !== 'saving-throw') ||
        new Set(modifier.appliesTo).size !== modifier.appliesTo.length ||
        (modifier.boundTargetSource !== undefined &&
          (!validDnd5eOptionalBonusDieSourceConstraint(modifier.boundTargetSource) ||
            !(effect.modifiers ?? []).some(entry => entry.kind === 'on-hit-bonus-damage' && entry.bindToSelectedTarget === true)))
      ) errors.push(`${modifierLabel} optional-bonus-die is invalid`)
      if ((effect.modifiers ?? []).filter((entry) => entry.kind === 'optional-bonus-die').length > 1) {
        errors.push(`${modifierLabel} only one optional-bonus-die is supported per Effect`)
      }
    }
    if (modifier.kind === 'healing-prevention' && !['all', 'nonmagical'].includes(modifier.scope)) {
      errors.push(`${modifierLabel}.scope is invalid`)
    }
    if (modifier.kind === 'speed' && !['add', 'multiply', 'minimum', 'maximum', 'override'].includes(modifier.mode)) {
      errors.push(`${modifierLabel}.mode is invalid`)
    }
    if (modifier.kind === 'armor-class' && !['add', 'minimum', 'maximum', 'override'].includes(modifier.mode)) {
      errors.push(`${modifierLabel}.mode is invalid`)
    }
    if (modifier.kind === 'armor-class' && modifier.cohortProximity != null &&
      (modifier.mode !== 'add' || !validDnd5eCohortProximity(modifier.cohortProximity))) {
      errors.push(`${modifierLabel}.cohortProximity requires add mode and valid range/match`)
    }
    if (modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') {
      if (!['add', 'advantage', 'disadvantage'].includes(modifier.mode)) errors.push(`${modifierLabel}.mode is invalid`)
      if (modifier.mode === 'add' && modifier.value == null) errors.push(`${modifierLabel}.value is required for add mode`)
      if (modifier.mode !== 'add' && modifier.value != null) errors.push(`${modifierLabel}.value is only supported for add mode`)
    }
    if ((modifier.kind === 'weapon-damage-roll' || modifier.kind === 'hit-point-maximum') && modifier.mode !== 'add') {
      errors.push(`${modifierLabel}.mode is invalid`)
    }
    if (
      modifier.kind === 'armor-class' || modifier.kind === 'speed' ||
      modifier.kind === 'hit-point-maximum' ||
      ((modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value) ||
      modifier.kind === 'weapon-damage-roll'
    ) appendFormulaErrors(errors, modifier.value, `${modifierLabel}.value`)
    if (modifier.kind === 'armor-enchantment') {
      if (modifier.itemSelection != null && modifier.itemSelection !== 'inventory-item') errors.push(`${modifierLabel}.itemSelection is invalid`)
      appendFormulaErrors(errors, modifier.armorClassBonus, `${modifierLabel}.armorClassBonus`)
      if (modifier.requiresNonmagical != null && modifier.requiresNonmagical !== true) errors.push(`${modifierLabel}.requiresNonmagical is invalid`)
    }
    if (modifier.kind === 'weapon-enchantment') {
      if (modifier.sourceWielderOnly != null && (modifier.sourceWielderOnly !== true || modifier.weaponSlot === 'ammunition-container')) errors.push(`${modifierLabel}.sourceWielderOnly is invalid`)
      if (modifier.weaponBaseIds != null && (!Array.isArray(modifier.weaponBaseIds) || modifier.weaponBaseIds.length < 1 || modifier.weaponBaseIds.length > 32 ||
        modifier.weaponBaseIds.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9:._-]{0,159}$/.test(id)) || new Set(modifier.weaponBaseIds).size !== modifier.weaponBaseIds.length || modifier.weaponSlot === 'ammunition-container')) {
        errors.push(`${modifierLabel}.weaponBaseIds is invalid`)
      }
      if (modifier.requiresNoIntrinsicAttackAndDamageBonus != null && (modifier.requiresNoIntrinsicAttackAndDamageBonus !== true || modifier.weaponSlot === 'ammunition-container')) {
        errors.push(`${modifierLabel}.requiresNoIntrinsicAttackAndDamageBonus is invalid`)
      }

      appendFormulaErrors(errors, modifier.attackAndDamageBonus, `${modifierLabel}.attackAndDamageBonus`)
      if (modifier.attackUses) appendFormulaErrors(errors, modifier.attackUses, `${modifierLabel}.attackUses`)
      if (
        !['main-hand', 'off-hand', 'ammunition-container', 'inventory-item'].includes(modifier.weaponSlot) ||
        (modifier.consumeOnDraw != null && (modifier.consumeOnDraw !== true || modifier.weaponSlot !== 'ammunition-container' || !modifier.attackUses)) ||
        (modifier.spellcastingFocusClassIds != null && (!validWeaponFocusClassIds(modifier.spellcastingFocusClassIds) || modifier.weaponSlot === 'ammunition-container')) ||
        (modifier.requiresNonmagical != null && (modifier.requiresNonmagical !== true || modifier.weaponSlot === 'ammunition-container')) ||
        (modifier.bonusDamage != null && (
          !finiteInteger(modifier.bonusDamage.count, 1, 40) ||
          !finiteInteger(modifier.bonusDamage.sides, 2, 100) ||
          !DAMAGE_TYPES.has(modifier.bonusDamage.type) ||
          (modifier.bonusDamage.magical != null && typeof modifier.bonusDamage.magical !== 'boolean')
        ))
      ) errors.push(`${modifierLabel} weapon-enchantment is invalid`)
    }
    if (modifier.kind === 'weapon-damage-replacement' && (
      modifier.attackModes.length < 1 || modifier.attackModes.length > 2 ||
      modifier.attackModes.some((mode) => mode !== 'melee' && mode !== 'ranged') ||
      new Set(modifier.attackModes).size !== modifier.attackModes.length
    )) errors.push(`${modifierLabel} weapon-damage-replacement is invalid`)
    if (modifier.kind === 'weapon-damage-multiplier' && (
      !finiteNumber(modifier.multiplier, 0, 10) ||
      (modifier.ability != null && modifier.ability !== 'str' && modifier.ability !== 'dex') ||
      (modifier.attackModes != null && (
        modifier.attackModes.length < 1 ||
        new Set(modifier.attackModes).size !== modifier.attackModes.length ||
        modifier.attackModes.some((mode) => mode !== 'melee' && mode !== 'ranged')
      ))
    )) errors.push(`${modifierLabel} weapon damage multiplier is invalid`)
    if (modifier.kind === 'movement-boundary-save') {
      if (!finiteNumber(modifier.maximumDistanceFeet, 0, 10_000) || !ABILITIES.has(modifier.ability)) {
        errors.push(`${modifierLabel} movement-boundary-save is invalid`)
      }
      appendFormulaErrors(errors, modifier.dc, `${modifierLabel}.dc`)
    }
    if (modifier.kind === 'damage-reduction' || modifier.kind === 'on-hit-bonus-damage') {
      if (modifier.kind === 'on-hit-bonus-damage' && modifier.amount?.kind === 'weapon-dice') {
        if (!finiteInteger(modifier.amount.count, 1, 1000) ||
          (modifier.amount.bonus != null && !finiteInteger(modifier.amount.bonus, -1_000_000, 1_000_000)) ||
          Object.keys(modifier.amount).some(key => !['kind', 'count', 'bonus'].includes(key))) {
          errors.push(`${modifierLabel}.amount weapon dice declaration is invalid`)
        }
      } else appendFormulaErrors(errors, modifier.amount, `${modifierLabel}.amount`)
    }
    if (modifier.kind === 'saving-throw' && modifier.ability && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (modifier.kind === 'death-saving-throw' && modifier.mode !== 'advantage') {
      errors.push(`${modifierLabel} death saving throw mode is invalid`)
    }
    if (modifier.kind === 'speed-after-own-turn-weapon-attack' && modifier.attackActionOnly != null && typeof modifier.attackActionOnly !== 'boolean') errors.push(`${modifierLabel}.attackActionOnly is invalid`)
    if (modifier.kind === 'speed-after-own-turn-weapon-attack' && !finiteInteger(modifier.bonusFeet, 1, 1000)) errors.push(`${modifierLabel}.bonusFeet is invalid`)
    if (modifier.kind === 'weapon-attack-roll' && !['advantage', 'disadvantage'].includes(modifier.mode)) errors.push(`${modifierLabel} weapon attack roll mode is invalid`)
    if (modifier.kind === 'next-d20-advantage' && (!Array.isArray(modifier.rollKinds) || modifier.rollKinds.length < 1 || modifier.rollKinds.length > 3 ||
      new Set(modifier.rollKinds).size !== modifier.rollKinds.length || modifier.rollKinds.some(kind => !['attack', 'ability-check', 'saving-throw'].includes(kind)))) errors.push(`${modifierLabel}.rollKinds is invalid`)
    if (modifier.kind === 'weapon-attack-roll' && modifier.weaponCategories !== undefined && (
      !Array.isArray(modifier.weaponCategories) || modifier.weaponCategories.length < 1 ||
      modifier.weaponCategories.length > 2 ||
      modifier.weaponCategories.some(category => !['simple', 'martial'].includes(category)) ||
      new Set(modifier.weaponCategories).size !== modifier.weaponCategories.length
    )) errors.push(`${modifierLabel}.weaponCategories is invalid`)
    if (modifier.kind === 'weapon-attacks-against-target' && (
      !['advantage', 'disadvantage'].includes(modifier.mode) ||
      (modifier.delivery !== undefined && !['melee', 'ranged'].includes(modifier.delivery))
    )) errors.push(`${modifierLabel} incoming weapon attack mode or delivery is invalid`)
    if (modifier.kind === 'attack-target-lock' && (modifier.attacksAgainstOthersThanSource !== 'disadvantage' ||
      (modifier.notifySourceOnDamage != null && modifier.notifySourceOnDamage !== true) ||
      (modifier.sourceRangeFeet != null && (typeof modifier.sourceRangeFeet !== 'number' ||
        !Number.isFinite(modifier.sourceRangeFeet) || modifier.sourceRangeFeet < 0 || modifier.sourceRangeFeet > 10000)))) {
      errors.push(`${modifierLabel} attack target lock is invalid`)
    }
    if (modifier.kind === 'attack-roll' && modifier.sourceProximity !== undefined &&
      (modifier.mode !== 'advantage' || modifier.ability !== undefined || !validDnd5eSourceProximityAttack(modifier.sourceProximity))) {
      errors.push(`${modifierLabel}.sourceProximity requires unconditional-ability attack advantage and valid source conditions`)
    }
    if (modifier.kind === 'attacks-against-target' &&
      modifier.mode !== 'advantage' && modifier.mode !== 'disadvantage') {
      errors.push(`${modifierLabel} attacks-against-target mode is invalid`)
    }
    if (modifier.kind === 'attacks-against-source-armor-class' &&
      !finiteInteger(modifier.bonus, -20, 20)) {
      errors.push(`${modifierLabel} attacks-against-source armor class bonus is invalid`)
    }
    if (modifier.kind === 'damage-rolls-by-source-bonus') errors.push(...validateDnd5eFormulaV1(modifier.value, `${modifierLabel}.value`))
    if (modifier.kind === 'attacks-by-source-critical-threshold' && !finiteInteger(modifier.threshold, 2, 20)) {
      errors.push(`${modifierLabel} critical threshold is invalid`)
    }
    if ((modifier.kind === 'own-turn-attack-action-bonus' || modifier.kind === 'attack-action-minimum') && !finiteInteger(modifier.attacks, 1, 10)) errors.push(`${modifierLabel}.attacks is invalid`)
    if (modifier.kind === 'equipment-proficiency' && (!Array.isArray(modifier.categories) || !modifier.categories.length || modifier.categories.some(value => !['light','medium','heavy','shield','simple','martial'].includes(value)))) errors.push(`${modifierLabel}.categories is invalid`)
    if (modifier.kind === 'saving-throw-proficiency' && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (modifier.kind === 'skill-expertise' && !SKILLS.some(skill => skill.key === modifier.skill)) {
      errors.push(`${modifierLabel}.skill is invalid`)
    }
    if (modifier.kind === 'maximize-healing-dice' && modifier.whenOwnedCompanionWithin !== undefined &&
      !validDnd5eOwnedCompanionProximity(modifier.whenOwnedCompanionWithin)) errors.push(`${modifierLabel} companion proximity is invalid`)
    if (modifier.kind === 'ability-check') {
      if (!validDnd5eAbilityCheckRule(modifier.mode === 'add' ? { ...modifier, mode: 'advantage' } : modifier)) errors.push(`${modifierLabel} ability-check selector is invalid`)
      if (modifier.mode === 'add') {
        if ('sense' in modifier) errors.push(`${modifierLabel}.sense is unsupported for add mode`)
        if (!modifier.skill) errors.push(`${modifierLabel}.skill is required for add mode`)
        appendFormulaErrors(errors, modifier.value, `${modifierLabel}.value`)
      }
    }
    if (modifier.kind === 'perception-target-lock' &&
      modifier.disadvantageAgainstOthersThanSource !== true) {
      errors.push(`${modifierLabel} perception target lock is invalid`)
    }
    if (modifier.kind === 'skill-check-bonus-aura' && (
      !SKILLS.some(skill => skill.key === modifier.skill) ||
      !finiteInteger(modifier.bonus, -100, 100) ||
      !finiteInteger(modifier.radiusFeet, 0, 10_000) ||
      modifier.relation !== 'ally-and-self' ||
      ((modifier.mundaneTracking == null) !== (modifier.leavesTracks == null)) ||
      (modifier.mundaneTracking != null && modifier.mundaneTracking !== 'impossible') ||
      (modifier.leavesTracks != null && modifier.leavesTracks !== false)
    )) errors.push(`${modifierLabel} skill-check bonus aura is invalid`)
    if (modifier.kind === 'minimum-ability-check-d20' && (
      !ABILITIES.has(modifier.ability) || !finiteInteger(modifier.minimum, 1, 20)
    )) errors.push(`${modifierLabel} minimum ability-check d20 is invalid`)
    if (modifier.kind === 'attack-roll' && modifier.ability != null && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (
      (modifier.kind === 'damage-resistance' || modifier.kind === 'suppress-damage-resistance' || modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability') &&
      modifier.damageType !== 'all' && !DAMAGE_TYPES.has(modifier.damageType)
    ) errors.push(`${modifierLabel}.damageType is invalid`)
    if (modifier.kind === 'conditional-damage-resistance' && (
      (modifier.sourceAura != null && !isDnd5eSourceAuraRequirement(modifier.sourceAura)) ||
      modifier.damageTypes.length < 1 ||
      new Set(modifier.damageTypes).size !== modifier.damageTypes.length ||
      modifier.damageTypes.some((type) => !DAMAGE_TYPES.has(type)) ||
      (modifier.sourceMagical != null && typeof modifier.sourceMagical !== 'boolean') ||
      (modifier.attackOnly != null && typeof modifier.attackOnly !== 'boolean') ||
      (modifier.deliveries != null && (
        modifier.deliveries.length < 1 ||
        new Set(modifier.deliveries).size !== modifier.deliveries.length ||
        modifier.deliveries.some((delivery) => !['weapon-attack', 'spell', 'other'].includes(delivery))
      ))
    )) errors.push(`${modifierLabel} conditional damage resistance is invalid`)
    if (modifier.kind === 'condition-immunity' && !CONDITIONS.has(modifier.condition)) {
      errors.push(`${modifierLabel}.condition is invalid`)
    }
    if (modifier.kind === 'condition-immunity-by-source-creature-type' && (
      modifier.conditions.length < 1 || modifier.conditions.length > 32 ||
      new Set(modifier.conditions).size !== modifier.conditions.length ||
      modifier.conditions.some((condition) => !validId(condition) || condition.length > 80) ||
      modifier.sourceCreatureTypes.length < 1 || modifier.sourceCreatureTypes.length > 32 ||
      new Set(modifier.sourceCreatureTypes).size !== modifier.sourceCreatureTypes.length ||
      modifier.sourceCreatureTypes.some((type) => !validId(type) || type.length > 80)
    )) errors.push(`${modifierLabel} conditional condition immunity is invalid`)
    if (modifier.kind === 'saving-throw-advantage-by-source-creature-type' && (
      modifier.conditions.length < 1 || modifier.conditions.length > 32 ||
      new Set(modifier.conditions).size !== modifier.conditions.length ||
      modifier.conditions.some((condition) => !validId(condition) || condition.length > 80) ||
      modifier.sourceCreatureTypes.length < 1 || modifier.sourceCreatureTypes.length > 32 ||
      new Set(modifier.sourceCreatureTypes).size !== modifier.sourceCreatureTypes.length ||
      modifier.sourceCreatureTypes.some((type) => !validId(type) || type.length > 80)
    )) errors.push(`${modifierLabel} source-qualified save advantage is invalid`)
    if (modifier.kind === 'condition-immunity-by-source-magic' && (
      modifier.conditions.length < 1 || modifier.conditions.length > 32 ||
      new Set(modifier.conditions).size !== modifier.conditions.length ||
      modifier.conditions.some((condition) => !validId(condition) || condition.length > 80) ||
      typeof modifier.sourceMagical !== 'boolean' ||
      (modifier.suppressExisting != null && modifier.suppressExisting !== true)
    )) errors.push(`${modifierLabel} magic-qualified condition immunity is invalid`)
    if (modifier.kind === 'attacks-against-target-by-creature-type' && (
      modifier.mode !== 'disadvantage' ||
      modifier.sourceCreatureTypes.length < 1 || modifier.sourceCreatureTypes.length > 32 ||
      new Set(modifier.sourceCreatureTypes).size !== modifier.sourceCreatureTypes.length ||
      modifier.sourceCreatureTypes.some((type) => !validId(type) || type.length > 80)
    )) errors.push(`${modifierLabel} conditional incoming attack mode is invalid`)
    if (modifier.kind === 'character-capability') {
      const expectsNumber = NUMERIC_CHARACTER_CAPABILITIES.has(modifier.capability)
      const expectsList = STRING_LIST_CHARACTER_CAPABILITIES.has(modifier.capability)
      const validNaturalWeapons = Array.isArray(modifier.value) && modifier.value.length > 0 && modifier.value.length <= 8 &&
        modifier.value.every(weapon => weapon && typeof weapon === 'object' &&
          typeof weapon.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,79}$/.test(weapon.id) &&
          typeof weapon.name === 'string' && weapon.name.trim().length > 0 && weapon.name.length <= 120 &&
          [4, 6, 8, 10, 12].includes(weapon.damageDieSides) && ['bludgeoning', 'piercing', 'slashing'].includes(weapon.damageType) &&
          (weapon.magical == null || typeof weapon.magical === 'boolean')) &&
        new Set(modifier.value.map(weapon => typeof weapon === 'object' && weapon ? weapon.id : undefined)).size === modifier.value.length
      const validMovementBonuses = modifier.value != null && typeof modifier.value === 'object' && !Array.isArray(modifier.value) &&
        Object.keys(modifier.value).length > 0 && Object.entries(modifier.value).every(([mode, bonus]) =>
          ['walk', 'climb', 'swim', 'fly'].includes(mode) && finiteInteger(bonus, 1, 1000))
      const validValue = modifier.capability === 'inherentLight' ? validDnd5eInherentFeatureLight(modifier.value)
        : modifier.capability === 'existingMovementSpeedBonuses' ? validMovementBonuses
        : modifier.capability === 'initiativeBonusFromAbility' ? typeof modifier.value === 'string' && ABILITIES.has(modifier.value as AbilityKey)
        : modifier.capability === 'naturalWeapons' ? validNaturalWeapons : expectsNumber
        ? finiteNumber(modifier.value, 0, 1_000_000)
        : expectsList
          ? Array.isArray(modifier.value) && modifier.value.length > 0 && modifier.value.length <= 128 &&
            modifier.value.every((entry) => validId(entry))
          : typeof modifier.value === 'boolean'
      if (
        effect.duration.kind !== 'permanent' || !CHARACTER_CAPABILITIES.has(modifier.capability) || !validValue
      ) errors.push(`${modifierLabel} character-capability is invalid`)
    }
    if (modifier.kind === 'racial-saving-throw-advantage') {
      const conditions = modifier.conditions ?? []
      const damageTypes = modifier.damageTypes ?? []
      const magicAbilities = modifier.magicAbilities ?? []
      if (
        effect.duration.kind !== 'permanent' ||
        conditions.length + damageTypes.length + magicAbilities.length === 0 ||
        conditions.length > 32 || conditions.some((condition) => typeof condition !== 'string' || !condition.trim() || condition.length > 120) ||
        damageTypes.some((damageType) => !DAMAGE_TYPES.has(damageType)) ||
        magicAbilities.some((ability) => !ABILITIES.has(ability))
      ) errors.push(`${modifierLabel} racial-saving-throw-advantage is invalid`)
    }
    if (modifier.kind === 'maximum-attacks-per-turn' && !finiteInteger(modifier.value, 0, 1_000)) {
      errors.push(`${modifierLabel}.value is invalid`)
    }
    if (modifier.kind === 'restricted-extra-action' && (
      modifier.maximumWeaponAttacks !== 1 ||
      modifier.allowedActions.length < 1 ||
      modifier.allowedActions.some((action) =>
        !['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'].includes(action)) ||
      new Set(modifier.allowedActions).size !== modifier.allowedActions.length
    )) errors.push(`${modifierLabel} restricted extra action is invalid`)
    if (modifier.kind === 'darkvision' && !finiteInteger(modifier.rangeFeet, 1, 10_000)) {
      errors.push(`${modifierLabel}.rangeFeet is invalid`)
    }
    if (modifier.kind === 'darkvision' && (
      (modifier.ifAbsent != null && modifier.ifAbsent !== true) ||
      (modifier.existingRangeSource != null && (modifier.existingRangeSource !== 'race' || modifier.ifAbsent !== true)) ||
      (modifier.existingBonusFeet != null && (modifier.ifAbsent !== true || !finiteInteger(modifier.existingBonusFeet, 0, 10_000)))
    )) errors.push(`${modifierLabel} conditional darkvision is invalid`)
    if (modifier.kind === 'language-capability' && (
      (modifier.understandSpoken != null && modifier.understandSpoken !== 'all') ||
      (modifier.understandWritten != null && modifier.understandWritten !== 'literal-written') ||
      (modifier.writtenRequiresTouch != null && modifier.writtenRequiresTouch !== true) ||
      (modifier.writtenMinutesPerPage != null && modifier.writtenMinutesPerPage !== 1) ||
      (modifier.speechUnderstoodBy != null &&
        modifier.speechUnderstoodBy !== 'any-creature-knowing-a-language') ||
      Object.values(modifier).filter((value) => value != null).length <= 1
    )) errors.push(`${modifierLabel} language capability is invalid`)
    if (modifier.kind === 'language-restriction' && (
      modifier.understandLanguages !== false ||
      modifier.intelligibleCommunication !== false
    )) errors.push(`${modifierLabel} language restriction is invalid`)
    if (modifier.kind === 'attack-decoys' && (
      !finiteInteger(modifier.count, 1, 20) ||
      modifier.redirectMinimumD20.length !== modifier.count ||
      modifier.redirectMinimumD20.some((minimum) => !finiteInteger(minimum, 1, 20)) ||
      !finiteInteger(modifier.armorClassBase, 0, 100) ||
      !ABILITIES.has(modifier.armorClassAbility) ||
      modifier.requiresOrdinarySight !== true
    )) errors.push(`${modifierLabel} attack decoys are invalid`)
    if (modifier.kind === 'planar-phase' && (
      (modifier.materialSightRangeFeet != null && (modifier.plane !== 'ethereal' ||
        !Number.isFinite(modifier.materialSightRangeFeet) || modifier.materialSightRangeFeet <= 0 || modifier.materialSightRangeFeet > 10_000)) ||
      !['ethereal', 'terrain'].includes(modifier.plane) ||
      typeof modifier.ignoresMaterialCollision !== 'boolean' ||
      modifier.suppressCrossPlaneEffects !== true ||
      typeof modifier.unrestrictedVerticalMovement !== 'boolean' ||
      (modifier.plane === 'ethereal' && (!modifier.ignoresMaterialCollision || !modifier.unrestrictedVerticalMovement)) ||
      (modifier.plane === 'terrain' && (modifier.ignoresMaterialCollision || modifier.unrestrictedVerticalMovement))
    )) errors.push(`${modifierLabel} planar phase is invalid`)
    if (modifier.kind === 'solid-material-traversal' && !normalizeDnd5eSolidMaterialTraversal({ materials: modifier.materials, endInside: modifier.endInside })) errors.push(`${modifierLabel} solid material traversal is invalid`)
    if (modifier.kind === 'tracking-capability' && (
      modifier.mundaneTracking !== 'impossible' || modifier.leavesTracks !== false
    )) errors.push(`${modifierLabel} tracking capability is invalid`)
    if (modifier.kind === 'environmental-capability' && (
      (modifier.doesNotNeedAir != null && modifier.doesNotNeedAir !== true) ||
      (modifier.holdBreathSeconds != null && !finiteInteger(modifier.holdBreathSeconds, 1, 86_400)) ||
      (modifier.breatheIn != null && (
        modifier.breatheIn.length !== 1 || modifier.breatheIn[0] !== 'water')) ||
      (modifier.treatLiquidSurfacesAsSolidGround != null &&
        modifier.treatLiquidSurfacesAsSolidGround !== true) ||
      (modifier.ignoreDifficultTerrainMaterials != null && !validMapSurfaceMaterials(modifier.ignoreDifficultTerrainMaterials)) ||
      (modifier.ignoreDifficultTerrain != null && modifier.ignoreDifficultTerrain !== true) ||
      (modifier.ignoreUnderwaterMovementPenalty != null && modifier.ignoreUnderwaterMovementPenalty !== true) ||
      (modifier.ignoreUnderwaterAttackPenalty != null && modifier.ignoreUnderwaterAttackPenalty !== true) ||
      (modifier.occupyCreatureSpaces != null && modifier.occupyCreatureSpaces !== true) ||
      (modifier.riseTowardLiquidSurfaceFeetPerRound != null &&
        !finiteInteger(modifier.riseTowardLiquidSurfaceFeetPerRound, 1, 1_000)) ||
      (modifier.minimumPassageGapInches != null &&
        !finiteInteger(modifier.minimumPassageGapInches, 1, 120)) ||
      Object.values(modifier).filter((value) => value != null).length <= 1
    )) errors.push(`${modifierLabel} environmental capability is invalid`)
    if ((modifier.kind === 'climb-speed' || modifier.kind === 'swim-speed') && modifier.mode !== 'walking-speed') {
      errors.push(`${modifierLabel}.mode is invalid`)
    }
    if (modifier.kind === 'sight-range-limit' && !finiteInteger(modifier.rangeFeet, 1, 10_000)) errors.push(`${modifierLabel}.rangeFeet is invalid`)
    if (modifier.kind === 'truesight' && !finiteInteger(modifier.rangeFeet, 1, 10_000)) {
      errors.push(`${modifierLabel}.rangeFeet is invalid`)
    }
    if (modifier.kind === 'spell-targeting-immunity' && (
      modifier.schools.length < 1 || modifier.schools.length > 8 ||
      new Set(modifier.schools).size !== modifier.schools.length ||
      modifier.schools.some((school) => ![
        'abjuration', 'conjuration', 'divination', 'enchantment',
        'evocation', 'illusion', 'necromancy', 'transmutation',
      ].includes(school))
    )) errors.push(`${modifierLabel}.schools is invalid`)
    if (modifier.kind === 'flight-speed-limit' && !finiteInteger(modifier.maximumFeet, 0, 1_000)) errors.push(`${modifierLabel}.maximumFeet is invalid`)
    if (modifier.kind === 'flight-speed' && (
      !finiteInteger(modifier.speedFeet, 1, 10_000) ||
      (modifier.hover != null && modifier.hover !== true)
    )) {
      errors.push(`${modifierLabel} flight speed is invalid`)
    }
    if (modifier.kind === 'safe-fall' && !finiteInteger(modifier.maximumFeet, 1, 10_000)) {
      errors.push(`${modifierLabel}.maximumFeet is invalid`)
    }
    if (modifier.kind === 'controlled-descent' && (
      !finiteInteger(modifier.maximumFeetPerRound, 1, 1_000) ||
      modifier.safeLanding !== true ||
      modifier.endsOnLanding !== true ||
      (modifier.forceWhileFlightBlocked != null && modifier.forceWhileFlightBlocked !== true)
    )) errors.push(`${modifierLabel} controlled descent is invalid`)
    if (modifier.kind === 'automatic-escape' && (
      modifier.conditions.length < 1 || modifier.conditions.length > 2 ||
      new Set(modifier.conditions).size !== modifier.conditions.length ||
      modifier.conditions.some((condition) => condition !== 'grappled' && condition !== 'restrained') ||
      !finiteInteger(modifier.movementCostFeet, 0, 1_000) ||
      (modifier.sourceMagical != null && typeof modifier.sourceMagical !== 'boolean')
    )) errors.push(`${modifierLabel} automatic escape is invalid`)
    if (modifier.kind === 'action-restriction' && (
      modifier.prohibited.length < 1 ||
      new Set(modifier.prohibited).size !== modifier.prohibited.length ||
      modifier.prohibited.some((entry) => ![
        'attack', 'spellcasting', 'object-interaction', 'speech',
      ].includes(entry)) ||
      (modifier.allowedBasicActions != null && (
        modifier.allowedBasicActions.length < 1 ||
        new Set(modifier.allowedBasicActions).size !== modifier.allowedBasicActions.length ||
        modifier.allowedBasicActions.some((entry) => !['dash', 'dismiss-effect'].includes(entry))
      )) ||
      (modifier.allowedActivityIds != null && (
        modifier.allowedActivityIds.length < 1 || modifier.allowedActivityIds.length > 32 ||
        new Set(modifier.allowedActivityIds).size !== modifier.allowedActivityIds.length ||
        modifier.allowedActivityIds.some((entry) =>
          typeof entry !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,255}$/.test(entry))
      ))
    )) errors.push(`${modifierLabel} action restriction is invalid`)
    if (modifier.kind === 'emitted-light' && (
      !finiteInteger(modifier.brightRadiusFeet, 0, 10_000) ||
      !finiteInteger(modifier.dimRadiusFeet, 0, 10_000) ||
      modifier.brightRadiusFeet + modifier.dimRadiusFeet < 1 ||
      typeof modifier.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(modifier.color)
    )) errors.push(`${modifierLabel} emitted light is invalid`)
    if (modifier.kind === 'hit-point-maximum' && modifier.mode !== 'add') {
      errors.push(`${modifierLabel}.mode is invalid`)
    }
    if (modifier.kind === 'hit-point-maximum' && modifier.value?.kind === 'constant' && (
      modifier.value.value < 0 || modifier.value.value > 1_000_000
    )) errors.push(`${modifierLabel}.value must be a nonnegative hit-point maximum bonus; reductions require a reduction ledger`)
    if (modifier.kind === 'spell-save-disadvantage-aura' && (
      !finiteInteger(modifier.radiusFeet, 1, 10_000) ||
      (!modifier.damageTypes?.length && !modifier.spellcastingClassIds?.length) ||
      modifier.damageTypes?.some((damageType) => !DAMAGE_TYPES.has(damageType)) ||
      modifier.spellcastingClassIds?.some((classId) => !validId(classId))
    )) errors.push(`${modifierLabel} spell-save-disadvantage-aura is invalid`)
    if (modifier.kind === 'spell-action-as-bonus-action' && (
      !modifier.spellcastingClassIds.length || modifier.spellcastingClassIds.some((classId) => !validId(classId))
    )) errors.push(`${modifierLabel} spell-action-as-bonus-action is invalid`)
    if (modifier.kind === 'attack-profile' && (
      !modifier.attackModes.length || new Set(modifier.attackModes).size !== modifier.attackModes.length ||
      modifier.attackModes.some((mode) => !['melee', 'ranged', 'unarmed'].includes(mode)) ||
      modifier.weaponIds?.some((weaponId) => !validId(weaponId) || weaponId.length > 200) ||
      (modifier.reachBonusFeet != null && !finiteNumber(modifier.reachBonusFeet, 0, 1_000)) ||
      (modifier.damageTypeOverride != null && !DAMAGE_TYPES.has(modifier.damageTypeOverride)) ||
      (modifier.criticalThreshold != null && !finiteInteger(modifier.criticalThreshold, 2, 20)) ||
      (modifier.reachBonusFeet == null && modifier.criticalThreshold == null && modifier.damageTypeOverride == null)
    )) errors.push(`${modifierLabel} attack-profile is invalid`)
    if (modifier.kind === 'damage-reduction') {
      if (modifier.damageTypes?.some((damageType) => !DAMAGE_TYPES.has(damageType))) errors.push(`${modifierLabel}.damageTypes is invalid`)
      if (modifier.minimumIncomingDamage != null && !finiteInteger(modifier.minimumIncomingDamage, 1, 1_000_000)) errors.push(`${modifierLabel}.minimumIncomingDamage is invalid`)
      if (modifier.maximumCurrentHitPointPercent != null && !finiteInteger(modifier.maximumCurrentHitPointPercent, 1, 100)) errors.push(`${modifierLabel}.maximumCurrentHitPointPercent is invalid`)
      if (modifier.deliveries != null && (
        modifier.deliveries.length < 1 || modifier.deliveries.length > 3 ||
        new Set(modifier.deliveries).size !== modifier.deliveries.length ||
        modifier.deliveries.some((delivery) => !['weapon-attack', 'spell', 'other'].includes(delivery))
      )) errors.push(`${modifierLabel}.deliveries is invalid`)
      if (modifier.magical != null && typeof modifier.magical !== 'boolean') errors.push(`${modifierLabel}.magical is invalid`)
      if (modifier.requiresHeavyArmor != null && typeof modifier.requiresHeavyArmor !== 'boolean') errors.push(`${modifierLabel}.requiresHeavyArmor is invalid`)
    }
    if (modifier.kind === 'on-hit-bonus-damage') {
      if (modifier.bindToSelectedTarget != null && modifier.bindToSelectedTarget !== true) errors.push(`${modifierLabel}.bindToSelectedTarget is invalid`)
      if (modifier.attackDamageTypeOverride != null && (!DAMAGE_TYPES.has(modifier.attackDamageTypeOverride) ||
        modifier.bindToSelectedTarget !== true || modifier.consumeEffectOnHit !== true)) errors.push(`${modifierLabel}.attackDamageTypeOverride requires a single-hit selected-target rider and a damage type`)
      if (modifier.consumeEffectOnHit != null && typeof modifier.consumeEffectOnHit !== 'boolean') errors.push(`${modifierLabel}.consumeEffectOnHit is invalid`)
      if (modifier.damageType !== 'inherit-primary' && !DAMAGE_TYPES.has(modifier.damageType)) errors.push(`${modifierLabel}.damageType is invalid`)
      if (modifier.targetCreatureTypes?.some((type) => !validId(type))) errors.push(`${modifierLabel}.targetCreatureTypes is invalid`)
      if (modifier.onHitTargetEffect != null && (
        (modifier.onHitTargetEffect.revealInvisible != null && modifier.onHitTargetEffect.revealInvisible !== true) ||
        (modifier.onHitTargetEffect.preventInvisibility != null && modifier.onHitTargetEffect.preventInvisibility !== true) ||
        (modifier.onHitTargetEffect.emittedLight != null && (
          !finiteInteger(modifier.onHitTargetEffect.emittedLight.brightRadiusFeet, 0, 10_000) ||
          !finiteInteger(modifier.onHitTargetEffect.emittedLight.dimRadiusFeet, 0, 10_000) ||
          modifier.onHitTargetEffect.emittedLight.brightRadiusFeet + modifier.onHitTargetEffect.emittedLight.dimRadiusFeet < 1 ||
          !/^#[0-9a-f]{6}$/i.test(modifier.onHitTargetEffect.emittedLight.color)
        )) ||
        !Object.values(modifier.onHitTargetEffect).some((value) => value != null)
      )) errors.push(`${modifierLabel}.onHitTargetEffect is invalid`)
      if (modifier.amount?.kind !== 'weapon-dice' && !delayedDamageFormulaSupported(modifier.amount)) {
        errors.push(`${modifierLabel}.amount must be one additive delayed damage pool`)
      }
    }
    if (modifier.kind === 'death-prevention' && !finiteInteger(modifier.hitPointsAfter, 1, 1_000_000)) {
      errors.push(`${modifierLabel}.hitPointsAfter is invalid`)
    }
    if ('resourceId' in modifier && modifier.resourceId != null && !(validId(modifier.resourceId) || isDnd5eLegacyCoreResourceId(modifier.resourceId))) errors.push(`${modifierLabel}.resourceId is invalid`)
    if ('resourceCost' in modifier && modifier.resourceCost != null && !finiteInteger(modifier.resourceCost, 1, 1_000_000)) errors.push(`${modifierLabel}.resourceCost is invalid`)
  }
  effect.triggers?.forEach((trigger, index) => validateTrigger(trigger, `${label}.triggers[${index}]`, errors))
}

/** Validates one reusable Activity predicate contributed by a declarative choice or workshop JSON. */
export function validateDnd5eActivityPredicateV1(predicate: Dnd5ePredicateV1): readonly string[] {
  const errors: string[] = []
  validatePredicate(predicate, 'predicate', errors)
  return errors
}

function validAbilityOptions(options: readonly AbilityKey[], primary: AbilityKey): boolean {
  return Array.isArray(options) && options.length >= 2 && options.length <= ABILITIES.size &&
    options.includes(primary) && options.every((ability) => ABILITIES.has(ability)) &&
    new Set(options).size === options.length
}

function formulaContainsDice(formula: Dnd5eFormulaV1): boolean {
  if (formula.kind === 'dice') return true
  if (formula.kind === 'add' || formula.kind === 'multiply' || formula.kind === 'minimum' || formula.kind === 'maximum') {
    return formula.values.some(formulaContainsDice)
  }
  if (formula.kind === 'damage-roll' || formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round' || formula.kind === 'clamp') {
    return formulaContainsDice(formula.value)
  }
  return false
}

function delayedDamageFormulaSupported(formula: Dnd5eFormulaV1): boolean {
  let sides: number | undefined
  const visit = (node: Dnd5eFormulaV1): boolean => {
    if (node.kind === 'dice') {
      if (sides != null && sides !== node.sides) return false
      sides = node.sides
      return true
    }
    if (node.kind === 'add') return node.values.every(visit)
    return !formulaContainsDice(node)
  }
  return visit(formula)
}

/** Validates a standalone Effect contributed through the unified content API. */
export function validateDnd5eEffectDefinitionV1(effect: Dnd5eEffectDefinitionV1): readonly string[] {
  const errors: string[] = []
  validateEffect(effect, 'effect', errors)
  return errors
}

function validateTarget(target: Dnd5eActivityTargetV1, errors: string[]): void {
  if (target.kind === 'self') return
  if (!['creature', 'area'].includes(target.kind)) {
    errors.push('activity.target.kind is invalid')
    return
  }
  if (!['ally', 'enemy', 'any'].includes(target.relation)) errors.push('activity.target.relation is invalid')
  for (const field of ['minimumAbilityScores', 'maximumAbilityScores'] as const) {
    const bounds = target[field]
    if (bounds != null && (typeof bounds !== 'object' || Array.isArray(bounds) || Object.keys(bounds).length === 0 ||
      Object.entries(bounds).some(([ability, score]) => !['str','dex','con','int','wis','cha'].includes(ability) || !finiteInteger(score, 0, 30)))) {
      errors.push(`activity.target.${field} is invalid`)
    }
  }
  for (const ability of ['str','dex','con','int','wis','cha'] as const) {
    const minimum = target.minimumAbilityScores?.[ability], maximum = target.maximumAbilityScores?.[ability]
    if (minimum != null && maximum != null && minimum > maximum) errors.push(`activity.target ability score bounds for ${ability} are inverted`)
  }
  if (target.excludedCreatureTypes != null && (!Array.isArray(target.excludedCreatureTypes) ||
    target.excludedCreatureTypes.length < 1 || target.excludedCreatureTypes.length > 32 ||
    target.excludedCreatureTypes.some(type => typeof type !== 'string' || !type.trim() || type.length > 80))) {
    errors.push('activity.target.excludedCreatureTypes is invalid')
  }
  if (target.excludedConditionImmunities != null && (!Array.isArray(target.excludedConditionImmunities) ||
    target.excludedConditionImmunities.length < 1 || target.excludedConditionImmunities.length > CONDITIONS.size ||
    target.excludedConditionImmunities.some(condition => !CONDITIONS.has(condition)) ||
    new Set(target.excludedConditionImmunities).size !== target.excludedConditionImmunities.length)) {
    errors.push('activity.target.excludedConditionImmunities is invalid')
  }
  if (target.kind === 'creature') {
    if (target.requiresSeenWithinSeconds != null && !finiteInteger(target.requiresSeenWithinSeconds, 1, 60)) errors.push('activity.target.requiresSeenWithinSeconds is invalid')
    if (target.roomCompanion != null && (!validId(target.roomCompanion.bondKey) ||
      !validId(target.roomCompanion.sourceActivityId) || target.count !== 1 || target.rangeFeet != null ||
      target.minimumRangeFeet != null || target.requiresLineOfSight || target.requiresLineOfEffect)) {
      errors.push('activity.target.roomCompanion is invalid')
    }
    if (target.requiresTargetSeeActor != null && typeof target.requiresTargetSeeActor !== 'boolean') errors.push('activity.target.requiresTargetSeeActor is invalid')
    if (target.requiresWilling != null && typeof target.requiresWilling !== 'boolean') errors.push('activity.target.requiresWilling is invalid')
    if (target.requiredQualifications != null) {
      if (!Array.isArray(target.requiredQualifications) || target.requiredQualifications.length < 1 || target.requiredQualifications.length > 12) {
        errors.push('activity.target.requiredQualifications is invalid')
      } else {
        const qualificationIds = new Set<string>()
        for (const qualification of target.requiredQualifications) {
          if (!qualification || !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(qualification.id ?? '') || qualificationIds.has(qualification.id) ||
            typeof qualification.label !== 'string' || !qualification.label.trim() || qualification.label.length > 500 ||
            !['dm', 'target-controller'].includes(qualification.audience) ||
            (qualification.creatureTypes != null && (!Array.isArray(qualification.creatureTypes) || qualification.creatureTypes.length < 1 ||
              qualification.creatureTypes.length > 32 || qualification.creatureTypes.some((type: string) => !validId(type)))) ||
            (qualification.whenChoice != null && (!validId(qualification.whenChoice.choiceId) ||
              !Array.isArray(qualification.whenChoice.optionIds) || qualification.whenChoice.optionIds.length < 1 || qualification.whenChoice.optionIds.some((id: string) => !validId(id))))) {
            errors.push('activity.target.requiredQualifications entry is invalid')
          }
          qualificationIds.add(qualification?.id)
        }
      }
    }
    if (target.maximumTargetSeparationFeet != null && !finiteNumber(target.maximumTargetSeparationFeet, 0, 10_000)) {
      errors.push('activity.target.maximumTargetSeparationFeet is invalid')
    }
    if(target.effectOrigin && (!validId(target.effectOrigin.effectId)||!finiteNumber(target.effectOrigin.rangeFeet,0,100_000)))errors.push('activity.target.effectOrigin is invalid')
    if (!finiteInteger(target.count, 1, 256)) errors.push('activity.target.count is invalid')
    if (target.minimumCount != null && !finiteInteger(target.minimumCount, 0, target.count)) errors.push('activity.target.minimumCount is invalid')
    if (target.rangeFeet != null && !finiteNumber(target.rangeFeet, 0, 100_000)) errors.push('activity.target.rangeFeet is invalid')
    if (target.requiresInsideGrantingArea != null && target.requiresInsideGrantingArea !== true) errors.push('activity.target.requiresInsideGrantingArea is invalid')
    if (target.mappedObjectOrigin != null && (
      typeof target.mappedObjectOrigin !== 'object' || Array.isArray(target.mappedObjectOrigin) || target.mappedObjectOrigin.naturalFeature !== 'rock' ||
      target.mappedObjectOrigin.withinGrantingArea !== true || target.requiresInsideGrantingArea !== true || target.count !== 1 ||
      Object.keys(target.mappedObjectOrigin).some(key => !['naturalFeature', 'withinGrantingArea'].includes(key))
    )) errors.push('activity.target.mappedObjectOrigin is invalid')
    if (target.attackAdvantageInsideGrantingArea != null &&
      (target.attackAdvantageInsideGrantingArea !== true || target.rangeOrigin !== 'granting-area')) {
      errors.push('activity.target.attackAdvantageInsideGrantingArea requires literal true and granting-area origin')
    }
    if (target.rangeOrigin != null && (!['actor', 'granting-area'].includes(target.rangeOrigin) || target.effectOrigin != null)) {
      errors.push('activity.target.rangeOrigin requires granting-area without an item effect origin')
    }
    if (target.minimumRangeFeet != null && !finiteNumber(target.minimumRangeFeet, 0, 100_000)) {
      errors.push('activity.target.minimumRangeFeet is invalid')
    }
    if (
      target.rangeFeet != null && target.minimumRangeFeet != null &&
      target.minimumRangeFeet > target.rangeFeet
    ) errors.push('activity.target range is inverted')
    return
  }
  if (target.maximumTargets != null && !finiteInteger(target.maximumTargets, 1, 256)) errors.push('activity.target.maximumTargets is invalid')
  if (target.requiresGroundContact != null && target.requiresGroundContact !== true) errors.push('activity.target.requiresGroundContact is invalid')
  if (target.requiresVisibleTargets != null && typeof target.requiresVisibleTargets !== 'boolean') {
    errors.push('activity.target.requiresVisibleTargets is invalid')
  }
  if (!['self', 'point', 'event-target'].includes(target.origin)) errors.push('activity.target.origin is invalid')
  if (target.excludeEventTarget != null && typeof target.excludeEventTarget !== 'boolean') {
    errors.push('activity.target.excludeEventTarget is invalid')
  }
  if (target.origin !== 'event-target' && target.excludeEventTarget != null) {
    errors.push('activity.target.excludeEventTarget requires event-target origin')
  }
  if (target.selection != null && target.selection !== 'choose-any' && (target.selection !== 'choose-one' ||
    target.origin !== 'event-target' || target.maximumTargets !== 1 ||
    !['circle', 'sphere'].includes(target.shape))) {
    errors.push('activity.target.selection requires an event-target circle/sphere with maximumTargets=1')
  }
  if (target.minimumTargets != null && (target.selection !== 'choose-any' ||
    !finiteInteger(target.minimumTargets, 0, target.maximumTargets ?? 256))) {
    errors.push('activity.target.minimumTargets requires choose-any and valid target bounds')
  }
  if (!['circle', 'sphere', 'cone', 'line', 'cube', 'cylinder', 'rect'].includes(target.shape)) {
    errors.push('activity.target.shape is invalid')
  }
  if (target.gridAligned != null && typeof target.gridAligned !== 'boolean') {
    errors.push('activity.target.gridAligned is invalid')
  }
  if (target.gridAligned === true && target.shape !== 'rect' && target.shape !== 'cube') {
    errors.push('activity.target.gridAligned requires a rectangle or cube')
  }
  if (target.rangeOrigin != null && target.rangeOrigin !== 'actor' && target.rangeOrigin !== 'granting-area') {
    errors.push('activity.target.rangeOrigin is invalid')
  }
  if (target.rangeOrigin === 'granting-area' && target.origin !== 'point') errors.push('activity.target.rangeOrigin requires point origin')
  if (target.placementQualification != null && (target.origin !== 'point' ||
    typeof target.placementQualification !== 'object' || Array.isArray(target.placementQualification) ||
    Object.keys(target.placementQualification).some(key => key !== 'prompt') ||
    typeof target.placementQualification.prompt !== 'string' || !target.placementQualification.prompt.trim() ||
    target.placementQualification.prompt.length > 1000)) {
    errors.push('activity.target.placementQualification requires a point origin and a nonempty prompt of at most 1000 characters')
  }
  if (target.placementSurface != null && (!['ground', 'sky'].includes(target.placementSurface) || target.origin !== 'point')) {
    errors.push('activity.target.placementSurface requires ground and point origin')
  }
  if (target.placementSurface === 'sky' && target.requiresLineOfSight !== true) {
    errors.push('activity.target.placementSurface sky requires line of sight')
  }
  if (target.placementSurface != null && (target.shape === 'line' || target.shape === 'cone')) {
    errors.push('activity.target.placementSurface requires a point-centered volume')
  }
  if (target.projectileImpact != null && (target.projectileImpact !== 'first-solid' ||
    target.origin !== 'point' || !['circle', 'sphere'].includes(target.shape) ||
    target.rangeOrigin === 'granting-area' || target.placementSurface != null ||
    (target.instanceCount ?? 1) !== 1)) {
    errors.push('activity.target.projectileImpact requires a single actor-origin point circle or sphere')
  }
  if (target.instanceCount != null && !finiteInteger(target.instanceCount, 1, 64)) {
    errors.push('activity.target.instanceCount is invalid')
  }
  if(target.maximumBottomHeightAboveGroundFeet!==undefined &&
    (target.origin!=='point'||target.shape!=='sphere'||!finiteNumber(target.maximumBottomHeightAboveGroundFeet,0,1000)||
      target.placementSurface!=null||target.projectileImpact!=null||(target.instanceCount??1)!==1)){
    errors.push('activity.target.maximumBottomHeightAboveGroundFeet requires a single point sphere and a valid height')
  }
  if (target.wallThicknessFeet != null && (target.shape !== 'cylinder' ||
    !finiteNumber(target.wallThicknessFeet, 0.001, 100_000) || target.radiusFeet == null ||
    target.wallThicknessFeet >= (target.minimumRadiusFeet ?? target.radiusFeet))) {
    errors.push('activity.target.wallThicknessFeet requires a hollow cylinder with thickness below its minimum radius')
  }
  if (target.minimumInstanceCount != null && (
    !finiteInteger(target.minimumInstanceCount, 1, 64) || target.instanceCount == null ||
    target.minimumInstanceCount > target.instanceCount
  )) errors.push('activity.target.minimumInstanceCount is invalid')
  if (target.spreadsAroundCorners != null && (typeof target.spreadsAroundCorners !== 'boolean' ||
    !['circle','sphere'].includes(target.shape))) {
    errors.push('activity.target.spreadsAroundCorners requires a circular or spherical area and a boolean')
  }
  if (target.propagationCover != null && target.propagationCover !== 'opaque-only') {
    errors.push('activity.target.propagationCover is invalid')
  }
  if (target.instanceAdjacency != null && target.instanceAdjacency !== 'face') {
    errors.push('activity.target.instanceAdjacency is invalid')
  }
  if (target.instanceAdjacency != null && (target.instanceCount ?? 1) < 2) {
    errors.push('activity.target.instanceAdjacency requires repeated instances')
  }
  for (const [field, value] of Object.entries({
    placeRangeFeet: target.placeRangeFeet,
    radiusFeet: target.radiusFeet,
    lengthFeet: target.lengthFeet,
    widthFeet: target.widthFeet,
    heightFeet: target.heightFeet,
    minimumRadiusFeet: target.minimumRadiusFeet,
    minimumLengthFeet: target.minimumLengthFeet,
    minimumWidthFeet: target.minimumWidthFeet,
    minimumHeightFeet: target.minimumHeightFeet,
  })) {
    // A zero-radius circle is a point-placement entity (for example Floating
    // Disk), not an empty/invalid target. Other planar dimensions must remain
    // positive because they describe an actual line or rectangular area.
    // Zero placement range fixes the selection at its declared origin.
    const exactBox = (target.shape === 'rect' || target.shape === 'cube') && target.gridAligned === false
    const minimum = field === 'radiusFeet' || field === 'placeRangeFeet' ? 0 : exactBox ? 0.001 : 1
    if (value != null && !finiteNumber(value, minimum, 100_000)) errors.push(`activity.target.${field} is invalid`)
  }
  for (const [minimumField, maximumField] of [
    ['minimumRadiusFeet', 'radiusFeet'],
    ['minimumLengthFeet', 'lengthFeet'],
    ['minimumWidthFeet', 'widthFeet'],
    ['minimumHeightFeet', 'heightFeet'],
  ] as const) {
    const minimum = target[minimumField]
    const maximum = target[maximumField]
    // Non-grid rectangles retain exact planar dimensions through placement
    // and execution. A circular portal may use a half-cell radius.
    const exactPlanar = (target.shape === 'rect' || target.shape === 'cube') &&
      !(target.gridAligned ?? target.shape === 'cube') &&
      (minimumField === 'minimumLengthFeet' || minimumField === 'minimumWidthFeet' || minimumField === 'minimumHeightFeet')
    const step = minimumField === 'minimumRadiusFeet' && minimum != null && minimum % 5 !== 0 ? 2.5 : 5
    if (minimum != null && (maximum == null || minimum > maximum || (!exactPlanar && (minimum % step !== 0 || maximum % step !== 0)))) {
      errors.push(`activity.target.${minimumField} is invalid`)
    }
  }
  if ((target.shape === 'circle' || target.shape === 'sphere' || target.shape === 'cylinder') && target.radiusFeet == null) {
    errors.push('activity.target.radiusFeet is required')
  }
  if ((target.shape === 'cone' || target.shape === 'line') && target.lengthFeet == null) {
    errors.push('activity.target.lengthFeet is required')
  }
  if ((target.shape === 'line' || target.shape === 'rect') && target.widthFeet == null) {
    errors.push('activity.target.widthFeet is required')
  }
  if ((target.shape === 'cube' || target.shape === 'rect') && target.heightFeet == null) {
    errors.push('activity.target.heightFeet is required')
  }
  if (target.rotatable && !(
    (target.shape === 'rect' && target.origin === 'point') ||
    target.shape === 'line' || target.shape === 'cone'
  )) {
    errors.push('only lines, cones and point-origin rectangles may rotate freely')
  }
  if (target.tiltable != null && (typeof target.tiltable !== 'boolean' || target.tiltable &&
    (target.shape !== 'rect' || target.origin !== 'point' || !target.rotatable || target.gridAligned || !target.lengthFeet || !target.heightFeet))) {
    errors.push('tiltable requires a freely rotated point-origin rectangular volume')
  }
}

function operationPhases(operation: Dnd5eActivityOperationV1): readonly AutomationPhase[] {
  if (operation.kind === 'damage') return ['damage']
  if (operation.kind === 'healing' || operation.kind === 'temporary-hit-points' || operation.kind === 'revive') return ['healing']
  if (operation.kind === 'resource') return ['cost']
  if (operation.kind === 'mechanic') return ['effects']
  if (operation.kind === 'manual-adjudication') return []
  return ['effects']
}

export function dnd5eActivityRequiredPhases(activity: Dnd5eActivityDefinitionV1): readonly AutomationPhase[] {
  const phases = new Set<AutomationPhase>(['eligibility', 'targeting'])
  if (activity.consumption?.length) phases.add('cost')
  for (const check of activity.checks ?? []) {
    if (check.kind === 'attack-roll') phases.add('attack-roll')
    else if (check.kind === 'saving-throw') phases.add('saving-throw')
    else phases.add('eligibility')
  }
  for (const outcome of activity.outcomes) {
    for (const operation of outcome.operations) operationPhases(operation).forEach((phase) => phases.add(phase))
  }
  if (activity.effects?.some((effect) => effect.duration.kind !== 'instantaneous')) phases.add('duration')
  if (activity.invocation?.kind === 'triggered' || activity.triggers?.length || activity.effects?.some((effect) => effect.triggers?.length)) phases.add('interrupt')
  phases.add('persistence')
  return [...phases]
}

function validateOperation(operation: Dnd5eActivityOperationV1, label: string, errors: string[]): void {
  if (operation.kind === 'transfer-loose-earth') {
    if (operation.depthFeet != null && !finiteNumber(operation.depthFeet, 0.1, operation.maximumSideFeet)) errors.push(`${label} excavation depth is invalid`)
    if (!validId(operation.id) || !finiteNumber(operation.maximumSideFeet, 0.1, 5) || !finiteNumber(operation.distanceFeet, 0.1, 5)) errors.push(`${label} loose-earth transfer limits are invalid`)
    return
  }
  if (operation.kind === 'launch-map-object') {
    const limits = operation.limits
    if (!limits || ![limits.minimumWeightPounds, limits.maximumWeightPounds, limits.additionalWeightPoundsPerSlot, limits.distanceFeet].every(value => typeof value === 'number' && Number.isFinite(value)) ||
      limits.minimumWeightPounds < 0 || limits.maximumWeightPounds < limits.minimumWeightPounds || limits.additionalWeightPoundsPerSlot < 0 ||
      limits.distanceFeet <= 0 || limits.distanceFeet > 10000 || !finiteInteger(limits.baseSlotLevel, 0, 9) ||
      (operation.harmlessPush !== true && !validId(operation.savingThrowCheckId)) || operation.damageType !== 'bludgeoning') errors.push(`${label} object launch declaration is invalid`)
    if (operation.harmlessPush != null && (operation.harmlessPush !== true || operation.savingThrowCheckId != null ||
      operation.amount?.kind !== 'constant' || operation.amount.value !== 0)) errors.push(`${label} harmless push requires zero damage and no saving throw`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)

    return
  }
  if (!validId(operation.id)) errors.push(`${label}.id is invalid`)
  if (operation.kind === 'reveal-target-location' || operation.kind === 'read-damage-traits') {
    if (operation.target !== 'target' || Object.keys(operation).some(key => !['id','kind','target'].includes(key))) errors.push(`${label} location disclosure must use the Host target`)
    return
  }
  if (operation.kind === 'detect-planar-portal') {
    if (operation.target !== 'actor' || !finiteNumber(operation.rangeFeet, 1, 10_000) ||
      Object.keys(operation).some(key => !['id', 'kind', 'target', 'rangeFeet'].includes(key)))
      errors.push(`${label} planar portal detection must use a bounded Host survey`)
    return
  }
  if(operation.kind==='reaction-follow'){
    if(operation.target!=='actor'||!validId(operation.pushOperationId)||operation.movementBudget!=='walking-speed'||!finiteNumber(operation.targetRadiusFeet,0,100)||
      Object.keys(operation).some(key=>!['id','kind','target','pushOperationId','movementBudget','targetRadiusFeet'].includes(key)))errors.push(`${label} reaction follow is invalid`)
    return
  }
  if (operation.kind === 'secondary-weapon-damage') {
    if (operation.target !== 'actor' || !validId(operation.damageOperationId) || !finiteNumber(operation.rangeFeet, 0, 1000) ||
      typeof operation.requiresLineOfSight !== 'boolean' || Object.keys(operation).some(key => !['id','kind','target','damageOperationId','rangeFeet','requiresLineOfSight'].includes(key))) errors.push(`${label} secondary weapon damage is invalid`)
    return
  }
  if (operation.kind === 'damage') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    if (operation.damageGroup && (!validId(operation.damageGroup.id) || ![0.5,1].includes(operation.damageGroup.multiplier) || Object.keys(operation.damageGroup).some(key => !['id','multiplier'].includes(key)))) errors.push(`${label}.damageGroup is invalid`)

    if (operation.equipmentWeaponDamage != null) {
      const weapon = operation.equipmentWeaponDamage
      if (!validId(weapon.rollId) || !Array.isArray(weapon.weaponBaseIds) || !weapon.weaponBaseIds.length ||
        weapon.weaponBaseIds.some(id => !validId(id)) || Object.keys(weapon).some(key => !['rollId','weaponBaseIds','multiplier'].includes(key)) ||
        (weapon.multiplier != null && weapon.multiplier !== 1 && weapon.multiplier !== 0.5) || operation.damageType !== 'inherit-primary' ||
        operation.weaponDiceFromTrigger || operation.damageTypeChoiceId || operation.damageTypeFromRoll || operation.critical === 'double-dice')
        errors.push(`${label}.equipmentWeaponDamage requires a Host weapon, full/half multiplier and inherited type without critical doubling`)
    }
    if (operation.weaponDiceFromTrigger != null) {
      const dice = operation.weaponDiceFromTrigger
      if (!validId(dice.rollId) || !Number.isInteger(dice.count) || dice.count < 1 || dice.count > 1000 ||
        Object.keys(dice).some(key => !['rollId', 'count'].includes(key))) errors.push(`${label}.weaponDiceFromTrigger is invalid`)
      if (operation.amount.kind !== 'constant' || operation.amount.value !== 0 || operation.target !== 'target' ||
        operation.damageType !== 'inherit-primary' || operation.damageTypeChoiceId != null || operation.damageTypeFromRoll != null)
        errors.push(`${label}.weaponDiceFromTrigger requires zero amount, event target and inherited damage type`)
    }
    if (operation.damageSource != null && operation.damageSource !== 'grant-source') errors.push(`${label}.damageSource is invalid`)
    if (operation.cannotBeReduced != null && typeof operation.cannotBeReduced !== 'boolean') errors.push(`${label}.cannotBeReduced must be boolean`)
    if (operation.destroysBodyPartOnDeath != null && !isDnd5eLethalBodyPartDestruction(operation.destroysBodyPartOnDeath)) errors.push(`${label}.destroysBodyPartOnDeath is invalid`)
    if (operation.destroysBodyOnDeath != null && typeof operation.destroysBodyOnDeath !== 'boolean') errors.push(`${label}.destroysBodyOnDeath must be boolean`)
    if (operation.damageType !== 'inherit-primary' && !DAMAGE_TYPES.has(operation.damageType)) {
      errors.push(`${label}.damageType is invalid`)
    }
    if (operation.damageTypeChoiceId != null && (!validId(operation.damageTypeChoiceId) || operation.damageTypeFromRoll != null)) {
      errors.push(`${label}.damageTypeChoiceId is invalid or conflicts with damageTypeFromRoll`)
    }
    if (operation.damageTypeFromRoll && (!validId(operation.damageTypeFromRoll.rollId) ||
      !validId(operation.damageTypeFromRoll.indexChoiceId) || !Array.isArray(operation.damageTypeFromRoll.types) ||
      operation.damageTypeFromRoll.types.length < 2 || operation.damageTypeFromRoll.types.length > 100 ||
      operation.damageTypeFromRoll.types.some(type => !DAMAGE_TYPES.has(type)))) errors.push(`${label}.damageTypeFromRoll is invalid`)
    return
  }
  if (operation.kind === 'healing' || operation.kind === 'temporary-hit-points') {
    if (operation.kind === 'healing' && operation.recipientChoice != null) {
      if (!validId(operation.recipientChoice.choiceId) || !finiteNumber(operation.recipientChoice.rangeFeet, 0, 10000) ||
        operation.target !== 'target' || operation.damageResult != null) errors.push(`${label}.recipientChoice is invalid`)
    }
    if (operation.kind === 'temporary-hit-points' && operation.sourceEffectId != null && !validId(operation.sourceEffectId)) errors.push(`${label}.sourceEffectId is invalid`)
    if (operation.kind === 'temporary-hit-points' && operation.replacement != null && operation.replacement !== 'replace') errors.push(`${label}.replacement is invalid`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    if (operation.kind === 'healing' && operation.damageResult != null) {
      const result = operation.damageResult
      if (!validId(result.operationId) || !['actor', 'target'].includes(result.subject) || !finiteNumber(result.multiplier, 0.01, 100)) errors.push(`${label}.damageResult is invalid`)
      if (operation.amount?.kind !== 'constant' || operation.amount.value !== 0) errors.push(`${label}.damageResult requires amount constant zero`)
      if (!['actor', 'target'].includes(operation.target)) errors.push(`${label}.damageResult requires a single recipient`)
    }
    return
  }
  if (operation.kind === 'revive') {
    appendFormulaErrors(errors, operation.hitPoints, `${label}.hitPoints`)
    if (operation.maximumDeathAgeRounds != null &&
      !finiteInteger(operation.maximumDeathAgeRounds, 0, 1_100_000_000)) {
      errors.push(`${label}.maximumDeathAgeRounds is invalid`)
    }
    if (operation.excludesDeathFromOldAge != null && typeof operation.excludesDeathFromOldAge !== 'boolean') {
      errors.push(`${label}.excludesDeathFromOldAge is invalid`)
    }
    if (operation.requiresFreeWillingSoul != null && typeof operation.requiresFreeWillingSoul !== 'boolean') {
      errors.push(`${label}.requiresFreeWillingSoul is invalid`)
    }
    if (operation.excludedCreatureTypes != null && (
      operation.excludedCreatureTypes.length < 1 || operation.excludedCreatureTypes.length > 32 ||
      operation.excludedCreatureTypes.some((type) => !/^[\p{L}\p{N}][\p{L}\p{N} _-]{0,63}$/u.test(type)) ||
      new Set(operation.excludedCreatureTypes.map((type) => type.toLocaleLowerCase())).size !== operation.excludedCreatureTypes.length
    )) errors.push(`${label}.excludedCreatureTypes is invalid`)
    if (operation.requiresBody != null && typeof operation.requiresBody !== 'boolean') {
      errors.push(`${label}.requiresBody is invalid`)
    }
    if (operation.restoreBody != null && !['missing-parts', 'complete'].includes(operation.restoreBody)) {
      errors.push(`${label}.restoreBody is invalid`)
    }
    if (operation.removeConditions != null && (
      operation.removeConditions.length < 1 ||
      operation.removeConditions.some((condition) => !CONDITIONS.has(condition)) ||
      new Set(operation.removeConditions).size !== operation.removeConditions.length
    )) errors.push(`${label}.removeConditions is invalid`)
    if (operation.removeDiseases != null && !['nonmagical', 'all'].includes(operation.removeDiseases)) {
      errors.push(`${label}.removeDiseases is invalid`)
    }
    if (operation.removeCurses != null && operation.removeCurses !== 'all') {
      errors.push(`${label}.removeCurses is invalid`)
    }
    if (operation.createsNewBodyIfMissing != null && typeof operation.createsNewBodyIfMissing !== 'boolean') {
      errors.push(`${label}.createsNewBodyIfMissing is invalid`)
    }
    if (operation.requiresSpokenNameIfBodyMissing != null && typeof operation.requiresSpokenNameIfBodyMissing !== 'boolean') {
      errors.push(`${label}.requiresSpokenNameIfBodyMissing is invalid`)
    }
    if (operation.newBodyPlacementRangeFeet != null &&
      !finiteInteger(operation.newBodyPlacementRangeFeet, 1, 1_000)) {
      errors.push(`${label}.newBodyPlacementRangeFeet is invalid`)
    }
    if (operation.longRestPenalty != null && (
      !finiteInteger(operation.longRestPenalty.initial, 1, 20) ||
      !finiteInteger(operation.longRestPenalty.recoveryPerLongRest, 1, operation.longRestPenalty.initial)
    )) errors.push(`${label}.longRestPenalty is invalid`)
    if (operation.casterLongRestStrainAfterDeathAgeRounds != null &&
      !finiteInteger(operation.casterLongRestStrainAfterDeathAgeRounds, 0, 1_100_000_000)) {
      errors.push(`${label}.casterLongRestStrainAfterDeathAgeRounds is invalid`)
    }
    return
  }
  if (operation.kind === 'stabilize') return
  if (operation.kind === 'recognize-granting-disguise') {
    if (operation.target !== 'target' || Object.keys(operation).some(key => !['id', 'kind', 'target'].includes(key))) errors.push(`${label} disguise recognition is invalid`)
    return
  }
  if (operation.kind === 'restore-original-alignment') {
    if (Object.keys(operation).some(key => !['id', 'kind', 'target'].includes(key)))
      errors.push(`${label} restoration reads Host history; authored alignment values are forbidden`)
    return
  }
  if (operation.kind === 'stand-up') {
    if (operation.usesTargetReactionIfAvailable !== true) errors.push(`${label}.usesTargetReactionIfAvailable is invalid`)
    return
  }
  if (operation.kind === 'apply-standard-condition') {
    if (!CONDITIONS.has(operation.condition)) errors.push(`${label}.condition is invalid`)
    validateDuration(operation.duration, `${label}.duration`, errors)
    return
  }
  if (operation.kind === 'enchant-map-weapon') {
    if (!validId(operation.effectId) || Object.keys(operation).some(key => !['id','kind','effectId'].includes(key))) errors.push(`${label} ground weapon effect is invalid`)
    return
  }
  if (operation.kind === 'apply-effect') {
    if (operation.captureTargetIdentity != null && (operation.captureTargetIdentity !== true || operation.target !== 'actor')) errors.push(`${label}.captureTargetIdentity requires an actor effect`)
    if (operation.disguiseFromGrant != null && (operation.disguiseFromGrant !== true || operation.target !== 'actor' || operation.captureTargetIdentity)) errors.push(`${label}.disguiseFromGrant requires an independent actor effect`)
    if (operation.frightenedSourceChoiceId != null && !validId(operation.frightenedSourceChoiceId)) errors.push(`${label}.frightenedSourceChoiceId is invalid`)
    if (operation.charmedSourceChoiceId != null && !validId(operation.charmedSourceChoiceId)) errors.push(`${label}.charmedSourceChoiceId is invalid`)
    if (operation.conditionSourceMaximumDistanceFeet != null && (
      !Number.isFinite(operation.conditionSourceMaximumDistanceFeet) || operation.conditionSourceMaximumDistanceFeet < 0 ||
      (!operation.charmedSourceChoiceId && !operation.frightenedSourceChoiceId)
    )) errors.push(`${label}.conditionSourceMaximumDistanceFeet requires a nonnegative finite range and condition source choice`)
    if (operation.charmedSourceChoiceId != null && operation.frightenedSourceChoiceId != null) errors.push(`${label} cannot bind two condition sources`)
    if (!validId(operation.effectId)) errors.push(`${label}.effectId is invalid`)
    if (operation.timing != null && operation.timing !== 'after-triggering-damage') errors.push(`${label}.timing is invalid`)
    return
  }
  if (operation.kind === 'remove-standard-condition') {
    if (!CONDITIONS.has(operation.condition)) errors.push(`${label}.condition is invalid`)
    if (operation.sourceCreatureTypes != null && (
      operation.sourceCreatureTypes.length < 1 || operation.sourceCreatureTypes.length > 32 ||
      new Set(operation.sourceCreatureTypes).size !== operation.sourceCreatureTypes.length ||
      operation.sourceCreatureTypes.some((type) => !validId(type) || type.length > 80)
    )) errors.push(`${label}.sourceCreatureTypes is invalid`)
    return
  }
  if (operation.kind === 'resource') {
    if (!(validId(operation.resourceId) || isDnd5eLegacyCoreResourceId(operation.resourceId))) errors.push(`${label}.resourceId is invalid`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    return
  }
  if (operation.kind === 'move') {
    if (operation.optionalCompanion != null) {
      const companion = operation.optionalCompanion
      if (!companion || typeof companion !== 'object' || Object.keys(companion).some(key => !['maximumDepartureDistanceFeet','maximumArrivalDistanceFeet','maximumSize','requiresWithinCarryingCapacity'].includes(key)) ||
        operation.mode !== 'teleport' || operation.target !== 'actor' || companion.maximumSize !== 'actor' || companion.requiresWithinCarryingCapacity !== true ||
        !finiteNumber(companion.maximumDepartureDistanceFeet, 0, 100) || !finiteNumber(companion.maximumArrivalDistanceFeet, 0, 100)) errors.push(`${label}.optionalCompanion is invalid`)
    }
    if (operation.requiresWithinCarryingCapacity != null && (operation.requiresWithinCarryingCapacity !== true || operation.mode !== 'teleport')) errors.push(`${label}.requiresWithinCarryingCapacity requires teleport`)
    if (operation.harmful !== undefined && operation.harmful !== true) errors.push(`${label}.harmful must be true when provided`)
    if (operation.cardinalDirection !== undefined && (
      !['north', 'east', 'south', 'west'].includes(operation.cardinalDirection) ||
      operation.mode !== 'forced' || operation.placement != null ||
      operation.usesActorMovement === true || operation.usesTargetReactionIfAvailable === true ||
      operation.provokesOpportunityAttacks === true
    )) errors.push(`${label}.cardinalDirection requires forced movement without placement, movement/reaction costs or opportunity attacks`)
    if (operation.requiresDifferentDestination !== undefined && (operation.requiresDifferentDestination !== true || !['teleport', 'forced', 'voluntary'].includes(operation.mode))) errors.push(`${label}.requiresDifferentDestination requires positional movement and true`)
    if (operation.destinationPolicy !== undefined && (operation.destinationPolicy !== 'adjacent-space' || !['forced', 'voluntary'].includes(operation.mode) || operation.requiresDifferentDestination !== true || operation.cardinalDirection != null || operation.placement != null)) errors.push(`${label}.destinationPolicy requires adjacent-space, forced/voluntary movement and a different destination without automatic placement`)
    if (operation.directionOrigin !== undefined && (
      !['actor', 'area-center'].includes(operation.directionOrigin) || !['push', 'pull'].includes(operation.mode)
    )) errors.push(`${label}.directionOrigin requires push/pull and actor or area-center`)
    if (!['push', 'pull', 'forced', 'voluntary', 'teleport', 'swap', 'ascend', 'descend'].includes(operation.mode)) errors.push(`${label}.mode is invalid`)
    if (operation.placement != null && operation.placement !== 'host-automatic-maximum') {
      errors.push(`${label}.placement is invalid`)
    }
    if (operation.continuationTargetRadiusFeet != null && (operation.mode !== 'teleport' || operation.target !== 'actor' || !finiteNumber(operation.continuationTargetRadiusFeet, 0, 100))) errors.push(`${label}.continuationTargetRadiusFeet is invalid`)
    if (operation.maximumDistanceFromActorFeet != null && (!Number.isFinite(operation.maximumDistanceFromActorFeet) || operation.maximumDistanceFromActorFeet < 0)) errors.push(`${label}.maximumDistanceFromActorFeet is invalid`)
    if (operation.placement === 'host-automatic-maximum' && !['push', 'pull'].includes(operation.mode)) {
      errors.push(`${label}.placement requires push or pull`)
    }
    if (operation.verticalDestination != null && !['area-top', 'ground'].includes(operation.verticalDestination)) {
      errors.push(`${label}.verticalDestination is invalid`)
    }
    if (operation.stopAtMappedObstacle != null && (operation.stopAtMappedObstacle !== true || operation.mode !== 'ascend')) {
      errors.push(`${label}.stopAtMappedObstacle requires ascend`)
    }
    if (operation.verticalDestination === 'area-top' && operation.mode !== 'ascend') {
      errors.push(`${label}.verticalDestination area-top requires ascend`)
    }
    if (operation.verticalDestination === 'ground' && !['descend', 'teleport'].includes(operation.mode)) {
      errors.push(`${label}.verticalDestination ground requires descend or teleport`)
    }
    if (operation.verticalDestination != null && operation.target === 'actor' && operation.usesActorMovement === true) {
      errors.push(`${label}.verticalDestination cannot spend actor movement`)
    }
    if (
      (operation.mode === 'ascend' || operation.mode === 'descend') &&
      (operation.originIllumination != null || operation.destinationIllumination != null ||
        operation.requiresLineOfSight != null || operation.usesTargetReactionIfAvailable != null ||
        operation.provokesOpportunityAttacks === true)
    ) errors.push(`${label} vertical movement has incompatible path fields`)
    appendFormulaErrors(errors, operation.distanceFeet, `${label}.distanceFeet`)
    for (const field of ['originIllumination', 'destinationIllumination'] as const) {
      const values = operation[field]
      if (values != null && (
        values.length < 1 || new Set(values).size !== values.length ||
        values.some((value) => !['dim', 'darkness', 'magical-darkness'].includes(value))
      )) errors.push(`${label}.${field} is invalid`)
    }
    if (operation.requiresLineOfSight != null && typeof operation.requiresLineOfSight !== 'boolean') errors.push(`${label}.requiresLineOfSight is invalid`)
    if (operation.requiresVisibleDestination != null && (typeof operation.requiresVisibleDestination !== 'boolean' || operation.mode !== 'teleport')) errors.push(`${label}.requiresVisibleDestination requires teleport and a boolean`)
    if (operation.ignoresOpportunityAttacks != null && typeof operation.ignoresOpportunityAttacks !== 'boolean') errors.push(`${label}.ignoresOpportunityAttacks is invalid`)
    if (operation.usesActorMovement != null && typeof operation.usesActorMovement !== 'boolean') {
      errors.push(`${label}.usesActorMovement is invalid`)
    }
    // Vertical self-movement may select the actor through a creature target
    // (for example levitate). The resolved target must still be the actor at
    // settlement, before its movement budget can be spent.
    if (operation.usesActorMovement === true && !(
      (['ascend', 'descend'].includes(operation.mode) && ['actor', 'target'].includes(operation.target)) ||
      (operation.mode === 'voluntary' && operation.target === 'actor')
    )) {
      errors.push(`${label}.usesActorMovement requires actor vertical or voluntary movement`)
    }
    if (operation.usesTargetReactionIfAvailable != null && typeof operation.usesTargetReactionIfAvailable !== 'boolean') {
      errors.push(`${label}.usesTargetReactionIfAvailable is invalid`)
    }
    if (operation.provokesOpportunityAttacks != null && typeof operation.provokesOpportunityAttacks !== 'boolean') {
      errors.push(`${label}.provokesOpportunityAttacks is invalid`)
    }
    if (operation.provokesOpportunityAttacks === true && operation.ignoresOpportunityAttacks === true) {
      errors.push(`${label} cannot provoke and ignore opportunity attacks`)
    }
    return
  }
  if (operation.kind === 'set-directional-command') {
    if (operation.target !== 'actor' || !validId(operation.commandKey)) {
      errors.push(`${label} directional command is invalid`)
    }
    return
  }
  if (operation.kind === 'grant-extra-turns') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    appendFormulaErrors(errors, operation.turns, `${label}.turns`)
    if (operation.freezeOtherCreatures !== true) errors.push(`${label}.freezeOtherCreatures must be true`)
    if (operation.endOnAffectOther != null && typeof operation.endOnAffectOther !== 'boolean') {
      errors.push(`${label}.endOnAffectOther is invalid`)
    }
    if (operation.maximumDistanceFromOriginFeet != null) {
      appendFormulaErrors(
        errors,
        operation.maximumDistanceFromOriginFeet,
        `${label}.maximumDistanceFromOriginFeet`,
      )
    }
    return
  }
  if (operation.kind === 'shrink-granting-area') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    appendFormulaErrors(errors, operation.lengthFeet, `${label}.lengthFeet`)
    return
  }
  if (operation.kind === 'reshape-granting-area') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (operation.maximumFeet) appendFormulaErrors(errors, operation.maximumFeet, `${label}.maximumFeet`)
    return
  }
  if (operation.kind === 'change-granting-area-mode') {
    if (operation.direction != null && (operation.direction !== 'area-orientation' || operation.change !== 'select')) errors.push(`${label}.direction requires select and area-orientation`)
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (!['select', 'pause', 'resume'].includes(operation.change)) errors.push(`${label}.change is invalid`)
    if (operation.change === 'select') {
      if ((operation.modeId == null) === (operation.modeChoiceId == null) ||
        (operation.modeId != null && !validId(operation.modeId)) ||
        (operation.modeChoiceId != null && !validId(operation.modeChoiceId))) errors.push(`${label} requires exactly one modeId or modeChoiceId`)
    } else if (operation.modeId != null || operation.modeChoiceId != null) errors.push(`${label} pause/resume cannot select a mode`)
    return
  }
  if (operation.kind === 'set-granting-area-senses') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (!['source', 'projection', 'projection-sight', 'projection-hearing'].includes(operation.mode)) errors.push(`${label}.mode is invalid`)
    return
  }
  if (operation.kind === 'detonate-granting-area' || operation.kind === 'dismiss-granting-area') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    return
  }
  if (operation.kind === 'alter-inventory-item') {
    if (operation.includeGroundItems != null && (operation.includeGroundItems !== true || operation.selectionRangeFeet == null || operation.permanent === true))
      errors.push(`${label}.includeGroundItems requires a reversible nearby selection`)
    if (operation.selectionRangeFeet != null && (!finiteInteger(operation.selectionRangeFeet, 0, 1000) || operation.target !== 'actor'))
      errors.push(`${label}.selectionRangeFeet requires actor target and a range from 0 to 1000`)
    if (operation.target !== 'actor' && operation.target !== 'target') errors.push(`${label}.target must be actor or target`)
    if (!validId(operation.templateId)) errors.push(`${label} requires templateId`)
    if (operation.permanent != null && operation.permanent !== true) errors.push(`${label}.permanent must be true when declared`)
    if (operation.permanent === true) {
      if (operation.sourceEffectId != null || operation.captureSpellcastingModifier != null)
        errors.push(`${label} permanent conversion cannot bind a source effect or modifier`)
    } else if (!validId(operation.sourceEffectId)) errors.push(`${label} requires sourceEffectId for a reversible alteration`)
    if (!Array.isArray(operation.originalTemplateIds) || !operation.originalTemplateIds.length || operation.originalTemplateIds.length > 100 ||
        operation.originalTemplateIds.some(id => !validId(id)) || new Set(operation.originalTemplateIds).size !== operation.originalTemplateIds.length)
      errors.push(`${label}.originalTemplateIds must be a nonempty unique template allow-list`)
    if (operation.captureSpellcastingModifier != null && typeof operation.captureSpellcastingModifier !== 'boolean') errors.push(`${label}.captureSpellcastingModifier is invalid`)
    appendFormulaErrors(errors, operation.quantity, `${label}.quantity`)
    return
  }
  if (operation.kind === 'exchange-inventory-items') {
    if (operation.templateSource != null &&
      (!['registered-items', 'registered-ammunition'].includes(operation.templateSource) || operation.templateOptions != null)) {
      errors.push(`${label}.templateSource is invalid or conflicts with templateOptions`)
    }
    if (operation.templateOptions != null && (!Array.isArray(operation.templateOptions) ||
      !operation.templateOptions.length || operation.templateOptions.length > 1000 ||
      operation.templateOptions.some(id => !validId(id)) || new Set(operation.templateOptions).size !== operation.templateOptions.length ||
      !operation.templateOptions.includes(operation.templateId))) errors.push(`${label}.templateOptions is invalid`)
    if (operation.sceneRangeFeet != null && !finiteInteger(operation.sceneRangeFeet, 0, 100000)) errors.push(`${label}.sceneRangeFeet is invalid`)
    if (operation.target !== 'actor' || !validId(operation.templateId)) errors.push(`${label} exchange target/template is invalid`)
    appendFormulaErrors(errors, operation.quantity, `${label}.quantity`)
    const policy = operation.policy
    if (!policy || typeof policy !== 'object' ||
      Object.keys(policy).some(key => !['inputTags', 'outputTags', 'maximumValueCp', 'maximumInclusive', 'requiresOriginal'].includes(key)) ||
      !Array.isArray(policy.inputTags) || !policy.inputTags.length || policy.inputTags.length > 32 || policy.inputTags.some(tag => !validId(tag)) ||
      !Array.isArray(policy.outputTags) || !policy.outputTags.length || policy.outputTags.length > 32 || policy.outputTags.some(tag => !validId(tag)) ||
      !finiteInteger(policy.maximumValueCp, 1, 100_000_000) ||
      typeof policy.maximumInclusive !== 'boolean' || typeof policy.requiresOriginal !== 'boolean') errors.push(`${label}.policy is invalid`)
    return
  }
  if (operation.kind === 'grant-inventory-item') {
    if (operation.equipToFreeHand != null && operation.equipToFreeHand !== true) errors.push(`${label}.equipToFreeHand is invalid`)
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (!validId(operation.templateId)) errors.push(`${label}.templateId is invalid`)
    if (operation.templateVariants != null && (!Array.isArray(operation.templateVariants) || operation.templateVariants.length > 9 || operation.templateVariants.some(variant => !finiteInteger(variant.minimumCastLevel,1,9) || !validId(variant.templateId)) || new Set(operation.templateVariants.map(variant=>variant.minimumCastLevel)).size !== operation.templateVariants.length)) errors.push(`${label}.templateVariants is invalid`)
    if (operation.captureSpellcastingModifier != null && typeof operation.captureSpellcastingModifier !== 'boolean') errors.push(`${label}.captureSpellcastingModifier is invalid`)
    if (operation.reuseSourceEffect != null && (typeof operation.reuseSourceEffect !== 'boolean' || !operation.sourceEffectId)) errors.push(`${label}.reuseSourceEffect requires a source`)
    if (operation.maximumPerSource != null && (!finiteInteger(operation.maximumPerSource,1,100) || !operation.sourceEffectId)) errors.push(`${label}.maximumPerSource is invalid`)
    if (operation.sourceEffectId != null && !validId(operation.sourceEffectId)) errors.push(`${label}.sourceEffectId is invalid`)
    appendFormulaErrors(errors, operation.quantity, `${label}.quantity`)
    if (operation.identified != null && typeof operation.identified !== 'boolean') {
      errors.push(`${label}.identified is invalid`)
    }
    if (operation.expiresAfterMinutes != null &&
      !finiteInteger(operation.expiresAfterMinutes, 1, 5_256_000)) {
      errors.push(`${label}.expiresAfterMinutes is invalid`)
    }
    return
  }
  if (operation.kind === 'establish-spell-authority') {
    if (operation.benefitRenewal != null && (operation.recordKind !== 'benefit-history' || !validDnd5eBenefitRenewalPolicy(operation.benefitRenewal))) {
      errors.push(`${label}.benefitRenewal is invalid`)
    }
    if ('benefitRecipients' in operation) errors.push(`${label}.benefitRecipients is Host-owned`)
    if (operation.benefitScope != null && (operation.recordKind !== 'benefit-history' || !['package', 'ruleset'].includes(operation.benefitScope))) errors.push(`${label}.benefitScope is invalid`)
    if (!['actor', 'target', 'all-targets'].includes(operation.target)) errors.push(`${label}.target is invalid`)
    if (!['clone-receptacle', 'linked-planar-object', 'soul-vessel', 'terrain-merge', 'simulacrum-companion', 'benefit-history'].includes(operation.recordKind)) {
      errors.push(`${label}.recordKind is invalid`)
    }
    if (operation.recordKind === 'benefit-history' ? !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(operation.benefitKey ?? '') : operation.benefitKey != null) {
      errors.push(`${label}.benefitKey is invalid`)
    }
    if (operation.recordKind === 'clone-receptacle' && !finiteInteger(operation.maturesAfterMinutes, 1, 10_512_000)) {
      errors.push(`${label}.maturesAfterMinutes is invalid`)
    }
    if (operation.recordKind !== 'clone-receptacle' && operation.maturesAfterMinutes != null) {
      errors.push(`${label}.maturesAfterMinutes is only valid for clone-receptacle`)
    }
    if (operation.recordKind === 'linked-planar-object' && !['instant-summons', 'secret-chest'].includes(operation.linkedObjectProfile ?? '')) {
      errors.push(`${label}.linkedObjectProfile is invalid`)
    }
    if (operation.recordKind !== 'linked-planar-object' && operation.linkedObjectProfile != null) {
      errors.push(`${label}.linkedObjectProfile is only valid for linked-planar-object`)
    }
    if (operation.requiresSelectedInventoryItem != null && operation.requiresSelectedInventoryItem !== true) {
      errors.push(`${label}.requiresSelectedInventoryItem is invalid`)
    }
    if (operation.recordKind === 'linked-planar-object' && operation.requiresSelectedInventoryItem !== true) {
      errors.push(`${label}.requiresSelectedInventoryItem is required for linked-planar-object`)
    }
    if (operation.recordKind !== 'linked-planar-object' && operation.requiresSelectedInventoryItem != null) {
      errors.push(`${label}.requiresSelectedInventoryItem is only valid for linked-planar-object`)
    }
    return
  }
  if (operation.kind === 'transition-spell-authority') {
    if (!['actor', 'target', 'all-targets'].includes(operation.target)) errors.push(`${label}.target is invalid`)
    const transitions = {
      'linked-planar-object': ['recall-to-source', 'send-to-ethereal'],
      'soul-vessel': ['possess-target', 'return-to-vessel', 'return-to-body'],
      'terrain-merge': ['exit-merged-terrain'],
    } as const
    if (!transitions[operation.recordKind]?.includes(operation.transition as never)) {
      errors.push(`${label}.transition is invalid for ${operation.recordKind}`)
    }
    if (operation.recordKind === 'linked-planar-object' && !['instant-summons', 'secret-chest'].includes(operation.linkedObjectProfile ?? '')) {
      errors.push(`${label}.linkedObjectProfile is invalid`)
    }
    if (operation.recordKind !== 'linked-planar-object' && operation.linkedObjectProfile != null) {
      errors.push(`${label}.linkedObjectProfile is only valid for linked-planar-object`)
    }
    return
  }
  if (operation.kind === 'identify-inventory-item') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    return
  }
  if (operation.kind === 'purify-inventory-item') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    return
  }
  if (operation.kind === 'break-inventory-item-attunement') {
    if (!['actor', 'target', 'all-targets'].includes(operation.target)) {
      errors.push(`${label}.target is invalid`)
    }
    if (operation.requireCursedMagicItem !== true) {
      errors.push(`${label}.requireCursedMagicItem must be true`)
    }
    return
  }
  if (operation.kind === 'emit-sound') {
    if (
      operation.target !== 'actor' || !operation.label.trim() || operation.label.length > 120 ||
      !finiteInteger(operation.audibleRadiusFeet, 1, 10_000)
    ) errors.push(`${label} emit-sound declaration is invalid`)
    return
  }
  if (operation.kind === 'open-communication') {
    if (
      operation.target !== 'target' ||
      !['magical-whisper','telepathy'].includes(operation.medium) ||
      typeof operation.requiresTargetLanguage !== 'boolean' ||
      typeof operation.allowsImmediateReply !== 'boolean'
    ) errors.push(`${label} communication declaration is invalid`)
    return
  }
  if (operation.kind === 'modify-map-object-lock') {
    if (
      !['arcane-lock', 'knock'].includes(operation.mode) ||
      operation.targetKinds.length < 1 || operation.targetKinds.length > 2 ||
      operation.targetKinds.some((kind) => !['door', 'obstacle'].includes(kind)) ||
      new Set(operation.targetKinds).size !== operation.targetKinds.length ||
      (operation.mode === 'knock' && !finiteInteger(operation.suppressionMinutes, 1, 1_440)) ||
      (operation.mode === 'arcane-lock' && operation.suppressionMinutes != null) ||
      (operation.accessPolicy != null && (
        operation.mode !== 'arcane-lock' || operation.accessPolicy !== 'selected-creatures-and-password'
      ))
    ) errors.push(`${label} map-object lock declaration is invalid`)
    return
  }
  if (operation.kind === 'extinguish-area-flames') {
    if (!finiteNumber(operation.groundSpreadFeet, 0, 1000) || Object.keys(operation).some(key=>!['id','kind','groundSpreadFeet'].includes(key))) errors.push(`${label} groundSpreadFeet is invalid`)
    return
  }
  if (operation.kind === 'ignite-area-fuel') {
    if (Object.keys(operation).some(key => !['id','kind'].includes(key))) errors.push(`${label} fuel ignition declaration is invalid`)
    return
  }
  if (operation.kind === 'control-map-water') {
    const rules=operation.rules
    if(rules!=null&&(typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).some(key=>!['rangeFeet','rangeFromBody','durationMinutes','maximumActiveEffects','limitGroup'].includes(key))||
      (rules.rangeFromBody!=null&&rules.rangeFromBody!==true)||!finiteNumber(rules.rangeFeet,0,10000)||!finiteInteger(rules.durationMinutes,1,1440)||
      (rules.maximumActiveEffects!==null&&!finiteInteger(rules.maximumActiveEffects,1,256))||!validId(rules.limitGroup))) errors.push(`${label} water rules are invalid`)
    const change=operation.change
    const keys=change?.kind==='appearance'?['kind','color','opacity']:change?.kind==='shape'?['kind','description','drawing']:change?.kind==='move'?['kind','displacementFeet']:['kind']
    keys.push('promptForChange')
    if (!change || typeof change!=='object' || Array.isArray(change) ||
      !['appearance','shape','freeze','dismiss','move'].includes(change.kind) ||
      (change.promptForChange != null && (typeof change.promptForChange!=='boolean' || !['move','appearance','shape'].includes(change.kind))) ||
      Object.keys(operation).some(key=>!['id','kind','change','rules'].includes(key)) || Object.keys(change).some(key=>!keys.includes(key)) ||
      (change.kind==='appearance'&&(typeof change.color!=='string'||!/^#[0-9a-f]{6}$/i.test(change.color)||typeof change.opacity!=='number'||!Number.isFinite(change.opacity)||change.opacity<0||change.opacity>1)) ||
      (change.kind==='shape'&&(typeof change.description!=='string'||!change.description.trim()||change.description.length>500||(change.drawing!=null&&!normalizeSurfaceDrawing(change.drawing)))) ||
      (change.kind==='move'&&(!change.displacementFeet||typeof change.displacementFeet!=='object'||Array.isArray(change.displacementFeet)||
        Object.keys(change.displacementFeet).some(key=>!['x','y','z'].includes(key))||
        ![change.displacementFeet.x,change.displacementFeet.y,change.displacementFeet.z].every(value=>typeof value==='number'&&Number.isFinite(value))||
        Math.hypot(change.displacementFeet.x,change.displacementFeet.y,change.displacementFeet.z)>5+1e-7||
        Math.hypot(change.displacementFeet.x,change.displacementFeet.y,change.displacementFeet.z)<=0))) {
      errors.push(`${label} water operation is invalid`)
    }
    return
  }
  if (operation.kind === 'control-map-flame') {
    const change = operation.change
    const allowed = change?.kind === 'illumination' ? ['kind','multiplier','color','promptForAppearance'] : change?.kind === 'shape' ? ['kind','description','promptForAppearance'] : ['kind']
    if (!change || typeof change !== 'object' || Array.isArray(change) ||
      !['ignite-touch','inspect','extinguish','spread','illumination','shape','dismiss'].includes(change.kind) ||
      Object.keys(change).some(key => !allowed.includes(key)) ||
      Object.keys(operation).some(key => !['id','kind','change','requireAreaOrigin'].includes(key)) ||
      (operation.requireAreaOrigin != null && (typeof operation.requireAreaOrigin !== 'boolean' || change.kind === 'dismiss')) ||
      ('promptForAppearance' in change && change.promptForAppearance != null && typeof change.promptForAppearance !== 'boolean') ||
      (change.kind === 'illumination' && (![0.5,1,2].includes(change.multiplier) ||
        (change.color != null && (typeof change.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(change.color))))) ||
      (change.kind === 'shape' && (typeof change.description !== 'string' || !change.description.trim() || change.description.length > 500))) {
      errors.push(`${label} flame operation is invalid`)
    }
    return
  }
  if (operation.kind === 'enchant-map-object-light') {
    if (
      !finiteInteger(operation.brightRadiusFeet, 0, 10_000) ||
      !finiteInteger(operation.dimRadiusFeet, 0, 10_000) ||
      operation.brightRadiusFeet + operation.dimRadiusFeet < 1 ||
      !/^#[0-9a-f]{6}$/i.test(operation.color) ||
      (operation.durationMinutes != null && !finiteInteger(operation.durationMinutes, 1, 5_256_000))
    ) errors.push(`${label} map-object light declaration is invalid`)
    return
  }
  if (operation.kind === 'affect-persistent-entity') {
    if (Object.keys(operation).some(key => !['id', 'kind', 'amount', 'damageType', 'savingThrow', 'conditions'].includes(key))) errors.push(`${label} has unsupported fields`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    if (!DAMAGE_TYPES.has(operation.damageType)) errors.push(`${label}.damageType is invalid`)
    if (operation.savingThrow) {
      if (Object.keys(operation.savingThrow).some(key => key !== 'ability' && key !== 'dc')) errors.push(`${label}.savingThrow has unsupported fields`)
      if (!['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(operation.savingThrow.ability)) errors.push(`${label}.savingThrow.ability is invalid`)
      appendFormulaErrors(errors, operation.savingThrow.dc, `${label}.savingThrow.dc`)
    }
    if (operation.conditions != null && (!Array.isArray(operation.conditions) || operation.conditions.length > 64 ||
      operation.conditions.some(condition => !validId(condition)))) errors.push(`${label}.conditions is invalid`)
    return
  }
  if (operation.kind === 'wither-map-vegetation') {
    if (Object.keys(operation).some(key => key !== 'id' && key !== 'kind')) errors.push(`${label} vegetation operation has unsupported fields`)
    return
  }
  if (operation.kind === 'convert-map-inventory-item') {
    if (!Array.isArray(operation.originalTemplateIds) || operation.originalTemplateIds.length < 1 || operation.originalTemplateIds.length > 64 ||
      operation.originalTemplateIds.some(id => !validId(id)) || new Set(operation.originalTemplateIds).size !== operation.originalTemplateIds.length ||
      !validId(operation.templateId) || !finiteInteger(operation.quantity, 1, 1000) ||
      Object.keys(operation).some(key => !['id','kind','originalTemplateIds','templateId','quantity'].includes(key))) errors.push(`${label} map inventory conversion is invalid`)
    return
  }
  if (operation.kind === 'protect-map-remains') {
    if (!finiteInteger(operation.durationMinutes, 1, 5_256_000) || operation.minimumPower !== 'wish' ||
      Object.keys(operation).some(key => !['id', 'kind', 'durationMinutes', 'minimumPower'].includes(key))) errors.push(`${label} remains protection is invalid`)
    return
  }
  if (operation.kind === 'purify-map-consumables') {
    if (
      operation.contaminants.length < 1 || operation.contaminants.length > 2 ||
      new Set(operation.contaminants).size !== operation.contaminants.length ||
      operation.contaminants.some((entry) => entry !== 'poison' && entry !== 'disease')
    ) errors.push(`${label}.contaminants is invalid`)
    return
  }
  if (operation.kind === 'remove-effect') {
    if (!validId(operation.effectId) || !['self', 'any'].includes(operation.source)) {
      errors.push(`${label} remove-effect selector is invalid`)
    }
    return
  }
  if (operation.kind === 'relocate-granting-area') {
    if (operation.target !== 'target') errors.push(`${label}.target is invalid`)
    if (operation.retainMovementBudget != null && operation.retainMovementBudget !== true) errors.push(`${label}.retainMovementBudget is invalid`)
    if (operation.requiresDifferentAnchor != null && typeof operation.requiresDifferentAnchor !== 'boolean') errors.push(`${label}.requiresDifferentAnchor is invalid`)
    appendFormulaErrors(errors, operation.maximumFeet, `${label}.maximumFeet`)
    if (
      operation.interposition != null &&
      operation.interposition.kind !== 'clear' &&
      (
        operation.interposition.kind !== 'by-target-strength' ||
        !finiteInteger(operation.interposition.maximumStrengthToBlock, 1, 30)
      )
    ) errors.push(`${label}.interposition is invalid`)
    return
  }
  if (operation.kind === 'remove-effects-by-tag') {
    if (
      !['actor', 'target', 'all-targets', 'all-combatants'].includes(operation.target) ||
      operation.tags.length < 1 || operation.tags.length > 32 ||
      new Set(operation.tags).size !== operation.tags.length ||
      operation.tags.some((tag) => !validId(tag) || tag.length > 80) ||
      (operation.sourceCreatureTypes != null && (
        operation.sourceCreatureTypes.length < 1 || operation.sourceCreatureTypes.length > 32 ||
        new Set(operation.sourceCreatureTypes).size !== operation.sourceCreatureTypes.length ||
        operation.sourceCreatureTypes.some((type) => !validId(type) || type.length > 80)
      )) ||
      !['any', 'all'].includes(operation.match) || !['self', 'any'].includes(operation.source) ||
      (operation.maximumCount != null && !finiteInteger(operation.maximumCount, 1, 32))
    ) errors.push(`${label} remove-effects-by-tag selector is invalid`)
    return
  }
  if (operation.kind === 'adjust-exhaustion') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    return
  }
  if (operation.kind === 'lower-ability-score') {
    if (!ABILITIES.has(operation.ability) || operation.recovery !== 'restoration-magic') {
      errors.push(`${label} lower-ability-score selector is invalid`)
    }
    appendFormulaErrors(errors, operation.maximumScore, `${label}.maximumScore`)
    if (operation.recoveryGroupId != null && !validId(operation.recoveryGroupId)) {
      errors.push(`${label}.recoveryGroupId is invalid`)
    }
    return
  }
  if (operation.kind === 'recover-ability-score') {
    if (!ABILITIES.has(operation.ability) ||
      (operation.maximumCount != null && !finiteInteger(operation.maximumCount, 1, 32))) {
      errors.push(`${label} recover-ability-score selector is invalid`)
    }
    return
  }
  if (operation.kind === 'reduce-hit-point-maximum' || operation.kind === 'transfer-hit-point-maximum') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    if (!validId(operation.owningEffectId)) errors.push(`${label}.owningEffectId is invalid`)
    if (operation.minimumMaximum != null && !finiteInteger(operation.minimumMaximum, 1, 1_000_000)) errors.push(`${label}.minimumMaximum is invalid`)
    if (operation.kind === 'transfer-hit-point-maximum') {
      if (!validId(operation.beneficiaryEffectId)) errors.push(`${label}.beneficiaryEffectId is invalid`)
      if (operation.increaseCurrentHp != null && typeof operation.increaseCurrentHp !== 'boolean') errors.push(`${label}.increaseCurrentHp is invalid`)
      if (operation.linkLifetimes != null && typeof operation.linkLifetimes !== 'boolean') errors.push(`${label}.linkLifetimes is invalid`)
      if (operation.protectLinkedLifetime != null && (operation.protectLinkedLifetime !== true || operation.linkLifetimes !== true)) errors.push(`${label}.protectLinkedLifetime requires linked lifetimes`)
    }
    return
  }
  if (operation.kind === 'recover-hit-point-maximum') {
    if (operation.maximumCount != null && !finiteInteger(operation.maximumCount, 1, 32)) {
      errors.push(`${label}.maximumCount is invalid`)
    }
    return
  }
  if (operation.kind === 'instant-death') return
  if (operation.kind === 'summon') {
    if (operation.placementRangeFeet != null && !finiteInteger(operation.placementRangeFeet, 0, 100000)) errors.push(`${label}.placementRangeFeet is invalid`)
    if (operation.requiresVisiblePlacement != null && typeof operation.requiresVisiblePlacement !== 'boolean') errors.push(`${label}.requiresVisiblePlacement is invalid`)
    if(operation.bondActivityIds!=null && (!operation.bondKey || !Array.isArray(operation.bondActivityIds)||operation.bondActivityIds.length>16||operation.bondActivityIds.some(id=>!validId(id))))errors.push(`${label}.bondActivityIds is invalid`)
    if(operation.protectiveCircle!=null && (typeof operation.protectiveCircle!=='boolean'||!operation.concentration))errors.push(`${label}.protectiveCircle requires a concentration summon`)
    if(operation.bondKey!=null && (!validId(operation.bondKey)||!operation.persistent))errors.push(`${label}.bondKey requires a persistent summon`)
    if (operation.exclusiveBondKeys != null && (!operation.bondKey || !operation.persistent ||
      !Array.isArray(operation.exclusiveBondKeys) || operation.exclusiveBondKeys.length === 0 || operation.exclusiveBondKeys.length > 16 ||
      operation.exclusiveBondKeys.some(key => !validId(key)) || new Set(operation.exclusiveBondKeys).size !== operation.exclusiveBondKeys.length)) {
      errors.push(`${label}.exclusiveBondKeys requires unique bond keys and a persistent bond`)
    }
    if (operation.existingBondPolicy != null && (operation.existingBondPolicy !== 'reject-living' || !operation.bondKey || !operation.persistent)) {
      errors.push(`${label}.existingBondPolicy requires a persistent bond and reject-living`)
    }
    if(operation.bondDismissActivityId!=null && (!validId(operation.bondDismissActivityId)||!operation.bondKey))errors.push(`${label}.bondDismissActivityId requires a bond`)
    if(operation.understandsCasterLanguage!=null && typeof operation.understandsCasterLanguage!=='boolean')errors.push(`${label}.understandsCasterLanguage is invalid`)
    if(operation.languageChoiceId!=null && !validId(operation.languageChoiceId))errors.push(`${label}.languageChoiceId is invalid`)
    if(operation.telepathyRangeFeet!=null && !finiteInteger(operation.telepathyRangeFeet,1,100000))errors.push(`${label}.telepathyRangeFeet is invalid`)
    if(operation.controlSave != null) {
      if(typeof operation.controlSave!=='object' || !ABILITIES.has(operation.controlSave.ability)) errors.push(`${label}.controlSave is invalid`)
      else {
        appendFormulaErrors(errors,operation.controlSave.dc,`${label}.controlSave.dc`)
        if(operation.controlSave.disadvantage!=null && typeof operation.controlSave.disadvantage!=='boolean') errors.push(`${label}.controlSave.disadvantage is invalid`)
        if(operation.controlSave.lingerDieSides!=null && ![4,6,8,10,12,20].includes(Number(operation.controlSave.lingerDieSides))) errors.push(`${label}.controlSave.lingerDieSides is invalid`)
      }
      if(!operation.concentration || operation.persistent || operation.becomesHostileAfterConcentrationEnds || operation.persistAfterConcentrationCompletes) errors.push(`${label}.controlSave requires an ordinary concentration summon`)
    }
    if (operation.uncontrolledLinger != null && (!isDnd5eSummonLingerPolicy(operation.uncontrolledLinger) ||
      !operation.concentration || operation.persistent || operation.becomesHostileAfterConcentrationEnds || operation.persistAfterConcentrationCompletes)) {
      errors.push(`${label}.uncontrolledLinger requires a valid ordinary concentration summon policy`)
    }
    if(operation.maximumChallengeRating!=null) appendFormulaErrors(errors,operation.maximumChallengeRating,`${label}.maximumChallengeRating`)
    if(operation.requiredMonsterMaterialTagPrefix!=null && (typeof operation.requiredMonsterMaterialTagPrefix!=='string'||!/^[-a-z0-9.]{1,64}$/.test(operation.requiredMonsterMaterialTagPrefix))) errors.push(`${label}.requiredMonsterMaterialTagPrefix is invalid`)
    if(operation.requiredCreatureSubtype!=null && (typeof operation.requiredCreatureSubtype!=='string'||!operation.requiredCreatureSubtype.trim()||operation.requiredCreatureSubtype.length>80)) errors.push(`${label}.requiredCreatureSubtype is invalid`)
    if (operation.explorationDelaySeconds != null && (!finiteInteger(operation.explorationDelaySeconds, 1, 86400) || operation.timing !== 'source-next-turn-start')) errors.push(`${label}.explorationDelaySeconds requires a bounded delayed summon`)
    if (operation.afterDamageKillOperationId != null && (!validId(operation.afterDamageKillOperationId) || operation.corpseFormChoiceId || operation.count.kind !== 'constant' || operation.count.value !== 1)) errors.push(`${label}.afterDamageKillOperationId requires one creature and no corpse form choice`)
    if (operation.independentPersistent != null && (operation.independentPersistent !== true || !operation.persistent || operation.bondKey)) errors.push(`${label}.independentPersistent requires an unbonded persistent summon`)
    if (operation.animatedObjectSize != null && (!['tiny','small','medium','large','huge'].includes(operation.animatedObjectSize) || operation.corpseFormChoiceId || operation.afterDamageKillOperationId || operation.timing !== 'immediate' || operation.count.kind !== 'constant' || operation.count.value !== 1)) errors.push(`${label}.animatedObjectSize requires a supported size, one immediate creature per object and no corpse conversion`)
    if (operation.corpseFormChoiceId != null && !validId(operation.corpseFormChoiceId)) errors.push(`${label}.corpseFormChoiceId is invalid`)
    if (operation.monsterChoiceId != null && !validId(operation.monsterChoiceId)) errors.push(`${label}.monsterChoiceId is invalid`)
    if (operation.monsterChoiceId && operation.corpseFormChoiceId) errors.push(`${label} cannot combine monsterChoiceId and corpseFormChoiceId`)
    if (operation.groupInitiative != null && typeof operation.groupInitiative!=='boolean') errors.push(`${label}.groupInitiative is invalid`)
    if (operation.autonomousBehavior != null && (!['attack-nearest-visible','attack-nearest-other-subtype','protect-source'].includes(operation.autonomousBehavior) || (operation.autonomousBehavior==='attack-nearest-other-subtype' && !operation.requiredCreatureSubtype?.trim()) || (operation.commandPolicy != null && operation.autonomousBehavior !== 'protect-source') || operation.controlSave != null || operation.cannotAttack)) errors.push(`${label}.autonomousBehavior requires an independent attacking summon`)
    if (operation.commandPolicy != null && !['persistent-order','turn-order'].includes(operation.commandPolicy)) errors.push(`${label}.commandPolicy is invalid`)
    if (operation.spellEffectSourceId != null && !validId(operation.spellEffectSourceId)) errors.push(`${label}.spellEffectSourceId is invalid`)
    if (!validId(operation.monsterId)) errors.push(`${label}.monsterId is invalid`)
    appendFormulaErrors(errors, operation.count, `${label}.count`)
    for (const [field, formula] of Object.entries({
      minimumMaximumHitPoints: operation.minimumMaximumHitPoints,
      armorClassBonus: operation.armorClassBonus,
      weaponAttackBonus: operation.weaponAttackBonus,
      weaponDamageBonus: operation.weaponDamageBonus,
      savingThrowBonus: operation.savingThrowBonus,
      proficientSkillCheckBonus: operation.proficientSkillCheckBonus,
      attacksPerAction: operation.attacksPerAction,
      walkingSpeedFeet: operation.walkingSpeedFeet,
    })) {
      if (formula != null) appendFormulaErrors(errors, formula, `${label}.${field}`)
    }
    if (!(operation.persistent === true && operation.durationRounds == null) && !finiteInteger(operation.durationRounds, 1, 10_000)) errors.push(`${label}.durationRounds is invalid`)
    if (operation.persistAfterConcentrationCompletes != null && (
      operation.persistAfterConcentrationCompletes !== true ||
      operation.concentration !== true || operation.persistent === true
    )) errors.push(`${label}.persistAfterConcentrationCompletes is invalid`)
    if (operation.becomesHostileAfterConcentrationEnds != null && (
      operation.becomesHostileAfterConcentrationEnds !== true ||
      operation.concentration !== true || operation.persistent === true ||
      operation.persistAfterConcentrationCompletes === true
    )) errors.push(`${label}.becomesHostileAfterConcentrationEnds is invalid`)
    if (operation.weaponAttacksMagical != null && typeof operation.weaponAttacksMagical !== 'boolean') {
      errors.push(`${label}.weaponAttacksMagical is invalid`)
    }
    if (operation.cannotAttack != null && typeof operation.cannotAttack !== 'boolean') {
      errors.push(`${label}.cannotAttack is invalid`)
    }
    if (operation.creatureTypeOverride != null && !['celestial','fey','fiend'].includes(operation.creatureTypeOverride)) errors.push(`${label}.creatureTypeOverride is invalid`)
    if (operation.minimumIntelligence != null && !finiteInteger(operation.minimumIntelligence, 1, 30)) errors.push(`${label}.minimumIntelligence is invalid`)
    if (operation.shareSelfSpellsRequiresMounted != null && (typeof operation.shareSelfSpellsRequiresMounted !== 'boolean' || operation.shareSelfSpellsRangeFeet == null)) errors.push(`${label}.shareSelfSpellsRequiresMounted is invalid`)
    if (operation.shareSelfSpellsRangeFeet != null &&
      !finiteInteger(operation.shareSelfSpellsRangeFeet, 5, 10_000)) {
      errors.push(`${label}.shareSelfSpellsRangeFeet is invalid`)
    }
    if (operation.dismissAfterDamageRounds != null &&
      !finiteInteger(operation.dismissAfterDamageRounds, 1, 10_000)) {
      errors.push(`${label}.dismissAfterDamageRounds is invalid`)
    }
    if (operation.sourceDeathBehavior != null && operation.sourceDeathBehavior !== 'die') {
      errors.push(`${label}.sourceDeathBehavior is invalid`)
    }
    return
  }
  if (operation.kind === 'duplicate-creature') {
    if (!['actor', 'target', 'all-targets'].includes(operation.target)) errors.push(`${label}.target is invalid`)
    if (operation.profile !== 'simulacrum') errors.push(`${label}.profile is invalid`)
    if (operation.persistent !== true || operation.maximumHitPointDivisor !== 2 ||
      operation.cannotIncreaseLevel !== true || operation.cannotRegainSpellSlots !== true) {
      errors.push(`${label} simulacrum restrictions are invalid`)
    }
    return
  }
  if (operation.kind === 'dispel-area') {
    if (operation.target !== 'actor' || operation.areaKind !== 'magical-darkness') errors.push(`${label} dispel selector is invalid`)
    appendFormulaErrors(errors, operation.radiusFeet, `${label}.radiusFeet`)
    appendFormulaErrors(errors, operation.maximumSpellLevel, `${label}.maximumSpellLevel`)
    return
  }
  if(operation.kind==='dismiss-owned-temporary-summons') {
    if(!Array.isArray(operation.sourceActivityIds) || operation.sourceActivityIds.length<1 || operation.sourceActivityIds.length>16 || operation.sourceActivityIds.some(id=>!validId(id)) || new Set(operation.sourceActivityIds).size!==operation.sourceActivityIds.length) errors.push(`${label}.sourceActivityIds is invalid`)
    return
  }
  if(operation.kind==='dismiss-owned-summon') {
    if(!validId(operation.bondKey)||(operation.releaseBond!=null && typeof operation.releaseBond!=='boolean'))errors.push(`${label} summon bond is invalid`)
    return
  }
  if (operation.kind === 'end-owned-companion-control') {
    if (operation.target !== 'target' || !validId(operation.sourceActivityId)) errors.push(`${label} companion control source is invalid`)
    for (const field of ['requiresSpeech', 'becomesHostile'] as const) {
      if (operation[field] != null && typeof operation[field] !== 'boolean') errors.push(`${label}.${field} is invalid`)
    }
    return
  }
  if (operation.kind === 'command-owned-companion') {
    if (!isDnd5eCompanionTaskCommand(operation)) errors.push(`${label}.task requires a bounded task description`)
    if (operation.allowsTaskDescription != null && (operation.allowsTaskDescription !== true || operation.command !== 'task')) errors.push(`${label}.allowsTaskDescription requires task`)
    if (!isDnd5eCompanionReadyCommand(operation)) errors.push(`${label}.ready requires a valid declaration`)
    if (operation.allowsReadyTrigger != null && (operation.allowsReadyTrigger !== true || operation.command !== 'ready')) errors.push(`${label}.allowsReadyTrigger requires a ready command`)
    if ((operation.command === 'use-object' || operation.command === 'ready' && operation.ready?.actionKind === 'interact-object') !== (operation.requiresObjectInteraction === true) ||
      (operation.requiresObjectInteraction != null && operation.requiresObjectInteraction !== true)) errors.push(`${label}.use-object requires an object interaction selection`)
    if (operation.attackKind != null && (!isDnd5eCompanionAttackKind(operation.attackKind) ||
      operation.command !== 'attack' || operation.requiresAttackTarget !== true || operation.requiresGuardArea)) errors.push(`${label}.attackKind requires a named attack command`)
    if (operation.requiresHelpTarget != null && (operation.requiresHelpTarget !== true || operation.command !== 'help')) errors.push(`${label}.requiresHelpTarget requires a Help command`)
    if (operation.requiresAttackTarget != null && (operation.requiresAttackTarget !== true || !(operation.command === 'attack' || operation.command === 'ready' && operation.ready?.actionKind === 'attack'))) errors.push(`${label}.requiresAttackTarget requires an attack command`)
    if (operation.requiresGuardArea != null && (operation.requiresGuardArea !== true || operation.command !== 'attack' ||
      operation.requiresAttackTarget || operation.requiresHelpTarget)) errors.push(`${label}.requiresGuardArea requires an unbound attack command`)
    if (operation.allowsMovementDestination != null && operation.allowsMovementDestination !== true) errors.push(`${label}.allowsMovementDestination must be true`)
    if(operation.voluntaryAfterControlEnds != null && (operation.voluntaryAfterControlEnds !== true || !validId(operation.sourceActivityId))) errors.push(`${label}.voluntaryAfterControlEnds requires a source Activity`)
    for(const field of ['requiresSpeech','controlSaveDisadvantage'] as const)if(operation[field]!=null&&typeof operation[field]!=='boolean')errors.push(`${label}.${field} is invalid`)
    if(operation.sourceActivityId != null && !validId(operation.sourceActivityId)) errors.push(`${label}.sourceActivityId is invalid`)
    if (operation.target !== 'target' || !['attack', 'dash', 'disengage', 'dodge', 'help', 'hide', 'use-object', 'ready', 'task'].includes(operation.command)) {
      errors.push(`${label} companion command is invalid`)
    }
    return
  }
  if (operation.kind === 'grant-weapon-attack') {
    if (operation.inheritTriggerAttackOrigin != null && (
      operation.inheritTriggerAttackOrigin !== true || operation.economy !== 'none' ||
      (operation.available != null && operation.available !== 'immediate')
    )) errors.push(`${label}.inheritTriggerAttackOrigin requires an immediate free attack`)
    if (operation.available != null && !['immediate', 'next-own-turn'].includes(operation.available)) errors.push(`${label}.available is invalid`)
    if ((operation.bindTriggerTarget != null && operation.bindTriggerTarget !== true) ||
      (operation.bindTriggerTarget && operation.differentTargetWithinFeetOfEventTarget != null)) errors.push(`${label}.bindTriggerTarget is invalid`)
    if (operation.attackAdvantage != null && operation.attackAdvantage !== true) errors.push(`${label}.attackAdvantage is invalid`)
    if (operation.separateByTarget != null && (operation.separateByTarget !== true || operation.bindTriggerTarget !== true)) errors.push(`${label}.separateByTarget requires bindTriggerTarget`)
    if (operation.attackResourceCost != null && (!validId(operation.attackResourceCost.resourceId) ||
      !finiteInteger(operation.attackResourceCost.amount, 1, 1000))) errors.push(`${label}.attackResourceCost is invalid`)
    if (operation.damageBonus != null && typeof operation.damageBonus !== 'number') {
      errors.push(...validateDnd5eFormulaV1(operation.damageBonus, `${label}.damageBonus`))
    }
    const invalidIds = (values: readonly string[] | undefined) => values != null && (
      values.length < 1 || values.length > 64 || values.some((value) => !validId(value)) ||
      new Set(values).size !== values.length
    )
    if (
      (operation.reuseMissedProjectile != null && (operation.reuseMissedProjectile !== true ||
        operation.differentTargetWithinFeetOfEventTarget == null || (operation.attacks ?? 1) !== 1 || operation.economy !== 'bonus-action')) ||
      (operation.differentTargetWithinFeetOfEventTarget != null && !finiteInteger(operation.differentTargetWithinFeetOfEventTarget, 1, 10000)) ||
      operation.target !== 'actor' || !validId(operation.grantId) ||
      !operation.label.trim() || operation.label.length > 120 ||
      !['bonus-action', 'none'].includes(operation.economy) || operation.expires !== 'turn-end' ||
      (operation.attacks != null && !finiteInteger(operation.attacks, 1, 10)) ||
      (operation.weaponModes != null && (
        operation.weaponModes.length < 1 || operation.weaponModes.length > 2 ||
        operation.weaponModes.some((mode) => !['melee', 'ranged'].includes(mode)) ||
        new Set(operation.weaponModes).size !== operation.weaponModes.length
      )) ||
      invalidIds(operation.weaponIds) || invalidIds(operation.requiredWeaponProperties) ||
      invalidIds(operation.forbiddenWeaponProperties) ||
      (operation.damageDice != null && (
        !finiteInteger(operation.damageDice.count, 1, 24) ||
        !finiteInteger(operation.damageDice.sides, 2, 100)
      )) ||
      (operation.damageType != null && !DAMAGE_TYPES.has(operation.damageType)) ||
      (typeof operation.damageBonus === 'number' && !finiteInteger(operation.damageBonus, -1_000, 1_000)) ||
      (operation.weaponSlots != null && (
        operation.weaponSlots.length < 1 || operation.weaponSlots.length > 2 ||
        operation.weaponSlots.some((slot) => !['main-hand', 'off-hand'].includes(slot)) ||
        new Set(operation.weaponSlots).size !== operation.weaponSlots.length
      )) ||
      (operation.proficient != null && typeof operation.proficient !== 'boolean')
    ) errors.push(`${label} weapon-attack grant is invalid`)
    return
  }
  if (operation.kind === 'grant-basic-action') {
    if (
      operation.target !== 'actor' || !validId(operation.grantId) ||
      !operation.label.trim() || operation.label.length > 120 ||
      operation.economy !== 'bonus-action' || operation.expires !== 'turn-end' ||
      operation.actions.length < 1 || operation.actions.length > 3 ||
      operation.actions.some((action) => !['dash', 'grapple', 'shove'].includes(action)) ||
      new Set(operation.actions).size !== operation.actions.length ||
      (operation.shovePushDistanceBonusFeet != null &&
        !finiteInteger(operation.shovePushDistanceBonusFeet, 0, 1_000))
    ) errors.push(`${label} basic-action grant is invalid`)
    return
  }
  if (operation.kind === 'create-persistent-area') {
    if (operation.bindRestraintEffectIds != null && (!operation.entityProfile ||
      !Array.isArray(operation.bindRestraintEffectIds) || operation.bindRestraintEffectIds.length < 1 ||
      operation.bindRestraintEffectIds.length > 16 || operation.bindRestraintEffectIds.some(id => typeof id !== 'string' || !id.trim() || id.length > 120))) {
      errors.push(`${label}.bindRestraintEffectIds requires entity restraint definitions`)
    }
    if (!operation.label.trim() || operation.label.length > 120) errors.push(`${label}.label is invalid`)
    if (operation.instanceCount != null && !finiteInteger(operation.instanceCount, 1, 16)) errors.push(`${label}.instanceCount is invalid`)
    if (operation.clipHeightToMappedSolids != null && (operation.clipHeightToMappedSolids !== true ||
      operation.separateSelectedInstances !== true || operation.groundOnly)) errors.push(`${label}.clipHeightToMappedSolids requires separate volume entities`)
    if (operation.separateSelectedInstances != null && (operation.separateSelectedInstances !== true ||
      !operation.entityProfile || operation.instanceCount != null || operation.utilityProjectionId != null ||
      (operation.anchorMode != null && operation.anchorMode !== 'fixed'))) errors.push(`${label}.separateSelectedInstances requires independent fixed entities`)
    // Long-lived SRD areas include effects measured in days. One year keeps
    // the data bounded without truncating them to the old one-day maximum.
    if (!finiteInteger(operation.durationRounds, 1, 5_256_000)) errors.push(`${label}.durationRounds is invalid`)
    if (operation.permanent != null && operation.permanent !== true) errors.push(`${label}.permanent is invalid`)
    if (operation.groundOnly != null && operation.groundOnly !== true) errors.push(`${label}.groundOnly is invalid`)
    if (operation.surfaceMaterials != null && (
      (operation.groundOnly !== true && operation.surfaceAtPlacementElevation !== true) || (operation.permanent != null && operation.permanent !== true) || operation.concentration === true ||
      operation.anchorMode !== 'fixed' || operation.effectToken != null ||
      !Array.isArray(operation.surfaceMaterials) || operation.surfaceMaterials.length === 0 ||
      new Set(operation.surfaceMaterials).size !== operation.surfaceMaterials.length ||
      operation.surfaceMaterials.some(material => !['solid', 'sand', 'dust', 'loose-earth', 'gravel', 'stone', 'ice', 'snow', 'earth', 'mud', 'quicksand'].includes(material))
    )) errors.push(`${label}.surfaceMaterials requires fixed ground terrain and known unique materials`)
    if(operation.surfaceAtPlacementElevation!=null&&(operation.surfaceAtPlacementElevation!==true||operation.groundOnly!=null||
      operation.requireAllSurfaceMaterials!==true||!operation.surfaceMaterials?.length||operation.anchorMode!=='fixed')){
      errors.push(`${label}.surfaceAtPlacementElevation requires strict fixed material validation without groundOnly`)
    }

    if (operation.requireNonmagicalSurfaceMaterials != null &&
      (operation.requireNonmagicalSurfaceMaterials !== true || operation.requireAllSurfaceMaterials !== true || operation.groundOnly !== true)) {
      errors.push(`${label}.requireNonmagicalSurfaceMaterials requires strict ground material validation`)
    }
    if (operation.requireAllSurfaceMaterials != null &&
      (operation.requireAllSurfaceMaterials !== true || !operation.surfaceMaterials?.length)) {
      errors.push(`${label}.requireAllSurfaceMaterials requires a surface material whitelist`)
    }
    if(operation.materialTransformation!=null){
      const transform=operation.materialTransformation
      if(!transform||typeof transform!=='object'||Array.isArray(transform)||
        !['rock-to-mud','mud-to-rock','ceiling-rock-to-mud'].includes(transform.mode)||(transform.depthFeet!=='selected-height'&&(!Number.isFinite(transform.depthFeet)||transform.depthFeet<=0||
        transform.depthFeet>(transform.mode==='mud-to-rock'?10:40)))||Object.keys(transform).some(key=>!['mode','depthFeet'].includes(key))||
        operation.permanent!==true||operation.concentration!==false||operation.anchorMode!=='fixed'||
        (transform.mode==='ceiling-rock-to-mud'
          ? operation.groundOnly!=null||operation.surfaceMaterials!=null||operation.requireNonmagicalSurfaceMaterials!=null||operation.surfaceAtPlacementElevation!=null
          : operation.groundOnly!==true||operation.requireNonmagicalSurfaceMaterials!==true)){
        errors.push(`${label}.materialTransformation requires a fixed permanent nonmagical volume, bounded depth, and matching ground or ceiling placement`)
      }
    }
    if (operation.normalGroundTerrain != null && (operation.normalGroundTerrain !== true ||
      operation.requireAllSurfaceMaterials !== true || operation.groundOnly !== true ||
      operation.anchorMode !== 'fixed' || (operation.movementCostMultiplier ?? 1) !== 1)) {
      errors.push(`${label}.normalGroundTerrain requires strict fixed ground terrain without a cost increase`)
    }
    if (operation.terrainClearing != null && (
      !validTerrainClearing(operation.terrainClearing) || operation.groundOnly !== true ||
      operation.permanent !== true || operation.concentration !== false ||
      (operation.anchorMode != null && operation.anchorMode !== 'fixed') || operation.effectToken != null
    )) errors.push(`${label}.terrainClearing requires permanent fixed ground terrain`)
    if (operation.castLevelProfiles != null && (
      !Array.isArray(operation.castLevelProfiles) || operation.castLevelProfiles.length < 1 ||
      operation.castLevelProfiles.length > 9 ||
      operation.castLevelProfiles.some((profile) =>
        !finiteInteger(profile.minimumCastLevel, 1, 9) ||
        !finiteInteger(profile.durationRounds, 1, 5_256_000) ||
        typeof profile.concentration !== 'boolean' ||
        (profile.permanent != null && profile.permanent !== true) ||
        (profile.occupantModifiers != null &&
          !normalizeDnd5ePersistentAreaOccupantModifiers(profile.occupantModifiers))) ||
      new Set(operation.castLevelProfiles.map((profile) => profile.minimumCastLevel)).size !==
        operation.castLevelProfiles.length
    )) errors.push(`${label}.castLevelProfiles is invalid`)
    if (operation.mappedObjectEnchantment != null && operation.mappedObjectEnchantment !== 'magic-mouth') {
      errors.push(`${label}.mappedObjectEnchantment is invalid`)
    }
    if (operation.mappedObjectEnchantment === 'magic-mouth' && operation.permanent !== true) {
      errors.push(`${label}.mappedObjectEnchantment requires permanent`)
    }
    if (operation.color != null && !/^#[0-9a-f]{6}$/i.test(operation.color)) errors.push(`${label}.color is invalid`)
    if (operation.lighting != null && !normalizeDnd5ePersistentAreaLighting(operation.lighting)) {
      errors.push(`${label}.lighting is invalid`)
    }
    if (operation.utilityProjectionId != null && !/^[a-z0-9][a-z0-9-]{0,99}$/.test(operation.utilityProjectionId)) {
      errors.push(`${label}.utilityProjectionId is invalid`)
    }
    if(operation.structureServices!=null&&(operation.utilityProjectionId!=='mighty-fortress'||
      typeof operation.structureServices!=='object'||Array.isArray(operation.structureServices)||
      Object.keys(operation.structureServices).some(key=>key!=='mealTemplateId'&&key!=='furnishings')||
      (operation.structureServices.furnishings!=null&&!validDnd5eFortressFurnishingCatalog(operation.structureServices.furnishings))||
      typeof operation.structureServices.mealTemplateId!=='string'||!/^[a-z0-9][a-z0-9._:-]{0,199}$/.test(operation.structureServices.mealTemplateId))){
      errors.push(`${label}.structureServices is invalid`)
    }
    if (operation.triggers != null && (
      !Array.isArray(operation.triggers) || operation.triggers.length < 1 || operation.triggers.length > 32
    )) errors.push(`${label}.triggers is invalid`)
    else operation.triggers?.forEach((trigger, index) => {
      if (!normalizeDnd5ePersistentAreaTriggerDeclaration(trigger)) {
        errors.push(`${label}.triggers[${index}] is invalid`)
      }
    })
    if (operation.movement != null && (
      (operation.movement.requiresVisibleDestination !== undefined && operation.movement.requiresVisibleDestination !== true) ||
      (operation.movement.surfaceCloud != null && !validDnd5ePersistentAreaSurfaceCloud(operation.movement.surfaceCloud)) ||
      (operation.movement.allowVertical !== undefined && operation.movement.allowVertical !== true) ||
      (operation.movement.descendOverLowerGround !== undefined && (operation.movement.descendOverLowerGround !== true || operation.movement.maximumBottomHeightAboveGroundFeet===undefined)) ||
      (operation.movement.maximumBottomHeightAboveGroundFeet !== undefined &&
        (operation.movement.allowVertical !== true || !finiteNumber(operation.movement.maximumBottomHeightAboveGroundFeet,0,1000))) ||
      (operation.movement.carryRestrainedTargets !== undefined && operation.movement.carryRestrainedTargets !== true) ||
      (operation.movement.collectObjectsMaximumSizeRank !== undefined && (!Number.isInteger(operation.movement.collectObjectsMaximumSizeRank) || operation.movement.collectObjectsMaximumSizeRank<0 || operation.movement.collectObjectsMaximumSizeRank>5 || operation.movement.carryRestrainedTargets!==true)) ||
      !['action', 'bonus-action', 'none'].includes(operation.movement.economy) ||
      !finiteInteger(operation.movement.maximumFeet, 1, 1_000) ||
      (operation.movement.maximumBarrierHeightFeet != null &&
        !finiteInteger(operation.movement.maximumBarrierHeightFeet, 1, 1_000)) ||
      (operation.movement.maximumGapWidthFeet != null &&
        !finiteInteger(operation.movement.maximumGapWidthFeet, 1, 1_000)) ||
      (operation.movement.maximumSourceDistanceBeforeMoveFeet != null &&
        !finiteInteger(operation.movement.maximumSourceDistanceBeforeMoveFeet, 1, 10_000)) ||
      (operation.movement.maximumDistanceFromSourceFeet != null &&
        !finiteInteger(operation.movement.maximumDistanceFromSourceFeet, 1, 10_000)) ||
      (operation.movement.endWhenExceedingSourceDistance != null &&
        typeof operation.movement.endWhenExceedingSourceDistance !== 'boolean')
    )) errors.push(`${label}.movement is invalid`)
    if (operation.lifecycle != null && !normalizeDnd5ePersistentAreaTurnLifecycle(operation.lifecycle)) {
      errors.push(`${label}.lifecycle is invalid`)
    }
    if (operation.directionalMovementCost != null && !normalizeDnd5eDirectionalMovementDeclaration(operation.directionalMovementCost)) {
      errors.push(`${label}.directionalMovementCost is invalid`)
    }
    if (operation.modes != null) {
      const modes = normalizeDnd5ePersistentAreaModeDeclarations(operation.modes)
      if (!modes) errors.push(`${label}.modes is invalid`)
      if ((operation.initialModeId == null) === (operation.initialModeChoiceId == null) ||
        (operation.initialModeId != null && !modes?.some(mode => mode.id === operation.initialModeId))) errors.push(`${label}.modes requires one valid initialModeId or initialModeChoiceId`)
      if (DND5E_AREA_MODE_FIELDS.some(field => operation[field] != null) || operation.lifecycle || operation.castLevelProfiles || operation.hallow || operation.symbolMode || operation.mappedObjectEnchantment) errors.push(`${label}.modes cannot mix modal properties with base properties, turn evolution or cast profiles`)
    } else if (operation.initialModeId != null || operation.initialModeChoiceId != null) errors.push(`${label} initialMode requires modes`)
    if (operation.movementCostMultiplier != null &&
      !finiteNumber(operation.movementCostMultiplier, 1, 100)) {
      errors.push(`${label}.movementCostMultiplier is invalid`)
    }
    if (operation.excludesWindDispersibleGas != null && typeof operation.excludesWindDispersibleGas !== 'boolean') errors.push(`${label}.excludesWindDispersibleGas is invalid`)
    if (operation.extinguishesUnprotectedFlames != null && operation.extinguishesUnprotectedFlames !== 'torch-or-smaller') {
      errors.push(`${label}.extinguishesUnprotectedFlames is invalid`)
    }
    if(operation.endFlameExtinguishRadiusFeet != null && !finiteInteger(operation.endFlameExtinguishRadiusFeet,1,1000))errors.push(`${label}.endFlameExtinguishRadiusFeet is invalid`)
    if (operation.movementGroundCover != null && !normalizeDnd5ePersistentAreaGroundCover(operation.movementGroundCover)) errors.push(`${label}.movementGroundCover is invalid`)
    if (operation.movementExcludesSource != null && typeof operation.movementExcludesSource !== 'boolean') {
      errors.push(`${label}.movementExcludesSource is invalid`)
    }
    if (operation.movement?.carryRestrainedTargets && (operation.anchorMode === 'source-token' ||
      operation.anchorMode === 'target-token' || operation.sourceFollower || operation.lifecycle?.translateAwayFromSourceFeet)) {
      errors.push(`${label}.movement.carryRestrainedTargets requires commanded movement`)
    }
    if (operation.movementRequiresGroundedSource != null && typeof operation.movementRequiresGroundedSource !== 'boolean') {
      errors.push(`${label}.movementRequiresGroundedSource is invalid`)
    }
    if (operation.dispersedByStrongWind != null && typeof operation.dispersedByStrongWind !== 'boolean') {
      errors.push(`${label}.dispersedByStrongWind must be boolean`)
    }
    if (operation.obscuration != null && (
      (operation.obscuration.scope != null && operation.obscuration.scope !== 'source-token') ||
      !['light', 'heavy'].includes(operation.obscuration.kind) ||
      (operation.obscuration.sourceCanSeeThrough != null && typeof operation.obscuration.sourceCanSeeThrough !== 'boolean')
    )) errors.push(`${label}.obscuration is invalid`)
    if (operation.occupantModifiers != null &&
      !normalizeDnd5ePersistentAreaOccupantModifiers(operation.occupantModifiers)) {
      errors.push(`${label}.occupantModifiers is invalid`)
    }
    if (operation.blocking != null && !normalizeDnd5ePersistentAreaBlocking(operation.blocking)) {
      errors.push(`${label}.blocking is invalid`)
    }
    if (operation.creationConstraints != null && (
      typeof operation.creationConstraints !== 'object' ||
      (operation.creationConstraints.maximumCreatureCount != null &&
        !finiteInteger(operation.creationConstraints.maximumCreatureCount, 0, 128)) ||
      (operation.creationConstraints.maximumCreatureSizeRank != null &&
        !finiteInteger(operation.creationConstraints.maximumCreatureSizeRank, 0, 5)) ||
      (operation.creationConstraints.forbidCoreSpellOverlap != null &&
        !validId(operation.creationConstraints.forbidCoreSpellOverlap)) ||
      (operation.creationConstraints.maximumCreatureCount == null &&
        operation.creationConstraints.maximumCreatureSizeRank == null &&
        operation.creationConstraints.forbidCoreSpellOverlap == null)
    )) errors.push(`${label}.creationConstraints is invalid`)
    if (operation.hallow != null && (
      operation.permanent !== true ||
      !validId(operation.hallow.effectChoiceId) ||
      !validId(operation.hallow.damageTypeChoiceId) ||
      !validId(operation.hallow.scopeChoiceId) ||
      Object.keys(operation.hallow.wardExemptionChoiceIds).length !== 5 ||
      (['celestial', 'elemental', 'fey', 'fiend', 'undead'] as const).some((creatureType) =>
        !validId(operation.hallow!.wardExemptionChoiceIds[creatureType]))
    )) errors.push(`${label}.hallow is invalid`)
    if (operation.hallucinatoryTerrain != null && (
      operation.permanent === true ||
      operation.concentration !== false ||
      !validId(operation.hallucinatoryTerrain.appearanceChoiceId)
    )) errors.push(`${label}.hallucinatoryTerrain is invalid`)
    if (operation.symbolMode != null && (!['death', 'discord', 'fear', 'hopelessness', 'insanity', 'pain', 'sleep', 'stunning'].includes(operation.symbolMode) || operation.permanent !== true || operation.concentration !== false)) errors.push(`${label}.symbolMode is invalid`)
    if (operation.programmedIllusion != null && (
      operation.permanent !== true ||
      operation.concentration !== false ||
      !validId(operation.programmedIllusion.formChoiceId) ||
      !validId(operation.programmedIllusion.triggerSenseChoiceId)
    )) errors.push(`${label}.programmedIllusion is invalid`)
    if (operation.entityProfile?.destructionTerrain != null &&
      !validDnd5eEntityDestructionTerrain(operation.entityProfile.destructionTerrain)) errors.push(`${label}.entityProfile.destructionTerrain is invalid`)
    if (operation.entityProfile != null && (
      (operation.entityProfile.material != null && !validDnd5eEntityMaterial(operation.entityProfile.material)) ||
      (operation.entityProfile.attacksAutomaticallyMiss != null && operation.entityProfile.attacksAutomaticallyMiss !== true) ||
      (operation.entityProfile.supportsStanding != null && operation.entityProfile.supportsStanding !== true) ||
      typeof operation.entityProfile !== 'object' ||
      !finiteInteger(operation.entityProfile.armorClass, 1, 40) ||
      (
        operation.entityProfile.hitPoints !== 'actor-max-hit-points' &&
        !finiteInteger(operation.entityProfile.hitPoints, 1, 1_000_000)
      ) ||
      (operation.entityProfile.strength != null && !finiteInteger(operation.entityProfile.strength, 1, 30)) ||
      (operation.entityProfile.dexterity != null &&
        !finiteInteger(operation.entityProfile.dexterity, 1, 30)) ||
      typeof operation.entityProfile.cannotAttack !== 'boolean' ||
      typeof operation.entityProfile.invisible !== 'boolean'
    )) errors.push(`${label}.entityProfile is invalid`)
    if (operation.investigationDc != null && (operation.investigationDc !== 'source-save-dc' || !operation.effectToken)) errors.push(`${label}.investigationDc requires an independent effect token`)
    if (operation.discovery !== undefined && (!operation.discovery ||
      Object.keys(operation.discovery).some(key => !['skill', 'dc'].includes(key)) ||
      !['perception', 'investigation'].includes(operation.discovery.skill) || operation.discovery.dc !== 'source-save-dc')) errors.push(`${label}.discovery is invalid`)
    if (operation.projectionDefense != null && (operation.projectionDefense !== 'untouchable-illusion' ||
      !operation.effectToken || operation.entityProfile != null)) errors.push(`${label}.projectionDefense requires an independent effect token without AC/HP`)
    if (operation.triggerExemptions != null && operation.triggerExemptions !== 'selected-creatures') {
      errors.push(`${label}.triggerExemptions is invalid`)
    }
    if (operation.anchorMode != null && !['fixed', 'source-token', 'target-token'].includes(operation.anchorMode)) {
      errors.push(`${label}.anchorMode is invalid`)
    }
    if (operation.concealsFlameLightFromOutside != null && operation.concealsFlameLightFromOutside !== true) errors.push(`${label}.concealsFlameLightFromOutside is invalid`)
    if (operation.hiddenFromPlayers != null && operation.hiddenFromPlayers !== true) errors.push(`${label}.hiddenFromPlayers is invalid`)
    if (operation.teleportationPortal != null && (operation.teleportationPortal.destination !== 'last-long-rest' ||
      Object.keys(operation.teleportationPortal).some(key => key !== 'destination'))) errors.push(`${label}.teleportationPortal is invalid`)
    if (operation.bindToRestSession != null && operation.bindToRestSession !== true) {
      errors.push(`${label}.bindToRestSession is invalid`)
    }
    if (operation.sourceExitBehavior != null && operation.sourceExitBehavior !== 'remove-area') {
      errors.push(`${label}.sourceExitBehavior is invalid`)
    }
    if (operation.sourceAbilityCheckRules !== undefined && (!Array.isArray(operation.sourceAbilityCheckRules) || operation.sourceAbilityCheckRules.length > 32 || !normalizeDnd5eAbilityCheckRules(operation.sourceAbilityCheckRules))) errors.push(`${label}.sourceAbilityCheckRules is invalid`)
    if (operation.sourceSlotSpellHealing !== undefined) {
      if (!operation.sourceSlotSpellHealing || typeof operation.sourceSlotSpellHealing !== 'object' ||
        Object.keys(operation.sourceSlotSpellHealing).some(key => key !== 'amount')) errors.push(`${label}.sourceSlotSpellHealing is invalid`)
      else appendFormulaErrors(errors, operation.sourceSlotSpellHealing.amount, `${label}.sourceSlotSpellHealing.amount`)
    }
    if (operation.creatureDetectionAdvantage !== undefined && operation.creatureDetectionAdvantage !== 'source-and-allies') errors.push(`${label}.creatureDetectionAdvantage is invalid`)
    if (operation.attackAdvantageReaction !== undefined && operation.attackAdvantageReaction !== 'area-source') {
      errors.push(`${label}.attackAdvantageReaction is invalid`)
    }
    if (operation.sourceIncapacitatedBehavior !== undefined && operation.sourceIncapacitatedBehavior !== 'remove-area') {
      errors.push(`${label}.sourceIncapacitatedBehavior is invalid`)
    }
    if (operation.sourceOverlapBehavior != null && operation.sourceOverlapBehavior !== 'remove-area') {
      errors.push(`${label}.sourceOverlapBehavior is invalid`)
    }
    if (operation.sourceLimit != null && !normalizeDnd5ePersistentAreaSourceLimit(operation.sourceLimit)) {
      errors.push(`${label}.sourceLimit is invalid`)
    }
    if (operation.teleportationExitSavingThrow != null && (
      !ABILITIES.has(operation.teleportationExitSavingThrow.ability) ||
      (operation.teleportationExitSavingThrow.dc !== 'source-save-dc' &&
        !finiteInteger(operation.teleportationExitSavingThrow.dc, 1, 40))
    )) errors.push(`${label}.teleportationExitSavingThrow is invalid`)
    if (operation.weaponHitBonusDamage != null &&
      !normalizeDnd5ePersistentAreaWeaponHitBonusDamage(operation.weaponHitBonusDamage)) {
      errors.push(`${label}.weaponHitBonusDamage is invalid`)
    }
    if (operation.grantedActivities != null && (
      !Array.isArray(operation.grantedActivities) || operation.grantedActivities.length < 1 ||
      operation.grantedActivities.length > 8 ||
      operation.grantedActivities.some((grant) => !normalizeDnd5ePersistentAreaGrantedActivity(grant)) ||
      new Set(operation.grantedActivities.map((grant) => grant.activityId)).size !== operation.grantedActivities.length
    )) errors.push(`${label}.grantedActivities is invalid`)
    if (operation.effectToken != null && (
      typeof operation.effectToken !== 'object' ||
      !operation.effectToken.label.trim() || operation.effectToken.label.length > 120 ||
      (operation.effectToken.emoji != null && operation.effectToken.emoji.length > 16) ||
      (operation.effectToken.color != null && !/^#[0-9a-f]{6}$/i.test(operation.effectToken.color)) ||
      (operation.effectToken.size != null && !finiteNumber(operation.effectToken.size, 0.25, 8)) ||
      (operation.effectToken.hiddenBody != null && typeof operation.effectToken.hiddenBody !== 'boolean') ||
      (operation.effectToken.linkedTargetProjection != null && (operation.effectToken.linkedTargetProjection !== true ||
        operation.effectToken.hiddenBody !== true || operation.effectToken.remotePlacement == null)) ||
      (operation.effectToken.visibleToSourceOnly != null && typeof operation.effectToken.visibleToSourceOnly !== 'boolean') ||
      (operation.effectToken.shareVisionWithSource != null && typeof operation.effectToken.shareVisionWithSource !== 'boolean') ||
      (operation.effectToken.visionFromSource != null && (operation.effectToken.visionFromSource !== true ||
        operation.effectToken.shareVisionWithSource !== true || operation.effectToken.visionRangeFeet != null || operation.effectToken.darkvisionRangeFeet != null)) ||
      (operation.effectToken.sensorSense != null && (!['sight', 'hearing'].includes(operation.effectToken.sensorSense) || operation.effectToken.hearingFromSource !== true || operation.effectToken.visionFromSource !== true)) ||
      (operation.effectToken.hearingFromSource != null && (operation.effectToken.hearingFromSource !== true || operation.effectToken.visionFromSource !== true)) ||
      (operation.effectToken.visionRangeFeet != null && !finiteInteger(operation.effectToken.visionRangeFeet, 0, 10_000)) ||
      (operation.effectToken.darkvisionRangeFeet != null && !finiteInteger(operation.effectToken.darkvisionRangeFeet, 0, 10_000))
    )) errors.push(`${label}.effectToken is invalid`)
    if (operation.effectToken?.followSelectedTarget != null && (
      operation.effectToken.followSelectedTarget !== true || operation.anchorMode !== 'target-token' ||
      operation.effectToken.hiddenBody !== true || operation.effectToken.visionFromSource !== true ||
      operation.sourceFollower != null || operation.effectToken.remotePlacement != null ||
      operation.effectToken.linkedTargetProjection != null || operation.instanceCount != null ||
      operation.separateSelectedInstances === true
    )) errors.push(`${label}.effectToken.followSelectedTarget is invalid`)
    const remotePlacement = operation.effectToken?.remotePlacement
    if (remotePlacement != null && (typeof remotePlacement !== 'object' ||
      typeof remotePlacement.memoryPrompt !== 'string' || !remotePlacement.memoryPrompt.trim() || remotePlacement.memoryPrompt.length > 1000 ||
      operation.effectToken?.visionFromSource !== true || operation.effectToken?.hiddenBody !== true ||
      operation.concentration !== true || operation.permanent === true)) errors.push(`${label}.effectToken.remotePlacement is invalid`)
    if (operation.sourceFollower != null) {
      const follower = operation.sourceFollower
      if (operation.effectToken == null) errors.push(`${label}.sourceFollower requires effectToken`)
      if (!finiteNumber(follower.stationaryWithinFeet, 1, 10_000)) {
        errors.push(`${label}.sourceFollower.stationaryWithinFeet is invalid`)
      }
      if (
        !finiteNumber(follower.maximumSeparationFeet, 1, 100_000) ||
        follower.maximumSeparationFeet <= follower.stationaryWithinFeet
      ) errors.push(`${label}.sourceFollower.maximumSeparationFeet is invalid`)
      if (follower.maximumStepHeightFeet != null && !finiteNumber(follower.maximumStepHeightFeet, 1, 1_000)) {
        errors.push(`${label}.sourceFollower.maximumStepHeightFeet is invalid`)
      }
      if (follower.carryingCapacityPounds != null && !finiteNumber(follower.carryingCapacityPounds, 1, 1_000_000)) {
        errors.push(`${label}.sourceFollower.carryingCapacityPounds is invalid`)
      }
    }
    return
  }
  if (operation.kind === 'transform-creature') {
    if (!['actor', 'target', 'all-targets'].includes(operation.target)) errors.push(`${label}.target must be actor, target or all-targets`)
    if (!validId(operation.formChoiceId)) errors.push(`${label}.formChoiceId must reference a declared choice`)
    if (!finiteInteger(operation.durationRounds, 1, 5_256_000)) errors.push(`${label}.durationRounds must be an integer from 1 to 5256000`)
    if (operation.concentration !== true) errors.push(`${label}.concentration must be true`)
    if (
      !['actor', 'target', 'all-targets'].includes(operation.target) ||
      !validId(operation.formChoiceId) ||
      !['polymorph', 'true-polymorph', 'animal-shapes', 'shapechange'].includes(operation.profile) ||
      !finiteInteger(operation.durationRounds, 1, 5_256_000) ||
      operation.concentration !== true ||
      (operation.permanent === true && operation.permanentAfterConcentrationCompletes === true) ||
      (operation.maximumChallengeRating !== 'target-level-or-challenge-rating' &&
        operation.maximumChallengeRating !== 'target-half-level-or-challenge-rating' &&
        !finiteNumber(operation.maximumChallengeRating, 0, 30)) ||
      (operation.allowWillingShapechanger != null && typeof operation.allowWillingShapechanger !== 'boolean') ||
      (operation.hitPointMode != null && !['replace', 'retain-with-form-temporary-hp'].includes(operation.hitPointMode)) ||
      (operation.maximumSizeRank != null && !finiteInteger(operation.maximumSizeRank, 0, 5)) ||
      (operation.equipmentChoiceId != null && !validId(operation.equipmentChoiceId)) ||
      (operation.seenConfirmationChoiceId != null && !validId(operation.seenConfirmationChoiceId)) ||
      (operation.requiresExistingSourceActivityId != null && !validId(operation.requiresExistingSourceActivityId))
    ) errors.push(`${label} creature transformation is invalid`)
    return
  }
  if (operation.kind === 'invoke-activity') {
    if (!validId(operation.activityId)) errors.push(`${label}.activityId is invalid`)
    appendFormulaErrors(errors, operation.repeat, `${label}.repeat`)
    return
  }
  if (operation.kind === 'mechanic') {
    const parameters = operation.parameters ?? {}
    if (
      !validId(operation.handlerId) || !['actor', 'target', 'all-targets'].includes(operation.target) ||
      typeof parameters !== 'object' || Array.isArray(parameters) || Object.keys(parameters).length > 32 ||
      Object.entries(parameters).some(([key, value]) =>
        !validId(key) || !['string', 'number', 'boolean'].includes(typeof value) && value !== null ||
        typeof value === 'number' && !Number.isFinite(value) ||
        typeof value === 'string' && value.length > 10_000)
    ) errors.push(`${label} mechanic handler declaration is invalid`)
    return
  }
  if (operation.kind === 'narrative-prompt') {
    if (typeof operation.prompt !== 'string' || !operation.prompt.trim() || operation.prompt.length > 2000) errors.push(`${label}.prompt is invalid`)
    return
  }
  if (operation.kind === 'manual-adjudication' && (
    !operation.prompt.trim() || !operation.reason.trim() || operation.requiresDmApproval !== true
  )) {
    errors.push(`${label} is an invalid manual adjudication`)
    return
  }
  if (operation.kind !== 'manual-adjudication') errors.push(`${label}.kind is invalid`)
}

export function validateDnd5eActivityDefinitionV1(activity: Dnd5eActivityDefinitionV1): readonly string[] {
  // Imported JSON is untrusted despite the TypeScript annotation. In
  // particular, declarative subclass abilities are not Activity objects.
  if (!activity || typeof activity !== 'object' || Array.isArray(activity)) return ['activity must be an object']
  const shapeErrors: string[] = []
  const raw = activity as unknown as Record<string, unknown>
  if (activity.usesAttackActionAttack != null && (
    activity.usesAttackActionAttack !== true || activity.activation?.kind !== 'free' ||
    activity.target?.kind !== 'creature' || activity.target.count !== 1 || activity.spellInvocation ||
    activity.invocation?.kind === 'triggered' || activity.authorityBinding ||
    !Array.isArray(activity.checks) || activity.checks.some(check=>!check || typeof check!=='object') ||
    activity.checks.filter(check=>check.kind==='attack-roll').length !== 1 ||
    activity.checks.some(check=>check.kind==='attack-roll' && (check.perProjectile || check.scope !== 'per-target')) ||
    (activity.consumption != null && (!Array.isArray(activity.consumption) ||
      activity.consumption.some(cost=>!cost || cost.kind==='action-economy')))
  )) shapeErrors.push('activity.usesAttackActionAttack requires a free single-target attack with Host action budget')
  if (activity.equipmentHomingProjectile != null && (activity.equipmentHomingProjectile !== true || activity.target?.kind !== 'creature' || activity.target.count !== 1 || (!Array.isArray(activity.outcomes) || !activity.outcomes.some(outcome => Array.isArray(outcome?.operations) && outcome.operations.some((op: Dnd5eActivityOperationV1) => op?.kind === 'damage' && op.equipmentWeaponDamage))))) shapeErrors.push('activity.equipmentHomingProjectile requires one creature and Host equipment damage')
  if (activity.spellInvocation != null && (
    typeof activity.spellInvocation !== 'object' || Array.isArray(activity.spellInvocation) ||
    typeof activity.spellInvocation.spellId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(activity.spellInvocation.spellId) ||
    !Number.isSafeInteger(activity.spellInvocation.castAtLevel) || activity.spellInvocation.castAtLevel < 0 || activity.spellInvocation.castAtLevel > 9 ||
    !Array.isArray(activity.spellInvocation.operationIds) || activity.spellInvocation.operationIds.length === 0 ||
    new Set(activity.spellInvocation.operationIds).size !== activity.spellInvocation.operationIds.length ||
    !Array.isArray(activity.outcomes) || activity.spellInvocation.operationIds.some(id => typeof id !== 'string' ||
      !activity.outcomes.some(outcome => Array.isArray(outcome?.operations) && outcome.operations.some(operation => operation?.id === id))) ||
    (!['action','bonus-action','reaction'].includes(activity.activation?.kind) &&
      !(['minute','hour'].includes(activity.activation?.kind) && activity.invocation?.kind==='triggered' &&
        ['short-rest-complete','long-rest-complete'].includes(activity.invocation.event))) || activity.legacySource?.kind === 'spell'
  )) shapeErrors.push('activity.spellInvocation requires a registered spell reference, level and feature casting action')
  for (const key of ['activation', 'target', 'automation'] as const) {
    if (!raw[key] || typeof raw[key] !== 'object' || Array.isArray(raw[key])) shapeErrors.push(`activity.${key} must be an object`)
  }
  if (typeof activity.name !== 'string') shapeErrors.push('activity.name must be a string')
  if (activity.castingConstraints != null && (!validDnd5eCastingConstraints(activity.castingConstraints) ||
    activity.legacySource?.kind !== 'spell')) shapeErrors.push('activity.castingConstraints requires a valid spell casting constraint')
  if (activity.requiresEffectGrant != null && activity.requiresEffectGrant !== true) shapeErrors.push('activity.requiresEffectGrant must be true')
  if (activity.usableWhileIncapacitated != null && (activity.usableWhileIncapacitated !== true ||
    !isDnd5eAutonomousBoundHpRetaliation(activity) && (activity.activation?.kind !== 'free' || activity.target?.kind !== 'self' ||
    activity.invocation?.kind !== 'triggered' || !['self-dropped-to-zero', 'self-involuntarily-incapacitated'].includes(activity.invocation.event)))) {
    shapeErrors.push('activity.usableWhileIncapacitated requires a free self-drop trigger or automatic effect-granted bound-HP retaliation')
  }
  if (activity.endsGrantSourceConcentration != null &&
    (activity.endsGrantSourceConcentration !== true || activity.requiresEffectGrant !== true)) {
    shapeErrors.push('activity.endsGrantSourceConcentration requires requiresEffectGrant')
  }
  if (activity.effectGrantChargeCost != null && (!activity.requiresEffectGrant ||
    !Number.isSafeInteger(activity.effectGrantChargeCost) || activity.effectGrantChargeCost < 1 || activity.effectGrantChargeCost > 1000)) {
    shapeErrors.push('activity.effectGrantChargeCost requires requiresEffectGrant and an integer from 1 to 1000')
  }
  if (activity.concentrationRequiresEffect != null && activity.concentrationRequiresEffect !== true) shapeErrors.push('activity.concentrationRequiresEffect must be true')
  for (const key of ['checks', 'outcomes', 'requirements', 'choices', 'triggers', 'consumption', 'scaling', 'castLevelTargetProfiles'] as const) {
    const values = raw[key]
    if (values != null && (!Array.isArray(values) || values.some(value => !value || typeof value !== 'object' || Array.isArray(value)))) shapeErrors.push(`activity.${key} must be an array of objects`)
  }
  if (shapeErrors.length) return shapeErrors
  for (const [index, choice] of (activity.choices ?? []).entries()) {
    const path = `activity.choices[${index}]`
    if (typeof choice.label !== 'string') shapeErrors.push(`${path}.label must be a string`)
    if (!Array.isArray(choice.options)) shapeErrors.push(`${path}.options must be an array`)
    else for (const [optionIndex, option] of choice.options.entries()) {
      const optionPath = `${path}.options[${optionIndex}]`
      if (!option || typeof option !== 'object' || Array.isArray(option)) {
        shapeErrors.push(`${optionPath} must be an object`)
        continue
      }
      if (typeof option.label !== 'string') shapeErrors.push(`${optionPath}.label must be a string`)
      if (option.description != null && typeof option.description !== 'string') shapeErrors.push(`${optionPath}.description must be a string`)
      if (option.requirements != null && !Array.isArray(option.requirements)) shapeErrors.push(`${optionPath}.requirements must be an array`)
    }
  }
  if (shapeErrors.length) return shapeErrors
  const errors: string[] = validateDnd5eActivityContinuationV1(activity)
  if (activity.schemaVersion !== 1) errors.push('activity.schemaVersion is invalid')
  if (!validId(activity.id)) errors.push('activity.id is invalid')
  if (!activity.name.trim() || activity.name.length > 160) errors.push('activity.name is invalid')
  if (activity.legacySource && (
    !['spell', 'feature', 'feat', 'item', 'class', 'subclass', 'subclass-ability', 'race', 'background', 'monster', 'monster-action', 'custom-headless-action']
      .includes(activity.legacySource.kind) ||
    !validId(activity.legacySource.id) ||
    (activity.legacySource.magical != null && typeof activity.legacySource.magical !== 'boolean')
  )) errors.push('activity.legacySource is invalid')
  if (activity.authorityBinding) {
    const binding = activity.authorityBinding
    if (binding.kind === 'core-spell-transaction') {
      if (
        binding.execution !== 'headless-event-engine' || !validId(binding.spellId) ||
        activity.legacySource?.kind !== 'spell' || activity.legacySource.id !== binding.spellId
      ) errors.push('activity.authorityBinding is invalid')
    } else {
      const mechanicKinds = new Set([
      'combat-maneuver',
      'martial-spell-synergy',
      'rage-feature',
      'opening-attack',
      'hidden-spell-save-disadvantage',
      'utility-projection-control',
      'utility-projection-attack-advantage',
      'next-d20-advantage',
      'post-d20-adjustment',
      'missed-weapon-attack-reroll',
      'd20-choice-reroll',
      'post-spell-random-table',
      'post-spell-random-table-choice',
      'spell-damage-max-die-bonus',
      'persistent-companion',
      'companion-profile-upgrade',
      'creature-space-traversal',
      'environmental-movement',
      'persistent-projection-upgrade',
      'alternate-resource-spellcasting',
      'granted-die-combat-options',
      'attack-disadvantage-interrupt',
      'attack-retarget-interrupt',
      'critical-hit-cancellation',
      'missed-melee-redirection',
      'damage-mitigation-interrupt',
      'ward-pool',
      'spell-damage-resistance-aura',
      'source-condition-aura',
      'stored-d20-replacement',
      'attacks-per-action',
  'attack-action-defense',
  'attack-action-speed',
  'flurry-extra-attacks',
  'd20-disadvantage-negation',
      'weapon-damage-rider',
      'spell-damage-ability-modifier',
  'spell-healing-dice-maximum',
  'spell-range-minimum',
  'spell-optional-bonus-action',
      'spell-ability-check-bonus',
      'spell-interception',
      'spell-target-expansion',
      'damage-roll-maximization',
      'attack-tradeoff',
      'advantage-for-extra-attack',
      'passive-defense',
      'reaction-weapon-attack',
      'marked-target',
      'death-prevention',
      'spell-defeat-healing',
      'summoned-creature-bonus',
      'creature-form-eligibility',
      'creature-form-control',
      'bonus-weapon-attack',
      'turn-start-saving-throw-aura',
      ])
      const expectedSourceId = `${binding.subclassId}:${binding.abilityId}`
      const expectedActionId = `decl.${binding.subclassId}.${binding.abilityId}`
      if (
        !validId(binding.subclassId) || !validId(binding.abilityId) ||
        !mechanicKinds.has(binding.mechanicKind) ||
        !['plugin-headless-action', 'headless-event-engine'].includes(binding.execution)
      ) errors.push('activity.authorityBinding is invalid')
      if (activity.legacySource?.kind !== 'subclass-ability' || activity.legacySource.id !== expectedSourceId) {
        errors.push('activity.authorityBinding does not match legacySource')
      }
      if (binding.execution === 'plugin-headless-action' && binding.actionId !== expectedActionId) {
        errors.push('activity.authorityBinding actionId is invalid')
      }
      if (binding.execution === 'headless-event-engine' && binding.actionId != null) {
        errors.push('event-owned activity.authorityBinding cannot declare actionId')
      }
    }
  }
  validateInvocation(activity.invocation, errors)
  if (activity.invocation?.kind === 'triggered' && activity.invocation.releaseSingleUseGrantOnDecline &&
    !activity.requiresEffectGrant) errors.push('activity.invocation.releaseSingleUseGrantOnDecline requires requiresEffectGrant')
  if (activity.invocation?.kind === 'triggered' && activity.invocation.effectGrantScope &&
    !activity.requiresEffectGrant) errors.push('activity.invocation.effectGrantScope requires requiresEffectGrant')
  validateActivation(activity.activation, errors)
  validateTarget(activity.target, errors)
  const placementTargets = [activity.target, ...(activity.castLevelTargetProfiles ?? []).map(profile => profile.target),
    ...(activity.choices ?? []).flatMap(choice => choice.options.flatMap(option => option.targetOverride ? [option.targetOverride] : []))]
  if (placementTargets.some(target => target.kind === 'area' && target.placementQualification != null) && activity.legacySource?.kind !== 'spell') {
    errors.push('placementQualification currently requires a spell Activity with Host spell preparation')
  }
  if (activity.target.kind === 'creature' && activity.target.allowObjectAttack != null) {
    if (activity.target.allowObjectAttack !== true || activity.target.count !== 1 || activity.target.relation !== 'any' ||
        activity.target.requiresWilling || activity.target.roomCompanion || activity.target.requiresTargetSeeActor ||
        activity.checks?.length !== 1 || activity.checks[0].kind !== 'attack-roll' ||
        !activity.outcomes.length || activity.outcomes.some(outcome => outcome.operations.some(operation =>
          operation.kind !== 'damage' || operation.target !== 'target'))) {
      errors.push('activity.target.allowObjectAttack requires a single any-relation attack with target damage only')
    }
  }

  activity.castLevelTargetProfiles?.forEach((profile, index) => {
    if (!finiteInteger(profile.minimumCastLevel, 0, 9)) {
      errors.push(`activity.castLevelTargetProfiles[${index}].minimumCastLevel is invalid`)
    }
    validateTarget(profile.target, errors)
  })
  if (activity.castLevelTargetProfiles &&
    new Set(activity.castLevelTargetProfiles.map((profile) => profile.minimumCastLevel)).size !==
      activity.castLevelTargetProfiles.length) {
    errors.push('activity.castLevelTargetProfiles minimumCastLevel is duplicated')
  }
  errors.push(...validateAutomationCapability(activity.automation).map((error) => `activity.automation: ${error}`))

  const checkIds = new Set<string>()
  for (const [index, check] of (activity.checks ?? []).entries()) {
    const label = `activity.checks[${index}]`
    if (!validId(check.id) || checkIds.has(check.id)) errors.push(`${label}.id is invalid or duplicated`)
    checkIds.add(check.id)
    if (!validId(check.rollId)) errors.push(`${label}.rollId is invalid`)
    if (check.kind === 'opposed-ability-check') {
      if (check.tiesFavor != null && check.tiesFavor !== 'source' && check.tiesFavor !== 'target') errors.push(`${label}.tiesFavor is invalid`)
      if (!validId(check.opposedRollId) || check.opposedRollId === check.rollId) {
        errors.push(`${label}.opposedRollId is invalid`)
      }
      if (check.sourceAbility !== 'spellcasting' && !ABILITIES.has(check.sourceAbility)) errors.push(`${label}.sourceAbility is invalid`)
      if (check.sourceSkill != null && !SKILLS.some(skill => skill.key === check.sourceSkill)) errors.push(`${label}.sourceSkill is invalid`)
      if (check.sourceSkill != null && check.sourceModifier?.kind === 'reference' &&
        check.sourceModifier.reference.kind === 'actor-skill-check-modifier' &&
        check.sourceModifier.reference.skill !== check.sourceSkill) errors.push(`${label}.sourceSkill conflicts with skill modifier`)
      appendFormulaErrors(errors, check.sourceModifier, `${label}.sourceModifier`)
      if (!Array.isArray(check.targetOptions) || check.targetOptions.length < 1 ||
        check.targetOptions.length > 6 || check.targetOptions.some((option) =>
          !ABILITIES.has(option.ability) ||
          (option.skill != null && (!validId(option.skill) || option.skill.length > 80)))) {
        errors.push(`${label}.targetOptions is invalid`)
      }
      if (!['normal', 'advantage', 'disadvantage', 'host-derived'].includes(check.sourceRollMode ?? 'normal') ||
        !['normal', 'advantage', 'disadvantage', 'host-derived'].includes(check.targetRollMode ?? 'normal')) {
        errors.push(`${label}.roll mode is invalid`)
      }
      const sizeMode = check.sourceRollModeByTargetSizeRank
      if (sizeMode && (
        !['advantage', 'disadvantage'].includes(sizeMode.mode) ||
        (sizeMode.minimum == null && sizeMode.maximum == null) ||
        (sizeMode.minimum != null && !finiteInteger(sizeMode.minimum, 0, 5)) ||
        (sizeMode.maximum != null && !finiteInteger(sizeMode.maximum, 0, 5)) ||
        (sizeMode.minimum != null && sizeMode.maximum != null && sizeMode.minimum > sizeMode.maximum)
      )) errors.push(`${label}.sourceRollModeByTargetSizeRank is invalid`)
    }
    if ('ability' in check && !ABILITIES.has(check.ability)) errors.push(`${label}.ability is invalid`)
    if (check.kind === 'saving-throw' && check.advantageIfIllusionRecognized != null && (check.advantageIfIllusionRecognized !== true || check.rollMode !== 'host-derived')) errors.push(`${label}.advantageIfIllusionRecognized requires host-derived saves`)
    if (check.kind === 'saving-throw' && check.abilityOptions != null && !validAbilityOptions(check.abilityOptions, check.ability)) {
      errors.push(`${label}.abilityOptions is invalid`)
    }
    if (check.kind === 'saving-throw' && check.rollModeByCreatureType != null) {
      const override = check.rollModeByCreatureType
      if (
        !['advantage', 'disadvantage'].includes(override.mode) ||
        !Array.isArray(override.creatureTypes) || override.creatureTypes.length < 1 ||
        override.creatureTypes.length > 32 || override.creatureTypes.some((type) => typeof type !== 'string' || !type.trim() || type.length > 80) ||
        new Set(override.creatureTypes.map((type) => type.trim().toLocaleLowerCase())).size !== override.creatureTypes.length
      ) errors.push(`${label}.rollModeByCreatureType is invalid`)
    }
    if (check.kind === 'saving-throw' && check.rollModeByStatBlock != null) {
      const override = check.rollModeByStatBlock
      if (
        !['advantage', 'disadvantage'].includes(override.mode) ||
        !Array.isArray(override.statBlockIds) || override.statBlockIds.length < 1 ||
        override.statBlockIds.length > 32 || override.statBlockIds.some((id) =>
          typeof id !== 'string' || !id.trim() || id !== id.trim() || id.length > 200) ||
        new Set(override.statBlockIds).size !== override.statBlockIds.length
      ) errors.push(`${label}.rollModeByStatBlock is invalid`)
    }
    if (check.kind === 'saving-throw' && check.rollModeBySizeRank != null) {
      const override = check.rollModeBySizeRank
      if (
        !['advantage', 'disadvantage'].includes(override.mode) ||
        (override.minimum == null && override.maximum == null) ||
        (override.minimum != null && !finiteInteger(override.minimum, 0, 5)) ||
        (override.maximum != null && !finiteInteger(override.maximum, 0, 5)) ||
        (override.minimum != null && override.maximum != null && override.minimum > override.maximum)
      ) errors.push(`${label}.rollModeBySizeRank is invalid`)
    }
    if (check.kind === 'saving-throw' && check.excludedCreatureTypes != null && (
      check.scope !== 'per-target' || !Array.isArray(check.excludedCreatureTypes) || check.excludedCreatureTypes.length === 0 ||
      check.excludedCreatureTypes.length > 32 || check.excludedCreatureTypes.some(type => typeof type !== 'string' || !type.trim() || type.length > 80)
    )) errors.push(`${label}.excludedCreatureTypes requires bounded types and per-target scope`)
    if (check.kind === 'saving-throw' && check.environmentalHazard != null &&
      !['extreme-heat', 'extreme-cold'].includes(check.environmentalHazard)) errors.push(`${label}.environmentalHazard is invalid`)
    if (check.kind === 'saving-throw' && check.automaticSuccessIfConditionImmune != null &&
      !CONDITIONS.has(check.automaticSuccessIfConditionImmune)) {
      errors.push(`${label}.automaticSuccessIfConditionImmune is invalid`)
    }
    for (const key of ['automaticSuccessIfCannotHearSource', 'automaticSuccessIfNoSharedLanguage'] as const) {
      if (key in check && (check.kind !== 'saving-throw' || check[key] !== true || check.scope !== 'per-target')) {
        errors.push(`${label}.${key} requires a per-target saving throw and true`)
      }
    }
    if (check.kind === 'saving-throw' && check.allowWillingFailure != null && typeof check.allowWillingFailure !== 'boolean') errors.push(`${label}.allowWillingFailure is invalid`)
    if(check.kind==='saving-throw'&&check.modifierByChoice!=null){
      const tables=check.modifierByChoice
      if(!Array.isArray(tables)||tables.length<1||tables.length>16||tables.some((table,index)=>{
        if(!table||typeof table!=='object'||typeof table.choiceId!=='string'||tables.slice(0,index).some(prior=>prior?.choiceId===table.choiceId))return true
        const choice=Array.isArray(activity.choices)?activity.choices.find(candidate=>candidate?.id===table.choiceId):undefined
        if(!choice||choice.optionsFrom||!Array.isArray(choice.options)||!table.modifiers||typeof table.modifiers!=='object'||Array.isArray(table.modifiers))return true
        const entries=Object.entries(table.modifiers)
        return entries.length!==choice.options.length||choice.options.some((option:{id:string})=>!option||!Object.hasOwn(table.modifiers,option.id))||
          entries.some(([id,amount])=>!choice.options.some((option:{id:string})=>option?.id===id)||!Number.isSafeInteger(amount)||Math.abs(Number(amount))>100)
      }))errors.push(`${label}.modifierByChoice requires complete bounded modifiers for unique declared choices`)
    }
    if (check.kind === 'saving-throw' && check.automaticFailureIfCharmedByActor != null && check.automaticFailureIfCharmedByActor !== true) {
      errors.push(`${label}.automaticFailureIfCharmedByActor is invalid`)
    }
    if (check.kind === 'saving-throw' && check.automaticFailureIfAllied != null &&
      typeof check.automaticFailureIfAllied !== 'boolean') {
      errors.push(`${label}.automaticFailureIfAllied is invalid`)
    }
    if ('appliesWhenChoice' in check && check.appliesWhenChoice != null && (
      !validId(check.appliesWhenChoice.choiceId) ||
      !Array.isArray(check.appliesWhenChoice.optionIds) ||
      check.appliesWhenChoice.optionIds.length < 1 ||
      check.appliesWhenChoice.optionIds.length > 64 ||
      check.appliesWhenChoice.optionIds.some((optionId) => !validId(optionId)) ||
      new Set(check.appliesWhenChoice.optionIds).size !== check.appliesWhenChoice.optionIds.length
    )) errors.push(`${label}.appliesWhenChoice is invalid`)
    if ('perProjectile' in check && (check.perProjectile !== true ||
      !['attack-roll', 'saving-throw'].includes(check.kind) || check.scope !== 'per-target' ||
      activity.target.kind !== 'creature' || activity.target.allowDuplicateTargets !== true)) {
      errors.push(`${label}.perProjectile requires a per-target attack/save and explicit duplicate creature targets`)
    }
    if ('stopAfterFirstFailure' in check && (check.kind !== 'saving-throw' || check.scope !== 'per-target' || check.stopAfterFirstFailure !== true)) {
      errors.push(`${label}.stopAfterFirstFailure requires a per-target saving-throw and literal true`)
    }
    if (check.kind === 'saving-throw' && check.appliesWhenCheck != null && (
      !validId(check.appliesWhenCheck.checkId) ||
      check.appliesWhenCheck.result !== 'success'
    )) errors.push(`${label}.appliesWhenCheck is invalid`)
    // A misplaced gate must not silently turn a conditional roll into an unconditional one.
    if (check.kind !== 'saving-throw' && 'appliesWhenCheck' in check) {
      errors.push(`${label}.appliesWhenCheck requires a saving-throw check`)
    }
    if (check.kind !== 'random-roll') {
      for (const gate of ['appliesWhenSave', 'appliesWhenCheckTotal', 'minimumTargetSpeedFeet'] as const) {
        if (gate in check) errors.push(`${label}.${gate} requires a random-roll check`)
      }
    }
    if (check.kind === 'saving-throw' && check.rollModeIfOpposed != null &&
      !['advantage', 'disadvantage'].includes(check.rollModeIfOpposed)) {
      errors.push(`${label}.rollModeIfOpposed is invalid`)
    }
    if ('rollModeByHostFact' in check && check.rollModeByHostFact != null) {
      const fact=check.rollModeByHostFact as import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactV1
      if(check.kind!=='saving-throw'||typeof fact!=='object'||Array.isArray(fact)||
        !validId(fact.id)||typeof fact.label!=='string'||!fact.label.trim()||fact.label.length>500||
        !['advantage','disadvantage'].includes(fact.mode)||check.scope!=='per-target'){
        errors.push(`${label}.rollModeByHostFact requires a valid per-target saving-throw fact`)
      }
    }
    if (check.kind === 'opposed-ability-check') {
      // Validated above; unlike ordinary checks it has no static DC.
    } else if (check.kind === 'random-roll') {
      if (check.minimumTargetSpeedFeet != null && (check.scope !== 'per-target' ||
        !finiteNumber(check.minimumTargetSpeedFeet, 0, 1_000_000))) errors.push(`${label}.minimumTargetSpeedFeet requires per-target scope and a finite nonnegative threshold`)
      if (check.label != null && (!check.label.trim() || check.label.length > 160)) {
        errors.push(`${label}.label is invalid`)
      }
      if (!finiteInteger(check.count, 1, 100)) errors.push(`${label}.count is invalid`)
      if (!finiteInteger(check.sides, 2, 1_000)) errors.push(`${label}.sides is invalid`)
      if (check.modifier != null && !finiteInteger(check.modifier, -1_000_000, 1_000_000)) {
        errors.push(`${label}.modifier is invalid`)
      }
      if (check.rerollValues != null && (
        !Array.isArray(check.rerollValues) || check.rerollValues.length < 1 ||
        check.rerollValues.length >= check.sides ||
        check.rerollValues.some((value) => !finiteInteger(value, 1, check.sides)) ||
        new Set(check.rerollValues).size !== check.rerollValues.length
      )) errors.push(`${label}.rerollValues is invalid`)
      if (check.appliesWhenCheckTotal != null) {
        const gate = check.appliesWhenCheckTotal
        if (
          !validId(gate.checkId) ||
          (gate.minimum == null && gate.maximum == null) ||
          (gate.minimum != null && !finiteInteger(gate.minimum, -1_000_000, 1_000_000)) ||
          (gate.maximum != null && !finiteInteger(gate.maximum, -1_000_000, 1_000_000)) ||
          (gate.minimum != null && gate.maximum != null && gate.minimum > gate.maximum)
        ) errors.push(`${label}.appliesWhenCheckTotal is invalid`)
      }
    } else if (check.kind === 'attack-roll') {
      if (check.attackType != null && !['spell', 'weapon'].includes(check.attackType)) errors.push(`${label}.attackType is invalid`)
      appendFormulaErrors(errors, check.attackBonus, `${label}.attackBonus`)
      if (check.delivery != null && !['melee', 'ranged'].includes(check.delivery)) {
        errors.push(`${label}.delivery is invalid`)
      }
      if (!finiteInteger(check.criticalThreshold ?? 20, 1, 20)) errors.push(`${label}.criticalThreshold is invalid`)
    } else appendFormulaErrors(errors, check.dc, `${label}.dc`)
  }

  const choiceOptions = new Map<string, Set<string>>()
  let targetOverrideChoiceCount = 0
  for (const [index, choice] of (activity.choices ?? []).entries()) {
    const label = `activity.choices[${index}]`
    if (!validId(choice.id) || choiceOptions.has(choice.id)) errors.push(`${label}.id is invalid or duplicated`)
    if (!choice.label.trim() || choice.label.length > 160) errors.push(`${label}.label is invalid`)
    const optionIds = new Set<string>()
    if (choice.textInput != null && (typeof choice.textInput !== 'object' ||
      !finiteInteger(choice.textInput.maximumLength, 1, choice.textInput.format==='surface-drawing'?65536:160) ||
      Object.keys(choice.textInput).some(key => key !== 'maximumLength' && key !== 'maximumWords' && key !== 'format') ||
      (choice.textInput.maximumWords != null && (!finiteInteger(choice.textInput.maximumWords, 1, 160) || choice.textInput.format != null)) ||
      (choice.textInput.format != null && choice.textInput.format !== 'surface-drawing' && (choice.textInput.format !== 'hex-color' || choice.textInput.maximumLength !== 7)) ||
      choice.optionsFrom != null || !Array.isArray(choice.options) || choice.options.length !== 0 || choice.defaultOptionId != null)) {
      errors.push(`${label}.textInput requires a bounded length and no closed options`)
    }
    if (choice.optionsFrom != null && !['actor-languages', 'actor-hit-dice', 'actor-hit-die-count', 'srd-beast-forms', 'srd-monsters', 'installed-monsters', 'combat-creatures'].includes(choice.optionsFrom)) errors.push(`${label}.optionsFrom is invalid`)
    if (choice.optionsFrom === 'actor-hit-die-count') {
      if (![6, 8, 10, 12].includes(choice.hitDieSides as number)) errors.push(`${label}.hitDieSides is invalid`)
      if (!finiteInteger(choice.hitDieMaximumCount ?? 20, 0, 511)) errors.push(`${label}.hitDieMaximumCount is invalid`)
    } else if (choice.hitDieSides != null || choice.hitDieMaximumCount != null) errors.push(`${label}.hitDieSides/hitDieMaximumCount require actor-hit-die-count`)
    if (choice.monsterFilter != null) {
      const filter = choice.monsterFilter
      if (!['srd-monsters', 'installed-monsters'].includes(choice.optionsFrom ?? '') || typeof filter !== 'object' || Array.isArray(filter)) {
        errors.push(`${label}.monsterFilter is invalid`)
      } else {
        if (filter.creatureTypes != null && !normalizePersistentAreaCreatureTypes(filter.creatureTypes)) errors.push(`${label}.monsterFilter.creatureTypes is invalid`)
        if (filter.subtype != null && (typeof filter.subtype !== 'string' || !filter.subtype.trim() || filter.subtype.length > 80)) errors.push(`${label}.monsterFilter.subtype is invalid`)
        if (filter.maximumChallengeRating != null && (typeof filter.maximumChallengeRating !== 'number' || !Number.isFinite(filter.maximumChallengeRating) || filter.maximumChallengeRating < 0 || filter.maximumChallengeRating > 30)) errors.push(`${label}.monsterFilter.maximumChallengeRating is invalid`)
      }
    }
    if (choice.dmSelection != null) {
      const selection = choice.dmSelection
      const check = activity.checks?.find(check => check.id === selection.afterCheckId)
      const bands = selection.challengeRatingByTotal
      if (!['srd-monsters', 'installed-monsters'].includes(choice.optionsFrom ?? '') ||
        choice.defaultOptionId != null || !check || check.kind !== 'random-roll' || check.scope !== 'shared' || check.count !== 1 ||
        !Array.isArray(bands) || bands.length < 1 || bands.length > 100) {
        errors.push(`${label}.dmSelection requires a shared single-die monster choice`)
      } else {
        let next = 1 + (check.modifier ?? 0)
        for (const band of bands) {
          if (!band || !Number.isSafeInteger(band.minimum) || !Number.isSafeInteger(band.maximum) ||
            band.minimum !== next || band.maximum < band.minimum || !Number.isFinite(band.maximumChallengeRating) ||
            band.maximumChallengeRating < 0 || band.maximumChallengeRating > 30) errors.push(`${label}.dmSelection has an invalid roll band`)
          next = (band?.maximum ?? NaN) + 1
        }
        if (next !== check.sides + (check.modifier ?? 0) + 1) errors.push(`${label}.dmSelection must cover every die result exactly once`)
      }
    }
    if (!Array.isArray(choice.options) || (!choice.optionsFrom && !choice.textInput && choice.options.length < 1) || choice.options.length > 512) {
      errors.push(`${label}.options is invalid`)
    } else for (const [optionIndex, option] of choice.options.entries()) {
      const optionLabel = `${label}.options[${optionIndex}]`
      if (!validId(option.id) || optionIds.has(option.id)) errors.push(`${optionLabel}.id is invalid or duplicated`)
      if (!option.label.trim() || option.label.length > 160 || (option.description?.length ?? 0) > 1_000) {
        errors.push(`${optionLabel}.label or description is invalid`)
      }
      option.requirements?.forEach((requirement: Dnd5ePredicateV1, requirementIndex: number) =>
        validatePredicate(requirement, `${optionLabel}.requirements[${requirementIndex}]`, errors))
      if (option.targetOverride) validateTarget(option.targetOverride, errors)
      optionIds.add(option.id)
    }
    if (choice.options.some((option) => option.targetOverride != null)) targetOverrideChoiceCount += 1
    if (choice.optionsFrom === 'actor-hit-dice') {
      const canonical = ['hit-die:d6', 'hit-die:d8', 'hit-die:d10', 'hit-die:d12']
      if (choice.options.some(option => !canonical.includes(option.id) || option.requirements != null || option.targetOverride != null)) errors.push(`${label}.options must use plain canonical Hit Die pool IDs`)
      canonical.forEach(id => optionIds.add(id))
    }
    if (choice.optionsFrom === 'actor-hit-die-count') {
      const maximum = choice.hitDieMaximumCount ?? 20
      if (choice.options.some(option => !/^(0|[1-9]\d*)$/.test(option.id) || !Number.isSafeInteger(Number(option.id)) || Number(option.id) > maximum || option.requirements != null || option.targetOverride != null)) errors.push(`${label}.options must use plain bounded integer-string quantity IDs`)
      if (finiteInteger(maximum, 0, 511)) for (let count = 0; count <= maximum; count++) optionIds.add(String(count))
    }
    if (choice.defaultOptionId != null && !optionIds.has(choice.defaultOptionId)) errors.push(`${label}.defaultOptionId is invalid`)
    choiceOptions.set(choice.id, optionIds)
  }
  if (targetOverrideChoiceCount > 1) {
    errors.push('activity choices may declare targetOverride in only one choice')
  }
  for (const [index, check] of (activity.checks ?? []).entries()) {
    const choiceGate = 'appliesWhenChoice' in check
      ? check.appliesWhenChoice
      : undefined
    if (choiceGate && Array.isArray(choiceGate.optionIds) && !choiceGate.optionIds.every((optionId: string) =>
      choiceOptions.get(choiceGate.choiceId)?.has(optionId) === true)) {
      errors.push(`activity.checks[${index}].appliesWhenChoice references an unknown choice option`)
    }
    if (check.kind === 'saving-throw' && check.appliesWhenCheck) {
      const prerequisiteIndex = (activity.checks ?? []).findIndex((candidate) =>
        candidate.id === check.appliesWhenCheck!.checkId)
      if (
        prerequisiteIndex < 0 || prerequisiteIndex >= index ||
        activity.checks?.[prerequisiteIndex]?.kind !== 'attack-roll'
      ) errors.push(`activity.checks[${index}].appliesWhenCheck must reference an earlier attack check`)
    }
    if (check.kind === 'random-roll' && check.appliesWhenCheckTotal) {
      const prerequisiteIndex = (activity.checks ?? []).findIndex((candidate) =>
        candidate.id === check.appliesWhenCheckTotal!.checkId)
      const prerequisite = prerequisiteIndex < 0 ? undefined : activity.checks?.[prerequisiteIndex]
      if (
        prerequisiteIndex < 0 || prerequisiteIndex >= index ||
        prerequisite?.kind !== 'random-roll' || prerequisite.scope !== check.scope
      ) errors.push(`activity.checks[${index}].appliesWhenCheckTotal must reference an earlier random check with the same scope`)
    }
    if (check.kind === 'random-roll' && check.appliesWhenSave != null) {
      const gate = check.appliesWhenSave
      const priorIndex = (activity.checks ?? []).findIndex(candidate => candidate.id === gate.checkId)
      const prior = activity.checks?.[priorIndex]
      if (!validId(gate.checkId) || !['success', 'failure'].includes(gate.result) ||
        check.scope !== 'per-target' || priorIndex < 0 || priorIndex >= index ||
        prior?.kind !== 'saving-throw' || prior.scope !== 'per-target') {
        errors.push(`activity.checks[${index}].appliesWhenSave must reference an earlier per-target save and success/failure`)
      }
    }
  }
  const validateWhen = (when: Dnd5eActivityDefinitionV1['outcomes'][number]['when'], label: string): void => {
    if (!when || typeof when !== 'object') { errors.push(`${label} is invalid`); return }
    if (when.kind === 'always') return
    if (when.kind === 'all' && !Array.isArray(when.conditions)) { errors.push(`${label}.conditions is invalid`); return }
    const conditions = when.kind === 'all' ? when.conditions : [when]
    if (when.kind === 'all' && (conditions.length < 2 || conditions.length > 8)) errors.push(`${label}.conditions is invalid`)
    for (const condition of conditions) {
      if (!condition || !['check', 'check-total', 'choice', 'predicate'].includes(condition.kind)) {
        errors.push(`${label} contains an unknown outcome condition`)
        continue
      }
      if (condition.kind === 'check' && !checkIds.has(condition.checkId)) errors.push(`${label} references an unknown check`)
      if (condition.kind === 'check' && !['success', 'failure', 'critical-success', 'critical-failure'].includes(condition.result)) errors.push(`${label}.result is invalid`)
      if (condition.kind === 'check-total') {
        if (!checkIds.has(condition.checkId)) errors.push(`${label} references an unknown check`)
        if (
          (condition.minimum == null && condition.maximum == null) ||
          (condition.minimum != null && !finiteInteger(condition.minimum, -1_000_000, 1_000_000)) ||
          (condition.maximum != null && !finiteInteger(condition.maximum, -1_000_000, 1_000_000)) ||
          (condition.minimum != null && condition.maximum != null && condition.minimum > condition.maximum)
        ) errors.push(`${label}.check-total range is invalid`)
      }
      if (condition.kind === 'choice' && !choiceOptions.get(condition.choiceId)?.has(condition.optionId)) {
        errors.push(`${label} references an unknown choice option`)
      }
      if (condition.kind === 'predicate') validatePredicate(condition.predicate, `${label}.predicate`, errors)
    }
  }

  const outcomeIds = new Set<string>()
  const damageGroupIds = new Set<string>()
  const operationIds = new Set<string>()
  const effectById = new Map((activity.effects ?? []).map((effect) => [effect.id, effect]))
  for (const [outcomeIndex, outcome] of activity.outcomes.entries()) {
    const label = `activity.outcomes[${outcomeIndex}]`
    if (!validId(outcome.id) || outcomeIds.has(outcome.id)) errors.push(`${label}.id is invalid or duplicated`)
    outcomeIds.add(outcome.id)
    const groups = new Map<string, number[]>()
    for (const [index, op] of (outcome.operations ?? []).entries()) {
      if (op.kind !== 'damage' || !op.damageGroup) continue
      const indices = groups.get(op.damageGroup.id) ?? []
      indices.push(index); groups.set(op.damageGroup.id, indices)
      if (activity.target.kind !== 'creature' || activity.target.count !== 1 || op.target !== 'target' ||
        op.perProjectile || op.perTarget || op.critical === 'double-dice' || op.damageSource || op.cannotBeReduced ||
        op.destroysBodyOnDeath || op.destroysBodyPartOnDeath ||
        (op.equipmentWeaponDamage?.multiplier != null && op.equipmentWeaponDamage.multiplier !== 1) ||
        activity.checks?.some(check => check.kind !== 'saving-throw')) errors.push(`${label} damage groups require one creature and unscaled save damage`)
    }
    for (const [groupId, indices] of groups) {
      if (damageGroupIds.has(groupId)) errors.push(`${label} damage group ids must be unique across outcomes`)
      damageGroupIds.add(groupId)
      if (indices.length < 2 || indices.length > 16 || indices.some((index, offset) => index !== indices[0] + offset)) errors.push(`${label} damage group components must be adjacent (2..16)`)
      const first = outcome.operations[indices[0]]
      if (first.kind !== 'damage') continue
      for (const index of indices) {
        const op = outcome.operations[index]
        if (op.kind === 'damage' && (op.damageGroup?.multiplier !== first.damageGroup?.multiplier || op.magical !== first.magical)) errors.push(`${label} damage group sources and multipliers must match`)
      }
      const ids = indices.map(index => outcome.operations[index].id)
      if (activity.outcomes.some(candidate => candidate.operations.some(op => op.kind === 'healing' && op.damageResult && ids.includes(op.damageResult.operationId)))) errors.push(`${label} grouped damage cannot be referenced as an independent healing result`)
    }

    validateWhen(outcome.when, `${label}.when`)
    if (!outcome.operations.length && !activity.authorityBinding) errors.push(`${label}.operations is empty`)
    outcome.operations.forEach((operation, operationIndex) => {
      const operationLabel = `${label}.operations[${operationIndex}]`
      validateOperation(operation, operationLabel, errors)
      if (operation.kind === 'recognize-granting-disguise' && (!activity.requiresEffectGrant || activity.target.kind !== 'creature' || activity.target.count !== 1)) errors.push(`${operationLabel} requires a granted single-creature activity`)
      if (operation.kind === 'create-persistent-area' && operation.effectToken?.followSelectedTarget &&
        activity.target.kind === 'creature' && activity.target.count !== 1) {
        errors.push(`${operationLabel}.followSelectedTarget requires exactly one creature`)
      }
      if (operation.kind === 'create-persistent-area' && operation.effectToken?.remotePlacement &&
        (activity.target.kind !== 'self' || (activity.requiresEffectGrant !== true && !dnd5eRestSpellSensorActivity(activity)) ||
          activity.outcomes.length !== 1 || outcome.operations.length !== 1 || outcome.when.kind !== 'always')) {
        errors.push(`${operationLabel}.remotePlacement requires a self-targeted granted or timed rest spell Activity with one unconditional sensor operation`)
      }
      if (operation.kind === 'affect-persistent-entity' &&
        (activity.target.kind !== 'area' || activity.target.origin !== 'point' || outcome.when.kind !== 'always')) {
        errors.push(`${operationLabel} requires point placement and an unconditional outcome`)
      }
      if (operation.kind === 'create-persistent-area' && operation.ignitesUnattendedFuel != null &&
        (operation.ignitesUnattendedFuel !== true || activity.target.kind !== 'area' ||
          activity.target.heightFeet == null || !finiteNumber(activity.target.heightFeet, 1, 100_000))) {
        errors.push(`${operationLabel} persistent fuel ignition requires true and explicit area height`)
      }
      if (operation.kind === 'extinguish-area-flames' && (activity.target.kind !== 'area' || activity.target.shape !== 'rect' ||
        activity.target.heightFeet == null)) errors.push(`${operationLabel} extinguishing requires a rectangular area with explicit height`)
      if (operation.kind === 'ignite-area-fuel' && (activity.target.kind !== 'area' ||
        activity.target.heightFeet == null || !finiteNumber(activity.target.heightFeet, 1, 100_000))) {
        errors.push(`${operationLabel} fuel ignition requires an area with explicit height`)
      }
      if (operation.kind === 'create-persistent-area' && operation.labelTextChoiceId != null &&
        !activity.choices?.some(choice => choice.id === operation.labelTextChoiceId && choice.textInput != null)) {
        errors.push(`${operationLabel}.labelTextChoiceId must reference a bounded text input`)
      }
      if (operation.kind === 'create-persistent-area' && operation.colorTextChoiceId != null &&
        !activity.choices?.some(choice => choice.id === operation.colorTextChoiceId && choice.textInput?.format === 'hex-color')) {
        errors.push(`${operationLabel}.colorTextChoiceId must reference a hex-color input`)
      }
      if (operation.kind === 'create-persistent-area' && operation.drawingTextChoiceId != null &&
        !activity.choices?.some(choice => choice.id === operation.drawingTextChoiceId && choice.textInput?.format === 'surface-drawing')) {
        errors.push(`${operationLabel}.drawingTextChoiceId must reference a surface-drawing input`)
      }
      if (operation.kind === 'transfer-loose-earth') {
        const targets = [activity.target, ...(activity.choices ?? []).flatMap(choice => choice.options.flatMap(option => option.targetOverride ? [option.targetOverride] : []))]
        if (!targets.some(target => target.kind === 'area' && target.origin === 'point' && target.rotatable)) errors.push(`${operationLabel} requires a rotatable point area`)
      }
      if (operation.kind === 'launch-map-object') {
        const check = activity.checks?.find(candidate => candidate.id === operation.savingThrowCheckId)
        if (operation.harmlessPush === true) {
          const targets = [activity.target, ...(activity.choices ?? []).flatMap(choice => choice.options.flatMap(option => option.targetOverride ? [option.targetOverride] : []))]
          if (!targets.some(target => target.kind === 'area' && target.origin === 'point')) errors.push(`${operationLabel} harmless push requires point placement`)
        } else if (activity.target.kind !== 'area' || activity.target.origin !== 'point' || activity.target.shape !== 'rect' || !activity.target.rotatable ||
          check?.kind !== 'saving-throw' || !check.stopAfterFirstFailure || outcome.when.kind !== 'always') {
          errors.push(`${operationLabel} requires a rotatable point rectangle, an ordered save and an unconditional outcome`)
        }
      }
      if (operation.kind === 'create-persistent-area' && operation.directionalMovementCost &&
        (activity.target.kind !== 'area' || !['rect', 'cube'].includes(activity.target.shape))) {
        errors.push(`${operationLabel}.directionalMovementCost requires a rect/cube area target`)
      }
      if (operation.kind === 'change-granting-area-mode' && operation.modeChoiceId &&
        !activity.choices?.some(choice => choice.id === operation.modeChoiceId)) errors.push(`${operationLabel}.modeChoiceId is unknown`)
      if (operation.kind === 'create-persistent-area' && operation.modes) {
        const choice = activity.choices?.find(choice => choice.id === operation.initialModeChoiceId)
        if (operation.initialModeChoiceId && (!choice || choice.options.some(option => !operation.modes!.some(mode => mode.id === option.id)))) errors.push(`${operationLabel}.initialModeChoiceId has unknown modes`)
        if (operation.modes.some(mode => mode.directionalMovementCost) &&
          (activity.target.kind !== 'area' || !['rect', 'cube'].includes(activity.target.shape))) errors.push(`${operationLabel}.modes directional cost requires a rect/cube area target`)
      }
      if ('perProjectile' in operation && (operation.kind !== 'damage' || operation.perProjectile !== true ||
        operation.target !== 'target' || activity.target.kind !== 'creature' || activity.target.allowDuplicateTargets !== true)) {
        errors.push(`${operationLabel}.perProjectile requires target damage and explicit duplicate creature targets`)
      }
      if ('perTarget' in operation && (operation.kind !== 'damage' || operation.perTarget !== true ||
        operation.target !== 'target' || operation.perProjectile || activity.target.kind !== 'creature' ||
        activity.target.allowDuplicateTargets === true)) {
        errors.push(`${operationLabel}.perTarget requires damage to distinct creature targets`)
      }
      if(operation.kind==='reaction-follow'){
        const damage=outcome.operations[0],push=outcome.operations[1]
        if(activity.invocation?.kind!=='triggered'||activity.invocation.event!=='attack-hit'||activity.activation.kind!=='free'||
          activity.target.kind!=='creature'||activity.target.count!==1||activity.target.allowDuplicateTargets||
          activity.outcomes.length!==1||outcome.when.kind!=='always'||outcome.operations.length!==3||operationIndex!==2||
          damage?.kind!=='damage'||damage.target!=='target'||damage.damageType!=='inherit-primary'||
          push?.kind!=='move'||push.mode!=='push'||push.target!=='target'||push.id!==operation.pushOperationId||
          activity.scaling?.length||activity.checks?.length||activity.effects?.length||activity.choices?.length)
          errors.push(`${operationLabel} requires inherited hit damage, target push, then optional reaction follow`)
      }
      if (operation.kind === 'secondary-weapon-damage') {
        const prior = outcome.operations.slice(0, operationIndex).find(candidate => candidate.id === operation.damageOperationId)
        if (activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'attack-hit' || activity.activation.kind !== 'free' ||
          activity.target.kind !== 'creature' || activity.target.count !== 1 || activity.target.allowDuplicateTargets ||
          activity.outcomes.length !== 1 || outcome.when.kind !== 'always' || outcome.operations.length !== 2 || operationIndex !== 1 ||
          prior?.kind !== 'damage' || prior.target !== 'target' || prior.damageType !== 'inherit-primary' || prior.amount.kind !== 'dice' || prior.amount.count !== 1 ||
          prior.magical != null || activity.scaling?.length || activity.checks?.length || activity.effects?.length || activity.choices?.length) {
          errors.push(`${operationLabel} requires a single-die inherited weapon hit followed by optional secondary damage`)
        }
      }
      if (operation.kind === 'damage' && operation.weaponDiceFromTrigger &&
        (activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'attack-hit' ||
          activity.checks?.some(check => check.kind === 'attack-roll'))) errors.push(`${operationLabel}.weaponDiceFromTrigger requires attack-hit invocation without a new attack roll`)
      if (operation.kind === 'move' && operation.directionOrigin === 'area-center' && (
        activity.target.kind !== 'area' || ['line', 'cone'].includes(activity.target.shape)
      )) errors.push(`${operationLabel}.directionOrigin area-center requires a centered area target`)
      if (operation.kind === 'healing' && operation.damageResult) {
        const dependency = outcome.operations.slice(0, operationIndex).filter(prior => prior.id === operation.damageResult!.operationId)
        if (dependency.length !== 1 || dependency[0].kind !== 'damage' || dependency[0].target !== operation.damageResult.subject) {
          errors.push(`${operationLabel}.damageResult must reference an earlier damage operation for the declared subject in the same outcome`)
        }
      }
      if (operation.kind === 'healing' && operation.recipientChoice && (
        activity.target.kind !== 'creature' || activity.target.count !== 1 || activity.target.effectOrigin != null ||
        !activity.choices?.some(choice => choice.id === operation.recipientChoice!.choiceId && choice.optionsFrom === 'combat-creatures')
      )) errors.push(`${operationLabel}.recipientChoice requires one creature target and a combat-creatures choice without a remote origin`)
      if (operation.kind === 'summon' && operation.afterDamageKillOperationId) {
        const dependency = outcome.operations.slice(0, operationIndex).filter(prior => prior.id === operation.afterDamageKillOperationId)
        if (dependency.length !== 1 || dependency[0].kind !== 'damage' || dependency[0].target !== 'target' || activity.target.kind !== 'creature') {
          errors.push(`${operationLabel}.afterDamageKillOperationId must reference earlier target damage in the same creature outcome`)
        }
      }
      if ((operation.kind === 'alter-inventory-item' || operation.kind === 'grant-inventory-item' && !operation.reuseSourceEffect) && operation.sourceEffectId != null && !effectById.has(operation.sourceEffectId)) {
        errors.push(`${operationLabel}.sourceEffectId references an unknown effect`)
      }
      if (operation.kind==='summon' && operation.corpseFormChoiceId && !choiceOptions.has(operation.corpseFormChoiceId)) errors.push(`${operationLabel}.corpseFormChoiceId references an unknown choice`)
      if (operation.kind==='summon' && operation.monsterChoiceId && !choiceOptions.has(operation.monsterChoiceId)) errors.push(`${operationLabel}.monsterChoiceId references an unknown choice`)
      if (operation.kind === 'transform-creature' && !choiceOptions.has(operation.formChoiceId)) {
        errors.push(`${operationLabel}.formChoiceId references an unknown choice`)
      }
      if (operation.kind === 'temporary-hit-points' && operation.sourceEffectId != null && !effectById.has(operation.sourceEffectId)) errors.push(`${operationLabel}.sourceEffectId references an unknown effect`)
      if (operation.kind === 'reduce-hit-point-maximum' && !effectById.has(operation.owningEffectId)) errors.push(`${operationLabel}.owningEffectId references an unknown effect`)
      if (operation.kind === 'transfer-hit-point-maximum') {
        if (!effectById.has(operation.owningEffectId)) errors.push(`${operationLabel}.owningEffectId references an unknown effect`)
        if (!effectById.has(operation.beneficiaryEffectId)) errors.push(`${operationLabel}.beneficiaryEffectId references an unknown effect`)
        if (operation.protectLinkedLifetime && [operation.owningEffectId, operation.beneficiaryEffectId].some(id => {
          const owner = effectById.get(id)
          return !owner || owner.duration.kind !== 'permanent' || owner.concentration || owner.conditions?.length || owner.extensionCondition || owner.modifiers?.length || owner.sourceLink
        })) errors.push(`${operationLabel}.protectLinkedLifetime requires independent permanent marker effects`)
      }
      if (operation.kind === 'enchant-map-weapon' && !effectById.has(operation.effectId)) errors.push(`${operationLabel} references an unknown ground weapon effect`)
      if (operation.kind === 'apply-effect') {
        if (operation.captureTargetIdentity && (activity.target.kind !== 'creature' || activity.target.count !== 1)) errors.push(`${operationLabel}.captureTargetIdentity requires one creature target`)
        if (operation.disguiseFromGrant && !activity.requiresEffectGrant) errors.push(`${operationLabel}.disguiseFromGrant requires an effect grant`)
        if (operation.timing && (activity.activation.kind !== 'reaction' || activity.invocation?.kind !== 'triggered' || activity.invocation.event !== 'before-damage' || operation.target !== 'actor')) errors.push(`${operationLabel}.timing requires a personal before-damage reaction`)
        const effect = effectById.get(operation.effectId)
        if (operation.charmedSourceChoiceId != null && (
          !activity.choices?.some(choice => choice.id === operation.charmedSourceChoiceId && choice.optionsFrom === 'combat-creatures') ||
          effect?.conditions?.length !== 1 || effect.conditions[0] !== 'charmed' ||
          effect.tags?.some(tag => tag.startsWith('condition-entity:'))
        )) errors.push(`${operationLabel}.charmedSourceChoiceId requires a creature choice and a charmed-only effect`)
        if (operation.frightenedSourceChoiceId != null && (
          !activity.choices?.some(choice => choice.id === operation.frightenedSourceChoiceId && choice.optionsFrom === 'combat-creatures') ||
          effect?.conditions?.length !== 1 || effect.conditions[0] !== 'frightened' ||
          effect.tags?.some(tag => tag.startsWith('condition-entity:'))
        )) errors.push(`${operationLabel}.frightenedSourceChoiceId requires a creature choice and a frightened-only effect`)
        if (!effect) errors.push(`${operationLabel}.effectId references an unknown effect`)
        if (effect?.triggers?.length) {
          errors.push(`${operationLabel} references an effect with nested runtime triggers`)
        }
        if (effect && !['replace', 'refresh-duration', 'stack', 'unique-by-source'].includes(effect.stacking)) {
          errors.push(`${operationLabel} references an effect with an unsupported runtime stacking mode`)
        }
        for (const modifier of effect?.modifiers ?? []) {
          const supported =
            (modifier.kind === 'armor-class' && modifier.mode === 'add') ||
            modifier.kind === 'attacks-against-source-armor-class' ||
            modifier.kind === 'attacks-by-source-critical-threshold' ||
            modifier.kind === 'damage-rolls-by-source-bonus' ||
            (modifier.kind === 'attack-roll' && (modifier.mode === 'advantage' || modifier.mode === 'disadvantage')) ||
            modifier.kind === 'weapon-attack-roll' ||
            modifier.kind === 'weapon-attacks-against-target' ||
            modifier.kind === 'attacks-against-target' ||
            modifier.kind === 'attacks-against-target-by-creature-type' ||
            modifier.kind === 'speed-after-own-turn-weapon-attack' ||
            modifier.kind === 'prevent-movement-opportunity-attacks' ||
            modifier.kind === 'cannot-be-surprised-while-conscious' ||
            modifier.kind === 'revival-prevention' ||
            modifier.kind === 'next-d20-advantage' ||
            modifier.kind === 'perceive-visible-creatures-as-hostile' ||
            modifier.kind === 'mandatory-opportunity-attacks' ||
            modifier.kind === 'random-visible-creature-targets' ||
            modifier.kind === 'speed' ||
            modifier.kind === 'ability-check' ||
            modifier.kind === 'perception-target-lock' ||
            modifier.kind === 'skill-check-bonus-aura' ||
            modifier.kind === 'minimum-ability-check-d20' ||
            modifier.kind === 'saving-throw' ||
            modifier.kind === 'death-saving-throw' || modifier.kind === 'maximize-healing-dice' ||
            modifier.kind === 'healing-prevention' ||
            modifier.kind === 'optional-bonus-die' || modifier.kind === 'roll-dice' ||
            modifier.kind === 'own-turn-attack-action-bonus' || modifier.kind === 'attack-action-minimum' || modifier.kind === 'equipment-proficiency' || modifier.kind === 'saving-throw-proficiency' || modifier.kind === 'skill-expertise' ||
            modifier.kind === 'damage-resistance' ||
            modifier.kind === 'suppress-damage-resistance' ||
            modifier.kind === 'conditional-damage-resistance' ||
            modifier.kind === 'next-source-or-ally-attack-vulnerability' ||
            modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability' ||
            modifier.kind === 'attack-target-lock' ||
            modifier.kind === 'condition-immunity' ||
            modifier.kind === 'condition-immunity-by-source-creature-type' ||
            modifier.kind === 'saving-throw-advantage-by-source-creature-type' ||
            modifier.kind === 'condition-immunity-by-source-magic' ||
            modifier.kind === 'prohibit-reaction' ||
            modifier.kind === 'prevent-actions' ||
            modifier.kind === 'prevent-rest-benefits' ||
            modifier.kind === 'forced-flee-from-source' ||
            modifier.kind === 'maximum-attacks-per-turn' ||
            modifier.kind === 'restricted-extra-action' ||
            modifier.kind === 'darkvision' || modifier.kind === 'climb-speed' || modifier.kind === 'swim-speed' ||
            modifier.kind === 'sight-range-limit' || modifier.kind === 'truesight' || modifier.kind === 'spell-targeting-immunity' || modifier.kind === 'see-invisible' || modifier.kind === 'darkvision-concealment' ||
            modifier.kind === 'emitted-light' ||
            modifier.kind === 'language-capability' ||
            modifier.kind === 'language-restriction' ||
            modifier.kind === 'attack-decoys' ||
            modifier.kind === 'planar-phase' ||
            modifier.kind === 'solid-material-traversal' ||
            modifier.kind === 'source-location-awareness' ||
            modifier.kind === 'tracking-capability' ||
            modifier.kind === 'environmental-capability' ||
            modifier.kind === 'spell-save-disadvantage-aura' || modifier.kind === 'spell-action-as-bonus-action' ||
            modifier.kind === 'flight-speed-limit' || modifier.kind === 'flight-speed' || modifier.kind === 'magically-held-aloft' || modifier.kind === 'safe-fall' || modifier.kind === 'controlled-descent' || modifier.kind === 'automatic-escape' || modifier.kind === 'ignore-magical-speed-reductions' || modifier.kind === 'action-restriction' || modifier.kind === 'attack-profile' ||
            modifier.kind === 'hit-point-maximum' ||
            modifier.kind === 'on-hit-bonus-damage' ||
            modifier.kind === 'weapon-damage-multiplier' ||
            modifier.kind === 'armor-enchantment' || modifier.kind === 'weapon-enchantment' || modifier.kind === 'weapon-damage-replacement' ||
            modifier.kind === 'movement-boundary-save'
          if (!supported) errors.push(`${operationLabel} references an effect modifier that runtime application does not support: ${modifier.kind}`)
          const formulas =
            modifier.kind === 'armor-class' || modifier.kind === 'speed' || modifier.kind === 'weapon-damage-roll' || modifier.kind === 'hit-point-maximum'
              ? [modifier.value]
              : modifier.kind === 'armor-enchantment' ? [modifier.armorClassBonus]
              : modifier.kind === 'weapon-enchantment'
                ? [modifier.attackAndDamageBonus, ...(modifier.attackUses ? [modifier.attackUses] : [])]
              : modifier.kind === 'movement-boundary-save'
                ? [modifier.dc]
              : (modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value
                ? [modifier.value]
                : modifier.kind === 'damage-reduction' || modifier.kind === 'on-hit-bonus-damage'
                  ? modifier.amount.kind === 'weapon-dice' ? [] : [modifier.amount]
                  : []
          const sharedDamageDice = modifier.kind === 'armor-class' && modifier.mode === 'add' && operation.target === 'actor' &&
            collectDnd5eFormulaRollDeclarations(formulas).every(die => outcome.operations.slice(0, operationIndex).some(previous =>
              previous.kind === 'damage' && collectDnd5eFormulaRollDeclarations([previous.amount]).some(shared =>
                shared.id === die.id && shared.count === die.count && shared.sides === die.sides)))
          if (
            modifier.kind !== 'hit-point-maximum' && modifier.kind !== 'on-hit-bonus-damage' &&
            formulas.some(formulaContainsDice) && !sharedDamageDice
          ) {
            errors.push(`${operationLabel} references an applied effect with dice-based modifiers`)
          }
        }
        if (effect?.duration.kind === 'save-ends' && formulaContainsDice(effect.duration.dc)) {
          errors.push(`${operationLabel} references an applied effect with a dice-based save DC`)
        }
      }
      if (operationIds.has(operation.id)) errors.push(`${operationLabel}.id is duplicated`)
      operationIds.add(operation.id)
    })
  }
  if (!activity.outcomes.length) errors.push('activity.outcomes is empty')

  for (const [index, consumption] of (activity.consumption ?? []).entries()) {
    const label = `activity.consumption[${index}]`
    if (!consumption || typeof consumption !== 'object' || Array.isArray(consumption)) {
      errors.push(`${label} is invalid`)
      continue
    }
    if (!['action-economy', 'spell-slot', 'resource', 'item-charge', 'ammo', 'hit-die', 'hp', 'movement'].includes(consumption.kind)) {
      errors.push(`${label}.kind is invalid`)
      continue
    }
    const timings = consumption.kind === 'resource' ? ['confirm', 'hit', 'resolve', 'dm-approval'] :
      ['item-charge', 'ammo', 'hit-die'].includes(consumption.kind) ? ['confirm', 'hit', 'resolve'] : ['confirm', 'resolve']
    if (!timings.includes(consumption.consumeOn)) errors.push(`${label}.consumeOn is invalid`)
    if (consumption.kind === 'action-economy' || consumption.kind === 'spell-slot') {
      if (consumption.amount !== 1) errors.push(`${label}.amount must be 1`)
      if (consumption.kind === 'action-economy' && !['action', 'bonus-action', 'reaction'].includes(consumption.economy)) {
        errors.push(`${label}.economy is invalid`)
      }
      if (consumption.kind === 'spell-slot' && (consumption.level !== 'selected' ||
        !Number.isInteger(consumption.minimumLevel) || consumption.minimumLevel < 1 || consumption.minimumLevel > 9)) {
        errors.push(`${label}.level or minimumLevel is invalid`)
      }
    } else {
      appendFormulaErrors(errors, consumption.amount, `${label}.amount`)
    }
    if (['resource', 'item-charge', 'ammo', 'hit-die'].includes(consumption.kind) && !('resourceId' in consumption)) {
      errors.push(`${label}.resourceId is required`)
    }
    if ('resourceId' in consumption && !(validId(consumption.resourceId) || isDnd5eLegacyCoreResourceId(consumption.resourceId))) errors.push(`${label}.resourceId is invalid`)
    if (consumption.kind === 'hit-die' && !/^hit-die:d(6|8|10|12)$/.test(consumption.resourceId as string)) {
      errors.push(`${label}.resourceId must identify a Hit Die pool (hit-die:d6/d8/d10/d12)`)
    }
    if ((consumption.kind === 'hit-die' || consumption.kind === 'resource') && consumption.whenChoice != null) {
      const guard = consumption.whenChoice
      const choice = activity.choices?.find(choice => choice.id === guard.choiceId)
      if (!choice || !Array.isArray(guard.optionIds) || guard.optionIds.length < 1 ||
        new Set(guard.optionIds).size !== guard.optionIds.length ||
        guard.optionIds.some(optionId => !choiceOptions.get(guard.choiceId)?.has(optionId))) {
        errors.push(`${label}.whenChoice must reference declared choice options`)
      }
    }
    if (consumption.kind === 'hit-die' && consumption.maximumTotalFraction != null && (
      typeof consumption.maximumTotalFraction !== 'number' || !Number.isFinite(consumption.maximumTotalFraction) ||
      consumption.maximumTotalFraction <= 0 || consumption.maximumTotalFraction > 1
    )) errors.push(`${label}.maximumTotalFraction must be greater than zero and at most one`)
    if (consumption.kind === 'item-charge' && consumption.itemTemplateIds != null && (
      !Array.isArray(consumption.itemTemplateIds) || consumption.itemTemplateIds.length < 1 || consumption.itemTemplateIds.length > 64 ||
      consumption.itemTemplateIds.some((id) => !validId(id)) ||
      new Set(consumption.itemTemplateIds).size !== consumption.itemTemplateIds.length
    )) errors.push(`${label}.itemTemplateIds is invalid`)
  }
  for (const choice of activity.choices ?? []) {
    if (choice.optionsFrom !== 'actor-hit-die-count') continue
    const maximum = choice.hitDieMaximumCount ?? 20
    if (!finiteInteger(maximum, 0, 511)) continue
    const costs = (activity.consumption ?? []).filter(cost => cost.kind === 'hit-die' && cost.whenChoice?.choiceId === choice.id)
    for (let count = 0; count <= maximum; count++) {
      const selected = costs.filter(cost => cost.kind === 'hit-die' && Array.isArray(cost.whenChoice?.optionIds) && cost.whenChoice.optionIds.includes(String(count)))
      if (count === 0 ? selected.length !== 0 : selected.length !== 1 || selected[0].kind !== 'hit-die' || selected[0].resourceId !== `hit-die:d${choice.hitDieSides}` || selected[0].amount.kind !== 'constant' || selected[0].amount.value !== count) {
        errors.push(`choice ${choice.id} quantity ${count} must bind exactly its declared Hit Die cost (zero binds none)`)
      }
    }
  }
  activity.requirements?.forEach((predicate, index) => validatePredicate(predicate, `activity.requirements[${index}]`, errors))
  activity.effects?.forEach((effect, index) => validateEffect(effect, `activity.effects[${index}]`, errors))
  for(const effect of activity.effects??[]){
    if(effect?.duration?.kind!=='save-ends')continue
    const dc=effect.duration.dc
    if(dc?.kind==='reference'&&dc.reference?.kind==='actor-active-effect-source-spell-save-dc'&&dc.reference.effectId===effect.id&&
      !activity.requirements?.some(requirement=>requirement.kind==='active-effect'&&requirement.subject==='actor'&&requirement.effectId===effect.id&&requirement.present)){
      errors.push(`effect ${effect.id} duration DC cannot read its own not-yet-existing effect; use actor-spell-save-dc when creating it, or require the existing actor effect for a granted follow-up`)
    }
  }
  activity.triggers?.forEach((trigger, index) => validateTrigger(trigger, `activity.triggers[${index}]`, errors))
  activity.scaling?.forEach((scaling, index) => {
    const label = `activity.scaling[${index}]`
    if (!scaling || typeof scaling !== 'object' || Array.isArray(scaling)) {
      errors.push(`${label} must be an object`)
      return
    }
    if (!['character-level', 'class-level', 'slot-level', 'proficiency-bonus', 'ability-modifier', 'custom-table'].includes(scaling.basis)) errors.push(`${label}.basis is invalid`)
    if (scaling.basis === 'ability-modifier' && !ABILITIES.has(scaling.ability!)) errors.push(`${label}.ability is invalid`)
    if (scaling.ability != null && scaling.basis !== 'ability-modifier') errors.push(`${label}.ability requires ability-modifier basis`)
    if ((scaling.basis === 'class-level' || scaling.classId != null) && !validId(scaling.classId)) errors.push(`${label}.classId is invalid`)
    if (scaling.table != null && scaling.basis !== 'custom-table') errors.push(`${label}.table requires basis custom-table; other bases use linear steps and ignore tables`)
    if (scaling.basis === 'custom-table') {
      if (!Array.isArray(scaling.table) || scaling.table.length === 0) errors.push(`${label}.table must contain numeric step values`)
      else {
        let previousLevel = 0
        scaling.table.forEach((entry, row) => {
          if (!entry || !finiteInteger(entry.level, previousLevel + 1, 20) || !finiteInteger(entry.value, 0, 100)) errors.push(`${label}.table[${row}] must have increasing levels and nonnegative integer step values`)
          if (entry && typeof entry.level === 'number') previousLevel = entry.level
        })
      }
    }
    if (scaling.adjustments != null && !Array.isArray(scaling.adjustments)) errors.push(`${label}.adjustments must be an array`)
    else scaling.adjustments?.forEach((adjustment, row) => {
      // Native core spell adapters retain a synthetic target/projectile count
      // receipt; the native transaction owns those operations. Imported
      // ordinary Activities must still reference real local operations.
      const nativeTargetReceipt = activity.authorityBinding?.kind === 'core-spell-transaction' &&
        adjustment?.operationId === 'host-settlement' &&
        Object.keys(adjustment).every(key => ['operationId', 'additionalTargetsPerStep', 'additionalProjectilesPerStep'].includes(key))
      if (!adjustment || (!operationIds.has(adjustment.operationId) && !nativeTargetReceipt)) errors.push(`${label}.adjustments[${row}].operationId must reference an operation in this Activity, not another Activity`)
      if (adjustment?.diceSidesPerStep != null) {
        const prefix = `${label}.adjustments[${row}].diceSidesPerStep`
        if (!finiteInteger(adjustment.diceSidesPerStep, 0, 100)) errors.push(`${prefix} must be a nonnegative integer at most 100`)
        const operation = activity.outcomes.flatMap(outcome => outcome.operations).find(operation => operation.id === adjustment.operationId)
        const formulaDice = (formula: Dnd5eFormulaV1) => collectDnd5eFormulaRollDeclarations([formula]).length > 0
        const effect = operation?.kind === 'apply-effect' ? activity.effects?.find(effect => effect.id === operation.effectId) : undefined
        const hasFormula = operation && 'amount' in operation && formulaDice(operation.amount)
        const effectDice = effect && (effect.periodicDamage || (effect.duration.kind === 'save-ends' && effect.duration.damageOnFailure) ||
          effect.modifiers?.some(modifier => (modifier.kind === 'on-hit-bonus-damage' || modifier.kind === 'damage-reduction') &&
            modifier.amount.kind !== 'weapon-dice' && formulaDice(modifier.amount)))
        const areaDice = operation?.kind === 'create-persistent-area' && operation.triggers?.some(trigger => trigger.damage || trigger.healing?.dice)
        if (!hasFormula && !effectDice && !areaDice && !(operation?.kind === 'revive' && formulaDice(operation.hitPoints))) errors.push(`${prefix} requires declared dice on the referenced operation or effect`)
        if ((operation?.kind === 'damage' && (operation.weaponDiceFromTrigger || operation.damageTypeFromRoll)) ||
          effect?.modifiers?.some(modifier => modifier.kind === 'on-hit-bonus-damage' && modifier.amount.kind === 'weapon-dice')) {
          errors.push(`${prefix} cannot resize authoritative weapon dice or damage-type lookup dice`)
        }
      }
    })
    if (scaling.maximumSteps != null && !finiteInteger(scaling.maximumSteps, 0, 100)) {
      errors.push(`activity.scaling[${index}].maximumSteps is invalid`)
    }
    if (
      scaling.areaRadiusFeetPerStep != null &&
      (!Number.isFinite(scaling.areaRadiusFeetPerStep) || scaling.areaRadiusFeetPerStep < 0 || scaling.areaRadiusFeetPerStep > 10_000)
    ) {
      errors.push(`activity.scaling[${index}].areaRadiusFeetPerStep is invalid`)
    }
  })

  // Schema v1 keeps `automation` only for Legacy import/export compatibility.
  // Runtime coverage is derived from operations and registered Host handlers.
  if (errors.length === 0) {
    const operations = activity.outcomes.flatMap(outcome => outcome.operations)
    if (operations.some(operation => operation.kind === 'damage' && operation.damageSource === 'grant-source') && !activity.requiresEffectGrant) {
      errors.push('activity grant-source damage requires requiresEffectGrant')
    }
    const rolls = collectDnd5eFormulaRollDeclarations(operations.flatMap(operation =>
      operation.kind === 'damage' ? [operation.amount] : []))
    for (const operation of operations) {
      if (operation.kind === 'damage' && operation.damageTypeChoiceId != null) {
        const choice = activity.choices?.find(choice => choice.id === operation.damageTypeChoiceId)
        if (!choice || choice.optionsFrom != null || choice.options.length === 0 || choice.options.some(option => !DAMAGE_TYPES.has(option.id) || option.targetOverride != null)) {
          errors.push(`operation ${operation.id} damageTypeChoiceId must reference damage-type choice options`)
        }
      }
      if (operation.kind !== 'damage' || !operation.damageTypeFromRoll) continue
      const mapping = operation.damageTypeFromRoll
      const roll = rolls.find(roll => roll.id === mapping.rollId)
      const choice = activity.choices?.find(choice => choice.id === mapping.indexChoiceId)
      if (!roll || roll.sides !== mapping.types.length || !choice || choice.options.some(option =>
        !/^(0|[1-9][0-9]*)$/.test(option.id) || Number(option.id) >= roll.count || option.targetOverride != null)) {
        errors.push(`operation ${operation.id} damage type mapping must reference declared dice and valid index choices: indexChoiceId options must use zero-based integer-string ids ("0", "1", ...), each below the referenced dice count; named ids such as first-d8 are not indices, and types.length must equal die sides`)
      }
    }
  }
  const qualificationTargets = [activity.target, ...(activity.choices ?? []).flatMap(choice => choice.options.flatMap(option => option.targetOverride ? [option.targetOverride] : []))]
  for (const target of qualificationTargets) {
    if (target.kind !== 'creature' || !Array.isArray(target.requiredQualifications)) continue
    for (const qualification of target.requiredQualifications) {
      if (!qualification?.whenChoice) continue
      const choice = activity.choices?.find(choice => choice.id === qualification.whenChoice!.choiceId)
      if (!choice || !Array.isArray(qualification.whenChoice.optionIds) || qualification.whenChoice.optionIds.some((id: string) => !choice.options.some(option => option.id === id))) {
        errors.push('activity.target.requiredQualifications.whenChoice references unknown options')
      }
    }
  }
  return errors
}
import { normalizeDnd5eRollDiceModifiers } from '../rollDiceModifiers'
import { normalizeDnd5ePersistentAreaSourceLimit } from '../persistentAreaSourceLimit'
