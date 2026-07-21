import { describe, expect, it, vi } from 'vitest'
import {
  createDnd5eCombatant,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
} from '../../rulesets/dnd5e'
import type { BattleMap, Token } from '../../store/maps'
import { settleDnd5eConcentrationChecks } from './settleDnd5eCombatResult'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function combatant(id: string, initiative: number, concentrating = false) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: id === 'hero' ? 'player' : 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating,
  })
}

function token(id: string, type: Token['type']): Token {
  return { id, label: id, x: 0, y: 0, color: '#000000', emoji: '', size: 1, type }
}

function map(): BattleMap {
  return {
    id: 'map',
    name: 'Map',
    width: 500,
    height: 500,
    gridSize: 50,
    gridOffsetX: 0,
    gridOffsetY: 0,
    showGrid: true,
    tokens: [token('hero', 'player'), token('enemy', 'enemy')],
  }
}

const unusedRoll = async () => 1

describe('地图战斗结果结算器', () => {
  it('没有待处理事件时不请求骰子并直接生成地图应用计划', async () => {
    const state = startDnd5eHeadlessCombat('combat', [combatant('hero', 20), combatant('enemy', 10)])
    const result: Extract<Dnd5eActionResult, { ok: true }> = { ok: true, state, events: [] }
    const rollD20 = vi.fn(unusedRoll)

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: map(),
      characters: [],
      characterIdByCombatantId: {},
      rollD20,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(rollD20).not.toHaveBeenCalled()
    expect(settled.result.state).toEqual(state)
    expect(settled.application.map.id).toBe('map')
  })

  it('依序结算专注豁免，失败时解除专注并保留结算事件', async () => {
    const state = startDnd5eHeadlessCombat('combat', [combatant('hero', 20, true), combatant('enemy', 10)])
    const result: Extract<Dnd5eActionResult, { ok: true }> = {
      ok: true,
      state,
      events: [{ type: 'concentration-check-required', targetId: 'hero', dc: 10 }],
    }
    const rollD20 = vi.fn(async () => 1)

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: map(),
      characters: [],
      characterIdByCombatantId: {},
      rollD20,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(rollD20).toHaveBeenCalledWith('专注·体质豁免 DC 10', 'hero')
    expect(settled.result.state.combatants.hero.concentrating).toBe(false)
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      actorId: 'hero',
      success: false,
    }))
  })
})
