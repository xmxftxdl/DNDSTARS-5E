import type{TempestuousBeforeOriginalPort}from'./tempestuousBeforeOriginalPort'
import {attachBountifulReadySource} from './bountifulReadySource'
import type {BountifulSpellOriginalInput} from './bountifulSpellTargetRaw'
import {recordBountifulReadyAfterDice} from './bountifulReadyAfterDice'
import {resolveBountifulReadyForNormalAck} from './bountifulReadyNormalAck'
import type {BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import type {SharedPlayerActionState,SharedCombatState} from '../../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import type {Dnd5eDamageReactionFlowOptions} from './damageReactionFlow'
import {bountifulOriginalParentReceiptId} from './bountifulLuckPersistentHost'
import type {BountifulOriginalDieReceipt} from './bountifulLuckReceipt'
import {recordBountifulOriginalAfterDice,resolveBountifulOriginalForNormalAck} from './bountifulLuckNormalAck'

type Source=BountifulSpellOriginalInput
type Result=ReturnType<typeof resolvePreparedDnd5eSpellCast>
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>&TempestuousBeforeOriginalPort
type Combat=SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>;bountifulOriginalParents?:Record<string,BountifulOriginalDieReceipt>}

/** Concrete native spell route, before the unchanged Maps settlement and ACK.
 * The ordinary callback preserves the existing no-Bountiful specialized paths.
 * A private parent always runs the real whitelisted facade and damage driver;
 * a callback returning generic success cannot acquire a publisher binding. */
export async function resolveBountifulOrOrdinarySpell(input:{
 action:SharedPlayerActionState
 source:Source
 options:Dnd5eDamageReactionFlowOptions
 rollCursor:number
 specializedSource:boolean
 ordinary:()=>Result|Promise<Result>
},gateway:Gateway):Promise<Result>{
 input={...input,source:await attachBountifulReadySource({...input,allowLateDice:true},gateway)}
 const combat=await gateway.loadResource<Combat>('combat')
 const first=combat?.bountifulOriginalParents?.[bountifulOriginalParentReceiptId(input.action.id,0)]
 if(!first){
  const ready=Object.values(combat?.bountifulReadyParents??{}).filter(row=>row.parentId===input.action.id&&!row.consumed).sort((a,b)=>(a.request.ordinal??-1)-(b.request.ordinal??-1)).at(-1)
  if(!ready)return input.ordinary()
  if(input.specializedSource)throw Error('bountiful-ready-spell:specialized-source-replay-required')
  await recordBountifulReadyAfterDice({action:input.action,frameId:ready.id,source:input.source,rollCursor:input.rollCursor,authorityUnchanged:input.options.authorityUnchanged},gateway)
  return resolveBountifulReadyForNormalAck({action:input.action,frameId:ready.id,options:input.options},gateway)
 }
 if(input.specializedSource)throw Error('bountiful-spell-settlement:specialized-source-replay-required')
 await recordBountifulOriginalAfterDice({action:input.action,source:input.source,resolve:resolvePreparedDnd5eSpellCast,
  authorityUnchanged:input.options.authorityUnchanged,rollCursor:input.rollCursor},gateway)
 return resolveBountifulOriginalForNormalAck({action:input.action,source:input.source,
  resolve:resolvePreparedDnd5eSpellCast,options:input.options},gateway)
}
