import { registerDnd5eRulesPlugin } from './pluginApi'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { selectRandomCreatureTarget } from '../../presentation/maps/randomCreatureTargetCheckpoint'
import { prepareDnd5eRandomTargetBasicAction } from './randomBasicActionTargets'
import { describe, expect, it } from 'vitest'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import {
  planDnd5eShovePushDestination,
  prepareDnd5ePlayerBasicAction,
  resolvePreparedDnd5ePlayerBasicAction,
  triggerDnd5eReadiedAction,
} from './playerBasicAction'

const hero: Character = {
  id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '战士', level: 3,
  background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
  abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, savingThrows: [], skills: ['athletics'],
  maxHp: 30, currentHp: 30, tempHp: 0, hitDice: '3d10', ac: 16, speed: 30, initiativeBonus: 1,
  saveDC: 0, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
}

const map: BattleMap = {
  id: 'map', name: '地图', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0,
  showGrid: true, feetPerCell: 5,
  tokens: [
    { id: 'hero-token', label: '英雄', characterId: 'hero', x: 5, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
    { id: 'enemy', label: '敌人', x: 15, y: 5, color: '', emoji: '', size: 1, type: 'enemy', hp: 10, maxHp: 10 },
  ],
}

function request(payload: SharedPlayerActionState['dnd5eBasicAction']): SharedPlayerActionState {
  return {
    id: 'basic', mapId: 'map', combatId: 'combat', sourceMode: 'player', status: 'pending',
    type: 'dnd5e-basic-action', actorTokenId: 'hero-token', characterId: 'hero', dnd5eBasicAction: payload,
    round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
  }
}

describe('D&D 5e player basic action bridge', () => {
  it.each(['use', 'skip', 'wrong-source', 'low-level', 'bad-die'] as const)(
    'resolves a retained die for an escape saving throw through the map bridge: %s', mode => {
      const hold = createDnd5eConditionEffect({ id: 'escape-save', condition: 'restrained',
        source: { kind: 'monster', actorId: 'enemy' }, targetId: 'hero-token',
        escapeSavingThrow: { ability: 'wis', dc: 15, economy: 'action' } })
      const restrained = { ...hero, dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [hold] } }
      const prepared = prepareDnd5ePlayerBasicAction({
        action: request({ kind: 'escape-effect' }), map, characters: [restrained],
        initiativeOrder: [
          { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
          { tokenId: 'enemy', label: 'Enemy', emoji: '', color: '', roll: 10 },
        ],
        turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
      })
      expect(prepared.ok).toBe(true)
      if (!prepared.ok) return
      expect(prepared.prepared.actorRollKind).toBe('saving-throw')
      const actor = prepared.prepared.state.combatants['hero-token']
      actor.classLevels = { ranger: mode === 'low-level' ? 6 : 7 }
      actor.classState.activeEffects!.push(createDnd5eMechanicalEffect({
        id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: actor.id,
        source: { kind: 'feature', actorId: actor.id },
        modifiers: {
          onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary',
            appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true, oncePerTurn: true,
            consumeEffectOnHit: false, boundTargetId: mode === 'wrong-source' ? 'other' : 'enemy' },
          optionalBonusDie: { sides: 6, appliesTo: ['saving-throw'], consumeOnUse: false,
            boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
        },
      }))
      const before = structuredClone(prepared.prepared.state)
      const resolved = resolvePreparedDnd5ePlayerBasicAction({
        prepared: prepared.prepared, actorD20: 10,
        optionalBonusDice: mode === 'skip' ? undefined
          : [{ effectId: 'prey', targetId: actor.id, rollKind: 'saving-throw', roll: mode === 'bad-die' ? 7 : 6 }],
      })
      expect(prepared.prepared.state).toEqual(before)
      expect(resolved.result.ok).toBe(mode === 'use' || mode === 'skip')
      if (!resolved.result.ok) {
        expect(resolved.result.state).toEqual(before)
        expect(resolved.application).toBeUndefined()
        return
      }
      expect(resolved.result.events).toContainEqual(expect.objectContaining({
        type: 'saving-throw-resolved', sourceId: 'enemy', targetId: actor.id,
        total: mode === 'use' ? 16 : 10, success: mode === 'use',
      }))
      expect(resolved.result.state.combatants[actor.id].classState.activeEffects?.some(effect => effect.id === hold.id))
        .toBe(mode === 'skip')
      expect(resolved.result.state.combatants[actor.id].classState.activeEffects?.some(effect => effect.id === 'prey')).toBe(true)
      expect(resolved.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
    })
  it.each(['grapple', 'shove'] as const)('binds pre-attack teleport to %s even when the contest fails', kind => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: `test.teleport-${kind}`, name: 'Teleport', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { featureId = api.registerFeature({ id: 'step', name: 'Step', description: 'Synthetic',
        summary: 'Synthetic', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'step',
          name: 'Step', description: 'Synthetic', level: 1, trigger: { kind: 'passive' },
          targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } }) },
    })
    try {
      const actor = { ...hero, dnd5ePluginFeatureIds: [featureId] }
      const battleMap = { ...map, tokens: map.tokens.map(token => token.id === 'enemy' ? { ...token, x: 35 } : token) }
      const payload = kind === 'grapple'
        ? { kind, targetTokenId: 'enemy', targetDefense: 'athletics' as const }
        : { kind, targetTokenId: 'enemy', targetDefense: 'athletics' as const, outcome: 'prone' as const }
      const input = { map: battleMap, characters: [actor],
        action: request(payload), turnEconomy: createDnd5eTurnEconomyCounts('combat:1:hero-token', 30),
        initiativeOrder: [{ tokenId: 'hero-token', label: '', emoji: '', color: '', roll: 20 },
          { tokenId: 'enemy', label: '', emoji: '', color: '', roll: 10 }] }
      expect(prepareDnd5ePlayerBasicAction(input).ok).toBe(false)
      input.action = request({ ...payload, attackActionTeleport: { targetCell: { col: 2, row: 0 } } })
      const before = JSON.stringify(input)
      const ready = prepareDnd5ePlayerBasicAction(input)
      expect(ready.ok, ready.ok ? '' : ready.reason).toBe(true)
      if (!ready.ok) throw Error('teleport preparation failed')
      const rejected = resolvePreparedDnd5ePlayerBasicAction({ prepared: ready.prepared, actorD20: 99, targetD20: 20 })
      expect(rejected.result.ok).toBe(false)
      expect(rejected.application).toBeUndefined()
      expect(rejected.result.state.combatants['hero-token'].position).toEqual({ x: 5, y: 5 })
      const done = resolvePreparedDnd5ePlayerBasicAction({ prepared: ready.prepared, actorD20: 1, targetD20: 20 })
      expect(done.result.ok, done.result.ok ? '' : done.result.reason).toBe(true)
      expect(done.result.events[0]).toMatchObject({ type: 'teleported', from: { x: 5, y: 5 }, to: { x: 25, y: 5 } })
      expect(done.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ x: 25, y: 5 })
      expect(done.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
      expect(done.result.state.combatants['hero-token'].classState.attackActionHistory).toMatchObject({
        attacksTaken: 1, creatureTargetIds: ['enemy'],
      })
      expect(JSON.stringify(input)).toBe(before)
      const dark = createEmptyMapGeometry(battleMap.id)
      dark.vision.ambientLight = 'darkness'
      const lit = { ...input, map: { ...battleMap, tokens: battleMap.tokens.map(token => token.id === 'hero-token'
        ? { ...token, lightSource: { enabled: true, brightRadiusFeet: 20, dimRadiusFeet: 0, color: '#fff', expiresAtWorldMinute: 10 } }
        : token) } }
      setMapGeometryRuntime([dark])
      expect(prepareDnd5ePlayerBasicAction({ ...lit, worldMinute: 9 }).ok).toBe(true)
      expect(prepareDnd5ePlayerBasicAction({ ...lit, worldMinute: 10 }).ok).toBe(false)
      expect(prepareDnd5ePlayerBasicAction(lit).ok).toBe(false)
      setMapGeometryRuntime([])
      const stale = structuredClone(ready.prepared)
      stale.map.tokens.push({ ...stale.map.tokens[0], id: 'blocker', characterId: undefined, x: 25, y: 5 })
      expect(resolvePreparedDnd5ePlayerBasicAction({ prepared: stale, actorD20: 1, targetD20: 20 }).application).toBeUndefined()
      input.characters = [{ ...actor, dnd5ePluginFeatureIds: [] }]
      expect(prepareDnd5ePlayerBasicAction(input).ok).toBe(false)
    } finally { dispose(); setMapGeometryRuntime([]) }
  })
  it.each(['grapple', 'shove'] as const)('records failed %s attempts and consumes a third-target bonus through map writeback', kind => {
    let featureId = ''
    const dispose = registerDnd5eRulesPlugin({
      manifest: { id: `test.distinct-${kind}`, name: 'Distinct', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
      setup(api) { featureId = api.registerFeature({ id: 'distinct', name: 'Distinct', description: 'Synthetic',
        summary: 'Synthetic', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'distinct',
          name: 'Distinct', description: 'Synthetic', level: 1, trigger: { kind: 'passive' },
          targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'distinct-target-bonus-attack', minimumDistinctTargets: 2 } } }) },
    })
    try {
      let characters: readonly Character[] = [{ ...hero, level: 5, dnd5ePluginFeatureIds: [featureId] }]
      let currentMap: BattleMap = { ...map, tokens: [...map.tokens,
        { ...map.tokens[1], id: 'second' }, { ...map.tokens[1], id: 'third' }] }
      const initiativeOrder = currentMap.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i }))
      const economy = createDnd5eTurnEconomyCounts('combat:1:hero-token', 30)
      economy.action.max = 2; economy.action.current = 2
      for (let attacksUsed = 0; attacksUsed < 6; attacksUsed++) {
        economy.attacksUsed = attacksUsed
        const targetTokenId = ['enemy', 'second', 'third'][attacksUsed % 3]
        const prepared = prepareDnd5ePlayerBasicAction({
          action: request(kind === 'grapple' ? { kind, targetTokenId, targetDefense: 'athletics' }
            : { kind, targetTokenId, targetDefense: 'athletics', outcome: 'prone' }),
          map: currentMap, characters, initiativeOrder, turnEconomy: economy,
        })
        expect(prepared.ok, prepared.ok ? '' : `${attacksUsed}: ${prepared.reason}`).toBe(true)
        if (!prepared.ok) throw Error('prepare failed')
        expect(prepared.prepared.spendsAction).toBe(attacksUsed % 3 === 0)
        expect(prepared.prepared.attackNumber).toBe(attacksUsed + 1)
        expect(prepared.prepared.distinctTargetBonusAttackFeatureId).toBe(attacksUsed % 3 === 2 ? featureId : undefined)
        const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 1, targetD20: 20 })
        expect(resolved.result.ok, resolved.result.ok ? '' : resolved.result.reason).toBe(true)
        expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'contest-resolved', success: false }))
        if (!resolved.application) throw Error('missing writeback')
        if (prepared.prepared.spendsAction) economy.action.current--
        const saved = JSON.parse(JSON.stringify(resolved.application))
        currentMap = saved.map; characters = saved.characters
        expect(characters[0].dnd5eCombatState?.attackActionHistory?.bonusAttacksTakenThisTurn).toBe(Math.floor((attacksUsed + 1) / 3))
      }
    } finally { dispose() }
  })
  it.each([
    { actor: { x: 40, y: 15 }, target: { x: 40, y: 30 }, expected: { x: 40, y: 40 } },
    { actor: { x: 15, y: 40 }, target: { x: 30, y: 40 }, expected: { x: 40, y: 40 } },
    { actor: { x: 15, y: 15 }, target: { x: 30, y: 30 }, expected: { x: 40, y: 40 } },
    { actor: { x: 35, y: 15 }, target: { x: 40, y: 30 }, expected: { x: 50, y: 40 } },
  ])('pushes a larger target away from centers without anchor-offset drift: %j', ({ actor, target, expected }) => {
    const battleMap: BattleMap = { ...map, tokens: [
      { ...map.tokens[0], ...actor },
      { ...map.tokens[1], ...target, size: 2, creatureSize: '大型' },
    ] }
    expect(planDnd5eShovePushDestination(battleMap, 'hero-token', 'enemy')).toEqual(expected)
    // Keep the footprint occupancy guard after fixing the direction.
    battleMap.tokens.push({ ...map.tokens[0], id: 'blocker', x: expected.x + 5, y: expected.y + 5 })
    expect(planDnd5eShovePushDestination(battleMap, 'hero-token', 'enemy')).toBeUndefined()
  })
  it('requires separate Host approval for mounting and preserves movement-only costs after projection', () => {
    const ridingMap = { ...map, tokens: map.tokens.map(token => token.id === 'enemy' ? { ...token, size: 2, creatureSize: '大型' as const } : token) }
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.action.current = 0
    const payload = { kind: 'mount', targetTokenId: 'enemy', hostApproved: true } as const
    const prepared = prepareDnd5ePlayerBasicAction({ action: request(payload), map: ridingMap, characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }], turnEconomy: economy })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spendsAction).toBe(false)
    expect(prepared.prepared.spendsBonusAction).toBe(false)
    expect(resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared }).result.ok).toBe(false)
    const result = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, mountApprovedByHost: true })
    expect(result.result.ok, JSON.stringify(result.result)).toBe(true)
    expect(result.result.state.combatants['hero-token'].turn.movementRemaining).toBe(15)
    expect(result.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    expect(result.application?.map.tokens.find(token => token.id === 'enemy')?.dnd5eCombatState?.activeEffects)
      .toEqual(expect.arrayContaining([expect.objectContaining({ relation: expect.objectContaining({ slotGroup: 'riding', sourceActorId: 'hero-token' }) })]))
    if (!result.application) return
    for (const round of [1, 2]) {
      const restored = JSON.parse(JSON.stringify(result.application))
      const leave = prepareDnd5ePlayerBasicAction({
        action: { ...request({ kind: 'dismount', targetTokenId: 'enemy', direction: 'east' }), round },
        map: restored.map, characters: restored.characters,
        initiativeOrder: [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 }],
        turnEconomy: createDnd5eTurnEconomyCounts(`turn-${round}`, 30),
      })
      expect(leave.ok).toBe(true)
      if (!leave.ok) continue
      const dismounted = resolvePreparedDnd5ePlayerBasicAction({ prepared: leave.prepared })
      expect(dismounted.result.ok).toBe(round === 2)
      if (round === 2) {
        const airborne = { ...leave.prepared, map: { ...leave.prepared.map,
          tokens: leave.prepared.map.tokens.map(token => ({ ...token, elevationFeet: 20 })) } }
        const before = JSON.stringify(airborne.state)
        setMapGeometryRuntime([{ mapId: map.id, walls: [{ id: 'landing-wall', kind: 'wall', label: 'Landing wall',
          points: [{ x: 35, y: 0 }, { x: 35, y: 100 }], edgeIds: ['landing-edge'], baseHeightFeet: 0,
          heightFeet: 5, blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }],
          doors: [], obstacles: [], vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: false, ambientLight: 'bright' }, updatedAt: 1 }])
        try {
          const rejected = resolvePreparedDnd5ePlayerBasicAction({ prepared: airborne })
          expect(rejected.result).toMatchObject({ ok: false, reason: 'invalid-target', events: [] })
          expect(JSON.stringify(rejected.result.state)).toBe(before)
          expect(rejected.application).toBeUndefined()
        } finally { setMapGeometryRuntime([]) }
        expect(dismounted.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ x: 35, y: 5 })
        expect(dismounted.result.state.combatants['hero-token'].turn.movementRemaining).toBe(15)
        expect(dismounted.application?.map.tokens.find(token => token.id === 'enemy')?.dnd5eCombatState?.activeEffects?.some(effect => effect.relation?.slotGroup === 'riding')).not.toBe(true)
      }
    }
  })
  it('allows free self dismissal with no remaining action in exploration and combat', () => {
    const effect = createDnd5eMechanicalEffect({ id: 'dream-trance:test', definitionId: 'dream-trance',
      label: 'Trance', targetId: 'hero', source: { kind: 'spell', rulesId: 'dream', actorId: 'hero' },
      duration: { type: 'permanent' }, modifiers: { preventActions: true, speedOverrideFeet: 0 },
      removal: { action: { label: 'End trance', economy: 'free', selfOnly: true, maxDistanceFeet: 0 } } })
    const character: Character = { ...hero, dnd5eCombatState: { activeEffects: [effect] },
      dnd5eDreamContact: { schemaVersion: 1, id: 'test', sourceCharacterId: hero.id, targetCharacterId: 'remote',
        startedWorldMinute: 100, expiresWorldMinute: 580, phase: 'waiting' } }
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.action.current = 0
    const initiativeOrder = [{ tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
      { tokenId: 'enemy', label: 'Enemy', emoji: '', color: '', roll: 10 }]
    for (const exploration of [true, false]) {
      const action = { ...request({ kind: 'dismiss-effect', effectId: effect.id }),
        ...(exploration ? { combatId: undefined } : { initiativeIndex: 1 }) }
      const input = { action, map, characters: [character], turnEconomy: economy,
        initiativeOrder: exploration ? [] : initiativeOrder }
      const prepared = prepareDnd5ePlayerBasicAction(input)
      expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
      if (!prepared.ok) continue
      expect(prepared.prepared.spendsAction).toBe(false)
      expect(prepared.prepared.spendsBonusAction).toBe(false)
      if (!exploration) expect(prepared.prepared.state.initiativeIndex).toBe(1)
      const settled = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
      expect(settled.result.ok, settled.result.ok ? undefined : settled.result.reason).toBe(true)
      expect((settled.result.state.combatants['hero-token'].classState.activeEffects ?? []).some(value => value.id === effect.id)).toBe(false)
      expect(settled.result.events.some(event => event.type === 'turn-resource-spent')).toBe(false)
      expect(settled.application?.characters.find(value => value.id === hero.id)?.dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'voluntary' })
      expect(settled.application?.characterPatches?.[hero.id].dnd5eDreamContact).toMatchObject({ phase: 'ended', endReason: 'voluntary' })
      expect(prepareDnd5ePlayerBasicAction({ ...input,
        action: { ...action, dnd5eBasicAction: { kind: 'dismiss-effect', effectId: effect.id, targetTokenId: 'enemy' } } }).ok).toBe(false)
    }
  })
  it('routes an Arcana rescue to another creature and removes only the chosen effect', () => {
    const effect = createDnd5eConditionEffect({ id: 'trap-restraint', condition: 'restrained', targetId: 'enemy',
      source: { kind: 'plugin', actorId: 'caster' }, duration: { type: 'permanent' },
      removal: { action: { label: '解救', economy: 'action', maxDistanceFeet: 5,
        abilityCheck: { ability: 'int', skill: 'arcana', dc: 10 } } } })
    const unrelated = createDnd5eConditionEffect({ id: 'other-restraint', condition: 'restrained', targetId: 'enemy',
      source: { kind: 'plugin', actorId: 'other-caster' }, duration: { type: 'permanent' } })
    const rescueMap: BattleMap = { ...map, tokens: map.tokens.map(token => token.id !== 'enemy' ? token : {
      ...token, dnd5eCombatState: { schemaVersion: 2, conditions: ['restrained'], activeEffects: [effect, unrelated] } }) }
    const input = { action: request({ kind: 'dismiss-effect', effectId: effect.id, targetTokenId: 'enemy' }),
      map: rescueMap, characters: [hero], initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 }], turnEconomy: createDnd5eTurnEconomyCounts('turn', 30) }
    const prepared = prepareDnd5ePlayerBasicAction(input)
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.actorCheckAbility).toBe('int')
    const exploration = prepareDnd5ePlayerBasicAction({ ...input, action: { ...input.action, combatId: undefined }, initiativeOrder: [] })
    expect(exploration.ok).toBe(true)
    if (exploration.ok) {
      const rescued = resolvePreparedDnd5ePlayerBasicAction({ prepared: exploration.prepared, actorD20: 20 })
      expect(rescued.result.ok).toBe(true)
      expect(rescued.application?.map.tokens.find(token => token.id === 'enemy')?.dnd5eCombatState?.activeEffects?.map(entry => entry.id)).toEqual([unrelated.id])
    }
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 15 })
    expect(resolved.result.ok).toBe(true)
    const saved = resolved.application?.map.tokens.find(token => token.id === 'enemy')?.dnd5eCombatState
    expect(saved?.activeEffects?.some(e => e.id === effect.id)).toBe(false)
    expect(saved?.activeEffects?.some(e => e.id === unrelated.id)).toBe(true)
    expect(saved?.conditions).toContain('restrained')
    expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    const distantMap = { ...rescueMap, tokens: rescueMap.tokens.map(t => t.id === 'enemy' ? { ...t, x: 95 } : t) }
    expect(prepareDnd5ePlayerBasicAction({ ...input, map: distantMap })).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(prepareDnd5ePlayerBasicAction({ ...input, action: request({ kind: 'dismiss-effect', effectId: unrelated.id, targetTokenId: 'enemy' }) })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })
  it('routes a module rest effect through the player wake request without creating a completion receipt', () => {
    const restingMap: BattleMap = { ...map, tokens: map.tokens.map(entry => entry.id !== 'enemy' ? entry : {
      ...entry, dnd5eCombatState: { schemaVersion: 2, conditions: ['unconscious'], activeEffects: [
        createDnd5eConditionEffect({ condition: 'unconscious', targetId: entry.id,
          source: { kind: 'spell', actorId: 'caster', rulesId: 'test.rest:spell', pluginId: 'test.rest' },
          duration: { type: 'rounds', remainingRounds: 100, tickOn: 'target-turn-end' },
          breakOn: ['takes-damage', 'awakened'], completionReward: { kind: 'short-rest' },
          completionRequirement: { condition: 'unconscious', interrupted: false },
        }),
      ] },
    }) }
    const prepared = prepareDnd5ePlayerBasicAction({ action: request({ kind: 'wake', targetTokenId: 'enemy' }),
      map: restingMap, characters: [hero], initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ], turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action' }))
    const target = resolved.application?.map.tokens.find(entry => entry.id === 'enemy')
    expect(target?.dnd5eCombatState?.conditions ?? []).not.toContain('unconscious')
    expect(target?.dnd5eCombatState?.lastGrantedShortRest).toBeUndefined()
    expect(target?.dnd5eCombatState?.activeEffects?.some(effect => effect.definitionId.startsWith('rest-completion:')) ?? false).toBe(false)
  })
  it.each(['other-action', 'other-bonus-action'] as const)('only spends the requested economy for %s shortcuts', (kind) => {
    const prepared = prepareDnd5ePlayerBasicAction({ action: request({ kind, economyOnly: true }), map, characters: [hero],
      initiativeOrder: [{ tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 }],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events.filter(event => event.type === 'turn-resource-spent')).toEqual([
      { type: 'turn-resource-spent', actorId: 'hero-token', resource: kind === 'other-action' ? 'action' : 'bonusAction' },
    ])
    expect(resolved.result.events.some(event => event.type === 'basic-action-adjudication-requested')).toBe(false)
    expect(resolved.result.state.combatants['hero-token'].currentHp).toBe(hero.currentHp)
    expect(resolved.result.state.combatants['hero-token'].conditions).toEqual([])
  })
  it.each([
    {
      payload: { kind: 'other-action', description: '尝试翻过桌子压住机关。' } as const,
      economy: 'action' as const,
      spendsAction: true,
      spendsBonusAction: false,
    },
    {
      payload: { kind: 'other-bonus-action', description: '向同伴喊出约定的暗号。' } as const,
      economy: 'bonusAction' as const,
      spendsAction: false,
      spendsBonusAction: true,
    },
  ])('authoritatively spends $economy before routing a custom action to DM adjudication', ({
    payload,
    economy,
    spendsAction,
    spendsBonusAction,
  }) => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request(payload),
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction, spendsBonusAction })

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: 'hero-token',
      resource: economy,
    })
    expect(resolved.result.events).toContainEqual({
      type: 'basic-action-adjudication-requested',
      actorId: 'hero-token',
      economy,
      description: payload.description,
    })
  })

  it('rejects a custom bonus action when the Host snapshot has no bonus action remaining', () => {
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.bonusAction.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'other-bonus-action', description: '尝试快速完成额外动作。' }),
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared).toEqual({ ok: false, reason: 'action-unavailable' })
  })

  it('accepts Haste Dash after the ordinary action is spent and consumes the restricted credential', () => {
    const haste = createDnd5eMechanicalEffect({
      id: 'haste-effect',
      definitionId: 'activity:haste:effect',
      label: '加速术',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'haste', magical: true },
      targetId: 'hero-token',
      modifiers: {
        speedMultiplier: 2,
        restrictedExtraAction: {
          allowedActions: ['weapon-attack', 'dash', 'disengage', 'hide', 'use-object'],
          maximumWeaponAttacks: 1,
        },
      },
    })
    const economy = createDnd5eTurnEconomyCounts('turn', 60)
    economy.action.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'dash' }),
      map,
      characters: [{ ...hero, dnd5eCombatState: { activeEffects: [haste] } }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared.ok, prepared.ok ? undefined : prepared.reason).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.state.combatants['hero-token'].turn).toMatchObject({
      actionAvailable: false,
      movementRemaining: 120,
    })
    expect(resolved.result.state.combatants['hero-token'].classState.restrictedExtraActionUsesByEffect)
      .toEqual({ 'haste-effect': 'combat:1:hero-token' })
  })

  it('authoritatively commands multiple controlled Animate Dead undead within 60 feet with one bonus action', () => {
    const commandedMap: BattleMap = {
      ...map,
      tokens: [
        ...map.tokens,
        ...[
          { id: 'skeleton', label: '受控骷髅', x: 25, y: 5, poolId: 'srd-5.1:skeleton', hp: 13, maxHp: 13 },
          { id: 'zombie', label: '受控僵尸', x: 35, y: 5, poolId: 'srd-5.1:zombie', hp: 22, maxHp: 22 },
        ].map((token) => ({
          ...token,
          color: '', emoji: '', size: 1, type: 'enemy' as const,
          dnd5eSummon: {
            schemaVersion: 1 as const,
            pluginId: 'core-srd-spell',
            featureId: 'spell:animate-dead',
            sourceCharacterId: 'hero',
            sourceTokenId: 'hero-token',
            createdRound: 1,
            expiresAfterRound: 14_400,
            side: 'player' as const,
            persistent: true as const,
            createdWorldMinute: 1,
            controlExpiresAtWorldMinute: 1_441,
          },
        })),
      ],
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({
        kind: 'command-animate-dead',
        targetTokenIds: ['skeleton', 'zombie'],
        command: '守卫法师，并攻击接近的敌人。',
      }),
      map: commandedMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'skeleton', label: '受控骷髅', emoji: '', color: '', roll: 15 },
        { tokenId: 'zombie', label: '受控僵尸', emoji: '', color: '', roll: 14 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction: false, spendsBonusAction: true })

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'bonusAction',
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'basic-action-adjudication-requested',
      actorId: 'hero-token',
      economy: 'bonusAction',
      description: expect.stringContaining('受控骷髅、受控僵尸'),
    }))
  })

  it.each([
    {
      label: 'duplicate targets',
      payload: { kind: 'command-animate-dead', targetTokenIds: ['skeleton', 'skeleton'], command: '守卫。' } as const,
      targetPatch: {},
      reason: 'invalid-action' as const,
    },
    {
      label: 'ended control',
      payload: { kind: 'command-animate-dead', targetTokenIds: ['skeleton'], command: '守卫。' } as const,
      targetPatch: { dnd5eSummon: { controlEnded: true as const } },
      reason: 'invalid-target' as const,
    },
    {
      label: 'more than 60 feet',
      payload: { kind: 'command-animate-dead', targetTokenIds: ['skeleton'], command: '守卫。' } as const,
      targetPatch: { x: 135 },
      reason: 'invalid-target' as const,
    },
  ])('rejects an Animate Dead command with $label', ({ payload, targetPatch, reason }) => {
    const summon = {
      schemaVersion: 1 as const,
      pluginId: 'core-srd-spell', featureId: 'spell:animate-dead',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
      expiresAfterRound: 14_400, side: 'player' as const, persistent: true as const,
      createdWorldMinute: 1, controlExpiresAtWorldMinute: 1_441,
    }
    const skeleton = {
      id: 'skeleton', label: '受控骷髅', x: 25, y: 5, color: '', emoji: '', size: 1,
      type: 'enemy' as const, poolId: 'srd-5.1:skeleton', hp: 13, maxHp: 13,
      dnd5eSummon: {
        ...summon,
        ...('dnd5eSummon' in targetPatch ? targetPatch.dnd5eSummon : {}),
      },
      ...(!('dnd5eSummon' in targetPatch) ? targetPatch : {}),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ ...payload, targetTokenIds: [...payload.targetTokenIds] }),
      map: { ...map, tokens: [...map.tokens, skeleton] },
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'skeleton', label: '受控骷髅', emoji: '', color: '', roll: 15 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared).toEqual({ ok: false, reason })
  })

  it('uses the Create Undead 120-foot command range without widening Animate Dead', () => {
    const createUndeadSummon = {
      schemaVersion: 1 as const,
      pluginId: 'core-srd-spell', featureId: 'spell:create-undead',
      sourceCharacterId: 'hero', sourceTokenId: 'hero-token', createdRound: 1,
      expiresAfterRound: 14_400, side: 'player' as const, persistent: true as const,
      createdWorldMinute: 1, controlExpiresAtWorldMinute: 1_441,
    } as const
    const prepareAtX = (x: number) => prepareDnd5ePlayerBasicAction({
      action: request({
        kind: 'command-animate-dead', targetTokenIds: ['ghoul'], command: '守卫。',
      }),
      map: {
        ...map,
        width: 300,
        tokens: [...map.tokens, {
          id: 'ghoul', label: '受控食尸鬼', x, y: 5, color: '', emoji: '', size: 1,
          type: 'enemy' as const, poolId: 'srd-5.1:ghoul', hp: 22, maxHp: 22,
          dnd5eSummon: createUndeadSummon,
        }],
      },
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'ghoul', label: '受控食尸鬼', emoji: '', color: '', roll: 15 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })

    expect(prepareAtX(245).ok).toBe(true)
    expect(prepareAtX(255)).toEqual({ ok: false, reason: 'invalid-target' })
  })

  it('accepts an omitted custom-action description and supplies a safe default for the DM', () => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'other-action' }),
      map,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual({
      type: 'basic-action-adjudication-requested',
      actorId: 'hero-token',
      economy: 'action',
      description: '玩家声明一个其他动作。',
    })
  })

  it('prepares and resolves a grapple without trusting the player result', () => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'grapple', targetTokenId: 'enemy', targetDefense: 'athletics' }),
      map, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 18, targetD20: 2 })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')?.dnd5eCombatState?.activeEffects)
      .toContainEqual(expect.objectContaining({ standardCondition: 'grappled' }))
  })

  it('releases the actor own basic grapple without spending an action', () => {
    const grapple = createDnd5eConditionEffect({
      id: 'basic-grapple',
      condition: 'grappled',
      source: { kind: 'feature', actorId: 'hero-token', rulesId: 'basic-action:grapple' },
      targetId: 'enemy',
      duration: { type: 'permanent' },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'hero-token',
        sourceActionId: 'basic-action:grapple',
        slotGroup: 'free-hand',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
    })
    const grappleMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['grappled'],
              activeEffects: [grapple],
            },
          }
        : entry),
    }
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.action.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'release-grapple', targetTokenId: 'enemy' }),
      map: grappleMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: 'Enemy', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.spendsAction).toBe(false)
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed',
      targetId: 'enemy',
      reason: 'released',
    }))
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')
      ?.dnd5eCombatState?.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ id: 'basic-grapple' }),
      )
  })

  it('lets grapple or shove replace one Extra Attack instead of consuming another action', () => {
    const economy = createDnd5eTurnEconomyCounts('turn', 30)
    economy.attacksUsed = 1
    economy.action.current = 0
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'shove', targetTokenId: 'enemy', targetDefense: 'acrobatics', outcome: 'prone' }),
      map,
      characters: [{ ...hero, level: 5 }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: economy,
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({ spendsAction: false, attackNumber: 2 })
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 18, targetD20: 2 })
    expect(resolved.result.ok).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({ type: 'turn-resource-spent', resource: 'action' }))
  })

  it('moves a successfully shoved target exactly one legal grid square', () => {
    const elevatedMap = {
      ...map,
      tokens: map.tokens.map((token) => ({ ...token, elevationFeet: 20 })),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'shove', targetTokenId: 'enemy', targetDefense: 'athletics', outcome: 'push' }),
      map: elevatedMap, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.pushTo).toEqual({ x: 25, y: 5 })
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared, actorD20: 18, targetD20: 2,
      pushToElevationFeet: 0, fallingDamageRolls: [2, 4],
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')).toMatchObject({
      x: 25, y: 5, elevationFeet: 0, hp: 4,
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'moved', actorId: 'enemy', distance: 5,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'falling-damage-resolved', actorId: 'enemy', distanceFeet: 20, damage: 6,
    }))
  })

  it('keeps a shoved Feather Fall target aloft after the first 60 feet instead of resolving instant fall damage', () => {
    const featherFall = createDnd5eMechanicalEffect({
      definitionId: 'activity:srd-5.1:spell:feather-fall:modifiers:0',
      label: '羽落术',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'feather-fall', magical: true },
      targetId: 'enemy',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      modifiers: {
        safeFallFeet: 600,
        controlledDescent: { maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true },
      },
    })
    const cliffMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((token) => token.id === 'enemy'
        ? {
            ...token,
            elevationFeet: 100,
            groundElevationFeet: 0,
            airborne: true,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: [],
              activeEffects: [featherFall],
            },
          }
        : { ...token, elevationFeet: 100, groundElevationFeet: 100 }),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'shove', targetTokenId: 'enemy', targetDefense: 'athletics', outcome: 'push' }),
      map: cliffMap, characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 18,
      targetD20: 2,
      pushToElevationFeet: 0,
      pushToGroundElevationFeet: 0,
    })
    expect(resolved.result.ok, resolved.result.ok ? undefined : resolved.result.reason).toBe(true)
    if (!resolved.result.ok) return
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')).toMatchObject({
      x: 25,
      y: 5,
      elevationFeet: 40,
      groundElevationFeet: 0,
      airborne: true,
      hp: 10,
    })
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'controlled-descent-resolved', actorId: 'enemy', distanceFeet: 60, landed: false,
    }))
    expect(resolved.result.events.some((event) => event.type === 'falling-damage-resolved')).toBe(false)
  })

  it('asks the Host for the second d20 required by contest disadvantage', () => {
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'grapple', targetTokenId: 'enemy', targetDefense: 'athletics' }),
      map,
      characters: [{ ...hero, exhaustionLevel: 1 }],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared.actorRollMode).toBe('disadvantage')
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 18,
      actorD20Second: 1,
      targetD20: 10,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((token) => token.id === 'enemy')?.dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ standardCondition: 'grappled' }))
  })

  it('gives the DM a production path to trigger a readied action off-turn', () => {
    const readiedHero: Character = {
      ...hero,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [],
        readiedAction: {
          trigger: '敌人进入门口时', actionKind: 'attack', targetId: 'enemy',
          preparedTurnKey: 'combat:1:hero-token',
        },
      },
    }
    const result = triggerDnd5eReadiedAction({
      combatId: 'combat',
      round: 1,
      map,
      characters: [readiedHero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      actorTokenId: 'hero-token',
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.result.events).toContainEqual(expect.objectContaining({
      type: 'readied-action-triggered', actorId: 'hero-token', actionKind: 'attack', targetId: 'enemy',
    }))
    expect(result.application.characters[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  })

  it('routes waking a Sleep target through the authoritative basic-action bridge', () => {
    const sleepingMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['unconscious', 'prone'],
              activeEffects: [
                createDnd5eConditionEffect({
                  condition: 'unconscious',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'sleep' },
                  targetId: 'enemy',
                  duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
                  breakOn: ['takes-damage'],
                }),
                createDnd5eConditionEffect({
                  condition: 'prone',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'sleep-fall-prone' },
                  targetId: 'enemy',
                  duration: { type: 'permanent' },
                }),
              ],
            },
          }
        : entry),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'wake', targetTokenId: 'enemy' }),
      map: sleepingMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')?.dnd5eCombatState?.conditions)
      .not.toContain('unconscious')
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')?.dnd5eCombatState?.conditions)
      .toContain('prone')
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'sleeping-creature-awakened', actorId: 'hero-token', targetId: 'enemy', spellId: 'sleep',
    }))
  })

  it('routes shaking a Hypnotic Pattern target through the same authoritative wake action', () => {
    const hypnotizedMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? {
            ...entry,
            dnd5eCombatState: {
              schemaVersion: 2,
              conditions: ['charmed', 'incapacitated'],
              activeEffects: [
                createDnd5eConditionEffect({
                  id: 'hypnotic-pattern-charmed',
                  condition: 'charmed',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'hypnotic-pattern' },
                  targetId: 'enemy',
                  duration: {
                    type: 'concentration',
                    sourceActorId: 'wizard',
                    concentrationId: 'hypnotic-pattern',
                    remainingRounds: 10,
                  },
                  breakOn: ['takes-damage', 'awakened'],
                  removal: {
                    action: { label: '摇醒受术者', economy: 'action', maxDistanceFeet: 5 },
                  },
                }),
                createDnd5eConditionEffect({
                  id: 'hypnotic-pattern-incapacitated',
                  condition: 'incapacitated',
                  source: { kind: 'spell', actorId: 'wizard', rulesId: 'hypnotic-pattern' },
                  targetId: 'enemy',
                  duration: {
                    type: 'concentration',
                    sourceActorId: 'wizard',
                    concentrationId: 'hypnotic-pattern',
                    remainingRounds: 10,
                  },
                  dependsOnEffectId: 'hypnotic-pattern-charmed',
                  modifiers: { speedPenaltyFeet: 1_000 },
                }),
              ],
            },
          }
        : entry),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'wake', targetTokenId: 'enemy' }),
      map: hypnotizedMap,
      characters: [hero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.map.tokens.find((entry) => entry.id === 'enemy')?.dnd5eCombatState?.conditions)
      .not.toEqual(expect.arrayContaining(['charmed', 'incapacitated']))
    expect(resolved.result.events).toContainEqual({
      type: 'sleeping-creature-awakened',
      actorId: 'hero-token',
      targetId: 'enemy',
      sourceRulesIds: ['hypnotic-pattern'],
    })
  })

  it('routes an Entangle escape check through the authoritative basic-action bridge', () => {
    const restrainedHero: Character = {
      ...hero,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [
          createDnd5eConditionEffect({
            id: 'entangle-restraint',
            condition: 'restrained',
            source: { kind: 'spell', actorId: 'enemy', rulesId: 'entangle' },
            targetId: 'hero-token',
            duration: {
              type: 'concentration',
              sourceActorId: 'enemy',
              concentrationId: 'entangle',
              remainingRounds: 10,
            },
            escapeCheck: { ability: 'str', dc: 14, economy: 'action' },
          }),
        ],
        concentrationEffectsBySource: { enemy: 'entangle' },
      },
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'escape-effect' }),
      map,
      characters: [restrainedHero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      actorCheckAbility: 'str',
      escapeEffectId: 'entangle-restraint',
    })
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: 20,
    })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: 'entangle-restraint' }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      ability: 'str',
      dc: 14,
      success: true,
    }))
  })

  it('spends an action and authoritatively dismisses a rules-authored self effect', () => {
    const mirrorEffect = createDnd5eConditionEffect({
      id: 'mirror-image:hero',
      condition: 'invisible',
      source: { kind: 'spell', actorId: 'hero-token', rulesId: 'mirror-image' },
      targetId: 'hero-token',
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      removal: {
        action: { label: '解除镜影术', economy: 'action', maxDistanceFeet: 0 },
      },
    })
    const mirrorHero: Character = {
      ...hero,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [mirrorEffect] },
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'dismiss-effect', effectId: mirrorEffect.id }),
      map,
      characters: [mirrorHero],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      spendsAction: true,
      dismissEffectId: mirrorEffect.id,
    })

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(resolved.result.ok).toBe(true)
    expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: mirrorEffect.id }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action', amount: 1,
    }))
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-manually-removed',
      actorId: 'hero-token',
      targetId: 'hero-token',
      effectId: mirrorEffect.id,
      label: '解除镜影术',
      success: true,
    }))
  })

  it('lets the source spend an action to dismiss Warding Bond from its linked target', () => {
    const bond = createDnd5eMechanicalEffect({
      id: 'warding-bond:hero-token:ally-token',
      definitionId: 'srd-5.1:spell:warding-bond',
      label: '守护之链：AC与豁免+1，获得所有伤害抗性',
      kind: 'buff',
      source: { kind: 'spell', actorId: 'hero-token', characterId: 'hero', rulesId: 'warding-bond' },
      targetId: 'ally-token',
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' },
      modifiers: { armorClassBonus: 1, savingThrowBonus: 1, resistanceToAllDamage: true },
    })
    const equipRing = (owner: Character): Character => {
      const granted = applyDnd5eInventoryMutation([owner], {
        type: 'grant', characterId: owner.id,
        templateId: 'srd-5.1:item:platinum-ring-50gp', quantity: 1,
      })
      expect(granted.ok).toBe(true)
      const ring = normalizeDnd5eInventory(granted.characters[0]).entries.find((entry) =>
        entry.templateId === 'srd-5.1:item:platinum-ring-50gp')!
      const equipped = applyDnd5eInventoryMutation(granted.characters, {
        type: 'equip', characterId: owner.id, instanceId: ring.instanceId, slot: 'ring',
      })
      expect(equipped.ok).toBe(true)
      return equipped.characters[0]
    }
    const source = equipRing({
      ...hero,
    })
    const equippedAlly = equipRing({
      ...hero,
      id: 'ally',
      name: '盟友',
    })
    const ally: Character = {
      ...equippedAlly,
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [bond],
      },
    }
    const linkedMap: BattleMap = {
      ...map,
      tokens: [
        ...map.tokens,
        { id: 'ally-token', label: '盟友', characterId: 'ally', x: 25, y: 5, color: '', emoji: '', size: 1, type: 'player', hp: 30, maxHp: 30 },
      ],
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'dismiss-warding-bond' }),
      map: linkedMap,
      characters: [source, ally],
      initiativeOrder: [
        { tokenId: 'hero-token', label: '英雄', emoji: '', color: '', roll: 20 },
        { tokenId: 'ally-token', label: '盟友', emoji: '', color: '', roll: 15 },
        { tokenId: 'enemy', label: '敌人', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return

    const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared })
    expect(
      resolved.result.ok,
      resolved.result.ok ? undefined : `${resolved.result.reason}: ${JSON.stringify(resolved.result.events)}`,
    ).toBe(true)
    expect(resolved.application?.characters.find((character) => character.id === 'ally')
      ?.dnd5eCombatState?.activeEffects ?? []).not.toContainEqual(
        expect.objectContaining({ definitionId: 'srd-5.1:spell:warding-bond' }),
      )
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'turn-resource-spent', actorId: 'hero-token', resource: 'action', amount: 1,
    }))
  })

  it.each(['baseline', 'use', 'skip', 'wrong-source', 'low-level'] as const)(
    'routes a fixed-DC grapple and retained bonus through the ordinary escape bridge: %s', mode => {
    const sourceLinkedGrapple = createDnd5eConditionEffect({
      id: 'relation:grapple:enemy:bite:hero-token',
      condition: 'grappled',
      source: {
        kind: 'monster',
        actorId: 'enemy',
        rulesId: 'monster:srd-5.1:ankheg:bite:bite-grapple',
      },
      targetId: 'hero-token',
      duration: { type: 'permanent' },
      escapeCheck: {
        ability: 'str',
        skill: 'athletics',
        alternativeAbility: 'dex',
        alternativeSkill: 'acrobatics',
        dc: 13,
        economy: 'action',
      },
      relation: {
        schemaVersion: 1,
        kind: 'grapple',
        sourceActorId: 'enemy',
        sourceActionId: 'bite',
        slotGroup: 'bite',
        maxDistanceFeet: 5,
        movement: 'drag-target',
        endsOnSourceIncapacitated: true,
      },
      stackingKey: 'relation:grapple:enemy:bite:hero-token',
    })
    const acrobat: Character = {
      ...hero,
      abilities: { ...hero.abilities, str: 10, dex: 18 },
      skills: ['athletics', 'acrobatics'],
      dnd5eCombatState: {
        schemaVersion: 2,
        activeEffects: [sourceLinkedGrapple],
      },
    }
    const grappleMap: BattleMap = {
      ...map,
      tokens: map.tokens.map((entry) => entry.id === 'enemy'
        ? { ...entry, poolId: 'srd-5.1:ankheg', hp: 39, maxHp: 39 }
        : entry),
    }
    const prepared = prepareDnd5ePlayerBasicAction({
      action: request({ kind: 'escape-grapple', targetTokenId: 'enemy' }),
      map: grappleMap,
      characters: [acrobat],
      initiativeOrder: [
        { tokenId: 'hero-token', label: 'Hero', emoji: '', color: '', roll: 20 },
        { tokenId: 'enemy', label: 'Ankheg', emoji: '', color: '', roll: 10 },
      ],
      turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.prepared).toMatchObject({
      actorContestSkill: 'acrobatics',
      actorCheckAbility: 'dex',
      escapeEffectId: 'relation:grapple:enemy:bite:hero-token',
      targetDefense: undefined,
    })

    const actor = prepared.prepared.state.combatants['hero-token']
    actor.classLevels = { ranger: mode === 'low-level' ? 6 : 7 }
    if (mode !== 'baseline') actor.classState.activeEffects!.push(createDnd5eMechanicalEffect({
      id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: actor.id,
      source: { kind: 'feature', actorId: actor.id },
      modifiers: {
        onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary',
          appliesTo: 'all-weapon-attacks', doubleDiceOnCritical: true, oncePerTurn: true,
          consumeEffectOnHit: false, boundTargetId: mode === 'wrong-source' ? 'other' : 'enemy' },
        optionalBonusDie: { sides: 6, appliesTo: ['ability-check', 'saving-throw'], consumeOnUse: false,
          boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
      },
    }))
    const before = structuredClone(prepared.prepared.state)
    const resolved = resolvePreparedDnd5ePlayerBasicAction({
      prepared: prepared.prepared,
      actorD20: mode === 'baseline' ? 8 : 2,
      optionalBonusDice: mode === 'baseline' || mode === 'skip' ? undefined
        : [{ effectId: 'prey', targetId: actor.id, rollKind: 'ability-check', roll: 6 }],
    })
    expect(prepared.prepared.state).toEqual(before)
    if (mode === 'wrong-source' || mode === 'low-level') {
      expect(resolved.result.ok).toBe(false)
      expect(resolved.result.state).toEqual(before)
      expect(resolved.application).toBeUndefined()
      return
    }
    expect(resolved.result.ok).toBe(true)
    expect(resolved.result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved',
      actorId: 'hero-token',
      ability: 'dex',
      skill: 'acrobatics',
      dc: 13,
      total: mode === 'skip' ? 8 : 14,
      success: mode !== 'skip',
    }))
    expect(resolved.result.events).not.toContainEqual(expect.objectContaining({
      type: 'contest-resolved',
      contest: 'escape-grapple',
    }))
    if (mode === 'skip') expect(resolved.result.state.combatants[actor.id].classState.activeEffects)
      .toContainEqual(expect.objectContaining({ id: sourceLinkedGrapple.id }))
    else expect(resolved.application?.characters[0].dnd5eCombatState?.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({
        id: 'relation:grapple:enemy:bite:hero-token',
      }))
    if (mode === 'use') {
      expect(resolved.result.events).toContainEqual(expect.objectContaining({ type: 'optional-bonus-die-used', roll: 6 }))
      expect(resolved.result.state.combatants[actor.id].classState.activeEffects)
        .toContainEqual(expect.objectContaining({ id: 'prey' }))
    }
  })
})

