import { prepareDnd5eRandomTargetFeatureAction } from './randomFeatureTargets'
import { prepareDnd5eRandomTargetBasicAction } from './randomBasicActionTargets'
import { it, expect, vi } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { DND5E_SHORTSWORD } from './equipment'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { prepareDnd5eEquipmentAttack, resolvePreparedDnd5eEquipmentAttack, resolvePreparedDnd5eEquipmentAttackLanding } from './equipmentAttackAction'
import type { BattleMap } from '../../store/maps'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { resolvePreparedDnd5ePlayerBasicAction, resolvePreparedDnd5eBasicActionLanding } from './playerBasicAction'
import { resolvePreparedDnd5ePluginFeatureLanding, resolvePreparedDnd5ePluginFeatureAction } from './pluginFeatureAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eAttackTeleportArrival } from './attackTeleportLanding'
import { replaceDnd5eCombatantActiveEffects, type Dnd5eActionResult } from './headlessCombatEngine'

function withArrivalArea(map: BattleMap): BattleMap {
  return { ...map, dnd5ePluginAreas: [{
    id: 'arrival-area', pluginId: 'audit', featureId: 'audit:area', label: 'Arrival',
    color: '#fff', sourceCharacterId: 'hero', sourceTokenId: 'hero-token',
    cells: [{ col: 2, row: 0 }], createdRound: 1, expiresAfterRound: 100, relation: 'any',
    triggerReceipts: [{ triggerId: 'enter', targetTokenId: 'hero-token', round: 1, transactionId: 'arrival' }],
  }] }
}

function verifyStagedArrival(
  prepared: Pick<Dnd5eAttackTeleportArrival, 'state' | 'map' | 'characters'>,
  stage: (arrival: Dnd5eAttackTeleportArrival, state: Dnd5eAttackTeleportArrival['state']) =>
    { result: Dnd5eActionResult; application?: { map: BattleMap }; preparedAfterLanding?: unknown },
) {
  const before = structuredClone(prepared.state)
  const state = structuredClone(prepared.state)
  state.combatants['hero-token'].position = { x: 75, y: 25 }
  state.combatants['hero-token'].elevationFeet = 0
  state.combatants['hero-token'].currentHp -= 1
  const arrival: Dnd5eAttackTeleportArrival = {
    state, map: withArrivalArea(prepared.map), characters: prepared.characters,
    events: [{ type: 'moved', actorId: 'hero-token', from: { x: 125, y: 25 },
      to: { x: 75, y: 25 }, fromElevationFeet: 10, toElevationFeet: 0, distance: 5, movementKind: 'forced' }],
  }
  const result = stage(arrival, prepared.state)
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants['hero-token']).toMatchObject({
    position: { x: 75, y: 25 }, elevationFeet: 0, currentHp: 43,
  })
  expect(result.result.events[0]).toMatchObject({ type: 'teleported', to: { x: 125, y: 25 }, toElevationFeet: 10 })
  expect(result.result.events[1]).toEqual(arrival.events[0])
  expect(result.application?.map.dnd5ePluginAreas).toEqual(arrival.map.dnd5ePluginAreas)
  // Supplying staged effects cannot authorize a forged original destination.
  const forged = structuredClone(prepared.state)
  forged.combatants['hero-token'].position.x = 75
  expect(stage(arrival, forged).result.ok).toBe(false)
  const exhausted = structuredClone(prepared.state)
  exhausted.combatants['hero-token'].elevationFeet = 0
  exhausted.combatants['hero-token'].turn.actionAvailable = false
  const stopped = stage({ ...arrival, state: exhausted, events: [{
    type: 'persistent-area-triggered', actorId: 'source', targetId: 'hero-token',
    areaId: 'arrival-area', triggerId: 'enter', timing: 'on-enter', damage: 0, actionConsumed: true,
  }] }, prepared.state)
  expect(stopped.result.ok).toBe(true)
  expect(stopped.preparedAfterLanding).toBeUndefined()
  expect(stopped.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
  expect(stopped.application?.map.tokens.find(token => token.id === 'hero-token')).toMatchObject({ x: 125, y: 25 })
  for (const inside of [false, true]) {
    const webState = structuredClone(prepared.state)
    webState.combatants['hero-token'].elevationFeet = 0
    webState.combatants.target.classState.concentrationSpellId = 'web'
    replaceDnd5eCombatantActiveEffects(webState.combatants['hero-token'], [{
      schemaVersion: 1, id: 'web-restraint', definitionId: 'srd-5.1:spell:web:restrained',
      label: 'Web', kind: 'condition', standardCondition: 'restrained',
      source: { kind: 'spell', actorId: 'target', rulesId: 'web', magical: true },
      appliedAt: 1, duration: { type: 'concentration', sourceActorId: 'target',
        concentrationId: 'web', remainingRounds: 600 },
      stackingKey: 'web:hero', stackingPolicy: 'replace',
    }])
    const webMap: BattleMap = { ...prepared.map, dnd5ePluginAreas: [{
      ...withArrivalArea(prepared.map).dnd5ePluginAreas![0],
      id: 'web-area', sourceKind: 'core-spell', coreSpellId: 'web', featureId: 'spell:web',
      pluginId: 'srd-5.1', sourceTokenId: 'target', sourceCharacterId: '',
      concentrationId: 'web', cells: [{ col: inside ? 2 : 0, row: 0 }], triggerReceipts: undefined,
    }] }
    const webResult = stage({ state: webState, map: webMap, characters: prepared.characters, events: [] }, prepared.state)
    expect(webResult.result.ok).toBe(true)
    expect(webResult.result.state.combatants['hero-token'].conditions.includes('restrained')).toBe(inside)
  }
  expect(prepared.state).toEqual(before)
  expect(arrival.state).toEqual(state)
}

