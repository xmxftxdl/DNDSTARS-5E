import type{Dnd5ePluginSpellCompoundInput}from'../../rulesets/dnd5e/pluginSpellCompoundNative'
import{createDnd5ePluginSpellCompoundPrimaryAnsweredCollector}from'../../rulesets/dnd5e/pluginSpellCompoundPrimaryAnswered'
import{captureDnd5ePluginSpellCompoundPrimaryPendingQualification,readDnd5ePluginSpellCompoundPrimaryPendingQualification,type Dnd5ePluginSpellCompoundPrimaryPendingQualification}from'../../rulesets/dnd5e/pluginSpellCompoundPrimaryPendingQualification'
import{captureDnd5ePluginSpellCompoundPrimaryAnsweredQualification}from'../../rulesets/dnd5e/pluginSpellCompoundPrimaryAnsweredQualification'
import{captureDnd5ePluginSpellCompoundAnsweredPrimaryQualification}from'../../rulesets/dnd5e/pluginSpellCompoundQualification'
import{persistBountifulOriginalParent}from'../../rulesets/dnd5e/bountifulLuckPersistentHost'
import{decisionFromBountifulOriginalDieReceipt,type BountifulOriginalDieReceipt}from'../../rulesets/dnd5e/bountifulLuckReceipt'
import type{ActivityEffectOriginalPool}from'../../rulesets/dnd5e/activities/activityEffectOriginalMissing'
import{getRegisteredDnd5eActivity}from'../../rulesets/dnd5e/activities/dnd5eActivityRegistry'
import{createDnd5ePluginSpellCompoundPrimaryObserver}from'../../rulesets/dnd5e/pluginSpellCompoundPrimaryOperation'
import{captureDnd5ePluginSpellCompoundPrimaryQualification,createDnd5ePluginSpellCompoundQualifiedSource}from'../../rulesets/dnd5e/pluginSpellCompoundQualification'
import{dnd5eAvailableTempestuousSpellFlight}from'../../application/combat/dnd5eCombatRules'
import{dnd5ePluginFeatureDefinition,dnd5ePluginFeatureCurrentEnvelopeFullV1}from'../../rulesets/dnd5e/plugins/pluginContentCatalog'
import{resolvePreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{createBountifulPluginSpellCompoundPrimaryRaw,readBountifulPluginSpellSavingOriginalDiceRoute,type BountifulPluginSpellSavingOriginalDiceRoute}from'./bountifulPluginSpellSavingOriginalRaw'
import{decodeSecondChanceParentWire,encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{BountifulPluginSpellCompoundPrimaryBook}from'../../ports/dnd5ePluginSpellCompoundPrimaryTransport'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
type Source=Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]
type Identity={parentId:string;mapId:string;combatId:string}
type Loader=(id:Identity)=>Promise<BountifulPluginSpellCompoundPrimaryBook>
const signature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const base=(source:Source)=>signature({...source,rolls:undefined})
export function canObserveBountifulPluginSpellCompoundPrimary(p:Source['prepared']){return p.activity?.id==='ice-knife-cast'&&p.activity.checks?.length===1&&p.activity.checks[0].kind==='attack-roll'&&p.targets.length===1&&p.state.active&&!p.ritual&&!dnd5eAvailableTempestuousSpellFlight(p.state,p.actorToken.id).length&&Object.values(p.state.combatants).some(actor=>actor.turn.reactionAvailable&&actor.pluginFeatureIds.some(id=>{const feature=dnd5ePluginFeatureDefinition(id);return feature?.automation==='full'&&dnd5ePluginFeatureCurrentEnvelopeFullV1(id)&&feature.declarativeAbility?.mechanic?.kind==='ally-natural-one-reroll'}))}
/** A real pending main attack is not a ready primary and never falls through
 * to a burst, replacement array, invalid-dice result or world publication. */
type ActualPrimaryPending=Extract<ReturnType<ReturnType<typeof createDnd5ePluginSpellCompoundPrimaryObserver>['run']>,{status:'pending-ally-natural-one'}>
export class BountifulPluginSpellCompoundPrimaryPending extends Error{readonly stage:ActualPrimaryPending;constructor(stage:ActualPrimaryPending){super('ice-knife-primary:actual-attack-b-or-own-still-pending');this.stage=stage}}

export function createBountifulPluginSpellCompoundPrimaryRoom(input:{source:Source;gateway:Pick<SharedRoomGatewayPort,'publishEvent'>&Partial<Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'|'loadBountifulPluginSpellSavingOriginalSource'>>;load:Loader;settlePending?:(pending:{parentId:string;source:Source;qualification:Dnd5ePluginSpellCompoundPrimaryPendingQualification})=>Promise<void>;rollPrimaryEffect?:(recipe:ActivityEffectOriginalPool['rolls'][number],owner:{parentId:string;actorId:string;activityId:string;transactionId:string})=>Promise<readonly number[]>;roll:(spec:Awaited<ReturnType<typeof readBountifulPluginSpellSavingOriginalDiceRoute>>,route:BountifulPluginSpellSavingOriginalDiceRoute)=>Promise<readonly number[]>}){
 const source=cloneDnd5eHostTransactionInput(input.source),id={parentId:source.prepared.action.id,mapId:source.prepared.map.id,combatId:source.prepared.state.combatId},workers=new Set<ReturnType<typeof createDnd5ePluginSpellCompoundPrimaryObserver>>(),answeredWorkers=new Set<ReturnType<typeof createDnd5ePluginSpellCompoundPrimaryAnsweredCollector>>();let closed=false
 const guard=()=>{if(closed)throw Error('ice-knife-primary:current-live-room-required')},optional=async()=>{try{return await input.load(id)}catch(error){if(error instanceof Error&&error.message==='ice-knife-primary:current-private-primary-required')return undefined;throw error}}
 const worker=(actual:Source)=>{guard();const value=createDnd5ePluginSpellCompoundPrimaryObserver(actual);workers.add(value);return value}
 return{preserveEmptyIntent(prepared:Source['prepared']){
  guard();const action=prepared.activityHeadlessAction,activity=prepared.activity,record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null),empty=(value:unknown)=>value===undefined||record(value)&&Object.keys(value).length===0,list=(value:unknown)=>value===undefined||Array.isArray(value)&&value.length===0
  if(prepared.action.id!==source.prepared.action.id||action?.pluginId!==source.prepared.activityHeadlessAction?.pluginId||action?.actionId!=='ice-knife-cast'||!activity||activity.id!=='ice-knife-cast'||signature(activity)!==signature(getRegisteredDnd5eActivity(action.pluginId,action.actionId))||activity.target.kind!=='creature'||activity.target.requiresWilling||activity.choices?.length||activity.checks?.length!==1||activity.checks[0].kind!=='attack-roll'||prepared.targets.length!==1||prepared.payload.activityTargetFormIds!==undefined||!empty(prepared.payload.activityChoices)||!list(prepared.payload.activityWillingTargetIds))return false
  const prior=action.payload;if(prior!==undefined&&!record(prior))return false;const data=prior as Record<string,unknown>|undefined
  return data?.activityTargetFormIds===undefined&&empty(data?.activityChoices)&&list(data?.activityWillingTargetIds)
 },async collect(declaration:{id:string;count:number;sides:number;rollerTokenId?:string;d20RollMode?:string},label:string){guard();let book=await optional(),current=book?decodeSecondChanceParentWire(book.source)as Source:source;const native=worker(current),stage=native.run();if(stage.status==='pending-ally-natural-one')throw new BountifulPluginSpellCompoundPrimaryPending(stage);if(stage.status==='original-d20-ready'&&book){const row=book.rows[0];if(!row.confirmed||row.rollId!==declaration.id||row.actorId!==declaration.rollerTokenId||row.count!==declaration.count||row.sides!==declaration.sides||row.mode!==(declaration.d20RollMode??'normal')||signature(stage.request.originalRolls)!==signature(row.confirmed.values))throw Error('ice-knife-primary:exact-existing-original-required');return[...row.confirmed.values]}
  if(stage.status!=='missing-activity-attack-original'||stage.request.rollId!==declaration.id||stage.request.actorId!==declaration.rollerTokenId||stage.request.count!==declaration.count||stage.request.sides!==declaration.sides||stage.request.mode!==(declaration.d20RollMode??'normal'))throw Error('ice-knife-primary:actual-page-primary-declaration-required')
  if(book?.rows[0]?.confirmed){const row=book.rows[0];if(book.rows.length!==1||!row.confirmed||!row.raw||row.rollId!==stage.request.rollId||row.actorId!==stage.request.actorId||row.targetId!==stage.request.targetId||row.mode!==stage.request.mode||row.count!==stage.request.count||row.sides!==stage.request.sides||row.confirmed.memberId!==book.hostMemberId||row.raw.memberId!==row.memberId||[row.raw.values,row.confirmed.values].some(values=>values.length!==row.count||values.some(value=>!Number.isInteger(value)||value<1||value>20)))throw Error('ice-knife-primary:exact-current-adopted-slot-required');return[...row.confirmed.values]}
  const raw=await createBountifulPluginSpellCompoundPrimaryRaw(native.operation(stage),input.gateway,input.load,label);try{const spec=await readBountifulPluginSpellSavingOriginalDiceRoute(raw.route),values=spec.values??await input.roll(spec,raw.route),adopted=await readBountifulPluginSpellSavingOriginalDiceRoute(raw.route);guard();if(!adopted.rawValues||!adopted.values||signature(values)!==signature(adopted.values))throw Error('ice-knife-primary:actual-pc-raw-host-adoption-required');return[...adopted.values]}finally{raw.close()}
 },async qualify(candidate:Source,combatRevision:number){guard();const book=await input.load(id);guard();const current={...candidate,now:book.effectTimestamp};if(base(current)!==base(decodeSecondChanceParentWire(book.source)as Source))throw Error('ice-knife-primary:changed-page-non-dice-source');const native=worker(current),stage=native.run();if(stage.status==='pending-ally-natural-one'){
  if(!input.settlePending||!input.gateway.loadResource||!input.gateway.saveResourcesAtomically)throw new BountifulPluginSpellCompoundPrimaryPending(stage)
  const gateway={publishEvent:input.gateway.publishEvent,loadResource:input.gateway.loadResource,saveResourcesAtomically:input.gateway.saveResourcesAtomically},answered=createDnd5ePluginSpellCompoundPrimaryAnsweredCollector(current)
  answeredWorkers.add(answered)
  const savedBook=await(async()=>{if(!input.gateway.loadBountifulPluginSpellSavingOriginalSource)return;try{return await input.gateway.loadBountifulPluginSpellSavingOriginalSource(id)}catch(error){if(error instanceof Error&&error.message==='plugin-spell-saving-original:current-private-book-required')return;throw error}})();guard()
  const saved=savedBook?decodeSecondChanceParentWire(savedBook.source)as Dnd5ePluginSpellCompoundInput:undefined
  if(savedBook){if(!savedBook.primaryAnchor||signature(savedBook.primaryAnchor.book)!==signature(book)||!saved?.compound||savedBook.parentId!==id.parentId||savedBook.mapId!==id.mapId||savedBook.combatId!==id.combatId||savedBook.effectTimestamp!==book.effectTimestamp)throw Error('ice-knife-primary:exact-private-saving-primary-anchor-required');const{compound:_compound,...original}=saved;if(base(original)!==base(current))throw Error('ice-knife-primary:unchanged-private-saving-non-dice-source-required')}
  const witnessed:BountifulOriginalDieReceipt[]=[]
  let next=answered.run()
  if(next.status!=='pending-ally-natural-one')throw Error('ice-knife-primary:actual-current-first-checkpoint-required')
  const qualification=captureDnd5ePluginSpellCompoundPrimaryPendingQualification(answered.pending(next),book),facts=readDnd5ePluginSpellCompoundPrimaryPendingQualification(qualification)
  const combat=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat');guard()
  if(!combat?.bountifulOriginalParents?.[JSON.stringify(['bountiful-original-parent',id.parentId,0])])await persistBountifulOriginalParent({parentId:id.parentId,source:facts.source,resolve:resolvePreparedDnd5ePluginSpellCast,actorId:facts.request.actorId,kind:'attack',pluginSpellCompoundPrimaryOriginalQualification:qualification},gateway)
  await input.settlePending({parentId:id.parentId,source:facts.source,qualification});guard()
  const after=await gateway.loadResource<{bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}>('combat'),receipts=Object.values(after?.bountifulOriginalParents??{}).filter(receipt=>receipt.identity.parentId===id.parentId).sort((a,b)=>a.identity.occurrence-b.identity.occurrence)
  for(let turn=0;turn<64;turn++){
   guard()
   if(next.status==='pending-ally-natural-one'){
    const pending=next,receipt=receipts.find(receipt=>receipt.identity.occurrence===pending.occurrence)
    if(!receipt||receipt.identity.effectTimestamp!==book.effectTimestamp||!receipt.rawIssuer||receipt.rawIssuer.rollId!==book.rows[0].requestId||receipt.rawIssuer.cursor!==1||receipt.request.kind!=='attack')throw Error('ice-knife-primary:actual-authenticated-answer-required')
    const decision=decisionFromBountifulOriginalDieReceipt(receipt,pending.request),option=decision&&pending.request.options.find(option=>option.ownerId===decision.ownerId&&option.featureId===decision.featureId)
    if(decision&&!option)throw Error('ice-knife-primary:actual-current-native-option-required')
    if(pending.occurrence!==witnessed.length)throw Error('ice-knife-primary:actual-contiguous-attack-prefix-required')
    witnessed.push(receipt);next=answered.answer(pending,option,decision?.replacement);continue
   }
   if(next.status==='missing-primary-effect-original'){
    if((!saved&&!input.rollPrimaryEffect)||next.request.rolls.length!==1||!next.request.actorId||!next.request.activityId||!next.request.transactionId)throw Error('ice-knife-primary:actual-original-effect-presenter-required')
    const recipe=next.request.rolls[0],retained=saved?.compound.primaryInputRolls?.activityRolls?.[recipe.rollId]
    if(saved&&(!retained||Object.keys(retained).sort().join(',')!=='modifier,total,values'||retained.modifier!==recipe.modifier||retained.values.length!==recipe.count||retained.values.some(value=>!Number.isInteger(value)||value<1||value>recipe.sides)||retained.total!==retained.values.reduce((a,b)=>a+b,recipe.modifier)))throw Error('ice-knife-primary:exact-private-main-formula-required')
    const values=retained?[...retained.values]:await input.rollPrimaryEffect!(recipe,{parentId:id.parentId,actorId:next.request.actorId,activityId:next.request.activityId,transactionId:next.request.transactionId});guard()
    next=answered.supplyEffect(next,recipe.rollId,values);continue
   }
   if(next.status!=='original-d20-ready')throw Error('ice-knife-primary:actual-answered-ready-required')
   const fresh=await input.load(id);guard();if(signature(fresh)!==signature(book))throw Error('ice-knife-primary:unchanged-private-book-required')
   const answeredQualification=captureDnd5ePluginSpellCompoundPrimaryAnsweredQualification(answered.ready(next),fresh,witnessed),primary=captureDnd5ePluginSpellCompoundAnsweredPrimaryQualification(answeredQualification)
   const qualified=createDnd5ePluginSpellCompoundQualifiedSource(primary,saved?.compound.combatRevision??combatRevision)
   if(saved&&signature(qualified.source.compound)!==signature(saved.compound))throw Error('ice-knife-primary:exact-rebuilt-private-compound-header-required')
   return qualified
  }
  throw Error('ice-knife-primary:bounded-actual-answer-sequence-required')
 }if(stage.status!=='original-d20-ready')throw Error('ice-knife-primary:actual-ready-after-primary-required');const primary=captureDnd5ePluginSpellCompoundPrimaryQualification(native.operation(stage),book);return createDnd5ePluginSpellCompoundQualifiedSource(primary,combatRevision)},close(){if(!closed){closed=true;for(const value of workers)value.close();for(const value of answeredWorkers)value.close()}}}
}
