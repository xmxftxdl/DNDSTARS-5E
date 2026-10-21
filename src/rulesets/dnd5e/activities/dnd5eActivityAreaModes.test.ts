import { afterEach, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { migrateMapsState, type BattleMap } from '../../../store/maps'
import { normalizeCharacter } from '../../../store/characters'
import { setMapGeometryRuntime, mapGeometryRangedWeaponAttackDisadvantage } from '../../../lib/mapGeometry'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { getRegisteredDnd5eActivity } from './dnd5eActivityRegistry'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { applyDnd5eActivityMapHandoffsV1, resolveDnd5eActivityAreaMapSelectionV1 } from './dnd5eActivityMapInteraction'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, commitDnd5eActivityExecution } from '../headlessCombatEngine'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'
import { prepareDnd5ePluginFeatureAction, resolvePreparedDnd5ePluginFeatureAction } from '../pluginFeatureAction'
import { reconcileDnd5ePluginAreasAndConcentrationOnMap, expireDnd5ePluginAreasAtWorldMinute, collectDnd5ePersistentAreaTriggers, recordDnd5ePersistentAreaTrigger, rebaseDnd5ePluginAreasAfterCombat } from '../pluginAreas'
import { dnd5ePersistentAreaDirectionalMovementCostAt } from '../persistentAreaGeometry'
import { normalizeDnd5ePersistentAreaModeDeclarations, normalizeDnd5ePersistentAreaModeState, resolveDnd5ePersistentAreaModeState } from '../persistentAreaModes'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import type { Dnd5ePersistentAreaModeDeclaration } from '../persistentAreaTypes'

const automation = automationCapabilityFromLegacyStatus('full'), namespace = 'local.area-modes'
const profiles: Dnd5ePersistentAreaModeDeclaration[] = [
  { id: 'gust', blocking: { rangedWeaponAttackDisadvantage: 'boundary' }, directionalMovementCost: { direction: 'area-orientation', additionalFeetPerFoot: 1 } },
  { id: 'down', blocking: { rangedWeaponAttackDisadvantage: 'occupancy' }, occupantModifiers: { conditions: ['deafened'] },
    triggers: [{ id: 'pulse', frequencyGroupId: 'one-pulse', label: 'Synthetic pulse', timing: 'turn-start', oncePerTurn: true, maximumTotalUses: 2,
      savingThrow: { ability: 'str', dc: 'source-save-dc', onSuccess: 'none', magical: true }, damage: { count: 1, sides: 6, type: 'force' } }] },
  { id: 'calm' },
]
const root: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'root', name: 'Synthetic mode area', activation: { kind: 'action' }, automation,
  legacySource: { kind: 'feature', id: 'root' }, target: { kind: 'area', origin: 'point', shape: 'rect', widthFeet: 20, lengthFeet: 20, heightFeet: 20, placeRangeFeet: 100, relation: 'any', includeSelf: true },
  choices: [{ id: 'initial', label: 'Initial mode', options: profiles.map(profile => ({ id: profile.id, label: profile.id })) }],
  outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'area', kind: 'create-persistent-area', label: 'Synthetic modes', durationRounds: 100, concentration: true,
    modes: profiles, initialModeChoiceId: 'initial', grantedActivities: ['select', 'pause', 'resume'].map(activityId => ({ activityId })) }] }] }
const control = (change: 'select' | 'pause' | 'resume'): Dnd5eActivityDefinitionV1 => ({ schemaVersion: 1, id: change, name: change, automation,
  activation: { kind: 'action' }, legacySource: { kind: 'feature', id: 'root' }, target: { kind: 'self' },
  choices: change === 'select' ? [{ id: 'mode', label: 'Mode', options: profiles.map(profile => ({ id: profile.id, label: profile.id })) }] : undefined,
  consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'change', when: { kind: 'always' }, operations: [{ id: 'change', kind: 'change-granting-area-mode', target: 'actor', change, ...(change === 'select' ? { modeChoiceId: 'mode' } : {}) }] }] })
const actor = { id: 'caster', controller: 'players' as const, level: 10, proficiencyBonus: 4, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }, armorClass: 15, conditions: [], currentHp: 50, maxHp: 50 }
const board = (): BattleMap => ({ id: 'modes', name: 'Modes', width: 500, height: 500, gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
  tokens: [{ id: actor.id, characterId: actor.id, label: 'Caster', type: 'player', size: 1, x: 25, y: 175, color: '', emoji: '' }] })
