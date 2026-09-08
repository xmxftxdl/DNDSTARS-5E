import {
  validateAutomationCapability,
  type AutomationPhase,
} from '../../../domain/automation/automationCapability'
import type { AbilityKey } from '../../../lib/dnd'
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
import { validateDnd5eFormulaV1, type Dnd5eFormulaV1 } from './dnd5eFormula'
import { isDnd5eTrackableDefinitionIdV1 } from './dnd5eActivityIdentity'
import type { Dnd5eSpellbookSchoolId } from '../spellbook'
import {
  normalizeDnd5ePersistentAreaGrantedActivity,
  normalizeDnd5ePersistentAreaBlocking,
  normalizeDnd5ePersistentAreaOccupantModifiers,
  normalizeDnd5ePersistentAreaTurnLifecycle,
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
    if (invocation.confirmation != null && !['actor-choice', 'dm-approval'].includes(invocation.confirmation)) {
      errors.push('activity.invocation.confirmation is invalid')
    }
    return
  }
  if (!TRIGGER_EVENTS.has(invocation.event)) errors.push('activity.invocation.event is invalid')
  if (!['automatic', 'actor-choice', 'target-choice', 'dm-approval'].includes(invocation.confirmation)) {
    errors.push('activity.invocation.confirmation is invalid')
  }
  if (invocation.retention != null && ![
    'single-event', 'until-triggered', 'until-turn-end', 'until-round-end',
  ].includes(invocation.retention)) errors.push('activity.invocation.retention is invalid')
}

