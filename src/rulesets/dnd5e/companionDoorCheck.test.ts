import { afterEach, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { prepareDnd5eCompanionObjectCheck, resolveDnd5eCompanionObjectAction } from './companionObjectAction'
import { resolveDnd5eCompanionReadyAction } from './companionReadyAction'
import { resolveDnd5eReadiedObjectAction } from './readiedObjectAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { normalizeDnd5eCompanionObjectInteraction } from './companionObjectInteraction'

afterEach(() => setMapGeometryRuntime([]))
function fixture(monster = 'skeleton') {
  const actor: Token = { id: 'undead', label: 'Undead', emoji: '', color: '', type: 'enemy',
    x: 25, y: 25, size: 1, hp: 13, maxHp: 13, poolId: `srd-5.1:${monster}`,
    dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon', sourceCharacterId: 'caster',
      sourceTokenId: 'owner', createdRound: 1, expiresAfterRound: 600, side: 'enemy', commandPolicy: 'persistent-order' },
    dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner', sourceFeatureId: 'summon',
      issuedRound: 1, persistentOrder: true, command: 'use-object', objectInteraction: { mapId: 'scene', doorId: 'door', operation: 'break' } } } }
  const map: BattleMap = { id: 'scene', name: 'Scene', width: 800, height: 400, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5, tokens: [actor,
      { id: 'other', label: 'Other', emoji: '', color: '', type: 'enemy', poolId: 'srd-5.1:goblin', hp: 7, x: 575, y: 25, size: 1 }] }
  const geometry = createEmptyMapGeometry(map.id)
  geometry.doors.push({ id: 'door', kind: 'door', label: 'Door', secret: false, state: 'locked',
    openState: 'closed', lockState: 'locked', physicalState: 'intact', interaction: { breakDc: 15, lockPickDc: 15, secretDc: 15, requiresThievesTools: true },
    points: [{ x: 50, y: 0 }, { x: 50, y: 50 }], blocksVision: true, blocksMovement: true,
    blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
  setMapGeometryRuntime([geometry])
  const input = { map, characters: [], actorTokenId: actor.id, combatId: 'door-check', round: 1,
    initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index })) }
  return { actor, map, geometry, input }
}

it.each(['skeleton', 'zombie'])('uses %s statistics, persists failure for next turn and ends the order on success', monster => {
  const { input, map, geometry } = fixture(monster)
  const before = structuredClone(map)
  expect(prepareDnd5eCompanionObjectCheck(input)).toMatchObject({ dc: 15, mode: 'normal', checkAbility: 'str' })
  const failed = resolveDnd5eCompanionObjectAction({ ...input, d20: 1 })!
  expect(failed.result.ok).toBe(true)
  expect(failed.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', actorId: 'undead',
    modifier: monster === 'zombie' ? 1 : 0, success: false }))
  expect(failed.door).toMatchObject({ openState: 'closed', physicalState: 'intact' })
  expect(failed.result.state.combatants.undead.turn).toMatchObject({ actionAvailable: false, objectInteractionAvailable: true })
  const ended = resolveDnd5eHeadlessAction(failed.result.state, { type: 'end-turn', actorId: 'undead' })
  expect(ended.ok).toBe(true)
  expect(ended.state.combatants.undead.classState.companionCommand).toMatchObject({ command: 'use-object' })
  expect(ended.state.combatants.undead.classState.companionCommand?.objectInteractionCompleted).toBeUndefined()
  const saved = JSON.parse(JSON.stringify(planDnd5eMapResultApplication({ state: ended.state, map, characters: [],
    characterIdByCombatantId: {}, events: [...ended.events] }).map)) as BattleMap
  const success = resolveDnd5eCompanionObjectAction({ ...input, map: saved, round: 2, d20: 20,
    turnEconomy: createDnd5eTurnEconomyCounts('next', 30) })!
  expect(success.result.ok).toBe(true)
  expect(success.door).toMatchObject({ openState: 'open', physicalState: 'broken' })
  expect(success.result.state.combatants.undead.classState.companionCommand).toBeUndefined()
  expect(success.application!.map.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
  expect(map).toEqual(before)
  expect(geometry.doors[0].physicalState).toBe('intact')
})

it.each(['missing-die', 'invalid-die', 'missing-second', 'no-action', 'far', 'wrong-id', 'dead', 'lost-control'] as const)('rejects invalid force attempt atomically: %s', variant => {
  const { input } = fixture()
  const state = createDnd5eMapCombatSnapshot(input).state
  const actor = state.combatants.undead
  if (variant === 'no-action') actor.turn.actionAvailable = false
  if (variant === 'far') actor.position.x = 475
  if (variant === 'dead') actor.currentHp = 0
  if (variant === 'lost-control') actor.summonedUncontrolledSubtype = 'undead'
  if (variant === 'missing-second') actor.classState.monsterDamageAversionActive = true
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'use-object', actorId: 'undead',
    interactionId: variant === 'wrong-id' ? 'break:other' : 'break:door', d20: variant === 'missing-die' ? undefined : variant === 'invalid-die' ? 21 : 20 })
  expect(result.ok).toBe(false)
  expect(result.state).toEqual(before)
  expect(state).toEqual(before)
})

