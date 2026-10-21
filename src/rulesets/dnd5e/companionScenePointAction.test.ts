import { afterEach, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import type { BattleMap, Token } from '../../store/maps'
import { normalizeSharedSceneOrchestration } from '../../lib/sceneOrchestration'
import { setSceneInteractionRuntime } from '../../lib/sceneInteractionRuntime'
import { setMapGeometryRuntime, createEmptyMapGeometry } from '../../lib/mapGeometry'
import { prepareDnd5eCompanionObjectCheck, resolveDnd5eCompanionObjectAction } from './companionObjectAction'
import { createDnd5eTurnEconomyCounts } from './turnEconomy'
import { normalizeDnd5eCompanionObjectInteraction } from './companionObjectInteraction'
import { normalizeSharedRoomJournal } from '../../lib/roomCommunications'
import { dnd5eExecutableCompanionOrder, dnd5eRetryableCompanionSceneOrder } from './companionOrderExecution'
import { resolveDnd5eCompanionReadyAction } from './companionReadyAction'
import { resolveDnd5eReadiedObjectAction } from './readiedObjectAction'
import { resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { planDnd5eMapResultApplication } from './mapBridge'
import { droppedDnd5eCompanionObjects, dnd5eCompanionCarriedWeightPounds } from './companionCarriedObjects'
import { prepareDnd5eMapInventoryPickup } from './mapInventoryPickup'
import { migrateMapsState } from '../../store/maps'
import { reconcileDnd5eSummonedCreatures } from './summonedCreatures'

afterEach(() => { setSceneInteractionRuntime([]); setMapGeometryRuntime([]) })
function fixture() {
  const owner = normalizeCharacter({ id: 'caster', name: 'Caster', charClass: '法师', level: 20, maxHp: 100, currentHp: 100,
    abilities: { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 20 }, equipment: {} } as any)
  const actor: Token = { id: 'undead', label: 'Skeleton', emoji: '', color: '', type: 'enemy',
    x: 25, y: 25, size: 1, hp: 13, maxHp: 13, poolId: 'srd-5.1:skeleton',
    dnd5eSummon: { schemaVersion: 1, pluginId: 'test', featureId: 'summon', sourceCharacterId: 'caster',
      sourceTokenId: 'owner', createdRound: 1, expiresAfterRound: 600, side: 'player', commandPolicy: 'persistent-order' },
    dnd5eCombatState: { companionCommand: { schemaVersion: 1, sourceOwnerId: 'owner', sourceFeatureId: 'summon',
      issuedRound: 1, persistentOrder: true, command: 'use-object', objectInteraction: {
        mapId: 'map', sceneId: 'scene', interactionPointId: 'point', operation: 'interact-point' } } } }
  const map: BattleMap = { id: 'map', name: 'Map', width: 800, height: 400, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
    showGrid: true, feetPerCell: 5, tokens: [actor, { id: 'owner', characterId: owner.id, type: 'player', label: 'Caster',
      x: 325, y: 25, size: 1, emoji: '', color: '' }] }
  const shared = normalizeSharedSceneOrchestration({ scenes: [{ id: 'scene', mapId: 'map', name: 'Scene', interactionPoints: [{
    id: 'point', name: 'Trap', enabled: true, visibleToPlayers: true, x: 75, y: 25, interactionRadiusFeet: 5,
    repeat: 'once', check: { label: 'Lift', selection: 'ability:str', dc: 15, mode: 'normal' }, rewards: [],
    successEffects: [{ id: 'blind', kind: 'condition', condition: 'blinded', duration: { type: 'rounds', rounds: 2 } }],
    failureEffects: [{ id: 'fire', kind: 'damage', count: 1, sides: 6, bonus: 0, damageType: 'fire' }] }] }] })
  const scene = shared.scenes[0], point = scene.interactionPoints[0]
  setSceneInteractionRuntime(shared.scenes)
  const input = { map, characters: [owner], actorTokenId: actor.id, combatId: 'scene-check', round: 1,
    initiativeOrder: map.tokens.map((token, index) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - index })) }
  return { actor, owner, point, scene, input }
}

