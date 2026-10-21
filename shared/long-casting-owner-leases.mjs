import {randomUUID} from 'node:crypto'

/** Server-memory ownership only: this never stores or reconstructs casting progress.
 * Callers must authenticate a DM and validate the current casting identity before
 * invoking mutations. Lease proofs remain private to the owning browser instance.
 */
export function createLongCastingOwnerLeases({now=Date.now,createProof=randomUUID,ttlMs=30000}={}){
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>120000)throw Error('invalid-casting-owner-ttl')
  const records=new Map()
  const fields=['roomId','mapId','requestId','spellId','actorTokenId','actorCharacterId']
  const valid=binding=>binding&&fields.every(field=>typeof binding[field]==='string'&&binding[field].length>0&&binding[field].length<=1024)
  const key=binding=>JSON.stringify([binding.roomId,binding.mapId,binding.actorCharacterId])
  const matches=(record,binding)=>fields.every(field=>record.binding[field]===binding[field])
  const live=binding=>{
    if(!valid(binding))return undefined
    const id=key(binding),record=records.get(id)
    if(record&&record.expiresAt<=now()){records.delete(id);return undefined}
    return record
  }
  return {
    restore(snapshot){
      if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.records)||snapshot.records.length>4096)throw Error('invalid-casting-owner-snapshot')
      const restored=new Map()
      for(const record of snapshot.records){
        if(!valid(record?.binding)||typeof record.ownerId!=='string'||!record.ownerId||record.ownerId.length>1024||
          typeof record.proof!=='string'||!record.proof||record.proof.length>1024||!Number.isSafeInteger(record.expiresAt))throw Error('invalid-casting-owner-snapshot')
        if(record.expiresAt<=now())continue
        const id=key(record.binding)
        if(restored.has(id))throw Error('duplicate-casting-owner-snapshot')
        restored.set(id,{...record,binding:Object.fromEntries(fields.map(field=>[field,record.binding[field]]))})
      }
      records.clear();for(const [id,record]of restored)records.set(id,record)
    },
    snapshot(){
      const result=[]
      for(const [id,record]of records){
        if(record.expiresAt<=now()){records.delete(id);continue}
        result.push({...record,binding:{...record.binding}})
      }
      return {schemaVersion:1,records:result}
    },
    acquire(binding,ownerId){
      if(!valid(binding)||typeof ownerId!=='string'||!ownerId||ownerId.length>1024||live(binding))return undefined
      const proof=createProof()
      if(typeof proof!=='string'||!proof||proof.length>1024)throw Error('invalid-casting-owner-proof')
      const expiresAt=now()+ttlMs
      records.set(key(binding),{binding:Object.fromEntries(fields.map(field=>[field,binding[field]])),ownerId,proof,expiresAt})
      return {proof,expiresAt}
    },
    renew(binding,ownerId,proof){
      const record=live(binding)
      if(!record||!matches(record,binding)||record.ownerId!==ownerId||record.proof!==proof)return undefined
      record.expiresAt=now()+ttlMs
      return {expiresAt:record.expiresAt}
    },
    release(binding,ownerId,proof){
      const record=live(binding)
      if(!record||!matches(record,binding)||record.ownerId!==ownerId||record.proof!==proof)return false
      records.delete(key(binding));return true
    },
    isActive(binding){
      const record=live(binding)
      return !!record&&matches(record,binding)
    },
  }
}
