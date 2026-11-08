import { endDnd5eConcentration, type Dnd5eCombatant, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { dnd5eConditionIncapacitated } from './conditions'
import { registerDnd5eHostReceipt } from './hostTransactionClone'
import { dnd5eLongCastingSignature as signature, dnd5eLongCastingConcentrationId, type Dnd5eLongCastingBinding } from './longCastingIdentity'
export { dnd5eLongCastingConcentrationId, type Dnd5eLongCastingBinding } from './longCastingIdentity'
declare const receiptBrand: unique symbol
export interface Dnd5eLongCastingReceipt { readonly [receiptBrand]: true }
interface CombatCastingProgress {combatId:string;requiredRounds:number;startRound:number;paidRounds:number;lastRound:number}
const receipts = new WeakMap<Dnd5eLongCastingReceipt, { signature: string; valid: boolean; started?: true; requiredSeconds?: number;combat?:CombatCastingProgress;
  exploration?:{remainingSeconds:number;readyAtWorldMinute:number};explorationStartedAtWorldMinute?:number }>()
/** A Host-issued proposal is armed only after its action expenditure is published. */
export interface Dnd5eLongCastingTurnProposal {readonly state:Dnd5eHeadlessCombatState}
const turnProposals=new WeakMap<Dnd5eLongCastingTurnProposal,{receipt:Dnd5eLongCastingReceipt;round:number;combat:CombatCastingProgress}>()
const activeSignatures = new Set<string>()
/** Only timed Host sessions can authorize a timed Activity. Legacy untimed
 * receipts cannot be used as proof that a minute/hour activation elapsed. */
export function dnd5eLongCastingHasDuration(receipt:Dnd5eLongCastingReceipt|undefined,
 binding:Dnd5eLongCastingBinding,requiredSeconds:number):boolean {
  const stored=receipt&&receipts.get(receipt)
  return !!stored?.valid && stored.signature===signature(binding) &&
    Number.isSafeInteger(requiredSeconds) && requiredSeconds>0 && stored.requiredSeconds===requiredSeconds
}
/** Local Host liveness, not a serialized permission to resume a cast. */
export function dnd5eLongCastingLocallyActive(binding: Dnd5eLongCastingBinding): boolean {
  return activeSignatures.has(signature(binding))
}
export function dnd5eLongCastingStarted(receipt: Dnd5eLongCastingReceipt | undefined): boolean {
  return !!receipt && receipts.get(receipt)?.started === true
}
export function dnd5eLongCastingCanComplete(receipt:Dnd5eLongCastingReceipt|undefined,
 binding?:Dnd5eLongCastingBinding,state?:Dnd5eHeadlessCombatState):boolean{
  const stored=receipt?receipts.get(receipt):undefined
  if(!stored?.valid||!stored.started)return false
  if(stored.exploration)return !!binding&&!!state&&!state.active&&stored.signature===signature(binding)&&
    observeDnd5eLongCasting(receipt,binding,state.combatants[binding.actorTokenId])&&
    Number.isSafeInteger(state.combatants[binding.actorTokenId].campaignWorldMinute)&&
    state.combatants[binding.actorTokenId].campaignWorldMinute!>=stored.exploration.readyAtWorldMinute
  if(!stored.combat)return true
  // The exploration deadline can elapse before a new combat is published.
  // In that case no additional six-second action is owed.
  if(stored.combat.requiredRounds===0)return !!binding&&!!state&&stored.signature===signature(binding)&&
    state.active&&state.combatId===stored.combat.combatId&&
    observeDnd5eLongCasting(receipt,binding,state.combatants[binding.actorTokenId])
  return !!binding&&!!state&&stored.signature===signature(binding)&&stored.combat.paidRounds===stored.combat.requiredRounds&&
    state.round===stored.combat.lastRound&&castingTurn(state,binding,stored.combat)&&
    observeDnd5eLongCasting(receipt,binding,state.combatants[binding.actorTokenId])&&
    !state.combatants[binding.actorTokenId].turn.actionAvailable
}
/** Transfer only a live Host receipt after combat ends, retaining paid actions.
 * The campaign clock has whole-minute precision; completion waits until the
 * first representable minute at or after the remaining casting seconds.
 */
export function continueDnd5eLongCastingOutsideCombat(receipt:Dnd5eLongCastingReceipt|undefined,
 binding:Dnd5eLongCastingBinding,state:Dnd5eHeadlessCombatState,worldMinute:number):
 Readonly<{remainingSeconds:number;readyAtWorldMinute:number}>|undefined{
  const stored=receipt?receipts.get(receipt):undefined,combat=stored?.combat
  if(!stored?.valid||!stored.started||!combat||stored.signature!==signature(binding)||state.active||
    state.combatId!==combat.combatId||!Number.isSafeInteger(worldMinute)||worldMinute<0||
    state.round<combat.lastRound||state.round>combat.lastRound+1||
    !observeDnd5eLongCasting(receipt,binding,state.combatants[binding.actorTokenId]))return undefined
  // Repeated observation must never postpone or shorten the original deadline.
  if(stored.exploration)return {...stored.exploration}
  const remainingSeconds=(combat.requiredRounds-combat.paidRounds)*6
  const readyAtWorldMinute=worldMinute+Math.ceil(remainingSeconds/60)
  if(!Number.isSafeInteger(readyAtWorldMinute))return undefined
  stored.exploration={remainingSeconds,readyAtWorldMinute}
  stored.explorationStartedAtWorldMinute=worldMinute
  return {...stored.exploration}
}
/** Rebind a live Host receipt to a published new combat without spending an
 * action. Subsequent prepare/arm calls still require the actual turn commit.
 * The caller supplies the authority snapshot, never a player progress count.
 */
export function continueDnd5eLongCastingInsideCombat(receipt:Dnd5eLongCastingReceipt|undefined,
 binding:Dnd5eLongCastingBinding,state:Dnd5eHeadlessCombatState,worldMinute:number):
 Readonly<{combatId:string;requiredRounds:number;lastPaidRound:number}>|undefined{
  const stored=receipt?receipts.get(receipt):undefined,exploration=stored?.exploration
  if(!stored?.valid||!stored.started||!exploration||stored.signature!==signature(binding)||
    !state.active||!state.combatId?.trim()||state.combatId===stored.combat?.combatId||
    !Number.isSafeInteger(state.round)||state.round<1||
    !Number.isSafeInteger(state.initiativeIndex)||state.initiativeIndex<0||state.initiativeIndex>=state.initiativeOrder.length||
    !Number.isSafeInteger(worldMinute)||stored.explorationStartedAtWorldMinute===undefined||
    worldMinute<stored.explorationStartedAtWorldMinute||
    !observeDnd5eLongCasting(receipt,binding,state.combatants[binding.actorTokenId]))return undefined
  const actorIndices=state.initiativeOrder.flatMap((id,index)=>id===binding.actorTokenId?[index]:[])
  if(actorIndices.length!==1)return undefined
  const remainingSeconds=Math.max(0,exploration.remainingSeconds-(worldMinute-stored.explorationStartedAtWorldMinute)*60)
  const requiredRounds=Math.ceil(remainingSeconds/6)
  const startRound=state.round+(actorIndices[0]<state.initiativeIndex?1:0)
  if(!Number.isSafeInteger(startRound))return undefined
  stored.combat={combatId:state.combatId,requiredRounds,startRound,paidRounds:0,lastRound:startRound-1}
  delete stored.exploration
  delete stored.explorationStartedAtWorldMinute
  return {combatId:state.combatId,requiredRounds,lastPaidRound:startRound-1}
}
function castingTurn(state:Dnd5eHeadlessCombatState,binding:Dnd5eLongCastingBinding,combat:CombatCastingProgress):boolean{
  return state.active&&state.combatId===combat.combatId&&state.initiativeOrder[state.initiativeIndex]===binding.actorTokenId
}
export function prepareDnd5eLongCastingCombatTurn(receipt:Dnd5eLongCastingReceipt|undefined,
 binding:Dnd5eLongCastingBinding,input:Dnd5eHeadlessCombatState):Dnd5eLongCastingTurnProposal|undefined{
  const stored=receipt?receipts.get(receipt):undefined,combat=stored?.combat
  if(stored?.exploration)return undefined
  if(stored?.started&&combat&&input.combatId===combat.combatId&&input.round>combat.lastRound+1){
    invalidateDnd5eLongCasting(receipt);return undefined
  }
  if(!receipt||!stored?.started||!combat||!observeDnd5eLongCasting(receipt,binding,input.combatants[binding.actorTokenId])||
   !castingTurn(input,binding,combat)||combat.paidRounds>=combat.requiredRounds||input.round!==combat.lastRound+1||
   !input.combatants[binding.actorTokenId].turn.actionAvailable)return undefined
  const state=structuredClone(input)
  state.combatants[binding.actorTokenId].turn.actionAvailable=false
  const proposal=registerDnd5eHostReceipt(Object.freeze({state}))
  turnProposals.set(proposal,{receipt,round:input.round,combat})
  return proposal
}
export function armDnd5eLongCastingCombatTurn(proposal:Dnd5eLongCastingTurnProposal,
 binding:Dnd5eLongCastingBinding,published:Dnd5eHeadlessCombatState):boolean{
  const issued=turnProposals.get(proposal),stored=issued&&receipts.get(issued.receipt),combat=stored?.combat
  if(!issued||!stored||stored.exploration||!combat||issued.combat!==combat||stored.signature!==signature(binding)||issued.round!==combat.lastRound+1||
   published.round!==issued.round||!castingTurn(published,binding,combat)||
   !observeDnd5eLongCasting(issued.receipt,binding,published.combatants[binding.actorTokenId])||
   published.combatants[binding.actorTokenId].turn.actionAvailable)return false
  turnProposals.delete(proposal);combat.lastRound=issued.round;combat.paidRounds++
  return true
}
export function invalidateDnd5eLongCasting(receipt: Dnd5eLongCastingReceipt | undefined): void {
  const stored = receipt ? receipts.get(receipt) : undefined
  if (stored) {
    stored.valid = false
    if (stored.started) activeSignatures.delete(stored.signature)
  }
}
/** Build before publishing. Arm only after Host has applied the start state. */
export function beginDnd5eLongCasting(receipt: Dnd5eLongCastingReceipt | undefined,
  binding: Dnd5eLongCastingBinding, input: Dnd5eHeadlessCombatState): Dnd5eHeadlessCombatState | undefined {
  const stored = receipt ? receipts.get(receipt) : undefined
  if (!stored || !stored.valid || stored.started || stored.signature !== signature(binding) ||
    !capable(input.combatants[binding.actorTokenId], binding)) return undefined
  if(stored.combat&&(!castingTurn(input,binding,stored.combat)||input.round!==stored.combat.startRound||
   !input.combatants[binding.actorTokenId].turn.actionAvailable))return undefined
  if(stored.exploration&&(input.active||input.combatants[binding.actorTokenId].campaignWorldMinute!==stored.explorationStartedAtWorldMinute))return undefined
  const state = structuredClone(input), actor = state.combatants[binding.actorTokenId]
  if (actor.concentrating || actor.classState.concentrationSpellId) endDnd5eConcentration(state, actor, [])
  actor.concentrating = true
  actor.classState.concentrationSpellId = dnd5eLongCastingConcentrationId(binding)
  actor.classState.concentrationTargetIds = [actor.id]
  actor.classState.concentrationSpellLevel = undefined
  actor.classState.concentrationRoundsRemaining = undefined
  actor.classState.concentrationStartedTurnKey = undefined
  actor.classState.concentrationTickOn = undefined
  actor.classState.concentrationLastTickTurnKey = undefined
  if(stored.combat)actor.turn.actionAvailable=false
  return state
}
export function armDnd5eLongCasting(receipt: Dnd5eLongCastingReceipt | undefined,
  binding: Dnd5eLongCastingBinding, actor: Dnd5eCombatant | undefined): boolean {
  const stored = receipt ? receipts.get(receipt) : undefined
  if (!stored || stored.started || !stored.valid || stored.signature !== signature(binding)) return false
  if(stored.exploration&&actor?.campaignWorldMinute!==stored.explorationStartedAtWorldMinute)return false
  stored.valid = capable(actor, binding) && actor!.concentrating && actor!.classState.concentrationSpellId === dnd5eLongCastingConcentrationId(binding)
  if (stored.valid) {
    stored.started = true
    if(stored.combat){
      if(actor!.turn.actionAvailable){stored.valid=false;return false}
      stored.combat.paidRounds=1;stored.combat.lastRound=stored.combat.startRound
    }
    activeSignatures.add(stored.signature)
  }
  return stored.valid
}
/** Health and incapacity only. Damage concentration checks require their own settlement. */
function capable(actor: Dnd5eCombatant | undefined, binding: Dnd5eLongCastingBinding): boolean {
  return !!actor && actor.id === binding.actorTokenId && Number.isFinite(actor.currentHp) &&
    actor.currentHp > 0 && !actor.deathSaves.dead && !dnd5eConditionIncapacitated(actor)
}
export function captureDnd5eLongCasting(binding: Dnd5eLongCastingBinding,
  actor: Dnd5eCombatant | undefined,combat?:{combatId:string;requiredRounds:number;startRound:number},
  exploration?:{startedAtWorldMinute:number;requiredSeconds:number}): Dnd5eLongCastingReceipt | undefined {
  if (!capable(actor, binding)) return undefined
  if(exploration&&(combat||!Number.isSafeInteger(exploration.startedAtWorldMinute)||exploration.startedAtWorldMinute<0||
    !Number.isSafeInteger(exploration.requiredSeconds)||exploration.requiredSeconds<1||
    actor!.campaignWorldMinute!==exploration.startedAtWorldMinute||
    !Number.isSafeInteger(exploration.startedAtWorldMinute+Math.ceil(exploration.requiredSeconds/60))))return undefined
  if(combat&&(!combat.combatId.trim()||!Number.isSafeInteger(combat.requiredRounds)||combat.requiredRounds<1||
   !Number.isSafeInteger(combat.startRound)||combat.startRound<1))return undefined
  const receipt = registerDnd5eHostReceipt(Object.freeze({})) as Dnd5eLongCastingReceipt
  receipts.set(receipt, { signature: signature(binding), valid: true,
    requiredSeconds: exploration?.requiredSeconds ?? (combat ? combat.requiredRounds*6 : undefined),
    ...(exploration?{exploration:{remainingSeconds:exploration.requiredSeconds,readyAtWorldMinute:exploration.startedAtWorldMinute+Math.ceil(exploration.requiredSeconds/60)},explorationStartedAtWorldMinute:exploration.startedAtWorldMinute}:{}),
    ...(combat?{combat:{...combat,paidRounds:0,lastRound:combat.startRound-1}}:{}) })
  return receipt
}
/** A witnessed interruption is permanent for this request, including after revival. */
export function observeDnd5eLongCasting(receipt: Dnd5eLongCastingReceipt | undefined,
  binding: Dnd5eLongCastingBinding, actor: Dnd5eCombatant | undefined): boolean {
  const stored = receipt ? receipts.get(receipt) : undefined
  if (!stored || stored.signature !== signature(binding)) return false
  stored.valid = stored.valid && capable(actor, binding) && (!stored.started ||
    actor!.concentrating && actor!.classState.concentrationSpellId === dnd5eLongCastingConcentrationId(binding))
  if (!stored.valid && stored.started) activeSignatures.delete(stored.signature)
  return stored.valid
}

/** A completed stage recorded inside a controller-private immutable parent
 * receipt. It is data, not a player command or a transferable casting licence. */
export interface Dnd5eCompletedLongCastingWitness{
 schemaVersion:1
 binding:Dnd5eLongCastingBinding
 requiredSeconds:number
 observedCombatId:string
 observedRound:number
 combat:Readonly<CombatCastingProgress>
}
/** Only an actually issued, still valid and fully completed live receipt can
 * produce this witness. No elapsed round or action may be inferred from time. */
export function captureDnd5eCompletedLongCastingWitness(receipt:Dnd5eLongCastingReceipt|undefined,binding:Dnd5eLongCastingBinding,state:Dnd5eHeadlessCombatState,requiredSeconds:number):Dnd5eCompletedLongCastingWitness|undefined{
 const stored=receipt&&receipts.get(receipt)
 if(!stored?.combat||stored.requiredSeconds!==requiredSeconds||!Number.isSafeInteger(requiredSeconds)||requiredSeconds<1||!dnd5eLongCastingCanComplete(receipt,binding,state))return undefined
 return{schemaVersion:1,binding:structuredClone(binding),requiredSeconds,observedCombatId:state.combatId,observedRound:state.round,combat:structuredClone(stored.combat)}
}
/** Host-only replay issuer. The caller must first authenticate and validate the
 * controller-private original-parent receipt containing this witness. Its data
 * must never be accepted from player JSON or used to resume an incomplete cast.
 * This restores the completed stage; it neither spends nor invents past actions. */
export function restoreDnd5eCompletedLongCastingWitness(witness:Dnd5eCompletedLongCastingWitness,binding:Dnd5eLongCastingBinding,state:Dnd5eHeadlessCombatState,requiredSeconds:number):Dnd5eLongCastingReceipt|undefined{
 if(!witness||Object.keys(witness).some(key=>!['schemaVersion','binding','requiredSeconds','observedCombatId','observedRound','combat'].includes(key))||witness.schemaVersion!==1||signature(witness.binding)!==signature(binding)||!Number.isSafeInteger(requiredSeconds)||requiredSeconds<1||witness.requiredSeconds!==requiredSeconds||witness.observedCombatId!==state.combatId||witness.observedRound!==state.round)return undefined
 const combat=witness.combat,actor=state.combatants[binding.actorTokenId]
 if(!combat||Object.keys(combat).some(key=>!['combatId','requiredRounds','startRound','paidRounds','lastRound'].includes(key))||!state.active||combat.combatId!==state.combatId||!capable(actor,binding)||!actor.concentrating||actor.classState.concentrationSpellId!==dnd5eLongCastingConcentrationId(binding)||[combat.requiredRounds,combat.paidRounds,combat.lastRound,combat.startRound].some(value=>!Number.isSafeInteger(value))||combat.requiredRounds<0||combat.requiredRounds>Math.ceil(requiredSeconds/6)||combat.paidRounds!==combat.requiredRounds||combat.startRound<1||combat.lastRound!==combat.startRound+combat.requiredRounds-1)return undefined
 if(combat.requiredRounds>0&&(combat.lastRound!==state.round||!castingTurn(state,binding,combat)||actor.turn.actionAvailable))return undefined
 const receipt=registerDnd5eHostReceipt(Object.freeze({}))as Dnd5eLongCastingReceipt
 receipts.set(receipt,{signature:signature(binding),valid:true,started:true,requiredSeconds,combat:{...combat}})
 activeSignatures.add(signature(binding))
 return dnd5eLongCastingCanComplete(receipt,binding,state)?receipt:undefined
}

/** Completed exploration progress from an actually armed private receipt.
 * This never authorizes unfinished casting or infers progress from a new clock. */
export interface Dnd5eCompletedExplorationCastingWitness{
 schemaVersion:1;binding:Dnd5eLongCastingBinding;requiredSeconds:number;
 observedScopeId:string;observedWorldMinute:number;startedAtWorldMinute:number;
 exploration:Readonly<{remainingSeconds:number;readyAtWorldMinute:number}>
}
function completedExplorationBindingClosed(value:Dnd5eLongCastingBinding):boolean{
 const allowed=['requestId','spellId','mapId','actorTokenId','actorCharacterId']
 return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>allowed.includes(key))&&allowed.every(key=>{const text=(value as unknown as Record<string,unknown>)[key];return typeof text==='string'&&text.length>0&&text.length<=640&&text.trim()===text})
}
export function captureDnd5eCompletedExplorationCastingWitness(receipt:Dnd5eLongCastingReceipt|undefined,binding:Dnd5eLongCastingBinding,state:Dnd5eHeadlessCombatState,requiredSeconds:number):Dnd5eCompletedExplorationCastingWitness|undefined{
 const stored=receipt&&receipts.get(receipt),actor=state.combatants[binding.actorTokenId]
 if(!stored?.exploration||stored.explorationStartedAtWorldMinute===undefined||stored.requiredSeconds!==requiredSeconds||!Number.isSafeInteger(requiredSeconds)||requiredSeconds<1||!dnd5eLongCastingCanComplete(receipt,binding,state))return undefined
 return{schemaVersion:1,binding:structuredClone(binding),requiredSeconds,observedScopeId:state.combatId,observedWorldMinute:actor.campaignWorldMinute!,startedAtWorldMinute:stored.explorationStartedAtWorldMinute,exploration:{...stored.exploration}}
}
/** Host-only completed-stage issuer. The caller authenticates the immutable
 * private parent containing the captured witness before invoking this API. */
