import { describe, expect, it } from 'vitest'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import { dnd5eSpellbookEntries } from './spellbook'

describe('release-cleared Chinese SRD 5.1 spell descriptions', () => {
  it('contains only allow-listed, context-reviewed SRD entries', () => {
    const catalogById = new Map(DND5E_SRD_SPELL_CATALOG.map((spell) => [spell.id, spell]))
    expect(Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED)).toHaveLength(11)
    for (const [id, reference] of Object.entries(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED)) {
      if (!reference) throw new Error(`reviewed spell entry is undefined: ${id}`)
      const catalog = catalogById.get(id)
      expect(catalog, id).toBeDefined()
      expect(reference.level, id).toBe(catalog?.level)
      expect(reference.school, id).toMatch(/^(防护|咒法|预言|附魔|塑能|幻术|死灵|变化)$/)
      expect(reference.castingTime.length, id).toBeGreaterThan(0)
      expect(reference.range.length, id).toBeGreaterThan(0)
      expect(reference.components.length, id).toBeGreaterThan(0)
      expect(reference.duration.length, id).toBeGreaterThan(0)
      expect(reference.description.length, id).toBeGreaterThan(20)
      expect(reference.sourceName, id).toBe(catalog?.name)
      expect(reference.sourceEnglishName, id).toBe(catalog?.englishName)
    }
  })

  it('never exposes an unreviewed fallback body through the spellbook', () => {
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED.shield).toMatchObject({
      sourcePage: 179,
      sourceEnglishName: 'Shield',
      castingTime: expect.stringContaining('反应'),
    })
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED.wish).toBeUndefined()

    const entries = dnd5eSpellbookEntries([])
    expect(entries.find((spell) => spell.id === 'shield')).toMatchObject({
      translationStatus: 'context-reviewed',
      reference: { sourcePage: 179 },
    })
    expect(entries.find((spell) => spell.id === 'wish')).toMatchObject({
      translationStatus: 'pending-srd-translation',
    })
    expect(entries.find((spell) => spell.id === 'wish')?.reference).toBeUndefined()
  })
})
