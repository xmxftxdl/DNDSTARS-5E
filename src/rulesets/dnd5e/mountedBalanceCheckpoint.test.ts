import { expect, it, vi } from 'vitest'
import type { BattleMap } from '../../store/maps'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, dnd5eCombatantPairKey, resolveDnd5ePersistentAreaTrigger, previewDnd5eMountedBalance } from './headlessCombatEngine'
import { settleDnd5eMountedBalanceCheckpoint, dnd5eBasicActionAreaMovementTargets } from './mountedBalanceCheckpoint'
import { coordinateForcedMovementPersistentAreas } from '../../application/maps/ForcedMovementPersistentAreaCoordinator'
import { dnd5eHasStandardCondition } from './conditions'
import { getDnd5eSrdMonster } from './monsters'
import { prepareDnd5eMonsterAttack, resolvePreparedDnd5eMonsterAttack } from './monsterAttackAction'
import { settleDnd5eConcentrationChecks } from '../../pages/maps/settleDnd5eCombatResult'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'

function fixture(prone = false) {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'enemy' ? 'dm' : 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
    position: id === 'rider' ? { x: 35, y: 35 } : { x: 40, y: 40 }, concentrating: false, sizeRank: id === 'mount' ? 3 : 2 })
  let before = startDnd5eHeadlessCombat('checkpoint', [make('rider', 30), make('enemy', 20), make('mount', 10)])
  before.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('rider', 'mount')]: 5, [dnd5eCombatantPairKey('enemy', 'mount')]: 5 }
  const mounted = resolveDnd5eHeadlessAction(before, { type: 'mount-creature', actorId: 'rider', targetId: 'mount', hostApproved: true })
  expect(mounted.ok).toBe(true)
  before = mounted.state
  before.initiativeIndex = 1
  const result = resolveDnd5eHeadlessAction(before, { type: 'shove', actorId: 'enemy', targetId: 'mount',
    actorD20: 20, targetD20: 1, targetDefense: 'athletics', outcome: prone ? 'prone' : 'push',
    pushTo: prone ? undefined : { x: 50, y: 40 }, pushDistanceFeet: prone ? undefined : 5 })
  expect(result.ok).toBe(true)
  const map: BattleMap = { id: 'checkpoint', name: 'Map', width: 120, height: 120, gridSize: 10,
    gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: Object.values(before.combatants).map(actor => ({ id: actor.id, label: actor.name, ...actor.position,
      type: 'enemy', size: actor.id === 'mount' ? 2 : 1, emoji: '', color: '', hp: 30, maxHp: 30 })) }
  return { before, result, map, characters: [], characterIdByCombatantId: {} }
}

it('does not ask for a landing or publish changes when a mounted save succeeds', async () => {
  const input = fixture(), snapshot = JSON.stringify(input)
  const landing = vi.fn(), damage = vi.fn(), reaction = vi.fn()
  const result = await settleDnd5eMountedBalanceCheckpoint({ ...input, landing, damage, reaction,
    save: async () => ({ success: true, choice: { d20: 15 } }) })
  expect(result.result.ok).toBe(true)
  expect(result.application).toBeDefined()
  expect(landing).not.toHaveBeenCalled()
  expect(damage).not.toHaveBeenCalled()
  expect(reaction).not.toHaveBeenCalled()
  expect(JSON.stringify(input)).toBe(snapshot)
})

it.each([false, true])('settles mount prone with reaction choice %s and an authoritative map landing', async useReaction => {
  const input = fixture(true), snapshot = JSON.stringify(input), save = vi.fn(), damage = vi.fn()
  const result = await settleDnd5eMountedBalanceCheckpoint({ ...input, save, damage,
    reaction: async () => useReaction, landing: async (_request, directions) => directions.find(direction => direction === 'east') })
  expect(result.result.ok).toBe(true)
  expect(save).not.toHaveBeenCalled()
  expect(damage).not.toHaveBeenCalled()
  expect(result.result.state.combatants.rider.turn.reactionAvailable).toBe(!useReaction)
  expect(result.application?.spentReactions).toEqual(useReaction ? { round: 1, tokenIds: ['rider'] } : undefined)
  expect(result.result.state.combatants.rider.turn.movementRemaining).toBe(input.before.combatants.rider.turn.movementRemaining)
  expect(dnd5eHasStandardCondition(result.result.state.combatants.rider, 'prone')).toBe(!useReaction)
  expect(result.application?.map.tokens.find(token => token.id === 'rider')?.x).toBe(55)
  expect(JSON.stringify(input)).toBe(snapshot)
})

