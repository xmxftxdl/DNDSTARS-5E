import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { dnd5eActivityTargetForChoicesV1 } from './dnd5eActivityChoices'
import { dnd5eActivityCreatureTypeMatches } from './dnd5eActivityTargetExclusions'
import { registerDnd5eHostReceipt, registerDnd5eHostReceiptSlot } from '../hostTransactionClone'

export interface Dnd5eActivityTargetQualificationV1 {
  id: string
  label: string
  audience: 'dm' | 'target-controller'
  creatureTypes?: readonly string[]
  whenChoice?: { choiceId: string; optionIds: readonly string[] }
}

export function dnd5eRequiredTargetQualificationsV1(activity: Dnd5eActivityDefinitionV1, choices: Readonly<Record<string, string>> | undefined): readonly Dnd5eActivityTargetQualificationV1[] {
  const target = dnd5eActivityTargetForChoicesV1(activity, choices)
  if (target.kind !== 'creature') return []
  return (target.requiredQualifications ?? []).filter(requirement => !requirement.whenChoice ||
    requirement.whenChoice.optionIds.includes(choices?.[requirement.whenChoice.choiceId] ?? ''))
}

type QualificationAction = { actorId: string; pluginId: string; actionId: string; transactionId?: string; payload?: unknown }
const authority = Symbol('host-target-qualifications')
registerDnd5eHostReceiptSlot(authority)
interface Receipt {
  actorId: string
  pluginId: string
  actionId: string
  transactionId: string
  choices: string
  qualified: Readonly<Record<string, readonly string[]>>
  bodyParts?: Readonly<Record<string, Readonly<Record<string, boolean>>>>
}
function choicesIdentity(action: QualificationAction): string {
  const payload = action.payload && typeof action.payload === 'object' && !Array.isArray(action.payload) ? action.payload as Record<string, unknown> : undefined
  const choices = payload?.activityChoices
  if (!choices || typeof choices !== 'object' || Array.isArray(choices)) return '[]'
  return JSON.stringify(Object.entries(choices).sort(([a], [b]) => a.localeCompare(b)))
}

/** Application Host only. A JSON action/payload cannot represent this private symbol receipt. */
export function authorizeDnd5eActivityTargetQualificationsV1(action: QualificationAction, qualified: Readonly<Record<string, readonly string[]>>, bodyParts?: Readonly<Record<string, Readonly<Record<string, boolean>>>>): void {
  if (!action.transactionId) throw Error('Target qualification requires a concrete transaction')
  const entries = Object.entries(qualified)
  if (entries.some(([id, keys]) => !id || !Array.isArray(keys) || keys.some(key => !/^[a-z0-9][a-z0-9._:-]{0,79}$/.test(key)))) throw Error('Invalid qualification receipt')
  if (bodyParts && Object.entries(bodyParts).some(([id, parts]) => !id || !parts || Object.entries(parts).some(([part, present]) => !/^[a-z][a-z0-9-]{0,63}$/.test(part) || typeof present !== 'boolean'))) throw Error('Invalid anatomy receipt')
  const receipt: Receipt = registerDnd5eHostReceipt(Object.freeze({ actorId: action.actorId, pluginId: action.pluginId, actionId: action.actionId,
    transactionId: action.transactionId, choices: choicesIdentity(action),
    qualified: Object.freeze(Object.fromEntries(entries.map(([id, keys]) => [id, Object.freeze([...new Set(keys)])]))),
    bodyParts: bodyParts ? Object.freeze(Object.fromEntries(Object.entries(bodyParts).map(([id, parts]) => [id, Object.freeze({ ...parts })]))) : undefined }))
  // Enumerable symbols survive trusted object spreads and disappear on JSON serialization.
  Object.defineProperty(action, authority, { value: receipt, enumerable: true, configurable: true })
}

export function dnd5eHostTargetQualificationsV1(action: QualificationAction): Readonly<Record<string, readonly string[]>> | undefined {
  const receipt = (action as QualificationAction & { [authority]?: Receipt })[authority]
  if (!receipt || receipt.actorId !== action.actorId || receipt.pluginId !== action.pluginId || receipt.actionId !== action.actionId ||
    receipt.transactionId !== action.transactionId || receipt.choices !== choicesIdentity(action)) return undefined
  return receipt.qualified
}

/** Ephemeral per-cast facts cannot be supplied by a player's JSON action. */
export function dnd5eHostTargetBodyPartsV1(action: QualificationAction): Readonly<Record<string, Readonly<Record<string, boolean>>>> | undefined {
  if (!dnd5eHostTargetQualificationsV1(action)) return undefined
  return (action as QualificationAction & { [authority]?: Receipt })[authority]?.bodyParts
}

/** Collect all decisions before installing a receipt. Unknown creature identity fails closed. */
export async function collectDnd5eActivityTargetQualificationsV1(input: {
  action: QualificationAction
  activity: Dnd5eActivityDefinitionV1
  choices?: Readonly<Record<string, string>>
  targets: readonly { id: string; label: string; characterId?: string; creatureType?: string; bodyPartPresence?: Readonly<Record<string, boolean>> }[]
  confirm: (qualification: Dnd5eActivityTargetQualificationV1, target: { id: string; label: string; characterId?: string; creatureType?: string }) => Promise<boolean>
  confirmBodyPart?: (part: string, target: { id: string; label: string }) => Promise<boolean | undefined>
}): Promise<boolean> {
  delete (input.action as QualificationAction & { [authority]?: Receipt })[authority]
  const identity = () => JSON.stringify([input.action.actorId, input.action.pluginId, input.action.actionId, input.action.transactionId, choicesIdentity(input.action)])
  const before = identity()
  const requirements = dnd5eRequiredTargetQualificationsV1(input.activity, input.choices)
  const parts = [...new Set(input.activity.outcomes.flatMap(outcome => outcome.operations.flatMap(operation => operation.kind === 'damage' && operation.destroysBodyPartOnDeath ? [operation.destroysBodyPartOnDeath.part] : [])))]
  if (!requirements.length && !parts.length) return true
  const qualified: Record<string, string[]> = {}
  const bodyParts: Record<string, Record<string, boolean>> = {}
  for (const target of input.targets) {
    for (const requirement of requirements) {
      if (requirement.creatureTypes && (!target.creatureType || !requirement.creatureTypes.some(type => dnd5eActivityCreatureTypeMatches(type, target.creatureType!)))) return false
      if (!await input.confirm(requirement, target)) return false
      ;(qualified[target.id] ??= []).push(requirement.id)
    }
    for (const part of parts) {
      if (typeof target.bodyPartPresence?.[part] === 'boolean') continue
      const present = await input.confirmBodyPart?.(part, target)
      if (present == null) return false
      ;(bodyParts[target.id] ??= {})[part] = present
    }
  }
  if (identity() !== before) return false
  authorizeDnd5eActivityTargetQualificationsV1(input.action, qualified, bodyParts)
  return true
}
