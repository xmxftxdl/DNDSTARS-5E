import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { createDnd5eMechanicalEffect } from '../activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { migrateMapsState } from '../../../store/maps'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import { expireDnd5ePluginAreasAtWorldMinute, reconcileDnd5ePluginAreasAndConcentrationOnMap } from '../pluginAreas'
import { authorizeDnd5eRemoteSensorPlacement, planDnd5eRemoteSensorPlacement } from '../remoteSensorPlacement'

let disposePlugin: (() => void) | undefined
afterEach(() => { disposePlugin?.(); disposePlugin = undefined; clearDnd5eActivityRegistryForTests() })

it.each(['registered', 'compiled'] as const)('starts independent spell-granted sensor concentration through %s and keeps its controller', async path => {
  const packageId = 'test.granted-sensor'
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'eyes', name: 'Eyes', activation: { kind: 'action' },
    invocation: { kind: 'active', confirmation: 'actor-choice' }, legacySource: { kind: 'spell', id: 'cage', magical: true },
    requiresEffectGrant: true, effectGrantChargeCost: 1, target: { kind: 'self' }, automation: automationCapabilityFromLegacyStatus('full'),
    consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
    outcomes: [{ id: 'sensor', when: { kind: 'always' }, operations: [{ id: 'sensor', kind: 'create-persistent-area', label: 'Sensor',
      durationRounds: 100, concentration: true, effectToken: { label: 'Sensor', hiddenBody: true, shareVisionWithSource: true, visionFromSource: true,
        remotePlacement: { memoryPrompt: 'Was this place seen in life?' } } }] }] }
  registerDnd5eActivityPackage({ packageId, packageVersion: '1.0.0', activities: [activity] })
  disposePlugin = registerDnd5eRulesPlugin({ manifest: { id: packageId, name: 'Sensor', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity))
    api.registerFeature({ id: 'cage', name: 'Cage', summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  const actor = createDnd5eCombatant({ id: 'owner', name: 'Owner', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, proficiencyBonus: 5,
    armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  actor.classState.activeEffects = [{ ...createDnd5eMechanicalEffect({ id: 'cage-instance', definitionId: 'cage', label: 'Cage', targetId: actor.id,
    source: { kind: 'spell', actorId: actor.id, rulesId: 'cage', pluginId: packageId }, modifiers: {},
    duration: { type: 'rounds', remainingRounds: 4800, tickOn: 'source-turn-end' } }),
    grantedActivities: ['eyes'], grantedActivityCharges: { current: 6, maximum: 6, endWhenEmpty: true } }]
  const opponent = createDnd5eCombatant({ id: 'opponent', name: 'Opponent', controller: 'dm', initiative: 10,
    abilities: actor.abilities, proficiencyBonus: 2, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0,
    speed: 30, position: { x: 30, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('sensor-concentration', [actor, opponent])
  const before = structuredClone(state)
  {
    const multiple = structuredClone(state)
    const original = multiple.combatants.owner.classState.activeEffects![0]
    multiple.combatants.owner.classState.activeEffects!.push({ ...structuredClone(original), id: 'second-cage' })
    const selected = path === 'registered'
      ? resolveRegisteredDnd5eActivityInCombatV1({ state: multiple, combatRevision: 0, confirmedBy: 'actor',
        command: { schemaVersion: 1, commandId: 'second-cage-eyes', actorId: actor.id, packageId, packageVersion: '1.0.0', activityId: activity.id,
          targetIds: [actor.id], expectedRevision: 0, grantEffectId: 'second-cage' }, authoritativeRolls: {} }).result
      : resolveDnd5eHeadlessAction(multiple, { type: 'plugin', pluginId: packageId, actionId: activity.id,
      featureId: `${packageId}:cage`, actorId: actor.id, targetId: actor.id, targetIds: [actor.id], rolls: {},
      hostEntitlement: { kind: 'active-effect', effectId: 'second-cage' }, transactionId: 'second-cage-eyes' })
    expect(selected.ok, JSON.stringify(selected)).toBe(true)
    if (!selected.ok || !('state' in selected)) throw Error('Selected grant failed')
    expect(selected.state.combatants.owner.classState.activeEffects?.find(effect => effect.id === 'cage-instance')?.grantedActivityCharges?.current).toBe(6)
    expect(selected.state.combatants.owner.classState.activeEffects?.find(effect => effect.id === 'second-cage')?.grantedActivityCharges?.current).toBe(5)
    expect(multiple.combatants.owner.classState.activeEffects?.map(effect => effect.grantedActivityCharges?.current)).toEqual([6, 6])
    if (path === 'registered') {
      for (const mode of ['missing', 'empty', 'suspended', 'wrong-package'] as const) {
        const invalid = structuredClone(multiple)
        const grant = invalid.combatants.owner.classState.activeEffects![1]
        if (mode === 'empty') grant.grantedActivityCharges!.current = 0
        if (mode === 'suspended') grant.suspendedBy = ['antimagic']
        if (mode === 'wrong-package') grant.source.pluginId = 'another.package'
        const originalInvalid = structuredClone(invalid)
        const denied = resolveRegisteredDnd5eActivityInCombatV1({ state: invalid, combatRevision: 0, confirmedBy: 'actor',
          command: { schemaVersion: 1, commandId: `denied-${mode}`, actorId: actor.id, packageId, packageVersion: '1.0.0', activityId: activity.id,
            targetIds: [actor.id], expectedRevision: 0, grantEffectId: mode === 'missing' ? 'absent' : 'second-cage' }, authoritativeRolls: {} }).result
        expect(denied).toMatchObject({ ok: false, reason: 'unauthorized-actor' })
        expect(invalid).toEqual(originalInvalid)
      }
    }
  }
  const result = path === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 0, confirmedBy: 'actor',
    command: { schemaVersion: 1, commandId: 'use-eyes', actorId: actor.id, packageId, packageVersion: '1.0.0', activityId: activity.id, targetIds: [actor.id], expectedRevision: 0 }, authoritativeRolls: {} }).result
    : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: packageId, actionId: activity.id, featureId: `${packageId}:cage`, actorId: actor.id,
      targetId: actor.id, targetIds: [actor.id], rolls: {}, hostEntitlement: { kind: 'active-effect', effectId: 'cage-instance' }, transactionId: 'use-eyes' })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok || !('state' in result)) throw Error('Expected sensor commit')
  expect(state).toEqual(before)
  const live = result.state.combatants.owner
  expect(live.concentrating).toBe(true)
  expect(live.classState.concentrationSpellId).toBe('activity:eyes')
  expect(live.classState.concentrationRoundsRemaining).toBe(100)
  expect(live.turn.actionAvailable).toBe(false)
  expect(live.classState.activeEffects?.find(effect => effect.id === 'cage-instance')?.grantedActivityCharges?.current).toBe(5)
  // Placement is a synthetic same-map fixture here. It checks the actual map
  // handoff and cleanup identity; it does not certify the remote-location UI.
  const map = migrateMapsState({ maps: [{ id: 'sensor-map', name: 'Sensor map', width: 500, height: 500, gridSize: 50,
    feetPerCell: 5, tokens: [{ id: actor.id, type: 'enemy', label: 'Owner', x: 25, y: 25, size: 1, emoji: '', color: '#fff',
      hp: 30, maxHp: 30, dnd5eCombatState: live.classState }] }] }).maps[0]
  const mapActivity: Dnd5eActivityDefinitionV1 = { ...activity,
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'circle', radiusFeet: 5, placeRangeFeet: 60 } }
  const selection = resolveDnd5eActivityAreaMapSelectionV1({ activity: mapActivity, map, actorToken: map.tokens[0], anchorCell: { col: 3, row: 3 } })!
  if (!('activityHandoffs' in result) || !result.activityHandoffs) throw Error('Missing sensor handoff')
  const placed = applyDnd5eActivityMapHandoffsV1({ map, activity: mapActivity, packageId, actionId: 'place-sensor', actorId: actor.id,
    round: state.round, worldMinute: 100, selection: {}, areaSelection: selection,
    handoffs: { ...result.activityHandoffs, persistentAreas: result.activityHandoffs.persistentAreas.map(area => ({ ...area,
      areaInstance: { ...selection.areaPlacement, origin: 'point', shape: 'circle' } })) } })
  expect(placed.ok, JSON.stringify(placed)).toBe(true)
  if (!placed.ok) throw Error('Sensor placement failed')
  const sensorId = placed.map.tokens.find(token => token.dnd5eSpellEffect)?.id
  expect(sensorId).toBeTruthy()
  const beforeMap = { ...map, dnd5ePlane: 'material', tokens: map.tokens.map(token => ({ ...token, dnd5eCombatState: state.combatants.owner.classState })) }
  const destination = { ...map, id: 'remote', dnd5ePlane: 'material', tokens: [] }
  const room = { maps: [beforeMap, destination], characters: [] }
  const roomBefore = structuredClone(room)
  const approved = await authorizeDnd5eRemoteSensorPlacement({ room,
    request: { actorMapId: map.id, actorTokenId: actor.id, packageId, activityId: activity.id, actionId: 'remote-eyes',
      location: { mapId: destination.id, col: 3, row: 3, elevationFeet: 0 } }, confirmMemory: async () => true })
  if (!approved.ok) throw Error(approved.reason)
  const planInput = { room, receipt: approved.receipt, activity, round: state.round, worldMinute: 100,
    handoffs: result.activityHandoffs, sourceApplication: { map: { ...map, dnd5ePlane: 'material' }, characters: [], changedCharacterIds: [], changedTokenIds: [actor.id] } }
  const remote = planDnd5eRemoteSensorPlacement(planInput)
  expect(remote.ok, JSON.stringify(remote)).toBe(true)
  if (!remote.ok) throw Error(remote.reason)
  expect(room).toEqual(roomBefore)
  expect(remote.applications).toHaveLength(2)
  expect(remote.applications[0].map.tokens[0]).toMatchObject({ id: actor.id, x: 25, y: 25 })
  expect(remote.applications[0].map.tokens[0].dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'cage-instance')?.grantedActivityCharges?.current).toBe(5)
  expect(remote.applications[1].map.tokens).toHaveLength(1)
  expect(remote.applications[1].map.tokens[0]).toMatchObject({ x: 175, y: 175, dnd5eSpellEffect: { sourceTokenId: actor.id, concentrationId: 'activity:eyes' } })
  // Multiple cages must project the identity from the exact authorized grant,
  // including when the last charge removed that grant from the pending result.
  const multiRoom = structuredClone(room)
  const controller = multiRoom.maps[0].tokens[0].dnd5eCombatState!.activeEffects![0]
  multiRoom.maps[0].tokens[0].dnd5eCombatState!.activeEffects = ['first', 'second'].map(id => ({
    ...controller, id, linkedTargetSnapshots: [{ actorId: `captive-${id}`, effectId: `bound-${id}`, name: id,
      presentation: { emoji: id === 'first' ? 'A' : 'B', color: '#fff', size: 1 } }],
  }))
  const projectionActivity = structuredClone(activity)
  const projectionOperation = projectionActivity.outcomes[0].operations[0]
  if (projectionOperation.kind !== 'create-persistent-area' || !projectionOperation.effectToken) throw Error('Missing effect token')
  projectionOperation.effectToken.linkedTargetProjection = true
  const multiBefore = structuredClone(multiRoom)
  for (const grantEffectId of ['first', 'second', 'missing', undefined]) {
    const authorization = await authorizeDnd5eRemoteSensorPlacement({ room: multiRoom,
      request: { ...approved.receipt.request, grantEffectId }, confirmMemory: async () => true })
    if (!authorization.ok) throw Error(authorization.reason)
    const projected = planDnd5eRemoteSensorPlacement({ ...planInput, room: multiRoom,
      activity: projectionActivity, receipt: authorization.receipt })
    if (grantEffectId === 'first' || grantEffectId === 'second') {
      expect(projected.ok, JSON.stringify(projected)).toBe(true)
      if (!projected.ok) throw Error(projected.reason)
      expect(projected.applications[1].map.tokens[0].dnd5eSpellEffect?.linkedTargetProjection)
        .toMatchObject({ name: grantEffectId, presentation: { emoji: grantEffectId === 'first' ? 'A' : 'B' } })
    } else expect(projected).toEqual({ ok: false, reason: 'sensor-linked-target-ambiguous' })
    expect(multiRoom).toEqual(multiBefore)
  }
  let nextTurn = result.state
  for (let index = 0; index < 2; index++) {
    const advance = resolveDnd5eHeadlessAction(nextTurn, { type: 'end-turn', actorId: nextTurn.initiativeOrder[nextTurn.initiativeIndex] })
    expect(advance.ok).toBe(true); nextTurn = advance.state
  }
  const second = path === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state: nextTurn, combatRevision: 0, confirmedBy: 'actor',
    command: { schemaVersion: 1, commandId: 'replace-eyes', actorId: actor.id, packageId, packageVersion: '1.0.0', activityId: activity.id, targetIds: [actor.id], expectedRevision: 0 }, authoritativeRolls: {} }).result
    : resolveDnd5eHeadlessAction(nextTurn, { type: 'plugin', pluginId: packageId, actionId: activity.id, featureId: `${packageId}:cage`, actorId: actor.id,
      targetId: actor.id, targetIds: [actor.id], rolls: {}, hostEntitlement: { kind: 'active-effect', effectId: 'cage-instance' }, transactionId: 'replace-eyes' })
  if (!second.ok || !('state' in second) || !('activityHandoffs' in second) || !second.activityHandoffs) throw Error(JSON.stringify(second))
  expect(second.state.combatants.owner.classState.activeEffects?.find(effect => effect.id === 'cage-instance')?.grantedActivityCharges?.current).toBe(4)
  expect(second.state.combatants.owner.turn.actionAvailable).toBe(false)
  const oldLocation = remote.applications[1].map
  const otherSensor = { ...oldLocation.tokens[0], id: 'other-sensor', dnd5eSpellEffect: { ...oldLocation.tokens[0].dnd5eSpellEffect!, sourceTokenId: 'other-owner', sourceCharacterId: 'other-character' } }
  const otherArea = { ...oldLocation.dnd5ePluginAreas![0], id: 'other-area', anchorTokenId: otherSensor.id, sourceTokenId: 'other-owner', sourceCharacterId: 'other-character' }
  const replacementRoom = { maps: [remote.applications[0].map, { ...oldLocation, tokens: [...oldLocation.tokens, otherSensor], dnd5ePluginAreas: [...oldLocation.dnd5ePluginAreas!, otherArea] }, { ...destination, id: 'new-location' }], characters: [] }
  const replacementBefore = structuredClone(replacementRoom)
  const receipt = await authorizeDnd5eRemoteSensorPlacement({ room: replacementRoom,
    request: { ...approved.receipt.request, actionId: 'replace-eyes', location: { mapId: 'new-location', col: 4, row: 4, elevationFeet: 0 } }, confirmMemory: async () => true })
  if (!receipt.ok) throw Error(receipt.reason)
  const replacement = planDnd5eRemoteSensorPlacement({ ...planInput, room: replacementRoom, receipt: receipt.receipt, round: second.state.round, worldMinute: 101,
    handoffs: second.activityHandoffs, sourceApplication: { ...remote.applications[0], map: { ...remote.applications[0].map,
      tokens: remote.applications[0].map.tokens.map(token => token.id === actor.id ? { ...token, dnd5eCombatState: second.state.combatants.owner.classState } : token) } } })
  if (!replacement.ok) throw Error(replacement.reason)
  expect(replacementRoom).toEqual(replacementBefore)
  expect(replacement.applications).toHaveLength(3)
  expect(replacement.applications.find(entry => entry.map.id === oldLocation.id)?.map.tokens).toEqual([otherSensor])
  expect(replacement.applications.find(entry => entry.map.id === oldLocation.id)?.map.dnd5ePluginAreas).toEqual([otherArea])
  expect(replacement.applications.find(entry => entry.map.id === 'new-location')?.map.tokens[0]).toMatchObject({ x: 225, y: 225 })
  expect(replacement.applications.find(entry => entry.map.id === 'new-location')?.map.dnd5ePluginAreas?.[0].expiresAtWorldMinute).toBe(111)
  for (const destinationId of [oldLocation.id, map.id]) {
    const sameRoomReceipt = await authorizeDnd5eRemoteSensorPlacement({ room: replacementRoom,
      request: { ...approved.receipt.request, actionId: `replace-${destinationId}`, location: { mapId: destinationId, col: 4, row: 4, elevationFeet: 0 } }, confirmMemory: async () => true })
    if (!sameRoomReceipt.ok) throw Error(sameRoomReceipt.reason)
    const sameRoomPlan = planDnd5eRemoteSensorPlacement({ ...planInput, room: replacementRoom, receipt: sameRoomReceipt.receipt,
      handoffs: second.activityHandoffs, worldMinute: 101, sourceApplication: replacement.applications[0] })
    if (!sameRoomPlan.ok) throw Error(sameRoomPlan.reason)
    expect(sameRoomPlan.applications).toHaveLength(2)
    expect(sameRoomPlan.applications.flatMap(entry => entry.map.tokens).some(token => token.id === oldLocation.tokens[0].id)).toBe(false)
    expect(sameRoomPlan.applications.find(entry => entry.map.id === destinationId)?.map.tokens.some(token => token.dnd5eSpellEffect?.sourceTokenId === actor.id && token.x === 225 && token.y === 225)).toBe(true)
    expect(sameRoomPlan.applications[0].map.tokens.find(token => token.id === actor.id)).toMatchObject({ x: 25, y: 25 })
    expect(replacementRoom).toEqual(replacementBefore)
  }
  expect(planDnd5eRemoteSensorPlacement({ ...planInput, receipt: JSON.parse(JSON.stringify(approved.receipt)) })).toMatchObject({ ok: false })
  room.maps[1] = { ...destination, dnd5ePlane: 'other' }
  expect(planDnd5eRemoteSensorPlacement(planInput)).toMatchObject({ ok: false, reason: 'sensor-placement-conflict' })
  expect(placed.map.dnd5ePluginAreas?.[0].expiresAtWorldMinute).toBe(110)
  expect(reconcileDnd5ePluginAreasAndConcentrationOnMap(placed.map, [], state.round).map.tokens.some(token => token.id === sensorId)).toBe(true)
  const clockMap = JSON.parse(JSON.stringify(placed.map)) as typeof map
  expect(expireDnd5ePluginAreasAtWorldMinute(clockMap, 109).tokens.some(token => token.id === sensorId)).toBe(true)
  const clockExpired = reconcileDnd5ePluginAreasAndConcentrationOnMap(clockMap, [], state.round,
    expireDnd5ePluginAreasAtWorldMinute(clockMap, 110)).map
  expect(clockExpired.tokens.some(token => token.id === sensorId)).toBe(false)
  expect(clockExpired.tokens.find(token => token.id === actor.id)?.dnd5eCombatState?.concentrationSpellId).toBeUndefined()
  expect(clockExpired.tokens.find(token => token.id === actor.id)?.dnd5eCombatState?.activeEffects?.find(effect => effect.id === 'cage-instance')?.grantedActivityCharges?.current).toBe(5)
  const failedSave = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(result.state)), { type: 'concentration-save', actorId: actor.id, d20: 1, dc: 10 })
  expect(failedSave.ok).toBe(true)
  expect(failedSave.state.combatants.owner.concentrating).toBe(false)
  expect(failedSave.state.combatants.owner.classState.activeEffects?.find(effect => effect.id === 'cage-instance')?.grantedActivityCharges?.current).toBe(5)
  let timed = JSON.parse(JSON.stringify(result.state)) as typeof state
  // The creation turn is not a completed round of duration. Thereafter the
  // ordinary turn engine must expire 100 rounds without ticking the cage out.
  for (let boundary = 0; boundary <= 200; boundary++) {
    const advance = resolveDnd5eHeadlessAction(timed, { type: 'end-turn', actorId: timed.initiativeOrder[timed.initiativeIndex] })
    expect(advance.ok).toBe(true)
    timed = advance.state
    expect(timed.combatants.owner.concentrating, `boundary ${boundary}`).toBe(boundary < 200)
  }
  expect(timed.combatants.owner.classState.concentrationSpellId).toBeUndefined()
  expect(timed.combatants.owner.classState.activeEffects?.find(effect => effect.id === 'cage-instance'))
    .toMatchObject({ grantedActivityCharges: { current: 5 }, duration: { type: 'rounds', remainingRounds: 4699 } })
  for (const ended of [failedSave.state, timed]) {
    const endedMap = { ...placed.map, tokens: placed.map.tokens.map(token => token.id === actor.id
      ? { ...token, dnd5eCombatState: ended.combatants.owner.classState } : token) }
    const cleaned = reconcileDnd5ePluginAreasAndConcentrationOnMap(endedMap, [], ended.round).map
    expect(cleaned.tokens.some(token => token.id === sensorId)).toBe(false)
    expect(cleaned.dnd5ePluginAreas ?? []).toHaveLength(0)
    expect(cleaned.tokens.find(token => token.id === actor.id)?.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'cage-instance')).toBe(true)
  }
})
