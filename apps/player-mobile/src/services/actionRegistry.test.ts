import { describe, expect, it } from 'vitest'
import type { MobileCredentials } from './mobileApi'
import type { MobilePlayerWorkspace, MobileRoomRules } from '../../../../packages/mobile-protocol/src'
import { buildMobileActionRegistry, mobileBasicActionDescriptors } from './actionRegistry'

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
  it('keeps Host-validated core actions visible while the projected registry is temporarily empty', () => {
    const actions = mobileBasicActionDescriptors({ schemaVersion: 1, generatedAt: 1, actions: [], rejectedPluginEntries: [] })
    expect(actions.find((entry) => entry.id === 'core.weapon-attack')).toMatchObject({
      group: 'actions',
      execution: { kind: 'host-command', command: { type: 'dnd5e-weapon-attack' } },
    })
    expect(actions.some((entry) => entry.id === 'core.dash')).toBe(true)
  })

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
        choices: [{ id: 'element', label: '元素', defaultOptionId: 'lightning', options: [
          { id: 'lightning', label: '闪电' }, { id: 'thunder', label: '雷鸣' },
        ] }],
        effects: [], automation: 'partial',
      }] }] },
    }) })
    expect(registry.actions.find((entry) => entry.id === 'plugin-action:demo.plugin:arcane.arc-bolt')).toMatchObject({
      label: '秘法箭', economy: 'bonusAction', automation: 'partial', targeting: { kind: 'area', rangeFeet: 60 },
      choices: [{ id: 'element', label: '元素', defaultOptionId: 'lightning', options: [
        { id: 'lightning', label: '闪电' }, { id: 'thunder', label: '雷鸣' },
      ] }],
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

  it('registers only fully Headless sustained spell controls without spending another spell slot', async () => {
    const sustainedWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0],
        sustainedSpellControls: [{
          id: 'flame-blade', spellId: 'flame-blade', label: '火焰刀攻击',
          description: '附赠动作 · 使用现有效果', economy: 'bonusAction',
          targeting: 'single-creature', slotLevel: 3, castingClassId: 'druid',
        }],
      }],
      scene: {
        persistentAreas: [{
          id: 'core-spell-area:storm', label: '招雷术雷云', color: '#38bdf8',
          sourceKind: 'core-spell', sourceCharacterId: 'hero', coreSpellId: 'call-lightning',
          slotLevel: 4, castingClassId: 'druid', cells: [{ col: 3, row: 4 }],
        }],
      },
    } as unknown as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: sustainedWorkspace, credentials, rules: null })
    expect(registry.actions.find((entry) => entry.id === 'sustained-spell:flame-blade:flame-blade')).toMatchObject({
      economy: 'bonusAction', targeting: { kind: 'single-creature' },
      execution: { command: { dnd5eSpellCast: {
        spellId: 'flame-blade', slotLevel: 3, sustainedEffectAttack: 'flame-blade', castingClassId: 'druid',
      } } },
    })
    expect(registry.actions.find((entry) => entry.id === 'sustained-spell:core-spell-area:storm:call-lightning'))
      .toBeUndefined()
  })

  it('registers every Host-approved resource-spell cast level as a distinct action', async () => {
    const grantWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0],
        alternateResourceSpells: [{
          featureId: 'demo.plugin:rune-magic', featureName: '符文魔法', grantId: 'bolt',
          spellId: 'magic-missile', spellName: '魔法飞弹', classId: 'wizard',
          resourceId: 'demo.plugin:runes', castLevelOptions: [
            { slotLevel: 1, resourceCost: 1 }, { slotLevel: 2, resourceCost: 2 },
          ],
          ignoreMaterialComponents: false, headless: true, economy: 'action',
          targeting: 'single-creature', rangeFeet: 120,
        }],
      }],
    } as unknown as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: grantWorkspace, credentials, rules: null })
    const casts = registry.actions.filter((entry) => entry.id.startsWith('alternate-resource-spell:'))
    expect(casts).toHaveLength(2)
    expect(casts[1]).toMatchObject({
      label: '魔法飞弹（2环）', targeting: { kind: 'single-creature', rangeFeet: 120 },
      execution: { command: { dnd5eSpellCast: {
        spellId: 'magic-missile', slotLevel: 2,
        alternateResourceSpell: { featureId: 'demo.plugin:rune-magic', grantId: 'bolt' },
      } } },
    })
  })

  it('exposes only current-turn Host grants and preserves their authority credentials', async () => {
    const grantedWorkspace = {
      ...workspace,
      characters: [{
        ...workspace.characters[0],
        combatState: {
          bonusWeaponAttackGrants: [{
            id: 'follow-up', label: '追击', turnKey: '2:1', economy: 'bonusAction',
            options: { activityWeaponAttackGrantId: 'follow-up', activityWeaponAttackWeaponSlot: 'main-hand' },
          }, {
            id: 'expired', label: '过期攻击', turnKey: '1:0', economy: 'bonusAction', options: {},
          }],
          basicActionGrants: [{
            grantId: 'charger', label: '冲锋者', turnKey: '2:1', actions: ['shove'], shovePushDistanceBonusFeet: 10,
          }, {
            grantId: 'burst', label: '疾走许可', turnKey: '2:1', actions: ['dash'],
          }, {
            grantId: 'old-burst', label: '过期疾走', turnKey: '1:0', actions: ['dash'],
          }],
          linkedEquipmentRecall: { weaponId: 'bonded-sword', weaponName: '联结长剑' },
          extraActionTeleport: { turnKey: '2:1', rangeFeet: 30 },
        },
      }],
      combat: {
        active: true,
        turnEconomy: {
          'hero-token': {
            turnKey: '2:1',
            action: { current: 1, maximum: 1 }, bonusAction: { current: 1, maximum: 1 },
            reaction: { current: 1, maximum: 1 }, movement: { current: 30, maximum: 30 },
          },
        },
      },
      scene: { controlledTokens: [{ id: 'hero-token', characterId: 'hero' }], visibleTokens: [] },
    } as unknown as MobilePlayerWorkspace
    const registry = await buildMobileActionRegistry({ workspace: grantedWorkspace, credentials, rules: null })

    expect(registry.actions.find((entry) => entry.id === 'host-granted-weapon-attack:follow-up')).toMatchObject({
      economy: 'bonusAction',
      execution: { command: { dnd5eWeaponAttackOptions: {
        activityWeaponAttackGrantId: 'follow-up', activityWeaponAttackWeaponSlot: 'main-hand',
      } } },
    })
    expect(registry.actions.some((entry) => entry.label === '过期攻击')).toBe(false)
    expect(registry.actions.find(entry => entry.id === 'host-granted-basic-action:burst:dash')).toMatchObject({
      economy: 'bonusAction', targeting: { kind: 'none' },
      execution: { command: { dnd5eBasicAction: { kind: 'dash', activityBasicActionGrantId: 'burst' } } },
    })
    expect(registry.actions.some(entry => entry.id.includes('old-burst'))).toBe(false)
    expect(registry.actions.find((entry) => entry.id === 'host-granted-basic-action:charger:shove:push')).toMatchObject({
      economy: 'bonusAction',
      execution: { command: { dnd5eBasicAction: {
        kind: 'shove', outcome: 'push', activityBasicActionGrantId: 'charger',
      } } },
    })
    expect(registry.actions.find((entry) => entry.id === 'feature.linked-equipment-recall')).toMatchObject({
      execution: { command: { dnd5eClassFeature: { feature: 'linked-equipment-recall', weaponId: 'bonded-sword' } } },
    })
    expect(registry.actions.find((entry) => entry.id === 'feature.extra-action-teleport')).toMatchObject({
      targeting: { kind: 'area', rangeFeet: 30 },
      execution: { command: { dnd5eClassFeature: { feature: 'feature-extra-action-teleport' } } },
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
