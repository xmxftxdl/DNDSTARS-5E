import { describe, expect, it } from 'vitest'
import { auditDnd5eSrdContentConsistency } from './srdContentAudit'

describe('SRD 5.1 published content consistency audit', () => {
  it('keeps the spell catalog, Headless definitions, displayed bodies and magic-item spell names aligned', () => {
    const report = auditDnd5eSrdContentConsistency()

    expect(report).toMatchObject({
      spellCatalogCount: 319,
      headlessSpellCount: 103,
      magicItemCatalogCount: 240,
    })
    expect(report.reviewedSpellCount).toBe(319)
    expect(report.pendingSpellReviewCount).toBe(0)
    expect(report.reviewedMagicItemCount).toBe(240)
    expect(report.pendingMagicItemReviewCount).toBe(0)
    expect(report.issues).toEqual([])
  })
})
