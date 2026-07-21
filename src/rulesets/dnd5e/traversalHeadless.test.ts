import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const base = {
  abilities: { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  concentrating: false, temporaryHp: 0, proficiencyBonus: 2,
}

describe('D&D 5e traversal in Headless combat', () => {
  it('authoritatively applies fall damage, elevation, movement, and prone', () => {
    const hero = createDnd5eCombatant({
      ...base, id: 'hero', name: '英雄', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30,
      position: { x: 0, y: 0 }, elevationFeet: 30,
    })
    const enemy = createDnd5eCombatant({
      ...base, id: 'enemy', name: '敌人', controller: 'dm', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 5, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('combat', [hero, enemy])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: hero.id, to: { x: 5, y: 0 }, distance: 5,
      traversalMode: 'fall', toElevationFeet: 0, fallingDamageRolls: [2, 3, 4],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero).toMatchObject({ currentHp: 11, elevationFeet: 0 })
    expect(result.state.combatants.hero.conditions).toContain('prone')
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'falling-damage-resolved', damage: 9 }))
  })

  it('does not treat a controlled descent as a fall', () => {
    const hero = createDnd5eCombatant({
      ...base, id: 'hero', name: '英雄', controller: 'player', initiative: 20,
      armorClass: 14, currentHp: 20, maxHp: 20, speed: 30,
      position: { x: 0, y: 0 }, elevationFeet: 10,
    })
    const enemy = createDnd5eCombatant({
      ...base, id: 'enemy', name: '敌人', controller: 'dm', initiative: 10,
      armorClass: 12, currentHp: 10, maxHp: 10, speed: 30, position: { x: 10, y: 0 },
    })
    const state = startDnd5eHeadlessCombat('combat', [hero, enemy])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: hero.id, to: { x: 5, y: 0 }, distance: 5,
      traversalMode: 'climb', toElevationFeet: 0,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hero.currentHp).toBe(20)
    expect(result.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
  })
})
