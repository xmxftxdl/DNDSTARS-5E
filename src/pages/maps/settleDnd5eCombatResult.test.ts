import { describe, expect, it, vi } from 'vitest'
import {
  createDnd5eConditionEffect,
  createDnd5eCombatant,
  dnd5eConditionsFromActiveEffects,
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

  it('保留前一事务阶段已经产生的地图与角色变更标识', async () => {
    const state = startDnd5eHeadlessCombat('combat', [combatant('hero', 20), combatant('enemy', 10)])
    const result: Extract<Dnd5eActionResult, { ok: true }> = { ok: true, state, events: [] }

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: map(),
      characters: [],
      priorApplication: {
        changedTokenIds: ['hero'],
        changedCharacterIds: ['character-hero'],
      },
      characterIdByCombatantId: {},
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(settled.application.changedTokenIds).toContain('hero')
    expect(settled.application.changedCharacterIds).toContain('character-hero')
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

  it('自动掷出受伤触发的优势豁免并解除狂笑术', async () => {
    const caster = combatant('hero', 20, true)
    caster.classState.concentrationSpellId = 'hideous-laughter'
    caster.classState.concentrationTargetIds = ['enemy']
    caster.classState.concentrationRoundsRemaining = 10
    const target = combatant('enemy', 10)
    const effect = createDnd5eConditionEffect({
      condition: 'incapacitated',
      source: { kind: 'spell', actorId: caster.id, rulesId: 'hideous-laughter' },
      targetId: target.id,
      duration: {
        type: 'concentration', sourceActorId: caster.id,
        concentrationId: 'hideous-laughter', remainingRounds: 10,
      },
      repeatSave: {
        ability: 'wis', dc: 10, timing: 'target-turn-end', onSuccess: 'remove',
        onDamage: { mode: 'advantage' },
      },
    })
    target.classState.activeEffects = [effect]
    target.classState.activeEffectDamageSavePendingIds = [effect.id]
    target.classState.concentrationEffectsBySource = { [caster.id]: 'hideous-laughter' }
    target.conditions = dnd5eConditionsFromActiveEffects([effect])
    const state = startDnd5eHeadlessCombat('combat', [caster, target])
    const result: Extract<Dnd5eActionResult, { ok: true }> = {
      ok: true,
      state,
      events: [{
        type: 'active-effect-save-required', targetId: target.id, effectId: effect.id,
        ability: 'wis', dc: 10, timing: 'takes-damage', mode: 'advantage',
      }],
    }
    const rolls = [5, 15]
    const rollD20 = vi.fn(async () => rolls.shift() ?? 1)

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: map(),
      characters: [],
      characterIdByCombatantId: {},
      rollD20,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(rollD20).toHaveBeenCalledTimes(2)
    expect(settled.result.state.combatants.enemy.conditions).not.toContain('incapacitated')
    expect(settled.result.state.combatants.hero.concentrating).toBe(false)
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', targetId: 'enemy', success: true,
    }))
  })
})
