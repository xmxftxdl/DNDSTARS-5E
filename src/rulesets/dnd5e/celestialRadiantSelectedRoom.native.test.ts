import {it,expect} from 'vitest'
import {celestialRadiantSelectedBundle} from './celestialRadiantSelected.fixture'
import {growSearingCelestial} from './celestialLawfulGrowth.fixture'
import {radiantSelectedScene} from './celestialRadiantSelectedScene.fixture'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromUnifiedContentBundleV1} from './unifiedContent'
import {resolvePreparedDnd5eSpellCast} from './spellAction'
import {resolveDnd5ePreparedWithDamageReactions} from './damageReactionFlow'
import {createSpellDamageSelectedAbilityRoomChoiceDriver} from '../../lib/spellDamageSelectedAbilityRoomChoices'
it.each(['use','negative-cha','decline','pending','changed-parent','uninstalled','missing-owner'] as const)('real native frame and presentation driver, without HTTP certification: %s',async mode=>{
 const dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(celestialRadiantSelectedBundle()));let removed=false;try{
  const f=radiantSelectedScene(growSearingCelestial(6,mode==='negative-cha'?8:16)),input={prepared:f.prepared,effectRolls:[4,4],savingThrowD20:1},before=structuredClone(input);let parent=f.input.action.id,asked=0
  const driver=createSpellDamageSelectedAbilityRoomChoiceDriver({map:f.input.map,characters:()=>mode==='missing-owner'?[]:f.input.characters,parentTransactionId:()=>parent,authorityUnchanged:()=>true,choose:async request=>{
   asked++;expect(request.actor.id).toBe(f.input.characters[0].id);expect(request.transactionId).toBe(f.input.action.id);expect(request.audience).toBe('actor');expect(request.defaultOptionId).toBe('pending');expect(request.options.map(o=>o.id)).toEqual(['pending','decline','use']);expect(request.prompt).toContain(mode==='negative-cha'?'（-1）':'（+3）');expect(input).toEqual(before)
   if(mode==='changed-parent')parent='another-original'
   if(mode==='uninstalled'){dispose();removed=true}
   return mode==='pending'?undefined:mode==='decline'?'decline':'use'
  }})
  const task=resolveDnd5ePreparedWithDamageReactions({combatRevision:1,replayEventBatchId:f.input.action.id,authorityUnchanged:()=>true,confirm:async()=>{throw Error('No other reaction expected')},roll:async()=>{throw Error('This choice has no dice')},...driver},input,resolvePreparedDnd5eSpellCast)
  if(mode==='pending')await expect(task).rejects.toThrow('decision-pending')
  else if(mode==='changed-parent')await expect(task).rejects.toThrow('stale-parent')
  else if(mode==='uninstalled')await expect(task).rejects.toThrow('changed-source')
  else if(mode==='missing-owner')await expect(task).rejects.toThrow('canonical-owner-and-pool-required')
  else{const result=await task;expect(result.result.ok).toBe(true);expect(result.result.state.combatants.enemy.currentHp).toBe(mode==='negative-cha'?52:mode==='decline'?51:48)}
  expect(asked).toBe(mode==='missing-owner'?0:1);expect(input).toEqual(before)
 }finally{if(!removed)dispose()}
})
