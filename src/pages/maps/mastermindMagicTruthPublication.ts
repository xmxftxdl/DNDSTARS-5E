import type{SharedPlayerActionState,SharedPlayerActionAckState,SharedCombatState}from'../../lib/sharedCombatTypes'
import type{PublishPlayerActionAckInput}from'../../lib/playerActionAckPublish'
import{publishPlayerActionAckWithSnapshots}from'../../lib/playerActionAckPublish'
import type{SharedResourceTransactionWrite}from'../../lib/sharedApi'
import type{MastermindMagicTruthGateway}from'./mastermindMagicTruthRoom'
import type{BattleMap}from'../../store/maps'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{dnd5eHeadlessTurnKey}from'../../rulesets/dnd5e/headlessCombatEngine'
import{readMastermindMagicTruthCompleted}from'./mastermindMagicTruthRoom'
const readProtectedOriginal=(value:object,_gateway:MastermindMagicTruthGateway)=>readMastermindMagicTruthCompleted(value)
export interface MastermindMagicTruthPublication{readonly mastermindMagicTruthPublication:unique symbol}
const name='mastermind-magic-truth'
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v
const same=(a:unknown,b:unknown)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
type View=Awaited<ReturnType<typeof readProtectedOriginal>>
type Bound={maps:BattleMap[];resolution:object;gateway:MastermindMagicTruthGateway;view:View;journalRevision:number;write:SharedResourceTransactionWrite;signature:string;nativeSignature:string;combat:SharedCombatState;authorityRevisions:Record<string,number>;queueRevision:number}
const plans=new WeakMap<object,Bound>()

/** Produces one fixed private-journal write from the actual native original.
 * No arbitrary writer, result DTO, or player-provided state is accepted. */
export async function prepareMastermindMagicTruthPublication(resolution:object,gateway:MastermindMagicTruthGateway,dmNarrative?:string):Promise<MastermindMagicTruthPublication>{
 const view=await readProtectedOriginal(resolution,gateway),allMaps=await gateway.loadResource<{maps:BattleMap[];_sync?:{revision?:number}}>('maps'),journal=await gateway.loadResource<{schemaVersion:1;parents:Record<string,typeof view.row>;_sync:{revision:number}}>(name),queue=await gateway.loadResource<{requests:SharedPlayerActionState[];_sync:{revision:number}}>('player-action-requests');
 if(!allMaps||allMaps._sync?.revision!==view.versions.maps||!Array.isArray(allMaps.maps)||!journal||!Number.isSafeInteger(journal._sync?.revision)||journal._sync.revision<0||!same(journal.parents[view.journalId],view.row)||!queue||!Number.isSafeInteger(queue._sync?.revision)||queue._sync.revision<0||!queue.requests.some(action=>same(action,view.originalAction)))throw Error('magic-truth-publication:current-original-journal-required');
 if(dmNarrative!==undefined&&(typeof dmNarrative!=='string'||dmNarrative.length>4000))throw Error('magic-truth-publication:private-narrative-length');
 if(dmNarrative!==undefined)throw Error('magic-truth-publication:no-private-thought-content');
 const data={...journal,parents:{...journal.parents,[view.journalId]:{...view.row,phase:'consumed',revision:view.row.revision+1,consumedAt:view.row.issuedAt}}},write={name,expectedRevision:journal._sync.revision,data},token=Object.freeze({})as MastermindMagicTruthPublication;
 const combat=await gateway.loadResource<SharedCombatState&{_sync?:{revision?:number}}>('combat');if(!combat||combat._sync?.revision!==view.versions.combat)throw Error('magic-truth-publication:original-combat-required');const finalCombat={...combat};if(combat.active===true){if(combat.mapId!==view.originalAction.mapId||combat.combatId!==view.originalAction.combatId)throw Error('magic-truth-publication:original-combat-required');const economies={...combat.dnd5eTurnEconomyByToken};for(const[id,actor]of Object.entries(view.native.result.state.combatants)){const before=economies[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(view.native.result.state,id),actor.speed);economies[id]=projectDnd5eHeadlessTurnEconomy(before,actor.turn,actor.speed)}finalCombat.dnd5eTurnEconomyByToken=economies}
 const [priorAck,priorProcessed]=await Promise.all(['player-action-ack','player-action-processed'].map(name=>gateway.loadResource<{_sync?:{revision?:number}}>(name)));const ackRevision=priorAck?._sync?.revision??0,processedRevision=priorProcessed?._sync?.revision??0;if(!Number.isSafeInteger(ackRevision)||ackRevision<0||!Number.isSafeInteger(processedRevision)||processedRevision<0)throw Error('magic-truth-publication:original-ack-versions-required');
 const authorityRevisions={characters:view.versions.characters+1,maps:view.versions.maps+1,combat:view.versions.combat+1,'player-action-processed':processedRevision+1,'player-action-ack':ackRevision+1,[name]:journal._sync.revision+1};
 const maps=allMaps.maps.map(map=>map.id===view.native.application!.map.id?view.native.application!.map:map);plans.set(token,{maps,resolution,gateway,view,authorityRevisions,journalRevision:journal._sync.revision,write,signature:JSON.stringify(write),nativeSignature:JSON.stringify(view.native),combat:finalCombat,queueRevision:queue._sync.revision!});return token
}