afterEach(() => setMapGeometryRuntime([]))
function create(activity = root, initial = 'gust', castLevel?: number) {
  const map = board(), caster = map.tokens[0]
  const areaSelection = resolveDnd5eActivityAreaMapSelectionV1({ activity, map, actorToken: caster, anchorCell: { col: 3, row: 3 } })!
  const resolved = resolveDnd5eActivity({ activity, actor, targets: [], rolls: {}, choices: { initial }, castLevel, areaExemptTargetIds: ['exempt'], areaPlacement: areaSelection.areaPlacement, areaPlacementDistanceFeet: areaSelection.areaPlacementDistanceFeet })
  expect(resolved.ok, JSON.stringify(resolved)).toBe(true)
  if (!resolved.ok) throw Error('creation resolution failed')
  const proposal = resolved.proposals.find(p => p.kind === 'create-persistent-area')!
  if (proposal.kind !== 'create-persistent-area') throw Error('fixture')
  expect(proposal.initialModeId).toBe(initial)
  expect(resolveDnd5ePersistentAreaModeState({ profiles: proposal.modes!, initialModeId: proposal.initialModeId!, direction: { dc: 1, dr: 0 }, sourceSaveDc: 17 })).toBeDefined()
  const applied = applyDnd5eActivityMapHandoffsV1({ map, activity, packageId: namespace, actionId: 'create', actorId: actor.id, sourceSaveDc: 17, concentrationId: 'source-spell', worldMinute: 100, round: 1, selection: {}, areaSelection,
    handoffs: { persistentAreas: resolved.proposals.filter(p => p.kind === 'create-persistent-area'), movements: [], summons: [], invocations: [] } })
  expect(applied.ok, JSON.stringify(applied)).toBe(true)
  if (!applied.ok) throw Error('creation handoff failed')
  return applied.map
}
function change(map: BattleMap, operation: 'select' | 'pause' | 'resume', actionId: string, mode = 'down', activity = control(operation)) {
  const result = resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {}, choices: activity.choices?.length ? { mode } : undefined })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('control failed')
  return applyDnd5eActivityMapHandoffsV1({ map, activity, packageId: namespace, actionId, actorId: actor.id, round: 2, worldMinute: 102, grantingPersistentAreaId: map.dnd5ePluginAreas![0].id, selection: {},
    handoffs: { persistentAreas: [], movements: [], summons: [], invocations: [], areaModeChanges: result.proposals.filter(p => p.kind === 'change-granting-area-mode') } })
}

it.each(['gust', 'down', 'calm'])('creates the requested profile and preserves its source DC (%s)', initial => {
  expect(validateDnd5eActivityDefinitionV1(root)).toEqual([])
  const area = create(root, initial).dnd5ePluginAreas![0]
  expect(area.modeState).toMatchObject({ selectedModeId: initial, paused: false })
  expect(area.triggers?.[0].savingThrow?.dc).toBe(initial === 'down' ? 17 : undefined)
  expect(area.blocking?.rangedWeaponAttackDisadvantage).toBe(initial === 'gust' ? 'boundary' : initial === 'down' ? 'occupancy' : undefined)
})

it('switches, pauses and resumes without recreating its identity, expiry, source, concentration or ledgers', () => {
  let current = create(), baseline = current.dnd5ePluginAreas![0]
  const next = change(current, 'select', 'choose-down'); expect(next.ok).toBe(true); if (!next.ok) return
  current = next.map
  const down = current.dnd5ePluginAreas![0]
  expect(down).toMatchObject({ id: baseline.id, createdRound: baseline.createdRound, expiresAfterRound: baseline.expiresAfterRound, expiresAtWorldMinute: baseline.expiresAtWorldMinute,
    sourceTokenId: baseline.sourceTokenId, concentrationId: baseline.concentrationId, blocking: { rangedWeaponAttackDisadvantage: 'occupancy' } })
  expect(down.directionalMovementCost).toBeUndefined()
  down.triggerReceipts = [{ transactionId: 'pulse-1', triggerId: 'one-pulse', targetTokenId: 'target', round: 1, turnKey: '1:caster' }]
  const paused = change(current, 'pause', 'pause-1'); expect(paused.ok).toBe(true); if (!paused.ok) return
  current = migrateMapsState(JSON.parse(JSON.stringify({ maps: [paused.map] }))).maps[0]
  expect(current.dnd5ePluginAreas![0]).toMatchObject({ modeState: { selectedModeId: 'down', paused: true }, triggerReceipts: down.triggerReceipts })
  for (const field of ['triggers', 'blocking', 'occupantModifiers', 'directionalMovementCost'] as const) expect(current.dnd5ePluginAreas![0][field]).toBeUndefined()
  expect(current.dnd5ePluginAreas![0].grantedActivities).toHaveLength(3)
  const resumed = change(current, 'resume', 'resume-1'); expect(resumed.ok).toBe(true); if (!resumed.ok) return
  expect(resumed.map.dnd5ePluginAreas![0]).toMatchObject({ modeState: { selectedModeId: 'down', paused: false }, expiresAtWorldMinute: 110, triggerReceipts: down.triggerReceipts })
  expect(resumed.map.dnd5ePluginAreas![0].triggers?.[0].savingThrow?.dc).toBe(17)
  const replay = change(resumed.map, 'pause', 'pause-1'); expect(replay.ok).toBe(true); if (!replay.ok) return
  expect(replay.map.dnd5ePluginAreas![0].modeState?.paused).toBe(false)
})

