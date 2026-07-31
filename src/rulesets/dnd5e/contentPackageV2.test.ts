import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { Character } from '../../types/character'
import { dnd5eItemActionIcon } from '../../lib/dnd5eActionIcons'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import {
  DND5E_CONTENT_PACKAGE_FORMAT,
  DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
  dnd5eContentPackageAutomationCoverageV2,
  dnd5eContentPackageSummaryV2,
  dnd5eRoomRuntimeProjectionV2,
  dnd5eRulesPluginFromContentPackageV2,
  DND5E_ROOM_RUNTIME_PROJECTION,
  DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
  parseDnd5eContentPackageV2,
  type Dnd5eContentPackageV2,
} from './contentPackageV2'
import { dnd5ePluginImageAssetUrl, registeredDnd5ePluginImageAssets } from './pluginAssets'
import {
  registerDnd5eRulesPlugin,
  registeredDnd5ePluginFeats,
  registeredDnd5ePluginItems,
  registeredDnd5ePluginRaces,
} from './pluginApi'

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function packageValue(): Dnd5eContentPackageV2 {
  return {
    format: DND5E_CONTENT_PACKAGE_FORMAT,
    schemaVersion: DND5E_CONTENT_PACKAGE_SCHEMA_VERSION,
    manifest: {
      id: 'com.example.content-v2',
      name: 'Synthetic Content V2',
      version: '1.0.0',
      apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests',
      license: 'CC0-1.0',
      distributionPolicy: 'local-only',
      contentCategory: 'mixed',
    },
    provenance: {
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: 'Synthetic test data',
    },
    assets: [{ id: 'ember', mediaType: 'image/png', dataBase64: ONE_PIXEL_PNG }],
    content: {
      races: [{
        id: 'emberkin',
        name: 'Emberkin',
        speedFeet: 30,
        size: 'small',
        iconAssetId: 'ember',
        skillProficiencies: ['perception'],
        languages: ['Common'],
        traits: [{ id: 'heat-sight', name: 'Heat Sight', description: 'Synthetic trait.' }],
        staticModifiers: {
          armorClassBonus: 1,
          darkvisionRangeFeet: 60,
          damageResistances: ['fire'],
          conditionImmunities: ['frightened'],
        },
      }],
      backgrounds: [],
      features: [],
      feats: [{
        id: 'steady',
        name: 'Steady',
        summary: 'Synthetic passive feat.',
        description: 'Synthetic passive feat used only by tests.',
        iconAssetId: 'ember',
        prerequisite: { minimumLevel: 4, abilityScores: { dex: 10 } },
        automation: 'full',
        staticModifiers: {
          armorClassBonus: 1,
          initiativeBonus: 2,
          speedBonusFeet: 5,
          savingThrowBonus: 1,
          damageImmunities: ['poison'],
        },
      }],
      spells: [],
      items: [{
        id: 'ember-token',
        name: 'Ember Token',
        category: 'magic-item',
        icon: 'generic',
        iconAssetId: 'ember',
        description: 'Synthetic item.',
        rulesText: 'Synthetic item rules.',
        stackable: true,
      }],
      abilityGenerationMethods: [],
      headlessActions: [],
      subclasses: [],
      monsters: [],
    },
  }
}

function character(): Character {
  return {
    id: 'hero',
    name: 'Hero',
    player: 'P1',
    avatar: '',
    accent: '',
    race: 'Emberkin',
    dnd5eRaceId: 'com.example.content-v2:emberkin',
    charClass: '战士',
    level: 4,
    background: '',
    experience: 0,
    reputation: 0,
    rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: [],
    skills: [],
    maxHp: 20,
    currentHp: 20,
    tempHp: 0,
    hitDice: '1d10',
    ac: 10,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eFeatIds: ['com.example.content-v2:steady'],
  }
}

