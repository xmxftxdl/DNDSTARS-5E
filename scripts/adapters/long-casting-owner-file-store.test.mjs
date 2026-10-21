import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,writeFile} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {pathToFileURL} from 'node:url'
import {createLongCastingOwnerFileStore} from './long-casting-owner-file-store.mjs'
const binding={roomId:'room',mapId:'map',requestId:'cast',spellId:'package:spell',actorTokenId:'token',actorCharacterId:'character'}
const fixture=async()=>path.join(await mkdtemp(path.join(os.tmpdir(),'stars-casting-owner-test-')),'private','leases.json')
test('independent adapter instances agree on ownership and preserve renewal across server recreation',async()=>{
 const filePath=await fixture(),first=createLongCastingOwnerFileStore({filePath}),second=createLongCastingOwnerFileStore({filePath})
 const owned=await first.acquire(binding,'browser-a');assert.ok(owned)
 assert.equal(await second.isActive(binding),true)
 assert.equal(await second.acquire(binding,'browser-b'),undefined)
 assert.ok(await second.renew(binding,'browser-a',owned.proof))
 assert.equal(await second.release(binding,'browser-b',owned.proof),false)
 assert.equal(await first.release(binding,'browser-a',owned.proof),true)
 assert.equal(await second.isActive(binding),false)
})
test('two separate Node processes cannot acquire the same live cast',async()=>{
 const filePath=await fixture(),url=pathToFileURL(path.resolve('scripts/adapters/long-casting-owner-file-store.mjs')).href
 const source=`import {createLongCastingOwnerFileStore} from ${JSON.stringify(url)};const store=createLongCastingOwnerFileStore({filePath:process.argv[1]});const result=await store.acquire(JSON.parse(process.argv[2]),process.argv[3]);console.log(JSON.stringify({won:!!result}));`
 const run=promisify(execFile)
 const results=await Promise.all(['browser-a','browser-b'].map(owner=>run(process.execPath,['--input-type=module','-e',source,filePath,JSON.stringify(binding),owner],{windowsHide:true})))
 assert.equal(results.map(r=>JSON.parse(r.stdout).won).filter(Boolean).length,1)
 assert.equal(await createLongCastingOwnerFileStore({filePath}).isActive(binding),true)
})
test('corrupt ownership fails closed rather than allowing orphan cleanup or overwrite',async()=>{
 const filePath=await fixture(),store=createLongCastingOwnerFileStore({filePath})
 assert.ok(await store.acquire(binding,'owner'))
 const invalid='{"schemaVersion":1,"records":[{"binding":{}}]}'
 await writeFile(filePath,invalid)
 await assert.rejects(()=>store.isActive(binding),/invalid-casting-owner-snapshot/)
 await assert.rejects(()=>store.acquire(binding,'other'),/invalid-casting-owner-snapshot/)
 assert.equal(await readFile(filePath,'utf8'),invalid)
})
test('expiry is preserved across recreation and old proof cannot delete a replacement',async()=>{
 const filePath=await fixture();let time=0
 const first=createLongCastingOwnerFileStore({filePath,now:()=>time}),old=await first.acquire(binding,'old')
 time=30000
 const next=createLongCastingOwnerFileStore({filePath,now:()=>time})
 assert.equal(await next.isActive(binding),false)
 const replacement={...binding,requestId:'next'},owned=await next.acquire(replacement,'new');assert.ok(owned)
 assert.equal(await first.release(binding,'old',old.proof),false)
 assert.equal(await first.isActive(replacement),true)
 const snapshot=JSON.parse(await readFile(filePath,'utf8'))
 assert.equal(snapshot.records.length,1)
 assert.equal(Object.keys(snapshot.records[0]).sort().join(','),'binding,expiresAt,ownerId,proof')
})
