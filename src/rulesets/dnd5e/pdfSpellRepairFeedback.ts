import type { PdfSpellHeadlessPreflight } from './pdfSpellHeadlessPreflight'

/** Feedback only: never edits a draft, relaxes preflight, or starts an AI request. */
export function pdfSpellRepairFeedback(input: {
  error?: string
  preflight?: PdfSpellHeadlessPreflight
  unsupported?: readonly string[]
}): string {
  const issues = [...new Set([input.error, ...(input.preflight?.issues ?? []), ...(input.unsupported ?? [])]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]
  const audit = input.preflight?.spellEntryAudit
  // Rejected follow-ups are normal when a valid root exists. Do not encourage
  // turning granted/triggered children into independent, repeatedly paid casts.
  if (audit && !audit.selectedActivityId) {
    issues.push('Host 施放入口诊断（按原文修复初始施放；不要删除后续活动的授权条件、改成免费施放或仅修改 full 标记）：')
    issues.push(JSON.stringify({ spellId: audit.spellId, candidates: audit.candidates.map(candidate => ({
      activityId: candidate.activityId, entryKind: candidate.entryKind, reasons: candidate.reasons,
    })) }))
  }
  return issues.join('\n')
}
