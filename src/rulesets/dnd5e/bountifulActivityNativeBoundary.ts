import{resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction';
import{dnd5ePluginHeadlessActionDefinition}from'./pluginApi';
import{getRegisteredDnd5eActivity}from'./activities/dnd5eActivityRegistry';
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone';
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
type Source=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0];
type State=Source['prepared']['state'];
type WorkerRecord={source:Source;signature:string;definitionSignature:string;ended:boolean};
const workers=new WeakMap<object,WorkerRecord>(),signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v));
const definition=(source:Source)=>JSON.stringify(getRegisteredDnd5eActivity(source.prepared.headlessAction.pluginId,source.prepared.headlessAction.actionId));
/** A mechanical boundary only. The real async facade creates its fixed worker
 * and retains the original outer application/material/inventory tail. */
export function captureBountifulActivityNativeBoundary(original:Source){
 const action=original.prepared.headlessAction;if(dnd5ePluginHeadlessActionDefinition(action.pluginId,action.actionId)?.execution!=='trusted'||original.inventoryExchangeAuthority||original.restAuthority||original.prepared.attackActionTeleport||original.prepared.attackTeleportPrelude)throw Error('activity-native-boundary:unsupported-async-prelude');
 const source=cloneDnd5eHostTransactionInput({...original,resolveDamageBoundary:undefined,resolveMaterialDamageBoundary:undefined}),sourceSignature=signature(source),definitionSignature=definition(source),cancelled=Error('activity-native-boundary:probe-cancelled');
 let captured:{state:State;resolve:(state:State)=>unknown;succeeded:(value:unknown)=>boolean}|undefined,accept:((value:unknown,changes:readonly import('./damageReactionMaterialLedger').Dnd5eReactionMaterialChange[])=>void)|undefined,cancel:(()=>void)|undefined,ended=false;
 const boundary:NonNullable<Source['resolveMaterialDamageBoundary']>=async<Value>(state:State,resolve:(state:State)=>Value,succeeded:(result:Value)=>boolean)=>{
  if(captured)throw Error('activity-native-boundary:multiple-workers');captured={state,resolve,succeeded:value=>succeeded(value as Value)};
  return await new Promise<{result:Value;materialChanges:readonly import('./damageReactionMaterialLedger').Dnd5eReactionMaterialChange[]}>((yes,no)=>{accept=(value,changes)=>yes({result:value as Value,materialChanges:changes});cancel=()=>no(cancelled)});
 };
 const completion=resolvePreparedDnd5ePluginFeatureAction({...source,resolveMaterialDamageBoundary:boundary});void completion.catch(()=>undefined);if(!captured||!accept||!cancel)throw Error('activity-native-boundary:actual-synchronous-worker-required');
 const actual=captured,finish=accept,reject=cancel,record:WorkerRecord={source,signature:sourceSignature,definitionSignature,ended:false};
 const resolvePrepared=(input:Source)=>{if(ended||signature(input.prepared.state)!==signature(source.prepared.state)||signature(source)!==sourceSignature||definition(source)!==definitionSignature)throw Error('activity-native-boundary:changed-native-source');return actual.resolve(input.prepared.state)};
 workers.set(resolvePrepared,record);
 return{...actual,resolvePrepared,complete:async(value:unknown,changes:readonly import('./damageReactionMaterialLedger').Dnd5eReactionMaterialChange[]=[])=>{if(ended)throw Error('activity-native-boundary:ended');ended=true;record.ended=true;finish(value,changes);return await completion},abort:async()=>{if(ended)return;ended=true;record.ended=true;reject();try{await completion}catch(error){if(error!==cancelled)throw error}}};
}
/** Read-only provenance of the actual facade-created worker, never a registry
 * that accepts a caller function or a submitted outcome. */
export function readBountifulActivityNativeWorker(worker:unknown){if(typeof worker!=='function')throw Error('activity-native-boundary:actual-worker-required');const row=workers.get(worker);if(!row||row.ended||signature(row.source)!==row.signature||definition(row.source)!==row.definitionSignature)throw Error('activity-native-boundary:actual-worker-required');return{source:cloneDnd5eHostTransactionInput(row.source),definitionSignature:row.definitionSignature}}
