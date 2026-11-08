/// <reference types="node" />
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {it,expect,vi} from 'vitest'
import {mutateEffectEndConfirmedReceipt} from '../../../shared/effect-end-confirmed-receipt.mjs'
import {mergeConfirmedEffectEndSave} from './confirmedEffectEndSave'
import {createNativeEnvelopeApi} from './mastermindMagicFamilies.fixture'
const actual=JSON.parse(fs.readFileSync(new URL('./testFixtures/effectEndConfirmedReceipt.native-capture.fixture.json',import.meta.url),'utf8'))
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value))
const host={roomId:'room',memberId:'dm',hostMemberId:'dm',role:'dm'}
const mapId:string=actual.before.maps[0].id
const snapshot=()=>({...clone(actual.before),combat:clone(actual.combat)})
const receipt=()=>({before:clone(actual.before),after:clone(actual.after)})
const key=(world=snapshot())=>{const value=mutateEffectEndConfirmedReceipt(null,world,host,'read',{mapId},0).contextKey;if(typeof value!=='string')throw Error('Canonical server context required');return value}

it('does not authorize starting a save from a locally pending view until the canonical pending effect has been published',async()=>{
 const api=await createNativeEnvelopeApi({maps:{maps:clone(actual.after.maps)},characters:{characters:clone(actual.after.characters)},combat:clone(actual.combat)})
 const empty=(await api.post('effect-end-confirmed/read',{mapId})).payload
 expect(empty.hasPending).toBe(false);expect(empty.receipt).toBeNull()
 const maps=await api.read('maps'),characters=await api.read('characters')
 await api.gateway.saveResourcesAtomically([
  {name:'maps',expectedRevision:maps._sync.revision,data:{...maps,maps:clone(actual.before.maps)}},
  {name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:clone(actual.before.characters)}}
 ],{transactionId:'publish-actual-canonical-pending-fixture',readRevisions:{}})
 const current=(await api.post('effect-end-confirmed/read',{mapId})).payload
 expect(current.hasPending).toBe(true);expect(current.contextKey).not.toBe(empty.contextKey)
 expect((await api.post('effect-end-confirmed/record',{mapId,contextKey:empty.contextKey,receipt:receipt()})).status).toBe(409)
 expect((await api.post('effect-end-confirmed/record',{mapId,contextKey:current.contextKey,receipt:receipt()})).status).toBe(200)
},60000)

it('preserves the exact actual Native confirmation across a fresh caller and rebases unrelated edits without rolling again',()=>{
 const world=snapshot(),prior=JSON.stringify(world),confirmed=receipt()
 const recorded=mutateEffectEndConfirmedReceipt(null,world,host,'record',{mapId,contextKey:key(world),receipt:confirmed},1)
 expect(recorded.ok).toBe(true);expect(recorded.changed).toBe(true)
 const saved=clone(recorded.next),read=mutateEffectEndConfirmedReceipt(saved,world,{...host},'read',{mapId},2)
 expect(read.ok).toBe(true);expect(read.changed).toBe(false);expect(read.receipt).toEqual(confirmed)
 expect(JSON.stringify(world)).toBe(prior)
 const current=clone(world);current.characters[0].name='Concurrent display-name edit'
 const restored=read.receipt as typeof confirmed
 const merged=mergeConfirmedEffectEndSave(restored.before,restored.after,{maps:current.maps,characters:current.characters})
 expect(merged.characters[0].name).toBe('Concurrent display-name edit')
 expect(merged.characters[0].tempHp).toBe(0)
 expect(merged.characters[0].classResources['dnd5e-spell-slot-6'].current).toBe(0)
 expect((merged.characters[0].dnd5eCombatState.activeEffects??[]).some((e:any)=>e.pendingEndSavingThrow)).toBe(false)
 expect(mutateEffectEndConfirmedReceipt(saved,current,host,'record',{mapId,contextKey:key(current),receipt:confirmed},3).changed).toBe(false)
})

