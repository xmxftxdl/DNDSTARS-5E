import { cloneDnd5eFeatureClassRequirements } from './independentSpellGrants'
import { cloneDnd5eFeatureChoiceRequirements, type Dnd5eFeatureChoiceRequirement } from './featureChoiceRequirements'
import { cloneDnd5eKnownSpellRequirements } from './featureSpellRequirements'
import { cloneDnd5eFeatureRuleCapabilities, type Dnd5eFeatureRuleCapability } from './featureRuleCapabilities'

export type Dnd5eFeatureEligibility =
  | { kind: 'all' | 'any'; requirements: readonly Dnd5eFeatureEligibility[] }
  | { kind: 'known-spell'; spellId: string }
  | { kind: 'feature'; featureId: string }
  | { kind: 'rule-capability'; capabilityId: string; classId?: string }
  | { kind: 'class-level'; classId: string; minimumLevel: number }
  | ({ kind: 'class-choice' } & Dnd5eFeatureChoiceRequirement)

export function cloneDnd5eFeatureEligibility(value: unknown, label: string): Dnd5eFeatureEligibility | undefined {
  if (value == null) return undefined
  let count = 0
  const visit = (raw: unknown, depth: number): Dnd5eFeatureEligibility => {
    if (++count > 128 || depth > 8 || !raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error(`${label}: invalid eligibility tree`)
    const node = raw as Record<string, unknown>
    if (node.kind === 'all' || node.kind === 'any') {
      if (!Array.isArray(node.requirements) || !node.requirements.length || node.requirements.length > 32) throw Error(`${label}: invalid eligibility alternatives`)
      return { kind: node.kind, requirements: node.requirements.map(child => visit(child, depth + 1)) }
    }
    if (node.kind === 'known-spell') {
      const ids = cloneDnd5eKnownSpellRequirements([node.spellId], label)!
      return { kind: node.kind, spellId: ids[0] }
    }
    if (node.kind === 'feature') {
      const ids = cloneDnd5eKnownSpellRequirements([node.featureId], label)!
      return { kind: node.kind, featureId: ids[0] }
    }
    if (node.kind === 'class-level') {
      const requirement = cloneDnd5eFeatureClassRequirements([node], label)![0]
      return { kind: node.kind, classId: requirement.classId, minimumLevel: requirement.minimumLevel }
    }
    if (node.kind === 'rule-capability') {
      const capability = cloneDnd5eFeatureRuleCapabilities([{ id: node.capabilityId, classId: node.classId }], label)![0]
      return { kind: node.kind, capabilityId: capability.id, ...(capability.classId ? { classId: capability.classId } : {}) }
    }
    if (node.kind === 'class-choice') return { kind: node.kind, ...cloneDnd5eFeatureChoiceRequirements([node], label)![0] }
    throw Error(`${label}: unknown eligibility kind`)
  }
  return visit(value, 0)
}

export function evaluateDnd5eFeatureEligibility(
  node: Dnd5eFeatureEligibility,
  evaluateLeaf: (leaf: Exclude<Dnd5eFeatureEligibility, { kind: 'all' | 'any' }>) => boolean,
): boolean {
  if (node.kind === 'all') return node.requirements.every(child => evaluateDnd5eFeatureEligibility(child, evaluateLeaf))
  if (node.kind === 'any') return node.requirements.some(child => evaluateDnd5eFeatureEligibility(child, evaluateLeaf))
  return evaluateLeaf(node as Exclude<Dnd5eFeatureEligibility, { kind: 'all' | 'any' }>)
}

/** Direct feature/feat references only; unresolved external/derived IDs need installation evidence. */
export function dnd5eFeatureEligibilityReferenceIssues(
  packageId: string,
  entries: readonly { id: string; eligibility?: Dnd5eFeatureEligibility; ruleCapabilities?: readonly Dnd5eFeatureRuleCapability[] }[],
): string[] {
  const qualify = (id: string) => id.includes(':') ? id : `${packageId}:${id}`
  const ids = new Set(entries.map(entry => qualify(entry.id)))
  const issues = new Set<string>()
  const visit = (node: Dnd5eFeatureEligibility, owner: string): void => {
    if (node.kind === 'all' || node.kind === 'any') for (const child of node.requirements) visit(child, owner)
    if (node.kind === 'feature' && !ids.has(qualify(node.featureId))) {
      issues.add(`特性 ${owner} 的前置依赖 ${qualify(node.featureId)} 未在包内独立特性/专长中解析；需核验外部或派生特性的安装与授权。`)
    }
    if (node.kind === 'rule-capability' && !entries.some(entry => entry.id !== owner && entry.ruleCapabilities?.some(capability =>
      capability.id === node.capabilityId && (!node.classId || capability.classId === node.classId)))) {
      issues.add(`特性 ${owner} 的能力类别依赖 ${node.capabilityId} 未在包内独立特性/专长中解析；需核验职业选项、子职或外部能力提供者。`)
    }
  }
  for (const entry of entries) if (entry.eligibility) visit(entry.eligibility, entry.id)
  return [...issues]
}
