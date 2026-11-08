import{pactWeaponPendingSeparationInstance}from'../../rulesets/dnd5e/pactWeaponSeparation'
import type{Character}from'../../types/character'
import type{BattleMap}from'../../store/maps'
import type{SharedCampaignTimeState}from'../../lib/campaignTime'
import type{SharedMapGeometryState}from'../../lib/mapGeometry'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{validateSharedCampaignTime}from'../../lib/campaignTime'
import{getRoomSession}from'../../lib/roomSession'
import{normalizeDnd5eInventory}from'../../rulesets/dnd5e/items'
import{reconcilePactHostClock}from'../../rulesets/dnd5e/pactWeaponClockSnapshot'
import{planPactWeaponLifecycle}from'../../rulesets/dnd5e/pactWeaponLifecyclePlan'
import{commitPactWeaponLifecycle}from'../../rulesets/dnd5e/pactWeaponLifecycleHost'
import{validPactWeaponAuthority,type PactAuthorityCharacter}from'../../rulesets/dnd5e/pactWeaponSummonHost'

type Revisioned<T>=T&{_sync?:{revision?:number}}
type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
const revision=(value:Revisioned<object>|null)=>{if(!value)return 0;const result=value._sync?.revision;if(!Number.isSafeInteger(result)||result!<0)throw Error('pact:revision-required');return result!}
/** A scene wake schedules real Host work for the room's uniquely located owners.
 * Preview only decides whether there is meaningful work. The existing commit
 * rereads all geometry/inventory/time and publishes the whole original CAS. */
export async function advancePactWeaponLifecycles(gateway:Gateway){
 const initial=getRoomSession(),identity=initial&&{roomId:initial.roomId,memberId:initial.memberId}
 const guard=()=>{const now=getRoomSession();if(!identity||now?.role!=='dm'||now.roomId!==identity.roomId||now.memberId!==identity.memberId)throw Error('pact:host-room-required')}
 guard()
 const[characters,maps,clock,geometry]=await Promise.all([
  gateway.loadResource<Revisioned<{characters:PactAuthorityCharacter[]}>>('characters'),
  gateway.loadResource<Revisioned<{maps:BattleMap[]}>>('maps'),
  gateway.loadResource<Revisioned<SharedCampaignTimeState>>('campaign-time'),
  gateway.loadResource<Revisioned<SharedMapGeometryState>>('map-geometry'),
 ])
 guard()
 if(!characters||!maps||!clock||!validateSharedCampaignTime(clock))throw Error('pact:snapshot-unavailable')
 const observed=reconcilePactHostClock({characters:characters.characters,maps:maps.maps,clock,geometry:geometry?.maps??[]}),completed=[]
 for(const owner of observed.characters as PactAuthorityCharacter[]){
  const authority=owner.dnd5ePactWeaponAuthority
  if(!authority?.state.binding||authority.state.ritual)continue
  if(!validPactWeaponAuthority(authority,owner.id))throw Error('pact:invalid-authority-record')
  const locations=observed.maps.flatMap(map=>map.tokens.filter(token=>token.characterId===owner.id).map(token=>({map,token})))
  // Unknown/multiply represented locations cannot certify a separation interval.
  if(locations.length!==1)continue
  const physical=observed.maps.filter(scene=>scene.tokens.some(token=>token.dnd5eObjectState?.inventoryItem?.instance?.instanceId===authority.state.binding!.inventoryInstanceId))
  // A certified past expiry must remove the current exact ground item even if
  // the owner moved to another map before this wake. This certifies no new
  // cross-map distance: the private same-scene history already proved expiry.
  const map=pactWeaponPendingSeparationInstance(owner)&&physical.length===1?physical[0]:locations[0].map
  const scope=JSON.stringify([identity!.roomId,identity!.memberId,owner.id,map.id,authority.state.revision,revision(characters),revision(maps),revision(clock),revision(geometry)])
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope));guard()
  const transactionId='pact-auto:'+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')
  const preview=planPactWeaponLifecycle({state:authority.state,document:authority.inventory,lifecycleTrace:authority.lifecycleTrace,characters:observed.characters as Character[],map,
   geometry:geometry?.maps.find(row=>row.mapId===map.id),expectedRevision:authority.state.revision,
   expectedInventoryRevisions:Object.fromEntries(observed.characters.map(actor=>[actor.id,normalizeDnd5eInventory(actor).revision!])),
   hostClockRevision:revision(clock),worldSecond:clock.worldMinute*60+(clock.worldSecondRemainder??0),transactionId,kind:'advance'})
  if(!preview.ok)throw Error('pact:'+preview.reason)
  // lastHostSecond/revision alone are bookkeeping, not another inventory action.
  // Otherwise the character reload caused by this publication would loop forever.
  if(JSON.stringify(preview.state.binding)===JSON.stringify(authority.state.binding))continue
  guard();completed.push(await commitPactWeaponLifecycle({mapId:map.id,ownerCharacterId:owner.id,expectedPactRevision:authority.state.revision,transactionId,kind:'advance'},gateway));guard()
 }
 return completed
}
