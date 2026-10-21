import { isDnd5eCompanionTaskDescriptions } from '../companionTask'
import { isDnd5eCompanionReadyTriggers } from '../companionReady'
import { isDnd5eCompanionMovementSelections } from '../companionMovementDestination'
import { isDnd5eCompanionGuardSelections } from '../companionGuardArea'
import { isDnd5eCompanionObjectSelections } from '../companionObjectInteraction'
import { validDnd5eInventoryExchangeSelection, type Dnd5eInventoryExchangeSelection } from '../inventoryExchangeSelection'
import { dnd5eActivityEffectiveTargetV1 } from './dnd5eActivityScaling'
import { dnd5eAreaTargetSelectionValid } from './dnd5eAreaTargetSelection'
import { dnd5eActivityExchangeOutputAllowed, dnd5eActivityInventorySnapshot, dnd5eActivitySelectsInventoryItem, dnd5eActivitySelectsEquipmentItem } from './dnd5eActivityInventorySelection'
import type { Dnd5eActivityInventoryItemSnapshotV1 } from './dnd5eActivityExecutor'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import {
  resolveDnd5eActivity,
  type Dnd5eActivityActorSnapshot,
  type Dnd5eActivityExecutionResult,
  type Dnd5eActivityRollMode,
  type Dnd5eActivityExecutionInput,
} from './dnd5eActivityExecutor'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import type { Dnd5eActivityAreaPlacementV1, Dnd5eActivityTriggerContextV1 } from './dnd5eActivityContracts'
import type { Dnd5eActivityConfirmedByV1 } from './dnd5eActivityInvocation'
import type { Character } from '../../../types/character'

export const DND5E_EXECUTE_ACTIVITY_COMMAND_SCHEMA_VERSION = 1 as const

/** Client intent only. It deliberately contains no d20 total, damage, healing, or final mutation. */
export interface Dnd5eExecuteActivityCommandV1 {
  schemaVersion: typeof DND5E_EXECUTE_ACTIVITY_COMMAND_SCHEMA_VERSION
  commandId: string
  actorId: string
  packageId: string
  packageVersion: string
  activityId: string
  /** Selected grant instance; the Host verifies ownership, targets and charges. */
  grantEffectId?: string
  targetIds: readonly string[]
  /** Ordered projectile/beam allocation. Repeated ids are intentional. */
  projectileTargetIds?: readonly string[]
  /** Client-selected placement only; geometry is rebuilt by the authority. */
  areaPlacement?: Dnd5eActivityAreaPlacementV1
  /** Optional creature allow-list for Activities that explicitly expose trigger exemptions. */
  areaExemptTargetIds?: readonly string[]
  /** Optional cast-time rules phrase; the resolver emits only a digest. */
  secretPhrase?: string
  castLevel?: number
  choices?: Readonly<Record<string, string>>
  targetFormIds?: Readonly<Record<string, string>>
  companionHelpTargets?: Readonly<Record<string, { targetId: string; helpKind: 'attack' | 'ability-check' }>>
  companionAttackTargets?: Readonly<Record<string, string>>
  companionMovementDestinations?: Readonly<Record<string, Readonly<Record<string, import('../companionMovementDestination').Dnd5eCompanionMovementDestination | null>>>>
  companionTaskDescriptions?: Record<string, string>
  companionReadyTriggers?: Record<string, string>
  companionObjectInteractions?: Record<string, import('../companionObjectInteraction').Dnd5eCompanionObjectInteraction>
  companionGuardAreas?: Readonly<Record<string, import('../companionGuardArea').Dnd5eCompanionGuardArea>>
  willingTargetIds?: readonly string[]
  expectedRevision: number
  /** Inventory instance selected by the client; the Host reloads and validates it. */
  inventoryInstanceId?: string
  /** Optional owner for an explicitly declared inventory-item binding. */
  inventoryOwnerId?: string
  /** Monotonic inventory revision observed while preparing this action. */
  expectedInventoryRevision?: number
  inventoryExchange?: Dnd5eInventoryExchangeSelection
  /** Opaque reference to a Host-created trigger window; it contains no trusted rule context. */
  triggerEventId?: string
  /** Opaque Host continuation id; saved dice and visited targets never come from the client. */
  continuationId?: string
}

