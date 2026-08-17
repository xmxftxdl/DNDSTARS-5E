import { afterEach, describe, expect, it } from 'vitest'
import type { MobileRoomRules } from '../../../../packages/mobile-protocol/src'
import { buildDnd5eCustomRulesContentPackageV2 } from '../../../../src/rulesets/dnd5e/contentPackageV2'
import type { Dnd5eCustomRulesPluginDraft } from '../../../../src/rulesets/dnd5e/customRulesPlugin'
import {
  dnd5ePluginRaceDefinition,
  dnd5ePluginSpellDefinition,
} from '../../../../src/rulesets/dnd5e/pluginApi'
import type { MobileCredentials } from './mobileApi'
import {
  createMobileDnd5eCharacter,
  mobileCharacterCreationCatalog,
} from '../character/createMobileCharacter'
import { buildMobileWorkspace } from './workspaceAdapter'
import {
  activeMobileRoomPluginIds,
  clearMobileRoomPluginRuntime,
  prepareMobileRoomPlugins,
} from './mobileRoomPluginRuntime'

function credentials(roomId = 'ROOM01'): MobileCredentials {
  return {
    serverUrl: 'https://example.invalid',
    account: { accountId: 'account-1', displayName: '测试玩家', sessionToken: 'account-token', createdAt: 1 },
    room: {
      roomId, roomName: '测试房间', rulesetId: 'dnd5e-2014-srd-5.1', memberId: 'member-1',
      roomToken: 'room-token', clientId: 'mobile-1', role: 'player', slot: 'player1', displayName: '测试玩家', createdAt: 1,
    },
  }
}

function packageValue(id = 'mobile.workshop', version = '1.0.0') {
  const draft: Dnd5eCustomRulesPluginDraft = {
    manifest: {
      id, name: '移动端工坊测试包', version, apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'DM', license: '原创测试内容', stateSchemaVersion: 1,
      distributionPolicy: 'room-distributable', contentCategory: 'mixed',
    },
    races: [{
      id: 'star-kin', name: '星裔', speedFeet: 30, size: 'medium', skillProficiencies: [],
      languages: ['通用语'], traits: [{ id: 'starlight', name: '星光', description: '工坊测试特性。' }],
    }],
    backgrounds: [], features: [], feats: [], items: [], abilityGenerationMethods: [],
    headlessActions: [], activities: [], subclasses: [], monsters: [],
    classes: [{
      schemaVersion: 1,
      id: 'star-warden',
      name: '星卫',
      summary: '守护星光的工坊职业。',
      hitDie: 10,
      primaryAbilities: ['wis'],
      savingThrows: ['wis', 'con'],
      armorProficiencies: ['轻甲'],
      weaponProficiencies: ['简易武器'],
      skills: { choiceCount: 2, options: ['perception', 'survival'] },
      features: [],
      startingEquipment: {
        fixedGrants: [{ templateId: 'srd-5.1:item:torch', quantity: 2 }],
      },
    }],
    spells: [{
      id: 'star-bolt', name: '星矢', level: 1, school: 'evocation', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
      components: { verbal: true, somatic: true, material: false },
      duration: { type: 'instantaneous', concentration: false }, classes: ['wizard'],
      description: '对一个目标发射星光。', automation: { mode: 'reference-only' },
    }],
  }
  return JSON.parse(buildDnd5eCustomRulesContentPackageV2(draft)) as Record<string, unknown>
}

function rules(value: Record<string, unknown>, roomId = 'ROOM01'): MobileRoomRules {
  const manifest = value.manifest as Record<string, unknown>
  const requirement = {
    id: String(manifest.id), version: String(manifest.version), integrity: 'sha256-test', stateSchemaVersion: 1,
  }
  return {
    schemaVersion: 1, roomId, rulesetId: 'dnd5e-2014-srd-5.1', revision: 1, hash: 'rules-hash', updatedAt: 1,
    requiredPlugins: [requirement],
    plugins: [{ ...requirement, name: String(manifest.name), publisher: String(manifest.publisher), license: String(manifest.license) }],
    member: { ready: false, missing: [requirement], mismatched: [] },
  }
}

afterEach(() => clearMobileRoomPluginRuntime())

