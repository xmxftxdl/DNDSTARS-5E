import{readDnd5eSequenceMovementConcentrationCheckpoint,assertDnd5eSequenceMovementConcentrationCheckpointPrefix}from'./movementHazardsProducer'
import {capturePostNativeActivitySettlement,capturePostNativeActivityStage, readPostNativeActivityStage, samePostNativeActivityInput, type PostNativeActivityStage} from './postNativeActivityParent'
import {readCapturedDnd5eOpportunitySequencePostNativeCheckpoint,readStormFuryMoveBaseReplayCheckpoint,prepareDnd5eOpportunityMoveSequence,resolveDnd5eOpportunityMoveSequenceOriginal} from '../../rulesets/dnd5e/opportunityMoveSequence'
import {readBountifulOpportunitySequenceConcentrationOriginalReplay,readBountifulOpportunitySequenceMovementConcentrationOriginalReplay} from '../../rulesets/dnd5e/bountifulOpportunitySequencePostNativeReplay'
import {readDnd5eActualOriginalReadyBoundary} from '../../rulesets/dnd5e/damageCommitSession'
import {encodeSecondChanceParentWire} from '../../lib/secondChanceParentWire'
import {cloneDnd5eHostTransactionInput} from '../../rulesets/dnd5e/hostTransactionClone'
import {getRoomSession} from '../../lib/roomSession'
import {withDnd5eOriginalD20ReadyTailStop} from '../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import {getDnd5eSrdCombatSpell} from '../../rulesets/dnd5e/spells'
import {resolveDnd5ePreparedWithDamageReactions,type Dnd5eDamageReactionFlowOptions} from '../../rulesets/dnd5e/damageReactionFlow'
import { planDnd5eDisadvantageNegation, type DisadvantageNegationRoll } from '../../rulesets/dnd5e/disadvantageNegation'
import type {Dnd5eSpellcastingSavingThrowRoll} from '../../application/combat/dnd5eCombatRules'
import {dnd5eSpellcastingSaveRequirements,previewDnd5eSpellcastingSaves} from '../../rulesets/dnd5e/headlessCombatEngine'
import type {
  BardicInspirationRollType,
  DmAdjudicationInterruptResponse,
} from '../../lib/combatInterruptProtocol'
import type { BattleMap } from '../../store/maps'
import type { Character } from '../../types/character'
import type {Dnd5eUnsupportedAirborneFallPreview,Dnd5eAction,Dnd5eActionResult,Dnd5eCombatant,Dnd5eHeadlessCombatState,Dnd5eMapResultPlan,Dnd5eSpellTargetSavingThrowRoll} from '../../rulesets/dnd5e'
import {dnd5eCombatantPairKey} from '../../rulesets/dnd5e/headlessCombatPrimitives'
import {dnd5eHellishRebukeReactionOption,dnd5ePendingMonsterMechanicResolutions,dnd5ePendingMonsterDeathAreaEffects,dnd5ePostSpellRandomTablePlan,previewDnd5eUnsupportedAirborneFalls,previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,resolveDnd5eHeadlessAction,resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange} from '../../rulesets/dnd5e/headlessCombatEngine'
import {dnd5eSavingThrowMode} from '../../rulesets/dnd5e/passiveDefenses'
import {getDnd5eSrdMonster} from '../../rulesets/dnd5e/monsters'
import {markDnd5eSummonsDamaged} from '../../rulesets/dnd5e/summonedCreatures'
import {planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'
import { resolveDnd5eRollMode } from '../../rulesets/dnd5e/rollMode'
import {dnd5eRollDiceRecipes,resolveDnd5eRollDiceModifiers} from '../../rulesets/dnd5e/rollDiceModifiers'
import {dnd5eRollDiceOccurrenceId} from '../../rulesets/dnd5e/rollDiceTransaction'
import { combatPresentationSavingThrowAbilityLabel } from '../../lib/combatPresentation'
import {
  resolveDnd5eSavingThrowInterrupts,
  type Dnd5eD20RollInterruptContext,
  type Dnd5eOptionalBonusDieInterruptRequest,
} from './dnd5eRollInterruptPipeline'


type CompletedCombatBase = { result: Extract<Dnd5eActionResult,{ok:true}>; application:Dnd5eMapResultPlan }
const completedCombatBases=new WeakMap<object,{input:object;inputSignature:string;outputSignature:string}>()
type ActualBaseInput=Parameters<typeof settleDnd5eConcentrationChecks>[0]
type SequenceConcentrationFact=ReturnType<typeof readCapturedDnd5eOpportunitySequencePostNativeCheckpoint>
export interface Dnd5eSequenceConcentrationOriginal {readonly actualBaseConcentrationOriginal:unique symbol}
type MovementConcentrationFact=ReturnType<typeof readDnd5eSequenceMovementConcentrationCheckpoint>
type ConcentrationBinding={input:ActualBaseInput;signature:string;source:{kind:'opportunity';fact:SequenceConcentrationFact}|{kind:'movement';fact:MovementConcentrationFact};checkpoint:object;roomId:string;memberId:string;unchanged:()=>boolean;originals:Map<string,Dnd5eSequenceConcentrationOriginal>;retained:Map<string,readonly number[]>;resolve:(frame:Dnd5eSequenceConcentrationOriginal)=>Promise<readonly number[]|object|undefined>;resolveResult?: (frame:Dnd5eSequenceConcentrationOriginal)=>Promise<object>}
const concentrationInputs=new WeakMap<object,ConcentrationBinding>()
const concentrationOriginals=new WeakMap<object,{binding:ConcentrationBinding;state:Dnd5eHeadlessCombatState;action:Extract<Dnd5eAction,{type:'concentration-save'}>;operationId:string;mode:'normal'|'advantage'|'disadvantage';stage:'original'|'result';signature:string;ready?:string}>()
const concentrationResults=new WeakMap<object,{frame:object;result:Dnd5eActionResult;signature:string}>()
let activeConcentrationOriginal:object|undefined
export const dnd5eSequenceConcentrationOriginalActive=(frame:object)=>concentrationOriginals.has(frame)&&activeConcentrationOriginal===frame
const concentrationSignature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const concentrationReadySignature=(ready:{request:object;snapshot:Dnd5eHeadlessCombatState;events:readonly unknown[]})=>[Object.fromEntries(Object.entries(ready.request).filter(([key])=>key!=='ordinal')),ready.snapshot,ready.events].map(concentrationSignature).join('\n')
const concentrationBaseMaterial=(input:ActualBaseInput)=>[input.result,input.priorState,input.map,input.characters,input.characterIdByCombatantId,input.priorApplication,input.hostParentTransactionId,input.followupTransactionNow?.()].map(concentrationSignature).join('\n')
const concentrationPrefix=(fact:SequenceConcentrationFact)=>({prepared:fact.source.prepared,request:fact.request,preceding:fact.preceding,rolls:fact.source.attacks[fact.request.actorTokenId],beforeState:fact.beforeState,resolved:fact.resolved})
/** Binds services to a genuine native postfix. It issues no operation: only
 * the actual Base CON loop below can issue an original-dice frame. */
export function bindDnd5eSequenceConcentrationOriginals(input:ActualBaseInput,checkpoint:object,unchanged:()=>boolean,resolve:ConcentrationBinding['resolve'],resolveResult?:ConcentrationBinding['resolveResult']){
 const fact=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(checkpoint),host=getRoomSession()
 if(host?.role!=='dm'||!unchanged()||!fact.resolved.result.ok||!fact.resolved.application)throw Error('concentration-original:actual-live-base-required')
 const expected={result:fact.resolved.result,priorState:fact.beforeState,map:fact.resolved.application.map,characters:fact.resolved.application.characters,characterIdByCombatantId:fact.source.prepared.characterIdByCombatantId,priorApplication:fact.resolved.application,hostParentTransactionId:fact.resolved.result.transaction?.id}
 const supplied={result:input.result,priorState:input.priorState,map:input.map,characters:input.characters,characterIdByCombatantId:input.characterIdByCombatantId,priorApplication:input.priorApplication,hostParentTransactionId:input.hostParentTransactionId}
 if(Object.keys(expected).some(key=>concentrationSignature(supplied[key as keyof typeof supplied])!==concentrationSignature(expected[key as keyof typeof expected]))||input.followupTransactionNow?.()!==fact.source.prepared.input.firstHostNow)throw Error('concentration-original:exact-native-base-input-required')
 if(concentrationInputs.has(input))throw Error('concentration-original:input-already-bound')
 concentrationInputs.set(input,{input,signature:concentrationBaseMaterial(input),source:{kind:'opportunity',fact},checkpoint,roomId:host.roomId,memberId:host.memberId,unchanged,resolve,resolveResult,originals:new Map,retained:new Map})
}
const concentrationPrepared=(binding:ConcentrationBinding)=>binding.source.kind==='opportunity'?binding.source.fact.source.prepared:binding.source.fact.prepared
const concentrationNow=(binding:ConcentrationBinding)=>binding.source.kind==='opportunity'?binding.source.fact.source.prepared.input.firstHostNow:binding.source.fact.firstHostNow
const movementConcentrationPrefix=(fact:MovementConcentrationFact)=>[fact.prepared,fact.parentId,fact.segmentIndex,fact.operationIndex,fact.areaId,fact.actorId,fact.operationId,fact.native,fact.priorState,fact.application].map(concentrationSignature).join('\n')
/** Only the real Producer native item result can bind a movement Base input. */
export function bindDnd5eMovementConcentrationOriginals(input:ActualBaseInput,checkpoint:object,unchanged:()=>boolean,resolve:ConcentrationBinding['resolve'],resolveResult?:ConcentrationBinding['resolveResult']){
 const fact=readDnd5eSequenceMovementConcentrationCheckpoint(checkpoint),host=getRoomSession();if(host?.role!=='dm'||!unchanged()||!fact.native.ok)throw Error('concentration-original:actual-live-movement-base-required')
 const expected={result:fact.native,priorState:fact.priorState,map:fact.application.map,characters:fact.application.characters,characterIdByCombatantId:fact.characterIdByCombatantId,priorApplication:fact.application,hostParentTransactionId:fact.operationId},supplied={result:input.result,priorState:input.priorState,map:input.map,characters:input.characters,characterIdByCombatantId:input.characterIdByCombatantId,priorApplication:input.priorApplication,hostParentTransactionId:input.hostParentTransactionId}
 if(Object.keys(expected).some(key=>concentrationSignature(supplied[key as keyof typeof supplied])!==concentrationSignature(expected[key as keyof typeof expected]))||input.followupTransactionNow?.()!==fact.firstHostNow||concentrationInputs.has(input))throw Error('concentration-original:exact-native-movement-base-input-required')
 concentrationInputs.set(input,{input,signature:concentrationBaseMaterial(input),source:{kind:'movement',fact},checkpoint,roomId:host.roomId,memberId:host.memberId,unchanged,resolve,resolveResult,originals:new Map,retained:new Map})
}
function readConcentrationOriginal(frame:object,checkpoint:object){
 const row=concentrationOriginals.get(frame),host=getRoomSession()
 if(!row||host?.role!=='dm'||host.roomId!==row.binding.roomId||host.memberId!==row.binding.memberId||!row.binding.unchanged()||concentrationBaseMaterial(row.binding.input)!==row.binding.signature||concentrationSignature({state:row.state,action:row.action,operationId:row.operationId,mode:row.mode})!==row.signature)throw Error('concentration-original:actual-live-operation-required')
 if(row.binding.source.kind==='opportunity'){const effectiveCheckpoint=readStormFuryMoveBaseReplayCheckpoint(checkpoint,row.binding.checkpoint)??checkpoint,fact=readCapturedDnd5eOpportunitySequencePostNativeCheckpoint(effectiveCheckpoint);if(concentrationSignature(concentrationPrefix(fact))!==concentrationSignature(concentrationPrefix(row.binding.source.fact)))throw Error('concentration-original:exact-native-prefix-required')}
 else if(movementConcentrationPrefix(readDnd5eSequenceMovementConcentrationCheckpoint(checkpoint))!==movementConcentrationPrefix(row.binding.source.fact))throw Error('concentration-original:exact-native-movement-prefix-required')
 return row
}
/** Only the actual Base final-CON frame may restore its mechanical Move
 * preparer. The already-issued Fury result is retained by the real Base proof;
 * this is neither a source/raw issuer nor a caller data restoration API. */
export function prepareDnd5eStormFuryMoveConcentrationReplay<T extends Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0]&{transactionId?:string}>(frame:object,checkpoint:object,source:T):T|undefined{
 const row=readConcentrationOriginal(frame,checkpoint)
 if(row.stage!=='result'||row.binding.source.kind!=='opportunity')return undefined
 if(!readStormFuryMoveBaseReplayCheckpoint(checkpoint,row.binding.checkpoint))return undefined
 const original=row.binding.originals.get(row.operationId),raw=original&&concentrationOriginals.get(original),fact=row.binding.source.fact
 if(!raw?.ready||readBountifulOpportunitySequenceConcentrationOriginalReplay(source)?.at(-1)!==frame||concentrationSignature(source.prepared)!==concentrationSignature(fact.source.prepared)||concentrationSignature(source.attacks)!==concentrationSignature(fact.source.attacks)||source.transactionId!==fact.request.parentId)throw Error('storm-fury-CON:exact-confirmed-base-source-required')
 const fresh=prepareDnd5eOpportunityMoveSequence(source.prepared.input)
 if(!fresh.ok||concentrationSignature(fresh.prepared)!==concentrationSignature(fact.source.prepared))throw Error('storm-fury-CON:exact-native-repreparation-required')
 const replay=cloneDnd5eHostTransactionInput(source);replay.prepared=fresh.prepared;return replay
}
/** Read-only identity of an actual operation, never a caller graph issuer. */
export function readDnd5eSequenceConcentrationOriginal(frame:object,checkpoint:object){
 const row=readConcentrationOriginal(frame,checkpoint);if(row.binding.source.kind!=='opportunity')throw Error('concentration-original:actual-opportunity-source-required');const fact=row.binding.source.fact
 return {parentId:fact.request.parentId,windowIndex:fact.request.windowIndex,opportunityActorId:fact.request.actorTokenId,operationId:row.operationId,actorId:row.action.actorId,kind:'saving-throw' as const,mode:row.mode,stage:row.stage,raw:[row.action.d20,...(row.action.d20Second===undefined?[]:[row.action.d20Second])],dc:row.action.dc}
}
/** Runs only the original operation held by the actual Base issuer. Callers
 * cannot substitute a state, action, result, timestamp, or DC. */