it('removes real attack/movement modifiers during pause and restores them afterward', () => {
  let map = create(), caster = map.tokens[0]
  const to = { ...caster, id: 'target', x: 325 }
  expect(mapGeometryRangedWeaponAttackDisadvantage({ map, from: caster, to })).toBe(true)
  const moving = { ...caster, id: 'moving', x: 225, y: 175 }
  const cost = (map: BattleMap) => dnd5ePersistentAreaDirectionalMovementCostAt({ map, token: moving, from: moving, to: { x: 175, y: 175 } })
  expect(cost(map)).toBe(1)
  const pause = change(map, 'pause', 'pause'); expect(pause.ok).toBe(true); if (!pause.ok) return
  map = pause.map
  expect(mapGeometryRangedWeaponAttackDisadvantage({ map, from: caster, to })).toBe(false)
  expect(cost(map)).toBe(0)
  const resume = change(map, 'resume', 'resume'); expect(resume.ok).toBe(true); if (!resume.ok) return
  expect(mapGeometryRangedWeaponAttackDisadvantage({ map: resume.map, from: caster, to })).toBe(true)
  expect(cost(resume.map)).toBe(1)
})

it.each(['owner', 'token', 'package', 'grant', 'unknown-mode', 'expired'])('rejects %s changes without mutating the source map', mutation => {
  const map = create(), area = map.dnd5ePluginAreas![0]
  if (mutation === 'owner') area.sourceCharacterId = 'other'
  if (mutation === 'token') area.sourceTokenId = 'other'
  if (mutation === 'package') area.pluginId = 'other'
  if (mutation === 'grant') area.grantedActivities = []
  if (mutation === 'expired') area.expiresAtWorldMinute = 101
  const original = JSON.stringify(map)
  const activity = mutation === 'unknown-mode' ? { ...control('select'), choices: undefined, outcomes: [{ id: 'change', when: { kind: 'always' as const }, operations: [{ id: 'change', kind: 'change-granting-area-mode' as const, target: 'actor' as const, change: 'select' as const, modeId: 'unknown' }] }] } : control('select')
  expect(change(map, 'select', 'bad', 'down', activity).ok).toBe(false)
  expect(JSON.stringify(map)).toBe(original)
})

it('normalizes paused snapshots from the profile state and expires them on the original clock', () => {
  const original = create(), paused = change(original, 'pause', 'pause')
  expect(paused.ok).toBe(true); if (!paused.ok) return
  paused.map.dnd5ePluginAreas![0].blocking = { rangedWeaponAttackDisadvantage: 'occupancy' }
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [paused.map] }))).maps[0]
  expect(saved.dnd5ePluginAreas![0].blocking).toBeUndefined()
  const character = normalizeCharacter({ id: 'caster', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'source-spell' } })
  expect(reconcileDnd5ePluginAreasAndConcentrationOnMap(saved, [character], 10, expireDnd5ePluginAreasAtWorldMinute(saved, 110)).map.dnd5ePluginAreas).toEqual([])
  const malformed = structuredClone(saved); malformed.dnd5ePluginAreas![0].modeState!.selectedModeId = 'unknown'
  expect(migrateMapsState(JSON.parse(JSON.stringify({ maps: [malformed] }))).maps[0].dnd5ePluginAreas).toEqual([])
})

