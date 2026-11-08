import{secondChanceCanonicalControllerMemberId}from'./second-chance-controller.mjs'
import {validateSecondChanceAttackReceipts} from './second-chance-state.mjs'
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const exactKeys=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key))
export function secondChanceDmAppendIdentity(action){return JSON.stringify([action?.id,action?.mapId,action?.combatId,action?.type,action?.actorTokenId,action?.characterId,action?.roomMemberId,action?.sourceMode,action?.secondChance])}
/** Only a server-authenticated DM may append a final confirmation for an
 * already persisted original-roller result. This never authorizes raw faces,
 * player choices, arbitrary DM actions or client-supplied controller identity. */
export function authorizeSecondChanceDmConfirmationAppend(action,documents,principal){
 const {combat,characters,maps,geometry,clock}=documents,command=action?.secondChance
 if(!principal?.roomId||!principal.memberId||action?.sourceMode!=='dm'||action.roomMemberId!==principal.memberId||action.type!=='dnd5e-second-chance'||action.status!=='pending'||!object(command)||!['confirm-roll','confirm-critical-roll'].includes(command.phase)||!validateSecondChanceAttackReceipts(combat?.secondChanceAttacks))return false
 const receipt=combat.secondChanceAttacks[command.attackReceiptId],attack=receipt?.attack
 if(!receipt||receipt.hostControllerMemberId!==principal.memberId||receipt.reactionDecision?.decision!=='use'||attack.phase!=='hit-confirmation'||receipt.parentContinuation?.phase==='consumed'||action.mapId!==attack.mapId||action.combatId!==attack.combatId||action.actorTokenId!==attack.rollerTokenId||action.characterId!==(attack.rollerCharacterId??attack.rollerTokenId))return false
 const scene=receipt.sceneScope
 if(scene?scene.roomId!==principal.roomId||scene.hostMemberId!==principal.memberId||combat.active!==false||combat.mapId!==scene.sourceMapId||combat.combatId!==scene.sourceCombatId:combat.active!==true||combat.mapId!==attack.mapId||combat.combatId!==attack.combatId||combat.dnd5eTurnEconomyByToken?.[attack.targetTokenId]?.turnKey!==receipt.turnKey)return false
 if(scene&&(scene.kind==='ordinary-exploration'?(clock?._sync?.revision??0):clock?._sync?.revision)!==scene.campaignTimeRevision)return false
 if(characters?._sync?.revision!==(receipt.parentContinuation?.characterRevision??receipt.characterRevision)||maps?._sync?.revision!==receipt.mapRevision||receipt.geometryRevision!=null&&(geometry?._sync?.revision??0)!==receipt.geometryRevision)return false
 if(command.phase==='confirm-roll')return exactKeys(command,['phase','attackReceiptId','rollRequestId','value'])&&!receipt.committed&&!receipt.rollerConfirmation&&!!receipt.rollerD20&&command.rollRequestId===receipt.rollRequestId&&Number.isInteger(command.value)&&command.value>=1&&command.value<=20
 const request=receipt.pendingCriticalDiceRequests?.[command.supplementRequestId],raw=receipt.criticalDice?.[command.supplementRequestId]
 return exactKeys(command,['phase','attackReceiptId','supplementRequestId','values'])&&!!receipt.committed&&!!request&&!!raw&&!receipt.criticalDiceConfirmations?.[command.supplementRequestId]&&Array.isArray(command.values)&&command.values.length===request.count&&command.values.every(value=>Number.isInteger(value)&&value>=1&&value<=request.sides)
}

/** Only the actual current Host controller may answer its own frozen owner or
 * original-roller phase. Final confirmation remains the independent Host fact
 * handled above; owning a roller does not grant control of a player character. */
