import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function combatant(id: string, initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('D&D 5e monster resource actions', () => {
  it('spends legendary action points for an off-turn structured attack', () => {
    const hero = combatant('hero', 20, { controller: 'player', position: { x: 5, y: 0 } })
    const dragon = combatant('dragon', 10, {
      statBlockId: 'srd-5.1:adult-black-dragon',
      classState: { monsterLegendaryActionPoints: 3 },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('legendary', [hero, dragon]), {
      type: 'monster-legendary-action',
      actorId: 'dragon',
      actionId: 'tail-attack',
      rolls: [{ targetId: 'hero', d20: 15, damageRolls: [[5, 6]] }],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.dragon.classState.monsterLegendaryActionPoints).toBe(2)
    expect(result.events).toContainEqual({
      type: 'monster-legendary-action-used', actorId: 'dragon', actionId: 'tail-attack', cost: 1, remaining: 2,
    })
  })

  it('tracks spell slots and innate per-day uses independently', () => {
    const target = combatant('target', 10, { controller: 'player' })
    const mage = combatant('mage', 20, {
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 3: { current: 2, max: 3 } } },
    })
    const spell = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('monster-spell', [mage, target]), {
      type: 'monster-spell', actorId: 'mage', spellId: 'fireball', slotLevel: 3,
      effects: [{ targetId: 'target', operation: 'damage', amount: 12, damageType: 'fire' }],
    })
    expect(spell.ok).toBe(true)
    expect(spell.state.combatants.mage.classState.monsterSpellSlots?.['3'].current).toBe(1)
    expect(spell.state.combatants.target.currentHp).toBe(88)

    const giant = combatant('giant', 20, {
      statBlockId: 'srd-5.1:cloud-giant',
      classState: { monsterSpellUsesBySpellId: { fly: { current: 3, max: 3 } } },
    })
    const innate = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('innate-spell', [giant, target]), {
      type: 'monster-spell', actorId: 'giant', spellId: 'fly', slotLevel: 3, effects: [],
    })
    expect(innate.ok).toBe(true)
    expect(innate.state.combatants.giant.classState.monsterSpellUsesBySpellId?.fly.current).toBe(2)
  })

  it('prevents swarms from regaining hit points or receiving temporary hit points', () => {
    const mage = combatant('mage', 20, {
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 1: { current: 1, max: 1 } } },
    })
    const swarm = combatant('swarm', 10, {
      statBlockId: 'srd-5.1:swarm-of-rats', currentHp: 10, maxHp: 24,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('swarm-resources', [mage, swarm]), {
      type: 'monster-spell', actorId: 'mage', spellId: 'magic-missile', slotLevel: 1,
      effects: [
        { targetId: 'swarm', operation: 'healing', amount: 10 },
        { targetId: 'swarm', operation: 'temporary-hit-points', amount: 10 },
      ],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.swarm.currentHp).toBe(10)
    expect(result.state.combatants.swarm.temporaryHp).toBe(0)
  })
})
