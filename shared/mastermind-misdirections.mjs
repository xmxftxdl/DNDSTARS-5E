import{readMastermindSpellOwnerChain,readMastermindSpellOwnerChainAtRetargetTarget}from'./mastermind-spell-owner-chain.mjs'
import{readMastermindNativeWardRetargetOwnerFacts}from'./mastermind-native-ward-outcomes.mjs'
import{mastermindExecutionParentId}from'./mastermind-execution-id.mjs'
import{bountifulOpportunitySequenceSourceFacts}from'./bountiful-opportunity-sequence.mjs'
import {secondChanceCanonicalControllerMemberId} from './second-chance-controller.mjs'

const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,239}$/.test(v)
const integer=v=>Number.isSafeInteger(v)&&v>=0
const ordered=v=>Array.isArray(v)?v.map(ordered):object(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,ordered(x)])):v
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b))
const names=['characters','maps','combat','map-geometry','campaign-time']
const fail=(status,error)=>({ok:false,status,error})
const revision=v=>v==null?0:integer(v?._sync?.revision)?v._sync.revision:undefined
const versionsMatch=(versions,snapshot)=>object(versions)&&Object.keys(versions).length===5&&names.every(name=>integer(versions[name])&&versions[name]===revision(snapshot[name]))
const controller=(character,identity)=>secondChanceCanonicalControllerMemberId(character,{roomId:identity.roomId,hostMemberId:identity.hostMemberId})
const spellCastSelection=v=>object(v)&&Object.keys(v).every(k=>['spellId','slotLevel','targetTokenId','castingClassId','itemInstanceId','itemUseActionId','focusItemInstanceId','racialInnate','sustainedEffectAttack'].includes(k))&&id(v.spellId)&&integer(v.slotLevel)&&v.slotLevel<=9&&id(v.targetTokenId)&&['castingClassId','itemInstanceId','itemUseActionId','focusItemInstanceId'].every(k=>v[k]===undefined||id(v[k]))&&(v.racialInnate===undefined||typeof v.racialInnate==='boolean')&&(v.sustainedEffectAttack===undefined||id(v.sustainedEffectAttack))
const spellWindowOriginal=v=>object(v)&&(Object.keys(v).length===4&&!Object.hasOwn(v,'retargetStep')||Object.keys(v).length===5&&integer(v.retargetStep)&&v.retargetStep>0&&v.retargetStep<=128)&&v.schemaVersion===1&&v.family==='spell-window'&&id(v.sourceParentId)&&integer(v.windowIndex)&&v.windowIndex<128
const windowSpellCastSelection=v=>object(v)&&Array.isArray(v.projectileTargetIds)&&v.projectileTargetIds.length>0&&v.projectileTargetIds.length<=128&&v.projectileTargetIds.every(id)&&v.projectileTargetIds[0]===v.targetTokenId&&(v.targetTokenIds===undefined||Array.isArray(v.targetTokenIds)&&v.targetTokenIds.length>0&&v.targetTokenIds.length<=128&&v.targetTokenIds.every(id)&&v.targetTokenIds[0]===v.targetTokenId&&same([...new Set(v.targetTokenIds)].sort(),[...new Set(v.projectileTargetIds)].sort()))&&(v.ritual===undefined||v.ritual===false)&&spellCastSelection(Object.fromEntries(Object.entries(v).filter(([k])=>!['projectileTargetIds','targetTokenIds','ritual'].includes(k))))
function nativeSpellIntent(v,window=false){
 if(typeof v.intentSignature!=='string'||v.intentSignature.length>20000)return undefined
 try{const input=JSON.parse(v.intentSignature);if(!object(input)||Object.keys(input).length!==5||!mastermindExecutionParentId(input.parentTransactionId)||!['mapId','actorTokenId','targetTokenId'].every(k=>id(input[k]))||!(window?windowSpellCastSelection:spellCastSelection)(input.spellCast)||input.spellCast.targetTokenId!==input.targetTokenId||input.spellCast.spellId!==v.spellId||input.parentTransactionId!==v.sourceId||JSON.stringify(ordered(input))!==v.intentSignature)return undefined;return input}catch{return undefined}
}
const nativeOriginal=(v,window=false)=>object(v)&&v.schemaVersion===1&&id(v.combatId)&&(v.family==='spell-attack'?mastermindExecutionParentId(v.sourceId):id(v.sourceId))&&integer(v.occurrence)&&(v.family==='monster-attack'?Object.keys(v).length===6&&id(v.statBlockId)&&v.occurrence<128:v.family==='spell-attack'?Object.keys(v).length===7&&id(v.spellId)&&(window?v.occurrence<128:v.occurrence===0)&&!!nativeSpellIntent(v,window):false)
const wardRetargetOriginal=v=>object(v)&&Object.keys(v).length===4&&v.schemaVersion===1&&['rootParentId','requestId','outcomeId'].every(k=>id(v[k]))
const redirectOriginal=v=>object(v)&&Object.keys(v).length===3&&v.schemaVersion===1&&id(v.rootParentId)&&id(v.previousParentId)
function directRedirectOriginalCurrent(row,snapshot,identity){
 const chain=row.redirectOriginal;if(!redirectOriginal(chain)||row.wardRetargetOriginal!==undefined||row.spellWindowOriginal!==undefined||row.opportunityOriginal!==undefined||row.nativeOriginal?.family!=='monster-attack')return false;
 const rows=snapshot['mastermind-misdirections']?.parents??{},root=rows[chain.rootParentId];if(!root||root.redirectOriginal!==undefined||root.wardRetargetOriginal!==undefined||root.spellWindowOriginal!==undefined||root.opportunityOriginal!==undefined)return false;
 const seen=new Set([row.ownerTokenId]);let cursor=row,previous;for(let depth=0;depth<64;depth++){
  const cause=cursor.redirectOriginal;if(!redirectOriginal(cause)||cause.rootParentId!==root.id||cause.previousParentId===cursor.id)return false;previous=rows[cause.previousParentId];if(!previous||previous.phase!=='answered'||previous.answer?.submittedByMemberId!==previous.ownerMemberId||previous.answer.choice!==cursor.ownerTokenId||seen.has(previous.ownerTokenId)||!same(cursor.nativeOriginal,root.nativeOriginal)||!same(cursor.versions,root.versions)||cursor.parentTransactionId!==root.parentTransactionId||cursor.mapId!==root.mapId||cursor.attackerTokenId!==root.attackerTokenId)return false;seen.add(previous.ownerTokenId);if(previous.id===root.id)return !!currentNativeOriginal(root,snapshot,identity);if(!previous.redirectOriginal||previous.roomId!==root.roomId||previous.hostMemberId!==root.hostMemberId)return false;const priorOwner=snapshot.characters?.characters?.find(c=>c.id===previous.ownerCharacterId);if(controller(priorOwner,identity)!==previous.ownerMemberId)return false;cursor=previous;
 }return false
}
function currentNativeOriginal(row,snapshot,identity,depth=0){
 if(depth>64)return undefined;
 if(row.redirectOriginal!==undefined&&row.spellWindowOriginal===undefined&&!directRedirectOriginalCurrent(row,snapshot,identity))return undefined;
 if(row.wardRetargetOriginal!==undefined){
  if(!wardRetargetOriginal(row.wardRetargetOriginal)||row.spellWindowOriginal!==undefined||row.opportunityOriginal!==undefined||row.nativeOriginal?.family!=='monster-attack')return;
  const f=readMastermindNativeWardRetargetOwnerFacts(snapshot['mastermind-native-ward-outcomes'],snapshot,{...identity,role:'dm',memberId:identity.hostMemberId},{rootParentId:row.wardRetargetOriginal.rootParentId,requestId:row.wardRetargetOriginal.requestId,outcomeId:row.wardRetargetOriginal.outcomeId});
  if(!f||f.targetTokenId!==row.ownerTokenId||row.id===f.parent.id||row.parentTransactionId!==f.parent.parentTransactionId||row.mapId!==f.parent.mapId||row.attackerTokenId!==f.parent.attackerTokenId||!same(row.nativeOriginal,f.parent.nativeOriginal)||!same(row.versions,f.parent.versions))return;
 }
 if(row.spellWindowOriginal!==undefined)return currentSpellWindowOriginal(row,snapshot,identity)
 if(!nativeOriginal(row.nativeOriginal)||row.originalAction!==undefined)return undefined
 if(snapshot['player-action-requests']?.requests?.some(action=>action.id===row.parentTransactionId))return undefined
 const map=snapshot.maps?.maps?.find(m=>m.id===row.mapId),characters=snapshot.characters?.characters??[],owner=characters.find(c=>c.id===row.ownerCharacterId)
 const ownerToken=map?.tokens?.find(t=>t.id===row.ownerTokenId&&t.characterId===owner?.id),attacker=map?.tokens?.find(t=>t.id===row.attackerTokenId&&t.type!=='obstacle'),combat=snapshot.combat
 if(!owner||!ownerToken||!attacker||controller(owner,identity)!==row.ownerMemberId||!combat||combat.active!==true||combat.flowPause||combat.mapId!==row.mapId||combat.combatId!==row.nativeOriginal.combatId)return undefined
 const actor=characters.find(c=>c.id===attacker.characterId)
 if(row.nativeOriginal.family==='monster-attack'){
  const statBlockId=attacker.type==='enemy'?attacker.poolId:actor?.dnd5eCombatState?.wildShapeFormId
  if(statBlockId!==row.nativeOriginal.statBlockId)return undefined
 }else{
  const intent=nativeSpellIntent(row.nativeOriginal)
  if(!actor||controller(actor,identity)!==identity.hostMemberId||!intent||intent.parentTransactionId!==row.parentTransactionId||intent.mapId!==row.mapId||intent.actorTokenId!==attacker.id||intent.targetTokenId!==ownerToken.id)return undefined
 }
 const rogue=owner.dnd5eClassLevels?.rogue??(owner.charClass==='游荡者'?owner.level:0)
 if(!integer(rogue)||rogue<13||!id(owner.dnd5eClassChoices?.classes?.rogue?.subclass)||!row.replacementTokenIds.every(candidate=>candidate!==ownerToken.id&&map.tokens.some(t=>t.id===candidate&&t.type!=='obstacle')))return undefined
 return{owner,map,nativeOriginal:row.nativeOriginal}
}

