import{dnd5ePluginSpellCompoundAnsweredReplaySessionInput}from'./pluginSpellCompoundNative'
import{createDnd5ePluginTempestuousSessionScope,readDnd5ePluginTempestuousSessionScope,withDnd5ePluginTempestuousSessionNative,readDnd5ePluginTempestuousSessionPause,acceptDnd5ePluginTempestuousSessionFlight,acceptDnd5ePluginTempestuousSessionLanding,cancelDnd5ePluginTempestuousSession,type Dnd5ePluginTempestuousEarlyBeforePrelude,type Dnd5ePluginTempestuousSessionScope,type Dnd5ePluginTempestuousSessionPending,type Dnd5ePluginTempestuousNativeOperation,type Dnd5ePluginTempestuousLandingOperation}from'./pluginSpellTransaction'
import{readDnd5eSpellWindowOriginalSessionClock,type Dnd5eSpellWindowOriginalSessionClock}from'./spellWindowOriginalSessionClock'
type TempestuousLandingOwnerFacts={frame:Readonly<TempestuousBeforeSpellOfferFrame>|Readonly<TempestuousCastFlightFrame>;snapshot:Dnd5eHeadlessCombatState;choice:TempestuousBeforeSpellOfferChoice|TempestuousCastFlightChoice}
import{withTempestuousLandingDiceCheckpoints,type TempestuousLandingDiceFrame}from'./tempestuousLandingCheckpoint'
import{readDnd5eActualTempestuousLandingOperation}from'./headlessCombatEngine'
class PendingTempestuousLanding extends Error{readonly frame:Readonly<TempestuousLandingDiceFrame>;readonly snapshot:Dnd5eHeadlessCombatState;readonly nativeOperation:object;readonly effectTimestamp:number;readonly owner?:TempestuousLandingOwnerFacts;constructor(frame:Readonly<TempestuousLandingDiceFrame>,snapshot:Dnd5eHeadlessCombatState,nativeOperation:object,effectTimestamp:number,owner?:TempestuousLandingOwnerFacts){super('tempestuous-landing-dice-required');this.frame=frame;this.snapshot=snapshot;this.nativeOperation=nativeOperation;this.effectTimestamp=effectTimestamp;this.owner=owner&&structuredClone(owner)}}
const actualTempestuousLandingNative=new WeakMap<object,{nativeOperation:object;signature:string;owner?:TempestuousLandingOwnerFacts}>()
import{readBountifulOpportunitySequenceOriginalClock}from'./bountifulOpportunitySequenceOriginalClock'
import{stormFuryMovePrefixAcceptsFrame}from'./opportunityMoveSequence'
import{resolveDnd5eOpportunityMoveSequenceOriginal as furyCanonicalMoveResolver,dnd5eActualOpportunityMovePreparationCurrent}from'./opportunityMoveSequence'
import{resolvePreparedDnd5eEquipmentAttack as furyCanonicalEquipmentResolver}from'./equipmentAttackAction'
import{resolvePreparedDnd5eOpportunityAttack as furyCanonicalOpportunityResolver}from'./opportunityAttackAction'
import{resolvePreparedDnd5eMonsterAttack as furyCanonicalMonsterResolver}from'./monsterAttackAction'
import{withStormFuryHitCheckpoints,withStormFuryMaterialPorts,type StormFuryHitFrame,type StormFuryHitChoice,type StormFuryMaterialRequest,type StormFurySavingThrow}from'./stormFuryHitCheckpoint'
import type{Dnd5eSpellForcedMovement}from'./headlessCombatEngine'
type FuryOwnerChoice=Pick<StormFuryHitChoice,'frameIndex'|'featureId'>
class PendingStormFuryOwner extends Error{readonly frame:Readonly<StormFuryHitFrame>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(frame:Readonly<StormFuryHitFrame>,snapshot:Dnd5eHeadlessCombatState){super('storm-fury-owner-required');this.frame=frame;this.snapshot=snapshot}}
class PendingStormFurySaving extends Error{readonly request:Readonly<StormFuryMaterialRequest>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState){super('storm-fury-saving-required');this.request=request;this.snapshot=snapshot}}
class PendingStormFuryPush extends Error{readonly request:Readonly<StormFuryMaterialRequest>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState){super('storm-fury-push-required');this.request=request;this.snapshot=snapshot}}
import{withTempestuousCastFlightCheckpoints,type TempestuousCastFlightFrame,type TempestuousCastFlightChoice}from'./tempestuousCastCheckpoint'
import{resolvePreparedDnd5eSpellCast as tempestuousCanonicalSpellResolver}from'./spellAction'
class PendingTempestuousAfterSpell extends Error{readonly frame:Readonly<TempestuousCastFlightFrame>;readonly snapshot:Dnd5eHeadlessCombatState;readonly effectTimestamp:number;constructor(frame:Readonly<TempestuousCastFlightFrame>,snapshot:Dnd5eHeadlessCombatState,effectTimestamp:number){super('tempestuous-after-choice-required');this.frame=frame;this.snapshot=snapshot;this.effectTimestamp=effectTimestamp}}
import{withTempestuousBeforeCastCheckpoints,type TempestuousBeforeSpellMovementFrame}from'./tempestuousBeforeCastCheckpoint'
import {captureDnd5eSpellWardReplaySession} from './spellWardReplaySession'
import{readDnd5eActualTempestuousBeforeSpellMovement}from'./headlessCombatEngine'
class PendingTempestuousBeforeCast extends Error{readonly frame:Readonly<TempestuousBeforeSpellMovementFrame>;readonly snapshot:Dnd5eHeadlessCombatState;readonly operation:object;readonly effectTimestamp:number;constructor(frame:Readonly<TempestuousBeforeSpellMovementFrame>,snapshot:Dnd5eHeadlessCombatState,operation:object,effectTimestamp:number){super('tempestuous-before-cast-collector-required');this.frame=frame;this.snapshot=snapshot;this.operation=operation;this.effectTimestamp=effectTimestamp}}
const actualTempestuousBeforeCastNative=new WeakMap<object,{operation:object;signature:string}>()
const actualTempestuousBeforeOwnerNative=new WeakMap<object,string>()
import{captureDnd5eActualTempestuousPreparedForReplay,withDnd5eActualTempestuousPreparedReplay}from'./spellAction'
import{withTempestuousBeforeSpellOffers,isTempestuousBeforeSpellOfferChoice,type TempestuousBeforeSpellOfferFrame,type TempestuousBeforeSpellOfferChoice}from'./tempestuousBeforeSpellOffer'
class PendingTempestuousBeforeSpell extends Error{readonly frame:Readonly<TempestuousBeforeSpellOfferFrame>;readonly snapshot:Dnd5eHeadlessCombatState;readonly effectTimestamp:number;constructor(frame:Readonly<TempestuousBeforeSpellOfferFrame>,snapshot:Dnd5eHeadlessCombatState,effectTimestamp:number){super('tempestuous-before-choice-required');this.frame=frame;this.snapshot=snapshot;this.effectTimestamp=effectTimestamp}}
import {withSpellDamageSelectedAbilityBonusCheckpoints,isSpellDamageSelectedAbilityBonusChoice,type SpellDamageSelectedAbilityBonusFrame,type SpellDamageSelectedAbilityBonusChoice} from './spellDamageSelectedAbilityBonus'
class PendingSpellSelectedAbility extends Error{readonly frame:Readonly<SpellDamageSelectedAbilityBonusFrame>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(frame:Readonly<SpellDamageSelectedAbilityBonusFrame>,snapshot:Dnd5eHeadlessCombatState){super('spell-selected-ability-choice-required');this.frame=frame;this.snapshot=snapshot}}
import{observeMissingSpellcastingOriginal}from'./missingSpellcastingOriginal'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{isDamageZeroSavingThrowChoice,withDamageZeroSavingThrowCheckpoints,type DamageZeroSavingThrowFrame,type DamageZeroSavingThrowChoice}from'./damageZeroSavingThrowCheckpoint'
class PendingDamageZeroSave extends Error{readonly frame:Readonly<DamageZeroSavingThrowFrame>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(frame:Readonly<DamageZeroSavingThrowFrame>,snapshot:Dnd5eHeadlessCombatState){super('damage-zero-saving-throw-choice-required');this.frame=frame;this.snapshot=snapshot}}
import{dnd5eOriginalD20PauseTargetActive}from'./allyNaturalOneCheckpoint'
import{withSpellHealingRerollCheckpoints,type SpellHealingRerollFrame,type SpellHealingRerollChoice}from'./spellHealingRerollCheckpoint'
class PendingSpellHealing extends Error{readonly frame:Readonly<SpellHealingRerollFrame>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(frame:Readonly<SpellHealingRerollFrame>,snapshot:Dnd5eHeadlessCombatState){super('spell-healing-reroll-choice-required');this.frame=frame;this.snapshot=snapshot}}
class PendingFailedBonusDamage extends Error{readonly request:Readonly<FailedD20BonusDamageRequest>;constructor(request:Readonly<FailedD20BonusDamageRequest>){super('failed-d20-bonus-damage-required');this.request=request}}
class PendingFailedBonusDefense extends Error{readonly request:Readonly<FailedD20BonusDefenseRequest>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(request:Readonly<FailedD20BonusDefenseRequest>,snapshot:Dnd5eHeadlessCombatState){super('failed-d20-bonus-defense-required');this.request=request;this.snapshot=snapshot}}
import{withFailedD20BonusCheckpoints,type FailedD20BonusFrame,type FailedD20BonusChoice,type FailedD20BonusDamageRequest,type FailedD20BonusDefenseRequest,type FailedD20BonusDefenseChoice}from'./failedD20BonusCheckpoint'
import{dnd5eDeclarativeResourceKey}from'./pluginApi'
class PendingFailedD20Bonus extends Error{readonly frame:Readonly<FailedD20BonusFrame>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(frame:Readonly<FailedD20BonusFrame>,snapshot:Dnd5eHeadlessCombatState){super('failed-d20-bonus-choice-required');this.frame=frame;this.snapshot=snapshot}}
import{withStormCastEruptionCheckpoints,type StormCastEruptionFrame,type StormCastEruptionChoice}from'./stormCastCheckpoint'
class PendingStormCast extends Error{readonly frame:Readonly<StormCastEruptionFrame>;readonly snapshot:Dnd5eHeadlessCombatState;readonly effectTimestamp:number;constructor(frame:Readonly<StormCastEruptionFrame>,snapshot:Dnd5eHeadlessCombatState,effectTimestamp:number){super('storm-cast-choice-required');this.frame=frame;this.snapshot=snapshot;this.effectTimestamp=effectTimestamp}}
import{withMasterDuelistCheckpoints,type MasterDuelistMissFrame,type MasterDuelistChoice,type MasterDuelistDamageRequest,type MasterDuelistPorts,type MasterDuelistDefenseChoice}from'./masterDuelistCheckpoint'
import{dnd5ePluginResourceDefinition}from'./pluginApi'
type MasterDefenseRequest=Parameters<NonNullable<MasterDuelistPorts['defense']>>[0]
class PendingMasterDuelist extends Error{readonly frame:Readonly<MasterDuelistMissFrame>;readonly snapshot:Dnd5eHeadlessCombatState;constructor(frame:Readonly<MasterDuelistMissFrame>,snapshot:Dnd5eHeadlessCombatState){super('master-duelist-choice-required');this.frame=frame;this.snapshot=snapshot;}}
class PendingMasterDamage extends Error{readonly request:Readonly<MasterDuelistDamageRequest>;constructor(request:Readonly<MasterDuelistDamageRequest>){super('master-duelist-damage-required');this.request=request;}}
class PendingMasterDefense extends Error{readonly request:MasterDefenseRequest;readonly snapshot:Dnd5eHeadlessCombatState;constructor(request:MasterDefenseRequest,snapshot:Dnd5eHeadlessCombatState){super('master-duelist-defense-required');this.request=request;this.snapshot=snapshot;}}
import{withFailedSavingThrowCheckpoints,type FailedSavingThrowFacts,type FailedSavingThrowChoice}from'./failedSavingThrowCheckpoint'
class PendingFailedSavingThrow extends Error{readonly facts:FailedSavingThrowFacts;readonly snapshot:Dnd5eHeadlessCombatState;readonly occurrence:number;constructor(facts:FailedSavingThrowFacts,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('failed-saving-throw-choice-required');this.facts=facts;this.snapshot=snapshot;this.occurrence=occurrence}}
import{withPostD20FeatureUseCheckpoints,type PostD20FeatureUseRequest,type PostD20FeatureUseChoice}from'./postD20FeatureUseCheckpoint'
class PendingPostD20FeatureUse extends Error{readonly request:PostD20FeatureUseRequest;readonly snapshot:Dnd5eHeadlessCombatState;readonly occurrence:number;constructor(request:PostD20FeatureUseRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('post-d20-feature-use-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence}}
import {withIncomingAttackArmorClassCheckpoints,type IncomingAttackArmorClassFacts,type IncomingAttackArmorClassChoice}from'./incomingAttackArmorClassCheckpoint'
import{dnd5eIncomingAttackArmorClassOptions}from'./headlessCombatEngine'
import{dnd5ePluginFeatureCurrentEnvelopeFullV1}from'./pluginApi'
class PendingIncomingAttackArmorClass extends Error{readonly facts:IncomingAttackArmorClassFacts;readonly snapshot:Dnd5eHeadlessCombatState;readonly occurrence:number;constructor(facts:IncomingAttackArmorClassFacts,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('incoming-attack-armor-class-required');this.facts=facts;this.snapshot=snapshot;this.occurrence=occurrence}}
import {withBountifulEquipmentInputReplay} from './bountifulEquipmentReplay'
import {createDnd5eParentEffectClock} from './activeEffects'
import {withDnd5eAfterOriginalFallCheckpoints,validDnd5eAfterOriginalFallChoice,type Dnd5eAfterOriginalFallRequest,type Dnd5eAfterOriginalFallChoice} from './afterOriginalFallCheckpoint'
class PendingAfterOriginalFall extends Error{readonly request:Dnd5eAfterOriginalFallRequest;readonly snapshot:Dnd5eHeadlessCombatState;readonly occurrence:number;constructor(request:Dnd5eAfterOriginalFallRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('after-original-fall-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence}}
import {withOriginalD20ParentProbe} from './allyNaturalOneCheckpoint'
import type {Dnd5eCombatEvent} from './headlessCombatEngine'
import {validateOriginalD20ReplayFacts,preparedOriginalD20Replay,withAllyNaturalOneCheckpoints,type OriginalD20ReplayFacts,type OriginalD20Ready,type AllyNaturalOneRequest,type AllyNaturalOneDecision} from './allyNaturalOneCheckpoint'
import{copyDnd5eOrdinaryWeaponScene}from'./ordinaryWeaponScene'
import {withIncomingHitNegationCheckpoints,incomingHitNegationOptions,type IncomingHitNegationFacts,type IncomingHitNegationChoice} from './incomingHitNegationCheckpoint'
class PendingIncomingHitNegation extends Error{readonly facts:IncomingHitNegationFacts;readonly snapshot:Dnd5eHeadlessCombatState;readonly occurrence:number;constructor(facts:IncomingHitNegationFacts,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('incoming-hit-negation-required');this.facts=facts;this.snapshot=snapshot;this.occurrence=occurrence}}
import { dnd5eBoundedHostEventId } from './activities/dnd5eActivityIdentity'
import {withIncomingAttackRerollCheckpoints,type IncomingAttackRollFacts,type IncomingAttackRerollChoice,type IncomingCriticalDiceRequest} from './incomingAttackRerollCheckpoint'
import {dnd5eIncomingAttackRerollOptions} from './headlessCombatEngine'
class PendingIncomingAttack extends Error{readonly facts:IncomingAttackRollFacts;readonly snapshot:Dnd5eHeadlessCombatState;readonly occurrence:number;constructor(facts:IncomingAttackRollFacts,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('incoming-attack-reroll-choice-required');this.facts=facts;this.snapshot=snapshot;this.occurrence=occurrence}}
class PendingIncomingCriticalDice extends Error{readonly request:IncomingCriticalDiceRequest;constructor(request:IncomingCriticalDiceRequest){super('incoming-critical-dice-required');this.request=request}}
import {withMultipartSaveCheckpoints,type MultipartSaveRequest} from './multipartSaveCheckpoint'
import {withDnd5eAutomaticHitRetaliationCheckpoints,Dnd5eAutomaticHitRetaliationRejected,type Dnd5eAutomaticHitRetaliationRequest,type Dnd5eAutomaticHitRetaliationRolls} from './automaticHitRetaliationCheckpoint'
import {Dnd5eRelentlessReactionAttackRejected,withDnd5eRelentlessReactionCheckpoints,type Dnd5eRelentlessReactionRequest,type Dnd5eRelentlessReactionChoice} from './relentlessReactionCheckpoint'
import { resolveDnd5eHeadlessAction, type Dnd5eAction, type Dnd5eActionResult, type Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import { withDnd5eDamageCommitCheckpoints, type Dnd5eDamageCommitCheckpoint } from './damageCommitCheckpoint'
import { resolveDnd5eDamageCheckpointReaction, type Dnd5eDamageReactionSelection, type Dnd5eDamageReactionResolution } from './damageCommitReaction'
import { resolveRegisteredDnd5eActivityInCombatV1, type Dnd5eRegisteredActivityCombatAuthorityInputV1 } from './activities/dnd5eActivityCombatAuthority'
import { getRegisteredDnd5eActivity, registeredDnd5eActivityCatalogSignature } from './activities/dnd5eActivityRegistry'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import type { Character } from '../../types/character'
import { createDnd5eDamageReactionMaterialLedger, type Dnd5eReactionMaterialChange } from './damageReactionMaterialLedger'
import { withDnd5eWeaponHitCheckpoints, type Dnd5eWeaponHitEvent, type Dnd5eWeaponHitDecision } from './weaponHitCheckpoint'
import { cloneDnd5eHostTransactionInput,registerDnd5eHostReceipt,registerDnd5eHostReceiptSlot } from './hostTransactionClone'
import {withDnd5eHitPushCheckpoints,type Dnd5eHitPushEvent,type Dnd5eHitPushReceipts} from './weaponHitPushCheckpoint'
import {withDnd5eHitFollowCheckpoints,type Dnd5eHitFollowRequest,type Dnd5eHitFollowChoice} from './weaponHitFollowCheckpoint'
import { withDnd5eCriticalCancellationCheckpoints, type Dnd5eCriticalHitEvent, type Dnd5eCriticalCancellationSelection } from './criticalCancellationCheckpoint'
import { dnd5eCriticalCancellationOptions, resolveDnd5eCriticalCancellation } from './headlessCombatEngine'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { withDnd5eZeroHitPointCheckpoints, type Dnd5eZeroHitPointCheckpoint } from './zeroHitPointCheckpoint'
import { dnd5eZeroHitPointTurnOptions } from './zeroHitPointReaction'
import { beginDnd5eAcceptedZeroHitPointTurn } from './zeroHitPointTurn'

class PendingMultipartSave extends Error {
 readonly request:MultipartSaveRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(request:MultipartSaveRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('multipart-save-choice-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence}
}
class PendingOriginalD20 extends Error {
 readonly request:OriginalD20Ready
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly events:readonly Dnd5eCombatEvent[]
 constructor(request:OriginalD20Ready,snapshot:Dnd5eHeadlessCombatState,events:readonly Dnd5eCombatEvent[]){super('original-d20-ready');this.request=request;this.snapshot=snapshot;this.events=events}
}
class PendingAllyNaturalOne extends Error {
 readonly request:AllyNaturalOneRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(request:AllyNaturalOneRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('ally-natural-one-choice-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence}
}
class PendingAutomaticHit extends Error {
 readonly request:Dnd5eAutomaticHitRetaliationRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(request:Dnd5eAutomaticHitRetaliationRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('automatic-hit-retaliation-rolls-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence}
}
class PendingRelentless extends Error {
 readonly request:Dnd5eRelentlessReactionRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(request:Dnd5eRelentlessReactionRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){super('relentless-reaction-choice-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence}
}
class PendingZero extends Error {
 readonly checkpoint:Dnd5eZeroHitPointCheckpoint
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(checkpoint:Dnd5eZeroHitPointCheckpoint,snapshot:Dnd5eHeadlessCombatState){super('zero-hp-choice-required');this.checkpoint=checkpoint;this.snapshot=snapshot}
}
class PendingZeroStart extends Error {
 readonly actorId:string
 readonly snapshot:Dnd5eHeadlessCombatState
 constructor(actorId:string,snapshot:Dnd5eHeadlessCombatState){super('zero-hp-start-input-required');this.actorId=actorId;this.snapshot=snapshot}
}

class PendingCritical extends Error {
 readonly event:Dnd5eCriticalHitEvent
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(event:Dnd5eCriticalHitEvent,snapshot:Dnd5eHeadlessCombatState,occurrence:number){
  super('critical-cancellation-required');this.event=event;this.snapshot=snapshot;this.occurrence=occurrence
 }
}

class PendingHitFollow extends Error {
 readonly request:Dnd5eHitFollowRequest
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(request:Dnd5eHitFollowRequest,snapshot:Dnd5eHeadlessCombatState,occurrence:number){
  super('hit-follow-selection-required');this.request=request;this.snapshot=snapshot;this.occurrence=occurrence
 }
}

class PendingHitPush extends Error {
 readonly event:Dnd5eHitPushEvent
 readonly snapshot:Dnd5eHeadlessCombatState
 readonly occurrence:number
 constructor(event:Dnd5eHitPushEvent,snapshot:Dnd5eHeadlessCombatState,occurrence:number){
  super('hit-push-consequences-required');this.event=event;this.snapshot=snapshot;this.occurrence=occurrence
 }
}

type WeaponHitPause = (event: Dnd5eWeaponHitEvent, state: Dnd5eHeadlessCombatState) => boolean
class PendingWeaponHit extends Error {
  readonly event: Dnd5eWeaponHitEvent
  readonly snapshot: Dnd5eHeadlessCombatState
  readonly occurrence: number
  constructor(event: Dnd5eWeaponHitEvent, snapshot: Dnd5eHeadlessCombatState, occurrence: number) {
    super('weapon-hit-decision-required'); this.event = event; this.snapshot = snapshot; this.occurrence = occurrence
  }
}

type MaterialCharacters = Readonly<Record<string, Character>>
type DamagePause = (checkpoint: Dnd5eDamageCommitCheckpoint, state?: Dnd5eHeadlessCombatState, characters?: MaterialCharacters) => boolean
export interface Dnd5eDamageReplayMaterials<Result> {
  charactersByCombatantId: MaterialCharacters
  succeeded: (result: Result) => boolean
  /** An actual local decision transport exists; this grants no Room authority. */
  nativeLuckyTransportAvailable?: boolean
}

class PendingDamage extends Error {
  readonly checkpoint: Dnd5eDamageCommitCheckpoint
  readonly snapshot?: Dnd5eHeadlessCombatState
  readonly characters?: MaterialCharacters
  constructor(checkpoint: Dnd5eDamageCommitCheckpoint, snapshot?: Dnd5eHeadlessCombatState, characters?: MaterialCharacters) {
    super('damage-decision-required'); this.checkpoint = checkpoint; this.snapshot = snapshot
    this.characters = characters
  }
}

type ReactionFailure = Extract<Dnd5eDamageReactionResolution, {ok:false}>['reason']
class RejectedReaction extends Error {
  readonly reason: ReactionFailure
  constructor(reason: ReactionFailure) { super(reason); this.reason = reason }
}

export type Dnd5eDamageCommitSessionResult<Result = Dnd5eActionResult> =
  |Dnd5ePluginTempestuousSessionPending
 |{status:'pending-storm-fury-owner';frame:Readonly<StormFuryHitFrame>;snapshot:Dnd5eHeadlessCombatState;parentId:string;effectTimestamp:number}
 |{status:'pending-storm-fury-saving';request:Readonly<StormFuryMaterialRequest>;snapshot:Dnd5eHeadlessCombatState;parentId:string;effectTimestamp:number}
 |{status:'pending-storm-fury-push';request:Readonly<StormFuryMaterialRequest>;snapshot:Dnd5eHeadlessCombatState;parentId:string;effectTimestamp:number}
  |{status:'pending-damage-zero-saving-throw';frame:Readonly<DamageZeroSavingThrowFrame>;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-spell-selected-ability';frame:Readonly<SpellDamageSelectedAbilityBonusFrame>;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-spell-healing-reroll';frame:Readonly<SpellHealingRerollFrame>;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-failed-d20-bonus-damage';request:Readonly<FailedD20BonusDamageRequest>}
  |{status:'pending-failed-d20-bonus-defense';request:Readonly<FailedD20BonusDefenseRequest>;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-failed-d20-bonus';frame:Readonly<FailedD20BonusFrame>;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-tempestuous-before-cast';frame:Readonly<TempestuousBeforeSpellMovementFrame>;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
  |{status:'pending-tempestuous-landing-dice';frame:Readonly<TempestuousLandingDiceFrame>;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
  |{status:'pending-tempestuous-after-spell';frame:Readonly<TempestuousCastFlightFrame>;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
  |{status:'pending-tempestuous-before-spell';frame:Readonly<TempestuousBeforeSpellOfferFrame>;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
  |{status:'pending-storm-cast';frame:Readonly<StormCastEruptionFrame>;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number}
  |{status:'pending-master-duelist';frame:Readonly<MasterDuelistMissFrame>;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-master-duelist-damage';request:Readonly<MasterDuelistDamageRequest>}
  |{status:'pending-master-duelist-defense';request:MasterDefenseRequest;snapshot:Dnd5eHeadlessCombatState}
  |{status:'pending-failed-saving-throw';facts:FailedSavingThrowFacts;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  |{status:'pending-post-d20-feature-use';request:PostD20FeatureUseRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  |{status:'pending-incoming-armor-class';facts:IncomingAttackArmorClassFacts;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  |{status:'pending-incoming-critical-dice';request:IncomingCriticalDiceRequest}
  |{status:'pending-incoming-hit-negation';facts:IncomingHitNegationFacts;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  |{status:'pending-incoming-attack';facts:IncomingAttackRollFacts;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-multipart-save';request:MultipartSaveRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'original-d20-ready';request:OriginalD20Ready;snapshot:Dnd5eHeadlessCombatState;events:readonly Dnd5eCombatEvent[]}
  | {status:'pending-ally-natural-one';request:AllyNaturalOneRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-after-original-fall';request:Dnd5eAfterOriginalFallRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-automatic-hit';request:Dnd5eAutomaticHitRetaliationRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-relentless';request:Dnd5eRelentlessReactionRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-zero';checkpoint:Dnd5eZeroHitPointCheckpoint;snapshot:Dnd5eHeadlessCombatState}
  | {status:'pending-zero-start';actorId:string;snapshot:Dnd5eHeadlessCombatState}
  | {status:'pending-critical';event:Dnd5eCriticalHitEvent;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-hit-follow';request:Dnd5eHitFollowRequest;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | {status:'pending-hit-push';event:Dnd5eHitPushEvent;snapshot:Dnd5eHeadlessCombatState;occurrence:number}
  | { status: 'pending-weapon-hit'; event: Dnd5eWeaponHitEvent; snapshot: Dnd5eHeadlessCombatState; occurrence: number }
  | { status: 'pending'; checkpoint: Dnd5eDamageCommitCheckpoint; triggerEventId: string; charactersByCombatantId?: MaterialCharacters }
  | { status: 'resolved'; result: Result; materialChanges?: readonly Dnd5eReactionMaterialChange[] }
  | { status: 'rejected'; reason: 'stale-state' | 'stale-checkpoint' | 'session-ended' | 'changed-activity' | ReactionFailure; details?: readonly string[] }

/** Host replay foundation. Supports personal temporary HP and typed defenses
 * at converted raw-damage entries. Redirection and the room UI are not connected. Keep generic
 * before-damage certification blocked.
 * The caller supplies authoritative dice in the original action and commits a resolved
 * result once; neither a suspended replay nor a decline mutates the supplied state.
 */
export function createDnd5eDamageCommitSession(
  source: Dnd5eHeadlessCombatState,
  action: Dnd5eAction,
  shouldPause: DamagePause,
  options?: Parameters<typeof resolveDnd5eHeadlessAction>[2],
  materialCharacters?: MaterialCharacters,
  weaponHitPause?: WeaponHitPause,
  replayEventBatchId?:string,
) {
  const originalAction = cloneDnd5eHostTransactionInput(action)
  const originalOptions = structuredClone(options)
  const originalD20Replay=validateOriginalD20ReplayFacts(originalOptions?.originalD20Replay,originalOptions?.transactionId,source,originalAction)
  return createDamageReplaySession(source, state => resolveDnd5eHeadlessAction(state, originalAction, originalOptions), shouldPause,
    undefined, materialCharacters ? { charactersByCombatantId: materialCharacters, succeeded: result => result.ok } : undefined, weaponHitPause,replayEventBatchId??(originalD20Replay?originalOptions?.transactionId:undefined),undefined,originalD20Replay)
}

/** Registered imports use the same suspended transaction as ordinary attacks.
 * Freeze the Host command, dice and authority inputs; reject catalog changes
 * while a choice is pending. The room caller must still validate its current
 * revision/inventory context and atomically publish only the final result.
 */
export function createDnd5eActivityDamageCommitSession(
  input: Dnd5eRegisteredActivityCombatAuthorityInputV1,
  shouldPause: (checkpoint: Dnd5eDamageCommitCheckpoint, state?: Dnd5eHeadlessCombatState) => boolean,
) {
  const frozen = cloneDnd5eHostTransactionInput(input)
  const definition = () => JSON.stringify(getRegisteredDnd5eActivity(frozen.command.packageId, frozen.command.activityId))
  const signature = definition()
  return createDamageReplaySession(frozen.state,
    state => resolveRegisteredDnd5eActivityInCombatV1({...frozen,state}), shouldPause,
    () => definition() === signature)
}

export type Dnd5eDamageReplaySession<Result> = ReturnType<typeof createDamageReplaySession<Result>>

/** Prepared facades must remain synchronous inside the checkpoint scope. Their
 * outer UI may await player choices; do not retain a global listener over await. */
/** Preserve only issuer-registered receipts while replacing the state with
 * this same replay session's validated baseline. Object spread loses private
 * prepared slots and cannot carry native or other concrete source authority. */
function preparedReplayState<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}}>(frozen:Input,state:Dnd5eHeadlessCombatState):Input{
 const next=cloneDnd5eHostTransactionInput(frozen)
 if(!next.prepared)throw Error('damage-reaction-prepared-state-required')
 next.prepared.state=state
 return next
}

/** Only the actual canonical plugin scope needs the original full input graph.
 * The generic baseline remains authoritative: compare its entire state wire
 * before cloning the complete captured input, so cross-boundary class-state
 * aliases survive without accepting a changed state or caller registration. */
function preparedPluginTempestuousReplayInput<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}}>(frozen:Input,state:Dnd5eHeadlessCombatState):Input{
 if(!frozen.prepared||JSON.stringify(encodeSecondChanceParentWire(frozen.prepared.state))!==JSON.stringify(encodeSecondChanceParentWire(state)))throw Error('plugin-tempestuous-session:exact-validated-baseline-required')
 return cloneDnd5eHostTransactionInput(frozen)
}

export function createDnd5ePreparedDamageCommitSession<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}}, Result>(
  input: Input,
  resolve: (input:Input)=>Result,
  shouldPause: DamagePause,
  materials?: Dnd5eDamageReplayMaterials<Result>,
  weaponHitPause?: WeaponHitPause,
  replayEventBatchId?:string,
  enableTempestuousBeforeSpell=false,
  pauseAfterTempestuousBeforeMovement=false,
  enableTempestuousAfterSpell=false,
  enableStormFuryHit=false,
  spellWindowOriginalClock?:Dnd5eSpellWindowOriginalSessionClock,
  enablePluginTempestuousFlight=false,pluginTempestuousEarlyBefore?:Dnd5ePluginTempestuousEarlyBeforePrelude,pluginTempestuousOriginalReplay?:OriginalD20ReplayFacts,
) {
  if(enablePluginTempestuousFlight&&(enableTempestuousBeforeSpell||enableTempestuousAfterSpell||enableStormFuryHit||spellWindowOriginalClock))throw Error('plugin-tempestuous-session:independent-native-family-required')
if(pluginTempestuousEarlyBefore&&!enablePluginTempestuousFlight)throw Error('plugin-tempestuous-early:explicit-plugin-session-required')
  const pluginTempestuousScope=enablePluginTempestuousFlight?createDnd5ePluginTempestuousSessionScope(input as unknown as Parameters<typeof createDnd5ePluginTempestuousSessionScope>[0],resolve,pluginTempestuousEarlyBefore):undefined
  if(spellWindowOriginalClock&&!enableTempestuousBeforeSpell)throw Error('spell-window-clock:explicit-before-session-required')
  const nativeSpellWindowClock=spellWindowOriginalClock?readDnd5eSpellWindowOriginalSessionClock(spellWindowOriginalClock,input as unknown as Parameters<typeof tempestuousCanonicalSpellResolver>[0],resolve):undefined
  if(nativeSpellWindowClock&&replayEventBatchId!==undefined&&replayEventBatchId!==nativeSpellWindowClock.parentId)throw Error('spell-window-clock:same-original-parent-required')
  if(enableStormFuryHit&&!isActualStormFuryCanonicalResolver(resolve))throw Error('storm-fury-original:canonical-monster-or-spell-required')
  if(enableTempestuousAfterSpell&&(resolve as unknown)!==tempestuousCanonicalSpellResolver)throw Error('tempestuous-after:actual-core-spell-required')
  if(pauseAfterTempestuousBeforeMovement&&!enableTempestuousBeforeSpell)throw Error('tempestuous-before-cast:explicit-owner-session-required')
  const furyMoveClock=enableStormFuryHit&&(resolve as unknown)===furyCanonicalMoveResolver?actualFuryMoveClock(input,replayEventBatchId):undefined
  const wardReplaySession=captureDnd5eSpellWardReplaySession(input,resolve)
  const frozen=cloneDnd5eHostTransactionInput(input)
  if(enableTempestuousBeforeSpell){if(!input.prepared)throw Error('tempestuous-before:actual-prepared-source-required');frozen.prepared=captureDnd5eActualTempestuousPreparedForReplay(input.prepared)}
  if(!frozen.prepared)throw new Error('damage-reaction-prepared-state-required')
  ensureDnd5eCoreSpellActivitiesRegisteredV1()
  const originalD20Context=preparedOriginalD20Replay(frozen)
  if(pluginTempestuousOriginalReplay&&(!pluginTempestuousScope||originalD20Context.binding))throw Error('plugin-tempestuous-original:separate-exact-replay-required')
  const originalD20Replay=validateOriginalD20ReplayFacts(pluginTempestuousOriginalReplay??originalD20Context.binding,originalD20Context.parentId,frozen.prepared.state,originalD20Context.command)
  const catalog=registeredDnd5eActivityCatalogSignature()
   const stormOriginalReplay=readBoundStormCastOriginalReplay(frozen,resolve),scopedStormReplay=scopedStormCastContext(frozen),tempestuousBeforeClock=scopedTempestuousBeforeClock(frozen,resolve)
  return bindActualTempestuousLandingSession(bindActualStormFurySession(bindActualTempestuousAfterCastSession(bindActualTempestuousBeforeCastSession(bindActualStormCastOriginalSession(bindActualDamageZeroOriginalSession(createDamageReplaySession(frozen.prepared.state,state=>{const next=pluginTempestuousScope?preparedPluginTempestuousReplayInput(frozen,state):(dnd5ePluginSpellCompoundAnsweredReplaySessionInput(resolve,frozen,state)??preparedReplayState(frozen,state));return withBountifulEquipmentInputReplay(next,resolve,originalD20Replay?.equipmentD20,()=>pluginTempestuousScope?withDnd5ePluginTempestuousSessionNative(pluginTempestuousScope,next,()=>resolve(next)):wardReplaySession?wardReplaySession.run(next,()=>resolve(next)):resolve(next))},shouldPause,
    ()=>registeredDnd5eActivityCatalogSignature()===catalog&&(!furyMoveClock||furyMoveClock.current())&&(!nativeSpellWindowClock||nativeSpellWindowClock.current()), materials, weaponHitPause,replayEventBatchId??furyMoveClock?.parentId??(originalD20Replay||stormOriginalReplay||scopedStormReplay||enableTempestuousAfterSpell?originalD20Context.parentId:undefined),undefined,originalD20Replay,stormOriginalReplay,scopedStormReplay,enableTempestuousBeforeSpell,pauseAfterTempestuousBeforeMovement,tempestuousBeforeClock,enableTempestuousAfterSpell,enableStormFuryHit,furyMoveClock,undefined,nativeSpellWindowClock,pluginTempestuousScope),frozen,resolve),frozen,resolve),frozen,resolve),frozen,resolve),frozen,resolve,furyMoveClock?.current),frozen,resolve)
}

export interface Dnd5eDamageZeroOriginalRecord {readonly frame:Readonly<DamageZeroSavingThrowFrame>;readonly prefixSignature:string;readonly choice?:DamageZeroSavingThrowChoice}
type DamageZeroOriginalLineage={input:object;resolve:unknown;signature:string;effectTimestamp:number;operations:readonly (Dnd5eDamageZeroOriginalRecord&{readonly origin:object})[]}
const actualDamageZeroOriginalResults=new WeakMap<object,DamageZeroOriginalLineage>()
/** This is native data lineage, never raw-dice, owner or world authority. The
 * exact live Session result and its unchanged content are required. */
/** Absence is not a capability. An existing but changed native result still rejects. */
export function readOptionalDnd5eActualDamageZeroOriginalBoundary(result:object){return actualDamageZeroOriginalResults.has(result)?readDnd5eActualDamageZeroOriginalBoundary(result):undefined}
export function readDnd5eActualDamageZeroOriginalBoundary(result:object){
 const row=actualDamageZeroOriginalResults.get(result)
 if(!row||row.signature!==JSON.stringify(result))throw Error('damage-zero-original:actual-unchanged-native-boundary-required')
 return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,effectTimestamp:row.effectTimestamp,operations:row.operations.map(record=>({frame:structuredClone(record.frame),prefixSignature:record.prefixSignature,...(record.choice?{choice:structuredClone(record.choice)}:{}),origin:record.origin}))}
}
function bindActualDamageZeroOriginalSession<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(session:ReturnType<typeof createDamageReplaySession<Result>>,input:Input,resolve:(input:Input)=>Result){
 const replayValue=Object.getOwnPropertyDescriptor(input,'hostDamageZeroSavingThrows')?.value as unknown
 if(replayValue!==undefined&&(!Array.isArray(replayValue)||replayValue.some(record=>!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).some(key=>key!=='frame'&&key!=='prefixSignature'&&key!=='choice')||!Object.hasOwn(record,'frame')||typeof record.prefixSignature!=='string')))throw Error('damage-zero-original:invalid-operation-data')
 const replay=structuredClone((replayValue??[]) as readonly Dnd5eDamageZeroOriginalRecord[]),operations:Array<Dnd5eDamageZeroOriginalRecord&{origin:object}>=[]
 let pending:Extract<Dnd5eDamageCommitSessionResult<Result>,{status:'pending-damage-zero-saving-throw'}>|undefined
 const brand=(result:Dnd5eDamageCommitSessionResult<Result>)=>{if(result.status!=='rejected'&&(result.status==='pending-damage-zero-saving-throw'||operations.length>0)){actualDamageZeroOriginalResults.set(result,{input,resolve,signature:JSON.stringify(result),effectTimestamp:session.originalEffectTimestamp(),operations:operations.map(record=>({frame:structuredClone(record.frame),prefixSignature:record.prefixSignature,...(record.choice?{choice:structuredClone(record.choice)}:{}),origin:record.origin}))});if(result.status==='original-d20-ready')actualOriginalReadyResults.set(result,{input,resolve,signature:JSON.stringify(result)})}return result}
 const advance=(initial:Dnd5eDamageCommitSessionResult<Result>,current:Dnd5eHeadlessCombatState)=>{
  let result=initial
  while(result.status==='pending-damage-zero-saving-throw'){
   pending=result;brand(result)
   const record=replay[operations.length];if(!record)break
   if(JSON.stringify(record.frame)!==JSON.stringify(result.frame))throw Error('damage-zero-original:exact-native-phase-required')
   if(record.prefixSignature!==JSON.stringify(result.snapshot))throw Error('damage-zero-original:exact-native-prefix-required')
   const origin=result,next=session.resumeDamageZeroSavingThrow(current,result.frame,record.choice)
   if(next.status==='rejected')return next
   operations.push({frame:structuredClone(result.frame),prefixSignature:JSON.stringify(result.snapshot),...(record.choice?{choice:structuredClone(record.choice)}:{}),origin});pending=undefined;result=next
  }
  if(result.status==='resolved'&&operations.length!==replay.length&&replay.length)throw Error('damage-zero-original:unused-operation-data')
  return brand(result)
 }
 const wrapped={...session}
 for(const key of Object.keys(session)){
  const method=Object.getOwnPropertyDescriptor(session,key)?.value as unknown
  if(typeof method!=='function'||key!=='run'&&!key.startsWith('resume'))continue
  Object.defineProperty(wrapped,key,{enumerable:true,configurable:true,writable:true,value:(...args:unknown[])=>{
   const before=pending,result=Reflect.apply(method,session,args) as Dnd5eDamageCommitSessionResult<Result>
   if(key==='resumeDamageZeroSavingThrow'&&result.status!=='rejected'){
    if(!before||JSON.stringify(args[1])!==JSON.stringify(before.frame))throw Error('damage-zero-original:actual-pending-phase-required')
    const choice=args[2] as DamageZeroSavingThrowChoice|undefined
    operations.push({frame:structuredClone(before.frame),prefixSignature:JSON.stringify(before.snapshot),...(choice?{choice:structuredClone(choice)}:{}),origin:before});pending=undefined
   }
   return advance(result,args[0] as Dnd5eHeadlessCombatState)
  }})
 }
 return wrapped
}


export interface Dnd5eStormCastOriginalRecord{readonly frame:Readonly<StormCastEruptionFrame>;readonly prefixSignature:string;readonly choice?:StormCastEruptionChoice}
export interface Dnd5eStormCastOriginalOperation{readonly kind:'storm-cast-original-operation'}
type StormPending=Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-storm-cast'}>
interface StormOriginalRow{input:object;resolve:unknown;pending:StormPending;signature:string;records:Dnd5eStormCastOriginalRecord[];definitions:string}
const actualStormCastOriginalResults=new WeakMap<object,StormOriginalRow>(),actualStormCastOriginalOperations=new WeakMap<object,StormOriginalRow>()
function stormOriginalDefinitions(frame:Readonly<StormCastEruptionFrame>){return JSON.stringify(frame.options.map(option=>[option.featureId,dnd5ePluginFeatureDefinition(option.featureId),dnd5ePluginFeatureCurrentEnvelopeFullV1(option.featureId)]))}
/** Mechanical lineage of an actual original Session occurrence only. This is not
 * owner authorization, raw-die issuance, room qualification or publication. */
export function captureDnd5eStormCastOriginalOperation(result:object):Dnd5eStormCastOriginalOperation{
 const row=actualStormCastOriginalResults.get(result);if(!row||row.signature!==JSON.stringify(result))throw Error('storm-original:actual-unchanged-pending-required')
 const operation:Dnd5eStormCastOriginalOperation=Object.freeze({kind:'storm-cast-original-operation'});actualStormCastOriginalOperations.set(operation,row);return operation
}
export function readDnd5eStormCastOriginalOperation(operation:object){
 const row=actualStormCastOriginalOperations.get(operation);if(!row)throw Error('storm-original:actual-issued-operation-required')
 if(row.signature!==JSON.stringify(row.pending))throw Error('storm-original:actual-pending-facts-changed')
 if(row.definitions!==stormOriginalDefinitions(row.pending.frame)||row.pending.frame.options.some(option=>!dnd5ePluginFeatureDefinition(option.featureId)))throw Error('storm-original:current-source-required')
 return{source:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,frame:structuredClone(row.pending.frame),snapshot:structuredClone(row.pending.snapshot),effectTimestamp:row.pending.effectTimestamp,records:structuredClone(row.records)}
}

interface StormCastScopedContext{effectTimestamp:number;visit(frame:Readonly<StormCastEruptionFrame>,snapshot:Dnd5eHeadlessCombatState,timestamp:number):{choice?:StormCastEruptionChoice}|undefined;records():readonly Dnd5eStormCastOriginalRecord[];attachCancel(cancel:()=>void):void}
interface StormCastNativeScope{operation:Dnd5eStormCastOriginalOperation;facts:ReturnType<typeof readDnd5eStormCastOriginalOperation>;choice?:StormCastEruptionChoice;used:boolean;key:string;sessions:Set<{visited:()=>boolean;cancel:()=>void}>}
let activeStormCastNativeScope:StormCastNativeScope|undefined
const stormScopedSessionRecords=Symbol('actual-storm-session-records')
const stormPreparedGraph=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const stormComparable=(value:unknown):unknown=>Array.isArray(value)?value.map(stormComparable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stormComparable((value as Record<string,unknown>)[key])])):value
const stormSame=(a:unknown,b:unknown)=>JSON.stringify(stormComparable(a))===JSON.stringify(stormComparable(b))
/** A synchronous native frame only. The operation is genuinely issued by the
 * native Session; no caller frame/DC/snapshot is registered. This carries no
 * room, dice or publication permission. */
export function withDnd5eStormCastOriginalReplayScope<T>(operation:Dnd5eStormCastOriginalOperation,choice:StormCastEruptionChoice|undefined,run:()=>T):T{
 const facts=readDnd5eStormCastOriginalOperation(operation)
 if(choice&&(Object.keys(choice).some(key=>!['frameId','featureId','damageType','targetIds'].includes(key))||choice.frameId!==facts.frame.id||!facts.frame.options.some(option=>option.featureId===choice.featureId)||!['lightning','thunder'].includes(choice.damageType)||!Array.isArray(choice.targetIds)||new Set(choice.targetIds).size!==choice.targetIds.length||choice.targetIds.some(id=>!facts.frame.targetIds.includes(id))))throw Error('storm-native-scope:actual-owner-input-required')
 if(run.constructor.name==='AsyncFunction')throw Error('storm-native-scope:sync-only')
 const key=JSON.stringify([facts.frame,facts.snapshot,facts.effectTimestamp,choice]),previous=activeStormCastNativeScope,scope=previous?.key===key?previous:{operation,facts,choice:choice&&structuredClone(choice),used:false,key,sessions:new Set<{visited:()=>boolean;cancel:()=>void}>()};activeStormCastNativeScope=scope
 try{const result=run();if(result&&typeof result==='object'&&'then'in result&&typeof result.then==='function')throw Error('storm-native-scope:sync-only');if(scope!==previous&&!scope.used)throw Error('storm-native-scope:actual-prefix-not-reached');if(scope!==previous)for(const row of scope.sessions)if(!row.visited())row.cancel();return result}catch(error){for(const row of scope.sessions)row.cancel();throw error}finally{activeStormCastNativeScope=previous}
}
function scopedStormCastContext(input:object):StormCastScopedContext|undefined{
 const scope=activeStormCastNativeScope;if(!scope)return
 const source=scope.facts.source as Record<string,unknown>,candidate=input as Record<string,unknown>
 if(!candidate.prepared||stormPreparedGraph(candidate.prepared)!==stormPreparedGraph(source.prepared))return
 for(const[key,value]of Object.entries(source))if(!['prepared','effectRolls','hostOriginalD20Replay'].includes(key)&&!stormSame(candidate[key],value))return
 if(Array.isArray(source.effectRolls)&&source.effectRolls.length&&!stormSame(candidate.effectRolls,source.effectRolls))return
 const clock=(candidate.hostOriginalD20Replay as{effectTimestamp?:number}|undefined)?.effectTimestamp;if(clock!==undefined&&clock!==scope.facts.effectTimestamp)return
 const seen=new Map<string,Dnd5eStormCastOriginalRecord>();let cancel:(()=>void)|undefined;scope.sessions.add({visited:()=>seen.size>0,cancel:()=>cancel?.()})
 return{effectTimestamp:scope.facts.effectTimestamp,visit(frame,snapshot,timestamp){
  readDnd5eStormCastOriginalOperation(scope.operation)
  if(frame.id!==scope.facts.frame.id)return
  if(JSON.stringify(frame)!==JSON.stringify(scope.facts.frame)||JSON.stringify(snapshot)!==JSON.stringify(scope.facts.snapshot)||timestamp!==scope.facts.effectTimestamp)throw Error('storm-native-scope:changed-actual-prefix')
  scope.used=true;seen.set(frame.id,{frame:structuredClone(frame),prefixSignature:JSON.stringify(snapshot),...(scope.choice?{choice:structuredClone(scope.choice)}:{})});return{choice:scope.choice&&structuredClone(scope.choice)}
 },records:()=>structuredClone([...seen.values()]),attachCancel:fn=>{cancel=fn}}
}
interface StormCastOriginalReplay{effectTimestamp:number;records:readonly Dnd5eStormCastOriginalRecord[]}
const stormCastReplaySlot=Symbol('storm-cast-native-replay'),stormCastReplayRows=new WeakMap<object,{original:object;operation:Dnd5eStormCastOriginalOperation;sourceSignature:string;resolve:unknown;replay:StormCastOriginalReplay}>();registerDnd5eHostReceiptSlot(stormCastReplaySlot)
// These are native resolver roll inputs only. This is not a raw/consent issuer;
// authenticated physical metadata and actual room parent validation remain required.
const stormNativeRollKeys=new Set(['targetSavingThrows','savingThrowD20','savingThrowD20Second','savingThrowHalflingLuckyD20','savingThrowHalflingLuckyD20Second','savingThrowBlessRoll','savingThrowBaneRoll','d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll'])
function stormOriginalSourceSignature(input:object){return JSON.stringify(Object.fromEntries(Object.entries(input).filter(([key])=>!stormNativeRollKeys.has(key))))}
/** Rebind only real original input/effect pool plus allowed later native roll
 * fields to the accepted prefix. A JSON clone loses this private receipt. */
export function bindDnd5eStormCastOriginalReplayInput<T extends object>(operation:Dnd5eStormCastOriginalOperation,input:T):T{
 const facts=readDnd5eStormCastOriginalOperation(operation);if(!facts.records.length)throw Error('storm-original:actual-prefix-decision-required')
 const expected=stormOriginalSourceSignature(facts.source);if(stormOriginalSourceSignature(input)!==expected)throw Error('storm-original:matching-native-source-required')
 const receipt=registerDnd5eHostReceipt(Object.freeze({kind:'storm-cast-native-replay'}));stormCastReplayRows.set(receipt,{original:facts.source,operation,sourceSignature:expected,resolve:facts.resolve,replay:{effectTimestamp:facts.effectTimestamp,records:structuredClone(facts.records)}})
 const copied=cloneDnd5eHostTransactionInput(input),bound=Object.create(Object.getPrototypeOf(copied)) as T;for(const key of Reflect.ownKeys(copied))if(key!==stormCastReplaySlot)Object.defineProperty(bound,key,Object.getOwnPropertyDescriptor(copied,key)!);Object.defineProperty(bound,stormCastReplaySlot,{value:receipt,enumerable:false,configurable:false,writable:false});return bound
}
function readBoundStormCastOriginalReplay(input:object,resolve:unknown,depth=0):StormCastOriginalReplay|undefined{
 if(depth>128)throw Error('storm-original:prefix-depth-limit')
 const descriptor=Object.getOwnPropertyDescriptor(input,stormCastReplaySlot);if(!descriptor)return
 const row=descriptor&&'value'in descriptor?stormCastReplayRows.get(descriptor.value):undefined;if(!row||row.resolve!==resolve||row.sourceSignature!==stormOriginalSourceSignature(input))throw Error('storm-original:actual-bound-replay-required')
 readDnd5eStormCastOriginalOperation(row.operation);if(Object.hasOwn(row.original,stormCastReplaySlot))readBoundStormCastOriginalReplay(row.original,resolve,depth+1)
 if(!row.replay.records.length||row.replay.records.length>128||new Set(row.replay.records.map(record=>record.frame.id)).size!==row.replay.records.length)throw Error('storm-original:actual-prefix-records-required')
 return structuredClone(row.replay)
}

function bindActualStormCastOriginalSession<S extends{run:(state:Dnd5eHeadlessCombatState)=>Dnd5eDamageCommitSessionResult<unknown>}>(session:S,input:object,resolve:unknown):S{
 const frozen=cloneDnd5eHostTransactionInput(input),records:Dnd5eStormCastOriginalRecord[]=structuredClone([...(readBoundStormCastOriginalReplay(frozen,resolve)?.records??[])]);let pending:StormPending|undefined;const wrapped={...session}
 for(const key of Object.keys(session)){
  const method=Object.getOwnPropertyDescriptor(session,key)?.value as unknown;if(typeof method!=='function'||key!=='run'&&!key.startsWith('resume'))continue
  Object.defineProperty(wrapped,key,{enumerable:true,configurable:true,writable:true,value:(...args:unknown[])=>{
   const before=pending,result=Reflect.apply(method,session,args) as Dnd5eDamageCommitSessionResult<unknown>
    const scoped=(session as unknown as Record<symbol,unknown>)[stormScopedSessionRecords];if(typeof scoped==='function')for(const record of(scoped as()=>readonly Dnd5eStormCastOriginalRecord[])()){const prior=records.find(row=>row.frame.id===record.frame.id);if(prior){if(JSON.stringify(prior)!==JSON.stringify(record))throw Error('storm-native-scope:changed-recorded-prefix')}else records.push(structuredClone(record))}
   if(key==='resumeStormCast'&&result.status!=='rejected'){
    if(!before||JSON.stringify(args[1])!==JSON.stringify(before.frame))throw Error('storm-original:actual-pending-phase-required')
    const choice=args[2] as StormCastEruptionChoice|undefined;records.push({frame:structuredClone(before.frame),prefixSignature:JSON.stringify(before.snapshot),...(choice?{choice:structuredClone(choice)}:{})});pending=undefined
   }
   if(result.status==='pending-storm-cast'){
    if(!Number.isSafeInteger(result.effectTimestamp)||result.effectTimestamp<=0)throw Error('storm-original:actual-parent-clock-required')
    pending=result;actualStormCastOriginalResults.set(result,{input:frozen,resolve,pending:result,signature:JSON.stringify(result),records,definitions:stormOriginalDefinitions(result.frame)})
   }
   return result
  }})
 }
 return wrapped
}

type ActualOriginalReady=Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'original-d20-ready'}>
const actualOriginalReadyResults=new WeakMap<object,{input:object;resolve:unknown;signature:string}>()
const actualOriginalAllyResults=new WeakMap<object,{input:object;resolve:unknown;error:unknown;signature:string;fullSignature?:string;effectTimestamp:number}>()
const actualAllyGraphSignature=(value:unknown)=>{try{return JSON.stringify(encodeSecondChanceParentWire(value))}catch{return undefined}}
/** Read-only actual Native original lineage; JSON and copied stages cannot register. */
export function readDnd5eActualOriginalAllyBoundary(result:object){const row=actualOriginalAllyResults.get(result);if(!row||!row.fullSignature||row.signature!==JSON.stringify(result)||row.fullSignature!==actualAllyGraphSignature(result))throw Error('original-d20:actual-unchanged-ally-boundary-required');const pending=result as Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-ally-natural-one'}>;return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,error:row.error,effectTimestamp:row.effectTimestamp,request:structuredClone(pending.request),snapshot:structuredClone(pending.snapshot)}}
/** Read-only same-object Native provenance; no caller may register a result. */
export function actualDnd5eOriginalAllyBoundaryMatches(result:object,resolve:unknown,error:unknown){const row=actualOriginalAllyResults.get(result);return!!row&&row.resolve===resolve&&row.error===error&&row.signature===JSON.stringify(result)}
/** Data lineage of a genuine original-session run only. This issues no die,
 * owner consent, native outcome, resource, or publication permission. */
export function readDnd5eActualOriginalReadyBoundary(result:object){
 const row=actualOriginalReadyResults.get(result)
 if(!row||JSON.stringify(result)!==row.signature)throw Error('original-d20:actual-unchanged-ready-boundary-required')
 const ready=result as ActualOriginalReady
 return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,request:structuredClone(ready.request),snapshot:structuredClone(ready.snapshot),events:structuredClone(ready.events)}
}
/** Mechanical whole-operation collection. No successful original D20 ends this
 * observation session; genuine Native missing inputs and actual reactions still
 * pause through the same replay worker and provenance machinery. It grants no
 * physical owner, source family, qualification or publication permission. */
/** Fixed Native observation with a genuine live Tempestuous-before prelude.
 * Replay data is mechanical only and is validated against that same original;
 * no Source callback, Room permission, raw die or result is accepted here. */
export function createDnd5ePluginTempestuousOriginalD20Session<Input extends{prepared?:{state:Dnd5eHeadlessCombatState}},Result>(input:Input,resolve:(input:Input)=>Result,before:Dnd5ePluginTempestuousEarlyBeforePrelude,pauseActorId?:string,replay?:OriginalD20ReplayFacts){
 return createDnd5eOriginalD20SessionForPause(input,resolve,request=>pauseActorId!==undefined&&request.actorId===pauseActorId&&request.kind==='saving-throw',before,replay)
}
export function createDnd5eAllyOriginalCollectionSession<Input extends{prepared?:{state:Dnd5eHeadlessCombatState}},Result>(input:Input,resolve:(input:Input)=>Result){return createDnd5eOriginalD20SessionForPause(input,resolve,()=>false)}
export function createDnd5eOriginalD20Session<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(input:Input,resolve:(input:Input)=>Result,actorId:string,kind:OriginalD20Ready['kind']){
 return createDnd5eOriginalD20SessionForPause(input,resolve,request=>request.actorId===actorId&&request.kind===kind)
}
/** Mechanical next-operation observation only. The actual native request supplies
 * its actor/kind; this never issues physical raw or any family qualification. */
interface ActualMissingSpellcastingOriginalLineage{input:object;resolve:unknown;signature:string;effectTimestamp:number;stormOperation?:Dnd5eStormCastOriginalOperation}
const actualMissingSpellcastingOriginalResults=new WeakMap<object,ActualMissingSpellcastingOriginalLineage>()
/** Mechanical provenance only. This never registers a caller frame, raw or book. */
export function readDnd5eActualMissingSpellcastingOriginalBoundary(result:object){
 const row=actualMissingSpellcastingOriginalResults.get(result)
 if(!row||row.signature!==JSON.stringify(result))throw Error('spellcasting-original:actual-unchanged-missing-boundary-required')
 return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,effectTimestamp:row.effectTimestamp,...(row.stormOperation?{stormOperation:row.stormOperation}:{})}
}
export function createDnd5eNextOriginalD20Session<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(input:Input,resolve:(input:Input)=>Result){
 const frozen=cloneDnd5eHostTransactionInput(input),session=createDnd5eOriginalD20SessionForPause(frozen,resolve,()=>true)
 let stormOperation:Dnd5eStormCastOriginalOperation|undefined
 const record=(result:ReturnType<typeof session.run>|import('./missingSpellcastingOriginal').MissingSpellcastingOriginal)=>{
  if(result.status==='pending-storm-cast')stormOperation=captureDnd5eStormCastOriginalOperation(result)
  if(result.status==='missing-spellcasting-original')actualMissingSpellcastingOriginalResults.set(result,{input:frozen,resolve,signature:JSON.stringify(result),effectTimestamp:session.originalEffectTimestamp(),...(stormOperation?{stormOperation}:{})})
  return result
 }
 return{...session,run:(...args:Parameters<typeof session.run>)=>record(observeMissingSpellcastingOriginal(()=>session.run(...args))),resumeStormCast:(...args:Parameters<typeof session.resumeStormCast>)=>record(observeMissingSpellcastingOriginal(()=>session.resumeStormCast(...args)))}

}
function createDnd5eOriginalD20SessionForPause<Input extends {prepared?:{state:Dnd5eHeadlessCombatState}},Result>(input:Input,resolve:(input:Input)=>Result,pause:(request:OriginalD20Ready)=>boolean,pluginBefore?:Dnd5ePluginTempestuousEarlyBeforePrelude,pluginReplay?:OriginalD20ReplayFacts){
  const pluginScope=pluginBefore?createDnd5ePluginTempestuousSessionScope(input as unknown as Parameters<typeof createDnd5ePluginTempestuousSessionScope>[0],resolve,pluginBefore):undefined
 try{
 const sequenceOriginalClock=readBountifulOpportunitySequenceOriginalClock(input,resolve),frozen=cloneDnd5eHostTransactionInput(input)
  if(!frozen.prepared)throw Error('original-d20-prepared-state-required')
  const context=preparedOriginalD20Replay(frozen)
  if(pluginReplay&&(!pluginScope||context.binding))throw Error('plugin-tempestuous-original:separate-exact-replay-required')
  const replay=validateOriginalD20ReplayFacts(pluginReplay??context.binding,context.parentId,frozen.prepared.state,context.command)
   const stormOriginalReplay=readBoundStormCastOriginalReplay(frozen,resolve),scopedStormReplay=scopedStormCastContext(frozen),tempestuousBeforeClock=scopedTempestuousBeforeClock(frozen,resolve)
  const session=createDamageReplaySession(frozen.prepared.state,state=>withOriginalD20ParentProbe(()=>{const next=pluginScope?preparedPluginTempestuousReplayInput(frozen,state):(dnd5ePluginSpellCompoundAnsweredReplaySessionInput(resolve,frozen,state)??preparedReplayState(frozen,state));return pluginScope?withDnd5ePluginTempestuousSessionNative(pluginScope,next,()=>resolve(next)):resolve(next)}),()=>false,()=>!sequenceOriginalClock||sequenceOriginalClock.current(),undefined,undefined,context.parentId,request=>pause(request)&&dnd5eOriginalD20PauseTargetActive(request),replay,stormOriginalReplay,scopedStormReplay,false,false,tempestuousBeforeClock,false,false,undefined,sequenceOriginalClock,undefined,pluginScope)
  const brand=(result:ReturnType<typeof session.run>)=>{if(result.status==='pending-ally-natural-one')actualOriginalAllyResults.set(result,{input:frozen,resolve,error:session.originalAllyNaturalOneError(),signature:JSON.stringify(result),fullSignature:actualAllyGraphSignature(result),effectTimestamp:session.originalEffectTimestamp()});if(result.status==='original-d20-ready')actualOriginalReadyResults.set(result,{input:frozen,resolve,signature:JSON.stringify(result)});return result};return bindActualStormCastOriginalSession(bindActualDamageZeroOriginalSession({...session,run(current:Dnd5eHeadlessCombatState){return brand(session.run(current))},resumeAllyNaturalOne(...args:Parameters<typeof session.resumeAllyNaturalOne>){return brand(session.resumeAllyNaturalOne(...args))}},frozen,resolve),frozen,resolve)

 }catch(error){if(pluginScope)cancelDnd5ePluginTempestuousSession(pluginScope);throw error}
}

function createDamageReplaySession<Result>(
  source: Dnd5eHeadlessCombatState,
  resolve: (state: Dnd5eHeadlessCombatState) => Result,
  shouldPause: DamagePause,
  definitionUnchanged: () => boolean = () => true,
  materials?: Dnd5eDamageReplayMaterials<Result>,
  weaponHitPause?: WeaponHitPause,
  replayEventBatchId?:string,
  originalD20Pause?:(request:OriginalD20Ready)=>boolean,
  originalD20Replay?:OriginalD20ReplayFacts,
   stormOriginalReplay?:StormCastOriginalReplay,
   scopedStormReplay?:StormCastScopedContext,
   enableTempestuousBeforeSpell=false,
   pauseAfterTempestuousBeforeMovement=false,
 tempestuousBeforeClock?:TempestuousBeforeClockContext,
 enableTempestuousAfterSpell=false,
 enableStormFuryHit=false,
 furyMoveClock?:FuryMoveClock,
  sequenceOriginalClock?:{parentId:string;effectTimestamp:number;current:()=>boolean},
   nativeSpellWindowClock?:{parentId:string;effectTimestamp:number;current:()=>boolean},
   pluginTempestuousScope?:Dnd5ePluginTempestuousSessionScope,
) {
  const pluginTempestuousClock=pluginTempestuousScope?readDnd5ePluginTempestuousSessionScope(pluginTempestuousScope):undefined
  const baseline = structuredClone(source)
  const signature = JSON.stringify(baseline)
  if(originalD20Replay?.effectTimestamp!=null&&stormOriginalReplay&&originalD20Replay.effectTimestamp!==stormOriginalReplay.effectTimestamp)throw Error('storm-original:parent-clock-mismatch')
   if(scopedStormReplay&&[originalD20Replay?.effectTimestamp,stormOriginalReplay?.effectTimestamp].some(value=>value!==undefined&&value!==scopedStormReplay.effectTimestamp))throw Error('storm-native-scope:parent-clock-mismatch')
   if(tempestuousBeforeClock&&[originalD20Replay?.effectTimestamp,stormOriginalReplay?.effectTimestamp,scopedStormReplay?.effectTimestamp].some(value=>value!==undefined&&value!==tempestuousBeforeClock.effectTimestamp))throw Error('tempestuous-native-clock:parent-clock-mismatch')
    if(furyMoveClock&&[originalD20Replay?.effectTimestamp,stormOriginalReplay?.effectTimestamp,scopedStormReplay?.effectTimestamp,tempestuousBeforeClock?.effectTimestamp].some(value=>value!==undefined&&value!==furyMoveClock.effectTimestamp))throw Error('storm-fury-move:parent-clock-mismatch')
    if(sequenceOriginalClock&&[originalD20Replay?.effectTimestamp,stormOriginalReplay?.effectTimestamp,scopedStormReplay?.effectTimestamp,tempestuousBeforeClock?.effectTimestamp,furyMoveClock?.effectTimestamp].some(value=>value!==undefined&&value!==sequenceOriginalClock.effectTimestamp))throw Error('opportunity-original-clock:parent-clock-mismatch')
           if(nativeSpellWindowClock&&[originalD20Replay?.effectTimestamp,stormOriginalReplay?.effectTimestamp,scopedStormReplay?.effectTimestamp,tempestuousBeforeClock?.effectTimestamp,furyMoveClock?.effectTimestamp,sequenceOriginalClock?.effectTimestamp].some(value=>value!==undefined&&value!==nativeSpellWindowClock.effectTimestamp))throw Error('spell-window-clock:parent-clock-mismatch')
if(pluginTempestuousClock&&[originalD20Replay?.effectTimestamp,stormOriginalReplay?.effectTimestamp,scopedStormReplay?.effectTimestamp,tempestuousBeforeClock?.effectTimestamp,furyMoveClock?.effectTimestamp,sequenceOriginalClock?.effectTimestamp,nativeSpellWindowClock?.effectTimestamp].some(value=>value!==undefined&&value!==pluginTempestuousClock.effectTimestamp))throw Error('plugin-tempestuous-session:same-original-clock-required')
const effectTimestamp=pluginTempestuousClock?.effectTimestamp??originalD20Replay?.effectTimestamp??stormOriginalReplay?.effectTimestamp??scopedStormReplay?.effectTimestamp??tempestuousBeforeClock?.effectTimestamp??furyMoveClock?.effectTimestamp??sequenceOriginalClock?.effectTimestamp??nativeSpellWindowClock?.effectTimestamp??Date.now()
  const effectClock=createDnd5eParentEffectClock({parentId:pluginTempestuousClock?.parentId??originalD20Replay?.parentId??replayEventBatchId??tempestuousBeforeClock?.parentId??sequenceOriginalClock?.parentId??nativeSpellWindowClock?.parentId??'native-session',sourceKey:originalD20Replay?.sourceKey??signature,timestamp:effectTimestamp})
  const criticalFeatureIds = [...new Set(Object.values(baseline.combatants).flatMap(actor=>actor.pluginFeatureIds))]
  const criticalDefinitions = () => JSON.stringify(criticalFeatureIds.map(id=>[id,dnd5ePluginFeatureDefinition(id)?.declarativeAbility]))
  const criticalDefinitionSignature = criticalDefinitions()
  const criticalDecisions = new Map<number,{event:Dnd5eCriticalHitEvent;selection?:Dnd5eCriticalCancellationSelection}>()
  let pendingMultipartSave:PendingMultipartSave|undefined
  const multipartSaveChoices=new Map<number,{request:MultipartSaveRequest;accepted:boolean}>()
  let pendingAfterOriginalFall:PendingAfterOriginalFall|undefined
  const afterOriginalFallChoices=new Map<number,{request:Dnd5eAfterOriginalFallRequest;snapshotSignature:string;choice:Dnd5eAfterOriginalFallChoice}>((originalD20Replay?.afterOriginalFalls??[]).map(row=>[row.occurrence,structuredClone(row)]))
  let pendingAllyNaturalOne:PendingAllyNaturalOne|undefined
  const allyNaturalOneDecisions=new Map<number,{request:AllyNaturalOneRequest;decision?:AllyNaturalOneDecision}>()
  let pendingAutomaticHit:PendingAutomaticHit|undefined
  const automaticHitDecisions=new Map<number,{request:Dnd5eAutomaticHitRetaliationRequest;rolls:Dnd5eAutomaticHitRetaliationRolls}>()
  let pendingRelentless:PendingRelentless|undefined
  const relentlessChoices=new Map<number,{request:Dnd5eRelentlessReactionRequest;choice:Dnd5eRelentlessReactionChoice}>()
  let pendingCritical:PendingCritical|undefined
  let pendingNegation:PendingIncomingHitNegation|undefined
  const negationDecisions=new Map<number,{facts:string;choice?:IncomingHitNegationChoice}>()
  let pendingFeatureUse:PendingPostD20FeatureUse|undefined
  const reactionSourceDefinitions=new Map<string,string>()
  const rememberReactionSource=(id:string)=>reactionSourceDefinitions.set(id,JSON.stringify({feature:dnd5ePluginFeatureDefinition(id),full:dnd5ePluginFeatureCurrentEnvelopeFullV1(id)}))
  let pendingFailedSave:PendingFailedSavingThrow|undefined
  const failedSaveDecisions=new Map<number,{facts:string;choice?:FailedSavingThrowChoice}>()
  const featureUseDecisions=new Map<number,{request:string;choice?:PostD20FeatureUseChoice}>()
  const featureUseDefinitions=new Map<string,{packageId:string;activityId:string;signature:string}>()
  let pendingIncomingAc:PendingIncomingAttackArmorClass|undefined
  const incomingAcDecisions=new Map<number,{facts:string;choice?:IncomingAttackArmorClassChoice}>()
  let pendingDamageZeroSave:PendingDamageZeroSave|undefined
  const damageZeroSaveChoices=new Map<string,{frame:string;snapshot:string;choice?:DamageZeroSavingThrowChoice}>(),damageZeroSaveResources=new Map<string,string>()
  let pendingSpellSelectedAbility:PendingSpellSelectedAbility|undefined
  const selectedAbilityChoices=new Map<string,{frame:string;snapshot:string;choice?:SpellDamageSelectedAbilityBonusChoice}>()
  let pendingSpellHealing:PendingSpellHealing|undefined,pendingFailedBonusDamage:PendingFailedBonusDamage|undefined,pendingFailedBonusDefense:PendingFailedBonusDefense|undefined
  const healingChoices=new Map<string,{frame:string;snapshot:string;choice?:SpellHealingRerollChoice}>(),failedBonusDamage=new Map<string,{request:string;values:readonly number[]}>(),failedBonusDefense=new Map<string,{request:string;snapshot:string;choice:FailedD20BonusDefenseChoice}>()
  let pendingFailedBonus:PendingFailedD20Bonus|undefined
  const failedBonusChoices=new Map<string,{frame:string;snapshot:string;choice?:FailedD20BonusChoice}>(),failedBonusResources=new Map<string,string>()
  let pendingFuryOwner:PendingStormFuryOwner|undefined,pendingFurySaving:PendingStormFurySaving|undefined,pendingFuryPush:PendingStormFuryPush|undefined
  const furyOwners=new Map<number,{frame:string;snapshot:string;choice?:FuryOwnerChoice}>(),furySaves=new Map<number,{request:string;snapshot:string;roll:StormFurySavingThrow}>(),furyPushes=new Map<number,{request:string;snapshot:string;movement?:Dnd5eSpellForcedMovement}>()
  let pendingTempestuousLanding:PendingTempestuousLanding|undefined
  const tempestuousLandingRolls=new Map<string,{frame:string;snapshot:string;values:number[]}>()
  let pendingTempestuousAfterSpell:PendingTempestuousAfterSpell|undefined
  const tempestuousAfterChoices=new Map<string,{frame:string;snapshot:string;choice?:TempestuousCastFlightChoice}>()
  let pendingTempestuousBeforeSpell:PendingTempestuousBeforeSpell|undefined
  const tempestuousBeforeChoices=new Map<string,{frame:string;snapshot:string;choice?:TempestuousBeforeSpellOfferChoice}>()
  let pendingStormCast:PendingStormCast|undefined
  const stormCastChoices=new Map<string,{frame:string;snapshot:string;choice?:StormCastEruptionChoice}>((stormOriginalReplay?.records??[]).map(record=>[record.frame.id,{frame:JSON.stringify(record.frame),snapshot:record.prefixSignature,choice:record.choice&&structuredClone(record.choice)}] as const))
   const stormOriginalUsed=new Set<string>()
  let pendingMaster:PendingMasterDuelist|undefined,pendingMasterDamage:PendingMasterDamage|undefined,pendingMasterDefense:PendingMasterDefense|undefined
  const masterChoices=new Map<string,{frame:string;snapshot:string;choice?:MasterDuelistChoice}>(),masterDamage=new Map<string,{request:string;values:readonly number[]}>(),masterDefense=new Map<string,{request:string;snapshot:string;choice:MasterDuelistDefenseChoice}>(),masterResources=new Map<string,string>()
  let pendingIncomingAttack:PendingIncomingAttack|undefined
  let pendingIncomingCriticalDice:IncomingCriticalDiceRequest|undefined
  const incomingCriticalDice=new Map<string,readonly number[]>()
  const incomingAttackDecisions=new Map<number,{facts:string;choice?:IncomingAttackRerollChoice}>()
  let pendingZero:PendingZero|undefined
  let pendingZeroStart:string|undefined
  const zeroDecisions = new Map<number,{checkpoint:string;featureId?:string}>()
  const zeroStarts = new Map<string,Extract<Dnd5eAction,{type:'begin-turn'}>>()
  const weaponDecisions = new Map<number, { event: Dnd5eWeaponHitEvent; decision?: Dnd5eWeaponHitDecision }>()
  let pendingWeaponHit: PendingWeaponHit | undefined
  let pendingHitPush:PendingHitPush|undefined
  let pendingHitFollow:PendingHitFollow|undefined
  const followChoices=new Map<number,{request:Dnd5eHitFollowRequest;choice:Dnd5eHitFollowChoice}>()
  const pushReceipts=new Map<number,{event:Dnd5eHitPushEvent;receipts:Dnd5eHitPushReceipts}>()
  const materialBaseline = materials ? structuredClone(materials.charactersByCombatantId) : undefined
  const eventBatchId = replayEventBatchId ?? `damage-session:${globalThis.crypto.randomUUID()}`
  const declined = new Set<number>()
  const accepted = new Map<number, { selection: Dnd5eDamageReactionSelection; definitionSignature: string; checkpoint: Dnd5eDamageCommitCheckpoint }>()
  let pending: Dnd5eDamageCommitCheckpoint | undefined
  let pendingSnapshot: Dnd5eHeadlessCombatState | undefined
  let pendingCharacters: MaterialCharacters | undefined
  let ended = false
  const run = (current: Dnd5eHeadlessCombatState): Dnd5eDamageCommitSessionResult<Result> => {
     stormOriginalUsed.clear()
    if (ended) return { status: 'rejected', reason: 'session-ended' }
    for(const[id,sourceSignature]of reactionSourceDefinitions)if(JSON.stringify({feature:dnd5ePluginFeatureDefinition(id),full:dnd5ePluginFeatureCurrentEnvelopeFullV1(id)})!==sourceSignature){ended=true;return{status:'rejected',reason:'changed-activity'}}
    for(const row of featureUseDefinitions.values())if(JSON.stringify(getRegisteredDnd5eActivity(row.packageId,row.activityId))!==row.signature){ended=true;return{status:'rejected',reason:'changed-activity'}}
    for(const[id,signature]of damageZeroSaveResources)if(JSON.stringify(dnd5ePluginResourceDefinition(id))!==signature){ended=true;return{status:'rejected',reason:'changed-activity'}}
    for(const[id,signature]of failedBonusResources)if(JSON.stringify(dnd5ePluginResourceDefinition(id))!==signature){ended=true;return{status:'rejected',reason:'changed-activity'}}
    for(const[id,signature]of masterResources)if(JSON.stringify(dnd5ePluginResourceDefinition(id))!==signature){ended=true;return{status:'rejected',reason:'changed-activity'}}
    if (!definitionUnchanged()) { ended = true; return {status:'rejected',reason:'changed-activity'} }
    if (criticalDefinitions() !== criticalDefinitionSignature) { ended=true;return {status:'rejected',reason:'changed-activity'} }
    if (JSON.stringify(current) !== signature) {
      ended = true
      return { status: 'rejected', reason: 'stale-state' }
    }
    let failedSaveOccurrence=0,negationOccurrence=0,incomingOccurrence=0,incomingAcOccurrence=0,featureUseOccurrence=0
    const ledger = materialBaseline ? createDnd5eDamageReactionMaterialLedger(materialBaseline) : undefined
    try {
      let multipartSaveOccurrence=0,weaponOccurrence = 0,pushOccurrence=0,followOccurrence=0,criticalOccurrence=0,relentlessOccurrence=0,automaticHitOccurrence=0
      let afterOriginalFallOccurrence=0,originalReadyOrdinal=0
      const usedDeferredD20=new Set<string>()
      let allyNaturalOneOccurrence=0
      const resolveOriginalBeforeFailedSave=()=>withPostD20FeatureUseCheckpoints((request,snapshot)=>{
        rememberReactionSource(request.event.featureId)
        const occurrence=featureUseOccurrence++,prior=featureUseDecisions.get(occurrence)
        for(const window of request.windows)for(const entry of window.available)featureUseDefinitions.set(entry.packageId+':'+entry.activity.id,{packageId:entry.packageId,activityId:entry.activity.id,signature:JSON.stringify(getRegisteredDnd5eActivity(entry.packageId,entry.activity.id))})
        if(prior){if(prior.request!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingPostD20FeatureUse(request,snapshot,occurrence)
      },()=>withIncomingAttackArmorClassCheckpoints((facts,snapshot)=>{
        const acOptions=dnd5eIncomingAttackArmorClassOptions(snapshot,facts.event)
        if(!acOptions.length)return
        for(const option of acOptions)rememberReactionSource(option.featureId)
        const occurrence=incomingAcOccurrence++,prior=incomingAcDecisions.get(occurrence)
        if(prior){if(prior.facts!==JSON.stringify(facts))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingIncomingAttackArmorClass(facts,snapshot,occurrence)
      },()=>withAllyNaturalOneCheckpoints((request,snapshot)=>{
        const occurrence=allyNaturalOneOccurrence++,prior=allyNaturalOneDecisions.get(occurrence)
        if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');return structuredClone(prior.decision)}
        const saved=originalD20Replay?.facts.find(row=>row.occurrence===occurrence)
        if(saved){if(JSON.stringify(saved.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');allyNaturalOneDecisions.set(occurrence,structuredClone(saved));return structuredClone(saved.decision)}
        throw new PendingAllyNaturalOne(request,snapshot,occurrence)
      },()=>withIncomingAttackRerollCheckpoints((facts,snapshot)=>{
        if(!dnd5eIncomingAttackRerollOptions(snapshot,facts.event).length)return
        const occurrence=incomingOccurrence++,prior=incomingAttackDecisions.get(occurrence)
        if(prior){if(prior.facts!==JSON.stringify(facts))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingIncomingAttack(facts,snapshot,occurrence)
      },()=>withDnd5eAutomaticHitRetaliationCheckpoints((request,snapshot)=>{
        const occurrence=automaticHitOccurrence++,prior=automaticHitDecisions.get(occurrence)
        if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');return structuredClone(prior.rolls)}
        throw new PendingAutomaticHit(request,snapshot,occurrence)
      },()=>withDnd5eRelentlessReactionCheckpoints((request,snapshot)=>{
        const occurrence=relentlessOccurrence++,prior=relentlessChoices.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction')
          return {...structuredClone(prior.choice),occurrence}
        }
        throw new PendingRelentless(request,snapshot,occurrence)
      },()=>withDnd5eZeroHitPointCheckpoints((checkpoint,snapshot)=>{
        if (!dnd5eZeroHitPointTurnOptions(snapshot,checkpoint).length) return
        const prior=zeroDecisions.get(checkpoint.occurrence)
        if (!prior) throw new PendingZero(checkpoint,snapshot)
        if(prior.checkpoint!==JSON.stringify(checkpoint))throw new RejectedReaction('changed-reaction')
        return prior.featureId ? {featureId:prior.featureId,transactionId:eventBatchId} : undefined
      },()=>withDnd5eCriticalCancellationCheckpoints((event,snapshot)=>{
        const occurrence=criticalOccurrence++,prior=criticalDecisions.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.event)!==JSON.stringify(event))throw new RejectedReaction('changed-reaction')
          return prior.selection&&structuredClone(prior.selection)
        }
        if(dnd5eCriticalCancellationOptions(snapshot,event).length)throw new PendingCritical(event,snapshot,occurrence)
      },()=>withDnd5eHitFollowCheckpoints((request,snapshot)=>{
        const occurrence=followOccurrence++,prior=followChoices.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction')
          return structuredClone(prior.choice)
        }
        throw new PendingHitFollow(request,snapshot,occurrence)
      },()=>withDnd5eHitPushCheckpoints((event,snapshot)=>{
        const occurrence=pushOccurrence++,prior=pushReceipts.get(occurrence)
        if(prior){
          if(JSON.stringify(prior.event)!==JSON.stringify(event))throw new RejectedReaction('changed-reaction')
          return structuredClone(prior.receipts)
        }
        throw new PendingHitPush(event,snapshot,occurrence)
      },()=>withDnd5eWeaponHitCheckpoints((event, snapshot) => {
        const occurrence = weaponOccurrence++, prior = weaponDecisions.get(occurrence)
        if (prior) {
          if (JSON.stringify(prior.event) !== JSON.stringify(event)) throw new RejectedReaction('changed-reaction')
          return prior.decision && structuredClone(prior.decision)
        }
        if (weaponHitPause?.(structuredClone(event), copyDnd5eOrdinaryWeaponScene(snapshot,structuredClone(snapshot)))) throw new PendingWeaponHit(event, snapshot, occurrence)
      }, () => withDnd5eDamageCommitCheckpoints((checkpoint, snapshot) => {
        const decision = accepted.get(checkpoint.occurrence)
        if (decision) {
          if (!snapshot || JSON.stringify(checkpoint) !== JSON.stringify(decision.checkpoint)) throw new RejectedReaction('changed-reaction')
          const resolution = resolveDnd5eDamageCheckpointReaction({
            state:snapshot, checkpoint, selection:decision.selection, eventBatchId,
            expectedDefinitionSignature:decision.definitionSignature,
            materialLedger: ledger,
          })
          if (!resolution.ok) throw new RejectedReaction(resolution.reason)
          return resolution.reaction
        }
        // Retain a separate copy: the discovery callback is allowed to inspect
        // or mutate its copy, never the authority used for a later selection.
        const authoritySnapshot = snapshot ? structuredClone(snapshot) : undefined
        const characters = ledger?.characters()
        if (!declined.has(checkpoint.occurrence) && shouldPause(structuredClone(checkpoint), snapshot, structuredClone(characters))) throw new PendingDamage(checkpoint, authoritySnapshot, characters)
      }, () => withMultipartSaveCheckpoints((request,snapshot)=>{
        const occurrence=multipartSaveOccurrence++,prior=multipartSaveChoices.get(occurrence)
        if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');return prior.accepted}
        throw new PendingMultipartSave(request,snapshot,occurrence)
      },()=>withDnd5eAfterOriginalFallCheckpoints(()=>!originalD20Pause&&(!!originalD20Replay||allyNaturalOneDecisions.size>0),(request,snapshot)=>{
        const occurrence=afterOriginalFallOccurrence++,prior=afterOriginalFallChoices.get(occurrence)
        if(prior){if(JSON.stringify(prior.request)!==JSON.stringify(request)||prior.snapshotSignature!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return structuredClone(prior.choice)}
        throw new PendingAfterOriginalFall(request,snapshot,occurrence)
      },()=>pluginTempestuousScope||sequenceOriginalClock||originalD20Replay||stormOriginalReplay||scopedStormReplay||tempestuousBeforeClock||enableTempestuousBeforeSpell||enableTempestuousAfterSpell||enableStormFuryHit||stormCastChoices.size>0||allyNaturalOneDecisions.size>0?effectClock.run(()=>tempestuousBeforeClock?tempestuousBeforeClock.run(()=>resolve(baseline)):resolve(baseline)):resolve(baseline)))))))),settled=>{
        let completed=settled
        for(const actor of Object.values(settled.state.combatants)){
          if(actor.classState.zeroHitPointExtraTurn?.phase!=='pending')continue
          const begun=beginDnd5eAcceptedZeroHitPointTurn(completed.state,zeroStarts.get(actor.id)??{type:'begin-turn',actorId:actor.id})
          if(!begun)throw new RejectedReaction('changed-reaction')
          if(!begun.ok)throw new PendingZeroStart(actor.id,begun.state)
          completed={...begun,events:[...completed.events,...begun.events]}
        }
        return completed
      }))),request=>{const prior=incomingCriticalDice.get(request.id);if(prior)return prior;throw new PendingIncomingCriticalDice(request)}),(request,snapshot,events)=>{
        const ready={...request,ordinal:originalReadyOrdinal++}
        if(originalD20Pause?.(ready))throw new PendingOriginalD20(ready,snapshot,events)
        const frames=originalD20Replay?.readyFrames?.filter(row=>row.request.ordinal===ready.ordinal)??[]
        if(frames.length>1)throw new RejectedReaction('changed-reaction')
        const frame=frames[0]
        if(frame&&JSON.stringify(frame.request)!==JSON.stringify(ready))throw new RejectedReaction('changed-reaction')
        const choices=originalD20Replay?.deferredD20Choices?.filter(row=>row.readyOrdinal===ready.ordinal)??[]
        for(const choice of choices){
          const origin=originalD20Replay?.facts[choice.sourceOccurrence]?.request
          if(!origin||origin.actorId!==ready.actorId||origin.kind!==ready.kind||JSON.stringify(origin.originalRolls)!==JSON.stringify(ready.originalRolls)||choice.actorId!==ready.actorId)throw new RejectedReaction('changed-reaction')
          usedDeferredD20.add(choice.interruptId)
        }
        const readyChoices=frame?.choices??[]
        for(const choice of readyChoices){
          if(usedDeferredD20.has(choice.interruptId)||choices.some(prior=>prior.dieIndex===choice.dieIndex))throw new RejectedReaction('changed-reaction')
          usedDeferredD20.add(choice.interruptId)
        }
        return [...choices,...readyChoices]
      },!!originalD20Replay||!!originalD20Pause||materials?.nativeLuckyTransportAvailable===true)),eventBatchId)
      const resolveOriginal=()=>withFailedSavingThrowCheckpoints((facts,snapshot)=>{
        for(const option of facts.options)rememberReactionSource(option.featureId)
        const occurrence=failedSaveOccurrence++,prior=failedSaveDecisions.get(occurrence)
        if(prior){if(prior.facts!==JSON.stringify(facts))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingFailedSavingThrow(facts,snapshot,occurrence)
      },resolveOriginalBeforeFailedSave)
      const onFailedBonus=(frame:Readonly<FailedD20BonusFrame>,snapshot:Dnd5eHeadlessCombatState):FailedD20BonusChoice|undefined=>{
        for(const option of frame.options){rememberReactionSource(option.featureId);const feature=dnd5ePluginFeatureDefinition(option.featureId);for(const cost of feature?.declarativeAbility?.cost?.resources??[]){const key=dnd5eDeclarativeResourceKey(feature!.ownerPluginId,cost);failedBonusResources.set(key,JSON.stringify(dnd5ePluginResourceDefinition(key)))}}
        const prior=failedBonusChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingFailedD20Bonus(frame,snapshot)
      }
      const onDamageZeroSave=(frame:Readonly<DamageZeroSavingThrowFrame>,snapshot:Dnd5eHeadlessCombatState):DamageZeroSavingThrowChoice|undefined=>{
        for(const option of frame.options){rememberReactionSource(option.featureId);const feature=dnd5ePluginFeatureDefinition(option.featureId);for(const cost of feature?.declarativeAbility?.cost?.resources??[]){const key=dnd5eDeclarativeResourceKey(feature!.ownerPluginId,cost);damageZeroSaveResources.set(key,JSON.stringify(dnd5ePluginResourceDefinition(key)))}}
        const prior=damageZeroSaveChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingDamageZeroSave(frame,snapshot)
      }
      const onSelectedAbility=(frame:Readonly<SpellDamageSelectedAbilityBonusFrame>,snapshot:Dnd5eHeadlessCombatState):SpellDamageSelectedAbilityBonusChoice|undefined=>{
        for(const option of frame.options)rememberReactionSource(option.featureId)
        const prior=selectedAbilityChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingSpellSelectedAbility(frame,snapshot)
      }
      const onHealing=(frame:Readonly<SpellHealingRerollFrame>,snapshot:Dnd5eHeadlessCombatState):SpellHealingRerollChoice|undefined=>{
        for(const option of frame.options)rememberReactionSource(option.featureId)
        const prior=healingChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingSpellHealing(frame,snapshot)
      }
      const onFailedBonusDamage=(request:Readonly<FailedD20BonusDamageRequest>):readonly number[]=>{const prior=failedBonusDamage.get(request.id);if(prior){if(prior.request!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');return [...prior.values]}throw new PendingFailedBonusDamage(request)}
      const onFailedBonusDefense=(request:Readonly<FailedD20BonusDefenseRequest>,snapshot:Dnd5eHeadlessCombatState):FailedD20BonusDefenseChoice=>{const prior=failedBonusDefense.get(request.frameId);if(prior){if(prior.request!==JSON.stringify(request)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return structuredClone(prior.choice)}throw new PendingFailedBonusDefense(request,snapshot)}
      const onFuryOwner=(frame:StormFuryHitFrame,snapshot:Dnd5eHeadlessCombatState):StormFuryHitChoice|undefined=>{
       if(furyMoveClock&&!furyMoveClock.acceptsFrame(frame))return undefined
       for(const option of frame.options)rememberReactionSource(option.featureId)
       const prior=furyOwners.get(frame.index);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
       throw new PendingStormFuryOwner(frame,snapshot)
      }
      const onFurySaving=(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState):StormFurySavingThrow=>{const prior=furySaves.get(request.frame.index);if(prior){if(prior.request!==JSON.stringify(request)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return structuredClone(prior.roll)}throw new PendingStormFurySaving(request,snapshot)}
      const onFuryPush=(request:Readonly<StormFuryMaterialRequest>,snapshot:Dnd5eHeadlessCombatState):Dnd5eSpellForcedMovement|undefined=>{const prior=furyPushes.get(request.frame.index);if(prior){if(prior.request!==JSON.stringify(request)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.movement&&structuredClone(prior.movement)}throw new PendingStormFuryPush(request,snapshot)}
      const withActualFury=<T>(run:()=>T):T=>enableStormFuryHit?withStormFuryMaterialPorts({savingThrow:onFurySaving,push:onFuryPush},()=>withStormFuryHitCheckpoints(onFuryOwner,run)):run()
      const tempestuousLandingUsed=new Set<string>()
       const onTempestuousLanding=(frame:Readonly<TempestuousLandingDiceFrame>,snapshot:Dnd5eHeadlessCombatState,nativeOperation:object):readonly number[]=>{const actual=readDnd5eActualTempestuousLandingOperation(nativeOperation);if(JSON.stringify(actual.frame)!==JSON.stringify(frame)||JSON.stringify(actual.snapshot)!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');rememberReactionSource(frame.featureId);const prior=tempestuousLandingRolls.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');tempestuousLandingUsed.add(frame.id);return[...prior.values]}const owners=[...(frame.timing==='before'?tempestuousBeforeChoices:tempestuousAfterChoices).values()].filter(row=>row.choice&&row.choice.featureId===frame.featureId&&row.choice.elevationFeet===frame.fromElevationFeet&&row.choice.to.x===snapshot.combatants[frame.actorId].position.x&&row.choice.to.y===snapshot.combatants[frame.actorId].position.y),owner=owners.length===1&&owners[0].choice?{frame:JSON.parse(owners[0].frame)as TempestuousBeforeSpellOfferFrame|TempestuousCastFlightFrame,snapshot:JSON.parse(owners[0].snapshot)as Dnd5eHeadlessCombatState,choice:structuredClone(owners[0].choice)}:undefined;throw new PendingTempestuousLanding(frame,snapshot,nativeOperation,effectTimestamp,owner)}
       const withActualTempestuousLanding=<T>(run:()=>T):T=>enableTempestuousBeforeSpell||enableTempestuousAfterSpell?withTempestuousLandingDiceCheckpoints(eventBatchId,onTempestuousLanding,run):run()
       const tempestuousAfterUsed=new Set<string>()
      const onTempestuousAfterSpell=(frame:Readonly<TempestuousCastFlightFrame>,snapshot:Dnd5eHeadlessCombatState):TempestuousCastFlightChoice|undefined=>{
        for(const option of frame.options)rememberReactionSource(option.featureId)
        const prior=tempestuousAfterChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');tempestuousAfterUsed.add(frame.id);return prior.choice&&structuredClone(prior.choice)}
        throw new PendingTempestuousAfterSpell(frame,snapshot,effectTimestamp)
      }
      const withActualTempestuousAfter=<T>(run:()=>T):T=>enableTempestuousAfterSpell?withTempestuousCastFlightCheckpoints(eventBatchId,onTempestuousAfterSpell,run):run()
      const tempestuousBeforeUsed=new Set<string>()
      const onTempestuousBeforeSpell=(frame:Readonly<TempestuousBeforeSpellOfferFrame>,snapshot:Dnd5eHeadlessCombatState):TempestuousBeforeSpellOfferChoice|undefined=>{
        for(const option of frame.options)rememberReactionSource(option.featureId)
        const prior=tempestuousBeforeChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');tempestuousBeforeUsed.add(frame.id);return prior.choice&&structuredClone(prior.choice)}
        throw new PendingTempestuousBeforeSpell(frame,snapshot,effectTimestamp)
      }
      const onTempestuousMovement=(frame:Readonly<TempestuousBeforeSpellMovementFrame>,operation:object,snapshot:Dnd5eHeadlessCombatState)=>{const actual=readDnd5eActualTempestuousBeforeSpellMovement(operation);if(JSON.stringify(actual.frame)!==JSON.stringify(frame)||JSON.stringify(actual.state)!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');throw new PendingTempestuousBeforeCast(frame,snapshot,operation,effectTimestamp)}
      const withActualTempestuousBefore=<T>(run:()=>T):T=>enableTempestuousBeforeSpell?withTempestuousBeforeSpellOffers(eventBatchId,onTempestuousBeforeSpell,()=>pauseAfterTempestuousBeforeMovement?withTempestuousBeforeCastCheckpoints(eventBatchId,onTempestuousMovement,run):run()):run()
      const onStormCast=(frame:Readonly<StormCastEruptionFrame>,snapshot:Dnd5eHeadlessCombatState):StormCastEruptionChoice|undefined=>{
        for(const option of frame.options)rememberReactionSource(option.featureId)
        const scoped=scopedStormReplay?.visit(frame,snapshot,effectTimestamp),prior=stormCastChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot)||scoped&&!stormSame(prior.choice,scoped.choice))throw new RejectedReaction('changed-reaction');stormOriginalUsed.add(frame.id);return prior.choice&&structuredClone(prior.choice)}if(scoped){stormCastChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(snapshot),choice:scoped.choice&&structuredClone(scoped.choice)});return scoped.choice&&structuredClone(scoped.choice)}
        throw new PendingStormCast(frame,snapshot,effectTimestamp)
      }
      const onMasterMiss=(frame:Readonly<MasterDuelistMissFrame>,snapshot:Dnd5eHeadlessCombatState):MasterDuelistChoice|undefined=>{
        for(const option of frame.options){rememberReactionSource(option.featureId);masterResources.set(option.resourceId,JSON.stringify(dnd5ePluginResourceDefinition(option.resourceId)))}
        const prior=masterChoices.get(frame.id);if(prior){if(prior.frame!==JSON.stringify(frame)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingMasterDuelist(frame,snapshot)
      }
      const onMasterDamage=(request:Readonly<MasterDuelistDamageRequest>):readonly number[]=>{const prior=masterDamage.get(request.id);if(prior){if(prior.request!==JSON.stringify(request))throw new RejectedReaction('changed-reaction');return [...prior.values]}throw new PendingMasterDamage(request)}
      const onMasterDefense=(request:MasterDefenseRequest,snapshot:Dnd5eHeadlessCombatState):MasterDuelistDefenseChoice=>{const prior=masterDefense.get(request.frameId);if(prior){if(prior.request!==JSON.stringify(request)||prior.snapshot!==JSON.stringify(snapshot))throw new RejectedReaction('changed-reaction');return structuredClone(prior.choice)}throw new PendingMasterDefense(request,snapshot)}
      const result=withActualTempestuousLanding(()=>withActualFury(()=>withActualTempestuousAfter(()=>withActualTempestuousBefore(()=>withSpellDamageSelectedAbilityBonusCheckpoints(eventBatchId,onSelectedAbility,()=>{return withStormCastEruptionCheckpoints(eventBatchId,onStormCast,()=>withDamageZeroSavingThrowCheckpoints(eventBatchId,onDamageZeroSave,()=>withSpellHealingRerollCheckpoints(eventBatchId,onHealing,()=>withFailedD20BonusCheckpoints(eventBatchId,onFailedBonus,()=>withMasterDuelistCheckpoints(eventBatchId,onMasterMiss,()=>withIncomingHitNegationCheckpoints((facts,snapshot)=>{
        if(!incomingHitNegationOptions(snapshot,facts.event).length)return
        const occurrence=negationOccurrence++,prior=negationDecisions.get(occurrence)
        if(prior){if(prior.facts!==JSON.stringify(facts))throw new RejectedReaction('changed-reaction');return prior.choice&&structuredClone(prior.choice)}
        throw new PendingIncomingHitNegation(facts,snapshot,occurrence)
      },resolveOriginal),{damage:onMasterDamage,defense:onMasterDefense}),{damage:onFailedBonusDamage,defense:onFailedBonusDefense}))))
      })))))
      if([...tempestuousLandingRolls.keys()].some(id=>!tempestuousLandingUsed.has(id)))throw new RejectedReaction('changed-reaction')
      if([...tempestuousAfterChoices.keys()].some(id=>!tempestuousAfterUsed.has(id)))throw new RejectedReaction('changed-reaction')
      if([...tempestuousBeforeChoices.keys()].some(id=>!tempestuousBeforeUsed.has(id)))throw new RejectedReaction('changed-reaction')
      if(stormOriginalReplay?.records.some(record=>!stormOriginalUsed.has(record.frame.id)))throw new RejectedReaction('changed-reaction')
       if(originalD20Replay?.deferredD20Choices?.some(row=>!usedDeferredD20.has(row.interruptId)))throw new RejectedReaction('changed-reaction')
      if(originalD20Replay?.readyFrames?.some(row=>row.choices.some(choice=>!usedDeferredD20.has(choice.interruptId))))throw new RejectedReaction('changed-reaction')
      if(originalD20Replay?.afterOriginalFalls?.some(row=>row.occurrence>=afterOriginalFallOccurrence))throw new RejectedReaction('changed-reaction')
      if(originalD20Replay?.facts.some(row=>!allyNaturalOneDecisions.has(row.occurrence)))throw new RejectedReaction('changed-reaction')
      ended = true
      pending = undefined
      pendingSnapshot = undefined
      return { status: 'resolved', result, ...(ledger ? { materialChanges: materials!.succeeded(result) ? ledger.finish() : [] } : {}) }
    } catch (error) {
      if(pluginTempestuousScope){const own=readDnd5ePluginTempestuousSessionPause(pluginTempestuousScope,error);if(own)return{...own,snapshot:structuredClone(own.snapshot)}}
      if(error instanceof PendingTempestuousLanding){pendingTempestuousLanding=error;const result={status:'pending-tempestuous-landing-dice' as const,frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot),effectTimestamp:error.effectTimestamp};actualTempestuousLandingNative.set(result,{nativeOperation:error.nativeOperation,signature:JSON.stringify(result),owner:error.owner&&structuredClone(error.owner)});return result}
      if(error instanceof PendingSpellSelectedAbility){pendingSpellSelectedAbility=error;return{status:'pending-spell-selected-ability',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingTempestuousBeforeCast){const result={status:'pending-tempestuous-before-cast' as const,frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot),effectTimestamp:error.effectTimestamp};actualTempestuousBeforeCastNative.set(result,{operation:error.operation,signature:JSON.stringify(result)});return result}
      if(error instanceof PendingStormFuryOwner){pendingFuryOwner=error;return markActualStormFuryPending({status:'pending-storm-fury-owner',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot),parentId:eventBatchId,effectTimestamp})}
      if(error instanceof PendingStormFurySaving){pendingFurySaving=error;return markActualStormFuryPending({status:'pending-storm-fury-saving',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),parentId:eventBatchId,effectTimestamp})}
      if(error instanceof PendingStormFuryPush){pendingFuryPush=error;return markActualStormFuryPending({status:'pending-storm-fury-push',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),parentId:eventBatchId,effectTimestamp})}
      if(error instanceof PendingTempestuousAfterSpell){pendingTempestuousAfterSpell=error;return markActualTempestuousAfterPending({status:'pending-tempestuous-after-spell' as const,frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot),effectTimestamp:error.effectTimestamp})}
      if(error instanceof PendingTempestuousBeforeSpell){pendingTempestuousBeforeSpell=error;const result={status:'pending-tempestuous-before-spell' as const,frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot),effectTimestamp:error.effectTimestamp};actualTempestuousBeforeOwnerNative.set(result,JSON.stringify(result));return result}
      if(error instanceof PendingStormCast){pendingStormCast=error;return{status:'pending-storm-cast',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot),effectTimestamp:error.effectTimestamp}}
      if(error instanceof PendingDamageZeroSave){pendingDamageZeroSave=error;return{status:'pending-damage-zero-saving-throw',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingSpellHealing){pendingSpellHealing=error;return{status:'pending-spell-healing-reroll',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingFailedBonusDamage){pendingFailedBonusDamage=error;return{status:'pending-failed-d20-bonus-damage',request:structuredClone(error.request)}}
      if(error instanceof PendingFailedBonusDefense){pendingFailedBonusDefense=error;return{status:'pending-failed-d20-bonus-defense',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingFailedSavingThrow){pendingFailedSave=error;return{status:'pending-failed-saving-throw',facts:structuredClone(error.facts),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingPostD20FeatureUse){pendingFeatureUse=error;return{status:'pending-post-d20-feature-use',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingIncomingAttackArmorClass){pendingIncomingAc=error;return{status:'pending-incoming-armor-class',facts:structuredClone(error.facts),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingOriginalD20){if(stormOriginalReplay?.records.some(record=>!stormOriginalUsed.has(record.frame.id))){ended=true;return{status:'rejected',reason:'changed-reaction'}}ended=true;return {status:'original-d20-ready',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),events:structuredClone(error.events)}}
      if(error instanceof PendingAfterOriginalFall){pendingAfterOriginalFall=error;return {status:'pending-after-original-fall',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingAllyNaturalOne){pendingAllyNaturalOne=error;return {status:'pending-ally-natural-one',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}

      if(error instanceof PendingIncomingHitNegation){pendingNegation=error;return{status:'pending-incoming-hit-negation',facts:structuredClone(error.facts),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingIncomingCriticalDice){pendingIncomingCriticalDice=structuredClone(error.request);return{status:'pending-incoming-critical-dice',request:structuredClone(error.request)}}
      if(error instanceof PendingFailedD20Bonus){pendingFailedBonus=error;return{status:'pending-failed-d20-bonus',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingMasterDuelist){pendingMaster=error;return{status:'pending-master-duelist',frame:structuredClone(error.frame),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingMasterDamage){pendingMasterDamage=error;return{status:'pending-master-duelist-damage',request:structuredClone(error.request)}}
      if(error instanceof PendingMasterDefense){pendingMasterDefense=error;return{status:'pending-master-duelist-defense',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingIncomingAttack){pendingIncomingAttack=error;return{status:'pending-incoming-attack',facts:structuredClone(error.facts),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingMultipartSave){pendingMultipartSave=error;return {status:'pending-multipart-save',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingAutomaticHit){pendingAutomaticHit=error;return {status:'pending-automatic-hit',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof Dnd5eAutomaticHitRetaliationRejected){ended=true;return {status:'rejected',reason:'unsupported-reaction'}}
      if(error instanceof PendingRelentless){pendingRelentless=error;return {status:'pending-relentless',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}}
      if(error instanceof PendingZero){pendingZero=error;return {status:'pending-zero',checkpoint:structuredClone(error.checkpoint),snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingZeroStart){pendingZeroStart=error.actorId;return {status:'pending-zero-start',actorId:error.actorId,snapshot:structuredClone(error.snapshot)}}
      if(error instanceof PendingCritical){
        pendingCritical=error
        return {status:'pending-critical',event:structuredClone(error.event),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}
      }
      if(error instanceof PendingHitFollow){
        pendingHitFollow=error
        return {status:'pending-hit-follow',request:structuredClone(error.request),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}
      }
      if(error instanceof PendingHitPush){
        pendingHitPush=error
        return {status:'pending-hit-push',event:structuredClone(error.event),snapshot:structuredClone(error.snapshot),occurrence:error.occurrence}
      }
      if (error instanceof PendingWeaponHit) {
        pendingWeaponHit = error
        return { status: 'pending-weapon-hit', event: structuredClone(error.event), snapshot: copyDnd5eOrdinaryWeaponScene(error.snapshot,structuredClone(error.snapshot)), occurrence: error.occurrence }
      }
      if (error instanceof RejectedReaction) { ended = true; return {status:'rejected',reason:error.reason} }
      if(error instanceof Dnd5eRelentlessReactionAttackRejected){ended=true;return {status:'rejected',reason:'unsupported-reaction'}}
      if (!(error instanceof PendingDamage)) { ended = true; throw error }
      pending = structuredClone(error.checkpoint)
      pendingSnapshot = error.snapshot
      pendingCharacters = error.characters
      return { status: 'pending', checkpoint: structuredClone(pending),
        ...(pendingCharacters ? { charactersByCombatantId: structuredClone(pendingCharacters) } : {}),
        triggerEventId: dnd5eBoundedHostEventId(`activity-event:${baseline.combatId}:${eventBatchId}:${pending.occurrence}:before-damage`) }
    } finally { ledger?.cancel() }
  }
  const replaySession = {
    run,
    resumeFailedSavingThrow(current:Dnd5eHeadlessCombatState,occurrence:number,facts:FailedSavingThrowFacts,choice?:FailedSavingThrowChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingFailedSave||pendingFailedSave.occurrence!==occurrence||JSON.stringify(facts)!==JSON.stringify(pendingFailedSave.facts))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&!facts.options.some(option=>option.featureId===choice.featureId))return{status:'rejected',reason:'unsupported-reaction'}
      failedSaveDecisions.set(occurrence,{facts:JSON.stringify(facts),choice:choice&&structuredClone(choice)});pendingFailedSave=undefined;return run(current)
    },
    resumePostD20FeatureUse(current:Dnd5eHeadlessCombatState,occurrence:number,request:PostD20FeatureUseRequest,choice?:PostD20FeatureUseChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingFeatureUse||pendingFeatureUse.occurrence!==occurrence||JSON.stringify(request)!==JSON.stringify(pendingFeatureUse.request))return{status:'rejected',reason:'stale-checkpoint'}
      featureUseDecisions.set(occurrence,{request:JSON.stringify(request),choice:choice&&structuredClone(choice)});pendingFeatureUse=undefined;return run(current)
    },
    resumeIncomingArmorClass(current:Dnd5eHeadlessCombatState,occurrence:number,facts:IncomingAttackArmorClassFacts,choice?:IncomingAttackArmorClassChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingIncomingAc||pendingIncomingAc.occurrence!==occurrence||JSON.stringify(facts)!==JSON.stringify(pendingIncomingAc.facts))return{status:'rejected',reason:'stale-checkpoint'}
      incomingAcDecisions.set(occurrence,{facts:JSON.stringify(facts),choice:choice&&structuredClone(choice)});pendingIncomingAc=undefined;return run(current)
    },
    resumeIncomingCriticalDice(current:Dnd5eHeadlessCombatState,request:IncomingCriticalDiceRequest,values:readonly number[]):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingIncomingCriticalDice||JSON.stringify(request)!==JSON.stringify(pendingIncomingCriticalDice))return{status:'rejected',reason:'stale-checkpoint'}
      if(values.length!==request.count||values.some(value=>!Number.isInteger(value)||value<1||value>request.sides))return{status:'rejected',reason:'unsupported-reaction'}
      incomingCriticalDice.set(request.id,[...values]);pendingIncomingCriticalDice=undefined;return run(current)
    },
    resumeIncomingHitNegation(current:Dnd5eHeadlessCombatState,occurrence:number,facts:IncomingHitNegationFacts,choice?:IncomingHitNegationChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingNegation||pendingNegation.occurrence!==occurrence||JSON.stringify(facts)!==JSON.stringify(pendingNegation.facts))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&(!incomingHitNegationOptions(pendingNegation.snapshot,facts.event).some(o=>o.featureId===choice.featureId)||!Number.isInteger(choice.die)||choice.die<1||choice.die>6))return{status:'rejected',reason:'unsupported-reaction'}
      negationDecisions.set(occurrence,{facts:JSON.stringify(facts),choice:choice&&structuredClone(choice)});pendingNegation=undefined;return run(current)
    },
    resumeDamageZeroSavingThrow(current:Dnd5eHeadlessCombatState,frame:Readonly<DamageZeroSavingThrowFrame>,choice?:DamageZeroSavingThrowChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingDamageZeroSave||JSON.stringify(frame)!==JSON.stringify(pendingDamageZeroSave.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&!isDamageZeroSavingThrowChoice(frame,choice))return{status:'rejected',reason:'unsupported-reaction'}
      damageZeroSaveChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingDamageZeroSave.snapshot),choice:choice&&structuredClone(choice)});pendingDamageZeroSave=undefined;return run(current)
    },
    resumeSpellSelectedAbilityBonus(current:Dnd5eHeadlessCombatState,frame:Readonly<SpellDamageSelectedAbilityBonusFrame>,choice?:SpellDamageSelectedAbilityBonusChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingSpellSelectedAbility||JSON.stringify(frame)!==JSON.stringify(pendingSpellSelectedAbility.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&!isSpellDamageSelectedAbilityBonusChoice(frame,choice))return{status:'rejected',reason:'unsupported-reaction'}
      selectedAbilityChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingSpellSelectedAbility.snapshot),choice:choice&&structuredClone(choice)});pendingSpellSelectedAbility=undefined;return run(current)
    },
    resumeSpellHealingReroll(current:Dnd5eHeadlessCombatState,frame:Readonly<SpellHealingRerollFrame>,choice?:SpellHealingRerollChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingSpellHealing||JSON.stringify(frame)!==JSON.stringify(pendingSpellHealing.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice){
        if(choice.frameId!==frame.id||!frame.options.some(o=>o.ownerId===choice.ownerId&&o.featureId===choice.featureId)||!Array.isArray(choice.rerolls))return{status:'rejected',reason:'unsupported-reaction'}
        const seen=new Set<string>();for(const die of choice.rerolls){const rollId=die.rollId??(frame.groups.length===1?frame.rollId:undefined),group=frame.groups.find(g=>g.rollId===rollId),key=JSON.stringify([rollId,die.dieIndex]);if(!group||!Number.isInteger(die.dieIndex)||die.dieIndex<0||die.dieIndex>=group.rolls.length||seen.has(key)||!Number.isInteger(die.value)||die.value<1||die.value>group.sides)return{status:'rejected',reason:'unsupported-reaction'};seen.add(key)}
      }
      healingChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingSpellHealing.snapshot),choice:choice&&structuredClone(choice)});pendingSpellHealing=undefined;return run(current)
    },
    resumeFailedD20BonusDamage(current:Dnd5eHeadlessCombatState,request:Readonly<FailedD20BonusDamageRequest>,values:readonly number[]):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingFailedBonusDamage||JSON.stringify(request)!==JSON.stringify(pendingFailedBonusDamage.request))return{status:'rejected',reason:'stale-checkpoint'}
      if(values.length!==request.count||values.some(v=>!Number.isInteger(v)||v<1||v>request.sides))return{status:'rejected',reason:'unsupported-reaction'}
      failedBonusDamage.set(request.id,{request:JSON.stringify(request),values:[...values]});pendingFailedBonusDamage=undefined;return run(current)
    },
    resumeFailedD20BonusDefense(current:Dnd5eHeadlessCombatState,request:Readonly<FailedD20BonusDefenseRequest>,choice:FailedD20BonusDefenseChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingFailedBonusDefense||JSON.stringify(request)!==JSON.stringify(pendingFailedBonusDefense.request))return{status:'rejected',reason:'stale-checkpoint'}
      if(Object.keys(choice).some(k=>k!=='shieldSpellReaction'&&k!=='shieldSpellcastingSavingThrows')||choice.shieldSpellReaction!==undefined&&typeof choice.shieldSpellReaction!=='boolean'||choice.shieldSpellReaction===true&&!request.shieldAvailable||choice.shieldSpellcastingSavingThrows!==undefined&&(!Array.isArray(choice.shieldSpellcastingSavingThrows)||choice.shieldSpellReaction!==true))return{status:'rejected',reason:'unsupported-reaction'}
      failedBonusDefense.set(request.frameId,{request:JSON.stringify(request),snapshot:JSON.stringify(pendingFailedBonusDefense.snapshot),choice:structuredClone(choice)});pendingFailedBonusDefense=undefined;return run(current)
    },
    resumeFailedD20Bonus(current:Dnd5eHeadlessCombatState,frame:Readonly<FailedD20BonusFrame>,choice?:FailedD20BonusChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingFailedBonus||JSON.stringify(frame)!==JSON.stringify(pendingFailedBonus.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&(choice.frameId!==frame.id||!frame.options.some(option=>option.featureId===choice.featureId)||!Array.isArray(choice.rolls)||choice.rolls.length!==2||choice.rolls.some(value=>!Number.isInteger(value)||value<1||value>4)))return{status:'rejected',reason:'unsupported-reaction'}
      failedBonusChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingFailedBonus.snapshot),choice:choice&&structuredClone(choice)});pendingFailedBonus=undefined;return run(current)
    },
    resumeStormFuryOwner(current:Dnd5eHeadlessCombatState,frame:Readonly<StormFuryHitFrame>,choice?:FuryOwnerChoice):Dnd5eDamageCommitSessionResult<Result>{
     if(ended)return{status:'rejected',reason:'session-ended'}
     if(!pendingFuryOwner||JSON.stringify(frame)!==JSON.stringify(pendingFuryOwner.frame))return{status:'rejected',reason:'stale-checkpoint'}
     if(choice&&(Object.keys(choice).some(key=>!['frameIndex','featureId'].includes(key))||choice.frameIndex!==frame.index||!frame.options.some(option=>option.featureId===choice.featureId)))return{status:'rejected',reason:'unsupported-reaction'}
     furyOwners.set(frame.index,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingFuryOwner.snapshot),choice:choice&&structuredClone(choice)});pendingFuryOwner=undefined;return run(current)
    },
    resumeStormFurySaving(current:Dnd5eHeadlessCombatState,request:Readonly<StormFuryMaterialRequest>,roll:StormFurySavingThrow):Dnd5eDamageCommitSessionResult<Result>{
     if(ended)return{status:'rejected',reason:'session-ended'}
     if(!pendingFurySaving||JSON.stringify(request)!==JSON.stringify(pendingFurySaving.request))return{status:'rejected',reason:'stale-checkpoint'}
     if(!roll||Object.keys(roll).some(key=>!['d20','d20Second','halflingLuckyD20','halflingLuckyD20Second','blessRoll','baneRoll','rerollResourceKey','rerollD20','rerollD20Second','bardicInspirationRoll','darkOnesOwnLuckRoll','optionalBonusDice','legendaryResistance','postD20Adjustment'].includes(key))||!Number.isInteger(roll.d20)||roll.d20<1||roll.d20>20)return{status:'rejected',reason:'unsupported-reaction'}
     furySaves.set(request.frame.index,{request:JSON.stringify(request),snapshot:JSON.stringify(pendingFurySaving.snapshot),roll:structuredClone(roll)});pendingFurySaving=undefined;return run(current)
    },
    resumeStormFuryPush(current:Dnd5eHeadlessCombatState,request:Readonly<StormFuryMaterialRequest>,movement?:Dnd5eSpellForcedMovement):Dnd5eDamageCommitSessionResult<Result>{
     if(ended)return{status:'rejected',reason:'session-ended'}
     if(!pendingFuryPush||JSON.stringify(request)!==JSON.stringify(pendingFuryPush.request))return{status:'rejected',reason:'stale-checkpoint'}
     if(movement&&(Object.keys(movement).some(key=>!['targetId','to','distanceFeet','toElevationFeet','toGroundElevationFeet','fallingDamageRolls'].includes(key))||!movement.to||Object.keys(movement.to).some(key=>!['x','y'].includes(key))||!Number.isFinite(movement.to.x)||!Number.isFinite(movement.to.y)||!Number.isFinite(movement.distanceFeet)||movement.distanceFeet<0||movement.distanceFeet>20))return{status:'rejected',reason:'unsupported-reaction'}
     furyPushes.set(request.frame.index,{request:JSON.stringify(request),snapshot:JSON.stringify(pendingFuryPush.snapshot),movement:movement&&structuredClone(movement)});pendingFuryPush=undefined;return run(current)
    },
    resumeTempestuousLandingDice(current:Dnd5eHeadlessCombatState,frame:Readonly<TempestuousLandingDiceFrame>,values:readonly number[]):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingTempestuousLanding||JSON.stringify(frame)!==JSON.stringify(pendingTempestuousLanding.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(!Array.isArray(values)||values.length!==frame.count||values.some(v=>!Number.isInteger(v)||v<1||v>frame.sides))return{status:'rejected',reason:'unsupported-reaction'}
      tempestuousLandingRolls.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingTempestuousLanding.snapshot),values:[...values]});pendingTempestuousLanding=undefined;return run(current)
     },
    resumeTempestuousAfterSpell(current:Dnd5eHeadlessCombatState,frame:Readonly<TempestuousCastFlightFrame>,choice?:TempestuousCastFlightChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingTempestuousAfterSpell||JSON.stringify(frame)!==JSON.stringify(pendingTempestuousAfterSpell.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&(Object.keys(choice).some(key=>!['frameId','featureId','to','elevationFeet'].includes(key))||choice.frameId!==frame.id||!frame.options.some(option=>option.featureId===choice.featureId)||!choice.to||Object.keys(choice.to).some(key=>!['x','y'].includes(key))||!Number.isFinite(choice.to.x)||!Number.isFinite(choice.to.y)||choice.elevationFeet!==undefined&&!Number.isFinite(choice.elevationFeet)))return{status:'rejected',reason:'unsupported-reaction'}
      tempestuousAfterChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingTempestuousAfterSpell.snapshot),choice:choice&&structuredClone(choice)});pendingTempestuousAfterSpell=undefined;return run(current)
    },
    resumeTempestuousBeforeSpell(current:Dnd5eHeadlessCombatState,frame:Readonly<TempestuousBeforeSpellOfferFrame>,choice?:TempestuousBeforeSpellOfferChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingTempestuousBeforeSpell||JSON.stringify(frame)!==JSON.stringify(pendingTempestuousBeforeSpell.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&!isTempestuousBeforeSpellOfferChoice(frame,choice))return{status:'rejected',reason:'unsupported-reaction'}
      tempestuousBeforeChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingTempestuousBeforeSpell.snapshot),choice:choice&&structuredClone(choice)});pendingTempestuousBeforeSpell=undefined;return run(current)
    },
    resumeStormCast(current:Dnd5eHeadlessCombatState,frame:Readonly<StormCastEruptionFrame>,choice?:StormCastEruptionChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingStormCast||JSON.stringify(frame)!==JSON.stringify(pendingStormCast.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&(Object.keys(choice).some(k=>!['frameId','featureId','damageType','targetIds'].includes(k))||choice.frameId!==frame.id||!frame.options.some(o=>o.featureId===choice.featureId)||!['lightning','thunder'].includes(choice.damageType)||!Array.isArray(choice.targetIds)||new Set(choice.targetIds).size!==choice.targetIds.length||choice.targetIds.some(id=>!frame.targetIds.includes(id))))return{status:'rejected',reason:'unsupported-reaction'}
      stormCastChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingStormCast.snapshot),choice:choice&&structuredClone(choice)});pendingStormCast=undefined;return run(current)
    },
    resumeMasterDuelist(current:Dnd5eHeadlessCombatState,frame:Readonly<MasterDuelistMissFrame>,choice?:MasterDuelistChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingMaster||JSON.stringify(frame)!==JSON.stringify(pendingMaster.frame))return{status:'rejected',reason:'stale-checkpoint'}
      if(choice&&(choice.frameId!==frame.id||!frame.options.some(o=>o.featureId===choice.featureId)||choice.rolls.length!==(frame.rerollMode.mode==='normal'?1:2)||choice.rolls.some(v=>!Number.isInteger(v)||v<1||v>20)))return{status:'rejected',reason:'unsupported-reaction'}
      masterChoices.set(frame.id,{frame:JSON.stringify(frame),snapshot:JSON.stringify(pendingMaster.snapshot),choice:choice&&structuredClone(choice)});pendingMaster=undefined;return run(current)
    },
    resumeMasterDuelistDamage(current:Dnd5eHeadlessCombatState,request:Readonly<MasterDuelistDamageRequest>,values:readonly number[]):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingMasterDamage||JSON.stringify(request)!==JSON.stringify(pendingMasterDamage.request))return{status:'rejected',reason:'stale-checkpoint'}
      if(values.length!==request.count||values.some(v=>!Number.isInteger(v)||v<1||v>request.sides))return{status:'rejected',reason:'unsupported-reaction'}
      masterDamage.set(request.id,{request:JSON.stringify(request),values:[...values]});pendingMasterDamage=undefined;return run(current)
    },
    resumeMasterDuelistDefense(current:Dnd5eHeadlessCombatState,request:MasterDefenseRequest,choice:MasterDuelistDefenseChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingMasterDefense||JSON.stringify(request)!==JSON.stringify(pendingMasterDefense.request))return{status:'rejected',reason:'stale-checkpoint'}
      if(Object.keys(choice).some(k=>k!=='shieldSpellReaction'&&k!=='shieldSpellcastingSavingThrows')||choice.shieldSpellReaction!==undefined&&typeof choice.shieldSpellReaction!=='boolean'||choice.shieldSpellcastingSavingThrows!==undefined&&(!Array.isArray(choice.shieldSpellcastingSavingThrows)||choice.shieldSpellReaction!==true))return{status:'rejected',reason:'unsupported-reaction'}
      masterDefense.set(request.frameId,{request:JSON.stringify(request),snapshot:JSON.stringify(pendingMasterDefense.snapshot),choice:structuredClone(choice)});pendingMasterDefense=undefined;return run(current)
    },
    resumeIncomingAttack(current:Dnd5eHeadlessCombatState,occurrence:number,facts:IncomingAttackRollFacts,choice?:IncomingAttackRerollChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pendingIncomingAttack||pendingIncomingAttack.occurrence!==occurrence||JSON.stringify(facts)!==JSON.stringify(pendingIncomingAttack.facts))return{status:'rejected',reason:'stale-checkpoint'}
      incomingAttackDecisions.set(occurrence,{facts:JSON.stringify(facts),choice:choice&&structuredClone(choice)});pendingIncomingAttack=undefined;return run(current)
    },
    resumeMultipartSave(current:Dnd5eHeadlessCombatState,occurrence:number,accepted:boolean):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingMultipartSave||pendingMultipartSave.occurrence!==occurrence)return {status:'rejected',reason:'stale-checkpoint'}
      multipartSaveChoices.set(occurrence,{request:structuredClone(pendingMultipartSave.request),accepted})
      pendingMultipartSave=undefined
      return run(current)
    },
    originalEffectTimestamp:()=>effectTimestamp,
    originalAllyNaturalOneError:()=>pendingAllyNaturalOne,
    afterOriginalFallFacts:()=>[...afterOriginalFallChoices].sort(([a],[b])=>a-b).map(([occurrence,value])=>({occurrence,...structuredClone(value)})),
    resumeAfterOriginalFall(current:Dnd5eHeadlessCombatState,occurrence:number,request:Dnd5eAfterOriginalFallRequest,choice:Dnd5eAfterOriginalFallChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingAfterOriginalFall||pendingAfterOriginalFall.occurrence!==occurrence||JSON.stringify(pendingAfterOriginalFall.request)!==JSON.stringify(request))return {status:'rejected',reason:'changed-reaction'}
      if(!validDnd5eAfterOriginalFallChoice(choice))return {status:'rejected',reason:'unsupported-reaction'}
      afterOriginalFallChoices.set(occurrence,{request:structuredClone(request),snapshotSignature:JSON.stringify(pendingAfterOriginalFall.snapshot),choice:structuredClone(choice)});pendingAfterOriginalFall=undefined;return run(current)
    },
    resumePluginTempestuousFlight(current:Dnd5eHeadlessCombatState,operation:Dnd5ePluginTempestuousNativeOperation,choice?:Parameters<typeof acceptDnd5ePluginTempestuousSessionFlight>[2]):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pluginTempestuousScope)return{status:'rejected',reason:'changed-reaction'}
      acceptDnd5ePluginTempestuousSessionFlight(pluginTempestuousScope,operation,choice);return run(current)
    },
    resumePluginTempestuousLanding(current:Dnd5eHeadlessCombatState,operation:Dnd5ePluginTempestuousLandingOperation,values:readonly number[]):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return{status:'rejected',reason:'session-ended'}
      if(!pluginTempestuousScope)return{status:'rejected',reason:'changed-reaction'}
      acceptDnd5ePluginTempestuousSessionLanding(pluginTempestuousScope,operation,values);return run(current)
    },
    resumeAllyNaturalOne(current:Dnd5eHeadlessCombatState,occurrence:number,request:AllyNaturalOneRequest,decision?:AllyNaturalOneDecision):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingAllyNaturalOne||pendingAllyNaturalOne.occurrence!==occurrence||JSON.stringify(request)!==JSON.stringify(pendingAllyNaturalOne.request))return {status:'rejected',reason:'changed-reaction'}
      if(decision&&(!request.options.some(option=>option.ownerId===decision.ownerId&&option.featureId===decision.featureId)||!Number.isInteger(decision.replacement)||decision.replacement<1||decision.replacement>20))return {status:'rejected',reason:'unsupported-reaction'}
      allyNaturalOneDecisions.set(occurrence,{request:structuredClone(request),decision:structuredClone(decision)})
      pendingAllyNaturalOne=undefined
      return run(current)
    },
    resumeAutomaticHit(current:Dnd5eHeadlessCombatState,occurrence:number,request:Dnd5eAutomaticHitRetaliationRequest,rolls:Dnd5eAutomaticHitRetaliationRolls):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingAutomaticHit||pendingAutomaticHit.occurrence!==occurrence||JSON.stringify(request)!==JSON.stringify(pendingAutomaticHit.request))return {status:'rejected',reason:'stale-checkpoint'}
      automaticHitDecisions.set(occurrence,{request:structuredClone(request),rolls:structuredClone(rolls)});pendingAutomaticHit=undefined;return run(current)
    },
    resumeRelentless(current:Dnd5eHeadlessCombatState,occurrence:number,request:Dnd5eRelentlessReactionRequest,choice:Dnd5eRelentlessReactionChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingRelentless||pendingRelentless.occurrence!==occurrence||JSON.stringify(request)!==JSON.stringify(pendingRelentless.request))return {status:'rejected',reason:'stale-checkpoint'}
      if(choice.attack){
        if(choice.attack.actorId!==request.actorId||choice.attack.activityWeaponAttackGrantId!==request.grantId)return {status:'rejected',reason:'unsupported-reaction'}
      }
      relentlessChoices.set(occurrence,{request:structuredClone(request),choice:structuredClone(choice)})
      pendingRelentless=undefined
      return run(current)
    },
    resumeZero(current:Dnd5eHeadlessCombatState,occurrence:number,featureId?:string):Dnd5eDamageCommitSessionResult<Result>{
      if(!pendingZero||pendingZero.checkpoint.occurrence!==occurrence)return {status:'rejected',reason:'stale-checkpoint'}
      if(featureId&&!dnd5eZeroHitPointTurnOptions(pendingZero.snapshot,pendingZero.checkpoint).some(option=>option.featureId===featureId))return {status:'rejected',reason:'unsupported-reaction'}
      zeroDecisions.set(occurrence,{checkpoint:JSON.stringify(pendingZero.checkpoint),featureId})
      pendingZero=undefined
      return run(current)
    },
    resumeZeroStart(current:Dnd5eHeadlessCombatState,action:Extract<Dnd5eAction,{type:'begin-turn'}>):Dnd5eDamageCommitSessionResult<Result>{
      if(pendingZeroStart!==action.actorId)return {status:'rejected',reason:'stale-checkpoint'}
      zeroStarts.set(action.actorId,structuredClone(action));pendingZeroStart=undefined
      return run(current)
    },
    resumeCritical(current:Dnd5eHeadlessCombatState,occurrence:number,event:Dnd5eCriticalHitEvent,selection?:Dnd5eCriticalCancellationSelection):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingCritical||occurrence!==pendingCritical.occurrence||JSON.stringify(event)!==JSON.stringify(pendingCritical.event))return {status:'rejected',reason:'stale-checkpoint'}
      if(selection&&!resolveDnd5eCriticalCancellation(pendingCritical.snapshot,pendingCritical.event,selection).ok)return {status:'rejected',reason:'unsupported-reaction'}
      criticalDecisions.set(occurrence,{event:structuredClone(event),...(selection?{selection:structuredClone(selection)}:{})})
      pendingCritical=undefined
      return run(current)
    },
    resumeHitFollow(current:Dnd5eHeadlessCombatState,occurrence:number,request:Dnd5eHitFollowRequest,choice:Dnd5eHitFollowChoice):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingHitFollow||pendingHitFollow.occurrence!==occurrence||JSON.stringify(request)!==JSON.stringify(pendingHitFollow.request))return {status:'rejected',reason:'stale-checkpoint'}
      followChoices.set(occurrence,{request:structuredClone(request),choice:structuredClone(choice)})
      pendingHitFollow=undefined
      return run(current)
    },
    resumeHitPush(current:Dnd5eHeadlessCombatState,occurrence:number,event:Dnd5eHitPushEvent,receipts:Dnd5eHitPushReceipts):Dnd5eDamageCommitSessionResult<Result>{
      if(ended)return {status:'rejected',reason:'session-ended'}
      if(!pendingHitPush||pendingHitPush.occurrence!==occurrence||JSON.stringify(event)!==JSON.stringify(pendingHitPush.event))return {status:'rejected',reason:'stale-checkpoint'}
      pushReceipts.set(occurrence,{event:structuredClone(event),receipts:structuredClone(receipts)})
      pendingHitPush=undefined
      return run(current)
    },
    resumeWeaponHit(current: Dnd5eHeadlessCombatState, occurrence: number, event: Dnd5eWeaponHitEvent,
      decision?: Dnd5eWeaponHitDecision): Dnd5eDamageCommitSessionResult<Result> {
      if (ended) return { status: 'rejected', reason: 'session-ended' }
      if (!pendingWeaponHit || pendingWeaponHit.occurrence !== occurrence || JSON.stringify(event) !== JSON.stringify(pendingWeaponHit.event))
        return { status: 'rejected', reason: 'stale-checkpoint' }
      weaponDecisions.set(occurrence, { event: structuredClone(event), ...(decision ? { decision: structuredClone(decision) } : {}) })
      pendingWeaponHit = undefined
      return run(current)
    },
    accept(current: Dnd5eHeadlessCombatState, checkpoint: Dnd5eDamageCommitCheckpoint, selection: Dnd5eDamageReactionSelection): Dnd5eDamageCommitSessionResult<Result> {
      if (ended) return {status:'rejected',reason:'session-ended'}
      if (!pending || JSON.stringify(checkpoint) !== JSON.stringify(pending)) return {status:'rejected',reason:'stale-checkpoint'}
      if (JSON.stringify(current) !== signature) { ended = true; return {status:'rejected',reason:'stale-state'} }
      if (!pendingSnapshot) return {status:'rejected',reason:'unsupported-reaction'}
      const frozenSelection = structuredClone(selection)
      const previewLedger = pendingCharacters ? createDnd5eDamageReactionMaterialLedger(pendingCharacters) : undefined
      let resolution: Dnd5eDamageReactionResolution
      try { resolution = resolveDnd5eDamageCheckpointReaction({state:pendingSnapshot,checkpoint:pending,selection:frozenSelection,eventBatchId,materialLedger:previewLedger}) }
      finally { previewLedger?.cancel() }
      if (!resolution.ok) return {status:'rejected',reason:resolution.reason,details:resolution.details}
      accepted.set(pending.occurrence,{selection:frozenSelection,definitionSignature:resolution.definitionSignature,checkpoint:structuredClone(pending)})
      pending = undefined
      pendingSnapshot = undefined
      return run(current)
    },
    decline(current: Dnd5eHeadlessCombatState, checkpoint: Dnd5eDamageCommitCheckpoint): Dnd5eDamageCommitSessionResult<Result> {
      if (ended) return { status: 'rejected', reason: 'session-ended' }
      if (!pending || JSON.stringify(checkpoint) !== JSON.stringify(pending)) return { status: 'rejected', reason: 'stale-checkpoint' }
      declined.add(pending.occurrence)
      pending = undefined
      pendingSnapshot = undefined
      return run(current)
    },
    cancel() { if(pluginTempestuousScope)cancelDnd5ePluginTempestuousSession(pluginTempestuousScope);ended = true;pendingTempestuousLanding=undefined;tempestuousLandingRolls.clear();pendingSpellSelectedAbility=undefined;selectedAbilityChoices.clear();pendingDamageZeroSave=undefined;damageZeroSaveChoices.clear();damageZeroSaveResources.clear();pendingSpellHealing=undefined;healingChoices.clear();pendingFailedBonus=undefined;failedBonusChoices.clear();pendingFailedBonusDamage=undefined;failedBonusDamage.clear();pendingFailedBonusDefense=undefined;failedBonusDefense.clear();pendingRelentless=undefined;relentlessChoices.clear(); pendingCritical=undefined;criticalDecisions.clear(); pending = undefined; pendingSnapshot = undefined; pendingWeaponHit = undefined; pendingHitPush=undefined;pushReceipts.clear();pendingHitFollow=undefined;followChoices.clear(); pendingCharacters = undefined; accepted.clear(); weaponDecisions.clear() },
  }
  tempestuousBeforeClock?.attachCancel(replaySession.cancel)
  if(scopedStormReplay){Object.defineProperty(replaySession,stormScopedSessionRecords,{value:scopedStormReplay.records,enumerable:true});scopedStormReplay.attachCancel(replaySession.cancel)}
  return replaySession
}

