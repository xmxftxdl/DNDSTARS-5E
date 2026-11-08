import type{Dnd5eAction}from'./headlessCombatEngine'
import{dnd5eHeadlessTurnKey}from'./headlessCombatEngine'
import{prepareDnd5ePlayerEndTurn,type PreparedDnd5ePlayerEndTurn}from'./endTurnAction'
import{dnd5eDeathSaveTurnAvailable}from'./deathSaveTurn'
import{resolveDnd5eActionWithAirborneFallPreview,type Dnd5eAirborneFallDamageRolls}from'./airborneFallActionResolution'
import{planDnd5eMapResultApplication}from'./mapBridge'
type Input=Parameters<typeof prepareDnd5ePlayerEndTurn>[0]
export type Dnd5eDeathSavingTurnCommand=Extract<Dnd5eAction,{type:'death-save-turn'}>
export interface PreparedDnd5eDeathSavingTurn extends PreparedDnd5ePlayerEndTurn{action:Input['action'];map:Input['map'];characters:Input['characters'];initiativeOrder:Input['initiativeOrder']}
/** This is the real current-turn death-save operation, before the original die
 * changes failures, stability, HP, or advances initiative. It is not a skill or
 * a request for a second ordinary saving throw. */
export function prepareDnd5eDeathSavingTurn(input:Input):{ok:true;prepared:PreparedDnd5eDeathSavingTurn}|{ok:false;reason:'invalid-action'|'invalid-actor'|'combatant-missing'}{
 if(input.action.type!=='dnd5e-death-save'||input.action.status!=='pending')return{ok:false,reason:'invalid-action'}
 const turn=prepareDnd5ePlayerEndTurn(input);if(!turn.ok)return turn
 const p=turn.prepared,actor=p.state.combatants[p.actorToken.id]
 if(!p.actor||input.action.characterId!==p.actor.id||p.state.initiativeOrder[p.state.initiativeIndex]!==p.actorToken.id||!actor||actor.currentHp!==0||actor.deathSaves.dead||actor.deathSaves.stable||!dnd5eDeathSaveTurnAvailable(actor.classState.deathSaveTurn,dnd5eHeadlessTurnKey(p.state,actor.id)))return{ok:false,reason:'invalid-actor'}
 return{ok:true,prepared:{...p,action:structuredClone(input.action),map:input.map,characters:input.characters,initiativeOrder:input.initiativeOrder}}
}
/** Native resolution only. Host room publication and physical-dice evidence
 * remain separate and must retain this exact queued death-save parent. */
export function resolvePreparedDnd5eDeathSavingTurn(input:{prepared:PreparedDnd5eDeathSavingTurn;command:Dnd5eDeathSavingTurnCommand;airborneFallDamageRollsByCombatantId?:Dnd5eAirborneFallDamageRolls}){
 const p=input.prepared,actor=p.state.combatants[p.actorToken.id]
 if(p.action.type!=='dnd5e-death-save'||p.action.actorTokenId!==p.actorToken.id||p.action.characterId!==p.actor?.id||p.action.combatId!==p.state.combatId||p.action.round!==p.state.round||p.action.initiativeIndex!==p.state.initiativeIndex||p.state.initiativeOrder[p.state.initiativeIndex]!==p.actorToken.id||input.command.type!=='death-save-turn'||input.command.actorId!==p.actorToken.id||!actor||actor.currentHp!==0||actor.deathSaves.dead||actor.deathSaves.stable||!dnd5eDeathSaveTurnAvailable(actor.classState.deathSaveTurn,dnd5eHeadlessTurnKey(p.state,actor.id)))throw Error('death-turn:actual-eligible-current-original-required')
 const native=resolveDnd5eActionWithAirborneFallPreview(p.state,input.command,input.airborneFallDamageRollsByCombatantId)
 return{...native,...(native.result.ok?{application:planDnd5eMapResultApplication({map:p.map,characters:p.characters,state:native.result.state,events:[...native.result.events],characterIdByCombatantId:p.characterIdByCombatantId})}:{})}
}
