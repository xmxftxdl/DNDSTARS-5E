import{readMastermindThoughtNativeContinuationCompleted}from'./mastermindThoughtContinuation'
import type{Character}from'../../types/character'
import type{SharedCombatState}from'../../lib/sharedCombatTypes'
import type{saveSharedResourcesAtomically,SharedResourceTransactionWrite}from'../../lib/sharedApi'
import type{MastermindThoughtGateway}from'./mastermindThoughtReadingParent'
import type{BattleMap}from'../../store/maps'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{dnd5eHeadlessTurnKey}from'../../rulesets/dnd5e/headlessCombatEngine'
type Gateway=MastermindThoughtGateway&{saveResourcesAtomically:typeof saveSharedResourcesAtomically}
type View=Awaited<ReturnType<typeof readMastermindThoughtNativeContinuationCompleted>>
const resource='mastermind-thought-readings',ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v,sig=(v:unknown)=>JSON.stringify(ordered(v)),same=(a:unknown,b:unknown)=>sig(a)===sig(b)
export interface MastermindNativeThoughtContinuationPublication{readonly mastermindNativeThoughtPublication:unique symbol}
type Bound={resolution:object;gateway:Gateway;view:View;writes:SharedResourceTransactionWrite[];signature:string;expectedParent:unknown;transactionId:string;readRevisions:Record<string,number>}
const plans=new WeakMap<object,Bound>()
/** Native source-granted continuations never acquire a synthetic player queue, ACK or processed
 * row. The actual resolver's branded result owns the four-resource plan. */
export async function prepareMastermindNativeThoughtContinuationPublication(resolution:object,gateway:Gateway,dmNarrative?:string):Promise<MastermindNativeThoughtContinuationPublication>{
 const view=await readMastermindThoughtNativeContinuationCompleted(resolution,gateway),session=gateway.session()
 if(view.row.origin!=='native'||session?.role!=='dm'||view.row.hostMemberId!==session.memberId||view.originalAction.sourceMode!=='dm'||view.originalAction.type!=='dnd5e-plugin-action'||view.originalAction.roomMemberId!==session.memberId||!view.native.application)throw Error('native-thought-publication:issued-native-Host-original-required')
 const [journal,maps,combat,queue,characters]=await Promise.all([gateway.loadResource<{parents:Record<string,typeof view.row>;_sync?:{revision?:number}}>(resource),gateway.loadResource<{maps:BattleMap[];_sync?:{revision?:number}}>('maps'),gateway.loadResource<SharedCombatState&{_sync?:{revision?:number}}>('combat'),gateway.loadResource<{requests:{id:string}[]}>('player-action-requests'),gateway.loadResource<{characters:Character[];_sync?:{revision?:number}}>('characters')])
 if(!characters||characters._sync?.revision!==view.versions.characters||!journal||!Number.isSafeInteger(journal._sync?.revision)||journal._sync!.revision!<0||!same(journal.parents[view.journalId],view.row)||!maps||maps._sync?.revision!==view.versions.maps||!combat||combat._sync?.revision!==view.versions.combat||queue?.requests?.some(a=>a.id===view.parentId))throw Error('native-thought-publication:current-native-journal-required')
 if(dmNarrative!==undefined&&(typeof dmNarrative!=='string'||dmNarrative.length>4000))throw Error('native-thought-publication:private-narrative-length')
 const thoughts=view.kind==='real-consent'?dmNarrative?.trim():undefined,expectedParent={...view.row,phase:'published',revision:view.row.revision+1,result:{kind:view.kind,...(thoughts?{thoughts}:{}),recipientMemberId:session.memberId,publishedAt:view.row.issuedAt}},data={...journal,parents:{...journal.parents,[view.journalId]:expectedParent}}
 const finalCombat={...combat};if(combat.active===true){if(combat.mapId!==view.originalAction.mapId||combat.combatId!==view.originalAction.combatId)throw Error('native-thought-publication:original-combat-required');const economies={...combat.dnd5eTurnEconomyByToken};for(const[id,actor]of Object.entries(view.native.result.state.combatants)){const before=economies[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(view.native.result.state,id),actor.speed);economies[id]=projectDnd5eHeadlessTurnEconomy(before,actor.turn,actor.speed)}finalCombat.dnd5eTurnEconomyByToken=economies}
 const writes=[{name:'characters',expectedRevision:view.versions.characters,data:{...characters,characters:view.native.application.characters}},{name:'maps',expectedRevision:view.versions.maps,data:{...maps,maps:maps.maps.map(map=>map.id===view.native.application!.map.id?view.native.application!.map:map)}},{name:'combat',expectedRevision:view.versions.combat,data:finalCombat},{name:resource,expectedRevision:journal._sync!.revision!,data}]
 const token=Object.freeze({})as MastermindNativeThoughtContinuationPublication,transactionId='native-thought-reading:'+view.journalId;plans.set(token,{resolution,gateway,view,writes,signature:sig(writes),expectedParent,transactionId,readRevisions:{'map-geometry':view.versions['map-geometry'],'campaign-time':view.versions['campaign-time']}});return token
}
export async function publishMastermindNativeThoughtContinuation(token:MastermindNativeThoughtContinuationPublication){
 const bound=plans.get(token);if(!bound||sig(bound.writes)!==bound.signature)throw Error('native-thought-publication:issued-fixed-plan-required')
 const session=bound.gateway.session();if(session?.role!=='dm'||session.roomId!==bound.view.row.roomId||session.memberId!==bound.view.row.hostMemberId)throw Error('native-thought-publication:current-Host-required')
 const committed=async()=>{const journal=await bound.gateway.loadResource<{parents:Record<string,unknown>}>(resource);return same(journal?.parents[bound.view.journalId],bound.expectedParent)}
 if(await committed())return
 const current=await readMastermindThoughtNativeContinuationCompleted(bound.resolution,bound.gateway);if(!same(current.row,bound.view.row)||!same(current.originalAction,bound.view.originalAction)||sig(bound.writes)!==bound.signature)throw Error('native-thought-publication:original-changed')
 try{await bound.gateway.saveResourcesAtomically(bound.writes,{transactionId:bound.transactionId,readRevisions:bound.readRevisions})}catch(error){if(!await committed())throw error}
 if(!await committed())throw Error('native-thought-publication:committed-private-result-required')
}
