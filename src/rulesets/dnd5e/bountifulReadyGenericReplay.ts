import {saveBountifulPhase} from './bountifulPhaseCommit'
import {validateBountifulReadyD20Followup} from '../../../shared/bountiful-ready-d20-host-gate.mjs'
import {validateBountifulReadyParents} from '../../../shared/bountiful-ready-parents.mjs'
import {readBountifulSpellOriginalReadyFrame,type BountifulReadyParentData} from './bountifulOriginalReadyFrame'
import {createD20RollConfirmationInterrupt} from '../../lib/rollConfirmation'
import {finishCombatInterrupt} from '../../lib/combatInterruptQueue'
import type {SharedCombatState} from '../../lib/sharedCombatTypes'
import {inspectBountifulSpellOriginalReadyFrame} from './bountifulOriginalReadyFrame'
import {bountifulOriginalRawForActor} from './bountifulSpellTargetRaw'
import {originalD20ReplaySourceKey,type OriginalD20ReplayFacts} from './allyNaturalOneCheckpoint'
import {dnd5eD20ChoiceRerollFeaturesForCharacter} from './pluginApi'
import {dnd5eCoreInspirationChoiceRerollOption} from '../../lib/d20InterruptPolicy'
import {settleD20RollConfirmation} from '../../lib/rollConfirmation'
import {isCombatInterruptKind} from '../../lib/combatInterruptProtocol'
import type {SharedCombatInterruptQueueState} from '../../lib/combatInterruptQueue'
import type {SharedRoomGatewayPort} from '../../ports/sharedRoomGateway'
import type {Character} from '../../types/character'
import type {D20ChoiceRerollInterruptContribution} from '../../lib/combatInterruptQueue'
import {consumeDnd5eBountifulDeferredD20} from './bountifulDeferredD20Mechanics'
import {DND5E_CORE_INSPIRATION_RESOURCE_KEY} from '../../lib/d20InterruptPolicy'
import {attachBountifulReadySource} from './bountifulReadySource'
import {decodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {restoreSecondChancePreparedHostFactsAsync} from '../../pages/maps/secondChancePreparedHostFacts'
const same=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right)
/** Prototype native replay proof only. The frame is an actual private issuer,
 * and the selected generic contribution is reread from its actual queue.
 * This does not yet journal the response or consume the public original ACK. */
