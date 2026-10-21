import type { Dnd5eCombatant, Dnd5eCombatEvent } from './headlessCombatEngine'
import { resourceBalanceAfterRest } from '../../lib/resourceRestRecovery'
import { dnd5eCombatantClassLevel } from './headlessCombatPrimitives'
import type { Dnd5eInventoryResourceSnapshot } from './inventoryHeadlessRuntime'

/** Resource portion of a Host-validated short rest. The caller must also settle
 * effect cleanup, ability recovery and completion receipts; this grants no rest
 * completion by itself. No HP, Hit Dice, attunement or turn actions are changed. */
export function restoreDnd5eCombatShortRestResources(target: Dnd5eCombatant, events: Dnd5eCombatEvent[]): void {
  for (const [key, resource] of Object.entries(target.classResources)) {
    if (target.simulacrumCannotRegainSpellSlots && /(?:spell-slot|pact-slot)/.test(key)) continue
    const rule = target.classResourceRestRecovery?.[key]?.['short-rest']
    const restored = rule ? resourceBalanceAfterRest(resource.current, resource.max, rule)
      : target.classResourceResets?.[key] === 'short-rest'
      ? resource.max
      : key === 'dnd5e-sorcery-points' && dnd5eCombatantClassLevel(target, 'sorcerer') >= 20
        ? Math.min(resource.max, resource.current + 4)
        : resource.current
    if (restored === resource.current) continue
    target.classResources[key] = { ...resource, current: restored }
    events.push({ type: 'class-resource-restored', actorId: target.id, resourceKey: key, current: restored, max: resource.max })
  }

  // Both views refer to the same item instance. Restore every view together so
  // subsequent equipment use and the conservative map merge see the same value.
  let changed = false
  const restore = <T extends Dnd5eInventoryResourceSnapshot>(snapshot: T): T => {
    let snapshotChanged = false
    const resources = Object.fromEntries(Object.entries(snapshot.resources).map(([key, resource]) => {
      if (resource.resetOn !== 'short-rest' || resource.current >= resource.maximum) return [key, resource]
      changed = snapshotChanged = true
      return [key, { ...resource, current: resource.maximum }]
    }))
    return snapshotChanged ? { ...snapshot, resources } : snapshot
  }
  target.inventoryResourceSnapshots = target.inventoryResourceSnapshots?.map(restore)
  target.inventoryHeadlessEffects = target.inventoryHeadlessEffects?.map(restore)
  if (changed) target.inventoryRevision = Math.max(0, Math.floor(target.inventoryRevision ?? 0)) + 1
}
