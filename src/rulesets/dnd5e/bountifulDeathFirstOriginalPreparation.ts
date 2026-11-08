import{getRoomSession}from'../../lib/roomSession'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import type{SharedRoomGatewayPort}from'../../ports/sharedRoomGateway'
import{readDnd5eDeathRepeatFirstOriginal,type Dnd5eDeathRepeatFirstOriginal}from'./deathRepeatFirstOriginal'
export type BountifulDeathFirstIdentity={parentId:string;mapId:string;combatId:string}
export type BountifulDeathFirstOriginalPreparationBook={ok:true;schemaVersion:1;sourceKind:'death-first-ready-v1';roomId:string;hostMemberId:string;parentId:string;mapId:string;combatId:string;source:ReturnType<typeof encodeSecondChanceParentWire>;effectTimestamp:number;actorId:string;characterId:string;memberId:string;firstRawRollId:string;firstRaw:{memberId:string;values:number[]};firstAdopted:{memberId:string;values:number[]};originalRoomAction:unknown;scope:{versions:Record<string,number>;combatSignature:string;charactersSignature:string;mapsSignature:string;geometrySignature:string;clockSignature:string}}
export type BountifulDeathFirstOriginalPreparationLoader=(identity:BountifulDeathFirstIdentity)=>Promise<BountifulDeathFirstOriginalPreparationBook>
const signature=(v:unknown)=>JSON.stringify(encodeSecondChanceParentWire(v))
/** This transports only the live actual first-ready preparation. The Node
 * authority derives first raw from its private physical lock, and the source
 * carries the independently adopted original. It mints no B receipt. */
export async function prepareBountifulDeathFirstOriginal(proof:Dnd5eDeathRepeatFirstOriginal,gateway:Pick<SharedRoomGatewayPort,'publishEvent'>,load:BountifulDeathFirstOriginalPreparationLoader){
 const actual=readDnd5eDeathRepeatFirstOriginal(proof),session=getRoomSession(),p=actual.source.prepared;if(session?.role!=='dm'||!session.roomId||!session.memberId||!gateway.publishEvent)throw Error('death-first-preparation:actual-host-transport-required')
 const identity={parentId:p.action.id,mapId:p.map.id,combatId:p.state.combatId!},source=encodeSecondChanceParentWire(actual.source)
 await gateway.publishEvent('bountiful-native-raw-source-dm-to-host',{sourceKind:'death-first-ready-v1',phase:'prepare',...identity,source,effectTimestamp:actual.effectTimestamp})
 const latest=readDnd5eDeathRepeatFirstOriginal(proof),book=await load(identity);if(signature(getRoomSession())!==signature(session)||latest.effectTimestamp!==actual.effectTimestamp||signature(latest.source)!==signature(actual.source)||book.ok!==true||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||book.parentId!==identity.parentId||book.mapId!==identity.mapId||book.combatId!==identity.combatId||book.effectTimestamp!==actual.effectTimestamp||signature(book.source)!==signature(source)||book.firstAdopted.memberId!==session.memberId||signature(book.firstAdopted.values)!==signature([actual.source.command.d20]))throw Error('death-first-preparation:exact-live-private-book-required')
 readDnd5eDeathRepeatFirstOriginal(proof);return book
}
