import{captureDnd5eTempestuousLandingOriginalOperation,type Dnd5eTempestuousLandingOriginalOperation}from'./damageCommitSession'
import{readDnd5eActualTempestuousBeforeSpellMovement}from'./headlessCombatEngine'
import{restoreTempestuousBeforeOriginalPreparation,type TempestuousBeforePreparationIdentity,type TempestuousBeforeOriginalPreparationLoader}from'./tempestuousBeforeOriginalPreparation'
import{createDnd5ePreparedDamageCommitSession,captureDnd5eTempestuousBeforeCastOriginalOperation,readDnd5eTempestuousBeforeCastOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast,prepareDnd5eSpellCastAfterActualTempestuousPreparedPrefix}from'./spellAction'
import{tokenCenterForAnchorCell}from'../../lib/gridCombat'
import type{TempestuousBeforeSpellOfferChoice}from'./tempestuousBeforeSpellOffer'
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b),record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)
/** Protected private answers are replayed through a fresh actual Native Session.
 * The selection is not a prepared snapshot, raw die, or publication capability. */
export async function restoreTempestuousBeforeAcceptedPreparation(identity:TempestuousBeforePreparationIdentity,load:TempestuousBeforeOriginalPreparationLoader,landing?:{resolve:(operation:Dnd5eTempestuousLandingOriginalOperation)=>Promise<readonly number[]>}){
 const recovered=await restoreTempestuousBeforeOriginalPreparation(identity,load),{source,book}=recovered,accepted=(book as typeof book&{ownerDecision?:unknown}).ownerDecision
 if(!record(accepted)||!same(Object.keys(accepted).sort(),['decision','interruptIds'])||!Array.isArray(accepted.interruptIds)||!accepted.interruptIds.length||accepted.interruptIds.some(id=>typeof id!=='string')||new Set(accepted.interruptIds).size!==accepted.interruptIds.length||!record(accepted.decision))throw Error('tempestuous-before-accepted:protected-owner-decision-required')
 const decision=accepted.decision;let choice:TempestuousBeforeSpellOfferChoice|undefined
 if(decision.kind==='decline'){if(!same(Object.keys(decision),['kind']))throw Error('tempestuous-before-accepted:exact-owner-decision-required')}
 else if(decision.kind==='use'){
  const selection=decision.selection,actor=source.prepared.map.tokens.find(token=>token.id===book.frame.actorId)
  if(!same(Object.keys(decision).sort(),['kind','selection'])||!record(selection)||!same(Object.keys(selection).sort(),['cell','elevationFeet','featureId','frameId'])||selection.frameId!==book.frame.id||!book.frame.options.some(option=>option.featureId===selection.featureId)||!record(selection.cell)||!same(Object.keys(selection.cell).sort(),['col','row'])||!Number.isSafeInteger(selection.cell.col)||!Number.isSafeInteger(selection.cell.row)||typeof selection.elevationFeet!=='number'||!Number.isFinite(selection.elevationFeet)||!actor)throw Error('tempestuous-before-accepted:exact-owner-selection-required')
  choice={frameId:book.frame.id,featureId:selection.featureId as string,to:tokenCenterForAnchorCell({col:selection.cell.col as number,row:selection.cell.row as number},actor,source.prepared.map),elevationFeet:selection.elevationFeet}
 }else throw Error('tempestuous-before-accepted:exact-owner-decision-required')
 const session=createDnd5ePreparedDamageCommitSession(source,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,identity.parentId,true,true)
 try{
  const before=session.run(source.prepared.state);if(before.status!=='pending-tempestuous-before-spell'||!same(before.frame,book.frame)||JSON.stringify(before.snapshot)!==book.prefixSignature||before.effectTimestamp!==book.effectTimestamp)throw Error('tempestuous-before-accepted:exact-native-prechoice-required')
  let result=session.resumeTempestuousBeforeSpell(source.prepared.state,before.frame,choice)
  if(result.status==='pending-tempestuous-landing-dice'&&landing){const frame=result.frame,operation=captureDnd5eTempestuousLandingOriginalOperation(result),values=await landing.resolve(operation);result=session.resumeTempestuousLandingDice(source.prepared.state,frame,values)}
  if(!choice){if(result.status==='pending-tempestuous-before-spell'||result.status==='pending-tempestuous-before-cast'||result.status==='rejected')throw Error('tempestuous-before-accepted:actual-decline-continuation-required');return{source,book,result}}
  if(result.status!=='pending-tempestuous-before-cast')throw Error('tempestuous-before-accepted:actual-movement-prefix-required')
  const operation=captureDnd5eTempestuousBeforeCastOriginalOperation(result),native=readDnd5eTempestuousBeforeCastOriginalOperation(operation),movement=readDnd5eActualTempestuousBeforeSpellMovement(native.nativeOperation),next=prepareDnd5eSpellCastAfterActualTempestuousPreparedPrefix(source.prepared,native.nativeOperation)
  if(!next.ok||native.effectTimestamp!==book.effectTimestamp||native.frame.parentId!==identity.parentId||native.frame.featureId!==choice.featureId||native.frame.actorId!==book.frame.actorId||!native.frame.movementCompleted||!same(movement.action.tempestuousMovement,{timing:'before',featureId:choice.featureId,to:choice.to,elevationFeet:choice.elevationFeet})||!same(native.frame,movement.frame)||native.frame.actualPosition.x!==choice.to.x||native.frame.actualPosition.y!==choice.to.y)throw Error('tempestuous-before-accepted:actual-canonical-continuation-required')
  return{source,book,result,operation,nativeMovementOperation:native.nativeOperation,continuationPrepared:next.prepared}
 }finally{session.cancel()}
}
