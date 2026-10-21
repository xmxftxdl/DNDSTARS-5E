import { describe, expect, it } from 'vitest'
import { compileDnd5eActivityPatternV1 } from './dnd5eActivityPatterns'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { dnd5eActivityRolledChoices } from './dnd5eActivityRolledChoices'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantPairKey } from '../headlessCombatEngine'
import { finishDnd5eActivityContinuationV1, prepareDnd5eActivityContinuationV1, dnd5eMandatoryContinuationTargets } from './dnd5eActivityContinuation'
import { normalizeDnd5eLocalContentAiSyntax } from '../localContentAiImport'

const activity = compileDnd5eActivityPatternV1({ schemaVersion: 1, id: 'rolled-type', name: 'Rolled type', source: { kind: 'feature', id: 'rolled-type' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 60 }, pattern: 'roll-effect', choices: [{ id: 'die', label: 'Choose die', options: [{ id: '0', label: 'First' }, { id: '1', label: 'Second' }] }], check: {kind:'attack'}, result: { kind: 'damage', damageType: 'acid', damageTypeFromRoll: { rollId: 'damage', indexChoiceId: 'die', types: ['acid','cold','fire','force','lightning','poison','psychic','thunder'] }, amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 8 } } })
const actor = {id:'actor',controller:'player' as const,level:5,proficiencyBonus:3,abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},armorClass:14,currentHp:30,maxHp:30,conditions:[],spellAttackBonus:7}
describe('Host rolled choices and continuation gates',()=>{
 it('normalizes an omitted mapped base but never uses it when rolls or choices are invalid',()=>{
  const raw:any=structuredClone(activity)
  delete raw.outcomes[0].operations[0].damageType
  const normalized=normalizeDnd5eLocalContentAiSyntax({schemaVersion:1,assumptions:[],unsupported:[],contentJson:JSON.stringify({activities:[raw]})})
  const configured=JSON.parse(normalized.contentJson).activities[0]
  expect(validateDnd5eActivityDefinitionV1(configured)).toEqual([])
  const input={activity:configured,actor,targets:[{...actor,id:'target',controller:'dm' as const}],choices:{die:'1'},rolls:{damage:{values:[1,5]},'attack:target':{values:[12]}},checkRollModes:{'check:target':'normal' as const},distanceFeetByTargetId:{target:10}}
  expect(resolveDnd5eActivity(input)).toMatchObject({ok:true,proposals:[{damageType:'lightning',amount:6}]})
  expect(resolveDnd5eActivity({...input,choices:{die:'invalid'}}).ok).toBe(false)
  expect(resolveDnd5eActivity({...input,rolls:{'attack:target':{values:[12]}}}).ok).toBe(false)
  expect(resolveDnd5eActivity({...input,rolls:{...input.rolls,damage:{values:[1,9]}}}).ok).toBe(false)
 })
 it('resolves a direct damage-type choice without a die-index mapping and rejects unlisted types',()=>{
  const direct=structuredClone(activity)
  direct.choices=[{id:'element',label:'Element',options:[{id:'cold',label:'Cold'},{id:'fire',label:'Fire'}]}]
  const operation=direct.outcomes[0].operations[0]
  if(operation.kind!=='damage')throw Error('fixture')
  delete operation.damageTypeFromRoll
  operation.damageTypeChoiceId='element'
  expect(validateDnd5eActivityDefinitionV1(direct)).toEqual([])
  for(const selected of ['cold','fire','force',undefined]){
   const result=resolveDnd5eActivity({activity:direct,actor,targets:[{...actor,id:'target',controller:'dm'}],
    rolls:{damage:{values:[3,5]},'attack:target':{values:[12]}},choices:selected?{element:selected}:undefined,
    checkRollModes:{'check:target':'normal'},distanceFeetByTargetId:{target:10}})
   expect(result.ok).toBe(selected==='cold'||selected==='fire')
   if(result.ok)expect(result.proposals[0]).toMatchObject({kind:'deal-damage',amount:8,damageType:selected})
  }
  operation.damageTypeChoiceId='missing'
  expect(validateDnd5eActivityDefinitionV1(direct).join(' ')).toContain('must reference damage-type choice options')
 })
 it('presents both actual faces and resolves only the selected type',()=>{
  const rolls={damage:{values:[3,5]},'attack:target':{values:[12]}}
  expect(dnd5eActivityRolledChoices(activity,rolls)[0].options.map(o=>o.label)).toEqual(['First：3（火焰）','Second：5（闪电）'])
  const result=resolveDnd5eActivity({activity,actor,targets:[{...actor,id:'target',controller:'dm'}],rolls,choices:{die:'1'},checkRollModes:{'check:target':'normal'},distanceFeetByTargetId:{target:10}})
  expect(result,JSON.stringify(result)).toMatchObject({ok:true,proposals:[{kind:'deal-damage',amount:8,damageType:'lightning'}]})
  expect(resolveDnd5eActivity({activity,actor,targets:[{...actor,id:'target'}],rolls,choices:{die:'7'},distanceFeetByTargetId:{target:10}}).ok).toBe(false)
 })
 it('rejects a damage mapping to undeclared dice at import',()=>{
  const invalid=structuredClone(activity)
  const op=invalid.outcomes[0].operations[0]
  if(op.kind!=='damage')throw Error('fixture')
  op.damageTypeFromRoll!.rollId='forged'
  expect(validateDnd5eActivityDefinitionV1(invalid).join(' ')).toContain('declared dice')
 })
 it('does not offer a chain after a miss even when the dice match',()=>{
  const source=createDnd5eCombatant({...actor,name:'Actor',initiative:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
  for(const hit of [false,true]){
   const state=startDnd5eHeadlessCombat('gate',[source])
   const rule={...activity,continuation:{nextActivityId:'next',maximumSteps:3,excludePreviousTargets:true,requiredSuccessfulCheckId:'check',when:{kind:'equal-dice' as const,rollId:'damage',first:0,second:1}}}
   finishDnd5eActivityContinuationV1(state,{schemaVersion:1,commandId:'cast',actorId:'actor',packageId:'local.gate',packageVersion:'1.0.0',activityId:activity.id,targetIds:['target'],expectedRevision:1},rule,{damage:{values:[4,4]}},[{checkId:'check',success:hit} as never])
   expect(state.activityContinuations?.cast.nextActivityId).toBe(hit?'next':undefined)
  }
 })
})

it('rejects omitted splash targets and retains the original cast level in its live grant',()=>{
 const make=(id:string)=>createDnd5eCombatant({...actor,id,name:id,initiative:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
 const state=startDnd5eHeadlessCombat('splash',[make('actor'),make('target'),make('nearby')])
 state.distanceFeetByCombatantPair={[dnd5eCombatantPairKey('actor','target')]:15,[dnd5eCombatantPairKey('actor','nearby')]:15,[dnd5eCombatantPairKey('nearby','target')]:5}
 const root={...activity,continuation:{nextActivityId:'splash',maximumSteps:2,excludePreviousTargets:false,maximumDistanceFromPreviousTargetFeet:5,requireAllTargetsInRadius:true}}
 const command={schemaVersion:1 as const,commandId:'cast',actorId:'actor',packageId:'local.splash',packageVersion:'1.0.0',activityId:activity.id,targetIds:['target'],expectedRevision:1,castLevel:4}
 finishDnd5eActivityContinuationV1(state,command,root,{},[])
 const pending=state.activityContinuations!.cast
 expect(dnd5eMandatoryContinuationTargets(state,pending).sort()).toEqual(['nearby','target'])
 expect(state.combatants.actor.classState.activeEffects?.[0].source.spellLevel).toBe(4)
 const next={...activity,id:'splash',requiresContinuationFrom:activity.id}
 expect(prepareDnd5eActivityContinuationV1(state,{...command,commandId:'burst',activityId:'splash',continuationId:'cast'},next,{}).error).toBe('continuation-splash-targets-incomplete')
 expect(prepareDnd5eActivityContinuationV1(state,{...command,commandId:'burst',activityId:'splash',continuationId:'cast',targetIds:['target','nearby']},next,{}).error).toBeUndefined()
})
