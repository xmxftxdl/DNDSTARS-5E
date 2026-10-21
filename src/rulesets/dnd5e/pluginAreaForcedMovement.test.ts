import { expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea, Token } from '../../store/maps'
import { cellDistance, tokenAnchorCellFromPixel } from '../../lib/gridCombat'
import { collectDnd5ePersistentAreaTriggers } from './pluginAreas'
import { createDnd5ePersistentAreaWillingFailureCoordinator, prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
import type { Dnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { normalizeDnd5ePersistentAreaTriggerSnapshot } from './persistentAreaTypes'
import { dnd5eNearestOutsideAreaMovementV1 } from './activities/dnd5eActivityMapInteraction'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { settleDnd5ePersistentAreaTempleEntry } from './persistentAreaTempleEntry'

it.each([true, false])('settles temple entry after area damage without losing receipts (allowed %s)', async allowed => {
  const prepared = fixture('always')
  prepared.state.combatants.target.creatureType = 'fiend'
  const geometry = createEmptyMapGeometry(prepared.map.id)
  geometry.structureLifetimes = [{ id: 'temple', casterId: 'builder', createdWorldMinute: 0,
    expiresWorldMinute: 1440, entityIds: [], replacementGroup: 'temple-of-the-gods',
    objectBoundary: { points: [{x:100,y:50},{x:225,y:50},{x:225,y:200},{x:100,y:200}], bottomFeet:0, topFeet:20 },
    templeWard: { hostileCreatureTypes: ['fiend'], saveDc:18, healingBonus:1, lighting:'none' } }]
  prepared.state.companionScene!.geometry = geometry
  prepared.state.companionScene!.worldMinute = 10
  const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20:1 })
  expect(resolved.result.ok).toBe(true)
  const original = structuredClone(resolved)
  let rolls = 0
  const entry = await settleDnd5ePersistentAreaTempleEntry({ prepared, resolved, isCurrent:()=>true,
    roll:async()=>{ rolls++; return { d20:allowed?20:1 } } })
  expect(entry.ok).toBe(true); if(!entry.ok)throw Error(entry.reason)
  expect(rolls).toBe(1)
  const result = entry.resolved
  expect(result.result.state.combatants.target.currentHp).toBe(18)
  expect(result.result.state.combatants.target.position).toEqual({ x:allowed?175:75, y:125 })
  expect(result.result.events.some(event=>event.type==='moved')).toBe(allowed)
  expect(result.application?.tokenPatches?.target).toMatchObject({hp:18})
  expect(result.application?.map.dnd5ePluginAreas).toEqual(resolved.application?.map.dnd5ePluginAreas)
  expect(result.result.state.combatants.target.classState.activeEffects?.some(effect=>effect.definitionId==='temple-of-the-gods:entry-denied')??false).toBe(!allowed)
  expect(resolved).toEqual(original)
  const cancelled = await settleDnd5ePersistentAreaTempleEntry({ prepared, resolved, isCurrent:()=>true, roll:async()=>undefined })
  expect(cancelled).toMatchObject({ok:false,reason:'temple-entry-save-cancelled'})
  const stale = await settleDnd5ePersistentAreaTempleEntry({ prepared, resolved, isCurrent:()=>false, roll:async()=>{throw Error('stale must not roll')} })
  expect(stale).toMatchObject({ok:false,reason:'temple-entry-authority-changed'})
  expect(resolved).toEqual(original)
})

it('bounds ejection by distance outside the area, not by distance travelled from its center', () => {
  const prepared = fixture('always')
  const target = prepared.map.tokens.find(token => token.id === 'target')!
  target.x = 125
  target.y = 125
  prepared.map.tokens = [target]
  const cells = Array.from({ length: 9 }, (_, index) => ({ col: 1 + index % 3, row: 1 + Math.floor(index / 3) }))
  const movement = dnd5eNearestOutsideAreaMovementV1({ map: prepared.map, area: { cells }, targetTokenId: target.id,
    maximumOutsideDistanceFeet: 5 })
  expect(movement?.distanceFeet).toBe(10)
  expect(dnd5eNearestOutsideAreaMovementV1({ map: prepared.map, area: { cells }, targetTokenId: target.id,
    maximumOutsideDistanceFeet: 1 })).toBeUndefined()
})

