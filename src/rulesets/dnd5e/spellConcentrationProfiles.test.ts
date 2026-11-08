import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from './unifiedContent'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {syncCharacterClassResources} from '../../lib/classResources'
import {prepareDnd5ePluginSpellCast,resolvePreparedDnd5ePluginSpellCast} from './pluginSpellTransaction'
import type {BattleMap} from '../../store/maps'
import {expect,it} from 'vitest'
import {dnd5ePluginSpellConcentrationRounds} from './pluginSpellTransaction'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
import type {Dnd5eActivityDefinitionV1} from './activities/dnd5eActivityContracts'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
const profiles=[{minimumCastLevel:3,maximumRounds:4800},{minimumCastLevel:5,maximumRounds:14400}]
const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'duration-example',name:'Duration example',legacySource:{kind:'spell',id:'duration-example'},automation:automationCapabilityFromLegacyStatus('full'),activation:{kind:'action'},target:{kind:'self'},concentrationCastLevelProfiles:profiles,outcomes:[{id:'effect',when:{kind:'always'},operations:[{id:'healing',kind:'healing',target:'actor',amount:{kind:'constant',value:1}}]}]}
it.each([[2,600],[3,4800],[4,4800],[5,14400],[9,14400]])('uses only the explicit selected slot profile at slot %s',(slotLevel,expected)=>{
 expect(dnd5ePluginSpellConcentrationRounds({activity,slotLevel,baseRounds:600})).toBe(expected)
})
it('retains ordinary undeclared concentration and never starts concentration for a nonconcentration spell',()=>{
 expect(dnd5ePluginSpellConcentrationRounds({slotLevel:9,baseRounds:600})).toBe(600)
 expect(dnd5ePluginSpellConcentrationRounds({activity,slotLevel:9,baseRounds:undefined})).toBeUndefined()
})
it('does not infer source lifetime from arbitrarily long or differently timed effects',()=>{
 const withEffects:Dnd5eActivityDefinitionV1={...activity,effects:[{schemaVersion:1,id:'short',name:'Short',duration:{kind:'concentration',maximumRounds:2},stacking:'replace',concentration:true},{schemaVersion:1,id:'long',name:'Long',duration:{kind:'concentration',maximumRounds:14400},stacking:'replace',concentration:true}]}
 expect(dnd5ePluginSpellConcentrationRounds({activity:withEffects,slotLevel:3,baseRounds:600})).toBe(4800)
 expect(dnd5ePluginSpellConcentrationRounds({activity:{...withEffects,concentrationCastLevelProfiles:undefined},slotLevel:3,baseRounds:600})).toBe(600)
})
it.each(['valid','empty','duplicate','zero-slot','high-slot','zero-round','high-round','extra','feature'])('strictly validates explicit authored source profiles: %s',mode=>{
 const candidate=JSON.parse(JSON.stringify(activity))
 if(mode==='empty')candidate.concentrationCastLevelProfiles=[]
 if(mode==='duplicate')candidate.concentrationCastLevelProfiles=[profiles[0],profiles[0]]
 if(mode==='zero-slot')candidate.concentrationCastLevelProfiles[0].minimumCastLevel=0
 if(mode==='high-slot')candidate.concentrationCastLevelProfiles[0].minimumCastLevel=10
 if(mode==='zero-round')candidate.concentrationCastLevelProfiles[0].maximumRounds=0
 if(mode==='high-round')candidate.concentrationCastLevelProfiles[0].maximumRounds=14401
 if(mode==='extra')candidate.concentrationCastLevelProfiles[0].playerOverride=true
 if(mode==='feature')candidate.legacySource.kind='feature'
 expect(validateDnd5eActivityDefinitionV1(candidate).length===0,JSON.stringify(validateDnd5eActivityDefinitionV1(candidate))).toBe(mode==='valid')
})