it.each(['grapple', 'shove'] as const)('randomizes %s to a visible nearby ally outside initiative and settles once', kind => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:enemies', label: 'Enemies', targetId: 'hero-token',
    source: { kind: 'spell' }, modifiers: { perceiveVisibleCreaturesAsHostile: true, randomVisibleCreatureTargets: true } })
  const actor = { ...hero, dnd5eCombatState: { activeEffects: [effect] } }
  const ally = { ...map.tokens[1], id: 'ally', type: 'player' as const, x: 5, y: 15 }
  const hidden = { ...map.tokens[1], id: 'hidden', x: 15, y: 15, dnd5eCombatState: { activeEffects: [
    createDnd5eConditionEffect({ condition: 'invisible', targetId: 'hidden', source: { kind: 'dm' } })] } }
  const testMap = { ...map, tokens: [...map.tokens, ally, hidden, { ...map.tokens[1], id: 'far', x: 95 }] }
  let choices = 0
  const prepared = prepareDnd5eRandomTargetBasicAction({
    action: request(kind === 'grapple' ? { kind, targetTokenId: 'enemy', targetDefense: 'athletics' } : { kind, targetTokenId: 'enemy', outcome: 'prone', targetDefense: 'athletics' }),
    map: testMap, characters: [actor], initiativeOrder: map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })),
    turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    chooseRandomTarget: ids => { expect([...ids].sort()).toEqual(['ally', 'enemy']); choices++; return 'ally' },
  })
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  expect(choices).toBe(1)
  const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 20, targetD20: 1 })
  expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
  expect(resolved.result.state.combatants.ally.conditions).toContain(kind === 'grapple' ? 'grappled' : 'prone')
  expect(resolved.result.state.combatants.enemy.conditions).not.toContain(kind === 'grapple' ? 'grappled' : 'prone')
  expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
  expect(resolved.result.state.initiativeOrder).toEqual(['hero-token', 'enemy'])
})

