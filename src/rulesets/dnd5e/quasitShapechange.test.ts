import {it,expect} from 'vitest'
import {getDnd5eSrdMonster} from './monsters'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from './mapBridge'
import {resolveDnd5eMonsterShapechangeChoice} from './monsterShapechangeAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
it.each([['bat',{walk:10,fly:40}],['centipede',{walk:40,climb:40}],['toad',{walk:40,swim:40}]] as const)('retains quasit statistics in %s form and reverts on death', (form,speed)=>{
 const base=getDnd5eSrdMonster('srd-5.1:quasit')!,alternate=getDnd5eSrdMonster('srd-5.1:quasit-'+form)!
 expect(alternate.speed).toEqual(speed)
 for(const key of ['abilities','armorClass','hitPoints','creatureType','damageResistances','actions','languages'] as const)expect(alternate[key]).toEqual(base[key])
 const actor=createDnd5eCombatant({id:'quasit',name:'Quasit',controller:'dm',initiative:20,statBlockId:base.id,
   abilities:base.abilities,proficiencyBonus:2,armorClass:base.armorClass.value,currentHp:7,maxHp:7,temporaryHp:0,speed:40,position:{x:0,y:0},concentrating:false})
 const other=createDnd5eCombatant({...actor,id:'enemy',statBlockId:undefined,controller:'player',initiative:10,currentHp:100,maxHp:100})
 const initial=startDnd5eHeadlessCombat('shape',[actor,other])
 const changed=resolveDnd5eHeadlessAction(initial,{type:'monster-shapechange',actorId:actor.id,formId:alternate.id})
 expect(changed.ok,JSON.stringify(changed)).toBe(true)
 expect(changed.state.combatants.quasit).toMatchObject({statBlockId:alternate.id,currentHp:7,maxHp:7,turn:{actionAvailable:false},movementSpeeds:speed})
 expect(resolveDnd5eHeadlessAction(changed.state,{type:'monster-shapechange',actorId:actor.id,formId:base.id}).ok).toBe(false)
 const ended=resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(changed.state)),{type:'end-turn',actorId:actor.id})
 expect(ended.ok).toBe(true)
 const killed=resolveDnd5eHeadlessAction(ended.state,{type:'attack',actorId:'enemy',targetId:'quasit',attackModifier:20,d20:18,
   damage:{count:1,sides:20,bonus:20,rolls:[20],type:'radiant'}})
 expect(killed.ok,JSON.stringify(killed)).toBe(true)
 expect(killed.state.combatants.quasit).toMatchObject({statBlockId:base.id,currentHp:0,deathSaves:{dead:true}})
 expect(killed.events).toContainEqual(expect.objectContaining({type:'monster-shapechanged',forced:true,toStatBlockId:base.id}))
})
it('persists alternate form, carried equipment and unchanged HP through map reload and back',()=>{
 const map:any={id:'shape-map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,
   tokens:[{id:'quasit',poolId:'srd-5.1:quasit',label:'Custom name',type:'enemy',size:1,x:25,y:25,hp:5,maxHp:7,color:'',emoji:'',
     dnd5eCarriedObjects:[{id:'gem',pickupReceipt:'gem-receipt',label:'Gem',objectState:{schemaVersion:1,wornOrCarried:true}}]},
     {id:'other',poolId:'srd-5.1:bandit',label:'Other',type:'enemy',size:1,x:225,y:25,hp:11,maxHp:11,color:'',emoji:''}]}
 const order=map.tokens.map((t:any,i:number)=>({tokenId:t.id,label:t.label,roll:20-i,color:'',emoji:''}))
 const snapshot=createDnd5eMapCombatSnapshot({combatId:'shape-map',map,characters:[],initiativeOrder:order})
 const change=resolveDnd5eHeadlessAction(snapshot.state,{type:'monster-shapechange',actorId:'quasit',formId:'srd-5.1:quasit-toad'})
 expect(change.ok).toBe(true)
 const applied=planDnd5eMapResultApplication({state:change.state,map,characters:[],characterIdByCombatantId:snapshot.characterIdByCombatantId,events:[...change.events]})
 const restored=JSON.parse(JSON.stringify(applied.map))
 expect(restored.tokens[0]).toMatchObject({poolId:'srd-5.1:quasit-toad',label:'Custom name',hp:5,maxHp:7,dnd5eCarriedObjects:map.tokens[0].dnd5eCarriedObjects})
 const next=createDnd5eMapCombatSnapshot({combatId:'new-turn',map:restored,characters:[],initiativeOrder:order})
 expect(next.state.combatants.quasit.movementSpeeds).toMatchObject({walk:40,swim:40})
 const back=resolveDnd5eHeadlessAction(next.state,{type:'monster-shapechange',actorId:'quasit',formId:'srd-5.1:quasit'})
 expect(back.ok).toBe(true)
 expect(back.state.combatants.quasit).toMatchObject({statBlockId:'srd-5.1:quasit',currentHp:5,maxHp:7})
 const economy=createDnd5eTurnEconomyCounts('shape-turn',40)
 const submit=(formId:string)=>resolveDnd5eMonsterShapechangeChoice({combatId:'shape-turn',map,characters:[],initiativeOrder:order,actorTokenId:'quasit',formId,turnEconomy:economy})
 expect(submit('srd-5.1:wolf').result.ok).toBe(false)
 const chosen=submit('srd-5.1:quasit-bat')
 expect(chosen.result.ok).toBe(true)
 expect(chosen.application?.map.tokens[0].poolId).toBe('srd-5.1:quasit-bat')
 economy.action.current=0
 expect(submit('srd-5.1:quasit-toad').result.ok).toBe(false)
 economy.action.current=1
 const airborne=structuredClone(map)
 airborne.tokens[0].poolId='srd-5.1:quasit-bat'
 airborne.tokens[0].elevationFeet=20
 airborne.tokens[0].hp=30;airborne.tokens[0].maxHp=30
 const input={combatId:'fall',map:airborne,characters:[],initiativeOrder:order,actorTokenId:'quasit',formId:'srd-5.1:quasit-toad',turnEconomy:economy}
 const preview=resolveDnd5eMonsterShapechangeChoice(input)
 expect(preview.airborneFalls).toEqual([expect.objectContaining({combatantId:'quasit',fallingDamageDice:2})])
 expect(preview.application).toBeUndefined()
 expect(airborne.tokens[0]).toMatchObject({poolId:'srd-5.1:quasit-bat',hp:30,elevationFeet:20})
 const landed=resolveDnd5eMonsterShapechangeChoice({...input,airborneFallDamageRollsByCombatantId:{quasit:[2,3]}})
 expect(landed.result.ok,JSON.stringify(landed.result)).toBe(true)
 expect(landed.application?.map.tokens[0]).toMatchObject({poolId:'srd-5.1:quasit-toad',hp:25,elevationFeet:0})
})
