import './activeEffects'
import {planDnd5eSummonedCreature} from './summonedCreatures'
import {migrateMapsState,type BattleMap} from '../../store/maps'
import {createDnd5eMapCombatSnapshot} from './mapBridge'
import {dnd5eCanUnderstandSourceLanguage} from './sharedLanguage'
import {expect,it} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,commitDnd5eActivityExecution,resolveDnd5eHeadlessAction} from './headlessCombatEngine'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {getDnd5eSrdMonster} from './monsters'
import {dnd5eMonsterAttackIsNaturalWeapon} from './monsterNaturalWeapons'
const abilities={str:10,dex:10,con:10,int:10,wis:10,cha:10}
const creature=(id:string,initiative:number)=>createDnd5eCombatant({id,name:id,controller:id==='target'?'dm':'player',initiative,abilities,proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
it.each(['wolf','satyr','skeleton'])('applies spell summon bonuses only to eligible types (%s)',slug=>{
 let featureId=''
 const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.mighty',name:'Mighty',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){featureId=api.registerFeature({id:'mighty',name:'Mighty',summary:'Synthetic',description:'Synthetic',automation:'full',declarativeAbility:{schemaVersion:1,id:'mighty',name:'Mighty',description:'Synthetic',level:1,trigger:{kind:'after-spell-cast'},targeting:{kind:'self'},effects:[],mechanic:{kind:'summoned-creature-bonus',source:'spell',creatureTypes:['beast','fey'],maximumHitPointsPerHitDie:2,naturalWeaponAttacksMagical:true},automation:'full'}})}})
 try{
  const actor=creature('caster',20);actor.pluginFeatureIds=[featureId]
  const initial=startDnd5eHeadlessCombat('mighty',[actor,creature('target',10)])
  const proposal={kind:'summon' as const,operationId:'summon',monsterId:'srd-5.1:'+slug,count:1,timing:'immediate' as const,durationRounds:10,concentration:true,side:'ally' as const}
  for(const kind of ['spell','feature'] as const){
   const result=commitDnd5eActivityExecution(initial,{actorId:actor.id,activityId:'test-summon',targetIds:[],source:{kind,id:'conjure-animals'},resolution:{ok:true,status:'resolved',checks:[],consumptions:[],proposals:[proposal]}})
   expect(result.ok,result.ok?'':result.reason).toBe(true)
   const summon=result.activityHandoffs?.summons[0]
   const eligible=kind==='spell'&&slug!=='skeleton'
   expect(summon?.naturalWeaponAttacksMagical).toBe(eligible?true:undefined)
   expect(summon?.maximumHitPointBonus).toBe(eligible?Number(getDnd5eSrdMonster(proposal.monsterId)!.hitPoints.dice.match(/^(\d+)d/)![1])*2:undefined)
   expect(summon?.weaponAttacksMagical).toBeUndefined()
  }
 }finally{dispose()}
})
it.each([['giant-eagle','talons',true],['satyr','shortsword',false]] as const)('only natural attacks bypass nonmagical immunity (%s)',(slug,actionId,natural)=>{
 const monster=getDnd5eSrdMonster('srd-5.1:'+slug)!
 const attack=monster.actions.find(a=>a.id===actionId)!.attack!
 expect(dnd5eMonsterAttackIsNaturalWeapon(monster.id,actionId,attack)).toBe(natural)
 for(const granted of [false,true]){
  const actor=creature('actor',20);actor.statBlockId=monster.id;actor.naturalWeaponAttacksMagical=granted?true:undefined
  const target=creature('target',10);target.damageDefenseRules=[{outcome:'immune',delivery:'weapon-attack',magical:false}]
  const initial=startDnd5eHeadlessCombat('attack',[actor,target])
  const result=resolveDnd5eHeadlessAction(initial,{type:'monster-action',actorId:actor.id,actionId,rolls:[{targetId:target.id,d20:18,damageRolls:attack.damage.map(d=>Array(d.count).fill(d.sides))}]})
  expect(result.ok,result.ok?'':result.reason).toBe(true)
  expect(result.state.combatants.target.currentHp<100).toBe(granted&&natural)
 }
})
it('custom natural attacks require explicit metadata and can override legacy body-part ids',()=>{
 const attack=getDnd5eSrdMonster('srd-5.1:wolf')!.actions.find(a=>a.id==='bite')!.attack!
 expect(dnd5eMonsterAttackIsNaturalWeapon('local:custom','bite',attack)).toBe(false)
 expect(dnd5eMonsterAttackIsNaturalWeapon('local:custom','custom',{...attack,naturalWeapon:true})).toBe(true)
 expect(dnd5eMonsterAttackIsNaturalWeapon('srd-5.1:wolf','bite',{...attack,naturalWeapon:false})).toBe(false)
})

it('understands actual catalog beast types bidirectionally without extending to undead',()=>{const speaker={languages:['common'],communicationCreatureTypes:['beast']};const wolf=getDnd5eSrdMonster('srd-5.1:wolf')!;expect(dnd5eCanUnderstandSourceLanguage(speaker,wolf)).toBe(true);expect(dnd5eCanUnderstandSourceLanguage(wolf,speaker)).toBe(true);expect(dnd5eCanUnderstandSourceLanguage(speaker,getDnd5eSrdMonster('srd-5.1:skeleton')!)).toBe(false)})

it('preserves natural-only magic and bonus HP through token creation, map migration and Host reconstruction',()=>{
 const map:BattleMap={id:'summon-map',name:'Summon',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[{id:'owner',type:'enemy',poolId:'srd-5.1:goblin',label:'Owner',x:25,y:25,size:1,color:'',emoji:''}]}
 const planned=planDnd5eSummonedCreature({map,actorToken:map.tokens[0],sourceCharacterId:'owner',featureId:'mighty',pluginId:'test',actionId:'test',round:1,targetCell:{col:2,row:1},initiativeD20:12,
  summon:{monsterId:'srd-5.1:wolf',durationRounds:10,concentration:true,side:'ally',maximumHitPointBonus:4,naturalWeaponAttacksMagical:true}})
 expect(planned.ok,planned.ok?'':planned.reason).toBe(true);if(!planned.ok)return
 expect(planned.plan.token.maxHp).toBe(getDnd5eSrdMonster('srd-5.1:wolf')!.hitPoints.average+4)
 const loaded=migrateMapsState(JSON.parse(JSON.stringify({maps:[{...map,tokens:[...map.tokens,planned.plan.token]}],selectedId:map.id}))).maps[0]
 const wolf=loaded.tokens.find(t=>t.id===planned.plan.token.id)!
 expect(wolf.dnd5eSummon?.naturalWeaponAttacksMagical).toBe(true)
 expect(wolf.dnd5eSummon?.weaponAttacksMagical).toBeUndefined()
 const state=createDnd5eMapCombatSnapshot({combatId:'test',map:loaded,characters:[],initiativeOrder:loaded.tokens.map((t,i)=>({tokenId:t.id,label:t.label,emoji:'',color:'',roll:20-i}))}).state
 expect(state.combatants[wolf.id].naturalWeaponAttacksMagical).toBe(true)
 expect(state.combatants[wolf.id].weaponAttacksMagical).not.toBe(true)
 expect(state.combatants[wolf.id].maxHp).toBe(wolf.maxHp)
})
