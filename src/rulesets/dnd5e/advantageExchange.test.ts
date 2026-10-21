import {it,expect} from 'vitest'
import type {Dnd5eAction} from './headlessCombatEngine'
import {normalizeCharacter} from '../../store/characters'
import {registerDnd5eRulesPlugin,dnd5eDeclarativeAttackIntentDefinition} from './pluginApi'
it('exchanges advantage for one same-target attack with Host class, turn and retry checks',async()=>{
 const {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction}=await import('./headlessCombatEngine')
 const {migrateCharacterToDnd5e,createCombatantFromDnd5eCharacter}=await import('./character')
 const pkg={manifest:{id:'test.advantage-exchange',name:'Synthetic attack exchange',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0-1.0'} as const}
 const dispose=registerDnd5eRulesPlugin({manifest:pkg.manifest,setup(api){api.registerDeclarativeSubclass({
  schemaVersion:1,id:'samurai',classId:'fighter',name:'Synthetic subclass',summary:'Synthetic',resources:[],
  abilities:[{schemaVersion:1,id:'rapid-strike',name:'Attack exchange',description:'Synthetic',level:15,
   trigger:{kind:'before-attack-roll'},targeting:{kind:'self'},cost:{economy:'none'},effects:[],
   mechanic:{kind:'advantage-for-extra-attack',requiresOwnAttackAction:true,bindSameTarget:true,usesPerTurn:1},automation:'full'}],
  combatHooks:[{id:'exchange',timing:'before-attack-roll',abilityId:'rapid-strike',decision:'actor-choice',activation:'prearm',retention:'single-attempt'}]
 })}})
 try{
 const featureId=pkg.manifest.id+':samurai.rapid-strike',grantId='advantage-exchange:'+featureId
 expect(dnd5eDeclarativeAttackIntentDefinition(featureId)).toBeTruthy()
 const hero=normalizeCharacter({id:'hero',currentHp:50,maxHp:50,charClass:'战士',level:15,dnd5eClassLevels:{fighter:15},dnd5eClassChoices:{fighter:{subclass:pkg.manifest.id+':samurai',fightingStyles:['archery']}},abilities:{str:16,dex:14,con:14,int:10,wis:12,cha:10}})
 const actor=createCombatantFromDnd5eCharacter({character:migrateCharacterToDnd5e(hero),controller:'player',initiativeD20:20,position:{x:0,y:0}})

 const target=createDnd5eCombatant({id:'target',name:'target',controller:'dm',initiative:1,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,currentHp:100,maxHp:100,temporaryHp:0,speed:30,position:{x:5,y:0},concentrating:false})
 target.classState.recklessAttackTurnKey='advantage-source'
 const state=startDnd5eHeadlessCombat('rapid',[actor,target,{...structuredClone(target),id:'other'}])
 const action:Extract<Dnd5eAction,{type:'attack'}>={type:'attack',actorId:'hero',targetId:'target',attackModifier:5,d20:2,d20Second:18,declarativeIntentFeatureIds:[featureId],classDamageContext:{weaponId:'longsword',weaponProperties:['versatile'],proficient:true,mode:'melee',reachFeet:5,finesse:false,strengthBased:true,weaponDamageSides:8,damageType:'slashing',adjacentEnemyOfTarget:false},damage:{count:1,sides:8,bonus:0,rolls:[4],type:'slashing'}}
 const original=structuredClone(state)
 const first=resolveDnd5eHeadlessAction(state,action)
 expect(first.ok,first.ok?'':first.reason).toBe(true)
 expect(state).toEqual(original)
 expect(first.events).toContainEqual(expect.objectContaining({type:'attack-resolved',rollMode:'normal',d20:2,hit:false}))
 expect(first.state.combatants.hero.classState.activityWeaponAttackGrants?.[grantId]).toMatchObject({requiredTargetId:'target',remainingAttacks:1,economy:'none'})
 const follow={...action,spendAction:false,declarativeIntentFeatureIds:[],activityWeaponAttackGrantId:grantId}
 const reload=JSON.parse(JSON.stringify(first.state))
 expect(resolveDnd5eHeadlessAction(reload,{...follow,targetId:'other'}).ok).toBe(false)
 expect(resolveDnd5eHeadlessAction(reload,{...action,spendAction:false}).ok).toBe(false)
 const next=resolveDnd5eHeadlessAction(reload,follow)
 expect(next.ok,next.ok?'':next.reason).toBe(true)
 expect(next.events).toContainEqual(expect.objectContaining({type:'attack-resolved',rollMode:'advantage',d20:18,hit:true,attackOrigin:'attack-action'}))
 expect(next.state.combatants.hero.classState.activityWeaponAttackGrants?.[grantId]).toBeUndefined()
 expect(resolveDnd5eHeadlessAction(next.state,follow).ok).toBe(false)
 const noAdv=structuredClone(original);delete noAdv.combatants.target.classState.recklessAttackTurnKey
 expect(resolveDnd5eHeadlessAction(noAdv,action).ok).toBe(false)
 expect(resolveDnd5eHeadlessAction(original,{...action,spendBonusAction:true}).ok).toBe(false)
 expect(resolveDnd5eHeadlessAction(original,{...action,mode:'disadvantage'}).ok).toBe(false)
 expect(resolveDnd5eHeadlessAction(original,{...action,spendAction:false}).ok).toBe(false)
 const wrongTurn=structuredClone(original);wrongTurn.initiativeIndex=1
 expect(resolveDnd5eHeadlessAction(wrongTurn,action).ok).toBe(false)
 const unowned=structuredClone(original);unowned.combatants.hero.pluginFeatureIds=[]
 expect(resolveDnd5eHeadlessAction(unowned,action).ok).toBe(false)
 const beforeFailure=structuredClone(original)
 const failed=resolveDnd5eHeadlessAction(original,{...action,d20:18,damage:{...action.damage,rolls:[99]}})
 expect(failed.ok).toBe(false)
 expect(original).toEqual(beforeFailure)
 const retry=resolveDnd5eHeadlessAction(original,{...action,d20:18})
 expect(retry.ok,retry.ok?'':retry.reason).toBe(true)
 const low=structuredClone(original);low.combatants.hero.classLevels={fighter:14};low.combatants.hero.level=20
 expect(resolveDnd5eHeadlessAction(low,action).ok).toBe(false)
 let advanced=first.state
 for(let i=0;i<3;i++){
   const actorId=advanced.initiativeOrder[advanced.initiativeIndex]
   const ended=resolveDnd5eHeadlessAction(advanced,{type:'end-turn',actorId})
   expect(ended.ok,ended.ok?'':ended.reason).toBe(true)
   advanced=ended.state
 }
 expect(advanced.round).toBe(2)
 expect(advanced.combatants.hero.classState.activityWeaponAttackGrants?.[grantId]).toBeUndefined()
 const nextRound=resolveDnd5eHeadlessAction(advanced,{...action,mode:'advantage'})
 expect(nextRound.ok,nextRound.ok?'':nextRound.reason).toBe(true)
 expect(nextRound.state.combatants.hero.classState.activityWeaponAttackGrants?.[grantId]).toMatchObject({remainingAttacks:1})
 }finally{dispose()}
})

