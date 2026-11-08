import{dnd5eAbilityCheckRollMode}from'../../rulesets/dnd5e/headlessCombatEngine'
import{resolvePreparedDnd5ePluginSpellCast,type Dnd5ePluginSpellResolution,type PreparedDnd5ePluginSpellCast}from'../../rulesets/dnd5e/pluginSpellTransaction'
import{captureSoulOfDeceitReading,resolveSoulOfDeceitReading,withSoulOfDeceitReadingPermissionAsync}from'../../rulesets/dnd5e/mastermindSoulOfDeceit'
import{readMastermindThoughtContestOriginal,readMastermindThoughtAnsweredOriginal,type MastermindThoughtGateway,type MastermindThoughtOriginal}from'./mastermindThoughtReadingParent'
import{dnd5eActivityWithSoulThoughtPolicy}from'../../rulesets/dnd5e/activities/dnd5eActivitySoulThoughtPolicy'
import{registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot}from'../../rulesets/dnd5e/hostTransactionClone'
import{readDnd5eCompletedCombatBase, type settleDnd5eConcentrationChecks}from'./settleDnd5eCombatResult'

type Role='owner'|'reader'
type View=Awaited<ReturnType<typeof readMastermindThoughtContestOriginal>>
const signature=(value:unknown)=>JSON.stringify(value)
const specs=(view:View)=>[
 {role:'owner' as const,tokenId:view.row.ownerTokenId,ability:'cha' as const,skill:'deception'},
 {role:'reader' as const,tokenId:view.row.readerTokenId,ability:'wis' as const,skill:'insight'},
].map(spec=>({...spec,mode:dnd5eAbilityCheckRollMode(view.prepared.state.combatants[spec.tokenId],{ability:spec.ability,skill:spec.skill,state:view.prepared.state})}))
function requests(view:View){return view.row.rollRequests??{}}
function rawValues(value:unknown,count:number):value is number[]{return Array.isArray(value)&&value.length===count&&value.every(v=>Number.isInteger(v)&&v>=1&&v<=20)}

/** Modes and roles come from the actual native original, never a player form. */
export async function issueMastermindThoughtContestRolls(original:MastermindThoughtOriginal,g:MastermindThoughtGateway){
 const view=await readMastermindThoughtContestOriginal(original,g)
 for(const spec of specs(view)){if(!view.scopeCurrent())throw Error('thought-contest:current-host-required');await g.request('issue-roll',{id:view.journalId,role:spec.role,mode:spec.mode})}
 return specs(view).map(spec=>({role:spec.role,parentId:view.journalId,requestId:view.journalId+':'+spec.role}))
}
export interface MastermindThoughtContestPrefix{readonly mastermindThoughtContestPrefix:unique symbol}
type Contest=Extract<ReturnType<typeof resolveSoulOfDeceitReading>,{kind:'false-thoughts-permitted'|'blocked';ownerTotal:number}>
const resolvedOriginals=new WeakMap<object,{original:MastermindThoughtOriginal;prefix?:MastermindThoughtContestPrefix;signature:string;kind:'false-thoughts'|'blocked'|'real-consent'}>()
const nativeValues=new WeakMap<object,Dnd5ePluginSpellResolution>()
const productionSlot=Symbol('mastermind-thought-original');registerDnd5eHostReceiptSlot(productionSlot)
function markProductionPrepared(prepared:PreparedDnd5ePluginSpellCast){const token=registerDnd5eHostReceipt(Object.freeze({}));Object.defineProperty(prepared,productionSlot,{value:token,configurable:true});return token}
function sameProductionPrepared(prepared:PreparedDnd5ePluginSpellCast,original:PreparedDnd5ePluginSpellCast,token:object){return Object.getOwnPropertyDescriptor(prepared,productionSlot)?.value===token&&signature(prepared)===signature(original)}
const prefixes=new WeakMap<object,{original:MastermindThoughtOriginal;stateSignature:string;rawSignature:string;sourceSignature:string;contest:Contest;view:View}>()