export interface Dnd5eTempestuousBeforeCastOriginalOperation{readonly kind:'tempestuous-before-cast-original-operation'}
type ActualTempestuousBeforeCastRow={input:object;resolve:unknown;operation:object;result:object;signature:string;inputSignature:string;effectTimestamp:number}
const actualTempestuousBeforeCastBoundaries=new WeakMap<object,ActualTempestuousBeforeCastRow>(),actualTempestuousBeforeCastOperations=new WeakMap<object,ActualTempestuousBeforeCastRow>()
function bindActualTempestuousBeforeCastSession<S extends{run:(state:Dnd5eHeadlessCombatState)=>Dnd5eDamageCommitSessionResult<unknown>}>(session:S,input:object,resolve:unknown):S{
 const wrapped={...session},inputSignature=JSON.stringify(input),ownerRecords:Dnd5eTempestuousBeforeSpellOriginalRecord[]=[];let pendingOwner:Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-tempestuous-before-spell'}>|undefined
 for(const key of Object.keys(session)){const method=Object.getOwnPropertyDescriptor(session,key)?.value as unknown;if(typeof method!=='function'||key!=='run'&&!key.startsWith('resume'))continue;Object.defineProperty(wrapped,key,{enumerable:true,configurable:true,writable:true,value:(...args:unknown[])=>{const beforeOwner=pendingOwner,result=Reflect.apply(method,session,args) as Dnd5eDamageCommitSessionResult<unknown>;
 if(key==='resumeTempestuousBeforeSpell'&&result.status!=='rejected'){if(!beforeOwner||JSON.stringify(args[1])!==JSON.stringify(beforeOwner.frame))throw Error('tempestuous-before-owner:actual-pending-required');const choice=args[2] as TempestuousBeforeSpellOfferChoice|undefined;ownerRecords.push({frame:structuredClone(beforeOwner.frame),prefixSignature:JSON.stringify(beforeOwner.snapshot),...(choice?{choice:structuredClone(choice)}:{})});pendingOwner=undefined}
 if(result.status==='pending-tempestuous-before-spell'){if(actualTempestuousBeforeOwnerNative.get(result)!==JSON.stringify(result))throw Error('tempestuous-before-owner:actual-native-pending-required');pendingOwner=result;actualTempestuousBeforeOwnerBoundaries.set(result,{input,resolve,result,signature:JSON.stringify(result),inputSignature,frame:structuredClone(result.frame),snapshot:structuredClone(result.snapshot),effectTimestamp:result.effectTimestamp,records:ownerRecords,features:result.frame.options.map(option=>({featureId:option.featureId,signature:JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId))}))})}
 if(result.status==='pending-tempestuous-before-cast'){const native=actualTempestuousBeforeCastNative.get(result);if(!native||native.signature!==JSON.stringify(result))throw Error('tempestuous-before-cast:actual-native-pending-required');actualTempestuousBeforeCastBoundaries.set(result,{input,resolve,operation:native.operation,result,signature:JSON.stringify(result),inputSignature,effectTimestamp:result.effectTimestamp})}return result}})}return wrapped as S
}
function currentTempestuousBeforeCastRow(row:ActualTempestuousBeforeCastRow|undefined){
 if(!row||row.signature!==JSON.stringify(row.result)||row.inputSignature!==JSON.stringify(row.input))throw Error('tempestuous-before-cast:actual-unchanged-boundary-required')
 const native=readDnd5eActualTempestuousBeforeSpellMovement(row.operation)
 if(!Number.isSafeInteger(row.effectTimestamp)||row.effectTimestamp<=0)throw Error('tempestuous-before-cast:actual-parent-clock-required')
 return{row,native}
}
/** Mechanical original-prefix provenance only, with no caller registration. */
export function captureDnd5eTempestuousBeforeCastOriginalOperation(result:object):Dnd5eTempestuousBeforeCastOriginalOperation{
 const {row}=currentTempestuousBeforeCastRow(actualTempestuousBeforeCastBoundaries.get(result)),operation:Dnd5eTempestuousBeforeCastOriginalOperation=Object.freeze({kind:'tempestuous-before-cast-original-operation'});actualTempestuousBeforeCastOperations.set(operation,row);return operation
}
export function readDnd5eTempestuousBeforeCastOriginalOperation(operation:Dnd5eTempestuousBeforeCastOriginalOperation){
 const {row,native}=currentTempestuousBeforeCastRow(actualTempestuousBeforeCastOperations.get(operation));return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,nativeOperation:row.operation,frame:structuredClone(native.frame),snapshot:structuredClone(native.state),effectTimestamp:row.effectTimestamp,transaction:native.transaction&&structuredClone(native.transaction)}
}

