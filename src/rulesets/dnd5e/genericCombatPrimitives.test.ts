import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { migrateCharacterToDnd5e } from './character'
import { resolveDnd5eDamageDefenses } from './damageDefenses'
import {
  createDnd5eCombatant,
  commitDnd5eActivityExecution,
  type Dnd5eAction,
  dnd5eCombatantPairKey,
  dnd5eDeclarativeCompanionProfileUpgrade,
  dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks,
  dnd5eDeclarativeEnvironmentalMovementSpeed,
  dnd5eWeaponClassDamageDefinitions,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import {
  dnd5eAlternateResourceSpellsForCharacter,
  dnd5eEffectiveAttacksPerAttackAction,
  dnd5ePluginFeatureDefinition,
  registerDnd5eRulesPlugin,
} from './pluginApi'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 18, cha: 8 } as const

function testCharacter(pluginFeatureIds: string[]): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'generic-primitives-character',
    name: 'Generic Primitives Character',
    player: '',
    avatar: '',
    accent: '',
    race: 'human',
    charClass: '牧师',
    dnd5eClassLevels: { cleric: 14 },
    level: 14,
    background: '',
    experience: 0,
    reputation: 0,
    abilities: { ...abilities },
    savingThrows: ['wis', 'cha'],
    skills: [],
    maxHp: 80,
    currentHp: 80,
    tempHp: 0,
    hitDice: '14d8',
    ac: 18,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 16,
    passivePerception: 14,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5ePluginFeatureIds: pluginFeatureIds,
  }
}

