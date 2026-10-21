/** Explicit physical material, independent of an entity's appearance or HP. */
export const DND5E_ENTITY_MATERIALS = ['earth', 'stone', 'wood', 'metal', 'ice', 'other'] as const
export type Dnd5eEntityMaterial = typeof DND5E_ENTITY_MATERIALS[number]
export function validDnd5eEntityMaterial(value: unknown): value is Dnd5eEntityMaterial {
  return typeof value === 'string' && (DND5E_ENTITY_MATERIALS as readonly string[]).includes(value)
}
