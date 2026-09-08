import { describe, expect, it } from 'vitest'
import {
  DND5E_SPELL_IMPORT_FORMAT,
  DND5E_SPELL_IMPORT_SCHEMA_VERSION,
  dnd5eSpellbookEntries,
  dnd5eSpellbookEntriesWithPlugins,
  dnd5eSpellbookEntryCanUseStructuredCastRoute,
  dnd5eSpellbookEntryUsesLegacyCoreStructuredCastRoute,
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

  it('accepts a freely rotatable rectangular spell template and target filters', () => {
    const parsed = parseDnd5eSpellImport(bundle(spell({
      range: { type: 'distance', feet: 120, shape: 'rect', widthFeet: 60, heightFeet: 5, rotatable: true },
      targeting: { relation: 'enemy', includeSelf: false, maximumTargets: 64 },
    })))
    expect(parsed.spells[0]).toMatchObject({
      range: { shape: 'rect', widthFeet: 60, heightFeet: 5, rotatable: true },
      targeting: { relation: 'enemy', includeSelf: false, maximumTargets: 64 },
    })
  })

  it('validates and preserves an explicit room-spell material recipe', () => {
    const parsed = parseDnd5eSpellImport(bundle(spell({
      components: {
        verbal: true,
        somatic: true,
        material: true,
        materialText: '价值至少 75 gp 的琥珀，法术会将其消耗',
        materialCostGp: 75,
        materialConsumed: true,
        materialRequirement: {
          label: '价值至少 75 gp 的琥珀',
          options: [{
            label: '琥珀',
            components: [{
              tag: 'test-pack:amber', label: '琥珀', consumed: true,
              minimumTotalValueGp: 75,
            }],
          }],
        },
      },
    })))
    expect(parsed.spells[0].components.materialRequirement).toEqual({
      label: '价值至少 75 gp 的琥珀',
      options: [{
        label: '琥珀',
        components: [{
          tag: 'test-pack:amber', label: '琥珀', consumed: true,
          minimumTotalValueGp: 75,
        }],
      }],
    })

    expect(() => parseDnd5eSpellImport(bundle(spell({
      components: {
        verbal: true, somatic: true, material: true, materialText: '错误材料',
        materialRequirement: {
          label: '错误材料',
          options: [{ label: '错误', components: [{ tag: 'INVALID TAG', label: '错误', consumed: true }] }],
        },
      },
    })))).toThrow(/稳定的小写规则 ID/)
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
    expect(entries.find((entry) => entry.id === 'fireball')).toMatchObject({
      name: '火球术', sourceKind: 'srd-core', headless: true,
      automationLevel: 'full', reference: { sourcePage: 144 },
    })
    for (const spellId of ['fire-bolt', 'burning-hands', 'lightning-bolt', 'meteor-swarm']) {
      expect(entries.find((entry) => entry.id === spellId)).toMatchObject({
        sourceKind: 'srd-core', headless: true, automationLevel: 'full',
      })
    }
    expect(entries.find((entry) => entry.id === 'arcane-hand')).toMatchObject({
      name: '奥术之手',
      sourceKind: 'srd-core',
      headless: true,
      automationLevel: 'full',
      translationStatus: 'context-reviewed',
    })
    expect(entries.find((entry) => entry.id === 'arcane-hand')?.reference?.sourcePage).toBe(118)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.reference))
      .toHaveLength(Object.keys(DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED).length)
    // Keep the audited automation buckets exhaustive across all 319 SRD spells.
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.headless)).toHaveLength(189)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.automationLevel === 'full')).toHaveLength(189)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.automationLevel === 'partial')).toHaveLength(124)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.automationLevel === 'manual')).toHaveLength(6)
    expect(entries.filter((entry) => entry.sourceKind === 'srd-core' && entry.catalogOnly)).toHaveLength(6)
    expect(entries.find((entry) => entry.id === 'command')).toMatchObject({
      headless: true,
      catalogOnly: false,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'minor-illusion')).toMatchObject({
      sourceKind: 'srd-core',
      headless: true,
      catalogOnly: false,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'meteor-swarm')).toMatchObject({
      headless: true,
      automationLevel: 'full',
      combat: {
        areaTargetCount: 4,
        damageType: 'fire',
        additionalDamageComponents: [{ damageType: 'bludgeoning' }],
      },
    })
    for (const spellId of ['mage-hand', 'darkness', 'daylight', 'detect-evil-and-good', 'detect-magic', 'detect-poison-and-disease', 'spike-growth', 'see-invisibility', 'faerie-fire', 'shillelagh']) {
      expect(entries.find((entry) => entry.id === spellId)).toMatchObject({
        headless: false,
        automationLevel: 'partial',
        automationReason: expect.any(String),
      })
    }
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'mage-hand'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'darkness'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'daylight'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'detect-evil-and-good'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryUsesLegacyCoreStructuredCastRoute(
      entries.find((entry) => entry.id === 'detect-evil-and-good'),
    )).toBe(false)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'detect-magic'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryUsesLegacyCoreStructuredCastRoute(
      entries.find((entry) => entry.id === 'detect-magic'),
    )).toBe(false)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'detect-poison-and-disease'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryUsesLegacyCoreStructuredCastRoute(
      entries.find((entry) => entry.id === 'detect-poison-and-disease'),
    )).toBe(false)
    expect(dnd5eSpellbookEntryUsesLegacyCoreStructuredCastRoute(
      entries.find((entry) => entry.id === 'darkness'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'see-invisibility'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'shillelagh'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'spike-growth'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'silence'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'sleet-storm'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'slow'),
    )).toBe(true)
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'shatter'),
    )).toBe(false)
    expect(entries.find((entry) => entry.id === 'spirit-guardians')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'dancing-lights')).toMatchObject({
      headless: true,
      automationLevel: 'full',
      combat: {
        areaTargetCount: 4,
        minimumAreaTargetCount: 1,
      },
    })
    expect(entries.find((entry) => entry.id === 'fog-cloud')).toMatchObject({
      headless: true,
      automationLevel: 'full',
      combat: {
        effect: 'persistent-area',
        concentrationDurationRounds: 600,
        areaRadiusFeetPerHigherSlot: 20,
      },
    })
    expect(entries.find((entry) => entry.id === 'prayer-of-healing')).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('10分钟'),
      combat: {
        effect: 'healing',
        maximumTargets: 6,
        requiresVisibleTarget: true,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'prayer-of-healing'),
    )).toBe(true)
    expect(entries.find((entry) => entry.id === 'produce-flame')).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('照明'),
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'produce-flame'),
    )).toBe(true)
    expect(entries.find((entry) => entry.id === 'shatter')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'cone-of-cold')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'cone-of-cold'),
    )).toBe(false)
    expect(entries.find((entry) => entry.id === 'call-lightning')).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('暴风雨'),
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(
      entries.find((entry) => entry.id === 'call-lightning'),
    )).toBe(true)
    expect(entries.find((entry) => entry.id === 'hypnotic-pattern')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'ice-storm')).toMatchObject({
      headless: true,
      automationLevel: 'full',
    })
    expect(entries.find((entry) => entry.id === 'slow')).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      automationReason: expect.stringContaining('施法动作延迟'),
    })
    expect(entries.find((entry) => entry.id === 'test-pack:ember-lance')).toMatchObject({ sourceKind: 'room-import', headless: false })
  })

  it('routes Shillelagh through its structured CombatSpell cast transaction', () => {
    const shillelagh = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'shillelagh')

    expect(shillelagh).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: { effect: 'active-effect' },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(shillelagh)).toBe(true)
  })

  it('routes Daylight through its structured persistent-light cast transaction', () => {
    const daylight = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'daylight')

    expect(daylight).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'persistent-area',
        area: { shape: 'circle', radiusFeet: 120, placeRangeFeet: 60 },
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(daylight)).toBe(true)
  })

  it('routes Silence through its structured persistent-area cast transaction', () => {
    const silence = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'silence')

    expect(silence).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'persistent-area',
        area: { shape: 'circle', radiusFeet: 20, placeRangeFeet: 120 },
        concentration: true,
        concentrationDurationRounds: 100,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(silence)).toBe(true)
  })

  it('routes Call Lightning through its structured strike and sustained-cast transaction', () => {
    const callLightning = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'call-lightning')

    expect(callLightning).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'saving-throw',
        saveAbility: 'dex',
        damageOnSuccessfulSave: 'half',
        dice: { count: 3, sides: 10, perHigherSlot: 1 },
        damageType: 'lightning',
        area: { shape: 'circle', radiusFeet: 5, placeRangeFeet: 60 },
        concentration: true,
        concentrationDurationRounds: 100,
        sustainedAttack: {
          id: 'call-lightning',
          economy: 'action',
          origin: 'persistent-area',
          resolution: 'saving-throw',
          rangeFeet: 60,
        },
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(callLightning)).toBe(true)
  })

  it('routes Calm Emotions through its structured area, save and concentration transaction', () => {
    const calmEmotions = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'calm-emotions')

    expect(calmEmotions).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'active-effect',
        appliedEffect: 'calm-emotions',
        unwillingSaveAbility: 'cha',
        area: { shape: 'circle', radiusFeet: 20, placeRangeFeet: 60 },
        concentration: true,
        concentrationDurationRounds: 10,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(calmEmotions)).toBe(true)
  })

  it('routes Web through its structured persistent-area cast transaction', () => {
    const web = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'web')

    expect(web).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'persistent-area',
        area: { shape: 'rect', widthFeet: 20, heightFeet: 20, placeRangeFeet: 60, gridAligned: true },
        concentration: true,
        concentrationDurationRounds: 600,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(web)).toBe(true)
  })

  it('routes Stinking Cloud through its structured persistent-area cast transaction', () => {
    const stinkingCloud = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'stinking-cloud')

    expect(stinkingCloud).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'persistent-area',
        area: { shape: 'circle', radiusFeet: 20, placeRangeFeet: 90 },
        concentration: true,
        concentrationDurationRounds: 10,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(stinkingCloud)).toBe(true)
  })

  it('routes Cloudkill through its structured persistent-area cast transaction', () => {
    const cloudkill = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'cloudkill')

    expect(cloudkill).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'persistent-area',
        dice: { count: 5, sides: 8, bonus: 0, perHigherSlot: 1 },
        damageType: 'poison',
        saveAbility: 'con',
        damageOnSuccessfulSave: 'half',
        area: { shape: 'circle', radiusFeet: 20, placeRangeFeet: 120 },
        concentration: true,
        concentrationDurationRounds: 100,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(cloudkill)).toBe(true)
  })

  it('routes Wind Wall through its structured persistent-area cast transaction', () => {
    const windWall = dnd5eSpellbookEntries([])
      .find((entry) => entry.id === 'wind-wall')

    expect(windWall).toMatchObject({
      headless: false,
      automationLevel: 'partial',
      combat: {
        effect: 'persistent-area',
        saveAbility: 'str',
        damageOnSuccessfulSave: 'half',
        dice: { count: 3, sides: 8, bonus: 0 },
        area: {
          shape: 'rect', widthFeet: 50, minimumWidthFeet: 5,
          heightFeet: 5, placeRangeFeet: 120, rotatable: true,
        },
        concentration: true,
        concentrationDurationRounds: 10,
      },
    })
    expect(dnd5eSpellbookEntryCanUseStructuredCastRoute(windWall)).toBe(true)
  })

  it('adds active plugin spells to the spellbook and preserves their automation badge', () => {
    const imported = parseDnd5eSpellImport(bundle()).spells[0]
    const entries = dnd5eSpellbookEntriesWithPlugins([], [{
      ...imported,
      id: 'test-pack:guided-glow',
      automation: { mode: 'headless-action', actionId: 'guided-glow' },
    }, {
      ...imported,
      id: 'detect-evil-and-good',
      automation: { mode: 'headless-action', actionId: 'spell:detect-evil-and-good' },
    }])
    expect(entries.find((entry) => entry.id === 'test-pack:guided-glow')).toMatchObject({
      sourceKind: 'room-import', headless: true, catalogOnly: false,
      automationLevel: 'full',
      imported: { automation: { mode: 'reference-only' } },
    })
    expect(entries.filter((entry) => entry.id === 'detect-evil-and-good')).toHaveLength(1)
    expect(entries.find((entry) => entry.id === 'detect-evil-and-good')).toMatchObject({
      sourceKind: 'srd-core', headless: false, catalogOnly: false,
      automationLevel: 'partial',
    })
  })
})