function currentSpellRedirectOriginal(row,snapshot,identity){
 const cause=row.redirectOriginal;if(!redirectOriginal(cause)||!spellWindowOriginal(row.spellWindowOriginal)||row.wardRetargetOriginal!==undefined||row.opportunityOriginal!==undefined)return;
 const stored=snapshot['mastermind-misdirections'],root=stored?.parents?.[cause.rootParentId];if(!root||root.redirectOriginal!==undefined||root.wardRetargetOriginal!==undefined||root.opportunityOriginal!==undefined||!same(root.spellWindowOriginal,row.spellWindowOriginal)||!same(row.nativeOriginal,root.nativeOriginal)||row.originalAction!==undefined&&!same(row.originalAction,root.originalAction))return;
 const original=currentSpellWindowOriginal(root,snapshot,identity),parent=snapshot.mastermindSpellSource?.parent;if(!original||!parent)return;
 const saved=stored?.parents?.[row.id],candidate={...row,phase:saved?.phase??row.phase,revision:saved?.revision??row.revision,...(saved?.answer?{answer:saved.answer}:{}),...(original.action?{originalAction:original.action}:{nativeOriginal:original.nativeOriginal})},journal={...stored,parents:{...stored?.parents,[row.id]:candidate}},chain=row.spellWindowOriginal.retargetStep===undefined?readMastermindSpellOwnerChain(parent,original.window,{...snapshot,'mastermind-misdirections':journal},identity):readMastermindSpellOwnerChainAtRetargetTarget(parent,original.window,{...snapshot,'mastermind-misdirections':journal},identity,row.spellWindowOriginal.retargetStep);
 if(!chain.ok||!chain.rows.some(value=>value.id===row.id))return;
 const owner=snapshot.characters?.characters?.find(c=>c.id===row.ownerCharacterId);return{...original,owner};
}
function currentSpellWindowOriginal(row,snapshot,identity){
 if(row.redirectOriginal!==undefined)return currentSpellRedirectOriginal(row,snapshot,identity)
 if(!spellWindowOriginal(row.spellWindowOriginal)||row.opportunityOriginal!==undefined)return
 const scope=snapshot.mastermindSpellSource,p=scope?.ok&&scope.parent,w=p?.windows?.[row.spellWindowOriginal.windowIndex],original=p?.original,map=snapshot.maps?.maps?.find(m=>m.id===row.mapId),characters=snapshot.characters?.characters??[],owner=characters.find(c=>c.id===row.ownerCharacterId),target=map?.tokens?.find(t=>t.id===row.ownerTokenId&&t.characterId===owner?.id),actor=map?.tokens?.find(t=>t.id===row.attackerTokenId),rogue=owner?.dnd5eClassLevels?.rogue??(owner?.charClass==='游荡者'?owner.level:0)
 const step=row.spellWindowOriginal.retargetStep,next=step===undefined?undefined:readMastermindSpellOwnerChainAtRetargetTarget(p,w,snapshot,identity,step);if(step!==undefined&&(!next?.ok||next.rows.some(value=>value.redirectOriginal===undefined&&value.id!==row.id)))return;const originalTarget=next?.ok?next.initialTargetId:w?.originalTargetId
 if(!p||p.id!==row.spellWindowOriginal.sourceParentId||p.roomId!==identity.roomId||p.hostMemberId!==identity.hostMemberId||!w||w.index!==row.spellWindowOriginal.windowIndex||originalTarget!==row.ownerTokenId||original.action.id!==row.parentTransactionId||original.mapId!==row.mapId||original.actorTokenId!==row.attackerTokenId||p.nextWindow<w.index||!same(p.versions,row.versions)||!owner||!target||!actor||controller(owner,identity)!==row.ownerMemberId||!integer(rogue)||rogue<13||!id(owner.dnd5eClassChoices?.classes?.rogue?.subclass)||!row.replacementTokenIds.every(candidate=>candidate!==target.id&&map.tokens.some(t=>t.id===candidate&&t.type!=='obstacle')))return
 if(p.source.origin==='queued'){if(row.nativeOriginal!==undefined)return;return{action:original.action,owner,map,window:w}}
 const native=row.nativeOriginal,intent=native&&nativeSpellIntent(native,true),expected={parentTransactionId:original.action.id,mapId:original.mapId,actorTokenId:original.actorTokenId,targetTokenId:original.action.dnd5eSpellCast.targetTokenId,spellCast:original.action.dnd5eSpellCast}
 if(row.originalAction!==undefined||!nativeOriginal(native,true)||native.combatId!==original.combatId||native.sourceId!==row.parentTransactionId||native.spellId!==original.spellId||native.occurrence!==w.index||!same(intent,expected))return
 return{nativeOriginal:native,owner,map,window:w}
}

