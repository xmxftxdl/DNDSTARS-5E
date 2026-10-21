import { afterEach, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { buildDnd5eCustomMonster, createDnd5eCustomMonsterDraft, createDnd5eCustomMonsterMechanicDraft } from './customMonsterWorkshop'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { setDnd5eRoomMonsterCatalog } from './monsters'

afterEach(() => setDnd5eRoomMonsterCatalog([]))

it.each(['damage', 'attack'] as const)('pending %s mechanics isolate source bonuses, critical dice and rollback', kind => {
  for (const mode of ['own', 'foreign', 'suspended', 'resistant', 'negative', 'invalid', 'critical', 'miss'] as const) {
    if (kind === 'damage' && ['critical', 'miss'].includes(mode)) continue
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{ ...createDnd5eCustomMonsterMechanicDraft(), id: 'intercept', name: 'Intercept',
      trigger: 'movement', triggerSubject: 'hostile-within', triggerRadiusFeet: 30,
      movementComparison: 'at-least', movementFeet: 5, hpPercentageAtOrBelow: undefined,
      effectKind: kind, effectTarget: 'selected-subject', healingDice: mode === 'negative' ? '1d6-6' : '1d6+2',
      damageType: 'piercing', attackToHit: 6, attackEconomy: 'reaction', limit: 'once-per-turn' }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
      controller: id === 'target' ? 'player' : 'dm', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
      concentrating: false, position: { x: 0, y: 0 }, ...(id === 'owner' ? { statBlockId: monster.id } : {}) })
    const state = startDnd5eHeadlessCombat('mechanic-bonus', [make('target', 20), make('owner', 10)])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('target', 'owner')]: 10 }
    state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: 'target',
      source: { kind: 'feature', actorId: mode === 'foreign' ? 'other' : 'owner' }, modifiers: { damageRollsBySourceBonus: 3 } })]
    if (mode === 'suspended') state.combatants.target.classState.activeEffects[0].suspendedBy = ['antimagic']
    if (mode === 'resistant') state.combatants.target.damageResistances = ['piercing']
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'target', to: { x: 1, y: 0 }, distance: 5 })
    expect(moved.ok, JSON.stringify(moved)).toBe(true)
    const pending = moved.events.find(event => event.type === 'monster-mechanic-trigger-pending')
    expect(pending).toBeDefined()
    if (pending?.type !== 'monster-mechanic-trigger-pending') throw new Error('Missing trigger')
    const input = JSON.parse(JSON.stringify(moved.state)) as typeof state
    const before = structuredClone(input)
    const rolls = mode === 'critical' ? [4, 3] : mode === 'miss' ? [] : [mode === 'invalid' ? 7 : 4]
    const action = { type: 'resolve-monster-mechanic-trigger' as const, actorId: 'owner', snapshotId: pending.snapshot.id,
      roll: { actorId: 'owner', mechanicId: 'intercept', ...(kind === 'damage'
        ? { effectRolls: [{ effectId: 'effect-0', rolls }] }
        : { targetId: 'target', attackRolls: [{ effectId: 'effect-0', targetId: 'target', d20: mode === 'critical' ? 20 : mode === 'miss' ? 1 : 15, damageRolls: rolls }] }) } }
    const result = resolveDnd5eHeadlessAction(input, action)
    expect(result.ok, `${kind}/${mode}: ${JSON.stringify(result)}`).toBe(mode !== 'invalid')
    const amount = { own: 9, foreign: 6, suspended: 6, resistant: 4, negative: 1, invalid: 0, critical: 12, miss: 0 }[mode]
    expect(result.state.combatants.target.currentHp, `${kind}/${mode}`).toBe(30 - amount)
    if (!result.ok) {
      expect(result.reason).toBe('invalid-dice')
      expect(result.state).toEqual(before)
    } else {
      expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(['own', 'resistant', 'negative', 'critical'].includes(mode) ? 1 : 0)
      expect(result.state.pendingMonsterMechanicTriggers?.[pending.snapshot.id]).toBeUndefined()
      if (kind === 'attack') expect(result.state.combatants.owner.turn.reactionAvailable).toBe(false)
      const replay = resolveDnd5eHeadlessAction(result.state, action)
      expect(replay.ok).toBe(false)
      expect(replay.state).toEqual(result.state)
    }
    expect(input).toEqual(before)
  }
})


