import{advanceDnd5ePluginAreasAtTurnBoundary,expireDnd5ePluginAreasAtTurnBoundary,reconcileDnd5ePluginAreasOnMap}from'../../application/combat/dnd5eCombatRules'
import{dnd5ePersistentAreaTurnCursor,planDnd5ePersistentAreaTurnTransition,settleDnd5ePersistentAreaTurnTransition}from'./persistentAreaTurnBoundary'
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../../rulesets/dnd5e/activities/dnd5eCoreSpellActivities'
import{readDnd5eActualBeginTurnResult,resolveDnd5eBeginTurn}from'../../application/combat/dnd5eCombatRules'
import type{settleDnd5eConcentrationChecks}from'./settleDnd5eCombatResult'
import{completeDnd5eCombatStartEconomies}from'./combatStartEconomies'
import type{InitiativeEntry}from'../../components/map/InitiativeTracker'
import{buildInitiativeOrder}from'../mapsPageHelpers'
import{prepareDnd5eInitiativeCombatStart,readPreparedDnd5eInitiativeCombatStart}from'../../application/combat/dnd5eCombatRules'
import{originalD20ReplaySourceKey}from'../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import{dnd5eAbilityCheckMode}from'../../rulesets/dnd5e/checks'
import{prepareDnd5eInitiativeOriginal,prepareDnd5eInitiativeOriginalContinuation,resolvePreparedDnd5eInitiativeOriginal,type PreparedDnd5eInitiativeOriginal}from'../../application/combat/dnd5eCombatRules'
import{createDnd5eAllyOriginalCollectionSession}from'../../rulesets/dnd5e/damageCommitSession'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{contentDefinitionRegistryRevision,listRegisteredContentDefinitionPackages}from'../../domain/content/contentDefinitionRegistry'
import{captureDnd5eSourceEnvelopeAutomationV1}from'../../rulesets/dnd5e/activities/dnd5eUnifiedContentRegistry'