/** This resource authenticates an owner decision about a Host-issued original.
 * It is not a native feature, cover, attack, or publication capability. The
 * native consumer must recheck the actual registered source and geometry. */
export function validMastermindMisdirections(value){
 if(!object(value)||value.schemaVersion!==1||!object(value.parents)||Object.keys(value.parents).length>1024)return false
 return Object.entries(value.parents).every(([key,row])=>object(row)&&key===row.id&&id(key)&&id(row.roomId)&&id(row.hostMemberId)&&mastermindExecutionParentId(row.parentTransactionId)&&id(row.mapId)&&id(row.attackerTokenId)&&id(row.ownerTokenId)&&id(row.ownerCharacterId)&&id(row.ownerMemberId)&&id(row.featureId)&&typeof row.sourceDefinitionSignature==='string'&&row.sourceDefinitionSignature.length>=2&&row.sourceDefinitionSignature.length<=20000&&object(row.versions)&&Object.keys(row.versions).length===5&&names.every(name=>integer(row.versions[name]))&&(row.redirectOriginal===undefined||redirectOriginal(row.redirectOriginal)&&row.wardRetargetOriginal===undefined&&row.opportunityOriginal===undefined&&(row.spellWindowOriginal!==undefined?spellWindowOriginal(row.spellWindowOriginal):row.nativeOriginal?.family==='monster-attack'))&&(row.wardRetargetOriginal===undefined||wardRetargetOriginal(row.wardRetargetOriginal)&&row.nativeOriginal?.family==='monster-attack'&&row.spellWindowOriginal===undefined&&row.opportunityOriginal===undefined)&&(row.opportunityOriginal===undefined||opportunityOriginal(row.opportunityOriginal)&&row.nativeOriginal===undefined&&row.spellWindowOriginal===undefined)&&(row.spellWindowOriginal===undefined||spellWindowOriginal(row.spellWindowOriginal)&&row.opportunityOriginal===undefined)&&((object(row.originalAction)&&row.nativeOriginal===undefined)||(nativeOriginal(row.nativeOriginal,row.spellWindowOriginal!==undefined)&&row.originalAction===undefined))&&Array.isArray(row.replacementTokenIds)&&row.replacementTokenIds.length>0&&row.replacementTokenIds.length<=128&&new Set(row.replacementTokenIds).size===row.replacementTokenIds.length&&row.replacementTokenIds.every(id)&&integer(row.issuedAt)&&integer(row.revision)&&['waiting','answered','consumed'].includes(row.phase)&&(row.phase==='waiting'?row.answer===undefined:object(row.answer)&&row.answer.submittedByMemberId===row.ownerMemberId&&integer(row.answer.submittedAt)&&(row.answer.choice==='decline'||row.replacementTokenIds.includes(row.answer.choice))))
}

