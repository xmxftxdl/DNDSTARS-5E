const identityFields=['mapId','requestId','spellId','actorTokenId','actorCharacterId']
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const nonempty=value=>typeof value==='string'&&value.length>0&&value.length<=1024
const same=(left,right)=>identityFields.every(field=>left?.[field]===right?.[field])

/** authorize() must derive membership from server-validated credentials, not from
 * command data. readCurrentBinding() reads the current durable concentration marker.
 * The lease store is private and shared across server processes. No client progress,
 * role, owner member ID or expiry is accepted. This service does not spend resources.
 */
export async function executeLongCastingOwnerCommand({roomId,credential,command},{authorize,readCurrentBinding,store}){
  const principal=await authorize(credential,roomId)
  if(!principal||principal.role!=='dm'||principal.roomId!==roomId||!nonempty(principal.memberId))return {status:403,body:{error:'forbidden'}}
  if(!plain(command)||!['acquire','renew','release','status'].includes(command.operation)||
    !plain(command.binding)||Object.keys(command.binding).some(key=>!identityFields.includes(key))||
    identityFields.some(field=>!nonempty(command.binding[field])))return {status:400,body:{error:'invalid-casting-owner-command'}}
  const operation=command.operation
  const allowed=operation==='status'?['operation','binding']:operation==='acquire'?['operation','binding','instanceId']:['operation','binding','instanceId','proof']
  if(Object.keys(command).some(key=>!allowed.includes(key))||
    (operation!=='status'&&!nonempty(command.instanceId))||
    ((operation==='renew'||operation==='release')&&!nonempty(command.proof)))return {status:400,body:{error:'invalid-casting-owner-command'}}
  const binding={...command.binding,roomId}
  const ownerId=JSON.stringify([principal.memberId,command.instanceId])
  if(operation==='release'){
    // Completion may already have removed the casting marker. Only the original
    // private proof can retire its lease, including after character removal.
    return await store.release(binding,ownerId,command.proof)
      ?{status:200,body:{released:true}}:{status:409,body:{error:'casting-owner-lost'}}
  }
  const current=await readCurrentBinding(roomId,binding.actorCharacterId)
  if(!same(current,binding))return operation==='status'?{status:200,body:{active:false}}:
    {status:409,body:{error:'casting-identity-changed'}}
  if(operation==='status')return {status:200,body:{active:await store.isActive(binding)}}
  const result=operation==='acquire'?await store.acquire(binding,ownerId):await store.renew(binding,ownerId,command.proof)
  return result?{status:200,body:result}:{status:409,body:{error:'casting-owner-lost'}}
}
