import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import{createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication}from'./mapBridge'
import{resolveDnd5eHeadlessInitiativeOriginal,type Dnd5eCombatEvent}from'./headlessCombatEngine'
import{dnd5ePluginFeatureDefinition}from'./pluginApi'
import{cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'./hostTransactionClone'
type Scene={mapId:string;active:false;preparationId:string;phase:'combat-start'}
export interface Dnd5eInitiativeOriginalInput{map:BattleMap;characters:readonly Character[];actorTokenId:string;scene:Scene;rolls:readonly number[]}
const slot=Symbol('actual-pre-combat-initiative-original');registerDnd5eHostReceiptSlot(slot)
const issued=new WeakMap<object,{signature:string;features:readonly{id:string;signature:string|undefined}[];actors?:readonly string[];events?:readonly Dnd5eCombatEvent[]}>()
export function prepareDnd5eInitiativeOriginal(input:Dnd5eInitiativeOriginalInput){
 if(input.scene.active!==false||input.scene.phase!=='combat-start'||input.scene.mapId!==input.map.id||!input.scene.preparationId||!input.rolls.length)throw Error('initiative-original:actual-preparation-source-required')
 const tokens=input.map.tokens.filter(t=>t.id===input.actorTokenId),token=tokens[0],characters=token?.characterId?input.characters.filter(c=>c.id===token.characterId):[]
 if(tokens.length!==1||!token||token.type==='obstacle'||characters.length!==1)throw Error('initiative-original:actual-character-required')
 const character=characters[0],snapshot=createDnd5eMapCombatSnapshot({map:input.map,characters:input.characters,combatId:input.scene.preparationId,round:1,initiativeOrder:[],additionalCreatureTokenIds:input.map.tokens.filter(t=>t.type!=='obstacle').map(t=>t.id)});
 // The canonical map projection supplies the actual creature roster without synthetic initiative entries. This dedicated pre-combat preparation has no active turn or published order.
 snapshot.state.active=false;snapshot.state.initiativeOrder=[];snapshot.state.initiativeSlotIds=undefined;snapshot.state.firstRoundOnlyInitiativeSlotIds=undefined;snapshot.state.turnSlotId=undefined;snapshot.state.round=1;snapshot.state.initiativeIndex=0;
 const prepared={...snapshot,map:input.map,characters:input.characters,actorToken:token,actor:character,scene:structuredClone(input.scene),rolls:[...input.rolls],action:{id:input.scene.preparationId+':initiative:'+token.id,kind:'native-initiative-original' as const,phase:input.scene.phase,preparationId:input.scene.preparationId,mapId:input.map.id,actorTokenId:token.id,characterId:character.id}}
 if(prepared.state.initiativeOrder.length)throw Error('initiative-original:no-active-turn-required')
 const receipt=registerDnd5eHostReceipt(Object.freeze({})),features=[...new Set(Object.values(prepared.state.combatants).flatMap(c=>c.pluginFeatureIds))].map(id=>({id,signature:JSON.stringify(dnd5ePluginFeatureDefinition(id))}));issued.set(receipt,{signature:JSON.stringify(prepared),features});Object.defineProperty(prepared,slot,{value:receipt,enumerable:false});return prepared
}
export type PreparedDnd5eInitiativeOriginal=ReturnType<typeof prepareDnd5eInitiativeOriginal>
const completed=new WeakMap<object,{signature:string;prepared:PreparedDnd5eInitiativeOriginal;actors:readonly string[];state:PreparedDnd5eInitiativeOriginal['state'];events:readonly Dnd5eCombatEvent[]}>()
function initiativeDataSnapshot<T>(value:T):T{const seen=new WeakSet<object>();function visit(value:unknown){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){if(descriptor.get||descriptor.set||typeof descriptor.value==='function')throw Error('initiative-original:data-snapshot-required');if('value'in descriptor)visit(descriptor.value)}if(value instanceof Map)for(const[key,child]of value){visit(key);visit(child)}if(value instanceof Set)for(const child of value)visit(child)}visit(value);return structuredClone(value)}
/** Only the concrete earlier initiative result carries pre-combat reaction
 * state to another original. A submitted state or reconstructed result cannot
 * issue this continuation, and an actor cannot be rolled twice in this chain. */
