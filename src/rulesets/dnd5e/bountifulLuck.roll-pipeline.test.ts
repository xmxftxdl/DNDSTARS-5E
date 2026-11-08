import {it,expect} from 'vitest'
import {createDnd5eCombatant} from '../../../src/rulesets/dnd5e/headlessCombatEngine'
import {resolveDnd5eAbilityCheckInterrupts} from '../../../src/pages/maps/dnd5eRollInterruptPipeline'

const actor=()=>{const value=createDnd5eCombatant({id:'original-roller',name:'Original roller',initiative:1,controller:'player',abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:12,currentHp:30,maxHp:30,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false});value.racialRules={halflingLucky:true,halfOrcRelentlessEndurance:false,halfOrcSavageAttacks:false,innateSpells:[]};return value}

it('asks the original-die stage before native Lucky and previews the retained new 1 without recursively rolling it',async()=>{
  const order:string[]=[]
  const result=await resolveDnd5eAbilityCheckInterrupts({combatant:actor(),targetName:'Original roller',dc:12,mode:'normal',label:'Stealth',
    rollD20:async(_label,_name,context)=>{order.push('original');expect(context?.rollerTokenId).toBe('original-roller');return 1},
    resolveOriginalDice:async request=>{order.push('raw-checkpoint');expect(request).toEqual({d20:1,d20Second:undefined});return [1]},
    previewTotal:(first)=>{order.push('retained-preview');return first+3}})
  expect(order).toEqual(['original','raw-checkpoint','retained-preview'])
  expect(result).toMatchObject({d20:1,effectiveD20:1,halflingLuckyD20:undefined,total:4})
})

it('keeps both original advantage faces distinct from their adopted values and skips any unused native pre-roll',async()=>{
  let unused=0
  const result=await resolveDnd5eAbilityCheckInterrupts({combatant:actor(),targetName:'Original roller',dc:12,mode:'advantage',label:'Stealth',
    rollD20Pair:async()=>[1,1],rollD20:async()=>{unused++;return 20},
    resolveOriginalDice:async request=>{expect(request).toEqual({d20:1,d20Second:1});return [1,15]},
    previewTotal:(first,second)=>Math.max(first,second??0)+3})
  expect(unused).toBe(0)
  expect(result).toMatchObject({d20:1,d20Second:1,effectiveD20:1,effectiveD20Second:15,total:18})
})

it('preserves the existing native Lucky route when no source-qualified parent stage adopts the original die',async()=>{
  const labels:string[]=[]
  const result=await resolveDnd5eAbilityCheckInterrupts({combatant:actor(),targetName:'Original roller',dc:12,mode:'normal',label:'Stealth',
    rollD20:async label=>{labels.push(label);return labels.length===1?1:15},resolveOriginalDice:async()=>undefined,previewTotal:first=>first+3})
  expect(labels).toHaveLength(2);expect(labels[1]).toContain('半身人幸运')
  expect(result).toMatchObject({d20:1,halflingLuckyD20:15,effectiveD20:15,total:18})
})

it('rejects a forged retained-face shape before optional resources can be offered',async()=>{
  let optional=0
  await expect(resolveDnd5eAbilityCheckInterrupts({combatant:actor(),targetName:'Original roller',dc:12,mode:'normal',label:'Stealth',
    rollD20:async()=>1,resolveOriginalDice:async()=>[15,20],previewTotal:first=>first,requestOptionalBonusDie:async()=>{optional++;return undefined}})).rejects.toThrow('invalid-original-d20-retained-faces')
  expect(optional).toBe(0)
})
