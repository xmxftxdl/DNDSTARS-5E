import {it,expect} from 'vitest'
import {celestialRadiantSelectedBundle} from './celestialRadiantSelected.fixture'
import {growSearingCelestial} from './celestialLawfulGrowth.fixture'
import {radiantSelectedScene} from './celestialRadiantSelectedScene.fixture'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {createDnd5ePreparedDamageCommitSession} from './damageCommitSession'
import {resolveDnd5ePreparedWithDamageReactions} from './damageReactionFlow'
const register=()=>registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(celestialRadiantSelectedBundle()))
it.each(['use','decline','stale-frame','wrong-source','changed-state','uninstalled'] as const)('actual original spell Session selected damage: %s',mode=>{
 const dispose=register();let removed=false;try{
  const f=radiantSelectedScene(growSearingCelestial(6)),input={prepared:f.prepared,effectRolls:[4,4],savingThrowD20:1},before=structuredClone(input),session=createDnd5ePreparedDamageCommitSession(input,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,f.input.action.id),pending=session.run(f.prepared.state)
  expect(pending.status).toBe('pending-spell-selected-ability');if(pending.status!=='pending-spell-selected-ability')throw Error('Actual native bonus checkpoint required')
  expect(pending.snapshot.combatants.enemy.currentHp).toBe(59);expect(pending.frame.options).toEqual([expect.objectContaining({castParentId:f.input.action.id,actorId:'caster',targetId:'enemy',amount:3})]);expect(input).toEqual(before)
  if(mode==='stale-frame'){const stale=structuredClone(pending.frame);stale.options[0].amount=100;expect(session.resumeSpellSelectedAbilityBonus(f.prepared.state,stale)).toMatchObject({status:'rejected',reason:'stale-checkpoint'})}
  if(mode==='wrong-source')expect(session.resumeSpellSelectedAbilityBonus(f.prepared.state,pending.frame,{frameId:pending.frame.id,featureId:'not-owned'})).toMatchObject({status:'rejected',reason:'unsupported-reaction'})
  if(mode==='uninstalled'){dispose();removed=true}
  const current=structuredClone(f.prepared.state);if(mode==='changed-state')current.combatants.enemy.currentHp--
  const result=session.resumeSpellSelectedAbilityBonus(current,pending.frame,mode==='decline'?undefined:{frameId:pending.frame.id,featureId:pending.frame.options[0].featureId})
  if(mode==='uninstalled'||mode==='changed-state')expect(result.status).toBe('rejected')
  else{expect(result.status).toBe('resolved');if(result.status!=='resolved')throw Error('Final native result required');expect(result.result.result.ok).toBe(true);expect(result.result.result.state.combatants.enemy.currentHp).toBe(mode==='decline'?51:48);expect(result.result.result.events.filter(e=>e.type==='spell-damage-selected-ability-modifier-applied')).toHaveLength(mode==='decline'?0:1)}
  expect(input).toEqual(before)
 }finally{if(!removed)dispose()}
})
it.each(['use','decline','authority-changed','missing-transport'] as const)('actual async original Flow selected damage: %s',async mode=>{
 const dispose=register();try{
  const f=radiantSelectedScene(growSearingCelestial(6)),input={prepared:f.prepared,effectRolls:[4,4],savingThrowD20:1},before=structuredClone(input);let current=true,asked=0
  const task=resolveDnd5ePreparedWithDamageReactions({combatRevision:1,replayEventBatchId:f.input.action.id,authorityUnchanged:()=>current,confirm:async()=>{throw Error('No other reaction expected')},roll:async()=>{throw Error('No new die expected')},...(mode==='missing-transport'?{}:{chooseSpellSelectedAbilityBonus:async({frame,state})=>{asked++;expect(state.combatants.enemy.currentHp).toBe(59);expect(input).toEqual(before);if(mode==='authority-changed')current=false;return mode==='decline'?undefined:{frameId:frame.id,featureId:frame.options[0].featureId}}})},input,resolvePreparedDnd5eSpellCast)
  if(mode==='missing-transport')await expect(task).rejects.toThrow('spell-selected-ability-choice-transport-required')
  else if(mode==='authority-changed')await expect(task).rejects.toThrow('damage-reaction-stale-authority')
  else{const result=await task;expect(result.result.ok).toBe(true);expect(result.result.state.combatants.enemy.currentHp).toBe(mode==='decline'?51:48)}
  expect(asked).toBe(mode==='missing-transport'?0:1);expect(input).toEqual(before)
 }finally{dispose()}
})