function validatePredicate(predicate: Dnd5ePredicateV1, label: string, errors: string[]): void {
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
  if (predicate.kind === 'target-identity') {
    if (!['self', 'other'].includes(predicate.identity)) errors.push(`${label}.identity is invalid`)
    return
  }
  if (predicate.kind === 'owned-companion') {
    if (predicate.subject !== 'target') errors.push(`${label}.subject is invalid`)
    return
  }
  if (predicate.kind === 'can-hear-source') return
  if (predicate.kind === 'active-effect') {
    if (!validId(predicate.effectId) || !['actor', 'target'].includes(predicate.subject) ||
      !['any', 'self'].includes(predicate.source) || typeof predicate.present !== 'boolean') {
      errors.push(`${label} active-effect selector is invalid`)
    }
    return
  }
  if (predicate.kind === 'resource-capacity') {
    if (!validId(predicate.resourceId)) errors.push(`${label}.resourceId is invalid`)
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
  if (predicate.kind === 'attack-proficiency') {
    if (typeof predicate.proficient !== 'boolean') errors.push(`${label}.proficient is invalid`)
    return
  }
  if (predicate.kind === 'attack-weapon') {
    if (
      predicate.weaponIds.length < 1 || predicate.weaponIds.length > 64 ||
      predicate.weaponIds.some((id) => !validId(id)) ||
      new Set(predicate.weaponIds).size !== predicate.weaponIds.length
    ) errors.push(`${label}.weaponIds is invalid`)
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
  if (predicate.kind === 'movement-distance') {
    if (predicate.minimumFeet != null && !finiteNumber(predicate.minimumFeet, 0, 100_000)) errors.push(`${label}.minimumFeet is invalid`)
    if (predicate.maximumFeet != null && !finiteNumber(predicate.maximumFeet, 0, 100_000)) errors.push(`${label}.maximumFeet is invalid`)
    if (predicate.minimumFeet != null && predicate.maximumFeet != null && predicate.minimumFeet > predicate.maximumFeet) {
      errors.push(`${label} range is inverted`)
    }
    return
  }
  if (predicate.kind === 'movement-property') {
    if (
      (predicate.straightLine == null && predicate.dashedThisTurn == null) ||
      (predicate.straightLine != null && typeof predicate.straightLine !== 'boolean') ||
      (predicate.dashedThisTurn != null && typeof predicate.dashedThisTurn !== 'boolean')
    ) errors.push(`${label} movement property is invalid`)
    return
  }
  if (predicate.kind === 'spell-used') {
    if (predicate.spellId != null && !validId(predicate.spellId)) errors.push(`${label}.spellId is invalid`)
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
  if (duration.kind === 'instantaneous' || duration.kind === 'permanent') return
  if (duration.kind === 'rounds') {
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
  if (effect.schemaVersion !== 1) errors.push(`${label}.schemaVersion is invalid`)
  if (!validId(effect.id)) errors.push(`${label}.id is invalid`)
  if (effect.exclusiveGroup != null && !validId(effect.exclusiveGroup)) errors.push(`${label}.exclusiveGroup is invalid`)
  if (!effect.name.trim() || effect.name.length > 160) errors.push(`${label}.name is invalid`)
  if (effect.disposition != null && !['buff', 'debuff'].includes(effect.disposition)) {
    errors.push(`${label}.disposition is invalid`)
  }
  if (effect.tags != null && (
    effect.tags.length < 1 || effect.tags.length > 32 ||
    new Set(effect.tags).size !== effect.tags.length || effect.tags.some((tag) => !validId(tag) || tag.length > 80)
  )) errors.push(`${label}.tags is invalid`)
  if (effect.grants != null && (
    effect.grants.length < 1 || effect.grants.length > 32 ||
    new Set(effect.grants).size !== effect.grants.length ||
    effect.grants.some((activityId) => !validId(activityId))
  )) errors.push(`${label}.grants is invalid`)
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
  if (effect.extensionCondition != null && !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(effect.extensionCondition)) {
    errors.push(`${label}.extensionCondition is invalid`)
  }
  if (effect.breakOn?.some((trigger) => ![
    'takes-damage', 'targeted-by-spell', 'targeted-by-attack', 'hit-by-attack', 'makes-attack',
    'casts-spell', 'moves', 'spends-action', 'spends-bonus-action', 'spends-reaction',
    'awakened', 'magical-healing', 'reduced-to-zero', 'short-rest-complete', 'long-rest-complete',
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
      link.sourceMustBeConsciousAndAbleToSpeak !== true
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
  }
  if (effect.breakOn && new Set(effect.breakOn).size !== effect.breakOn.length) {
    errors.push(`${label}.breakOn is duplicated`)
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
      removal.economy !== 'action' ||
      !Number.isFinite(removal.maxDistanceFeet) ||
      removal.maxDistanceFeet < 0 || removal.maxDistanceFeet > 10_000 ||
      (removal.abilityCheck != null && (
        !ABILITIES.has(removal.abilityCheck.ability) ||
        (removal.abilityCheck.skill != null && removal.abilityCheck.skill !== 'medicine')
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
  for (const [index, modifier] of (effect.modifiers ?? []).entries()) {
    const modifierLabel = `${label}.modifiers[${index}]`
    if (
      modifier.kind === 'armor-class' || modifier.kind === 'speed' ||
      modifier.kind === 'hit-point-maximum' ||
      ((modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value) ||
      modifier.kind === 'weapon-damage-roll'
    ) appendFormulaErrors(errors, modifier.value, `${modifierLabel}.value`)
    if (modifier.kind === 'weapon-enchantment') {
      appendFormulaErrors(errors, modifier.attackAndDamageBonus, `${modifierLabel}.attackAndDamageBonus`)
      if (
        !['main-hand', 'off-hand'].includes(modifier.weaponSlot) ||
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
      appendFormulaErrors(errors, modifier.amount, `${modifierLabel}.amount`)
    }
    if (modifier.kind === 'saving-throw' && modifier.ability && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (modifier.kind === 'death-saving-throw' && modifier.mode !== 'advantage') {
      errors.push(`${modifierLabel} death saving throw mode is invalid`)
    }
    if (modifier.kind === 'attack-target-lock' && modifier.attacksAgainstOthersThanSource !== 'disadvantage') {
      errors.push(`${modifierLabel} attack target lock is invalid`)
    }
    if (modifier.kind === 'attacks-against-target' &&
      modifier.mode !== 'advantage' && modifier.mode !== 'disadvantage') {
      errors.push(`${modifierLabel} attacks-against-target mode is invalid`)
    }
    if (modifier.kind === 'attacks-against-source-armor-class' &&
      !finiteInteger(modifier.bonus, -20, 20)) {
      errors.push(`${modifierLabel} attacks-against-source armor class bonus is invalid`)
    }
    if (modifier.kind === 'saving-throw-proficiency' && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (modifier.kind === 'ability-check' && (
      (modifier.ability != null && !ABILITIES.has(modifier.ability)) ||
      (modifier.skill != null && (!validId(modifier.skill) || modifier.skill.length > 80))
    )) errors.push(`${modifierLabel} ability-check selector is invalid`)
    if (modifier.kind === 'perception-target-lock' &&
      modifier.disadvantageAgainstOthersThanSource !== true) {
      errors.push(`${modifierLabel} perception target lock is invalid`)
    }
    if (modifier.kind === 'skill-check-bonus-aura' && (
      !validId(modifier.skill) || modifier.skill.length > 80 ||
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
      (modifier.kind === 'damage-resistance' || modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability') &&
      modifier.damageType !== 'all' && !DAMAGE_TYPES.has(modifier.damageType)
    ) errors.push(`${modifierLabel}.damageType is invalid`)
    if (modifier.kind === 'conditional-damage-resistance' && (
      modifier.damageTypes.length < 1 ||
      new Set(modifier.damageTypes).size !== modifier.damageTypes.length ||
      modifier.damageTypes.some((type) => !DAMAGE_TYPES.has(type)) ||
      (modifier.sourceMagical != null && typeof modifier.sourceMagical !== 'boolean') ||
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
      const validValue = expectsNumber
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
      !['ethereal', 'terrain'].includes(modifier.plane) ||
      typeof modifier.ignoresMaterialCollision !== 'boolean' ||
      modifier.suppressCrossPlaneEffects !== true ||
      typeof modifier.unrestrictedVerticalMovement !== 'boolean' ||
      (modifier.plane === 'ethereal' && (!modifier.ignoresMaterialCollision || !modifier.unrestrictedVerticalMovement)) ||
      (modifier.plane === 'terrain' && (modifier.ignoresMaterialCollision || modifier.unrestrictedVerticalMovement))
    )) errors.push(`${modifierLabel} planar phase is invalid`)
    if (modifier.kind === 'tracking-capability' && (
      modifier.mundaneTracking !== 'impossible' || modifier.leavesTracks !== false
    )) errors.push(`${modifierLabel} tracking capability is invalid`)
    if (modifier.kind === 'environmental-capability' && (
      (modifier.breatheIn != null && (
        modifier.breatheIn.length !== 1 || modifier.breatheIn[0] !== 'water')) ||
      (modifier.treatLiquidSurfacesAsSolidGround != null &&
        modifier.treatLiquidSurfacesAsSolidGround !== true) ||
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
    if (modifier.kind === 'climb-speed' && modifier.mode !== 'walking-speed') {
      errors.push(`${modifierLabel}.mode is invalid`)
    }
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
      modifier.endsOnLanding !== true
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
      (modifier.reachBonusFeet == null && modifier.damageTypeOverride == null)
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
      if (!delayedDamageFormulaSupported(modifier.amount)) {
        errors.push(`${modifierLabel}.amount must be one additive delayed damage pool`)
      }
    }
    if (modifier.kind === 'death-prevention' && !finiteInteger(modifier.hitPointsAfter, 1, 1_000_000)) {
      errors.push(`${modifierLabel}.hitPointsAfter is invalid`)
    }
    if ('resourceId' in modifier && modifier.resourceId != null && !validId(modifier.resourceId)) errors.push(`${modifierLabel}.resourceId is invalid`)
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
  if (formula.kind === 'floor' || formula.kind === 'ceil' || formula.kind === 'round' || formula.kind === 'clamp') {
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
  if (target.kind === 'creature') {
    if (!finiteInteger(target.count, 1, 256)) errors.push('activity.target.count is invalid')
    if (target.rangeFeet != null && !finiteNumber(target.rangeFeet, 0, 100_000)) errors.push('activity.target.rangeFeet is invalid')
    if (target.minimumRangeFeet != null && !finiteNumber(target.minimumRangeFeet, 0, 100_000)) {
      errors.push('activity.target.minimumRangeFeet is invalid')
    }
    if (
      target.rangeFeet != null && target.minimumRangeFeet != null &&
      target.minimumRangeFeet > target.rangeFeet
    ) errors.push('activity.target range is inverted')
    return
  }
  if (!finiteInteger(target.maximumTargets, 1, 256)) errors.push('activity.target.maximumTargets is invalid')
  if (!['self', 'point', 'event-target'].includes(target.origin)) errors.push('activity.target.origin is invalid')
  if (target.excludeEventTarget != null && typeof target.excludeEventTarget !== 'boolean') {
    errors.push('activity.target.excludeEventTarget is invalid')
  }
  if (target.origin !== 'event-target' && target.excludeEventTarget != null) {
    errors.push('activity.target.excludeEventTarget requires event-target origin')
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
  if (target.instanceCount != null && !finiteInteger(target.instanceCount, 1, 64)) {
    errors.push('activity.target.instanceCount is invalid')
  }
  if (target.minimumInstanceCount != null && (
    !finiteInteger(target.minimumInstanceCount, 1, 64) || target.instanceCount == null ||
    target.minimumInstanceCount > target.instanceCount
  )) errors.push('activity.target.minimumInstanceCount is invalid')
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
    const minimum = field === 'radiusFeet' ? 0 : 1
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
    // A circular portal may have a half-cell radius (Gate's printed 5-foot
    // minimum diameter is a 2.5-foot radius). Other adjustable templates stay
    // on the normal five-foot grid.
    const step = minimumField === 'minimumRadiusFeet' && minimum != null && minimum % 5 !== 0 ? 2.5 : 5
    if (minimum != null && (maximum == null || minimum > maximum || minimum % step !== 0 || maximum % step !== 0)) {
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
    target.shape === 'line'
  )) {
    errors.push('only lines and point-origin rectangles may rotate freely')
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
  if (!validId(operation.id)) errors.push(`${label}.id is invalid`)
  if (operation.kind === 'damage') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    if (operation.damageType !== 'inherit-primary' && !DAMAGE_TYPES.has(operation.damageType)) {
      errors.push(`${label}.damageType is invalid`)
    }
    return
  }
  if (operation.kind === 'healing' || operation.kind === 'temporary-hit-points') {
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
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
  if (operation.kind === 'stand-up') {
    if (operation.usesTargetReactionIfAvailable !== true) errors.push(`${label}.usesTargetReactionIfAvailable is invalid`)
    return
  }
  if (operation.kind === 'apply-standard-condition') {
    if (!CONDITIONS.has(operation.condition)) errors.push(`${label}.condition is invalid`)
    validateDuration(operation.duration, `${label}.duration`, errors)
    return
  }
  if (operation.kind === 'apply-effect') {
    if (!validId(operation.effectId)) errors.push(`${label}.effectId is invalid`)
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
    if (!validId(operation.resourceId)) errors.push(`${label}.resourceId is invalid`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    return
  }
  if (operation.kind === 'move') {
    if (!['push', 'pull', 'teleport', 'swap', 'ascend', 'descend'].includes(operation.mode)) errors.push(`${label}.mode is invalid`)
    if (operation.placement != null && operation.placement !== 'host-automatic-maximum') {
      errors.push(`${label}.placement is invalid`)
    }
    if (operation.placement === 'host-automatic-maximum' && !['push', 'pull'].includes(operation.mode)) {
      errors.push(`${label}.placement requires push or pull`)
    }
    if (operation.verticalDestination != null && !['area-top', 'ground'].includes(operation.verticalDestination)) {
      errors.push(`${label}.verticalDestination is invalid`)
    }
    if (operation.verticalDestination === 'area-top' && operation.mode !== 'ascend') {
      errors.push(`${label}.verticalDestination area-top requires ascend`)
    }
    if (operation.verticalDestination === 'ground' && operation.mode !== 'descend') {
      errors.push(`${label}.verticalDestination ground requires descend`)
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
    if (operation.ignoresOpportunityAttacks != null && typeof operation.ignoresOpportunityAttacks !== 'boolean') errors.push(`${label}.ignoresOpportunityAttacks is invalid`)
    if (operation.usesActorMovement != null && typeof operation.usesActorMovement !== 'boolean') {
      errors.push(`${label}.usesActorMovement is invalid`)
    }
    if (operation.usesActorMovement === true && !['ascend', 'descend'].includes(operation.mode)) {
      errors.push(`${label}.usesActorMovement requires vertical movement`)
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
  if (operation.kind === 'reshape-granting-area') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (operation.maximumFeet) appendFormulaErrors(errors, operation.maximumFeet, `${label}.maximumFeet`)
    return
  }
  if (operation.kind === 'set-granting-area-senses') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (!['source', 'projection'].includes(operation.mode)) errors.push(`${label}.mode is invalid`)
    return
  }
  if (operation.kind === 'detonate-granting-area') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    return
  }
  if (operation.kind === 'grant-inventory-item') {
    if (operation.target !== 'actor') errors.push(`${label}.target must be actor`)
    if (!validId(operation.templateId)) errors.push(`${label}.templateId is invalid`)
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
    if (!['actor', 'target', 'all-targets'].includes(operation.target)) errors.push(`${label}.target is invalid`)
    if (!['clone-receptacle', 'linked-planar-object', 'soul-vessel', 'terrain-merge', 'simulacrum-companion'].includes(operation.recordKind)) {
      errors.push(`${label}.recordKind is invalid`)
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
      operation.medium !== 'magical-whisper' ||
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
  if (operation.kind === 'recover-hit-point-maximum') {
    if (operation.maximumCount != null && !finiteInteger(operation.maximumCount, 1, 32)) {
      errors.push(`${label}.maximumCount is invalid`)
    }
    return
  }
  if (operation.kind === 'instant-death') return
  if (operation.kind === 'summon') {
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
    if (!finiteInteger(operation.durationRounds, 1, 10_000)) errors.push(`${label}.durationRounds is invalid`)
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
    if (operation.shareSelfSpellsRangeFeet != null &&
      !finiteInteger(operation.shareSelfSpellsRangeFeet, 5, 10_000)) {
      errors.push(`${label}.shareSelfSpellsRangeFeet is invalid`)
    }
    if (operation.dismissAfterDamageRounds != null &&
      !finiteInteger(operation.dismissAfterDamageRounds, 1, 10_000)) {
      errors.push(`${label}.dismissAfterDamageRounds is invalid`)
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
  if (operation.kind === 'command-owned-companion') {
    if (operation.target !== 'target' || !['attack', 'dash', 'disengage', 'dodge', 'help'].includes(operation.command)) {
      errors.push(`${label} companion command is invalid`)
    }
    return
  }
  if (operation.kind === 'grant-weapon-attack') {
    const invalidIds = (values: readonly string[] | undefined) => values != null && (
      values.length < 1 || values.length > 64 || values.some((value) => !validId(value)) ||
      new Set(values).size !== values.length
    )
    if (
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
      (operation.damageBonus != null && !finiteInteger(operation.damageBonus, -1_000, 1_000)) ||
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
    if (!operation.label.trim() || operation.label.length > 120) errors.push(`${label}.label is invalid`)
    if (operation.instanceCount != null && !finiteInteger(operation.instanceCount, 1, 16)) errors.push(`${label}.instanceCount is invalid`)
    // Long-lived SRD areas include effects measured in days. One year keeps
    // the data bounded without truncating them to the old one-day maximum.
    if (!finiteInteger(operation.durationRounds, 1, 5_256_000)) errors.push(`${label}.durationRounds is invalid`)
    if (operation.permanent != null && operation.permanent !== true) errors.push(`${label}.permanent is invalid`)
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
    if (operation.triggers != null && (
      !Array.isArray(operation.triggers) || operation.triggers.length < 1 || operation.triggers.length > 32
    )) errors.push(`${label}.triggers is invalid`)
    else operation.triggers?.forEach((trigger, index) => {
      if (!normalizeDnd5ePersistentAreaTriggerDeclaration(trigger)) {
        errors.push(`${label}.triggers[${index}] is invalid`)
      }
    })
    if (operation.movement != null && (
      !['action', 'bonus-action', 'none'].includes(operation.movement.economy) ||
      !finiteInteger(operation.movement.maximumFeet, 1, 1_000) ||
      (operation.movement.maximumBarrierHeightFeet != null &&
        !finiteInteger(operation.movement.maximumBarrierHeightFeet, 1, 1_000)) ||
      (operation.movement.maximumGapWidthFeet != null &&
        !finiteInteger(operation.movement.maximumGapWidthFeet, 1, 1_000)) ||
      (operation.movement.maximumDistanceFromSourceFeet != null &&
        !finiteInteger(operation.movement.maximumDistanceFromSourceFeet, 1, 10_000)) ||
      (operation.movement.endWhenExceedingSourceDistance != null &&
        typeof operation.movement.endWhenExceedingSourceDistance !== 'boolean')
    )) errors.push(`${label}.movement is invalid`)
    if (operation.lifecycle != null && !normalizeDnd5ePersistentAreaTurnLifecycle(operation.lifecycle)) {
      errors.push(`${label}.lifecycle is invalid`)
    }
    if (operation.movementCostMultiplier != null &&
      !finiteNumber(operation.movementCostMultiplier, 1, 100)) {
      errors.push(`${label}.movementCostMultiplier is invalid`)
    }
    if (operation.obscuration != null && (
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
    if (operation.programmedIllusion != null && (
      operation.permanent !== true ||
      operation.concentration !== false ||
      !validId(operation.programmedIllusion.formChoiceId) ||
      !validId(operation.programmedIllusion.triggerSenseChoiceId)
    )) errors.push(`${label}.programmedIllusion is invalid`)
    if (operation.entityProfile != null && (
      typeof operation.entityProfile !== 'object' ||
      !finiteInteger(operation.entityProfile.armorClass, 1, 40) ||
      (
        operation.entityProfile.hitPoints !== 'actor-max-hit-points' &&
        !finiteInteger(operation.entityProfile.hitPoints, 1, 1_000_000)
      ) ||
      !finiteInteger(operation.entityProfile.strength, 1, 30) ||
      (operation.entityProfile.dexterity != null &&
        !finiteInteger(operation.entityProfile.dexterity, 1, 30)) ||
      typeof operation.entityProfile.cannotAttack !== 'boolean' ||
      typeof operation.entityProfile.invisible !== 'boolean'
    )) errors.push(`${label}.entityProfile is invalid`)
    if (operation.triggerExemptions != null && operation.triggerExemptions !== 'selected-creatures') {
      errors.push(`${label}.triggerExemptions is invalid`)
    }
    if (operation.anchorMode != null && !['fixed', 'source-token', 'target-token'].includes(operation.anchorMode)) {
      errors.push(`${label}.anchorMode is invalid`)
    }
    if (operation.sourceExitBehavior != null && operation.sourceExitBehavior !== 'remove-area') {
      errors.push(`${label}.sourceExitBehavior is invalid`)
    }
    if (operation.sourceOverlapBehavior != null && operation.sourceOverlapBehavior !== 'remove-area') {
      errors.push(`${label}.sourceOverlapBehavior is invalid`)
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
      (operation.effectToken.visibleToSourceOnly != null && typeof operation.effectToken.visibleToSourceOnly !== 'boolean') ||
      (operation.effectToken.shareVisionWithSource != null && typeof operation.effectToken.shareVisionWithSource !== 'boolean') ||
      (operation.effectToken.visionRangeFeet != null && !finiteInteger(operation.effectToken.visionRangeFeet, 0, 10_000)) ||
      (operation.effectToken.darkvisionRangeFeet != null && !finiteInteger(operation.effectToken.darkvisionRangeFeet, 0, 10_000))
    )) errors.push(`${label}.effectToken is invalid`)
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
    if (
      !['actor', 'target', 'all-targets'].includes(operation.target) ||
      !validId(operation.formChoiceId) ||
      !['polymorph', 'true-polymorph', 'animal-shapes', 'shapechange'].includes(operation.profile) ||
      !finiteInteger(operation.durationRounds, 1, 5_256_000) ||
      operation.concentration !== true ||
      (operation.permanent === true && operation.permanentAfterConcentrationCompletes === true) ||
      (operation.maximumChallengeRating !== 'target-level-or-challenge-rating' &&
        !finiteNumber(operation.maximumChallengeRating, 0, 30)) ||
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
  if (operation.kind === 'manual-adjudication' && (
    !operation.prompt.trim() || !operation.reason.trim() || operation.requiresDmApproval !== true
  )) {
    errors.push(`${label} is an invalid manual adjudication`)
    return
  }
  if (operation.kind !== 'manual-adjudication') errors.push(`${label}.kind is invalid`)
}

export function validateDnd5eActivityDefinitionV1(activity: Dnd5eActivityDefinitionV1): readonly string[] {
  const errors: string[] = []
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
      'damage-mitigation-interrupt',
      'ward-pool',
      'spell-damage-resistance-aura',
      'stored-d20-replacement',
      'attacks-per-action',
      'weapon-damage-rider',
      'spell-damage-ability-modifier',
      'spell-ability-check-bonus',
      'spell-interception',
      'spell-target-expansion',
      'damage-roll-maximization',
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
  validateActivation(activity.activation, errors)
  validateTarget(activity.target, errors)
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
      if (!validId(check.opposedRollId) || check.opposedRollId === check.rollId) {
        errors.push(`${label}.opposedRollId is invalid`)
      }
      if (!ABILITIES.has(check.sourceAbility)) errors.push(`${label}.sourceAbility is invalid`)
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
    if (check.kind === 'saving-throw' && check.automaticSuccessIfConditionImmune != null &&
      !CONDITIONS.has(check.automaticSuccessIfConditionImmune)) {
      errors.push(`${label}.automaticSuccessIfConditionImmune is invalid`)
    }
    if (check.kind === 'saving-throw' && check.automaticFailureIfAllied != null &&
      typeof check.automaticFailureIfAllied !== 'boolean') {
      errors.push(`${label}.automaticFailureIfAllied is invalid`)
    }
    if ((check.kind === 'saving-throw' || check.kind === 'attack-roll') && check.appliesWhenChoice != null && (
      !validId(check.appliesWhenChoice.choiceId) ||
      !Array.isArray(check.appliesWhenChoice.optionIds) ||
      check.appliesWhenChoice.optionIds.length < 1 ||
      check.appliesWhenChoice.optionIds.length > 64 ||
      check.appliesWhenChoice.optionIds.some((optionId) => !validId(optionId)) ||
      new Set(check.appliesWhenChoice.optionIds).size !== check.appliesWhenChoice.optionIds.length
    )) errors.push(`${label}.appliesWhenChoice is invalid`)
    if (check.kind === 'saving-throw' && check.appliesWhenCheck != null && (
      !validId(check.appliesWhenCheck.checkId) ||
      check.appliesWhenCheck.result !== 'success'
    )) errors.push(`${label}.appliesWhenCheck is invalid`)
    if (check.kind === 'saving-throw' && check.rollModeIfOpposed != null &&
      !['advantage', 'disadvantage'].includes(check.rollModeIfOpposed)) {
      errors.push(`${label}.rollModeIfOpposed is invalid`)
    }
    if (check.kind === 'opposed-ability-check') {
      // Validated above; unlike ordinary checks it has no static DC.
    } else if (check.kind === 'random-roll') {
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
    if (!Array.isArray(choice.options) || choice.options.length < 2 || choice.options.length > 512) {
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
    if (choice.defaultOptionId != null && !optionIds.has(choice.defaultOptionId)) errors.push(`${label}.defaultOptionId is invalid`)
    choiceOptions.set(choice.id, optionIds)
  }
  if (targetOverrideChoiceCount > 1) {
    errors.push('activity choices may declare targetOverride in only one choice')
  }
  for (const [index, check] of (activity.checks ?? []).entries()) {
    const choiceGate = (check.kind === 'saving-throw' || check.kind === 'attack-roll')
      ? check.appliesWhenChoice
      : undefined
    if (choiceGate && !choiceGate.optionIds.every((optionId) =>
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
  }
  const validateWhen = (when: Dnd5eActivityDefinitionV1['outcomes'][number]['when'], label: string): void => {
    const conditions = when.kind === 'all' ? when.conditions : [when]
    if (when.kind === 'all' && (conditions.length < 2 || conditions.length > 8)) errors.push(`${label}.conditions is invalid`)
    for (const condition of conditions) {
      if (condition.kind === 'check' && !checkIds.has(condition.checkId)) errors.push(`${label} references an unknown check`)
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
  const operationIds = new Set<string>()
  const effectById = new Map((activity.effects ?? []).map((effect) => [effect.id, effect]))
  for (const [outcomeIndex, outcome] of activity.outcomes.entries()) {
    const label = `activity.outcomes[${outcomeIndex}]`
    if (!validId(outcome.id) || outcomeIds.has(outcome.id)) errors.push(`${label}.id is invalid or duplicated`)
    outcomeIds.add(outcome.id)
    validateWhen(outcome.when, `${label}.when`)
    if (!outcome.operations.length && !activity.authorityBinding) errors.push(`${label}.operations is empty`)
    outcome.operations.forEach((operation, operationIndex) => {
      const operationLabel = `${label}.operations[${operationIndex}]`
      validateOperation(operation, operationLabel, errors)
      if (operation.kind === 'transform-creature' && !choiceOptions.has(operation.formChoiceId)) {
        errors.push(`${operationLabel}.formChoiceId references an unknown choice`)
      }
      if (operation.kind === 'apply-effect') {
        const effect = effectById.get(operation.effectId)
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
            (modifier.kind === 'attack-roll' && (modifier.mode === 'advantage' || modifier.mode === 'disadvantage')) ||
            modifier.kind === 'attacks-against-target' ||
            modifier.kind === 'attacks-against-target-by-creature-type' ||
            modifier.kind === 'cannot-be-surprised-while-conscious' ||
            modifier.kind === 'speed' ||
            modifier.kind === 'ability-check' ||
            modifier.kind === 'perception-target-lock' ||
            modifier.kind === 'skill-check-bonus-aura' ||
            modifier.kind === 'minimum-ability-check-d20' ||
            modifier.kind === 'saving-throw' ||
            modifier.kind === 'death-saving-throw' || modifier.kind === 'maximize-healing-dice' ||
            modifier.kind === 'saving-throw-proficiency' ||
            modifier.kind === 'damage-resistance' ||
            modifier.kind === 'conditional-damage-resistance' ||
            modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability' ||
            modifier.kind === 'attack-target-lock' ||
            modifier.kind === 'condition-immunity' ||
            modifier.kind === 'condition-immunity-by-source-creature-type' ||
            modifier.kind === 'saving-throw-advantage-by-source-creature-type' ||
            modifier.kind === 'condition-immunity-by-source-magic' ||
            modifier.kind === 'prohibit-reaction' ||
            modifier.kind === 'prevent-actions' ||
            modifier.kind === 'forced-flee-from-source' ||
            modifier.kind === 'maximum-attacks-per-turn' ||
            modifier.kind === 'restricted-extra-action' ||
            modifier.kind === 'darkvision' || modifier.kind === 'climb-speed' ||
            modifier.kind === 'truesight' || modifier.kind === 'spell-targeting-immunity' || modifier.kind === 'see-invisible' ||
            modifier.kind === 'emitted-light' ||
            modifier.kind === 'language-capability' ||
            modifier.kind === 'language-restriction' ||
            modifier.kind === 'attack-decoys' ||
            modifier.kind === 'planar-phase' ||
            modifier.kind === 'tracking-capability' ||
            modifier.kind === 'environmental-capability' ||
            modifier.kind === 'spell-save-disadvantage-aura' || modifier.kind === 'spell-action-as-bonus-action' ||
            modifier.kind === 'flight-speed' || modifier.kind === 'magically-held-aloft' || modifier.kind === 'safe-fall' || modifier.kind === 'controlled-descent' || modifier.kind === 'automatic-escape' || modifier.kind === 'ignore-magical-speed-reductions' || modifier.kind === 'action-restriction' || modifier.kind === 'attack-profile' ||
            modifier.kind === 'hit-point-maximum' ||
            modifier.kind === 'on-hit-bonus-damage' ||
            modifier.kind === 'weapon-damage-multiplier' ||
            modifier.kind === 'weapon-enchantment' || modifier.kind === 'weapon-damage-replacement' ||
            modifier.kind === 'movement-boundary-save'
          if (!supported) errors.push(`${operationLabel} references an effect modifier that runtime application does not support: ${modifier.kind}`)
          const formulas =
            modifier.kind === 'armor-class' || modifier.kind === 'speed' || modifier.kind === 'weapon-damage-roll' || modifier.kind === 'hit-point-maximum'
              ? [modifier.value]
              : modifier.kind === 'weapon-enchantment'
                ? [modifier.attackAndDamageBonus]
              : modifier.kind === 'movement-boundary-save'
                ? [modifier.dc]
              : (modifier.kind === 'attack-roll' || modifier.kind === 'saving-throw') && modifier.value
                ? [modifier.value]
                : modifier.kind === 'damage-reduction' || modifier.kind === 'on-hit-bonus-damage'
                  ? [modifier.amount]
                  : []
          if (
            modifier.kind !== 'hit-point-maximum' && modifier.kind !== 'on-hit-bonus-damage' &&
            formulas.some(formulaContainsDice)
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
    if ('amount' in consumption && typeof consumption.amount === 'object') {
      appendFormulaErrors(errors, consumption.amount, `${label}.amount`)
    }
    if ('resourceId' in consumption && !validId(consumption.resourceId)) errors.push(`${label}.resourceId is invalid`)
    if (consumption.kind === 'item-charge' && consumption.itemTemplateIds != null && (
      consumption.itemTemplateIds.length < 1 || consumption.itemTemplateIds.length > 64 ||
      consumption.itemTemplateIds.some((id) => !validId(id)) ||
      new Set(consumption.itemTemplateIds).size !== consumption.itemTemplateIds.length
    )) errors.push(`${label}.itemTemplateIds is invalid`)
  }
  activity.requirements?.forEach((predicate, index) => validatePredicate(predicate, `activity.requirements[${index}]`, errors))
  activity.effects?.forEach((effect, index) => validateEffect(effect, `activity.effects[${index}]`, errors))
  activity.triggers?.forEach((trigger, index) => validateTrigger(trigger, `activity.triggers[${index}]`, errors))
  activity.scaling?.forEach((scaling, index) => {
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
  return errors
}