function confirmedChecks(view:View){
 const rows=requests(view),result:Partial<Record<Role,{d20:number;d20Second?:number}>>={}
 for(const spec of specs(view)){
  const row=rows[spec.role],count=spec.mode==='normal'?1:2,characterId=view.prepared.characterIdByCombatantId[spec.tokenId]
  if(!row?.raw||!row.confirmed)return undefined
  if(row.id!==view.journalId+':'+spec.role||row.role!==spec.role||row.tokenId!==spec.tokenId||row.characterId!==characterId||row.mode!==spec.mode||row.count!==count||row.sides!==20||!row.controllerMemberId||row.raw.memberId!==row.controllerMemberId||row.raw.sourceMode!==(row.controllerMemberId===view.row.hostMemberId?'dm':'player')||row.confirmed.memberId!==view.row.hostMemberId||!rawValues(row.raw.values,count)||!rawValues(row.confirmed.values,count))throw Error('thought-contest:authenticated-issued-pool-required')
  result[spec.role]={d20:row.confirmed.values[0],...(count===2?{d20Second:row.confirmed.values[1]}:{})}
 }
 if(!result.owner||!result.reader)return undefined;return{owner:result.owner,reader:result.reader}
}

/** This factory executes the real native opposed checks, including skill
 * proficiency, expertise, Reliable Talent and currently supplied native effects.
 * It publishes no HP, effect, resource, ACK or journal-consumption write. */
export async function prepareMastermindThoughtContestPrefix(original:MastermindThoughtOriginal,g:MastermindThoughtGateway):Promise<MastermindThoughtContestPrefix|undefined>{
 const view=await readMastermindThoughtContestOriginal(original,g),rolls=confirmedChecks(view)
 if(!rolls)return undefined
 const reading=captureSoulOfDeceitReading(view.prepared.state,{parentId:view.parentId,ownerId:view.row.ownerTokenId,readerId:view.row.readerTokenId,scopeCurrent:view.scopeCurrent})
 if(!reading)throw Error('thought-contest:current-native-source-required')
 const contest=resolveSoulOfDeceitReading(reading,{parentId:view.parentId,choice:'present-false-thoughts',ownerCheck:rolls.owner,readerCheck:rolls.reader})
 if(!('ownerTotal'in contest)||!('readerTotal'in contest))throw Error('thought-contest:actual-opposed-result-required')
 const token=Object.freeze({})as MastermindThoughtContestPrefix
 prefixes.set(token,{original,stateSignature:signature(view.prepared.state),rawSignature:signature(requests(view)),sourceSignature:view.row.sourceDefinitionSignature,contest,view})
 return token
}
async function current(original:MastermindThoughtOriginal,token:MastermindThoughtContestPrefix,g:MastermindThoughtGateway){
 const prefix=prefixes.get(token)
 if(!prefix||prefix.original!==original)throw Error('thought-contest:issued-prefix-required')
 const view=await readMastermindThoughtContestOriginal(original,g)
 if(!view.scopeCurrent()||prefix.stateSignature!==signature(view.prepared.state)||prefix.rawSignature!==signature(requests(view))||prefix.sourceSignature!==view.row.sourceDefinitionSignature)throw Error('thought-contest:original-or-pools-changed')
 return prefix
}
/** Deliberately returns primitive inspection only; a caller cannot obtain a
 * replacement arbitrary prepared state or turn this DTO into reading consent. */
export async function inspectMastermindThoughtContest(original:MastermindThoughtOriginal,token:MastermindThoughtContestPrefix,g:MastermindThoughtGateway){
 const prefix=await current(original,token,g),checks=prefix.contest.events.filter(event=>event.type==='ability-check-resolved')
 return Object.freeze({won:prefix.contest.kind==='false-thoughts-permitted',ownerTotal:prefix.contest.ownerTotal,readerTotal:prefix.contest.readerTotal,ownerD20:checks.find(event=>event.actorId===prefix.view.row.ownerTokenId)?.d20,readerD20:checks.find(event=>event.actorId===prefix.view.row.readerTokenId)?.d20})
}

