import {expect,it} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eInherentFeatureLightEffects} from './inherentFeatureLight'
import {validDnd5eInherentFeatureLight} from './inherentFeatureLightContract'
import {dnd5eActiveEmittedLight,createDnd5eMechanicalEffect} from './activeEffects'
import {migrateCharacterToDnd5e} from './character'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import type {BattleMap} from '../../store/maps'
import {createEmptyMapGeometry} from '../../lib/mapGeometry'
import {buildMapViewportPresentation} from '../../presentation/maps/MapViewportLayer'

const ns='test.inherent-light',id=ns+':lamp',off=ns+':off'
const light={brightRadiusFeet:30,dimRadiusFeet:30,color:'#ffdd88',disabledByEffectTag:off}
it('roundtrips default-on light, honors saved off state and removes unowned or ineligible light',async()=>{
 const automation=automationCapabilityFromLegacyStatus('full')
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,
  manifest:{id:ns,name:'Inherent light',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],
  definitions:[{schemaVersion:1,namespace:ns,version:'1.0.0',kind:'feature',id:'lamp',name:'Lamp',automation,
   payload:{id:'lamp',name:'Lamp',summary:'Test',description:'Test',automation:'full',classRequirements:[{classId:'monk',minimumLevel:17}],staticModifiers:{inherentLight:light}},
   effects:[{schemaVersion:1,id:'lamp-static',name:'Lamp',stacking:'replace',duration:{kind:'permanent'},modifiers:[{kind:'character-capability',capability:'inherentLight',value:light}]}]}]}
 const decoded=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try{
  const character=normalizeCharacter({id:'character',name:'Owner',charClass:'武僧',level:17,dnd5eClassLevels:{monk:17},dnd5ePluginFeatureIds:[id],abilities:{str:10,dex:10,con:10,int:10,wis:16,cha:10}})
  const projected=dnd5eInherentFeatureLightEffects(character,[])
  expect(dnd5eActiveEmittedLight(projected)).toEqual({brightRadiusFeet:30,dimRadiusFeet:30,color:'#ffdd88'})
  expect(dnd5eActiveEmittedLight(migrateCharacterToDnd5e(character).classState.activeEffects)).toEqual(dnd5eActiveEmittedLight(projected))
  const persisted=normalizeCharacter({...character,dnd5eCombatState:{schemaVersion:2,activeEffects:JSON.parse(JSON.stringify(projected))}})
  expect(dnd5eInherentFeatureLightEffects(persisted,persisted.dnd5eCombatState?.activeEffects)).toHaveLength(1)
  const marker=createDnd5eMechanicalEffect({definitionId:off,label:'Off',targetId:character.id,source:{kind:'feature',actorId:character.id,magical:false},duration:{type:'permanent'},tags:[off]})
  const disabled=normalizeCharacter({...persisted,dnd5eCombatState:{schemaVersion:2,activeEffects:[...projected,marker]}})
  expect(dnd5eActiveEmittedLight(migrateCharacterToDnd5e(disabled).classState.activeEffects)).toBeUndefined()
  expect(dnd5eActiveEmittedLight(dnd5eInherentFeatureLightEffects(disabled,[marker]))).toBeUndefined()
  expect(dnd5eActiveEmittedLight(dnd5eInherentFeatureLightEffects(disabled,[]))).toBeDefined()
  for(const changed of [{...persisted,dnd5ePluginFeatureIds:[]},{...persisted,dnd5eClassLevels:{monk:16},level:17}]){
   expect(dnd5eActiveEmittedLight(migrateCharacterToDnd5e(changed).classState.activeEffects)).toBeUndefined()
  }
  const map:BattleMap={id:'light-map',name:'Light map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,
   tokens:[{id:'different-token',characterId:character.id,type:'player',x:25,y:25,label:'Owner',emoji:'',color:'',size:1}]}
  const geometry=createEmptyMapGeometry(map.id);geometry.vision.ambientLight='darkness'
  const snapshotInput={map,geometry,characters:[character],combatId:'light',initiativeOrder:[{tokenId:'different-token',label:'Owner',emoji:'',color:'',roll:20}]}
  const snapshot=createDnd5eMapCombatSnapshot(snapshotInput).state
  expect(dnd5eActiveEmittedLight(snapshot.combatants['different-token'].classState.activeEffects)).toBeDefined()
  expect(snapshot.combatants['different-token'].illumination).toBe('bright')
  expect(createDnd5eMapCombatSnapshot({...snapshotInput,characters:[disabled]}).state.combatants['different-token'].illumination).toBe('darkness')
  expect(map.tokens[0].lightSource).toBeUndefined()
  expect(buildMapViewportPresentation(map,[character]).map.tokens[0].lightSource).toMatchObject({enabled:true,brightRadiusFeet:30,dimRadiusFeet:30})
  expect(buildMapViewportPresentation(map,[disabled]).map.tokens[0].lightSource).toBeUndefined()
  const antimagic:BattleMap={...map,dnd5ePluginAreas:[{id:'antimagic',pluginId:'test',featureId:'antimagic',label:'Antimagic',color:'',
   sourceTokenId:'different-token',sourceCharacterId:character.id,cells:[{col:0,row:0}],createdRound:1,expiresAfterRound:100,
   includeSelf:true,relation:'any',occupantModifiers:{suppressesMagic:true}}]}
  const suppressed=createDnd5eMapCombatSnapshot({...snapshotInput,map:antimagic}).state.combatants['different-token']
  expect(suppressed.illumination).toBe('darkness')
  expect(dnd5eActiveEmittedLight(suppressed.classState.activeEffects)).toBeUndefined()
  expect(buildMapViewportPresentation(antimagic,[character]).map.tokens[0].lightSource).toBeUndefined()
  dispose()
  expect(dnd5eInherentFeatureLightEffects(persisted,projected)).toEqual([])
 }finally{dispose()}
},30000)

it('rejects malformed inherent lights instead of retaining an unvalidated capability',()=>{
 for(const patch of [{brightRadiusFeet:-1},{dimRadiusFeet:10001},{color:'yellow'},{disabledByEffectTag:''},{other:1},{brightRadiusFeet:0,dimRadiusFeet:0}])
  expect(validDnd5eInherentFeatureLight({...light,...patch})).toBe(false)
})
