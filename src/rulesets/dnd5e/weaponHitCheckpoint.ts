import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect } from './activeEffects'

export type Dnd5eWeaponHitEvent = Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>
/** Host-internal rule decision, never a player action payload. The caller must
 * authorize the registered Activity before supplying its costs and dice. */
export interface Dnd5eWeaponHitDecision {
  /** Host-resolved, effects-only continuation; damage and costs stay in the weapon transaction. */
  linkedEffectApplications?: readonly { packageId: string; activityId: string; targetId: string; sourceId: string;
    resolution: Extract<import('./activities/dnd5eActivityExecutor').Dnd5eActivityExecutionResult, {ok:true}> }[]
  followRequests?: readonly {packageId:string;activityId:string;actorId:string;targetId:string;targetRadiusFeet:number}[]
  pushMovements?: readonly (import('./weaponHitMovement').Dnd5eHitMovementPlan & {activityId:string;maximumFeet:number})[]
  /** Host-authorized additional creatures; damage inherits the primary weapon source. */
  secondaryDamageTargets?: readonly { targetId: string; amount: number }[]
  /** Host-resolved self defense, ending at the attacker's next turn start. */
  actorArmorBonuses?: readonly { packageId: string; activityId: string; effectId: string; label: string; amount: number }[]
  targetWeaponMultipliers?: readonly { packageId: string; activityId: string; effectId: string; label: string; targetId: string; multiplier: number; magical: boolean }[]
  targetSightLimits?: readonly { packageId: string; activityId: string; effectId: string; label: string; targetId: string; rangeFeet: number; magical: boolean }[]
  extraDice?: { count: number; rolls: readonly number[]; doubleOnCritical: boolean }
  additionalDice?: readonly { count: number; rolls: readonly number[]; doubleOnCritical: boolean }[]
  handledActivities?: readonly { packageId: string; activityId: string }[]
  /** Already evaluated by the Host Activity resolver, including critical dice. */
  resolvedBonusDamage?: number
  resolvedBonusDamageRolled?: boolean
  damageComponents?: readonly { amount: number; type: Dnd5eDamageType; magical?: boolean; rolled?: boolean }[]
  usageKeys?: readonly string[]
  consumedGrants?: readonly { packageId: string; activityId: string; effectId: string }[]
  resourceCosts: readonly { resourceId: string; amount: number }[]
}

export function applyDnd5eWeaponHitArmorBonuses(state: Dnd5eHeadlessCombatState, actorId: string, decision: Dnd5eWeaponHitDecision): boolean {
  const weaknesses = decision.targetWeaponMultipliers ?? []
  const sightLimits = decision.targetSightLimits ?? []
  if (sightLimits.length > 32 || sightLimits.some(rule => !rule.packageId || !rule.activityId || !rule.effectId || !rule.label ||
    !state.combatants[rule.targetId] || !Number.isInteger(rule.rangeFeet) || rule.rangeFeet < 1 || rule.rangeFeet > 10000)) return false
  if (weaknesses.length > 32 || weaknesses.some(rule => !rule.packageId || !rule.activityId || !rule.effectId || !rule.label ||
    !state.combatants[rule.targetId] || !Number.isFinite(rule.multiplier) || rule.multiplier < 0 || rule.multiplier > 1)) return false
  const bonuses = decision.actorArmorBonuses ?? []
  if (bonuses.length > 32 || bonuses.some(bonus => !bonus.packageId || !bonus.activityId || !bonus.effectId || !bonus.label ||
    !Number.isSafeInteger(bonus.amount) || bonus.amount < 0 || bonus.amount > 1000)) return false
  const actor = state.combatants[actorId]
  if (!actor) return false
  for (const bonus of bonuses) {
    const id = `hit-defense:${bonus.packageId}:${bonus.activityId}:${bonus.effectId}:${actorId}`
    actor.classState.activeEffects = (actor.classState.activeEffects ?? []).filter(effect => effect.id !== id)
    actor.classState.activeEffects.push(createDnd5eMechanicalEffect({id, definitionId: `${bonus.packageId}:${bonus.effectId}`,
      label: bonus.label, targetId: actorId, source: {kind:'feature',actorId,pluginId:bonus.packageId,rulesId:bonus.activityId},
      duration:{type:'rounds',remainingRounds:1,tickOn:'source-turn-start'},modifiers:{armorClassBonus:bonus.amount}}))
  }
  for (const rule of weaknesses) {
    const target = state.combatants[rule.targetId]
    const id = `hit-weapon-multiplier:${rule.packageId}:${rule.effectId}:${actorId}:${target.id}`
    target.classState.activeEffects = (target.classState.activeEffects ?? []).filter(effect => effect.id !== id)
    target.classState.activeEffects.push(createDnd5eMechanicalEffect({ id, definitionId: `${rule.packageId}:${rule.effectId}`,
      label: rule.label, targetId: target.id, source: { kind: 'feature', actorId, pluginId: rule.packageId, rulesId: rule.activityId, magical: rule.magical },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'source-turn-start' },
      modifiers: { weaponDamageMultipliers: [{ multiplier: rule.multiplier }] } }))
  }
  for (const rule of sightLimits) {
    const target = state.combatants[rule.targetId]
    const id = `hit-sight-limit:${rule.packageId}:${rule.effectId}:${actorId}:${target.id}`
    target.classState.activeEffects = (target.classState.activeEffects ?? []).filter(effect => effect.id !== id)
    target.classState.activeEffects.push(createDnd5eMechanicalEffect({id,definitionId:`${rule.packageId}:${rule.effectId}`,label:rule.label,
      targetId:target.id,source:{kind:'feature',actorId,pluginId:rule.packageId,rulesId:rule.activityId,magical:rule.magical},
      duration:{type:'rounds',remainingRounds:1,tickOn:'source-turn-start'},modifiers:{sightRangeLimitFeet:rule.rangeFeet}}))
  }
  return true
}
type Listener = (event: Dnd5eWeaponHitEvent, state: Dnd5eHeadlessCombatState) => Dnd5eWeaponHitDecision | void
let active: { listener: Listener; interrupted?: boolean; error?: unknown } | undefined

/** Synchronous replay scope only. Never keep a listener installed across await. */
export function withDnd5eWeaponHitCheckpoints<T>(listener: Listener, run: () => T): T {
  const previous = active
  active = { listener }
  try { return run() } finally { active = previous }
}

export function visitDnd5eWeaponHitCheckpoint(event: Dnd5eWeaponHitEvent, state: Dnd5eHeadlessCombatState) {
  if (!active || !event.hit || (!['weapon', 'spell'].includes(event.attackCategory ?? '') && !event.attackDelivery)) return
  try { return active.listener(structuredClone(event), structuredClone(state)) }
  catch (error) { active.interrupted = true; active.error = error; throw error }
}

export function rethrowDnd5eWeaponHitInterruption() {
  if (active?.interrupted) throw active.error
}
