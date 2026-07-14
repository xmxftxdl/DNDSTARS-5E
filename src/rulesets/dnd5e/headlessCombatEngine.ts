import type { AbilityKey } from '../../lib/dnd'
import type { D20RollMode, TurnEconomy, TurnResource } from '../contracts'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'

export interface Dnd5eCombatant {
  id: string
  name: string
  level: number
  controller: 'dm' | 'player'
  initiative: number
  abilities: Record<AbilityKey, number>
  proficiencyBonus: number
  armorClass: number
  currentHp: number
  maxHp: number
  temporaryHp: number
  speed: number
  position: { x: number; y: number }
  turn: TurnEconomy
  dodging: boolean
  disengaged: boolean
  concentrating: boolean
  classResources: Record<string, { current: number; max: number }>
  deathSaves: { successes: number; failures: number; stable: boolean; dead: boolean }
}

export interface Dnd5eHeadlessCombatState {
  rulesetId: typeof rules.id
  combatId: string
  active: boolean
  round: number
  initiativeIndex: number
  initiativeOrder: readonly string[]
  combatants: Record<string, Dnd5eCombatant>
}

export type Dnd5eAction =
  | { type: 'attack'; actorId: string; targetId: string; attackModifier: number; criticalThreshold?: number; d20: number; d20Second?: number; mode?: D20RollMode; damage: { count: number; sides: number; bonus: number; rolls: readonly number[] } }
  | { type: 'move'; actorId: string; to: { x: number; y: number }; distance: number }
  | { type: 'dash'; actorId: string }
  | { type: 'disengage'; actorId: string }
  | { type: 'dodge'; actorId: string }
  | { type: 'death-save'; actorId: string; d20: number }
  | { type: 'concentration-save'; actorId: string; d20: number; dc: number; modifier: number }
  | { type: 'fighter-second-wind'; actorId: string; resourceKey: string; d10: number }
  | { type: 'fighter-action-surge'; actorId: string; resourceKey: string; alreadyUsedThisTurn: boolean }
  | { type: 'end-turn'; actorId: string }
  | { type: 'opportunity-attack'; actorId: string; targetId: string; attackModifier: number; d20: number; damage: { count: number; sides: number; bonus: number; rolls: readonly number[] } }

export type Dnd5eCombatEvent =
  | { type: 'turn-started'; actorId: string; round: number }
  | { type: 'turn-resource-spent'; actorId: string; resource: TurnResource; amount?: number }
  | { type: 'moved'; actorId: string; from: { x: number; y: number }; to: { x: number; y: number }; distance: number }
  | { type: 'attack-resolved'; actorId: string; targetId: string; d20: number; total: number; armorClass: number; hit: boolean; critical: boolean }
  | { type: 'healing-applied'; targetId: string; amount: number; hpBefore: number; hpAfter: number }
  | { type: 'class-resource-spent'; actorId: string; resourceKey: string; current: number; max: number }
  | { type: 'action-surge-granted'; actorId: string }
  | { type: 'damage-applied'; targetId: string; amount: number; hpBefore: number; hpAfter: number; temporaryHpBefore: number; temporaryHpAfter: number }
  | { type: 'concentration-check-required'; targetId: string; dc: number }
  | { type: 'death-save-failure'; targetId: string; failures: number }
  | { type: 'death-save-resolved'; actorId: string; d20: number; successes: number; failures: number; stable: boolean; dead: boolean; currentHp: number }
  | { type: 'concentration-resolved'; actorId: string; d20: number; total: number; dc: number; success: boolean }
  | { type: 'combat-ended' }

export type Dnd5eActionFailure =
  | 'combat-ended'
  | 'stale-turn'
  | 'invalid-actor'
  | 'invalid-target'
  | 'action-unavailable'
  | 'reaction-unavailable'
  | 'bonus-action-unavailable'
  | 'class-resource-unavailable'
  | 'feature-already-used'
  | 'insufficient-movement'
  | 'invalid-dice'

export type Dnd5eActionResult =
  | { ok: true; state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[] }
  | { ok: false; state: Dnd5eHeadlessCombatState; events: readonly Dnd5eCombatEvent[]; reason: Dnd5eActionFailure }

function clone(state: Dnd5eHeadlessCombatState): Dnd5eHeadlessCombatState {
  return {
    ...state,
    initiativeOrder: [...state.initiativeOrder],
    combatants: Object.fromEntries(Object.entries(state.combatants).map(([id, combatant]) => [id, {
      ...combatant,
      abilities: { ...combatant.abilities },
      classResources: Object.fromEntries(Object.entries(combatant.classResources).map(([key, resource]) => [key, { ...resource }])),
      position: { ...combatant.position },
      turn: { ...combatant.turn },
      deathSaves: { ...combatant.deathSaves },
    }])),
  }
}

