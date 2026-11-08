import {it,expect,vi} from 'vitest'
import fs from 'node:fs'
import ts from 'typescript'
import {bountifulReadyHttpFixture} from '../rulesets/dnd5e/opportunityMove.httpSupport'
import {captureBountifulOpportunityMovePrefixContext} from '../rulesets/dnd5e/opportunityMovePrefixContext'
import {beginDnd5eOpportunityCharacterPublication,readDnd5eOpportunityCharacterPublication} from '../rulesets/dnd5e/opportunityCharacterPublication'
import {prepareDnd5ePlayerMove} from '../rulesets/dnd5e/playerMoveAction'
import {replayDnd5ePlayerMovePrefix} from '../rulesets/dnd5e/playerMovePrefix'
import {createDnd5eTurnEconomyCounts} from '../rulesets/dnd5e/turnEconomy'
import {normalizeCharacter,projectDnd5eAuthorityCharacterPatch,useCharacterStore,clearPendingAuthorityCharacterPatchesForTest} from './characters'
import {useMapStore,type BattleMap} from './maps'
import {applyDnd5eCombatResultApplication,mergeDnd5eCombatCharacterResult} from '../pages/maps/commitDnd5eCombatResult'
import {dnd5eCombatApplicationUsesStructuralMap} from '../pages/maps/combatApplicationStoreProjection'
import {publishPlayerActionAckWithSnapshots} from '../lib/playerActionAckPublish'
import type {SharedPlayerActionState} from '../lib/sharedCombatTypes'
import type {SharedRoomGatewayPort} from '../ports/sharedRoomGateway'

const runtime=vi.hoisted(()=>({session:{roomId:'room',memberId:'host',role:'dm'},load:undefined as undefined|((name:string)=>Promise<unknown>),save:undefined as undefined|SharedRoomGatewayPort['saveResourcesAtomically']}))
vi.mock('../lib/roomSession',()=>({getRoomSession:()=>runtime.session}))
vi.mock('../composition/browserSharedRoomResources',async original=>{const actual=await original<Record<string,unknown>>();return {...actual,loadSharedResource:(name:string)=>runtime.load?.(name),saveSharedResourcesAtomically:(...args:Parameters<SharedRoomGatewayPort['saveResourcesAtomically']>)=>runtime.save?.(...args),getSharedResourceRevisionWatermark:()=>0}})

