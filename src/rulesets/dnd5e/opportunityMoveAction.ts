import {readBountifulOpportunityMovePrefixContext} from './opportunityMovePrefixContext'
import {replayDnd5eOpportunityMovePrefix,type Dnd5eOpportunityMovePrefixSpec} from './opportunityMovePrefix'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import {durableD20RollId} from '../../lib/rollConfirmation'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {getRoomSession} from '../../lib/roomSession'
import type {SharedPlayerActionState,Dnd5eTurnEconomyCounts} from '../../lib/sharedCombatTypes'
import type {BattleMap} from '../../store/maps'
import type {Character} from '../../types/character'
import type {InitiativeEntry} from '../../components/map/InitiativeTracker'
import {cloneDnd5eHostTransactionInput} from './hostTransactionClone'
import {spendDnd5eMovement} from './turnEconomy'
import {dnd5eCanActAtZeroHitPoints} from './headlessCombatEngine'
import {prepareDnd5ePlayerMove,resolvePreparedDnd5ePlayerMove,type PreparedDnd5ePlayerMove} from './playerMoveAction'
import {prepareDnd5eOpportunityAttack,resolvePreparedDnd5eOpportunityAttack,findDnd5eOpportunityWindowsForMove,dnd5eOpportunityAttackModeResolution,stageDnd5eOpportunityNegation,type PreparedDnd5eOpportunityAttack} from './opportunityAttackAction'
import {planDnd5eMapResultApplication,type Dnd5eMapResultPlan} from './mapBridge'
import type {Dnd5eActionResult,Dnd5eHeadlessCombatState} from './headlessCombatEngine'

type MoveInput=Parameters<typeof resolvePreparedDnd5ePlayerMove>[0]
type AttackInput=Parameters<typeof resolvePreparedDnd5eOpportunityAttack>[0]
type OriginalChoices=Pick<AttackInput,'tranquilitySave'|'areaAttackAdvantageReaction'|'disadvantageNegationChoice'>
export interface PreparedDnd5eOpportunityPlayerMove{
 action:SharedPlayerActionState;map:BattleMap;characters:readonly Character[];state:Dnd5eHeadlessCombatState;characterIdByCombatantId:Record<string,string>
 prefix?:Dnd5eOpportunityMovePrefixSpec;originalChoices?:OriginalChoices;transactionNow:number;rawMode:'normal'|'advantage'|'disadvantage';movement:PreparedDnd5ePlayerMove;opportunity:PreparedDnd5eOpportunityAttack;initiativeOrder:readonly InitiativeEntry[]
 moverEconomy:Dnd5eTurnEconomyCounts;attackerEconomy:Dnd5eTurnEconomyCounts;turnEconomyByToken?:Readonly<Record<string,Dnd5eTurnEconomyCounts>>
}
const issuers=new WeakMap<PreparedDnd5eOpportunityPlayerMove,string>()
export function readIssuedDnd5eOpportunityPlayerMove(prepared:PreparedDnd5eOpportunityPlayerMove){const host=getRoomSession();if(host?.role!=='dm'||issuers.get(prepared)!==JSON.stringify(encodeSecondChanceParentWire(prepared)))throw Error('opportunity-move:actual-host-preparer-required');return cloneDnd5eHostTransactionInput(prepared)}

/** A bounded one-opportunity composite of the two existing real facades. The
 * queued command remains the moving player's actual move. The other creature's
 * attack never receives a fabricated player action or a separate world commit.
 * More than one actual window is explicitly not supported by this first slice. */
