import { describe, expect, it } from 'vitest'
import { DND5E_SRD_SPELL_CATALOG } from './spellCatalog'
import {
  DND5E_SRD_SPELL_DESCRIPTIONS_ZH,
  DND5E_SRD_SPELL_DESCRIPTIONS_ZH_SHA256,
} from './spellDescriptionsZh.generated'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'
import { dnd5eSpellbookEntries } from './spellbook'

describe('legacy Chinese spell runtime data filtered through the SRD 5.1 catalog', () => {
  it('contains exactly the same 319 IDs as the SRD allow-list', () => {
    expect(Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH).sort())
      .toEqual(DND5E_SRD_SPELL_CATALOG.map((spell) => spell.id).sort())
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_SHA256).toMatch(/^[a-f0-9]{64}$/)
  })

  it('keeps every level aligned and every display field complete', () => {
    for (const catalog of DND5E_SRD_SPELL_CATALOG) {
      const reference = DND5E_SRD_SPELL_DESCRIPTIONS_ZH[catalog.id]
      expect(reference, catalog.id).toBeDefined()
      expect(reference.level, catalog.id).toBe(catalog.level)
      expect(reference.school, catalog.id).toMatch(/^(防护|咒法|预言|附魔|塑能|幻术|死灵|变化)$/)
      expect(reference.castingTime.length, catalog.id).toBeGreaterThan(0)
      expect(reference.range.length, catalog.id).toBeGreaterThan(0)
      expect(reference.components.length, catalog.id).toBeGreaterThan(0)
      expect(reference.duration.length, catalog.id).toBeGreaterThan(0)
      expect(reference.description.length, catalog.id).toBeGreaterThan(20)
      expect(reference.sourcePage, catalog.id).toBeGreaterThanOrEqual(211)
      expect(reference.sourcePage, catalog.id).toBeLessThanOrEqual(289)
    }
  })

  it('preserves representative rules text and separates upcasting text', () => {
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH['acid-splash']).toMatchObject({
      level: 0,
      school: '咒法',
      castingTime: '1 动作',
      range: '60 尺',
      sourcePage: 211,
    })
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH['acid-splash'].description).toContain('两个相距不超过 5 尺的生物')
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH['magic-missile'].description).toContain('每发飞镖对目标造成1d4+1 的力场伤害')
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH['magic-missile'].higherLevels).toContain('多制造出一支飞镖')
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH.wish.description).toContain('凡间生物所能施展的最强大法术')
    expect(DND5E_SRD_SPELL_DESCRIPTIONS_ZH['zone-of-truth'].description).toContain('不能故意说谎')
  })

  it('prefers context-reviewed SRD translations without mislabeling legacy fallbacks', () => {
    expect(Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED)).toHaveLength(11)
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
      translationStatus: 'legacy-runtime',
    })
  })
})