it('validates closed profiles and choice references', () => {
  for (const value of [[], [...profiles, profiles[0]], [{ id: 'bad', extra: true }], [{ id: 'bad', movementCostMultiplier: 0 }]]) expect(normalizeDnd5ePersistentAreaModeDeclarations(value)).toBeUndefined()
  const broken = structuredClone(root), op = broken.outcomes[0].operations[0]
  if (op.kind !== 'create-persistent-area') throw Error('fixture')
  op.movementCostMultiplier = 2
  expect(validateDnd5eActivityDefinitionV1(broken).join(' ')).toContain('cannot mix')
  const unknown = control('select'); unknown.choices = []
  expect(validateDnd5eActivityDefinitionV1(unknown).join(' ')).toContain('modeChoiceId is unknown')
  const state = create().dnd5ePluginAreas![0].modeState!
  expect(normalizeDnd5ePersistentAreaModeState({ ...state, changeReceipts: [5] })).toBeUndefined()
})

it.each(['compiled', 'direct'])('preserves mode proposals and action spending through the %s Headless route', route => {
  const activity = control('pause'), dispose = registerDnd5eRulesPlugin({ manifest: { id: namespace, name: 'Modes', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(activity)); api.registerFeature({ id: activity.id, name: activity.name, summary: 'Synthetic', description: 'Synthetic', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(activity) })
  } })
  try {
    const caster = createDnd5eCombatant({ ...actor, name: 'Caster', controller: 'player', initiative: 20, temporaryHp: 0, speed: 30, saveDc: 17, position: { x: 0, y: 0 }, concentrating: false })
    caster.pluginFeatureIds = [`${namespace}:pause`]
    const state = startDnd5eHeadlessCombat('modes', [caster, createDnd5eCombatant({ ...caster, id: 'other', controller: 'dm', initiative: 1 })])
    const result = route === 'compiled' ? resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'pause', featureId: `${namespace}:pause`, actorId: actor.id, targetId: actor.id, rolls: {} })
      : commitDnd5eActivityExecution(state, { actorId: actor.id, activityId: 'pause', targetIds: [actor.id], resolution: resolveDnd5eActivity({ activity, actor, targets: [actor], rolls: {} }), source: { kind: 'feature', id: 'pause' } })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error('Headless mode control failed')
    expect(result.activityHandoffs?.areaModeChanges).toMatchObject([{ kind: 'change-granting-area-mode', operationId: 'change', targetId: actor.id, change: 'pause', modeId: undefined }])
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(state.combatants.caster.turn.actionAvailable).toBe(true)
  } finally { dispose() }
})

it('exports, installs and prepares the area-granted resume action while paused', async () => {
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Modes', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'root', name: 'Root', automation, payload: { id: 'root', name: 'Root', summary: 'Synthetic', description: 'Synthetic', automation: 'full' }, activities: [root, control('select'), control('pause'), control('resume')] }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle)), dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const installed = getRegisteredDnd5eActivity(namespace, 'root')!, map = create(installed)
    const paused = change(map, 'pause', 'pause', 'down', getRegisteredDnd5eActivity(namespace, 'pause')!)
    expect(paused.ok).toBe(true); if (!paused.ok) return
    const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [paused.map] }))).maps[0]
    const character = normalizeCharacter({ id: 'caster', name: 'Caster', maxHp: 50, currentHp: 50 })
    const action = { id: 'resume', mapId: saved.id, combatId: 'modes', sourceMode: 'player' as const, status: 'pending' as const, type: 'dnd5e-plugin-action' as const,
      actorTokenId: 'caster', characterId: 'caster', targetTokenId: 'caster', dnd5ePluginAction: { featureId: `${namespace}:area-control.resume`, payload: { persistentAreaId: saved.dnd5ePluginAreas![0].id } }, round: 2, initiativeIndex: 0, seq: 1, updatedAt: 1 }
    const prepared = prepareDnd5ePluginFeatureAction({ action, map: saved, characters: [character], initiativeOrder: [{ tokenId: 'caster', label: 'Caster', emoji: '', color: '', roll: 20 }] })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) throw Error('prepare failed')
    expect(prepared.prepared.headlessAction.hostEntitlement).toEqual({ kind: 'persistent-area', areaId: saved.dnd5ePluginAreas![0].id })
    const resolved = await resolvePreparedDnd5ePluginFeatureAction({ prepared: prepared.prepared })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    if (!resolved.result.ok) throw Error('Headless resume failed')
    expect(resolved.result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(resolved.application).toBeDefined()
    const resumed = applyDnd5eActivityMapHandoffsV1({ map: resolved.application!.map, activity: getRegisteredDnd5eActivity(namespace, 'resume')!, packageId: namespace,
      actionId: action.id, actorId: 'caster', round: 2, worldMinute: 102, grantingPersistentAreaId: prepared.prepared.persistentAreaGrant!.areaId,
      selection: {}, handoffs: resolved.result.activityHandoffs! })
    expect(resumed.ok, JSON.stringify(resumed)).toBe(true)
    if (resumed.ok) expect(resumed.map.dnd5ePluginAreas![0].modeState?.paused).toBe(false)
  } finally { dispose() }
})