it.each(['help', 'wake'] as const)('randomizes %s to a visible nearby ally outside initiative and settles once', kind => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:enemies', label: 'Enemies', targetId: 'hero-token',
    source: { kind: 'spell' }, modifiers: { perceiveVisibleCreaturesAsHostile: true, randomVisibleCreatureTargets: true } })
  const actor = { ...hero, dnd5eCombatState: { activeEffects: [effect] } }
  const ally = { ...map.tokens[1], id: 'ally', type: 'player' as const, x: 5, y: 15 }
  const hidden = { ...map.tokens[1], id: 'hidden', x: 15, y: 15, dnd5eCombatState: { activeEffects: [
    createDnd5eConditionEffect({ condition: 'invisible', targetId: 'hidden', source: { kind: 'dm' } })] } }
  const testMap = { ...map, tokens: [...map.tokens, ally, hidden, { ...map.tokens[1], id: 'far', x: 95 }].map(t =>
    kind === 'wake' && t.id !== 'hero-token' ? { ...t, dnd5eCombatState: { ...t.dnd5eCombatState, activeEffects: [
      ...(t.dnd5eCombatState?.activeEffects ?? []), createDnd5eConditionEffect({ condition: 'unconscious', targetId: t.id,
        source: { kind: 'spell', rulesId: 'sleep' }, breakOn: ['awakened'] })] } } : t) }
  let choices = 0
  const prepared = prepareDnd5eRandomTargetBasicAction({
    action: request(kind === 'wake' ? { kind, targetTokenId: 'enemy' } : { kind, targetTokenId: 'enemy', helpKind: 'attack' }),
    map: testMap, characters: [actor], initiativeOrder: map.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })),
    turnEconomy: createDnd5eTurnEconomyCounts('turn', 30),
    chooseRandomTarget: ids => { expect([...ids].sort()).toEqual(['ally', 'enemy']); choices++; return 'ally' },
  })
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  expect(choices).toBe(1)
  const resolved = resolvePreparedDnd5ePlayerBasicAction({ prepared: prepared.prepared, actorD20: 20, targetD20: 1 })
  expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
  if (kind === 'wake') expect(resolved.result.state.combatants.ally.conditions).not.toContain('unconscious')
  else expect(resolved.result.state.combatants.ally.classState.helpedAttackSourceId).toBe('hero-token')
  if (kind === 'wake') expect(resolved.result.state.combatants.enemy.conditions).toContain('unconscious')
  else expect(resolved.result.state.combatants.enemy.classState.helpedAttackSourceId).toBeUndefined()
  expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
  expect(resolved.result.state.initiativeOrder).toEqual(['hero-token', 'enemy'])
})

