import {projectDnd5eCombatApplicationStoreState} from '../../pages/maps/combatApplicationStoreProjection'
import type {Token,BattleMap} from '../../store/maps'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5ePlayerMove} from './playerMoveAction'
import {findDnd5eOpportunityWindowsForMove} from './opportunityAttackAction'
import {replayDnd5ePlayerMovePrefix} from './playerMovePrefix'
import {captureBountifulOpportunityMovePrefixContext,readBountifulOpportunityMovePrefixContext} from './opportunityMovePrefixContext'
import {prepareBountifulOpportunityPlayerMoveFromPrefix,readIssuedBountifulOpportunityPrefixProjection,resolvePreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {createBountifulOpportunityMoveLocalAuthority} from './bountifulOpportunityMoveAck'
import {createDnd5eTurnEconomyCounts,projectDnd5eHeadlessTurnEconomy} from './turnEconomy'
import {createTokenMovementAnimation} from '../../lib/tokenMovementAnimation'
import {withTokenMovementPresentations} from '../../pages/maps/tokenMovementPresentation'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it.each([{label:'zero-cost centering',target:{x:625,y:375},window:{x:525,y:375},cost:0,remaining:30,final:{x:625,y:375}},{label:'five-foot travelled prefix',target:{x:500,y:475},window:{x:525,y:425},cost:5,remaining:25,final:{x:525,y:475}}])('replays $label, OA, and remaining move while source maps and original command stay500',({target,window,cost,remaining,final})=>{
 const characters=[normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,roomMemberId:'first-member',currentHp:36,maxHp:36}),normalizeCharacter({id:'mover',name:'Mover',charClass:'法师',level:4,roomMemberId:'mover-member',currentHp:36,maxHp:36}),normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,roomMemberId:'helper-member',race:'半身人',dnd5eRaceId:'halfling',currentHp:36,maxHp:36})]
 const tokens:Token[]=[{id:'first-token',characterId:'first',label:'First',x:450,y:375,size:1,type:'player',dnd5eSide:'player',hp:36,maxHp:36,color:'',emoji:''},{id:'mover-token',characterId:'mover',label:'Mover',x:500,y:375,size:1,type:'player',dnd5eSide:'enemy',hp:36,maxHp:36,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:450,y:475,size:1,type:'player',dnd5eSide:'player',hp:36,maxHp:36,color:'',emoji:''}]
 const map:BattleMap={id:'map',name:'Map',width:1000,height:1000,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens},initiativeOrder=tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economies=Object.fromEntries(tokens.map(token=>[token.id,createDnd5eTurnEconomyCounts('combat:1:'+token.id)])),turnEconomyByToken={'mover-token':economies['mover-token']}
 const action:SharedPlayerActionState={id:'actual-prefix-move',mapId:'map',combatId:'combat',actorTokenId:'mover-token',characterId:'mover',roomMemberId:'mover-member',sourceMode:'player',status:'pending',type:'move-token',targetPosition:target,dnd5eTraversalMode:'walk',round:1,initiativeIndex:1,seq:1,updatedAt:1}
 const initial=structuredClone({map,characters}),context=captureBountifulOpportunityMovePrefixContext({action,map,characters,initiativeOrder,moverEconomy:economies['mover-token'],turnEconomyByToken,originalEconomies:economies},()=>({geometry:1,clock:1}))
 const move=prepareDnd5ePlayerMove({action,map,characters,initiativeOrder,turnEconomy:economies['mover-token']});if(!move.ok)throw Error(move.reason)
 const windows=findDnd5eOpportunityWindowsForMove({map,characters,movingToken:tokens[1],to:move.prepared.to,path:move.prepared.path,pathElevationsFeet:move.prepared.pathElevationsFeet,toElevationFeet:move.prepared.toElevationFeet,turnEconomyByToken:economies,disengaged:false,movementMode:'walk',combatContext:{combatId:'combat',round:1,initiativeOrder,initiativeIndex:1,active:true}})
 expect(windows).toHaveLength(1);expect(windows[0].position).toEqual({...window,elevationFeet:0})
 const actual=replayDnd5ePlayerMovePrefix({originalInput:{action,map,characters,initiativeOrder,turnEconomy:economies['mover-token']},prepared:move.prepared,position:windows[0].position,elevationFeet:0,firstHostNow:readBountifulOpportunityMovePrefixContext(context).firstHostNow,transactionId:'player-move:'+action.id+':segment:1'})
 if(!actual.resolution.result.ok||!actual.resolution.application)throw Error('Actual prefix required')
 const animation=createTokenMovementAnimation({id:`player-move:${action.id}:segment:1:mover-token`,path:actual.prepared.path,finalPosition:window,issuedAt:readBountifulOpportunityMovePrefixContext(context).firstHostNow+100})
 const presented=withTokenMovementPresentations({application:actual.resolution.application,byTokenId:animation?{'mover-token':animation}:{}})
 const actor=actual.resolution.result.state.combatants['mover-token'],projection={...projectDnd5eCombatApplicationStoreState({map,characters,application:presented}),turnEconomyByToken:{'mover-token':projectDnd5eHeadlessTurnEconomy(economies['mover-token'],actor.turn,actor.speed)}}
 expect(actual.movementCostFeet).toBe(cost);expect(actor.turn.movementRemaining).toBe(remaining)
 expect(()=>prepareBountifulOpportunityPlayerMoveFromPrefix({...context},{attackerTokenId:'first-token',projection})).toThrow('exact-original-context-required')
 const forged=structuredClone(projection);forged.characters.find(row=>row.id==='mover')!.currentHp--
 expect(()=>prepareBountifulOpportunityPlayerMoveFromPrefix(context,{attackerTokenId:'first-token',projection:forged})).toThrow('actual-native-prefix-projection-required')
 const prepared=prepareBountifulOpportunityPlayerMoveFromPrefix(context,{attackerTokenId:'first-token',projection});if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.action).toBe(action);expect(readIssuedBountifulOpportunityPrefixProjection(prepared.prepared)).toEqual(projection)
 const facts=prepared.prepared
 expect(facts.map.tokens.find(row=>row.id==='mover-token')?.x).toBe(500);expect(facts.movement.map).toEqual(facts.map);expect(facts.opportunity.map).toEqual(facts.map);expect(facts.opportunity.targetToken.x).toBe(500);expect(facts.action).toEqual(action)
 const local=createBountifulOpportunityMoveLocalAuthority({prepared:prepared.prepared,readProjection:()=>projection,readAnchors:()=>({geometry:1,clock:1})});expect(local.authorityUnchanged()).toBe(true)
 const opportunity={d20:15,damageRolls:Array(prepared.prepared.opportunity.damage.count).fill(1)}
 const prefix=resolvePreparedDnd5eOpportunityPlayerMove({prepared:prepared.prepared,transactionId:action.id,stage:'opportunity',opportunity});expect(prefix.result.ok).toBe(true);expect(prefix.application?.map.tokens.find(row=>row.id==='mover-token')).toMatchObject(window);expect(prefix.application?.characters.find(row=>row.id==='mover')?.currentHp).toBeLessThan(36)
 const complete=resolvePreparedDnd5eOpportunityPlayerMove({prepared:prepared.prepared,transactionId:action.id,opportunity});expect(complete.result.ok).toBe(true);expect(complete.application?.map.tokens.find(row=>row.id==='mover-token')).toMatchObject(final);expect(complete.result.state.combatants['mover-token'].turn.movementRemaining).toBe(20);expect(complete.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
 expect({map,characters}).toEqual(initial)
})