it('rejects the entire trigger when no destination fits the declared ejection boundary', () => {
  const prepared = fixture('always')
  prepared.candidate.trigger.forcedMovement = { mode: 'nearest-outside-area', appliesOn: 'always', maximumOutsideDistanceFeet: 1 }
  const before = structuredClone(prepared)
  const failed = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1 })
  expect(failed.result).toMatchObject({ ok: false, events: [], state: before.state })
  expect(failed.application).toBeUndefined()
  expect(prepared).toEqual(before)
  prepared.candidate.trigger.forcedMovement.maximumOutsideDistanceFeet = 5
  const succeeded = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1 })
  expect(succeeded.result.ok).toBe(true)
  expect(succeeded.result.events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: 'target' }))
})

it('rejects invalid ejection boundaries instead of dropping the configured constraint', () => {
  const trigger = fixture('always').candidate.trigger
  for (const maximumOutsideDistanceFeet of [null, 0, -1, 1.5, NaN, 1001, '5']) {
    expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger,
      forcedMovement: { mode: 'nearest-outside-area', appliesOn: 'always', maximumOutsideDistanceFeet } })).toBeUndefined()
  }
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...trigger,
    forcedMovement: { mode: 'push-from-source', appliesOn: 'always', distanceFeet: 5, maximumOutsideDistanceFeet: 5 } })).toBeUndefined()
})

function fixture(appliesOn: 'always' | 'failed-save' | 'successful-save', sourceMayDecline = false, allowWillingFailure = false) {
  const source: Token = { id: 'source', label: 'Source', x: 25, y: 125, size: 1, type: 'enemy',
    color: '#fff', emoji: '', hp: 20, maxHp: 20 }
  const target: Token = { ...source, id: 'target', label: 'Target', x: 75 }
  const trigger: Dnd5ePersistentAreaTriggerSnapshot = { id: 'push', label: 'Push', timing: 'turn-start',
    oncePerTurn: true, sourceMayDecline,
    savingThrow: { ability: 'str', dc: 15, onSuccess: 'none', allowWillingFailure },
    forcedMovement: { mode: 'push-from-source', distanceFeet: 10, appliesOn },
    damage: { count: 0, sides: 6, modifier: 2, type: 'force' } }
  const area: Dnd5ePluginArea = { id: 'push-area', pluginId: 'test.area-push', featureId: 'push', label: 'Push',
    sourceCharacterId: '', sourceTokenId: source.id, cells: [{ col: 1, row: 2 }], color: '#fff', createdRound: 1,
    expiresAfterRound: 5, relation: 'any', includeSelf: false, triggers: [trigger] }
  const map: BattleMap = { id: 'push-map', name: 'Push', width: 250, height: 250, gridSize: 50,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [source, target], dnd5ePluginAreas: [area] }
  const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'turn-start', round: 1,
    targetTokenId: target.id, turnKey: 'turn-1' })
  const prepared = prepareDnd5ePersistentAreaTrigger({ combatId: map.id, round: 1, map, characters: [],
    initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })),
    candidate: candidates[0] })
  if (!prepared.ok) throw Error('Preparation failed')
  return prepared.prepared
}

it.each([[3, 25], [1, 225]])('pushes from the current area anchor column %i, not the caster', (col, expectedX) => {
  const prepared = fixture('failed-save')
  prepared.candidate.trigger.forcedMovement = {mode: 'push-from-area-anchor', distanceFeet: 10, appliesOn: 'failed-save'}
  prepared.candidate.area.anchorCell = {col, row: 2}
  prepared.candidate.area.cells = [{col: 2, row: 2}]
  const target = prepared.map.tokens.find(t => t.id === 'target')!
  target.x = 125
  prepared.state.combatants.target.position = {x: 125, y: 125}
  const source = prepared.map.tokens.find(t => t.id === 'source')!
  source.x = 125; source.y = 225
  prepared.state.combatants.source.position = {x: 125, y: 225}
  const saved = structuredClone(prepared)
  const success = resolvePreparedDnd5ePersistentAreaTrigger({prepared: structuredClone(saved), d20: 20})
  expect(success.result.ok).toBe(true)
  expect(success.result.state.combatants.target.position).toEqual({x: 125, y: 125})
  const failed = resolvePreparedDnd5ePersistentAreaTrigger({prepared: structuredClone(saved), d20: 1})
  expect(failed.result.ok).toBe(true)
  expect(failed.result.state.combatants.target.position).toEqual({x: expectedX, y: 125})
  expect(failed.result.state.combatants.source.position).toEqual({x: 125, y: 225})
  expect(failed.result.events).toContainEqual(expect.objectContaining({type: 'moved', actorId: 'target', sourceActorId: 'source', movementKind: 'forced', distance: 10}))
  expect(failed.result.state.combatants.target.turn.movementRemaining).toBe(saved.state.combatants.target.turn.movementRemaining)
})