it.each(['removed', 'suspended', 'invalid-choice', 'pool-changed'] as const)('guards basic random targeting: %s', mode => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:enemies', label: 'Enemies', targetId: 'hero-token',
    source: { kind: 'spell' }, modifiers: { perceiveVisibleCreaturesAsHostile: true, randomVisibleCreatureTargets: true } })
  if (mode === 'suspended') effect.suspendedBy = ['antimagic']
  const actor = { ...hero, dnd5eCombatState: { activeEffects: mode === 'removed' ? [] : [effect] } }
  const before = JSON.stringify(actor)
  let calls = 0
  const result = prepareDnd5eRandomTargetBasicAction({ action: request({kind: 'grapple', targetTokenId: 'enemy', targetDefense: 'athletics'}),
    map, characters: [actor], initiativeOrder: map.tokens.map((t, i) => ({ tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i })),
    turnEconomy: createDnd5eTurnEconomyCounts('turn',30), chooseRandomTarget: () => {
      calls++; if (mode === 'pool-changed') throw Error('stale pool'); return 'not-a-candidate'
    } })
  expect(JSON.stringify(actor)).toBe(before)
  if (mode === 'removed' || mode === 'suspended') {
    expect(calls).toBe(0); expect(result.ok).toBe(true)
    if (result.ok) expect(result.prepared.payload).toMatchObject({targetTokenId:'enemy'})
  } else {
    expect(calls).toBe(1)
    expect(result).toEqual({ok:false,reason:mode === 'pool-changed'?'random-target-pool-changed':'random-target-unavailable'})
  }
})