export interface Dnd5eActivityAuthorityInput {
  /** Host-collected weapon reactions; never copied from serialized client intent. */
  savingThrowCounterattacks?: import('../headlessCombatEngine').Dnd5eAction['savingThrowCounterattacks']
  optionalSavingThrowBonus?: Dnd5eActivityExecutionInput['optionalSavingThrowBonus']
  validateOptionalSavingThrowUses?: Dnd5eActivityExecutionInput['validateOptionalSavingThrowUses']
  /** Host-collected damage reactions, not part of the wire command. */
  damageMitigationInterrupts?: Parameters<typeof import('../headlessCombatEngine').commitDnd5eActivityExecution>[1]['damageMitigationInterrupts']
  /** Derived by the Host bridge preview, never a player command option. */
  featureSpellInvocationInterrupted?: boolean
  /** Host-collected casting checkpoint, never copied from the wire command. */
  spellcastingSavingThrows?: Parameters<typeof import('../headlessCombatEngine').commitDnd5eActivityExecution>[1]['spellcastingSavingThrows']
  activityTeleportInterruptions?: readonly import('../headlessCombatEngine').Dnd5eActivityTeleportInterruptionUse[]
  sourceActionInterruptionReaction?: import('../headlessCombatEngine').Dnd5eSourceActionInterruptionReaction
  counterspellReaction?: import('../headlessCombatEngine').Dnd5eCounterspellReaction
  /** Host-collected choices, separate from client intent and validated by the parent bridge. */
  disadvantageNegationChoices?: Readonly<Record<string, import('./dnd5eActivityDisadvantageNegation').Dnd5eActivityNegationChoice>>
  /** Host-only replay fields, never read from the wire command. */
  cancelledCriticalCheckKeys?: ReadonlySet<string>
  weaponCounterattackSuccessCheckKeys?: Dnd5eActivityExecutionInput['weaponCounterattackSuccessCheckKeys']
  allowCriticalDiceSuperset?: boolean
  resolveDamageRollBonus?: Dnd5eActivityExecutionInput['resolveDamageRollBonus']
  /** Derived from the active combat turn by the Host, not the wire command. */
  /** Host-owned combat scope; never read from the submitted command. */
  combatActive?: boolean
  currentTurnActorId?: string
  /** Host-provided continuation history, absent from the wire command. */
  continuationTargetIds?: readonly string[]
  command: Dnd5eExecuteActivityCommandV1
  currentRevision: number
  actor: Dnd5eActivityActorSnapshot
  targets: readonly Dnd5eActivityActorSnapshot[]
  /** Full Host-owned encounter, never populated from client snapshots. */
  combatants?: readonly Dnd5eActivityActorSnapshot[]
  /** Rolls are supplied by the Host/authority, never copied from the command. */
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  /** Host-owned prepared equipment profile; never copied from the submitted command. */
  equipmentWeaponDamage?: import('./dnd5eEquipmentWeaponDamage').Dnd5eEquipmentWeaponDamageSnapshot
  /** Caller supplies Host-confirmed qualifications outside the serialized intent. */
  targetQualificationIdsByTargetId?: Readonly<Record<string, readonly string[]>>
  saveFactsByTargetId?: import('./dnd5eActivitySaveFacts').Dnd5eActivitySaveFactsV1
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  /** Host-only callback, never copied from a serialized command. */
  negateDisadvantage?: Dnd5eActivityExecutionInput['negateDisadvantage']
  resolveSequentialCheckRollModes?: Dnd5eActivityExecutionInput['resolveSequentialCheckRollModes']
  distanceFeetByTargetId?: Readonly<Record<string, number>>
  /** Trusted Host geometry, separate from the client's command. */
  distanceFeetBetweenTargets?: Readonly<Record<string, Readonly<Record<string, number>>>>
  areaPlacementDistanceFeet?: number
  /** Target ids recomputed by the Host from the authoritative area geometry. */
  areaTargetIds?: readonly string[]
  /** Creature ids independently reloaded and approved by the Host. */
  areaExemptTargetIds?: readonly string[]
  /** Host forwards the bounded phrase only to the trusted Activity resolver. */
  secretPhrase?: string
  parentDamageType?: Dnd5eDamageType
  usedTurnKeys?: ReadonlySet<string>
  dmApproved?: boolean
  /** Host-resolved trigger data. This must never be copied from the client command. */
  triggerContext?: Dnd5eActivityTriggerContextV1
  confirmedBy?: Dnd5eActivityConfirmedByV1
  /** Host-owned character snapshot used only for inventory-bound Activities. */
  inventoryOwner?: Character
  inventoryRoster?:readonly Character[]
}

