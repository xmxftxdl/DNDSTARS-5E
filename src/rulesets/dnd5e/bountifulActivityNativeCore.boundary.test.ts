import{it,expect}from'vitest';
import*as pagePort from'../../pages/maps/bountifulActivityOriginalPort';
import*as nativePort from'./bountifulActivityOriginalPort';
import{readBountifulActivityOriginalQualification as pageRead}from'../../pages/maps/bountifulActivityOriginalQualification';
import{readBountifulActivityOriginalQualification as nativeRead,captureDnd5eBountifulActivityOriginalQualification}from'./bountifulActivityOriginalQualification';
import{readDnd5eActualOriginalAllyBoundary}from'./damageCommitSession';
import{readActualInterruptedActivityAbilityPool}from'./activities/activityAbilityOriginalDice';
import{readBountifulActivityNativeWorker}from'./bountifulActivityNativeBoundary';
it('Page re-exports retain the same Native functions and private qualifier identity',()=>{
 expect(pageRead).toBe(nativeRead);
 for(const name of['resolveBountifulPreparedActivityOriginal','createBountifulActivityOriginalNativePort','withBountifulActivityOriginalNativePort','disposeBountifulActivityOriginalNativePort']as const)expect(pagePort[name]).toBe(nativePort[name]);
});
it('DTOs, lookalike callbacks and copied errors never register a Native stage, worker, pool or qualifier',()=>{
 expect(()=>readDnd5eActualOriginalAllyBoundary({status:'pending-ally-natural-one',request:{actorId:'target',kind:'ability-check',originalRolls:[1]}})).toThrow('actual-unchanged-ally-boundary-required');
 const resolvePrepared=()=>({result:{ok:true}});Reflect.set(resolvePrepared,'kind','actual-activity-worker');expect(()=>readBountifulActivityNativeWorker(resolvePrepared)).toThrow('actual-worker-required');
 expect(()=>readActualInterruptedActivityAbilityPool(new Error('ally-natural-one-required'))).toThrow('actual-interrupted-formula-pool-required');
 expect(()=>captureDnd5eBountifulActivityOriginalQualification({},{}as never)).toThrow('actual-unchanged-ally-boundary-required');
 expect(()=>nativeRead({},{}as never)).toThrow('actual-private-qualification-required');
});
