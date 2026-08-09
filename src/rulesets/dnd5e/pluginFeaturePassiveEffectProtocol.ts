import { DND5E_DAMAGE_TYPES, type Dnd5eDamageType } from './damageTypes'

export type Dnd5ePluginFeaturePassiveEffect = {
  schemaVersion: 1
  id: string
  kind: 'damage-reduction'
  trigger: 'before-damage'
  /** Flat reduction applied before temporary HP and ordinary HP. */
  amount: number
  /** Empty or absent means every damage type. */
  damageTypes?: readonly Dnd5eDamageType[]
  /** The incoming resolved damage must meet this value before reduction. */
  minimumIncomingDamage?: number
  /** Checked against HP before this damage; 100 or absent means no threshold. */
  maximumCurrentHitPointPercent?: number
  oncePerTurn?: boolean
}

const VALID_ID = /^[a-z0-9][a-z0-9._-]*$/
const finiteInteger = (value: unknown, minimum: number, maximum: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum

export function cloneDnd5ePluginFeaturePassiveEffects(
  value: readonly Dnd5ePluginFeaturePassiveEffect[] | undefined,
  label: string,
): Dnd5ePluginFeaturePassiveEffect[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) {
    throw new Error(`Invalid plugin passive effects: ${label}`)
  }
  const ids = new Set<string>()
  return value.map((effect: Dnd5ePluginFeaturePassiveEffect) => {
    if (
      !effect || typeof effect !== 'object' || Array.isArray(effect) ||
      effect.schemaVersion !== 1 || !VALID_ID.test(effect.id) || ids.has(effect.id) ||
      effect.kind !== 'damage-reduction' || effect.trigger !== 'before-damage' ||
      !finiteInteger(effect.amount, 1, 1_000_000) ||
      (effect.minimumIncomingDamage != null && !finiteInteger(effect.minimumIncomingDamage, 1, 1_000_000)) ||
      (effect.maximumCurrentHitPointPercent != null && !finiteInteger(effect.maximumCurrentHitPointPercent, 1, 100)) ||
      (effect.oncePerTurn != null && typeof effect.oncePerTurn !== 'boolean') ||
      (effect.damageTypes != null && (
        !Array.isArray(effect.damageTypes) || effect.damageTypes.length < 1 ||
        effect.damageTypes.length > DND5E_DAMAGE_TYPES.length ||
        effect.damageTypes.some((type: Dnd5eDamageType) => !(DND5E_DAMAGE_TYPES as readonly string[]).includes(type))
      ))
    ) throw new Error(`Invalid plugin passive damage reduction: ${label}`)
    ids.add(effect.id)
    return {
      schemaVersion: 1,
      id: effect.id,
      kind: 'damage-reduction',
      trigger: 'before-damage',
      amount: effect.amount,
      ...(effect.damageTypes?.length ? { damageTypes: [...new Set<Dnd5eDamageType>(effect.damageTypes)] } : {}),
      ...(effect.minimumIncomingDamage != null ? { minimumIncomingDamage: effect.minimumIncomingDamage } : {}),
      ...(effect.maximumCurrentHitPointPercent != null && effect.maximumCurrentHitPointPercent < 100
        ? { maximumCurrentHitPointPercent: effect.maximumCurrentHitPointPercent }
        : {}),
      ...(effect.oncePerTurn === true ? { oncePerTurn: true } : {}),
    }
  })
}