export function restoreDnd5eCompletedExplorationCastingWitness(witness:Dnd5eCompletedExplorationCastingWitness,binding:Dnd5eLongCastingBinding,state:Dnd5eHeadlessCombatState,requiredSeconds:number):Dnd5eLongCastingReceipt|undefined{
 if(!witness||Object.keys(witness).some(key=>!['schemaVersion','binding','requiredSeconds','observedScopeId','observedWorldMinute','startedAtWorldMinute','exploration'].includes(key))||witness.schemaVersion!==1||!completedExplorationBindingClosed(witness.binding)||!completedExplorationBindingClosed(binding)||signature(witness.binding)!==signature(binding)||witness.requiredSeconds!==requiredSeconds||!Number.isSafeInteger(requiredSeconds)||requiredSeconds<1||state.active||witness.observedScopeId!==state.combatId)return undefined
 const progress=witness.exploration,actor=state.combatants[binding.actorTokenId]
 if(!progress||Object.keys(progress).some(key=>!['remainingSeconds','readyAtWorldMinute'].includes(key))||[witness.observedWorldMinute,witness.startedAtWorldMinute,progress.remainingSeconds,progress.readyAtWorldMinute].some(value=>!Number.isSafeInteger(value)||value<0)||progress.remainingSeconds>requiredSeconds||progress.readyAtWorldMinute!==witness.startedAtWorldMinute+Math.ceil(progress.remainingSeconds/60)||witness.observedWorldMinute<progress.readyAtWorldMinute||actor?.campaignWorldMinute!==witness.observedWorldMinute||!capable(actor,binding)||!actor.concentrating||actor.classState.concentrationSpellId!==dnd5eLongCastingConcentrationId(binding))return undefined
 const receipt=registerDnd5eHostReceipt(Object.freeze({}))as Dnd5eLongCastingReceipt
 receipts.set(receipt,{signature:signature(binding),valid:true,started:true,requiredSeconds,exploration:{...progress},explorationStartedAtWorldMinute:witness.startedAtWorldMinute})
 activeSignatures.add(signature(binding))
 return dnd5eLongCastingCanComplete(receipt,binding,state)?receipt:undefined
}