const opportunityOriginal=v=>object(v)&&Object.keys(v).length===3&&v.schemaVersion===1&&v.family==='opportunity-sequence'&&integer(v.windowIndex)&&v.windowIndex<128
function currentOpportunityOriginal(row,snapshot,identity){
 if(!opportunityOriginal(row.opportunityOriginal)||row.nativeOriginal!==undefined)return undefined
 const book=snapshot.mastermindOpportunitySource,f=book?.ok&&bountifulOpportunitySequenceSourceFacts(book.collectorCheckpointSource),pending=f?.pending,window=book?.collectorWindows?.find(value=>value.windowIndex===row.opportunityOriginal.windowIndex)
 const map=snapshot.maps?.maps?.find(m=>m.id===row.mapId),characters=snapshot.characters?.characters??[],owner=characters.find(c=>c.id===row.ownerCharacterId),ownerToken=map?.tokens?.find(t=>t.id===row.ownerTokenId&&t.characterId===owner?.id),attacker=map?.tokens?.find(t=>t.id===row.attackerTokenId&&t.type!=='obstacle'),action=snapshot['player-action-requests']?.requests?.find(a=>a.id===row.parentTransactionId),combat=snapshot.combat
 if(!book?.ok||!f||!pending||!window||window.complete||window.actorId!==row.attackerTokenId||window.windowIndex!==pending.windowIndex||pending.windowIndex!==row.opportunityOriginal.windowIndex||pending.parentId!==row.parentTransactionId||pending.actorTokenId!==row.attackerTokenId||pending.targetTokenId!==row.ownerTokenId||!same(pending.originalAction,action)||!same(f.action,action))return undefined
 if(!owner||!ownerToken||!attacker||!action||action.type!=='move-token'||action.status!=='pending'||action.sourceMode!=='player'||action.actorTokenId!==ownerToken.id||action.characterId!==owner.id||!action.roomMemberId||action.roomMemberId!==controller(owner,identity)||row.ownerMemberId!==controller(owner,identity)||action.mapId!==row.mapId||!combat||combat.active!==true||combat.flowPause||combat.mapId!==row.mapId||action.combatId!==combat.combatId)return undefined
 const rogue=owner.dnd5eClassLevels?.rogue??(owner.charClass==='游荡者'?owner.level:0)
 if(!integer(rogue)||rogue<13||!id(owner.dnd5eClassChoices?.classes?.rogue?.subclass)||!row.replacementTokenIds.every(candidate=>candidate!==ownerToken.id&&map.tokens.some(t=>t.id===candidate&&t.type!=='obstacle')))return undefined
 return{action,owner,map}
}
function currentOriginal(row,snapshot,identity){
 if(row.spellWindowOriginal!==undefined)return currentSpellWindowOriginal(row,snapshot,identity)
 if(row.opportunityOriginal!==undefined)return currentOpportunityOriginal(row,snapshot,identity)
 if(row.nativeOriginal!==undefined)return currentNativeOriginal(row,snapshot,identity)
 const map=snapshot.maps?.maps?.find(m=>m.id===row.mapId),characters=snapshot.characters?.characters??[],owner=characters.find(c=>c.id===row.ownerCharacterId)
 const ownerToken=map?.tokens?.find(t=>t.id===row.ownerTokenId&&t.characterId===owner?.id),attacker=map?.tokens?.find(t=>t.id===row.attackerTokenId)
 const action=snapshot['player-action-requests']?.requests?.find(a=>a.id===row.parentTransactionId)
 const actualTarget=action?.type==='dnd5e-spell-cast'?action.dnd5eSpellCast?.targetTokenId:action?.targetTokenId
 if(!owner||!ownerToken||!attacker||!action||action.status!=='pending'||action.sourceMode!=='player'||!['dnd5e-weapon-attack','dnd5e-spell-cast'].includes(action.type)||action.mapId!==row.mapId||action.actorTokenId!==attacker.id||actualTarget!==ownerToken.id||(action.targetTokenId!==undefined&&action.targetTokenId!==actualTarget)||action.characterId!==attacker.characterId||!action.roomMemberId)return undefined
 if(action.type==='dnd5e-spell-cast'&&(!id(action.dnd5eSpellCast?.spellId)||!integer(action.dnd5eSpellCast?.slotLevel)||action.dnd5eSpellCast.slotLevel>9))return undefined
 const actor=characters.find(c=>c.id===action.characterId)
 if(controller(actor,identity)!==action.roomMemberId||controller(owner,identity)!==row.ownerMemberId)return undefined
 const rogue=owner.dnd5eClassLevels?.rogue??(owner.charClass==='游荡者'?owner.level:0)
 if(!integer(rogue)||rogue<13||!id(owner.dnd5eClassChoices?.classes?.rogue?.subclass))return undefined
 if(!row.replacementTokenIds.every(candidate=>candidate!==ownerToken.id&&map.tokens.some(t=>t.id===candidate&&t.type!=='obstacle')))return undefined
 const combat=snapshot.combat
 if(!combat||!(combat.active===false&&action.combatId===undefined)&&!(combat.active===true&&combat.mapId===row.mapId&&!!combat.combatId&&action.combatId===combat.combatId))return undefined
 return{action,owner,map}
}

