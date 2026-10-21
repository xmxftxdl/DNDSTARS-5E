import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { rollDnd5eActivityTriggerDiceV1 } from './dnd5eActivityTriggerSettlement'

it('filters triggered area saving throws before requesting dice and reports missing Host scores without throwing', async () => {
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'area-mind-check',name:'Area mind check',activation:{kind:'free'},
    target:{kind:'area',relation:'any',origin:'point',shape:'sphere',placeRangeFeet:120,radiusFeet:20,maximumTargets:10,
      minimumAbilityScores:{int:3},maximumAbilityScores:{int:20}},
    automation:automationCapabilityFromLegacyStatus('full'),
    checks:[{id:'save',kind:'saving-throw',ability:'int',rollId:'save',scope:'per-target',dc:{kind:'constant',value:15}}],
    outcomes:[{id:'hurt',when:{kind:'always'},operations:[{id:'hurt',kind:'damage',target:'target',damageType:'psychic',
      amount:{kind:'dice',rollId:'damage',count:1,sides:6}}]}],
  }
  const make=(id:string,int:number)=>createDnd5eCombatant({id,name:id,controller:'dm',initiative:10,
    abilities:{str:10,dex:10,con:10,int,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const state=startDnd5eHeadlessCombat('area-score-filter',[make('actor',10),make('low',2),make('lower-edge',3),make('upper-edge',20),make('high',21)])
  const requested:string[]=[]
  const input={state,actorId:'actor',targetIds:['low','lower-edge','upper-edge','high'],
    available:{packageId:'test.area-filter',packageVersion:'1.0.0',activity,confirmation:'automatic' as const,retention:'single-event' as const},
    triggerContext:{eventId:'hit-1',event:'attack-hit' as const,source:{kind:'attack' as const,id:'attack',activityId:'attack',mode:'melee' as const,result:'hit' as const},eligibleActorIds:['actor'],eligibleTargetIds:['low','lower-edge','upper-edge','high']},
    roll:async(request:{id:string})=>{requested.push(request.id);return [1]},
  }
  const result=await rollDnd5eActivityTriggerDiceV1(input)
  expect(result).not.toHaveProperty('unsupported')
  expect(requested).toEqual(['damage','save:lower-edge','save:upper-edge'])
  requested.length=0
  state.combatants.low.abilities.int=Number.NaN
  await expect(rollDnd5eActivityTriggerDiceV1(input)).resolves.toEqual({unsupported:'activity-target-ability-missing:int'})
  expect(requested).toEqual([])
})

it('imports and registers ability bounds, then uses Host scores despite forged request facts', async () => {
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'mind-check',name:'Mind check',activation:{kind:'action'},
    target:{kind:'creature',relation:'any',count:2,minimumAbilityScores:{int:3}},
    legacySource:{kind:'feature',id:'mind-check'},automation:automationCapabilityFromLegacyStatus('full'),
    consumption:[{kind:'resource',resourceId:'dnd5e-spell-slot-1',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
    checks:[{id:'save',kind:'saving-throw',ability:'int',rollId:'save',rollMode:'normal',scope:'per-target',dc:{kind:'constant',value:15}}],
    outcomes:[{id:'failure',when:{kind:'check',checkId:'save',result:'failure'},operations:[{id:'damage',kind:'damage',target:'target',amount:{kind:'constant',value:7},damageType:'psychic'}]}],
  }
  const prepared=await prepareDnd5eLocalContentJson(JSON.stringify({name:'Score filter',version:'1.0.0',
    features:[{id:'mind-check',name:'Mind check',summary:'Synthetic',description:'Synthetic',automation:'full'}],activities:[activity]}))
  const pkg=parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(prepared.package)).buffer)!
  expect(pkg.content.activities?.[0].target).toEqual(activity.target)
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const make=(id:string,int:number,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='caster'?'player':'dm',initiative,
      abilities:{str:10,dex:10,con:10,int,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    const caster=make('caster',15,20),immune=make('immune',2,10),eligible=make('eligible',3,1)
    const resourceId='dnd5e-spell-slot-1'
    caster.pluginFeatureIds=[`${pkg.manifest.id}:mind-check`];caster.classResources={[resourceId]:{current:2,max:2}}
    const initial=startDnd5eHeadlessCombat('scores',[caster,immune,eligible])
    const action={type:'plugin' as const,pluginId:pkg.manifest.id,actionId:activity.id,featureId:caster.pluginFeatureIds[0],actorId:caster.id,
      targetId:immune.id,targetIds:[immune.id,eligible.id],rolls:{'save:eligible':{values:[1],modifier:0,total:1}},
      payload:{targetAbilities:{immune:{int:20},eligible:{int:1}}}}
    const result=resolveDnd5eHeadlessAction(initial,action)
    expect(result.ok,JSON.stringify(result)).toBe(true)
    expect(result.state.combatants.immune.currentHp).toBe(30)
    expect(result.state.combatants.eligible.currentHp).toBe(23)
    expect(result.state.combatants.caster.classResources[resourceId].current).toBe(1)
    expect(initial.combatants.eligible.currentHp).toBe(30)
    const changed=structuredClone(initial)
    changed.combatants.immune.abilities.int=3
    const stale=resolveDnd5eHeadlessAction(changed,action)
    expect(stale.ok).toBe(false)
    expect(changed.combatants.caster.classResources[resourceId].current).toBe(2)
  } finally {dispose()}
})
