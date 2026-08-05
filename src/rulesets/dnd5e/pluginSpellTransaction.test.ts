import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5eConditionalDamageDefense } from './damageDefenses'
import type { Dnd5eDamageType } from './damageTypes'
import { DND5E_LEATHER_ARMOR } from './equipment'
import { DND5E_SRD_MONSTERS } from './monsters'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { createDnd5eEffectiveRulesContextV1 } from './effectiveRulesContext'

function wizard(spellId: string): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'wizard', name: '法师', player: '', avatar: '', accent: '',
    race: '人类', charClass: '法师', level: 5, background: '', experience: 0, reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '5d6', ac: 14, speed: 30, initiativeBonus: 2,
    saveDC: 15, passivePerception: 11, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': [spellId] } } } },
    classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } },
  }
}

function token(id: string, type: 'player' | 'enemy', x: number, characterId?: string): Token {
  return { id, label: id, x, y: 25, color: '', emoji: '', size: 1, type, characterId, hp: 30, maxHp: 30 }
}

describe('plugin spell CombatTransaction', () => {
  it('uses a higher slot to authorize and settle additional creature targets', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.chain-spark', name: 'Chain Spark', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'chain-spark', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'chain-spark', name: '连锁火花', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          targeting: { relation: 'enemy', maximumTargets: 1 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '升环增加目标测试。',
          mechanics: {
            kind: 'damage', resolution: 'automatic',
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'lightning' },
            upcast: { fromSlotLevel: 1, effects: [
              { kind: 'additional-targets', countPerSlot: 1 },
              { kind: 'flat-damage', amountPerSlot: 2 },
            ] },
          },
          automation: { mode: 'headless-action', actionId: 'chain-spark' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy1 = token('enemy-1', 'enemy', 125)
      const enemy2 = token('enemy-2', 'enemy', 175)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy1, enemy2] }
      const action: SharedPlayerActionState = {
        id: 'chain-spark-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy1.id,
        dnd5eSpellCast: { spellId, slotLevel: 2, targetTokenId: enemy1.id, targetTokenIds: [enemy1.id, enemy2.id] },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy1, enemy2].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens).toHaveLength(2)
      expect(prepared.prepared.damageDice.bonus).toBe(2)
      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: { targetRolls: [{ damageRolls: [4] }, { damageRolls: [5] }] },
      })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.finalDamage).toBe(13)
      expect(resolved.result.state.combatants[enemy1.id].currentHp).toBe(24)
      expect(resolved.result.state.combatants[enemy2.id].currentHp).toBe(23)
    } finally {
      dispose()
    }
  })

  it('rebuilds a freely rotated rectangle on the Host and settles every target with shared upcast damage', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.rotated-wall', name: 'Rotated Wall', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'rotated-wall', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'rotated-wall', name: '旋转冰墙', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' },
          range: { type: 'distance', feet: 60, shape: 'rect', widthFeet: 20, heightFeet: 10, rotatable: true },
          targeting: { relation: 'enemy', includeSelf: false, maximumTargets: 64 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'timed', value: 1, unit: 'round', concentration: true },
          classes: ['wizard'], description: '旋转长方形范围测试。',
          mechanics: {
            kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'dex', onSuccess: 'half' },
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'cold' },
            upcast: { fromSlotLevel: 1, effects: [
              { kind: 'damage-dice', diceCountPerSlot: 1 },
              { kind: 'duration-rounds', roundsPerSlot: 2 },
            ] },
          },
          automation: { mode: 'headless-action', actionId: 'rotated-wall' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy1 = token('enemy-1', 'enemy', 225)
      const enemy2 = { ...token('enemy-2', 'enemy', 225), y: 75 }
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy1, enemy2] }
      const action: SharedPlayerActionState = {
        id: 'rotated-wall-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy1.id,
        dnd5eSpellCast: {
          spellId, slotLevel: 2, targetTokenId: enemy1.id,
          areaTargetCell: { col: 4, row: 0 }, areaTargetAngleDegrees: 45,
        },
        round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy1, enemy2].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.targetTokens.map((entry) => entry.id).sort()).toEqual(['enemy-1', 'enemy-2'])
      expect(prepared.prepared.damageDice).toMatchObject({ count: 2, sides: 6 })
      expect(prepared.prepared.concentrationRounds).toBe(3)

      const resolved = resolvePreparedDnd5ePluginSpellCast({
        prepared: prepared.prepared,
        rolls: {
          damageRolls: [4, 5],
          targetRolls: [{ savingThrowD20: 1 }, { savingThrowD20: 1 }],
        },
      })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.targetResolutions).toHaveLength(2)
      expect(resolved.finalDamage).toBe(18)
      expect(resolved.result.state.combatants[enemy1.id].currentHp).toBe(21)
      expect(resolved.result.state.combatants[enemy2.id].currentHp).toBe(21)
    } finally {
      dispose()
    }
  })

  it('applies the configured cantrip threshold through the Host damage recipe', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.cantrip-scaling', name: 'Cantrip Scaling', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'twin-spark', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'twin-spark', name: '双重火花', level: 0, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '原创测试戏法。',
          mechanics: {
            kind: 'damage', resolution: 'spell-attack',
            damage: {
              dice: { count: 2, sides: 4, bonus: 0 }, type: 'fire',
              cantripScaling: {
                basis: 'character-level',
                steps: [{ level: 5, diceCount: 1, flatDamage: 2 }, { level: 11, diceCount: 2 }],
              },
            },
          },
          automation: { mode: 'headless-action', actionId: 'twin-spark' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      actor.dnd5eClassChoices = { classes: { wizard: { selections: { 'spell-cantrips': [spellId] } } } }
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'cantrip-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, slotLevel: 0, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      expect(prepareDnd5ePluginSpellCast({
        action,
        map,
        characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
        roomRequiredPlugins: null,
      })).toEqual({ ok: false, reason: 'room-rules-unavailable' })
      expect(prepareDnd5ePluginSpellCast({
        action,
        map,
        characters: [{ ...actor, equipment: { armor: DND5E_LEATHER_ARMOR } }],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })).toEqual({ ok: false, reason: 'armor-proficiency-required' })
      expect(prepareDnd5ePluginSpellCast({
        action,
        map,
        characters: [{ ...actor, equipment: { armor: DND5E_LEATHER_ARMOR }, conditions: ['沉默'] }],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
        effectiveRules: createDnd5eEffectiveRulesContextV1({
          houseRules: { spellcastingPrerequisitesEnabled: false },
        }),
      })).toMatchObject({ ok: true })
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.damageDice).toMatchObject({ count: 3, sides: 4, bonus: 2 })
    } finally {
      dispose()
    }
  })

  it('validates the slot and components, applies upcast/save/concentration, and records the RollLedger', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.spell-tx', name: 'Spell Tx', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'frost-bind', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'frost-bind', name: '霜缚', level: 1, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'timed', value: 1, unit: 'minute', concentration: true },
          classes: ['wizard'], description: '原创测试法术。',
          mechanics: {
            kind: 'damage', resolution: 'saving-throw', savingThrow: { ability: 'dex', onSuccess: 'half' },
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'cold' },
            conditions: [{ condition: 'restrained', trigger: 'on-failed-save', duration: { kind: 'concentration' } }],
            upcast: { fromSlotLevel: 1, effects: [{ kind: 'damage-dice', diceCountPerSlot: 1 }] },
          },
          automation: { mode: 'headless-action', actionId: 'frost-bind' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'plugin-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, slotLevel: 2, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
        now: 1,
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.damageDice).toMatchObject({ count: 2, sides: 6 })
      expect(prepared.prepared.componentCheck).toMatchObject({ verbal: 'available', somatic: 'available', material: 'not-required' })
      expect(actor.classResources?.['dnd5e-spell-slot-2']?.current).toBe(1)

      const resolved = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { savingThrowD20: 20, damageRolls: [5, 5] }, now: 2 })
      expect(resolved.result.ok).toBe(true)
      expect(resolved.saveSucceeded).toBe(true)
      expect(resolved.finalDamage).toBe(5)
      expect(resolved.transaction.status).toBe('committed')
      expect(resolved.transaction.rollLedger.entries.map((entry) => entry.kind)).toEqual(['saving-throw', 'damage'])
      expect(resolved.result.state.combatants[actorToken.id].classResources['dnd5e-spell-slot-2'].current).toBe(0)
      expect(resolved.result.state.combatants[enemy.id].currentHp).toBe(25)
      expect(resolved.result.state.combatants[actorToken.id].classState.concentrationSpellId).toBe(spellId)
      expect(resolved.result.state.combatants[enemy.id].conditions).not.toContain('restrained')

      const failedSave = resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, rolls: { savingThrowD20: 1, damageRolls: [5, 5] }, now: 3 })
      expect(failedSave.result.ok).toBe(true)
      expect(failedSave.result.state.combatants[enemy.id].conditions).toContain('restrained')
      expect(failedSave.result.state.combatants[enemy.id].classState.activeEffects?.[0]?.duration).toMatchObject({
        type: 'concentration', sourceActorId: actorToken.id, concentrationId: spellId,
      })
    } finally {
      dispose()
    }
  })

  it('routes plugin spell damage through static and source-aware defenses exactly once', () => {
    let spellId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: 'com.example.spell-defenses', name: 'Spell Defenses', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
      setup(api) {
        api.registerHeadlessAction({ id: 'ember', resolve: ({ succeed }) => succeed() })
        spellId = api.registerSpell({
          id: 'ember', name: '余烬', level: 2, school: 'evocation', ritual: false,
          castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 60 },
          components: { verbal: true, somatic: true, material: false },
          duration: { type: 'instantaneous', concentration: false },
          classes: ['wizard'], description: '用于验证插件法术伤害防御入口。',
          mechanics: {
            kind: 'damage', resolution: 'automatic',
            damage: { dice: { count: 1, sides: 6, bonus: 0 }, type: 'fire' },
          },
          automation: { mode: 'headless-action', actionId: 'ember' },
        })
      },
    })
    try {
      const actor = wizard(spellId)
      actor.alignment = 'LG'
      const actorToken = token('wizard-token', 'player', 25, actor.id)
      const enemy = token('enemy-token', 'enemy', 125)
      const map: BattleMap = { id: 'map', name: 'Map', width: 1000, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actorToken, enemy] }
      const action: SharedPlayerActionState = {
        id: 'plugin-defense-cast', mapId: map.id, combatId: 'combat', sourceMode: 'player', status: 'pending', type: 'dnd5e-spell-cast',
        actorTokenId: actorToken.id, characterId: actor.id, targetTokenId: enemy.id,
        dnd5eSpellCast: { spellId, slotLevel: 2, targetTokenId: enemy.id }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      }
      const prepared = prepareDnd5ePluginSpellCast({
        action, map, characters: [actor],
        initiativeOrder: [actorToken, enemy].map((entry, index) => ({ tokenId: entry.id, label: entry.label, emoji: '', color: '', roll: 20 - index })),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return

      const target = prepared.prepared.state.combatants[enemy.id]
      const resolveWith = (defenses: {
        immunities?: readonly Dnd5eDamageType[]
        resistances?: readonly Dnd5eDamageType[]
        vulnerabilities?: readonly Dnd5eDamageType[]
        rules?: readonly Dnd5eConditionalDamageDefense[]
      }) => {
        target.damageImmunities = [...(defenses.immunities ?? [])]
        target.damageResistances = [...(defenses.resistances ?? [])]
        target.damageVulnerabilities = [...(defenses.vulnerabilities ?? [])]
        target.damageDefenseRules = (defenses.rules ?? []).map((rule) => ({ ...rule }))
        return resolvePreparedDnd5ePluginSpellCast({
          prepared: prepared.prepared,
          rolls: { damageRolls: [5] },
        })
      }

      const unmodified = resolveWith({})
      expect(unmodified.rawDamage).toBe(5)
      expect(unmodified.finalDamage).toBe(5)
      expect(unmodified.result.state.combatants[enemy.id].currentHp).toBe(25)

      const immune = resolveWith({ immunities: ['fire'] })
      expect(immune.finalDamage).toBe(0)
      expect(immune.result.state.combatants[enemy.id].currentHp).toBe(30)

      const resistant = resolveWith({ resistances: ['fire'] })
      expect(resistant.finalDamage).toBe(2)
      expect(resistant.result.state.combatants[enemy.id].currentHp).toBe(28)

      const vulnerable = resolveWith({ vulnerabilities: ['fire'] })
      expect(vulnerable.finalDamage).toBe(10)
      expect(vulnerable.result.state.combatants[enemy.id].currentHp).toBe(20)

      const resistantAndVulnerable = resolveWith({
        resistances: ['fire'],
        vulnerabilities: ['fire'],
      })
      expect(resistantAndVulnerable.finalDamage).toBe(4)
      expect(resistantAndVulnerable.result.state.combatants[enemy.id].currentHp).toBe(26)

      const archmage = DND5E_SRD_MONSTERS.find((monster) => monster.id === 'srd-5.1:archmage')
      const archmageSpellRules = archmage?.damageDefenseRules?.filter((rule) =>
        rule.outcome === 'resistant' && rule.delivery === 'spell' && rule.magical === true
      )
      expect(archmageSpellRules).toHaveLength(1)
      const archmageSpellResistance = resolveWith({ rules: archmageSpellRules })
      expect(archmageSpellResistance.finalDamage).toBe(2)
      expect(archmageSpellResistance.result.state.combatants[enemy.id].currentHp).toBe(28)

      const weaponOnlyImmunity = resolveWith({
        rules: [{
          outcome: 'immune',
          damageTypes: ['fire'],
          delivery: 'weapon-attack',
          magical: false,
          reason: 'ordinary-fire-weapon-only',
        }],
      })
      expect(weaponOnlyImmunity.finalDamage).toBe(5)
      expect(weaponOnlyImmunity.result.state.combatants[enemy.id].currentHp).toBe(25)

      const vulnerableToGoodSpellcaster = resolveWith({
        rules: [{
          outcome: 'vulnerable',
          damageTypes: ['fire'],
          delivery: 'spell',
          magical: true,
          sourceMoralAlignment: 'good',
          reason: 'good-spellcaster',
        }],
      })
      expect(vulnerableToGoodSpellcaster.finalDamage).toBe(10)
      expect(vulnerableToGoodSpellcaster.result.state.combatants[enemy.id].currentHp).toBe(20)

      target.limitedMagicImmunity = {
        kind: 'limited-magic-immunity',
        maximumSpellLevel: 6,
        advantageAboveMaximum: true,
        allowsWilling: true,
      }
      const limitedMagicImmunity = resolveWith({})
      expect(limitedMagicImmunity.finalDamage).toBe(0)
      expect(limitedMagicImmunity.result.state.combatants[enemy.id].currentHp).toBe(30)
      expect(limitedMagicImmunity.result.events).toContainEqual(expect.objectContaining({
        type: 'spell-negated-by-limited-magic-immunity',
        targetId: enemy.id,
        spellId,
        spellLevel: 2,
      }))
      expect(limitedMagicImmunity.result.events).toContainEqual(expect.objectContaining({
        type: 'class-resource-spent',
        resourceKey: 'dnd5e-spell-slot-2',
      }))
    } finally {
      dispose()
    }
  })
})