export function resolveDnd5eSequenceConcentrationOriginal(frame:object,checkpoint:object){
 const row=readConcentrationOriginal(frame,checkpoint)
 const previous=activeConcentrationOriginal;activeConcentrationOriginal=frame
 try{return resolveDnd5eHeadlessAction(cloneDnd5eHostTransactionInput(row.state),cloneDnd5eHostTransactionInput(row.action),{transactionId:row.operationId,now:concentrationNow(row.binding)})}finally{activeConcentrationOriginal=previous}
}
export function readDnd5eSequenceConcentrationOriginalReplayFacts(frame:object){
 const row=concentrationOriginals.get(frame)
 if(!row)throw Error('concentration-original:actual-live-operation-required')
 readConcentrationOriginal(frame,row.binding.checkpoint)
 return {...readDnd5eSequenceConcentrationOriginal(frame,row.binding.checkpoint),prepared:concentrationSignature(concentrationPrepared(row.binding))}
}
/** The operation is issued by the actual Base over a real native movement item result. */
export function readDnd5eSequenceMovementConcentrationOriginal(frame:object,checkpoint:object){const row=readConcentrationOriginal(frame,checkpoint);if(row.binding.source.kind!=='movement')throw Error('concentration-original:actual-movement-source-required');const fact=row.binding.source.fact,operation=JSON.parse(row.operationId)as unknown[];if(operation.length!==4||operation[0]!==fact.operationId||operation[1]!=='concentration'||!Number.isSafeInteger(operation[2])||(operation[2]as number)<0||operation[3]!==row.action.actorId)throw Error('concentration-original:actual-movement-CON-operation-required');return{parentId:fact.parentId,segmentIndex:fact.segmentIndex,operationIndex:fact.operationIndex,areaId:fact.areaId,baseOperationId:fact.operationId,checkIndex:operation[2]as number,operationId:row.operationId,actorId:row.action.actorId,kind:'saving-throw' as const,mode:row.mode,stage:row.stage,raw:row.action.d20Second===undefined?[row.action.d20]:[row.action.d20,row.action.d20Second],dc:row.action.dc}}
export function readDnd5eSequenceMovementConcentrationOriginalReplayFacts(frame:object){const row=concentrationOriginals.get(frame);if(!row)throw Error('concentration-original:actual-live-operation-required');return{...readDnd5eSequenceMovementConcentrationOriginal(frame,row.binding.checkpoint),prepared:concentrationSignature(concentrationPrepared(row.binding))}}
function movementConcentrationAtMovement(frame:object,movementCheckpoint:object){const row=concentrationOriginals.get(frame);if(!row||row.binding.source.kind!=='movement')throw Error('concentration-original:actual-movement-source-required');readConcentrationOriginal(frame,row.binding.checkpoint);assertDnd5eSequenceMovementConcentrationCheckpointPrefix(row.binding.checkpoint,movementCheckpoint);return row.binding.checkpoint}
export function observeDnd5eSequenceMovementConcentrationOriginalAtMovement(frame:object,movementCheckpoint:object){observeDnd5eSequenceConcentrationOriginal(frame,movementConcentrationAtMovement(frame,movementCheckpoint))}
export function throwDnd5eSequenceMovementConcentrationOriginalResultAtMovement(frame:object,movementCheckpoint:object):never{return throwDnd5eSequenceConcentrationOriginalResult(frame,movementConcentrationAtMovement(frame,movementCheckpoint))}
/** Replay the true original boundary only. The actual Base completion, not
 * this observer's incomplete save, owns all after-d20 native consequences. */