export async function captureBountifulReadyGenericReplay(frame:object,input:{interruptId:string;contributionId:string;dieIndex:number},gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const [characters,queue]=await Promise.all([gateway.loadResource<{characters:Character[]}>('characters'),gateway.loadResource<SharedCombatInterruptQueueState>('combat-interrupts')])
 if(!characters||!queue||queue.mapId!==facts.parent.mapId||!Number.isInteger(input.dieIndex)||input.dieIndex<0||input.dieIndex>=facts.request.originalRolls.length)throw Error('bountiful-ready-generic:original-request-required')
 const raw=bountifulOriginalRawForActor(facts.source,facts.request.actorId,facts.request.kind,facts.request.originalRolls)
 const prompt=queue.interrupts.find(row=>row.id===input.interruptId)
 const owner=characters.characters.find(row=>row.id===facts.controller.characterId)
 if(!owner||!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||prompt.id!=='roll-confirmation:'+bountifulReadyFollowupRollId(frame,raw.hostOriginalRollId,input.dieIndex)||prompt.transactionId!=='d20-confirmation:'+prompt.payload.rollId||prompt.actorCharId!==owner.id||!validateBountifulReadyD20Followup(prompt.payload.bountifulReadyParent,prompt.payload.rollId)||prompt.phase!=='after-roll'||prompt.status!=='rolling'||prompt.payload.originalValue!==facts.request.originalRolls[input.dieIndex]||prompt.payload.rollId!==bountifulReadyFollowupRollId(frame,raw.hostOriginalRollId,input.dieIndex)||facts.request.finalizedDice.includes(input.dieIndex))throw Error('bountiful-ready-generic:authenticated-original-request-required')
 const contribution=prompt.contributions?.find(row=>row.id===input.contributionId)
 if(!contribution||contribution.kind!=='choice-reroll'||contribution.decision!=='use'||contribution.characterId!==owner.id||contribution.id!==prompt.id+':'+owner.id+':choice-reroll')throw Error('bountiful-ready-generic:authenticated-contribution-required')
 const response=settleD20RollConfirmation(prompt,contribution.id,1,undefined,undefined,undefined,contribution.selectedIndex),choice=response.choiceReroll
 const mode=facts.request.rollMode??(facts.request.originalRolls.length===1?'normal':undefined)
 if(!choice||!mode||choice.scope!=='self-roll'||choice.selectedIndex===undefined||!choice.rerollValues||!choice.selectionPolicy)throw Error('bountiful-ready-generic:actual-choice-required')
 const core=dnd5eCoreInspirationChoiceRerollOption(owner,facts.request.actorId,mode)
 const plugin=dnd5eD20ChoiceRerollFeaturesForCharacter(owner,facts.request.kind,'self-roll',prompt.payload.originalValue,{rollMode:mode,attackAbility:facts.request.attackAbility}).find(row=>row.feature.id===contribution.featureId&&row.feature.automation==='full'&&row.feature.declarativeAbility?.automation==='full')
 const eligible=core?.featureId===contribution.featureId?core:plugin?{featureId:plugin.feature.id,resourceCosts:plugin.resourceCosts,additionalDice:plugin.additionalDice,selectionPolicy:plugin.selectionPolicy}:undefined
 if(!eligible||!same(eligible.resourceCosts,choice.resourceCosts)||(eligible.additionalDice??1)!==choice.rerollValues.length||(eligible.selectionPolicy??'owner-chooses')!==choice.selectionPolicy)throw Error('bountiful-ready-generic:current-source-or-cost-required')
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 if(!('id'in frame)||typeof frame.id!=='string')throw Error('bountiful-ready-generic:private-frame-required')
 const binding:OriginalD20ReplayFacts={parentId:facts.parent.id,sourceKey:originalD20ReplaySourceKey(facts.parent.id,facts.source.prepared.state,facts.parent),facts:[],readyFrames:[{frameId:frame.id,request:facts.request,choices:[{schemaVersion:1,kind:'choice-reroll',parentId:facts.parent.id,readyFrameId:frame.id,readyOrdinal:facts.request.ordinal!,actorId:facts.request.actorId,characterId:owner.id,rawRollId:raw.hostOriginalRollId,interruptId:prompt.id,contributionId:contribution.id,dieIndex:input.dieIndex,originalValue:choice.originalValue,selectedValue:choice.selectedValue,rerollValues:[...choice.rerollValues],selectedIndex:choice.selectedIndex,selectionPolicy:choice.selectionPolicy,featureId:contribution.featureId,resourceCosts:choice.resourceCosts.map(row=>({...row}))}]}]}
 return {source:facts.source,binding,response,prompt:structuredClone(prompt)}
}

type Gateway=Pick<SharedRoomGatewayPort,'loadResource'|'saveResourcesAtomically'>
type Snapshot<T>=T&{_sync?:{revision?:number}}
type Combat=SharedCombatState&{bountifulReadyParents?:Record<string,BountifulReadyParentData>}
const revision=(value:Snapshot<object>|null)=>{const revision=value?._sync?.revision;if(!Number.isSafeInteger(revision)||revision!<0)throw Error('bountiful-ready-generic:revision-required');return revision!}
export function bountifulReadyFollowupRollId(frame:object,rawRollId:string,dieIndex:number){
 if(!('id'in frame)||typeof frame.id!=='string'||!Number.isInteger(dieIndex)||dieIndex<0||dieIndex>1||!rawRollId)throw Error('bountiful-ready-generic:lineage-required')
 return JSON.stringify(['bountiful-ready-d20-followup',frame.id,rawRollId,dieIndex])
}
/** The Host creates the exact eligible offer from this private native frame.
 * No caller supplies a prepared state, roll mode, resources, or offered source. */
