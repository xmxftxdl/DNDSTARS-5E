import { readFile } from 'node:fs/promises'
import { issueLiveKitVoiceAccess, publicVoiceStatus } from '../voice-access-token.mjs'

export async function handleRoomVoiceApi(req, res, parsed, ctx, dependencies) {
  const voiceMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/voice(?:\/(token))?$/)
  if (!voiceMatch) return false

  const {
    normalizeLobbyRoomCode,
    roomLobbyFile,
    lobbyRoomMember,
    roomMemberSessionAuthorized,
    roomPlayerPresence,
    RoomProtocolError,
    writeJson,
  } = dependencies
  const rawRoomId = String(voiceMatch[1] ?? '').toUpperCase()
  const roomId = normalizeLobbyRoomCode(rawRoomId)
  const operation = voiceMatch[2] === 'token' ? 'token' : 'status'
  if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
  if ((operation === 'status' && req.method !== 'GET') || (operation === 'token' && req.method !== 'POST')) {
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  let room
  try {
    room = JSON.parse(await readFile(roomLobbyFile(ctx, roomId), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'room-not-found')
    throw error
  }
  if (room.closedAt) throw new RoomProtocolError(409, 'room-closed')

  const member = lobbyRoomMember(room, req?.headers?.['x-stars-member'])
  if (!member || !roomMemberSessionAuthorized(member, req?.headers?.['x-stars-room-token'])) {
    throw new RoomProtocolError(403, 'forbidden')
  }
  if (member !== room.host && roomPlayerPresence(member) === 'removed') {
    throw new RoomProtocolError(403, 'member-removed')
  }

  if (operation === 'status') {
    writeJson(res, 200, publicVoiceStatus())
    return true
  }
  const role = member === room.host ? 'dm' : member.role === 'spectator' ? 'spectator' : 'player'
  writeJson(res, 200, await issueLiveKitVoiceAccess({
    roomId,
    memberId: member.memberId,
    accountId: member.accountId,
    displayName: member.displayName,
    role,
  }))
  return true
}
