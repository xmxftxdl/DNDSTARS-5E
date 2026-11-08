import {readDnd5ePluginSpellCompoundPrimaryAnsweredReady,type Dnd5ePluginSpellCompoundPrimaryAnsweredReady} from './pluginSpellCompoundPrimaryAnswered'
import {decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {originalD20ReplaySourceKey,type OriginalD20ReplayFacts} from './allyNaturalOneCheckpoint'
import {decodeSecondChanceParentWire,encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import type {BountifulPluginSpellCompoundPrimaryBook} from '../../ports/dnd5ePluginSpellCompoundPrimaryTransport'

type Actual=ReturnType<typeof readDnd5ePluginSpellCompoundPrimaryAnsweredReady>
type Source=Actual['source']
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const nonDice=(value:Source)=>signature({...value,rolls:undefined})
// Optional decision is absent in witnessed DECLINE facts and explicitly
// undefined in the ordinary authenticated-receipt formatter. All other fields
// and the decision value still have their full original wire signature.
const factSignature=(fact:OriginalD20ReplayFacts['facts'][number])=>{const{decision,...fields}=fact;return signature([fields,decision])}
declare const qualificationBrand:unique symbol
export type Dnd5ePluginSpellCompoundPrimaryAnsweredQualification={readonly[qualificationBrand]:true}
const qualifications=new WeakMap<object,{read:()=>Actual;book:BountifulPluginSpellCompoundPrimaryBook;receipts:readonly BountifulOriginalDieReceipt[]}>()

/** The caller supplies receipt DTOs only for comparison with this Native
 * collector's internally witnessed answers. They cannot replace those answers,
 * create a ready cap, or bypass the independent current private Node reader. */
export function captureDnd5ePluginSpellCompoundPrimaryAnsweredQualification(cap:Dnd5ePluginSpellCompoundPrimaryAnsweredReady,book:BountifulPluginSpellCompoundPrimaryBook,receipts:readonly BountifulOriginalDieReceipt[]){
 const actual=readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap),source=actual.source,p=source.prepared,slot=book.rows?.[0],original=decodeSecondChanceParentWire(book.source) as Source,check=p.activity?.checks?.[0]
 if(!book.ok||book.schemaVersion!==1||book.sourceKind!=='plugin-spell-compound-primary-v1'||book.parentId!==actual.parentId||book.mapId!==p.map.id||book.combatId!==p.state.combatId||book.effectTimestamp!==actual.effectTimestamp||source.now!==book.effectTimestamp||!book.roomId||!book.hostMemberId||book.rows.length!==1||!slot.raw||!slot.confirmed||slot.raw.memberId!==slot.memberId||slot.confirmed.memberId!==book.hostMemberId||slot.kind!=='attack'||slot.index!==0||slot.actorId!==actual.actorId||slot.targetId!==actual.targetId||slot.activityId!=='ice-knife-cast'||p.targets.length!==1||p.activity?.checks?.length!==1||check?.kind!=='attack-roll'||slot.rollId!==check.rollId+(check.scope==='per-target'?':'+actual.targetId:'')||slot.checkId!==check.id+(check.scope==='per-target'?':'+actual.targetId:'')||slot.mode!==actual.mode||slot.count!==(slot.mode==='normal'?1:2)||slot.sides!==20||!/^bountiful-plugin-spell-saving-original:[a-f0-9]{64}$/.test(slot.requestId)||signature(actual.ready.originalRolls)!==signature(slot.confirmed.values)||signature(source.rolls?.activityRolls?.[slot.rollId])!==signature({values:slot.confirmed.values,modifier:0,total:slot.confirmed.values.reduce((sum,value)=>sum+value,0)})||!slot.confirmed.values.includes(1)||nonDice(source)!==nonDice(original)||!actual.primary.result.ok||receipts.length!==actual.facts.length||!receipts.length||receipts[0].request.nativeLucky||[slot.raw.values,slot.confirmed.values].some(values=>values.length!==slot.count||values.some(value=>!Number.isInteger(value)||value<1||value>20)))throw Error('ice-knife-primary-answered-q:exact-private-actual-primary-required')
 for(let index=0;index<actual.facts.length;index++){
  const fact=actual.facts[index],receipt=receipts[index],i=receipt.identity
  if(fact.occurrence!==index||i.occurrence!==index||i.parentId!==book.parentId||i.mapId!==book.mapId||i.combatId!==book.combatId||i.roomId!==book.roomId||i.hostMemberId!==book.hostMemberId||i.effectTimestamp!==book.effectTimestamp||receipt.consumed||receipt.originalAdapterId!=='plugin-spell'||receipt.request.kind!=='attack'||receipt.request.actorId!==slot.actorId||signature(receipt.request)!==signature(fact.request)||signature(receipt.request.originalRolls)!==signature(slot.confirmed.values)||!receipt.rawIssuer||receipt.rawIssuer.mode!=='dm'||receipt.rawIssuer.rollId!==slot.requestId||receipt.rawIssuer.cursor!==1||nonDice(decodeSecondChanceParentWire(receipt.originalParent) as Source)!==nonDice(original)||signature(decisionFromBountifulOriginalDieReceipt(receipt,fact.request))!==signature(fact.decision))throw Error('ice-knife-primary-answered-q:exact-authenticated-answered-prefix-required')
 }
 const actualSignature=signature(actual),bookSignature=signature(book),receiptsSignature=signature(receipts)
 const read=()=>{const current=readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap);if(signature(current)!==actualSignature||signature(book)!==bookSignature||signature(receipts)!==receiptsSignature)throw Error('ice-knife-primary-answered-q:unchanged-live-answers-required');return current}
 const token=Object.freeze({}) as Dnd5ePluginSpellCompoundPrimaryAnsweredQualification
 qualifications.set(token,{read,book:structuredClone(book),receipts:structuredClone(receipts)});return token
}

