import type { Dnd5eActivityCapabilityProposal } from './activities/dnd5eActivityExecutor'
import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { Dnd5eDamageType } from './damageTypes'
import type { Dnd5eCombatant, Dnd5eCombatEvent, Dnd5eHeadlessCombatState } from './headlessCombatEngine'

/** amount is the expected damage before the new reaction. Raw-phase resolvers
 * retain original typed components and apply defenses after the reaction.
 * An adjusted-phase amount must never be subjected to defenses a second time.
 */
export interface Dnd5eDamageCommitCheckpoint {
  occurrence: number
  targetId: string
  sourceId?: string
  amount: number
  damageTypes: readonly Dnd5eDamageType[]
  phase: 'adjusted-damage-before-hit-points' | 'raw-typed-damage-before-defenses'
}

export interface Dnd5eDamageCommitReaction {
  deferredEffects?: readonly Dnd5eDeferredDamageEffect[]
  target: Dnd5eCombatant
  events: readonly Dnd5eCombatEvent[]
}

type Listener = (checkpoint: Dnd5eDamageCommitCheckpoint, state?: Dnd5eHeadlessCombatState) => Dnd5eDamageCommitReaction | void
let active: { listener: Listener; occurrence: number; interrupted?: boolean; interruption?: unknown } | undefined

export function hasDnd5eDamageCommitListener(): boolean { return active != null }

/** Synchronous, Host-only scope; no listener survives a completed/failed replay. */
export function withDnd5eDamageCommitCheckpoints<T>(listener: Listener, run: () => T): T {
  const previous = active
  active = { listener, occurrence: 0 }
  try { return run() } finally { active = previous }
}

export function visitDnd5eDamageCommitCheckpoint(
  value: Omit<Dnd5eDamageCommitCheckpoint, 'occurrence' | 'phase'>,
  state?: Dnd5eHeadlessCombatState,
  phase: Dnd5eDamageCommitCheckpoint['phase'] = 'adjusted-damage-before-hit-points',
): Dnd5eDamageCommitReaction | void {
  if (!active || value.amount <= 0) return
  try {
    return active.listener({ ...value, damageTypes: [...value.damageTypes], occurrence: active.occurrence++, phase }, state ? structuredClone(state) : undefined)
  } catch (error) {
    active.interrupted = true
    active.interruption = error
    throw error
  }
}

/** Legacy dice handlers may catch broad errors. A checkpoint must still escape
 * the root transaction before observers or callers can mistake it for a result.
 */
export function rethrowDnd5eDamageCommitInterruption(): void {
  if (active?.interrupted) throw active.interruption
}

/** Host-only resolved effects; never a player-supplied executable callback. */
export interface Dnd5eDeferredDamageEffect {
  actorId: string
  proposal: Extract<Dnd5eActivityCapabilityProposal, {kind:'apply-effect'}>
  rulesId: string
  sourceKind: Dnd5eActiveEffectInstance['source']['kind']
  spellLevel?: number
  sourcePackageId?: string
  sourceRulesId?: string
}
let deferredCollector: Dnd5eDeferredDamageEffect[] | undefined
export function collectDnd5eDeferredDamageEffects<T>(run:()=>T): {result:T;effects:Dnd5eDeferredDamageEffect[]} {
  const previous=deferredCollector
  const effects:Dnd5eDeferredDamageEffect[]=[]
  deferredCollector=effects
  try { return {result:run(),effects} } finally { deferredCollector=previous }
}
export function queueDnd5eDeferredDamageEffect(effect:Dnd5eDeferredDamageEffect):boolean {
  if(!deferredCollector)return false
  deferredCollector.push(structuredClone(effect))
  return true
}