it.each(['cancel', 'stale', 'forged'] as const)('never commits the shove or spends resources for %s decisions', async scenario => {
  const input = fixture(), before = JSON.stringify(input.before)
  let current = true
  const result = await settleDnd5eMountedBalanceCheckpoint({ ...input, isCurrent: () => current,
    save: async () => { if (scenario === 'stale') current = false; return { success: false, choice: { d20: 1 } } },
    reaction: async () => false, damage: async () => [],
    landing: async () => scenario === 'forged' ? 'current' : undefined })
  expect(result.result.ok).toBe(false)
  expect(result.result.events).toEqual([])
  expect(result.application).toBeUndefined()
  expect(JSON.stringify(result.result.state)).toBe(before)
})

it.each(['reaction', 'landing', 'damage'] as const)('rejects authority changes during the %s prompt', async phase => {
  const input = fixture(true)
  for (const state of [input.before, input.result.state]) for (const id of ['rider', 'mount']) {
    Object.assign(state.combatants[id], { elevationFeet: 20, groundElevationFeet: 0, airborne: true })
  }
  input.map.tokens = input.map.tokens.map(token => token.id === 'rider' || token.id === 'mount' ? { ...token, elevationFeet: 20 } : token)
  const authoritySnapshot = JSON.stringify(input)
  let current = true
  const landing = vi.fn(async () => { if (phase === 'landing') current = false; return 'east' as const })
  const damage = vi.fn(async () => { if (phase === 'damage') current = false; return [2, 3] })
  const resolved = await settleDnd5eMountedBalanceCheckpoint({ ...input, isCurrent: () => current, save: vi.fn(),
    reaction: async () => { if (phase === 'reaction') current = false; return true }, landing, damage })
  expect(resolved.result).toMatchObject({ ok: false, state: input.before, events: [] })
  expect(resolved.application).toBeUndefined()
  expect(input.before.combatants.rider.turn.reactionAvailable).toBe(true)
  expect(JSON.stringify(input)).toBe(authoritySnapshot)
  if (phase === 'reaction') expect(landing).not.toHaveBeenCalled()
  if (phase !== 'damage') expect(damage).not.toHaveBeenCalled()
})

it('collects high mounted fall damage before returning a single map application', async () => {
  const input = fixture(true)
  for (const state of [input.before, input.result.state]) for (const id of ['rider', 'mount']) {
    Object.assign(state.combatants[id], { elevationFeet: 20, groundElevationFeet: 0, airborne: true })
  }
  input.map.tokens = input.map.tokens.map(token => token.id === 'rider' || token.id === 'mount' ? { ...token, elevationFeet: 20 } : token)
  const before = JSON.stringify(input), damage = vi.fn(async () => {
    expect(JSON.stringify(input)).toBe(before)
    expect(input.before.combatants.rider.turn.reactionAvailable).toBe(true)
    return [2, 3]
  })
  const result = await settleDnd5eMountedBalanceCheckpoint({ ...input, save: vi.fn(), damage,
    reaction: async () => false, landing: async () => 'east' })
  expect(result.result.ok).toBe(true)
  expect(damage).toHaveBeenCalledWith(expect.objectContaining({ riderId: 'rider' }), 2)
  expect(result.result.state.combatants.rider.currentHp).toBe(25)
  expect(result.result.state.combatants.rider.elevationFeet).toBe(0)
  expect(dnd5eHasStandardCondition(result.result.state.combatants.rider, 'prone')).toBe(true)
  expect(result.application).toBeDefined()
  expect(JSON.stringify(input)).toBe(before)
})