export type Dnd5eOpportunityPlayerMoveInput={action:SharedPlayerActionState;map:BattleMap;characters:readonly Character[];initiativeOrder:readonly InitiativeEntry[];moverEconomy:Dnd5eTurnEconomyCounts;attackerEconomy:Dnd5eTurnEconomyCounts;attackerTokenId:string;turnEconomyByToken?:Readonly<Record<string,Dnd5eTurnEconomyCounts>>;originalChoices?:OriginalChoices}
export function prepareDnd5eOpportunityPlayerMove(input:Dnd5eOpportunityPlayerMoveInput){return prepareOpportunityPlayerMoveAtCapturedTime(input,Date.now())}
function prepareOpportunityPlayerMoveAtCapturedTime(input:Dnd5eOpportunityPlayerMoveInput,transactionNow:number,prefix?:Dnd5eOpportunityMovePrefixSpec){
 const move=prepareDnd5ePlayerMove({action:input.action,map:input.map,characters:input.characters,initiativeOrder:input.initiativeOrder,turnEconomy:input.moverEconomy})
 if(!move.ok)return move
 const prepared=move.prepared,windows=findDnd5eOpportunityWindowsForMove({map:input.map,characters:input.characters,movingToken:prepared.actorToken,to:prepared.to,path:prepared.path,pathElevationsFeet:prepared.pathElevationsFeet,toElevationFeet:prepared.toElevationFeet,turnEconomyByToken:{...input.turnEconomyByToken,[input.attackerTokenId]:input.attackerEconomy},combatContext:{combatId:prepared.state.combatId,round:prepared.state.round,initiativeIndex:prepared.state.initiativeIndex,initiativeOrder:input.initiativeOrder,active:true}})
 if(windows.length!==1||windows[0].attacker.id!==input.attackerTokenId)return {ok:false as const,reason:'one-current-opportunity-window-required' as const}
 if(prefix&&(prefix.position.x!==windows[0].position.x||prefix.position.y!==windows[0].position.y||Math.abs(prefix.elevationFeet-(windows[0].position.elevationFeet??0))>0.001))return {ok:false as const,reason:'actual-original-prefix-window-required' as const}
 const attack=prepareDnd5eOpportunityAttack({combatId:prepared.state.combatId,round:prepared.state.round,initiativeIndex:prepared.state.initiativeIndex,map:input.map,characters:input.characters,initiativeOrder:input.initiativeOrder,actorTokenId:input.attackerTokenId,targetTokenId:prepared.actorToken.id,turnEconomy:input.attackerEconomy,targetTurnEconomy:input.moverEconomy})
 if(!attack.ok)return attack
 for(const [id,economy]of Object.entries(input.turnEconomyByToken??{})){
  if(id===input.attackerTokenId&&JSON.stringify(economy)!==JSON.stringify(input.attackerEconomy)||id===prepared.actorToken.id&&JSON.stringify(economy)!==JSON.stringify(input.moverEconomy))return {ok:false as const,reason:'conflicting-original-turn-economy' as const}
  const combatant=attack.prepared.state.combatants[id]
  if(combatant)combatant.turn={actionAvailable:economy.action.current>0,bonusActionAvailable:economy.bonusAction.current>0,reactionAvailable:economy.reaction.current>0,movementRemaining:economy.movement.current}
 }
 let modePrepared=input.originalChoices?.areaAttackAdvantageReaction?{...attack.prepared,areaAttackAdvantageReaction:input.originalChoices.areaAttackAdvantageReaction}:attack.prepared
 if(input.originalChoices?.disadvantageNegationChoice){try{modePrepared=stageDnd5eOpportunityNegation(modePrepared,input.originalChoices.disadvantageNegationChoice,input.originalChoices.tranquilitySave?.rerollD20!=null?1:0)}catch{return {ok:false as const,reason:'invalid-original-opportunity-negation' as const}}}
 const rawMode=dnd5eOpportunityAttackModeResolution(modePrepared).mode
 const composite={...(prefix?{prefix:cloneDnd5eHostTransactionInput(prefix)}:{}),transactionNow,rawMode,originalChoices:cloneDnd5eHostTransactionInput(input.originalChoices),action:input.action,map:input.map,characters:input.characters,state:attack.prepared.state,characterIdByCombatantId:attack.prepared.characterIdByCombatantId,movement:prepared,opportunity:attack.prepared,initiativeOrder:input.initiativeOrder,moverEconomy:input.moverEconomy,attackerEconomy:input.attackerEconomy,turnEconomyByToken:cloneDnd5eHostTransactionInput(input.turnEconomyByToken)} satisfies PreparedDnd5eOpportunityPlayerMove
 if(prefix){
  // Seed only the genuine original turn facts before the pure native prefix.
  // No post-hazard or caller-supplied replacement state is admitted.
  for(const [id,before]of Object.entries(composite.state.combatants)){
   const actor=composite.movement.state.combatants[id];if(!actor)return {ok:false as const,reason:'original-prefix-combatants-changed' as const}
   actor.turn=cloneDnd5eHostTransactionInput(before.turn)
  }
  const derived=replayPreparedOpportunityPrefix(composite)
  if(!derived)return {ok:false as const,reason:'actual-original-prefix-required' as const}
  let current=input.originalChoices?.areaAttackAdvantageReaction?{...derived.attack,areaAttackAdvantageReaction:input.originalChoices.areaAttackAdvantageReaction}:derived.attack
  if(input.originalChoices?.disadvantageNegationChoice)current=stageDnd5eOpportunityNegation(current,input.originalChoices.disadvantageNegationChoice,input.originalChoices.tranquilitySave?.rerollD20!=null?1:0)
  composite.rawMode=dnd5eOpportunityAttackModeResolution(current).mode
 }
 if(getRoomSession()?.role==='dm')issuers.set(composite,JSON.stringify(encodeSecondChanceParentWire(composite)))
 return {ok:true as const,prepared:composite}
}
export function resolvePreparedDnd5eOpportunityPlayerMove(input:{prepared:PreparedDnd5eOpportunityPlayerMove;transactionId:string;stage?:'opportunity';opportunity:Omit<AttackInput,'prepared'>;movement?:Omit<MoveInput,'prepared'|'transactionId'>}):{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan;movementPrepared?:PreparedDnd5ePlayerMove;movementInterrupted?:'mover-defeated'}{
 const parent=input.prepared
 // This slice intentionally follows the current Maps attack-before-move rule.
 // It does not invent a second move/turn or bypass either actual facade.
 const prefix=replayPreparedOpportunityPrefix(parent)
 const attack=resolvePreparedDnd5eOpportunityAttack({...parent.originalChoices,...input.opportunity,transactionId:'player-move:'+parent.action.id+':opportunity:'+parent.opportunity.actorToken.id+':0',transactionNow:parent.transactionNow,prepared:{...(prefix?.attack??parent.opportunity),state:cloneDnd5eHostTransactionInput(prefix?.resolution.result.state??parent.state)}})
 if(!attack.result.ok||!attack.application||input.stage==='opportunity')return attack
 const target=attack.result.state.combatants[parent.action.actorTokenId]
 if(!target)return {result:{ok:false,state:parent.state,events:[],reason:'invalid-target'}}
 if(target.currentHp<=0&&!dnd5eCanActAtZeroHitPoints(target)){
  // The existing moving-player caller charges the validated intended move
  // when its OA defeats the mover, while leaving the original position intact.
  const spent=spendDnd5eMovement(parent.moverEconomy,parent.movement.movementCostFeet)
  if(!spent.ok)return {result:{ok:false,state:parent.state,events:[],reason:'insufficient-movement'}}
  const state=cloneDnd5eHostTransactionInput(attack.result.state)
  state.combatants[parent.action.actorTokenId].turn.movementRemaining=spent.economy.movement.current
  const result={...attack.result,state}
  return {result,movementInterrupted:'mover-defeated',application:planDnd5eMapResultApplication({state,map:parent.map,characters:parent.characters,characterIdByCombatantId:parent.characterIdByCombatantId,events:[...result.events]})}
 }
 const after=prepareDnd5ePlayerMove({action:parent.action,map:attack.application.map,characters:attack.application.characters,initiativeOrder:parent.initiativeOrder,turnEconomy:prefix?.moverEconomy??parent.moverEconomy})
 if(!after.ok)return {result:{ok:false,state:parent.state,events:[],reason:'invalid-target'}}
 // Only the real attack's state may continue. No external replacement state or
 // public marker enters this seam; costs and BL suspension survive re-projection.
 const moved=resolvePreparedDnd5ePlayerMove({...input.movement,transactionId:input.transactionId,prepared:{...after.prepared,state:cloneDnd5eHostTransactionInput(attack.result.state)}})
 if(!moved.result.ok)return moved
 const result={...moved.result,events:[...attack.result.events,...moved.result.events]}
 return {result,movementPrepared:after.prepared,application:planDnd5eMapResultApplication({state:result.state,map:parent.map,characters:parent.characters,characterIdByCombatantId:parent.characterIdByCombatantId,events:[...result.events]})}
}

