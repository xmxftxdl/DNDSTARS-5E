import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {prepareDnd5eLocalContentJson} from '../localContentCollection'
import {parseDnd5eContentPackageV2,dnd5eRulesPluginFromContentPackageV2} from '../contentPackageV2'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from '../headlessCombatEngine'
import {dnd5eRollDiceRecipes,type Dnd5eRollDiceKind} from '../rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId,dnd5eRollDiceCheckSlot} from '../rollDiceTransaction'
import {resolveRegisteredDnd5eActivityInCombatV1} from './dnd5eActivityCombatAuthority'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {activityEffectDiceRecipes} from '../../../presentation/maps/activityEffectDice'
import type {Dnd5eActivityCheckV1,Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it.each(['attack','ability-check','saving-throw','concentration-save','opposed'] as const)('imports a persistent die effect and resolves %s through both Activity authorities',async kind=>{
  const grant:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'grant',name:'Grant',activation:{kind:'free'},target:{kind:'self'},
    legacySource:{kind:'feature',id:'grant'},automation:automationCapabilityFromLegacyStatus('full'),
    effects:[{schemaVersion:1,id:'penalty',name:'Penalty',disposition:'debuff',duration:{kind:'rounds',rounds:10,expiresAt:'target-turn-end'},stacking:'replace',concentration:false,
      modifiers:[{kind:'roll-dice',dice:{count:1,sides:6,direction:'subtract',appliesTo:['attack','ability-check','saving-throw']}}]}],
    outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'apply-effect',target:'actor',effectId:'penalty'}]}]}
  const check:Dnd5eActivityCheckV1=kind==='attack'
    ? {id:'check',kind:'attack-roll',scope:'per-target',rollId:'check',attackBonus:{kind:'constant',value:0},rollMode:'normal'}
    : kind==='saving-throw' ? {id:'check',kind:'saving-throw',scope:'per-target',rollId:'check',ability:'int',dc:{kind:'constant',value:12},rollMode:'normal'}
    : kind==='opposed' ? {id:'check',kind:'opposed-ability-check',scope:'per-target',rollId:'check',opposedRollId:'opposed',sourceAbility:'int',sourceModifier:{kind:'constant',value:0},targetOptions:[{ability:'int'}],sourceRollMode:'normal',targetRollMode:'normal'}
    : kind==='concentration-save' ? {id:'check',kind:'concentration-check',scope:'per-target',rollId:'check',ability:'con',dc:{kind:'constant',value:12},rollMode:'normal'}
    : {id:'check',kind:'ability-check',rollId:'check',ability:'int',dc:{kind:'constant',value:12},rollMode:'normal'}
  const test:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'test',name:'Test',activation:{kind:'free'},target:{kind:'creature',relation:'any',count:1,includeSelf:true},
    legacySource:{kind:'feature',id:'test'},automation:automationCapabilityFromLegacyStatus('full'),checks:[check],
    outcomes:[{id:'success',when:{kind:'check',checkId:'check',result:'success'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:3},damageType:'force'}]}]}
  const prepared=await prepareDnd5eLocalContentJson(JSON.stringify({name:'Dynamic dice fixture',version:'1.0.0',
    features:[grant,test].map(activity=>({id:activity.id,name:activity.name,summary:'Synthetic',description:'Synthetic',automation:'full'})),activities:[grant,test]}))
  const pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(prepared.package)).buffer)!
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:'player',initiative,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:12,proficiencyBonus:2,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    const actor=make('actor',20),target=make('target',10)
    actor.pluginFeatureIds=[`${pkg.manifest.id}:grant`,`${pkg.manifest.id}:test`]
    const initial=startDnd5eHeadlessCombat('activity-dice',[actor,target])
    const granted=resolveDnd5eHeadlessAction(initial,{type:'plugin',pluginId:pkg.manifest.id,actionId:'grant',actorId:'actor',targetId:'actor',featureId:actor.pluginFeatureIds[0],rolls:{}})
    expect(granted.ok,JSON.stringify(granted)).toBe(true)
    const state=granted.state
    expect(state.combatants.actor.classState.activeEffects?.[0].modifiers?.rollDiceModifiers).toHaveLength(1)
    const targetId=kind==='saving-throw'||kind==='concentration-save'?'actor':'target'
    const rollKind:Dnd5eRollDiceKind=kind==='opposed'?'ability-check':kind
    if(kind==='opposed') state.combatants.target.classState.activeEffects=structuredClone(state.combatants.actor.classState.activeEffects)
    const rollValues:Record<string,{values:number[];modifier:number;total:number}>= {[kind==='ability-check'?'check':`check:${targetId}`]:{values:[15],modifier:0,total:15},...(kind==='opposed'?{'opposed:target':{values:[13],modifier:0,total:13}}:{})}
    const requestDice=(transactionId:string)=>Object.fromEntries((kind==='opposed'?['actor','target']:['actor']).flatMap(id=>dnd5eRollDiceRecipes({actorId:id,kind:rollKind,
      eventId:dnd5eRollDiceOccurrenceId(transactionId,id,rollKind,0,dnd5eRollDiceCheckSlot('test',kind==='ability-check'?'check':`check:${targetId}`,
        kind==='saving-throw'||id==='target'?'target':'source')),effects:state.combatants[id].classState.activeEffects}).map(recipe=>[recipe.id,[id==='actor'?6:1]])))
    const action={type:'plugin' as const,pluginId:pkg.manifest.id,actionId:'test',actorId:'actor',targetId,featureId:actor.pluginFeatureIds[1],rolls:rollValues}
    const uiRecipes=Object.fromEntries(Object.keys(rollValues).flatMap(id=>activityEffectDiceRecipes({activity:test,
      actor:dnd5eActivityActorSnapshotFromCombatantV1(state.combatants.actor),
      targets:[dnd5eActivityActorSnapshotFromCombatantV1(state.combatants[targetId])],eventId:'native-check'},
      {id,label:id,count:1,sides:20}).map(recipe=>[recipe.id,[id.startsWith('opposed:')?1:6]])))
    expect(uiRecipes).toEqual(requestDice('native-check'))
    const resolved=resolveDnd5eHeadlessAction(state,{...action,effectRollDice:uiRecipes},{transactionId:'native-check'})
    expect(resolved.ok,JSON.stringify(resolved)).toBe(true)
    expect(resolved.state.combatants[targetId].currentHp).toBe(30)
    const missing=resolveDnd5eHeadlessAction(state,action,{transactionId:'native-check'})
    expect(missing.ok).toBe(false)
    const command={schemaVersion:1 as const,commandId:'registered-check',actorId:'actor',packageId:pkg.manifest.id,packageVersion:pkg.manifest.version,activityId:'test',targetIds:[targetId],expectedRevision:1}
    const committed=resolveRegisteredDnd5eActivityInCombatV1({state,command,combatRevision:1,confirmedBy:'actor',authoritativeRolls:rollValues,authoritativeEffectRollDice:requestDice(command.commandId)})
    expect(committed.result.ok,JSON.stringify(committed)).toBe(true)
    if(committed.phase==='commit'&&committed.result.ok){
      expect(committed.result.state.combatants[targetId].currentHp).toBe(30)
      expect(committed.result.rollDiceAudit).toHaveLength(kind==='opposed'?2:1)
    }
    expect(state.combatants[targetId].currentHp).toBe(30)
  } finally {dispose()}
})
