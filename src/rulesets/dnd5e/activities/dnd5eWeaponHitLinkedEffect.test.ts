import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {dnd5eRulesPluginFromUnifiedContentBundleV1,type Dnd5eUnifiedContentBundleV1} from '../unifiedContent'
import {registerDnd5eRulesPlugin} from '../pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,type Dnd5eAction} from '../headlessCombatEngine'
import {resolveDnd5eActionWithDamageReactions} from '../damageReactionFlow'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

it.each([false,true])('commits linked effects and weapon damage in one transaction (critical=%s)',async critical=>{
 const ns='test.hit-linked',full=automationCapabilityFromLegacyStatus('full')
 const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'weakness',name:'Weakness',activation:{kind:'free'},
  invocation:{kind:'triggered',event:'attack-hit',confirmation:'actor-choice',retention:'single-event'},target:{kind:'creature',relation:'enemy',count:1},
  consumption:[{kind:'resource',resourceId:'uses',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
  requirements:[{kind:'attack-category',category:'weapon'}],
  effects:[{schemaVersion:1,id:'controller',name:'Controller',magical:true,stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'source-turn-start'}},
    {schemaVersion:1,id:'binding',name:'Binding',magical:true,stacking:'replace',duration:{kind:'rounds',rounds:10,expiresAt:'source-turn-start'},
      sourceLink:{sourceRequiresEffect:'controller',sourceRequiresEffectSameApplication:true},
      modifiers:[{kind:'speed',mode:'add',value:{kind:'constant',value:-10}}],
      removalAction:{label:'Escape',economy:'action',maxDistanceFeet:5,abilityCheck:{ability:'str',skill:'athletics',dc:{kind:'constant',value:15}}}}],
  outcomes:[{id:'damage',when:{kind:'always'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'dice',rollId:'extra',count:2,sides:6},damageType:'poison',critical:'double-dice',magical:true},
    {id:'clear',kind:'remove-effect',target:'actor',effectId:'controller',source:'self'},
    {id:'controller',kind:'apply-effect',target:'actor',effectId:'controller'},
    {id:'binding',kind:'apply-effect',target:'target',effectId:'binding'}]}],
  automation:full,legacySource:{kind:'feature',id:'weakness',magical:true}}
 const bundle:Dnd5eUnifiedContentBundleV1={format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:ns,name:'Weakness',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0',distributionPolicy:'local-only',contentCategory:'mixed'},assets:[],definitions:[{
  schemaVersion:1,namespace:ns,version:'1.0.0',kind:'feature',id:'weakness',name:'Weakness',automation:full,activities:[activity],payload:{id:'weakness',name:'Weakness',summary:'Synthetic',description:'Synthetic',automation:'full'}}]}
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
 try{for(const accepted of [false,true])for(const immune of [false,true]){
  const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:id==='actor'?'player':'dm',initiative:id==='actor'?20:10,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:id==='target',classResources:{uses:{current:2,max:2}}})
  const actor=make('actor'),target=make('target');actor.pluginFeatureIds=[ns+':weakness']
  if(immune)target.damageImmunities=['poison']
  const state=startDnd5eHeadlessCombat('weakness',[actor,target]),before=structuredClone(state)
  const action:Dnd5eAction={type:'attack',actorId:'actor',targetId:'target',attackModifier:5,d20:critical?20:18,damage:{count:1,sides:8,bonus:0,rolls:critical?[7,7]:[7],type:'piercing'},classDamageContext:{mode:'ranged',weaponId:'bow',weaponDamageSides:8,finesse:false,strengthBased:false,damageType:'piercing',adjacentEnemyOfTarget:false}}
  const result=await resolveDnd5eActionWithDamageReactions({state,action,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted}),roll:async request=>Array(request.count).fill(3)})
  expect(result.ok,JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.target.currentHp).toBe(100-(critical?2:1)*(7+(accepted&&!immune?6:0)))
  expect(result.events.filter(event=>event.type==='damage-applied')).toHaveLength(1)
  expect(result.events.filter(event=>event.type==='concentration-check-required')).toHaveLength(1)
  expect(result.state.combatants.actor.classResources.uses.current).toBe(accepted?1:2)
  const binding=result.state.combatants.target.classState.activeEffects?.find(effect=>effect.removal?.action?.abilityCheck?.skill==='athletics')
  expect(!!binding).toBe(accepted)
  if(binding) {
    const controller=result.state.combatants.actor.classState.activeEffects!.find(effect=>effect.id===binding.removal?.sourceLink?.sourceRequiresEffectInstanceId)
    expect(controller).toBeDefined()
    expect(binding.removal?.action?.abilityCheck?.dc).toBe(15)
  }
  expect(state).toEqual(before)
 }}finally{dispose()}
},60000)