/** Appends only the factory's branded fixed write to the existing normal
 * five-resource original ACK transaction. It never opens a second publisher. */
export async function publishMastermindMagicTruthAck(action:SharedPlayerActionState,token:MastermindMagicTruthPublication,input:PublishPlayerActionAckInput){
 const bound=plans.get(token);if(!bound)throw Error('magic-truth-publication:issued-plan-required');
 if(!same(action,bound.view.originalAction)||JSON.stringify(bound.write)!==bound.signature||JSON.stringify(bound.view.native)!==bound.nativeSignature||input.ack.actionId!==action.id||input.ack.status!=='accepted'||input.ack.recipientMemberId!==action.roomMemberId)throw Error('magic-truth-publication:same-original-required');
 const [savedJournal,savedAck,savedProcessed]=await Promise.all([bound.gateway.loadResource<{parents:Record<string,unknown>}>(name),bound.gateway.loadResource<SharedPlayerActionAckState&{_sync?:unknown}>('player-action-ack'),bound.gateway.loadResource<{actionIds:string[]}>('player-action-processed')]);
 const expectedParent=(bound.write.data as{parents:Record<string,unknown>}).parents[bound.view.journalId];if(same(savedJournal?.parents[bound.view.journalId],expectedParent)&&savedProcessed?.actionIds.includes(action.id)){if(savedAck?.actionId===action.id){if(!same({...savedAck,_sync:undefined,authorityRevisions:undefined},{...input.ack,_sync:undefined,authorityRevisions:undefined})||!same(savedAck.authorityRevisions,bound.authorityRevisions))throw Error('magic-truth-publication:committed-ack-mismatch');await input.publishAck(savedAck)}return}
 const view=await readProtectedOriginal(bound.resolution,bound.gateway);
 if(!same(action,view.originalAction)||!same(view.row,bound.view.row)||JSON.stringify(bound.write)!==bound.signature||input.hostNativeWeapon||!input.commitSharedResources||input.ack.actionId!==action.id||input.ack.status!=='accepted'||input.ack.recipientMemberId!==action.roomMemberId||!input.processed?.actionIds.includes(action.id)||!input.snapshots||!view.native.application||!same(input.snapshots.characters,view.native.application.characters)||!same(input.snapshots.maps,bound.maps))throw Error('magic-truth-publication:same-native-original-ack-required');
 const latest=await bound.gateway.loadResource<{_sync?:{revision?:number}}>(name);if(latest?._sync?.revision!==bound.journalRevision)throw Error('magic-truth-publication:journal-changed');
 const verifyCommitted=async()=>{const[journal,ack,processed]=await Promise.all([bound.gateway.loadResource<{parents:Record<string,unknown>}>(name),bound.gateway.loadResource<SharedPlayerActionAckState&{_sync?:unknown}>('player-action-ack'),bound.gateway.loadResource<{actionIds:string[]}>('player-action-processed')]);if(!same(journal?.parents[bound.view.journalId],expectedParent)||!ack||!same({...ack,_sync:undefined,authorityRevisions:undefined},{...input.ack,_sync:undefined,authorityRevisions:undefined})||!same(ack.authorityRevisions,bound.authorityRevisions)||!processed?.actionIds.includes(action.id))throw Error('magic-truth-publication:committed-private-result-required');return ack};
 await publishPlayerActionAckWithSnapshots({...input,publishAck:async()=>input.publishAck(await verifyCommitted()),snapshots:{...input.snapshots,combat:bound.combat},expectedRevisions:{...input.expectedRevisions,...view.versions,'player-action-ack':bound.authorityRevisions['player-action-ack']-1,'player-action-processed':bound.authorityRevisions['player-action-processed']-1,'player-action-requests':bound.queueRevision},commitSharedResources:async(writes,options)=>{if(writes.some(write=>write.name===name))throw Error('magic-truth-publication:duplicate-journal-write');return input.commitSharedResources!([...writes,bound.write],options)}})
 await verifyCommitted()
}
