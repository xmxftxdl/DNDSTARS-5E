import { expect, it } from 'vitest'
import type { BattleMap, Token } from '../../store/maps'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { createDnd5eMapCombatSnapshot, reconcileDnd5eBenefitDeathsAcrossMaps } from './mapBridge'
import { commitDnd5eActivityExecution } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { normalizeDnd5eBenefitRenewalRecord } from './benefitHistoryRenewal'
import type { Dnd5eBenefitHistoryAuthorityRecordV1 } from './spellAuthorityState'
import { prepareDnd5ePluginSpellCast, resolvePreparedDnd5ePluginSpellCast } from './pluginSpellTransaction'
import { parseDnd5eUnifiedContentBundleV1, dnd5eRulesPluginFromUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import type { SharedPlayerActionState } from '../../lib/sharedCombatTypes'
import { observeDnd5eCastingProximity } from './castingProximity'

const history: Dnd5eBenefitHistoryAuthorityRecordV1 = {
  schemaVersion: 1, id: 'benefit-history:["test.room","wedding"]', kind: 'benefit-history',
  sourceActorId: 'caster', subjectActorId: 'a', sourceActivityId: 'wedding', createdWorldMinute: 100,
  sourcePackageId: 'test.room', benefitKey: 'wedding',
  renewal: { kind: 'recipient-death', match: 'any', recipients: [{ actorId: 'a' }, { actorId: 'b' }] },
}
const definition: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'wedding', name: 'Wedding', activation: { kind: 'action', cost: 1 },
  target: { kind: 'creature', relation: 'any', minimumCount: 2, count: 2, rangeFeet: 10 },
  automation: automationCapabilityFromLegacyStatus('full'),
  consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  outcomes: [{ id: 'history', when: { kind: 'always' }, operations: [{ id: 'history',
    kind: 'establish-spell-authority', target: 'target', recordKind: 'benefit-history', benefitKey: 'wedding',
    benefitRenewal: { kind: 'recipient-death', match: 'any' } }] }],
}
function token(id: string, patch: Partial<Token> = {}): Token {
  return { id, label: id, type: 'enemy', x: 0, y: 0, color: '', emoji: '', size: 1, hp: 10, maxHp: 10, ...patch }
}
function map(id: string, tokens: Token[]): BattleMap {
  return { id, name: id, width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens }
}
function fixture(record = history) {
  return [map('current', [token('caster', { type: 'player', characterId: 'caster-sheet' }), token('a', { dnd5eCombatState: {
    schemaVersion: 2, spellAuthorityRecords: { [record.id]: record } } }), token('new')]), map('remote', [token('b')])]
}
function cast(maps: readonly BattleMap[], characters: ReturnType<typeof normalizeCharacter>[] = [], complete = true) {
  characters = [...characters, normalizeCharacter({ id: 'caster-sheet', name: 'Caster', currentHp: 10, maxHp: 10,
    dnd5eWorldTimeAppliedMinute: 200 })]
  const current = maps[0]
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'room-wedding', map: current, characters,
    roomMaps: complete ? maps : undefined, worldMinute: 200,
    initiativeOrder: current.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, color: '', emoji: '', roll: 20 - i })) })
  const state = snapshot.state, actor = state.combatants.caster
  const targets = ['a', 'new']
  const resolution = resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(actor, actor, state),
    targets: targets.map(id => dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[id], actor, state)),
    rolls: {}, distanceFeetByTargetId: { a: 0, new: 0 } })
  const result = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: 'wedding', targetIds: targets,
    resolution, source: { kind: 'spell', id: 'test.room:ceremony', packageId: 'test.room' } })
  if (!result.ok) expect(result.state.combatants.caster.turn).toEqual(state.combatants.caster.turn)
  return result
}