it.each([1, 20])('uses the skeleton modifier and actual outcome, consumes action, persists receipt: d20=%s', d20 => {
  const { input, actor, owner } = fixture(), before = structuredClone(input)
  expect(prepareDnd5eCompanionObjectCheck(input)).toMatchObject({ dc: 15, checkAbility: 'str' })
  const result = resolveDnd5eCompanionObjectAction({ ...input, d20, damageRollsByEffectId: { fire: [4] } })!
  expect(result?.result.ok).toBe(true)
  expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', actorId: actor.id, modifier: 0, success: d20 === 20 }))
  expect(result.result.state.combatants[actor.id].turn).toMatchObject({ actionAvailable: false, objectInteractionAvailable: true })
  expect(result.result.state.combatants[actor.id].currentHp).toBe(d20 === 20 ? 13 : 9)
  const app = result.application!
  expect(app.map.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
  expect(app.characterPatches?.[owner.id]?.dnd5eInventory?.authorityGrantReceipts).toHaveLength(1)
  expect(app.characters[0].currentHp).toBe(owner.currentHp)
  const restored = JSON.parse(JSON.stringify({ map: app.map, characters: app.characters }))
  restored.map.tokens[0].dnd5eCombatState.companionCommand = actor.dnd5eCombatState!.companionCommand
  expect(resolveDnd5eCompanionObjectAction({ ...input, ...restored, round: 2, d20: 20,
    turnEconomy: createDnd5eTurnEconomyCounts('new', 30) })).toBeUndefined()
  expect(input).toEqual(before)
})

it('requests damage dice only for the selected failure branch without applying the check', () => {
  const { input } = fixture(), before = structuredClone(input)
  const pending = resolveDnd5eCompanionObjectAction({ ...input, d20: 1 })!
  expect(pending.application).toBeUndefined()
  expect('requiredDamageEffects' in pending && pending.requiredDamageEffects).toEqual([expect.objectContaining({ id: 'fire', count: 1, sides: 6 })])
  expect(input).toEqual(before)
  expect(resolveDnd5eCompanionObjectAction({ ...input, d20: 1, damageRollsByEffectId: { fire: [7] } })).toBeUndefined()
})

it.each([1, 20])('settles grove guardian scene outcomes using its statistics and caster receipt: %s', d20 => {
  const { input, actor, point, owner } = fixture()
  actor.poolId = 'srd-5.1:awakened-tree'
  actor.hp = actor.maxHp = 59
  actor.size = 3
  actor.x = actor.y = 175
  point.x = 275
  point.y = 175
  point.rewards = [{ templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 2, identified: false }]
  actor.dnd5eSummon = undefined
  actor.dnd5eGroveGuardian = { schemaVersion: 1, castId: 'grove', boundaryAreaId: 'guardians', sourceTokenId: 'owner',
    originalTree: { id: actor.id, label: 'Tree', type: 'obstacle', x: 175, y: 175, size: 1, color: '', emoji: '',
      dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' } } }
  input.map.dnd5ePluginAreas = [{ id: 'guardians', label: 'Guardians', color: '', pluginId: 'test', featureId: 'summon',
    sourceCharacterId: owner.id, sourceTokenId: 'owner', createdRound: 1, expiresAfterRound: 14400,
    effectGroup: { castId: 'grove', effectId: 'guardians' }, cells: [{ col: 3, row: 3 }] }]
  const before = structuredClone(input)
  const result = resolveDnd5eCompanionObjectAction({ ...input, d20, damageRollsByEffectId: { fire: [4] } })
  expect(result?.result.ok).toBe(true)
  expect(result?.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', actorId: actor.id,
    modifier: 4, success: d20 === 20 }))
  expect(result?.application?.characterPatches?.[owner.id]?.dnd5eInventory?.authorityGrantReceipts).toHaveLength(1)
  expect(result?.application?.map.tokens.find(t => t.id === actor.id)?.dnd5eGroveGuardian).toBeDefined()
  expect(result?.application?.map.tokens.find(t => t.id === actor.id)?.dnd5eSummon).toBeUndefined()
  expect(result?.result.state.combatants[actor.id].turn.actionAvailable).toBe(false)
  if (!result?.application) throw Error('Missing guardian scene application')
  const saved = migrateMapsState(JSON.parse(JSON.stringify({ maps: [result.application.map] }))).maps[0]
  const recipient = saved.tokens.find(t => t.id === actor.id)!
  expect(recipient.dnd5eCarriedObjects ?? []).toHaveLength(d20 === 20 ? 2 : 0)
  if (d20 === 20) {
    expect(recipient.dnd5eCarriedObjects!.map(item => item.objectState.inventoryItem)).toEqual([
      expect.objectContaining({ templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1, identified: false }),
      expect.objectContaining({ templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1, identified: false }),
    ])
    expect(dnd5eCompanionCarriedWeightPounds(recipient.dnd5eCarriedObjects)).toBe(6)
  }
  recipient.dnd5eCombatState!.companionCommand = actor.dnd5eCombatState!.companionCommand
  expect(resolveDnd5eCompanionObjectAction({ ...input, map: saved, characters: result.application.characters,
    d20: 20, round: 2, turnEconomy: createDnd5eTurnEconomyCounts('retry', 20) })).toBeUndefined()
  expect(input).toEqual(before)
})

it.each(['far', 'high', 'wall', 'dead', 'control', 'disabled', 'hidden', 'spent', 'wrong-source', 'reward', 'invalid-die'] as const)('rejects atomically: %s', variant => {
  const { input, actor, point } = fixture()
  if (variant === 'far') actor.x = 725
  if (variant === 'high') actor.elevationFeet = 30
  if (variant === 'wall') { const geometry = createEmptyMapGeometry('map'); geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall',
    points: [{ x: 50, y: 0 }, { x: 50, y: 400 }], blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 20, createdAt: 1 }); setMapGeometryRuntime([geometry]) }
  if (variant === 'dead') actor.hp = 0
  if (variant === 'control') actor.dnd5eSummon!.controlEnded = true
  if (variant === 'disabled') point.enabled = false
  if (variant === 'hidden') point.visibleToPlayers = false
  if (variant === 'wrong-source') actor.dnd5eCombatState!.companionCommand!.sourceOwnerId = 'fake'
  if (variant === 'reward') point.rewards = [{ templateId: 'missing', quantity: 1, identified: true }]
  const economy = createDnd5eTurnEconomyCounts('turn', 30)
  if (variant === 'spent') economy.action.current = 0
  const before = structuredClone(input)
  expect(resolveDnd5eCompanionObjectAction({ ...input, turnEconomy: economy, d20: variant === 'invalid-die' ? 21 : 20 })).toBeUndefined()
  expect(input).toEqual(before)
})