type Names='characters'|'maps'|'combat'|'map-geometry'|'campaign-time'
const names:readonly Names[]=['characters','maps','combat','map-geometry','campaign-time']
type Session={roomId:string;memberId:string;role:string}
type Operation='begin'|'issue'|'qualify'|'answer'|'raw'|'confirm'|'replacement-raw'|'replacement-confirm'|'complete'|'project'|'list'
export interface BountifulInitiativeGateway{session():Session|null;loadResource<T>(name:string):Promise<T|null>;request<T>(operation:Operation,input:unknown):Promise<T>}
type Choice={ownerId:string;featureId:string;memberId:string;decision:'use'|'decline';at:number}
type Request={actorId:string;kind:'ability-check';originalRolls:readonly number[];dieIndex:number;options:readonly{ownerId:string;featureId:string}[]}
type Pool={memberId:string;values:readonly number[];at:number}
type Original={id:string;actorTokenId:string;characterId:string;memberId:string;mode:'normal'|'advantage'|'disadvantage';count:number;revision:number;raw?:Pool;confirmed?:Pool;request?:Request;featureSources?:Record<string,string>;controllers?:Record<string,{characterId:string;memberId:string}>;decisions:readonly Choice[];replacementRaw?:Pool;replacementConfirmed?:Pool;complete:boolean}
type Row={id:string;mapId:string;preparationId:string;roomId:string;hostMemberId:string;versions:Record<Names,number>;scope:string;roster:readonly{tokenId:string;characterId:string|null}[];createdAt:number;originals:readonly Original[];consumed?:unknown}
type Source=Record<Names,unknown>
type Native=ReturnType<typeof resolvePreparedDnd5eInitiativeOriginal>
type FeatureSource={id:string;signature:string;digest:string;current:()=>boolean}
type Issued={gateway:BountifulInitiativeGateway;session:Session;source:Source;map:BattleMap;characters:readonly Character[];row:Row;bookRevision:number;features:Map<string,FeatureSource>;registryRevision:number;lastRow?:Row}
const parents=new WeakMap<object,Issued>(),completed=new WeakMap<object,{parent:object;native:Native;signature:string;original:Original}>()
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,child])=>[key,stable(child)])):value
const signature=(value:unknown)=>JSON.stringify(stable(value))
const same=(a:unknown,b:unknown)=>signature(a)===signature(b)
const copy=<T>(value:T):T=>{const seen=new WeakSet<object>();function inspect(value:unknown){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){if(descriptor.get||descriptor.set||typeof descriptor.value==='function')throw Error('initiative-parent:actual-data-snapshot-required');if('value'in descriptor)inspect(descriptor.value)}if(value instanceof Map)for(const[key,child]of value){inspect(key);inspect(child)}if(value instanceof Set)for(const child of value)inspect(child)}inspect(value);return structuredClone(value)}
async function digest(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature(value)));return[...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')}
function host(g:BountifulInitiativeGateway){const session=g.session();if(!session||session.role!=='dm')throw Error('initiative-parent:actual-Host-required');return session}
function stillHost(issued:Issued){if(!same(host(issued.gateway),issued.session))throw Error('initiative-parent:Host-changed')}
async function source(g:BountifulInitiativeGateway){return Object.fromEntries(await Promise.all(names.map(async name=>[name,await g.loadResource(name)])))as Source}
async function current(parent:object){
 const issued=parents.get(parent);if(!issued)throw Error('initiative-parent:actual-issued-parent-required');stillHost(issued)
 const now=await source(issued.gateway);stillHost(issued);if(contentDefinitionRegistryRevision()!==issued.registryRevision||!same(now,issued.source)||[...issued.features.values()].some(feature=>!feature.current()||signature(dnd5ePluginFeatureDefinition(feature.id))!==feature.signature))throw Error('initiative-parent:original-world-or-source-changed')
 const response=await issued.gateway.request<{ok:boolean;preparation:Row;revision:number}>('project',{id:issued.row.id});stillHost(issued);const row=response.preparation
 if(!response.ok||!row||row.consumed||row.id!==issued.row.id||row.preparationId!==issued.row.preparationId||row.mapId!==issued.map.id||row.roomId!==issued.session.roomId||row.hostMemberId!==issued.session.memberId||!same(row.versions,issued.row.versions)||row.scope!==issued.row.scope||!same(row.roster,issued.row.roster)||!Number.isSafeInteger(response.revision)||response.revision<issued.bookRevision||issued.lastRow&&(!same({...issued.lastRow,originals:undefined},{...row,originals:undefined})||row.originals.length<issued.lastRow.originals.length))throw Error('initiative-parent:authenticated-current-preparation-required')
 if(issued.lastRow)for(let index=0;index<issued.lastRow.originals.length;index++){const old=issued.lastRow.originals[index],next=row.originals[index];if(!next||old.id!==next.id||next.revision<old.revision||old.complete&&!same(old,next)||old.raw&&!same(old.raw,next.raw)||old.confirmed&&!same(old.confirmed,next.confirmed)||old.request&&(!same(old.request,next.request)||!same(old.featureSources,next.featureSources)||!same(old.controllers,next.controllers))||old.decisions.length>next.decisions.length||!same(old.decisions,next.decisions.slice(0,old.decisions.length))||old.replacementRaw&&!same(old.replacementRaw,next.replacementRaw)||old.replacementConfirmed&&!same(old.replacementConfirmed,next.replacementConfirmed))throw Error('initiative-parent:protected-original-progress-changed')}
 issued.bookRevision=response.revision;issued.lastRow=copy(row);return{issued,row}
}
/** No prepared, result, map, character or caller state enters this issuer. */
export async function beginBountifulInitiativePreparation(input:{mapId:string;preparationId:string},gateway:BountifulInitiativeGateway){
 if(Object.keys(input).length!==2||!input.mapId||!input.preparationId)throw Error('initiative-parent:closed-identity-required');const session=host(gateway);
 // The genuine Page Base/registered-trigger route bootstraps this same built-in
 // catalog. Establish it before capturing the immutable original lifecycle.
 ensureDnd5eCoreSpellActivitiesRegisteredV1();const original=await source(gateway);if(!same(host(gateway),session))throw Error('initiative-parent:Host-changed')
 const maps=original.maps as{maps?:BattleMap[]}|null,characters=(original.characters as{characters?:Character[]}|null)?.characters,map=maps?.maps?.find(value=>value.id===input.mapId),combat=original.combat as{active?:boolean;flowPause?:unknown}|null
 if(!map||!characters||combat&&combat.active!==false||combat?.flowPause)throw Error('initiative-parent:actual-inactive-roster-required')
 const response=await gateway.request<{ok:boolean;preparation:Row;revision:number}>('begin',input);if(!response.ok||!response.preparation||response.preparation.scope!==await digest(original))throw Error('initiative-parent:authenticated-original-source-required')
 const cap=Object.freeze({}),issued:Issued={gateway,session,source:copy(original),map:copy(map),characters:copy(characters),row:copy(response.preparation),bookRevision:response.revision,features:new Map(),registryRevision:contentDefinitionRegistryRevision()};parents.set(cap,issued);await current(cap);return cap
}
export type BountifulInitiativeRollRequest={durableRollRequestId:string;rollerTokenId:string;rollerCharacterId:string;mode:'normal'|'advantage'|'disadvantage';count:number;sides:20;raw?:readonly number[];confirmed?:readonly number[]}
async function featureSources(issued:Issued,request:Request){
 for(const option of request.options){if(issued.features.has(option.featureId))continue;const feature=dnd5ePluginFeatureDefinition(option.featureId);if(!feature?.sourceFeatId||feature.declarativeAbility?.mechanic?.kind!=='ally-natural-one-reroll'||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id))throw Error('initiative-parent:actual-full-B-source-required')
  const local=(id:string)=>id.startsWith(feature.ownerPluginId+':')?id.slice(feature.ownerPluginId.length+1):id,definitions=listRegisteredContentDefinitionPackages().find(pkg=>pkg.packageId===feature.ownerPluginId)?.definitions.filter(definition=>{const payload=definition.payload as{id?:unknown}|undefined;return definition.kind==='feat'&&typeof payload?.id==='string'&&local(payload.id)===local(feature.sourceFeatId!)})??[];if(definitions.length!==1)throw Error('initiative-parent:actual-source-definition-required');const definition=definitions[0],capture=captureDnd5eSourceEnvelopeAutomationV1(feature.ownerPluginId,definition.kind,definition.id);if(!capture||capture()?.level!=='full')throw Error('initiative-parent:original-current-full-required');issued.features.set(feature.id,{id:feature.id,signature:signature(feature),digest:await digest(feature),current:()=>capture()?.level==='full'&&dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.id)})
 }
 return Object.fromEntries(request.options.map(option=>[option.featureId,issued.features.get(option.featureId)!.digest]))
}
type Replay={status:'resolved';native:Native;prepared:PreparedDnd5eInitiativeOriginal;original:Original}|{status:'waiting';original:Original}
async function replay(parent:object,targetId:string):Promise<Replay>{
 let prior:Native|undefined;const {issued,row}=await current(parent)
 for(const original of row.originals){if(!original.confirmed)throw Error('initiative-parent:actual-confirmed-original-required');const prepared=prior?prepareDnd5eInitiativeOriginalContinuation(prior,original.actorTokenId,original.confirmed.values):prepareDnd5eInitiativeOriginal({map:issued.map,characters:issued.characters,actorTokenId:original.actorTokenId,scene:{mapId:issued.map.id,active:false,preparationId:row.preparationId,phase:'combat-start'},rolls:original.confirmed.values}),session=createDnd5eAllyOriginalCollectionSession({prepared,hostOriginalD20Replay:{parentId:prepared.action.id,sourceKey:originalD20ReplaySourceKey(prepared.action.id,prepared.state,prepared.action,row.createdAt),effectTimestamp:row.createdAt,facts:[]}},resolvePreparedDnd5eInitiativeOriginal)
  try{let stage=session.run(prepared.state);if(stage.status==='pending-ally-natural-one'){
    if(stage.request.nativeLucky||stage.request.kind!=='ability-check'||stage.request.skill!==undefined)throw Error('initiative-parent:actual-initiative-B-checkpoint-required')
    const request:Request={actorId:stage.request.actorId,kind:'ability-check',originalRolls:stage.request.originalRolls,dieIndex:stage.request.dieIndex,options:stage.request.options},sources=await featureSources(issued,request)
    if(!original.request){if(original.complete)throw Error('initiative-parent:unrecorded-completed-checkpoint');const response=await issued.gateway.request<{ok:boolean}>('qualify',{id:row.id,originalId:original.id,request,featureSources:sources});if(!response.ok)throw Error('initiative-parent:authenticated-qualification-required');return replay(parent,targetId)}
    if(!same(request,original.request)||!same(sources,original.featureSources))throw Error('initiative-parent:Native-checkpoint-source-changed')
    const used=original.decisions.find(choice=>choice.decision==='use');if(used?!original.replacementConfirmed:original.decisions.length!==request.options.length)return{status:'waiting',original}
    stage=session.resumeAllyNaturalOne(prepared.state,stage.occurrence,stage.request,used?{ownerId:used.ownerId,featureId:used.featureId,replacement:original.replacementConfirmed!.values[0]}:undefined)
   }else if(original.request)throw Error('initiative-parent:recorded-checkpoint-not-reached')
   if(stage.status!=='resolved'||!stage.result.result.ok||!stage.result.application)throw Error('initiative-parent:actual-native-completion-required');prior=stage.result
   if(original.actorTokenId===targetId)return{status:'resolved',native:stage.result,prepared,original}
   if(!original.complete)throw Error('initiative-parent:actual-previous-original-complete-required')
  }finally{session.cancel()}
 }
 throw Error('initiative-parent:actual-original-not-issued')
}
/** The callbacks present physical UI only; their return values cannot author
 * raw/adoption records or bypass a real canonical helper owner choice. */