export async function issueBountifulReadyGenericPrompt(input:{mapId:string;frameId:string;dieIndex:number},gateway:Gateway){
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.mapId,id:input.frameId},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 if(!Number.isInteger(input.dieIndex)||input.dieIndex<0||input.dieIndex>=facts.request.originalRolls.length)throw Error('bountiful-ready-generic:original-die-required')
 const raw=bountifulOriginalRawForActor(facts.source,facts.request.actorId,facts.request.kind,facts.request.originalRolls),[characters,queue]=await Promise.all([gateway.loadResource<Snapshot<{characters:Character[]}>>('characters'),gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>('combat-interrupts')])
 const owner=characters?.characters.find(row=>row.id===facts.controller.characterId),mode=facts.request.rollMode
 if(!owner||!mode||queue&&queue.mapId!==input.mapId)throw Error('bountiful-ready-generic:current-owner-required')
 const core=dnd5eCoreInspirationChoiceRerollOption(owner,facts.request.actorId,mode),plugins=dnd5eD20ChoiceRerollFeaturesForCharacter(owner,facts.request.kind,'self-roll',facts.request.originalRolls[input.dieIndex],{rollMode:mode,attackAbility:facts.request.attackAbility}).filter(row=>row.feature.automation==='full'&&row.feature.declarativeAbility?.automation==='full')
 const eligibleModifiers=[...(core?[{characterId:owner.id,featureId:core.featureId,featureLabel:core.featureLabel,modifierKind:'choice-reroll' as const,rerollScope:'self-roll' as const,resourceCosts:core.resourceCosts,additionalDice:core.additionalDice,selectionPolicy:core.selectionPolicy}]:[]),...plugins.map(row=>({characterId:owner.id,featureId:row.feature.id,featureLabel:row.feature.name,modifierKind:'choice-reroll' as const,rerollScope:'self-roll' as const,resourceCosts:row.resourceCosts,additionalDice:row.additionalDice,selectionPolicy:row.selectionPolicy}))]
 const rollId=bountifulReadyFollowupRollId(frame,raw.hostOriginalRollId,input.dieIndex),prompt=createD20RollConfirmationInterrupt({mapId:input.mapId,combatId:facts.parent.combatId,rollId,label:'Original saving throw',originalValue:facts.request.originalRolls[input.dieIndex],rollerCharacterId:owner.id,eligibleModifiers})
 prompt.payload.bountifulReadyParent={frameId:input.frameId,rawRollId:raw.hostOriginalRollId,dieIndex:input.dieIndex}
 const prior=queue?.interrupts.find(row=>row.id===prompt.id)
 if(prior){if(!isCombatInterruptKind(prior,'roll-confirmation')||!same(prior.payload,prompt.payload)||prior.actorCharId!==owner.id)throw Error('bountiful-ready-generic:conflicting-prompt');return prior}
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 await saveBountifulPhase(gateway,[{name:'combat-interrupts',expectedRevision:queue?revision(queue):0,data:{...queue,mapId:input.mapId,interrupts:[...(queue?.interrupts??[]),prompt],updatedAt:1}}],{transactionId:'bountiful-ready-prompt:'+prompt.id,readRevisions:facts.versions})
 return prompt
}
/** Journals the actual generic choice plus completed prompt in one metadata CAS.
 * Character fees and HP remain exclusively for the original final ACK. */
