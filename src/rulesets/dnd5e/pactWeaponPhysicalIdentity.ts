import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry, Dnd5eInventoryItemTemplate } from '../../types/inventory'

export type PactPhysicalIdentity = { schemaVersion: 1; inventoryInstanceId: string; equipmentId: string }
type PhysicalEntry = Dnd5eInventoryEntry & { pactWeaponPhysicalIdentity?: PactPhysicalIdentity }
const validId = (value: unknown): value is string => typeof value === 'string' && /^pact-weapon:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)

/** Identity only. This marker never grants a bonus, proficiency, focus, or a bond. */
export function validPactWeaponPhysicalIdentity(entry: Dnd5eInventoryEntry): PactPhysicalIdentity | undefined {
 const marker = (entry as PhysicalEntry).pactWeaponPhysicalIdentity
 return marker?.schemaVersion === 1 && marker.inventoryInstanceId === entry.instanceId && validId(marker.equipmentId) &&
  entry.quantity === 1 && entry.item?.equipment?.dnd5e?.kind === 'weapon' ? { ...marker } : undefined
}

/** Rebuild the exact equipment identity after the canonical template lookup.
 * The catalogue template remains unchanged and is still usable by drop/pickup. */
export function projectPactWeaponPhysicalTemplate(entry: Dnd5eInventoryEntry, template: Dnd5eInventoryItemTemplate): Dnd5eInventoryItemTemplate {
 const marker = validPactWeaponPhysicalIdentity(entry)
 if (!marker || template.equipment?.dnd5e?.kind !== 'weapon') return template
 return { ...template, equipment: { ...template.equipment, id: marker.equipmentId,
  allowedSlots: [...new Set([...(template.equipment.allowedSlots ?? []),'mainWeapon' as const,'offHand' as const])],
  baseEquipmentId: template.equipment.baseEquipmentId ?? template.equipment.id } }
}

/** Called only inside the real Host binding/summon plan. It gives one actual
 * inventory instance a durable bounded equipment id, without changing rules. */
export function establishPactWeaponPhysicalIdentity(characters: readonly Character[], ownerId: string, inventoryInstanceId: string) {
 const fail = (reason: string) => ({ok:false as const,reason})
 const owners = characters.filter(actor => actor.id === ownerId)
 const matches = characters.flatMap(actor => (actor.dnd5eInventory?.entries ?? []).filter(entry => entry.instanceId === inventoryInstanceId).map(entry => ({actor,entry})))
 if (owners.length !== 1 || matches.length !== 1 || matches[0].actor.id !== ownerId) return fail('pact-instance-identity-ambiguous')
 const {entry} = matches[0], existing = validPactWeaponPhysicalIdentity(entry)
 if (entry.quantity !== 1 || entry.condition?.destroyed || entry.item.equipment?.dnd5e?.kind !== 'weapon' ||
  ((entry as PhysicalEntry).pactWeaponPhysicalIdentity != null && !existing)) return fail('pact-instance-identity-invalid')
 const marker:PactPhysicalIdentity = existing ?? {schemaVersion:1,inventoryInstanceId,equipmentId:'pact-weapon:'+crypto.randomUUID()}
 if (characters.some(actor => actor.dnd5eInventory?.entries.some(other => other.instanceId !== inventoryInstanceId &&
  validPactWeaponPhysicalIdentity(other)?.equipmentId === marker.equipmentId))) return fail('pact-equipment-identity-conflict')
 const owner = owners[0], slot = entry.equippedSlot
 if (slot && owner.equipment?.[slot]?.id !== entry.item.equipment.id) return fail('pact-equipped-instance-changed')
 const projected = projectPactWeaponPhysicalTemplate({...entry,pactWeaponPhysicalIdentity:marker} as PhysicalEntry, entry.item)
 const next:Character = {...owner,equipment:slot?{...owner.equipment,[slot]:projected.equipment}:owner.equipment,
  dnd5eInventory:{...owner.dnd5eInventory!,revision:(owner.dnd5eInventory!.revision??0)+Number(!existing),entries:owner.dnd5eInventory!.entries.map(row=>
   row.instanceId===inventoryInstanceId?{...row,pactWeaponPhysicalIdentity:marker,item:projected}:row)}}
 return {ok:true as const,characters:characters.map(actor=>actor.id===ownerId?next:actor),identity:marker}
}