it('scales active and inactive profiles once and retains Host-selected trigger exemptions', () => {
  const activity: Dnd5eActivityDefinitionV1 = { ...root, scaling: [{ basis: 'slot-level', baseLevel: 1,
    adjustments: [{ operationId: 'area', diceCountPerStep: 1, flatAmountPerStep: 2, additionalUsesPerStep: 1, durationRoundsPerStep: 10 }] }] }
  const op = structuredClone(activity.outcomes[0].operations[0])
  if (op.kind !== 'create-persistent-area') throw Error('fixture')
  op.triggerExemptions = 'selected-creatures'
  const map = create({ ...activity, outcomes: [{ ...activity.outcomes[0], operations: [op] }] }, 'gust', 3)
  const profile = map.dnd5ePluginAreas![0].modeState!.profiles.find(p => p.id === 'down')!
  expect(profile.triggers?.[0]).toMatchObject({ damage: { count: 3, sides: 6, modifier: 4 }, maximumTotalUses: 4, excludedTokenIds: ['exempt'] })
  const down = change(map, 'select', 'scaled-down')
  expect(down.ok).toBe(true); if (!down.ok) throw Error('fixture')
  expect(down.map.dnd5ePluginAreas![0].triggers?.[0]).toEqual(profile.triggers?.[0])
  expect(down.map.dnd5ePluginAreas![0].expiresAtWorldMinute).toBe(112)
})

it('round-trips normalized occupant profiles without weakening empty-rule validation', () => {
  const normalized = normalizeDnd5ePersistentAreaModeDeclarations(profiles)!
  expect(normalizeDnd5ePersistentAreaModeDeclarations(normalized)).toEqual(normalized)
  expect(normalizeDnd5ePersistentAreaModeDeclarations([{ id: 'empty', occupantModifiers: { conditions: [] } }])).toBeUndefined()
  const state = resolveDnd5ePersistentAreaModeState({ profiles: normalized, initialModeId: 'down', direction: { dc: 1, dr: 0 }, sourceSaveDc: 17 })!
  expect(normalizeDnd5ePersistentAreaModeState(state)).toEqual(state)
})