it('rejects missing area anchors atomically rather than falling back to the caster', () => {
  const prepared = fixture('failed-save')
  prepared.candidate.trigger.forcedMovement = {mode: 'push-from-area-anchor', distanceFeet: 10, appliesOn: 'failed-save'}
  const result = resolvePreparedDnd5ePersistentAreaTrigger({prepared, d20: 1})
  expect(result.result.ok).toBe(false)
  expect(result.application).toBeUndefined()
  expect(result.result.events).toEqual([])
})

it('normalizes area-origin declarations without accepting a client supplied origin or direction', () => {
  const trigger = {id: 'vortex', label: 'Vortex', timing: 'turn-end', savingThrow: {ability: 'str', dc: 15, onSuccess: 'half'},
    forcedMovement: {mode: 'push-from-area-anchor', distanceFeet: 10, appliesOn: 'failed-save'}}
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)?.forcedMovement).toEqual(trigger.forcedMovement)
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...trigger, forcedMovement: {...trigger.forcedMovement, originCell: {col: 99, row: 99}}})).toBeUndefined()
})

it.each([
  ['always', 1, true], ['always', 20, true],
  ['failed-save', 1, true], ['failed-save', 20, false],
  ['successful-save', 1, false], ['successful-save', 20, true],
] as const)('settles %s push on d20=%i without page logic', (appliesOn, d20, moves) => {
  const prepared = fixture(appliesOn)
  prepared.state.combatants.target.classState.straightMovementStreak = {
    turnKey: 'push-map:1:target', end: { x: 75, y: 125 }, direction: { x: 1, y: 0 }, distanceFeet: 10 }
  const before = structuredClone(prepared)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20 })
  expect(settled.result.ok).toBe(true)
  const events = settled.result.events.filter(e => e.type === 'moved')
  expect(events).toHaveLength(moves ? 1 : 0)
  expect(settled.result.state.combatants.target.classState.straightMovementStreak)
    .toEqual(moves ? undefined : before.state.combatants.target.classState.straightMovementStreak)
  const target = settled.application!.map.tokens.find(t => t.id === 'target')!
  expect(settled.result.state.combatants.target.position).toEqual({ x: target.x, y: target.y })
  expect(settled.result.state.combatants.target.turn.movementRemaining)
    .toBe(before.state.combatants.target.turn.movementRemaining)
  if (moves) {
    expect(events[0]).toMatchObject({ actorId: 'target', sourceActorId: 'source', movementKind: 'forced', distance: 10 })
    const cell = tokenAnchorCellFromPixel(target.x, target.y, target, prepared.map)
    expect(cellDistance({ col: 0, row: 2 }, cell)).toBeGreaterThan(1)
  } else expect(target.x).toBe(75)
  expect(target.hp).toBe(d20 === 1 ? 18 : 20)
  expect(prepared).toEqual(before)
  const reloaded: BattleMap = JSON.parse(JSON.stringify(settled.application!.map))
  expect(collectDnd5ePersistentAreaTriggers({ map: reloaded, timing: 'turn-start', round: 1,
    targetTokenId: 'target', turnKey: 'turn-1' })).toHaveLength(0)
})

it('records a blocked push without inventing a moved event or cancelling its damage', () => {
  const prepared = fixture('always')
  for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
    if (row === 2 && col <= 1) continue
    prepared.map.tokens.push({ ...prepared.map.tokens[0], id: `occupied-${col}-${row}`, x: col * 50 + 25, y: row * 50 + 25 })
  }
  const before = structuredClone(prepared)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1 })
  expect(settled.result.ok).toBe(true)
  expect(settled.result.events.some(e => e.type === 'moved')).toBe(false)
  expect(settled.result.state.combatants.target.currentHp).toBe(18)
  expect(settled.result.state.combatants.target.position).toEqual(before.state.combatants.target.position)
  expect(settled.application!.map.dnd5ePluginAreas).not.toEqual(before.map.dnd5ePluginAreas)
  expect(prepared).toEqual(before)
})