it.each([1, 20])('settles rider landing area save %s even when the mount did not move', async d20 => {
  const input = fixture(true)
  input.before.mapId = input.map.id
  input.result.state.mapId = input.map.id
  input.map.dnd5ePluginAreas = [{ id: 'landing-area', pluginId: 'test.landing', featureId: 'landing', label: 'Landing area',
    sourceCharacterId: 'enemy', sourceTokenId: 'enemy', cells: [{ col: 5, row: 3 }], color: '#fff',
    createdRound: 1, expiresAfterRound: 100, anchorMode: 'fixed', relation: 'any', includeSelf: false,
    triggers: [{ id: 'enter', label: 'Entry', timing: 'on-enter', oncePerTurn: true,
      savingThrow: { ability: 'dex', dc: 12, onSuccess: 'none', magical: true },
      condition: { condition: 'restrained', duration: { expiresAt: 'permanent' } } }] }]
  const resolved = await settleDnd5eMountedBalanceCheckpoint({ ...input, save: vi.fn(), damage: vi.fn(),
    reaction: async () => true, landing: async () => 'east' })
  expect(resolved.result.ok).toBe(true)
  const targets = dnd5eBasicActionAreaMovementTargets(resolved.result.events)
  expect(targets).toEqual(['rider'])
  const seen: string[] = []
  let finalState = resolved.result.state
  const settled = await coordinateForcedMovementPersistentAreas({ beforeMap: input.map, afterMap: resolved.application!.map,
    characters: [], tokenId: targets[0], round: 1, turnKey: '1:enemy',
    settleCandidates: async ({ candidates, map, characters }) => {
      for (const candidate of candidates) {
        seen.push(candidate.targetToken.id)
        const prepared = prepareDnd5ePersistentAreaTrigger({ combatId: finalState.combatId,
          round: finalState.round, map, characters, candidate,
          initiativeOrder: finalState.initiativeOrder.map((id, index) => ({ tokenId: id,
            label: id, emoji: '', color: '', roll: 30 - index })) }, finalState)
        expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
        if (!prepared.ok) throw Error(prepared.reason)
        expect(prepared.prepared.state.combatants.rider.turn.reactionAvailable).toBe(false)
        const applied = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, d20 })
        const outcome = applied.result
        expect(outcome.ok, JSON.stringify(outcome)).toBe(true)
        finalState = outcome.state
        expect(applied.application).toBeDefined()
        map = applied.application!.map
      }
      return { map, characters: [...characters], logs: [] }
    } })
  expect(seen).toEqual(['rider'])
  expect(dnd5eHasStandardCondition(finalState.combatants.rider, 'restrained')).toBe(d20 === 1)
  expect(dnd5eHasStandardCondition(finalState.combatants.mount, 'restrained')).toBe(false)
  expect(finalState.combatants.rider.turn.reactionAvailable).toBe(false)
  expect(settled.map.tokens.find(token => token.id === 'rider')).toMatchObject({ x: 55, y: 35 })
  const projected = settled.map.tokens.find(token => token.id === 'rider')?.dnd5eCombatState
  expect(projected?.activeEffects).toEqual(finalState.combatants.rider.classState.activeEffects)
  expect(projected?.conditions?.includes('restrained') ?? false).toBe(d20 === 1)
  const replay = vi.fn(async ({ map, characters }: Parameters<Parameters<typeof coordinateForcedMovementPersistentAreas>[0]['settleCandidates']>[0]) =>
    ({ map, characters: [...characters], logs: [] }))
  await coordinateForcedMovementPersistentAreas({ beforeMap: input.map, afterMap: settled.map,
    characters: [], tokenId: 'rider', round: 1, turnKey: '1:enemy', settleCandidates: replay })
  expect(replay.mock.calls[0][0].candidates).toEqual([])
})

it('includes both the forced mount and its rider once after a successful balance save', async () => {
  const input = fixture()
  const resolved = await settleDnd5eMountedBalanceCheckpoint({ ...input, save: async () => ({ success: true, choice: { d20: 15 } }),
    reaction: vi.fn(), landing: vi.fn(), damage: vi.fn() })
  expect(dnd5eBasicActionAreaMovementTargets(resolved.result.events)).toEqual(['mount', 'rider'])
})

