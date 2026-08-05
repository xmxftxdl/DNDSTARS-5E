import { describe, expect, it } from 'vitest'
import {
  fighterSubclassDefinition,
  fighterSelectedSubclassChoices,
  registeredFighterSubclasses,
} from './fighter'
import {
  dnd5ePluginAbilityGenerationMethod,
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginFeatureDefinition,
  normalizeDnd5ePluginPersistentAreaVerticalDeclaration,
  dnd5ePluginRaceDefinition,
  registerDnd5eRulesPlugin,
  roomActiveDnd5eRulesPluginRequirements,
  roomDistributableDnd5eRulesPluginRequirements,
  registeredDnd5ePluginAbilityGenerationMethods,
  registeredDnd5ePluginBackgrounds,
  registeredDnd5ePluginRaces,
  registeredDnd5ePluginSpells,
  registeredDnd5ePluginItems,
  registeredDnd5ePluginSubclasses,
  dnd5eCharacterHasPluginFeature,
  registeredDnd5eRulesPlugins,
} from './pluginApi'
import { syncCharacterClassResources } from '../../lib/classResources'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import type { Character } from '../../types/character'

const ABILITIES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

function combatant(id: string, initiative: number) {
  return createDnd5eCombatant({
    id, name: id, controller: 'player', initiative, abilities: ABILITIES, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
  })
}

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: 'Hero', player: '', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
    background: '侍僧', experience: 0, reputation: 0, abilities: ABILITIES, savingThrows: [], skills: [],
    maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '1d10', ac: 10, speed: 30, initiativeBonus: 0,
    saveDC: 10, passivePerception: 10, inspiration: 0, 
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    ...patch,
  }
}

