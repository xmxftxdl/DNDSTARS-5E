import {createLongCastingOwnerClient} from '../../../shared/long-casting-owner-client.mjs'
import {getRoomSession} from '../../lib/roomSession'
import {browserSharedRoomService} from '../../composition/browserSharedRoomService'
import type {Dnd5eLongCastingBinding} from '../../rulesets/dnd5e/longCastingIdentity'

const {sendLongCastingOwnerCommand} = browserSharedRoomService

export function createRoomLongCastingOwner(binding:Dnd5eLongCastingBinding,onLost:(error:unknown)=>void|Promise<void>){
  const session=getRoomSession()
  if(session?.role!=='dm')throw Error('casting-owner-dm-required')
  const {roomId,memberId}=session
  return createLongCastingOwnerClient({binding,instanceId:crypto.randomUUID(),onLost,
    send:(command,signal)=>sendLongCastingOwnerCommand(roomId,memberId,command,signal)})
}

/** Failure is not evidence of an orphan. Callers must let errors prevent cleanup. */
export async function roomLongCastingOwnerActive(binding:Dnd5eLongCastingBinding):Promise<boolean>{
  const session=getRoomSession()
  if(session?.role!=='dm')throw Error('casting-owner-dm-required')
  const result=await sendLongCastingOwnerCommand(session.roomId,session.memberId,
    {operation:'status',binding},AbortSignal.timeout(10000))
  if(result.status!==200||typeof result.body.active!=='boolean')throw Error('casting-owner-status-unavailable')
  return result.body.active
}