it('only permits bounded point references, not supplied DC or outcome', () => {
  const value = { mapId: 'map', sceneId: 'scene', interactionPointId: 'point', operation: 'interact-point' }
  expect(normalizeDnd5eCompanionObjectInteraction(value)).toEqual(value)
  expect(normalizeDnd5eCompanionObjectInteraction({ ...value, dc: 0 })).toBeUndefined()
  expect(normalizeDnd5eCompanionObjectInteraction({ ...value, success: true })).toBeUndefined()
})

it.each(['once', 'per-character'] as const)('shares only the appropriate receipt scope between two undead: %s', repeat => {
  const { input, point } = fixture()
  point.repeat = repeat
  const first = resolveDnd5eCompanionObjectAction({ ...input, d20: 20 })!
  expect(first.application).toBeDefined()
  const second = structuredClone(input.map.tokens[0])
  second.id = 'second'
  const map = { ...first.application!.map, tokens: [...first.application!.map.tokens, second] }
  const result = resolveDnd5eCompanionObjectAction({ ...input, map, characters: first.application!.characters,
    actorTokenId: second.id, d20: 20, initiativeOrder: [...input.initiativeOrder,
      { tokenId: second.id, label: second.label, emoji: '', color: '', roll: 1 }] })
  if (repeat === 'once') expect(result).toBeUndefined()
  else {
    expect(result?.result.ok).toBe(true)
    expect(result!.application!.characters[0].dnd5eInventory!.authorityGrantReceipts).toHaveLength(2)
  }
})

it('retains a repeatable failed task across rounds and rejects replay of the same attempt', () => {
  const { input, point } = fixture()
  point.repeat = 'always'
  const first = resolveDnd5eCompanionObjectAction({ ...input, d20: 1, damageRollsByEffectId: { fire: [2] } })!
  const saved = JSON.parse(JSON.stringify(first.application))
  expect(saved.map.tokens[0].dnd5eCombatState.companionCommand.command).toBe('use-object')
  const next = { ...input, map: saved.map, characters: saved.characters, d20: 20,
    turnEconomy: createDnd5eTurnEconomyCounts('next', 30) }
  expect(resolveDnd5eCompanionObjectAction(next)).toBeUndefined()
  const success = resolveDnd5eCompanionObjectAction({ ...next, round: 2 })!
  expect(success.result.ok).toBe(true)
  expect(success.application!.map.tokens[0].dnd5eCombatState?.companionCommand).toBeUndefined()
  expect(success.application!.map.tokens[0].dnd5eCombatState?.conditions).toContain('blinded')
  expect(success.application!.map.tokens[0].hp).toBe(11)
})

