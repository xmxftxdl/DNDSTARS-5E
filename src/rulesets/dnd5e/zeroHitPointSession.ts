import { resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { cloneDnd5eHostTransactionInput } from './hostTransactionClone'
import { withDnd5eZeroHitPointCheckpoints, type Dnd5eZeroHitPointCheckpoint } from './zeroHitPointCheckpoint'
import { dnd5eZeroHitPointTurnOptions } from './zeroHitPointReaction'
import { beginDnd5eAcceptedZeroHitPointTurn } from './zeroHitPointTurn'
import { dnd5ePluginFeatureDefinition } from './pluginApi'

type Begin = Extract<Dnd5eAction, {type:'begin-turn'}>
type Options = ReturnType<typeof dnd5eZeroHitPointTurnOptions>
class Pending extends Error {
  readonly checkpoint:Dnd5eZeroHitPointCheckpoint
  readonly options:Options
  constructor(checkpoint:Dnd5eZeroHitPointCheckpoint, options:Options) { super('zero-hp-choice-required');this.checkpoint=checkpoint;this.options=options }
}
export type Dnd5eZeroHitPointSessionResult =
  | {status:'pending'; checkpoint:Dnd5eZeroHitPointCheckpoint; options:Options}
  | {status:'pending-start'; actorId:string}
  | {status:'resolved'; result:Dnd5eActionResult}
  | {status:'rejected'; reason:string}

/** Host-owned, one-use transaction. The caller publishes only a resolved result.
 * No async listener is retained while waiting for player or lifecycle input. */
export function createDnd5eZeroHitPointSession(source:Dnd5eHeadlessCombatState, action:Dnd5eAction, transactionId:string) {
  const baseline = structuredClone(source)
  const frozenAction = cloneDnd5eHostTransactionInput(action)
  const signature = JSON.stringify(baseline)
  const featureIds = [...new Set(Object.values(source.combatants).flatMap(actor => actor.pluginFeatureIds))]
  const definitions = () => JSON.stringify(featureIds.map(id => [id,dnd5ePluginFeatureDefinition(id)]))
  const catalog = definitions()
  const choices = new Map<number,{checkpoint:string;featureId?:string}>()
  const starts = new Map<string,Begin>()
  let pending: Pending | undefined
  let pendingStart: string | undefined
  let ended = false
  const valid = (current:Dnd5eHeadlessCombatState) => !ended && transactionId.trim() &&
    signature === JSON.stringify(current) && catalog === definitions()
  function replay(current:Dnd5eHeadlessCombatState):Dnd5eZeroHitPointSessionResult {
    if (!valid(current)) return {status:'rejected',reason:ended?'session-ended':'stale-state-or-definition'}
    pending = undefined
    pendingStart = undefined
    try {
      const accepted:string[] = []
      let result = withDnd5eZeroHitPointCheckpoints((checkpoint,state) => {
        const options = dnd5eZeroHitPointTurnOptions(state,checkpoint)
        if (!options.length) return
        const chosen = choices.get(checkpoint.occurrence)
        if (!chosen) throw new Pending(checkpoint,options)
        if (chosen.checkpoint !== JSON.stringify(checkpoint)) throw new Error('stale-checkpoint')
        if (!chosen.featureId) return
        if (!options.some(option => option.featureId === chosen.featureId)) throw new Error('ineligible-selection')
        accepted.push(checkpoint.targetId)
        return {featureId:chosen.featureId,transactionId}
      }, () => resolveDnd5eHeadlessAction(structuredClone(baseline),frozenAction))
      if (!result.ok) return {status:'rejected',reason:result.reason}
      for (const actorId of accepted) {
        const begun = beginDnd5eAcceptedZeroHitPointTurn(result.state,starts.get(actorId) ?? {type:'begin-turn',actorId})
        if (!begun) return {status:'rejected',reason:'invalid-interruption-order'}
        if (!begun.ok) {
          pendingStart = actorId
          return {status:'pending-start',actorId}
        }
        result = {...begun,events:[...result.events,...begun.events]}
      }
      ended = true
      return {status:'resolved',result}
    } catch (error) {
      if (error instanceof Pending) {
        pending = error
        return {status:'pending',checkpoint:structuredClone(error.checkpoint),options:structuredClone(error.options)}
      }
      return {status:'rejected',reason:error instanceof Error ? error.message : 'replay-failed'}
    }
  }
  return {
    run: replay,
    choose(current:Dnd5eHeadlessCombatState, occurrence:number, featureId?:string):Dnd5eZeroHitPointSessionResult {
      if (!valid(current)) return {status:'rejected',reason:ended?'session-ended':'stale-state-or-definition'}
      if (!pending || pending.checkpoint.occurrence !== occurrence ||
        featureId !== undefined && !pending.options.some(option => option.featureId === featureId)) return {status:'rejected',reason:'invalid-selection'}
      choices.set(occurrence,{checkpoint:JSON.stringify(pending.checkpoint),featureId})
      return replay(current)
    },
    supplyStart(current:Dnd5eHeadlessCombatState, start:Begin):Dnd5eZeroHitPointSessionResult {
      if (!valid(current)) return {status:'rejected',reason:ended?'session-ended':'stale-state-or-definition'}
      if (pendingStart !== start.actorId) return {status:'rejected',reason:'invalid-start-actor'}
      starts.set(start.actorId,structuredClone(start))
      return replay(current)
    },
  }
}
