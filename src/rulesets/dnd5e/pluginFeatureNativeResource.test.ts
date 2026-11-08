import {it,expect} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap,Token} from '../../store/maps'
import {restoreClassResources} from '../../lib/classResources'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {getRegisteredDnd5eActivity} from './activities/dnd5eActivityRegistry'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'

const namespace='test.native-racial-cost',resourceId='dnd5e-racial-dragonborn-breath'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'native-roar',name:'Synthetic native cost',activation:{kind:'action'},legacySource:{kind:'feature',id:'native-roar'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'area',origin:'self',shape:'sphere',radiusFeet:30,relation:'any',selection:'choose-any'},consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'},{kind:'resource',resourceId,amount:{kind:'constant',value:1},consumeOn:'resolve'}],checks:[{id:'save',kind:'saving-throw',rollId:'save',scope:'per-target',ability:'wis',rollMode:'normal',dc:{kind:'constant',value:15}}],outcomes:[{id:'fail',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'notify',kind:'narrative-prompt',prompt:'Synthetic failed save'}]}]}
const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Native racial cost test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only'},definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'native-roar',name:'Synthetic native cost',automation:automationCapabilityFromLegacyStatus('full'),payload:{id:'native-roar',name:'Synthetic native cost',summary:'Synthetic resource boundary fixture',description:'Synthetic',automation:'full'},activities:[activity]}]}
function token(id:string,x:number):Token{return {id,label:id,type:id==='source'?'player':'enemy',...(id==='source'?{characterId:'source'}:{poolId:'srd-5.1:goblin',hp:30,maxHp:30}),x,y:25,size:1,color:'',emoji:''}}
for(const racialEntitlement of [true,false])it('uses native breath authority through archive installation and the real map feature path: '+racialEntitlement,async()=>{
 const bytes=await exportDnd5eStarMod(bundle),decoded=await readDnd5eStarMod(bytes)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
 try{
   const owner=restoreClassResources(normalizeCharacter({id:'source',name:'Source',charClass:'战士',level:5,race:racialEntitlement?'龙裔':'人类',dnd5eRaceId:racialEntitlement?'dragonborn':'human',dnd5eRacialChoices:racialEntitlement?{dragonbornAncestry:'red'}:{},maxHp:40,currentHp:40,dnd5ePluginFeatureIds:[namespace+':native-roar']}),'long-rest')
   const map:BattleMap={id:'native',name:'Native',width:500,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[token('source',25),token('one',75),token('two',125)]}
   const prepared=prepareDnd5ePluginFeatureAction({map,characters:[owner],initiativeOrder:[{tokenId:'source',label:'Source',roll:20,emoji:'',color:''},{tokenId:'one',label:'One',roll:10,emoji:'',color:''},{tokenId:'two',label:'Two',roll:5,emoji:'',color:''}],action:{id:'native-cost',mapId:map.id,sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'source',characterId:'source',round:1,initiativeIndex:0,seq:1,updatedAt:1,targetTokenIds:['one','two'],targetCell:{col:0,row:0},targetOrientation:0,dnd5ePluginAction:{featureId:namespace+':native-roar'}}})
   expect(prepared.ok,JSON.stringify(prepared)).toBe(true)
   if(!prepared.ok)return
   const actor=prepared.prepared.state.combatants.source
   if(!racialEntitlement)actor.classResources[resourceId]={current:1,max:1}
   expect(actor.classResources[resourceId].current).toBe(1)
   expect(Boolean(actor.racialRules?.dragonbornAncestry)).toBe(racialEntitlement)
   expect(getRegisteredDnd5eActivity(namespace,'native-roar')?.consumption?.filter(c=>c.kind==='resource').map(c=>c.resourceId)).toEqual([resourceId])
   const resolved=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,rolls:{'save:one':{values:[1],modifier:0,total:1},'save:two':{values:[20],modifier:0,total:20}}})
   expect(resolved.result.ok,resolved.result.ok?'':resolved.result.reason).toBe(racialEntitlement)
   if(resolved.result.ok){expect(resolved.result.state.combatants.source.classResources[resourceId].current).toBe(0);expect(resolved.result.state.combatants.source.turn.actionAvailable).toBe(false);expect(resolved.result.events.filter(e=>e.type==='class-resource-spent'&&e.resourceKey===resourceId)).toHaveLength(1)}else{expect(resolved.result.reason).toBe('class-resource-unavailable');expect(resolved.result.state.combatants.source.classResources[resourceId].current).toBe(1);expect(resolved.result.state.combatants.source.turn.actionAvailable).toBe(true)}
 }finally{dispose()}
})
