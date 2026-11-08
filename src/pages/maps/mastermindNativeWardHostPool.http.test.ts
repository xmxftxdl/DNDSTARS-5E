import{it,expect}from'vitest'
import{installCurrent152}from'./mastermindCurrent152Source.fixture'
import{genuineHostWardWorld}from'./mastermindNativeWardHost.fixture'
const route='mastermind-native-ward-original/'
it('only the real current Host NPC parent can register its physical Ward pool; raw precedes immutable independent adoption and completion without any world or PC queue write',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineHostWardWorld(),input={parentId:f.prompt.id,wardEffectId:f.requirements[0].effect.id,mode:f.requirements[0].mode};
 expect((await f.api.post(route+'register',input,'player')).status).toBe(403);
 expect(await f.api.read('mastermind-native-ward-originals')).toBeNull();
 const issued=await f.api.post(route+'register',input);expect(issued.status,JSON.stringify(issued.payload)).toBe(200);
 const request=issued.payload.request;expect(request.actorTokenId).toBe('caster-token');expect(request.actorCharacterId).toBeUndefined();expect(request.sides).toBe(20);expect(request.count).toBe(1);
 expect((await f.api.post(route+'confirm',{requestId:request.id,rollerTokenId:'caster-token',values:[20]})).status).toBe(409);
 expect((await f.api.post(route+'raw',{requestId:request.id,rollerTokenId:'caster-token',values:[16]},'player')).status).toBe(403);
 expect((await f.api.post(route+'raw',{requestId:request.id,rollerTokenId:'caster-token',values:[16]})).status).toBe(200);
 expect((await f.api.post(route+'raw',{requestId:request.id,rollerTokenId:'caster-token',values:[15]})).status).toBe(409);
 expect((await f.api.post(route+'complete',{requestId:request.id})).status).toBe(409);
 expect((await f.api.post(route+'confirm',{requestId:request.id,rollerTokenId:'caster-token',values:[20]})).status).toBe(200);
 expect((await f.api.post(route+'confirm',{requestId:request.id,rollerTokenId:'caster-token',values:[19]})).status).toBe(409);
 const done=await f.api.post(route+'complete',{requestId:request.id});expect(done.status).toBe(200);expect(done.payload.request.complete).toBe(true);
 const book=await f.api.read('mastermind-native-ward-originals'),row=book.requests[request.id];expect(row.raw.values).toEqual([16]);expect(row.confirmed.values).toEqual([20]);expect(row.raw.memberId).toBe('dm');expect(row.confirmed.memberId).toBe('dm');
 expect(row.actorCharacterId).toBeUndefined();expect(row.versions).toEqual((await f.api.read('mastermind-misdirections')).parents[f.prompt.id].versions);
 expect((await f.api.post(route+'register',input)).status).toBe(200);expect(await f.api.read('mastermind-native-ward-originals')).toEqual(book);
 expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);
 }finally{dispose()}
})
it('closed native Ward registration rejects copied source, caller state/result/DC, wrong target or parent and generic journal replacement with zero private or world writes',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineHostWardWorld(),input={parentId:f.prompt.id,wardEffectId:f.requirements[0].effect.id,mode:f.requirements[0].mode};
 for(const extra of[{state:f.prepared.state},{result:{}},{dc:1},{prepared:f.prepared},{actorCharacterId:'form-caster'},{wardTargetTokenId:'owner-token'}])expect((await f.api.post(route+'register',{...input,...extra})).status).toBe(400);
 expect((await f.api.post(route+'register',{...input,parentId:'mastermind-misdirection:unissued-parent'})).status).toBe(409);
 expect((await f.api.post(route+'register',{...input,wardEffectId:'not-the-issued-ward'})).status).toBe(409);
 expect(await f.api.read('mastermind-native-ward-originals')).toBeNull();
 const issued=await f.api.post(route+'register',input);expect(issued.status).toBe(200);
 const book=await f.api.read('mastermind-native-ward-originals'),forged=structuredClone(book);forged.requests[issued.payload.request.id].issuedAt++;
 expect((await f.api.post('transaction',{transactionId:'forged-native-ward-private-pool',writes:[{name:'mastermind-native-ward-originals',expectedRevision:book._sync.revision,data:forged}],readRevisions:{}})).status).toBe(409);
 expect(await f.api.read('mastermind-native-ward-originals')).toEqual(book);
 expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);
 }finally{dispose()}
})
