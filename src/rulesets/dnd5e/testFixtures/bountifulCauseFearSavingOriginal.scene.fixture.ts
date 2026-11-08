import{causeFearCasterFor as casterFor}from'./bountifulDeathCauseFearCaster.scene.fixture'
import{createDnd5eEffectiveRulesContextV1}from'../effectiveRulesContext'
import{activeDnd5eRulesPluginRequirements}from'../pluginApi'
import{buildDeathXgeCumulativeScene}from'./bountifulDeathXgeCumulative.scene.fixture'
import{createDnd5eMapCombatSnapshot}from'../mapBridge'
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../activities/dnd5eCoreSpellActivities'
import{prepareDnd5ePluginSpellCast}from'../pluginSpellTransaction'
import type{BattleMap,Token}from'../../../store/maps'
import type{SharedPlayerActionState}from'../../../lib/sharedCombatTypes'
export async function genuineCauseFearSavingOriginalSource(){
 const scene=await buildDeathXgeCumulativeScene();try{
  const support=await casterFor('local.xge.repaired.archer93:cause-fear'),base=scene.input.prepared,characters=[support,...['caster','foe','helper'].map(id=>{const c=base.characters.find(c=>c.id===id);if(!c)throw Error(id);return c})];
  const tokens:Token[]=characters.map((c,i)=>({id:c.id+'-token',characterId:c.id,type:'player',dnd5eSide:c.id==='caster'?'enemy':'player',label:c.name,x:475+i*50,y:375,size:1,color:'#abc',emoji:c.name[0],hp:c.currentHp,maxHp:c.maxHp})),map:BattleMap={...base.map,id:'genuine-area-death-map',tokens},order=tokens.map((t,i)=>({tokenId:t.id,slotId:t.id+':normal',label:t.label,roll:30-i,color:'',emoji:''}));
  const effectiveRules=createDnd5eEffectiveRulesContextV1({requiredPlugins:activeDnd5eRulesPluginRequirements()}),snapshot=createDnd5eMapCombatSnapshot({map,characters,effectiveRules,combatId:'genuine-area-death',initiativeOrder:order,geometry:null});ensureDnd5eCoreSpellActivitiesRegisteredV1();
  const fearAction:SharedPlayerActionState={id:'actual-learned-cause-fear-before-death',mapId:map.id,combatId:snapshot.state.combatId,sourceMode:'player',status:'pending',roomMemberId:'caster-owner',type:'dnd5e-spell-cast',actorTokenId:'support-token',characterId:'support',targetTokenId:'foe-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'local.xge.repaired.archer93:cause-fear',castingClassId:'wizard',slotLevel:1,targetTokenId:'foe-token'}},areaPrepared=prepareDnd5ePluginSpellCast({map,characters,roomRequiredPlugins:activeDnd5eRulesPluginRequirements(),initiativeOrder:order,action:fearAction});if(!areaPrepared.ok)throw Error('Actual learned Cause Fear:'+areaPrepared.reason);const check=areaPrepared.prepared.activity?.checks?.[0];if(check?.kind!=='saving-throw')throw Error('Actual Cause Fear saving check required '+JSON.stringify(areaPrepared.prepared.activity?.checks));return{source:{prepared:areaPrepared.prepared,currentRoom:{maps:[map],characters},rolls:{activityRolls:{[check.rollId+':foe-token']:{values:[1],modifier:0,total:1}}}},check,dispose:scene.dispose}
 }catch(error){scene.dispose();throw error}
}
