import {afterAll,beforeAll,expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {normalizeCharacter} from '../../store/characters'
import type {BattleMap,Token} from '../../store/maps'
import {restoreClassResources} from '../../lib/classResources'
import {createEmptyMapGeometry,mapGeometryCanSeeToken,mapGeometryLineOfEffectBlocked} from '../../lib/mapGeometry'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {migrateCharacterToDnd5e} from './character'
import {advanceDnd5eCampaignTimedActiveEffects} from './campaignTimeRules'
import {applyDnd5eEffectiveVisionProfile,compileDnd5eEffectiveVisionProfile} from '../../../shared/dnd5e-vision-profile.mjs'
import {projectMapsForPlayer} from '../../../scripts/shared-server-core.mjs'

const namespace='test.personal-solid-sight'
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'personal-sight',name:'Personal sight',activation:{kind:'action'},invocation:{kind:'active',confirmation:'actor-choice'},legacySource:{kind:'feature',id:'personal-sight'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'self'},consumption:[{kind:'action-economy',economy:'action',amount:1,consumeOn:'resolve'},{kind:'resource',resourceId:namespace+':sight-use',amount:{kind:'constant',value:1},consumeOn:'resolve'}],effects:[{schemaVersion:1,id:'sight',name:'Personal sight',disposition:'buff',magical:true,stacking:'unique-by-source',duration:{kind:'concentration',maximumRounds:10},concentration:true,modifiers:[{kind:'through-solid-objects-sight',rangeFeet:30,grantDarkvisionIfAbsentAtActivation:true}]}],outcomes:[{id:'activate',when:{kind:'always'},operations:[{id:'activate',kind:'apply-effect',target:'actor',effectId:'sight'}]}]}
const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,assets:[],manifest:{id:namespace,name:'Personal sight test',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only'},definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'personal-sight',name:'Personal sight',automation:automationCapabilityFromLegacyStatus('full'),payload:{id:'personal-sight',name:'Personal sight',summary:'Synthetic personal sight',description:'Synthetic',automation:'full',resources:[{id:'sight-use',label:'Sight use',maximum:1,resetOn:'short-rest'}]},activities:[activity]}]}
let dispose:()=>void
beforeAll(()=>{dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))})
afterAll(()=>dispose())
function token(id:string,x:number,patch:Partial<Token>={}):Token{return{id,label:id,x,y:250,size:1,type:'enemy',emoji:'T',color:'#fff',...patch}}
function fixture(){const source=token('source',50,{type:'player',characterId:'source'}),target=token('target',250);const map:BattleMap={id:'map',name:'Map',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[source,target,token('other',50,{type:'player',characterId:'other'})]};const geometry=createEmptyMapGeometry('map',1);geometry.vision={enabled:true,defaultRangeFeet:60,sharePartyVision:true,ambientLight:'bright'};geometry.walls=[{id:'wall',kind:'wall',label:'Wall',points:[{x:150,y:0},{x:150,y:500}],blocksVision:true,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:100,createdAt:1}];return{source,target,map,geometry}}
const profile=(character:Parameters<typeof migrateCharacterToDnd5e>[0])=>compileDnd5eEffectiveVisionProfile({character:migrateCharacterToDnd5e(character)})

it('validates a closed active-self declaration and rejects malformed flags and ranges',()=>{
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const raw=JSON.parse(JSON.stringify(activity))
 for(const range of [0,-1,30.5,10001,'30']){const bad=structuredClone(raw);bad.effects[0].modifiers[0].rangeFeet=range;expect(validateDnd5eActivityDefinitionV1(bad)).toContainEqual(expect.stringContaining('rangeFeet'))}
 for(const flag of [false,0,1,'true',{}]){const bad=structuredClone(raw);bad.effects[0].modifiers[0].grantDarkvisionIfAbsentAtActivation=flag;expect(validateDnd5eActivityDefinitionV1(bad)).toContainEqual(expect.stringContaining('grantDarkvisionIfAbsentAtActivation'))}
 for(const kind of ['spell','triggered','other-target','no-invocation']){const bad=structuredClone(raw);if(kind==='spell')bad.legacySource.kind='spell';if(kind==='triggered')bad.invocation.kind='triggered';if(kind==='other-target')bad.target={kind:'creature',rangeFeet:30};if(kind==='no-invocation')delete bad.invocation;expect(validateDnd5eActivityDefinitionV1(bad)).toContainEqual(expect.stringContaining('activation darkvision requires'))}
})

