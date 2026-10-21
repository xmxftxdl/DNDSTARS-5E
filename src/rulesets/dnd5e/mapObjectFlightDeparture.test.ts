import { expect, it, vi } from 'vitest'
import { publishDnd5eObjectFlightArrival } from '../../pages/maps/publishObjectFlightArrival'
import { settleDnd5eObjectFlightArrival } from '../../pages/maps/settleObjectFlightArrival'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution } from './headlessCombatEngine'
import { resolveDnd5eObjectFlightArrival, planDnd5eObjectFlightArrivalTransaction } from './mapObjectFlightArrivalSettlement'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
import { migrateMapsState, mergePlayerTokenCombatFields, type BattleMap } from '../../store/maps'
import { captureDnd5eObjectFlightDeparture, normalizeDnd5eObjectFlightDeparture,
  normalizeDnd5eObjectFlightDepartures, planDnd5eObjectFlightArrival, completeDnd5eObjectFlightDeparture } from './mapObjectFlightDeparture'

const fixture = (): BattleMap => ({ id: 'source', name: 'Source', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
  gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [
    { id: 'stone', label: 'Stone', type: 'obstacle', x: 125, y: 75, elevationFeet: 10, size: 1, emoji: '', color: '', hp: 20, maxHp: 20, dnd5eObjectState: { schemaVersion: 1, weightPounds: 5 } },
    { id: 'saved', label: 'Saved', type: 'enemy', x: 225, y: 75, elevationFeet: 10, size: 1, emoji: '', color: '' },
  ] })
const capture = (map = fixture(), successfulTargetIds = ['saved']) => captureDnd5eObjectFlightDeparture({ map, objectId: 'stone',
  limits: { minimumWeightPounds: 1, maximumWeightPounds: 5, additionalWeightPoundsPerSlot: 5, baseSlotLevel: 1, distanceFeet: 90 },
  slotLevel: 1, angleDegrees: 0, actionId: 'cast', operationId: 'launch', actorId: 'mage', packageId: 'module', activityId: 'catapult',
  saveDc: 15, saveAbility: 'dex', damage: 6, damageType: 'bludgeoning', successfulTargetIds })

it.each([false, true])('persists a source-scene effect ended by arrival damage (character-bound: %s)', characterBound => {
  const entry = capture()!
  const effect = createDnd5eMechanicalEffect({ id: 'bound', definitionId: 'test:bound', label: 'Bound',
    source: { kind: 'feature', actorId: 'victim' }, targetId: 'mage', breakOn: ['source-dies'],
    duration: { type: 'permanent' }, modifiers: { armorClassBonus: 1 } })
  const casterToken = { ...fixture().tokens[1], id: 'mage', x: 25, hp: 30, maxHp: 30,
    characterId: characterBound ? 'mage-character' : undefined,
    dnd5eCombatState: { schemaVersion: 2 as const, activeEffects: [effect] } }
  const sourceMap = { ...fixture(), tokens: [casterToken], dnd5eObjectFlightDepartures: [entry] }
  const destinationMap = { ...fixture(), id: 'arrival', width: 2000,
    tokens: [{ ...fixture().tokens[1], id: 'victim', hp: 3, maxHp: 30 }] }
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: id === 'victim' ? 3 : 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: id === 'victim' ? 225 : 25, y: 75 }, elevationFeet: 10, concentrating: false })
  const state = startDnd5eHeadlessCombat('arrival', [make('mage'), make('victim')])
  state.combatants.mage.classState.activeEffects = [effect]
  state.combatants.victim.usesDeathSaves = false
  const input = { sourceMap, destinationMap, receiptId: entry.id, settlementId: 'source-lifecycle',
    point: { x: 75, y: 75, elevationFeet: 10 }, state, rolls: { 'save:victim': { values: [1], modifier: 0, total: 1 } },
    characters: characterBound ? [normalizeCharacter({ id: 'mage-character', name: 'Mage', currentHp: 30, maxHp: 30,
      dnd5eCombatState: { schemaVersion: 2, activeEffects: [effect] } })] : [],
    characterIdByCombatantId: (characterBound ? { mage: 'mage-character' } : {}) as Record<string, string> }
  const result = planDnd5eObjectFlightArrivalTransaction(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) {
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', targetId: 'mage', effectId: 'bound' }))
    expect(result.sourceMap.tokens[0].dnd5eCombatState?.activeEffects ?? []).toEqual([])
    if (characterBound) expect(result.characters[0].dnd5eCombatState?.activeEffects ?? []).toEqual([])
    expect(result.destinationMap.tokens.find(token => token.id === 'victim')?.hp).toBe(0)
    expect(result.sourceMap.tokens[0].x).toBe(25)
    expect(result.completedReceipt.status).toBe('completed')
  }
  expect(sourceMap.tokens[0].dnd5eCombatState.activeEffects).toEqual([effect])
  expect(planDnd5eObjectFlightArrivalTransaction({ ...input, sourceMap: { ...sourceMap, tokens: [] } })).toMatchObject({
    ok: false, reason: 'flight-changed-participant-map-missing',
  })
})

