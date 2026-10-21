import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { mergePlayerCharactersStateForAuthority, projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
import { dnd5eRestorableOriginalAlignment } from './alignmentRestoration'
import { dnd5eCombatantPairKey } from './headlessCombatPrimitives'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { compileDnd5eActivityHeadlessAction } from './activities/dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './activities/dnd5eActivityFeatureActionAdapter'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import { validateDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import type { BattleMap } from '../../store/maps'
import { migrateMapsState } from '../../store/maps'

const definition: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'restore', name: 'Synthetic alignment restoration', activation: { kind: 'action' },
  legacySource: { kind: 'feature', id: 'restore' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 10 },
  automation: automationCapabilityFromLegacyStatus('full'),
  consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
  checks: [{ id: 'insight', kind: 'skill-check', ability: 'wis', skill: 'insight', rollId: 'insight', scope: 'shared',
    dc: { kind: 'constant', value: 20 }, rollMode: 'normal' }],
  outcomes: [{ id: 'restore', when: { kind: 'check', checkId: 'insight', result: 'success' },
    operations: [{ id: 'restore', kind: 'restore-original-alignment', target: 'target' }] }],
}
function fixture() {
  const actor = createDnd5eCombatant({ id: 'caster', name: 'Caster', controller: 'player', initiative: 20,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  actor.pluginFeatureIds = ['local.alignment:restore']
  const target = createDnd5eCombatant({ ...actor, id: 'recipient', initiative: 10,
    alignment: '混乱邪恶', originalAlignment: '守序善良' })
  const state = startDnd5eHeadlessCombat('alignment-test', [actor, target])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(actor.id, target.id)]: 0 }
  return state
}

it.each(['commit', 'compiled'] as const)('restores Host-recorded alignment through %s and rejects missing or invalid history without costs', route => {
  expect(validateDnd5eActivityDefinitionV1(definition)).toEqual([])
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'local.alignment', name: 'Alignment', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' }, setup(api) {
    api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(definition))
    api.registerFeature({ id: definition.id, name: definition.name, summary: 'Test', description: 'Test', automation: 'full', action: dnd5ePluginFeatureActionFromActivityV1(definition) })
  } })
  const registration = registerDnd5eActivityPackage({ packageId: 'local.alignment', packageVersion: '1.0.0', activities: [definition] })
  try {
    for (const mode of ['success', 'failed-check', 'missing-history', 'invalid-history', 'already-restored']) {
      const state = fixture()
      if (mode === 'missing-history') state.combatants.recipient.originalAlignment = undefined
      if (mode === 'invalid-history') state.combatants.recipient.originalAlignment = 'invented'
      if (mode === 'already-restored') state.combatants.recipient.alignment = '守序善良'
      const before = structuredClone(state), d20 = mode === 'failed-check' ? 15 : 16
      const resolution = resolveDnd5eActivity({ activity: definition,
        actor: dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.caster),
        targets: [dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.recipient)], rolls: { insight: { values: [d20] } },
        distanceFeetByTargetId: { recipient: 0 } })
      const result = route === 'commit' ? commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: definition.id,
        targetIds: ['recipient'], resolution }) : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: 'local.alignment',
        actionId: definition.id, featureId: 'local.alignment:restore', actorId: 'caster', targetId: 'recipient', distanceFeet: 0,
        rolls: { insight: { values: [d20], modifier: 0, total: d20 } } })
      expect(result.ok, JSON.stringify(result)).toBe(mode === 'success' || mode === 'failed-check')
      expect(state).toEqual(before)
      if (mode === 'success') {
        expect(result.state.combatants.recipient.alignment).toBe('守序善良')
        expect(result.events).toContainEqual(expect.objectContaining({ type: 'original-alignment-restored', previousAlignment: '混乱邪恶', alignment: '守序善良' }))
        const loaded = JSON.parse(JSON.stringify(result.state)) as typeof state
        expect(dnd5eRestorableOriginalAlignment(loaded.combatants.recipient)).toBeUndefined()
      } else expect(result.state.combatants.recipient.alignment).toBe(before.combatants.recipient.alignment)
      expect(result.state.combatants.caster.turn.actionAvailable).toBe(!(mode === 'success' || mode === 'failed-check'))
    }
  } finally { registration.dispose(); dispose() }
})

it('maps the restored alignment back to the same character and retains its original fact through normalization', () => {
  const recipient = normalizeCharacter({ id: 'recipient-char', name: 'Recipient', alignment: '混乱邪恶', dnd5eOriginalAlignment: '守序善良' })
  const map: BattleMap = { id: 'alignment-map', name: 'Map', width: 100, height: 100, gridSize: 10, gridOffsetX: 0,
    gridOffsetY: 0, showGrid: true, tokens: [{ id: 'recipient-token', characterId: recipient.id, label: 'Recipient', x: 0, y: 0,
      color: '', emoji: '', size: 1, type: 'player' }] }
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'alignment-map-test', map, characters: [recipient],
    initiativeOrder: [{ tokenId: 'recipient-token', label: 'Recipient', emoji: '', color: '', roll: 10 }] })
  expect(snapshot.state.combatants['recipient-token']).toMatchObject({ alignment: '混乱邪恶', originalAlignment: '守序善良' })
  snapshot.state.combatants['recipient-token'].alignment = '守序善良'
  const application = planDnd5eMapResultApplication({ state: snapshot.state, map, characters: [recipient],
    characterIdByCombatantId: snapshot.characterIdByCombatantId })
  if (!application.characterPatches) throw new Error('missing character patches')
  expect(application.characterPatches[recipient.id]).toMatchObject({ alignment: '守序善良' })
  const loaded = normalizeCharacter(JSON.parse(JSON.stringify({ ...recipient, ...application.characterPatches[recipient.id] })))
  expect(loaded).toMatchObject({ alignment: '守序善良', dnd5eOriginalAlignment: '守序善良' })
  expect(normalizeCharacter({ ...recipient, dnd5eOriginalAlignment: 'unknown' }).dnd5eOriginalAlignment).toBeUndefined()
  expect(normalizeCharacter({ id: 'legacy', alignment: '混乱邪恶' }).dnd5eOriginalAlignment).toBeUndefined()
})

