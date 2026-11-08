import{it,expect}from'vitest'
import{installCurrent152}from'./mastermindCurrent152Source.fixture'
import{genuineFailed}from'./mastermindNativeWardHostFailed.fixture'
import{resolveMastermindNativeMonsterWardWaste,readMastermindNativeMonsterBaseInput,completeMastermindNativeMonsterBase}from'./mastermindMisdirectionNativeParent'
import{settleDnd5eConcentrationChecks}from'./settleDnd5eCombatResult'
import{prepareMastermindNativeMonsterPublication,publishMastermindNativeMonster}from'./mastermindMisdirectionNativePublication'
it('real Host NPC failed Ward plus authenticated same-parent waste consumes only the genuine original attack, no invented D20, then actual Base and sole native4',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineFailed();if(f.ward.status!=='blocked')throw Error('Actual failed Ward required');
 await expect(resolveMastermindNativeMonsterWardWaste(JSON.parse(JSON.stringify(f.ward.blocked)))).rejects.toThrow('actual-failed-Ward');
 await expect(resolveMastermindNativeMonsterWardWaste(f.ward.blocked)).rejects.toThrow('actual-authenticated-actor-choice');
 const registered=await f.api.post('mastermind-native-ward-outcome/register',{requestId:f.id,retargetTokenIds:['owner-token']});expect(registered.status).toBe(200);const row=registered.payload.choice;
 await expect(resolveMastermindNativeMonsterWardWaste(f.ward.blocked)).rejects.toThrow('actual-Host-waste');
 expect((await f.api.post('mastermind-native-ward-outcome/answer',{id:row.id,choice:'waste',expectedRecordRevision:1})).status).toBe(200);
 const native=await resolveMastermindNativeMonsterWardWaste(f.ward.blocked);expect(native.result.ok,native.result.ok?'':native.result.reason).toBe(true);if(!native.result.ok||!native.application)throw Error('Actual native waste cost required');
 const input=readMastermindNativeMonsterBaseInput(native);expect(input.events.filter(event=>event.type==='attack-resolved')).toHaveLength(0);expect(input.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1);expect(input.events.filter(event=>event.type==='cover-attack-redirected')).toHaveLength(1);
 expect(input.state.combatants['caster-token'].turn.actionAvailable).toBe(false);expect(input.state.combatants['owner-token'].turn.reactionAvailable).toBe(false);expect(input.state.combatants['cover-token'].currentHp).toBe(f.decision.prepared.state.combatants['cover-token'].currentHp);
 const no=()=>{throw Error('No invented original pool or Base followup')},base=await settleDnd5eConcentrationChecks({result:input,priorState:f.decision.prepared.state,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:f.decision.prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no}),completed=await completeMastermindNativeMonsterBase(native,base),plan=await prepareMastermindNativeMonsterPublication(completed,{...f.gateway,saveResourcesAtomically:f.api.gateway.saveResourcesAtomically});
 expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);await publishMastermindNativeMonster(plan);expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);const[writes,options]=f.api.gateway.saveResourcesAtomically.mock.calls[0];expect(writes.map(write=>write.name).sort()).toEqual(['characters','maps','combat','mastermind-misdirections'].sort());expect(options.readRevisions).toMatchObject({'mastermind-native-ward-originals':4,'mastermind-native-ward-outcomes':2});expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['caster-token'].action.current).toBe(0);expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['owner-token'].reaction.current).toBe(0);for(const name of['player-action-requests','player-action-ack','player-action-processed'])expect(await f.api.read(name)).toBeNull();
 }finally{dispose()}
})
