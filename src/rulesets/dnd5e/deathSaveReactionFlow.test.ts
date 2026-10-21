import { expect,it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eActivityPackage } from './activities/dnd5eActivityRegistry'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { createDnd5eCombatant,startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { resolveDnd5eDeathSaveReaction,type Dnd5eDeathSaveReactionDecision } from './deathSaveReactionFlow'

const activity:Dnd5eActivityDefinitionV1={schemaVersion:1,id:'recover',name:'Synthetic recovery',activation:{kind:'free'},
  invocation:{kind:'triggered',event:'before-death-save',confirmation:'actor-choice',retention:'single-event'},
  legacySource:{kind:'feature',id:'recover'},target:{kind:'self'},automation:automationCapabilityFromLegacyStatus('full'),
  consumption:[{kind:'resource',resourceId:'uses',amount:{kind:'constant',value:1},consumeOn:'resolve'}],
  outcomes:[{id:'heal',when:{kind:'always'},operations:[{id:'heal',kind:'healing',target:'actor',amount:{kind:'dice',rollId:'heal',count:2,sides:6}}]}]}

it('does not roll victim damage when an optional target selection is empty',async()=>{
  const recipe=structuredClone(activity)
  recipe.target={kind:'creature',relation:'any',count:256,minimumCount:0,rangeFeet:30}
  recipe.outcomes[0].operations=[...recipe.outcomes[0].operations,{id:'burn',kind:'damage',target:'target',damageType:'radiant',amount:{kind:'dice',rollId:'burn',count:2,sides:8}}]
  const registration=registerDnd5eActivityPackage({packageId:'test.empty-flow',packageVersion:'1.0.0',activities:[recipe]})
  try{
    const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
      abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
      currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
    const state=startDnd5eHeadlessCombat('empty',[actor,{...structuredClone(actor),id:'other',controller:'dm',initiative:10}])
    state.combatants.actor.currentHp=0;state.combatants.actor.pluginFeatureIds=['recover']
    state.combatants.actor.classResources.uses={current:1,max:1}
    const rolls:string[]=[]
    const result=await resolveDnd5eDeathSaveReaction({state,actorId:'actor',combatRevision:1,authorityUnchanged:()=>true,
      choose:async()=>({kind:'replace',packageId:'test.empty-flow',activityId:'recover',targetIds:[]}),
      roll:async request=>{rolls.push(request.id);return [3,3]}})
    expect(rolls).toEqual(['heal'])
    expect(result.status).toBe('replaced');if(result.status==='replaced')expect(result.result.ok).toBe(true)
  }finally{registration.dispose()}
})

it.each(['accept','decline','cancel','unowned','spent','stale-choice','stale-roll','changed-definition','choice-error','roll-error','invalid-dice'] as const)(
  'coordinates pre-death-save choice with %s',async mode=>{
    const registration=registerDnd5eActivityPackage({packageId:'test.death-flow',packageVersion:'1.0.0',activities:[activity]})
    let replacement:ReturnType<typeof registerDnd5eActivityPackage>|undefined
    try{
      const actor=createDnd5eCombatant({id:'actor',name:'Actor',controller:'player',initiative:20,
        abilities:{str:10,dex:10,con:10,int:10,wis:10,cha:10},proficiencyBonus:2,armorClass:10,
        currentHp:20,maxHp:20,temporaryHp:0,speed:30,position:{x:0,y:0},concentrating:false})
      const state=startDnd5eHeadlessCombat('flow',[actor,{...structuredClone(actor),id:'other',controller:'dm',initiative:10}])
      state.combatants.actor.currentHp=0
      state.combatants.actor.pluginFeatureIds=mode==='unowned'?[]:['recover']
      state.combatants.actor.classResources.uses={current:mode==='spent'?0:1,max:1}
      const before=structuredClone(state),calls:string[]=[]
      let unchanged=true
      const run=resolveDnd5eDeathSaveReaction({state,actorId:'actor',combatRevision:1,authorityUnchanged:()=>unchanged,
        choose:async request=>{
          calls.push('choose')
          expect(request.candidates).toHaveLength(1)
          request.state.combatants.actor.currentHp=99
          request.candidates[0].activity.name='Caller edit'
          await Promise.resolve()
          if(mode==='stale-choice')unchanged=false
          if(mode==='choice-error')throw Error('choice failed')
          if(mode==='changed-definition'){
            registration.dispose();replacement=registerDnd5eActivityPackage({packageId:'test.death-flow',packageVersion:'1.0.0',activities:[{...activity,name:'Changed'}]})
          }
          if(mode==='decline'||mode==='cancel')return {kind:mode}
          return {kind:'replace',packageId:'test.death-flow',activityId:'recover',targetIds:['actor']} as Dnd5eDeathSaveReactionDecision
        },roll:async request=>{
          calls.push('roll');expect(request.sides).toBe(6);expect(request.count).toBe(2)
          await Promise.resolve()
          if(mode==='stale-roll')unchanged=false
          if(mode==='roll-error')throw Error('roll failed')
          return mode==='invalid-dice'?[99,3]:[3,3]
        }})
      if(['stale-choice','stale-roll','changed-definition','choice-error','roll-error'].includes(mode)){
        await expect(run).rejects.toThrow()
        if(mode==='stale-choice'||mode==='changed-definition'||mode==='choice-error')expect(calls).toEqual(['choose'])
      }else{
        const result=await run
        if(mode==='decline'||mode==='cancel'||mode==='unowned'){
          expect(result.status).toBe(mode==='cancel'?'cancelled':'declined')
          expect(calls).toEqual(mode==='unowned'?[]:['choose'])
        }else{
          expect(result.status).toBe('replaced');if(result.status!=='replaced')throw Error('not replaced')
          expect(result.result.ok).toBe(mode==='accept')
          if(mode==='accept'){
            expect(result.result.state.combatants.actor.currentHp).toBe(6)
            expect(result.result.state.combatants.actor.classResources.uses.current).toBe(0)
            expect(result.result.state.initiativeIndex).toBe(state.initiativeIndex)
            expect(calls).toEqual(['choose','roll'])
          }else expect(result.result.state).toEqual(before)
          expect(result.result.events.some(event=>event.type==='death-save-resolved')).toBe(false)
        }
      }
      expect(state).toEqual(before)
    }finally{replacement?.dispose();registration.dispose()}
  })