/** Real pre-raw Host callback. This does not confirm or manufacture PC dice. */
export async function issueBountifulOpportunityMoveRawSource(prepared:PreparedDnd5eOpportunityPlayerMove,input:{rawRollId:string;rawCursor:number;issuerMode:'dm'|'player'},gateway:Pick<SharedRoomGatewayPort,'publishEvent'>){
 const actual=readIssuedDnd5eOpportunityPlayerMove(prepared),host=getRoomSession();if(host?.role!=='dm')throw Error('opportunity-move:authenticated-host-required')
 const count=actual.rawMode==='normal'?1:2,minted=durableD20RollId({mapId:actual.map.id,sourceMode:input.issuerMode,transactionId:actual.action.id,occurrenceIndex:input.rawCursor-1})
 if(!Number.isSafeInteger(input.rawCursor)||input.rawCursor<1||input.rawRollId!==minted&&input.rawRollId!==minted+':pool:'+count+'d20')throw Error('opportunity-move:actual-original-namespace-required')
 await gateway.publishEvent('bountiful-opportunity-source-dm-to-host',{parentId:actual.action.id,mapId:actual.map.id,combatId:actual.state.combatId,rawRollId:input.rawRollId,rawCursor:input.rawCursor,issuerMode:input.issuerMode,count,source:encodeSecondChanceParentWire({prepared:actual})})
 if(getRoomSession()?.roomId!==host.roomId||getRoomSession()?.memberId!==host.memberId||getRoomSession()?.role!=='dm')throw Error('opportunity-move:authenticated-host-required')
}

