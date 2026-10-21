import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eActivityExecutionInput } from '../../rulesets/dnd5e/activities/dnd5eActivityExecutor'
import { activitySavingThrowPreview } from './activitySavingThrowPreview'
import { activityEffectDiceRecipes } from './activityEffectDice'

const actor = { id: 'caster', controller: 'player' as const, name: '法师', level: 10, proficiencyBonus: 4,
  abilities: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 }, armorClass: 15,
  currentHp: 100, maxHp: 100, conditions: [], spellSaveDc: 17 }
const input: Dnd5eActivityExecutionInput = {
  actor, targets: [{ ...actor, id: 'target', name: '目标', savingThrowModifiers: { dex: 3 } }], rolls: {},
  activity: { schemaVersion: 1, id: 'save-test', name: 'Save test', activation: { kind: 'action', cost: 1 },
    target: { kind: 'self' },
    checks: [{ id: 'save', kind: 'saving-throw', scope: 'per-target', rollId: 'save-d20', ability: 'dex',
      rollMode: 'host-derived', dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } } }],
    outcomes: [], automation: automationCapabilityFromLegacyStatus('full') },
}
const declaration = { id: 'save-d20:target', label: '豁免', count: 1, sides: 20,
  rollerTokenId: 'target', d20RollKind: 'saving-throw' as const }

it('does not present a success preview before required effect dice are available',()=>{
  const affected={...input,targets:input.targets.map(target=>({...target,rollDiceEffects:[{id:'penalty',modifiers:{
    rollDiceModifiers:[{count:1,sides:6 as const,direction:'subtract' as const,appliesTo:['saving-throw' as const]}],
  }}]}))}
  expect(activitySavingThrowPreview(affected,declaration)).toBeUndefined()
  const recipes=activityEffectDiceRecipes({...affected,eventId:'test'},declaration)
  expect(recipes).toHaveLength(1)
  const rolls=Object.fromEntries(recipes.map(recipe=>[recipe.id,[6]]))
  const preview=activitySavingThrowPreview({...affected,effectDicePreview:{eventId:'test',rolls}},declaration)!
  expect(preview.evaluate(19)).toBe(false)
  expect(preview.evaluate(20)).toBe(true)
  for (const check of [
    {...affected.activity.checks![0],automaticSuccessIfConditionImmune:'charmed' as const},
    {...affected.activity.checks![0],automaticFailureIfAllied:true},
    {...affected.activity.checks![0],allowWillingFailure:true},
  ]) {
    expect(activityEffectDiceRecipes({...affected,eventId:'test',willingTargetIds:['target'],
      targets:affected.targets.map(target=>({...target,conditionImmunities:['charmed' as const]})),
      activity:{...affected.activity,checks:[check]}},declaration)).toEqual([])
  }
})

it('previews caster-owned attack dice against the target AC, including natural dice and corrections', () => {
  const attackInput: Dnd5eActivityExecutionInput = { ...input,
    actor: { ...actor, spellAttackBonus: 9 },
    activity: { ...input.activity, checks: [{ id: 'attack', kind: 'attack-roll',
      rollId: 'attack-d20', scope: 'per-target', rollMode: 'host-derived',
      attackBonus: { kind: 'reference', reference: { kind: 'actor-spell-attack-bonus' } } }] },
  }
  const attackDeclaration = { ...declaration, id: 'attack-d20:target', rollerTokenId: 'caster', d20RollKind: 'attack' as const }
  const preview = activitySavingThrowPreview(attackInput, attackDeclaration)!
  expect(preview.kind).toBe('attack')
  expect(preview.targetName).toBe('目标')
  expect(preview.evaluate(6)).toBe(true)
  expect(preview.evaluate(5)).toBe(false)
  expect(preview.evaluate(1)).toBe(false)
  expect(preview.evaluate(20)).toBe(true)
  expect(activitySavingThrowPreview(attackInput, { ...attackDeclaration, count: 2, d20RollMode: 'advantage' })!.evaluate(1, 6)).toBe(true)
  expect(activitySavingThrowPreview(attackInput, { ...attackDeclaration, count: 2, d20RollMode: 'disadvantage' })!.evaluate(1, 20)).toBe(false)
  expect(attackInput.rolls).toEqual({})
})

