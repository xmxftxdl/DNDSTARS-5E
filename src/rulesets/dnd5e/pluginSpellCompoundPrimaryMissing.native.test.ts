import{it,expect}from'vitest'
import{actualFiniteSavingSource}from'./testFixtures/bountifulFiniteSaving.scene.fixture'
import{resolvePreparedDnd5ePluginSpellCast}from'./pluginSpellTransaction'
import{createDnd5eNextOriginalD20Session,readDnd5eActualOriginalReadyBoundary}from'./damageCommitSession'
import{readActivityAttackOriginalMissing,withActivityAttackOriginalMissing}from'./activities/activityAttackOriginalMissing'

it('actual learned IceKnife exposes its missing primary attack and non1 ready through genuine Native boundaries',async()=>{
 const f=await actualFiniteSavingSource('ice-knife')
 try{const input={...f.source,now:1000},p=input.prepared,before=structuredClone(input),missing=createDnd5eNextOriginalD20Session(input,resolvePreparedDnd5ePluginSpellCast);try{let actual:ReturnType<typeof readActivityAttackOriginalMissing>;try{withActivityAttackOriginalMissing(()=>missing.run(p.state))}catch(error){actual=readActivityAttackOriginalMissing(error);expect(readActivityAttackOriginalMissing(structuredClone(error))).toBeUndefined()}expect(actual!).toMatchObject({activityId:'ice-knife-cast',actorId:'support-token',targetId:'caster-token',mode:'normal',count:1,sides:20});const source={...input,rolls:{activityRolls:{[actual!.rollId]:{values:[2],modifier:0,total:2}}}},ready=createDnd5eNextOriginalD20Session(source,resolvePreparedDnd5ePluginSpellCast);try{const stage=withActivityAttackOriginalMissing(()=>ready.run(p.state));expect(stage.status).toBe('original-d20-ready');if(stage.status!=='original-d20-ready')throw Error(stage.status);expect(stage.request).toMatchObject({kind:'attack',actorId:'support-token',originalRolls:[2],values:[2]});const facts=readDnd5eActualOriginalReadyBoundary(stage);expect(facts.resolve).toBe(resolvePreparedDnd5ePluginSpellCast);expect(()=>readDnd5eActualOriginalReadyBoundary(structuredClone(stage))).toThrow();expect(input).toEqual(before)}finally{ready.cancel()}}finally{missing.cancel()}}
 finally{f.dispose()}
},180000)