export function mutateMastermindMisdirection(current,snapshot,identity,operation,input,now){
 if(!object(input)||!id(input.id)||!id(identity?.roomId)||!id(identity?.hostMemberId)||!id(identity?.memberId)||!['dm','player'].includes(identity.role)||!integer(now))return fail(403,'misdirection-member-required')
 const base=current??{schemaVersion:1,parents:{}};snapshot={...snapshot,'mastermind-misdirections':base}
 if(!validMastermindMisdirections(base))return fail(409,'invalid-misdirection-journal')
 const old=base.parents[input.id],host=identity.role==='dm'&&identity.memberId===identity.hostMemberId
 if(operation==='begin'||operation==='begin-native'){
  const keys=['id','parentTransactionId','mapId','attackerTokenId','ownerTokenId','ownerCharacterId','featureId','replacementTokenIds','sourceDefinitionSignature','versions',...(operation==='begin'?['opportunityOriginal']:[]),...(operation==='begin-native'?['nativeOriginal']:[]),'spellWindowOriginal','wardRetargetOriginal','redirectOriginal']
  if(!host)return fail(403,'misdirection-host-required')
  if(Object.keys(input).some(k=>!keys.includes(k))||input.redirectOriginal!==undefined&&!redirectOriginal(input.redirectOriginal)||input.wardRetargetOriginal!==undefined&&!wardRetargetOriginal(input.wardRetargetOriginal)||input.opportunityOriginal!==undefined&&!opportunityOriginal(input.opportunityOriginal)||(operation==='begin-native'&&!nativeOriginal(input.nativeOriginal,input.spellWindowOriginal!==undefined))||input.spellWindowOriginal!==undefined&&!spellWindowOriginal(input.spellWindowOriginal))return fail(400,'invalid-misdirection-parent')
  const owner=snapshot.characters?.characters?.find(c=>c.id===input.ownerCharacterId),row={...input,roomId:identity.roomId,hostMemberId:identity.hostMemberId,ownerMemberId:controller(owner,identity),phase:'waiting',issuedAt:now,revision:1}
  const original=currentOriginal(row,snapshot,identity)
  if(!original||!versionsMatch(row.versions,snapshot)||input.spellWindowOriginal!==undefined&&!old&&original.window.requests.length>0)return fail(409,'misdirection-original-changed')
  if(operation==='begin-native')row.nativeOriginal=structuredClone(original.nativeOriginal);else row.originalAction=structuredClone(original.action)
  if(old){const immutable=['parentTransactionId','mapId','attackerTokenId','ownerTokenId','ownerCharacterId','ownerMemberId','featureId','replacementTokenIds','sourceDefinitionSignature','versions','originalAction','nativeOriginal','opportunityOriginal','spellWindowOriginal','wardRetargetOriginal','redirectOriginal'];return immutable.every(k=>same(old[k],row[k]))?{ok:true,changed:false,next:base,id:old.id,phase:old.phase}:fail(409,'misdirection-parent-conflict')}
  const next={...base,parents:{...base.parents,[row.id]:row}}
  return validMastermindMisdirections(next)?{ok:true,changed:true,next,id:row.id,phase:row.phase}:fail(400,'invalid-misdirection-parent')
 }
 if(operation!=='answer'||Object.keys(input).some(k=>!['id','expectedRecordRevision','choice'].includes(k)))return fail(400,'invalid-misdirection-answer')
 if(!old||old.roomId!==identity.roomId||old.hostMemberId!==identity.hostMemberId)return fail(404,'misdirection-parent-not-found')
 const owner=snapshot.characters?.characters?.find(c=>c.id===old.ownerCharacterId)
 if(identity.memberId!==old.ownerMemberId||controller(owner,identity)!==identity.memberId)return fail(403,'misdirection-owner-required')
 if(input.choice!=='decline'&&!old.replacementTokenIds.includes(input.choice))return fail(400,'misdirection-candidate-required')
 if(old.phase==='answered')return old.answer.choice===input.choice?{ok:true,changed:false,next:base,id:old.id,phase:old.phase}:fail(409,'misdirection-answer-locked')
 if(input.expectedRecordRevision!==old.revision||!versionsMatch(old.versions,snapshot)||!currentOriginal(old,snapshot,identity)||!same(currentOriginal(old,snapshot,identity).action,old.originalAction))return fail(409,'misdirection-original-changed')
 const row={...old,phase:'answered',revision:old.revision+1,answer:{choice:input.choice,submittedByMemberId:identity.memberId,submittedAt:now}},next={...base,parents:{...base.parents,[old.id]:row}}
 return{ok:true,changed:true,next,id:row.id,phase:row.phase}
}

