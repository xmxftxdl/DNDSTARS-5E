import {mkdir,readFile} from 'node:fs/promises'
import path from 'node:path'
import {createLongCastingOwnerLeases} from '../../shared/long-casting-owner-leases.mjs'
import {atomicRename,withWriteLock} from './file-atomic-store.mjs'

/** filePath must be derived from a trusted server private directory, never a URL
 * parameter or a public shared-state resource. Authentication is the caller's job.
 * Every process reads the same lease under a cross-process lock. No casting
 * progress is persisted; a restarted server can only honor an unexpired owner.
 */
export function createLongCastingOwnerFileStore({filePath,...options}){
  if(typeof filePath!=='string'||!path.isAbsolute(filePath))throw Error('invalid-casting-owner-file-path')
  const execute=async(operation)=>{
    await mkdir(path.dirname(filePath),{recursive:true})
    return withWriteLock(filePath,async()=>{
      const store=createLongCastingOwnerLeases(options)
      try{store.restore(JSON.parse(await readFile(filePath,'utf8')))}catch(error){
        // Unreadable/corrupt ownership is not evidence that a live owner is absent.
        if(error?.code!=='ENOENT')throw error
      }
      const result=operation(store)
      await atomicRename(filePath,JSON.stringify(store.snapshot()))
      return result
    })
  }
  return {
    acquire:(binding,ownerId)=>execute(store=>store.acquire(binding,ownerId)),
    renew:(binding,ownerId,proof)=>execute(store=>store.renew(binding,ownerId,proof)),
    release:(binding,ownerId,proof)=>execute(store=>store.release(binding,ownerId,proof)),
    isActive:binding=>execute(store=>store.isActive(binding)),
  }
}