export type Dnd5eActivityAuthorityResult = Dnd5eActivityExecutionResult | {
  ok: false
  reason: 'invalid-command' | 'stale-revision' | 'content-version-mismatch' | 'unknown-activity' | 'unauthorized-actor' | 'target-snapshot-mismatch'
  details: readonly string[]
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const SEMVER_LIKE = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/

export function validateDnd5eExecuteActivityCommandV1(
  command: Dnd5eExecuteActivityCommandV1,
  /** Internal bound from Host area geometry; never read from the command. */
  authoritativeAreaTargetCount = 0,
): readonly string[] {
  const errors: string[] = []
  // Instance ids use stableSegment's uppercase percent-encoding replacements.
  // They are not lowercase content ids; ownership is checked by the Host.
  if (command.grantEffectId != null && (typeof command.grantEffectId !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9._:-]{0,1023}$/.test(command.grantEffectId))) errors.push('invalid grantEffectId')
  if (command.inventoryExchange != null && (!validDnd5eInventoryExchangeSelection(command.inventoryExchange) ||
    command.inventoryInstanceId != null || command.inventoryOwnerId != null || command.expectedInventoryRevision != null)) errors.push('invalid inventoryExchange')
  if (command.companionHelpTargets != null) {
    const values = command.companionHelpTargets
    if (typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length > 64 ||
      Object.entries(values).some(([id, value]) => !ID_PATTERN.test(id) || !value ||
        typeof value !== 'object' || Array.isArray(value) || typeof value.targetId !== 'string' ||
        !ID_PATTERN.test(value.targetId) || !['attack', 'ability-check'].includes(value.helpKind))) {
      errors.push('invalid companionHelpTargets')
    }
  }
  if (command.schemaVersion !== 1) errors.push('unsupported Activity command schema')
  if (command.companionGuardAreas != null && !isDnd5eCompanionGuardSelections(command.companionGuardAreas)) errors.push('invalid companionGuardAreas')
  if (command.companionTaskDescriptions != null && !isDnd5eCompanionTaskDescriptions(command.companionTaskDescriptions)) errors.push('invalid companionTaskDescriptions')
  if (command.companionReadyTriggers != null && !isDnd5eCompanionReadyTriggers(command.companionReadyTriggers)) errors.push('invalid companionReadyTriggers')
  if (command.companionObjectInteractions != null && !isDnd5eCompanionObjectSelections(command.companionObjectInteractions)) errors.push('invalid companionObjectInteractions')
  if (command.companionMovementDestinations != null && !isDnd5eCompanionMovementSelections(command.companionMovementDestinations)) {
    errors.push('invalid companionMovementDestinations')
  }
  if (command.companionAttackTargets != null) {
    const values = command.companionAttackTargets
    if (typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length > 64 ||
      Object.entries(values).some(([id, targetId]) => !ID_PATTERN.test(id) ||
        typeof targetId !== 'string' || !ID_PATTERN.test(targetId))) errors.push('invalid companionAttackTargets')
  }
  for (const [label, value] of Object.entries({
    commandId: command.commandId,
    actorId: command.actorId,
    packageId: command.packageId,
    activityId: command.activityId,
  })) if (!ID_PATTERN.test(value)) errors.push(`invalid ${label}`)
  if (!SEMVER_LIKE.test(command.packageVersion)) errors.push('invalid packageVersion')
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) errors.push('invalid expectedRevision')
  if (command.inventoryOwnerId != null && (!ID_PATTERN.test(command.inventoryOwnerId) || !command.inventoryInstanceId)) errors.push('invalid inventoryOwnerId')
  if (command.inventoryInstanceId != null && !ID_PATTERN.test(command.inventoryInstanceId)) {
    errors.push('invalid inventoryInstanceId')
  }
  if (command.triggerEventId != null && !ID_PATTERN.test(command.triggerEventId)) errors.push('invalid triggerEventId')
  if (command.continuationId != null && !ID_PATTERN.test(command.continuationId)) errors.push('invalid continuationId')
  if (
    command.expectedInventoryRevision != null &&
    (!Number.isInteger(command.expectedInventoryRevision) || command.expectedInventoryRevision < 0)
  ) errors.push('invalid expectedInventoryRevision')
  if ((command.inventoryInstanceId == null) !== (command.expectedInventoryRevision == null)) {
    errors.push('incomplete inventory context')
  }
  if (command.castLevel != null && (!Number.isInteger(command.castLevel) || command.castLevel < 0 || command.castLevel > 9)) {
    errors.push('invalid castLevel')
  }
  const targetLimit = Number.isSafeInteger(authoritativeAreaTargetCount) && authoritativeAreaTargetCount > 256
    ? authoritativeAreaTargetCount : 256
  if (!Array.isArray(command.targetIds) || command.targetIds.length > targetLimit || command.targetIds.some((id) => !ID_PATTERN.test(id))) {
    errors.push('invalid targetIds')
  }
  if (new Set(command.targetIds).size !== command.targetIds.length) errors.push('duplicate targetIds')
  if (command.areaExemptTargetIds != null && (
    !Array.isArray(command.areaExemptTargetIds) || command.areaExemptTargetIds.length > 256 ||
    command.areaExemptTargetIds.some((id) => !ID_PATTERN.test(id)) ||
    new Set(command.areaExemptTargetIds).size !== command.areaExemptTargetIds.length
  )) errors.push('invalid areaExemptTargetIds')
  if (command.secretPhrase != null && (
    typeof command.secretPhrase !== 'string' || !command.secretPhrase.trim() ||
    command.secretPhrase.normalize('NFKC').trim().length > 120
  )) errors.push('invalid secretPhrase')
  if (
    command.projectileTargetIds != null &&
    (!Array.isArray(command.projectileTargetIds) || command.projectileTargetIds.length > 256 ||
      command.projectileTargetIds.some((id) => !ID_PATTERN.test(id)))
  ) errors.push('invalid projectileTargetIds')
  if (command.areaPlacement != null && (
    !Number.isFinite(command.areaPlacement.x) || !Number.isFinite(command.areaPlacement.y) ||
    (command.areaPlacement.elevationFeet != null && !Number.isFinite(command.areaPlacement.elevationFeet)) ||
    (command.areaPlacement.angleDegrees != null && !Number.isFinite(command.areaPlacement.angleDegrees)) ||
    (command.areaPlacement.objectLaunchPitchDegrees != null && (!Number.isFinite(command.areaPlacement.objectLaunchPitchDegrees) ||
      command.areaPlacement.objectLaunchPitchDegrees < -90 || command.areaPlacement.objectLaunchPitchDegrees > 90)) ||
    (command.areaPlacement.radiusFeet != null && !Number.isFinite(command.areaPlacement.radiusFeet)) ||
    (command.areaPlacement.lengthFeet != null && !Number.isFinite(command.areaPlacement.lengthFeet)) ||
    (command.areaPlacement.widthFeet != null && !Number.isFinite(command.areaPlacement.widthFeet)) ||
    (command.areaPlacement.heightFeet != null && !Number.isFinite(command.areaPlacement.heightFeet)) ||
    (command.areaPlacement.instances != null && (
      !Array.isArray(command.areaPlacement.instances) || command.areaPlacement.instances.length < 1 ||
      command.areaPlacement.instances.length > 64 || command.areaPlacement.instances.some((instance) =>
        !Number.isFinite(instance.x) || !Number.isFinite(instance.y) ||
        (instance.elevationFeet != null && !Number.isFinite(instance.elevationFeet)))))
  )) errors.push('invalid areaPlacement')
  if (Object.entries(command.choices ?? {}).some(([key, value]) => !ID_PATTERN.test(key) || !ID_PATTERN.test(value))) {
    errors.push('invalid choices')
  }
  if (command.willingTargetIds != null && (!Array.isArray(command.willingTargetIds) || command.willingTargetIds.some(id => !command.targetIds.includes(id)))) errors.push('invalid willingTargetIds')
  if (Object.entries(command.targetFormIds ?? {}).some(([key, value]) => !command.targetIds.includes(key) || !ID_PATTERN.test(value))) errors.push('invalid targetFormIds')
  return errors
}

