import { resolvePreparedDnd5ePluginFeatureAction } from '../../rulesets/dnd5e/pluginFeatureAction'
import { dnd5ePluginHeadlessActionDefinition } from '../../rulesets/dnd5e/pluginApi'
import { createDnd5ePreparedDamageCommitSession } from '../../rulesets/dnd5e/damageCommitSession'
import { createDnd5eParentEffectClock } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eIncomingAttackArmorClassOptions } from "../../application/combat/dnd5eCombatRules"
import type { Dnd5eHeadlessCombatState } from "../../application/combat/dnd5eCombatRules"
import type { IncomingAttackArmorClassChoice } from '../../rulesets/dnd5e/incomingAttackArmorClassCheckpoint'
import type { PostD20FeatureUseChoice } from '../../rulesets/dnd5e/postD20FeatureUseCheckpoint'
import { captureSecondChancePreparedOriginal } from './secondChancePreparedParent'
import type { SecondChancePreparedResult } from './secondChancePreparedParent'
type Input=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]
type Final=Awaited<ReturnType<typeof resolvePreparedDnd5ePluginFeatureAction>>
export interface ArcanePluginAttackCheckpoint {readonly arcanePluginAttackCheckpoint:unique symbol}
function capture(input:Input,execution:Readonly<{now:number}>) {
  if(!Number.isSafeInteger(execution.now)||execution.now<=0)throw Error('arcane-plugin:original-host-clock-required')
  const action=input.prepared.headlessAction
  if(dnd5ePluginHeadlessActionDefinition(action.pluginId,action.actionId)?.execution!=='trusted'||input.restAuthority||input.inventoryExchangeAuthority||input.prepared.attackTeleportPrelude||input.prepared.attackActionTeleport||input.resolveDamageBoundary||input.resolveMaterialDamageBoundary)throw Error('arcane-plugin:unsupported-original-prelude')
  const original=captureSecondChancePreparedOriginal(resolvePreparedDnd5ePluginFeatureAction,input)
  if(!original)throw Error('arcane-plugin:actual-original-codec-required')
  let resolveCommit:((state:Dnd5eHeadlessCombatState)=>SecondChancePreparedResult)|undefined
  let accept:((value:SecondChancePreparedResult)=>void)|undefined
  let reject:((reason:Error)=>void)|undefined
  const completion=resolvePreparedDnd5ePluginFeatureAction({...input,resolveMaterialDamageBoundary:async<Value>(_state:Dnd5eHeadlessCombatState,resolve:(state:Dnd5eHeadlessCombatState)=>Value)=>{
    if(resolveCommit)throw Error('arcane-plugin:multiple-original-boundaries')
    // The genuine facade hands over its synchronous commit closure. No
    // listener spans an await and no payload can supply this resolver.
    resolveCommit=resolve as (state:Dnd5eHeadlessCombatState)=>SecondChancePreparedResult
    return await new Promise<{result:Value;materialChanges:readonly []}>((yes,no)=>{accept=value=>yes({result:value as Value,materialChanges:[]});reject=no})
  }},execution)
  void completion.catch(()=>undefined)
  if(!resolveCommit||!accept||!reject)throw Error('arcane-plugin:original-sync-boundary-required')
  const worker=resolveCommit,finish=accept,abort=reject,baseline=input.prepared.state
  const clock=createDnd5eParentEffectClock({parentId:input.prepared.action.id,sourceKey:'arcane-plugin:'+input.prepared.action.id,timestamp:execution.now})
  const session=createDnd5ePreparedDamageCommitSession(input,next=>clock.run(()=>worker(next.prepared.state)),()=>false)
  const pending=session.run(baseline)
  if(pending.status!=='pending-incoming-armor-class'){session.cancel();abort(Error('arcane-plugin:probe-cancelled'));throw Error('arcane-plugin:genuine-incoming-hit-required:'+pending.status)}
  const options=dnd5eIncomingAttackArmorClassOptions(pending.snapshot,pending.facts.event)
  if(!options.length){session.cancel();abort(Error('arcane-plugin:probe-cancelled'));throw Error('arcane-plugin:own-source-required')}
  return {input,original,baseline,session,pending,options,completion,finish,abort,last:undefined as SecondChancePreparedResult|undefined,final:undefined as Promise<Final>|undefined}
}
const frames=new WeakMap<object,ReturnType<typeof capture>>()
function read(frame:ArcanePluginAttackCheckpoint){const value=frames.get(frame);if(!value)throw Error('arcane-plugin:genuine-checkpoint-required');return value}
export function captureArcanePluginAttackCheckpoint(input:Input,execution:Readonly<{now:number}>):ArcanePluginAttackCheckpoint {const value=capture(input,execution),frame=Object.freeze({})as ArcanePluginAttackCheckpoint;frames.set(frame,value);return frame}
export function readArcanePluginAttackCheckpoint(frame:ArcanePluginAttackCheckpoint){const v=read(frame);return structuredClone({original:v.original,baseline:v.baseline,context:{map:v.input.prepared.map,characters:v.input.prepared.characters,characterIdByCombatantId:v.input.prepared.characterIdByCombatantId},facts:v.pending.facts,occurrence:v.pending.occurrence,options:v.options})}
type Status=ReturnType<ReturnType<typeof capture>['session']['run']>
function remember(frame:ArcanePluginAttackCheckpoint,status:Status){if(status.status==='resolved')read(frame).last=status.result;return status}
export function resumeArcanePluginAttackCheckpoint(frame:ArcanePluginAttackCheckpoint,choice?:IncomingAttackArmorClassChoice){const v=read(frame);return remember(frame,v.session.resumeIncomingArmorClass(v.baseline,v.pending.occurrence,v.pending.facts,choice))}
export function resumeArcanePluginAttackShroud(frame:ArcanePluginAttackCheckpoint,pending:Extract<Status,{status:'pending-post-d20-feature-use'}>,choice?:PostD20FeatureUseChoice){const v=read(frame);return remember(frame,v.session.resumePostD20FeatureUse(v.baseline,pending.occurrence,pending.request,choice))}
/** Finish only the actual session result; no caller-supplied result is accepted. */
export function completeArcanePluginAttackCheckpoint(frame:ArcanePluginAttackCheckpoint):Promise<Final>{const v=read(frame);if(!v.last)throw Error('arcane-plugin:original-session-not-resolved');if(!v.final){v.finish(v.last);v.final=v.completion}return v.final}
