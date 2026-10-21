import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {createLongCastingOwnerFileStore} from '../adapters/long-casting-owner-file-store.mjs'
import {executeLongCastingOwnerCommand} from './long-casting-owner-service.mjs'

/** Durable identity only. The private preparation still proves all progress. */
export function readDurableLongCastingOwnerBinding(charactersState,mapsState,characterId){
  const characters=charactersState?.characters?.filter?.(character=>character?.id===characterId)
  if(!Array.isArray(characters)||characters.length!==1||characters[0].concentrating!==true)return undefined
  const id=characters[0].dnd5eCombatState?.concentrationSpellId
  if(typeof id!=='string'||!id.startsWith('casting:'))return undefined
  let parts
  try{parts=JSON.parse(id.slice(8))}catch{return undefined}
  if(!Array.isArray(parts)||parts.length!==5||parts.some(part=>typeof part!=='string'||!part||part.length>1024)||parts[4]!==characterId)return undefined
  const maps=mapsState?.maps?.filter?.(map=>map?.id===parts[2])
  if(!Array.isArray(maps)||maps.length!==1)return undefined
  const tokens=maps[0].tokens?.filter?.(token=>token?.id===parts[3])
  if(!Array.isArray(tokens)||tokens.length!==1||tokens[0].characterId!==characterId)return undefined
  return {requestId:parts[0],spellId:parts[1],mapId:parts[2],actorTokenId:parts[3],actorCharacterId:parts[4]}
}

/** Register in shared API dispatch only after the running baseline tests finish.
 * Uses the same lobby membership/session helpers as existing protected room APIs.
 * Private proofs never become shared state, an event, or a public status response.
 */
export async function handleLongCastingOwnerApi(req,res,parsed,ctx,dependencies){
  const match=parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/long-casting-owner$/)
  if(!match)return false
  const {normalizeLobbyRoomCode,roomLobbyFile,lobbyRoomMember,roomMemberSessionAuthorized,
    RoomProtocolError,writeJson,readBody,scopedContext,readSharedStateFile}=dependencies
  const raw=String(match[1]).toUpperCase(),roomId=normalizeLobbyRoomCode(raw)
  if(raw!==roomId||roomId.length!==6)throw new RoomProtocolError(400,'invalid-room-code')
  if(req.method!=='POST')throw new RoomProtocolError(405,'method-not-allowed')
  let room
  try{room=JSON.parse(await readFile(roomLobbyFile(ctx,roomId),'utf8'))}catch(error){
    if(error?.code==='ENOENT')throw new RoomProtocolError(404,'room-not-found')
    throw error
  }
  if(room.closedAt)throw new RoomProtocolError(409,'room-closed')
  const member=lobbyRoomMember(room,req.headers?.['x-stars-member'])
  if(!member||member!==room.host||!roomMemberSessionAuthorized(member,req.headers?.['x-stars-room-token']))throw new RoomProtocolError(403,'forbidden')
  let command
  try{command=JSON.parse(await readBody(req,16384))}catch(error){
    if(error?.statusCode)throw error
    throw new RoomProtocolError(400,'invalid-casting-owner-command')
  }
  if(typeof ctx.sharedRoot!=='string'||!path.isAbsolute(ctx.sharedRoot))throw Error('invalid-private-casting-owner-root')
  const filePath=path.join(ctx.sharedRoot,'private','casting-owners',roomId,'owners.json')
  const roomCtx=scopedContext(ctx,roomId)
  const result=await executeLongCastingOwnerCommand({roomId,command,credential:member},{
    authorize:async()=>({role:'dm',roomId,memberId:member.memberId}),
    readCurrentBinding:async(_roomId,characterId)=>{
      const [characters,maps]=await Promise.all([readSharedStateFile(roomCtx,'characters'),readSharedStateFile(roomCtx,'maps')])
      // The existing state reader reports missing/unreadable files as null.
      // That cannot authorize a second Host to clean up a still-live cast.
      if(!Array.isArray(characters.value?.characters)||!Array.isArray(maps.value?.maps))throw new RoomProtocolError(503,'casting-owner-state-unavailable')
      return readDurableLongCastingOwnerBinding(characters.value,maps.value,characterId)
    },
    store:createLongCastingOwnerFileStore({filePath}),
  })
  writeJson(res,result.status,result.body)
  return true
}
