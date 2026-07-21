/** Shared D&D 5e damage vocabulary kept independent from the large SRD monster catalog. */
export const DND5E_DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder',
] as const

export type Dnd5eDamageType = (typeof DND5E_DAMAGE_TYPES)[number]
