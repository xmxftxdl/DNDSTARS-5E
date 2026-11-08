import{it,expect}from'vitest';
import{installCurrent152}from'./mastermindCurrent152Source.fixture';
import{genuineDirectSuccessorPendingWorld}from'./mastermindNativeDirectSuccessor.after.fixture';
import{prepareMastermindNativeDirectOwnerResume,readMastermindNativeDirectOwnerResume}from'./mastermindNativeDirectOwnerResume';
import{readMastermindNativeDirectOwnerOriginal}from'./mastermindMisdirectionNativeParent';
it('answered cold continuation rejects copied capability, wrong parent and actual intervening canonical world write',async()=>{
 const dispose=await installCurrent152();try{
  const f=await genuineDirectSuccessorPendingWorld(),command=await prepareMastermindNativeDirectOwnerResume(f.prompt.id,f.gateway),actual=await readMastermindNativeDirectOwnerResume(command,f.gateway);expect(actual).toBeDefined();if(!actual)throw Error('Issued original required');
  await expect(readMastermindNativeDirectOwnerOriginal({...actual.original},f.prompt.id,f.gateway)).rejects.toThrow('issued-pending-original-required');
  await expect(readMastermindNativeDirectOwnerOriginal(actual.original,f.child.id,f.gateway)).rejects.toThrow('issued-pending-original-required');
  expect((await f.api.post('mastermind-misdirection/answer',{id:f.child.id,expectedRecordRevision:1,choice:'second-cover-token'},'reader')).status).toBe(200);
  const combat=await f.api.read('combat');await f.api.gateway.saveResourcesAtomically([{name:'combat',expectedRevision:combat._sync.revision,data:{...combat,round:combat.round+1}}],{transactionId:'actual-other-combat-turn',readRevisions:{}});
  const saved=await f.api.read('combat');expect(saved.round).toBe(combat.round+1);
  await expect(readMastermindNativeDirectOwnerResume(command,f.gateway)).rejects.toThrow();
  expect(f.api.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1);
  expect((await f.api.read('mastermind-misdirections')).parents[f.prompt.id].phase).toBe('answered');
 }finally{dispose()}
});
it('answered cold continuation retains actual installed source lifecycle and Host controller requirements',async()=>{
 const dispose=await installCurrent152();let disposed=false;try{
  const f=await genuineDirectSuccessorPendingWorld(),command=await prepareMastermindNativeDirectOwnerResume(f.prompt.id,f.gateway);
  expect((await f.api.post('mastermind-misdirection/answer',{id:f.child.id,expectedRecordRevision:1,choice:'second-cover-token'},'reader')).status).toBe(200);
  await expect(readMastermindNativeDirectOwnerResume(command,{...f.gateway,session:()=>({...f.gateway.session(),role:'player'})})).rejects.toThrow('host-required');
  dispose();disposed=true;await expect(readMastermindNativeDirectOwnerResume(command,f.gateway)).rejects.toThrow();expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
 }finally{if(!disposed)dispose()}
});