it('settles a monster bite knocking the mount prone before publishing damage and dismount', async () => {
  const input = fixture(), wolf = getDnd5eSrdMonster('srd-5.1:wolf')!
  const map = { ...input.map, tokens: input.map.tokens.map(token => token.id === 'enemy'
    ? { ...token, poolId: wolf.id, x: 35, y: 40 }
    : { ...token, type: 'player' as const, dnd5eCombatState: input.before.combatants[token.id].classState }) }
  const prepared = prepareDnd5eMonsterAttack({ combatId: 'mounted-bite', map, characters: [],
    initiativeOrder: ['enemy', 'rider', 'mount'].map((tokenId, index) => ({ tokenId, label: tokenId, emoji: '', color: '', roll: 20 - index })),
    actorTokenId: 'enemy', targetTokenId: 'mount', actionIndex: wolf.actions.findIndex(action => action.attack?.mode === 'melee') })
  expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
  if (!prepared.ok) throw Error(prepared.reason)
  const attack = prepared.prepared.attacks[0]
  const provisional = resolvePreparedDnd5eMonsterAttack({ prepared: prepared.prepared, rolls: [{ d20: 19,
    damageRolls: attack.attack.damage.map(damage => Array(damage.count).fill(1)),
    onHitEffectRolls: attack.attack.onHitEffects?.map(effect => ({ effectId: effect.id, d20: 1 })) }] })
  expect(provisional.result.ok, JSON.stringify(provisional.result)).toBe(true)
  const pending = provisional.result.events.find(event => event.type === 'monster-on-hit-save-required')
  expect(pending?.type).toBe('monster-on-hit-save-required')
  if (pending?.type !== 'monster-on-hit-save-required') throw Error('Missing bite save')
  if (!provisional.result.ok) throw Error(provisional.result.reason)
  const save = vi.fn(), reaction = vi.fn(async () => true)
  const resolved = await settleDnd5eConcentrationChecks({ result: provisional.result, map, characters: [], characterIdByCombatantId: {},
    rollD20: async () => 1, rollD4: async () => 1, rollDice: async count => Array(count).fill(1),
    settleMountedBalance: (prepared, result) => settleDnd5eMountedBalanceCheckpoint({ ...prepared, before: prepared.state, result,
      save, reaction, landing: async () => 'east', damage: vi.fn() }),
  })
  expect(resolved.result.ok).toBe(true)
  expect(dnd5eHasStandardCondition(resolved.result.state.combatants.mount, 'prone')).toBe(true)
  expect(save).not.toHaveBeenCalled()
  expect(reaction).toHaveBeenCalledOnce()
  expect(resolved.result.state.combatants.mount.currentHp).toBe(provisional.result.state.combatants.mount.currentHp)
  expect(resolved.result.state.combatants.rider.turn.reactionAvailable).toBe(false)
  expect(resolved.application.spentReactions).toEqual({ round: 1, tokenIds: ['rider'] })
  expect(resolved.application?.map.tokens.find(token => token.id === 'rider')?.x).toBe(55)
  expect(prepared.prepared.state.combatants.rider.turn.reactionAvailable).toBe(true)
})

it.each([true, false])('uses a real Thunderwave push to trigger mounted balance (save succeeds: %s)', async success => {
  const input = fixture(), caster = input.before.combatants.enemy
  Object.assign(caster, { classId: 'wizard', classLevels: { wizard: 5 }, level: 5,
    abilities: { ...caster.abilities, int: 16 }, classSelections: { 'spell-prepared': ['thunderwave'] },
    classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 4 } }, position: { x: 25, y: 40 } })
  const pushed = resolveDnd5eHeadlessAction(input.before, { type: 'cast-spell', actorId: 'enemy', castingClassId: 'wizard',
    targetId: 'mount', targetIds: ['mount'], spellId: 'thunderwave', slotLevel: 1, savingThrowD20: 1,
    forcedMovements: [{ targetId: 'mount', to: { x: 60, y: 40 }, distanceFeet: 10 }], effectRolls: [1, 1] })
  expect(pushed.ok, JSON.stringify(pushed)).toBe(true)
  expect(pushed.events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: 'mount', movementKind: 'forced', sourceActorId: 'enemy' }))
  expect(pushed.state.combatants.rider.position).toEqual({ x: 55, y: 35 })
  const save = vi.fn(async () => ({ success, choice: { d20: success ? 15 : 1 } }))
  const result = await settleDnd5eMountedBalanceCheckpoint({ ...input, result: pushed, save,
    reaction: vi.fn(), landing: async () => 'east', damage: vi.fn() })
  expect(result.result.ok).toBe(true)
  expect(save).toHaveBeenCalledOnce()
  expect(result.result.state.combatants.enemy.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(input.before.combatants.enemy.classResources['dnd5e-spell-slot-1'].current).toBe(1)
  expect(result.result.state.combatants.mount.currentHp).toBe(28)
  expect(dnd5eHasStandardCondition(result.result.state.combatants.rider, 'prone')).toBe(!success)
  expect(result.result.state.combatants.mount.classState.activeEffects?.some(effect => effect.relation?.slotGroup === 'riding')).toBe(success)
})

