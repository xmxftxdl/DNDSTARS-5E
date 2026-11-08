import{secondChanceCanonicalControllerMemberId}from'../../../shared/second-chance-controller.mjs'
import{getRoomSession}from'../../lib/roomSession'
import{readDnd5eTempestuousBeforeSpellOriginalOperation,readDnd5eStormCastOriginalOperation,type Dnd5eTempestuousBeforeSpellOriginalOperation,type Dnd5eStormCastOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
type Request=(operation:'begin'|'read'|'cancel',input:unknown)=>Promise<Record<string,unknown>>
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
/** Input registration only, from this actual live canonical before operation.
 * No returned JSON row is a Native, original-roll or publication capability. */
async function beginActualHostInput(source:Parameters<typeof resolvePreparedDnd5eSpellCast>[0],actual:{records:readonly unknown[];frame:{parentId:string;actorId:string}},read:()=>unknown,request:Request){
 const session=getRoomSession();if(session?.role!=='dm'||!session.roomId||!session.memberId)throw Error('tempestuous-host-preparation:actual-host-required')
 const prepared=source.prepared,action=prepared.action,character=prepared.characters.find(c=>c.id===prepared.actorToken.characterId)
 if(action.sourceMode!=='dm'||action.roomMemberId!==undefined&&action.roomMemberId!==session.memberId||actual.records.length||action.id!==actual.frame.parentId||action.actorTokenId!==actual.frame.actorId||!character||secondChanceCanonicalControllerMemberId(character,{roomId:session.roomId,hostMemberId:session.memberId})!==session.memberId)throw Error('tempestuous-host-preparation:actual-current-host-operation-required')
 const signature=JSON.stringify(read()),identity={parentId:action.id,mapId:prepared.map.id,combatId:prepared.state.combatId},book=await request('begin',{intent:structuredClone(action)}),current=getRoomSession()
 if(current?.role!=='dm'||current.roomId!==session.roomId||current.memberId!==session.memberId||JSON.stringify(read())!==signature||Object.keys(book).some(key=>!['ok','schemaVersion','sourceKind','roomId','hostMemberId','parentId','mapId','combatId','originalRoomAction','characterId','scope'].includes(key))||book.ok!==true||book.schemaVersion!==1||book.sourceKind!=='tempestuous-host-original-v1'||book.roomId!==session.roomId||book.hostMemberId!==session.memberId||book.parentId!==identity.parentId||book.mapId!==identity.mapId||book.combatId!==identity.combatId||!same(book.originalRoomAction,action)||book.characterId!==character.id)throw Error('tempestuous-host-preparation:exact-private-host-intent-required')
 let closed=false
 return{identity,cancel:async()=>{if(closed)return;const current=getRoomSession();if(current?.role!=='dm'||current.roomId!==session.roomId||current.memberId!==session.memberId)throw Error('tempestuous-host-preparation:actual-host-changed');await request('cancel',identity);closed=true}}
}
export async function beginTempestuousHostOriginalPreparation(operation:Dnd5eTempestuousBeforeSpellOriginalOperation,request:Request){const read=()=>readDnd5eTempestuousBeforeSpellOriginalOperation(operation),actual=read();return beginActualHostInput(actual.input as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],actual,read,request)}
export async function beginStormHostOriginalPreparation(operation:Dnd5eStormCastOriginalOperation,request:Request){const read=()=>readDnd5eStormCastOriginalOperation(operation),actual=read();return beginActualHostInput(actual.source as Parameters<typeof resolvePreparedDnd5eSpellCast>[0],actual,read,request)}
