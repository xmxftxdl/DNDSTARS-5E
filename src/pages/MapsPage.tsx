import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import {
  Upload,
  Grid3x3,
  Trash2,
  Skull,
  User,
  X,
  Swords,
  Play,
  Square,
  SkipForward,
  Ruler,
  UserPlus,
  ChevronUp,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  GripVertical,
  GripHorizontal,
  RefreshCw,
  Move,
  Magnet,
  Eye,
  LocateFixed,
  ArrowUpRight,
  Circle as CircleIcon,
  Eraser,
} from 'lucide-react'
import MapCanvas from '../components/map/MapCanvas'
import type { DeleteSelectionRect } from '../components/map/MapCanvas'
import MapGeometryToolbar from '../components/map/MapGeometryToolbar'
import InitiativeTracker, {
  INITIATIVE_VISIBLE_MAX,
  type InitiativeEntry,
} from '../components/map/InitiativeTracker'
import CharacterRailEntry from '../components/map/CharacterRailEntry'
import { CHAR_PANEL_TITLES, type CharDockPanel } from '../components/map/characterRailConfig'
import ClassResourceIndicators from '../components/map/ClassResourceIndicators'
import MapInventoryPanel from '../components/map/MapInventoryPanel'
import MapSpellsPanel from '../components/map/MapSpellsPanel'
import EnemyPoolPicker from '../components/map/EnemyPoolPicker'
import EnemyDetailPanel from '../components/map/EnemyDetailPanel'
import { canShowEnemyDetail } from '../components/map/enemyDetailPanelUtils'
import { shouldClearSelectedMapToken } from '../components/map/mapTokenSelection'
import CharacterDetailPanel from '../components/map/CharacterDetailPanel'
import Dnd5eFighterCombatPanel from '../components/map/Dnd5eFighterCombatPanel'
import Dnd5eClassCombatPanel from '../components/map/Dnd5eClassCombatPanel'
import Dnd5eAbilityCheckPanel from '../components/map/Dnd5eAbilityCheckPanel'
import Dnd5ePluginCombatPanel from '../components/map/Dnd5ePluginCombatPanel'
import Dnd5eActiveEffectDetailsDialog from '../components/map/Dnd5eActiveEffectDetailsDialog'
import D20RollConfirmationOverlay from '../components/map/D20RollConfirmationOverlay'
import CombatSettlementPanel, { type ManualSettlementTarget } from '../components/map/CombatSettlementPanel'
import CombatExperienceSettlementDialog from '../components/map/CombatExperienceSettlementDialog'
import DiceRollOverlay from '../components/DiceRollOverlay'
import type { DiceRoll } from '../components/DiceRollOverlay'
import DiceBoxD20Overlay from '../components/DiceBoxD20Overlay'
import DiceBoxRollOverlay from '../components/DiceBoxRollOverlay'
import { DICE_TIMING } from '../lib/diceOverlayShared'
import { characterHpTokenPatch, projectCharacterTokenPresentations, useMapStore } from '../store/maps'
import { useFogStore } from '../store/fog'
import { useMapGeometryStore } from '../store/mapGeometry'
import { useMapExplorationStore } from '../store/mapExploration'
import { useCombatStatisticsStore } from '../store/combatStatistics'
import type { BattleMap, Token } from '../store/maps'
import { useCharacterStore } from '../store/characters'
import { useSpellbookStore } from '../store/spellbook'
import { getRoomSession } from '../lib/roomSession'
import { loadRoomRoster } from '../lib/roomApi'
import { getRoomRulesSnapshot, subscribeRoomRules } from '../lib/roomRulesState'
import {
  clearSharedEventBacklog,
  clearSharedResource,
  loadSharedResource,
  mutateSharedCombatInterrupt,
  publishSharedEvent,
  saveSharedResource,
  subscribeSharedEvent,
  subscribeSharedResourceInvalidation,
} from '../lib/sharedApi'
import type { Character } from '../types/character'
import type { Dnd5eInventoryTargeting } from '../types/inventory'
import type { FogTool } from '../lib/fogOfWar'
import {
  createEmptyMapGeometry,
  MAP_GEOMETRY_CREATURE_COVER_PREFIX,
  mapGeometryCoverBetween,
  mapGeometryLineOfEffectBlocked,
  mapGeometryRuntimeForMap,
  mapGeometryTerrainElevationAtPoint,
  type MapGeometryTool,
  type MapGeometryWallMaterial,
} from '../lib/mapGeometry'
import { mapExplorationPolygonsForTokenPath } from '../lib/mapExploration'
import {
  EMPTY_MAP_TABLETOP_STATE,
  MAP_TABLETOP_CHANNEL,
  clearMapTabletopAnnotations,
  mapTabletopForMap,
  publishMapTabletopAnnotation,
  publishMapTabletopFocus,
  publishMapTabletopPing,
  reduceMapTabletopState,
  type MapTabletopState,
  type MapTabletopTool,
} from '../lib/mapTabletop'
import { findMapGeometryPath } from '../lib/mapPathfinding'
import { ABILITIES, SKILLS } from '../lib/dnd'
import { formatDnd5eCombatLogDetails } from '../lib/combatLogDetails'
import {
  createCombatExperienceDraft,
  createCombatExperienceSettlement,
  type CombatExperienceAward,
  type CombatExperienceDistributionMode,
  type CombatExperienceDraft,
} from '../lib/combatExperience'
import { isMovementLocked, isTokenMovementLocked } from '../lib/combatStatus'
import {
  canSubmitPlayerCombatAction,
} from '../lib/playerActionAuthorityRouter'
import { planPlayerActionAuthorityExecution } from '../lib/playerActionAuthorityExecution'
import { areOpposedCombatTokens, dnd5eCombatTokenSide } from '../lib/opportunityAttacks'
import {
  clearCharacterScopedRecord,
  removeDisengagedCharacterId,
} from '../lib/playerEndTurnAction'
import {
  buildPlayerActionAck,
  persistPlayerActionProcessedState,
} from '../lib/playerActionAck'
import { publishPlayerActionAckWithSnapshots } from '../lib/playerActionAckPublish'
import {
  COMBAT_INTERRUPT_RESOURCE,
  createCombatInterrupt,
  isCombatInterruptExpired,
  shouldCombatInterruptWaitForDm,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from '../lib/combatInterruptQueue'
import { resolveDmCombatInterruptSettlements } from '../lib/combatInterruptDmSettlement'
import { applyDmCombatInterruptSettlements } from '../lib/combatInterruptSettlementRuntime'
import { requestAndWaitForCombatInterrupt } from '../lib/combatInterruptRequestRuntime'
import {
  answerSharedCombatInterrupt as persistAnswerSharedCombatInterrupt,
  contributeSharedCombatInterrupt as persistContributeSharedCombatInterrupt,
  finishSharedCombatInterrupt as persistFinishSharedCombatInterrupt,
  publishSharedCombatInterrupt as persistPublishSharedCombatInterrupt,
  rollbackSharedCombatInterrupt as persistRollbackSharedCombatInterrupt,
  waitSharedCombatInterruptForDm as persistWaitSharedCombatInterruptForDm,
} from '../lib/combatInterruptSync'
import {
  type OpportunityAttackInterruptPayload,
  type OpportunityAttackInterruptResponse,
  type ProtectionInterruptPayload,
  type ProtectionInterruptResponse,
  type ShieldSpellInterruptPayload,
  type ShieldSpellInterruptResponse,
  type CounterspellInterruptPayload,
  type CounterspellInterruptResponse,
  type UncannyDodgeInterruptPayload,
  type UncannyDodgeInterruptResponse,
  type DeflectMissilesInterruptPayload,
  type DeflectMissilesInterruptResponse,
  type SavingThrowRerollInterruptPayload,
  type SavingThrowRerollInterruptResponse,
  type LegendaryResistanceInterruptPayload,
  type LegendaryResistanceInterruptResponse,
  type BardicInspirationInterruptPayload,
  type BardicInspirationInterruptResponse,
  type BardicInspirationRollType,
  type CuttingWordsInterruptPayload,
  type CuttingWordsInterruptResponse,
  type DarkOnesOwnLuckInterruptPayload,
  type DarkOnesOwnLuckInterruptResponse,
  type StrokeOfLuckInterruptPayload,
  type StrokeOfLuckInterruptResponse,
  type EmpoweredSpellInterruptPayload,
  type EmpoweredSpellInterruptResponse,
  type StandAgainstTideInterruptPayload,
  type StandAgainstTideInterruptResponse,
  type PluginChoiceInterruptPayload,
  type PluginChoiceInterruptResponse,
  type DmAdjudicationEffect,
  type DmAdjudicationInterruptPayload,
  type DmAdjudicationInterruptResponse,
  type CombatInterruptByKind,
  defaultCombatInterruptResponse,
  isCombatInterruptKind,
} from '../lib/combatInterruptProtocol'
import {
  createD20ReplacementContribution,
  createD20RollConfirmationInterrupt,
  resolvedD20Value,
  settleD20RollConfirmation,
} from '../lib/rollConfirmation'
import {
  buildDmControlledCombatInterruptPromptViews,
  buildCombatInterruptPromptViews,
  resolveCombatInterruptPromptSelection,
  type SharedOpportunityAttackPromptView,
  type SharedProtectionPromptView,
  type SharedShieldSpellPromptView,
  type SharedCounterspellPromptView,
  type SharedUncannyDodgePromptView,
  type SharedDeflectMissilesPromptView,
  type SharedSavingThrowRerollPromptView,
  type SharedBardicInspirationPromptView,
  type SharedCuttingWordsPromptView,
  type SharedDarkOnesOwnLuckPromptView,
  type SharedStrokeOfLuckPromptView,
  type SharedEmpoweredSpellPromptView,
  type SharedStandAgainstTidePromptView,
  type SharedPluginChoicePromptView,
} from '../lib/combatInterruptPrompts'
import {
  answerInterruptWindow,
  appendRollLedgerEntry,
  closeInterruptWindow,
  createCombatTransaction,
  openInterruptWindow,
  rerollLedgerDie,
  type CombatTransaction,
} from '../lib/combatTransaction'
import { getEnemyStatBlock } from '../lib/enemyStatBlocks'
import {
  type Dnd5eFighterFeatureId,
  type Dnd5eClassId,
  type Dnd5eClassDamageRolls,
  type Dnd5eCuttingWordsUse,
  type Dnd5eHunterMultiattackResolutionRoll,
  type Dnd5eMonkBonusAttackRoll,
  type Dnd5eActionResult,
  type Dnd5eMapResultPlan,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eTranquilitySaveRoll,
  type Dnd5eTranquilityWardCheck,
  type Dnd5eSpellTargetAttackRoll,
  type Dnd5eEmpoweredSpellReroll,
  type Dnd5eStandAgainstTideUse,
  type Dnd5eCounterspellReaction,
  type Dnd5eDispelMagicCheck,
  type Dnd5eWeaponClassDamageContext,
  type Dnd5eDamageType,
  type Dnd5eStandardConditionId,
  type Dnd5eSpellTargetSavingThrowRoll,
  type Dnd5eSpellForcedMovement,
  type Dnd5eTargetTranquilitySaveRoll,
  type Dnd5eActiveEffectSavingThrowRoll,
  type Dnd5eActiveEffectInstance,
  type Dnd5ePluginDiceRollResult,
  type Dnd5ePluginTargeting,
  type Dnd5ePersistentAreaDmAdjustment,
  type Dnd5ePersistentAreaTriggerCandidate,
  type PreparedDnd5ePersistentAreaTrigger,
  type PreparedDnd5eEquipmentAttack,
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  type PreparedDnd5eAdjudicatedSpell,
  type PreparedDnd5ePluginFeatureAction,
  applyDnd5eInitiativeResourceFeatures,
  createDnd5eTurnEconomyCounts,
  createDnd5eMapCombatSnapshot,
  applyDnd5eAttackCoverOverride,
  dnd5eAttackCoverForPair,
  dnd5eClassDefinition,
  dnd5eCharacterClassLevel,
  dnd5eClassFeatureLabel,
  dnd5eCarefulSpellMaximumTargets,
  dnd5eCanUseUncannyDodge,
  dnd5eCanUseDeflectMissiles,
  dnd5eMonkMartialArtsDie,
  dnd5eCanCastShieldSpell,
  dnd5eCounterspellSlotLevels,
  dnd5eCounterspellCastingAbility,
  dnd5eCombatantPairKey,
  dnd5eSavingThrowRerollFeature,
  dnd5eSavingThrowMode,
  dnd5eHeldBardicInspirationDie,
  dnd5eBardicInspirationDie,
  dnd5eDarkOnesOwnLuckAvailable,
  dnd5eCombatantHasConcentrationEffect,
  dnd5eCombatantClassLevel,
  dnd5eCombatantHasSubclass,
  dnd5eTargetArmorClassForAttack,
  dnd5eRepeatedMeleeAttackMode,
  dnd5eWeaponClassDamageDefinitions,
  dnd5eTranquilityWardCheck,
  dnd5eEffectiveWalkingSpeed,
  dnd5eActiveSpeedPenalty,
  dnd5eActiveStandardConditions,
  dnd5eConditionLabel,
  dnd5eStandardConditionId,
  findDnd5eOpportunityAttackersForMove,
  grantDnd5eActionSurge,
  getDnd5eSrdMonster,
  normalizeDnd5eTurnEconomyCounts,
  planDnd5eMonsterTurn,
  dnd5eEquipmentClassDamageDefinitions,
  dnd5eHunterMultiattackClassDamageDefinitions,
  prepareDnd5eClassFeature,
  prepareDnd5ePluginFeatureAction,
  prepareDnd5ePluginSpellCast,
  dnd5ePluginFeatureDefinition,
  dnd5ePluginSpellDefinition,
  dnd5ePluginHeadlessActionDefinition,
  executeDnd5ePluginDiceRolls,
  reconcileDnd5ePluginAreasOnMap,
  collectDnd5ePersistentAreaTriggers,
  prepareDnd5ePersistentAreaTrigger,
  resolvePreparedDnd5ePersistentAreaTrigger,
  prepareDnd5eAbilityCheck,
  prepareDnd5eEquipmentAttack,
  prepareDnd5eFighterFeature,
  prepareDnd5eHunterMultiattack,
  prepareDnd5eMonsterAttack,
  prepareDnd5eOpportunityAttack,
  prepareDnd5ePlayerEndTurn,
  prepareDnd5ePlayerMove,
  prepareDnd5ePlayerBasicAction,
  prepareDnd5eSpellCast,
  prepareDnd5eCoreSpellAreaMove,
  prepareDnd5eAdjudicatedSpell,
  dnd5eSpellbookEntries,
  dnd5eRepellingBlastPushDestination,
  previewDnd5eEquipmentAttack,
  previewPreparedDnd5eAbilityCheck,
  previewDnd5eHunterMultiattack,
  dnd5eAttackModeWithProtection,
  dnd5eMonsterAttackModeWithProtection,
  dnd5eMetamagicCost,
  dnd5eMetamagicLabel,
  dnd5ePreparedMonsterAttackMode,
  dnd5eSpellAttackModeWithProtection,
  dnd5eCanSculptSpell,
  dnd5eSculptSpellMaximumTargets,
  dnd5eSpellAllowsRepeatedTargets,
  dnd5eSpellAreaLabel,
  dnd5eSpellMaximumTargets,
  dnd5eSpellUsesSequencedAttacks,
  dnd5eSelectedFightingStyles,
  dnd5eOffHandWeaponAttackProfile,
  dnd5eWeaponAttackProfile,
  dnd5eWeaponRangeFeet,
  getDnd5eSrdCombatSpell,
  getDnd5eSrdSpellCatalogEntry,
  previewDnd5eMonkBonusAttack,
  previewDnd5eMonsterAttack,
  previewDnd5eOpportunityAttack,
  previewDnd5eSpellAttack,
  previewDnd5eSpellTargetAttack,
  previewDnd5eSpellSavingThrow,
  previewDnd5eSpellTargetSavingThrow,
  previewDnd5eSavingThrowRoll,
  resolveDnd5ePlayerDisengage,
  resolveDnd5ePlayerDodge,
  resolveDnd5ePlayerEndTurn,
  resolvePreparedDnd5eClassFeature,
  resolvePreparedDnd5ePluginFeatureAction,
  planDnd5eSummonedCreature,
  rebaseDnd5eSummonedCreatureTokens,
  resolvePreparedDnd5ePluginSpellCast,
  resolvePreparedDnd5eAbilityCheck,
  resolvePreparedDnd5eEquipmentAttack,
  resolvePreparedDnd5eFighterFeature,
  resolvePreparedDnd5eHunterMultiattack,
  resolvePreparedDnd5eMonsterAttack,
  resolvePreparedDnd5eOpportunityAttack,
  resolvePreparedDnd5ePlayerMove,
  resolvePreparedDnd5ePlayerBasicAction,
  triggerDnd5eReadiedAction,
  resolvePreparedDnd5eSpellCast,
  resolvePreparedDnd5eCoreSpellAreaMove,
  resolvePreparedDnd5eAdjudicatedSpell,
  resolveDnd5eMonsterMapMove,
  resolveDnd5eHeadlessAction,
  setDnd5eHeadlessResolutionObserver,
  planDnd5eMapResultApplication,
  spendDnd5eMovement,
  spendDnd5eTurnResource,
  spendDnd5eInventoryResource,
  dnd5eAttackRollRerollCandidates,
  applyDnd5eInventoryMutation,
  dnd5eItemAreasEnteredByMove,
  markDnd5eHuntingTrapTriggered,
  placeDnd5eItemArea,
  previewDnd5eItemAreaPlacement,
  reconcileDnd5eSummonedCreatures,
  getDnd5eCoreSpellAreaDeclaration,
  mergeDnd5eSpellEffectTokenDelta,
  dnd5ePersistentAreaDifficultTerrainMultiplierAt,
  dnd5ePersistentAreaSpeedCostMultiplierAt,
  dnd5eClimbingMovementCost,
  dnd5eRunningJumpBonusFeet,
} from '../rulesets/dnd5e'
import { dnd5eFallingDamageDice, dnd5eTraversalMovementCost, type Dnd5eTraversalMode } from '../rulesets/dnd5e/traversal'
import {
  clampGridSize,
  cellKey,
  gridSizeBounds,
  cellDistance,
  movementRadiusPx,
  occupiedCells,
  pixelToCell,
  snapTokenToGridCenter,
  tokenAnchorCellFromPixel,
  tokenFootprintDistanceCells,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../lib/gridCombat'
import {
  aoeOrientFromCell,
  aoeUsesMouseAim,
  canPlaceAoe,
  cellsForAoe,
  tokensInCells,
  type SkillAoeTargeting,
} from '../lib/skillTargeting'
import { applyGridDetectPatch, detectGridFromBlob, detectImageGrid } from '../lib/gridDetect'
import { getImage } from '../lib/imageStore'
import { clearEnemyAiWarnings, type EnemyTurnResult } from '../lib/enemyAi'
import {
  checkCombatOutcome,
  characterNeedsDeathSave,
  decideTurnAction,
  hasActionableActor,
  isTokenAlive,
  isTokenDefeated,
  pruneInitiativeForToken,
} from '../lib/combatTokens'
import { enemyTemplateToTokenPatch, type EnemyTemplate } from '../lib/enemyPool'
import { modeFromPort } from '../lib/appMode'
import {
  DmActionTransactionCoordinator,
  type DmAuthoritativeActionOutcome,
} from '../lib/dmActionTransactionCoordinator'
import { runMapsPlayerActionTransaction } from './maps/runMapsPlayerActionTransaction'
import { TimerRegistry } from '../lib/timerRegistry'
import {
  currentPlayerSlot,
  getAssignedPlayerCharacterId,
  getPlayerCharacter,
  playerViewCharacters,
  PLAYER_ASSIGNMENT_EVENT,
} from '../lib/playerView'
import type {
  Dnd5eClassFeaturePayload,
  Dnd5eBasicActionPayload,
  Dnd5ePluginActionPayload,
  Dnd5eItemUsePayload,
  Dnd5eAbilityCheckPayload,
  Dnd5eSpellCastPayload,
  Dnd5ePersistentAreaMovePayload,
  Dnd5eAdjudicatedSpellPayload,
  Dnd5eSpellMetamagicPayload,
  Dnd5eAttackCoverOverride,
  Dnd5eWeaponAttackOptions,
  Dnd5eTurnEconomyByToken,
  Dnd5eTurnEconomyCounts,
  Mode,
  SharedCombatState,
  SharedPlayerActionState,
  SharedPlayerActionRequestQueueState,
  SharedPlayerActionProcessedState,
  SharedPlayerActionAckState,
  SharedDiceState,
  SharedDiceEventsState,
  SharedRollRequestEvent,
  SharedRollRequestPayload,
  SharedCombatLogState,
  CombatLogEntry,
} from '../lib/sharedCombatTypes'
import {
  prepareDnd5eMapInteraction,
  resolveDnd5eMapInteraction,
  type Dnd5eMapInteractionPayload,
  type PreparedDnd5eMapInteraction,
} from '../rulesets/dnd5e/mapInteraction'
import { dnd5eAbilityCheckModifier, dnd5eSkillCheckModifier } from '../rulesets/dnd5e/checks'
import { createTokenMovementAnimation, truncateTokenMovementPath } from '../lib/tokenMovementAnimation'
import {
  TOKEN_MOVE_MS,
  ADVANCE_DELAY_MS,
  ADVANCE_GUARD_MS,
} from './mapsPageConstants'
import {
  buildInitiativeOrder,
  insertInitiativeEntriesPreservingActive,
  migrateLegacyApCombatLogText,
  placeableRoomCharacters,
  tokenIntersectsDeleteRect,
  seededDieValue,
} from './mapsPageHelpers'
import {
  migrateLegacyApSharedCombatState,
  resolveSharedCombatStateApply,
} from '../lib/sharedCombatSync'
import { buildCombatMessageQueueReset } from '../lib/sharedCombatReset'
import { mergeSharedCombatLogEntries } from '../lib/sharedCombatLogSync'
import { resolveSharedDiceEventApply } from '../lib/sharedDiceSync'
import {
  createDmLocalPlayerActionEnvelope,
  createPlayerActionEnvelope,
  submitPlayerActionRequestWithLock,
  type SharedPlayerActionPatch,
} from '../lib/playerActionSync'
import { useMapsPlayerActionTransport } from './maps/useMapsPlayerActionTransport'
import { settleDnd5eConcentrationChecks } from './maps/settleDnd5eCombatResult'
import {
  applyDnd5eCombatResultApplication as applyCoordinatedDnd5eCombatResult,
  commitDnd5eCombatResult as commitCoordinatedDnd5eCombatResult,
} from './maps/commitDnd5eCombatResult'
import {
  buildMapExplorationUpdates,
  buildMapsFogGeometryProjection,
  resolveMapsFogGeometryState,
} from './maps/mapsFogGeometryController'
import {
  MapsEmptyMapPanel,
  MapsModeSelectionPanel,
  MapsModeToggle,
} from './maps/MapsEntryPanels'
import Dnd5eWeaponAttackConfirmationPanel, {
  type Dnd5eWeaponAttackConfirmation,
} from './maps/Dnd5eWeaponAttackConfirmationPanel'
import { DND5E_COVER_LABELS } from './maps/dnd5eCoverPresentation'
import ClassFeatureInterruptPanels from './maps/ClassFeatureInterruptPanels'
import ReactionInterruptPanels from './maps/ReactionInterruptPanels'
import DmAdjudicationPanel, {
  type DmAdjudicationEffectDraft,
  type SharedDmAdjudicationPromptView,
} from './maps/DmAdjudicationPanel'
import MapFogToolbar from './maps/MapFogToolbar'
import {
  capturePlayerActionResultBaseline,
  type PlayerActionResultBaseline,
} from '../lib/playerActionResult'
import {
  DM_AUTHORITY_READY_RESOURCE,
  matchesDmAuthorityReady,
  type DmAuthorityReadyState,
} from '../lib/dmAuthorityReady'
import {
  COMBAT_SETTLEMENT_MODE_OPTIONS,
  applyManualHitPointOperation,
  normalizeCombatSettlementMode,
  supportsManualDice,
  usesAutomatedMonsterSettlement,
  usesAutomatedPlayerSettlement,
  type CombatSettlementMode,
  type ManualSettlementOperation,
} from '../lib/combatSettlementMode'
const runtimeNow = () => Date.now()
const runtimeRandomSuffix = () => Math.random().toString(36).slice(2)
const runtimeId = (prefix?: string) =>
  prefix ? `${prefix}-${runtimeNow()}-${runtimeRandomSuffix()}` : `${runtimeNow()}-${runtimeRandomSuffix()}`
const runtimeNumericId = () => runtimeNow() + Math.random()
const randomDieValue = (sides: number) => 1 + Math.floor(Math.random() * sides)

export default function MapsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const maps = useMapStore((s) => s.maps)
  const selectedId = useMapStore((s) => s.selectedId)
  const select = useMapStore((s) => s.select)
  const addMap = useMapStore((s) => s.addMap)
  const updateMap = useMapStore((s) => s.updateMap)
  const removeMap = useMapStore((s) => s.removeMap)
  const addToken = useMapStore((s) => s.addToken)
  const addEnemyFromPool = useMapStore((s) => s.addEnemyFromPool)
  const addEncounterFromPool = useMapStore((s) => s.addEncounterFromPool)
  const addCharacterToken = useMapStore((s) => s.addCharacterToken)
  const updateToken = useMapStore((s) => s.updateToken)
  const applyAuthorityTokenUpdate = useMapStore((s) => s.applyAuthorityTokenUpdate)
  const applyAuthorityMapUpdate = useMapStore((s) => s.applyAuthorityMapUpdate)
  const removeToken = useMapStore((s) => s.removeToken)
  const fogMaps = useFogStore((s) => s.maps)
  const fogRedoByMap = useFogStore((s) => s.redoByMap)
  const fillFog = useFogStore((s) => s.fill)
  const clearFog = useFogStore((s) => s.clear)
  const addFogShape = useFogStore((s) => s.addShape)
  const undoFog = useFogStore((s) => s.undo)
  const redoFog = useFogStore((s) => s.redo)
  const setFogStyle = useFogStore((s) => s.setStyle)
  const geometryMaps = useMapGeometryStore((s) => s.maps)
  const selectedGeometryEntityId = useMapGeometryStore((s) => s.selectedEntityId)
  const selectGeometryEntity = useMapGeometryStore((s) => s.selectEntity)
  const addGeometryEntity = useMapGeometryStore((s) => s.addEntity)
  const removeGeometryEntity = useMapGeometryStore((s) => s.removeEntity)
  const setGeometryDoorState = useMapGeometryStore((s) => s.setDoorState)
  const updateGeometryEntity = useMapGeometryStore((s) => s.updateEntity)
  const setGeometryEntityPoints = useMapGeometryStore((s) => s.setEntityPoints)
  const explorationMaps = useMapExplorationStore((s) => s.maps)
  const recordMapExploration = useMapExplorationStore((s) => s.record)
  const startCombatStatistics = useCombatStatisticsStore((s) => s.startCombat)
  const recordCombatStatistics = useCombatStatisticsStore((s) => s.record)
  const settleCombatExperience = useCombatStatisticsStore((s) => s.settleExperience)

  const characters = useCharacterStore((s) => s.characters)
  const updateChar = useCharacterStore((s) => s.update)
  const applyAuthorityCharacterUpdate = useCharacterStore((s) => s.applyAuthorityUpdate)
  const saveCharactersSharedNow = useCharacterStore((s) => s.saveSharedNow)
  const applyDnd5eCombatApplication = (application: Dnd5eMapResultPlan) =>
    applyCoordinatedDnd5eCombatResult({
      application,
      mapId: application.map.id,
      applyCharacter: applyAuthorityCharacterUpdate,
      applyToken: applyAuthorityTokenUpdate,
    })
  const commitDnd5eCombatApplication = (
    application: Dnd5eMapResultPlan,
    options: { forceSaveMap?: boolean; forceSaveCharacters?: boolean } = {},
  ) => commitCoordinatedDnd5eCombatResult({
    application,
    mapId: application.map.id,
    applyCharacter: applyAuthorityCharacterUpdate,
    applyToken: applyAuthorityTokenUpdate,
    saveCharacters: () => useCharacterStore.getState().saveSharedNow(),
    saveMap: () => useMapStore.getState().saveSharedNow(),
    ...options,
  })
  const roomSession = useMemo(() => getRoomSession(), [])
  const isSpectator = roomSession?.role === 'spectator'
  const roomRulesSnapshot = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const [roomPlayerMemberIds, setRoomPlayerMemberIds] = useState<ReadonlySet<string> | undefined>()

  useEffect(() => {
    if (!roomSession || roomSession.role !== 'dm') return
    let disposed = false
    const refresh = async () => {
      try {
        const roster = await loadRoomRoster(roomSession)
        if (!disposed) setRoomPlayerMemberIds(new Set(
          roster.players.filter((player) => player.online && player.role === 'player').map((player) => player.memberId),
        ))
      } catch {
        // Keep the last successful roster while the room service reconnects.
      }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [roomSession])

  const placeableCharacters = useMemo(
    () => placeableRoomCharacters(characters, roomSession, roomPlayerMemberIds),
    [characters, roomPlayerMemberIds, roomSession],
  )

  const forcedMode = modeFromPort()
  const [selectedMode, setSelectedMode] = useState<Mode | null>(() => {
    const saved = window.localStorage.getItem('stars-map-role')
    return saved === 'dm' || saved === 'player' ? saved : null
  })
  const mode = forcedMode ?? selectedMode
  const [combatActive, setCombatActive] = useState(false)
  const [showSurpriseSetup, setShowSurpriseSetup] = useState(false)
  const [surpriseSelection, setSurpriseSelection] = useState<Set<string>>(() => new Set())
  const [combatEnding, setCombatEnding] = useState(false)
  const [combatExperienceDraft, setCombatExperienceDraft] = useState<CombatExperienceDraft | null>(null)
  const [combatExperienceBusy, setCombatExperienceBusy] = useState(false)
  const [settlementMode, setSettlementMode] = useState<CombatSettlementMode>('automatic')
  const settlementModeRef = useRef<CombatSettlementMode>('automatic')
  const [combatId, setCombatId] = useState('')
  const [dmAuthorityReady, setDmAuthorityReady] = useState<DmAuthorityReadyState | null>(null)
  const [playerCombatEndedLocked, setPlayerCombatEndedLocked] = useState(false)
  const [round, setRound] = useState(1)
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>([])
  const [initiativeIndex, setInitiativeIndex] = useState(0)
  const [initiativeScroll, setInitiativeScroll] = useState(0)
  const [dnd5eTurnEconomyByToken, setDnd5eTurnEconomyByToken] = useState<Dnd5eTurnEconomyByToken>({})
  const dnd5eTurnEconomyByTokenRef = useRef<Dnd5eTurnEconomyByToken>({})
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([])
  const [combatLogOpen, setCombatLogOpen] = useState(false)
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [selectedCharacterTokenId, setSelectedCharacterTokenId] = useState<string | null>(null)
  const [effectDetailTokenId, setEffectDetailTokenId] = useState<string | null>(null)
  const [activeCharId, setActiveCharId] = useState<string | null>(null)
  const [charPanel, setCharPanel] = useState<CharDockPanel | null>(null)
  const [playerAssignmentTick, setPlayerAssignmentTick] = useState(0)
  const [measureMode, setMeasureMode] = useState(false)
  const [deleteSelectMode, setDeleteSelectMode] = useState(false)
  const [showBar, setShowBar] = useState(true) // 顶部控件浮层是否显示
  const [gridDetecting, setGridDetecting] = useState(false)
  const [gridAdjustMode, setGridAdjustMode] = useState(false)
  const [gridSizePreview, setGridSizePreview] = useState(false)
  const [fogEditMode, setFogEditMode] = useState(false)
  const [fogTool, setFogTool] = useState<FogTool>('reveal-rect')
  const [fogPreviewAsPlayer, setFogPreviewAsPlayer] = useState(false)
  const [geometryEditMode, setGeometryEditMode] = useState(false)
  const [geometryTool, setGeometryTool] = useState<MapGeometryTool>('select')
  const [geometryWallMaterial, setGeometryWallMaterial] = useState<MapGeometryWallMaterial>('stone')
  const [geometryPreviewAsPlayer, setGeometryPreviewAsPlayer] = useState(false)
  const [geometrySnapToGrid, setGeometrySnapToGrid] = useState(true)
  const [mapTabletopTool, setMapTabletopTool] = useState<MapTabletopTool>('none')
  const [mapTabletopState, setMapTabletopState] = useState<MapTabletopState>(EMPTY_MAP_TABLETOP_STATE)
  const [panelWidth, setPanelWidth] = useState(720)
  const [panelHeight, setPanelHeight] = useState(300)
  const [panelFull, setPanelFull] = useState(false)
  const [enemyPoolOpen, setEnemyPoolOpen] = useState(false)
  const [enemyPoolMode, setEnemyPoolMode] = useState<'add' | 'apply'>('add')
  const [enemyDetailOpen, setEnemyDetailOpen] = useState(true)
  const frameRef = useRef<HTMLDivElement>(null)

  const [dnd5eWeaponTargeting, setDnd5eWeaponTargeting] = useState<string | null>(null)
  const [dnd5eWeaponAttackOptions, setDnd5eWeaponAttackOptions] = useState<Dnd5eWeaponAttackOptions | undefined>()
  const [dnd5eWeaponAttackConfirmation, setDnd5eWeaponAttackConfirmation] =
    useState<Dnd5eWeaponAttackConfirmation | null>(null)
  const pendingDmCoverOverrideRef = useRef<{
    actionId: string
    resolve: (cover: 'auto' | Dnd5eAttackCoverOverride) => void
  } | null>(null)
  const settleDmCoverOverride = (cover: 'auto' | Dnd5eAttackCoverOverride) => {
    const pending = pendingDmCoverOverrideRef.current
    pendingDmCoverOverrideRef.current = null
    setDnd5eWeaponAttackConfirmation(null)
    pending?.resolve(cover)
  }
  const dismissDnd5eWeaponAttackConfirmation = () => {
    if (dnd5eWeaponAttackConfirmation?.authorityActionId) settleDmCoverOverride('auto')
    else setDnd5eWeaponAttackConfirmation(null)
  }
  const [dnd5eSpellTargeting, setDnd5eSpellTargeting] = useState<{
    characterId: string
    castingClassId: Dnd5eClassId
    spellId: string
    slotLevel: number
    maximumTargets: number
    allowDuplicateTargets: boolean
    targetTokenIds: string[]
    overchannel: boolean
    empowered: boolean
    draconicResistance: boolean
    repellingBlast: boolean
    canSculpt: boolean
    maximumSculptedTargets: number
    sculptedTargetIds: string[]
    sculpting: boolean
    metamagic?: Dnd5eSpellMetamagicPayload
    maximumCarefulTargets: number
    carefulTargetIds: string[]
    carefulSelecting: boolean
    heightenedTargetId?: string
    heightenedSelecting: boolean
    area?: SkillAoeTargeting
    conditionChoice?: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease'
    effectDamageType?: NonNullable<Dnd5eSpellCastPayload['effectDamageType']>
    higherSlotDamageType?: Dnd5eDamageType
  } | null>(null)
  const [dnd5eItemAreaTargeting, setDnd5eItemAreaTargeting] = useState<{
    characterId: string
    instanceId: string
    itemName: string
    targeting: Extract<Dnd5eInventoryTargeting, { kind: 'map-area' }>
  } | null>(null)
  const [dnd5ePluginAreaTargeting, setDnd5ePluginAreaTargeting] = useState<{
    characterId: string
    featureId: string
    featureName: string
    targeting: Extract<Dnd5ePluginTargeting, { kind: 'area' }>
  } | null>(null)
  const [dnd5eItemCreatureTargeting, setDnd5eItemCreatureTargeting] = useState<{
    characterId: string
    instanceId: string
    itemName: string
    targeting: Extract<Dnd5eInventoryTargeting, { kind: 'creature' }>
  } | null>(null)
  const [aoePreviewCell, setAoePreviewCell] = useState<GridCell | null>(null)
  const [aoeRectRotation, setAoeRectRotation] = useState(0)
  const [roll, setRoll] = useState<DiceRoll | null>(null)
  const afterRollRef = useRef<(() => void) | null>(null)
  const d20RequestCounterRef = useRef(0)
  const applyingSharedCombatRef = useRef(false)
  const advancingTurnRef = useRef(false)
  const dnd5eMonsterEndTurnSettlingRef = useRef(false)
  const persistentAreaTurnBoundaryRef = useRef<{ mapId: string; round: number; tokenId: string } | null>(null)
  const orderedCombatPublishRef = useRef(false)
  const [diceBoxD20, setDiceBoxD20] = useState<{
    id: number
    label: string
    targetName: string
    value?: number
    requestKey?: string
    flyIndex?: number
    resolve: (value: number) => void
  } | null>(null)
  const diceBoxRollRequestCounterRef = useRef(0)
  const [diceBoxRoll, setDiceBoxRoll] = useState<{
    id: number
    count: number
    sides: number
    label: string
    targetName: string
    values: number[]
    requestKey?: string
    flyIndex?: number
    resolve: (values: number[]) => void
  } | null>(null)
  // player-side self-render driven by the roll-request
  // broadcast — the sole multi-end animation path.
  const [rollRequestPreview, setRollRequestPreview] = useState<{
    id: string
    kind: 'd20' | 'dice'
    count: number
    sides: number
    values: number[]
    label: string
    targetName: string
  } | null>(null)

  useEffect(() => {
    if (!diceBoxD20) return
    const request = diceBoxD20
    const timer = window.setTimeout(() => {
      setDiceBoxD20((current) => (current?.id === request.id ? null : current))
      request.resolve(request.value ?? seededDieValue(`${request.requestKey ?? request.id}:timeout`, 20))
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [diceBoxD20])

  useEffect(() => {
    if (!diceBoxRoll) return
    const request = diceBoxRoll
    const timer = window.setTimeout(() => {
      setDiceBoxRoll((current) => (current?.id === request.id ? null : current))
      request.resolve(request.values)
    }, DICE_TIMING.ROLL_FAILSAFE_MS + 1000)
    return () => window.clearTimeout(timer)
  }, [diceBoxRoll])

  // safety auto-clear for the roll-request self-render, in
  // case onComplete never fires (iframe stall).
  useEffect(() => {
    if (!rollRequestPreview) return
    const id = rollRequestPreview.id
    const duration = rollRequestPreview.kind === 'd20' ? 4500 : 16000
    const timer = window.setTimeout(() => {
      setRollRequestPreview((current) => (current?.id === id ? null : current))
    }, duration)
    return () => window.clearTimeout(timer)
  }, [rollRequestPreview])
  const [sharedOpportunityAttackPrompt, setSharedOpportunityAttackPrompt] =
    useState<SharedOpportunityAttackPromptView | null>(null)
  const [sharedProtectionPrompt, setSharedProtectionPrompt] =
    useState<SharedProtectionPromptView | null>(null)
  const [sharedShieldSpellPrompt, setSharedShieldSpellPrompt] =
    useState<SharedShieldSpellPromptView | null>(null)
  const [sharedCounterspellPrompt, setSharedCounterspellPrompt] =
    useState<SharedCounterspellPromptView | null>(null)
  const [sharedUncannyDodgePrompt, setSharedUncannyDodgePrompt] =
    useState<SharedUncannyDodgePromptView | null>(null)
  const [sharedDeflectMissilesPrompt, setSharedDeflectMissilesPrompt] =
    useState<SharedDeflectMissilesPromptView | null>(null)
  const [sharedSavingThrowRerollPrompt, setSharedSavingThrowRerollPrompt] =
    useState<SharedSavingThrowRerollPromptView | null>(null)
  const [sharedBardicInspirationPrompt, setSharedBardicInspirationPrompt] =
    useState<SharedBardicInspirationPromptView | null>(null)
  const [sharedCuttingWordsPrompt, setSharedCuttingWordsPrompt] =
    useState<SharedCuttingWordsPromptView | null>(null)
  const [sharedDarkOnesOwnLuckPrompt, setSharedDarkOnesOwnLuckPrompt] =
    useState<SharedDarkOnesOwnLuckPromptView | null>(null)
  const [sharedStrokeOfLuckPrompt, setSharedStrokeOfLuckPrompt] =
    useState<SharedStrokeOfLuckPromptView | null>(null)
  const [sharedEmpoweredSpellPrompt, setSharedEmpoweredSpellPrompt] =
    useState<SharedEmpoweredSpellPromptView | null>(null)
  const [sharedEmpoweredSpellSelection, setSharedEmpoweredSpellSelection] = useState<string[]>([])
  const [sharedStandAgainstTidePrompt, setSharedStandAgainstTidePrompt] =
    useState<SharedStandAgainstTidePromptView | null>(null)
  const [sharedPluginChoicePrompt, setSharedPluginChoicePrompt] =
    useState<SharedPluginChoicePromptView | null>(null)
  const [sharedDmAdjudicationPrompt, setSharedDmAdjudicationPrompt] =
    useState<SharedDmAdjudicationPromptView | null>(null)
  const [sharedRollConfirmationPrompt, setSharedRollConfirmationPrompt] =
    useState<CombatInterruptByKind<'roll-confirmation'> | null>(null)
  const [settlingRollConfirmation, setSettlingRollConfirmation] = useState(false)
  const [dmAdjudicationEffects, setDmAdjudicationEffects] = useState<DmAdjudicationEffectDraft[]>([])
  const [dmAdjudicationNote, setDmAdjudicationNote] = useState('')
  const [dmAdjudicationConcentrationRounds, setDmAdjudicationConcentrationRounds] = useState('')
  const [dmAdjudicationSaveOverride, setDmAdjudicationSaveOverride] = useState<'unchanged' | 'success' | 'failure'>('unchanged')
  const [dmAdjudicationDc, setDmAdjudicationDc] = useState('')
  const [dmAdjudicationMapOverride, setDmAdjudicationMapOverride] = useState<'roll' | 'success' | 'failure'>('roll')
  const [selectedDoorInteractionId, setSelectedDoorInteractionId] = useState<string | null>(null)
  const [dnd5eSecretSearchMethod, setDnd5eSecretSearchMethod] = useState<'perception' | 'investigation' | null>(null)
  const combatDialogRef = useRef<{
    id: number
    title: string
    message: string
    confirmText: string
    cancelText?: string
    tone: 'sky' | 'violet' | 'amber' | 'rose'
    resolve: (accepted: boolean) => void
  } | null>(null)
  const [combatDialog, setCombatDialog] = useState<typeof combatDialogRef.current>(null)
  const setCombatDialogLocked = useCallback((next: typeof combatDialogRef.current) => {
    combatDialogRef.current = next
    setCombatDialog(next)
  }, [])
  const showCombatDialog = useCallback((input: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    tone?: 'sky' | 'violet' | 'amber' | 'rose'
  }) =>
    new Promise<boolean>((resolve) => {
      setCombatDialogLocked({
        id: runtimeNumericId(),
        title: input.title,
        message: input.message,
        confirmText: input.confirmText ?? '确认',
        cancelText: input.cancelText,
        tone: input.tone ?? 'sky',
        resolve,
      })
    }), [setCombatDialogLocked])
  const closeCombatDialog = (accepted: boolean) => {
    const current = combatDialogRef.current
    setCombatDialogLocked(null)
    current?.resolve(accepted)
  }
  const showCombatNotice = useCallback(
    (title: string, message: string, tone: 'sky' | 'violet' | 'amber' | 'rose' = 'sky') =>
      showCombatDialog({ title, message, confirmText: '知道了', tone }),
    [showCombatDialog],
  )
  const publishCombatInterrupt = async (interrupt: SharedCombatInterrupt) => {
    await persistPublishSharedCombatInterrupt({ loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, interrupt })
  }
  const loadCombatInterrupt = async (mapId: string, id: string) => {
    const queue = await loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)
    return queue?.mapId === mapId
      ? queue.interrupts.find((interrupt) => interrupt.id === id)
      : undefined
  }
  const answerSharedCombatInterrupt = async (id: string, response: Record<string, unknown>) => {
    if (!activeMap) return
    await persistAnswerSharedCombatInterrupt({ loadSharedResource, saveSharedResource, mutateSharedCombatInterrupt, mapId: activeMap.id, id, response })
  }
  const finishSharedCombatInterrupt = async (id: string, response?: Record<string, unknown>) => {
    if (!activeMap) return
    await persistFinishSharedCombatInterrupt({
      loadSharedResource,
      saveSharedResource,
      mutateSharedCombatInterrupt,
      mapId: activeMap.id,
      id,
      response,
    })
  }
  const waitSharedCombatInterruptForDm = async (id: string) => {
    if (!activeMap) return
    await persistWaitSharedCombatInterruptForDm({
      loadSharedResource,
      saveSharedResource,
      mutateSharedCombatInterrupt,
      mapId: activeMap.id,
      id,
    })
  }
  const settleSharedCombatInterrupt = async (
    id: string,
    response: Record<string, unknown> | undefined,
    reason: 'expired' | 'answered',
  ) => {
    if (!activeMap) return
    if (reason === 'answered') {
      await finishSharedCombatInterrupt(id, response)
      return
    }
    await persistRollbackSharedCombatInterrupt({
      loadSharedResource,
      saveSharedResource,
      mutateSharedCombatInterrupt,
      mapId: activeMap.id,
      id,
      response,
      reason: 'timeout',
    })
  }
  const [sharedDodgeNow, setSharedDodgeNow] = useState(runtimeNow)
  const [pendingPlayerAction, setPendingPlayerAction] = useState<{
    id: string
    label: string
  } | null>(null)
  const pendingPlayerActionRef = useRef<{
    id: string
    label: string
  } | null>(null)
  const setPendingPlayerActionLocked = (next: { id: string; label: string } | null) => {
    pendingPlayerActionRef.current = next
    setPendingPlayerAction(next)
  }
  const [showMoveRange, setShowMoveRange] = useState(false)
  const [dnd5eCarefulMovement, setDnd5eCarefulMovement] = useState(false)
  const [dnd5eStandFromProne, setDnd5eStandFromProne] = useState(true)
  const [dnd5eTraversalMode, setDnd5eTraversalMode] = useState<Dnd5eTraversalMode>('walk')
  const [dnd5eTargetElevationFeet, setDnd5eTargetElevationFeet] = useState(0)
  const clearPlayerCombatUI = () => {
    setShowMoveRange(false)
    setDnd5eCarefulMovement(false)
    setDnd5eStandFromProne(true)
    setDnd5eTraversalMode('walk')
    setDnd5eItemAreaTargeting(null)
    setDnd5eItemCreatureTargeting(null)
    setDnd5ePluginAreaTargeting(null)
    setAoePreviewCell(null)
    if (pendingDmCoverOverrideRef.current) settleDmCoverOverride('auto')
    else setDnd5eWeaponAttackConfirmation(null)
  }
  const [disengagedCharIds, setDisengagedCharIds] = useState<Set<string>>(() => new Set())
  const enemyAppliedKeysRef = useRef(new Set<string>())
    const nonActorSkippedKeysRef = useRef(new Set<string>())
    const incapacitatedSkippedKeysRef = useRef(new Set<string>())
  const enemyTurnTimersRef = useRef(new TimerRegistry())
  const pendingSharedOpportunityAttackRef = useRef<{
    id: string
    attackerCharId: string
    resolve: (useOpportunityAttack: boolean) => void
  } | null>(null)
  const pendingSharedProtectionRef = useRef<{
    id: string
    protectorCharId: string
    resolve: (useProtection: boolean) => void
  } | null>(null)
  const pendingSharedShieldSpellRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useShieldSpell: boolean) => void
  } | null>(null)
  const pendingSharedCounterspellRef = useRef<{
    id: string
    actorCharId: string
    resolve: (useCounterspell: boolean) => void
  } | null>(null)
  const pendingSharedUncannyDodgeRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useUncannyDodge: boolean) => void
  } | null>(null)
  const pendingSharedDeflectMissilesRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accept: boolean) => void
  } | null>(null)
  const pendingSharedSavingThrowRerollRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useSavingThrowReroll: boolean) => void
  } | null>(null)
  const pendingSharedBardicInspirationRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useBardicInspiration: boolean) => void
  } | null>(null)
  const pendingSharedCuttingWordsRef = useRef<{
    id: string
    bardCharId: string
    resolve: (useCuttingWords: boolean) => void
  } | null>(null)
  const pendingSharedDarkOnesOwnLuckRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useDarkOnesOwnLuck: boolean) => void
  } | null>(null)
  const pendingSharedStrokeOfLuckRef = useRef<{
    id: string
    actorCharId: string
    resolve: (useStrokeOfLuck: boolean) => void
  } | null>(null)
  const pendingSharedEmpoweredSpellRef = useRef<{
    id: string
    actorCharId: string
    resolve: (rerollKeys: string[]) => void
  } | null>(null)
  const pendingSharedStandAgainstTideRef = useRef<{
    id: string
    hunterCharId: string
    resolve: (targetTokenId: string | undefined) => void
  } | null>(null)
  const pendingSharedPluginChoiceRef = useRef<{
    id: string
    actionId: string
    resolve: (optionId: string) => void
  } | null>(null)
  const pendingSharedDmAdjudicationRef = useRef<{
    id: string
    actionId: string
    resolve: (response: DmAdjudicationInterruptResponse) => void
  } | null>(null)
  const [dnd5eCoreAreaMoveTargeting, setDnd5eCoreAreaMoveTargeting] = useState<{
    characterId: string
    areaId: string
    targeting: SkillAoeTargeting
    originCell: GridCell
  } | null>(null)
  const pendingD20ConfirmationsRef = useRef(new Map<string, {
    originalValue: number
    resolve: (value: number) => void
  }>())
  const suppressedOpportunityAttackPromptIdsRef = useRef(new Set<string>())
  const suppressedProtectionPromptIdsRef = useRef(new Set<string>())
  const suppressedShieldSpellPromptIdsRef = useRef(new Set<string>())
  const suppressedCounterspellPromptIdsRef = useRef(new Set<string>())
  const suppressedUncannyDodgePromptIdsRef = useRef(new Set<string>())
  const suppressedDeflectMissilesPromptIdsRef = useRef(new Set<string>())
  const suppressedSavingThrowRerollPromptIdsRef = useRef(new Set<string>())
  const suppressedBardicInspirationPromptIdsRef = useRef(new Set<string>())
  const suppressedCuttingWordsPromptIdsRef = useRef(new Set<string>())
  const suppressedDarkOnesOwnLuckPromptIdsRef = useRef(new Set<string>())
  const suppressedStrokeOfLuckPromptIdsRef = useRef(new Set<string>())
  const suppressedEmpoweredSpellPromptIdsRef = useRef(new Set<string>())
  const suppressedStandAgainstTidePromptIdsRef = useRef(new Set<string>())
  const suppressedPluginChoicePromptIdsRef = useRef(new Set<string>())
  const suppressedDmAdjudicationPromptIdsRef = useRef(new Set<string>())
  const sharedDmAdjudicationPromptIdRef = useRef<string | null>(null)
  const playerActionSeqRef = useRef(0)
  const seenPlayerActionIdsRef = useRef(new Set<string>())
  const processedPlayerActionIdsRef = useRef(new Set<string>())
  const recentPlayerActionKeysRef = useRef(new Map<string, number>())
  const dnd5eAttackUsageRef = useRef(new Map<string, number>())
  const dnd5eActionSurgeTurnKeysRef = useRef(new Set<string>())
  const seenPlayerActionAckIdsRef = useRef(new Set<string>())
  const seenSharedDiceIdsRef = useRef(new Set<string>())
  // dedup roll-request by requestId (AC3) — same requestId
  // arriving twice (SSE fan-out to multiple local endpoints) renders once.
  const seenRollRequestIdsRef = useRef(new Set<string>())
  const combatLogSaveQueueRef = useRef(Promise.resolve())
  const seenSharedLogIdsRef = useRef(new Set<number>())
  const combatPublishSeqRef = useRef(0)
  const combatIdRef = useRef('')
  const lastSharedCombatSnapshotRef = useRef('')
  const lastAppliedCombatUpdatedAtRef = useRef(0)
  const lastAppliedCombatIdRef = useRef('')

  useEffect(() => {
    if (
      !sharedOpportunityAttackPrompt?.expiresAt &&
      !sharedShieldSpellPrompt?.expiresAt &&
      !sharedCounterspellPrompt?.expiresAt &&
      !sharedUncannyDodgePrompt?.expiresAt &&
      !sharedDeflectMissilesPrompt?.expiresAt &&
      !sharedSavingThrowRerollPrompt?.expiresAt &&
      !sharedBardicInspirationPrompt?.expiresAt &&
      !sharedCuttingWordsPrompt?.expiresAt &&
      !sharedDarkOnesOwnLuckPrompt?.expiresAt
      && !sharedStrokeOfLuckPrompt?.expiresAt
      && !sharedEmpoweredSpellPrompt?.expiresAt
      && !sharedStandAgainstTidePrompt?.expiresAt
      && !sharedPluginChoicePrompt?.expiresAt
    ) return
    const timer = window.setInterval(() => setSharedDodgeNow(runtimeNow()), 250)
    return () => window.clearInterval(timer)
  }, [
    sharedOpportunityAttackPrompt?.id,
    sharedOpportunityAttackPrompt?.expiresAt,
    sharedShieldSpellPrompt?.id,
    sharedShieldSpellPrompt?.expiresAt,
    sharedCounterspellPrompt?.id,
    sharedCounterspellPrompt?.expiresAt,
    sharedUncannyDodgePrompt?.id,
    sharedUncannyDodgePrompt?.expiresAt,
    sharedDeflectMissilesPrompt?.id,
    sharedDeflectMissilesPrompt?.expiresAt,
    sharedSavingThrowRerollPrompt?.id,
    sharedSavingThrowRerollPrompt?.expiresAt,
    sharedBardicInspirationPrompt?.id,
    sharedBardicInspirationPrompt?.expiresAt,
    sharedCuttingWordsPrompt?.id,
    sharedCuttingWordsPrompt?.expiresAt,
    sharedDarkOnesOwnLuckPrompt?.id,
    sharedDarkOnesOwnLuckPrompt?.expiresAt,
    sharedStrokeOfLuckPrompt?.id,
    sharedStrokeOfLuckPrompt?.expiresAt,
    sharedEmpoweredSpellPrompt?.id,
    sharedEmpoweredSpellPrompt?.expiresAt,
    sharedStandAgainstTidePrompt?.id,
    sharedStandAgainstTidePrompt?.expiresAt,
    sharedPluginChoicePrompt?.id,
    sharedPluginChoicePrompt?.expiresAt,
  ])

  useEffect(() => {
    dnd5eTurnEconomyByTokenRef.current = dnd5eTurnEconomyByToken
  }, [dnd5eTurnEconomyByToken])
  const multiStrikeHitsRef = useRef<Record<string, number>>({})
  const combatActiveRef = useRef(false)
  const combatEndingRef = useRef(false)
  const locallyEndedCombatIdRef = useRef('')
  const combatOutcomeNoticeCombatIdRef = useRef('')
  const playerActionResultBaselinesRef = useRef<Record<string, PlayerActionResultBaseline>>({})
  const playerActionCoordinatorRef = useRef(new DmActionTransactionCoordinator())
  const playerActionTransactionOutcomeRef = useRef(new Map<string, DmAuthoritativeActionOutcome>())
  const activeInterruptTransactionIdRef = useRef<string | null>(null)
  const playerActionAuthorityCommitRef = useRef<Promise<void>>(Promise.resolve())
  const applyingPlayerActionTransactionRef = useRef(false)
  const previousCombatActiveRef = useRef(false)
  const roundRef = useRef(1)
  const initiativeIndexRef = useRef(0)
  const initiativeOrderRef = useRef<InitiativeEntry[]>([])

  useEffect(() => {
    combatActiveRef.current = combatActive
    if (combatActive) return
    for (const pending of pendingD20ConfirmationsRef.current.values()) {
      pending.resolve(pending.originalValue)
    }
    pendingD20ConfirmationsRef.current.clear()
    const timer = window.setTimeout(() => setSharedRollConfirmationPrompt(null), 0)
    return () => window.clearTimeout(timer)
  }, [combatActive])

  useEffect(() => {
    settlementModeRef.current = settlementMode
  }, [settlementMode])

  useEffect(() => {
    roundRef.current = round
  }, [round])

  useEffect(() => {
    initiativeIndexRef.current = initiativeIndex
  }, [initiativeIndex])

  const pushCombatLog = (
    text: string,
    kind: CombatLogEntry['kind'] = 'system',
    roundOverride = round,
    details: readonly string[] = [],
  ) => {
    const entry: CombatLogEntry = {
      id: runtimeNumericId(),
      round: roundOverride,
      text: migrateLegacyApCombatLogText(text),
      kind,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      details: details.length > 0 ? [...details] : undefined,
    }
    seenSharedLogIdsRef.current.add(entry.id)
    setCombatLog((current) => [entry, ...current].slice(0, 160))
    if (activeMap) {
      const mapId = activeMap.id
      combatLogSaveQueueRef.current = combatLogSaveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const current = await loadSharedResource<SharedCombatLogState>('combat-log')
          const entries = current?.mapId === mapId
            ? (current.entries ?? []).map((item) => ({
                ...item,
                text: migrateLegacyApCombatLogText(item.text),
              }))
            : []
          await saveSharedResource<SharedCombatLogState>('combat-log', {
            mapId,
            entries: [entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, 200),
            updatedAt: runtimeNow(),
          })
        })
      void combatLogSaveQueueRef.current
    }
  }
  const contributeSharedCombatInterrupt = async (
    id: string,
    contribution: ReturnType<typeof createD20ReplacementContribution>,
  ) => {
    if (!activeMap) return
    await persistContributeSharedCombatInterrupt({
      loadSharedResource,
      saveSharedResource,
      mutateSharedCombatInterrupt,
      mapId: activeMap.id,
      id,
      contribution,
    })
  }

  const headlessCombatLogDetails = (
    events: Parameters<typeof formatDnd5eCombatLogDetails>[0],
    extra: readonly string[] = [],
  ) => formatDnd5eCombatLogDetails(events, {
    extra,
    resolveName: (entityId) => {
      const directCharacter = characters.find((character) => character.id === entityId)
      if (directCharacter) return directCharacter.name
      const token = activeMap?.tokens.find((candidate) => candidate.id === entityId)
      if (!token) return entityId
      const linkedCharacter = token.characterId
        ? characters.find((character) => character.id === token.characterId)
        : undefined
      return linkedCharacter?.name ?? token.label ?? entityId
    },
  })

  const pushHeadlessCombatLog = (
    text: string,
    kind: CombatLogEntry['kind'],
    events: Parameters<typeof formatDnd5eCombatLogDetails>[0],
    extra: readonly string[] = [],
  ) => pushCombatLog(text, kind, roundRef.current, headlessCombatLogDetails(events, extra))

  const publishSharedDiceEvent = (event: SharedDiceState) => {
    if (!activeMap) return
    void (async () => {
      const current = await loadSharedResource<SharedDiceEventsState>('dice-events')
      const events = current?.mapId === activeMap.id ? current.events ?? [] : []
      const nextEvents = [...events.filter((item) => item.id !== event.id), event]
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .slice(-24)
      await saveSharedResource<SharedDiceEventsState>('dice-events', {
        mapId: activeMap.id,
        events: nextEvents,
        updatedAt: runtimeNow(),
      })
    })()
  }

  // broadcast the decided result once. One logical event per
  // throw (AC2); sharedApi fans it out to each local endpoint as the SSE
  // dual-send (the same eventId, deduped downstream by requestId).
  const publishRollRequest = (payload: SharedRollRequestPayload) => {
    if (!activeMap || !mode) return
    const targetMode = mode === 'dm' ? 'player' : 'dm'
    const eventId = `${payload.requestId}:roll-request:${runtimeId()}`
    void publishSharedEvent<SharedRollRequestEvent>(`dice-roll-request-${mode}-to-${targetMode}`, {
      ...payload,
      eventId,
      mapId: activeMap.id,
      sourceMode: mode,
      updatedAt: runtimeNow(),
    })
  }

  const confirmCombatD20 = (
    rollId: string,
    label: string,
    targetName: string,
    originalValue: number,
    visibility: 'public' | 'dm-only' = 'public',
  ): Promise<number> => {
    if (!combatActiveRef.current || !activeMap) return Promise.resolve(originalValue)
    const turnTokenId = initiativeOrderRef.current[initiativeIndexRef.current]?.tokenId
    const turnToken = activeMap.tokens.find((token) => token.id === turnTokenId)
    const rollerCharacterId = mode === 'player'
      ? assignedCharacterId ?? playerChar?.id
      : turnToken?.characterId
    const interrupt = createD20RollConfirmationInterrupt({
      mapId: activeMap.id,
      combatId: combatIdRef.current || undefined,
      rollId,
      label,
      targetName,
      originalValue,
      rollerCharacterId,
      visibility,
      now: runtimeNow(),
    })
    return new Promise<number>((resolve) => {
      pendingD20ConfirmationsRef.current.set(interrupt.id, { originalValue, resolve })
      void publishCombatInterrupt(interrupt).catch(() => {
        const pending = pendingD20ConfirmationsRef.current.get(interrupt.id)
        if (!pending) return
        pendingD20ConfirmationsRef.current.delete(interrupt.id)
        pending.resolve(originalValue)
      })
    })
  }

  const rollDiceBoxD20 = async (label: string, targetName: string): Promise<number> => {
    const id = d20RequestCounterRef.current + 1
    d20RequestCounterRef.current = id
    const requestKey = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:d20:${runtimeNow()}:${id}:${label}:${targetName}`
    const flyIndex = seededDieValue(`${requestKey}:fly`, 8) - 1
    // decide the face up front so both ends @-relabel to the
    // same value. RNG moved from the iframe physics into JS — same uniform
    // distribution, now broadcastable.
    const value = randomDieValue(20)
    const rollRequestId = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:rr-d20:${runtimeNow()}:${id}`
    publishRollRequest({ requestId: rollRequestId, kind: 'd20', count: 1, sides: 20, values: [value], label, targetName })
    const animatedValue = await new Promise<number>((resolve) => {
      setDiceBoxD20({ id, label, targetName, value, requestKey, flyIndex, resolve })
    })
    return confirmCombatD20(rollRequestId, label, targetName, animatedValue)
  }

  const rollDiceBoxValues = async (
    count: number,
    sides: number,
    label: string,
    targetName: string,
    options: { broadcast?: boolean } = {},
  ): Promise<number[]> => {
    const id = diceBoxRollRequestCounterRef.current + 1
    diceBoxRollRequestCounterRef.current = id
    const safeCount = Math.max(1, Math.min(12, Math.round(count)))
    const safeSides = Math.max(2, Math.min(100, Math.round(sides)))
    const requestKey = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:dice:${runtimeNow()}:${id}:${safeCount}d${safeSides}:${label}:${targetName}`
    const flyIndex = seededDieValue(`${requestKey}:fly`, 8) - 1
    // decide faces up front (see rollDiceBoxD20) and broadcast.
    const values = Array.from({ length: safeCount }, () => randomDieValue(safeSides))
    const rollRequestId = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:rr-dice:${runtimeNow()}:${id}`
    if (options.broadcast !== false) {
      publishRollRequest({ requestId: rollRequestId, kind: 'dice', count: safeCount, sides: safeSides, values, label, targetName })
    }
    const animatedValues = await new Promise<number[]>((resolve) => {
      setDiceBoxRoll({ id, count: safeCount, sides: safeSides, label, targetName, values, requestKey, flyIndex, resolve })
    })
    if (safeSides !== 20 || !combatActiveRef.current) return animatedValues
    const confirmedValues: number[] = []
    for (const [index, originalValue] of animatedValues.entries()) {
      confirmedValues.push(await confirmCombatD20(
        `${rollRequestId}:${index}`,
        safeCount > 1 ? `${label}（第 ${index + 1} 枚 d20）` : label,
        targetName,
        originalValue,
        options.broadcast === false ? 'dm-only' : 'public',
      ))
    }
    return confirmedValues
  }

  const publishSharedDiceRoll = (
    roll: DiceRoll,
    options: { visibility?: 'public' | 'dm'; rollerName?: string } = {},
  ) => {
    if (!activeMap || !mode) return
    const id = runtimeId()
    seenSharedDiceIdsRef.current.add(id)
    const event: SharedDiceState = {
      id,
      mapId: activeMap.id,
      sourceMode: mode,
      visibility: options.visibility ?? 'public',
      rollerName: options.rollerName,
      status: 'result',
      roll,
      updatedAt: runtimeNow(),
    }
    publishSharedDiceEvent(event)
    void saveSharedResource<SharedDiceState>('dice', event)
  }

  useEffect(() => {
    initiativeOrderRef.current = initiativeOrder
  }, [initiativeOrder])

  const publishCombatState = (
    patch?: Partial<Omit<SharedCombatState, 'mapId' | 'updatedAt'>>,
  ) => {
    if (!activeMap || mode !== 'dm') return Promise.resolve()
    const requestedActive = patch?.active ?? combatActiveRef.current
    if (requestedActive && locallyEndedCombatIdRef.current === combatIdRef.current) {
      return Promise.resolve()
    }
    const seq = ++combatPublishSeqRef.current
    const state: SharedCombatState = {
      mapId: activeMap.id,
      combatId: combatIdRef.current,
      active: combatActiveRef.current,
      round: roundRef.current,
      initiativeIndex: initiativeIndexRef.current,
      initiativeOrder: initiativeOrderRef.current,
      settlementMode: settlementModeRef.current,
      dnd5eTurnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      updatedAt: runtimeNow(),
      ...patch,
    }
    const task = (async () => {
      if (seq !== combatPublishSeqRef.current) return
      await saveSharedResource('combat', state)
    })()
    void task
    return task
  }

  const dnd5eTurnKey = (tokenId: string, turnRound: number = roundRef.current) =>
    `${combatIdRef.current}:${turnRound}:${(() => {
      const slot = initiativeOrderRef.current[initiativeIndexRef.current]
      return slot?.tokenId === tokenId ? slot.slotId ?? tokenId : tokenId
    })()}`

  const currentDnd5eTurnEconomy = (
    tokenId: string,
    turnRound: number = roundRef.current,
  ): Dnd5eTurnEconomyCounts => {
    const token = activeMap?.tokens.find((item) => item.id === tokenId)
    const speed = token?.characterId
      ? (() => {
          const character = useCharacterStore.getState().characters.find((candidate) => candidate.id === token.characterId)
          return character ? dnd5eEffectiveWalkingSpeed(character) : 30
        })()
      : token?.poolId
        ? Math.max(0, (getDnd5eSrdMonster(token.poolId)?.speed.walk ?? 30) -
            dnd5eActiveSpeedPenalty(token.dnd5eCombatState?.activeEffects))
        : 30
    const stored = dnd5eTurnEconomyByTokenRef.current[tokenId]
    const activeSlot = initiativeOrderRef.current[initiativeIndexRef.current]
    const expectedTurnKey = dnd5eTurnKey(tokenId, turnRound)
    return stored && (activeSlot?.tokenId !== tokenId || stored.turnKey === expectedTurnKey)
      ? normalizeDnd5eTurnEconomyCounts(stored, speed)
      : createDnd5eTurnEconomyCounts(expectedTurnKey, speed)
  }

  const updateDnd5eTurnEconomy = (
    tokenId: string,
    updater: (current: Dnd5eTurnEconomyCounts) => Dnd5eTurnEconomyCounts,
    turnRound: number = roundRef.current,
  ) => {
    const current = currentDnd5eTurnEconomy(tokenId, turnRound)
    const nextEconomy = updater(current)
    const next = { ...dnd5eTurnEconomyByTokenRef.current, [tokenId]: nextEconomy }
    dnd5eTurnEconomyByTokenRef.current = next
    setDnd5eTurnEconomyByToken(next)
    return nextEconomy
  }

  const applySharedCombatState = (state: SharedCombatState | null) => {
    if (!state || !activeMap || state.mapId !== activeMap.id) return
    if (
      isDM &&
      state.active &&
      !!state.combatId &&
      state.combatId === locallyEndedCombatIdRef.current
    ) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === state.mapId) ?? activeMap
    const validTokenIds = new Set(latestMap.tokens.map((token) => token.id))
    const decision = resolveSharedCombatStateApply({
      state,
      mapId: activeMap.id,
      validTokenIds,
      currentCombatId: combatIdRef.current,
      currentDnd5eTurnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      lastAppliedCombatId: lastAppliedCombatIdRef.current,
      lastAppliedUpdatedAt: lastAppliedCombatUpdatedAtRef.current,
      lastSnapshot: lastSharedCombatSnapshotRef.current,
      isDm: isDM,
    })
    if (decision.status !== 'apply') return
    lastSharedCombatSnapshotRef.current = decision.snapshot
    lastAppliedCombatIdRef.current = decision.incomingCombatId
    lastAppliedCombatUpdatedAtRef.current = decision.incomingUpdatedAt
    applyingSharedCombatRef.current = true
    combatIdRef.current = decision.incomingCombatId
    setCombatId(decision.incomingCombatId)
    if (decision.shouldResetPlayerActionState) {
      setPendingPlayerActionLocked(null)
      seenPlayerActionAckIdsRef.current.clear()
      seenPlayerActionIdsRef.current.clear()
      processedPlayerActionIdsRef.current.clear()
      playerActionResultBaselinesRef.current = {}
      clearPlayerCombatUI()
    }
    if (decision.playerCombatEndedLocked !== undefined) {
      setPlayerCombatEndedLocked(decision.playerCombatEndedLocked)
    }
    setCombatActive(decision.active)
    combatActiveRef.current = decision.active
    setRound(decision.round)
    roundRef.current = decision.round
    setInitiativeOrder(decision.initiativeOrder)
    initiativeOrderRef.current = decision.initiativeOrder
    setInitiativeIndex(decision.initiativeIndex)
    initiativeIndexRef.current = decision.initiativeIndex
    setSettlementMode(decision.settlementMode)
    settlementModeRef.current = decision.settlementMode
    dnd5eTurnEconomyByTokenRef.current = decision.dnd5eTurnEconomyByToken
    setDnd5eTurnEconomyByToken(decision.dnd5eTurnEconomyByToken)
    window.setTimeout(() => {
      applyingSharedCombatRef.current = false
    }, 0)
  }

  const startResizeWidth = (e: React.MouseEvent) => {
    e.preventDefault()
    setPanelFull(false)
    const frame = frameRef.current
    const rect = frame?.getBoundingClientRect()
    const leftEdge = (rect?.left ?? 0) + 88
    const maxW = (frame?.clientWidth ?? 1000) - 64 - 8
    const onMove = (ev: MouseEvent) => {
      setPanelWidth(Math.max(320, Math.min(maxW, ev.clientX - leftEdge)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const startResizeHeight = (e: React.MouseEvent) => {
    e.preventDefault()
    const frame = frameRef.current
    const rect = frame?.getBoundingClientRect()
    const maxH = (rect?.height ?? 600) - 24
    const startY = e.clientY
    const startH = panelFull ? (rect?.height ?? 600) * 0.58 : panelHeight
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY
      const next = Math.max(160, Math.min(maxH, startH + delta))
      if (panelFull) {
        setPanelFull(false)
        setPanelHeight(next)
      } else {
        setPanelHeight(next)
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const isDM = mode === 'dm'
  const playerSlot = isSpectator ? null : currentPlayerSlot()
  const assignedCharacterId = isDM || isSpectator ? null : getAssignedPlayerCharacterId(playerSlot ?? undefined)
  const activeMap = maps.find((m) => m.id === selectedId) ?? maps[0] ?? null
  const displayActiveMapTokens = activeMap
    ? projectCharacterTokenPresentations(activeMap.tokens, characters)
    : undefined
  const displayActiveMap = activeMap && displayActiveMapTokens
    ? displayActiveMapTokens === activeMap.tokens
      ? activeMap
      : { ...activeMap, tokens: displayActiveMapTokens }
    : null
  const displayTokensById = new Map((displayActiveMap?.tokens ?? []).map((token) => [token.id, token]))
  const displayInitiativeOrder = initiativeOrder.map((entry) => {
    const token = displayTokensById.get(entry.tokenId)
    if (!token || (token.emoji === entry.emoji && token.label === entry.label)) return entry
    return { ...entry, emoji: token.emoji, label: token.label }
  })
  const activeMapId = activeMap?.id
  const activeMapTabletop = activeMapId
    ? mapTabletopForMap(mapTabletopState, activeMapId)
    : { pings: [], annotations: [], focus: null }

  useEffect(() => subscribeSharedEvent(MAP_TABLETOP_CHANNEL, (event) => {
    setMapTabletopState((current) => reduceMapTabletopState(current, event))
  }), [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMapTabletopState((current) => reduceMapTabletopState(current, null))
    }, 1_000)
    return () => window.clearInterval(timer)
  }, [])
  const applySharedCombatStateEvent = useEffectEvent((state: SharedCombatState | null) => {
    applySharedCombatState(state)
  })
  const publishCombatStateEvent = useEffectEvent(() => {
    void publishCombatState()
  })
  useEffect(() => {
    if (!isDM || !activeMapId) return
    return setDnd5eHeadlessResolutionObserver((observation) => {
      if (!combatActiveRef.current) return
      const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMapId)
      const sideByCombatantId = Object.fromEntries((latestMap?.tokens ?? []).map((token) => [
        token.id,
        token.type === 'player' ? 'player' : token.type === 'enemy' ? 'enemy' : 'npc',
      ] as const))
      recordCombatStatistics(activeMapId, observation, sideByCombatantId)
    })
  }, [activeMapId, isDM, recordCombatStatistics])
  const activeFogGeometry = activeMap
    ? resolveMapsFogGeometryState({ map: activeMap, fogMaps, geometryMaps })
    : undefined
  const activeFog = activeFogGeometry?.fog
  const activeGeometry = activeFogGeometry?.geometry
  const selectedGeometryEntity = activeGeometry
    ? [...activeGeometry.walls, ...activeGeometry.doors, ...(activeGeometry.windows ?? []), ...activeGeometry.obstacles, ...(activeGeometry.lights ?? [])]
        .find((entity) => entity.id === selectedGeometryEntityId)
    : undefined
  const selectedDoorInteraction = activeGeometry?.doors.find((door) => door.id === selectedDoorInteractionId)
  const selectedToken = activeMap?.tokens.find((t) => t.id === selectedTokenId) ?? null
  const selectedCharacterToken = activeMap?.tokens.find((t) => t.id === selectedCharacterTokenId) ?? null
  const selectedCharacter = selectedCharacterToken?.characterId
    ? characters.find((character) => character.id === selectedCharacterToken.characterId)
    : undefined
  const effectDetailToken = activeMap?.tokens.find((token) => token.id === effectDetailTokenId)
  const effectDetailCharacter = effectDetailToken?.characterId
    ? characters.find((character) => character.id === effectDetailToken.characterId)
    : undefined
  const effectDetailEffects = effectDetailToken
    ? normalizeDnd5eActiveEffects(
        effectDetailCharacter?.dnd5eCombatState?.activeEffects ?? effectDetailToken.dnd5eCombatState?.activeEffects,
      )
    : []
  const canDmManageConditions = isDM && combatActive && settlementMode !== 'automatic'
  const dnd5eConditionsByToken = (() => {
    const result: Record<string, readonly Dnd5eStandardConditionId[]> = {}
    for (const token of activeMap?.tokens ?? []) {
      const linked = token.characterId
        ? characters.find((character) => character.id === token.characterId)
        : undefined
      const conditions = dnd5eConditionsFromActiveEffects(
        linked?.dnd5eCombatState?.activeEffects ?? token.dnd5eCombatState?.activeEffects,
      )
      const active = dnd5eActiveStandardConditions({ conditions })
      if (active.length > 0) result[token.id] = active
    }
    return result
  })()

  const conditionSourceOptions = (activeMap?.tokens ?? []).flatMap((token) => {
    if (token.type !== 'player' && token.type !== 'enemy') return []
    const linked = token.characterId ? characters.find((character) => character.id === token.characterId) : undefined
    return [{ id: token.id, label: linked?.name ?? token.label }]
  })

  const applyDmConditionLabels = (
    token: Token,
    _nextConditions: string[],
    nextActiveEffects?: Dnd5eActiveEffectInstance[],
  ) => {
    if (!activeMap || !canDmManageConditions) return
    const projectedConditions = dnd5eConditionsFromActiveEffects(nextActiveEffects)
    const linked = token.characterId
      ? characters.find((character) => character.id === token.characterId)
      : undefined
    const persistedState = linked?.dnd5eCombatState ?? token.dnd5eCombatState
    const nativeState = persistedState ?? {}
    const currentConditions = linked?.conditions ?? token.dnd5eCombatState?.conditions ?? []
    const before = dnd5eActiveStandardConditions({ conditions: currentConditions })
    const after = dnd5eActiveStandardConditions({ conditions: projectedConditions })
    const added = after.filter((condition) => !before.includes(condition))
    const removed = before.filter((condition) => !after.includes(condition))
    if (added.length === 0 && removed.length === 0 && currentConditions.join('\u0000') === projectedConditions.join('\u0000')) return

    const staticImmunities = token.poolId
      ? getEnemyStatBlock(token.poolId)?.conditionImmunities ?? []
      : []
    const blocked = added.filter((condition) => staticImmunities
      .some((immunity) => dnd5eStandardConditionId(immunity) === condition))
    if (blocked.length > 0) {
      pushCombatLog(
        `DM 未能为 ${linked?.name ?? token.label} 附加${blocked.map(dnd5eConditionLabel).join('、')}：目标具有对应状态免疫。`,
        'system',
      )
      return
    }

    if (linked) {
      updateChar(linked.id, {
        conditions: projectedConditions,
        dnd5eCombatState: {
          ...nativeState,
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          activeEffects: nextActiveEffects?.length ? [...nextActiveEffects] : undefined,
        },
      })
    } else {
      updateToken(activeMap.id, token.id, {
        dnd5eCombatState: {
          ...nativeState,
          schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION,
          conditions: projectedConditions.length > 0 ? projectedConditions : undefined,
          activeEffects: nextActiveEffects?.length ? [...nextActiveEffects] : undefined,
        },
      })
    }

    const changes = [
      added.length > 0 ? `附加 ${added.map(dnd5eConditionLabel).join('、')}` : '',
      removed.length > 0 ? `移除 ${removed.map(dnd5eConditionLabel).join('、')}` : '',
    ].filter(Boolean).join('；')
    pushCombatLog(`DM 为 ${linked?.name ?? token.label} ${changes || '更新状态标签'}。`, 'system')
  }
  const activeChar = characters.find((c) => c.id === activeCharId) ?? null
  const activeCharToken = activeChar
    ? activeMap?.tokens.find((token) => token.characterId === activeChar.id)
    : undefined
  const activeCharDnd5eTurnEconomy = activeCharToken
    ? normalizeDnd5eTurnEconomyCounts(
        dnd5eTurnEconomyByToken[activeCharToken.id]
          ?? createDnd5eTurnEconomyCounts(`${combatId}:${round}:${activeCharToken.id}`, activeChar ? dnd5eEffectiveWalkingSpeed(activeChar) : 30),
        activeChar ? dnd5eEffectiveWalkingSpeed(activeChar) : 30,
      )
    : createDnd5eTurnEconomyCounts('inactive')
  const initiativeTokenIds = new Set(initiativeOrder.map((entry) => entry.tokenId))
  const activeCharDnd5eFeatureTargets = activeMap?.tokens.flatMap((token) => {
    if (!initiativeTokenIds.has(token.id) || token.type === 'obstacle') return []
    const linked = token.characterId ? characters.find((character) => character.id === token.characterId) : undefined
    const currentHp = linked?.currentHp ?? token.hp ?? 0
    const maxHp = linked?.maxHp ?? token.maxHp ?? Math.max(1, currentHp)
    const targetCombatState = linked?.dnd5eCombatState ?? token.dnd5eCombatState
    const ongoingSpellEffects = Object.entries(targetCombatState?.concentrationEffectsBySource ?? {}).flatMap(
      ([sourceTokenId, spellId]) => {
        const sourceToken = activeMap.tokens.find((candidate) => candidate.id === sourceTokenId)
        if (!sourceToken) return []
        const sourceCharacter = sourceToken.characterId
          ? characters.find((character) => character.id === sourceToken.characterId)
          : undefined
        const sourceCombatState = sourceCharacter?.dnd5eCombatState ?? sourceToken.dnd5eCombatState
        const sourceConcentrating = sourceCharacter?.concentrating === true ||
          (!sourceCharacter && sourceCombatState?.concentrationSpellId === spellId)
        if (
          !sourceConcentrating || sourceCombatState?.concentrationSpellId !== spellId ||
          !sourceCombatState.concentrationTargetIds?.includes(token.id)
        ) return []
        return [{
          sourceTokenId,
          spellId,
          spellName: getDnd5eSrdCombatSpell(spellId)?.name ?? spellId,
          sourceName: sourceCharacter?.name ?? sourceToken.label,
        }]
      },
    )
    return [{
      tokenId: token.id,
      tokenType: token.type === 'player' || token.type === 'enemy' ? token.type : undefined,
      characterId: linked?.id,
      opposed: activeCharToken ? areOpposedCombatTokens(activeCharToken, token) : false,
      label: linked?.name ?? token.label,
      currentHp,
      maxHp,
      creatureType: linked ? '类人生物' : token.poolId ? getDnd5eSrdMonster(token.poolId)?.creatureType : undefined,
      conditions: linked?.conditions ?? token.dnd5eCombatState?.conditions ?? [],
      ongoingSpellEffects,
      distanceFeet: activeCharToken && activeMap
        ? tokenFootprintDistanceCells(activeCharToken, token, activeMap) * Math.max(1, activeMap.feetPerCell ?? 5)
        : 0,
    }]
  }) ?? []

  const handleDeleteBoxConfirm = (rect: DeleteSelectionRect) => {
    if (!isDM || !activeMap) return
    const tokenIds = activeMap.tokens
      .filter((token) => tokenIntersectsDeleteRect(token, rect, activeMap.gridSize))
      .filter((token) => !combatActive || token.type === 'obstacle')
      .map((token) => token.id)
    if (tokenIds.length === 0) {
      setDeleteSelectMode(false)
      return
    }
    const label = combatActive
      ? `删除选框内 ${tokenIds.length} 个障碍物？`
      : `删除选框内 ${tokenIds.length} 个单位/障碍物？`
    if (window.confirm(label)) {
      // 选框删除若命中当前选中 token，立即清空选中态（守卫 effect 之外的显式清理）。
      if (selectedTokenId && tokenIds.includes(selectedTokenId)) setSelectedTokenId(null)
      tokenIds.forEach((tokenId) => removeToken(activeMap.id, tokenId))
    }
    setDeleteSelectMode(false)
  }

  useEffect(() => {
    if (!activeMapId) return
    return subscribeSharedResourceInvalidation('maps', () => useMapStore.getState().loadShared())
  }, [activeMapId])

  useEffect(() => {
    if (!activeMapId) return
    if (mode === 'dm' && combatActive) return
    let cancelled = false
    const load = async () => {
      const state = await loadSharedResource<SharedCombatState>('combat')
      if (cancelled || !state) return
      const migrated = migrateLegacyApSharedCombatState(state)
      if (migrated.removedLegacyAp && mode === 'dm') {
        await saveSharedResource<SharedCombatState>('combat', {
          ...migrated.state,
          updatedAt: runtimeNow(),
        })
      }
      if (!cancelled) applySharedCombatStateEvent(migrated.state)
    }
    const unsubscribe = subscribeSharedResourceInvalidation('combat', load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeMapId, mode, combatActive])

  useEffect(() => {
    if (!activeMapId || !combatActive || !combatIdRef.current) {
      setDmAuthorityReady(null)
      return
    }
    let cancelled = false
    const mapId = activeMapId
    const combatId = combatIdRef.current

    if (isDM) {
      const publishReady = async () => {
        if (roomSession && roomRulesSnapshot?.member.ready !== true) {
          const state: DmAuthorityReadyState = {
            mapId,
            combatId,
            ready: false,
            updatedAt: runtimeNow(),
          }
          setDmAuthorityReady(state)
          await saveSharedResource(DM_AUTHORITY_READY_RESOURCE, state)
          return
        }
        await Promise.all([
          useMapStore.getState().loadShared(),
          useCharacterStore.getState().loadShared(),
        ])
        if (cancelled || !combatActiveRef.current || combatIdRef.current !== combatId) return
        const state: DmAuthorityReadyState = {
          mapId,
          combatId,
          ready: true,
          updatedAt: runtimeNow(),
        }
        setDmAuthorityReady(state)
        await saveSharedResource(DM_AUTHORITY_READY_RESOURCE, state)
      }
      void publishReady()
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      const state = await loadSharedResource<DmAuthorityReadyState>(DM_AUTHORITY_READY_RESOURCE)
      if (!cancelled) setDmAuthorityReady(state)
    }
    const unsubscribe = subscribeSharedResourceInvalidation(DM_AUTHORITY_READY_RESOURCE, load, {
      recoveryMs: 3_000,
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeMapId, combatActive, isDM, roomRulesSnapshot, roomSession])

  // subscribe to the result-broadcast channel and self-render
  // the decided @values locally.
  useEffect(() => {
    if (!activeMapId || !mode) return
    const sourceMode = mode === 'dm' ? 'player' : 'dm'
    const unsubscribe = subscribeSharedEvent<SharedRollRequestEvent>(
      `dice-roll-request-${sourceMode}-to-${mode}`,
      (event) => {
        if (
          !event ||
          event.mapId !== activeMapId ||
          event.sourceMode === mode ||
          runtimeNow() - event.updatedAt > 60000 ||
          seenRollRequestIdsRef.current.has(event.requestId)
        ) {
          return
        }
        seenRollRequestIdsRef.current.add(event.requestId)
        if (seenRollRequestIdsRef.current.size > 600) {
          seenRollRequestIdsRef.current = new Set([...seenRollRequestIdsRef.current].slice(-300))
        }
        setRollRequestPreview({
          id: event.requestId,
          kind: event.kind,
          count: Math.max(1, Math.round(event.count)),
          sides: Math.max(2, Math.round(event.sides)),
          values: Array.isArray(event.values) ? event.values : [],
          label: event.label,
          targetName: event.targetName,
        })
      },
    )
    return unsubscribe
  }, [activeMapId, mode])

  useEffect(() => {
    if (!activeMapId || !mode) return
    let cancelled = false
    const applyDiceEvent = (state: SharedDiceState) => {
      if (cancelled) return
      const decision = resolveSharedDiceEventApply({
        state,
        mapId: activeMapId,
        mode,
        now: runtimeNow(),
        seenIds: seenSharedDiceIdsRef.current,
      })
      if (decision.status !== 'apply') return
      seenSharedDiceIdsRef.current.add(decision.id)
      setRoll({ ...decision.roll })
    }
    const load = async () => {
      const eventState = await loadSharedResource<SharedDiceEventsState>('dice-events')
      if (!cancelled && eventState?.mapId === activeMapId) {
        for (const event of eventState.events ?? []) applyDiceEvent(event)
        return
      }
      const state = await loadSharedResource<SharedDiceState>('dice')
      if (state) applyDiceEvent(state)
    }
    const unsubscribe = subscribeSharedResourceInvalidation('dice-events', load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeMapId, mode])

  useEffect(() => {
    if (!activeMapId) return
    let cancelled = false
    const load = async () => {
      const state = await loadSharedResource<SharedCombatLogState>('combat-log')
      if (cancelled || !state || state.mapId !== activeMapId) return
      const normalizedEntries = (state.entries ?? []).map((entry) => ({
        ...entry,
        text: migrateLegacyApCombatLogText(entry.text),
      }))
      const containsLegacyApText = normalizedEntries.some(
        (entry, index) => entry.text !== state.entries[index]?.text,
      )
      if (containsLegacyApText && mode === 'dm') {
        void saveSharedResource<SharedCombatLogState>('combat-log', {
          ...state,
          entries: normalizedEntries,
          updatedAt: runtimeNow(),
        })
      }
      const incoming = normalizedEntries
        .filter((entry) => !seenSharedLogIdsRef.current.has(entry.id))
      if (incoming.length === 0) return
      for (const entry of incoming) seenSharedLogIdsRef.current.add(entry.id)
      setCombatLog((current) => {
        const normalizedCurrent = current.map((entry) => ({
          ...entry,
          text: migrateLegacyApCombatLogText(entry.text),
        }))
        return mergeSharedCombatLogEntries(normalizedCurrent, incoming)
      })
    }
    const unsubscribe = subscribeSharedResourceInvalidation('combat-log', load)
    void load()
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeMapId, mode])

  useEffect(() => {
    if (!activeMapId || applyingSharedCombatRef.current) return
    if (orderedCombatPublishRef.current) return
    if (mode !== 'dm') return
    if (!combatActive && initiativeOrder.length === 0) return
    if (combatActive && initiativeOrder.length === 0) return
    publishCombatStateEvent()
  }, [activeMapId, combatActive, round, initiativeIndex, initiativeOrder, dnd5eTurnEconomyByToken, settlementMode, mode])

  // 任何地图切换都清空选中态：不仅 DM 下拉，也覆盖程序化 select()、
  // 远端/玩家跟随、removeMap 自动重选。监听 activeMap?.id 即可统一处理所有路径。
  useEffect(() => {
    const timer = window.setTimeout(() => setSelectedTokenId(null), 0)
    return () => window.clearTimeout(timer)
  }, [activeMap?.id])

  const chooseMode = (next: Mode) => {
    if (forcedMode && next !== forcedMode) return
    window.localStorage.setItem('stars-map-role', next)
    setSelectedMode(next)
    setSelectedTokenId(null)
    closeCharDock()
  }

  const changeSettlementMode = (nextValue: unknown) => {
    if (!isDM) return
    const next = normalizeCombatSettlementMode(nextValue)
    if (next === settlementModeRef.current) return
    clearEnemyTurnTimers()
    enemyAppliedKeysRef.current.clear()
    settlementModeRef.current = next
    setSettlementMode(next)
    if (combatActive) {
      const label = COMBAT_SETTLEMENT_MODE_OPTIONS.find((option) => option.id === next)?.label ?? next
      pushCombatLog(`DM 将战斗结算模式切换为${label}。`, 'system')
      void publishCombatState({ settlementMode: next })
    }
  }

  useEffect(() => {
    const bump = () => setPlayerAssignmentTick((value) => value + 1)
    window.addEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const currentInitiativeEntry = combatActive ? initiativeOrder[initiativeIndex] : undefined
  const currentInitiativeToken =
    combatActive && initiativeOrder.length > 0
      ? activeMap?.tokens.find((t) => t.id === currentInitiativeEntry?.tokenId)
      : undefined
  const isEnemyTurn =
    currentInitiativeToken?.type === 'enemy' &&
    !!currentInitiativeToken &&
    isTokenAlive(currentInitiativeToken, characters)
  const isAutomatedEnemyTurn = isEnemyTurn && dnd5eCombatTokenSide(currentInitiativeToken) === 'enemy'

  const linkedIds = new Set((activeMap?.tokens ?? []).map((t) => t.characterId).filter(Boolean) as string[])
  void playerAssignmentTick
  const visibleChars = isDM || isSpectator ? [] : playerViewCharacters(characters, {
    slot: playerSlot,
    assignedCharacterId,
  })
  const railChars =
    visibleChars.filter((c) => linkedIds.has(c.id)).length > 0
      ? visibleChars.filter((c) => linkedIds.has(c.id))
      : visibleChars

  const closeCharDock = () => {
    setActiveCharId(null)
    setCharPanel(null)
  }

  const clearSharedInterruptPrompts = () => {
    setSharedOpportunityAttackPrompt(null)
    setSharedProtectionPrompt(null)
    setSharedShieldSpellPrompt(null)
    setSharedCounterspellPrompt(null)
    setSharedUncannyDodgePrompt(null)
    setSharedDeflectMissilesPrompt(null)
    setSharedSavingThrowRerollPrompt(null)
    setSharedBardicInspirationPrompt(null)
    setSharedCuttingWordsPrompt(null)
    setSharedDarkOnesOwnLuckPrompt(null)
    setSharedStrokeOfLuckPrompt(null)
    setSharedEmpoweredSpellPrompt(null)
    setSharedEmpoweredSpellSelection([])
    setSharedStandAgainstTidePrompt(null)
    setSharedPluginChoicePrompt(null)
  }

  const clearSharedInterruptLocalState = () => {
    suppressedOpportunityAttackPromptIdsRef.current.clear()
    suppressedProtectionPromptIdsRef.current.clear()
    suppressedShieldSpellPromptIdsRef.current.clear()
    suppressedCounterspellPromptIdsRef.current.clear()
    suppressedUncannyDodgePromptIdsRef.current.clear()
    suppressedDeflectMissilesPromptIdsRef.current.clear()
    suppressedSavingThrowRerollPromptIdsRef.current.clear()
    suppressedBardicInspirationPromptIdsRef.current.clear()
    suppressedCuttingWordsPromptIdsRef.current.clear()
    suppressedDarkOnesOwnLuckPromptIdsRef.current.clear()
    suppressedStrokeOfLuckPromptIdsRef.current.clear()
    suppressedEmpoweredSpellPromptIdsRef.current.clear()
    suppressedStandAgainstTidePromptIdsRef.current.clear()
    suppressedPluginChoicePromptIdsRef.current.clear()
    pendingSharedOpportunityAttackRef.current = null
    pendingSharedProtectionRef.current = null
    pendingSharedShieldSpellRef.current = null
    pendingSharedCounterspellRef.current = null
    pendingSharedUncannyDodgeRef.current = null
    pendingSharedDeflectMissilesRef.current = null
    pendingSharedSavingThrowRerollRef.current = null
    pendingSharedBardicInspirationRef.current = null
    pendingSharedCuttingWordsRef.current = null
    pendingSharedDarkOnesOwnLuckRef.current = null
    pendingSharedStrokeOfLuckRef.current = null
    pendingSharedEmpoweredSpellRef.current = null
    pendingSharedStandAgainstTideRef.current = null
    pendingSharedPluginChoiceRef.current = null
    clearSharedInterruptPrompts()
  }

  const setNullablePromptView = <T,>(
    setter: Dispatch<SetStateAction<T | null>>,
    next: T | undefined,
  ) => {
    if (next) {
      setter(next)
      return
    }
    setter((current) => (current ? null : current))
  }

  const clearPlayerCombatEndUI = () => {
    clearPlayerCombatUI()
    const pendingDialog = combatDialogRef.current
    setCombatDialogLocked(null)
    pendingDialog?.resolve(false)
    setAoePreviewCell(null)
    setAoeRectRotation(0)
    clearSharedInterruptPrompts()
    setPendingPlayerActionLocked(null)
    setSelectedTokenId(null)
    setSelectedCharacterTokenId(null)
    setActiveCharId(null)
    setCharPanel(null)
  }

  const turnCharacter =
    combatActive && currentInitiativeToken?.characterId
      ? characters.find((c) => c.id === currentInitiativeToken.characterId)
      : undefined

  useEffect(() => {
    const turnMonster = currentInitiativeToken?.poolId
      ? getDnd5eSrdMonster(currentInitiativeToken.poolId)
      : undefined
    if (
      !isDM ||
      !combatActive ||
      !currentInitiativeToken ||
      (!turnCharacter && !turnMonster)
    ) return
    const turnKey = `${combatId}:${round}:${currentInitiativeEntry?.slotId ?? currentInitiativeToken.id}`
    if (dnd5eTurnEconomyByTokenRef.current[currentInitiativeToken.id]?.turnKey === turnKey) return
    const speed = turnCharacter
      ? dnd5eEffectiveWalkingSpeed(turnCharacter)
      : Math.max(0, (turnMonster?.speed.walk ?? 30) -
          dnd5eActiveSpeedPenalty(currentInitiativeToken.dnd5eCombatState?.activeEffects))
    const next = {
      ...dnd5eTurnEconomyByTokenRef.current,
      [currentInitiativeToken.id]: createDnd5eTurnEconomyCounts(turnKey, speed),
    }
    dnd5eTurnEconomyByTokenRef.current = next
    setDnd5eTurnEconomyByToken(next)
    if (!turnCharacter) return
    const sacredWeaponTurns = turnCharacter.dnd5eCombatState?.sacredWeaponTurnsRemaining ?? 0
    if (
      turnCharacter.dnd5eCombatState?.recklessAttackTurnKey ||
      turnCharacter.dnd5eCombatState?.dodgingTurnKey ||
      turnCharacter.dnd5eCombatState?.monkAttackActionTurnKey ||
      turnCharacter.dnd5eCombatState?.monkMartialArtsTurnKey ||
      turnCharacter.dnd5eCombatState?.hordeBreakerOpportunityTurnKey ||
      turnCharacter.dnd5eCombatState?.hordeBreakerSourceTargetId ||
      turnCharacter.dnd5eCombatState?.hordeBreakerUsedTurnKey ||
      sacredWeaponTurns > 0
    ) {
      const refreshedTurnCharacter = {
        ...turnCharacter,
        dnd5eCombatState: {
          ...turnCharacter.dnd5eCombatState,
          recklessAttackTurnKey: undefined,
          dodgingTurnKey: undefined,
          monkAttackActionTurnKey: undefined,
          monkMartialArtsTurnKey: undefined,
          hordeBreakerOpportunityTurnKey: undefined,
          hordeBreakerSourceTargetId: undefined,
          hordeBreakerUsedTurnKey: undefined,
          sacredWeaponTurnsRemaining: sacredWeaponTurns > 1 ? sacredWeaponTurns - 1 : undefined,
        },
      }
      applyAuthorityCharacterUpdate(turnCharacter.id, refreshedTurnCharacter)
    }
  }, [isDM, combatActive, combatId, round, initiativeIndex, currentInitiativeEntry?.slotId, currentInitiativeToken, turnCharacter, activeMap?.id, applyAuthorityCharacterUpdate])

  const playerChar = isSpectator
    ? undefined
    : getPlayerCharacter(characters, {
      slot: playerSlot,
      assignedCharacterId,
    }) ?? visibleChars[0]

  const playerAuthorityReadyForCurrentCombat = isDM || matchesDmAuthorityReady(dmAuthorityReady, {
    mapId: activeMap?.id,
    combatId,
    combatActive,
  })

  const canControlPlayerTurn =
    combatActive &&
    playerAuthorityReadyForCurrentCombat &&
    usesAutomatedPlayerSettlement(settlementMode) &&
    currentInitiativeToken?.type === 'player' &&
    !!turnCharacter &&
    turnCharacter.currentHp > 0 &&
    !!currentInitiativeToken &&
    isTokenAlive(currentInitiativeToken, characters) &&
    (isDM || (!pendingPlayerAction && turnCharacter.id === playerChar?.id))

  const canControlDeathSaveTurn =
    combatActive &&
    playerAuthorityReadyForCurrentCombat &&
    usesAutomatedPlayerSettlement(settlementMode) &&
    currentInitiativeToken?.type === 'player' &&
    !!turnCharacter &&
    characterNeedsDeathSave(turnCharacter) &&
    (isDM || (!pendingPlayerAction && turnCharacter.id === playerChar?.id))

  const playerCombatLocked = !isDM && playerCombatEndedLocked && !combatActive

  const manualSettlementTargets: ManualSettlementTarget[] = activeMap
    ? activeMap.tokens.flatMap<ManualSettlementTarget>((token): ManualSettlementTarget[] => {
      if (token.type === 'obstacle') return []
      const character = token.characterId
        ? characters.find((candidate) => candidate.id === token.characterId)
        : undefined
      if (character) {
        return [{
          id: token.id,
          label: character.name,
          type: token.type === 'enemy' ? 'enemy' as const : 'player' as const,
          currentHp: character.currentHp,
          maxHp: character.maxHp,
          temporaryHp: character.tempHp,
          supportsTemporaryHp: true,
        }]
      }
      const maxHp = Math.max(1, token.maxHp ?? token.hp ?? 1)
      return [{
        id: token.id,
        label: token.label,
        type: token.type === 'enemy' ? 'enemy' as const : 'npc' as const,
        currentHp: Math.min(maxHp, Math.max(0, token.hp ?? maxHp)),
        maxHp,
        temporaryHp: 0,
        supportsTemporaryHp: false,
      }]
    })
    : []

  const manualDiceRollerName = isDM
    ? getRoomSession()?.displayName || 'DM'
    : playerChar?.name || getRoomSession()?.displayName || '玩家'

  const handleManualDiceRoll = async (input: {
    count: number
    sides: number
    bonus: number
    label: string
    visibility: 'public' | 'dm'
  }) => {
    if (!supportsManualDice(settlementModeRef.current, isDM ? 'dm' : 'player')) return
    const isPrivate = isDM && input.visibility === 'dm'
    const values = await rollDiceBoxValues(
      input.count,
      input.sides,
      input.label,
      manualDiceRollerName,
      { broadcast: !isPrivate },
    )
    const total = values.reduce((sum, value) => sum + value, 0) + input.bonus
    const manualRoll: DiceRoll = {
      values,
      sides: input.sides,
      bonus: input.bonus,
      total,
      label: `${manualDiceRollerName} · ${input.label}`,
      formula: `${input.count}d${input.sides}${input.bonus === 0 ? '' : input.bonus > 0 ? ` + ${input.bonus}` : ` - ${Math.abs(input.bonus)}`}`,
      targetName: isPrivate ? '暗骰（仅 DM 可见）' : '明骰',
    }
    setRoll(manualRoll)
    if (isPrivate) return
    publishSharedDiceRoll(manualRoll, { visibility: 'public', rollerName: manualDiceRollerName })
    pushCombatLog(
      `${manualDiceRollerName} 明骰 ${input.count}d${input.sides}${input.bonus === 0 ? '' : input.bonus > 0 ? `+${input.bonus}` : input.bonus}：${values.join(' + ')}${input.bonus === 0 ? '' : input.bonus > 0 ? ` + ${input.bonus}` : ` - ${Math.abs(input.bonus)}`} = ${total}。`,
      'attack',
      roundRef.current,
      [
        `骰式：${input.count}d${input.sides}${input.bonus === 0 ? '' : input.bonus > 0 ? ` + ${input.bonus}` : ` - ${Math.abs(input.bonus)}`}`,
        `骰面：${values.join('、')}｜最终结果 ${total}｜公开明骰`,
      ],
    )
  }

  const handleManualSettlement = (
    targetId: string,
    operation: ManualSettlementOperation,
    amount: number,
  ) => {
    if (!isDM || !activeMap || settlementModeRef.current === 'automatic') return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const token = latestMap.tokens.find((candidate) => candidate.id === targetId)
    if (!token || token.type === 'obstacle') return
    const character = token.characterId
      ? useCharacterStore.getState().characters.find((candidate) => candidate.id === token.characterId)
      : undefined
    const operationLabel = operation === 'damage' ? '伤害' : operation === 'healing' ? '治疗' : '临时生命值'
    if (character) {
      const next = applyManualHitPointOperation({
        currentHp: character.currentHp,
        maxHp: character.maxHp,
        temporaryHp: character.tempHp,
      }, operation, amount)
      updateChar(character.id, { currentHp: next.currentHp, tempHp: next.temporaryHp })
      pushCombatLog(
        `DM 手动结算：${character.name} ${operationLabel} ${Math.max(0, Math.floor(amount))}；当前 HP ${next.currentHp}/${next.maxHp}${next.temporaryHp > 0 ? `，临时 HP ${next.temporaryHp}` : ''}。`,
        operation === 'damage' ? 'damage' : 'system',
        roundRef.current,
        [
          `HP ${character.currentHp} → ${next.currentHp}（上限 ${next.maxHp}）`,
          `临时 HP ${character.tempHp} → ${next.temporaryHp}`,
          '结算来源：DM 手动调整',
        ],
      )
      return
    }
    if (operation === 'temporary-hit-points') return
    const maxHp = Math.max(1, token.maxHp ?? token.hp ?? 1)
    const next = applyManualHitPointOperation({
      currentHp: token.hp ?? maxHp,
      maxHp,
      temporaryHp: 0,
    }, operation, amount)
    updateToken(activeMap.id, token.id, { hp: next.currentHp, maxHp: next.maxHp })
    pushCombatLog(
      `DM 手动结算：${token.label} ${operationLabel} ${Math.max(0, Math.floor(amount))}；当前 HP ${next.currentHp}/${next.maxHp}。`,
      operation === 'damage' ? 'damage' : 'system',
      roundRef.current,
      [
        `HP ${token.hp ?? maxHp} → ${next.currentHp}（上限 ${next.maxHp}）`,
        '结算来源：DM 手动调整',
      ],
    )
  }

  const myPlayerToken =
    activeMap && turnCharacter
      ? activeMap.tokens.find((t) => t.type === 'player' && t.characterId === turnCharacter.id)
      : undefined
  const fogGeometryProjection = activeMap
    ? buildMapsFogGeometryProjection({
        map: activeMap,
        fogMaps,
        geometryMaps,
        explorationMaps,
        isDm: isDM,
        roomMemberId: roomSession?.memberId,
        controlledCharacterIds: [assignedCharacterId, playerChar?.id, ...visibleChars.map((character) => character.id)],
      })
    : undefined
  const visionSourceTokenIds = fogGeometryProjection?.visionSourceTokenIds ?? []
  const exploredVisionPolygons = fogGeometryProjection?.exploredVisionPolygons ?? []
  const manualFogExplorationEnabled = fogGeometryProjection?.manualFogExplorationEnabled ?? false

  useEffect(() => {
    if (!isDM || !activeMap || !activeGeometry ||
      (!activeGeometry.vision.enabled && !manualFogExplorationEnabled)) return
    const updates = buildMapExplorationUpdates({
      map: activeMap,
      geometry: activeGeometry,
      characters,
      forceEnabled: manualFogExplorationEnabled,
    })
    for (const update of updates) recordMapExploration(activeMap.id, update.memberId, update.polygons)
  }, [activeGeometry, activeMap, characters, isDM, manualFogExplorationEnabled, recordMapExploration])

  const moveCircle = (() => {
    if (!showMoveRange || !activeMap || !myPlayerToken || !turnCharacter) return undefined
    const availableFeet = dnd5eTurnEconomyByToken[myPlayerToken.id]?.movement.current ?? dnd5eEffectiveWalkingSpeed(turnCharacter)
    const isProne = turnCharacter.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const standFromProne = isProne && dnd5eStandFromProne
    const standCost = standFromProne ? Math.floor(dnd5eEffectiveWalkingSpeed(turnCharacter) / 2) : 0
    const traversalMultiplier = dnd5eCarefulMovement || (isProne && !standFromProne) ? 2 : 1
    const feet = Math.floor(Math.max(0, availableFeet - standCost) / traversalMultiplier)
    return {
      centerX: myPlayerToken.x,
      centerY: myPlayerToken.y,
      radiusPx: movementRadiusPx(feet, activeMap),
      feet,
    }
  })()

  const activeMoveCircle = moveCircle
  const inMoveSelectMode = canControlPlayerTurn && showMoveRange && !!moveCircle

  const onAvatarClick = (charId: string) => {
    if (activeCharId === charId && !charPanel) {
      setActiveCharId(null)
      return
    }
    setActiveCharId(charId)
  }

  const playerCharacterId = playerChar?.id
  useEffect(() => {
    if (isDM) return
    if (!playerCharacterId) {
      if (activeCharId) {
        const timer = window.setTimeout(() => {
          setActiveCharId(null)
          setCharPanel(null)
        }, 0)
        return () => window.clearTimeout(timer)
      }
      return
    }
    if (activeCharId && activeCharId !== playerCharacterId) {
      const timer = window.setTimeout(() => {
        setActiveCharId(null)
        setCharPanel(null)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [isDM, playerCharacterId, activeCharId])

  const onPanelClick = (charId: string, panel: CharDockPanel) => {
    if (activeCharId === charId && charPanel === panel) {
      closeCharDock()
      return
    }
    setActiveCharId(charId)
    setCharPanel(panel)
  }

  // 每个 token 的生命值（角色取关联角色 HP，否则取 token 自身 HP）
  const tokenHp = (t: Token): { hp: number; max: number; temp?: number } | undefined => {
    if (t.characterId) {
      const ch = characters.find((c) => c.id === t.characterId)
      if (ch) return { hp: ch.currentHp, max: ch.maxHp, temp: ch.tempHp ?? 0 }
    }
    if (t.maxHp != null) return { hp: t.hp ?? t.maxHp, max: t.maxHp }
    return undefined
  }
  const hpByToken: Record<string, { hp: number; max: number; temp?: number }> = {}
  for (const t of activeMap?.tokens ?? []) {
    const h = tokenHp(t)
    if (h) hpByToken[t.id] = h
  }
  const defeatedTokenIds = activeMap
    ? activeMap.tokens
        .filter((t) => isTokenDefeated(t, characters, hpByToken[t.id]))
        .map((t) => t.id)
    : []

  useEffect(() => {
    if (!isDM || !activeMap || (activeMap.dnd5ePluginAreas?.length ?? 0) === 0) return
    const next = reconcileDnd5ePluginAreasOnMap(
      activeMap,
      useCharacterStore.getState().characters,
      round,
    )
    if (next !== activeMap) {
      updateMap(activeMap.id, {
        dnd5ePluginAreas: next.dnd5ePluginAreas,
        tokens: next.tokens,
      })
    }
  }, [isDM, activeMap, characters, round, updateMap])

  useEffect(() => {
    if (!isDM || !activeMap || !activeMap.tokens.some((token) => token.dnd5eSummon)) return
    const reconciled = reconcileDnd5eSummonedCreatures({
      map: activeMap,
      characters: useCharacterStore.getState().characters,
      round,
    })
    if (reconciled.removedTokenIds.length === 0) return
    updateMap(activeMap.id, { tokens: reconciled.map.tokens })
    let nextOrder = initiativeOrderRef.current
    let nextIndex = initiativeIndexRef.current
    for (const tokenId of reconciled.removedTokenIds) {
      const pruned = pruneInitiativeForToken(nextOrder, nextIndex, tokenId)
      nextOrder = pruned.order
      nextIndex = pruned.index
    }
    initiativeOrderRef.current = nextOrder
    initiativeIndexRef.current = nextIndex
    setInitiativeOrder(nextOrder)
    setInitiativeIndex(nextIndex)
    void publishCombatState({ initiativeOrder: nextOrder, initiativeIndex: nextIndex })
    for (const tokenId of reconciled.removedTokenIds) {
      pushCombatLog(`召唤生物 ${activeMap.tokens.find((token) => token.id === tokenId)?.label ?? tokenId} 已离场。`, 'system')
    }
  // Reconciliation is keyed by authoritative map/character snapshots; callbacks are intentionally not dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDM, activeMap, characters, round, updateMap])

  // 只有 Token 真正从地图移除时才清空选择。0 HP／阵亡怪物仍需保持可选，
  // 否则详情面板会在点击后的下一帧被关闭，看起来像“闪一下就消失”。
  useEffect(() => {
    if (shouldClearSelectedMapToken(selectedTokenId, activeMap?.tokens ?? [])) {
      const timer = window.setTimeout(() => setSelectedTokenId(null), 0)
      return () => window.clearTimeout(timer)
    }
  }, [selectedTokenId, activeMap?.tokens])

  const activeAoeTargeting = dnd5eCoreAreaMoveTargeting?.targeting ??
    dnd5ePluginAreaTargeting?.targeting.template ?? dnd5eSpellTargeting?.area
  const activeAoeCasterId = dnd5eCoreAreaMoveTargeting
    ? dnd5eCoreAreaMoveTargeting.characterId
    : dnd5ePluginAreaTargeting
    ? dnd5ePluginAreaTargeting.characterId
    : dnd5eItemAreaTargeting
    ? dnd5eItemAreaTargeting.characterId
    : dnd5eSpellTargeting?.area
      ? dnd5eSpellTargeting.characterId
      : undefined
  const aoeCasterCell = ((): GridCell | null => {
    if (dnd5eCoreAreaMoveTargeting) return dnd5eCoreAreaMoveTargeting.originCell
    if (!activeMap || !activeAoeCasterId) return null
    const casterToken = activeMap.tokens.find((t) => t.characterId === activeAoeCasterId)
    if (!casterToken) return null
    return pixelToCell(casterToken.x, casterToken.y, activeMap)
  })()
  const activeMapGridSize = activeMap?.gridSize ?? 1
  const activeMapGridOffsetX = activeMap?.gridOffsetX ?? 0
  const activeMapGridOffsetY = activeMap?.gridOffsetY ?? 0

  const dnd5eItemAreaHighlight = (() => {
    if (!dnd5eItemAreaTargeting || !aoePreviewCell || !activeMap) return undefined
    const actorToken = activeMap.tokens.find((token) => token.characterId === dnd5eItemAreaTargeting.characterId)
    if (!actorToken) return undefined
    const preview = previewDnd5eItemAreaPlacement({
      map: activeMap,
      actorToken,
      targeting: dnd5eItemAreaTargeting.targeting,
      targetCell: aoePreviewCell,
    })
    return {
      cells: preview.cells,
      rangeCells: preview.rangeCells,
      valid: preview.valid,
      variant: 'attack' as const,
    }
  })()

  const spellOrSkillAoeHighlight = useMemo(() => {
    if (!activeAoeTargeting || !aoePreviewCell || !aoeCasterCell) return undefined
    const valid = canPlaceAoe(activeAoeTargeting, aoeCasterCell, aoePreviewCell)
    const orientFrom = aoeOrientFromCell(activeAoeTargeting, aoeCasterCell, aoePreviewCell, {
      rectRotation: aoeRectRotation,
    })
    const cells = cellsForAoe(activeAoeTargeting, orientFrom, aoePreviewCell)
    const isSelfCircle =
      activeAoeTargeting.shape === 'circle' && activeAoeTargeting.origin === 'self'
    const rangeCells =
      activeAoeTargeting.shape === 'circle' && activeAoeTargeting.origin === 'point' && activeAoeTargeting.placeRangeFeet != null
        ? cellsForAoe(
            { shape: 'circle', origin: 'self', radiusFeet: activeAoeTargeting.placeRangeFeet },
            aoeCasterCell,
            aoeCasterCell,
          )
        : activeAoeTargeting.shape === 'rect' && activeAoeTargeting.placeRangeFeet != null
          ? cellsForAoe(
              { shape: 'circle', origin: 'self', radiusFeet: activeAoeTargeting.placeRangeFeet },
              aoeCasterCell,
              aoeCasterCell,
            )
          : undefined
    const cellCenterToPixel = (cell: GridCell) => ({
      x: activeMapGridOffsetX + (cell.col + 0.5) * activeMapGridSize,
      y: activeMapGridOffsetY + (cell.row + 0.5) * activeMapGridSize,
    })
    const areaCenterCell = isSelfCircle ? aoeCasterCell : aoePreviewCell
    const areaCenter = cellCenterToPixel(areaCenterCell)
    const areaCircle =
      activeAoeTargeting.shape === 'circle'
        ? {
            centerX: areaCenter.x,
            centerY: areaCenter.y,
            radiusPx: activeAoeTargeting.radiusFeet / 5 * activeMapGridSize,
          }
        : undefined
    const areaPolygon = (() => {
      const aoe = activeAoeTargeting
      if (aoe.shape === 'circle') return undefined
      if (aoe.shape === 'cone') {
        const origin = cellCenterToPixel(aoeCasterCell)
        const aim = cellCenterToPixel(aoePreviewCell)
        const dx = aim.x - origin.x
        const dy = aim.y - origin.y
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const px = -uy
        const py = ux
        const length = aoe.lengthFeet / 5 * activeMapGridSize
        const halfWidth = length / 2
        const endX = origin.x + ux * length
        const endY = origin.y + uy * length
        return [origin.x, origin.y, endX + px * halfWidth, endY + py * halfWidth, endX - px * halfWidth, endY - py * halfWidth]
      }
      const origin = cellCenterToPixel(aoe.shape === 'line' ? aoeCasterCell : aoePreviewCell)
      const aim =
        aoe.shape === 'line'
          ? cellCenterToPixel(aoePreviewCell)
          : cellCenterToPixel({
              col: aoePreviewCell.col * 2 - orientFrom.col,
              row: aoePreviewCell.row * 2 - orientFrom.row,
            })
      const dx = aim.x - origin.x
      const dy = aim.y - origin.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const px = -uy
      const py = ux
      const w = aoe.widthFeet / 5 * activeMapGridSize
      const h = (aoe.shape === 'line' ? aoe.lengthFeet : aoe.heightFeet) / 5 * activeMapGridSize
      if (aoe.shape === 'line') {
        const start = origin
        const end = { x: origin.x + ux * h, y: origin.y + uy * h }
        return [
          start.x + px * w / 2, start.y + py * w / 2,
          end.x + px * w / 2, end.y + py * w / 2,
          end.x - px * w / 2, end.y - py * w / 2,
          start.x - px * w / 2, start.y - py * w / 2,
        ]
      }
      return [
        origin.x - ux * h / 2 + px * w / 2, origin.y - uy * h / 2 + py * w / 2,
        origin.x + ux * h / 2 + px * w / 2, origin.y + uy * h / 2 + py * w / 2,
        origin.x + ux * h / 2 - px * w / 2, origin.y + uy * h / 2 - py * w / 2,
        origin.x - ux * h / 2 - px * w / 2, origin.y - uy * h / 2 - py * w / 2,
      ]
    })()
    return {
      cells,
      rangeCells,
      valid,
      variant: isSelfCircle ? ('range' as const) : ('attack' as const),
      areaCircle,
      areaPolygon,
    }
  }, [activeAoeTargeting, aoePreviewCell, aoeCasterCell, activeMapGridSize, activeMapGridOffsetX, activeMapGridOffsetY, aoeRectRotation])
  const aoeHighlight = dnd5eItemAreaHighlight ?? spellOrSkillAoeHighlight

  const rangedRangeCells = (() => {
    if (dnd5eItemCreatureTargeting && activeMap) {
      const casterToken = activeMap.tokens.find((token) => token.characterId === dnd5eItemCreatureTargeting.characterId)
      if (!casterToken) return [] as GridCell[]
      const casterCell = pixelToCell(casterToken.x, casterToken.y, activeMap)
      return cellsForAoe(
        { shape: 'circle', origin: 'self', radiusFeet: dnd5eItemCreatureTargeting.targeting.rangeFeet },
        casterCell,
        casterCell,
      )
    }
    return [] as GridCell[]
  })()

  useEffect(() => {
    let timer = 0
    if ((!activeAoeTargeting && !dnd5eItemAreaTargeting) || !aoeCasterCell) {
      if (!activeAoeTargeting && !dnd5eItemAreaTargeting) {
        timer = window.setTimeout(() => setAoePreviewCell(null), 0)
      }
      return () => {
        if (timer) window.clearTimeout(timer)
      }
    }
    timer = window.setTimeout(() => setAoePreviewCell(aoeCasterCell), 0)
    return () => window.clearTimeout(timer)
  }, [activeAoeTargeting, dnd5eItemAreaTargeting, activeAoeCasterId, aoeCasterCell])

  useEffect(() => {
    if (activeAoeTargeting?.shape !== 'rect' || !activeAoeTargeting.rotatable) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'q') {
        e.preventDefault()
        setAoeRectRotation((r) => (r + 3) % 4)
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        setAoeRectRotation((r) => (r + 1) % 4)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeAoeTargeting])

  // 选中 token 的键盘操作：方向键移动一格、Delete/Backspace 删除。
  // 仅 DM；在 input/textarea/contentEditable 中输入时不触发；不引入玩家端权威写入（沿用既有 DM 路径）。
  useEffect(() => {
    if (!isDM || !activeMap || !selectedToken) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      // 拖动/测距/网格调整等模式下不接管键盘
      if (deleteSelectMode || measureMode || gridAdjustMode || showMoveRange) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        setSelectedTokenId(null)
        removeToken(activeMap.id, selectedToken.id)
        return
      }

      const deltas: Record<string, [number, number]> = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      }
      const delta = deltas[e.key]
      if (!delta) return
      e.preventDefault()
      const from = tokenAnchorCellFromPixel(selectedToken.x, selectedToken.y, selectedToken, activeMap)
      const to: GridCell = { col: from.col + delta[0], row: from.row + delta[1] }
      // 目标格被其它 token 占用则不移动（与拖放占格规则一致）
      const blocked = occupiedCells(activeMap.tokens, activeMap, selectedToken.id)
      const pos = tokenCenterForAnchorCell(to, selectedToken, activeMap)
      const candidate = { ...selectedToken, ...pos }
      const cells = tokenOccupiedCellsAt(candidate, activeMap, candidate)
      if (cells.some((cell) => cell.col < 0 || cell.row < 0 || blocked.has(cellKey(cell)))) return
      updateToken(activeMap.id, selectedToken.id, pos)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [
    isDM,
    activeMap,
    selectedToken,
    deleteSelectMode,
    measureMode,
    gridAdjustMode,
    showMoveRange,
    removeToken,
    updateToken,
  ])

  const tokenHoverLabels = (() => {
    const labels: Record<string, string> = {}
    for (const [tokenId, conditions] of Object.entries(dnd5eConditionsByToken)) {
      labels[tokenId] = `状态：${conditions.map(dnd5eConditionLabel).join('、')}`
    }
    return labels
  })()

  const handleRollDone = () => {
    setRoll(null)
    const next = afterRollRef.current
    afterRollRef.current = null
    next?.()
  }

  const settleDnd5ePersistentAreaCandidates = async (input: {
    candidates: readonly Dnd5ePersistentAreaTriggerCandidate[]
    map: BattleMap
    characters: readonly Character[]
    round: number
  }): Promise<{ map: BattleMap; characters: Character[]; logs: string[] }> => {
    let map = input.map
    let characters = [...input.characters]
    const logs: string[] = []
    for (const candidate of input.candidates) {
      const currentArea = map.dnd5ePluginAreas?.find((area) => area.id === candidate.area.id)
      if (!currentArea) continue
      const currentCandidate = { ...candidate, area: currentArea }
      const prepared = prepareDnd5ePersistentAreaTrigger({
        combatId: combatIdRef.current || `map-${map.id}`,
        round: input.round,
        map,
        characters,
        initiativeOrder: initiativeOrderRef.current,
        candidate: currentCandidate,
      })
      if (!prepared.ok) {
        logs.push(`${candidate.area.label} 的触发事务准备失败：${prepared.reason}。`)
        continue
      }
      const save = prepared.prepared.save
      const saveAbilityLabel = save ? ABILITIES.find((ability) => ability.key === save.ability)?.label ?? save.ability : ''
      const d20 = save ? await rollDiceBoxD20(`${candidate.trigger.label}·${saveAbilityLabel}豁免`, prepared.prepared.targetName) : undefined
      const d20Second = save && save.mode !== 'normal'
        ? await rollDiceBoxD20(
            `${candidate.trigger.label}·${saveAbilityLabel}豁免（${save.mode === 'advantage' ? '优势' : '劣势'}）`,
            prepared.prepared.targetName,
          )
        : undefined
      const blessRoll = save?.blessed
        ? (await rollDiceBoxValues(1, 4, '祝福术·区域豁免加值', prepared.prepared.targetName))[0]
        : undefined
      const baneRoll = save?.baned
        ? (await rollDiceBoxValues(1, 4, '灾祸术·区域豁免减值', prepared.prepared.targetName))[0]
        : undefined
      const damageRolls = candidate.trigger.damage
        ? await rollDiceBoxValues(
            candidate.trigger.damage.count,
            candidate.trigger.damage.sides,
            `${candidate.area.label}·${candidate.trigger.label}`,
            prepared.prepared.targetName,
          )
        : undefined
      const rollInput = { d20, d20Second, blessRoll, baneRoll, damageRolls }
      let resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, ...rollInput })
      if (!resolved.result.ok || !resolved.application) {
        logs.push(`${candidate.area.label} 的触发事务被 Headless 拒绝：${resolved.result.ok ? 'missing-application' : resolved.result.reason}。`)
        continue
      }
      if (candidate.trigger.dmAdjustable) {
        const triggerEvent = resolved.result.events.find((event) => event.type === 'persistent-area-triggered')
        if (triggerEvent?.type !== 'persistent-area-triggered') continue
        const response = await requestSharedPersistentAreaAdjudication({
          prepared: prepared.prepared,
          proposedDamage: triggerEvent.damage,
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
        resolved = resolvePreparedDnd5ePersistentAreaTrigger({
          prepared: prepared.prepared,
          ...rollInput,
          dmAdjustment,
        })
        if (!resolved.result.ok || !resolved.application) {
          logs.push(`${candidate.area.label} 的 DM 调整未通过 Headless 校验。`)
          continue
        }
      }
      const settled = await settleDnd5eConcentrationChecks({
        result: resolved.result,
        map: resolved.application.map,
        characters: resolved.application.characters,
        characterIdByCombatantId: prepared.prepared.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      map = settled.application.map
      characters = settled.application.characters
      const triggerEvent = settled.result.events.find((event) => event.type === 'persistent-area-triggered')
      const saveEvent = settled.result.events.find((event) => event.type === 'saving-throw-resolved')
      const saveText = saveEvent?.type === 'saving-throw-resolved'
        ? `，豁免 ${saveEvent.total} vs DC ${saveEvent.dc} ${saveEvent.success ? '成功' : '失败'}`
        : ''
      logs.push(
        `${candidate.area.label} 在${({ 'on-create': '首次创建', 'on-enter': '进入区域', 'on-move-distance': '区域内移动', 'on-area-move-impact': '区域移动撞击', 'turn-start': '回合开始', 'turn-end': '回合结束' } as const)[candidate.trigger.timing]}触发 ${prepared.prepared.targetName}${saveText}${triggerEvent?.type === 'persistent-area-triggered' && triggerEvent.damage > 0 ? `，造成 ${triggerEvent.damage} 点伤害` : ''}${triggerEvent?.type === 'persistent-area-triggered' && triggerEvent.conditionApplied ? `，施加 ${dnd5eConditionLabel(triggerEvent.conditionApplied)}` : ''}。`,
      )
    }
    return { map, characters, logs }
  }

  const settleDnd5ePersistentAreasForForcedMovement = async (input: {
    beforeMap: BattleMap
    afterMap: BattleMap
    characters: readonly Character[]
    tokenId: string
    round: number
    turnKey: string
  }): Promise<{ map: BattleMap; characters: Character[]; logs: string[] }> => {
    const beforeToken = input.beforeMap.tokens.find((token) => token.id === input.tokenId)
    const afterToken = input.afterMap.tokens.find((token) => token.id === input.tokenId)
    if (!beforeToken || !afterToken || (beforeToken.x === afterToken.x && beforeToken.y === afterToken.y)) {
      return { map: input.afterMap, characters: [...input.characters], logs: [] }
    }
    const movement = { token: beforeToken, to: { x: afterToken.x, y: afterToken.y } }
    const candidates = [
      ...collectDnd5ePersistentAreaTriggers({
        map: input.afterMap,
        timing: 'on-enter',
        round: input.round,
        turnKey: input.turnKey,
        movement,
      }),
      ...collectDnd5ePersistentAreaTriggers({
        map: input.afterMap,
        timing: 'on-move-distance',
        round: input.round,
        turnKey: input.turnKey,
        movement,
      }),
    ].sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0))
    return settleDnd5ePersistentAreaCandidates({
      candidates,
      map: input.afterMap,
      characters: input.characters,
      round: input.round,
    })
  }

  const settleDnd5eItemAreasForMove = async (input: {
    state: Dnd5eHeadlessCombatState
    map: BattleMap
    characters: readonly Character[]
    characterIdByCombatantId: Readonly<Record<string, string>>
    token: Token
    to: { x: number; y: number }
    path?: Array<{ x: number; y: number }>
    carefulMovement?: boolean
  }): Promise<{
    state: Dnd5eHeadlessCombatState
    map: BattleMap
    application: Dnd5eMapResultPlan
    finalPosition: { x: number; y: number }
    logs: string[]
  }> => {
    const entered = dnd5eItemAreasEnteredByMove({ map: input.map, token: input.token, to: input.to, path: input.path })
    let state = input.state
    let map = input.map
    let finalPosition = input.to
    const logs: string[] = []
    const areaLabels = { 'ball-bearings': '滚珠', caltrops: '铁蒺藜', 'hunting-trap': '捕猎陷阱' } as const
    for (const entry of entered) {
      const combatant = state.combatants[input.token.id]
      if (!combatant || combatant.currentHp <= 0) break
      if (input.carefulMovement && entry.area.kind !== 'hunting-trap') {
        logs.push(`${combatant.name} 以半速谨慎穿过${areaLabels[entry.area.kind]}区域，无需进行敏捷豁免。`)
        continue
      }
      const mode = dnd5eSavingThrowMode(combatant, 'dex', { effectVisible: true })
      const d20 = await rollDiceBoxD20(`${areaLabels[entry.area.kind]}·敏捷豁免`, combatant.name)
      const d20Second = mode !== 'normal'
        ? await rollDiceBoxD20(`${areaLabels[entry.area.kind]}·敏捷豁免（${mode === 'advantage' ? '优势' : '劣势'}）`, combatant.name)
        : undefined
      const damageRolls = entry.area.kind === 'hunting-trap'
        ? await rollDiceBoxValues(1, 4, '捕猎陷阱·穿刺伤害', combatant.name)
        : undefined
      const triggered = resolveDnd5eHeadlessAction(state, {
        type: 'item-area-trigger',
        actorId: input.token.id,
        areaId: entry.area.id,
        areaKind: entry.area.kind,
        d20,
        d20Second,
        damageRolls,
      })
      if (!triggered.ok) {
        logs.push(`${combatant.name} 进入${areaLabels[entry.area.kind]}区域，但 Headless 拒绝了触发：${triggered.reason}。`)
        break
      }
      state = triggered.state
      const save = triggered.events.find((event) => event.type === 'saving-throw-resolved')
      if (save?.type !== 'saving-throw-resolved') continue
      logs.push(`${combatant.name} 进入${areaLabels[entry.area.kind]}区域，敏捷豁免 ${save.total} vs DC ${save.dc}：${save.success ? '成功' : '失败'}。`)
      if (save.success) continue
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
      characters: input.characters,
      characterIdByCombatantId: input.characterIdByCombatantId,
    })
    const pluginCandidates = collectDnd5ePersistentAreaTriggers({
      map: baseApplication.map,
      timing: 'on-enter',
      round: roundRef.current,
      turnKey: `${roundRef.current}:${currentInitiativeToken?.id ?? input.token.id}`,
      movement: { token: input.token, to: finalPosition, path: input.path },
    })
    const movementDistanceCandidates = collectDnd5ePersistentAreaTriggers({
      map: baseApplication.map,
      timing: 'on-move-distance',
      round: roundRef.current,
      turnKey: `${roundRef.current}:${currentInitiativeToken?.id ?? input.token.id}`,
      movement: { token: input.token, to: finalPosition, path: input.path },
    })
    const pluginAreas = await settleDnd5ePersistentAreaCandidates({
      candidates: [...pluginCandidates, ...movementDistanceCandidates]
        .sort((left, right) => (left.pathIndex ?? 0) - (right.pathIndex ?? 0)),
      map: baseApplication.map,
      characters: baseApplication.characters,
      round: roundRef.current,
    })
    logs.push(...pluginAreas.logs)
    const changedCharacterIds = pluginAreas.characters.flatMap((character) => {
      const before = input.characters.find((candidate) => candidate.id === character.id)
      return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
    })
    const changedTokenIds = pluginAreas.map.tokens.flatMap((token) => {
      const before = input.map.tokens.find((candidate) => candidate.id === token.id)
      return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
    })
    return {
      state,
      map: pluginAreas.map,
      finalPosition,
      logs,
      application: {
        map: pluginAreas.map,
        characters: pluginAreas.characters,
        changedCharacterIds,
        changedTokenIds,
      },
    }
  }

  const resolveSrd5eMonsterMoveThroughHeadless = async (
    enemy: Token,
    targetPosition: { x: number; y: number },
    options: { dash?: boolean } = {},
  ) => {
    if (!activeMap) return false
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const resolved = resolveDnd5eMonsterMapMove({
      combatId: combatIdRef.current || `map-${latestMap.id}`,
      round: roundRef.current,
      map: latestMap,
      characters: useCharacterStore.getState().characters,
      initiativeOrder: initiativeOrderRef.current,
      actorTokenId: enemy.id,
      to: targetPosition,
      dash: options.dash,
      turnEconomy: currentDnd5eTurnEconomy(enemy.id, roundRef.current),
    })
    if (!resolved.ok) {
      pushCombatLog(`${enemy.label} 的移动未执行：${resolved.reason}。`, 'system')
      return false
    }
    if (!resolved.result.ok || !resolved.application) {
      pushCombatLog(`${enemy.label} 的移动被 Headless 拒绝：${resolved.result.ok ? 'missing-application' : resolved.result.reason}。`, 'system')
      return false
    }
    const hazards = await settleDnd5eItemAreasForMove({
      state: resolved.result.state,
      map: latestMap,
      characters: useCharacterStore.getState().characters,
      characterIdByCombatantId: {},
      token: enemy,
      to: targetPosition,
      path: resolved.path,
    })
    for (const doorId of resolved.doorsToOpen) setGeometryDoorState(latestMap.id, doorId, 'open')
    const resolvedTurn = resolved.result.state.combatants[enemy.id]?.turn
    if (resolvedTurn) {
      updateDnd5eTurnEconomy(enemy.id, (economy) => ({
        ...economy,
        action: { ...economy.action, current: resolvedTurn.actionAvailable ? economy.action.current : 0 },
        bonusAction: { ...economy.bonusAction, current: resolvedTurn.bonusActionAvailable ? economy.bonusAction.current : 0 },
        reaction: { ...economy.reaction, current: resolvedTurn.reactionAvailable ? economy.reaction.current : 0 },
        objectInteraction: {
          current: resolvedTurn.objectInteractionAvailable === false ? 0 : (economy.objectInteraction?.current ?? 1),
          max: economy.objectInteraction?.max ?? 1,
        },
        movement: { ...economy.movement, current: resolvedTurn.movementRemaining },
      }), roundRef.current)
    }
    if (JSON.stringify(hazards.map.dnd5eItemAreas ?? []) !== JSON.stringify(latestMap.dnd5eItemAreas ?? [])) {
      updateMap(latestMap.id, { dnd5eItemAreas: hazards.map.dnd5eItemAreas })
    }
    if (JSON.stringify(hazards.map.dnd5ePluginAreas ?? []) !== JSON.stringify(latestMap.dnd5ePluginAreas ?? [])) {
      updateMap(latestMap.id, { dnd5ePluginAreas: hazards.map.dnd5ePluginAreas })
    }
    const monsterMovementApplication = {
      ...hazards.application,
      map: {
        ...hazards.application.map,
        tokens: hazards.application.map.tokens.map((token) => {
          if (token.id !== enemy.id || !hazards.application.changedTokenIds.includes(token.id)) return token
          return {
            ...token,
            movementAnimation: createTokenMovementAnimation({
              id: `monster-move:${combatIdRef.current}:${roundRef.current}:${enemy.id}:${runtimeNow()}`,
              path: truncateTokenMovementPath(resolved.path, hazards.finalPosition),
              finalPosition: hazards.finalPosition,
              issuedAt: runtimeNow() + 100,
            }),
          }
        }),
      },
    }
    // Monster movement is outside the player-action snapshot transaction, so the
    // coordinator intentionally uses the publishing store port for token changes.
    applyCoordinatedDnd5eCombatResult({
      application: monsterMovementApplication,
      mapId: latestMap.id,
      applyCharacter: applyAuthorityCharacterUpdate,
      applyToken: updateToken,
    })
    for (const log of hazards.logs) pushCombatLog(log, 'system')
    pushHeadlessCombatLog(
      `${enemy.label} 移动 ${resolved.distanceFeet ?? 0} 尺。`,
      'turn',
      resolved.result.events,
      [options.dash ? '移动方式：疾走' : '移动方式：正常移动'],
    )
    return true
  }

  const resolveDnd5eOpportunityAttackForMove = async (
    attackerToken: Token,
    targetToken: Token,
    opts?: { trigger?: 'movement' | 'berserker-retaliation' | 'hunter-giant-killer' },
  ): Promise<boolean> => {
    if (!activeMap) return false
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const latestCharacters = useCharacterStore.getState().characters
    const prepared = prepareDnd5eOpportunityAttack({
      combatId: combatIdRef.current || `map-${latestMap.id}`,
      round: roundRef.current,
      map: latestMap,
      characters: latestCharacters,
      initiativeOrder: initiativeOrderRef.current,
      actorTokenId: attackerToken.id,
      targetTokenId: targetToken.id,
      turnEconomy: currentDnd5eTurnEconomy(attackerToken.id),
      targetTurnEconomy: currentDnd5eTurnEconomy(targetToken.id),
      reactionFeature: opts?.trigger === 'berserker-retaliation'
        ? 'berserker-retaliation'
        : opts?.trigger === 'hunter-giant-killer'
          ? 'hunter-giant-killer'
          : undefined,
    })
    if (!prepared.ok) return false
    const attack = prepared.prepared
    const attackerCharacter = attackerToken.characterId
      ? latestCharacters.find((character) => character.id === attackerToken.characterId)
      : undefined
    if (attackerCharacter) {
      const accepted = await requestSharedOpportunityAttackChoice(attackerCharacter, {
        attackerTokenId: attackerToken.id,
        targetTokenId: targetToken.id,
        targetName: attack.targetName,
        trigger: opts?.trigger ?? 'movement',
      })
      if (!accepted) {
        pushCombatLog(
          opts?.trigger === 'berserker-retaliation'
            ? `${attack.actorName} 保留反应，没有对 ${attack.targetName} 发动报复。`
            : opts?.trigger === 'hunter-giant-killer'
              ? `${attack.actorName} 保留反应，没有对 ${attack.targetName} 发动巨人杀手。`
            : `${attack.actorName} 放弃对 ${attack.targetName} 的借机攻击。`,
          'turn',
        )
        return false
      }
    }
    const attackerCombatant = attack.state.combatants[attackerToken.id]
    if (!attackerCombatant) return false
    const tranquility = await rollDnd5eTranquilityWard({
      ward: attack.tranquilityWard,
      attacker: attackerCombatant,
      attackerCharacter,
      attackerName: attack.actorName,
    })
    const d20 = tranquility.passed ? await rollDiceBoxD20(`${attack.weaponName} 借机攻击`, attack.targetName) : 1
    const d20Second = tranquility.passed && attack.attackMode !== 'normal'
      ? await rollDiceBoxD20(`${attack.weaponName} 借机攻击（劣势）`, attack.targetName)
      : undefined
    const blessRoll = tranquility.passed && attack.blessed
      ? (await rollDiceBoxValues(1, 4, '祝福术·借机攻击加值', attack.actorName))[0]
      : undefined
    const baneRoll = tranquility.passed && attack.baned
      ? (await rollDiceBoxValues(1, 4, '灾祸术·借机攻击减值', attack.actorName))[0]
      : undefined
    const preview = previewDnd5eOpportunityAttack(attack, d20, d20Second, blessRoll, baneRoll)
    const inspirationDie = tranquility.roll?.bardicInspirationRoll == null
      ? dnd5eHeldBardicInspirationDie(attackerCombatant)
      : undefined
    const bardicInspirationRoll = tranquility.passed && !preview.hit && !preview.roll.naturalOne && inspirationDie &&
      preview.roll.total + inspirationDie >= attack.targetArmorClass
      ? await requestDnd5eBardicInspirationRoll({
          target: attackerCharacter,
          targetName: attack.actorName,
          dieSides: inspirationDie,
          rollType: '攻击检定',
          total: preview.roll.total,
          targetNumber: attack.targetArmorClass,
        })
      : undefined
    const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
    const hitBeforeCuttingWords = preview.critical || (!preview.roll.naturalOne && attackTotalBeforeCuttingWords >= attack.targetArmorClass)
    const cuttingWordsCandidate = tranquility.passed && hitBeforeCuttingWords && !preview.critical
      ? findDnd5eCuttingWordsCandidate(latestMap, attack.state, attackerToken, targetToken, new Set())
      : undefined
    const cuttingWords = cuttingWordsCandidate &&
      attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < attack.targetArmorClass
      ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
          attackerName: attack.actorName,
          targetName: attack.targetName,
          attackName: `${attack.weaponName}借机攻击`,
          total: attackTotalBeforeCuttingWords,
          targetNumber: attack.targetArmorClass,
        })
      : undefined
    const attackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
    const attackHitAfterCuttingWords = preview.critical || (!preview.roll.naturalOne && attackTotal >= attack.targetArmorClass)
    const strokeOfLuck = !!(
      tranquility.passed && !attackHitAfterCuttingWords && attackerCharacter && attackerCombatant &&
      dnd5eCombatantClassLevel(attackerCombatant, 'rogue') >= 20 &&
      (attackerCombatant.classResources['dnd5e-stroke-of-luck']?.current ?? 0) > 0 &&
      await requestSharedStrokeOfLuckChoice(attackerCharacter, {
        targetName: attack.targetName,
        attackName: `${attack.weaponName}借机攻击`,
        total: attackTotal,
        armorClass: attack.targetArmorClass,
      })
    )
    let attackHit = attackHitAfterCuttingWords || strokeOfLuck
    const targetCharacter = targetToken.characterId
      ? latestCharacters.find((character) => character.id === targetToken.characterId)
      : undefined
    const targetCombatant = attack.state.combatants[targetToken.id]
    const shieldSpellReaction = !!(
      attackHit && cuttingWords?.bardId !== targetToken.id && targetCharacter && targetCombatant && dnd5eCanCastShieldSpell(targetCombatant) &&
      await requestSharedShieldSpellChoice(targetCharacter, {
        attackerName: attack.actorName,
        attackName: `${attack.weaponName}借机攻击`,
        attackTotal,
        armorClass: attack.targetArmorClass,
      })
    )
    if (shieldSpellReaction && !preview.critical && !strokeOfLuck) {
      attackHit = attackTotal >= attack.targetArmorClass + 5
    }
    const standAgainstTide = !attackHit && !shieldSpellReaction && tranquility.passed
      ? await buildDnd5eStandAgainstTideUse({
          map: latestMap,
          state: attack.state,
          attackerToken,
          hunterToken: targetToken,
          attackerName: attack.actorName,
          attackName: `${attack.weaponName}借机攻击`,
          attackModifier: attack.attackModifier,
          reachFeet: attack.reachFeet,
          damage: [attack.damage],
          bardicInspirationAlreadyUsed: bardicInspirationRoll != null || tranquility.roll?.bardicInspirationRoll != null,
          excludedReactionTokenIds: new Set([
            attackerToken.id,
            ...(cuttingWords ? [cuttingWords.bardId] : []),
          ]),
        })
      : undefined
    const uncannyDodge = !!(
      attackHit && !shieldSpellReaction && targetCharacter && targetCombatant && dnd5eCanUseUncannyDodge(targetCombatant) &&
      await requestSharedUncannyDodgeChoice(targetCharacter, {
        attackerName: attack.actorName,
        attackName: `${attack.weaponName}借机攻击`,
      })
    )
    const damageRolls = attackHit
      ? await rollDiceBoxValues(
          attack.damage.count * (preview.critical ? 2 : 1),
          attack.damage.sides,
          `${attack.weaponName} 借机伤害`,
          attack.targetName,
        )
      : []
    const opportunityDamageTotal = attackHit
      ? Math.max(0, damageRolls.reduce((total, value) => total + value, 0) + attack.damage.bonus)
      : 0
    const cuttingWordsDamageCandidate = attackHit && opportunityDamageTotal > 0 && !cuttingWords
      ? findDnd5eCuttingWordsCandidate(
          latestMap,
          attack.state,
          attackerToken,
          targetToken,
          shieldSpellReaction || uncannyDodge ? new Set([targetToken.id]) : new Set(),
        )
      : undefined
    const cuttingWordsDamage = cuttingWordsDamageCandidate
      ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
          attackerName: attack.actorName,
          targetName: attack.targetName,
          attackName: `${attack.weaponName}借机攻击`,
          total: opportunityDamageTotal,
          phase: 'damage',
        })
      : undefined
    const hurlThroughHellDamageRolls = attackHit && attackerCombatant.classState.hurlThroughHellReady
      ? await rollDiceBoxValues(10, 10, '坠入地狱·返回伤害', attack.targetName)
      : undefined
    const initialResolved = resolvePreparedDnd5eOpportunityAttack({
      prepared: attack, d20, d20Second, blessRoll, baneRoll, bardicInspirationRoll, cuttingWords, cuttingWordsDamage, strokeOfLuck,
      shieldSpellReaction, uncannyDodge,
      tranquilitySave: tranquility.roll, damageRolls, hurlThroughHellDamageRolls, standAgainstTide,
    })
    if (!initialResolved.result.ok) return false
    const resolved = await settleDnd5eConcentrationChecks({
      result: initialResolved.result,
      map: attack.map,
      characters: attack.characters,
      characterIdByCombatantId: attack.characterIdByCombatantId,
      rollD20: rollDiceBoxD20,
      rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
      rollDice: rollDiceBoxValues,
      requestHellishRebuke: requestSharedHellishRebukeChoice,
      requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
      requestBardicInspiration: requestDnd5eBardicInspirationRoll,
      requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
    })
    applyDnd5eCombatApplication(resolved.application)
    for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
      event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
    ))) {
      updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
    }
    updateDnd5eTurnEconomy(
      attackerToken.id,
      (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
    )
    if (uncannyDodge) {
      updateDnd5eTurnEconomy(
        targetToken.id,
        (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
      )
    }
    if (shieldSpellReaction) {
      updateDnd5eTurnEconomy(
        targetToken.id,
        (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
      )
    }
    if (cuttingWords && cuttingWordsCandidate) {
      updateDnd5eTurnEconomy(
        cuttingWordsCandidate.token.id,
        (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
      )
    }
    if (cuttingWordsDamage && cuttingWordsDamageCandidate) {
      updateDnd5eTurnEconomy(
        cuttingWordsDamageCandidate.token.id,
        (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
      )
    }
    if (!opts?.trigger) {
      await resolveDnd5eBerserkerRetaliations(resolved.result, latestMap.id)
    }
    if (opts?.trigger !== 'hunter-giant-killer') {
      await resolveDnd5eHunterGiantKiller(resolved.result, latestMap.id)
    }
    const reactionAttackLabel = opts?.trigger === 'berserker-retaliation'
      ? '发动报复攻击'
      : opts?.trigger === 'hunter-giant-killer'
        ? '发动巨人杀手攻击'
        : '借机攻击'
    const damage = resolved.result.events.find((event) => event.type === 'damage-applied')
    pushHeadlessCombatLog(
      !tranquility.passed
        ? `${attack.actorName} 使用反应，试图以${attack.weaponName}${reactionAttackLabel} ${attack.targetName}，但未通过宁静心境的感知豁免，本次攻击落空。`
        : attackHit
        ? `${attack.actorName} 使用反应，以${attack.weaponName}${reactionAttackLabel} ${attack.targetName} 并造成 ${damage?.type === 'damage-applied' ? damage.amount : 0} 点伤害。`
        : `${attack.actorName} 使用反应，以${attack.weaponName}${reactionAttackLabel} ${attack.targetName}，但未命中（${d20}${attack.attackModifier >= 0 ? '+' : ''}${attack.attackModifier}${bardicInspirationRoll ? `+${bardicInspirationRoll}（吟游激励）` : ''}${cuttingWords ? `-${cuttingWords.roll}（尖刻言辞）` : ''} vs AC ${attack.targetArmorClass}）。`,
      attackHit ? 'damage' : 'attack',
      resolved.result.events,
      [`武器：${attack.weaponName}｜触及 ${attack.reachFeet} 尺｜反应已消耗`],
    )
    return true
  }

  const resolveDnd5eOpportunityAttacksForMove = async (
    movingToken: Token,
    to: { x: number; y: number },
  ): Promise<void> => {
    if (!activeMap) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const latestCharacters = useCharacterStore.getState().characters
    const attackers = findDnd5eOpportunityAttackersForMove({
      map: latestMap,
      characters: latestCharacters,
      movingToken,
      to,
      turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
    })
    for (const attacker of attackers) {
      const currentMap = useMapStore.getState().maps.find((map) => map.id === latestMap.id) ?? latestMap
      const currentMover = currentMap.tokens.find((token) => token.id === movingToken.id) ?? movingToken
      if (!isTokenAlive(currentMover, useCharacterStore.getState().characters)) break
      await resolveDnd5eOpportunityAttackForMove(attacker, currentMover)
    }
  }

  const resolveDnd5eBerserkerRetaliations = async (
    result: Dnd5eActionResult,
    mapId: string,
  ): Promise<void> => {
    if (!result.ok) return
    const retaliated = new Set<string>()
    for (const event of result.events) {
      if (
        event.type !== 'damage-applied' || event.amount <= 0 || !event.sourceId ||
        event.sourceId === event.targetId || retaliated.has(event.targetId)
      ) continue
      const damaged = result.state.combatants[event.targetId]
      if (
        !damaged || damaged.currentHp <= 0 || damaged.classId !== 'barbarian' ||
        damaged.subclassId !== 'berserker' || damaged.level < 14 ||
        currentDnd5eTurnEconomy(event.targetId).reaction.current < 1
      ) continue
      const latestMap = useMapStore.getState().maps.find((map) => map.id === mapId)
      if (!latestMap) continue
      const attackerToken = latestMap.tokens.find((token) => token.id === event.targetId)
      const sourceToken = latestMap.tokens.find((token) => token.id === event.sourceId)
      if (!attackerToken?.characterId || !sourceToken) continue
      retaliated.add(event.targetId)
      await resolveDnd5eOpportunityAttackForMove(attackerToken, sourceToken, {
        trigger: 'berserker-retaliation',
      })
    }
  }

  const resolveDnd5eHunterGiantKiller = async (
    result: Dnd5eActionResult,
    mapId: string,
  ): Promise<void> => {
    if (!result.ok) return
    const offered = new Set<string>()
    for (const event of result.events) {
      if (event.type !== 'attack-resolved' || offered.has(event.targetId)) continue
      const hunter = result.state.combatants[event.targetId]
      const attacker = result.state.combatants[event.actorId]
      const attackerSize = attacker?.statBlockId ? getDnd5eSrdMonster(attacker.statBlockId)?.size : undefined
      if (
        !hunter || !attacker || hunter.currentHp <= 0 || hunter.classId !== 'ranger' ||
        hunter.subclassId !== 'hunter' || hunter.level < 3 ||
        !hunter.classSelections['hunters-prey']?.includes('giant-killer') ||
        !attackerSize || !['大型', '超大型', '巨型'].includes(attackerSize) ||
        currentDnd5eTurnEconomy(event.targetId).reaction.current < 1
      ) continue
      const latestMap = useMapStore.getState().maps.find((map) => map.id === mapId)
      if (!latestMap) continue
      const hunterToken = latestMap.tokens.find((token) => token.id === event.targetId)
      const attackerToken = latestMap.tokens.find((token) => token.id === event.actorId)
      if (!hunterToken?.characterId || !attackerToken) continue
      offered.add(event.targetId)
      await resolveDnd5eOpportunityAttackForMove(hunterToken, attackerToken, {
        trigger: 'hunter-giant-killer',
      })
    }
  }

  const handleMoveSelect = async (point: { x: number; y: number }) => {
    if (!activeMap || dnd5eSpellTargeting?.area) return
    if (!isDM && (!combatActive || playerCombatLocked)) return

    if (!myPlayerToken || !turnCharacter || !showMoveRange || !moveCircle) return
    if (isMovementLocked(turnCharacter.conditions)) {
      void showCombatNotice('无法移动', '该角色本回合无法移动。', 'amber') // no-move OR restrained
      return
    }
    const remainingMovementFeet = currentDnd5eTurnEconomy(myPlayerToken.id).movement.current
    const pos = snapTokenToGridCenter(point.x, point.y, myPlayerToken, activeMap)
    const requestedElevationFeet = Math.max(-1_000, Math.min(10_000, Math.floor(dnd5eTargetElevationFeet)))
    const targetElevationFeet = dnd5eTraversalMode === 'walk' || dnd5eTraversalMode === 'swim'
      ? mapGeometryTerrainElevationAtPoint(activeGeometry, pos)
      : requestedElevationFeet
    const path = findMapGeometryPath({
      map: activeMap,
      geometry: activeGeometry,
      token: myPlayerToken,
      to: pos,
      canClimb: dnd5eTraversalMode === 'climb' || dnd5eTraversalMode === 'fly',
      canSwim: dnd5eTraversalMode === 'swim',
      canFly: dnd5eTraversalMode === 'fly',
      targetElevationFeet,
      maximumTerrainStepFeet: dnd5eTraversalMode === 'fall' ? 10_000 : 10,
      additionalDifficultTerrainMultiplier: (token, position) =>
        dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: activeMap, token, position }),
      additionalSpeedCostMultiplier: (token, position) =>
        dnd5ePersistentAreaSpeedCostMultiplierAt({ map: activeMap, token, position }),
    })
    if (!path) {
      void showCombatNotice('路径受阻', '目标格无法通过合法路径抵达；墙、关闭的门、障碍物、其他 Token，或超过 10 尺的地形落差可能阻挡了路线。', 'amber')
      return
    }
    const isProne = turnCharacter.conditions.some((condition) =>
      ['prone', '倒地'].includes(condition.toLowerCase()),
    )
    const standFromProne = isProne && dnd5eStandFromProne
    const traversal = dnd5eTraversalMovementCost({
      distanceFeet: path.distanceFeet,
      baseMovementCostFeet: path.movementCostFeet,
      elevationGainFeet: Math.max(0, targetElevationFeet - (myPlayerToken.elevationFeet ?? 0)),
      mode: dnd5eTraversalMode,
      profile: {
        strengthScore: turnCharacter.abilities.str,
        strengthModifier: Math.floor((turnCharacter.abilities.str - 10) / 2),
        walkSpeed: dnd5eEffectiveWalkingSpeed(turnCharacter),
        climbWithoutSpeedCostMultiplier: dnd5eClimbingMovementCost(turnCharacter, 1),
        climbSpeed: turnCharacter.dnd5eMovementSpeeds?.climb,
        swimSpeed: turnCharacter.dnd5eMovementSpeeds?.swim,
        flySpeed: turnCharacter.dnd5eMovementSpeeds?.fly,
        runningLongJumpBonusFeet: dnd5eRunningJumpBonusFeet(turnCharacter),
      },
    })
    if (!traversal.ok) {
      void showCombatNotice('跳跃距离不足', traversal.reason === 'jump-too-high' ? '当前力量不足以跳到该高度。' : '当前力量不足以完成这段跳跃。', 'amber')
      return
    }
    const movementCostFeet = traversal.movementCostFeet +
      (dnd5eCarefulMovement ? path.distanceFeet : 0) +
      (isProne && !standFromProne ? path.distanceFeet : 0) +
      (standFromProne ? Math.floor(dnd5eEffectiveWalkingSpeed(turnCharacter) / 2) : 0)
    if (movementCostFeet > remainingMovementFeet) {
      void showCombatNotice(
        '移动距离不足',
        `该合法路径需要 ${movementCostFeet} 尺移动，本回合只剩 ${remainingMovementFeet} 尺。请缩短路线或先处理阻挡。`,
        'amber',
      )
      return
    }
    const movedFeet = path.distanceFeet
    if (!isDM) {
      if (!sendPlayerMoveRequest(pos, movedFeet, movementCostFeet)) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '无法移动',
          pendingPlayerActionRef.current
            ? '正在等待 DM 确认上一动作。'
            : '本回合剩余移动尺数不足。',
          'amber',
        )
      }
      setShowMoveRange(false)
      setDnd5eCarefulMovement(false)
      setDnd5eStandFromProne(true)
      return
    }
    if (!submitDmLocalPlayerAction(createDmLocalPlayerAction({
      type: 'move-token',
      targetPosition: pos,
      dnd5eCarefulMovement,
      dnd5eStandFromProne: standFromProne,
      dnd5eTraversalMode,
      targetElevationFeet,
    }))) {
      void showCombatNotice('无法移动', '当前移动无法提交给 DM 结算。', 'amber')
      return
    }
    setShowMoveRange(false)
    setDnd5eCarefulMovement(false)
    setDnd5eStandFromProne(true)
  }

  const handleDisengage = () => {
    if (!canControlPlayerTurn || !turnCharacter) return
    if (disengagedCharIds.has(turnCharacter.id)) return
    if (!isDM) {
      if (!sendPlayerDisengageRequest()) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '动作不可用',
          pendingPlayerActionRef.current
            ? '正在等待 DM 确认上一动作。'
            : '撤离需要消耗一个动作。',
          'amber',
        )
      }
      return
    }
    if (!submitDmLocalPlayerAction(createDmLocalPlayerAction({ type: 'disengage' }))) {
      void showCombatNotice('无法撤离', '当前撤离无法提交给 DM 结算。', 'amber')
    }
  }

  const handleAoePreviewCell = (cell: GridCell | null) => {
    if (dnd5eItemAreaTargeting && cell) {
      setAoePreviewCell(cell)
      return
    }
    if (!cell || !activeAoeTargeting || !aoeUsesMouseAim(activeAoeTargeting)) return
    setAoePreviewCell(cell)
  }

  const selectDnd5eSpellArea = (cell: GridCell) => {
    if (!dnd5eSpellTargeting?.area || !activeMap || !aoeCasterCell ||
      !canPlaceAoe(dnd5eSpellTargeting.area, aoeCasterCell, cell)) return false
    const orientFrom = aoeOrientFromCell(dnd5eSpellTargeting.area, aoeCasterCell, cell, {
      rectRotation: aoeRectRotation,
    })
    const cells = cellsForAoe(dnd5eSpellTargeting.area, orientFrom, cell)
    const actorToken = activeMap.tokens.find((token) => token.characterId === dnd5eSpellTargeting.characterId)
    const spell = getDnd5eSrdCombatSpell(dnd5eSpellTargeting.spellId)
    const effectOrigin = spell?.area?.origin === 'point'
      ? {
          x: activeMap.gridOffsetX + (cell.col + 0.5) * activeMap.gridSize,
          y: activeMap.gridOffsetY + (cell.row + 0.5) * activeMap.gridSize,
        }
      : actorToken
    const effectOriginElevation = spell?.area?.origin === 'point' ? 0 : actorToken?.elevationFeet ?? 0
    const affectedTokenIds = tokensInCells(activeMap, activeMap.tokens, cells)
      .filter((token) =>
        token.type !== 'obstacle' && (token.id !== actorToken?.id || spell?.areaIncludesSelf === true) && !!effectOrigin &&
        (!actorToken || !spell || spell.target === 'area' ||
          (spell.target === 'hostile' ? areOpposedCombatTokens(actorToken, token) : !areOpposedCombatTokens(actorToken, token))) &&
        !mapGeometryLineOfEffectBlocked({
          geometry: activeGeometry,
          from: effectOrigin,
          to: token,
          fromElevationFeet: effectOriginElevation,
          toElevationFeet: token.elevationFeet ?? 0,
        }),
      )
      .map((token) => token.id)
      .slice(0, dnd5eSpellTargeting.maximumTargets)
    setDnd5eSpellTargeting((current) => current?.area
      ? {
          ...current,
          targetTokenIds: affectedTokenIds,
          sculptedTargetIds: current.sculptedTargetIds.filter((id) => affectedTokenIds.includes(id)),
          carefulTargetIds: current.carefulTargetIds.filter((id) => affectedTokenIds.includes(id)),
          heightenedTargetId: current.heightenedTargetId && affectedTokenIds.includes(current.heightenedTargetId)
            ? current.heightenedTargetId
            : undefined,
        }
      : current)
    setAoePreviewCell(cell)
    setSelectedTokenId(affectedTokenIds[0] ?? null)
    return true
  }

  const handleAoeConfirm = (cell: GridCell) => {
    if (dnd5eCoreAreaMoveTargeting) {
      if (!aoeHighlight?.valid) return
      const payload = { areaId: dnd5eCoreAreaMoveTargeting.areaId, targetCell: cell }
      const submitted = isDM
        ? sendDmLocalDnd5ePersistentAreaMoveRequest(payload)
        : sendPlayerDnd5ePersistentAreaMoveRequest(payload)
      if (submitted) {
        setDnd5eCoreAreaMoveTargeting(null)
        setAoePreviewCell(null)
      }
      return
    }
    if (dnd5eItemAreaTargeting) {
      if (!aoeHighlight?.valid) return
      const payload: Dnd5eItemUsePayload = {
        instanceId: dnd5eItemAreaTargeting.instanceId,
        targetCell: cell,
      }
      const submitted = isDM
        ? sendDmLocalDnd5eItemUseRequest(payload)
        : sendPlayerDnd5eItemUseRequest(payload)
      if (submitted) {
        setDnd5eItemAreaTargeting(null)
        setAoePreviewCell(null)
      } else {
        void showCombatNotice('无法放置物品', '当前物品放置请求无法提交给 DM 结算。', 'amber')
      }
      return
    }
    if (dnd5ePluginAreaTargeting && activeMap && aoeCasterCell) {
      const template = dnd5ePluginAreaTargeting.targeting.template
      if (!canPlaceAoe(template, aoeCasterCell, cell)) return
      const orientFrom = aoeOrientFromCell(template, aoeCasterCell, cell, { rectRotation: aoeRectRotation })
      const cells = cellsForAoe(template, orientFrom, cell)
      const actorToken = activeMap.tokens.find((token) => token.characterId === dnd5ePluginAreaTargeting.characterId)
      if (!actorToken) return
      const targetTokenIds = tokensInCells(activeMap, activeMap.tokens, cells)
        .filter((token) => {
          if (token.type === 'obstacle') return false
          if (token.id === actorToken.id && dnd5ePluginAreaTargeting.targeting.includeSelf !== true) return false
          const opposed = areOpposedCombatTokens(actorToken, token)
          if (dnd5ePluginAreaTargeting.targeting.relation === 'ally' && opposed) return false
          if (dnd5ePluginAreaTargeting.targeting.relation === 'enemy' && !opposed) return false
          return true
        })
        .map((token) => token.id)
        .slice(0, dnd5ePluginAreaTargeting.targeting.maximumTargets ?? 64)
      const persistentArea = dnd5ePluginFeatureDefinition(
        dnd5ePluginAreaTargeting.featureId,
      )?.action?.persistentArea
      if (targetTokenIds.length < 1 && !persistentArea) {
        void showCombatNotice('范围内没有目标', '请重新放置扩展规则的范围模板。', 'amber')
        return
      }
      const target = {
        targetTokenIds,
        targetCell: cell,
        targetOrientation: aoeRectRotation as 0 | 1 | 2 | 3,
      }
      const submitted = isDM
        ? sendDmLocalDnd5ePluginActionRequest({ featureId: dnd5ePluginAreaTargeting.featureId }, undefined, target)
        : sendPlayerDnd5ePluginActionRequest({ featureId: dnd5ePluginAreaTargeting.featureId }, undefined, target)
      if (submitted) {
        setDnd5ePluginAreaTargeting(null)
        setAoePreviewCell(null)
      }
      return
    }
    if (!activeAoeTargeting || !aoeCasterCell) return
    if (dnd5eSpellTargeting?.area) {
      selectDnd5eSpellArea(cell)
      return
    }
  }

  const handleSelectToken = (tokenId: string | null) => {
    if (tokenId && dnd5eItemCreatureTargeting && activeMap) {
      const actorToken = activeMap.tokens.find((token) => token.characterId === dnd5eItemCreatureTargeting.characterId)
      const targetToken = activeMap.tokens.find((token) => token.id === tokenId)
      const distanceFeet = actorToken && targetToken
        ? tokenFootprintDistanceCells(actorToken, targetToken, activeMap) * Math.max(1, activeMap.feetPerCell ?? 5)
        : Number.POSITIVE_INFINITY
      if (
        !actorToken || !targetToken || targetToken.type === 'obstacle' ||
        (!dnd5eItemCreatureTargeting.targeting.includeSelf && actorToken.id === targetToken.id) ||
        distanceFeet > dnd5eItemCreatureTargeting.targeting.rangeFeet
      ) {
        void showCombatNotice('目标无效', `请选择 ${dnd5eItemCreatureTargeting.targeting.rangeFeet} 尺内的生物。`, 'amber')
        return
      }
      const payload: Dnd5eItemUsePayload = {
        instanceId: dnd5eItemCreatureTargeting.instanceId,
        targetTokenId: targetToken.id,
      }
      const submitted = isDM
        ? sendDmLocalDnd5eItemUseRequest(payload)
        : sendPlayerDnd5eItemUseRequest(payload)
      if (submitted) setDnd5eItemCreatureTargeting(null)
      return
    }
    if (!tokenId) {
      setSelectedTokenId(null)
      setSelectedCharacterTokenId(null)
      return
    }
    if (playerCombatLocked) return

    if (dnd5eSpellTargeting?.area && activeMap && aoeCasterCell) {
      const clickedToken = activeMap.tokens.find((token) => token.id === tokenId)
      const clickedCell = clickedToken ? pixelToCell(clickedToken.x, clickedToken.y, activeMap) : null
      if (clickedCell && canPlaceAoe(dnd5eSpellTargeting.area, aoeCasterCell, clickedCell)) {
        selectDnd5eSpellArea(clickedCell)
      }
      return
    }

    if (dnd5eSpellTargeting && activeMap) {
      const targetToken = activeMap.tokens.find((token) => token.id === tokenId)
      const actorToken = activeMap.tokens.find((token) => token.characterId === dnd5eSpellTargeting.characterId)
      if (!targetToken || !actorToken) return
      if (dnd5eSpellTargeting.maximumTargets > 1) {
        setDnd5eSpellTargeting((current) => {
          if (!current) return null
          if (current.heightenedSelecting) {
            if (!current.targetTokenIds.includes(targetToken.id)) return current
            return {
              ...current,
              heightenedTargetId: current.heightenedTargetId === targetToken.id ? undefined : targetToken.id,
            }
          }
          if (current.carefulSelecting) {
            if (targetToken.id === actorToken.id || !current.targetTokenIds.includes(targetToken.id)) return current
            const alreadyCareful = current.carefulTargetIds.includes(targetToken.id)
            const carefulTargetIds = alreadyCareful
              ? current.carefulTargetIds.filter((id) => id !== targetToken.id)
              : current.carefulTargetIds.length < current.maximumCarefulTargets
                ? [...current.carefulTargetIds, targetToken.id]
                : current.carefulTargetIds
            return { ...current, carefulTargetIds }
          }
          if (current.sculpting) {
            if (targetToken.id === actorToken.id || !current.targetTokenIds.includes(targetToken.id)) return current
            const alreadySculpted = current.sculptedTargetIds.includes(targetToken.id)
            const sculptedTargetIds = alreadySculpted
              ? current.sculptedTargetIds.filter((id) => id !== targetToken.id)
              : current.sculptedTargetIds.length < current.maximumSculptedTargets
                ? [...current.sculptedTargetIds, targetToken.id]
                : current.sculptedTargetIds
            return { ...current, sculptedTargetIds }
          }
          if (current.allowDuplicateTargets) {
            return current.targetTokenIds.length < current.maximumTargets
              ? { ...current, targetTokenIds: [...current.targetTokenIds, targetToken.id] }
              : current
          }
          const alreadySelected = current.targetTokenIds.includes(targetToken.id)
          const targetTokenIds = alreadySelected
            ? current.targetTokenIds.filter((id) => id !== targetToken.id)
            : current.targetTokenIds.length < current.maximumTargets
              ? [...current.targetTokenIds, targetToken.id]
              : current.targetTokenIds
          return {
            ...current,
            targetTokenIds,
            sculptedTargetIds: current.sculptedTargetIds.filter((id) => targetTokenIds.includes(id)),
            carefulTargetIds: current.carefulTargetIds.filter((id) => targetTokenIds.includes(id)),
            heightenedTargetId: current.heightenedTargetId && targetTokenIds.includes(current.heightenedTargetId)
              ? current.heightenedTargetId
              : undefined,
          }
        })
        setSelectedTokenId(targetToken.id)
        return
      }
      const payload: Dnd5eSpellCastPayload = {
        spellId: dnd5eSpellTargeting.spellId,
        castingClassId: dnd5eSpellTargeting.castingClassId,
        slotLevel: dnd5eSpellTargeting.slotLevel,
        targetTokenId: targetToken.id,
        conditionChoice: dnd5eSpellTargeting.conditionChoice,
        effectDamageType: dnd5eSpellTargeting.effectDamageType,
        higherSlotDamageType: dnd5eSpellTargeting.higherSlotDamageType,
        overchannel: dnd5eSpellTargeting.overchannel || undefined,
        empowered: dnd5eSpellTargeting.empowered || undefined,
        draconicResistance: dnd5eSpellTargeting.draconicResistance || undefined,
        repellingBlast: dnd5eSpellTargeting.repellingBlast || undefined,
        sculptedTargetIds: dnd5eSpellTargeting.sculptedTargetIds.length > 0
          ? dnd5eSpellTargeting.sculptedTargetIds
          : undefined,
        metamagic: dnd5eSpellTargeting.metamagic
          ? {
              ...dnd5eSpellTargeting.metamagic,
              carefulTargetIds: dnd5eSpellTargeting.metamagic.kind === 'careful'
                ? [targetToken.id]
                : undefined,
              heightenedTargetId: dnd5eSpellTargeting.metamagic.kind === 'heightened'
                ? targetToken.id
                : undefined,
            }
          : undefined,
      }
      const sent = isDM
        ? sendDmLocalDnd5eSpellCastRequest(payload)
        : sendPlayerDnd5eSpellCastRequest(payload)
      if (sent) setDnd5eSpellTargeting(null)
      return
    }

    if (dnd5eWeaponTargeting && activeMap) {
      const targetToken = activeMap.tokens.find((token) => token.id === tokenId)
      const actorToken = activeMap.tokens.find((token) => token.characterId === dnd5eWeaponTargeting)
      if (!targetToken || !actorToken || targetToken.id === actorToken.id) return
      const actorCharacter = characters.find((character) => character.id === dnd5eWeaponTargeting)
      const profile = actorCharacter && dnd5eWeaponAttackOptions?.wildShapeActionIndex == null &&
        dnd5eWeaponAttackOptions?.hunterMultiattack == null
        ? dnd5eWeaponAttackOptions?.offHandAttack
          ? dnd5eOffHandWeaponAttackProfile(actorCharacter)
          : dnd5eWeaponAttackProfile(actorCharacter)
        : undefined
      if (profile && actorCharacter) {
        const distanceFeet = tokenFootprintDistanceCells(actorToken, targetToken, activeMap) *
          Math.max(1, activeMap.feetPerCell ?? 5)
        const maximumRangeFeet = dnd5eWeaponRangeFeet(profile)
        if (distanceFeet > maximumRangeFeet) {
          void showCombatNotice(
            '距离不足',
            profile.mode === 'melee'
              ? `${profile.weaponName}的触及距离为 ${maximumRangeFeet} 尺，当前目标距离为 ${distanceFeet} 尺。请先移动到目标附近再进行近战攻击。`
              : `${profile.weaponName}的最远射程为 ${maximumRangeFeet} 尺，当前目标距离为 ${distanceFeet} 尺。`,
            'amber',
          )
          return
        }
        const snapshot = createDnd5eMapCombatSnapshot({
          combatId: combatIdRef.current || `map-${activeMap.id}`,
          round: roundRef.current,
          turnSlotId: initiativeOrderRef.current[initiativeIndexRef.current]?.slotId,
          map: activeMap,
          characters,
          initiativeOrder: initiativeOrderRef.current,
        })
        if (snapshot.state.combatants[actorToken.id] && snapshot.state.combatants[targetToken.id]) {
          const automaticCover = dnd5eAttackCoverForPair(snapshot.state, actorToken.id, targetToken.id)
          const automaticArmorClass = dnd5eTargetArmorClassForAttack(
            snapshot.state,
            actorToken.id,
            targetToken.id,
          )
          const coverGeometry = mapGeometryCoverBetween(activeGeometry, actorToken, targetToken, activeMap)
          const sourceId = coverGeometry.sourceEntityId
          const sourceLabel = sourceId?.startsWith(MAP_GEOMETRY_CREATURE_COVER_PREFIX)
            ? activeMap.tokens.find((token) => token.id === sourceId.slice(MAP_GEOMETRY_CREATURE_COVER_PREFIX.length))?.label
            : sourceId
              ? [
                  ...(activeGeometry?.walls ?? []),
                  ...(activeGeometry?.doors ?? []),
                  ...(activeGeometry?.windows ?? []),
                  ...(activeGeometry?.obstacles ?? []),
                ].find((entity) => entity.id === sourceId)?.label
              : undefined
          applyDnd5eAttackCoverOverride(snapshot.state, actorToken.id, targetToken.id, 'none')
          const baseArmorClass = dnd5eTargetArmorClassForAttack(snapshot.state, actorToken.id, targetToken.id)
          setDnd5eWeaponAttackConfirmation({
            actorCharacterId: actorCharacter.id,
            actorTokenId: actorToken.id,
            actorName: actorCharacter.name,
            targetTokenId: targetToken.id,
            targetName: targetToken.label,
            weaponName: profile.weaponName,
            options: dnd5eWeaponAttackOptions ? { ...dnd5eWeaponAttackOptions } : undefined,
            automaticCover: automaticCover.cover,
            automaticArmorClass,
            baseArmorClass,
            sourceLabel,
            selectedCover: 'auto',
          })
          setDnd5eWeaponTargeting(null)
          setDnd5eWeaponAttackOptions(undefined)
          return
        }
      }
      const sent = isDM
        ? sendDmLocalDnd5eWeaponAttackRequest(targetToken, dnd5eWeaponAttackOptions)
        : sendPlayerDnd5eWeaponAttackRequest(targetToken, dnd5eWeaponAttackOptions)
      if (sent) {
        setDnd5eWeaponTargeting(null)
        setDnd5eWeaponAttackOptions(undefined)
      }
      return
    }

    if (canControlPlayerTurn && tokenId === myPlayerToken?.id) {
      if (isDM) setActiveCharId(turnCharacter!.id)
      setShowMoveRange((v) => !v)
      setDnd5eStandFromProne(true)
      setDnd5eTraversalMode('walk')
      setDnd5eTargetElevationFeet(myPlayerToken.elevationFeet ?? 0)
      setSelectedTokenId(isDM ? tokenId : null)
      if (!isDM) setSelectedCharacterTokenId(null)
      return
    }
    const tok = activeMap?.tokens.find((t) => t.id === tokenId)
    if (!isDM && tok?.type === 'player' && tok.characterId === playerChar?.id) {
      setSelectedTokenId(null)
      setSelectedCharacterTokenId(null)
      return
    }
    if (tok?.characterId) {
      setActiveCharId(tok.characterId)
      setSelectedCharacterTokenId(tokenId)
    }
    if (tok?.type === 'enemy') {
      setSelectedTokenId(tokenId)
    }
    if (!isDM && tok?.type === 'enemy' && tok.showDetailOnToken !== false) {
      setEnemyDetailOpen(true)
    }
  }

  const openEnemyPool = (mode: 'add' | 'apply') => {
    setEnemyPoolMode(mode)
    setEnemyPoolOpen(true)
  }

  const handleEnemyPoolPick = (template: EnemyTemplate) => {
    if (!activeMap) return
    const patch = enemyTemplateToTokenPatch(template)
    if (enemyPoolMode === 'add') {
      const id = addEnemyFromPool(activeMap.id, template)
      if (id) setSelectedTokenId(id)
      return
    }
    if (selectedToken?.type === 'enemy') {
      updateToken(activeMap.id, selectedToken.id, patch)
    }
  }

  const handleRedetectGrid = async () => {
    if (!activeMap || gridDetecting) return
    setGridDetecting(true)
    try {
      const blob = await getImage(activeMap.id)
      if (!blob) return
      const result = await detectGridFromBlob(blob)
      updateMap(activeMap.id, applyGridDetectPatch(result))
    } finally {
      setGridDetecting(false)
    }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      void (async () => {
        const gridDetect = await detectImageGrid(img)
        await addMap({
          name: file.name.replace(/\.[^.]+$/, ''),
          width: img.naturalWidth,
          height: img.naturalHeight,
          blob: file,
          gridDetect,
        })
        URL.revokeObjectURL(objectUrl)
        setSelectedTokenId(null)
      })()
    }
    img.src = objectUrl
    e.target.value = ''
  }

  const removeDnd5eItemArea = (areaId: string, recover = false) => {
    if (!isDM || !activeMap) return
    const area = activeMap.dnd5eItemAreas?.find((candidate) => candidate.id === areaId)
    if (!area) return
    if (recover && area.kind === 'hunting-trap' && area.sourceCharacterId) {
      const granted = applyDnd5eInventoryMutation(
        useCharacterStore.getState().characters,
        {
          type: 'grant',
          characterId: area.sourceCharacterId,
          templateId: area.sourceItemTemplateId,
          quantity: 1,
        },
      )
      const source = granted.characters.find((character) => character.id === area.sourceCharacterId)
      if (granted.ok && source) updateChar(source.id, source)
    }
    updateMap(activeMap.id, {
      dnd5eItemAreas: (activeMap.dnd5eItemAreas ?? []).filter((candidate) => candidate.id !== areaId),
    })
  }

  const ensureInitiativeVisible = (index: number, scroll: number) => {
    if (index < scroll) return index
    if (index >= scroll + INITIATIVE_VISIBLE_MAX) return Math.max(0, index - INITIATIVE_VISIBLE_MAX + 1)
    return scroll
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setInitiativeScroll((s) => ensureInitiativeVisible(initiativeIndex, s))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initiativeIndex, initiativeOrder.length])

  const clearEnemyTurnTimers = () => {
    enemyTurnTimersRef.current.clear(window.clearTimeout)
  }

  // Previously enemy-turn timers were only cleared in startCombat/endCombat,
  // so switching maps mid-enemy-turn left old timers firing against the new map's
  // initiativeOrderRef (cross-map pollution), and unmount leaked them. This cleanup
  // clears the pending timer chain whenever the active map changes or the page unmounts.
  useEffect(() => {
    return () => clearEnemyTurnTimers()
  }, [activeMap?.id])

  const clearCombatMessageQueues = async (
    mapId: string,
    options: { clearCombatLog?: boolean; combatId?: string } = {},
  ) => {
    seenSharedDiceIdsRef.current.clear()
    seenRollRequestIdsRef.current.clear()
    seenPlayerActionIdsRef.current.clear()
    processedPlayerActionIdsRef.current.clear()
    seenPlayerActionAckIdsRef.current.clear()
    clearSharedInterruptLocalState()
    setPendingPlayerActionLocked(null)
    setRollRequestPreview(null)
    setDiceBoxD20(null)
    setDiceBoxRoll(null)
    setRoll(null)
    afterRollRef.current = null

    const updatedAt = runtimeNow()
    const queueCombatId = options.combatId ?? combatIdRef.current
    await clearSharedEventBacklog()
    const reset = buildCombatMessageQueueReset({
      mapId,
      combatId: queueCombatId,
      updatedAt,
      clearCombatLog: options.clearCombatLog,
    })
    const writes: Promise<void>[] = [
      clearSharedResource('dice'),
      saveSharedResource<SharedCombatInterruptQueueState>(
        COMBAT_INTERRUPT_RESOURCE,
        reset.interruptQueue,
      ),
      saveSharedResource<SharedDiceEventsState>('dice-events', reset.diceEvents),
      saveSharedResource<SharedPlayerActionState>('player-action', reset.playerAction),
      saveSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests', reset.playerActionRequests),
      saveSharedResource<SharedPlayerActionProcessedState>('player-action-processed', reset.playerActionProcessed),
      saveSharedResource<SharedPlayerActionAckState>('player-action-ack', reset.playerActionAck),
    ]
    if (reset.combatLog) {
      writes.push(saveSharedResource<SharedCombatLogState>('combat-log', reset.combatLog))
    }
    await Promise.all(writes)
  }

  const startCombat = async (surprisedTokenIds: readonly string[] = []) => {
    if (!activeMap) return
    setShowSurpriseSetup(false)
    const surprisedSet = new Set(surprisedTokenIds)
    const nextCombatId = runtimeId(`${activeMap.id}:combat`)
    locallyEndedCombatIdRef.current = ''
    combatOutcomeNoticeCombatIdRef.current = ''
    combatEndingRef.current = false
    setCombatEnding(false)
    setCombatExperienceDraft(null)
    setCombatExperienceBusy(false)
    combatIdRef.current = nextCombatId
    setCombatId(nextCombatId)
    startCombatStatistics(nextCombatId, activeMap.id)
    clearEnemyTurnTimers()
    setCombatLog([])
    setCombatLogOpen(true)
    setPlayerCombatEndedLocked(false)
    await clearCombatMessageQueues(activeMap.id, { clearCombatLog: true, combatId: nextCombatId })
    enemyAppliedKeysRef.current.clear()
    dnd5eAttackUsageRef.current.clear()
    dnd5eActionSurgeTurnKeysRef.current.clear()
    dnd5eTurnEconomyByTokenRef.current = {}
    setDnd5eTurnEconomyByToken({})
    nonActorSkippedKeysRef.current.clear()
    incapacitatedSkippedKeysRef.current.clear()
    multiStrikeHitsRef.current = {}
    setDisengagedCharIds(new Set())
    clearPlayerCombatUI()
    let recoveredCharacters = useCharacterStore.getState().characters.map(applyDnd5eInitiativeResourceFeatures)
    recoveredCharacters = recoveredCharacters.map((character) => {
      const token = activeMap.tokens.find((candidate) => candidate.characterId === character.id)
      if (!token || (token.type !== 'player' && token.type !== 'enemy')) return character
      return {
        ...character,
        dnd5eCombatState: {
          ...character.dnd5eCombatState,
          surprisedCombatId: surprisedSet.has(token.id) ? nextCombatId : undefined,
          surpriseResolvedCombatId: undefined,
        },
      }
    })
    for (const recovered of recoveredCharacters) {
      const current = useCharacterStore.getState().characters.find((character) => character.id === recovered.id)
      if (current && current !== recovered) applyAuthorityCharacterUpdate(recovered.id, recovered)
    }
    const order = buildInitiativeOrder(activeMap.tokens, recoveredCharacters)
    const shouldClearStatuses =
      isDM && window.confirm('开始战斗前是否清除当前地图所有参战单位的状态？')
    setInitiativeScroll(0)
    if (shouldClearStatuses) {
      recoveredCharacters = recoveredCharacters.map((character) => ({
        ...character,
        conditions: [],
        concentrating: false,
        dnd5eCombatState: character.dnd5eCombatState
          ? {
              ...character.dnd5eCombatState,
              activeEffects: [],
              concentrationSpellId: undefined,
              concentrationTargetIds: undefined,
              concentrationRoundsRemaining: undefined,
              concentrationEffectsBySource: undefined,
            }
          : undefined,
      }))
      for (const recovered of recoveredCharacters) applyAuthorityCharacterUpdate(recovered.id, recovered)
    }
    const storedMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const statusPreparedMap = shouldClearStatuses
      ? {
          ...storedMap,
          tokens: storedMap.tokens.map((token) => token.dnd5eCombatState
            ? {
                ...token,
                dnd5eCombatState: {
                  ...token.dnd5eCombatState,
                  activeEffects: [],
                  conditions: undefined,
                  concentrationSpellId: undefined,
                  concentrationTargetIds: undefined,
                  concentrationRoundsRemaining: undefined,
                  concentrationEffectsBySource: undefined,
                },
              }
            : token),
        }
      : storedMap
    const latestMap = {
      ...statusPreparedMap,
      tokens: statusPreparedMap.tokens.map((token) => {
        if (token.characterId || (token.type !== 'player' && token.type !== 'enemy')) return token
        return {
          ...token,
          dnd5eCombatState: {
            ...token.dnd5eCombatState,
            surprisedCombatId: surprisedSet.has(token.id) ? nextCombatId : undefined,
            surpriseResolvedCombatId: undefined,
          },
        }
      }),
    }
    for (const token of latestMap.tokens) {
      const previous = storedMap.tokens.find((candidate) => candidate.id === token.id)
      if (JSON.stringify(previous) !== JSON.stringify(token)) applyAuthorityTokenUpdate(latestMap.id, token.id, token)
    }
    const started = createDnd5eMapCombatSnapshot({
      combatId: nextCombatId,
      round: 1,
      map: latestMap,
      characters: recoveredCharacters,
      initiativeOrder: order,
    })
    combatActiveRef.current = true
    roundRef.current = started.state.round
    initiativeIndexRef.current = started.state.initiativeIndex
    initiativeOrderRef.current = order
    setCombatActive(true)
    setRound(started.state.round)
    setInitiativeIndex(started.state.initiativeIndex)
    setInitiativeOrder(order)
    const firstTokenId = order[started.state.initiativeIndex]?.tokenId
    if (firstTokenId) updateDnd5eTurnEconomy(firstTokenId, () => createDnd5eTurnEconomyCounts(`${started.state.round}:${firstTokenId}`), started.state.round)
    void publishCombatState({
      active: true,
      round: started.state.round,
      initiativeIndex: started.state.initiativeIndex,
      initiativeOrder: order,
    })
    const combatantCount = new Set(order.map((entry) => entry.tokenId)).size
    const extraTurnCount = order.filter((entry) => entry.turnKind === 'thief-reflexes').length
    pushCombatLog(
      `战斗开始：${combatantCount} 名单位加入先攻${surprisedSet.size > 0 ? `；${surprisedSet.size} 名单位受突袭` : ''}${extraTurnCount > 0 ? `；盗贼反射生成 ${extraTurnCount} 个首轮额外回合` : ''}`,
      'system',
      1,
    )
  }

  const endCombat = async () => {
    if (combatEndingRef.current || !combatActiveRef.current) return
    const endingCombatId = combatIdRef.current
    const latestEndingMap = activeMap
      ? useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
      : undefined
    const endingExperienceDraft = isDM && latestEndingMap
      ? createCombatExperienceDraft({
          combatId: endingCombatId,
          map: latestEndingMap,
          characters: useCharacterStore.getState().characters,
          initiativeTokenIds: initiativeOrderRef.current.map((entry) => entry.tokenId),
        })
      : undefined
    combatEndingRef.current = true
    orderedCombatPublishRef.current = true
    setCombatEnding(true)
    locallyEndedCombatIdRef.current = combatIdRef.current
    combatActiveRef.current = false
    pushCombatLog('战斗结束', 'system')
    clearEnemyTurnTimers()
    clearEnemyAiWarnings() // 战斗结束清空回退告警去重集合，防止无界增长。
    afterRollRef.current = null
    setRoll(null)
    setInitiativeScroll(0)
    enemyAppliedKeysRef.current.clear()
    dnd5eAttackUsageRef.current.clear()
    dnd5eActionSurgeTurnKeysRef.current.clear()
    dnd5eTurnEconomyByTokenRef.current = {}
    initiativeIndexRef.current = 0
    initiativeOrderRef.current = []
    nonActorSkippedKeysRef.current.clear()
    incapacitatedSkippedKeysRef.current.clear()
    multiStrikeHitsRef.current = {}
    clearPlayerCombatUI()
    try {
      await playerActionAuthorityCommitRef.current.catch(() => {})
      if (activeMap) {
        await clearCombatMessageQueues(activeMap.id, { clearCombatLog: false })
      }
      await publishCombatState({
        active: false,
        initiativeIndex: 0,
        initiativeOrder: [],
        dnd5eTurnEconomyByToken: {},
      })
    } catch (error) {
      console.error('结束战斗的共享状态提交失败，已保留本地结束状态。', error)
    } finally {
      setInitiativeIndex(0)
      setInitiativeOrder([])
      setDnd5eTurnEconomyByToken({})
      setCombatActive(false)
      orderedCombatPublishRef.current = false
      combatEndingRef.current = false
      setCombatEnding(false)
      if (endingExperienceDraft) {
        const alreadySettled = useCombatStatisticsStore.getState().sessions
          .some((session) => session.combatId === endingCombatId && !!session.experienceSettlement)
        if (!alreadySettled) setCombatExperienceDraft(endingExperienceDraft)
      }
    }
  }

  const handleEncounterBuild = (entries: Parameters<typeof addEncounterFromPool>[1]) => {
    if (!activeMap || enemyPoolMode !== 'add') return
    const ids = addEncounterFromPool(activeMap.id, entries)
    if (ids[0]) setSelectedTokenId(ids[0])
  }

  const chooseMapTabletopTool = (tool: Exclude<MapTabletopTool, 'none'>) => {
    if (!isDM) return
    setMapTabletopTool((current) => current === tool ? 'none' : tool)
    setMeasureMode(false)
    setDeleteSelectMode(false)
    setGridAdjustMode(false)
    setFogEditMode(false)
    setFogPreviewAsPlayer(false)
    setGeometryEditMode(false)
    setGeometryPreviewAsPlayer(false)
    setShowMoveRange(false)
    selectGeometryEntity(null)
  }

  const settleEndedCombatExperience = async (
    mode: CombatExperienceDistributionMode,
    awards: CombatExperienceAward[],
  ) => {
    const draft = combatExperienceDraft
    if (!isDM || !draft || combatExperienceBusy) return
    const settlement = createCombatExperienceSettlement({ draft, mode, awards })
    if (!settlement) return
    const alreadySettled = useCombatStatisticsStore.getState().sessions
      .some((session) => session.combatId === draft.combatId && !!session.experienceSettlement)
    if (alreadySettled) {
      setCombatExperienceDraft(null)
      return
    }
    setCombatExperienceBusy(true)
    try {
      if (mode !== 'none') {
        const now = settlement.settledAt
        for (const award of settlement.awards) {
          const current = useCharacterStore.getState().characters.find((character) => character.id === award.characterId)
          if (!current || current.dnd5eExperienceAwards?.some((receipt) => receipt.combatId === draft.combatId)) continue
          applyAuthorityCharacterUpdate(current.id, {
            experience: Math.min(999_999_999, Math.max(0, current.experience) + award.xp),
            dnd5eExperienceAwards: [
              ...(current.dnd5eExperienceAwards ?? []),
              { combatId: draft.combatId, mapId: draft.mapId, xp: award.xp, awardedAt: now },
            ].slice(-128),
          })
        }
        await saveCharactersSharedNow()
      }
      const accepted = settleCombatExperience(settlement)
      if (accepted) {
        pushCombatLog(
          mode === 'none'
            ? `经验结算：本场 ${draft.totalXp.toLocaleString('zh-CN')} XP 未发放`
            : `经验结算：${draft.totalXp.toLocaleString('zh-CN')} XP 已${mode === 'even' ? '平均' : '自由'}分配给 ${settlement.awards.length} 名角色`,
          'system',
          roundRef.current,
        )
      }
      setCombatExperienceDraft(null)
    } catch (error) {
      console.error('战斗经验值写入失败，已保留结算窗口供 DM 重试。', error)
    } finally {
      setCombatExperienceBusy(false)
    }
  }

  const applyDnd5eTurnAdvance = (
    state: Dnd5eHeadlessCombatState,
    previousRound: number,
    actorCharacterId?: string,
  ) => {
    roundRef.current = state.round
    initiativeIndexRef.current = state.initiativeIndex
    setRound(state.round)
    setInitiativeIndex(state.initiativeIndex)
    if (state.round > previousRound) {
      setInitiativeScroll(0)
      pushCombatLog(`进入第 ${state.round} 回合`, 'turn', state.round)
    }
    if (actorCharacterId) {
      multiStrikeHitsRef.current = clearCharacterScopedRecord(multiStrikeHitsRef.current, actorCharacterId)
      setDisengagedCharIds((previous) => removeDisengagedCharacterId(previous, actorCharacterId))
    }
    const nextTokenId = initiativeOrderRef.current[state.initiativeIndex]?.tokenId
    if (nextTokenId) {
      updateDnd5eTurnEconomy(
        nextTokenId,
        () => createDnd5eTurnEconomyCounts(`${state.round}:${nextTokenId}`),
        state.round,
      )
    }
    void publishCombatState({
      active: true,
      round: state.round,
      initiativeIndex: state.initiativeIndex,
      initiativeOrder: initiativeOrderRef.current,
    })
  }

  const currentCombatOutcome = () => {
    if (!activeMap) return { ended: false as const }
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const chars = useCharacterStore.getState().characters
    return checkCombatOutcome(latestMap.tokens, chars)
  }

  const hasCombatOutcomeNow = (): boolean => {
    if (!combatActive || !activeMap) return false
    return currentCombatOutcome().ended
  }

  const tryEndCombatIfNeeded = (): boolean => {
    if (!combatActive || !activeMap) return false
    const outcome = currentCombatOutcome()
    if (!outcome.ended) return false
    if (
      combatEndingRef.current ||
      combatOutcomeNoticeCombatIdRef.current === combatIdRef.current
    ) return true
    const outcomeCombatId = combatIdRef.current
    combatOutcomeNoticeCombatIdRef.current = outcomeCombatId
    void showCombatNotice('战斗结束', outcome.message, 'sky').finally(async () => {
      await endCombat()
      if (combatOutcomeNoticeCombatIdRef.current === outcomeCombatId) {
        combatOutcomeNoticeCombatIdRef.current = ''
      }
    })
    return true
  }

  const resolveAttackTargetCharacter = (
    token: Token | undefined,
    chars: Character[],
    hintedCharacterId?: string,
  ): Character | undefined => {
    if (hintedCharacterId) {
      const byHint = chars.find((c) => c.id === hintedCharacterId)
      if (byHint) return byHint
    }
    if (token?.characterId) {
      return chars.find((c) => c.id === token.characterId)
    }
    return undefined
  }

  const requestSharedDmAdjudication = async (
    prepared: PreparedDnd5eAdjudicatedSpell,
  ): Promise<DmAdjudicationInterruptResponse> => {
    if (!activeMap || !isDM) return { decision: 'cancelled', effects: [] }
    const id = `dm-adjudication:${prepared.action.id}`
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedDmAdjudicationRef,
      metadata: { actionId: prepared.action.id },
      loadExisting: () => loadCombatInterrupt(activeMap.id, id),
      decideExisting: (existing) => {
        if (!existing || !isCombatInterruptKind(existing, 'dm-adjudication')) return { type: 'publish' }
        if (existing.status === 'pending' || existing.status === 'waiting-for-dm') return { type: 'wait' }
        if (existing.status !== 'answered' && existing.status !== 'done') {
          return { type: 'resolve', value: { decision: 'cancelled', effects: [] } }
        }
        const response = existing.response as DmAdjudicationInterruptResponse | undefined
        return {
          type: 'resolve',
          value: response?.decision === 'approved'
            ? { ...response, effects: Array.isArray(response.effects) ? response.effects : [] }
            : { decision: 'cancelled', effects: [], ...(response?.note ? { note: response.note } : {}) },
        }
      },
      create: () => createCombatInterrupt<DmAdjudicationInterruptPayload, DmAdjudicationInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? prepared.action.id,
        mapId: activeMap.id,
        kind: 'dm-adjudication',
        actorCharId: prepared.actor.id,
        payload: {
          actionId: prepared.action.id,
          casterName: prepared.actor.name,
          spellId: prepared.spell.id,
          spellName: prepared.spell.name,
          spellLevel: prepared.spell.level,
          slotLevel: prepared.slotLevel,
          castingTime: prepared.castingTime,
          description: prepared.description,
          concentration: prepared.concentration,
          suggestedConcentrationRounds: prepared.suggestedConcentrationRounds,
        },
        // 裁定允许 DM 阅读规则并掷骰；超时只取消，不消费任何资源。
        expiresAt: runtimeNow() + 10 * 60 * 1000,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedMapInteractionAdjudication = async (
    action: SharedPlayerActionState,
    actorName: string,
    prepared: PreparedDnd5eMapInteraction,
  ): Promise<DmAdjudicationInterruptResponse> => {
    if (!activeMap || !isDM) return { decision: 'cancelled', effects: [] }
    const id = `dm-adjudication:${action.id}`
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedDmAdjudicationRef,
      metadata: { actionId: action.id },
      loadExisting: () => loadCombatInterrupt(activeMap.id, id),
      decideExisting: (existing) => {
        if (!existing || !isCombatInterruptKind(existing, 'dm-adjudication')) return { type: 'publish' }
        if (existing.status === 'pending' || existing.status === 'waiting-for-dm') return { type: 'wait' }
        if (existing.status === 'answered' || existing.status === 'done') {
          const response = existing.response as DmAdjudicationInterruptResponse | undefined
          return {
            type: 'resolve',
            value: response?.decision === 'approved'
              ? { ...response, effects: [] }
              : { decision: 'cancelled', effects: [] },
          }
        }
        return { type: 'resolve', value: { decision: 'cancelled', effects: [] } }
      },
      create: () => {
      const operationLabels = { open: '开门', close: '关门', unlock: '开锁', break: '破门', inspect: '检查暗门', search: '搜索暗门' } as const
        return createCombatInterrupt<DmAdjudicationInterruptPayload, DmAdjudicationInterruptResponse>({
        id,
        transactionId: action.id,
        mapId: activeMap.id,
        kind: 'dm-adjudication',
        actorCharId: action.characterId,
        payload: {
          contextKind: 'map-interaction',
          actionId: action.id,
          casterName: actorName,
          spellId: `map-interaction:${prepared.interactionId}`,
          spellName: `${operationLabels[prepared.operation]} · ${prepared.label}`,
          spellLevel: 0,
          slotLevel: 0,
          castingTime: 'action',
          description: prepared.automaticSuccess
            ? '该交互无需检定。DM 可批准、拒绝，或在备注中记录特殊裁定。'
            : `该交互将由 DM Host 投掷 d20，并使用角色当前的 ${prepared.checkSkill ?? prepared.checkAbility} 调整值。玩家不能提交骰值、DC 或结果。`,
          concentration: false,
          ...(!prepared.blindSearch && prepared.dc != null ? { proposedDc: prepared.dc } : {}),
          ...(!prepared.blindSearch && prepared.door ? { doorId: prepared.door.id } : {}),
          mapInteractionOperation: prepared.operation,
        },
        expiresAt: runtimeNow() + 10 * 60 * 1000,
      })
      },
      publish: publishCombatInterrupt,
    })
  }

  async function requestSharedPersistentAreaAdjudication(input: {
    prepared: PreparedDnd5ePersistentAreaTrigger
    proposedDamage: number
    proposedSaveSuccess?: boolean
    proposedConditionIds: string[]
  }): Promise<DmAdjudicationInterruptResponse> {
    if (!activeMap || !isDM) return { decision: 'cancelled', effects: [] }
    const { prepared } = input
    const id = `dm-adjudication:${prepared.candidate.transactionId}`
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedDmAdjudicationRef,
      metadata: { actionId: prepared.candidate.transactionId },
      loadExisting: () => loadCombatInterrupt(activeMap.id, id),
      decideExisting: (existing) => {
        if (!existing || !isCombatInterruptKind(existing, 'dm-adjudication')) return { type: 'publish' }
        if (existing.status === 'pending' || existing.status === 'waiting-for-dm') return { type: 'wait' }
        if (existing.status === 'answered' || existing.status === 'done') {
          const response = existing.response as DmAdjudicationInterruptResponse | undefined
          return {
            type: 'resolve',
            value: response?.decision === 'approved'
              ? { ...response, effects: Array.isArray(response.effects) ? response.effects : [] }
              : { decision: 'cancelled', effects: [] },
          }
        }
        return { type: 'resolve', value: { decision: 'cancelled', effects: [] } }
      },
      create: () => {
      const sourceName = prepared.state.combatants[prepared.candidate.area.sourceTokenId]?.name ?? '区域来源'
        return createCombatInterrupt<DmAdjudicationInterruptPayload, DmAdjudicationInterruptResponse>({
        id,
        transactionId: prepared.candidate.transactionId,
        mapId: activeMap.id,
        kind: 'dm-adjudication',
        actorCharId: prepared.candidate.area.sourceCharacterId,
        targetCharId: prepared.candidate.targetToken.characterId,
        payload: {
          contextKind: 'persistent-area-trigger',
          actionId: prepared.candidate.transactionId,
          casterName: `${sourceName} → ${prepared.targetName}`,
          spellId: prepared.candidate.area.featureId,
          spellName: `${prepared.candidate.area.label}·${prepared.candidate.trigger.label}`,
          spellLevel: 0,
          slotLevel: 0,
          castingTime: 'action',
          description: `持续区域在“${prepared.candidate.trigger.label}”触发点生成了一项 Headless 结算。DM 可以修改最终伤害、覆盖豁免结果，或删除拟施加的状态。`,
          concentration: false,
          proposedDamage: input.proposedDamage,
          proposedSaveSuccess: input.proposedSaveSuccess,
          proposedConditionIds: input.proposedConditionIds,
          targetTokenId: prepared.candidate.targetToken.id,
          triggerTiming: prepared.candidate.trigger.timing,
        },
        expiresAt: runtimeNow() + 10 * 60 * 1000,
      })
      },
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedChoiceWindow = async (input: {
    id: string
    transactionId: string
    actor: Character
    targetCharId?: string
    pluginId: string
    featureId: string
    featureName: string
    prompt: string
    audience: 'actor' | 'target' | 'dm'
    options: Array<{ id: string; label: string; description?: string }>
    defaultOptionId: string
    timeoutMs?: number
    phase?: 'before-action' | 'before-hit' | 'before-damage' | 'after-save' | 'before-condition'
    context?: Record<string, unknown>
  }): Promise<string | undefined> => {
    if (!activeMap || !isDM) return undefined
    const validOptionIds = new Set(input.options.map((option) => option.id))
    const readChoice = (response: PluginChoiceInterruptResponse | undefined) =>
      response?.optionId && validOptionIds.has(response.optionId)
        ? response.optionId
        : input.defaultOptionId
    return requestAndWaitForCombatInterrupt({
      id: input.id,
      channel: pendingSharedPluginChoiceRef,
      metadata: { actionId: input.transactionId },
      loadExisting: () => loadCombatInterrupt(activeMap.id, input.id),
      decideExisting: (existing) => {
        if (!existing || !isCombatInterruptKind(existing, 'plugin-choice')) return { type: 'publish' }
        if (existing.status === 'pending') return { type: 'wait' }
        if (existing.status === 'answered' || existing.status === 'done') {
          return { type: 'resolve', value: readChoice(existing.response) }
        }
        return { type: 'resolve', value: input.defaultOptionId }
      },
      create: () => createCombatInterrupt<PluginChoiceInterruptPayload, PluginChoiceInterruptResponse>({
        id: input.id,
        transactionId: input.transactionId,
        mapId: activeMap.id,
        kind: 'plugin-choice',
        phase: input.phase,
        actorCharId: input.actor.id,
        targetCharId: input.targetCharId,
        payload: {
          pluginId: input.pluginId,
          featureId: input.featureId,
          featureName: input.featureName,
          prompt: input.prompt,
          audience: input.audience,
          options: input.options.map((option) => ({ ...option })),
          defaultOptionId: input.defaultOptionId,
          ...input.context,
        },
        expiresAt: runtimeNow() + (input.timeoutMs ?? 30_000),
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedPluginChoice = async (
    prepared: PreparedDnd5ePluginFeatureAction,
  ): Promise<string | undefined> => {
    const declaration = prepared.feature.action?.interrupt
    if (!declaration) return undefined
    return requestSharedChoiceWindow({
      id: `plugin-choice:${prepared.action.id}`,
      transactionId: prepared.action.id,
      actor: prepared.actor,
      targetCharId: prepared.targetToken.characterId,
      pluginId: prepared.feature.ownerPluginId,
      featureId: prepared.feature.id,
      featureName: prepared.feature.name,
      prompt: declaration.prompt,
      audience: declaration.audience,
      options: declaration.options.map((option) => ({ ...option })),
      defaultOptionId: declaration.defaultOptionId,
      timeoutMs: declaration.timeoutMs,
    })
  }

  const requestSharedHellishRebukeChoice = async (input: {
    reactor: Character
    sourceName: string
    damage: number
    slotLevel: number
  }): Promise<boolean> => {
    const id = runtimeId('hellish-rebuke')
    const option = await requestSharedChoiceWindow({
      id,
      transactionId: activeInterruptTransactionIdRef.current ?? id,
      actor: input.reactor,
      pluginId: 'srd-5.1',
      featureId: 'spell:hellish-rebuke',
      featureName: '炼狱叱喝',
      prompt: `${input.sourceName} 刚刚对你造成 ${input.damage} 点伤害。是否消耗反应和 ${input.slotLevel} 环契约法术位施放炼狱叱喝？`,
      audience: 'actor',
      options: [
        { id: 'cast', label: '施放炼狱叱喝', description: '由DM端投掷目标敏捷豁免和火焰伤害。' },
        { id: 'decline', label: '保留反应' },
      ],
      defaultOptionId: 'decline',
      timeoutMs: 15_000,
    })
    return option === 'cast'
  }

  const requestSharedOpportunityAttackChoice = (
    attacker: Character,
    params: {
      attackerTokenId: string
      targetTokenId: string
      targetName: string
      trigger?: 'movement' | 'berserker-retaliation' | 'hunter-giant-killer'
    },
  ): Promise<boolean> => {
    const isRetaliation = params.trigger === 'berserker-retaliation'
    const isGiantKiller = params.trigger === 'hunter-giant-killer'
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: isRetaliation ? '报复' : isGiantKiller ? '巨人杀手' : '借机攻击',
        message: isRetaliation
          ? `${params.targetName} 在 5 尺内对 ${attacker.name} 造成了伤害。\n是否消耗反应，发动报复并进行一次近战武器攻击？`
          : isGiantKiller
            ? `${params.targetName} 在 5 尺内对 ${attacker.name} 完成了一次攻击。\n是否消耗反应，发动巨人杀手并进行一次近战武器攻击？`
            : `${attacker.name} 对 ${params.targetName} 触发借机攻击。\n是否消耗反应，进行一次近战命中判定？`,
        confirmText: isRetaliation ? '发动报复' : isGiantKiller ? '发动巨人杀手' : '攻击',
        cancelText: isRetaliation || isGiantKiller ? '保留反应' : '放过',
        tone: 'amber',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedOpportunityAttackRef,
      metadata: { attackerCharId: attacker.id },
      create: () => createCombatInterrupt<OpportunityAttackInterruptPayload, OpportunityAttackInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'opportunity-attack',
        actorCharId: attacker.id,
        payload: {
          attackerName: attacker.name,
          targetName: params.targetName,
          attackerTokenId: params.attackerTokenId,
          targetTokenId: params.targetTokenId,
          trigger: params.trigger ?? 'movement',
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const findDnd5eProtectionCandidate = (
    map: BattleMap,
    attackerToken: Token,
    targetToken: Token,
    excludedTokenIds: ReadonlySet<string> = new Set(),
  ): { character: Character; token: Token } | undefined => {
    const characterById = new Map(useCharacterStore.getState().characters.map((character) => [character.id, character]))
    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    return map.tokens
      .filter((token) =>
        token.id !== attackerToken.id && token.id !== targetToken.id && !excludedTokenIds.has(token.id) &&
        token.type === targetToken.type && !!token.characterId &&
        tokenFootprintDistanceCells(token, targetToken, map) * feetPerCell <= 5,
      )
      .map((token) => ({ token, character: characterById.get(token.characterId!) }))
      .find((candidate): candidate is { character: Character; token: Token } => {
        const character = candidate.character
        return !!character && character.currentHp > 0 &&
          character.equipment?.offHand?.dnd5e?.kind === 'shield' &&
          dnd5eSelectedFightingStyles(character).includes('protection') &&
          currentDnd5eTurnEconomy(candidate.token.id).reaction.current > 0 &&
          Object.keys(character.dnd5eCombatState?.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length === 0 &&
          !character.conditions.some((condition) => ['incapacitated', 'stunned', 'unconscious', '失能', '震慑', '昏迷'].includes(condition))
      })
  }

  const findDnd5eCuttingWordsCandidate = (
    map: BattleMap,
    state: Dnd5eHeadlessCombatState,
    attackerToken: Token,
    targetToken: Token,
    excludedTokenIds: ReadonlySet<string> = new Set(),
  ): { character: Character; token: Token; distanceFeet: number; dieSides: number } | undefined => {
    const attacker = state.combatants[attackerToken.id]
    const attackerCannotHear = attacker?.conditions.some((condition) =>
      ['deafened', '耳聋'].includes(condition.toLowerCase()),
    )
    const attackerCharmImmune = attacker?.conditionImmunities.some((condition) =>
      ['charmed', '魅惑'].includes(condition.toLowerCase()),
    )
    if (!attacker || attackerCannotHear || attackerCharmImmune) return undefined

    const characterById = new Map(useCharacterStore.getState().characters.map((character) => [character.id, character]))
    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    const candidate = map.tokens
      .filter((token) =>
        token.id !== attackerToken.id && !excludedTokenIds.has(token.id) &&
        token.type === targetToken.type && !!token.characterId,
      )
      .map((token) => ({
        token,
        character: characterById.get(token.characterId!),
        combatant: state.combatants[token.id],
        distanceFeet: tokenFootprintDistanceCells(token, attackerToken, map) * feetPerCell,
      }))
      .find((entry): entry is { character: Character; token: Token; combatant: Dnd5eCombatant; distanceFeet: number } => {
        const { character, combatant, distanceFeet } = entry
        return !!character && !!combatant && combatant.currentHp > 0 && distanceFeet <= 60 &&
          dnd5eCombatantClassLevel(combatant, 'bard') >= 3 && dnd5eCombatantHasSubclass(combatant, 'bard', 'lore') &&
          combatant.turn.reactionAvailable &&
          (combatant.classResources['dnd5e-bardic-inspiration']?.current ?? 0) > 0 &&
          !combatant.conditions.some((condition) =>
            ['incapacitated', 'stunned', 'unconscious', 'silenced', '失能', '震慑', '昏迷', '沉默'].includes(condition.toLowerCase()),
          ) && Object.keys(character.dnd5eCombatState?.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length === 0
      })

    return candidate
      ? {
          character: candidate.character,
          token: candidate.token,
          distanceFeet: candidate.distanceFeet,
          dieSides: dnd5eBardicInspirationDie(candidate.combatant.level),
        }
      : undefined
  }

  const findDnd5eAbilityCheckCuttingWordsCandidate = (
    map: BattleMap,
    state: Dnd5eHeadlessCombatState,
    actorToken: Token,
  ) => {
    const opposingToken = map.tokens.find((token) =>
      token.id !== actorToken.id && token.type !== 'obstacle' && token.type !== actorToken.type,
    )
    return opposingToken
      ? findDnd5eCuttingWordsCandidate(map, state, actorToken, opposingToken)
      : undefined
  }

  const requestSharedProtectionChoice = (
    protector: Character,
    params: { attackerName: string; targetName: string; attackName: string },
  ): Promise<boolean> => {
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '防护战斗风格',
        message: `${params.attackerName} 正以${params.attackName}攻击 ${params.targetName}。\n${protector.name} 是否消耗反应，使这次攻击检定具有劣势？`,
        confirmText: '使用防护',
        cancelText: '保留反应',
        tone: 'sky',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedProtectionRef,
      metadata: { protectorCharId: protector.id },
      create: () => createCombatInterrupt<ProtectionInterruptPayload, ProtectionInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'protection',
        actorCharId: protector.id,
        payload: {
          protectorName: protector.name,
          attackerName: params.attackerName,
          targetName: params.targetName,
          attackName: params.attackName,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedShieldSpellChoice = (
    target: Character,
    params: {
      attackerName: string
      attackName: string
      attackTotal?: number
      armorClass?: number
      magicMissile?: boolean
    },
  ): Promise<boolean> => {
    const triggerText = params.magicMissile
      ? `${params.attackerName} 的魔法飞弹指定了 ${target.name}。`
      : `${params.attackerName} 的${params.attackName}以 ${params.attackTotal ?? '—'} 命中 ${target.name}（AC ${params.armorClass ?? '—'}）。`
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '护盾术',
        message: `${triggerText}\n是否消耗反应和当前最低可用法术位施放护盾术？`,
        confirmText: '施放护盾术',
        cancelText: '保留反应',
        tone: 'sky',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedShieldSpellRef,
      metadata: { targetCharId: target.id },
      create: () => createCombatInterrupt<ShieldSpellInterruptPayload, ShieldSpellInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'shield-spell',
        targetCharId: target.id,
        payload: {
          attackerName: params.attackerName,
          targetName: target.name,
          attackName: params.attackName,
          attackTotal: params.attackTotal,
          armorClass: params.armorClass,
          magicMissile: params.magicMissile,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedCounterspellChoice = (
    reactor: Character,
    params: {
      casterName: string
      spellName: string
      spellLevel: number
      counterspellSlotLevel: number
      abilityCheckDc?: number
    },
  ): Promise<boolean> => {
    const message = `${params.casterName} 正在施放${params.spellName}（${params.spellLevel} 环）。\n${reactor.name} 是否消耗反应和 ${params.counterspellSlotLevel} 环法术位施放法术反制？` +
      (params.abilityCheckDc ? `\n需要进行 DC ${params.abilityCheckDc} 的施法属性检定。` : '\n该法术会被自动反制。')
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '法术反制', message, confirmText: '施放法术反制', cancelText: '保留反应', tone: 'violet',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id,
      channel: pendingSharedCounterspellRef,
      metadata: { actorCharId: reactor.id },
      create: () => createCombatInterrupt<CounterspellInterruptPayload, CounterspellInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'counterspell',
        phase: 'before-action',
        actorCharId: reactor.id,
        payload: {
          reactorName: reactor.name,
          casterName: params.casterName,
          spellName: params.spellName,
          spellLevel: params.spellLevel,
          counterspellSlotLevel: params.counterspellSlotLevel,
          abilityCheckDc: params.abilityCheckDc,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedLegendaryResistanceChoice = async (params: {
    targetTokenId: string
    targetName: string
    effectName: string
    total: number
    dc: number
    remainingUses: number
  }): Promise<boolean> => {
    if (!activeMap || !isDM || params.remainingUses < 1) return false
    const id = runtimeId()
    const interrupt = createCombatInterrupt<LegendaryResistanceInterruptPayload, LegendaryResistanceInterruptResponse>({
      id,
      transactionId: activeInterruptTransactionIdRef.current ?? id,
      mapId: activeMap.id,
      kind: 'legendary-resistance',
      phase: 'after-save',
      targetCharId: params.targetTokenId,
      payload: {
        targetName: params.targetName,
        effectName: params.effectName,
        total: params.total,
        dc: params.dc,
        remainingUses: params.remainingUses,
      },
      expiresAt: runtimeNow() + 60_000,
    })
    await publishCombatInterrupt(interrupt)
    const useLegendaryResistance = await showCombatDialog({
      title: '传奇抗性',
      message: `${params.targetName} 对${params.effectName}的豁免失败（${params.total} vs DC ${params.dc}）。\n是否消耗 1 次传奇抗性，将本次豁免改为成功？\n剩余 ${params.remainingUses} 次。`,
      confirmText: '使用传奇抗性',
      cancelText: '保留次数',
      tone: 'amber',
    })
    const response = { useLegendaryResistance }
    await answerSharedCombatInterrupt(id, response)
    await finishSharedCombatInterrupt(id, response)
    return useLegendaryResistance
  }

  const requestSharedUncannyDodgeChoice = (
    target: Character,
    params: { attackerName: string; attackName: string },
  ): Promise<boolean> => {
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '直觉闪避',
        message: `${params.attackerName} 的${params.attackName}命中了 ${target.name}。\n是否消耗反应，将这次攻击的伤害减半？`,
        confirmText: '发动直觉闪避',
        cancelText: '保留反应',
        tone: 'sky',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedUncannyDodgeRef, metadata: { targetCharId: target.id },
      create: () => createCombatInterrupt<UncannyDodgeInterruptPayload, UncannyDodgeInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'uncanny-dodge',
        targetCharId: target.id,
        payload: {
          attackerName: params.attackerName,
          targetName: target.name,
          attackName: params.attackName,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedDeflectMissilesChoice = (
    target: Character,
    params: {
      phase: 'reduce' | 'return'
      attackerName: string
      attackName: string
      kiCurrent?: number
    },
  ): Promise<boolean> => {
    const returning = params.phase === 'return'
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '拨挡飞弹',
        message: returning
          ? `${target.name} 已接住 ${params.attackerName} 的飞弹。\n是否消耗 1 点气，将飞弹掷回攻击者？`
          : `${params.attackerName} 的${params.attackName}命中了 ${target.name}。\n是否消耗反应，令伤害减少 1d10＋敏捷调整值＋武僧等级？`,
        confirmText: returning ? '消耗 1 气掷回' : '发动拨挡飞弹',
        cancelText: returning ? '不掷回' : '保留反应',
        tone: 'sky',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedDeflectMissilesRef, metadata: { targetCharId: target.id },
      create: () => createCombatInterrupt<DeflectMissilesInterruptPayload, DeflectMissilesInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'deflect-missiles',
        targetCharId: target.id,
        payload: {
          phase: params.phase,
          attackerName: params.attackerName,
          targetName: target.name,
          attackName: params.attackName,
          kiCurrent: params.kiCurrent,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedSavingThrowRerollChoice = (
    target: Character,
    params: { featureName: string; total: number; dc: number },
  ): Promise<boolean> => {
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: params.featureName,
        message: `${target.name} 的豁免结果 ${params.total} 未达到 DC ${params.dc}。\n是否消耗一次${params.featureName}重掷？重掷后必须采用新结果。`,
        confirmText: `使用${params.featureName}`,
        cancelText: '保留资源',
        tone: 'violet',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedSavingThrowRerollRef, metadata: { targetCharId: target.id },
      create: () => createCombatInterrupt<SavingThrowRerollInterruptPayload, SavingThrowRerollInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'saving-throw-reroll',
        targetCharId: target.id,
        payload: {
          targetName: target.name,
          featureName: params.featureName,
          total: params.total,
          dc: params.dc,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  async function requestDnd5eSavingThrowRerollDice(input: {
    target: Character
    targetName: string
    featureName: string
    total: number
    dc: number
    mode: 'normal' | 'advantage' | 'disadvantage'
  }): Promise<{ d20: number; d20Second?: number } | undefined> {
    const accepted = await requestSharedSavingThrowRerollChoice(input.target, {
      featureName: input.featureName,
      total: input.total,
      dc: input.dc,
    })
    if (!accepted) return undefined
    const d20 = await rollDiceBoxD20(`${input.featureName}·豁免重掷`, input.targetName)
    const d20Second = input.mode !== 'normal'
      ? await rollDiceBoxD20(`${input.featureName}·豁免重掷（${input.mode === 'advantage' ? '优势' : '劣势'}）`, input.targetName)
      : undefined
    return { d20, d20Second }
  }

  const requestSharedBardicInspirationChoice = (
    target: Character,
    params: {
      dieSides: number
      rollType: BardicInspirationRollType
      total: number
      targetNumber: number
      source?: 'held-inspiration' | 'peerless-skill'
    },
  ): Promise<boolean> => {
    const peerlessSkill = params.source === 'peerless-skill'
    const message = `${target.name} 的${params.rollType}当前结果为 ${params.total}，目标值为 ${params.targetNumber}。\n是否消耗一枚 d${params.dieSides} 吟游激励骰${peerlessSkill ? '发动超凡技艺' : ''}并加入结果？`
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: peerlessSkill ? '超凡技艺' : '吟游激励',
        message,
        confirmText: `使用 d${params.dieSides} 激励骰`,
        cancelText: '保留次数',
        tone: 'amber',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedBardicInspirationRef, metadata: { targetCharId: target.id },
      create: () => createCombatInterrupt<BardicInspirationInterruptPayload, BardicInspirationInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'bardic-inspiration',
        targetCharId: target.id,
        payload: {
          targetName: target.name,
          dieSides: params.dieSides,
          rollType: params.rollType,
          total: params.total,
          targetNumber: params.targetNumber,
          source: params.source,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  async function requestDnd5eBardicInspirationRoll(input: {
    target?: Character
    targetName: string
    dieSides: number
    rollType: BardicInspirationRollType
    total: number
    targetNumber: number
  }): Promise<number | undefined> {
    const accepted = input.target
      ? await requestSharedBardicInspirationChoice(input.target, input)
      : await showCombatDialog({
          title: '吟游激励',
          message: `${input.targetName} 的${input.rollType}当前结果为 ${input.total}，目标值为 ${input.targetNumber}。\n是否消耗一枚 d${input.dieSides} 吟游激励骰并加入结果？`,
          confirmText: `使用 d${input.dieSides} 激励骰`,
          cancelText: '保留激励骰',
          tone: 'amber',
        })
    if (!accepted) return undefined
    return (await rollDiceBoxValues(1, input.dieSides, '吟游激励', input.targetName))[0]
  }

  const requestDnd5ePeerlessSkillRoll = async (input: {
    target: Character
    dieSides: number
    total: number
    targetNumber: number
  }): Promise<number | undefined> => {
    const accepted = await requestSharedBardicInspirationChoice(input.target, {
      dieSides: input.dieSides,
      rollType: '属性检定',
      total: input.total,
      targetNumber: input.targetNumber,
      source: 'peerless-skill',
    })
    if (!accepted) return undefined
    return (await rollDiceBoxValues(1, input.dieSides, '超凡技艺', input.target.name))[0]
  }

  const requestSharedCuttingWordsChoice = (
    bard: Character,
    params: {
      attackerName: string
      targetName: string
      attackName: string
      phase: 'attack' | 'damage' | 'ability-check'
      dieSides: number
      total: number
      targetNumber?: number
    },
  ): Promise<boolean> => {
    const outcome = params.phase === 'attack'
      ? `攻击总值 ${params.total}${params.targetNumber == null ? '' : ` vs AC ${params.targetNumber}`}`
      : params.phase === 'ability-check'
        ? `检定总值 ${params.total}${params.targetNumber == null ? '' : ` vs DC ${params.targetNumber}`}`
        : `伤害总值 ${params.total}`
    const message = params.phase === 'ability-check'
      ? `${params.attackerName} 正在进行${params.attackName}，${outcome}。\n${bard.name} 是否消耗反应和一枚 d${params.dieSides} 吟游激励骰，发动尖刻言辞？`
      : `${params.attackerName} 正以${params.attackName}攻击 ${params.targetName}，${outcome}。\n${bard.name} 是否消耗反应和一枚 d${params.dieSides} 吟游激励骰，发动尖刻言辞？`
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '尖刻言辞',
        message,
        confirmText: `使用 d${params.dieSides}`,
        cancelText: '保留反应',
        tone: 'violet',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedCuttingWordsRef, metadata: { bardCharId: bard.id },
      create: () => createCombatInterrupt<CuttingWordsInterruptPayload, CuttingWordsInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'cutting-words',
        actorCharId: bard.id,
        payload: {
          bardName: bard.name,
          attackerName: params.attackerName,
          targetName: params.targetName,
          attackName: params.attackName,
          phase: params.phase,
          dieSides: params.dieSides,
          total: params.total,
          targetNumber: params.targetNumber,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestDnd5eCuttingWordsRoll = async (
    candidate: { character: Character; token: Token; distanceFeet: number; dieSides: number },
    params: { attackerName: string; targetName: string; attackName: string; total: number; targetNumber?: number; phase?: 'attack' | 'damage' | 'ability-check' },
  ): Promise<Dnd5eCuttingWordsUse | undefined> => {
    const accepted = await requestSharedCuttingWordsChoice(candidate.character, {
      ...params,
      phase: params.phase ?? 'attack',
      dieSides: candidate.dieSides,
    })
    if (!accepted) return undefined
    const roll = (await rollDiceBoxValues(1, candidate.dieSides, '尖刻言辞', params.attackerName))[0]
    return { bardId: candidate.token.id, roll, distanceFeet: candidate.distanceFeet }
  }

  const requestSharedDarkOnesOwnLuckChoice = (
    target: Character,
    params: {
      rollType: '豁免' | '属性检定'
      total: number
      targetNumber?: number
    },
  ): Promise<boolean> => {
    const targetText = params.targetNumber == null ? '' : `，目标值为 ${params.targetNumber}`
    const message = `${target.name} 的${params.rollType}当前结果为 ${params.total}${targetText}。\n是否消耗一次黑暗之主的幸运，并把 1d10 加入结果？`
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '黑暗之主的幸运',
        message,
        confirmText: '使用 1d10',
        cancelText: '保留次数',
        tone: 'violet',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedDarkOnesOwnLuckRef, metadata: { targetCharId: target.id },
      create: () => createCombatInterrupt<DarkOnesOwnLuckInterruptPayload, DarkOnesOwnLuckInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'dark-ones-own-luck',
        targetCharId: target.id,
        payload: {
          targetName: target.name,
          rollType: params.rollType,
          total: params.total,
          targetNumber: params.targetNumber,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  async function requestDnd5eDarkOnesOwnLuckRoll(input: {
    target?: Character
    targetName: string
    rollType: '豁免' | '属性检定'
    total: number
    targetNumber?: number
  }): Promise<number | undefined> {
    const accepted = input.target
      ? await requestSharedDarkOnesOwnLuckChoice(input.target, input)
      : await showCombatDialog({
          title: '黑暗之主的幸运',
          message: `${input.targetName} 的${input.rollType}当前结果为 ${input.total}${input.targetNumber == null ? '' : `，目标值为 ${input.targetNumber}`}。\n是否消耗一次黑暗之主的幸运，并把 1d10 加入结果？`,
          confirmText: '使用 1d10',
          cancelText: '保留次数',
          tone: 'violet',
        })
    if (!accepted) return undefined
    return (await rollDiceBoxValues(1, 10, '黑暗之主的幸运', input.targetName))[0]
  }

  useEffect(() => {
    if (!isDM || !combatActive || !activeMap || !currentInitiativeToken) {
      persistentAreaTurnBoundaryRef.current = null
      return
    }
    const current = { mapId: activeMap.id, round, tokenId: currentInitiativeToken.id }
    const previous = persistentAreaTurnBoundaryRef.current
    if (
      previous?.mapId === current.mapId && previous.round === current.round &&
      previous.tokenId === current.tokenId
    ) return
    persistentAreaTurnBoundaryRef.current = current
    void (async () => {
      let workingMap = useMapStore.getState().maps.find((map) => map.id === current.mapId)
      let workingCharacters = useCharacterStore.getState().characters
      if (!workingMap) return
      const boundaries: Array<{ timing: 'turn-start' | 'turn-end'; round: number; tokenId: string }> = []
      if (previous?.mapId === current.mapId) {
        boundaries.push({ timing: 'turn-end', round: previous.round, tokenId: previous.tokenId })
      }
      boundaries.push({ timing: 'turn-start', round: current.round, tokenId: current.tokenId })
      const logs: string[] = []
      for (const boundary of boundaries) {
        const candidates = collectDnd5ePersistentAreaTriggers({
          map: workingMap,
          timing: boundary.timing,
          round: boundary.round,
          targetTokenId: boundary.tokenId,
          turnKey: `${boundary.round}:${boundary.tokenId}`,
        })
        const settled = await settleDnd5ePersistentAreaCandidates({
          candidates,
          map: workingMap,
          characters: workingCharacters,
          round: boundary.round,
        })
        workingMap = settled.map
        workingCharacters = settled.characters
        logs.push(...settled.logs)
      }
      const beforeMap = useMapStore.getState().maps.find((map) => map.id === current.mapId)
      const beforeCharacters = useCharacterStore.getState().characters
      if (!beforeMap) return
      for (const character of workingCharacters) {
        const before = beforeCharacters.find((candidate) => candidate.id === character.id)
        if (before && JSON.stringify(before) !== JSON.stringify(character)) updateChar(character.id, character)
      }
      for (const token of workingMap.tokens) {
        const before = beforeMap.tokens.find((candidate) => candidate.id === token.id)
        if (before && JSON.stringify(before) !== JSON.stringify(token)) updateToken(workingMap.id, token.id, token)
      }
      if (JSON.stringify(beforeMap.dnd5ePluginAreas ?? []) !== JSON.stringify(workingMap.dnd5ePluginAreas ?? [])) {
        updateMap(workingMap.id, { dnd5ePluginAreas: workingMap.dnd5ePluginAreas ?? [] })
      }
      for (const log of logs) pushCombatLog(log, 'system')
    })()
  // Boundary identity is intentionally primitive; the ref prevents replay after unrelated map/store renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDM, combatActive, activeMap?.id, currentInitiativeToken?.id, round, initiativeIndex])

  const rollDnd5eTranquilityWard = async (input: {
    ward?: Dnd5eTranquilityWardCheck
    attacker: Dnd5eCombatant
    attackerCharacter?: Character
    attackerName: string
    bardicInspirationAvailable?: boolean
    savingThrowRerollAvailable?: boolean
    darkOnesOwnLuckAvailable?: boolean
  }): Promise<{ passed: boolean; roll?: Dnd5eTranquilitySaveRoll }> => {
    const ward = input.ward
    if (!ward) return { passed: true }
    const wardName = ward.source === 'nature-sanctuary' ? '自然庇护' : '宁静心境'
    const d20 = await rollDiceBoxD20(`${wardName}·感知豁免`, input.attackerName)
    const d20Second = ward.saveMode !== 'normal'
      ? await rollDiceBoxD20(`${wardName}·感知豁免（${ward.saveMode === 'advantage' ? '优势' : '劣势'}）`, input.attackerName)
      : undefined
    const blessRoll = ward.blessed
      ? (await rollDiceBoxValues(1, 4, `祝福术·${wardName}豁免加值`, input.attackerName))[0]
      : undefined
    const baneRoll = ward.baned
      ? (await rollDiceBoxValues(1, 4, `灾祸术·${wardName}豁免减值`, input.attackerName))[0]
      : undefined
    const saveModifier = ward.saveModifier + (blessRoll ?? 0) - (baneRoll ?? 0)
    const initial = previewDnd5eSavingThrowRoll({
      rolls: ward.saveMode === 'normal' ? [d20] : [d20, d20Second ?? 0],
      mode: ward.saveMode,
      modifier: saveModifier,
      dc: ward.saveDc,
    })
    const inspirationDie = input.bardicInspirationAvailable === false
      ? undefined
      : dnd5eHeldBardicInspirationDie(input.attacker)
    const bardicInspirationRoll = !initial.success && inspirationDie && initial.roll.total + inspirationDie >= ward.saveDc
      ? await requestDnd5eBardicInspirationRoll({
          target: input.attackerCharacter,
          targetName: input.attackerName,
          dieSides: inspirationDie,
          rollType: '豁免',
          total: initial.roll.total,
          targetNumber: ward.saveDc,
        })
      : undefined
    const succeededWithInspiration = initial.success ||
      initial.roll.total + (bardicInspirationRoll ?? 0) >= ward.saveDc
    const darkOnesOwnLuckRoll = !succeededWithInspiration && input.darkOnesOwnLuckAvailable !== false &&
      dnd5eDarkOnesOwnLuckAvailable(input.attacker)
      ? await requestDnd5eDarkOnesOwnLuckRoll({
          target: input.attackerCharacter,
          targetName: input.attackerName,
          rollType: '豁免',
          total: initial.roll.total + (bardicInspirationRoll ?? 0),
          targetNumber: ward.saveDc,
        })
      : undefined
    const succeededWithLuck = succeededWithInspiration ||
      initial.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= ward.saveDc
    let rerollD20: number | undefined
    let rerollD20Second: number | undefined
    let passed = succeededWithLuck
    const rerollFeature = input.savingThrowRerollAvailable === false
      ? undefined
      : dnd5eSavingThrowRerollFeature(input.attacker)
    if (!succeededWithLuck && input.attackerCharacter && rerollFeature) {
      const reroll = await requestDnd5eSavingThrowRerollDice({
        target: input.attackerCharacter,
        targetName: input.attackerName,
        featureName: rerollFeature.name,
        total: initial.roll.total,
        dc: ward.saveDc,
        mode: ward.saveMode,
      })
      rerollD20 = reroll?.d20
      rerollD20Second = reroll?.d20Second
      if (rerollD20 != null) {
        passed = previewDnd5eSavingThrowRoll({
          rolls: ward.saveMode === 'normal' ? [rerollD20] : [rerollD20, rerollD20Second ?? 0],
          mode: ward.saveMode,
          modifier: saveModifier,
          dc: ward.saveDc,
        }).success
      }
    }
    return {
      passed,
      roll: { d20, d20Second, blessRoll, baneRoll, rerollD20, rerollD20Second, bardicInspirationRoll, darkOnesOwnLuckRoll },
    }
  }

  const requestSharedStrokeOfLuckChoice = (
    actor: Character,
    params: { targetName: string; attackName: string; total: number; armorClass: number; rollType?: 'attack' | 'ability-check' },
  ): Promise<boolean> => {
    const abilityCheck = params.rollType === 'ability-check'
    const message = abilityCheck
      ? `${actor.name} 的${params.attackName}结果为 ${params.total}，未达到 DC ${params.armorClass}。\n是否消耗一次幸运一击，将本次 d20 视为 20？`
      : `${actor.name} 的${params.attackName}未命中 ${params.targetName}（${params.total} vs AC ${params.armorClass}）。\n是否消耗一次幸运一击，将这次未命中改为命中？`
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '幸运一击',
        message,
        confirmText: '使用幸运一击',
        cancelText: '保留次数',
        tone: 'amber',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedStrokeOfLuckRef, metadata: { actorCharId: actor.id },
      create: () => createCombatInterrupt<StrokeOfLuckInterruptPayload, StrokeOfLuckInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'stroke-of-luck',
        actorCharId: actor.id,
        payload: {
          targetName: params.targetName,
          attackName: params.attackName,
          total: params.total,
          armorClass: params.armorClass,
          rollType: params.rollType,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedEmpoweredSpellChoice = (
    actor: Character,
    params: { spellName: string; maximumDice: number; groups: EmpoweredSpellInterruptPayload['groups'] },
  ): Promise<string[]> => {
    if (!activeMap || !isDM || params.groups.length === 0) return Promise.resolve([])
    const id = runtimeId()
    const expiresAt = runtimeNow() + 30000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedEmpoweredSpellRef, metadata: { actorCharId: actor.id },
      create: () => createCombatInterrupt<EmpoweredSpellInterruptPayload, EmpoweredSpellInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'empowered-spell',
        actorCharId: actor.id,
        payload: {
          casterName: actor.name,
          spellName: params.spellName,
          maximumDice: params.maximumDice,
          groups: params.groups,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const requestSharedStandAgainstTideChoice = (
    hunter: Character,
    params: {
      attackerName: string
      attackName: string
      candidates: StandAgainstTideInterruptPayload['candidates']
    },
  ): Promise<string | undefined> => {
    if (!activeMap || !isDM || params.candidates.length === 0) return Promise.resolve(undefined)
    const id = runtimeId()
    const expiresAt = runtimeNow() + 20000
    return requestAndWaitForCombatInterrupt({
      id, channel: pendingSharedStandAgainstTideRef, metadata: { hunterCharId: hunter.id },
      create: () => createCombatInterrupt<StandAgainstTideInterruptPayload, StandAgainstTideInterruptResponse>({
        id,
        transactionId: activeInterruptTransactionIdRef.current ?? id,
        mapId: activeMap.id,
        kind: 'stand-against-tide',
        targetCharId: hunter.id,
        payload: {
          hunterName: hunter.name,
          ...params,
        },
        expiresAt,
      }),
      publish: publishCombatInterrupt,
    })
  }

  const buildDnd5eStandAgainstTideUse = async (input: {
    map: BattleMap
    state: Dnd5eHeadlessCombatState
    attackerToken: Token
    hunterToken: Token
    attackerName: string
    attackName: string
    attackModifier: number
    criticalThreshold?: number
    reachFeet: number
    damage: readonly { count: number; sides: number; bonus: number; type?: Dnd5eDamageType }[]
    classDamageContext?: Dnd5eWeaponClassDamageContext
    greatWeaponFighting?: boolean
    maximizedDamage?: boolean
    bardicInspirationAlreadyUsed?: boolean
    excludedReactionTokenIds?: ReadonlySet<string>
    excludedClassDamageSources?: ReadonlySet<string>
  }): Promise<Dnd5eStandAgainstTideUse | undefined> => {
    const hunter = input.state.combatants[input.hunterToken.id]
    const attacker = input.state.combatants[input.attackerToken.id]
    const hunterCharacter = input.hunterToken.characterId
      ? useCharacterStore.getState().characters.find((character) => character.id === input.hunterToken.characterId)
      : undefined
    if (
      !hunter || !attacker || !hunterCharacter || hunter.currentHp <= 0 ||
      hunter.classId !== 'ranger' || hunter.subclassId !== 'hunter' || hunter.level < 15 ||
      !hunter.classSelections['superior-hunters-defense']?.includes('stand-against-tide') ||
      !hunter.turn.reactionAvailable || attacker.controller === hunter.controller ||
      Object.keys(hunter.classState.openHandNoReactionsAppliedTurnKeysBySource ?? {}).length > 0 ||
      hunter.conditions.some((condition) => ['incapacitated', 'stunned', 'unconscious', '失能', '震慑', '昏迷'].includes(condition.toLowerCase()))
    ) return undefined

    const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
    const candidateTokens = input.map.tokens.filter((token) => {
      if (
        token.id === input.attackerToken.id || token.id === input.hunterToken.id || token.type === 'obstacle' ||
        tokenFootprintDistanceCells(token, input.attackerToken, input.map) * feetPerCell > input.reachFeet
      ) return false
      const combatant = input.state.combatants[token.id]
      return !!combatant && combatant.currentHp > 0 && !combatant.deathSaves.dead
    })
    if (candidateTokens.length === 0) return undefined
    const selectedTokenId = await requestSharedStandAgainstTideChoice(hunterCharacter, {
      attackerName: input.attackerName,
      attackName: input.attackName,
      candidates: candidateTokens.map((token) => ({ tokenId: token.id, label: token.label })),
    })
    const redirectToken = candidateTokens.find((token) => token.id === selectedTokenId)
    if (!redirectToken) return undefined
    const redirectTarget = input.state.combatants[redirectToken.id]
    if (!redirectTarget) return undefined
    const redirectCharacter = redirectToken.characterId
      ? useCharacterStore.getState().characters.find((character) => character.id === redirectToken.characterId)
      : undefined
    const attackerCharacter = input.attackerToken.characterId
      ? useCharacterStore.getState().characters.find((character) => character.id === input.attackerToken.characterId)
      : undefined

    const tranquility = await rollDnd5eTranquilityWard({
      ward: dnd5eTranquilityWardCheck(attacker, redirectTarget, input.state),
      attacker,
      attackerCharacter,
      attackerName: input.attackerName,
      bardicInspirationAvailable: !input.bardicInspirationAlreadyUsed,
    })
    const excludedReactionTokenIds = new Set(input.excludedReactionTokenIds ?? [])
    const protectionCandidate = tranquility.passed
      ? findDnd5eProtectionCandidate(input.map, input.attackerToken, redirectToken, excludedReactionTokenIds)
      : undefined
    const useProtection = !!(protectionCandidate && await requestSharedProtectionChoice(protectionCandidate.character, {
      attackerName: input.attackerName,
      targetName: redirectToken.label,
      attackName: input.attackName,
    }))
    if (useProtection && protectionCandidate) excludedReactionTokenIds.add(protectionCandidate.token.id)
    const requestedMode = useProtection ? 'disadvantage' as const : 'normal' as const
    const mode = dnd5eRepeatedMeleeAttackMode(input.state, attacker.id, redirectTarget.id, requestedMode)
    const d20 = tranquility.passed
      ? await rollDiceBoxD20(`逆流反击·${input.attackName}命中检定`, redirectToken.label)
      : 1
    const d20Second = tranquility.passed && mode !== 'normal'
      ? await rollDiceBoxD20(`逆流反击·${input.attackName}命中检定（${mode === 'advantage' ? '优势' : '劣势'}）`, redirectToken.label)
      : undefined
    const blessed = dnd5eCombatantHasConcentrationEffect(input.state, attacker.id, 'bless')
    const baned = dnd5eCombatantHasConcentrationEffect(input.state, attacker.id, 'bane')
    const blessRoll = tranquility.passed && blessed
      ? (await rollDiceBoxValues(1, 4, '祝福术·逆流反击攻击加值', input.attackerName))[0]
      : undefined
    const baneRoll = tranquility.passed && baned
      ? (await rollDiceBoxValues(1, 4, '灾祸术·逆流反击攻击减值', input.attackerName))[0]
      : undefined
    const selectedD20 = mode === 'advantage'
      ? Math.max(d20, d20Second ?? d20)
      : mode === 'disadvantage'
        ? Math.min(d20, d20Second ?? d20)
        : d20
    const baseAttackTotal = selectedD20 + input.attackModifier + (blessRoll ?? 0) - (baneRoll ?? 0)
    let armorClass = dnd5eTargetArmorClassForAttack(input.state, attacker.id, redirectTarget.id)
    const criticalThreshold = Math.min(20, Math.max(18, input.criticalThreshold ?? 20))
    const critical = selectedD20 >= criticalThreshold
    let hit = !tranquility.passed
      ? false
      : selectedD20 !== 1 && (critical || baseAttackTotal >= armorClass)
    const inspirationDie = !input.bardicInspirationAlreadyUsed && tranquility.roll?.bardicInspirationRoll == null
      ? dnd5eHeldBardicInspirationDie(attacker)
      : undefined
    const bardicInspirationRoll = tranquility.passed && !hit && selectedD20 !== 1 && inspirationDie &&
      baseAttackTotal + inspirationDie >= armorClass
      ? await requestDnd5eBardicInspirationRoll({
          target: attackerCharacter,
          targetName: input.attackerName,
          dieSides: inspirationDie,
          rollType: '攻击检定',
          total: baseAttackTotal,
          targetNumber: armorClass,
        })
      : undefined
    let attackTotal = baseAttackTotal + (bardicInspirationRoll ?? 0)
    hit = tranquility.passed && selectedD20 !== 1 && (critical || attackTotal >= armorClass)
    const cuttingWordsCandidate = hit && !critical
      ? findDnd5eCuttingWordsCandidate(
          input.map,
          input.state,
          input.attackerToken,
          input.hunterToken,
          excludedReactionTokenIds,
        )
      : undefined
    const cuttingWords = cuttingWordsCandidate
      ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
          attackerName: input.attackerName,
          targetName: redirectToken.label,
          attackName: input.attackName,
          total: attackTotal,
          targetNumber: armorClass,
        })
      : undefined
    if (cuttingWords) {
      excludedReactionTokenIds.add(cuttingWords.bardId)
      attackTotal -= cuttingWords.roll
      hit = selectedD20 !== 1 && (critical || attackTotal >= armorClass)
    }
    const canStrokeOfLuck = !hit && dnd5eCombatantClassLevel(attacker, 'rogue') >= 20 &&
      (attacker.classResources['dnd5e-stroke-of-luck']?.current ?? 0) > 0
    const strokeOfLuck = !!(canStrokeOfLuck && attackerCharacter && await requestSharedStrokeOfLuckChoice(attackerCharacter, {
      targetName: redirectToken.label,
      attackName: `逆流反击·${input.attackName}`,
      total: attackTotal,
      armorClass,
    }))
    if (strokeOfLuck) hit = true
    const shieldSpellReaction = !!(
      hit && !critical && redirectCharacter && dnd5eCanCastShieldSpell(redirectTarget) &&
      await requestSharedShieldSpellChoice(redirectCharacter, {
        attackerName: input.attackerName,
        attackName: input.attackName,
        attackTotal,
        armorClass,
      })
    )
    if (shieldSpellReaction) {
      armorClass += 5
      hit = strokeOfLuck || critical || (selectedD20 !== 1 && attackTotal >= armorClass)
      excludedReactionTokenIds.add(redirectToken.id)
    }

    const effectiveClassDamageContext = input.classDamageContext
      ? {
          ...input.classDamageContext,
          adjacentEnemyOfTarget: input.map.tokens.some((token) => {
            if (token.id === input.attackerToken.id || token.id === redirectToken.id || !areOpposedCombatTokens(token, redirectToken)) return false
            const combatant = input.state.combatants[token.id]
            return !!combatant && combatant.currentHp > 0 &&
              tokenFootprintDistanceCells(token, redirectToken, input.map) * feetPerCell <= 5
          }),
        }
      : undefined
    const classDamageDefinitions = hit && effectiveClassDamageContext
      ? dnd5eWeaponClassDamageDefinitions({
          state: input.state,
          actorId: attacker.id,
          targetId: redirectTarget.id,
          context: effectiveClassDamageContext,
          effectiveMode: mode,
          critical,
        }).filter((definition) => !input.excludedClassDamageSources?.has(definition.source))
      : []
    const damageRolls: number[][] = []
    for (let index = 0; index < input.damage.length; index += 1) {
      const definition = input.damage[index]
      const rollCount = definition.count * (critical ? 2 : 1)
      let rolls = hit
        ? input.maximizedDamage
          ? Array.from({ length: rollCount }, () => definition.sides)
          : await rollDiceBoxValues(
              rollCount,
              definition.sides,
              `逆流反击·${input.attackName}伤害`,
              redirectToken.label,
            )
        : []
      if (index === 0 && input.greatWeaponFighting && rolls.some((value) => value <= 2)) {
        const rerolled: number[] = []
        for (const value of rolls) {
          rerolled.push(value <= 2
            ? (await rollDiceBoxValues(1, definition.sides, '巨武器战斗重掷', redirectToken.label))[0]
            : value)
        }
        rolls = rerolled
      }
      damageRolls.push(rolls)
    }
    const classDamageLabels = {
      'sneak-attack': '偷袭', 'colossus-slayer': '巨像杀手', 'brutal-critical': '凶蛮重击',
      'improved-divine-smite': '精通至圣斩', 'divine-smite': '至圣斩', 'hunters-mark': '猎人印记',
      'divine-strike': '神圣打击', 'lifedrinker': '饮命者', 'foe-slayer': '屠灭众敌',
    } as const
    const classDamageRolls: Dnd5eClassDamageRolls[] = []
    for (const definition of classDamageDefinitions) {
      const count = definition.count * (critical && definition.doubleOnCritical ? 2 : 1)
      classDamageRolls.push({
        source: definition.source,
        rolls: count > 0
          ? await rollDiceBoxValues(count, definition.sides, `逆流反击·${classDamageLabels[definition.source]}`, redirectToken.label)
          : [],
      })
    }
    const rawDamageTotal = hit
      ? input.damage.reduce((total, definition, index) =>
          total + Math.max(0, damageRolls[index].reduce((sum, value) => sum + value, 0) + definition.bonus), 0) +
        classDamageDefinitions.reduce((total, definition) => {
          const rolls = classDamageRolls.find((entry) => entry.source === definition.source)?.rolls ?? []
          return total + Math.max(0, rolls.reduce((sum, value) => sum + value, 0) + (definition.bonus ?? 0))
        }, 0)
      : 0
    const cuttingWordsDamageCandidate = hit && rawDamageTotal > 0 && !cuttingWords
      ? findDnd5eCuttingWordsCandidate(
          input.map,
          input.state,
          input.attackerToken,
          input.hunterToken,
          excludedReactionTokenIds,
        )
      : undefined
    const cuttingWordsDamage = cuttingWordsDamageCandidate
      ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
          attackerName: input.attackerName,
          targetName: redirectToken.label,
          attackName: input.attackName,
          total: rawDamageTotal,
          phase: 'damage',
        })
      : undefined
    const uncannyDodge = !!(
      hit && !shieldSpellReaction && redirectCharacter && dnd5eCanUseUncannyDodge(redirectTarget) &&
      await requestSharedUncannyDodgeChoice(redirectCharacter, {
        attackerName: input.attackerName,
        attackName: `逆流反击·${input.attackName}`,
      })
    )
    const hurlThroughHellDamageRolls = hit && attacker.classState.hurlThroughHellReady
      ? await rollDiceBoxValues(10, 10, '坠入地狱·返回伤害', redirectToken.label)
      : undefined
    pushCombatLog(
      `${hunterCharacter.name} 发动逆流反击：迫使 ${input.attackerName} 以${input.attackName}改攻 ${redirectToken.label}。`,
      'system',
    )
    return {
      targetId: redirectToken.id,
      distanceFeet: tokenFootprintDistanceCells(redirectToken, input.attackerToken, input.map) * feetPerCell,
      d20,
      d20Second,
      blessRoll,
      baneRoll,
      bardicInspirationRoll,
      cuttingWords,
      cuttingWordsDamage,
      strokeOfLuck: strokeOfLuck || undefined,
      mode: requestedMode,
      protectionReactionActorId: useProtection ? protectionCandidate?.token.id : undefined,
      shieldSpellReaction: shieldSpellReaction || undefined,
      uncannyDodge: uncannyDodge || undefined,
      tranquilitySave: tranquility.roll,
      hurlThroughHellDamageRolls,
      damageRolls,
      classDamageRolls,
    }
  }

  async function finishEnemyAttack(
    result: EnemyTurnResult,
    targetChar: Character | undefined,
  ) {
    if (!activeMap || !result.attacked || !result.targetTokenId) return

    const liveMapId = activeMap.id
    const hasEnemyDamage = !!result.attack || (result.damage != null && result.damage > 0)

    const tryResolveSrd5eMonsterAttack = async () => {
      if (!targetChar || !result.attack || !result.attackerTokenId || !result.targetTokenId) return false
      const latestMap = useMapStore.getState().maps.find((map) => map.id === liveMapId) ?? activeMap
      const prepared = prepareDnd5eMonsterAttack({
        combatId: combatIdRef.current || `map-${latestMap.id}`,
        round: roundRef.current,
        map: latestMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        actorTokenId: result.attackerTokenId,
        targetTokenId: result.targetTokenId,
        actionIndex: result.actionIndex,
        targetTurnEconomy: currentDnd5eTurnEconomy(result.targetTokenId),
        turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      })
      if (!prepared.ok) return false
      const monsterAttack = prepared.prepared

      const actionRolls: { d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; protectionReactionActorId?: string; shieldSpellReaction?: boolean; uncannyDodge?: boolean; deflectMissilesD10?: number; tranquilitySave?: Dnd5eTranquilitySaveRoll; damageRolls: number[][]; standAgainstTide?: Dnd5eStandAgainstTideUse }[] = []
      const displayedDamageRolls: number[][] = []
      const targetCombatant = monsterAttack.state.combatants[monsterAttack.targetToken.id]
      const actorCombatant = monsterAttack.state.combatants[monsterAttack.actorToken.id]
      const actorCharacter = monsterAttack.actorToken.characterId
        ? monsterAttack.characters.find((character) => character.id === monsterAttack.actorToken.characterId)
        : undefined
      const inspirationDie = actorCombatant ? dnd5eHeldBardicInspirationDie(actorCombatant) : undefined
      let bardicInspirationCommitted = false
      let savingThrowRerollCommitted = false
      let uncannyDodgeUsed = false
      let deflectMissilesUsed = false
      let shieldSpellUsed = false
      let standAgainstTideUsed = false
      const protectionReactionTokenIds = new Set<string>()
      const cuttingWordsReactionTokenIds = new Set<string>()
      for (let index = 0; index < monsterAttack.attacks.length; index += 1) {
        const attackEntry = monsterAttack.attacks[index]
        if (!actorCombatant) return false
        const tranquility = await rollDnd5eTranquilityWard({
          ward: monsterAttack.tranquilityWard,
          attacker: actorCombatant,
          attackerCharacter: actorCharacter,
          attackerName: monsterAttack.actorToken.label,
          bardicInspirationAvailable: !bardicInspirationCommitted,
          savingThrowRerollAvailable: !savingThrowRerollCommitted,
        })
        if (tranquility.roll?.bardicInspirationRoll != null) bardicInspirationCommitted = true
        if (tranquility.roll?.rerollD20 != null) savingThrowRerollCommitted = true
        const protectionCandidate = tranquility.passed ? findDnd5eProtectionCandidate(
          latestMap,
          monsterAttack.actorToken,
          monsterAttack.targetToken,
          new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
        ) : undefined
        const useProtection = !!(protectionCandidate && await requestSharedProtectionChoice(protectionCandidate.character, {
          attackerName: monsterAttack.monster.name,
          targetName: monsterAttack.targetToken.label,
          attackName: attackEntry.name,
        }))
        if (useProtection && protectionCandidate) protectionReactionTokenIds.add(protectionCandidate.token.id)
        const attackMode = dnd5eMonsterAttackModeWithProtection(
          dnd5ePreparedMonsterAttackMode(monsterAttack, index),
          useProtection,
        )
        const d20 = tranquility.passed
          ? await rollDiceBoxD20(`${monsterAttack.monster.name}·${attackEntry.name}命中检定`, targetChar.name)
          : 1
        const d20Second = tranquility.passed && attackMode !== 'normal'
          ? await rollDiceBoxD20(`${monsterAttack.monster.name}·${attackEntry.name}命中检定（${attackMode === 'advantage' ? '优势' : '劣势'}）`, targetChar.name)
          : undefined
        const blessRoll = tranquility.passed && monsterAttack.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·攻击加值', monsterAttack.actorToken.label))[0]
          : undefined
        const baneRoll = tranquility.passed && monsterAttack.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·攻击减值', monsterAttack.actorToken.label))[0]
          : undefined
        const preview = previewDnd5eMonsterAttack(monsterAttack, index, d20, d20Second, useProtection, blessRoll, baneRoll)
        const armorClassBeforeReaction = monsterAttack.targetArmorClass + (shieldSpellUsed ? 5 : 0)
        const hitBeforeInspiration = preview.critical || (!preview.roll.naturalOne && preview.roll.total >= armorClassBeforeReaction)
        const bardicInspirationRoll = tranquility.passed && !bardicInspirationCommitted && !hitBeforeInspiration && !preview.roll.naturalOne &&
          inspirationDie && preview.roll.total + inspirationDie >= armorClassBeforeReaction
          ? await requestDnd5eBardicInspirationRoll({
              target: actorCharacter,
              targetName: monsterAttack.actorToken.label,
              dieSides: inspirationDie,
              rollType: '攻击检定',
              total: preview.roll.total,
              targetNumber: armorClassBeforeReaction,
            })
          : undefined
        if (bardicInspirationRoll != null) bardicInspirationCommitted = true
        const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
        const hitBeforeCuttingWords = preview.critical || (!preview.roll.naturalOne && attackTotalBeforeCuttingWords >= armorClassBeforeReaction)
        const cuttingWordsCandidate = tranquility.passed && hitBeforeCuttingWords && !preview.critical
          ? findDnd5eCuttingWordsCandidate(
              latestMap,
              monsterAttack.state,
              monsterAttack.actorToken,
              monsterAttack.targetToken,
              new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
            )
          : undefined
        const cuttingWords = cuttingWordsCandidate &&
          attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < armorClassBeforeReaction
          ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
              attackerName: monsterAttack.monster.name,
              targetName: monsterAttack.targetToken.label,
              attackName: attackEntry.name,
              total: attackTotalBeforeCuttingWords,
              targetNumber: armorClassBeforeReaction,
            })
          : undefined
        if (cuttingWords && cuttingWordsCandidate) cuttingWordsReactionTokenIds.add(cuttingWordsCandidate.token.id)
        const attackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
        let attackHit = preview.critical || (!preview.roll.naturalOne && attackTotal >= armorClassBeforeReaction)
        const shieldSpellReaction = !!(
          attackHit && !shieldSpellUsed && !uncannyDodgeUsed && !cuttingWordsReactionTokenIds.has(monsterAttack.targetToken.id) &&
          targetCombatant && dnd5eCanCastShieldSpell(targetCombatant) &&
          await requestSharedShieldSpellChoice(targetChar, {
            attackerName: monsterAttack.monster.name,
            attackName: attackEntry.name,
            attackTotal,
            armorClass: armorClassBeforeReaction,
          })
        )
        if (shieldSpellReaction) {
          shieldSpellUsed = true
          if (!preview.critical) attackHit = attackTotal >= monsterAttack.targetArmorClass + 5
        }
        const standAgainstTide = !attackHit && !shieldSpellReaction && !standAgainstTideUsed && tranquility.passed &&
          attackEntry.attack.mode !== 'ranged' && attackEntry.attack.reachFeet
          ? await buildDnd5eStandAgainstTideUse({
              map: latestMap,
              state: monsterAttack.state,
              attackerToken: monsterAttack.actorToken,
              hunterToken: monsterAttack.targetToken,
              attackerName: monsterAttack.monster.name,
              attackName: attackEntry.name,
              attackModifier: attackEntry.attack.toHit,
              reachFeet: attackEntry.attack.reachFeet,
              damage: attackEntry.attack.damage,
              bardicInspirationAlreadyUsed: bardicInspirationCommitted,
              excludedReactionTokenIds: new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
            })
          : undefined
        if (standAgainstTide) standAgainstTideUsed = true
        const uncannyDodge = !!(
          attackHit && !shieldSpellUsed && !uncannyDodgeUsed && targetCombatant && dnd5eCanUseUncannyDodge(targetCombatant) &&
          await requestSharedUncannyDodgeChoice(targetChar, {
            attackerName: monsterAttack.monster.name,
            attackName: attackEntry.name,
          })
        )
        if (uncannyDodge) {
          uncannyDodgeUsed = true
        }
        const useDeflectMissiles = !!(
          attackHit && attackEntry.attack.mode === 'ranged' && !shieldSpellUsed && !uncannyDodgeUsed &&
          !deflectMissilesUsed && targetCombatant && dnd5eCanUseDeflectMissiles(targetCombatant) &&
          await requestSharedDeflectMissilesChoice(targetChar, {
            phase: 'reduce',
            attackerName: monsterAttack.monster.name,
            attackName: attackEntry.name,
          })
        )
        const deflectMissilesD10 = useDeflectMissiles
          ? (await rollDiceBoxValues(1, 10, '拨挡飞弹·减伤', targetChar.name))[0]
          : undefined
        if (useDeflectMissiles) deflectMissilesUsed = true
        const componentRolls: number[][] = []
        for (const component of attackEntry.attack.damage) {
          componentRolls.push(attackHit && component.count > 0
            ? await rollDiceBoxValues(
                component.count * (preview.critical ? 2 : 1),
                component.sides,
                `${monsterAttack.monster.name}·${attackEntry.name}伤害`,
                targetChar.name,
              )
            : [])
        }
        const rawDamageTotal = componentRolls.reduce((sum, rolls, componentIndex) =>
          sum + Math.max(0, rolls.reduce((subtotal, value) => subtotal + value, 0) +
            (attackEntry.attack.damage[componentIndex]?.bonus ?? 0)), 0)
        const damageReactionExclusions = new Set([
          ...protectionReactionTokenIds,
          ...cuttingWordsReactionTokenIds,
          ...((shieldSpellReaction || uncannyDodge || useDeflectMissiles) ? [monsterAttack.targetToken.id] : []),
        ])
        const cuttingWordsDamageCandidate = attackHit && rawDamageTotal > 0 && !cuttingWords
          ? findDnd5eCuttingWordsCandidate(
              latestMap,
              monsterAttack.state,
              monsterAttack.actorToken,
              monsterAttack.targetToken,
              damageReactionExclusions,
            )
          : undefined
        const cuttingWordsDamage = cuttingWordsDamageCandidate
          ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
              attackerName: monsterAttack.monster.name,
              targetName: monsterAttack.targetToken.label,
              attackName: attackEntry.name,
              total: rawDamageTotal,
              phase: 'damage',
            })
          : undefined
        if (cuttingWordsDamage && cuttingWordsDamageCandidate) {
          cuttingWordsReactionTokenIds.add(cuttingWordsDamageCandidate.token.id)
        }
        displayedDamageRolls.push(componentRolls.flat())
        actionRolls.push({
          d20,
          d20Second,
          blessRoll,
          baneRoll,
          bardicInspirationRoll,
          cuttingWords,
          cuttingWordsDamage,
          protectionReactionActorId: useProtection ? protectionCandidate?.token.id : undefined,
          shieldSpellReaction,
          uncannyDodge,
          deflectMissilesD10,
          tranquilitySave: tranquility.roll,
          damageRolls: componentRolls,
          standAgainstTide,
        })
      }

      const initialResolved = resolvePreparedDnd5eMonsterAttack({ prepared: monsterAttack, rolls: actionRolls })
      if (!initialResolved.result.ok) return false
      const resolved = await settleDnd5eConcentrationChecks({
        result: initialResolved.result,
        map: monsterAttack.map,
        characters: monsterAttack.characters,
        characterIdByCombatantId: monsterAttack.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      if (shieldSpellUsed) {
        updateDnd5eTurnEconomy(
          monsterAttack.targetToken.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      for (const bardTokenId of cuttingWordsReactionTokenIds) {
        updateDnd5eTurnEconomy(
          bardTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      const application = resolved.application
      for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
        event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
      ))) {
        updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
      }
      applyDnd5eCombatApplication(application)
      await resolveDnd5eBerserkerRetaliations(resolved.result, latestMap.id)
      await resolveDnd5eHunterGiantKiller(resolved.result, latestMap.id)
      if (uncannyDodgeUsed) {
        updateDnd5eTurnEconomy(
          monsterAttack.targetToken.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      if (deflectMissilesUsed) {
        updateDnd5eTurnEconomy(
          monsterAttack.targetToken.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      const deflectEvent = resolved.result.events.find((event) =>
        event.type === 'damage-reduced' && event.source === 'deflect-missiles' &&
        event.targetId === monsterAttack.targetToken.id && event.caught,
      )
      if (deflectEvent?.type === 'damage-reduced') {
        const monkCombatant = resolved.result.state.combatants[monsterAttack.targetToken.id]
        const kiCurrent = monkCombatant?.classResources['dnd5e-ki']?.current ?? 0
        const canReturn = kiCurrent > 0 && monsterAttack.distanceFeet <= 60
        const returnAccepted = canReturn && await requestSharedDeflectMissilesChoice(targetChar, {
          phase: 'return',
          attackerName: monsterAttack.monster.name,
          attackName: '飞弹',
          kiCurrent,
        })
        const returnD20 = returnAccepted
          ? await rollDiceBoxD20('拨挡飞弹·掷回命中', monsterAttack.monster.name)
          : 1
        const returnD20Second = returnAccepted && monsterAttack.distanceFeet > 20
          ? await rollDiceBoxD20('拨挡飞弹·掷回命中（远距劣势）', monsterAttack.monster.name)
          : undefined
        const returnNatural = returnD20Second == null ? returnD20 : Math.min(returnD20, returnD20Second)
        const returnDamageRolls = returnAccepted
          ? await rollDiceBoxValues(
              returnNatural === 20 ? 2 : 1,
              dnd5eMonkMartialArtsDie(targetChar.level),
              '拨挡飞弹·掷回伤害',
              monsterAttack.monster.name,
            )
          : []
        const returned = resolveDnd5eHeadlessAction(resolved.result.state, {
          type: 'monk-deflect-missiles-return',
          actorId: monsterAttack.targetToken.id,
          targetId: monsterAttack.actorToken.id,
          distanceFeet: monsterAttack.distanceFeet,
          decline: !returnAccepted,
          d20: returnD20,
          d20Second: returnD20Second,
          damageRolls: returnDamageRolls,
        })
        if (returned.ok) {
          const returnedSettled = await settleDnd5eConcentrationChecks({
            result: returned,
            map: resolved.application.map,
            characters: resolved.application.characters,
            characterIdByCombatantId: monsterAttack.characterIdByCombatantId,
            rollD20: rollDiceBoxD20,
            rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
            rollDice: rollDiceBoxValues,
            requestHellishRebuke: requestSharedHellishRebukeChoice,
            requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
            requestBardicInspiration: requestDnd5eBardicInspirationRoll,
            requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
          })
          applyDnd5eCombatApplication(returnedSettled.application)
          if (returnAccepted) {
            const returnAttack = returnedSettled.result.events.find((event) => event.type === 'attack-resolved')
            const returnDamage = returnedSettled.result.events.find((event) => event.type === 'damage-applied')
            pushCombatLog(
              returnAttack?.type === 'attack-resolved' && returnAttack.hit
                ? `${targetChar.name} 消耗 1 点气掷回飞弹并命中 ${monsterAttack.monster.name}，造成 ${returnDamage?.type === 'damage-applied' ? returnDamage.amount : 0} 点伤害。`
                : `${targetChar.name} 消耗 1 点气掷回飞弹，但未命中 ${monsterAttack.monster.name}。`,
              returnDamage?.type === 'damage-applied' && returnDamage.amount > 0 ? 'damage' : 'attack',
            )
          }
        }
      }
      for (const protectorTokenId of protectionReactionTokenIds) {
        updateDnd5eTurnEconomy(
          protectorTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }

      const attackEvents = resolved.result.events.filter((event) => event.type === 'attack-resolved')
      const damageEvents = resolved.result.events.filter((event) => event.type === 'damage-applied')
      const totalDamage = damageEvents.reduce((sum, event) => sum + event.amount, 0)
      const tranquilityPrevented = resolved.result.events.filter((event) => event.type === 'hostile-targeting-prevented').length
      const summaries = attackEvents.map((event, index) => {
        const damageReduction = actionRolls[index]?.cuttingWordsDamage?.roll
        return `${monsterAttack.attacks[index].name} ${event.d20}+${monsterAttack.attacks[index].attack.toHit}=${event.total}${event.hit ? ' 命中' : ' 未命中'}${damageReduction ? `，扰乱之语令伤害骰 -${damageReduction}` : ''}`
      })
      pushHeadlessCombatLog(
        `${monsterAttack.monster.name} 使用${monsterAttack.action.name}攻击 ${targetChar.name}：${summaries.join('；') || '没有攻击通过宁静心境'}${tranquilityPrevented > 0 ? `；宁静心境阻止 ${tranquilityPrevented} 次攻击` : ''}；共造成 ${totalDamage} 点伤害。`,
        totalDamage > 0 ? 'damage' : 'attack',
        resolved.result.events,
        [`怪物动作：${monsterAttack.action.name}｜攻击次数 ${monsterAttack.attacks.length}`],
      )

      const lastIndex = Math.max(0, monsterAttack.attacks.length - 1)
      const lastAttack = monsterAttack.attacks[lastIndex].attack
      const lastEvent = attackEvents[lastIndex]
      const lastDamage = damageEvents[lastIndex]?.amount ?? 0
      const lastValues = displayedDamageRolls[lastIndex] ?? []
      const display: DiceRoll = {
        values: lastValues,
        sides: lastAttack.damage[0]?.sides ?? result.attack.sides,
        bonus: lastDamage - lastValues.reduce((sum, value) => sum + value, 0),
        total: lastDamage,
        label: `${monsterAttack.monster.name}·${monsterAttack.action.name}（${monsterAttack.monster.source}）`,
        targetName: targetChar.name,
        d20Roll: lastEvent ? {
          value: lastEvent.d20,
          modifier: lastAttack.toHit,
          ac: lastEvent.armorClass,
          hit: lastEvent.hit,
        } : undefined,
      }
      setRoll(display)
      publishSharedDiceRoll(display)
      return true
    }

    if (targetChar && hasEnemyDamage) {
      const damageType = result.damageType ?? 'physical'
      if (await tryResolveSrd5eMonsterAttack()) {
        return
      }
      pushCombatLog(`${result.attack?.label ?? '敌人攻击'} 未能通过 D&D 5e Headless 引擎验证，已取消结算（${damageType}）。`, 'turn')
      return
    } else if (result.targetCharacterId != null && hasEnemyDamage) {
      pushCombatLog(`${result.attack?.label ?? '敌人攻击'} 缺少可验证目标 token，已取消结算。`, 'turn')
      return
    } else if (!targetChar && hasEnemyDamage) {
      pushCombatLog(`${result.attack?.label ?? '敌人攻击'} 缺少绑定角色，已取消结算。`, 'turn')
      return
    }
  }

  const finishSharedCombatInterruptEvent = useEffectEvent(
    (...args: Parameters<typeof finishSharedCombatInterrupt>) => finishSharedCombatInterrupt(...args),
  )
  const settleSharedCombatInterruptEvent = useEffectEvent(
    (...args: Parameters<typeof settleSharedCombatInterrupt>) => settleSharedCombatInterrupt(...args),
  )
  const waitSharedCombatInterruptForDmEvent = useEffectEvent(
    (...args: Parameters<typeof waitSharedCombatInterruptForDm>) => waitSharedCombatInterruptForDm(...args),
  )

  useEffect(() => {
    if (!activeMapId) return
    let cancelled = false
    const load = async () => {
      const queue = await loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)
      if (cancelled || !queue || queue.mapId !== activeMapId) return
      const latestActiveMap = useMapStore.getState().maps.find((map) => map.id === activeMapId)
      if (!latestActiveMap) return
      const now = runtimeNow()

      for (const [interruptId, pending] of pendingD20ConfirmationsRef.current) {
        const interrupt = queue.interrupts.find((candidate) =>
          candidate.id === interruptId && isCombatInterruptKind(candidate, 'roll-confirmation'),
        )
        if (
          !interrupt || !isCombatInterruptKind(interrupt, 'roll-confirmation') ||
          (interrupt.status !== 'answered' && interrupt.status !== 'done' && interrupt.status !== 'rolled-back')
        ) continue
        pendingD20ConfirmationsRef.current.delete(interruptId)
        pending.resolve(resolvedD20Value(interrupt.response, pending.originalValue))
        if (isDM && interrupt.status === 'answered') {
          await finishSharedCombatInterruptEvent(interrupt.id, interrupt.response)
        }
      }

      const activeRollConfirmation = queue.interrupts
        .filter((interrupt): interrupt is CombatInterruptByKind<'roll-confirmation'> =>
          isCombatInterruptKind(interrupt, 'roll-confirmation') &&
          (interrupt.status === 'pending' || interrupt.status === 'waiting-for-dm') &&
          (isDM || interrupt.payload.visibility === 'public'),
        )
        .sort((left, right) => left.createdAt - right.createdAt)[0]
      setSharedRollConfirmationPrompt((current) => {
        if (!activeRollConfirmation) return current ? null : current
        return activeRollConfirmation
      })

      if (isDM) {
        for (const interrupt of queue.interrupts) {
          if (!isCombatInterruptExpired(interrupt, now)) continue
          await persistRollbackSharedCombatInterrupt({
            loadSharedResource,
            saveSharedResource,
            mutateSharedCombatInterrupt,
            mapId: activeMapId,
            id: interrupt.id,
            response: defaultCombatInterruptResponse(interrupt.kind) as Record<string, unknown>,
            reason: 'timeout',
          })
        }
        const pendingPluginChoice = pendingSharedPluginChoiceRef.current
        if (pendingPluginChoice) {
          const interrupt = queue.interrupts.find((candidate) =>
            candidate.id === pendingPluginChoice.id && isCombatInterruptKind(candidate, 'plugin-choice'),
          )
          if (
            interrupt && isCombatInterruptKind(interrupt, 'plugin-choice') &&
            (interrupt.status === 'answered' || interrupt.status === 'done' || interrupt.status === 'rolled-back')
          ) {
            const requested = interrupt.response?.optionId
            const optionId = requested && interrupt.payload.options.some((option) => option.id === requested)
              ? requested
              : interrupt.payload.defaultOptionId
            pendingSharedPluginChoiceRef.current = null
            setSharedPluginChoicePrompt(null)
            if (interrupt.status === 'answered') {
              await finishSharedCombatInterruptEvent(interrupt.id, { optionId })
            }
            pendingPluginChoice.resolve(optionId)
          }
        }
        const dmPluginChoiceInterrupt = queue.interrupts.find((interrupt) =>
          isCombatInterruptKind(interrupt, 'plugin-choice') &&
          interrupt.payload.audience === 'dm' &&
          interrupt.status === 'pending' &&
          !suppressedPluginChoicePromptIdsRef.current.has(interrupt.id) &&
          !isCombatInterruptExpired(interrupt, now),
        )
        if (dmPluginChoiceInterrupt && isCombatInterruptKind(dmPluginChoiceInterrupt, 'plugin-choice')) {
          const characterId = dmPluginChoiceInterrupt.actorCharId
          setSharedPluginChoicePrompt({
            id: dmPluginChoiceInterrupt.id,
            character: characters.find((character) => character.id === characterId),
            payload: dmPluginChoiceInterrupt.payload,
            expiresAt: dmPluginChoiceInterrupt.expiresAt,
          })
        } else if (!pendingPluginChoice) {
          setNullablePromptView(setSharedPluginChoicePrompt, undefined)
        }
        const dmAdjudicationInterrupt = queue.interrupts.find((interrupt) =>
          isCombatInterruptKind(interrupt, 'dm-adjudication') &&
          (interrupt.status === 'pending' || interrupt.status === 'waiting-for-dm') &&
          !suppressedDmAdjudicationPromptIdsRef.current.has(interrupt.id),
        )
        if (dmAdjudicationInterrupt && isCombatInterruptKind(dmAdjudicationInterrupt, 'dm-adjudication')) {
          if (shouldCombatInterruptWaitForDm(dmAdjudicationInterrupt, now)) {
            await waitSharedCombatInterruptForDmEvent(dmAdjudicationInterrupt.id)
          }
          if (sharedDmAdjudicationPromptIdRef.current !== dmAdjudicationInterrupt.id) {
            sharedDmAdjudicationPromptIdRef.current = dmAdjudicationInterrupt.id
            setSharedDmAdjudicationPrompt({
              id: dmAdjudicationInterrupt.id,
              actorCharId: dmAdjudicationInterrupt.actorCharId,
              payload: dmAdjudicationInterrupt.payload,
              expiresAt: dmAdjudicationInterrupt.expiresAt,
            })
            const proposedTargetId = dmAdjudicationInterrupt.payload.targetTokenId
            const proposedDamage = dmAdjudicationInterrupt.payload.proposedDamage
            const proposedCondition = dmAdjudicationInterrupt.payload.proposedConditionIds?.[0]
            setDmAdjudicationEffects(
              dmAdjudicationInterrupt.payload.contextKind === 'persistent-area-trigger' && proposedTargetId
                ? [{
                    id: runtimeId('adjudication-effect'),
                    targetTokenId: proposedTargetId,
                    operation: proposedDamage != null ? 'damage' : '',
                    amount: proposedDamage != null ? String(proposedDamage) : '',
                    addCondition: proposedCondition ?? '',
                    removeCondition: '',
                  }]
                : [],
            )
            setDmAdjudicationNote('')
            setDmAdjudicationSaveOverride('unchanged')
            setDmAdjudicationDc(dmAdjudicationInterrupt.payload.proposedDc?.toString() ?? '')
            setDmAdjudicationMapOverride('roll')
            setDmAdjudicationConcentrationRounds(
              dmAdjudicationInterrupt.payload.suggestedConcentrationRounds?.toString() ?? '',
            )
          }
        } else if (sharedDmAdjudicationPromptIdRef.current) {
          sharedDmAdjudicationPromptIdRef.current = null
          setSharedDmAdjudicationPrompt(null)
        }
        const dmReactionViews = buildDmControlledCombatInterruptPromptViews({
          queue,
          mapId: activeMapId,
          now,
          characters,
          tokens: latestActiveMap.tokens,
          suppressed: {
            'opportunity-attack': suppressedOpportunityAttackPromptIdsRef.current,
            protection: suppressedProtectionPromptIdsRef.current,
            'shield-spell': suppressedShieldSpellPromptIdsRef.current,
            counterspell: suppressedCounterspellPromptIdsRef.current,
            'uncanny-dodge': suppressedUncannyDodgePromptIdsRef.current,
            'deflect-missiles': suppressedDeflectMissilesPromptIdsRef.current,
            'saving-throw-reroll': suppressedSavingThrowRerollPromptIdsRef.current,
            'bardic-inspiration': suppressedBardicInspirationPromptIdsRef.current,
            'cutting-words': suppressedCuttingWordsPromptIdsRef.current,
            'dark-ones-own-luck': suppressedDarkOnesOwnLuckPromptIdsRef.current,
            'stroke-of-luck': suppressedStrokeOfLuckPromptIdsRef.current,
            'empowered-spell': suppressedEmpoweredSpellPromptIdsRef.current,
            'stand-against-tide': suppressedStandAgainstTidePromptIdsRef.current,
          },
        })
        setNullablePromptView(setSharedOpportunityAttackPrompt, dmReactionViews.opportunityAttack)
        setNullablePromptView(setSharedProtectionPrompt, dmReactionViews.protection)
        setNullablePromptView(setSharedShieldSpellPrompt, dmReactionViews.shieldSpell)
        setNullablePromptView(setSharedCounterspellPrompt, dmReactionViews.counterspell)
        setNullablePromptView(setSharedUncannyDodgePrompt, dmReactionViews.uncannyDodge)
        setNullablePromptView(setSharedDeflectMissilesPrompt, dmReactionViews.deflectMissiles)
        setNullablePromptView(setSharedSavingThrowRerollPrompt, dmReactionViews.savingThrowReroll)
        setNullablePromptView(setSharedBardicInspirationPrompt, dmReactionViews.bardicInspiration)
        setNullablePromptView(setSharedCuttingWordsPrompt, dmReactionViews.cuttingWords)
        setNullablePromptView(setSharedDarkOnesOwnLuckPrompt, dmReactionViews.darkOnesOwnLuck)
        setNullablePromptView(setSharedStrokeOfLuckPrompt, dmReactionViews.strokeOfLuck)
        setSharedEmpoweredSpellPrompt((current) => {
          if (dmReactionViews.empoweredSpell?.id !== current?.id) setSharedEmpoweredSpellSelection([])
          return dmReactionViews.empoweredSpell ?? null
        })
        setNullablePromptView(setSharedStandAgainstTidePrompt, dmReactionViews.standAgainstTide)
        const settlements = resolveDmCombatInterruptSettlements({
          queue,
          mapId: activeMapId,
          now,
          pending: {
            opportunityAttack: pendingSharedOpportunityAttackRef.current?.id,
            protection: pendingSharedProtectionRef.current?.id,
            shieldSpell: pendingSharedShieldSpellRef.current?.id,
            counterspell: pendingSharedCounterspellRef.current?.id,
            uncannyDodge: pendingSharedUncannyDodgeRef.current?.id,
            deflectMissiles: pendingSharedDeflectMissilesRef.current?.id,
            savingThrowReroll: pendingSharedSavingThrowRerollRef.current?.id,
            bardicInspiration: pendingSharedBardicInspirationRef.current?.id,
            cuttingWords: pendingSharedCuttingWordsRef.current?.id,
            darkOnesOwnLuck: pendingSharedDarkOnesOwnLuckRef.current?.id,
            strokeOfLuck: pendingSharedStrokeOfLuckRef.current?.id,
            empoweredSpell: pendingSharedEmpoweredSpellRef.current?.id,
            standAgainstTide: pendingSharedStandAgainstTideRef.current?.id,
            dmAdjudication: pendingSharedDmAdjudicationRef.current?.id,
          },
        })
        await applyDmCombatInterruptSettlements({
          settlements,
          channels: {
            opportunityAttack: pendingSharedOpportunityAttackRef,
            protection: pendingSharedProtectionRef,
            shieldSpell: pendingSharedShieldSpellRef,
            counterspell: pendingSharedCounterspellRef,
            uncannyDodge: pendingSharedUncannyDodgeRef,
            deflectMissiles: pendingSharedDeflectMissilesRef,
            savingThrowReroll: pendingSharedSavingThrowRerollRef,
            bardicInspiration: pendingSharedBardicInspirationRef,
            cuttingWords: pendingSharedCuttingWordsRef,
            darkOnesOwnLuck: pendingSharedDarkOnesOwnLuckRef,
            strokeOfLuck: pendingSharedStrokeOfLuckRef,
            empoweredSpell: pendingSharedEmpoweredSpellRef,
            standAgainstTide: pendingSharedStandAgainstTideRef,
            dmAdjudication: pendingSharedDmAdjudicationRef,
          },
          settle: (settlement) => settleSharedCombatInterruptEvent(
            settlement.id,
            settlement.finishResponse,
            settlement.reason,
          ),
          clearDmAdjudicationPrompt: () => {
            sharedDmAdjudicationPromptIdRef.current = null
            setSharedDmAdjudicationPrompt(null)
          },
        })
        return
      }

      const answerContext = {
        characters,
        visibleCharacters: isDM ? [] : playerViewCharacters(characters, {
          slot: playerSlot,
          assignedCharacterId,
        }),
        playerCharId: playerChar?.id,
        assignedCharacterId,
        tokens: latestActiveMap.tokens,
        authority: 'player' as const,
      }
      const selection = resolveCombatInterruptPromptSelection({
        queue,
        mapId: activeMapId,
        now,
        answerContext,
        suppressed: {
          'opportunity-attack': suppressedOpportunityAttackPromptIdsRef.current,
          protection: suppressedProtectionPromptIdsRef.current,
          'shield-spell': suppressedShieldSpellPromptIdsRef.current,
          counterspell: suppressedCounterspellPromptIdsRef.current,
          'uncanny-dodge': suppressedUncannyDodgePromptIdsRef.current,
          'deflect-missiles': suppressedDeflectMissilesPromptIdsRef.current,
          'saving-throw-reroll': suppressedSavingThrowRerollPromptIdsRef.current,
          'bardic-inspiration': suppressedBardicInspirationPromptIdsRef.current,
          'cutting-words': suppressedCuttingWordsPromptIdsRef.current,
          'dark-ones-own-luck': suppressedDarkOnesOwnLuckPromptIdsRef.current,
          'stroke-of-luck': suppressedStrokeOfLuckPromptIdsRef.current,
          'empowered-spell': suppressedEmpoweredSpellPromptIdsRef.current,
          'stand-against-tide': suppressedStandAgainstTidePromptIdsRef.current,
          'plugin-choice': suppressedPluginChoicePromptIdsRef.current,
        },
      })
      const views = buildCombatInterruptPromptViews(selection)

      setNullablePromptView(setSharedOpportunityAttackPrompt, views.opportunityAttack)
      setNullablePromptView(setSharedProtectionPrompt, views.protection)
      setNullablePromptView(setSharedShieldSpellPrompt, views.shieldSpell)
      setNullablePromptView(setSharedCounterspellPrompt, views.counterspell)
      setNullablePromptView(setSharedUncannyDodgePrompt, views.uncannyDodge)
      setNullablePromptView(setSharedDeflectMissilesPrompt, views.deflectMissiles)
      setNullablePromptView(setSharedSavingThrowRerollPrompt, views.savingThrowReroll)
      setNullablePromptView(setSharedBardicInspirationPrompt, views.bardicInspiration)
      setNullablePromptView(setSharedCuttingWordsPrompt, views.cuttingWords)
      setNullablePromptView(setSharedDarkOnesOwnLuckPrompt, views.darkOnesOwnLuck)
      setNullablePromptView(setSharedStrokeOfLuckPrompt, views.strokeOfLuck)
      setSharedEmpoweredSpellPrompt((current) => {
        if (views.empoweredSpell?.id !== current?.id) setSharedEmpoweredSpellSelection([])
        return views.empoweredSpell ?? null
      })
      setNullablePromptView(setSharedStandAgainstTidePrompt, views.standAgainstTide)
      setNullablePromptView(setSharedPluginChoicePrompt, views.pluginChoice)
    }
    const unsubscribe = subscribeSharedResourceInvalidation(COMBAT_INTERRUPT_RESOURCE, load, {
      // Interrupts expire after 15 seconds. Recover quickly enough to present the
      // prompt when an SSE notification is lost, without returning to polling.
      recoveryMs: 3_000,
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [activeMapId, assignedCharacterId, isDM, characters, playerChar?.id, playerSlot])

  const applyEnemyAttack = (result: EnemyTurnResult, onComplete: () => void) => {
    if (!activeMap || !result.attacked || !result.targetTokenId) {
      onComplete()
      return
    }
    const completeIfCombatContinues = () => {
      if (hasCombatOutcomeNow()) return
      onComplete()
    }

    const chars = useCharacterStore.getState().characters
    const targetToken = activeMap.tokens.find((t) => t.id === result.targetTokenId)
    const attackerToken = result.attackerTokenId
      ? activeMap.tokens.find((token) => token.id === result.attackerTokenId)
      : undefined
    const isDnd5eMonsterAttack = !!(attackerToken?.poolId && getDnd5eSrdMonster(attackerToken.poolId))
    const targetChar = resolveAttackTargetCharacter(targetToken, chars, result.targetCharacterId)
    const targetAlive =
      !targetChar ||
      targetChar.currentHp > 0
    if (targetChar && !targetAlive) {
      completeIfCombatContinues()
      return
    }
    if (!isDnd5eMonsterAttack) {
      pushCombatLog(`${attackerToken?.label ?? '敌人'} 没有通过 D&D 5e 怪物 schema 校验，已拒绝旧规则攻击。`, 'system')
      completeIfCombatContinues()
      return
    }

    void finishEnemyAttack(result, targetChar).then(completeIfCombatContinues)
  }

  const handleSharedOpportunityAttackChoice = async (useOpportunityAttack: boolean) => {
    if (!sharedOpportunityAttackPrompt || !activeMap) return
    const prompt = sharedOpportunityAttackPrompt
    suppressedOpportunityAttackPromptIdsRef.current.add(prompt.id)
    setSharedOpportunityAttackPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useOpportunityAttack })
  }

  const handleSharedProtectionChoice = async (useProtection: boolean) => {
    if (!sharedProtectionPrompt || !activeMap) return
    const prompt = sharedProtectionPrompt
    suppressedProtectionPromptIdsRef.current.add(prompt.id)
    setSharedProtectionPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useProtection })
  }

  const handleSharedShieldSpellChoice = async (useShieldSpell: boolean) => {
    if (!sharedShieldSpellPrompt || !activeMap) return
    const prompt = sharedShieldSpellPrompt
    suppressedShieldSpellPromptIdsRef.current.add(prompt.id)
    setSharedShieldSpellPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useShieldSpell })
  }

  const handleSharedCounterspellChoice = async (useCounterspell: boolean) => {
    if (!sharedCounterspellPrompt || !activeMap) return
    const prompt = sharedCounterspellPrompt
    suppressedCounterspellPromptIdsRef.current.add(prompt.id)
    setSharedCounterspellPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useCounterspell })
  }

  const handleSharedUncannyDodgeChoice = async (useUncannyDodge: boolean) => {
    if (!sharedUncannyDodgePrompt || !activeMap) return
    const prompt = sharedUncannyDodgePrompt
    suppressedUncannyDodgePromptIdsRef.current.add(prompt.id)
    setSharedUncannyDodgePrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useUncannyDodge })
  }

  const handleSharedDeflectMissilesChoice = async (accept: boolean) => {
    if (!sharedDeflectMissilesPrompt || !activeMap) return
    const prompt = sharedDeflectMissilesPrompt
    suppressedDeflectMissilesPromptIdsRef.current.add(prompt.id)
    setSharedDeflectMissilesPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { accept })
  }

  const handleSharedSavingThrowRerollChoice = async (useSavingThrowReroll: boolean) => {
    if (!sharedSavingThrowRerollPrompt || !activeMap) return
    const prompt = sharedSavingThrowRerollPrompt
    suppressedSavingThrowRerollPromptIdsRef.current.add(prompt.id)
    setSharedSavingThrowRerollPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useSavingThrowReroll })
  }

  const handleSharedBardicInspirationChoice = async (useBardicInspiration: boolean) => {
    if (!sharedBardicInspirationPrompt || !activeMap) return
    const prompt = sharedBardicInspirationPrompt
    suppressedBardicInspirationPromptIdsRef.current.add(prompt.id)
    setSharedBardicInspirationPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useBardicInspiration })
  }

  const handleSharedCuttingWordsChoice = async (useCuttingWords: boolean) => {
    if (!sharedCuttingWordsPrompt || !activeMap) return
    const prompt = sharedCuttingWordsPrompt
    suppressedCuttingWordsPromptIdsRef.current.add(prompt.id)
    setSharedCuttingWordsPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useCuttingWords })
  }

  const handleSharedDarkOnesOwnLuckChoice = async (useDarkOnesOwnLuck: boolean) => {
    if (!sharedDarkOnesOwnLuckPrompt || !activeMap) return
    const prompt = sharedDarkOnesOwnLuckPrompt
    suppressedDarkOnesOwnLuckPromptIdsRef.current.add(prompt.id)
    setSharedDarkOnesOwnLuckPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useDarkOnesOwnLuck })
  }

  const handleSharedStrokeOfLuckChoice = async (useStrokeOfLuck: boolean) => {
    if (!sharedStrokeOfLuckPrompt || !activeMap) return
    const prompt = sharedStrokeOfLuckPrompt
    suppressedStrokeOfLuckPromptIdsRef.current.add(prompt.id)
    setSharedStrokeOfLuckPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useStrokeOfLuck })
  }

  const handleSharedEmpoweredSpellChoice = async (rerollKeys: string[]) => {
    if (!sharedEmpoweredSpellPrompt || !activeMap) return
    const prompt = sharedEmpoweredSpellPrompt
    const availableKeys = new Set(prompt.groups.flatMap((group) =>
      group.rolls.map((_, dieIndex) => `${group.key}:${dieIndex}`),
    ))
    const sanitized = [...new Set(rerollKeys)]
      .filter((key) => availableKeys.has(key))
      .slice(0, prompt.maximumDice)
    suppressedEmpoweredSpellPromptIdsRef.current.add(prompt.id)
    setSharedEmpoweredSpellPrompt(null)
    setSharedEmpoweredSpellSelection([])
    await answerSharedCombatInterrupt(prompt.id, { rerollKeys: sanitized })
  }

  const handleSharedStandAgainstTideChoice = async (targetTokenId?: string) => {
    if (!sharedStandAgainstTidePrompt || !activeMap) return
    const prompt = sharedStandAgainstTidePrompt
    const validTargetId = targetTokenId && prompt.candidates.some((candidate) => candidate.tokenId === targetTokenId)
      ? targetTokenId
      : undefined
    suppressedStandAgainstTidePromptIdsRef.current.add(prompt.id)
    setSharedStandAgainstTidePrompt(null)
    await answerSharedCombatInterrupt(prompt.id, validTargetId ? { targetTokenId: validTargetId } : {})
  }

  const handleSharedPluginChoice = async (optionId: string) => {
    if (!sharedPluginChoicePrompt || !activeMap) return
    const prompt = sharedPluginChoicePrompt
    const validOptionId = prompt.payload.options.some((option) => option.id === optionId)
      ? optionId
      : prompt.payload.defaultOptionId
    suppressedPluginChoicePromptIdsRef.current.add(prompt.id)
    setSharedPluginChoicePrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { optionId: validOptionId })
  }

  const handleSharedDmAdjudicationChoice = async (approved: boolean) => {
    if (!sharedDmAdjudicationPrompt || !activeMap) return
    const prompt = sharedDmAdjudicationPrompt
    const effects: DmAdjudicationEffect[] = []
    if (approved) {
      for (const draft of dmAdjudicationEffects) {
        const target = activeMap.tokens.find((token) => token.id === draft.targetTokenId && token.type !== 'obstacle')
        const addCondition = draft.addCondition.trim()
        const removeCondition = draft.removeCondition.trim()
        if (!target || (!draft.operation && !addCondition && !removeCondition)) return
        const amount = draft.operation ? Number(draft.amount) : undefined
        if (draft.operation && (!Number.isInteger(amount) || amount! < 0 || amount! > 1_000_000)) return
        effects.push({
          targetTokenId: target.id,
          ...(draft.operation ? { operation: draft.operation, amount } : {}),
          ...(addCondition ? { addCondition } : {}),
          ...(removeCondition ? { removeCondition } : {}),
        })
      }
    }
    const concentrationRounds = approved && prompt.payload.concentration && dmAdjudicationConcentrationRounds
      ? Number(dmAdjudicationConcentrationRounds)
      : undefined
    if (
      concentrationRounds != null &&
      (!Number.isInteger(concentrationRounds) || concentrationRounds < 1 || concentrationRounds > 14_400)
    ) return
    const adjustedDc = approved && prompt.payload.contextKind === 'map-interaction' && dmAdjudicationDc
      ? Number(dmAdjudicationDc)
      : undefined
    if (adjustedDc != null && (!Number.isInteger(adjustedDc) || adjustedDc < 0 || adjustedDc > 100)) return
    suppressedDmAdjudicationPromptIdsRef.current.add(prompt.id)
    sharedDmAdjudicationPromptIdRef.current = null
    setSharedDmAdjudicationPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, approved
      ? {
          decision: 'approved',
          effects,
          ...(dmAdjudicationNote.trim() ? { note: dmAdjudicationNote.trim().slice(0, 2_000) } : {}),
          ...(concentrationRounds != null ? { concentrationRounds } : {}),
          ...(dmAdjudicationSaveOverride !== 'unchanged'
            ? { saveSuccessOverride: dmAdjudicationSaveOverride === 'success' }
            : {}),
          ...(adjustedDc != null ? { adjustedDc } : {}),
          ...(prompt.payload.contextKind === 'map-interaction'
            ? { mapInteractionOverride: dmAdjudicationMapOverride }
            : {}),
        } satisfies DmAdjudicationInterruptResponse
      : {
          decision: 'cancelled',
          effects: [],
          ...(dmAdjudicationNote.trim() ? { note: dmAdjudicationNote.trim().slice(0, 2_000) } : {}),
        } satisfies DmAdjudicationInterruptResponse)
  }

  const handleD20ReplacementContribution = async (input: {
    featureLabel: string
    replacementValue: number
  }) => {
    if (!sharedRollConfirmationPrompt || isDM || !playerChar) return
    try {
      await contributeSharedCombatInterrupt(
        sharedRollConfirmationPrompt.id,
        createD20ReplacementContribution({
          interruptId: sharedRollConfirmationPrompt.id,
          characterId: playerChar.id,
          characterName: playerChar.name,
          featureLabel: input.featureLabel,
          replacementValue: input.replacementValue,
          now: runtimeNow(),
        }),
      )
    } catch {
      await showCombatNotice('声明提交失败', '这次投掷可能已经由 DM 放行，请查看最新战斗记录。', 'amber')
    }
  }

  const handleD20RollContinue = async (acceptedContributionId?: string) => {
    if (!sharedRollConfirmationPrompt || !isDM || settlingRollConfirmation) return
    const prompt = sharedRollConfirmationPrompt
    setSettlingRollConfirmation(true)
    try {
      const response = settleD20RollConfirmation(prompt, acceptedContributionId, runtimeNow())
      await answerSharedCombatInterrupt(prompt.id, response as Record<string, unknown>)
      await finishSharedCombatInterrupt(prompt.id, response as Record<string, unknown>)
      const accepted = response.acceptedContributionId
        ? prompt.contributions?.find((entry) => entry.id === response.acceptedContributionId)
        : undefined
      pushCombatLog(
        accepted
          ? `${prompt.payload.label}：d20 ${prompt.payload.originalValue} 被 ${accepted.characterName} 的「${accepted.featureLabel}」替换为 ${response.finalValue}，DM 已确认继续。`
          : `${prompt.payload.label}：保留 d20 ${response.finalValue}，DM 已确认继续。`,
        'system',
        roundRef.current,
        accepted
          ? [`原始结果：${prompt.payload.originalValue}`, `采用结果：${response.finalValue}`, `来源：${accepted.characterName} · ${accepted.featureLabel}`, '事务状态：已提交']
          : [`原始结果：${prompt.payload.originalValue}`, '未采用玩家替换声明', '事务状态：已提交'],
      )
      const pending = pendingD20ConfirmationsRef.current.get(prompt.id)
      if (pending) {
        pendingD20ConfirmationsRef.current.delete(prompt.id)
        pending.resolve(resolvedD20Value(response, pending.originalValue))
      }
      setSharedRollConfirmationPrompt(null)
    } catch {
      await showCombatNotice('无法继续结算', '确认事务未能提交，投掷仍保持暂停，请重试。', 'rose')
    } finally {
      setSettlingRollConfirmation(false)
    }
  }

  const settleDnd5eMonsterEndTurn = async (enemy: Token): Promise<boolean> => {
    if (!activeMap || dnd5eMonsterEndTurnSettlingRef.current) return false
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const latestEnemy = latestMap.tokens.find((token) => token.id === enemy.id)
    if (!latestEnemy?.poolId || !getDnd5eSrdMonster(latestEnemy.poolId)) return false
    dnd5eMonsterEndTurnSettlingRef.current = true
    try {
      playerActionSeqRef.current += 1
      const action: SharedPlayerActionState = {
        id: `dm-monster-end-${combatIdRef.current}-${roundRef.current}-${latestEnemy.id}-${playerActionSeqRef.current}`,
        mapId: latestMap.id,
        combatId: combatIdRef.current,
        sourceMode: 'dm',
        status: 'pending',
        type: 'end-turn',
        actorTokenId: latestEnemy.id,
        characterId: '',
        round: roundRef.current,
        initiativeIndex: initiativeIndexRef.current,
        seq: playerActionSeqRef.current,
        updatedAt: runtimeNow(),
      }
      const characters = useCharacterStore.getState().characters
      const prepared = prepareDnd5ePlayerEndTurn({
        action,
        map: latestMap,
        characters,
        initiativeOrder: initiativeOrderRef.current,
      })
      if (!prepared.ok) return false
      const activeEffectSavingThrows: Dnd5eActiveEffectSavingThrowRoll[] = []
      for (const requirement of prepared.prepared.activeEffectSavingThrows) {
        const effectName = requirement.effect.label || '持续状态'
        const d20 = await rollDiceBoxD20(`${effectName}·回合结束豁免`, latestEnemy.label)
        const d20Second = requirement.mode !== 'normal'
          ? await rollDiceBoxD20(`${effectName}·回合结束豁免（${requirement.mode === 'advantage' ? '优势' : '劣势'}）`, latestEnemy.label)
          : undefined
        const blessRoll = requirement.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', latestEnemy.label))[0]
          : undefined
        const baneRoll = requirement.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', latestEnemy.label))[0]
          : undefined
        activeEffectSavingThrows.push({ effectId: requirement.effect.id, d20, d20Second, blessRoll, baneRoll })
      }
      const turnStartActiveEffectSavingThrows: Dnd5eActiveEffectSavingThrowRoll[] = []
      for (const requirement of prepared.prepared.turnStartActiveEffectSavingThrows) {
        const effectName = requirement.effect.label || '持续状态'
        const d20 = await rollDiceBoxD20(`${effectName}·回合开始豁免`, requirement.targetName)
        const d20Second = requirement.mode !== 'normal'
          ? await rollDiceBoxD20(`${effectName}·回合开始豁免（${requirement.mode === 'advantage' ? '优势' : '劣势'}）`, requirement.targetName)
          : undefined
        const blessRoll = requirement.blessed ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', requirement.targetName))[0] : undefined
        const baneRoll = requirement.baned ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', requirement.targetName))[0] : undefined
        turnStartActiveEffectSavingThrows.push({ effectId: requirement.effect.id, d20, d20Second, blessRoll, baneRoll })
      }
      const nextMonsterRechargeRolls = [] as Array<{ actorId: string; actionId: string; roll: number }>
      for (const requirement of prepared.prepared.nextMonsterRechargeRolls) {
        const roll = (await rollDiceBoxValues(
          1,
          requirement.dieSides,
          `${requirement.actionName}·充能（${requirement.minimum}–${requirement.dieSides}）`,
          requirement.actorName,
        ))[0]
        nextMonsterRechargeRolls.push({ actorId: requirement.actorId, actionId: requirement.actionId, roll })
      }
      const resolved = resolveDnd5ePlayerEndTurn({
        action,
        map: latestMap,
        characters,
        initiativeOrder: initiativeOrderRef.current,
        activeEffectSavingThrows,
        turnStartActiveEffectSavingThrows,
        nextMonsterRechargeRolls,
      })
      if (!resolved.ok || !resolved.result.ok) return false
      const settled = await settleDnd5eConcentrationChecks({
        result: resolved.result,
        map: latestMap,
        characters,
        characterIdByCombatantId: Object.fromEntries(
          latestMap.tokens.flatMap((token) => token.characterId ? [[token.id, token.characterId]] : []),
        ),
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      applyDnd5eCombatApplication(settled.application)
      applyDnd5eTurnAdvance(settled.result.state, roundRef.current)
      for (const save of settled.result.events.filter((event) => event.type === 'saving-throw-resolved')) {
        if (save.type !== 'saving-throw-resolved') continue
        pushCombatLog(
          `${latestEnemy.label} 的回合结束豁免 ${save.total} vs DC ${save.dc}：${save.success ? '成功，相关状态结束' : '失败，状态继续'}。`,
          'system',
        )
      }
      return true
    } finally {
      dnd5eMonsterEndTurnSettlingRef.current = false
    }
  }

  const scheduleEnemyTurn = async (enemy: Token) => {
    if (!activeMap) return
    const enemyTurnKey = `${round}-${initiativeIndex}-${enemy.id}`
    // Capture the round this turn was scheduled in. A long second-strike timer
    // (DICE_ROLL_MS + 5000) can outlive nextRound(); without this check a stale strike
    // that fires after the round wrapped to index 0 onto the SAME enemy token would pass
    // the token-identity check and double-advance. (nextRound() also clears pending timers.)
    const scheduledRound = roundRef.current
    const isStillEnemyTurn = () => {
      if (!combatActive) return false
      if (!usesAutomatedMonsterSettlement(settlementModeRef.current)) return false
      if (roundRef.current !== scheduledRound) return false
      const current = initiativeOrderRef.current[initiativeIndexRef.current]
      return current?.tokenId === enemy.id
    }
    if (!isStillEnemyTurn()) return
    const chars = useCharacterStore.getState().characters
    const missingLinkedCharacter = activeMap.tokens.some(
      (token) =>
        token.type === 'player' &&
        !!token.characterId &&
        !chars.some((character) => character.id === token.characterId),
    )
    if (missingLinkedCharacter) {
      const id = window.setTimeout(() => {
        if (isStillEnemyTurn()) void scheduleEnemyTurn(enemy)
      }, 100)
      enemyTurnTimersRef.current.add(id)
      return
    }
    let endingTurn = false
    const advanceEnemyIfCurrent = async () => {
      const current = initiativeOrderRef.current[initiativeIndexRef.current]
      if (!current || current.tokenId !== enemy.id) return
      if (!enemyAppliedKeysRef.current.has(enemyTurnKey)) return
      if (roundRef.current !== scheduledRound) return
      if (endingTurn) return
      endingTurn = true
      await settleDnd5eMonsterEndTurn(enemy)
      return
    }
    const isDnd5eEnemy = !!(enemy.poolId && getDnd5eSrdMonster(enemy.poolId))
    if (!isDnd5eEnemy) {
      pushCombatLog(`${enemy.label} 没有可用的 D&D 5e 怪物数据块，本回合跳过。`, 'system')
      const id = window.setTimeout(() => { void advanceEnemyIfCurrent() }, 300)
      enemyTurnTimersRef.current.add(id)
      return
    }
    const result = planDnd5eMonsterTurn(activeMap, enemy)
    if (result.newPosition && !isTokenMovementLocked(enemy)) {
      // a restrained/no-move enemy may still attack but cannot reposition.
      if (!isStillEnemyTurn()) return
      await resolveDnd5eOpportunityAttacksForMove(enemy, result.newPosition)
      if (!isStillEnemyTurn()) return
      const latestMap = useMapStore.getState().maps.find((m) => m.id === activeMap.id)
      const latestEnemy = latestMap?.tokens.find((t) => t.id === enemy.id) ?? enemy
      if (!isTokenAlive(latestEnemy, useCharacterStore.getState().characters)) {
        const id = window.setTimeout(() => { void advanceEnemyIfCurrent() }, ADVANCE_DELAY_MS)
        enemyTurnTimersRef.current.add(id)
        return
      }
      const moved = await resolveSrd5eMonsterMoveThroughHeadless(latestEnemy, result.newPosition, { dash: result.dashed })
      if (!moved) {
        const id = window.setTimeout(() => { void advanceEnemyIfCurrent() }, 300)
        enemyTurnTimersRef.current.add(id)
        return
      }
    }

    const pushTimer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      enemyTurnTimersRef.current.add(id)
    }

    if (!result.attacked) {
      pushTimer(() => { void advanceEnemyIfCurrent() }, result.moved ? TOKEN_MOVE_MS : 400)
      return
    }

    const attack = () => {
      if (!isStillEnemyTurn()) return
      applyEnemyAttack(result, () => {
        pushTimer(() => { void advanceEnemyIfCurrent() }, ADVANCE_DELAY_MS)
      })
    }

    if (result.moved) {
      pushTimer(attack, TOKEN_MOVE_MS)
    } else {
      attack()
    }
  }

  const advanceInitiativeCore = () => {
    const order = initiativeOrderRef.current
    if (order.length === 0 || !activeMap) return
    const idx = initiativeIndexRef.current
    const current = order[idx] ?? order[0]
    if (!current) {
      setInitiativeIndex(0)
      initiativeIndexRef.current = 0
      return
    }
    const previousRound = roundRef.current
    const nextIndex = (idx + 1) % order.length
    const nextRound = nextIndex === 0 ? previousRound + 1 : previousRound
    initiativeIndexRef.current = nextIndex
    roundRef.current = nextRound
    setInitiativeIndex(nextIndex)
    setRound(nextRound)
    const nextTokenId = order[nextIndex]?.tokenId
    if (nextTokenId) {
      updateDnd5eTurnEconomy(nextTokenId, () => createDnd5eTurnEconomyCounts(`${nextRound}:${nextTokenId}`), nextRound)
    }
    if (nextRound > previousRound) {
      pushCombatLog(`进入第 ${nextRound} 回合`, 'turn', nextRound)
      setInitiativeScroll(0)
    }
    void publishCombatState({
      active: true,
      round: nextRound,
      initiativeIndex: nextIndex,
      initiativeOrder: order,
    })
  }

  const tokenIsStillSurprised = useCallback((token: Token): boolean => {
    const character = token.characterId
      ? useCharacterStore.getState().characters.find((candidate) => candidate.id === token.characterId)
      : undefined
    const state = character?.dnd5eCombatState ?? token.dnd5eCombatState
    return state?.surprisedCombatId === combatIdRef.current && state.surpriseResolvedCombatId !== combatIdRef.current
  }, [])

  const resolveSurpriseForToken = useCallback((token: Token): void => {
    if (!tokenIsStillSurprised(token)) return
    const character = token.characterId
      ? useCharacterStore.getState().characters.find((candidate) => candidate.id === token.characterId)
      : undefined
    if (character) {
      applyAuthorityCharacterUpdate(character.id, {
        ...character,
        dnd5eCombatState: { ...character.dnd5eCombatState, surpriseResolvedCombatId: combatIdRef.current },
      })
    } else if (activeMapId) {
      const currentToken = useMapStore.getState().maps
        .find((map) => map.id === activeMapId)?.tokens.find((candidate) => candidate.id === token.id) ?? token
      applyAuthorityTokenUpdate(activeMapId, token.id, {
        ...currentToken,
        dnd5eCombatState: { ...currentToken.dnd5eCombatState, surpriseResolvedCombatId: combatIdRef.current },
      })
    }
  }, [activeMapId, applyAuthorityCharacterUpdate, applyAuthorityTokenUpdate, tokenIsStillSurprised])

  // Single reentrancy-guarded entry point for ALL automatic advances
  // (death-skip effects, prune timers, enemy-turn completion, npc auto-skip in T1).
  // Previously advancingTurnRef only protected the manual wrapper below, so a manual
  // advance racing a timer — or two death-skip effects — could run advanceInitiativeCore
  // concurrently and skip/repeat a turn. Two advances within ADVANCE_GUARD_MS now collapse
  // to one. The recursive prune-continuation in advanceInitiativeCore calls Core directly
  // (it is the continuation of an advance already holding the guard), and is exempt.
  const requestAdvance = () => {
    if (advancingTurnRef.current) return
    advancingTurnRef.current = true
    try {
      advanceInitiativeCore()
    } finally {
      window.setTimeout(() => {
        advancingTurnRef.current = false
      }, ADVANCE_GUARD_MS)
    }
  }

  const advanceInitiative = () => {
    if (isAutomatedEnemyTurn && usesAutomatedMonsterSettlement(settlementModeRef.current)) return
    if (isEnemyTurn && currentInitiativeToken?.poolId && getDnd5eSrdMonster(currentInitiativeToken.poolId)) {
      if (dnd5eMonsterEndTurnSettlingRef.current) return
      void (async () => {
        await settleDnd5eMonsterEndTurn(currentInitiativeToken)
        return
      })()
      return
    }
    if (currentInitiativeToken && tokenIsStillSurprised(currentInitiativeToken)) {
      resolveSurpriseForToken(currentInitiativeToken)
      pushCombatLog(`${currentInitiativeToken.label} 的受突袭回合结束；现在可以进行反应。`, 'turn')
    }
    requestAdvance()
  }

  const acknowledgePlayerAction = (
    action: SharedPlayerActionState,
    status: SharedPlayerActionAckState['status'],
    reason?: string,
    acceptedPosition?: { x: number; y: number },
  ) => {
    if (!activeMap || mode !== 'dm') return
    playerActionTransactionOutcomeRef.current.set(
      action.id,
      status === 'accepted'
        ? { status: 'accepted' }
        : { status: 'rejected', reason: reason ?? status },
    )
    const appliedAt = runtimeNow()
    const baseline = playerActionResultBaselinesRef.current[action.id]
    const afterBaseline =
      status === 'accepted' && baseline
        ? capturePlayerActionResultBaseline({
              characters: useCharacterStore.getState().characters,
              map: useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap,
            })
        : undefined
    delete playerActionResultBaselinesRef.current[action.id]
    const ack = buildPlayerActionAck({
      action,
      mapId: activeMap.id,
      combatId: combatIdRef.current,
      status,
      reason,
      acceptedPosition,
      round,
      initiativeIndex,
      appliedAt,
      before: baseline,
      after: afterBaseline,
    })
    const snapshots =
      status === 'accepted'
        ? {
            characters: useCharacterStore.getState().characters,
            characterSelectedId: useCharacterStore.getState().selectedId,
            maps: useMapStore.getState().maps,
            mapSelectedId: useMapStore.getState().selectedId,
            updatedAt: appliedAt,
            combat: {
              mapId: activeMap.id,
              combatId: combatIdRef.current,
              active: combatActiveRef.current,
              round: roundRef.current,
              initiativeIndex: initiativeIndexRef.current,
              initiativeOrder: initiativeOrderRef.current,
              settlementMode: settlementModeRef.current,
              dnd5eTurnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
              updatedAt: appliedAt,
            },
          }
        : undefined
    const commit = publishPlayerActionAckWithSnapshots({
      ack,
      snapshots,
      saveSharedResource,
      publishAck: (eventAck) =>
        publishSharedEvent<SharedPlayerActionAckState>('player-action-dm-to-player', eventAck),
    })
    playerActionAuthorityCommitRef.current = commit
  }

  const completePlayerActionRequest = (action: SharedPlayerActionState) => {
    // Requests are append-only from the player side. DM completion is represented
    // by player-action-ack so we never overwrite a newer player request snapshot.
    processedPlayerActionIdsRef.current.add(action.id)
    void persistPlayerActionProcessedState({
      action,
      loadCurrent: () => loadSharedResource<SharedPlayerActionProcessedState>('player-action-processed'),
      saveProcessed: (processed) =>
        saveSharedResource<SharedPlayerActionProcessedState>('player-action-processed', processed),
    })
  }

  const handleDodge = () => {
    if (!canControlPlayerTurn || !turnCharacter) return
    if (!isDM) {
      if (!sendPlayerDodgeRequest()) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '动作不可用',
          pendingPlayerActionRef.current ? '正在等待 DM 确认上一动作。' : '闪避需要消耗一个动作。',
          'amber',
        )
      }
      return
    }
    if (!submitDmLocalPlayerAction(createDmLocalPlayerAction({ type: 'dodge' }))) {
      void showCombatNotice('无法闪避', '当前闪避无法提交给 DM 结算。', 'amber')
    }
  }

  const handleDnd5eBasicAction = (payload: Dnd5eBasicActionPayload) => {
    if (!canControlPlayerTurn || !turnCharacter) return
    if (!isDM) {
      if (!sendPlayerBasicActionRequest(payload)) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '动作不可用',
          pendingPlayerActionRef.current ? '正在等待 DM 结算上一动作。' : '该基础动作需要一个可用动作和合法目标。',
          'amber',
        )
      }
      return
    }
    if (!submitDmLocalPlayerAction(createDmLocalPlayerAction({ type: 'dnd5e-basic-action', dnd5eBasicAction: payload }))) {
      void showCombatNotice('无法执行基础动作', '当前动作无法提交给 DM 权威结算。', 'amber')
    }
  }

  const handleTriggerReadiedAction = (characterId: string) => {
    if (!isDM || !combatActive || !activeMap) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const actorToken = latestMap.tokens.find((token) => token.characterId === characterId)
    const actor = useCharacterStore.getState().characters.find((character) => character.id === characterId)
    if (!actorToken || !actor?.dnd5eCombatState?.readiedAction) return
    const resolved = triggerDnd5eReadiedAction({
      combatId: combatIdRef.current,
      round: roundRef.current,
      map: latestMap,
      characters: useCharacterStore.getState().characters,
      initiativeOrder: initiativeOrderRef.current,
      actorTokenId: actorToken.id,
      turnEconomy: currentDnd5eTurnEconomy(actorToken.id, roundRef.current),
    })
    if (!resolved.ok) {
      void showCombatNotice(
        '无法触发准备动作',
        resolved.reason === 'reaction-unavailable'
          ? '该角色已经没有可用反应。'
          : '准备动作已失效，或角色当前无法行动。',
        'amber',
      )
      return
    }
    applyCoordinatedDnd5eCombatResult({
      application: resolved.application,
      mapId: latestMap.id,
      applyCharacter: applyAuthorityCharacterUpdate,
      applyToken: updateToken,
    })
    updateDnd5eTurnEconomy(
      actorToken.id,
      (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
      roundRef.current,
    )
    pushHeadlessCombatLog(
      `${actor.name} 的准备动作已由 DM 触发，并消耗反应。`,
      'turn',
      resolved.result.events,
    )
  }

  const requestDmWeaponCoverOverride = (
    attack: PreparedDnd5eEquipmentAttack,
  ): Promise<'auto' | Dnd5eAttackCoverOverride> => {
    const existing = pendingDmCoverOverrideRef.current
    pendingDmCoverOverrideRef.current = null
    existing?.resolve('auto')
    const geometry = mapGeometryRuntimeForMap(attack.map.id)
    const coverGeometry = mapGeometryCoverBetween(geometry, attack.actorToken, attack.targetToken, attack.map)
    const sourceId = coverGeometry.sourceEntityId
    const sourceLabel = sourceId?.startsWith(MAP_GEOMETRY_CREATURE_COVER_PREFIX)
      ? attack.map.tokens.find((token) =>
          token.id === sourceId.slice(MAP_GEOMETRY_CREATURE_COVER_PREFIX.length))?.label
      : sourceId
        ? [
            ...(geometry?.walls ?? []),
            ...(geometry?.doors ?? []),
            ...(geometry?.windows ?? []),
            ...(geometry?.obstacles ?? []),
          ].find((entity) => entity.id === sourceId)?.label
        : undefined
    const previewState = {
      ...attack.state,
      coverBonusByCombatantPair: { ...attack.state.coverBonusByCombatantPair },
      lineOfEffectBlockedByCombatantPair: { ...attack.state.lineOfEffectBlockedByCombatantPair },
    }
    applyDnd5eAttackCoverOverride(previewState, attack.actorToken.id, attack.targetToken.id, 'none')
    const baseArmorClass = dnd5eTargetArmorClassForAttack(
      previewState,
      attack.actorToken.id,
      attack.targetToken.id,
    )
    return new Promise((resolve) => {
      const timeout = window.setTimeout(() => {
        if (pendingDmCoverOverrideRef.current?.actionId !== attack.action.id) return
        pendingDmCoverOverrideRef.current = null
        setDnd5eWeaponAttackConfirmation(null)
        resolve('auto')
      }, 30_000)
      pendingDmCoverOverrideRef.current = {
        actionId: attack.action.id,
        resolve: (cover) => {
          window.clearTimeout(timeout)
          resolve(cover)
        },
      }
      setDnd5eWeaponAttackConfirmation({
        actorCharacterId: attack.actor.id,
        actorTokenId: attack.actorToken.id,
        actorName: attack.actor.name,
        targetTokenId: attack.targetToken.id,
        targetName: attack.targetToken.label,
        weaponName: attack.profile.weaponName,
        automaticCover: attack.cover.cover,
        automaticArmorClass: attack.targetArmorClass,
        baseArmorClass,
        sourceLabel,
        selectedCover: 'auto',
        authorityActionId: attack.action.id,
      })
    })
  }

  const processPlayerActionRequest = async (action: SharedPlayerActionState) => {
    await Promise.all([
      useMapStore.getState().loadShared(),
      useCharacterStore.getState().loadShared(),
      useMapGeometryStore.getState().loadShared(),
    ])
    const authorityMap = useMapStore.getState().maps.find((map) => map.id === action.mapId)
    const liveRound = roundRef.current
    const liveIndex = initiativeIndexRef.current
    const current = initiativeOrderRef.current[liveIndex]
    const authorityPlan = planPlayerActionAuthorityExecution({
      action,
      preflight: {
        isDm: isDM,
        activeMap: authorityMap,
        combatId: combatIdRef.current,
        combatActive: combatActiveRef.current,
        round: liveRound,
        initiativeIndex: liveIndex,
        currentTokenId: current?.tokenId,
        processedActionIds: processedPlayerActionIdsRef.current,
        seenActionIds: seenPlayerActionIdsRef.current,
      },
      recentActionKeys: recentPlayerActionKeysRef.current,
    })
    if (authorityPlan.status === 'ignored') {
      playerActionTransactionOutcomeRef.current.set(action.id, { status: 'ignored' })
      return
    }
    if (authorityPlan.status === 'rejected') {
      acknowledgePlayerAction(action, 'rejected', authorityPlan.reason)
      completePlayerActionRequest(action)
      return
    }
    if (!authorityMap) return
    seenPlayerActionIdsRef.current.add(action.id)

    playerActionResultBaselinesRef.current[action.id] = capturePlayerActionResultBaseline({
      characters: useCharacterStore.getState().characters,
      map: authorityMap,
    })

    // This repository has one runtime ruleset. Resolve the authoritative actor
    // from the map token so a stale/missing persisted ruleset marker can never
    // send a valid D&D character action through retired legacy resolvers.
    const dnd5eActionActorToken = authorityMap.tokens.find((token) => token.id === action.actorTokenId)
    const actionActorCharacterId = dnd5eActionActorToken?.characterId
    const dnd5eActionActor = useCharacterStore.getState().characters.find(
      (character) => character.id === actionActorCharacterId,
    )
    if (action.type === 'dnd5e-map-interaction' && dnd5eActionActorToken && dnd5eActionActor) {
      const payload = action.dnd5eMapInteraction
      const geometry = useMapGeometryStore.getState().maps.find((entry) => entry.mapId === authorityMap.id)
      if (!payload || (payload.operation === 'search'
        ? !payload.point || !Number.isFinite(payload.point.x) || !Number.isFinite(payload.point.y)
        : typeof payload.doorId !== 'string')) {
        acknowledgePlayerAction(action, 'rejected', 'invalid-map-interaction')
        completePlayerActionRequest(action)
        return
      }
      const door = payload.operation === 'search'
        ? undefined
        : geometry?.doors.find((entry) => entry.id === payload.doorId)
      const inventory = dnd5eActionActor.dnd5eInventory?.entries ?? []
      const hasThievesTools = inventory.some((entry) =>
        entry.quantity > 0 && (entry.templateId.endsWith(':thieves-tools') || entry.item.name === '盗贼工具'),
      )
      const hasMatchingKey = !!door?.interaction?.keyItemId && inventory.some((entry) =>
        entry.quantity > 0 && (entry.templateId === door.interaction?.keyItemId || entry.instanceId === door.interaction?.keyItemId),
      )
      const prepared = prepareDnd5eMapInteraction({
        map: authorityMap,
        geometry,
        actor: dnd5eActionActorToken,
        payload,
        hasThievesTools,
        hasMatchingKey,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      if (combatActiveRef.current && prepared.prepared.spendAction) {
        const economy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
        if (economy.action.current < 1) {
          acknowledgePlayerAction(action, 'rejected', 'action-unavailable')
          completePlayerActionRequest(action)
          return
        }
      }
      let mapInteractionTurnResource: 'objectInteraction' | 'action' = 'action'
      if (combatActiveRef.current && prepared.prepared.turnCost === 'object-interaction') {
        const economy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
        mapInteractionTurnResource = (economy.objectInteraction?.current ?? 1) > 0 ? 'objectInteraction' : 'action'
        if (mapInteractionTurnResource === 'action' && economy.action.current < 1) {
          acknowledgePlayerAction(action, 'rejected', 'object-interaction-unavailable')
          completePlayerActionRequest(action)
          return
        }
      }
      const adjudication = await requestSharedMapInteractionAdjudication(
        action,
        dnd5eActionActor.name,
        prepared.prepared,
      )
      const interruptId = `dm-adjudication:${action.id}`
      if (adjudication.decision !== 'approved') {
        await finishSharedCombatInterrupt(interruptId, adjudication)
        acknowledgePlayerAction(action, 'rejected', 'map-interaction-cancelled')
        completePlayerActionRequest(action)
        return
      }
      const skill = prepared.prepared.checkSkill
      const modifier = skill === 'sleightOfHand' && prepared.prepared.method === 'thieves-tools'
        ? dnd5eAbilityCheckModifier(
            dnd5eActionActor,
            'dex',
            dnd5eActionActor.skills.includes('thievesTools') ? 1 : 0,
          )
        : skill
          ? dnd5eSkillCheckModifier(dnd5eActionActor, skill)
          : 0
      const d20 = prepared.prepared.automaticSuccess
        ? undefined
        : await rollDiceBoxD20(`${prepared.prepared.label}·地图交互检定`, dnd5eActionActor.name)
      const resolved = resolveDnd5eMapInteraction({
        prepared: prepared.prepared,
        d20,
        modifier,
        adjustedDc: adjudication.adjustedDc,
        dmOverride: adjudication.mapInteractionOverride === 'success'
          ? 'success'
          : adjudication.mapInteractionOverride === 'failure'
            ? 'failure'
            : undefined,
      })
      if (combatActiveRef.current) {
        const economy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
        const snapshot = createDnd5eMapCombatSnapshot({
          combatId: action.combatId ?? `map-${authorityMap.id}`,
          round: liveRound,
          turnSlotId: initiativeOrderRef.current[liveIndex]?.slotId,
          map: authorityMap,
          characters: useCharacterStore.getState().characters,
          initiativeOrder: initiativeOrderRef.current,
        })
        const actorIndex = snapshot.state.initiativeOrder.indexOf(action.actorTokenId)
        const combatant = snapshot.state.combatants[action.actorTokenId]
        if (actorIndex < 0 || !combatant) {
          acknowledgePlayerAction(action, 'rejected', 'invalid-map-interaction')
          completePlayerActionRequest(action)
          return
        }
        combatant.turn = {
          actionAvailable: economy.action.current > 0,
          bonusActionAvailable: economy.bonusAction.current > 0,
          reactionAvailable: economy.reaction.current > 0,
          objectInteractionAvailable: (economy.objectInteraction?.current ?? 1) > 0,
          movementRemaining: economy.movement.current,
        }
        const economyResult = resolveDnd5eHeadlessAction(
          { ...snapshot.state, initiativeIndex: actorIndex },
          {
            type: 'interact-object', actorId: action.actorTokenId,
            interactionId: prepared.prepared.interactionId,
            useAction: prepared.prepared.turnCost === 'action' || mapInteractionTurnResource === 'action',
          },
        )
        if (!economyResult.ok) {
          await finishSharedCombatInterrupt(interruptId, adjudication)
          acknowledgePlayerAction(action, 'rejected', economyResult.reason)
          completePlayerActionRequest(action)
          return
        }
        const application = planDnd5eMapResultApplication({
          state: economyResult.state,
          map: authorityMap,
          characters: useCharacterStore.getState().characters,
          characterIdByCombatantId: snapshot.characterIdByCombatantId,
        })
        applyDnd5eCombatApplication(application)
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (current) => spendDnd5eTurnResource(
            current,
            prepared.prepared.turnCost === 'action' ? 'action' : mapInteractionTurnResource,
          ).economy,
          liveRound,
        )
      }
      if (resolved.nextDoorState && prepared.prepared.door) {
        setGeometryDoorState(authorityMap.id, prepared.prepared.door.id, resolved.nextDoorState)
      }
      if (resolved.revealSecret && prepared.prepared.door && dnd5eActionActor.roomMemberId) {
        updateGeometryEntity(authorityMap.id, prepared.prepared.door.id, {
          revealedToMemberIds: [...new Set([
            ...(prepared.prepared.door.revealedToMemberIds ?? []),
            dnd5eActionActor.roomMemberId,
          ])],
        })
      }
      const checkText = prepared.prepared.blindSearch || resolved.total == null
        ? ''
        : `（${resolved.total} 对 DC ${resolved.dc}）`
      const interactionOutcome = prepared.prepared.blindSearch
        ? resolved.revealSecret ? '发现了一处暗门' : '没有发现异常'
        : `${resolved.success ? '成功' : '失败'}`
      pushCombatLog(
        `${dnd5eActionActor.name} 尝试${prepared.prepared.label}的地图交互${checkText}：${interactionOutcome}。`,
        'turn',
      )
      await finishSharedCombatInterrupt(interruptId, adjudication)
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }
    if (action.type === 'disengage' && dnd5eActionActor) {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const resolved = resolveDnd5ePlayerDisengage({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
      })
      if (!resolved.ok) {
        acknowledgePlayerAction(action, 'rejected', resolved.reason)
        completePlayerActionRequest(action)
        return
      }
      updateDnd5eTurnEconomy(
        action.actorTokenId,
        (economy) => spendDnd5eTurnResource(economy, 'action').economy,
        liveRound,
      )
      setDisengagedCharIds((previous) => new Set(previous).add(resolved.actor.id))
      pushCombatLog(`${resolved.actor.name} 执行撤离动作；本回合移动不会触发借机攻击。`, 'turn')
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }
    if (action.type === 'dodge' && dnd5eActionActor) {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const resolved = resolveDnd5ePlayerDodge({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
      })
      if (!resolved.ok) {
        acknowledgePlayerAction(action, 'rejected', resolved.reason)
        completePlayerActionRequest(action)
        return
      }
      applyCoordinatedDnd5eCombatResult({
        application: resolved.application,
        mapId: authorityMap.id,
        applyCharacter: applyAuthorityCharacterUpdate,
        applyToken: updateToken,
      })
      updateDnd5eTurnEconomy(
        action.actorTokenId,
        (economy) => spendDnd5eTurnResource(economy, 'action').economy,
        liveRound,
      )
      pushHeadlessCombatLog(`${resolved.actor.name} 执行闪避动作，直到其下一回合开始前针对它的攻击具有劣势。`, 'turn', resolved.result.events)
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }
    if (action.type === 'dnd5e-basic-action' && dnd5eActionActor && action.dnd5eBasicAction) {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const prepared = prepareDnd5ePlayerBasicAction({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const payload = action.dnd5eBasicAction
      const needsActorRoll = payload.kind === 'hide' || payload.kind === 'grapple' || payload.kind === 'shove' || payload.kind === 'escape-grapple'
      const needsTargetRoll = payload.kind === 'grapple' || payload.kind === 'shove' || payload.kind === 'escape-grapple'
      const actorD20 = needsActorRoll
        ? await rollDiceBoxD20(`${dnd5eActionActor.name}·${payload.kind === 'hide'
            ? '躲藏检定'
            : prepared.prepared.actorContestSkill === 'acrobatics' ? '敏捷（体操）对抗检定' : '力量（运动）对抗检定'}`, dnd5eActionActor.name)
        : undefined
      const actorD20Second = needsActorRoll && prepared.prepared.actorRollMode !== 'normal'
        ? await rollDiceBoxD20(`${dnd5eActionActor.name}·优势／劣势第二枚`, dnd5eActionActor.name)
        : undefined
      const targetTokenId = 'targetTokenId' in payload ? payload.targetTokenId : undefined
      const targetName = targetTokenId
        ? authorityMap.tokens.find((token) => token.id === targetTokenId)?.label ?? '目标'
        : '目标'
      const targetD20 = needsTargetRoll
        ? await rollDiceBoxD20(`${targetName}·${prepared.prepared.targetDefense === 'acrobatics' ? '敏捷（体操）' : '力量（运动）'}对抗检定`, targetName)
        : undefined
      const targetD20Second = needsTargetRoll && prepared.prepared.targetRollMode !== 'normal'
        ? await rollDiceBoxD20(`${targetName}·优势／劣势第二枚`, targetName)
        : undefined
      let resolved = resolvePreparedDnd5ePlayerBasicAction({
        prepared: prepared.prepared,
        actorD20,
        actorD20Second,
        targetD20,
        targetD20Second,
      })
      const shovePushSucceeded = payload.kind === 'shove' && payload.outcome === 'push' &&
        resolved.result.events.some((event) =>
          event.type === 'contest-resolved' && event.contest === 'shove' && event.success,
        )
      if (shovePushSucceeded) {
        const pushedToken = authorityMap.tokens.find((token) => token.id === payload.targetTokenId)
        const fromElevationFeet = Math.max(0, Math.floor(pushedToken?.elevationFeet ?? 0))
        if (pushedToken && fromElevationFeet >= 10 && await showCombatDialog({
          title: '推撞与高台坠落',
          message: `${pushedToken.label} 当前海拔为 ${fromElevationFeet} 尺。推离 5 尺后是否离开支撑面并坠落到 0 尺？`,
          confirmText: '坠落并结算',
          cancelText: '保持当前海拔',
          tone: 'amber',
        })) {
          resolved = resolvePreparedDnd5ePlayerBasicAction({
            prepared: prepared.prepared,
            actorD20,
            actorD20Second,
            targetD20,
            targetD20Second,
            pushToElevationFeet: 0,
            fallingDamageRolls: await rollDiceBoxValues(
              dnd5eFallingDamageDice(fromElevationFeet), 6, '推撞·坠落伤害', pushedToken.label,
            ),
          })
        }
      }
      if (!resolved.result.ok || !resolved.application) {
        acknowledgePlayerAction(action, 'rejected', resolved.result.ok ? 'invalid-basic-action' : resolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      let basicApplication = resolved.application
      if (payload.kind === 'shove' && payload.outcome === 'push') {
        const areaSettlement = await settleDnd5ePersistentAreasForForcedMovement({
          beforeMap: authorityMap,
          afterMap: basicApplication.map,
          characters: basicApplication.characters,
          tokenId: payload.targetTokenId,
          round: liveRound,
          turnKey: `${liveRound}:${currentInitiativeToken?.id ?? action.actorTokenId}`,
        })
        for (const log of areaSettlement.logs) pushCombatLog(log, 'system')
        basicApplication = {
          map: areaSettlement.map,
          characters: areaSettlement.characters,
          changedCharacterIds: areaSettlement.characters.flatMap((character) => {
            const before = useCharacterStore.getState().characters.find((candidate) => candidate.id === character.id)
            return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
          }),
          changedTokenIds: areaSettlement.map.tokens.flatMap((token) => {
            const before = authorityMap.tokens.find((candidate) => candidate.id === token.id)
            return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
          }),
        }
      }
      applyCoordinatedDnd5eCombatResult({
        application: basicApplication,
        mapId: authorityMap.id,
        applyCharacter: applyAuthorityCharacterUpdate,
        applyToken: updateToken,
      })
      if (JSON.stringify(basicApplication.map.dnd5ePluginAreas ?? []) !== JSON.stringify(authorityMap.dnd5ePluginAreas ?? [])) {
        applyAuthorityMapUpdate(authorityMap.id, { dnd5ePluginAreas: basicApplication.map.dnd5ePluginAreas ?? [] })
      }
      const grantedMovement = resolved.result.events
        .flatMap((event) => event.type === 'movement-granted' && event.actorId === action.actorTokenId
          ? [event.amount]
          : [])
        .reduce((total, amount) => total + amount, 0)
      updateDnd5eTurnEconomy(
        action.actorTokenId,
        (economy) => {
          const afterAction = prepared.prepared.spendsAction
            ? spendDnd5eTurnResource(economy, 'action').economy
            : economy
          const afterAttackReplacement = payload.kind === 'grapple' || payload.kind === 'shove'
            ? { ...afterAction, attacksUsed: prepared.prepared.attackNumber ?? afterAction.attacksUsed }
            : afterAction
          return grantedMovement > 0
            ? {
                ...afterAttackReplacement,
                movement: {
                  current: afterAttackReplacement.movement.current + grantedMovement,
                  max: afterAttackReplacement.movement.max + grantedMovement,
                },
              }
            : afterAttackReplacement
        },
        liveRound,
      )
      const label = payload.kind === 'dash' ? '疾走'
        : payload.kind === 'hide' ? '躲藏'
          : payload.kind === 'help' ? `协助（${payload.helpKind === 'attack' ? '攻击' : '能力检定'}）`
            : payload.kind === 'ready' ? `准备动作：${payload.trigger}`
              : payload.kind === 'use-object' ? '使用物件'
                : payload.kind === 'grapple' ? '擒抱'
                  : payload.kind === 'shove' ? `推撞（${payload.outcome === 'prone' ? '击倒' : '推开'}）`
                    : '挣脱擒抱'
      pushHeadlessCombatLog(`${dnd5eActionActor.name} 执行${label}。`, 'turn', resolved.result.events)
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (action.type === 'dnd5e-death-save' && dnd5eActionActor && dnd5eActionActorToken) {
      if (!characterNeedsDeathSave(dnd5eActionActor)) {
        acknowledgePlayerAction(action, 'rejected', 'invalid-death-save')
        completePlayerActionRequest(action)
        return
      }
      const preparedTurn = prepareDnd5ePlayerEndTurn({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
      })
      if (!preparedTurn.ok) {
        acknowledgePlayerAction(action, 'rejected', preparedTurn.reason)
        completePlayerActionRequest(action)
        return
      }
      const activeEffectSavingThrows: Dnd5eActiveEffectSavingThrowRoll[] = []
      for (const requirement of preparedTurn.prepared.activeEffectSavingThrows) {
        const d20 = await rollDiceBoxD20(`${requirement.effect.label || '持续状态'}·回合结束豁免`, preparedTurn.prepared.actorName)
        const d20Second = requirement.mode !== 'normal'
          ? await rollDiceBoxD20(`${requirement.effect.label || '持续状态'}·回合结束豁免`, preparedTurn.prepared.actorName)
          : undefined
        const blessRoll = requirement.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', preparedTurn.prepared.actorName))[0]
          : undefined
        const baneRoll = requirement.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', preparedTurn.prepared.actorName))[0]
          : undefined
        activeEffectSavingThrows.push({ effectId: requirement.effect.id, d20, d20Second, blessRoll, baneRoll })
      }
      const turnStartActiveEffectSavingThrows: Dnd5eActiveEffectSavingThrowRoll[] = []
      for (const requirement of preparedTurn.prepared.turnStartActiveEffectSavingThrows) {
        const d20 = await rollDiceBoxD20(`${requirement.effect.label || '持续状态'}·回合开始豁免`, requirement.targetName)
        const d20Second = requirement.mode !== 'normal'
          ? await rollDiceBoxD20(`${requirement.effect.label || '持续状态'}·回合开始豁免`, requirement.targetName)
          : undefined
        const blessRoll = requirement.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', requirement.targetName))[0]
          : undefined
        const baneRoll = requirement.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', requirement.targetName))[0]
          : undefined
        turnStartActiveEffectSavingThrows.push({ effectId: requirement.effect.id, d20, d20Second, blessRoll, baneRoll })
      }
      const nextMonsterRechargeRolls = [] as Array<{ actorId: string; actionId: string; roll: number }>
      for (const requirement of preparedTurn.prepared.nextMonsterRechargeRolls) {
        const roll = (await rollDiceBoxValues(
          1,
          requirement.dieSides,
          `${requirement.actionName}·充能（${requirement.minimum}–${requirement.dieSides}）`,
          requirement.actorName,
        ))[0]
        nextMonsterRechargeRolls.push({ actorId: requirement.actorId, actionId: requirement.actionId, roll })
      }
      const actorCombatant = preparedTurn.prepared.state.combatants[dnd5eActionActorToken.id]
      const deathSaveD20 = await rollDiceBoxD20('死亡豁免', dnd5eActionActor.name)
      const blessRoll = actorCombatant && dnd5eCombatantHasConcentrationEffect(
        preparedTurn.prepared.state,
        actorCombatant.id,
        'bless',
      ) ? (await rollDiceBoxValues(1, 4, '祝福术·死亡豁免加值', dnd5eActionActor.name))[0] : undefined
      const baneRoll = actorCombatant && dnd5eCombatantHasConcentrationEffect(
        preparedTurn.prepared.state,
        actorCombatant.id,
        'bane',
      ) ? (await rollDiceBoxValues(1, 4, '灾祸术·死亡豁免减值', dnd5eActionActor.name))[0] : undefined
      const result = resolveDnd5eHeadlessAction(preparedTurn.prepared.state, {
        type: 'death-save-turn',
        actorId: dnd5eActionActorToken.id,
        d20: deathSaveD20,
        blessRoll,
        baneRoll,
        activeEffectSavingThrows,
        turnStartActiveEffectSavingThrows,
        nextMonsterRechargeRolls,
      }, { transactionId: action.id, mapId: authorityMap.id })
      if (!result.ok) {
        acknowledgePlayerAction(action, 'rejected', result.reason)
        completePlayerActionRequest(action)
        return
      }
      const settled = await settleDnd5eConcentrationChecks({
        result,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        characterIdByCombatantId: preparedTurn.prepared.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      applyDnd5eCombatApplication(settled.application)
      const deathSave = settled.result.events.find((event) => event.type === 'death-save-resolved')
      if (deathSave?.type === 'death-save-resolved') {
        const outcome = deathSave.currentHp > 0
          ? '自然 20，恢复 1 点生命值'
          : deathSave.dead
            ? '死亡'
            : deathSave.stable
              ? '伤势稳定'
              : `${deathSave.successes} 次成功 / ${deathSave.failures} 次失败`
        pushCombatLog(`${dnd5eActionActor.name} 进行死亡豁免（d20=${deathSave.d20}）：${outcome}。`, 'turn')
      }
      if (
        settled.result.state.round !== liveRound ||
        settled.result.state.initiativeIndex !== preparedTurn.prepared.state.initiativeIndex
      ) {
        applyDnd5eTurnAdvance(settled.result.state, liveRound, dnd5eActionActor.id)
      }
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (
      action.type === 'end-turn' &&
      (dnd5eActionActor || (dnd5eActionActorToken?.poolId && getDnd5eSrdMonster(dnd5eActionActorToken.poolId)))
    ) {
      const preparedEndTurn = prepareDnd5ePlayerEndTurn({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
      })
      if (!preparedEndTurn.ok) {
        acknowledgePlayerAction(action, 'rejected', preparedEndTurn.reason)
        completePlayerActionRequest(action)
        return
      }
      const activeEffectSavingThrows: Dnd5eActiveEffectSavingThrowRoll[] = []
      for (const requirement of preparedEndTurn.prepared.activeEffectSavingThrows) {
        const effectName = requirement.effect.label || '持续状态'
        const d20 = await rollDiceBoxD20(`${effectName}·回合结束豁免`, preparedEndTurn.prepared.actorName)
        const d20Second = requirement.mode !== 'normal'
          ? await rollDiceBoxD20(
              `${effectName}·回合结束豁免（${requirement.mode === 'advantage' ? '优势' : '劣势'}）`,
              preparedEndTurn.prepared.actorName,
            )
          : undefined
        const blessRoll = requirement.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', preparedEndTurn.prepared.actorName))[0]
          : undefined
        const baneRoll = requirement.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', preparedEndTurn.prepared.actorName))[0]
          : undefined
        activeEffectSavingThrows.push({ effectId: requirement.effect.id, d20, d20Second, blessRoll, baneRoll })
      }
      const turnStartActiveEffectSavingThrows: Dnd5eActiveEffectSavingThrowRoll[] = []
      for (const requirement of preparedEndTurn.prepared.turnStartActiveEffectSavingThrows) {
        const effectName = requirement.effect.label || '持续状态'
        const d20 = await rollDiceBoxD20(`${effectName}·回合开始豁免`, requirement.targetName)
        const d20Second = requirement.mode !== 'normal'
          ? await rollDiceBoxD20(
              `${effectName}·回合开始豁免（${requirement.mode === 'advantage' ? '优势' : '劣势'}）`,
              requirement.targetName,
            )
          : undefined
        const blessRoll = requirement.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', requirement.targetName))[0]
          : undefined
        const baneRoll = requirement.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', requirement.targetName))[0]
          : undefined
        turnStartActiveEffectSavingThrows.push({ effectId: requirement.effect.id, d20, d20Second, blessRoll, baneRoll })
      }
      const nextMonsterRechargeRolls = [] as Array<{ actorId: string; actionId: string; roll: number }>
      for (const requirement of preparedEndTurn.prepared.nextMonsterRechargeRolls) {
        const roll = (await rollDiceBoxValues(
          1,
          requirement.dieSides,
          `${requirement.actionName}·充能（${requirement.minimum}–${requirement.dieSides}）`,
          requirement.actorName,
        ))[0]
        nextMonsterRechargeRolls.push({ actorId: requirement.actorId, actionId: requirement.actionId, roll })
      }
      const dnd5eEndTurn = resolveDnd5ePlayerEndTurn({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        activeEffectSavingThrows,
        turnStartActiveEffectSavingThrows,
        nextMonsterRechargeRolls,
      })
      if (!dnd5eEndTurn.ok) {
        acknowledgePlayerAction(action, 'rejected', dnd5eEndTurn.reason)
        completePlayerActionRequest(action)
        return
      }
      if (!dnd5eEndTurn.result.ok) {
        acknowledgePlayerAction(action, 'rejected', dnd5eEndTurn.result.reason)
        completePlayerActionRequest(action)
        return
      }
      const settledEndTurn = await settleDnd5eConcentrationChecks({
        result: dnd5eEndTurn.result,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        characterIdByCombatantId: Object.fromEntries(
          authorityMap.tokens.flatMap((token) => token.characterId ? [[token.id, token.characterId]] : []),
        ),
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      applyDnd5eCombatApplication(settledEndTurn.application)
      if (settledEndTurn.result.events.some((event) =>
        event.type === 'class-state-changed' && event.stateKey === 'rage' && !event.active,
      )) pushCombatLog(`${dnd5eEndTurn.actorName} 的狂暴结束。`, 'system')
      const exhaustion = settledEndTurn.result.events.find((event) => event.type === 'exhaustion-gained')
      if (exhaustion?.type === 'exhaustion-gained') {
        pushCombatLog(`${dnd5eEndTurn.actorName} 因狂乱结束获得 1 级力竭，当前力竭 ${exhaustion.level} 级。`, 'system')
      }
      const hurlReturn = settledEndTurn.result.events.find((event) =>
        event.type === 'class-state-changed' && event.stateKey === 'hurl-through-hell' && !event.active,
      )
      if (hurlReturn?.type === 'class-state-changed') {
        const targetName = authorityMap.tokens.find((token) => token.id === hurlReturn.targetId)?.label ?? '目标'
        const damage = settledEndTurn.result.events
          .reduce((sum, event) => event.type === 'damage-applied' &&
            event.sourceId === dnd5eEndTurn.actorToken.id && event.targetId === hurlReturn.targetId
            ? sum + event.amount
            : sum, 0)
        pushCombatLog(`${targetName} 从下层位面返回${damage > 0 ? `，受到 ${damage} 点心灵伤害` : '；邪魔生物不受该伤害'}。`, 'system')
      }
      for (const save of settledEndTurn.result.events.filter((event) =>
        event.type === 'saving-throw-resolved' && settledEndTurn.result.events.some((candidate) =>
          candidate.type === 'draconic-presence-save-required' && candidate.targetId === event.targetId
        ),
      )) {
        if (save.type !== 'saving-throw-resolved') continue
        const targetName = authorityMap.tokens.find((token) => token.id === save.targetId)?.label ?? '目标'
        const condition = settledEndTurn.result.events.find((event) =>
          event.type === 'condition-applied' && event.targetId === save.targetId &&
          (event.condition === 'charmed' || event.condition === 'frightened'),
        )
        pushCombatLog(`${targetName} 的龙威感知豁免 ${save.total} vs DC ${save.dc}：${save.success ? '成功，并在24小时内免疫该来源' : condition?.type === 'condition-applied' && condition.condition === 'charmed' ? '失败，陷入魅惑' : '失败，陷入恐慌'}。`, 'system')
      }
      applyDnd5eTurnAdvance(settledEndTurn.result.state, liveRound, dnd5eActionActor?.id)
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-item-use' && action.type === 'dnd5e-item-use') {
      const payload = action.dnd5eItemUse
      const characters = useCharacterStore.getState().characters
      const actor = characters.find((character) => character.id === action.characterId)
      const entry = actor?.dnd5eInventory?.entries.find((candidate) => candidate.instanceId === payload?.instanceId)
      if (!actor || !payload || !entry || actionActorCharacterId !== actor.id) {
        acknowledgePlayerAction(action, 'rejected', 'item-not-found')
        completePlayerActionRequest(action)
        return
      }
      const actorToken = authorityMap.tokens.find((token) => token.id === action.actorTokenId)
      const itemTargeting = entry.item.use?.targeting
      if (itemTargeting?.kind === 'map-area') {
        if (!actorToken || !payload.targetCell) {
          acknowledgePlayerAction(action, 'rejected', 'invalid-target-cell')
          completePlayerActionRequest(action)
          return
        }
        const placed = placeDnd5eItemArea({
          map: authorityMap,
          characters,
          actor,
          actorToken,
          entry,
          targetCell: payload.targetCell,
          turnEconomy: currentDnd5eTurnEconomy(action.actorTokenId, liveRound),
          areaId: runtimeId(`item-area:${itemTargeting.areaKind}`),
          createdAt: runtimeNow(),
          transaction: createCombatTransaction({
            id: action.id,
            mapId: authorityMap.id,
            combatId: action.combatId,
            actorId: action.actorTokenId,
            actionId: action.id,
            actionKind: 'item-use',
          }),
        })
        if (!placed.ok) {
          acknowledgePlayerAction(action, 'rejected', placed.reason)
          completePlayerActionRequest(action)
          return
        }
        const nextActor = placed.characters.find((character) => character.id === actor.id)
        if (nextActor) applyAuthorityCharacterUpdate(actor.id, nextActor)
        applyAuthorityMapUpdate(authorityMap.id, { dnd5eItemAreas: placed.map.dnd5eItemAreas })
        if (placed.spentEconomy) {
          updateDnd5eTurnEconomy(
            action.actorTokenId,
            (economy) => spendDnd5eTurnResource(economy, placed.spentEconomy!).economy,
            liveRound,
          )
        }
        pushCombatLog(
          `${actor.name} 使用 ${entry.item.name}，在地图上放置了${itemTargeting.widthFeet}×${itemTargeting.heightFeet}尺区域。`,
          'turn',
        )
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted')
        return
      }
      if (itemTargeting?.kind === 'creature') {
        const targetToken = authorityMap.tokens.find((token) => token.id === payload.targetTokenId)
        const distanceFeet = actorToken && targetToken
          ? tokenFootprintDistanceCells(actorToken, targetToken, authorityMap) * Math.max(1, authorityMap.feetPerCell ?? 5)
          : Number.POSITIVE_INFINITY
        if (
          !actorToken || !targetToken || targetToken.type === 'obstacle' ||
          (!itemTargeting.includeSelf && actorToken.id === targetToken.id) ||
          distanceFeet > itemTargeting.rangeFeet
        ) {
          acknowledgePlayerAction(action, 'rejected', 'invalid-target')
          completePlayerActionRequest(action)
          return
        }
      }
      const healing = entry.item.use?.effect.kind === 'healing' ? entry.item.use.effect.dice : undefined
      const healingRolls = healing
        ? await rollDiceBoxValues(healing.count, healing.sides, `${entry.item.name}·恢复生命`, actor.name)
        : undefined
      const itemTransaction = createCombatTransaction({
        id: action.id,
        mapId: authorityMap.id,
        combatId: action.combatId,
        actorId: action.actorTokenId,
        actionId: action.id,
        actionKind: 'item-use',
      })
      const resolved = applyDnd5eInventoryMutation(
        characters,
        { type: 'use', characterId: actor.id, instanceId: entry.instanceId, healingRolls },
        {
          turnEconomy: currentDnd5eTurnEconomy(action.actorTokenId, liveRound),
          transaction: itemTransaction,
        },
      )
      if (!resolved.ok) {
        acknowledgePlayerAction(action, 'rejected', resolved.reason ?? 'item-use-rejected')
        completePlayerActionRequest(action)
        return
      }
      const nextActor = resolved.characters.find((character) => character.id === actor.id)
      if (!nextActor) {
        acknowledgePlayerAction(action, 'rejected', 'character-not-found')
        completePlayerActionRequest(action)
        return
      }
      applyAuthorityCharacterUpdate(actor.id, nextActor)
      if (actorToken && (nextActor.currentHp !== actor.currentHp || nextActor.maxHp !== actor.maxHp)) {
        applyAuthorityTokenUpdate(authorityMap.id, actorToken.id, { ...actorToken, ...characterHpTokenPatch(nextActor) })
      }
      if (resolved.spentEconomy) {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, resolved.spentEconomy!).economy,
          liveRound,
        )
      }
      if (resolved.healingRolled != null) {
        pushCombatLog(`${actor.name} 使用 ${entry.item.name}，恢复 ${resolved.healingApplied ?? 0} 点生命值（掷骰 ${resolved.healingRolled}）。`, 'turn')
      } else if (resolved.requiresDmAdjudication) {
        const targetName = payload.targetTokenId
          ? authorityMap.tokens.find((token) => token.id === payload.targetTokenId)?.label
          : undefined
        pushCombatLog(`${actor.name} 对${targetName ? ` ${targetName} ` : '目标'}使用 ${entry.item.name}；DM 裁定：${resolved.requiresDmAdjudication}`, 'turn')
      } else {
        pushCombatLog(`${actor.name} 使用 ${entry.item.name}。`, 'turn')
      }
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-ability-check' && action.type === 'dnd5e-ability-check') {
      const prepared = prepareDnd5eAbilityCheck({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy: currentDnd5eTurnEconomy(action.actorTokenId, liveRound),
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const check = prepared.prepared
      const requestedAdvantage = check.payload.mode === 'advantage'
      const requestedDisadvantage = check.payload.mode === 'disadvantage' || (check.actor.exhaustionLevel ?? 0) >= 1
      const effectiveMode = requestedAdvantage === requestedDisadvantage
        ? 'normal'
        : requestedAdvantage ? 'advantage' : 'disadvantage'
      const abilityLabel = ABILITIES.find((ability) => ability.key === check.payload.ability)?.label ?? check.payload.ability
      const skillLabel = check.payload.skill ? SKILLS.find((skill) => skill.key === check.payload.skill)?.label : undefined
      const checkLabel = skillLabel ? `${abilityLabel}（${skillLabel}）检定` : `${abilityLabel}检定`
      const d20 = await rollDiceBoxD20(checkLabel, check.actor.name)
      const d20Second = effectiveMode !== 'normal'
        ? await rollDiceBoxD20(`${checkLabel}（${effectiveMode === 'advantage' ? '优势' : '劣势'}）`, check.actor.name)
        : undefined
      const preview = previewPreparedDnd5eAbilityCheck(check, d20, d20Second)
      if (!preview) {
        acknowledgePlayerAction(action, 'rejected', 'invalid-dice')
        completePlayerActionRequest(action)
        return
      }
      const actorCombatant = check.state.combatants[check.actorToken.id]
      let runningTotal = preview.total
      const heldInspirationDie = dnd5eHeldBardicInspirationDie(actorCombatant)
      const bardicInspirationRoll = runningTotal < check.payload.dc && heldInspirationDie &&
        runningTotal + heldInspirationDie >= check.payload.dc
        ? await requestDnd5eBardicInspirationRoll({
            target: check.actor,
            targetName: check.actor.name,
            dieSides: heldInspirationDie,
            rollType: '属性检定',
            total: runningTotal,
            targetNumber: check.payload.dc,
          })
        : undefined
      runningTotal += bardicInspirationRoll ?? 0
      const bardLevel = dnd5eCombatantClassLevel(actorCombatant, 'bard')
      const peerlessSkillDie = dnd5eCombatantHasSubclass(actorCombatant, 'bard', 'lore') &&
        bardLevel >= 14 && (actorCombatant.classResources['dnd5e-bardic-inspiration']?.current ?? 0) > 0
        ? dnd5eBardicInspirationDie(bardLevel)
        : undefined
      const peerlessSkillRoll = runningTotal < check.payload.dc && peerlessSkillDie &&
        runningTotal + peerlessSkillDie >= check.payload.dc
        ? await requestDnd5ePeerlessSkillRoll({
            target: check.actor,
            dieSides: peerlessSkillDie,
            total: runningTotal,
            targetNumber: check.payload.dc,
          })
        : undefined
      runningTotal += peerlessSkillRoll ?? 0
      const darkOnesOwnLuckRoll = runningTotal < check.payload.dc && dnd5eDarkOnesOwnLuckAvailable(actorCombatant) &&
        runningTotal + 10 >= check.payload.dc
        ? await requestDnd5eDarkOnesOwnLuckRoll({
            target: check.actor,
            targetName: check.actor.name,
            rollType: '属性检定',
            total: runningTotal,
            targetNumber: check.payload.dc,
          })
        : undefined
      runningTotal += darkOnesOwnLuckRoll ?? 0
      const cuttingWordsCandidate = runningTotal >= check.payload.dc
        ? findDnd5eAbilityCheckCuttingWordsCandidate(authorityMap, check.state, check.actorToken)
        : undefined
      const cuttingWords = cuttingWordsCandidate && runningTotal - cuttingWordsCandidate.dieSides < check.payload.dc
        ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
            attackerName: check.actor.name,
            targetName: `DC ${check.payload.dc}`,
            attackName: checkLabel,
            total: runningTotal,
            targetNumber: check.payload.dc,
            phase: 'ability-check',
          })
        : undefined
      runningTotal -= cuttingWords?.roll ?? 0
      const strokeOfLuck = !!(
        runningTotal < check.payload.dc && dnd5eCombatantClassLevel(actorCombatant, 'rogue') >= 20 &&
        (actorCombatant.classResources['dnd5e-stroke-of-luck']?.current ?? 0) > 0 &&
        20 + preview.modifier >= check.payload.dc &&
        await requestSharedStrokeOfLuckChoice(check.actor, {
          targetName: `DC ${check.payload.dc}`,
          attackName: checkLabel,
          total: runningTotal,
          armorClass: check.payload.dc,
          rollType: 'ability-check',
        })
      )
      const resolved = resolvePreparedDnd5eAbilityCheck({
        prepared: check,
        d20,
        d20Second,
        bardicInspirationRoll,
        peerlessSkillRoll,
        darkOnesOwnLuckRoll,
        cuttingWords,
        strokeOfLuck,
      })
      if (!resolved.result.ok || !resolved.application) {
        acknowledgePlayerAction(action, 'rejected', resolved.result.ok ? 'missing-application' : resolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      applyDnd5eCombatApplication(resolved.application)
      if (check.payload.spendAction) {
        updateDnd5eTurnEconomy(
          check.actorToken.id,
          (economy) => spendDnd5eTurnResource(economy, 'action').economy,
          liveRound,
        )
      }
      if (cuttingWords && cuttingWordsCandidate) {
        updateDnd5eTurnEconomy(
          cuttingWordsCandidate.token.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
          liveRound,
        )
      }
      const outcome = resolved.result.events.find((event) => event.type === 'ability-check-resolved')
      if (outcome?.type === 'ability-check-resolved') {
        const features = [
          outcome.bardicInspirationApplied ? `吟游激励 +${outcome.bardicInspirationApplied}` : '',
          outcome.peerlessSkillApplied ? `超凡技艺 +${outcome.peerlessSkillApplied}` : '',
          outcome.darkOnesOwnLuckApplied ? `黑暗之主的幸运 +${outcome.darkOnesOwnLuckApplied}` : '',
          outcome.cuttingWordsApplied ? `尖刻言辞 -${outcome.cuttingWordsApplied}` : '',
          outcome.strokeOfLuckApplied ? '幸运一击：d20视为20' : '',
          outcome.reliableTalentApplied ? '可靠才能' : '',
          outcome.indomitableMightApplied ? '体魄超凡' : '',
        ].filter(Boolean)
        pushCombatLog(
          `${check.actor.name} 进行${checkLabel}：${outcome.total} vs DC ${check.payload.dc}，${outcome.success ? '成功' : '失败'}${features.length ? `（${features.join('；')}）` : ''}。`,
          'system',
        )
      }
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-adjudicated-spell' && action.type === 'dnd5e-adjudicated-spell') {
      const spell = dnd5eSpellbookEntries(useSpellbookStore.getState().spells)
        .find((entry) => entry.id === action.dnd5eAdjudicatedSpell?.spellId)
      const initialPrepared = prepareDnd5eAdjudicatedSpell({
        action,
        spell,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy: currentDnd5eTurnEconomy(action.actorTokenId, liveRound),
        turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      })
      if (!initialPrepared.ok) {
        acknowledgePlayerAction(action, 'rejected', initialPrepared.reason)
        completePlayerActionRequest(action)
        return
      }
      pushCombatLog(
        `${initialPrepared.prepared.actor.name} 请求施放${initialPrepared.prepared.spell.name}，等待 DM 裁定；尚未消费动作或法术位。`,
        'turn',
      )
      const response = await requestSharedDmAdjudication(initialPrepared.prepared)
      const interruptId = `dm-adjudication:${action.id}`
      if (response.decision !== 'approved') {
        await finishSharedCombatInterrupt(interruptId, response)
        pushCombatLog(
          `${initialPrepared.prepared.actor.name} 的${initialPrepared.prepared.spell.name}裁定已取消；未消费动作或法术位${response.note ? `。DM：${response.note}` : '。'}`,
          'system',
        )
        acknowledgePlayerAction(action, 'rejected', 'dm-adjudication-cancelled')
        completePlayerActionRequest(action)
        return
      }
      if (
        roundRef.current !== action.round || initiativeIndexRef.current !== action.initiativeIndex ||
        initiativeOrderRef.current[initiativeIndexRef.current]?.tokenId !== action.actorTokenId
      ) {
        await finishSharedCombatInterrupt(interruptId, { decision: 'cancelled', effects: [], note: '回合已变化，裁定事务取消。' })
        acknowledgePlayerAction(action, 'rejected', 'stale-turn')
        completePlayerActionRequest(action)
        return
      }
      const latestMap = useMapStore.getState().maps.find((map) => map.id === authorityMap.id) ?? authorityMap
      const latestSpell = dnd5eSpellbookEntries(useSpellbookStore.getState().spells)
        .find((entry) => entry.id === action.dnd5eAdjudicatedSpell?.spellId)
      const finalPrepared = prepareDnd5eAdjudicatedSpell({
        action,
        spell: latestSpell,
        map: latestMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy: currentDnd5eTurnEconomy(action.actorTokenId, liveRound),
        turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      })
      if (!finalPrepared.ok) {
        await finishSharedCombatInterrupt(interruptId, { decision: 'cancelled', effects: [], note: finalPrepared.reason })
        acknowledgePlayerAction(action, 'rejected', finalPrepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const initialResolved = resolvePreparedDnd5eAdjudicatedSpell({ prepared: finalPrepared.prepared, response })
      if (!initialResolved.result.ok) {
        await finishSharedCombatInterrupt(interruptId, { decision: 'cancelled', effects: [], note: initialResolved.result.reason })
        acknowledgePlayerAction(action, 'rejected', initialResolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      const resolved = await settleDnd5eConcentrationChecks({
        result: initialResolved.result,
        map: finalPrepared.prepared.map,
        characters: finalPrepared.prepared.characters,
        characterIdByCombatantId: finalPrepared.prepared.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      await commitDnd5eCombatApplication(resolved.application, {
        forceSaveMap: true,
        forceSaveCharacters: true,
      })
      const spentTurnResource = resolved.result.events.find((event) =>
        event.type === 'turn-resource-spent' && (event.resource === 'action' || event.resource === 'bonusAction'),
      )
      if (spentTurnResource?.type === 'turn-resource-spent' && (spentTurnResource.resource === 'action' || spentTurnResource.resource === 'bonusAction')) {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, spentTurnResource.resource as 'action' | 'bonusAction').economy,
          liveRound,
        )
      }
      const damage = resolved.result.events.reduce(
        (total, event) => event.type === 'damage-applied' ? total + event.amount : total,
        0,
      )
      const healing = resolved.result.events.reduce(
        (total, event) => event.type === 'healing-applied' ? total + event.amount : total,
        0,
      )
      const temporaryHp = resolved.result.events.reduce(
        (total, event) => event.type === 'temporary-hit-points-gained' ? total + event.amount : total,
        0,
      )
      const conditionCount = resolved.result.events.filter((event) =>
        event.type === 'condition-applied' || event.type === 'condition-ended',
      ).length
      pushHeadlessCombatLog(
        `${finalPrepared.prepared.actor.name} 施放${finalPrepared.prepared.spell.name}（${finalPrepared.prepared.slotLevel === 0 ? '戏法' : `${finalPrepared.prepared.slotLevel}环位`}），DM 裁定已由 Headless 提交` +
          `${damage ? `；伤害 ${damage}` : ''}${healing ? `；治疗 ${healing}` : ''}${temporaryHp ? `；临时 HP ${temporaryHp}` : ''}${conditionCount ? `；状态变更 ${conditionCount} 项` : ''}${response.note ? `；DM：${response.note}` : ''}。`,
        damage > 0 ? 'damage' : 'turn',
        resolved.result.events,
        response.note ? [`DM 裁定备注：${response.note}`] : [],
      )
      await finishSharedCombatInterrupt(interruptId, response)
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-persistent-area-move' && action.type === 'dnd5e-persistent-area-move') {
      const prepared = prepareDnd5eCoreSpellAreaMove({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy: currentDnd5eTurnEconomy(action.actorTokenId, liveRound),
        geometry: mapGeometryRuntimeForMap(authorityMap.id),
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const resolved = resolvePreparedDnd5eCoreSpellAreaMove({ prepared: prepared.prepared })
      if (!resolved.result.ok || !resolved.application) {
        acknowledgePlayerAction(action, 'rejected', resolved.result.ok ? 'missing-application' : resolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      let areaApplication = resolved.application
      const movedArea = areaApplication.map.dnd5ePluginAreas?.find((area) =>
        area.id === action.dnd5ePersistentAreaMove?.areaId,
      )
      if (movedArea?.coreSpellId === 'flaming-sphere' && movedArea.anchorCell) {
        const impactTarget = prepared.prepared.impactTargetId
          ? areaApplication.map.tokens.find((token) => token.id === prepared.prepared.impactTargetId)
          : undefined
        if (impactTarget) {
          const impact = await settleDnd5ePersistentAreaCandidates({
            candidates: collectDnd5ePersistentAreaTriggers({
              map: areaApplication.map,
              timing: 'on-area-move-impact',
              round: liveRound,
              targetTokenId: impactTarget.id,
              areaId: movedArea.id,
              turnKey: `${liveRound}:${currentInitiativeToken?.id ?? impactTarget.id}`,
            }),
            map: areaApplication.map,
            characters: areaApplication.characters,
            round: liveRound,
          })
          for (const log of impact.logs) pushCombatLog(log, 'system')
          areaApplication = {
            map: impact.map,
            characters: impact.characters,
            changedCharacterIds: impact.characters.flatMap((character) => {
              const before = prepared.prepared.characters.find((candidate) => candidate.id === character.id)
              return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
            }),
            changedTokenIds: impact.map.tokens.flatMap((token) => {
              const before = authorityMap.tokens.find((candidate) => candidate.id === token.id)
              return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
            }),
          }
        }
      }
      applyDnd5eCombatApplication({
        ...areaApplication,
        changedTokenIds: areaApplication.changedTokenIds.filter((tokenId) =>
          !areaApplication.map.tokens.find((token) => token.id === tokenId)?.dnd5eSpellEffect,
        ),
      })
      const latestMap = useMapStore.getState().maps.find((map) => map.id === authorityMap.id) ?? authorityMap
      applyAuthorityMapUpdate(authorityMap.id, {
        dnd5ePluginAreas: areaApplication.map.dnd5ePluginAreas ?? [],
        tokens: mergeDnd5eSpellEffectTokenDelta({
          currentMap: latestMap,
          beforeMap: authorityMap,
          afterMap: areaApplication.map,
        }),
      })
      const spent = resolved.result.events.find((event) =>
        event.type === 'turn-resource-spent' &&
        (event.resource === 'action' || event.resource === 'bonusAction'),
      )
      if (spent?.type === 'turn-resource-spent' && (spent.resource === 'action' || spent.resource === 'bonusAction')) {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, spent.resource as 'action' | 'bonusAction').economy,
          liveRound,
        )
      }
      pushHeadlessCombatLog(
        `${prepared.prepared.characters.find((character) => character.id === action.characterId)?.name ?? '施法者'}移动${movedArea?.label ?? '持续法术区域'}。`,
        'system',
        resolved.result.events,
        [`区域：${movedArea?.label ?? action.dnd5ePersistentAreaMove?.areaId ?? '未知'}｜消耗：${spent?.type === 'turn-resource-spent' && spent.resource === 'bonusAction' ? '附赠动作' : '动作'}`],
      )
      acknowledgePlayerAction(action, 'accepted')
      completePlayerActionRequest(action)
      return
    }

    if (authorityPlan.route === 'dnd5e-spell-cast' && action.type === 'dnd5e-spell-cast') {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const pluginSpell = action.dnd5eSpellCast ? dnd5ePluginSpellDefinition(action.dnd5eSpellCast.spellId) : undefined
      if (pluginSpell) {
        const preparedPluginSpell = prepareDnd5ePluginSpellCast({
          action,
          map: authorityMap,
          characters: useCharacterStore.getState().characters,
          initiativeOrder: initiativeOrderRef.current,
          turnEconomy,
          turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
          roomRequiredPlugins: roomSession ? roomRulesSnapshot?.requiredPlugins : undefined,
          now: runtimeNow(),
        })
        if (!preparedPluginSpell.ok) {
          acknowledgePlayerAction(action, 'rejected', preparedPluginSpell.reason)
          completePlayerActionRequest(action)
          return
        }
        const pluginCast = preparedPluginSpell.prepared
        const mechanics = pluginCast.spell.mechanics!
        const attackD20 = mechanics.resolution === 'spell-attack'
          ? await rollDiceBoxD20(`${pluginCast.spell.name}·法术攻击`, pluginCast.targetToken.label)
          : undefined
        const attackD20Second = mechanics.resolution === 'spell-attack' && pluginCast.attackMode !== 'normal'
          ? await rollDiceBoxD20(`${pluginCast.spell.name}·法术攻击（${pluginCast.attackMode === 'advantage' ? '优势' : '劣势'}）`, pluginCast.targetToken.label)
          : undefined
        const savingThrowD20 = mechanics.resolution === 'saving-throw'
          ? await rollDiceBoxD20(`${pluginCast.spell.name}·豁免`, pluginCast.targetToken.label)
          : undefined
        const savingThrowD20Second = mechanics.resolution === 'saving-throw' && pluginCast.saveMode !== 'normal'
          ? await rollDiceBoxD20(`${pluginCast.spell.name}·豁免（${pluginCast.saveMode === 'advantage' ? '优势' : '劣势'}）`, pluginCast.targetToken.label)
          : undefined
        const selectedAttackD20 = attackD20Second == null
          ? attackD20
          : pluginCast.attackMode === 'advantage' ? Math.max(attackD20!, attackD20Second) : Math.min(attackD20!, attackD20Second)
        const attackHit = selectedAttackD20 == null || selectedAttackD20 === 20 || (selectedAttackD20 !== 1 && selectedAttackD20 + pluginCast.attackModifier >= pluginCast.targetArmorClass)
        const critical = mechanics.resolution === 'spell-attack' && selectedAttackD20 === 20
        const damageCount = mechanics.damage && attackHit ? pluginCast.damageDice.count * (critical ? 2 : 1) : 0
        const damageRolls = damageCount > 0
          ? await rollDiceBoxValues(damageCount, pluginCast.damageDice.sides, `${pluginCast.spell.name}·伤害`, pluginCast.targetToken.label)
          : []
        const resolvedPluginSpell = resolvePreparedDnd5ePluginSpellCast({
          prepared: pluginCast,
          rolls: { attackD20, attackD20Second, savingThrowD20, savingThrowD20Second, damageRolls },
          now: runtimeNow(),
        })
        if (!resolvedPluginSpell.result.ok || !resolvedPluginSpell.application) {
          acknowledgePlayerAction(action, 'rejected', resolvedPluginSpell.result.ok ? 'missing-application' : resolvedPluginSpell.result.reason)
          completePlayerActionRequest(action)
          return
        }
        const settledPluginSpell = await settleDnd5eConcentrationChecks({
          result: resolvedPluginSpell.result,
          map: resolvedPluginSpell.application.map,
          characters: resolvedPluginSpell.application.characters,
          priorApplication: resolvedPluginSpell.application,
          characterIdByCombatantId: pluginCast.characterIdByCombatantId,
          rollD20: rollDiceBoxD20,
          rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
          rollDice: rollDiceBoxValues,
          requestHellishRebuke: requestSharedHellishRebukeChoice,
          requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
          requestBardicInspiration: requestDnd5eBardicInspirationRoll,
          requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
        })
        applyDnd5eCombatApplication(settledPluginSpell.application)
        const spentTurnResource = settledPluginSpell.result.events.find((event) =>
          event.type === 'turn-resource-spent' && (event.resource === 'action' || event.resource === 'bonusAction'),
        )
        if (spentTurnResource?.type === 'turn-resource-spent' && (spentTurnResource.resource === 'action' || spentTurnResource.resource === 'bonusAction')) {
          updateDnd5eTurnEconomy(action.actorTokenId, (economy) => spendDnd5eTurnResource(economy, spentTurnResource.resource as 'action' | 'bonusAction').economy, liveRound)
        }
        const values = damageRolls.length > 0 ? damageRolls : attackD20 != null ? [attackD20] : savingThrowD20 != null ? [savingThrowD20] : []
        if (values.length > 0) {
          const display: DiceRoll = {
            values,
            sides: damageRolls.length > 0 ? pluginCast.damageDice.sides : 20,
            bonus: damageRolls.length > 0 ? pluginCast.damageDice.bonus : attackD20 != null ? pluginCast.attackModifier : pluginCast.saveModifier ?? 0,
            total: values.reduce((total, value) => total + value, 0) + (damageRolls.length > 0 ? pluginCast.damageDice.bonus : attackD20 != null ? pluginCast.attackModifier : pluginCast.saveModifier ?? 0),
            label: `${pluginCast.spell.name}（插件 Headless）`,
            targetName: pluginCast.targetToken.label,
          }
          setRoll(display)
          publishSharedDiceRoll(display)
        }
        const resolutionDetail = mechanics.resolution === 'spell-attack'
          ? `法术攻击${resolvedPluginSpell.attackHit ? '命中' : '未命中'}${resolvedPluginSpell.critical ? '（重击）' : ''}`
          : mechanics.resolution === 'saving-throw'
            ? `${pluginCast.targetToken.label}豁免${resolvedPluginSpell.saveSucceeded ? '成功' : '失败'}`
            : '自动生效'
        pushHeadlessCombatLog(
          `${pluginCast.actor.name}施放插件法术${pluginCast.spell.name}（${pluginCast.slotLevel === 0 ? '戏法' : `${pluginCast.slotLevel}环位`}）：${resolutionDetail}${resolvedPluginSpell.finalDamage ? `，造成 ${resolvedPluginSpell.finalDamage} 点${mechanics.damage?.type ?? ''}伤害` : ''}${pluginCast.concentrationRounds ? `，开始专注（最多 ${pluginCast.concentrationRounds} 轮）` : ''}。`,
          (resolvedPluginSpell.finalDamage ?? 0) > 0 ? 'damage' : 'system',
          settledPluginSpell.result.events,
          [`插件法术：${pluginCast.spell.ownerPluginName ?? '房间规则包'}｜施法环位 ${pluginCast.slotLevel}`],
        )
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted')
        return
      }
      const prepared = prepareDnd5eSpellCast({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
        turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const spellCast = prepared.prepared
      let d20: number | undefined
      let d20Second: number | undefined
      let attackBlessRoll: number | undefined
      let attackBaneRoll: number | undefined
      let savingThrowD20: number | undefined
      let savingThrowD20Second: number | undefined
      let savingThrowBlessRoll: number | undefined
      let savingThrowBaneRoll: number | undefined
      let targetAttacks: Dnd5eSpellTargetAttackRoll[] | undefined
      let empoweredRerolls: Dnd5eEmpoweredSpellReroll[] | undefined
      let targetSavingThrows: Dnd5eSpellTargetSavingThrowRoll[] | undefined
      const forcedMovements: Dnd5eSpellForcedMovement[] = []
      const targetTranquilitySaves: Dnd5eTargetTranquilitySaveRoll[] | undefined =
        spellCast.targetTranquilityWards?.length ? [] : undefined
      let savingThrowRerollD20: number | undefined
      let savingThrowRerollD20Second: number | undefined
      let bardicInspirationRoll: number | undefined
      let cuttingWords: Dnd5eCuttingWordsUse | undefined
      let cuttingWordsDamage: Dnd5eCuttingWordsUse | undefined
      let standAgainstTide: Dnd5eStandAgainstTideUse | undefined
      let darkOnesOwnLuckRoll: number | undefined
      let hurlThroughHellDamageRolls: number[] | undefined
      let protectionCandidate: { character: Character; token: Token } | undefined
      let useProtection = false
      let shieldSpellReaction = false
      let counterspellReaction: Dnd5eCounterspellReaction | undefined
      let dispelMagicChecks: Dnd5eDispelMagicCheck[] | undefined
      const shieldSpellReactionTargetIds: string[] = []
      const legendaryResistanceTargetIds: string[] = []
      const cuttingWordsReactionTokenIds = new Set<string>()
      const tranquilityPreventedTargetIds = new Set<string>()
      let effectRolls: number[]
      let additionalEffectRolls: number[][] = []
      let delayedEffectRolls: number[] = []
      const spellActorCombatant = spellCast.state.combatants[spellCast.actorToken.id]
      if (!spellActorCombatant) {
        acknowledgePlayerAction(action, 'rejected', 'combatant-missing')
        completePlayerActionRequest(action)
        return
      }
      if (spellCast.spell.effect === 'dispel-magic') {
        const targetCombatant = spellCast.state.combatants[spellCast.targetToken.id]
        const candidates = new Map<string, { effectId: string; spellId: string; spellLevel: number }>()
        for (const effect of targetCombatant?.classState.activeEffects ?? []) {
          if (effect.source.kind !== 'spell' || !effect.source.rulesId) continue
          const catalog = getDnd5eSrdSpellCatalogEntry(effect.source.rulesId)
          if (!catalog) continue
          const key = `${effect.source.actorId ?? 'unknown'}\u0000${catalog.id}`
          if (!candidates.has(key)) candidates.set(key, { effectId: effect.id, spellId: catalog.id, spellLevel: catalog.level })
        }
        for (const [sourceActorId, spellId] of Object.entries(targetCombatant?.classState.concentrationEffectsBySource ?? {})) {
          const catalog = getDnd5eSrdSpellCatalogEntry(spellId)
          if (!catalog) continue
          const key = `${sourceActorId}\u0000${catalog.id}`
          if (!candidates.has(key)) {
            candidates.set(key, {
              effectId: `concentration:${sourceActorId}:${catalog.id}`,
              spellId: catalog.id,
              spellLevel: catalog.level,
            })
          }
        }
        dispelMagicChecks = []
        for (const candidate of candidates.values()) {
          if (candidate.spellLevel <= spellCast.slotLevel) continue
          dispelMagicChecks.push({
            effectId: candidate.effectId,
            d20: await rollDiceBoxD20(
              `解除魔法·${candidate.spellId}（DC ${10 + candidate.spellLevel}）`,
              spellCast.actor.name,
            ),
          })
        }
      }
      const adjudicatedForcedFallTargetIds = new Set<string>()
      const adjudicateForcedFall = async (targetToken: Token) => {
        const fromElevationFeet = Math.max(0, Math.floor(targetToken.elevationFeet ?? 0))
        if (fromElevationFeet < 10 || adjudicatedForcedFallTargetIds.has(targetToken.id)) return {}
        adjudicatedForcedFallTargetIds.add(targetToken.id)
        const falls = await showCombatDialog({
          title: '强制位移与高台坠落',
          message: `${targetToken.label} 当前海拔为 ${fromElevationFeet} 尺。这次强制位移是否使其离开支撑面并坠落到 0 尺？`,
          confirmText: '坠落并结算',
          cancelText: '保持当前海拔',
          tone: 'amber',
        })
        if (!falls) return {}
        const dice = dnd5eFallingDamageDice(fromElevationFeet)
        return {
          toElevationFeet: 0,
          fallingDamageRolls: await rollDiceBoxValues(dice, 6, '强制位移·坠落伤害', targetToken.label),
        }
      }
      const counterspellCandidate = Object.values(spellCast.state.combatants).flatMap((combatant) => {
        if (combatant.controller === spellActorCombatant.controller || combatant.currentHp <= 0) return []
        const distance = spellCast.state.distanceFeetByCombatantPair?.[
          dnd5eCombatantPairKey(combatant.id, spellActorCombatant.id)
        ] ?? Number.POSITIVE_INFINITY
        if (distance > 60) return []
        const slotLevels = dnd5eCounterspellSlotLevels(combatant)
        if (slotLevels.length === 0) return []
        const characterId = spellCast.characterIdByCombatantId[combatant.id]
        const character = characterId
          ? spellCast.characters.find((candidate) => candidate.id === characterId)
          : undefined
        if (!character) return []
        const automaticSlot = slotLevels.find((level) => level >= spellCast.slotLevel)
        return [{ combatant, character, slotLevel: automaticSlot ?? slotLevels[0] }]
      })[0]
      if (counterspellCandidate) {
        const abilityCheckDc = counterspellCandidate.slotLevel < spellCast.slotLevel
          ? 10 + spellCast.slotLevel
          : undefined
        const accepted = await requestSharedCounterspellChoice(counterspellCandidate.character, {
          casterName: spellCast.actor.name,
          spellName: spellCast.spell.name,
          spellLevel: spellCast.slotLevel,
          counterspellSlotLevel: counterspellCandidate.slotLevel,
          abilityCheckDc,
        })
        if (accepted) {
          const ability = dnd5eCounterspellCastingAbility(
            counterspellCandidate.combatant,
            counterspellCandidate.slotLevel,
          ) ?? 'cha'
          const d20 = abilityCheckDc == null
            ? undefined
            : await rollDiceBoxD20('法术反制·施法属性检定', counterspellCandidate.character.name)
          counterspellReaction = {
            actorId: counterspellCandidate.combatant.id,
            slotLevel: counterspellCandidate.slotLevel,
            abilityCheckTotal: d20 == null
              ? undefined
              : d20 + Math.floor((counterspellCandidate.combatant.abilities[ability] - 10) / 2),
          }
        }
      }
      const counterspellSucceeded = !!counterspellReaction && (
        counterspellReaction.slotLevel >= spellCast.slotLevel ||
        (counterspellReaction.abilityCheckTotal ?? Number.NEGATIVE_INFINITY) >= 10 + spellCast.slotLevel
      )
      const spellResolutionContinues = !counterspellSucceeded
      const tranquility: { passed: boolean; roll?: Dnd5eTranquilitySaveRoll } = spellResolutionContinues
        ? await rollDnd5eTranquilityWard({
            ward: spellCast.tranquilityWard,
            attacker: spellActorCombatant,
            attackerCharacter: spellCast.actor,
            attackerName: spellCast.actor.name,
          })
        : { passed: true }
      let tranquilityBardicInspirationCommitted = tranquility.roll?.bardicInspirationRoll != null
      let tranquilityRerollCommitted = tranquility.roll?.rerollD20 != null
      let tranquilityDarkOnesOwnLuckCommitted = tranquility.roll?.darkOnesOwnLuckRoll != null
      if (!tranquility.passed) tranquilityPreventedTargetIds.add(spellCast.targetToken.id)
      for (const targetWard of spellResolutionContinues ? spellCast.targetTranquilityWards ?? [] : []) {
        const targetTranquility = await rollDnd5eTranquilityWard({
          ward: targetWard.ward,
          attacker: spellActorCombatant,
          attackerCharacter: spellCast.actor,
          attackerName: `${spellCast.actor.name} → ${targetWard.targetToken.label}`,
          bardicInspirationAvailable: !tranquilityBardicInspirationCommitted,
          savingThrowRerollAvailable: !tranquilityRerollCommitted,
          darkOnesOwnLuckAvailable: !tranquilityDarkOnesOwnLuckCommitted,
        })
        if (targetTranquility.roll) {
          targetTranquilitySaves!.push({ targetId: targetWard.targetToken.id, save: targetTranquility.roll })
          tranquilityBardicInspirationCommitted ||= targetTranquility.roll.bardicInspirationRoll != null
          tranquilityRerollCommitted ||= targetTranquility.roll.rerollD20 != null
          tranquilityDarkOnesOwnLuckCommitted ||= targetTranquility.roll.darkOnesOwnLuckRoll != null
        }
        if (!targetTranquility.passed) tranquilityPreventedTargetIds.add(targetWard.targetToken.id)
      }
      if (!spellResolutionContinues || !tranquility.passed) {
        effectRolls = []
      } else if (spellCast.targetSpellAttacks != null) {
        targetAttacks = []
        const protectionReactionActorIds = new Set<string>()
        let bardicInspirationCommitted = tranquilityBardicInspirationCommitted
        const sequencedSpellAttack = dnd5eSpellUsesSequencedAttacks(spellCast.spell)
        const attackDiceCount = spellCast.spell.id === 'eldritch-blast' ? 1 : spellCast.diceCount
        const spellAttackLabel = sequencedSpellAttack ? '射线' : '孪生法术攻击'
        const simulatedRepellingPositions = new Map<string, { x: number; y: number }>()
        let hurlThroughHellCommitted = false
        for (let targetIndex = 0; targetIndex < spellCast.targetSpellAttacks.length; targetIndex += 1) {
          const targetAttack = spellCast.targetSpellAttacks[targetIndex]
          if (tranquilityPreventedTargetIds.has(targetAttack.targetToken.id)) continue
          const protection = findDnd5eProtectionCandidate(
            authorityMap,
            spellCast.actorToken,
            targetAttack.targetToken,
            new Set([...protectionReactionActorIds, ...cuttingWordsReactionTokenIds]),
          )
          const protectedAttack = !!(
            protection && !protectionReactionActorIds.has(protection.token.id) &&
            await requestSharedProtectionChoice(protection.character, {
              attackerName: spellCast.actorToken.label,
              targetName: targetAttack.targetToken.label,
              attackName: `${spellCast.spell.name}·${spellAttackLabel}`,
            })
          )
          if (protectedAttack && protection) protectionReactionActorIds.add(protection.token.id)
          const attackMode = dnd5eSpellAttackModeWithProtection(targetAttack.mode, protectedAttack)
          const targetD20 = await rollDiceBoxD20(`${spellCast.spell.name}·${spellAttackLabel}`, targetAttack.targetToken.label)
          const targetD20Second = attackMode !== 'normal'
            ? await rollDiceBoxD20(
                `${spellCast.spell.name}·${spellAttackLabel}（${attackMode === 'advantage' ? '优势' : '劣势'}）`,
                targetAttack.targetToken.label,
              )
            : undefined
          const targetBlessRoll = spellCast.attackBlessed
            ? (await rollDiceBoxValues(1, 4, '祝福术·法术攻击加值', spellCast.actorToken.label))[0]
            : undefined
          const targetBaneRoll = spellCast.attackBaned
            ? (await rollDiceBoxValues(1, 4, '灾祸术·法术攻击减值', spellCast.actorToken.label))[0]
            : undefined
          const preview = previewDnd5eSpellTargetAttack(
            spellCast,
            targetIndex,
            targetD20,
            targetD20Second,
            protectedAttack,
            targetBlessRoll,
            targetBaneRoll,
          )
          const inspirationDie = !bardicInspirationCommitted
            ? dnd5eHeldBardicInspirationDie(spellActorCombatant)
            : undefined
          const targetBardicInspirationRoll = !preview.hit && !preview.roll.naturalOne && inspirationDie &&
            preview.roll.total + inspirationDie >= preview.targetAc
            ? await requestDnd5eBardicInspirationRoll({
                target: spellCast.actor,
                targetName: spellCast.actor.name,
                dieSides: inspirationDie,
                rollType: '攻击检定',
                total: preview.roll.total,
                targetNumber: preview.targetAc,
              })
            : undefined
          if (targetBardicInspirationRoll != null) bardicInspirationCommitted = true
          const attackTotalBeforeCuttingWords = preview.roll.total + (targetBardicInspirationRoll ?? 0)
          const hitBeforeCuttingWords = preview.roll.naturalTwenty || (!preview.roll.naturalOne &&
            attackTotalBeforeCuttingWords >= preview.targetAc)
          const cuttingWordsCandidate = hitBeforeCuttingWords && !preview.roll.naturalTwenty
            ? findDnd5eCuttingWordsCandidate(
                authorityMap,
                spellCast.state,
                spellCast.actorToken,
                targetAttack.targetToken,
                new Set([...protectionReactionActorIds, ...cuttingWordsReactionTokenIds]),
              )
            : undefined
          const targetCuttingWords = cuttingWordsCandidate &&
            attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < preview.targetAc
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
                attackerName: spellCast.actor.name,
                targetName: targetAttack.targetToken.label,
                attackName: `${spellCast.spell.name}·${spellAttackLabel}`,
                total: attackTotalBeforeCuttingWords,
                targetNumber: preview.targetAc,
              })
            : undefined
          if (targetCuttingWords && cuttingWordsCandidate) cuttingWordsReactionTokenIds.add(cuttingWordsCandidate.token.id)
          const targetAttackTotal = attackTotalBeforeCuttingWords - (targetCuttingWords?.roll ?? 0)
          let attackHit = preview.roll.naturalTwenty || (!preview.roll.naturalOne && targetAttackTotal >= preview.targetAc)
          const targetCombatant = spellCast.state.combatants[targetAttack.targetToken.id]
          const targetCharacter = targetAttack.targetToken.characterId
            ? spellCast.characters.find((character) => character.id === targetAttack.targetToken.characterId)
            : undefined
          const targetShieldSpellReaction = !!(
            attackHit && !cuttingWordsReactionTokenIds.has(targetAttack.targetToken.id) &&
            targetCombatant && targetCharacter && dnd5eCanCastShieldSpell(targetCombatant) &&
            await requestSharedShieldSpellChoice(targetCharacter, {
              attackerName: spellCast.actor.name,
              attackName: `${spellCast.spell.name}·${spellAttackLabel}`,
              attackTotal: targetAttackTotal,
              armorClass: preview.targetAc,
            })
          )
          if (targetShieldSpellReaction && !preview.roll.naturalTwenty) {
            attackHit = targetAttackTotal >= preview.targetAc + 5
          }
          const targetStandAgainstTide = !attackHit && !targetShieldSpellReaction && spellCast.spell.rangeFeet <= 5
            ? await buildDnd5eStandAgainstTideUse({
                map: authorityMap,
                state: spellCast.state,
                attackerToken: spellCast.actorToken,
                hunterToken: targetAttack.targetToken,
                attackerName: spellCast.actor.name,
                attackName: `${spellCast.spell.name}·${spellAttackLabel}`,
                attackModifier: preview.roll.modifier - (targetBlessRoll ?? 0) + (targetBaneRoll ?? 0),
                reachFeet: 5,
                damage: [{
                  count: attackDiceCount,
                  sides: spellCast.spell.dice.sides,
                  bonus: spellCast.effectBonus,
                  type: spellCast.spell.damageType,
                }],
                maximizedDamage: spellCast.overchannel,
                bardicInspirationAlreadyUsed: bardicInspirationCommitted,
                excludedReactionTokenIds: new Set([...protectionReactionActorIds, ...cuttingWordsReactionTokenIds]),
              })
            : undefined
          const targetUncannyDodge = !!(
            attackHit && !targetShieldSpellReaction && targetCharacter && targetCombatant && dnd5eCanUseUncannyDodge(targetCombatant) &&
            await requestSharedUncannyDodgeChoice(targetCharacter, {
              attackerName: spellCast.actor.name,
              attackName: `${spellCast.spell.name}·${spellAttackLabel}`,
            })
          )
          const targetHurlThroughHellDamageRolls = attackHit && !hurlThroughHellCommitted &&
            spellActorCombatant.classState.hurlThroughHellReady
            ? await rollDiceBoxValues(10, 10, '坠入地狱·返回伤害', targetAttack.targetToken.label)
            : undefined
          if (targetHurlThroughHellDamageRolls) hurlThroughHellCommitted = true
          let repellingBlastPushTo: { x: number; y: number } | undefined
          let repellingBlastPushDistanceFeet: number | undefined
          let repellingBlastPushToElevationFeet: number | undefined
          let repellingBlastFallingDamageRolls: number[] | undefined
          if (attackHit && spellCast.repellingBlast) {
            const currentPosition = simulatedRepellingPositions.get(targetAttack.targetToken.id) ?? {
              x: targetAttack.targetToken.x,
              y: targetAttack.targetToken.y,
            }
            const simulatedTokens = authorityMap.tokens.map((token) => {
              const simulatedPosition = simulatedRepellingPositions.get(token.id)
              return simulatedPosition ? { ...token, ...simulatedPosition } : token
            })
            const push = dnd5eRepellingBlastPushDestination(
              { ...authorityMap, tokens: simulatedTokens },
              spellCast.actorToken,
              { ...targetAttack.targetToken, ...currentPosition },
            )
            if (push.distanceFeet > 0) {
              repellingBlastPushTo = push.to
              repellingBlastPushDistanceFeet = push.distanceFeet
              const fall = await adjudicateForcedFall(targetAttack.targetToken)
              repellingBlastPushToElevationFeet = fall.toElevationFeet
              repellingBlastFallingDamageRolls = fall.fallingDamageRolls
              simulatedRepellingPositions.set(targetAttack.targetToken.id, push.to)
            }
          }
          targetAttacks.push({
            targetId: targetAttack.targetToken.id,
            d20: targetD20,
            d20Second: targetD20Second,
            attackBlessRoll: targetBlessRoll,
            attackBaneRoll: targetBaneRoll,
            bardicInspirationRoll: targetBardicInspirationRoll,
            cuttingWords: targetCuttingWords,
            mode: targetAttack.mode,
            protectionReactionActorId: protectedAttack ? protection?.token.id : undefined,
            shieldSpellReaction: targetShieldSpellReaction,
            uncannyDodge: targetUncannyDodge,
            standAgainstTide: targetStandAgainstTide,
            hurlThroughHellDamageRolls: targetHurlThroughHellDamageRolls,
            repellingBlastPushTo,
            repellingBlastPushDistanceFeet,
            repellingBlastPushToElevationFeet,
            repellingBlastFallingDamageRolls,
            effectRolls: attackHit && !spellCast.overchannel
              ? await rollDiceBoxValues(
                  attackDiceCount * (preview.roll.naturalTwenty ? 2 : 1),
                  spellCast.spell.dice.sides,
                  `${spellCast.spell.name}·${sequencedSpellAttack ? '射线伤害' : '孪生伤害'}`,
                  targetAttack.targetToken.label,
                )
              : [],
          })
        }
        effectRolls = []
      } else if (spellCast.spell.effect === 'spell-attack') {
        protectionCandidate = findDnd5eProtectionCandidate(
          authorityMap,
          spellCast.actorToken,
          spellCast.targetToken,
          cuttingWordsReactionTokenIds,
        )
        useProtection = !!(protectionCandidate && await requestSharedProtectionChoice(protectionCandidate.character, {
          attackerName: spellCast.actorToken.label,
          targetName: spellCast.targetToken.label,
          attackName: `${spellCast.spell.name}法术攻击`,
        }))
        const attackMode = dnd5eSpellAttackModeWithProtection(spellCast.attackMode!, useProtection)
        d20 = await rollDiceBoxD20(`${spellCast.spell.name}·法术攻击`, spellCast.targetToken.label)
        d20Second = attackMode !== 'normal'
          ? await rollDiceBoxD20(`${spellCast.spell.name}·法术攻击（${attackMode === 'advantage' ? '优势' : '劣势'}）`, spellCast.targetToken.label)
          : undefined
        attackBlessRoll = spellCast.attackBlessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·法术攻击加值', spellCast.actorToken.label))[0]
          : undefined
        attackBaneRoll = spellCast.attackBaned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·法术攻击减值', spellCast.actorToken.label))[0]
          : undefined
        const preview = previewDnd5eSpellAttack(spellCast, d20, d20Second, useProtection, attackBlessRoll, attackBaneRoll)
        const inspirationDie = tranquility.roll?.bardicInspirationRoll == null
          ? dnd5eHeldBardicInspirationDie(spellActorCombatant)
          : undefined
        bardicInspirationRoll = !preview.hit && !preview.roll.naturalOne && inspirationDie &&
          preview.roll.total + inspirationDie >= preview.targetAc
          ? await requestDnd5eBardicInspirationRoll({
              target: spellCast.actor,
              targetName: spellCast.actor.name,
              dieSides: inspirationDie,
              rollType: '攻击检定',
              total: preview.roll.total,
              targetNumber: preview.targetAc,
            })
          : undefined
        const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
        const hitBeforeCuttingWords = preview.roll.naturalTwenty || (!preview.roll.naturalOne &&
          attackTotalBeforeCuttingWords >= preview.targetAc)
        const cuttingWordsCandidate = hitBeforeCuttingWords && !preview.roll.naturalTwenty
          ? findDnd5eCuttingWordsCandidate(
              authorityMap,
              spellCast.state,
              spellCast.actorToken,
              spellCast.targetToken,
              useProtection && protectionCandidate ? new Set([protectionCandidate.token.id]) : cuttingWordsReactionTokenIds,
            )
          : undefined
        cuttingWords = cuttingWordsCandidate &&
          attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < preview.targetAc
          ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
              attackerName: spellCast.actor.name,
              targetName: spellCast.targetToken.label,
              attackName: `${spellCast.spell.name}法术攻击`,
              total: attackTotalBeforeCuttingWords,
              targetNumber: preview.targetAc,
            })
          : undefined
        if (cuttingWords && cuttingWordsCandidate) cuttingWordsReactionTokenIds.add(cuttingWordsCandidate.token.id)
        const attackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
        let attackHit = preview.roll.naturalTwenty || (!preview.roll.naturalOne && attackTotal >= preview.targetAc)
        const shieldTargetCombatant = spellCast.state.combatants[spellCast.targetToken.id]
        const shieldTargetCharacter = spellCast.targetToken.characterId
          ? spellCast.characters.find((character) => character.id === spellCast.targetToken.characterId)
          : undefined
        shieldSpellReaction = !!(
          attackHit && !cuttingWordsReactionTokenIds.has(spellCast.targetToken.id) &&
          shieldTargetCombatant && shieldTargetCharacter && dnd5eCanCastShieldSpell(shieldTargetCombatant) &&
          await requestSharedShieldSpellChoice(shieldTargetCharacter, {
            attackerName: spellCast.actor.name,
            attackName: `${spellCast.spell.name}法术攻击`,
            attackTotal,
            armorClass: preview.targetAc,
          })
        )
        if (shieldSpellReaction && !preview.roll.naturalTwenty) {
          attackHit = attackTotal >= preview.targetAc + 5
        }
        standAgainstTide = !attackHit && !shieldSpellReaction && spellCast.spell.rangeFeet <= 5
          ? await buildDnd5eStandAgainstTideUse({
              map: authorityMap,
              state: spellCast.state,
              attackerToken: spellCast.actorToken,
              hunterToken: spellCast.targetToken,
              attackerName: spellCast.actor.name,
              attackName: `${spellCast.spell.name}法术攻击`,
              attackModifier: preview.roll.modifier - (attackBlessRoll ?? 0) + (attackBaneRoll ?? 0),
              reachFeet: 5,
              damage: [{
                count: spellCast.diceCount,
                sides: spellCast.spell.dice.sides,
                bonus: spellCast.effectBonus,
                type: spellCast.spell.damageType,
              }],
              maximizedDamage: spellCast.overchannel,
              bardicInspirationAlreadyUsed: bardicInspirationRoll != null || tranquilityBardicInspirationCommitted,
              excludedReactionTokenIds: new Set([
                ...(useProtection && protectionCandidate ? [protectionCandidate.token.id] : []),
                ...cuttingWordsReactionTokenIds,
              ]),
            })
          : undefined
        effectRolls = (attackHit || spellCast.spell.spellAttackMissDamage === 'half') && !spellCast.overchannel
          ? await rollDiceBoxValues(spellCast.diceCount * (preview.roll.naturalTwenty ? 2 : 1), spellCast.spell.dice.sides, `${spellCast.spell.name}效果`, spellCast.targetToken.label)
          : []
        delayedEffectRolls = attackHit && !spellCast.overchannel && spellCast.delayedDamageDiceCount > 0 && spellCast.spell.delayedDamage
          ? await rollDiceBoxValues(
              spellCast.delayedDamageDiceCount,
              spellCast.spell.delayedDamage.dice.sides,
              `${spellCast.spell.name}·后续伤害`,
              spellCast.targetToken.label,
            )
          : []
        hurlThroughHellDamageRolls = attackHit && spellActorCombatant.classState.hurlThroughHellReady
          ? await rollDiceBoxValues(10, 10, '坠入地狱·返回伤害', spellCast.targetToken.label)
          : undefined
      } else if (spellCast.targetSavingThrows != null) {
        targetSavingThrows = []
        let multiTargetDamageRequired = false
        for (let targetIndex = 0; targetIndex < (spellCast.targetSavingThrows?.length ?? 0); targetIndex += 1) {
          const targetSave = spellCast.targetSavingThrows![targetIndex]
          const saveD20 = await rollDiceBoxD20(
            `${spellCast.spell.name}·${spellCast.spell.saveAbility?.toUpperCase()}豁免`,
            targetSave.targetToken.label,
          )
          const saveD20Second = targetSave.mode !== 'normal'
            ? await rollDiceBoxD20(
                `${spellCast.spell.name}·豁免（${targetSave.mode === 'advantage' ? '优势' : '劣势'}）`,
                targetSave.targetToken.label,
              )
            : undefined
          const blessRoll = targetSave.blessed
            ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', targetSave.targetToken.label))[0]
            : undefined
          const baneRoll = targetSave.baned
            ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', targetSave.targetToken.label))[0]
            : undefined
          let preview = previewDnd5eSpellTargetSavingThrow(
            spellCast,
            targetIndex,
            saveD20,
            saveD20Second,
            blessRoll,
            baneRoll,
          )
          const targetCombatant = spellCast.state.combatants[targetSave.targetToken.id]
          const targetCharacter = targetSave.targetToken.characterId
            ? spellCast.characters.find((character) => character.id === targetSave.targetToken.characterId)
            : undefined
          const inspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
          const targetBardicInspirationRoll = !preview.success && inspirationDie &&
            preview.roll.total + inspirationDie >= targetSave.dc
            ? await requestDnd5eBardicInspirationRoll({
                target: targetCharacter,
                targetName: targetSave.targetToken.label,
                dieSides: inspirationDie,
                rollType: '豁免',
                total: preview.roll.total,
                targetNumber: targetSave.dc,
              })
            : undefined
          if (targetBardicInspirationRoll != null) {
            preview = {
              ...preview,
              roll: {
                ...preview.roll,
                modifier: preview.roll.modifier + targetBardicInspirationRoll,
                total: preview.roll.total + targetBardicInspirationRoll,
              },
              success: preview.roll.total + targetBardicInspirationRoll >= targetSave.dc,
            }
          }
          const targetDarkOnesOwnLuckRoll = !preview.success && targetCombatant &&
            dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
            ? await requestDnd5eDarkOnesOwnLuckRoll({
                target: targetCharacter,
                targetName: targetSave.targetToken.label,
                rollType: '豁免',
                total: preview.roll.total,
                targetNumber: targetSave.dc,
              })
            : undefined
          if (targetDarkOnesOwnLuckRoll != null) {
            preview = {
              ...preview,
              roll: {
                ...preview.roll,
                modifier: preview.roll.modifier + targetDarkOnesOwnLuckRoll,
                total: preview.roll.total + targetDarkOnesOwnLuckRoll,
              },
              success: preview.roll.total + targetDarkOnesOwnLuckRoll >= targetSave.dc,
            }
          }
          let rerollD20: number | undefined
          let rerollD20Second: number | undefined
          const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
          if (!preview.success && targetCharacter && rerollFeature) {
            const reroll = await requestDnd5eSavingThrowRerollDice({
              target: targetCharacter,
              targetName: targetSave.targetToken.label,
              featureName: rerollFeature.name,
              total: preview.roll.total,
              dc: targetSave.dc,
              mode: targetSave.mode,
            })
            rerollD20 = reroll?.d20
            rerollD20Second = reroll?.d20Second
          if (rerollD20 != null) {
              preview = previewDnd5eSpellTargetSavingThrow(
                spellCast,
                targetIndex,
                rerollD20,
                rerollD20Second,
                blessRoll,
                baneRoll,
              )
            }
          }
          const legendaryResistance = !preview.success && targetCombatant &&
            (targetCombatant.classState.legendaryResistanceUses ?? 0) > 0
            ? await requestSharedLegendaryResistanceChoice({
                targetTokenId: targetSave.targetToken.id,
                targetName: targetSave.targetToken.label,
                effectName: spellCast.spell.name,
                total: preview.roll.total,
                dc: targetSave.dc,
                remainingUses: targetCombatant.classState.legendaryResistanceUses!,
              })
            : false
          if (legendaryResistance) {
            preview = { ...preview, success: true }
            legendaryResistanceTargetIds.push(targetSave.targetToken.id)
          }
          targetSavingThrows.push({
            targetId: targetSave.targetToken.id,
            d20: saveD20,
            d20Second: saveD20Second,
            blessRoll,
            baneRoll,
            rerollD20,
            rerollD20Second,
            bardicInspirationRoll: targetBardicInspirationRoll,
            darkOnesOwnLuckRoll: targetDarkOnesOwnLuckRoll,
            legendaryResistance,
          })
          if (!preview.success && spellCast.spell.id === 'thunderwave') {
            const push = dnd5eRepellingBlastPushDestination(
              authorityMap,
              spellCast.actorToken,
              targetSave.targetToken,
            )
            if (push.distanceFeet > 0) {
              const fall = await adjudicateForcedFall(targetSave.targetToken)
              forcedMovements.push({
                targetId: targetSave.targetToken.id,
                to: push.to,
                distanceFeet: push.distanceFeet,
                ...fall,
              })
            }
          }
          multiTargetDamageRequired ||=
            !preview.success ||
            spellCast.spell.damageOnSuccessfulSave === 'half' ||
            (spellCast.castingClassId === 'wizard' &&
              dnd5eCombatantHasSubclass(spellActorCombatant, 'wizard', 'evocation') &&
              spellCast.castingClassLevel >= 6 && spellCast.spell.level === 0)
        }
        effectRolls = spellCast.overchannel || spellCast.spell.effect === 'attack-save-debuff' ||
          spellCast.diceCount < 1 || !multiTargetDamageRequired
          ? []
          : await rollDiceBoxValues(
              spellCast.diceCount,
              spellCast.spell.dice.sides,
              `${spellCast.spell.name}效果`,
              spellCast.targetTokens.map((target) => target.label).join('、'),
            )
      } else if (spellCast.spell.effect === 'saving-throw') {
        savingThrowD20 = await rollDiceBoxD20(`${spellCast.spell.name}·${spellCast.spell.saveAbility?.toUpperCase()}豁免`, spellCast.targetToken.label)
        savingThrowD20Second = spellCast.savingThrow?.mode !== 'normal'
          ? await rollDiceBoxD20(`${spellCast.spell.name}·豁免（${spellCast.savingThrow?.mode === 'advantage' ? '优势' : '劣势'}）`, spellCast.targetToken.label)
          : undefined
        savingThrowBlessRoll = spellCast.savingThrowBlessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·豁免加值', spellCast.targetToken.label))[0]
          : undefined
        savingThrowBaneRoll = spellCast.savingThrowBaned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·豁免减值', spellCast.targetToken.label))[0]
          : undefined
        let preview = previewDnd5eSpellSavingThrow(
          spellCast,
          savingThrowD20,
          savingThrowD20Second,
          savingThrowBlessRoll,
          savingThrowBaneRoll,
        )
        const targetCharacter = spellCast.targetToken.characterId
          ? spellCast.characters.find((character) => character.id === spellCast.targetToken.characterId)
          : undefined
        const targetCombatant = spellCast.state.combatants[spellCast.targetToken.id]
        const inspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
        bardicInspirationRoll = !preview.success && inspirationDie &&
          preview.roll.total + inspirationDie >= spellCast.savingThrow!.dc
          ? await requestDnd5eBardicInspirationRoll({
              target: targetCharacter,
              targetName: spellCast.targetToken.label,
              dieSides: inspirationDie,
              rollType: '豁免',
              total: preview.roll.total,
              targetNumber: spellCast.savingThrow!.dc,
            })
          : undefined
        if (bardicInspirationRoll != null) {
          preview = {
            ...preview,
            roll: {
              ...preview.roll,
              modifier: preview.roll.modifier + bardicInspirationRoll,
              total: preview.roll.total + bardicInspirationRoll,
            },
            success: preview.roll.total + bardicInspirationRoll >= spellCast.savingThrow!.dc,
          }
        }
        darkOnesOwnLuckRoll = !preview.success && targetCombatant && dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
          ? await requestDnd5eDarkOnesOwnLuckRoll({
              target: targetCharacter,
              targetName: spellCast.targetToken.label,
              rollType: '豁免',
              total: preview.roll.total,
              targetNumber: spellCast.savingThrow!.dc,
            })
          : undefined
        if (darkOnesOwnLuckRoll != null) {
          preview = {
            ...preview,
            roll: {
              ...preview.roll,
              modifier: preview.roll.modifier + darkOnesOwnLuckRoll,
              total: preview.roll.total + darkOnesOwnLuckRoll,
            },
            success: preview.roll.total + darkOnesOwnLuckRoll >= spellCast.savingThrow!.dc,
          }
        }
        const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
        if (
          !preview.success &&
          targetCharacter &&
          rerollFeature &&
          await requestSharedSavingThrowRerollChoice(targetCharacter, {
            featureName: rerollFeature.name,
            total: preview.roll.total,
            dc: spellCast.savingThrow!.dc,
          })
        ) {
          savingThrowRerollD20 = await rollDiceBoxD20(
            `${rerollFeature.name}·${spellCast.spell.name}豁免重掷`,
            spellCast.targetToken.label,
          )
          savingThrowRerollD20Second = spellCast.savingThrow!.mode !== 'normal'
            ? await rollDiceBoxD20(
                `${rerollFeature.name}·豁免重掷（${spellCast.savingThrow!.mode === 'advantage' ? '优势' : '劣势'}）`,
                spellCast.targetToken.label,
              )
            : undefined
          preview = previewDnd5eSpellSavingThrow(
            spellCast,
            savingThrowRerollD20,
            savingThrowRerollD20Second,
            savingThrowBlessRoll,
            savingThrowBaneRoll,
          )
        }
        const legendaryResistance = !preview.success && targetCombatant &&
          (targetCombatant.classState.legendaryResistanceUses ?? 0) > 0
          ? await requestSharedLegendaryResistanceChoice({
              targetTokenId: spellCast.targetToken.id,
              targetName: spellCast.targetToken.label,
              effectName: spellCast.spell.name,
              total: preview.roll.total,
              dc: spellCast.savingThrow!.dc,
              remainingUses: targetCombatant.classState.legendaryResistanceUses!,
            })
          : false
        if (legendaryResistance) {
          preview = { ...preview, success: true }
          legendaryResistanceTargetIds.push(spellCast.targetToken.id)
        }
        if (!preview.success && spellCast.spell.id === 'thunderwave') {
          const push = dnd5eRepellingBlastPushDestination(
            authorityMap,
            spellCast.actorToken,
            spellCast.targetToken,
          )
          if (push.distanceFeet > 0) {
            const fall = await adjudicateForcedFall(spellCast.targetToken)
            forcedMovements.push({
              targetId: spellCast.targetToken.id,
              to: push.to,
              distanceFeet: push.distanceFeet,
              ...fall,
            })
          }
        }
        effectRolls = spellCast.overchannel || spellCast.diceCount < 1 ||
          (preview.success && spellCast.spell.damageOnSuccessfulSave !== 'half')
          ? []
          : await rollDiceBoxValues(spellCast.diceCount, spellCast.spell.dice.sides, `${spellCast.spell.name}效果`, spellCast.targetToken.label)
      } else if (
        spellCast.spell.effect === 'mark' || spellCast.spell.effect === 'armor-class-buff' ||
        spellCast.spell.effect === 'attack-save-buff' || spellCast.spell.effect === 'power-word-kill' ||
        spellCast.spell.effect === 'power-word-stun' || spellCast.spell.effect === 'stabilize' ||
        spellCast.spell.effect === 'remove-condition' || spellCast.spell.effect === 'fixed-healing' ||
        spellCast.spell.effect === 'healing-pool' || spellCast.spell.effect === 'counterspell' ||
        spellCast.spell.effect === 'active-effect' || spellCast.spell.effect === 'dispel-magic' ||
        spellCast.spell.effect === 'persistent-area'
      ) {
        effectRolls = []
      } else if (spellCast.spell.id === 'magic-missile') {
        for (const target of spellCast.targetTokens) {
          if (tranquilityPreventedTargetIds.has(target.id)) continue
          const targetCombatant = spellCast.state.combatants[target.id]
          const targetCharacter = target.characterId
            ? spellCast.characters.find((character) => character.id === target.characterId)
            : undefined
          if (
            targetCombatant && targetCharacter && dnd5eCanCastShieldSpell(targetCombatant) &&
            await requestSharedShieldSpellChoice(targetCharacter, {
              attackerName: spellCast.actor.name,
              attackName: spellCast.spell.name,
              magicMissile: true,
            })
          ) shieldSpellReactionTargetIds.push(target.id)
        }
        effectRolls = spellCast.overchannel
          ? []
          : await rollDiceBoxValues(
              spellCast.diceCount,
              spellCast.spell.dice.sides,
              `${spellCast.spell.name}效果`,
              spellCast.targetTokens.map((target) => target.label).join('、'),
            )
      } else {
        effectRolls = spellCast.overchannel
          ? []
          : await rollDiceBoxValues(spellCast.diceCount, spellCast.spell.dice.sides, `${spellCast.spell.name}效果`, spellCast.targetToken.label)
      }
      if (effectRolls.length > 0 && (spellCast.spell.additionalDamageComponents?.length ?? 0) > 0) {
        additionalEffectRolls = []
        for (let index = 0; index < spellCast.spell.additionalDamageComponents!.length; index += 1) {
          const component = spellCast.spell.additionalDamageComponents![index]
          additionalEffectRolls.push(await rollDiceBoxValues(
            spellCast.damageDiceCounts[index + 1],
            component.dice.sides,
            `${spellCast.spell.name}·${component.damageType}伤害`,
            spellCast.targetTokens.map((target) => target.label).join('、') || spellCast.targetToken.label,
          ))
        }
      }
      if (spellCast.empowered) {
        const damageGroups: Array<EmpoweredSpellInterruptPayload['groups'][number] & {
          group: Dnd5eEmpoweredSpellReroll['group']
          targetId?: string
          attackIndex?: number
        }> = []
        if (effectRolls.length > 0) {
          damageGroups.push({
            key: 'effect',
            label: spellCast.targetTokens.map((target) => target.label).join('、') || spellCast.spell.name,
            sides: spellCast.spell.dice.sides,
            rolls: [...effectRolls],
            group: 'effect',
          })
        }
        for (const [attackIndex, targetAttack] of (targetAttacks ?? []).entries()) {
          if (targetAttack.effectRolls.length < 1) continue
          const targetLabel = spellCast.targetTokens.find((target) => target.id === targetAttack.targetId)?.label ?? targetAttack.targetId
          damageGroups.push({
            key: `target-attack:${attackIndex}:${targetAttack.targetId}`,
            label: `${targetLabel} · ${dnd5eSpellUsesSequencedAttacks(spellCast.spell) ? `第${attackIndex + 1}道射线` : '孪生法术'}伤害`,
            sides: spellCast.spell.dice.sides,
            rolls: [...targetAttack.effectRolls],
            group: 'target-attack',
            targetId: targetAttack.targetId,
            attackIndex,
          })
        }
        if (damageGroups.length > 0) {
          const maximumDice = Math.max(1, Math.floor((spellCast.actor.abilities.cha - 10) / 2))
          const selectedKeys = await requestSharedEmpoweredSpellChoice(spellCast.actor, {
            spellName: spellCast.spell.name,
            maximumDice,
            groups: damageGroups.map(({ key, label, sides, rolls }) => ({ key, label, sides, rolls })),
          })
          const candidates = new Map<string, {
            group: Dnd5eEmpoweredSpellReroll['group']
            targetId?: string
            attackIndex?: number
            dieIndex: number
          }>()
          for (const group of damageGroups) {
            group.rolls.forEach((_, dieIndex) => candidates.set(`${group.key}:${dieIndex}`, {
              group: group.group,
              targetId: group.targetId,
              attackIndex: group.attackIndex,
              dieIndex,
            }))
          }
          const acceptedKeys = [...new Set(selectedKeys)]
            .filter((key) => candidates.has(key))
            .slice(0, maximumDice)
          if (acceptedKeys.length > 0) {
            const rerolledValues = await rollDiceBoxValues(
              acceptedKeys.length,
              spellCast.spell.dice.sides,
              `强化法术·${spellCast.spell.name}伤害重掷`,
              spellCast.actor.name,
            )
            empoweredRerolls = acceptedKeys.map((key, index) => ({
              ...candidates.get(key)!,
              reroll: rerolledValues[index],
            }))
          }
        }
      }
      const empoweredRollsFor = (
        group: Dnd5eEmpoweredSpellReroll['group'],
        rolls: readonly number[],
        targetId?: string,
        attackIndex?: number,
      ) => rolls.map((roll, dieIndex) => empoweredRerolls?.find((reroll) =>
        reroll.group === group && reroll.targetId === targetId &&
        (reroll.attackIndex == null || reroll.attackIndex === attackIndex) && reroll.dieIndex === dieIndex,
      )?.reroll ?? roll)
      const draconicDamageType = (
        spellActorCombatant.classSelectionsByClass?.sorcerer ?? spellActorCombatant.classSelections
      )['dragon-ancestor']?.[0]?.split('-').at(-1)
      const spellClassDamageBonus = (
        spellCast.castingClassId === 'sorcerer' &&
        dnd5eCombatantHasSubclass(spellActorCombatant, 'sorcerer', 'draconic') &&
        spellCast.castingClassLevel >= 6 && draconicDamageType === spellCast.spell.damageType
          ? Math.max(0, Math.floor((spellActorCombatant.abilities.cha - 10) / 2))
          : 0
      ) + (
        spellCast.castingClassId === 'wizard' &&
        dnd5eCombatantHasSubclass(spellActorCombatant, 'wizard', 'evocation') &&
        spellCast.castingClassLevel >= 10 && spellCast.spell.school === '塑能'
          ? Math.max(0, Math.floor((spellActorCombatant.abilities.int - 10) / 2))
          : 0
      )
      const committedSpellReactionTokenIds = () => new Set<string>([
        ...cuttingWordsReactionTokenIds,
        ...(useProtection && protectionCandidate ? [protectionCandidate.token.id] : []),
        ...(shieldSpellReaction ? [spellCast.targetToken.id] : []),
        ...shieldSpellReactionTargetIds,
        ...(targetAttacks ?? []).flatMap((targetAttack) => [
          ...(targetAttack.protectionReactionActorId ? [targetAttack.protectionReactionActorId] : []),
          ...(targetAttack.shieldSpellReaction ? [targetAttack.targetId] : []),
        ]),
      ])
      for (const [attackIndex, targetAttack] of (targetAttacks ?? []).entries()) {
        if (targetAttack.effectRolls.length < 1) continue
        const targetToken = spellCast.targetTokens.find((token) => token.id === targetAttack.targetId)
        if (!targetToken) continue
        const cuttingWordsDamageCandidate = findDnd5eCuttingWordsCandidate(
          authorityMap,
          spellCast.state,
          spellCast.actorToken,
          targetToken,
          committedSpellReactionTokenIds(),
        )
        if (!cuttingWordsDamageCandidate) continue
        const rawDamage = empoweredRollsFor('target-attack', targetAttack.effectRolls, targetAttack.targetId, attackIndex)
          .reduce((sum, roll) => sum + roll, spellCast.effectBonus + spellClassDamageBonus)
        targetAttack.cuttingWordsDamage = await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
          attackerName: spellCast.actor.name,
          targetName: targetToken.label,
          attackName: `${spellCast.spell.name}·孪生法术伤害`,
          total: rawDamage,
          phase: 'damage',
        })
        if (targetAttack.cuttingWordsDamage) {
          cuttingWordsReactionTokenIds.add(cuttingWordsDamageCandidate.token.id)
        }
      }
      const sharedDamageTarget = effectRolls.length > 0 && spellCast.spell.effect !== 'healing'
        ? spellCast.targetTokens.find((targetToken) =>
            !tranquilityPreventedTargetIds.has(targetToken.id) &&
            (spellCast.spell.id !== 'magic-missile' || !shieldSpellReactionTargetIds.includes(targetToken.id)),
          )
        : undefined
      const cuttingWordsDamageCandidate = sharedDamageTarget
        ? findDnd5eCuttingWordsCandidate(
            authorityMap,
            spellCast.state,
            spellCast.actorToken,
            sharedDamageTarget,
            committedSpellReactionTokenIds(),
          )
        : undefined
      if (cuttingWordsDamageCandidate) {
        const rawDamage = empoweredRollsFor('effect', effectRolls)
          .reduce((sum, roll) => sum + roll, spellCast.effectBonus + spellClassDamageBonus) +
          additionalEffectRolls.reduce((sum, rolls, index) => sum +
            rolls.reduce((componentSum, roll) => componentSum + roll, 0) +
            (spellCast.spell.additionalDamageComponents?.[index]?.dice.bonus ?? 0), 0)
        cuttingWordsDamage = await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
          attackerName: spellCast.actor.name,
          targetName: sharedDamageTarget?.label ?? spellCast.targetToken.label,
          attackName: `${spellCast.spell.name}伤害`,
          total: rawDamage,
          phase: 'damage',
        })
        if (cuttingWordsDamage) cuttingWordsReactionTokenIds.add(cuttingWordsDamageCandidate.token.id)
      }
      const overchannelSelfDamageRolls = spellCast.overchannelSelfDamageDiceCount > 0
        ? await rollDiceBoxValues(
            spellCast.overchannelSelfDamageDiceCount,
            12,
            '超限导能·反噬伤害',
            spellCast.actor.name,
          )
        : undefined
      const initialResolved = resolvePreparedDnd5eSpellCast({
        prepared: spellCast,
        d20,
        d20Second,
        attackBlessRoll,
        attackBaneRoll,
        cuttingWords,
        cuttingWordsDamage,
        standAgainstTide,
        savingThrowD20,
        savingThrowD20Second,
        savingThrowBlessRoll,
        savingThrowBaneRoll,
        targetSavingThrows,
        forcedMovements,
        targetAttacks,
        empoweredRerolls,
        targetTranquilitySaves,
        savingThrowRerollD20,
        savingThrowRerollD20Second,
        bardicInspirationRoll,
        darkOnesOwnLuckRoll,
        hurlThroughHellDamageRolls,
        overchannelSelfDamageRolls,
        protectionReactionActorId: useProtection ? protectionCandidate?.token.id : undefined,
        counterspellReaction,
        legendaryResistanceTargetIds,
        dispelMagicChecks,
        shieldSpellReaction,
        shieldSpellReactionTargetIds,
        tranquilitySave: tranquility.roll,
        effectRolls,
        additionalEffectRolls,
        delayedEffectRolls,
      })
      if (!initialResolved.result.ok) {
        acknowledgePlayerAction(action, 'rejected', initialResolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      if (!initialResolved.application) {
        acknowledgePlayerAction(action, 'rejected', 'missing-application')
        completePlayerActionRequest(action)
        return
      }
      const resolved = await settleDnd5eConcentrationChecks({
        result: initialResolved.result,
        map: initialResolved.application.map,
        characters: initialResolved.application.characters,
        priorApplication: initialResolved.application,
        characterIdByCombatantId: spellCast.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      let spellApplication = resolved.application
      const forcedMovementTokenIds = new Set([
        ...forcedMovements.map((movement) => movement.targetId),
        ...(targetAttacks ?? []).flatMap((attack) => attack.repellingBlastPushTo ? [attack.targetId] : []),
      ])
      for (const tokenId of forcedMovementTokenIds) {
        const areaSettlement = await settleDnd5ePersistentAreasForForcedMovement({
          beforeMap: authorityMap,
          afterMap: spellApplication.map,
          characters: spellApplication.characters,
          tokenId,
          round: liveRound,
          turnKey: `${liveRound}:${currentInitiativeToken?.id ?? action.actorTokenId}`,
        })
        for (const log of areaSettlement.logs) pushCombatLog(log, 'system')
        spellApplication = {
          map: areaSettlement.map,
          characters: areaSettlement.characters,
          changedCharacterIds: areaSettlement.characters.flatMap((character) => {
            const before = useCharacterStore.getState().characters.find((candidate) => candidate.id === character.id)
            return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
          }),
          changedTokenIds: areaSettlement.map.tokens.flatMap((token) => {
            const before = authorityMap.tokens.find((candidate) => candidate.id === token.id)
            return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
          }),
        }
      }
      applyDnd5eCombatApplication(spellApplication)
      const areasChanged = JSON.stringify(spellApplication.map.dnd5ePluginAreas ?? []) !==
        JSON.stringify(authorityMap.dnd5ePluginAreas ?? [])
      const effectTokensChanged = JSON.stringify(spellApplication.map.tokens.filter((token) => token.dnd5eSpellEffect)) !==
        JSON.stringify(authorityMap.tokens.filter((token) => token.dnd5eSpellEffect))
      if (areasChanged || effectTokensChanged) {
        const latestMap = useMapStore.getState().maps.find((map) => map.id === authorityMap.id) ?? authorityMap
        applyAuthorityMapUpdate(authorityMap.id, {
          dnd5ePluginAreas: spellApplication.map.dnd5ePluginAreas ?? [],
          ...(effectTokensChanged
            ? {
                tokens: mergeDnd5eSpellEffectTokenDelta({
                  currentMap: latestMap,
                  beforeMap: authorityMap,
                afterMap: spellApplication.map,
                }),
              }
            : {}),
        })
      }
      await Promise.all([
        useMapStore.getState().saveSharedNow(),
        useCharacterStore.getState().saveSharedNow(),
      ])
      await resolveDnd5eBerserkerRetaliations(resolved.result, authorityMap.id)
      await resolveDnd5eHunterGiantKiller(resolved.result, authorityMap.id)
      for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
        event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
      ))) {
        updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
      }
      if (useProtection && protectionCandidate) {
        updateDnd5eTurnEconomy(
          protectionCandidate.token.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      for (const bardTokenId of cuttingWordsReactionTokenIds) {
        updateDnd5eTurnEconomy(
          bardTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      for (const shieldEvent of resolved.result.events) {
        if (shieldEvent.type !== 'class-state-changed' || shieldEvent.stateKey !== 'shield-spell' || !shieldEvent.active) continue
        updateDnd5eTurnEconomy(
          shieldEvent.actorId,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      const spentTurnResource = resolved.result.events.find(
        (event) => event.type === 'turn-resource-spent' && (event.resource === 'action' || event.resource === 'bonusAction'),
      )
      if (spentTurnResource?.type === 'turn-resource-spent' && (spentTurnResource.resource === 'action' || spentTurnResource.resource === 'bonusAction')) {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, spentTurnResource.resource as 'action' | 'bonusAction').economy,
          liveRound,
        )
      }
      const overchannelBacklash = resolved.result.events
        .reduce((total, event) => event.type === 'damage-applied' &&
          event.sourceId === spellCast.actorToken.id && event.targetId === spellCast.actorToken.id
          ? total + event.amount
          : total, 0)
      const damage = resolved.result.events
        .reduce((total, event) => event.type === 'damage-applied' &&
          !(event.sourceId === spellCast.actorToken.id && event.targetId === spellCast.actorToken.id)
          ? total + event.amount
          : total, 0)
      const healing = resolved.result.events.reduce(
        (total, event) => event.type === 'healing-applied' ? total + event.amount : total,
        0,
      )
      const save = resolved.result.events.find((event) => event.type === 'saving-throw-resolved')
      const saveDetail = save?.type === 'saving-throw-resolved'
        ? `；豁免 ${save.total} vs DC ${save.dc}，${save.success ? '成功' : '失败'}`
        : ''
      const tranquilityPrevented = resolved.result.events.some((event) => event.type === 'hostile-targeting-prevented')
      const instantDeath = resolved.result.events.some((event) => event.type === 'instant-death')
      const overchannelDetail = spellCast.overchannel
        ? `；超限导能令伤害骰取最大值${overchannelBacklash > 0 ? `，施法者承受 ${overchannelBacklash} 点不可减免黯蚀伤害` : '，本次无反噬'}`
        : ''
      const sculptedNames = resolved.result.events
        .flatMap((event) => event.type === 'spell-sculpted'
          ? [spellCast.targetTokens.find((target) => target.id === event.targetId)?.label ?? event.targetId]
          : [])
      const sculptedDetail = sculptedNames.length > 0
        ? `；法术塑形保护 ${sculptedNames.join('、')}，自动通过豁免且不受伤害`
        : ''
      const carefulNames = resolved.result.events
        .flatMap((event) => event.type === 'metamagic-applied' && event.kind === 'careful' && event.targetId
          ? [spellCast.targetTokens.find((target) => target.id === event.targetId)?.label ?? event.targetId]
          : [])
      const metamagicDetail = spellCast.metamagic
        ? `；${dnd5eMetamagicLabel(spellCast.metamagic.kind)}消耗 ${dnd5eMetamagicCost(spellCast.metamagic.kind, spellCast.slotLevel)} 点术法点${carefulNames.length > 0 ? `，${carefulNames.join('、')}自动通过豁免` : ''}`
        : ''
      const empoweredDetail = resolved.result.events.some((event) =>
        event.type === 'metamagic-applied' && event.kind === 'empowered',
      )
        ? `；强化法术消耗1术法点并重掷 ${empoweredRerolls?.length ?? 0} 枚伤害骰`
        : ''
      const draconicResistanceEvent = resolved.result.events.find(
        (event) => event.type === 'damage-resistance-gained' && event.source === 'draconic-elemental-affinity',
      )
      const draconicResistanceDetail = draconicResistanceEvent?.type === 'damage-resistance-gained'
        ? `；元素亲和消耗1术法点，获得${({ acid: '强酸', cold: '冷冻', fire: '火焰', lightning: '闪电', poison: '毒素' } as Record<string, string>)[draconicResistanceEvent.damageType] ?? draconicResistanceEvent.damageType}抗性1小时`
        : ''
      const cuttingWordsDamageReduction = (cuttingWordsDamage?.roll ?? 0) +
        (targetAttacks ?? []).reduce((total, targetAttack) => total + (targetAttack.cuttingWordsDamage?.roll ?? 0), 0)
      const cuttingWordsDamageDetail = cuttingWordsDamageReduction > 0
        ? `；扰乱之语使伤害掷骰共减少 ${cuttingWordsDamageReduction}`
        : ''
      const nonHpEffect = spellCast.spell.effect === 'armor-class-buff'
        ? `${spellCast.targetToken.label} 获得 +2 AC（专注）`
        : spellCast.spell.effect === 'mark'
          ? `标记 ${spellCast.targetToken.label}（专注）`
          : spellCast.spell.effect === 'attack-save-buff'
            ? `${spellCast.targetTokens.map((target) => target.label).join('、')} 获得攻击与豁免 1d4 加值（专注）`
          : spellCast.spell.effect === 'attack-save-debuff'
            ? (() => {
                const affected = resolved.result.events
                  .flatMap((event) => event.type === 'class-state-changed' && event.stateKey === 'bane' && event.active && event.targetId
                    ? [spellCast.targetTokens.find((target) => target.id === event.targetId)?.label ?? event.targetId]
                    : [])
                return affected.length > 0
                  ? `${affected.join('、')} 的攻击与豁免承受 1d4 减值（专注）`
                  : '所有目标均通过魅力豁免'
              })()
          : spellCast.spell.effect === 'power-word-kill'
            ? instantDeath
              ? `${spellCast.targetToken.label} 当前生命值不高于100，立即死亡`
              : `${spellCast.targetToken.label} 当前生命值高于100，法术未产生效果`
          : spellCast.spell.effect === 'active-effect'
            ? `${spellCast.targetTokens.map((target) => target.label).join('、')} 获得${spellCast.spell.name}效果`
          : '未产生生命值变化'
      pushHeadlessCombatLog(
        `${spellCast.actor.name} 施放${spellCast.spell.name}（${spellCast.slotLevel === 0 ? '戏法' : `${spellCast.slotLevel}环`}），${tranquilityPrevented ? '未通过宁静心境的感知豁免，法术未能指定目标' : damage > 0 ? `造成 ${damage} 点伤害` : healing > 0 ? `恢复 ${healing} 点生命` : nonHpEffect}${saveDetail}${sculptedDetail}${metamagicDetail}${empoweredDetail}${draconicResistanceDetail}${cuttingWordsDamageDetail}${overchannelDetail}。`,
        damage > 0 || healing > 0 || overchannelBacklash > 0 ? 'damage' : 'system',
        resolved.result.events,
        [`法术：${spellCast.spell.name}｜${spellCast.slotLevel === 0 ? '戏法' : `${spellCast.slotLevel} 环法术位`}｜目标 ${spellCast.targetTokens.map((target) => target.label).join('、')}`],
      )
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-plugin-action' && action.type === 'dnd5e-plugin-action') {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const prepared = prepareDnd5ePluginFeatureAction({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
        roomRequiredPlugins: roomSession ? roomRulesSnapshot?.requiredPlugins : undefined,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const pluginActionDefinition = dnd5ePluginHeadlessActionDefinition(
        prepared.prepared.headlessAction.pluginId,
        prepared.prepared.headlessAction.actionId,
      )
      const pluginChoiceId = prepared.prepared.feature.action?.interrupt
        ? await requestSharedPluginChoice(prepared.prepared)
        : undefined
      if (prepared.prepared.feature.action?.interrupt && !pluginChoiceId) {
        acknowledgePlayerAction(action, 'rejected', 'interrupt-cancelled')
        completePlayerActionRequest(action)
        return
      }
      if (
        pluginChoiceId &&
        prepared.prepared.feature.action?.interrupt?.cancelOptionId === pluginChoiceId
      ) {
        acknowledgePlayerAction(action, 'rejected', 'interrupt-cancelled')
        completePlayerActionRequest(action)
        return
      }
      let pluginRolls: Record<string, Dnd5ePluginDiceRollResult>
      try {
        pluginRolls = await executeDnd5ePluginDiceRolls(pluginActionDefinition ?? {}, async (declaration) =>
          rollDiceBoxValues(
            declaration.count,
            declaration.sides,
            `${prepared.prepared.feature.name}·${declaration.label}`,
            prepared.prepared.targetToken.label,
            { broadcast: declaration.visibility !== 'dm' },
          ),
        )
      } catch {
        acknowledgePlayerAction(action, 'rejected', 'invalid-dice')
        completePlayerActionRequest(action)
        return
      }
      const summonInitiativeD20 = prepared.prepared.feature.action?.summon
        ? await rollDiceBoxD20('召唤生物·先攻', prepared.prepared.feature.name)
        : undefined
      const resolved = await resolvePreparedDnd5ePluginFeatureAction({
        prepared: prepared.prepared,
        rolls: pluginRolls,
        interruptChoiceId: pluginChoiceId,
        summonInitiativeD20,
      })
      if (!resolved.result.ok || !resolved.application) {
        acknowledgePlayerAction(
          action,
          'rejected',
          resolved.result.ok ? 'missing-application' : resolved.result.reason,
        )
        completePlayerActionRequest(action)
        return
      }
      let pluginApplication = resolved.application
      const createdAreaId = `plugin-area:${action.id}`
      if (pluginApplication.map.dnd5ePluginAreas?.some((area) => area.id === createdAreaId)) {
        const createdCandidates = collectDnd5ePersistentAreaTriggers({
          map: pluginApplication.map,
          timing: 'on-create',
          round: liveRound,
          areaId: createdAreaId,
          turnKey: `${liveRound}:${currentInitiativeToken?.id ?? action.actorTokenId}`,
        })
        const createdSettled = await settleDnd5ePersistentAreaCandidates({
          candidates: createdCandidates,
          map: pluginApplication.map,
          characters: pluginApplication.characters,
          round: liveRound,
        })
        for (const log of createdSettled.logs) pushCombatLog(log, 'system')
        pluginApplication = {
          map: createdSettled.map,
          characters: createdSettled.characters,
          changedCharacterIds: createdSettled.characters.flatMap((character) => {
            const before = useCharacterStore.getState().characters.find((candidate) => candidate.id === character.id)
            return JSON.stringify(before) === JSON.stringify(character) ? [] : [character.id]
          }),
          changedTokenIds: createdSettled.map.tokens.flatMap((token) => {
            const before = authorityMap.tokens.find((candidate) => candidate.id === token.id)
            return JSON.stringify(before) === JSON.stringify(token) ? [] : [token.id]
          }),
        }
      }
      let summonedInitiativeEntries = resolved.summonedInitiativeEntries
      const summonDefinition = prepared.prepared.feature.action?.summon
      if (summonDefinition && prepared.prepared.targetCell && summonInitiativeD20 != null) {
        const latestMap = useMapStore.getState().maps.find((map) => map.id === authorityMap.id)
        const latestActorToken = latestMap?.tokens.find((token) => token.id === prepared.prepared.actorToken.id)
        if (!latestMap || !latestActorToken) {
          acknowledgePlayerAction(action, 'rejected', 'invalid-actor')
          completePlayerActionRequest(action)
          return
        }
        const latestSummonPlan = planDnd5eSummonedCreature({
          map: latestMap,
          actorToken: latestActorToken,
          sourceCharacterId: prepared.prepared.actor.id,
          featureId: prepared.prepared.feature.id,
          pluginId: prepared.prepared.feature.ownerPluginId,
          actionId: action.id,
          round: action.round,
          targetCell: prepared.prepared.targetCell,
          initiativeD20: summonInitiativeD20,
          summon: summonDefinition,
        })
        if (!latestSummonPlan.ok) {
          acknowledgePlayerAction(action, 'rejected', latestSummonPlan.reason)
          completePlayerActionRequest(action)
          return
        }
        pluginApplication = {
          ...pluginApplication,
          map: {
            ...pluginApplication.map,
            tokens: rebaseDnd5eSummonedCreatureTokens({
              latestMap,
              resolvedTokens: pluginApplication.map.tokens,
              changedTokenIds: pluginApplication.changedTokenIds,
              summonedToken: latestSummonPlan.plan.token,
            }),
          },
          changedTokenIds: [
            ...new Set([...pluginApplication.changedTokenIds, latestSummonPlan.plan.token.id]),
          ],
        }
        summonedInitiativeEntries = [latestSummonPlan.plan.initiativeEntry]
      }
      const latestMapBeforeCommit = useMapStore.getState().maps.find((map) => map.id === authorityMap.id) ?? authorityMap
      const addedTokens = pluginApplication.map.tokens.filter((token) =>
        !latestMapBeforeCommit.tokens.some((existing) => existing.id === token.id),
      )
      const addedTokenIds = new Set(addedTokens.map((token) => token.id))
      applyDnd5eCombatApplication({
        ...pluginApplication,
        changedTokenIds: pluginApplication.changedTokenIds.filter((tokenId) => !addedTokenIds.has(tokenId)),
      })
      if (addedTokens.length > 0) {
        updateMap(authorityMap.id, {
          tokens: [
            ...latestMapBeforeCommit.tokens,
            ...addedTokens.filter((token) =>
              !latestMapBeforeCommit.tokens.some((existing) => existing.id === token.id)),
          ],
        })
      }
      if (
        JSON.stringify(pluginApplication.map.dnd5ePluginAreas ?? []) !==
        JSON.stringify(authorityMap.dnd5ePluginAreas ?? [])
      ) {
        updateMap(authorityMap.id, { dnd5ePluginAreas: pluginApplication.map.dnd5ePluginAreas ?? [] })
      }
      if ((summonedInitiativeEntries?.length ?? 0) > 0) {
        const inserted = insertInitiativeEntriesPreservingActive(
          initiativeOrderRef.current,
          initiativeIndexRef.current,
          summonedInitiativeEntries ?? [],
        )
        initiativeOrderRef.current = inserted.order
        initiativeIndexRef.current = inserted.index
        setInitiativeOrder(inserted.order)
        setInitiativeIndex(inserted.index)
        void publishCombatState({
          initiativeOrder: inserted.order,
          initiativeIndex: inserted.index,
        })
      }
      const spentTurnResource = resolved.result.events.find((event) =>
        event.type === 'turn-resource-spent' &&
        event.actorId === action.actorTokenId &&
        (event.resource === 'action' || event.resource === 'bonusAction' || event.resource === 'reaction'),
      )
      const countedTurnResource = spentTurnResource?.type === 'turn-resource-spent' &&
        (
          spentTurnResource.resource === 'action' ||
          spentTurnResource.resource === 'bonusAction' ||
          spentTurnResource.resource === 'reaction'
        )
        ? spentTurnResource.resource
        : undefined
      if (countedTurnResource) {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, countedTurnResource).economy,
          liveRound,
        )
      }
      const temporaryHp = resolved.result.events
        .filter((event) => event.type === 'temporary-hit-points-gained')
        .reduce((total, event) => total + event.amount, 0)
      const healing = resolved.result.events
        .filter((event) => event.type === 'healing-applied')
        .reduce((total, event) => total + event.amount, 0)
      const targetName = prepared.prepared.targetToken.label
      const summoned = addedTokens.find((token) => token.dnd5eSummon)
      const detail = summoned
        ? `召唤 ${summoned.label}，并加入先攻`
        : temporaryHp > 0
        ? `${targetName} 获得 ${temporaryHp} 点临时生命值`
        : healing > 0
          ? `${targetName} 恢复 ${healing} 点生命值`
          : `对 ${targetName} 完成 Headless 结算`
      pushHeadlessCombatLog(
        `${prepared.prepared.actor.name} 使用扩展特性“${prepared.prepared.feature.name}”：${detail}。`,
        temporaryHp > 0 || healing > 0 ? 'damage' : 'system',
        resolved.result.events,
        [`扩展特性：${prepared.prepared.feature.name}`],
      )
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-class-feature' && action.type === 'dnd5e-class-feature') {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const prepared = prepareDnd5eClassFeature({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const feature = prepared.prepared
      if (
        feature.payload.feature === 'ranger-hide-in-plain-sight' &&
        !await showCombatDialog({
          title: '确认隐匿无踪伪装',
          message: `${feature.actor.name} 是否已在泥土、植物、烟灰等自然材料附近花费1分钟完成伪装？\n确认后，下一次敏捷（隐匿）检定获得 +10；移动或执行其他动作会使伪装失效。`,
          confirmText: '确认已完成',
          cancelText: '尚未完成',
          tone: 'violet',
        })
      ) {
        acknowledgePlayerAction(action, 'rejected', 'invalid-action')
        completePlayerActionRequest(action)
        return
      }
      let abilityCheckD20: number | undefined
      let abilityCheckD20Second: number | undefined
      let hideAllowed: boolean | undefined
      if (feature.rogueAbilityCheck) {
        if (
          feature.payload.feature === 'ranger-vanish' ||
          (feature.payload.feature === 'rogue-cunning-action' && feature.payload.option === 'hide')
        ) {
          hideAllowed = await showCombatDialog({
            title: '确认藏身条件',
            message: `${feature.actor.name} 是否处于敌人无法清楚看见的位置（例如有遮蔽、重度遮蔽或其他可藏身条件）？`,
            confirmText: '允许躲藏检定',
            cancelText: '当前无法躲藏',
            tone: 'violet',
          })
          if (!hideAllowed) {
            acknowledgePlayerAction(action, 'rejected', 'hide-not-allowed')
            completePlayerActionRequest(action)
            return
          }
        }
        abilityCheckD20 = await rollDiceBoxD20(feature.rogueAbilityCheck.label, feature.actor.name)
        abilityCheckD20Second = feature.rogueAbilityCheck.mode !== 'normal'
          ? await rollDiceBoxD20(
              `${feature.rogueAbilityCheck.label}（${feature.rogueAbilityCheck.mode === 'advantage' ? '优势' : '劣势'}）`,
              feature.actor.name,
            )
          : undefined
      }
      const monkAttackRolls: Dnd5eMonkBonusAttackRoll[] = []
      if (feature.monkBonusAttack) {
        const actorCombatant = feature.state.combatants[feature.actorToken.id]
        const inspirationDie = actorCombatant ? dnd5eHeldBardicInspirationDie(actorCombatant) : undefined
        let bardicInspirationCommitted = false
        let tranquilityRerollCommitted = false
        const savingThrowInspirationCommittedByTarget = new Set<string>()
        const savingThrowDarkOnesOwnLuckCommittedByTarget = new Set<string>()
        const openHandProneTargetIds = new Set<string>()
        const shieldSpellReactionTokenIds = new Set<string>()
        const cuttingWordsReactionTokenIds = new Set<string>()
        const committedMonkKi = (feature.payload.feature === 'monk-unarmed-bonus' && feature.payload.mode === 'flurry' ? 1 : 0) +
          (feature.payload.feature === 'monk-unarmed-bonus' && feature.payload.stunningStrike ? feature.monkBonusAttack.targets.length : 0) +
          (feature.payload.feature === 'monk-unarmed-bonus' && feature.payload.quiveringPalmAttackIndex != null ? 3 : 0)
        for (let index = 0; index < feature.monkBonusAttack.targets.length; index += 1) {
          const target = feature.monkBonusAttack.targets[index]
          if (!actorCombatant) {
            acknowledgePlayerAction(action, 'rejected', 'combatant-missing')
            completePlayerActionRequest(action)
            return
          }
          const tranquility = await rollDnd5eTranquilityWard({
            ward: target.tranquilityWard,
            attacker: actorCombatant,
            attackerCharacter: feature.actor,
            attackerName: feature.actor.name,
            bardicInspirationAvailable: !bardicInspirationCommitted,
            savingThrowRerollAvailable: !tranquilityRerollCommitted &&
              (actorCombatant.classResources['dnd5e-ki']?.current ?? 0) > committedMonkKi,
          })
          if (tranquility.roll?.bardicInspirationRoll != null) bardicInspirationCommitted = true
          if (tranquility.roll?.rerollD20 != null) tranquilityRerollCommitted = true
          const attackMode = openHandProneTargetIds.has(target.token.id)
            ? target.attackMode === 'disadvantage' ? 'normal' : 'advantage'
            : target.attackMode
          const d20 = tranquility.passed ? await rollDiceBoxD20('武僧徒手攻击命中检定', target.token.label) : 1
          const d20Second = tranquility.passed && attackMode !== 'normal'
            ? await rollDiceBoxD20(`武僧徒手攻击命中检定（${attackMode === 'advantage' ? '优势' : '劣势'}）`, target.token.label)
            : undefined
          const blessRoll = tranquility.passed && feature.monkBonusAttack.blessed
            ? (await rollDiceBoxValues(1, 4, '祝福术·攻击加值', feature.actor.name))[0]
            : undefined
          const baneRoll = tranquility.passed && feature.monkBonusAttack.baned
            ? (await rollDiceBoxValues(1, 4, '灾祸术·攻击减值', feature.actor.name))[0]
            : undefined
          const preview = previewDnd5eMonkBonusAttack(feature, index, d20, d20Second, attackMode, blessRoll, baneRoll)
          const armorClassBeforeReaction = target.armorClass + (shieldSpellReactionTokenIds.has(target.token.id) ? 5 : 0)
          const hitBeforeInspiration = preview.critical || (!preview.roll.naturalOne && preview.roll.total >= armorClassBeforeReaction)
          const bardicInspirationRoll = tranquility.passed && !bardicInspirationCommitted && !hitBeforeInspiration && !preview.roll.naturalOne &&
            inspirationDie && preview.roll.total + inspirationDie >= armorClassBeforeReaction
            ? await requestDnd5eBardicInspirationRoll({
                target: feature.actor,
                targetName: feature.actor.name,
                dieSides: inspirationDie,
                rollType: '攻击检定',
                total: preview.roll.total,
                targetNumber: armorClassBeforeReaction,
              })
            : undefined
          if (bardicInspirationRoll != null) bardicInspirationCommitted = true
          const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
          const hitBeforeCuttingWords = preview.critical || (!preview.roll.naturalOne && attackTotalBeforeCuttingWords >= armorClassBeforeReaction)
          const cuttingWordsCandidate = tranquility.passed && hitBeforeCuttingWords && !preview.critical
            ? findDnd5eCuttingWordsCandidate(
                feature.map,
                feature.state,
                feature.actorToken,
                target.token,
                new Set([...shieldSpellReactionTokenIds, ...cuttingWordsReactionTokenIds]),
              )
            : undefined
          const cuttingWords = cuttingWordsCandidate &&
            attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < armorClassBeforeReaction
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
                attackerName: feature.actor.name,
                targetName: target.token.label,
                attackName: '武僧徒手攻击',
                total: attackTotalBeforeCuttingWords,
                targetNumber: armorClassBeforeReaction,
              })
            : undefined
          if (cuttingWords && cuttingWordsCandidate) cuttingWordsReactionTokenIds.add(cuttingWordsCandidate.token.id)
          const attackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
          let attackHit = preview.critical || (!preview.roll.naturalOne && attackTotal >= armorClassBeforeReaction)
          const shieldTargetCombatant = feature.state.combatants[target.token.id]
          const shieldTargetCharacter = target.token.characterId
            ? feature.characters.find((character) => character.id === target.token.characterId)
            : undefined
          const shieldSpellReaction = !!(
            attackHit && !cuttingWordsReactionTokenIds.has(target.token.id) &&
            !shieldSpellReactionTokenIds.has(target.token.id) && shieldTargetCombatant &&
            shieldTargetCharacter && dnd5eCanCastShieldSpell(shieldTargetCombatant) &&
            await requestSharedShieldSpellChoice(shieldTargetCharacter, {
              attackerName: feature.actor.name,
              attackName: '武僧徒手攻击',
              attackTotal,
              armorClass: armorClassBeforeReaction,
            })
          )
          if (shieldSpellReaction) {
            shieldSpellReactionTokenIds.add(target.token.id)
            if (!preview.critical) attackHit = attackTotal >= armorClassBeforeReaction + 5
          }
          const standAgainstTide = !attackHit && !shieldSpellReaction && tranquility.passed
            ? await buildDnd5eStandAgainstTideUse({
                map: feature.map,
                state: feature.state,
                attackerToken: feature.actorToken,
                hunterToken: target.token,
                attackerName: feature.actor.name,
                attackName: '武僧徒手攻击',
                attackModifier: feature.monkBonusAttack.profile.attackModifier,
                reachFeet: 5,
                damage: [{ ...feature.monkBonusAttack.profile.damage, type: 'bludgeoning' }],
                bardicInspirationAlreadyUsed: bardicInspirationCommitted,
                excludedReactionTokenIds: new Set([...shieldSpellReactionTokenIds, ...cuttingWordsReactionTokenIds]),
              })
            : undefined
          const stunningStrikeSaveD20 = attackHit && target.stunningStrike
            ? await rollDiceBoxD20('震慑拳·体质豁免', target.token.label)
            : undefined
          const stunningStrikeSaveD20Second = attackHit && target.stunningStrike?.saveMode === 'disadvantage'
            ? await rollDiceBoxD20('震慑拳·体质豁免（劣势）', target.token.label)
            : undefined
          const stunningStrikeSaveBlessRoll = stunningStrikeSaveD20 != null && target.stunningStrike?.blessed
            ? (await rollDiceBoxValues(1, 4, '祝福术·震慑拳豁免加值', target.token.label))[0]
            : undefined
          const stunningStrikeSaveBaneRoll = stunningStrikeSaveD20 != null && target.stunningStrike?.baned
            ? (await rollDiceBoxValues(1, 4, '灾祸术·震慑拳豁免减值', target.token.label))[0]
            : undefined
          let stunningStrikeSaveRerollD20: number | undefined
          let stunningStrikeSaveRerollD20Second: number | undefined
          let stunningStrikeBardicInspirationRoll: number | undefined
          let stunningStrikeDarkOnesOwnLuckRoll: number | undefined
          if (stunningStrikeSaveD20 != null && target.stunningStrike) {
            const initialSave = previewDnd5eSavingThrowRoll({
              rolls: target.stunningStrike.saveMode === 'normal'
                ? [stunningStrikeSaveD20]
                : [stunningStrikeSaveD20, stunningStrikeSaveD20Second ?? 0],
              mode: target.stunningStrike.saveMode,
              modifier: target.stunningStrike.saveModifier + (stunningStrikeSaveBlessRoll ?? 0) -
                (stunningStrikeSaveBaneRoll ?? 0),
              dc: target.stunningStrike.saveDc,
            })
            const targetCombatant = feature.state.combatants[target.token.id]
            const targetCharacter = target.token.characterId
              ? feature.characters.find((character) => character.id === target.token.characterId)
              : undefined
            const targetInspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
            stunningStrikeBardicInspirationRoll = !initialSave.success &&
              !savingThrowInspirationCommittedByTarget.has(target.token.id) && targetInspirationDie &&
              initialSave.roll.total + targetInspirationDie >= target.stunningStrike.saveDc
              ? await requestDnd5eBardicInspirationRoll({
                  target: targetCharacter,
                  targetName: target.token.label,
                  dieSides: targetInspirationDie,
                  rollType: '豁免',
                  total: initialSave.roll.total,
                  targetNumber: target.stunningStrike.saveDc,
                })
              : undefined
            if (stunningStrikeBardicInspirationRoll != null) {
              savingThrowInspirationCommittedByTarget.add(target.token.id)
            }
            const saveSucceededWithInspiration = initialSave.success ||
              initialSave.roll.total + (stunningStrikeBardicInspirationRoll ?? 0) >= target.stunningStrike.saveDc
            stunningStrikeDarkOnesOwnLuckRoll = !saveSucceededWithInspiration && targetCombatant &&
              !savingThrowDarkOnesOwnLuckCommittedByTarget.has(target.token.id) &&
              dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
              ? await requestDnd5eDarkOnesOwnLuckRoll({
                  target: targetCharacter,
                  targetName: target.token.label,
                  rollType: '豁免',
                  total: initialSave.roll.total + (stunningStrikeBardicInspirationRoll ?? 0),
                  targetNumber: target.stunningStrike.saveDc,
                })
              : undefined
            if (stunningStrikeDarkOnesOwnLuckRoll != null) {
              savingThrowDarkOnesOwnLuckCommittedByTarget.add(target.token.id)
            }
            const saveSucceededWithLuck = saveSucceededWithInspiration ||
              initialSave.roll.total + (stunningStrikeBardicInspirationRoll ?? 0) +
                (stunningStrikeDarkOnesOwnLuckRoll ?? 0) >= target.stunningStrike.saveDc
            const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
            if (!saveSucceededWithLuck && targetCharacter && rerollFeature) {
              const reroll = await requestDnd5eSavingThrowRerollDice({
                target: targetCharacter,
                targetName: target.token.label,
                featureName: rerollFeature.name,
                total: initialSave.roll.total,
                dc: target.stunningStrike.saveDc,
                mode: target.stunningStrike.saveMode,
              })
              stunningStrikeSaveRerollD20 = reroll?.d20
              stunningStrikeSaveRerollD20Second = reroll?.d20Second
            }
          }
          let openHandSavingThrowD20: number | undefined
          let openHandSavingThrowD20Second: number | undefined
          let openHandBlessRoll: number | undefined
          let openHandBaneRoll: number | undefined
          let openHandSavingThrowRerollD20: number | undefined
          let openHandSavingThrowRerollD20Second: number | undefined
          let openHandBardicInspirationRoll: number | undefined
          let openHandDarkOnesOwnLuckRoll: number | undefined
          const openHandTechnique = target.openHandTechnique
          if (
            attackHit && openHandTechnique?.saveDc != null && openHandTechnique.saveModifier != null &&
            openHandTechnique.saveMode
          ) {
            const abilityName = openHandTechnique.effect === 'prone' ? '敏捷' : '力量'
            openHandSavingThrowD20 = await rollDiceBoxD20(`散打技法·${abilityName}豁免`, target.token.label)
            openHandSavingThrowD20Second = openHandTechnique.saveMode !== 'normal'
              ? await rollDiceBoxD20(
                  `散打技法·${abilityName}豁免（${openHandTechnique.saveMode === 'advantage' ? '优势' : '劣势'}）`,
                  target.token.label,
                )
              : undefined
            openHandBlessRoll = openHandTechnique.blessed
              ? (await rollDiceBoxValues(1, 4, '祝福术·散打技法豁免加值', target.token.label))[0]
              : undefined
            openHandBaneRoll = openHandTechnique.baned
              ? (await rollDiceBoxValues(1, 4, '灾祸术·散打技法豁免减值', target.token.label))[0]
              : undefined
            const initialSave = previewDnd5eSavingThrowRoll({
              rolls: openHandTechnique.saveMode === 'normal'
                ? [openHandSavingThrowD20]
                : [openHandSavingThrowD20, openHandSavingThrowD20Second ?? 0],
              mode: openHandTechnique.saveMode,
              modifier: openHandTechnique.saveModifier + (openHandBlessRoll ?? 0) - (openHandBaneRoll ?? 0),
              dc: openHandTechnique.saveDc,
            })
            const targetCombatant = feature.state.combatants[target.token.id]
            const targetCharacter = target.token.characterId
              ? feature.characters.find((character) => character.id === target.token.characterId)
              : undefined
            const targetInspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
            openHandBardicInspirationRoll = !initialSave.success &&
              !savingThrowInspirationCommittedByTarget.has(target.token.id) && targetInspirationDie &&
              initialSave.roll.total + targetInspirationDie >= openHandTechnique.saveDc
              ? await requestDnd5eBardicInspirationRoll({
                  target: targetCharacter,
                  targetName: target.token.label,
                  dieSides: targetInspirationDie,
                  rollType: '豁免',
                  total: initialSave.roll.total,
                  targetNumber: openHandTechnique.saveDc,
                })
              : undefined
            if (openHandBardicInspirationRoll != null) {
              savingThrowInspirationCommittedByTarget.add(target.token.id)
            }
            const saveSucceededWithInspiration = initialSave.success ||
              initialSave.roll.total + (openHandBardicInspirationRoll ?? 0) >= openHandTechnique.saveDc
            openHandDarkOnesOwnLuckRoll = !saveSucceededWithInspiration && targetCombatant &&
              !savingThrowDarkOnesOwnLuckCommittedByTarget.has(target.token.id) &&
              dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
              ? await requestDnd5eDarkOnesOwnLuckRoll({
                  target: targetCharacter,
                  targetName: target.token.label,
                  rollType: '豁免',
                  total: initialSave.roll.total + (openHandBardicInspirationRoll ?? 0),
                  targetNumber: openHandTechnique.saveDc,
                })
              : undefined
            if (openHandDarkOnesOwnLuckRoll != null) {
              savingThrowDarkOnesOwnLuckCommittedByTarget.add(target.token.id)
            }
            const saveSucceededWithLuck = saveSucceededWithInspiration ||
              initialSave.roll.total + (openHandBardicInspirationRoll ?? 0) +
                (openHandDarkOnesOwnLuckRoll ?? 0) >= openHandTechnique.saveDc
            let finalSaveSuccess = saveSucceededWithLuck
            const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
            if (!saveSucceededWithLuck && targetCharacter && rerollFeature) {
              const reroll = await requestDnd5eSavingThrowRerollDice({
                target: targetCharacter,
                targetName: target.token.label,
                featureName: rerollFeature.name,
                total: initialSave.roll.total,
                dc: openHandTechnique.saveDc,
                mode: openHandTechnique.saveMode,
              })
              openHandSavingThrowRerollD20 = reroll?.d20
              openHandSavingThrowRerollD20Second = reroll?.d20Second
              if (reroll?.d20 != null) {
                finalSaveSuccess = previewDnd5eSavingThrowRoll({
                  rolls: openHandTechnique.saveMode === 'normal'
                    ? [reroll.d20]
                    : [reroll.d20, reroll.d20Second ?? 0],
                  mode: openHandTechnique.saveMode,
                  modifier: openHandTechnique.saveModifier + (openHandBlessRoll ?? 0) - (openHandBaneRoll ?? 0),
                  dc: openHandTechnique.saveDc,
                }).success
              }
            }
            const openHandSaveFailed = !finalSaveSuccess
            const proneImmune = targetCombatant?.conditionImmunities.some((condition) =>
              ['prone', '倒地'].includes(condition.toLowerCase()),
            )
            if (openHandSaveFailed && openHandTechnique.effect === 'prone' && !proneImmune) {
              openHandProneTargetIds.add(target.token.id)
            }
          }
          const damageRolls = attackHit && feature.monkBonusAttack.profile.damage.count > 0
            ? await rollDiceBoxValues(
                feature.monkBonusAttack.profile.damage.count * (preview.critical ? 2 : 1),
                feature.monkBonusAttack.profile.damage.sides,
                '武僧徒手攻击伤害',
                target.token.label,
              )
            : []
          const rawDamage = damageRolls.reduce((sum, roll) => sum + roll, 0) +
            (attackHit ? feature.monkBonusAttack.profile.damage.bonus : 0)
          const cuttingWordsDamageCandidate = attackHit && !cuttingWords
            ? findDnd5eCuttingWordsCandidate(
                feature.map,
                feature.state,
                feature.actorToken,
                target.token,
                new Set([...shieldSpellReactionTokenIds, ...cuttingWordsReactionTokenIds]),
              )
            : undefined
          const cuttingWordsDamage = cuttingWordsDamageCandidate
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
                attackerName: feature.actor.name,
                targetName: target.token.label,
                attackName: '武僧徒手攻击',
                total: rawDamage,
                phase: 'damage',
              })
            : undefined
          if (cuttingWordsDamage && cuttingWordsDamageCandidate) {
            cuttingWordsReactionTokenIds.add(cuttingWordsDamageCandidate.token.id)
          }
          monkAttackRolls.push({
            d20,
            d20Second,
            blessRoll,
            baneRoll,
            bardicInspirationRoll,
            cuttingWords,
            cuttingWordsDamage,
            shieldSpellReaction,
            stunningStrikeSaveD20,
            stunningStrikeSaveD20Second,
            stunningStrikeSaveBlessRoll,
            stunningStrikeSaveBaneRoll,
            stunningStrikeSaveRerollD20,
            stunningStrikeSaveRerollD20Second,
            stunningStrikeBardicInspirationRoll,
            stunningStrikeDarkOnesOwnLuckRoll,
            openHandSavingThrowD20,
            openHandSavingThrowD20Second,
            openHandBlessRoll,
            openHandBaneRoll,
            openHandSavingThrowRerollD20,
            openHandSavingThrowRerollD20Second,
            openHandBardicInspirationRoll,
            openHandDarkOnesOwnLuckRoll,
            tranquilitySave: tranquility.roll,
            damageRolls,
            standAgainstTide,
          })
        }
      }
      let savingThrowD20: number | undefined
      let savingThrowD20Second: number | undefined
      let savingThrowBlessRoll: number | undefined
      let savingThrowBaneRoll: number | undefined
      let savingThrowRerollD20: number | undefined
      let savingThrowRerollD20Second: number | undefined
      let bardicInspirationRoll: number | undefined
      let darkOnesOwnLuckRoll: number | undefined
      let turnUndeadSavingThrows: Dnd5eSpellTargetSavingThrowRoll[] | undefined
      let divineInterventionD100: number | undefined
      let classFeatureEffectRolls: number[] = []
      if (feature.turnUndead) {
        const turningFeatureName = feature.payload.feature === 'paladin-turn-the-unholy' ? '驱散邪魔' : '驱散亡灵'
        turnUndeadSavingThrows = []
        for (const targetSave of feature.turnUndead.targets) {
          const saveD20 = await rollDiceBoxD20(`${turningFeatureName}·感知豁免`, targetSave.targetName)
          const saveD20Second = targetSave.saveMode !== 'normal'
            ? await rollDiceBoxD20(
                `${turningFeatureName}·感知豁免（${targetSave.saveMode === 'advantage' ? '优势' : '劣势'}）`,
                targetSave.targetName,
              )
            : undefined
          const blessRoll = targetSave.blessed
            ? (await rollDiceBoxValues(1, 4, `祝福术·${turningFeatureName}豁免加值`, targetSave.targetName))[0]
            : undefined
          const baneRoll = targetSave.baned
            ? (await rollDiceBoxValues(1, 4, `灾祸术·${turningFeatureName}豁免减值`, targetSave.targetName))[0]
            : undefined
          let preview = previewDnd5eSavingThrowRoll({
            rolls: targetSave.saveMode === 'normal' ? [saveD20] : [saveD20, saveD20Second ?? 0],
            mode: targetSave.saveMode,
            modifier: targetSave.saveModifier + (blessRoll ?? 0) - (baneRoll ?? 0),
            dc: targetSave.saveDc,
          })
          const targetCombatant = feature.state.combatants[targetSave.token.id]
          const targetCharacter = targetSave.token.characterId
            ? feature.characters.find((character) => character.id === targetSave.token.characterId)
            : undefined
          const inspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
          const targetBardicInspirationRoll = !preview.success && inspirationDie &&
            preview.roll.total + inspirationDie >= targetSave.saveDc
            ? await requestDnd5eBardicInspirationRoll({
                target: targetCharacter,
                targetName: targetSave.targetName,
                dieSides: inspirationDie,
                rollType: '豁免',
                total: preview.roll.total,
                targetNumber: targetSave.saveDc,
              })
            : undefined
          if (targetBardicInspirationRoll != null) {
            preview = {
              ...preview,
              roll: {
                ...preview.roll,
                modifier: preview.roll.modifier + targetBardicInspirationRoll,
                total: preview.roll.total + targetBardicInspirationRoll,
              },
              success: preview.roll.total + targetBardicInspirationRoll >= targetSave.saveDc,
            }
          }
          const targetDarkOnesOwnLuckRoll = !preview.success && targetCombatant &&
            dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
            ? await requestDnd5eDarkOnesOwnLuckRoll({
                target: targetCharacter,
                targetName: targetSave.targetName,
                rollType: '豁免',
                total: preview.roll.total,
                targetNumber: targetSave.saveDc,
              })
            : undefined
          if (targetDarkOnesOwnLuckRoll != null) {
            preview = {
              ...preview,
              roll: {
                ...preview.roll,
                modifier: preview.roll.modifier + targetDarkOnesOwnLuckRoll,
                total: preview.roll.total + targetDarkOnesOwnLuckRoll,
              },
              success: preview.roll.total + targetDarkOnesOwnLuckRoll >= targetSave.saveDc,
            }
          }
          let rerollD20: number | undefined
          let rerollD20Second: number | undefined
          const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
          if (!preview.success && targetCharacter && rerollFeature) {
            const reroll = await requestDnd5eSavingThrowRerollDice({
              target: targetCharacter,
              targetName: targetSave.targetName,
              featureName: rerollFeature.name,
              total: preview.roll.total,
              dc: targetSave.saveDc,
              mode: targetSave.saveMode,
            })
            rerollD20 = reroll?.d20
            rerollD20Second = reroll?.d20Second
          }
          turnUndeadSavingThrows.push({
            targetId: targetSave.token.id,
            d20: saveD20,
            d20Second: saveD20Second,
            blessRoll,
            baneRoll,
            rerollD20,
            rerollD20Second,
            bardicInspirationRoll: targetBardicInspirationRoll,
            darkOnesOwnLuckRoll: targetDarkOnesOwnLuckRoll,
          })
        }
      }
      const clericLevel = dnd5eCharacterClassLevel(feature.actor, 'cleric')
      if (feature.payload.feature === 'cleric-divine-intervention' && clericLevel < 20) {
        divineInterventionD100 = (await rollDiceBoxValues(1, 100, '神圣干预', feature.actor.name))[0]
      }
      if (feature.intimidatingPresence && !feature.intimidatingPresence.extending) {
        const presence = feature.intimidatingPresence
        savingThrowD20 = await rollDiceBoxD20('威吓气势·感知豁免', presence.targetName)
        savingThrowD20Second = presence.saveMode !== 'normal'
          ? await rollDiceBoxD20(`威吓气势·感知豁免（${presence.saveMode === 'advantage' ? '优势' : '劣势'}）`, presence.targetName)
          : undefined
        savingThrowBlessRoll = presence.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·威吓气势豁免加值', presence.targetName))[0]
          : undefined
        savingThrowBaneRoll = presence.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·威吓气势豁免减值', presence.targetName))[0]
          : undefined
        const initialSave = previewDnd5eSavingThrowRoll({
          rolls: presence.saveMode === 'normal'
            ? [savingThrowD20]
            : [savingThrowD20, savingThrowD20Second ?? 0],
          mode: presence.saveMode,
          modifier: presence.saveModifier + (savingThrowBlessRoll ?? 0) - (savingThrowBaneRoll ?? 0),
          dc: presence.saveDc,
        })
        const targetCombatant = feature.state.combatants[presence.target.id]
        const targetCharacter = presence.target.characterId
          ? feature.characters.find((character) => character.id === presence.target.characterId)
          : undefined
        const inspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
        bardicInspirationRoll = !initialSave.success && inspirationDie &&
          initialSave.roll.total + inspirationDie >= presence.saveDc
          ? await requestDnd5eBardicInspirationRoll({
              target: targetCharacter,
              targetName: presence.targetName,
              dieSides: inspirationDie,
              rollType: '豁免',
              total: initialSave.roll.total,
              targetNumber: presence.saveDc,
            })
          : undefined
        const saveSucceededWithInspiration = initialSave.success ||
          initialSave.roll.total + (bardicInspirationRoll ?? 0) >= presence.saveDc
        darkOnesOwnLuckRoll = !saveSucceededWithInspiration && targetCombatant &&
          dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
          ? await requestDnd5eDarkOnesOwnLuckRoll({
              target: targetCharacter,
              targetName: presence.targetName,
              rollType: '豁免',
              total: initialSave.roll.total + (bardicInspirationRoll ?? 0),
              targetNumber: presence.saveDc,
            })
          : undefined
        const saveSucceededWithLuck = saveSucceededWithInspiration ||
          initialSave.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= presence.saveDc
        const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
        if (!saveSucceededWithLuck && targetCharacter && rerollFeature) {
          const reroll = await requestDnd5eSavingThrowRerollDice({
            target: targetCharacter,
            targetName: presence.targetName,
            featureName: rerollFeature.name,
            total: initialSave.roll.total,
            dc: presence.saveDc,
            mode: presence.saveMode,
          })
          savingThrowRerollD20 = reroll?.d20
          savingThrowRerollD20Second = reroll?.d20Second
        }
      }
      if (feature.quiveringPalmRelease) {
        const release = feature.quiveringPalmRelease
        savingThrowD20 = await rollDiceBoxD20('渗透劲·体质豁免', release.targetName)
        savingThrowD20Second = release.saveMode !== 'normal'
          ? await rollDiceBoxD20(`渗透劲·体质豁免（${release.saveMode === 'advantage' ? '优势' : '劣势'}）`, release.targetName)
          : undefined
        savingThrowBlessRoll = release.blessed
          ? (await rollDiceBoxValues(1, 4, '祝福术·渗透劲豁免加值', release.targetName))[0]
          : undefined
        savingThrowBaneRoll = release.baned
          ? (await rollDiceBoxValues(1, 4, '灾祸术·渗透劲豁免减值', release.targetName))[0]
          : undefined
        const initialSave = previewDnd5eSavingThrowRoll({
          rolls: release.saveMode === 'normal'
            ? [savingThrowD20]
            : [savingThrowD20, savingThrowD20Second ?? 0],
          mode: release.saveMode,
          modifier: release.saveModifier + (savingThrowBlessRoll ?? 0) - (savingThrowBaneRoll ?? 0),
          dc: release.saveDc,
        })
        const targetCombatant = feature.state.combatants[release.target.id]
        const targetCharacter = release.target.characterId
          ? feature.characters.find((character) => character.id === release.target.characterId)
          : undefined
        const inspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
        bardicInspirationRoll = !initialSave.success && inspirationDie &&
          initialSave.roll.total + inspirationDie >= release.saveDc
          ? await requestDnd5eBardicInspirationRoll({
              target: targetCharacter,
              targetName: release.targetName,
              dieSides: inspirationDie,
              rollType: '豁免',
              total: initialSave.roll.total,
              targetNumber: release.saveDc,
            })
          : undefined
        const saveSucceededWithInspiration = initialSave.success ||
          initialSave.roll.total + (bardicInspirationRoll ?? 0) >= release.saveDc
        darkOnesOwnLuckRoll = !saveSucceededWithInspiration && targetCombatant &&
          dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
          ? await requestDnd5eDarkOnesOwnLuckRoll({
              target: targetCharacter,
              targetName: release.targetName,
              rollType: '豁免',
              total: initialSave.roll.total + (bardicInspirationRoll ?? 0),
              targetNumber: release.saveDc,
            })
          : undefined
        const saveSucceededWithLuck = saveSucceededWithInspiration ||
          initialSave.roll.total + (bardicInspirationRoll ?? 0) + (darkOnesOwnLuckRoll ?? 0) >= release.saveDc
        let finalSaveSuccess = saveSucceededWithLuck
        const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
        if (!saveSucceededWithLuck && targetCharacter && rerollFeature) {
          const reroll = await requestDnd5eSavingThrowRerollDice({
            target: targetCharacter,
            targetName: release.targetName,
            featureName: rerollFeature.name,
            total: initialSave.roll.total,
            dc: release.saveDc,
            mode: release.saveMode,
          })
          savingThrowRerollD20 = reroll?.d20
          savingThrowRerollD20Second = reroll?.d20Second
          if (reroll?.d20 != null) {
            finalSaveSuccess = previewDnd5eSavingThrowRoll({
              rolls: release.saveMode === 'normal' ? [reroll.d20] : [reroll.d20, reroll.d20Second ?? 0],
              mode: release.saveMode,
              modifier: release.saveModifier + (savingThrowBlessRoll ?? 0) - (savingThrowBaneRoll ?? 0),
              dc: release.saveDc,
            }).success
          }
        }
        if (finalSaveSuccess) {
          classFeatureEffectRolls = await rollDiceBoxValues(10, 10, '渗透劲黯蚀伤害', release.targetName)
        }
      }
      const initialResolved = resolvePreparedDnd5eClassFeature({
        prepared: feature,
        monkAttackRolls,
        turnUndeadSavingThrows,
        savingThrowD20,
        savingThrowD20Second,
        savingThrowBlessRoll,
        savingThrowBaneRoll,
        savingThrowRerollD20,
        savingThrowRerollD20Second,
        bardicInspirationRoll,
        darkOnesOwnLuckRoll,
        effectRolls: classFeatureEffectRolls,
        abilityCheckD20,
        abilityCheckD20Second,
        hideAllowed,
        divineInterventionD100,
      })
      if (!initialResolved.result.ok) {
        acknowledgePlayerAction(action, 'rejected', initialResolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      const resolved = await settleDnd5eConcentrationChecks({
        result: initialResolved.result,
        map: feature.map,
        characters: feature.characters,
        characterIdByCombatantId: feature.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
        requestBardicInspiration: requestDnd5eBardicInspirationRoll,
        requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      applyDnd5eCombatApplication(resolved.application)
      await resolveDnd5eBerserkerRetaliations(resolved.result, authorityMap.id)
      await resolveDnd5eHunterGiantKiller(resolved.result, authorityMap.id)
      for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
        event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
      ))) {
        updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
      }
      for (const reactionTokenId of feature.monkBonusAttack
        ? new Set(monkAttackRolls.flatMap((roll, index) => [
            ...(roll.shieldSpellReaction ? [feature.monkBonusAttack!.targets[index].token.id] : []),
            ...(roll.cuttingWords ? [roll.cuttingWords.bardId] : []),
            ...(roll.cuttingWordsDamage ? [roll.cuttingWordsDamage.bardId] : []),
          ]))
        : []) {
        updateDnd5eTurnEconomy(
          reactionTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      const spentTurnResource = resolved.result.events.find(
        (event) => event.type === 'turn-resource-spent' &&
          (event.resource === 'action' || event.resource === 'bonusAction' || event.resource === 'reaction'),
      )
      const countedTurnResource = spentTurnResource?.type === 'turn-resource-spent' &&
        (spentTurnResource.resource === 'action' || spentTurnResource.resource === 'bonusAction' || spentTurnResource.resource === 'reaction')
        ? spentTurnResource.resource
        : undefined
      if (countedTurnResource) {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, countedTurnResource).economy,
          liveRound,
        )
      }
      const grantedMovement = resolved.result.events.find((event) => event.type === 'movement-granted')
      if (grantedMovement?.type === 'movement-granted') {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => ({
            ...economy,
            movement: {
              current: economy.movement.current + grantedMovement.amount,
              max: economy.movement.max + grantedMovement.amount,
            },
          }),
          liveRound,
        )
      }
      if (resolved.result.events.some((event) => event.type === 'disengage-granted')) {
        setDisengagedCharIds((previous) => new Set(previous).add(feature.actor.id))
      }
      const healing = resolved.result.events
        .filter((event) => event.type === 'healing-applied')
        .reduce((total, event) => total + event.amount, 0)
      const featureDamage = resolved.result.events
        .filter((event) => event.type === 'damage-applied')
        .reduce((total, event) => total + event.amount, 0)
      let targetNames: string | undefined
      if (feature.payload.feature === 'cleric-preserve-life') {
        targetNames = feature.payload.allocations
          .map((allocation) => authorityMap.tokens.find((token) => token.id === allocation.targetTokenId)?.label ?? allocation.targetTokenId)
          .join('、')
      } else if (feature.payload.feature === 'cleric-turn-undead' || feature.payload.feature === 'paladin-turn-the-unholy') {
        targetNames = feature.turnUndead?.targets.map((target) => target.targetName).join('、')
      } else if (feature.payload.feature === 'bardic-inspiration') {
        const targetTokenId = feature.payload.targetTokenId
        targetNames = authorityMap.tokens.find((token) => token.id === targetTokenId)?.label
      } else if (feature.payload.feature === 'paladin-lay-on-hands') {
        const targetTokenId = feature.payload.targetTokenId
        targetNames = authorityMap.tokens.find((token) => token.id === targetTokenId)?.label
      } else if (feature.payload.feature === 'paladin-cleansing-touch') {
        const targetTokenId = feature.payload.targetTokenId
        targetNames = authorityMap.tokens.find((token) => token.id === targetTokenId)?.label
      } else if (feature.payload.feature === 'paladin-divine-sense') {
        const sensed = resolved.result.events.find((event) => event.type === 'creatures-sensed')
        targetNames = sensed?.type === 'creatures-sensed'
          ? sensed.targetIds.map((targetId) => authorityMap.tokens.find((token) => token.id === targetId)?.label ?? targetId).join('、')
          : undefined
      } else if (feature.payload.feature === 'monk-unarmed-bonus') {
        targetNames = feature.payload.targetTokenIds
          .map((targetId) => authorityMap.tokens.find((token) => token.id === targetId)?.label ?? targetId)
          .join('、')
      } else if (feature.payload.feature === 'barbarian-intimidating-presence') {
        const targetTokenId = feature.payload.targetTokenId
        targetNames = authorityMap.tokens.find((token) => token.id === targetTokenId)?.label
      } else if (feature.payload.feature === 'monk-quivering-palm-release') {
        const targetTokenId = feature.payload.targetTokenId
        targetNames = authorityMap.tokens.find((token) => token.id === targetTokenId)?.label
      }
      const detail = (() => {
        switch (feature.payload.feature) {
          case 'barbarian-rage': return feature.payload.end
            ? '以附赠动作主动结束狂暴'
            : feature.payload.frenzy ? '以狂乱进入狂暴，持续至多 1 分钟' : '进入狂暴状态，持续至多 1 分钟'
          case 'barbarian-intimidating-presence': {
            const save = resolved.result.events.find((event) => event.type === 'saving-throw-resolved')
            const frightened = resolved.result.events.some((event) => event.type === 'condition-applied' && event.condition === 'frightened')
            return save?.type === 'saving-throw-resolved'
              ? `${targetNames ?? '目标'} 进行感知豁免 ${save.total} vs DC ${save.dc}，${save.success ? '成功并在24小时内免疫' : frightened ? '失败并陷入恐慌' : '失败但免疫恐慌'}`
              : `延长 ${targetNames ?? '目标'} 的恐慌效果至下个回合结束`
          }
          case 'rogue-cunning-action': {
            if (feature.payload.option === 'dash') return '以附赠动作疾走'
            if (feature.payload.option === 'disengage') return '以附赠动作撤离'
            const check = resolved.result.events.find((event) => event.type === 'ability-check-resolved')
            const hidden = resolved.result.events.some((event) =>
              event.type === 'class-state-changed' && event.stateKey === 'hidden' && event.active,
            )
            return check?.type === 'ability-check-resolved'
              ? `以附赠动作躲藏，隐匿检定 ${check.total}${check.mode === 'advantage' ? '（优势）' : check.mode === 'disadvantage' ? '（劣势）' : ''}，${hidden ? '成功躲藏' : '未避开敌人的被动察觉'}`
              : '以附赠动作尝试躲藏'
          }
          case 'ranger-vanish': {
            const check = resolved.result.events.find((event) => event.type === 'ability-check-resolved')
            const hidden = resolved.result.events.some((event) =>
              event.type === 'class-state-changed' && event.stateKey === 'hidden' && event.active,
            )
            return check?.type === 'ability-check-resolved'
              ? `以附赠动作发动无踪步，隐匿检定 ${check.total}，${hidden ? '成功躲藏' : '未避开敌人的被动察觉'}`
              : '以附赠动作发动无踪步'
          }
          case 'ranger-primeval-awareness': {
            const sensed = resolved.result.events.find((event) => event.type === 'creature-types-sensed')
            return sensed?.type === 'creature-types-sensed'
              ? `消耗 ${feature.payload.slotLevel} 环法术位发动原初感知；${sensed.creatureTypes.length > 0 ? `感知到：${sensed.creatureTypes.join('、')}` : '未感知到异怪、天界生物、龙类、元素生物、妖精、邪魔或亡灵'}（不显示数量与位置）`
              : '发动原初感知'
          }
          case 'ranger-hide-in-plain-sight':
            return '已由DM确认花费1分钟完成自然伪装；下一次敏捷（隐匿）检定 +10，移动或执行其他动作后失效'
          case 'rogue-fast-hands': {
            const check = resolved.result.events.find((event) => event.type === 'ability-check-resolved')
            if (feature.payload.option === 'use-object') return '以附赠动作执行使用物品动作'
            return check?.type === 'ability-check-resolved'
              ? `以附赠动作进行${feature.payload.option === 'sleight-of-hand' ? '敏捷（巧手）' : '敏捷（盗贼工具）'}检定，结果 ${check.total}${check.reliableTalentApplied ? '（可靠才能生效）' : ''}`
              : '以附赠动作发动快手'
          }
          case 'bardic-inspiration': return `令 ${targetNames ?? '目标'} 获得激励骰`
          case 'bard-countercharm': return '开始反魅惑演奏；自身及30尺内能听见的友军对抗魅惑或恐慌的豁免具有优势，持续至下一回合结束'
          case 'paladin-lay-on-hands': return 'cure' in feature.payload
            ? `为 ${targetNames ?? '目标'} ${feature.payload.cure === 'disease' ? '治愈一种疾病' : '中和一种毒素'}，消耗 5 点圣疗池`
            : `令 ${targetNames ?? '目标'} 恢复 ${healing} 点生命值`
          case 'paladin-cleansing-touch': return `结束 ${targetNames ?? '目标'} 身上的${getDnd5eSrdCombatSpell(feature.payload.spellId)?.name ?? feature.payload.spellId}`
          case 'monk-wholeness-of-body': return `恢复 ${healing} 点生命值`
          case 'monk-step-of-the-wind': return feature.payload.option === 'dash' ? '消耗 1 点气并以附赠动作疾走' : '消耗 1 点气并以附赠动作撤离'
          case 'monk-patient-defense': return '消耗 1 点气并以附赠动作执行闪避'
          case 'monk-empty-body': return '消耗 4 点气进入空灵体：隐形并获得除力场外所有伤害抗性，持续1分钟'
          case 'monk-quivering-palm-release': {
            const save = resolved.result.events.find((event) => event.type === 'saving-throw-resolved')
            const reduced = resolved.result.events.some((event) => event.type === 'hit-points-reduced-to-zero')
            return save?.type === 'saving-throw-resolved'
              ? `${targetNames ?? '目标'} 体质豁免 ${save.total} vs DC ${save.dc}，${reduced ? '失败并降至 0 HP' : `成功并受到 ${featureDamage} 点黯蚀伤害`}`
              : `引爆 ${targetNames ?? '目标'} 体内的震动`
          }
          case 'monk-quivering-palm-end': return '无害结束当前目标体内的震动，不消耗动作'
          case 'monk-unarmed-bonus': {
            const stunningCount = resolved.result.events.filter((event) => event.type === 'condition-applied' && event.condition === '震慑').length
            const proneCount = resolved.result.events.filter((event) => event.type === 'condition-applied' && event.condition === 'prone').length
            const pushCount = resolved.result.events.filter((event) => event.type === 'moved' && event.actorId !== feature.actorToken.id).length
            const noReactionCount = resolved.result.events.filter((event) =>
              event.type === 'class-state-changed' && event.stateKey === 'open-hand-no-reactions' && event.active,
            ).length
            const quiveringPalmImplanted = resolved.result.events.some((event) =>
              event.type === 'class-state-changed' && event.stateKey === 'quivering-palm' && event.active,
            )
            const tranquilityPrevented = resolved.result.events.filter((event) => event.type === 'hostile-targeting-prevented').length
            const cuttingWordsDamageReduction = monkAttackRolls.reduce(
              (total, attackRoll) => total + (attackRoll.cuttingWordsDamage?.roll ?? 0),
              0,
            )
            const openHandText = feature.payload.openHandTechniques?.some(Boolean)
              ? `；散打技法：${proneCount} 个目标倒地、${pushCount} 个目标被推开、${noReactionCount} 个目标不能进行反应`
              : ''
            return `${feature.payload.mode === 'flurry' ? '消耗 1 点气发动疾风连击' : '发动武艺附赠攻击'}，攻击 ${targetNames}，造成 ${featureDamage} 点伤害${cuttingWordsDamageReduction > 0 ? `；扰乱之语使伤害掷骰共减少 ${cuttingWordsDamageReduction}` : ''}${tranquilityPrevented > 0 ? `；${tranquilityPrevented} 次攻击被宁静心境阻止` : ''}${feature.payload.stunningStrike ? `；震慑拳令 ${stunningCount} 个目标陷入震慑` : ''}${openHandText}${quiveringPalmImplanted ? '；消耗 3 点气植入渗透劲' : ''}`
          }
          case 'paladin-sacred-weapon': return '消耗 1 次引导神力，使武器在 1 分钟内获得命中加值'
          case 'paladin-divine-sense': return targetNames ? `感知到：${targetNames}` : '未感知到符合类型的生物'
          case 'paladin-turn-the-unholy': {
            const turned = resolved.result.events.filter((event) => event.type === 'unholy-turned').length
            const succeeded = resolved.result.events.filter((event) => event.type === 'saving-throw-resolved' && event.success).length
            return `${targetNames || '范围内邪魔与亡灵'}：${turned} 个被驱散，${succeeded} 个豁免成功`
          }
          case 'paladin-holy-nimbus': return '神圣光轮已激活，持续1分钟；30尺内敌人在其中开始回合时受到10点光耀伤害'
          case 'cleric-turn-undead': {
            const turned = resolved.result.events.filter((event) => event.type === 'undead-turned').length
            const destroyed = resolved.result.events.filter((event) => event.type === 'undead-destroyed').length
            const succeeded = resolved.result.events.filter((event) => event.type === 'saving-throw-resolved' && event.success).length
            return `${targetNames || '范围内亡灵'}：${destroyed} 个被摧毁，${turned} 个被驱散，${succeeded} 个豁免成功`
          }
          case 'cleric-preserve-life': return `为 ${targetNames} 共恢复 ${healing} 点生命值`
          case 'cleric-divine-intervention': {
            const intervention = resolved.result.events.find((event) => event.type === 'divine-intervention-resolved')
            if (intervention?.type !== 'divine-intervention-resolved') return '请求神祇援助'
            if (intervention.success) return intervention.automatic
              ? '20级神圣干预自动成功；具体援助效果由 DM 裁定，7天内不能再次使用'
              : `百分骰 ${intervention.d100} ≤ 牧师等级 ${dnd5eCharacterClassLevel(feature.actor, 'cleric')}，干预成功；具体援助效果由 DM 裁定，7天内不能再次使用`
            return `百分骰 ${intervention.d100} > 牧师等级 ${dnd5eCharacterClassLevel(feature.actor, 'cleric')}，干预未成功；完成长休后可再次尝试`
          }
          case 'sorcerer-create-spell-slot': return `创造 1 个 ${feature.payload.slotLevel} 环法术位`
          case 'sorcerer-convert-spell-slot': return `消耗 1 个 ${feature.payload.slotLevel} 环法术位并恢复 ${feature.payload.slotLevel} 点术法点`
          case 'sorcerer-draconic-wings': return feature.payload.active
            ? '以附赠动作展开龙翼，获得等同当前步行速度的飞行速度'
            : '以附赠动作收起龙翼'
          case 'sorcerer-draconic-presence': return `消耗5点术法点发动${feature.payload.mode === 'awe' ? '敬畏' : '恐惧'}龙威；专注至多1分钟，60尺内敌人在回合开始时进行感知豁免`
          case 'warlock-hurl-through-hell-ready': return feature.payload.active
            ? '已预备坠入地狱；下一次攻击命中时自动消耗每日次数'
            : '已取消坠入地狱预备'
          case 'druid-wild-shape': return `变为${getDnd5eSrdMonster(feature.payload.formId)?.name ?? feature.payload.formId}，获得独立的野兽生命池`
          case 'druid-end-wild-shape': return '以附赠动作恢复原形'
        }
      })()
      pushHeadlessCombatLog(
        `${feature.actor.name} 使用${dnd5eClassFeatureLabel(feature.payload)}：${detail}。`,
        healing > 0 || featureDamage > 0 ? 'damage' : 'system',
        resolved.result.events,
      )
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-fighter-feature' && action.type === 'dnd5e-fighter-feature') {
      const turnKey = `${action.combatId ?? combatIdRef.current}:${liveRound}:${action.actorTokenId}`
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const prepared = prepareDnd5eFighterFeature({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        actionSurgeAlreadyUsed: dnd5eActionSurgeTurnKeysRef.current.has(turnKey) || turnEconomy.action.max > 1,
        turnEconomy,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const feature = prepared.prepared
      const d10 = feature.feature === 'second-wind'
        ? (await rollDiceBoxValues(1, 10, '回气恢复', feature.actor.name))[0]
        : undefined
      const resolved = resolvePreparedDnd5eFighterFeature({ prepared: feature, d10 })
      if (!resolved.result.ok || !resolved.application) {
        acknowledgePlayerAction(action, 'rejected', resolved.result.ok ? 'missing-application' : resolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      applyDnd5eCombatApplication(resolved.application)
      if (feature.feature === 'action-surge') {
        dnd5eActionSurgeTurnKeysRef.current.add(turnKey)
        updateDnd5eTurnEconomy(action.actorTokenId, grantDnd5eActionSurge, liveRound)
      } else {
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'bonusAction').economy,
          liveRound,
        )
      }
      const healing = resolved.result.events.find((event) => event.type === 'healing-applied')
      pushHeadlessCombatLog(
        feature.feature === 'second-wind'
          ? `${feature.actor.name} 使用回气，恢复 ${healing?.type === 'healing-applied' ? healing.amount : 0} 点生命值（1d10=${d10}＋战士等级 ${dnd5eCharacterClassLevel(feature.actor, 'fighter')}）`
          : `${feature.actor.name} 使用动作如潮，本回合获得第二个动作`,
        feature.feature === 'second-wind' ? 'damage' : 'system',
        resolved.result.events,
        feature.feature === 'second-wind' ? [`回气恢复骰：1d10 = ${d10}`] : ['动作如潮：本回合增加 1 个动作'],
      )
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'dnd5e-weapon-attack' && action.type === 'dnd5e-weapon-attack') {
      const usageKey = `${action.combatId ?? combatIdRef.current}:${liveRound}:${action.actorTokenId}`
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const wildShapeActionIndex = action.dnd5eWeaponAttackOptions?.wildShapeActionIndex
      const hunterMultiattackFeature = action.dnd5eWeaponAttackOptions?.hunterMultiattack
      if (hunterMultiattackFeature) {
        const preparedHunterMultiattack = prepareDnd5eHunterMultiattack({
          action,
          map: authorityMap,
          characters: useCharacterStore.getState().characters,
          initiativeOrder: initiativeOrderRef.current,
          turnEconomy,
          turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
        })
        if (!preparedHunterMultiattack.ok) {
          acknowledgePlayerAction(action, 'rejected', preparedHunterMultiattack.reason)
          completePlayerActionRequest(action)
          return
        }
        const multiattack = preparedHunterMultiattack.prepared
        const rolls: Dnd5eHunterMultiattackResolutionRoll[] = []
        const previews: ReturnType<typeof previewDnd5eHunterMultiattack>[] = []
        const protectionReactionTokenIds = new Set<string>()
        const cuttingWordsReactionTokenIds = new Set<string>()
        const shieldSpellReactionTokenIds = new Set<string>()
        const uncannyDodgeReactionTokenIds = new Set<string>()
        const deflectMissilesReactionTokenIds = new Set<string>()
        const actorCombatant = multiattack.state.combatants[multiattack.actorToken.id]
        const inspirationDie = actorCombatant ? dnd5eHeldBardicInspirationDie(actorCombatant) : undefined
        let bardicInspirationCommitted = false
        let tranquilityRerollCommitted = false
        let colossusSlayerCommitted = false
        const classDamageLabels = {
          'sneak-attack': '偷袭',
          'colossus-slayer': '巨像杀手',
          'brutal-critical': '凶蛮重击',
          'improved-divine-smite': '精通至圣斩',
          'divine-smite': '至圣斩',
          'hunters-mark': '猎人印记',
          'divine-strike': '神圣打击',
          'lifedrinker': '饮命者',
          'foe-slayer': '屠灭众敌',
        } as const
        for (let index = 0; index < multiattack.targets.length; index += 1) {
          const target = multiattack.targets[index]
          if (!actorCombatant) {
            acknowledgePlayerAction(action, 'rejected', 'combatant-missing')
            completePlayerActionRequest(action)
            return
          }
          const tranquility = await rollDnd5eTranquilityWard({
            ward: target.tranquilityWard,
            attacker: actorCombatant,
            attackerCharacter: multiattack.actor,
            attackerName: multiattack.actor.name,
            bardicInspirationAvailable: !bardicInspirationCommitted,
            savingThrowRerollAvailable: !tranquilityRerollCommitted,
          })
          if (tranquility.roll?.bardicInspirationRoll != null) bardicInspirationCommitted = true
          if (tranquility.roll?.rerollD20 != null) tranquilityRerollCommitted = true
          const protectionCandidate = tranquility.passed ? findDnd5eProtectionCandidate(
            authorityMap,
            multiattack.actorToken,
            target.token,
            new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
          ) : undefined
          const useProtection = !!(protectionCandidate && await requestSharedProtectionChoice(protectionCandidate.character, {
            attackerName: multiattack.actor.name,
            targetName: target.token.label,
            attackName: multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击',
          }))
          if (useProtection && protectionCandidate) protectionReactionTokenIds.add(protectionCandidate.token.id)
          const protectedPreview = previewDnd5eHunterMultiattack(multiattack, index, 10, undefined, useProtection)
          const attackMode = protectedPreview.mode
          const d20 = tranquility.passed ? await rollDiceBoxD20(
            `${multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击'}·命中检定`,
            target.token.label,
          ) : 1
          const d20Second = tranquility.passed && attackMode !== 'normal'
            ? await rollDiceBoxD20(
                `${multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击'}·命中检定（${attackMode === 'advantage' ? '优势' : '劣势'}）`,
                target.token.label,
              )
            : undefined
          const blessRoll = tranquility.passed && multiattack.blessed
            ? (await rollDiceBoxValues(1, 4, '祝福术·攻击加值', multiattack.actor.name))[0]
            : undefined
          const baneRoll = tranquility.passed && multiattack.baned
            ? (await rollDiceBoxValues(1, 4, '灾祸术·攻击减值', multiattack.actor.name))[0]
            : undefined
          const preview = previewDnd5eHunterMultiattack(multiattack, index, d20, d20Second, useProtection, blessRoll, baneRoll)
          const bardicInspirationRoll = tranquility.passed && !bardicInspirationCommitted && !preview.hit && !preview.roll.naturalOne &&
            inspirationDie && preview.roll.total + inspirationDie >= target.armorClass
            ? await requestDnd5eBardicInspirationRoll({
                target: multiattack.actor,
                targetName: multiattack.actor.name,
                dieSides: inspirationDie,
                rollType: '攻击检定',
                total: preview.roll.total,
                targetNumber: target.armorClass,
              })
            : undefined
          if (bardicInspirationRoll != null) bardicInspirationCommitted = true
          const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
          const hitBeforeCuttingWords = preview.critical || (!preview.roll.naturalOne &&
            attackTotalBeforeCuttingWords >= target.armorClass)
          const cuttingWordsCandidate = tranquility.passed && hitBeforeCuttingWords && !preview.critical
            ? findDnd5eCuttingWordsCandidate(
                authorityMap,
                multiattack.state,
                multiattack.actorToken,
                target.token,
                new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
              )
            : undefined
          const cuttingWords = cuttingWordsCandidate &&
            attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < target.armorClass
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
                attackerName: multiattack.actor.name,
                targetName: target.token.label,
                attackName: multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击',
                total: attackTotalBeforeCuttingWords,
                targetNumber: target.armorClass,
              })
            : undefined
          if (cuttingWords && cuttingWordsCandidate) cuttingWordsReactionTokenIds.add(cuttingWordsCandidate.token.id)
          const attackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
          let attackHit = preview.critical || (!preview.roll.naturalOne && attackTotal >= target.armorClass)
          const targetCombatant = multiattack.state.combatants[target.token.id]
          const targetCharacter = target.token.characterId
            ? multiattack.characters.find((character) => character.id === target.token.characterId)
            : undefined
          const shieldSpellReaction = !!(
            attackHit && !cuttingWordsReactionTokenIds.has(target.token.id) && targetCombatant && targetCharacter &&
            dnd5eCanCastShieldSpell(targetCombatant) &&
            await requestSharedShieldSpellChoice(targetCharacter, {
              attackerName: multiattack.actor.name,
              attackName: multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击',
              attackTotal,
              armorClass: target.armorClass,
            })
          )
          if (shieldSpellReaction) {
            shieldSpellReactionTokenIds.add(target.token.id)
            if (!preview.critical) attackHit = attackTotal >= target.armorClass + 5
          }
          const standAgainstTide = !attackHit && !shieldSpellReaction && tranquility.passed &&
            multiattack.feature === 'whirlwind-attack'
            ? await buildDnd5eStandAgainstTideUse({
                map: authorityMap,
                state: multiattack.state,
                attackerToken: multiattack.actorToken,
                hunterToken: target.token,
                attackerName: multiattack.actor.name,
                attackName: '旋风攻击',
                attackModifier: multiattack.profile.attackModifier,
                criticalThreshold: multiattack.profile.criticalThreshold,
                reachFeet: multiattack.profile.reachFeet ?? 5,
                damage: [multiattack.profile.damage],
                classDamageContext: target.classDamageContext,
                greatWeaponFighting: multiattack.profile.greatWeaponFighting,
                bardicInspirationAlreadyUsed: bardicInspirationCommitted,
                excludedReactionTokenIds: new Set([
                  ...protectionReactionTokenIds,
                  ...cuttingWordsReactionTokenIds,
                  ...shieldSpellReactionTokenIds,
                ]),
                excludedClassDamageSources: colossusSlayerCommitted ? new Set(['colossus-slayer']) : undefined,
              })
            : undefined
          const uncannyDodge = !!(
            attackHit && !shieldSpellReaction && targetCombatant && targetCharacter &&
            !uncannyDodgeReactionTokenIds.has(target.token.id) && dnd5eCanUseUncannyDodge(targetCombatant) &&
            await requestSharedUncannyDodgeChoice(targetCharacter, {
              attackerName: multiattack.actor.name,
              attackName: multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击',
            })
          )
          if (uncannyDodge) uncannyDodgeReactionTokenIds.add(target.token.id)
          const useDeflectMissiles = !!(
            attackHit && multiattack.feature === 'volley' && !shieldSpellReaction && !uncannyDodge &&
            targetCombatant && targetCharacter && !deflectMissilesReactionTokenIds.has(target.token.id) &&
            dnd5eCanUseDeflectMissiles(targetCombatant) &&
            await requestSharedDeflectMissilesChoice(targetCharacter, {
              phase: 'reduce',
              attackerName: multiattack.actor.name,
              attackName: '万箭齐发',
            })
          )
          const deflectMissilesD10 = useDeflectMissiles
            ? (await rollDiceBoxValues(1, 10, '拨挡飞弹·减伤', target.token.label))[0]
            : undefined
          if (useDeflectMissiles) deflectMissilesReactionTokenIds.add(target.token.id)
          let damageRolls = attackHit
            ? await rollDiceBoxValues(
                multiattack.profile.damage.count * (preview.critical ? 2 : 1),
                multiattack.profile.damage.sides,
                `${multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击'}·伤害`,
                target.token.label,
              )
            : []
          if (multiattack.profile.greatWeaponFighting && damageRolls.some((value) => value <= 2)) {
            const rerolled: number[] = []
            for (const value of damageRolls) {
              rerolled.push(value <= 2
                ? (await rollDiceBoxValues(1, multiattack.profile.damage.sides, '巨武器战斗重掷', target.token.label))[0]
                : value)
            }
            damageRolls = rerolled
          }
          const classDamageDefinitions = attackHit
            ? dnd5eHunterMultiattackClassDamageDefinitions(multiattack, index, preview.critical, {
                protectedAttack: useProtection,
                colossusSlayerCommitted,
              })
            : []
          const classDamageRolls: Dnd5eClassDamageRolls[] = []
          for (const definition of classDamageDefinitions) {
            const count = definition.count * (preview.critical && definition.doubleOnCritical ? 2 : 1)
            classDamageRolls.push({
              source: definition.source,
              rolls: count > 0
                ? await rollDiceBoxValues(count, definition.sides, classDamageLabels[definition.source], target.token.label)
                : [],
            })
          }
          const rawDamageTotal = Math.max(
            0,
            damageRolls.reduce((sum, value) => sum + value, 0) + multiattack.profile.damage.bonus,
          ) + classDamageDefinitions.reduce((sum, definition) => {
            const supplied = classDamageRolls.find((entry) => entry.source === definition.source)?.rolls ?? []
            return sum + Math.max(
              0,
              supplied.reduce((subtotal, value) => subtotal + value, 0) + (definition.bonus ?? 0),
            )
          }, 0)
          const cuttingWordsDamageCandidate = attackHit && rawDamageTotal > 0 && !cuttingWords
            ? findDnd5eCuttingWordsCandidate(
                authorityMap,
                multiattack.state,
                multiattack.actorToken,
                target.token,
                new Set([
                  ...protectionReactionTokenIds,
                  ...cuttingWordsReactionTokenIds,
                  ...shieldSpellReactionTokenIds,
                  ...uncannyDodgeReactionTokenIds,
                  ...deflectMissilesReactionTokenIds,
                ]),
              )
            : undefined
          const cuttingWordsDamage = cuttingWordsDamageCandidate
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
                attackerName: multiattack.actor.name,
                targetName: target.token.label,
                attackName: multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击',
                total: rawDamageTotal,
                phase: 'damage',
              })
            : undefined
          if (cuttingWordsDamage && cuttingWordsDamageCandidate) {
            cuttingWordsReactionTokenIds.add(cuttingWordsDamageCandidate.token.id)
          }
          if (attackHit && classDamageDefinitions.some((definition) => definition.source === 'colossus-slayer')) {
            colossusSlayerCommitted = true
          }
          previews.push({
            ...preview,
            hit: attackHit,
            roll: bardicInspirationRoll == null && !cuttingWords
              ? preview.roll
              : {
                  ...preview.roll,
                  modifier: preview.roll.modifier + (bardicInspirationRoll ?? 0) - (cuttingWords?.roll ?? 0),
                  total: attackTotal,
                },
          })
          rolls.push({
            d20,
            d20Second,
            blessRoll,
            baneRoll,
            bardicInspirationRoll,
            cuttingWords,
            cuttingWordsDamage,
            protectionReactionActorId: useProtection ? protectionCandidate?.token.id : undefined,
            shieldSpellReaction,
            uncannyDodge,
            deflectMissilesD10,
            tranquilitySave: tranquility.roll,
            damageRolls,
            classDamageRolls,
            standAgainstTide,
          })
        }
        const initialResolved = resolvePreparedDnd5eHunterMultiattack({ prepared: multiattack, rolls })
        if (!initialResolved.result.ok) {
          acknowledgePlayerAction(action, 'rejected', initialResolved.result.reason)
          completePlayerActionRequest(action)
          return
        }
        const resolved = await settleDnd5eConcentrationChecks({
          result: initialResolved.result,
          map: multiattack.map,
          characters: multiattack.characters,
          characterIdByCombatantId: multiattack.characterIdByCombatantId,
          rollD20: rollDiceBoxD20,
          rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
          rollDice: rollDiceBoxValues,
          requestHellishRebuke: requestSharedHellishRebukeChoice,
          requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
          requestBardicInspiration: requestDnd5eBardicInspirationRoll,
          requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
        })
        applyDnd5eCombatApplication(resolved.application)
        await resolveDnd5eBerserkerRetaliations(resolved.result, authorityMap.id)
        await resolveDnd5eHunterGiantKiller(resolved.result, authorityMap.id)
        for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
          event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
        ))) {
          updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
        }
        for (const tokenId of new Set([
          ...protectionReactionTokenIds,
          ...cuttingWordsReactionTokenIds,
          ...shieldSpellReactionTokenIds,
          ...uncannyDodgeReactionTokenIds,
          ...deflectMissilesReactionTokenIds,
        ])) {
          updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
        }
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'action').economy,
          liveRound,
        )
        let returnState = resolved.result.state
        let returnMap = resolved.application.map
        let returnCharacters = resolved.application.characters
        const caughtMissiles = resolved.result.events.filter((event) =>
          event.type === 'damage-reduced' && event.source === 'deflect-missiles' && event.caught,
        )
        for (const caught of caughtMissiles) {
          if (caught.type !== 'damage-reduced' || caught.source !== 'deflect-missiles' || !caught.caught) continue
          const target = multiattack.targets.find((candidate) => candidate.token.id === caught.targetId)
          const targetCharacter = target?.token.characterId
            ? returnCharacters.find((character) => character.id === target.token.characterId)
            : undefined
          if (!target || !targetCharacter) continue
          const distanceFeet = tokenFootprintDistanceCells(multiattack.actorToken, target.token, multiattack.map) *
            Math.max(1, multiattack.map.feetPerCell ?? 5)
          const kiCurrent = returnState.combatants[target.token.id]?.classResources['dnd5e-ki']?.current ?? 0
          const canReturn = kiCurrent > 0 && distanceFeet <= 60
          const returnAccepted = canReturn && await requestSharedDeflectMissilesChoice(targetCharacter, {
            phase: 'return',
            attackerName: multiattack.actor.name,
            attackName: '万箭齐发',
            kiCurrent,
          })
          const returnD20 = returnAccepted
            ? await rollDiceBoxD20('拨挡飞弹·掷回命中', multiattack.actor.name)
            : 1
          const returnD20Second = returnAccepted && distanceFeet > 20
            ? await rollDiceBoxD20('拨挡飞弹·掷回命中（远距劣势）', multiattack.actor.name)
            : undefined
          const returnNatural = returnD20Second == null ? returnD20 : Math.min(returnD20, returnD20Second)
          const returnDamageRolls = returnAccepted
            ? await rollDiceBoxValues(
                returnNatural === 20 ? 2 : 1,
                dnd5eMonkMartialArtsDie(targetCharacter.level),
                '拨挡飞弹·掷回伤害',
                multiattack.actor.name,
              )
            : []
          const returned = resolveDnd5eHeadlessAction(returnState, {
            type: 'monk-deflect-missiles-return',
            actorId: target.token.id,
            targetId: multiattack.actorToken.id,
            distanceFeet,
            decline: !returnAccepted,
            d20: returnD20,
            d20Second: returnD20Second,
            damageRolls: returnDamageRolls,
          })
          if (!returned.ok) continue
          const returnedSettled = await settleDnd5eConcentrationChecks({
            result: returned,
            map: returnMap,
            characters: returnCharacters,
            characterIdByCombatantId: multiattack.characterIdByCombatantId,
            rollD20: rollDiceBoxD20,
            rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
            rollDice: rollDiceBoxValues,
            requestHellishRebuke: requestSharedHellishRebukeChoice,
            requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
            requestBardicInspiration: requestDnd5eBardicInspirationRoll,
            requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
          })
          returnState = returnedSettled.result.state
          returnMap = returnedSettled.application.map
          returnCharacters = returnedSettled.application.characters
          applyDnd5eCombatApplication(returnedSettled.application)
          if (returnAccepted) {
            const returnAttack = returnedSettled.result.events.find((event) => event.type === 'attack-resolved')
            const returnDamage = returnedSettled.result.events.find((event) => event.type === 'damage-applied')
            pushCombatLog(
              returnAttack?.type === 'attack-resolved' && returnAttack.hit
                ? `${targetCharacter.name} 消耗 1 点气掷回飞弹并命中 ${multiattack.actor.name}，造成 ${returnDamage?.type === 'damage-applied' ? returnDamage.amount : 0} 点伤害。`
                : `${targetCharacter.name} 消耗 1 点气掷回飞弹，但未命中 ${multiattack.actor.name}。`,
              returnDamage?.type === 'damage-applied' && returnDamage.amount > 0 ? 'damage' : 'attack',
            )
          }
        }
        const summary = multiattack.targets.map((target) => {
          const attackEvent = resolved.result.events.find((event) => event.type === 'attack-resolved' && event.targetId === target.token.id)
          const damageEvent = resolved.result.events.find((event) => event.type === 'damage-applied' && event.targetId === target.token.id)
          const tranquilityPrevented = resolved.result.events.some((event) =>
            event.type === 'hostile-targeting-prevented' && event.targetId === target.token.id,
          )
          const damageReduction = rolls[multiattack.targets.indexOf(target)]?.cuttingWordsDamage?.roll
          return attackEvent?.type === 'attack-resolved'
            ? `${target.token.label}：${attackEvent.total} vs AC ${attackEvent.armorClass}，${attackEvent.hit ? `命中并造成 ${damageEvent?.type === 'damage-applied' ? damageEvent.amount : 0} 点伤害${damageReduction ? `（扰乱之语令伤害骰 -${damageReduction}）` : ''}` : '未命中'}`
            : `${target.token.label}：${tranquilityPrevented ? '宁静心境阻止攻击' : '未结算'}`
        }).join('；')
        const featureName = multiattack.feature === 'volley' ? '万箭齐发' : '旋风攻击'
        pushHeadlessCombatLog(
          `${multiattack.actor.name} 使用${featureName}，分别攻击 ${multiattack.targets.length} 个目标：${summary}。`,
          'attack',
          resolved.result.events,
          [`范围攻击目标：${multiattack.targets.map((target) => target.token.label).join('、')}`],
        )
        const lastIndex = Math.max(0, multiattack.targets.length - 1)
        const lastTarget = multiattack.targets[lastIndex]
        const lastPreview = previews[lastIndex]
        const lastRoll = rolls[lastIndex]
        if (lastTarget && lastPreview && lastRoll) {
          const damageEvent = resolved.result.events.find((event) => event.type === 'damage-applied' && event.targetId === lastTarget.token.id)
          const display: DiceRoll = {
            values: [...lastRoll.damageRolls, ...(lastRoll.classDamageRolls ?? []).flatMap((entry) => entry.rolls)],
            sides: multiattack.profile.damage.sides,
            bonus: lastPreview.hit ? multiattack.profile.damage.bonus : 0,
            total: damageEvent?.type === 'damage-applied' ? damageEvent.amount : 0,
            label: `${featureName}（SRD 5.1）`,
            targetName: lastTarget.token.label,
            d20Roll: {
              value: lastPreview.roll.d20,
              modifier: lastPreview.roll.modifier,
              ac: lastTarget.armorClass,
              hit: lastPreview.hit,
            },
          }
          setRoll(display)
          publishSharedDiceRoll(display)
        }
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted')
        return
      }
      if (wildShapeActionIndex != null) {
        const preparedWildShapeAttack = prepareDnd5eMonsterAttack({
          combatId: (action.combatId ?? combatIdRef.current) || `map-${authorityMap.id}`,
          round: liveRound,
          map: authorityMap,
          characters: useCharacterStore.getState().characters,
          initiativeOrder: initiativeOrderRef.current,
          actorTokenId: action.actorTokenId,
          targetTokenId: action.targetTokenId ?? '',
          actionIndex: wildShapeActionIndex,
          turnEconomy,
          turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
        })
        if (!preparedWildShapeAttack.ok) {
          acknowledgePlayerAction(action, 'rejected', preparedWildShapeAttack.reason)
          completePlayerActionRequest(action)
          return
        }
        const wildShapeAttack = preparedWildShapeAttack.prepared
        const actionRolls: { d20: number; d20Second?: number; blessRoll?: number; baneRoll?: number; bardicInspirationRoll?: number; cuttingWords?: Dnd5eCuttingWordsUse; cuttingWordsDamage?: Dnd5eCuttingWordsUse; protectionReactionActorId?: string; shieldSpellReaction?: boolean; tranquilitySave?: Dnd5eTranquilitySaveRoll; damageRolls: number[][]; standAgainstTide?: Dnd5eStandAgainstTideUse }[] = []
        const previews: ReturnType<typeof previewDnd5eMonsterAttack>[] = []
        const wildShapeActorCombatant = wildShapeAttack.state.combatants[wildShapeAttack.actorToken.id]
        const wildShapeActorCharacter = wildShapeAttack.actorToken.characterId
          ? wildShapeAttack.characters.find((character) => character.id === wildShapeAttack.actorToken.characterId)
          : undefined
        const wildShapeTargetCombatant = wildShapeAttack.state.combatants[wildShapeAttack.targetToken.id]
        const wildShapeTargetCharacter = wildShapeAttack.targetToken.characterId
          ? wildShapeAttack.characters.find((character) => character.id === wildShapeAttack.targetToken.characterId)
          : undefined
        const inspirationDie = wildShapeActorCombatant ? dnd5eHeldBardicInspirationDie(wildShapeActorCombatant) : undefined
        let bardicInspirationCommitted = false
        let tranquilityRerollCommitted = false
        let shieldSpellUsed = false
        let standAgainstTideUsed = false
        const protectionReactionTokenIds = new Set<string>()
        const cuttingWordsReactionTokenIds = new Set<string>()
        for (let index = 0; index < wildShapeAttack.attacks.length; index += 1) {
          const attackEntry = wildShapeAttack.attacks[index]
          if (!wildShapeActorCombatant) {
            acknowledgePlayerAction(action, 'rejected', 'combatant-missing')
            completePlayerActionRequest(action)
            return
          }
          const tranquility = await rollDnd5eTranquilityWard({
            ward: wildShapeAttack.tranquilityWard,
            attacker: wildShapeActorCombatant,
            attackerCharacter: wildShapeActorCharacter,
            attackerName: wildShapeAttack.actorToken.label,
            bardicInspirationAvailable: !bardicInspirationCommitted,
            savingThrowRerollAvailable: !tranquilityRerollCommitted,
          })
          if (tranquility.roll?.bardicInspirationRoll != null) bardicInspirationCommitted = true
          if (tranquility.roll?.rerollD20 != null) tranquilityRerollCommitted = true
          const protectionCandidate = tranquility.passed ? findDnd5eProtectionCandidate(
            authorityMap,
            wildShapeAttack.actorToken,
            wildShapeAttack.targetToken,
            new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
          ) : undefined
          const useProtection = !!(protectionCandidate && await requestSharedProtectionChoice(protectionCandidate.character, {
            attackerName: wildShapeAttack.actorToken.label,
            targetName: wildShapeAttack.targetToken.label,
            attackName: attackEntry.name,
          }))
          if (useProtection && protectionCandidate) protectionReactionTokenIds.add(protectionCandidate.token.id)
          const attackMode = dnd5eMonsterAttackModeWithProtection(
            dnd5ePreparedMonsterAttackMode(wildShapeAttack, index),
            useProtection,
          )
          const d20 = tranquility.passed
            ? await rollDiceBoxD20(`${wildShapeAttack.monster.name}·${attackEntry.name}命中检定`, wildShapeAttack.targetToken.label)
            : 1
          const d20Second = tranquility.passed && attackMode !== 'normal'
            ? await rollDiceBoxD20(`${wildShapeAttack.monster.name}·${attackEntry.name}命中检定（${attackMode === 'advantage' ? '优势' : '劣势'}）`, wildShapeAttack.targetToken.label)
            : undefined
          const blessRoll = tranquility.passed && wildShapeAttack.blessed
            ? (await rollDiceBoxValues(1, 4, '祝福术·攻击加值', wildShapeAttack.actorToken.label))[0]
            : undefined
          const baneRoll = tranquility.passed && wildShapeAttack.baned
            ? (await rollDiceBoxValues(1, 4, '灾祸术·攻击减值', wildShapeAttack.actorToken.label))[0]
            : undefined
          const preview = previewDnd5eMonsterAttack(wildShapeAttack, index, d20, d20Second, useProtection, blessRoll, baneRoll)
          const armorClassBeforeReaction = wildShapeAttack.targetArmorClass + (shieldSpellUsed ? 5 : 0)
          const hitBeforeInspiration = preview.critical || (!preview.roll.naturalOne && preview.roll.total >= armorClassBeforeReaction)
          const bardicInspirationRoll = tranquility.passed && !bardicInspirationCommitted && !hitBeforeInspiration && !preview.roll.naturalOne &&
            inspirationDie && preview.roll.total + inspirationDie >= armorClassBeforeReaction
            ? await requestDnd5eBardicInspirationRoll({
                target: wildShapeActorCharacter,
                targetName: wildShapeAttack.actorToken.label,
                dieSides: inspirationDie,
                rollType: '攻击检定',
                total: preview.roll.total,
                targetNumber: armorClassBeforeReaction,
              })
            : undefined
          if (bardicInspirationRoll != null) bardicInspirationCommitted = true
          const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
          const hitBeforeCuttingWords = preview.critical || (!preview.roll.naturalOne && attackTotalBeforeCuttingWords >= armorClassBeforeReaction)
          const cuttingWordsCandidate = tranquility.passed && hitBeforeCuttingWords && !preview.critical
            ? findDnd5eCuttingWordsCandidate(
                authorityMap,
                wildShapeAttack.state,
                wildShapeAttack.actorToken,
                wildShapeAttack.targetToken,
                new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
              )
            : undefined
          const cuttingWords = cuttingWordsCandidate &&
            attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < armorClassBeforeReaction
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
                attackerName: wildShapeAttack.actorToken.label,
                targetName: wildShapeAttack.targetToken.label,
                attackName: attackEntry.name,
                total: attackTotalBeforeCuttingWords,
                targetNumber: armorClassBeforeReaction,
              })
            : undefined
          if (cuttingWords && cuttingWordsCandidate) cuttingWordsReactionTokenIds.add(cuttingWordsCandidate.token.id)
          const attackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
          let attackHit = preview.critical || (!preview.roll.naturalOne && attackTotal >= armorClassBeforeReaction)
          const shieldSpellReaction = !!(
            attackHit && !shieldSpellUsed && !cuttingWordsReactionTokenIds.has(wildShapeAttack.targetToken.id) &&
            wildShapeTargetCombatant && wildShapeTargetCharacter &&
            dnd5eCanCastShieldSpell(wildShapeTargetCombatant) &&
            await requestSharedShieldSpellChoice(wildShapeTargetCharacter, {
              attackerName: wildShapeAttack.actorToken.label,
              attackName: attackEntry.name,
              attackTotal,
              armorClass: armorClassBeforeReaction,
            })
          )
          if (shieldSpellReaction) {
            shieldSpellUsed = true
            if (!preview.critical) attackHit = attackTotal >= armorClassBeforeReaction + 5
          }
          const standAgainstTide = !attackHit && !shieldSpellReaction && !standAgainstTideUsed && tranquility.passed &&
            attackEntry.attack.mode !== 'ranged' && attackEntry.attack.reachFeet
            ? await buildDnd5eStandAgainstTideUse({
                map: authorityMap,
                state: wildShapeAttack.state,
                attackerToken: wildShapeAttack.actorToken,
                hunterToken: wildShapeAttack.targetToken,
                attackerName: wildShapeAttack.actorToken.label,
                attackName: attackEntry.name,
                attackModifier: attackEntry.attack.toHit,
                reachFeet: attackEntry.attack.reachFeet,
                damage: attackEntry.attack.damage,
                bardicInspirationAlreadyUsed: bardicInspirationCommitted,
                excludedReactionTokenIds: new Set([...protectionReactionTokenIds, ...cuttingWordsReactionTokenIds]),
              })
            : undefined
          if (standAgainstTide) standAgainstTideUsed = true
          const effectivePreview = {
            ...preview,
            hit: attackHit,
            roll: bardicInspirationRoll == null && !cuttingWords
              ? preview.roll
              : {
                  ...preview.roll,
                  modifier: preview.roll.modifier + (bardicInspirationRoll ?? 0) - (cuttingWords?.roll ?? 0),
                  total: attackTotal,
                },
          }
          previews.push(effectivePreview)
          const damageRolls: number[][] = []
          for (const component of attackEntry.attack.damage) {
            damageRolls.push(attackHit
              ? await rollDiceBoxValues(
                  component.count * (preview.critical ? 2 : 1),
                  component.sides,
                  `${wildShapeAttack.monster.name}·${attackEntry.name}伤害`,
                  wildShapeAttack.targetToken.label,
                )
              : [])
          }
          const rawDamageTotal = damageRolls.reduce((sum, rolls, componentIndex) =>
            sum + Math.max(0, rolls.reduce((subtotal, value) => subtotal + value, 0) +
              (attackEntry.attack.damage[componentIndex]?.bonus ?? 0)), 0)
          const cuttingWordsDamageCandidate = attackHit && rawDamageTotal > 0 && !cuttingWords
            ? findDnd5eCuttingWordsCandidate(
                authorityMap,
                wildShapeAttack.state,
                wildShapeAttack.actorToken,
                wildShapeAttack.targetToken,
                new Set([
                  ...protectionReactionTokenIds,
                  ...cuttingWordsReactionTokenIds,
                  ...(shieldSpellReaction ? [wildShapeAttack.targetToken.id] : []),
                ]),
              )
            : undefined
          const cuttingWordsDamage = cuttingWordsDamageCandidate
            ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
                attackerName: wildShapeAttack.actorToken.label,
                targetName: wildShapeAttack.targetToken.label,
                attackName: attackEntry.name,
                total: rawDamageTotal,
                phase: 'damage',
              })
            : undefined
          if (cuttingWordsDamage && cuttingWordsDamageCandidate) {
            cuttingWordsReactionTokenIds.add(cuttingWordsDamageCandidate.token.id)
          }
          actionRolls.push({
            d20,
            d20Second,
            blessRoll,
            baneRoll,
            bardicInspirationRoll,
            cuttingWords,
            cuttingWordsDamage,
            protectionReactionActorId: useProtection ? protectionCandidate?.token.id : undefined,
            shieldSpellReaction,
            tranquilitySave: tranquility.roll,
            damageRolls,
            standAgainstTide,
          })
        }
        const initialResolved = resolvePreparedDnd5eMonsterAttack({ prepared: wildShapeAttack, rolls: actionRolls })
        if (!initialResolved.result.ok) {
          acknowledgePlayerAction(action, 'rejected', initialResolved.result.reason)
          completePlayerActionRequest(action)
          return
        }
        const resolved = await settleDnd5eConcentrationChecks({
          result: initialResolved.result,
          map: wildShapeAttack.map,
          characters: wildShapeAttack.characters,
          characterIdByCombatantId: wildShapeAttack.characterIdByCombatantId,
          rollD20: rollDiceBoxD20,
          rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
          rollDice: rollDiceBoxValues,
          requestHellishRebuke: requestSharedHellishRebukeChoice,
          requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
          requestBardicInspiration: requestDnd5eBardicInspirationRoll,
          requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
        })
        applyDnd5eCombatApplication(resolved.application)
        await resolveDnd5eBerserkerRetaliations(resolved.result, authorityMap.id)
        await resolveDnd5eHunterGiantKiller(resolved.result, authorityMap.id)
        for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
          event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
        ))) {
          updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
        }
        for (const protectorTokenId of protectionReactionTokenIds) {
          updateDnd5eTurnEconomy(
            protectorTokenId,
            (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
          )
        }
        for (const bardTokenId of cuttingWordsReactionTokenIds) {
          updateDnd5eTurnEconomy(
            bardTokenId,
            (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
          )
        }
        if (shieldSpellUsed) {
          updateDnd5eTurnEconomy(
            wildShapeAttack.targetToken.id,
            (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
          )
        }
        updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eTurnResource(economy, 'action').economy,
          liveRound,
        )
        const attackEvents = resolved.result.events.filter((event) => event.type === 'attack-resolved')
        const tranquilityPrevented = resolved.result.events.filter((event) => event.type === 'hostile-targeting-prevented').length
        const totalDamage = resolved.result.events
          .filter((event) => event.type === 'damage-applied')
          .reduce((total, event) => total + event.amount, 0)
        const summary = attackEvents.map((event, index) => {
          const damageReduction = actionRolls[index]?.cuttingWordsDamage?.roll
          return `${wildShapeAttack.attacks[index]?.name ?? '攻击'} ${event.total} vs AC ${event.armorClass}（${event.hit ? '命中' : '未命中'}）${damageReduction ? `，扰乱之语令伤害骰 -${damageReduction}` : ''}`
        }).join('；') || '没有攻击通过宁静心境'
        pushHeadlessCombatLog(
          `${wildShapeAttack.actorToken.label}以${wildShapeAttack.monster.name}形态使用${wildShapeAttack.action.name}攻击${wildShapeAttack.targetToken.label}：${summary}${tranquilityPrevented > 0 ? `；宁静心境阻止 ${tranquilityPrevented} 次攻击` : ''}；共造成 ${totalDamage} 点伤害。`,
          totalDamage > 0 ? 'damage' : 'attack',
          resolved.result.events,
          [`荒野变形：${wildShapeAttack.monster.name}｜动作 ${wildShapeAttack.action.name}`],
        )
        const lastIndex = Math.max(0, wildShapeAttack.attacks.length - 1)
        const lastAttack = wildShapeAttack.attacks[lastIndex]
        const lastRoll = actionRolls[lastIndex]
        const lastPreview = previews[lastIndex]
        if (lastAttack && lastRoll && lastPreview) {
          const values = lastRoll.damageRolls.flat()
          const bonus = lastPreview.hit
            ? lastAttack.attack.damage.reduce((total, component) => total + component.bonus, 0)
            : 0
          const display: DiceRoll = {
            values,
            sides: lastAttack.attack.damage[0]?.sides ?? 20,
            bonus,
            total: values.reduce((total, value) => total + value, 0) + bonus,
            label: `${wildShapeAttack.monster.name}·${wildShapeAttack.action.name}（SRD 5.1）`,
            targetName: wildShapeAttack.targetToken.label,
            d20Roll: {
              value: lastPreview.roll.d20,
              modifier: lastAttack.attack.toHit,
              ac: wildShapeAttack.targetArmorClass,
              hit: lastPreview.hit,
            },
          }
          setRoll(display)
          publishSharedDiceRoll(display)
        }
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted')
        return
      }
      const attacksUsed = Math.max(dnd5eAttackUsageRef.current.get(usageKey) ?? 0, turnEconomy.attacksUsed ?? 0)
      let prepared = prepareDnd5eEquipmentAttack({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        attacksUsed,
        attackActionsAvailable: turnEconomy.action.max,
        turnEconomy,
        turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      if (action.sourceMode === 'player') {
        const dmCoverOverride = await requestDmWeaponCoverOverride(prepared.prepared)
        if (dmCoverOverride !== 'auto') {
          prepared = prepareDnd5eEquipmentAttack({
            action,
            dmCoverOverride,
            map: authorityMap,
            characters: useCharacterStore.getState().characters,
            initiativeOrder: initiativeOrderRef.current,
            attacksUsed,
            attackActionsAvailable: turnEconomy.action.max,
            turnEconomy,
            turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
          })
          if (!prepared.ok) {
            acknowledgePlayerAction(action, 'rejected', prepared.reason)
            completePlayerActionRequest(action)
            return
          }
        }
      }
      const attack = prepared.prepared
      if (attack.cover.blocksLineOfEffect) {
        acknowledgePlayerAction(action, 'rejected', 'target-behind-total-cover')
        completePlayerActionRequest(action)
        return
      }
      const actorCombatant = attack.state.combatants[attack.actorToken.id]
      if (!actorCombatant) {
        acknowledgePlayerAction(action, 'rejected', 'combatant-missing')
        completePlayerActionRequest(action)
        return
      }
      const tranquility = await rollDnd5eTranquilityWard({
        ward: attack.tranquilityWard,
        attacker: actorCombatant,
        attackerCharacter: attack.actor,
        attackerName: attack.actor.name,
        savingThrowRerollAvailable: !attack.stunningStrike ||
          (actorCombatant.classResources['dnd5e-ki']?.current ?? 0) > 1,
      })
      const protectionCandidate = tranquility.passed
        ? findDnd5eProtectionCandidate(authorityMap, attack.actorToken, attack.targetToken)
        : undefined
      const useProtection = !!(protectionCandidate && await requestSharedProtectionChoice(protectionCandidate.character, {
        attackerName: attack.actorToken.label,
        targetName: attack.targetToken.label,
        attackName: attack.profile.weaponName,
      }))
      const attackMode = dnd5eAttackModeWithProtection(attack.attackMode, useProtection)
      let d20 = tranquility.passed ? await rollDiceBoxD20(`${attack.profile.weaponName} 命中检定`, attack.targetToken.label) : 1
      let d20Second = tranquility.passed && attackMode !== 'normal'
        ? await rollDiceBoxD20(`${attack.profile.weaponName} 命中检定（${attackMode === 'advantage' ? '优势' : '劣势'}）`, attack.targetToken.label)
        : undefined
      let attackTransaction: CombatTransaction | undefined
      let resourceSpentActor: Character | undefined
      if (tranquility.passed) {
        attackTransaction = appendRollLedgerEntry(createCombatTransaction({
          id: action.id,
          mapId: authorityMap.id,
          combatId: action.combatId,
          actorId: attack.actor.id,
          actionId: action.id,
          actionKind: 'weapon-attack',
          now: runtimeNow(),
        }), {
          id: `${action.id}:attack-roll`,
          kind: 'attack',
          label: `${attack.profile.weaponName} 命中检定`,
          dice: { sides: 20, values: d20Second == null ? [d20] : [d20, d20Second] },
          modifier: attack.profile.attackModifier,
          visibility: 'public',
          sourceId: attack.actor.id,
          targetId: attack.targetToken.id,
          createdAt: runtimeNow(),
        })
        const rerollCandidates = dnd5eAttackRollRerollCandidates(attack.actor, attack.profile.weaponId)
        if (rerollCandidates.length > 0) {
          const dice = d20Second == null ? [d20] : [d20, d20Second]
          const options = [
            { id: 'keep', label: '保留当前结果', description: `当前攻击骰：${dice.join('、')}` },
            ...rerollCandidates.flatMap((candidate) => dice.map((value, dieIndex) => ({
              id: `reroll:${candidate.instanceId}:${dieIndex}`,
              label: `用${candidate.itemName}重掷${dice.length > 1 ? `第 ${dieIndex + 1} 枚` : ''} d20`,
              description: `当前为 ${value}；消耗 1 点${candidate.resource.label}（${candidate.resource.current}/${candidate.resource.maximum}），必须采用新结果。`,
            }))),
          ]
          const windowId = `${action.id}:equipment-reroll`
          attackTransaction = openInterruptWindow(attackTransaction, {
            id: windowId,
            phase: 'before-hit',
            audience: 'actor',
            title: '装备：重掷攻击骰',
            description: '攻击骰已经掷出。你可以消耗装备资源重掷其中一枚 d20。',
            options,
            defaultOptionId: 'keep',
            timeoutPolicy: 'rollback',
            expiresAt: runtimeNow() + 30_000,
            openedAt: runtimeNow(),
          })
          const choice = await requestSharedChoiceWindow({
            id: `plugin-choice:${windowId}`,
            transactionId: action.id,
            actor: attack.actor,
            targetCharId: attack.targetToken.characterId,
            pluginId: 'dndstars.host.inventory',
            featureId: 'equipment-attack-roll-reroll',
            featureName: '装备重掷攻击骰',
            prompt: '是否消耗 1 点装备充能，重掷一枚攻击 d20？新结果必须采用。',
            audience: 'actor',
            options,
            defaultOptionId: 'keep',
            phase: 'before-hit',
            context: { contextKind: 'equipment-effect', rollLedgerEntryId: `${action.id}:attack-roll` },
          }) ?? 'keep'
          attackTransaction = closeInterruptWindow(
            answerInterruptWindow(attackTransaction, windowId, choice, runtimeNow()),
            windowId,
            runtimeNow(),
          )
          if (choice.startsWith('reroll:')) {
            const match = rerollCandidates
              .flatMap((candidate) => dice.map((_, dieIndex) => ({ candidate, dieIndex, id: `reroll:${candidate.instanceId}:${dieIndex}` })))
              .find((entry) => entry.id === choice)
            if (match) {
              const replacement = await rollDiceBoxD20(`${match.candidate.itemName}·重掷攻击骰`, attack.targetToken.label)
              const spent = spendDnd5eInventoryResource(attack.actor, match.candidate.instanceId, match.candidate.effect.resourceId, 1)
              if (spent.ok) {
                attackTransaction = rerollLedgerDie(attackTransaction, {
                  entryId: `${action.id}:attack-roll`,
                  dieIndex: match.dieIndex,
                  replacementValue: replacement,
                  sourceId: match.candidate.instanceId,
                  sourceLabel: match.candidate.itemName,
                  spentResource: {
                    characterId: attack.actor.id,
                    instanceId: match.candidate.instanceId,
                    resourceId: match.candidate.effect.resourceId,
                    amount: 1,
                  },
                  now: runtimeNow(),
                })
                if (match.dieIndex === 0) d20 = replacement
                else d20Second = replacement
                resourceSpentActor = spent.character
              }
            }
          }
        }
      }
      const blessRoll = tranquility.passed && attack.blessed
        ? (await rollDiceBoxValues(1, 4, '祝福术·攻击加值', attack.actorToken.label))[0]
        : undefined
      const baneRoll = tranquility.passed && attack.baned
        ? (await rollDiceBoxValues(1, 4, '灾祸术·攻击减值', attack.actorToken.label))[0]
        : undefined
      const preview = previewDnd5eEquipmentAttack(attack, d20, d20Second, useProtection, blessRoll, baneRoll)
      const inspirationDie = tranquility.roll?.bardicInspirationRoll == null
        ? dnd5eHeldBardicInspirationDie(actorCombatant)
        : undefined
      const bardicInspirationRoll = tranquility.passed && !preview.hit && !preview.roll.naturalOne && inspirationDie &&
        preview.roll.total + inspirationDie >= attack.targetArmorClass
        ? await requestDnd5eBardicInspirationRoll({
            target: attack.actor,
            targetName: attack.actor.name,
            dieSides: inspirationDie,
            rollType: '攻击检定',
            total: preview.roll.total,
            targetNumber: attack.targetArmorClass,
          })
        : undefined
      const attackTotalBeforeCuttingWords = preview.roll.total + (bardicInspirationRoll ?? 0)
      const attackHitBeforeCuttingWords = preview.critical || (!preview.roll.naturalOne &&
        attackTotalBeforeCuttingWords >= attack.targetArmorClass)
      const cuttingWordsCandidate = tranquility.passed && attackHitBeforeCuttingWords && !preview.critical
        ? findDnd5eCuttingWordsCandidate(
            authorityMap,
            attack.state,
            attack.actorToken,
            attack.targetToken,
            useProtection && protectionCandidate ? new Set([protectionCandidate.token.id]) : new Set(),
          )
        : undefined
      const cuttingWords = cuttingWordsCandidate &&
        attackTotalBeforeCuttingWords - cuttingWordsCandidate.dieSides < attack.targetArmorClass
        ? await requestDnd5eCuttingWordsRoll(cuttingWordsCandidate, {
            attackerName: attack.actor.name,
            targetName: attack.targetToken.label,
            attackName: attack.profile.weaponName,
            total: attackTotalBeforeCuttingWords,
            targetNumber: attack.targetArmorClass,
          })
        : undefined
      const effectiveAttackTotal = attackTotalBeforeCuttingWords - (cuttingWords?.roll ?? 0)
      const attackHitAfterCuttingWords = preview.critical || (!preview.roll.naturalOne &&
        effectiveAttackTotal >= attack.targetArmorClass)
      const strokeOfLuck = !!(
        tranquility.passed && !attackHitAfterCuttingWords && dnd5eCombatantClassLevel(actorCombatant, 'rogue') >= 20 &&
        (actorCombatant.classResources['dnd5e-stroke-of-luck']?.current ?? 0) > 0 &&
        await requestSharedStrokeOfLuckChoice(attack.actor, {
          targetName: attack.targetToken.label,
          attackName: attack.profile.weaponName,
          total: effectiveAttackTotal,
          armorClass: attack.targetArmorClass,
        })
      )
      let attackHit = attackHitAfterCuttingWords || strokeOfLuck
      const shieldTargetCombatant = attack.state.combatants[attack.targetToken.id]
      const shieldTargetCharacter = attack.targetToken.characterId
        ? attack.characters.find((character) => character.id === attack.targetToken.characterId)
        : undefined
      const shieldSpellReaction = !!(
        attackHit && cuttingWords?.bardId !== attack.targetToken.id && shieldTargetCombatant && shieldTargetCharacter &&
        dnd5eCanCastShieldSpell(shieldTargetCombatant) &&
        await requestSharedShieldSpellChoice(shieldTargetCharacter, {
          attackerName: attack.actor.name,
          attackName: attack.profile.weaponName,
          attackTotal: effectiveAttackTotal,
          armorClass: attack.targetArmorClass,
        })
      )
      if (shieldSpellReaction && !preview.critical && !strokeOfLuck) {
        attackHit = effectiveAttackTotal >= attack.targetArmorClass + 5
      }
      const standAgainstTide = !attackHit && !shieldSpellReaction && tranquility.passed && attack.profile.mode === 'melee'
        ? await buildDnd5eStandAgainstTideUse({
            map: authorityMap,
            state: attack.state,
            attackerToken: attack.actorToken,
            hunterToken: attack.targetToken,
            attackerName: attack.actor.name,
            attackName: attack.profile.weaponName,
            attackModifier: attack.profile.attackModifier,
            criticalThreshold: attack.profile.criticalThreshold,
            reachFeet: attack.profile.reachFeet ?? 5,
            damage: [attack.profile.damage],
            classDamageContext: attack.classDamageContext,
            greatWeaponFighting: attack.profile.greatWeaponFighting,
            bardicInspirationAlreadyUsed: bardicInspirationRoll != null || tranquility.roll?.bardicInspirationRoll != null,
            excludedReactionTokenIds: new Set([
              ...(useProtection && protectionCandidate ? [protectionCandidate.token.id] : []),
              ...(cuttingWords ? [cuttingWords.bardId] : []),
            ]),
          })
        : undefined
      const useDeflectMissiles = !!(
        attackHit && attack.profile.mode === 'ranged' && !shieldSpellReaction && shieldTargetCombatant &&
        shieldTargetCharacter && dnd5eCanUseDeflectMissiles(shieldTargetCombatant) &&
        await requestSharedDeflectMissilesChoice(shieldTargetCharacter, {
          phase: 'reduce',
          attackerName: attack.actor.name,
          attackName: attack.profile.weaponName,
        })
      )
      const deflectMissilesD10 = useDeflectMissiles
        ? (await rollDiceBoxValues(1, 10, '拨挡飞弹·减伤', attack.targetToken.label))[0]
        : undefined
      const stunningStrikeSaveD20 = attackHit && attack.stunningStrike
        ? await rollDiceBoxD20('震慑拳·体质豁免', attack.targetToken.label)
        : undefined
      const stunningStrikeSaveD20Second = attackHit && attack.stunningStrike?.saveMode === 'disadvantage'
        ? await rollDiceBoxD20('震慑拳·体质豁免（劣势）', attack.targetToken.label)
        : undefined
      const stunningStrikeSaveBlessRoll = stunningStrikeSaveD20 != null && attack.stunningStrike?.blessed
        ? (await rollDiceBoxValues(1, 4, '祝福术·震慑拳豁免加值', attack.targetToken.label))[0]
        : undefined
      const stunningStrikeSaveBaneRoll = stunningStrikeSaveD20 != null && attack.stunningStrike?.baned
        ? (await rollDiceBoxValues(1, 4, '灾祸术·震慑拳豁免减值', attack.targetToken.label))[0]
        : undefined
      let stunningStrikeSaveRerollD20: number | undefined
      let stunningStrikeSaveRerollD20Second: number | undefined
      let stunningStrikeBardicInspirationRoll: number | undefined
      let stunningStrikeDarkOnesOwnLuckRoll: number | undefined
      if (stunningStrikeSaveD20 != null && attack.stunningStrike) {
        const initialSave = previewDnd5eSavingThrowRoll({
          rolls: attack.stunningStrike.saveMode === 'normal'
            ? [stunningStrikeSaveD20]
            : [stunningStrikeSaveD20, stunningStrikeSaveD20Second ?? 0],
          mode: attack.stunningStrike.saveMode,
          modifier: attack.stunningStrike.saveModifier + (stunningStrikeSaveBlessRoll ?? 0) -
            (stunningStrikeSaveBaneRoll ?? 0),
          dc: attack.stunningStrike.saveDc,
        })
        const targetCombatant = attack.state.combatants[attack.targetToken.id]
        const targetCharacter = attack.targetToken.characterId
          ? attack.characters.find((character) => character.id === attack.targetToken.characterId)
          : undefined
        const targetInspirationDie = targetCombatant ? dnd5eHeldBardicInspirationDie(targetCombatant) : undefined
        stunningStrikeBardicInspirationRoll = !initialSave.success && targetInspirationDie &&
          initialSave.roll.total + targetInspirationDie >= attack.stunningStrike.saveDc
          ? await requestDnd5eBardicInspirationRoll({
              target: targetCharacter,
              targetName: attack.targetToken.label,
              dieSides: targetInspirationDie,
              rollType: '豁免',
              total: initialSave.roll.total,
              targetNumber: attack.stunningStrike.saveDc,
            })
          : undefined
        const saveSucceededWithInspiration = initialSave.success ||
          initialSave.roll.total + (stunningStrikeBardicInspirationRoll ?? 0) >= attack.stunningStrike.saveDc
        stunningStrikeDarkOnesOwnLuckRoll = !saveSucceededWithInspiration && targetCombatant &&
          dnd5eDarkOnesOwnLuckAvailable(targetCombatant)
          ? await requestDnd5eDarkOnesOwnLuckRoll({
              target: targetCharacter,
              targetName: attack.targetToken.label,
              rollType: '豁免',
              total: initialSave.roll.total + (stunningStrikeBardicInspirationRoll ?? 0),
              targetNumber: attack.stunningStrike.saveDc,
            })
          : undefined
        const saveSucceededWithLuck = saveSucceededWithInspiration ||
          initialSave.roll.total + (stunningStrikeBardicInspirationRoll ?? 0) +
            (stunningStrikeDarkOnesOwnLuckRoll ?? 0) >= attack.stunningStrike.saveDc
        const rerollFeature = targetCombatant ? dnd5eSavingThrowRerollFeature(targetCombatant) : undefined
        if (!saveSucceededWithLuck && targetCharacter && rerollFeature) {
          const reroll = await requestDnd5eSavingThrowRerollDice({
            target: targetCharacter,
            targetName: attack.targetToken.label,
            featureName: rerollFeature.name,
            total: initialSave.roll.total,
            dc: attack.stunningStrike.saveDc,
            mode: attack.stunningStrike.saveMode,
          })
          stunningStrikeSaveRerollD20 = reroll?.d20
          stunningStrikeSaveRerollD20Second = reroll?.d20Second
        }
      }
      let damageRolls = attackHit
        ? await rollDiceBoxValues(
            attack.profile.damage.count * (preview.critical ? 2 : 1),
            attack.profile.damage.sides,
            `${attack.profile.weaponName} 伤害`,
            attack.targetToken.label,
          )
        : []
      const hurlThroughHellDamageRolls = attackHit && actorCombatant.classState.hurlThroughHellReady
        ? await rollDiceBoxValues(10, 10, '坠入地狱·返回伤害', attack.targetToken.label)
        : undefined
      if (attack.profile.greatWeaponFighting && damageRolls.some((value) => value <= 2)) {
        const rerolled: number[] = []
        for (const value of damageRolls) {
          rerolled.push(value <= 2
            ? (await rollDiceBoxValues(1, attack.profile.damage.sides, '巨武器战斗重掷', attack.targetToken.label))[0]
            : value)
        }
        damageRolls = rerolled
      }
      const classDamageDefinitions = attackHit
        ? dnd5eEquipmentClassDamageDefinitions(attack, preview.critical, useProtection)
        : []
      const classDamageRolls: Dnd5eClassDamageRolls[] = []
      const classDamageLabels = {
        'sneak-attack': '偷袭',
        'colossus-slayer': '巨像杀手',
        'brutal-critical': '凶蛮重击',
        'improved-divine-smite': '精通至圣斩',
        'divine-smite': '至圣斩',
        'hunters-mark': '猎人印记',
        'divine-strike': '神圣打击',
        'lifedrinker': '饮命者',
        'foe-slayer': '屠灭众敌',
      } as const
      for (const definition of classDamageDefinitions) {
        const count = definition.count * (preview.critical && definition.doubleOnCritical ? 2 : 1)
        classDamageRolls.push({
          source: definition.source,
          rolls: count > 0
            ? await rollDiceBoxValues(count, definition.sides, classDamageLabels[definition.source], attack.targetToken.label)
            : [],
        })
      }
      const rawDamageTotal = attackHit
        ? Math.max(0, damageRolls.reduce((total, value) => total + value, 0) + attack.profile.damage.bonus) +
          classDamageDefinitions.reduce((total, definition) => {
            const rolls = classDamageRolls.find((entry) => entry.source === definition.source)?.rolls ?? []
            return total + Math.max(0, rolls.reduce((sum, value) => sum + value, 0) + (definition.bonus ?? 0))
          }, 0)
        : 0
      const damageReactionExclusions = new Set<string>([
        ...(useProtection && protectionCandidate ? [protectionCandidate.token.id] : []),
        ...(cuttingWords ? [cuttingWords.bardId] : []),
        ...(shieldSpellReaction || useDeflectMissiles ? [attack.targetToken.id] : []),
      ])
      const cuttingWordsDamageCandidate = attackHit && rawDamageTotal > 0 && !cuttingWords
        ? findDnd5eCuttingWordsCandidate(
            authorityMap,
            attack.state,
            attack.actorToken,
            attack.targetToken,
            damageReactionExclusions,
          )
        : undefined
      const cuttingWordsDamage = cuttingWordsDamageCandidate
        ? await requestDnd5eCuttingWordsRoll(cuttingWordsDamageCandidate, {
            attackerName: attack.actor.name,
            targetName: attack.targetToken.label,
            attackName: attack.profile.weaponName,
            total: rawDamageTotal,
            phase: 'damage',
          })
        : undefined
      const initialResolved = resolvePreparedDnd5eEquipmentAttack({
        prepared: attack,
        d20,
        d20Second,
        blessRoll,
        baneRoll,
        bardicInspirationRoll,
        strokeOfLuck,
        cuttingWords,
        cuttingWordsDamage,
        protectionReactionActorId: useProtection ? protectionCandidate?.token.id : undefined,
        shieldSpellReaction,
        deflectMissilesD10,
        tranquilitySave: tranquility.roll,
        stunningStrikeSaveD20,
        stunningStrikeSaveD20Second,
        stunningStrikeSaveBlessRoll,
        stunningStrikeSaveBaneRoll,
        stunningStrikeSaveRerollD20,
        stunningStrikeSaveRerollD20Second,
        stunningStrikeBardicInspirationRoll,
        stunningStrikeDarkOnesOwnLuckRoll,
        hurlThroughHellDamageRolls,
        standAgainstTide,
        damageRolls,
        classDamageRolls,
        transaction: attackTransaction,
      })
      if (!initialResolved.result.ok) {
        const rollbackReason = initialResolved.result.transaction?.rollbackReason ?? initialResolved.result.reason
        acknowledgePlayerAction(action, 'rejected', rollbackReason)
        completePlayerActionRequest(action)
        return
      }
      const resolved = await settleDnd5eConcentrationChecks({
        result: initialResolved.result,
        map: attack.map,
        characters: attack.characters,
      characterIdByCombatantId: attack.characterIdByCombatantId,
        rollD20: rollDiceBoxD20,
        rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
        rollDice: rollDiceBoxValues,
        requestHellishRebuke: requestSharedHellishRebukeChoice,
        requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
      requestBardicInspiration: requestDnd5eBardicInspirationRoll,
      requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
      })
      const changedCharacterIds = new Set(resolved.application.changedCharacterIds)
      if (resourceSpentActor) changedCharacterIds.add(resourceSpentActor.id)
      applyDnd5eCombatApplication({
        ...resolved.application,
        changedCharacterIds: [...changedCharacterIds],
        characters: resolved.application.characters.map((character) =>
          resourceSpentActor?.id === character.id
            ? { ...character, dnd5eInventory: resourceSpentActor.dnd5eInventory }
            : character,
        ),
      })
      await resolveDnd5eBerserkerRetaliations(resolved.result, authorityMap.id)
      await resolveDnd5eHunterGiantKiller(resolved.result, authorityMap.id)
      for (const tokenId of new Set(resolved.result.events.flatMap((event) =>
        event.type === 'turn-resource-spent' && event.resource === 'reaction' ? [event.actorId] : [],
      ))) {
        updateDnd5eTurnEconomy(tokenId, (economy) => spendDnd5eTurnResource(economy, 'reaction').economy)
      }
      if (useProtection && protectionCandidate) {
        updateDnd5eTurnEconomy(
          protectionCandidate.token.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      if (cuttingWords && cuttingWordsCandidate) {
        updateDnd5eTurnEconomy(
          cuttingWordsCandidate.token.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      if (cuttingWordsDamage && cuttingWordsDamageCandidate) {
        updateDnd5eTurnEconomy(
          cuttingWordsDamageCandidate.token.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      if (shieldSpellReaction) {
        updateDnd5eTurnEconomy(
          attack.targetToken.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      if (useDeflectMissiles) {
        updateDnd5eTurnEconomy(
          attack.targetToken.id,
          (economy) => spendDnd5eTurnResource(economy, 'reaction').economy,
        )
      }
      const deflectEvent = resolved.result.events.find((event) =>
        event.type === 'damage-reduced' && event.source === 'deflect-missiles' && event.targetId === attack.targetToken.id,
      )
      if (deflectEvent?.type === 'damage-reduced' && deflectEvent.caught && shieldTargetCharacter) {
        const monkCombatant = resolved.result.state.combatants[attack.targetToken.id]
        const kiCurrent = monkCombatant?.classResources['dnd5e-ki']?.current ?? 0
        const canReturn = kiCurrent > 0 && attack.distanceFeet <= 60
        const returnAccepted = canReturn && await requestSharedDeflectMissilesChoice(shieldTargetCharacter, {
          phase: 'return',
          attackerName: attack.actor.name,
          attackName: attack.profile.weaponName,
          kiCurrent,
        })
        const returnD20 = returnAccepted
          ? await rollDiceBoxD20('拨挡飞弹·掷回命中', attack.actorToken.label)
          : 1
        const returnD20Second = returnAccepted && attack.distanceFeet > 20
          ? await rollDiceBoxD20('拨挡飞弹·掷回命中（远距劣势）', attack.actorToken.label)
          : undefined
        const returnNatural = returnD20Second == null ? returnD20 : Math.min(returnD20, returnD20Second)
        const returnDamageRolls = returnAccepted
          ? await rollDiceBoxValues(
              returnNatural === 20 ? 2 : 1,
              dnd5eMonkMartialArtsDie(shieldTargetCharacter.level),
              '拨挡飞弹·掷回伤害',
              attack.actorToken.label,
            )
          : []
        const returned = resolveDnd5eHeadlessAction(resolved.result.state, {
          type: 'monk-deflect-missiles-return',
          actorId: attack.targetToken.id,
          targetId: attack.actorToken.id,
          distanceFeet: attack.distanceFeet,
          decline: !returnAccepted,
          d20: returnD20,
          d20Second: returnD20Second,
          damageRolls: returnDamageRolls,
        })
        if (returned.ok) {
          const returnedSettled = await settleDnd5eConcentrationChecks({
            result: returned,
            map: resolved.application.map,
            characters: resolved.application.characters,
            characterIdByCombatantId: attack.characterIdByCombatantId,
            rollD20: rollDiceBoxD20,
            rollD4: async (label, targetName) => (await rollDiceBoxValues(1, 4, label, targetName))[0],
            rollDice: rollDiceBoxValues,
            requestHellishRebuke: requestSharedHellishRebukeChoice,
            requestSavingThrowReroll: requestDnd5eSavingThrowRerollDice,
            requestBardicInspiration: requestDnd5eBardicInspirationRoll,
            requestDarkOnesOwnLuck: requestDnd5eDarkOnesOwnLuckRoll,
          })
          applyDnd5eCombatApplication(returnedSettled.application)
          if (returnAccepted) {
            const returnAttack = returnedSettled.result.events.find((event) => event.type === 'attack-resolved')
            const returnDamage = returnedSettled.result.events.find((event) => event.type === 'damage-applied')
            pushCombatLog(
              returnAttack?.type === 'attack-resolved' && returnAttack.hit
                ? `${shieldTargetCharacter.name} 消耗 1 点气掷回飞弹并命中 ${attack.actor.name}，造成 ${returnDamage?.type === 'damage-applied' ? returnDamage.amount : 0} 点伤害。`
                : `${shieldTargetCharacter.name} 消耗 1 点气掷回飞弹，但未命中 ${attack.actor.name}。`,
              returnDamage?.type === 'damage-applied' && returnDamage.amount > 0 ? 'damage' : 'attack',
            )
          }
        }
      }
      if (attack.countsTowardAttackAction) dnd5eAttackUsageRef.current.set(usageKey, attack.attackNumber)
      updateDnd5eTurnEconomy(
        action.actorTokenId,
        (economy) => ({
          ...(attack.spendsAction
            ? spendDnd5eTurnResource(economy, 'action').economy
            : attack.spendsBonusAction
              ? spendDnd5eTurnResource(economy, 'bonusAction').economy
              : economy),
          attacksUsed: attack.countsTowardAttackAction ? attack.attackNumber : economy.attacksUsed,
        }),
        liveRound,
      )
      const damage = resolved.result.events.find((event) => event.type === 'damage-applied')
      const classDamageText = resolved.result.events
        .filter((event) => event.type === 'class-damage-applied')
        .map((event) => `${classDamageLabels[event.source]} ${event.amount}`)
        .join('，')
      const stunningSave = resolved.result.events.find((event) => event.type === 'saving-throw-resolved' && event.ability === 'con')
      const foeSlayerAttackText = attack.foeSlayerAttackBonus > 0
        ? `+${attack.foeSlayerAttackBonus}（屠灭众敌）`
        : ''
      const cuttingWordsText = cuttingWords ? `-${cuttingWords.roll}（尖刻言辞）` : ''
      const cuttingWordsDamageText = cuttingWordsDamage ? `；尖刻言辞令伤害骰 -${cuttingWordsDamage.roll}` : ''
      const stunningInspirationText = stunningSave?.type === 'saving-throw-resolved' && stunningStrikeBardicInspirationRoll &&
        stunningSave.total === stunningSave.d20 + stunningSave.modifier + stunningStrikeBardicInspirationRoll
        ? `+${stunningStrikeBardicInspirationRoll}（吟游激励）`
        : ''
      const stunningText = stunningSave?.type === 'saving-throw-resolved'
        ? `，震慑拳体质豁免 ${stunningSave.d20}${stunningSave.modifier >= 0 ? '+' : ''}${stunningSave.modifier}${stunningInspirationText}=${stunningSave.total} vs DC ${stunningSave.dc}，${stunningSave.success ? '成功' : resolved.result.events.some((event) => event.type === 'condition-applied' && event.condition === '震慑') ? '失败并陷入震慑' : '失败但免疫震慑'}`
        : ''
      const equipmentReroll = attackTransaction?.rollLedger.entries.flatMap((entry) => entry.rerolls)[0]
      const equipmentRerollText = equipmentReroll
        ? `；${equipmentReroll.sourceLabel}将攻击骰 ${equipmentReroll.previousValue} 重掷为 ${equipmentReroll.replacementValue}`
        : ''
      pushHeadlessCombatLog(
        !tranquility.passed
          ? `${attack.actor.name} 试图以${attack.profile.weaponName}攻击 ${attack.targetToken.label}，但未通过宁静心境的感知豁免，本次攻击落空`
          : attackHit
          ? `${attack.actor.name} 使用${attack.profile.weaponName}${attack.offHandAttack ? '进行副手附赠攻击并' : attack.spendsBonusAction ? '发动狂乱附赠攻击并' : attack.classDamageContext.hordeBreakerAttack ? '发动灭群者追加攻击并' : ''}命中 ${attack.targetToken.label}：${d20}${attack.profile.attackModifier >= 0 ? '+' : ''}${attack.profile.attackModifier}${foeSlayerAttackText}${bardicInspirationRoll ? `+${bardicInspirationRoll}（吟游激励）` : ''}${cuttingWordsText}=${effectiveAttackTotal}${strokeOfLuck ? '，幸运一击改为命中' : ''}，造成 ${damage?.type === 'damage-applied' ? damage.amount : 0} 点伤害${classDamageText ? `（${classDamageText}）` : ''}${cuttingWordsDamageText}${stunningText}${equipmentRerollText}${attack.countsTowardAttackAction ? `（第 ${attack.attackNumber}/${attack.attacksAllowed} 次攻击）` : ''}`
          : `${attack.actor.name} 使用${attack.profile.weaponName}攻击 ${attack.targetToken.label} 未命中：${d20}${attack.profile.attackModifier >= 0 ? '+' : ''}${attack.profile.attackModifier}${foeSlayerAttackText}${bardicInspirationRoll ? `+${bardicInspirationRoll}（吟游激励）` : ''}${cuttingWordsText}=${effectiveAttackTotal} vs AC ${attack.targetArmorClass}${equipmentRerollText}`,
        attackHit ? 'damage' : 'attack',
        resolved.result.events,
        [
          `武器：${attack.profile.weaponName}｜攻击加值 ${attack.profile.attackModifier >= 0 ? '+' : ''}${attack.profile.attackModifier}｜目标 AC ${attack.targetArmorClass}`,
          `掩护：${DND5E_COVER_LABELS[attack.cover.cover]}${attack.cover.overriddenByDm ? '｜DM 本次覆盖' : '｜自动判定'}`,
          attackHit
            ? `伤害骰：${damageRolls.join(' + ')}${attack.profile.damage.bonus === 0 ? '' : attack.profile.damage.bonus > 0 ? ` + ${attack.profile.damage.bonus}` : ` - ${Math.abs(attack.profile.damage.bonus)}`}`
            : '未命中，不掷伤害骰',
        ],
      )
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }

    if (authorityPlan.route === 'move-token' && action.type === 'move-token') {
      const turnEconomy = currentDnd5eTurnEconomy(action.actorTokenId, liveRound)
      const prepared = prepareDnd5ePlayerMove({
        action,
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const move = prepared.prepared
      const opportunityAttackers = findDnd5eOpportunityAttackersForMove({
        map: authorityMap,
        characters: useCharacterStore.getState().characters,
        movingToken: move.actorToken,
        to: move.to,
        path: move.path,
        turnEconomyByToken: dnd5eTurnEconomyByTokenRef.current,
        disengaged: disengagedCharIds.has(move.actor.id),
      })
      for (const attacker of opportunityAttackers) {
        const latestActor = useCharacterStore.getState().characters.find((character) => character.id === move.actor.id)
        if (!latestActor || latestActor.currentHp <= 0) break
        await resolveDnd5eOpportunityAttackForMove(attacker, move.actorToken)
      }
      const latestActor = useCharacterStore.getState().characters.find((character) => character.id === move.actor.id)
      if (!latestActor || latestActor.currentHp <= 0) {
        const spent = updateDnd5eTurnEconomy(
          action.actorTokenId,
          (economy) => spendDnd5eMovement(economy, move.movementCostFeet).economy,
          liveRound,
        )
        pushCombatLog(
          `${move.actor.name} 的移动被借机攻击打断；本回合剩余移动 ${spent.movement.current}/${spent.movement.max} 尺。`,
          'turn',
        )
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted', 'mover-defeated', { x: move.actorToken.x, y: move.actorToken.y })
        return
      }
      const latestMap = useMapStore.getState().maps.find((map) => map.id === authorityMap.id) ?? authorityMap
      const finalPrepared = prepareDnd5ePlayerMove({
        action,
        map: latestMap,
        characters: useCharacterStore.getState().characters,
        initiativeOrder: initiativeOrderRef.current,
        turnEconomy,
      })
      if (!finalPrepared.ok) {
        acknowledgePlayerAction(action, 'rejected', finalPrepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const fallingDamageRolls = finalPrepared.prepared.fallingDamageDice > 0
        ? await rollDiceBoxValues(finalPrepared.prepared.fallingDamageDice, 6, '坠落伤害', finalPrepared.prepared.actor.name)
        : undefined
      const resolved = resolvePreparedDnd5ePlayerMove({ prepared: finalPrepared.prepared, fallingDamageRolls })
      if (!resolved.result.ok || !resolved.application) {
        acknowledgePlayerAction(action, 'rejected', resolved.result.ok ? 'missing-application' : resolved.result.reason)
        completePlayerActionRequest(action)
        return
      }
      const finalMove = finalPrepared.prepared
      const hazards = await settleDnd5eItemAreasForMove({
        state: resolved.result.state,
        map: latestMap,
        characters: finalMove.characters,
        characterIdByCombatantId: finalMove.characterIdByCombatantId,
        token: finalMove.actorToken,
        to: finalMove.to,
        path: finalMove.path,
        carefulMovement: action.dnd5eCarefulMovement,
      })
      if (JSON.stringify(hazards.map.dnd5eItemAreas ?? []) !== JSON.stringify(latestMap.dnd5eItemAreas ?? [])) {
        applyAuthorityMapUpdate(latestMap.id, { dnd5eItemAreas: hazards.map.dnd5eItemAreas })
      }
      if (JSON.stringify(hazards.map.dnd5ePluginAreas ?? []) !== JSON.stringify(latestMap.dnd5ePluginAreas ?? [])) {
        applyAuthorityMapUpdate(latestMap.id, { dnd5ePluginAreas: hazards.map.dnd5ePluginAreas })
      }
      const traversedPath = truncateTokenMovementPath(finalMove.path, hazards.finalPosition)
      applyDnd5eCombatApplication({
        ...hazards.application,
        map: {
          ...hazards.application.map,
          tokens: hazards.application.map.tokens.map((token) => {
            if (token.id !== finalMove.actorToken.id || !hazards.application.changedTokenIds.includes(token.id)) {
              return token
            }
            return {
              ...token,
              movementAnimation: createTokenMovementAnimation({
                id: `player-move:${action.id}`,
                path: traversedPath,
                finalPosition: hazards.finalPosition,
                issuedAt: runtimeNow() + 100,
              }),
            }
          }),
        },
      })
      const explorationFog = useFogStore.getState().maps.find((fog) => fog.mapId === latestMap.id)
      const explorationGeometry = useMapGeometryStore.getState().maps.find((geometry) => geometry.mapId === latestMap.id) ??
        createEmptyMapGeometry(latestMap.id, 0)
      const forceExplorationVision = explorationFog?.filled === true
      if (explorationGeometry.vision.enabled || forceExplorationVision) {
        const polygons = mapExplorationPolygonsForTokenPath({
          map: latestMap,
          geometry: explorationGeometry,
          token: finalMove.actorToken,
          path: traversedPath,
          elevationsFeet: finalMove.pathElevationsFeet.slice(0, traversedPath.length),
          forceEnabled: forceExplorationVision,
        })
        const actorMemberId = finalMove.actor.roomMemberId
        if (actorMemberId && polygons.length > 0) {
          const memberIds = explorationGeometry.vision.sharePartyVision
            ? new Set([
                actorMemberId,
                ...finalMove.characters.flatMap((character) =>
                  character.roomMemberId && latestMap.tokens.some((token) =>
                    token.type === 'player' && token.characterId === character.id,
                  ) ? [character.roomMemberId] : [],
                ),
              ])
            : new Set([actorMemberId])
          for (const memberId of memberIds) recordMapExploration(latestMap.id, memberId, polygons)
        }
      }
      const fromAnchor = tokenAnchorCellFromPixel(
        finalMove.actorToken.x, finalMove.actorToken.y, finalMove.actorToken, latestMap,
      )
      const finalAnchor = tokenAnchorCellFromPixel(
        hazards.finalPosition.x, hazards.finalPosition.y, finalMove.actorToken, latestMap,
      )
      const reachedPlannedDestination = Math.hypot(
        hazards.finalPosition.x - finalMove.to.x,
        hazards.finalPosition.y - finalMove.to.y,
      ) < 1
      const actualDistanceFeet = reachedPlannedDestination
        ? finalMove.distanceFeet
        : cellDistance(fromAnchor, finalAnchor) * Math.max(1, latestMap.feetPerCell ?? 5)
      const actualMovementCostFeet = reachedPlannedDestination
        ? finalMove.movementCostFeet
        : actualDistanceFeet * (action.dnd5eCarefulMovement ? 2 : 1) +
          (finalMove.standFromProne ? Math.floor(finalMove.actor.speed / 2) : 0)
      const spent = updateDnd5eTurnEconomy(
        action.actorTokenId,
        (economy) => spendDnd5eMovement(economy, actualMovementCostFeet).economy,
        liveRound,
      )
      for (const log of hazards.logs) pushCombatLog(log, 'system')
      pushHeadlessCombatLog(
        `${move.actor.name}${move.standFromProne ? ` 花费 ${Math.floor(move.actor.speed / 2)} 尺移动起身并` : ' '}${action.dnd5eCarefulMovement ? '以半速谨慎' : ''}移动 ${actualDistanceFeet} 尺；本回合剩余移动 ${spent.movement.current}/${spent.movement.max} 尺。`,
        'turn',
        resolved.result.events,
        [
          `路径长度：${actualDistanceFeet} 尺｜移动消耗 ${actualMovementCostFeet} 尺`,
          `剩余移动力：${spent.movement.current}/${spent.movement.max} 尺`,
        ],
      )
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted', undefined, hazards.finalPosition)
      return
    }

    acknowledgePlayerAction(action, 'rejected', 'unsupported-action')
    completePlayerActionRequest(action)
  }

  const handlePlayerActionRequest = (action: SharedPlayerActionState): Promise<void> => {
    if (!usesAutomatedPlayerSettlement(settlementModeRef.current)) {
      acknowledgePlayerAction(action, 'rejected', 'manual-settlement')
      completePlayerActionRequest(action)
      return Promise.resolve()
    }
    return runMapsPlayerActionTransaction({
      coordinator: playerActionCoordinatorRef.current,
      action,
      run: () => processPlayerActionRequest(action),
      waitForAuthorityCommit: () => playerActionAuthorityCommitRef.current,
      readOutcome: (actionId) => playerActionTransactionOutcomeRef.current.get(actionId),
      clearOutcome: (actionId) => playerActionTransactionOutcomeRef.current.delete(actionId),
      setTransactionActive: (active, transactionId) => {
        applyingPlayerActionTransactionRef.current = active
        activeInterruptTransactionIdRef.current = transactionId
      },
      now: runtimeNow(),
      recover: async (error) => {
        console.error('[dm-authority] player action failed', error)
        await Promise.all([
          useMapStore.getState().loadShared(),
          useCharacterStore.getState().loadShared(),
        ])
      },
    })
  }

  const canSendPlayerCombatAction = () => {
    if (
      mode === 'player' &&
      !matchesDmAuthorityReady(dmAuthorityReady, {
        mapId: activeMap?.id,
        combatId: combatIdRef.current,
        combatActive,
      })
    ) {
      return false
    }
    return canSubmitPlayerCombatAction({
      activeMap,
      mode,
      playerCombatLocked,
      combatActive,
      combatActiveSnapshot: combatActiveRef.current,
      turnCharacter,
      currentInitiativeToken,
      pendingAction: pendingPlayerActionRef.current,
      playerCharacter: playerChar,
      characters: useCharacterStore.getState().characters,
    })
  }

  const submitPlayerActionRequest = (action: SharedPlayerActionState, label: string) => {
    void submitPlayerActionRequestWithLock({
      action,
      label,
      lockPendingAction: setPendingPlayerActionLocked,
      loadQueue: () => loadSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests'),
      saveQueue: (queue) => saveSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests', queue),
      publishAction: (eventAction) => publishSharedEvent<SharedPlayerActionState>('player-action-player-to-dm', eventAction),
    })
    return true
  }

  const createDmLocalPlayerAction = (
    patch: SharedPlayerActionPatch,
  ): SharedPlayerActionState | null => {
    return createDmLocalPlayerActionEnvelope({
      isDm: isDM,
      mapId: activeMap?.id,
      combatId,
      turnCharacter,
      currentInitiativeToken,
      round: roundRef.current,
      initiativeIndex: initiativeIndexRef.current,
      nextSeq: () => {
        playerActionSeqRef.current += 1
        return playerActionSeqRef.current
      },
      patch,
    })
  }

  const submitDmLocalPlayerAction = (action: SharedPlayerActionState | null) => {
    if (!action) return false
    void handlePlayerActionRequest(action)
    return true
  }

  const sendDmLocalDnd5eWeaponAttackRequest = (targetToken: Token, options?: Dnd5eWeaponAttackOptions) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-weapon-attack',
        targetTokenId: targetToken.id,
        dnd5eWeaponAttackOptions: options,
      }),
    )

  const sendDmLocalDnd5eFighterFeatureRequest = (feature: Dnd5eFighterFeatureId) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-fighter-feature',
        dnd5eFighterFeature: feature,
      }),
    )

  const sendDmLocalDnd5eClassFeatureRequest = (payload: Dnd5eClassFeaturePayload) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-class-feature',
        dnd5eClassFeature: payload,
      }),
    )

  const sendDmLocalDnd5ePluginActionRequest = (
    payload: Dnd5ePluginActionPayload,
    targetTokenId?: string,
    area?: { targetTokenIds: string[]; targetCell: GridCell; targetOrientation?: 0 | 1 | 2 | 3 },
  ) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-plugin-action',
        targetTokenId,
        targetTokenIds: area?.targetTokenIds,
        targetCell: area?.targetCell,
        targetOrientation: area?.targetOrientation,
        dnd5ePluginAction: payload,
      }),
    )

  const sendDmLocalDnd5eItemUseRequest = (payload: Dnd5eItemUsePayload) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-item-use',
        dnd5eItemUse: payload,
      }),
    )

  const sendDmLocalDnd5eAbilityCheckRequest = (payload: Dnd5eAbilityCheckPayload) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-ability-check',
        dnd5eAbilityCheck: payload,
      }),
    )

  const sendDmLocalDnd5eSpellCastRequest = (payload: Dnd5eSpellCastPayload) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-spell-cast',
        targetTokenId: payload.targetTokenId,
        targetTokenIds: payload.targetTokenIds,
        targetCell: payload.areaTargetCell,
        dnd5eSpellCast: payload,
      }),
    )

  const sendDmLocalDnd5ePersistentAreaMoveRequest = (payload: Dnd5ePersistentAreaMovePayload) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-persistent-area-move',
        targetCell: payload.targetCell,
        dnd5ePersistentAreaMove: payload,
      }),
    )

  const sendDmLocalDnd5eAdjudicatedSpellRequest = (payload: Dnd5eAdjudicatedSpellPayload) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'dnd5e-adjudicated-spell',
        dnd5eAdjudicatedSpell: payload,
      }),
    )

  const createPlayerActionRequest = (
    patch: SharedPlayerActionPatch,
    actorOverride?: { tokenId: string; characterId: string },
  ): SharedPlayerActionState | null => {
    return createPlayerActionEnvelope({
      mapId: activeMap?.id,
      combatId: combatIdRef.current,
      roomMemberId: roomSession?.memberId,
      turnCharacter,
      currentInitiativeToken,
      actorOverride,
      round,
      initiativeIndex,
      nextSeq: () => {
        playerActionSeqRef.current += 1
        return playerActionSeqRef.current
      },
      patch,
    })
  }

  const sendPlayerEndTurnRequest = () => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({ type: 'end-turn' })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 结束回合`)
  }

  const sendDnd5eDeathSaveRequest = () => {
    if (!canControlDeathSaveTurn || !turnCharacter || !activeMap || !currentInitiativeToken) return false
    const action = isDM
      ? createDmLocalPlayerAction({ type: 'dnd5e-death-save' })
      : createPlayerActionRequest({ type: 'dnd5e-death-save' })
    if (!action) return false
    return isDM
      ? submitDmLocalPlayerAction(action)
      : submitPlayerActionRequest(action, `${turnCharacter.name} 进行死亡豁免`)
  }

  const sendPlayerDnd5eWeaponAttackRequest = (targetToken: Token, options?: Dnd5eWeaponAttackOptions) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-weapon-attack',
      targetTokenId: targetToken.id,
      dnd5eWeaponAttackOptions: options,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 使用 5e 武器攻击`)
  }

  const sendPlayerDnd5eFighterFeatureRequest = (feature: Dnd5eFighterFeatureId) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-fighter-feature',
      dnd5eFighterFeature: feature,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 使用${feature === 'second-wind' ? '回气' : '动作如潮'}`)
  }

  const sendPlayerDnd5eClassFeatureRequest = (payload: Dnd5eClassFeaturePayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-class-feature',
      dnd5eClassFeature: payload,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 使用${dnd5eClassFeatureLabel(payload)}`)
  }

  const sendPlayerDnd5ePluginActionRequest = (
    payload: Dnd5ePluginActionPayload,
    targetTokenId?: string,
    area?: { targetTokenIds: string[]; targetCell: GridCell; targetOrientation?: 0 | 1 | 2 | 3 },
  ) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-plugin-action',
      targetTokenId,
      targetTokenIds: area?.targetTokenIds,
      targetCell: area?.targetCell,
      targetOrientation: area?.targetOrientation,
      dnd5ePluginAction: payload,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 请求使用扩展规则特性`)
  }

  const sendPlayerDnd5eItemUseRequest = (payload: Dnd5eItemUsePayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({ type: 'dnd5e-item-use', dnd5eItemUse: payload })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 请求使用物品`)
  }

  const sendDnd5eItemUseRequest = (instanceId: string) => {
    if (!combatActive || !activeChar || activeChar.id !== turnCharacter?.id) return false
    const entry = activeChar.dnd5eInventory?.entries.find((candidate) => candidate.instanceId === instanceId)
    const itemTargeting = entry?.item.use?.targeting
    if (entry && itemTargeting?.kind === 'map-area') {
      setShowMoveRange(false)
      setDnd5eCarefulMovement(false)
      setDnd5eSpellTargeting(null)
      setDnd5eItemCreatureTargeting(null)
      setDnd5eItemAreaTargeting({
        characterId: activeChar.id,
        instanceId,
        itemName: entry.item.name,
        targeting: itemTargeting,
      })
      setAoePreviewCell(null)
      return true
    }
    if (entry && itemTargeting?.kind === 'creature') {
      setShowMoveRange(false)
      setDnd5eCarefulMovement(false)
      setDnd5eSpellTargeting(null)
      setDnd5eItemAreaTargeting(null)
      setDnd5eItemCreatureTargeting({
        characterId: activeChar.id,
        instanceId,
        itemName: entry.item.name,
        targeting: itemTargeting,
      })
      return true
    }
    const payload: Dnd5eItemUsePayload = { instanceId }
    return isDM ? sendDmLocalDnd5eItemUseRequest(payload) : sendPlayerDnd5eItemUseRequest(payload)
  }

  const sendPlayerDnd5eAbilityCheckRequest = (payload: Dnd5eAbilityCheckPayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-ability-check',
      dnd5eAbilityCheck: payload,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 请求进行属性检定`)
  }

  const sendPlayerDnd5eMapInteractionRequest = (payload: Dnd5eMapInteractionPayload) => {
    if (isDM || !activeMap || !playerChar || pendingPlayerActionRef.current) return false
    const actorToken = activeMap.tokens.find((token) =>
      token.type === 'player' && token.characterId === playerChar.id,
    )
    if (!actorToken) return false
    if (combatActive && currentInitiativeToken?.id !== actorToken.id) return false
    const action = createPlayerActionRequest(
      { type: 'dnd5e-map-interaction', dnd5eMapInteraction: payload },
      { tokenId: actorToken.id, characterId: playerChar.id },
    )
    if (!action) return false
    return submitPlayerActionRequest(action, `${playerChar.name} 请求地图交互`)
  }

  const sendPlayerDnd5eSpellCastRequest = (payload: Dnd5eSpellCastPayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-spell-cast',
      targetTokenId: payload.targetTokenId,
      targetTokenIds: payload.targetTokenIds,
      targetCell: payload.areaTargetCell,
      dnd5eSpellCast: payload,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 施放 SRD 法术`)
  }

  const sendPlayerDnd5ePersistentAreaMoveRequest = (payload: Dnd5ePersistentAreaMovePayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-persistent-area-move',
      targetCell: payload.targetCell,
      dnd5ePersistentAreaMove: payload,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 请求移动持续法术区域`)
  }

  const sendPlayerDnd5eAdjudicatedSpellRequest = (payload: Dnd5eAdjudicatedSpellPayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'dnd5e-adjudicated-spell',
      dnd5eAdjudicatedSpell: payload,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 请求 DM 裁定法术`)
  }

  const submitSelectedDnd5eSpellTargets = () => {
    if (!dnd5eSpellTargeting) return false
    const selectedSpell = getDnd5eSrdCombatSpell(dnd5eSpellTargeting.spellId)
    const allowsEmptyArea = selectedSpell?.effect === 'persistent-area' && !!aoePreviewCell
    if (dnd5eSpellTargeting.targetTokenIds.length < 1 && !allowsEmptyArea) return false
    if (
      dnd5eSpellTargeting.allowDuplicateTargets &&
      dnd5eSpellTargeting.targetTokenIds.length !== dnd5eSpellTargeting.maximumTargets
    ) return false
    if (
      dnd5eSpellTargeting.metamagic?.kind === 'twinned' &&
      dnd5eSpellTargeting.targetTokenIds.length !== 2
    ) return false
    let healingAllocations: Dnd5eSpellCastPayload['healingAllocations']
    if (selectedSpell?.effect === 'healing-pool') {
      let remaining = selectedSpell.healingPool ?? 0
      healingAllocations = []
      for (const targetTokenId of [...new Set(dnd5eSpellTargeting.targetTokenIds)]) {
        const token = activeMap?.tokens.find((candidate) => candidate.id === targetTokenId)
        const character = token?.characterId
          ? useCharacterStore.getState().characters.find((candidate) => candidate.id === token.characterId)
          : undefined
        const suggested = Math.min(remaining, Math.max(0, (character?.maxHp ?? 0) - (character?.currentHp ?? 0)))
        const raw = window.prompt(
          `${token?.label ?? targetTokenId} 分配多少点治疗？\n剩余治疗池：${remaining}`,
          String(suggested),
        )
        if (raw == null) return false
        const amount = Number(raw)
        if (!Number.isInteger(amount) || amount < 0 || amount > remaining) {
          void showCombatNotice('治疗分配无效', `请输入0至${remaining}之间的整数。`, 'amber')
          return false
        }
        if (amount > 0) healingAllocations.push({ targetTokenId, amount })
        remaining -= amount
      }
      if (healingAllocations.length === 0) {
        void showCombatNotice('治疗分配无效', '至少需要为一个目标分配 1 点治疗。', 'amber')
        return false
      }
    }
    const committedTargetIds = healingAllocations
      ? healingAllocations.map((allocation) => allocation.targetTokenId)
      : [...new Set(dnd5eSpellTargeting.targetTokenIds)]
    const payload: Dnd5eSpellCastPayload = {
      spellId: dnd5eSpellTargeting.spellId,
      castingClassId: dnd5eSpellTargeting.castingClassId,
      slotLevel: dnd5eSpellTargeting.slotLevel,
      targetTokenId: committedTargetIds[0] ?? currentInitiativeToken?.id ?? '',
      targetTokenIds: committedTargetIds,
      areaTargetCell: aoePreviewCell ?? undefined,
      areaTargetOrientation: dnd5eSpellTargeting.area?.shape === 'rect' && dnd5eSpellTargeting.area.rotatable
        ? aoeRectRotation as 0 | 1 | 2 | 3
        : undefined,
      higherSlotDamageType: dnd5eSpellTargeting.higherSlotDamageType,
      conditionChoice: dnd5eSpellTargeting.conditionChoice,
      effectDamageType: dnd5eSpellTargeting.effectDamageType,
      healingAllocations,
      projectileTargetIds: dnd5eSpellTargeting.allowDuplicateTargets
        ? [...dnd5eSpellTargeting.targetTokenIds]
        : undefined,
      overchannel: dnd5eSpellTargeting.overchannel || undefined,
      empowered: dnd5eSpellTargeting.empowered || undefined,
      draconicResistance: dnd5eSpellTargeting.draconicResistance || undefined,
      repellingBlast: dnd5eSpellTargeting.repellingBlast || undefined,
      sculptedTargetIds: dnd5eSpellTargeting.sculptedTargetIds.length > 0
        ? [...dnd5eSpellTargeting.sculptedTargetIds]
        : undefined,
      metamagic: dnd5eSpellTargeting.metamagic
        ? {
            ...dnd5eSpellTargeting.metamagic,
            carefulTargetIds: dnd5eSpellTargeting.metamagic.kind === 'careful'
              ? [...dnd5eSpellTargeting.carefulTargetIds]
              : undefined,
            heightenedTargetId: dnd5eSpellTargeting.metamagic.kind === 'heightened'
              ? dnd5eSpellTargeting.heightenedTargetId
              : undefined,
          }
        : undefined,
    }
    const sent = isDM
      ? sendDmLocalDnd5eSpellCastRequest(payload)
      : sendPlayerDnd5eSpellCastRequest(payload)
    if (sent) setDnd5eSpellTargeting(null)
    return sent
  }

  const undoLastDnd5eSpellTarget = () => {
    setDnd5eSpellTargeting((current) => current
      ? { ...current, targetTokenIds: current.targetTokenIds.slice(0, -1) }
      : null)
  }

  const toggleDnd5eSculptSpellTargets = () => {
    setDnd5eSpellTargeting((current) => current?.canSculpt
      ? { ...current, sculpting: !current.sculpting, carefulSelecting: false, heightenedSelecting: false }
      : current)
  }

  const toggleDnd5eCarefulSpellTargets = () => {
    setDnd5eSpellTargeting((current) => current?.metamagic?.kind === 'careful'
      ? { ...current, carefulSelecting: !current.carefulSelecting, sculpting: false, heightenedSelecting: false }
      : current)
  }

  const toggleDnd5eHeightenedSpellTarget = () => {
    setDnd5eSpellTargeting((current) => current?.metamagic?.kind === 'heightened'
      ? { ...current, heightenedSelecting: !current.heightenedSelecting, sculpting: false, carefulSelecting: false }
      : current)
  }

  const sendPlayerMoveRequest = (targetPosition: { x: number; y: number }, movedFeet: number, movementCostFeet: number) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken || !myPlayerToken) return false
    if (currentDnd5eTurnEconomy(currentInitiativeToken.id).movement.current < movementCostFeet) return false
    const isProne = turnCharacter.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase()))
    const action = createPlayerActionRequest({
      type: 'move-token',
      targetPosition,
      dnd5eCarefulMovement,
      dnd5eStandFromProne: isProne ? dnd5eStandFromProne : undefined,
      dnd5eTraversalMode,
      targetElevationFeet: dnd5eTargetElevationFeet,
    })
    if (!action) return false
    return submitPlayerActionRequest(
      action,
      `${turnCharacter.name}${isProne && !dnd5eStandFromProne ? '匍匐' : dnd5eCarefulMovement ? '以半速谨慎' : ''}移动 ${movedFeet} 尺`,
    )
  }

  const sendPlayerDisengageRequest = () => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    if (currentDnd5eTurnEconomy(currentInitiativeToken.id).action.current < 1) return false
    const action = createPlayerActionRequest({ type: 'disengage' })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 撤离`)
  }

  const sendPlayerDodgeRequest = () => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    if (currentDnd5eTurnEconomy(currentInitiativeToken.id).action.current < 1) return false
    const action = createPlayerActionRequest({ type: 'dodge' })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 闪避`)
  }

  const sendPlayerBasicActionRequest = (payload: Dnd5eBasicActionPayload) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const replacesAttack = payload.kind === 'grapple' || payload.kind === 'shove'
    if (!replacesAttack && currentDnd5eTurnEconomy(currentInitiativeToken.id).action.current < 1) return false
    const action = createPlayerActionRequest({ type: 'dnd5e-basic-action', dnd5eBasicAction: payload })
    if (!action) return false
    const label = payload.kind === 'dash' ? '疾走'
      : payload.kind === 'hide' ? '躲藏'
        : payload.kind === 'help' ? '协助'
          : payload.kind === 'ready' ? '准备动作'
            : payload.kind === 'use-object' ? '使用物件'
              : payload.kind === 'grapple' ? '擒抱' : '推撞'
    return submitPlayerActionRequest(action, `${turnCharacter.name} 请求执行${label}`)
  }

  useMapsPlayerActionTransport({
    isDm: isDM,
    mode,
    activeMapId,
    dmRefreshKey: `${combatActive}:${round}:${currentInitiativeToken?.id ?? ''}`,
    getCombatId: () => combatIdRef.current,
    processedActionIdsRef: processedPlayerActionIdsRef,
    seenAckIdsRef: seenPlayerActionAckIdsRef,
    pendingActionRef: pendingPlayerActionRef,
    onAction: handlePlayerActionRequest,
    clearPendingAction: () => setPendingPlayerActionLocked(null),
    onTargetOutOfRange: () => {
      void showCombatNotice(
        '距离不足',
        '目标已经超出所选攻击的有效距离。近战攻击请先移动到武器触及范围内，再重新选择目标。',
        'amber',
      )
    },
  })

  const requestAdvanceEvent = useEffectEvent(() => requestAdvance())
  const pushCombatLogEvent = useEffectEvent(
    (...args: Parameters<typeof pushCombatLog>) => pushCombatLog(...args),
  )
  const scheduleEnemyTurnEvent = useEffectEvent((enemy: Token) => scheduleEnemyTurn(enemy))
  const clearPlayerCombatUIEvent = useEffectEvent(() => clearPlayerCombatUI())
  const clearPlayerCombatEndUIEvent = useEffectEvent(() => clearPlayerCombatEndUI())
  const tryEndCombatIfNeededEvent = useEffectEvent(() => tryEndCombatIfNeeded())
  const initiativeOrderKey = initiativeOrder
    .map((entry) => `${entry.slotId ?? entry.tokenId}:${entry.tokenId}`)
    .join('|')

  useEffect(() => {
    if (!combatActive || !activeMapId || initiativeOrderRef.current.length === 0) return
    if (!isDM) return

    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMapId)
    if (!latestMap) return
    const latestOrder = initiativeOrderRef.current
    const entry = latestOrder[initiativeIndexRef.current]
    if (!entry) {
      requestAdvanceEvent()
      return
    }

    const token = latestMap.tokens.find((t) => t.id === entry.tokenId)
    const chars = useCharacterStore.getState().characters

    // 槽位决策抽到纯函数 decideTurnAction（prune/skip/enemy/player）。effect 这里
    // 只保留各分支的「副作用」（prune 重排、去重 key、眩晕日志、全 npc parked 守卫、定时推进）。
    // 决策本身与 decideTurnAction 一致，便于 T13 在不挂载组件下单测。
    const action = decideTurnAction(token, chars)

    if (action === 'prune') {
      // prune at top level, not inside the updater (StrictMode double-fire)
      const pruned = pruneInitiativeForToken(initiativeOrderRef.current, initiativeIndexRef.current, entry.tokenId)
      initiativeIndexRef.current = pruned.index
      initiativeOrderRef.current = pruned.order
      setInitiativeOrder(pruned.order)
      setInitiativeIndex(pruned.index)
      const timer = window.setTimeout(() => requestAdvanceEvent(), 50)
      return () => window.clearTimeout(timer)
    }

    if (token && tokenIsStillSurprised(token)) {
      const surprisedCharacter = token.characterId
        ? chars.find((character) => character.id === token.characterId)
        : undefined
      const canUseFeralInstinct = surprisedCharacter != null &&
        dnd5eCharacterClassLevel(surprisedCharacter, 'barbarian') >= 7
      if (!canUseFeralInstinct && !(surprisedCharacter && characterNeedsDeathSave(surprisedCharacter))) {
        const skipKey = `surprised-${combatIdRef.current}-${token.id}`
        if (incapacitatedSkippedKeysRef.current.has(skipKey)) return
        incapacitatedSkippedKeysRef.current.add(skipKey)
        resolveSurpriseForToken(token)
        pushCombatLogEvent(`${token.label} 受突袭：首回合不能移动或采取动作，跳过该回合。`, 'turn')
        const timer = window.setTimeout(() => requestAdvanceEvent(), 50)
        return () => window.clearTimeout(timer)
      }
    }

    // 'skip' 合并三类：死亡 / 眩晕 / 存活非行动者。各自副作用保持独立（与原三分支逐字节一致）。
    if (action === 'skip') {
      // token 此处必非空（decideTurnAction 仅在 token 缺失时返回 'prune'）。
      const skipToken = token!
      // 死亡 token：直接定时推进（无去重 key，与原死亡分支一致）。
      if (!isTokenAlive(skipToken, chars)) {
        const timer = window.setTimeout(() => requestAdvanceEvent(), 50)
        return () => window.clearTimeout(timer)
      }

      // 存活的战斗单位仅会因 D&D 5e 失能类状态进入此分支。
      if (skipToken.type === 'player' || skipToken.type === 'enemy') {
        const skipKey = `incapacitated-${round}-${initiativeIndex}-${skipToken.id}`
        if (incapacitatedSkippedKeysRef.current.has(skipKey)) return
        incapacitatedSkippedKeysRef.current.add(skipKey)
        pushCombatLogEvent(`${skipToken.label} 当前无法行动，跳过本回合。`, 'turn')
        const timer = window.setTimeout(() => requestAdvanceEvent(), 50)
        return () => window.clearTimeout(timer)
      }

      // Live non-actor (npc/obstacle) in the initiative slot. There is
      // no enemy/player branch for it, so the round used to hang here: the player "结束回合"
      // button is disabled on a non-player turn (canControlPlayerTurn=false) -> the player
      // side was UNRECOVERABLY deadlocked; only the DM clicking "下一位" escaped. Auto-skip
      // DM-side; the advance is DM-authored and broadcast via the combat snapshot, so the
      // player advances too. The dedupe key prevents stacking skip timers across re-renders.
      // AC4: never spin on an all-npc queue. If no alive player/enemy actor exists at
      // all, park the round instead of advancing forever (each round mints new keys).
      if (!hasActionableActor(latestOrder, latestMap.tokens, chars)) return
      const skipKey = `nonactor-${round}-${initiativeIndex}-${skipToken.id}`
      if (nonActorSkippedKeysRef.current.has(skipKey)) return
      nonActorSkippedKeysRef.current.add(skipKey)
      const timer = window.setTimeout(() => requestAdvanceEvent(), 50)
      return () => window.clearTimeout(timer)
    }

    if (!isDM || !isAutomatedEnemyTurn || !token || !usesAutomatedMonsterSettlement(settlementMode)) return

    const actKey = `${round}-${initiativeIndex}-${token.id}`
    if (enemyAppliedKeysRef.current.has(actKey)) return

    enemyAppliedKeysRef.current.add(actKey)
    void scheduleEnemyTurnEvent(token)
  }, [combatActive, initiativeIndex, round, activeMapId, currentInitiativeToken?.id, isDM, settlementMode, isAutomatedEnemyTurn, initiativeOrderKey, resolveSurpriseForToken, tokenIsStillSurprised])

  useEffect(() => {
    if (!canControlPlayerTurn) {
      const timer = window.setTimeout(() => clearPlayerCombatUIEvent(), 0)
      return () => window.clearTimeout(timer)
    }
    if (!turnCharacter?.id || currentInitiativeToken?.type !== 'player') return
    const timer = window.setTimeout(() => setActiveCharId(turnCharacter.id), 0)
    return () => window.clearTimeout(timer)
  }, [canControlPlayerTurn, turnCharacter?.id, currentInitiativeToken?.type])

  useEffect(() => {
    if (!combatActive || !activeMapId || !currentInitiativeToken?.id) return
    if (!isDM) return
    if (tryEndCombatIfNeededEvent()) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMapId)
    const latestToken = latestMap?.tokens.find((token) => token.id === currentInitiativeToken.id)
    if (!latestToken) return
    if (
      !isTokenAlive(latestToken, characters) &&
      !(latestToken.type === 'player' && turnCharacter && characterNeedsDeathSave(turnCharacter))
    ) {
      const timer = window.setTimeout(() => requestAdvanceEvent(), 50)
      return () => window.clearTimeout(timer)
    }
  }, [combatActive, activeMapId, currentInitiativeToken?.id, characters, defeatedTokenIds.length, isDM, turnCharacter])

  useEffect(() => {
    const wasActive = previousCombatActiveRef.current
    previousCombatActiveRef.current = combatActive
    if (isDM || combatActive || !wasActive) return
    setPlayerCombatEndedLocked(true)
    clearPlayerCombatEndUIEvent()
  }, [isDM, combatActive])

  const handlePlayerEndTurn = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (advancingTurnRef.current) return
    if (!combatActive) return
    clearPlayerCombatUI()
    setAoePreviewCell(null)
    setAoeRectRotation(0)
    setShowMoveRange(false)

    if (combatActive && canControlPlayerTurn && turnCharacter) {
      multiStrikeHitsRef.current = clearCharacterScopedRecord(multiStrikeHitsRef.current, turnCharacter.id)
      setDisengagedCharIds((prev) => removeDisengagedCharacterId(prev, turnCharacter.id))
      if (isDM) {
        submitDmLocalPlayerAction(createDmLocalPlayerAction({ type: 'end-turn' }))
      } else {
        sendPlayerEndTurnRequest()
      }
      return
    }
  }

  const modeToggle = forcedMode || !mode ? null : <MapsModeToggle mode={mode} onChooseMode={chooseMode} />
  const playerWaitingForDm =
    mode === 'player' &&
    combatActive &&
    !matchesDmAuthorityReady(dmAuthorityReady, {
      mapId: activeMap?.id,
      combatId,
      combatActive,
    })
  const previewCover = dnd5eWeaponAttackConfirmation?.selectedCover === 'auto'
    ? dnd5eWeaponAttackConfirmation.automaticCover
    : dnd5eWeaponAttackConfirmation?.selectedCover
  const previewArmorClass = dnd5eWeaponAttackConfirmation
    ? dnd5eWeaponAttackConfirmation.selectedCover === 'auto'
      ? dnd5eWeaponAttackConfirmation.automaticArmorClass
      : dnd5eWeaponAttackConfirmation.baseArmorClass +
        (previewCover === 'half' ? 2 : previewCover === 'three-quarters' ? 5 : 0)
    : 0

  if (!mode) {
    return <MapsModeSelectionPanel onChooseMode={chooseMode} />
  }

  return (
    <div className="h-full w-full">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {maps.length === 0 || !activeMap ? (
        <MapsEmptyMapPanel
          modeToggle={modeToggle}
          isDm={isDM}
          onUpload={() => fileRef.current?.click()}
        />
      ) : (
        /* 全屏地图框，所有控件作为浮层 */
        <div ref={frameRef} className="relative h-full w-full overflow-hidden rounded-2xl">
          {/* 地图本体铺满 */}
          <div className="absolute inset-0">
            <MapCanvas
              map={displayActiveMap ?? activeMap}
              selectedTokenId={selectedTokenId}
              onSelectToken={handleSelectToken}
              targetSelectTokenIds={[]}
              isDM={isDM}
              tabletopTool={
                isDM && !measureMode && !showMoveRange && !gridAdjustMode && !deleteSelectMode && !fogEditMode && !geometryEditMode
                  ? mapTabletopTool
                  : 'none'
              }
              tabletopPings={activeMapTabletop.pings}
              tabletopAnnotations={activeMapTabletop.annotations}
              tabletopFocus={activeMapTabletop.focus}
              pingEnabled={!isSpectator && !measureMode && !showMoveRange && !gridAdjustMode && !deleteSelectMode && !fogEditMode && !geometryEditMode}
              onMapPing={(point) => void publishMapTabletopPing(activeMap.id, point)}
              onTabletopPoint={(point) => {
                if (!isDM) return
                setMapTabletopTool('none')
                void publishMapTabletopFocus(activeMap.id, point)
              }}
              onTabletopAnnotation={(shape, from, to) => {
                if (!isDM) return
                void publishMapTabletopAnnotation({ mapId: activeMap.id, shape, from, to })
              }}
              measureMode={isDM && measureMode && !showMoveRange && !gridAdjustMode && !deleteSelectMode && !fogEditMode && !geometryEditMode}
              hpByToken={hpByToken}
              dnd5eConditionsByToken={dnd5eConditionsByToken}
              onDnd5eConditionClick={(tokenId) => {
                setEffectDetailTokenId(tokenId)
              }}
              onDnd5ePluginAreaVisibilityToggle={(areaId) => {
                if (!isDM) return
                const latest = useMapStore.getState().maps.find((map) => map.id === activeMap.id)
                const area = latest?.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
                if (!latest || !area) return
                applyAuthorityMapUpdate(latest.id, {
                  dnd5ePluginAreas: latest.dnd5ePluginAreas?.map((candidate) =>
                    candidate.id === areaId
                      ? { ...candidate, hiddenFromPlayers: !candidate.hiddenFromPlayers }
                      : candidate,
                  ),
                })
              }}
              tokenHoverLabels={tokenHoverLabels}
              defeatedTokenIds={defeatedTokenIds}
              builtinGrid={!!activeMap.builtinGridDetected}
              moveSelectMode={!playerCombatLocked && inMoveSelectMode && !!activeMoveCircle && !activeAoeTargeting && !dnd5eItemAreaTargeting}
              moveCircle={activeMoveCircle}
              onMoveSelect={handleMoveSelect}
              moveTraversalMode={dnd5eTraversalMode}
              moveTargetElevationFeet={dnd5eTargetElevationFeet}
              difficultTerrainMultiplierAtPosition={(token, position) =>
                dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map: activeMap, token, position })}
              speedCostMultiplierAtPosition={(token, position) =>
                dnd5ePersistentAreaSpeedCostMultiplierAt({ map: activeMap, token, position })}
              aoeSelectMode={!playerCombatLocked && (!!activeAoeTargeting || !!dnd5eItemAreaTargeting)}
              aoeHighlight={aoeHighlight}
              rangedRangeCells={rangedRangeCells}
              onAoePreviewCell={handleAoePreviewCell}
              onAoeConfirm={handleAoeConfirm}
              onAoeCancel={() => {
                setDnd5eCoreAreaMoveTargeting(null)
                setDnd5eSpellTargeting(null)
                setDnd5eItemAreaTargeting(null)
                setDnd5ePluginAreaTargeting(null)
                setAoePreviewCell(null)
              }}
              deleteSelectMode={isDM && deleteSelectMode && !showMoveRange && !gridAdjustMode && !measureMode && !fogEditMode && !geometryEditMode}
              onDeleteBoxConfirm={handleDeleteBoxConfirm}
              onDeleteCancel={() => setDeleteSelectMode(false)}
              fog={activeFog}
              fogEditMode={isDM && fogEditMode}
              fogTool={fogTool}
              fogPreviewAsPlayer={fogPreviewAsPlayer}
              onFogShapeCommit={(shape) => {
                if (isDM) addFogShape(activeMap.id, shape)
              }}
              onFogEditCancel={() => {
                setFogEditMode(false)
                setFogPreviewAsPlayer(false)
              }}
              geometry={activeGeometry}
              geometryEditMode={isDM && geometryEditMode}
              geometryTool={geometryTool}
              geometryWallMaterial={geometryWallMaterial}
              selectedGeometryEntityId={selectedGeometryEntityId}
              geometryPreviewAsPlayer={geometryPreviewAsPlayer}
              geometrySnapToGrid={geometrySnapToGrid}
              visionSourceTokenIds={visionSourceTokenIds}
              exploredVisionPolygons={exploredVisionPolygons}
              onGeometryEntityCommit={(entity) => {
                if (isDM) addGeometryEntity(activeMap.id, entity)
              }}
              onGeometryEntitySelect={selectGeometryEntity}
              onGeometryEntityDelete={(entityId) => removeGeometryEntity(activeMap.id, entityId)}
              onGeometryEntityPointsChange={(entityId, points) => {
                if (isDM) setGeometryEntityPoints(activeMap.id, entityId, points)
              }}
              onGeometryDoorInteract={!isDM && !isSpectator ? setSelectedDoorInteractionId : undefined}
              geometrySearchMode={!isDM && !isSpectator && !!dnd5eSecretSearchMethod}
              onGeometrySearch={!isDM && !isSpectator && dnd5eSecretSearchMethod ? (point) => {
                sendPlayerDnd5eMapInteractionRequest({
                  operation: 'search',
                  point,
                  method: dnd5eSecretSearchMethod,
                })
                setDnd5eSecretSearchMethod(null)
              } : undefined}
              onGeometryEditCancel={() => {
                setGeometryEditMode(false)
                setGeometryPreviewAsPlayer(false)
                selectGeometryEntity(null)
              }}
              onTokenMoveBlocked={() => {
                pushCombatLog('移动被地图墙体、关闭的门或障碍物阻挡。', 'system')
              }}
              onBlankContextMenu={() => {
                setDnd5eWeaponTargeting(null)
                dismissDnd5eWeaponAttackConfirmation()
                setDnd5eSpellTargeting(null)
                setDnd5eItemAreaTargeting(null)
                setDnd5eItemCreatureTargeting(null)
                setDnd5ePluginAreaTargeting(null)
                setSelectedTokenId(null)
                setSelectedCharacterTokenId(null)
                setEnemyDetailOpen(false)
                setActiveCharId(null)
                setCharPanel(null)
              }}
              lockDragTokenIds={
                (activeAoeTargeting || dnd5eItemAreaTargeting) && activeAoeCasterId
                    ? (activeMap.tokens
                        .filter((t) => t.characterId === activeAoeCasterId)
                        .map((t) => t.id) ?? [])
                    : myPlayerToken && canControlPlayerTurn
                      ? [myPlayerToken.id]
                      : []
              }
              gridAdjustMode={isDM && gridAdjustMode && !fogEditMode && !geometryEditMode}
              onGridOffsetChange={(offsetX, offsetY) =>
                updateMap(activeMap.id, { gridOffsetX: offsetX, gridOffsetY: offsetY })
              }
              gridSizePreview={isDM && gridSizePreview}
              onGridSizeChange={(gridSize) =>
                updateMap(activeMap.id, { gridSize: clampGridSize(gridSize, activeMap) })
              }
            />
          </div>
          {!isDM && (
            <div className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border border-white/10 bg-void-950/78 px-3 py-2 text-[11px] font-medium text-slate-300 shadow-lg backdrop-blur-sm">
              {isSpectator ? '只读观战 · 使用玩家安全视野' : '双击地图可发送 Ping 标记'}
            </div>
          )}
          {dnd5eWeaponAttackConfirmation && previewCover ? (
            <Dnd5eWeaponAttackConfirmationPanel
              confirmation={dnd5eWeaponAttackConfirmation}
              previewCover={previewCover}
              previewArmorClass={previewArmorClass}
              isDm={isDM}
              onDismiss={dismissDnd5eWeaponAttackConfirmation}
              onCoverChange={(selectedCover) => setDnd5eWeaponAttackConfirmation((current) => current
                ? { ...current, selectedCover }
                : current)}
              onConfirm={() => {
                const confirmation = dnd5eWeaponAttackConfirmation
                if (confirmation.authorityActionId) {
                  settleDmCoverOverride(confirmation.selectedCover)
                  return
                }
                const targetToken = activeMap.tokens.find((token) => token.id === confirmation.targetTokenId)
                if (!targetToken) {
                  dismissDnd5eWeaponAttackConfirmation()
                  return
                }
                const options = { ...(confirmation.options ?? {}) }
                if (isDM && confirmation.selectedCover !== 'auto') {
                  options.coverOverride = confirmation.selectedCover
                } else {
                  delete options.coverOverride
                }
                const sent = isDM
                  ? sendDmLocalDnd5eWeaponAttackRequest(targetToken, Object.keys(options).length > 0 ? options : undefined)
                  : sendPlayerDnd5eWeaponAttackRequest(targetToken, Object.keys(options).length > 0 ? options : undefined)
                if (sent) dismissDnd5eWeaponAttackConfirmation()
              }}
            />
          ) : null}
          {playerWaitingForDm && (
            <div
              data-testid="dm-authority-waiting"
              className="pointer-events-none absolute left-1/2 top-4 z-[58] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-sky-300/30 bg-void-950/92 px-3 py-2 text-xs font-semibold text-sky-100 shadow-xl backdrop-blur-md"
            >
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              正在等待 DM 同步战斗状态
            </div>
          )}
          {!isDM && !isSpectator && (
            <div className="absolute bottom-24 left-1/2 z-[58] -translate-x-1/2 rounded-xl border border-violet-300/25 bg-void-950/92 p-2 shadow-xl backdrop-blur-md">
              {dnd5eSecretSearchMethod ? (
                <div className="flex items-center gap-2">
                  <span className="px-2 text-xs font-semibold text-violet-100">
                    点击附近地图搜索暗门 · {dnd5eSecretSearchMethod === 'perception' ? '感知' : '调查'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDnd5eSecretSearchMethod(
                      dnd5eSecretSearchMethod === 'perception' ? 'investigation' : 'perception',
                    )}
                    className="rounded-lg border border-violet-300/20 px-2.5 py-1.5 text-xs text-violet-100 hover:bg-violet-500/15"
                  >
                    切换为{dnd5eSecretSearchMethod === 'perception' ? '调查' : '感知'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDnd5eSecretSearchMethod(null)}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5"
                  >取消</button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setDnd5eSecretSearchMethod('perception')}
                  className="flex items-center gap-2 rounded-lg bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/25"
                >
                  <Eye className="h-3.5 w-3.5" />
                  搜索暗门
                </button>
              )}
            </div>
          )}

          {isDM && (activeMap.dnd5eItemAreas?.length ?? 0) > 0 && (
            <div className="absolute right-4 top-16 z-30 w-52 rounded-xl border border-white/10 bg-void-950/88 p-2 text-xs shadow-xl backdrop-blur-sm">
              <p className="px-1 pb-1.5 font-semibold text-slate-300">地图物品区域</p>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {activeMap.dnd5eItemAreas!.map((area) => (
                  <div key={area.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-slate-300">
                      {area.sourceItemName}{area.armed ? '' : '（已触发）'}
                    </span>
                    {area.kind === 'hunting-trap' && (
                      <button
                        type="button"
                        onClick={() => removeDnd5eItemArea(area.id, true)}
                        className="rounded px-1.5 py-0.5 text-emerald-300 hover:bg-emerald-400/10"
                      >
                        收回
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeDnd5eItemArea(area.id)}
                      className="rounded px-1.5 py-0.5 text-rose-300 hover:bg-rose-400/10"
                    >
                      清除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isDM && gridAdjustMode && (
            <div className="pointer-events-none absolute left-1/2 top-[5.25rem] z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/35 bg-void-950/90 px-3 py-1.5 text-xs text-amber-100 shadow-xl backdrop-blur-sm">
              <Move className="h-3.5 w-3.5 shrink-0" />
              <span>
                拖拽平移网格 · 滚轮缩放格子 · Shift+滚轮 ±3px · 方向键微调 · 偏移 ({activeMap.gridOffsetX},{activeMap.gridOffsetY}) · {activeMap.gridSize}px
              </span>
            </div>
          )}

          {dnd5eItemAreaTargeting && (
            <div className="absolute left-1/2 top-14 z-40 flex max-w-[min(92vw,760px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-400/40 bg-void-950/90 px-4 py-2 text-sm shadow-2xl backdrop-blur-sm">
              <span className="text-xl">△</span>
              <span className="text-slate-200">
                放置 <span className="font-semibold text-amber-200">{dnd5eItemAreaTargeting.itemName}</span>
                {' '}· {dnd5eItemAreaTargeting.targeting.widthFeet}×{dnd5eItemAreaTargeting.targeting.heightFeet} 尺
                {aoeHighlight ? ` · 当前高亮 ${aoeHighlight.cells.length} 格` : ''}
                {' '}· 移动鼠标预览，点击有效格确认
              </span>
              <button
                onClick={() => { setDnd5eItemAreaTargeting(null); setAoePreviewCell(null) }}
                className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {showMoveRange && moveCircle && (
            <div className="absolute left-1/2 top-14 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-sky-400/40 bg-void-950/90 px-4 py-2 text-sm shadow-2xl backdrop-blur-sm">
              <span className="text-slate-200">
                选择移动落点 · 可达 {moveCircle.feet} 尺
              </span>
              <select
                aria-label="移动方式"
                value={dnd5eTraversalMode}
                onChange={(event) => setDnd5eTraversalMode(event.target.value as Dnd5eTraversalMode)}
                className="rounded-lg border border-white/10 bg-void-900 px-2 py-1 text-xs text-slate-200"
              >
                <option value="walk">步行</option>
                <option value="climb">攀爬（通常半速）</option>
                <option value="swim">游泳（通常半速）</option>
                <option value="fly">飞行（需要飞行速度）</option>
                <option value="long-jump-running">助跑跳远</option>
                <option value="long-jump-standing">立定跳远</option>
                <option value="fall">坠落（按海拔差结算）</option>
              </select>
              <label className="flex items-center gap-1 text-xs text-slate-300">
                目标海拔
                <input
                  aria-label="目标海拔"
                  type="number"
                  step={5}
                  value={dnd5eTargetElevationFeet}
                  onChange={(event) => setDnd5eTargetElevationFeet(Number(event.target.value) || 0)}
                  className="w-16 rounded-lg border border-white/10 bg-void-900 px-2 py-1 text-xs text-slate-100"
                />
                尺
              </label>
              <button
                type="button"
                onClick={() => setDnd5eCarefulMovement((current) => !current)}
                className={`rounded-lg px-2 py-1 text-xs ${dnd5eCarefulMovement ? 'bg-emerald-500/25 text-emerald-100' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                title="半速移动穿过滚珠或铁蒺藜时无需进行敏捷豁免；每移动 1 尺消耗 2 尺移动。"
              >
                {dnd5eCarefulMovement ? '半速谨慎：开' : '半速谨慎：关'}
              </button>
              {turnCharacter?.conditions.some((condition) => ['prone', '倒地'].includes(condition.toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => setDnd5eStandFromProne((current) => !current)}
                  className={`rounded-lg px-2 py-1 text-xs ${dnd5eStandFromProne ? 'bg-sky-500/25 text-sky-100' : 'bg-amber-500/20 text-amber-100'}`}
                  title="起身消耗当前有效速度的一半；保持倒地时每移动 1 尺消耗 2 尺移动。"
                >
                  {dnd5eStandFromProne ? '移动方式：先起身' : '移动方式：匍匐'}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setShowMoveRange(false); setDnd5eCarefulMovement(false); setDnd5eStandFromProne(true) }}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {dnd5eItemCreatureTargeting && (
            <div className="absolute left-1/2 top-14 z-40 flex max-w-[min(92vw,760px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-cyan-400/40 bg-void-950/90 px-4 py-2 text-sm shadow-2xl backdrop-blur-sm">
              <span className="text-xl">◎</span>
              <span className="text-slate-200">
                使用 <span className="font-semibold text-cyan-200">{dnd5eItemCreatureTargeting.itemName}</span>
                {' '}· 点击 {dnd5eItemCreatureTargeting.targeting.rangeFeet} 尺内的生物目标
              </span>
              <button
                onClick={() => setDnd5eItemCreatureTargeting(null)}
                className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {dnd5eSpellTargeting?.area && (
            <div className="absolute left-1/2 top-14 z-40 flex max-w-[min(92vw,760px)] -translate-x-1/2 items-center gap-3 rounded-xl border border-violet-400/40 bg-void-950/90 px-4 py-2 text-sm shadow-2xl backdrop-blur-sm">
              <span className="text-xl">✦</span>
              <span className="text-slate-200">
                <span className="font-semibold text-violet-200">
                  {getDnd5eSrdCombatSpell(dnd5eSpellTargeting.spellId)?.name ?? dnd5eSpellTargeting.spellId}
                </span>
                {' '}· {dnd5eSpellAreaLabel(getDnd5eSrdCombatSpell(dnd5eSpellTargeting.spellId) ?? { area: dnd5eSpellTargeting.area })}
                {aoeHighlight ? ` · 当前高亮 ${aoeHighlight.cells.length} 格` : ''}
                {' '}· 移动鼠标预览，点击地图锁定范围
              </span>
              <button
                onClick={() => {
                  setDnd5eSpellTargeting(null)
                  setAoePreviewCell(null)
                }}
                className="shrink-0 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {combatDialog && (
            <div className="absolute inset-0 z-[65] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="combat-dialog-title"
                className={`mx-4 w-full max-w-md rounded-2xl p-5 shadow-2xl ${
                  combatDialog.tone === 'violet'
                    ? 'border border-violet-400/35 bg-void-950/95'
                    : combatDialog.tone === 'amber'
                      ? 'border border-amber-400/35 bg-void-950/95'
                      : combatDialog.tone === 'rose'
                        ? 'border border-rose-400/35 bg-void-950/95'
                        : 'border border-sky-400/35 bg-void-950/95'
                }`}
              >
                <h3
                  id="combat-dialog-title"
                  className={`text-lg font-semibold ${
                    combatDialog.tone === 'violet'
                      ? 'text-violet-100'
                      : combatDialog.tone === 'amber'
                        ? 'text-amber-100'
                        : combatDialog.tone === 'rose'
                          ? 'text-rose-100'
                          : 'text-sky-100'
                  }`}
                >
                  {combatDialog.title}
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {combatDialog.message}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  {combatDialog.cancelText && (
                    <button
                      type="button"
                      onClick={() => closeCombatDialog(false)}
                      className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                    >
                      {combatDialog.cancelText}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => closeCombatDialog(true)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      combatDialog.tone === 'violet'
                        ? 'bg-violet-500/25 text-violet-100 hover:bg-violet-500/35'
                        : combatDialog.tone === 'amber'
                          ? 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/35'
                          : combatDialog.tone === 'rose'
                            ? 'bg-rose-500/25 text-rose-100 hover:bg-rose-500/35'
                            : 'bg-sky-500/25 text-sky-100 hover:bg-sky-500/35'
                    }`}
                  >
                    {combatDialog.confirmText}
                  </button>
                </div>
              </div>
            </div>
          )}

          <ClassFeatureInterruptPanels
            now={sharedDodgeNow}
            pluginChoicePrompt={sharedPluginChoicePrompt}
            bardicInspirationPrompt={sharedBardicInspirationPrompt}
            cuttingWordsPrompt={sharedCuttingWordsPrompt}
            darkOnesOwnLuckPrompt={sharedDarkOnesOwnLuckPrompt}
            strokeOfLuckPrompt={sharedStrokeOfLuckPrompt}
            empoweredSpellPrompt={sharedEmpoweredSpellPrompt}
            empoweredSpellSelection={sharedEmpoweredSpellSelection}
            standAgainstTidePrompt={sharedStandAgainstTidePrompt}
            onPluginChoice={handleSharedPluginChoice}
            onBardicInspirationChoice={handleSharedBardicInspirationChoice}
            onCuttingWordsChoice={handleSharedCuttingWordsChoice}
            onDarkOnesOwnLuckChoice={handleSharedDarkOnesOwnLuckChoice}
            onStrokeOfLuckChoice={handleSharedStrokeOfLuckChoice}
            setEmpoweredSpellSelection={setSharedEmpoweredSpellSelection}
            onEmpoweredSpellChoice={handleSharedEmpoweredSpellChoice}
            onStandAgainstTideChoice={handleSharedStandAgainstTideChoice}
          />
          {isDM && showSurpriseSetup && !combatActive && activeMap && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
              <div role="dialog" aria-modal="true" aria-label="突袭设置" className="w-full max-w-xl rounded-2xl border border-rose-400/25 bg-void-950 p-5 shadow-2xl">
                <h3 className="text-lg font-semibold text-rose-100">开始战斗 · 突袭判定</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  勾选没有察觉威胁的单位。受突袭者在自己的首回合结束前不能移动、采取动作或进行反应；7级野蛮人的野性直觉可先进入狂暴后正常行动。
                </p>
                <div className="mt-4 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                  {activeMap.tokens.filter((token) => token.type === 'player' || token.type === 'enemy').map((token) => (
                    <label key={token.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 py-2 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={surpriseSelection.has(token.id)}
                        onChange={(event) => setSurpriseSelection((current) => {
                          const next = new Set(current)
                          if (event.target.checked) next.add(token.id)
                          else next.delete(token.id)
                          return next
                        })}
                        className="accent-rose-500"
                      />
                      <span className="text-lg">{token.emoji || '◉'}</span>
                      <span className="min-w-0 flex-1 truncate">{token.label}</span>
                      <span className="text-[10px] text-slate-500">{token.type === 'player' ? '玩家' : '敌人'}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={() => setShowSurpriseSetup(false)} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">取消</button>
                  <button type="button" onClick={() => void startCombat([...surpriseSelection])} className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400">确认并开始</button>
                </div>
              </div>
            </div>
          )}
          {!isDM && selectedDoorInteraction && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
              <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl border border-violet-400/30 bg-void-950 p-5 shadow-2xl">
                <h3 className="text-lg font-semibold text-violet-100">地图交互 · {selectedDoorInteraction.label}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  请求只包含你的意图。距离、门状态、钥匙、工具、DC、骰值和行动消耗都会由 DM Host 重新验证。
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {selectedDoorInteraction.state === 'open' ? (
                    <button
                      type="button"
                      onClick={() => {
                        sendPlayerDnd5eMapInteractionRequest({ doorId: selectedDoorInteraction.id, operation: 'close' })
                        setSelectedDoorInteractionId(null)
                      }}
                      className="rounded-lg bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/30"
                    >关门</button>
                  ) : (
                    <>
                      {selectedDoorInteraction.state === 'closed' && (
                        <button
                          type="button"
                          onClick={() => {
                            sendPlayerDnd5eMapInteractionRequest({ doorId: selectedDoorInteraction.id, operation: 'open' })
                            setSelectedDoorInteractionId(null)
                          }}
                          className="rounded-lg bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/30"
                        >开门</button>
                      )}
                      {selectedDoorInteraction.state === 'locked' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              sendPlayerDnd5eMapInteractionRequest({ doorId: selectedDoorInteraction.id, operation: 'unlock', method: 'key' })
                              setSelectedDoorInteractionId(null)
                            }}
                            className="rounded-lg bg-emerald-500/15 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/25"
                          >使用钥匙</button>
                          <button
                            type="button"
                            onClick={() => {
                              sendPlayerDnd5eMapInteractionRequest({ doorId: selectedDoorInteraction.id, operation: 'unlock', method: 'thieves-tools' })
                              setSelectedDoorInteractionId(null)
                            }}
                            className="rounded-lg bg-sky-500/15 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/25"
                          >盗贼工具开锁</button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          sendPlayerDnd5eMapInteractionRequest({ doorId: selectedDoorInteraction.id, operation: 'break', method: 'force' })
                          setSelectedDoorInteractionId(null)
                        }}
                        className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25"
                      >力量破门</button>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDoorInteractionId(null)}
                  className="mt-4 w-full rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
                >取消</button>
              </div>
            </div>
          )}

          <DmAdjudicationPanel
            isDm={isDM}
            prompt={sharedDmAdjudicationPrompt}
            tokens={activeMap.tokens}
            dc={dmAdjudicationDc}
            setDc={setDmAdjudicationDc}
            mapOverride={dmAdjudicationMapOverride}
            setMapOverride={setDmAdjudicationMapOverride}
            saveOverride={dmAdjudicationSaveOverride}
            setSaveOverride={setDmAdjudicationSaveOverride}
            effects={dmAdjudicationEffects}
            setEffects={setDmAdjudicationEffects}
            concentrationRounds={dmAdjudicationConcentrationRounds}
            setConcentrationRounds={setDmAdjudicationConcentrationRounds}
            note={dmAdjudicationNote}
            setNote={setDmAdjudicationNote}
            onDecision={handleSharedDmAdjudicationChoice}
          />
          <ReactionInterruptPanels
            now={sharedDodgeNow}
            savingThrowRerollPrompt={sharedSavingThrowRerollPrompt}
            protectionPrompt={sharedProtectionPrompt}
            shieldSpellPrompt={sharedShieldSpellPrompt}
            counterspellPrompt={sharedCounterspellPrompt}
            uncannyDodgePrompt={sharedUncannyDodgePrompt}
            deflectMissilesPrompt={sharedDeflectMissilesPrompt}
            opportunityAttackPrompt={sharedOpportunityAttackPrompt}
            onSavingThrowRerollChoice={handleSharedSavingThrowRerollChoice}
            onProtectionChoice={handleSharedProtectionChoice}
            onShieldSpellChoice={handleSharedShieldSpellChoice}
            onCounterspellChoice={handleSharedCounterspellChoice}
            onUncannyDodgeChoice={handleSharedUncannyDodgeChoice}
            onDeflectMissilesChoice={handleSharedDeflectMissilesChoice}
            onOpportunityAttackChoice={handleSharedOpportunityAttackChoice}
          />

          {combatActive && mode && supportsManualDice(settlementMode, mode) && (
            <CombatSettlementPanel
              key={`${combatId}:${mode}:${settlementMode}`}
              mode={settlementMode}
              isDM={isDM}
              rollerName={manualDiceRollerName}
              targets={manualSettlementTargets}
              currentTurnTokenId={currentInitiativeToken?.id}
              onRoll={handleManualDiceRoll}
              onSettle={isDM ? handleManualSettlement : undefined}
            />
          )}

          {(combatActive || combatLog.length > 0) && (
            <div className="absolute bottom-3 right-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-col items-end">
              {combatLogOpen ? (
                <div className="w-[min(36rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-void-950/90 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                    <Swords className="h-4 w-4 text-amber-200" />
                    <span className="text-sm font-bold text-slate-100">战斗记录</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-300">
                      {combatLog.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCombatLog([])}
                      className="ml-auto rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white/10 hover:text-slate-200"
                    >
                      清空
                    </button>
                    <button
                      type="button"
                      onClick={() => setCombatLogOpen(false)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-slate-100"
                      title="隐藏战斗 Log"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-[28rem] overflow-y-auto px-2 py-2">
                    {combatLog.length === 0 ? (
                      <p className="px-2 py-5 text-center text-xs text-slate-500">暂无战斗记录</p>
                    ) : (
                      <div className="space-y-1.5">
                        {combatLog.map((entry) => {
                          const tone =
                            entry.kind === 'damage'
                              ? 'border-rose-400/25 bg-rose-500/10 text-rose-100'
                              : entry.kind === 'attack'
                                ? 'border-sky-400/25 bg-sky-500/10 text-sky-100'
                                : entry.kind === 'turn'
                                  ? 'border-amber-400/25 bg-amber-500/10 text-amber-100'
                                  : 'border-white/10 bg-white/[0.04] text-slate-200'
                          return (
                            <div key={entry.id} className={`rounded-lg border px-2 py-1.5 ${tone}`}>
                              <div className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                                <span className="tabular-nums">R{entry.round}</span>
                                <span className="tabular-nums">{entry.time}</span>
                                <span className="rounded bg-black/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wide">
                                  {entry.kind === 'damage' ? '结算' : entry.kind === 'attack' ? '攻击' : entry.kind === 'turn' ? '回合' : '规则'}
                                </span>
                              </div>
                              <p className="text-xs font-semibold leading-snug">{migrateLegacyApCombatLogText(entry.text)}</p>
                              {entry.details && entry.details.length > 0 && (
                                <div className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-slate-300">
                                  {entry.details.map((detail, index) => (
                                    <div key={`${entry.id}-detail-${index}`} className="flex gap-2">
                                      <span aria-hidden className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-current opacity-55" />
                                      <span>{detail}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCombatLogOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-void-950/88 px-3 py-2 text-xs font-bold text-slate-200 shadow-xl backdrop-blur-md hover:bg-white/10"
                >
                  <Swords className="h-3.5 w-3.5 text-amber-200" />
                  Log
                  {combatLog.length > 0 && (
                    <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[10px] tabular-nums text-amber-100">
                      {combatLog.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {sharedRollConfirmationPrompt && (
            <D20RollConfirmationOverlay
              interrupt={sharedRollConfirmationPrompt}
              isDM={isDM}
              playerCharacter={!isDM && playerChar ? { id: playerChar.id, name: playerChar.name } : undefined}
              busy={settlingRollConfirmation}
              onContribute={handleD20ReplacementContribution}
              onContinue={handleD20RollContinue}
            />
          )}
          {roll && <DiceRollOverlay roll={roll} onDone={handleRollDone} />}
          {diceBoxD20 && (
            <DiceBoxD20Overlay
              key={`local-d20-${diceBoxD20.id}`}
              active
              label={diceBoxD20.label ?? 'D20'}
              targetName={diceBoxD20.targetName ?? ''}
              value={diceBoxD20.value}
              requestId={diceBoxD20.requestKey}
              flyIndex={diceBoxD20.flyIndex}
              onComplete={(value) => {
                const request = diceBoxD20
                request.resolve(value)
                window.setTimeout(() => {
                  setDiceBoxD20((current) => (current?.id === request.id ? null : current))
                }, 600)
              }}
            />
          )}
          {diceBoxRoll && (
            <DiceBoxRollOverlay
              key={diceBoxRoll.id}
              count={diceBoxRoll.count}
              sides={diceBoxRoll.sides}
              label={diceBoxRoll.label}
              targetName={diceBoxRoll.targetName}
              values={diceBoxRoll.values}
              requestId={diceBoxRoll.requestKey}
              flyIndex={diceBoxRoll.flyIndex}
              showHud={false}
              onComplete={(values) => {
                const request = diceBoxRoll
                request.resolve(request.values.length > 0 ? request.values : values)
                window.setTimeout(() => {
                  setDiceBoxRoll((current) => (current?.id === request.id ? null : current))
                }, 3000)
              }}
            />
          )}
          {/* T-P2-398 (398-A): player self-render of the broadcast result. The
              overlays @-relabel to the decided values; no frames, no seed. */}
          {rollRequestPreview?.kind === 'd20' && (
            <DiceBoxD20Overlay
              key={`rr-d20-${rollRequestPreview.id}`}
              active
              label={rollRequestPreview.label}
              targetName={rollRequestPreview.targetName}
              value={rollRequestPreview.values[0]}
              requestId={rollRequestPreview.id}
              onComplete={() => {
                const id = rollRequestPreview.id
                window.setTimeout(() => {
                  setRollRequestPreview((current) => (current?.id === id ? null : current))
                }, 800)
              }}
            />
          )}
          {rollRequestPreview?.kind === 'dice' && (
            <DiceBoxRollOverlay
              key={`rr-dice-${rollRequestPreview.id}`}
              count={rollRequestPreview.count}
              sides={rollRequestPreview.sides}
              label={rollRequestPreview.label}
              targetName={rollRequestPreview.targetName}
              values={rollRequestPreview.values}
              requestId={rollRequestPreview.id}
              showHud={false}
              onComplete={() => {
                const id = rollRequestPreview.id
                window.setTimeout(() => {
                  setRollRequestPreview((current) => (current?.id === id ? null : current))
                }, 1500)
              }}
            />
          )}

          {/* 先攻（控制栏隐藏时单独置顶） */}
          {combatActive && initiativeOrder.length > 0 && !showBar && (
            <div className="absolute inset-x-0 top-2 z-30 flex justify-center px-2">
              <InitiativeTracker
                entries={displayInitiativeOrder}
                activeIndex={initiativeIndex}
                scrollOffset={initiativeScroll}
                round={round}
                hpByToken={hpByToken}
                defeatedTokenIds={defeatedTokenIds}
                onScroll={setInitiativeScroll}
                onSelect={(tokenId) => handleSelectToken(tokenId)}
              />
            </div>
          )}

          {/* 顶部控件浮层（可隐藏）；先攻叠在控制栏下方避免遮挡 */}
          {showBar ? (
            <div className="absolute inset-x-2 top-2 z-30 flex flex-col items-center gap-2">
            <div className="glass flex w-full flex-wrap items-center gap-2 rounded-xl px-2 py-1.5 shadow-xl">
              {modeToggle}

              {/* 战斗状态 + 控制 */}
              <div
                data-testid="combat-status"
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                  combatActive ? 'bg-rose-500/15 text-rose-200' : 'bg-white/5 text-slate-400',
                ].join(' ')}
              >
                <Swords className="h-3.5 w-3.5" />
                {combatActive ? `第 ${round} 回合` : '未开始'}
              </div>
              {isDM ? (
                <select
                  data-testid="combat-settlement-mode"
                  aria-label="战斗结算模式"
                  value={settlementMode}
                  onChange={(event) => changeSettlementMode(event.target.value)}
                  className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-100 outline-none [&>option]:bg-void-900"
                  title={COMBAT_SETTLEMENT_MODE_OPTIONS.find((option) => option.id === settlementMode)?.summary}
                >
                  {COMBAT_SETTLEMENT_MODE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              ) : (
                <span data-testid="combat-settlement-mode-label" className="rounded-lg bg-violet-500/10 px-2 py-1 text-xs font-semibold text-violet-200">
                  {COMBAT_SETTLEMENT_MODE_OPTIONS.find((option) => option.id === settlementMode)?.label}
                </span>
              )}
              {isDM &&
                (combatActive ? (
                  <>
                    <button
                      data-testid="dm-next-turn"
                      onClick={advanceInitiative}
                      disabled={initiativeOrder.length === 0 || (isAutomatedEnemyTurn && usesAutomatedMonsterSettlement(settlementMode))}
                      className="flex items-center gap-1 rounded-lg bg-arcane-500/25 px-2.5 py-1 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                      title={isAutomatedEnemyTurn && usesAutomatedMonsterSettlement(settlementMode) ? '敌人回合中，行动结束后自动推进' : undefined}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      {isAutomatedEnemyTurn && usesAutomatedMonsterSettlement(settlementMode) ? '敌人行动中…' : '下一位'}
                    </button>
                    <button
                      data-testid="dm-end-combat"
                      onClick={() => void endCombat()}
                      disabled={combatEnding}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
                    >
                      <Square className="h-3.5 w-3.5" />
                      {combatEnding ? '结束中…' : '结束'}
                    </button>
                  </>
                ) : (
                  <button
                    data-testid="dm-start-combat"
                    onClick={() => {
                      setSurpriseSelection(new Set())
                      setShowSurpriseSetup(true)
                    }}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    <Play className="h-3.5 w-3.5" />
                    开始战斗
                  </button>
                ))}

              {canControlDeathSaveTurn && (
                <button
                  data-testid="dnd5e-death-save"
                  onClick={() => sendDnd5eDeathSaveRequest()}
                  disabled={!!pendingPlayerAction}
                  className="flex items-center gap-1 rounded-lg bg-rose-500/25 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                  title="由 DM 权威投掷并同步死亡豁免；未恢复生命值时自动结束本回合"
                >
                  <Skull className="h-3.5 w-3.5" />
                  进行死亡豁免
                </button>
              )}

              {/* 玩家：结束自己的回合 */}
              {!isDM && (
                <button
                  data-testid="player-end-turn-top"
                  onClick={handlePlayerEndTurn}
                  disabled={!!pendingPlayerAction || !canControlPlayerTurn || !turnCharacter}
                  className={[
                    'flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                    activeChar
                      ? 'bg-arcane-500/25 text-arcane-100 hover:bg-arcane-500/40'
                      : 'cursor-not-allowed bg-white/5 text-slate-600',
                  ].join(' ')}
                  title={activeChar
                    ? `结束 ${activeChar.name} 的回合；下一回合恢复动作、附赠动作、反应与移动`
                    : '先选择你的角色'}
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  结束回合
                </button>
              )}

              {/* DM 工具 */}
              {isDM && (
                <>
                  <div className="mx-0.5 h-5 w-px bg-white/10" />
                  {/* 地图切换 */}
                  <select
                    value={activeMap.id}
                    onChange={(e) => {
                      select(e.target.value)
                      setSelectedTokenId(null)
                    }}
                    className="rounded-lg border border-white/10 bg-void-900/60 px-2 py-1 text-xs text-slate-200 outline-none focus:border-arcane-500 [&>option]:bg-void-900"
                  >
                    {maps.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
                    title="上传新地图"
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={() => updateMap(activeMap.id, { showGrid: !activeMap.showGrid })}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeMap.showGrid ? 'bg-arcane-500/20 text-arcane-200' : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title={
                      activeMap.builtinGridDetected
                        ? `底图网格已识别 · ${activeMap.gridSize}px（叠加网格可手动开启）`
                        : '叠加网格开关'
                    }
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    {activeMap.builtinGridDetected ? (
                      <span className="text-[10px] text-emerald-300/90">底图✓</span>
                    ) : (
                      <span className="text-[10px] text-slate-500">未识别</span>
                    )}
                  </button>
                  <button
                    onClick={() => updateMap(activeMap.id, { showCoordinates: activeMap.showCoordinates === false })}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeMap.showCoordinates !== false
                        ? 'bg-sky-500/20 text-sky-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="显示/隐藏地图 X/Y 坐标轴"
                  >
                    <Grid3x3 className="h-3.5 w-3.5" />
                    XY
                  </button>
                  <button
                    onClick={() => void handleRedetectGrid()}
                    disabled={gridDetecting}
                    className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white/10 hover:text-slate-200 disabled:opacity-50"
                    title="重新分析当前地图底图是否自带网格"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${gridDetecting ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => {
                      setGridAdjustMode((v) => {
                        const next = !v
                        if (next) {
                          setMeasureMode(false)
                          setDeleteSelectMode(false)
                          setFogEditMode(false)
                        }
                        return next
                      })
                    }}
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      gridAdjustMode
                        ? 'bg-amber-500/25 text-amber-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="拖拽平移网格对齐底图；方向键微调（Shift=5px）"
                  >
                    <Move className="h-3.5 w-3.5" />
                    移动网格
                  </button>
                  <button
                    onClick={() =>
                      updateMap(activeMap.id, {
                        snapMonstersToGrid: activeMap.snapMonstersToGrid === false,
                      })
                    }
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      activeMap.snapMonstersToGrid !== false
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="开启：敌人吸附格心、测距对齐格子；关闭：自由放置、测距任意两点"
                  >
                    <Magnet className="h-3.5 w-3.5" />
                    吸附
                  </button>
                  <div
                    className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1"
                    title="格宽=屏幕上每格像素（对齐底图）；1 格固定 5 尺"
                  >
                    <SlidersHorizontal className="h-3 w-3 text-slate-500" />
                    <span className="text-[10px] text-slate-500">格宽</span>
                    <input
                      type="range"
                      min={gridSizeBounds(activeMap).min}
                      max={gridSizeBounds(activeMap).max}
                      value={clampGridSize(activeMap.gridSize, activeMap)}
                      onPointerDown={() => setGridSizePreview(true)}
                      onPointerUp={() => setGridSizePreview(false)}
                      onPointerLeave={() => setGridSizePreview(false)}
                      onChange={(e) =>
                        updateMap(activeMap.id, {
                          gridSize: clampGridSize(Number(e.target.value), activeMap),
                        })
                      }
                      className="w-16 accent-arcane-500"
                    />
                    <input
                      type="number"
                      min={gridSizeBounds(activeMap).min}
                      max={gridSizeBounds(activeMap).max}
                      value={clampGridSize(activeMap.gridSize, activeMap)}
                      onFocus={() => setGridSizePreview(true)}
                      onBlur={() => setGridSizePreview(false)}
                      onChange={(e) =>
                        updateMap(activeMap.id, {
                          gridSize: clampGridSize(Number(e.target.value) || activeMap.gridSize, activeMap),
                        })
                      }
                      className="w-10 rounded border border-white/10 bg-void-900/60 px-1 py-0.5 text-center text-xs text-slate-200 outline-none focus:border-arcane-500"
                    />
                    <span className="text-[10px] text-slate-500">px·5尺/格</span>
                    <span className="mx-0.5 h-4 w-px bg-white/10" />
                    <input
                      type="color"
                      value={activeMap.gridColor ?? '#c4b5fd'}
                      onPointerDown={() => setGridSizePreview(true)}
                      onPointerUp={() => setGridSizePreview(false)}
                      onChange={(e) => {
                        setGridSizePreview(true)
                        updateMap(activeMap.id, { gridColor: e.target.value })
                      }}
                      className="h-6 w-6 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                      title="叠加网格颜色"
                    />
                    <input
                      type="range"
                      min={0.08}
                      max={0.85}
                      step={0.02}
                      value={activeMap.gridOpacity ?? 0.28}
                      onChange={(e) =>
                        updateMap(activeMap.id, { gridOpacity: Number(e.target.value) })
                      }
                      onPointerDown={() => setGridSizePreview(true)}
                      onPointerUp={() => setGridSizePreview(false)}
                      className="w-10 accent-arcane-500"
                      title="网格透明度"
                    />
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-amber-400/15 bg-amber-500/[0.05] px-1 py-0.5" title="临时桌面协作标记，不写入永久地图几何或战争迷雾">
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('focus')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'focus' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="点击地图，把全员视角聚焦到该处"
                    >
                      <LocateFixed className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('arrow')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'arrow' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="拖动画临时箭头"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMapTabletopTool('circle')}
                      className={`rounded-md p-1.5 ${mapTabletopTool === 'circle' ? 'bg-amber-500/25 text-amber-100' : 'text-slate-400 hover:bg-white/10'}`}
                      title="从圆心向外拖动画临时圈选"
                    >
                      <CircleIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={activeMapTabletop.annotations.length === 0}
                      onClick={() => void clearMapTabletopAnnotations(activeMap.id)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-rose-200 disabled:opacity-30"
                      title="清除当前地图的全部临时标注"
                    >
                      <Eraser className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-1 text-[10px] text-amber-200/70">双击 Ping</span>
                  </div>
                  {activeGeometry && (
                    <MapGeometryToolbar
                      mapId={activeMap.id}
                      geometry={activeGeometry}
                      selectedEntity={selectedGeometryEntity}
                      selectedToken={selectedToken}
                      editMode={geometryEditMode}
                      tool={geometryTool}
                      wallMaterial={geometryWallMaterial}
                      previewAsPlayer={geometryPreviewAsPlayer}
                      snapToGrid={geometrySnapToGrid}
                      onEditModeChange={(enabled) => {
                        setGeometryEditMode(enabled)
                        if (enabled) {
                          setMeasureMode(false)
                          setDeleteSelectMode(false)
                          setGridAdjustMode(false)
                          setFogEditMode(false)
                          setFogPreviewAsPlayer(false)
                          setShowMoveRange(false)
                        } else {
                          setGeometryPreviewAsPlayer(false)
                          selectGeometryEntity(null)
                        }
                      }}
                      onToolChange={(nextTool) => {
                        setGeometryTool(nextTool)
                        selectGeometryEntity(null)
                      }}
                      onWallMaterialChange={setGeometryWallMaterial}
                      onPreviewChange={setGeometryPreviewAsPlayer}
                      onSnapToGridChange={setGeometrySnapToGrid}
                    />
                  )}
                  <MapFogToolbar
                    mapId={activeMap.id}
                    fog={activeFog}
                    redoCount={fogRedoByMap[activeMap.id]?.length ?? 0}
                    editMode={fogEditMode}
                    tool={fogTool}
                    previewAsPlayer={fogPreviewAsPlayer}
                    onEditModeChange={(enabled) => {
                      setFogEditMode(enabled)
                      if (enabled) {
                        setMeasureMode(false)
                        setDeleteSelectMode(false)
                        setGridAdjustMode(false)
                        setShowMoveRange(false)
                        setGeometryEditMode(false)
                        setGeometryPreviewAsPlayer(false)
                        selectGeometryEntity(null)
                      } else {
                        setFogPreviewAsPlayer(false)
                      }
                    }}
                    onToolChange={setFogTool}
                    onFill={fillFog}
                    onClear={clearFog}
                    onUndo={undoFog}
                    onRedo={redoFog}
                    onPreviewChange={setFogPreviewAsPlayer}
                    onStyleChange={setFogStyle}
                  />
                  <button
                    onClick={() =>
                      setMeasureMode((v) => {
                        const next = !v
                        if (next) {
                          setGridAdjustMode(false)
                          setDeleteSelectMode(false)
                          setFogEditMode(false)
                          setGeometryEditMode(false)
                          setGeometryPreviewAsPlayer(false)
                        }
                        return next
                      })
                    }
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      measureMode ? 'bg-ember-500/25 text-ember-400' : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title="测距：点 A 点 B；右键/Backspace 删除"
                  >
                    <Ruler className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() =>
                      setDeleteSelectMode((v) => {
                        const next = !v
                        if (next) {
                          setMeasureMode(false)
                          setGridAdjustMode(false)
                          setFogEditMode(false)
                          setAoePreviewCell(null)
                          setShowMoveRange(false)
                        }
                        return next
                      })
                    }
                    className={[
                      'flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                      deleteSelectMode
                        ? 'bg-rose-500/25 text-rose-200'
                        : 'text-slate-400 hover:bg-white/5',
                    ].join(' ')}
                    title={combatActive ? '框选删除：战斗中只删除障碍物，右键取消' : '框选删除：拖拽选框删除单位/障碍物，右键取消'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    框删
                  </button>

                  <label className="flex items-center gap-1 rounded-lg bg-arcane-500/15 px-2 py-1 text-xs font-medium text-arcane-200">
                    <UserPlus className="h-3.5 w-3.5" />
                    <select
                      value=""
                      onChange={(e) => {
                        const ch = characters.find((c) => c.id === e.target.value)
                        if (ch) addCharacterToken(activeMap.id, { characterId: ch.id, name: ch.name, emoji: ch.avatar })
                        e.target.value = ''
                      }}
                      className="cursor-pointer bg-transparent text-xs text-arcane-200 outline-none [&>option]:bg-void-900 [&>option]:text-slate-200"
                    >
                      <option value="">角色…</option>
                      {placeableCharacters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => addToken(activeMap.id, 'enemy')}
                    className="flex items-center gap-1 rounded-lg bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/25"
                    title="放置空白敌人占位符"
                  >
                    <Skull className="h-3.5 w-3.5" />
                    敌人
                  </button>
                  <button
                    onClick={() => openEnemyPool('add')}
                    className="flex items-center gap-1 rounded-lg bg-rose-500/25 px-2 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/35"
                    title="从怪物池选择并添加"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    添加怪物
                  </button>
                  <button
                    onClick={() => addToken(activeMap.id, 'npc')}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
                  >
                    <User className="h-3.5 w-3.5" />
                    NPC
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`删除地图「${activeMap.name}」？`)) removeMap(activeMap.id)
                    }}
                    className="flex items-center rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                    title="删除当前地图"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              <button
                onClick={() => setShowBar(false)}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-slate-200"
                title="隐藏控制栏"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {combatActive && initiativeOrder.length > 0 && (
              <InitiativeTracker
                entries={displayInitiativeOrder}
                activeIndex={initiativeIndex}
                scrollOffset={initiativeScroll}
                round={round}
                hpByToken={hpByToken}
                defeatedTokenIds={defeatedTokenIds}
                onScroll={setInitiativeScroll}
                onSelect={(tokenId) => handleSelectToken(tokenId)}
              />
            )}
            </div>
          ) : (
            <button
              onClick={() => setShowBar(true)}
              className="glass absolute right-2 top-2 z-30 flex h-9 items-center gap-1 rounded-xl px-3 text-xs font-medium text-slate-300 shadow-xl hover:text-arcane-200"
              title="显示控制栏"
            >
              <ChevronUp className="h-4 w-4 rotate-180" />
              控制栏
            </button>
          )}

          {/* token 编辑浮层（DM，选中棋子时） */}
          {/* DM token editing is handled inside EnemyDetailPanel. */}

          {selectedToken &&
            canShowEnemyDetail(selectedToken) &&
            (isDM || (selectedToken.showDetailOnToken !== false && enemyDetailOpen)) && (
            <EnemyDetailPanel
              token={selectedToken}
              closable={!isDM}
              isDM={isDM}
              mapId={activeMap.id}
              characters={characters}
              updateToken={updateToken}
              updateChar={updateChar}
              removeToken={removeToken}
              canManageConditions={canDmManageConditions}
              conditionSourceOptions={conditionSourceOptions}
              onConditionsChange={(conditions, activeEffects) => applyDmConditionLabels(selectedToken, conditions, activeEffects)}
              onClose={() => {
                setSelectedTokenId(null)
                setEnemyDetailOpen(false)
              }}
            />
          )}

          {selectedCharacterToken && selectedCharacter && (
            <CharacterDetailPanel
              token={selectedCharacterToken}
              character={selectedCharacter}
              mapId={activeMap.id}
              updateToken={updateToken}
              updateChar={updateChar}
              isDM={isDM}
              canManageConditions={canDmManageConditions}
              conditionSourceOptions={conditionSourceOptions}
              onConditionsChange={(conditions, activeEffects) => applyDmConditionLabels(selectedCharacterToken, conditions, activeEffects)}
              onClose={() => setSelectedCharacterTokenId(null)}
            />
          )}

          {effectDetailToken ? (
            <Dnd5eActiveEffectDetailsDialog
              targetName={effectDetailCharacter?.name ?? effectDetailToken.label}
              effects={effectDetailEffects}
              onClose={() => setEffectDetailTokenId(null)}
            />
          ) : null}

          {/* 左侧角色轨：圆形头像 + 物品/特性/法术/技能图标 */}
          {railChars.length > 0 && (
            <div className="absolute bottom-3 left-3 z-30 flex flex-col-reverse gap-3">
              {railChars.map((c) => (
                <CharacterRailEntry
                  key={c.id}
                  character={c}
                  isActive={c.id === activeCharId}
                  activePanel={c.id === activeCharId ? charPanel : null}
                  onAvatarClick={() => {
                    if (playerCombatLocked) return
                    onAvatarClick(c.id)
                  }}
                  onPanelClick={(panel) => {
                    if (playerCombatLocked) return
                    onPanelClick(c.id, panel)
                  }}
                />
              ))}
            </div>
          )}

          {/* 底部浮层：按图标打开物品/特性/法术/技能栏 */}
          {activeChar && charPanel && !playerCombatLocked && (
            <div
              className={[
                'absolute bottom-2 left-24 z-20 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-void-900/40 p-2 pr-4 pt-3 shadow-2xl backdrop-blur-sm',
                panelFull ? 'right-2' : '',
              ].join(' ')}
              style={
                panelFull
                  ? { top: '18%', bottom: 8, left: 96, right: 8 }
                  : { width: panelWidth, height: panelHeight }
              }
            >
              <div
                onMouseDown={startResizeHeight}
                className="absolute inset-x-0 top-0 z-10 flex h-3 cursor-ns-resize items-center justify-center rounded-t-2xl hover:bg-white/5"
                title="拖动上沿调整高度"
              >
                <GripHorizontal className="h-3 w-8 text-slate-500 opacity-70" />
              </div>

              <div className="mb-1.5 flex shrink-0 flex-wrap items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br text-sm ${activeChar.accent}`}>
                  {activeChar.avatar}
                </span>
                <span className="text-sm font-semibold text-slate-100 drop-shadow">{activeChar.name}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                  {CHAR_PANEL_TITLES[charPanel]}
                </span>
                <ClassResourceIndicators character={activeChar} compact />
                <button
                  onClick={handlePlayerEndTurn}
                  data-testid="player-end-turn"
                  disabled={!!pendingPlayerAction || !combatActive || !canControlPlayerTurn}
                  className="ml-auto flex items-center gap-1 rounded-lg bg-arcane-500/20 px-2 py-1 text-xs font-medium text-arcane-100 hover:bg-arcane-500/30"
                  title="结束当前回合"
                >
                  <SkipForward className="h-3.5 w-3.5" />
                  结束回合
                </button>
                <button
                  onClick={() => setPanelFull((v) => !v)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10"
                  title={panelFull ? '还原宽度' : '铺满屏幕'}
                >
                  {panelFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={closeCharDock}
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10"
                  title="收起面板"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1">
                {charPanel === 'inventory' && (
                  <MapInventoryPanel
                    charId={activeChar.id}
                    pending={!!pendingPlayerAction}
                    onUseItem={combatActive ? sendDnd5eItemUseRequest : undefined}
                  />
                )}
                {charPanel === 'features' && (
                  <p className="rounded-xl border border-white/10 bg-void-950/50 p-4 text-sm leading-6 text-slate-300">
                    D&amp;D 5e 职业特性的主动操作已统一放在“技能”页；被动特性由 Headless 自动结算。
                  </p>
                )}
                {charPanel === 'spells' && (
                  <MapSpellsPanel
                    charId={activeChar.id}
                    canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                    pending={!!pendingPlayerAction}
                    targetingSpellId={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.spellId : undefined}
                    targetingTargetCount={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.targetTokenIds.length : 0}
                    targetingMaximumTargets={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.maximumTargets : 1}
                    targetingAllowsDuplicateTargets={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.allowDuplicateTargets}
                    targetingRequiresExactTargets={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.metamagic?.kind === 'twinned'}
                    targetingAllowsEmptyArea={dnd5eSpellTargeting?.characterId === activeChar.id &&
                      getDnd5eSrdCombatSpell(dnd5eSpellTargeting.spellId)?.effect === 'persistent-area' && !!aoePreviewCell}
                    targetingCanSculpt={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.canSculpt}
                    targetingSculptedCount={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.sculptedTargetIds.length : 0}
                    targetingMaximumSculptedTargets={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.maximumSculptedTargets : 0}
                    targetingSculpting={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.sculpting}
                    targetingCanCareful={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.metamagic?.kind === 'careful'}
                    targetingCarefulCount={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.carefulTargetIds.length : 0}
                    targetingMaximumCarefulTargets={dnd5eSpellTargeting?.characterId === activeChar.id ? dnd5eSpellTargeting.maximumCarefulTargets : 0}
                    targetingCarefulSelecting={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.carefulSelecting}
                    targetingCanHeightened={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.metamagic?.kind === 'heightened'}
                    targetingHeightenedSelected={dnd5eSpellTargeting?.characterId === activeChar.id && !!dnd5eSpellTargeting.heightenedTargetId}
                    targetingHeightenedSelecting={dnd5eSpellTargeting?.characterId === activeChar.id && dnd5eSpellTargeting.heightenedSelecting}
                    movablePersistentAreas={(activeMap?.dnd5ePluginAreas ?? []).flatMap((area) =>
                      area.sourceKind === 'core-spell' && area.sourceCharacterId === activeChar.id && area.movement
                        ? [{
                            id: area.id,
                            label: area.label,
                            economy: area.movement.economy,
                            maximumFeet: area.movement.maximumFeet,
                          }]
                        : [],
                    )}
                    movingPersistentAreaId={dnd5eCoreAreaMoveTargeting?.characterId === activeChar.id
                      ? dnd5eCoreAreaMoveTargeting.areaId
                      : undefined}
                    onMovePersistentArea={(areaId) => {
                      const area = activeMap?.dnd5ePluginAreas?.find((candidate) => candidate.id === areaId)
                      const declaration = area?.coreSpellId
                        ? getDnd5eCoreSpellAreaDeclaration(area.coreSpellId)
                        : undefined
                      if (!area?.movement || !area.anchorCell || !declaration) return
                      const movement = area.movement
                      const originCell = { col: area.anchorCell.col, row: area.anchorCell.row }
                      setDnd5eSpellTargeting(null)
                      setDnd5eCoreAreaMoveTargeting((current) => current?.areaId === areaId
                        ? null
                        : {
                            characterId: activeChar.id,
                            areaId,
                            targeting: {
                              ...declaration.template,
                              placeRangeFeet: movement.maximumFeet,
                            } as SkillAoeTargeting,
                            originCell,
                          })
                      setAoePreviewCell(originCell)
                    }}
                    onConfirmSpellTargets={submitSelectedDnd5eSpellTargets}
                    onUndoSpellTarget={undoLastDnd5eSpellTarget}
                    onToggleSculptSpellTargets={toggleDnd5eSculptSpellTargets}
                    onToggleCarefulSpellTargets={toggleDnd5eCarefulSpellTargets}
                    onToggleHeightenedSpellTarget={toggleDnd5eHeightenedSpellTarget}
                    onRequestAdjudication={(spellId, slotLevel, castingClassId) => {
                      setDnd5eSpellTargeting(null)
                      setDnd5eWeaponTargeting(null)
                      setDnd5eWeaponAttackOptions(undefined)
                      const payload: Dnd5eAdjudicatedSpellPayload = { spellId, slotLevel, castingClassId }
                      if (isDM) sendDmLocalDnd5eAdjudicatedSpellRequest(payload)
                      else sendPlayerDnd5eAdjudicatedSpellRequest(payload)
                    }}
                    onCastSpell={(spellId, slotLevel, castingClassId, options) => {
                      setDnd5eWeaponTargeting(null)
                      setDnd5eWeaponAttackOptions(undefined)
                      const pluginSpell = dnd5ePluginSpellDefinition(spellId)
                      if (pluginSpell) {
                        setAoePreviewCell(null)
                        const casterToken = activeMap?.tokens.find((token) => token.characterId === activeChar.id)
                        if (pluginSpell.range.type === 'self' && casterToken) {
                          const payload: Dnd5eSpellCastPayload = { spellId, slotLevel, castingClassId, targetTokenId: casterToken.id }
                          if (isDM) sendDmLocalDnd5eSpellCastRequest(payload)
                          else sendPlayerDnd5eSpellCastRequest(payload)
                          setDnd5eSpellTargeting(null)
                          return
                        }
                        setDnd5eSpellTargeting((current) => current?.characterId === activeChar.id && current.spellId === spellId
                          ? null
                          : {
                              characterId: activeChar.id, castingClassId, spellId, slotLevel, maximumTargets: 1,
                              allowDuplicateTargets: false, targetTokenIds: [], overchannel: false, empowered: false,
                              draconicResistance: false, repellingBlast: false, canSculpt: false,
                              maximumSculptedTargets: 0, sculptedTargetIds: [], sculpting: false,
                              maximumCarefulTargets: 0, carefulTargetIds: [], carefulSelecting: false,
                              heightenedTargetId: undefined, heightenedSelecting: false,
                            })
                        return
                      }
                      const spell = getDnd5eSrdCombatSpell(spellId)!
                      let conditionChoice: 'blinded' | 'deafened' | 'paralyzed' | 'poisoned' | 'disease' | undefined
                      let effectDamageType: NonNullable<Dnd5eSpellCastPayload['effectDamageType']> | undefined
                      let higherSlotDamageType: Dnd5eDamageType | undefined
                      if (spell.id === 'blindness-deafness') {
                        const selected = window.prompt('选择法术效果：输入 1 造成目盲，输入 2 造成耳聋。', '1')
                        if (selected == null) return
                        if (selected !== '1' && selected !== '2') {
                          void showCombatNotice('法术选项无效', '目盲/耳聋术只能选择目盲或耳聋。', 'amber')
                          return
                        }
                        conditionChoice = selected === '1' ? 'blinded' : 'deafened'
                      } else if (spell.id === 'lesser-restoration') {
                        const selected = window.prompt(
                          '选择要结束的效果：1 目盲、2 耳聋、3 麻痹、4 中毒、5 疾病。',
                          '1',
                        )
                        const choices = ['blinded', 'deafened', 'paralyzed', 'poisoned', 'disease'] as const
                        const selectedIndex = Number(selected) - 1
                        if (selected == null) return
                        if (!Number.isInteger(selectedIndex) || !choices[selectedIndex]) {
                          void showCombatNotice('法术选项无效', '次级复原术需要选择一种可结束的疾病或状态。', 'amber')
                          return
                        }
                        conditionChoice = choices[selectedIndex]
                      }
                      if (spell.id === 'protection-from-energy') {
                        const selected = window.prompt(
                          '选择抗性：1 强酸、2 寒冷、3 火焰、4 闪电、5 雷鸣。',
                          '3',
                        )
                        const choices = ['acid', 'cold', 'fire', 'lightning', 'thunder'] as const
                        const selectedIndex = Number(selected) - 1
                        if (selected == null) return
                        if (!Number.isInteger(selectedIndex) || !choices[selectedIndex]) {
                          void showCombatNotice('法术选项无效', '防护能量伤害必须选择一种规则允许的伤害类型。', 'amber')
                          return
                        }
                        effectDamageType = choices[selectedIndex]
                      }
                      if (spell.id === 'flame-strike' && slotLevel > spell.level) {
                        const selected = window.prompt('焰击术升环伤害加入哪一种类型？输入 1 选择火焰，输入 2 选择光耀。', '1')
                        if (selected == null) return
                        if (selected !== '1' && selected !== '2') {
                          void showCombatNotice('法术选项无效', '焰击术升环必须选择火焰伤害或光耀伤害。', 'amber')
                          return
                        }
                        higherSlotDamageType = selected === '1' ? 'fire' : 'radiant'
                      }
                      const casterToken = activeMap?.tokens.find((token) => token.characterId === activeChar.id)
                      if (spell.rangeFeet === 0 && spell.target === 'ally' && casterToken) {
                        const payload: Dnd5eSpellCastPayload = {
                          spellId,
                          castingClassId,
                          slotLevel,
                          targetTokenId: casterToken.id,
                          conditionChoice,
                          effectDamageType,
                          higherSlotDamageType,
                          overchannel: options?.overchannel,
                          metamagic: options?.metamagic,
                          empowered: options?.empowered,
                          draconicResistance: options?.draconicResistance,
                          repellingBlast: options?.repellingBlast,
                        }
                        if (isDM) sendDmLocalDnd5eSpellCastRequest(payload)
                        else sendPlayerDnd5eSpellCastRequest(payload)
                        setDnd5eSpellTargeting(null)
                        return
                      }
                      if (spell.area && activeMap) {
                        if (casterToken) setAoePreviewCell(pixelToCell(casterToken.x, casterToken.y, activeMap))
                      } else {
                        setAoePreviewCell(null)
                      }
                      const classDefinition = dnd5eClassDefinition(castingClassId)
                      const castingClassLevel = dnd5eCharacterClassLevel(activeChar, castingClassId)
                      const canSculpt = dnd5eCanSculptSpell({
                        classId: classDefinition?.id,
                        subclassId: classDefinition
                          ? activeChar.dnd5eClassChoices?.classes?.[classDefinition.id]?.subclass
                          : undefined,
                        level: castingClassLevel,
                      }, spell)
                      setDnd5eSpellTargeting((current) => current?.characterId === activeChar.id && current.spellId === spellId
                        ? null
                        : {
                            characterId: activeChar.id,
                            castingClassId,
                            spellId,
                            slotLevel,
                            maximumTargets: options?.metamagic?.kind === 'twinned'
                              ? 2
                              : dnd5eSpellMaximumTargets(spell, slotLevel, activeChar.level),
                            allowDuplicateTargets: dnd5eSpellAllowsRepeatedTargets(spell),
                            targetTokenIds: [],
                            overchannel: options?.overchannel === true,
                            empowered: options?.empowered === true,
                            draconicResistance: options?.draconicResistance === true,
                            repellingBlast: options?.repellingBlast === true,
                            canSculpt,
                            maximumSculptedTargets: canSculpt ? dnd5eSculptSpellMaximumTargets(spell) : 0,
                            sculptedTargetIds: [],
                            sculpting: false,
                            metamagic: options?.metamagic,
                            maximumCarefulTargets: options?.metamagic?.kind === 'careful'
                              ? dnd5eCarefulSpellMaximumTargets(activeChar.abilities.cha)
                              : 0,
                            carefulTargetIds: [],
                            carefulSelecting: false,
                            heightenedTargetId: undefined,
                            heightenedSelecting: false,
                            area: spell.area,
                            conditionChoice,
                            effectDamageType,
                            higherSlotDamageType,
                          })
                    }}
                  />
                )}
                {charPanel === 'skills' && <div className="space-y-3">
                  {isDM && combatActive && activeChar.dnd5eCombatState?.readiedAction && (
                    <section className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-200">待触发的准备动作</p>
                      <p className="mt-2 text-sm text-slate-100">{activeChar.dnd5eCombatState.readiedAction.trigger}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        内容：{activeChar.dnd5eCombatState.readiedAction.actionKind === 'attack' ? '攻击'
                          : activeChar.dnd5eCombatState.readiedAction.actionKind === 'move' ? '移动'
                            : activeChar.dnd5eCombatState.readiedAction.actionKind === 'interact-object' ? '物件交互' : '其他（DM 裁定）'}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleTriggerReadiedAction(activeChar.id)}
                        className="mt-3 w-full rounded-lg border border-amber-300/25 bg-amber-400/15 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/25"
                      >
                        条件已发生：触发并消耗反应
                      </button>
                    </section>
                  )}
                  <Dnd5eAbilityCheckPanel
                    character={activeChar}
                    canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                    pending={!!pendingPlayerAction}
                    turnEconomy={activeCharDnd5eTurnEconomy}
                    onCheck={(payload) => {
                      setDnd5eWeaponTargeting(null)
                      setDnd5eWeaponAttackOptions(undefined)
                      if (isDM) sendDmLocalDnd5eAbilityCheckRequest(payload)
                      else sendPlayerDnd5eAbilityCheckRequest(payload)
                    }}
                  />
                  {activeChar.charClass === '战士' ? (
                    <Dnd5eFighterCombatPanel
                      character={activeChar}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                      targeting={dnd5eWeaponTargeting === activeChar.id}
                      pending={!!pendingPlayerAction}
                      turnEconomy={activeCharDnd5eTurnEconomy}
                      basicActionTargets={activeCharDnd5eFeatureTargets}
                      onAttack={(options) => {
                        setDnd5eWeaponAttackConfirmation(null)
                        setDnd5eWeaponAttackOptions(options)
                        setDnd5eWeaponTargeting((current) => current === activeChar.id ? null : activeChar.id)
                      }}
                      onDisengage={handleDisengage}
                      onDodge={handleDodge}
                      onBasicAction={handleDnd5eBasicAction}
                      onFeature={(feature) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        if (isDM) sendDmLocalDnd5eFighterFeatureRequest(feature)
                        else sendPlayerDnd5eFighterFeatureRequest(feature)
                      }}
                    />
                  ) : (
                    <Dnd5eClassCombatPanel
                      character={activeChar}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                      targeting={dnd5eWeaponTargeting === activeChar.id}
                      pending={!!pendingPlayerAction}
                      turnEconomy={activeCharDnd5eTurnEconomy}
                      featureTargets={activeCharDnd5eFeatureTargets}
                      onAttack={(options) => {
                        setDnd5eWeaponAttackConfirmation(null)
                        setDnd5eWeaponAttackOptions(options)
                        setDnd5eWeaponTargeting((current) => current === activeChar.id ? null : activeChar.id)
                      }}
                      onDisengage={handleDisengage}
                      onDodge={handleDodge}
                      onBasicAction={handleDnd5eBasicAction}
                      onFeature={(payload) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        if (isDM) sendDmLocalDnd5eClassFeatureRequest(payload)
                        else sendPlayerDnd5eClassFeatureRequest(payload)
                      }}
                    />
                  )}
                  {activeMap && activeCharToken && (
                    <Dnd5ePluginCombatPanel
                      character={activeChar}
                      map={activeMap}
                      actorToken={activeCharToken}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                      pending={!!pendingPlayerAction}
                      turnEconomy={activeCharDnd5eTurnEconomy}
                      onAction={({ payload, targetTokenId }) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        if (isDM) sendDmLocalDnd5ePluginActionRequest(payload, targetTokenId)
                        else sendPlayerDnd5ePluginActionRequest(payload, targetTokenId)
                      }}
                      onBeginAreaTargeting={({ featureId, featureName, targeting }) => {
                        setDnd5eWeaponTargeting(null)
                        setDnd5eWeaponAttackOptions(undefined)
                        setDnd5eSpellTargeting(null)
                        setDnd5eItemAreaTargeting(null)
                        setDnd5eItemCreatureTargeting(null)
                        setDnd5ePluginAreaTargeting({
                          characterId: activeChar.id,
                          featureId,
                          featureName,
                          targeting,
                        })
                        setAoePreviewCell(null)
                      }}
                    />
                  )}
                </div>}
              </div>

              {!panelFull && (
                <div
                  onMouseDown={startResizeWidth}
                  className="absolute inset-y-0 right-0 flex w-3 cursor-ew-resize items-center justify-center rounded-r-2xl hover:bg-white/5"
                  title="拖动右沿调整宽度"
                >
                  <GripVertical className="h-5 w-5 text-slate-500" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isDM && combatExperienceDraft && (
        <CombatExperienceSettlementDialog
          draft={combatExperienceDraft}
          busy={combatExperienceBusy}
          onSettle={settleEndedCombatExperience}
        />
      )}

      {isDM && (
        <EnemyPoolPicker
          open={enemyPoolOpen}
          title={enemyPoolMode === 'add' ? '添加怪物' : '更换怪物'}
          canManageCustom
          hint={
            enemyPoolMode === 'add'
              ? '从完整 SRD 5.1 目录或房间自定义目录中选择，并放置到地图中央'
              : selectedToken
                ? `为「${selectedToken.label}」选择新种类`
                : undefined
          }
          onClose={() => setEnemyPoolOpen(false)}
          onPick={handleEnemyPoolPick}
          onBuildEncounter={enemyPoolMode === 'add' ? handleEncounterBuild : undefined}
        />
      )}
    </div>
  )
}
