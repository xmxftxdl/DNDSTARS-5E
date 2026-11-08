import{secondChanceRestAuthority}from'./secondChanceParentScope'
import{resolvePreparedDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureLanding}from'../../rulesets/dnd5e/pluginFeatureAction'
import{dnd5ePluginHeadlessActionDefinition}from'../../rulesets/dnd5e/pluginApi'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import type{Dnd5eHeadlessCombatState}from'../../rulesets/dnd5e/headlessCombatEngine'
import type{Dnd5eReactionMaterialChange}from'../../rulesets/dnd5e/damageReactionMaterialLedger'
type Input=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0]
type Result=Awaited<ReturnType<typeof resolvePreparedDnd5ePluginFeatureAction>>
export interface SecondChancePluginFeatureBoundary{
 state:Dnd5eHeadlessCombatState
 resolve:(state:Dnd5eHeadlessCombatState)=>unknown
 succeeded:(value:unknown)=>boolean
 complete:(value:unknown,materialChanges?:readonly Dnd5eReactionMaterialChange[])=>Promise<Result>
 abort:()=>Promise<void>
}
/** Capture the actual synchronous worker handed by the genuine async facade to
 * its Host boundary. The facade remains suspended until that same worker settles;
 * final application/material handling still belongs to the original facade. */
export function canCaptureSecondChancePluginFeatureBoundary(original:Input):boolean{
 const prepared=original?.prepared,action=prepared?.headlessAction
 if(!action)return false
 if(dnd5ePluginHeadlessActionDefinition(action.pluginId,action.actionId)?.execution!=='trusted'||original.inventoryExchangeAuthority)return false
 if(original.restAuthority)secondChanceRestAuthority(original as unknown as import('./secondChancePreparedParent').SecondChancePreparedInput)
 if(prepared.attackActionTeleport&&!resolvePreparedDnd5ePluginFeatureLanding(original).preparedAfterLanding)return false
 return true
}
export function captureSecondChancePluginFeatureBoundary(original:Input):SecondChancePluginFeatureBoundary{
 // A sandbox or a pre-boundary async transformation requires its own durable
 // protocol. Never start such work merely to see whether a worker appears.
 if(!canCaptureSecondChancePluginFeatureBoundary(original))throw Error('second-chance-parent:unsupported-async-feature-prelude')
 const input=cloneDnd5eHostTransactionInput({...original,resolveDamageBoundary:undefined,resolveMaterialDamageBoundary:undefined}),cancelled=new Error('second-chance-parent:boundary-probe-cancelled')
 let captured:Omit<SecondChancePluginFeatureBoundary,'complete'|'abort'>|undefined,finish:((value:unknown,changes:readonly Dnd5eReactionMaterialChange[])=>void)|undefined,cancel:(()=>void)|undefined,ended=false
 const boundary:NonNullable<Input['resolveMaterialDamageBoundary']>=async<Value>(state:Dnd5eHeadlessCombatState,resolve:(state:Dnd5eHeadlessCombatState)=>Value,succeeded:(value:Value)=>boolean)=>{
  if(captured)throw Error('second-chance-parent:multiple-async-feature-boundaries')
  captured={state,resolve,succeeded:value=>succeeded(value as Value)}
  return await new Promise<{result:Value;materialChanges:readonly Dnd5eReactionMaterialChange[]}>((accept,reject)=>{finish=(value,changes)=>accept({result:value as Value,materialChanges:changes});cancel=()=>reject(cancelled)})
 }
 const completion=resolvePreparedDnd5ePluginFeatureAction({...input,resolveDamageBoundary:undefined,resolveMaterialDamageBoundary:boundary})
 // Register immediately so rejecting a suspended dry probe never leaks an
 // unhandled rejection while the caller inspects the synchronous checkpoint.
 void completion.catch(()=>undefined)
 if(!captured||!finish||!cancel)throw Error('second-chance-parent:async-feature-boundary-unavailable')
 const worker=captured,accept=finish,reject=cancel
 return{...worker,complete:async(value,changes=[])=>{if(ended)throw Error('second-chance-parent:async-feature-boundary-ended');ended=true;accept(value,changes);return await completion},abort:async()=>{if(ended)return;ended=true;reject();try{await completion}catch(error){if(error!==cancelled)throw error}}}
}



