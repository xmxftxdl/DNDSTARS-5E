import{readPostNativeActivitySettlementForStage,type PostNativeActivityStage}from'./postNativeActivityParent'
import type{settleBountifulOpportunityPostNativePrefix}from'../../rulesets/dnd5e/bountifulOpportunityMoveAck'
import{copyDnd5eOrdinaryWeaponScene}from'../../rulesets/dnd5e/ordinaryWeaponScene'
import{readCapturedDnd5eOpportunitySequenceMovementCheckpoint,resolveDnd5eOpportunityMoveSequenceOriginal}from'../../rulesets/dnd5e/opportunityMoveSequence'
import{readBountifulOpportunitySequenceMovementOriginalReplay,withBountifulOpportunitySequencePostNativeReplay}from'../../rulesets/dnd5e/bountifulOpportunitySequencePostNativeReplay'
import{readDnd5eActualOriginalReadyBoundary}from'../../rulesets/dnd5e/damageCommitSession'
import{withOriginalD20Preview}from'../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import{encodeSecondChanceParentWire}from'../../lib/secondChanceParentWire'
import{cloneDnd5eHostTransactionInput}from'../../rulesets/dnd5e/hostTransactionClone'
import{getRoomSession}from'../../lib/roomSession'
import{withDnd5eOriginalD20ReadyTailStop,withDnd5eOriginalD20ReadyObserver}from'../../rulesets/dnd5e/allyNaturalOneCheckpoint'
import { type BountifulNativeDiceRoute } from "../../rulesets/dnd5e/bountifulHostOperation";
import { type Dnd5eSpellDamageDieRerollUse, type Dnd5eSpellDamageDiceGroup } from "../../rulesets/dnd5e/spellDamageDieRerolls";
import type {Dnd5eActionResult,Dnd5eCombatEvent,Dnd5eMapResultPlan,Dnd5eCombatant,Dnd5eHeadlessCombatState,Dnd5eOpeningAttackSavingThrowRoll,Dnd5eSpellDamageMaxDieBonusUse,Dnd5eDamageType,Dnd5eAction,Dnd5eUnsupportedAirborneFallPreview,Dnd5eActiveEffectSavingThrowRoll,Dnd5eOptionalBonusDieUse,Dnd5ePersistentAreaDmAdjustment,Dnd5ePersistentAreaTriggerCandidate,PreparedDnd5ePersistentAreaTrigger,PreparedDnd5eOpeningAttackSavingThrow} from '../../application/combat/dnd5eCombatRules'
import {createDnd5eMapCombatSnapshot,planDnd5eMapResultApplication} from '../../rulesets/dnd5e/mapBridge'
import {dnd5eSavingThrowRerollFeature,dnd5eCanActAtZeroHitPoints,previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,resolveDnd5eHeadlessAction,resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange,observeCommittedDnd5ePersistentAreaTrigger} from '../../rulesets/dnd5e/headlessCombatEngine'
import {dnd5eSavingThrowMode} from '../../rulesets/dnd5e/passiveDefenses'
import {dnd5eConditionLabel} from '../../rulesets/dnd5e/conditions'
import {getDnd5eSrdMonster} from '../../rulesets/dnd5e/monsters'
import {reconcileDnd5ePluginAreasOnMap,reconcileDnd5ePluginAreasAfterSourceMove,collectDnd5ePersistentAreaTriggers,collectDnd5ePersistentAreaTriggersForSourceMove,dnd5eFailedAreaMovementCheckpoint,dnd5ePersistentAreaTriggerTimingIsSimultaneousWave} from '../../rulesets/dnd5e/pluginAreas'
import {createDnd5ePersistentAreaDamageRollCoordinator,createDnd5ePersistentAreaWillingFailureCoordinator,createDnd5ePersistentAreaCapacityCoordinator,collectDnd5ePersistentAreaSavingThrowWaveResults,dnd5ePersistentAreaDamageWaveKey,prepareDnd5ePersistentAreaTrigger,dnd5ePersistentAreaFlightCapableTokenIds,dnd5ePersistentAreaSizeRanks,resolvePreparedDnd5ePersistentAreaTrigger} from '../../rulesets/dnd5e/pluginAreaTransactions'
import {dnd5eItemAreasEnteredByMove,markDnd5eHuntingTrapTriggered} from '../../rulesets/dnd5e/itemAreas'
import { type ActivityMovementChoice } from "../../lib/activityMovementChoice";
import { type ActivityAreaAim, type ActivityAreaChoice } from "../../lib/activityAreaChoice";
import { dnd5ePersistentAreaRemainingTargetBudget } from "../../rulesets/dnd5e/persistentAreaTriggerBudget";
import { truncateTokenMovementTrace } from "../../lib/tokenMovementAnimation";
import { settleDnd5eSolidMaterialExit, dnd5eLostSolidMaterialTraversal } from "../../rulesets/dnd5e/solidMaterialExitSettlement";
import { settleStrongWindFlamesAlongMovement } from "../../rulesets/dnd5e/strongWindFlameMovement";
import { type PluginChoiceField } from "../../lib/pluginChoiceFields";
import { captureActivityPlacementAuthority } from "../../presentation/maps/activityPlacementAuthority";
import { resolveDnd5ePreparedWithDamageReactions,resolveDnd5ePreparedWithMaterialDamageReactions, type Dnd5eDamageReactionMapContext, type Dnd5eDamageReactionFlowOptions } from "../../rulesets/dnd5e/damageReactionFlow";
import { persistentAreaNeedsDmApproval } from "../../rulesets/dnd5e/persistentAreaApproval";
import {browserRuntime} from '../../adapters/browser/browserRuntime'
const runtimeNow=browserRuntime.now
import { type DiceCheckPreview } from "../../presentation/maps/diceCheckOutcome";
import { type InitiativeEntry } from "../../components/map/InitiativeTracker";
import { dnd5ePersistentAreaNotificationLogSuffix } from "./combatLogPresentation";
import { projectDnd5ePersistentAreaActionConsumption } from "./persistentAreaTurnBoundary";
import { useMapStore, type BattleMap, type Token } from "../../store/maps";
import { useMapGeometryStore } from "../../store/mapGeometry";
import { useCharacterStore } from "../../store/characters";
import { readBrowserSceneWorldMinute } from "../../composition/browserSceneClock";
import { coordinateDnd5eMovementHazards } from "../../application/maps/MovementHazardCoordinator";
import { coordinateForcedMovementPersistentAreas } from "../../application/maps/ForcedMovementPersistentAreaCoordinator";
import type { Character } from "../../types/character";
import type { D20RollMode } from "../../rulesets/contracts";
import { mapGeometryRuntimeForMap, mapGeometryTerrainElevationAtPoint } from "../../lib/mapGeometry";
import { publishSavingThrowPresentation } from "../../lib/combatPresentation";
import { dnd5eSpellResolutionInitiativeOrder } from "./spellSettlementCoordinator";
import { ABILITIES, type AbilityKey } from "../../lib/dnd";
import { type BardicInspirationRollType, type DmAdjudicationInterruptResponse } from "../../lib/combatInterruptProtocol";
import { tokenCenterForAnchorCell, type GridCell } from "../../lib/gridCombat";
import type { Dnd5eTurnEconomyCounts } from "../../lib/sharedCombatTypes";
import { bindDnd5eMovementConcentrationOriginals, readDnd5eCompletedCombatBase, settleDnd5eConcentrationChecks as settleDnd5eConcentrationChecksBase, type Dnd5eSequenceConcentrationOriginal } from "./settleDnd5eCombatResult";
import { type Dnd5eOptionalBonusDieInterruptRequest } from "./dnd5eRollInterruptPipeline";

type OpeningAttackSaveResourceUsage = {
    bardicInspirationTargetIds: Set<string>
    darkOnesOwnLuckByTargetId: Record<string, number>
    rerollsByTargetAndResource: Record<string, number>
    legendaryResistanceByTargetId: Record<string, number>
  }