/** The real opposed state is only injected into this same branded prepared
 * spell, and restored locally afterward. No arbitrary state is accepted.
 * The caller must keep privateThoughts in an owner-scoped delivery channel. */
export async function resolveMastermindThoughtFalseOriginal(original:MastermindThoughtOriginal,token:MastermindThoughtContestPrefix,rolls:Parameters<typeof resolvePreparedDnd5ePluginSpellCast>[0]['rolls'],g:MastermindThoughtGateway,operation?:(prepared:PreparedDnd5ePluginSpellCast)=>Promise<Dnd5ePluginSpellResolution>){
 const prefix=await current(original,token,g),view=await readMastermindThoughtContestOriginal(original,g),prepared=view.prepared,before=prepared.state
 if(prefix.stateSignature!==signature(before))throw Error('thought-contest:original-or-pools-changed')
 const permission=prefix.contest.kind==='false-thoughts-permitted'?prefix.contest.permission:undefined
 if(prefix.contest.kind==='false-thoughts-permitted'&&!permission)throw Error('thought-contest:actual-permission-required')
 prepared.state=prefix.contest.state
 const run=async()=>operation?await operation(prepared):resolvePreparedDnd5ePluginSpellCast({prepared,rolls})
 try{const native=permission?await withSoulOfDeceitReadingPermissionAsync(permission,run):await run();await current(original,token,g);if(!native.result.ok||!native.application)return{kind:'resolved' as const,native};const completed={kind:'resolved' as const,native:{...native,result:{...native.result,events:[...prefix.contest.events,...native.result.events]}},...(permission?{privateThoughts:view.row.answer!.falseThoughts}:{} )};if(!operation)resolvedOriginals.set(completed,{original,prefix:token,signature:signature(completed.native),kind:permission?'false-thoughts':'blocked'});return completed}finally{prepared.state=before}
}

/** Only this module's actual direct native resolver can issue a publication
 * witness. An arbitrary asynchronous callback result is deliberately excluded. */
export async function readMastermindThoughtResolvedOriginal(value:object,g:MastermindThoughtGateway){const bound=resolvedOriginals.get(value);if(!bound)throw Error('thought-publication:actual-native-result-required');const native=nativeValues.get(value)??(value as{native:Dnd5ePluginSpellResolution}).native;if(signature(native)!==bound.signature||!native.result.ok||!native.application)throw Error('thought-publication:actual-native-result-changed');if(bound.prefix)await current(bound.original,bound.prefix,g);const view=await readMastermindThoughtAnsweredOriginal(bound.original,g);const focus=native.result.state.combatants[view.row.ownerTokenId]?.classState.activeEffects?.some(effect=>effect.definitionId?.includes('detect-thoughts-focus')&&effect.source.actorId===view.row.readerTokenId&&native.result.events.some(event=>(event.type==='active-effect-applied'||event.type==='active-effect-refreshed')&&event.targetId===view.row.ownerTokenId&&event.effectId===effect.id));return{...view,native,kind:focus?bound.kind:'blocked' as const}}

/** Runs the existing production spell pipeline under this exact authenticated
 * contest. Only calls to the actual native resolver below issue result lineage;
 * the callback's return value itself grants no publication authority. */
export async function withMastermindThoughtFalseProduction<T>(original:MastermindThoughtOriginal,token:MastermindThoughtContestPrefix,g:MastermindThoughtGateway,operation:(prepared:PreparedDnd5ePluginSpellCast,resolve:typeof resolvePreparedDnd5ePluginSpellCast)=>Promise<T>){
 const prefix=await current(original,token,g),view=await readMastermindThoughtContestOriginal(original,g),prepared=view.prepared,before=prepared.state,permission=prefix.contest.kind==='false-thoughts-permitted'?prefix.contest.permission:undefined
 prepared.state=prefix.contest.state
 const productionToken=markProductionPrepared(prepared)
 const resolve:typeof resolvePreparedDnd5ePluginSpellCast=input=>{
  if(!sameProductionPrepared(input.prepared,prepared,productionToken)||!view.scopeCurrent())throw Error('thought-production:same-issued-prepared-required')
  const native=resolvePreparedDnd5ePluginSpellCast({...input,now:view.row.issuedAt})
  if(native.result.ok&&native.application){resolvedOriginals.set(native,{original,prefix:token,signature:signature(native),kind:permission?'false-thoughts':'blocked'});nativeValues.set(native,native)}
  return native
 }
 try{return permission?await withSoulOfDeceitReadingPermissionAsync(permission,()=>operation(prepared,resolve)):await operation(prepared,resolve)}finally{delete (prepared as unknown as Record<symbol,unknown>)[productionSlot];prepared.state=before}
}

