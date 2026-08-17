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
  if (predicate.kind === 'target-identity') {
    if (!['self', 'other'].includes(predicate.identity)) errors.push(`${label}.identity is invalid`)
    return
  }
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
    if (!finiteInteger(duration.rounds, 1, 10_000)) errors.push(`${label}.rounds is invalid`)
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
    if (!finiteInteger(duration.maximumRounds, 1, 10_000)) errors.push(`${label}.maximumRounds is invalid`)
    if (!ABILITIES.has(duration.ability)) errors.push(`${label}.ability is invalid`)
    if (duration.abilityOptions != null && !validAbilityOptions(duration.abilityOptions, duration.ability)) {
      errors.push(`${label}.abilityOptions is invalid`)
    }
    if (!['target-turn-start', 'target-turn-end'].includes(duration.timing)) errors.push(`${label}.timing is invalid`)
    appendFormulaErrors(errors, duration.dc, `${label}.dc`)
    if (duration.damageOnFailure) {
      if (!finiteInteger(duration.damageOnFailure.count, 1, 40)) errors.push(`${label}.damageOnFailure.count is invalid`)
      if (!finiteInteger(duration.damageOnFailure.sides, 2, 100)) errors.push(`${label}.damageOnFailure.sides is invalid`)
      if (!DAMAGE_TYPES.has(duration.damageOnFailure.type)) errors.push(`${label}.damageOnFailure.type is invalid`)
      if (duration.damageOnFailure.modifier) {
        appendFormulaErrors(errors, duration.damageOnFailure.modifier, `${label}.damageOnFailure.modifier`)
      }
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
  validateDuration(effect.duration, `${label}.duration`, errors)
  if (effect.conditions?.some((condition) => !CONDITIONS.has(condition))) errors.push(`${label}.conditions is invalid`)
  if (effect.extensionCondition != null && !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(effect.extensionCondition)) {
    errors.push(`${label}.extensionCondition is invalid`)
  }
  if (effect.breakOn?.some((trigger) => ![
    'takes-damage', 'targeted-by-attack', 'hit-by-attack', 'makes-attack',
    'casts-spell', 'moves', 'spends-action', 'spends-bonus-action', 'spends-reaction',
    'awakened', 'magical-healing', 'short-rest-complete', 'long-rest-complete',
  ].includes(trigger))) errors.push(`${label}.breakOn is invalid`)
  if (effect.sourceLink) {
    const link = effect.sourceLink
    if (
      link.sourceAttacksOtherTarget !== true &&
      link.sourceCastsSpellOnOtherTarget !== true &&
      link.targetHarmedBySourceAlly !== true &&
      link.sourceRequiresEffectAtSourceTurnEnd == null &&
      link.maximumDistanceFeetAtSourceTurnEnd == null &&
      link.maximumDistanceFeet == null &&
      link.requiresLineOfEffect !== true
    ) errors.push(`${label}.sourceLink is empty`)
    if (
      link.maximumDistanceFeetAtSourceTurnEnd != null &&
      (!Number.isFinite(link.maximumDistanceFeetAtSourceTurnEnd) ||
        link.maximumDistanceFeetAtSourceTurnEnd < 0 ||
        link.maximumDistanceFeetAtSourceTurnEnd > 10_000)
    ) errors.push(`${label}.sourceLink.maximumDistanceFeetAtSourceTurnEnd is invalid`)
    if (
      link.sourceRequiresEffectAtSourceTurnEnd != null &&
      !validId(link.sourceRequiresEffectAtSourceTurnEnd)
    ) errors.push(`${label}.sourceLink.sourceRequiresEffectAtSourceTurnEnd is invalid`)
    if (
      link.maximumDistanceFeet != null &&
      (!Number.isFinite(link.maximumDistanceFeet) || link.maximumDistanceFeet < 0 || link.maximumDistanceFeet > 10_000)
    ) errors.push(`${label}.sourceLink.maximumDistanceFeet is invalid`)
  }
  if (effect.breakOn && new Set(effect.breakOn).size !== effect.breakOn.length) {
    errors.push(`${label}.breakOn is duplicated`)
  }
  if (effect.escapeCheck && effect.conditions?.length !== 1) {
    errors.push(`${label} escape requires exactly one condition carrier`)
  }
  if (effect.escapeCheck) {
    const escape = effect.escapeCheck
    if (
      !ABILITIES.has(escape.ability) ||
      (escape.alternativeAbility != null && !ABILITIES.has(escape.alternativeAbility)) ||
      (escape.skill != null && !['athletics', 'acrobatics'].includes(escape.skill)) ||
      (escape.alternativeSkill != null && !['athletics', 'acrobatics'].includes(escape.alternativeSkill)) ||
      escape.economy !== 'action'
    ) errors.push(`${label}.escapeCheck is invalid`)
    appendFormulaErrors(errors, escape.dc, `${label}.escapeCheck.dc`)
    if (formulaContainsDice(escape.dc)) errors.push(`${label}.escapeCheck.dc cannot roll dice`)
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
  for (const [index, modifier] of (effect.modifiers ?? []).entries()) {
    const modifierLabel = `${label}.modifiers[${index}]`
    if (
      modifier.kind === 'armor-class' || modifier.kind === 'speed' ||
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
    if (modifier.kind === 'attack-target-lock' && modifier.attacksAgainstOthersThanSource !== 'disadvantage') {
      errors.push(`${modifierLabel} attack target lock is invalid`)
    }
    if (modifier.kind === 'saving-throw-proficiency' && !ABILITIES.has(modifier.ability)) {
      errors.push(`${modifierLabel}.ability is invalid`)
    }
    if (modifier.kind === 'ability-check' && (
      (modifier.ability != null && !ABILITIES.has(modifier.ability)) ||
      (modifier.skill != null && (!validId(modifier.skill) || modifier.skill.length > 80))
    )) errors.push(`${modifierLabel} ability-check selector is invalid`)
    if (
      (modifier.kind === 'damage-resistance' || modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability') &&
      !DAMAGE_TYPES.has(modifier.damageType)
    ) errors.push(`${modifierLabel}.damageType is invalid`)
    if (modifier.kind === 'condition-immunity' && !CONDITIONS.has(modifier.condition)) {
      errors.push(`${modifierLabel}.condition is invalid`)
    }
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
    if (modifier.kind === 'darkvision' && !finiteInteger(modifier.rangeFeet, 1, 10_000)) {
      errors.push(`${modifierLabel}.rangeFeet is invalid`)
    }
    if (modifier.kind === 'flight-speed' && !finiteInteger(modifier.speedFeet, 1, 10_000)) {
      errors.push(`${modifierLabel}.speedFeet is invalid`)
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
    if (value != null && !finiteNumber(value, 1, 100_000)) errors.push(`activity.target.${field} is invalid`)
  }
  for (const [minimumField, maximumField] of [
    ['minimumRadiusFeet', 'radiusFeet'],
    ['minimumLengthFeet', 'lengthFeet'],
    ['minimumWidthFeet', 'widthFeet'],
    ['minimumHeightFeet', 'heightFeet'],
  ] as const) {
    const minimum = target[minimumField]
    const maximum = target[maximumField]
    if (minimum != null && (maximum == null || minimum > maximum || minimum % 5 !== 0 || maximum % 5 !== 0)) {
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
  if (target.rotatable && (target.shape !== 'rect' || target.origin !== 'point')) {
    errors.push('only point-origin rectangles may rotate freely')
  }
}

function operationPhases(operation: Dnd5eActivityOperationV1): readonly AutomationPhase[] {
  if (operation.kind === 'damage') return ['damage']
  if (operation.kind === 'healing' || operation.kind === 'temporary-hit-points') return ['healing']
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
    return
  }
  if (operation.kind === 'resource') {
    if (!validId(operation.resourceId)) errors.push(`${label}.resourceId is invalid`)
    appendFormulaErrors(errors, operation.amount, `${label}.amount`)
    return
  }
  if (operation.kind === 'move') {
    if (!['push', 'pull', 'teleport', 'swap'].includes(operation.mode)) errors.push(`${label}.mode is invalid`)
    if (operation.placement != null && operation.placement !== 'host-automatic-maximum') {
      errors.push(`${label}.placement is invalid`)
    }
    if (operation.placement === 'host-automatic-maximum' && !['push', 'pull'].includes(operation.mode)) {
      errors.push(`${label}.placement requires push or pull`)
    }
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
  if (operation.kind === 'remove-effect') {
    if (!validId(operation.effectId) || !['self', 'any'].includes(operation.source)) {
      errors.push(`${label} remove-effect selector is invalid`)
    }
    return
  }
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
    })) {
      if (formula != null) appendFormulaErrors(errors, formula, `${label}.${field}`)
    }
    if (!finiteInteger(operation.durationRounds, 1, 10_000)) errors.push(`${label}.durationRounds is invalid`)
    if (operation.weaponAttacksMagical != null && typeof operation.weaponAttacksMagical !== 'boolean') {
      errors.push(`${label}.weaponAttacksMagical is invalid`)
    }
    if (operation.shareSelfSpellsRangeFeet != null &&
      !finiteInteger(operation.shareSelfSpellsRangeFeet, 5, 10_000)) {
      errors.push(`${label}.shareSelfSpellsRangeFeet is invalid`)
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
      operation.actions.length < 1 || operation.actions.length > 2 ||
      operation.actions.some((action) => !['grapple', 'shove'].includes(action)) ||
      new Set(operation.actions).size !== operation.actions.length ||
      (operation.shovePushDistanceBonusFeet != null &&
        !finiteInteger(operation.shovePushDistanceBonusFeet, 0, 1_000))
    ) errors.push(`${label} basic-action grant is invalid`)
    return
  }
  if (operation.kind === 'create-persistent-area') {
    if (!operation.label.trim() || operation.label.length > 120) errors.push(`${label}.label is invalid`)
    if (operation.instanceCount != null && !finiteInteger(operation.instanceCount, 1, 16)) errors.push(`${label}.instanceCount is invalid`)
    if (!finiteInteger(operation.durationRounds, 1, 14_400)) errors.push(`${label}.durationRounds is invalid`)
    if (operation.color != null && !/^#[0-9a-f]{6}$/i.test(operation.color)) errors.push(`${label}.color is invalid`)
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
      !['action', 'bonus-action'].includes(operation.movement.economy) ||
      !finiteInteger(operation.movement.maximumFeet, 1, 1_000) ||
      (operation.movement.maximumDistanceFromSourceFeet != null &&
        !finiteInteger(operation.movement.maximumDistanceFromSourceFeet, 1, 10_000))
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
    !validId(activity.legacySource.id)
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
  errors.push(...validateAutomationCapability(activity.automation).map((error) => `activity.automation: ${error}`))

  const checkIds = new Set<string>()
  for (const [index, check] of (activity.checks ?? []).entries()) {
    const label = `activity.checks[${index}]`
    if (!validId(check.id) || checkIds.has(check.id)) errors.push(`${label}.id is invalid or duplicated`)
    checkIds.add(check.id)
    if (!validId(check.rollId)) errors.push(`${label}.rollId is invalid`)
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
    if (check.kind === 'attack-roll') {
      appendFormulaErrors(errors, check.attackBonus, `${label}.attackBonus`)
      if (check.delivery != null && !['melee', 'ranged'].includes(check.delivery)) {
        errors.push(`${label}.delivery is invalid`)
      }
      if (!finiteInteger(check.criticalThreshold ?? 20, 1, 20)) errors.push(`${label}.criticalThreshold is invalid`)
    } else appendFormulaErrors(errors, check.dc, `${label}.dc`)
  }

  const choiceOptions = new Map<string, Set<string>>()
  for (const [index, choice] of (activity.choices ?? []).entries()) {
    const label = `activity.choices[${index}]`
    if (!validId(choice.id) || choiceOptions.has(choice.id)) errors.push(`${label}.id is invalid or duplicated`)
    if (!choice.label.trim() || choice.label.length > 160) errors.push(`${label}.label is invalid`)
    const optionIds = new Set<string>()
    if (!Array.isArray(choice.options) || choice.options.length < 2 || choice.options.length > 32) {
      errors.push(`${label}.options is invalid`)
    } else for (const [optionIndex, option] of choice.options.entries()) {
      const optionLabel = `${label}.options[${optionIndex}]`
      if (!validId(option.id) || optionIds.has(option.id)) errors.push(`${optionLabel}.id is invalid or duplicated`)
      if (!option.label.trim() || option.label.length > 160 || (option.description?.length ?? 0) > 1_000) {
        errors.push(`${optionLabel}.label or description is invalid`)
      }
      option.requirements?.forEach((requirement: Dnd5ePredicateV1, requirementIndex: number) =>
        validatePredicate(requirement, `${optionLabel}.requirements[${requirementIndex}]`, errors))
      optionIds.add(option.id)
    }
    if (choice.defaultOptionId != null && !optionIds.has(choice.defaultOptionId)) errors.push(`${label}.defaultOptionId is invalid`)
    choiceOptions.set(choice.id, optionIds)
  }
  const validateWhen = (when: Dnd5eActivityDefinitionV1['outcomes'][number]['when'], label: string): void => {
    const conditions = when.kind === 'all' ? when.conditions : [when]
    if (when.kind === 'all' && (conditions.length < 2 || conditions.length > 8)) errors.push(`${label}.conditions is invalid`)
    for (const condition of conditions) {
      if (condition.kind === 'check' && !checkIds.has(condition.checkId)) errors.push(`${label} references an unknown check`)
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
      if (operation.kind === 'apply-effect') {
        const effect = effectById.get(operation.effectId)
        if (!effect) errors.push(`${operationLabel}.effectId references an unknown effect`)
        if (effect?.grants?.length || effect?.triggers?.length) {
          errors.push(`${operationLabel} references an effect with runtime grants or nested triggers`)
        }
        if (effect && !['replace', 'refresh-duration', 'stack', 'unique-by-source'].includes(effect.stacking)) {
          errors.push(`${operationLabel} references an effect with an unsupported runtime stacking mode`)
        }
        for (const modifier of effect?.modifiers ?? []) {
          const supported =
            (modifier.kind === 'armor-class' && modifier.mode === 'add') ||
            (modifier.kind === 'attack-roll' && (modifier.mode === 'advantage' || modifier.mode === 'disadvantage')) ||
            (modifier.kind === 'speed' && (modifier.mode === 'add' || modifier.mode === 'multiply')) ||
            modifier.kind === 'ability-check' ||
            modifier.kind === 'saving-throw' ||
            modifier.kind === 'saving-throw-proficiency' ||
            modifier.kind === 'damage-resistance' ||
            modifier.kind === 'damage-immunity' || modifier.kind === 'damage-vulnerability' ||
            modifier.kind === 'attack-target-lock' ||
            modifier.kind === 'condition-immunity' ||
            modifier.kind === 'prohibit-reaction' ||
            modifier.kind === 'forced-flee-from-source' ||
            modifier.kind === 'maximum-attacks-per-turn' ||
            modifier.kind === 'darkvision' || modifier.kind === 'see-invisible' ||
            modifier.kind === 'spell-save-disadvantage-aura' || modifier.kind === 'spell-action-as-bonus-action' ||
            modifier.kind === 'flight-speed' || modifier.kind === 'attack-profile' ||
            modifier.kind === 'weapon-enchantment' || modifier.kind === 'weapon-damage-replacement' ||
            modifier.kind === 'movement-boundary-save'
          if (!supported) errors.push(`${operationLabel} references an effect modifier that runtime application does not support: ${modifier.kind}`)
          const formulas =
            modifier.kind === 'armor-class' || modifier.kind === 'speed' || modifier.kind === 'weapon-damage-roll'
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
          if (formulas.some(formulaContainsDice)) {
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
  })

  // Schema v1 keeps `automation` only for Legacy import/export compatibility.
  // Runtime coverage is derived from operations and registered Host handlers.
  return errors
}
