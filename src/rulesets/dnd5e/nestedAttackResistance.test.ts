import {dnd5eCombatantPairKey} from './headlessCombatPrimitives'
import {it,expect} from 'vitest'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
it('extends selected attack resistance to its automatic after-hit damage',()=>{
 const ns='test.nested-attack-resistance',sub=ns+':test'
 const dispose=registerDnd5eRulesPlugin({manifest:{id:ns,name:'Nested damage audit',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0'},setup(api){api.registerDeclarativeSubclass({schemaVersion:1,id:'test',classId:'ranger',name:'Test',summary:'Synthetic',abilities:[
 {schemaVersion:1,id:'rider',name:'Attack rider',description:'Synthetic',level:1,trigger:{kind:'after-attack-hit'},cost:{economy:'none'},targeting:{kind:'single-creature',relation:'enemy',rangeFeet:30},rolls:[{id:'damage',kind:'damage',label:'Rider',dice:{count:0,sides:6,modifier:{kind:'fixed',value:7}},damageType:'cold'}],effects:[{kind:'damage',target:'target',rollId:'damage'}],automation:'full'},
 {schemaVersion:1,id:'guard',name:'Attack resistance',description:'Synthetic',level:1,trigger:{kind:'before-damage-taken'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'any',includeSelf:true},effects:[],mechanic:{kind:'damage-mitigation-interrupt',mode:'resistance',protects:'self',attackOnly:true,damageTypes:['fire','cold']},automation:'full'}]})}})
 try{
 const actors=['attacker','target'].map((id,i)=>createDnd5eCombatant({id,name:id,controller:i?'player':'dm',initiative:20-i,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,level:15,classId:'ranger',classLevels:{ranger:15},subclassId:sub,subclassIds:{ranger:sub},pluginFeatureIds:[sub+(i?'.guard':'.rider')]}))
 const state=startDnd5eHeadlessCombat('nested',actors)
 state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('attacker','target')]:5}
 const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'attacker',targetId:'target',d20:15,attackModifier:5,damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'},damageMitigationInterrupts:[{sourceId:'target',targetId:'target',featureId:sub+'.guard'}]})
 expect(result.ok,result.ok?'':result.reason).toBe(true)
 expect(result.events.some(e=>e.type==='declarative-subclass-ability-resolved'),JSON.stringify(result.events)).toBe(true)
 expect(result.state.combatants.target.currentHp).toBe(93)
 expect(result.events.filter(e=>e.type==='turn-resource-spent'&&e.resource==='reaction')).toHaveLength(1)
 const next=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(result.state)),{type:'attack',actorId:'attacker',targetId:'target',spendAction:false,d20:15,attackModifier:5,damage:{count:1,sides:10,bonus:0,rolls:[9],type:'fire'}})
 expect(next.ok).toBe(true)
 expect(next.state.combatants.target.currentHp).toBe(77)
 expect(next.events.some(e=>e.type==='damage-mitigation-interrupt-applied')).toBe(false)
 }finally{dispose()}
})