export async function collectBountifulInitiativeActor(parent:object,actorTokenId:string,runOriginal:(request:BountifulInitiativeRollRequest)=>Promise<readonly number[]>,runReplacement:(request:BountifulInitiativeRollRequest)=>Promise<readonly number[]>){
 const {issued}=await current(parent),token=issued.map.tokens.find(value=>value.id===actorTokenId),character=issued.characters.find(value=>value.id===token?.characterId);if(!token||!character)throw Error('initiative-parent:actual-character-source-required');const mode=dnd5eAbilityCheckMode(character,{initiative:true,ability:'dex'}),response=await issued.gateway.request<{ok:boolean}>('issue',{id:issued.row.id,actorTokenId,mode});if(!response.ok)throw Error('initiative-parent:authenticated-original-issue-required')
 for(let attempts=0;attempts<2400;attempts++){
  const {row}=await current(parent),original=row.originals.find(value=>value.actorTokenId===actorTokenId);if(!original)throw Error('initiative-parent:protected-original-required')
  if(!original.confirmed){const adopted=await runOriginal({durableRollRequestId:original.id,rollerTokenId:actorTokenId,rollerCharacterId:character.id,mode,count:original.count,sides:20,...(original.raw?{raw:original.raw.values}:{} )}),locked=(await current(parent)).row.originals.find(value=>value.id===original.id);if(!locked?.confirmed||!same(locked.confirmed.values,adopted))throw Error('initiative-parent:actual-original-adoption-required');continue}
  const stage=await replay(parent,actorTokenId);if(stage.status==='waiting'){
   if(stage.original.decisions.some(choice=>choice.decision==='use')&&!stage.original.replacementConfirmed){const adopted=await runReplacement({durableRollRequestId:'bountiful-initiative-replacement:'+await digest({id:original.id}),rollerTokenId:actorTokenId,rollerCharacterId:character.id,mode:'normal',count:1,sides:20,...(stage.original.replacementRaw?{raw:stage.original.replacementRaw.values}:{})}),locked=(await current(parent)).row.originals.find(value=>value.id===original.id);if(!locked?.replacementConfirmed||!same(locked.replacementConfirmed.values,adopted))throw Error('initiative-parent:actual-replacement-adoption-required')}
   else await new Promise<void>(resolve=>setTimeout(resolve,250));continue
  }
  if(!original.complete){const complete=await issued.gateway.request<{ok:boolean}>('complete',{id:row.id,originalId:original.id});if(!complete.ok)throw Error('initiative-parent:authenticated-completion-required')}await current(parent);const cap=Object.freeze({});completed.set(cap,{parent,native:stage.native,signature:signature(stage.native),original:copy(stage.original)});return cap
 }
 throw Error('initiative-parent:actual-original-still-pending')
}
export async function readBountifulInitiativeActorCompletion(cap:object){const value=completed.get(cap);if(!value||signature(value.native)!==value.signature)throw Error('initiative-parent:actual-unchanged-completion-required');const currentResult=await replay(value.parent,value.original.actorTokenId);if(currentResult.status!=='resolved'||signature(currentResult.native)!==value.signature)throw Error('initiative-parent:actual-completion-lineage-changed');return{parent:value.parent,actorTokenId:value.original.actorTokenId,initiative:copy(value.native.initiative),result:copy(value.native.result),application:copy(value.native.application)}}

