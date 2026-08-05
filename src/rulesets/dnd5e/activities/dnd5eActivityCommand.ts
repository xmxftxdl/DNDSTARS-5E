import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './dnd5eActivityRegistry'
import {
  resolveDnd5eActivity,
  type Dnd5eActivityActorSnapshot,
  type Dnd5eActivityExecutionResult,
  type Dnd5eActivityRollMode,
} from './dnd5eActivityExecutor'
import type { Dnd5eDamageType } from '../damageTypes'
import type { Dnd5eFormulaRollResult } from './dnd5eFormula'
import type { Dnd5eActivityAreaPlacementV1 } from './dnd5eActivityContracts'
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
  targetIds: readonly string[]
  /** Ordered projectile/beam allocation. Repeated ids are intentional. */
  projectileTargetIds?: readonly string[]
  /** Client-selected placement only; geometry is rebuilt by the authority. */
  areaPlacement?: Dnd5eActivityAreaPlacementV1
  castLevel?: number
  choices?: Readonly<Record<string, string>>
  expectedRevision: number
  /** Inventory instance selected by the client; the Host reloads and validates it. */
  inventoryInstanceId?: string
  /** Monotonic inventory revision observed while preparing this action. */
  expectedInventoryRevision?: number
}

export interface Dnd5eActivityAuthorityInput {
  command: Dnd5eExecuteActivityCommandV1
  currentRevision: number
  actor: Dnd5eActivityActorSnapshot
  targets: readonly Dnd5eActivityActorSnapshot[]
  /** Rolls are supplied by the Host/authority, never copied from the command. */
  authoritativeRolls: Readonly<Record<string, Dnd5eFormulaRollResult>>
  checkRollModes?: Readonly<Record<string, Dnd5eActivityRollMode>>
  distanceFeetByTargetId?: Readonly<Record<string, number>>
  areaPlacementDistanceFeet?: number
  /** Target ids recomputed by the Host from the authoritative area geometry. */
  areaTargetIds?: readonly string[]
  parentDamageType?: Dnd5eDamageType
  usedTurnKeys?: ReadonlySet<string>
  dmApproved?: boolean
  /** Host-owned character snapshot used only for inventory-bound Activities. */
  inventoryOwner?: Character
}

export type Dnd5eActivityAuthorityResult = Dnd5eActivityExecutionResult | {
  ok: false
  reason: 'invalid-command' | 'stale-revision' | 'content-version-mismatch' | 'unknown-activity' | 'unauthorized-actor' | 'target-snapshot-mismatch'
  details: readonly string[]
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,159}$/
const SEMVER_LIKE = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/

export function validateDnd5eExecuteActivityCommandV1(command: Dnd5eExecuteActivityCommandV1): readonly string[] {
  const errors: string[] = []
  if (command.schemaVersion !== 1) errors.push('unsupported Activity command schema')
  for (const [label, value] of Object.entries({
    commandId: command.commandId,
    actorId: command.actorId,
    packageId: command.packageId,
    activityId: command.activityId,
  })) if (!ID_PATTERN.test(value)) errors.push(`invalid ${label}`)
  if (!SEMVER_LIKE.test(command.packageVersion)) errors.push('invalid packageVersion')
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) errors.push('invalid expectedRevision')
  if (command.inventoryInstanceId != null && !ID_PATTERN.test(command.inventoryInstanceId)) {
    errors.push('invalid inventoryInstanceId')
  }
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
  if (!Array.isArray(command.targetIds) || command.targetIds.length > 256 || command.targetIds.some((id) => !ID_PATTERN.test(id))) {
    errors.push('invalid targetIds')
  }
  if (new Set(command.targetIds).size !== command.targetIds.length) errors.push('duplicate targetIds')
  if (
    command.projectileTargetIds != null &&
    (!Array.isArray(command.projectileTargetIds) || command.projectileTargetIds.length > 256 ||
      command.projectileTargetIds.some((id) => !ID_PATTERN.test(id)))
  ) errors.push('invalid projectileTargetIds')
  if (command.areaPlacement != null && (
    !Number.isFinite(command.areaPlacement.x) || !Number.isFinite(command.areaPlacement.y) ||
    (command.areaPlacement.elevationFeet != null && !Number.isFinite(command.areaPlacement.elevationFeet)) ||
    (command.areaPlacement.angleDegrees != null && !Number.isFinite(command.areaPlacement.angleDegrees))
  )) errors.push('invalid areaPlacement')
  if (Object.entries(command.choices ?? {}).some(([key, value]) => !ID_PATTERN.test(key) || !ID_PATTERN.test(value))) {
    errors.push('invalid choices')
  }
  return errors
}

/**
 * Authority-side prepare/resolve boundary. Revision, package version, actor,
 * target snapshots, and Host-owned rolls are checked before proposals exist.
 */
export function resolveDnd5eActivityCommand(
  input: Dnd5eActivityAuthorityInput,
): Dnd5eActivityAuthorityResult {
  const commandErrors = validateDnd5eExecuteActivityCommandV1(input.command)
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
  const activity = getRegisteredDnd5eActivity(input.command.packageId, input.command.activityId)
  if (!activity) return { ok: false, reason: 'unknown-activity', details: ['Activity is not registered'] }
  const submittedTargetIds = [...input.command.targetIds].sort()
  const snapshotTargetIds = input.targets.map((target) => target.id).sort()
  if (submittedTargetIds.length !== snapshotTargetIds.length || submittedTargetIds.some((id, index) => id !== snapshotTargetIds[index])) {
    return { ok: false, reason: 'target-snapshot-mismatch', details: ['authority target snapshots do not match the submitted target ids'] }
  }
  if (input.command.projectileTargetIds?.some((id) => !input.command.targetIds.includes(id))) {
    return { ok: false, reason: 'target-snapshot-mismatch', details: ['projectile targets are not included in authority snapshots'] }
  }
  if (activity.target.kind === 'area') {
    if (!input.command.areaPlacement) {
      return { ok: false, reason: 'invalid-command', details: ['area placement is required'] }
    }
    const authoritativeAreaTargets = [...(input.areaTargetIds ?? [])].sort()
    if (
      authoritativeAreaTargets.length !== submittedTargetIds.length ||
      authoritativeAreaTargets.some((id, index) => id !== submittedTargetIds[index])
    ) return { ok: false, reason: 'target-snapshot-mismatch', details: ['submitted targets do not match authoritative area geometry'] }
  } else if (input.command.areaPlacement != null) {
    return { ok: false, reason: 'invalid-command', details: ['non-area Activity cannot include area placement'] }
  }
  return resolveDnd5eActivity({
    activity,
    actor: input.actor,
    targets: input.targets,
    castLevel: input.command.castLevel,
    rolls: input.authoritativeRolls,
    checkRollModes: input.checkRollModes,
    distanceFeetByTargetId: input.distanceFeetByTargetId,
    areaPlacement: input.command.areaPlacement,
    areaPlacementDistanceFeet: input.areaPlacementDistanceFeet,
    projectileTargetIds: input.command.projectileTargetIds,
    parentDamageType: input.parentDamageType,
    choices: input.command.choices,
    usedTurnKeys: input.usedTurnKeys,
    dmApproved: input.dmApproved,
  })
}
