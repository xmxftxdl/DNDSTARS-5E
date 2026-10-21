const damageTypes = new Set(['acid','bludgeoning','cold','fire','force','lightning','necrotic','piercing','poison','psychic','radiant','slashing','thunder'])
/** Missing durability is unknown, not indestructible and not zero HP. */
export function normalizeGeometryDurability(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const { hitPoints, maxHitPoints, damageThreshold = 0 } = value
  if (![hitPoints, maxHitPoints, damageThreshold].every(Number.isSafeInteger) ||
      maxHitPoints < 1 || maxHitPoints > 1000000 || hitPoints < 0 || hitPoints > maxHitPoints ||
      damageThreshold < 0 || damageThreshold > 1000000) return undefined
  const { armorClass, damageImmunities } = value
  if (armorClass != null && (!Number.isSafeInteger(armorClass) || armorClass < 1 || armorClass > 40)) return undefined
  if (damageImmunities != null && (!Array.isArray(damageImmunities) || damageImmunities.length > 13 ||
      new Set(damageImmunities).size !== damageImmunities.length || damageImmunities.some(type => !damageTypes.has(type)))) return undefined
  return { hitPoints, maxHitPoints, damageThreshold,
    ...(armorClass == null ? {} : { armorClass }),
    ...(damageImmunities == null ? {} : { damageImmunities: [...damageImmunities] }),
  }
}

export function geometryEntityDestroyed(entity) {
  return normalizeGeometryDurability(entity?.dnd5eDurability)?.hitPoints === 0
}

export function damageGeometryEntity(entity, amount, damageType) {
  const durability = normalizeGeometryDurability(entity?.dnd5eDurability)
  if (!durability || !Number.isSafeInteger(amount) || amount < 0 || (damageType != null && !damageTypes.has(damageType))) return undefined
  const damage = amount < durability.damageThreshold || durability.damageImmunities?.includes(damageType) ? 0 : amount
  return { dnd5eDurability: { ...durability, hitPoints: Math.max(0, durability.hitPoints - damage) } }
}
