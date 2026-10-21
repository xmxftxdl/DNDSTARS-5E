import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantCanSee,
  dnd5eCombatantCanDetect, dnd5eAttackerIsUnseenForAttack, dnd5eTargetIsUnseenForAttack,
  dnd5eDirectedCombatantPairKey } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, dnd5eConditionsFromActiveEffects } from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'

function fixture() {
  const actors = ['caster', 'target', 'other'].map((id, i) => createDnd5eCombatant({
    id, name: id, controller: i === 1 ? 'dm' : 'player', initiative: 20-i,
    abilities: { str:10,dex:10,con:10,int:18,wis:10,cha:10 }, proficiencyBonus:3,
    armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:i*5,y:0},concentrating:false,
  }))
  const state = startDnd5eHeadlessCombat('locate', actors)
  const target = state.combatants.target
  target.classState.activeEffects = [...migrateLegacyDnd5eConditions({targetId:'target',conditions:['invisible']}),
    createDnd5eMechanicalEffect({definitionId:'test:locate',label:'Located',source:{kind:'spell',actorId:'caster'},
      targetId:'target',modifiers:{locationKnownToSource:true}})]
  target.conditions = dnd5eConditionsFromActiveEffects(target.classState.activeEffects)
  target.classState.hiddenCheckTotal = 25
  return state
}

it('knows the location without sight and suppresses invisible attack benefits only against the source',()=>{
  const state=fixture()
  expect(dnd5eCombatantCanSee(state,'caster','target')).toBe(false)
  expect(dnd5eCombatantCanDetect(state,'caster','target')).toBe(true)
  expect(dnd5eCombatantCanDetect(state,'other','target')).toBe(false)
  expect(dnd5eTargetIsUnseenForAttack(state,'caster','target')).toBe(false)
  expect(dnd5eAttackerIsUnseenForAttack(state,'target','caster')).toBe(false)
  expect(dnd5eTargetIsUnseenForAttack(state,'other','target')).toBe(true)
  expect(dnd5eAttackerIsUnseenForAttack(state,'target','other')).toBe(true)
})

it.each(['physicalLineOfSightBlockedByCombatantPair','lineOfSightBlockedByCombatantPair','magicalDarknessByCombatantPair'] as const)(
  'preserves other causes of unseen attacks: %s',field=>{
    const state=fixture()
    state[field]={[dnd5eDirectedCombatantPairKey('caster','target')]:true}
    expect(dnd5eCombatantCanDetect(state,'caster','target')).toBe(true)
    expect(dnd5eCombatantCanSee(state,'caster','target')).toBe(false)
    expect(dnd5eTargetIsUnseenForAttack(state,'caster','target')).toBe(true)
    expect(dnd5eAttackerIsUnseenForAttack(state,'target','caster')).toBe(true)
  })

it('ignores hiding for the source when the target is otherwise visible, preserving hiding against others',()=>{
  const state=fixture(),target=state.combatants.target
  target.classState.activeEffects=target.classState.activeEffects!.filter(effect=>effect.modifiers?.locationKnownToSource)
  target.conditions=[]
  expect(dnd5eCombatantCanSee(state,'caster','target')).toBe(true)
  expect(dnd5eCombatantCanSee(state,'other','target')).toBe(false)
  target.classState.activeEffects=[]
  expect(dnd5eCombatantCanSee(state,'caster','target')).toBe(false)
})
