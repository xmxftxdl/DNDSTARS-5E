import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import type { Dnd5eContentPackageV2 } from '../contentPackageV2'
import { declarativeSubclassCompatibilityReportV1 } from '../declarativeSubclassAbility'
import { dnd5eActivityFromCustomHeadlessAction } from './legacyCustomHeadlessActivityAdapter'
import {
  dnd5eActivitiesFromMonster,
  dnd5eActivityFromDeclarativeSubclassAbility,
  dnd5eActivityFromPluginFeature,
  dnd5eActivityFromPluginItem,
  dnd5eActivityFromSpellDefinition,
} from './legacyContentActivityAdapters'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'

export type Dnd5eActivityProjectionSourceKind =
  | 'headless-action'
  | 'feature'
  | 'feat'
  | 'item'
  | 'spell'
  | 'class'
  | 'subclass'
  | 'subclass-ability'
  | 'race'
  | 'background'
  | 'monster'
  | 'monster-action'

export interface Dnd5eActivityProjectionEntryV1 {
  sourceKind: Dnd5eActivityProjectionSourceKind
  sourceId: string
  activityId: string
  mode: 'adapted' | 'legacy-fallback' | 'dm-adjudication' | 'display-only'
  issues: readonly string[]
}

export interface Dnd5eContentPackageActivityProjectionV1 {
  schemaVersion: 1
  packageId: string
  packageVersion: string
  activities: readonly Dnd5eActivityDefinitionV1[]
  entries: readonly Dnd5eActivityProjectionEntryV1[]
  counts: {
    total: number
    adapted: number
    legacyFallback: number
    dmAdjudication: number
    displayOnly: number
  }
}

function safeManualFallback(
  candidate: Dnd5eActivityDefinitionV1,
  issues: readonly string[],
): Dnd5eActivityDefinitionV1 {
  return {
    schemaVersion: 1,
    id: candidate.id,
    name: candidate.name,
    description: candidate.description,
    activation: candidate.activation,
    invocation: candidate.invocation,
    target: candidate.target.kind === 'self' ? { kind: 'self' } : {
      kind: 'creature', relation: 'any', count: 1, includeSelf: true,
    },
    outcomes: [{
      id: 'migration-fallback',
      when: { kind: 'always' },
      operations: [{
        id: 'migration-manual',
        kind: 'manual-adjudication',
        prompt: '该旧内容尚未完整迁移，请由 DM 使用原有结算流程处理。',
        reason: issues.join('; '),
        requiresDmApproval: true,
      }],
    }],
    automation: automationCapabilityFromLegacyStatus('manual', issues),
    legacySource: candidate.legacySource,
  }
}

/**
 * Converts every executable V2 contribution into a validated Activity catalog.
 * The V2 wire format is intentionally unchanged; this is an internal migration
 * projection and unsupported legacy mechanics remain explicit fallbacks.
 */
