import {normalizeDnd5eActiveEffects}from'./activeEffects'
import {resolveDnd5eHeadlessAction}from'./headlessCombatEngine'
import {it,expect,vi}from'vitest'
import {normalizeCharacter}from'../../store/characters'
import {prepareDnd5eLocalContentJson}from'./localContentCollection'
import {registerDnd5eRulesPlugin}from'./pluginApi'
import {dnd5eRulesPluginFromContentPackageV2}from'./contentPackageV2'
import {bountifulLuckTestContent}from'./bountifulLuckTestContent'
import {prepareDnd5eOpportunityPlayerMove,resolvePreparedDnd5eOpportunityPlayerMove}from'./opportunityMoveAction'
import {createDnd5eTurnEconomyCounts}from'./turnEconomy'
import {resolveDnd5ePreparedWithMaterialDamageReactions,resolveDnd5eActionWithMaterialDamageReactions}from'./damageReactionFlow'
import {createDnd5eMovementHazardsProducer,runIssuedDnd5eMovementHazardsProducer}from'../../pages/maps/movementHazardsProducer'
import {dnd5ePersistentAreaTurnKey}from'../../pages/maps/persistentAreaTurnBoundary'
import type{SharedPlayerActionState}from'../../lib/sharedCombatTypes'
import type{BattleMap}from'../../store/maps'
vi.mock('../../lib/roomSession',()=>({getRoomSession:()=>({roomId:'room',memberId:'host',role:'dm'})}))
it.each([false,true])('executes concrete OA/movement and actual caltrops damage=%s, preserving Lucky expiry',async(withHazard)=>{
 const {package:pkg}=await prepareDnd5eLocalContentJson(bountifulLuckTestContent),dispose=registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
 try{
 const helper=normalizeCharacter({id:'helper',name:'Helper',charClass:'战士',level:4,race:'半身人',dnd5eRaceId:'halfling',roomMemberId:'helper-member',dnd5eFeatIds:[pkg.manifest.id+':bountiful-luck'],currentHp:30,maxHp:30})
 const attacker=normalizeCharacter({id:'first',name:'First',charClass:'战士',level:4,race:'人类',roomMemberId:'first-member',currentHp:30,maxHp:30})
 const mover=normalizeCharacter({id:'second',name:'Mover',charClass:'法师',level:4,race:'人类',roomMemberId:'second-member',currentHp:30,maxHp:30}),characters=[helper,attacker,mover]
 const map:BattleMap={id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,tokens:[{id:'first-token',characterId:'first',label:'First',x:25,y:25,size:1,type:'player',dnd5eSide:'player',hp:30,maxHp:30,color:'',emoji:''},{id:'mover-token',characterId:'second',label:'Mover',x:75,y:25,size:1,type:'player',dnd5eSide:'enemy',hp:30,maxHp:30,color:'',emoji:''},{id:'helper-token',characterId:'helper',label:'Helper',x:25,y:125,size:1,type:'player',dnd5eSide:'player',color:'',emoji:''}]}
 if(withHazard)map.dnd5eItemAreas=[{id:'actual-caltrops',kind:'caltrops',sourceCharacterId:'first',sourceTokenId:'first-token',sourceItemTemplateId:'caltrops',sourceItemName:'Caltrops',cells:[{col:2,row:0}],createdAt:1,armed:true}]
 const initiativeOrder=map.tokens.map((token,index)=>({tokenId:token.id,label:token.label,emoji:'',color:'',roll:20-index})),economy=createDnd5eTurnEconomyCounts('combat:1:first-token'),moverEconomy=createDnd5eTurnEconomyCounts('combat:1:mover-token')
 const command:SharedPlayerActionState={id:'real-move-original',mapId:'map',combatId:'combat',sourceMode:'player',status:'pending',type:'move-token',actorTokenId:'mover-token',characterId:'second',roomMemberId:'second-member',targetPosition:{x:175,y:25},round:1,initiativeIndex:1,seq:1,updatedAt:1}

 const prepared=prepareDnd5eOpportunityPlayerMove({action:command,map,characters,initiativeOrder,moverEconomy,attackerEconomy:economy,attackerTokenId:'first-token'})
 expect(prepared.ok).toBe(true);if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.action).toBe(command);expect('action' in prepared.prepared.opportunity).toBe(false)

 const physical={prepared:prepared.prepared,transactionId:command.id,opportunity:{d20:1,damageRolls:Array(prepared.prepared.opportunity.damage.count).fill(1)}}
 const resolved=await resolveDnd5ePreparedWithMaterialDamageReactions({combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:async()=>{throw Error('No added damage dice')},chooseAllyNaturalOne:async({request})=>({...request.options[0],replacement:15})},physical,resolvePreparedDnd5eOpportunityPlayerMove)
 if(!resolved.result.ok||!resolved.application)throw Error('Actual composed result required')
 const unexpected=(..._input:unknown[]):never=>{throw Error('No unrelated movement callback expected')}
 const producer=createDnd5eMovementHazardsProducer({rollDiceBoxValues:unexpected,
requestDnd5ePersistentAreaWillingFailure:unexpected,
combatActiveRef:{current:true},
initiativeOrderRef:{current:initiativeOrder},
combatIdRef:{current:'combat'},
rollDnd5eMapSavingThrowInterrupts:unexpected,
requestSharedChoiceWindow:unexpected,
collectDnd5ePersistentAreaRolls:unexpected,
requestSharedPersistentAreaAdjudication:unexpected,
roundRef:{current:1},
initiativeIndexRef:{current:1},
rollTempleEntryEffectDice:unexpected,
rollOpeningAttackSavingThrow:unexpected,
publishDnd5ePersistentAreaSaveResult:unexpected,
settleDnd5eConcentrationChecks:unexpected,
rollDnd5eUnsupportedAirborneFalls:unexpected,
settleDnd5eMapMountedBalance:unexpected,
rollDiceBoxD20:unexpected,
requestSharedHellishRebukeChoice:unexpected,
collectSharedSpellDamageDieChoices:unexpected,
requestDnd5eSavingThrowRerollDice:unexpected,
requestDnd5eBardicInspirationRoll:unexpected,
requestDnd5eOptionalBonusDieUse:unexpected,
requestDnd5eDarkOnesOwnLuckRoll:unexpected,
requestSharedPostSpellRandomTableChoice:unexpected,
requestSharedPostSpellRandomTableAdjudication:unexpected,
updateDnd5eTurnEconomy:unexpected,
rollDiceBoxD20Pair:async(label)=>{expect(withHazard).toBe(true);expect(label).toContain('敏捷豁免');return [2,undefined]},
deferNativeLuckyForBountifulOnMap:unexpected,
resolveDnd5eHeadlessActionWithAirborneFalls:async(state,action,_map,options,material)=>{
 expect(action.type).toBe('item-area-trigger')
 const result=await resolveDnd5eActionWithMaterialDamageReactions({state,action,options,combatRevision:1,authorityUnchanged:()=>true,confirm:async()=>({accepted:false}),roll:unexpected},material)
 return result
},
currentPersistentAreaTurnKey:(round:number,tokenId:string)=>dnd5ePersistentAreaTurnKey({round,slotId:'',tokenId}),
resolveDnd5eForcedFallInterrupts:unexpected,
damageReactionOptionsForMap:unexpected,
initiativeOrderForHeadlessState:unexpected,
requestOptionalDamageSave:unexpected})
 const hazardInput={state:resolved.result.state,map,characters:resolved.application.characters,characterIdByCombatantId:prepared.prepared.characterIdByCombatantId,movements:prepared.prepared.movement.movementTraces,settleSolidMaterialEndpoint:true}
 expect(()=>runIssuedDnd5eMovementHazardsProducer({...producer},hazardInput)).toThrow('actual-producer-required')
 const hazards=await runIssuedDnd5eMovementHazardsProducer(producer,hazardInput)
 expect(hazards.state.combatants['first-token'].turn.reactionAvailable).toBe(false)
 expect(hazards.state.combatants['helper-token'].turn.reactionAvailable).toBe(false)
 expect(hazards.state.combatants['mover-token'].turn.movementRemaining).toBe(resolved.result.state.combatants['mover-token'].turn.movementRemaining)
 expect(hazards.application.map.tokens.find(row=>row.id==='mover-token')?.x).toBe(withHazard?125:175)
 expect(hazards.application.characters.find(row=>row.id==='second')?.currentHp).toBe(resolved.application.characters.find(row=>row.id==='second')!.currentHp-(withHazard?1:0))
 expect(hazards.state.combatants['helper-token'].classState.activeEffects).toEqual(normalizeDnd5eActiveEffects(resolved.result.state.combatants['helper-token'].classState.activeEffects))
 const ownerTurn=resolveDnd5eHeadlessAction(hazards.state,{type:'end-turn',actorId:'mover-token'})
 expect(ownerTurn.ok).toBe(true);if(!ownerTurn.ok)throw Error(ownerTurn.reason)
 expect(ownerTurn.state.combatants['helper-token'].classState.activeEffects?.some(effect=>effect.tags?.includes('bountiful-luck:racial-lucky-suppressed'))).toBe(true)
 const ownerEnd=resolveDnd5eHeadlessAction(ownerTurn.state,{type:'end-turn',actorId:'helper-token'})
 expect(ownerEnd.ok).toBe(true);if(!ownerEnd.ok)throw Error(ownerEnd.reason)
 expect((ownerEnd.state.combatants['helper-token'].classState.activeEffects??[]).some(effect=>effect.tags?.includes('bountiful-luck:racial-lucky-suppressed'))).toBe(false)
 if(withHazard)expect(hazards.logs.some(row=>row.includes('铁蒺藜')&&row.includes('失败'))).toBe(true)
 else expect(hazards.logs).toEqual([])
 expect(map.tokens.find(row=>row.id==='mover-token')?.x).toBe(75)
 }finally{dispose()}
})
