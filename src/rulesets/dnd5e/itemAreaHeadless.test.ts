import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

function state(dexterity = 10) {
  const actor = createDnd5eCombatant({
    id: 'actor', name: '冒险者', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: dexterity, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
  })
  const enemy = createDnd5eCombatant({
    id: 'enemy', name: '敌人', controller: 'dm', initiative: 1,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 100, y: 0 }, concentrating: false,
  })
  return startDnd5eHeadlessCombat('combat', [actor, enemy])
}

describe('SRD 物品区域 Headless 触发', () => {
  it('滚珠豁免失败时施加倒地', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'item-area-trigger', actorId: 'actor', areaId: 'area', areaKind: 'ball-bearings', d20: 3,
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.actor.conditions).toContain('prone')
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'item-area-triggered', success: false }))
  })

  it('铁蒺藜失败造成穿刺伤害和 10 尺速度减值', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'item-area-trigger', actorId: 'actor', areaId: 'area', areaKind: 'caltrops', d20: 2,
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.actor.currentHp).toBe(19)
    expect(result.state.combatants.actor.classState.caltropsSpeedPenaltyFeet).toBe(10)
  })

  it('捕猎陷阱失败结算 1d4 并施加束缚', () => {
    const result = resolveDnd5eHeadlessAction(state(), {
      type: 'item-area-trigger', actorId: 'actor', areaId: 'area', areaKind: 'hunting-trap', d20: 2,
      damageRolls: [4],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.actor.currentHp).toBe(16)
    expect(result.state.combatants.actor.conditions).toContain('restrained')
  })
})