export function observeDnd5eSequenceConcentrationOriginal(frame:object,checkpoint:object){
 const row=readConcentrationOriginal(frame,checkpoint),stopped=new Error('concentration-original:actual-original-boundary-observed')
 if(row.stage!=='original')throw Error('concentration-original:actual-original-operation-required')
 try{withDnd5eOriginalD20ReadyTailStop((request,snapshot,events)=>{if(row.ready&&row.ready!==concentrationReadySignature({request,snapshot,events}))throw Error('concentration-original:changed-actual-original-boundary');throw stopped},()=>resolveDnd5eSequenceConcentrationOriginal(frame,checkpoint))}catch(error){if(error===stopped)return;throw error}
 throw Error('concentration-original:actual-original-ready-not-reached')
}
/** The actual whole facade calls this only for a Base-issued final CON frame.
 * Its opaque exception transports that actual native result through the
 * existing DamageFlow without presenting a partial move as a final result. */
export function throwDnd5eSequenceConcentrationOriginalResult(frame:object,checkpoint:object):never{
 const row=readConcentrationOriginal(frame,checkpoint)
 if(row.stage!=='result')throw Error('concentration-original:actual-final-operation-required')
 const result=resolveDnd5eSequenceConcentrationOriginal(frame,checkpoint),receipt=new Error('concentration-original:actual-native-operation-completed')
 concentrationResults.set(receipt,{frame,result,signature:concentrationSignature(result)});throw receipt
}
export function readDnd5eSequenceConcentrationOriginalResult(receipt:object,frame:object,checkpoint:object){
 const row=readConcentrationOriginal(frame,checkpoint),proof=concentrationResults.get(receipt)
 if(row.stage!=='result'||!proof||proof.frame!==frame||proof.signature!==concentrationSignature(proof.result))throw Error('concentration-original:actual-native-result-required')
 return cloneDnd5eHostTransactionInput(proof.result)
}
/** Data lineage of this actual Base invocation only. This reader grants no
 * source ability, consent, or publication permission. JSON copies are rejected. */
export function readDnd5eCompletedCombatBase(input:object,completed:CompletedCombatBase){
 const row=completedCombatBases.get(completed)
 if(!row||row.input!==input||row.inputSignature!==JSON.stringify(input)||row.outputSignature!==JSON.stringify(completed))throw Error('combat-base:actual-unchanged-completion-required')
 return completed
}

