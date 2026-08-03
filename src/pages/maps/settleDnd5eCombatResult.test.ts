import { describe, expect, it, vi } from 'vitest'
import {
  createDnd5eConditionEffect,
  createDnd5eCombatant,
  createDnd5eMechanicalEffect,
  dnd5eConditionsFromActiveEffects,
  registerDnd5eRulesPlugin,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type DeclarativeSubclassDefinitionV1,
} from '../../rulesets/dnd5e'
import type { BattleMap, Token } from '../../store/maps'
import { settleDnd5eConcentrationChecks } from './settleDnd5eCombatResult'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function combatant(
  id: string,
  initiative: number,
  concentrating = false,
  patch: Partial<Dnd5eCombatant> = {},
) {
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
    ...patch,
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

  it('uses Host d6 rolls when a failed Fly concentration save causes a fall', async () => {
    const hero = combatant('hero', 20, true, {
      elevationFeet: 30,
      groundElevationFeet: 0,
      airborne: true,
      movementSpeeds: { walk: 30 },
    })
    hero.classState.concentrationSpellId = 'fly'
    hero.classState.concentrationTargetIds = ['hero']
    hero.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'fly-effect',
      definitionId: 'srd-5.1:spell:fly',
      label: 'Fly',
      targetId: hero.id,
      source: { kind: 'spell', actorId: hero.id, rulesId: 'fly' },
      duration: { type: 'concentration', sourceActorId: hero.id, concentrationId: 'fly' },
      modifiers: { flySpeedFeet: 60 },
    })]
    const state = startDnd5eHeadlessCombat('combat', [hero, combatant('enemy', 10)])
    const result: Extract<Dnd5eActionResult, { ok: true }> = {
      ok: true,
      state,
      events: [{ type: 'concentration-check-required', targetId: 'hero', dc: 10 }],
    }
    const battleMap = map()
    battleMap.tokens = battleMap.tokens.map((entry) =>
      entry.id === hero.id ? { ...entry, elevationFeet: 30 } : entry)
    const rollDice = vi.fn(async () => [2, 3, 4])

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: battleMap,
      characters: [],
      characterIdByCombatantId: {},
      rollD20: async () => 1,
      rollD4: unusedRoll,
      rollDice,
    })

    expect(rollDice).toHaveBeenCalledWith(
      3,
      6,
      '失去飞行支撑·坠落伤害',
      'hero',
    )
    expect(settled.result.state.combatants.hero).toMatchObject({
      currentHp: 11,
      concentrating: false,
      elevationFeet: 0,
      groundElevationFeet: 0,
      airborne: false,
    })
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved',
      actorId: 'hero',
      damage: 9,
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

  it('has the Host roll and settle a self-centered core spell from a post-spell table', async () => {
    const pluginId = 'com.example.settle-post-spell-table'
    const subclassId = `${pluginId}:random-caster`
    const featureId = `${subclassId}.table-check`
    const choiceFeatureId = `${subclassId}.table-choice`
    const definition: DeclarativeSubclassDefinitionV1 = {
      schemaVersion: 1,
      id: 'random-caster',
      classId: 'sorcerer',
      name: 'Random Caster',
      summary: 'Synthetic settlement fixture.',
      abilities: [{
        schemaVersion: 1,
        id: 'table-check',
        name: 'Post-Spell Table Check',
        description: 'Synthetic settlement fixture.',
        level: 1,
        trigger: { kind: 'after-spell-cast' },
        targeting: { kind: 'self' },
        mechanic: {
          kind: 'post-spell-random-table',
          spellcastingClassId: 'sorcerer',
          minimumSpellLevel: 1,
          triggerDieSides: 20,
          triggerValues: [1],
          tableDieSides: 100,
          outcomes: [{
            id: 'synthetic-centered-spell',
            minimum: 42,
            maximum: 43,
            effect: {
              kind: 'self-centered-core-spell',
              spellId: 'fireball',
              slotLevel: 3,
            },
          }],
        },
        effects: [],
        automation: 'partial',
      }, {
        schemaVersion: 1,
        id: 'table-choice',
        name: 'Table Choice',
        description: 'Synthetic settlement choice fixture.',
        level: 4,
        trigger: { kind: 'after-spell-cast' },
        targeting: { kind: 'self' },
        mechanic: {
          kind: 'post-spell-random-table-choice',
          tableAbilityId: 'table-check',
          rollCount: 3,
        },
        effects: [],
        automation: 'full',
      }],
    }
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId,
        name: 'Settlement Post Spell Table Test',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Test',
        license: 'CC0-1.0',
      },
      setup(api) {
        api.registerDeclarativeSubclass(definition)
      },
    })
    try {
      const hero = combatant('hero', 20, false, {
        level: 5,
        classId: 'sorcerer',
        subclassId,
        classLevels: { sorcerer: 5 },
        subclassIds: { sorcerer: subclassId },
        pluginFeatureIds: [featureId],
        abilities: { ...abilities, cha: 18 },
        proficiencyBonus: 3,
      })
      hero.classState.postSpellRandomTableCheck = {
        featureId,
        spellId: 'magic-missile',
        spellLevel: 1,
        slotLevel: 1,
        castingClassId: 'sorcerer',
        forceTable: false,
      }
      const state = startDnd5eHeadlessCombat('post-spell-settlement', [
        hero,
        combatant('enemy', 10),
      ])
      state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
      const result: Extract<Dnd5eActionResult, { ok: true }> = {
        ok: true,
        state,
        events: [{
          type: 'post-spell-random-table-check-required',
          actorId: 'hero',
          featureId,
          spellId: 'magic-missile',
          spellLevel: 1,
          slotLevel: 1,
          forceTable: false,
          triggerDieSides: 20,
          triggerValues: [1],
          tableDieSides: 100,
        }],
      }
      const d20s = [1, 20, 1]
      const rollD20 = vi.fn(async () => d20s.shift() ?? 1)
      const rollDice = vi.fn(async (count: number, sides: number) =>
        sides === 100 ? [42] : Array(count).fill(1))

      const settled = await settleDnd5eConcentrationChecks({
        result,
        map: map(),
        characters: [],
        characterIdByCombatantId: {},
        rollD20,
        rollD4: unusedRoll,
        rollDice,
      })

      expect(settled.result.state.combatants.hero.currentHp).toBe(12)
      expect(settled.result.state.combatants.enemy.currentHp).toBe(16)
      expect(rollD20).toHaveBeenCalledTimes(3)
      expect(rollDice).toHaveBeenCalledWith(
        1,
        100,
        '施法后随机表·结果',
        'hero',
      )
      expect(rollDice).toHaveBeenCalledWith(
        8,
        6,
        '随机表核心法术·伤害',
        'hero',
      )
      expect(settled.result.events).toContainEqual(expect.objectContaining({
        type: 'post-spell-random-table-outcome-resolved',
        actorId: 'hero',
        tableRoll: 42,
        automation: 'full',
        spellId: 'fireball',
      }))

      const manualHero = combatant('hero', 20, false, {
        level: 5,
        classId: 'sorcerer',
        subclassId,
        classLevels: { sorcerer: 5 },
        subclassIds: { sorcerer: subclassId },
        pluginFeatureIds: [featureId],
        abilities: { ...abilities, cha: 18 },
        proficiencyBonus: 3,
      })
      manualHero.classState.postSpellRandomTableCheck = {
        featureId,
        spellId: 'magic-missile',
        spellLevel: 1,
        slotLevel: 1,
        castingClassId: 'sorcerer',
        forceTable: false,
      }
      const manualState = startDnd5eHeadlessCombat('manual-post-spell-settlement', [
        manualHero,
        combatant('enemy', 10),
      ])
      const manualResult: Extract<Dnd5eActionResult, { ok: true }> = {
        ok: true,
        state: manualState,
        events: [{
          type: 'post-spell-random-table-check-required',
          actorId: 'hero',
          featureId,
          spellId: 'magic-missile',
          spellLevel: 1,
          slotLevel: 1,
          forceTable: false,
          triggerDieSides: 20,
          triggerValues: [1],
          tableDieSides: 100,
        }],
      }
      const requestManualAdjudication = vi.fn(async () => ({
        decision: 'approved' as const,
        effects: [{
          targetTokenId: 'enemy',
          operation: 'damage' as const,
          amount: 3,
          addCondition: 'poisoned',
        }],
        note: 'final DM effect',
      }))
      const manuallySettled = await settleDnd5eConcentrationChecks({
        result: manualResult,
        map: map(),
        characters: [],
        characterIdByCombatantId: {},
        rollD20: async () => 1,
        rollD4: unusedRoll,
        rollDice: async (_count, sides) => sides === 100 ? [50] : [],
        requestPostSpellRandomTableAdjudication: requestManualAdjudication,
      })

      expect(requestManualAdjudication).toHaveBeenCalledWith(expect.objectContaining({
        actor: expect.objectContaining({ id: 'hero' }),
        featureId,
        sourceSpellId: 'magic-missile',
        tableRoll: 50,
        events: expect.arrayContaining([expect.objectContaining({
          type: 'post-spell-random-table-manual-adjudication-required',
        })]),
      }))
      expect(manuallySettled.result.state.combatants.hero.classState.postSpellRandomTableManualAdjudication)
        .toBeUndefined()
      expect(manuallySettled.result.state.combatants.enemy.currentHp).toBe(17)
      expect(manuallySettled.result.state.combatants.enemy.conditions).toContain('poisoned')
      expect(manuallySettled.result.events).toContainEqual(expect.objectContaining({
        type: 'post-spell-random-table-manual-adjudication-resolved',
        decision: 'approved',
        effectCount: 1,
      }))

      const choiceHero = combatant('hero', 20, false, {
        level: 5,
        classId: 'sorcerer',
        subclassId,
        classLevels: { sorcerer: 5 },
        subclassIds: { sorcerer: subclassId },
        pluginFeatureIds: [featureId, choiceFeatureId],
        abilities: { ...abilities, cha: 18 },
        proficiencyBonus: 3,
      })
      choiceHero.classState.postSpellRandomTableCheck = {
        featureId,
        spellId: 'magic-missile',
        spellLevel: 1,
        slotLevel: 1,
        castingClassId: 'sorcerer',
        forceTable: false,
        tableRollChoice: { featureId: choiceFeatureId, rollCount: 3 },
      }
      const choiceState = startDnd5eHeadlessCombat('post-spell-table-choice', [
        choiceHero,
        combatant('enemy', 10),
      ])
      choiceState.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
      const choiceResult: Extract<Dnd5eActionResult, { ok: true }> = {
        ok: true,
        state: choiceState,
        events: [{
          type: 'post-spell-random-table-check-required',
          actorId: 'hero',
          featureId,
          spellId: 'magic-missile',
          spellLevel: 1,
          slotLevel: 1,
          forceTable: false,
          triggerDieSides: 20,
          triggerValues: [1],
          tableDieSides: 100,
          tableRollCount: 3,
          tableRollChoiceFeatureId: choiceFeatureId,
        }],
      }
      const requestTableChoice = vi.fn(async () => 1)
      const choiceD20s = [1, 20, 20]
      const choiceSettled = await settleDnd5eConcentrationChecks({
        result: choiceResult,
        map: map(),
        characters: [],
        characterIdByCombatantId: {},
        rollD20: async () => choiceD20s.shift() ?? 20,
        rollD4: unusedRoll,
        rollDice: async (count, sides) => sides === 100
          ? [50, 42, 60]
          : Array(count).fill(1),
        requestPostSpellRandomTableChoice: requestTableChoice,
      })
      expect(requestTableChoice).toHaveBeenCalledWith(expect.objectContaining({
        actor: expect.objectContaining({ id: 'hero' }),
        tableFeatureId: featureId,
        choiceFeatureId,
        tableRolls: [50, 42, 60],
      }))
      expect(choiceSettled.result.events).toContainEqual(expect.objectContaining({
        type: 'post-spell-random-table-choice-resolved',
        rolls: [50, 42, 60],
        selectedIndex: 1,
        selectedRoll: 42,
      }))
      expect(choiceSettled.result.state.combatants.hero.currentHp).toBe(16)
      expect(choiceSettled.result.state.combatants.enemy.currentHp).toBe(16)
    } finally {
      dispose()
    }
  })
})
