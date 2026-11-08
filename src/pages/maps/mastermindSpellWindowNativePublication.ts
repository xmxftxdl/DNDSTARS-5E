import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{SharedCombatState,SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{SharedResourceTransactionWrite,saveSharedResourcesAtomically}from'../../lib/sharedApi'
import{readMastermindSpellWindowCompleted,type MastermindSpellWindowGateway}from'./mastermindSpellWindowParent'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'../../rulesets/dnd5e/turnEconomy'
import{dnd5eHeadlessTurnKey}from'../../rulesets/dnd5e/headlessCombatEngine'
type Gateway=MastermindSpellWindowGateway&{saveResourcesAtomically:typeof saveSharedResourcesAtomically}
type View=Awaited<ReturnType<typeof readMastermindSpellWindowCompleted>>
type Row=View['owners'][number]['row']
type Doc<T>=T&{_sync?:{revision?:number}}
const ordered=(v:unknown):unknown=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,n])=>[k,ordered(n)])):v,sig=(v:unknown)=>JSON.stringify(ordered(v)),same=(a:unknown,b:unknown)=>sig(a)===sig(b),resource='mastermind-misdirections'
const plans=new WeakMap<object,{completed:object;view:View;gateway:Gateway;expected:Record<string,unknown>;writes:SharedResourceTransactionWrite[];signature:string;transactionId:string}>()
/** The journal is consumed only with this actual whole native/Base result.
 * Authenticated input completion alone never issues this plan. */
export async function prepareMastermindSpellWindowNativePublication(completed:object,gateway:Gateway){
 const view=await readMastermindSpellWindowCompleted(completed)
 return prepareNativePublicationFromFreshView(completed,view,gateway)
}
/** Page action identity and the plan use this call's single completed read.
 * The view stays private; publication still performs its own fresh validation. */
export async function prepareMastermindSpellWindowNativePagePublication(completed:object,action:SharedPlayerActionState,gateway:Gateway){
 const view=await readMastermindSpellWindowCompleted(completed),{current}=view
 if(action.id!==current.p.action.id||action.mapId!==current.p.map.id||action.actorTokenId!==current.p.actorToken.id||action.type!=='dnd5e-spell-cast'||action.sourceMode!==(current.parent.source.origin==='native'?'dm':'player'))throw Error('spell-window-page-publication:same-actual-original-required')
 return prepareNativePublicationFromFreshView(completed,view,gateway)
}
async function prepareNativePublicationFromFreshView(completed:object,view:View,gateway:Gateway){
 const {current}=view,session=gateway.session();if(current.parent.source.origin!=='native')throw Error('spell-window-publication:native-original-required');if(session?.role!=='dm'||session.roomId!==current.session.roomId||session.memberId!==current.session.memberId)throw Error('spell-window-publication:current-Host-original-required')
 const[journal,characters,maps,combat,queue]=await Promise.all([gateway.loadResource<Doc<{parents:Record<string,Row>}>>(resource),gateway.loadResource<Doc<{characters:Character[]}>>('characters'),gateway.loadResource<Doc<{maps:BattleMap[]}>>('maps'),gateway.loadResource<Doc<SharedCombatState>>('combat'),gateway.loadResource<Doc<{requests:{id:string}[]}>>('player-action-requests')]);const revision=journal?._sync?.revision??(journal==null?0:undefined);
 if((view.owners.length>0&&!journal)||revision!==view.journalRevision||!Number.isSafeInteger(revision)||!characters||characters._sync?.revision!==current.versions.characters||!maps||maps._sync?.revision!==current.versions.maps||!combat||combat._sync?.revision!==current.versions.combat||combat.mapId!==current.p.map.id||queue?.requests.some(a=>a.id===current.p.action.id)||view.owners.some(({row})=>!same(journal?.parents[row.id],row)))throw Error('spell-window-publication:same-current-original-required')
 const transactionId='mastermind-native-spell-window:'+current.parent.id,authorityRevisions={characters:current.versions.characters+1,maps:current.versions.maps+1,combat:current.versions.combat+1,[resource]:revision+1},expected=Object.fromEntries(view.owners.map(({row})=>[row.id,{...row,phase:'consumed',revision:row.revision+1,nativePublication:{transactionId,authorityRevisions}}])),economies={...combat.dnd5eTurnEconomyByToken};for(const[id,actor]of Object.entries(view.base.result.state.combatants))economies[id]=projectDnd5eHeadlessTurnEconomy(economies[id]??createDnd5eTurnEconomyCounts(dnd5eHeadlessTurnKey(view.base.result.state,id),actor.speed),actor.turn,actor.speed)
 const writes:SharedResourceTransactionWrite[]=[{name:'characters',expectedRevision:current.versions.characters,data:{...characters,characters:view.base.application.characters}},{name:'maps',expectedRevision:current.versions.maps,data:{...maps,maps:maps.maps.map(m=>m.id===current.p.map.id?view.base.application.map:m)}},{name:'combat',expectedRevision:current.versions.combat,data:{...combat,dnd5eTurnEconomyByToken:economies}},...(view.owners.length?[{name:resource,expectedRevision:revision,data:{...journal,parents:{...journal!.parents,...expected}}}]:[])];const cap=Object.freeze({});plans.set(cap,{completed,view,gateway,expected,writes,signature:sig(writes),transactionId});return cap
}
export async function publishMastermindSpellWindowNative(cap:object){
 const plan=plans.get(cap);if(!plan||sig(plan.writes)!==plan.signature)throw Error('spell-window-publication:actual-fixed-plan-required');const session=plan.gateway.session();if(session?.role!=='dm'||session.roomId!==plan.view.current.session.roomId||session.memberId!==plan.view.current.session.memberId)throw Error('spell-window-publication:current-Host-required')
 const committed=async()=>{
  if(plan.view.owners.length){const journal=await plan.gateway.loadResource<{parents:Record<string,unknown>}>(resource);return Object.entries(plan.expected).every(([id,row])=>same(journal?.parents[id],row))}
  // No owner row exists to consume. Require all three fixed world writes at
  // their precise next revisions and full payloads, never an empty every().
  if(plan.writes.length!==3||plan.writes.some(write=>!['characters','maps','combat'].includes(write.name)))return false
  const docs=await Promise.all(plan.writes.map(write=>plan.gateway.loadResource<Doc<Record<string,unknown>>>(write.name)))
  return plan.writes.every((write,index)=>{const doc=docs[index];if(!doc||doc._sync?.revision!==write.expectedRevision!+1)return false;const {_sync:actualSync,...actual}=doc,{_sync:priorSync,...expected}=write.data as Record<string,unknown>;void actualSync;void priorSync;return same(actual,expected)})
 };if(await committed())return;const current=await readMastermindSpellWindowCompleted(plan.completed);if(!same(current.current.versions,plan.view.current.versions)||!same(current.base.result,plan.view.base.result)||!same(current.base.application,plan.view.base.application))throw Error('spell-window-publication:original-changed')
 try{await plan.gateway.saveResourcesAtomically(plan.writes,{transactionId:plan.transactionId,readRevisions:{'map-geometry':current.current.versions['map-geometry'],'campaign-time':current.current.versions['campaign-time'],'player-action-requests':current.current.queueRevision,...(!current.owners.length?{[resource]:current.journalRevision}:{})}})}catch(error){if(!await committed())throw error}if(!await committed())throw Error('spell-window-publication:committed-original-required')
}
