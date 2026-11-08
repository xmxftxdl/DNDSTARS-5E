import{reconcilePactHostClock}from'./pactWeaponClockSnapshot'
import type {BattleMap} from '../../store/maps'
import type {SharedMapGeometryState} from '../../lib/mapGeometry'
import type {SharedCampaignTimeState} from '../../lib/campaignTime'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {validateSharedCampaignTime} from '../../lib/campaignTime'
import {getRoomSession} from '../../lib/roomSession'
import {normalizeDnd5eInventory} from '../../rulesets/dnd5e/items'
import {planPactWeaponLifecycle} from './pactWeaponLifecyclePlan'
import {validPactWeaponAuthority,type PactAuthorityCharacter,type PactLifecycleReceipt} from './pactWeaponSummonHost'
type Revisioned<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
export type PactLifecycleCommand={mapId:string;ownerCharacterId:string;expectedPactRevision:number;kind:'advance'|'dismiss';transactionId:string}
const revision=(value:Revisioned<object>|null,name:string)=>{
 if(value==null)return 0
 const result=value._sync?.revision
 if(!Number.isSafeInteger(result)||result!<0)throw Error('pact:revision-required:'+name)
 return result!
}
/** Actual private Host/gateway boundary. All geometry, location, death and time
 * facts are reread and revision guarded; none comes from a player command.
 * Still staged: callers must wire actual movement/clock/death and player queues.
 * Ritual continuity is deliberately not inferred by this lifecycle adapter.
 */
export async function commitPactWeaponLifecycle(command:PactLifecycleCommand,gateway:Gateway):Promise<PactLifecycleReceipt>{
 const initialSession=getRoomSession()
 const session=initialSession?{roomId:initialSession.roomId,memberId:initialSession.memberId,role:initialSession.role}:null
 const guard=()=>{const now=getRoomSession();if(!session||session.role!=='dm'||now?.roomId!==session.roomId||now.memberId!==session.memberId||now.role!=='dm')throw Error('pact:host-room-required')}
 guard()
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(command.transactionId)||!['advance','dismiss'].includes(command.kind)||
  !Number.isSafeInteger(command.expectedPactRevision)||command.expectedPactRevision<0)throw Error('pact:invalid-command')
 const[loadedCharacters,loadedMaps,clock,geometry]=await Promise.all([
  gateway.loadResource<Revisioned<{characters:PactAuthorityCharacter[]}>>('characters'),
  gateway.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),
  gateway.loadResource<Revisioned<SharedCampaignTimeState>>('campaign-time'),
  gateway.loadResource<Revisioned<SharedMapGeometryState>>('map-geometry'),
 ])
 guard()
 if(!loadedCharacters||!loadedMaps||!clock||!validateSharedCampaignTime(clock))throw Error('pact:snapshot-unavailable')
 const synchronized=reconcilePactHostClock({characters:loadedCharacters.characters,maps:loadedMaps.maps,clock,geometry:geometry?.maps??[]})
 const characters={...loadedCharacters,characters:loadedCharacters.characters.map((actor,index)=>({...actor,...synchronized.characters[index]}))},maps={...loadedMaps,maps:synchronized.maps}
 const owners=characters.characters.filter(row=>row.id===command.ownerCharacterId),map=maps.maps.find(row=>row.id===command.mapId)
 if(owners.length!==1||!map)throw Error('pact:owner-unavailable')
 const owner=owners[0],authority=owner.dnd5ePactWeaponAuthority
 if(!authority||!validPactWeaponAuthority(authority,owner.id))throw Error('pact:invalid-authority-record')
 const fingerprint=JSON.stringify([command.mapId,command.ownerCharacterId,command.kind,command.expectedPactRevision])
 const prior=authority.lifecycle?.find(row=>row.transactionId===command.transactionId)
 if(prior){if(prior.command!==fingerprint)throw Error('pact:transaction-id-conflict');return prior}
 if((authority.lifecycle?.length??0)>=10_000)throw Error('pact:receipt-capacity-reached')
 if(authority.state.ritual)throw Error('pact:ritual-tracker-required')
 const plan=planPactWeaponLifecycle({state:authority.state,document:authority.inventory,lifecycleTrace:authority.lifecycleTrace,characters:characters.characters,map,
  geometry:geometry?.maps.find(row=>row.mapId===map.id),expectedRevision:command.expectedPactRevision,
  expectedInventoryRevisions:Object.fromEntries(characters.characters.map(row=>[row.id,normalizeDnd5eInventory(row).revision!])),
  hostClockRevision:revision(clock,'campaign-time'),worldSecond:clock.worldMinute*60+(clock.worldSecondRemainder??0),transactionId:command.transactionId,kind:command.kind})
 if(!plan.ok)throw Error('pact:'+plan.reason)
 const receipt:PactLifecycleReceipt={transactionId:command.transactionId,command:fingerprint,pactRevision:plan.state.revision,bindingStatus:plan.state.binding?.status??'none'}
 const next=plan.characters.map(row=>row.id!==owner.id?row:{...row,dnd5ePactWeaponAuthority:{...authority,state:plan.state,inventory:plan.document,lifecycle:[...(authority.lifecycle??[]),receipt]}})
 const writes=[{name:'characters',expectedRevision:revision(characters,'characters'),data:{...characters,characters:next}},
  {name:'maps',expectedRevision:revision(maps,'maps'),data:{...maps,maps:maps.maps.map(row=>row.id===map.id?plan.map:row)}}]
 guard()
 try{
  await gateway.saveResourcesAtomically(writes,{transactionId:'pact-lifecycle:'+command.transactionId,
   readRevisions:{'campaign-time':revision(clock,'campaign-time'),'map-geometry':revision(geometry,'map-geometry')},undoLabel:'更新契约武器'})
  guard();return receipt
 }catch(error){
  guard()
  if(/failed to fetch|fetch failed|networkerror|state-transaction-(?:conflict|unavailable)/i.test(String(error))){
   const saved=await gateway.loadResource<Revisioned<{characters:PactAuthorityCharacter[]}>>('characters');guard()
   const recovered=saved?.characters.find(row=>row.id===owner.id)?.dnd5ePactWeaponAuthority
   if(recovered&&validPactWeaponAuthority(recovered,owner.id)&&JSON.stringify(recovered.lifecycle?.find(row=>row.transactionId===command.transactionId))===JSON.stringify(receipt))return receipt
  }
  throw error
 }
}

