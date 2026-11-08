const record=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)!==Array.prototype
const text=(value,max=640)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max
const keys=(value,allowed)=>record(value)&&Object.keys(value).every(key=>allowed.includes(key))
const dies=(values,count,sides=20)=>Array.isArray(values)&&values.length===count&&values.every(value=>integer(value,1,sides))
export function validateSceneReactionSpent(value){return value===undefined||keys(value,['schemaVersion','roomId','parentTransactionId'])&&value.schemaVersion===1&&text(value.roomId)&&text(value.parentTransactionId)}
export function validateSecondChanceParentWire(wire){
 if(!keys(wire,['schemaVersion','root','nodes'])||wire.schemaVersion!==1||!Array.isArray(wire.nodes)||wire.nodes.length>100000)return false
 const encoded=value=>value===null||typeof value==='boolean'||typeof value==='string'||typeof value==='number'&&Number.isFinite(value)||keys(value,['ref'])&&integer(value.ref,0,wire.nodes.length-1)||keys(value,['undefined'])&&value.undefined===true
 if(!encoded(wire.root))return false
 let entries=0
 for(const node of wire.nodes){
  if(!record(node))return false
  if(node.kind==='object'||node.kind==='map'){
   if(!keys(node,['kind','entries'])||!Array.isArray(node.entries)||node.entries.some(row=>!Array.isArray(row)||row.length!==2||!(node.kind==='object'?typeof row[0]==='string':encoded(row[0]))||!encoded(row[1])))return false
   if(node.kind==='object'&&new Set(node.entries.map(row=>row[0])).size!==node.entries.length)return false
   entries+=node.entries.length
  }else if(node.kind==='array'||node.kind==='set'){
   if(!keys(node,['kind','items'])||!Array.isArray(node.items)||!node.items.every(encoded))return false
   entries+=node.items.length
  }else if(node.kind!=='date'||!keys(node,['kind','value'])||typeof node.value!=='string'||!Number.isFinite(Date.parse(node.value)))return false
  if(entries>1000000)return false
 }
 return true
}
export function validateSecondChanceAttackReceipts(value){
 if(!record(value)||Object.keys(value).length>96)return false
 for(const[id,row]of Object.entries(value)){
  if(!text(id)||!keys(row,['postNativeClockAuthority','attack','featureId','sceneScope','incomingOccurrence','hostControllerMemberId','originalRoomAction','featureDefinitionSignature','parentDefinitionSignature','characterRevision','mapRevision','geometryRevision','turnKey','canSeeRoller','canUseReaction','reactionReserved','reactionDecision','rollerSelection','rollRequestId','processedRequestIds','rollerD20','rollerConfirmation','committed','parentContinuation','parentInput','pendingCriticalDiceRequests','criticalDice','criticalDiceConfirmations']))return false
  if(['hostControllerMemberId','geometryRevision','reactionDecision','rollerSelection','rollRequestId','processedRequestIds','rollerD20','rollerConfirmation','committed','parentContinuation','parentInput','pendingCriticalDiceRequests','criticalDice','criticalDiceConfirmations'].some(key=>row[key]===null))return false
  if(row.postNativeClockAuthority!==undefined&&(!keys(row.postNativeClockAuthority,['schemaVersion','roomId','hostMemberId','revision','signature'])||row.postNativeClockAuthority.schemaVersion!==1||!text(row.postNativeClockAuthority.roomId)||!text(row.postNativeClockAuthority.hostMemberId)||!integer(row.postNativeClockAuthority.revision,0,Number.MAX_SAFE_INTEGER)||!/^sha256:[a-f0-9]{64}$/.test(row.postNativeClockAuthority.signature)))return false
  if(row.sceneScope!==undefined&&(!keys(row.sceneScope,['kind','roomId','hostMemberId','campaignTimeRevision','campaignTimeSignature','sourceCombatId','sourceMapId','combatBoundary'])||!['rest','ordinary-exploration'].includes(row.sceneScope.kind)||!text(row.sceneScope.roomId)||!text(row.sceneScope.hostMemberId)||!integer(row.sceneScope.campaignTimeRevision,0,Number.MAX_SAFE_INTEGER)||!text(row.sceneScope.campaignTimeSignature,1000000)||['sourceCombatId','sourceMapId'].some(key=>row.sceneScope[key]!==undefined&&!text(row.sceneScope[key]))))return false
  if(row.sceneScope?.kind==='ordinary-exploration'&&!text(row.sceneScope.combatBoundary,1000000))return false
  if(row.sceneScope?.kind==='rest'&&row.sceneScope.combatBoundary!==undefined)return false
  const a=row.attack
  if(row.sceneScope&&!/^sha256:[a-f0-9]{64}$/.test(row.sceneScope.campaignTimeSignature))return false
  if(!keys(a,['schemaVersion','id','transactionId','mapId','combatId','rollerTokenId','rollerCharacterId','targetTokenId','targetCharacterId','rollerControllerMemberId','targetControllerMemberId','dice','mode','modifier','armorClass','criticalThreshold','phase','forceHit','automaticCritical'])||a.schemaVersion!==1||a.id!==id||![a.transactionId,a.mapId,a.combatId,a.rollerTokenId,a.targetTokenId,a.targetCharacterId,a.rollerControllerMemberId,a.targetControllerMemberId].every(value=>text(value))||a.rollerCharacterId!=null&&!text(a.rollerCharacterId))return false
  if(!['normal','advantage','disadvantage'].includes(a.mode)||!dies(a.dice,a.mode==='normal'?1:2)||!finite(a.modifier,-1e6,1e6)||!finite(a.armorClass,-1e6,1e6)||!integer(a.criticalThreshold,2,20)||!['hit-confirmation','damage-committed','cancelled'].includes(a.phase)||[a.forceHit,a.automaticCritical].some(value=>value!==undefined&&typeof value!=='boolean')||a.rollerCharacterId===null)return false
  if(!text(row.featureId)||!text(row.turnKey)||!integer(row.characterRevision,0,Number.MAX_SAFE_INTEGER)||!integer(row.mapRevision,0,Number.MAX_SAFE_INTEGER)||row.geometryRevision!=null&&!integer(row.geometryRevision,0,Number.MAX_SAFE_INTEGER)||[row.canSeeRoller,row.canUseReaction,row.reactionReserved].some(value=>typeof value!=='boolean'))return false
  if(row.originalRoomAction!==undefined&&(!record(row.originalRoomAction)||row.originalRoomAction.id!==a.transactionId||row.originalRoomAction.mapId!==a.mapId||!row.sceneScope&&row.originalRoomAction.combatId!==a.combatId||!text(row.originalRoomAction.actorTokenId)||!text(row.originalRoomAction.characterId)||!text(row.originalRoomAction.type,180)||!['pending','done'].includes(row.originalRoomAction.status)||!['player','dm'].includes(row.originalRoomAction.sourceMode)))return false
  if(row.featureDefinitionSignature!==undefined&&!text(row.featureDefinitionSignature,100000))return false
  if(row.parentDefinitionSignature!==undefined&&(typeof row.parentDefinitionSignature!=='string'||!/^sha256:[a-f0-9]{64}$/.test(row.parentDefinitionSignature)))return false
  if(row.incomingOccurrence!==undefined&&!integer(row.incomingOccurrence,0,100000))return false
  if(row.hostControllerMemberId!==undefined&&!text(row.hostControllerMemberId))return false
  if(row.reactionDecision&&(!keys(row.reactionDecision,['authenticatedMemberId','decision'])||row.reactionDecision.authenticatedMemberId!==a.targetControllerMemberId||!['use','decline'].includes(row.reactionDecision.decision)))return false
  if(row.rollerSelection&&(!keys(row.rollerSelection,['authenticatedMemberId','dieIndex'])||row.rollerSelection.authenticatedMemberId!==a.rollerControllerMemberId||!integer(row.rollerSelection.dieIndex,0,a.dice.length-1)||row.reactionDecision?.decision!=='use'))return false
  if(row.rollRequestId!=null&&(!text(row.rollRequestId)||!row.rollerSelection))return false
  if(row.rollerD20&&(!keys(row.rollerD20,['authenticatedMemberId','dieIndex','value'])||row.rollerD20.authenticatedMemberId!==a.rollerControllerMemberId||row.rollerD20.dieIndex!==row.rollerSelection?.dieIndex||!integer(row.rollerD20.value,1,20)))return false
  if(row.rollerConfirmation&&(!keys(row.rollerConfirmation,['authenticatedMemberId','rollRequestId','rawValue','value'])||!row.hostControllerMemberId||row.rollerConfirmation.authenticatedMemberId!==row.hostControllerMemberId||row.rollerConfirmation.rollRequestId!==row.rollRequestId||row.rollerConfirmation.rawValue!==row.rollerD20?.value||!integer(row.rollerConfirmation.value,1,20)))return false
  if(row.processedRequestIds!=null&&(!Array.isArray(row.processedRequestIds)||row.processedRequestIds.length>128||row.processedRequestIds.some(value=>!text(value))||new Set(row.processedRequestIds).size!==row.processedRequestIds.length))return false
  const c=row.committed
  if(c){
   if(!keys(c,['attackReceiptId','transactionId','featureId','ownerCharacterId','replacedDieIndex','beforeDice','afterDice','adoptedD20','total','hit','critical','nextResourceCurrent','nextReactionAvailable','confirmation']))return false
   if(!row.rollerD20||row.hostControllerMemberId&&!row.rollerConfirmation||c.attackReceiptId!==id||c.transactionId!==a.transactionId||c.featureId!==row.featureId||c.ownerCharacterId!==a.targetCharacterId||c.replacedDieIndex!==row.rollerSelection?.dieIndex||!dies(c.beforeDice,a.dice.length)||!dies(c.afterDice,a.dice.length)||c.beforeDice.some((value,index)=>value!==a.dice[index])||c.afterDice.some((value,index)=>value!==(index===c.replacedDieIndex?(row.rollerConfirmation?.value??row.rollerD20.value):a.dice[index]))||c.nextResourceCurrent!==0||c.nextReactionAvailable!==false||typeof c.hit!=='boolean'||typeof c.critical!=='boolean'||!record(c.confirmation))return false
   const adopted=a.mode==='advantage'?Math.max(...c.afterDice):a.mode==='disadvantage'?Math.min(...c.afterDice):c.afterDice[0]
   if(c.adoptedD20!==adopted||c.total!==adopted+a.modifier)return false
  }
  const p=row.parentInput
  if(p){if(!keys(p,['state','action','prepared','options','nativeContext','characterIdByCombatantId'])||!record(p.state)||p.state.combatId!==a.combatId||!record(p.state.combatants)||Object.keys(p.state.combatants).length>512||!!p.action===!!p.prepared||p.action&&(!record(p.action)||!text(p.action.actorId)||!text(p.action.type,180)||!p.state.combatants[p.action.actorId])||p.prepared&&(!keys(p.prepared,['adapterId','input'])||!text(p.prepared.adapterId,80)||!validateSecondChanceParentWire(p.prepared.input))||p.nativeContext!==undefined&&(!p.action||!record(p.nativeContext)||!record(p.nativeContext.map)||p.nativeContext.map.id!==a.mapId||!Array.isArray(p.nativeContext.characters)||!record(p.nativeContext.characterIdByCombatantId))||p.options!==undefined&&!record(p.options)||!p.state.combatants[a.rollerTokenId]||!p.state.combatants[a.targetTokenId]||!record(p.characterIdByCombatantId)||p.characterIdByCombatantId[a.targetTokenId]!==a.targetCharacterId)return false}
  const continuation=row.parentContinuation
  if(continuation&&(!c&&row.reactionDecision?.decision!=='decline'||!keys(continuation,['transactionId','phase','characterRevision','combatRevision','result'])||continuation.transactionId!==a.transactionId||!['ready','consumed'].includes(continuation.phase)||!integer(continuation.characterRevision,0,Number.MAX_SAFE_INTEGER)||!integer(continuation.combatRevision,0,Number.MAX_SAFE_INTEGER)||continuation.phase==='consumed'&&(!record(continuation.result)||continuation.result.ok!==true||continuation.result.state?.combatId!==a.combatId)))return false
  if(row.pendingCriticalDiceRequests!=null){if(!c||!record(row.pendingCriticalDiceRequests)||Object.keys(row.pendingCriticalDiceRequests).length>64)return false;for(const[key,request]of Object.entries(row.pendingCriticalDiceRequests)){if(!keys(request,['id','actorId','targetId','count','sides','originalRolls','rollKey'])||request.id!==key||!text(key)||request.actorId!==a.rollerTokenId||request.targetId!==a.targetTokenId||!integer(request.count,1,1000)||!integer(request.sides,2,10000)||!Array.isArray(request.originalRolls)||request.originalRolls.length>1000||request.originalRolls.some(value=>!integer(value,1,request.sides))||request.rollKey!==undefined&&!text(request.rollKey))return false}}
  if(row.criticalDice!=null){if(!record(row.criticalDice)||Object.keys(row.criticalDice).length>64)return false;for(const[key,values]of Object.entries(row.criticalDice)){const request=row.pendingCriticalDiceRequests?.[key];if(!request||!dies(values,request.count,request.sides))return false}}
  if(row.criticalDiceConfirmations!==undefined){if(!row.hostControllerMemberId||!record(row.criticalDiceConfirmations)||Object.keys(row.criticalDiceConfirmations).length>64)return false;for(const[key,confirmation]of Object.entries(row.criticalDiceConfirmations)){const request=row.pendingCriticalDiceRequests?.[key],raw=row.criticalDice?.[key];if(!keys(confirmation,['authenticatedMemberId','rawValues','values'])||!request||!raw||confirmation.authenticatedMemberId!==row.hostControllerMemberId||JSON.stringify(confirmation.rawValues)!==JSON.stringify(raw)||!dies(confirmation.values,request.count,request.sides))return false}}
 }
 return true
}
