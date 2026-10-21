import { resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { withDnd5eDamageCommitCheckpoints, type Dnd5eDamageCommitCheckpoint } from './damageCommitCheckpoint'
import { resolveDnd5eDamageCheckpointReaction, type Dnd5eDamageReactionSelection, type Dnd5eDamageReactionResolution } from './damageCommitReaction'
import { resolveRegisteredDnd5eActivityInCombatV1, type Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './activities/dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import type { Character } from '../../types/character'
import { createDnd5eDamageReactionMaterialLedger, type Dnd5eReactionMaterialChange } from './damageReactionMaterialLedger'
import { withDnd5eWeaponHitCheckpoints, type Dnd5eWeaponHitEvent, type Dnd5eWeaponHitDecision } from './weaponHitCheckpoint'
import { cloneDnd5eHostTransactionInput } from './hostTransactionClone'
import {withDnd5eHitPushCheckpoints,type Dnd5eHitPushEvent,type Dnd5eHitPushReceipts} from './weaponHitPushCheckpoint'
import {withDnd5eHitFollowCheckpoints,type Dnd5eHitFollowRequest,type Dnd5eHitFollowChoice} from './weaponHitFollowCheckpoint'
import { withDnd5eCriticalCancellationCheckpoints, type Dnd5eCriticalHitEvent, type Dnd5eCriticalCancellationSelection } from './criticalCancellationCheckpoint'
import { dnd5eCriticalCancellationOptions, resolveDnd5eCriticalCancellation } from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { withDnd5eZeroHitPointCheckpoints, type Dnd5eZeroHitPointCheckpoint } from './zeroHitPointCheckpoint'
import { dnd5eZeroHitPointTurnOptions } from './zeroHitPointReaction'
import { beginDnd5eAcceptedZeroHitPointTurn } from './zeroHitPointTurn'

class PendingZero extends Error {
 readonly checkpoint:Dnd5eZeroHitPointCheckpoint
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(checkpoint:Dnd5eZeroHitPointCheckpoint,snapshot:Dnd5eHeadlessCombatState){super('zero-hp-choice-required');this.checkpoint=checkpoint;this.snapshot=snapshot}
}
class PendingZeroStart extends Error {
 readonly actorId:string
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(actorId:string,snapshot:Dnd5eHeadlessCombatState){super('zero-hp-start-input-required');this.actorId=actorId;this.snapshot=snapshot}
}

class PendingCritical extends Error {
 readonly event:Dnd5eCriticalHitEvent
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(event:Dnd5eCriticalHitEvent,snapshot:Dnd5eHeadlessCombatState,occurrence:number){
  super('critical-cancellation-required');this.event=event;this.snapshot=snapshot;this.occurrence=occurrence
 }
}

class PendingHitFollow extends Error {
 readonly request:Dnd5eHitFollowRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(request:Dnd5eHitFollowRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){
  super('hit-follow-selection-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence
 }
}

class PendingHitPush extends Error {
 readonly event:Dnd5eHitPushEvent
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(event:Dnd5eHitPushEvent,snapshot:Dnd5eHeadlessCombatState,occurrence:number){
  super('hit-push-consequences-required');this.event=event;this.snapshot=snapshot;this.occurrence=occurrence
 }
}

type WeaponHitPause = (event: Dnd5eWeaponHitEvent, state: Dnd5eHeadlessCombatState) => boolean
class PendingWeaponHit extends Error {
  readonly event: Dnd5eWeaponHitEvent
  readonly snapshot: Dnd5eHeadlessCombatState
  readonly occurrence: number
  constructor(event: Dnd5eWeaponHitEvent, snapshot: Dnd5eHeadlessCombatState, occurrence: number) {
    super('weapon-hit-decision-required'); this.event = event; this.snapshot = snapshot; this.occurrence = occurrence
  }
}

type MaterialCharacters = Readonly<Record<string, Character>>
type DamagePause = (checkpoint: Dnd5eDamageCommitCheckpoint, state?: Dnd5eHeadlessCombatState, characters?: MaterialCharacters) => boolean
export interface Dnd5eDamageReplayMaterials<Result> {
  charactersByCombatantId: MaterialCharacters
  succeeded: (result: Result) => boolean
}

class PendingDamage extends Error {
  readonly checkpoint: Dnd5eDamageCommitCheckpoint
  readonly snapshot?: Dnd5eHeadlessCombatState
  readonly characters?: MaterialCharacters
  constructor(checkpoint: Dnd5eDamageCommitCheckpoint, snapshot?: Dnd5eHeadlessCombatState, characters?: MaterialCharacters) {
    super('damage-decision-required'); this.checkpoint = checkpoint; this.snapshot = snapshot
    this.characters = characters
  }
}

type ReactionFailure = Extract<Dnd5eDamageReactionResolution, {ok:false}>['reason']
class RejectedReaction extends Error {
  readonly reason: ReactionFailure
  constructor(reason: ReactionFailure) { super(reason); this.reason = reason }
}

export type Dnd5eDamageCommitSessionResult<Result = Dnd5eActionResult> =
  | {status:'pending-zero';checkpoint:Dnd5eZeroHitPointCheckpoint;snapshot:Dnd5eHeadlessCombatState}
  | {status:'pending-zero-start';actorId:string;snapshot:Dnd5eHeadlessCombatState}
  | {status:'pending-critical';event:Dnd5eCriticalHitEvent;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-hit-follow';request:Dnd5eHitFollowRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-hit-push';event:Dnd5eHitPushEvent;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | { status: 'pending-weapon-hit'; event: Dnd5eWeaponHitEvent; snapshot: Dnd5eHeadlessCombatState; occurrence: number }
  | { status: 'pending'; checkpoint: Dnd5eDamageCommitCheckpoint; triggerEventId: string; charactersByCombatantId?: MaterialCharacters }
  | { status: 'resolved'; result: Result; materialChanges?: readonly Dnd5eReactionMaterialChange[] }
  | { status: 'rejected'; reason: 'stale-state' | 'stale-checkpoint' | 'session-ended' | 'changed-activity' | ReactionFailure; details?: readonly string[] }

/** Host replay foundation. Supports personal temporary HP and typed defenses
 * at converted raw-damage entries. Redirection and the room UI are not connected. Keep generic
 * before-damage certification blocked.
 * The caller supplies authoritative dice in the original action and commits a resolved
 * result once; neither a suspended replay nor a decline mutates the supplied state.
 */
export function createDnd5eDamageCommitSession(
  source: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  shouldPause: DamagePause,
  options?: Parameters<typeof resolveDnd5eHeadlessAction>[2],
  materialCharacters?: MaterialCharacters,
  weaponHitPause?: WeaponHitPause,
) {
  const originalAction = cloneDnd5eHostTransactionInput(action)
  const originalOptions = structuredClone(options)
  return createDamageReplaySession(source, state => resolveDnd5eHeadlessAction(state, originalAction, originalOptions), shouldPause,
    undefined, materialCharacters ? { charactersByCombatantId: materialCharacters, succeeded: result => result.ok } : undefined, weaponHitPause)
}

/** Registered imports use the same suspended transaction as ordinary attacks.
 * Freeze the Host command, dice and authority inputs; reject catalog changes
 * while a choice is pending. The room caller must still validate its current
 * revision/inventory context and atomically publish only the final result.
 */
export function createDnd5eActivityDamageCommitSession(
  input: Dnd5eRegisteredActivityCombatAuthorityInputV1,
  shouldPause: (checkpoint: Dnd5eDamageCommitCheckpoint, state?: Dnd5eHeadlessCombatState) => boolean,
) {
  const frozen = cloneDnd5eHostTransactionInput(input)
  const definition = () => JSON.stringify(getRegisteredDnd5eActivity(frozen.command.packageId, frozen.command.activityId))
  const signature = definition()
  return createDamageReplaySession(frozen.state,
    state => resolveRegisteredDnd5eActivityInCombatV1({...frozen,state}), shouldPause,
    () => definition() === signature)
}

export type Dnd5eDamageReplaySession<Result> = ReturnType<typeof createDamageReplaySession<Result>>

/** Prepared facades must remain synchronous inside the checkpoint scope. Their
 * outer UI may await player choices; do not retain a global listener over await. */
export function createDnd5ePreparedDamageCommitSession<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}}, Result>(
  input: Input,
  resolve: (input:Input)=>Result,
  shouldPause: DamagePause,
  materials?: Dnd5eDamageReplayMaterials<Result>,
  weaponHitPause?: WeaponHitPause,
) {
  const frozen=cloneDnd5eHostTransactionInput(input)
  if(!frozen.prepared)throw new Error('damage-reaction-prepared-state-required')
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const catalog=JSON.stringify(listRegisteredDnd5eActivityPackages())
  return createDamageReplaySession(frozen.prepared.state,state=>resolve({...frozen,prepared:{...frozen.prepared,state}}),shouldPause,
    ()=>JSON.stringify(listRegisteredDnd5eActivityPackages())===catalog, materials, weaponHitPause)
}

function createDamageReplaySession<Result>(
  source: Dnd5eHeadlessCombatState,
  resolve: (state: Dnd5eHeadlessCombatState) => Result,
  shouldPause: DamagePause,
  definitionUnchanged: () => boolean = () => true,
  materials?: Dnd5eDamageReplayMaterials<Result>,
  weaponHitPause?: WeaponHitPause,
) {
  const baseline = structuredClone(source)
  const signature = JSON.stringify(baseline)
  const criticalFeatureIds = [...new Set(Object.values(baseline.combatants).flatMap(actor=>actor.pluginFeatureIds))]
  const criticalDefinitions = () => JSON.stringify(criticalFeatureIds.map(id=>[id,dnd5ePluginFeatureDefinition(id)?.declarativeAbility]))
  const criticalDefinitionSignature = criticalDefinitions()
  const criticalDecisions = new Map<number,{event:Dnd5eCriticalHitEvent;selection?:Dnd5eCriticalCancellationSelection}>()
  let pendingCritical:PendingCritical|undefined
  let pendingZero:PendingZero|undefined
  let pendingZeroStart:string|undefined
  const zeroDecisions = new Map<number,{checkpoint:string;featureId?:string}>()
  const zeroStarts = new Map<string,Extract<Dnd5eAction,{type:'begin-turn'}>>()
  const weaponDecisions = new Map<number, { event: Dnd5eWeaponHitEvent; decision?: Dnd5eWeaponHitDecision }>()
  let pendingWeaponHit: PendingWeaponHit | undefined
  let pendingHitPush:PendingHitPush|undefined
  let pendingHitFollow:PendingHitFollow|undefined
  const followChoices=new Map<number,{request:Dnd5eHitFollowRequest;choice:Dnd5eHitFollowChoice}>()
  const pushReceipts=new Map<number,{event:Dnd5eHitPushEvent;receipts:Dnd5eHitPushReceipts}>()
  const materialBaseline = materials ? structuredClone(materials.charactersByCombatantId) : undefined
  const eventBatchId = `damage-session:${globalThis.crypto.randomUUID()}`
  const declined = new Set<number>()
  const accepted = new Map<number, { selection: Dnd5eDamageReactionSelection; definitionSignature: string; checkpoint: Dnd5eDamageCommitCheckpoint }>()
  let pending: Dnd5eDamageCommitCheckpoint | undefined
  let pendingSnapshot: Dnd5eHeadlessCombatState | undefined
  let pendingCharacters: MaterialCharacters | undefined
  let ended = false
  const run = (current: Dnd5eHeadlessCombatState): Dnd5eDamageCommitSessionResult<Result> => {
    if (ended) return { status: 'rejected', reason: 'session-ended' }
    if (!definitionUnchanged()) { ended = true; return {status:'rejected',reason:'changed-activity'} }
    if (criticalDefinitions() !== criticalDefinitionSignature) { ended=true;return {status:'rejected',reason:'changed-activity'} }
    if (JSON.stringify(current) !== signature) {
      ended = true
      return { status: 'rejected', reason: 'stale-state' }
    }
    const ledger = materialBaseline ? createDnd5eDamageReactionMaterialLedger(materialBaseline) : undefined
    try {
      let weaponOccurrence = 0,pushOccurrence=0,followOccurrence=0,criticalOccurrence=0
      const result=withDnd5eZeroHitPointCheckpoints((checkpoint,snapshot)=>{
        if (!dnd5eZeroHitPointTurnOptions(snapshot,checkpoint).length) return
        const prior=zeroDecisions.get(checkpoint.occurrence)
        if (!prior) throw new PendingZero(checkpoint,snapshot)
        if(prior.checkpoint!==JSON.stringify(checkpoint))throw new RejectedReaction('changed-reaction')
        return prior.featureId ? {featureId:prior.featureId,transactionId:eventBatchId} : undefined
      },()=>withDnd5eCriticalCancellationCheckpoints((event,snapshot)=>{
        const occurrence=criticalOccurrence++,prior=criticalDecisions.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.event)!==JSON.stringify(event))throw new RejectedReaction('changed-reaction')
          return prior.selection&&structuredClone(prior.selection)
        }
        if(dnd5eCriticalCancellationOptions(snapshot,event).length)throw new PendingCritical(event,snapshot,occurrence)
      },()=>withDnd5eHitFollowCheckpoints((request,snapshot)=>{
        const occurrence=followOccurrence++,prior=followChoices.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction')
          return structuredClone(prior.choice)
        }
        throw new PendingHitFollow(request,snapshot,occurrence)
      },()=>withDnd5eHitPushCheckpoints((event,snapshot)=>{
        const occurrence=pushOccurrence++,prior=pushReceipts.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.event)!==JSON.stringify(event))throw new RejectedReaction('changed-reaction')
          return structuredClone(prior.receipts)
        }
        throw new PendingHitPush(event,snapshot,occurrence)
      },()=>withDnd5eWeaponHitCheckpoints((event, snapshot) => {
        const occurrence = weaponOccurrence++, prior = weaponDecisions.get(occurrence)
        if (prior) {
          if (JSON.stringify(prior.event) !== JSON.stringify(event)) throw new RejectedReaction('changed-reaction')
          return prior.decision && structuredClone(prior.decision)
        }
        if (weaponHitPause?.(structuredClone(event), structuredClone(snapshot))) throw new PendingWeaponHit(event, snapshot, occurrence)
      }, () => withDnd5eDamageCommitCheckpoints((checkpoint, snapshot) => {
        const decision = accepted.get(checkpoint.occurrence)
        if (decision) {
          if (!snapshot || JSON.stringify(checkpoint) !== JSON.stringify(decision.checkpoint)) throw new RejectedReaction('changed-reaction')
          const resolution = resolveDnd5eDamageCheckpointReaction({
            state:snapshot, checkpoint, selection:decision.selection, eventBatchId,
            expectedDefinitionSignature:decision.definitionSignature,
            materialLedger: ledger,
          })
          if (!resolution.ok) throw new RejectedReaction(resolution.reason)
          return resolution.reaction
        }
        // Retain a separate copy: the discovery callback is allowed to inspect
        // or mutate its copy, never the authority used for a later selection.
        const authoritySnapshot = snapshot ? structuredClone(snapshot) : undefined
        const characters = ledger?.characters()
        if (!declined.has(checkpoint.occurrence) && shouldPause(structuredClone(checkpoint), snapshot, structuredClone(characters))) throw new PendingDamage(checkpoint, authoritySnapshot, characters)
      }, () => resolve(baseline)))))),settled=>{
        let completed=settled
        for(const actor of Object.values(settled.state.combatants)){
          if(actor.classState.zeroHitPointExtraTurn?.phase!=='pending')continue
          const begun=beginDnd5eAcceptedZeroHitPointTurn(completed.state,zeroStarts.get(actor.id)??{type:'begin-turn',actorId:actor.id})
          if(!begun)throw new RejectedReaction('changed-reaction')
          if(!begun.ok)throw new PendingZeroStart(actor.id,begun.state)
          completed={...begun,events:[...completed.events,...begun.events]}
        }
        return completed
      })
      ended = true
      pending = undefined
      pendingSnapshot = undefined
      return { status: 'resolved', result, ...(ledger ? { materialChanges: materials!.succeeded(result) ? ledger.finish() : [] } : {}) }
    } catch (error) {
      if(error instanceof PendingZero){pendingZero=error;return {status:'pending-zero',checkpoint:structuredClone(error.checkpoint),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingZeroStart){pendingZeroStart=error.actorId;return {status:'pending-zero-start',actorId:error.actorId,snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingCritical){
        pendingCritical=error
        return {status:'pending-critical',event:structuredClone(error.event),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}
      }
      if(error instanceof PendingHitFollow){
        pendingHitFollow=error
        return {status:'pending-hit-follow',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}
      }
      if(error instanceof PendingHitPush){
        pendingHitPush=error
        return {status:'pending-hit-push',event:structuredClone(error.event),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}
      }
      if (error instanceof PendingWeaponHit) {
        pendingWeaponHit = error
        return { status: 'pending-weapon-hit', event: structuredClone(error.event), snapshot: structuredClone(error.snapshot), occurrence: error.occurrence }
      }
      if (error instanceof RejectedReaction) { ended = true; return {status:'rejected',reason:error.reason} }
      if (!(error instanceof PendingDamage)) { ended = true; throw error }
      pending = structuredClone(error.checkpoint)
      pendingSnapshot = error.snapshot
      pendingCharacters = error.characters
      return { status: 'pending', checkpoint: structuredClone(pending),
        ...(pendingCharacters ? { charactersByCombatantId: structuredClone(pendingCharacters) } : {}),
        triggerEventId: `activity-event:${baseline.combatId}:${eventBatchId}:${pending.occurrence}:before-damage` }
    } finally { ledger?.cancel() }
  }
  return {
    run,
    resumeZero(current:Dnd5eHeadlessCombatState,occurrence:number,featureId?:string):Dnd5eDamageCommitSessionResult<Result>{
      if(!pendingZero||pendingZero.checkpoint.occurrence!==occurrence)return {status:'rejected',reason:'stale-checkpoint'}
      if(featureId&&!dnd5eZeroHitPointTurnOptions(pendingZero.snapshot,pendingZero.checkpoint).some(option=>option.featureId===featureId))return {status:'rejected',reason:'unsupported-reaction'}
      zeroDecisions.set(occurrence,{checkpoint:JSON.stringify(pendingZero.checkpoint),featureId})
      pendingZero=undefined
      return run(current)
    },
    resumeZeroStart(current:Dnd5eHeadlessCombatState,action:Extract<Dnd5eAction,{type:'begin-turn'}>):Dnd5eDamageCommitSessionResult<Result>{
      if(pendingZeroStart!==action.actorId)return {status:'rejected',reason:'stale-checkpoint'}
      zeroStarts.set(action.actorId,structuredClone(action));pendingZeroStart=undefined
      return run(current)
    },
    resumeCritical(current:Dnd5eHeadlessCombatState,occurrence:number,event:Dnd5eCriticalHitEvent,selection?:Dnd5eCriticalCancellationSelection):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingCritical||occurrence!==pendingCritical.occurrence||JSON.stringify(event)!==JSON.stringify(pendingCritical.event))return {status:'rejected',reason:'stale-checkpoint'}
      if(selection&&!resolveDnd5eCriticalCancellation(pendingCritical.snapshot,pendingCritical.event,selection).ok)return {status:'rejected',reason:'unsupported-reaction'}
      criticalDecisions.set(occurrence,{event:structuredClone(event),...(selection?{selection:structuredClone(selection)}:{})})
      pendingCritical=undefined
      return run(current)
    },
    resumeHitFollow(current:Dnd5eHeadlessCombatState,occurrence:number,request:Dnd5eHitFollowRequest,choice:Dnd5eHitFollowChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingHitFollow||pendingHitFollow.occurrence!==occurrence||JSON.stringify(request)!==JSON.stringify(pendingHitFollow.request))return {status:'rejected',reason:'stale-checkpoint'}
      followChoices.set(occurrence,{request:structuredClone(request),choice:structuredClone(choice)})
      pendingHitFollow=undefined
      return run(current)
    },
    resumeHitPush(current:Dnd5eHeadlessCombatState,occurrence:number,event:Dnd5eHitPushEvent,receipts:Dnd5eHitPushReceipts):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingHitPush||pendingHitPush.occurrence!==occurrence||JSON.stringify(event)!==JSON.stringify(pendingHitPush.event))return {status:'rejected',reason:'stale-checkpoint'}
      pushReceipts.set(occurrence,{event:structuredClone(event),receipts:structuredClone(receipts)})
      pendingHitPush=undefined
      return run(current)
    },
    resumeWeaponHit(current: Dnd5eHeadlessCombatState, occurrence: number, event: Dnd5eWeaponHitEvent,
      decision?: Dnd5eWeaponHitDecision): Dnd5eDamageCommitSessionResult<Result> {
      if (ended) return { status: 'rejected', reason: 'session-ended' }
      if (!pendingWeaponHit || pendingWeaponHit.occurrence !== occurrence || JSON.stringify(event) !== JSON.stringify(pendingWeaponHit.event))
        return { status: 'rejected', reason: 'stale-checkpoint' }
      weaponDecisions.set(occurrence, { event: structuredClone(event), ...(decision ? { decision: structuredClone(decision) } : {}) })
      pendingWeaponHit = undefined
      return run(current)
    },
    accept(current: Dnd5eHeadlessCombatState, checkpoint: Dnd5eDamageCommitCheckpoint, selection: Dnd5eDamageReactionSelection): Dnd5eDamageCommitSessionResult<Result> {
      if (ended) return {status:'rejected',reason:'session-ended'}
      if (!pending || JSON.stringify(checkpoint) !== JSON.stringify(pending)) return {status:'rejected',reason:'stale-checkpoint'}
      if (JSON.stringify(current) !== signature) { ended = true; return {status:'rejected',reason:'stale-state'} }
      if (!pendingSnapshot) return {status:'rejected',reason:'unsupported-reaction'}
      const frozenSelection = structuredClone(selection)
      const previewLedger = pendingCharacters ? createDnd5eDamageReactionMaterialLedger(pendingCharacters) : undefined
      let resolution: Dnd5eDamageReactionResolution
      try { resolution = resolveDnd5eDamageCheckpointReaction({state:pendingSnapshot,checkpoint:pending,selection:frozenSelection,eventBatchId,materialLedger:previewLedger}) }
      finally { previewLedger?.cancel() }
      if (!resolution.ok) return {status:'rejected',reason:resolution.reason,details:resolution.details}
      accepted.set(pending.occurrence,{selection:frozenSelection,definitionSignature:resolution.definitionSignature,checkpoint:structuredClone(pending)})
      pending = undefined
      pendingSnapshot = undefined
      return run(current)
    },
    decline(current: Dnd5eHeadlessCombatState, checkpoint: Dnd5eDamageCommitCheckpoint): Dnd5eDamageCommitSessionResult<Result> {
      if (ended) return { status: 'rejected', reason: 'session-ended' }
      if (!pending || JSON.stringify(checkpoint) !== JSON.stringify(pending)) return { status: 'rejected', reason: 'stale-checkpoint' }
      declined.add(pending.occurrence)
      pending = undefined
      pendingSnapshot = undefined
      return run(current)
    },
    cancel() { ended = true; pendingCritical=undefined;criticalDecisions.clear(); pending = undefined; pendingSnapshot = undefined; pendingWeaponHit = undefined; pendingHitPush=undefined;pushReceipts.clear();pendingHitFollow=undefined;followChoices.clear(); pendingCharacters = undefined; accepted.clear(); weaponDecisions.clear() },
  }
}