export async function deferBountifulReadyGenericChoice(input:{mapId:string;frameId:string;interruptId:string;contributionId:string;dieIndex:number},gateway:Gateway){
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.mapId,id:input.frameId},gateway)
 const [priorCombat,priorQueue]=await Promise.all([gateway.loadResource<Snapshot<Combat>>('combat'),gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>('combat-interrupts')])
 if(priorCombat&&validateBountifulReadyParents(priorCombat.bountifulReadyParents)){
  const existing=priorCombat.bountifulReadyParents?.[input.frameId]?.postReadyD20?.find(row=>row.interruptId===input.interruptId)
  if(existing){
   const prompt=priorQueue?.interrupts.find(row=>row.id===input.interruptId),response=prompt&&isCombatInterruptKind(prompt,'roll-confirmation')?prompt.response:undefined,choice=response?.choiceReroll
   if(!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||prompt.status!=='done'||prompt.actorCharId!==existing.characterId||prompt.id!=='roll-confirmation:'+bountifulReadyFollowupRollId(frame,existing.rawRollId,existing.dieIndex)||!validateBountifulReadyD20Followup(prompt.payload.bountifulReadyParent,prompt.payload.rollId)||existing.contributionId!==input.contributionId||existing.dieIndex!==input.dieIndex||!response||response.acceptedContributionId!==existing.contributionId||response.finalValue!==existing.selectedValue||!choice||choice.characterId!==existing.characterId||choice.featureId!==existing.featureId||choice.originalValue!==existing.originalValue||choice.selectedValue!==existing.selectedValue||choice.selectedIndex!==existing.selectedIndex||choice.selectionPolicy!==existing.selectionPolicy||!same(choice.rerollValues,existing.rerollValues)||!same(choice.resourceCosts,existing.resourceCosts))throw Error('bountiful-ready-generic:completed-choice-evidence-required')
   await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
   return structuredClone(response)
  }
 }
 const captured=await captureBountifulReadyGenericReplay(frame,input,gateway),[combat,queue]=await Promise.all([gateway.loadResource<Snapshot<Combat>>('combat'),gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>('combat-interrupts')])
 if(!combat||!queue||!validateBountifulReadyParents(combat.bountifulReadyParents))throw Error('bountiful-ready-generic:actual-private-record-required')
 const saved=combat.bountifulReadyParents?.[input.frameId],choice=captured.binding.readyFrames?.[0].choices[0],prompt=queue.interrupts.find(row=>row.id===input.interruptId)
 if(!saved||!choice||!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||prompt.status!=='rolling'||!same(prompt,captured.prompt))throw Error('bountiful-ready-generic:actual-rolling-choice-required')
 const existing=saved.postReadyD20??[]
 if(existing.some(row=>row.dieIndex===choice.dieIndex))throw Error('bountiful-ready-generic:die-already-finalized')
 const records={...combat.bountifulReadyParents,[saved.id]:{...saved,postReadyD20:[...existing,choice]}}
 if(!validateBountifulReadyParents(records))throw Error('bountiful-ready-generic:invalid-private-journal')
 const finished=finishCombatInterrupt(queue,prompt.id,captured.response,1);if(!finished)throw Error('bountiful-ready-generic:retired-prompt')
 const facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const {combat:_combat,...readRevisions}=facts.versions;void _combat
 const result=await saveBountifulPhase(gateway,[{name:'combat',expectedRevision:revision(combat),data:{...combat,bountifulReadyParents:records}},{name:'combat-interrupts',expectedRevision:revision(queue),data:finished}],{transactionId:'bountiful-ready-defer:'+prompt.id,readRevisions})
 if(result.status!=='committed')throw Error('bountiful-ready-generic:journal-not-committed')
 return captured.response
}
export async function readBountifulReadyGenericReplay(input:{mapId:string;frameId:string},gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const frame=await readBountifulSpellOriginalReadyFrame({mapId:input.mapId,id:input.frameId},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway),combat=await gateway.loadResource<Snapshot<Combat>>('combat')
 if(!combat||!validateBountifulReadyParents(combat.bountifulReadyParents))throw Error('bountiful-ready-generic:actual-private-record-required')
 const saved=combat.bountifulReadyParents?.[input.frameId];if(!saved)throw Error('bountiful-ready-generic:record-required')
 const attached=await attachBountifulReadySource({action:facts.parent,source:facts.source},gateway),binding=attached.hostOriginalD20Replay
 if(!binding)throw Error('bountiful-ready-generic:actual-replay-required')
 if(!saved.continuation)return {source:facts.source,binding}
 const restored=await restoreSecondChancePreparedHostFactsAsync(decodeSecondChanceParentWire(saved.continuation.source))
 if(!restored||typeof restored!=='object'||!('prepared'in restored)||!same(restored.prepared,facts.source.prepared))throw Error('bountiful-ready-generic:changed-native-continuation')
 const source={...facts.source,...restored,prepared:facts.source.prepared}
 return {source,binding}
}

/** Native ready-frame variant of the locked extra-die request. The prompt and
 * accepted original-roller contribution are reread, not adopted from the UI. */