export interface Dnd5eTempestuousBeforeSpellOriginalRecord{readonly frame:Readonly<TempestuousBeforeSpellOfferFrame>;readonly prefixSignature:string;readonly choice?:TempestuousBeforeSpellOfferChoice}
export interface Dnd5eTempestuousBeforeSpellOriginalOperation{readonly kind:'tempestuous-before-spell-original-operation'}
type ActualTempestuousBeforeOwnerRow={input:object;resolve:unknown;result:object;signature:string;inputSignature:string;frame:Readonly<TempestuousBeforeSpellOfferFrame>;snapshot:Dnd5eHeadlessCombatState;effectTimestamp:number;records:Dnd5eTempestuousBeforeSpellOriginalRecord[];features:readonly{featureId:string;signature:string}[]}
const actualTempestuousBeforeOwnerBoundaries=new WeakMap<object,ActualTempestuousBeforeOwnerRow>(),actualTempestuousBeforeOwnerOperations=new WeakMap<object,ActualTempestuousBeforeOwnerRow>()
function currentTempestuousBeforeOwnerRow(row:ActualTempestuousBeforeOwnerRow|undefined){
 if(!row||row.signature!==JSON.stringify(row.result)||row.inputSignature!==JSON.stringify(row.input))throw Error('tempestuous-before-owner:actual-unchanged-boundary-required')
 if(!Number.isSafeInteger(row.effectTimestamp)||row.effectTimestamp<=0||row.features.some(feature=>JSON.stringify(dnd5ePluginFeatureDefinition(feature.featureId))!==feature.signature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.featureId)))throw Error('tempestuous-before-owner:current-native-source-required')
 return row
}
/** A mechanical transcript of actual Session owner decisions, not an owner-auth,
 * raw-roll, original-parent, Room book or world-publication authorization. */