export interface Dnd5eMovementHazardsProducerContext {
  requestOptionalDamageSave: NonNullable<Parameters<typeof settleDnd5eConcentrationChecksBase>[0]['requestOptionalDamageSave']>
  rollDiceBoxValues: (count: number, sides: number, label: string, targetName: string, options?: { durableRollRequestId?: string; onRollId?: (id: string) => void; checkPreview?: DiceCheckPreview; freeRoll?: boolean; broadcast?: boolean; forcePublic?: boolean; skipDmConfirmation?: boolean; rollerTokenId?: string; rollerCharacterId?: string; bountifulNativeDiceRoute?: BountifulNativeDiceRoute; d20RollKind?: "attack" | "ability-check" | "saving-throw"; d20RollMode?: D20RollMode; attackAbility?: AbilityKey; skipChoiceReroll?: boolean; } | undefined) => Promise<number[]>
  requestDnd5ePersistentAreaWillingFailure: (prepared: Extract<ReturnType<typeof prepareDnd5ePersistentAreaTrigger>, { ok: true; }>["prepared"]) => Promise<boolean>
  combatActiveRef: import("react").RefObject<boolean>
  initiativeOrderRef: import("react").RefObject<InitiativeEntry[]>
  combatIdRef: import("react").RefObject<string>
  rollDnd5eMapSavingThrowInterrupts: (input: { sourceActorId?: string; pendingNegationRolls?: readonly Dnd5eActiveEffectSavingThrowRoll[]; negationContext?: { mapId: string; transactionId: string; effectId: string; }; state: Dnd5eHeadlessCombatState; combatant: Dnd5eCombatant; target?: Character; targetName: string; ability: AbilityKey; dc: number; mode: "normal" | "advantage" | "disadvantage"; label: string; usedOptionalBonusDice?: readonly Dnd5eOptionalBonusDieUse[]; }) => Promise<{ disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; }>
  requestSharedChoiceWindow: (input: { id: string; transactionId: string; mapId?: string; actor?: Pick<Character, "id">; actorCharId?: string; targetCharId?: string; pluginId: string; featureId: string; featureName: string; prompt: string; audience: "actor" | "target" | "dm"; options: Array<{ id: string; label: string; description?: string; }>; defaultOptionId: string; timeoutMs?: number; phase?: "before-action" | "before-hit" | "before-damage" | "after-save" | "before-condition"; context?: Record<string, unknown>; fields?: PluginChoiceField[]; onFieldValues?: (values: Record<string, string>) => void; movementChoice?: ActivityMovementChoice; onMovementCell?: (cell: GridCell) => void; areaChoice?: ActivityAreaChoice; onAreaAim?: (aim: ActivityAreaAim) => void; }) => Promise<string | undefined>
  collectDnd5ePersistentAreaRolls: (input: { prepared: Extract<ReturnType<typeof prepareDnd5ePersistentAreaTrigger>, { ok: true; }>; sourceConsent?: boolean; chooseWillingAreaFailure: ReturnType<typeof createDnd5ePersistentAreaWillingFailureCoordinator>; persistentAreaDamageRolls: ReturnType<typeof createDnd5ePersistentAreaDamageRollCoordinator>; primedSavingThrow?: Awaited<ReturnType<(input: { sourceActorId?: string; pendingNegationRolls?: readonly Dnd5eActiveEffectSavingThrowRoll[]; negationContext?: { mapId: string; transactionId: string; effectId: string; }; state: Dnd5eHeadlessCombatState; combatant: Dnd5eCombatant; target?: Character; targetName: string; ability: AbilityKey; dc: number; mode: "normal" | "advantage" | "disadvantage"; label: string; usedOptionalBonusDice?: readonly Dnd5eOptionalBonusDieUse[]; }) => Promise<{ disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; }>>>; }) => Promise<{ rollInput: { spellDamageDieRerolls: readonly Dnd5eSpellDamageDieRerollUse[]; conditionSave: { optionalBonusDice: Dnd5eOptionalBonusDieUse[] | undefined; disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; } | undefined; damageRolls: readonly number[] | undefined; healingRolls: number[] | undefined; spellDamageMaxDieBonus: Dnd5eSpellDamageMaxDieBonusUse | undefined; disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; sourceConsent: boolean | undefined; willingFailure: boolean; d20: number | undefined; d20Second: number | undefined; halflingLuckyD20: number | undefined; halflingLuckyD20Second: number | undefined; blessRoll: number | undefined; baneRoll: number | undefined; rerollResourceKey: string | undefined; rerollD20: number | undefined; rerollD20Second: number | undefined; bardicInspirationRoll: number | undefined; darkOnesOwnLuckRoll: number | undefined; optionalBonusDice: Dnd5eOptionalBonusDieUse[] | undefined; }; interrupted: { disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; } | undefined; savingThrowPresentationId: string | undefined; }>
  requestSharedPersistentAreaAdjudication: (input: { prepared: PreparedDnd5ePersistentAreaTrigger; proposedDamage?: number; proposedDamageOnSaveSuccess?: number; proposedDamageOnSaveFailure?: number; proposedDamageType?: Dnd5eDamageType; proposedSaveSuccess?: boolean; proposedConditionIds: string[]; }) => Promise<DmAdjudicationInterruptResponse>
  roundRef: import("react").RefObject<number>
  initiativeIndexRef: import("react").RefObject<number>
  rollTempleEntryEffectDice: import("../../rulesets/dnd5e/templeEntryEffectDice").TempleEntryEffectDiceRoller
  rollOpeningAttackSavingThrow: (input: { requirement?: PreparedDnd5eOpeningAttackSavingThrow; sourceActorId?: string; state: Dnd5eHeadlessCombatState; map: BattleMap; characters: readonly Character[]; target: Dnd5eCombatant; targetToken: Token; effectName?: string; resourceUsage?: { bardicInspirationTargetIds: Set<string>; darkOnesOwnLuckByTargetId: Record<string, number>; rerollsByTargetAndResource: Record<string, number>; legendaryResistanceByTargetId: Record<string, number>; }; }) => Promise<Dnd5eOpeningAttackSavingThrowRoll | undefined>
  publishDnd5ePersistentAreaSaveResult: (input: { prepared: Extract<ReturnType<typeof prepareDnd5ePersistentAreaTrigger>, { ok: true; }>["prepared"]; events: readonly Dnd5eCombatEvent[]; interrupted: Awaited<ReturnType<(input: { prepared: Extract<ReturnType<typeof prepareDnd5ePersistentAreaTrigger>, { ok: true; }>; sourceConsent?: boolean; chooseWillingAreaFailure: ReturnType<typeof createDnd5ePersistentAreaWillingFailureCoordinator>; persistentAreaDamageRolls: ReturnType<typeof createDnd5ePersistentAreaDamageRollCoordinator>; primedSavingThrow?: Awaited<ReturnType<(input: { sourceActorId?: string; pendingNegationRolls?: readonly Dnd5eActiveEffectSavingThrowRoll[]; negationContext?: { mapId: string; transactionId: string; effectId: string; }; state: Dnd5eHeadlessCombatState; combatant: Dnd5eCombatant; target?: Character; targetName: string; ability: AbilityKey; dc: number; mode: "normal" | "advantage" | "disadvantage"; label: string; usedOptionalBonusDice?: readonly Dnd5eOptionalBonusDieUse[]; }) => Promise<{ disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; }>>>; }) => Promise<{ rollInput: { spellDamageDieRerolls: readonly Dnd5eSpellDamageDieRerollUse[]; conditionSave: { optionalBonusDice: Dnd5eOptionalBonusDieUse[] | undefined; disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; } | undefined; damageRolls: readonly number[] | undefined; healingRolls: number[] | undefined; spellDamageMaxDieBonus: Dnd5eSpellDamageMaxDieBonusUse | undefined; disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; sourceConsent: boolean | undefined; willingFailure: boolean; d20: number | undefined; d20Second: number | undefined; halflingLuckyD20: number | undefined; halflingLuckyD20Second: number | undefined; blessRoll: number | undefined; baneRoll: number | undefined; rerollResourceKey: string | undefined; rerollD20: number | undefined; rerollD20Second: number | undefined; bardicInspirationRoll: number | undefined; darkOnesOwnLuckRoll: number | undefined; optionalBonusDice: Dnd5eOptionalBonusDieUse[] | undefined; }; interrupted: { disadvantageNegationChoice: { featureId: string; rollId: string; transactionId: string; contextId: string; } | undefined; effectiveD20: number; effectiveD20Second?: number; d20: number; d20Second?: number; halflingLuckyD20?: number; halflingLuckyD20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; optionalBonusDieUse?: Dnd5eOptionalBonusDieUse; darkOnesOwnLuckRoll?: number; rerollResourceKey?: string; rerollD20?: number; rerollD20Second?: number; totalBeforeReroll: number; successBeforeReroll: boolean; success: boolean; } | undefined; savingThrowPresentationId: string | undefined; }>>>["interrupted"]; savingThrowPresentationId?: string; }) => Promise<void>
  settleDnd5eConcentrationChecks: (input: Parameters<typeof settleDnd5eConcentrationChecksBase>[0]) => Promise<{ result: Extract<Dnd5eActionResult, { ok: true; }>; application: Dnd5eMapResultPlan; }>
  rollDnd5eUnsupportedAirborneFalls: (falls: readonly Dnd5eUnsupportedAirborneFallPreview[], map: BattleMap) => Promise<Readonly<Record<string, readonly number[]>>>
  settleDnd5eMapMountedBalance: (prepared: { state: Dnd5eHeadlessCombatState; map: BattleMap; characters: readonly Character[]; characterIdByCombatantId: Record<string, string>; }, result: import("../../application/combat/dnd5eCombatRules").Dnd5eActionResult) => Promise<{ result: Dnd5eActionResult; application?: undefined; } | { result: Dnd5eActionResult; application: Dnd5eMapResultPlan | undefined; }>
  rollDiceBoxD20: (label: string, targetName: string, context?: { durableRollRequestId?: string; onRollId?: (id: string) => void; skipDmConfirmation?: boolean; checkPreview?: DiceCheckPreview; rollKind?: "attack" | "ability-check" | "saving-throw"; rollerTokenId?: string; rollerCharacterId?: string; targetCharacterId?: string; bountifulNativeDiceRoute?: BountifulNativeDiceRoute; skipChoiceReroll?: boolean; existingRollMode?: D20RollMode; attackAbility?: AbilityKey; } | undefined) => Promise<number>
  requestSharedHellishRebukeChoice: (input: { reactor: Character; reactorTokenId: string; targetTokenId: string; sourceName: string; damage: number; slotLevel: number; itemName?: string; racialInnate?: boolean; }) => Promise<boolean>
  collectSharedSpellDamageDieChoices: (input: { transactionId: string; actor: Dnd5eHeadlessCombatState["combatants"][string]; character?: Character; spellName: string; groups: readonly Dnd5eSpellDamageDiceGroup[]; }) => Promise<readonly Dnd5eSpellDamageDieRerollUse[]>
  requestDnd5eSavingThrowRerollDice: (input: { target: Character; targetName: string; featureName: string; total: number; dc: number; mode: "normal" | "advantage" | "disadvantage"; usedRerollResourceKeys?: readonly string[]; }) => Promise<{ d20: number; d20Second?: number; resourceKey?: string; } | undefined>
  requestDnd5eBardicInspirationRoll: (input: { target?: Character; targetName: string; dieSides: number; rollType: BardicInspirationRollType; total: number; targetNumber: number; rollerTokenId?: string; }) => Promise<number | undefined>
  requestDnd5eOptionalBonusDieUse: (input: Dnd5eOptionalBonusDieInterruptRequest) => Promise<Dnd5eOptionalBonusDieUse | undefined>
  requestDnd5eDarkOnesOwnLuckRoll: (input: { target?: Character; targetName: string; rollType: "\u8C41\u514D" | "\u5C5E\u6027\u68C0\u5B9A"; total: number; targetNumber?: number; }) => Promise<number | undefined>
  requestSharedPostSpellRandomTableChoice: (input: { actor: Dnd5eCombatant; tableFeatureId: string; choiceFeatureId: string; tableRolls: readonly number[]; tableDieSides: number; transactionId: string; }) => Promise<number | undefined>
  requestSharedPostSpellRandomTableAdjudication: (input: { actor: Dnd5eCombatant; featureId: string; adjudicationId: string; sourceSpellId: string; tableRoll: number; outcomeId?: string; events: readonly Dnd5eCombatEvent[]; }) => Promise<DmAdjudicationInterruptResponse>
  updateDnd5eTurnEconomy: (tokenId: string, updater: (current: Dnd5eTurnEconomyCounts) => Dnd5eTurnEconomyCounts, turnRound?: number) => Dnd5eTurnEconomyCounts
  rollDiceBoxD20Pair: (label: string, targetName: string, rollMode: D20RollMode, context?: Parameters<(label: string, targetName: string, context?: { durableRollRequestId?: string; onRollId?: (id: string) => void; skipDmConfirmation?: boolean; checkPreview?: DiceCheckPreview; rollKind?: "attack" | "ability-check" | "saving-throw"; rollerTokenId?: string; rollerCharacterId?: string; targetCharacterId?: string; bountifulNativeDiceRoute?: BountifulNativeDiceRoute; skipChoiceReroll?: boolean; existingRollMode?: D20RollMode; attackAbility?: AbilityKey; } | undefined) => Promise<number>>[2], originalBoundary?: (raw: readonly number[], rawRollId: string) => Promise<readonly [number, number | undefined] | undefined>) => Promise<[number, number | undefined]>
  deferNativeLuckyForBountifulOnMap: (actorId: string, kind?: "attack" | "ability-check" | "saving-throw", skill?: string) => boolean
  resolveDnd5eHeadlessActionWithAirborneFalls: (state: Dnd5eHeadlessCombatState, action: Parameters<typeof resolveDnd5eHeadlessAction>[1], map: BattleMap, options: Parameters<typeof resolveDnd5eHeadlessAction>[2] | undefined, materialApplication: Dnd5eDamageReactionMapContext,originalBoundary?:Dnd5eMovementNativeBoundary) => Promise<Dnd5eActionResult & { application?: Dnd5eMapResultPlan; }>
  currentPersistentAreaTurnKey: (liveRound: number, fallbackTokenId: string) => string
  resolveDnd5eForcedFallInterrupts: (state: Dnd5eHeadlessCombatState, falls: readonly Dnd5eUnsupportedAirborneFallPreview[], map: BattleMap, transactionId: string, damageLabel: string) => Promise<{ state: Dnd5eHeadlessCombatState; events: Dnd5eCombatEvent[]; fallingDamageRollsByCombatantId: Readonly<Record<string, readonly number[]>>; }>
  damageReactionOptionsForMap: (map: BattleMap) => Dnd5eDamageReactionFlowOptions
  initiativeOrderForHeadlessState: (state: Dnd5eHeadlessCombatState) => InitiativeEntry[]
}

const issuedMovementProducers = new WeakMap<object, unknown>()
const issuedMovementProducerContexts=new WeakMap<object,Dnd5eMovementHazardsProducerContext>()
type ActualMovementInput=Parameters<Dnd5eMovementHazardsProducer['settleDnd5eMovementHazards']>[0]
type ActualMovementFact=ReturnType<typeof readCapturedDnd5eOpportunitySequenceMovementCheckpoint>
export interface Dnd5eMovementOriginalFrame{readonly actualMovementProducerOriginal:unique symbol}
export interface Dnd5eMovementNativeBoundary{readonly actualMovementNativeBoundary:unique symbol}
type MovementOriginalBinding={events:Dnd5eCombatEvent[];producer:Dnd5eMovementHazardsProducer;input:ActualMovementInput;signature:string;checkpoint:object;fact:ActualMovementFact;roomId:string;memberId:string;unchanged:()=>boolean;resolve:(frame:Dnd5eMovementOriginalFrame)=>Promise<readonly number[]|object|undefined>;resolveFinal?:(frame:Dnd5eMovementOriginalFrame)=>Promise<object>;resolveConcentration?:(checkpoint:object)=>ReturnType<typeof settleDnd5eConcentrationChecksBase>}
const movementOriginalInputs=new WeakMap<object,MovementOriginalBinding>(),issuedMovementOriginalBindings=new WeakSet<MovementOriginalBinding>(),movementOriginalFrames=new WeakMap<object,{binding:MovementOriginalBinding;state:Dnd5eHeadlessCombatState;action:Extract<Dnd5eAction,{type:'item-area-trigger'}>;operationId:string;mode:D20RollMode;stage:'original'|'result';signature:string;ready?:string;retained?:readonly number[];material?:Dnd5eDamageReactionMapContext}>()
let activeMovementOriginal:object|undefined
type MovementNativeOptions=Parameters<typeof resolveDnd5eHeadlessAction>[2]
const movementNativeBoundaries=new WeakMap<object,{raw:object;state:Dnd5eHeadlessCombatState;action:Extract<Dnd5eAction,{type:'item-area-trigger'}>;map:BattleMap;options:MovementNativeOptions;material:Dnd5eDamageReactionMapContext;resolve:Dnd5eMovementHazardsProducerContext['resolveDnd5eHeadlessActionWithAirborneFalls'];signature:string;completed?:boolean}>()
const movementNativeResults=new WeakMap<object,{frame:object;result:Dnd5eActionResult;signature:string}>(),movementMaterialResults=new WeakMap<object,{frame:object;settled:{result:Dnd5eActionResult;application?:Dnd5eMapResultPlan};signature:string}>()
export const dnd5eSequenceMovementOriginalActive=(frame:object)=>movementOriginalFrames.has(frame)&&activeMovementOriginal===frame
const movementOriginalSignature=(value:unknown)=>JSON.stringify(encodeSecondChanceParentWire(value))
const movementReadySignature=(ready:{request:object;snapshot:Dnd5eHeadlessCombatState;events:readonly unknown[]})=>[Object.fromEntries(Object.entries(ready.request).filter(([key])=>key!=='ordinal')),ready.snapshot,ready.events].map(movementOriginalSignature).join('\n')
const movementOriginalMaterial=(input:ActualMovementInput)=>[input.state,input.map,input.characters,input.characterIdByCombatantId,input.movements,input.settleSolidMaterialEndpoint,input.carefulMovementActorId].map(movementOriginalSignature).join('\n')
const movementOriginalPrefix=(fact:ActualMovementFact)=>({prepared:fact.source.prepared,request:fact.request,preceding:fact.preceding,beforeState:fact.beforeState,resolved:fact.resolved,movement:fact.movement})
/** Binds only genuine native movement input to its exact concrete producer.
 * No operation or native result is issued by this binding alone. */
