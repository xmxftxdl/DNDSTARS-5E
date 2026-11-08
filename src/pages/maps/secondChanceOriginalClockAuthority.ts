import{getRoomSession}from'../../lib/roomSession'
import{normalizeSharedCampaignTime,type SharedCampaignTimeState}from'../../lib/campaignTime'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import type{PersistedSecondChanceAttack}from'../../lib/secondChanceHostState'
export interface SecondChanceOriginalClockAuthority{schemaVersion:1;roomId:string;hostMemberId:string;revision:number;signature:string}
type Clock=SharedCampaignTimeState&{_sync?:{revision?:number}}
async function signature(raw:Clock|null){const text=JSON.stringify(raw==null?null:normalizeSharedCampaignTime(raw)),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return'sha256:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
/** Only the real initial Host issuance calls this with its canonical loaded clock.
 * Revision zero means the resource was actually absent, never an unknown value. */
export async function captureSecondChanceOriginalClockAuthority(raw:Clock|null):Promise<SecondChanceOriginalClockAuthority>{
 const host=getRoomSession();if(host?.role!=='dm')throw Error('second-chance-world:host-room-required')
 const revision=raw==null?0:raw._sync?.revision;if(!Number.isSafeInteger(revision)||revision!<0)throw Error('second-chance-world:clock-revision-required')
 const result:SecondChanceOriginalClockAuthority={schemaVersion:1,roomId:host.roomId,hostMemberId:host.memberId,revision:revision!,signature:await signature(raw)}
 const current=getRoomSession();if(current?.role!=='dm'||current.roomId!==host.roomId||current.memberId!==host.memberId)throw Error('second-chance-world:host-room-required');return result
}
/** Optional Activity-tail boundary only. Ordinary SC does not silently gain a
 * new global world-time rule. Old parents without an original bind fail here. */
export async function assertSecondChanceOriginalClockAuthority(receipt:PersistedSecondChanceAttack,gateway:Pick<SharedRoomGatewayPort,'loadResource'>):Promise<number>{
 const binding=receipt.postNativeClockAuthority,host=getRoomSession();if(!binding)throw Error('second-chance-world:original-clock-not-bound')
 if(host?.role!=='dm'||host.roomId!==binding.roomId||host.memberId!==binding.hostMemberId||receipt.hostControllerMemberId!==host.memberId)throw Error('second-chance-world:host-room-required')
 const raw=await gateway.loadResource<Clock>('campaign-time'),current=await captureSecondChanceOriginalClockAuthority(raw??null)
 if(current.revision!==binding.revision||current.signature!==binding.signature)throw Error('second-chance-world:original-clock-changed')
 return binding.revision
}
