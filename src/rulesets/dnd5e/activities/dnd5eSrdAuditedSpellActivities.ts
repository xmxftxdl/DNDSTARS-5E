// Generated rule data is authored and checked by scripts/content/srdSpellActivities.authoring.ts.
// Runtime access remains data-only; callers receive independent copies.
import snapshot from '../../../content/srd-5.1/audited-spells.json'
import dictionary from '../../../content/srd-5.1/localization/audited.zh-CN.json'
import { hydrateLocalizedData } from '../../../domain/packages/localizedData'
import type { RegisteredContentDefinition } from '../../../domain/content/contentDefinitionRegistry'
import type { RegisteredDnd5ePluginSpell } from '../plugins/pluginRegistryContracts'
import type { Dnd5eActivityChoiceOptionV1, Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
export { dnd5eSrdAuditedSpellDecisionV1, type Dnd5eSrdAuditedSpellTargetV1 } from './dnd5eSrdAuditedSpellDecisions'
export const DND5E_SRD_AUDITED_SPELL_PACKAGE_ID = 'srd-5.1'
export const DND5E_SRD_AUDITED_SPELL_PACKAGE_VERSION = '1.0.2'
const data = hydrateLocalizedData(snapshot, dictionary) as {
 full: RegisteredContentDefinition[]; partial: RegisteredContentDefinition[]; manual: RegisteredContentDefinition[]
 definitions: Record<string, RegisteredDnd5ePluginSpell>; partialDefinitions: Record<string, RegisteredDnd5ePluginSpell>
 activities: Record<string, Dnd5eActivityDefinitionV1>; partialActivities: Record<string, Dnd5eActivityDefinitionV1>
 overrides: Record<string, Dnd5eActivityDefinitionV1>
 celestial: Dnd5eActivityChoiceOptionV1[][]; elemental: Dnd5eActivityChoiceOptionV1[][]; fey: Dnd5eActivityChoiceOptionV1[][]
 minor: Record<string, Dnd5eActivityChoiceOptionV1[]>; woodland: Record<string, Dnd5eActivityChoiceOptionV1[]>
}
export const DND5E_SRD_AUDITED_PARTIAL_SPELL_IDS = Object.freeze(data.partial.map(s => s.id))
export const DND5E_SRD_AUDITED_FULL_SPELL_IDS = Object.freeze(data.full.map(s => s.id))
export const DND5E_SRD_AUDITED_MANUAL_SPELL_IDS = Object.freeze(data.manual.map(s => s.id))
function lookup<T>(values: Record<string, T>, id: string): T | undefined {
 return Object.hasOwn(values, id) ? structuredClone(values[id]) : undefined
}
export function dnd5eSrdAuditedPartialSpellDefinitionV1(id: string): RegisteredDnd5ePluginSpell | undefined { return lookup(data.partialDefinitions, id) }
export function dnd5eSrdAuditedPartialSpellActivityV1(id: string): Dnd5eActivityDefinitionV1 | undefined { return lookup(data.partialActivities, id) }
export function dnd5eSrdAuditedSpellDefinitionV1(id: string): RegisteredDnd5ePluginSpell | undefined { return lookup(data.definitions, id) }
export function dnd5eSrdAuditedSpellActivityV1(id: string): Dnd5eActivityDefinitionV1 | undefined { return lookup(data.activities, id) }
export function dnd5eSrdAuditedCoreOverrideSpellActivityV1(id: string): Dnd5eActivityDefinitionV1 | undefined { return lookup(data.overrides, id) }
export function dnd5eSrdAuditedManualContentDefinitionsV1(): readonly RegisteredContentDefinition[] { return structuredClone(data.manual) }
export function dnd5eSrdAuditedPartialContentDefinitionsV1(): readonly RegisteredContentDefinition[] { return structuredClone(data.partial) }
export function dnd5eSrdAuditedFullContentDefinitionsV1(): readonly RegisteredContentDefinition[] { return structuredClone(data.full) }
export function dnd5eConjureCelestialChoicesAtSlotV1(slot: number): readonly Dnd5eActivityChoiceOptionV1[] { return structuredClone(data.celestial[slot >= 9 ? 9 : 7]) }
export function dnd5eConjureElementalChoicesAtSlotV1(slot: number): readonly Dnd5eActivityChoiceOptionV1[] { return structuredClone(data.elemental[Math.max(5, Math.min(9, Math.floor(slot)))] ?? []) }
export function dnd5eConjureFeyChoicesAtSlotV1(slot: number): readonly Dnd5eActivityChoiceOptionV1[] { return structuredClone(data.fey[Math.max(6, Math.min(9, Math.floor(slot)))] ?? []) }
export function dnd5eConjureMinorElementalChoicesForFormationV1(id: string): readonly Dnd5eActivityChoiceOptionV1[] { return lookup(data.minor, id) ?? [] }
export function dnd5eConjureWoodlandBeingChoicesForFormationV1(id: string): readonly Dnd5eActivityChoiceOptionV1[] { return lookup(data.woodland, id) ?? [] }