it('captures exact remaining flight, unchanged projectile and frozen result without inventing edge damage', () => {
  const map = fixture(), before = structuredClone(map), entry = capture(map)!
  expect(entry).toMatchObject({ departure: { x: 500, y: 75, elevationFeet: 10 }, damage: 6, saveDc: 15, status: 'pending' })
  expect(entry.remainingFeet).toBeCloseTo(52.5, 8)
  expect(entry.object.hp).toBe(20)
  expect(entry.object).not.toBe(map.tokens[0])
  expect(map).toEqual(before)
  expect(capture(map, [])).toBeUndefined()
  expect(capture(map, ['saved', 'invented'])).toBeUndefined()
  map.width = 2000
  expect(capture(map)).toBeUndefined()
})

it('preserves pending receipts through map JSON migration and authoritative player merge', () => {
  const entry = capture()!, source = { ...fixture(), dnd5eObjectFlightDepartures: [entry] }
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [source], selectedId: source.id }))).maps[0]
  expect(restored.dnd5eObjectFlightDepartures).toEqual([entry])
  expect(mergePlayerTokenCombatFields([fixture()], [restored])[0].dnd5eObjectFlightDepartures).toEqual([entry])
  expect(mergePlayerTokenCombatFields([restored], [fixture()])[0].dnd5eObjectFlightDepartures).toBeUndefined()
})

it('keeps full departure receipts Host-only in player projection, including maps with no token array', () => {
  const entry = capture()!, maps = [
    { ...fixture(), dnd5eObjectFlightDepartures: [entry] },
    { id: 'metadata-only', dnd5eObjectFlightDepartures: [entry] },
  ]
  const before = structuredClone(maps)
  const projected = projectMapsForPlayer({ maps }, { maps: [] })
  expect(projected.maps.every((map: Record<string, unknown>) => !('dnd5eObjectFlightDepartures' in map))).toBe(true)
  expect(JSON.stringify(projected)).not.toContain('object-flight:cast:launch')
  expect(maps).toEqual(before)
})

it('continues in a differently scaled scene without repeating saves or increasing distance/damage', () => {
  const entry = capture()!, map = fixture(); map.id = 'destination'; map.width = 2000; map.feetPerCell = 10
  map.tokens = [map.tokens[1], { ...map.tokens[1], id: 'new', x: 300 }]
  const before = structuredClone(map)
  const arrival = planDnd5eObjectFlightArrival({ entry, map, point: { x: 50, y: 75, elevationFeet: 10 } })!
  expect(arrival.plan.to.x).toBeCloseTo(312.5, 8)
  expect(arrival.plan.creatures.map(t => t.tokenId)).toEqual(['new'])
  expect(arrival).toMatchObject({ damage: 6, damageType: 'bludgeoning', saveDc: 15, saveAbility: 'dex' })
  expect(map).toEqual(before)
  expect(entry.status).toBe('pending')
})