describe('D&D 5e rules plugin API', () => {
  it('omits local-only metadata from room handshake requirements', () => {
    const disposeLocal = registerDnd5eRulesPlugin({
      manifest: {
        id: 'local.example.private-room-metadata', name: 'Private', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private',
        distributionPolicy: 'local-only',
      },
      setup() {},
    }, { integrity: 'sha256-YWJjZA==' })
    const disposeRoom = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.room-metadata', name: 'Room', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
        distributionPolicy: 'room-distributable',
      },
      setup() {},
    }, { integrity: 'sha256-ZGVmZw==' })
    try {
      const ids = roomDistributableDnd5eRulesPluginRequirements().map((requirement) => requirement.id)
      expect(ids).toContain('com.example.room-metadata')
      expect(ids).not.toContain('local.example.private-room-metadata')
    } finally {
      disposeRoom()
      disposeLocal()
    }
  })

  it('includes room-ephemeral only in the active room handshake', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'local.example.room-ephemeral', name: 'Ephemeral', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Local', license: 'Private',
        distributionPolicy: 'room-ephemeral',
      },
      setup() {},
    }, { integrity: 'sha256-ZXBoZW1lcmFs' })
    try {
      expect(roomActiveDnd5eRulesPluginRequirements().map((entry) => entry.id))
        .toContain('local.example.room-ephemeral')
      expect(roomDistributableDnd5eRulesPluginRequirements().map((entry) => entry.id))
        .not.toContain('local.example.room-ephemeral')
    } finally {
      dispose()
    }
  })

  it('rejects summon actions that bypass the turn economy', () => {
    expect(() => registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.free-summon', name: 'Free Summon', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'summon', resolve: ({ succeed }) => succeed() })
        api.registerFeature({
          id: 'summon', name: '无限召唤', summary: '测试。', description: '测试。', automation: 'full',
          action: {
            id: 'summon', label: '召唤', economy: 'none',
            targeting: {
              kind: 'area', relation: 'any', includeSelf: false,
              template: { shape: 'circle', origin: 'point', radiusFeet: 5, placeRangeFeet: 30 },
            },
            summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10 },
          },
        })
      },
    })).toThrow('Invalid plugin summon')
  })

  it('strictly validates and clones persistent-area vertical declarations', () => {
    const pluginId = 'com.example.vertical-area'
    const vertical = { mode: 'volume' as const, heightFeet: 30 }
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Vertical Area', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'cloud', resolve: ({ succeed }) => succeed() })
        api.registerFeature({
          id: 'cloud', name: 'Cloud', summary: 'Volume.', description: 'Volume.', automation: 'full',
          action: {
            id: 'cloud', label: 'Place cloud', economy: 'action',
            targeting: {
              kind: 'area', template: { shape: 'circle', origin: 'point', radiusFeet: 10, placeRangeFeet: 60 },
            },
            persistentArea: { label: 'Cloud', durationRounds: 10, vertical },
          },
        })
      },
    })
    try {
      vertical.heightFeet = 90
      const first = dnd5ePluginFeatureDefinition(`${pluginId}:cloud`)
      expect(first?.action?.persistentArea?.vertical).toEqual({ mode: 'volume', heightFeet: 30 })
      if (first?.action?.persistentArea?.vertical?.mode === 'volume') {
        first.action.persistentArea.vertical.heightFeet = 120
      }
      expect(dnd5ePluginFeatureDefinition(`${pluginId}:cloud`)?.action?.persistentArea?.vertical)
        .toEqual({ mode: 'volume', heightFeet: 30 })
    } finally {
      dispose()
    }

    expect(normalizeDnd5ePluginPersistentAreaVerticalDeclaration({ mode: 'ground' }))
      .toEqual({ mode: 'ground' })
    expect(normalizeDnd5ePluginPersistentAreaVerticalDeclaration({
      mode: 'volume', heightFeet: 0,
    })).toBeUndefined()
    expect(normalizeDnd5ePluginPersistentAreaVerticalDeclaration({
      mode: 'ground', baseElevationFeet: 10,
    })).toBeUndefined()
  })

  it('preserves the declared pre-roll Interrupt cancellation option', () => {
    const pluginId = 'com.example.interrupt-cancel'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Interrupt Cancel', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'confirm', resolve: ({ succeed }) => succeed() })
        api.registerFeature({
          id: 'confirm', name: '确认效果', summary: '测试。', description: '测试。', automation: 'full',
          action: {
            id: 'confirm', label: '使用', economy: 'action', targeting: { kind: 'self' },
            interrupt: {
              prompt: '是否继续？', audience: 'dm',
              options: [{ id: 'apply', label: '继续' }, { id: 'cancel', label: '取消' }],
              defaultOptionId: 'cancel', cancelOptionId: 'cancel',
            },
          },
        })
      },
    })
    try {
      expect(dnd5ePluginFeatureDefinition(`${pluginId}:confirm`)?.action?.interrupt?.cancelOptionId).toBe('cancel')
    } finally {
      dispose()
    }
  })

  it('registers a declarative subclass, auto-granted feature, and rest-aware resource', () => {
    const pluginId = 'com.example.chronomancer'
    let subclassId = ''
    let resourceId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Chronomancer', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'time-step', resolve: ({ succeed }) => succeed() })
        subclassId = api.registerSubclass({
          id: 'chronomancer', classId: 'wizard', name: '时序学派', summary: '测试声明式子职。',
          features: [{
            id: 'time-step', level: 2, name: '时间步', description: '测试自动授予特性。',
            action: { id: 'time-step', label: '使用时间步', economy: 'bonusAction', targeting: { kind: 'self' } },
          }],
          choiceGroups: [{
            id: 'tempo', level: 2, name: '节奏', maxSelections: 1,
            options: [{ id: 'slow', name: '缓拍', summary: '测试选项。' }, { id: 'fast', name: '急拍', summary: '测试选项。' }],
          }],
        })
        resourceId = api.registerResource({
          id: 'time-charges', label: '时间充能', classId: 'wizard', subclassId: 'chronomancer',
          minimumLevel: 2, maximum: [0, 2, 3], resetOn: 'short-rest',
        })
      },
    })
    try {
      const featureId = `${pluginId}:chronomancer.time-step`
      const wizard = character({
        charClass: '法师', level: 3,
        dnd5eClassChoices: { classes: { wizard: { subclass: subclassId, selections: { [`${subclassId}/tempo`]: ['fast'] } } } },
      })
      expect(registeredDnd5ePluginSubclasses('wizard')).toEqual([
        expect.objectContaining({ id: subclassId, name: '时序学派' }),
      ])
      expect(dnd5eCharacterHasPluginFeature(wizard, featureId)).toBe(true)
      expect(syncCharacterClassResources(wizard).classResources?.[resourceId]).toEqual({ current: 3, max: 3 })
      expect(dnd5eCharacterHasPluginFeature({ ...wizard, dnd5eClassChoices: undefined }, featureId)).toBe(false)
    } finally {
      dispose()
    }
    expect(registeredDnd5ePluginSubclasses('wizard')).toEqual([])
  })

  it('registers a declarative spell template with V/S/M, damage, upcast and condition metadata', () => {
    const pluginId = 'com.example.spells'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Spell Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({ id: 'ember-lance', execution: 'worker' })
        expect(api.registerSpell({
          id: 'ember-lance', name: '余烬长枪', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' },
          range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: true, materialText: '一小块燧石' },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['sorcerer', 'wizard'], description: '测试法术。',
          mechanics: {
            kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'dex', onSuccess: 'half' },
            damage: { dice: { count: 2, sides: 6, bonus: 0 }, type: 'fire' },
            conditions: [{ condition: 'blinded', trigger: 'on-failed-save', duration: { kind: 'target-next-turn-start' } }],
            upcast: { fromSlotLevel: 2, effects: [{ kind: 'damage-dice', diceCountPerSlot: 1 }] },
          },
          automation: { mode: 'headless-action', actionId: 'ember-lance' },
        })).toBe(`${pluginId}:ember-lance`)
      },
    })
    try {
      expect(registeredDnd5ePluginSpells()).toEqual([
        expect.objectContaining({
          id: `${pluginId}:ember-lance`,
          components: expect.objectContaining({ verbal: true, somatic: true, material: true }),
          mechanics: expect.objectContaining({ kind: 'damage', damage: expect.objectContaining({ type: 'fire' }) }),
          automation: { mode: 'headless-action', actionId: 'ember-lance' },
        }),
      ])
    } finally {
      dispose()
    }
    expect(registeredDnd5ePluginSpells()).toEqual([])
  })

  it('registers namespaced declarative equipment and removes it with the plugin', () => {
    const pluginId = 'com.example.items'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Item Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        expect(api.registerItem({
          id: 'test-blade', name: '测试剑', category: 'equipment', icon: 'weapon',
          description: '测试装备。', rulesText: '命中与伤害 +1。', stackable: false,
          resources: [{ id: 'charges', label: '充能', maximum: 4, resetOn: 'dawn' }],
          headlessEffects: [{
            kind: 'attack-roll-reroll', resourceId: 'charges', maximumDice: 1,
            trigger: 'after-attack-roll', appliesTo: 'attacks-with-this-weapon',
          }, {
            schemaVersion: 1, id: 'bonus-fire', kind: 'on-hit-bonus-damage',
            trigger: 'after-attack-hit', appliesTo: 'attacks-with-this-weapon',
            damage: { count: 1, sides: 6, bonus: 0 }, damageType: 'fire',
            resourceId: 'charges', resourceCost: 1,
          }, {
            schemaVersion: 1, id: 'ward', kind: 'damage-reduction', trigger: 'before-damage',
            amount: 2, oncePerTurn: true, resourceId: 'charges', resourceCost: 1,
          }, {
            schemaVersion: 1, id: 'last-stand', kind: 'death-prevention',
            trigger: 'before-drop-to-zero', hitPointsAfter: 1,
            resourceId: 'charges', resourceCost: 1,
          }],
          use: {
            economy: 'action', consumeQuantity: 0,
            resourceCost: { resourceId: 'charges', amount: 1 },
            effect: {
              kind: 'spell-slot-recovery', maximumSlotLevel: 3, amount: 1,
              selection: 'selected-expended-slot',
            },
          },
          equipment: {
            slot: 'mainWeapon', effects: { weaponAttackBonus: 1, weaponDamageBonus: 1 },
            dnd5e: {
              kind: 'weapon', category: 'martial', mode: 'melee', attackAbility: 'str',
              damage: { count: 1, sides: 8, type: 'slashing' }, reachFeet: 5,
            },
          },
        })).toBe(`${pluginId}:test-blade`)
      },
    })
    try {
      expect(registeredDnd5ePluginItems()).toEqual([
        expect.objectContaining({
          id: `${pluginId}:test-blade`, name: '测试剑', ownerPluginId: pluginId,
          source: { book: 'Item Test', license: 'CC0-1.0' },
          equipment: expect.objectContaining({
            id: `${pluginId}:test-blade`, name: '测试剑',
            effects: { weaponAttackBonus: 1, weaponDamageBonus: 1 },
          }),
          resources: [{ id: 'charges', label: '充能', maximum: 4, resetOn: 'dawn' }],
          headlessEffects: expect.arrayContaining([
            expect.objectContaining({ kind: 'attack-roll-reroll', resourceId: 'charges' }),
            expect.objectContaining({ kind: 'on-hit-bonus-damage', damageType: 'fire' }),
            expect.objectContaining({ kind: 'damage-reduction', amount: 2 }),
            expect.objectContaining({ kind: 'death-prevention', hitPointsAfter: 1 }),
          ]),
          use: expect.objectContaining({
            resourceCost: { resourceId: 'charges', amount: 1 },
            effect: expect.objectContaining({ kind: 'spell-slot-recovery', maximumSlotLevel: 3 }),
          }),
        }),
      ])
    } finally {
      dispose()
    }
    expect(registeredDnd5ePluginItems()).toEqual([])
  })

  it('fails closed on unsupported or unbounded equipment effects', () => {
    expect(() => registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.invalid-item', name: 'Invalid Item', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerItem({
          id: 'unsafe', name: '不安全装备', category: 'equipment', icon: 'generic',
          description: '测试。', rulesText: '测试。', stackable: false,
          equipment: { slot: 'ring', effects: { armorClassBonus: 999 } },
        })
      },
    })).toThrow('Invalid plugin equipment effect armorClassBonus')
    expect(registeredDnd5ePluginItems()).toEqual([])
  })

  it('registers declarative races and ability generation rules with plugin namespaces', () => {
    const pluginId = 'com.example.character-creation'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Character Creation', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        expect(api.registerRace({
          id: 'starfolk', name: '星裔测试种族', speedFeet: 35,
          parentRace: { id: 'human', name: '人类' },
          abilityBonuses: { cha: 2 }, flexibleAbilityBonus: { count: 1, amount: 1, exclude: ['cha'] },
          skillProficiencyChoiceCount: 1,
          armorProficiencies: ['light'],
          weaponProficiencies: ['dnd5e-longsword'],
          toolProficiencies: ['星图工具'],
          grantedFeatureIds: ['starlight'],
          featChoiceCount: 1,
          hitPointsPerLevelBonus: 1,
          savingThrowAdvantages: { magicAbilities: ['int', 'wis', 'cha'] },
          automation: 'partial',
          automationReasons: ['夜空导航需要 DM 判断。'],
        })).toBe(`${pluginId}:starfolk`)
        api.registerFeature({
          id: 'starlight',
          name: '星光',
          summary: '测试种族自动授予。',
          description: '测试。',
          automation: 'manual',
        })
        expect(api.registerBackground({
          id: 'sky-sailor', name: '天帆水手', description: '测试背景。',
          skillProficiencies: ['athletics', 'perception'], toolProficiencies: ['导航工具'], languages: 1,
          feature: { name: '识风', description: '能够辨认常见天气变化。' },
        })).toBe(`${pluginId}:sky-sailor`)
        expect(api.registerAbilityGenerationMethod({
          id: 'heroic-array', name: '英雄数组', summary: '测试数组。', kind: 'standard-array',
          scores: [16, 15, 14, 12, 10, 8],
        })).toBe(`${pluginId}:heroic-array`)
      },
    })
    try {
      expect(dnd5ePluginRaceDefinition(`${pluginId}:starfolk`)).toMatchObject({
        name: '星裔测试种族',
        parentRace: { id: 'human', name: '人类' },
        speedFeet: 35,
        skillProficiencyChoiceCount: 1,
        armorProficiencies: ['light'],
        weaponProficiencies: ['dnd5e-longsword'],
        toolProficiencies: ['星图工具'],
        grantedFeatureIds: [`${pluginId}:starlight`],
        featChoiceCount: 1,
        hitPointsPerLevelBonus: 1,
        savingThrowAdvantages: { magicAbilities: ['int', 'wis', 'cha'] },
        automation: 'partial',
      })
      expect(dnd5eCharacterHasPluginFeature(character({
        race: '星裔测试种族',
        dnd5eRaceId: `${pluginId}:starfolk`,
      }), `${pluginId}:starlight`)).toBe(true)
      expect(dnd5ePluginBackgroundDefinition(`${pluginId}:sky-sailor`)).toMatchObject({
        name: '天帆水手', skillProficiencies: ['athletics', 'perception'], feature: { name: '识风' },
      })
      expect(dnd5ePluginAbilityGenerationMethod(`${pluginId}:heroic-array`)).toMatchObject({ kind: 'standard-array' })
      expect(registeredDnd5ePluginRaces().map((race) => race.id)).toContain(`${pluginId}:starfolk`)
      expect(registeredDnd5ePluginBackgrounds().map((background) => background.id)).toContain(`${pluginId}:sky-sailor`)
      expect(registeredDnd5ePluginAbilityGenerationMethods().map((method) => method.id)).toContain(`${pluginId}:heroic-array`)
    } finally {
      dispose()
    }
    expect(dnd5ePluginRaceDefinition(`${pluginId}:starfolk`)).toBeUndefined()
    expect(dnd5ePluginBackgroundDefinition(`${pluginId}:sky-sailor`)).toBeUndefined()
    expect(dnd5ePluginAbilityGenerationMethod(`${pluginId}:heroic-array`)).toBeUndefined()
  })

  it('namespaces third-party subclass content and removes it cleanly', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.options', name: 'Example Options', version: '1.0.0', apiVersion: 1,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        expect(api.registerFighterSubclass({
          id: 'guardian', name: '守卫', summary: '测试用第三方子职',
          features: [{ id: 'guard', level: 3, name: '护卫', description: '测试特性。' }],
          choiceGroups: [{
            id: 'stances', name: '架势', maxSelections: 1,
            options: [
              { id: 'steady', name: '稳固', summary: '测试选项。' },
              { id: 'mobile', name: '机动', summary: '测试选项。' },
            ],
          }],
        })).toBe('com.example.options:guardian')
      },
    })
    try {
      const definition = fighterSubclassDefinition('com.example.options:guardian')
      expect(definition?.ownerPluginId).toBe('com.example.options')
      expect(definition?.rulesTextSource).toBe('third-party-plugin')
      expect(definition?.features[0].id).toBe('com.example.options:guardian:guard')
      const selectedCharacter = character({
        dnd5eClassChoices: { fighter: {
          subclass: 'com.example.options:guardian',
          extensionChoices: { 'com.example.options:guardian/stances': ['steady'] },
        } },
      })
      expect(fighterSelectedSubclassChoices(selectedCharacter, definition!.id, definition!.choiceGroups![0])).toEqual(['steady'])
      expect(registeredDnd5eRulesPlugins().map((plugin) => plugin.id)).toContain('com.example.options')
    } finally {
      dispose()
    }
    expect(registeredFighterSubclasses().map((subclass) => subclass.id)).not.toContain('com.example.options:guardian')
  })

  it('runs plugin actions inside the authoritative headless resolver boundary', () => {
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'com.example.headless', name: 'Headless Example', version: '1.0.0', apiVersion: 1,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Example', license: 'CC0-1.0',
      },
      setup(api) {
        api.registerHeadlessAction({
          id: 'grant-temporary-hp',
          resolve({ state, action, events, succeed }) {
            const actor = state.combatants[action.actorId]
            actor.temporaryHp = 4
            events.push({
              type: 'healing-applied', targetId: actor.id, amount: 4,
              hpBefore: actor.currentHp, hpAfter: actor.currentHp,
            })
            return succeed()
          },
        })
      },
    })
    try {
      const state = startDnd5eHeadlessCombat('combat', [combatant('active', 20), combatant('waiting', 10)])
      const resolved = resolveDnd5eHeadlessAction(state, {
        type: 'plugin', pluginId: 'com.example.headless', actionId: 'grant-temporary-hp', actorId: 'active',
      })
      expect(resolved.ok).toBe(true)
      expect(resolved.state.combatants.active.temporaryHp).toBe(4)
      expect(state.combatants.active.temporaryHp).toBe(0)

      const stale = resolveDnd5eHeadlessAction(state, {
        type: 'plugin', pluginId: 'com.example.headless', actionId: 'grant-temporary-hp', actorId: 'waiting',
      })
      expect(stale).toMatchObject({ ok: false, reason: 'stale-turn' })
    } finally {
      dispose()
    }
  })

  it('rejects actions for plugins that are not installed', () => {
    const state = startDnd5eHeadlessCombat('combat', [combatant('active', 20), combatant('waiting', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'plugin', pluginId: 'missing.plugin', actionId: 'unknown', actorId: 'active',
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
  })
})