it.each(['advantage', 'disadvantage'] as const)('uses both dice for %s', mode => {
  const { input } = fixture()
  const state = createDnd5eMapCombatSnapshot(input).state
  if (mode === 'advantage') state.combatants.undead.classState.helpedAbilityCheckSourceId = 'other'
  else state.combatants.undead.classState.monsterDamageAversionActive = true
  const result = resolveDnd5eHeadlessAction(state, { type: 'use-object', actorId: 'undead', interactionId: 'break:door', d20: 1, d20Second: 20 })
  expect(result.ok).toBe(true)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', mode, d20: mode === 'advantage' ? 20 : 1 }))
  expect(result.state.companionScene!.geometry!.doors[0].openState).toBe(mode === 'advantage' ? 'open' : 'closed')
})

it('uses current magical lock DC and preserves its suppression clock', () => {
  const { input, geometry } = fixture()
  geometry.doors[0].dnd5eArcaneLock = { schemaVersion: 1, sourceTokenId: 'other', sourceActivityId: 'lock', spellLevel: 2,
    previousLocked: true, suppression: { kind: 'campaign-time', untilWorldMinute: 30 } }
  setMapGeometryRuntime([geometry])
  const suppressed = resolveDnd5eCompanionObjectAction({ ...input, worldMinute: 29, d20: 20 })!
  const active = resolveDnd5eCompanionObjectAction({ ...input, worldMinute: 30, d20: 20 })!
  expect(suppressed.door?.openState).toBe('open')
  expect(active.door?.openState).toBe('closed')
  expect(active.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', dc: 25, success: false }))
})

it.each([1, 20])('declares and reloads readied force, then checks on trigger using only reaction: %s', d20 => {
  const { actor, input, map } = fixture()
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready',
    ready: { trigger: 'signal', actionKind: 'interact-object' } }
  const declared = resolveDnd5eCompanionReadyAction(input)!
  expect(declared.result.ok).toBe(true)
  expect(declared.result.events.some(e => e.type === 'ability-check-resolved')).toBe(false)
  const ended = resolveDnd5eHeadlessAction(declared.result.state, { type: 'end-turn', actorId: 'undead' })
  const saved: BattleMap = JSON.parse(JSON.stringify(planDnd5eMapResultApplication({ state: ended.state, map, characters: [],
    characterIdByCombatantId: {}, events: [...ended.events] }).map))
  const economy = createDnd5eTurnEconomyCounts('ready', 30); economy.action.current = 0
  const result = resolveDnd5eReadiedObjectAction({ ...input, map: saved, currentInitiativeIndex: 1, turnEconomy: economy, d20 })!
  expect(result.result.ok).toBe(true)
  expect(result.door?.openState).toBe(d20 === 20 ? 'open' : 'closed')
  expect(result.result.state.initiativeIndex).toBe(1)
  expect(result.result.state.combatants.undead.turn).toMatchObject({ actionAvailable: false, reactionAvailable: false, objectInteractionAvailable: true })
  expect(result.result.events.filter(e => e.type === 'turn-resource-spent')).toEqual([
    expect.objectContaining({ resource: 'reaction' })])
  expect(result.application!.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
})

it('accepts a bounded break reference but rejects submitted DC or result', () => {
  const selection = { mapId: 'scene', doorId: 'door', operation: 'break' }
  expect(normalizeDnd5eCompanionObjectInteraction(selection)).toEqual(selection)
  expect(normalizeDnd5eCompanionObjectInteraction({ ...selection, dc: 1 })).toBeUndefined()
  expect(normalizeDnd5eCompanionObjectInteraction({ ...selection, success: true })).toBeUndefined()
})

it('does not request a door die with a spent action, completed order or dead actor', () => {
  const { input, actor } = fixture()
  const economy = createDnd5eTurnEconomyCounts('spent', 30)
  economy.action.current = 0
  expect(prepareDnd5eCompanionObjectCheck({ ...input, turnEconomy: economy })).toBeUndefined()
  economy.action.current = 1
  expect(prepareDnd5eCompanionObjectCheck({ ...input, turnEconomy: economy })).toMatchObject({ dc: 15 })
  actor.dnd5eCombatState!.companionCommand!.objectInteractionCompleted = true
  expect(prepareDnd5eCompanionObjectCheck(input)).toBeUndefined()
  delete actor.dnd5eCombatState!.companionCommand!.objectInteractionCompleted
  actor.hp = 0
  expect(prepareDnd5eCompanionObjectCheck(input)).toBeUndefined()
})

it('requests a readied door die using reaction availability independently of the action', () => {
  const { input, actor } = fixture()
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready',
    ready: { trigger: 'signal', actionKind: 'interact-object' } }
  const declared = resolveDnd5eCompanionReadyAction(input)!
  expect(declared.result.ok).toBe(true)
  const map = JSON.parse(JSON.stringify(declared.application!.map)) as BattleMap
  const economy = createDnd5eTurnEconomyCounts('ready', 30)
  economy.action.current = 0
  expect(prepareDnd5eCompanionObjectCheck({ ...input, map, readied: true, turnEconomy: economy })).toMatchObject({ dc: 15 })
  economy.reaction.current = 0
  expect(prepareDnd5eCompanionObjectCheck({ ...input, map, readied: true, turnEconomy: economy })).toBeUndefined()
})
