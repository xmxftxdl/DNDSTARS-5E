import type { Dnd5eLocalContentAiDraftV1 } from './localContentAiImport'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eContentPackageAutomationCoverageV2, type Dnd5eContentPackageContributionsV2 } from './contentPackageV2'
import { exportLegacyDnd5eStarMod, readLegacyDnd5eStarMod } from './starModAdapter'
import { dnd5eContentPackageActivityProjectionV1 } from './activities/dnd5eContentPackageActivityProjection'
import { validateContentPackageRuntime } from './contentPackageRuntimeValidation'
import { preflightPdfSpellDraft, type PdfSpellHeadlessPreflight } from './pdfSpellHeadlessPreflight'
import type { PdfSpellSource } from './pdfSpellImport'
import { dnd5eFeatureEligibilityReferenceIssues } from './featureEligibility'

export interface PdfContentModuleEntry {
  sourceId: string
  name: string
  draft?: Dnd5eLocalContentAiDraftV1
  source?: PdfSpellSource
}

/** Export the complete inventory, never silently discard failed conversion jobs. */
export async function exportPdfContentModule(input: {
  id: string
  name: string
  version: string
  inventoryComplete: boolean
  inventoryWarnings?: readonly string[]
  expectedCounts?: Partial<Record<keyof Dnd5eContentPackageContributionsV2, number>>
  classReference?: string
  entries: readonly PdfContentModuleEntry[]
}) {
  if (!input.inventoryComplete) throw new Error('请先完成全部页面的内容清单提取。')
  if (!input.entries.length) throw new Error('没有可导出的条目。')
  const sourceIds = new Set<string>()
  const content: Record<string, unknown[]> = {}
  const reports: Array<{ sourceId: string; name: string; assumptions: string[]; unsupported: string[]; sourcePreflight?: PdfSpellHeadlessPreflight }> = []
  for (const entry of input.entries) {
    if (sourceIds.has(entry.sourceId)) throw new Error(`重复来源：${entry.name}`)
    sourceIds.add(entry.sourceId)
    if (!entry.draft) throw new Error(`尚未完成转换：${entry.name}`)
    const sourcePreflight = entry.source ? await preflightPdfSpellDraft(entry.draft, entry.source.kind, {
      source: entry.source, classReference: input.classReference,
    }) : undefined
    const prepared = await prepareDnd5eLocalContentJson(entry.draft.contentJson)
    for (const [key, values] of Object.entries(prepared.package.content)) {
      if (!Array.isArray(values)) continue
      const destination = content[key] ??= []
      for (const value of values) {
        if (destination.some((existing) => (existing as { id: string }).id === value.id)) {
          throw new Error(`内容 ID 冲突：${key}/${value.id}；请合并或修正后再导出。`)
        }
        destination.push(value)
      }
    }
    reports.push({ sourceId: entry.sourceId, name: entry.name, assumptions: [...entry.draft.assumptions], unsupported: [...entry.draft.unsupported], ...(sourcePreflight ? { sourcePreflight } : {}) })
  }
  const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({
    name: input.name, version: input.version,
    manifest: { id: input.id, name: input.name, version: input.version },
    ...content,
  }))
  for (const [key, expected] of Object.entries(input.expectedCounts ?? {})) {
    const actual = prepared.package.content[key as keyof Dnd5eContentPackageContributionsV2]?.length ?? 0
    if (!Number.isInteger(expected) || expected < 0 || actual !== expected) throw new Error(`目录数量不一致：${key}，预期 ${expected}，实际 ${actual}。`)
  }
  const bytes = await exportLegacyDnd5eStarMod(prepared.package)
  // Exercise the real recipient parser, independent of the producing batch/cache.
  const imported = await readLegacyDnd5eStarMod(bytes)
  if (!imported || JSON.stringify(imported.package.content) !== JSON.stringify(prepared.package.content)) {
    throw new Error('导出再导入后内容不一致。')
  }
  const projection = dnd5eContentPackageActivityProjectionV1(imported.package)
  const runtimeValidation = await validateContentPackageRuntime(imported.package)
  const executionWarnings = imported.package.content.spells.flatMap((spell) => {
    if (!['partial', 'full'].includes(spell.automation?.mode ?? '')) return []
    const active = imported.package.content.activities?.some((activity) =>
      activity.legacySource?.kind === 'spell' && activity.legacySource.id === spell.id &&
      (activity.invocation == null || activity.invocation.kind === 'active'))
    return active ? [] : [`${spell.name}：完整度标记不代表执行活动；未提供可执行 Activity，安装后仅供资料阅读。`]
  })
  executionWarnings.push(...reports.flatMap(entry => entry.sourcePreflight?.status === 'blocked'
    ? entry.sourcePreflight.issues.map(issue => `${entry.name}：${issue}`) : []))
  executionWarnings.push(...dnd5eFeatureEligibilityReferenceIssues(imported.package.manifest.id,
    [...imported.package.content.features, ...imported.package.content.feats]))
  const counts = Object.fromEntries(Object.entries(imported.package.content).map(([key, values]) => [key, values?.length ?? 0])) as Record<keyof Dnd5eContentPackageContributionsV2, number>
  return {
    bytes, fileName: `${input.id}-${input.version}.starmod`,
    report: {
      schemaVersion: 1 as const, packageId: input.id, version: input.version,
      sourceCount: input.entries.length, counts, roundTripVerified: true,
      sourcePreflightCount: reports.filter(entry => entry.sourcePreflight).length,
      sourceCoverageVerified: false, inventoryWarnings: [...input.inventoryWarnings ?? []],
      expectedCounts: input.expectedCounts,
      behaviorVerified: false, coverage: dnd5eContentPackageAutomationCoverageV2(imported.package),
      executionWarnings,
      runtimeValidation,
      activityProjection: projection.counts, entries: reports,
    },
  }
}
