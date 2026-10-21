import {expect, it} from 'vitest'
import {createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, type Dnd5eAction} from './headlessCombatEngine'
import {withDnd5eZeroHitPointCheckpoints} from './zeroHitPointCheckpoint'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {planDnd5eInterruptingTurn} from './interruptedTurn'

function fixture(hp = 4, temporaryHp = 0) {
  const actor = (id: string, initiative: number) => createDnd5eCombatant({id, name: id,
    controller: 'player', initiative, abilities: {str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10},
    proficiencyBonus: 2, armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0,
    speed: 30, position: {x: 0, y: 0}, concentrating: false})
  const state = startDnd5eHeadlessCombat('zero-checkpoint', [actor('attacker', 20), actor('target', 10)])
  state.combatants.target.currentHp = hp
  state.combatants.target.temporaryHp = temporaryHp
  state.combatants.target.concentrating = true
  const action: Dnd5eAction = {type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5,
    d20: 18, damage: {count: 1, sides: 6, bonus: 2, rolls: [4], type: 'fire'}}
  return {state, action}
}

it('observes final HP after temporary HP, before concentration loss, and decline commits damage once', () => {
  const {state, action} = fixture(4, 1)
  const original = structuredClone(state)
  let visits = 0
  const result = withDnd5eZeroHitPointCheckpoints((checkpoint, snapshot) => {
    visits++
    expect(checkpoint).toMatchObject({occurrence: 0, hitPointsBefore: 4, hitPointDamage: 5, remainingDamageAfterZero: 1})
    expect(snapshot.combatants.target).toMatchObject({currentHp: 0, temporaryHp: 0, concentrating: true})
    snapshot.combatants.target.currentHp = 999 // Listener receives an isolated preview.
  }, () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok).toBe(true)
  expect(visits).toBe(1)
  expect(result.state.combatants.target).toMatchObject({currentHp: 0, concentrating: false})
  expect(result.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
  expect(state).toEqual(original)
})

it('does not offer on already-zero HP, absorbed damage, survival, or instant death', () => {
  for (const [hp, temporaryHp, massive] of [[0, 0, false], [4, 9, false], [10, 0, false], [1, 0, true]] as const) {
    const {state, action} = fixture(hp, temporaryHp)
    if (massive && action.type === 'attack') action.damage = {count: 1, sides: 20, bonus: 2, rolls: [20], type: 'fire'}
    let visits = 0
    const result = withDnd5eZeroHitPointCheckpoints(() => { visits++ }, () => resolveDnd5eHeadlessAction(state, action))
    expect(result.ok).toBe(true)
    expect(visits).toBe(0)
  }
})

it('escapes swallowed dice errors without committing and removes the listener after suspension', () => {
  const {state, action} = fixture()
  const original = structuredClone(state)
  const pause = new Error('Host zero HP decision pending')
  expect(() => withDnd5eZeroHitPointCheckpoints(() => { throw pause },
    () => resolveDnd5eHeadlessAction(state, action))).toThrow(pause)
  expect(state).toEqual(original)
  const retried = resolveDnd5eHeadlessAction(state, action)
  expect(retried.ok).toBe(true)
  expect(retried.events.filter(event => event.type === 'damage-applied')).toHaveLength(1)
})

it('lets Death Ward settle before deciding whether a zero-HP reaction exists', () => {
  const {state, action} = fixture()
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({
    id: 'ward', definitionId: 'srd-5.1:spell:death-ward', label: 'Ward', targetId: 'target',
    source: {kind: 'spell', actorId: 'target', rulesId: 'death-ward'},
  })]
  let visits = 0
  const result = withDnd5eZeroHitPointCheckpoints(() => { visits++ }, () => resolveDnd5eHeadlessAction(state, action))
  expect(result.ok).toBe(true)
  expect(visits).toBe(0)
  expect(result.state.combatants.target.currentHp).toBe(1)
  expect(result.events).toContainEqual(expect.objectContaining({type: 'death-ward-triggered'}))
})

