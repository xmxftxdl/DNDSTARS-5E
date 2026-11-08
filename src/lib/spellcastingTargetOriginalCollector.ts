import{readDnd5eSpellcastingOriginalOperation,type Dnd5eSpellcastingOriginalOperation}from'../rulesets/dnd5e/spellcastingOriginalOperation'
import{createDnd5eSpellcastingBountifulOriginalBoundary,captureDnd5eSpellcastingBountifulOriginalQualification}from'../rulesets/dnd5e/spellcastingBountifulOriginalBoundary'
import{bountifulPreparedReplayFacts,type BountifulOriginalDieReceipt}from'../rulesets/dnd5e/bountifulLuckReceipt'
import{createDnd5eNextSpellTargetOriginalSession}from'../rulesets/dnd5e/spellTargetOriginalSession'
import{readDnd5eStormCastOriginalOperation,withDnd5eStormCastOriginalReplayScope}from'../rulesets/dnd5e/damageCommitSession'
import{captureDnd5eSpellTargetOriginalOperation}from'../rulesets/dnd5e/spellTargetOriginalOperation'
import{captureSpellTargetOriginalPreparation,type SpellTargetOriginalPreparationLoader}from'../rulesets/dnd5e/spellTargetOriginalPreparation'
import{createSpellTargetOriginalSavingDiceRoute,readSpellTargetOriginalSavingDiceRoute,type SpellTargetOriginalSavingDiceRoute}from'../rulesets/dnd5e/spellTargetOriginalSavingDiceRoute'
import type{SpellcastingOriginalSavingDiceRoute}from'../rulesets/dnd5e/spellcastingOriginalSavingDiceRoute'
import{captureSpellcastingTargetOriginalContinuation,readSpellcastingTargetOriginalContinuation}from'../rulesets/dnd5e/spellcastingTargetOriginalContinuation'
import type{SharedRoomGatewayPort}from'../ports/sharedRoomGateway'

type Rpc=Parameters<typeof createSpellTargetOriginalSavingDiceRoute>[1]
type Roll=(count:number,sides:number,label:string,targetName:string,context:{durableRollRequestId:string;rollerTokenId:string;rollerCharacterId:string;spellTargetOriginalSavingDice:SpellTargetOriginalSavingDiceRoute;skipChoiceReroll:true;rollKind:'saving-throw';d20RollKind:'saving-throw';d20RollMode:'normal'|'advantage'|'disadvantage'})=>Promise<readonly number[]>
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** The previous first-die UI worker is deliberately allowed to be ended. This
 * creates a fresh real Native first boundary, authenticates its saved prefix,
 * then retains only its own live qualification through the later target phase. */
export async function createSpellcastingTargetOriginalCollector(input:{operation:Dnd5eSpellcastingOriginalOperation;casterRoute:SpellcastingOriginalSavingDiceRoute;receipts:readonly BountifulOriginalDieReceipt[];gateway:Pick<SharedRoomGatewayPort,'publishEvent'>;load:SpellTargetOriginalPreparationLoader;rpc:Rpc;rollDice:Roll;authorityUnchanged:()=>boolean}){
 const native=readDnd5eSpellcastingOriginalOperation(input.operation),first=await createDnd5eSpellcastingBountifulOriginalBoundary(input.operation,input.casterRoute)
 let ended=false,target:ReturnType<typeof createDnd5eNextSpellTargetOriginalSession>|undefined
 const cancel=()=>{if(!ended){ended=true;target?.cancel();first.cancel()}},guard=()=>{if(ended||!input.authorityUnchanged())throw Error('caster-target-collector:actual-current-original-required');readDnd5eSpellcastingOriginalOperation(input.operation)}
 try{
  guard();if(first.first.status!=='pending-ally-natural-one')throw Error('caster-target-collector:actual-first-boundary-required')
  const qualification=captureDnd5eSpellcastingBountifulOriginalQualification(first.first),source={...first.source,hostOriginalD20Replay:bountifulPreparedReplayFacts({parentId:first.source.prepared.action.id,source:first.source,receipts:input.receipts})}
  const run=()=>{target=createDnd5eNextSpellTargetOriginalSession(source);return target.run()}
  const stage=native.stormOperation?(()=>{const storm=readDnd5eStormCastOriginalOperation(native.stormOperation!);if(storm.records.length!==1)throw Error('caster-target-collector:exact-heart-prefix-required');return withDnd5eStormCastOriginalReplayScope(native.stormOperation!,storm.records[0].choice,run)})():run()
  if(stage.status!=='missing-spell-target-original')throw Error('caster-target-collector:actual-missing-target-required')
  const operation=await captureDnd5eSpellTargetOriginalOperation(stage,input.operation,input.casterRoute);guard();await captureSpellTargetOriginalPreparation(operation,input.gateway,input.load);guard()
  const handle=await createSpellTargetOriginalSavingDiceRoute(operation,input.rpc),spec=await readSpellTargetOriginalSavingDiceRoute(handle.route);let collection:Promise<[number,number|undefined]>|undefined
  return{previewState:structuredClone(stage.snapshot),operation,route:handle.route,parentId:spec.parentId,targetId:spec.rollerTokenId,characterId:spec.characterId,mode:stage.requirement.rollMode,
   async rollOriginal(label:string,targetName:string,mode:'normal'|'advantage'|'disadvantage'){
    guard();if(mode!==stage.requirement.rollMode)throw Error('caster-target-collector:exact-target-mode-required')
    if(!collection)collection=(async()=>{const before=await readSpellTargetOriginalSavingDiceRoute(handle.route);guard();if(!before.values){const values=await input.rollDice(spec.count,20,label,targetName,{durableRollRequestId:spec.requestId,rollerTokenId:spec.rollerTokenId,rollerCharacterId:spec.characterId,spellTargetOriginalSavingDice:handle.route,skipChoiceReroll:true,rollKind:'saving-throw',d20RollKind:'saving-throw',d20RollMode:mode}),after=await readSpellTargetOriginalSavingDiceRoute(handle.route);guard();if(!after.values||!equal(values,after.values))throw Error('caster-target-collector:actual-private-adoption-required')}const row=await handle.read();guard();return[row.d20,row.d20Second]})();return collection
   },
   async completeSource(){guard();await handle.read();const continuation=await captureSpellcastingTargetOriginalContinuation({operation,route:handle.route,qualification}),facts=await readSpellcastingTargetOriginalContinuation(continuation);guard();return{continuation,operation,source:facts.source}},
   cancel,
  }
 }catch(error){cancel();throw error}
}
