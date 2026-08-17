import { describe, expect, it } from 'vitest'
import type { MobileCredentials } from './mobileApi'
import type { MobilePlayerWorkspace, MobileRoomRules } from '../../../../packages/mobile-protocol/src'
import { buildMobileActionRegistry } from './actionRegistry'

const credentials = {
  serverUrl: 'https://example.test',
  account: { accountId: 'account-1', displayName: '玩家', sessionToken: 'account-token', createdAt: 1 },
  room: { roomId: 'ROOM01', roomName: '房间', rulesetId: 'dnd5e-2014-srd-5.1', memberId: 'member-1', roomToken: 'room-token', accountId: 'account-1', clientId: 'mobile', role: 'player', slot: 'player1', displayName: '玩家', createdAt: 1 },
} as MobileCredentials

const workspace = {
  characters: [{ id: 'hero', name: '英雄', dnd5ePluginFeatureIds: ['demo.plugin:arc-bolt'] }],
  activeCharacterId: 'hero', spells: [],
} as unknown as MobilePlayerWorkspace

const rules = {
  member: { ready: true },
  requiredPlugins: [{ id: 'demo.plugin', version: '1.0.0', integrity: 'sha256-test', stateSchemaVersion: 1 }],
} as MobileRoomRules

describe('mobile action registry', () => {
  it('loads a pure-data package and exposes only the owned Host command', async () => {
    const registry = await buildMobileActionRegistry({ workspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2,
      manifest: { id: 'demo.plugin' },
      content: { features: [{
        id: 'arc-bolt', name: '秘法箭', automation: 'full',
        action: { label: '发射秘法箭', economy: 'action', targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 60 } },
      }, {
        id: 'not-owned', name: '未拥有', automation: 'full',
        action: { label: '越权行动', economy: 'action', targeting: { kind: 'self' } },
      }] },
    }) })
    const action = registry.actions.find((entry) => entry.id === 'plugin-action:demo.plugin:arc-bolt')
    expect(action).toMatchObject({ label: '发射秘法箭', source: 'plugin', targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 60 } })
    expect(registry.actions.some((entry) => entry.label === '越权行动')).toBe(false)
    expect(action?.execution).toEqual({ kind: 'host-command', command: { type: 'dnd5e-plugin-action', dnd5ePluginAction: { featureId: 'demo.plugin:arc-bolt' } } })
  })

  it('projects a level-qualified selected subclass ability without executing package JavaScript', async () => {
    const qualifiedWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0],
        dnd5ePluginFeatureIds: [],
        classLevels: { wizard: 3 },
        dnd5eClassChoices: { classes: { wizard: { subclass: 'demo.plugin:arcane' } } },
      }],
    } as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: qualifiedWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2,
      manifest: { id: 'demo.plugin' },
      setup: 'throw new Error("must never execute")',
      content: { subclasses: [{ id: 'arcane', classId: 'wizard', abilities: [{
        schemaVersion: 1, id: 'arc-bolt', name: '秘法箭', description: '结构化能力', level: 3,
        trigger: { kind: 'active-use' }, cost: { economy: 'bonusAction' },
        targeting: { kind: 'area', relation: 'enemy', shape: 'circle', rangeFeet: 60, radiusFeet: 10 },
        effects: [], automation: 'partial',
      }] }] },
    }) })
    expect(registry.actions.find((entry) => entry.id === 'plugin-action:demo.plugin:arcane.arc-bolt')).toMatchObject({
      label: '秘法箭', economy: 'bonusAction', automation: 'partial', targeting: { kind: 'area', rangeFeet: 60 },
    })

    const underLevel = await buildMobileActionRegistry({
      workspace: {
        ...qualifiedWorkspace,
        characters: [{ ...qualifiedWorkspace.characters[0], classLevels: { wizard: 2 } }],
      },
      credentials,
      rules,
      loadPlugin: async () => ({
        format: 'dndstars5e-content', schemaVersion: 2,
        manifest: { id: 'demo.plugin' },
        content: { subclasses: [{ id: 'arcane', classId: 'wizard', abilities: [{
          schemaVersion: 1, id: 'arc-bolt', name: '秘法箭', description: '结构化能力', level: 3,
          trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        }] }] },
      }),
    })
    expect(underLevel.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:arcane.arc-bolt')).toBe(false)
  })

  it('only exposes a subclass choice ability after the matching persisted choice is selected', async () => {
    const choiceWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0],
        dnd5ePluginFeatureIds: [],
        classLevels: { wizard: 3 },
        dnd5eClassChoices: { classes: { wizard: {
          subclass: 'demo.plugin:arcane',
          selections: { 'demo.plugin:arcane/discipline': ['storm'] },
        } } },
        classSelections: { 'demo.plugin:arcane/discipline': ['storm'] },
      }],
    } as MobilePlayerWorkspace
    const packageValue = {
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: { subclasses: [{ id: 'arcane', classId: 'wizard', abilities: [{
        schemaVersion: 1, id: 'storm-bolt', name: '风暴箭', level: 3,
        trigger: { kind: 'active-use' }, targeting: { kind: 'single-creature' },
        predicates: { subclassChoices: [{ groupId: 'discipline', optionId: 'storm' }] },
        effects: [], automation: 'full',
      }] }] },
    }
    const qualified = await buildMobileActionRegistry({
      workspace: choiceWorkspace, credentials, rules, loadPlugin: async () => packageValue,
    })
    expect(qualified.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:arcane.storm-bolt')).toBe(true)

    const unqualified = await buildMobileActionRegistry({
      workspace: {
        ...choiceWorkspace,
        characters: [{ ...choiceWorkspace.characters[0], classSelections: {} }],
      },
      credentials,
      rules,
      loadPlugin: async () => packageValue,
    })
    expect(unqualified.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:arcane.storm-bolt')).toBe(false)
  })

  it('projects declarative class advancement grants at the matching class level', async () => {
    const classWorkspace = {
      ...workspace,
      characters: [{ ...workspace.characters[0], dnd5ePluginFeatureIds: [], classLevels: { 'demo.plugin:rune-class': 2 } }],
    } as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: classWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: {
        features: [{ id: 'rune-strike', name: '符文打击', automation: 'full', action: { label: '符文打击', economy: 'action', targeting: { kind: 'single-creature' } } }],
        classes: [{ id: 'rune-class', advancements: [{ level: 2, grants: ['rune-strike'] }] }],
      },
    }) })
    expect(registry.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:rune-strike')).toBe(true)
  })

  it('keeps legacy single-class character cards eligible without an explicit classLevels map', async () => {
    const legacyWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0], dnd5ePluginFeatureIds: [], charClass: '法师', level: 3, classLevels: {},
        dnd5eClassChoices: { classes: { wizard: { subclass: 'demo.plugin:arcane' } } },
      }],
    } as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: legacyWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: { subclasses: [{ id: 'arcane', classId: 'wizard', abilities: [{
        schemaVersion: 1, id: 'arc-bolt', name: '秘法箭', description: '结构化能力', level: 3,
        trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
      }] }] },
    }) })
    expect(registry.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:arcane.arc-bolt')).toBe(true)
  })

  it('projects features automatically granted by an installed custom race', async () => {
    const raceWorkspace = {
      ...workspace,
      characters: [{ ...workspace.characters[0], dnd5ePluginFeatureIds: [], race: '星裔', dnd5eRaceId: 'demo.plugin:starborn' }],
    } as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: raceWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: {
        features: [{ id: 'starlight', name: '星光', automation: 'full', action: { label: '释放星光', economy: 'action', targeting: { kind: 'self' } } }],
        races: [{ id: 'starborn', name: '星裔', grantedFeatureIds: ['starlight'] }],
      },
    }) })
    expect(registry.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:starlight')).toBe(true)
  })

  it('does not turn a known passive or manual V2 feature into a misleading fallback button', async () => {
    const passiveWorkspace = {
      ...workspace,
      characters: [{ ...workspace.characters[0], dnd5ePluginFeatureIds: ['demo.plugin:passive-aura'] }],
    } as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: passiveWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: { features: [{ id: 'passive-aura', name: '守护灵光', automation: 'manual', description: '仅被动说明' }] },
    }) })
    expect(registry.actions.some((entry) => entry.id === 'plugin-action:demo.plugin:passive-aura')).toBe(false)
  })

  it('exposes an explicitly active manual feature through the DM adjudication action', async () => {
    const manualWorkspace = {
      ...workspace,
      characters: [{ ...workspace.characters[0], dnd5ePluginFeatureIds: ['demo.plugin:parley'] }],
    } as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: manualWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: { features: [{
        id: 'parley', name: '战场交涉', automation: 'manual',
        action: { label: '尝试交涉', description: '说服敌方暂时停手。', economy: 'action', targeting: { kind: 'single-creature' } },
      }] },
    }) })
    expect(registry.actions.find((entry) => entry.id === 'plugin-action:demo.plugin:parley')).toMatchObject({
      automation: 'manual',
      execution: { kind: 'host-command', command: { type: 'dnd5e-basic-action', dnd5eBasicAction: { kind: 'other-action' } } },
    })
  })

  it('labels weapon actions from equipped inventory and exposes a host-validated off-hand attack', async () => {
    const armedWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0],
        dnd5eInventory: { entries: [
          { instanceId: 'main', quantity: 1, equippedSlot: 'mainWeapon', item: { name: '短剑', category: 'equipment', equipment: { dnd5e: { kind: 'weapon' } } } },
          { instanceId: 'off', quantity: 1, equippedSlot: 'offHand', item: { name: '匕首', category: 'equipment', equipment: { dnd5e: { kind: 'weapon' } } } },
        ] },
      }],
    } as unknown as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: armedWorkspace, credentials, rules: null })
    expect(registry.actions.find((entry) => entry.id === 'core.weapon-attack')?.label).toBe('短剑')
    expect(registry.actions.find((entry) => entry.id === 'core.off-hand-attack')).toMatchObject({
      economy: 'bonusAction', execution: { command: { dnd5eWeaponAttackOptions: { offHandAttack: true } } },
    })
  })

  it('registers owned persistent-area movement and area-granted plugin activities', async () => {
    const areaWorkspace = {
      ...workspace,
      characters: [{ ...workspace.characters[0], dnd5ePluginFeatureIds: [] }],
      scene: {
        persistentAreas: [{
          id: 'vine-area', label: '藤蔓区域', color: '#16a34a', ownerPluginId: 'demo.plugin',
          sourceCharacterId: 'hero', cells: [{ col: 2, row: 3 }],
          movement: { economy: 'bonus-action', maximumFeet: 30 },
          grantedActivities: [{ activityId: 'vine-control', label: '拉拽' }],
        }],
      },
    } as unknown as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: areaWorkspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-content', schemaVersion: 2, manifest: { id: 'demo.plugin' },
      content: { features: [{
        id: 'area-control', name: '藤蔓操控', automation: 'full',
        action: { id: 'vine-control', label: '拉拽目标', economy: 'bonusAction', targeting: { kind: 'single-creature', relation: 'enemy' } },
      }] },
    }) })
    expect(registry.actions.find((entry) => entry.id === 'persistent-area-move:vine-area')).toMatchObject({
      economy: 'bonusAction', targeting: { kind: 'area', rangeFeet: 30 },
      execution: { command: { dnd5ePersistentAreaMove: { areaId: 'vine-area' } } },
    })
    expect(registry.actions.find((entry) => entry.id.endsWith(':area:vine-area'))).toMatchObject({
      label: '藤蔓区域 · 拉拽目标',
      execution: { command: { dnd5ePluginAction: {
        featureId: 'demo.plugin:area-control', payload: { persistentAreaId: 'vine-area' },
      } } },
    })
  })

  it('keeps old owned features operable through a partial Host-only fallback', async () => {
    const registry = await buildMobileActionRegistry({ workspace, credentials, rules: { ...rules, member: { ...rules.member, ready: false } }, loadPlugin: async () => { throw new Error('must-not-load') } })
    expect(registry.actions.find((entry) => entry.id === 'plugin-action:demo.plugin:arc-bolt')).toMatchObject({ automation: 'partial', execution: { kind: 'host-command' } })
    expect(registry.rejectedPluginEntries).toEqual([])
  })

  it('projects active actions from a validated legacy declarative room package', async () => {
    const registry = await buildMobileActionRegistry({ workspace, credentials, rules, loadPlugin: async () => ({
      format: 'dndstars5e-declarative', schemaVersion: 1,
      manifest: { id: 'demo.plugin' },
      subclasses: [], classes: [],
      legacy: {
        features: [{
          id: 'arc-bolt', name: '旧版秘法箭', automation: 'full',
          action: { label: '发射旧版秘法箭', economy: 'action', targeting: { kind: 'single-creature', rangeFeet: 60 } },
        }],
      },
    }) })
    expect(registry.actions.find((entry) => entry.id === 'plugin-action:demo.plugin:arc-bolt'))
      .toMatchObject({ label: '发射旧版秘法箭', automation: 'full' })
  })
})
