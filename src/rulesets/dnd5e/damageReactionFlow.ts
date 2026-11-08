import type{Dnd5ePluginTempestuousEarlyBeforePrelude,Dnd5ePluginTempestuousNativeOperation,Dnd5ePluginTempestuousLandingOperation}from'./pluginSpellTransaction'
import{captureDnd5eTempestuousLandingOriginalOperation,type Dnd5eTempestuousLandingOriginalOperation}from'./damageCommitSession'
import{stormFuryMoveSourceNeedsNativeReaction}from'./stormFuryMoveRouting'
import{resolveDnd5eOpportunityMoveSequenceOriginal as furyRoomMoveResolver}from'./opportunityMoveSequence'
import{captureOptionalStormFuryWeaponOriginalOrigin,bindStormFuryWeaponOriginalOperation,type StormFuryWeaponOriginalOrigin}from'./stormFuryWeaponOriginalOrigin'
import{resolvePreparedDnd5eEquipmentAttack as furyRoomEquipmentResolver}from'./equipmentAttackAction'
import{resolvePreparedDnd5eOpportunityAttack as furyRoomOpportunityResolver}from'./opportunityAttackAction'
import{resolvePreparedDnd5eSpellCast as furyRoomSpellResolver}from'./spellAction'
import{resolvePreparedDnd5eMonsterAttack as furyRoomMonsterResolver}from'./monsterAttackAction'
import{captureDnd5eStormFuryOriginalOperation,type Dnd5eStormFuryOriginalOperation}from'./damageCommitSession'
import{captureDnd5eTempestuousAfterSpellOriginalOperation,type Dnd5eTempestuousAfterSpellOriginalOperation}from'./damageCommitSession'
import{initializeTempestuousBeforeReactionSession}from'./tempestuousBeforeReactionSession'
import{captureOptionalBountifulMonsterZeroFlowOperation}from'./bountifulMonsterZeroFlowOperation'
import{hasActualDnd5eMonsterDamageZeroAllyBoundary,type Dnd5eMonsterDamageZeroOriginalOperation}from'./damageZeroMonsterOriginalOperation'
import{captureOptionalDnd5eSpellDamageZeroOriginalOperation,hasActualDnd5eSpellDamageZeroAllyBoundary,type Dnd5eSpellDamageZeroOriginalOperation}from'./damageZeroSpellOriginalOperation'
import{captureOptionalDnd5eDamageZeroOriginalOperation,hasActualDnd5eDamageZeroAllyBoundary,type Dnd5eDamageZeroOriginalOperation}from'./damageZeroOriginalOperation'
import {Dnd5eAfterOriginalFallDecisionRequired,type Dnd5eAfterOriginalFallRequest,type Dnd5eAfterOriginalFallChoice} from './afterOriginalFallCheckpoint'
import {AllyNaturalOneDecisionRequired,type AllyNaturalOneRequest,type AllyNaturalOneDecision} from './allyNaturalOneCheckpoint'
import{copyDnd5eOrdinaryWeaponScene,dnd5eWeaponActivityTurnKey}from'./ordinaryWeaponScene'
import {collectDnd5eActivitySpellDamageDieChoices} from './activities/dnd5eSpellDamageGroups'
import type {Dnd5eSpellDamageDiceChoice} from './spellDamageDieRerolls'
import type { Character } from '../../types/character'
import { consumeDnd5eSingleUseActivityGrant, dnd5eHeadlessTurnKey, resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { createDnd5eDamageCommitSession, createDnd5ePreparedDamageCommitSession, type Dnd5eDamageReplaySession } from './damageCommitSession'
import type { Dnd5eDamageCommitCheckpoint } from './damageCommitCheckpoint'
import { dnd5eDamageCheckpointActivitySupported } from './damageCommitReaction'
import { prepareDnd5eDamageReactionSpell } from './damageReactionSpellPreparation'
import { scaleDnd5eActivityDefinitionV1 } from './activities/dnd5eActivityScaling'
import { planDnd5eMapResultApplication, type Dnd5eMapResultPlan } from './mapBridge'
import type { Dnd5eReactionMaterialChange } from './damageReactionMaterialLedger'
import { mergeDnd5eReactionMaterialsIntoMapPlan } from './damageReactionMaterialApplication'
import { prepareDnd5eDamageReactionMaterialCharacters, type Dnd5ePreparedMaterialContext } from './damageReactionMaterialPreparation'
import { listDnd5ePersonalDamageCheckpointActivitiesV1, type Dnd5eActivityTriggerWindowV1 } from './activities/dnd5eActivityTriggerWindows'
import { rollDnd5eActivityTriggerDiceV1, type Dnd5eActivityTriggerChoiceRequestV1, type Dnd5eActivityTriggerConfirmationV1, type Dnd5eActivityTriggerRollRequestV1 } from './activities/dnd5eActivityTriggerSettlement'
import { listDnd5eWeaponHitActivities } from './activities/dnd5eWeaponHitDiscovery'
import { dnd5eWeaponHitSecondaryCandidates, dnd5eWeaponHitConditionChoices, resolveDnd5eWeaponHitActivity } from './activities/dnd5eWeaponHitActivity'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows'
import { getRegisteredDnd5eActivity, listRegisteredDnd5eActivityPackages } from './activities/dnd5eActivityRegistry'
import type { Dnd5eWeaponHitEvent, Dnd5eWeaponHitDecision } from './weaponHitCheckpoint'
import {collectDnd5eHitPushConsequences} from './weaponHitPushConsequences'
import { dnd5eCriticalCancellationOptions } from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import type { Dnd5eCriticalCancellationSelection } from './criticalCancellationCheckpoint'
import { dnd5eZeroHitPointTurnOptions } from './zeroHitPointReaction'

/** Async Host orchestration. No state is published here; the room commits the
 * sole final result after its own current-revision check. */
export interface Dnd5eDamageReactionFlowOptions {
  /** Room support is explicit and currently limited to genuine Monster/Spell originals. */
  enableStormFuryHit?:boolean
  chooseStormFuryOwner?:(input:{originalOperation:Dnd5eStormFuryOriginalOperation;frame:Readonly<import('./stormFuryHitCheckpoint').StormFuryHitFrame>;state:Dnd5eHeadlessCombatState})=>Promise<Pick<import('./stormFuryHitCheckpoint').StormFuryHitChoice,'frameIndex'|'featureId'>|undefined>
  rollStormFurySaving?:(input:{originalOperation:Dnd5eStormFuryOriginalOperation;request:Readonly<import('./stormFuryHitCheckpoint').StormFuryMaterialRequest>;state:Dnd5eHeadlessCombatState})=>Promise<import('./stormFuryHitCheckpoint').StormFurySavingThrow>
  chooseStormFuryPush?:(input:{originalOperation:Dnd5eStormFuryOriginalOperation;request:Readonly<import('./stormFuryHitCheckpoint').StormFuryMaterialRequest>;state:Dnd5eHeadlessCombatState})=>Promise<import('./headlessCombatEngine').Dnd5eSpellForcedMovement|undefined>

  /** Concrete canonical core-Spell path only; no automatic prompt for other facades. */
  enableTempestuousBeforeSpell?:boolean
  enableTempestuousAfterSpell?:boolean
  resolveTempestuousLandingDice?:(input:{originalOperation:Dnd5eTempestuousLandingOriginalOperation;frame:Readonly<import('./tempestuousLandingCheckpoint').TempestuousLandingDiceFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<readonly number[]>
  chooseTempestuousAfterSpell?:(input:{originalOperation:Dnd5eTempestuousAfterSpellOriginalOperation;frame:Readonly<import('./tempestuousCastCheckpoint').TempestuousCastFlightFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./tempestuousCastCheckpoint').TempestuousCastFlightChoice|undefined>
  enablePluginTempestuousFlight?:boolean
  pluginTempestuousEarlyBefore?:Dnd5ePluginTempestuousEarlyBeforePrelude
  pluginTempestuousOriginalReplay?:import("./allyNaturalOneCheckpoint").OriginalD20ReplayFacts
  choosePluginTempestuousFlight?:(input:{originalOperation:Dnd5ePluginTempestuousNativeOperation;phase:'before'|'after';state:Dnd5eHeadlessCombatState;effectTimestamp:number;eventId:string})=>Promise<import('./tempestuousSpellFlight').TempestuousSpellFlightIntent|undefined>
  resolvePluginTempestuousLanding?:(input:{originalOperation:Dnd5ePluginTempestuousLandingOperation;state:Dnd5eHeadlessCombatState;effectTimestamp:number;eventId:string})=>Promise<readonly number[]>
  tempestuousBeforeOriginalReplay?:object
  chooseTempestuousBeforeSpell?:(input:{frame:Readonly<import('./tempestuousBeforeSpellOffer').TempestuousBeforeSpellOfferFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./tempestuousBeforeSpellOffer').TempestuousBeforeSpellOfferChoice|undefined>
  chooseStormCast?:(input:{frame:Readonly<import('./stormCastCheckpoint').StormCastEruptionFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./stormCastCheckpoint').StormCastEruptionChoice|undefined>
  chooseDamageZeroSavingThrow?: (input:{frame:Readonly<import('./damageZeroSavingThrowCheckpoint').DamageZeroSavingThrowFrame>;state:Dnd5eHeadlessCombatState;eventId:string;originalOperation?:Dnd5eDamageZeroOriginalOperation;spellOriginalOperation?:Dnd5eSpellDamageZeroOriginalOperation;monsterOriginalOperation?:Dnd5eMonsterDamageZeroOriginalOperation})=>Promise<import('./damageZeroSavingThrowCheckpoint').DamageZeroSavingThrowChoice|undefined>
  chooseSpellSelectedAbilityBonus?:(input:{frame:Readonly<import('./spellDamageSelectedAbilityBonus').SpellDamageSelectedAbilityBonusFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./spellDamageSelectedAbilityBonus').SpellDamageSelectedAbilityBonusChoice|undefined>
  chooseSpellHealingReroll?:(input:{frame:Readonly<import('./spellHealingRerollCheckpoint').SpellHealingRerollFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./spellHealingRerollCheckpoint').SpellHealingRerollChoice|undefined>
  rollFailedD20BonusDamage?:(request:Readonly<import('./failedD20BonusCheckpoint').FailedD20BonusDamageRequest>)=>Promise<readonly number[]>
  chooseFailedD20BonusDefense?:(input:{request:Readonly<import('./failedD20BonusCheckpoint').FailedD20BonusDefenseRequest>;state:Dnd5eHeadlessCombatState})=>Promise<import('./failedD20BonusCheckpoint').FailedD20BonusDefenseChoice>
  chooseFailedD20Bonus?:(input:{frame:Readonly<import('./failedD20BonusCheckpoint').FailedD20BonusFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./failedD20BonusCheckpoint').FailedD20BonusChoice|undefined>
  chooseMasterDuelist?:(input:{frame:Readonly<import('./masterDuelistCheckpoint').MasterDuelistMissFrame>;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./masterDuelistCheckpoint').MasterDuelistChoice|undefined>
  rollMasterDuelistDamage?:(request:Readonly<import('./masterDuelistCheckpoint').MasterDuelistDamageRequest>)=>Promise<readonly number[]>
  chooseMasterDuelistDefense?:(input:{request:Parameters<NonNullable<import('./masterDuelistCheckpoint').MasterDuelistPorts['defense']>>[0];state:Dnd5eHeadlessCombatState})=>Promise<import('./masterDuelistCheckpoint').MasterDuelistDefenseChoice>
  chooseAfterOriginalFall?:(input:{request:Dnd5eAfterOriginalFallRequest;state:Dnd5eHeadlessCombatState;eventId:string;occurrence:number})=>Promise<Dnd5eAfterOriginalFallChoice|undefined>
  chooseAllyNaturalOne?: (input:{request:AllyNaturalOneRequest;state:Dnd5eHeadlessCombatState;eventId:string;actualDamageZeroOriginal?:object;actualSpellDamageZeroOriginal?:object;actualMonsterDamageZeroOriginal?:object})=>Promise<AllyNaturalOneDecision|undefined>
  replayEventBatchId?:string
  /** Real room implementation must obtain this world fact from the DM, never the actor. */
  confirmPlanarOrigin?: (request:{eventId:string;occurrence:number;actorId:string;targetId:string;
    packageId:string;activityId:string;targetName:string})=>Promise<'native'|'foreign'>
  rollIncomingCriticalDice?:(request:import('./incomingAttackRerollCheckpoint').IncomingCriticalDiceRequest)=>Promise<readonly number[]>
  chooseFailedSavingThrow?:(input:{facts:import('./failedSavingThrowCheckpoint').FailedSavingThrowFacts;state:Dnd5eHeadlessCombatState;eventId:string;occurrence:number})=>Promise<import('./failedSavingThrowCheckpoint').FailedSavingThrowChoice|undefined>
  choosePostD20FeatureUse?:(input:{request:import('./postD20FeatureUseCheckpoint').PostD20FeatureUseRequest;state:Dnd5eHeadlessCombatState;eventId:string;occurrence:number})=>Promise<import('./postD20FeatureUseCheckpoint').PostD20FeatureUseChoice|undefined>
  chooseIncomingAttackArmorClass?:(input:{facts:import('./incomingAttackArmorClassCheckpoint').IncomingAttackArmorClassFacts;state:Dnd5eHeadlessCombatState;eventId:string;occurrence:number})=>Promise<import('./incomingAttackArmorClassCheckpoint').IncomingAttackArmorClassChoice|undefined>
  chooseIncomingAttackReroll?:(input:{facts:import('./incomingAttackRerollCheckpoint').IncomingAttackRollFacts;state:Dnd5eHeadlessCombatState;eventId:string;occurrence:number})=>Promise<import('./incomingAttackRerollCheckpoint').IncomingAttackRerollChoice|undefined>
  /** Owner D6 is a separate hit-nullification choice, not an attack reroll. */
  chooseIncomingHitNegation?:(input:{facts:import('./incomingHitNegationCheckpoint').IncomingHitNegationFacts;state:Dnd5eHeadlessCombatState;eventId:string;occurrence:number})=>Promise<import('./incomingHitNegationCheckpoint').IncomingHitNegationChoice|undefined>
  chooseSpellDamageDice?:Dnd5eSpellDamageDiceChoice
  chooseRelentlessReaction?: (input:{request:import('./relentlessReactionCheckpoint').Dnd5eRelentlessReactionRequest;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./relentlessReactionCheckpoint').Dnd5eRelentlessReactionChoice>
  prepareZeroHitPointTurnStart?: (actorId:string,state:Dnd5eHeadlessCombatState)=>Promise<Extract<Dnd5eAction,{type:'begin-turn'}>>
  combatRevision: number
  movementMap?: import('../../store/maps').BattleMap
  chooseFollow?: (request:{follow:import('./weaponHitFollowCheckpoint').Dnd5eHitFollowRequest;state:Dnd5eHeadlessCombatState;eventId:string})=>Promise<import('./weaponHitFollowCheckpoint').Dnd5eHitFollowChoice>
  pushConsequences?: Pick<Parameters<typeof collectDnd5eHitPushConsequences>[0],'roll'|'rollEffectDice'|'requestFallReaction'|'rollFallingDamage'>
  selectPushCell?: (request:{actorId:string;targetId:string;maximumFeet:number;state:Dnd5eHeadlessCombatState;eventId:string;packageId:string;activity:import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1}) => Promise<import('../../lib/gridCombat').GridCell|null>
  selectSecondaryTargets?: (request: {actorId:string;eventId:string;packageId:string;activity: import('./activities/dnd5eActivityContracts').Dnd5eActivityDefinitionV1;candidates:readonly {id:string;name:string}[]}) => Promise<readonly string[] | undefined>
  charactersByCombatantId?: Readonly<Record<string, Character>>
  authorityUnchanged: () => boolean
  confirm: (request: Dnd5eActivityTriggerChoiceRequestV1) => Promise<Dnd5eActivityTriggerConfirmationV1>
  roll: (request: Dnd5eActivityTriggerRollRequestV1) => Promise<readonly number[]>
}

export function resolveDnd5eActionWithDamageReactions(input: Dnd5eDamageReactionFlowOptions & {
  state:Dnd5eHeadlessCombatState; action:Dnd5eAction; options?:Parameters<typeof resolveDnd5eHeadlessAction>[2]
}):Promise<Dnd5eActionResult> {
  return driveDamageReactions(input,input.state,(pause,hitPause)=>createDnd5eDamageCommitSession(input.state,input.action,pause,input.options,undefined,hitPause,input.replayEventBatchId))
}

export type Dnd5eDamageReactionMapContext = Omit<Parameters<typeof planDnd5eMapResultApplication>[0], 'state' | 'events'>

/** Direct action entry that cannot silently drop its material changes. */
export async function resolveDnd5eActionWithMaterialDamageReactions(
  input: Parameters<typeof resolveDnd5eActionWithDamageReactions>[0], context: Dnd5eDamageReactionMapContext,
): Promise<Dnd5eActionResult & { application?: Dnd5eMapResultPlan }> {
  const charactersByCombatantId = Object.fromEntries(Object.entries(context.characterIdByCombatantId).flatMap(([tokenId, id]) => {
    const character = context.characters.find(candidate => candidate.id === id)
    return character ? [[tokenId, character]] : []
  }))
  const settled = await resolveDnd5ePreparedWithMaterialDamageReactions({ ...input, charactersByCombatantId },
    { prepared: { state: input.state } }, value => {
      const result = resolveDnd5eHeadlessAction(value.prepared.state, input.action, input.options)
      return { result, application: result.ok ? planDnd5eMapResultApplication({ ...context, state: result.state, events: [...result.events] }) : undefined }
    })
  return { ...settled.result, application: settled.application }
}

export function resolveDnd5ePreparedWithDamageReactions<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(
  options:Dnd5eDamageReactionFlowOptions,input:Input,resolve:(input:Input)=>Result,
):Promise<Result> {
  if(!input.prepared)throw new Error('damage-reaction-prepared-state-required')
  return driveDamageReactions(options,input.prepared.state,(pause,hitPause)=>initializeTempestuousBeforeReactionSession(options,input,resolve,()=>createDnd5ePreparedDamageCommitSession(input,resolve,pause,undefined,hitPause,options.replayEventBatchId,options.enableTempestuousBeforeSpell===true,false,options.enableTempestuousAfterSpell===true,furyRoomEnabled(options,resolve,input),undefined,options.enablePluginTempestuousFlight===true,options.pluginTempestuousEarlyBefore,options.pluginTempestuousOriginalReplay)),undefined,()=>captureOptionalStormFuryWeaponOriginalOrigin(input,resolve))
}

/** Host-only nested boundary. The owning facade must merge changes into its final application. */
export function resolveDnd5eDamageBoundaryWithMaterials<Result>(
  options: Dnd5eDamageReactionFlowOptions, state: Dnd5eHeadlessCombatState,
  resolve: (state: Dnd5eHeadlessCombatState) => Result, succeeded: (result: Result) => boolean,
): Promise<{ result: Result; materialChanges: readonly Dnd5eReactionMaterialChange[] }> {
  const input = { prepared: { state } }
  return driveDamageReactions(options, state, (pause,hitPause) => createDnd5ePreparedDamageCommitSession(input,
    value => ({ result: resolve(value.prepared.state), materialChanges: [] as readonly Dnd5eReactionMaterialChange[] }), pause, {
      charactersByCombatantId: options.charactersByCombatantId ?? {}, succeeded: value => succeeded(value.result),
    },hitPause,options.replayEventBatchId), (value, materialChanges) => ({ ...value, materialChanges }))
}

/** Opt-in facade that can carry both combat and inventory changes in one map application. */
export function resolveDnd5ePreparedWithMaterialDamageReactions<
  Input extends { prepared?: { state: Dnd5eHeadlessCombatState } & Dnd5ePreparedMaterialContext },
  Result extends { result?: { ok: boolean }; application?: Dnd5eMapResultPlan },
>(options: Dnd5eDamageReactionFlowOptions, input: Input, resolve: (input: Input) => Result, materialContext?:Dnd5ePreparedMaterialContext): Promise<Result> {
  if (!input.prepared) throw new Error('damage-reaction-prepared-state-required')
  const charactersByCombatantId = prepareDnd5eDamageReactionMaterialCharacters(options.charactersByCombatantId ?? {}, materialContext ?? input.prepared)
  return driveDamageReactions(options, input.prepared.state, (pause,hitPause) => initializeTempestuousBeforeReactionSession(options,input,resolve,()=>createDnd5ePreparedDamageCommitSession(input, resolve, pause, {
    charactersByCombatantId, succeeded: result => result.result?.ok === true, nativeLuckyTransportAvailable: typeof options.chooseAllyNaturalOne==='function',
  },hitPause,options.replayEventBatchId,options.enableTempestuousBeforeSpell===true,false,options.enableTempestuousAfterSpell===true,furyRoomEnabled(options,resolve,input),undefined,options.enablePluginTempestuousFlight===true,options.pluginTempestuousEarlyBefore,options.pluginTempestuousOriginalReplay)), (result, changes) => {
    if (!result.result?.ok || !changes.length) return result
    if (!result.application) throw new Error('damage-reaction-material-application-required')
    return { ...result, application: mergeDnd5eReactionMaterialsIntoMapPlan(result.application, changes) }
  },()=>captureOptionalStormFuryWeaponOriginalOrigin(input,resolve))
}

function furyRoomEnabled(options:Dnd5eDamageReactionFlowOptions,resolve:unknown,source:unknown){return options.enableStormFuryHit===true&&(resolve===furyRoomSpellResolver||resolve===furyRoomMonsterResolver||resolve===furyRoomEquipmentResolver||resolve===furyRoomOpportunityResolver||resolve===furyRoomMoveResolver&&stormFuryMoveSourceNeedsNativeReaction(source))}

async function driveDamageReactions<Result>(input:Dnd5eDamageReactionFlowOptions, state:Dnd5eHeadlessCombatState,
  create:(pause:(checkpoint:Dnd5eDamageCommitCheckpoint,state?:Dnd5eHeadlessCombatState,characters?:Readonly<Record<string, Character>>)=>boolean,
    hitPause:(event:Dnd5eWeaponHitEvent,state:Dnd5eHeadlessCombatState)=>boolean)=>Dnd5eDamageReplaySession<Result>,
  finalizeMaterials?: (result: Result, changes: readonly Dnd5eReactionMaterialChange[]) => Result,
  captureFuryOrigin?:()=>StormFuryWeaponOriginalOrigin|undefined,
):Promise<Result> {
  let furyOrigin:StormFuryWeaponOriginalOrigin|undefined
  const captureFuryOperation=(pending:object)=>{const operation=captureDnd5eStormFuryOriginalOperation(pending);furyOrigin??=captureFuryOrigin?.();if(furyOrigin)bindStormFuryWeaponOriginalOperation(operation,furyOrigin);return operation}
  let offered: {state:Dnd5eHeadlessCombatState; windows:readonly Dnd5eActivityTriggerWindowV1[]; characters:Readonly<Record<string, Character>>} | undefined
  const characters = structuredClone(input.charactersByCombatantId ?? {})
  const hitBatchId = input.replayEventBatchId ? `weapon-hit:${input.replayEventBatchId}` : `weapon-hit:${globalThis.crypto.randomUUID()}`
  const hitDefinitions = new Map<string, { packageId: string; activityId: string; version: string; signature: string }>()
  const session = create((checkpoint,state,stagedCharacters)=>{
    if(!state)return false
    const activeCharacters = stagedCharacters ?? characters
    const windows = listDnd5ePersonalDamageCheckpointActivitiesV1({state,checkpoint,eventBatchId:'discovery',character:activeCharacters[checkpoint.targetId],allowMaterialWrites:!!finalizeMaterials})
      .map(window=>({...window,available:window.available.filter(entry=>dnd5eDamageCheckpointActivitySupported(entry.activity,checkpoint))}))
      .filter(window=>window.available.length>0)
    offered={state,windows,characters:activeCharacters}
    return windows.length>0
  }, (event,snapshot) => listDnd5eWeaponHitActivities({ state:snapshot,event,eventBatchId:hitBatchId,combatRevision:input.combatRevision }).length > 0)
  const guard = () => {
    if(!input.authorityUnchanged()) {session.cancel();throw new Error('damage-reaction-stale-authority')}
    for (const definition of hitDefinitions.values()) if (JSON.stringify(getRegisteredDnd5eActivity(definition.packageId,definition.activityId)) !== definition.signature ||
      listRegisteredDnd5eActivityPackages().find(entry=>entry.packageId===definition.packageId)?.packageVersion !== definition.version) {
      session.cancel();throw new Error('weapon-hit-activity-changed')
    }
  }
  try {
    guard()
    let result=session.run(state)
    for(let count=0;(result.status==='pending-plugin-tempestuous-flight'||result.status==='pending-plugin-tempestuous-landing'||result.status==='pending-storm-fury-owner'||result.status==='pending-storm-fury-saving'||result.status==='pending-storm-fury-push'||result.status==='pending-tempestuous-landing-dice'||result.status==='pending-tempestuous-after-spell'||result.status==='pending-tempestuous-before-spell'||result.status==='pending-spell-selected-ability'||result.status==='pending-storm-cast'||result.status==='pending-damage-zero-saving-throw'||result.status==='pending-spell-healing-reroll'||result.status==='pending-failed-d20-bonus-damage'||result.status==='pending-failed-d20-bonus-defense'||result.status==='pending-failed-d20-bonus'||result.status==='pending-master-duelist'||result.status==='pending-master-duelist-damage'||result.status==='pending-master-duelist-defense'||result.status==='pending-failed-saving-throw' || result.status==='pending-post-d20-feature-use' || result.status==='pending-incoming-armor-class' || result.status==='pending-after-original-fall' || result.status==='pending-ally-natural-one' || result.status==='pending-automatic-hit' || result.status==='pending-incoming-critical-dice'||result.status==='pending-incoming-attack'||result.status==='pending-incoming-hit-negation'||result.status==='pending' || result.status==='pending-multipart-save' || result.status==='pending-zero'||result.status==='pending-relentless'||result.status==='pending-zero-start'||result.status==='pending-critical'||result.status==='pending-weapon-hit'||result.status==='pending-hit-push'||result.status==='pending-hit-follow') && count<128;count++) {
      if(result.status==='pending-damage-zero-saving-throw'){if(!input.chooseDamageZeroSavingThrow)throw Error('damage-zero-saving-throw-choice-transport-required');const pending=result;guard();const choice=await input.chooseDamageZeroSavingThrow({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id,originalOperation:captureOptionalDnd5eDamageZeroOriginalOperation(pending),spellOriginalOperation:captureOptionalDnd5eSpellDamageZeroOriginalOperation(pending),monsterOriginalOperation:captureOptionalBountifulMonsterZeroFlowOperation(pending)});guard();result=session.resumeDamageZeroSavingThrow(state,pending.frame,choice);continue}
      if(result.status==='pending-spell-selected-ability'){if(!input.chooseSpellSelectedAbilityBonus)throw Error('spell-selected-ability-choice-transport-required');const pending=result;guard();const choice=await input.chooseSpellSelectedAbilityBonus({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeSpellSelectedAbilityBonus(state,pending.frame,choice);continue}
      if(result.status==='pending-spell-healing-reroll'){if(!input.chooseSpellHealingReroll)throw Error('spell-healing-reroll-choice-transport-required');const pending=result;guard();const choice=await input.chooseSpellHealingReroll({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeSpellHealingReroll(state,pending.frame,choice);continue}
      if(result.status==='pending-failed-d20-bonus-damage'){if(!input.rollFailedD20BonusDamage)throw Error('failed-d20-bonus-damage-transport-required');const pending=result;guard();const values=await input.rollFailedD20BonusDamage(structuredClone(pending.request));guard();result=session.resumeFailedD20BonusDamage(state,pending.request,values);continue}
      if(result.status==='pending-failed-d20-bonus-defense'){if(!input.chooseFailedD20BonusDefense)throw Error('failed-d20-bonus-defense-transport-required');const pending=result;guard();const choice=await input.chooseFailedD20BonusDefense({request:structuredClone(pending.request),state:structuredClone(pending.snapshot)});guard();result=session.resumeFailedD20BonusDefense(state,pending.request,choice);continue}
      if(result.status==='pending-failed-d20-bonus'){if(!input.chooseFailedD20Bonus)throw Error('failed-d20-bonus-choice-transport-required');const pending=result;guard();const choice=await input.chooseFailedD20Bonus({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeFailedD20Bonus(state,pending.frame,choice);continue}
      if(result.status==='pending-plugin-tempestuous-flight'){if(!input.choosePluginTempestuousFlight)throw Error('plugin-tempestuous-room:owner-transport-required');const pending=result;guard();const choice=await input.choosePluginTempestuousFlight({originalOperation:pending.operation,phase:pending.phase,state:structuredClone(pending.snapshot),effectTimestamp:pending.effectTimestamp,eventId:hitBatchId+':plugin-tempestuous:'+pending.phase});guard();result=session.resumePluginTempestuousFlight(state,pending.operation,choice);continue}
      if(result.status==='pending-plugin-tempestuous-landing'){if(!input.resolvePluginTempestuousLanding)throw Error('plugin-tempestuous-room:landing-transport-required');const pending=result;guard();const values=await input.resolvePluginTempestuousLanding({originalOperation:pending.operation,state:structuredClone(pending.snapshot),effectTimestamp:pending.effectTimestamp,eventId:hitBatchId+':plugin-tempestuous-landing'});guard();result=session.resumePluginTempestuousLanding(state,pending.operation,values);continue}
      if(result.status==='pending-storm-fury-owner'){if(!input.chooseStormFuryOwner)throw Error('storm-fury-room:owner-transport-required');const pending=result;guard();const choice=await input.chooseStormFuryOwner({originalOperation:captureFuryOperation(pending),frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot)});guard();result=session.resumeStormFuryOwner(state,pending.frame,choice);continue}
      if(result.status==='pending-storm-fury-saving'){if(!input.rollStormFurySaving)throw Error('storm-fury-room:saving-transport-required');const pending=result;guard();const roll=await input.rollStormFurySaving({originalOperation:captureFuryOperation(pending),request:structuredClone(pending.request),state:structuredClone(pending.snapshot)});guard();result=session.resumeStormFurySaving(state,pending.request,roll);continue}
      if(result.status==='pending-storm-fury-push'){if(!input.chooseStormFuryPush)throw Error('storm-fury-room:push-transport-required');const pending=result;guard();const movement=await input.chooseStormFuryPush({originalOperation:captureFuryOperation(pending),request:structuredClone(pending.request),state:structuredClone(pending.snapshot)});guard();result=session.resumeStormFuryPush(state,pending.request,movement);continue}
      if(result.status==='pending-tempestuous-landing-dice'){if(!input.resolveTempestuousLandingDice)throw Error('tempestuous-landing-dice-transport-required');const pending=result;guard();const values=await input.resolveTempestuousLandingDice({originalOperation:captureDnd5eTempestuousLandingOriginalOperation(pending),frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeTempestuousLandingDice(state,pending.frame,values);continue}
      if(result.status==='pending-tempestuous-after-spell'){if(!input.chooseTempestuousAfterSpell)throw Error('tempestuous-after-choice-transport-required');const pending=result;guard();const choice=await input.chooseTempestuousAfterSpell({originalOperation:captureDnd5eTempestuousAfterSpellOriginalOperation(pending),frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeTempestuousAfterSpell(state,pending.frame,choice);continue}
      if(result.status==='pending-tempestuous-before-spell'){if(!input.chooseTempestuousBeforeSpell)throw Error('tempestuous-before-choice-transport-required');const pending=result;guard();const choice=await input.chooseTempestuousBeforeSpell({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeTempestuousBeforeSpell(state,pending.frame,choice);continue}
      if(result.status==='pending-storm-cast'){if(!input.chooseStormCast)throw Error('storm-cast-choice-transport-required');const pending=result;guard();const choice=await input.chooseStormCast({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeStormCast(state,pending.frame,choice);continue}
      if(result.status==='pending-master-duelist'){if(!input.chooseMasterDuelist)throw Error('master-duelist-choice-transport-required');const pending=result;guard();const choice=await input.chooseMasterDuelist({frame:structuredClone(pending.frame),state:structuredClone(pending.snapshot),eventId:pending.frame.id});guard();result=session.resumeMasterDuelist(state,pending.frame,choice);continue}
      if(result.status==='pending-master-duelist-damage'){if(!input.rollMasterDuelistDamage)throw Error('master-duelist-damage-transport-required');const pending=result;guard();const values=await input.rollMasterDuelistDamage(structuredClone(pending.request));guard();result=session.resumeMasterDuelistDamage(state,pending.request,values);continue}
      if(result.status==='pending-master-duelist-defense'){if(!input.chooseMasterDuelistDefense)throw Error('master-duelist-defense-transport-required');const pending=result;guard();const choice=await input.chooseMasterDuelistDefense({request:structuredClone(pending.request),state:structuredClone(pending.snapshot)});guard();result=session.resumeMasterDuelistDefense(state,pending.request,choice);continue}
      if(result.status==='pending-multipart-save'){
        const pending=result,eventId=`${hitBatchId}:multipart-save:${pending.occurrence}`
        guard()
        const choice=await input.confirm({eventId,packageId:'false-hydra-v1',actorId:pending.request.actorId,
          targetIds:[pending.request.actorId],confirmation:'actor-choice',
          activity:{schemaVersion:1,id:'multipart-resilience',name:'多头韧性',
            description:`豁免结果 ${pending.request.total}，DC ${pending.request.dc}。是否承受25点心灵伤害，将本次失败改为成功？伤害累计断头阈值。`,
            activation:{kind:'free'},automation:automationCapabilityFromLegacyStatus('full'),target:{kind:'self'},outcomes:[]},
          triggerContext:{eventId,event:'after-save',source:{kind:'combat',id:state.combatId},
            eligibleActorIds:[pending.request.actorId],eligibleTargetIds:[pending.request.actorId],actionEconomyAvailable:{reaction:true}}})
        guard();result=session.resumeMultipartSave(state,pending.occurrence,choice.accepted);continue
      }
      if(result.status==='pending-after-original-fall'){
        const pending=result
        if(!input.chooseAfterOriginalFall)throw new Dnd5eAfterOriginalFallDecisionRequired(pending.request,pending.snapshot)
        guard();const choice=await input.chooseAfterOriginalFall({request:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:hitBatchId+':after-original-fall:'+pending.occurrence,occurrence:pending.occurrence});guard()
        if(!choice)throw new Dnd5eAfterOriginalFallDecisionRequired(pending.request,pending.snapshot)
        result=session.resumeAfterOriginalFall(state,pending.occurrence,pending.request,choice);continue
      }
      if(result.status==='pending-ally-natural-one'){
        const pending=result
        if(!input.chooseAllyNaturalOne)throw new AllyNaturalOneDecisionRequired(pending.request,pending.snapshot)
        guard()
        const decision=await input.chooseAllyNaturalOne({request:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:hitBatchId+':ally-natural-one:'+pending.occurrence,...(hasActualDnd5eDamageZeroAllyBoundary(pending)?{actualDamageZeroOriginal:pending}:{}),...(hasActualDnd5eSpellDamageZeroAllyBoundary(pending)?{actualSpellDamageZeroOriginal:pending}:{}),...(hasActualDnd5eMonsterDamageZeroAllyBoundary(pending)?{actualMonsterDamageZeroOriginal:pending}:{})})
        guard()
        result=session.resumeAllyNaturalOne(state,pending.occurrence,pending.request,decision)
        continue
      }
      if(result.status==='pending-automatic-hit'){
        const pending=result,rolls:Record<string,{values:readonly number[]}>={}
        for(const declaration of pending.request.rolls){guard();rolls[declaration.id]={values:await input.roll({...declaration,label:pending.request.activityName,kind:'formula',actorId:pending.request.actorId,rollerTokenId:pending.request.actorId,targetId:pending.request.targetId,targetName:pending.snapshot.combatants[pending.request.targetId].name})};guard()}
        const activity=getRegisteredDnd5eActivity(pending.request.packageId,pending.request.activityId)
        if(!activity)throw Error('automatic-hit-retaliation-definition-missing')
        const selectedRolls=await collectDnd5eActivitySpellDamageDieChoices({state:pending.snapshot,actorId:pending.request.actorId,targetIds:[pending.request.targetId],packageId:pending.request.packageId,activity,rolls,transactionId:hitBatchId+':automatic:'+pending.occurrence,charactersByCombatantId:input.charactersByCombatantId,choose:input.chooseSpellDamageDice});guard()
        result=session.resumeAutomaticHit(state,pending.occurrence,pending.request,selectedRolls);continue
      }
      if(result.status==='pending-incoming-critical-dice'){
        if(!input.rollIncomingCriticalDice)throw Error('incoming-critical-dice-transport-required')
        const pending=result;guard();const values=await input.rollIncomingCriticalDice(structuredClone(pending.request));guard();result=session.resumeIncomingCriticalDice(state,pending.request,values);continue
      }
      if(result.status==='pending-incoming-hit-negation'){
        if(!input.chooseIncomingHitNegation)throw Error('incoming-hit-negation-choice-transport-required')
        const pending=result;guard()
        const choice=await input.chooseIncomingHitNegation({facts:structuredClone(pending.facts),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:incoming-hit-negation:${pending.occurrence}`,occurrence:pending.occurrence})
        guard();result=session.resumeIncomingHitNegation(state,pending.occurrence,pending.facts,choice);continue
      }
      if(result.status==='pending-failed-saving-throw'){
        if(!input.chooseFailedSavingThrow)throw Error('failed-saving-throw-transport-required')
        const pending=result;guard();const choice=await input.chooseFailedSavingThrow({facts:structuredClone(pending.facts),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:failed-save:${pending.occurrence}`,occurrence:pending.occurrence});guard()
        result=session.resumeFailedSavingThrow(state,pending.occurrence,pending.facts,choice);continue
      }
      if(result.status==='pending-post-d20-feature-use'){
        if(!input.choosePostD20FeatureUse)throw Error('post-d20-feature-use-transport-required')
        const pending=result;guard();const choice=await input.choosePostD20FeatureUse({request:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:post-d20-use:${pending.occurrence}`,occurrence:pending.occurrence});guard()
        result=session.resumePostD20FeatureUse(state,pending.occurrence,pending.request,choice);continue
      }
      if(result.status==='pending-incoming-armor-class'){

        if(!input.chooseIncomingAttackArmorClass)throw Error('incoming-attack-armor-class-transport-required')
        const pending=result;guard();const choice=await input.chooseIncomingAttackArmorClass({facts:structuredClone(pending.facts),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:incoming-ac:${pending.occurrence}`,occurrence:pending.occurrence});guard()
        result=session.resumeIncomingArmorClass(state,pending.occurrence,pending.facts,choice);continue
      }
      if(result.status==='pending-incoming-attack'){
        if(!input.chooseIncomingAttackReroll)throw Error('incoming-attack-reaction-choice-required')
        const pending=result;guard();const choice=await input.chooseIncomingAttackReroll({facts:structuredClone(pending.facts),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:incoming:${pending.occurrence}`,occurrence:pending.occurrence});guard()
        result=session.resumeIncomingAttack(state,pending.occurrence,pending.facts,choice);continue
      }
      if(result.status==='pending-relentless'){
        if(!input.chooseRelentlessReaction)throw Error('relentless-reaction-selection-unavailable')
        const pending=result
        guard()
        const choice=await input.chooseRelentlessReaction({request:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:relentless:${pending.occurrence}`})
        guard()
        result=session.resumeRelentless(state,pending.occurrence,pending.request,choice)
        continue
      }
      if(result.status==='pending-zero-start'){
        if(!input.prepareZeroHitPointTurnStart)throw new Error('zero-hp-start-input-required')
        const start=await input.prepareZeroHitPointTurnStart(result.actorId,result.snapshot)
        guard();result=session.resumeZeroStart(state,start);continue
      }
      if(result.status==='pending-zero'){
        const pending=result
        let selected:string|undefined
        for(const option of dnd5eZeroHitPointTurnOptions(pending.snapshot,pending.checkpoint)){
          const feature=dnd5ePluginFeatureDefinition(option.featureId)
          if(!feature?.declarativeAbility)throw new Error('zero-hp-definition-missing')
          const eventId=`${hitBatchId}:zero-hp:${pending.checkpoint.occurrence}:${option.featureId}`
          guard()
          const choice=await input.confirm({eventId,packageId:feature.ownerPluginId,actorId:option.actorId,
            targetIds:[option.actorId],confirmation:'actor-choice',
            activity:{schemaVersion:1,id:'zero-hit-point-extra-turn',name:feature.name,description:feature.declarativeAbility.description,
              activation:{kind:'reaction'},automation:automationCapabilityFromLegacyStatus('partial'),target:{kind:'self'},outcomes:[]},
            triggerContext:{eventId,event:'before-drop-to-zero',source:{kind:'combat',id:state.combatId},
              eligibleActorIds:[option.actorId],eligibleTargetIds:[option.actorId],actionEconomyAvailable:{reaction:true}},
          })
          guard()
          if(choice.accepted){selected=option.featureId;break}
        }
        result=session.resumeZero(state,pending.checkpoint.occurrence,selected);continue
      }
      if(result.status==='pending-critical'){
        const pending=result
        let selection:Dnd5eCriticalCancellationSelection|undefined
        for(const option of dnd5eCriticalCancellationOptions(pending.snapshot,pending.event)){
          const feature=dnd5ePluginFeatureDefinition(option.featureId),ability=feature?.declarativeAbility
          if(!feature||!ability)continue
          const signature=JSON.stringify(ability)
          const triggerContext=dnd5eActivityTriggerContextsFromCombatEventV1(pending.snapshot,pending.event,0,`${hitBatchId}:critical:${pending.occurrence}`).find(context=>context.event==='attack-hit')
          if(!triggerContext)throw Error('critical-cancellation-trigger-missing')
          guard()
          const choice=await input.confirm({eventId:`${triggerContext.eventId}:${option.protectorId}:${option.featureId}`,packageId:feature.ownerPluginId,
            actorId:option.protectorId,targetIds:[pending.event.targetId],confirmation:'actor-choice',triggerContext,
            activity:{schemaVersion:1,id:'critical-cancellation',name:ability.name,description:ability.description,
              activation:{kind:'reaction'},automation:automationCapabilityFromLegacyStatus('partial'),
              target:{kind:'creature',count:1,relation:'any',rangeFeet:ability.targeting.kind==='single-creature'?ability.targeting.rangeFeet:undefined},outcomes:[]}})
          guard()
          if(JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId)?.declarativeAbility)!==signature)throw Error('critical-cancellation-definition-changed')
          if(choice.accepted){selection={protectorId:option.protectorId,featureId:option.featureId};break}
        }
        result=session.resumeCritical(state,pending.occurrence,pending.event,selection)
        continue
      }
      if(result.status==='pending-hit-follow'){
        if(!input.chooseFollow)throw Error('weapon-hit-follow-selection-unavailable')
        const pending=result
        guard()
        const choice=await input.chooseFollow({follow:structuredClone(pending.request),state:structuredClone(pending.snapshot),eventId:`${hitBatchId}:follow:${pending.occurrence}`})
        guard()
        result=session.resumeHitFollow(state,pending.occurrence,pending.request,choice)
        continue
      }
      if(result.status==='pending-hit-push'){
        const push=result,map=input.movementMap
        if(!map)throw Error('weapon-hit-push-map-required')
        guard()
        const receipts=await collectDnd5eHitPushConsequences({state:push.snapshot,map,events:[push.event],
          transactionId:`${hitBatchId}:push:${push.occurrence}`,isCurrent:()=>{guard();return true},
          roll:input.pushConsequences?.roll??(async()=>{throw Error('weapon-hit-push-save-ui-required')}),
          rollEffectDice:input.pushConsequences?.rollEffectDice,
          requestFallReaction:input.pushConsequences?.requestFallReaction,
          rollFallingDamage:input.pushConsequences?.rollFallingDamage??(async()=>{throw Error('weapon-hit-push-fall-ui-required')})})
        guard()
        if(!receipts.ok)throw Error(`weapon-hit-push-${receipts.reason}`)
        result=session.resumeHitPush(state,push.occurrence,push.event,{map,entryReplays:receipts.entryReplays,
          landings:receipts.landings,fallReactions:receipts.fallReactions})
        continue
      }
      if(result.status==='pending-weapon-hit') {
        const hit=result, staged=copyDnd5eOrdinaryWeaponScene(hit.snapshot,structuredClone(hit.snapshot)), batch=`${hitBatchId}:${hit.occurrence}`
        const offers=listDnd5eWeaponHitActivities({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision})
        const decisions: Dnd5eWeaponHitDecision[]=[]
        const handled: {packageId:string;activityId:string}[]=[]
        for(const offer of offers) {
          const entry=offer.available
          const identity={packageId:entry.packageId,activityId:entry.activity.id}
          handled.push(identity)
          hitDefinitions.set(JSON.stringify(identity),{...identity,version:entry.packageVersion,signature:offer.definitionSignature})
          guard()
          if(!listDnd5eWeaponHitActivities({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision})
            .some(candidate=>candidate.available.packageId===entry.packageId && candidate.available.activity.id===entry.activity.id))continue
          const triggerContext=dnd5eActivityTriggerContextsFromCombatEventV1(staged,hit.event,0,batch).find(context=>context.event==='attack-hit')!
          const choice = entry.confirmation === 'automatic' ? { accepted: true } : await input.confirm({eventId:triggerContext.eventId,packageId:entry.packageId,activity:{...structuredClone(entry.activity),choices:dnd5eWeaponHitConditionChoices(staged,hit.event,entry.activity)},
            actorId:hit.event.actorId,targetIds:[hit.event.targetId],confirmation:'actor-choice',triggerContext:structuredClone(triggerContext)})
          guard()
          if(!choice.accepted)continue
          let selectedSecondaryTargetIds: readonly string[] = []
          const secondary = entry.activity.outcomes.flatMap(outcome=>outcome.operations).find(operation=>operation.kind==='secondary-weapon-damage')
          if (secondary?.kind === 'secondary-weapon-damage') {
            const candidates = dnd5eWeaponHitSecondaryCandidates(staged,hit.event,secondary)
            if (candidates.length) {
              if (!input.selectSecondaryTargets) throw new Error('weapon-hit-secondary-selection-unavailable')
              const selected = await input.selectSecondaryTargets({actorId:hit.event.actorId,eventId:triggerContext.eventId,
                packageId:entry.packageId,activity:structuredClone(entry.activity),candidates})
              guard()
              if (selected == null) continue
              if (selected.length>128 || new Set(selected).size!==selected.length || selected.some(id=>!candidates.some(candidate=>candidate.id===id))) throw new Error('invalid-secondary-targets')
              selectedSecondaryTargetIds=selected
            }
          }
          let planarOrigin:'native'|'foreign'|undefined
          if(entry.activity.outcomes.some(outcome=>outcome.operations.some(operation=>operation.kind==='weapon-hit-banishment'))){
            if(!input.confirmPlanarOrigin)throw Error('weapon-hit-planar-origin-confirmation-unavailable')
            planarOrigin=await input.confirmPlanarOrigin({eventId:triggerContext.eventId,occurrence:hit.occurrence,
              actorId:hit.event.actorId,targetId:hit.event.targetId,packageId:entry.packageId,activityId:entry.activity.id,
              targetName:staged.combatants[hit.event.targetId].name})
            guard()
            if(planarOrigin!=='native'&&planarOrigin!=='foreign')throw Error('weapon-hit-planar-origin-unconfirmed')
          }
          const authoritativeRolls: Record<string, { values: readonly number[] }> = {}
          for (const roll of offer.rolls) {
            authoritativeRolls[roll.id] = { values: await input.roll({...roll,label:entry.activity.name,kind:roll.kind ?? 'formula',actorId:hit.event.actorId,
              rollerTokenId:roll.rollerTokenId ?? hit.event.actorId,targetId:hit.event.targetId,targetName:staged.combatants[hit.event.targetId].name}) }
            guard()
          }
          let selected=resolveDnd5eWeaponHitActivity({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision,
            ...identity,packageVersion:entry.packageVersion,expectedDefinitionSignature:offer.definitionSignature,choices:choice.choices,authoritativeRolls,selectedSecondaryTargetIds})
          if(!selected.ok)throw new Error(`weapon-hit-${selected.reason}`)
          if(selected.pushSelectionRequired){
            if(!input.selectPushCell || !input.movementMap)throw new Error('weapon-hit-push-selection-unavailable')
            const selectedPushCell=await input.selectPushCell({actorId:hit.event.actorId,targetId:hit.event.targetId,
              maximumFeet:selected.pushSelectionRequired.maximumFeet,state:structuredClone(staged),eventId:triggerContext.eventId,
              packageId:entry.packageId,activity:structuredClone(entry.activity)})
            guard()
            selected=resolveDnd5eWeaponHitActivity({state:staged,event:hit.event,eventBatchId:batch,combatRevision:input.combatRevision,
              ...identity,packageVersion:entry.packageVersion,expectedDefinitionSignature:offer.definitionSignature,choices:choice.choices,authoritativeRolls,
              selectedSecondaryTargetIds,map:input.movementMap,selectedPushCell})
            if(!selected.ok)throw new Error(`weapon-hit-${selected.reason}`)
            if(selected.pushSelectionRequired)throw new Error('weapon-hit-push-selection-required')
          }
          if(selected.decision.planarBanishments?.length){
            if(!planarOrigin)throw Error('weapon-hit-planar-origin-unconfirmed')
            selected.decision={...selected.decision,planarBanishments:selected.decision.planarBanishments.map(rule=>({...rule,origin:planarOrigin}))}
          }
          decisions.push(selected.decision)
          for (const grant of selected.decision.consumedGrants ?? []) consumeDnd5eSingleUseActivityGrant({
            before: staged, after: staged, actorId: hit.event.actorId, packageId: grant.packageId,
            activityId: grant.activityId, targetIds: [hit.event.targetId], grantEffectId: grant.effectId, events: [],
          })
          if (selected.decision.usageKeys?.length) {
            const actor = staged.combatants[hit.event.actorId]
            actor.classState.declarativeUsedTurnKeys = { ...actor.classState.declarativeUsedTurnKeys,
              ...Object.fromEntries(selected.decision.usageKeys.map(key => [key, dnd5eWeaponActivityTurnKey(staged,dnd5eHeadlessTurnKey(staged, actor.id))])) }
          }
          for(const cost of selected.decision.resourceCosts)staged.combatants[hit.event.actorId].classResources[cost.resourceId].current-=cost.amount
        }
        const extras=decisions.flatMap(decision=>decision.extraDice?[decision.extraDice]:[])
        guard()
        result=session.resumeWeaponHit(state,hit.occurrence,hit.event,{extraDice:extras[0],additionalDice:extras.slice(1),
          ...(decisions.some(decision=>decision.resolvedBonusDamage!=null) ? {
            resolvedBonusDamage:decisions.reduce((sum,decision)=>sum+(decision.resolvedBonusDamage??0),0),
            resolvedBonusDamageRolled:decisions.some(decision=>decision.resolvedBonusDamageRolled===true),
          } : {}),
          damageComponents:decisions.flatMap(decision=>decision.damageComponents??[]),
          actorArmorBonuses:decisions.flatMap(decision=>decision.actorArmorBonuses??[]),
          targetWeaponMultipliers:decisions.flatMap(decision=>decision.targetWeaponMultipliers??[]),
          targetSightLimits:decisions.flatMap(decision=>decision.targetSightLimits??[]),
          linkedEffectApplications:decisions.flatMap(decision=>decision.linkedEffectApplications??[]),
          planarBanishments:decisions.flatMap(decision=>decision.planarBanishments??[]),
          secondaryDamageTargets:decisions.flatMap(decision=>decision.secondaryDamageTargets??[]),
          pushMovements:decisions.flatMap(decision=>decision.pushMovements??[]),
          followRequests:decisions.flatMap(decision=>decision.followRequests??[]),
          consumedGrants:decisions.flatMap(decision=>decision.consumedGrants??[]),
          resourceCosts:decisions.flatMap(decision=>decision.resourceCosts),usageKeys:decisions.flatMap(decision=>decision.usageKeys??[]),handledActivities:handled})
        continue
      }
      const pending=result
      const candidates=offered
      if(!candidates)throw new Error('damage-reaction-missing-checkpoint')
      let accepted=false
      for(const window of candidates.windows) {
        for(const entry of window.available) {
          guard()
          const actorId=pending.checkpoint.targetId
          const spellPreparation = entry.activity.consumption?.some(cost => cost.kind === 'spell-slot')
            ? prepareDnd5eDamageReactionSpell({ packageId: entry.packageId, activity: entry.activity,
              actor: candidates.state.combatants[actorId], character: candidates.characters[actorId] }) : undefined
          if (spellPreparation && (!spellPreparation.ok || (spellPreparation.requiresInventoryWrite && (!finalizeMaterials || spellPreparation.componentCheck.materialPlan?.consumptionTiming === 'spell-end')))) continue
          const triggerContext={...window.triggerContext,eventId:pending.triggerEventId,
            source:{...window.triggerContext.source,executionId:pending.triggerEventId}}
          const decision:Dnd5eActivityTriggerConfirmationV1=entry.confirmation==='automatic' && !spellPreparation ? {accepted:true} : await input.confirm(structuredClone({
            eventId:pending.triggerEventId,packageId:entry.packageId,activity:entry.activity,
            actorId,targetIds:[actorId],confirmation:entry.confirmation,triggerContext,
            ...(spellPreparation?.ok ? { availableCastLevels: spellPreparation.availableCastLevels } : {}),
          }))
          guard()
          if(!decision.accepted)continue
          const castLevel = spellPreparation?.ok ? decision.castLevel : undefined
          if (spellPreparation?.ok && (castLevel == null || !spellPreparation.availableCastLevels.includes(castLevel))) throw new Error('damage-reaction-invalid-slot-choice')
          const rollEntry = castLevel == null ? entry : { ...entry, activity: scaleDnd5eActivityDefinitionV1(entry.activity, { actor: candidates.state.combatants[actorId], castLevel }).activity }
          const rolled=await rollDnd5eActivityTriggerDiceV1({chooseSpellDamageDice:input.chooseSpellDamageDice,charactersByCombatantId:input.charactersByCombatantId,state:candidates.state,available:rollEntry,triggerContext,actorId,targetIds:[actorId],roll:async request=>{
            guard();const values=await input.roll(request);guard();return values
          }})
          guard()
          if('unsupported' in rolled)throw new Error(`damage-reaction-${rolled.unsupported}`)
          result=session.accept(state,pending.checkpoint,{
            command:{schemaVersion:1,commandId:`damage-choice:${globalThis.crypto.randomUUID()}`,
              actorId,packageId:entry.packageId,packageVersion:entry.packageVersion,activityId:entry.activity.id,
              targetIds:[actorId],expectedRevision:input.combatRevision,triggerEventId:pending.triggerEventId,choices:decision.choices,castLevel},
            combatRevision:input.combatRevision,authoritativeRolls:rolled.rolls,checkRollModes:rolled.checkRollModes,
            confirmedBy:entry.confirmation==='automatic'?'system':entry.confirmation==='dm-approval'?'dm':entry.confirmation==='target-choice'?'target':'actor',
            dmApproved:entry.confirmation==='dm-approval',actorCharacter:candidates.characters[actorId],
          })
          accepted=true
          break
        }
        if(accepted)break
      }
      if(!accepted)result=session.decline(state,pending.checkpoint)
    }
    guard()
    if(result.status==='rejected')throw new Error(`damage-reaction-${result.reason}`)
    if(result.status!=='resolved')throw new Error('damage-reaction-checkpoint-limit')
    return finalizeMaterials ? finalizeMaterials(result.result, result.materialChanges ?? []) : result.result
  } finally {session.cancel()}
}

/** Full prepared variant of the existing internal material boundary. The owning
 * genuine async facade retains its complete application and material tail. */
export function resolveDnd5ePreparedNativeBoundaryWithMaterials<Input extends{prepared:{state:Dnd5eHeadlessCombatState}&Dnd5ePreparedMaterialContext},Result>(options:Dnd5eDamageReactionFlowOptions,input:Input,resolve:(value:Input)=>Result,succeeded:(result:Result)=>boolean){
 const charactersByCombatantId=prepareDnd5eDamageReactionMaterialCharacters(options.charactersByCombatantId??{},input.prepared)
 return driveDamageReactions(options,input.prepared.state,(pause,hitPause)=>createDnd5ePreparedDamageCommitSession(input,value=>({result:resolve(value),materialChanges:[]as readonly Dnd5eReactionMaterialChange[]}),pause,{charactersByCombatantId,succeeded:value=>succeeded(value.result)},hitPause,options.replayEventBatchId),(value,materialChanges)=>({...value,materialChanges}))
}
