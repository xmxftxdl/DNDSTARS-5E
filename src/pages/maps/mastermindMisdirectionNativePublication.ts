import type {Character} from '../../types/character'
import type {BattleMap} from '../../store/maps'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedResourceTransactionWrite,saveSharedResourcesAtomically} from "../../composition/browserSharedRoomResources"
import {readMastermindNativeMonsterCompleted} from './mastermindMisdirectionNativeParent'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from '../../rulesets/dnd5e/turnEconomy'
import {dnd5eHeadlessTurnKey} from "../../application/combat/dnd5eCombatRules"
type View=Awaited<ReturnType<typeof readMastermindNativeMonsterCompleted>>
type Gateway=View['gateway']&{saveResourcesAtomically:typeof saveSharedResourcesAtomically}
type Row={id:string;roomId:string;hostMemberId:string;parentTransactionId:string;phase:string;revision:number;versions:Record<string,number>;nativeOriginal:unknown;originalAction?:unknown;answer?:{choice:string;submittedByMemberId:string};ownerMemberId:string}
type Doc<T>=T&{_sync?:{revision?:number}}
const sort=(v:unknown):unknown=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,n])=>[k,sort(n)])):v,sig=(v:unknown)=>JSON.stringify(sort(v)),same=(a:unknown,b:unknown)=>sig(a)===sig(b)
const resource='mastermind-misdirections'
export interface MastermindNativeMonsterPublication {readonly mastermindNativeMonsterPublication:unique symbol}
const plans=new WeakMap<object,{completed:object;gateway:Gateway;view:View;row:Row;expected:unknown;writes:SharedResourceTransactionWrite[];signature:string;transactionId:string}>()
/** A fixed native four-write plan can only follow this actual native facade's
 * unchanged result and the actual completed Base. No PC queue or ACK is made. */
export async function prepareMastermindNativeMonsterPublication(completed:object,gateway:Gateway):Promise<MastermindNativeMonsterPublication>{
 const view=await readMastermindNativeMonsterCompleted(completed),session=gateway.session();if(session?.role!=='dm'||session.roomId!==view.session.roomId||session.memberId!==view.session.memberId)throw Error('native-misdirection-publication:actual-Host-required')
 const[journal,characters,maps,combat,queue]=await Promise.all([gateway.loadResource<Doc<{parents:Record<string,Row>}>>(resource),gateway.loadResource<Doc<{characters:Character[]}>>('characters'),gateway.loadResource<Doc<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Doc<SharedCombatState>>('combat'),gateway.loadResource<{requests:{id:string}[]}>('player-action-requests')])
 const row=journal?.parents[view.id];if(!journal||!row||row.phase!=='answered'||!row.nativeOriginal||row.originalAction!==undefined||row.parentTransactionId!==view.parentTransactionId||row.roomId!==view.session.roomId||row.hostMemberId!==view.session.memberId||!same(row.versions,view.versions)||row.answer?.submittedByMemberId!==row.ownerMemberId||!Number.isSafeInteger(journal._sync?.revision)||journal._sync!.revision!<0||!characters||characters._sync?.revision!==view.versions.characters||!maps||maps._sync?.revision!==view.versions.maps||!combat||combat._sync?.revision!==view.versions.combat||combat.mapId!==view.mapId||queue?.requests.some(a=>a.id===view.parentTransactionId)||!view.application)throw Error('native-misdirection-publication:same-original-required')
 const economies={...combat.dnd5eTurnEconomyByToken};for(const[id,actor]of Object.entries(view.result.state.combatants)){const prior=economies[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(view.result.state,id),actor.speed);economies[id]=projectDnd5eHeadlessTurnEconomy(prior,actor.turn,actor.speed)}
 const successorRows=view.ownerRows.map(proof=>{const child=journal.parents[proof.id];if(!child||child.phase!=='answered'||sig(child)!==proof.signature||child.answer?.submittedByMemberId!==child.ownerMemberId)throw Error('native-misdirection-publication:actual-answered-successor-required');return child});
 const transactionId='mastermind-native-misdirection:'+view.id,authorityRevisions={characters:view.versions.characters+1,maps:view.versions.maps+1,combat:view.versions.combat+1,[resource]:journal._sync!.revision!+1},expected={...row,phase:'consumed',revision:row.revision+1,nativePublication:{transactionId,authorityRevisions}},writes:SharedResourceTransactionWrite[]=[
  {name:'characters',expectedRevision:view.versions.characters,data:{...characters,characters:view.application.characters}},
  {name:'maps',expectedRevision:view.versions.maps,data:{...maps,maps:maps.maps.map(m=>m.id===view.mapId?view.application.map:m)}},
  {name:'combat',expectedRevision:view.versions.combat,data:{...combat,dnd5eTurnEconomyByToken:economies}},
  {name:resource,expectedRevision:journal._sync!.revision!,data:{...journal,parents:{...journal.parents,[view.id]:expected,...Object.fromEntries(successorRows.map(child=>[child.id,{...child,phase:'consumed',revision:child.revision+1,nativePublication:{transactionId,authorityRevisions}}]))}}}]
 if(view.wardBountiful){const {book,ids}=view.wardBountiful,parents={...book.parents};for(const id of ids){const current=parents[id];if(current.consumed)throw Error('native-misdirection-publication:unused-saving-evidence-required');parents[id]={...current,revision:current.revision+1,consumed:{transactionId,authorityRevision:book._sync.revision+1}}}writes.push({name:'mastermind-native-ward-bountifuls',expectedRevision:book._sync.revision,data:{...book,parents}})}
 const cap=Object.freeze({}) as MastermindNativeMonsterPublication;plans.set(cap,{completed,gateway,view,row,expected,writes,signature:sig(writes),transactionId});return cap
}
export async function publishMastermindNativeMonster(cap:MastermindNativeMonsterPublication){
 const plan=plans.get(cap);if(!plan||sig(plan.writes)!==plan.signature)throw Error('native-misdirection-publication:issued-fixed-plan-required')
 const session=plan.gateway.session();if(session?.role!=='dm'||session.roomId!==plan.view.session.roomId||session.memberId!==plan.view.session.memberId)throw Error('native-misdirection-publication:current-Host-required')
 const committed=async()=>{const actual=await plan.gateway.loadResource<{parents:Record<string,unknown>}>(resource),expectedJournal=plan.writes.find(write=>write.name===resource)!.data as{parents:Record<string,unknown>};if(![plan.view.id,...plan.view.ownerRows.map(row=>row.id)].every(id=>same(actual?.parents[id],expectedJournal.parents[id])))return false;const extra=plan.writes.find(write=>write.name==='mastermind-native-ward-bountifuls');if(!extra)return true;const book=await plan.gateway.loadResource<{parents:Record<string,unknown>}>('mastermind-native-ward-bountifuls'),expected=extra.data as{parents:Record<string,unknown>};return plan.view.wardBountiful!.ids.every(id=>same(book?.parents[id],expected.parents[id]))}
 if(await committed())return
 const current=await readMastermindNativeMonsterCompleted(plan.completed);if(!same(current.versions,plan.view.versions)||!same(current.result,plan.view.result)||!same(current.application,plan.view.application))throw Error('native-misdirection-publication:original-changed')
 try{await plan.gateway.saveResourcesAtomically(plan.writes,{transactionId:plan.transactionId,readRevisions:{...plan.view.readGuards,'map-geometry':plan.view.versions['map-geometry'],'campaign-time':plan.view.versions['campaign-time']}})}catch(error){if(!await committed())throw error}
 if(!await committed())throw Error('native-misdirection-publication:committed-original-required')
}