export function authorizeSecondChanceDmOwnedAppend(action,documents,principal){
 const command=action?.secondChance
 if(['confirm-roll','confirm-critical-roll'].includes(command?.phase))return authorizeSecondChanceDmConfirmationAppend(action,documents,principal)
 const{combat,characters,maps,geometry,clock}=documents
 if(!principal?.roomId||!principal.memberId||action?.sourceMode!=='dm'||action.roomMemberId!==principal.memberId||action.type!=='dnd5e-second-chance'||action.status!=='pending'||!object(command)||!['reaction','select-die','roll-result','critical-roll-result'].includes(command.phase)||!validateSecondChanceAttackReceipts(combat?.secondChanceAttacks))return false
 const receipt=combat.secondChanceAttacks[command.attackReceiptId],attack=receipt?.attack
 if(!receipt||receipt.hostControllerMemberId!==principal.memberId||attack.phase!=='hit-confirmation'||receipt.parentContinuation?.phase==='consumed'||action.mapId!==attack.mapId||action.combatId!==attack.combatId)return false
 const scene=receipt.sceneScope
 if(scene?scene.roomId!==principal.roomId||scene.hostMemberId!==principal.memberId||combat.active!==false||combat.mapId!==scene.sourceMapId||combat.combatId!==scene.sourceCombatId:combat.active!==true||combat.mapId!==attack.mapId||combat.combatId!==attack.combatId||combat.dnd5eTurnEconomyByToken?.[attack.targetTokenId]?.turnKey!==receipt.turnKey)return false
 if(scene&&(scene.kind==='ordinary-exploration'?(clock?._sync?.revision??0):clock?._sync?.revision)!==scene.campaignTimeRevision)return false
 if(characters?._sync?.revision!==(receipt.parentContinuation?.characterRevision??receipt.characterRevision)||maps?._sync?.revision!==receipt.mapRevision||receipt.geometryRevision!=null&&(geometry?._sync?.revision??0)!==receipt.geometryRevision)return false
 const scenes=maps?.maps?.filter(row=>row.id===attack.mapId)
 if(scenes?.length!==1)return false
 const currentHostControls=(tokenId,characterId)=>{
  const tokens=scenes[0].tokens?.filter(row=>row.id===tokenId)
  if(tokens?.length!==1)return false
  if(!characterId)return !tokens[0].characterId
  const owners=characters?.characters?.filter(row=>row.id===characterId)
  return owners?.length===1&&tokens[0].characterId===characterId&&secondChanceCanonicalControllerMemberId(owners[0],{roomId:principal.roomId,hostMemberId:principal.memberId})===principal.memberId
 }
 if(command.phase==='reaction')return exactKeys(command,['phase','attackReceiptId','decision'])&&['use','decline'].includes(command.decision)&&!receipt.committed&&!receipt.reactionDecision&&attack.targetControllerMemberId===principal.memberId&&action.actorTokenId===attack.targetTokenId&&action.characterId===attack.targetCharacterId&&currentHostControls(attack.targetTokenId,attack.targetCharacterId)
 if(receipt.reactionDecision?.decision!=='use'||attack.rollerControllerMemberId!==principal.memberId||action.actorTokenId!==attack.rollerTokenId||action.characterId!==(attack.rollerCharacterId??attack.rollerTokenId)||!currentHostControls(attack.rollerTokenId,attack.rollerCharacterId))return false
 if(command.phase==='select-die')return exactKeys(command,['phase','attackReceiptId','dieIndex'])&&!receipt.committed&&!receipt.rollerSelection&&!receipt.rollerD20&&!receipt.rollerConfirmation&&Number.isInteger(command.dieIndex)&&command.dieIndex>=0&&command.dieIndex<attack.dice.length
 if(command.phase==='roll-result')return exactKeys(command,['phase','attackReceiptId','rollRequestId','value'])&&!receipt.committed&&!!receipt.rollerSelection&&!receipt.rollerD20&&!receipt.rollerConfirmation&&!!receipt.rollRequestId&&command.rollRequestId===receipt.rollRequestId&&Number.isInteger(command.value)&&command.value>=1&&command.value<=20
 const request=receipt.pendingCriticalDiceRequests?.[command.supplementRequestId]
 return exactKeys(command,['phase','attackReceiptId','supplementRequestId','values'])&&!!receipt.committed&&!!request&&!receipt.criticalDice?.[command.supplementRequestId]&&!receipt.criticalDiceConfirmations?.[command.supplementRequestId]&&Array.isArray(command.values)&&command.values.length===request.count&&command.values.every(value=>Number.isInteger(value)&&value>=1&&value<=request.sides)
}