it.each(['none','conditional10','direct10','racial60','prior-concentration10']as const)('snapshots real activation eligibility and clears expired caches: %s',async mode=>{
 const prior=mode==='none'||mode==='racial60'?undefined:createDnd5eMechanicalEffect({id:'prior',definitionId:'prior',label:'Prior sight',targetId:'source',source:{kind:'feature',actorId:'source',rulesId:'prior',magical:true},duration:mode==='prior-concentration10'?{type:'concentration',sourceActorId:'source',concentrationId:'prior',remainingRounds:10}:{type:'rounds',remainingRounds:1,tickOn:'target-turn-end'},modifiers:mode==='conditional10'?{darkvisionIfAbsentFeet:10}:{darkvisionRangeFeet:10}})
 const owner=restoreClassResources(normalizeCharacter({id:'source',name:'Source',charClass:'邪术师',level:7,dnd5eClassLevels:{warlock:7},race:mode==='racial60'?'精灵':'人类',maxHp:60,currentHp:60,dnd5ePluginFeatureIds:[namespace+':personal-sight'],concentrating:mode==='prior-concentration10',dnd5eCombatState:{activeEffects:prior?[prior]:[],...(mode==='prior-concentration10'?{concentrationSpellId:'prior',concentrationRoundsRemaining:10,concentrationTargetIds:['source']}:{})}}),'long-rest')
 const f=fixture()
 const activate=async(actor:typeof owner,map=f.map)=>{
  const prepared=prepareDnd5ePluginFeatureAction({map,characters:[actor],initiativeOrder:[{tokenId:'source',label:'Source',roll:20,emoji:'',color:''}],action:{id:'activate',mapId:map.id,sourceMode:'player',status:'pending',type:'dnd5e-plugin-action',actorTokenId:'source',characterId:'source',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5ePluginAction:{featureId:namespace+':personal-sight'}}})
  expect(prepared.ok,JSON.stringify(prepared)).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
  const resolved=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared});expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true);if(!resolved.result.ok)throw Error(resolved.result.reason)
  expect(resolved.result.state.combatants.source.turn.actionAvailable).toBe(false)
  expect(resolved.result.state.combatants.source.classResources[namespace+':sight-use'].current).toBe(0)
  return resolved.application!.characters[0]
 }
 const first=await activate(owner),effect=first.dnd5eCombatState?.activeEffects?.find(e=>(e.modifiers?.throughSolidObjectsRangeFeet??0)>0)
 expect(effect?.modifiers?.darkvisionRangeFeet).toBe(mode==='none'?30:undefined)
 expect(profile(first).darkvisionRangeFeet).toBe(mode==='none'?30:mode==='prior-concentration10'?0:mode==='racial60'?60:10)
 const priorEnds=advanceDnd5eCampaignTimedActiveEffects(first,0.1)
 expect(profile(priorEnds).darkvisionRangeFeet).toBe(mode==='none'?30:mode==='racial60'?60:0)
 const ended=advanceDnd5eCampaignTimedActiveEffects(first,1)
 expect(profile(ended).throughSolidObjectsRangeFeet??0).toBe(0)
 const cached=applyDnd5eEffectiveVisionProfile(f.source,compileDnd5eEffectiveVisionProfile({token:f.source,character:migrateCharacterToDnd5e(first)}))
 const again=await activate(restoreClassResources(ended,'short-rest'),{...f.map,tokens:[cached]})
 expect(profile(again).darkvisionRangeFeet).toBe(mode==='racial60'?60:30)
 if(mode==='none'){
  const replacement=await activate(restoreClassResources(first,'short-rest'),{...f.map,tokens:[cached]})
  expect(profile(replacement).darkvisionRangeFeet).toBe(0)
  expect(profile(replacement).throughSolidObjectsRangeFeet).toBe(30)
 }
})

it('keeps personal solid sight private, respects 3D antimagic, and does not change line of effect',()=>{
 const f=fixture(),effect=createDnd5eMechanicalEffect({id:'sight',definitionId:'sight',label:'Sight',targetId:'source',source:{kind:'feature',actorId:'source',magical:true},modifiers:{throughSolidObjectsRangeFeet:30,darkvisionRangeFeet:30}})
 f.source.dnd5eCombatState={schemaVersion:2,activeEffects:[effect]}
 const roster={characters:[{id:'source',roomMemberId:'member',dnd5eCombatState:f.source.dnd5eCombatState},{id:'other',roomMemberId:'other-member'}]}
 const publicTokens=(id:string,member:string)=>projectMapsForPlayer({maps:[f.map]},{maps:[f.geometry]},id,roster,{memberId:member}).maps[0].tokens
 expect(mapGeometryCanSeeToken({map:f.map,geometry:f.geometry,viewer:f.source,target:f.target})).toBe(true)
 expect(mapGeometryLineOfEffectBlocked({map:f.map,geometry:f.geometry,from:f.source,to:f.target})).toBe(true)
 expect(publicTokens('source','member').some(t=>t.id==='target')).toBe(true)
 expect(publicTokens('other','other-member').some(t=>t.id==='target')).toBe(false)
 f.map.dnd5ePluginAreas=[{id:'anti',pluginId:'test',featureId:'test',label:'Antimagic',color:'',sourceTokenId:'other',sourceCharacterId:'other',anchorCell:{col:1,row:5},cells:Array.from({length:25},(_,n)=>({col:n%5,row:Math.floor(n/5)+3})),createdRound:1,expiresAfterRound:100,includeSelf:true,relation:'any',occupantModifiers:{suppressesMagic:true},vertical:{mode:'volume',shape:'sphere',baseElevationFeet:0,heightFeet:20}}]
 expect(publicTokens('source','member').some(t=>t.id==='target')).toBe(false)
 f.source.elevationFeet=25;f.target.elevationFeet=25
 expect(publicTokens('source','member').some(t=>t.id==='target')).toBe(true)
 f.source.elevationFeet=0;f.target.elevationFeet=0;f.map.dnd5ePluginAreas=[]
 expect(publicTokens('source','member').some(t=>t.id==='target')).toBe(true)
 f.source.dnd5eCombatState.activeEffects=[];roster.characters[0].dnd5eCombatState=f.source.dnd5eCombatState
 expect(publicTokens('source','member').some(t=>t.id==='target')).toBe(false)
})
