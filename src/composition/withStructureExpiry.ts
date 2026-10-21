import type {SharedRoomGatewayPort,SharedResourceTransactionWrite,SharedResourceWriteOptions} from '../ports/sharedRoomGateway'
import type {BattleMap} from '../store/maps'
import type {SharedMapGeometryState,MapGeometryState} from '../lib/mapGeometry'
import {prepareDnd5eStructureExpiry} from '../rulesets/dnd5e/structureExpiry'
import {recordStructureCasting,recordDailyStructureCasting} from '../../shared/structure-casting-history.mjs'
import {expireDnd5eStructureMapObjects} from '../rulesets/dnd5e/structureObjectExpiry'
import {expireDnd5eStructureInventoryItems} from '../rulesets/dnd5e/items'
import type {Dnd5eStructureObjectBinding} from '../rulesets/dnd5e/structureObjectBinding'
import type {Character} from '../types/character'
import {normalizeSharedCampaignTime} from '../lib/campaignTime'
import {settleDnd5eTempleCampaignTime} from '../rulesets/dnd5e/templeCampaignSettlement'
import type {SharedCombatState} from '../lib/sharedCombatTypes'

type Versioned={_sync?:{revision?:number}}
type Maps=Versioned&{maps:BattleMap[];updatedAt:number}
type Geometry=Versioned&SharedMapGeometryState
type Options=SharedResourceWriteOptions&{transactionId?:string}
export type TempleExpirySettlement = (input:{map:BattleMap;geometry:MapGeometryState;characters:readonly Character[];worldMinute:number;combat?:SharedCombatState|null}) => Promise<{
 map:BattleMap;geometry:MapGeometryState;characters:readonly Character[];expiredIds:readonly string[];combat?:SharedCombatState
}>