describe('D&D 5e content package V2', () => {
  it('keeps the checked-in original-content example importable', () => {
    const bytes = readFileSync(new URL('../../../examples/original-content-v2.dndstars5e', import.meta.url))
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    expect(parseDnd5eContentPackageV2(buffer)?.manifest.id).toBe('local.example.original-content-v2')
  })

  it('keeps the rights-safe subclass protocol example valid with prearmed attack intent support', () => {
    const example = JSON.parse(readFileSync(
      new URL('../../../examples/phb-local-collection-template/subclass-protocol.example.json', import.meta.url),
      'utf8',
    ))
    const source = packageValue()
    source.content.subclasses = example
    const encoded = new TextEncoder().encode(JSON.stringify(source))
    const parsed = parseDnd5eContentPackageV2(encoded.buffer)
    const subclass = parsed?.content.subclasses[0]
    expect(subclass).toMatchObject({
      id: 'synthetic-protocol-demo',
      spellcasting: { progression: 'one-third', spellListClassId: 'wizard' },
    })
    expect(subclass?.resources?.[0].die).toMatchObject({ sides: 6 })
    expect(subclass?.choiceGroups?.[0].maxSelectionsByLevel?.[0]).toEqual({ level: 7, maxSelections: 5 })
    expect(dnd5eContentPackageAutomationCoverageV2(parsed!).entries).toContainEqual({
      category: 'subclass-ability',
      id: 'synthetic-protocol-demo:precision-pulse',
      status: 'full',
    })
  })

  it('parses pure JSON and reports a non-executable installation preview', () => {
    const encoded = new TextEncoder().encode(JSON.stringify(packageValue()))
    const parsed = parseDnd5eContentPackageV2(encoded.buffer)
    expect(parsed?.manifest.id).toBe('com.example.content-v2')
    expect(parsed?.provenance).toMatchObject({ edition: '2014', contentMode: 'incremental' })
    expect(dnd5eContentPackageSummaryV2(parsed!)).toMatchObject({
      races: 1,
      feats: 1,
      items: 1,
      imageAssets: 1,
    })
    expect(dnd5eContentPackageAutomationCoverageV2(parsed!, 'sha256-test')).toMatchObject({
      package: {
        id: 'com.example.content-v2',
        version: '1.0.0',
        distributionPolicy: 'local-only',
        integrity: 'sha256-test',
      },
      privacy: {
        includesSourceText: false,
        includesImageData: false,
        includesHumanReadableContentNames: false,
      },
      totals: { total: 3, full: 2, referenceOnly: 1 },
      bindings: {
        declaredHeadlessActions: 0,
        referencedHeadlessActions: 0,
        unreferencedHeadlessActions: 0,
      },
      visuals: {
        declaredImageAssets: 1,
        referencedImageAssets: 1,
        missingImageAssetReferences: 0,
        unusedImageAssets: 0,
      },
    })
    const serializedReport = JSON.stringify(dnd5eContentPackageAutomationCoverageV2(parsed!))
    expect(serializedReport).not.toContain('Synthetic passive feat used only by tests.')
    expect(serializedReport).not.toContain(ONE_PIXEL_PNG)
  })

  it('reports imported race automation honestly instead of assuming full coverage', () => {
    const source = packageValue()
    source.content.races[0].automation = 'partial'
    source.content.races[0].automationReasons = ['Scene-dependent trait requires DM adjudication.']
    expect(dnd5eContentPackageAutomationCoverageV2(source).categories.race).toMatchObject({
      total: 1,
      full: 0,
      partial: 1,
    })
    expect(dnd5eContentPackageAutomationCoverageV2(source).entries).toContainEqual({
      category: 'race',
      id: 'emberkin',
      status: 'partial',
      reasons: ['Scene-dependent trait requires DM adjudication.'],
    })
  })

  it('projects room-ephemeral mechanics and images without source prose', () => {
    const source = packageValue()
    source.manifest.distributionPolicy = 'room-ephemeral'
    source.manifest.description = 'Local source description that must not be transmitted.'
    source.content.feats[0].summary = 'Local summary.'
    source.content.feats[0].description = 'Local rule prose.'
    const projected = dnd5eRoomRuntimeProjectionV2(source)
    expect(projected.provenance).toEqual({
      edition: '2014',
      contentMode: 'incremental',
      sourceTitle: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
      projection: DND5E_ROOM_RUNTIME_PROJECTION,
    })
    expect(projected.content.feats[0]).toMatchObject({
      id: 'steady',
      name: 'Steady',
      summary: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
      description: DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER,
      staticModifiers: { initiativeBonus: 2 },
    })
    expect(projected.assets[0].dataBase64).toBe(ONE_PIXEL_PNG)
  })

  it('registers assets and projects race/feat passives into Headless combat', () => {
    const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(packageValue()))
    try {
      expect(registeredDnd5ePluginRaces()).toEqual([
        expect.objectContaining({ id: 'com.example.content-v2:emberkin', size: 'small' }),
      ])
      expect(registeredDnd5ePluginFeats()).toEqual([
        expect.objectContaining({
          id: 'com.example.content-v2:steady',
          featureId: 'com.example.content-v2:feat-steady',
        }),
      ])
      const item = registeredDnd5ePluginItems()[0]
      expect(item.iconAssetId).toBe('com.example.content-v2:ember')
      expect(dnd5eItemActionIcon(item).asset).toBe(
        dnd5ePluginImageAssetUrl('com.example.content-v2:ember'),
      )

      const migrated = migrateCharacterToDnd5e(character())
      const combatant = createCombatantFromDnd5eCharacter({
        character: migrated,
        controller: 'player',
        initiativeD20: 10,
        position: { x: 0, y: 0 },
      })
      expect(combatant).toMatchObject({
        sizeRank: 1,
        armorClass: 13,
        speed: 35,
        initiative: 13,
        darkvisionRangeFeet: 60,
      })
      expect(combatant.skillProficiencies).toContain('perception')
      expect(combatant.damageResistances).toContain('fire')
      expect(combatant.damageImmunities).toContain('poison')
      expect(combatant.conditionImmunities).toContain('frightened')
      expect(combatant.savingThrowBonuses.dex).toBe(2)
    } finally {
      dispose()
    }
    expect(registeredDnd5ePluginImageAssets()).toEqual([])
    expect(registeredDnd5ePluginFeats()).toEqual([])
  })

  it('rejects executable image formats and manifest/payload mismatches', () => {
    const invalid: Dnd5eContentPackageV2 = {
      ...packageValue(),
      assets: [{
        id: 'vector',
        mediaType: 'image/svg+xml' as 'image/png',
        dataBase64: btoa('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      }],
    }
    const bytes = new TextEncoder().encode(JSON.stringify(invalid))
    expect(() => parseDnd5eContentPackageV2(bytes.buffer)).toThrow('Unsupported plugin image media type')
  })
})