type Genesis={entries:readonly InitiativeEntry[];native:Native;signature:string}
const orders=new WeakMap<object,Genesis>(),starts=new WeakMap<object,{parent:object;native:ReturnType<typeof prepareDnd5eInitiativeCombatStart>;order:readonly InitiativeEntry[]}>()
/** The normal builder retains shared summons, Simulacrum and Thief slots.
 * Concrete original results replace only its die calculation input. */
export async function prepareBountifulInitiativeOrder(parent:object){
 const {issued,row}=await current(parent),tokens=issued.map.tokens.filter(token=>token.type!=='obstacle'&&!token.dnd5eSimulacrum)
 if(tokens.some(token=>!token.characterId)||row.originals.length!==tokens.length||tokens.some(token=>!row.originals.some(original=>original.actorTokenId===token.id&&original.complete)))throw Error('initiative-parent:actual-complete-character-roster-required')
 const prior=orders.get(parent);if(prior)return copy(prior.entries)
 const values=new Map<string,{total:number;calculation:NonNullable<InitiativeEntry['initiativeCalculation']>}>();let last:Native|undefined
 for(const original of row.originals){const stage=await replay(parent,original.actorTokenId);if(stage.status!=='resolved')throw Error('initiative-parent:actual-whole-originals-required');const roll=stage.native.initiative.roll,used=original.decisions.find(choice=>choice.decision==='use'),rerolls=stage.native.result.events.filter(event=>event.type==='ally-natural-one-rerolled').filter(event=>event.targetId===original.actorTokenId&&event.rollKind==='ability-check');let retained=[...original.confirmed!.values];if(rerolls.length!==(used?1:0))throw Error('initiative-parent:actual-initiative-reroll-lineage-required');if(used){const event=rerolls[0];if(event.actorId!==used.ownerId||event.featureId!==used.featureId||!same(event.originalValues,retained)||event.replacement!==original.replacementConfirmed?.values[0])throw Error('initiative-parent:actual-initiative-reroll-lineage-required');retained=[...event.values]}values.set(original.actorTokenId,{total:roll.total,calculation:{rolls:retained,d20:roll.d20,modifier:roll.modifier,mode:roll.mode}});last=stage.native}
 if(!last)throw Error('initiative-parent:actual-whole-originals-required');const entries=buildInitiativeOrder([...issued.map.tokens],[...issued.characters],{combatId:row.preparationId,phase:'combat-start'},values);orders.set(parent,{entries:copy(entries),native:last,signature:signature(last)});return entries
}
export async function prepareBountifulInitiativeCombatStart(parent:object,order:readonly InitiativeEntry[]){
 await current(parent);await prepareBountifulInitiativeOrder(parent);const genesis=orders.get(parent)!,key=(entry:InitiativeEntry)=>entry.slotId??entry.tokenId
 if(order.length!==genesis.entries.length||new Set(order.map(key)).size!==order.length||order.some(entry=>!Number.isFinite(entry.roll)||!genesis.entries.some(before=>key(before)===key(entry)&&same({...before,roll:undefined},{...entry,roll:undefined}))))throw Error('initiative-parent:actual-original-slots-required')
 const last=(await current(parent)).row.originals.at(-1);if(!last)throw Error('initiative-parent:actual-complete-original-required');const actual=await replay(parent,last.actorTokenId);if(actual.status!=='resolved'||signature(actual.native)!==genesis.signature)throw Error('initiative-parent:whole-Native-source-changed');const native=prepareDnd5eInitiativeCombatStart(actual.native,order),cap=Object.freeze({});starts.set(cap,{parent,native,order:copy(order)});return cap
}
export async function readBountifulInitiativeCombatStart(cap:object){const issued=starts.get(cap);if(!issued)throw Error('initiative-parent:actual-issued-start-required');await current(issued.parent);const native=readPreparedDnd5eInitiativeCombatStart(issued.native);return{native,parent:issued.parent,initiativeOrder:copy(issued.order)}}

