import{it,expect}from'vitest'
import{normalizeCharacter}from'../../store/characters'
import type{BattleMap}from'../../store/maps'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import{parseDnd5eUnifiedContentBundleV1,dnd5eRulesPluginFromUnifiedContentBundleV1}from'./unifiedContent'
import{registerDnd5eRulesPlugin}from'./pluginApi'
import{automationCapabilityFromLegacyStatus}from'../../domain/automation/automationCapability'
import{applyDnd5eInventoryMutation,normalizeDnd5eInventory}from'./items'
import{prepareDnd5eEquipmentAttack,resolvePreparedDnd5eEquipmentAttack}from'./equipmentAttackAction'
import{prepareDnd5ePluginFeatureAction,resolvePreparedDnd5ePluginFeatureAction}from'./pluginFeatureAction'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'./turnEconomy'
const ns='test.host-root-context',featureId=ns+':followup'
function fixture(round=1,requiredRound?:number){
 const automation=automationCapabilityFromLegacyStatus('full')
 const bundle=parseDnd5eUnifiedContentBundleV1(JSON.stringify({format:'dndstars5e-unified-content',schemaVersion:1,manifest:{id:ns,name:'Host context fixture',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},assets:[],definitions:[{schemaVersion:1,namespace:ns,version:'1.0.0',kind:'feature',id:'followup',name:'Attack follow-up',automation,payload:{id:'followup',name:'Attack follow-up',summary:'Registered source',description:'A real registered activity requiring the Host Attack marker and remaining bonus action.',automation:'full',classRequirements:[{classId:'rogue',minimumLevel:17}]},activities:[{schemaVersion:1,id:'followup',name:'Attack follow-up',activation:{kind:'free'},target:{kind:'self'},automation,legacySource:{kind:'feature',id:'followup'},requirements:[{kind:'combat-active'},{kind:'attack-action-used'},{kind:'action-economy-available',economy:'bonus-action'},{kind:'once-per-turn',key:'followup'},...(requiredRound==null?[]:[{kind:'combat-round',round:requiredRound}])],outcomes:[{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'grant-weapon-attack',target:'actor',grantId:'followup',label:'Follow-up attack',economy:'bonus-action',expires:'turn-end',attacks:1,additionalSneakAttackDifferentTarget:true}]}]}]}]}))
 if(!bundle)throw Error('Registered fixture schema invalid')
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(bundle))
 let characters=[normalizeCharacter({id:'hero',name:'Hero',charClass:'游荡者',level:17,dnd5eClassLevels:{rogue:17},currentHp:105,maxHp:105,hitPointMaximumMode:'fixed',abilities:{str:10,dex:20,con:12,int:10,wis:10,cha:10},dnd5ePluginFeatureIds:[featureId],equipment:{},dnd5eInventory:{schemaVersion:3,entries:[]}})]
 const granted=applyDnd5eInventoryMutation(characters,{type:'grant',characterId:'hero',templateId:'srd-5.1:equipment:dnd5e-shortsword',quantity:1});if(!granted.ok)throw Error(granted.reason);characters=granted.characters
 const instanceId=normalizeDnd5eInventory(characters[0]).entries[0].instanceId,equipped=applyDnd5eInventoryMutation(characters,{type:'equip',characterId:'hero',instanceId,slot:'mainWeapon'});if(!equipped.ok)throw Error(equipped.reason);characters=equipped.characters
 const map:BattleMap={id:'context-map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'hero-token',characterId:'hero',label:'Hero',type:'player',x:25,y:25,size:1,color:'',emoji:''},{id:'a',label:'A',type:'enemy',x:75,y:25,size:1,color:'',emoji:'',hp:100,maxHp:100},{id:'b',label:'B',type:'enemy',x:25,y:75,size:1,color:'',emoji:'',hp:100,maxHp:100},{id:'ally',label:'Ally',type:'player',x:75,y:75,size:1,color:'',emoji:'',hp:20,maxHp:20}]}
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),action:SharedPlayerActionState={id:'actual-normal-attack',mapId:map.id,combatId:'context-combat',sourceMode:'player',status:'pending',type:'dnd5e-weapon-attack',actorTokenId:'hero-token',characterId:'hero',targetTokenId:'a',round,initiativeIndex:0,seq:1,updatedAt:1}
 const ready=prepareDnd5eEquipmentAttack({map,characters,action,initiativeOrder,attacksUsed:0});if(!ready.ok)throw Error(ready.reason)
 const attacked=resolvePreparedDnd5eEquipmentAttack({prepared:ready.prepared,d20:18,damageRolls:[1],classDamageRolls:[{source:'sneak-attack',rolls:Array(9).fill(1)}]});if(!attacked.result.ok||!attacked.application)throw Error('Actual normal Attack failed')
 const current=JSON.parse(JSON.stringify(attacked.application)),marker=current.characters[0].dnd5eCombatState.weaponAttackActionTurnKey,turn=attacked.result.state.combatants['hero-token'].turn
 const economy=projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(marker),turn);economy.attacksUsed=attacked.result.state.combatants['hero-token'].classState.attacksMadeThisTurn??0
 return{dispose,input:{map:current.map as BattleMap,characters:current.characters as typeof characters,action:{...action,id:'actual-feature-grant',type:'dnd5e-plugin-action' as const,targetTokenId:'hero-token',dnd5ePluginAction:{featureId,payload:{selectedActivityId:'followup'}}},initiativeOrder,turnEconomy:economy},normalAction:action}
}
it.each(['different','same']as const)('a real normal Attack and JSON reload allow a grant; %s target extra attack spends bonus once',async target=>{
 const{dispose,input,normalAction}=fixture();try{
  expect(input.turnEconomy).toMatchObject({action:{current:0},bonusAction:{current:1},attacksUsed:1})
  const ready=prepareDnd5ePluginFeatureAction(input);expect(ready.ok,JSON.stringify(ready)).toBe(true);if(!ready.ok)throw Error(ready.reason)
  const granted=await resolvePreparedDnd5ePluginFeatureAction({prepared:ready.prepared,combatRevision:1,rolls:{}});expect(granted.result.ok,JSON.stringify(granted.result)).toBe(true);if(!granted.application)throw Error('Missing actual grant application')
  const reloaded=JSON.parse(JSON.stringify(granted.application));expect(reloaded.characters[0].dnd5eCombatState.activityWeaponAttackGrants.followup.additionalSneakAttackDifferentTarget).toBe(true)
  expect(granted.result.state.combatants['hero-token'].turn).toMatchObject({actionAvailable:false,bonusActionAvailable:true})
  const again=prepareDnd5ePluginFeatureAction({...input,map:reloaded.map,characters:reloaded.characters});expect(again.ok).toBe(false)
  const targetId=target==='same'?'a':'b',before=reloaded.map.tokens.find((row:{id:string})=>row.id===targetId).hp
  const extra=prepareDnd5eEquipmentAttack({...input,map:reloaded.map,characters:reloaded.characters,action:{...normalAction,id:'actual-extra',targetTokenId:targetId,dnd5eWeaponAttackOptions:{activityWeaponAttackGrantId:'followup'}},attacksUsed:1});expect(extra.ok,JSON.stringify(extra)).toBe(true);if(!extra.ok)throw Error(extra.reason)
  const settled=resolvePreparedDnd5eEquipmentAttack({prepared:extra.prepared,d20:18,damageRolls:[1],classDamageRolls:target==='different'?[{source:'sneak-attack',rolls:Array(9).fill(1)}]:[]});expect(settled.result.ok,JSON.stringify(settled.result)).toBe(true)
  expect(settled.application?.map.tokens.find(row=>row.id===targetId)?.hp).toBe(before-(target==='different'?15:6))
  expect(settled.result.state.combatants['hero-token'].turn).toMatchObject({actionAvailable:false,bonusActionAvailable:false})
  expect(settled.application?.characters[0].dnd5eCombatState?.activityWeaponAttackGrants?.followup).toBeUndefined()
 }finally{dispose()}
})
it.each(['missing-marker','old-marker','other-turn','inactive','bonus-spent']as const)('Host root rejects %s even with forged client/counter claims',mode=>{
 const{dispose,input}=fixture();try{const state=input.characters[0].dnd5eCombatState!;if(mode==='missing-marker')delete state.weaponAttackActionTurnKey;if(mode==='old-marker')state.weaponAttackActionTurnKey+=':old';if(mode==='other-turn')input.action.initiativeIndex=1;if(mode==='inactive')delete input.action.combatId;if(mode==='bonus-spent')input.turnEconomy.bonusAction.current=0;Object.assign(input.action,{attackActionUsed:true,attacksUsed:99});input.turnEconomy.attacksUsed=99;expect(prepareDnd5ePluginFeatureAction(input).ok).toBe(false)}finally{dispose()}
})
it.each([1,2])('generic round-one predicate reads actual Host round %s after a fresh Attack',round=>{const{dispose,input}=fixture(round,1);try{expect(prepareDnd5ePluginFeatureAction(input).ok).toBe(round===1)}finally{dispose()}})
