import {expect,it} from 'vitest'
import {getDnd5eSrdMonster} from './monsters'
import {validateDnd5eMonsterSchema} from './monsterSchema'
import {registerDnd5ePluginMonsterCatalogEntry} from './roomMonsterCatalog'
import {buildDnd5eCustomMonster,dnd5eCustomMonsterDraftFromStatBlock} from './customMonsterWorkshop'
import {createDnd5eCombatant,startDnd5eHeadlessCombat,resolveDnd5eHeadlessAction} from './headlessCombatEngine'

it('preserves imported keen perception and settles only the declared senses with normal disadvantage cancellation',()=>{
 const monster=structuredClone(getDnd5eSrdMonster('srd-5.1:griffon')!)
 monster.id='room-monster:keen-perception-test';monster.source='DM 自定义'
 monster.traits=[{name:'Keen perception',description:'Conditional senses.',automation:'headless',rule:{kind:'keen-perception',senses:['sight','smell']}}]
 expect(validateDnd5eMonsterSchema(monster)).toEqual([])
 const restored=buildDnd5eCustomMonster(dnd5eCustomMonsterDraftFromStatBlock(JSON.parse(JSON.stringify(monster))))
 expect(restored.traits).toEqual(monster.traits)
 const dispose=registerDnd5ePluginMonsterCatalogEntry(restored)
 try{
  for(const context of ['smell','sight','hearing',undefined] as const)for(const exhausted of [false,true]){
   const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,statBlockId:restored.id,
    abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:13,proficiencyBonus:2,currentHp:33,maxHp:33,temporaryHp:0,speed:20,concentrating:false,position:{x:0,y:0},exhaustionLevel:exhausted?1:0})
   const state=startDnd5eHeadlessCombat('keen-test',[actor,{...structuredClone(actor),id:'enemy',controller:'dm',initiative:1}])
   const result=resolveDnd5eHeadlessAction(state,{type:'ability-check',actorId:'actor',ability:'wis',skill:'perception',context,d20:4,d20Second:18,dc:10})
   expect(result.ok,JSON.stringify(result)).toBe(true)
   expect(result.events).toContainEqual(expect.objectContaining({type:'ability-check-resolved',total:!exhausted&&(context==='smell'||context==='sight')?18:4}))
  }
 }finally{dispose()}
 for(const senses of [[],['smell','smell'],['unknown']]){
  const invalid={...monster,traits:[{...monster.traits[0],rule:{kind:'keen-perception',senses}}]}
  expect(validateDnd5eMonsterSchema(invalid as typeof monster).length).toBeGreaterThan(0)
 }
})