it('completed receipts cannot resume, allow exact replay and reject conflicting completion identities', () => {
  const entry = capture()!, completed = completeDnd5eObjectFlightDeparture(entry, 'settled')!
  expect(completeDnd5eObjectFlightDeparture(completed, 'settled')).toEqual(completed)
  expect(completeDnd5eObjectFlightDeparture(completed, 'different')).toBeUndefined()
  const map = fixture(); map.tokens = []
  expect(planDnd5eObjectFlightArrival({ entry: completed, map, point: { x: 0, y: 0, elevationFeet: 0 } })).toBeUndefined()
  expect(planDnd5eObjectFlightArrival({ entry, map: fixture(), point: { x: 0, y: 0, elevationFeet: 0 } })).toBeUndefined()
  expect(planDnd5eObjectFlightArrival({ entry, map, point: { x: 0, y: 0, elevationFeet: NaN } })).toBeUndefined()
})

it('rejects malformed, duplicated, unsafe or unfunded continuation data', () => {
  const entry = capture()!
  for (const patch of [{ remainingFeet: 91 }, { remainingFeet: -1 }, { damage: NaN }, { saveDc: 0 }, { saveAbility: 'guess' },
    { status: 'pending', settlementId: 'already-settled' }, { status: 'completed' }, { pitchDegrees: 91 },
    { successfulTargetIds: ['same', 'same'] }, { object: { ...entry.object, dnd5eObjectState: { schemaVersion: 1, weightPounds: 50 } } }]) {
    expect(normalizeDnd5eObjectFlightDeparture({ ...entry, ...patch })).toBeUndefined()
  }
  expect(normalizeDnd5eObjectFlightDepartures([entry, entry])).toBeUndefined()
  expect(normalizeDnd5eObjectFlightDepartures([entry, { invalid: true }])).toBeUndefined()
})