/** Recovery is issued only after loading the real protected original parent,
 * current pending command and current source guards. There is no snapshot or
 * timestamp setter available to callers. The ordinary preparer remains pure. */
export async function recoverBountifulOpportunityPlayerMove(action:SharedPlayerActionState,gateway:Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>){
 const host=getRoomSession()
 if(host?.role!=='dm')throw Error('opportunity-move:authenticated-host-required')
 const {readBountifulOriginalOpportunityMoveInput}=await import('./bountifulLuckPersistentRoomDriver')
 const actual=await readBountifulOriginalOpportunityMoveInput({mapId:action.mapId,parentId:action.id},gateway),old=actual.source.prepared
 const queue=await gateway.loadResource<{requests:SharedPlayerActionState[]}>('player-action-requests'),combat=await gateway.loadResource<{dnd5eTurnEconomyByToken?:Record<string,Dnd5eTurnEconomyCounts>}>('combat')
 const queued=queue?.requests.find(row=>row.id===action.id&&row.status==='pending')
 if(!queued||JSON.stringify(queued)!==JSON.stringify(action)||JSON.stringify(old.action)!==JSON.stringify(action)||!Number.isSafeInteger(old.transactionNow)||old.transactionNow<1||getRoomSession()?.roomId!==host.roomId||getRoomSession()?.memberId!==host.memberId||getRoomSession()?.role!=='dm')throw Error('opportunity-move:actual-protected-original-required')
 const rechecked=await readBountifulOriginalOpportunityMoveInput({mapId:action.mapId,parentId:action.id},gateway)
 if(JSON.stringify(encodeSecondChanceParentWire(rechecked.source))!==JSON.stringify(encodeSecondChanceParentWire(actual.source)))throw Error('opportunity-move:changed-protected-original')
 const fresh=prepareOpportunityPlayerMoveAtCapturedTime({action,map:old.map,characters:old.characters,initiativeOrder:old.initiativeOrder,moverEconomy:old.moverEconomy,attackerEconomy:old.attackerEconomy,attackerTokenId:old.opportunity.actorToken.id,turnEconomyByToken:old.turnEconomyByToken??combat?.dnd5eTurnEconomyByToken,originalChoices:old.originalChoices},old.transactionNow,old.prefix)
 if(!fresh.ok||JSON.stringify(encodeSecondChanceParentWire(fresh.prepared))!==JSON.stringify(encodeSecondChanceParentWire(old)))throw Error('opportunity-move:changed-original-repreparation')
 return fresh.prepared
}