export async function prepareBountifulReadyExtraD20(input:{mapId:string;interruptId:string;acceptedContributionId:string;expectedContribution:D20ChoiceRerollInterruptContribution},gateway:Pick<SharedRoomGatewayPort,'loadResource'>){
 const queue=await gateway.loadResource<Snapshot<SharedCombatInterruptQueueState>>('combat-interrupts'),prompt=queue?.interrupts.find(row=>row.id===input.interruptId)
 if(!queue||queue.mapId!==input.mapId||!prompt||!isCombatInterruptKind(prompt,'roll-confirmation')||!validateBountifulReadyD20Followup(prompt.payload.bountifulReadyParent,prompt.payload.rollId))throw Error('bountiful-ready-extra:actual-bound-prompt-required')
 const scope=prompt.payload.bountifulReadyParent,frame=await readBountifulSpellOriginalReadyFrame({mapId:input.mapId,id:scope.frameId},gateway),facts=await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const raw=bountifulOriginalRawForActor(facts.source,facts.request.actorId,facts.request.kind,facts.request.originalRolls)
 const contribution=prompt.contributions?.find(row=>row.id===input.acceptedContributionId)
 if(prompt.id!=='roll-confirmation:'+bountifulReadyFollowupRollId(frame,raw.hostOriginalRollId,scope.dieIndex)||scope.rawRollId!==raw.hostOriginalRollId||prompt.transactionId!=='d20-confirmation:'+prompt.payload.rollId||prompt.mapId!==input.mapId||prompt.phase!=='after-roll'||prompt.status!=='rolling'||prompt.payload.rollOptions!==undefined||prompt.payload.originalValue!==facts.request.originalRolls[scope.dieIndex]||prompt.actorCharId!==facts.controller.characterId||!contribution||contribution.kind!=='choice-reroll'||contribution.decision!=='use'||contribution.characterId!==facts.controller.characterId||contribution.id!==prompt.id+':'+contribution.characterId+':choice-reroll'||!same(contribution,input.expectedContribution))throw Error('bountiful-ready-extra:locked-original-contribution-required')
 const characters=await gateway.loadResource<{characters:Character[]}>('characters'),owner=characters?.characters.find(row=>row.id===facts.controller.characterId),mode=facts.request.rollMode
 if(!owner||!mode)throw Error('bountiful-ready-extra:actual-original-owner-required')
 const core=dnd5eCoreInspirationChoiceRerollOption(owner,facts.request.actorId,mode),plugin=dnd5eD20ChoiceRerollFeaturesForCharacter(owner,facts.request.kind,'self-roll',prompt.payload.originalValue,{rollMode:mode,attackAbility:facts.request.attackAbility}).find(row=>row.feature.id===contribution.featureId&&row.feature.automation==='full'&&row.feature.declarativeAbility?.automation==='full')
 const eligible=core?.featureId===contribution.featureId?core:plugin?{featureId:plugin.feature.id,featureLabel:plugin.feature.name,resourceCosts:plugin.resourceCosts,additionalDice:plugin.additionalDice,selectionPolicy:plugin.selectionPolicy}:undefined
 const offered=prompt.payload.eligibleModifiers?.find(row=>row.characterId===owner.id&&row.featureId===contribution.featureId&&row.modifierKind==='choice-reroll'&&row.rerollScope==='self-roll')
 if(!eligible||!offered||offered.featureLabel!==contribution.featureLabel||eligible.featureLabel!==contribution.featureLabel||!same(eligible.resourceCosts,offered.resourceCosts)||(eligible.additionalDice??1)!==(offered.additionalDice??1)||(eligible.selectionPolicy??'owner-chooses')!==(offered.selectionPolicy??'owner-chooses'))throw Error('bountiful-ready-extra:current-source-required')
 const current=await readBountifulReadyGenericReplay({mapId:input.mapId,frameId:scope.frameId},gateway),prior=current.binding.readyFrames?.[0].choices??[]
 if(prior.some(row=>row.dieIndex===scope.dieIndex))throw Error('bountiful-ready-extra:die-already-finalized')
 const actor=structuredClone(facts.snapshot.combatants[facts.request.actorId])
 if(!actor)throw Error('bountiful-ready-extra:actual-actor-required')
 consumeDnd5eBountifulDeferredD20(actor,facts.request.kind,facts.request.originalRolls,prior,[],new Set(facts.request.finalizedDice),{rollMode:mode,attackAbility:facts.request.attackAbility})
 if(!eligible.resourceCosts?.length||eligible.resourceCosts.some(cost=>!Number.isSafeInteger(cost.amount)||cost.amount<1||(cost.resourceKey===DND5E_CORE_INSPIRATION_RESOURCE_KEY?(actor.inspiration??0)<cost.amount:(actor.classResources[cost.resourceKey]?.current??0)<cost.amount)))throw Error('bountiful-ready-extra:current-cost-unavailable')
 const fresh=await gateway.loadResource<SharedCombatInterruptQueueState>('combat-interrupts')
 if(fresh?.mapId!==input.mapId||!same(fresh.interrupts.find(row=>row.id===prompt.id),prompt))throw Error('bountiful-ready-extra:changed-locked-prompt')
 await inspectBountifulSpellOriginalReadyFrame(frame,gateway)
 const signature=JSON.stringify([scope,facts.parent,facts.request,contribution,eligible]),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(signature)),hex=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
 return {rollRequestId:'bountiful-ready-extra-d20:'+hex,count:eligible.additionalDice??1,rollerCharacterId:owner.id}
}