it('keeps a configured advantage and the undead own skill modifier', () => {
  const { input, point } = fixture()
  point.check = { label: 'Hide', selection: 'skill:stealth', dc: 20, mode: 'advantage' }
  expect(resolveDnd5eCompanionObjectAction({ ...input, d20: 1 })).toBeUndefined()
  const result = resolveDnd5eCompanionObjectAction({ ...input, d20: 1, d20Second: 20 })!
  expect(result.result.ok).toBe(true)
  expect(result.result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved',
    ability: 'dex', modifier: 2, d20: 20, mode: 'advantage', success: true }))
})

it('plans private handout and task delivery for the controlling player with one receipt', () => {
  const { input, owner, point } = fixture()
  owner.roomMemberId = 'owning-player'
  point.successEffects.push({ id: 'letter', kind: 'handout', handoutId: 'draft', audience: 'triggering-player' },
    { id: 'task', kind: 'task', operation: 'add', title: 'Found lever', body: 'Explore the cellar' })
  const journal = normalizeSharedRoomJournal({ handouts: [{ id: 'draft', title: 'Secret', body: 'Hidden text',
    audience: 'dm', authorMemberId: 'dm', authorName: 'DM', createdAt: 1, updatedAt: 1 }] })
  const before = structuredClone({ input, journal })
  const pending = resolveDnd5eCompanionObjectAction({ ...input, d20: 20 })!
  expect('requiredJournal' in pending && pending.requiredJournal).toBe(true)
  expect(pending.application).toBeUndefined()
  const resolved = resolveDnd5eCompanionObjectAction({ ...input, journal, d20: 20 })!
  expect(resolved.result.ok).toBe(true)
  expect('journalMutations' in resolved && resolved.journalMutations).toEqual([
    expect.objectContaining({ operation: 'add-handout', title: 'Secret', body: 'Hidden text', audience: ['owning-player'],
      authorityReceiptId: 'scene-interaction:scene:point:once:effect:1:letter' }),
    expect.objectContaining({ operation: 'add-shared-note', kind: 'task', title: 'Found lever',
      authorityReceiptId: 'scene-interaction:scene:point:once:effect:2:task' }),
  ])
  expect(resolved.application!.characters[0].dnd5eInventory!.authorityGrantReceipts).toEqual(['scene-interaction:scene:point:once'])
  expect({ input, journal }).toEqual(before)
})

it.each(['handout', 'member', 'task'] as const)('rejects missing journal dependency without a partial application: %s', missing => {
  const { input, owner, point } = fixture()
  if (missing !== 'member') owner.roomMemberId = 'owning-player'
  const journal = normalizeSharedRoomJournal({ handouts: missing === 'handout' ? [] : [{ id: 'draft', title: 'Secret', body: 'Text',
    audience: 'dm', authorMemberId: 'dm', authorName: 'DM' }] })
  point.successEffects.push(missing === 'task' ? { id: 'task', kind: 'task', operation: 'complete', taskId: 'absent', title: '', body: '' }
    : { id: 'letter', kind: 'handout', handoutId: 'draft', audience: 'triggering-player' })
  const before = structuredClone({ input, journal })
  expect(resolveDnd5eCompanionObjectAction({ ...input, journal, d20: 20 })).toBeUndefined()
  expect({ input, journal }).toEqual(before)
})

it('selects failure journal effects with damage and asks for no successful-branch handout', () => {
  const { input, point } = fixture()
  point.successEffects.push({ id: 'success-letter', kind: 'handout', handoutId: 'absent', audience: 'all' })
  point.failureEffects.push({ id: 'task', kind: 'task', operation: 'add', title: 'Trap activated', body: '' })
  const journal = normalizeSharedRoomJournal(undefined)
  const resolved = resolveDnd5eCompanionObjectAction({ ...input, journal, d20: 1, damageRollsByEffectId: { fire: [3] } })!
  expect(resolved.result.ok).toBe(true)
  expect(resolved.application!.map.tokens[0].hp).toBe(10)
  expect('journalMutations' in resolved && resolved.journalMutations).toEqual([
    expect.objectContaining({ operation: 'add-shared-note', title: 'Trap activated' }),
  ])
})