export function captureDnd5eTempestuousBeforeSpellOriginalOperation(result:object):Dnd5eTempestuousBeforeSpellOriginalOperation{
 const row=currentTempestuousBeforeOwnerRow(actualTempestuousBeforeOwnerBoundaries.get(result)),operation:Dnd5eTempestuousBeforeSpellOriginalOperation=Object.freeze({kind:'tempestuous-before-spell-original-operation'});actualTempestuousBeforeOwnerOperations.set(operation,row);return operation
}
export function readDnd5eTempestuousBeforeSpellOriginalOperation(operation:Dnd5eTempestuousBeforeSpellOriginalOperation){
 const row=currentTempestuousBeforeOwnerRow(actualTempestuousBeforeOwnerOperations.get(operation));return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,frame:structuredClone(row.frame),snapshot:structuredClone(row.snapshot),effectTimestamp:row.effectTimestamp,records:structuredClone(row.records)}
}

interface TempestuousBeforeClockContext{parentId:string;effectTimestamp:number;run:<T>(resolve:()=>T)=>T;visit:(frame:Readonly<TempestuousBeforeSpellOfferFrame>,state:Dnd5eHeadlessCombatState)=>TempestuousBeforeSpellOfferChoice|undefined;seen:boolean;cancel?:()=>void;attachCancel:(cancel:()=>void)=>void}
type TempestuousBeforeClockScope={operation:Dnd5eTempestuousBeforeSpellOriginalOperation;facts:ReturnType<typeof readDnd5eTempestuousBeforeSpellOriginalOperation>;choice?:TempestuousBeforeSpellOfferChoice;used:boolean;visits:number;sessions:Set<TempestuousBeforeClockContext>}
let activeTempestuousBeforeClock:TempestuousBeforeClockScope|undefined
/** Mechanical original-clock continuity only. The real Native factory and its
 * actual before-offer must both consume this scope; source wire stays plain. */
