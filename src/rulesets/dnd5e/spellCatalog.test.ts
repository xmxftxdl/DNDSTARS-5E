import { describe, expect, it } from 'vitest'
import { DND5E_SRD_COMBAT_SPELLS } from './spells'
import { DND5E_SRD_SPELL_CATALOG, dnd5eBardMagicalSecretsOptions, dnd5eSrdSpellCatalogForClass, dnd5eWarlockMysticArcanumOptions, getDnd5eSrdSpellCatalogEntry } from './spellCatalog'
import { DND5E_SRD_SPELL_NAMES_ZH } from './spellNamesZh'

describe('official SRD 5.1 spell-list catalog', () => {
  it('contains all 319 unique spells and 778 class-list memberships', () => {
    expect(DND5E_SRD_SPELL_CATALOG).toHaveLength(319)
    expect(new Set(DND5E_SRD_SPELL_CATALOG.map((spell) => spell.id)).size).toBe(319)
    expect(DND5E_SRD_SPELL_CATALOG.reduce((total, spell) => total + spell.classes.length, 0)).toBe(778)
  })

  it('gives every SRD catalog entry a canonical Chinese display name', () => {
    expect(Object.keys(DND5E_SRD_SPELL_NAMES_ZH)).toHaveLength(319)
    for (const spell of DND5E_SRD_SPELL_CATALOG) {
      expect(spell.name, spell.id).toBe(DND5E_SRD_SPELL_NAMES_ZH[spell.id])
      expect(spell.name, spell.id).toMatch(/[\u3400-\u9fff]/)
    }
    expect(getDnd5eSrdSpellCatalogEntry('vicious-mockery')?.name).toBe('恶言相加')
    expect(getDnd5eSrdSpellCatalogEntry('shield-of-faith')?.name).toBe('虔诚护盾')
    expect(getDnd5eSrdSpellCatalogEntry('arcane-hand')?.name).toBe('奥术之手')
  })

  it('matches the official per-class spell counts', () => {
    expect({
      bard: dnd5eSrdSpellCatalogForClass('bard').length,
      cleric: dnd5eSrdSpellCatalogForClass('cleric').length,
      druid: dnd5eSrdSpellCatalogForClass('druid').length,
      paladin: dnd5eSrdSpellCatalogForClass('paladin').length,
      ranger: dnd5eSrdSpellCatalogForClass('ranger').length,
      sorcerer: dnd5eSrdSpellCatalogForClass('sorcerer').length,
      warlock: dnd5eSrdSpellCatalogForClass('warlock').length,
      wizard: dnd5eSrdSpellCatalogForClass('wizard').length,
    }).toEqual({ bard: 112, cleric: 105, druid: 105, paladin: 31, ranger: 37, sorcerer: 120, warlock: 64, wizard: 204 })
  })

  it('preserves representative exclusive and shared list memberships', () => {
    expect(getDnd5eSrdSpellCatalogEntry('eldritch-blast')).toMatchObject({ level: 0, classes: ['warlock'] })
    expect(getDnd5eSrdSpellCatalogEntry('hunters-mark')).toMatchObject({ level: 1, classes: ['ranger'] })
    expect(getDnd5eSrdSpellCatalogEntry('counterspell')).toMatchObject({ level: 3, classes: ['sorcerer', 'warlock', 'wizard'] })
    expect(getDnd5eSrdSpellCatalogEntry('cure-wounds')).toMatchObject({ level: 1, classes: ['bard', 'cleric', 'druid', 'paladin', 'ranger'] })
    expect(getDnd5eSrdSpellCatalogEntry('wish')).toMatchObject({ level: 9, classes: ['sorcerer', 'wizard'] })
  })

  it('requires every mechanically implemented combat spell to agree with the official catalog', () => {
    expect(DND5E_SRD_COMBAT_SPELLS).toHaveLength(34)
    for (const spell of DND5E_SRD_COMBAT_SPELLS) {
      const catalog = getDnd5eSrdSpellCatalogEntry(spell.id)
      expect(catalog, spell.id).toBeDefined()
      expect(spell.level, spell.id).toBe(catalog?.level)
      expect([...spell.classes].sort(), spell.id).toEqual([...(catalog?.classes ?? [])].sort())
    }
  })

  it('exposes every 2014 Warlock Mystic Arcanum option at its exact spell level with Chinese labels', () => {
    expect([6, 7, 8, 9].map((level) => dnd5eWarlockMysticArcanumOptions(level).length)).toEqual([7, 4, 5, 5])
    expect(dnd5eWarlockMysticArcanumOptions(6)).toContainEqual(expect.objectContaining({
      id: 'circle-of-death', name: '死亡法阵', englishName: 'Circle of Death', level: 6,
    }))
    expect(dnd5eWarlockMysticArcanumOptions(9)).toContainEqual(expect.objectContaining({
      id: 'power-word-kill', name: '律令死亡', englishName: 'Power Word Kill', level: 9,
    }))
    expect(dnd5eWarlockMysticArcanumOptions(5)).toEqual([])
  })

  it('offers Bard Magical Secrets from every SRD class list without exceeding the castable spell level', () => {
    const thirdLevelOptions = dnd5eBardMagicalSecretsOptions(3)
    expect(thirdLevelOptions).toContainEqual(expect.objectContaining({ id: 'eldritch-blast', level: 0 }))
    expect(thirdLevelOptions).toContainEqual(expect.objectContaining({ id: 'fireball', level: 3 }))
    expect(thirdLevelOptions.some((spell) => spell.level > 3)).toBe(false)
    expect(dnd5eBardMagicalSecretsOptions(99).some((spell) => spell.id === 'wish')).toBe(true)
  })
})