export function projectMastermindMisdirection(current,snapshot,identity,parentId){
 snapshot={...snapshot,'mastermind-misdirections':current};if(!validMastermindMisdirections(current)||!id(parentId))return fail(404,'misdirection-parent-not-found')
 const row=current.parents[parentId],owner=snapshot.characters?.characters?.find(c=>c.id===row?.ownerCharacterId),host=identity?.role==='dm'&&identity.memberId===identity.hostMemberId
 if(!row||row.roomId!==identity?.roomId)return fail(404,'misdirection-parent-not-found')
 if(!host&&!(identity?.role==='player'&&row.ownerMemberId===identity.memberId&&controller(owner,identity)===identity.memberId))return fail(403,'misdirection-owner-required')
 if(row.spellWindowOriginal){const combatId=row.originalAction?.combatId??row.nativeOriginal?.combatId,processed=snapshot['player-action-processed'],ack=snapshot['player-action-ack'];if(!Object.hasOwn(snapshot,'player-action-processed')||!Object.hasOwn(snapshot,'player-action-ack')||!versionsMatch(row.versions,snapshot)||processed?.mapId===row.mapId&&processed?.combatId===combatId&&Array.isArray(processed.actionIds)&&processed.actionIds.includes(row.parentTransactionId)||ack?.mapId===row.mapId&&ack?.combatId===combatId&&ack.actionId===row.parentTransactionId&&['accepted','rejected'].includes(ack.status))return fail(404,'misdirection-original-not-pending')}
 if((row.wardRetargetOriginal||row.redirectOriginal)&&!currentNativeOriginal(row,snapshot,identity))return fail(404,'misdirection-retarget-original-not-current');
 if(row.phase==='consumed')return fail(404,'misdirection-parent-completed')
 return{ok:true,parent:{id:row.id,mapId:row.mapId,ownerCharacterId:row.ownerCharacterId,ownerTokenId:row.ownerTokenId,phase:row.phase,revision:row.revision,canAnswer:row.ownerMemberId===identity.memberId&&controller(owner,identity)===identity.memberId,replacementTokenIds:[...row.replacementTokenIds],...(row.answer?{choice:row.answer.choice}:{} )}}
}