it('does not push a declined opportunity even with appliesOn always', () => {
  const prepared = fixture('always', true), before = structuredClone(prepared)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, sourceConsent: false })
  expect(settled.result.ok).toBe(true)
  expect(settled.result.events).toEqual([expect.objectContaining({ type: 'persistent-area-triggered', declined: true })])
  expect(settled.result.state.combatants.target.position).toEqual(before.state.combatants.target.position)
  expect(settled.result.state.combatants.target.currentHp).toBe(20)
  expect(prepared).toEqual(before)
})

it('rejects a missing map source without committing damage or a receipt', () => {
  const prepared = fixture('always')
  prepared.map.tokens = prepared.map.tokens.filter(t => t.id !== 'source')
  const before = structuredClone(prepared)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, d20: 1 })
  expect(settled.result).toMatchObject({ ok: false, events: [], reason: 'invalid-target', state: before.state })
  expect(settled.application).toBeUndefined()
  expect(prepared).toEqual(before)
})

it('settles an explicitly permitted willing failure without dice and preserves next-roll advantage', () => {
  const prepared = fixture('failed-save', false, true)
  prepared.state.combatants.target.classState.nextD20Advantage = { featureId: 'test', rollKinds: ['saving-throw'] }
  const before = structuredClone(prepared)
  expect(prepared.save?.allowWillingFailure).toBe(true)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, willingFailure: true })
  expect(settled.result.ok).toBe(true)
  expect(settled.result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved',
    automaticOutcome: 'willing-failure', success: false, d20: 0 }))
  expect(settled.result.state.combatants.target.currentHp).toBe(18)
  expect(settled.result.events.filter(e => e.type === 'moved')).toHaveLength(1)
  expect(settled.result.state.combatants.target.classState.nextD20Advantage).toEqual(before.state.combatants.target.classState.nextD20Advantage)
  expect(prepared).toEqual(before)
})

it('does not infer willingness from permission and does not let it override an automatic size success', () => {
  const prepared = fixture('failed-save', false, true)
  expect(resolvePreparedDnd5ePersistentAreaTrigger({ prepared }).result).toMatchObject({ ok: false, reason: 'invalid-dice' })
  const resisted = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, willingFailure: false, d20: 20 })
  expect(resisted.result.ok).toBe(true)
  expect(resisted.result.state.combatants.target.currentHp).toBe(20)
  prepared.candidate.trigger.savingThrow!.automaticSuccessMinimumSizeRank = 4
  prepared.state.combatants.target.sizeRank = 4
  const invalid = resolvePreparedDnd5ePersistentAreaTrigger({ prepared, willingFailure: true })
  expect(invalid.result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
  expect(invalid.application).toBeUndefined()
  const automatic = resolvePreparedDnd5ePersistentAreaTrigger({ prepared })
  expect(automatic.result.events).toContainEqual(expect.objectContaining({ automaticOutcome: 'size-rule-success', success: true }))
})

it('rejects client-asserted willingness without a rule and retains explicit DM adjustment semantics', () => {
  const unauthorized = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: fixture('failed-save'), willingFailure: true })
  expect(unauthorized.result).toMatchObject({ ok: false, reason: 'invalid-plugin-action' })
  expect(unauthorized.application).toBeUndefined()
  const adjusted = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: fixture('failed-save', false, true),
    willingFailure: true, dmAdjustment: { saveSuccessOverride: true } })
  expect(adjusted.result.ok).toBe(true)
  expect(adjusted.result.events).toContainEqual(expect.objectContaining({ automaticOutcome: 'dm-adjusted-automatic-success', success: true }))
  expect(adjusted.result.state.combatants.target.currentHp).toBe(20)
})

it.each([false, true])('asks once across save waves and settlement; respects the explicit answer %s', async answer => {
  const prepared = fixture('failed-save', false, true)
  let requests = 0
  const choose = createDnd5ePersistentAreaWillingFailureCoordinator(async request => {
    requests++
    expect(request.candidate.targetToken.id).toBe('target')
    return answer
  })
  expect(await Promise.all([choose(prepared), choose(prepared)])).toEqual([answer, answer])
  expect(await choose(prepared)).toBe(answer)
  expect(requests).toBe(1)
  expect(await choose({ ...prepared, save: undefined })).toBe(false)
  expect(await choose(fixture('failed-save'))).toBe(false)
  expect(requests).toBe(1)
  const another = structuredClone(prepared)
  another.candidate.transactionId += ':next-turn'
  expect(await choose(another)).toBe(answer)
  expect(requests).toBe(2)
})