it.each(['own', 'foreign', 'fixed-primary', 'invalid', 'same-type', 'combined-dc'] as const)('synchronous after-hit damage shares one weapon bonus: %s', mode => {
  const draft = createDnd5eCustomMonsterDraft()
  draft.actions[0].toHit = 8
  draft.headlessMechanics = [{ ...createDnd5eCustomMonsterMechanicDraft(), id: 'rider', name: 'Rider',
    trigger: 'after-hit', hpPercentageAtOrBelow: 100, effectKind: 'damage', effectTarget: 'trigger-target',
    healingDice: mode === 'combined-dc' ? '5d6' : '1d6', damageType: 'fire', limit: 'once-per-turn', preservedEffects: [
      { id: 'effect-0', kind: 'damage', target: 'trigger-target', dice: { count: mode === 'combined-dc' ? 5 : 1, sides: 6, bonus: 0 }, damageType: 'fire' },
      { id: 'effect-1', kind: 'damage', target: 'trigger-target', dice: { count: 1, sides: 6, bonus: 0 }, damageType: 'poison' },
      { id: 'effect-2', kind: 'standard-condition', target: 'trigger-target', condition: 'petrified', duration: { kind: 'rounds', rounds: 1 } },
    ] }]
  const monster = buildDnd5eCustomMonster(draft)
  monster.actions[0].attack!.damage = [{ count: mode === 'fixed-primary' ? 0 : 1, sides: 6,
    bonus: mode === 'fixed-primary' ? 2 : 0, average: 2, type: mode === 'same-type' ? 'fire' : 'slashing' }]
  setDnd5eRoomMonsterCatalog([monster])
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'actor' ? 'dm' : 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 12, currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
    concentrating: id === 'target', position: { x: 0, y: 0 }, ...(id === 'actor' ? { statBlockId: monster.id } : {}) })
  const state = startDnd5eHeadlessCombat('rider', [make('actor', 20), make('target', 10)])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
  state.combatants.target.classState.activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'mark', label: 'Mark', targetId: 'target',
    source: { kind: 'feature', actorId: mode === 'foreign' ? 'other' : 'actor' }, modifiers: { damageRollsBySourceBonus: 3 } })]
  if(mode === 'same-type')state.combatants.target.damageResistances=['fire']
  const before = structuredClone(state)
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-action', actorId: 'actor', actionId: monster.actions[0].id,
    rolls: [{ targetId: 'target', d20: 15, damageRolls: [mode === 'fixed-primary' ? [] : [2]] }],
    mechanicRolls: [{ actorId: 'actor', mechanicId: 'rider', targetId: 'target', effectRolls: [
      { effectId: 'effect-0', rolls: mode === 'combined-dc' ? [6,6,6,6,6] : mode === 'same-type' ? [3] : [4] }, { effectId: 'effect-1', rolls: [mode === 'invalid' ? 7 : 3] },
    ] }] })
  expect(result.ok, JSON.stringify(result)).toBe(mode !== 'invalid')
  expect(result.state.combatants.target.currentHp).toBe(mode === 'invalid' ? 100 : mode === 'foreign' ? 91 : mode === 'same-type' ? 93 : mode === 'combined-dc' ? 62 : 88)
  if (!result.ok) expect(result.state).toEqual(before)
  else expect(result.events.filter(event => event.type === 'damage-roll-bonus-applied')).toHaveLength(mode === 'foreign' ? 0 : 1)
  expect(result.events.filter(event=>event.type==='concentration-check-required')).toHaveLength(mode==='invalid'?0:1)
  if(mode==='combined-dc')expect(result.events).toContainEqual(expect.objectContaining({type:'concentration-check-required',dc:19}))
  if(result.ok)expect(result.state.combatants.target.conditions).toContain('petrified')
  expect(state).toEqual(before)
})