it.each((['weapon', 'grapple', 'shove', 'activity'] as const).flatMap(kind =>
  (['attack', 'unconscious', 'out-of-reach'] as const).map(scenario => ({ kind, scenario }))))(
  'settles unsupported landing before $kind: $scenario', async ({ kind, scenario }) => {
  const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Landing order audit', version: '1.0.0',
    features: [{ id: 'step', name: 'Step', description: 'Synthetic', summary: 'Synthetic', automation: 'full',
      declarativeAbility: { schemaVersion: 1, id: 'step', name: 'Step', description: 'Synthetic', level: 1,
        trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } },
      { id: 'bolt', name: 'Bolt', description: 'Synthetic', summary: 'Synthetic', automation: 'full' }],
    activities: [{ schemaVersion: 1, id: 'bolt', name: 'Bolt', legacySource: { kind: 'feature', id: 'bolt' },
      usesAttackActionAttack: true, activation: { kind: 'free' },
      target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
      checks: [{ id: 'hit', kind: 'attack-roll', attackType: 'spell', delivery: 'melee',
        rollId: 'hit', rollMode: 'host-derived', attackBonus: { kind: 'constant', value: 5 }, scope: 'per-target' }],
      outcomes: [{ id: 'damage', when: { kind: 'check', checkId: 'hit', result: 'success' },
        operations: [{ id: 'damage', kind: 'damage', target: 'target', damageType: 'force', amount: { kind: 'constant', value: 1 } }] }],
      automation: automationCapabilityFromLegacyStatus('full') }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const actor = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '战士', level: 5,
      abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }, maxHp: 44, currentHp: scenario === 'unconscious' ? 2 : 44,
      equipment: { mainWeapon: DND5E_SHORTSWORD }, dnd5ePluginFeatureIds: [`${pkg.manifest.id}:step`, `${pkg.manifest.id}:bolt`] })
    const map: BattleMap = { id: 'landing-map', name: 'Landing', width: 500, height: 500, gridSize: 50,
      gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [
        { id: 'hero-token', type: 'player', characterId: actor.id, label: 'Hero', x: 25, y: 25, size: 1, color: '', emoji: '' },
        { id: 'target', type: 'enemy', label: 'Target', x: 175, y: 25, elevationFeet: scenario === 'out-of-reach' ? 20 : 0,
          size: 1, hp: 50, maxHp: 50, color: '', emoji: '' },
      ] }
    const action: SharedPlayerActionState = { id: 'landing', mapId: map.id, combatId: 'combat', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-weapon-attack', actorTokenId: 'hero-token', characterId: actor.id,
      targetTokenId: 'target', round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1,
      dnd5eWeaponAttackOptions: { attackActionTeleport: { targetCell: { col: 2, row: 0 }, elevationFeet: 10 } } }
    const initiativeOrder = map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20-index }))
    const settle = async (fallRolls?: Readonly<Record<string, readonly number[]>>) => {
      const shared = { map, characters: [actor], initiativeOrder,
        turnEconomy: createDnd5eTurnEconomyCounts('combat:1:hero-token') }
      if (kind === 'weapon') {
        const ready = prepareDnd5eEquipmentAttack({ ...shared, action, attacksUsed: 0 })
        if (!ready.ok) throw Error(ready.reason)
        const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now())
        try {
        const staged = resolvePreparedDnd5eEquipmentAttackLanding({ prepared: ready.prepared,
          airborneFallDamageRollsByCombatantId: fallRolls })
        expect(staged.result.events.some(event => event.type === 'attack-resolved')).toBe(false)
        if (!fallRolls) expect(staged.preparedAfterLanding).toBeUndefined()
        if (fallRolls && scenario === 'attack') {
          verifyStagedArrival(ready.prepared, (arrival, state) => resolvePreparedDnd5eEquipmentAttackLanding({
            prepared: { ...ready.prepared, state }, arrival,
          }))
          expect(staged.preparedAfterLanding?.attackMode).toBe('disadvantage')
          expect(staged.application).toBeUndefined()
          const resumed = resolvePreparedDnd5eEquipmentAttack({ prepared: staged.preparedAfterLanding!,
            d20: 18, d20Second: 2, damageRolls: [2] })
          const replay = resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 18, d20Second: 2,
            damageRolls: [2], airborneFallDamageRollsByCombatantId: fallRolls })
          expect(resumed).toEqual(replay)
          const withArea = resolvePreparedDnd5eEquipmentAttack({
            prepared: { ...staged.preparedAfterLanding!, map: withArrivalArea(staged.preparedAfterLanding!.map) },
            d20: 18, d20Second: 2, damageRolls: [2],
          })
          expect(withArea.application?.map.dnd5ePluginAreas).toEqual(withArrivalArea(map).dnd5ePluginAreas)
          expect(withArea.application?.tokenPatches?.['hero-token']).toMatchObject({ x: 125, y: 25 })
          expect(map.dnd5ePluginAreas).toBeUndefined()
          return resumed
        }
        return resolvePreparedDnd5eEquipmentAttack({ prepared: ready.prepared, d20: 18, d20Second: 2,
          damageRolls: [2], airborneFallDamageRollsByCombatantId: fallRolls })
        } finally { clock.mockRestore() }
      }
      if (kind === 'activity') {
        const ready = prepareDnd5eRandomTargetFeatureAction({ ...shared, chooseRandomTarget: (_occurrence, candidates) => candidates[0], action: { ...action, type: 'dnd5e-plugin-action',
          dnd5ePluginAction: { featureId: `${pkg.manifest.id}:bolt`,
            attackActionTeleport: action.dnd5eWeaponAttackOptions!.attackActionTeleport } } })
        if (!ready.ok) throw Error(ready.reason)
        expect(() => structuredClone(ready.prepared)).not.toThrow()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now())
        try {
          const staged = resolvePreparedDnd5ePluginFeatureLanding({ prepared: ready.prepared,
            airborneFallDamageRollsByCombatantId: fallRolls })
          expect(staged.result.events.some(event => event.type === 'attack-resolved')).toBe(false)
          if (!fallRolls) expect(staged.preparedAfterLanding).toBeUndefined()
          if (fallRolls && scenario === 'attack') {
            verifyStagedArrival(ready.prepared, (arrival, state) => resolvePreparedDnd5ePluginFeatureLanding({
              prepared: { ...ready.prepared, state }, arrival,
            }))
            expect(staged.preparedAfterLanding?.state.combatants['hero-token'].elevationFeet).toBe(0)
            expect(staged.application).toBeUndefined()
            const resumed = await resolvePreparedDnd5ePluginFeatureAction({ prepared: staged.preparedAfterLanding!, combatRevision: 1,
              rolls: { 'hit:target': { values: [18, 2], modifier: 0, total: 2 } } })
            const replay = await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared, combatRevision: 1,
              rolls: { 'hit:target': { values: [18, 2], modifier: 0, total: 2 } }, airborneFallDamageRollsByCombatantId: fallRolls })
            expect(resumed).toEqual(replay)
            const withArea = await resolvePreparedDnd5ePluginFeatureAction({
              prepared: { ...staged.preparedAfterLanding!, map: withArrivalArea(staged.preparedAfterLanding!.map) },
              combatRevision: 1, rolls: { 'hit:target': { values: [18, 2], modifier: 0, total: 2 } },
            })
            expect(withArea.application?.map.dnd5ePluginAreas).toEqual(withArrivalArea(map).dnd5ePluginAreas)
          expect(withArea.application?.tokenPatches?.['hero-token']).toMatchObject({ x: 125, y: 25 })
          expect(map.dnd5ePluginAreas).toBeUndefined()
            return resumed
          }
          return await resolvePreparedDnd5ePluginFeatureAction({ prepared: ready.prepared, combatRevision: 1,
            rolls: { 'hit:target': { values: [18, 2], modifier: 0, total: 2 } }, airborneFallDamageRollsByCombatantId: fallRolls })
        } finally { clock.mockRestore() }
      }
      const ready = prepareDnd5eRandomTargetBasicAction({ ...shared, chooseRandomTarget: candidates => candidates[0], action: { ...action, type: 'dnd5e-basic-action',
        dnd5eBasicAction: { kind, targetTokenId: 'target', targetDefense: 'athletics', outcome: 'prone',
          attackActionTeleport: action.dnd5eWeaponAttackOptions!.attackActionTeleport } } })
      if (!ready.ok) throw Error(ready.reason)
      expect(() => structuredClone(ready.prepared)).not.toThrow()
      const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now())
      try {
        const staged = resolvePreparedDnd5eBasicActionLanding({ prepared: ready.prepared,
          airborneFallDamageRollsByCombatantId: fallRolls })
        expect(staged.result.events.some(event => event.type === 'contest-resolved')).toBe(false)
        if (!fallRolls) expect(staged.preparedAfterLanding).toBeUndefined()
        if (fallRolls && scenario === 'attack') {
          verifyStagedArrival(ready.prepared, (arrival, state) => resolvePreparedDnd5eBasicActionLanding({
            prepared: { ...ready.prepared, state }, arrival,
          }))
          expect(staged.preparedAfterLanding?.state.combatants['hero-token'].elevationFeet).toBe(0)
          expect(staged.application).toBeUndefined()
          const resumed = resolvePreparedDnd5ePlayerBasicAction({ prepared: staged.preparedAfterLanding!, actorD20: 18, targetD20: 2 })
          const replay = resolvePreparedDnd5ePlayerBasicAction({ prepared: ready.prepared, actorD20: 18, targetD20: 2,
            airborneFallDamageRollsByCombatantId: fallRolls })
          // Each standalone basic-action invocation allocates its own transaction ID.
          expect(resumed.result.transaction?.status).toBe('committed')
          expect(replay.result.transaction?.status).toBe('committed')
          expect({ ...resumed, result: { ...resumed.result, transaction: undefined } })
            .toEqual({ ...replay, result: { ...replay.result, transaction: undefined } })
          const withArea = resolvePreparedDnd5ePlayerBasicAction({
            prepared: { ...staged.preparedAfterLanding!, map: withArrivalArea(staged.preparedAfterLanding!.map) },
            actorD20: 18, targetD20: 2,
          })
          expect(withArea.application?.map.dnd5ePluginAreas).toEqual(withArrivalArea(map).dnd5ePluginAreas)
          expect(withArea.application?.tokenPatches?.['hero-token']).toMatchObject({ x: 125, y: 25 })
          expect(map.dnd5ePluginAreas).toBeUndefined()
          return resumed
        }
        return resolvePreparedDnd5ePlayerBasicAction({ prepared: ready.prepared, actorD20: 18, targetD20: 2,
          airborneFallDamageRollsByCombatantId: fallRolls })
      } finally { clock.mockRestore() }
    }
    const preview = await settle()
    expect(preview.result.ok).toBe(false)
    expect(preview.application).toBeUndefined()
    expect(preview.airborneFalls).toContainEqual(expect.objectContaining({ combatantId: 'hero-token', fallingDamageDice: 1 }))
    const result = await settle({ 'hero-token': [3] })
    expect(result.result.ok).toBe(true)
    const attackType = kind === 'grapple' || kind === 'shove' ? 'contest-resolved' : 'attack-resolved'
    const attack = result.result.events.find(event => event.type === attackType)
    if (scenario === 'attack') {
      expect(attack).toBeDefined()
      if (kind === 'weapon' || kind === 'activity') expect(attack).toMatchObject({ d20: 2 })
      expect(result.result.events.findIndex(event => event.type === 'falling-damage-resolved'))
        .toBeLessThan(result.result.events.findIndex(event => event.type === attackType))
    } else {
      expect(attack).toBeUndefined()
      expect(result.result.state.combatants['hero-token'].turn.actionAvailable).toBe(false)
    }
    expect(result.result.state.combatants['hero-token'].elevationFeet).toBe(0)
    expect(result.result.state.combatants['hero-token'].currentHp).toBe(scenario === 'unconscious' ? 0 : 41)
    const landedToken = result.application?.map.tokens.find(token => token.id === 'hero-token')
    expect(landedToken).toMatchObject({ x: 125, y: 25 })
    expect(landedToken?.elevationFeet ?? 0).toBe(0)
    expect(map.tokens[0]).toMatchObject({ x: 25, y: 25 })
  } finally { dispose() }
})

