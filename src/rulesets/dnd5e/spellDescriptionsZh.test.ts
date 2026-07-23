import { describe, expect, it } from 'vitest'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import { dnd5eSpellbookEntries } from './spellbook'

describe('release-cleared Chinese SRD 5.1 spell descriptions', () => {
  it('contains only allow-listed, context-reviewed SRD entries', () => {
    const catalogById = new Map(DND5E_SRD_SPELL_CATALOG.map((spell) => [spell.id, spell]))
    expect(Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED)).toHaveLength(319)
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

  it('exposes only reviewed bodies through the complete SRD spellbook', () => {
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED.shield).toMatchObject({
      sourcePage: 179,
      sourceEnglishName: 'Shield',
      castingTime: expect.stringContaining('反应'),
    })
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED.wish).toMatchObject({
      sourcePage: 193,
      sourceEnglishName: 'Wish',
      sourceName: '祈愿术',
    })

    const entries = dnd5eSpellbookEntries([])
    expect(entries.find((spell) => spell.id === 'shield')).toMatchObject({
      translationStatus: 'context-reviewed',
      reference: { sourcePage: 179 },
    })
    expect(entries.find((spell) => spell.id === 'wish')).toMatchObject({
      translationStatus: 'context-reviewed',
      reference: { sourcePage: 193 },
    })
    expect(entries.filter((spell) => spell.sourceKind === 'srd-core' && spell.translationStatus !== 'context-reviewed')).toHaveLength(0)
  })

  it('does not publish untranslated English prose in spell rule fields', () => {
    const allowed = new Set(['AC', 'DC', 'DM', 'HP', 'XP', 'gp'])
    const fields = ['castingTime', 'range', 'components', 'duration', 'description'] as const
    const residual = Object.entries(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED).flatMap(([id, entry]) =>
      entry
        ? fields.flatMap((field) =>
            [...entry[field].matchAll(/[A-Za-z]{2,}/g)]
              .map((match) => match[0])
              .filter((token) => !allowed.has(token) && !/^d\d+$/.test(token))
              .map((token) => `${id}:${field}:${token}`),
          )
        : [],
    )
    expect(residual).toEqual([])
  })
})