export function mastermindNativeMisdirectionTransactionId(row){return row.spellWindowOriginal?'mastermind-native-spell-window:'+row.spellWindowOriginal.sourceParentId:'mastermind-native-misdirection:'+row.id}
/** Only an already authenticated native owner decision can be consumed, with
 * exactly this original's world writes. It never grants a native result. */
export function mastermindNativeMisdirectionPublicationAllowed(current,next,snapshot,writes,transactionId,identity){
 if(!validMastermindMisdirections(current)||!validMastermindMisdirections(next)||identity?.role!=='dm'||identity.memberId!==identity.hostMemberId||!Array.isArray(writes)||writes.length!==4)return false
 if(!same(Object.keys(current.parents).sort(),Object.keys(next.parents).sort())||new Set(writes.map(w=>w.name)).size!==4||!['maps','characters','combat','mastermind-misdirections'].every(n=>writes.some(w=>w.name===n)))return false
 const changed=Object.keys(current.parents).filter(id=>!same(current.parents[id],next.parents[id]));
 if(changed.some(id=>current.parents[id].spellWindowOriginal!==undefined)){
  const p=snapshot.mastermindSpellSource?.ok&&snapshot.mastermindSpellSource.parent;if(!p||p.source.origin!=='native'||p.nextWindow!==p.original.targets.length||p.windows.length!==p.original.targets.length||p.windows.some(w=>w.phase!=='complete'||!w.input))return false;
  snapshot={...snapshot,'mastermind-misdirections':current};const rows=Object.values(current.parents).filter(row=>row.spellWindowOriginal?.sourceParentId===p.id);if(!rows.length||!same(changed.sort(),rows.map(row=>row.id).sort()))return false;
  const visited=new Set();for(const w of p.windows){const chain=readMastermindSpellOwnerChain(p,w,snapshot,identity);if(!chain.ok||chain.waiting||!same(w.input.coverAttackRedirect,chain.coverAttackRedirect)||w.input.targetId!==chain.targetId)return false;for(const row of chain.rows)visited.add(row.id);const extra=rows.filter(row=>row.spellWindowOriginal.windowIndex===w.index&&row.spellWindowOriginal.retargetStep!==undefined);if(extra.length){const steps=[...new Set(extra.map(row=>row.spellWindowOriginal.retargetStep))].sort((a,b)=>a-b);for(const step of steps){if(!integer(step)||step<1||step>128)return false;const nextOwner=readMastermindSpellOwnerChainAtRetargetTarget(p,w,snapshot,identity,step);if(!nextOwner.ok||nextOwner.waiting)return false;for(const row of nextOwner.rows){if(visited.has(row.id))return false;visited.add(row.id)}}}}if(visited.size!==rows.length)return false;
  return rows.every(before=>{const after=next.parents[before.id];if(!nativeOriginal(before.nativeOriginal,true)||before.originalAction!==undefined||before.phase!=='answered'||!before.answer||before.answer.submittedByMemberId!==before.ownerMemberId||before.roomId!==identity.roomId||before.hostMemberId!==identity.hostMemberId||!versionsMatch(before.versions,snapshot)||!currentNativeOriginal(before,snapshot,identity)||transactionId!==mastermindNativeMisdirectionTransactionId(before))return false;const authorityRevisions={characters:before.versions.characters+1,maps:before.versions.maps+1,combat:before.versions.combat+1,'mastermind-misdirections':revision(current)+1};return same(after,{...before,phase:'consumed',revision:before.revision+1,nativePublication:{transactionId,authorityRevisions}})&&writes.every(write=>write.expectedRevision===(write.name==='mastermind-misdirections'?revision(current):before.versions[write.name]))})
 }
 if(changed.length>1){
  snapshot={...snapshot,'mastermind-misdirections':current};const roots=changed.map(id=>current.parents[id]).filter(row=>!row.wardRetargetOriginal&&!row.redirectOriginal);if(roots.length!==1)return false;const root=roots[0],children=Object.values(current.parents).filter(row=>row.wardRetargetOriginal?.rootParentId===root.id||row.redirectOriginal?.rootParentId===root.id);if(!children.length||!same(changed.sort(),[root.id,...children.map(row=>row.id)].sort()))return false;
  if(children.some(row=>row.phase!=='answered'||row.answer?.submittedByMemberId!==row.ownerMemberId||!currentNativeOriginal(row,snapshot,identity)||transactionId!==mastermindNativeMisdirectionTransactionId(root)))return false;
  const expectedRevisions={characters:root.versions.characters+1,maps:root.versions.maps+1,combat:root.versions.combat+1,'mastermind-misdirections':revision(current)+1};if(children.some(row=>!same(next.parents[row.id],{...row,phase:'consumed',revision:row.revision+1,nativePublication:{transactionId,authorityRevisions:expectedRevisions}})))return false;
  const singleCurrent={...current,parents:{...current.parents}},singleNext={...next,parents:{...next.parents}};for(const child of children){delete singleCurrent.parents[child.id];delete singleNext.parents[child.id]}return mastermindNativeMisdirectionPublicationAllowed(singleCurrent,singleNext,snapshot,writes,transactionId,identity)
 }
 if(changed.length!==1)return false
 const before=current.parents[changed[0]],after=next.parents[changed[0]];if(before.wardRetargetOriginal||before.redirectOriginal||Object.values(current.parents).some(row=>row.wardRetargetOriginal?.rootParentId===before.id||row.redirectOriginal?.rootParentId===before.id))return false
 if(!nativeOriginal(before.nativeOriginal,before.spellWindowOriginal!==undefined)||before.originalAction!==undefined||before.phase!=='answered'||!before.answer||before.answer.submittedByMemberId!==before.ownerMemberId||before.roomId!==identity.roomId||before.hostMemberId!==identity.hostMemberId||!versionsMatch(before.versions,snapshot)||!currentNativeOriginal(before,snapshot,identity)||transactionId!==mastermindNativeMisdirectionTransactionId(before))return false
 const expectedRevisions={characters:before.versions.characters+1,maps:before.versions.maps+1,combat:before.versions.combat+1,'mastermind-misdirections':revision(current)+1}
 if(!same(after,{...before,phase:'consumed',revision:before.revision+1,nativePublication:{transactionId,authorityRevisions:expectedRevisions}}))return false
 return writes.every(w=>w.expectedRevision===(w.name==='mastermind-misdirections'?revision(current):before.versions[w.name]))
}
