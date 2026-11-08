import{it,expect}from'vitest';
import{installCurrent152}from'./mastermindCurrent152Source.fixture';
import{genuineSpellSuccessorRoom}from'./mastermindSpellSuccessorRoom.fixture';
import{beginMastermindSpellWindowCollector,collectMastermindSpellWindowTarget}from'./mastermindSpellWindowCollector';
for(const nativeOrigin of[false,true])it('actual Page spell collector waits for each same-window canonical owner before its first raw '+(nativeOrigin?'native':'queued'),async()=>{
 const dispose=await installCurrent152();try{
  const f=await genuineSpellSuccessorRoom(nativeOrigin),{api,g}=f,names=['characters','maps','combat','player-action-requests','player-action-processed','player-action-ack'],before=await Promise.all(names.map(api.read));
  const collector=await beginMastermindSpellWindowCollector(nativeOrigin?{parentTransactionId:f.action.id,mapId:f.map.id,actorTokenId:'mage-token',spellCast:f.action.dnd5eSpellCast}:{actionId:f.action.id},g);
  let waits=0;
  const target=await collectMastermindSpellWindowTarget(collector,0,async()=>{
   waits++;expect(waits).toBeLessThanOrEqual(2);const member=waits===1?'player':'dm',listed=await api.post('mastermind-misdirection/list',{},member);expect(listed.status).toBe(200);
   const pending=listed.payload.parents.filter((p:any)=>p.phase==='waiting'&&p.canAnswer);expect(pending).toHaveLength(1);const row=pending[0];expect(row.ownerTokenId).toBe(waits===1?'owner-token':'second-owner-token');
   expect((await api.post('mastermind-misdirection/answer',{id:row.id,expectedRecordRevision:row.revision,choice:waits===1?'second-owner-token':'final-cover-token'},member)).status).toBe(200);
   const source=await api.post('mastermind-spell-window/source',{parentId:f.parentId},'dm');expect(source.status).toBe(200);expect(source.payload.parent.windows[0].requests).toEqual([]);expect(await Promise.all(names.map(api.read))).toEqual(before);expect(api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
  });
  expect(waits).toBe(2);expect(target.view.raw?.targetId).toBe('final-cover-token');expect(target.coverAttackRedirect?.next?.replacementTargetId).toBe('final-cover-token');
 }finally{dispose()}
});