describe('mobile room plugin runtime', () => {
  it('downloads, validates and registers DM workshop content before reporting it active', async () => {
    const value = packageValue()
    await prepareMobileRoomPlugins(credentials(), rules(value), { loadPlugin: async () => value })

    expect(activeMobileRoomPluginIds()).toEqual(['mobile.workshop'])
    expect(dnd5ePluginRaceDefinition('mobile.workshop:star-kin')?.name).toBe('星裔')
    expect(dnd5ePluginSpellDefinition('mobile.workshop:star-bolt')?.name).toBe('星矢')
    expect(mobileCharacterCreationCatalog().races).toContainEqual({
      id: 'mobile.workshop:star-kin', label: '星裔', plugin: true,
    })
    expect(mobileCharacterCreationCatalog().classes).toContainEqual({
      id: 'mobile.workshop:star-warden', label: '星卫', plugin: true,
    })
    const created = createMobileDnd5eCharacter({
      name: '星卫测试员', charClass: 'mobile.workshop:star-warden', race: 'mobile.workshop:star-kin',
      background: '侍僧', alignment: '中立善良', abilityMethod: 'standard-array',
      baseAbilities: { str: 8, dex: 13, con: 14, int: 10, wis: 15, cha: 12 },
    }, {
      roomId: 'ROOM01', roomMemberId: 'member-1', ownerAccountId: 'account-1', player: '测试玩家',
    })
    expect(created).toMatchObject({
      charClass: '星卫', race: '星裔', dnd5eClassLevels: { 'mobile.workshop:star-warden': 1 },
    })
    expect(created.dnd5eInventory?.entries).toContainEqual(expect.objectContaining({
      templateId: 'srd-5.1:item:torch', quantity: 2,
    }))

    const workspace = buildMobileWorkspace({
      credentials: credentials(), rules: rules(value), activeCharacterId: 'hero', voice: null,
      resources: {
        characters: { characters: [{
          id: 'hero', name: '测试法师', player: '测试玩家', ownerAccountId: 'account-1', roomMemberId: 'member-1',
          race: '星裔', dnd5eRaceId: 'mobile.workshop:star-kin', charClass: '法师', level: 1, background: '侍僧',
          rulesetId: 'dnd5e-2014-srd-5.1', abilities: { str: 8, dex: 12, con: 13, int: 15, wis: 10, cha: 14 },
          savingThrows: ['int', 'wis'], skills: [], maxHp: 7, currentHp: 7, ac: 11, speed: 30, saveDC: 13,
          dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-known': ['mobile.workshop:star-bolt'] } } } },
        }] },
        spellbook: { spells: [] },
      },
    })
    expect(workspace.spells).toContainEqual(expect.objectContaining({
      id: 'mobile.workshop:star-bolt', name: '星矢', known: true, rangeFeet: 60, automationLevel: 'manual',
    }))
  })

  it('unloads the previous room package when the player changes rooms', async () => {
    const first = packageValue('mobile.first')
    await prepareMobileRoomPlugins(credentials('ROOM01'), rules(first, 'ROOM01'), { loadPlugin: async () => first })
    const second = packageValue('mobile.second')
    await prepareMobileRoomPlugins(credentials('ROOM02'), rules(second, 'ROOM02'), { loadPlugin: async () => second })

    expect(activeMobileRoomPluginIds()).toEqual(['mobile.second'])
    expect(dnd5ePluginRaceDefinition('mobile.first:star-kin')).toBeUndefined()
    expect(dnd5ePluginRaceDefinition('mobile.second:star-kin')?.name).toBe('星裔')
  })

  it('rejects executable fields and leaves no partially active package', async () => {
    const valid = packageValue()
    await prepareMobileRoomPlugins(credentials(), rules(valid), { loadPlugin: async () => valid })
    const value = { ...packageValue('mobile.changed', '2.0.0'), setup: 'alert(1)' }
    await expect(prepareMobileRoomPlugins(credentials(), rules(value), { loadPlugin: async () => value }))
      .rejects.toThrow('unsupported field')
    expect(activeMobileRoomPluginIds()).toEqual([])
    expect(dnd5ePluginRaceDefinition('mobile.workshop:star-kin')).toBeUndefined()
  })

  it('rejects in-memory executable values instead of silently removing them during JSON encoding', async () => {
    const value = packageValue('mobile.executable') as Record<string, unknown> & { setup?: () => void }
    value.setup = () => undefined
    await expect(prepareMobileRoomPlugins(credentials(), rules(value), { loadPlugin: async () => value }))
      .rejects.toThrow('plugin-package-not-json')
    expect(activeMobileRoomPluginIds()).toEqual([])
  })

  it('rejects a room package whose required dependency is absent', async () => {
    const value = packageValue('mobile.consumer')
    ;(value.manifest as Record<string, unknown>).dependencies = [{ id: 'mobile.base', versionRange: '^1.0.0' }]
    await expect(prepareMobileRoomPlugins(credentials(), rules(value), { loadPlugin: async () => value }))
      .rejects.toThrow('plugin-incompatible:mobile.consumer:dependency-missing')
    expect(activeMobileRoomPluginIds()).toEqual([])
  })
})