export function withDnd5eTempestuousBeforeOriginalClock<T>(operation:Dnd5eTempestuousBeforeSpellOriginalOperation,choice:TempestuousBeforeSpellOfferChoice|undefined,run:()=>T):T{
 const facts=readDnd5eTempestuousBeforeSpellOriginalOperation(operation);if(facts.records.length||choice&&!isTempestuousBeforeSpellOfferChoice(facts.frame,choice))throw Error('tempestuous-native-clock:actual-initial-owner-input-required')
 if(run.constructor.name==='AsyncFunction')throw Error('tempestuous-native-clock:sync-only')
 const previous=activeTempestuousBeforeClock,scope:TempestuousBeforeClockScope={operation,facts,choice:choice&&structuredClone(choice),used:false,visits:0,sessions:new Set()};activeTempestuousBeforeClock=scope
 try{const result=run();if(result&&typeof(result as{then?:unknown}).then==='function')throw Error('tempestuous-native-clock:sync-only');if(!scope.used)throw Error('tempestuous-native-clock:actual-prefix-not-reached');for(const session of scope.sessions)if(!session.seen)session.cancel?.();return result}catch(error){for(const session of scope.sessions)session.cancel?.();throw error}finally{activeTempestuousBeforeClock=previous}
}
/** Observation only; only a real Native before-offer visit increments it. */
export function readDnd5eActiveTempestuousBeforeOriginalVisits(operation:Dnd5eTempestuousBeforeSpellOriginalOperation):number{
 const scope=activeTempestuousBeforeClock;if(!scope||scope.operation!==operation)throw Error('tempestuous-native-clock:exact-active-original-required')
 readDnd5eTempestuousBeforeSpellOriginalOperation(operation);return scope.visits
}
function scopedTempestuousBeforeClock(input:object,resolve:unknown):TempestuousBeforeClockContext|undefined{
 const scope=activeTempestuousBeforeClock;if(!scope)return
 const source=scope.facts.input as Record<string,unknown>,candidate=input as Record<string,unknown>;if(scope.facts.resolve!==resolve||JSON.stringify(candidate.prepared)!==JSON.stringify(source.prepared))return
 for(const[key,value]of Object.entries(source))if(!['prepared','effectRolls','hostOriginalD20Replay'].includes(key)&&!stormSame(candidate[key],value))return
 if(Array.isArray(source.effectRolls)&&source.effectRolls.length&&!stormSame(candidate.effectRolls,source.effectRolls))return
 const clock=(candidate.hostOriginalD20Replay as{effectTimestamp?:number}|undefined)?.effectTimestamp;if(clock!==undefined&&clock!==scope.facts.effectTimestamp)throw Error('tempestuous-native-clock:changed-original-clock')
 const context:TempestuousBeforeClockContext={parentId:scope.facts.frame.parentId,effectTimestamp:scope.facts.effectTimestamp,seen:false,run:resolve=>withDnd5eActualTempestuousPreparedReplay(source.prepared as object,()=>withTempestuousBeforeSpellOffers(context.parentId,context.visit,resolve)),visit(frame,state){readDnd5eTempestuousBeforeSpellOriginalOperation(scope.operation);if(JSON.stringify(frame)!==JSON.stringify(scope.facts.frame)||JSON.stringify(state)!==JSON.stringify(scope.facts.snapshot))throw Error('tempestuous-native-clock:changed-actual-prefix');scope.used=true;scope.visits++;context.seen=true;return scope.choice&&structuredClone(scope.choice)},attachCancel:cancel=>{context.cancel=cancel}};scope.sessions.add(context);return context
}