type FirstBase=Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>
const firstTurns=new WeakMap<object,{native:object;base:FirstBase;data:{result:FirstBase['result'];application:FirstBase['application']};signature:string}>()
/** Bound at the original common begin-turn/Base boundary, before local apply.
 * No submitted result or a copied mechanical map can issue this completion. */
export async function bindBountifulInitiativeFirstTurn(start:object,native:object,base:FirstBase){
 const initial=await readBountifulInitiativeCombatStart(start),{readDnd5eCompletedCombatBase}=await import('./settleDnd5eCombatResult'),facts=readDnd5eActualBeginTurnResult(native),input=facts.input,expected=initial.native
 if(facts.resolve!==resolveDnd5eBeginTurn||input.combatId!==expected.state.combatId||input.round!==1||input.initiativeIndex!==0||!same(input.map,expected.map)||!same(input.characters,expected.characters)||!same(input.initiativeOrder,initial.initiativeOrder))throw Error('initiative-parent:actual-same-first-turn-source-required')
 for(const[id,actor]of Object.entries(expected.state.combatants))if(!same(facts.prepared.state.combatants[id]?.turn,actor.turn))throw Error('initiative-parent:actual-carried-first-turn-cost-required')
 readDnd5eCompletedCombatBase(native,base);copy(base);const data=copy({result:base.result,application:base.application});
 // The healthy original-start domain has no asynchronous area/summon prefix.
 // Run the same official first-boundary clock/lifecycle before the sole CAS,
 // rather than leaving a refresh to publish a second combat result.
 if((data.application.map.dnd5ePluginAreas?.length??0)!==0||(data.application.map.dnd5eDelayedSummons?.length??0)!==0)throw Error('initiative-parent:unsettled-first-area-prefix-required')
 const cursor=dnd5ePersistentAreaTurnCursor({mapId:data.application.map.id,combatId:expected.state.combatId!,round:1,initiativeIndex:0,initiativeOrder:initial.initiativeOrder});if(!cursor)throw Error('initiative-parent:actual-first-turn-cursor-required')
 const transition=await settleDnd5ePersistentAreaTurnTransition({transition:planDnd5ePersistentAreaTurnTransition(null,cursor),initiativeOrder:initial.initiativeOrder,map:data.application.map,characters:data.application.characters,
  settleBoundary:async({boundary,map,characters})=>({map:advanceDnd5ePluginAreasAtTurnBoundary({map,...boundary}).map,characters:[...characters],logs:[]}),
  expireBoundary:({boundary,map,characters})=>reconcileDnd5ePluginAreasOnMap(expireDnd5ePluginAreasAtTurnBoundary({map,...boundary}),characters,boundary.round)})
 if(!same(transition.characters,data.application.characters)||transition.logs.length||transition.events.length||transition.initiativeEntries.length)throw Error('initiative-parent:unsettled-first-area-prefix-required')
 data.application.map=transition.map;firstTurns.set(start,{native,base,data,signature:signature(base)})
}
type Write={name:string;data:unknown;expectedRevision?:number}
type Publication={parent:object;start:object;writes:readonly Write[];options:{transactionId:string;undoLabel:string;readRevisions:Record<string,number>};signature:string;submitted:boolean}
const publications=new WeakMap<object,Publication>()
/** These are the existing original Host start writes, including the actual
 * first-turn settlement. The private book is an additional same-CAS witness,
 * never a supplied Native result or a replacement world state. */