it('evaluates the save before any damage pool exists and updates on DM face correction', () => {
  const preview = activitySavingThrowPreview(input, declaration)!
  expect(preview.evaluate(14)).toBe(true)
  expect(preview.evaluate(13)).toBe(false)
  expect(input.rolls).toEqual({})
})
it('uses the adopted advantage/disadvantage die and the correct target modifier', () => {
  expect(activitySavingThrowPreview(input, { ...declaration, count: 2, d20RollMode: 'advantage' })!.evaluate(2, 14)).toBe(true)
  expect(activitySavingThrowPreview(input, { ...declaration, count: 2, d20RollMode: 'disadvantage' })!.evaluate(2, 14)).toBe(false)
  expect(activitySavingThrowPreview(input, { ...declaration, rollerTokenId: 'other' })).toBeUndefined()
})
it('does not treat a damage or random d20 as a saving throw', () => {
  expect(activitySavingThrowPreview(input, { ...declaration, d20RollKind: undefined })).toBeUndefined()
})
it('does not apply advantage again after the Host has cancelled it with disadvantage', () => {
  const source = { ...input, targets: [{ ...input.targets[0]!, creatureType: 'humanoid' }],
    activity: { ...input.activity, checks: input.activity.checks!.map(check => ({ ...check,
      rollModeByCreatureType: { creatureTypes: ['humanoid'], mode: 'advantage' as const } })) } }
  const preview = activitySavingThrowPreview(source, { ...declaration, d20RollMode: 'normal' })!
  expect(preview.evaluate(2, 20)).toBe(false)
})


it.each(['attack-roll','saving-throw'] as const)('isolates UI preview and effect bonus dice for repeated projectile %s checks',kind=>{
 const effect={id:'blessing',modifiers:{rollDiceModifiers:[{count:1,sides:4 as const,direction:'add' as const,appliesTo:[kind==='attack-roll'?'attack' as const:'saving-throw' as const]}]}}
 const source:Dnd5eActivityExecutionInput={...input,
   actor:{...actor,rollDiceEffects:kind==='attack-roll'?[effect]:[]},
   targets:input.targets.map(target=>({...target,rollDiceEffects:kind==='saving-throw'?[effect]:[]})),
   projectileTargetIds:['target','target'],
   activity:{...input.activity,target:{kind:'creature',relation:'any',count:2,allowDuplicateTargets:true},
     checks:[kind==='attack-roll'?{id:'check',kind,scope:'per-target',perProjectile:true,rollId:'d20',rollMode:'host-derived',attackBonus:{kind:'constant',value:5}}:
       {id:'check',kind,scope:'per-target',perProjectile:true,rollId:'d20',rollMode:'host-derived',ability:'dex',dc:{kind:'constant',value:17}}]},
 }
 const declarations=[0,1].map(index=>({...declaration,id:`d20:projectile:${index}:target`,rollerTokenId:kind==='attack-roll'?'caster':'target',d20RollKind:kind==='attack-roll'?'attack' as const:'saving-throw' as const}))
 const recipes=declarations.flatMap(d=>activityEffectDiceRecipes({...source,eventId:'projectile-test'},d))
 expect(recipes).toHaveLength(2)
 expect(new Set(recipes.map(r=>r.id)).size).toBe(2)
 const rolls=Object.fromEntries(recipes.map((r,index)=>[r.id,[index===0?1:4]]))
 expect(declarations.map(d=>activitySavingThrowPreview({...source,effectDicePreview:{eventId:'projectile-test',rolls}},d)!.evaluate(kind==='attack-roll'?6:10))).toEqual([false,true])
 expect(activityEffectDiceRecipes({...source,projectileTargetIds:[],eventId:'projectile-test'},declarations[0])).toEqual([])
 expect(activitySavingThrowPreview({...source,projectileTargetIds:[]},declarations[0])).toBeUndefined()
 expect(activitySavingThrowPreview(source,{...declarations[0],id:'d20:projectile:2:target'})).toBeUndefined()
})


it('uses the same selected knowledge modifiers in the dice preview as the saving throw', () => {
  const check = input.activity.checks![0]
  if (check.kind !== 'saving-throw') throw new Error('expected save')
  const selected = { ...input, choices: { knowledge: 'familiar' }, activity: { ...input.activity,
    choices: [{ id: 'knowledge', label: 'Knowledge', options: [{ id: 'familiar', label: 'Familiar' }] }],
    checks: [{ ...check, modifierByChoice: [{ choiceId: 'knowledge', modifiers: { familiar: -5 } }] }],
  } }
  expect(activitySavingThrowPreview(selected, declaration)!.evaluate(18)).toBe(false)
  expect(activitySavingThrowPreview(selected, declaration)!.evaluate(19)).toBe(true)
  expect(() => activitySavingThrowPreview({ ...selected, choices: undefined }, declaration)!.evaluate(18)).toThrow('invalid saving throw modifier choice')
})
