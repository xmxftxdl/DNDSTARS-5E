import {it,expect} from 'vitest'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction,dnd5eCombatantPairKey,type Dnd5eAction} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import {registerDnd5eRulesPlugin} from '../../../src/rulesets/dnd5e/pluginApi'
import {prepareDnd5eOriginalD20ForParent} from '../../../src/rulesets/dnd5e/originalD20Preparation'
import {resolveDnd5ePreparedWithDamageReactions} from '../../../src/rulesets/dnd5e/damageReactionFlow'

it('stops the real parent after original dice, before attack outcome/damage, then replays its bound receipt exactly once',async()=>{
  const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.original-bountiful',name:'Original parent',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Test',license:'CC0'},setup(api){api.registerFeat({id:'luck',name:'Luck',summary:'Test',description:'Test',automation:'full',declarativeAbility:{schemaVersion:1,id:'luck',name:'Luck',description:'Test',level:1,trigger:{kind:'after-d20-roll'},cost:{economy:'reaction'},targeting:{kind:'single-creature',relation:'ally',rangeFeet:30,requiresSight:true,includeSelf:false},effects:[],automation:'full',mechanic:{kind:'ally-natural-one-reroll'}}})}})
  try{
    const make=(id:string,initiative:number,controller:'player'|'dm'='player')=>createDnd5eCombatant({id,name:id,initiative,controller,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    const actor=make('actor',30),owner=make('owner',20),enemy=make('enemy',10,'dm')
    owner.pluginFeatureIds=['test.original-bountiful:feat-luck'];owner.racialRules={halflingLucky:true,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[]}
    const state=startDnd5eHeadlessCombat('original-parent',[actor,owner,enemy]);state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','owner')]:5}
    const action:Dnd5eAction={type:'attack',actorId:'actor',targetId:'enemy',attackModifier:5,d20:1,damage:{count:1,sides:6,bonus:0,rolls:[3],type:'slashing'}}
    const source={prepared:{state},action},before=structuredClone(source)
    const resolve=(input:typeof source)=>resolveDnd5eHeadlessAction(input.prepared.state,input.action)
    let choices=0
    const receipt=await prepareDnd5eOriginalD20ForParent({parentId:'parent-1',source,resolve,actorId:'actor',kind:'attack',authorityUnchanged:()=>true,choose:async()=>{choices++;return {ownerId:'owner',featureId:'test.original-bountiful:feat-luck',replacement:15}}})
    expect(choices).toBe(1);expect(source).toEqual(before)
    expect(receipt.ready).toMatchObject({actorId:'actor',originalRolls:[1],values:[15]})
    expect(receipt.state.combatants.owner.turn.reactionAvailable).toBe(false)
    expect(receipt.state.combatants.enemy.currentHp).toBe(30)
    expect(receipt.events.some(event=>event.type==='attack-resolved'||event.type==='damage-applied')).toBe(false)
    expect(()=>receipt.replayFor('different-parent',async()=>undefined)).toThrow('wrong-parent')
    const replay=receipt.replayFor('parent-1',async()=>{throw Error('no fresh re-ask of original die')})
    const result=await resolveDnd5ePreparedWithDamageReactions({combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>[],chooseAllyNaturalOne:replay.choose},source,resolve)
    replay.assertConsumed()
    expect(result.ok).toBe(true);expect(result.state.combatants.enemy.currentHp).toBe(27)
    expect(result.events.filter(event=>event.type==='turn-resource-spent'&&event.resource==='reaction')).toHaveLength(1)
    expect(choices).toBe(1);expect(source).toEqual(before)
  }finally{dispose()}
})