export function createDnd5eCombatant(
  input: Omit<Dnd5eCombatant, 'turn' | 'dodging' | 'disengaged' | 'deathSaves' | 'level' | 'classResources'> &
    Partial<Pick<Dnd5eCombatant, 'level' | 'classResources'>>,
): Dnd5eCombatant {
  return {
    ...input,
    level: Math.min(20, Math.max(1, Math.floor(input.level ?? 1))),
    classResources: Object.fromEntries(Object.entries(input.classResources ?? {}).map(([key, resource]) => [key, { ...resource }])),
    turn: rules.createTurn(input.speed),
    dodging: false,
    disengaged: false,
    deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
  }
}

export function startDnd5eHeadlessCombat(combatId: string, combatants: readonly Dnd5eCombatant[]): Dnd5eHeadlessCombatState {
  const ordered = [...combatants].sort((left, right) => right.initiative - left.initiative)
  const state: Dnd5eHeadlessCombatState = {
    rulesetId: rules.id,
    combatId,
    active: ordered.length > 1,
    round: 1,
    initiativeIndex: 0,
    initiativeOrder: ordered.map((combatant) => combatant.id),
    combatants: Object.fromEntries(ordered.map((combatant) => [combatant.id, { ...combatant, turn: rules.createTurn(combatant.speed) }])),
  }
  return state
}

function currentActorId(state: Dnd5eHeadlessCombatState): string | undefined {
  return state.initiativeOrder[state.initiativeIndex]
}

function fail(state: Dnd5eHeadlessCombatState, events: readonly Dnd5eCombatEvent[], reason: Dnd5eActionFailure): Dnd5eActionResult {
  return { ok: false, state, events, reason }
}

function spend(combatant: Dnd5eCombatant, resource: TurnResource, amount = 1): boolean {
  const validation = rules.validateTurnCost(combatant.turn, { resource, amount })
  if (!validation.valid) return false
  combatant.turn = rules.spendTurnCost(combatant.turn, { resource, amount })
  return true
}

function spendClassResource(combatant: Dnd5eCombatant, resourceKey: string, events: Dnd5eCombatEvent[]): boolean {
  const resource = combatant.classResources[resourceKey]
  if (!resource || resource.current < 1) return false
  resource.current -= 1
  events.push({ type: 'class-resource-spent', actorId: combatant.id, resourceKey, current: resource.current, max: resource.max })
  return true
}

function applyDamage(target: Dnd5eCombatant, amount: number, critical: boolean, events: Dnd5eCombatEvent[]): void {
  const hpBefore = target.currentHp
  const temporaryHpBefore = target.temporaryHp
  const absorbed = Math.min(target.temporaryHp, amount)
  target.temporaryHp -= absorbed
  target.currentHp = Math.max(0, target.currentHp - (amount - absorbed))
  events.push({ type: 'damage-applied', targetId: target.id, amount, hpBefore, hpAfter: target.currentHp, temporaryHpBefore, temporaryHpAfter: target.temporaryHp })
  if (target.concentrating && amount > 0) events.push({ type: 'concentration-check-required', targetId: target.id, dc: rules.concentrationCheckDc(amount) })
  if (hpBefore === 0) {
    const next = rules.applyDamageAtZeroHp({ ...target.deathSaves, currentHp: 0 }, critical)
    target.deathSaves = { successes: next.successes, failures: next.failures, stable: next.stable, dead: next.dead }
    events.push({ type: 'death-save-failure', targetId: target.id, failures: next.failures })
  }
}