export function bindDnd5eSequenceMovementOriginals(producer:Dnd5eMovementHazardsProducer,input:ActualMovementInput,checkpoint:object,unchanged:()=>boolean,resolve:MovementOriginalBinding['resolve'],resolveFinal?:MovementOriginalBinding['resolveFinal'],resolveConcentration?:MovementOriginalBinding['resolveConcentration']){
 const fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint),host=getRoomSession()
 if(host?.role!=='dm'||!unchanged()||!fact.resolved.result.ok||!fact.resolved.application||issuedMovementProducers.get(producer)!==producer.settleDnd5eMovementHazards)throw Error('movement-original:actual-live-producer-required')
 const expected={state:fact.resolved.result.state,map:fact.movement.map,characters:fact.movement.characters,characterIdByCombatantId:fact.movement.characterIdByCombatantId,movements:fact.movement.movementTraces,settleSolidMaterialEndpoint:true,carefulMovementActorId:fact.request.originalAction.dnd5eCarefulMovement?fact.request.originalAction.actorTokenId:undefined}
 if(Object.keys(expected).some(key=>movementOriginalSignature(input[key as keyof typeof expected])!==movementOriginalSignature(expected[key as keyof typeof expected]))||movementOriginalInputs.has(input))throw Error('movement-original:exact-native-movement-input-required')
 const binding:MovementOriginalBinding={events:[],producer,input,signature:movementOriginalMaterial(input),checkpoint,fact,roomId:host.roomId,memberId:host.memberId,unchanged,resolve,resolveFinal,resolveConcentration};movementOriginalInputs.set(input,binding);issuedMovementOriginalBindings.add(binding)
}
/** Read only actual native events emitted by this exact bound producer invocation. */
export function readDnd5eSequenceMovementOriginalEvents(producer:Dnd5eMovementHazardsProducer,input:ActualMovementInput,checkpoint:object){
 const binding=movementOriginalInputs.get(input),host=getRoomSession(),fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint)
 if(!binding||binding.producer!==producer||binding.checkpoint!==checkpoint||host?.role!=='dm'||host.roomId!==binding.roomId||host.memberId!==binding.memberId||!binding.unchanged()||movementOriginalMaterial(input)!==binding.signature||movementOriginalSignature(movementOriginalPrefix(fact))!==movementOriginalSignature(movementOriginalPrefix(binding.fact)))throw Error('movement-original:actual-issued-event-ledger-required')
 return cloneDnd5eHostTransactionInput(binding.events)
}
type MovementConcentrationRow={binding:MovementOriginalBinding;entryIndex:number;areaId:string;areaKind:Extract<Dnd5eAction,{type:'item-area-trigger'}>['areaKind'];actorId:string;operationId:string;native:Extract<Dnd5eActionResult,{ok:true}>&{application?:Dnd5eMapResultPlan};priorState:Dnd5eHeadlessCombatState;application:Dnd5eMapResultPlan;signature:string}
const movementConcentrationCheckpoints=new WeakMap<object,MovementConcentrationRow>()
const movementConcentrationMaterial=(row:MovementConcentrationRow)=>[row.native,row.priorState,row.application,row.entryIndex,row.areaId,row.areaKind,row.actorId,row.operationId].map(movementOriginalSignature).join('\n')
function movementConcentrationFor(checkpoint:object){const row=movementConcentrationCheckpoints.get(checkpoint),host=getRoomSession();if(!row||host?.role!=='dm'||row.binding.roomId!==host.roomId||row.binding.memberId!==host.memberId||!row.binding.unchanged()||movementOriginalMaterial(row.binding.input)!==row.binding.signature||movementConcentrationMaterial(row)!==row.signature)throw Error('movement-concentration:actual-live-native-item-result-required');const actual=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(row.binding.checkpoint);if(movementOriginalSignature(movementOriginalPrefix(actual))!==movementOriginalSignature(movementOriginalPrefix(row.binding.fact)))throw Error('movement-concentration:changed-native-segment');return row}
/** Read-only actual producer source. No caller graph can issue this checkpoint. */
export function readDnd5eSequenceMovementConcentrationCheckpoint(checkpoint:object){const row=movementConcentrationFor(checkpoint);return cloneDnd5eHostTransactionInput({parentId:row.binding.fact.request.parentId,segmentIndex:row.binding.fact.request.segmentIndex,operationIndex:row.entryIndex,areaId:row.areaId,areaKind:row.areaKind,actorId:row.actorId,operationId:row.operationId,prepared:row.binding.fact.source.prepared,native:row.native,priorState:row.priorState,application:row.application,characterIdByCombatantId:row.binding.fact.source.prepared.characterIdByCombatantId,firstHostNow:row.binding.fact.source.prepared.input.firstHostNow})}
export function assertDnd5eSequenceMovementConcentrationCheckpointPrefix(checkpoint:object,movementCheckpoint:object){const row=movementConcentrationFor(checkpoint),current=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(movementCheckpoint);if(movementOriginalSignature(movementOriginalPrefix(current))!==movementOriginalSignature(movementOriginalPrefix(row.binding.fact)))throw Error('movement-concentration:changed-actual-movement-prefix')}
type MovementConcentrationServices=Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['services']
type MovementConcentrationOptions=Parameters<typeof settleBountifulOpportunityPostNativePrefix>[0]['options']
/** The private original native object is supplied to the actual Base only here. */
export async function settleDnd5eSequenceMovementConcentration(input:{checkpoint:object;services:MovementConcentrationServices;options:MovementConcentrationOptions;resolveOriginal?:(frame:Dnd5eSequenceConcentrationOriginal)=>Promise<readonly number[]|object|undefined>;resolveResult?:(frame:Dnd5eSequenceConcentrationOriginal)=>Promise<object>}){
 const row=movementConcentrationFor(input.checkpoint);let stage:PostNativeActivityStage|undefined;const base:Parameters<typeof settleDnd5eConcentrationChecksBase>[0]={...input.services,result:row.native,priorState:cloneDnd5eHostTransactionInput(row.priorState),map:cloneDnd5eHostTransactionInput(row.application.map),characters:cloneDnd5eHostTransactionInput(row.application.characters),priorApplication:cloneDnd5eHostTransactionInput(row.application),characterIdByCombatantId:row.binding.fact.source.prepared.characterIdByCombatantId,hostParentTransactionId:row.operationId,followupTransactionNow:()=>row.binding.fact.source.prepared.input.firstHostNow,damageReactions:input.options,settleActivityTriggers:async request=>{if(!request.stage)throw Error('movement-concentration:actual-base-stage-required');stage=request.stage;return input.services.settleActivityTriggers(request)}}
 if(!input.options.authorityUnchanged())throw Error('movement-concentration:actual-current-authority-required')
 if(input.resolveOriginal)bindDnd5eMovementConcentrationOriginals(base,input.checkpoint,()=>row.binding.unchanged()&&input.options.authorityUnchanged(),input.resolveOriginal,input.resolveResult)
 const completed=await settleDnd5eConcentrationChecksBase(base);movementConcentrationFor(input.checkpoint);readDnd5eCompletedCombatBase(row.native,completed);if(!stage)throw Error('movement-concentration:actual-completed-activity-stage-required');readPostNativeActivitySettlementForStage(stage,completed);return completed
}
function movementOriginalFor(frame:object,checkpoint:object){
 const row=movementOriginalFrames.get(frame),host=getRoomSession(),fact=readCapturedDnd5eOpportunitySequenceMovementCheckpoint(checkpoint)
 if(!row||host?.role!=='dm'||host.roomId!==row.binding.roomId||host.memberId!==row.binding.memberId||!row.binding.unchanged()||movementOriginalMaterial(row.binding.input)!==row.binding.signature||movementOriginalSignature({state:row.state,action:row.action,operationId:row.operationId,mode:row.mode})!==row.signature)throw Error('movement-original:actual-live-operation-required')
 if(movementOriginalSignature(movementOriginalPrefix(fact))!==movementOriginalSignature(movementOriginalPrefix(row.binding.fact)))throw Error('movement-original:exact-native-segment-required')
 return row
}
export function readDnd5eSequenceMovementOriginal(frame:object,checkpoint:object){const row=movementOriginalFor(frame,checkpoint);return{parentId:row.binding.fact.request.parentId,segmentIndex:row.binding.fact.request.segmentIndex,operationId:row.operationId,operationIndex:JSON.parse(row.operationId)[4]as number,actorId:row.action.actorId,kind:'saving-throw' as const,areaId:row.action.areaId,areaKind:row.action.areaKind,mode:row.mode,stage:row.stage,raw:row.action.d20Second===undefined?[row.action.d20]:[row.action.d20,row.action.d20Second]}}
/** Execute only the native operation captured by the true producer loop. */
export function resolveDnd5eSequenceMovementOriginal(frame:object,checkpoint:object){const row=movementOriginalFor(frame,checkpoint),previous=activeMovementOriginal;activeMovementOriginal=frame;try{const run=()=>resolveDnd5eHeadlessAction(cloneDnd5eHostTransactionInput(row.state),cloneDnd5eHostTransactionInput(row.action),{transactionId:row.operationId,now:row.binding.fact.source.prepared.input.firstHostNow});return row.ready?withDnd5eOriginalD20ReadyObserver((request,snapshot,events)=>{if(row.ready!==movementReadySignature({request,snapshot,events}))throw Error('movement-original:changed-actual-original-boundary')},run):run()}finally{activeMovementOriginal=previous}}
export function readDnd5eSequenceMovementOriginalReplayFacts(frame:object){const row=movementOriginalFrames.get(frame);if(!row)throw Error('movement-original:actual-live-operation-required');movementOriginalFor(frame,row.binding.checkpoint);return{...readDnd5eSequenceMovementOriginal(frame,row.binding.checkpoint),prepared:movementOriginalSignature(row.binding.fact.source.prepared)}}
export function observeDnd5eSequenceMovementOriginal(frame:object,checkpoint:object){const row=movementOriginalFor(frame,checkpoint),stopped=new Error('movement-original:actual-original-boundary-observed');if(row.stage!=='original')throw Error('movement-original:actual-original-operation-required');try{withDnd5eOriginalD20ReadyTailStop((request,snapshot,events)=>{if(row.ready&&row.ready!==movementReadySignature({request,snapshot,events}))throw Error('movement-original:changed-actual-original-boundary');throw stopped},()=>resolveDnd5eSequenceMovementOriginal(frame,checkpoint))}catch(error){if(error===stopped)return;throw error}throw Error('movement-original:actual-original-ready-not-reached')}
export function throwDnd5eSequenceMovementOriginalResult(frame:object,checkpoint:object):never{const row=movementOriginalFor(frame,checkpoint);if(row.stage!=='result'||!row.ready)throw Error('movement-original:actual-final-operation-required');const result=resolveDnd5eSequenceMovementOriginal(frame,checkpoint),receipt=new Error('movement-original:actual-native-operation-completed');movementNativeResults.set(receipt,{frame,result,signature:movementOriginalSignature(result)});throw receipt}
function movementNativeResult(receipt:object,frame:object){const row=movementOriginalFrames.get(frame);if(!row)throw Error('movement-original:actual-native-result-required');movementOriginalFor(frame,row.binding.checkpoint);const proof=movementNativeResults.get(receipt);if(!proof||proof.frame!==frame||proof.signature!==movementOriginalSignature(proof.result))throw Error('movement-original:actual-native-result-required');return cloneDnd5eHostTransactionInput(proof.result)}
/** Read-only preview of the exact genuine finalized original faces. It cannot
 * issue a frame, native result, owner choice or replacement. */
