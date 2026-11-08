import{it,expect}from'vitest'
import{fixture}from'./stormSorcery.castRoom.native.fixture'
import{createDnd5eOriginalD20Session,captureDnd5eStormCastOriginalOperation,readDnd5eStormCastOriginalOperation}from'./damageCommitSession'
import{resolvePreparedDnd5eSpellCast}from'./spellAction'
import{heartFeatureId}from'./stormSorcery.castStart.native.fixture'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{stormCastOriginalSourceFacts}from'../../../shared/storm-cast-original.mjs'

it('the actual no-effect/no-save-roll native cast still issues its real Heart prefix before any new original die',async()=>{
 const f=await fixture();try{
  const source={prepared:f.prepared,effectRolls:[],spellcastingSavingThrows:[],slowSpellDelayD20:undefined,savingThrowCounterattacks:undefined,savingThrowDisadvantageNegation:undefined,opportunityAttackSpell:f.input.action.dnd5eSpellCast.opportunityAttackSpell===true,mountedAttackRedirect:undefined,counterspellReaction:undefined,sourceActionInterruptionReaction:undefined,spellInterceptionReaction:undefined,tranquilitySave:undefined,targetTranquilitySaves:undefined}
  const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eSpellCast,'foe-token','saving-throw'),pending=session.run(f.prepared.state)
  expect(pending.status).toBe('pending-storm-cast');if(pending.status!=='pending-storm-cast')throw Error('Actual no-roll prefix required')
  const operation=captureDnd5eStormCastOriginalOperation(pending),native=readDnd5eStormCastOriginalOperation(operation)
  expect(native.source).toEqual(source);expect(source.effectRolls).toEqual([]);expect(source).not.toHaveProperty('savingThrowD20');expect(source).not.toHaveProperty('d20')
  const next=session.resumeStormCast(f.prepared.state,pending.frame,{frameId:pending.frame.id,featureId:heartFeatureId,damageType:'lightning',targetIds:['foe-token']})
  expect(next.status).toBe('original-d20-ready');if(next.status!=='original-d20-ready')throw Error('Actual missing-original boundary required')
  expect(next.request.originalRolls).toEqual([0]);expect(next.snapshot.combatants['foe-token'].currentHp).toBe(7);expect(f.prepared.state.combatants['foe-token'].currentHp).toBe(10);expect(readDnd5eStormCastOriginalOperation(operation).source).toMatchObject({effectRolls:[]})
  expect(stormCastOriginalSourceFacts(encodeSecondChanceParentWire(native.source))).not.toBeNull();for(const extra of[{savingThrowD20:20},{savingThrowD20:undefined},{d20:1},{hostOriginalRollId:'not-issued'},{result:{ok:true}},{snapshot:pending.snapshot}])expect(stormCastOriginalSourceFacts(encodeSecondChanceParentWire({...source,...extra}))).toBeNull()
 }finally{f.dispose()}
})