function resolveWeaponAttack(state: Dnd5eHeadlessCombatState, action: Extract<Dnd5eAction, { type: 'attack' | 'opportunity-attack' }>, events: Dnd5eCombatEvent[]): Dnd5eActionResult {
  const actor = state.combatants[action.actorId]
  const target = state.combatants[action.targetId]
  if (!actor || actor.currentHp <= 0) return fail(state, events, 'invalid-actor')
  if (!target || target.deathSaves.dead) return fail(state, events, 'invalid-target')
  const resource: TurnResource = action.type === 'opportunity-attack' ? 'reaction' : 'action'
  if (!spend(actor, resource)) return fail(state, events, resource === 'reaction' ? 'reaction-unavailable' : 'action-unavailable')
  events.push({ type: 'turn-resource-spent', actorId: actor.id, resource })
  const requestedMode = action.type === 'attack' ? (action.mode ?? 'normal') : 'normal'
  const mode = target.dodging ? (requestedMode === 'advantage' ? 'normal' : 'disadvantage') : requestedMode
  const rolls = mode === 'normal' ? [action.d20] : [action.d20, action.type === 'attack' ? (action.d20Second ?? action.d20) : action.d20]
  let attack
  try {
    attack = rules.resolveAttack({ rolls, mode, modifier: action.attackModifier, targetAc: target.armorClass })
  } catch {
    return fail(state, events, 'invalid-dice')
  }
  const criticalThreshold = action.type === 'attack' ? Math.min(20, Math.max(18, action.criticalThreshold ?? 20)) : 20
  const critical = attack.roll.d20 >= criticalThreshold
  const hit = attack.hit || critical
  events.push({ type: 'attack-resolved', actorId: actor.id, targetId: target.id, d20: attack.roll.d20, total: attack.roll.total, armorClass: target.armorClass, hit, critical })
  if (hit) {
    try {
      const damage = rules.resolveDamage({ ...action.damage, critical })
      applyDamage(target, damage.total, critical, events)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
  }
  return { ok: true, state, events }
}

export function resolveDnd5eHeadlessAction(source: Dnd5eHeadlessCombatState, action: Dnd5eAction): Dnd5eActionResult {
  const state = clone(source)
  const events: Dnd5eCombatEvent[] = []
  if (!state.active) return fail(state, events, 'combat-ended')
  const offTurn = action.type === 'opportunity-attack'
  if (!offTurn && currentActorId(state) !== action.actorId) return fail(state, events, 'stale-turn')
  const actor = state.combatants[action.actorId]
  if (!actor || (actor.currentHp <= 0 && action.type !== 'death-save')) return fail(state, events, 'invalid-actor')

  if (action.type === 'attack' || action.type === 'opportunity-attack') return resolveWeaponAttack(state, action, events)
  if (action.type === 'death-save') {
    if (actor.currentHp > 0 || actor.deathSaves.dead || actor.deathSaves.stable) return fail(state, events, 'invalid-actor')
    let resolved
    try {
      resolved = rules.resolveDeathSave({ ...actor.deathSaves, currentHp: actor.currentHp }, action.d20)
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    actor.currentHp = resolved.currentHp
    actor.deathSaves = { successes: resolved.successes, failures: resolved.failures, stable: resolved.stable, dead: resolved.dead }
    events.push({ type: 'death-save-resolved', actorId: actor.id, d20: action.d20, ...actor.deathSaves, currentHp: actor.currentHp })
    return { ok: true, state, events }
  }
  if (action.type === 'concentration-save') {
    if (!actor.concentrating) return fail(state, events, 'invalid-actor')
    let resolved
    try {
      resolved = rules.resolveSavingThrow({ rolls: [action.d20], modifier: action.modifier, dc: action.dc })
    } catch {
      return fail(state, events, 'invalid-dice')
    }
    if (!resolved.success) actor.concentrating = false
    events.push({ type: 'concentration-resolved', actorId: actor.id, d20: resolved.roll.d20, total: resolved.roll.total, dc: action.dc, success: resolved.success })
    return { ok: true, state, events }
  }
  if (action.type === 'fighter-second-wind') {
    if (!Number.isInteger(action.d10) || action.d10 < 1 || action.d10 > 10) return fail(state, events, 'invalid-dice')
    if (!spend(actor, 'bonusAction')) return fail(state, events, 'bonus-action-unavailable')
    if (!spendClassResource(actor, action.resourceKey, events)) return fail(state, events, 'class-resource-unavailable')
    events.unshift({ type: 'turn-resource-spent', actorId: actor.id, resource: 'bonusAction' })
    const hpBefore = actor.currentHp
    actor.currentHp = Math.min(actor.maxHp, actor.currentHp + action.d10 + actor.level)
    events.push({ type: 'healing-applied', targetId: actor.id, amount: actor.currentHp - hpBefore, hpBefore, hpAfter: actor.currentHp })
    return { ok: true, state, events }
  }
  if (action.type === 'fighter-action-surge') {
    if (action.alreadyUsedThisTurn) return fail(state, events, 'feature-already-used')
    if (!spendClassResource(actor, action.resourceKey, events)) return fail(state, events, 'class-resource-unavailable')
    actor.turn = { ...actor.turn, actionAvailable: true }
    events.push({ type: 'action-surge-granted', actorId: actor.id })
    return { ok: true, state, events }
  }
  if (action.type === 'move') {
    if (!spend(actor, 'movement', action.distance)) return fail(state, events, 'insufficient-movement')
    const from = { ...actor.position }
    actor.position = { ...action.to }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'movement', amount: action.distance })
    events.push({ type: 'moved', actorId: actor.id, from, to: actor.position, distance: action.distance })
    return { ok: true, state, events }
  }
  if (action.type === 'dash') {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    actor.turn = { ...actor.turn, movementRemaining: actor.turn.movementRemaining + actor.speed }
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    return { ok: true, state, events }
  }
  if (action.type === 'disengage' || action.type === 'dodge') {
    if (!spend(actor, 'action')) return fail(state, events, 'action-unavailable')
    actor.disengaged = action.type === 'disengage'
    actor.dodging = action.type === 'dodge'
    events.push({ type: 'turn-resource-spent', actorId: actor.id, resource: 'action' })
    return { ok: true, state, events }
  }

  const wrapped = state.initiativeIndex + 1 >= state.initiativeOrder.length
  state.initiativeIndex = wrapped ? 0 : state.initiativeIndex + 1
  if (wrapped) state.round += 1
  const nextId = currentActorId(state)
  const next = nextId ? state.combatants[nextId] : undefined
  if (next) {
    next.turn = rules.createTurn(next.speed)
    next.dodging = false
    next.disengaged = false
    events.push({ type: 'turn-started', actorId: next.id, round: state.round })
  }
  return { ok: true, state, events }
}