it('refuses non-Host writes, forged before snapshots, changed confirmed results and unresolved resolutions',()=>{
 const world=snapshot(),confirmed=receipt(),saved=mutateEffectEndConfirmedReceipt(null,world,host,'record',{mapId,contextKey:key(world),receipt:confirmed},1).next
 for(const identity of [{...host,role:'player'},{...host,memberId:'other'},{...host,hostMemberId:'other'}]){
  const result=mutateEffectEndConfirmedReceipt(null,world,identity,'record',{mapId,contextKey:key(world),receipt:confirmed},2)
  expect(result.ok).toBe(false);expect(result.status).toBe(403);expect(result.changed).toBe(false)
 }
 const forged=receipt();forged.before.characters[0].hp--
 expect(mutateEffectEndConfirmedReceipt(null,world,host,'record',{mapId,contextKey:key(world),receipt:forged},2).error).toBe('effect-end-receipt:canonical-before-changed')
 const changed=receipt();changed.after.characters[0].hp--
 expect(mutateEffectEndConfirmedReceipt(saved,world,host,'record',{mapId,contextKey:key(world),receipt:changed},2).error).toBe('effect-end-receipt:already-confirmed-different-result')
 expect(mutateEffectEndConfirmedReceipt(null,world,host,'record',{mapId,contextKey:key(world),receipt:{before:clone(actual.before),after:clone(actual.before)}},2).error).toBe('effect-end-receipt:unconfirmed-ending-resolution')
 const newer=snapshot();newer.combat.combatId+='-changed-after-read'
 expect(mutateEffectEndConfirmedReceipt(null,newer,host,'record',{mapId,contextKey:key(world),receipt:confirmed},2).error).toBe('effect-end-receipt:context-changed-before-confirmation')
})

it('does not restore another room, map, pending effect, combat generation or effective rule source',()=>{
 const world=snapshot(),saved=mutateEffectEndConfirmedReceipt(null,world,host,'record',{mapId,contextKey:key(world),receipt:receipt()},1).next
 expect(mutateEffectEndConfirmedReceipt(saved,world,{...host,roomId:'other-room'},'read',{mapId},2).ok).toBe(false)
 expect(mutateEffectEndConfirmedReceipt(saved,world,host,'read',{mapId:'other-map'},2).ok).toBe(false)
 const pendingChanged=snapshot();pendingChanged.characters[0].dnd5eCombatState.activeEffects.find((e:any)=>e.pendingEndSavingThrow).id+='-different-occurrence'
 const generationChanged=snapshot();generationChanged.combat.combatId+='-different-generation'
 const sourceChanged=snapshot();sourceChanged.combat.effectiveRules={...sourceChanged.combat.effectiveRules,requiredPlugins:[]}
 for(const current of [pendingChanged,generationChanged,sourceChanged,{...clone(actual.after),combat:clone(actual.combat)}]){
  const result=mutateEffectEndConfirmedReceipt(saved,current,host,'read',{mapId},2)
  expect(result.ok).toBe(true);expect(result.receipt).toBeNull();expect(result.changed).toBe(false)
 }
})

it('the authenticated Node handler stores only a private receipt, allows a fresh Host read, and rejects player access without world writes',async()=>{
 let fixtureRoot:string|undefined
 const original=fsp.mkdtemp.bind(fsp),capture=vi.spyOn(fsp,'mkdtemp').mockImplementation(async(...args:Parameters<typeof fsp.mkdtemp>)=>{const result=await original(...args);fixtureRoot=String(result);return result})
 let api:Awaited<ReturnType<typeof createNativeEnvelopeApi>>
 try{api=await createNativeEnvelopeApi({maps:{maps:clone(actual.before.maps)},characters:{characters:clone(actual.before.characters)},combat:clone(actual.combat)})}finally{capture.mockRestore()}
 if(!fixtureRoot)throw Error('Actual server fixture directory required')
 const names=['maps','characters','combat','player-action-requests','player-action-processed','player-action-ack','combat-log']
 const before=await Promise.all(names.map(api.read))
 const context=(await api.post('effect-end-confirmed/read',{mapId})).payload.contextKey
 expect(typeof context).toBe('string')
 const refused=await api.post('effect-end-confirmed/record',{mapId,contextKey:context,receipt:receipt()},'player')
 expect(refused.status).toBe(403)
 const recorded=await api.post('effect-end-confirmed/record',{mapId,contextKey:context,receipt:receipt()})
 expect(recorded.status).toBe(200);expect(recorded.payload.receipt).toEqual(receipt())
 const disk=path.join(fixtureRoot,'rooms','room','.host-confirmed','effect-end-saves.json')
 const bytes=await fsp.readFile(disk,'utf8')
 const read=await api.post('effect-end-confirmed/read',{mapId})
 expect(read.status).toBe(200);expect(read.payload.receipt).toEqual(receipt())
 expect((await api.post('effect-end-confirmed/read',{mapId},'player')).status).toBe(403)
 expect((await api.post('effect-end-saves',{},'player','GET')).status).toBe(404)
 const changed=receipt();changed.after.characters[0].hp--
 expect((await api.post('effect-end-confirmed/record',{mapId,contextKey:context,receipt:changed})).status).toBe(409)
 expect(await fsp.readFile(disk,'utf8')).toBe(bytes)
 expect(await Promise.all(names.map(api.read))).toEqual(before)
},60000)