export function prepareDnd5eInitiativeOriginalContinuation(actual:object,actorTokenId:string,rolls:readonly number[]):PreparedDnd5eInitiativeOriginal{
 const prior=completed.get(actual);if(!prior||JSON.stringify(actual)!==prior.signature)throw Error('initiative-original:actual-unchanged-prior-required')
 const p=prior.prepared,receipt=(p as unknown as Record<symbol,unknown>)[slot],proof=receipt&&typeof receipt==='object'?issued.get(receipt):undefined
 if(!proof||proof.signature!==JSON.stringify(p)||proof.features.some(f=>JSON.stringify(dnd5ePluginFeatureDefinition(f.id))!==f.signature)||prior.actors.includes(actorTokenId))throw Error('initiative-original:current-distinct-next-original-required')
 const next=prepareDnd5eInitiativeOriginal({map:p.map,characters:p.characters,actorTokenId,scene:p.scene,rolls}),nextReceipt=(next as unknown as Record<symbol,object>)[slot],nextProof=issued.get(nextReceipt)!
 next.state=initiativeDataSnapshot(prior.state);nextProof.signature=JSON.stringify(next);nextProof.actors=[...prior.actors,actorTokenId];nextProof.events=initiativeDataSnapshot(prior.events);return next
}

export function resolvePreparedDnd5eInitiativeOriginal(input:{prepared:PreparedDnd5eInitiativeOriginal;halflingLuckyD20?:number;halflingLuckyD20Second?:number}){
 const p=input.prepared,receipt=(p as unknown as Record<symbol,unknown>)[slot],proof=receipt&&typeof receipt==='object'?issued.get(receipt):undefined
 if(!proof||proof.signature!==JSON.stringify(p)||proof.features.some(f=>JSON.stringify(dnd5ePluginFeatureDefinition(f.id))!==f.signature))throw Error('initiative-original:actual-unchanged-preparation-required')
 const current=resolveDnd5eHeadlessInitiativeOriginal({state:p.state,actorId:p.actorToken.id,character:p.actor,rolls:p.rolls,halflingLuckyD20:input.halflingLuckyD20,halflingLuckyD20Second:input.halflingLuckyD20Second})
 const resolved={...current,result:{...current.result,events:[...(proof.events??[]),...current.result.events]}}
 const actual={...resolved,...(resolved.result.ok?{application:planDnd5eMapResultApplication({map:p.map,characters:p.characters,state:resolved.result.state,events:[...resolved.result.events],characterIdByCombatantId:p.characterIdByCombatantId})}:{})}
 if(actual.result.ok)completed.set(actual,{signature:JSON.stringify(actual),prepared:p,actors:proof.actors??[p.actorToken.id],state:initiativeDataSnapshot(actual.result.state),events:initiativeDataSnapshot(actual.result.events)});return actual
}

type InitiativeOrder=Parameters<typeof createDnd5eMapCombatSnapshot>[0]['initiativeOrder']
const actualStarts=new WeakMap<object,{signature:string;prior:object}>()
/** Start from the actual completed initiative chain; caller state/results and
 * arbitrary resource deltas are not accepted. Initiative qualification itself
 * still used the real inactive empty-order state. */
