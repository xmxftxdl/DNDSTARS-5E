import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'

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
})