it('rejects the old two-document commit if the combat generation changes after confirmation, retaining the receipt and both world documents',async()=>{
 const api=await createNativeEnvelopeApi({maps:{maps:clone(actual.before.maps)},characters:{characters:clone(actual.before.characters)},combat:clone(actual.combat)})
 const scope=(await api.post('effect-end-confirmed/read',{mapId})).payload
 const recorded=await api.post('effect-end-confirmed/record',{mapId,contextKey:scope.contextKey,receipt:receipt()})
 expect(recorded.status).toBe(200)
 expect(recorded.payload.combatRevision).toBe(scope.combatRevision)
 const privateBefore=await api.read('.host-confirmed/effect-end-saves')
 expect(privateBefore.maps[mapId].receipt).toEqual(receipt())
 const maps=await api.read('maps'),characters=await api.read('characters'),combat=await api.read('combat')
 await api.gateway.saveResourcesAtomically([{name:'combat',expectedRevision:combat._sync.revision,data:{...combat,combatId:combat.combatId+'-next-generation'}}],{transactionId:'actual-other-combat-generation',readRevisions:{}})
 const refused=await api.post('transaction',{transactionId:'effect-end-save:confirmed-old-generation',readRevisions:{combat:scope.combatRevision},writes:[
  {name:'maps',expectedRevision:maps._sync.revision,data:{...maps,maps:clone(actual.after.maps)}},
  {name:'characters',expectedRevision:characters._sync.revision,data:{...characters,characters:clone(actual.after.characters)}}
 ]})
 expect(refused.status).toBe(409)
 expect(await api.read('maps')).toEqual(maps);expect(await api.read('characters')).toEqual(characters)
 expect(await api.read('.host-confirmed/effect-end-saves')).toEqual(privateBefore)
 const currentScope=(await api.post('effect-end-confirmed/read',{mapId})).payload
 expect(currentScope.receipt).toBeNull();expect(currentScope.contextKey).not.toBe(scope.contextKey)
 expect(currentScope.combatRevision).toBeGreaterThan(scope.combatRevision)
},60000)

it('the transport treats an absent character document as an empty roster without creating that document (no NPC mechanics claim)',async()=>{
 const beforeMaps=clone(actual.before.maps),afterMaps=clone(actual.after.maps)
 for(const [maps,actor]of [[beforeMaps,actual.before.characters[0]],[afterMaps,actual.after.characters[0]]]){
  const token=maps[0].tokens[0]
  delete token.characterId;token.type='enemy';token.poolId='srd-5.1:goblin'
  token.dnd5eCombatState=clone(actor.dnd5eCombatState)
 }
 const api=await createNativeEnvelopeApi({maps:{maps:beforeMaps},combat:clone(actual.combat)})
 expect(await api.read('characters')).toBeNull()
 const scope=(await api.post('effect-end-confirmed/read',{mapId})).payload
 expect(typeof scope.contextKey).toBe('string')
 const delta={before:{maps:beforeMaps,characters:[]},after:{maps:afterMaps,characters:[]}}
 const stored=await api.post('effect-end-confirmed/record',{mapId,contextKey:scope.contextKey,receipt:delta})
 expect(stored.status).toBe(200)
 expect((await api.post('effect-end-confirmed/read',{mapId})).payload.receipt).toEqual(delta)
 expect(await api.read('characters')).toBeNull();expect((await api.read('maps')).maps).toEqual(beforeMaps)
},60000)