/** Closed initial Detect Thoughts production lane. The owner answer is read
 * from the authenticated journal; a false answer additionally requires the
 * actual native opposed-check prefix. */
export async function withMastermindThoughtProduction<T>(original:MastermindThoughtOriginal,token:MastermindThoughtContestPrefix|undefined,g:MastermindThoughtGateway,operation:(prepared:PreparedDnd5ePluginSpellCast,resolve:typeof resolvePreparedDnd5ePluginSpellCast)=>Promise<T>){
 const view=await readMastermindThoughtAnsweredOriginal(original,g),choice=view.row.answer!.choice
 if(choice==='present-false-thoughts'){
  if(!token)throw Error('thought-production:actual-contest-required')
  return withMastermindThoughtFalseProduction(original,token,g,async(prepared,resolve)=>{
   const before=prepared.activity,inspection=await inspectMastermindThoughtContest(original,token,g)
   if(before)prepared.activity=dnd5eActivityWithSoulThoughtPolicy(before,[{id:view.row.ownerTokenId,soulThoughtPolicy:inspection.won?'false':'blocked'}])
   try{return await operation(prepared,resolve)}finally{prepared.activity=before}
  })
 }
 if(token)throw Error('thought-production:unexpected-contest')
 const prepared=view.prepared,reading=captureSoulOfDeceitReading(prepared.state,{parentId:view.parentId,ownerId:view.row.ownerTokenId,readerId:view.row.readerTokenId,scopeCurrent:view.scopeCurrent})
 if(!reading)throw Error('thought-production:current-native-source-required')
 const policy=resolveSoulOfDeceitReading(reading,{parentId:view.parentId,choice}),before=prepared.activity
 if(before)prepared.activity=dnd5eActivityWithSoulThoughtPolicy(before,[{id:view.row.ownerTokenId,soulThoughtPolicy:choice==='deny'?'blocked':'real'}])
 const productionToken=markProductionPrepared(prepared)
 const resolve:typeof resolvePreparedDnd5ePluginSpellCast=input=>{
  if(!sameProductionPrepared(input.prepared,prepared,productionToken)||!view.scopeCurrent())throw Error('thought-production:same-issued-prepared-required')
  const native=resolvePreparedDnd5ePluginSpellCast({...input,now:view.row.issuedAt})
  if(native.result.ok&&native.application){resolvedOriginals.set(native,{original,signature:signature(native),kind:choice==='deny'?'blocked':'real-consent'});nativeValues.set(native,native)}
  return native
 }
 try{return policy.kind==='real-thoughts-permitted'?await withSoulOfDeceitReadingPermissionAsync(policy.permission,()=>operation(prepared,resolve)):await operation(prepared,resolve)}finally{delete (prepared as unknown as Record<symbol,unknown>)[productionSlot];prepared.activity=before}
}

/** Only the actual Base completion of this same issued native result can
 * advance its publication witness. Neither a callback DTO nor a different
 * spell's genuine completion can replace this original's final state. */
export async function completeMastermindThoughtBaseOriginal(value:object,completed:Awaited<ReturnType<typeof settleDnd5eConcentrationChecks>>,g:MastermindThoughtGateway){
 const view=await readMastermindThoughtResolvedOriginal(value,g),bound=resolvedOriginals.get(value)!
 readDnd5eCompletedCombatBase(view.native.result,completed)
 const result={kind:'resolved' as const,native:{...view.native,result:completed.result,application:completed.application}}
 resolvedOriginals.set(result,{...bound,signature:signature(result.native)})
 return result
}