export async function settleDnd5eConcentrationChecks(input: {
  /** Host-only stage issued at the native-to-Activity boundary, never player payload. */
  resumeActivityStage?: PostNativeActivityStage
  hostParentTransactionId?: string
  followupTransactionNow?: () => number | undefined
  damageReactions?: Dnd5eDamageReactionFlowOptions
  requestOptionalDamageSave?: (request: { mapId: string; targetId: string; characterId?: string; targetName: string; effectId: string; effectName: string; ability: import('../../lib/dnd').AbilityKey; dc: number; transactionId: string }) => Promise<boolean>
  chooseDisadvantageNegation?: (request: { character: Character; roll: DisadvantageNegationRoll; transactionId: string }) => Promise<string | undefined>
  result: Extract<Dnd5eActionResult, { ok: true }>
  /** State immediately before a non-action authority adjustment changed support. */
  priorState?: Dnd5eHeadlessCombatState
  rollUnsupportedAirborneFalls?: (falls: readonly Dnd5eUnsupportedAirborneFallPreview[], map: BattleMap) => Promise<Readonly<Record<string, readonly number[]>>>
  settleMountedBalance?: (prepared: { state: Dnd5eHeadlessCombatState; map: BattleMap; characters: readonly Character[]; characterIdByCombatantId: Record<string,string> }, result: Dnd5eActionResult) => Promise<{ result: Dnd5eActionResult }>
  map: BattleMap
  /** Cross-scene continuations retain remote participants in the result while
   * projecting only this scene. The caller must also persist the remote changes. */
  preserveOffMapParticipants?: boolean
  characters: readonly Character[]
  priorApplication?: Pick<
    Dnd5eMapResultPlan,
    'changedTokenIds' | 'changedCharacterIds' | 'tokenPatches' | 'characterPatches' | 'geometry' | 'spentReactions'
  >
  characterIdByCombatantId: Readonly<Record<string, string>>
  rollD20: (
    label: string,
    targetName: string,
    context?: Dnd5eD20RollInterruptContext,
  ) => Promise<number>
  runEffectEndSavingThrow?: <T>(key: string, run: () => Promise<T>) => Promise<T>
  rollD4: (label: string, targetName: string, context?: { rollerTokenId?: string; rollerCharacterId?: string }) => Promise<number>
  rollDice: (count: number, sides: number, label: string, targetName: string, context?: { rollerTokenId?: string; rollerCharacterId?: string }) => Promise<number[]>
  requestSavingThrowReroll?: (input: {
    target: Character
    targetName: string
    featureName: string
    total: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
  }) => Promise<{ d20: number; d20Second?: number; resourceKey?: string } | undefined>
  requestBardicInspiration?: (input: {
    target?: Character
    targetName: string
    dieSides: number
    rollType: BardicInspirationRollType
    total: number
    targetNumber: number
  }) => Promise<number | undefined>
  requestOptionalBonusDie?: (
    input: Dnd5eOptionalBonusDieInterruptRequest,
  ) => Promise<import('../../rulesets/dnd5e').Dnd5eOptionalBonusDieUse | undefined>
  requestDarkOnesOwnLuck?: (input: {
    target?: Character
    targetName: string
    rollType: '豁免' | '属性检定'
    total: number
    targetNumber?: number
  }) => Promise<number | undefined>
  chooseSpellDamageDice?: (input:{transactionId:string;actor:Dnd5eCombatant;character?:Character;spellName:string;group:import('../../rulesets/dnd5e/spellDamageDieRerolls').Dnd5eSpellDamageDiceGroup})=>Promise<readonly import('../../rulesets/dnd5e/spellDamageDieRerolls').Dnd5eSpellDamageDieRerollUse[]>
  requestHellishRebuke?: (input: {
    reactor: Character
    reactorTokenId: string
    targetTokenId: string
    sourceName: string
    damage: number
    slotLevel: number
    itemName?: string
    racialInnate?: boolean
  }) => Promise<boolean>
  requestPostSpellRandomTableAdjudication?: (request: {
    actor: Dnd5eCombatant
    featureId: string
    adjudicationId: string
    sourceSpellId: string
    tableRoll: number
    outcomeId?: string
    events: Extract<Dnd5eActionResult, { ok: true }>['events']
  }) => Promise<DmAdjudicationInterruptResponse>
  requestPostSpellRandomTableChoice?: (request: {
    actor: Dnd5eCombatant
    tableFeatureId: string
    choiceFeatureId: string
    tableRolls: readonly number[]
    tableDieSides: number
    transactionId: string
  }) => Promise<number | undefined>
  /**
   * Production map hook for registered Activity event windows. It runs after
   * native interrupt mechanics have settled, but before the map/character
   * application plan is built, so the whole chain is committed as one result.
   */
  settleActivityTriggers?: (request: {
    stage?: PostNativeActivityStage
    state: Dnd5eHeadlessCombatState
    events: Extract<Dnd5eActionResult, { ok: true }>['events']
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Readonly<Record<string, string>>
  }) => Promise<{
    state: Dnd5eHeadlessCombatState
    events: Extract<Dnd5eActionResult, { ok: true }>['events']
    /** Map snapshot after Activity-owned placement handoffs. */
    map?: BattleMap
  }>
}): Promise<{ result: Extract<Dnd5eActionResult, { ok: true }>; application: Dnd5eMapResultPlan }> {
  const actualBaseInput=input.result,actualBaseInputSignature=JSON.stringify(input.result)
  const resuming = input.resumeActivityStage ? readPostNativeActivityStage(input.resumeActivityStage) : undefined
  if (resuming && (input.result.events.length || !samePostNativeActivityInput(resuming, input))) throw Error('activity-parent:resume-stage-mismatch')
  const resolveBoundary = (source:Dnd5eHeadlessCombatState,resolve:(state:Dnd5eHeadlessCombatState)=>Dnd5eActionResult) => input.damageReactions
    ? resolveDnd5ePreparedWithDamageReactions(input.damageReactions,{prepared:{state:source}},value=>resolve(value.prepared.state))
    : Promise.resolve(resolve(source))
  let issuedStage=input.resumeActivityStage
  let state = input.result.state
  let transaction = input.result.transaction
  const followupId = input.hostParentTransactionId ?? input.result.transaction?.id ?? crypto.randomUUID()
  let map = input.map
  const events = [...input.result.events]
  const collectFallRolls = async (falls: readonly Dnd5eUnsupportedAirborneFallPreview[]) => {
    if (input.rollUnsupportedAirborneFalls) return input.rollUnsupportedAirborneFalls(falls, map)
    const rolls: Record<string, readonly number[]> = {}
    for (const fall of falls) {
      if (fall.collisionCandidates?.length) throw new Error('fall-collision-target-selection-required')
      if (fall.collision) {
        const collision = fall.collision
        const context = { rollerTokenId: collision.targetId, rollKind: 'saving-throw' as const }
        const first = await input.rollD20('躲避坠落生物 · 敏捷豁免 DC 15', collision.targetName, context)
        rolls[collision.rollKey] = collision.mode === 'normal' ? [first] : [first,
          await input.rollD20('躲避坠落生物 · 敏捷豁免 DC 15', collision.targetName, context)]
      }
      if (fall.fallingDamageDice > 0) rolls[fall.combatantId] = await input.rollDice(
        fall.fallingDamageDice, 6, '失去飞行支撑·坠落伤害',
        map.tokens.find(token => token.id === fall.combatantId)?.label ?? state.combatants[fall.combatantId]?.name ?? fall.combatantId,
        {rollerTokenId:fall.combatantId},
      )
    }
    return rolls
  }
  if (input.priorState) {
    if (input.settleMountedBalance) {
      const mounted = await input.settleMountedBalance({ state: input.priorState, map,
        characters: input.characters, characterIdByCombatantId: { ...input.characterIdByCombatantId } }, input.result)
      if (!mounted.result.ok) throw new Error(`mounted-balance:${mounted.result.reason}`)
      state = mounted.result.state
      events.splice(0, events.length, ...mounted.result.events)
    }
    // Derived solely from authoritative result events, never a player-provided claim.
    // Accepted Activity teleports can also arrive without physical or magical support.
    const forcedMovementTargetIds=events.flatMap(event=>event.type==='moved' && (event.movementKind==='forced' || event.movementKind==='teleport') &&
      event.toElevationFeet!=null && event.fromElevationFeet!=null && event.toElevationFeet!==event.fromElevationFeet ? [event.actorId] : [])
    const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
      input.priorState,
      state,
      forcedMovementTargetIds,
    )
    if (falls.length > 0) {
      const fallDamageRollsByCombatantId = await collectFallRolls(falls)
      const prior=input.priorState
      const fallen = await resolveBoundary(state,current=>resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(
        prior,
        current,
        fallDamageRollsByCombatantId,
        forcedMovementTargetIds,
      ))
      if (!fallen.ok) throw new Error(`unsupported-airborne-fall:${fallen.reason}`)
      state = fallen.state
      events.push(...fallen.events)
    }
  }
  const resolveWithUnsupportedAirborneFalls = async (
    source: typeof state,
    action: Dnd5eAction,
    transactionId?: string,
  ) => {
    const resolveNative=async(action:Dnd5eAction)=>{
      const binding=concentrationInputs.get(input),original=transactionId&&binding?.originals.get(transactionId),raw=original&&concentrationOriginals.get(original)
      if(action.type==='concentration-save'&&binding?.resolveResult&&raw&&transactionId){
        if(!raw.ready)throw Error('concentration-original:actual-ready-boundary-required')
        const frame=Object.freeze({}) as Dnd5eSequenceConcentrationOriginal,row={binding,state:cloneDnd5eHostTransactionInput(source),action:{...cloneDnd5eHostTransactionInput(action),d20:raw.action.d20,d20Second:raw.action.d20Second},operationId:transactionId,mode:raw.mode,stage:'result' as const,signature:''}
        row.signature=concentrationSignature({state:row.state,action:row.action,operationId:row.operationId,mode:row.mode});concentrationOriginals.set(frame,row)
        const receipt=await binding.resolveResult(frame)
        return readDnd5eSequenceConcentrationOriginalResult(receipt,frame,binding.checkpoint)
      }
      return resolveBoundary(source,current=>resolveDnd5eHeadlessAction(current,action,{transactionId,now:input.followupTransactionNow?.()}))
    }
    const settleMounted = async (result: Dnd5eActionResult) => input.settleMountedBalance
      ? (await input.settleMountedBalance({ state: source, map: input.map, characters: input.characters,
          characterIdByCombatantId: { ...input.characterIdByCombatantId } }, result)).result
      : result
    const retained=transactionId&&concentrationInputs.get(input)?.retained.get(transactionId),previewAction=action.type==='concentration-save'&&retained?{...action,d20:retained[0]!,d20Second:retained[1]}:action
    const preview = previewDnd5eUnsupportedAirborneFalls(source, previewAction,{transactionId,now:input.followupTransactionNow?.()})
    if (!preview.ok || preview.falls.length === 0) {
      return settleMounted(await resolveNative(action))
    }
    const airborneFallDamageRollsByCombatantId = await collectFallRolls(preview.falls)
    return settleMounted(await resolveNative({
      ...action,
      airborneFallDamageRollsByCombatantId,
    }))
  }
  const resolveSavingThrowInterrupts = (request: {
    effectDiceModifier?: number
    combatant: Dnd5eCombatant
    targetName: string
    ability: import('../../lib/dnd').AbilityKey
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
    label: string
    secondRollLabel?: string
    halflingLuckyLabel?: string
    blessLabel?: string
    baneLabel?: string
    concentrationOriginal?: {operationId:string;action:Omit<Extract<Dnd5eAction,{type:'concentration-save'}>,'d20'|'d20Second'>}
  }) => {
    const characterId = input.characterIdByCombatantId[request.combatant.id]
    const target = characterId
      ? input.characters.find((character) => character.id === characterId)
      : undefined
    return resolveDnd5eSavingThrowInterrupts({
      state,
      ...request,
      target,
      rollD20: input.rollD20,
      rollD4: input.rollD4,
      requestSavingThrowReroll: input.requestSavingThrowReroll,
      requestBardicInspiration: input.requestBardicInspiration,
      requestOptionalBonusDie: input.requestOptionalBonusDie,
      requestDarkOnesOwnLuck: input.requestDarkOnesOwnLuck,
      resolveOriginalDice: request.concentrationOriginal && concentrationInputs.has(input) ? async raw=>{
        const binding=concentrationInputs.get(input)!
        const frame=Object.freeze({}) as Dnd5eSequenceConcentrationOriginal
        const action={...request.concentrationOriginal!.action,...raw}
        const row:{binding:ConcentrationBinding;state:Dnd5eHeadlessCombatState;action:typeof action;operationId:string;mode:typeof request.mode;stage:'original';signature:string;ready?:string}={binding,state:cloneDnd5eHostTransactionInput(state),action,operationId:request.concentrationOriginal!.operationId,mode:request.mode,stage:'original',signature:''}
        row.signature=concentrationSignature({state:row.state,action:row.action,operationId:row.operationId,mode:row.mode})
        concentrationOriginals.set(frame,row)
        binding.originals.set(row.operationId,frame)
        const response=await binding.resolve(frame)
        let retained:readonly number[]|undefined
        if(response&&!Array.isArray(response)){
          const proof=readDnd5eActualOriginalReadyBoundary(response)
          if(proof.resolve!==resolveDnd5eOpportunityMoveSequenceOriginal||(binding.source.kind==='opportunity'?readBountifulOpportunitySequenceConcentrationOriginalReplay(proof.input as Parameters<typeof readBountifulOpportunitySequenceConcentrationOriginalReplay>[0]):readBountifulOpportunitySequenceMovementConcentrationOriginalReplay(proof.input as Parameters<typeof readBountifulOpportunitySequenceMovementConcentrationOriginalReplay>[0]))?.at(-1)!==frame||proof.request.actorId!==row.action.actorId||proof.request.kind!=='saving-throw'||JSON.stringify(proof.request.originalRolls)!==JSON.stringify(row.action.d20Second===undefined?[row.action.d20]:[row.action.d20,row.action.d20Second]))throw Error('concentration-original:exact-actual-ready-boundary-required')
          row.ready=concentrationReadySignature(proof);retained=proof.request.values
        }else retained=response as readonly number[]|undefined
        if(retained)binding.retained.set(row.operationId,[...retained])
        return retained
      }:undefined,
    })
  }
  const pendingPostSpellRandomTables = input.result.events.filter((event) =>
    event.type === 'post-spell-random-table-check-required')
  for (const check of pendingPostSpellRandomTables) {
    if (check.type !== 'post-spell-random-table-check-required') continue
    const actor = state.combatants[check.actorId]
    if (
      !actor ||
      actor.classState.postSpellRandomTableCheck?.featureId !== check.featureId
    ) continue
    const actorName = input.map.tokens.find((token) => token.id === actor.id)?.label ?? actor.name
    const triggerRoll = check.forceTable
      ? undefined
      : check.triggerDieSides === 20
        ? await input.rollD20('施法后随机表·触发检定', actorName, { rollerTokenId: actor.id, rollKind: 'ability-check' })
        : (await input.rollDice(
            1,
            check.triggerDieSides,
            '施法后随机表·触发检定',
            actorName, { rollerTokenId: actor.id },
          ))[0]
    const triggered = check.forceTable || check.triggerValues.includes(triggerRoll!)
    const tableRollCount = check.tableRollChoiceFeatureId &&
      Number.isInteger(check.tableRollCount) && check.tableRollCount! > 1
      ? check.tableRollCount!
      : 1
    const tableRollCandidates = triggered
      ? await input.rollDice(
          tableRollCount,
          check.tableDieSides,
          tableRollCount > 1 ? '施法后随机表·候选结果' : '施法后随机表·结果',
          actorName, { rollerTokenId: actor.id },
        )
      : undefined
    const requestedTableRollIndex = triggered && tableRollCandidates && tableRollCount > 1 &&
      check.tableRollChoiceFeatureId && input.requestPostSpellRandomTableChoice
      ? await input.requestPostSpellRandomTableChoice({
          actor,
          tableFeatureId: check.featureId,
          choiceFeatureId: check.tableRollChoiceFeatureId,
          tableRolls: tableRollCandidates,
          tableDieSides: check.tableDieSides,
          transactionId: [
            'post-spell-random-table-choice',
            state.combatId,
            state.round,
            state.initiativeIndex,
            actor.id,
            check.featureId,
          ].join(':'),
        })
      : undefined
    const selectedTableRollIndex = tableRollCandidates && tableRollCount > 1 &&
      Number.isInteger(requestedTableRollIndex) &&
      requestedTableRollIndex! >= 0 && requestedTableRollIndex! < tableRollCandidates.length
      ? requestedTableRollIndex!
      : tableRollCandidates && tableRollCount > 1
        ? 0
        : undefined
    const tableRoll = tableRollCandidates?.[selectedTableRollIndex ?? 0]
    const plan = dnd5ePostSpellRandomTablePlan(
      state,
      actor.id,
      check.featureId,
      triggerRoll,
      tableRoll,
    )
    if (!plan) continue
    let resolution: {
      spellDamageDieRerolls?:readonly import('../../rulesets/dnd5e/spellDamageDieRerolls').Dnd5eSpellDamageDieRerollUse[]
      schemaVersion: 1
      targetIds: readonly string[]
      targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[]
      legendaryResistanceTargetIds: string[]
      effectRolls: number[]
    } | undefined
    const optionalBonusDice: import('../../rulesets/dnd5e').Dnd5eOptionalBonusDieUse[] = []
    if (plan.effect) {
      const targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[] = []
      const legendaryResistanceTargetIds: string[] = []
      for (const targetId of plan.effect.targetIds) {
        const target = state.combatants[targetId]
        if (!target) continue
        const targetName = input.map.tokens.find((token) => token.id === targetId)?.label ?? target.name
        const mode = dnd5eSavingThrowMode(target, plan.effect.saveAbility, {
          effectVisible: true,
          sourceCreatureType: actor.creatureType,
          sourceIsSpell: true,
        })
        const interrupted = await resolveSavingThrowInterrupts({
          combatant: target,
          targetName,
          ability: plan.effect.saveAbility,
          dc: plan.effect.saveDc,
          mode,
          label: `随机表法术·${combatPresentationSavingThrowAbilityLabel(plan.effect.saveAbility)} DC ${plan.effect.saveDc}`,
          halflingLuckyLabel: '半身人幸运·随机表法术豁免重投',
          blessLabel: '祝福术·随机表法术豁免加值',
          baneLabel: '灾祸术·随机表法术豁免减值',
        })
        if (!interrupted.success && (target.classState.legendaryResistanceUses ?? 0) > 0) {
          legendaryResistanceTargetIds.push(target.id)
        }
        targetSavingThrows.push({
          targetId,
          d20: interrupted.d20,
          d20Second: interrupted.d20Second,
          halflingLuckyD20: interrupted.halflingLuckyD20,
          halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
          blessRoll: interrupted.blessRoll,
          baneRoll: interrupted.baneRoll,
          rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20,
          rerollD20Second: interrupted.rerollD20Second,
          bardicInspirationRoll: interrupted.bardicInspirationRoll,
          darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
        })
        if (interrupted.optionalBonusDieUse) optionalBonusDice.push(interrupted.optionalBonusDieUse)
      }
      const effectRolls=await input.rollDice(plan.effect.damageDice.count,plan.effect.damageDice.sides,'随机表核心法术·伤害',actorName,{rollerTokenId:actor.id})
      const spell=getDnd5eSrdCombatSpell(plan.effect.spellId),characterId=input.characterIdByCombatantId[actor.id]
      const spellDamageDieRerolls=spell?.damageType&&input.chooseSpellDamageDice?await input.chooseSpellDamageDice({transactionId:JSON.stringify([followupId,'post-spell-fire-dice',actor.id,check.featureId]),actor,character:input.characters.find(character=>character.id===characterId),spellName:spell.name,group:{id:'post-spell-random-table',sides:plan.effect.damageDice.sides,damageType:spell.damageType,rolls:effectRolls}}):[]
      resolution = {
        schemaVersion: 1,
        targetIds: plan.effect.targetIds,
        targetSavingThrows,
        legendaryResistanceTargetIds,
        effectRolls,
        spellDamageDieRerolls,
      }
    }
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'resolve-post-spell-random-table',
      actorId: actor.id,
      featureId: check.featureId,
      triggerRoll,
      tableRoll,
      tableRollCandidates: selectedTableRollIndex == null ? undefined : tableRollCandidates,
      selectedTableRollIndex,
      resolution,
      optionalBonusDice: optionalBonusDice.length > 0 ? optionalBonusDice : undefined,
    })
    if (!resolved.ok) continue
    if (plan.effect) {
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
        resumeActivityStage: undefined,
      settleActivityTriggers: undefined,
        result: resolved,
      })
      state = nested.result.state
      events.push(...nested.result.events)
    } else {
      state = resolved.state
      events.push(...resolved.events)
      const required = resolved.events.find((event) =>
        event.type === 'post-spell-random-table-manual-adjudication-required')
      if (
        required?.type === 'post-spell-random-table-manual-adjudication-required' &&
        input.requestPostSpellRandomTableAdjudication
      ) {
        const response = await input.requestPostSpellRandomTableAdjudication({
          actor: state.combatants[required.actorId] ?? actor,
          featureId: required.featureId,
          adjudicationId: required.adjudicationId,
          sourceSpellId: required.sourceSpellId,
          tableRoll: required.tableRoll,
          outcomeId: required.outcomeId,
          events: resolved.events,
        })
        const adjudicated = await resolveWithUnsupportedAirborneFalls(state, {
          type: 'resolve-post-spell-random-table-manual-adjudication',
          actorId: required.actorId,
          adjudicationId: required.adjudicationId,
          decision: response.decision,
          effects: response.effects.map((effect) => ({
            targetId: effect.targetTokenId,
            operation: effect.operation,
            amount: effect.amount,
            addCondition: effect.addCondition,
            removeCondition: effect.removeCondition,
          })),
          note: response.note,
        })
        if (adjudicated.ok) {
          const nested = await settleDnd5eConcentrationChecks({
            ...input,
            resumeActivityStage: undefined,
      settleActivityTriggers: undefined,
            result: adjudicated,
          })
          state = nested.result.state
          events.push(...nested.result.events)
        }
      }
    }
  }
  const pendingRelentlessRage = input.result.events.filter((event) => event.type === 'relentless-rage-save-required')
  for (const check of pendingRelentlessRage) {
    const combatant = state.combatants[check.targetId]
    if (!combatant || combatant.currentHp !== 0 || combatant.classState.relentlessRagePendingDc !== check.dc) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      dc: check.dc,
      mode,
      label: `坚韧狂暴·体质豁免 DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'barbarian-relentless-rage-save', actorId: check.targetId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
      dc: check.dc,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingUndeadFortitude = input.result.events.filter((event) => event.type === 'undead-fortitude-save-required')
  for (const check of pendingUndeadFortitude) {
    const combatant = state.combatants[check.targetId]
    if (
      !combatant || combatant.currentHp !== 0 || combatant.deathSaves.dead ||
      combatant.classState.undeadFortitudePending?.dc !== check.dc
    ) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      dc: check.dc,
      mode,
      label: `亡灵坚韧·体质豁免 DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'monster-undead-fortitude-save', actorId: check.targetId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingMonsterOnHitSaves = input.result.events.filter((event) => event.type === 'monster-on-hit-save-required')
  for (const check of pendingMonsterOnHitSaves) {
    const combatant = state.combatants[check.targetId]
    const pending = combatant?.classState.monsterOnHitSavePending
    if (
      !combatant || !pending || combatant.currentHp <= 0 || combatant.deathSaves.dead ||
      pending.sourceId !== check.sourceId || pending.actionId !== check.actionId
    ) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const mode = dnd5eSavingThrowMode(combatant, check.ability, {
      effectVisible: true,
      condition: check.condition,
    })
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: check.ability,
      dc: check.dc,
      mode,
      label: `怪物命中特效·${combatPresentationSavingThrowAbilityLabel(check.ability)} DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'monster-on-hit-save', actorId: check.targetId,
      sourceId: check.sourceId, actionId: check.actionId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingDraconicPresence = input.result.events.filter((event) => event.type === 'draconic-presence-save-required')
  for (const check of pendingDraconicPresence) {
    const combatant = state.combatants[check.targetId]
    const source = state.combatants[check.sourceId]
    if (!combatant || !source || !combatant.draconicPresenceSourceIds?.includes(source.id)) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const condition = check.mode === 'fear' ? 'frightened' : 'charmed'
    const mode = dnd5eSavingThrowMode(combatant, 'wis', { effectVisible: true, condition })
    const label = check.mode === 'fear' ? '龙威·恐惧感知豁免' : '龙威·敬畏感知豁免'
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'wis',
      dc: check.dc,
      mode,
      label: `${label} DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'sorcerer-draconic-presence-save', actorId: combatant.id, sourceId: source.id,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    })
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingDamageEffectSaves = input.result.events.filter((event) =>
    event.type === 'active-effect-save-required' && event.timing === 'takes-damage',
  )
  for (const [checkIndex, check] of pendingDamageEffectSaves.entries()) {
    if (check.type !== 'active-effect-save-required') continue
    const combatant = state.combatants[check.targetId]
    const effect = combatant?.classState.activeEffects?.find((candidate) => candidate.id === check.effectId)
    if (
      !combatant || !effect?.repeatSave?.onDamage ||
      !combatant.classState.activeEffectDamageSavePendingIds?.includes(check.effectId)
    ) continue
    if (effect.repeatSave.onDamage.optional === true) {
      const accepted = await input.requestOptionalDamageSave?.({ mapId: input.map.id, targetId: combatant.id,
        characterId: input.characterIdByCombatantId[combatant.id], targetName: combatant.name,
        effectId: effect.id, effectName: effect.label, ability: check.ability, dc: check.dc,
        transactionId: JSON.stringify([followupId, 'optional-damage-save', checkIndex, combatant.id, effect.id]) })
      if (accepted !== true) {
        const declined = await resolveWithUnsupportedAirborneFalls(state, {
          type: 'active-effect-damage-save', actorId: combatant.id, effectId: effect.id, decline: true,
        }, JSON.stringify([followupId, 'decline-damage-save', checkIndex, combatant.id, effect.id]))
        if (declined.ok) { state = declined.state; events.push(...declined.events) }
        continue
      }
    }
    const source = effect.source.actorId ? state.combatants[effect.source.actorId] : undefined
    const baseMode = dnd5eSavingThrowMode(combatant, check.ability, {
      effectVisible: effect.visibility !== 'dm-only',
      sourceCreatureType: source?.creatureType,
      sourceIsSpell: effect.source.kind === 'spell',
    })
    const mode = check.mode === 'advantage'
      ? resolveDnd5eRollMode({
          requestedMode: baseMode,
          advantage: [{ active: true, reason: 'active-effect-damage-save' }],
        }).mode
      : baseMode
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: check.ability,
      dc: check.dc,
      mode,
      label: `受伤触发·${combatPresentationSavingThrowAbilityLabel(check.ability)} DC ${check.dc}`,
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'active-effect-damage-save', actorId: combatant.id, effectId: check.effectId,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      blessRoll: interrupted.blessRoll, baneRoll: interrupted.baneRoll,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
    }, JSON.stringify([followupId, 'damage-effect-save', checkIndex, combatant.id, check.effectId]))
    if (!resolved.ok) continue
    state = resolved.state
    events.push(...resolved.events)
  }
  const pending = input.result.events.filter((event) => event.type === 'concentration-check-required').filter(event => !event.settled)
  for (const [checkIndex,check] of pending.entries()) {
    let combatant = state.combatants[check.targetId]
    if (!combatant?.concentrating) continue
    const targetName = input.map.tokens.find((token) => token.id === check.targetId)?.label ?? combatant.name
    const baseMode = dnd5eSavingThrowMode(combatant, 'con', { effectVisible: true })
    let mode = resolveDnd5eRollMode({
      requestedMode: baseMode,
      disadvantage: [{
        active: combatant.classState.concentrationCheckDisadvantagePendingSourceId != null,
        reason: 'concentration-check-disadvantage',
      }],
    }).mode
    const checkTransactionId=JSON.stringify([followupId,'concentration',checkIndex,check.targetId])
    let disadvantageNegation: { rollId: string; transactionId: string } | undefined
    const characterId = input.characterIdByCombatantId[combatant.id]
    const originalCharacter = input.characters.find(character => character.id === characterId)
    if (mode === 'disadvantage' && originalCharacter && input.chooseDisadvantageNegation) {
      const character = { ...originalCharacter, classResources: structuredClone(combatant.classResources) }
      const roll: DisadvantageNegationRoll = { rollId: checkTransactionId,
        characterId: character.id, kind: 'saving-throw', phase: 'before-roll', mode }
      const featureId = await input.chooseDisadvantageNegation({ character, roll, transactionId: checkTransactionId })
      if (featureId) {
        const plan = planDnd5eDisadvantageNegation(character, roll, featureId)
        if (!plan || combatant.classState.disadvantageNegationReceipts?.[roll.rollId]) throw Error('concentration-negation-choice-unavailable')
        state = structuredClone(state)
        combatant = state.combatants[check.targetId]
        combatant.classResources = structuredClone(plan.character.classResources ?? {})
        combatant.classState.disadvantageNegationReceipts = { ...combatant.classState.disadvantageNegationReceipts,
          [roll.rollId]: { rollId: roll.rollId, transactionId: checkTransactionId, kind: 'saving-throw', featureId } }
        disadvantageNegation = { rollId: roll.rollId, transactionId: checkTransactionId }
        mode = 'normal'
      }
    }
    const effectContext={actorId:combatant.id,effects:combatant.classState.activeEffects,kind:'concentration-save' as const,
      eventId:dnd5eRollDiceOccurrenceId(checkTransactionId,combatant.id,'concentration-save',0)}
    const effectRollDice:Record<string,readonly number[]>={}
    for(const recipe of dnd5eRollDiceRecipes(effectContext)) effectRollDice[recipe.id]=await input.rollDice(
      recipe.count,recipe.sides,`专注豁免·${recipe.direction==='add'?'加值':'减值'}`,targetName,{rollerTokenId:combatant.id})
    const effectDiceModifier=resolveDnd5eRollDiceModifiers(effectContext,effectRollDice).modifier
    const interrupted = await resolveSavingThrowInterrupts({
      combatant,
      targetName,
      ability: 'con',
      effectDiceModifier,
      dc: check.dc,
      mode,
      label: `专注·体质豁免 DC ${check.dc}`,
      concentrationOriginal:{operationId:checkTransactionId,action:{type:'concentration-save',actorId:check.targetId,disadvantageNegation,effectRollDice,dc:check.dc}},
    })
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'concentration-save', actorId: check.targetId,
      disadvantageNegation,
      effectRollDice,
      d20: interrupted.d20, d20Second: interrupted.d20Second,
      halflingLuckyD20: interrupted.halflingLuckyD20,
      halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
      blessRoll: interrupted.blessRoll,
      baneRoll: interrupted.baneRoll,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20, rerollD20Second: interrupted.rerollD20Second,
      bardicInspirationRoll: interrupted.bardicInspirationRoll,
      darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice: interrupted.optionalBonusDieUse ? [interrupted.optionalBonusDieUse] : undefined,
      dc: check.dc,
    },checkTransactionId)
    if (!resolved.ok) throw new Error(`concentration-settlement:${resolved.reason}`)
    if(resolved.transaction) {
      const parent=transaction ?? {...resolved.transaction,rollLedger:{entries:[]}}
      const entries=new Map(parent.rollLedger.entries.map(entry=>[entry.id,entry]))
      for(const entry of resolved.transaction.rollLedger.entries) {
        const id=JSON.stringify([checkTransactionId,entry.id])
        entries.set(id,{...entry,id})
      }
      transaction={...parent,rollLedger:{...parent.rollLedger,entries:[...entries.values()]}}
    }
    state = resolved.state
    events.push(...resolved.events)
  }
  const pendingDeathArea = dnd5ePendingMonsterDeathAreaEffects(state)[0]
  if (pendingDeathArea) {
    const source = state.combatants[pendingDeathArea.sourceId]
    const monster = source?.statBlockId
      ? getDnd5eSrdMonster(source.statBlockId)
      : undefined
    const rule = monster?.traits.find((trait) =>
      trait.automation === 'headless' &&
      trait.rule?.kind === 'death-area-saving-throw' &&
      trait.rule.ruleId === pendingDeathArea.ruleId)?.rule
    if (source && monster && rule?.kind === 'death-area-saving-throw') {
      const liveTargetIds = pendingDeathArea.targetIds.filter((targetId) => {
        const target = state.combatants[targetId]
        return !!target && target.currentHp > 0 && !target.deathSaves.dead
      })
      const targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[] = []
      const legendaryResistanceTargetIds: string[] = []
      const optionalBonusDice: import('../../rulesets/dnd5e').Dnd5eOptionalBonusDieUse[] = []
      for (const targetId of liveTargetIds) {
        const target = state.combatants[targetId]!
        const targetName =
          input.map.tokens.find((token) => token.id === targetId)?.label ??
          target.name
        const mode = dnd5eSavingThrowMode(target, rule.ability, {
          effectVisible: true,
          sourceCreatureType: source.creatureType,
          sourceIsSpell: false,
        })
        const interrupted = await resolveSavingThrowInterrupts({
          combatant: target,
          targetName,
          ability: rule.ability,
          dc: rule.dc,
          mode,
          label: `${monster.name}·${rule.ruleId} ${combatPresentationSavingThrowAbilityLabel(rule.ability)} DC ${rule.dc}`,
        })
        if (
          !interrupted.success &&
          (target.classState.legendaryResistanceUses ?? 0) > 0
        ) {
          legendaryResistanceTargetIds.push(target.id)
        }
        targetSavingThrows.push({
          targetId: target.id,
          d20: interrupted.d20,
          d20Second: interrupted.d20Second,
          halflingLuckyD20: interrupted.halflingLuckyD20,
          halflingLuckyD20Second: interrupted.halflingLuckyD20Second,
          blessRoll: interrupted.blessRoll,
          baneRoll: interrupted.baneRoll,
          rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20,
          rerollD20Second: interrupted.rerollD20Second,
          bardicInspirationRoll: interrupted.bardicInspirationRoll,
          darkOnesOwnLuckRoll: interrupted.darkOnesOwnLuckRoll,
        })
        if (interrupted.optionalBonusDieUse) optionalBonusDice.push(interrupted.optionalBonusDieUse)
      }
      const damageRolls = rule.damage
        ? await input.rollDice(
            rule.damage.count,
            rule.damage.sides,
            `${monster.name}·${rule.ruleId} 伤害`,
            source.name, { rollerTokenId: source.id },
          )
        : []
      const resolved = await resolveWithUnsupportedAirborneFalls(state, {
        type: 'resolve-monster-death-area-effect',
        actorId: source.id,
        snapshotId: pendingDeathArea.id,
        resolution: {
          schemaVersion: 1,
          targetIds: liveTargetIds,
          targetSavingThrows,
          legendaryResistanceTargetIds,
          damageRolls,
        },
        optionalBonusDice: optionalBonusDice.length > 0 ? optionalBonusDice : undefined,
      })
      if (resolved.ok) {
        const nested = await settleDnd5eConcentrationChecks({
          ...input,
          resumeActivityStage: undefined,
      settleActivityTriggers: undefined,
          result: resolved,
        })
        state = nested.result.state
        events.push(...nested.result.events)
      }
    }
  }
  if (input.requestHellishRebuke) {
    const damageEvents = input.result.events.filter((event) =>
      event.type === 'damage-applied' && !!event.sourceId && event.amount > 0,
    )
    for (const damageEvent of damageEvents) {
      if (damageEvent.type !== 'damage-applied' || !damageEvent.sourceId) continue
      const reactor = state.combatants[damageEvent.targetId]
      const damageSource = state.combatants[damageEvent.sourceId]
      const reactorCharacterId = input.characterIdByCombatantId[damageEvent.targetId]
      const reactorCharacter = reactorCharacterId
        ? input.characters.find((character) => character.id === reactorCharacterId)
        : undefined
      const rebukeOption = reactor ? dnd5eHellishRebukeReactionOption(reactor) : undefined
      const distance = reactor && damageSource
        ? state.distanceFeetByCombatantPair?.[dnd5eCombatantPairKey(reactor.id, damageSource.id)]
        : undefined
      if (
        !reactor || !damageSource || damageSource.currentHp <= 0 || damageSource.deathSaves.dead ||
        !reactorCharacter || !rebukeOption ||
        reactor.controller === damageSource.controller || !Number.isFinite(distance) || distance! > 60 ||
        state.lineOfEffectBlockedByCombatantPair?.[`${reactor.id}\u0000${damageSource.id}`]
      ) continue
      const accepted = await input.requestHellishRebuke({
        reactor: reactorCharacter,
        reactorTokenId: damageEvent.targetId,
        targetTokenId: damageEvent.sourceId,
        sourceName: input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name,
        damage: damageEvent.amount,
        slotLevel: rebukeOption.slotLevel,
        itemName: rebukeOption.itemName,
        racialInnate: rebukeOption.racialInnate,
      })
      if (!accepted) continue
      const spellcastingSavingThrows: Dnd5eSpellcastingSavingThrowRoll[] = []
      for (const requirement of dnd5eSpellcastingSaveRequirements(state, reactor.id)) {
        const saved = await resolveSavingThrowInterrupts({ combatant: reactor, targetName: reactorCharacter.name,
          ability: requirement.ability, dc: requirement.dc, mode: requirement.mode,
          label: `${requirement.effect.label} · 施法前豁免` })
        spellcastingSavingThrows.push({ ...saved, effectId: requirement.effect.id, targetId: reactor.id,
          optionalBonusDice: saved.optionalBonusDieUse ? [saved.optionalBonusDieUse] : undefined })
      }
      const castingAllowed = previewDnd5eSpellcastingSaves(state, reactor.id, spellcastingSavingThrows)
      if (castingAllowed == null) continue
      const mode = dnd5eSavingThrowMode(damageSource, 'dex', {
        effectVisible: true,
        sourceCreatureType: reactor.creatureType,
        sourceIsSpell: true,
      })
      const sourceName = input.map.tokens.find((token) => token.id === damageSource.id)?.label ?? damageSource.name
      const interrupted = !castingAllowed ? undefined : await resolveSavingThrowInterrupts({
        combatant: damageSource,
        targetName: sourceName,
        ability: 'dex',
        dc: rebukeOption.saveDc,
        mode,
        label: '炼狱叱喝·敏捷豁免',
      })
      const effectRolls = !castingAllowed ? [] : await input.rollDice(
        rebukeOption.slotLevel + 1,
        10,
        '炼狱叱喝·火焰伤害',
        sourceName, { rollerTokenId: reactor.id },
      )
      const spellDamageDieRerolls=castingAllowed&&effectRolls.length&&input.chooseSpellDamageDice?await input.chooseSpellDamageDice({transactionId:JSON.stringify([followupId,'hellish-fire-dice',reactor.id,damageSource.id]),actor:reactor,character:reactorCharacter,spellName:'炼狱叱喝',group:{id:'hellish-rebuke',sides:10,damageType:'fire',rolls:effectRolls}}):[]
      const reaction = await resolveWithUnsupportedAirborneFalls(state, {
        spellcastingSavingThrows,
        type: 'hellish-rebuke', castInstanceId: JSON.stringify([followupId,'hellish-rebuke',reactor.id,damageSource.id]), actorId: reactor.id, targetId: damageSource.id, spellDamageDieRerolls,
        racialInnate: rebukeOption.racialInnate,
        slotLevel: rebukeOption.slotLevel, triggerDamageAmount: damageEvent.amount,
        savingThrowD20: interrupted?.d20 ?? 0,
        savingThrowD20Second: interrupted?.d20Second,
        savingThrowBlessRoll: interrupted?.blessRoll,
        savingThrowBaneRoll: interrupted?.baneRoll,
        halflingLuckyD20: interrupted?.halflingLuckyD20,
        halflingLuckyD20Second: interrupted?.halflingLuckyD20Second,
        bardicInspirationRoll: interrupted?.bardicInspirationRoll,
        darkOnesOwnLuckRoll: interrupted?.darkOnesOwnLuckRoll,
        rerollResourceKey: interrupted?.rerollResourceKey, rerollD20: interrupted?.rerollD20,
        rerollD20Second: interrupted?.rerollD20Second,
        optionalBonusDice: interrupted?.optionalBonusDieUse ? [interrupted?.optionalBonusDieUse] : undefined,
        effectRolls,
      })
      if (!reaction.ok) continue
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
        resumeActivityStage: undefined,
      settleActivityTriggers: undefined,
        result: reaction,
      })
      state = nested.result.state
      events.push(...nested.result.events)
    }
  }
  const pendingMonsterMechanics = dnd5ePendingMonsterMechanicResolutions(state)
  for (const pending of pendingMonsterMechanics) {
    // Triggered attacks require a separate authoritative preview because a
    // critical hit changes the required damage-die count. Dice-only mechanics
    // can be settled immediately, including conditional extra damage.
    if (pending.attacks.length > 0) continue
    const effectRolls = []
    for (const requirement of pending.dice) {
      effectRolls.push({
        effectId: requirement.effectId,
        rolls: await input.rollDice(
          requirement.count,
          requirement.sides,
          `${pending.mechanicName}·${requirement.effectName}`,
          pending.ownerName, { rollerTokenId: pending.snapshot.mechanicOwnerId },
        ),
      })
    }
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: pending.snapshot.mechanicOwnerId,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: pending.snapshot.mechanicOwnerId,
        mechanicId: pending.snapshot.mechanicId,
        effectRolls,
      },
    })
    if (!resolved.ok) continue
    const nested = await settleDnd5eConcentrationChecks({
      ...input,
      resumeActivityStage: undefined,
      settleActivityTriggers: undefined,
      result: resolved,
    })
    state = nested.result.state
    events.push(...nested.result.events)
  }
  // A restored stage enters here with no native events, so those effects and
  // dice are not executed again. Its original events still reach Activity and
  // the final materializer exactly once.
  if (resuming) events.push(...resuming.result.events)
  if (input.settleActivityTriggers) {
    const stage = capturePostNativeActivityStage({parentTransactionId:followupId,result: {...input.result, transaction, state, events}, map, characters: input.characters, characterIdByCombatantId: input.characterIdByCombatantId, priorApplication: input.priorApplication, preserveOffMapParticipants: input.preserveOffMapParticipants})
    issuedStage=stage
    const triggered = await input.settleActivityTriggers({
      stage,
      state,
      events,
      map,
      characters: input.characters,
      characterIdByCombatantId: input.characterIdByCombatantId,
    })
    state = triggered.state
    map = triggered.map ?? map
    events.push(...triggered.events)
    // Activity damage uses the same concentration/death/monster follow-up
    // pipeline. Disable the Activity hook for this nested pass because the
    // trigger coordinator already consumes Activity-produced event batches.
    if (triggered.events.length > 0) {
      const nested = await settleDnd5eConcentrationChecks({
        ...input,
        map,
        resumeActivityStage: undefined,
      settleActivityTriggers: undefined,
        result: { ok: true, state, events: triggered.events },
      })
      state = nested.result.state
      events.push(...nested.result.events.slice(triggered.events.length))
    }
  }
  // Scan persisted obligations as well as fresh events, so a restored snapshot can resume.
  const endingSaves = Object.values(state.combatants).flatMap(actor =>
    (actor.classState.activeEffects ?? []).filter(effect => effect.pendingEndSavingThrow)
      .map(effect => ({actorId: actor.id, effectId: effect.id})))
  for (const pending of endingSaves) {
    const combatant = state.combatants[pending.actorId]
    const effect = combatant?.classState.activeEffects?.find(effect => effect.id === pending.effectId)
    const save = effect?.pendingEndSavingThrow
    if (!combatant || !effect || !save) continue
    const runEndingSave = () => resolveSavingThrowInterrupts({combatant,
      targetName: map.tokens.find(token => token.id === combatant.id)?.label ?? combatant.name,
      ability: save.ability, dc: save.dc,
      mode: dnd5eSavingThrowMode(combatant, save.ability, {sourceIsSpell:false}),
      label: `${effect.label} · ${combatPresentationSavingThrowAbilityLabel(save.ability)} DC ${save.dc}`})
    const endingSaveKey = JSON.stringify(['effect-end-save',map.id,combatant.id,effect.id,effect.appliedAt])
    const interrupted = input.runEffectEndSavingThrow
      ? await input.runEffectEndSavingThrow(endingSaveKey,runEndingSave) : await runEndingSave()
    const resolved = await resolveWithUnsupportedAirborneFalls(state, {
      type:'active-effect-end-save',actorId:combatant.id,effectId:effect.id,
      d20:interrupted.d20,d20Second:interrupted.d20Second,
      blessRoll:interrupted.blessRoll,baneRoll:interrupted.baneRoll,
      halflingLuckyD20:interrupted.halflingLuckyD20,halflingLuckyD20Second:interrupted.halflingLuckyD20Second,
      rerollResourceKey: interrupted.rerollResourceKey, rerollD20: interrupted.rerollD20,rerollD20Second:interrupted.rerollD20Second,
      bardicInspirationRoll:interrupted.bardicInspirationRoll,darkOnesOwnLuckRoll:interrupted.darkOnesOwnLuckRoll,
      optionalBonusDice:interrupted.optionalBonusDieUse?[interrupted.optionalBonusDieUse]:undefined,
    }, JSON.stringify([followupId,'effect-end-save',combatant.id,effect.id]))
    if (!resolved.ok) throw new Error(`Effect ending save failed: ${resolved.reason}`)
    state=resolved.state
    events.push(...resolved.events)
  }
  map = markDnd5eSummonsDamaged(
    map,
    new Set(events.flatMap((event) =>
      event.type === 'damage-applied' && event.amount > 0 ? [event.targetId] : [])),
    state.round,
  )
  // Concentration/reaction follow-ups replace state and append events, but
  // they must not erase map-owned Activity handoffs prepared by the original
  // atomic action. Dropping these fields spends the spell slot and starts
  // concentration while silently losing its persistent area or summon.
  const result: Extract<Dnd5eActionResult, { ok: true }> = {
    ...input.result,
    transaction,
    ok: true,
    state,
    events,
  }
  const projectedState = input.preserveOffMapParticipants ? structuredClone(state) : state
  if (input.preserveOffMapParticipants) {
    const ids = new Set(map.tokens.map(token => token.id))
    projectedState.combatants = Object.fromEntries(Object.entries(projectedState.combatants).filter(([id]) => ids.has(id)))
  }
  const application = planDnd5eMapResultApplication({
    state: projectedState,
    map,
    characters: input.characters,
    characterIdByCombatantId: input.characterIdByCombatantId,
    events,
  })
  // A trigger handoff has already moved its staged map. The planner compares
  // against that map and may produce no delta, but publication still starts
  // from input.map. Retain the actual final movement as a patch for that commit.
  for (const id of new Set(events.flatMap(event => event.type === 'moved' ? [event.actorId] : []))) {
    const before = input.map.tokens.find(token => token.id === id)
    const after = application.map.tokens.find(token => token.id === id)
    if (!before || !after || (before.x === after.x && before.y === after.y &&
      before.elevationFeet === after.elevationFeet && before.dnd5eTraversalMode === after.dnd5eTraversalMode)) continue
    application.tokenPatches = { ...application.tokenPatches, [id]: {
      ...application.tokenPatches?.[id], x: after.x, y: after.y,
      elevationFeet: after.elevationFeet, dnd5eTraversalMode: after.dnd5eTraversalMode,
    } }
    if (!application.changedTokenIds.includes(id)) application.changedTokenIds = [...application.changedTokenIds, id]
  }
  if (input.preserveOffMapParticipants) result.state = { ...state,
    combatants: { ...state.combatants, ...projectedState.combatants } }
  // A continuation can receive only its new events. Retain earlier spending
  // only while the final authority state still says that reaction is consumed.
  const spentReactionIds = [...new Set([
    ...(application.spentReactions?.tokenIds ?? []),
    ...(input.priorApplication?.spentReactions?.round === state.round
      ? input.priorApplication.spentReactions.tokenIds : []),
  ])].filter(id => projectedState.combatants[id]?.turn.reactionAvailable === false &&
    application.map.tokens.some(token => token.id === id))
  const completed=capturePostNativeActivitySettlement(issuedStage,{
    result,
    application: {
      ...application,
      spentReactions: spentReactionIds.length ? { round: state.round, tokenIds: spentReactionIds } : undefined,
      // Sunburst also edits scene darkness, which the entity planner cannot rebuild.
      geometry: application.geometry ?? input.priorApplication?.geometry,
      // The follow-up planner compares against the already-materialized map and
      // character snapshots from the first pass. An entity changed only by the
      // original action therefore has no new patch in this pass even though it
      // must still be committed. Preserve those original deltas, while allowing
      // a later concentration/reaction settlement to replace any field it
      // actually changed.
      tokenPatches: {
        ...(input.priorApplication?.tokenPatches ?? {}),
        ...Object.fromEntries(Object.entries(application.tokenPatches ?? {}).map(([id, patch]) =>
          [id, { ...input.priorApplication?.tokenPatches?.[id], ...patch }])),
      },
      characterPatches: {
        ...(input.priorApplication?.characterPatches ?? {}),
        ...Object.fromEntries(Object.entries(application.characterPatches ?? {}).map(([id, patch]) =>
          [id, { ...input.priorApplication?.characterPatches?.[id], ...patch }])),
      },
      changedTokenIds: [...new Set([
        ...(input.priorApplication?.changedTokenIds ?? []),
        ...application.changedTokenIds,
      ])],
      changedCharacterIds: [...new Set([
        ...(input.priorApplication?.changedCharacterIds ?? []),
        ...application.changedCharacterIds,
      ])],
    },
  })
  completedCombatBases.set(completed,{input:actualBaseInput,inputSignature:actualBaseInputSignature,outputSignature:JSON.stringify(completed)})
  return completed
}