it('isolates nested replay scopes and restores the outer occurrence counter', () => {
  const {state, action} = fixture()
  const outer: number[] = [], inner: number[] = []
  withDnd5eZeroHitPointCheckpoints(checkpoint => { outer.push(checkpoint.occurrence) }, () => {
    expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(true)
    withDnd5eZeroHitPointCheckpoints(checkpoint => { inner.push(checkpoint.occurrence) }, () => {
      expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(true)
    })
    expect(resolveDnd5eHeadlessAction(state, action).ok).toBe(true)
  })
  expect(outer).toEqual([0, 1])
  expect(inner).toEqual([0])
})

it('keeps a Host-accepted zero-HP turn conscious but still dies on three damage failures', () => {
  const {state, action} = fixture(0)
  state.combatants.target.classState.zeroHitPointExtraTurn = {featureId: 'test:zero-turn', slotId: 'interrupting-turn:test', phase: 'active'}
  const original = structuredClone(state)
  let current = state
  for (const failures of [1, 2, 3]) {
    const result = resolveDnd5eHeadlessAction(current, {...action, spendAction: false})
    expect(result.ok).toBe(true)
    const target = result.state.combatants.target
    expect(target.deathSaves.failures).toBe(failures)
    expect(target.deathSaves.dead).toBe(failures === 3)
    expect(target.concentrating).toBe(failures < 3)
    expect(result.events).not.toContainEqual(expect.objectContaining({type: 'condition-applied', condition: 'unconscious'}))
    if (failures < 3) expect(result.events).toContainEqual(expect.objectContaining({type: 'concentration-check-required'}))
    else expect(target.classState.zeroHitPointExtraTurn).toBeUndefined()
    current = result.state
  }
  expect(state).toEqual(original)
})

it('ends the matching extra slot with unconsciousness only when still at zero HP', () => {
  for (const hp of [0, 5]) {
    const {state} = fixture()
    state.initiativeSlotIds = ['interrupting-turn:test', 'target-base']
    state.oneShotInitiativeSlotIds = ['interrupting-turn:test']
    state.turnSlotId = 'interrupting-turn:test'
    const actor = state.combatants.attacker
    actor.currentHp = hp
    actor.concentrating = true
    actor.classState.zeroHitPointExtraTurn = {featureId:'test:zero-turn',slotId:'interrupting-turn:test',phase:'active'}
    const original = structuredClone(state)
    const result = resolveDnd5eHeadlessAction(state, {type:'end-turn',actorId:'attacker'})
    expect(result.ok).toBe(true)
    const ended = result.state.combatants.attacker
    expect(ended.classState.zeroHitPointExtraTurn).toBeUndefined()
    expect(ended.conditions.includes('unconscious')).toBe(hp === 0)
    expect(ended.conditions.includes('prone')).toBe(hp === 0)
    expect(ended.concentrating).toBe(hp > 0)
    expect(ended.deathSaves.dead).toBe(false)
    expect(result.state.initiativeSlotIds).toEqual(['target-base'])
    expect(state).toEqual(original)
  }
})

