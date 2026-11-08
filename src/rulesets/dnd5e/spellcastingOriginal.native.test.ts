import {it,expect,vi} from 'vitest'
import {fixture} from './stormSorcery.castRoom.native.fixture'
import {createDnd5eMechanicalEffect} from './activeEffects'
import {prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast} from './spellAction'
import {createDnd5eNextOriginalD20Session,readDnd5eActualMissingSpellcastingOriginalBoundary,readDnd5eStormCastOriginalOperation} from './damageCommitSession'
import {captureDnd5eSpellcastingOriginalOperation,readDnd5eSpellcastingOriginalOperation} from './spellcastingOriginalOperation'
const auth=vi.hoisted(()=>({value:{roomId:'room',memberId:'host',role:'dm'}}))
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>auth.value}))
async function actual(alias=false,mode:'normal'|'advantage'|'disadvantage'='normal'){
 const f=await fixture(),effect=createDnd5eMechanicalEffect({definitionId:'native-casting-restriction',label:'Native casting restriction',targetId:'storm-token',source:{kind:'spell',actorId:'foe-token'},spellcastingSave:{ability:'con',dc:18},...(mode==='advantage'?{modifiers:{savingThrowAdvantages:['con' as const]}}:mode==='disadvantage'?{modifiers:{savingThrowDisadvantages:['con' as const]}}:{})}),characters=f.input.characters.map(c=>c.id==='storm'?{...c,dnd5eCombatState:{...c.dnd5eCombatState,activeEffects:[effect]}}:c),p=prepareDnd5eSpellCast({...f.input,characters});if(!p.ok){f.dispose();throw Error(p.reason)}
 const source={prepared:p.prepared,effectRolls:[] as number[]},resolve=alias?(input:typeof source)=>resolvePreparedDnd5eSpellCast(input):resolvePreparedDnd5eSpellCast,session=createDnd5eNextOriginalD20Session(source,resolve)
 try{const start=session.run(source.prepared.state);if(start.status!=='pending-storm-cast')throw Error('Actual start-cast required');const next=session.resumeStormCast(source.prepared.state,start.frame,{frameId:start.frame.id,featureId:start.frame.options[0].featureId,damageType:'lightning',targetIds:['foe-token']});if(next.status!=='missing-spellcasting-original')throw Error('Actual native caster requirement required');return{f,effect,source,session,missing:next}}catch(error){session.cancel();f.dispose();throw error}
}
it('only the real missing native result issues caster lineage with the complete earlier actual Storm occurrence and original clock',async()=>{
 const a=await actual();try{
  const input=structuredClone(a.source),op=captureDnd5eSpellcastingOriginalOperation(a.missing),row=readDnd5eSpellcastingOriginalOperation(op)
  expect(row.requirement).toEqual({actorId:'storm-token',effectId:a.effect.id,ability:'con',dc:18,rollMode:'normal',requiredDiceCount:1});expect(row.effectTimestamp).toBe(a.session.originalEffectTimestamp());expect(row.snapshot.combatants['foe-token'].currentHp).toBe(7);expect(row.source.prepared.state.combatants['foe-token'].currentHp).toBe(10);expect(row.source).not.toHaveProperty('spellcastingSavingThrows');expect(row.source).not.toHaveProperty('savingThrowD20');expect(row.source).not.toHaveProperty('d20');expect(row.stormOperation).toBeDefined();expect(readDnd5eStormCastOriginalOperation(row.stormOperation!).records[0].choice?.targetIds).toEqual(['foe-token']);expect(row.source).toEqual(a.source);expect(a.source).toEqual(input)
  expect(()=>captureDnd5eSpellcastingOriginalOperation(structuredClone(a.missing))).toThrow('actual-unchanged-missing-boundary-required');expect(()=>readDnd5eSpellcastingOriginalOperation(structuredClone(op))).toThrow('actual-current-operation-required');Reflect.set(row.requirement,'dc',19);row.snapshot.combatants['storm-token'].currentHp--;expect(readDnd5eSpellcastingOriginalOperation(op).requirement.dc).toBe(18);expect(readDnd5eActualMissingSpellcastingOriginalBoundary(a.missing).effectTimestamp).toBe(row.effectTimestamp)
 }finally{a.session.cancel();a.f.dispose()}
})
it.each(['normal','advantage','disadvantage']as const)('the genuine current caster effect determines %s and its exact physical pool size without supplying any face',async mode=>{
 const a=await actual(false,mode);try{const row=readDnd5eSpellcastingOriginalOperation(captureDnd5eSpellcastingOriginalOperation(a.missing));expect(row.requirement.rollMode).toBe(mode);expect(row.requirement.requiredDiceCount).toBe(mode==='normal'?1:2);expect(row.source).not.toHaveProperty('spellcastingSavingThrows');expect(row.source).not.toHaveProperty('savingThrowD20')}finally{a.session.cancel();a.f.dispose()}
})
it('the operation rejects resolver aliases, foreign Host realms and player-role captures',async()=>{
 const alias=await actual(true);try{expect(()=>captureDnd5eSpellcastingOriginalOperation(alias.missing)).toThrow('actual-core-spell-resolver-required')}finally{alias.session.cancel();alias.f.dispose()}
 const a=await actual();try{const op=captureDnd5eSpellcastingOriginalOperation(a.missing);auth.value.memberId='foreign';expect(()=>readDnd5eSpellcastingOriginalOperation(op)).toThrow('actual-current-operation-required');auth.value.memberId='host';auth.value.role='player';expect(()=>captureDnd5eSpellcastingOriginalOperation(a.missing)).toThrow('actual-host-required');auth.value.role='dm';expect(readDnd5eSpellcastingOriginalOperation(op).requirement.effectId).toBe(a.effect.id)}finally{auth.value.memberId='host';auth.value.role='dm';a.session.cancel();a.f.dispose()}
})
it('a changed actual observation or an unloaded genuine earlier source cannot survive as current caster lineage',async()=>{
 const a=await actual();try{const op=captureDnd5eSpellcastingOriginalOperation(a.missing);a.missing.snapshot.combatants['storm-token'].currentHp--;expect(()=>readDnd5eSpellcastingOriginalOperation(op)).toThrow('actual-unchanged-missing-boundary-required')}finally{a.session.cancel();a.f.dispose()}
 const b=await actual();let disposed=false;try{const op=captureDnd5eSpellcastingOriginalOperation(b.missing);b.f.dispose();disposed=true;expect(()=>readDnd5eSpellcastingOriginalOperation(op)).toThrow('current-source-required')}finally{b.session.cancel();if(!disposed)b.f.dispose()}
})