it('randomizes ability-check Help among eligible visible allies and reuses the Host request checkpoint', () => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'test:enemies', label: 'Enemies', targetId: 'hero-token',
    source: { kind: 'spell' }, modifiers: { perceiveVisibleCreaturesAsHostile: true, randomVisibleCreatureTargets: true } })
  const actor = { ...hero, dnd5eCombatState: { activeEffects: [effect] } }
  const ally = { ...map.tokens[1], id: 'ally', type: 'player' as const, x: 5, y: 15 }
  const other = { ...ally, id: 'other', x: 15 }
  const testMap = { ...map, tokens: [...map.tokens, ally, other] }
  let draws = 0
  const input = { action: request({ kind: 'help', helpKind: 'ability-check', targetTokenId: 'ally' }),
    map: testMap, characters: [actor], initiativeOrder: map.tokens.map((t, i) => ({ tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i })),
    turnEconomy: createDnd5eTurnEconomyCounts('turn',30), chooseRandomTarget: (ids: readonly string[]) => {
      expect([...ids].sort()).toEqual(['ally','other'])
      return selectRandomCreatureTarget('basic-help-replay-test', ids, () => { draws++; return 1 })
    } }
  const first = prepareDnd5eRandomTargetBasicAction(input)
  expect(first.ok).toBe(true); if (!first.ok) throw Error(first.reason)
  const retry = prepareDnd5eRandomTargetBasicAction({...input,map:{...testMap,tokens:[...testMap.tokens].reverse()}})
  expect(retry.ok).toBe(true); if (!retry.ok) throw Error(retry.reason)
  expect(draws).toBe(1)
  expect(retry.prepared.payload).toEqual(first.prepared.payload)
  expect(first.prepared.payload).toMatchObject({targetTokenId:'other'})
  const resolved = resolvePreparedDnd5ePlayerBasicAction({prepared:first.prepared})
  expect(resolved.result.ok).toBe(true)
  expect(resolved.result.state.combatants.other.classState.helpedAbilityCheckSourceId).toBe('hero-token')
  expect(resolved.result.state.combatants.ally.classState.helpedAbilityCheckSourceId).toBeUndefined()
  expect(resolved.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
})