type ActualTempestuousAfterPending=Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-tempestuous-after-spell'}>
type ActualTempestuousAfterRow={input:object;resolve:unknown;result:ActualTempestuousAfterPending;signature:string;inputSignature:string;live:boolean;features:readonly{featureId:string;signature:string}[]}
const actualTempestuousAfterNative=new WeakMap<object,string>(),actualTempestuousAfterBoundaries=new WeakMap<object,ActualTempestuousAfterRow>(),actualTempestuousAfterOperations=new WeakMap<object,ActualTempestuousAfterRow>()
/** This issuer is module-private and called only by the native Session catch. */
function markActualTempestuousAfterPending<T extends ActualTempestuousAfterPending>(result:T):T{actualTempestuousAfterNative.set(result,JSON.stringify(result));return result}
function bindActualTempestuousAfterCastSession<S extends{run:(state:Dnd5eHeadlessCombatState)=>Dnd5eDamageCommitSessionResult<unknown>}>(session:S,input:object,resolve:unknown):S{
 const wrapped={...session},inputSignature=JSON.stringify(input);let active:ActualTempestuousAfterRow|undefined
 for(const key of Object.keys(session)){const method=Object.getOwnPropertyDescriptor(session,key)?.value as unknown;if(typeof method!=='function'||key!=='run'&&key!=='cancel'&&!key.startsWith('resume'))continue
 Object.defineProperty(wrapped,key,{enumerable:true,configurable:true,writable:true,value:(...args:unknown[])=>{const result=Reflect.apply(method,session,args)as Dnd5eDamageCommitSessionResult<unknown>|undefined;
 if(key==='cancel'||result?.status==='resolved'||result?.status==='rejected'){if(active)active.live=false}
 if(result?.status==='pending-tempestuous-after-spell'){if(actualTempestuousAfterNative.get(result)!==JSON.stringify(result))throw Error('tempestuous-after-original:actual-native-pending-required');if(active)active.live=false;active={input,resolve,result,signature:JSON.stringify(result),inputSignature,live:true,features:result.frame.options.map(option=>({featureId:option.featureId,signature:JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId))}))};actualTempestuousAfterBoundaries.set(result,active)}return result}})
 }return wrapped as S
}
export interface Dnd5eTempestuousAfterSpellOriginalOperation{readonly kind:'tempestuous-after-spell-original-operation'}
function currentTempestuousAfterOriginal(row:ActualTempestuousAfterRow|undefined){
 if(!row||!row.live||row.signature!==actualTempestuousAfterNative.get(row.result)||row.signature!==JSON.stringify(row.result)||row.inputSignature!==JSON.stringify(row.input))throw Error('tempestuous-after-original:actual-live-unchanged-boundary-required')
 if(!Number.isSafeInteger(row.result.effectTimestamp)||row.result.effectTimestamp<=0||row.features.some(feature=>JSON.stringify(dnd5ePluginFeatureDefinition(feature.featureId))!==feature.signature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.featureId)))throw Error('tempestuous-after-original:actual-current-source-required')
 return row
}
/** Mechanical provenance only; this is not an owner answer, raw or world permission. */
export function captureDnd5eTempestuousAfterSpellOriginalOperation(result:object):Dnd5eTempestuousAfterSpellOriginalOperation{const row=currentTempestuousAfterOriginal(actualTempestuousAfterBoundaries.get(result)),operation:Dnd5eTempestuousAfterSpellOriginalOperation=Object.freeze({kind:'tempestuous-after-spell-original-operation'});actualTempestuousAfterOperations.set(operation,row);return operation}
export function readDnd5eTempestuousAfterSpellOriginalOperation(operation:Dnd5eTempestuousAfterSpellOriginalOperation){const row=currentTempestuousAfterOriginal(actualTempestuousAfterOperations.get(operation));return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,frame:structuredClone(row.result.frame),snapshot:structuredClone(row.result.snapshot),effectTimestamp:row.result.effectTimestamp}}