it.each([true, false])('keeps rider altitude aligned during a vertical area lift (balance succeeds: %s)', async success => {
  const input = fixture()
  for (const id of ['mount', 'rider']) Object.assign(input.before.combatants[id], { elevationFeet: 0, groundElevationFeet: 0 })
  const lifted = resolveDnd5ePersistentAreaTrigger(input.before, { areaMapId: input.map.id, areaId: 'lift',
    sourceId: 'enemy', targetId: 'mount', trigger: { id: 'capture', label: 'Suspension', timing: 'on-enter',
      condition: { condition: 'restrained', duration: { expiresAt: 'permanent' }, endsWithArea: true, suspendAboveGroundFeet: 3 } } })
  expect(lifted.ok, JSON.stringify(lifted)).toBe(true)
  expect(lifted.state.combatants.rider.position).toEqual(input.before.combatants.rider.position)
  expect(lifted.state.combatants.rider.elevationFeet).toBe(3)
  expect(lifted.state.combatants.rider.airborne).toBe(true)
  expect(previewDnd5eMountedBalance(input.before, lifted)).toEqual([expect.objectContaining({ riderId: 'rider', cause: 'mount-forced-movement' })])
  if (!lifted.ok) throw Error(lifted.reason)
  const save = vi.fn(async () => ({ success, choice: { d20: success ? 15 : 1 } }))
  const settleMountedBalance: NonNullable<Parameters<typeof settleDnd5eConcentrationChecks>[0]['settleMountedBalance']> =
    (prepared, result) => settleDnd5eMountedBalanceCheckpoint({ ...prepared, before: prepared.state, result,
      save, reaction: vi.fn(), landing: async () => 'east', damage: vi.fn() })
  const result = await settleDnd5eConcentrationChecks({ result: lifted, priorState: input.before,
    map: input.map, characters: [], characterIdByCombatantId: {}, settleMountedBalance,
    rollD20: async () => 1, rollD4: async () => 1, rollDice: async count => Array(count).fill(1) })
  expect(result.result.ok).toBe(true)
  expect(result.result.state.combatants.mount.elevationFeet).toBe(3)
  expect(result.result.state.combatants.rider.elevationFeet).toBe(success ? 3 : 0)
  expect(dnd5eHasStandardCondition(result.result.state.combatants.rider, 'prone')).toBe(!success)
  expect(result.result.state.combatants.rider.currentHp).toBe(30)
  expect(save).toHaveBeenCalledOnce()
  expect(previewDnd5eMountedBalance(input.before, result.result)).toEqual([])
  await settleDnd5eConcentrationChecks({ result: result.result, priorState: input.before,
    map: result.application.map, characters: [], characterIdByCombatantId: {}, settleMountedBalance,
    rollD20: async () => 1, rollD4: async () => 1, rollDice: async count => Array(count).fill(1) })
  expect(save).toHaveBeenCalledOnce()
})

it('does not request a falling save for a mount voluntarily ascending with its rider', () => {
  const input = fixture(), source = input.before
  for (const id of ['mount', 'rider']) Object.assign(source.combatants[id], { elevationFeet: 0, groundElevationFeet: 0 })
  source.combatants.mount.movementSpeeds = { walk: 30, fly: 30 }
  source.initiativeIndex = 2
  const moved = resolveDnd5eHeadlessAction(source, { type: 'move', actorId: 'mount', to: { x: 40, y: 40 },
    distance: 10, traversalMode: 'fly', toElevationFeet: 10, toGroundElevationFeet: 0 })
  expect(moved.ok, JSON.stringify(moved)).toBe(true)
  expect(moved.state.combatants.rider.elevationFeet).toBe(10)
  expect(previewDnd5eMountedBalance(source, moved)).toEqual([])
  expect(moved.state.combatants.rider.turn.movementRemaining).toBe(source.combatants.rider.turn.movementRemaining)
})

it('does not let an earlier successful balance save suppress the next forced movement', async () => {
  const input = fixture()
  const first = await settleDnd5eMountedBalanceCheckpoint({ ...input,
    save: async () => ({ success: true, choice: { d20: 15 } }), reaction: vi.fn(), landing: vi.fn(), damage: vi.fn() })
  expect(first.result.ok).toBe(true)
  expect(previewDnd5eMountedBalance(input.before, first.result)).toEqual([])
  const next = JSON.parse(JSON.stringify(first.result.state))
  next.round += 1
  next.combatants.enemy.turn.actionAvailable = true
  next.combatants.enemy.position = { x: 45, y: 40 }
  next.distanceFeetByCombatantPair[dnd5eCombatantPairKey('enemy', 'mount')] = 5
  const pushed = resolveDnd5eHeadlessAction(next, { type: 'shove', actorId: 'enemy', targetId: 'mount',
    actorD20: 20, targetD20: 1, targetDefense: 'athletics', outcome: 'push', pushTo: { x: 60, y: 40 }, pushDistanceFeet: 5 })
  expect(pushed.ok).toBe(true)
  expect(previewDnd5eMountedBalance(next, pushed)).toHaveLength(1)
})