it('preserves DM history on player overwrite and strips forged history from newly uploaded player characters', () => {
  const current = { characters: [{ id: 'owned', roomMemberId: 'member', dnd5eOriginalAlignment: '守序善良' }] }
  const merged = mergePlayerCharactersStateForAuthority(current, { characters: [
    { id: 'owned', roomMemberId: 'member', dnd5eOriginalAlignment: '混乱邪恶' },
    { id: 'new', roomMemberId: 'member', dnd5eOriginalAlignment: '混乱善良' },
  ] }, 'member', {})
  expect(merged.characters.find(character => character.id === 'owned')?.dnd5eOriginalAlignment).toBe('守序善良')
  expect(merged.characters.find(character => character.id === 'new')?.dnd5eOriginalAlignment).toBeUndefined()
})

it('rejects an authored replacement alignment because restoration must read Host facts', () => {
  const invalid = structuredClone(definition)
  Object.assign(invalid.outcomes[0].operations[0], { alignment: '混乱邪恶' })
  expect(validateDnd5eActivityDefinitionV1(invalid).join(';')).toContain('authored alignment values are forbidden')
})

it('restores an independent monster and saves its current alignment without losing original history on map reload', () => {
  const caster = normalizeCharacter({ id: 'caster-character', name: 'Caster', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 } })
  const map: BattleMap = { id: 'monster-alignment-map', name: 'Map', width: 100, height: 100, gridSize: 10,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [
      { id: 'caster-token', characterId: caster.id, label: 'Caster', x: 0, y: 0, color: '', emoji: '', size: 1, type: 'player' },
      { id: 'monster', label: 'Goblin', poolId: 'srd-5.1:goblin', x: 10, y: 0, color: '', emoji: '', size: 1, type: 'enemy',
        hp: 7, maxHp: 7, dnd5eAlignment: '混乱邪恶', dnd5eOriginalAlignment: '守序善良' },
    ] }
  const normalized = migrateMapsState(JSON.parse(JSON.stringify({ maps: [map], selectedId: map.id }))).maps[0]
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'monster-alignment-test', map: normalized, characters: [caster],
    initiativeOrder: normalized.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - 10 * index })) })
  expect(snapshot.state.combatants.monster).toMatchObject({ alignment: '混乱邪恶', originalAlignment: '守序善良' })
  const resolution = resolveDnd5eActivity({ activity: definition,
    actor: dnd5eActivityActorSnapshotFromCombatantV1(snapshot.state.combatants['caster-token']),
    targets: [dnd5eActivityActorSnapshotFromCombatantV1(snapshot.state.combatants.monster)],
    rolls: { insight: { values: [16] } }, distanceFeetByTargetId: { monster: 5 } })
  const committed = commitDnd5eActivityExecution(snapshot.state, { actorId: 'caster-token', activityId: definition.id, targetIds: ['monster'], resolution })
  if (!committed.ok) throw new Error(JSON.stringify(committed))
  expect(committed.state.combatants.monster.alignment).toBe('守序善良')
  const application = planDnd5eMapResultApplication({ state: committed.state, map: normalized, characters: [caster],
    characterIdByCombatantId: snapshot.characterIdByCombatantId })
  expect(application.tokenPatches?.monster).toMatchObject({ dnd5eAlignment: '守序善良' })
  const loaded = migrateMapsState({ maps: [{ ...normalized, tokens: normalized.tokens.map(token => ({ ...token, ...application.tokenPatches?.[token.id] })) }] }).maps[0]
  expect(loaded.tokens.find(token => token.id === 'monster')).toMatchObject({ dnd5eAlignment: '守序善良', dnd5eOriginalAlignment: '守序善良' })
  for (const token of loaded.tokens) { token.visibilityMode = 'always'; token.showDetailOnToken = false }
  const publicState = projectMapsForPlayer({ maps: [loaded] }, { maps: [] }, null, { characters: [caster] }) as { maps: BattleMap[] }
  const publicMonster = publicState.maps[0].tokens.find(token => token.id === 'monster')!
  expect(publicMonster).toBeDefined()
  expect(publicMonster.dnd5eOriginalAlignment).toBeUndefined()
  expect(publicMonster.dnd5eAlignment).toBeUndefined()
  expect(loaded.tokens.find(token => token.id === 'monster')?.dnd5eOriginalAlignment).toBe('守序善良')
})
