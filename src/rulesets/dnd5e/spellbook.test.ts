import { describe, expect, it } from 'vitest'
import {
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  dnd5eSpellbookEntries,
  dnd5eSpellbookEntriesWithPlugins,
  parseDnd5eSpellImport,
  parseDnd5eSharedSpellCollection,
} from './spellbook'
import { DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED } from './spellDescriptionsZh.reviewed.generated'

function spell(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-pack:ember-lance',
    name: '余烬长枪',
    englishName: 'Ember Lance',
    level: 1,
    school: 'evocation',
    ritual: false,
    castingTime: { value: 1, unit: 'action' },
    range: { type: 'distance', feet: 60 },
    components: { verbal: true, somatic: true, material: false },
    duration: { type: 'instantaneous', concentration: false },
    classes: ['sorcerer', 'wizard'],
    description: '测试法术规则正文。',
    source: { title: '测试规则', publisher: '测试 DM', license: '测试许可' },
    automation: { mode: 'reference-only' },
    ...overrides,
  }
}

function bundle(value = spell()) {
  return {
    format: DND5E_SPELL_IMPORT_FORMAT,
    schemaVersion: DND5E_SPELL_IMPORT_SCHEMA_VERSION,
    spells: [value],
  }
}

describe('D&D 5e room spellbook import', () => {
  it('allows an empty shared room spell collection', () => {
    expect(parseDnd5eSharedSpellCollection([])).toEqual([])
    expect(() => parseDnd5eSpellImport({
      format: 'dndstars5e-spells',
      schemaVersion: 1,
      spells: [],
    })).toThrow('文件中没有法术')
  })

  it('accepts the versioned 2014 spell template and normalizes its fields', () => {
    const parsed = parseDnd5eSpellImport(bundle(spell({
      mechanics: {
        kind: 'damage', resolution: 'spell-attack',
        damage: { dice: { count: 2, sides: 6, bonus: 0 }, type: 'fire' },
        upcast: { fromSlotLevel: 2, effects: [{ kind: 'damage-dice', diceCountPerSlot: 1 }] },
      },
    })))
    expect(parsed.spells).toHaveLength(1)
    expect(parsed.spells[0]).toMatchObject({
      id: 'test-pack:ember-lance',
      name: '余烬长枪',
      level: 1,
      school: 'evocation',
      classes: ['sorcerer', 'wizard'],
      automation: { mode: 'reference-only' },
      mechanics: { kind: 'damage', damage: { type: 'fire' } },
    })
  })

  it('rejects executable automation in a plain JSON spell import', () => {
    expect(() => parseDnd5eSpellImport(bundle(spell({ automation: { mode: 'javascript', code: 'fetch("https://example.com")' } }))))
      .toThrow(/reference-only/)
  })

  it('rejects IDs that could impersonate core SRD entries', () => {
    expect(() => parseDnd5eSpellImport(bundle(spell({ id: 'fireball' })))).toThrow(/命名空间/)
    expect(() => parseDnd5eSpellImport(bundle(spell({ id: 'srd-5.1:fireball' })))).toThrow(/不能冒充/)
  })

  it('combines the 319-entry SRD catalog with room imports without granting Headless', () => {
    const imported = parseDnd5eSpellImport(bundle()).spells
    const entries = dnd5eSpellbookEntries(imported)
    expect(entries).toHaveLength(320)
    expect(entries.find((entry) => entry.id === 'fireball')).toMatchObject({ name: '火球术', sourceKind: 'srd-core', headless: true, reference: { sourcePage: 144 } })
    expect(entries.find((entry) => entry.id === 'arcane-hand')).toMatchObject({
      name: '奥术之手',
      sourceKind: 'srd-core',
      headless: false,
      translationStatus: 'context-reviewed',
    })
    expect(entries.find((entry) => entry.id === 'arcane-hand')?.reference?.sourcePage).toBe(118)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.reference))
      .toHaveLength(Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED).length)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.headless)).toHaveLength(103)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.automationLevel === 'full')).toHaveLength(86)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.automationLevel === 'partial')).toHaveLength(17)
    expect(entries.find((entry) => entry.id === 'prayer-of-healing')).toMatchObject({
      headless: true,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('10分钟'),
      combat: {
        effect: 'healing',
        maximumTargets: 6,
        requiresVisibleTarget: true,
      },
    })
    expect(entries.find((entry) => entry.id === 'produce-flame')).toMatchObject({
      headless: true,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('照明'),
    })
    expect(entries.find((entry) => entry.id === 'shatter')).toMatchObject({
      headless: true,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('非魔法物体'),
    })
    expect(entries.find((entry) => entry.id === 'cone-of-cold')).toMatchObject({
      headless: true,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('冰冻塑像'),
    })
    expect(entries.find((entry) => entry.id === 'call-lightning')).toMatchObject({
      headless: true,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('暴风天气'),
    })
    expect(entries.find((entry) => entry.id === 'hypnotic-pattern')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'ice-storm')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'slow')).toMatchObject({
      headless: true,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('施法动作延迟'),
    })
    expect(entries.find((entry) => entry.id === 'test-pack:ember-lance')).toMatchObject({ sourceKind: 'room-import', headless: false })
  })

  it('adds active plugin spells to the spellbook and preserves their automation badge', () => {
    const imported = parseDnd5eSpellImport(bundle()).spells[0]
    const entries = dnd5eSpellbookEntriesWithPlugins([], [{
      ...imported,
      id: 'test-pack:guided-glow',
      automation: { mode: 'headless-action', actionId: 'guided-glow' },
    }])
    expect(entries.find((entry) => entry.id === 'test-pack:guided-glow')).toMatchObject({
      sourceKind: 'room-import', headless: true, catalogOnly: false,
      automationLevel: 'full',
      imported: { automation: { mode: 'reference-only' } },
    })
  })
})
