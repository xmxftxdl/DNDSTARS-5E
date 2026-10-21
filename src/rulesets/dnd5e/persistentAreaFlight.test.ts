import { coordinateForcedMovementPersistentAreas } from '../../application/maps/ForcedMovementPersistentAreaCoordinator'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import { afterEach, expect, it, vi } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Dnd5ePluginArea } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { collectDnd5ePersistentAreaTriggers, recordDnd5ePersistentAreaTrigger } from './pluginAreas'
import { dnd5ePersistentAreaFlightCapableTokenIds, prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import { normalizeDnd5ePersistentAreaTriggerDeclaration, normalizeDnd5ePersistentAreaTriggerSnapshot, type Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { dnd5eCombatantIsFlying, resolveDnd5ePersistentAreaTrigger, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { settleDnd5eConcentrationChecks } from '../../pages/maps/settleDnd5eCombatResult'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { resolveDnd5ePersistentAreaModeState, projectDnd5ePersistentAreaMode, changeDnd5ePersistentAreaMode } from './persistentAreaModes'

afterEach(() => setMapGeometryRuntime([]))
const triggers: Dnd5ePersistentAreaTriggerSnapshot[] = ['on-enter', 'turn-start'].map((timing, i) => ({
  id: i ? 'start' : 'enter', label: 'Synthetic flying gate', timing: timing as 'on-enter' | 'turn-start', frequencyGroupId: 'flight-save', oncePerTurn: true,
  requiresTargetFlying: true, savingThrow: { ability: 'str', dc: 15, onSuccess: 'none', magical: true },
  condition: { condition: 'prone', duration: { expiresAt: 'permanent' } },
}))
function fixture(height = 20, fly = 30, hover = false) {
  const character = normalizeCharacter({ id: 'flyer-sheet', name: 'Flyer', charClass: '法师', level: 5, maxHp: 40, currentHp: 40,
    abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, dnd5eMovementSpeeds: { fly, hover } })
  const area: Dnd5ePluginArea = { id: 'flight-area', pluginId: 'test.flight', featureId: 'flight', label: 'Flight gate', sourceCharacterId: 'source', sourceTokenId: 'source',
    cells: [{ col: 3, row: 0 }, { col: 4, row: 0 }], color: '#fff', createdRound: 1, expiresAfterRound: 100, anchorMode: 'fixed',
    relation: 'any', includeSelf: false, vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 50 }, triggers: structuredClone(triggers) }
  const map: BattleMap = { id: 'flight-gate', name: 'Flight', width: 500, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [{ id: 'source', label: 'Source', type: 'enemy', size: 1, x: 25, y: 75, color: '', emoji: '', hp: 20, maxHp: 20 },
      { id: 'flyer', characterId: character.id, label: 'Flyer', type: 'player', size: 1, x: 175, y: 25, color: '', emoji: '', elevationFeet: height, dnd5eTraversalMode: 'fly' }],
    dnd5ePluginAreas: [area] }
  const characters = [character]
  const context = () => dnd5ePersistentAreaFlightCapableTokenIds({ map, characters, round: 1 })
  const collect = (turnKey = '1:flyer') => collectDnd5ePersistentAreaTriggers({ map, round: 1, timing: 'turn-start', turnKey, targetTokenId: 'flyer', flightCapableTokenIds: context() })
  const prepare = () => {
    const candidate = collect()[0]
    if (!candidate) throw Error('No flying candidate')
    const prepared = prepareDnd5ePersistentAreaTrigger({ combatId: 'flight', map, characters, round: 1, candidate,
      initiativeOrder: map.tokens.map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: token.id === 'source' ? 20 : 10 })) })
    if (!prepared.ok) throw Error(prepared.reason)
    return prepared.prepared
  }
  return { map, characters, character, area, context, collect, prepare }
}

it.each([{ height: 20, fly: 30, n: 1 }, { height: 0, fly: 30, n: 0 }, { height: 20, fly: 0, n: 0 }, { height: 60, fly: 30, n: 0 }])('qualifies actual flight, not capability or altitude alone (%j)', ({ height, fly, n }) => {
  const f = fixture(height, fly)
  expect(f.collect()).toHaveLength(n)
  const withoutEvidence = collectDnd5ePersistentAreaTriggers({ map: f.map, round: 1, timing: 'turn-start', turnKey: '1:flyer', targetTokenId: 'flyer' })
  expect(withoutEvidence).toEqual([])
})

