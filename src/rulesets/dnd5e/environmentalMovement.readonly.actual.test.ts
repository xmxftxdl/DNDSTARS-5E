import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {it,expect,vi} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import * as catalog from './plugins/pluginContentCatalog'
import {readLegacyDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {growActualStormSoulBarbarian,advanceActualStormSoulEnvironment} from './stormSoulGrowth.fixture'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {createDnd5eCombatant,dnd5eDeclarativeEnvironmentalMovementSpeed} from './headlessCombatEngine'
import type {BattleMap} from '../../store/maps'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'

it('actual557 Sea6 and genuine next-level Tundra snapshots retain all values without discarded environmental catalog copies',async()=>{
 const bytes=fs.readFileSync('.codex-temp/xge-next-feature/root-merge-preparation/prospective155-package-r305-r1/private-base152-prospective155-round2.starmod')
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('b62851790a2e421b04fc42bf64c77372d7d3a7931c2ffbce62f9705c269a02f9')
 const imported=await readLegacyDnd5eStarMod(new Uint8Array(bytes).buffer);if(!imported)throw Error('Genuine557 import required')
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(imported.package))
 try{
  const subclass='local.xge.repaired.archer93:path-of-the-storm-herald',sea=growActualStormSoulBarbarian(subclass),tundra=advanceActualStormSoulEnvironment(sea,subclass,'tundra')
  expect(sea.level).toBe(6);expect(tundra.level).toBe(7)
  const map:BattleMap={id:'actual-environmental-read',name:'Actual snapshot',width:500,height:500,showGrid:true,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,tokens:[{id:'storm-token',characterId:sea.id,type:'player',label:sea.name,x:25,y:25,size:1,color:'',emoji:''}]}
  const snapshot=(character:typeof sea)=>createDnd5eMapCombatSnapshot({map,characters:[character],combatId:'real-environmental-source',round:1,initiativeOrder:[{tokenId:'storm-token',label:sea.name,roll:10,color:'',emoji:''}],geometry:{...createEmptyMapGeometry(map.id,1),environment:'outdoors'}})
  const before=JSON.stringify({map,sea,tundra})
  const referenceReader=typeof catalog.readonlyDnd5ePluginFeatureData==='function'?vi.spyOn(catalog,'readonlyDnd5ePluginFeatureData').mockImplementation(catalog.registeredDnd5ePluginFeatures):undefined
  let seaExpected:ReturnType<typeof snapshot>,tundraExpected:ReturnType<typeof snapshot>
  try{seaExpected=snapshot(sea);tundraExpected=snapshot(tundra)}finally{referenceReader?.mockRestore()}
  snapshot(sea);snapshot(tundra) // Warm only immutable metadata, never the numeric result.
  expect(seaExpected.state.combatants['storm-token'].canBreatheWater).toBe(true)
  expect(tundraExpected.state.combatants['storm-token'].canBreatheWater).not.toBe(true)
  expect(catalog.runtimeDnd5ePluginFeatures().length).toBeGreaterThan(100)
  const originalClone=globalThis.structuredClone;let environmentalCopies=0
  const counter=vi.spyOn(globalThis,'structuredClone').mockImplementation(function<T>(value:T,options?:StructuredSerializeOptions):T{
   if(value&&typeof value==='object'&&'ownerPluginId'in value&&'automation'in value&&(new Error().stack??'').includes('dnd5eDeclarativeEnvironmentalMovementSpeed'))environmentalCopies++
   return originalClone(value,options)
  })
  try{
   expect(snapshot(sea)).toEqual(seaExpected);expect(snapshot(tundra)).toEqual(tundraExpected)
   expect(environmentalCopies).toBe(0)
  }finally{counter.mockRestore()}
  expect(JSON.stringify({map,sea,tundra})).toBe(before)
  const actor=seaExpected.state.combatants['storm-token']
  for(const environment of ['outdoors','indoors',undefined] as const)for(const mode of ['fly','swim','climb'] as const)expect(dnd5eDeclarativeEnvironmentalMovementSpeed(actor,environment,mode)).toBeUndefined()
 }finally{dispose()}
},60000)

