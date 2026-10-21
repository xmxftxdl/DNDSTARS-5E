/** Browser-only private ownership. Proofs never enter room state or exports.
 * onLost must synchronously invalidate prepared casting before any async cleanup.
 * A renewal failure stops continuation; only a fresh cast may acquire again.
 */
export function createLongCastingOwnerClient({binding,instanceId,send,onLost,onError=()=>{},
  setTimer=setTimeout,clearTimer=clearTimeout,heartbeatMs=10000,requestTimeoutMs=10000}){
  const fields=['mapId','requestId','spellId','actorTokenId','actorCharacterId']
  if(!binding||fields.some(key=>typeof binding[key]!=='string'||!binding[key])||
    typeof instanceId!=='string'||!instanceId||typeof send!=='function'||typeof onLost!=='function'||
    !Number.isSafeInteger(heartbeatMs)||heartbeatMs<1||heartbeatMs>10000||
    !Number.isSafeInteger(requestTimeoutMs)||requestTimeoutMs<1||requestTimeoutMs>10000)throw Error('invalid-casting-owner-client')
  const identity=Object.fromEntries(fields.map(key=>[key,binding[key]]))
  let phase='new',proof,heartbeat,starting,renewing,closing
  const cancelHeartbeat=()=>{if(heartbeat!==undefined){clearTimer(heartbeat);heartbeat=undefined}}
  const report=error=>{try{onError(error)}catch{/* Error observers cannot restore ownership. */}}
  const command=async(operation,privateProof)=>{
    const controller=new AbortController()
    let timer
    try{
      const result=await Promise.race([
        Promise.resolve().then(()=>send({operation,binding:{...identity},instanceId,
          ...(privateProof?{proof:privateProof}:{})},controller.signal)),
        new Promise((_,reject)=>{timer=setTimer(()=>{controller.abort();reject(Error('casting-owner-request-timeout'))},requestTimeoutMs)}),
      ])
      if(result?.status!==200)throw Error(result?.body?.error??'casting-owner-request-failed')
      return result.body
    }finally{if(timer!==undefined)clearTimer(timer)}
  }
  const release=async privateProof=>{try{await command('release',privateProof)}catch(error){report(error)}}
  const lose=error=>{
    if(phase!=='active')return
    phase='lost';cancelHeartbeat()
    const prior=proof;proof=undefined
    // Invoke immediately, not in a microtask: callers must stop private progress now.
    try{Promise.resolve(onLost(error)).catch(report)}catch(callbackError){report(callbackError)}
    if(prior)void release(prior)
  }
  const schedule=()=>{
    if(phase!=='active')return
    cancelHeartbeat()
    heartbeat=setTimer(()=>{heartbeat=undefined;void renew()},heartbeatMs)
  }
  const renew=()=>{
    if(phase!=='active')return Promise.resolve(false)
    if(renewing)return renewing
    const privateProof=proof
    renewing=(async()=>{
      try{
        const result=await command('renew',privateProof)
        if(!Number.isSafeInteger(result?.expiresAt))throw Error('invalid-casting-owner-response')
        if(phase!=='active'||proof!==privateProof)return false
        schedule();return true
      }catch(error){lose(error);return false}
      finally{renewing=undefined}
    })()
    return renewing
  }
  return {
    get phase(){return phase},
    start(){
      if(starting)return starting
      if(phase!=='new')return Promise.resolve(false)
      phase='acquiring'
      starting=(async()=>{
        try{
          const result=await command('acquire')
          if(typeof result?.proof!=='string'||!result.proof||!Number.isSafeInteger(result.expiresAt))throw Error('invalid-casting-owner-response')
          if(phase!=='acquiring'){await release(result.proof);return false}
          proof=result.proof;phase='active';schedule();return true
        }catch(error){if(phase==='acquiring')phase='lost';report(error);return false}
      })()
      return starting
    },
    /** Call before every prepared continuation; a local timer never authorizes it. */
    assertOwned:renew,
    close(){
      if(closing)return closing
      phase='closed';cancelHeartbeat()
      const prior=proof;proof=undefined
      closing=(async()=>{if(prior)await release(prior);if(starting)await starting})()
      return closing
    },
  }
}