it('uses terrain-relative height and does not count a raised surface as flight', () => {
  const f = fixture(20), geometry = createEmptyMapGeometry(f.map.id)
  geometry.obstacles = [{ id: 'raised', kind: 'obstacle', label: 'Raised', points: [{x:150,y:0},{x:200,y:0},{x:200,y:50},{x:150,y:50}],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none', baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  expect(f.collect()).toEqual([])
})

it('shares the enter/start frequency and excludes repeated crossings in one turn', () => {
  const f = fixture(), token = { ...f.map.tokens[1], x: 125 }
  const movement = { token, to: { x: 225, y: 25 }, path: [{ x: 125, y: 25 }, { x: 175, y: 25 }, { x: 125, y: 25 }, { x: 225, y: 25 }], pathElevationsFeet: [20, 20, 20, 20] }
  const enter = collectDnd5ePersistentAreaTriggers({ map: f.map, round: 1, timing: 'on-enter', turnKey: '1:flyer', movement, flightCapableTokenIds: f.context() })
  expect(enter).toHaveLength(1)
  f.map.dnd5ePluginAreas = recordDnd5ePersistentAreaTrigger(f.map.dnd5ePluginAreas, enter[0], 1, 0, true)
  expect(f.collect()).toEqual([])
  expect(f.collect('1:other')).toHaveLength(1)
  expect(collectDnd5ePersistentAreaTriggers({ map: f.map, round: 1, timing: 'on-enter', turnKey: '1:other', flightCapableTokenIds: f.context(),
    movement: { ...movement, token: { ...token, elevationFeet: 0 }, pathElevationsFeet: [0, 0, 0, 0] } })).toEqual([])
})

it.each(['height', 'speed', 'missing-sheet'])('rechecks %s before dice instead of trusting a collected flight candidate', mutation => {
  const f = fixture(), candidate = f.collect()[0]
  if (mutation === 'height') f.map.tokens[1].elevationFeet = 0
  if (mutation === 'speed') f.character.dnd5eMovementSpeeds = { fly: 0 }
  const prepared = prepareDnd5ePersistentAreaTrigger({ combatId: 'flight', round: 1, map: f.map, characters: mutation === 'missing-sheet' ? [] : f.characters, candidate,
    initiativeOrder: f.map.tokens.map(token => ({ tokenId: token.id, label: token.label, emoji: token.emoji, color: token.color, roll: 10 })) })
  expect(prepared.ok).toBe(false)
})

it.each(['height', 'speed', 'airborne'])('rejects forged Headless flight claims lacking %s', mutation => {
  const prepared = fixture().prepare(), target = prepared.state.combatants.flyer
  if (mutation === 'height') target.elevationFeet = target.groundElevationFeet
  if (mutation === 'speed') target.movementSpeeds = { walk: 30 }
  if (mutation === 'airborne') target.airborne = false
  expect(dnd5eCombatantIsFlying(target)).toBe(false)
  expect(resolveDnd5ePersistentAreaTrigger(prepared.state, { areaId: 'flight-area', sourceId: 'source', targetId: 'flyer', trigger: triggers[1], d20: 1 })).toMatchObject({ ok: false, reason: 'invalid-target' })
})

it.each([false, true])('settles a failed save and the resulting fall while respecting hover=%s', async hover => {
  const prepared = fixture(20, 30, hover).prepare(), before = structuredClone(prepared)
  const provisional = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1 })
  expect(provisional.result.ok).toBe(true); if (!provisional.result.ok || !provisional.application) throw Error('Trigger failed')
  const rollDice = vi.fn(async (count: number) => Array(count).fill(4)), rollD20 = vi.fn(async () => 20)
  const settled = await settleDnd5eConcentrationChecks({ result: provisional.result, priorState: prepared.state,
    map: provisional.application.map, characters: provisional.application.characters, priorApplication: provisional.application,
    characterIdByCombatantId: prepared.characterIdByCombatantId, rollD20, rollD4: async () => 1, rollDice })
  expect(rollDice).toHaveBeenCalledTimes(hover ? 0 : 1)
  expect(settled.result.state.combatants.flyer).toMatchObject({ currentHp: hover ? 40 : 32, elevationFeet: hover ? 20 : 0, airborne: hover })
  expect(settled.result.state.combatants.flyer.conditions).toContain('prone')
  expect(settled.application.map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
  expect(settled.application.map.tokens.find(t => t.id === 'flyer')!.elevationFeet).toBe(hover ? 20 : 0)
  expect(settled.application.map.tokens.find(t => t.id === 'flyer')!.dnd5eTraversalMode).toBe(hover ? 'fly' : 'walk')
  expect(prepared).toEqual(before)
  const success = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 20 })
  expect(success.result.ok).toBe(true)
  expect(success.result.state.combatants.flyer.conditions).not.toContain('prone')
})

