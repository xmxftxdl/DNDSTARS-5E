import{it,expect,vi}from'vitest'
import{genuineFirstDeathSavingTurn}from'./deathSaveTurnAction.bountiful.native.fixture'
import{resolvePreparedDnd5eDeathSavingTurn}from'./deathSaveTurnAction'
import{createDnd5eOriginalD20Session}from'./damageCommitSession'
import{createBountifulOriginalDieReceipt}from'./bountifulLuckReceipt'
import{bountifulPreparedController,bountifulPreparedOriginalRoller}from'./bountifulPreparedController'
import{captureBountifulOriginalRawIssuer}from'./bountifulOriginalRawIssuer'
import{durableD20RollId}from'../../lib/rollConfirmation'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{damageZeroNormalAckHttpFixture}from'./bountifulActivityCompletedProof.http.fixture'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'./turnEconomy'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('the actual zero-HP current death-save parent retains its own authenticated original raw before a B choice, without committing failures',async()=>{
 const f=await genuineFirstDeathSavingTurn(),http=await damageZeroNormalAckHttpFixture();try{
  const prepared=f.prepared,state=prepared.state,parent=prepared.action,requestId=durableD20RollId({mapId:prepared.map.id,sourceMode:'dm',transactionId:parent.id,occurrenceIndex:0}),source={prepared,command:f.command,...captureBountifulOriginalRawIssuer({mapId:prepared.map.id,parentId:parent.id,mode:'dm',rollId:requestId,cursor:1,raw:[1]})},probe=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eDeathSavingTurn,'foe-token','saving-throw');let stage:ReturnType<typeof probe.run>;let timestamp:number;try{stage=probe.run(state);timestamp=probe.originalEffectTimestamp()}finally{probe.cancel()}if(stage.status!=='pending-ally-natural-one')throw Error(stage.status);expect(stage.request.kind).toBe('saving-throw');expect(stage.snapshot.combatants['foe-token'].deathSaves.failures).toBe(0)
  const economy=Object.fromEntries(Object.entries(state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+(state.initiativeOrder[state.initiativeIndex]===id?(state.initiativeSlotIds?.[state.initiativeIndex]??id):id),a.speed),a.turn,a.speed)])),data:Record<string,any>={characters:{characters:prepared.characters},maps:{maps:[prepared.map]},combat:{active:true,mapId:prepared.map.id,combatId:state.combatId,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:prepared.initiativeOrder,dnd5eTurnEconomyByToken:economy},'map-geometry':{maps:[]},'campaign-time':{clock:0},'player-action-requests':{requests:[parent]},'player-action-processed':{actionIds:[]},'player-action-ack':{id:'',actionId:'',combatId:state.combatId}}
  for(const row of Object.values(data))row._sync={schemaVersion:1,revision:1,writerId:'host',writtenAt:1};const before=structuredClone(data),request={mapId:prepared.map.id,combatId:state.combatId,parentId:parent.id,requestId,rollerTokenId:'foe-token',targetCharacterId:'foe',kind:'dice',count:1,sides:20,label:'死亡豁免',targetName:'Foe',values:[],rollKind:'saving-throw',sourceMode:'dm',delivery:'player-roll-request',eventId:'real-death-original-request',updatedAt:1}
  expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200)
  const raw={...request,sourceMode:'player',values:[16]};expect((await http.event('dice-roll-request-player-to-dm',{...raw,delivery:'player-roll-start'},data,'first-member')).status).toBe(200);expect((await http.event('dice-roll-request-player-to-dm',{...raw,delivery:'player-roll-result'},data,'first-member')).status).toBe(200)
  const receipt=createBountifulOriginalDieReceipt({rawIssuer:{mode:'dm',rollId:requestId,cursor:1},identity:{roomId:'room',mapId:prepared.map.id,combatId:state.combatId,parentId:parent.id,occurrence:0,round:state.round,initiativeIndex:state.initiativeIndex,reactionEconomySignature:JSON.stringify(economy),roller:bountifulPreparedOriginalRoller(prepared,'foe-token','host'),hostMemberId:'host',effectTimestamp:timestamp,revisions:{characters:1,maps:1,'map-geometry':1}},originalAdapterId:'death-save',originalRoomAction:{...parent},originalParent:encodeSecondChanceParentWire(source),originalCheckpoint:{actorId:'foe-token',kind:'saving-throw'},request:stage.request,controllers:Object.fromEntries(stage.request.options.map(o=>[o.ownerId,bountifulPreparedController(prepared,o.ownerId,'host')]))});
  for(const mutation of ['positive-hp','stable','resolved-turn','foreign-turn','different-initiative','duplicate-token','changed-original-d20','extra-command-field'] as const){
   const alteredData=structuredClone(data),alteredReceipt=structuredClone(receipt),actor=alteredData.characters.characters.find((c:{id:string})=>c.id==='foe');
   if(mutation==='positive-hp')actor.currentHp=1;
   if(mutation==='stable')actor.deathSaveStable=true;
   if(mutation==='resolved-turn')actor.dnd5eCombatState.deathSaveTurn.resolved=true;
   if(mutation==='foreign-turn')actor.dnd5eCombatState.deathSaveTurn.turnKey+=':foreign';
   if(mutation==='different-initiative')alteredData.combat.initiativeIndex++;
   if(mutation==='duplicate-token')alteredData.maps.maps[0].tokens.push(structuredClone(alteredData.maps.maps[0].tokens.find((t:{id:string})=>t.id==='foe-token')));
   if(mutation==='changed-original-d20')alteredReceipt.originalParent=encodeSecondChanceParentWire({...source,command:{...f.command,d20:2}});
   if(mutation==='extra-command-field')alteredReceipt.originalParent=encodeSecondChanceParentWire({...source,command:{...f.command,forgedTail:{currentHp:1}}});
   const untouched=structuredClone(alteredData),rejected=await http.event('bountiful-original-mint-dm-to-host',{id:JSON.stringify(['bountiful-original-parent',parent.id,0]),receipt:alteredReceipt},alteredData,'host');
   expect(rejected.status,mutation+':'+JSON.stringify(rejected.payload)).toBe(403);expect(rejected.payload.error,mutation).toBe('bountiful-death-save-original:actual-current-turn-required');expect(alteredData,mutation).toEqual(untouched);
  }
  const issue=await http.event('bountiful-original-mint-dm-to-host',{id:JSON.stringify(['bountiful-original-parent',parent.id,0]),receipt},data,'host');expect(issue.status,JSON.stringify(issue.payload)).toBe(200);expect(data).toEqual(before)
 }finally{await http.close();f.dispose()}
})
