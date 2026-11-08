import {it,expect} from 'vitest'
import {actualFiniteSavingSource} from './testFixtures/bountifulFiniteSaving.scene.fixture'
import {createDnd5ePluginSpellCompoundPrimaryAnsweredCollector,readDnd5ePluginSpellCompoundPrimaryAnsweredReady,readDnd5ePluginSpellCompoundPrimaryAnsweredPending} from './pluginSpellCompoundPrimaryAnswered'

for(const answer of ['decline','use'] as const)it('actual learned IceKnife primary Nat1 '+answer+' reaches genuine answered ready without caller replay or invented damage',async()=>{
 const f=await actualFiniteSavingSource('ice-knife')
 try{
  const p=f.source.prepared,rollId=p.activity!.checks![0].rollId+':caster-token',source={prepared:p,currentCombatState:undefined,currentRoom:f.source.currentRoom,rolls:{activityRolls:{[rollId]:{values:[1],modifier:0,total:1}}},now:1000},before=structuredClone(source),worker=createDnd5ePluginSpellCompoundPrimaryAnsweredCollector(source)
  try{
   const first=worker.run();expect(first.status).toBe('pending-ally-natural-one');if(first.status!=='pending-ally-natural-one')throw Error(first.status)
   expect(first.request).toMatchObject({actorId:'support-token',kind:'attack',originalRolls:[1],dieIndex:0});expect(first.request.nativeLucky).toBeUndefined();const live=worker.pending(first),pending=readDnd5ePluginSpellCompoundPrimaryAnsweredPending(live);expect(pending.actualPending).toBe(first);expect(pending.source.rolls?.activityRolls?.[rollId]?.values).toEqual([1]);expect(pending.effectTimestamp).toBe(1000);expect(()=>readDnd5ePluginSpellCompoundPrimaryAnsweredPending(structuredClone(live))).toThrow('actual-pending-cap-required')
   expect(()=>worker.answer(structuredClone(first),undefined)).toThrow('actual-current-stage-required')
   const option=first.request.options.find(row=>row.ownerId==='helper-token');expect(option).toBeDefined()
   if(!option)throw Error('Actual B helper required')
   expect(()=>worker.answer(first,{...option},17)).toThrow('actual-option-scalar-required')
   let next=worker.answer(first,answer==='use'?option:undefined,answer==='use'?17:undefined)
   expect(()=>readDnd5ePluginSpellCompoundPrimaryAnsweredPending(live)).toThrow('actual-current-stage-required')
   if(answer==='use'){
    expect(next.status).toBe('missing-primary-effect-original');if(next.status!=='missing-primary-effect-original')throw Error(next.status)
    expect(next.request.rolls).toEqual([{rollId:'piercing-damage',count:1,sides:10,modifier:0}])
    expect(()=>worker.supplyEffect(structuredClone(next as Parameters<typeof worker.supplyEffect>[0]),'piercing-damage',[2])).toThrow('actual-current-stage-required')
    expect(()=>worker.supplyEffect(next as Parameters<typeof worker.supplyEffect>[0],'piercing-damage',[11])).toThrow('actual-formula-values-required')
    next=worker.supplyEffect(next,'piercing-damage',[2])
   }
   expect(next.status).toBe('original-d20-ready');if(next.status!=='original-d20-ready')throw Error(next.status)
   const cap=worker.ready(next),read=readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap)
   expect(read.parentId).toBe(p.action.id);expect(read.effectTimestamp).toBe(1000);expect(read.actorId).toBe('support-token');expect(read.targetId).toBe('caster-token')
   expect(read.primary.result.ok).toBe(true);if(read.primary.result.ok){expect(read.primary.result.state.combatants['caster-token'].currentHp).toBe(p.state.combatants['caster-token'].currentHp-(answer==='use'?2:0));expect(read.primary.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(answer==='decline')}
   expect(read.ready.originalRolls).toEqual([1]);expect(read.ready.values).toEqual([answer==='use'?17:1]);expect(read.facts).toHaveLength(1)
   expect(read.facts[0]).toMatchObject({occurrence:0,request:{originalRolls:[1],dieIndex:0}})
   expect(read.source.rolls?.activityRolls?.[rollId]?.values).toEqual([1])
   if(answer==='use')expect(read.source.rolls?.activityRolls?.['piercing-damage']).toEqual({values:[2],modifier:0,total:2})
   else expect(read.source.rolls?.activityRolls?.['piercing-damage']).toBeUndefined()
   expect('hostOriginalD20Replay'in read.source).toBe(false);expect(source).toEqual(before)
   expect(()=>readDnd5ePluginSpellCompoundPrimaryAnsweredReady(structuredClone(cap))).toThrow('actual-ready-cap-required')
   worker.close();expect(()=>readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap)).toThrow('current-source-required')
  }finally{worker.close()}
 }finally{f.dispose()}
},60000)
