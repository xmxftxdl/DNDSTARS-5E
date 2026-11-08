import{resolvePreparedDnd5eDeathSavingTurn}from'./deathSaveTurnAction'
import{createDnd5eAllyOriginalCollectionSession,actualDnd5eOriginalAllyBoundaryMatches,readDnd5eActualOriginalAllyBoundary}from'./damageCommitSession'
import{originalD20ReplaySourceKey,validateOriginalD20ReplayFacts,type OriginalD20ReplayFacts,type AllyNaturalOneDecision}from'./allyNaturalOneCheckpoint'
import{cloneDnd5eHostTransactionInput}from'./hostTransactionClone'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{dnd5eHeadlessTurnKey}from'./headlessCombatEngine'
import{dnd5eDeathSaveTurnAvailable}from'./deathSaveTurn'
import type{Dnd5eActiveEffectSavingThrowRoll}from'./activeEffects'
import{withDeathRepeatSavingOriginals,readDeathRepeatSavingOriginalMissing,type Dnd5eDeathRepeatSavingFrame}from'./deathRepeatSavingOriginalCheckpoint'
type Source=Parameters<typeof resolvePreparedDnd5eDeathSavingTurn>[0]
type Runtime=Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts}
type Native=ReturnType<typeof createDnd5eAllyOriginalCollectionSession<Runtime,ReturnType<typeof resolvePreparedDnd5eDeathSavingTurn>>>
type Stage=ReturnType<Native['run']>
type Pending=Extract<Stage,{status:'pending-ally-natural-one'}>
declare const deathRepeatSavingOperation:unique symbol
export type Dnd5eDeathRepeatSavingOriginalOperation={readonly[deathRepeatSavingOperation]:true}
type Missing={status:'missing-death-repeat-saving-original';operation:Dnd5eDeathRepeatSavingOriginalOperation}
const issued=new WeakMap<object,{read:()=>{originalSource:Source;input:Runtime;effectTimestamp:number;frame:Dnd5eDeathRepeatSavingFrame}}>()
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
/** Read-only actual Native provenance. This grants no Room actor, physical die, qualification, result or world publication. */
export function readDnd5eDeathRepeatSavingOriginal(operation:object){const row=issued.get(operation);if(!row)throw Error('death-repeat-original:actual-private-operation-required');return row.read()}
export function createDnd5eDeathRepeatSavingOriginalSession(input:Runtime){
 const p=input.prepared,a=p.state.combatants[p.actorToken.id],command=input.command
 if(p.action.type!=='dnd5e-death-save'||p.action.actorTokenId!==p.actorToken.id||p.action.characterId!==p.actor?.id||command.type!=='death-save-turn'||command.actorId!==p.actorToken.id||command.deferNextTurnStart!==true||p.state.initiativeOrder[p.state.initiativeIndex]!==a?.id||a.currentHp!==0||a.deathSaves.dead||a.deathSaves.stable||!dnd5eDeathSaveTurnAvailable(a.classState.deathSaveTurn,dnd5eHeadlessTurnKey(p.state,a.id)))throw Error('death-repeat-original:actual-death-parent-required')
 if(command.activeEffectSavingThrows?.length||command.activeEffectPeriodicDamageRolls?.length||command.activeEffectRandomConditionRolls?.length)throw Error('death-repeat-original:unissued-tail-input')
 const originalSignature=signature(input),original=cloneDnd5eHostTransactionInput(input),validated=validateOriginalD20ReplayFacts(original.hostOriginalD20Replay,p.action.id,p.state,p.action)
 if(validated&&validated.effectTimestamp===undefined&&validated.facts.length)throw Error('death-repeat-original:fixed-native-clock-required')
 const effectTimestamp=validated?.effectTimestamp??Date.now(),metadata:OriginalD20ReplayFacts=validated?.effectTimestamp!==undefined?validated:{...validated,parentId:p.action.id,sourceKey:originalD20ReplaySourceKey(p.action.id,p.state,p.action,effectTimestamp),effectTimestamp,facts:validated?.facts??[]}
 const supplied:Dnd5eActiveEffectSavingThrowRoll[]=[],decisions:{occurrence:number;request:string;choice:AllyNaturalOneDecision|undefined}[]=[],pendingPools=new WeakMap<object,Dnd5eDeathRepeatSavingFrame>()
 let native:Native|undefined,current:Stage|Missing|undefined,currentOperation:object|undefined,currentRuntime:Runtime|undefined,disposed=false,finished=false
 const unchanged=()=>{if(disposed)throw Error('death-repeat-original:session-ended');if(signature(input)!==originalSignature)throw Error('death-repeat-original:changed-live-source')}
 function observe(run:()=>Stage):Stage|Missing{
  unchanged();currentOperation=undefined
  try{const observed=withDeathRepeatSavingOriginals(p.actorToken.id,run),stage=observed.result;if(stage.status==='pending-ally-natural-one'&&observed.interrupted){const pool=observed.interrupted;if(!actualDnd5eOriginalAllyBoundaryMatches(stage,resolvePreparedDnd5eDeathSavingTurn,pool.error)||stage.request.kind!=='saving-throw'||stage.request.actorId!==pool.frame.actorId||JSON.stringify(stage.request.originalRolls)!==JSON.stringify(pool.values))throw Error('death-repeat-original:changed-native-saving-pool');pendingPools.set(stage,pool.frame)}current=stage;if(stage.status==='resolved'||stage.status==='rejected')finished=true;return stage}
  catch(error){const frame=readDeathRepeatSavingOriginalMissing(error);if(!frame)throw error;const operation=Object.freeze({})as Dnd5eDeathRepeatSavingOriginalOperation;currentOperation=operation;current={status:'missing-death-repeat-saving-original',operation};issued.set(operation,{read:()=>{unchanged();if(currentOperation!==operation||current?.status!=='missing-death-repeat-saving-original'||current.operation!==operation||!currentRuntime)throw Error('death-repeat-original:actual-current-operation-required');return{originalSource:cloneDnd5eHostTransactionInput(original),input:cloneDnd5eHostTransactionInput(currentRuntime),effectTimestamp,frame:cloneDnd5eHostTransactionInput(frame)}}});return current}
 }
 function replay(){unchanged();native?.cancel();currentRuntime={...cloneDnd5eHostTransactionInput(original),command:{...cloneDnd5eHostTransactionInput(original.command),...(supplied.length?{activeEffectSavingThrows:cloneDnd5eHostTransactionInput(supplied)}:{})},hostOriginalD20Replay:cloneDnd5eHostTransactionInput(metadata)};native=createDnd5eAllyOriginalCollectionSession(currentRuntime,resolvePreparedDnd5eDeathSavingTurn);finished=false;let stage=observe(()=>native!.run(original.prepared.state));for(const row of decisions){if(stage.status!=='pending-ally-natural-one'||stage.occurrence!==row.occurrence||JSON.stringify(stage.request)!==row.request)throw Error('death-repeat-original:changed-native-prefix');const pending=stage;stage=observe(()=>native!.resumeAllyNaturalOne(original.prepared.state,pending.occurrence,pending.request,row.choice))}return stage}
 return{
  run(){unchanged();if(finished)throw Error('death-repeat-original:session-finished');return current??replay()},
  resume(stage:Pending,choice:AllyNaturalOneDecision|undefined){unchanged();if(finished||current!==stage||!native)throw Error('death-repeat-original:actual-current-pending-required');if(readDnd5eActualOriginalAllyBoundary(stage).resolve!==resolvePreparedDnd5eDeathSavingTurn)throw Error('death-repeat-original:actual-native-resolver-required');decisions.push({occurrence:stage.occurrence,request:JSON.stringify(stage.request),choice:cloneDnd5eHostTransactionInput(choice)});return observe(()=>native!.resumeAllyNaturalOne(original.prepared.state,stage.occurrence,stage.request,choice))},
  repeatPool(stage:Pending){unchanged();if(current!==stage||!pendingPools.has(stage))throw Error('death-repeat-original:actual-current-repeat-pool-required');if(readDnd5eActualOriginalAllyBoundary(stage).resolve!==resolvePreparedDnd5eDeathSavingTurn)throw Error('death-repeat-original:actual-native-resolver-required');return cloneDnd5eHostTransactionInput(pendingPools.get(stage)!)},
  supply(operation:Dnd5eDeathRepeatSavingOriginalOperation,roll:Omit<Dnd5eActiveEffectSavingThrowRoll,'effectId'|'targetId'>){unchanged();const actual=readDnd5eDeathRepeatSavingOriginal(operation);if(currentOperation!==operation)throw Error('death-repeat-original:foreign-operation');const allowed=new Set(['spellDamageDieRerolls','disadvantageNegation','disadvantageNegationChoice','d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','damageRolls','blessRoll','baneRoll','rerollResourceKey','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll']);if(!roll||Object.getPrototypeOf(roll)!==Object.prototype||Reflect.ownKeys(roll).some(k=>typeof k!=='string'||!allowed.has(k))||Object.values(Object.getOwnPropertyDescriptors(roll)).some(d=>!('value'in d))||!Number.isInteger(roll.d20)||roll.d20<1||roll.d20>20||actual.frame.count===1&&roll.d20Second!==undefined||actual.frame.count===2&&(!Number.isInteger(roll.d20Second)||roll.d20Second!<1||roll.d20Second!>20))throw Error('death-repeat-original:exact-native-pool-required');if(supplied.some(row=>row.effectId===actual.frame.effect.id))throw Error('death-repeat-original:duplicate-saving-pool');supplied.push({...cloneDnd5eHostTransactionInput(roll),effectId:actual.frame.effect.id,targetId:actual.frame.actorId});return replay()},
  dispose(){if(disposed)return;disposed=true;currentOperation=undefined;native?.cancel()}
 }
}
