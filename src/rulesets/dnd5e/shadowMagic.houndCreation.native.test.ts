import {expect,it} from 'vitest'
import {nativeHoundFixture} from './shadowMagic.hound.native.fixture'
import {houndFeatureId,namespace} from './shadowMagic.houndSource.native.fixture'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {applyDnd5eActivityMapHandoffsV1,dnd5eActivitySummonPlacementCells} from './activities/dnd5eActivityMapInteraction'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {createEmptyMapGeometry,setMapGeometryRuntime} from '../../lib/mapGeometry'
import {migrateMapsState} from '../../store/maps'
import {getDnd5eSrdMonster} from './monsters'
import {dnd5eCharacterHasPluginFeature,dnd5ePluginFeatureCurrentEnvelopeFullV1} from './pluginApi'
import {registeredDnd5ePluginFeatures} from './plugins/pluginContentCatalog'

for(const carrier of ['unified','legacy'] as const)it('actual native Sorcerer1→6 '+carrier+' creates targeted Medium monstrosity DireWolf,3SP/own initiative, target-origin30 not caster range/LOE',async()=>{
 const f=await nativeHoundFixture('human',carrier,6)
 try{
  expect(dnd5eCharacterHasPluginFeature(f.soul(),houndFeatureId)).toBe(true)
  expect(dnd5ePluginFeatureCurrentEnvelopeFullV1(houndFeatureId)).toBe(true)
  expect(registeredDnd5ePluginFeatures().find(feature=>feature.id===namespace+':shadow-magic.hound-of-ill-omen')?.automation).toBe('manual')
  const map={...f.map(),width:3000,height:1000,tokens:[...f.map().tokens].reverse().map((token:any)=>({...token,x:token.id==='soul-token'?25:1225,y:25}))}
  const geometry=createEmptyMapGeometry(map.id)
  geometry.walls.push({id:'behind-target',kind:'wall',label:'Behind target',points:[{x:1375,y:0},{x:1375,y:1000}],baseHeightFeet:0,heightFeet:20,
   blocksVision:true,blocksLineOfEffect:true,blocksMovement:true,createdAt:1});setMapGeometryRuntime([geometry])
  const order=map.tokens.map((token:any,i:number)=>({tokenId:token.id,label:token.label,roll:20-i,color:'',emoji:''}))
  const action:any={id:'actual-hound-'+carrier,mapId:map.id,combatId:'actual-hound',sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',
   actorTokenId:'soul-token',characterId:f.soul().id,targetTokenId:'foe-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,
   dnd5ePluginAction:{featureId:houndFeatureId,payload:{selectedActivityId:'hound-of-ill-omen'}}}
  const input={map,characters:f.characters(),action,initiativeOrder:order},before=structuredClone(input)
  const prepared=prepareDnd5ePluginFeatureAction(input);expect(prepared.ok,prepared.ok?'prepared':prepared.reason).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  const used=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,combatRevision:1,rolls:{}})
  expect(used.result.ok,used.result.ok?'accepted':used.result.reason).toBe(true);if(!used.result.ok||!used.application)throw Error('Actual source creation required')
  expect(input).toEqual(before)
  const actor=used.result.state.combatants['soul-token']
  expect(actor.abilities.dex).toBe(10)
  expect(actor.classResources['dnd5e-sorcery-points'].current).toBe(3);expect(actor.turn.bonusActionAvailable).toBe(false);expect(actor.turn.actionAvailable).toBe(true)
  expect(used.result.activityHandoffs?.summons).toHaveLength(1)
  expect(used.result.activityHandoffs!.summons[0]).toMatchObject({monsterId:'srd-5.1:dire-wolf',count:1,concentration:false,durationRounds:50,temporaryHitPoints:3,
   illOmenTarget:{targetTokenId:'foe-token',targetCharacterId:'foe'}})
  const activity=getRegisteredDnd5eActivity(namespace,'hound-of-ill-omen');if(!activity)throw Error('Actual registered source Activity required')
  const handoffs=used.result.activityHandoffs!
  const apply=(col:number)=>applyDnd5eActivityMapHandoffsV1({map:used.application!.map,characters:used.application!.characters,activity,packageId:namespace,
   actionId:action.id,actorId:'soul-token',round:1,handoffs,selection:{summonCells:[{col,row:0}],summonInitiativeD20s:[7]}})
  const materialized=apply(30);expect(materialized.ok,JSON.stringify(materialized)).toBe(true);if(!materialized.ok)throw Error(materialized.reason)
  const hound=materialized.map.tokens.find(token=>token.dnd5eSummon?.illOmenTarget)!
  const wolf=getDnd5eSrdMonster('srd-5.1:dire-wolf')!
  expect(hound).toMatchObject({label:'凶兆猎犬',size:1,creatureSize:'中型',creatureTypes:['monstrosity'],hp:wolf.hitPoints.average,maxHp:wolf.hitPoints.average,
   dnd5eCombatState:{temporaryHp:3},dnd5eSummon:{sourceTokenId:'soul-token',sourceCharacterId:'soul',creatureTypeOverride:'monstrosity',illOmenTarget:{targetTokenId:'foe-token',targetCharacterId:'foe'}}})
  expect(materialized.initiativeEntries).toHaveLength(1);expect(materialized.initiativeEntries[0].initiativeCalculation).toMatchObject({rolls:[7],d20:7,modifier:2,mode:'normal'})
  expect(materialized.initiativeEntries[0].roll).toBe(9)
  const reloaded=migrateMapsState({maps:[JSON.parse(JSON.stringify(materialized.map))]}).maps[0]
  expect(reloaded.tokens.find(token=>token.id===hound.id)?.dnd5eSummon?.illOmenTarget).toEqual(hound.dnd5eSummon!.illOmenTarget)
  const snapshot=createDnd5eMapCombatSnapshot({map:reloaded,characters:used.application.characters,combatId:'actual-hound-next',initiativeOrder:[...order,...materialized.initiativeEntries],geometry})
  expect(snapshot.state.combatants[hound.id]).toMatchObject({creatureType:'monstrosity',sizeRank:2,armorClass:wolf.armorClass.value,currentHp:wolf.hitPoints.average,temporaryHp:3})
  expect(apply(31).ok).toBe(false);expect(apply(24).ok).toBe(false)
  const cells=dnd5eActivitySummonPlacementCells({map:used.application.map,characters:used.application.characters,activity,packageId:namespace,actorId:'soul-token',summons:used.result.activityHandoffs!.summons,selectedCells:[]})
  expect(cells).toContainEqual({col:30,row:0});expect(cells).not.toContainEqual({col:31,row:0})
 }finally{setMapGeometryRuntime([]);f.dispose()}
})