it('allows a distinct same-round attempt only with a restored action and rejects a replayed attempt', () => {
  const { input, point } = fixture()
  point.repeat = 'always'
  const first = resolveDnd5eCompanionObjectAction({ ...input, attemptId: 'attempt-one', d20: 1, damageRollsByEffectId: { fire: [2] } })!
  const saved = JSON.parse(JSON.stringify(first.application))
  const economy = createDnd5eTurnEconomyCounts('same-turn', 30)
  const next = { ...input, map: saved.map, characters: saved.characters, d20: 20, turnEconomy: economy }
  expect(resolveDnd5eCompanionObjectAction({ ...next, attemptId: 'attempt-one' })).toBeUndefined()
  economy.action.current = 0
  expect(resolveDnd5eCompanionObjectAction({ ...next, attemptId: 'attempt-two' })).toBeUndefined()
  economy.action.current = 1
  const second = resolveDnd5eCompanionObjectAction({ ...next, attemptId: 'attempt-two' })!
  expect(second.result.ok).toBe(true)
  expect(second.result.state.round).toBe(first.result.state.round)
  expect(second.result.state.combatants.undead.turn.actionAvailable).toBe(false)
  expect(second.application!.map.tokens[0].hp).toBe(11)
  expect(second.application!.characters[0].dnd5eInventory!.authorityGrantReceipts).toEqual([
    'scene-interaction:scene:point:request:undead:attempt-one',
    'scene-interaction:scene:point:request:undead:attempt-two',
  ])
})

it.each(['once', 'per-character'] as const)('a new attempt ID cannot bypass %s scope', repeat => {
  const { input, point, actor } = fixture()
  point.repeat = repeat
  const first = resolveDnd5eCompanionObjectAction({ ...input, attemptId: 'one', d20: 20 })!
  const saved = JSON.parse(JSON.stringify(first.application))
  saved.map.tokens[0].dnd5eCombatState.companionCommand = actor.dnd5eCombatState!.companionCommand
  expect(resolveDnd5eCompanionObjectAction({ ...input, ...saved, attemptId: 'two', d20: 20,
    turnEconomy: createDnd5eTurnEconomyCounts('another', 30) })).toBeUndefined()
})

it.each(['valid', 'no-action', 'dead', 'other-turn', 'lost-control', 'wrong-source', 'other-order', 'completed'] as const)('explicit scene retry preserves the automatic checkpoint: %s', variant => {
  const { actor } = fixture(), turnKey = 'combat:1:undead'
  const order = actor.dnd5eCombatState!.companionCommand!
  order.executedTurnKey = variant === 'other-turn' ? 'older-turn' : turnKey
  if (variant === 'dead') actor.hp = 0
  if (variant === 'lost-control') actor.dnd5eSummon!.controlEnded = true
  if (variant === 'wrong-source') order.sourceOwnerId = 'other'
  if (variant === 'other-order') order.command = 'dodge'
  if (variant === 'completed') order.objectInteractionCompleted = true
  const before = structuredClone(actor)
  expect(!!dnd5eRetryableCompanionSceneOrder(actor, turnKey, variant !== 'no-action')).toBe(variant === 'valid')
  if (variant === 'valid') expect(dnd5eExecutableCompanionOrder(actor, turnKey)).toBeUndefined()
  expect(actor).toEqual(before)
})

