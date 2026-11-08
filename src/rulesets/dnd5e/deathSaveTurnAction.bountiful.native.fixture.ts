import{buildActivityCumulativeScene}from'./testFixtures/bountifulActivityCumulative.scene.fixture'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'./spellAction'
import{resolveDnd5eHeadlessAction}from'./headlessCombatEngine'
import{planDnd5eMapResultApplication}from'./mapBridge'
import{prepareDnd5eDeathSavingTurn,type Dnd5eDeathSavingTurnCommand}from'./deathSaveTurnAction'
import type{BattleMap,Token}from'../../store/maps'
import type{Character}from'../../types/character'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{InitiativeEntry}from'../../components/map/InitiativeTracker'
export async function genuineFirstDeathSavingTurn(){
 const made=await buildActivityCumulativeScene();try{
  const characters:Character[]=['caster','foe','helper'].map(id=>{const c=made.input.prepared.characters.find(c=>c.id===id);if(!c)throw Error('Actual grown fixture character missing:'+id);return c})
  const tokens:Token[]=characters.map((c,i)=>({id:c.id+'-token',characterId:c.id,type:'player',dnd5eSide:i===0?'enemy':'player',label:c.name,x:525+i*50,y:375,size:1,color:'#abc',emoji:c.name[0],hp:c.currentHp,maxHp:c.maxHp})),map:BattleMap={...made.input.prepared.map,id:'actual-first-death-map',tokens},order:InitiativeEntry[]=tokens.map((t,i)=>({tokenId:t.id,slotId:t.id+':normal',label:t.label,roll:20-i,color:'',emoji:''}))
  const action:SharedPlayerActionState={id:'actual-inflict-before-death',mapId:map.id,combatId:'actual-first-death',sourceMode:'player',status:'pending',roomMemberId:'first-member',type:'dnd5e-spell-cast',actorTokenId:'caster-token',characterId:'caster',targetTokenId:'foe-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'inflict-wounds',castingClassId:'cleric',slotLevel:1,targetTokenId:'foe-token'}}
  const spell=prepareDnd5eSpellCast({action,map,characters,initiativeOrder:order});if(!spell.ok)throw Error(spell.reason)
  const cast=resolvePreparedDnd5eSpellCast({prepared:spell.prepared,d20:18,effectRolls:[4,4,4]});if(!cast.result.ok||!cast.application)throw Error('True learned Inflict Wounds failed')
  const hit=cast.result.state.combatants['foe-token'];if(hit.currentHp!==0||hit.deathSaves.dead)throw Error('True spell must cause noninstant zero HP')
  const next=resolveDnd5eHeadlessAction(cast.result.state,{type:'end-turn',actorId:'caster-token'});if(!next.ok)throw Error(next.reason)
  const projection=planDnd5eMapResultApplication({map:cast.application.map,characters:cast.application.characters,state:next.state,events:[...next.events],characterIdByCombatantId:spell.prepared.characterIdByCombatantId})
  const deathAction:SharedPlayerActionState={id:'actual-first-death-original',mapId:map.id,combatId:next.state.combatId,sourceMode:'player',status:'pending',roomMemberId:'first-member',type:'dnd5e-death-save',actorTokenId:'foe-token',characterId:'foe',round:next.state.round,initiativeIndex:next.state.initiativeIndex,seq:2,updatedAt:2},preparationInput={action:deathAction,map:projection.map,characters:projection.characters,initiativeOrder:order},prepared=prepareDnd5eDeathSavingTurn(preparationInput);if(!prepared.ok)throw Error(prepared.reason)
  const command:Dnd5eDeathSavingTurnCommand={type:'death-save-turn',actorId:'foe-token',d20:1,nextTurnSlotId:prepared.prepared.nextTurnSlotId,deferNextTurnStart:true}
  return{dispose:made.dispose,preparationInput,prepared:prepared.prepared,command,helperProof:{level:characters.find(c=>c.id==='helper')!.level,copied:characters.find(c=>c.id==='helper')!.dnd5ePluginFeatureIds??[]},initialFoeHp:characters.find(c=>c.id==='foe')!.currentHp,actualDamage:cast.result.events.filter(e=>e.type==='damage-applied')}
 }catch(error){made.dispose();throw error}
}
