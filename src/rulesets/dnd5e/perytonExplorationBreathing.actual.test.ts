/// <reference types="node" />
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {expect,it,vi} from 'vitest'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {createNativeEnvelopeApi} from '../../pages/maps/mastermindMagicFamilies.fixture'
import {readLegacyDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {listRegisteredDnd5eActivityPackages} from './activities/dnd5eActivityRegistry'
import {getDnd5eSrdMonster} from './monsters'
import {planDnd5eSummonedCreature} from './summonedCreatures'
import {createDnd5eConditionEffect} from './activeEffects'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {syncDnd5eSubmergedBreathingClock} from './headlessCombatEngine'
import {planCampaignSubmergedBreathing} from '../../../shared/campaign-submerged-breathing.mjs'
import type {BattleMap,Token} from '../../store/maps'

it('actual installed Greater Steed Peryton summon projection matches Native Constitution in the authoritative named Host clock',async()=>{
 const file='.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/private-base152-prospective155-round2.starmod',bytes=fs.readFileSync(file)
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('b62851790a2e421b04fc42bf64c77372d7d3a7931c2ffbce62f9705c269a02f9')
 const imported=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!imported)throw Error('Actual557 standard import required')
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package))
 try{
  const registered=listRegisteredDnd5eActivityPackages().find(p=>p.packageId===imported.package.manifest.id),activity=registered?.activities.find(a=>a.id==='find-greater-steed-cast'||a.id===imported.package.manifest.id+':find-greater-steed-cast')
  if(!activity)throw Error('Actual registered Greater Steed activity required')
  const operation=activity.outcomes.flatMap(o=>o.operations).find(op=>op.kind==='summon'&&op.monsterId==='room-monster:peryton'&&op.creatureTypeOverride==='fey')
  if(!operation||operation.kind!=='summon')throw Error('Actual registered Fey Peryton operation required')
  expect(operation.controlSave).toBeUndefined();expect(operation.persistent).toBe(true);const monster=getDnd5eSrdMonster(operation.monsterId);expect(monster?.abilities.con).toBe(13)
  // This is the genuine summon-token planner projection, not a cast/slot claim.
  const source:Token={id:'source-token',type:'npc',poolId:'srd-5.1:commoner',label:'Source fixture',x:25,y:25,size:1,color:'',emoji:'',hp:4,maxHp:4}
  const map:BattleMap={id:'peryton-water',name:'Peryton water',width:1000,height:1000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[source]}
  const result=planDnd5eSummonedCreature({map,actorToken:source,sourceCharacterId:'source-character',featureId:activity.id,sourceSpellId:imported.package.manifest.id+':find-greater-steed',pluginId:imported.package.manifest.id,actionId:'actual-peryton-projection',round:1,targetCell:{col:4,row:0},initiativeD20:10,summon:{monsterId:operation.monsterId,durationRounds:1,side:operation.side??'ally',concentration:operation.concentration??false,persistent:operation.persistent,bondKey:operation.bondKey,creatureTypeOverride:operation.creatureTypeOverride,minimumIntelligence:operation.minimumIntelligence,shareSelfSpellsRangeFeet:operation.shareSelfSpellsRangeFeet,shareSelfSpellsRequiresMounted:operation.shareSelfSpellsRequiresMounted,telepathyRangeFeet:operation.telepathyRangeFeet,understoodLanguage:'common'}})
  if(!result.ok)throw Error(result.reason)
  expect(result.plan.token.poolId).toBe('room-monster:peryton');expect(result.plan.token.dnd5eSimulacrum).toBeUndefined()
  const water=createDnd5eConditionEffect({id:'peryton-underwater',condition:'restrained',targetId:result.plan.token.id,source:{kind:'system',actorId:source.id,rulesId:'underwater-environment'},modifiers:{submerged:true}})
  const token={...result.plan.token,dnd5eCombatState:{...result.plan.token.dnd5eCombatState,schemaVersion:2 as const,activeEffects:[water]}},wet={...map,tokens:[source,token]}
  const native=createDnd5eMapCombatSnapshot({map:wet,characters:[],combatId:'actual-peryton-water',round:1,initiativeOrder:[result.plan.initiativeEntry]}),target=native.state.combatants[token.id]
  expect(target.abilities.con).toBe(13);syncDnd5eSubmergedBreathingClock(native.state);expect(target.classState.submergedBreathing?.breathCapacitySeconds).toBe(120)
  const before=JSON.stringify(wet),planned=planCampaignSubmergedBreathing({maps:[wet],characters:[],previousClock:{worldMinute:0,worldSecondRemainder:0,advances:[]},nextClock:{worldMinute:0,worldSecondRemainder:6,advances:[]}})
  expect(JSON.stringify(wet)).toBe(before);expect(planned.updates).toHaveLength(1)
  // Without verified Host source data the pure planner keeps its existing
  // conservative fallback. The public clock route must load the actual source.
  expect(planned.updates[0].state?.breathCapacitySeconds).toBe(60)
  const packageBytes=fs.readFileSync('.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/canonical-round2.json'),packageValue=JSON.parse(packageBytes.toString('utf8'))
  expect(packageValue.manifest.id).toBe(imported.package.manifest.id)
  expect(packageValue.content.monsters.find((m:{id:string})=>m.id===operation.monsterId).abilities.con).toBe(13)
  let fixtureRoot:string|undefined;const originalMkdtemp=fsp.mkdtemp.bind(fsp),capture=vi.spyOn(fsp,'mkdtemp').mockImplementation(async(...args:Parameters<typeof fsp.mkdtemp>)=>{const p=await originalMkdtemp(...args);fixtureRoot=String(p);return p})
  let api:Awaited<ReturnType<typeof createNativeEnvelopeApi>>
  try{api=await createNativeEnvelopeApi({characters:{characters:[]},maps:{maps:[wet]},'campaign-time':{worldMinute:480,worldSecondRemainder:0,advances:[]}})}finally{capture.mockRestore()}
  if(!fixtureRoot)throw Error('Actual server fixture root required')
  const roomPath=path.join(fixtureRoot,'lobby','room.json'),room=JSON.parse(await fsp.readFile(roomPath,'utf8')),id=packageValue.manifest.id,integrity='sha256-'+createHash('sha256').update(packageBytes).digest('base64'),metadata={...packageValue.manifest,integrity,storageFile:'peryton-source.dndstars5e'},pluginDir=path.join(fixtureRoot,'lobby','plugins','room'),pluginFile=path.join(pluginDir,metadata.storageFile)
  await fsp.mkdir(pluginDir,{recursive:true});await fsp.writeFile(pluginFile,packageBytes);await fsp.writeFile(roomPath,JSON.stringify({...room,requiredPlugins:[metadata],pluginFiles:{[id]:metadata}}))
  const response=await api.post('campaign-time/mutation',{operation:'advance',minutes:1},'dm','PATCH');expect(response.status).toBe(200)
  const persistedMaps=await api.read('maps'),persisted=persistedMaps.maps[0].tokens.find((t:{id:string})=>t.id===token.id)
  expect(persisted.dnd5eCombatState.submergedBreathing.breathCapacitySeconds).toBe(120)
  expect(persisted.dnd5eCombatState.submergedBreathing.breathSeconds).toBe(60)
  const disk=JSON.parse(await fsp.readFile(path.join(fixtureRoot,'rooms','room','maps.json'),'utf8'))
  expect(disk.maps[0].tokens.find((t:{id:string})=>t.id===token.id)).toEqual(persisted)
  const names=['characters','maps','campaign-time','map-geometry'],locked=await Promise.all(names.map(api.read));await fsp.writeFile(pluginFile,Buffer.concat([packageBytes,Buffer.from(' ')]))
  const refused=await api.post('campaign-time/mutation',{operation:'advance',minutes:1},'dm','PATCH');expect(refused.status).toBe(409);expect(refused.payload.error).toBe('plugin-integrity-mismatch');expect(await Promise.all(names.map(api.read))).toEqual(locked)
 }finally{dispose()}
},60000)
