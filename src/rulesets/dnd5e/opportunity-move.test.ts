import {it,expect,vi} from 'vitest'
import {normalizeCharacter} from '../../store/characters'
import {prepareDnd5eLocalContentJson} from './localContentCollection'
import {registerDnd5eRulesPlugin} from './pluginApi'
import {dnd5eRulesPluginFromContentPackageV2} from './contentPackageV2'
import {bountifulLuckTestContent} from './bountifulLuckTestContent'
import {prepareDnd5eOpportunityPlayerMove,resolvePreparedDnd5eOpportunityPlayerMove} from './opportunityMoveAction'
import {createDnd5eTurnEconomyCounts} from './turnEconomy'
import {createDnd5eOriginalD20Session} from './damageCommitSession'
import {resolveDnd5ePreparedWithMaterialDamageReactions} from './damageReactionFlow'
import type {SharedPlayerActionState} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it('composes actual legal OA original-one and moving-player facades without committing either stage early',async()=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
 const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30})
 const attacker=normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,race:'人类',roomMemberId:'first-member',currentHp:30,maxHp:30})
 const mover=normalizeCharacter({id:'second',name:'Mover',charClass:'法师',level:4,race:'人类',roomMemberId:'second-member',currentHp:30,maxHp:30}),characters=[helper,attacker,mover]
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'first-token',characterId:'first',label:'First',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'mover-token',characterId:'second',label:'Mover',x:75,y:25,size:1,type:'player',dnd5eSide:'enemy',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:125,size:1,type:'player',dnd5eSide:'player',color:'',emoji:''}]}
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:first-token'),moverEconomy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
 const command:SharedPlayerActionState={id:'real-move-original',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'move-token',actorTokenId:'mover-token',characterId:'second',roomMemberId:'second-member',targetPosition:{x:175,y:25},round:1,initiativeIndex:1,seq:1,updatedAt:1}

 const prepared=prepareDnd5eOpportunityPlayerMove({action:command,map,characters,initiativeOrder,moverEconomy,attackerEconomy:economy,attackerTokenId:'first-token'})
 expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.action).toBe(command);expect('action' in prepared.prepared.opportunity).toBe(false)
 const source={prepared:prepared.prepared,transactionId:command.id,opportunity:{d20:1,damageRolls:Array(prepared.prepared.opportunity.damage.count).fill(1)}}
 const session=createDnd5eOriginalD20Session(source,resolvePreparedDnd5eOpportunityPlayerMove,'first-token','attack')
 try{const pending=session.run(prepared.prepared.state);expect(pending.status).toBe('pending-ally-natural-one');if(pending.status!=='pending-ally-natural-one')throw Error('Actual OA original-one required');expect(pending.request).toMatchObject({actorId:'first-token',originalRolls:[1],options:[{ownerId:'helper-token'}]});expect(map.tokens.find(token=>token.id==='mover-token')?.x).toBe(75)}finally{session.cancel()}
 let choices=0
 const result=await resolveDnd5ePreparedWithMaterialDamageReactions({combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('No additional dice expected')},chooseAllyNaturalOne:async({request})=>{expect(request.actorId).toBe('first-token');choices++;return {...request.options[0],replacement:15}}},source,resolvePreparedDnd5eOpportunityPlayerMove)
 expect(result.result.ok).toBe(true);if(!result.result.ok||!result.application)throw Error('Actual composed material result required')
 expect(choices).toBe(1);expect(result.application.map.tokens.find(token=>token.id==='mover-token')?.x).toBe(175)
 expect(result.result.state.combatants['first-token'].turn.reactionAvailable).toBe(false);expect(result.result.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
 expect(result.application.characters.find(character=>character.id==='second')?.currentHp).toBeLessThan(30)
 expect(result.result.events.filter(event=>event.type==='ally-natural-one-rerolled')).toHaveLength(1)
 expect(map.tokens.find(token=>token.id==='mover-token')?.x).toBe(75);expect(characters.find(character=>character.id==='second')?.currentHp).toBe(30)
 const spent=createDnd5eTurnEconomyCounts('combat:1:helper-token');spent.reaction.current=0;spent.action.current=0;spent.movement.current=5
 const unavailable=prepareDnd5eOpportunityPlayerMove({action:command,map,characters,initiativeOrder,moverEconomy,attackerEconomy:economy,attackerTokenId:'first-token',turnEconomyByToken:{'helper-token':spent}})
 if(!unavailable.ok)throw Error(unavailable.reason)
 const unavailableSession=createDnd5eOriginalD20Session({...source,prepared:unavailable.prepared},resolvePreparedDnd5eOpportunityPlayerMove,'first-token','attack')
 try{const completed=unavailableSession.run(unavailable.prepared.state);expect(completed.status).toBe('original-d20-ready');if(completed.status!=='original-d20-ready')throw Error('Spent ally must not gain a reaction window');expect(completed.snapshot.combatants['helper-token'].turn).toMatchObject({actionAvailable:false,reactionAvailable:false,movementRemaining:5})}finally{unavailableSession.cancel()}
 }finally{dispose()}
})