export function readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(token:object){
 const row=qualifications.get(token);if(!row)throw Error('ice-knife-primary-answered-q:actual-qualification-required')
 const actual=row.read()
 return{source:cloneDnd5eHostTransactionInput(actual.source),effectTimestamp:actual.effectTimestamp,ready:structuredClone(actual.ready),facts:structuredClone(actual.facts),primary:structuredClone(actual.primary),book:structuredClone(row.book),receipts:structuredClone(row.receipts)}
}

/** Mechanical input for the actual combined worker. The witnessed attack facts
 * are always the initial prefix; a later Saving continuation cannot replace,
 * renumber or omit them. It still needs its own current private-book checks. */
export function projectDnd5ePluginSpellCompoundPrimaryAnsweredReplay<T extends Source&{hostOriginalD20Replay?:OriginalD20ReplayFacts}>(token:Dnd5ePluginSpellCompoundPrimaryAnsweredQualification,input:T):T&{hostOriginalD20Replay:OriginalD20ReplayFacts}{
 const actual=readDnd5ePluginSpellCompoundPrimaryAnsweredQualification(token),{hostOriginalD20Replay:replay,...plain}=input,withoutHeader={...plain}
 Reflect.deleteProperty(withoutHeader,'compound')
 if(nonDice(withoutHeader as Source)!==nonDice(actual.source))throw Error('ice-knife-primary-answered-q:unchanged-combined-non-dice-source-required')
 for(const [id,roll] of Object.entries(actual.source.rolls?.activityRolls??{}))if(signature(input.rolls?.activityRolls?.[id])!==signature(roll))throw Error('ice-knife-primary-answered-q:unchanged-original-primary-carrier-required')
 for(const [id,values] of Object.entries(actual.source.rolls?.effectRollDice??{}))if(signature(input.rolls?.effectRollDice?.[id])!==signature(values))throw Error('ice-knife-primary-answered-q:unchanged-original-primary-effect-required')
 const p=actual.source.prepared,sourceKey=originalD20ReplaySourceKey(p.action.id,p.state,p.action,actual.effectTimestamp),prefix=actual.facts
 if(replay&&(replay.parentId!==p.action.id||replay.effectTimestamp!==actual.effectTimestamp||replay.sourceKey!==sourceKey))throw Error('ice-knife-primary-answered-q:matching-original-parent-clock-required')
 if(replay&&(!Array.isArray(replay.facts)||Object.keys(replay).some(key=>!['parentId','sourceKey','effectTimestamp','facts'].includes(key))))throw Error('ice-knife-primary-answered-q:closed-original-replay-required')
 let suffix=replay?.facts??[]
 if(suffix.some(fact=>fact.occurrence<prefix.length)){
  if(suffix.length<prefix.length||suffix.slice(0,prefix.length).some((fact,index)=>factSignature(fact)!==factSignature(prefix[index])))throw Error('ice-knife-primary-answered-q:unchanged-actual-attack-facts-required')
  suffix=suffix.slice(prefix.length)
 }
 if(suffix.some((fact,index)=>fact.occurrence!==prefix.length+index||fact.request.kind!=='saving-throw'))throw Error('ice-knife-primary-answered-q:contiguous-following-saving-facts-required')
 return{...input,hostOriginalD20Replay:{parentId:p.action.id,sourceKey,effectTimestamp:actual.effectTimestamp,facts:[...structuredClone(prefix),...structuredClone(suffix)]}}
}