it.each([[4, 175, 10], [2, 125, 5], [1, 75, 0]])(
  'pulls toward area column %i without overshooting its center', (col, expectedX, distance) => {
    const prepared = fixture('failed-save')
    prepared.candidate.trigger.forcedMovement = {mode: 'pull-to-area-anchor', distanceFeet: 10, appliesOn: 'failed-save'}
    prepared.candidate.area.anchorCell = {col, row: 2}
    const before = structuredClone(prepared)
    const saved = resolvePreparedDnd5ePersistentAreaTrigger({prepared, d20: 20})
    expect(saved.result.ok).toBe(true)
    expect(saved.result.state.combatants.target.position).toEqual({x: 75, y: 125})
    expect(saved.result.state.combatants.target.currentHp).toBe(20)
    const failed = resolvePreparedDnd5ePersistentAreaTrigger({prepared, d20: 1})
    expect(failed.result.ok).toBe(true)
    expect(failed.result.state.combatants.target.position).toEqual({x: expectedX, y: 125})
    expect(failed.result.state.combatants.target.currentHp).toBe(18)
    expect(failed.result.events.filter(e => e.type === 'moved')).toEqual(distance ? [expect.objectContaining({distance, movementKind: 'forced'})] : [])
    expect(failed.application!.map.tokens.find(t => t.id === 'target')?.x).toBe(expectedX)
    expect(failed.result.state.combatants.target.turn.movementRemaining).toBe(before.state.combatants.target.turn.movementRemaining)
    expect(prepared).toEqual(before)
  })

it('validates pull anchors and refuses client-supplied origins atomically', () => {
  const prepared = fixture('failed-save')
  prepared.candidate.trigger.forcedMovement = {mode: 'pull-to-area-anchor', distanceFeet: 10, appliesOn: 'failed-save'}
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(prepared.candidate.trigger)?.forcedMovement).toEqual(prepared.candidate.trigger.forcedMovement)
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({...prepared.candidate.trigger, forcedMovement: {...prepared.candidate.trigger.forcedMovement, originCell: {col: 9, row: 9}}})).toBeUndefined()
  const failed = resolvePreparedDnd5ePersistentAreaTrigger({prepared, d20: 1})
  expect(failed.result).toMatchObject({ok: false, events: [], state: prepared.state})
  expect(failed.application).toBeUndefined()
})

it('keeps pull damage and receipt when all closer cells are occupied', () => {
  const prepared = fixture('failed-save')
  prepared.candidate.trigger.forcedMovement = {mode: 'pull-to-area-anchor', distanceFeet: 10, appliesOn: 'failed-save'}
  prepared.candidate.area.anchorCell = {col: 4, row: 2}
  for (let row = 0; row < 5; row++) for (let col = 2; col < 5; col++) {
    prepared.map.tokens.push({...prepared.map.tokens[0], id: `block-${col}-${row}`, x: col * 50 + 25, y: row * 50 + 25})
  }
  const before = structuredClone(prepared)
  const settled = resolvePreparedDnd5ePersistentAreaTrigger({prepared, d20: 1})
  expect(settled.result.ok).toBe(true)
  expect(settled.result.state.combatants.target.currentHp).toBe(18)
  expect(settled.result.state.combatants.target.position).toEqual({x: 75, y: 125})
  expect(settled.result.events.some(e => e.type === 'moved')).toBe(false)
  expect(settled.application!.map.dnd5ePluginAreas).not.toEqual(before.map.dnd5ePluginAreas)
  expect(prepared).toEqual(before)
})

it('settles a damage-negating successful save without requesting damage dice', () => {
  const prepared = fixture('failed-save')
  prepared.candidate.trigger.damage = {count:6,sides:6,modifier:0,type:'bludgeoning'}
  const saved=resolvePreparedDnd5ePersistentAreaTrigger({prepared,d20:20})
  expect(saved.result.ok).toBe(true)
  expect(saved.result.state.combatants.target.currentHp).toBe(20)
  expect(saved.result.events.some(e => e.type === 'moved')).toBe(false)
  expect(saved.application!.map.dnd5ePluginAreas).not.toEqual(prepared.map.dnd5ePluginAreas)
  expect(resolvePreparedDnd5ePersistentAreaTrigger({prepared,d20:1}).result.ok).toBe(false)
  prepared.candidate.trigger.savingThrow!.onSuccess='half'
  expect(resolvePreparedDnd5ePersistentAreaTrigger({prepared,d20:20}).result.ok).toBe(false)
})
