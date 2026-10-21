/** Rules identity for prerequisites only; never grants an action or active effect. */
export interface Dnd5eFeatureRuleCapability { id: string; classId?: string }

export function cloneDnd5eFeatureRuleCapabilities(value: unknown, label: string): readonly Dnd5eFeatureRuleCapability[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value) || !value.length || value.length > 32 || value.some(entry =>
    !entry || typeof entry.id !== 'string' || !/^[a-z0-9][a-z0-9._-]*:[a-z0-9][a-z0-9._:-]{0,159}$/.test(entry.id) ||
    (entry.classId != null && (typeof entry.classId !== 'string' || !/^[a-z0-9][a-z0-9._:-]{0,159}$/.test(entry.classId)))) ||
    new Set(value.map(entry => `${entry.id}/${entry.classId ?? ''}`)).size !== value.length) throw Error(`${label}: invalid rule capabilities`)
  return value.map(entry => ({ id: entry.id, ...(entry.classId != null ? { classId: entry.classId } : {}) }))
}
