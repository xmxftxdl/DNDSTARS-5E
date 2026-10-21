import { validateDnd5eAdvancementDefinitionV1, type Dnd5eBuildGrantV1 } from './activities/dnd5eAdvancementContracts'

export interface Dnd5eFeatureClassRequirement { classId: string; minimumLevel: number }
export function cloneDnd5eFeatureClassRequirements(value: unknown, label: string): readonly Dnd5eFeatureClassRequirement[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value) || !value.length || value.length > 20 || value.some(entry =>
    !entry || typeof entry.classId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(entry.classId) ||
    !Number.isInteger(entry.minimumLevel) || entry.minimumLevel < 1 || entry.minimumLevel > 20) ||
    new Set(value.map(entry=>entry.classId)).size !== value.length) throw new Error(`${label}: invalid class requirements`)
  return structuredClone(value)
}

/** Fixed grants owned by an installed feature; no receipt can outlive its owner. */
export type Dnd5eIndependentSpellGrant = Extract<Dnd5eBuildGrantV1, { kind: 'spell' }> & {
  mode: 'cantrip' | 'at-will' | 'once-per-long-rest' | 'once-per-short-rest'
}

export function cloneDnd5eIndependentSpellGrants(value: unknown, label: string): readonly Dnd5eIndependentSpellGrant[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value) || !value.length || value.length > 32) throw new Error(`${label}: invalid independent spell grants`)
  const ids = new Set<string>()
  for (const grant of value) {
    if (!grant || grant.kind !== 'spell' || !['cantrip','at-will','once-per-long-rest','once-per-short-rest'].includes(grant.mode) ||
      !grant.ability || ids.has(grant.spellId)) throw new Error(`${label}: invalid independent spell grant`)
    const errors = validateDnd5eAdvancementDefinitionV1({schemaVersion:1,id:'spell-grants',level:1,kind:'build-grant',grants:[grant]})
    if (errors.length || (grant.mode === 'cantrip' && grant.castAtLevel != null && grant.castAtLevel !== 0)) {
      throw new Error(`${label}: invalid independent spell grant: ${errors.join('; ')}`)
    }
    ids.add(grant.spellId)
  }
  return structuredClone(value)
}