/** The pure replay is also used during protected recovery. Its inputs remain
 * the original before-world, original counts and captured Host clock. */
function replayPreparedOpportunityPrefix(parent:PreparedDnd5eOpportunityPlayerMove){
 if(!parent.prefix)return undefined
 const input:Dnd5eOpportunityPlayerMoveInput={action:parent.action,map:parent.map,characters:parent.characters,initiativeOrder:parent.initiativeOrder,moverEconomy:parent.moverEconomy,attackerEconomy:parent.attackerEconomy,attackerTokenId:parent.opportunity.actorToken.id,turnEconomyByToken:parent.turnEconomyByToken,originalChoices:parent.originalChoices}
 const prefix=replayDnd5eOpportunityMovePrefix(input,parent.movement,parent.prefix,parent.transactionNow)
 const attack=prepareDnd5eOpportunityAttack({combatId:parent.state.combatId,round:parent.state.round,initiativeIndex:parent.state.initiativeIndex,map:prefix.application.map,characters:prefix.application.characters,initiativeOrder:parent.initiativeOrder,actorTokenId:parent.opportunity.actorToken.id,targetTokenId:parent.action.actorTokenId,turnEconomy:parent.attackerEconomy,targetTurnEconomy:prefix.moverEconomy})
 if(!attack.ok)throw Error('opportunity-prefix:actual-attack-preparation-required:'+attack.reason)
 return {...prefix,attack:{...attack.prepared,state:cloneDnd5eHostTransactionInput(prefix.resolution.result.state)}}
}
/** This reader derives only the actual issued source's native prefix. It does
 * not sign a caller's map, character snapshot, budget or result graph. */