export function prepareDnd5eInitiativeCombatStart(actual:object,order:InitiativeOrder){
 const prior=completed.get(actual);if(!prior||JSON.stringify(actual)!==prior.signature)throw Error('initiative-original:actual-unchanged-prior-required')
 const p=prior.prepared,receipt=(p as unknown as Record<symbol,object>)[slot],proof=issued.get(receipt)
 if(!proof||proof.signature!==JSON.stringify(p)||proof.features.some(f=>JSON.stringify(dnd5ePluginFeatureDefinition(f.id))!==f.signature))throw Error('initiative-original:current-original-required')
 const roster=p.map.tokens.filter(token=>token.type!=='obstacle'&&!token.dnd5eSimulacrum).map(token=>token.id),ids=order.map(row=>row.tokenId),slots=order.map(row=>row.slotId??row.tokenId)
 if(roster.length!==prior.actors.length||roster.some(id=>!prior.actors.includes(id))||!order.length||new Set(slots).size!==slots.length||roster.some(id=>!ids.includes(id))||ids.some(id=>!prior.state.combatants[id]))throw Error('initiative-original:complete-original-roster-required')
 const native=actual as ReturnType<typeof resolvePreparedDnd5eInitiativeOriginal>;if(!native.application)throw Error('initiative-original:actual-application-required')
 const map=initiativeDataSnapshot(native.application.map),characters=initiativeDataSnapshot(native.application.characters),started={...createDnd5eMapCombatSnapshot({combatId:p.scene.preparationId,round:1,map,characters,initiativeOrder:initiativeDataSnapshot(order)}),map,characters}
 // Adopt only the real prior Native turn state. The existing first-turn
 // resolver, rather than a new initiative reset, decides when it recovers.
 for(const[id,combatant]of Object.entries(started.state.combatants)){const before=prior.state.combatants[id];if(!before)throw Error('initiative-original:actual-same-roster-required');combatant.turn=initiativeDataSnapshot(before.turn)}
 actualStarts.set(started,{signature:JSON.stringify(started),prior:actual});return started
}
export function readPreparedDnd5eInitiativeCombatStart(value:object){const proof=actualStarts.get(value),prior=proof&&completed.get(proof.prior);if(proof)initiativeDataSnapshot(value);if(!proof||!prior||JSON.stringify(value)!==proof.signature||JSON.stringify(proof.prior)!==prior.signature)throw Error('initiative-original:actual-unchanged-start-required');return value as ReturnType<typeof prepareDnd5eInitiativeCombatStart>}

type InitiativeBeginContext={combatId:string;round:number;initiativeIndex:number;map:BattleMap;characters:readonly Character[];initiativeOrder:Parameters<typeof createDnd5eMapCombatSnapshot>[0]['initiativeOrder']}
const initiativeBeginSlot=Symbol('actual-initiative-first-begin-source');registerDnd5eHostReceiptSlot(initiativeBeginSlot)
const initiativeBegins=new WeakMap<object,object>()
/** A data DTO cannot construct this source. Registered Host cloning may keep
 * only the actual receipt issued from the completed Native initiative chain. */
export function withDnd5eInitiativeCombatStartForBegin<T extends InitiativeBeginContext>(input:T,start:object):T{
 const actual=readPreparedDnd5eInitiativeCombatStart(start);if(input.combatId!==actual.state.combatId||input.round!==1||input.initiativeIndex!==0||JSON.stringify(input.map)!==JSON.stringify(actual.map)||JSON.stringify(input.characters)!==JSON.stringify(actual.characters)||JSON.stringify(input.initiativeOrder.map(row=>({id:row.tokenId,slot:row.slotId??row.tokenId})))!==JSON.stringify(actual.state.initiativeOrder.map((id,index)=>({id,slot:actual.state.initiativeSlotIds?.[index]??id}))))throw Error('initiative-original:actual-same-begin-turn-required')
 const receipt=registerDnd5eHostReceipt(Object.freeze({})),source=cloneDnd5eHostTransactionInput(input);initiativeBegins.set(receipt,start);Object.defineProperty(source,initiativeBeginSlot,{value:receipt,enumerable:false});return source
}
export function readDnd5eInitiativeBeginTurnSource(input:InitiativeBeginContext){const receipt=Object.getOwnPropertyDescriptor(input,initiativeBeginSlot)?.value;if(receipt===undefined)return undefined;const start=receipt&&typeof receipt==='object'?initiativeBegins.get(receipt):undefined;if(!start)throw Error('initiative-original:actual-issued-begin-source-required');const actual=readPreparedDnd5eInitiativeCombatStart(start);if(input.combatId!==actual.state.combatId||input.round!==1||input.initiativeIndex!==0||JSON.stringify(input.map)!==JSON.stringify(actual.map)||JSON.stringify(input.characters)!==JSON.stringify(actual.characters)||JSON.stringify(input.initiativeOrder.map(row=>({id:row.tokenId,slot:row.slotId??row.tokenId})))!==JSON.stringify(actual.state.initiativeOrder.map((id,index)=>({id,slot:actual.state.initiativeSlotIds?.[index]??id}))))throw Error('initiative-original:actual-same-begin-turn-required');return actual}