export function dnd5eContentPackageActivityProjectionV1(
  value: Dnd5eContentPackageV2,
): Dnd5eContentPackageActivityProjectionV1 {
  const activities: Dnd5eActivityDefinitionV1[] = []
  const entries: Dnd5eActivityProjectionEntryV1[] = []
  const legacyActions = new Map(value.content.headlessActions.map((action) => [action.id, dnd5eActivityFromCustomHeadlessAction(action)]))
  const explicitSources = new Set((value.content.activities ?? []).flatMap((activity) => activity.legacySource
    ? [`${activity.legacySource.kind}:${activity.legacySource.id}`]
    : []))

  const add = (
    sourceKind: Dnd5eActivityProjectionSourceKind,
    sourceId: string,
    candidate: Dnd5eActivityDefinitionV1,
  ): void => {
    const issues = [...validateDnd5eActivityDefinitionV1(candidate)]
    const activity = issues.length ? safeManualFallback(candidate, issues) : candidate
    const fallbackIssues = validateDnd5eActivityDefinitionV1(activity)
    if (fallbackIssues.length) {
      throw new Error(`Activity migration fallback is invalid for ${sourceKind}:${sourceId}: ${fallbackIssues.join('; ')}`)
    }
    activities.push(activity)
    entries.push({
      sourceKind,
      sourceId,
      activityId: activity.id,
      mode: issues.length > 0
        ? 'legacy-fallback'
        : activity.automation.level === 'display-only'
          ? 'display-only'
          : activity.automation.level === 'full'
            ? 'adapted'
            : 'dm-adjudication',
      issues,
    })
  }

  const projectedSourceKind = (activity: Dnd5eActivityDefinitionV1): Dnd5eActivityProjectionSourceKind => {
    const kind = activity.legacySource?.kind
    if (kind === 'custom-headless-action') return 'headless-action'
    return kind ?? 'feature'
  }
  for (const activity of value.content.activities ?? []) {
    add(projectedSourceKind(activity), activity.legacySource?.id ?? activity.id, activity)
  }
  for (const [id, activity] of legacyActions) {
    if (!explicitSources.has(`custom-headless-action:${id}`)) add('headless-action', id, activity)
  }
  for (const feature of value.content.features) {
    if (explicitSources.has(`feature:${feature.id}`)) continue
    const activity = dnd5eActivityFromPluginFeature(feature, feature.action ? legacyActions.get(feature.action.id) : undefined)
    if (activity) add('feature', feature.id, activity)
  }
  for (const feat of value.content.feats) {
    if (explicitSources.has(`feat:${feat.id}`)) continue
    const activity = dnd5eActivityFromPluginFeature(feat, feat.action ? legacyActions.get(feat.action.id) : undefined, 'feat')
    if (activity) add('feat', feat.id, activity)
  }
  for (const spell of value.content.spells) {
    if (explicitSources.has(`spell:${spell.id}`)) continue
    const linked = spell.automation?.mode === 'headless-action' ? legacyActions.get(spell.automation.actionId) : undefined
    add('spell', spell.id, dnd5eActivityFromSpellDefinition(spell, spell.automation?.mode ?? 'reference-only', linked))
  }
  for (const item of value.content.items) {
    if (explicitSources.has(`item:${item.id}`)) continue
    const activity = dnd5eActivityFromPluginItem(item)
    if (activity) add('item', item.id, activity)
  }
  for (const subclass of value.content.subclasses) {
    const compatibilityByAbilityId = new Map(
      declarativeSubclassCompatibilityReportV1([subclass]).abilities.map((entry) => [entry.abilityId, entry]),
    )
    for (const ability of subclass.abilities) {
      if (explicitSources.has(`subclass-ability:${subclass.id}:${ability.id}`) || explicitSources.has(`subclass-ability:${ability.id}`)) continue
      add('subclass-ability', `${subclass.id}:${ability.id}`, dnd5eActivityFromDeclarativeSubclassAbility(ability, {
        subclassId: subclass.id,
        compatibility: compatibilityByAbilityId.get(ability.id),
      }))
    }
  }
  for (const monster of value.content.monsters) {
    for (const activity of dnd5eActivitiesFromMonster(monster)) {
      if (activity.legacySource && explicitSources.has(`${activity.legacySource.kind}:${activity.legacySource.id}`)) continue
      add('monster-action', activity.legacySource?.id ?? activity.id, activity)
    }
  }

  const ids = new Set<string>()
  for (const activity of activities) {
    if (ids.has(activity.id)) throw new Error(`Duplicate projected Activity id: ${activity.id}`)
    ids.add(activity.id)
  }
  return {
    schemaVersion: 1,
    packageId: value.manifest.id,
    packageVersion: value.manifest.version,
    activities,
    entries,
    counts: {
      total: entries.length,
      adapted: entries.filter((entry) => entry.mode === 'adapted').length,
      legacyFallback: entries.filter((entry) => entry.mode === 'legacy-fallback').length,
      dmAdjudication: entries.filter((entry) => entry.mode === 'dm-adjudication').length,
      displayOnly: entries.filter((entry) => entry.mode === 'display-only').length,
    },
  }
}
