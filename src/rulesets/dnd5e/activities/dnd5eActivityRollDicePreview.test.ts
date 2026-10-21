import {expect,it} from 'vitest'
import {automationCapabilityFromLegacyStatus} from '../../../domain/automation/automationCapability'
import {createDnd5eCombatant} from '../headlessCombatEngine'
import {createDnd5eMechanicalEffect} from '../activeEffects'
import {dnd5eRollDiceRecipes} from '../rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId,dnd5eRollDiceCheckSlot,withDnd5eRollDiceTransaction,type Dnd5eRollDiceAudit} from '../rollDiceTransaction'
import {dnd5eActivityActorSnapshotFromCombatantV1} from './dnd5eActivityCombatAuthority'
import {previewDnd5eActivityAttackV1,resolveDnd5eActivity} from './dnd5eActivityExecutor'
import {dnd5eActivitySubmittedAttackCheckSuccessKeysV1} from './dnd5eActivityRollRecipe'
import type {Dnd5eActivityDefinitionV1} from './dnd5eActivityContracts'

function fixture() {
  const make=(id:string)=>createDnd5eCombatant({id,name:id,controller:'player',initiative:1,abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},armorClass:12,proficiencyBonus:2,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  const caster=make('actor')
  caster.classState.activeEffects=[createDnd5eMechanicalEffect({id:'penalty',definitionId:'penalty',label:'Penalty',source:{kind:'plugin'},targetId:'actor',appliedAt:1,
    modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['attack']}]}})]
  const actor=dnd5eActivityActorSnapshotFromCombatantV1(caster),targets=['a','b'].map(id=>dnd5eActivityActorSnapshotFromCombatantV1(make(id)))
  const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'multi',name:'Multi',activation:{kind:'free'},target:{kind:'creature',relation:'any',count:2},
    automation:automationCapabilityFromLegacyStatus('full'),checks:[{id:'hit',kind:'attack-roll',rollId:'hit',scope:'per-target',attackBonus:{kind:'constant',value:0},rollMode:'normal'}],
    outcomes:[{id:'hit',when:{kind:'check',checkId:'hit',result:'success'},operations:[{id:'hurt',kind:'damage',target:'target',damageType:'force',amount:{kind:'constant',value:3}}]}]}
  const input={activity,actor,targets,rolls:{'hit:a':{values:[15]},'hit:b':{values:[15]}}}
  const dice=(occurrence:number,values:number[])=>Object.fromEntries(targets.flatMap((target,index)=>dnd5eRollDiceRecipes({actorId:actor.id,effects:actor.rollDiceEffects,kind:'attack',
    eventId:dnd5eRollDiceOccurrenceId('transaction',actor.id,'attack',occurrence,dnd5eRollDiceCheckSlot(activity.id,`hit:${target.id}`,'source'))}).map(recipe=>[recipe.id,[values[index]]])))
  return {input,dice}
}

it('previews targets in any order without consuming dice, and conditional rolls agree with settlement',()=>{
  const {input,dice}=fixture(), rolls=dice(0,[6,1]),audit:Dnd5eRollDiceAudit[]=[]
  const result=withDnd5eRollDiceTransaction({eventId:'transaction',rolls,onAudit:entry=>audit.push(entry)},()=>{
    for(let iteration=0;iteration<3;iteration++) {
      expect(previewDnd5eActivityAttackV1(input,'hit:b')).toMatchObject({total:14,success:true})
      expect(previewDnd5eActivityAttackV1(input,'hit:a')).toMatchObject({total:9,success:false})
      expect(dnd5eActivitySubmittedAttackCheckSuccessKeysV1(input.activity,{...input,hostRollMode:()=> 'normal'})).toEqual(new Set(['hit:b']))
    }
    expect(audit).toEqual([])
    return resolveDnd5eActivity(input)
  })
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok){
    expect(result.checks.map(check=>check.total)).toEqual([9,14])
    expect(result.proposals).toEqual([expect.objectContaining({kind:'deal-damage',targetId:'b',amount:3})])
  }
  expect(audit).toHaveLength(2)
})

it('can preview outside settlement using its explicit context, which cannot authorize actual execution',()=>{
  const {input,dice}=fixture()
  const withPreview={...input,effectDicePreview:{eventId:'transaction',rolls:dice(0,[6,1])}}
  expect(previewDnd5eActivityAttackV1(withPreview,'hit:b')?.success).toBe(true)
  expect(dnd5eActivitySubmittedAttackCheckSuccessKeysV1(input.activity,{...withPreview,hostRollMode:()=> 'normal'})).toEqual(new Set(['hit:b']))
  expect(resolveDnd5eActivity(withPreview).ok).toBe(false)
})

it('uses new dice for a second execution of the same Activity within one transaction',()=>{
  const {input,dice}=fixture(),audit:Dnd5eRollDiceAudit[]=[]
  const result=withDnd5eRollDiceTransaction({eventId:'transaction',rolls:{...dice(0,[6,1]),...dice(1,[1,6])},onAudit:entry=>audit.push(entry)},()=>{
    const first=resolveDnd5eActivity(input)
    expect(first.ok).toBe(true)
    expect(previewDnd5eActivityAttackV1(input,'hit:a')?.success).toBe(true)
    expect(previewDnd5eActivityAttackV1(input,'hit:b')?.success).toBe(false)
    return resolveDnd5eActivity(input)
  })
  expect(result.ok).toBe(true)
  if(result.ok) expect(result.checks.map(check=>check.total)).toEqual([14,9])
  expect(audit).toHaveLength(4)
  expect(new Set(audit.map(entry=>entry.recipe.id)).size).toBe(4)
})
