import{it,expect}from'vitest'
import{installCurrent152}from'./mastermindCurrent152Source.fixture'
import{genuineHostWardWorld}from'./mastermindNativeWardSuccessorOwner.fixture'
import{settleMastermindNativeMonsterWard,readMastermindNativeMonsterWardRetargetOffers}from'./mastermindMisdirectionNativeParent'
import{dnd5eCombatantCoverRedirectFeatureIds,dnd5eCoverAttackRedirectEligible}from'../../application/combat/dnd5eCombatRules'
it('same original failed Majesty Ward must offer a genuinely acquired second Rogue13 with actual cover for its own Misdirection choice',async()=>{
 const dispose=await installCurrent152();try{const f=await genuineHostWardWorld(),s=f.decision.previewPrepared.state;
 expect(dnd5eCombatantCoverRedirectFeatureIds(s.combatants['second-owner-token']).some(id=>dnd5eCoverAttackRedirectEligible(s,'caster-token','second-owner-token','second-cover-token',id))).toBe(true);
 const registered=await f.api.post('mastermind-native-ward-original/register',{parentId:f.prompt.id,wardEffectId:f.requirements[0].effect.id,mode:f.requirements[0].mode});expect(registered.status,JSON.stringify(registered.payload)).toBe(200);const requestId=registered.payload.request.id;
 for(const[phase,values]of[['raw',[16]],['confirm',[1]]]as const)expect((await f.api.post('mastermind-native-ward-original/'+phase,{requestId,rollerTokenId:'caster-token',values})).status).toBe(200);
 expect((await f.api.post('mastermind-native-ward-original/complete',{requestId})).status).toBe(200);
 const ward=await settleMastermindNativeMonsterWard(f.decision);expect(ward.status).toBe('blocked');if(ward.status!=='blocked')throw Error('Real failed Ward required');
 const offers=await readMastermindNativeMonsterWardRetargetOffers(ward.blocked);
 expect(f.api.gateway.saveResourcesAtomically).not.toHaveBeenCalled();expect(await Promise.all(['characters','maps','combat','player-action-requests'].map(f.api.read))).toEqual(f.before);
 expect(offers).toContain('second-owner-token');
 }finally{dispose()}
})
