import { describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { cloneDnd5eHostTransactionInput } from '../hostTransactionClone'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { authorizeDnd5eActivityDmChoicesV1, dnd5eActivityDmChoicesV1, dnd5eActivityDmChoicesAuthorizedV1 } from './dnd5eActivityDmChoices'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { compileDnd5eActivityHeadlessAction } from './dnd5eActivityHeadlessCompiler'
import { dnd5ePluginFeatureActionFromActivityV1 } from './dnd5eActivityFeatureActionAdapter'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'lesser-demon-table', name: 'Lesser demon table', activation: {kind:'action'}, target: {kind:'self'},
  checks: [{id:'table',kind:'random-roll',rollId:'table-roll',count:1,sides:6,scope:'shared'}],
  choices: [{id:'creature',label:'DM 选择恶魔',optionsFrom:'installed-monsters',options:[],monsterFilter:{creatureTypes:['fiend'],subtype:'demon'},
    dmSelection:{afterCheckId:'table',challengeRatingByTotal:[{minimum:1,maximum:2,maximumChallengeRating:1},
      {minimum:3,maximum:4,maximumChallengeRating:0.5},{minimum:5,maximum:6,maximumChallengeRating:0.25}]}}],
  outcomes:[{id:'spawn',when:{kind:'always'},operations:[{id:'spawn',kind:'summon',monsterId:'srd-5.1:dretch',monsterChoiceId:'creature',
    count:{kind:'constant',value:1},timing:'immediate',durationRounds:600,concentration:true,side:'enemy',requiredCreatureSubtype:'demon',autonomousBehavior:'attack-nearest-other-subtype'}]}],
  automation:automationCapabilityFromLegacyStatus('full'),
}
const request=()=>({actorId:'caster',pluginId:'test',actionId:activity.id,transactionId:'cast-1',payload:{activityChoices:{creature:'srd-5.1:dretch'}}})

describe('Host-owned post-roll creature selection',()=>{
  it('rejects forged JSON in the compiled Headless route and accepts only the Host-confirmed choice',()=>{
    const declared={...activity,legacySource:{kind:'feature' as const,id:'root'}}
    const dispose=registerDnd5eRulesPlugin({manifest:{id:'test.dm-choice',name:'Tests',version:'1.0.0',apiVersion:2,rulesetId:'dnd5e-2014-srd-5.1',publisher:'Tests',license:'CC0'},setup(api){
      api.registerHeadlessAction(compileDnd5eActivityHeadlessAction(declared))
      api.registerFeature({id:'root',name:'Root',summary:'Test',description:'Test',automation:'full',action:dnd5ePluginFeatureActionFromActivityV1(declared)})
    }})
    try{
      const actor=createDnd5eCombatant({id:'caster',name:'Caster',controller:'player',initiative:20,
        abilities:{str:10,dex:10,con:10,int:18,wis:10,cha:10},proficiencyBonus:3,armorClass:12,currentHp:40,maxHp:40,
        temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false,pluginFeatureIds:['test.dm-choice:root']})
      const enemy=createDnd5eCombatant({...actor,id:'enemy',name:'Enemy',controller:'dm',initiative:1,pluginFeatureIds:[]})
      const state=startDnd5eHeadlessCombat('dm-choice',[actor,enemy])
      const action={...request(),type:'plugin' as const,pluginId:'test.dm-choice',featureId:'test.dm-choice:root',
        targetId:'caster',targetIds:['caster'],rolls:{'table-roll':{values:[5],modifier:0,total:5}}}
      const rejected=resolveDnd5eHeadlessAction(state,action)
      expect(rejected).toMatchObject({ok:false,reason:'invalid-plugin-action'})
      expect(rejected.state.combatants.caster.turn.actionAvailable).toBe(true)
      authorizeDnd5eActivityDmChoicesV1(action,declared,action.rolls)
      const accepted=resolveDnd5eHeadlessAction(state,action)
      expect(accepted.ok,JSON.stringify(accepted)).toBe(true)
      if(accepted.ok)expect(accepted.activityHandoffs?.summons[0]).toMatchObject({monsterId:'srd-5.1:dretch',autonomousBehavior:'attack-nearest-other-subtype'})
      expect(resolveDnd5eHeadlessAction(state,JSON.parse(JSON.stringify(action))).ok).toBe(false)
    }finally{dispose()}
  })

  it.each([1,2,3,4,5,6])('filters the installed catalogue from actual d6=%s',face=>{
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const choices=dnd5eActivityDmChoicesV1(activity,{'table-roll':{values:[face]}})
    expect(choices[0].options.map(o=>o.id)).toContain('srd-5.1:dretch')
    expect(choices[0].options.map(o=>o.id)).not.toContain('srd-5.1:vrock')
    expect(choices[0].options.map(o=>o.id).includes('srd-5.1:quasit')).toBe(face<=2)
  })
  it('requires the DM capability and binds it to the actual transaction, choice and die',()=>{
    const action=request(),rolls={'table-roll':{values:[5]}}
    expect(dnd5eActivityDmChoicesAuthorizedV1(action,activity,rolls)).toBe(false)
    authorizeDnd5eActivityDmChoicesV1(action,activity,rolls)
    expect(dnd5eActivityDmChoicesAuthorizedV1(action,activity,rolls)).toBe(true)
    expect(dnd5eActivityDmChoicesAuthorizedV1(cloneDnd5eHostTransactionInput(action),activity,rolls)).toBe(true)
    expect(dnd5eActivityDmChoicesAuthorizedV1(JSON.parse(JSON.stringify(action)),activity,rolls)).toBe(false)
    expect(dnd5eActivityDmChoicesAuthorizedV1({...action,transactionId:'cast-2'},activity,rolls)).toBe(false)
    expect(dnd5eActivityDmChoicesAuthorizedV1(action,activity,{'table-roll':{values:[1]}})).toBe(false)
    action.payload.activityChoices.creature='srd-5.1:quasit'
    expect(dnd5eActivityDmChoicesAuthorizedV1(action,activity,rolls)).toBe(false)
    expect(()=>authorizeDnd5eActivityDmChoicesV1(action,activity,rolls)).toThrow('Invalid DM creature choice')
  })
  it.each([0,7,1.5])('rejects an invalid die face %s before asking the DM',face=>{
    expect(()=>dnd5eActivityDmChoicesV1(activity,{'table-roll':{values:[face]}})).toThrow()
  })
  it('rejects missing or overlapping roll bands',()=>{
    const altered=structuredClone(activity)
    altered.choices![0].dmSelection!.challengeRatingByTotal[1].minimum=2
    expect(validateDnd5eActivityDefinitionV1(altered).some(e=>e.includes('roll band'))).toBe(true)
    expect(()=>dnd5eActivityDmChoicesV1(altered,{'table-roll':{values:[2]}})).toThrow('Ambiguous')
  })
})
