import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../domain/automation/automationCapability'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
import {normalizeCharacter} from '../../store/characters'
import {parseDnd5eUnifiedContentBundleV1,dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {exportDnd5eStarMod,readDnd5eStarMod} from './starModAdapter'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove} from './playerMoveAction'
import {prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction} from './pluginFeatureAction'
import {prepareDnd5eAbilityCheck,resolvePreparedDnd5eAbilityCheck} from './abilityCheckAction'
import {createDnd5eTurnEconomyCounts,grantDnd5eMovement} from './turnEconomy'

it.each([
  {kind:'activity',dash:false,legacy:false},{kind:'activity',dash:true,legacy:false},{kind:'activity',dash:false,legacy:true},
  {kind:'ordinary',dash:false,legacy:false},{kind:'ordinary',dash:true,legacy:false},{kind:'ordinary',dash:false,legacy:true},
])('preserves actual movement across an imported report-only check: %j',async({kind,dash,legacy})=>{
  const namespace='test.check-movement',featureId=namespace+':check'
  const automation=automationCapabilityFromLegacyStatus('full')
  const bundle=parseDnd5eUnifiedContentBundleV1(JSON.stringify({format:'dndstars5e-unified-content',schemaVersion:1,
    manifest:{id:namespace,name:'Movement regression',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},assets:[],
    definitions:[{schemaVersion:1,namespace,version:'1.0.0',kind:'feature',id:'check',name:'Report-only check',automation,
      payload:{id:'check',name:'Report-only check',summary:'Mechanical fixture',description:'Mechanical fixture',automation:'full'},
      activities:[{schemaVersion:1,id:'check',name:'Report-only check',automation,activation:{kind:'bonus-action'},target:{kind:'self'},legacySource:{kind:'feature',id:'check'},
        consumption:[{kind:'action-economy',economy:'bonus-action',amount:1,consumeOn:'resolve'}],
        checks:[{id:'perception',kind:'skill-check',rollId:'perception',skill:'perception',ability:'wis',reportTotalOnly:true,rollMode:'host-derived'}],outcomes:[]}]}]}))!
  const archived=await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(archived.bundle))
  try{
    const hero=normalizeCharacter({id:'hero',name:'Hero',rulesetId:'dnd5e-2014-srd-5.1',charClass:'战士',level:1,
      currentHp:20,maxHp:20,speed:30,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},dnd5ePluginFeatureIds:[featureId]})
    const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
      tokens:[{id:'hero-token',label:'Hero',x:25,y:25,color:'',emoji:'',size:1,type:'player',characterId:'hero'}],
      dnd5eSkillCheckMovement:{turnKey:'movement:1:hero-token',distanceByActor:{}}}
    const initiativeOrder=[{tokenId:'hero-token',slotId:'hero-token',label:'Hero',emoji:'',color:'',roll:20}]
    const base:SharedPlayerActionState={id:'move',mapId:'map',combatId:'movement',sourceMode:'player',status:'pending',actorTokenId:'hero-token',characterId:'hero',round:1,initiativeIndex:0,seq:1,updatedAt:1,type:'move-token',targetPosition:{x:25,y:175}}
    let economy=createDnd5eTurnEconomyCounts('movement:1:hero-token',30)
    if(dash)economy=grantDnd5eMovement(economy,30)
    const move=prepareDnd5ePlayerMove({action:base,map,characters:[hero],initiativeOrder,turnEconomy:economy})
    if(!move.ok)throw Error(move.reason)
    const moved=resolvePreparedDnd5ePlayerMove({prepared:move.prepared})
    expect(moved.result.ok).toBe(true)
    const movedTurn=moved.result.state.combatants['hero-token'].turn
    expect(movedTurn).toMatchObject({movementRemaining:dash?45:15,movementSpent:15})
    economy={...economy,movement:{...economy.movement,current:movedTurn.movementRemaining,spent:movedTurn.movementSpent}}
    if(legacy)delete economy.movement.spent
    const common={map:moved.application!.map,characters:moved.application!.characters,initiativeOrder,turnEconomy:economy}
    let checked
    if(kind==='activity'){
      const prepared=prepareDnd5ePluginFeatureAction({...common,action:{...base,id:'check',type:'dnd5e-plugin-action',targetTokenId:'hero-token',dnd5ePluginAction:{featureId,payload:{selectedActivityId:'check'}}}})
      if(!prepared.ok)throw Error(prepared.reason)
      checked=await resolvePreparedDnd5ePluginFeatureAction({prepared:prepared.prepared,rolls:{perception:{values:[2],total:2,modifier:0}}})
    }else{
      const prepared=prepareDnd5eAbilityCheck({...common,action:{...base,id:'check',type:'dnd5e-ability-check',dnd5eAbilityCheck:{ability:'wis',skill:'perception',dc:12}}})
      if(!prepared.ok)throw Error(prepared.reason)
      checked=resolvePreparedDnd5eAbilityCheck({prepared:prepared.prepared,d20:2})
    }
    expect(checked.result.ok,JSON.stringify(checked.result)).toBe(true)
    const checkedTurn=checked.result.state.combatants['hero-token'].turn
    expect(checkedTurn).toMatchObject({movementRemaining:dash?45:15,movementSpent:15,bonusActionAvailable:kind==='ordinary'})
    expect(checked.result.state.skillCheckMovement?.distanceByActor['hero-token']).toBe(15)
    const nextEconomy={...economy,movement:{...economy.movement,current:checkedTurn.movementRemaining,spent:checkedTurn.movementSpent}}
    const next=prepareDnd5ePlayerMove({action:{...base,id:'next-move',targetPosition:{x:25,y:225}},map:checked.application!.map,characters:checked.application!.characters,initiativeOrder,turnEconomy:nextEconomy})
    if(!next.ok)throw Error(next.reason)
    const final=resolvePreparedDnd5ePlayerMove({prepared:next.prepared})
    expect(final.result.ok).toBe(true)
    expect(final.result.state.combatants['hero-token'].turn).toMatchObject({movementRemaining:dash?40:10,movementSpent:20})
    expect(final.result.state.skillCheckMovement?.distanceByActor['hero-token']).toBe(20)
  }finally{dispose()}
})
