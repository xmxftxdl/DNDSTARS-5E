import { expect, it } from 'vitest'
import { pdfSpellRepairFeedback } from './pdfSpellRepairFeedback'
import type { PdfSpellHeadlessPreflight } from './pdfSpellHeadlessPreflight'

it('retains distinct blockers and gives missing-root reasons without modifying evidence', () => {
  const preflight: PdfSpellHeadlessPreflight = { status: 'blocked', activityCount: 1,
    checkedAt: 'test', behaviorVerified: false, issues: ['缺少入口', '保留材料限制'],
    spellEntryAudit: { spellId: 'test', selectedActivityId: undefined, candidates: [{ activityId: 'ward',
      entryKind: 'reaction', eligible: false, reasons: ['reaction-spell-slot-contract-invalid'],
      automationLevel: 'full', limitations: [] }] } }
  const before = structuredClone(preflight)
  const feedback = pdfSpellRepairFeedback({ error: '缺少入口', preflight, unsupported: ['保留材料限制', '叙事边界'] })
  expect(feedback.split('\n').filter(line => line === '缺少入口')).toHaveLength(1)
  expect(feedback).toContain('保留材料限制')
  expect(feedback).toContain('叙事边界')
  expect(JSON.parse(feedback.split('\n').at(-1)!)).toMatchObject({ spellId: 'test', candidates: [
    { activityId: 'ward', reasons: ['reaction-spell-slot-contract-invalid'] },
  ] })
  expect(preflight).toEqual(before)
  preflight.spellEntryAudit!.selectedActivityId = 'cast'
  expect(pdfSpellRepairFeedback({ preflight })).toBe('缺少入口\n保留材料限制')
})

it('does not invent an entry diagnosis for non-spells or absent checks', () => {
  expect(pdfSpellRepairFeedback({})).toBe('')
  expect(pdfSpellRepairFeedback({ error: '', unsupported: ['source limitation', 'source limitation'] })).toBe('source limitation')
})