it.each([true, false].flatMap(active => ['normal', 'resistance', 'immunity'].map(defense => ({ active, defense }))))('resolves the saved flight through Headless without spending resources: %j', async ({ active, defense }) => {
  const entry = capture()!, sourceMap = { ...fixture(), dnd5eObjectFlightDepartures: [entry] }
  const destinationMap = fixture(); destinationMap.id = 'arrival'; destinationMap.width = 2000
  destinationMap.tokens = [
    { ...destinationMap.tokens[1], id: 'first', x: 225 },
    { ...destinationMap.tokens[1], id: 'second', x: 325 },
    { ...destinationMap.tokens[1], id: 'later', x: 425 },
  ]
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: { x: id === 'mage' ? 25 : destinationMap.tokens.find(t => t.id === id)!.x, y: 75 }, elevationFeet: 10, concentrating: false })
  const state = startDnd5eHeadlessCombat('arrival', ['mage', 'first', 'second', 'later'].map(make))
  state.active = active
  state.combatants.mage.currentHp = active ? 30 : 0
  state.combatants.mage.turn.actionAvailable = false
  state.combatants.mage.classResources = { 'dnd5e-spell-slot-1': { current: 0, max: 2 } }
  if (defense === 'resistance') state.combatants.second.damageResistances = ['bludgeoning']
  if (defense === 'immunity') state.combatants.second.damageImmunities = ['bludgeoning']
  const before = structuredClone({ state, sourceMap, destinationMap })
  const input = { sourceMap, receiptId: entry.id, destinationMap, state, point: { x: 75, y: 75, elevationFeet: 10 },
    rolls: { 'save:first': { values: [20], modifier: 0, total: 20 }, 'save:second': { values: [1], modifier: 0, total: 1 } } }
  const result = resolveDnd5eObjectFlightArrival(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) {
    expect(validateDnd5eActivityDefinitionV1(result.activity)).toEqual([])
    expect(result.resolution.consumptions).toEqual([])
    expect(result.resolution.checks.map(check => check.targetId)).toEqual(['first', 'second'])
    expect(result.committed.state.combatants.first.currentHp).toBe(30)
    expect(result.committed.state.combatants.second.currentHp).toBe(defense === 'normal' ? 24 : defense === 'resistance' ? 27 : 30)
    expect(result.committed.state.combatants.later.currentHp).toBe(30)
    expect(result.committed.state.combatants.mage.classResources).toEqual(state.combatants.mage.classResources)
    expect(result.committed.state.combatants.mage.turn.actionAvailable).toBe(false)
    expect(result.committed.activityHandoffs?.mapObjectLaunches?.[0]).toMatchObject({ amount: 6, impactTargetId: 'second' })
    if (!active) expect(commitDnd5eActivityExecution(state, { actorId: 'mage', activityId: entry.activityId, targetIds: ['first', 'second', 'later'], resolution: result.resolution }).ok).toBe(false)
    expect(commitDnd5eActivityExecution(state, { actorId: 'mage', activityId: entry.activityId, targetIds: ['first', 'second', 'later'],
      allowObjectFlightContinuationCommit: true, resolution: { ...result.resolution,
        proposals: [...result.resolution.proposals, { kind: 'grant-temporary-hit-points', operationId: 'illegal', targetId: 'mage', amount: 1 }] } }).ok).toBe(false)
  }
  expect(resolveDnd5eObjectFlightArrival({ ...input, rolls: {} }).ok).toBe(false)
  expect(resolveDnd5eObjectFlightArrival({ ...input, receiptId: 'forged' }).ok).toBe(false)
  const resistantState = structuredClone(state)
  resistantState.combatants.first.magicResistance = true
  const advantage = resolveDnd5eObjectFlightArrival({ ...input, state: resistantState,
    rolls: { ...input.rolls, 'save:first': { values: [1, 20] } } })
  expect(advantage.ok, JSON.stringify(advantage)).toBe(true)
  if (advantage.ok) expect(advantage.resolution.checks[0]).toMatchObject({ targetId: 'first', success: true })
  const transactionInput = { ...input, sourceMap: { ...sourceMap, tokens: sourceMap.tokens.filter(t => t.id !== entry.object.id) },
    settlementId: 'arrival-1', characters: [], characterIdByCombatantId: {} }
  const transaction = planDnd5eObjectFlightArrivalTransaction(transactionInput)
  if (defense === 'normal') {
    const focused = structuredClone(transactionInput)
    focused.state.combatants.second.concentrating = true
    const baseline = structuredClone(focused)
    for (const d20 of [1, 20]) {
      const rollD20 = vi.fn(async () => d20)
      const settled = await settleDnd5eObjectFlightArrival(focused, {
        rollD20, rollD4: async () => { throw Error('Unexpected d4') },
        rollDice: async () => { throw Error('Projectile damage must not roll again') },
      })
      expect(settled.ok, JSON.stringify(settled)).toBe(true)
      expect(rollD20).toHaveBeenCalledTimes(1)
      expect(rollD20.mock.calls[0]).toEqual(expect.arrayContaining([expect.stringContaining('专注')]))
      if (settled.ok) {
        expect(settled.state.combatants.second.concentrating).toBe(d20 === 20)
        expect(settled.destinationMap.tokens.find(token => token.id === 'second')?.hp).toBe(24)
        expect(settled.destinationMap.tokens.find(token => token.id === 'stone')?.hp).toBe(14)
        expect(settled.state.combatants.mage.classResources['dnd5e-spell-slot-1'].current).toBe(0)
      }
      expect(focused).toEqual(baseline)
    }
    await expect(settleDnd5eObjectFlightArrival(focused, {
      rollD20: async () => { throw Error('cancelled') }, rollD4: async () => 1, rollDice: async () => [],
    })).rejects.toThrow('cancelled')
    expect(focused).toEqual(baseline)
  }
  expect(transaction.ok, JSON.stringify(transaction)).toBe(true)
  if (transaction.ok) {
    expect(transaction.destinationMap.tokens.find(t => t.id === 'stone')).toMatchObject({ x: 300, y: 75, elevationFeet: 0, hp: 14 })
    expect(transaction.destinationMap.tokens.find(t => t.id === 'second')?.hp).toBe(defense === 'normal' ? 24 : defense === 'resistance' ? 27 : 30)
    expect(transaction.sourceMap.tokens.some(t => t.id === 'stone')).toBe(false)
    expect(transaction.completedReceipt).toMatchObject({ status: 'completed', settlementId: 'arrival-1' })
    const saveResourcesAtomically = vi.fn<import('../../ports/sharedRoomGateway').SharedRoomGatewayPort['saveResourcesAtomically']>()
      .mockResolvedValue({ status: 'committed', transactionId: 'test', revisions: {} })
    const loadResource = vi.fn().mockResolvedValue({ maps: [transaction.sourceMap, transaction.destinationMap] })
    const publishInput = { completion: transaction, maps: [transactionInput.sourceMap, destinationMap],
      geometry: { schemaVersion: 3 as const, maps: [], updatedAt: 1 }, updatedAt: 2,
      expectedRevisions: { characters: 3, maps: 4, 'map-geometry': 5, combat: 6 }, gateway: { saveResourcesAtomically, loadResource } }
    expect(await publishDnd5eObjectFlightArrival(publishInput)).toEqual({ recovered: false })
    expect(saveResourcesAtomically.mock.calls[0][0].map(write => [write.name, write.expectedRevision])).toEqual([
      ['characters', 3], ['maps', 4], ['map-geometry', 5],
    ])
    expect(saveResourcesAtomically.mock.calls[0][1]?.readRevisions).toEqual({ combat: 6 })
    const conflict = Error('shared-state-transaction-conflict:maps')
    saveResourcesAtomically.mockRejectedValue(conflict)
    expect(await publishDnd5eObjectFlightArrival(publishInput)).toEqual({ recovered: true })
    loadResource.mockResolvedValue({ maps: [transactionInput.sourceMap] })
    await expect(publishDnd5eObjectFlightArrival(publishInput)).rejects.toBe(conflict)
    expect(saveResourcesAtomically).toHaveBeenCalledTimes(3)
    await expect(publishDnd5eObjectFlightArrival({ ...publishInput,
      expectedRevisions: { ...publishInput.expectedRevisions, combat: -1 } })).rejects.toThrow('flight-snapshot-revision-required:combat')
    expect(saveResourcesAtomically).toHaveBeenCalledTimes(3)
    expect(planDnd5eObjectFlightArrivalTransaction({ ...transactionInput, sourceMap: transaction.sourceMap, destinationMap: transaction.destinationMap }).ok).toBe(false)
  }
  const departureAgain = planDnd5eObjectFlightArrivalTransaction({ ...transactionInput, settlementId: 'arrival-out',
    destinationMap: { ...destinationMap, width: 500 },
    rolls: Object.fromEntries(['first', 'second', 'later'].map(id => [`save:${id}`, { values: [20] }])) })
  expect(departureAgain.ok, JSON.stringify(departureAgain)).toBe(true)
  if (departureAgain.ok) {
    const next = departureAgain.destinationMap.dnd5eObjectFlightDepartures![0]
    expect(next.remainingFeet).toBeCloseTo(10, 8)
    expect(next.damage).toBe(6)
    expect(next.object.hp).toBe(20)
    expect(next.successfulTargetIds).toEqual(['saved', 'first', 'second', 'later'])
    expect(next.sourceMapId).toBe(destinationMap.id)
    expect(departureAgain.destinationMap.tokens.some(t => t.id === 'stone')).toBe(false)
    expect(departureAgain.sourceMap.dnd5eObjectFlightDepartures![0].status).toBe('completed')
  }
  const expanded = { ...transactionInput.sourceMap, width: 2000 }
  const sameScene = planDnd5eObjectFlightArrivalTransaction({ ...transactionInput,
    sourceMap: expanded, destinationMap: expanded, settlementId: 'expanded-arrival', rolls: {} })
  expect(sameScene.ok, JSON.stringify(sameScene)).toBe(true)
  if (sameScene.ok) {
    expect(sameScene.sourceMap).toEqual(sameScene.destinationMap)
    expect(sameScene.destinationMap.tokens.find(t => t.id === 'stone')).toMatchObject({ hp: 14, elevationFeet: 0 })
    expect(sameScene.destinationMap.tokens.find(t => t.id === 'stone')!.x).toBeCloseTo(600, 8)
    expect(sameScene.completedReceipt.status).toBe('completed')
  }
  expect({ state, sourceMap, destinationMap }).toEqual(before)
})
