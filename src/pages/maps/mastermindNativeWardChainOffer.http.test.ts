import{it,expect}from'vitest'
import{installCurrent152}from'./mastermindCurrent152Source.fixture'
import{genuineHostWardChainWorld}from'./mastermindNativeWardChainWorld.fixture'
import{collectMastermindNativeMonsterWard,readMastermindNativeMonsterWardRetargetOffers}from'./mastermindMisdirectionNativeParent'
it('actual core Host NPC failed first formal Majesty can offer a real second native Bard14 Ward under the same original before any second pool or world publication',async()=>{
 const dispose=await installCurrent152();try{
 const f=await genuineHostWardChainWorld();expect(f.f.secondWardGrowth).toHaveLength(13);expect(f.f.secondWardTokenId).toBe('actual-second-Majesty-token');expect(f.map.tokens.find(token=>token.id==='caster-token')?.characterId).toBeUndefined();
 const api=async<T>(operation:string,input:unknown):Promise<T>=>{const reply=await f.api.post('mastermind-native-ward-original/'+operation,input);expect(reply.status,JSON.stringify(reply.payload)).toBe(200);return reply.payload};let physical=0;
 const first=await collectMastermindNativeMonsterWard(f.decision,api,async request=>{physical++;expect((await f.api.post('mastermind-native-ward-original/raw',{requestId:request.durableRollRequestId,rollerTokenId:request.rollerTokenId,values:[16]})).status).toBe(200);expect((await f.api.post('mastermind-native-ward-original/confirm',{requestId:request.durableRollRequestId,rollerTokenId:request.rollerTokenId,values:[1]})).status).toBe(200);return[1]});expect(first.status).toBe('blocked');if(first.status!=='blocked')throw Error('Actual first native failed Ward required');expect(physical).toBe(1);expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();
 const offers=await readMastermindNativeMonsterWardRetargetOffers(first.blocked);expect(offers).toContain(f.f.secondWardTokenId);expect(physical).toBe(1);
 }finally{dispose()}
})