/** Clock, disappearing geometry and harmless descent share one revision-checked commit. */
export function withStructureExpiry(gateway:SharedRoomGatewayPort,settleTempleExpiry?:TempleExpirySettlement):SharedRoomGatewayPort {
 const commit=async(writes:readonly SharedResourceTransactionWrite[],options?:Options)=>{
  const clockWrite=writes.find(write=>write.name==='campaign-time')
  const geometryWrite=writes.find(write=>write.name==='map-geometry')
  const suppliedGeometry=geometryWrite?.data as Geometry|undefined
  if(!clockWrite&&!suppliedGeometry?.maps.some(scene=>scene.structureLifetimes?.length))return gateway.saveResourcesAtomically(writes,options)
  const storedClock=clockWrite?null:await gateway.loadResource<Versioned&{worldMinute:number}>('campaign-time')
  const minute=((clockWrite?.data??storedClock) as {worldMinute?:number})?.worldMinute
  if(!Number.isSafeInteger(minute)||minute!<0)throw new Error('structure-expiry-clock-invalid')
  const [storedMaps,storedGeometry]=await Promise.all([gateway.loadResource<Maps>('maps'),gateway.loadResource<Geometry>('map-geometry')])
  const mapWrite=writes.find(write=>write.name==='maps')
  let maps=(mapWrite?.data as Maps|undefined)??storedMaps
  const geometry=(geometryWrite?.data as Geometry|undefined)??storedGeometry
  const revision=(value:Versioned|null)=>value?._sync?.revision??0
  const readRevisions={...options?.readRevisions}
  if(!clockWrite)readRevisions['campaign-time']??=revision(storedClock)
  if(!mapWrite)readRevisions.maps??=revision(storedMaps)
  if(!geometryWrite)readRevisions['map-geometry']??=revision(storedGeometry)
  let changed=false
  let templeRosterWrite:SharedResourceTransactionWrite|undefined
  let templeCombatWrite:SharedResourceTransactionWrite|undefined
  if(clockWrite&&maps&&geometry&&[geometry,storedGeometry].some(snapshot=>snapshot?.maps.some(scene=>scene.structureLifetimes?.some(record=>record.templeWard)))){
    type Roster=Versioned&{characters:Character[]}
    const existing=writes.find(write=>write.name==='characters')
    const stored=await gateway.loadResource<Roster>('characters')
    const roster=(existing?.data as Roster|undefined)??stored
    if(!existing)readRevisions.characters??=revision(stored)
    const settled=settleDnd5eTempleCampaignTime({maps:maps.maps,geometry:geometry.maps,priorMaps:storedMaps?.maps,priorGeometry:storedGeometry?.maps,
      characters:roster?.characters??[],clock:normalizeSharedCampaignTime(clockWrite.data)})
    if(settled.changed){
      changed=true;maps={...maps,maps:settled.maps}
      if(roster&&settled.characters.some((character,index)=>character!==roster.characters[index])){
        const expectedRevision=existing?.expectedRevision??readRevisions.characters??revision(stored)
        if(readRevisions.characters!=null&&readRevisions.characters!==expectedRevision)throw new Error('structure-expiry-revision-conflict')
        delete readRevisions.characters
        templeRosterWrite={name:'characters',data:{...roster,characters:settled.characters},expectedRevision}
      }
    }
  }
  const arrivals=geometryWrite?geometry?.maps.flatMap(scene=>(scene.structureLifetimes??[])
    .filter(record=>record.replacementGroup&&!storedGeometry?.maps.find(old=>old.mapId===scene.mapId)?.structureLifetimes?.some(old=>old.id===record.id))
    .map(record=>({mapId:scene.mapId,record})))??[]:[]
  for(const arrival of arrivals)if(arrival.record.replacementGroup==='mighty-fortress'&&arrivals.some(other=>other!==arrival&&other.record.casterId===arrival.record.casterId&&
    other.record.replacementGroup===arrival.record.replacementGroup&&(other.mapId!==arrival.mapId||other.record.siteKey!==arrival.record.siteKey)))throw new Error('structure-replacement-conflict')
  const nextMaps=[...maps?.maps??[]]
  const expired:Dnd5eStructureObjectBinding[]=[]
  const nextGeometry:MapGeometryState[]=[]
  for(let scene of geometry?.maps??[]){
    if(!scene.structureLifetimes?.length){nextGeometry.push(scene);continue}
    const fortressArrivals=arrivals.filter(arrival=>arrival.mapId===scene.mapId&&arrival.record.replacementGroup==='mighty-fortress')
    if(fortressArrivals.length){
      let history=storedGeometry?.maps.find(old=>old.mapId===scene.mapId)?.structureCastingHistory
      let lifetimes=scene.structureLifetimes??[]
      for(const arrival of fortressArrivals){
        // Existing campaign convention: 365 days/year, 1440 world minutes/day.
        const recorded=recordStructureCasting(history,arrival.record,minute!,7*1440,365*1440)
        history=recorded.history
        lifetimes=lifetimes.map(record=>record.id===arrival.record.id?{...record,expiresWorldMinute:recorded.permanent?null:minute!+10080}:record)
      }
      scene={...scene,structureCastingHistory:history,structureLifetimes:lifetimes}
      changed=true
    }
    const templeArrivals=arrivals.filter(arrival=>arrival.mapId===scene.mapId&&arrival.record.replacementGroup==='temple-of-the-gods')
    if(templeArrivals.length){
      let history=fortressArrivals.length?scene.structureCastingHistory:storedGeometry?.maps.find(old=>old.mapId===scene.mapId)?.structureCastingHistory
      let lifetimes=scene.structureLifetimes??[]
      for(const arrival of templeArrivals){
        const recorded=recordDailyStructureCasting(history,arrival.record,minute!)
        history=recorded.history
        lifetimes=lifetimes.map(record=>record.id===arrival.record.id?{...record,expiresWorldMinute:recorded.permanent?null:minute!+1440}:record)
      }
      scene={...scene,structureCastingHistory:history,structureLifetimes:lifetimes}
      changed=true
    }
    const index=nextMaps.findIndex(map=>map.id===scene.mapId)
    if(index<0)throw new Error('structure-expiry-map-missing')
    if(settleTempleExpiry&&scene.structureLifetimes?.some(record=>record.templeWard&&record.replacementGroup==='temple-of-the-gods'&&
      record.expiresWorldMinute!=null&&record.expiresWorldMinute<=minute!)){
      type Roster=Versioned&{characters:Character[]}
      const existing=templeRosterWrite??writes.find(write=>write.name==='characters')
      const stored=await gateway.loadResource<Roster>('characters')
      const roster=(existing?.data as Roster|undefined)??stored
      const expectedRevision=existing?.expectedRevision??readRevisions.characters??revision(stored)
      if(readRevisions.characters!=null&&readRevisions.characters!==expectedRevision)throw new Error('structure-expiry-revision-conflict')
      // Read revisions captured before interactive dice/reactions remain authoritative.
      // The callback only returns a plan and must not save or mutate any live store.
      readRevisions.characters??=expectedRevision
      const templeIds=scene.structureLifetimes.filter(record=>record.templeWard&&record.replacementGroup==='temple-of-the-gods'&&
        record.expiresWorldMinute!=null&&record.expiresWorldMinute<=minute!).map(record=>record.id)
      const combatWrite=templeCombatWrite??writes.find(write=>write.name==='combat')
      const storedCombat=await gateway.loadResource<Versioned&SharedCombatState>('combat')
      const combat=(combatWrite?.data as SharedCombatState|undefined)??storedCombat
      if(!combatWrite)readRevisions.combat??=revision(storedCombat)
      const settled=await settleTempleExpiry({map:nextMaps[index],geometry:scene,characters:roster?.characters??[],worldMinute:minute!,combat})
      if(settled.map.id!==scene.mapId||settled.geometry.mapId!==scene.mapId||settled.expiredIds.length!==templeIds.length||
        new Set(settled.expiredIds).size!==templeIds.length||templeIds.some(id=>!settled.expiredIds.includes(id)||
          settled.geometry.structureLifetimes?.some(record=>record.id===id)))throw new Error('temple-expiry-incomplete-settlement')
      nextMaps[index]=settled.map;scene=settled.geometry;changed=true
      expired.push(...settled.expiredIds.map(structureId=>({schemaVersion:1 as const,mapId:scene.mapId,structureId})))
      if(roster){
        delete readRevisions.characters
        templeRosterWrite={name:'characters',data:{...roster,characters:settled.characters},expectedRevision}
      }
      if(settled.combat){
        const expectedRevision=combatWrite?.expectedRevision??readRevisions.combat??revision(storedCombat)
        if(readRevisions.combat!=null&&readRevisions.combat!==expectedRevision)throw new Error('structure-expiry-revision-conflict')
        delete readRevisions.combat
        templeCombatWrite={name:'combat',data:settled.combat,expectedRevision}
      }
    }
    const replaced=(scene.structureLifetimes??[]).filter(record=>record.replacementGroup==='mighty-fortress'&&arrivals.some(arrival=>
      arrival.record.casterId===record.casterId&&arrival.record.replacementGroup===record.replacementGroup&&
      (arrival.mapId!==scene.mapId||arrival.record.siteKey!==record.siteKey||
        record.replacementGroup==='mighty-fortress'&&arrival.record.id!==record.id))).map(record=>record.id)
    const result=prepareDnd5eStructureExpiry(nextMaps[index],scene,minute!,replaced)
    expired.push(...result.expiredIds.map(structureId=>({schemaVersion:1 as const,mapId:scene.mapId,structureId})))
    if(result.changed){changed=true;nextMaps[index]=result.map}
    nextGeometry.push(result.geometry)
  }
  const nextWrites=[...writes]
  if(templeCombatWrite){const index=nextWrites.findIndex(write=>write.name==='combat');if(index<0)nextWrites.push(templeCombatWrite);else nextWrites[index]=templeCombatWrite}
  if(templeRosterWrite){
    const index=nextWrites.findIndex(write=>write.name==='characters')
    if(index<0)nextWrites.push(templeRosterWrite);else nextWrites[index]=templeRosterWrite
  }
  if(changed&&maps&&geometry&&nextGeometry){
    const replace=(name:string,data:unknown,stored:Versioned|null)=>{
      const index=nextWrites.findIndex(write=>write.name===name)
      const expectedRevision=(index<0?undefined:nextWrites[index].expectedRevision)??readRevisions[name]??revision(stored)
      if(readRevisions[name]!=null&&readRevisions[name]!==expectedRevision)throw new Error('structure-expiry-revision-conflict')
      const write={name,data,expectedRevision}
      delete readRevisions[name]
      if(index<0)nextWrites.push(write);else nextWrites[index]=write
    }
    if(expired.length){
      for(let index=0;index<nextMaps.length;index++)nextMaps[index]=expireDnd5eStructureMapObjects(nextMaps[index],expired)
      type Roster=Versioned&{characters:Character[]}
      const characterWrite=nextWrites.find(write=>write.name==='characters')
      const storedCharacters=await gateway.loadResource<Roster>('characters')
      const roster=(characterWrite?.data as Roster|undefined)??storedCharacters
      if(!characterWrite)readRevisions.characters??=revision(storedCharacters)
      if(roster){
        const characters=roster.characters.map(character=>expireDnd5eStructureInventoryItems(character,expired))
        if(characters.some((character,index)=>character!==roster.characters[index]))replace('characters',{...roster,characters},storedCharacters)
      }
    }
    replace('maps',{...maps,maps:nextMaps},storedMaps)
    replace('map-geometry',{...geometry,maps:nextGeometry},storedGeometry)
  }
  return gateway.saveResourcesAtomically(nextWrites,{...options,readRevisions})
 }
 return {...gateway,saveResourcesAtomically:commit,
  mutateResource:async<T>(name:string,endpoint:string,mutation:unknown):Promise<T>=>{
    try{return await gateway.mutateResource<T>(name,endpoint,mutation)}
    catch(error){
      if(!settleTempleExpiry||name!=='campaign-time'||endpoint!=='/state/campaign-time/mutation'||
        !(error instanceof Error)||error.message!=='temple-expiry-settlement-required')throw error
      const prepared=await gateway.mutateResource<{ok:boolean;prepared?:boolean;plan?:{
        writes:SharedResourceTransactionWrite[];readRevisions:Record<string,number>
      }}>(name,endpoint+'?prepare=1',mutation)
      if(!prepared.ok||!prepared.prepared||!prepared.plan?.writes.some(write=>write.name==='campaign-time')){
        throw new Error('temple-expiry-preparation-invalid')
      }
      await commit(prepared.plan.writes,{readRevisions:prepared.plan.readRevisions})
      const saved=await gateway.loadResource<T>(name)
      if(!saved)throw new Error('temple-expiry-clock-missing')
      return saved
    }
  },
  saveResource:async(name,data,options)=>{
    if(name!=='campaign-time'&&name!=='map-geometry')return gateway.saveResource(name,data,options)
    await commit([{name,data,expectedRevision:gateway.getRevisionWatermark(name)}],options)
  },
  saveResourceWithResult:async(name,data,options)=>{
    if(name!=='campaign-time'&&name!=='map-geometry')return gateway.saveResourceWithResult(name,data,options)
    const result=await commit([{name,data,expectedRevision:gateway.getRevisionWatermark(name)}],options)
    return {status:'saved',revision:result.revisions[name]}
  },
 }
}
