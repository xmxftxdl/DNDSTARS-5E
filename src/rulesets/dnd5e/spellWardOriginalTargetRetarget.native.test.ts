import{it,expect}from'vitest'
import{buildActivityCumulativeScene}from'./testFixtures/bountifulActivityCumulative.scene.fixture'
import{genuineSpellFormalWard}from'../../pages/maps/mastermindSpellFormalWardWorld.fixture'
import{captureDnd5ePreparedSpellAttackWindow,readCapturedDnd5ePreparedSpellAttackWindow,resolvePreparedDnd5eSpellCast,readDnd5eActualSpellFacadeResult}from'./spellAction'
import{dnd5eAttackAttemptWardRequirements}from'./headlessCombatEngine'
import{createDnd5eParentEffectClock}from'./activeEffects'
import{prepareDnd5eSpellWardOriginalTargetRetarget,withDnd5eSpellWardOriginalTargetRetarget,readDnd5eSpellWardOriginalTargetRetargetState,assertDnd5eSpellWardOriginalTargetRetargetCurrent}from'./spellWardOriginalTargetRetarget'
it('actual failed redirected spell Ward can continue the same attack at its already prepared original target without reusing the owner reaction',async()=>{
 const joint=await buildActivityCumulativeScene();try{
 const f=await genuineSpellFormalWard(),clock=12345,ward=captureDnd5ePreparedSpellAttackWindow({prepared:f.prepared,attackIndex:0,preceding:[],stage:'ward',currentChoices:{coverAttackRedirect:f.use},now:clock}),view=readCapturedDnd5ePreparedSpellAttackWindow(ward),effect=dnd5eAttackAttemptWardRequirements(view.state,'mage-token','second-owner-token')[0].effect,saving={effectId:effect.id,d20:1},choices={coverAttackRedirect:f.use,attackAttemptWardSaves:[saving]},failed=captureDnd5ePreparedSpellAttackWindow({prepared:f.prepared,attackIndex:0,preceding:[],stage:'ward-result',currentChoices:choices,now:clock})
 expect(readCapturedDnd5ePreparedSpellAttackWindow(failed).wardAllowed).toBe(false)
 const targetAttacks=[{targetId:'second-owner-token',...choices,d20:18,effectRolls:[1,1]},{targetId:'owner-token',d20:18,effectRolls:[1,1]},{targetId:'owner-token',d20:18,effectRolls:[1,1]}],input={prepared:f.prepared,transactionId:f.action.id,targetAttacks,effectRolls:[]},run=()=>resolvePreparedDnd5eSpellCast(input,{transactionId:f.action.id,now:clock}),plain=run();expect(plain.result.ok).toBe(false)
 const retarget=await prepareDnd5eSpellWardOriginalTargetRetarget(failed),scope=createDnd5eParentEffectClock({parentId:f.action.id,sourceKey:'same-actual-spell-retarget',timestamp:clock})
 await expect(prepareDnd5eSpellWardOriginalTargetRetarget(JSON.parse(JSON.stringify(failed)))).rejects.toThrow('actual-issued-window')
 await expect(prepareDnd5eSpellWardOriginalTargetRetarget(ward)).rejects.toThrow('actual-failed-redirected-window')
 expect(()=>assertDnd5eSpellWardOriginalTargetRetargetCurrent(JSON.parse(JSON.stringify(retarget)))).toThrow('actual-failed-original');expect(()=>withDnd5eSpellWardOriginalTargetRetarget([JSON.parse(JSON.stringify(retarget))],run)).toThrow('actual-failed-original')
 expect(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],run)).toThrow('exact-current-failed-prefix')
 expect(()=>scope.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],()=>1))).toThrow('unvisited-original')
 const raw=scope.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],()=>captureDnd5ePreparedSpellAttackWindow({prepared:f.prepared,attackIndex:0,preceding:[],stage:'raw',currentChoices:choices,now:clock})))
 expect(readCapturedDnd5ePreparedSpellAttackWindow(raw).raw?.targetId).toBe('owner-token')
 const actual=scope.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],run));expect(actual.result.ok).toBe(true);if(!actual.result.ok)throw Error(actual.result.reason)
 expect(()=>readDnd5eActualSpellFacadeResult(f.prepared,actual)).not.toThrow()
 expect(readDnd5eSpellWardOriginalTargetRetargetState(actual.result.state)).toEqual([retarget])
 expect(()=>readDnd5eSpellWardOriginalTargetRetargetState(structuredClone(actual.result.state))).toThrow('actual-native-consumption')
 expect(actual.result.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1)
 expect(actual.result.events.filter(event=>event.type==='attack-resolved')).toHaveLength(3)
 expect(actual.result.state.combatants['owner-token'].turn.reactionAvailable).toBe(false)
 expect(actual.result.state.combatants['mage-token'].turn.actionAvailable).toBe(false)
 expect(actual.result.state.combatants['second-owner-token'].currentHp).toBe(f.prepared.state.combatants['second-owner-token'].currentHp)
 expect(actual.result.state.combatants['owner-token'].currentHp).toBe(f.prepared.state.combatants['owner-token'].currentHp-6)
 const wrong=createDnd5eParentEffectClock({parentId:f.action.id,sourceKey:'wrong-clock',timestamp:clock+1});expect(()=>wrong.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],run))).toThrow('exact-current-failed-prefix')
 expect(()=>scope.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],()=>resolvePreparedDnd5eSpellCast({...input,targetAttacks:[{...targetAttacks[0],attackAttemptWardSaves:[{...saving,d20:20}]},...targetAttacks.slice(1)]},{transactionId:f.action.id,now:clock})))).toThrow('unvisited-original')
 expect(()=>scope.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget,retarget],run))).toThrow('unique-sync-scope')
 const hp=f.prepared.state.combatants['mage-token'].currentHp;f.prepared.state.combatants['mage-token'].currentHp=hp-1
 try{expect(()=>assertDnd5eSpellWardOriginalTargetRetargetCurrent(retarget)).toThrow('actual-issued-window');expect(()=>scope.run(()=>withDnd5eSpellWardOriginalTargetRetarget([retarget],run))).toThrow('actual-issued-window')}finally{f.prepared.state.combatants['mage-token'].currentHp=hp}
 }finally{joint.dispose()}
})
