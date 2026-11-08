import {readDnd5eActualOriginalAllyBoundary} from './damageCommitSession'
import {resolvePreparedDnd5ePluginSpellCast} from './pluginSpellTransaction'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {readDnd5ePluginSpellCompoundPrimaryAnsweredPending,type Dnd5ePluginSpellCompoundPrimaryAnsweredPending} from './pluginSpellCompoundPrimaryAnswered'
import {dnd5eRulesPluginRegistrySnapshot} from './pluginApi'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {decodeSecondChanceParentWire,encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import type {BountifulPluginSpellCompoundPrimaryBook} from '../../ports/dnd5ePluginSpellCompoundPrimaryTransport'

type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Actual=ReturnType<typeof readDnd5eActualOriginalAllyBoundary>
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
declare const pendingQualification:unique symbol
export type Dnd5ePluginSpellCompoundPrimaryPendingQualification={readonly[pendingQualification]:true}
const qualified=new WeakMap<object,{read:()=>void;source:Source;book:BountifulPluginSpellCompoundPrimaryBook;request:Actual['request'];effectTimestamp:number;requestId:string}>()

/** This is the first actual attack checkpoint, not a Saving qualification or a
 * ready capability. The protected Node book remains an independent authority. */
export function captureDnd5ePluginSpellCompoundPrimaryPendingQualification(cap:Dnd5ePluginSpellCompoundPrimaryAnsweredPending,book:BountifulPluginSpellCompoundPrimaryBook){
 const lease=readDnd5ePluginSpellCompoundPrimaryAnsweredPending(cap),stage=lease.actualPending,actual=readDnd5eActualOriginalAllyBoundary(stage),request=actual.request
 const source=lease.source,p=source.prepared,definition=p.activityHeadlessAction&&getRegisteredDnd5eActivity(p.activityHeadlessAction.pluginId,p.activityHeadlessAction.actionId),check=p.activity?.checks?.[0],slot=book.rows?.[0],pending=stage as {occurrence?:number}
 if(actual.resolve!==resolvePreparedDnd5ePluginSpellCast||pending.occurrence!==0||request.kind!=='attack'||request.nativeLucky||request.originalRolls[request.dieIndex]!==1||!definition||definition.id!=='ice-knife-cast'||signature(p.activity)!==signature(definition)||p.action.type!=='dnd5e-spell-cast'||p.action.status!=='pending'||p.targets.length!==1||p.activity?.checks?.length!==1||check?.kind!=='attack-roll'||'compound'in source)throw Error('ice-knife-primary-pending:actual-first-attack-required')
 if(lease.effectTimestamp!==actual.effectTimestamp||'hostOriginalD20Replay'in source)throw Error('ice-knife-primary-pending:actual-plain-source-required')
 const target=p.targets[0].token.id,rollId=check.rollId+(check.scope==='per-target'?':'+target:''),checkId=check.id+(check.scope==='per-target'?':'+target:'')
 if(!book.ok||book.schemaVersion!==1||book.sourceKind!=='plugin-spell-compound-primary-v1'||book.parentId!==p.action.id||book.mapId!==p.map.id||book.combatId!==p.state.combatId||book.effectTimestamp!==actual.effectTimestamp||source.now!==actual.effectTimestamp||!book.roomId||!book.hostMemberId||book.rows.length!==1||slot.kind!=='attack'||slot.index!==0||slot.activityId!==definition.id||slot.rollId!==rollId||slot.checkId!==checkId||slot.actorId!==p.actorToken.id||slot.targetId!==target||slot.count!==request.originalRolls.length||slot.count!==(slot.mode==='normal'?1:2)||slot.sides!==20||!slot.raw||!slot.confirmed||slot.raw.memberId!==slot.memberId||slot.confirmed.memberId!==book.hostMemberId||!/^bountiful-plugin-spell-saving-original:[a-f0-9]{64}$/.test(slot.requestId)||request.actorId!==slot.actorId||signature(request.originalRolls)!==signature(slot.confirmed.values)||[slot.raw.values,slot.confirmed.values].some(values=>values.length!==slot.count||values.some(value=>!Number.isInteger(value)||value<1||value>20)))throw Error('ice-knife-primary-pending:exact-private-unique-original-required')
 const expected=cloneDnd5eHostTransactionInput(decodeSecondChanceParentWire(book.source)) as Source,roll=source.rolls?.activityRolls?.[rollId]
 if(!roll||signature(roll.values)!==signature(slot.confirmed.values)||Object.keys(expected.rolls??{}).length)throw Error('ice-knife-primary-pending:plain-private-primary-required')
 const allowed=new Set(['activityRolls','effectRollDice','spellcastingSavingThrows','sourceActionInterruptionReaction'])
 if(Object.keys(source.rolls?.activityRolls??{}).length!==1||Object.entries(source.rolls??{}).some(([key,value])=>!allowed.has(key)||key!=='activityRolls'&&value!==undefined&&!(key==='effectRollDice'&&value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===0)))throw Error('ice-knife-primary-pending:only-original-attack-and-exact-empty-page-carrier-required')
 expected.rolls={...structuredClone(source.rolls),activityRolls:{[rollId]:{values:[...slot.confirmed.values],modifier:0,total:slot.confirmed.values.reduce((sum,value)=>sum+value,0)}}}
 if(signature(expected)!==signature(source))throw Error('ice-knife-primary-pending:exact-full-source-required')
 const registry=dnd5eRulesPluginRegistrySnapshot(),stageSignature=signature(stage),sourceSignature=signature(source),definitionSignature=signature(definition),bookSignature=signature(book)
 const read=()=>{const live=readDnd5ePluginSpellCompoundPrimaryAnsweredPending(cap),current=readDnd5eActualOriginalAllyBoundary(stage);if(live.actualPending!==stage||live.effectTimestamp!==actual.effectTimestamp||signature(live.source)!==sourceSignature||registry!==dnd5eRulesPluginRegistrySnapshot()||signature(stage)!==stageSignature||signature(source)!==sourceSignature||signature(book)!==bookSignature||signature(getRegisteredDnd5eActivity(p.activityHeadlessAction!.pluginId,p.activityHeadlessAction!.actionId))!==definitionSignature||current.resolve!==actual.resolve||current.effectTimestamp!==actual.effectTimestamp||signature(current.input)!==signature(actual.input))throw Error('ice-knife-primary-pending:unchanged-current-native-required')}
 const token=Object.freeze({}) as Dnd5ePluginSpellCompoundPrimaryPendingQualification
 qualified.set(token,{read,source,book:structuredClone(book),request:structuredClone(request),effectTimestamp:actual.effectTimestamp,requestId:slot.requestId});return token
}

export function readDnd5ePluginSpellCompoundPrimaryPendingQualification(token:object,source?:Source){
 const row=qualified.get(token);if(!row)throw Error('ice-knife-primary-pending:actual-qualified-attack-required');row.read()
 if(source!==undefined&&signature(source)!==signature(row.source))throw Error('ice-knife-primary-pending:unchanged-source-required')
 return{source:cloneDnd5eHostTransactionInput(row.source),book:structuredClone(row.book),request:structuredClone(row.request),effectTimestamp:row.effectTimestamp,rawIssuer:{mode:'dm' as const,rollId:row.requestId,cursor:1},lastOriginalActorId:row.request.actorId}
}