it.each([1, 20])('readied point declares, reloads and triggers off-turn without another action: %s', d20 => {
  const { input, actor } = fixture()
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready',
    ready: { trigger: 'signal', actionKind: 'interact-object' } }
  const declared = resolveDnd5eCompanionReadyAction(input)!
  expect(declared.result.ok).toBe(true)
  expect(declared.result.state.combatants.undead.turn.actionAvailable).toBe(false)
  expect(declared.result.events.some(event => event.type === 'ability-check-resolved')).toBe(false)
  const ended = resolveDnd5eHeadlessAction(declared.result.state, { type: 'end-turn', actorId: actor.id })
  expect(ended.ok).toBe(true)
  const saved = JSON.parse(JSON.stringify(planDnd5eMapResultApplication({ state: ended.state, map: input.map,
    characters: input.characters, characterIdByCombatantId: { owner: 'caster' }, events: [...ended.events] })))
  const economy = createDnd5eTurnEconomyCounts('ready', 30); economy.action.current = 0
  const prepared = { ...input, map: saved.map, characters: saved.characters, currentInitiativeIndex: 1, turnEconomy: economy, d20 }
  if (d20 === 1) {
    const pending = resolveDnd5eReadiedObjectAction(prepared)!
    expect(pending.application).toBeUndefined()
    expect('requiredDamageEffects' in pending && pending.requiredDamageEffects).toHaveLength(1)
  }
  const before = structuredClone(prepared)
  const result = resolveDnd5eReadiedObjectAction({ ...prepared, damageRollsByEffectId: { fire: [4] } })!
  expect(result?.result.ok).toBe(true)
  expect(result.result.state.initiativeIndex).toBe(1)
  expect(result.result.state.combatants.undead.turn).toMatchObject({ actionAvailable: false, reactionAvailable: false, objectInteractionAvailable: true })
  expect(result.result.state.combatants.undead.currentHp).toBe(d20 === 20 ? 13 : 9)
  expect(result.result.events.filter(event => event.type === 'turn-resource-spent')).toEqual([expect.objectContaining({ resource: 'reaction' })])
  expect(result.application!.map.tokens[0].dnd5eCombatState?.readiedAction).toBeUndefined()
  expect(resolveDnd5eReadiedObjectAction({ ...prepared, map: result.application!.map, characters: result.application!.characters })).toBeUndefined()
  expect(prepared).toEqual(before)
})

it.each(['far', 'dead', 'control', 'reaction', 'removed-ready', 'hidden', 'invalid-die', 'invalid-index'] as const)('readied point rejects changed trigger state atomically: %s', variant => {
  const { input, actor, point } = fixture()
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready', ready: { trigger: 'signal', actionKind: 'interact-object' } }
  const declared = resolveDnd5eCompanionReadyAction(input)!
  const map = declared.application!.map
  const current = map.tokens[0]
  if (variant === 'far') current.x = 725
  if (variant === 'dead') current.hp = 0
  if (variant === 'control') current.dnd5eSummon!.controlEnded = true
  if (variant === 'removed-ready') current.dnd5eCombatState!.readiedAction = undefined
  if (variant === 'hidden') point.visibleToPlayers = false
  const economy = createDnd5eTurnEconomyCounts('ready', 30); economy.action.current = 0
  if (variant === 'reaction') economy.reaction.current = 0
  const args = { ...input, map, turnEconomy: economy, currentInitiativeIndex: variant === 'invalid-index' ? -1 : 1, d20: variant === 'invalid-die' ? 21 : 20 }
  const before = structuredClone(args)
  expect(resolveDnd5eReadiedObjectAction(args)).toBeUndefined()
  expect(args).toEqual(before)
})

it('readied always point uses preparation identity and preserves a later command', () => {
  const { input, actor, point } = fixture()
  point.repeat = 'always'
  actor.dnd5eCombatState!.companionCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'ready', ready: { trigger: 'signal', actionKind: 'interact-object' } }
  const declared = resolveDnd5eCompanionReadyAction(input)!
  const map = declared.application!.map
  const ready = structuredClone(map.tokens[0].dnd5eCombatState!.readiedAction)
  const laterCommand = { ...actor.dnd5eCombatState!.companionCommand!, command: 'dodge' as const, issuedRound: 2 }
  map.tokens[0].dnd5eCombatState!.companionCommand = laterCommand
  const economy = createDnd5eTurnEconomyCounts('ready', 30); economy.action.current = 0
  const result = resolveDnd5eReadiedObjectAction({ ...input, map, turnEconomy: economy, currentInitiativeIndex: 1, d20: 20 })!
  expect(result.result.ok).toBe(true)
  expect(result.application!.map.tokens[0].dnd5eCombatState?.companionCommand).toEqual(laterCommand)
  const restored = JSON.parse(JSON.stringify(result.application!))
  restored.map.tokens[0].dnd5eCombatState.readiedAction = ready
  expect(resolveDnd5eReadiedObjectAction({ ...input, map: restored.map, characters: restored.characters,
    turnEconomy: economy, currentInitiativeIndex: 1, d20: 20, attemptId: 'another-attempt' })).toBeUndefined()
})

