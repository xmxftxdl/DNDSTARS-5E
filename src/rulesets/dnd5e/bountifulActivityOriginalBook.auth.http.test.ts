import{it,expect,vi}from'vitest';
import{buildActivityOriginalSource}from'./bountifulActivityOriginal.scene.fixture';
import{createBountifulActivityOriginalNativeSession,readBountifulActivityMissingOriginalOperation}from'../../pages/maps/bountifulActivityOriginalNative';
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire';
import{captureSecondChancePreparedHostFacts}from'../../pages/maps/secondChancePreparedHostFacts';
import{damageZeroNormalAckHttpFixture}from'./damageZeroNormalAck.http.support';
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'./turnEconomy';
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}));
const wire=(s:Parameters<typeof createBountifulActivityOriginalNativeSession>[0])=>encodeSecondChanceParentWire(captureSecondChancePreparedHostFacts(s));
it('actual queued Telekinesis Native frontier authenticates both original rollers without publishing state or granting a result',async()=>{
 const fixture=await buildActivityOriginalSource(),http=await damageZeroNormalAckHttpFixture();try{
  const input=fixture.input,state=input.prepared.state,identity={parentId:input.prepared.action.id,mapId:input.prepared.map.id,combatId:state.combatId},economies=Object.fromEntries(Object.entries(state.combatants).map(([id,a])=>[id,projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+(state.initiativeOrder[state.initiativeIndex]===id?(state.initiativeSlotIds?.[state.initiativeIndex]??id):id),a.speed),a.turn,a.speed)])),data:Record<string,any>={characters:{characters:input.prepared.characters},maps:{maps:[input.prepared.map]},combat:{active:true,mapId:identity.mapId,combatId:identity.combatId,round:state.round,initiativeIndex:state.initiativeIndex,initiativeOrder:state.initiativeOrder.map(tokenId=>({tokenId})),dnd5eTurnEconomyByToken:economies},'map-geometry':{maps:[]},'campaign-time':{clock:0},'player-action-requests':{requests:[input.prepared.action]},'player-action-processed':{actionIds:[]}};
  for(const row of Object.values(data))row._sync={revision:1,schemaVersion:1,writerId:'host',writtenAt:1};const original=structuredClone(data),channel='bountiful-native-raw-source-dm-to-host';
  const load=async(member='host')=>http.state('POST','bountiful-activity-original/source',identity,data,member);
  let clock:number|undefined;for(const actor of['tele-caster-token','soul-token']){
   const source:Parameters<typeof createBountifulActivityOriginalNativeSession>[0]={...input,rolls:actor==='tele-caster-token'?{}:{'telekinesis-caster-d20:soul-token':input.rolls['telekinesis-caster-d20:soul-token']}},session=createBountifulActivityOriginalNativeSession(source,actor);try{
    const stage=session.run();if(stage.status!=='missing-activity-ability-original')throw Error(stage.status);const facts=readBountifulActivityMissingOriginalOperation(session.missingOriginal(stage));clock??=facts.effectTimestamp;
    const command={sourceKind:'activity-original-v1',phase:'register',...identity,source:wire(facts.source),request:facts.request,effectTimestamp:clock,label:actor};
    expect((await http.event(channel,command,data,'spectator')).status).toBe(403);expect((await http.event(channel,command,data,'caster-member')).status).toBe(403);
    const issued=await http.event(channel,command,data,'host');expect(issued.status,JSON.stringify(issued.payload)).toBe(200);const read=await load();expect(read.status,JSON.stringify(read.payload)).toBe(200);const row=read.payload.rows.at(-1),member=actor==='tele-caster-token'?'caster-member':'first-member';
    expect(row).toMatchObject({actorId:actor,memberId:member,count:1,sides:20,index:actor==='tele-caster-token'?0:1});expect(read.payload).not.toHaveProperty('result');expect(read.payload).not.toHaveProperty('snapshot');expect((await load(member)).status).toBe(403);
    const request={...identity,requestId:row.requestId,rollerTokenId:actor,targetCharacterId:row.characterId,kind:'dice',count:1,sides:20,label:actor,targetName:actor,values:[],rollKind:'ability-check',sourceMode:'dm',delivery:'player-roll-request',eventId:actor+':request',updatedAt:1};
    expect((await http.event('dice-roll-request-dm-to-player',request,data,'host')).status).toBe(200);
    const values=actor==='tele-caster-token'?[18]:[19],raw={...request,sourceMode:'player',values};
    expect((await http.event('dice-roll-request-player-to-dm',{...raw,delivery:'player-roll-start'},data,'second-member')).status).toBe(403);
    expect((await http.event(channel,{sourceKind:'activity-original-v1',phase:'host-raw',...identity,requestId:row.requestId,rawValues:values},data,'host')).status).toBe(403);
    expect((await http.event('dice-roll-request-player-to-dm',{...raw,delivery:'player-roll-result'},data,member)).status).toBe(403);
    expect((await http.event('dice-roll-request-player-to-dm',{...raw,delivery:'player-roll-start'},data,member)).status).toBe(200);expect((await http.event('dice-roll-request-player-to-dm',{...raw,delivery:'player-roll-result'},data,member)).status).toBe(200);
    expect((await http.event('dice-roll-request-player-to-dm',{...raw,values:[2],delivery:'player-roll-result'},data,member)).status).toBe(403);
    const confirm={sourceKind:'activity-original-v1',phase:'confirm',...identity,requestId:row.requestId,rawValues:values,values:actor==='tele-caster-token'?[18]:[1]};expect((await http.event(channel,confirm,data,member)).status).toBe(403);expect((await http.event(channel,confirm,data,'host')).status).toBe(200);expect((await http.event(channel,{...confirm,values:[3]},data,'host')).status).toBe(403);
    expect((await http.event('dice-roll-request-dm-to-player',{...request,requestId:row.requestId+':dm-confirmed',delivery:'broadcast-result',values:confirm.values},data,'host')).status).toBe(200);
    const after=await load();expect(after.payload.rows.at(-1)).toMatchObject({raw:{memberId:member,values},confirmed:{memberId:'host',values:confirm.values}});expect(data).toEqual(original);
   }finally{await session.dispose()}
  }
  const complete=await load();expect(complete.payload.rows).toHaveLength(2);expect(complete.payload.effectTimestamp).toBe(clock);
  data['player-action-processed'].actionIds.push(identity.parentId);expect((await load()).status).toBe(403);data['player-action-processed'].actionIds=[];
  data['player-action-ack']={actionId:identity.parentId};expect((await load()).status).toBe(403);delete data['player-action-ack'];
  data.combat.dnd5eTurnEconomyByToken['helper-token'].reaction.current=0;expect((await load()).status).toBe(403);data.combat=structuredClone(original.combat);
  const publicCombat=await http.state('GET','combat',null,data,'first-member');expect(publicCombat.status).toBe(200);expect(JSON.stringify(publicCombat.payload)).not.toContain('bountiful-activity-original:');expect(JSON.stringify(publicCombat.payload)).not.toContain('activity-original-v1');expect(data).toEqual(original);
 }finally{fixture.dispose();await http.close()}
},180000);