it('keeps a real queued movement prefix local during loadShared repair and saves only at its original ACK boundary',async()=>{
 const http=await bountifulReadyHttpFixture()
 try{
  const mover=projectDnd5eAuthorityCharacterPatch(normalizeCharacter({id:'second',name:'Mover',charClass:'战士',level:4,roomMemberId:'second-member'}),{}),other=projectDnd5eAuthorityCharacterPatch(normalizeCharacter({id:'first',name:'Other',charClass:'战士',level:4,roomMemberId:'first-member'}),{})
  const characters=[mover,other],map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'mover-token',characterId:mover.id,label:'Mover',type:'player',x:500,y:375,size:1,color:'',emoji:''},{id:'first-token',characterId:other.id,label:'Other',type:'player',x:450,y:375,size:1,color:'',emoji:''}]},initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,color:'',emoji:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
  type Resource={_sync:{revision:number;schemaVersion:number;writerId:string;writtenAt:number};[key:string]:unknown}
  const revision={revision:1,schemaVersion:1,writerId:'host',writtenAt:1},data:Record<string,Resource>={characters:{_sync:{...revision},characters,selectedId:'second',updatedAt:1},maps:{_sync:{...revision},maps:[map],selectedId:'map',updatedAt:1},combat:{_sync:{...revision},mapId:'map',combatId:'combat',active:true,round:1,initiativeIndex:0,initiativeOrder},'player-action-requests':{_sync:{...revision},requests:[]}}
  const publications:Array<{names:string[];characters:unknown}>=[]
  runtime.load=async name=>{const response=await http.state('GET',name,null,data,'host');expect(response.status).toBe(200);return response.payload}
  runtime.save=async(writes,options)=>{publications.push({names:writes.map(row=>row.name),characters:writes.find(row=>row.name==='characters')?.data});const response=await http.state('POST','transaction',{transactionId:options?.transactionId??crypto.randomUUID(),...options,writes},data,'host');expect(response.status,JSON.stringify(response.payload)).toBe(200);for(const row of writes)data[row.name]={...row.data as object,_sync:{...revision,revision:response.payload.revisions[row.name]}};return {status:'committed',transactionId:options?.transactionId??'',revisions:response.payload.revisions}}
  const command=await http.command('actual-provisional-move',{schemaVersion:1,command:{schemaVersion:1,commandId:'actual-provisional-move',type:'move-token',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'second',round:1,initiativeIndex:0,seq:1,expectedRevisions:{combat:1,maps:1},issuedAt:1,expectedPosition:{x:500,y:375},expectedElevationFeet:0,targetPosition:{x:625,y:375}}},data,'second-member');expect(command.status).toBe(202);data['player-action-requests']=command.queue;data['combat-command-receipts']=command.receipts
  const action=(command.queue.requests as SharedPlayerActionState[]).find(row=>row.id==='actual-provisional-move');if(!action)throw Error('Actual authenticated queued move required')
  useCharacterStore.setState({characters:structuredClone(characters),selectedId:'second'});useMapStore.setState({maps:[structuredClone(map)]})
  await useCharacterStore.getState().loadShared({force:true});await new Promise(resolve=>setTimeout(resolve,50));publications.length=0
  const context=captureBountifulOpportunityMovePrefixContext({action,map,characters,initiativeOrder,moverEconomy:economy,originalEconomies:{'mover-token':economy},turnEconomyByToken:{'mover-token':economy}},()=>({geometry:1,clock:1})),scope=beginDnd5eOpportunityCharacterPublication(context);if(!scope)throw Error('Actual prepared move scope required')
  expect(()=>beginDnd5eOpportunityCharacterPublication({...context})).toThrow('exact-original-context-required')
  const prepared=prepareDnd5ePlayerMove({action,map,characters,initiativeOrder,turnEconomy:economy});if(!prepared.ok)throw Error(prepared.reason)
  const prefix=replayDnd5ePlayerMovePrefix({originalInput:{action,map,characters,initiativeOrder,turnEconomy:economy},prepared:prepared.prepared,position:{x:525,y:375},elevationFeet:0,firstHostNow:1000,transactionId:action.id+':segment:1'});if(!prefix.resolution.application)throw Error('Actual prefix material')
  const source=fs.readFileSync(process.env.XGE_ARCANE_PAGE_SOURCE??'src/pages/MapsWorkspacePage.tsx','utf8'),start=source.indexOf('  const applyDnd5eCombatCharacterUpdate = ('),end=source.indexOf('  const currentDnd5eAuthorityCombatState',start);if(start<0||end<0)throw Error('Actual Page authority application required')
  const deps={useCharacterStore,useMapStore,mergeDnd5eCombatCharacterResult,applyAuthorityCharacterUpdate:useCharacterStore.getState().applyAuthorityUpdate,applyAuthorityTokenUpdate:useMapStore.getState().applyAuthorityTokenUpdate,applyAuthorityMapUpdate:useMapStore.getState().applyAuthorityMapUpdate,applyCoordinatedDnd5eCombatResultBase:applyDnd5eCombatResultApplication,dnd5eCombatApplicationUsesStructuralMap,roundRef:{current:1},combatActiveRef:{current:true},combatIdRef:{current:'combat'},initiativeOrderRef:{current:initiativeOrder},initiativeIndexRef:{current:0},useMapGeometryStore:{getState:()=>({replaceMap:()=>{throw Error('No geometry prefix')}})},applyDnd5eTurnAdvance:()=>{throw Error('No turn advance')},updateDnd5eTurnEconomy:()=>{throw Error('No native reaction spend')}}
  const body=ts.transpileModule(source.slice(start,end)+';return applyDnd5eCombatApplication;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,apply=new Function(...Object.keys(deps),body)(...Object.values(deps))
  apply(prefix.resolution.application,scope)
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(0)
  await useCharacterStore.getState().loadShared({force:true});await new Promise(resolve=>setTimeout(resolve,75))
  expect(publications).toHaveLength(0)
  expect((data.characters.characters as typeof characters)[0].dnd5eCombatState?.runningJumpApproachFeet).toBeUndefined()
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(0)
  // A different already-committed authority repair still republishes normally.
  useCharacterStore.getState().applyAuthorityUpdate('first',{currentHp:Math.max(0,other.currentHp-1)},{protectPatchUntilAcknowledged:true})
  await useCharacterStore.getState().loadShared({force:true});await vi.waitFor(()=>expect((data.characters.characters as typeof characters)[1].currentHp).toBe(other.currentHp-1))
  expect((data.characters.characters as typeof characters)[1].currentHp).toBe(other.currentHp-1)
  expect((data.characters.characters as typeof characters)[0].dnd5eCombatState?.runningJumpApproachFeet).toBeUndefined()
  expect((data.characters.characters as typeof characters)[0]).toEqual(mover)
  await expect(useCharacterStore.getState().finishOpportunityPublication(scope,{...action,mapId:'foreign-map'})).rejects.toThrow('exact-original-completion-required')
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(0)
  // Rejection of this original clears only its provisional overlay; the other
  // character's genuine published repair remains intact.
  await useCharacterStore.getState().finishOpportunityPublication(scope,action)
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBeUndefined()
  expect(useCharacterStore.getState().characters[1].currentHp).toBe(other.currentHp-1)
  // Use the production Page's exact completion handlers, not a duplicate test
  // cleanup implementation. The commit below uses the real atomic ACK writer.
  const completionStart=source.indexOf('}).then(async()=>{',source.indexOf('    const commit = publishOriginal(action, {'))+2
  const completionEnd=source.indexOf('\n    // Once an action has entered authority settlement',completionStart)
  if(completionStart<2||completionEnd<0)throw Error('Actual original ACK completion handlers required')
  const complete=new Function('commitPromise','action','provisionalMovePublicationsRef','useCharacterStore','return commitPromise'+source.slice(completionStart,completionEnd))
  const fresh=()=>{const current=structuredClone(data.characters.characters as typeof characters);const ctx=captureBountifulOpportunityMovePrefixContext({action,map,characters:current,initiativeOrder,moverEconomy:economy,originalEconomies:{'mover-token':economy},turnEconomyByToken:{'mover-token':economy}},()=>({geometry:1,clock:1}));const held=beginDnd5eOpportunityCharacterPublication(ctx);if(!held)throw Error('Actual subsequent publication scope required');return held}
  const edited=fresh()
  expect(()=>readDnd5eOpportunityCharacterPublication({...edited})).toThrow('exact-current-host-scope-required')
  runtime.session={...runtime.session,roomId:'foreign-room'}
  expect(()=>readDnd5eOpportunityCharacterPublication(edited)).toThrow('exact-current-host-scope-required')
  runtime.session={...runtime.session,roomId:'room',memberId:'foreign-host'}
  expect(()=>readDnd5eOpportunityCharacterPublication(edited)).toThrow('exact-current-host-scope-required')
  runtime.session={roomId:'room',memberId:'host',role:'dm'}
  useCharacterStore.getState().applyAuthorityUpdate('second',{dnd5eCombatState:{...mover.dnd5eCombatState,schemaVersion:2,runningJumpApproachFeet:5}},{protectPatchUntilAcknowledged:true,deferSharedPublicationUntilAck:edited})
  // Ordinary user input to this exact field is neither a provisional result
  // nor permission to overwrite the original parent's server snapshot.
  useCharacterStore.getState().applyAuthorityUpdate('second',{dnd5eCombatState:{...useCharacterStore.getState().characters[0].dnd5eCombatState,schemaVersion:2,runningJumpApproachFeet:7}})
  await expect(useCharacterStore.getState().saveSharedNow()).rejects.toThrow('independent-field-conflict')
  await useCharacterStore.getState().loadShared({force:true})
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(7)
  expect((data.characters.characters as typeof characters)[0].dnd5eCombatState?.runningJumpApproachFeet).toBeUndefined()
  await expect(complete(Promise.reject(Error('original-refused')),action,{current:new Map([[action.id,edited]])},useCharacterStore)).rejects.toThrow('original-refused')
  await vi.waitFor(()=>expect((data.characters.characters as typeof characters)[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(7))
  // A real external write to the held field must survive loadShared and the
  // original parent's rejection. It cannot be overwritten by the old overlay.
  const external=fresh()
  useCharacterStore.getState().applyAuthorityUpdate('second',{dnd5eCombatState:{...useCharacterStore.getState().characters[0].dnd5eCombatState,schemaVersion:2,runningJumpApproachFeet:5}},{protectPatchUntilAcknowledged:true,deferSharedPublicationUntilAck:external})
  const remote=structuredClone(data.characters.characters as typeof characters)
  remote[0].dnd5eCombatState={...remote[0].dnd5eCombatState,schemaVersion:2,runningJumpApproachFeet:10}
  await runtime.save!([{name:'characters',expectedRevision:data.characters._sync.revision,data:{...data.characters,characters:remote}}],{transactionId:'external-real-edit'})
  await useCharacterStore.getState().loadShared({force:true})
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(10)
  const externalRefs={current:new Map([[action.id,external]])}
  await expect(complete(Promise.reject(Error('bountiful-parent:stale-original-snapshot')),action,externalRefs,useCharacterStore)).rejects.toThrow('stale-original-snapshot')
  expect(externalRefs.current.size).toBe(0)
  expect(useCharacterStore.getState().characters[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(10)
  expect((data.characters.characters as typeof characters)[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(10)
  const accepted=fresh()
  useCharacterStore.getState().applyAuthorityUpdate('second',{dnd5eCombatState:{...mover.dnd5eCombatState,schemaVersion:2,runningJumpApproachFeet:0}},{protectPatchUntilAcknowledged:true,deferSharedPublicationUntilAck:accepted})
  const finalCharacters=structuredClone(useCharacterStore.getState().characters),finalMap=structuredClone(map)
  finalMap.tokens[0].x=625
  const finalAck={id:'ack:actual-provisional-move',actionId:action.id,mapId:action.mapId,status:'accepted' as const,round:1,initiativeIndex:0,updatedAt:2000}
  const commit=publishPlayerActionAckWithSnapshots({ack:finalAck,snapshots:{characters:finalCharacters,maps:[finalMap],updatedAt:2000},expectedRevisions:{characters:data.characters._sync.revision,maps:1},commitSharedResources:async(writes,options)=>runtime.save!(writes.map(row=>({...row,expectedRevision:row.expectedRevision??data[row.name]?._sync.revision??0})),options),saveSharedResource:async()=>{throw Error('No sequential original publication')},publishAck:async()=>{}})
  const acceptedRefs={current:new Map([[action.id,accepted]])}
  await complete(commit,action,acceptedRefs,useCharacterStore)
  expect(acceptedRefs.current.size).toBe(0)
  expect((data.characters.characters as typeof characters)[0].dnd5eCombatState?.runningJumpApproachFeet).toBe(0)
  expect((data.maps.maps as BattleMap[])[0].tokens[0].x).toBe(625)
  expect(data['player-action-ack'].actionId).toBe(action.id)
 }finally{clearPendingAuthorityCharacterPatchesForTest();await new Promise(resolve=>setTimeout(resolve,100));await http.close();runtime.load=undefined;runtime.save=undefined}
})