type ActualStormFuryPending=Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-storm-fury-owner'|'pending-storm-fury-saving'|'pending-storm-fury-push'}>
type ActualStormFuryRow={input:object;resolve:unknown;canonicalMoveCurrent?:()=>boolean;result:ActualStormFuryPending;signature:string;inputSignature:string;live:boolean;features:readonly{featureId:string;signature:string}[]}
const actualStormFuryNative=new WeakMap<object,string>(),actualStormFuryBoundaries=new WeakMap<object,ActualStormFuryRow>(),actualStormFuryOperations=new WeakMap<object,ActualStormFuryRow>()
function markActualStormFuryPending<T extends ActualStormFuryPending>(result:T):T{actualStormFuryNative.set(result,JSON.stringify(result));return result}
function furyPending(result:Dnd5eDamageCommitSessionResult<unknown>|undefined):result is ActualStormFuryPending{return result?.status==='pending-storm-fury-owner'||result?.status==='pending-storm-fury-saving'||result?.status==='pending-storm-fury-push'}
function bindActualStormFurySession<S extends{run:(state:Dnd5eHeadlessCombatState)=>Dnd5eDamageCommitSessionResult<unknown>}>(session:S,input:object,resolve:unknown,canonicalMoveCurrent?:()=>boolean):S{
 const wrapped={...session},inputSignature=JSON.stringify(input);let active:ActualStormFuryRow|undefined
 for(const key of Object.keys(session)){const method=Object.getOwnPropertyDescriptor(session,key)?.value as unknown;if(typeof method!=='function'||key!=='run'&&key!=='cancel'&&!key.startsWith('resume'))continue
  Object.defineProperty(wrapped,key,{enumerable:true,configurable:true,writable:true,value:(...args:unknown[])=>{if(active)active.live=false;const result=Reflect.apply(method,session,args)as Dnd5eDamageCommitSessionResult<unknown>|undefined
   if(furyPending(result)){if(actualStormFuryNative.get(result)!==JSON.stringify(result))throw Error('storm-fury-original:actual-native-pending-required');const frame='frame'in result?result.frame:result.request.frame;active={input,resolve,result,signature:JSON.stringify(result),inputSignature,live:true,features:frame.options.map(option=>({featureId:option.featureId,signature:JSON.stringify(dnd5ePluginFeatureDefinition(option.featureId))})),...(canonicalMoveCurrent?{canonicalMoveCurrent}:{})};actualStormFuryBoundaries.set(result,active)}return result}})
 }return wrapped as S
}
export interface Dnd5eStormFuryOriginalOperation{readonly kind:'storm-fury-original-operation'}
function currentStormFuryOriginal(row:ActualStormFuryRow|undefined){
 if(!row||!row.live||row.signature!==actualStormFuryNative.get(row.result)||row.signature!==JSON.stringify(row.result)||row.inputSignature!==JSON.stringify(row.input))throw Error('storm-fury-original:actual-live-unchanged-boundary-required')
 if(row.resolve===furyCanonicalMoveResolver&&!row.canonicalMoveCurrent?.())throw Error('storm-fury-move:actual-current-preparer-required')
 if(!isActualStormFuryCanonicalResolver(row.resolve)||!Number.isSafeInteger(row.result.effectTimestamp)||row.result.effectTimestamp<=0||!row.result.parentId||row.features.some(feature=>JSON.stringify(dnd5ePluginFeatureDefinition(feature.featureId))!==feature.signature||!dnd5ePluginFeatureCurrentEnvelopeFullV1(feature.featureId)))throw Error('storm-fury-original:actual-current-source-required')
 return row
}
/** Genuine canonical Native provenance only. No owner, raw, Room, or world grant. */
export function captureDnd5eStormFuryOriginalOperation(result:object):Dnd5eStormFuryOriginalOperation{const row=currentStormFuryOriginal(actualStormFuryBoundaries.get(result)),operation:Dnd5eStormFuryOriginalOperation=Object.freeze({kind:'storm-fury-original-operation'});actualStormFuryOperations.set(operation,row);return operation}
export function readDnd5eStormFuryOriginalOperation(operation:Dnd5eStormFuryOriginalOperation){const row=currentStormFuryOriginal(actualStormFuryOperations.get(operation));return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,result:structuredClone(row.result)}}