it.each(['ordinary-concentration','explicit-mixed-effects','high-slot-nonconcentration'])('applies actual native spell source timing without guessing from effects: %s',async mode=>{
 const namespace='test.source-duration',concentration=mode!=='high-slot-nonconcentration'
 const spellActivity:Dnd5eActivityDefinitionV1={...activity,id:'cast',legacySource:{kind:'spell',id:'example'},concentrationCastLevelProfiles:mode==='ordinary-concentration'?undefined:[{minimumCastLevel:3,maximumRounds:50}],target:{kind:'creature',relation:'any',count:1},effects:[{schemaVersion:1,id:'short',name:'Short',duration:concentration?{kind:'concentration',maximumRounds:3}:{kind:'rounds',rounds:3,expiresAt:'target-turn-end'},concentration,stacking:'replace'},{schemaVersion:1,id:'long',name:'Long',duration:concentration?{kind:'concentration',maximumRounds:9000}:{kind:'rounds',rounds:9000,expiresAt:'target-turn-end'},concentration,stacking:'replace'}],outcomes:[{id:'all',when:{kind:'always'},operations:[{id:'short',kind:'apply-effect',target:'target',effectId:'short'},{id:'long',kind:'apply-effect',target:'target',effectId:'long'},{id:'damage',kind:'damage',target:'target',damageType:'fire',amount:{kind:'constant',value:1}}]}]}
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:namespace,name:'Source duration regression',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0',distributionPolicy:'local-only',contentCategory:'spells'},assets:[],definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'spell',id:'example',name:'Example',automation:automationCapabilityFromLegacyStatus('full'),activities:[spellActivity],payload:{id:'example',name:'Example',englishName:'Example',level:1,school:'enchantment',ritual:false,castingTime:{value:1,unit:'action'},range:{type:'distance',feet:60},components:{verbal:false,somatic:false,material:false},duration:concentration?{type:'timed',value:1,unit:'minute',concentration:true}:{type:'instantaneous',concentration:false},classes:['warlock'],description:'Generic source duration regression.'}}]}
 const first=await readDnd5eStarMod(await exportDnd5eStarMod(bundle)),second=await readDnd5eStarMod(await exportDnd5eStarMod(first.bundle));expect(second.bundle.definitions).toEqual(first.bundle.definitions)
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(second.bundle))
 try{
 const character=syncCharacterClassResources(normalizeCharacter({id:'hero',name:'Hero',charClass:'warlock',level:5,dnd5eClassLevels:{warlock:5},currentHp:30,maxHp:30,dnd5eClassChoices:{classes:{warlock:{subclass:'fiend',selections:{'spell-known':[namespace+':example']}}}}}))
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'hero',characterId:'hero',label:'Hero',type:'player',x:25,y:25,size:1,color:'#ffffff',emoji:'H'},{id:'target',label:'Target',type:'enemy',poolId:'srd-5.1:goblin',hp:10,maxHp:10,x:75,y:25,size:1,color:'#ffffff',emoji:'T'}]}
 const ready=prepareDnd5ePluginSpellCast({map,characters:[character],initiativeOrder:map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:token.emoji,color:token.color,roll:20-index})),action:{id:'source-duration-cast',type:'dnd5e-spell-cast',sourceMode:'player',status:'pending',mapId:'map',combatId:'duration-test',characterId:'hero',actorTokenId:'hero',targetTokenId:'target',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:namespace+':example',castingClassId:'warlock',slotLevel:3,targetTokenId:'target'}}})
 expect(ready.ok,JSON.stringify(ready)).toBe(true);if(!ready.ok)throw Error('Native preparation failed')
 const resolved=resolvePreparedDnd5ePluginSpellCast({prepared:ready.prepared,rolls:{activityRolls:{}}});expect(resolved.result.ok,JSON.stringify(resolved.result)).toBe(true)
 const caster=resolved.result.state.combatants.hero;expect(caster.classResources['dnd5e-pact-slot'].current).toBe(1);expect(caster.concentrating).toBe(concentration);expect(caster.classState.concentrationRoundsRemaining).toBe(concentration?mode==='ordinary-concentration'?10:50:undefined)
 }finally{dispose()}
})
