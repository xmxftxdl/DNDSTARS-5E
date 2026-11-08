import {buildDeathXgeCumulativeScene} from './bountifulDeathXgeCumulative.scene.fixture'
import {buildDeathRepeatActors} from './browser-growth'
import {activeDnd5eRulesPluginRequirements} from '../pluginApi'
import {createDnd5eEffectiveRulesContextV1} from '../effectiveRulesContext'
import {createDnd5eMapCombatSnapshot} from '../mapBridge'
import {prepareDnd5ePluginSpellCast} from '../pluginSpellTransaction'
import {ensureDnd5eCoreSpellActivitiesRegisteredV1} from '../activities/dnd5eCoreSpellActivities'
import type {SharedPlayerActionState} from '../../../lib/sharedCombatTypes'
export async function trueHalfSavingSource(){
 const installed=await buildDeathXgeCumulativeScene()
 try{
  const growth=await buildDeathRepeatActors({roomId:'room',memberId:'first-member',helperMemberId:'helper-member'}),characters=growth.characters,map=growth.map
  const order=map.tokens.map((t,i)=>({tokenId:t.id,slotId:t.id+':normal',label:t.label,roll:30-i,color:'',emoji:''}))
  const effectiveRules=createDnd5eEffectiveRulesContextV1({requiredPlugins:activeDnd5eRulesPluginRequirements()}),snapshot=createDnd5eMapCombatSnapshot({map,characters,effectiveRules,combatId:'actual-initial-brave',initiativeOrder:order,geometry:null})
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const action:SharedPlayerActionState={id:'actual-initial-brave-cause-fear',mapId:map.id,combatId:snapshot.state.combatId,sourceMode:'player',status:'pending',type:'dnd5e-spell-cast',roomMemberId:'first-member',actorTokenId:'support-token',characterId:'support',targetTokenId:'foe-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:growth.causeFearSpellId,castingClassId:'wizard',slotLevel:1,targetTokenId:'foe-token'}}
  const prepared=prepareDnd5ePluginSpellCast({map,characters,roomRequiredPlugins:activeDnd5eRulesPluginRequirements(),initiativeOrder:order,action})
  if(!prepared.ok)throw Error(prepared.reason)
  return{source:{prepared:prepared.prepared,currentRoom:{maps:[map],characters},rolls:{activityRolls:{}}},dispose:installed.dispose}
 }catch(error){installed.dispose();throw error}
}