it('keeps committed trigger limits through pause, reconciliation and a new encounter', () => {
  let map = create(root, 'down')
  map.tokens.push({ id: 'target', label: 'Target', type: 'enemy', size: 1, x: 175, y: 175, color: '', emoji: '', hp: 20, maxHp: 20 })
  const candidates = (current: BattleMap, turnKey: string) => collectDnd5ePersistentAreaTriggers({ map: current, timing: 'turn-start', round: 2, turnKey, targetTokenId: 'target' })
  const first = candidates(map, '2:target'); expect(first).toHaveLength(1)
  map.dnd5ePluginAreas = recordDnd5ePersistentAreaTrigger(map.dnd5ePluginAreas, first[0], 2, 4, false)
  const paused = change(map, 'pause', 'pause-used'); expect(paused.ok).toBe(true); if (!paused.ok) throw Error('fixture')
  expect(candidates(paused.map, '3:target')).toEqual([])
  const source = normalizeCharacter({ id: 'caster', concentrating: true, dnd5eCombatState: { concentrationSpellId: 'source-spell' } })
  const reconciled = reconcileDnd5ePluginAreasAndConcentrationOnMap(paused.map, [source], 8).map
  map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [rebaseDnd5ePluginAreasAfterCombat(reconciled, 8)] }))).maps[0]
  expect(map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(1)
  const resumed = change(map, 'resume', 'resume-used'); expect(resumed.ok).toBe(true); if (!resumed.ok) throw Error('fixture')
  map = resumed.map
  const second = candidates(map, '2:new-target'); expect(second).toHaveLength(1)
  map.dnd5ePluginAreas = recordDnd5ePersistentAreaTrigger(map.dnd5ePluginAreas, second[0], 2, 4, false)
  const calm = change(map, 'select', 'calm-used', 'calm'); expect(calm.ok).toBe(true); if (!calm.ok) throw Error('fixture')
  const down = change(calm.map, 'select', 'down-used'); expect(down.ok).toBe(true); if (!down.ok) throw Error('fixture')
  expect(candidates(down.map, '3:target')).toEqual([])
  expect(down.map.dnd5ePluginAreas![0].triggerReceipts).toHaveLength(2)
  const off = change(down.map, 'pause', 'pause-concentration'); expect(off.ok).toBe(true); if (!off.ok) throw Error('fixture')
  source.concentrating = false
  expect(reconcileDnd5ePluginAreasAndConcentrationOnMap(off.map, [source], 2).map.dnd5ePluginAreas).toEqual([])
})
it.each([{rectRotation:2},{rectAngleDegrees:37}])('reorients an existing mode through Host area selection without moving or refreshing its area: %j',orientation=>{
 const map=create(),baseline=structuredClone(map.dnd5ePluginAreas![0])
 if(root.target.kind!=='area')throw Error('Expected area fixture')
 const activity=control('select');activity.target={...root.target,rotatable:true}
 Object.assign(activity.outcomes[0].operations[0],{direction:'area-orientation'})
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const selected=resolveDnd5eActivityAreaMapSelectionV1({activity,map,actorToken:map.tokens[0],anchorCell:{col:0,row:0},...orientation})!
 const resolved=resolveDnd5eActivity({activity,actor,targets:[],rolls:{},choices:{mode:'gust'},areaPlacement:selected.areaPlacement,areaPlacementDistanceFeet:selected.areaPlacementDistanceFeet})
 expect(resolved.ok).toBe(true);if(!resolved.ok)throw Error('resolution')
 const request={map,activity,packageId:namespace,actionId:'rotate',actorId:actor.id,round:2,worldMinute:102,grantingPersistentAreaId:baseline.id,selection:{},areaSelection:selected,
 handoffs:{persistentAreas:[],movements:[],summons:[],invocations:[],areaModeChanges:resolved.proposals.filter(p=>p.kind==='change-granting-area-mode')}}
 const result=applyDnd5eActivityMapHandoffsV1(request)
 expect(result.ok).toBe(true);if(!result.ok)throw Error('handoff')
 const changed=result.map.dnd5ePluginAreas![0]
 expect(changed.directionalMovementCost?.direction).not.toEqual(baseline.directionalMovementCost?.direction)
 if(orientation.rectAngleDegrees!=null){
  expect(changed.directionalMovementCost?.direction.dc).toBeCloseTo(Math.cos((37-90)*Math.PI/180))
  expect(changed.directionalMovementCost?.direction.dr).toBeCloseTo(Math.sin((37-90)*Math.PI/180))
 }
 expect(changed).toMatchObject({id:baseline.id,cells:baseline.cells,anchorCell:baseline.anchorCell,expiresAfterRound:baseline.expiresAfterRound,expiresAtWorldMinute:baseline.expiresAtWorldMinute,concentrationId:baseline.concentrationId})
 expect(map.dnd5ePluginAreas![0]).toEqual(baseline)
 expect(applyDnd5eActivityMapHandoffsV1({...request,areaSelection:undefined}).ok).toBe(false)
 const replay=applyDnd5eActivityMapHandoffsV1({...request,map:result.map})
 expect(replay.ok).toBe(true);if(replay.ok)expect(replay.map.dnd5ePluginAreas![0]).toEqual(changed)
})
it.each([-1,360,NaN,Infinity])('rejects invalid explicit control angle %s',rectAngleDegrees=>{
 const map=create(),activity=control('select')
 if(root.target.kind!=='area')throw Error('Expected area')
 activity.target={...root.target,rotatable:true}
 expect(resolveDnd5eActivityAreaMapSelectionV1({activity,map,actorToken:map.tokens[0],anchorCell:{col:0,row:0},rectAngleDegrees})).toBeUndefined()
})
it('rejects a direction change on pause or an executable direction declaration',()=>{
 for(const [change,direction] of [['pause','area-orientation'],['select','callback']] as const){
  const activity=control(change);Object.assign(activity.outcomes[0].operations[0],{direction})
  expect(validateDnd5eActivityDefinitionV1(activity).some(error=>error.includes('direction'))).toBe(true)
 }
})
