import { describe, expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import type { Character } from '../../types/character'
import type { Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import {
  collectDnd5ePersistentAreaTriggers,
  collectDnd5eExpiringPersistentAreaDetonationTriggers,
  collectDnd5ePersistentAreaTriggersForSourceMove,
  advanceDnd5ePluginAreasAtTurnBoundary,
  dnd5ePersistentAreaAffectsTokenVerticallyAt,
  dnd5ePersistentAreaDifficultTerrainMultiplierAt,
  dnd5eFailedGreaseMovementCheckpoint,
  dnd5eFirstGreaseMovementCheckpoint,
  dnd5ePersistentAreaTriggerTimingIsSimultaneousWave,
  expireDnd5ePluginAreasAtTurnBoundary,
  expireDnd5ePluginAreasAtWorldMinute,
  normalizeDnd5ePersistentAreaTriggerForRuntime,
  recordDnd5ePersistentAreaTrigger,
  rebaseDnd5ePluginAreasAfterCombat,
  reconcileDnd5ePluginAreas,
  reconcileDnd5ePluginAreasAndConcentrationOnMap,
  reconcileDnd5ePluginAreasAfterSourceMove,
  reconcileDnd5ePluginAreasOnMap,
} from './pluginAreas'
import {
  collectDnd5ePersistentAreaSavingThrowWaveResults,
  createDnd5ePersistentAreaDamageRollCoordinator,
  dnd5ePersistentAreaDamageWaveKey,
  dnd5ePersistentAreaSavingThrowWaveCandidates,
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
} from './pluginAreaTransactions'
import { createDnd5eMechanicalEffect } from './activeEffects'

const area = (patch: Partial<Dnd5ePluginArea> = {}): Dnd5ePluginArea => ({
  id: 'area-1', pluginId: 'com.example.area', featureId: 'com.example.area:mist', label: '迷雾', color: '#8b5cf6',
  sourceCharacterId: 'caster', sourceTokenId: 'caster-token', cells: [{ col: 1, row: 1 }],
  createdRound: 1, expiresAfterRound: 3, ...patch,
})

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})

