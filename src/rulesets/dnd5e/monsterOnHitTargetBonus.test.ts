import { afterEach, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft } from './customMonsterWorkshop'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { setDnd5eRoomMonsterCatalog } from './monsters'

afterEach(() => setDnd5eRoomMonsterCatalog([]))

it.each(['failed', 'half', 'resistant', 'vulnerable', 'foreign', 'suspended', 'critical', 'invalid', 'negative', 'miss', 'fixed-leading', 'fixed-only'] as const)(
  'on-hit saves have one bonus per separate damage pool, not per component: %s', mode => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.actions[0].toHit = 8
    const monster = buildDnd5eCustomMonster(draft)
    const primary = monster.actions[0].attack!
    primary.damage = [{ count: 1, sides: 6, bonus: 0, average: 3, type: 'slashing' }]
    primary.onHitEffects = [{ id: 'rider', kind: 'saving-throw-damage', ability: 'con', dc: 15,
      damageOnSuccessfulSave: 'half', damage: [
        { count: ['fixed-leading', 'fixed-only'].includes(mode) ? 0 : 1, sides: 6, bonus: ['fixed-leading', 'fixed-only'].includes(mode) ? 4 : mode === 'negative' ? -6 : 0, average: 3, type: 'poison' },
        { count: mode === 'fixed-only' ? 0 : 1, sides: 6, bonus: mode === 'fixed-only' ? 3 : 0, average: 3, type: 'fire' },
      ] }]
    setDnd5eRoomMonsterCatalog([monster])
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
      controller: id === 'actor' ? 'dm' : 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 12, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
      concentrating: false, position: { x: 0, y: 0 }, ...(id === 'actor' ? { statBlockId: monster.id } : {}) })
    const state = startDnd5eHeadlessCombat('rider-bonus', [make('actor', 20), make('target', 10)])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
    state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: 'target',
      source: { kind: 'feature', actorId: mode === 'foreign' ? 'other' : 'actor' }, modifiers: { damageRollsBySourceBonus: 3 } })]
    if (mode === 'suspended') state.combatants.target.classState.activeEffects[0].suspendedBy = ['antimagic']
    if (mode === 'resistant') state.combatants.target.damageResistances = ['poison', 'fire']
    if (mode === 'vulnerable') state.combatants.target.damageVulnerabilities = ['poison', 'fire']
    const before = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'actor', actionId: monster.actions[0].id,
      rolls: [{ targetId: 'target', d20: mode === 'critical' ? 20 : mode === 'miss' ? 1 : 15,
        damageRolls: mode === 'miss' ? [] : [mode === 'critical' ? [2, 2] : [2]],
        onHitEffectRolls: mode === 'miss' ? [] : [{ effectId: 'rider',
          d20: ['half', 'resistant', 'vulnerable'].includes(mode) ? 20 : 1,
          damageRolls: [['fixed-leading', 'fixed-only'].includes(mode) ? [] : [4], mode === 'fixed-only' ? [] : [mode === 'invalid' ? 7 : 3]] }] }] })
    expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
    // Main weapon: 2+3; rider: (4+3)+3=10, half=5, split 3+2.
    const amount = { failed: 15, half: 10, resistant: 7, vulnerable: 15, foreign: 9, suspended: 9,
      critical: 17, invalid: 0, negative: 9, miss: 0, 'fixed-leading': 15, 'fixed-only': 12 }[mode]
    expect(result.state.combatants.target.currentHp, mode).toBe(100 - amount)
    if (!result.ok) { expect(result.reason).toBe('invalid-dice'); expect(result.state).toEqual(before) }
    else expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(
      ['foreign', 'suspended', 'miss'].includes(mode) ? 0 : mode === 'fixed-only' ? 1 : 2)
    expect(state).toEqual(before)
  })
