import {it,expect} from 'vitest'
import {actualFiniteSavingHalfSource} from './testFixtures/iceKnifeActualHalf.scene.fixture'
import {createDnd5ePluginSpellCompoundPrimaryAnsweredCollector,readDnd5ePluginSpellCompoundPrimaryAnsweredReady} from './pluginSpellCompoundPrimaryAnswered'
it('genuinely initial Half Wizard1 IceKnife B decline exposes its own Native choice and completes original1 to effective17 with the real D10',async()=>{
 const f=await actualFiniteSavingHalfSource('ice-knife')
 try{
  const p=f.source.prepared,rollId=p.activity!.checks![0].rollId+':caster-token',source={prepared:p,currentCombatState:undefined,currentRoom:f.source.currentRoom,rolls:{activityRolls:{[rollId]:{values:[1],modifier:0,total:1}}},now:1000},before=structuredClone(source),worker=createDnd5ePluginSpellCompoundPrimaryAnsweredCollector(source)
  try{
   expect(p.actor.dnd5eRaceId).toBe('halfling');expect(p.state.combatants[p.actorToken.id].racialRules?.halflingLucky).toBe(true)
   const first=worker.run();expect(first.status).toBe('pending-ally-natural-one');if(first.status!=='pending-ally-natural-one')throw Error(first.status)
   expect(first.request.nativeLucky).toBeUndefined();expect(first.request.options.some(row=>row.ownerId==='helper-token')).toBe(true)
   const own=worker.answer(first,undefined);expect(own.status).toBe('pending-ally-natural-one');if(own.status!=='pending-ally-natural-one')throw Error(own.status)
   expect(own.occurrence).toBe(1);expect(own.request.nativeLucky).toBe(true);expect(own.request.options).toHaveLength(1);expect(own.request.options[0].ownerId).toBe(p.actorToken.id)
   const missing=worker.answer(own,own.request.options[0],17);expect(missing.status).toBe('missing-primary-effect-original');if(missing.status!=='missing-primary-effect-original')throw Error(missing.status)
   expect(missing.request.rolls).toEqual([{rollId:'piercing-damage',count:1,sides:10,modifier:0}])
   const final=worker.supplyEffect(missing,'piercing-damage',[2]);expect(final.status).toBe('original-d20-ready');if(final.status!=='original-d20-ready')throw Error(final.status)
   const cap=worker.ready(final),actual=readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap)
   expect(actual.facts.map(row=>[row.occurrence,row.request.nativeLucky??false])).toEqual([[0,false],[1,true]])
   expect(actual.ready.originalRolls).toEqual([1]);expect(actual.ready.values).toEqual([17]);expect(actual.source.rolls.activityRolls?.[rollId]?.values).toEqual([1]);expect(actual.source.rolls.activityRolls?.['piercing-damage']?.values).toEqual([2]);expect(actual.primary.result.ok).toBe(true);expect(source).toEqual(before)
   worker.close();expect(()=>readDnd5ePluginSpellCompoundPrimaryAnsweredReady(cap)).toThrow('current-source-required')
  }finally{worker.close()}
 }finally{f.dispose()}
},60000)
