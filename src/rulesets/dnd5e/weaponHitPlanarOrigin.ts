import {dnd5eExecutionEventKey} from './activities/dnd5eActivityIdentity'
import type {SharedCombatInterrupt} from '../../lib/combatInterruptQueue'
import {isCombatInterruptKind} from '../../lib/combatInterruptProtocol'

export interface Dnd5eWeaponHitPlanarOriginRequest {
 eventId:string;occurrence:number;actorId:string;targetId:string;packageId:string;activityId:string;targetName:string
}
export interface Dnd5ePlanarOriginChoice {
 id:string;transactionId:string;mapId:string;pluginId:string;featureId:string;featureName:string;audience:'dm';
 prompt:string;options:{id:string;label:string}[];defaultOptionId:string;timeoutMs:number;phase:'before-damage';
 context:Record<string,unknown>
}
/** The room supplies authenticated DM-only transport. This never accepts an
 * actor's payload as a world fact, nor converts unknown into a declined rider. */
export async function collectDnd5eWeaponHitPlanarOrigin(input:{principal:'dm'|'player';parentId:string;mapId:string;
 request:Dnd5eWeaponHitPlanarOriginRequest;authorityUnchanged:()=>boolean;
 load:(id:string)=>Promise<SharedCombatInterrupt|undefined>;
 finish:(id:string,response:Record<string,unknown>|undefined)=>Promise<void>;
 choose:(choice:Dnd5ePlanarOriginChoice)=>Promise<string|undefined>
}):Promise<'native'|'foreign'>{
 if(input.principal!=='dm'||!input.parentId)throw Error('weapon-hit-planar-origin-dm-parent-required')
 const {request,parentId}=input
 const binding={schemaVersion:1,factId:'spell.native-plane-relation',parentId,eventId:request.eventId,occurrence:request.occurrence,actorId:request.actorId,
  targetId:request.targetId,packageId:request.packageId,activityId:request.activityId}
 const key=dnd5eExecutionEventKey(JSON.stringify(binding))
 const guard=()=>{if(!input.authorityUnchanged())throw Error('weapon-hit-planar-origin-stale')}
 const validate=(row:SharedCombatInterrupt,expectedId:string)=>{
  const saved=row.payload.hostWorldFactBinding
  if(row.id!==expectedId||!isCombatInterruptKind(row,'plugin-choice')||row.mapId!==input.mapId||row.transactionId!==parentId||
   row.payload.audience!=='dm'||row.payload.pluginId!==request.packageId||row.payload.featureId!==request.activityId||
   !saved||typeof saved!=='object'||Array.isArray(saved)||Object.keys(saved).length!==Object.keys(binding).length||
   Object.entries(binding).some(([key,value])=>(saved as Record<string,unknown>)[key]!==value)||
   row.payload.defaultOptionId!=='unknown'||!Array.isArray(row.payload.options)||
   JSON.stringify(row.payload.options.map(option=>option.id))!==JSON.stringify(['native','foreign','unknown']))
   throw Error('weapon-hit-planar-origin-binding-mismatch')
 }
 for(let attempt=0;;attempt++){
  guard()
  const id=`host-world-fact:${key}:${attempt}`
  const choice:Dnd5ePlanarOriginChoice={id,transactionId:parentId,mapId:input.mapId,
   pluginId:request.packageId,featureId:request.activityId,featureName:'放逐斩·目标位面',audience:'dm',
   prompt:`请确认${request.targetName}是否为当前位面的原住民。此项只确认世界事实，攻击仍将结算原有伤害。`,
   options:[{id:'native',label:'当前位面的原住民'},{id:'foreign',label:'来自其他家园位面'},{id:'unknown',label:'暂未确定，继续等待'}],
   defaultOptionId:'unknown',timeoutMs:60_000,phase:'before-damage',context:{hostWorldFactBinding:binding}}
  let row=await input.load(id)
  guard()
  for(;;){
   if(row){
    validate(row,id)
    if(row.status==='answered'){
     await input.finish(id,row.response)
     guard()
     row=await input.load(id)
     guard()
     if(!row)throw Error('weapon-hit-planar-origin-not-published')
     validate(row,id)
     if(row.status!=='done')throw Error('weapon-hit-planar-origin-finish-not-persisted')
    }
    if(row.status==='done'){
     const persisted=row.response?.optionId
     if(persisted==='native'||persisted==='foreign')return persisted
     break
    }
    if(row.status==='rolled-back')break
    if(row.status!=='pending')throw Error('weapon-hit-planar-origin-invalid-status')
   }
   // A controller return value is only a wake-up hint. The authenticated
   // persisted row is the sole fact. Pending reuses this exact window and
   // awaits its normal transport; unknown finishes before advancing attempt.
   await input.choose(choice)
   guard()
   row=await input.load(id)
   guard()
   if(!row)throw Error('weapon-hit-planar-origin-not-published')
  }
 }
}
