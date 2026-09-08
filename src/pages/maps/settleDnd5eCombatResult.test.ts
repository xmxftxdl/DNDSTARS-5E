import { describe, expect, it, vi } from 'vitest'
import {
  createDnd5eConditionEffect,
  createDnd5eCombatant,
  createDnd5eMechanicalEffect,
  dnd5eConditionsFromActiveEffects,
  dnd5ePendingMonsterMechanicResolutions,
  registerDnd5eRulesPlugin,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eActionResult,
  type Dnd5eCombatant,
  type DeclarativeSubclassDefinitionV1,
} from '../../rulesets/dnd5e'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterMechanicDraft,
} from '../../rulesets/dnd5e/customMonsterWorkshop'
import { setDnd5eRoomMonsterCatalog } from '../../rulesets/dnd5e/monsters'
import type { BattleMap, Token } from '../../store/maps'
import { planMapsManualSettlement } from './manualSettlementTransaction'
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

  it('后续结算会保留首轮已经物化的 Token 状态补丁', async () => {
    const caster = combatant('hero', 20, true)
    caster.classState.concentrationSpellId = 'modify-memory'
    caster.classState.concentrationTargetIds = ['enemy']
    caster.classState.concentrationRoundsRemaining = 10
    const target = combatant('enemy', 10)
    const charmed = createDnd5eConditionEffect({
      condition: 'charmed',
      source: { kind: 'spell', actorId: caster.id, rulesId: 'modify-memory' },
      targetId: target.id,
      duration: {
        type: 'concentration', sourceActorId: caster.id,
        concentrationId: 'modify-memory', remainingRounds: 10,
      },
      breakOn: ['takes-damage', 'targeted-by-spell'],
    })
    target.classState.activeEffects = [charmed]
    target.classState.concentrationEffectsBySource = { [caster.id]: 'modify-memory' }
    target.conditions = dnd5eConditionsFromActiveEffects([charmed])
    const state = startDnd5eHeadlessCombat('combat', [caster, target])
    const materializedMap = map()
    materializedMap.tokens = materializedMap.tokens.map((entry) => entry.id === target.id
      ? {
          ...entry,
          dnd5eCombatState: {
            schemaVersion: 2,
            activeEffects: [charmed],
            conditions: ['charmed'],
            concentrationEffectsBySource: { [caster.id]: 'modify-memory' },
          },
        }
      : entry)
    const originalPatch = materializedMap.tokens.find((entry) => entry.id === target.id)!
      .dnd5eCombatState

    const settled = await settleDnd5eConcentrationChecks({
      result: { ok: true, state, events: [] },
      map: materializedMap,
      characters: [],
      characterIdByCombatantId: {},
      priorApplication: {
        changedTokenIds: [target.id],
        changedCharacterIds: [],
        tokenPatches: { [target.id]: { dnd5eCombatState: originalPatch } },
        characterPatches: {},
      },
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(settled.application.changedTokenIds).toContain(target.id)
    expect(settled.application.tokenPatches?.[target.id]?.dnd5eCombatState)
      .toEqual(originalPatch)
  })

  it('keeps animated-object overkill when the UI settlement runs concentration follow-ups', async () => {
    const animatedObject: Token = {
      ...token('animated-blade', 'enemy'),
      label: '活化物件 · 飞刀',
      poolId: 'srd-5.1:animated-object:tiny:fly-hover:slashing',
      hp: 20,
      maxHp: 20,
      dnd5eSummon: {
        schemaVersion: 1,
        pluginId: 'core-srd-spell',
        featureId: 'spell:animate-objects',
        sourceCharacterId: 'wizard',
        sourceTokenId: 'wizard-token',
        createdRound: 1,
        expiresAfterRound: 10,
        concentrationId: 'animate-objects',
        side: 'player',
        truePolymorphOriginalObject: {
          schemaVersion: 1,
          id: 'blade-object',
          label: '飞刀',
          x: 25,
          y: 25,
          color: '#aaaaaa',
          emoji: '🔪',
          size: 1,
          hp: 10,
          maxHp: 10,
        },
      },
    }
    const scene: BattleMap = { ...map(), tokens: [animatedObject] }
    const manualPlan = planMapsManualSettlement({
      map: scene,
      characters: [],
      targetId: animatedObject.id,
      operation: 'damage',
      amount: 25,
    })
    expect(manualPlan?.application).toBeDefined()
    expect(manualPlan?.headless).toBeDefined()

    const settled = await settleDnd5eConcentrationChecks({
      result: manualPlan!.headless!.result,
      map: scene,
      characters: [],
      priorApplication: manualPlan!.application,
      characterIdByCombatantId: manualPlan!.headless!.characterIdByCombatantId,
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(settled.application.map.tokens).toContainEqual(expect.objectContaining({
      id: 'blade-object',
      type: 'obstacle',
      hp: 5,
      maxHp: 10,
    }))
    expect(settled.application.map.tokens.some((entry) => entry.id === animatedObject.id)).toBe(false)
  })

  it('专注后处理保留 Activity 的地图交接数据', async () => {
    const state = startDnd5eHeadlessCombat('activity-handoff', [
      combatant('hero', 20), combatant('enemy', 10),
    ])
    const activityHandoffs: NonNullable<Extract<Dnd5eActionResult, { ok: true }>['activityHandoffs']> = {
      persistentAreas: [],
      summons: [],
      duplications: [],
      movements: [],
      areaRelocations: [],
      areaReshapes: [],
      areaSenseModes: [],
      areaDetonations: [],
      invocations: [],
      mapObjectLocks: [],
      mapObjectLights: [],
      mapObjectPurifications: [],
    }
    const result: Extract<Dnd5eActionResult, { ok: true }> = {
      ok: true, state, events: [], activityHandoffs,
    }

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: map(),
      characters: [],
      characterIdByCombatantId: {},
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice: async () => [],
    })

    expect(settled.result.activityHandoffs).toEqual(activityHandoffs)
  })

  it('runs registered Activity windows before building the production map application', async () => {
    const state = startDnd5eHeadlessCombat('activity-production', [
      combatant('hero', 20), combatant('enemy', 10),
    ])
    const result: Extract<Dnd5eActionResult, { ok: true }> = { ok: true, state, events: [] }
    const settleActivityTriggers = vi.fn(async (request: Parameters<
      NonNullable<Parameters<typeof settleDnd5eConcentrationChecks>[0]['settleActivityTriggers']>
    >[0]) => {
      const next = structuredClone(request.state)
      next.combatants.hero.currentHp = 19
      return { state: next, events: [] }
    })

    const settled = await settleDnd5eConcentrationChecks({
      result,
      map: map(),
      characters: [],
      characterIdByCombatantId: {},
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice: async () => [],
      settleActivityTriggers,
    })

    expect(settleActivityTriggers).toHaveBeenCalledOnce()
    expect(settled.result.state.combatants.hero.currentHp).toBe(19)
    expect(settled.application.map.tokens.find((entry) => entry.id === 'hero')?.hp).toBe(19)
  })

  it('builds the final application from the map returned by Activity placement handoffs', async () => {
    const state = startDnd5eHeadlessCombat('activity-map-production', [
      combatant('hero', 20), combatant('enemy', 10),
    ])
    const sourceMap = map()
    const summoned = { ...token('activity-summon', 'enemy'), x: 150, y: 150 }
    const settled = await settleDnd5eConcentrationChecks({
      result: { ok: true, state, events: [] },
      map: sourceMap,
      characters: [],
      characterIdByCombatantId: {},
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice: async () => [],
      settleActivityTriggers: async (request) => ({
        state: request.state,
        events: [],
        map: {
          ...request.map,
          tokens: [...request.map.tokens, summoned],
          dnd5ePluginAreas: [{
            id: 'activity-area', pluginId: 'local.test', featureId: 'zone',
            label: 'Zone', color: '#8b5cf6', sourceCharacterId: 'hero',
            sourceTokenId: 'hero', cells: [{ col: 2, row: 2 }], createdRound: 1,
            expiresAfterRound: 2,
          }],
        },
      }),
    })

    expect(settled.application.map.tokens.map((entry) => entry.id)).toContain('activity-summon')
    expect(settled.application.map.dnd5ePluginAreas?.[0]?.id).toBe('activity-area')
    expect(sourceMap.tokens).toHaveLength(2)
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

  it('使用 Host 骰自动结算低生命值造成伤害后的怪物机制', async () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '伊利法统领虚体'
    draft.actions[0].damageType = 'slashing'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'desperate-damage',
      name: '不退斗志',
      trigger: 'after-dealt-damage',
      triggerSubject: 'self',
      hpPercentageAtOrBelow: undefined,
      hpBelow: 10,
      effectKind: 'damage',
      effectTarget: 'trigger-target',
      healingDice: '1d6',
      damageType: 'inherit-trigger',
      limit: 'unlimited',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    try {
      const attacker = combatant('enemy', 20, false, {
        statBlockId: monster.id,
        currentHp: 9,
        maxHp: 20,
      })
      const target = combatant('hero', 10, false, { currentHp: 30, maxHp: 30 })
      const state = startDnd5eHeadlessCombat('pending-mechanic', [attacker, target])
      state.distanceFeetByCombatantPair = { ['enemy\u0000hero']: 5 }
      const attacked = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: attacker.id,
        actionId: monster.actions[0].id,
        rolls: [{ targetId: target.id, d20: 18, damageRolls: [[3]] }],
      })
      expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
      if (!attacked.ok) return
      expect(dnd5ePendingMonsterMechanicResolutions(attacked.state)).toHaveLength(1)
      const hpBeforeMechanic = attacked.state.combatants.hero.currentHp
      const rollDice = vi.fn(async () => [4])

      const settled = await settleDnd5eConcentrationChecks({
        result: attacked,
        map: map(),
        characters: [],
        characterIdByCombatantId: {},
        rollD20: unusedRoll,
        rollD4: unusedRoll,
        rollDice,
      })

      expect(rollDice).toHaveBeenCalledWith(1, 6, '不退斗志·额外伤害', 'enemy')
      expect(settled.result.state.combatants.hero.currentHp).toBe(hpBeforeMechanic - 4)
      expect(dnd5ePendingMonsterMechanicResolutions(settled.result.state)).toEqual([])
      expect(settled.result.events).toContainEqual(expect.objectContaining({
        type: 'monster-mechanic-v2-triggered',
        actorId: attacker.id,
        mechanicId: 'desperate-damage',
      }))
    } finally {
      setDnd5eRoomMonsterCatalog([])
    }
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

    expect(rollD20).toHaveBeenCalledWith(
      '专注·体质豁免 DC 10',
      'hero',
      expect.objectContaining({ rollKind: 'saving-throw' }),
    )
    expect(settled.result.state.combatants.hero.concentrating).toBe(false)
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      actorId: 'hero',
      success: false,
    }))
  })

  it('专注体质豁免会继承气化形体等主动效果授予的豁免优势', async () => {
    const hero = combatant('hero', 20, true)
    hero.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'gaseous-form-effect',
      definitionId: 'srd-5.1:spell:gaseous-form',
      label: '气化形体',
      targetId: hero.id,
      source: { kind: 'spell', actorId: hero.id, rulesId: 'gaseous-form' },
      duration: {
        type: 'concentration', sourceActorId: hero.id,
        concentrationId: 'gaseous-form', remainingRounds: 600,
      },
      modifiers: { savingThrowAdvantages: ['str', 'dex', 'con'] },
    })]
    hero.classState.concentrationSpellId = 'gaseous-form'
    hero.classState.concentrationTargetIds = [hero.id]
    hero.classState.concentrationRoundsRemaining = 600
    const state = startDnd5eHeadlessCombat('combat', [hero, combatant('enemy', 10)])
    const result: Extract<Dnd5eActionResult, { ok: true }> = {
      ok: true,
      state,
      events: [{ type: 'concentration-check-required', targetId: 'hero', dc: 10 }],
    }
    const rolls = [2, 18]
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
    expect(settled.result.state.combatants.hero.concentrating).toBe(true)
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      actorId: 'hero',
      d20: 18,
      success: true,
    }))
  })

  it('气化形体在高处因降至零生命结束时会结算失去悬浮后的坠落', async () => {
    const hero = combatant('hero', 20, true, {
      airborne: true,
      elevationFeet: 10,
      groundElevationFeet: 0,
    })
    hero.classState.activeEffects = [createDnd5eMechanicalEffect({
      id: 'gaseous-form-effect',
      definitionId: 'srd-5.1:spell:gaseous-form',
      label: '气化形体',
      targetId: hero.id,
      source: { kind: 'spell', actorId: hero.id, rulesId: 'gaseous-form' },
      duration: {
        type: 'concentration', sourceActorId: hero.id,
        concentrationId: 'gaseous-form', remainingRounds: 600,
      },
      modifiers: { flySpeedFeet: 10, hoverWhileFlying: true },
    })]
    hero.classState.concentrationSpellId = 'gaseous-form'
    hero.classState.concentrationTargetIds = [hero.id]
    hero.classState.concentrationRoundsRemaining = 600
    const before = startDnd5eHeadlessCombat('combat', [hero, combatant('enemy', 10)])
    const after = structuredClone(before)
    after.combatants.hero.currentHp = 0
    after.combatants.hero.concentrating = false
    after.combatants.hero.classState.activeEffects = []
    delete after.combatants.hero.classState.concentrationSpellId
    delete after.combatants.hero.classState.concentrationTargetIds
    delete after.combatants.hero.classState.concentrationRoundsRemaining
    const rollDice = vi.fn(async () => [4])

    const settled = await settleDnd5eConcentrationChecks({
      result: { ok: true, state: after, events: [] },
      priorState: before,
      map: map(),
      characters: [],
      characterIdByCombatantId: {},
      rollD20: unusedRoll,
      rollD4: unusedRoll,
      rollDice,
    })

    expect(rollDice).toHaveBeenCalledWith(1, 6, '失去飞行支撑·坠落伤害', 'hero')
    expect(settled.result.state.combatants.hero.elevationFeet).toBe(0)
    expect(settled.result.state.combatants.hero.airborne).toBe(false)
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'elevation-changed', actorId: 'hero', fromElevationFeet: 10, toElevationFeet: 0,
    }))
  })

  it('为持续区域施加的严重干扰自动掷两颗 d20 并以劣势结算专注', async () => {
    const hero = combatant('hero', 20, true)
    hero.classState.concentrationCheckDisadvantagePendingSourceId =
      'environment:persistent-area'
    const state = startDnd5eHeadlessCombat('combat', [hero, combatant('enemy', 10)])
    const result: Extract<Dnd5eActionResult, { ok: true }> = {
      ok: true,
      state,
      events: [{ type: 'concentration-check-required', targetId: 'hero', dc: 10 }],
    }
    const rolls = [18, 2]
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
    expect(settled.result.state.combatants.hero.concentrating).toBe(false)
    expect(settled.result.state.combatants.hero.classState
      .concentrationCheckDisadvantagePendingSourceId).toBeUndefined()
    expect(settled.result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved',
      actorId: 'hero',
      d20: 2,
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