it('keeps the flight gate through mode pause/resume and JSON reload', () => {
  const f = fixture(), state = resolveDnd5ePersistentAreaModeState({ profiles: [{ id: 'down', triggers }], initialModeId: 'down' })!
  f.map.dnd5ePluginAreas = [projectDnd5ePersistentAreaMode(f.area, state)]
  const paused = changeDnd5ePersistentAreaMode(f.map.dnd5ePluginAreas[0], { change: 'pause', receipt: 'pause' })!
  f.map.dnd5ePluginAreas = [paused]
  expect(f.context()).toBeUndefined()
  expect(f.collect()).toEqual([])
  f.map.dnd5ePluginAreas = [changeDnd5ePersistentAreaMode(paused, { change: 'resume', receipt: 'resume' })!]
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [f.map] }))).maps[0]
  expect(saved.dnd5ePluginAreas![0].triggers![0].requiresTargetFlying).toBe(true)
  expect(collectDnd5ePersistentAreaTriggers({ map: saved, round: 1, timing: 'turn-start', turnKey: '1:flyer', targetTokenId: 'flyer',
    flightCapableTokenIds: dnd5ePersistentAreaFlightCapableTokenIds({ map: saved, characters: f.characters, round: 1 }) })).toHaveLength(1)
})

it('retains authorable flight-only triggers through archive installation and Activity evaluation', async () => {
  const namespace = 'test.flight-archive', automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic flight', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'zone', name: 'Zone', automation,
      payload: { id: 'zone', name: 'Zone', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'zone', name: 'Zone', automation, activation: { kind: 'action' }, legacySource: { kind: 'feature', id: 'zone' },
        target: { kind: 'area', origin: 'point', shape: 'cube', widthFeet: 20, lengthFeet: 20, heightFeet: 20, placeRangeFeet: 100, relation: 'any' },
        outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area', label: 'Flight area', durationRounds: 10, concentration: false, triggers }] }] }] }] }
  const restored = await readDnd5eStarMod(await exportDnd5eStarMod(bundle)), dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(restored.bundle))
  try {
    const activity = getRegisteredDnd5eActivity(namespace, 'zone')!, prepared = fixture().prepare()
    const actor = { id: 'source', controller: 'dm' as const, proficiencyBonus: 2, level: 5, armorClass: 10, conditions: [], abilities: prepared.state.combatants.source.abilities }
    const result = resolveDnd5eActivity({ activity, actor, targets: [], rolls: {}, areaPlacement: { x: 175, y: 25 }, areaPlacementDistanceFeet: 10 })
    expect(result.ok, JSON.stringify(result)).toBe(true); if (!result.ok) throw Error('Fixture')
    expect(result.proposals.find(p => p.kind === 'create-persistent-area')).toMatchObject({ triggers: triggers.map(t => expect.objectContaining({ id: t.id, requiresTargetFlying: true })) })
  } finally { dispose() }
})

it.each([false, 'true', null])('rejects invalid flight-gate declarations (%s)', requiresTargetFlying => {
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({ ...triggers[0], requiresTargetFlying })).toBeUndefined()
})
it('does not accept flight gating at unsupported trigger timings', () => {
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...triggers[0], timing: 'turn-end' })).toBeUndefined()
})


it.each(['giant-eagle', 'bandit'])('uses the actual monster flight profile for %s', slug => {
  const f = fixture(), monster = getDnd5eSrdMonsterBySlug(slug)!
  expect(monster).toBeDefined()
  f.map.tokens[1] = { ...f.map.tokens[1], characterId: undefined, type: 'enemy', poolId: monster.id, hp: 40, maxHp: 40 }
  expect(f.collect()).toHaveLength(slug === 'giant-eagle' ? 1 : 0)
})

it.each([0, 30])('uses Host flight context for forced entry with fly=%s', async fly => {
  const f = fixture(20, fly), before = structuredClone(f.map)
  before.tokens[1].x = 125
  const settleCandidates = vi.fn(async ({ map, characters }: {map: BattleMap; characters: readonly typeof f.character[]}) => ({ map, characters: [...characters], logs: [] }))
  await coordinateForcedMovementPersistentAreas({ beforeMap: before, afterMap: f.map, characters: f.characters, tokenId: 'flyer', round: 1, turnKey: '1:source', settleCandidates })
  const call = settleCandidates.mock.calls[0][0] as {candidates?: unknown[]}
  expect(call.candidates).toHaveLength(fly ? 1 : 0)
})