it('uses current certified death on other maps and refuses zero HP, missing and duplicate peers', () => {
  const maps = fixture()
  expect(cast(maps).ok).toBe(false)
  maps[1].tokens[0].hp = 0
  expect(cast(maps).ok).toBe(false)
  const local = structuredClone(maps)
  local[0].tokens.push(local[1].tokens[0])
  local[1].tokens = []
  expect(cast(local).ok).toBe(false)
  maps[1].tokens[0].dnd5eCombatState = { schemaVersion: 2, deathRound: 1 }
  expect(cast(maps).ok).toBe(true)
  expect(cast(maps, [], false).ok).toBe(false)
  expect(cast([...maps, map('duplicate', [token('b', { hp: 0, dnd5eCombatState: { schemaVersion: 2, deathRound: 1 } })])]).ok).toBe(false)
  maps[1].tokens = []
  expect(cast(maps).ok).toBe(false)
})

it('persists witnessed death through reload/deletion and revokes it when revival is known', () => {
  const maps = fixture()
  maps[1].tokens[0] = token('b', { hp: 0, dnd5eCombatState: { schemaVersion: 2, deathRound: 1 } })
  expect(reconcileDnd5eBenefitDeathsAcrossMaps({ maps, characters: [] }).maps).toBe(maps)
  const witnessed = reconcileDnd5eBenefitDeathsAcrossMaps({ maps, characters: [], worldMinute: 200 })
  const saved = JSON.parse(JSON.stringify(witnessed.maps)) as BattleMap[]
  const record = saved[0].tokens[1].dnd5eCombatState!.spellAuthorityRecords![history.id]
  expect(record).toMatchObject({ renewal: { deathWitnesses: [{ actorId: 'b', worldMinute: 200 }] } })
  expect(reconcileDnd5eBenefitDeathsAcrossMaps({ maps: witnessed.maps, characters: [], worldMinute: 201 }).maps).toBe(witnessed.maps)
  saved[1].tokens = []
  expect(cast(saved).ok).toBe(true)
  expect(cast(saved, [], false).ok).toBe(false)
  saved[1].tokens = [token('b')]
  expect(cast(saved).ok).toBe(false)
  const revived = reconcileDnd5eBenefitDeathsAcrossMaps({ maps: saved, characters: [], worldMinute: 202 })
  expect(revived.maps[0].tokens[1].dnd5eCombatState!.spellAuthorityRecords![history.id]).toMatchObject({ renewal: { recipients: history.renewal!.recipients } })
  expect((revived.maps[0].tokens[1].dnd5eCombatState!.spellAuthorityRecords![history.id] as Dnd5eBenefitHistoryAuthorityRecordV1).renewal!.deathWitnesses).toBeUndefined()
  const removedAgain = JSON.parse(JSON.stringify(revived.maps)) as BattleMap[]
  removedAgain[1].tokens = []
  expect(cast(removedAgain).ok).toBe(false)
})

it('resolves stable character identity without a map token and rejects forged witness metadata', () => {
  const record = structuredClone(history)
  record.renewal!.recipients = [{ actorId: 'a' }, { actorId: 'old-token', characterId: 'partner' }]
  const maps = fixture(record)
  maps[1].tokens = []
  const partner = normalizeCharacter({ id: 'partner', name: 'Partner', currentHp: 0, maxHp: 10, deathSaveFailures: 2 })
  expect(cast(maps, [partner]).ok).toBe(false)
  partner.deathSaveFailures = 3
  expect(cast(maps, [partner]).ok).toBe(true)
  const witnessed = reconcileDnd5eBenefitDeathsAcrossMaps({ maps, characters: [partner], worldMinute: 200 })
  partner.currentHp = 1
  expect(cast(witnessed.maps, [partner]).ok).toBe(false)
  for (const deathWitnesses of [ [{ actorId: 'intruder', worldMinute: 200 }],
    [{ actorId: 'b', worldMinute: -1 }], [{ actorId: 'b', worldMinute: 200, forged: true }],
    [{ actorId: 'b', worldMinute: 200 }, { actorId: 'b', worldMinute: 200 }] ]) {
    expect(normalizeDnd5eBenefitRenewalRecord({ ...history.renewal, deathWitnesses })).toBeUndefined()
  }
})

