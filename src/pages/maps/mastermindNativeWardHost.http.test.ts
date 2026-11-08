import{it,expect}from'vitest'
import{installCurrent152}from'./mastermindCurrent152Source.fixture'
import{genuineHostWardWorld}from'./mastermindNativeWardHost.fixture'
import{settleMastermindNativeMonsterWard,resolveMastermindNativeMonsterDecision,readMastermindNativeMonsterBaseInput,completeMastermindNativeMonsterBase,prepareMastermindNativeMonsterOriginal,readMastermindNativeMonsterDecision}from'./mastermindMisdirectionNativeParent'
import{settleDnd5eConcentrationChecks}from'./settleDnd5eCombatResult'
import{prepareMastermindNativeMonsterPublication,publishMastermindNativeMonster}from'./mastermindMisdirectionNativePublication'
async function pool(f:Awaited<ReturnType<typeof genuineHostWardWorld>>,face:number){const registered=await f.api.post('mastermind-native-ward-original/register',{parentId:f.prompt.id,wardEffectId:f.requirements[0].effect.id,mode:f.requirements[0].mode});expect(registered.status,JSON.stringify(registered.payload)).toBe(200);const id=registered.payload.request.id;expect((await f.api.post('mastermind-native-ward-original/raw',{requestId:id,rollerTokenId:'caster-token',values:[16]})).status).toBe(200);expect((await f.api.post('mastermind-native-ward-original/confirm',{requestId:id,rollerTokenId:'caster-token',values:[face]})).status).toBe(200);expect((await f.api.post('mastermind-native-ward-original/complete',{requestId:id})).status).toBe(200);return id}
it('true Host NPC Ward private pool -> actual saving Native -> actual attack -> genuine Base -> sole original native4 with exact private read guard; no PC queue or early world write',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineHostWardWorld();await pool(f,20);
 await expect(settleMastermindNativeMonsterWard(JSON.parse(JSON.stringify(f.decision)))).rejects.toThrow('actual-native-decision');
 const ward=await settleMastermindNativeMonsterWard(f.decision);expect(ward.status).toBe('continue');if(ward.status!=='continue')throw Error('true passing Ward required');
 const native=await resolveMastermindNativeMonsterDecision(ward.decision,[{d20:19,damageRolls:ward.decision.prepared.attacks[0].attack.damage.map(damage=>Array(damage.count).fill(1))}]);
 expect(native.result.ok,native.result.ok?'':native.result.reason).toBe(true);if(!native.result.ok||!native.application)throw Error('Native result required');
 const input=readMastermindNativeMonsterBaseInput(native);expect(input.events.filter(event=>event.type==='saving-throw-resolved')).toHaveLength(1);expect(input.events.filter(event=>event.type==='cover-attack-redirected')).toHaveLength(1);
 const no=()=>{throw Error('No additional Base pool required')},base=await settleDnd5eConcentrationChecks({result:input,priorState:f.decision.prepared.state,map:native.application.map,characters:native.application.characters,priorApplication:native.application,characterIdByCombatantId:f.decision.prepared.characterIdByCombatantId,rollD20:no,rollD4:no,rollDice:no});
 const completed=await completeMastermindNativeMonsterBase(native,base),gateway={...f.gateway,saveResourcesAtomically:f.api.gateway.saveResourcesAtomically},plan=await prepareMastermindNativeMonsterPublication(completed,gateway);
 expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);
 await publishMastermindNativeMonster(plan);expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
 const[writes,options]=f.api.gateway.saveResourcesAtomically.mock.calls[0];expect(writes.map(write=>write.name).sort()).toEqual(['characters','maps','combat','mastermind-misdirections'].sort());expect(options.readRevisions['mastermind-native-ward-originals']).toBe((await f.api.read('mastermind-native-ward-originals'))._sync.revision);
 expect((await f.api.read('mastermind-misdirections')).parents[f.prompt.id].phase).toBe('consumed');for(const name of['player-action-requests','player-action-ack','player-action-processed'])expect(await f.api.read(name)).toBeNull();
 expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['caster-token'].action.current).toBe(0);expect((await f.api.read('combat')).dnd5eTurnEconomyByToken['owner-token'].reaction.current).toBe(0);
 await publishMastermindNativeMonster(plan);expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
 }finally{dispose()}
})
it('a failed real Host NPC Ward issues no completed Base/publication and cannot be replaced with arbitrary saving values or JSON',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineHostWardWorld();await expect(settleMastermindNativeMonsterWard(f.decision)).rejects.toThrow('actual-completed-pool');await pool(f,1);
 const ward=await settleMastermindNativeMonsterWard(f.decision);expect(ward.status).toBe('blocked');if(ward.status!=='blocked')throw Error('Real failed Ward required');
 await expect(completeMastermindNativeMonsterBase(ward.blocked,{} as never)).rejects.toThrow('terminal-actor-outcome');
 await expect(prepareMastermindNativeMonsterPublication(ward.blocked,{...f.gateway,saveResourcesAtomically:f.api.gateway.saveResourcesAtomically})).rejects.toThrow('actual-completed-Base');
 expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);
 }finally{dispose()}
})
it('a new true native issuer recovers the same completed Host Ward pool read-only; nested mutation of the issued continuation is rejected before any original attack or world write',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineHostWardWorld();await pool(f,20);const book=await f.api.read('mastermind-native-ward-originals'),cap=await prepareMastermindNativeMonsterOriginal({parentTransactionId:'actual-host-npc-formal-majesty-before-original',mapId:f.map.id,actorTokenId:'caster-token',targetTokenId:'owner-token',actionIndex:f.args.actionIndex},f.gateway),fresh=await readMastermindNativeMonsterDecision(cap!,f.gateway);
 expect(fresh).toBeDefined();expect(fresh).not.toBe(f.decision);
 const ward=await settleMastermindNativeMonsterWard(fresh!);expect(ward.status).toBe('continue');if(ward.status!=='continue')throw Error('Recovered actual Ward required');
 expect(await f.api.read('mastermind-native-ward-originals')).toEqual(book);
 ward.decision.prepared.state.combatants['cover-token'].currentHp--;
 await expect(resolveMastermindNativeMonsterDecision(ward.decision,[{d20:19,damageRolls:ward.decision.prepared.attacks[0].attack.damage.map(damage=>Array(damage.count).fill(1))}])).rejects.toThrow('unchanged-issued-prefix');
 expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);expect(await f.api.read('mastermind-native-ward-originals')).toEqual(book);
 }finally{dispose()}
})