export function readIssuedBountifulOpportunityPrefixProjection(prepared:PreparedDnd5eOpportunityPlayerMove){
 const actual=readIssuedDnd5eOpportunityPlayerMove(prepared),prefix=replayPreparedOpportunityPrefix(actual)
 return prefix?{map:prefix.application.map,characters:prefix.application.characters,turnEconomyByToken:prefix.turnEconomyByToken}:undefined
}
export function prepareBountifulOpportunityPlayerMoveFromPrefix(context:object,input:{attackerTokenId:string;originalChoices?:OriginalChoices;projection:{map:BattleMap;characters:readonly Character[];turnEconomyByToken:Readonly<Record<string,Dnd5eTurnEconomyCounts>>}}){
 const original=readBountifulOpportunityMovePrefixContext(context),base=original.input,attackerEconomy=base.originalEconomies[input.attackerTokenId]
 if(!attackerEconomy)throw Error('opportunity-prefix:original-attacker-economy-required')
 const first=prepareDnd5ePlayerMove({action:base.action,map:base.map,characters:base.characters,initiativeOrder:base.initiativeOrder,turnEconomy:base.moverEconomy})
 if(!first.ok)return first
 const windows=findDnd5eOpportunityWindowsForMove({map:base.map,characters:base.characters,movingToken:first.prepared.actorToken,to:first.prepared.to,path:first.prepared.path,pathElevationsFeet:first.prepared.pathElevationsFeet,toElevationFeet:first.prepared.toElevationFeet,turnEconomyByToken:{...base.turnEconomyByToken,[input.attackerTokenId]:attackerEconomy},combatContext:{combatId:first.prepared.state.combatId,round:first.prepared.state.round,initiativeIndex:first.prepared.state.initiativeIndex,initiativeOrder:base.initiativeOrder,active:true}})
 if(windows.length!==1||windows[0].attacker.id!==input.attackerTokenId)throw Error('opportunity-prefix:one-real-original-window-required')
 const window=windows[0],token=input.projection.map.tokens.find(row=>row.id===base.action.actorTokenId)
 const prefix:Dnd5eOpportunityMovePrefixSpec={kind:'first-opportunity-prefix-v1',position:{x:window.position.x,y:window.position.y},elevationFeet:window.position.elevationFeet??0,...(token?.movementAnimation?{animation:cloneDnd5eHostTransactionInput(token.movementAnimation)}:{})}
 const prepared=prepareOpportunityPlayerMoveAtCapturedTime({...base,attackerTokenId:input.attackerTokenId,attackerEconomy,originalChoices:input.originalChoices},original.firstHostNow,prefix)
 if(!prepared.ok)return prepared
 const actual=readIssuedBountifulOpportunityPrefixProjection(prepared.prepared)
 if(!actual||JSON.stringify(encodeSecondChanceParentWire(actual))!==JSON.stringify(encodeSecondChanceParentWire(input.projection)))throw Error('opportunity-prefix:actual-native-prefix-projection-required')
 return prepared
}

/** Only a recovered actual original and the real new before-world context may
 * validate a replayed presentation. Every mechanical source/projection field
 * remains identical; the first Host time and that same animation's issue time
 * are the only data compared at their original captured values. */
export function readReplayedBountifulOpportunityPrefixProjection(prepared:PreparedDnd5eOpportunityPlayerMove,context:object,projection:Parameters<typeof prepareBountifulOpportunityPlayerMoveFromPrefix>[1]['projection']){
 const original=readIssuedDnd5eOpportunityPlayerMove(prepared)
 if(!original.prefix)throw Error('opportunity-prefix:actual-recovered-prefix-required')
 const fresh=prepareBountifulOpportunityPlayerMoveFromPrefix(context,{attackerTokenId:original.opportunity.actorToken.id,originalChoices:original.originalChoices,projection})
 if(!fresh.ok)throw Error('opportunity-prefix:actual-replayed-prefix-required')
 const current=readIssuedBountifulOpportunityPrefixProjection(fresh.prepared),prior=readIssuedBountifulOpportunityPrefixProjection(prepared)
 if(!current||!prior||!fresh.prepared.prefix)throw Error('opportunity-prefix:actual-replayed-prefix-required')
 const same=(a:unknown,b:unknown)=>JSON.stringify(encodeSecondChanceParentWire(a))===JSON.stringify(encodeSecondChanceParentWire(b))
 const candidate=cloneDnd5eHostTransactionInput(fresh.prepared),local=cloneDnd5eHostTransactionInput(current)
 candidate.transactionNow=original.transactionNow
 const oldAnimation=original.prefix.animation,newAnimation=candidate.prefix?.animation
 if(!!oldAnimation!==!!newAnimation)throw Error('opportunity-prefix:same-native-presentation-required')
 if(oldAnimation&&newAnimation){
  newAnimation.issuedAt=oldAnimation.issuedAt
  const token=local.map.tokens.find(row=>row.id===original.action.actorTokenId),oldToken=prior.map.tokens.find(row=>row.id===original.action.actorTokenId)
  if(!token?.movementAnimation||!oldToken?.movementAnimation)throw Error('opportunity-prefix:same-native-presentation-required')
  token.movementAnimation.issuedAt=oldToken.movementAnimation.issuedAt
 }
 if(!same(candidate,original)||!same(local,prior))throw Error('opportunity-prefix:unchanged-original-mechanics-required')
 return current
}
