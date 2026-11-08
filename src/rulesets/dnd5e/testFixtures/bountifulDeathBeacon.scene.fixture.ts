import{casterFor}from'./bountifulDeathBeaconCaster.scene.fixture'
import{buildActivityCumulativeScene}from'./bountifulActivityCumulative.scene.fixture'
import{createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication}from'../mapBridge'
import{ensureDnd5eCoreSpellActivitiesRegisteredV1}from'../activities/dnd5eCoreSpellActivities'
import{resolveDnd5eHeadlessAction}from'../headlessCombatEngine'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'../spellAction'
import{prepareDnd5eDeathSavingTurn,type Dnd5eDeathSavingTurnCommand}from'../deathSaveTurnAction'
import type{BattleMap,Token}from'../../../store/maps'
import type{SharedPlayerActionState}from'../../../lib/sharedCombatTypes'
export async function genuineBeaconDeathSavingTurn(){
 const scene=await buildActivityCumulativeScene();try{
  const support=await casterFor('beacon-of-hope'),base=scene.input.prepared,characters=[support,...['caster','foe','helper'].map(id=>{const c=base.characters.find(c=>c.id===id);if(!c)throw Error(id);return c})];
  const tokens:Token[]=characters.map((c,i)=>({id:c.id+'-token',characterId:c.id,type:'player',dnd5eSide:c.id==='caster'?'enemy':'player',label:c.name,x:475+i*50,y:375,size:1,color:'#abc',emoji:c.name[0],hp:c.currentHp,maxHp:c.maxHp})),map:BattleMap={...base.map,id:'genuine-beacon-death-map',tokens},order=tokens.map((t,i)=>({tokenId:t.id,slotId:t.id+':normal',label:t.label,roll:30-i,color:'',emoji:''}));
  const snapshot=createDnd5eMapCombatSnapshot({map,characters,combatId:'genuine-beacon-death',initiativeOrder:order,geometry:null});ensureDnd5eCoreSpellActivitiesRegisteredV1();
  const beacon=resolveDnd5eHeadlessAction(snapshot.state,{type:'plugin-spell-activity',actorId:'support-token',pluginAction:{type:'plugin',pluginId:'srd-5.1',actionId:'spell:beacon-of-hope',transactionId:'actual-beacon-before-death',actorId:'support-token',targetId:'foe-token',targetIds:['foe-token'],distanceFeet:10,castLevel:3},spell:{castingClassId:'cleric',spellId:'beacon-of-hope',spellName:'Beacon of Hope',spellLevel:3,slotLevel:3,castingTime:'action',declaredTargetIds:['foe-token'],concentrationRounds:10,concentrationTargetIds:['foe-token'],spellSchool:'abjuration'}});if(!beacon.ok)throw Error('Actual Beacon:'+beacon.reason);
  const supportEnd=resolveDnd5eHeadlessAction(beacon.state,{type:'end-turn',actorId:'support-token'});if(!supportEnd.ok)throw Error(supportEnd.reason);
  const first=planDnd5eMapResultApplication({map,characters,state:supportEnd.state,events:[...beacon.events,...supportEnd.events],characterIdByCombatantId:snapshot.characterIdByCombatantId});
  const action:SharedPlayerActionState={id:'actual-inflict-after-beacon',mapId:map.id,combatId:snapshot.state.combatId,sourceMode:'player',status:'pending',roomMemberId:'first-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'foe-token',round:supportEnd.state.round,initiativeIndex:supportEnd.state.initiativeIndex,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'inflict-wounds',castingClassId:'cleric',slotLevel:1,targetTokenId:'foe-token'}};
  const spell=prepareDnd5eSpellCast({action,map:first.map,characters:first.characters,initiativeOrder:order});if(!spell.ok)throw Error(spell.reason);const hit=resolvePreparedDnd5eSpellCast({prepared:spell.prepared,d20:18,effectRolls:[4,4,4]});if(!hit.result.ok||!hit.application)throw Error('Actual learned Inflict Wounds required');if(hit.result.state.combatants['foe-token'].currentHp!==0||hit.result.state.combatants['foe-token'].deathSaves.dead)throw Error('Actual noninstant spell zero required');
  const next=resolveDnd5eHeadlessAction(hit.result.state,{type:'end-turn',actorId:'caster-token'});if(!next.ok)throw Error(next.reason);const projected=planDnd5eMapResultApplication({map:hit.application.map,characters:hit.application.characters,state:next.state,events:[...next.events],characterIdByCombatantId:spell.prepared.characterIdByCombatantId});
  const deathAction:SharedPlayerActionState={id:'actual-beacon-death-original',mapId:map.id,combatId:next.state.combatId,sourceMode:'player',status:'pending',roomMemberId:'first-member',type:'dnd5e-death-save',actorTokenId:'foe-token',characterId:'foe',round:next.state.round,initiativeIndex:next.state.initiativeIndex,seq:2,updatedAt:2},preparationInput={action:deathAction,map:projected.map,characters:projected.characters,initiativeOrder:order},prepared=prepareDnd5eDeathSavingTurn(preparationInput);if(!prepared.ok)throw Error(prepared.reason);
  const command:Dnd5eDeathSavingTurnCommand={type:'death-save-turn',actorId:'foe-token',d20:1,d20Second:2,nextTurnSlotId:prepared.prepared.nextTurnSlotId,deferNextTurnStart:true};
  return{prepared:prepared.prepared,preparationInput,command,beacon,dispose:scene.dispose,supportLevel:support.level,helperLevel:characters.find(c=>c.id==='helper')!.level}
 }catch(error){scene.dispose();throw error}
}