/**
 * Authority-side prepare/resolve boundary. Revision, package version, actor,
 * target snapshots, and Host-owned rolls are checked before proposals exist.
 */
export function resolveDnd5eActivityCommand(
  input: Dnd5eActivityAuthorityInput,
): Dnd5eActivityAuthorityResult {
  const registeredActivity = getRegisteredDnd5eActivity(input.command.packageId, input.command.activityId)
  // The parser only uses this Host-owned count as a transport bound. The
  // effective target contract below still enforces the actual target limit.
  const commandErrors = validateDnd5eExecuteActivityCommandV1(input.command,
    input.areaTargetIds?.length)
  if (commandErrors.length) return { ok: false, reason: 'invalid-command', details: commandErrors }
  if (input.command.expectedRevision !== input.currentRevision) {
    return { ok: false, reason: 'stale-revision', details: ['combat revision changed before Activity resolution'] }
  }
  if (input.actor.id !== input.command.actorId) {
    return { ok: false, reason: 'unauthorized-actor', details: ['actor snapshot does not match the submitted intent'] }
  }
  const registeredPackage = listRegisteredDnd5eActivityPackages().find((entry) => entry.packageId === input.command.packageId)
  if (registeredPackage && registeredPackage.packageVersion !== input.command.packageVersion) {
    return { ok: false, reason: 'content-version-mismatch', details: ['installed content version does not match the command'] }
  }
  let activity = registeredActivity
  if (!activity) return { ok: false, reason: 'unknown-activity', details: ['Activity is not registered'] }
  const selectedOutput = input.command.inventoryExchange?.outputTemplateId
  if (selectedOutput == null && activity.outcomes.some(outcome => outcome.operations.some(operation =>
    operation.kind === 'exchange-inventory-items' && operation.templateSource))) {
    return { ok: false, reason: 'invalid-command', details: ['dynamic exchange requires an explicit output selection'] }
  }
  if (selectedOutput != null) {
    const exchanges = activity.outcomes.flatMap(outcome => outcome.operations).filter(operation => operation.kind === 'exchange-inventory-items')
    const exchange = exchanges[0]
    if (exchanges.length !== 1 || !(exchange.templateSource
      ? dnd5eActivityExchangeOutputAllowed(selectedOutput, exchange.templateSource, exchange.policy)
      : (exchange.templateOptions ?? [exchange.templateId]).includes(selectedOutput))) {
      return {ok:false,reason:'invalid-command',details:['output is not an authorized exchange template']}
    }
    activity = {...activity,outcomes:activity.outcomes.map(outcome=>({...outcome,operations:outcome.operations.map(operation=>
      operation.kind==='exchange-inventory-items'?{...operation,templateId:selectedOutput}:operation)}))}
  }
  let effectiveTarget: ReturnType<typeof dnd5eActivityEffectiveTargetV1>
  try {
    effectiveTarget = dnd5eActivityEffectiveTargetV1(activity,
      { actor: input.actor, castLevel: input.command.castLevel }, input.command.choices)
  } catch {
    return { ok: false, reason: 'invalid-command', details: ['effective target contract could not be resolved from Host data'] }
  }
  if (input.command.projectileTargetIds?.length &&
    (effectiveTarget.kind !== 'creature' || effectiveTarget.allowDuplicateTargets !== true ||
      input.command.projectileTargetIds.length > effectiveTarget.count ||
      input.command.projectileTargetIds.length < (effectiveTarget.minimumCount ?? 1))) {
    return { ok: false, reason: 'invalid-command', details: ['projectile occurrences violate the target contract'] }
  }
  const acceptsSecretPhrase = activity.outcomes.flatMap((outcome) => outcome.operations).some((operation) =>
    operation.kind === 'modify-map-object-lock' && operation.accessPolicy === 'selected-creatures-and-password')
  if (input.command.secretPhrase != null && !acceptsSecretPhrase) {
    return { ok: false, reason: 'invalid-command', details: ['Activity does not accept a secret phrase'] }
  }
  if (input.command.triggerEventId != null && input.triggerContext?.eventId !== input.command.triggerEventId) {
    return { ok: false, reason: 'invalid-command', details: ['trigger event reference does not match Host context'] }
  }
  if (input.triggerContext != null && input.command.triggerEventId !== input.triggerContext.eventId) {
    return { ok: false, reason: 'invalid-command', details: ['Host trigger context is not referenced by the command'] }
  }
  const submittedTargetIds = [...input.command.targetIds].sort()
  const snapshotTargetIds = input.targets.map((target) => target.id).sort()
  if (submittedTargetIds.length !== snapshotTargetIds.length || submittedTargetIds.some((id, index) => id !== snapshotTargetIds[index])) {
    return { ok: false, reason: 'target-snapshot-mismatch', details: ['authority target snapshots do not match the submitted target ids'] }
  }
  if (input.command.projectileTargetIds?.some((id) => !input.command.targetIds.includes(id))) {
    return { ok: false, reason: 'target-snapshot-mismatch', details: ['projectile targets are not included in authority snapshots'] }
  }
  if (effectiveTarget.kind === 'area') {
    if (!input.command.areaPlacement) {
      return { ok: false, reason: 'invalid-command', details: ['area placement is required'] }
    }
    const authoritativeAreaTargets = [...(input.areaTargetIds ?? [])].sort()
    if (effectiveTarget.selection === 'choose-any'
      ? !dnd5eAreaTargetSelectionValid(effectiveTarget, authoritativeAreaTargets, submittedTargetIds)
      : (
      authoritativeAreaTargets.length !== submittedTargetIds.length ||
      authoritativeAreaTargets.some((id, index) => id !== submittedTargetIds[index])
    )) return { ok: false, reason: 'target-snapshot-mismatch', details: ['submitted targets do not match authoritative area geometry'] }
    const submittedExemptions = [...(input.command.areaExemptTargetIds ?? [])].sort()
    const authoritativeExemptions = [...(input.areaExemptTargetIds ?? [])].sort()
    if (
      submittedExemptions.length !== authoritativeExemptions.length ||
      submittedExemptions.some((id, index) => id !== authoritativeExemptions[index])
    ) return { ok: false, reason: 'target-snapshot-mismatch', details: ['area trigger exemptions do not match Host creature snapshots'] }
  } else if (input.command.areaPlacement != null) {
    return { ok: false, reason: 'invalid-command', details: ['non-area Activity cannot include area placement'] }
  }
  const selectsInventoryItem = dnd5eActivitySelectsInventoryItem(activity, input.command.choices)
  let selectedInventoryItem: Dnd5eActivityInventoryItemSnapshotV1 | undefined
  if (input.command.inventoryOwnerId && !selectsInventoryItem) return {ok:false,reason:'invalid-command',details:['Activity does not accept an inventory owner selection']}
  if (dnd5eActivitySelectsEquipmentItem(activity, input.command.choices)) {
    const ownerId = input.command.inventoryOwnerId ?? input.inventoryOwner?.id ?? input.actor.characterId ?? input.actor.id
    const roster = input.inventoryRoster ?? (input.inventoryOwner ? [input.inventoryOwner] : [])
    const owners = roster.filter(owner => owner.id === ownerId)
    const targets = [...new Map([input.actor,...input.targets].map(target => [target.id,target])).values()]
      .filter(target => (target.characterId ?? target.id) === ownerId)
    if (owners.length !== 1 || targets.length !== 1 || !input.command.inventoryInstanceId || input.command.expectedInventoryRevision == null) return {ok:false,reason:'invalid-command',details:['inventory binding requires an authoritative owner, target and instance']}
    const inventory = dnd5eActivityInventorySnapshot(owners[0])
    if ((inventory.revision ?? 0) !== input.command.expectedInventoryRevision) return {ok:false,reason:'stale-revision',details:['inventory changed before binding']}
    const item = inventory.items.find(candidate => candidate.inventoryInstanceId === input.command.inventoryInstanceId)
    if (!item) return {ok:false,reason:'invalid-command',details:['inventory item is not usable weapon or body armor']}
    selectedInventoryItem = {...item,ownerActorId:targets[0].id,
      magical:item.magical === true || targets[0].enchantedInventoryInstanceIds?.includes(item.inventoryInstanceId) === true}
  }
  return resolveDnd5eActivity({
    optionalSavingThrowBonus: input.optionalSavingThrowBonus,
    validateOptionalSavingThrowUses: input.validateOptionalSavingThrowUses,
    featureSpellInvocationInterrupted: input.featureSpellInvocationInterrupted,
    activity,
    actor: input.actor,
    targets: input.targets,
    combatants: input.combatants,
    companionHelpTargets: input.command.companionHelpTargets,
    companionAttackTargets: input.command.companionAttackTargets,
    companionMovementDestinations: input.command.companionMovementDestinations,
    companionObjectInteractions: input.command.companionObjectInteractions,
    companionTaskDescriptions: input.command.companionTaskDescriptions,
    companionReadyTriggers: input.command.companionReadyTriggers,
    companionGuardAreas: input.command.companionGuardAreas,
    castLevel: input.command.castLevel,
    rolls: input.authoritativeRolls,
    equipmentWeaponDamage: input.equipmentWeaponDamage,
    checkRollModes: input.checkRollModes,
    negateDisadvantage: input.negateDisadvantage,
    resolveDamageRollBonus: input.resolveDamageRollBonus,
    cancelledCriticalCheckKeys: input.cancelledCriticalCheckKeys,
    weaponCounterattackSuccessCheckKeys: input.weaponCounterattackSuccessCheckKeys,
    allowCriticalDiceSuperset: input.allowCriticalDiceSuperset,
    resolveSequentialCheckRollModes: input.resolveSequentialCheckRollModes,
    distanceFeetByTargetId: input.distanceFeetByTargetId,
    distanceFeetBetweenTargets: input.distanceFeetBetweenTargets,
    areaPlacement: input.command.areaPlacement,
    areaPlacementDistanceFeet: input.areaPlacementDistanceFeet,
    areaExemptTargetIds: input.areaExemptTargetIds,
    secretPhrase: input.secretPhrase ?? input.command.secretPhrase,
    projectileTargetIds: input.command.projectileTargetIds,
    parentDamageType: input.parentDamageType,
    choices: input.command.choices,
    targetFormIds: input.command.targetFormIds,
    willingTargetIds: input.command.willingTargetIds,
    targetQualificationIdsByTargetId: input.targetQualificationIdsByTargetId,
    saveFactsByTargetId: input.saveFactsByTargetId,
    continuationTargetIds: input.continuationTargetIds,
    usedTurnKeys: input.usedTurnKeys,
    combatActive: input.combatActive,
    currentTurnActorId: input.currentTurnActorId,
    dmApproved: input.dmApproved,
    triggerContext: input.triggerContext,
    confirmedBy: input.confirmedBy,
    inventoryInstanceId: input.command.inventoryInstanceId,
    selectedInventoryItem,
  })
}