function actor(featureId:string){return createDnd5eCombatant({id:'qualified-flyer',name:'Flyer',controller:'player',initiative:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:3,armorClass:14,currentHp:40,maxHp:40,temporaryHp:0,speed:35,position:{x:0,y:0},concentrating:false,level:6,classId:'fighter',subclassId:'test.environmental-qualified:environmental-school',pluginFeatureIds:[featureId]})}
function install(extra:Record<string,unknown>={}){let featureId='';const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.environmental-qualified',name:'Actual environment control',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'Test only'},setup(api){const subclassId=api.registerSubclass({id:'environmental-school',classId:'fighter',name:'Environmental School',summary:'Test source',features:[{id:'source',level:3,name:'Source',description:'Source'}]});featureId=api.registerFeature({id:'outdoor-flight',name:'Outdoor Flight',summary:'Control',description:'Control',automation:'full',grantedBySubclass:true,sourceClassId:'fighter',sourceSubclassId:subclassId,minimumLevel:6,...extra,declarativeAbility:{schemaVersion:1,id:'outdoor-flight',name:'Outdoor Flight',description:'Control',level:1,trigger:{kind:'active-use'},targeting:{kind:'self'},effects:[],mechanic:{kind:'environmental-movement',environments:['outdoors'],mode:'fly',speed:'walking'},automation:'full'}})}});return{featureId,dispose}}

it('real registered environmental source keeps current class, level, subclass, scene, mode and registry checks',()=>{
 const f=install();const current=actor(f.featureId)
 try{
  expect(dnd5eDeclarativeEnvironmentalMovementSpeed(current,'outdoors','fly')).toBe(35)
  expect(dnd5eDeclarativeEnvironmentalMovementSpeed(current,'indoors','fly')).toBeUndefined()
  expect(dnd5eDeclarativeEnvironmentalMovementSpeed(current,'outdoors','swim')).toBeUndefined()
  for(const changed of [{...current,level:5,classLevels:{fighter:5}},{...current,classId:'wizard' as const,classLevels:{wizard:6}},{...current,subclassId:'eldritch-knight',subclassIds:{fighter:'eldritch-knight'}},{...current,pluginFeatureIds:[]}])expect(dnd5eDeclarativeEnvironmentalMovementSpeed(changed,'outdoors','fly')).toBeUndefined()
  const editable=catalog.registeredDnd5ePluginFeatures().find(v=>v.id===f.featureId)!;editable.name='caller mutation'
  expect(catalog.registeredDnd5ePluginFeatures().find(v=>v.id===f.featureId)!.name).toBe('Outdoor Flight')
 }finally{f.dispose()}
 expect(dnd5eDeclarativeEnvironmentalMovementSpeed(current,'outdoors','fly')).toBeUndefined()
},60000)

it.each([new Map(),new Set(),new Date(0),new Uint8Array([1]),...(typeof SharedArrayBuffer==='function'?[new SharedArrayBuffer(4)]:[])])('special feature graph retains the original editable getter fallback and clone behavior: %s',extraData=>{
 const current=actor('');const f=install({extraData});current.pluginFeatureIds=[f.featureId]
 try{
  let raw:{extraData:unknown}|undefined,initialError:unknown
  try{raw=catalog.runtimeDnd5ePluginFeatures().find(v=>v.id===f.featureId) as unknown as {extraData:unknown}}catch(error){initialError=error}
  if(initialError){expect(()=>dnd5eDeclarativeEnvironmentalMovementSpeed(current,'outdoors','fly')).toThrow((initialError as Error).message);return}
  if(!raw)throw Error('Actual current feature required')
  if(raw.extraData instanceof Map)raw.extraData.set('uncloneable',()=>1)
  if(raw.extraData instanceof Set)raw.extraData.add(()=>1)
  let originalError:unknown
  try{catalog.registeredDnd5ePluginFeatures()}catch(error){originalError=error}
  if(originalError){expect(()=>dnd5eDeclarativeEnvironmentalMovementSpeed(current,'outdoors','fly')).toThrow((originalError as Error).message)}
  else expect(dnd5eDeclarativeEnvironmentalMovementSpeed(current,'outdoors','fly')).toBe(35)
 }finally{f.dispose()}
},60000)