it('rechecks fresh Host room evidence after spell dice and refuses revival or concurrent benefit before costs', () => {
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle = parseDnd5eUnifiedContentBundleV1(JSON.stringify({ format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: 'test.room', name: 'Room renewal test', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace: 'test.room', version: '1.0.0', id: 'ceremony', kind: 'spell', name: 'Ceremony', automation,
      payload: { id: 'ceremony', name: 'Ceremony', level: 2, school: 'abjuration', ritual: false,
        castingTime: { value: 1, unit: 'action' }, range: { type: 'distance', feet: 10 },
        targeting: { relation: 'any', includeSelf: false, maximumTargets: 2 },
        components: { verbal: false, somatic: false, material: false }, duration: { type: 'instantaneous', concentration: false },
        classes: ['wizard'], description: 'Synthetic automation transport test', automation: { mode: 'reference-only' } },
      activities: [{ ...definition, castingConstraints: { maximumTargetDistanceFeet: 10 }, legacySource: { kind: 'spell', id: 'ceremony' } }] }] }))!
  expect(bundle).toBeTruthy()
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
  try {
    const maps = fixture()
    maps[1].tokens[0] = token('b', { hp: 0, dnd5eCombatState: { schemaVersion: 2, deathRound: 1 } })
    const actor = normalizeCharacter({ id: 'caster-sheet', name: 'Caster', rulesetId: 'dnd5e-2014-srd-5.1', charClass: '法师', level: 5,
      currentHp: 10, maxHp: 10, dnd5eWorldTimeAppliedMinute: 200,
      dnd5eClassChoices: { classes: { wizard: { selections: { 'spell-prepared': ['test.room:ceremony'] } } } },
      classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 3 } } })
    const action: SharedPlayerActionState = { id: 'room-cast', mapId: maps[0].id, combatId: 'room', sourceMode: 'player',
      status: 'pending', type: 'dnd5e-spell-cast', actorTokenId: 'caster', characterId: actor.id, targetTokenId: 'a',
      dnd5eSpellCast: { spellId: 'test.room:ceremony', castingClassId: 'wizard', slotLevel: 2,
        targetTokenId: 'a', targetTokenIds: ['a', 'new'] }, round: 1, initiativeIndex: 0, seq: 1, updatedAt: 1 }
    const prepared = prepareDnd5ePluginSpellCast({ action, map: maps[0], roomMaps: maps, characters: [actor], worldMinute: 200,
      initiativeOrder: maps[0].tokens.map((t, i) => ({ tokenId: t.id, label: t.label, color: '', emoji: '', roll: 20 - i })) })
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    const resolve = (currentRoom?: { maps: readonly BattleMap[]; characters: typeof actor[] }) =>
      resolvePreparedDnd5ePluginSpellCast({ prepared: prepared.prepared, currentRoom, rolls: { activityRolls: {} } })
    const successful = resolve({ maps, characters: [actor] })
    expect(successful.result.ok, JSON.stringify(successful.result)).toBe(true)
    const revived = structuredClone(maps)
    revived[1].tokens[0].hp = 1
    const changed = resolve({ maps: revived, characters: [actor] })
    expect(changed.result).toMatchObject({ ok: false, reason: 'invalid-target', events: [] })
    expect(changed.application).toBeUndefined()
    expect(changed.result.state.combatants.caster.classResources['dnd5e-spell-slot-2'].current).toBe(1)
    const concurrent = structuredClone(maps)
    concurrent[0].tokens[2].dnd5eCombatState = { schemaVersion: 2, spellAuthorityRecords: { [history.id]: {
      ...history, subjectActorId: 'new', renewal: { kind: 'recipient-death', match: 'any',
        recipients: [{ actorId: 'new' }, { actorId: 'b' }] } } } }
    expect(resolve({ maps: concurrent, characters: [actor] }).result).toMatchObject({ ok: false, reason: 'invalid-target', events: [] })
    const excursion = structuredClone(maps)
    excursion[0].tokens[1].x = 40
    expect(observeDnd5eCastingProximity(prepared.prepared.castingProximityReceipt!, excursion[0])).toBe(false)
    const returned = resolve({ maps, characters: [actor] })
    expect(returned.result).toMatchObject({ ok: false, reason: 'invalid-target', events: [] })
    expect(returned.application).toBeUndefined()
    expect(returned.result.state.combatants.caster.classResources['dnd5e-spell-slot-2'].current).toBe(1)
    expect(resolve().result.ok).toBe(false)
    expect(actor.classResources!['dnd5e-spell-slot-2'].current).toBe(1)
  } finally { dispose() }
})
