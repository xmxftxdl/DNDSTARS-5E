import type { PreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { registerDnd5eHostReceipt, registerDnd5eHostReceiptSlot } from './hostTransactionClone'

const authority = Symbol('spell-placement-qualification')
registerDnd5eHostReceiptSlot(authority)
const issued = new WeakSet<object>()
type Receipt = { identity: string }
type QualifiedCast = PreparedDnd5ePluginSpellCast & { [authority]?: Receipt }

function prompt(prepared: PreparedDnd5ePluginSpellCast): string | undefined {
  const target = prepared.activity?.target
  return target?.kind === 'area' ? target.placementQualification?.prompt : undefined
}
function identity(prepared: PreparedDnd5ePluginSpellCast): string {
  // Resolution later appends target consent and roll bookkeeping. Those facts
  // do not change the approved location and must not invalidate its receipt.
  const placement = Object.fromEntries(Object.entries(prepared.payload).filter(([key]) =>
    key.startsWith('areaTarget') || key === 'targetElevationFeet' || key === 'activityChoices')
    .sort(([a], [b]) => a.localeCompare(b)))
  return JSON.stringify([prepared.action.id, prepared.map.id, prepared.actorToken.id, prepared.actor.id,
    prepared.spell.id, prepared.activity?.id, prepared.activity?.target, prepared.activityTargetCell,
    prepared.activityAreaPlacement, placement, prepared.slotLevel])
}

/** Host-local fact receipt. Player JSON and a changed placement cannot reuse approval. */
export function dnd5eSpellPlacementQualified(prepared: PreparedDnd5ePluginSpellCast): boolean {
  if (!prompt(prepared)) return true
  const receipt = (prepared as QualifiedCast)[authority]
  return !!receipt && issued.has(receipt) && receipt.identity === identity(prepared)
}

export async function authorizeDnd5eSpellPlacement(prepared: PreparedDnd5ePluginSpellCast,
  confirm: (prompt: string, location: { mapName: string; col: number; row: number; elevationFeet?: number }) => Promise<boolean>): Promise<boolean> {
  if (dnd5eSpellPlacementQualified(prepared)) return true
  delete (prepared as QualifiedCast)[authority]
  const question = prompt(prepared), cell = prepared.activityTargetCell
  if (!question || !cell) return false
  const before = identity(prepared)
  if (!await confirm(question, { mapName: prepared.map.name, col: cell.col, row: cell.row,
    elevationFeet: prepared.payload.targetElevationFeet }) || identity(prepared) !== before) return false
  const receipt = registerDnd5eHostReceipt(Object.freeze({ identity: before }))
  issued.add(receipt)
  Object.defineProperty(prepared, authority, { value: receipt, configurable: true, enumerable: true })
  return true
}