it('resumes a paused turn without refreshing its economy or replaying turn-start after JSON reload', () => {
  for (const interruptedId of ['attacker', 'target']) {
    const {state} = fixture()
    state.initiativeIndex = interruptedId === 'attacker' ? 0 : 1
    const interrupted = state.combatants[interruptedId]
    interrupted.turn = {...interrupted.turn,actionAvailable:false,bonusActionAvailable:false,
      objectInteractionAvailable:false,movementRemaining:5,movementSpent:25,reactionAvailable:true}
    const captured = structuredClone(interrupted.turn)
    const inserted = planDnd5eInterruptingTurn(state, 'attacker', 'damage')!
    Object.assign(state, inserted.initiative)
    state.turnSlotId = inserted.receipt.extraSlotId
    state.combatants.attacker.classState.interruptedTurnResume = {receipt:inserted.receipt,economy:captured,
      attackProgress:{weaponAttackActionTurnKey:'original-turn',attacksMadeTurnKey:'original-turn',attacksMadeThisTurn:2,
        meleeAttackTargetIdsThisTurn:['original-target'],usedFeatureTurnKeys:{'rapid-strike':'original-turn'}}}
    interrupted.classState.weaponAttackActionTurnKey = 'extra-turn'
    interrupted.classState.attacksMadeTurnKey = 'extra-turn'
    interrupted.classState.attacksMadeThisTurn = 4
    interrupted.classState.declarativeUsedTurnKeys = {'rapid-strike':'extra-turn','long-rest-use':'used'}
    state.combatants.attacker.classState.zeroHitPointExtraTurn = {featureId:'test:zero-turn',slotId:inserted.receipt.extraSlotId,phase:'active'}
    state.combatants.attacker.turn.actionAvailable = true
    interrupted.turn.reactionAvailable = false
    const restored = JSON.parse(JSON.stringify(state))
    const result = resolveDnd5eHeadlessAction(restored, {type:'end-turn',actorId:'attacker'})
    expect(result.ok).toBe(true)
    expect(result.state.initiativeSlotIds?.[result.state.initiativeIndex]).toBe(inserted.receipt.interruptedSlotId)
    expect(result.state.combatants[interruptedId].turn).toEqual({...captured,reactionAvailable:false})
    expect(result.state.combatants[interruptedId].classState).toMatchObject({
      weaponAttackActionTurnKey:'original-turn',attacksMadeTurnKey:'original-turn',attacksMadeThisTurn:2,
      meleeAttackTargetIdsThisTurn:['original-target'],declarativeUsedTurnKeys:{'rapid-strike':'original-turn','long-rest-use':'used'},
    })
    expect(result.events).not.toContainEqual(expect.objectContaining({type:'turn-started',actorId:interruptedId}))
    expect(result.state.combatants.attacker.classState.interruptedTurnResume).toBeUndefined()
    expect(result.state.round).toBe(state.round)
    expect(restored).toEqual(state)
  }
})

it('counts critical damage as two failures during the conscious extra turn', () => {
  const {state, action} = fixture(0)
  state.combatants.target.classState.zeroHitPointExtraTurn = {featureId: 'test:zero-turn', slotId: 'interrupting-turn:test', phase: 'active'}
  if (action.type !== 'attack') throw new Error('Expected attack fixture')
  action.d20 = 20
  action.damage = {count: 1, sides: 6, bonus: 2, rolls: [2, 2], type: 'fire'}
  const result = resolveDnd5eHeadlessAction(state, action)
  expect(result.ok).toBe(true)
  const target = result.state.combatants.target
  expect(target.deathSaves.dead).toBe(false)
  expect(target.deathSaves.failures).toBe(2)
  expect(target.classState.zeroHitPointExtraTurn?.phase).toBe('active')
  expect(target.concentrating).toBe(true)
})

it('permits attacks only during the active zero-HP turn, never while pending or dead', () => {
  for (const phase of ['pending', 'active', 'dead'] as const) {
    const {state, action} = fixture()
    state.combatants.attacker.currentHp = 0
    state.combatants.attacker.classState.zeroHitPointExtraTurn = {featureId: 'test:zero-turn', slotId: 'interrupting-turn:test',
      phase: phase === 'pending' ? 'pending' : 'active'}
    if (phase === 'dead') state.combatants.attacker.deathSaves.dead = true
    const result = resolveDnd5eHeadlessAction(state, action)
    expect(result.ok).toBe(phase === 'active')
    if (result.ok) expect(result.events).toContainEqual(expect.objectContaining({type: 'attack-resolved', actorId: 'attacker'}))
    const moved = resolveDnd5eHeadlessAction(state, {type: 'move', actorId: 'attacker', to: {x: 5, y: 0}, distance: 5})
    expect(moved.ok).toBe(phase === 'active')
    if (moved.ok) expect(moved.state.combatants.attacker.position).toEqual({x: 5, y: 0})
  }
})
