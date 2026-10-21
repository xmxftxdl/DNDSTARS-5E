import {expect,it} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
const make=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,initiative,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
it('grants defense after a hit or miss with the Attack action; expires at next own turn',()=>{
 let featureId=''
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.parry',name:'Parry',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){featureId=api.registerFeature({id:'parry',name:'Parry',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'parry',name:'Parry',description:'Synthetic',level:3,trigger:{kind:'passive'},cost:{economy:'none'},targeting:{kind:'self'},effects:[],automation:'full',mechanic:{kind:'attack-action-defense',armorClassBonus:2,heldMeleeWeaponBaseIds:['dnd5e-longsword'],effectKey:'parry'}}})}})
 try{
  for(const owned of [true,false])for(const held of [true,false])for(const mode of ['unarmed','melee'] as const)for(const d20 of [1,18])for(const bonus of [false,true]){
   const actor=make('monk',20),target=make('target',10)
   actor.pluginFeatureIds=owned?[featureId]:[]
   actor.activityEquipment={armorCategory:'none',armorProficient:true,armorProficiencies:[],freeHands:1,...(held?{mainHand:{itemId:'sword-instance',weaponBaseId:'dnd5e-longsword',weaponMode:'melee' as const,roles:['weapon' as const]}}:{})}
   const state=startDnd5eHeadlessCombat('guard',[actor,target])
   const attack=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'monk',targetId:'target',...(mode==='melee'?{classDamageContext:{mode:'melee' as const,finesse:false,strengthBased:true,weaponDamageSides:4,damageType:'bludgeoning' as const,adjacentEnemyOfTarget:false}}:{}),spendBonusAction:bonus,attackModifier:0,d20,damage:{count:1,sides:4,rolls:d20===1?[]:[1],bonus:0,type:'bludgeoning'}})
   expect(attack.ok,JSON.stringify(attack)).toBe(true)
   const guard=attack.state.combatants.monk.classState.activeEffects?.filter(e=>e.definitionId==='test.parry:parry')??[]
   expect(guard.length).toBe(owned&&held&&mode==='unarmed'&&!bonus?1:0)
   if(!guard.length)continue
   expect(guard[0].modifiers?.armorClassBonus).toBe(2)
   const first=resolveDnd5eHeadlessAction(attack.state,{type:'end-turn',actorId:'monk'})
   expect(first.ok).toBe(true)
   expect(first.state.combatants.monk.classState.activeEffects?.some(e=>e.definitionId==='test.parry:parry')).toBe(true)
   const next=resolveDnd5eHeadlessAction(first.state,{type:'end-turn',actorId:'target'})
   expect(next.ok).toBe(true)
   expect(next.state.combatants.monk.classState.activeEffects?.some(e=>e.definitionId==='test.parry:parry')??false).toBe(false)
  }
 }finally{dispose()}
})