it('delivers scene items to the undead and preserves reward metadata until normal inventory pickup', () => {
  const { input, point } = fixture()
  const templateId = 'srd-5.1:equipment:dnd5e-longsword'
  point.rewards = [{ templateId, quantity: 2, identified: false }]
  const before = structuredClone(input)
  const result = resolveDnd5eCompanionObjectAction({ ...input, d20: 20 })!
  expect(result?.result.ok).toBe(true)
  const app = result.application!
  const restored = migrateMapsState(JSON.parse(JSON.stringify({ maps: [app.map] }))).maps[0]
  const recipient = restored.tokens.find(token => token.id === 'undead')!
  expect(recipient.dnd5eCarriedObjects).toHaveLength(2)
  expect(dnd5eCompanionCarriedWeightPounds(recipient.dnd5eCarriedObjects)).toBe(6)
  expect(app.tokenPatches?.undead.dnd5eCarriedObjects).toEqual(recipient.dnd5eCarriedObjects)
  expect(app.changedTokenIds).toContain('undead')
  expect(app.characters[0].dnd5eInventory?.entries ?? []).toEqual(before.characters[0].dnd5eInventory?.entries ?? [])
  expect(recipient.dnd5eCarriedObjects?.map(item => item.objectState.inventoryItem)).toEqual([
    expect.objectContaining({ templateId, quantity: 1, identified: false }),
    expect.objectContaining({ templateId, quantity: 1, identified: false }),
  ])
  const dropped = droppedDnd5eCompanionObjects(recipient)
  const expired = reconcileDnd5eSummonedCreatures({ map: restored, characters: app.characters, round: 601 })
  expect(expired.map.tokens.filter(token => token.dnd5eObjectState?.inventoryItem)).toHaveLength(2)
  const reloadedExpiry = migrateMapsState(JSON.parse(JSON.stringify({ maps: [expired.map] }))).maps[0]
  expect(reconcileDnd5eSummonedCreatures({ map: reloadedExpiry, characters: app.characters, round: 602 }).map).toEqual(reloadedExpiry)
  const picker = { ...restored.tokens.find(token => token.id === 'owner')!, x: recipient.x, y: recipient.y }
  const pickup = prepareDnd5eMapInventoryPickup({ map: { ...restored, tokens: [picker, ...dropped] }, characters: app.characters,
    actorTokenId: picker.id, objectTokenId: dropped[0].id, expectedReceiptId: dropped[0].dnd5eObjectState!.inventoryItem!.receiptId,
    expectedQuantity: 1, combatActive: false })
  expect(pickup.ok).toBe(true)
  if (!pickup.ok) throw Error(pickup.reason)
  // Existing character inventory treats nonmagical equipment as identified.
  expect(dropped[0].dnd5eObjectState?.inventoryItem?.identified).toBe(false)
  expect(pickup.characters[0].dnd5eInventory?.entries).toContainEqual(expect.objectContaining({ templateId, quantity: 1, identified: true }))
  expect(resolveDnd5eCompanionObjectAction({ ...input, map: restored, characters: app.characters, d20: 20 })).toBeUndefined()
  expect(input).toEqual(before)
})

it.each(['too-heavy', 'missing', 'magical'] as const)('rejects unsupported or oversized scene delivery without action or receipt: %s', reason => {
  const { input, point } = fixture()
  point.rewards = [{ templateId: reason === 'missing' ? 'absent' : reason === 'magical'
    ? 'srd-5.1:item:potion-of-healing' : 'srd-5.1:equipment:dnd5e-chain-mail', quantity: reason === 'too-heavy' ? 6 : 1, identified: true }]
  const before = structuredClone(input)
  expect(resolveDnd5eCompanionObjectAction({ ...input, d20: 20 })).toBeUndefined()
  expect(input).toEqual(before)
})

it('does not grant successful-branch items on a failed scene check', () => {
  const { input, point } = fixture()
  point.rewards = [{ templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 2, identified: true }]
  const result = resolveDnd5eCompanionObjectAction({ ...input, d20: 1, damageRollsByEffectId: { fire: [3] } })!
  expect(result.result.ok).toBe(true)
  expect(result.application!.map.tokens[0].dnd5eCarriedObjects).toBeUndefined()
  expect(result.result.state.combatants.undead.currentHp).toBe(10)
})
