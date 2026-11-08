import{readDnd5eActualOriginalAllyBoundary}from'./damageCommitSession';
import{readActualInterruptedActivityAbilityPool,type ActivityAbilityOriginalPool}from'./activities/activityAbilityOriginalDice';
import{readBountifulActivityNativeWorker}from'./bountifulActivityNativeBoundary';
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone';
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import type{resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction';
type Source=Parameters<typeof resolvePreparedDnd5ePluginFeatureAction>[0];
interface OriginalBook{parentId:string;mapId:string;combatId:string;roomId:string;hostMemberId:string;effectTimestamp:number;source:ReturnType<typeof encodeSecondChanceParentWire>;rows:(Omit<ActivityAbilityOriginalPool,'values'>&{index:number;requestId:string;memberId:string;count:1|2;sides:20;raw?:{memberId:string;values:number[]};confirmed?:{memberId:string;values:number[]}})[]}
declare const activityOriginalQualification:unique symbol;
export type BountifulActivityOriginalQualification={readonly[activityOriginalQualification]:true};
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v)),same=(a:unknown,b:unknown)=>signature(a)===signature(b);
const issued=new WeakMap<object,{stage:object;source:Source;signature:string;effectTimestamp:number;rawIssuer:{mode:'dm';rollId:string;cursor:number};request:ReturnType<typeof readDnd5eActualOriginalAllyBoundary>['request']}>(); 
/** Pure Native qualification: genuine Session stage, actual facade-created
 * worker and write-once interrupted formula pool are all required. The book is
 * input evidence; only its authenticated Node endpoint may authorize minting. */
export function captureDnd5eBountifulActivityOriginalQualification(stage:object,book:OriginalBook){return capture(stage,book,'regular')}
export function captureDnd5eBountifulActivityFirstOwnQualification(stage:object,book:OriginalBook){return capture(stage,book,'first-own')}
export function captureDnd5eBountifulActivityLaterOwnQualification(stage:object,book:OriginalBook){return capture(stage,book,'later-own')}
function capture(stage:object,book:OriginalBook,mode:'regular'|'first-own'|'later-own'){
 const facts=readDnd5eActualOriginalAllyBoundary(stage),worker=readBountifulActivityNativeWorker(facts.resolve),pool=readActualInterruptedActivityAbilityPool(facts.error),input=facts.input as Source&{hostOriginalD20Replay?:unknown},{hostOriginalD20Replay:_clock,...source}=input;void _clock;
 if(!same(source,worker.source)||source.prepared.action.id!==book.parentId||source.prepared.map.id!==book.mapId||source.prepared.state.combatId!==book.combatId||facts.effectTimestamp!==book.effectTimestamp||(mode==='regular'?!!facts.request.nativeLucky:facts.request.nativeLucky!==true||!('occurrence'in stage)||!Number.isSafeInteger(stage.occurrence)||(mode==='first-own'?stage.occurrence!==0:Number(stage.occurrence)<1))||facts.request.kind!=='ability-check')throw Error('activity-qualification:actual-original-book-required');
 const expected=cloneDnd5eHostTransactionInput(decodeSecondChanceParentWire(book.source))as Source;if(!expected?.prepared||expected.prepared.action.id!==book.parentId||'hostOriginalD20Replay'in expected)throw Error('activity-qualification:plain-original-source-required');expected.rolls={...expected.rolls};
 for(const row of book.rows){if(!row.raw||!row.confirmed||row.confirmed.memberId!==book.hostMemberId)throw Error('activity-qualification:confirmed-prefix-required');const prior=expected.rolls[row.rollId];if(prior&&!same(prior.values,row.confirmed.values))throw Error('activity-qualification:changed-adopted-prefix');expected.rolls[row.rollId]=prior??{values:[...row.confirmed.values],modifier:0,total:row.confirmed.values.reduce((a,b)=>a+b,0)}}
 if(!same(expected,source))throw Error('activity-qualification:matching-protected-source-required');
 const row=book.rows.find(r=>r.rollId===pool.rollId);if(!row?.raw||!row.confirmed||facts.request.actorId!==row.actorId||pool.actorId!==row.actorId||pool.activityId!==row.activityId||pool.checkId!==row.checkId||pool.mode!==row.mode||pool.skill!==row.skill||!same(facts.request.originalRolls,row.confirmed.values)||!same(pool.values,row.confirmed.values)||row.confirmed.values[facts.request.dieIndex]!==1)throw Error('activity-qualification:exact-original-raw-required');
 const qualification=Object.freeze({})as BountifulActivityOriginalQualification;issued.set(qualification,{stage,source:cloneDnd5eHostTransactionInput(source),signature:signature(source),effectTimestamp:book.effectTimestamp,rawIssuer:{mode:'dm',rollId:row.requestId,cursor:row.index+1},request:structuredClone(facts.request)});return qualification;
}
export function readBountifulActivityOriginalQualification(qualification:object,source:Source){const row=issued.get(qualification);if(!row)throw Error('activity-qualification:actual-private-qualification-required');const current=readDnd5eActualOriginalAllyBoundary(row.stage);readBountifulActivityNativeWorker(current.resolve);if(row.signature!==signature(source)||row.effectTimestamp!==current.effectTimestamp||!same(row.request,current.request))throw Error('activity-qualification:changed-actual-original-source');return{source:cloneDnd5eHostTransactionInput(row.source),request:structuredClone(row.request),effectTimestamp:row.effectTimestamp,rawIssuer:{...row.rawIssuer}}}

export function readBountifulActivityOriginalOccurrence(qualification:object,source:Source){readBountifulActivityOriginalQualification(qualification,source);const stage=issued.get(qualification)!.stage;if(!('occurrence'in stage)||!Number.isSafeInteger(stage.occurrence))throw Error('activity-qualification:actual-occurrence-required');return Number(stage.occurrence)}