it.each(['climb', 'walk', 'swim', 'fall', undefined] as const)('does not mistake %s for flight even when a creature owns both speeds', mode => {
  const f = fixture(), candidate = f.collect()[0]
  f.character.dnd5eMovementSpeeds = { fly: 30, climb: 30 }
  f.map.tokens[1].dnd5eTraversalMode = mode
  expect(f.collect()).toEqual([])
  // A supplied capability set cannot override the persisted Host mode.
  expect(collectDnd5ePersistentAreaTriggers({ map: f.map, round: 1, timing: 'turn-start', targetTokenId: 'flyer', turnKey: '1:flyer',
    flightCapableTokenIds: new Set(['flyer']) })).toEqual([])
  expect(prepareDnd5ePersistentAreaTrigger({ combatId: 'flight', round: 1, map: f.map, characters: f.characters, candidate,
    initiativeOrder: f.map.tokens.map(token => ({ tokenId: token.id, roll: 10, label: token.label, emoji: '', color: '' })) }))
    .toMatchObject({ ok: false, reason: 'target-not-flying' })
})

it.each(['climb', 'fly'] as const)('persists accepted %s ascent across a map/character round trip without inferring flight from height', mode => {
  const f = fixture(0)
  f.character.dnd5eMovementSpeeds = { fly: 30, climb: 30 }
  f.map.tokens[1].dnd5eTraversalMode = undefined
  const initiativeOrder = [f.map.tokens[1], f.map.tokens[0]].map(token => ({ tokenId: token.id, roll: 10, label: token.label, emoji: '', color: '' }))
  const snapshot = createDnd5eMapCombatSnapshot({ map: f.map, characters: f.characters, combatId: 'flight-mode', round: 1, initiativeOrder })
  const result = resolveDnd5eHeadlessAction(snapshot.state, { type: 'move', actorId: 'flyer', to: { x: 225, y: 25 }, distance: mode === 'climb' ? 20 : 5,
    traversalMode: mode, toElevationFeet: 20, toGroundElevationFeet: 0, ...(mode === 'climb' ? { climbDistanceIncludesElevation: true } : {}) })
  expect(result.ok, JSON.stringify(result.events)).toBe(true); if (!result.ok) throw Error(result.reason)
  expect(snapshot.state.combatants.flyer.traversalMode).toBeUndefined()
  const applied = planDnd5eMapResultApplication({ map: f.map, characters: f.characters, state: result.state,
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events: [...result.events] })
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [applied.map] }))).maps[0]
  const rebuilt = createDnd5eMapCombatSnapshot({ map: saved, characters: applied.characters, combatId: 'flight-mode', round: 2, initiativeOrder })
  expect(rebuilt.state.combatants.flyer.traversalMode).toBe(mode)
  expect(dnd5eCombatantIsFlying(rebuilt.state.combatants.flyer)).toBe(mode === 'fly')
  expect(saved.dnd5ePluginAreas).toHaveLength(1)
  expect(saved.tokens.find(t => t.id === 'flyer')).toMatchObject({ x: 225, y: 25, elevationFeet: 20, dnd5eTraversalMode: mode })
  expect(dnd5ePersistentAreaFlightCapableTokenIds({ map: saved, characters: applied.characters, round: 2 })?.has('flyer')).toBe(mode === 'fly')
  expect(collectDnd5ePersistentAreaTriggers({ map: saved, round: 2, timing: 'turn-start', targetTokenId: 'flyer', turnKey: '2:flyer',
    flightCapableTokenIds: dnd5ePersistentAreaFlightCapableTokenIds({ map: saved, characters: applied.characters, round: 2 }) }))
    .toHaveLength(mode === 'fly' ? 1 : 0)
})

it('does not persist flight mode from an unsuccessful movement request', () => {
  const prepared = fixture().prepare()
  prepared.state.combatants.flyer.traversalMode = 'climb'
  prepared.state.combatants.flyer.movementSpeeds = { walk: 30, climb: 30 }
  prepared.state.initiativeIndex = prepared.state.initiativeOrder.indexOf('flyer')
  const before = structuredClone(prepared.state)
  const result = resolveDnd5eHeadlessAction(prepared.state, { type: 'move', actorId: 'flyer', traversalMode: 'fly',
    to: { x: 225, y: 25 }, distance: 5, toElevationFeet: 20, toGroundElevationFeet: 0 })
  expect(result.ok).toBe(false)
  expect(result.state.combatants.flyer.traversalMode).toBe('climb')
  expect(prepared.state).toEqual(before)
})

it.each(['flight', null, {}, 1])('discards invalid saved traversal evidence (%j)', mode => {
  const f = fixture()
  const saved = migrateMapsState({ maps: [{ ...f.map, tokens: [f.map.tokens[0], { ...f.map.tokens[1], dnd5eTraversalMode: mode }] }] }).maps[0]
  expect(saved.tokens[1].dnd5eTraversalMode).toBeUndefined()
  expect(collectDnd5ePersistentAreaTriggers({ map: saved, round: 1, timing: 'turn-start', targetTokenId: 'flyer', turnKey: '1:flyer',
    flightCapableTokenIds: dnd5ePersistentAreaFlightCapableTokenIds({ map: saved, characters: f.characters, round: 1 }) })).toEqual([])
})
