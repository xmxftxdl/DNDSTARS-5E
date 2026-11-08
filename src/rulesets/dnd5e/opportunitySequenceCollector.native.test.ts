import{readBountifulOpportunitySequenceProtectedOriginal}from'./bountifulOpportunitySequencePrefixWindow'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{createDnd5eMechanicalEffect}from'./activeEffects'
import{prepareDnd5eOpportunitySequenceCollectorOriginal,captureDnd5eOpportunitySequenceCollectorCheckpoint,readCapturedDnd5eOpportunitySequenceCollectorCheckpoint}from'./opportunityMoveSequence'
import {prepareDnd5eOpportunityMoveSequence,resolvePreparedDnd5eOpportunityMoveSequence,readDnd5eOpportunitySequenceRawRequest} from './opportunityMoveSequence'
import {prepareDnd5eOpportunityAttack}from'./opportunityAttackAction'
import {projectDnd5eCombatApplicationStoreState} from '../../pages/maps/combatApplicationStoreProjection'
import type {Token,BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5ePlayerMove} from './playerMoveAction'
import {findDnd5eOpportunityWindowsForMove} from './opportunityAttackAction'
import {replayDnd5ePlayerMovePrefix} from './playerMovePrefix'
import {captureBountifulOpportunityMovePrefixContext,readBountifulOpportunityMovePrefixContext} from './opportunityMovePrefixContext'
import {prepareBountifulOpportunityPlayerMoveFromPrefix} from './opportunityMoveAction'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import {createTokenMovementAnimation} from '../../lib/tokenMovementAnimation'
import {withTokenMovementPresentations} from '../../pages/maps/tokenMovementPresentation'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it.each([{label:'first of two real OA windows',target:{x:725,y:375},window:{x:525,y:375},cost:0,remaining:30,final:{x:725,y:375}}])('replays $label, OA, and remaining move while source maps and original command stay500',({target,window,cost,remaining})=>{
 const characters=[normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,roomMemberId:'first-member',currentHp:36,maxHp:36}),normalizeCharacter({id:'mover',name:'Mover',charClass:'法师',level:4,roomMemberId:'mover-member',currentHp:36,maxHp:36}),normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,roomMemberId:'helper-member',race:'半身人',dnd5eRaceId:'halfling',currentHp:36,maxHp:36})]
 characters.push(normalizeCharacter({id:'next',name:'Next',charClass:'战士',level:4,roomMemberId:'next-member',currentHp:36,maxHp:36}))
 const tokens:Token[]=[{id:'first-token',characterId:'first',label:'First',x:450,y:375,size:1,type:'player',dnd5eSide:'player',hp:36,maxHp:36,color:'',emoji:''},{id:'mover-token',characterId:'mover',label:'Mover',x:500,y:375,size:1,type:'player',dnd5eSide:'enemy',hp:36,maxHp:36,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:450,y:475,size:1,type:'player',dnd5eSide:'player',hp:36,maxHp:36,color:'',emoji:''}]
 tokens.push({id:'next-token',characterId:'next',label:'Next',x:550,y:425,size:1,type:'player',dnd5eSide:'player',hp:36,maxHp:36,color:'',emoji:''})
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens},initiativeOrder=tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economies=Object.fromEntries(tokens.map(token=>[token.id,createDnd5eTurnEconomyCounts('combat:1:'+token.id)])),turnEconomyByToken={'mover-token':economies['mover-token']}
 const action:SharedPlayerActionState={id:'actual-prefix-move',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'mover',roomMemberId:'mover-member',sourceMode:'player',status:'pending',type:'move-token',targetPosition:target,dnd5eTraversalMode:'walk',round:1,initiativeIndex:1,seq:1,updatedAt:1}
 const initial=structuredClone({map,characters}),context=captureBountifulOpportunityMovePrefixContext({action,map,characters,initiativeOrder,moverEconomy:economies['mover-token'],turnEconomyByToken,originalEconomies:economies},()=>({geometry:1,clock:1}))
 const move=prepareDnd5ePlayerMove({action,map,characters,initiativeOrder,turnEconomy:economies['mover-token']});if(!move.ok)throw Error(move.reason)
 const windows=findDnd5eOpportunityWindowsForMove({map,characters,movingToken:tokens[1],to:move.prepared.to,path:move.prepared.path,pathElevationsFeet:move.prepared.pathElevationsFeet,toElevationFeet:move.prepared.toElevationFeet,turnEconomyByToken:economies,disengaged:false,movementMode:'walk',combatContext:{combatId:'combat',round:1,initiativeOrder,initiativeIndex:1,active:true}})
 expect(windows).toHaveLength(2);expect(windows.map(row=>row.attacker.id)).toEqual(['first-token','next-token']);expect(windows[0].position).toEqual({...window,elevationFeet:0})
 const actual=replayDnd5ePlayerMovePrefix({originalInput:{action,map,characters,initiativeOrder,turnEconomy:economies['mover-token']},prepared:move.prepared,position:windows[0].position,elevationFeet:0,firstHostNow:readBountifulOpportunityMovePrefixContext(context).firstHostNow,transactionId:'player-move:'+action.id+':segment:1'})
 if(!actual.resolution.result.ok||!actual.resolution.application)throw Error('Actual prefix required')
 const animation=createTokenMovementAnimation({id:`player-move:${action.id}:segment:1:mover-token`,path:actual.prepared.path,finalPosition:window,issuedAt:readBountifulOpportunityMovePrefixContext(context).firstHostNow+100})
 const presented=withTokenMovementPresentations({application:actual.resolution.application,byTokenId:animation?{'mover-token':animation}:{}})
 const actor=actual.resolution.result.state.combatants['mover-token'],projection={...projectDnd5eCombatApplicationStoreState({map,characters,application:presented}),turnEconomyByToken:{'mover-token':projectDnd5eHeadlessTurnEconomy(economies['mover-token'],actor.turn,actor.speed)}}
 expect(actual.movementCostFeet).toBe(cost);expect(actor.turn.movementRemaining).toBe(remaining)
 expect(()=>prepareBountifulOpportunityPlayerMoveFromPrefix({...context},{attackerTokenId:'first-token',projection})).toThrow('exact-original-context-required')
 const prepared=prepareDnd5eOpportunityMoveSequence({action,map,characters,initiativeOrder,turnEconomyByToken:economies,firstHostNow:readBountifulOpportunityMovePrefixContext(context).firstHostNow})
 if(!prepared.ok)throw Error(prepared.reason)
 const collector=captureDnd5eOpportunitySequenceCollectorCheckpoint(action.id,[],()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{}}));expect(collector.status).toBe('collector');if(collector.status!=='collector')throw Error('Actual collector required')
 const firstCollector=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(collector.checkpoint);expect(firstCollector.request).toMatchObject({parentId:action.id,actorTokenId:'first-token',windowIndex:0});expect(firstCollector.attack.actorToken.id).toBe('first-token');expect(firstCollector.attack.state.combatants['first-token'].turn.reactionAvailable).toBe(true);expect(firstCollector.attack.map.tokens.find(t=>t.id==='mover-token')).toMatchObject({x:525,y:375});expect(firstCollector.source.prepared.map.tokens.find(t=>t.id==='mover-token')).toMatchObject({x:500,y:375});expect(()=>readCapturedDnd5eOpportunitySequenceCollectorCheckpoint({...collector.checkpoint})).toThrow('actual-native-collector-required')
 expect(()=>captureDnd5eOpportunitySequenceCollectorCheckpoint(action.id,['first-token'],()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{}}))).toThrow('actual-original-roll-required:first-token')
 const rolls=Object.fromEntries(['first-token','next-token'].map(id=>{const attack=prepareDnd5eOpportunityAttack({combatId:'combat',round:1,initiativeIndex:1,map,characters,initiativeOrder,actorTokenId:id,targetTokenId:'mover-token',turnEconomy:economies[id],targetTurnEconomy:economies['mover-token']});if(!attack.ok)throw Error(attack.reason);return[id,{d20:15,damageRolls:Array(attack.prepared.damage.count).fill(1)}]}))
 const nextCollector=captureDnd5eOpportunitySequenceCollectorCheckpoint(action.id,['first-token'],()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{'first-token':rolls['first-token']}}));expect(nextCollector.status).toBe('collector');if(nextCollector.status!=='collector')throw Error('Actual second collector required');const secondCollector=readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(nextCollector.checkpoint);expect(secondCollector.request).toMatchObject({actorTokenId:'next-token',windowIndex:1});expect(secondCollector.attack.state.combatants['first-token'].turn.reactionAvailable).toBe(false);expect(secondCollector.attack.state.combatants['next-token'].turn.reactionAvailable).toBe(true)
 const complete=captureDnd5eOpportunitySequenceCollectorCheckpoint(action.id,['first-token','next-token'],()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:rolls}));expect(complete.status).toBe('complete');if(complete.status!=='complete')throw Error('Actual native completion required');expect(complete.result.result.ok).toBe(true);expect(complete.result.application.map.tokens.find(t=>t.id==='mover-token')).toMatchObject({x:725,y:375})
 expect(()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:{...prepared.prepared},attacks:rolls})).toThrow('exact-native-preparer-required')
 expect(()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{}})).toThrow('actual-original-roll-required:first-token')
 let nextRequest:unknown
 try{resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{'first-token':rolls['first-token']}})}catch(error){nextRequest=readDnd5eOpportunitySequenceRawRequest(error)}
 expect(nextRequest).toMatchObject({parentId:action.id,windowIndex:1,actorTokenId:'next-token',targetTokenId:'mover-token',rollMode:'normal',originalAction:action})
 expect(readDnd5eOpportunitySequenceRawRequest(new Error('opportunity-sequence:actual-original-roll-required:next-token'))).toBeUndefined()
 const result=resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:rolls})
 expect(result.result.ok).toBe(true)
 expect(result.attacks).toEqual(['first-token','next-token'])
 expect(result.application.characters.find(row=>row.id==='mover')!.currentHp).toBeLessThan(36)
 expect(result.application.map.tokens.find(row=>row.id==='mover-token')).toMatchObject({x:725,y:375})
 expect(result.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
 expect(result.result.state.combatants['next-token'].turn.reactionAvailable).toBe(false)
 expect(result.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(true)
 expect(result.result.state.combatants['mover-token'].turn.movementRemaining).toBe(10)
 const missed=resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{...rolls,'next-token':{...rolls['next-token'],d20:1}}})
 expect(missed.attacks).toEqual(['first-token','next-token'])
 expect(missed.result.state.combatants['next-token'].turn.reactionAvailable).toBe(false)
 expect(missed.result.state.combatants['mover-token'].turn.movementRemaining).toBe(10)
 expect(missed.application.characters.find(row=>row.id==='mover')!.currentHp).toBeGreaterThan(result.application.characters.find(row=>row.id==='mover')!.currentHp)
 expect(result.originalAction).toEqual(action)

 const originalBridge=prepareDnd5eOpportunitySequenceCollectorOriginal(collector.checkpoint,{})
 expect(originalBridge.status).toBe('raw-required');if(originalBridge.status!=='raw-required')throw Error('Actual original pool required')
 expect(readDnd5eOpportunitySequenceRawRequest(originalBridge.rawCheckpoint)).toMatchObject({parentId:action.id,actorTokenId:'first-token',windowIndex:0,rollMode:'normal'})
 expect(readDnd5eOpportunitySequenceRawRequest({...originalBridge.rawCheckpoint})).toBeUndefined()
 expect(()=>prepareDnd5eOpportunitySequenceCollectorOriginal({...collector.checkpoint},{})).toThrow('actual-native-collector-required')
 const wardCharacters=characters.map(character=>character.id==='mover'?normalizeCharacter({...character,charClass:'武僧',level:11,dnd5eClassChoices:{classes:{monk:{subclass:'open-hand',selections:{}}}},dnd5eCombatState:{tranquilityActive:true}}):character)
 const wardPrepared=prepareDnd5eOpportunityMoveSequence({action,map,characters:wardCharacters,initiativeOrder,turnEconomyByToken:economies,firstHostNow:1})
 if(!wardPrepared.ok)throw Error(wardPrepared.reason)
 const wardCheckpoint=captureDnd5eOpportunitySequenceCollectorCheckpoint(action.id,[],()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:wardPrepared.prepared,attacks:{}}))
 if(wardCheckpoint.status!=='collector')throw Error('Actual ward collector required')
 expect(readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(wardCheckpoint.checkpoint).attack.tranquilityWard).toBeDefined()
 expect(()=>prepareDnd5eOpportunitySequenceCollectorOriginal(wardCheckpoint.checkpoint,{})).toThrow('native-pre-original-gate-rejected')
 const blocked=prepareDnd5eOpportunitySequenceCollectorOriginal(wardCheckpoint.checkpoint,{tranquilitySave:{d20:1}})
 expect(blocked).toEqual({status:'no-original-required'});expect(readDnd5eOpportunitySequenceRawRequest(blocked)).toBeUndefined()

 const declined=resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{'first-token':{reactionDecision:'decline'},'next-token':rolls['next-token']}})
 expect(declined.result.ok).toBe(true);expect(declined.result.state.combatants['first-token'].turn.reactionAvailable).toBe(true);expect(declined.result.state.combatants['next-token'].turn.reactionAvailable).toBe(false);expect(declined.result.events.filter(event=>event.type==='attack-resolved')).toHaveLength(1);expect(declined.result.events.some(event=>event.type==='attack-resolved'&&event.actorId==='first-token')).toBe(false)
 const untouched=resolvePreparedDnd5eOpportunityMoveSequence({prepared:prepared.prepared,attacks:{'first-token':{reactionDecision:'decline'},'next-token':{reactionDecision:'decline'}}})
 expect(untouched.result.ok).toBe(true);expect(untouched.result.events.some(event=>event.type==='attack-resolved')).toBe(false);expect(untouched.result.state.combatants['first-token'].turn.reactionAvailable).toBe(true);expect(untouched.result.state.combatants['next-token'].turn.reactionAvailable).toBe(true);expect(untouched.result.state.combatants['mover-token'].currentHp).toBe(36);expect(untouched.result.state.combatants['mover-token'].turn.movementRemaining).toBe(10);expect(untouched.application.map.tokens.find(token=>token.id==='mover-token')).toMatchObject({x:725,y:375})
 const forcedCharacters=characters.map(character=>character.id==='first'?normalizeCharacter({...character,dnd5eCombatState:{activeEffects:[createDnd5eMechanicalEffect({definitionId:'test:actual-mandatory-oa',label:'Mandatory opportunity',targetId:'first-token',source:{kind:'spell',actorId:'helper-token'},modifiers:{mandatoryOpportunityAttacks:true}})]}}):character)
 const forced=prepareDnd5eOpportunityMoveSequence({action,map,characters:forcedCharacters,initiativeOrder,turnEconomyByToken:economies,firstHostNow:1});if(!forced.ok)throw Error(forced.reason)
 const forcedCheckpoint=captureDnd5eOpportunitySequenceCollectorCheckpoint(action.id,[],()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:forced.prepared,attacks:{}}));if(forcedCheckpoint.status!=='collector')throw Error('Actual forced window required');expect(readCapturedDnd5eOpportunitySequenceCollectorCheckpoint(forcedCheckpoint.checkpoint).request.mandatory).toBe(true)
 expect(()=>resolvePreparedDnd5eOpportunityMoveSequence({prepared:forced.prepared,attacks:{'first-token':{reactionDecision:'decline'},'next-token':{reactionDecision:'decline'}}})).toThrow('mandatory-opportunity-cannot-decline')

 const contradictoryBook={source:encodeSecondChanceParentWire({prepared:prepared.prepared}),prefixSource:encodeSecondChanceParentWire({prepared:prepared.prepared,transactionId:action.id,attacks:{'first-token':{reactionDecision:'decline'}},hostOriginalOpportunityRolls:[]}),prefixSettlementRolls:[],rows:[{actorId:'first-token',requestId:'not-an-actual-original',originalIssuer:{mode:'player' as const,cursor:1},confirmed:{values:[15]}}]}
 expect(()=>readBountifulOpportunitySequenceProtectedOriginal(contradictoryBook,action.id)).toThrow('declined-window-has-no-original')
 expect({map,characters}).toEqual(initial)
})