describe('D&D 5e plugin persistent areas', () => {
  it('结束战斗时把跨战斗持续区域重基到第 1 轮并保留真实剩余时长', () => {
    const map: BattleMap = {
      id: 'map-1', name: 'map', width: 100, height: 100, gridSize: 20, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
      dnd5ePluginAreas: [{
        ...area({
          sourceKind: 'core-spell', coreSpellId: 'zone-of-truth',
          createdRound: 3, expiresAfterRound: 103,
          triggers: [
            { id: 'turn', frequencyGroupId: 'zone', label: '每回合', timing: 'turn-start', oncePerTurn: true },
            { id: 'mark', frequencyGroupId: 'mark', label: '每目标', timing: 'on-enter', oncePerTarget: true },
          ],
          triggerReceipts: [
            { triggerId: 'zone', targetTokenId: 'ogre', round: 3, turnKey: '3:ogre', transactionId: 'turn-receipt' },
            { triggerId: 'mark', targetTokenId: 'ogre', round: 3, transactionId: 'target-receipt' },
          ],
          lifecycleLastTurnKey: '3:caster-token',
        }),
      }],
    }
    const rebased = rebaseDnd5ePluginAreasAfterCombat(map, 3)
    const rebasedArea = rebased.dnd5ePluginAreas?.[0]
    expect(rebasedArea).toMatchObject({ createdRound: 1, expiresAfterRound: 101 })
    expect(rebasedArea?.triggerReceipts).toEqual([
      expect.objectContaining({ transactionId: 'target-receipt' }),
    ])
    expect(rebasedArea?.lifecycleLastTurnKey).toBeUndefined()
  })

  it('结束战斗时按包含末轮的旧区域约定保留剩余轮数', () => {
    const map: BattleMap = {
      id: 'map-1', name: 'map', width: 100, height: 100, gridSize: 20, feetPerCell: 5,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
      dnd5ePluginAreas: [area({ createdRound: 1, expiresAfterRound: 3 })],
    }
    const rebased = rebaseDnd5ePluginAreasAfterCombat(map, 2)
    expect(rebased.dnd5ePluginAreas?.[0]).toMatchObject({ createdRound: 1, expiresAfterRound: 2 })
  })

  it('keeps already-started multi-target waves simultaneous after concentration ends', () => {
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('on-create')).toBe(true)
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('source-turn-start')).toBe(true)
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('on-detonate')).toBe(true)
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('on-area-move-impact')).toBe(true)
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('on-enter')).toBe(false)
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('turn-start')).toBe(false)
    expect(dnd5ePersistentAreaTriggerTimingIsSimultaneousWave('turn-end')).toBe(false)
  })

  it('reuses one damage roll for every target in a simultaneous area wave', async () => {
    let rollCount = 0
    const coordinate = createDnd5ePersistentAreaDamageRollCoordinator(async (count, sides) => {
      rollCount += 1
      return Array.from({ length: count }, () => Math.min(sides, rollCount + 1))
    })
    const creation = {
      areaId: 'wall-of-fire', triggerId: 'wall-of-fire-create', timing: 'on-create' as const,
      count: 5, sides: 8, label: '火墙术·火墙出现', targetName: 'first target',
    }
    const first = await coordinate(creation)
    const second = await coordinate({ ...creation, targetName: 'second target' })
    expect(first).toEqual([2, 2, 2, 2, 2])
    expect(second).toBe(first)
    expect(rollCount).toBe(1)
    expect(dnd5ePersistentAreaDamageWaveKey(creation)).toBe('wall-of-fire\u0000wall-of-fire-create')

    await coordinate({ ...creation, timing: 'on-enter', targetName: 'entrant one' })
    await coordinate({ ...creation, timing: 'on-enter', targetName: 'entrant two' })
    expect(rollCount).toBe(3)
    expect(dnd5ePersistentAreaDamageWaveKey({ ...creation, timing: 'on-enter' })).toBeUndefined()
  })

  it('does not request presentation dice for fixed persistent-area damage', async () => {
    let rollCount = 0
    const coordinate = createDnd5ePersistentAreaDamageRollCoordinator(async () => {
      rollCount += 1
      return [6]
    })

    await expect(coordinate({
      areaId: 'guardian-of-faith', triggerId: 'guardian-strike', timing: 'on-enter',
      count: 0, sides: 6, label: '信仰守卫·守卫打击', targetName: 'hostile creature',
    })).resolves.toEqual([])
    expect(rollCount).toBe(0)
  })

  it('completes every save before requesting shared damage for a simultaneous area wave', async () => {
    const trigger = {
      id: 'incendiary-cloud-create', label: '焚云术·生成', timing: 'on-create' as const,
      savingThrow: { ability: 'dex' as const, dc: 18, onSuccess: 'half' as const, magical: true },
      damage: { count: 10, sides: 8, type: 'fire' as const },
    }
    const cloud = area({ id: 'incendiary-cloud', cells: [{ col: 1, row: 1 }], triggers: [trigger] })
    const map: BattleMap = {
      id: 'incendiary-cloud-map', name: 'map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: ['first', 'second', 'third'].map((id) => ({
        id, label: id, x: 75, y: 75, color: '#fff', emoji: id[0]!, size: 1,
        type: 'enemy' as const, hp: 100, maxHp: 100,
      })),
      dnd5ePluginAreas: [cloud],
    }
    const candidates = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-create', round: 1, areaId: cloud.id, turnKey: '1:caster-token',
    })
    expect(candidates.map((candidate) => candidate.targetToken.id)).toEqual(['first', 'second', 'third'])

    expect(dnd5ePersistentAreaSavingThrowWaveCandidates(candidates, candidates[0]!))
      .toEqual(candidates)
    expect(dnd5ePersistentAreaSavingThrowWaveCandidates([
      { ...candidates[0]!, trigger: { ...trigger, timing: 'on-enter' } },
    ], { ...candidates[0]!, trigger: { ...trigger, timing: 'on-enter' } })).toEqual([])

    const order: string[] = []
    const saves = await collectDnd5ePersistentAreaSavingThrowWaveResults({
      candidates,
      resolve: async (candidate) => {
        order.push(`save:${candidate.targetToken.id}`)
        return candidate.targetToken.id
      },
    })
    const coordinateDamage = createDnd5ePersistentAreaDamageRollCoordinator(async () => {
      order.push('damage')
      return [8, 8, 8, 8, 8, 8, 8, 8, 8, 8]
    })
    for (const candidate of candidates) {
      expect(saves.get(candidate.transactionId)).toBe(candidate.targetToken.id)
      await coordinateDamage({
        areaId: candidate.area.id,
        triggerId: candidate.trigger.id,
        timing: candidate.trigger.timing,
        count: 10,
        sides: 8,
        label: candidate.trigger.label,
        targetName: candidate.targetToken.label,
      })
    }
    expect(order).toEqual(['save:first', 'save:second', 'save:third', 'damage'])
  })

  it('ejects creatures but never moves map objects when a legacy Passwall area expires', () => {
    const passwall = area({
      id: 'passwall', sourceKind: 'core-spell', coreSpellId: 'passwall',
      cells: [
        { col: 2, row: 1 }, { col: 2, row: 2 },
        { col: 2, row: 3 }, { col: 2, row: 4 },
      ],
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 8 },
      blocking: { suppressesMappedBarriers: true },
      expiresAfterRound: 1,
    })
    const tokens: Token[] = [{
      id: 'creature', label: 'creature', x: 125, y: 125, color: '#fff', emoji: 'C',
      size: 1, type: 'enemy',
    }, {
      id: 'object', label: 'object', x: 125, y: 175, color: '#fff', emoji: 'O',
      size: 1, type: 'obstacle',
    }]
    const map: BattleMap = {
      id: 'passwall-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens, dnd5ePluginAreas: [passwall],
    }

    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character()], 2)

    expect(reconciled.dnd5ePluginAreas).toEqual([])
    expect(reconciled.tokens.map((token) => ({ id: token.id, x: token.x, y: token.y }))).toEqual([
      { id: 'creature', x: 75, y: 75 },
      { id: 'object', x: 125, y: 175 },
    ])
  })

  it('does not queue or mutate a legacy Magic Mouth map projection', () => {
    const target: Token = {
      id: 'visitor', label: 'visitor', x: 25, y: 25, color: '#fff', emoji: 'V',
      size: 1, type: 'enemy',
    }
    const trigger: Dnd5ePersistentAreaTriggerSnapshot = {
      id: 'magic-mouth-proximity', label: '魔嘴术·触发讯息', timing: 'on-enter',
      oncePerRound: false, maximumTotalUses: 1,
      notification: { delivery: 'audible', audibleRadiusFeet: 30, message: '警告：前方有危险' },
    }
    const oneShot = area({
      permanent: true,
      magicMouth: {
        schemaVersion: 1, message: '警告：前方有危险', trigger: '任意生物进入 30 尺',
        triggerMode: 'proximity', repeat: false,
        objectKind: 'obstacle-token', objectId: 'statue', objectLabel: '魔嘴石像',
      },
      triggers: [trigger],
    })
    const map: BattleMap = {
      id: 'magic-mouth-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [target], dnd5ePluginAreas: [oneShot],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-enter', round: 1, turnKey: 'exploration:1',
      movement: { token: target, to: { x: 75, y: 75 } },
    })).toEqual([])
    expect(recordDnd5ePersistentAreaTrigger([oneShot], {
      area: oneShot,
      trigger,
      targetToken: target,
      transactionId: 'magic-mouth:first',
      turnKey: 'exploration:1',
    }, 1)).toEqual([oneShot])
    expect(reconcileDnd5ePluginAreas([oneShot], [], 1)).toEqual([])
  })

  it('never queues persistent-area triggers for defeated creature tokens', () => {
    const defeated: Token = {
      id: 'defeated-token', label: 'defeated', x: 75, y: 75, color: '#fff', emoji: 'D',
      size: 1, type: 'enemy', hp: 0, maxHp: 10,
    }
    const living: Token = {
      id: 'living-token', label: 'living', x: 75, y: 75, color: '#fff', emoji: 'L',
      size: 1, type: 'enemy', hp: 10, maxHp: 10,
    }
    const grease = area({
      cells: [{ col: 1, row: 1 }],
      triggers: [{
        id: 'grease-create', label: 'Grease', timing: 'on-create',
        savingThrow: { ability: 'dex', dc: 12, onSuccess: 'none' },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
      }],
    })
    const map: BattleMap = {
      id: 'defeated-area-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [defeated, living], dnd5ePluginAreas: [grease],
    }

    expect(collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-create', round: 1, areaId: grease.id, turnKey: '1:caster-token',
    }).map((candidate) => candidate.targetToken.id)).toEqual([living.id])
  })

  it('reserves maximum total uses while collecting one simultaneous wave', () => {
    const targets: Token[] = Array.from({ length: 8 }, (_, index) => ({
      id: `storm-target-${index + 1}`, label: `target ${index + 1}`,
      x: 75, y: 75, color: '#fff', emoji: 'T', size: 1, type: 'enemy',
      hp: 20, maxHp: 20,
    }))
    const storm = area({
      sourceKind: 'core-spell', coreSpellId: 'storm-of-vengeance',
      cells: [{ col: 1, row: 1 }], lifecycleAdvances: 2,
      triggers: [{
        id: 'storm-of-vengeance-round-3', label: '第三轮闪电', timing: 'source-turn-start',
        minimumLifecycleAdvances: 2, maximumLifecycleAdvances: 2,
        maximumTotalUses: 6,
        damage: { count: 10, sides: 6, modifier: 0, type: 'lightning' },
      }],
      triggerReceipts: [{
        triggerId: 'storm-of-vengeance-round-3', targetTokenId: 'already-hit',
        round: 3, transactionId: 'storm:already-hit',
      }],
    })
    const map: BattleMap = {
      id: 'storm-limit-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: targets, dnd5ePluginAreas: [storm],
    }

    expect(collectDnd5ePersistentAreaTriggers({
      map, timing: 'source-turn-start', round: 3, areaId: storm.id,
      turnKey: '3:caster-token',
    }).map((candidate) => candidate.targetToken.id)).toEqual(
      targets.slice(0, 5).map((target) => target.id),
    )
    const sourceChoiceStorm = {
      ...storm,
      triggers: storm.triggers?.map((trigger) => ({ ...trigger, sourceChoosesTargets: true })),
      triggerReceipts: undefined,
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map: { ...map, dnd5ePluginAreas: [sourceChoiceStorm] },
      timing: 'source-turn-start', round: 3, areaId: sourceChoiceStorm.id,
      turnKey: '3:caster-token',
    })).toHaveLength(8)
  })

  it('only upgrades legacy Flaming Sphere core snapshots at runtime', () => {
    const legacyTrigger: Dnd5ePersistentAreaTriggerSnapshot = {
      id: 'flaming-sphere-turn-end',
      label: 'Flaming Sphere turn end',
      timing: 'turn-end',
      oncePerRound: true,
      oncePerTurn: false,
      savingThrow: { ability: 'dex', dc: 16, onSuccess: 'half' },
      damage: { count: 2, sides: 6, modifier: 0, type: 'fire' },
      dmAdjustable: true,
    }
    expect(normalizeDnd5ePersistentAreaTriggerForRuntime(area({
      sourceKind: 'core-spell',
      coreSpellId: 'flaming-sphere',
    }), legacyTrigger)).toMatchObject({
      dmAdjustable: undefined,
      oncePerRound: false,
      oncePerTurn: true,
    })

    const customArea = area({
      sourceKind: 'plugin-feature',
      coreSpellId: 'flaming-sphere',
    })
    expect(normalizeDnd5ePersistentAreaTriggerForRuntime(customArea, legacyTrigger))
      .toBe(legacyTrigger)
  })

  it('never queues an area trigger for a Host-captured exempt creature', () => {
    const exempt = area({
      cells: [{ col: 1, row: 1 }],
      triggers: [{
        id: 'alarm-enter', label: 'Alarm', timing: 'on-enter', oncePerRound: false,
        excludedTokenIds: ['friendly-token'],
        notification: { delivery: 'mental-to-source' },
      }],
    })
    const token: Token = {
      id: 'friendly-token', label: 'friend', x: 25, y: 25, color: '#fff', emoji: 'F',
      size: 1, type: 'enemy',
    }
    const map = {
      id: 'alarm-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [token], dnd5ePluginAreas: [exempt],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-enter', round: 1,
      movement: { token, to: { x: 75, y: 75 }, path: [{ x: 75, y: 75 }] },
    })).toHaveLength(0)
  })

  it('charges legacy and explicit ground difficult terrain only while the token is on the surface', () => {
    const grease = area({
      sourceKind: 'core-spell',
      coreSpellId: 'grease',
      movementCostMultiplier: 2,
      relation: 'any',
      includeSelf: true,
    })
    const map = {
      id: 'vertical-ground-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [], dnd5ePluginAreas: [grease],
    }
    const token = {
      id: 'target-token', label: 'target', x: 75, y: 75, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map, token, position: { x: 75, y: 75 },
    })).toBe(2)
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map, token: { ...token, elevationFeet: 10 }, position: { x: 75, y: 75 },
    })).toBe(1)
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map: { ...map, dnd5ePluginAreas: [{ ...grease, vertical: { mode: 'ground' } }] },
      token: { ...token, elevationFeet: 10 }, position: { x: 75, y: 75 },
    })).toBe(1)
  })

  it('charges Arcane Hand interposition terrain only to the stronger selected target in the hand footprint', () => {
    const hand: Token = {
      id: 'arcane-hand-token', label: '奥术之手', x: 175, y: 175,
      color: '#60a5fa', emoji: '✋', size: 2, type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1, spellId: 'arcane-hand', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
      },
    }
    const strong: Token = {
      id: 'strong-target', label: 'strong', x: 175, y: 175,
      color: '#fff', emoji: 'S', size: 1, type: 'enemy',
    }
    const other: Token = { ...strong, id: 'other-target', label: 'other' }
    const interposed = area({
      coreSpellId: 'arcane-hand', sourceKind: 'core-spell', anchorMode: 'effect-token',
      anchorTokenId: hand.id, interposition: {
        targetTokenId: strong.id, mode: 'difficult-terrain',
      },
    })
    const map: BattleMap = {
      id: 'arcane-hand-interposition', name: 'map', width: 500, height: 500,
      gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [hand, strong, other], dnd5ePluginAreas: [interposed],
    }
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map, token: strong, position: strong,
    })).toBe(2)
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map, token: other, position: other,
    })).toBe(1)
    expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({
      map, token: strong, position: { x: 425, y: 425 },
    })).toBe(1)
  })

  it('uses strict token-height overlap for bounded volume areas', () => {
    const volume = area({
      vertical: { mode: 'volume', baseElevationFeet: 10, heightFeet: 20 },
    })
    const map = {
      id: 'vertical-volume-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [], dnd5ePluginAreas: [volume],
    }
    const token = {
      id: 'target-token', label: 'target', x: 75, y: 75, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area: volume, map, token, position: token, elevationFeet: 0,
    })).toBe(false)
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area: volume, map, token, position: token, elevationFeet: 8,
    })).toBe(true)
    expect(dnd5ePersistentAreaAffectsTokenVerticallyAt({
      area: volume, map, token, position: token, elevationFeet: 30,
    })).toBe(false)
  })

  it('does not trigger a ground area while flying across it and detects a same-cell descent into a volume', () => {
    const moving = {
      id: 'target-token', label: 'target', x: 25, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target', elevationFeet: 20,
    }
    const onEnter = {
      id: 'entry', label: 'entry', timing: 'on-enter' as const, oncePerRound: false,
      damage: { count: 1, sides: 6, modifier: 0, type: 'fire' as const },
    }
    const map = {
      id: 'vertical-trigger-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [moving],
      dnd5ePluginAreas: [area({
        cells: [{ col: 1, row: 0 }], vertical: { mode: 'ground' }, triggers: [onEnter],
      })],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map,
      timing: 'on-enter',
      round: 2,
      movement: {
        token: moving,
        to: { x: 125, y: 25 },
        path: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 125, y: 25 }],
        pathElevationsFeet: [20, 20, 20],
      },
    })).toHaveLength(0)

    const volumeMap = {
      ...map,
      dnd5ePluginAreas: [area({
        cells: [{ col: 0, row: 0 }],
        vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
        triggers: [onEnter],
      })],
    }
    const descended = collectDnd5ePersistentAreaTriggers({
      map: volumeMap,
      timing: 'on-enter',
      round: 2,
      movement: {
        token: moving,
        to: { x: 25, y: 25 },
        path: [{ x: 25, y: 25 }, { x: 25, y: 25 }],
        pathElevationsFeet: [20, 5],
      },
    })
    expect(descended).toHaveLength(1)
    expect(descended[0]).toMatchObject({ pathIndex: 1, enteredAt: { col: 0, row: 0 } })
  })

  it('projects a failed Grease entry to the entered cell rather than the route destination', () => {
    const moving: Token = {
      id: 'grease-target', label: 'target', x: 25, y: 25, color: '#fff', emoji: 'T',
      size: 1, type: 'player', characterId: 'target',
    }
    const grease = area({
      id: 'grease-area', sourceKind: 'core-spell', coreSpellId: 'grease',
      cells: [{ col: 1, row: 0 }],
      triggers: [{
        id: 'grease-enter', label: '进入油腻区域', timing: 'on-enter', oncePerRound: false,
        savingThrow: { ability: 'dex', dc: 14, onSuccess: 'none', magical: true },
        condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
      }],
    })
    const map = {
      id: 'grease-stop-map', name: 'map', width: 250, height: 100, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [moving], dnd5ePluginAreas: [grease],
    } as BattleMap
    const candidates = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-enter', round: 1,
      movement: {
        token: moving,
        to: { x: 175, y: 25 },
        path: [{ x: 25, y: 25 }, { x: 75, y: 25 }, { x: 125, y: 25 }, { x: 175, y: 25 }],
      },
    })

    expect(dnd5eFirstGreaseMovementCheckpoint({ map, token: moving, candidates }))
      .toMatchObject({ position: { x: 75, y: 25 }, pathIndex: 1 })
    expect(dnd5eFailedGreaseMovementCheckpoint({
      map,
      token: moving,
      candidates,
      events: [{
        type: 'persistent-area-triggered', areaId: 'grease-area', triggerId: 'grease-enter',
        targetId: moving.id, saveSuccess: false,
      }],
    })).toMatchObject({ position: { x: 75, y: 25 }, pathIndex: 1 })
    expect(dnd5eFailedGreaseMovementCheckpoint({
      map,
      token: moving,
      candidates,
      events: [{
        type: 'persistent-area-triggered', areaId: 'grease-area', triggerId: 'grease-enter',
        targetId: moving.id, saveSuccess: true,
      }],
    })).toBeUndefined()
  })

  it('expires finite areas after their declared round', () => {
    expect(reconcileDnd5ePluginAreas([area()], [character()], 3)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([area()], [character()], 4)).toHaveLength(0)
  })

  it('keeps a source-bound area through the next round and expires it at the source turn end', () => {
    const iceStorm = area({
      sourceKind: 'core-spell',
      coreSpellId: 'ice-storm',
      createdRound: 1,
      expiresAfterRound: 2,
      expiresAtSourceTurnEndAfterRound: 2,
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
      dnd5ePluginAreas: [iceStorm],
    }
    expect(expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-start', round: 2, tokenId: 'caster-token',
    })).toBe(map)
    expect(expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 2, tokenId: 'other-token',
    })).toBe(map)
    expect(expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 1, tokenId: 'caster-token',
    })).toBe(map)
    expect(expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 2, tokenId: 'caster-token',
    }).dnd5ePluginAreas).toEqual([])
  })

  it('expires legacy timed core areas at the saved source-turn round boundary', () => {
    const legacyWindWall = area({
      sourceKind: 'core-spell', coreSpellId: 'wind-wall', concentrationId: 'wind-wall',
      createdRound: 1, expiresAfterRound: 11,
      expiresAtSourceTurnEndAfterRound: undefined,
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [],
      dnd5ePluginAreas: [legacyWindWall],
    }
    expect(expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 10, tokenId: 'caster-token',
    })).toBe(map)
    expect(expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 11, tokenId: 'caster-token',
    }).dnd5ePluginAreas).toEqual([])

    const caster = character({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'wind-wall', concentrationSpellLevel: 3,
        concentrationRoundsRemaining: 10,
      },
    })
    const expiredMap = expireDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 11, tokenId: 'caster-token',
    })
    const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(
      map, [caster], 11, expiredMap,
    )
    expect(reconciled.map.dnd5ePluginAreas).toEqual([])
    expect(reconciled.characters[0]).toMatchObject({
      concentrating: false,
      dnd5eCombatState: {
        concentrationSpellId: undefined,
        concentrationSpellLevel: undefined,
        concentrationRoundsRemaining: undefined,
      },
    })
  })

  it('expires a finite area and its effect Token at the exact campaign-minute boundary', () => {
    const effectToken: Token = {
      id: 'timed-effect', label: 'timed effect', x: 25, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1, spellId: 'alarm', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 4_801,
      },
    }
    const timedArea = area({
      id: 'timed-area', sourceKind: 'core-spell', coreSpellId: 'alarm',
      anchorMode: 'effect-token', anchorTokenId: effectToken.id,
      createdWorldMinute: 100, expiresAtWorldMinute: 580,
      createdRound: 1, expiresAfterRound: 4_801,
    })
    const permanentArea = area({ id: 'permanent-area', permanent: true })
    const mirrorDecoy: Token = {
      id: 'mirror-decoy', label: '镜影分身 1', x: 75, y: 25, color: '#60a5fa', emoji: 'M', size: 1,
      type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1, spellId: 'mirror-image', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', sourceEffectId: 'mirror-effect',
        projectionKind: 'attack-decoy', projectionIndex: 1,
        createdRound: 1, expiresAfterRound: 11,
      },
    }
    const map: BattleMap = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
      tokens: [effectToken, mirrorDecoy], dnd5ePluginAreas: [timedArea, permanentArea],
    }
    expect(expireDnd5ePluginAreasAtWorldMinute(map, 579)).toBe(map)
    const expired = expireDnd5ePluginAreasAtWorldMinute(map, 580)
    expect(expired.dnd5ePluginAreas?.map((candidate) => candidate.id)).toEqual(['permanent-area'])
    expect(expired.tokens).toEqual([mirrorDecoy])
  })

  it('advances a moving area once per source turn and scales its height and damage dice', () => {
    const movingWave = area({
      cells: [{ col: 4, row: 3 }, { col: 4, row: 4 }],
      anchorCell: { col: 4, row: 3 },
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 300 },
      lifecycle: {
        timing: 'source-turn-start',
        translateAwayFromSourceFeet: 50,
        heightReductionFeet: 50,
        damageDiceCountDelta: -1,
        damageTriggerIds: ['wave-impact'],
        minimumDamageDiceCount: 1,
      },
      triggers: [{
        id: 'wave-impact', label: '浪潮冲击', timing: 'on-area-move-impact', oncePerTurn: true,
        savingThrow: { ability: 'str', dc: 16, onSuccess: 'half', magical: true },
        damage: { count: 6, sides: 10, modifier: 0, type: 'bludgeoning' },
      }],
    })
    const map = {
      id: 'moving-area-map', name: 'map', width: 1_000, height: 1_000, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'caster-token', label: 'caster', x: 75, y: 175, color: '#fff', emoji: 'C', size: 1,
        type: 'player' as const, characterId: 'caster',
      }],
      dnd5ePluginAreas: [movingWave],
    }
    const first = advanceDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-start', round: 2, tokenId: 'caster-token', turnKey: '2:caster-token',
    })
    expect(first.movedAreaIds).toEqual(['area-1'])
    expect(first.map.dnd5ePluginAreas?.[0]).toMatchObject({
      cells: [{ col: 14, row: 3 }, { col: 14, row: 4 }],
      anchorCell: { col: 14, row: 3 },
      vertical: { mode: 'volume', heightFeet: 250 },
      lifecycleAdvances: 1,
      lifecycleLastTurnKey: '2:caster-token',
      triggers: [{ damage: { count: 5, sides: 10 } }],
    })
    expect(advanceDnd5ePluginAreasAtTurnBoundary({
      map: first.map, timing: 'turn-start', round: 2, tokenId: 'caster-token', turnKey: '2:caster-token',
    })).toEqual({ map: first.map, movedAreaIds: [] })
  })

  it('advances Delayed Blast Fireball on its casting turn and caps the accumulated bonus at 10d6', () => {
    const delayed = area({
      sourceKind: 'core-spell', coreSpellId: 'delayed-blast-fireball',
      expiresAfterRound: 11,
      lifecycle: {
        timing: 'source-turn-end', advanceOnCreationRound: true, maximumAdvances: 10,
        damageDiceCountDelta: 1,
        damageTriggerIds: ['delayed-blast-fireball-detonation'],
        minimumDamageDiceCount: 12,
      },
      triggers: [{
        id: 'delayed-blast-fireball-detonation', label: '爆炸', timing: 'on-detonate',
        damage: { count: 12, sides: 6, type: 'fire' },
      }],
    })
    let map: BattleMap = {
      id: 'delayed-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C',
        size: 1, type: 'player', characterId: 'caster',
      }],
      dnd5ePluginAreas: [delayed],
    }

    for (let round = 1; round <= 10; round += 1) {
      map = advanceDnd5ePluginAreasAtTurnBoundary({
        map, timing: 'turn-end', round, tokenId: 'caster-token', turnKey: `${round}:caster-token`,
      }).map
      expect(map.dnd5ePluginAreas?.[0].triggers?.[0].damage?.count).toBe(12 + round)
    }
    const capped = advanceDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-end', round: 11, tokenId: 'caster-token', turnKey: '11:caster-token',
    })
    expect(capped.map).toBe(map)
    expect(capped.map.dnd5ePluginAreas?.[0]).toMatchObject({
      lifecycleAdvances: 10,
      triggers: [{ damage: { count: 22, sides: 6, type: 'fire' } }],
    })
  })

  it('collects an expiring Delayed Blast Fireball detonation before removing its area', () => {
    const target: Token = {
      id: 'target-token', label: 'target', x: 75, y: 75, color: '#fff', emoji: 'T',
      size: 1, type: 'enemy', hp: 100, maxHp: 100,
    }
    const delayed = area({
      sourceKind: 'core-spell', coreSpellId: 'delayed-blast-fireball',
      cells: [{ col: 1, row: 1 }], expiresAfterRound: 11,
      triggers: [{
        id: 'delayed-blast-fireball-detonation', label: '爆炸', timing: 'on-detonate',
        savingThrow: { ability: 'dex', dc: 18, onSuccess: 'half', magical: true },
        damage: { count: 22, sides: 6, type: 'fire' },
      }],
    })
    const map: BattleMap = {
      id: 'delayed-expiry-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [target], dnd5ePluginAreas: [delayed],
    }

    expect(collectDnd5eExpiringPersistentAreaDetonationTriggers({
      map, timing: 'turn-end', round: 10, tokenId: 'caster-token', turnKey: '10:caster-token',
    })).toEqual([])
    expect(collectDnd5eExpiringPersistentAreaDetonationTriggers({
      map, timing: 'turn-end', round: 11, tokenId: 'caster-token', turnKey: '11:caster-token',
    })).toEqual([
      expect.objectContaining({
        area: expect.objectContaining({ id: delayed.id }),
        targetToken: expect.objectContaining({ id: target.id }),
        trigger: expect.objectContaining({
          id: 'delayed-blast-fireball-detonation', damage: { count: 22, sides: 6, type: 'fire' },
        }),
      }),
    ])
  })

  it('resolves Delayed Blast Fireball detonation after another spell replaces concentration', () => {
    const casterToken: Token = {
      id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C',
      size: 1, type: 'player', characterId: 'caster',
    }
    const targetToken: Token = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T',
      size: 1, type: 'player', characterId: 'target',
    }
    const delayed = area({
      sourceKind: 'core-spell', coreSpellId: 'delayed-blast-fireball',
      concentrationId: 'delayed-blast-fireball', cells: [{ col: 1, row: 0 }],
      triggers: [{
        id: 'delayed-blast-fireball-detonation', label: '爆炸', timing: 'on-detonate',
        savingThrow: { ability: 'dex', dc: 18, onSuccess: 'half', magical: true },
        damage: { count: 12, sides: 6, type: 'fire' },
      }],
    })
    const map: BattleMap = {
      id: 'replacement-detonation-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [casterToken, targetToken], dnd5ePluginAreas: [delayed],
    }
    const caster = character({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'haste', concentrationSpellLevel: 3,
        concentrationRoundsRemaining: 10,
      },
    })
    const target = character({ id: 'target', name: 'target', maxHp: 100, currentHp: 100 })
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-detonate', round: 1, areaId: delayed.id,
    })[0]!
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat', round: 1, map, characters: [caster, target],
      initiativeOrder: [
        { tokenId: casterToken.id, roll: 15, label: casterToken.label, emoji: casterToken.emoji, color: casterToken.color, slotId: 'caster-slot' },
        { tokenId: targetToken.id, roll: 10, label: targetToken.label, emoji: targetToken.emoji, color: targetToken.color, slotId: 'target-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 1,
      damageRolls: Array.from({ length: 12 }, () => 1),
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', damage: 12, saveSuccess: false,
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === target.id)?.currentHp).toBe(88)
  })

  it('activates staged area modifiers and bounded source-turn triggers at the declared lifecycle advance', () => {
    const storm = area({
      expiresAfterRound: 20,
      cells: [{ col: 1, row: 1 }],
      lifecycle: {
        timing: 'source-turn-start',
        stages: [{
          atAdvance: 4,
          movementCostMultiplier: 2,
          obscuration: { kind: 'heavy' },
          occupantModifiers: {
            preventsRangedWeaponAttacks: true,
            concentrationSavingThrowDisadvantage: true,
          },
        }],
      },
      triggers: [{
        id: 'round-five-to-ten', label: 'Storm cold', timing: 'source-turn-start',
        minimumLifecycleAdvances: 4, maximumLifecycleAdvances: 9,
        oncePerTurn: true,
        damage: { count: 1, sides: 6, modifier: 0, type: 'cold' },
      }],
    })
    const target: Token = {
      id: 'target-token', label: 'target', x: 75, y: 75, color: '#fff', emoji: 'T',
      size: 1, type: 'enemy',
    }
    let map: BattleMap = {
      id: 'staged-area-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [target, {
        id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C',
        size: 1, type: 'player', characterId: 'caster',
      }], dnd5ePluginAreas: [storm],
    }

    for (let advance = 1; advance <= 3; advance += 1) {
      map = advanceDnd5ePluginAreasAtTurnBoundary({
        map, timing: 'turn-start', round: advance + 1,
        tokenId: 'caster-token', turnKey: `${advance + 1}:caster-token`,
      }).map
      expect(collectDnd5ePersistentAreaTriggers({
        map, timing: 'source-turn-start', round: advance + 1,
        targetTokenId: target.id, turnKey: `${advance + 1}:caster-token`,
      })).toHaveLength(0)
    }

    map = advanceDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-start', round: 5,
      tokenId: 'caster-token', turnKey: '5:caster-token',
    }).map
    expect(map.dnd5ePluginAreas?.[0]).toMatchObject({
      lifecycleAdvances: 4,
      movementCostMultiplier: 2,
      obscuration: { kind: 'heavy' },
      occupantModifiers: {
        preventsRangedWeaponAttacks: true,
        concentrationSavingThrowDisadvantage: true,
      },
    })
    expect(collectDnd5ePersistentAreaTriggers({
      map, timing: 'source-turn-start', round: 5,
      targetTokenId: target.id, turnKey: '5:caster-token',
    })).toHaveLength(1)

    const beyondWindow = {
      ...map,
      dnd5ePluginAreas: map.dnd5ePluginAreas?.map((entry) => ({ ...entry, lifecycleAdvances: 10 })),
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map: beyondWindow, timing: 'source-turn-start', round: 11,
      targetTokenId: target.id, turnKey: '11:caster-token',
    })).toHaveLength(0)
  })

  it('disperses only overlapping fog, mist, and similar core spell areas when the strong-wind stage begins', () => {
    const storm = area({
      id: 'storm', sourceKind: 'core-spell', coreSpellId: 'storm-of-vengeance',
      cells: [{ col: 1, row: 1 }, { col: 2, row: 2 }],
      lifecycleAdvances: 3,
      lifecycle: {
        timing: 'source-turn-start',
        stages: [{ atAdvance: 4, dispersesFogAndMist: true }],
      },
    })
    const fog = area({
      id: 'fog', sourceKind: 'core-spell', coreSpellId: 'fog-cloud',
      cells: [{ col: 1, row: 1 }],
    })
    const cloudkill = area({
      id: 'cloudkill', sourceKind: 'core-spell', coreSpellId: 'cloudkill',
      cells: [{ col: 2, row: 2 }], anchorMode: 'effect-token', anchorTokenId: 'cloudkill-effect',
    })
    const distantStinkingCloud = area({
      id: 'distant-stinking', sourceKind: 'core-spell', coreSpellId: 'stinking-cloud',
      cells: [{ col: 9, row: 9 }],
    })
    const web = area({
      id: 'web', sourceKind: 'core-spell', coreSpellId: 'web', cells: [{ col: 1, row: 1 }],
    })
    const map: BattleMap = {
      id: 'storm-wind-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C',
        size: 1, type: 'player', characterId: 'caster',
      }, {
        id: 'cloudkill-effect', label: 'Cloudkill', x: 125, y: 125, color: '#fff', emoji: 'F',
        size: 1, type: 'obstacle',
        dnd5eSpellEffect: {
          schemaVersion: 1, spellId: 'cloudkill', sourceCharacterId: 'caster',
          sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
        },
      }, {
        id: 'mirror-decoy', label: '镜影分身 1', x: 75, y: 25, color: '#60a5fa', emoji: 'M',
        size: 1, type: 'obstacle',
        dnd5eSpellEffect: {
          schemaVersion: 1, spellId: 'mirror-image', sourceCharacterId: 'caster',
          sourceTokenId: 'caster-token', sourceEffectId: 'mirror-effect',
          projectionKind: 'attack-decoy', projectionIndex: 1,
          createdRound: 1, expiresAfterRound: 11,
        },
      }],
      dnd5ePluginAreas: [storm, fog, cloudkill, distantStinkingCloud, web],
    }

    const advanced = advanceDnd5ePluginAreasAtTurnBoundary({
      map, timing: 'turn-start', round: 5, tokenId: 'caster-token', turnKey: '5:caster-token',
    }).map

    expect(advanced.dnd5ePluginAreas?.map((entry) => entry.id)).toEqual([
      'storm', 'distant-stinking', 'web',
    ])
    expect(advanced.tokens.map((token) => token.id)).toEqual(['caster-token', 'mirror-decoy'])

    const newlyCastFog = { ...fog, id: 'new-fog', expiresAfterRound: 20 }
    const reconciled = reconcileDnd5ePluginAreasOnMap({
      ...advanced,
      dnd5ePluginAreas: [
        ...(advanced.dnd5ePluginAreas ?? []).map((entry) => ({ ...entry, expiresAfterRound: 20 })),
        newlyCastFog,
      ],
    }, [character()], 5)
    expect(reconciled.dnd5ePluginAreas?.map((entry) => entry.id)).toEqual([
      'storm', 'distant-stinking', 'web',
    ])
    expect(reconciled.tokens.map((token) => token.id)).toContain('mirror-decoy')

    const legacyStorm = {
      ...storm,
      lifecycleAdvances: 4,
      lifecycle: {
        timing: 'source-turn-start' as const,
        stages: [{ atAdvance: 4, movementCostMultiplier: 2 }],
      },
      expiresAfterRound: 20,
    }
    expect(reconcileDnd5ePluginAreasOnMap({
      ...map,
      dnd5ePluginAreas: [legacyStorm, newlyCastFog],
    }, [character()], 5).dnd5ePluginAreas?.map((entry) => entry.id)).toEqual(['storm'])

    const windWall = area({
      id: 'wind-wall', sourceKind: 'core-spell', coreSpellId: 'wind-wall',
      cells: [{ col: 1, row: 1 }], expiresAfterRound: 20,
    })
    expect(reconcileDnd5ePluginAreasOnMap({
      ...map,
      dnd5ePluginAreas: [
        windWall,
        newlyCastFog,
        { ...distantStinkingCloud, expiresAfterRound: 20 },
        { ...web, expiresAfterRound: 20 },
      ],
    }, [character()], 5).dnd5ePluginAreas?.map((entry) => entry.id)).toEqual([
      'wind-wall', 'distant-stinking', 'web',
    ])
  })

  it('immediately disperses overlapping fog and gas inside Gust of Wind', () => {
    const gust = area({
      id: 'gust', sourceKind: 'core-spell', coreSpellId: 'gust-of-wind',
      cells: [{ col: 1, row: 1 }, { col: 2, row: 1 }],
    })
    const fog = area({
      id: 'fog', sourceKind: 'core-spell', coreSpellId: 'fog-cloud',
      cells: [{ col: 1, row: 1 }],
    })
    const cloudkill = area({
      id: 'cloudkill', sourceKind: 'core-spell', coreSpellId: 'cloudkill',
      cells: [{ col: 2, row: 1 }], anchorMode: 'effect-token', anchorTokenId: 'cloudkill-effect',
    })
    const distantStinkingCloud = area({
      id: 'distant-stinking', sourceKind: 'core-spell', coreSpellId: 'stinking-cloud',
      cells: [{ col: 8, row: 8 }],
    })
    const map: BattleMap = {
      id: 'gust-wind-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C',
        size: 1, type: 'player', characterId: 'caster',
      }, {
        id: 'cloudkill-effect', label: 'Cloudkill', x: 125, y: 75, color: '#fff', emoji: 'F',
        size: 1, type: 'obstacle',
        dnd5eSpellEffect: {
          schemaVersion: 1, spellId: 'cloudkill', sourceCharacterId: 'caster',
          sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
        },
      }],
      dnd5ePluginAreas: [gust, fog, cloudkill, distantStinkingCloud],
    }

    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character()], 1)

    expect(reconciled.dnd5ePluginAreas?.map((entry) => entry.id)).toEqual([
      'gust', 'distant-stinking',
    ])
    expect(reconciled.tokens.map((token) => token.id)).toEqual(['caster-token'])
  })

  it('extinguishes exposed torch and candle light inside Gust of Wind', () => {
    const gust = area({
      id: 'gust', sourceKind: 'core-spell', coreSpellId: 'gust-of-wind',
      cells: [{ col: 1, row: 1 }],
    })
    const timedLight = (sourceKind: 'torch' | 'candle' | 'hooded-lantern') => ({
      enabled: true,
      sourceKind,
      brightRadiusFeet: 20,
      dimRadiusFeet: 20,
      color: '#f97316',
      startedAtWorldMinute: 10,
      durationMinutes: 60,
      expiresAtWorldMinute: 70,
    })
    const map: BattleMap = {
      id: 'gust-flame-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{
        id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'W',
        size: 1, type: 'player', characterId: 'caster',
      }, {
        id: 'torch', label: 'torch', x: 50, y: 50, color: '#fff', emoji: 'T',
        size: 1, type: 'enemy', lightSource: timedLight('torch'),
      }, {
        id: 'candle', label: 'candle', x: 50, y: 50, color: '#fff', emoji: 'C',
        size: 1, type: 'enemy', lightSource: timedLight('candle'),
      }, {
        id: 'lantern', label: 'lantern', x: 50, y: 50, color: '#fff', emoji: 'L',
        size: 1, type: 'enemy', lightSource: timedLight('hooded-lantern'),
      }, {
        id: 'outside', label: 'outside', x: 250, y: 250, color: '#fff', emoji: 'O',
        size: 1, type: 'enemy', lightSource: timedLight('torch'),
      }],
      dnd5ePluginAreas: [gust],
    }

    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character()], 1)

    expect(reconciled.tokens.find((token) => token.id === 'torch')?.lightSource).toBeUndefined()
    expect(reconciled.tokens.find((token) => token.id === 'candle')?.lightSource).toBeUndefined()
    expect(reconciled.tokens.find((token) => token.id === 'lantern')?.lightSource?.sourceKind)
      .toBe('hooded-lantern')
    expect(reconciled.tokens.find((token) => token.id === 'outside')?.lightSource?.sourceKind)
      .toBe('torch')
  })

  it('ends Fog Cloud concentration and linked effects when Wind Wall disperses its area', () => {
    const fogEffect = createDnd5eMechanicalEffect({
      definitionId: 'spell:fog-cloud:test-link', label: '云雾术测试连结', targetId: 'target',
      source: { kind: 'spell', actorId: 'fog-token', rulesId: 'fog-cloud' },
      duration: {
        type: 'concentration', sourceActorId: 'fog-token', concentrationId: 'fog-cloud',
        remainingRounds: 600,
      },
    })
    const fogCaster = character({
      id: 'fog-caster', name: 'fog caster', concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'fog-cloud', concentrationSpellLevel: 1,
        concentrationTargetIds: ['target'], concentrationRoundsRemaining: 600,
      },
    })
    const windCaster = character({
      id: 'wind-caster', name: 'wind caster', concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'wind-wall', concentrationSpellLevel: 3,
        concentrationRoundsRemaining: 10,
      },
    })
    const target = character({
      id: 'target', name: 'target', conditions: [],
      dnd5eCombatState: {
        activeEffects: [fogEffect], concentrationEffectsBySource: { 'fog-token': 'fog-cloud' },
      },
    })
    const wind = area({
      id: 'wind', sourceKind: 'core-spell', coreSpellId: 'wind-wall',
      sourceCharacterId: windCaster.id, sourceTokenId: 'wind-token',
      concentrationId: 'wind-wall', cells: [{ col: 2, row: 2 }], expiresAfterRound: 20,
    })
    const fog = area({
      id: 'fog', sourceKind: 'core-spell', coreSpellId: 'fog-cloud',
      sourceCharacterId: fogCaster.id, sourceTokenId: 'fog-token',
      concentrationId: 'fog-cloud', cells: [{ col: 2, row: 2 }], expiresAfterRound: 20,
    })
    const map: BattleMap = {
      id: 'wind-dispersal-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [
        { id: 'fog-token', label: 'fog caster', x: 25, y: 25, color: '#fff', emoji: 'F', size: 1, type: 'player', characterId: fogCaster.id },
        { id: 'wind-token', label: 'wind caster', x: 75, y: 25, color: '#fff', emoji: 'W', size: 1, type: 'player', characterId: windCaster.id },
        { id: 'target-token', label: 'target', x: 125, y: 25, color: '#fff', emoji: 'T', size: 1, type: 'player', characterId: target.id },
      ],
      dnd5ePluginAreas: [wind, fog],
    }

    const result = reconcileDnd5ePluginAreasAndConcentrationOnMap(
      map, [fogCaster, windCaster, target], 5,
    )

    expect(result.map.dnd5ePluginAreas?.map((entry) => entry.id)).toEqual(['wind'])
    expect(result.endedConcentrationCharacterIds).toEqual(['fog-caster'])
    expect(result.characters.find((entry) => entry.id === 'fog-caster')).toMatchObject({
      concentrating: false,
      dnd5eCombatState: {
        concentrationSpellId: undefined,
        concentrationSpellLevel: undefined,
        concentrationTargetIds: undefined,
        concentrationRoundsRemaining: undefined,
      },
    })
    expect(result.characters.find((entry) => entry.id === 'wind-caster')?.concentrating).toBe(true)
    expect(result.characters.find((entry) => entry.id === 'target')?.dnd5eCombatState).toMatchObject({
      activeEffects: undefined,
      concentrationEffectsBySource: undefined,
    })
  })

  it('never targets or mutates durable objects even when legacy area data declares them', () => {
    const trigger: Dnd5ePersistentAreaTriggerSnapshot = {
      id: 'acid-rain', label: '酸雨', timing: 'source-turn-start',
      targetKinds: ['creature', 'object'],
      damage: { count: 1, sides: 6, modifier: 0, type: 'acid' },
    }
    const storm = area({ triggers: [trigger] })
    const object: Token = {
      id: 'object', label: '石像', x: 75, y: 75, color: '#fff', emoji: 'O',
      size: 1, type: 'obstacle', hp: 10, maxHp: 10,
      dnd5eObjectState: { schemaVersion: 1, magical: false, wornOrCarried: false },
    }
    const creature: Token = {
      id: 'creature', label: '怪物', x: 75, y: 75, color: '#fff', emoji: 'M', size: 1, type: 'enemy',
    }
    const spellEffect: Token = {
      id: 'effect', label: '法术实体', x: 75, y: 75, color: '#fff', emoji: 'E', size: 1, type: 'obstacle',
      dnd5eSpellEffect: {
        schemaVersion: 1, spellId: 'arcane-eye', sourceCharacterId: 'caster',
        sourceTokenId: 'caster-token', createdRound: 1, expiresAfterRound: 10,
      },
    }
    const map: BattleMap = {
      id: 'object-area-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [object, creature, spellEffect], dnd5ePluginAreas: [storm],
    }
    const candidates = collectDnd5ePersistentAreaTriggers({
      map, timing: 'source-turn-start', round: 2, turnKey: '2:caster-token',
    })
    expect(candidates.map((candidate) => candidate.targetToken.id)).toEqual(['creature'])
    expect(map.tokens.find((token) => token.id === object.id)?.hp).toBe(10)
    expect(map.dnd5ePluginAreas?.[0]?.triggerReceipts).toBeUndefined()

    const creatureOnly = { ...storm, triggers: [{ ...trigger, targetKinds: undefined }] }
    expect(collectDnd5ePersistentAreaTriggers({
      map: { ...map, dnd5ePluginAreas: [creatureOnly] },
      timing: 'source-turn-start', round: 2, turnKey: '2:caster-token',
    }).map((candidate) => candidate.targetToken.id)).toEqual(['creature'])
  })

  it('removes concentration areas as soon as the source concentration no longer matches', () => {
    const concentrated = area({ concentrationId: 'plugin-area:action-1' })
    expect(reconcileDnd5ePluginAreas([concentrated], [character({
      concentrating: true,
      dnd5eCombatState: { concentrationSpellId: 'plugin-area:action-1' },
    })], 2)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([concentrated], [character({ concentrating: false })], 2)).toHaveLength(0)
  })

  it('keeps Spiritual Weapon only while its matching authoritative effect instance exists', () => {
    const spiritualWeapon = area({
      id: 'core-spell-area:cast',
      sourceKind: 'core-spell',
      coreSpellId: 'spiritual-weapon',
      sourceTokenId: 'caster-token',
      expiresAfterRound: 11,
    })
    const activeEffect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:spiritual-weapon',
      label: '灵体武器',
      targetId: 'caster-token',
      source: { kind: 'spell', actorId: 'caster-token', rulesId: 'spiritual-weapon' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      potency: 2,
      stackingPolicy: 'stack',
      stackingKey: spiritualWeapon.id,
    })
    expect(reconcileDnd5ePluginAreas([spiritualWeapon], [character({
      dnd5eCombatState: { activeEffects: [activeEffect] },
    })], 2)).toHaveLength(1)
    expect(reconcileDnd5ePluginAreas([spiritualWeapon], [character()], 2)).toHaveLength(0)
  })

  it('persists old trigger-receipt cleanup even when the area count does not change', () => {
    const retained = area({
      expiresAfterRound: 10,
      triggerReceipts: [
        { triggerId: 'tick', targetTokenId: 'target', round: 1, transactionId: 'old' },
        { triggerId: 'tick', targetTokenId: 'target', round: 5, transactionId: 'recent' },
      ],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [], dnd5ePluginAreas: [retained],
    }
    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character()], 6)
    expect(reconciled).not.toBe(map)
    expect(reconciled.dnd5ePluginAreas?.[0].triggerReceipts).toEqual([
      expect.objectContaining({ transactionId: 'recent' }),
    ])
    expect(reconcileDnd5ePluginAreasOnMap(reconciled, [character()], 6)).toBe(reconciled)
  })

  it('removes a fixed source-bound area only after its source leaves the area', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 75, y: 75, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const hut = area({
      id: 'tiny-hut', sourceTokenId: source.id,
      cells: [{ col: 1, row: 1 }], anchorMode: 'fixed', anchorCell: { col: 1, row: 1 },
      sourceExitBehavior: 'remove-area', expiresAfterRound: 4_800,
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source], dnd5ePluginAreas: [hut],
    }
    expect(reconcileDnd5ePluginAreasOnMap(map, [character()], 2).dnd5ePluginAreas).toHaveLength(1)
    expect(reconcileDnd5ePluginAreasOnMap({
      ...map,
      tokens: [{ ...source, x: 175 }],
    }, [character()], 2).dnd5ePluginAreas).toEqual([])
  })

  it('ends a source-anchored ward when source movement would enclose an affected creature', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 125, y: 75, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const living = {
      id: 'living-token', label: 'living', x: 125, y: 75, color: '#fff', emoji: 'L', size: 1,
      type: 'enemy' as const, creatureTypes: ['类人生物'] as Token['creatureTypes'],
    }
    const ward = area({
      id: 'antilife-shell', sourceTokenId: source.id,
      cells: [{ col: 1, row: 1 }], anchorMode: 'source-token', anchorTokenId: source.id,
      anchorCell: { col: 1, row: 1 }, sourceOverlapBehavior: 'remove-area',
      blocking: {
        movement: true, movementMode: 'enter', excludeSourceToken: true,
        excludedCreatureTypes: ['construct', 'undead'],
      },
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, living], dnd5ePluginAreas: [ward],
    }
    expect(reconcileDnd5ePluginAreasOnMap(map, [character()], 2).dnd5ePluginAreas).toEqual([])
    expect(reconcileDnd5ePluginAreasOnMap({
      ...map,
      tokens: [source, { ...living, id: 'undead-token', creatureTypes: ['亡灵'] as Token['creatureTypes'] }],
    }, [character()], 2).dnd5ePluginAreas).toHaveLength(1)
  })

  it('ends Antilife Shell and its concentration when a caster movement transaction encloses a living creature', () => {
    const caster = character({
      concentrating: true,
      dnd5eCombatState: {
        concentrationSpellId: 'antilife-shell',
        concentrationSpellLevel: 5,
        concentrationRoundsRemaining: 600,
      },
    })
    const sourceBefore: Token = {
      id: 'caster-token', label: 'caster', x: 175, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player', characterId: caster.id,
    }
    const sourceAfter = { ...sourceBefore, x: 225 }
    const living: Token = {
      id: 'living-token', label: 'living', x: 325, y: 125, color: '#fff', emoji: 'L', size: 1,
      type: 'enemy', creatureTypes: ['类人生物'],
    }
    const shellCells = Array.from({ length: 5 }, (_, rowIndex) =>
      Array.from({ length: 5 }, (_, colIndex) => ({ colIndex, rowIndex })),
    ).flat()
      .filter(({ colIndex, rowIndex }) =>
        !((colIndex === 0 || colIndex === 4) && (rowIndex === 0 || rowIndex === 4)))
      .map(({ colIndex, rowIndex }) => ({ col: colIndex + 2, row: rowIndex }))
    const shell = area({
      id: 'antilife-shell', sourceKind: 'core-spell', coreSpellId: 'antilife-shell',
      sourceCharacterId: caster.id, sourceTokenId: sourceBefore.id, concentrationId: 'antilife-shell',
      cells: shellCells, anchorMode: 'source-token', anchorTokenId: sourceBefore.id,
      anchorCell: { col: 4, row: 2 }, sourceOverlapBehavior: 'remove-area',
      blocking: {
        movement: true, movementMode: 'enter', excludeSourceToken: true,
        excludedCreatureTypes: ['construct', 'undead'],
      },
      expiresAfterRound: 601,
    })
    const beforeMap: BattleMap = {
      id: 'movement-map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [sourceBefore, living], dnd5ePluginAreas: [{
        ...shell,
        cells: shell.cells.map((cell) => ({ ...cell, col: cell.col - 1 })),
      }],
    }
    // Model the real UI race: the post-move map already carries the updated
    // anchor and translated cells before movement hazards reconcile.
    const movedMap: BattleMap = {
      ...beforeMap,
      tokens: [sourceAfter, living],
      dnd5ePluginAreas: [shell],
    }

    const result = reconcileDnd5ePluginAreasAfterSourceMove({
      beforeMap,
      afterMap: movedMap,
      characters: [caster],
      round: 2,
      sourceTokenId: sourceBefore.id,
    })

    expect(result.map.dnd5ePluginAreas).toEqual([])
    expect(result.endedConcentrationCharacterIds).toEqual([caster.id])
    expect(result.characters[0]).toMatchObject({
      concentrating: false,
      dnd5eCombatState: {
        concentrationSpellId: undefined,
        concentrationSpellLevel: undefined,
        concentrationRoundsRemaining: undefined,
      },
    })
  })

  it('detects entry along the complete movement path and deduplicates once-per-round triggers', () => {
    const moving = {
      id: 'target-token', label: 'target', x: 25, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const triggerArea = area({
      cells: [{ col: 2, row: 0 }],
      triggers: [{
        id: 'cloud-entry', label: '毒云', timing: 'on-enter', oncePerRound: true,
        damage: { count: 1, sides: 6, modifier: 0, type: 'poison' },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, moving], dnd5ePluginAreas: [triggerArea],
    }
    const found = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-enter', round: 2, movement: { token: moving, to: { x: 225, y: 25 } },
    })
    expect(found).toHaveLength(1)
    expect(found[0].enteredAt).toEqual({ col: 2, row: 0 })

    const reenteredArea = {
      ...triggerArea,
      cells: [{ col: 1, row: 0 }, { col: 3, row: 0 }],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map: { ...map, dnd5ePluginAreas: [reenteredArea] }, timing: 'on-enter', round: 2,
      movement: { token: moving, to: { x: 225, y: 25 } },
    })).toHaveLength(1)
    expect(collectDnd5ePersistentAreaTriggers({
      map: {
        ...map,
        dnd5ePluginAreas: [{
          ...reenteredArea,
          triggers: reenteredArea.triggers?.map((trigger) => ({ ...trigger, oncePerRound: false })),
        }],
      },
      timing: 'on-enter', round: 2, movement: { token: moving, to: { x: 225, y: 25 } },
    })).toHaveLength(2)

    const withReceipt = {
      ...map,
      dnd5ePluginAreas: [{
        ...triggerArea,
        triggerReceipts: [{
          triggerId: 'cloud-entry', targetTokenId: 'target-token', round: 2,
          transactionId: found[0].transactionId,
        }],
      }],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map: withReceipt, timing: 'on-enter', round: 2,
      movement: { token: moving, to: { x: 225, y: 25 } },
    })).toHaveLength(0)
  })

  it('detects a Large creature crossing a one-cell-thick Wall of Fire during a DM drag', () => {
    const caster: Token = {
      id: 'caster-token', label: 'caster', x: 123, y: 312, color: '#fff', emoji: 'C', size: 1,
      type: 'player', characterId: 'caster',
    }
    const ogre: Token = {
      id: 'ogre-token', label: 'ogre', x: 293, y: 422, color: '#fff', emoji: 'O', size: 2,
      creatureSize: '大型', type: 'enemy', hp: 59, maxHp: 59,
    }
    const wall = area({
      id: 'wall', sourceKind: 'core-spell', coreSpellId: 'wall-of-fire',
      sourceCharacterId: 'caster', sourceTokenId: caster.id,
      cells: Array.from({ length: 12 }, (_, index) => ({ col: 8 + index, row: 16 })),
      vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 20 },
      triggers: [{
        id: 'wall-of-fire-enter', label: '火墙术·进入火墙', timing: 'on-enter', oncePerTurn: true,
        damage: { count: 5, sides: 8, modifier: 0, type: 'fire' },
      }],
    })
    const map: BattleMap = {
      id: 'wall-map', name: 'map', width: 2400, height: 1600, gridSize: 20,
      gridOffsetX: 13, gridOffsetY: 2, showGrid: true, feetPerCell: 5,
      tokens: [caster, ogre], dnd5ePluginAreas: [wall],
    }

    expect(collectDnd5ePersistentAreaTriggers({
      map,
      timing: 'on-enter',
      round: 2,
      turnKey: '2:ogre-token',
      movement: {
        token: ogre,
        to: { x: 293, y: 222 },
        path: [{ x: 293, y: 422 }, { x: 293, y: 222 }],
      },
    })).toMatchObject([{
      trigger: { id: 'wall-of-fire-enter' },
      targetToken: { id: ogre.id },
      enteredAt: { col: 13, row: 16 },
    }])
  })

  it('collects on-enter when a source-token aura moves onto a stationary creature', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const enemy = {
      id: 'enemy-token', label: 'enemy', x: 275, y: 25, color: '#fff', emoji: 'E', size: 1,
      type: 'enemy' as const,
    }
    const aura = area({
      id: 'spirit',
      sourceKind: 'core-spell',
      coreSpellId: 'spirit-guardians',
      anchorMode: 'source-token',
      anchorTokenId: 'caster-token',
      anchorCell: { col: 0, row: 0 },
      relation: 'enemy',
      cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }],
      triggers: [{
        id: 'spirit-enter', label: '灵体卫士·进入', timing: 'on-enter', oncePerTurn: true,
        damage: { count: 3, sides: 8, type: 'radiant' },
      }],
    })
    const beforeMap = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, enemy], dnd5ePluginAreas: [aura],
    }
    const afterMap = {
      ...beforeMap,
      tokens: [{ ...source, x: 225, y: 25 }, enemy],
      dnd5ePluginAreas: [{
        ...aura,
        anchorCell: { col: 4, row: 0 },
        cells: [{ col: 4, row: 0 }, { col: 5, row: 0 }],
      }],
    }
    expect(collectDnd5ePersistentAreaTriggersForSourceMove({
      beforeMap,
      afterMap,
      sourceTokenId: source.id,
      round: 1,
      turnKey: '1:caster-token',
    })).toMatchObject([{
      trigger: { id: 'spirit-enter' },
      targetToken: { id: enemy.id },
    }])
  })

  it('collects creation, turn-start and turn-end triggers only for tokens inside the area', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const target = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    const triggerArea = area({
      cells: [{ col: 1, row: 0 }],
      triggers: [
        { id: 'created', label: '首次创建', timing: 'on-create', oncePerRound: true },
        { id: 'started', label: '回合开始', timing: 'turn-start', oncePerRound: true },
        { id: 'ended', label: '回合结束', timing: 'turn-end', oncePerRound: true },
      ],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, target], dnd5ePluginAreas: [triggerArea],
    }

    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'on-create', round: 2, areaId: triggerArea.id }))
      .toMatchObject([{ trigger: { id: 'created' }, targetToken: { id: target.id } }])
    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-start', round: 2, targetTokenId: target.id }))
      .toMatchObject([{ trigger: { id: 'started' } }])
    expect(collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-end', round: 2, targetTokenId: target.id }))
      .toMatchObject([{ trigger: { id: 'ended' } }])
  })

  it('supports first trigger per creature turn independently from once per round', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const target = {
      id: 'target-token', label: 'target', x: 25, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'enemy' as const,
    }
    const turnArea = area({
      cells: [{ col: 1, row: 0 }],
      triggers: [{
        id: 'entry', label: '每回合首次进入', timing: 'on-enter', oncePerRound: false, oncePerTurn: true,
        damage: { count: 1, sides: 6, modifier: 0, type: 'radiant' },
      }],
    })
    const baseMap = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, target], dnd5ePluginAreas: [turnArea],
    }
    const first = collectDnd5ePersistentAreaTriggers({
      map: baseMap, timing: 'on-enter', round: 2, turnKey: '2:caster-token',
      movement: { token: target, to: { x: 75, y: 25 } },
    })[0]
    expect(first).toBeDefined()
    const recorded = recordDnd5ePersistentAreaTrigger(baseMap.dnd5ePluginAreas, first, 2)
    const recordedMap = { ...baseMap, dnd5ePluginAreas: recorded, tokens: [source, { ...target, x: 25, y: 25 }] }
    expect(collectDnd5ePersistentAreaTriggers({
      map: recordedMap, timing: 'on-enter', round: 2, turnKey: '2:caster-token',
      movement: { token: target, to: { x: 75, y: 25 } },
    })).toHaveLength(0)
    expect(collectDnd5ePersistentAreaTriggers({
      map: recordedMap, timing: 'on-enter', round: 2, turnKey: '2:enemy-token',
      movement: { token: target, to: { x: 75, y: 25 } },
    })).toHaveLength(1)
  })

  it('shares one lifetime receipt per target across entry and turn-start triggers', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const targetInside = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'enemy' as const,
    }
    const truthArea = area({
      cells: [{ col: 1, row: 0 }],
      triggers: [{
        id: 'truth-enter', frequencyGroupId: 'truth-save', label: '首次进入',
        timing: 'on-enter', oncePerTarget: true,
        savingThrow: { ability: 'cha', dc: 15, onSuccess: 'none' },
      }, {
        id: 'truth-start', frequencyGroupId: 'truth-save', label: '区域内开始回合',
        timing: 'turn-start', oncePerTarget: true,
        savingThrow: { ability: 'cha', dc: 15, onSuccess: 'none' },
      }],
    })
    const baseMap = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, targetInside], dnd5ePluginAreas: [truthArea],
    }
    const first = collectDnd5ePersistentAreaTriggers({
      map: baseMap, timing: 'turn-start', round: 2, targetTokenId: targetInside.id,
    })[0]
    expect(first).toBeDefined()
    const recorded = recordDnd5ePersistentAreaTrigger(baseMap.dnd5ePluginAreas, first, 2)
    const targetOutside = { ...targetInside, x: 25 }
    const roundLater = {
      ...baseMap, tokens: [source, targetOutside], dnd5ePluginAreas: recorded,
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map: roundLater, timing: 'on-enter', round: 50,
      movement: { token: targetOutside, to: { x: 75, y: 25 } },
    })).toHaveLength(0)
  })

  it('shares a once-per-turn frequency group across different trigger timings', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const targetInside = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'enemy' as const,
    }
    const groupedArea = area({
      cells: [{ col: 1, row: 0 }],
      triggers: [
        {
          id: 'damage-at-start', frequencyGroupId: 'shared-damage', label: '回合开始',
          timing: 'turn-start', oncePerTurn: true,
          damage: { count: 1, sides: 6, modifier: 0, type: 'radiant' },
        },
        {
          id: 'damage-on-enter', frequencyGroupId: 'shared-damage', label: '首次进入',
          timing: 'on-enter', oncePerTurn: true,
          damage: { count: 1, sides: 6, modifier: 0, type: 'radiant' },
        },
      ],
    })
    const baseMap = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, targetInside], dnd5ePluginAreas: [groupedArea],
    }
    const start = collectDnd5ePersistentAreaTriggers({
      map: baseMap, timing: 'turn-start', round: 2, turnKey: '2:target-token', targetTokenId: targetInside.id,
    })[0]
    const recorded = recordDnd5ePersistentAreaTrigger(baseMap.dnd5ePluginAreas, start, 2)
    const targetOutside = { ...targetInside, x: 25 }
    const recordedMap = { ...baseMap, tokens: [source, targetOutside], dnd5ePluginAreas: recorded }

    expect(collectDnd5ePersistentAreaTriggers({
      map: recordedMap, timing: 'on-enter', round: 2, turnKey: '2:target-token',
      movement: { token: targetOutside, to: { x: 75, y: 25 } },
    })).toHaveLength(0)
    expect(collectDnd5ePersistentAreaTriggers({
      map: recordedMap, timing: 'on-enter', round: 2, turnKey: '2:other-token',
      movement: { token: targetOutside, to: { x: 75, y: 25 } },
    })).toHaveLength(1)
  })

  it('removes a persistent area only after its authoritative damage pool is exhausted', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const target = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'enemy' as const,
    }
    const guardian = area({
      cells: [{ col: 1, row: 0 }],
      triggers: [{
        id: 'guardian-strike', label: '守卫打击', timing: 'on-enter', oncePerRound: false,
        maximumTotalDamage: 60,
        damage: { count: 0, sides: 6, modifier: 20, type: 'radiant' },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, target], dnd5ePluginAreas: [guardian],
    }
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-enter', round: 2,
      movement: { token: { ...target, x: 25 }, to: { x: 75, y: 25 } },
    })[0]!

    const first = recordDnd5ePersistentAreaTrigger([guardian], candidate, 2, 20)
    expect(first).toHaveLength(1)
    const second = recordDnd5ePersistentAreaTrigger(first, {
      ...candidate, area: first[0]!, transactionId: `${candidate.transactionId}:2`,
    }, 2, 10)
    expect(second).toHaveLength(1)
    expect(second[0]?.triggerReceipts?.map((receipt) => receipt.damage)).toEqual([20, 10])
    const exhausted = recordDnd5ePersistentAreaTrigger(second, {
      ...candidate, area: second[0]!, transactionId: `${candidate.transactionId}:3`,
    }, 3, 30)
    expect(exhausted).toEqual([])
  })

  it('collects an explicit area-move impact and removes orphaned effect tokens', () => {
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const target = {
      id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'enemy' as const,
    }
    const sphere = {
      id: 'sphere-token', label: '炽焰法球', x: 75, y: 25, color: '#f97316', emoji: '🔥', size: 1,
      type: 'obstacle' as const,
      dnd5eSpellEffect: {
        schemaVersion: 1 as const, spellId: 'flaming-sphere', sourceCharacterId: 'caster',
        sourceTokenId: source.id, createdRound: 1, expiresAfterRound: 11,
        concentrationId: 'flaming-sphere',
      },
    }
    const triggerArea = area({
      sourceKind: 'core-spell', coreSpellId: 'flaming-sphere', sourceTokenId: source.id,
      cells: [{ col: 1, row: 0 }], anchorMode: 'effect-token', anchorTokenId: sphere.id,
      anchorCell: { col: 1, row: 0 }, concentrationId: 'flaming-sphere',
      triggers: [{
        id: 'impact', label: '撞击', timing: 'on-area-move-impact', oncePerRound: false,
        damage: { count: 2, sides: 6, modifier: 0, type: 'fire' },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, target, sphere], dnd5ePluginAreas: [triggerArea],
    }
    expect(collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-area-move-impact', round: 2, targetTokenId: target.id, areaId: triggerArea.id,
    })).toMatchObject([{ trigger: { id: 'impact' }, targetToken: { id: target.id } }])

    const reconciled = reconcileDnd5ePluginAreasOnMap(map, [character({ concentrating: false })], 2)
    expect(reconciled.dnd5ePluginAreas).toEqual([])
    expect(reconciled.tokens.map((token) => token.id)).toEqual([source.id, target.id])
  })

  it('emits one movement-distance trigger for every declared interval along the authoritative path', () => {
    const moving = {
      id: 'target-token', label: 'target', x: 25, y: 25, color: '#fff', emoji: 'T', size: 1,
      type: 'player' as const, characterId: 'target',
    }
    const source = {
      id: 'caster-token', label: 'caster', x: 25, y: 125, color: '#fff', emoji: 'C', size: 1,
      type: 'player' as const, characterId: 'caster',
    }
    const triggerArea = area({
      cells: [{ col: 1, row: 0 }, { col: 2, row: 0 }, { col: 2, row: 1 }],
      triggers: [{
        id: 'thorn-step', label: '荆棘移动', timing: 'on-move-distance', oncePerRound: false,
        movementIntervalFeet: 5,
        damage: { count: 2, sides: 4, modifier: 0, type: 'piercing' },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [source, moving], dnd5ePluginAreas: [triggerArea],
    }
    const found = collectDnd5ePersistentAreaTriggers({
      map,
      timing: 'on-move-distance',
      round: 2,
      movement: {
        token: moving,
        to: { x: 125, y: 75 },
        path: [{ x: 75, y: 25 }, { x: 125, y: 25 }, { x: 125, y: 75 }],
      },
    })
    expect(found).toHaveLength(3)
    expect(found.map((candidate) => candidate.enteredAt)).toEqual([
      { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 2, row: 1 },
    ])
    expect(new Set(found.map((candidate) => candidate.transactionId)).size).toBe(3)
  })

  it('resolves saves, half damage and ActiveEffect conditions through Headless', () => {
    const triggerArea = area({
      sourceTokenId: 'caster-token',
      cells: [{ col: 1, row: 0 }],
      includeSelf: false,
      triggers: [{
        id: 'moonlight', label: '月华区域', timing: 'turn-start', oncePerRound: true,
        savingThrow: {
          ability: 'con', dc: 12, onSuccess: 'half',
          advantageIfTargetHasSwimSpeed: true,
        },
        damage: { count: 2, sides: 6, modifier: 0, type: 'radiant' },
        condition: {
          condition: 'blinded',
          duration: { expiresAt: 'target-next-turn-start' },
        },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [
        { id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1, type: 'player' as const, characterId: 'caster' },
        { id: 'target-token', label: 'target', x: 75, y: 25, color: '#fff', emoji: 'T', size: 1, type: 'player' as const, characterId: 'target' },
      ],
      dnd5ePluginAreas: [triggerArea],
    }
    const characters = [character({ id: 'caster', name: 'caster' }), character({
      id: 'target', name: 'target', currentHp: 20, maxHp: 20,
      dnd5eMovementSpeeds: { swim: 30 },
    })]
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'turn-start', round: 2, targetTokenId: 'target-token',
    })[0]
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat', round: 2, map, characters,
      initiativeOrder: [
        { tokenId: 'caster-token', roll: 15, label: 'caster', emoji: 'C', color: '#fff', slotId: 'caster-slot' },
        { tokenId: 'target-token', roll: 10, label: 'target', emoji: 'T', color: '#fff', slotId: 'target-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.save?.mode).toBe('advantage')
    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared,
      d20: 20,
      d20Second: 1,
      damageRolls: [6, 6],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'persistent-area-triggered', saveSuccess: true, damage: 6,
    }))
    expect(resolved.application?.characters.find((entry) => entry.id === 'target')?.currentHp).toBe(14)
    expect(resolved.application?.characters.find((entry) => entry.id === 'target')?.conditions).not.toContain('blinded')
    expect(resolved.application?.map.dnd5ePluginAreas?.[0].triggerReceipts).toHaveLength(1)
  })

  it('resolves persistent-area saves and damage against an ordinary NPC token', () => {
    const triggerArea = area({
      sourceTokenId: 'caster-token', cells: [{ col: 1, row: 0 }], includeSelf: false,
      triggers: [{
        id: 'blast', label: '爆炸', timing: 'on-detonate',
        savingThrow: { ability: 'dex', dc: 12, onSuccess: 'half' },
        damage: { count: 2, sides: 6, type: 'fire' },
      }],
    })
    const map = {
      id: 'map', name: 'map', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [
        { id: 'caster-token', label: 'caster', x: 25, y: 25, color: '#fff', emoji: 'C', size: 1, type: 'player' as const, characterId: 'caster' },
        { id: 'npc-token', label: 'NPC', x: 75, y: 25, color: '#fff', emoji: 'N', size: 1, type: 'npc' as const, hp: 12, maxHp: 12 },
      ],
      dnd5ePluginAreas: [triggerArea],
    }
    const candidate = collectDnd5ePersistentAreaTriggers({
      map, timing: 'on-detonate', round: 1, areaId: triggerArea.id,
    })[0]
    const prepared = prepareDnd5ePersistentAreaTrigger({
      combatId: 'combat', round: 1, map, characters: [character({ id: 'caster', name: 'caster' })],
      initiativeOrder: [
        { tokenId: 'caster-token', roll: 15, label: 'caster', emoji: 'C', color: '#fff', slotId: 'caster-slot' },
        { tokenId: 'npc-token', roll: 1, label: 'NPC', emoji: 'N', color: '#fff', slotId: 'npc-slot' },
      ],
      candidate,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({
      prepared: prepared.prepared, d20: 1, damageRolls: [3, 3],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'npc-token')?.hp).toBe(6)
  })
})
