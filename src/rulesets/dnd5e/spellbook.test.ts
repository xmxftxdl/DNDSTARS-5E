import { describe, expect, it } from 'vitest'
import {
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  dnd5eSpellbookEntries,
  dnd5eSpellbookEntriesWithPlugins,
  parseDnd5eSpellImport,
  parseDnd5eSharedSpellCollection,
} from './spellbook'

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
    expect(entries.find((entry) => entry.id === 'fireball')).toMatchObject({ name: '火球术', sourceKind: 'srd-core', headless: true, reference: { sourcePage: 241 } })
    expect(entries.find((entry) => entry.id === 'arcane-hand')).toMatchObject({ name: '奥术之手', sourceKind: 'srd-core', headless: false, reference: { sourceName: '毕格比之手' } })
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core').every((entry) => !!entry.reference)).toBe(true)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.headless)).toHaveLength(34)
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
      imported: { automation: { mode: 'reference-only' } },
    })
  })
})
