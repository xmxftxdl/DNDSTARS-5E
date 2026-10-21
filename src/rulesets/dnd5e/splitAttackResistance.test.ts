import {resolveRegisteredDnd5eActivityInCombatV1} from './activities/dnd5eActivityCombatAuthority'
import {dnd5eCombatantPairKey} from './headlessCombatPrimitives'
import {it,expect} from 'vitest'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {normalizeCharacter} from '../../store/characters'
import {createCombatantFromDnd5eCharacter,migrateCharacterToDnd5e} from './character'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import {validateDnd5eActivityDefinitionV1} from './activities/dnd5eActivityValidation'
it.each(['same','different','spent','miss','wire-only'] as const)('limits split-damage resistance to one attack check: %s',async mode=>{
 const ns='test.split-attack-resistance'
 const activity:any={schemaVersion:1,id:'split-attack',name:'Split attack audit',activation:{kind:'action'},legacySource:{kind:'feature',id:'split-attack'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'creature',relation:'any',count:1,rangeFeet:30},checks:[{id:'hit',kind:'attack-roll',rollId:'hit',attackBonus:{kind:'constant',value:20},scope:'per-target',rollMode:'normal',delivery:'ranged'}],outcomes:[{id:'hit',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'fire',kind:'damage',target:'target',damageType:'fire',amount:{kind:'constant',value:9}},{id:'cold',kind:'damage',target:'target',damageType:'cold',amount:{kind:'constant',value:7}}]}]}
 if(mode==='different'){activity.checks.push({...activity.checks[0],id:'second',rollId:'second'});const cold=activity.outcomes[0].operations.pop();activity.outcomes.push({id:'second',when:{kind:'check',checkId:'second',result:'success'},operations:[cold]})}
 expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2({
 format:'dndstars5e-content',schemaVersion:2,provenance:{edition:'2014',contentMode:'incremental',sourceTitle:'Synthetic test'},manifest:{id:ns,name:'Split attack resistance',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0-1.0'},assets:[],
 content:{races:[],backgrounds:[],feats:[],spells:[],items:[],abilityGenerationMethods:[],headlessActions:[],monsters:[],features:[{id:'split-attack',name:'Split attack',description:'Synthetic',summary:'Synthetic',automation:'full'}],activities:[activity],
 subclasses:[{schemaVersion:1,id:'horizon-walker',classId:'ranger',name:'Test subclass',summary:'Synthetic attack-bound defense',abilities:[{schemaVersion:1,id:'spectral-defense',name:'Attack resistance',description:'Synthetic',level:15,automation:'full',trigger:{kind:'before-damage-taken'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'any',includeSelf:true},effects:[],mechanic:{kind:'damage-mitigation-interrupt',mode:'resistance',protects:'self',attackOnly:true,damageTypes:['fire','cold']}}]}]}
 }))
 try{
 const character=normalizeCharacter({id:'hero',name:'Hero',charClass:'游侠',level:15,dnd5eClassLevels:{ranger:15},maxHp:100,currentHp:100,dnd5eClassChoices:{classes:{ranger:{subclass:ns+':horizon-walker'}}}})
 const hero=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(character),controller:'player',initiativeD20:1,position:{x:0,y:0}})
 const enemy=createDnd5eCombatant({id:'enemy',name:'Enemy',controller:'dm',initiative:30,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:[ns+':split-attack']})
 const state=startDnd5eHeadlessCombat('spectral-split',[enemy,hero])
 state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('enemy','hero')]:5}
 if(mode==='spent')state.combatants.hero.turn.reactionAvailable=false
 const before=structuredClone(state)
 const command={type:'plugin' as const,pluginId:ns,actionId:'split-attack',featureId:ns+':split-attack',actorId:'enemy',targetId:'hero',targetIds:['hero'],distanceFeet:5,rolls:{'hit:hero':{values:[mode==='miss'?1:15],modifier:0,total:mode==='miss'?1:15},...(mode==='different'?{'second:hero':{values:[15],modifier:0,total:15}}:{})},damageMitigationInterrupts:[{sourceId:'hero',targetId:'hero',featureId:ns+':horizon-walker.spectral-defense'}]}
 const compiled=resolveDnd5eHeadlessAction(state,command)
 const direct=resolveRegisteredDnd5eActivityInCombatV1({state,combatRevision:1,command:{schemaVersion:1,commandId:'split',actorId:'enemy',packageId:ns,packageVersion:'1.0.0',activityId:'split-attack',targetIds:['hero'],expectedRevision:1,...(mode==='wire-only'?{damageMitigationInterrupts:command.damageMitigationInterrupts}:{})},authoritativeRolls:command.rolls,confirmedBy:'actor',...(mode==='wire-only'?{}:{damageMitigationInterrupts:command.damageMitigationInterrupts})})
 if(direct.phase!=='commit')throw Error('Expected authority commit: '+JSON.stringify(direct))
 for(const result of mode==='wire-only'?[direct.result]:[compiled,direct.result]){
 if(mode==='spent'||mode==='miss'){expect(result.ok).toBe(false);expect(result.state.combatants.hero.currentHp).toBe(100);continue}
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 if(!result.ok)throw Error(result.reason)
 expect(result.state.combatants.hero.currentHp).toBe(mode==='wire-only'?84:mode==='same'?93:89)
 expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='reaction')).toHaveLength(mode==='wire-only'?0:1)
 }
 expect(state).toEqual(before)
 }finally{dispose()}
})

