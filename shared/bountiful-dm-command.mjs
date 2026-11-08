import{validBountifulMonsterZeroCommand}from'./bountiful-monster-zero-command.mjs'
import {bountifulOriginalScopeMatches,bountifulSceneClockSignature} from './bountiful-original-scope.mjs'
import {validateBountifulOriginalParents,validateBountifulLuckCommand} from './bountiful-luck-state.mjs'
import {validBountifulHostOperation} from './bountiful-host-operation.mjs'
import {bountifulNativeDiceController} from './bountiful-native-dice-controller.mjs'
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
export function bountifulDmAppendIdentity(action){return JSON.stringify([action?.id,action?.mapId,action?.combatId,action?.type,action?.actorTokenId,action?.characterId,action?.roomMemberId,action?.sourceMode,action?.bountifulLuck])}
/** Dedicated authenticated Host transport for an already issued BL phase.
 * Confirmation may acknowledge a real player's raw die. A Host raw/choice is
 * allowed only for the actual Host-controlled original actor, never a player. */
export function authorizeBountifulDmAppend(action,documents,principal){
 const {combat,characters,maps,geometry,requests,clock}=documents
 if(!principal?.roomId||!principal.memberId||action?.sourceMode!=='dm'||action.roomMemberId!==principal.memberId||action.type!=='dnd5e-bountiful-luck'||action.status!=='pending'||!validateBountifulLuckCommand(action.bountifulLuck)||!validateBountifulOriginalParents(combat?.bountifulOriginalParents))return false
 const scope=action.bountifulLuck,command=scope.command,parents=combat.bountifulOriginalParents
 const first=parents[JSON.stringify(['bountiful-original-parent',scope.parentId,0])],row=parents[JSON.stringify(['bountiful-original-parent',scope.parentId,scope.occurrence])]
 if(!first||!row||first.consumed||row.consumed)return false
 const identity=first.identity
 if(['roomId','mapId','combatId','parentId','hostMemberId','round','initiativeIndex','reactionEconomySignature'].some(key=>row.identity[key]!==identity[key])||!same(row.identity.revisions,identity.revisions))return false
 const zero=validBountifulMonsterZeroCommand(first.originalRoomAction)&&first.originalRoomAction.parentId===identity.parentId&&first.originalRoomAction.targetTokenId===identity.roller.tokenId&&first.originalAdapterId==='monster'&&first.originalCheckpoint?.kind==='saving-throw'&&first.originalCheckpoint.actorId===identity.roller.tokenId&&first.rawIssuer?.mode==='dm'&&/^bountiful-monster-damage-zero-original:[a-f0-9]{64}$/.test(first.rawIssuer.rollId),native=zero||(validBountifulHostOperation(first.originalRoomAction)&&first.originalRoomAction.hostMemberId===principal.memberId&&first.originalRoomAction.parentId===identity.parentId&&first.originalRoomAction.actorTokenId===identity.roller.tokenId)
 if(identity.roomId!==principal.roomId||identity.hostMemberId!==principal.memberId||!bountifulOriginalScopeMatches(combat,identity)||action.mapId!==identity.mapId||action.combatId!==identity.combatId||action.round!==identity.round||action.initiativeIndex!==identity.initiativeIndex||JSON.stringify(combat.dnd5eTurnEconomyByToken??{})!==identity.reactionEconomySignature||!native&&!requests?.requests?.some(request=>same(request,first.originalRoomAction)))return false
 const revisions={characters:characters?._sync?.revision??0,maps:maps?._sync?.revision??0,'map-geometry':geometry?._sync?.revision??0,...(identity.sceneScope?{'campaign-time':clock?._sync?.revision??0}:{})}
 if(identity.sceneScope&&bountifulSceneClockSignature(clock)!==identity.sceneScope.campaignTimeSignature)return false
 if(Object.entries(identity.revisions).some(([name,version])=>revisions[name]!==version))return false
 const map=maps?.maps?.find(candidate=>candidate.id===identity.mapId)
 const controlled=(tokenId,characterId)=>{
  const tokens=map?.tokens?.filter(token=>token.id===tokenId)??[],roster=characters?.characters?.filter(character=>character.id===characterId)??[]
  return tokens.length===1&&roster.length===1&&(native?bountifulNativeDiceController(map,characters?.characters,tokenId,principal.roomId)?.character?.id===characterId:tokens[0].characterId===characterId)&&(roster[0].roomMemberId===undefined||roster[0].roomMemberId===principal.memberId)
 }
 const hostToken=roller=>roller.kind==='host-token'&&roller.memberId===principal.memberId&&action.characterId===undefined&&map?.tokens?.filter(token=>token.id===roller.tokenId).length===1&&map.tokens.some(token=>token.id===roller.tokenId&&!token.characterId&&!token.dnd5eSimulacrum&&token.type!=='obstacle'&&typeof token.poolId==='string'&&!!token.poolId.trim())
 const rollerActor=roller=>action.actorTokenId===roller.tokenId&&(hostToken(roller)||action.characterId===roller.characterId&&(native?bountifulNativeDiceController(map,characters?.characters,roller.tokenId,principal.roomId)?.character?.id===roller.characterId:map?.tokens?.some(token=>token.id===roller.tokenId&&token.characterId===roller.characterId))&&characters?.characters?.some(character=>character.id===roller.characterId))
 if(command.phase.startsWith('equipment-')){
  const child=first.postOriginalEquipmentD20
  if(!child||child.identity.sourceOccurrence!==scope.occurrence||command.promptId!==child.id||!rollerActor(child.identity.roller))return false
  const roller=child.identity.roller,owner=roller.memberId===principal.memberId&&controlled(roller.tokenId,roller.characterId)
  if(command.phase==='equipment-choice')return !child.choice&&owner&&(command.decision==='keep'||child.candidates.some(candidate=>candidate.instanceId===command.instanceId&&candidate.effectId===command.effectId&&candidate.resourceId===command.resourceId&&candidate.dieIndices.includes(command.dieIndex)))
  if(command.phase==='equipment-roll')return child.choice?.decision==='reroll'&&!child.raw&&owner&&command.rollRequestId===child.id+':owned-reroll'
  return command.phase==='equipment-confirm'&&child.choice?.decision==='reroll'&&!!child.raw&&!child.confirmed&&command.rollRequestId===child.raw.requestId&&command.rawValue===child.raw.value
 }
 const used=row.ownerDecisions.find(choice=>choice.decision==='use'),next=!row.request.nativeLucky&&!used?row.request.options[row.ownerDecisions.length]:undefined
 if(command.phase==='native-lucky')return row.request.nativeLucky===true&&row.nativeLuckyChoiceVersion===1&&!row.nativeLuckyDecision&&!row.rawReroll&&!row.hostReroll&&row.identity.roller.kind!=='host-token'&&row.identity.roller.memberId===principal.memberId&&rollerActor(row.identity.roller)&&controlled(row.identity.roller.tokenId,row.identity.roller.characterId)
 if(row.request.nativeLucky&&row.nativeLuckyChoiceVersion===1&&row.nativeLuckyDecision?.decision!=='use')return false
 if(command.phase==='reaction'){
  const controller=next&&row.controllers[next.ownerId]
  return !!next&&command.ownerId===next.ownerId&&command.featureId===next.featureId&&controller?.memberId===principal.memberId&&action.actorTokenId===next.ownerId&&action.characterId===controller.characterId&&controlled(next.ownerId,controller.characterId)
 }
 if(next||!row.request.nativeLucky&&!used||!rollerActor(row.identity.roller))return false
 const rollId=JSON.stringify(['bountiful-original-d20',row.identity.roomId,row.identity.combatId,row.identity.parentId,row.identity.occurrence,row.request.dieIndex])
 if(command.phase==='roll')return !row.rawReroll&&row.identity.roller.memberId===principal.memberId&&(hostToken(row.identity.roller)||controlled(row.identity.roller.tokenId,row.identity.roller.characterId))&&command.rollRequestId===rollId
 return command.phase==='confirm'&&!!row.rawReroll&&!row.hostReroll&&command.rollRequestId===rollId&&command.rawValue===row.rawReroll.value
}
