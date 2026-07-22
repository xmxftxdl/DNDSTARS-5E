import { describe, expect, it } from 'vitest'
import { auditDnd5eSrdContentConsistency } from './srdContentAudit'

describe('SRD 5.1 published content consistency audit', () => {
  it('keeps the spell catalog, Headless definitions, displayed bodies and magic-item spell names aligned', () => {
    const report = auditDnd5eSrdContentConsistency()

    expect(report).toMatchObject({
      spellCatalogCount: 319,
      headlessSpellCount: 66,
      magicItemCatalogCount: 240,
    })
    expect(report.reviewedSpellCount).toBeGreaterThan(0)
    expect(report.pendingSpellReviewCount).toBe(report.spellCatalogCount - report.reviewedSpellCount)
    expect(report.reviewedMagicItemCount).toBeGreaterThan(0)
    expect(report.pendingMagicItemReviewCount).toBe(report.magicItemCatalogCount - report.reviewedMagicItemCount)
    expect(report.issues).toEqual([])
  })
})