export function previewDnd5eSequenceMovementNativeBoundary(boundary:object,state:Dnd5eHeadlessCombatState,action:Dnd5eAction){const scope=movementNativeBoundaries.get(boundary),raw=scope&&movementOriginalFrames.get(scope.raw);if(!scope||!raw?.ready||!raw.retained||action.type!=='item-area-trigger')throw Error('movement-original:actual-issued-native-boundary-required');movementOriginalFor(scope.raw,raw.binding.checkpoint);if(movementOriginalSignature(state)!==movementOriginalSignature(scope.state)||movementOriginalSignature(Object.fromEntries(Object.entries(action).filter(([key])=>key!=='airborneFallDamageRollsByCombatantId')))!==movementOriginalSignature(Object.fromEntries(Object.entries(scope.action).filter(([key])=>key!=='airborneFallDamageRollsByCombatantId'))))throw Error('movement-original:changed-native-helper-source');return{...cloneDnd5eHostTransactionInput(action),d20:raw.retained[0]!,d20Second:raw.retained[1]}}
/** Only consumes a producer-issued boundary at the concrete fall helper's
 * actual native call. A JSON token, caller state, or changed area action fails. */
export async function resolveDnd5eSequenceMovementNativeBoundary(boundary:object,resolver:Dnd5eMovementHazardsProducerContext['resolveDnd5eHeadlessActionWithAirborneFalls'],state:Dnd5eHeadlessCombatState,action:Dnd5eAction,map:BattleMap,options:MovementNativeOptions,material:Dnd5eDamageReactionMapContext){
 const scope=movementNativeBoundaries.get(boundary),raw=scope&&movementOriginalFrames.get(scope.raw)
 if(!scope||scope.completed||!raw||scope.resolve!==resolver||action.type!=='item-area-trigger'||!raw.binding.resolveFinal||!raw.ready)throw Error('movement-original:actual-issued-native-boundary-required')
 movementOriginalFor(scope.raw,raw.binding.checkpoint)
 if(scope.signature!==movementOriginalSignature({state:scope.state,action:scope.action,map:scope.map,options:scope.options,material:scope.material})||movementOriginalSignature(state)!==movementOriginalSignature(scope.state)||movementOriginalSignature(map)!==movementOriginalSignature(scope.map)||movementOriginalSignature(options)!==movementOriginalSignature(scope.options)||movementOriginalSignature(material)!==movementOriginalSignature(scope.material))throw Error('movement-original:changed-native-helper-source')
 const supplied=Object.fromEntries(Object.entries(action).filter(([key])=>key!=='airborneFallDamageRollsByCombatantId')),expected=Object.fromEntries(Object.entries(scope.action).filter(([key])=>key!=='airborneFallDamageRollsByCombatantId'))
 if(movementOriginalSignature(supplied)!==movementOriginalSignature(expected))throw Error('movement-original:changed-native-helper-action')
 const frame=Object.freeze({})as Dnd5eMovementOriginalFrame,row={binding:raw.binding,state:cloneDnd5eHostTransactionInput(state),action:cloneDnd5eHostTransactionInput(action),operationId:raw.operationId,mode:raw.mode,stage:'result' as const,ready:raw.ready,material:cloneDnd5eHostTransactionInput(scope.material),signature:''};row.signature=movementOriginalSignature({state:row.state,action:row.action,operationId:row.operationId,mode:row.mode});movementOriginalFrames.set(frame,row)
 const cap=await raw.binding.resolveFinal(frame),proof=movementMaterialResults.get(cap)
 if(!proof||proof.frame!==frame||proof.signature!==movementOriginalSignature(proof.settled))throw Error('movement-original:actual-material-native-result-required')
 movementOriginalFor(frame,raw.binding.checkpoint);raw.binding.events.push(...cloneDnd5eHostTransactionInput(proof.settled.result.events));scope.completed=true;return{...cloneDnd5eHostTransactionInput(proof.settled.result),application:cloneDnd5eHostTransactionInput(proof.settled.application)}
}
/** Executes the real original facade through the existing material DamageFlow.
 * There is no result/state setter: only an actual native completion exception
 * from this exact final frame can supply the operation result to that flow. */
export async function settleDnd5eSequenceMovementOriginalWithMaterials(input:{frame:object;source:Parameters<typeof resolveDnd5eOpportunityMoveSequenceOriginal>[0];replay:object;options:Dnd5eDamageReactionFlowOptions}){
 const row=movementOriginalFrames.get(input.frame);if(!row||row.stage!=='result'||!row.ready)throw Error('movement-original:actual-final-operation-required');movementOriginalFor(input.frame,row.binding.checkpoint)
 if(movementOriginalSignature(input.source.prepared)!==movementOriginalSignature(row.binding.fact.source.prepared))throw Error('movement-original:exact-whole-move-source-required')
 if(!row.material)throw Error('movement-original:actual-material-context-required')
 const source=withBountifulOpportunitySequencePostNativeReplay(input.source,input.replay),context=cloneDnd5eHostTransactionInput(row.material);let actual=false
 const settled=await resolveDnd5ePreparedWithMaterialDamageReactions(input.options,source,value=>{try{resolveDnd5eOpportunityMoveSequenceOriginal(value)}catch(error){if(!error||typeof error!=='object')throw error;let result:Dnd5eActionResult;try{result=movementNativeResult(error,input.frame)}catch{throw error}actual=true;return{result,application:result.ok?planDnd5eMapResultApplication({...context,state:result.state,events:[...result.events]}):undefined}}throw Error('movement-original:actual-native-result-not-reached')},context)
 if(!actual)throw Error('movement-original:actual-material-result-not-reached');movementOriginalFor(input.frame,row.binding.checkpoint);const cap=Object.freeze({});movementMaterialResults.set(cap,{frame:input.frame,settled,signature:movementOriginalSignature(settled)});return cap
}
type MovementDicePorts=Pick<Dnd5eMovementHazardsProducerContext,'rollDiceBoxD20'|'rollDiceBoxD20Pair'|'rollDiceBoxValues'>
/** Reuses the exact concrete producer and its existing services. Only the
 * three actual dice ports are wrapped; no mechanical input/result is replaced. */
export function withIssuedDnd5eMovementHazardsDice(producer:Dnd5eMovementHazardsProducer,wrap:(ports:MovementDicePorts)=>MovementDicePorts){
 const context=issuedMovementProducerContexts.get(producer)
 if(!context||issuedMovementProducers.get(producer)!==producer.settleDnd5eMovementHazards)throw Error('movement-hazards:actual-producer-required')
 return createDnd5eMovementHazardsProducer({...context,...wrap({rollDiceBoxD20:context.rollDiceBoxD20,rollDiceBoxD20Pair:context.rollDiceBoxD20Pair,rollDiceBoxValues:context.rollDiceBoxValues})})
}
/** Wrap only the existing concrete native resolver, retaining the same producer
 * and every original movement/hazard algorithm. This is not a parent issuer. */
export function withIssuedDnd5eMovementHazardsNativeResolution(producer:Dnd5eMovementHazardsProducer,wrap:(resolve:Dnd5eMovementHazardsProducerContext['resolveDnd5eHeadlessActionWithAirborneFalls'])=>Dnd5eMovementHazardsProducerContext['resolveDnd5eHeadlessActionWithAirborneFalls']){
 const context=issuedMovementProducerContexts.get(producer)
 if(!context||issuedMovementProducers.get(producer)!==producer.settleDnd5eMovementHazards)throw Error('movement-hazards:actual-producer-required')
 return createDnd5eMovementHazardsProducer({...context,resolveDnd5eHeadlessActionWithAirborneFalls:wrap(context.resolveDnd5eHeadlessActionWithAirborneFalls)})
}
/** Reproject the current settled world at a genuine path checkpoint. The
 * original action/economy stays intact; this does not issue another move. */
export function projectDnd5eMovementHazardPosition(input:{state:Dnd5eHeadlessCombatState;map:BattleMap;characters:readonly Character[];characterIdByCombatantId:Readonly<Record<string,string>>;initiativeOrder:readonly InitiativeEntry[];tokenId:string;position:{x:number;y:number};elevationFeet?:number}){
 const state=structuredClone(input.state),actor=state.combatants[input.tokenId]
 if(!actor)throw Error('movement-hazard:actual-mover-required')
 actor.position={...input.position};if(input.elevationFeet!==undefined)actor.elevationFeet=input.elevationFeet
 const application=planDnd5eMapResultApplication({state,map:input.map,characters:input.characters,baselineCharacters:input.characters,characterIdByCombatantId:input.characterIdByCombatantId})
 const fresh=createDnd5eMapCombatSnapshot({map:application.map,characters:application.characters,combatId:state.combatId,round:state.round,turnSlotId:state.turnSlotId,initiativeOrder:[...input.initiativeOrder],additionalCreatureTokenIds:Object.keys(state.combatants),worldMinute:state.companionScene?.worldMinute,worldSecondRemainder:state.companionScene?.worldSecondRemainder}).state
 for(const[id,combatant]of Object.entries(fresh.combatants)){const previous=state.combatants[id];if(!previous)throw Error('movement-hazard:unknown-projected-combatant');combatant.turn={...previous.turn}}
 return{state:copyDnd5eOrdinaryWeaponScene(input.state,{...state,combatants:fresh.combatants,companionScene:fresh.companionScene}),map:application.map,characters:application.characters}
}
export type Dnd5eMovementHazardsProducer = ReturnType<typeof createDnd5eMovementHazardsProducer>
/** Calls only the concrete method originally issued by this factory. A copied
 * API object or a replaced method cannot stand in for the movement producer. */
export function runIssuedDnd5eMovementHazardsProducer(producer:Dnd5eMovementHazardsProducer,input:Parameters<Dnd5eMovementHazardsProducer['settleDnd5eMovementHazards']>[0]){
  if(issuedMovementProducers.get(producer)!==producer.settleDnd5eMovementHazards)throw Error('movement-hazards:actual-producer-required')
  const binding=movementOriginalInputs.get(input);if(binding&&(binding.producer!==producer||movementOriginalMaterial(input)!==binding.signature))throw Error('movement-original:exact-bound-producer-required')
  return producer.settleDnd5eMovementHazards(input)
}

/** Executes the original concrete Maps movement producers. Only existing UI,
 * dice and material-reaction services are supplied by the current Host page. */