it('keeps qualified zero-HP basic actions and readied reactions usable with defeat controls', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({manifest:{id:'test.zero-basic',name:'Basic action',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
    featureId=api.registerFeature({id:'defer',name:'Defer',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{
      schemaVersion:1,id:'defer',name:'Defer',description:'Synthetic',level:1,trigger:{kind:'passive'},cost:{economy:'none'},targeting:{kind:'self'},effects:[],mechanic:{kind:'rage-death-deferral'},automation:'full',
    }})
  }})
  try {
    for (const mode of ['active','not-raging','unowned','dead','exhausted'] as const) {
      const effect=createDnd5eConditionEffect({id:'zero-basic-effect',condition:'invisible',targetId:'hero-token',
        source:{kind:'spell',actorId:'hero-token'},duration:{type:'permanent'},
        removal:{action:{label:'Dismiss',economy:'action',maxDistanceFeet:0}}})
      const actor:Character={...hero,currentHp:0,dnd5ePluginFeatureIds:mode==='unowned'?[]:[featureId],
        exhaustionLevel:mode==='exhausted'?6:0,
        dnd5eCombatState:{schemaVersion:2,raging:mode!=='not-raging',rageTurnsRemaining:5,
          ...(mode==='dead'?{deathRound:1}:{}),activeEffects:[effect],
          readiedAction:{trigger:'enemy enters',actionKind:'attack',targetId:'enemy',preparedTurnKey:'combat:1:hero-token'}}}
      const initiativeOrder=[{tokenId:'hero-token',label:'Hero',emoji:'',color:'',roll:20},{tokenId:'enemy',label:'Enemy',emoji:'',color:'',roll:10}]
      const input={action:request({kind:'dismiss-effect',effectId:effect.id}),map,characters:[actor],initiativeOrder,turnEconomy:createDnd5eTurnEconomyCounts('turn',30)}
      for (const exploration of [false,true]) {
        const prepared=prepareDnd5ePlayerBasicAction(exploration?{...input,action:{...input.action,combatId:undefined},initiativeOrder:[]}:input)
        expect(prepared.ok,`${mode}:${exploration}`).toBe(mode==='active')
        if(prepared.ok){
          const settled=resolvePreparedDnd5ePlayerBasicAction({prepared:prepared.prepared})
          expect(settled.result.ok).toBe(true)
          expect(settled.result.state.combatants['hero-token'].classState.activeEffects?.some(e=>e.id===effect.id) ?? false).toBe(false)
          expect(settled.result.state.combatants['hero-token'].currentHp).toBe(0)
        }
      }
      const triggered=triggerDnd5eReadiedAction({...input,combatId:'combat',round:1,actorTokenId:'hero-token'})
      expect(triggered.ok,mode).toBe(mode==='active')
      if(triggered.ok){
        expect(triggered.result.events).toContainEqual(expect.objectContaining({type:'readied-action-triggered',actorId:'hero-token'}))
        expect(triggered.result.state.combatants['hero-token'].turn.reactionAvailable).toBe(false)
      }
    }
  }finally{dispose()}
})