function combatant(
  id: string,
  initiative: number,
  patch: Record<string, unknown> = {},
) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 3,
    armorClass: 14,
    currentHp: 40,
    maxHp: 40,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('generic declarative combat primitives', () => {
  it('opens signed reaction-attack windows for nearby spell casts and enemy attacks against allies', () => {
    let sentinelFeatureId = ''
    let mageSlayerFeatureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.feat-reaction-windows', name: 'Feat Reaction Windows', version: '1.0.0',
        apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        sentinelFeatureId = api.registerFeature({
          id: 'sentinel', name: 'Sentinel', summary: 'Test.', description: 'Test.', automation: 'partial',
          declarativeAbility: {
            schemaVersion: 1, id: 'sentinel', name: 'Sentinel', description: 'Test.', level: 1,
            trigger: { kind: 'after-attack-roll' }, cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 }, effects: [],
            mechanic: { kind: 'reaction-weapon-attack', event: 'enemy-attacks-other' }, automation: 'full',
          },
        })
        mageSlayerFeatureId = api.registerFeature({
          id: 'mage-slayer', name: 'Mage Slayer', summary: 'Test.', description: 'Test.', automation: 'partial',
          declarativeAbility: {
            schemaVersion: 1, id: 'mage-slayer', name: 'Mage Slayer', description: 'Test.', level: 1,
            trigger: { kind: 'after-spell-cast' }, cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 }, effects: [],
            mechanic: { kind: 'reaction-weapon-attack', event: 'nearby-creature-casts-spell' }, automation: 'full',
          },
        })
      },
    })
    try {
      const enemy = combatant('enemy-attacker', 30, { controller: 'dm', position: { x: 5, y: 0 } })
      const ally = combatant('protected-ally', 20, { position: { x: 0, y: 0 } })
      const sentinel = combatant('sentinel-reactor', 10, {
        position: { x: 10, y: 0 }, pluginFeatureIds: [sentinelFeatureId],
      })
      const sentinelState = startDnd5eHeadlessCombat('sentinel-window', [enemy, ally, sentinel])
      sentinelState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(sentinel.id, enemy.id)]: 5,
      }
      const attacked = resolveDnd5eHeadlessAction(sentinelState, {
        type: 'attack', actorId: enemy.id, targetId: ally.id, attackModifier: 5, d20: 2,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      })
      expect(attacked.ok).toBe(true)
      if (!attacked.ok) return
      expect(attacked.state.combatants[sentinel.id].classState
        .declarativeReactionWeaponAttackOpportunities?.[sentinelFeatureId]).toMatchObject({
        targetId: enemy.id, triggerActorId: enemy.id, round: 1,
      })

      const caster = combatant('enemy-caster', 30, {
        controller: 'dm', classId: 'wizard', classLevels: { wizard: 1 },
        classSelections: { 'spell-prepared': ['magic-missile'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
      })
      const mageSlayer = combatant('mage-slayer-reactor', 20, {
        pluginFeatureIds: [mageSlayerFeatureId],
      })
      const spellTarget = combatant('spell-target', 10)
      const mageState = startDnd5eHeadlessCombat('mage-slayer-window', [caster, mageSlayer, spellTarget])
      mageState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(mageSlayer.id, caster.id)]: 5,
      }
      const cast = resolveDnd5eHeadlessAction(mageState, {
        type: 'cast-spell', actorId: caster.id, targetId: spellTarget.id, targetIds: [spellTarget.id],
        projectileTargetIds: [spellTarget.id, spellTarget.id, spellTarget.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1],
      })
      expect(cast.ok).toBe(true)
      if (!cast.ok) return
      expect(cast.state.combatants[mageSlayer.id].classState
        .declarativeReactionWeaponAttackOpportunities?.[mageSlayerFeatureId]).toMatchObject({
        targetId: caster.id, triggerActorId: caster.id, round: 1,
      })
    } finally {
      dispose()
    }
  })

  it('derives environmental movement only from the authoritative scene tag', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.environmental-movement', name: 'Environmental Movement Test', version: '1.0.0',
        apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'outdoor-flight', name: 'Outdoor Flight', summary: 'Test.', description: 'Test.', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'outdoor-flight', name: 'Outdoor Flight', description: 'Test.', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'environmental-movement', environments: ['outdoors'], mode: 'fly', speed: 'walking' },
            automation: 'full',
          },
        })
      },
    })
    try {
      const actor = combatant('environmental-flyer', 20, { speed: 35, pluginFeatureIds: [featureId] })
      expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor, 'outdoors', 'fly')).toBe(35)
      expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor, 'indoors', 'fly')).toBeUndefined()
      expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor, 'outdoors', 'swim')).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('issues and atomically consumes a generic persistent-companion command', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.companion-command', name: 'Companion Command Test', version: '1.0.0',
        apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'command', name: '伙伴指令', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'command', name: '伙伴指令', description: '测试。', level: 1,
            trigger: { kind: 'active-use' },
            targeting: { kind: 'single-creature', relation: 'ally', rangeFeet: 60 },
            effects: [{ kind: 'command-owned-companion', target: 'target', command: 'attack' }],
            automation: 'full',
          },
        })
      },
    })
    try {
      const owner = combatant('owner', 30, { pluginFeatureIds: [featureId] })
      const companion = combatant('companion', 20, {
        summonedSourceCombatantId: 'owner', summonedPersistent: true,
      })
      const enemy = combatant('enemy', 10, { controller: 'dm', position: { x: 5, y: 0 } })
      const state = startDnd5eHeadlessCombat('generic-companion-command', [owner, companion, enemy])
      state.initiativeIndex = 1
      const uncommanded = resolveDnd5eHeadlessAction(state, {
        type: 'attack', actorId: 'companion', targetId: 'enemy', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
      })
      expect(uncommanded).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

      state.initiativeIndex = 0
      const issued = commitDnd5eActivityExecution(state, {
        actorId: 'owner', activityId: 'command-companion', targetIds: ['companion'],
        source: { kind: 'feature', id: 'command' },
        resolution: {
          ok: true, status: 'resolved', checks: [],
          consumptions: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
          proposals: [{
            kind: 'command-owned-companion', operationId: 'issue', targetId: 'companion', command: 'attack',
          }],
        },
      })
      expect(issued.ok).toBe(true)
      if (!issued.ok) return
      expect(issued.state.combatants.companion.classState.companionCommand).toMatchObject({
        sourceOwnerId: 'owner', sourceFeatureId: featureId, command: 'attack',
      })
      issued.state.initiativeIndex = 1
      const commanded = resolveDnd5eHeadlessAction(issued.state, {
        type: 'attack', actorId: 'companion', targetId: 'enemy', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
      })
      expect(commanded.ok).toBe(true)
      if (!commanded.ok) return
      expect(commanded.state.combatants.companion.classState.companionCommand).toBeUndefined()
      expect(commanded.state.combatants.enemy.currentHp).toBe(36)
    } finally {
      dispose()
    }
  })

  it('authorizes resource spells from Host definitions and atomically spends their declared resource', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.alternate-resource-spells', name: 'Alternate Resource Spell Test',
        version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'resource-spells', name: '资源施法', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'resource-spells', name: '资源施法', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'alternate-resource-spellcasting', classId: 'monk', ability: 'wis',
              resourceId: 'dnd5e-ki', resourceScope: 'core', ignoreMaterialComponents: true,
              grants: [{ id: 'radiant-cantrip', spellId: 'sacred-flame', castAtLevel: 0, resourceCost: 1 }],
            },
            automation: 'full',
          },
        })
      },
    })
    try {
      const character = {
        ...testCharacter([featureId]),
        charClass: '武僧', level: 3, dnd5eClassLevels: { monk: 3 },
        classResources: { 'dnd5e-ki': { current: 2, max: 3 } },
      }
      expect(dnd5eAlternateResourceSpellsForCharacter(character)).toEqual([
        expect.objectContaining({
          featureId, grantId: 'radiant-cantrip', spellId: 'sacred-flame',
          resourceId: 'dnd5e-ki', castLevelOptions: [{ slotLevel: 0, resourceCost: 1 }],
        }),
      ])

      const monk = combatant('resource-caster', 30, {
        classId: 'monk', classLevels: { monk: 3 }, level: 3,
        pluginFeatureIds: [featureId], classResources: { 'dnd5e-ki': { current: 2, max: 3 } },
      })
      const target = combatant('resource-target', 20, { controller: 'dm' })
      const state = startDnd5eHeadlessCombat('alternate-resource-spell', [monk, target])
      const resolved = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: monk.id, targetId: target.id,
        spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1, effectRolls: [6],
        alternateResourceSpell: { featureId, grantId: 'radiant-cantrip' },
      })
      expect(resolved.ok).toBe(true)
      if (!resolved.ok) return
      expect(resolved.state.combatants[monk.id].classResources['dnd5e-ki'].current).toBe(1)
      expect(resolved.state.combatants[target.id].currentHp).toBe(34)
      expect(resolved.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved', abilityId: featureId, trigger: 'spell-cast',
      }))

      state.combatants[monk.id].pluginFeatureIds = []
      expect(resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: monk.id, targetId: target.id,
        spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1, effectRolls: [6],
        alternateResourceSpell: { featureId, grantId: 'radiant-cantrip' },
      })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
      expect(state.combatants[monk.id].classResources['dnd5e-ki'].current).toBe(2)
    } finally {
      dispose()
    }
  })

  it('settles imported granted-die weapon damage and reaction AC options atomically', () => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.granted-die-options', name: 'Granted Die Options Test',
        version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        featureId = api.registerFeature({
          id: 'combat-options', name: '奖励骰战斗选项', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'combat-options', name: '奖励骰战斗选项', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-roll' }, targeting: { kind: 'single-creature', relation: 'ally' },
            effects: [], mechanic: {
              kind: 'granted-die-combat-options', dieState: 'bardic-inspiration',
              addToWeaponDamage: true, addToArmorClassAgainstAttack: true,
            }, automation: 'full',
          },
        })
      },
    })
    try {
      const source = combatant('die-source', 5, { pluginFeatureIds: [featureId] })
      const attacker = combatant('incoming-attacker', 30, {
        controller: 'dm', armorClass: 12, position: { x: 5, y: 0 },
      })
      const defender = combatant('die-defender', 20, {
        armorClass: 14,
        classState: {
          bardicInspirationDie: 6,
          bardicInspirationSourceId: source.id,
          bardicInspirationRoundsRemaining: 10,
        },
      })
      const defense = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('granted-die-defense', [source, attacker, defender]),
        {
          type: 'attack', actorId: attacker.id, targetId: defender.id,
          attackModifier: 5, d20: 10, grantedDieArmorClassRoll: 2,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'slashing' },
        },
      )
      expect(defense.ok).toBe(true)
      if (!defense.ok) return
      expect(defense.state.combatants[defender.id].currentHp).toBe(40)
      expect(defense.state.combatants[defender.id].turn.reactionAvailable).toBe(false)
      expect(defense.state.combatants[defender.id].classState.bardicInspirationDie).toBeUndefined()

      const striker = combatant('die-striker', 30, {
        classState: {
          bardicInspirationDie: 6,
          bardicInspirationSourceId: source.id,
          bardicInspirationRoundsRemaining: 10,
        },
      })
      const victim = combatant('die-victim', 20, { controller: 'dm' })
      const damage = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('granted-die-damage', [source, striker, victim]),
        {
          type: 'attack', actorId: striker.id, targetId: victim.id,
          attackModifier: 20, d20: 10, grantedDieWeaponDamageRoll: 5,
          damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
          classDamageContext: {
            mode: 'melee', finesse: false, strengthBased: true, weaponId: 'test-sword',
            weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false,
          },
        },
      )
      expect(damage.ok).toBe(true)
      if (!damage.ok) return
      expect(damage.state.combatants[victim.id].currentHp).toBe(31)
      expect(damage.state.combatants[striker.id].classState.bardicInspirationDie).toBeUndefined()
    } finally {
      dispose()
    }
  })

  it('settles extra attacks, weapon riders, spell modifiers, passive defenses, and signed reaction attacks', () => {
    let extraAttackFeatureId = ''
    let riderFeatureId = ''
    let spellModifierFeatureId = ''
    let passiveDefenseFeatureId = ''
    let reactionAttackFeatureId = ''
    let formEligibilityFeatureId = ''
    let formControlFeatureId = ''
    let transformedMagicalFeatureId = ''
    let summonBonusFeatureId = ''
    let companionUpgradeFeatureId = ''
    let creatureTraversalFeatureId = ''
    let damageMaximizationFeatureId = ''
    let weaponDamageMaximizationFeatureId = ''
    let featureDamageActionFeatureId = ''
    let weaponDamageMaximizationSubclassId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: 'test.generic-combat-primitives',
        name: 'Generic Combat Primitives Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Tests',
        license: 'Test only',
      },
      setup(api) {
        extraAttackFeatureId = api.registerFeature({
          id: 'extra-attack', name: '额外攻击', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'extra-attack', name: '额外攻击', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' },
            mechanic: { kind: 'attacks-per-action', attacks: 2 }, effects: [], automation: 'full',
          },
        })
        riderFeatureId = api.registerFeature({
          id: 'weapon-rider', name: '附伤', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'weapon-rider', name: '附伤', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-hit' },
            targeting: { kind: 'single-creature', relation: 'enemy' },
            rolls: [{
              id: 'rider-damage', kind: 'damage', label: '附伤', damageType: 'radiant',
              dice: { count: 1, sides: 8, scaling: { basis: 'class-level', classId: 'cleric', steps: [{ level: 14, addDice: 1 }] } },
            }],
            effects: [{ kind: 'damage', target: 'target', rollId: 'rider-damage' }],
            limits: { oncePerTurn: true },
            mechanic: { kind: 'weapon-damage-rider', rollId: 'rider-damage' }, automation: 'full',
          },
        })
        spellModifierFeatureId = api.registerFeature({
          id: 'spell-modifier', name: '强力施法', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'spell-modifier', name: '强力施法', description: '测试。', level: 1,
            trigger: { kind: 'after-spell-cast' }, targeting: { kind: 'self' },
            mechanic: { kind: 'spell-damage-ability-modifier', spellcastingClassId: 'cleric', ability: 'wis', maximumSpellLevel: 0 },
            effects: [], automation: 'full',
          },
        })
        passiveDefenseFeatureId = api.registerFeature({
          id: 'passive-defense', name: '被动防御', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'passive-defense', name: '被动防御', description: '测试。', level: 1,
            trigger: { kind: 'before-damage-taken' }, targeting: { kind: 'self' },
            mechanic: {
              kind: 'passive-defense',
              damageResistance: { damageTypes: ['slashing'], delivery: 'weapon-attack', magical: false },
              savingThrowAdvantageAgainstSpells: true,
              hitPointMaximumReductionImmunity: true,
              conditionImmunities: ['charmed'],
              damageReflection: { damageTypes: ['psychic'], multiplier: 1 },
            },
            effects: [], automation: 'full',
          },
        })
        reactionAttackFeatureId = api.registerFeature({
          id: 'reaction-attack', name: '反应攻击', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'reaction-attack', name: '反应攻击', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-hit' }, cost: { economy: 'reaction' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 5 },
            mechanic: { kind: 'reaction-weapon-attack', event: 'other-creature-hit' },
            effects: [], automation: 'full',
          },
        })
        formEligibilityFeatureId = api.registerFeature({
          id: 'form-eligibility', name: '形态目录', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'form-eligibility', name: '形态目录', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'creature-form-eligibility', system: 'wild-shape', creatureTypes: ['beast'],
              maximumChallengeRating: { kind: 'class-level', classId: 'druid', divisor: 3, minimum: 1 },
              useCoreMovementLimits: true,
            },
            automation: 'full',
          },
        })
        formControlFeatureId = api.registerFeature({
          id: 'form-control', name: '变形控制', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'form-control', name: '变形控制', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'creature-form-control', system: 'wild-shape', activationEconomy: 'bonusAction',
              inFormHealing: {
                economy: 'bonusAction', resource: 'spell-slot',
                dicePerResourceLevel: { count: 1, sides: 8 }, maximumResourceLevel: 9,
              },
            },
            automation: 'full',
          },
        })
        transformedMagicalFeatureId = api.registerFeature({
          id: 'transformed-magical', name: '形态魔法攻击', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'transformed-magical', name: '形态魔法攻击', description: '测试。', level: 1,
            trigger: { kind: 'after-attack-hit' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'passive-defense', weaponAttacksMagical: { while: 'transformed' } },
            automation: 'full',
          },
        })
        summonBonusFeatureId = api.registerFeature({
          id: 'summon-bonus', name: '召唤强化', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'summon-bonus', name: '召唤强化', description: '测试。', level: 1,
            trigger: { kind: 'after-spell-cast' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'summoned-creature-bonus', source: 'spell',
              temporaryHitPoints: { kind: 'fixed', value: 30 },
              maximumHitPointBonus: { kind: 'fixed', value: 5 },
              weaponDamageBonus: { kind: 'proficiency-bonus' },
              spellSchools: ['conjuration'],
            },
            automation: 'full',
          },
        })
        companionUpgradeFeatureId = api.registerFeature({
          id: 'companion-upgrade', name: '伙伴成长', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'companion-upgrade', name: '伙伴成长', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'companion-profile-upgrade', weaponAttacksMagical: true,
              attacksPerAction: 2, shareSelfSpellsRangeFeet: 30,
            },
            automation: 'full',
          },
        })
        creatureTraversalFeatureId = api.registerFeature({
          id: 'creature-traversal', name: '占位穿越', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'creature-traversal', name: '占位穿越', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'creature-space-traversal', minimumLargerSizeRanks: 1 },
            automation: 'full',
          },
        })
        damageMaximizationFeatureId = api.registerFeature({
          id: 'damage-maximization', name: '伤害骰最大化', summary: '测试。', description: '测试。', automation: 'full',
          declarativeAbility: {
            schemaVersion: 1, id: 'damage-maximization', name: '伤害骰最大化', description: '测试。', level: 1,
            trigger: { kind: 'after-spell-cast' },
            cost: { resources: [{ scope: 'core', resourceId: 'test-maximization', amount: 1 }] },
            targeting: { kind: 'self' }, effects: [],
            mechanic: { kind: 'damage-roll-maximization', damageTypes: ['thunder'], deliveries: ['spell'] },
            automation: 'full',
          },
        })
        weaponDamageMaximizationSubclassId = api.registerDeclarativeSubclass({
          schemaVersion: 1,
          id: 'weapon-maximizer',
          classId: 'fighter',
          name: '武器最大化测试',
          summary: '测试通用预激活武器伤害最大化。',
          combatHooks: [{
            id: 'arm-weapon-maximization', timing: 'after-attack-hit',
            abilityId: 'weapon-maximization', decision: 'actor-choice',
            activation: 'prearm', retention: 'until-triggered',
          }],
          abilities: [{
            schemaVersion: 1, id: 'weapon-maximization', name: '武器伤害最大化',
            description: '测试。', level: 1, trigger: { kind: 'after-attack-hit' },
            cost: { resources: [{ scope: 'core', resourceId: 'test-weapon-maximization', amount: 1 }] },
            targeting: { kind: 'self' }, effects: [],
            mechanic: {
              kind: 'damage-roll-maximization', damageTypes: ['lightning'],
              deliveries: ['weapon-attack', 'feature'],
            },
            automation: 'full',
          }, {
            schemaVersion: 1, id: 'feature-lightning', name: '特性闪电伤害',
            description: '测试。', level: 1, trigger: { kind: 'active-use' },
            cost: { economy: 'action' },
            targeting: { kind: 'single-creature', relation: 'enemy', rangeFeet: 30 },
            rolls: [{
              id: 'feature-lightning-damage', kind: 'damage', label: '闪电伤害',
              damageType: 'lightning', dice: { count: 2, sides: 8 },
            }],
            effects: [{ kind: 'damage', target: 'target', rollId: 'feature-lightning-damage' }],
            automation: 'full',
          }],
        })
        weaponDamageMaximizationFeatureId =
          'test.generic-combat-primitives:weapon-maximizer.weapon-maximization'
        featureDamageActionFeatureId =
          'test.generic-combat-primitives:weapon-maximizer.feature-lightning'
      },
    })

    try {
      const character = testCharacter([
        extraAttackFeatureId,
        passiveDefenseFeatureId,
      ])
      expect(dnd5eEffectiveAttacksPerAttackAction(character)).toBe(2)
      const projected = migrateCharacterToDnd5e(character)
      expect(projected).toMatchObject({
        spellSavingThrowAdvantage: true,
        hitPointMaximumReductionImmunity: true,
        conditionImmunities: expect.arrayContaining(['charmed']),
      })
      expect(resolveDnd5eDamageDefenses({
        damage: 9,
        source: { damageType: 'slashing', delivery: 'weapon-attack', magical: false },
        defenses: { damageDefenseRules: projected.damageDefenseRules },
      }).finalDamage).toBe(4)
      expect(resolveDnd5eDamageDefenses({
        damage: 9,
        source: { damageType: 'slashing', delivery: 'weapon-attack', magical: true },
        defenses: { damageDefenseRules: projected.damageDefenseRules },
      }).finalDamage).toBe(9)
      expect(dnd5eSavingThrowMode(projected, 'dex', { sourceIsSpell: true })).toBe('advantage')
      expect(dnd5eSavingThrowMode(projected, 'dex', { sourceIsSpell: false })).toBe('normal')

      const psychicSource = combatant('psychic-source', 30)
      const reflector = combatant('reflector', 30, { controller: 'dm', pluginFeatureIds: [passiveDefenseFeatureId] })
      const reflectionState = startDnd5eHeadlessCombat('generic-reflection', [psychicSource, reflector])
      const reflected = resolveDnd5eHeadlessAction(reflectionState, {
        type: 'attack', actorId: psychicSource.id, targetId: reflector.id,
        attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'psychic' },
      })
      expect(reflected.ok).toBe(true)
      if (!reflected.ok) return
      expect(reflected.state.combatants[reflector.id].currentHp).toBe(32)
      expect(reflected.state.combatants[psychicSource.id].currentHp).toBe(32)
      expect(reflected.events).toContainEqual(expect.objectContaining({
        type: 'declarative-damage-reflected', actorId: reflector.id,
        sourceId: psychicSource.id, amount: 8, damageType: 'psychic',
      }))

      const striker = combatant('striker', 30, {
        classId: 'cleric', level: 14, pluginFeatureIds: [riderFeatureId],
      })
      const riderTarget = combatant('rider-target', 20, { controller: 'dm' })
      const riderState = startDnd5eHeadlessCombat('generic-rider', [striker, riderTarget])
      const riderContext = {
        mode: 'melee' as const, finesse: false, strengthBased: true,
        weaponDamageSides: 8, damageType: 'slashing' as const, adjacentEnemyOfTarget: false,
      }
      expect(dnd5eWeaponClassDamageDefinitions({
        state: riderState, actorId: 'striker', targetId: 'rider-target',
        context: riderContext, critical: false,
      })).toContainEqual(expect.objectContaining({
        source: 'weapon-damage-rider', featureId: riderFeatureId, count: 2, sides: 8, type: 'radiant',
      }))
      const riderAttack = resolveDnd5eHeadlessAction(riderState, {
        type: 'attack', actorId: 'striker', targetId: 'rider-target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
        classDamageContext: riderContext,
        classDamageRolls: [{ source: 'weapon-damage-rider', rolls: [5, 6] }],
      })
      expect(riderAttack.ok).toBe(true)
      if (!riderAttack.ok) return
      expect(riderAttack.state.combatants['rider-target'].currentHp).toBe(25)
      expect(dnd5eWeaponClassDamageDefinitions({
        state: riderAttack.state, actorId: 'striker', targetId: 'rider-target',
        context: riderContext, critical: false,
      })).not.toContainEqual(expect.objectContaining({ featureId: riderFeatureId }))

      const cleric = combatant('cleric', 30, {
        classId: 'cleric', level: 8, abilities: { ...abilities, wis: 18 },
        classSelections: { 'spell-cantrips': ['sacred-flame'] },
        pluginFeatureIds: [spellModifierFeatureId],
      })
      const spellTarget = combatant('spell-target', 20, { controller: 'dm' })
      const spellResult = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('generic-spell-modifier', [cleric, spellTarget]),
        {
          type: 'cast-spell', actorId: 'cleric', targetId: 'spell-target',
          spellId: 'sacred-flame', slotLevel: 0, savingThrowD20: 1, effectRolls: [4, 4],
        },
      )
      expect(spellResult.ok).toBe(true)
      if (!spellResult.ok) return
      expect(spellResult.state.combatants['spell-target'].currentHp).toBe(28)
      expect(spellResult.events).toContainEqual(expect.objectContaining({
        type: 'spell-damage-feature-bonus-applied',
        featureId: spellModifierFeatureId,
        ability: 'wis',
        amount: 4,
      }))

      const maximizer = combatant('maximizer', 30, {
        classId: 'wizard', classLevels: { wizard: 3 }, level: 3,
        classSelections: { 'spell-prepared': ['shatter'] },
        classResources: {
          'dnd5e-spell-slot-2': { current: 1, max: 1 },
          'test-maximization': { current: 1, max: 1 },
        },
        pluginFeatureIds: [damageMaximizationFeatureId],
      })
      const maximizationTarget = combatant('maximization-target', 20, { controller: 'dm' })
      const maximizationState = startDnd5eHeadlessCombat('generic-damage-maximization', [maximizer, maximizationTarget])
      const forgedMaximization = resolveDnd5eHeadlessAction(maximizationState, {
        type: 'cast-spell', actorId: 'maximizer', targetId: 'maximization-target',
        spellId: 'shatter', slotLevel: 2, savingThrowD20: 1,
        damageMaximizationFeatureId, effectRolls: [1],
      })
      expect(forgedMaximization).toMatchObject({ ok: false, reason: 'invalid-dice' })
      expect(maximizationState.combatants.maximizer.classResources).toMatchObject({
        'dnd5e-spell-slot-2': { current: 1 },
        'test-maximization': { current: 1 },
      })
      const maximized = resolveDnd5eHeadlessAction(maximizationState, {
        type: 'cast-spell', actorId: 'maximizer', targetId: 'maximization-target',
        spellId: 'shatter', slotLevel: 2, savingThrowD20: 1,
        damageMaximizationFeatureId, effectRolls: [],
      })
      expect(maximized.ok).toBe(true)
      if (!maximized.ok) return
      expect(maximized.state.combatants['maximization-target'].currentHp).toBe(16)
      expect(maximized.state.combatants.maximizer.classResources['test-maximization'].current).toBe(0)
      expect(maximized.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved', abilityId: damageMaximizationFeatureId,
        trigger: 'damage-roll',
      }))

      const weaponMaximizer = combatant('weapon-maximizer', 30, {
        classId: 'fighter', classLevels: { fighter: 3 }, level: 3,
        subclassIds: { fighter: weaponDamageMaximizationSubclassId },
        classResources: { 'test-weapon-maximization': { current: 1, max: 1 } },
        pluginFeatureIds: [weaponDamageMaximizationFeatureId],
      })
      const weaponMaxTarget = combatant('weapon-max-target', 20, { controller: 'dm' })
      const weaponMaxState = startDnd5eHeadlessCombat('generic-weapon-damage-maximization', [
        weaponMaximizer, weaponMaxTarget,
      ])
      expect(resolveDnd5eHeadlessAction(weaponMaxState, {
        type: 'attack', actorId: weaponMaximizer.id, targetId: weaponMaxTarget.id,
        attackModifier: 10, d20: 10,
        declarativeIntentFeatureIds: [weaponDamageMaximizationFeatureId],
        damage: { count: 1, sides: 8, bonus: 2, rolls: [7], type: 'lightning' },
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
      const weaponMaximized = resolveDnd5eHeadlessAction(weaponMaxState, {
        type: 'attack', actorId: weaponMaximizer.id, targetId: weaponMaxTarget.id,
        attackModifier: 10, d20: 10,
        declarativeIntentFeatureIds: [weaponDamageMaximizationFeatureId],
        damage: { count: 1, sides: 8, bonus: 2, rolls: [8], type: 'lightning' },
      })
      expect(weaponMaximized.ok).toBe(true)
      if (!weaponMaximized.ok) return
      expect(weaponMaximized.state.combatants[weaponMaxTarget.id].currentHp).toBe(30)
      expect(weaponMaximized.state.combatants[weaponMaximizer.id]
        .classResources['test-weapon-maximization'].current).toBe(0)
      expect(weaponMaximized.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved',
        abilityId: weaponDamageMaximizationFeatureId,
        trigger: 'damage-roll',
      }))

      const featureMaximizer = combatant('feature-maximizer', 30, {
        classId: 'fighter', classLevels: { fighter: 3 }, level: 3,
        subclassIds: { fighter: weaponDamageMaximizationSubclassId },
        classResources: { 'test-weapon-maximization': { current: 1, max: 1 } },
        pluginFeatureIds: [weaponDamageMaximizationFeatureId, featureDamageActionFeatureId],
      })
      const featureMaxTarget = combatant('feature-max-target', 20, { controller: 'dm' })
      const featureMaxState = startDnd5eHeadlessCombat('generic-feature-damage-maximization', [
        featureMaximizer, featureMaxTarget,
      ])
      featureMaxState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(featureMaximizer.id, featureMaxTarget.id)]: 20,
      }
      const featureDamageAction = dnd5ePluginFeatureDefinition(featureDamageActionFeatureId)?.action
      expect(featureDamageAction).toBeDefined()
      if (!featureDamageAction) return
      expect(resolveDnd5eHeadlessAction(featureMaxState, {
        type: 'plugin', pluginId: 'test.generic-combat-primitives',
        actionId: featureDamageAction.id, featureId: featureDamageActionFeatureId,
        transactionId: 'feature-max-forged',
        modifierFeatureIds: [weaponDamageMaximizationFeatureId],
        actorId: featureMaximizer.id, targetId: featureMaxTarget.id, distanceFeet: 20,
        rolls: {
          'feature-lightning-damage': { values: [8, 7], modifier: 0, total: 15 },
        },
      })).toMatchObject({ ok: false, reason: 'invalid-dice' })
      const featureMaximized = resolveDnd5eHeadlessAction(featureMaxState, {
        type: 'plugin', pluginId: 'test.generic-combat-primitives',
        actionId: featureDamageAction.id, featureId: featureDamageActionFeatureId,
        transactionId: 'feature-max-valid',
        modifierFeatureIds: [weaponDamageMaximizationFeatureId],
        actorId: featureMaximizer.id, targetId: featureMaxTarget.id, distanceFeet: 20,
        rolls: {
          'feature-lightning-damage': { values: [8, 8], modifier: 0, total: 16 },
        },
      })
      expect(featureMaximized.ok ? 'ok' : featureMaximized.reason).toBe('ok')
      if (!featureMaximized.ok) return
      expect(featureMaximized.state.combatants[featureMaxTarget.id].currentHp).toBe(24)
      expect(featureMaximized.state.combatants[featureMaximizer.id]
        .classResources['test-weapon-maximization'].current).toBe(0)
      expect(featureMaximized.events).toContainEqual(expect.objectContaining({
        type: 'declarative-subclass-ability-resolved',
        abilityId: weaponDamageMaximizationFeatureId,
        trigger: 'damage-roll',
      }))

      const ally = combatant('ally', 30, { position: { x: 0, y: 0 } })
      const enemy = combatant('enemy', 20, { controller: 'dm', position: { x: 5, y: 0 } })
      const reactor = combatant('reactor', 10, {
        position: { x: 10, y: 0 }, pluginFeatureIds: [reactionAttackFeatureId],
      })
      const reactionState = startDnd5eHeadlessCombat('generic-reaction', [ally, enemy, reactor])
      reactionState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey('reactor', 'enemy')]: 5,
      }
      const forged = resolveDnd5eHeadlessAction(reactionState, {
        type: 'opportunity-attack', actorId: 'reactor', targetId: 'enemy',
        reactionFeature: 'declarative-reaction-weapon-attack', reactionFeatureId: reactionAttackFeatureId,
        attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      })
      expect(forged).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
      const trigger = resolveDnd5eHeadlessAction(reactionState, {
        type: 'attack', actorId: 'ally', targetId: 'enemy', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      })
      expect(trigger.ok).toBe(true)
      if (!trigger.ok) return
      expect(trigger.state.combatants.reactor.classState
        .declarativeReactionWeaponAttackOpportunities?.[reactionAttackFeatureId]).toMatchObject({
        targetId: 'enemy', triggerActorId: 'ally', round: 1,
      })
      const reaction = resolveDnd5eHeadlessAction(trigger.state, {
        type: 'opportunity-attack', actorId: 'reactor', targetId: 'enemy',
        reactionFeature: 'declarative-reaction-weapon-attack', reactionFeatureId: reactionAttackFeatureId,
        attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      })
      expect(reaction.ok).toBe(true)
      if (!reaction.ok) return
      expect(reaction.state.combatants.reactor.turn.reactionAvailable).toBe(false)
      expect(reaction.state.combatants.reactor.classState
        .declarativeReactionWeaponAttackOpportunities?.[reactionAttackFeatureId]).toBeUndefined()

      const shapechanger = combatant('shapechanger', 30, {
        classId: 'druid', classLevels: { druid: 6 }, level: 6,
        classResources: {
          'dnd5e-wild-shape': { current: 2, max: 2 },
          'dnd5e-spell-slot-2': { current: 1, max: 3 },
        },
        classSelections: { 'wild-shape-known-forms': ['srd-5.1:polar-bear'] },
        pluginFeatureIds: [formEligibilityFeatureId, formControlFeatureId, transformedMagicalFeatureId],
      })
      const shaped = resolveDnd5eHeadlessAction(
        startDnd5eHeadlessCombat('generic-form-rules', [shapechanger, combatant('form-enemy', 20, { controller: 'dm' })]),
        { type: 'druid-wild-shape', actorId: 'shapechanger', formId: 'srd-5.1:polar-bear' },
      )
      expect(shaped.ok).toBe(true)
      if (!shaped.ok) return
      expect(shaped.state.combatants.shapechanger).toMatchObject({
        statBlockId: 'srd-5.1:polar-bear', weaponAttacksMagical: true,
        turn: { actionAvailable: true, bonusActionAvailable: false },
      })
      shaped.state.combatants.shapechanger.currentHp = 30
      shaped.state.combatants.shapechanger.classState.wildShapeCurrentHp = 30
      shaped.state.combatants.shapechanger.turn.bonusActionAvailable = true
      const formHealing = resolveDnd5eHeadlessAction(shaped.state, {
        type: 'druid-creature-form-heal', actorId: 'shapechanger', slotLevel: 2,
        healingRolls: [8, 7],
      })
      expect(formHealing.ok).toBe(true)
      if (!formHealing.ok) return
      expect(formHealing.state.combatants.shapechanger).toMatchObject({
        currentHp: 42,
        classResources: { 'dnd5e-spell-slot-2': { current: 0, max: 3 } },
        turn: { bonusActionAvailable: false },
        classState: { wildShapeCurrentHp: 42 },
      })

      const summoner = combatant('summoner', 30, { pluginFeatureIds: [summonBonusFeatureId] })
      expect(dnd5eDeclarativeCompanionProfileUpgrade(combatant('companion-owner', 31, {
        pluginFeatureIds: [companionUpgradeFeatureId],
      }))).toEqual({
        weaponAttacksMagical: true,
        attacksPerAction: 2,
        shareSelfSpellsRangeFeet: 30,
      })
      expect(dnd5eDeclarativeCreatureSpaceTraversalMinimumLargerSizeRanks(
        combatant('traverser', 32, { pluginFeatureIds: [creatureTraversalFeatureId] }),
      )).toBe(1)
      const summonResult = commitDnd5eActivityExecution(
        startDnd5eHeadlessCombat('generic-summon-bonus', [summoner, combatant('summon-target', 20, { controller: 'dm' })]),
        {
          actorId: 'summoner', activityId: 'test-summon', targetIds: [],
          source: { kind: 'spell', id: 'flaming-sphere' },
          resolution: {
            ok: true, status: 'resolved', checks: [], consumptions: [],
            proposals: [{
              kind: 'summon', operationId: 'summon-one', monsterId: 'srd-5.1:wolf', count: 1,
              timing: 'immediate', durationRounds: 10, concentration: true, side: 'ally',
            }],
          },
        },
      )
      expect(summonResult.ok ? 'ok' : summonResult.reason).toBe('ok')
      expect(summonResult.activityHandoffs?.summons[0]).toMatchObject({
        temporaryHitPoints: 30,
        maximumHitPointBonus: 5,
        weaponDamageBonus: 3,
      })
    } finally {
      dispose()
    }
  })

  it('intercepts an affecting spell, locks its source, and grants temporary casting through the generic primitive', () => {
    const pluginId = 'test.spell-interception'
    const subclassId = `${pluginId}:spell-thief`
    const featureId = `${subclassId}.spell-thief`
    const usesResourceId = `${pluginId}:decl-spell-thief-spell-thief-uses`
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Spell Interception Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        api.registerDeclarativeSubclass({
          schemaVersion: 1, id: 'spell-thief', classId: 'rogue', name: 'Spell Thief', summary: 'Test.',
          spellcasting: {
            progression: 'one-third', learning: 'known', ability: 'int', spellListClassId: 'wizard',
            cantripChoiceGroupId: 'spell-cantrips', spellChoiceGroupId: 'spell-known',
            cantripsKnownByClassLevel: [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
            spellsKnownByClassLevel: [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13],
            allowedSchools: ['enchantment', 'illusion'],
            unrestrictedSpellsKnownByClassLevel: [0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4],
            ritualCasting: false, focus: '无',
          },
          abilities: [{
            schemaVersion: 1, id: 'spell-thief', name: 'Spell Thief', description: 'Test.', level: 17,
            trigger: { kind: 'before-spell-effect' },
            cost: { economy: 'reaction', uses: 1 },
            targeting: { kind: 'self' },
            limits: { uses: { kind: 'fixed', value: 1 }, reset: 'long-rest' },
            effects: [],
            mechanic: {
              kind: 'spell-interception', spellcastingClassId: 'rogue',
              saveAbility: 'int', dcAbility: 'int', minimumSpellLevel: 1,
              maximumSpellLevel: 'actor-maximum-slot', negateForSelf: true,
              grantTemporarySpellAccess: true, prohibitSourceCasting: true,
              durationRounds: 4800,
            },
            automation: 'full',
          }],
        })
      },
    })
    try {
      const caster = combatant('spell-source', 30, {
        controller: 'dm', classId: 'wizard', classLevels: { wizard: 17 }, level: 17,
        abilities: { ...abilities, int: 20 },
        classSelections: { 'spell-prepared': ['magic-missile'] },
        classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } },
      })
      const thief = combatant('spell-thief', 20, {
        classId: 'rogue', classLevels: { rogue: 17 }, level: 17,
        subclassIds: { rogue: subclassId }, pluginFeatureIds: [featureId],
        abilities: { ...abilities, int: 18 }, proficiencyBonus: 6,
        classResources: {
          'dnd5e-spell-slot-1': { current: 1, max: 1 },
          [usesResourceId]: { current: 1, max: 1 },
        },
      })
      const state = startDnd5eHeadlessCombat('spell-interception', [caster, thief])
      const intercepted = resolveDnd5eHeadlessAction(state, {
        type: 'cast-spell', actorId: caster.id, targetId: thief.id, targetIds: [thief.id],
        projectileTargetIds: [thief.id, thief.id, thief.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [4, 4, 4],
        spellInterceptionReaction: {
          actorId: thief.id, featureId, savingThrowD20: 1,
        },
      } as Dnd5eAction)
      expect(intercepted.ok, intercepted.ok ? undefined : intercepted.reason).toBe(true)
      if (!intercepted.ok) return
      expect(intercepted.state.combatants[thief.id]).toMatchObject({
        currentHp: 40,
        turn: { reactionAvailable: false },
        classResources: { [usesResourceId]: { current: 0, max: 1 } },
        classState: {
          declarativeSpellInterceptionGrants: {
            [featureId]: {
              spellId: 'magic-missile', sourceActorId: caster.id,
              castingClassId: 'rogue', roundsRemaining: 4800,
            },
          },
        },
      })
      expect(intercepted.state.combatants[caster.id].classState.declarativeSpellInterceptionLocks)
        .toMatchObject({
          [featureId]: {
            spellId: 'magic-missile', sourceActorId: thief.id, roundsRemaining: 4800,
          },
        })
      expect(intercepted.events).toContainEqual(expect.objectContaining({
        type: 'spell-interception-resolved', actorId: thief.id, casterId: caster.id,
        featureId, success: false, negatedForSelf: true,
        temporaryAccessGranted: true, sourceCastingProhibited: true,
      }))

      intercepted.state.combatants[caster.id].turn.actionAvailable = true
      const locked = resolveDnd5eHeadlessAction(intercepted.state, {
        type: 'cast-spell', actorId: caster.id, targetId: thief.id, targetIds: [thief.id],
        projectileTargetIds: [thief.id, thief.id, thief.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1],
      })
      expect(locked).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

      intercepted.state.initiativeIndex = 1
      intercepted.state.combatants[thief.id].turn.actionAvailable = true
      const stolenCast = resolveDnd5eHeadlessAction(intercepted.state, {
        type: 'cast-spell', actorId: thief.id, castingClassId: 'rogue',
        targetId: caster.id, targetIds: [caster.id],
        projectileTargetIds: [caster.id, caster.id, caster.id],
        spellId: 'magic-missile', slotLevel: 1, effectRolls: [1, 1, 1],
      })
      expect(stolenCast.ok, stolenCast.ok ? undefined : stolenCast.reason).toBe(true)
      if (!stolenCast.ok) return
      expect(stolenCast.state.combatants[caster.id].currentHp).toBe(34)
      expect(stolenCast.state.combatants[thief.id].classResources['dnd5e-spell-slot-1'].current).toBe(0)
    } finally {
      dispose()
    }
  })
})
