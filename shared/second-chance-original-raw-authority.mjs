import {validateSecondChanceAttackReceipts} from './second-chance-state.mjs'
import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'
import {secondChanceDmAppendIdentity} from './second-chance-dm-command.mjs'
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value)
const exact=(value,keys)=>object(value)&&Object.keys(value).every(key=>keys.includes(key))
/** Before writing either raw evidence or the public queue, authenticate only
 * the currently issued SC original-roller phase. This grants no other action. */
export function authorizeSecondChancePlayerOriginalRawAppend(action,documents,principal){
 const {combat,characters,maps,geometry,clock,requests}=documents,command=action?.secondChance
 if(!principal?.roomId||!principal.memberId||action?.sourceMode!=='player'||action.roomMemberId!==principal.memberId||action.type!=='dnd5e-second-chance'||action.status!=='pending'||!object(command)||!['roll-result','critical-roll-result'].includes(command.phase)||!validateSecondChanceAttackReceipts(combat?.secondChanceAttacks))return false
 const receipt=combat.secondChanceAttacks[command.attackReceiptId],attack=receipt?.attack
 if(!receipt||attack.rollerControllerMemberId!==principal.memberId||action.mapId!==attack.mapId||action.combatId!==attack.combatId||action.actorTokenId!==attack.rollerTokenId||!attack.rollerCharacterId||action.characterId!==attack.rollerCharacterId)return false
 const scenes=maps?.maps?.filter(row=>row.id===attack.mapId),owners=characters?.characters?.filter(row=>row.id===attack.rollerCharacterId)
 if(scenes?.length!==1||owners?.length!==1||secondChanceCanonicalControllerMemberId(owners[0],{roomId:principal.roomId,hostMemberId:receipt.hostControllerMemberId})!==principal.memberId)return false
 const tokens=scenes[0].tokens?.filter(row=>row.id===attack.rollerTokenId)
 if(tokens?.length!==1||tokens[0].characterId!==owners[0].id)return false
 const supplemental=command.phase==='critical-roll-result'
 const prior=requests?.requests?.find(row=>row.id===action.id)
 if(prior)return secondChanceDmAppendIdentity(prior)===secondChanceDmAppendIdentity(action)
 const scene=receipt.sceneScope
 if(scene?scene.roomId!==principal.roomId||combat.active!==false||combat.mapId!==scene.sourceMapId||combat.combatId!==scene.sourceCombatId:combat.active!==true||combat.mapId!==attack.mapId||combat.combatId!==attack.combatId||combat.dnd5eTurnEconomyByToken?.[attack.targetTokenId]?.turnKey!==receipt.turnKey)return false
 if(scene&&(scene.kind==='ordinary-exploration'?(clock?._sync?.revision??0):clock?._sync?.revision)!==scene.campaignTimeRevision)return false
 if(characters?._sync?.revision!==(receipt.parentContinuation?.characterRevision??receipt.characterRevision)||maps?._sync?.revision!==receipt.mapRevision||receipt.geometryRevision!=null&&(geometry?._sync?.revision??0)!==receipt.geometryRevision)return false
 if(attack.phase!=='hit-confirmation'||receipt.parentContinuation?.phase==='consumed'||receipt.reactionDecision?.decision!=='use'||receipt.rollerSelection?.authenticatedMemberId!==principal.memberId)return false
 if(!supplemental)return exact(command,['phase','attackReceiptId','rollRequestId','value'])&&!receipt.committed&&!receipt.rollerD20&&!receipt.rollerConfirmation&&command.rollRequestId===receipt.rollRequestId&&!!receipt.rollRequestId&&Number.isInteger(command.value)&&command.value>=1&&command.value<=20
 const request=receipt.pendingCriticalDiceRequests?.[command.supplementRequestId]
 return exact(command,['phase','attackReceiptId','supplementRequestId','values'])&&!!receipt.committed&&!!request&&!receipt.criticalDice?.[command.supplementRequestId]&&!receipt.criticalDiceConfirmations?.[command.supplementRequestId]&&Array.isArray(command.values)&&command.values.length===request.count&&command.values.every(value=>Number.isInteger(value)&&value>=1&&value<=request.sides)
}
