import{expect,it}from'vitest'
import{fixture}from'./stormSorcery.tempestuous.terminal.fixture'
import{growTempestuousCompound}from'./stormSorcery.tempestuous.compound.growth.fixture'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'./spellAction'
import{readDnd5eActualTempestuousBeforeSpellMovement,resolveDnd5eHeadlessAction}from'./headlessCombatEngine'
import{withTempestuousBeforeCastCheckpoints}from'./tempestuousBeforeCastCheckpoint'
import{withTempestuousCastGeometry}from'./tempestuousCastGeometry'
import{clearDnd5eEffectiveRulesContextsForTest}from'./effectiveRulesContext'
it('actual touch Mage Armor initially prepares for a lawful ally, then a real10ft prefix loses touch range and its terminal rejected operation is closed',async()=>{
 const f=await fixture();try{
  const ally={...growTempestuousCompound(1),id:'actual-ally',name:'Actual ally'},map={...f.map,tokens:[...f.map.tokens,{...f.map.tokens[0],id:'ally-token',characterId:ally.id,label:ally.name,x:525,y:575}]};const action={...f.action,dnd5eSpellCast:{...f.action.dnd5eSpellCast,targetTokenId:'ally-token'}};
  const p=prepareDnd5eSpellCast({...f.input,map,characters:[f.owner,ally],action});expect(p.ok).toBe(true);if(!p.ok)throw Error(p.reason);const baseline=structuredClone(p.prepared);let captured:object|undefined;
  const result=withTempestuousBeforeCastCheckpoints(action.id,(_frame,operation)=>{captured=operation;expect(readDnd5eActualTempestuousBeforeSpellMovement(operation).state.combatants['storm-token'].turn.bonusActionAvailable).toBe(false)},()=>resolvePreparedDnd5eSpellCast({prepared:p.prepared,effectRolls:[],transactionId:action.id},{now:1793100000000}));
  expect(captured).toBeDefined();expect(result.result.ok).toBe(false);if(result.result.ok)throw Error('Actual touch range must fail after moving');expect(result.result.reason).toBe('invalid-target');expect(result.application).toBeUndefined();expect(result.result.transaction?.status).toBe('rolled-back');expect(p.prepared).toEqual(baseline);expect(()=>readDnd5eActualTempestuousBeforeSpellMovement(captured!)).toThrow('actual-current-native-operation-required')
 }finally{f.dispose();clearDnd5eEffectiveRulesContextsForTest()}
})
it('a real native movement prefix is closed when its concrete preparation callback returns no continuation',async()=>{
 const f=await fixture();try{let captured:object|undefined;const result=withTempestuousBeforeCastCheckpoints(f.action.id,(_frame,operation)=>{captured=operation},()=>withTempestuousCastGeometry({parentId:f.action.id,actorId:'storm-token',map:f.map,geometry:null},()=>resolveDnd5eHeadlessAction(f.prepared.state,{type:'cast-spell',castInstanceId:f.action.id,actorId:'storm-token',targetId:'storm-token',spellId:'mage-armor',slotLevel:1,castingClassId:'sorcerer',effectRolls:[],tempestuousMovement:f.intent},{transactionId:f.action.id,now:1793100000000},{prepareActualTempestuousSpell:()=>undefined})));expect(result.ok).toBe(false);expect(captured).toBeDefined();expect(()=>readDnd5eActualTempestuousBeforeSpellMovement(captured!)).toThrow('actual-current-native-operation-required')}finally{f.dispose();clearDnd5eEffectiveRulesContextsForTest()}
})
