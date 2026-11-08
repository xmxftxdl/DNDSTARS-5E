import{it,expect}from'vitest'
import{installCurrent152}from'./mastermindCurrent152Source.fixture'
import{genuineHostWardWorld}from'./mastermindNativeWardSuccessorOwner.fixture'
import{settleMastermindNativeMonsterWard}from'./mastermindMisdirectionNativeParent'
it('authenticated same-parent retarget can append only its actual new owner decision without rewriting the original row or granting any world result',async()=>{
 const dispose=await installCurrent152();try{const f=await genuineHostWardWorld(),root=(await f.api.read('mastermind-misdirections')).parents[f.prompt.id];
 const registered=await f.api.post('mastermind-native-ward-original/register',{parentId:f.prompt.id,wardEffectId:f.requirements[0].effect.id,mode:f.requirements[0].mode});expect(registered.status).toBe(200);const requestId=registered.payload.request.id;
 for(const[phase,values]of[['raw',[16]],['confirm',[1]]]as const)expect((await f.api.post('mastermind-native-ward-original/'+phase,{requestId,rollerTokenId:'caster-token',values})).status).toBe(200);
 expect((await f.api.post('mastermind-native-ward-original/complete',{requestId})).status).toBe(200);expect((await settleMastermindNativeMonsterWard(f.decision)).status).toBe('blocked');
 // This records only the genuine Host's target decision; it grants neither a
 // successful Ward nor a Native source/result. Those remain opaque consumers.
 const actor=await f.api.post('mastermind-native-ward-outcome/register',{requestId,retargetTokenIds:['second-owner-token']});expect(actor.status).toBe(200);const outcome=actor.payload.choice;
 const child={id:'mastermind-misdirection:actual-second-owner-after-ward',parentTransactionId:root.parentTransactionId,mapId:root.mapId,attackerTokenId:root.attackerTokenId,ownerTokenId:'second-owner-token',ownerCharacterId:'second-owner',featureId:root.featureId,replacementTokenIds:['second-cover-token'],sourceDefinitionSignature:root.sourceDefinitionSignature,versions:root.versions,nativeOriginal:root.nativeOriginal,wardRetargetOriginal:{schemaVersion:1,rootParentId:root.id,requestId,outcomeId:outcome.id}};
 expect((await f.api.post('mastermind-misdirection/begin-native',child)).status).toBe(409);
 expect((await f.api.post('mastermind-native-ward-outcome/answer',{id:outcome.id,expectedRecordRevision:outcome.revision,choice:'retarget',targetTokenId:'second-owner-token'},'player')).status).toBe(403);
 expect((await f.api.post('mastermind-native-ward-outcome/answer',{id:outcome.id,expectedRecordRevision:outcome.revision,choice:'retarget',targetTokenId:'second-owner-token'})).status).toBe(200);
 for(const forged of[{...child,wardRetargetOriginal:{...child.wardRetargetOriginal,rootParentId:'missing-root'}},{...child,ownerTokenId:'second-cover-token',ownerCharacterId:'second-cover'},{...child,versions:{...child.versions,combat:root.versions.combat+1}}])expect((await f.api.post('mastermind-misdirection/begin-native',forged)).status).toBe(409);
 const issued=await f.api.post('mastermind-misdirection/begin-native',child);expect(issued.status,JSON.stringify(issued.payload)).toBe(200);
 const journal=await f.api.read('mastermind-misdirections');expect(journal.parents[root.id]).toEqual(root);expect(journal.parents[child.id].phase).toBe('waiting');
 expect((await f.api.post('mastermind-misdirection/answer',{id:child.id,expectedRecordRevision:1,choice:'second-cover-token'})).status).toBe(403);
 expect((await f.api.post('mastermind-misdirection/answer',{id:child.id,expectedRecordRevision:1,choice:'second-cover-token'},'reader')).status).toBe(200);
 expect((await f.api.read('mastermind-misdirections')).parents[root.id]).toEqual(root);
 expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);
 }finally{dispose()}
})