export function createDnd5eMovementHazardsProducer(context:Dnd5eMovementHazardsProducerContext){
  const settleDnd5ePersistentAreaCandidates = async (input: {
    candidates: readonly Dnd5ePersistentAreaTriggerCandidate[]
    map: BattleMap
    characters: readonly Character[]
    round: number
    /** Exact upcoming initiative-slot key used by the shared turn economy. */
    actionEconomyTurnKey?: string
    movementTokenId?: string
    hostState?: Dnd5eHeadlessCombatState
    ordinarySceneSource?:Dnd5eHeadlessCombatState
    deferReactionCommit?: boolean
    /** Staged arrival belongs to the parent attack transaction. */
    deferResourceCommit?: boolean
  }): Promise<{
    map: BattleMap
    characters: Character[]
    logs: string[]
    events: Dnd5eCombatEvent[]
    state?: Dnd5eHeadlessCombatState
    traversalStop?: { pathIndex: number; position: { x: number; y: number } }
  }> => {
    const {requestOptionalDamageSave, rollDiceBoxValues, requestDnd5ePersistentAreaWillingFailure, combatActiveRef, initiativeOrderRef, combatIdRef, rollDnd5eMapSavingThrowInterrupts, requestSharedChoiceWindow, collectDnd5ePersistentAreaRolls, requestSharedPersistentAreaAdjudication, roundRef, initiativeIndexRef, rollTempleEntryEffectDice, rollOpeningAttackSavingThrow, publishDnd5ePersistentAreaSaveResult, settleDnd5eConcentrationChecks, rollDnd5eUnsupportedAirborneFalls, settleDnd5eMapMountedBalance, rollDiceBoxD20, requestSharedHellishRebukeChoice, collectSharedSpellDamageDieChoices, requestDnd5eSavingThrowRerollDice, requestDnd5eBardicInspirationRoll, requestDnd5eOptionalBonusDieUse, requestDnd5eDarkOnesOwnLuckRoll, requestSharedPostSpellRandomTableChoice, requestSharedPostSpellRandomTableAdjudication, updateDnd5eTurnEconomy} = context

    let map = input.map
    let characters = [...input.characters]
    let hostState = input.hostState
    const logs: string[] = []
    const events: Dnd5eCombatEvent[] = []
    const initialAreaById = new Map(
      (input.map.dnd5ePluginAreas ?? []).map((area) => [area.id, area] as const),
    )
    const sourceTargetSelections = new Map<string, ReadonlySet<string>>()
    const settleAreaCapacity = createDnd5ePersistentAreaCapacityCoordinator(async ({ sides, prepared }) => {
      const values = await rollDiceBoxValues(1, sides, `${prepared.candidate.area.label}·随机排出目标`,
        prepared.targetName, { rollerTokenId: prepared.candidate.area.sourceTokenId, skipChoiceReroll: true })
      return values[0]
    })
    const chooseWillingAreaFailure = createDnd5ePersistentAreaWillingFailureCoordinator(requestDnd5ePersistentAreaWillingFailure)
    const persistentAreaDamageRolls = createDnd5ePersistentAreaDamageRollCoordinator(
      (count, sides, label, targetName, ownership) => rollDiceBoxValues(count, sides, label, targetName, ownership),
    )
    // This is an explicit transaction barrier: every save in a simultaneous
    // pulse finishes before the per-target loop below can request damage dice.
    const primedSavingThrows = await collectDnd5ePersistentAreaSavingThrowWaveResults({
      candidates: input.candidates,
      resolve: async (waveCandidate) => {
        const waveArea = map.dnd5ePluginAreas?.find((area) => area.id === waveCandidate.area.id) ??
          initialAreaById.get(waveCandidate.area.id)
        if (!waveArea) return undefined
        const waveInitiativeOrder = dnd5eSpellResolutionInitiativeOrder({
          combatActive: combatActiveRef.current,
          map,
          actorTokenId: waveArea.sourceTokenId,
          initiativeOrder: initiativeOrderRef.current,
        })
        const wavePrepared = prepareDnd5ePersistentAreaTrigger({ worldMinute: readBrowserSceneWorldMinute(),
          combatId: hostState?.combatId ?? (combatIdRef.current || `map-${map.id}`),
          round: input.round,
          map,
          characters,
          initiativeOrder: waveInitiativeOrder,
          candidate: { ...waveCandidate, area: waveArea },
        }, hostState)
        if (!wavePrepared.ok || !wavePrepared.prepared.save) return undefined
        if (await chooseWillingAreaFailure(wavePrepared.prepared)) return undefined
        const waveSave = wavePrepared.prepared.save
        const waveSaveAbilityLabel = ABILITIES.find((ability) => ability.key === waveSave.ability)?.label ?? waveSave.ability
        await publishSavingThrowPresentation({
          id: `${waveCandidate.transactionId}:saving-throw`,
          mapId: map.id,
          transactionId: waveCandidate.transactionId,
          targetTokenId: waveCandidate.targetToken.id,
          targetName: wavePrepared.prepared.targetName,
          ability: waveSave.ability,
          phase: 'rolling',
          dc: waveSave.dc,
        }).catch(() => undefined)
        const waveTargetCombatant = wavePrepared.prepared.state.combatants[waveCandidate.targetToken.id]
        if (!waveTargetCombatant) return undefined
        const waveTargetCharacter = waveCandidate.targetToken.characterId
          ? wavePrepared.prepared.characters.find((character) => character.id === waveCandidate.targetToken.characterId)
          : undefined
        return rollDnd5eMapSavingThrowInterrupts({
          negationContext: { mapId: map.id, transactionId: waveCandidate.transactionId, effectId: JSON.stringify([waveCandidate.area.id, waveCandidate.trigger.id]) },
          state: wavePrepared.prepared.state,
          combatant: waveTargetCombatant,
          sourceActorId: waveCandidate.area.sourceTokenId,
          target: waveTargetCharacter,
          targetName: wavePrepared.prepared.targetName,
          ability: waveSave.ability,
          dc: waveSave.dc,
          mode: waveSave.mode,
          label: `${waveCandidate.trigger.label}·${waveSaveAbilityLabel}豁免`,
        })
      },
    })
    const simultaneousEmpoweredEvocationEvents = new Set<string>()
    let traversalStop: { pathIndex: number; position: { x: number; y: number } } | undefined
    let movementStopPathIndex: number | undefined
    for (const candidate of input.candidates) {
      // A failed Grease entry ends the remainder of this route. Other effects
      // reached in the same occupied cell still settle, while triggers from
      // later cells must not fire for movement that never happened.
      if (
        movementStopPathIndex != null &&
        candidate.pathIndex != null &&
        candidate.pathIndex > movementStopPathIndex
      ) break
      if (candidate.trigger.sourceChoosesTargets) {
        const selectionKey = `${candidate.area.id}\u0000${candidate.trigger.id}`
        let selectedTransactionIds = sourceTargetSelections.get(selectionKey)
        if (!selectedTransactionIds) {
          const group = input.candidates.filter((entry) =>
            entry.area.id === candidate.area.id &&
            entry.trigger.id === candidate.trigger.id)
          const currentSelectionArea = map.dnd5ePluginAreas?.find(area => area.id === candidate.area.id) ?? candidate.area
          const maximumSelections = Math.min(group.length,
            dnd5ePersistentAreaRemainingTargetBudget(currentSelectionArea, candidate.trigger, candidate.turnKey))
          const available = [...group]
          const selected = new Set<string>()
          for (let selectionIndex = 0; selectionIndex < maximumSelections; selectionIndex += 1) {
            const interruptId = `persistent-area-source-target:${candidate.area.id}:${candidate.trigger.id}:${input.round}:${candidate.turnKey ?? 'round'}:${selectionIndex}`
            const optionId = await requestSharedChoiceWindow({
              id: interruptId,
              transactionId: interruptId,
              actorCharId: candidate.area.sourceCharacterId,
              pluginId: candidate.area.pluginId,
              featureId: candidate.area.featureId,
              featureName: `${candidate.area.label}·${candidate.trigger.label}`,
              prompt: `${candidate.area.label}：选择第 ${selectionIndex + 1}/${maximumSelections} 个不重复目标。`,
              audience: characters.some((character) => character.id === candidate.area.sourceCharacterId)
                ? 'actor'
                : 'dm',
              options: available.map((entry) => ({
                id: entry.targetToken.id,
                label: entry.targetToken.label,
              })),
              defaultOptionId: available[0]!.targetToken.id,
              timeoutMs: 10 * 60 * 1000,
              phase: 'before-action',
              context: {
                contextKind: 'persistent-area-source-target-selection',
                areaId: candidate.area.id,
                triggerId: candidate.trigger.id,
                selectionIndex,
                maximumSelections,
              },
            }) ?? available[0]!.targetToken.id
            const selectedIndex = available.findIndex((entry) => entry.targetToken.id === optionId)
            const selectedCandidate = available.splice(Math.max(0, selectedIndex), 1)[0]
            if (selectedCandidate) selected.add(selectedCandidate.transactionId)
          }
          selectedTransactionIds = selected
          sourceTargetSelections.set(selectionKey, selectedTransactionIds)
        }
        if (!selectedTransactionIds.has(candidate.transactionId)) continue
      }
      const currentArea = map.dnd5ePluginAreas?.find((area) => area.id === candidate.area.id) ??
        (dnd5ePersistentAreaTriggerTimingIsSimultaneousWave(candidate.trigger.timing)
          ? initialAreaById.get(candidate.area.id)
          : undefined)
      if (!currentArea) continue
      const currentCandidate = { ...candidate, area: currentArea }
      // Exploration casts have no live initiative tracker, but persistent-area
      // transactions still require complete combatant snapshots for saves and
      // damage. Mirror normal spell preparation by synthesizing an order from
      // all player/enemy tokens while combat is inactive.
      const triggerInitiativeOrder = dnd5eSpellResolutionInitiativeOrder({
        combatActive: combatActiveRef.current,
        map,
        actorTokenId: currentArea.sourceTokenId,
        initiativeOrder: initiativeOrderRef.current,
      })
      const prepared = prepareDnd5ePersistentAreaTrigger({ worldMinute: readBrowserSceneWorldMinute(),
        combatId: hostState?.combatId ?? (combatIdRef.current || `map-${map.id}`),
        round: input.round,
        map,
        characters,
        initiativeOrder: triggerInitiativeOrder,
        candidate: currentCandidate,
      }, hostState)
      if (!prepared.ok) {
        if (prepared.reason === 'target-not-concentrating') continue
        if (hostState) throw new Error(prepared.reason)
        logs.push(`${candidate.area.label} 的触发事务准备失败：${prepared.reason}。`)
        continue
      }
      if(input.ordinarySceneSource)copyDnd5eOrdinaryWeaponScene(input.ordinarySceneSource,prepared.prepared.state)
      let sourceConsent: boolean | undefined
      if (candidate.trigger.sourceMayDecline) {
        const choiceId = `${candidate.transactionId}:source-consent`
        sourceConsent = await requestSharedChoiceWindow({
          id: choiceId, transactionId: choiceId,
          actorCharId: candidate.area.sourceCharacterId,
          pluginId: candidate.area.pluginId, featureId: candidate.area.featureId,
          featureName: candidate.area.label,
          prompt: `是否对${prepared.prepared.targetName}触发${candidate.trigger.label}？`,
          audience: characters.some(character => character.id === candidate.area.sourceCharacterId) ? 'actor' : 'dm',
          options: [{ id: 'apply', label: '触发效果' }, { id: 'decline', label: '本次不触发' }],
          defaultOptionId: 'decline', timeoutMs: 10 * 60 * 1000, phase: 'before-action',
          context: { contextKind: 'persistent-area-source-consent', areaId: candidate.area.id, triggerId: candidate.trigger.id },
        }) === 'apply'
        if (!sourceConsent) {
          const declined = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, sourceConsent: false })
          if (declined.result.ok && declined.application) {
            if (hostState) hostState = declined.result.state
            map = declined.application.map
            characters = declined.application.characters
            logs.push(`${candidate.area.label}：本次不对${prepared.prepared.targetName}触发效果。`)
          }
          continue
        }
      }
      const { rollInput, interrupted, savingThrowPresentationId } = await collectDnd5ePersistentAreaRolls({
        prepared, sourceConsent, chooseWillingAreaFailure, persistentAreaDamageRolls,
        primedSavingThrow: primedSavingThrows.get(candidate.transactionId),
      })
      let resolved = await settleAreaCapacity({ prepared: prepared.prepared, ...rollInput })
      if (!resolved.result.ok || !resolved.application) {
        if (hostState) throw new Error(resolved.result.ok ? 'missing-application' : resolved.result.reason)
        logs.push(`${candidate.area.label} 的触发事务被 Headless 拒绝：${resolved.result.ok ? 'missing-application' : resolved.result.reason}。`)
        continue
      }
      if (persistentAreaNeedsDmApproval(candidate.area.coreSpellId, candidate.trigger.dmAdjustable)) {
        const triggerEvent = resolved.result.events.find((event) => event.type === 'persistent-area-triggered')
        if (triggerEvent?.type !== 'persistent-area-triggered') continue
        const proposedDamageForSaveOverride = (saveSuccessOverride: boolean): number | undefined => {
          if (!candidate.trigger.damage || triggerEvent.saveSuccess == null) return undefined
          const alternative = resolvePreparedDnd5ePersistentAreaTrigger({
            prepared: prepared.prepared,
            ...rollInput,
            dmAdjustment: { saveSuccessOverride },
          })
          if (!alternative.result.ok) return undefined
          const alternativeTriggerEvent = alternative.result.events.find((event) =>
            event.type === 'persistent-area-triggered')
          return alternativeTriggerEvent?.type === 'persistent-area-triggered'
            ? alternativeTriggerEvent.damage
            : undefined
        }
        const response = await requestSharedPersistentAreaAdjudication({
          prepared: prepared.prepared,
          proposedDamage: candidate.trigger.damage ? triggerEvent.damage : undefined,
          proposedDamageOnSaveSuccess: proposedDamageForSaveOverride(true),
          proposedDamageOnSaveFailure: proposedDamageForSaveOverride(false),
          proposedDamageType: candidate.trigger.damage?.type,
          proposedSaveSuccess: triggerEvent.saveSuccess,
          proposedConditionIds: triggerEvent.conditionApplied ? [triggerEvent.conditionApplied] : [],
        })
        if (response.decision !== 'approved') {
          logs.push(`DM 跳过了 ${candidate.area.label} 对 ${prepared.prepared.targetName} 的本次触发。`)
          continue
        }
        const effect = response.effects.find((entry) => entry.targetTokenId === candidate.targetToken.id)
        const dmAdjustment: Dnd5ePersistentAreaDmAdjustment = {
          ...(candidate.trigger.damage
            ? { damage: { mode: 'set', value: effect?.operation === 'damage' ? Math.max(0, Math.floor(effect.amount ?? 0)) : 0 } as const }
            : {}),
          ...(response.saveSuccessOverride != null ? { saveSuccessOverride: response.saveSuccessOverride } : {}),
          ...(candidate.trigger.condition && effect?.addCondition !== candidate.trigger.condition.condition
            ? { blockedConditionIds: [candidate.trigger.condition.condition] }
            : {}),
        }
        resolved = await settleAreaCapacity({
          prepared: prepared.prepared,
          ...rollInput,
          dmAdjustment,
        })
        if (!resolved.result.ok || !resolved.application) {
          logs.push(`${candidate.area.label} 的 DM 调整未通过 Headless 校验。`)
          continue
        }
      }
      if (resolved.result.events.some(event => event.type === 'moved')) {
        const { settleDnd5ePersistentAreaTempleEntry } = await import('../../rulesets/dnd5e/persistentAreaTempleEntry')
        const readTempleAuthority = () => ({ map: useMapStore.getState().maps.find(entry => entry.id === map.id),
          characters: useCharacterStore.getState().characters,
          geometry: { geometry: mapGeometryRuntimeForMap(map.id), round: roundRef.current,
            index: initiativeIndexRef.current, order: initiativeOrderRef.current },
          worldMinute: readBrowserSceneWorldMinute() })
        const unchanged = captureActivityPlacementAuthority(readTempleAuthority())
        const resourceUsage: OpeningAttackSaveResourceUsage = { bardicInspirationTargetIds: new Set(),
          darkOnesOwnLuckByTargetId: {}, rerollsByTargetAndResource: {}, legendaryResistanceByTargetId: {} }
        const entry = await settleDnd5ePersistentAreaTempleEntry({ prepared: prepared.prepared, resolved, rollEffectDice: rollTempleEntryEffectDice,
          isCurrent: () => unchanged(readTempleAuthority()), roll: request => {
            const targetToken = map.tokens.find(token => token.id === request.target.id)
            return targetToken ? rollOpeningAttackSavingThrow({ ...request, map, characters, targetToken,
              effectName: '神庙·持续区域入内豁免', resourceUsage }) : Promise.resolve(undefined)
          } })
        if (!entry.ok) throw new Error(entry.reason)
        resolved = { ...entry.resolved, capacityRandomResults: resolved.capacityRandomResults }
        if (!resolved.result.ok || !resolved.application) throw new Error('temple-area-settlement-missing')
      }
      await publishDnd5ePersistentAreaSaveResult({prepared:prepared.prepared,events:resolved.result.events,interrupted,savingThrowPresentationId})
      const settled = await settleDnd5eConcentrationChecks({ requestOptionalDamageSave,
        priorState: prepared.prepared.state,
        rollUnsupportedAirborneFalls: rollDnd5eUnsupportedAirborneFalls, settleMountedBalance: settleDnd5eMapMountedBalance,
        result: resolved.result,
        map: resolved.application.map,
        characters: resolved.application.characters,
        priorApplication: resolved.application,
        characterIdByCombatantId: prepared.prepared.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName, context) => (await rollDiceBoxValues(1, 4, label, targetName, context))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
              chooseSpellDamageDice:request=>collectSharedSpellDamageDieChoices({...request,groups:[request.group]}),
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestOptionalBonusDie: requestDnd5eOptionalBonusDieUse,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
        requestPostSpellRandomTableChoice: requestSharedPostSpellRandomTableChoice,
        requestPostSpellRandomTableAdjudication: requestSharedPostSpellRandomTableAdjudication,
      })
      characters = settled.application.characters
      if (hostState) hostState = settled.result.state
      // Reconcile immediately so a failed save removes the area for future
      // turns and new trigger collections. Pre-collected simultaneous waves
      // keep using initialAreaById above, because their remaining targets were
      // already affected when the wave began.
      map = reconcileDnd5ePluginAreasOnMap(
        settled.application.map,
        characters,
        input.round,
      )
      const damageWaveKey = dnd5ePersistentAreaDamageWaveKey({
        areaId: candidate.area.id,
        triggerId: candidate.trigger.id,
        timing: candidate.trigger.timing,
      })
      events.push(...settled.result.events.filter((event) => {
        if (
          !damageWaveKey ||
          event.type !== 'spell-damage-feature-bonus-applied' ||
          event.featureId !== 'evocation-empowered'
        ) return true
        const featureEventKey = `${damageWaveKey}\u0000${event.actorId}\u0000${event.spellId}\u0000${event.featureId}`
        if (simultaneousEmpoweredEvocationEvents.has(featureEventKey)) return false
        simultaneousEmpoweredEvocationEvents.add(featureEventKey)
        return true
      }))
      if (input.movementTokenId === candidate.targetToken.id && candidate.enteredAt &&
        candidate.pathIndex != null && dnd5eLostSolidMaterialTraversal(
          prepared.prepared.state, settled.result.state, candidate.targetToken.id)) {
        movementStopPathIndex = candidate.pathIndex
        traversalStop ??= { pathIndex: candidate.pathIndex,
          position: tokenCenterForAnchorCell(candidate.enteredAt, candidate.targetToken, map) }
      }
      const committedTriggerEvent = settled.result.events.find((event) =>
        event.type === 'persistent-area-triggered')
      if (
        (candidate.area.coreSpellId === 'grease' || candidate.area.coreSpellId === 'web') &&
        candidate.trigger.timing === 'on-enter' &&
        candidate.pathIndex != null &&
        committedTriggerEvent?.type === 'persistent-area-triggered' &&
        committedTriggerEvent.saveSuccess === false &&
        (candidate.area.coreSpellId !== 'web' || committedTriggerEvent.conditionApplied === 'restrained')
      ) movementStopPathIndex = candidate.pathIndex
      if (!input.deferResourceCommit && committedTriggerEvent?.type === 'persistent-area-triggered' && committedTriggerEvent.actionConsumed) {
        updateDnd5eTurnEconomy(
          candidate.targetToken.id,
          (economy) => projectDnd5ePersistentAreaActionConsumption(
            economy,
            true,
            input.actionEconomyTurnKey,
          ),
          input.round,
        )
      }
      for (const reactorId of new Set(settled.result.events.flatMap(event =>
        event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : []))) {
        if (input.deferReactionCommit || input.deferResourceCommit) continue
        updateDnd5eTurnEconomy(reactorId, economy => ({ ...economy,
          reaction: { ...economy.reaction, current: 0 } }), input.round)
      }
      observeCommittedDnd5ePersistentAreaTrigger({
        source: prepared.prepared.state,
        areaId: candidate.area.id,
        sourceId: candidate.area.sourceTokenId,
        targetId: candidate.targetToken.id,
        triggerId: candidate.trigger.id,
        result: resolved.result,
      })
      const triggerEvent = settled.result.events.find((event) => event.type === 'persistent-area-triggered')
      const saveEvent = settled.result.events.find((event) => event.type === 'saving-throw-resolved')
      const saveText = saveEvent?.type === 'saving-throw-resolved'
        ? saveEvent.automaticOutcome === 'willing-failure'
          ? '，自愿放弃豁免（无需掷骰）'
          : `，豁免 ${saveEvent.total} vs DC ${saveEvent.dc} ${saveEvent.success ? '成功' : '失败'}`
        : ''
      const forcedShapechange = settled.result.events.find((event) =>
        event.type === 'monster-shapechanged' && event.actorId === candidate.targetToken.id && event.forced)
      const shapechangerLock = settled.result.events.some((event) =>
        event.type === 'class-state-changed' && event.actorId === candidate.targetToken.id &&
        event.stateKey === 'shapechanger-reverted' && event.active)
      const shapechangerText = forcedShapechange?.type === 'monster-shapechanged'
        ? `，并被迫恢复为 ${getDnd5eSrdMonster(forcedShapechange.toStatBlockId)?.name ?? '真实形态'}${shapechangerLock ? '；离开月光前无法再次变形' : ''}`
        : shapechangerLock ? '，并恢复原本形态；离开月光前无法再次变形' : ''
      const concentrationEvent = settled.result.events.find((event) =>
        event.type === 'concentration-resolved' && event.actorId === candidate.targetToken.id)
      const concentrationText = concentrationEvent?.type === 'concentration-resolved'
        ? concentrationEvent.success ? '，专注维持' : '，专注中断'
        : ''
      logs.push(
        `${candidate.area.label} 在${({ 'on-create': '首次创建', 'on-enter': '进入区域', 'on-move-distance': '区域内移动', 'on-area-move-impact': '区域移动撞击', 'turn-start': '回合开始', 'turn-end': '回合结束', 'source-turn-start': '来源回合开始', 'source-turn-end': '来源回合结束', 'on-detonate': '区域引爆' } as const)[candidate.trigger.timing]}触发 ${prepared.prepared.targetName}${saveText}${triggerEvent?.type === 'persistent-area-triggered' && triggerEvent.damage > 0 ? `，造成 ${triggerEvent.damage} 点伤害` : ''}${triggerEvent?.type === 'persistent-area-triggered' && triggerEvent.conditionApplied ? `，施加 ${dnd5eConditionLabel(triggerEvent.conditionApplied)}` : ''}${triggerEvent?.type === 'persistent-area-triggered' && triggerEvent.semanticEffectApplied ? `，施加 ${triggerEvent.semanticEffectApplied.label}` : ''}${concentrationText}${shapechangerText}${triggerEvent?.type === 'persistent-area-triggered' ? dnd5ePersistentAreaNotificationLogSuffix(triggerEvent.notification) : ''}。`,
      )
    }
    return { map, characters, logs, events, traversalStop, state: hostState }
  
  }
  const settleDnd5ePersistentAreasForForcedMovement = async (input: {
    beforeMap: BattleMap
    afterMap: BattleMap
    characters: readonly Character[]
    tokenId: string
    round: number
    turnKey: string
  }): Promise<{ map: BattleMap; characters: Character[]; logs: string[] }> =>
    {
    const {} = context
return coordinateForcedMovementPersistentAreas({
      ...input,
      settleCandidates: settleDnd5ePersistentAreaCandidates,
    })
  }
  const settleDnd5eItemAreasForMove = async (input: {
    state: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Readonly<Record<string, string>>
    token: Token
    to: { x: number; y: number }
    path?: readonly { x: number; y: number }[]
    pathElevationsFeet?: readonly number[]
    carefulMovement?: boolean
    beforePersistentAreaSettlement?: (input: {
      map: BattleMap
      token: Token
      finalPosition: { x: number; y: number }
      path?: readonly { x: number; y: number }[]
      candidates: readonly ReturnType<typeof collectDnd5ePersistentAreaTriggers>[number][]
    }) => Promise<void>
  }, originalBinding?:MovementOriginalBinding): Promise<{
    state: Dnd5eHeadlessCombatState
    map: BattleMap
    application: Dnd5eMapResultPlan
    finalPosition: { x: number; y: number }
    logs: string[]
  }> => {
    if(originalBinding&&!issuedMovementOriginalBindings.has(originalBinding))throw Error('movement-original:actual-bound-context-required')
    const {rollDiceBoxD20Pair, deferNativeLuckyForBountifulOnMap, rollDiceBoxD20, rollDiceBoxValues, requestDnd5eSavingThrowRerollDice, resolveDnd5eHeadlessActionWithAirborneFalls, currentPersistentAreaTurnKey, roundRef, initiativeOrderRef} = context

    const entered = dnd5eItemAreasEnteredByMove({
      map: input.map,
      token: input.token,
      to: input.to,
      path: input.path ? [...input.path] : undefined,
      pathElevationsFeet: input.pathElevationsFeet,
    })
    let state = input.state
    let map = input.map
    let characters = input.characters
    let finalPosition = input.to
    const logs: string[] = []
    const areaLabels = { 'ball-bearings': '滚珠', caltrops: '铁蒺藜', 'hunting-trap': '捕猎陷阱' } as const
    for (const [entryIndex,entry] of entered.entries()) {
      const combatant = state.combatants[input.token.id]
      if (!combatant || (combatant.currentHp <= 0 && !dnd5eCanActAtZeroHitPoints(combatant))) break
      if (input.carefulMovement && entry.area.kind !== 'hunting-trap') {
        logs.push(`${combatant.name} 以半速谨慎穿过${areaLabels[entry.area.kind]}区域，无需进行敏捷豁免。`)
        continue
      }
      // Resolve the crossing where the item is actually entered, before any
      // failed-save feature or its pre-damage follow-up observes the world.
      const entryPosition=tokenCenterForAnchorCell(entry.enteredAt,input.token,map)
      const atEntry=projectDnd5eMovementHazardPosition({state,map,characters,characterIdByCombatantId:input.characterIdByCombatantId,initiativeOrder:initiativeOrderRef.current,tokenId:input.token.id,position:entryPosition,elevationFeet:mapGeometryTerrainElevationAtPoint(mapGeometryRuntimeForMap(map.id),entryPosition)})
      state=atEntry.state;map=atEntry.map;characters=atEntry.characters
      const entryCombatant=state.combatants[input.token.id]
      const mode = dnd5eSavingThrowMode(entryCombatant, 'dex', { effectVisible: true })
      const [d20, d20Second] = await rollDiceBoxD20Pair(`${areaLabels[entry.area.kind]}·敏捷豁免`, combatant.name, mode, { rollerTokenId: combatant.id, rollKind: 'saving-throw' })
      let retainedOriginal:readonly number[]|undefined,rawOriginalFrame:Dnd5eMovementOriginalFrame|undefined
      if(originalBinding&&(d20===1||d20Second===1)){
        const frame=Object.freeze({})as Dnd5eMovementOriginalFrame,action:Extract<Dnd5eAction,{type:'item-area-trigger'}>={type:'item-area-trigger',actorId:input.token.id,areaId:entry.area.id,areaKind:entry.area.kind,d20,d20Second},row:{binding:MovementOriginalBinding;state:Dnd5eHeadlessCombatState;action:typeof action;operationId:string;mode:D20RollMode;stage:'original';signature:string;ready?:string;retained?:readonly number[]}={binding:originalBinding,state:cloneDnd5eHostTransactionInput(state),action,operationId:JSON.stringify([originalBinding.fact.request.parentId,'movement-segment',originalBinding.fact.request.segmentIndex,'item-area',entryIndex,entry.area.id,input.token.id]),mode,stage:'original',signature:''}
        row.signature=movementOriginalSignature({state:row.state,action:row.action,operationId:row.operationId,mode:row.mode});movementOriginalFrames.set(frame,row);rawOriginalFrame=frame;const response=await originalBinding.resolve(frame)
        if(response&&!Array.isArray(response)){const proof=readDnd5eActualOriginalReadyBoundary(response);if(proof.resolve!==resolveDnd5eOpportunityMoveSequenceOriginal||readBountifulOpportunitySequenceMovementOriginalReplay(proof.input as Parameters<typeof readBountifulOpportunitySequenceMovementOriginalReplay>[0])?.at(-1)!==frame||proof.request.actorId!==action.actorId||proof.request.kind!=='saving-throw'||JSON.stringify(proof.request.originalRolls)!==JSON.stringify(d20Second===undefined?[d20]:[d20,d20Second]))throw Error('movement-original:exact-actual-ready-boundary-required');row.ready=movementReadySignature(proof);retainedOriginal=proof.request.values;row.retained=[...retainedOriginal]}else retainedOriginal=response as readonly number[]|undefined
      }
      const halflingLuckyD20 = !retainedOriginal && (combatant.racialRules?.halflingLucky && (!(d20 === 1) || !deferNativeLuckyForBountifulOnMap(combatant.id))) && d20 === 1
        ? await rollDiceBoxD20('半身人幸运·物品区域豁免重掷', combatant.name, { rollerTokenId: combatant.id, rollKind: 'saving-throw' })
        : undefined
      const halflingLuckyD20Second = !retainedOriginal && (combatant.racialRules?.halflingLucky && (!(d20Second === 1) || !deferNativeLuckyForBountifulOnMap(combatant.id))) && d20Second === 1
        ? await rollDiceBoxD20('半身人幸运·物品区域豁免重掷', combatant.name, { rollerTokenId: combatant.id, rollKind: 'saving-throw' })
        : undefined
      const damageRolls = entry.area.kind === 'hunting-trap'
        ? await rollDiceBoxValues(1, 4, '捕猎陷阱·穿刺伤害', combatant.name, { rollerTokenId: combatant.id })
        : undefined
      const areaAction: Extract<Dnd5eAction, { type: 'item-area-trigger' }> = {
        type: 'item-area-trigger', actorId: input.token.id, areaId: entry.area.id,
        areaKind: entry.area.kind, d20, d20Second, halflingLuckyD20, halflingLuckyD20Second, damageRolls,
      }
      // Preview uses a cloned state; only the final transaction is committed.
      const preview = retainedOriginal?withOriginalD20Preview(()=>resolveDnd5eHeadlessAction(state,{...areaAction,d20:retainedOriginal[0]!,d20Second:retainedOriginal[1]})):resolveDnd5eHeadlessAction(state, areaAction)
      const initialSave = preview.events.find(event => event.type === 'saving-throw-resolved')
      const targetCharacter = characters.find(character => character.id === input.characterIdByCombatantId[combatant.id])
      const rerollFeature = dnd5eSavingThrowRerollFeature(combatant)
      const reroll = preview.ok && initialSave?.type === 'saving-throw-resolved' &&
        !initialSave.success && targetCharacter && rerollFeature
        ? await requestDnd5eSavingThrowRerollDice({target: targetCharacter, targetName: combatant.name,
            featureName: rerollFeature.name, total: initialSave.total, dc: initialSave.dc, mode})
        : undefined
      const finalAreaAction:Extract<Dnd5eAction,{type:'item-area-trigger'}>={
        ...areaAction, rerollResourceKey: reroll?.resourceKey,
        rerollD20: reroll?.d20, rerollD20Second: reroll?.d20Second,
      },material={map,characters,characterIdByCombatantId:input.characterIdByCombatantId}
      let originalBoundary:Dnd5eMovementNativeBoundary|undefined,nativeOptions:MovementNativeOptions=originalBinding?{transactionId:JSON.stringify([originalBinding.fact.request.parentId,'movement-segment',originalBinding.fact.request.segmentIndex,'item-area',entryIndex,entry.area.id,input.token.id]),now:originalBinding.fact.source.prepared.input.firstHostNow}:undefined
      if(originalBinding?.resolveFinal&&rawOriginalFrame){const raw=movementOriginalFor(rawOriginalFrame,originalBinding.checkpoint);if(!raw.ready)throw Error('movement-original:actual-ready-boundary-required');originalBoundary=Object.freeze({})as Dnd5eMovementNativeBoundary;nativeOptions={transactionId:raw.operationId,now:originalBinding.fact.source.prepared.input.firstHostNow};const scope={raw:rawOriginalFrame,state:cloneDnd5eHostTransactionInput(state),action:cloneDnd5eHostTransactionInput(finalAreaAction),map:cloneDnd5eHostTransactionInput(map),options:nativeOptions,material:cloneDnd5eHostTransactionInput(material),resolve:resolveDnd5eHeadlessActionWithAirborneFalls,signature:''};scope.signature=movementOriginalSignature({state:scope.state,action:scope.action,map:scope.map,options:scope.options,material:scope.material});movementNativeBoundaries.set(originalBoundary,scope)}
      let triggered = await resolveDnd5eHeadlessActionWithAirborneFalls(state,finalAreaAction,map,nativeOptions,material,originalBoundary)
      if(originalBoundary&&!movementNativeBoundaries.get(originalBoundary)?.completed)throw Error('movement-original:actual-native-boundary-not-consumed')
      if (!triggered.ok) {
        logs.push(`${combatant.name} 进入${areaLabels[entry.area.kind]}区域，但 Headless 拒绝了触发：${triggered.reason}。`)
        break
      }
      if(triggered.events.some(event=>event.type==='concentration-check-required')){
        const native=triggered,application=triggered.application??planDnd5eMapResultApplication({state:triggered.state,map,characters,characterIdByCombatantId:input.characterIdByCombatantId,events:[...triggered.events]})
        const baseInput:Parameters<typeof settleDnd5eConcentrationChecksBase>[0]={result:native,priorState:state,map:application.map,characters:application.characters,priorApplication:application,characterIdByCombatantId:input.characterIdByCombatantId,
          hostParentTransactionId:nativeOptions?.transactionId,followupTransactionNow:originalBinding?()=>originalBinding.fact.source.prepared.input.firstHostNow:undefined,
          requestOptionalDamageSave:context.requestOptionalDamageSave,rollUnsupportedAirborneFalls:context.rollDnd5eUnsupportedAirborneFalls,settleMountedBalance:context.settleDnd5eMapMountedBalance,
          rollD20:rollDiceBoxD20,rollD4:async(label,name,owner)=>(await rollDiceBoxValues(1,4,label,name,owner))[0],rollDice:rollDiceBoxValues,
          requestHellishRebuke:context.requestSharedHellishRebukeChoice,chooseSpellDamageDice:request=>context.collectSharedSpellDamageDieChoices({...request,groups:[request.group]}),requestSavingThrowReroll:context.requestDnd5eSavingThrowRerollDice,requestBardicInspiration:context.requestDnd5eBardicInspirationRoll,requestOptionalBonusDie:context.requestDnd5eOptionalBonusDieUse,requestDarkOnesOwnLuck:context.requestDnd5eDarkOnesOwnLuckRoll,requestPostSpellRandomTableChoice:context.requestSharedPostSpellRandomTableChoice,requestPostSpellRandomTableAdjudication:context.requestSharedPostSpellRandomTableAdjudication}
        let settled:Awaited<ReturnType<typeof settleDnd5eConcentrationChecksBase>>
        if(originalBinding?.resolveConcentration){const checkpoint=Object.freeze({}),row:MovementConcentrationRow={binding:originalBinding,entryIndex,areaId:entry.area.id,areaKind:entry.area.kind,actorId:input.token.id,operationId:nativeOptions!.transactionId!,native,priorState:cloneDnd5eHostTransactionInput(state),application:cloneDnd5eHostTransactionInput(application),signature:''};row.signature=movementConcentrationMaterial(row);movementConcentrationCheckpoints.set(checkpoint,row);settled=await originalBinding.resolveConcentration(checkpoint);movementConcentrationFor(checkpoint)}else settled=await context.settleDnd5eConcentrationChecks(baseInput)
        readDnd5eCompletedCombatBase(native,settled)
        if(originalBinding){const skip=originalBoundary?native.events.length:0;if(skip&&movementOriginalSignature(settled.result.events.slice(0,skip))!==movementOriginalSignature(native.events))throw Error('movement-concentration:changed-native-prefix');originalBinding.events.push(...cloneDnd5eHostTransactionInput(settled.result.events.slice(skip)))}
        triggered={...settled.result,application:settled.application}
      }
      state = triggered.state
      if (triggered.application) {
        characters = triggered.application.characters
        map = triggered.application.map
      }
      const save = triggered.events.find((event) => event.type === 'saving-throw-resolved')
      if (save?.type !== 'saving-throw-resolved') continue
      logs.push(`${combatant.name} 进入${areaLabels[entry.area.kind]}区域，敏捷豁免 ${save.total} vs DC ${save.dc}：${save.success ? '成功' : '失败'}。`)
      if (save.success) {
        const resumed=projectDnd5eMovementHazardPosition({state,map,characters,characterIdByCombatantId:input.characterIdByCombatantId,initiativeOrder:initiativeOrderRef.current,tokenId:input.token.id,position:input.to,elevationFeet:input.state.combatants[input.token.id]?.elevationFeet})
        state=resumed.state;map=resumed.map;characters=resumed.characters
        continue
      }
      finalPosition = tokenCenterForAnchorCell(entry.enteredAt, input.token, map)
      const movedCombatant = state.combatants[input.token.id]
      if (movedCombatant) movedCombatant.position = { ...finalPosition }
      if (entry.area.kind === 'hunting-trap') {
        map = {
          ...map,
          dnd5eItemAreas: markDnd5eHuntingTrapTriggered(map.dnd5eItemAreas, entry.area.id, input.token.id),
        }
      }
      break
    }
    const baseApplication = planDnd5eMapResultApplication({
      state,
      map,
      characters,
      baselineCharacters: input.characters,
      characterIdByCombatantId: input.characterIdByCombatantId,
    })
    const traversedTrace = input.path ? truncateTokenMovementTrace({ path: input.path,
      pathElevationsFeet: input.pathElevationsFeet, finalPosition,
      finalElevationFeet: state.combatants[input.token.id]?.elevationFeet }) : undefined
    const traversedPath = traversedTrace?.path
    const traversedPathElevationsFeet = traversedTrace?.pathElevationsFeet
    const turnKey = currentPersistentAreaTurnKey(roundRef.current, input.token.id)
    // Player movement may already be optimistically projected into the map
    // snapshot passed to this settlement. The first authoritative path point is
    // the stable pre-move position used for source-area lifecycle comparisons.
    const movementOrigin = traversedPath?.[0] ?? { x: input.token.x, y: input.token.y }
    const beforeSourceMap = {
      ...input.map,
      tokens: input.map.tokens.map((token) =>
        token.id === input.token.id
          ? { ...token, x: movementOrigin.x, y: movementOrigin.y }
          : token,
      ),
    }
    const movedSourceMap = {
      ...baseApplication.map,
      tokens: baseApplication.map.tokens.map((token) =>
        token.id === input.token.id
          ? { ...token, x: finalPosition.x, y: finalPosition.y }
          : token,
      ),
    }
    // Reconcile source-bound areas while their persisted anchor still records
    // the pre-move cell. Anchoring first would erase the evidence that the
    // source moved, so wards such as Antilife Shell could incorrectly survive
    // after their caster moved an affected living creature through the shell.
    // Keep concentration state in the same movement transaction as the area.
    const sourceMovementReconciliation = reconcileDnd5ePluginAreasAfterSourceMove({
      beforeMap: beforeSourceMap,
      afterMap: movedSourceMap,
      characters: baseApplication.characters,
      round: roundRef.current,
      sourceTokenId: input.token.id,
      path: traversedPath,
      pathElevationsFeet: traversedPathElevationsFeet,
    })
    const afterSourceMap = sourceMovementReconciliation.map
    const flightCapableTokenIds = dnd5ePersistentAreaFlightCapableTokenIds({ map: afterSourceMap, characters: sourceMovementReconciliation.characters, round: roundRef.current })
    const sizeRanksByTokenId = dnd5ePersistentAreaSizeRanks({ map: afterSourceMap, characters: sourceMovementReconciliation.characters, round: roundRef.current })
    const pluginCandidates = collectDnd5ePersistentAreaTriggers({
      sizeRanksByTokenId,
      flightCapableTokenIds,
      map: afterSourceMap,
      timing: 'on-enter',
      round: roundRef.current,
      turnKey,
      movement: {
        token: input.token,
        to: finalPosition,
        path: traversedPath,
        pathElevationsFeet: traversedPathElevationsFeet,
      },
    })
    const movementDistanceCandidates = collectDnd5ePersistentAreaTriggers({
      sizeRanksByTokenId,
      map: afterSourceMap,
      timing: 'on-move-distance',
      round: roundRef.current,
      turnKey,
      movement: {
        token: input.token,
        to: finalPosition,
        path: traversedPath,
        pathElevationsFeet: traversedPathElevationsFeet,
      },
    })
    const sourceAuraCandidates = collectDnd5ePersistentAreaTriggersForSourceMove({
      sizeRanksByTokenId,
      flightCapableTokenIds,
      beforeMap: beforeSourceMap,
      afterMap: afterSourceMap,
      sourceTokenId: input.token.id,
      round: roundRef.current,
      turnKey,
    })
    const persistentAreaCandidates = [...pluginCandidates, ...movementDistanceCandidates, ...sourceAuraCandidates]
      .sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0))
    if (persistentAreaCandidates.length > 0) {
      await input.beforePersistentAreaSettlement?.({
        map: afterSourceMap,
        token: input.token,
        finalPosition,
        path: traversedPath,
        candidates: persistentAreaCandidates,
      })
    }
    const pluginAreas = await settleDnd5ePersistentAreaCandidates({
      candidates: persistentAreaCandidates,
      map: afterSourceMap,
      characters: sourceMovementReconciliation.characters,
      round: roundRef.current,
      movementTokenId: input.token.id,
    })
    logs.push(...pluginAreas.logs)
    const failedGreaseCheckpoint = dnd5eFailedAreaMovementCheckpoint({
      map: afterSourceMap,
      token: input.token,
      candidates: persistentAreaCandidates,
      events: pluginAreas.events,
    })
    const movementCheckpoint = [failedGreaseCheckpoint, pluginAreas.traversalStop]
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .sort((left, right) => left.pathIndex - right.pathIndex)[0]
    if (movementCheckpoint) finalPosition = movementCheckpoint.position
    const checkpointElevation = movementCheckpoint
      ? (movementCheckpoint === failedGreaseCheckpoint ? failedGreaseCheckpoint?.elevationFeet : undefined) ??
        traversedPathElevationsFeet?.[movementCheckpoint.pathIndex]
      : undefined
    let settledPluginMap = movementCheckpoint
      ? {
          ...pluginAreas.map,
          tokens: pluginAreas.map.tokens.map((token) => token.id === input.token.id
            ? { ...token, x: finalPosition.x, y: finalPosition.y,
                ...(checkpointElevation != null && Number.isFinite(checkpointElevation)
                  ? { elevationFeet: checkpointElevation } : {}) }
            : token),
        }
      : pluginAreas.map
    const flameTrace = truncateTokenMovementTrace({ path: traversedPath ?? [movementOrigin, finalPosition],
      pathElevationsFeet: traversedPathElevationsFeet, finalPosition,
      finalElevationFeet: checkpointElevation ?? state.combatants[input.token.id]?.elevationFeet,
      stopPathIndex: movementCheckpoint?.pathIndex })
    const flamePath = flameTrace.path
    const flameGeometry = useMapGeometryStore.getState().maps.find(geometry => geometry.mapId === settledPluginMap.id)
    const flames = await settleStrongWindFlamesAlongMovement({ lights: flameGeometry?.lights, worldMinute: readBrowserSceneWorldMinute() ?? undefined, beforeMap: beforeSourceMap, map: settledPluginMap,
      tokenId: input.token.id, path: flamePath,
      pathElevationsFeet: flameTrace.pathElevationsFeet,
      round: Math.max(1, roundRef.current), transactionId: `move-flame:${crypto.randomUUID()}`,
      roll: async candidate => (await rollDiceBoxValues(1, 100,
        `${candidate.areaLabel} · 受保护火焰（1–50 熄灭）`, candidate.targetName,
        { freeRoll: true, skipChoiceReroll: true }))[0],
    })
    settledPluginMap = flames.map
    logs.push(...flames.logs)
    const changedCharacterIds = pluginAreas.characters.flatMap((character) => {
      const before = input.characters.find((candidate) => candidate.id === character.id)
      return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
    })
    const changedTokenIds = settledPluginMap.tokens.flatMap((token) => {
      const before = input.map.tokens.find((candidate) => candidate.id === token.id)
      return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
    })
    return {
      state,
      map: settledPluginMap,
      finalPosition,
      logs,
      application: {
        map: settledPluginMap,
        geometry: flameGeometry && flames.lights?.some((light, index) => light !== flameGeometry.lights?.[index])
          ? { ...flameGeometry, lights: [...flames.lights], updatedAt: runtimeNow() } : undefined,
        characters: pluginAreas.characters,
        changedCharacterIds,
        changedTokenIds,
      },
    }
  
  }
  const settleDnd5eMovementHazards = async (input: {
    initialApplication?: Dnd5eMapResultPlan
    state: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Readonly<Record<string, string>>
    movements: readonly {
      tokenId: string
      to: { x: number; y: number }
      path: readonly { x: number; y: number }[]
      pathElevationsFeet?: readonly number[]
    }[]
    settleSolidMaterialEndpoint?: boolean
    carefulMovementActorId?: string
    beforePersistentAreaSettlement?: Parameters<typeof settleDnd5eItemAreasForMove>[0]['beforePersistentAreaSettlement']
  }) => {
    const {initiativeOrderRef, resolveDnd5eForcedFallInterrupts, damageReactionOptionsForMap, currentPersistentAreaTurnKey, initiativeOrderForHeadlessState} = context
    const originalBinding=movementOriginalInputs.get(input)
return coordinateDnd5eMovementHazards({ worldMinute: readBrowserSceneWorldMinute(),
    ...input,
    initiativeOrder: input.state.active === false ? [] : initiativeOrderRef.current,
    settleEndpoint: input.settleSolidMaterialEndpoint ? async (settled, movement) => {
      const exit = settleDnd5eSolidMaterialExit({ state: settled.state, map: settled.application.map,
        geometry: mapGeometryRuntimeForMap(settled.map.id), actorId: movement.tokenId, movementSourceState: input.state })
      if (!exit.ok) throw new Error(exit.reason)
      if (!exit.events.length) return settled
      const pushedIds = exit.events.flatMap(event => event.type === 'moved' ? [event.actorId] : [])
      const falls = previewDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(settled.state, exit.state, pushedIds)
      const interrupts = await resolveDnd5eForcedFallInterrupts(exit.state, falls, settled.application.map,
        `solid-exit:${settled.state.combatId}:${settled.state.round}:${movement.tokenId}`, '推出后坠落伤害')
      const landed = await resolveDnd5ePreparedWithDamageReactions(damageReactionOptionsForMap(settled.application.map),{prepared:{state:interrupts.state}},value=>resolveDnd5eUnsupportedAirborneFallsAfterEnvironmentalChange(settled.state, value.prepared.state,
        interrupts.fallingDamageRollsByCombatantId, pushedIds))
      if (!landed.ok) throw new Error(landed.reason)
      const application = planDnd5eMapResultApplication({ state: landed.state, map: settled.application.map,
        characters: settled.application.characters, characterIdByCombatantId: Object.fromEntries(
          settled.application.map.tokens.flatMap(token => token.characterId ? [[token.id, token.characterId]] : [])),
        events: [...exit.events, ...interrupts.events, ...landed.events] })
      let forcedAreas = { map: application.map, characters: application.characters, logs: [] as string[] }
      for (const tokenId of new Set(pushedIds)) {
        const next = await settleDnd5ePersistentAreasForForcedMovement({ beforeMap: settled.application.map,
          afterMap: forcedAreas.map, characters: forcedAreas.characters, tokenId,
          round: landed.state.round, turnKey: currentPersistentAreaTurnKey(landed.state.round, tokenId) })
        forcedAreas = { ...next, logs: [...forcedAreas.logs, ...next.logs] }
      }
      const refreshed = createDnd5eMapCombatSnapshot({ map: forcedAreas.map, characters: forcedAreas.characters,
        combatId: landed.state.combatId, round: landed.state.round, turnSlotId: landed.state.turnSlotId,
        worldMinute: readBrowserSceneWorldMinute(), initiativeOrder: initiativeOrderForHeadlessState(landed.state),
        additionalCreatureTokenIds: Object.keys(landed.state.combatants) })
      const finalApplication = { ...application, map: forcedAreas.map, characters: forcedAreas.characters }
      return { ...settled, state: { ...refreshed.state, active: landed.state.active, initiativeIndex: landed.state.initiativeIndex },
        map: forcedAreas.map, application: finalApplication,
        finalPosition: refreshed.state.combatants[movement.tokenId]?.position ?? landed.state.combatants[movement.tokenId].position,
        logs: [...settled.logs, '土石穿行结束于实体内：已推出至空位，结束来源法术并施加震慑。', ...forcedAreas.logs] }
    } : undefined,
    settleStep: ({
      state,
      map,
      characters,
      characterIdByCombatantId,
      token,
      movement,
      carefulMovement,
    }) => settleDnd5eItemAreasForMove({
      state,
      map,
      characters,
      characterIdByCombatantId,
      token,
      to: movement.to,
      path: movement.path,
      pathElevationsFeet: movement.pathElevationsFeet,
      carefulMovement,
      beforePersistentAreaSettlement: input.beforePersistentAreaSettlement,
    },originalBinding),
  })
  }
  const producer={settleDnd5ePersistentAreaCandidates, settleDnd5ePersistentAreasForForcedMovement, settleDnd5eItemAreasForMove, settleDnd5eMovementHazards}
  issuedMovementProducers.set(producer,settleDnd5eMovementHazards)
  issuedMovementProducerContexts.set(producer,context)
  return producer
}