export async function prepareBountifulInitiativePublication(start:object,worldWrites:readonly Write[]){
 const started=await readBountifulInitiativeCombatStart(start),{issued,row}=await current(started.parent),expected=['characters','maps','combat','dm-authority-ready'];const first=firstTurns.get(start),{readDnd5eCompletedCombatBase}=await import('./settleDnd5eCombatResult');if(!first)throw Error('initiative-parent:actual-first-turn-Base-required');copy(first.base);if(signature(first.base)!==first.signature)throw Error('initiative-parent:actual-first-turn-Base-required');readDnd5eActualBeginTurnResult(first.native);readDnd5eCompletedCombatBase(first.native,first.base);if(worldWrites.length!==4||new Set(worldWrites.map(write=>write.name)).size!==4||expected.some(name=>!worldWrites.some(write=>write.name===name)))throw Error('initiative-parent:original-four-start-writes-required')
 const charactersWrite=worldWrites.find(write=>write.name==='characters')?.data as{characters?:unknown}|undefined,mapsWrite=worldWrites.find(write=>write.name==='maps')?.data as{maps?:unknown}|undefined,combatWrite=worldWrites.find(write=>write.name==='combat')?.data as{dnd5eTurnEconomyByToken?:unknown;initiativeOrder?:unknown;combatId?:unknown;mapId?:unknown;round?:unknown;initiativeIndex?:unknown}|undefined
 const sourceMaps=(issued.source.maps as{maps:BattleMap[]}).maps,expectedMaps=sourceMaps.map(map=>map.id===issued.map.id?first.data.application.map:map),expectedEconomies=completeDnd5eCombatStartEconomies({state:first.data.result.state,initiativeOrder:started.initiativeOrder,existing:{},constrain:(_id,economy)=>economy})
 if(!same(charactersWrite?.characters,first.data.application.characters)||!same(mapsWrite?.maps,expectedMaps)||!same(combatWrite?.dnd5eTurnEconomyByToken,expectedEconomies)||!same(combatWrite?.initiativeOrder,started.initiativeOrder)||combatWrite?.combatId!==row.preparationId||combatWrite?.mapId!==row.mapId||combatWrite?.round!==1||combatWrite?.initiativeIndex!==0)throw Error('initiative-parent:actual-first-turn-world-required')
 const book=await issued.gateway.loadResource<{schemaVersion:1;parents:Record<string,Row>;_sync:{revision:number}}>('bountiful-initiative-originals'),ready=await issued.gateway.loadResource<{_sync?:{revision:number}}>('dm-authority-ready');if(!book||book._sync?.revision!==issued.bookRevision||!same(book.parents[row.id],row))throw Error('initiative-parent:actual-protected-start-book-required');await current(started.parent)
 const writes=worldWrites.map(write=>({...copy(write),expectedRevision:write.name==='dm-authority-ready'?ready?._sync?.revision??0:row.versions[write.name as Names]})),transactionId='combat-start:'+row.preparationId,next={...book,parents:{...book.parents,[row.id]:{...row,consumed:{transactionId,authorityRevision:book._sync.revision+1}}}};writes.push({name:'bountiful-initiative-originals',data:next,expectedRevision:book._sync.revision});const options={transactionId,undoLabel:'开始战斗',readRevisions:Object.fromEntries(Object.entries(row.versions).filter(([name])=>!writes.some(write=>write.name===name)))},cap=Object.freeze({});publications.set(cap,{parent:started.parent,start,writes,options,signature:signature({writes,options}),submitted:false});return cap
}
export async function publishBountifulInitiativeStart(cap:object,save:(writes:readonly Write[],options:{transactionId:string;undoLabel:string;readRevisions:Record<string,number>})=>Promise<unknown>){const issued=publications.get(cap);if(!issued||signature({writes:issued.writes,options:issued.options})!==issued.signature)throw Error('initiative-parent:actual-unchanged-publication-required');if(!issued.submitted)await readBountifulInitiativeCombatStart(issued.start);const first=firstTurns.get(issued.start),{readDnd5eCompletedCombatBase}=await import('./settleDnd5eCombatResult');if(!first)throw Error('initiative-parent:actual-first-turn-Base-required');copy(first.base);readDnd5eActualBeginTurnResult(first.native);readDnd5eCompletedCombatBase(first.native,first.base);if(signature(first.base)!==first.signature)throw Error('initiative-parent:actual-first-turn-Base-required');if(issued.submitted){const parent=parents.get(issued.parent);if(!parent)throw Error('initiative-parent:actual-issued-parent-required');stillHost(parent);const documents=await Promise.all(issued.writes.map(write=>parent.gateway.loadResource<Record<string,unknown>&{_sync?:{revision?:number}}>(write.name)));stillHost(parent);const withoutSync=(value:unknown)=>{const{_sync,...data}=value as Record<string,unknown>;void _sync;return data};if(documents.every((document,index)=>document&&typeof issued.writes[index].expectedRevision==='number'&&document._sync?.revision===issued.writes[index].expectedRevision!+1&&same(withoutSync(document),withoutSync(issued.writes[index].data))))return{status:'committed',transactionId:issued.options.transactionId};await readBountifulInitiativeCombatStart(issued.start)}issued.submitted=true;return save(copy(issued.writes),copy(issued.options))}

/** Detached actual first-turn data, never an issuer from caller state. */
export async function readBountifulInitiativeFirstTurn(start:object){await readBountifulInitiativeCombatStart(start);const first=firstTurns.get(start);if(!first)throw Error('initiative-parent:actual-first-turn-Base-required');copy(first.base);readDnd5eActualBeginTurnResult(first.native);const{readDnd5eCompletedCombatBase}=await import('./settleDnd5eCombatResult');readDnd5eCompletedCombatBase(first.native,first.base);if(signature(first.base)!==first.signature)throw Error('initiative-parent:actual-first-turn-Base-required');return copy(first.data)}