/** Exact Native identities; this predicate supplies no Room or publication authority. */
function isActualStormFuryCanonicalResolver(resolve:unknown){return resolve===furyCanonicalMonsterResolver||resolve===tempestuousCanonicalSpellResolver||resolve===furyCanonicalEquipmentResolver||resolve===furyCanonicalOpportunityResolver||resolve===furyCanonicalMoveResolver}

type FuryMoveClock={parentId:string;effectTimestamp:number;current:()=>boolean;acceptsFrame:(frame:StormFuryHitFrame)=>boolean}
function actualFuryMoveClock(input:unknown,parent?:string):FuryMoveClock{
 if(!input||typeof input!=='object'||!('prepared'in input)||!input.prepared||typeof input.prepared!=='object'||!dnd5eActualOpportunityMovePreparationCurrent(input.prepared))throw Error('storm-fury-move:actual-current-preparer-required')
 const prepared=input.prepared as Parameters<typeof furyCanonicalMoveResolver>[0]['prepared'],parentId=prepared.action.id,effectTimestamp=prepared.input.firstHostNow,signature=JSON.stringify(input)
 if(!parentId||parent!==undefined&&parent!==parentId||!Number.isSafeInteger(effectTimestamp)||effectTimestamp<=0)throw Error('storm-fury-move:exact-original-parent-clock-required')
 return{parentId,effectTimestamp,current:()=>JSON.stringify(input)===signature&&dnd5eActualOpportunityMovePreparationCurrent(prepared),acceptsFrame:frame=>stormFuryMovePrefixAcceptsFrame(input,frame)}
}

export interface Dnd5eTempestuousLandingOriginalOperation{readonly kind:'tempestuous-landing-original-operation'}
type ActualTempestuousLandingRow={input:object;resolve:unknown;inputSignature:string;result:Extract<Dnd5eDamageCommitSessionResult<unknown>,{status:'pending-tempestuous-landing-dice'}>;signature:string;nativeOperation:object;live:boolean;owner?:TempestuousLandingOwnerFacts}
const actualTempestuousLandingBoundaries=new WeakMap<object,ActualTempestuousLandingRow>(),actualTempestuousLandingOperations=new WeakMap<object,ActualTempestuousLandingRow>()
function currentTempestuousLanding(row:ActualTempestuousLandingRow|undefined){if(!row||!row.live||row.resolve!==tempestuousCanonicalSpellResolver||row.inputSignature!==JSON.stringify(row.input)||row.signature!==JSON.stringify(row.result))throw Error('tempestuous-landing-original:actual-live-unchanged-canonical-required');const native=readDnd5eActualTempestuousLandingOperation(row.nativeOperation);if(JSON.stringify(native.frame)!==JSON.stringify(row.result.frame)||JSON.stringify(native.snapshot)!==JSON.stringify(row.result.snapshot)||!Number.isSafeInteger(row.result.effectTimestamp)||row.result.effectTimestamp<=0)throw Error('tempestuous-landing-original:actual-native-frame-required');return{row,native}}
function bindActualTempestuousLandingSession<S extends{run:(state:Dnd5eHeadlessCombatState)=>Dnd5eDamageCommitSessionResult<unknown>}>(session:S,input:object,resolve:unknown):S{const wrapped=Object.create(Object.getPrototypeOf(session),Object.getOwnPropertyDescriptors(session))as S,inputSignature=JSON.stringify(input);let active:ActualTempestuousLandingRow|undefined;for(const key of Object.keys(session)){const method=Object.getOwnPropertyDescriptor(session,key)?.value as unknown;if(typeof method!=='function'||key!=='run'&&key!=='cancel'&&!key.startsWith('resume'))continue;Object.defineProperty(wrapped,key,{enumerable:true,configurable:true,writable:true,value:(...args:unknown[])=>{if(active)active.live=false;const result=Reflect.apply(method,session,args)as Dnd5eDamageCommitSessionResult<unknown>|undefined;if(result?.status==='pending-tempestuous-landing-dice'){const actual=actualTempestuousLandingNative.get(result);if(!actual||actual.signature!==JSON.stringify(result)||resolve!==tempestuousCanonicalSpellResolver)throw Error('tempestuous-landing-original:actual-canonical-native-pending-required');active={input,resolve,inputSignature,result,signature:JSON.stringify(result),nativeOperation:actual.nativeOperation,live:true,owner:actual.owner&&structuredClone(actual.owner)};currentTempestuousLanding(active);actualTempestuousLandingBoundaries.set(result,active)}return result}})}return wrapped as S}
/** Read-only genuine missing-landing provenance. This grants no raw or World permission. */
export function captureDnd5eTempestuousLandingOriginalOperation(result:object):Dnd5eTempestuousLandingOriginalOperation{const{row}=currentTempestuousLanding(actualTempestuousLandingBoundaries.get(result)),operation:Dnd5eTempestuousLandingOriginalOperation=Object.freeze({kind:'tempestuous-landing-original-operation'});actualTempestuousLandingOperations.set(operation,row);return operation}
export function readDnd5eTempestuousLandingOriginalOperation(operation:Dnd5eTempestuousLandingOriginalOperation){const{row,native}=currentTempestuousLanding(actualTempestuousLandingOperations.get(operation));return{input:cloneDnd5eHostTransactionInput(row.input),resolve:row.resolve,nativeOperation:row.nativeOperation,frame:structuredClone(native.frame),snapshot:structuredClone(native.snapshot),effectTimestamp:row.result.effectTimestamp,owner:row.owner&&structuredClone(row.owner)}}
