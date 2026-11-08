import{withActivityAbilityOriginalMissing}from'./activities/activityAbilityOriginalMissing';
import{captureBountifulActivityNativeBoundary}from'./bountifulActivityNativeBoundary';
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone';
import{originalD20ReplaySourceKey,validateOriginalD20ReplayFacts,type OriginalD20ReplayFacts}from'./allyNaturalOneCheckpoint';
import{readBountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification';
import type{resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0];
type Probe=Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts};
declare const activityNativePort:unique symbol;export type BountifulActivityOriginalNativePort={readonly[activityNativePort]:true};
type Row={source:Source;qualification:object;boundary:ReturnType<typeof captureBountifulActivityNativeBoundary>;ended:boolean;clock:number};const issued=new WeakMap<object,Row>();let active:Row|undefined;
const signature=(source:Source)=>JSON.stringify(encodeSecondChanceParentWire(source));
/** Fixed synchronous mechanical worker of the genuine async facade. The real
 * outer facade still owns inventory/application/material completion. */
export function resolveBountifulPreparedActivityOriginal(input:Probe){const row=active;if(!row||row.ended)throw Error('activity-native-port:actual-qualified-scope-required');readBountifulActivityOriginalQualification(row.qualification,row.source);const{hostOriginalD20Replay,...plain}=input;
 // Reproduce the real Session's private preparedReplayState transformation:
 // its independently cloned baseline replaces only prepared.state. Keep exact
 // graph comparison, including every remaining alias and source field.
 const expected=cloneDnd5eHostTransactionInput(row.source);expected.prepared.state=structuredClone(row.source.prepared.state);
 if(signature(plain)!==signature(expected))throw Error('activity-native-port:changed-prepared-source');const replay=validateOriginalD20ReplayFacts(hostOriginalD20Replay,row.source.prepared.action.id,row.source.prepared.state,row.source.prepared.action);if(!replay||replay.effectTimestamp!==row.clock||replay.facts.length||replay.readyFrames?.length||replay.deferredD20Choices?.length||replay.afterOriginalFalls?.length||replay.equipmentD20)throw Error('activity-native-port:exact-initial-original-clock-required');return withActivityAbilityOriginalMissing(()=>row.boundary.resolvePrepared(input))}
export function createBountifulActivityOriginalNativePort(source:Source,qualification:object){const facts=readBountifulActivityOriginalQualification(qualification,source),plain=cloneDnd5eHostTransactionInput(facts.source),port=Object.freeze({})as BountifulActivityOriginalNativePort;issued.set(port,{source:plain,qualification,boundary:captureBountifulActivityNativeBoundary(plain),ended:false,clock:facts.effectTimestamp});return port}
/** Only a genuine private port may enter the short synchronous Native probe.
 * No caller state or outcome is accepted as its return value authority. */
export function withBountifulActivityOriginalNativePort<T>(port:object,source:Source,run:(probe:Probe)=>T):T{const row=issued.get(port);if(!row||row.ended)throw Error('activity-native-port:actual-private-port-required');readBountifulActivityOriginalQualification(row.qualification,source);const prior=active;active=row;try{const probe:Probe={...cloneDnd5eHostTransactionInput(source),hostOriginalD20Replay:{parentId:source.prepared.action.id,sourceKey:originalD20ReplaySourceKey(source.prepared.action.id,source.prepared.state,source.prepared.action,row.clock),effectTimestamp:row.clock,facts:[]}},result=run(probe);if(result&&typeof result==='object'&&'then'in result)throw Error('activity-native-port:synchronous-native-scope-required');return result}finally{active=prior}}
export async function disposeBountifulActivityOriginalNativePort(port:object){const row=issued.get(port);if(!row)throw Error('activity-native-port:actual-private-port-required');if(row.ended)return;row.ended=true;await row.boundary.abort()}
