import{expect}from'vitest'
import{createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy}from'./turnEconomy'
import{installStormFurySource}from'./stormSorcery.fury.native.fixture'
import{growStorm}from'./stormSorcery.growth.native.fixture'
import{restoreClassResources}from'../../lib/classResources'
import{growWizard}from'../../pages/maps/mastermindMagicFamilies.fixture'
import{prepareDnd5eSpellCast,resolvePreparedDnd5eSpellCast}from'./spellAction'
import{createDnd5ePreparedDamageCommitSession,captureDnd5eStormFuryOriginalOperation}from'./damageCommitSession'
import{captureStormFuryOriginalPreparation}from'./stormFuryOriginalPreparation'
import{captureStormFurySavingOriginalPreparation}from'./stormFurySavingOriginalPreparation'
import{damageZeroNormalAckHttpFixture}from'./damageZeroNormalAck.http.support'

let furyDiceFixtureOrdinal=0
export async function fixture(){
 const dispose=await installStormFurySource(),app=await damageZeroNormalAckHttpFixture(),storm={...growStorm(14),roomId:'room',roomMemberId:'first-member'},wizard={...restoreClassResources(growWizard(16,'evocation',5,undefined,'vampiric-touch'),'long-rest'),roomId:'room',roomMemberId:'second-member'}
 const map={id:'actual-fury-str-map',name:'Actual Fury physical STR',width:1000,height:500,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'wizard-token',characterId:wizard.id,label:'Wizard',type:'player' as const,x:425,y:225,size:1,color:'',emoji:''},{id:'storm-token',characterId:storm.id,label:'Storm',type:'enemy' as const,x:475,y:225,size:1,color:'',emoji:''}]}
 const action={id:'actual-fury-str-spell-parent-'+(++furyDiceFixtureOrdinal),mapId:map.id,combatId:'actual-fury-str-combat',sourceMode:'player' as const,status:'pending' as const,type:'dnd5e-spell-cast' as const,actorTokenId:'wizard-token',characterId:wizard.id,targetTokenId:'storm-token',round:1,initiativeIndex:0,seq:1,updatedAt:1,dnd5eSpellCast:{spellId:'vampiric-touch',slotLevel:3,castingClassId:'wizard' as const,targetTokenId:'storm-token'}},prepared=prepareDnd5eSpellCast({map,characters:[wizard,storm],action,initiativeOrder:map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,color:'',emoji:'',roll:20-i}))});if(!prepared.ok)throw Error(prepared.reason)
 const input={prepared:prepared.prepared,transactionId:action.id,d20:18,effectRolls:[1,1,1]},session=createDnd5ePreparedDamageCommitSession(input,resolvePreparedDnd5eSpellCast,()=>false,undefined,undefined,action.id,false,false,false,true),owner=session.run(prepared.prepared.state);if(owner.status!=='pending-storm-fury-owner')throw Error(owner.status)
 const operation=captureDnd5eStormFuryOriginalOperation(owner),source=captureStormFuryOriginalPreparation(operation),id={parentId:source.parentId,mapId:source.mapId,combatId:source.combatId,frameIndex:source.frameIndex},docs:any={maps:{maps:[map]},characters:{characters:[wizard,storm]},combat:{mapId:map.id,combatId:action.combatId,active:true,round:1,initiativeIndex:0,initiativeOrder:prepared.prepared.state.initiativeOrder},'player-action-requests':{requests:[action]},'map-geometry':null,'campaign-time':{minutes:0},'player-action-processed':{actionIds:[]},'player-action-ack':null}
 docs.combat.initiativeOrder=map.tokens.map((t,i)=>({tokenId:t.id,label:t.label,color:'',emoji:'',roll:20-i}))
  docs.combat.dnd5eTurnEconomyByToken=Object.fromEntries(Object.entries(prepared.prepared.state.combatants).map(([id,actor])=>{const state=prepared.prepared.state,slot=state.initiativeOrder[state.initiativeIndex]===id?(state.initiativeSlotIds?.[state.initiativeIndex]??id):id;return[id,projectDnd5eHeadlessTurnEconomy(createDnd5eTurnEconomyCounts(state.combatId+':'+state.round+':'+slot,actor.speed),actor.turn,actor.speed)]}))
  for(const row of Object.values(docs))if(row&&typeof row==='object')Object.assign(row,{_sync:{revision:1,schemaVersion:1,writerId:'host',writtenAt:1}})
  const request=(family:string,route:string,payload:unknown,member='host')=>app.state('POST','storm-fury-'+family+'/'+route,payload,docs,member)
 return{dispose,app,input,session,owner,operation,source,id,docs,request,close:async()=>{session.cancel();await app.close();dispose()}}
}
export async function actualSaving(f:Awaited<ReturnType<typeof fixture>>){
 const issued=await f.request('owner','prepare',f.source);expect(issued.status,JSON.stringify(issued.payload)).toBe(200)
 const answer={...f.id,windowId:issued.payload.windowId,decision:{kind:'use',featureId:f.owner.frame.options[0].featureId}};expect((await f.request('owner','answer',answer,'first-member')).status).toBe(200)
 const native=f.session.resumeStormFuryOwner(f.input.prepared.state,f.owner.frame,{frameIndex:f.id.frameIndex,featureId:answer.decision.featureId});if(native.status!=='pending-storm-fury-saving')throw Error(native.status)
 const operation=captureDnd5eStormFuryOriginalOperation(native),source=captureStormFurySavingOriginalPreparation(operation);return{native,operation,source}
}
