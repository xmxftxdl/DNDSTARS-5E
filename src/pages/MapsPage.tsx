import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  Map as MapIcon,
  Upload,
  Grid3x3,
  Trash2,
  Skull,
  User,
  X,
  Crown,
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
  Footprints,
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import MapCanvas from '../components/map/MapCanvas'
import type { DeleteSelectionRect, MapProjectile } from '../components/map/MapCanvas'
import InitiativeTracker, {
  INITIATIVE_VISIBLE_MAX,
  type InitiativeEntry,
} from '../components/map/InitiativeTracker'
import SkillBar from '../components/character/SkillBar'
import type { InfiniteAction } from '../components/character/SkillBar'
import BulletMatchPanel from '../components/map/BulletMatchPanel'
import { isHeavyGunner } from '../lib/bulletMatch'
import FeaturesTab from '../components/character/FeaturesTab'
import CharacterRailEntry from '../components/map/CharacterRailEntry'
import { CHAR_PANEL_TITLES, type CharDockPanel } from '../components/map/characterRailConfig'
import QiIndicator from '../components/map/QiIndicator'
import MapInventoryPanel from '../components/map/MapInventoryPanel'
import MapSpellsPanel from '../components/map/MapSpellsPanel'
import EnemyPoolPicker from '../components/map/EnemyPoolPicker'
import EnemyDetailPanel from '../components/map/EnemyDetailPanel'
import { canShowEnemyDetail } from '../components/map/enemyDetailPanelUtils'
import CharacterDetailPanel from '../components/map/CharacterDetailPanel'
import DiceRollOverlay from '../components/DiceRollOverlay'
import type { DiceRoll } from '../components/DiceRollOverlay'
import DiceBoxD20Overlay from '../components/DiceBoxD20Overlay'
import DiceBoxRollOverlay from '../components/DiceBoxRollOverlay'
import { useMapStore } from '../store/maps'
import type { BattleMap, Token } from '../store/maps'
import { useCharacterStore } from '../store/characters'
import {
  clearSharedEventBacklog,
  clearSharedResource,
  loadSharedResource,
  publishSharedEvent,
  saveSharedResource,
  subscribeSharedEvent,
} from '../lib/sharedApi'
import type { Character } from '../types/character'
import type { ClassFeatureKey, CombatSkill } from '../types/character'
import {
  canUseDoubleArrow,
  isBasicShot,
  findClassTrait,
} from '../lib/classFeatures'
import { isCalmMindActive, isOutOfBreath } from '../lib/calmMind'
import {
  agileLeapMoveFeet,
  canAttemptDodge,
  canOfferAgileLeap,
  canOfferGaleCombo,
  ENEMY_MELEE_ATTACK_BONUS,
  formatDodgePrompt,
} from '../lib/archerBaseFeatures'
import { TOKEN_STATUS_CLEAR_PATCH, isMovementLocked, isTokenMovementLocked } from '../lib/combatStatus'
import {
  attackDamageDiceCount,
  getEffectiveAbilityMod,
} from '../lib/archerCombat'
import {
  canSubmitPlayerCombatAction,
  preflightPlayerActionAuthority,
  reservePlayerActionExecution,
} from '../lib/playerActionAuthorityRouter'
import {
  buildArrowSequenceTargetPackets,
  buildAoeTargetPackets,
  buildPreparedAoeHeadlessAction,
  buildPreparedAttackHeadlessAction,
  buildSingleAttackTargetPacket,
  canResolveSingleAttackWithHeadless,
  planAoeAttackSettlement,
  planArrowSequenceSettlement,
  planSingleAttackSettlement,
  preparePlayerAoeAttackAction,
  preparePlayerAttackAction,
} from '../lib/playerAttackAction'
import {
  planPlayerMoveAfterOpportunity,
  planPlayerMoveAfterPreview,
  preparePlayerMoveAction,
  summarizeHeadlessPlayerMovePreview,
} from '../lib/playerMoveAction'
import {
  buildEnemyMoveAction,
  planEnemyMoveSettlement,
} from '../lib/enemyMoveAction'
import {
  planEnemyAttackApLog,
  planEnemyAttackSettlement,
} from '../lib/enemyAttackAction'
import {
  buildAgileLeapReadyAction,
  planAgileLeapReadySettlement,
} from '../lib/agileLeapAction'
import {
  buildGaleComboChoiceParams,
  planGaleComboChoiceSettlement,
} from '../lib/galeComboAction'
import {
  buildOpportunityAttackAction,
  planOpportunityAttackSettlement,
  shouldRollOpportunityDamage,
} from '../lib/opportunityAttackAction'
import {
  buildHeadlessEndTurnAction,
  clearCharacterScopedRecord,
  removeDisengagedCharacterId,
} from '../lib/playerEndTurnAction'
import {
  buildPlayerActionAck,
  persistPlayerActionProcessedState,
} from '../lib/playerActionAck'
import { publishPlayerActionAckWithSnapshots } from '../lib/playerActionAckPublish'
import {
  characterToCombatInput,
  damageModifierFromAttackDefenseDiff,
  formatCritDamagePercent,
  getAc,
  getAttackDefenseDiff,
  isMagicDamageSkill,
} from '../lib/combatStats'
import {
  CombatResolutionRunner,
  createCombatResolutionContext,
  type CombatMutation,
  type CombatResolutionSession,
  type CombatResolutionStage,
} from '../lib/combatResolutionPipeline'
import { executeCombatMutationsAuthority } from '../lib/combatAuthority'
import {
  resolveHeadlessGaleComboChoice,
  resolveHeadlessDmAction,
  startHeadlessCombat,
  type HeadlessCombatEvent,
  type HeadlessCombatResult,
  type HeadlessDmCombatState,
} from '../lib/headlessDmCombatEngine'
import {
  enemyAttackResolvedEvent,
} from '../lib/headlessCombatEvents'
import {
  createHeadlessCombatSnapshot,
  planHeadlessCombatResultApplication,
} from '../lib/headlessCombatBridge'
import {
  planHeadlessPlayerActionSettlement,
  tokenMovedEvent,
} from '../lib/headlessPlayerActionSettlement'
import {
  COMBAT_INTERRUPT_RESOURCE,
  createCombatInterrupt,
  type SharedCombatInterrupt,
  type SharedCombatInterruptQueueState,
} from '../lib/combatInterruptQueue'
import { resolveDmCombatInterruptSettlements } from '../lib/combatInterruptDmSettlement'
import {
  answerSharedCombatInterrupt as persistAnswerSharedCombatInterrupt,
  finishSharedCombatInterrupt as persistFinishSharedCombatInterrupt,
  markSharedCombatInterruptRolling as persistMarkSharedCombatInterruptRolling,
  publishSharedCombatInterrupt as persistPublishSharedCombatInterrupt,
} from '../lib/combatInterruptSync'
import {
  type AgileLeapInterruptPayload,
  type AgileLeapInterruptResponse,
  type DodgeInterruptPayload,
  type DodgeInterruptResponse,
  type GaleComboDecision,
  type GaleComboInterruptPayload,
  type GaleComboInterruptResponse,
  type OpportunityAttackInterruptPayload,
  type OpportunityAttackInterruptResponse,
  type StableMindInterruptPayload,
  type StableMindInterruptResponse,
} from '../lib/combatInterruptProtocol'
import {
  buildCombatInterruptPromptViews,
  resolveCombatInterruptPromptSelection,
  type SharedAgileLeapPromptView,
  type SharedDodgePromptView,
  type SharedGaleComboPromptView,
  type SharedOpportunityAttackPromptView,
  type SharedStableMindPromptView,
} from '../lib/combatInterruptPrompts'
import { enemyCombatInput, getTokenTargetAc } from '../lib/enemyCombatStats'
import { getEnemyStatBlock } from '../lib/enemyStatBlocks'
import {
  clampGridSize,
  cellKey,
  cellToPixel,
  gridSizeBounds,
  isWithinMovementRange,
  cellDistance,
  movementRadiusPx,
  occupiedCells,
  pixelToCell,
  snapTokenToGridCenter,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../lib/gridCombat'
import {
  aoeConfirmHint,
  aoeOrientFromCell,
  aoeUsesMouseAim,
  canPlaceAoe,
  isSelfOriginCircleAoe,
  cellsForAoe,
  formatAoeHint,
  getSkillAoeTargeting,
  type SkillAoeTargeting,
} from '../lib/skillTargeting'
import { applyGridDetectPatch, detectGridFromBlob, detectImageGrid } from '../lib/gridDetect'
import { getImage } from '../lib/imageStore'
import { clearEnemyAiWarnings, planEnemyTurn, type EnemyTurnResult } from '../lib/enemyAi'
import { decideDodge } from '../lib/aiPolicy'
import {
  checkCombatOutcome,
  decideTurnAction,
  hasActionableActor,
  isTokenAlive,
  isTokenDefeated,
  pruneInitiativeForToken,
  resolveEnemyAttackTokens,
} from '../lib/combatTokens'
import { enemyTemplateToTokenPatch, type EnemyTemplate } from '../lib/enemyPool'
import {
  getTokenAbilityMod,
  KNOCKBACK_STATUS_LABEL,
} from '../lib/knockback'
import { modeFromPort } from '../lib/appMode'
import {
  currentPlayerSlot,
  getAssignedPlayerCharacterId,
  getPlayerCharacter,
  playerViewCharacters,
  PLAYER_ASSIGNMENT_EVENT,
} from '../lib/playerView'
import { proficiencyBonus } from '../lib/dnd'
// [T15/G3] god-object 拆分：模块级类型/常量/纯 helper 搬到独立文件，行为不变，原样 import 回来。
import type {
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
  TOKEN_MOVE_MS,
  DICE_ROLL_MS,
  ADVANCE_DELAY_MS,
  ADVANCE_GUARD_MS,
  DEATH_KEY_WATCHDOG_MS,
} from './mapsPageConstants'
import {
  singleTargetRangeFeet,
  buildInitiativeOrder,
  tokenIntersectsDeleteRect,
  seededDieValue,
} from './mapsPageHelpers'
import {
  resolveSharedCombatStateApply,
} from '../lib/sharedCombatSync'
import { buildCombatMessageQueueReset } from '../lib/sharedCombatReset'
import { mergeSharedCombatLogEntries } from '../lib/sharedCombatLogSync'
import { resolveSharedDiceEventApply } from '../lib/sharedDiceSync'
import {
  consumePlayerActionAck,
  createSharedPlayerActionEnvelope,
  loadDmPlayerActionBatch,
  submitPlayerActionRequestWithLock,
  syncAuthoritativePlayerActionState,
  type SharedPlayerActionPatch,
} from '../lib/playerActionSync'
import {
  capturePlayerActionResultBaseline,
  type PlayerActionResultBaseline,
} from '../lib/playerActionResult'
import {
  buildPreparedFeatureActivationHeadlessAction,
  illusionDanceTargetLimit,
  preparePlayerFeatureActivationAction,
  shouldSendPlayerReadyFeatureToDm,
  uniqueFeatureTargetIds,
} from '../lib/playerFeatureActivation'
import {
  buildSimpleHeadlessPlayerAction,
  isSimpleHeadlessPlayerActionType,
} from '../lib/simpleHeadlessPlayerAction'
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
  const addObstacle = useMapStore((s) => s.addObstacle)
  const addEnemyFromPool = useMapStore((s) => s.addEnemyFromPool)
  const addCharacterToken = useMapStore((s) => s.addCharacterToken)
  const updateToken = useMapStore((s) => s.updateToken)
  const removeToken = useMapStore((s) => s.removeToken)

  const characters = useCharacterStore((s) => s.characters)
  const updateChar = useCharacterStore((s) => s.update)

  const forcedMode = modeFromPort()
  const [selectedMode, setSelectedMode] = useState<Mode | null>(() => {
    const saved = window.localStorage.getItem('stars-map-role')
    return saved === 'dm' || saved === 'player' ? saved : null
  })
  const mode = forcedMode ?? selectedMode
  const [combatActive, setCombatActive] = useState(false)
  const [playerCombatEndedLocked, setPlayerCombatEndedLocked] = useState(false)
  const [round, setRound] = useState(1)
  const [initiativeOrder, setInitiativeOrder] = useState<InitiativeEntry[]>([])
  const [initiativeIndex, setInitiativeIndex] = useState(0)
  const [initiativeScroll, setInitiativeScroll] = useState(0)
  const [enemyApByToken, setEnemyApByToken] = useState<Record<string, { current: number; max: number }>>({})
  const enemyApByTokenRef = useRef<Record<string, { current: number; max: number }>>({})
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([])
  const [combatLogOpen, setCombatLogOpen] = useState(false)
  const [projectiles, setProjectiles] = useState<MapProjectile[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [selectedCharacterTokenId, setSelectedCharacterTokenId] = useState<string | null>(null)
  const [activeCharId, setActiveCharId] = useState<string | null>(null)
  const [charPanel, setCharPanel] = useState<CharDockPanel | null>(null)
  const [playerAssignmentTick, setPlayerAssignmentTick] = useState(0)
  const [measureMode, setMeasureMode] = useState(false)
  const [deleteSelectMode, setDeleteSelectMode] = useState(false)
  const [showBar, setShowBar] = useState(true) // 顶部控件浮层是否显示
  const [gridDetecting, setGridDetecting] = useState(false)
  const [gridAdjustMode, setGridAdjustMode] = useState(false)
  const [gridSizePreview, setGridSizePreview] = useState(false)
  const [panelWidth, setPanelWidth] = useState(720)
  const [panelHeight, setPanelHeight] = useState(300)
  const [panelFull, setPanelFull] = useState(false)
  const [enemyPoolOpen, setEnemyPoolOpen] = useState(false)
  const [enemyPoolMode, setEnemyPoolMode] = useState<'add' | 'apply'>('add')
  const [enemyDetailOpen, setEnemyDetailOpen] = useState(true)
  const frameRef = useRef<HTMLDivElement>(null)

  // 释放伤害技能：等待选择目标
  const [targeting, setTargeting] = useState<{
    casterId: string
    skill: CombatSkill
    doubleArrow?: boolean
    aoe?: SkillAoeTargeting
    /** 疾风连击：本次释放免 AP */
    waiveAp?: boolean
  } | null>(null)
  const [featureTargeting, setFeatureTargeting] = useState<{
    featureKey: 'illusionDance'
    casterId: string
    maxTargets: number
    selectedTokenIds: string[]
  } | null>(null)
  const [aoePreviewCell, setAoePreviewCell] = useState<GridCell | null>(null)
  const [aoeRectRotation, setAoeRectRotation] = useState(0)
  const [roll, setRoll] = useState<DiceRoll | null>(null)
  const afterRollRef = useRef<(() => void) | null>(null)
  const afterRollCallbacksRef = useRef<(() => void)[]>([])
  const pendingDeathKeysRef = useRef(new Set<string>())
  const d20RequestCounterRef = useRef(0)
  const applyingSharedCombatRef = useRef(false)
  const advancingTurnRef = useRef(false)
  const orderedCombatPublishRef = useRef(false)
  const combatResolutionRunnerRef = useRef(new CombatResolutionRunner())
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
  // T-P2-398 (398-A): player-side self-render driven by the roll-request
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
    }, 22000)
    return () => window.clearTimeout(timer)
  }, [diceBoxRoll])

  // T-P2-398 (398-A): safety auto-clear for the roll-request self-render, in
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
  const [dodgePrompt, setDodgePrompt] = useState<{
    result: EnemyTurnResult
    targetChar: Character
    onComplete: () => void
  } | null>(null)
  const [sharedDodgePrompt, setSharedDodgePrompt] = useState<SharedDodgePromptView | null>(null)
  const [sharedStableMindPrompt, setSharedStableMindPrompt] = useState<SharedStableMindPromptView | null>(null)
  const [sharedGaleComboPrompt, setSharedGaleComboPrompt] = useState<SharedGaleComboPromptView | null>(null)
  const [sharedAgileLeapPrompt, setSharedAgileLeapPrompt] = useState<SharedAgileLeapPromptView | null>(null)
  const [sharedOpportunityAttackPrompt, setSharedOpportunityAttackPrompt] =
    useState<SharedOpportunityAttackPromptView | null>(null)
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
  const setCombatDialogLocked = (next: typeof combatDialogRef.current) => {
    combatDialogRef.current = next
    setCombatDialog(next)
  }
  const showCombatDialog = (input: {
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
    })
  const closeCombatDialog = (accepted: boolean) => {
    const current = combatDialogRef.current
    setCombatDialogLocked(null)
    current?.resolve(accepted)
  }
  const showCombatNotice = (title: string, message: string, tone: 'sky' | 'violet' | 'amber' | 'rose' = 'sky') =>
    showCombatDialog({ title, message, confirmText: '知道了', tone })
  const publishCombatInterrupt = async (interrupt: SharedCombatInterrupt) => {
    await persistPublishSharedCombatInterrupt({ loadSharedResource, saveSharedResource, interrupt })
  }
  const answerSharedCombatInterrupt = async (id: string, response: Record<string, unknown>) => {
    if (!activeMap) return
    await persistAnswerSharedCombatInterrupt({ loadSharedResource, saveSharedResource, mapId: activeMap.id, id, response })
  }
  const markSharedCombatInterruptRolling = async (id: string, response?: Record<string, unknown>) => {
    if (!activeMap) return
    await persistMarkSharedCombatInterruptRolling({
      loadSharedResource,
      saveSharedResource,
      mapId: activeMap.id,
      id,
      response,
    })
  }
  const finishSharedCombatInterrupt = async (id: string, response?: Record<string, unknown>) => {
    if (!activeMap) return
    await persistFinishSharedCombatInterrupt({
      loadSharedResource,
      saveSharedResource,
      mapId: activeMap.id,
      id,
      response,
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
  const resolvingSkillTargetRef = useRef<{ key: string; at: number } | null>(null)
  const [showMoveRange, setShowMoveRange] = useState(false)
  const clearPlayerCombatUI = () => {
    setShowMoveRange(false)
  }
  const [disengagedCharIds, setDisengagedCharIds] = useState<Set<string>>(() => new Set())
  const enemyAppliedKeysRef = useRef(new Set<string>())
  // [T1] dedupe set so the turn-driver doesn't stack multiple skip timers for the
  // same npc/obstacle slot across re-renders. Cleared on combat start/end.
  const nonActorSkippedKeysRef = useRef(new Set<string>())
  // [T3/C2] dedupe set for stun skips (same anti-stack purpose). Cleared on start/end.
  const stunSkippedKeysRef = useRef(new Set<string>())
  const enemyTurnTimersRef = useRef<number[]>([])
  const pendingSharedDodgeRef = useRef<{
    id: string
    result: EnemyTurnResult
    targetCharId: string
    onComplete: () => void
  } | null>(null)
  const pendingSharedStableMindRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useStableMind: boolean) => void
  } | null>(null)
  const pendingSharedGaleComboRef = useRef<{
    id: string
    casterCharId: string
    resolve: (decision: GaleComboDecision) => void
  } | null>(null)
  const pendingSharedAgileLeapRef = useRef<{
    id: string
    targetCharId: string
    resolve: (useAgileLeap: boolean) => void
  } | null>(null)
  const pendingSharedOpportunityAttackRef = useRef<{
    id: string
    attackerCharId: string
    resolve: (useOpportunityAttack: boolean) => void
  } | null>(null)
  const suppressedDodgePromptIdsRef = useRef(new Set<string>())
  const suppressedStableMindPromptIdsRef = useRef(new Set<string>())
  const suppressedGaleComboPromptIdsRef = useRef(new Set<string>())
  const suppressedAgileLeapPromptIdsRef = useRef(new Set<string>())
  const suppressedOpportunityAttackPromptIdsRef = useRef(new Set<string>())
  const playerActionSeqRef = useRef(0)
  const seenPlayerActionIdsRef = useRef(new Set<string>())
  const processedPlayerActionIdsRef = useRef(new Set<string>())
  const recentPlayerActionKeysRef = useRef(new Map<string, number>())
  const seenPlayerActionAckIdsRef = useRef(new Set<string>())
  const seenSharedDiceIdsRef = useRef(new Set<string>())
  // T-P2-398 (398-A): dedup roll-request by requestId (AC3) — same requestId
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
      !sharedDodgePrompt?.expiresAt &&
      !sharedStableMindPrompt?.expiresAt &&
      !sharedGaleComboPrompt?.expiresAt &&
      !sharedAgileLeapPrompt?.expiresAt &&
      !sharedOpportunityAttackPrompt?.expiresAt
    ) return
    const timer = window.setInterval(() => setSharedDodgeNow(runtimeNow()), 250)
    return () => window.clearInterval(timer)
  }, [
    sharedDodgePrompt?.id,
    sharedDodgePrompt?.expiresAt,
    sharedStableMindPrompt?.id,
    sharedStableMindPrompt?.expiresAt,
    sharedGaleComboPrompt?.id,
    sharedGaleComboPrompt?.expiresAt,
    sharedAgileLeapPrompt?.id,
    sharedAgileLeapPrompt?.expiresAt,
    sharedOpportunityAttackPrompt?.id,
    sharedOpportunityAttackPrompt?.expiresAt,
  ])

  useEffect(() => {
    enemyApByTokenRef.current = enemyApByToken
  }, [enemyApByToken])
  const multiStrikeHitsRef = useRef<Record<string, number>>({})
  const combatActiveRef = useRef(false)
  const playerActionResultBaselinesRef = useRef<Record<string, PlayerActionResultBaseline>>({})
  const previousCombatActiveRef = useRef(false)
  const roundRef = useRef(1)
  const initiativeIndexRef = useRef(0)
  const initiativeOrderRef = useRef<InitiativeEntry[]>([])

  useEffect(() => {
    combatActiveRef.current = combatActive
  }, [combatActive])

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
  ) => {
    const entry: CombatLogEntry = {
      id: runtimeNumericId(),
      round: roundOverride,
      text,
      kind,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    seenSharedLogIdsRef.current.add(entry.id)
    setCombatLog((current) => [entry, ...current].slice(0, 80))
    if (activeMap) {
      const mapId = activeMap.id
      combatLogSaveQueueRef.current = combatLogSaveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          const current = await loadSharedResource<SharedCombatLogState>('combat-log')
          const entries = current?.mapId === mapId ? current.entries ?? [] : []
          await saveSharedResource<SharedCombatLogState>('combat-log', {
            mapId,
            entries: [entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, 100),
            updatedAt: runtimeNow(),
          })
        })
      void combatLogSaveQueueRef.current
    }
  }

  const pushApLog = (
    character: Character | undefined,
    amount: number,
    action: string,
    detail?: string,
  ) => {
    if (!character) return
    const spentText = amount > 0 ? `花费 ${amount} AP` : '未消耗 AP'
    const remaining = Math.max(0, character.currentAP - amount)
    pushCombatLog(
      `${character.name} ${spentText}：${action}${detail ? `（${detail}）` : ''}。剩余 AP ${remaining}/${character.actionPoints}`,
      'turn',
    )
  }

  const galeComboUnavailableReason = (caster: Character) => {
    const trait = findClassTrait(caster, 'galeCombo')
    if (!trait) return '未学习疾风连击'
    if (trait.uses <= 0) return '疾风连击次数不足'
    if (caster.combatBuffs?.galeComboReady) return '疾风连击已就绪'
    return ''
  }

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

  // T-P2-398 (398-A): broadcast the decided result once. One logical event per
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

  const rollDiceBoxD20 = (label: string, targetName: string): Promise<number> => {
    const id = d20RequestCounterRef.current + 1
    d20RequestCounterRef.current = id
    const requestKey = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:d20:${runtimeNow()}:${id}:${label}:${targetName}`
    const flyIndex = seededDieValue(`${requestKey}:fly`, 8) - 1
    // T-P2-398 (398-A): decide the face up front so both ends @-relabel to the
    // same value. RNG moved from the iframe physics into JS — same uniform
    // distribution, now broadcastable.
    const value = randomDieValue(20)
    const rollRequestId = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:rr-d20:${runtimeNow()}:${id}`
    publishRollRequest({ requestId: rollRequestId, kind: 'd20', count: 1, sides: 20, values: [value], label, targetName })
    return new Promise((resolve) => {
      setDiceBoxD20({ id, label, targetName, value, requestKey, flyIndex, resolve })
    })
  }

  const rollDiceBoxValues = (
    count: number,
    sides: number,
    label: string,
    targetName: string,
  ): Promise<number[]> => {
    const id = diceBoxRollRequestCounterRef.current + 1
    diceBoxRollRequestCounterRef.current = id
    const safeCount = Math.max(1, Math.min(12, Math.round(count)))
    const safeSides = Math.max(2, Math.min(100, Math.round(sides)))
    const requestKey = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:dice:${runtimeNow()}:${id}:${safeCount}d${safeSides}:${label}:${targetName}`
    const flyIndex = seededDieValue(`${requestKey}:fly`, 8) - 1
    // T-P2-398 (398-A): decide faces up front (see rollDiceBoxD20) and broadcast.
    const values = Array.from({ length: safeCount }, () => randomDieValue(safeSides))
    const rollRequestId = `${mode ?? 'local'}:${activeMap?.id ?? 'map'}:rr-dice:${runtimeNow()}:${id}`
    publishRollRequest({ requestId: rollRequestId, kind: 'dice', count: safeCount, sides: safeSides, values, label, targetName })
    return new Promise((resolve) => {
      setDiceBoxRoll({ id, count: safeCount, sides: safeSides, label, targetName, values, requestKey, flyIndex, resolve })
    })
  }

  const publishSharedDiceRoll = (roll: DiceRoll) => {
    if (!activeMap || !mode) return
    const id = runtimeId()
    seenSharedDiceIdsRef.current.add(id)
    const event: SharedDiceState = {
      id,
      mapId: activeMap.id,
      sourceMode: mode,
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
    const seq = ++combatPublishSeqRef.current
    const state: SharedCombatState = {
      mapId: activeMap.id,
      combatId: combatIdRef.current,
      active: combatActive,
      round,
      initiativeIndex,
      initiativeOrder,
      enemyApByToken: enemyApByTokenRef.current,
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

  const applySharedCombatState = (state: SharedCombatState | null) => {
    if (!state || !activeMap || state.mapId !== activeMap.id) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === state.mapId) ?? activeMap
    const validTokenIds = new Set(latestMap.tokens.map((token) => token.id))
    const decision = resolveSharedCombatStateApply({
      state,
      mapId: activeMap.id,
      validTokenIds,
      currentCombatId: combatIdRef.current,
      currentEnemyApByToken: enemyApByTokenRef.current,
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
    enemyApByTokenRef.current = decision.enemyApByToken
    setEnemyApByToken(decision.enemyApByToken)
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
  const playerSlot = currentPlayerSlot()
  const assignedCharacterId = isDM ? null : getAssignedPlayerCharacterId(playerSlot)
  const activeMap = maps.find((m) => m.id === selectedId) ?? maps[0] ?? null
  const selectedToken = activeMap?.tokens.find((t) => t.id === selectedTokenId) ?? null
  const selectedCharacterToken = activeMap?.tokens.find((t) => t.id === selectedCharacterTokenId) ?? null
  const activeChar = characters.find((c) => c.id === activeCharId) ?? null

  const applyCombatMutationsFromHooks = (mutations: CombatMutation[]) => {
    if (!isDM || !activeMap || mutations.length === 0) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const beforeCharacters = useCharacterStore.getState().characters
    const beforeCharactersById = new Map(beforeCharacters.map((character) => [character.id, character]))
    const beforeTokensById = new Map(latestMap.tokens.map((token) => [token.id, token]))
    const result = executeCombatMutationsAuthority(
      {
        characters: beforeCharacters,
        enemyApByToken: enemyApByTokenRef.current,
        map: latestMap,
      },
      { role: 'dm', mutations },
    )

    for (const character of result.state.characters) {
      const before = beforeCharactersById.get(character.id)
      if (!before || JSON.stringify(before) !== JSON.stringify(character)) {
        updateChar(character.id, character)
      }
    }

    for (const token of result.state.map.tokens) {
      const before = beforeTokensById.get(token.id)
      if (!before || JSON.stringify(before) !== JSON.stringify(token)) {
        updateToken(result.state.map.id, token.id, token)
      }
    }

    if (JSON.stringify(enemyApByTokenRef.current) !== JSON.stringify(result.state.enemyApByToken)) {
      enemyApByTokenRef.current = result.state.enemyApByToken
      setEnemyApByToken(result.state.enemyApByToken)
    }

    for (const entry of result.logs) pushCombatLog(entry.text, entry.kind)
    for (const failure of result.failures) {
      pushCombatLog(`结算变更未执行：${failure.mutation.type} (${failure.reason})`, 'system')
    }
  }

  const createCombatResolutionSessionForAction = (input: {
    actorToken?: Token
    targetToken?: Token
    actorCharacterId?: string
    targetCharacterId?: string
    skill?: CombatSkill
    tags?: string[]
  }): CombatResolutionSession | null => {
    if (!activeMap || !input.actorToken) return null
    return combatResolutionRunnerRef.current.createSession(
      createCombatResolutionContext({
        round: roundRef.current,
        map: activeMap,
        characters: useCharacterStore.getState().characters,
        actor: {
          tokenId: input.actorToken.id,
          characterId: input.actorCharacterId ?? input.actorToken.characterId,
        },
        primaryTarget: input.targetToken
          ? {
              tokenId: input.targetToken.id,
              characterId: input.targetCharacterId ?? input.targetToken.characterId,
            }
          : undefined,
        skill: input.skill,
        tags: input.tags,
      }),
    )
  }

  const runCombatResolutionStage = async (
    session: CombatResolutionSession | null,
    stage: CombatResolutionStage,
  ) => {
    if (!session) return
    const latestMap = activeMap
      ? useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
      : session.context.map
    session.context.round = roundRef.current
    session.context.map = latestMap
    session.context.characters = useCharacterStore.getState().characters
    const mutationStart = session.mutations.length
    const result = await combatResolutionRunnerRef.current.runStage(session, stage)
    applyCombatMutationsFromHooks(result.mutations.slice(mutationStart))
  }

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
      // [T8/AC1 · D1] 选框删除若命中当前选中 token，立即清空选中态（守卫 effect 之外的显式清理）。
      if (selectedTokenId && tokenIds.includes(selectedTokenId)) setSelectedTokenId(null)
      tokenIds.forEach((tokenId) => removeToken(activeMap.id, tokenId))
    }
    setDeleteSelectMode(false)
  }

  useEffect(() => {
    if (!activeMap) return
    let cancelled = false
    const load = async () => {
      if (cancelled) return
      await useMapStore.getState().loadShared()
    }
    void load()
    const timer = window.setInterval(load, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeMap?.id])

  useEffect(() => {
    if (!activeMap) return
    if (mode === 'dm' && combatActive) return
    let cancelled = false
    const load = async () => {
      const state = await loadSharedResource<SharedCombatState>('combat')
      if (!cancelled) applySharedCombatState(state)
    }
    void load()
    const timer = window.setInterval(load, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeMap?.id, mode, combatActive])

  // T-P2-398 (398-A): subscribe to the result-broadcast channel and self-render
  // the decided @values locally.
  useEffect(() => {
    if (!activeMap || !mode) return
    const sourceMode = mode === 'dm' ? 'player' : 'dm'
    const unsubscribe = subscribeSharedEvent<SharedRollRequestEvent>(
      `dice-roll-request-${sourceMode}-to-${mode}`,
      (event) => {
        if (
          !event ||
          event.mapId !== activeMap.id ||
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
  }, [activeMap?.id, mode])

  useEffect(() => {
    if (!activeMap || !mode) return
    let cancelled = false
    const applyDiceEvent = (state: SharedDiceState) => {
      if (cancelled) return
      const decision = resolveSharedDiceEventApply({
        state,
        mapId: activeMap.id,
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
      if (!cancelled && eventState?.mapId === activeMap.id) {
        for (const event of eventState.events ?? []) applyDiceEvent(event)
        return
      }
      const state = await loadSharedResource<SharedDiceState>('dice')
      if (state) applyDiceEvent(state)
    }
    void load()
    const timer = window.setInterval(load, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeMap?.id, mode])

  useEffect(() => {
    if (!activeMap) return
    let cancelled = false
    const load = async () => {
      const state = await loadSharedResource<SharedCombatLogState>('combat-log')
      if (cancelled || !state || state.mapId !== activeMap.id) return
      const incoming = (state.entries ?? []).filter((entry) => !seenSharedLogIdsRef.current.has(entry.id))
      if (incoming.length === 0) return
      for (const entry of incoming) seenSharedLogIdsRef.current.add(entry.id)
      setCombatLog((current) => {
        return mergeSharedCombatLogEntries(current, incoming)
      })
    }
    void load()
    const timer = window.setInterval(load, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeMap?.id])

  useEffect(() => {
    if (!activeMap || applyingSharedCombatRef.current) return
    if (orderedCombatPublishRef.current) return
    if (mode !== 'dm') return
    if (!combatActive && initiativeOrder.length === 0) return
    if (combatActive && initiativeOrder.length === 0) return
    publishCombatState()
  }, [activeMap?.id, combatActive, round, initiativeIndex, initiativeOrder, enemyApByToken])

  // [T8/AC2 · D2] 任何地图切换都清空选中态：不仅 DM 下拉，也覆盖程序化 select()、
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

  useEffect(() => {
    const bump = () => setPlayerAssignmentTick((value) => value + 1)
    window.addEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener(PLAYER_ASSIGNMENT_EVENT, bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  const currentInitiativeToken =
    combatActive && initiativeOrder.length > 0
      ? activeMap?.tokens.find((t) => t.id === initiativeOrder[initiativeIndex]?.tokenId)
      : undefined
  const isEnemyTurn =
    currentInitiativeToken?.type === 'enemy' &&
    !!currentInitiativeToken &&
    isTokenAlive(currentInitiativeToken, characters)

  const linkedIds = new Set((activeMap?.tokens ?? []).map((t) => t.characterId).filter(Boolean) as string[])
  void playerAssignmentTick
  const playerVisibleChars = playerViewCharacters(characters, {
    slot: playerSlot,
    assignedCharacterId,
  })
  const visibleChars = isDM ? [] : playerVisibleChars
  const railChars =
    visibleChars.filter((c) => linkedIds.has(c.id)).length > 0
      ? visibleChars.filter((c) => linkedIds.has(c.id))
      : visibleChars

  const closeCharDock = () => {
    setActiveCharId(null)
    setCharPanel(null)
  }

  const clearSharedInterruptPrompts = () => {
    setDodgePrompt(null)
    setSharedDodgePrompt(null)
    setSharedStableMindPrompt(null)
    setSharedGaleComboPrompt(null)
    setSharedAgileLeapPrompt(null)
    setSharedOpportunityAttackPrompt(null)
  }

  const clearSharedInterruptLocalState = () => {
    suppressedDodgePromptIdsRef.current.clear()
    suppressedStableMindPromptIdsRef.current.clear()
    suppressedGaleComboPromptIdsRef.current.clear()
    suppressedAgileLeapPromptIdsRef.current.clear()
    suppressedOpportunityAttackPromptIdsRef.current.clear()
    pendingSharedDodgeRef.current = null
    pendingSharedStableMindRef.current = null
    pendingSharedGaleComboRef.current = null
    pendingSharedAgileLeapRef.current = null
    pendingSharedOpportunityAttackRef.current = null
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
    setTargeting(null)
    setFeatureTargeting(null)
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

  const playerChar =
    getPlayerCharacter(characters, {
      slot: playerSlot,
      assignedCharacterId,
    }) ?? visibleChars[0]

  const canControlPlayerTurn =
    combatActive &&
    currentInitiativeToken?.type === 'player' &&
    !!turnCharacter &&
    turnCharacter.currentHp > 0 &&
    !!currentInitiativeToken &&
    isTokenAlive(currentInitiativeToken, characters) &&
    (isDM || (!pendingPlayerAction && turnCharacter.id === playerChar?.id))

  const playerCombatLocked = !isDM && playerCombatEndedLocked && !combatActive

  const myPlayerToken =
    activeMap && turnCharacter
      ? activeMap.tokens.find((t) => t.type === 'player' && t.characterId === turnCharacter.id)
      : undefined

  const agileLeapChar = useMemo(
    () => characters.find((c) => (c.combatBuffs?.agileLeapMoveFeet ?? 0) > 0),
    [characters],
  )

  const agileLeapToken = (() => {
    if (!agileLeapChar || !activeMap) return undefined
    return activeMap.tokens.find((t) => t.characterId === agileLeapChar.id)
  })()

  const canAgileLeapMove =
    !!agileLeapChar &&
    !!agileLeapToken &&
    !isDM &&
    agileLeapChar.id === playerChar?.id

  const moveCircle = (() => {
    if (!showMoveRange || !activeMap || !myPlayerToken || !turnCharacter) return undefined
    const feet = turnCharacter.speed
    return {
      centerX: myPlayerToken.x,
      centerY: myPlayerToken.y,
      radiusPx: movementRadiusPx(feet, activeMap),
    }
  })()

  const agileLeapCircle = (() => {
    if (!canAgileLeapMove || !agileLeapChar || !agileLeapToken || !activeMap) return undefined
    const feet = agileLeapChar.combatBuffs!.agileLeapMoveFeet!
    return {
      centerX: agileLeapToken.x,
      centerY: agileLeapToken.y,
      radiusPx: movementRadiusPx(feet, activeMap),
    }
  })()

  const calmSpiritMoveCircle = (() => {
    if (!activeMap || !myPlayerToken || !turnCharacter) return undefined
    const feet = turnCharacter.combatBuffs?.calmSpiritMoveFeet ?? 0
    if (feet <= 0) return undefined
    return {
      centerX: myPlayerToken.x,
      centerY: myPlayerToken.y,
      radiusPx: movementRadiusPx(feet, activeMap),
    }
  })()

  const freeMoveCircle = (() => {
    if (!activeMap || !myPlayerToken || !turnCharacter) return undefined
    const feet = turnCharacter.combatBuffs?.freeMoveFeet ?? 0
    if (feet <= 0) return undefined
    return {
      centerX: myPlayerToken.x,
      centerY: myPlayerToken.y,
      radiusPx: movementRadiusPx(feet, activeMap),
    }
  })()

  const activeMoveCircle = agileLeapCircle ?? calmSpiritMoveCircle ?? freeMoveCircle ?? moveCircle
  const inMoveSelectMode =
    !!agileLeapCircle ||
    !!calmSpiritMoveCircle ||
    !!freeMoveCircle ||
    (canControlPlayerTurn && showMoveRange && !!moveCircle && !targeting?.aoe)

  const onAvatarClick = (charId: string) => {
    if (activeCharId === charId && !charPanel) {
      setActiveCharId(null)
      return
    }
    setActiveCharId(charId)
  }

  useEffect(() => {
    if (isDM) return
    const mine = playerChar
    if (!mine) {
      if (activeCharId) {
        const timer = window.setTimeout(() => {
          setActiveCharId(null)
          setCharPanel(null)
        }, 0)
        return () => window.clearTimeout(timer)
      }
      return
    }
    if (activeCharId && activeCharId !== mine.id) {
      const timer = window.setTimeout(() => {
        setActiveCharId(null)
        setCharPanel(null)
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [isDM, playerChar?.id, activeCharId])

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
  const apByToken: Record<string, { current: number; max: number }> = {}
  for (const t of activeMap?.tokens ?? []) {
    if (t.type === 'enemy') {
      apByToken[t.id] = enemyApByToken[t.id] ?? { current: 2, max: 2 }
      continue
    }
    if (t.characterId) {
      const ch = characters.find((c) => c.id === t.characterId)
      if (ch) {
        apByToken[t.id] = { current: ch.currentAP, max: ch.actionPoints }
        continue
      }
    }
  }

  const characterHpKey = characters.map((c) => `${c.id}:${c.currentHp}:${c.tempHp ?? 0}`).join('|')
  const tokenHpKey = (activeMap?.tokens ?? []).map((t) => `${t.id}:${t.hp ?? ''}`).join('|')

  const defeatedTokenIds = useMemo(() => {
    if (!activeMap) return [] as string[]
    return activeMap.tokens
      .filter((t) => isTokenDefeated(t, characters, hpByToken[t.id]))
      .map((t) => t.id)
  }, [activeMap?.tokens, characterHpKey, tokenHpKey, characters])

  // [T8/AC1 · D1] 选中的 token 被删除（选框删除 / 面板删除）或阵亡（HP→0 / defeated）后，
  // 不应继续渲染虚线选中环。统一守卫：选中 id 不再存在于当前地图，或已进入 defeated 集合时清空。
  // 与既有 6 处 setSelectedTokenId(null) 互补（additive，不替换）。
  useEffect(() => {
    if (!selectedTokenId) return
    const stillPresent = activeMap?.tokens.some((t) => t.id === selectedTokenId)
    if (!stillPresent || defeatedTokenIds.includes(selectedTokenId)) {
      const timer = window.setTimeout(() => setSelectedTokenId(null), 0)
      return () => window.clearTimeout(timer)
    }
  }, [selectedTokenId, activeMap?.tokens, defeatedTokenIds])

  const aoeCasterCell = ((): GridCell | null => {
    if (!activeMap || !targeting) return null
    const casterToken = activeMap.tokens.find((t) => t.characterId === targeting.casterId)
    if (!casterToken) return null
    return pixelToCell(casterToken.x, casterToken.y, activeMap)
  })()
  const activeMapGridSize = activeMap?.gridSize ?? 1
  const activeMapGridOffsetX = activeMap?.gridOffsetX ?? 0
  const activeMapGridOffsetY = activeMap?.gridOffsetY ?? 0

  const aoeHighlight = useMemo(() => {
    if (!targeting?.aoe || !aoePreviewCell || !aoeCasterCell) return undefined
    const valid = canPlaceAoe(targeting.aoe, aoeCasterCell, aoePreviewCell)
    const orientFrom = aoeOrientFromCell(targeting.aoe, aoeCasterCell, aoePreviewCell, {
      skillTreeId: targeting.skill.skillTreeId,
      rectRotation: aoeRectRotation,
    })
    const cells = cellsForAoe(targeting.aoe, orientFrom, aoePreviewCell)
    const isSelfCircle =
      targeting.aoe.shape === 'circle' && targeting.aoe.origin === 'self'
    const rangeCells =
      targeting.aoe.shape === 'circle' && targeting.aoe.origin === 'point' && targeting.aoe.placeRangeFeet != null
        ? cellsForAoe(
            { shape: 'circle', origin: 'self', radiusFeet: targeting.aoe.placeRangeFeet },
            aoeCasterCell,
            aoeCasterCell,
          )
        : targeting.aoe.shape === 'rect' && targeting.aoe.placeRangeFeet != null
          ? cellsForAoe(
              { shape: 'circle', origin: 'self', radiusFeet: targeting.aoe.placeRangeFeet },
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
      targeting.aoe.shape === 'circle'
        ? {
            centerX: areaCenter.x,
            centerY: areaCenter.y,
            radiusPx: targeting.aoe.radiusFeet / 5 * activeMapGridSize,
          }
        : undefined
    const areaPolygon = (() => {
      const aoe = targeting.aoe
      if (aoe.shape === 'circle') return undefined
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
  }, [targeting, aoePreviewCell, aoeCasterCell, activeMapGridSize, activeMapGridOffsetX, activeMapGridOffsetY, aoeRectRotation])

  const rangedRangeCells = (() => {
    if (!targeting || targeting.aoe || !activeMap) return [] as GridCell[]
    const rangeFeet = singleTargetRangeFeet(targeting.skill)
    if (rangeFeet == null) return [] as GridCell[]
    const casterToken = activeMap.tokens.find((t) => t.characterId === targeting.casterId)
    if (!casterToken) return [] as GridCell[]
    const casterCell = pixelToCell(casterToken.x, casterToken.y, activeMap)
    return cellsForAoe(
      { shape: 'circle', origin: 'self', radiusFeet: rangeFeet },
      casterCell,
      casterCell,
    )
  })()

  useEffect(() => {
    let timer = 0
    if (!targeting?.aoe || !aoeCasterCell) {
      if (!targeting?.aoe) {
        timer = window.setTimeout(() => setAoePreviewCell(null), 0)
      }
      return () => {
        if (timer) window.clearTimeout(timer)
      }
    }
    timer = window.setTimeout(() => setAoePreviewCell(aoeCasterCell), 0)
    return () => window.clearTimeout(timer)
  }, [targeting?.aoe, targeting?.casterId, aoeCasterCell])

  useEffect(() => {
    if (targeting?.aoe?.shape !== 'rect' || targeting.skill.skillTreeId !== 'arrowStorm') return
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
  }, [targeting])

  // [T8/AC9 · D13] 选中 token 的键盘操作：方向键移动一格、Delete/Backspace 删除。
  // 仅 DM；在 input/textarea/contentEditable 中输入时不触发；不引入玩家端权威写入（沿用既有 DM 路径）。
  useEffect(() => {
    if (!isDM || !activeMap || !selectedToken) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return
      // 拖动/测距/网格调整等模式下不接管键盘
      if (deleteSelectMode || measureMode || gridAdjustMode || targeting || showMoveRange) return

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
    targeting,
    showMoveRange,
  ])

  const tokenBadges = (() => {
    const badges: Record<
      string,
      {
        doubleArrow?: boolean
        eagleEye?: boolean
        galeCombo?: boolean
        silentDraw?: boolean
        preciseStrike?: boolean
        calmMind?: boolean
        calmSpiritStacks?: number
        outOfBreath?: boolean
        huntingMarkStacks?: number
        illusionDance?: boolean
      }
    > = {}
    for (const t of activeMap?.tokens ?? []) {
      const entry: (typeof badges)[string] = {}
      if ((t.huntingMarkStacks ?? 0) > 0) entry.huntingMarkStacks = t.huntingMarkStacks
      if ((t.illusionDanceTurns ?? 0) > 0) entry.illusionDance = true
      if (t.characterId) {
        const ch = characters.find((c) => c.id === t.characterId)
        if (ch) {
          if (ch.combatBuffs?.doubleArrowReady && findClassTrait(ch, 'doubleArrow')) {
            entry.doubleArrow = true
          }
          if ((ch.combatBuffs?.eagleEyeTurns ?? 0) > 0 && findClassTrait(ch, 'eagleEye')) {
            entry.eagleEye = true
          }
          if (ch.combatBuffs?.galeComboReady && findClassTrait(ch, 'galeCombo')) {
            entry.galeCombo = true
          }
          if (
            combatActive &&
            round === 1 &&
            initiativeOrder[0]?.tokenId === t.id &&
            findClassTrait(ch, 'silentDraw') &&
            !ch.combatBuffs?.silentDrawUsed
          ) {
            entry.silentDraw = true
          }
          if (ch.combatBuffs?.preciseStrikeReady && findClassTrait(ch, 'preciseStrike')) {
            entry.preciseStrike = true
          }
          if ((ch.combatBuffs?.calmSpiritStacks ?? 0) > 0) {
            entry.calmSpiritStacks = ch.combatBuffs?.calmSpiritStacks
          }
          if (findClassTrait(ch, 'calmMind')) {
            if (isCalmMindActive(ch)) entry.calmMind = true
            else if (isOutOfBreath(ch)) entry.outOfBreath = true
          }
        }
      }
      if (Object.keys(entry).length > 0) badges[t.id] = entry
    }
    return badges
  })()

  const tokenHoverLabels = (() => {
    if (!targeting || targeting.aoe || !activeMap) return {}
    const caster = characters.find((c) => c.id === targeting.casterId)
    if (!caster || targeting.skill.damageCount <= 0) return {}
    const attackerInput = characterToCombatInput(caster)
    const damageType = isMagicDamageSkill(targeting.skill) ? 'magic' : 'physical'
    const labels: Record<string, string> = {}
    for (const token of activeMap.tokens) {
      if (token.characterId === targeting.casterId) continue
      if (!isTokenAlive(token, characters)) continue
      const targetChar = token.characterId
        ? characters.find((c) => c.id === token.characterId)
        : undefined
      const defenderInput = targetChar
        ? characterToCombatInput(targetChar)
        : token.poolId
          ? enemyCombatInput(token.poolId)
          : undefined
      const modifier = defenderInput
        ? damageModifierFromAttackDefenseDiff(
            getAttackDefenseDiff(attackerInput, defenderInput, damageType),
          )
        : 0
      labels[token.id] = `伤害 ${modifier >= 0 ? '+' : ''}${modifier}`
    }
    return labels
  })()

  const launchArrowProjectile = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    kind: MapProjectile['kind'] = 'arrow',
  ) => {
    const id = runtimeId(kind ?? 'arrow')
    setProjectiles((current) => [...current, { id, from, to, kind }])
    window.setTimeout(() => {
      setProjectiles((current) => current.filter((p) => p.id !== id))
    }, kind === 'focus' ? 980 : 620)
  }

  const clearStatusesOnDeath = (tokenId: string, charId?: string) => {
    if (!activeMap) return
    updateToken(activeMap.id, tokenId, TOKEN_STATUS_CLEAR_PATCH)
    if (charId) updateChar(charId, { conditions: [] })
  }

  const deferDeathHandling = (tokenId: string, charId?: string) => {
    const key = `${tokenId}:${charId ?? ''}`
    if (pendingDeathKeysRef.current.has(key)) return
    pendingDeathKeysRef.current.add(key)
    // [T2/A6] Clearing was gated solely on a future DiceRollOverlay onDone. If that
    // overlay is superseded by another roll (or never completes), the key was never
    // cleared and tryEndCombatIfNeeded() returned false forever — combat could not end
    // even with everyone dead. resolve() is idempotent (clear-once via Set membership),
    // so whichever fires first — onDone or the watchdog — wins and the other no-ops.
    const resolve = () => {
      if (!pendingDeathKeysRef.current.has(key)) return
      pendingDeathKeysRef.current.delete(key)
      clearStatusesOnDeath(tokenId, charId)
      tryEndCombatIfNeeded()
    }
    afterRollCallbacksRef.current.push(resolve)
    const watchdog = window.setTimeout(resolve, DEATH_KEY_WATCHDOG_MS)
    enemyTurnTimersRef.current.push(watchdog)
  }

  const createHeadlessStateSnapshot = (map: BattleMap): HeadlessDmCombatState =>
    createHeadlessCombatSnapshot({
      map,
      characters: useCharacterStore.getState().characters,
      active: combatActiveRef.current,
      round: roundRef.current,
      initiativeIndex: initiativeIndexRef.current,
      initiativeOrder: initiativeOrderRef.current,
      enemyApByToken: enemyApByTokenRef.current,
      disengagedCharacterIds: disengagedCharIds,
    })

  const applyHeadlessCombatResult = (result: HeadlessCombatResult) => {
    const latestMap = result.ok
      ? useMapStore.getState().maps.find((map) => map.id === result.state.map.id)
      : undefined
    const plan = planHeadlessCombatResultApplication({
      result,
      currentActive: combatActiveRef.current,
      currentRound: roundRef.current,
      currentInitiativeIndex: initiativeIndexRef.current,
      currentInitiativeOrder: initiativeOrderRef.current,
      currentCharacters: useCharacterStore.getState().characters,
      currentMap: latestMap,
      currentEnemyApByToken: enemyApByTokenRef.current,
      currentDisengagedCharacterIds: disengagedCharIds,
    })
    if (!plan.ok || !result.ok) return

    if (plan.active !== undefined) {
      setCombatActive(plan.active)
      combatActiveRef.current = plan.active
    }
    if (plan.round !== undefined) {
      setRound(plan.round)
      roundRef.current = plan.round
    }
    if (plan.initiativeIndex !== undefined) {
      setInitiativeIndex(plan.initiativeIndex)
      initiativeIndexRef.current = plan.initiativeIndex
    }
    if (plan.initiativeOrder !== undefined) {
      setInitiativeOrder(plan.initiativeOrder)
      initiativeOrderRef.current = plan.initiativeOrder
    }
    for (const nextCharacter of plan.charactersToUpdate) {
      updateChar(nextCharacter.id, nextCharacter)
    }
    for (const nextToken of plan.tokensToUpdate) {
      updateToken(result.state.map.id, nextToken.id, nextToken)
    }
    if (plan.enemyApByToken !== undefined) {
      enemyApByTokenRef.current = plan.enemyApByToken
      setEnemyApByToken(plan.enemyApByToken)
    }
    if (plan.disengagedCharacterIds !== undefined) {
      setDisengagedCharIds(new Set(plan.disengagedCharacterIds))
    }

    if (plan.shouldPublishCombatState) {
      publishCombatState({
        active: result.state.active,
        round: result.state.round,
        initiativeIndex: result.state.initiativeIndex,
        initiativeOrder: result.state.initiativeOrder,
        enemyApByToken: result.state.enemyApByToken,
      })
    }

    for (const event of plan.deathEvents) {
      deferDeathHandling(event.targetTokenId, event.characterId)
    }
  }

  const handleRollDone = () => {
    setRoll(null)
    const callbacks = afterRollCallbacksRef.current
    afterRollCallbacksRef.current = []
    callbacks.forEach((callback) => callback())
    const next = afterRollRef.current
    afterRollRef.current = null
    next?.()
  }

  const tokenHasKnockback = (token: Token, targetChar?: Character) =>
    (token.knockbackTurns ?? 0) > 0 ||
    !!targetChar?.conditions.includes(KNOCKBACK_STATUS_LABEL)

  const latestTokenSnapshot = (token: Token): Token => {
    if (!activeMap) return token
    return useMapStore.getState().maps
      .find((map) => map.id === activeMap.id)
      ?.tokens.find((item) => item.id === token.id) ?? token
  }

  const latestCharacterSnapshot = (characterId: string | undefined, fallback?: Character): Character | undefined =>
    characterId
      ? useCharacterStore.getState().characters.find((c) => c.id === characterId) ?? fallback
      : fallback

  const tokenHasKnockbackNow = (token: Token, targetChar?: Character) => {
    const latestToken = latestTokenSnapshot(token)
    const latestChar = latestCharacterSnapshot(latestToken.characterId, targetChar)
    return tokenHasKnockback(latestToken, latestChar)
  }

  const chooseCooldownReductionSkillId = (caster: Character, amount: number, reason: string) => {
    const latest = useCharacterStore.getState().characters.find((c) => c.id === caster.id)
    if (!latest) return undefined
    const skills = latest.combatSkills.filter((s) => s.remaining > 0)
    if (skills.length === 0) return undefined
    const picked = window.prompt(
      `${reason}\n选择要 CD -${amount} 的技能编号：\n${skills
        .map((s, i) => `${i + 1}. ${s.name}（剩余 ${s.remaining}）`)
        .join('\n')}`,
    )
    return skills[Number(picked) - 1]?.id
  }

  const chooseEnemyTokenByPrompt = (reason: string, filter?: (token: Token) => boolean): Token | null => {
    if (!activeMap) return null
    const candidates = activeMap.tokens.filter((t) => isEnemyTarget(t) && isTokenAlive(t, useCharacterStore.getState().characters) && (!filter || filter(t)))
    if (candidates.length === 0) {
      void showCombatNotice('没有可选目标', '当前没有符合条件的目标。', 'amber')
      return null
    }
    const picked = window.prompt(
      `${reason}\n选择目标编号：\n${candidates
        .map((t, i) => `${i + 1}. ${t.label}${(t.huntingMarkStacks ?? 0) > 0 ? `（印记 ${t.huntingMarkStacks}）` : ''}`)
        .join('\n')}`,
    )
    return candidates[Number(picked) - 1] ?? null
  }

  const beginIllusionDanceTargeting = (caster: Character) => {
    const trait = findClassTrait(caster, 'illusionDance')
    if (!trait || trait.uses <= 0) {
      void showCombatNotice('迷幻舞步', '本场次数已用完。', 'amber')
      return
    }
    if (caster.currentAP < 1) {
      void showCombatNotice('行动点不足', '需要 1 AP。', 'amber')
      return
    }
    if ((caster.qi ?? 0) < 1) {
      void showCombatNotice('气不足', '需要 1 点气。', 'amber')
      return
    }
    if (!activeMap) return
    setTargeting(null)
    setAoePreviewCell(null)
    setShowMoveRange(false)
    setFeatureTargeting({
      featureKey: 'illusionDance',
      casterId: caster.id,
      maxTargets: illusionDanceTargetLimit(caster),
      selectedTokenIds: [],
    })
  }

  const submitIllusionDanceTargets = (tokenIds: string[]) => {
    if (!featureTargeting) return
    const caster = useCharacterStore.getState().characters.find((c) => c.id === featureTargeting.casterId)
    if (!caster) return
    const selectedIds = uniqueFeatureTargetIds(tokenIds).slice(0, featureTargeting.maxTargets)
    if (selectedIds.length === 0) return
    const sent = isDM
      ? sendDmLocalActivateFeatureRequest('illusionDance', {
          targetTokenId: selectedIds[0],
          targetTokenIds: selectedIds,
        })
      : sendPlayerActivateFeatureRequest('illusionDance', {
          targetTokenId: selectedIds[0],
          targetTokenIds: selectedIds,
        })
    if (sent) setFeatureTargeting(null)
  }

  const handleFeatureTargetTokenClick = (tokenId: string) => {
    if (!featureTargeting || featureTargeting.featureKey !== 'illusionDance' || !activeMap) return false
    const token = activeMap.tokens.find((item) => item.id === tokenId)
    if (!token || !isEnemyTarget(token) || !isTokenAlive(token, useCharacterStore.getState().characters)) {
      return true
    }
    const alreadySelected = featureTargeting.selectedTokenIds.includes(token.id)
    const nextIds = alreadySelected
      ? featureTargeting.selectedTokenIds.filter((id) => id !== token.id)
      : [...featureTargeting.selectedTokenIds, token.id].slice(0, featureTargeting.maxTargets)
    if (featureTargeting.maxTargets <= 1) {
      submitIllusionDanceTargets([token.id])
      return true
    }
    setFeatureTargeting({ ...featureTargeting, selectedTokenIds: nextIds })
    if (nextIds.length >= featureTargeting.maxTargets) {
      submitIllusionDanceTargets(nextIds)
    }
    return true
  }

  const huntingMarkTraitRank = (caster?: Character) =>
    caster ? (findClassTrait(caster, 'huntingMark')?.level ?? 0) : 0

  const isEnemyTarget = (token: Token): boolean => token.type === 'enemy'

  const handleActivateFeature = async (key: ClassFeatureKey) => {
    if (!canControlPlayerTurn || !turnCharacter) return
    if (key === 'illusionDance') {
      beginIllusionDanceTargeting(turnCharacter)
      return
    }

    const sendActiveFeature = (opts?: { targetTokenId?: string; targetTokenIds?: string[] }) =>
      isDM ? sendDmLocalActivateFeatureRequest(key, opts) : sendPlayerActivateFeatureRequest(key, opts)

    if (key === 'trackingArrow') {
      const trait = findClassTrait(turnCharacter, 'trackingArrow')
      if (!trait || trait.uses <= 0) return
      const target = chooseEnemyTokenByPrompt('追踪箭：给一个已带狩猎印记的目标额外 +1 层印记', (t) => (t.huntingMarkStacks ?? 0) > 0)
      if (!target) return
      sendActiveFeature({ targetTokenId: target.id })
      return
    }

    if (key === 'shadowVeil') {
      const trait = findClassTrait(turnCharacter, 'shadowVeil')
      if (!trait || trait.uses <= 0) return
      const target = chooseEnemyTokenByPrompt('影遁之术：消耗目标 2 层狩猎印记，本回合对其攻击 +1D6', (t) => (t.huntingMarkStacks ?? 0) >= 2)
      if (!target) return
      sendActiveFeature({ targetTokenId: target.id })
      return
    }

    if (shouldSendPlayerReadyFeatureToDm(key)) {
      sendActiveFeature()
    }
  }

  const getEnemyApState = (tokenId: string) =>
    enemyApByTokenRef.current[tokenId] ?? { current: 2, max: 2 }

  const resolveEnemyMoveThroughHeadless = async (
    enemy: Token,
    targetPosition: { x: number; y: number },
    apCost: number,
    actionLabel: string,
  ) => {
    if (!activeMap) return false
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const headless = resolveHeadlessDmAction(
      createHeadlessStateSnapshot(latestMap),
      buildEnemyMoveAction({
        enemy,
        targetPosition,
        apCost,
      }),
    )
    const settlement = planEnemyMoveSettlement({
      result: headless,
      enemy,
      actionLabel,
      fallbackApMax: getEnemyApState(enemy.id).max,
    })
    if (settlement.status === 'rejected') {
      pushCombatLog(settlement.log.text, settlement.log.kind)
      return false
    }
    applyHeadlessCombatResult(headless)
    if (settlement.log) {
      pushCombatLog(settlement.log.text, settlement.log.kind)
    }
    return true
  }

  const opportunityAttackersForMove = (
    movingToken: Token,
    to: { x: number; y: number },
    movingChar?: Character,
  ) => {
    if (!activeMap) return [] as Token[]
    const disengagedIds = movingChar ? disengagedCharIds : undefined
    return findOpportunityAttackersForMove({
      map: activeMap,
      characters: useCharacterStore.getState().characters,
      movingToken,
      to,
      disengagedCharacterIds: disengagedIds,
      enemyApByToken: enemyApByTokenRef.current,
    })
  }

  const resolveOpportunityAttack = async (
    attackerToken: Token,
    targetToken: Token,
    targetChar?: Character,
    opts?: { confirmed?: boolean },
  ) => {
    if (!activeMap) return
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const attacker = attackerToken.characterId
      ? useCharacterStore.getState().characters.find((c) => c.id === attackerToken.characterId)
      : undefined
    const effectiveTargetChar =
      targetChar ??
      (targetToken.characterId
        ? useCharacterStore.getState().characters.find((c) => c.id === targetToken.characterId)
        : undefined)
    if (attackerToken.characterId && (!attacker || attacker.currentAP < 1 || attacker.currentHp <= 0)) return
    if (!attackerToken.characterId && attackerToken.type === 'enemy') {
      const ap = getEnemyApState(attackerToken.id)
      if (ap.current < 1) return
    }
    const targetName = effectiveTargetChar?.name ?? targetToken.label
    const attackerName = attacker?.name ?? attackerToken.label
    if (
      attacker &&
      !opts?.confirmed &&
      !(await showCombatDialog({
        title: '借机攻击',
        message: `${attackerName} 对 ${targetName} 触发借机攻击。\n是否消耗 1 AP，进行一次近战命中判定？`,
        confirmText: '攻击',
        cancelText: '放过',
        tone: 'amber',
      }))
    ) {
      return
    }

    const d20 = await rollDiceBoxD20('借机攻击 D20', targetName)
    const attackBonus = attacker
      ? getEffectiveAbilityMod(attacker, 'str') + proficiencyBonus(attacker.level)
      : getTokenAbilityMod(attackerToken, 'str') + 2
    const targetAc = effectiveTargetChar ? getAc(effectiveTargetChar) : (getTokenTargetAc(targetToken) ?? 12)
    const hit = shouldRollOpportunityDamage({ d20Value: d20, attackBonus, targetAc })
    const values = hit ? await rollDiceBoxValues(1, 6, '借机攻击 伤害', targetName) : []

    const headless = resolveHeadlessDmAction(
      {
        ...createHeadlessStateSnapshot(latestMap),
        map: latestMap,
      },
      buildOpportunityAttackAction({
        attackerTokenId: attackerToken.id,
        targetTokenId: targetToken.id,
        d20Value: d20,
        damageValues: hit ? values : undefined,
      }),
    )
    const settlement = planOpportunityAttackSettlement({
      result: headless,
      attackerName,
      targetName,
      critDamageLabel: attacker ? formatCritDamagePercent(attacker) : '125%',
    })
    if (settlement.status === 'rejected') {
      pushCombatLog(settlement.log.text, settlement.log.kind)
      return
    }
    applyHeadlessCombatResult(headless)
    if (settlement.status === 'ignored') return
    setRoll(settlement.roll)
    pushCombatLog(settlement.combatLog.text, settlement.combatLog.kind)
  }

  const resolveOpportunityAttacksForMove = async (
    movingToken: Token,
    to: { x: number; y: number },
    movingChar?: Character,
    attackerTokenIds?: string[],
  ) => {
    const attackers = attackerTokenIds
      ? attackerTokenIds
          .map((id) => activeMap?.tokens.find((token) => token.id === id))
          .filter((token): token is Token => !!token)
      : opportunityAttackersForMove(movingToken, to, movingChar)
    for (const attacker of attackers) {
      const latestTarget = movingChar
        ? useCharacterStore.getState().characters.find((c) => c.id === movingChar.id)
        : undefined
      if (movingChar && (!latestTarget || latestTarget.currentHp <= 0)) break
      if (!movingChar && !isTokenAlive(movingToken, useCharacterStore.getState().characters)) break
      const attackerChar = attacker.characterId
        ? useCharacterStore.getState().characters.find((c) => c.id === attacker.characterId)
        : undefined
      if (attackerChar) {
        const accepted = await requestSharedOpportunityAttackChoice(attackerChar, {
          attackerTokenId: attacker.id,
          targetTokenId: movingToken.id,
          targetName: latestTarget?.name ?? movingToken.label,
        })
        if (!accepted) {
          pushCombatLog(`${attackerChar.name} 放弃对 ${latestTarget?.name ?? movingToken.label} 的借机攻击。`, 'turn')
          continue
        }
      }
      await resolveOpportunityAttack(attacker, movingToken, latestTarget, { confirmed: true })
    }
  }

  const handleMoveSelect = async (point: { x: number; y: number }) => {
    if (!activeMap || targeting?.aoe) return
    if (!isDM && (!combatActive || playerCombatLocked)) return

    if (agileLeapChar && agileLeapToken && agileLeapCircle) {
      const feet = agileLeapChar.combatBuffs!.agileLeapMoveFeet!
      const center = { x: agileLeapCircle.centerX, y: agileLeapCircle.centerY }
      const pos = snapTokenToGridCenter(point.x, point.y, agileLeapToken, activeMap)
      if (!isWithinMovementRange(center, pos, feet, activeMap)) return
      if (!sendPlayerAgileLeapMoveRequest(pos, feet)) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '无法移动',
          pendingPlayerActionRef.current ? '正在等待 DM 确认上一动作。' : '灵巧跳跃当前不可用。',
          'amber',
        )
      }
      return
    }

    if (turnCharacter && myPlayerToken && calmSpiritMoveCircle) {
      const feet = turnCharacter.combatBuffs?.calmSpiritMoveFeet ?? 0
      const center = { x: calmSpiritMoveCircle.centerX, y: calmSpiritMoveCircle.centerY }
      const pos = snapTokenToGridCenter(point.x, point.y, myPlayerToken, activeMap)
      if (!isWithinMovementRange(center, pos, feet, activeMap)) return
      if (!isDM) {
        if (!sendPlayerCalmSpiritMoveRequest(pos, feet)) {
          void showCombatNotice(
            pendingPlayerActionRef.current ? '等待 DM 确认' : '无法移动',
            pendingPlayerActionRef.current ? '正在等待 DM 确认上一动作。' : '安定心神移动当前不可用。',
            'amber',
          )
        }
        setShowMoveRange(false)
        return
      }
      if (
        !submitDmLocalPlayerAction(
          createDmLocalPlayerAction({
            type: 'calm-spirit-move',
            targetPosition: pos,
          }),
        )
      ) {
        void showCombatNotice('无法移动', '安定心神移动当前不可用。', 'amber')
      }
      setShowMoveRange(false)
      return
    }

    if (turnCharacter && myPlayerToken && freeMoveCircle) {
      const feet = turnCharacter.combatBuffs?.freeMoveFeet ?? 0
      const center = { x: freeMoveCircle.centerX, y: freeMoveCircle.centerY }
      const pos = snapTokenToGridCenter(point.x, point.y, myPlayerToken, activeMap)
      if (!isWithinMovementRange(center, pos, feet, activeMap)) return
      if (!isDM) {
        if (!sendPlayerSkillFreeMoveRequest(pos, feet)) {
          void showCombatNotice(
            pendingPlayerActionRef.current ? '等待 DM 确认' : '无法移动',
            pendingPlayerActionRef.current ? '正在等待 DM 确认上一动作。' : '技能移动当前不可用。',
            'amber',
          )
        }
        setShowMoveRange(false)
        return
      }
      const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
      const headless = resolveHeadlessDmAction(createHeadlessStateSnapshot(map), {
        type: 'move-token',
        actorTokenId: myPlayerToken.id,
        characterId: turnCharacter.id,
        targetPosition: pos,
        mode: 'skill-free-move',
      })
      if (!headless.ok) return
      applyHeadlessCombatResult(headless)
      for (const event of headless.events) {
        if (event.type === 'log') pushCombatLog(event.text, 'turn')
      }
      pushApLog(turnCharacter, 0, '技能授予移动', `移动至多 ${feet} 尺`)
      setShowMoveRange(false)
      return
    }

    if (!myPlayerToken || !turnCharacter || !showMoveRange || !moveCircle) return
    if (isMovementLocked(turnCharacter.conditions)) {
      void showCombatNotice('无法移动', '该角色本回合无法移动。', 'amber') // [T4/C4/C8] no-move OR restrained
      return
    }
    const center = { x: moveCircle.centerX, y: moveCircle.centerY }
    const moveFeet = turnCharacter.speed
    const pos = snapTokenToGridCenter(point.x, point.y, myPlayerToken, activeMap)
    if (!isWithinMovementRange(center, pos, moveFeet, activeMap)) return
    const fromCell = pixelToCell(myPlayerToken.x, myPlayerToken.y, activeMap)
    const toCell = pixelToCell(pos.x, pos.y, activeMap)
    const movedFeet = cellDistance(fromCell, toCell) * 5
    if (!isDM) {
      if (!sendPlayerMoveRequest(pos, movedFeet)) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '行动点不足',
          pendingPlayerActionRef.current ? '正在等待 DM 确认上一动作。' : '需要 1 AP。',
          'amber',
        )
      }
      setShowMoveRange(false)
      return
    }
    if (!submitDmLocalPlayerAction(createDmLocalPlayerAction({ type: 'move-token', targetPosition: pos }))) {
      void showCombatNotice('无法移动', '当前移动无法提交给 DM 结算。', 'amber')
      return
    }
    setShowMoveRange(false)
  }

  const handleDisengage = () => {
    if (!canControlPlayerTurn || !turnCharacter) return
    if (disengagedCharIds.has(turnCharacter.id)) return
    if (!isDM) {
      if (!sendPlayerDisengageRequest()) {
        void showCombatNotice(
          pendingPlayerActionRef.current ? '等待 DM 确认' : '行动点不足',
          pendingPlayerActionRef.current ? '正在等待 DM 确认上一动作。' : '撤离需要 2 AP。',
          'amber',
        )
      }
      return
    }
    if (!submitDmLocalPlayerAction(createDmLocalPlayerAction({ type: 'disengage' }))) {
      void showCombatNotice('无法撤离', '当前撤离无法提交给 DM 结算。', 'amber')
    }
  }

  const handleCalmSpiritMove = () => {
    const ch = useCharacterStore.getState().characters.find((c) => c.id === turnCharacter?.id)
    if (!ch || !activeMap || !findClassTrait(ch, 'calmSpirit')) return
    if (!isDM) {
      if (sendPlayerCalmSpiritRequest('move')) setShowMoveRange(true)
      return
    }
    if (sendDmLocalCalmSpiritRequest('move')) setShowMoveRange(true)
  }

  const handleCalmSpiritCrit = () => {
    const ch = useCharacterStore.getState().characters.find((c) => c.id === turnCharacter?.id)
    if (!ch || !activeMap || !findClassTrait(ch, 'calmSpirit')) return
    if (!isDM) {
      sendPlayerCalmSpiritRequest('crit')
      return
    }
    sendDmLocalCalmSpiritRequest('crit')
  }

  const handleCalmSpiritCooldown = () => {
    const ch = useCharacterStore.getState().characters.find((c) => c.id === turnCharacter?.id)
    if (!ch || !activeMap) return
    const skills = ch.combatSkills.filter((s) => s.remaining > 0)
    if (skills.length === 0) {
      void showCombatNotice('安定心神', '没有正在冷却的技能。', 'amber')
      return
    }
    const picked = window.prompt(
      `选择要 CD -1 的技能编号：\n${skills
        .map((s, i) => `${i + 1}. ${s.name}（剩余 ${s.remaining}）`)
        .join('\n')}`,
    )
    const index = Number(picked) - 1
    const skill = skills[index]
    if (!skill) return
    if (!isDM) {
      sendPlayerCalmSpiritRequest('cooldown', { skillId: skill.id })
      return
    }
    sendDmLocalCalmSpiritRequest('cooldown', { skillId: skill.id })
  }

  const handleCalmSpiritExtraTurn = () => {
    const ch = useCharacterStore.getState().characters.find((c) => c.id === turnCharacter?.id)
    if (!ch || !activeMap) return
    if (!isDM) {
      sendPlayerCalmSpiritRequest('extraTurn')
      return
    }
    if (sendDmLocalCalmSpiritRequest('extraTurn')) {
      void showCombatNotice('安定心神', '已获得一个完整回合：AP 回满，技能本回合使用限制重置。', 'sky')
    }
  }

  const handleUseSkill = (skill: CombatSkill) => {
    if (!activeChar) return
    if (!isDM && (!combatActive || playerCombatLocked || !canControlPlayerTurn || activeChar.id !== turnCharacter?.id)) {
      return
    }
    if (skill.skillTreeId === 'riseKick' && !activeChar.conditions.includes('倒地')) {
      void showCombatNotice('起身踢', '只能在倒地时使用。', 'amber')
      return
    }
    const waiveAp = !!activeChar.combatBuffs?.galeComboReady
    if (skill.damageCount > 0) {
      const doubleArrow =
        canUseDoubleArrow(activeChar, skill) && !!activeChar.combatBuffs?.doubleArrowReady
      const aoe = getSkillAoeTargeting(skill)
      setShowMoveRange(false)
      setFeatureTargeting(null)
      setAoePreviewCell(null)
      setTargeting({
        casterId: activeChar.id,
        skill,
        doubleArrow,
        aoe: aoe ?? undefined,
        waiveAp: waiveAp || undefined,
      })
      setAoeRectRotation(0)
    } else {
      if (!isDM) {
        if (!sendPlayerUseSkillRequest(skill)) {
          void showCombatNotice('无法执行', '当前技能无法提交给 DM 结算。', 'amber')
        }
        return
      }
      if (!sendDmLocalUseSkillRequest(skill)) {
        void showCombatNotice('无法执行', '当前技能无法提交给 DM 结算。', 'amber')
      }
    }
  }

  const handleAoePreviewCell = (cell: GridCell | null) => {
    if (!cell || !targeting?.aoe || !aoeUsesMouseAim(targeting.aoe)) return
    setAoePreviewCell(cell)
  }

  const handleAoeConfirm = (cell: GridCell) => {
    if (!targeting?.aoe || !aoeCasterCell) return
    const requestPlayerAoe = (targetCell: GridCell) => {
      if (isDM) return false
      if (sendPlayerAoeAttackRequest(targetCell)) {
        setTargeting(null)
        setAoePreviewCell(null)
      }
      return true
    }
    if (isSelfOriginCircleAoe(targeting.aoe)) {
      if (requestPlayerAoe(aoeCasterCell)) return
      if (sendDmLocalAoeAttackRequest(aoeCasterCell)) {
        setTargeting(null)
        setAoePreviewCell(null)
        return
      }
      void showCombatNotice('无法执行', '当前范围攻击无法提交给 DM 结算。', 'amber')
      setTargeting(null)
      setAoePreviewCell(null)
      return
    }
    if (!aoeHighlight?.valid) return
    if (requestPlayerAoe(cell)) return
    if (sendDmLocalAoeAttackRequest(cell)) {
      setTargeting(null)
      setAoePreviewCell(null)
      return
    }
    void showCombatNotice('无法执行', '当前范围攻击无法提交给 DM 结算。', 'amber')
    setTargeting(null)
    setAoePreviewCell(null)
  }

  const handleSelectToken = (tokenId: string | null) => {
    if (!tokenId) {
      setSelectedTokenId(null)
      setSelectedCharacterTokenId(null)
      return
    }
    if (playerCombatLocked) return

    // 范围技能确认优先于移动
    if (featureTargeting && handleFeatureTargetTokenClick(tokenId)) {
      return
    }

    if (targeting?.aoe && activeMap && aoeCasterCell) {
      const clickedToken = activeMap.tokens.find((t) => t.id === tokenId)
      const clickedCell = clickedToken ? pixelToCell(clickedToken.x, clickedToken.y, activeMap) : null
      if (isSelfOriginCircleAoe(targeting.aoe)) {
        const casterToken =
          activeMap.tokens.find((t) => t.characterId === targeting.casterId) ??
          activeMap.tokens.find((t) => t.id === currentInitiativeToken?.id) ??
          (myPlayerToken?.characterId === targeting.casterId ? myPlayerToken : undefined)
        const clickedCasterCell =
          clickedCell && clickedCell.col === aoeCasterCell.col && clickedCell.row === aoeCasterCell.row
        if ((casterToken && tokenId === casterToken.id) || clickedCasterCell) {
          if (!isDM) {
            if (sendPlayerAoeAttackRequest(aoeCasterCell)) {
              setTargeting(null)
              setAoePreviewCell(null)
            }
            return
          }
          if (sendDmLocalAoeAttackRequest(aoeCasterCell)) {
            setTargeting(null)
            setAoePreviewCell(null)
            return
          }
          void showCombatNotice('无法执行', '当前范围攻击无法提交给 DM 结算。', 'amber')
          setTargeting(null)
          setAoePreviewCell(null)
          return
        }
        return
      }
      if (clickedCell && canPlaceAoe(targeting.aoe, aoeCasterCell, clickedCell)) {
        if (!isDM) {
          if (sendPlayerAoeAttackRequest(clickedCell)) {
            setTargeting(null)
            setAoePreviewCell(null)
          }
          return
        }
        if (sendDmLocalAoeAttackRequest(clickedCell)) {
          setTargeting(null)
          setAoePreviewCell(null)
          return
        }
        void showCombatNotice('无法执行', '当前范围攻击无法提交给 DM 结算。', 'amber')
        setTargeting(null)
        setAoePreviewCell(null)
        return
      }
      setSelectedTokenId(tokenId)
      return
    }

    if (canControlPlayerTurn && tokenId === myPlayerToken?.id) {
      if (isDM) setActiveCharId(turnCharacter!.id)
      setShowMoveRange((v) => !v)
      setSelectedTokenId(isDM ? tokenId : null)
      if (!isDM) setSelectedCharacterTokenId(null)
      return
    }
    // 单体技能：点到 token 即结算
    if (targeting && !targeting.aoe) {
      const tok = activeMap?.tokens.find((t) => t.id === tokenId)
      if (tok) {
        const rangeFeet = singleTargetRangeFeet(targeting.skill)
        if (rangeFeet != null && activeMap) {
          const targetCell = pixelToCell(tok.x, tok.y, activeMap)
          const inRange = new Set(rangedRangeCells.map(cellKey)).has(cellKey(targetCell))
          if (!inRange) {
            void showCombatNotice('目标超出射程', `射程为 ${rangeFeet} 尺。`, 'amber')
            return
          }
        }
        if (!isDM && pendingPlayerActionRef.current) return
        const targetActionKey = `${targeting.casterId}:${targeting.skill.id}:${tok.id}`
        const activeTargetAction = resolvingSkillTargetRef.current
        const now = runtimeNow()
        if (activeTargetAction?.key === targetActionKey && now - activeTargetAction.at < 3000) return
        resolvingSkillTargetRef.current = { key: targetActionKey, at: now }
        const releaseSkillTarget = () => {
          if (resolvingSkillTargetRef.current?.key === targetActionKey) {
            resolvingSkillTargetRef.current = null
          }
        }
        if (!isDM) {
          let targetTokenIds: string[] | undefined
          if (activeMap && (targeting.skill.skillTreeId === 'multiShot' || targeting.skill.skillTreeId === 'encircle')) {
            const shots = Math.max(1, targeting.skill.arrowShots ?? 1)
            targetTokenIds = Array.from({ length: shots }, () => tok.id)
          } else if (activeMap && targeting.skill.skillTreeId === 'rageShot') {
            const shots = Math.max(1, targeting.skill.arrowShots ?? 1)
            const selectedTargets: Token[] = [tok]
            const candidates = activeMap.tokens.filter((t) => {
              if (t.characterId === targeting.casterId) return false
              if (!isTokenAlive(t, characters)) return false
              const targetCell = pixelToCell(t.x, t.y, activeMap)
              return new Set(rangedRangeCells.map(cellKey)).has(cellKey(targetCell))
            })
            for (let shot = 1; shot < shots; shot++) {
              const picked = candidates.length
                ? window.prompt(
                    `${targeting.skill.name}：选择第 ${shot + 1}/${shots} 支箭目标，留空则继续射向 ${tok.label}：\n${candidates
                      .map((t, i) => `${i + 1}. ${t.label}`)
                      .join('\n')}`,
                  )
                : null
              selectedTargets.push(candidates[Number(picked) - 1] ?? tok)
            }
            targetTokenIds = selectedTargets.map((target) => target.id)
          }
          if (sendPlayerAttackTokenRequest(tok, targeting.skill, targetTokenIds)) {
            setTargeting(null)
            setAoePreviewCell(null)
            window.setTimeout(releaseSkillTarget, 1000)
          } else {
            releaseSkillTarget()
          }
          return
        }
        let dmTargetTokenIds: string[] | undefined
        if (activeMap && (targeting.skill.skillTreeId === 'multiShot' || targeting.skill.skillTreeId === 'encircle')) {
          const shots = Math.max(1, targeting.skill.arrowShots ?? 1)
          dmTargetTokenIds = Array.from({ length: shots }, () => tok.id)
        } else if (activeMap && targeting.skill.skillTreeId === 'rageShot') {
          const shots = Math.max(1, targeting.skill.arrowShots ?? 1)
          const selectedTargets: Token[] = [tok]
          const candidates = activeMap.tokens.filter((t) => {
            if (t.characterId === targeting.casterId) return false
            if (!isTokenAlive(t, characters)) return false
            const targetCell = pixelToCell(t.x, t.y, activeMap)
            return new Set(rangedRangeCells.map(cellKey)).has(cellKey(targetCell))
          })
          for (let shot = 1; shot < shots; shot++) {
            const picked = candidates.length
              ? window.prompt(
                  `${targeting.skill.name}: choose arrow ${shot + 1}/${shots} target, empty keeps ${tok.label}:\n${candidates
                    .map((t, i) => `${i + 1}. ${t.label}`)
                    .join('\n')}`,
                )
              : null
            selectedTargets.push(candidates[Number(picked) - 1] ?? tok)
          }
          dmTargetTokenIds = selectedTargets.map((target) => target.id)
        }
        if (sendDmLocalAttackTokenRequest(tok, targeting.skill, dmTargetTokenIds)) {
          setTargeting(null)
          setAoePreviewCell(null)
          window.setTimeout(releaseSkillTarget, 1000)
        } else {
          releaseSkillTarget()
        }
        return
      }
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
    for (const id of enemyTurnTimersRef.current) window.clearTimeout(id)
    enemyTurnTimersRef.current = []
  }

  // [T2/A8] Previously enemy-turn timers were only cleared in startCombat/endCombat,
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

  const startCombat = async () => {
    if (!activeMap) return
    const nextCombatId = runtimeId(`${activeMap.id}:combat`)
    combatIdRef.current = nextCombatId
    clearEnemyTurnTimers()
    setCombatLog([])
    setCombatLogOpen(true)
    setPlayerCombatEndedLocked(false)
    await clearCombatMessageQueues(activeMap.id, { clearCombatLog: true, combatId: nextCombatId })
    enemyAppliedKeysRef.current.clear()
    nonActorSkippedKeysRef.current.clear()
    stunSkippedKeysRef.current.clear()
    multiStrikeHitsRef.current = {}
    setDisengagedCharIds(new Set())
    clearPlayerCombatUI()
    const order = buildInitiativeOrder(activeMap.tokens, characters)
    const shouldClearStatuses =
      isDM && window.confirm('开始战斗前是否清除当前地图所有参战单位的状态？')
    const initialEnemyAp: Record<string, { current: number; max: number }> = {}
    for (const token of activeMap.tokens) {
      if (token.type === 'enemy') initialEnemyAp[token.id] = { current: 2, max: 2 }
    }
    enemyApByTokenRef.current = initialEnemyAp
    setEnemyApByToken(initialEnemyAp)
    setCombatActive(true)
    combatActiveRef.current = true
    setRound(1)
    roundRef.current = 1
    setInitiativeOrder(order)
    initiativeOrderRef.current = order
    setInitiativeIndex(0)
    initiativeIndexRef.current = 0
    setInitiativeScroll(0)
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const started = startHeadlessCombat(
      {
        map: latestMap,
        characters: useCharacterStore.getState().characters,
        active: true,
        round: 1,
        initiativeIndex: 0,
        initiativeOrder: order,
        enemyApByToken: initialEnemyAp,
        disengagedCharacterIds: [],
      },
      undefined,
      { clearStatuses: shouldClearStatuses },
    )
    applyHeadlessCombatResult({ ok: true, state: started, events: [] })
    publishCombatState({
      combatId: nextCombatId,
      active: started.active,
      round: started.round,
      initiativeIndex: started.initiativeIndex,
      initiativeOrder: started.initiativeOrder,
      enemyApByToken: started.enemyApByToken,
    })
    pushCombatLog(`战斗开始：${order.length} 名单位加入先攻`, 'system', 1)
  }

  const endCombat = () => {
    pushCombatLog('战斗结束', 'system')
    if (activeMap) {
      void clearCombatMessageQueues(activeMap.id, { clearCombatLog: false })
    }
    clearEnemyTurnTimers()
    clearEnemyAiWarnings() // [T7/AC6] 战斗结束清空回退告警去重集合，防止无界增长。
    setDodgePrompt(null)
    afterRollRef.current = null
    setRoll(null)
    setCombatActive(false)
    combatActiveRef.current = false
    setInitiativeOrder([])
    initiativeOrderRef.current = []
    setInitiativeIndex(0)
    initiativeIndexRef.current = 0
    setInitiativeScroll(0)
    enemyAppliedKeysRef.current.clear()
    nonActorSkippedKeysRef.current.clear()
    stunSkippedKeysRef.current.clear()
    multiStrikeHitsRef.current = {}
    setDisengagedCharIds(new Set())
    clearPlayerCombatUI()
    enemyApByTokenRef.current = {}
    setEnemyApByToken({})
    publishCombatState({
      combatId: combatIdRef.current,
      active: false,
      round,
      initiativeIndex: 0,
      initiativeOrder: [],
      enemyApByToken: {},
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
    if (pendingDeathKeysRef.current.size > 0) return false
    const outcome = currentCombatOutcome()
    if (!outcome.ended) return false
    void showCombatNotice('战斗结束', outcome.message, 'sky').finally(() => endCombat())
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

  const requestSharedStableMindChoice = (
    targetChar: Character,
    save: {
      fullDamage: number
      damageAfterSave: number
      saveD20: number
      saveMod: number
      saveTotal: number
      dc: number
    },
  ): Promise<boolean> => {
    if (!activeMap || !isDM) return Promise.resolve(false)
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return new Promise((resolve) => {
      const interrupt = createCombatInterrupt<StableMindInterruptPayload, StableMindInterruptResponse>({
        id,
        mapId: activeMap.id,
        kind: 'stable-mind',
        targetCharId: targetChar.id,
        payload: {
          targetName: targetChar.name,
          fullDamage: save.fullDamage,
          damageAfterSave: save.damageAfterSave,
          saveD20: save.saveD20,
          saveMod: save.saveMod,
          saveTotal: save.saveTotal,
          dc: save.dc,
        },
        expiresAt,
      })
      pendingSharedStableMindRef.current = {
        id: interrupt.id,
        targetCharId: targetChar.id,
        resolve,
      }
      void publishCombatInterrupt(interrupt)
    })
  }

  const requestSharedGaleComboChoice = (
    caster: Character,
    triggerLabel: string,
  ): Promise<GaleComboDecision> => {
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '疾风连击',
        message:
          `${caster.name} ${triggerLabel}。\n\n` +
          '是否发动疾风连击？发动后，下一次已准备技能或基础射击不消耗 AP；释放后消耗 1 次疾风连击。',
        confirmText: '发动',
        cancelText: '暂不发动',
        tone: 'violet',
      }).then((accepted) => (accepted ? 'accepted' : 'declined'))
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return new Promise((resolve) => {
      const interrupt = createCombatInterrupt<GaleComboInterruptPayload, GaleComboInterruptResponse>({
        id,
        mapId: activeMap.id,
        kind: 'gale-combo',
        actorCharId: caster.id,
        payload: {
          casterName: caster.name,
          triggerLabel,
        },
        expiresAt,
      })
      pendingSharedGaleComboRef.current = {
        id: interrupt.id,
        casterCharId: caster.id,
        resolve,
      }
      void publishCombatInterrupt(interrupt)
    })
  }

  const requestSharedAgileLeapChoice = (
    targetChar: Character,
    params: { feet: number; uses: number; maxUses: number },
  ): Promise<boolean> => {
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '灵巧跳跃',
        message:
          `闪避成功！是否无需消耗 AP 移动 ${params.feet} 尺？\n\n` +
          `该移动无视困难地形和障碍物。长休剩余 ${params.uses}/${params.maxUses} 次。`,
        confirmText: '发动',
        cancelText: '不发动',
        tone: 'sky',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return new Promise((resolve) => {
      const interrupt = createCombatInterrupt<AgileLeapInterruptPayload, AgileLeapInterruptResponse>({
        id,
        mapId: activeMap.id,
        kind: 'agile-leap',
        targetCharId: targetChar.id,
        payload: {
          targetName: targetChar.name,
          feet: params.feet,
          uses: params.uses,
          maxUses: params.maxUses,
        },
        expiresAt,
      })
      pendingSharedAgileLeapRef.current = {
        id: interrupt.id,
        targetCharId: targetChar.id,
        resolve,
      }
      void publishCombatInterrupt(interrupt)
    })
  }

  const armSharedAgileLeapMove = (targetChar: Character, feet: number, targetTokenId?: string) => {
    if (!activeMap) return false
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const actorTokenId = targetTokenId ?? latestMap.tokens.find((token) => token.characterId === targetChar.id)?.id
    if (!actorTokenId) return false
    const headless = resolveHeadlessDmAction(createHeadlessStateSnapshot(latestMap), buildAgileLeapReadyAction({
      actorTokenId,
      characterId: targetChar.id,
      feet,
    }))
    const settlement = planAgileLeapReadySettlement(headless)
    if (settlement.status === 'rejected') return false
    applyHeadlessCombatResult(headless)
    for (const log of settlement.logs) {
      pushCombatLog(log.text, log.kind)
    }
    return true
  }

  const requestSharedOpportunityAttackChoice = (
    attacker: Character,
    params: { attackerTokenId: string; targetTokenId: string; targetName: string },
  ): Promise<boolean> => {
    if (!activeMap || !isDM) {
      return showCombatDialog({
        title: '借机攻击',
        message: `${attacker.name} 对 ${params.targetName} 触发借机攻击。\n是否消耗 1 AP，进行一次近战命中判定？`,
        confirmText: '攻击',
        cancelText: '放过',
        tone: 'amber',
      })
    }
    const id = runtimeId()
    const expiresAt = runtimeNow() + 15000
    return new Promise((resolve) => {
      const interrupt = createCombatInterrupt<OpportunityAttackInterruptPayload, OpportunityAttackInterruptResponse>({
        id,
        mapId: activeMap.id,
        kind: 'opportunity-attack',
        actorCharId: attacker.id,
        payload: {
          attackerName: attacker.name,
          targetName: params.targetName,
          attackerTokenId: params.attackerTokenId,
          targetTokenId: params.targetTokenId,
        },
        expiresAt,
      })
      pendingSharedOpportunityAttackRef.current = {
        id: interrupt.id,
        attackerCharId: attacker.id,
        resolve,
      }
      void publishCombatInterrupt(interrupt)
    })
  }

  async function finishEnemyAttack(
    result: EnemyTurnResult,
    targetChar: Character | undefined,
    wantsDodge: boolean | null,
    providedDodgeD20?: number,
    dodgeApAlreadySpent = false,
    actorApAlreadySpent = false,
  ) {
    if (!activeMap || !result.attacked || !result.targetTokenId) return

    const liveMapId = activeMap.id
    const getLiveTokens = () => useMapStore.getState().maps.find((m) => m.id === liveMapId)?.tokens ?? []
    let combatLabel = ''
    let d20Roll:
      | {
          value: number
          modifier: number
          ac: number
          hit: boolean
          kind?: 'dodge' | 'save'
        }
      | undefined
    let damageRollValues = result.attack?.values ?? []
    let damageRollTotal = result.attack?.total ?? 0
    let damageRollBonus = result.attack?.bonus ?? 0
    const enemyFeatureLabels: string[] = []
    const { actorToken: enemyActorToken, targetToken: enemyTargetToken } = resolveEnemyAttackTokens(
      getLiveTokens(),
      result,
    )
    const enemyResolutionSession = createCombatResolutionSessionForAction({
      actorToken: enemyActorToken,
      targetToken: enemyTargetToken,
      actorCharacterId: enemyActorToken?.characterId,
      targetCharacterId: targetChar?.id ?? result.targetCharacterId ?? enemyTargetToken?.characterId,
      skill: undefined,
      tags: ['enemy-action', result.damageType ?? 'physical'],
    })
    const runEnemyStage = (stage: CombatResolutionStage) =>
      runCombatResolutionStage(enemyResolutionSession, stage)
    let enemyAttackApAlreadySpent = actorApAlreadySpent
    await runEnemyStage('actionDeclared')

    const inferEnemyDamageDiceCount = (attack: NonNullable<EnemyTurnResult['attack']>) => {
      if (attack.values.length > 0) return attack.values.length
      const match = attack.label.match(/(\d+)\s*d\s*(\d+)/i)
      if (match && Number(match[2]) === attack.sides) {
        return Math.max(1, Number(match[1]))
      }
      return 1
    }

    const rollEnemyBaseDamageDice = async () => {
      if (!result.attack) return []
      return rollDiceBoxValues(
        inferEnemyDamageDiceCount(result.attack),
        result.attack.sides,
        `${result.attack.label} 伤害`,
        result.attack.targetName,
      )
    }

    const updateEnemyDamageContext = (amount: number) => {
      if (!enemyResolutionSession || !result.attack) return
      const rollTotal = damageRollValues.reduce((sum, value) => sum + value, 0)
      enemyResolutionSession.context.damageRoll = {
        values: [...damageRollValues],
        sides: result.attack.sides,
        bonus: damageRollBonus,
        total: amount,
        label: result.attack.label,
      }
      enemyResolutionSession.context.pendingDamage = [
        {
          id: `${enemyResolutionSession.context.actionId}:damage:${result.targetTokenId ?? 'target'}`,
          source: {
            tokenId: result.attackerTokenId ?? enemyActorToken?.id ?? '',
            characterId: enemyActorToken?.characterId,
          },
          target: {
            tokenId: result.targetTokenId ?? '',
            characterId: targetChar?.id ?? result.targetCharacterId ?? enemyTargetToken?.characterId,
          },
          amount,
          damageType: result.damageType ?? 'physical',
          roll: enemyResolutionSession.context.damageRoll,
          tags: ['enemy-damage'],
        },
      ]
      if (rollTotal !== amount) {
        enemyResolutionSession.context.scratch.damageAdjustment = amount - rollTotal
      }
    }

    const hasEnemyDamage = !!result.attack || (result.damage != null && result.damage > 0)

    const maybeUseArcaneSurgeFromPreview = async (preview: HeadlessCombatResult, character: Character) => {
      if (!preview.ok) return false
      const surge = findClassTrait(character, 'arcaneSurge')
      if (!surge || surge.uses <= 0 || character.currentHp <= 0) return false
      const previewCharacter = preview.state.characters.find((item) => item.id === character.id)
      if (!previewCharacter || previewCharacter.currentHp > 0) return false
      return showCombatDialog({
        title: '魔法浪涌',
        message: `${character.name} 将受到致命伤害。\n是否消耗 1 次使用，把生命改为 1？`,
        confirmText: '发动',
        cancelText: '不发动',
        tone: 'violet',
      })
    }

    const tryResolvePhysicalEnemyAttackWithHeadless = async () => {
      const damageType = result.damageType ?? 'physical'
      if (
        !targetChar ||
        !result.attack ||
        !result.attackerTokenId ||
        !result.targetTokenId ||
        damageType !== 'physical'
      ) {
        return false
      }
      const latestMap = useMapStore.getState().maps.find((map) => map.id === liveMapId) ?? activeMap
      const attackerToken = latestMap.tokens.find((token) => token.id === result.attackerTokenId)
      if (!attackerToken?.poolId) return false
      const huntedByTargetRank = huntingMarkTraitRank(targetChar)

      const actionDef = getEnemyStatBlock(attackerToken.poolId)?.actions[result.actionIndex ?? 0]
      const attackBonus = actionDef?.toHit ?? ENEMY_MELEE_ATTACK_BONUS
      const targetDodgeD20 = wantsDodge
        ? providedDodgeD20 ?? (await rollDiceBoxD20('闪避判定 D20', targetChar.name))
        : undefined
      const targetAc = targetChar.ac + (wantsDodge ? Math.max(0, targetChar.combatBuffs?.flexibleBodyBonus ?? 0) : 0)
      const expectedDodged = targetDodgeD20 != null ? targetDodgeD20 + attackBonus < targetAc : false
      const headlessDamageValues = expectedDodged ? undefined : await rollEnemyBaseDamageDice()
      const huntingBacklashValues =
        !expectedDodged && (attackerToken.huntingMarkStacks ?? 0) > 0 && huntedByTargetRank > 0
          ? await rollDiceBoxValues(huntedByTargetRank, 4, '狩猎印记反噬伤害', result.attack.targetName)
          : undefined
      const headlessSnapshot = createHeadlessStateSnapshot(latestMap)
      const headlessAction = {
        type: 'enemy-attack-token',
        actorTokenId: result.attackerTokenId,
        targetTokenId: result.targetTokenId,
        actionIndex: result.actionIndex,
        diceValues: headlessDamageValues,
        huntingBacklashValues,
        actorApAlreadySpent: enemyAttackApAlreadySpent,
        targetWantsDodge: !!wantsDodge,
        targetDodgeD20,
        targetDodgeApAlreadySpent: dodgeApAlreadySpent,
      } as const
      const preview = resolveHeadlessDmAction(headlessSnapshot, headlessAction)
      if (!preview.ok) return false
      const useArcaneSurgeOnLethal = await maybeUseArcaneSurgeFromPreview(preview, targetChar)
      const headless = useArcaneSurgeOnLethal
        ? resolveHeadlessDmAction(headlessSnapshot, {
            ...headlessAction,
            useArcaneSurgeOnLethal: true,
          })
        : preview
      if (!headless.ok) return false
      const resolved = enemyAttackResolvedEvent(headless.events)
      if (!resolved) return false

      applyHeadlessCombatResult(headless)
      const attackerName = latestMap.tokens.find((token) => token.id === result.attackerTokenId)?.label ?? '敌人'
      const targetName =
        latestMap.tokens.find((token) => token.id === result.targetTokenId)?.label ?? result.attack?.targetName ?? '目标'
      const enemyApLog = planEnemyAttackApLog({
        result: headless,
        actorTokenId: result.attackerTokenId,
        attackerName,
        targetName,
        fallbackApMax: getEnemyApState(result.attackerTokenId).max,
      })
      if (enemyApLog) {
        enemyAttackApAlreadySpent = true
        pushCombatLog(enemyApLog.text, enemyApLog.kind)
      }
      damageRollValues = resolved.damageValues
      damageRollTotal = resolved.total
      damageRollBonus = resolved.total - resolved.diceTotal
      combatLabel = resolved.dodgeD20 != null
        ? `闪避判定 ${resolved.dodgeD20}+${resolved.dodgeAttackBonus ?? 0}=${resolved.dodgeTotal ?? 0} vs AC ${
            resolved.targetAc ?? targetAc
          } ${resolved.targetDodged ? '成功' : '失败'}`
        : '受击（未尝试闪避）'
      if (resolved.arcaneSurgeUsed) {
        combatLabel = `${combatLabel} · 魔法浪涌：生命保留为 1`
      }
      d20Roll = resolved.dodgeD20 != null
        ? {
            value: resolved.dodgeD20,
            modifier: resolved.dodgeAttackBonus ?? attackBonus,
            ac: resolved.targetAc ?? targetAc,
            hit: !resolved.targetDodged,
            kind: 'dodge',
          }
        : undefined
      if (wantsDodge && !dodgeApAlreadySpent) {
        const attackerName = latestMap.tokens.find((token) => token.id === result.attackerTokenId)?.label ?? '敌人'
        pushApLog(targetChar, 1, '尝试闪避', `应对 ${attackerName} 的攻击`)
      }
      if (resolved.targetDodged && canOfferAgileLeap(targetChar)) {
        const trait = findClassTrait(targetChar, 'agileLeap')
        const feet = agileLeapMoveFeet(targetChar)
        const accepted = await requestSharedAgileLeapChoice(targetChar, {
          feet,
          uses: trait?.uses ?? 0,
          maxUses: trait?.maxUses ?? 0,
        })
        if (accepted) {
          if (armSharedAgileLeapMove(targetChar, feet, result.targetTokenId)) {
            combatLabel += ` · 灵巧跳跃：点击地图移动至多 ${feet} 尺`
          }
        }
      }
      if (result.attack) {
        const display = planEnemyAttackSettlement({
          result: headless,
          attack: result.attack,
          combatLabel,
          d20Roll,
        })
        if (display.status === 'rejected') {
          pushCombatLog(display.log.text, display.log.kind)
          return false
        }
        if (display.status === 'accepted') {
          damageRollValues = display.damageValues
          damageRollTotal = display.damageTotal
          damageRollBonus = display.damageBonus
          setRoll(display.roll)
          publishSharedDiceRoll(display.roll)
          pushCombatLog(display.combatLog.text, display.combatLog.kind)
        }
      }
      return true
    }

    const tryResolveEnemyAoeAttackWithHeadless = async () => {
      const damageType = result.damageType ?? 'physical'
      if (
        !targetChar ||
        !result.attack ||
        !result.attackerTokenId ||
        !result.targetTokenId ||
        damageType !== 'aoe'
      ) {
        return false
      }
      const latestMap = useMapStore.getState().maps.find((map) => map.id === liveMapId) ?? activeMap
      const attackerToken = latestMap.tokens.find((token) => token.id === result.attackerTokenId)
      if (!attackerToken?.poolId) return false
      const actionDef = getEnemyStatBlock(attackerToken.poolId)?.actions[result.actionIndex ?? 0]
      if (!actionDef || actionDef.kind !== 'aoe' || !actionDef.save) return false

      await runEnemyStage('beforeDamageRoll')
      const values = await rollEnemyBaseDamageDice()
      const diceTotal = values.reduce((sum, value) => sum + value, 0)
      const fullDamage = Math.max(0, diceTotal + result.attack.bonus)
      updateEnemyDamageContext(fullDamage)
      await runEnemyStage('damageRolled')

      const saveD20 = await rollDiceBoxD20('豁免判定 D20', targetChar.name)
      const saveMod = getEffectiveAbilityMod(targetChar, actionDef.save.ability)
      const saveTotal = saveD20 + saveMod
      const saveSuccess = saveTotal >= actionDef.save.dc
      const damageAfterSave = saveSuccess ? Math.floor(fullDamage / 2) : fullDamage
      let useStableMind = false
      const stableMindTrait = findClassTrait(targetChar, 'stableMind')
      if (saveSuccess && damageAfterSave > 0 && stableMindTrait && stableMindTrait.uses > 0 && targetChar.currentAP >= 1) {
        useStableMind = await requestSharedStableMindChoice(targetChar, {
          fullDamage,
          damageAfterSave,
          saveD20,
          saveMod,
          saveTotal,
          dc: actionDef.save.dc,
        })
      }

      const headlessSnapshot = createHeadlessStateSnapshot(latestMap)
      const headlessAction = {
        type: 'enemy-attack-token',
        actorTokenId: result.attackerTokenId,
        targetTokenId: result.targetTokenId,
        actionIndex: result.actionIndex,
        diceValues: values,
        saveD20,
        useStableMind,
        actorApAlreadySpent: enemyAttackApAlreadySpent,
      } as const
      const preview = resolveHeadlessDmAction(headlessSnapshot, headlessAction)
      if (!preview.ok) return false
      const useArcaneSurgeOnLethal = await maybeUseArcaneSurgeFromPreview(preview, targetChar)
      const headless = useArcaneSurgeOnLethal
        ? resolveHeadlessDmAction(headlessSnapshot, {
            ...headlessAction,
            useArcaneSurgeOnLethal: true,
          })
        : preview
      if (!headless.ok) return false
      const resolved = enemyAttackResolvedEvent(headless.events)
      if (!resolved) return false

      combatLabel = `豁免 ${resolved.saveD20 ?? saveD20}+${resolved.saveMod ?? saveMod} vs DC${resolved.saveDc ?? actionDef.save.dc} ${
        resolved.saveSuccess ? `成功（半伤，实际 ${resolved.total}）` : `失败（全额，实际 ${resolved.total}）`
      }${resolved.stableMindUsed ? ' · 残影脱身：已抵消全部伤害' : ''}${resolved.arcaneSurgeUsed ? ' · 魔法浪涌：生命保留为 1' : ''}`
      d20Roll = {
        value: resolved.saveD20 ?? saveD20,
        modifier: resolved.saveMod ?? saveMod,
        ac: resolved.saveDc ?? actionDef.save.dc,
        hit: !!resolved.saveSuccess,
        kind: 'save',
      }
      damageRollValues = resolved.damageValues
      damageRollTotal = resolved.total
      damageRollBonus = resolved.total - resolved.diceTotal
      if (enemyResolutionSession) {
        enemyResolutionSession.context.attackRoll = {
          values: [d20Roll.value],
          sides: 20,
          bonus: d20Roll.modifier,
          total: d20Roll.value + d20Roll.modifier,
          ac: d20Roll.ac,
          hit: d20Roll.hit,
          crit: false,
          label: 'save',
        }
        enemyResolutionSession.context.pendingDamage = enemyResolutionSession.context.pendingDamage.map((packet) => ({
          ...packet,
          amount: resolved.total,
        }))
      }
      await runEnemyStage('attackRollResolved')
      if (resolved.total > 0) await runEnemyStage('beforeDamageApplied')
      applyHeadlessCombatResult(headless)
      const enemyApLog = planEnemyAttackApLog({
        result: headless,
        actorTokenId: result.attackerTokenId,
        attackerName: attackerToken.label,
        targetName: targetChar.name,
        fallbackApMax: getEnemyApState(result.attackerTokenId).max,
      })
      if (enemyApLog) {
        enemyAttackApAlreadySpent = true
        pushCombatLog(enemyApLog.text, enemyApLog.kind)
      }
      for (const event of headless.events) {
        if (event.type === 'log') pushCombatLog(event.text, 'turn')
      }
      if (resolved.total > 0) {
        if (enemyResolutionSession) {
          enemyResolutionSession.context.appliedDamage = enemyResolutionSession.context.pendingDamage.map((packet) => ({
            ...packet,
            amount: resolved.total,
          }))
        }
        await runEnemyStage('damageApplied')
      }
      const display = planEnemyAttackSettlement({
        result: headless,
        attack: result.attack,
        combatLabel,
        d20Roll,
      })
      if (display.status === 'rejected') {
        pushCombatLog(display.log.text, display.log.kind)
        return false
      }
      if (display.status === 'accepted') {
        damageRollValues = display.damageValues
        damageRollTotal = display.damageTotal
        damageRollBonus = display.damageBonus
        setRoll(display.roll)
        publishSharedDiceRoll(display.roll)
        pushCombatLog(display.combatLog.text, display.combatLog.kind)
      }
      return true
    }

    if (targetChar && hasEnemyDamage) {
      const damageType = result.damageType ?? 'physical'
      if (await tryResolveEnemyAoeAttackWithHeadless()) {
        return
      }
      if (await tryResolvePhysicalEnemyAttackWithHeadless()) {
        return
      }
      pushCombatLog(`${result.attack?.label ?? '敌人攻击'} 未能通过 DM 引擎验证，已取消结算（${damageType}）。`, 'turn')
      return
    } else if (result.targetCharacterId != null && hasEnemyDamage) {
      pushCombatLog(`${result.attack?.label ?? '敌人攻击'} 缺少可验证目标 token，已取消结算。`, 'turn')
      return
    } else if (!targetChar && hasEnemyDamage) {
      pushCombatLog(`${result.attack?.label ?? '敌人攻击'} 缺少绑定角色，已取消结算。`, 'turn')
      return
    }
    // [T7/AC4] 移除死分支：EnemyTurnResult.targetTokenPatch 从无生产者，已连同接口字段删除。
    if (result.attack) {
      const labelParts = [combatLabel, ...enemyFeatureLabels].filter(Boolean)
      const attackLabel = labelParts.length > 0
        ? `${result.attack.label} · ${labelParts.join(' · ')}`
        : result.attack.label
      const enemyRollForDisplay: DiceRoll = {
        values: damageRollValues,
        sides: result.attack.sides,
        bonus: damageRollBonus,
        total: damageRollTotal,
        label: attackLabel,
        formula:
          damageRollValues.length > 0
            ? `${damageRollValues.join(' + ')}${damageRollBonus >= 0 ? ' + ' : ' - '}${Math.abs(damageRollBonus)} = ${damageRollTotal}`
            : undefined,
        targetName: result.attack.targetName,
        d20Roll,
      }
      setRoll(enemyRollForDisplay)
      publishSharedDiceRoll(enemyRollForDisplay)
      pushCombatLog(
        `${result.attack.label} → ${result.attack.targetName}：伤害骰 ${damageRollValues.length > 0 ? damageRollValues.join(' + ') : '无'}，加值 ${damageRollBonus}，最终 ${damageRollTotal} 点${combatLabel ? `；${combatLabel}` : ''}`,
        damageRollTotal > 0 ? 'damage' : 'attack',
      )
    }
    await runEnemyStage('afterDamageApplied')
    await runEnemyStage('actionResolved')
  }

  useEffect(() => {
    if (!activeMap) return
    let cancelled = false
    const load = async () => {
      const queue = await loadSharedResource<SharedCombatInterruptQueueState>(COMBAT_INTERRUPT_RESOURCE)
      if (cancelled || !queue || queue.mapId !== activeMap.id) return
      const now = runtimeNow()

      if (isDM) {
        const settlements = resolveDmCombatInterruptSettlements({
          queue,
          mapId: activeMap.id,
          now,
          pending: {
            dodge: pendingSharedDodgeRef.current?.id,
            stableMind: pendingSharedStableMindRef.current?.id,
            galeCombo: pendingSharedGaleComboRef.current?.id,
            agileLeap: pendingSharedAgileLeapRef.current?.id,
            opportunityAttack: pendingSharedOpportunityAttackRef.current?.id,
          },
        })
        for (const settlement of settlements) {
          switch (settlement.kind) {
            case 'dodge': {
              const pending = pendingSharedDodgeRef.current
              if (!pending || pending.id !== settlement.id) break
              pendingSharedDodgeRef.current = null
              await finishSharedCombatInterrupt(settlement.id, settlement.finishResponse)
              const targetChar = useCharacterStore.getState().characters.find((c) => c.id === pending.targetCharId)
              if (targetChar) {
                void finishEnemyAttack(
                  pending.result,
                  targetChar,
                  settlement.wantsDodge,
                  settlement.dodgeD20,
                  false,
                ).then(pending.onComplete)
              } else {
                pending.onComplete()
              }
              break
            }
            case 'stable-mind': {
              const pending = pendingSharedStableMindRef.current
              if (!pending || pending.id !== settlement.id) break
              pendingSharedStableMindRef.current = null
              await finishSharedCombatInterrupt(settlement.id, settlement.finishResponse)
              pending.resolve(settlement.useStableMind)
              break
            }
            case 'gale-combo': {
              const pending = pendingSharedGaleComboRef.current
              if (!pending || pending.id !== settlement.id) break
              pendingSharedGaleComboRef.current = null
              await finishSharedCombatInterrupt(settlement.id, settlement.finishResponse)
              pending.resolve(settlement.decision)
              break
            }
            case 'agile-leap': {
              const pending = pendingSharedAgileLeapRef.current
              if (!pending || pending.id !== settlement.id) break
              pendingSharedAgileLeapRef.current = null
              await finishSharedCombatInterrupt(settlement.id, settlement.finishResponse)
              pending.resolve(settlement.useAgileLeap)
              break
            }
            case 'opportunity-attack': {
              const pending = pendingSharedOpportunityAttackRef.current
              if (!pending || pending.id !== settlement.id) break
              pendingSharedOpportunityAttackRef.current = null
              await finishSharedCombatInterrupt(settlement.id, settlement.finishResponse)
              pending.resolve(settlement.useOpportunityAttack)
              break
            }
          }
        }
        return
      }

      const answerContext = {
        characters,
        visibleCharacters: visibleChars,
        playerCharId: playerChar?.id,
        assignedCharacterId,
        tokens: activeMap.tokens,
      }
      const selection = resolveCombatInterruptPromptSelection({
        queue,
        mapId: activeMap.id,
        now,
        answerContext,
        suppressed: {
          dodge: suppressedDodgePromptIdsRef.current,
          'stable-mind': suppressedStableMindPromptIdsRef.current,
          'gale-combo': suppressedGaleComboPromptIdsRef.current,
          'agile-leap': suppressedAgileLeapPromptIdsRef.current,
          'opportunity-attack': suppressedOpportunityAttackPromptIdsRef.current,
        },
      })
      const views = buildCombatInterruptPromptViews(selection)

      setNullablePromptView(setSharedDodgePrompt, views.dodge)
      setNullablePromptView(setSharedStableMindPrompt, views.stableMind)
      setNullablePromptView(setSharedGaleComboPrompt, views.galeCombo)
      setNullablePromptView(setSharedAgileLeapPrompt, views.agileLeap)
      setNullablePromptView(setSharedOpportunityAttackPrompt, views.opportunityAttack)
    }
    void load()
    const timer = window.setInterval(load, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeMap?.id, assignedCharacterId, isDM, characters, playerChar?.id, visibleChars])

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
    const targetChar = resolveAttackTargetCharacter(targetToken, chars, result.targetCharacterId)
    const targetAlive =
      !targetChar ||
      (targetChar.currentHp > 0 &&
        !pendingDeathKeysRef.current.has(`${result.targetTokenId}:${targetChar.id}`))
    if (targetChar && !targetAlive) {
      completeIfCombatContinues()
      return
    }
    const damageType = result.damageType ?? 'physical'
    const canDodge =
      !!targetChar &&
      damageType !== 'aoe' &&
      result.damage != null &&
      result.damage > 0 &&
      canAttemptDodge(targetChar)

    if (canDodge) {
      if (isDM && activeMap) {
        const id = runtimeId()
        const expiresAt = runtimeNow() + 15000
        const interrupt = createCombatInterrupt<DodgeInterruptPayload, DodgeInterruptResponse>({
          id,
          mapId: activeMap.id,
          kind: 'dodge',
          targetCharId: targetChar!.id,
          payload: {
            result,
            targetName: targetChar!.name,
          },
          expiresAt,
        })
        pendingSharedDodgeRef.current = {
          id: interrupt.id,
          result,
          targetCharId: targetChar!.id,
          onComplete: completeIfCombatContinues,
        }
        void publishCombatInterrupt(interrupt)
        return
      }
      setDodgePrompt({ result, targetChar: targetChar!, onComplete: completeIfCombatContinues })
      return
    }

    const autoAccept =
      !!targetChar && damageType !== 'aoe' && result.damage != null && result.damage > 0
    void finishEnemyAttack(result, targetChar, autoAccept ? false : null).then(completeIfCombatContinues)
  }

  const handleDodgeChoice = (wantsDodge: boolean) => {
    if (!dodgePrompt) return
    const { result, targetChar, onComplete } = dodgePrompt
    const latest = useCharacterStore.getState().characters.find((c) => c.id === targetChar.id)
    if (
      !latest ||
      latest.currentHp <= 0 ||
      pendingDeathKeysRef.current.has(`${result.targetTokenId}:${targetChar.id}`)
    ) {
      onComplete()
      return
    }
    if (wantsDodge) {
      const windBladeFreeDodge = (latest.combatBuffs?.windBladeFreeDodgeTurns ?? 0) > 0
      if (!windBladeFreeDodge && !canAttemptDodge(latest)) {
        void showCombatNotice('行动点不足', '无法尝试闪避。', 'amber')
        return
      }
    }
    setDodgePrompt(null)
    void finishEnemyAttack(result, latest, wantsDodge).then(onComplete)
  }

  const handleSharedDodgeChoice = async (wantsDodge: boolean) => {
    if (!sharedDodgePrompt || !activeMap) return
    const prompt = sharedDodgePrompt
    const latestTarget =
      useCharacterStore.getState().characters.find((c) => c.id === prompt.targetChar.id) ?? prompt.targetChar
    suppressedDodgePromptIdsRef.current.add(prompt.id)
    setSharedDodgePrompt(null)
    if (!wantsDodge) {
      await answerSharedCombatInterrupt(prompt.id, { wantsDodge: false })
      return
    }
    await markSharedCombatInterruptRolling(prompt.id, { wantsDodge: true })
    const dodgeD20 = await rollDiceBoxD20('闪避判定 D20', latestTarget.name)
    publishSharedDiceRoll({
      values: [],
      sides: 20,
      bonus: 0,
      total: 0,
      label: '闪避判定',
      targetName: latestTarget.name,
      d20Roll: {
        value: dodgeD20,
        modifier: ENEMY_MELEE_ATTACK_BONUS,
        ac: latestTarget.ac,
        hit: dodgeD20 + ENEMY_MELEE_ATTACK_BONUS >= latestTarget.ac,
        kind: 'dodge',
      },
    })
    await answerSharedCombatInterrupt(prompt.id, { wantsDodge: true, dodgeD20 })
  }

  const handleSharedStableMindChoice = async (useStableMind: boolean) => {
    if (!sharedStableMindPrompt || !activeMap) return
    const prompt = sharedStableMindPrompt
    suppressedStableMindPromptIdsRef.current.add(prompt.id)
    setSharedStableMindPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useStableMind })
  }

  const handleSharedGaleComboChoice = async (useGaleCombo: boolean) => {
    if (!sharedGaleComboPrompt || !activeMap) return
    const prompt = sharedGaleComboPrompt
    suppressedGaleComboPromptIdsRef.current.add(prompt.id)
    setSharedGaleComboPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useGaleCombo })
  }

  const handleSharedAgileLeapChoice = async (useAgileLeap: boolean) => {
    if (!sharedAgileLeapPrompt || !activeMap) return
    const prompt = sharedAgileLeapPrompt
    suppressedAgileLeapPromptIdsRef.current.add(prompt.id)
    setSharedAgileLeapPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useAgileLeap })
  }

  const handleSharedOpportunityAttackChoice = async (useOpportunityAttack: boolean) => {
    if (!sharedOpportunityAttackPrompt || !activeMap) return
    const prompt = sharedOpportunityAttackPrompt
    suppressedOpportunityAttackPromptIdsRef.current.add(prompt.id)
    setSharedOpportunityAttackPrompt(null)
    await answerSharedCombatInterrupt(prompt.id, { useOpportunityAttack })
  }

  const scheduleEnemyTurn = async (enemy: Token) => {
    if (!activeMap) return
    const enemyTurnKey = `${round}-${initiativeIndex}-${enemy.id}`
    // [T2/A7] Capture the round this turn was scheduled in. A long second-strike timer
    // (DICE_ROLL_MS + 5000) can outlive nextRound(); without this check a stale strike
    // that fires after the round wrapped to index 0 onto the SAME enemy token would pass
    // the token-identity check and double-advance. (nextRound() also clears pending timers.)
    const scheduledRound = roundRef.current
    const isStillEnemyTurn = () => {
      if (!combatActive) return false
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
      enemyTurnTimersRef.current.push(id)
      return
    }
    const advanceEnemyIfCurrent = () => {
      const current = initiativeOrderRef.current[initiativeIndexRef.current]
      if (!current || current.tokenId !== enemy.id) return
      if (!enemyAppliedKeysRef.current.has(enemyTurnKey)) return
      if (roundRef.current !== scheduledRound) return
      requestAdvance()
    }
    const startingAp = getEnemyApState(enemy.id).current
    if (startingAp <= 0) {
      const id = window.setTimeout(advanceEnemyIfCurrent, 300)
      enemyTurnTimersRef.current.push(id)
      return
    }
    const result = planEnemyTurn(activeMap, enemy, useCharacterStore.getState().characters, startingAp, { round })
    if (result.newPosition && !isTokenMovementLocked(enemy)) {
      // [T4/C4] a restrained/no-move enemy may still attack but cannot reposition.
      if (!isStillEnemyTurn()) return
      const moveApSpent = result.moveApSpent ?? 1
      await resolveOpportunityAttacksForMove(enemy, result.newPosition)
      if (!isStillEnemyTurn()) return
      const latestMap = useMapStore.getState().maps.find((m) => m.id === activeMap.id)
      const latestEnemy = latestMap?.tokens.find((t) => t.id === enemy.id) ?? enemy
      if (!isTokenAlive(latestEnemy, useCharacterStore.getState().characters)) {
        const id = window.setTimeout(advanceEnemyIfCurrent, ADVANCE_DELAY_MS)
        enemyTurnTimersRef.current.push(id)
        return
      }
      if (!(await resolveEnemyMoveThroughHeadless(latestEnemy, result.newPosition, moveApSpent, '移动'))) {
        const id = window.setTimeout(advanceEnemyIfCurrent, 300)
        enemyTurnTimersRef.current.push(id)
        return
      }
    }

    const pushTimer = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      enemyTurnTimersRef.current.push(id)
    }

    if (!result.attacked) {
      pushTimer(advanceEnemyIfCurrent, result.moved ? TOKEN_MOVE_MS : 400)
      return
    }

    const attack = () => {
      if (!isStillEnemyTurn()) return
      if (getEnemyApState(enemy.id).current < 1) {
        pushTimer(advanceEnemyIfCurrent, 300)
        return
      }
      applyEnemyAttack(result, () => {
        const apLeft = getEnemyApState(enemy.id).current
        const latestMap = useMapStore.getState().maps.find((m) => m.id === activeMap.id)
        const latestEnemy = latestMap?.tokens.find((t) => t.id === enemy.id)
        if (apLeft > 0 && latestMap && latestEnemy && isTokenAlive(latestEnemy, useCharacterStore.getState().characters)) {
          if (!isStillEnemyTurn()) return
          const nextResult = planEnemyTurn(latestMap, latestEnemy, useCharacterStore.getState().characters, apLeft, { round })
          if (nextResult.newPosition && !isTokenMovementLocked(latestEnemy)) {
            pushTimer(async () => {
              if (!isStillEnemyTurn()) return
              const moveApSpent = nextResult.moveApSpent ?? 1
              await resolveOpportunityAttacksForMove(latestEnemy, nextResult.newPosition!)
              if (!isStillEnemyTurn()) return
              const stillAliveMap = useMapStore.getState().maps.find((m) => m.id === activeMap.id)
              const stillAliveEnemy = stillAliveMap?.tokens.find((t) => t.id === enemy.id) ?? latestEnemy
              if (!isTokenAlive(stillAliveEnemy, useCharacterStore.getState().characters)) {
                pushTimer(advanceEnemyIfCurrent, ADVANCE_DELAY_MS)
                return
              }
              if (!(await resolveEnemyMoveThroughHeadless(stillAliveEnemy, nextResult.newPosition!, moveApSpent, '继续移动'))) {
                pushTimer(advanceEnemyIfCurrent, 300)
                return
              }
              pushTimer(advanceEnemyIfCurrent, nextResult.attacked ? TOKEN_MOVE_MS : 300)
            }, DICE_ROLL_MS + 5000)
            return
          }
          if (nextResult.attacked && !nextResult.newPosition) {
            pushTimer(() => {
              if (!isStillEnemyTurn()) return
              if (getEnemyApState(enemy.id).current < 1) {
                pushTimer(advanceEnemyIfCurrent, 300)
                return
              }
              applyEnemyAttack(nextResult, () => {
                pushTimer(advanceEnemyIfCurrent, ADVANCE_DELAY_MS)
              })
              return
            }, DICE_ROLL_MS + 5000)
            return
          }
        }
        pushTimer(advanceEnemyIfCurrent, ADVANCE_DELAY_MS)
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
    const latestMap = useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap
    const curToken = latestMap.tokens.find((token) => token.id === current.tokenId)
    const previousRound = roundRef.current
    const headless = resolveHeadlessDmAction(
      createHeadlessStateSnapshot(latestMap),
      buildHeadlessEndTurnAction({
        actorTokenId: current.tokenId,
        characterId: curToken?.characterId,
      }),
    )
    if (!headless.ok) {
      pushCombatLog(`回合推进失败：${headless.reason}`, 'system')
      return
    }
    applyHeadlessCombatResult(headless)
    for (const event of headless.events) {
      if (event.type === 'log') pushCombatLog(event.text, 'turn')
      if (event.type === 'turn-advanced' && event.round > previousRound) {
        pushCombatLog(`进入第 ${event.round} 回合`, 'turn', event.round)
        setInitiativeScroll(0)
      }
    }
  }

  // [T2/A10/A12] Single reentrancy-guarded entry point for ALL automatic advances
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
    if (isEnemyTurn) return
    requestAdvance()
  }

  const acknowledgePlayerAction = (
    action: SharedPlayerActionState,
    status: SharedPlayerActionAckState['status'],
    reason?: string,
    acceptedPosition?: { x: number; y: number },
  ) => {
    if (!activeMap || mode !== 'dm') return
    const appliedAt = runtimeNow()
    const baseline = playerActionResultBaselinesRef.current[action.id]
    const afterBaseline =
      status === 'accepted' && baseline
        ? capturePlayerActionResultBaseline({
              characters: useCharacterStore.getState().characters,
              map: useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap,
              enemyApByToken: enemyApByTokenRef.current,
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
          }
        : undefined
    void publishPlayerActionAckWithSnapshots({
      ack,
      snapshots,
      saveSharedResource,
      publishAck: (eventAck) =>
        publishSharedEvent<SharedPlayerActionAckState>('player-action-dm-to-player', eventAck),
    })
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

  const offerGaleComboAfterDamageApplied = async (
    casterId: string,
    fallbackCaster: Character,
    triggerLabel = '对目标造成击飞，且目标豁免失败',
  ) => {
    const latestCaster = useCharacterStore.getState().characters.find((c) => c.id === casterId) ?? fallbackCaster
    if (!canOfferGaleCombo(latestCaster)) {
      const reason = galeComboUnavailableReason(latestCaster)
      pushCombatLog(`${latestCaster.name} 满足疾风连击触发条件，但不能发动${reason ? `：${reason}` : ''}。`, 'system')
      return false
    }
    pushCombatLog(`${latestCaster.name} 触发疾风连击：当前结算完成，等待确认。`, 'turn')
    const decision = await requestSharedGaleComboChoice(latestCaster, triggerLabel)
    if (decision !== 'accepted') {
      pushCombatLog(
        decision === 'timeout'
          ? `${latestCaster.name} 疾风连击确认超时，未发动。`
          : `${latestCaster.name} 暂不发动疾风连击。`,
        decision === 'timeout' ? 'system' : 'turn',
      )
      return false
    }
    if (!activeMap) return false
    const headless = resolveHeadlessGaleComboChoice(
      createHeadlessStateSnapshot(activeMap),
      buildGaleComboChoiceParams({
        characterId: casterId,
        triggerLabel,
      }),
    )
    const settlement = planGaleComboChoiceSettlement({
      result: headless,
      casterName: latestCaster.name,
    })
    if (settlement.status === 'rejected') {
      pushCombatLog(settlement.log.text, settlement.log.kind)
      return false
    }
    applyHeadlessCombatResult({ ok: true, state: headless.state, events: headless.events })
    for (const log of settlement.logs) {
      pushCombatLog(log.text, log.kind)
    }
    return true
  }

  const maybeOfferGaleComboAfterHeadlessDamage = async (
    caster: Character,
    skill: CombatSkill,
    events: HeadlessCombatEvent[],
  ) => {
    if (skill.skillTreeId !== 'whirlwindKick') return false
    const causedKnockback = events.some(
      (event) => event.type === 'status-added' && event.condition === KNOCKBACK_STATUS_LABEL,
    )
    if (!causedKnockback) return false
    return offerGaleComboAfterDamageApplied(caster.id, caster)
  }

  const settleHeadlessPlayerAction = (
    action: SharedPlayerActionState,
    result: HeadlessCombatResult,
    options?: {
      acceptedPosition?: { x: number; y: number }
      acceptedReason?: string
      beforeComplete?: () => void
      previousRound?: number
      rejectReason?: (reason: string) => string
    },
  ): boolean => {
    const plan = planHeadlessPlayerActionSettlement({
      action,
      result,
      acceptedPosition: options?.acceptedPosition,
      acceptedReason: options?.acceptedReason,
      previousRound: options?.previousRound,
      rejectReason: options?.rejectReason,
    })
    if (plan.status === 'rejected') {
      if (action.sourceMode === 'dm') {
        pushCombatLog(`本地行动未执行：${plan.ackReason ?? 'unknown'}`, 'system')
      }
      acknowledgePlayerAction(action, 'rejected', plan.ackReason)
      if (plan.shouldComplete) completePlayerActionRequest(action)
      return false
    }
    applyHeadlessCombatResult(result)
    for (const log of plan.logs) {
      pushCombatLog(log.text, log.kind, log.round)
    }
    options?.beforeComplete?.()
    if (plan.shouldComplete) completePlayerActionRequest(action)
    acknowledgePlayerAction(action, 'accepted', plan.acceptedReason, plan.acceptedPosition)
    return true
  }

  const settleSimpleHeadlessMoveAction = (
    action: SharedPlayerActionState,
    token: Token,
    result: HeadlessCombatResult,
  ): boolean => {
    const moved = result.ok ? tokenMovedEvent(result.events, token.id) : undefined
    return settleHeadlessPlayerAction(action, result, {
      acceptedPosition: moved?.to ?? { x: token.x, y: token.y },
      rejectReason: (reason) => (reason === 'movement-locked' ? 'no-move' : reason),
    })
  }

  const enemyDodgePreview = (target: Token, attacker: Character, skill: CombatSkill) => {
    if (!combatActiveRef.current || target.type !== 'enemy') return null
    const ap = getEnemyApState(target.id)
    if (ap.current < 1) return null
    const attackAbility = skill.tags?.includes('melee') ? 'str' : 'dex'
    const attackBonus = getEffectiveAbilityMod(attacker, attackAbility) + proficiencyBonus(attacker.level)
    const targetAc = getTokenTargetAc(target) ?? 12
    const diceCount = attackDamageDiceCount(skill, false)
    const estimatedDamage = diceCount * ((skill.damageSides + 1) / 2) + (skill.damageBonus ?? 0)
    const decision = decideDodge({
      currentAp: ap.current,
      currentHp: target.hp ?? target.maxHp ?? 1,
      maxHp: target.maxHp ?? target.hp ?? 1,
      targetAc,
      incomingAttackBonus: attackBonus,
      estimatedDamage,
    })
    return { decision, attackBonus, targetAc }
  }

  const handlePlayerActionRequest = async (action: SharedPlayerActionState) => {
    const liveRound = roundRef.current
    const liveIndex = initiativeIndexRef.current
    const current = initiativeOrderRef.current[liveIndex]
    const preflight = preflightPlayerActionAuthority(action, {
      isDm: isDM,
      activeMap,
      combatId: combatIdRef.current,
      combatActive: combatActiveRef.current,
      round: liveRound,
      initiativeIndex: liveIndex,
      currentTokenId: current?.tokenId,
      processedActionIds: processedPlayerActionIdsRef.current,
      seenActionIds: seenPlayerActionIdsRef.current,
    })
    if (preflight.status === 'ignored') return
    if (preflight.status === 'rejected') {
      acknowledgePlayerAction(action, 'rejected', preflight.reason)
      completePlayerActionRequest(action)
      return
    }
    if (!activeMap) return
    seenPlayerActionIdsRef.current.add(action.id)

    if (!reservePlayerActionExecution(action, recentPlayerActionKeysRef.current)) {
      acknowledgePlayerAction(action, 'rejected', 'duplicate-action')
      completePlayerActionRequest(action)
      return
    }

    playerActionResultBaselinesRef.current[action.id] = capturePlayerActionResultBaseline({
      characters: useCharacterStore.getState().characters,
      map: useMapStore.getState().maps.find((map) => map.id === activeMap.id) ?? activeMap,
      enemyApByToken: enemyApByTokenRef.current,
    })

    if (action.type === 'activate-feature') {
      const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
      const preparedFeature = preparePlayerFeatureActivationAction({
        action,
        map,
        characters: useCharacterStore.getState().characters,
      })
      if (!preparedFeature.ok) {
        acknowledgePlayerAction(action, 'rejected', preparedFeature.reason)
        completePlayerActionRequest(action)
        return
      }

      const headlessAction = await buildPreparedFeatureActivationHeadlessAction({
        prepared: preparedFeature,
        rollValues: rollDiceBoxValues,
      })
      const headless = resolveHeadlessDmAction(
        createHeadlessStateSnapshot(preparedFeature.map),
        headlessAction,
      )
      settleHeadlessPlayerAction(action, headless)
      return
    }

    if (isSimpleHeadlessPlayerActionType(action.type)) {
      const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
      const prepared = buildSimpleHeadlessPlayerAction({
        action,
        map,
        characters: useCharacterStore.getState().characters,
      })
      if (!prepared.ok) {
        acknowledgePlayerAction(action, 'rejected', prepared.reason)
        completePlayerActionRequest(action)
        return
      }
      const headless = resolveHeadlessDmAction(createHeadlessStateSnapshot(map), prepared.headlessAction)
      if (prepared.settlement === 'move' && prepared.token) {
        settleSimpleHeadlessMoveAction(action, prepared.token, headless)
      } else if (prepared.settlement === 'end-turn') {
        const previousRound = roundRef.current
        multiStrikeHitsRef.current = clearCharacterScopedRecord(multiStrikeHitsRef.current, action.characterId)
        setDisengagedCharIds((prev) => removeDisengagedCharacterId(prev, action.characterId))
        settleHeadlessPlayerAction(action, headless, { previousRound })
      } else {
        settleHeadlessPlayerAction(action, headless)
      }
      return
    }

    if (action.type === 'attack-token') {
      const preparedAttack = preparePlayerAttackAction({
        action,
        map: activeMap,
        characters: useCharacterStore.getState().characters,
      })
      if (!preparedAttack.ok) {
        acknowledgePlayerAction(action, 'rejected', preparedAttack.reason)
        completePlayerActionRequest(action)
        return
      }
      const { actor, skill, targets, waiveAp, doubleArrow, isArrowSequence } = preparedAttack
      if (isArrowSequence) {
        const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
        const { targetPackets } = await buildArrowSequenceTargetPackets({
          actor,
          skill,
          targets,
          resolveTarget: (target) => map.tokens.find((token) => token.id === target.id) ?? target,
          rollD20: rollDiceBoxD20,
          rollValues: rollDiceBoxValues,
          enemyDodgePreview,
        })
        const headlessAction = buildPreparedAttackHeadlessAction({
          action,
          prepared: preparedAttack,
          targetTokenId: targets[0].id,
          targetPackets,
        })
        const headless = resolveHeadlessDmAction(createHeadlessStateSnapshot(map), headlessAction)
        const settlement = planArrowSequenceSettlement({
          result: headless,
          actor,
          skill,
          targets,
          targetLabelById: (tokenId) => map.tokens.find((token) => token.id === tokenId)?.label ?? tokenId,
        })
        if (settlement.status === 'rejected') {
          acknowledgePlayerAction(action, 'rejected', settlement.reason)
          completePlayerActionRequest(action)
          return
        }
        applyHeadlessCombatResult(headless)
        if (settlement.roll) {
          setRoll(settlement.roll)
          publishSharedDiceRoll(settlement.roll)
        }
        pushCombatLog(settlement.combatLog.text, settlement.combatLog.kind)
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted')
        return
      }
      if (canResolveSingleAttackWithHeadless(actor, skill, { doubleArrow, targetCount: targets.length })) {
        const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
        const actorToken = map.tokens.find((token) => token.id === action.actorTokenId)
        const targetToken = map.tokens.find((token) => token.id === targets[0].id) ?? targets[0]
        const targetChar = targetToken.characterId
          ? useCharacterStore.getState().characters.find((character) => character.id === targetToken.characterId)
          : undefined
        if (actorToken && isBasicShot(skill)) {
          launchArrowProjectile({ x: actorToken.x, y: actorToken.y }, { x: targetToken.x, y: targetToken.y })
        }
        const { targetPacket, skillRank } = await buildSingleAttackTargetPacket({
          actor,
          skill,
          targetToken,
          targetChar,
          doubleArrow,
          actionIsCrit: !!(action as typeof action & { isCrit?: boolean }).isCrit,
          liveRound,
          actorTokenId: action.actorTokenId,
          firstInitiativeTokenId: initiativeOrderRef.current[0]?.tokenId,
          targetHasKnockbackNow: tokenHasKnockbackNow(targetToken, targetChar),
          rollD20: rollDiceBoxD20,
          rollValues: rollDiceBoxValues,
          enemyDodgePreview,
          chooseCooldownReductionSkillId,
          confirmPushTarget: (target) =>
            showCombatDialog({
              title: '踏风连踢',
              message: `是否推动 ${target.label} 5 尺？`,
              confirmText: '推动',
              cancelText: '不推动',
              tone: 'sky',
            }),
        })
        const headlessAction = buildPreparedAttackHeadlessAction({
          action,
          prepared: preparedAttack,
          targetTokenId: targetToken.id,
          targetPackets: [targetPacket],
        })
        const headless = resolveHeadlessDmAction(createHeadlessStateSnapshot(map), headlessAction)
        const settlement = planSingleAttackSettlement({
          result: headless,
          actor,
          skill,
          targetToken,
          skillRank,
        })
        if (settlement.status === 'rejected') {
          acknowledgePlayerAction(action, 'rejected', settlement.reason)
          completePlayerActionRequest(action)
          return
        }
        applyHeadlessCombatResult(headless)
        if (settlement.shouldOfferGaleCombo) {
          await maybeOfferGaleComboAfterHeadlessDamage(actor, skill, headless.events)
        }
        if (settlement.shouldShowMoveRange) {
          setShowMoveRange(true)
        }
        if (settlement.apLog) {
          pushApLog(actor, settlement.apLog.amount, settlement.apLog.action, settlement.apLog.detail)
        }
        if (settlement.roll) {
          setRoll(settlement.roll)
          publishSharedDiceRoll(settlement.roll)
        }
        pushCombatLog(settlement.combatLog.text, settlement.combatLog.kind)
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'accepted')
        return
      }
      void doubleArrow
      void waiveAp
      acknowledgePlayerAction(action, 'rejected', 'unsupported-attack')
      completePlayerActionRequest(action)
      return
    }

    if (action.type === 'aoe-attack') {
      const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
      const preparedAoe = preparePlayerAoeAttackAction({
        action,
        map,
        characters: useCharacterStore.getState().characters,
      })
      if (!preparedAoe.ok) {
        acknowledgePlayerAction(action, 'rejected', preparedAoe.reason)
        completePlayerActionRequest(action)
        return
      }
      const {
        actor,
        skill,
        actorToken,
        anchorCell,
        cells,
        targets,
        baseDiceCount,
        calmExtraDiceCount,
        windExtraDiceCount,
        saveMode,
        shouldStun,
      } = preparedAoe
      if (skill.skillTreeId === 'focusShot') {
        launchArrowProjectile({ x: actorToken.x, y: actorToken.y }, cellToPixel(anchorCell, map), 'focus')
      }
      let diceValues = await rollDiceBoxValues(baseDiceCount, skill.damageSides, `${skill.name} 伤害`, targets[0].label)
      if (calmExtraDiceCount > 0) {
        const extra = await rollDiceBoxValues(calmExtraDiceCount, 6, `${skill.name} 静心额外伤害`, targets[0].label)
        diceValues = [...diceValues, ...extra]
      }
      if (windExtraDiceCount > 0) {
        const extra = await rollDiceBoxValues(windExtraDiceCount, 6, `${skill.name} 额外伤害`, targets[0].label)
        diceValues = [...diceValues, ...extra]
      }
      const { targetPackets } = await buildAoeTargetPackets({
        actor,
        skill,
        targets,
        saveMode,
        shouldStun,
        resolveTargetCharacter: (target) =>
          target.characterId
            ? useCharacterStore.getState().characters.find((character) => character.id === target.characterId)
            : undefined,
        targetHasKnockbackNow: tokenHasKnockbackNow,
        rollD20: rollDiceBoxD20,
        rollValues: rollDiceBoxValues,
      })
      const headlessAction = buildPreparedAoeHeadlessAction({
        action,
        prepared: preparedAoe,
        diceValues,
        targetPackets,
      })
      const headless = resolveHeadlessDmAction(createHeadlessStateSnapshot(map), headlessAction)
      const settlement = planAoeAttackSettlement({
        result: headless,
        actor,
        skill,
        diceValues,
        cellCount: cells.length,
        targetCount: targets.length,
        targetLabelById: (tokenId) => map.tokens.find((token) => token.id === tokenId)?.label ?? tokenId,
      })
      if (settlement.status === 'rejected') {
        acknowledgePlayerAction(action, 'rejected', settlement.reason)
        completePlayerActionRequest(action)
        return
      }
      applyHeadlessCombatResult(headless)
      if (settlement.shouldOfferGaleCombo) {
        await maybeOfferGaleComboAfterHeadlessDamage(actor, skill, headless.events)
      }
      if (settlement.roll) {
        setRoll(settlement.roll)
        publishSharedDiceRoll(settlement.roll)
      }
      pushCombatLog(settlement.combatLog.text, settlement.combatLog.kind)
      completePlayerActionRequest(action)
      acknowledgePlayerAction(action, 'accepted')
      return
    }
    if (action.type === 'move-token') {
      const map = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? activeMap
      const preparedMove = preparePlayerMoveAction({
        action,
        map,
        characters: useCharacterStore.getState().characters,
      })
      if (!preparedMove.ok) {
        acknowledgePlayerAction(action, 'rejected', preparedMove.reason)
        completePlayerActionRequest(action)
        return
      }
      const { actor, token, moveAction } = preparedMove
      const headlessSnapshot = createHeadlessStateSnapshot(map)
      const headless = resolveHeadlessDmAction(headlessSnapshot, moveAction)
      const preview = summarizeHeadlessPlayerMovePreview({
        result: headless,
        token,
        requestedPosition: moveAction.targetPosition,
        map,
      })
      const movePlan = planPlayerMoveAfterPreview({ preview, moveAction })
      if (movePlan.status === 'rejected') {
        acknowledgePlayerAction(action, 'rejected', movePlan.reason)
        completePlayerActionRequest(action)
        return
      }
      if (movePlan.status === 'accepted') {
        settleHeadlessPlayerAction(action, headless, { acceptedPosition: movePlan.acceptedPosition })
        return
      }

      const deferred = resolveHeadlessDmAction(headlessSnapshot, movePlan.deferredMoveAction)
      if (!deferred.ok) {
        acknowledgePlayerAction(
          action,
          'rejected',
          deferred.reason === 'movement-locked' ? 'no-move' : deferred.reason,
        )
        completePlayerActionRequest(action)
        return
      }
      applyHeadlessCombatResult(deferred)
      await resolveOpportunityAttacksForMove(
        token,
        movePlan.targetPosition,
        actor,
        movePlan.opportunityAttackerTokenIds,
      )
      const afterOpportunity = planPlayerMoveAfterOpportunity({
        moveAction,
        movePlan,
        token,
        characters: useCharacterStore.getState().characters,
      })
      if (afterOpportunity.status === 'interrupted') {
        pushApLog(actor, afterOpportunity.apLog.amount, afterOpportunity.apLog.action, afterOpportunity.apLog.detail)
        completePlayerActionRequest(action)
        acknowledgePlayerAction(
          action,
          'accepted',
          afterOpportunity.acceptedReason,
          afterOpportunity.acceptedPosition,
        )
        return
      }
      const latestMapAfterOpportunity = useMapStore.getState().maps.find((item) => item.id === activeMap.id) ?? map
      const committed = resolveHeadlessDmAction(
        createHeadlessStateSnapshot(latestMapAfterOpportunity),
        afterOpportunity.commitAction,
      )
      if (!committed.ok) {
        completePlayerActionRequest(action)
        acknowledgePlayerAction(action, 'rejected', committed.reason)
        return
      }
      settleHeadlessPlayerAction(action, committed, {
        acceptedPosition: afterOpportunity.acceptedPosition,
        beforeComplete: () =>
          pushApLog(actor, afterOpportunity.apLog.amount, afterOpportunity.apLog.action, afterOpportunity.apLog.detail),
      })
      return
    }

    acknowledgePlayerAction(action, 'rejected', 'unsupported-action')
    completePlayerActionRequest(action)
  }

  const canSendPlayerCombatAction = () => {
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
    if (!isDM || !activeMap || !turnCharacter || !currentInitiativeToken) return null
    if (currentInitiativeToken.type !== 'player' || currentInitiativeToken.characterId !== turnCharacter.id) return null
    return createSharedPlayerActionEnvelope({
      mapId: activeMap.id,
      combatId: combatIdRef.current,
      sourceMode: 'dm',
      actorTokenId: currentInitiativeToken.id,
      characterId: turnCharacter.id,
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

  const sendDmLocalAttackTokenRequest = (targetToken: Token, skill: CombatSkill, targetTokenIds?: string[]) => {
    if (getSkillAoeTargeting(skill)) return false
    return submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'attack-token',
        targetTokenId: targetToken.id,
        targetTokenIds,
        skillId: skill.id,
      }),
    )
  }

  const sendDmLocalAoeAttackRequest = (targetCell: GridCell) => {
    if (!targeting?.aoe) return false
    return submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'aoe-attack',
        skillId: targeting.skill.id,
        targetCell,
        aoeRectRotation,
      }),
    )
  }

  const sendDmLocalUseSkillRequest = (skill: CombatSkill) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'use-skill',
        skillId: skill.id,
      }),
    )

  const sendDmLocalActivateFeatureRequest = (
    featureKey: ClassFeatureKey,
    opts?: { targetTokenId?: string; targetTokenIds?: string[] },
  ) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'activate-feature',
        featureKey,
        targetTokenId: opts?.targetTokenId,
        targetTokenIds: opts?.targetTokenIds,
      }),
    )

  const sendDmLocalCalmSpiritRequest = (
    effect: NonNullable<SharedPlayerActionState['calmSpiritEffect']>,
    opts?: { skillId?: string },
  ) =>
    submitDmLocalPlayerAction(
      createDmLocalPlayerAction({
        type: 'calm-spirit',
        calmSpiritEffect: effect,
        skillId: opts?.skillId,
      }),
    )

  const createPlayerActionRequest = (
    patch: SharedPlayerActionPatch,
    actorOverride?: { tokenId: string; characterId: string },
  ): SharedPlayerActionState | null => {
    if (!activeMap) return null
    const actorTokenId = actorOverride?.tokenId ?? currentInitiativeToken?.id
    const characterId = actorOverride?.characterId ?? turnCharacter?.id
    return createSharedPlayerActionEnvelope({
      mapId: activeMap.id,
      combatId: combatIdRef.current,
      sourceMode: 'player',
      actorTokenId,
      characterId,
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

  const sendPlayerActivateFeatureRequest = (
    featureKey: ClassFeatureKey,
    opts?: { targetTokenId?: string; targetTokenIds?: string[] },
  ) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'activate-feature',
      targetTokenId: opts?.targetTokenId,
      targetTokenIds: opts?.targetTokenIds,
      featureKey,
    })
    if (!action) return false
    const featureName = findClassTrait(turnCharacter, featureKey)?.name ?? featureKey
    return submitPlayerActionRequest(action, `${turnCharacter.name} 激活${featureName}`)
  }

  const sendPlayerCalmSpiritRequest = (
    effect: NonNullable<SharedPlayerActionState['calmSpiritEffect']>,
    opts?: { skillId?: string },
  ) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const action = createPlayerActionRequest({
      type: 'calm-spirit',
      calmSpiritEffect: effect,
      skillId: opts?.skillId,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 发动安定心神`)
  }

  const sendPlayerAttackTokenRequest = (targetToken: Token, skill: CombatSkill, targetTokenIds?: string[]) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    if (getSkillAoeTargeting(skill)) return false
    const action = createPlayerActionRequest({
      type: 'attack-token',
      targetTokenId: targetToken.id,
      targetTokenIds,
      skillId: skill.id,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 使用 ${skill.name}`)
  }

  const sendPlayerAoeAttackRequest = (targetCell: GridCell) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken || !targeting?.aoe) return false
    const action = createPlayerActionRequest({
      type: 'aoe-attack',
      skillId: targeting.skill.id,
      targetCell,
      aoeRectRotation,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 使用 ${targeting.skill.name}`)
  }

  const sendPlayerUseSkillRequest = (skill: CombatSkill) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    const waiveAp = !!turnCharacter.combatBuffs?.galeComboReady
    if (!waiveAp && turnCharacter.currentAP < skill.apCost) return false
    const action = createPlayerActionRequest({
      type: 'use-skill',
      skillId: skill.id,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 使用 ${skill.name}`)
  }

  const sendPlayerMoveRequest = (targetPosition: { x: number; y: number }, movedFeet: number) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken || !myPlayerToken) return false
    if (turnCharacter.currentAP < 1) return false
    const action = createPlayerActionRequest({
      type: 'move-token',
      targetPosition,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 移动 ${movedFeet} 尺`)
  }

  const sendPlayerDisengageRequest = () => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    if (turnCharacter.currentAP < 2) return false
    const action = createPlayerActionRequest({ type: 'disengage' })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 撤离`)
  }

  const sendPlayerAgileLeapMoveRequest = (targetPosition: { x: number; y: number }, movedFeet: number) => {
    if (!activeMap || mode !== 'player' || playerCombatLocked || !combatActiveRef.current || !combatActive) return false
    if (pendingPlayerActionRef.current) return false
    const actor = agileLeapChar
    const token = agileLeapToken
    if (!actor || !token || actor.id !== playerChar?.id || token.characterId !== actor.id) return false
    if ((actor.combatBuffs?.agileLeapMoveFeet ?? 0) <= 0) return false
    const action = createPlayerActionRequest(
      {
        type: 'agile-leap-move',
        targetPosition,
      },
      { tokenId: token.id, characterId: actor.id },
    )
    if (!action) return false
    return submitPlayerActionRequest(action, `${actor.name} 灵巧跳跃 ${movedFeet} 尺`)
  }

  const sendPlayerSkillFreeMoveRequest = (targetPosition: { x: number; y: number }, movedFeet: number) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken || !myPlayerToken) return false
    if ((turnCharacter.combatBuffs?.freeMoveFeet ?? 0) <= 0) return false
    const action = createPlayerActionRequest({
      type: 'skill-free-move',
      targetPosition,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 技能移动 ${movedFeet} 尺`)
  }

  const sendPlayerCalmSpiritMoveRequest = (targetPosition: { x: number; y: number }, movedFeet: number) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken || !myPlayerToken) return false
    if ((turnCharacter.combatBuffs?.calmSpiritMoveFeet ?? 0) <= 0) return false
    const action = createPlayerActionRequest({
      type: 'calm-spirit-move',
      targetPosition,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 安定心神移动 ${movedFeet} 尺`)
  }

  const sendPlayerQiReduceCooldownRequest = (skill: CombatSkill) => {
    if (!canSendPlayerCombatAction() || !activeMap || !turnCharacter || !currentInitiativeToken) return false
    if (skill.remaining <= 0 || (turnCharacter.qi ?? 0) < 1) return false
    const action = createPlayerActionRequest({
      type: 'qi-reduce-cooldown',
      skillId: skill.id,
    })
    if (!action) return false
    return submitPlayerActionRequest(action, `${turnCharacter.name} 消耗气降低冷却`)
  }

  const waitForAuthoritativePlayerActionSync = async (appliedAt?: number) => {
    await syncAuthoritativePlayerActionState({
      appliedAt,
      loadMapsUpdatedAt: async () => (await loadSharedResource<{ updatedAt?: number }>('maps'))?.updatedAt,
      loadCharactersUpdatedAt: async () =>
        (await loadSharedResource<{ updatedAt?: number }>('characters'))?.updatedAt,
      sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
      loadMaps: () => useMapStore.getState().loadShared(),
      loadCharacters: () => useCharacterStore.getState().loadShared(),
    })
  }

  useEffect(() => {
    if (!isDM || !activeMap) return
    const unsubscribe = subscribeSharedEvent<SharedPlayerActionState>(
      'player-action-player-to-dm',
      handlePlayerActionRequest,
    )
    let cancelled = false
    const load = async () => {
      const batch = await loadDmPlayerActionBatch({
        mapId: activeMap.id,
        combatId: combatIdRef.current,
        currentProcessedActionIds: processedPlayerActionIdsRef.current,
        loadProcessed: () => loadSharedResource<SharedPlayerActionProcessedState>('player-action-processed'),
        loadQueue: () => loadSharedResource<SharedPlayerActionRequestQueueState>('player-action-requests'),
        loadLatestAction: () => loadSharedResource<SharedPlayerActionState>('player-action'),
      })
      if (cancelled) return
      if (batch.processedActionIds) processedPlayerActionIdsRef.current = batch.processedActionIds
      for (const action of batch.actions) {
        if (cancelled) return
        await handlePlayerActionRequest(action)
      }
    }
    void load()
    const timer = window.setInterval(load, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [isDM, activeMap?.id, combatActive, round, currentInitiativeToken?.id])

  useEffect(() => {
    if (mode !== 'player' || !activeMap) return
    let cancelled = false
    const applyAck = (ack: SharedPlayerActionAckState | null) => {
      void consumePlayerActionAck({
        ack,
        mapId: activeMap.id,
        seenAckIds: seenPlayerActionAckIdsRef.current,
        getPendingAction: () => pendingPlayerActionRef.current,
        waitForAuthoritativeSync: waitForAuthoritativePlayerActionSync,
        sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
        clearPendingAction: () => setPendingPlayerActionLocked(null),
        isCancelled: () => cancelled,
      })
    }
    const unsubscribe = subscribeSharedEvent<SharedPlayerActionAckState>(
      'player-action-dm-to-player',
      applyAck,
    )
    const load = async () => {
      const ack = await loadSharedResource<SharedPlayerActionAckState>('player-action-ack')
      if (!cancelled) applyAck(ack)
    }
    void load()
    const timer = window.setInterval(load, 500)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      unsubscribe()
    }
  }, [mode, activeMap?.id])

  useEffect(() => {
    if (!combatActive || !activeMap || initiativeOrder.length === 0) return
    if (!isDM) return

    const entry = initiativeOrder[initiativeIndex]
    if (!entry) {
      requestAdvance()
      return
    }

    const token = activeMap.tokens.find((t) => t.id === entry.tokenId)
    const chars = useCharacterStore.getState().characters

    // [T1/T3 · T13] 槽位决策抽到纯函数 decideTurnAction（prune/skip/enemy/player）。effect 这里
    // 只保留各分支的「副作用」（prune 重排、去重 key、眩晕日志、全 npc parked 守卫、定时推进）。
    // 决策本身与 decideTurnAction 一致，便于 T13 在不挂载组件下单测。
    const action = decideTurnAction(token, chars)

    if (action === 'prune') {
      // [T2/A9] prune at top level, not inside the updater (StrictMode double-fire)
      const pruned = pruneInitiativeForToken(initiativeOrderRef.current, initiativeIndexRef.current, entry.tokenId)
      initiativeIndexRef.current = pruned.index
      initiativeOrderRef.current = pruned.order
      setInitiativeOrder(pruned.order)
      setInitiativeIndex(pruned.index)
      const timer = window.setTimeout(() => requestAdvance(), 50)
      return () => window.clearTimeout(timer)
    }

    // 'skip' 合并三类：死亡 / 眩晕 / 存活非行动者。各自副作用保持独立（与原三分支逐字节一致）。
    if (action === 'skip') {
      // token 此处必非空（decideTurnAction 仅在 token 缺失时返回 'prune'）。
      const skipToken = token!
      // 死亡 token：直接定时推进（无去重 key，与原死亡分支一致）。
      if (!isTokenAlive(skipToken, chars)) {
        const timer = window.setTimeout(() => requestAdvance(), 50)
        return () => window.clearTimeout(timer)
      }

      // [T3/C2] Stunned unit (player OR enemy) skips its entire turn. Previously stunTurns
      // was applied/decremented/VFX'd but never checked here or in planEnemyTurn, so a
      // stunned unit acted normally. Skipping here (before the enemy-schedule / player-begin
      // branches) advances past it; the decrement at round-end (counter -1) restores it next
      // round (AC5: stunTurns>0 => skip, ==0 => normal turn).
      if ((skipToken.stunTurns ?? 0) > 0) {
        const stunKey = `stun-${round}-${initiativeIndex}-${skipToken.id}`
        if (stunSkippedKeysRef.current.has(stunKey)) return
        stunSkippedKeysRef.current.add(stunKey)
        pushCombatLog(`${skipToken.label} 处于眩晕状态，跳过本回合。`, 'turn')
        const timer = window.setTimeout(() => requestAdvance(), 50)
        return () => window.clearTimeout(timer)
      }

      // [T1/A1/A2/BUG③] Live non-actor (npc/obstacle) in the initiative slot. There is
      // no enemy/player branch for it, so the round used to hang here: the player "结束回合"
      // button is disabled on a non-player turn (canControlPlayerTurn=false) -> the player
      // side was UNRECOVERABLY deadlocked; only the DM clicking "下一位" escaped. Auto-skip
      // DM-side; the advance is DM-authored and broadcast via the combat snapshot, so the
      // player advances too. The dedupe key prevents stacking skip timers across re-renders.
      // AC4: never spin on an all-npc queue. If no alive player/enemy actor exists at
      // all, park the round instead of advancing forever (each round mints new keys).
      if (!hasActionableActor(initiativeOrder, activeMap.tokens, chars)) return
      const skipKey = `nonactor-${round}-${initiativeIndex}-${skipToken.id}`
      if (nonActorSkippedKeysRef.current.has(skipKey)) return
      nonActorSkippedKeysRef.current.add(skipKey)
      const timer = window.setTimeout(() => requestAdvance(), 50)
      return () => window.clearTimeout(timer)
    }

    if (!isDM || !isEnemyTurn || !currentInitiativeToken) return

    const actKey = `${round}-${initiativeIndex}-${currentInitiativeToken.id}`
    if (enemyAppliedKeysRef.current.has(actKey)) return

    enemyAppliedKeysRef.current.add(actKey)
    scheduleEnemyTurn(currentInitiativeToken)
  }, [combatActive, initiativeIndex, round, activeMap?.id, currentInitiativeToken?.id, isDM])

  useEffect(() => {
    if (!canControlPlayerTurn) {
      const timer = window.setTimeout(() => clearPlayerCombatUI(), 0)
      return () => window.clearTimeout(timer)
    }
    if (!turnCharacter?.id || currentInitiativeToken?.type !== 'player') return
    const timer = window.setTimeout(() => setActiveCharId(turnCharacter.id), 0)
    return () => window.clearTimeout(timer)
  }, [canControlPlayerTurn, turnCharacter?.id, currentInitiativeToken?.type])

  useEffect(() => {
    if (!combatActive || !activeMap || !currentInitiativeToken) return
    if (!isDM) return
    if (tryEndCombatIfNeeded()) return
    if (!isTokenAlive(currentInitiativeToken, characters)) {
      const timer = window.setTimeout(() => requestAdvance(), 50)
      return () => window.clearTimeout(timer)
    }
  }, [combatActive, activeMap?.id, currentInitiativeToken?.id, characters, defeatedTokenIds.length, isDM])

  useEffect(() => {
    const wasActive = previousCombatActiveRef.current
    previousCombatActiveRef.current = combatActive
    if (isDM || combatActive || !wasActive) return
    setPlayerCombatEndedLocked(true)
    clearPlayerCombatEndUI()
  }, [isDM, combatActive])

  const handlePlayerEndTurn = (event?: React.MouseEvent) => {
    event?.stopPropagation()
    if (advancingTurnRef.current) return
    if (!combatActive) return
    clearPlayerCombatUI()
    setTargeting(null)
    setAoePreviewCell(null)
    setAoeRectRotation(0)
    setShowMoveRange(false)
    setDodgePrompt(null)

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

  const ModeToggle = forcedMode ? null : (
    <div className="flex items-center rounded-lg bg-void-900/60 p-0.5">
      <button
        onClick={() => chooseMode('player')}
        className={[
          'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          mode === 'player' ? 'bg-arcane-500/30 text-arcane-100' : 'text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        <User className="h-3.5 w-3.5" />
        玩家
      </button>
      <button
        onClick={() => chooseMode('dm')}
        className={[
          'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
          mode === 'dm' ? 'bg-ember-500/30 text-ember-400' : 'text-slate-400 hover:text-slate-200',
        ].join(' ')}
      >
        <Crown className="h-3.5 w-3.5" />
        DM
      </button>
    </div>
  )

  if (!mode) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-void-950 px-4">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-void-900/80 p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-arcane-300">Stars Battle Map</p>
          <h1 className="mt-3 text-2xl font-bold text-slate-100">选择进入模式</h1>
          <p className="mt-2 text-sm text-slate-400">
            DM 端负责地图、怪物、状态、血量和障碍物；玩家端只显示玩家可见的战斗信息和操作。
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseMode('dm')}
              className="rounded-xl border border-ember-400/30 bg-ember-500/15 px-4 py-5 text-left hover:bg-ember-500/25"
            >
              <Crown className="mb-3 h-6 w-6 text-ember-300" />
              <p className="font-bold text-ember-100">DM 界面</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">管理地图、怪物详情、状态、血量、网格和障碍物。</p>
            </button>
            <button
              type="button"
              onClick={() => chooseMode('player')}
              className="rounded-xl border border-arcane-400/30 bg-arcane-500/15 px-4 py-5 text-left hover:bg-arcane-500/25"
            >
              <User className="mb-3 h-6 w-6 text-arcane-200" />
              <p className="font-bold text-arcane-100">玩家界面</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">只显示玩家操作、可见角色、战斗 Log 和可见怪物信息。</p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {maps.length === 0 || !activeMap ? (
        <div className="flex h-full flex-col">
          <div className="mb-4">{ModeToggle}</div>
          <div className="flex flex-1 items-center">
            <div className="w-full">
              <EmptyState
                icon={MapIcon}
                title="还没有地图"
                description="上传一张图片作为战斗地图，之后可以叠加网格、放置 token、开始战斗。"
                hint="支持 PNG / JPG · 图片本地存储，刷新不丢失"
                action={
                  isDM ? (
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 rounded-xl bg-arcane-500/20 px-4 py-2 text-sm font-semibold text-arcane-200 transition-colors hover:bg-arcane-500/30"
                    >
                      <Upload className="h-4 w-4" />
                      选择图片上传
                    </button>
                  ) : undefined
                }
              />
            </div>
          </div>
        </div>
      ) : (
        /* 全屏地图框，所有控件作为浮层 */
        <div ref={frameRef} className="relative h-full w-full overflow-hidden rounded-2xl">
          {/* 地图本体铺满 */}
          <div className="absolute inset-0">
            <MapCanvas
              map={activeMap}
              selectedTokenId={selectedTokenId}
              onSelectToken={handleSelectToken}
              targetSelectTokenIds={playerCombatLocked ? [] : (featureTargeting?.selectedTokenIds ?? [])}
              isDM={isDM}
              measureMode={isDM && measureMode && !targeting && !showMoveRange && !gridAdjustMode && !deleteSelectMode}
              hpByToken={hpByToken}
              tokenBadges={tokenBadges}
              tokenHoverLabels={tokenHoverLabels}
              projectiles={projectiles}
              defeatedTokenIds={defeatedTokenIds}
              builtinGrid={!!activeMap.builtinGridDetected}
              moveSelectMode={!playerCombatLocked && inMoveSelectMode && !!activeMoveCircle && !targeting?.aoe}
              moveCircle={activeMoveCircle}
              onMoveSelect={handleMoveSelect}
              aoeSelectMode={!playerCombatLocked && !!targeting?.aoe}
              aoeHighlight={aoeHighlight}
              rangedRangeCells={rangedRangeCells}
              onAoePreviewCell={handleAoePreviewCell}
              onAoeConfirm={handleAoeConfirm}
              onAoeCancel={() => {
                setTargeting(null)
                setAoePreviewCell(null)
              }}
              deleteSelectMode={isDM && deleteSelectMode && !targeting && !showMoveRange && !gridAdjustMode && !measureMode}
              onDeleteBoxConfirm={handleDeleteBoxConfirm}
              onDeleteCancel={() => setDeleteSelectMode(false)}
              onBlankContextMenu={() => {
                setFeatureTargeting(null)
                setSelectedTokenId(null)
                setSelectedCharacterTokenId(null)
                setEnemyDetailOpen(false)
                setActiveCharId(null)
                setCharPanel(null)
              }}
              lockDragTokenIds={
                agileLeapToken && canAgileLeapMove
                  ? [agileLeapToken.id]
                  : targeting?.aoe
                    ? (activeMap.tokens
                        .filter((t) => t.characterId === targeting.casterId)
                        .map((t) => t.id) ?? [])
                    : myPlayerToken && canControlPlayerTurn
                      ? [myPlayerToken.id]
                      : []
              }
              gridAdjustMode={isDM && gridAdjustMode}
              onGridOffsetChange={(offsetX, offsetY) =>
                updateMap(activeMap.id, { gridOffsetX: offsetX, gridOffsetY: offsetY })
              }
              gridSizePreview={isDM && gridSizePreview}
              onGridSizeChange={(gridSize) =>
                updateMap(activeMap.id, { gridSize: clampGridSize(gridSize, activeMap) })
              }
            />
          </div>

          {isDM && gridAdjustMode && (
            <div className="pointer-events-none absolute left-1/2 top-[5.25rem] z-40 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/35 bg-void-950/90 px-3 py-1.5 text-xs text-amber-100 shadow-xl backdrop-blur-sm">
              <Move className="h-3.5 w-3.5 shrink-0" />
              <span>
                拖拽平移网格 · 滚轮缩放格子 · Shift+滚轮 ±3px · 方向键微调 · 偏移 ({activeMap.gridOffsetX},{activeMap.gridOffsetY}) · {activeMap.gridSize}px
              </span>
            </div>
          )}

          {/* 选择目标提示 */}
          {targeting && (
            <div className="absolute left-1/2 top-14 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-rose-400/40 bg-void-950/85 px-4 py-2 text-sm shadow-2xl backdrop-blur-sm">
              <span className="text-2xl">{targeting.skill.emoji}</span>
              <span className="text-slate-200">
                释放{' '}
                <span className="font-semibold text-rose-300">
                  {targeting.skill.name}
                  {targeting.doubleArrow ? '（双箭 ×2）' : ''}
                </span>{' '}
                —{' '}
                {targeting.aoe ? (
                  <>
                    {formatAoeHint(targeting.skill, targeting.aoe)}
                    {aoeHighlight && (
                      <span className="text-rose-200/90">
                        {' '}
                        · 高亮 {aoeHighlight.cells.length} 格
                      </span>
                    )}
                    {aoeConfirmHint(targeting.aoe, aoeHighlight?.valid ?? false)}
                  </>
                ) : (
                  '点击地图上的目标'
                )}
              </span>
              <button
                onClick={() => {
                  setTargeting(null)
                  setAoePreviewCell(null)
                }}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
              >
                取消
              </button>
            </div>
          )}

          {/* 骰子飞入动画 */}
          {featureTargeting?.featureKey === 'illusionDance' && (
            <div className="absolute left-1/2 top-14 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-fuchsia-400/40 bg-void-950/90 px-4 py-2 text-sm shadow-2xl backdrop-blur-sm">
              <span className="text-2xl">🪩</span>
              <span className="text-slate-200">
                迷幻舞步：选择敌对目标{' '}
                <span className="font-semibold text-fuchsia-200">
                  {featureTargeting.selectedTokenIds.length}/{featureTargeting.maxTargets}
                </span>
                {featureTargeting.maxTargets <= 1 ? '，点击目标后立即结算' : '，选满自动结算，也可提前执行'}
              </span>
              <button
                disabled={featureTargeting.selectedTokenIds.length === 0}
                onClick={() => submitIllusionDanceTargets(featureTargeting.selectedTokenIds)}
                className="rounded-lg bg-fuchsia-500/20 px-2 py-1 text-xs text-fuchsia-100 hover:bg-fuchsia-500/30 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-slate-500"
              >
                执行
              </button>
              <button
                onClick={() => setFeatureTargeting(null)}
                className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"
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

          {dodgePrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="dodge-prompt-title"
                className="mx-4 w-full max-w-md rounded-2xl border border-sky-400/35 bg-void-950/95 p-5 shadow-2xl"
              >
                <h3 id="dodge-prompt-title" className="text-lg font-semibold text-sky-100">
                  闪避
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {formatDodgePrompt(dodgePrompt.targetChar)}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleDodgeChoice(false)}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                  >
                    承受伤害
                  </button>
                  <button
                    type="button"
                    data-testid="local-dodge-try"
                    onClick={() => handleDodgeChoice(true)}
                    className="rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/35"
                  >
                    尝试闪避
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharedDodgePrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="shared-dodge-prompt-title"
                className="relative mx-4 w-full max-w-md rounded-2xl border border-sky-400/35 bg-void-950/95 p-5 shadow-2xl"
              >
                {sharedDodgePrompt.expiresAt != null && (
                  <div className="absolute right-5 top-5 rounded-full border border-sky-300/40 bg-sky-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-100">
                    {Math.max(0, Math.ceil((sharedDodgePrompt.expiresAt - sharedDodgeNow) / 1000))}s
                  </div>
                )}
                <h3 id="shared-dodge-prompt-title" className="text-lg font-semibold text-sky-100">
                  闪避
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {formatDodgePrompt(sharedDodgePrompt.targetChar)}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharedDodgeChoice(false)}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                  >
                    承受伤害
                  </button>
                  <button
                    type="button"
                    data-testid="shared-dodge-try"
                    data-dodge-id={sharedDodgePrompt.id}
                    onClick={() => handleSharedDodgeChoice(true)}
                    className="rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/35"
                  >
                    尝试闪避
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharedStableMindPrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="shared-stable-mind-prompt-title"
                className="relative mx-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
              >
                {sharedStableMindPrompt.expiresAt != null && (
                  <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                    {Math.max(0, Math.ceil((sharedStableMindPrompt.expiresAt - sharedDodgeNow) / 1000))}s
                  </div>
                )}
                <h3 id="shared-stable-mind-prompt-title" className="text-lg font-semibold text-violet-100">
                  残影脱身
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {`${sharedStableMindPrompt.targetChar.name} 敏捷豁免成功：${sharedStableMindPrompt.saveD20}+${sharedStableMindPrompt.saveMod}=${sharedStableMindPrompt.saveTotal} vs DC ${sharedStableMindPrompt.dc}。\n仍将受到 ${sharedStableMindPrompt.damageAfterSave} 点伤害。\n是否消耗 1 AP 和 1 次残影脱身，抵消本次全部伤害？`}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharedStableMindChoice(false)}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                  >
                    不发动
                  </button>
                  <button
                    type="button"
                    data-testid="shared-stable-mind-use"
                    data-stable-mind-id={sharedStableMindPrompt.id}
                    onClick={() => handleSharedStableMindChoice(true)}
                    className="rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35"
                  >
                    发动残影脱身
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharedGaleComboPrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="shared-gale-combo-prompt-title"
                className="relative mx-4 w-full max-w-md rounded-2xl border border-cyan-400/35 bg-void-950/95 p-5 shadow-2xl"
              >
                {sharedGaleComboPrompt.expiresAt != null && (
                  <div className="absolute right-5 top-5 rounded-full border border-cyan-300/40 bg-cyan-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-cyan-100">
                    {Math.max(0, Math.ceil((sharedGaleComboPrompt.expiresAt - sharedDodgeNow) / 1000))}s
                  </div>
                )}
                <h3 id="shared-gale-combo-prompt-title" className="text-lg font-semibold text-cyan-100">
                  疾风连击
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {`${sharedGaleComboPrompt.casterChar.name} ${sharedGaleComboPrompt.triggerLabel}。\n\n是否发动疾风连击？发动后会获得就绪标记，下一次已准备技能或基础射击不消耗 AP。`}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharedGaleComboChoice(false)}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                  >
                    暂不发动
                  </button>
                  <button
                    type="button"
                    data-testid="shared-gale-combo-use"
                    data-gale-combo-id={sharedGaleComboPrompt.id}
                    onClick={() => handleSharedGaleComboChoice(true)}
                    className="rounded-lg bg-cyan-500/25 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/35"
                  >
                    发动疾风连击
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharedAgileLeapPrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="shared-agile-leap-prompt-title"
                className="relative mx-4 w-full max-w-md rounded-2xl border border-sky-400/35 bg-void-950/95 p-5 shadow-2xl"
              >
                {sharedAgileLeapPrompt.expiresAt != null && (
                  <div className="absolute right-5 top-5 rounded-full border border-sky-300/40 bg-sky-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-100">
                    {Math.max(0, Math.ceil((sharedAgileLeapPrompt.expiresAt - sharedDodgeNow) / 1000))}s
                  </div>
                )}
                <h3 id="shared-agile-leap-prompt-title" className="text-lg font-semibold text-sky-100">
                  灵巧跳跃
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {`${sharedAgileLeapPrompt.targetChar.name} 闪避成功。\n\n是否发动灵巧跳跃？发动后可不消耗 AP 移动 ${sharedAgileLeapPrompt.feet} 尺，无视困难地形和障碍物。\n长休剩余 ${sharedAgileLeapPrompt.uses}/${sharedAgileLeapPrompt.maxUses} 次。`}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharedAgileLeapChoice(false)}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                  >
                    不发动
                  </button>
                  <button
                    type="button"
                    data-testid="shared-agile-leap-use"
                    data-agile-leap-id={sharedAgileLeapPrompt.id}
                    onClick={() => handleSharedAgileLeapChoice(true)}
                    className="rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/35"
                  >
                    发动灵巧跳跃
                  </button>
                </div>
              </div>
            </div>
          )}

          {sharedOpportunityAttackPrompt && (
            <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
              <div
                role="dialog"
                aria-labelledby="shared-opportunity-attack-prompt-title"
                className="relative mx-4 w-full max-w-md rounded-2xl border border-amber-400/35 bg-void-950/95 p-5 shadow-2xl"
              >
                {sharedOpportunityAttackPrompt.expiresAt != null && (
                  <div className="absolute right-5 top-5 rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-100">
                    {Math.max(0, Math.ceil((sharedOpportunityAttackPrompt.expiresAt - sharedDodgeNow) / 1000))}s
                  </div>
                )}
                <h3 id="shared-opportunity-attack-prompt-title" className="text-lg font-semibold text-amber-100">
                  借机攻击
                </h3>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                  {`${sharedOpportunityAttackPrompt.attackerChar.name} 对 ${sharedOpportunityAttackPrompt.targetName} 触发借机攻击。\n\n是否消耗 1 AP，进行一次近战命中判定？`}
                </p>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleSharedOpportunityAttackChoice(false)}
                    className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
                  >
                    放过
                  </button>
                  <button
                    type="button"
                    data-testid="shared-opportunity-attack-use"
                    data-opportunity-attack-id={sharedOpportunityAttackPrompt.id}
                    onClick={() => handleSharedOpportunityAttackChoice(true)}
                    className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35"
                  >
                    发动借机
                  </button>
                </div>
              </div>
            </div>
          )}

          {(combatActive || combatLog.length > 0) && (
            <div className="absolute bottom-3 right-3 z-40 flex max-w-[calc(100%-1.5rem)] flex-col items-end">
              {combatLogOpen ? (
                <div className="w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-void-950/90 shadow-2xl backdrop-blur-md">
                  <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
                    <Swords className="h-4 w-4 text-amber-200" />
                    <span className="text-sm font-bold text-slate-100">战斗 Log</span>
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
                  <div className="max-h-72 overflow-y-auto px-2 py-2">
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
                              </div>
                              <p className="text-xs leading-snug">{entry.text}</p>
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
                entries={initiativeOrder}
                activeIndex={initiativeIndex}
                scrollOffset={initiativeScroll}
                round={round}
                hpByToken={hpByToken}
                apByToken={apByToken}
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
              {ModeToggle}

              {/* 战斗状态 + 控制 */}
              <div
                className={[
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                  combatActive ? 'bg-rose-500/15 text-rose-200' : 'bg-white/5 text-slate-400',
                ].join(' ')}
              >
                <Swords className="h-3.5 w-3.5" />
                {combatActive ? `第 ${round} 回合` : '未开始'}
              </div>
              {isDM &&
                (combatActive ? (
                  <>
                    <button
                      onClick={advanceInitiative}
                      disabled={initiativeOrder.length === 0 || isEnemyTurn}
                      className="flex items-center gap-1 rounded-lg bg-arcane-500/25 px-2.5 py-1 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                      title={isEnemyTurn ? '敌人回合中，行动结束后自动推进' : undefined}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      {isEnemyTurn ? '敌人行动中…' : '下一位'}
                    </button>
                    <button
                      onClick={endCombat}
                      className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10"
                    >
                      <Square className="h-3.5 w-3.5" />
                      结束
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCombat}
                    className="flex items-center gap-1 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    <Play className="h-3.5 w-3.5" />
                    开始战斗
                  </button>
                ))}

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
                  title={activeChar ? `结束 ${activeChar.name} 的回合：冷却 -1、行动点回满` : '先选择你的角色'}
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
                  <button
                    onClick={() =>
                      setMeasureMode((v) => {
                        const next = !v
                        if (next) {
                          setGridAdjustMode(false)
                          setDeleteSelectMode(false)
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
                          setTargeting(null)
                          setFeatureTargeting(null)
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
                      {characters.map((c) => (
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
                  <label className="flex items-center gap-1 rounded-lg bg-slate-500/15 px-2 py-1 text-xs font-medium text-slate-200">
                    <Square className="h-3.5 w-3.5" />
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) addObstacle(activeMap.id, e.target.value)
                        e.target.value = ''
                      }}
                      className="cursor-pointer bg-transparent text-xs text-slate-200 outline-none [&>option]:bg-void-900"
                    >
                      <option value="">障碍物…</option>
                      <option value="rock">石头</option>
                      <option value="chair">椅子</option>
                      <option value="pillar">石柱</option>
                      <option value="table">翻倒的桌子</option>
                    </select>
                  </label>
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
                entries={initiativeOrder}
                activeIndex={initiativeIndex}
                scrollOffset={initiativeScroll}
                round={round}
                hpByToken={hpByToken}
                apByToken={apByToken}
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
              onClose={() => {
                setSelectedTokenId(null)
                setEnemyDetailOpen(false)
              }}
            />
          )}

          {selectedCharacterToken &&
            selectedCharacterToken.characterId &&
            (() => {
              const ch = characters.find((c) => c.id === selectedCharacterToken.characterId)
              return ch ? (
                <CharacterDetailPanel
                  token={selectedCharacterToken}
                  character={ch}
                  mapId={activeMap.id}
                  updateToken={updateToken}
                  updateChar={updateChar}
                  onClose={() => setSelectedCharacterTokenId(null)}
                />
              ) : null
            })()}

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
                  {charPanel === 'skills' && isHeavyGunner(activeChar.charClass)
                    ? '子弹消消乐'
                    : CHAR_PANEL_TITLES[charPanel]}
                </span>
                {canControlPlayerTurn && activeChar.id === turnCharacter?.id && (
                  <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-200">
                    行动点 {activeChar.currentAP}/{activeChar.actionPoints}
                  </span>
                )}
                {canControlPlayerTurn &&
                  activeChar.id === turnCharacter?.id &&
                  findClassTrait(activeChar, 'calmSpirit') && (
                    <div className="flex items-center gap-1 rounded-lg bg-teal-500/10 px-1.5 py-1">
                      <span className="px-1 text-[10px] font-semibold text-teal-200">
                        静心标记 {activeChar.combatBuffs?.calmSpiritStacks ?? 0}/4
                      </span>
                      <button
                        onClick={handleCalmSpiritMove}
                        disabled={(activeChar.combatBuffs?.calmSpiritStacks ?? 0) < 1}
                        className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-teal-100 hover:bg-white/15 disabled:cursor-not-allowed disabled:text-slate-600"
                        title="消耗 1 枚：免费移动，不失去静心"
                      >
                        移动
                      </button>
                      <button
                        onClick={handleCalmSpiritCrit}
                        disabled={(activeChar.combatBuffs?.calmSpiritStacks ?? 0) < 2}
                        className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-teal-100 hover:bg-white/15 disabled:cursor-not-allowed disabled:text-slate-600"
                        title="消耗 2 枚：下次攻击暴击率提升"
                      >
                        暴击
                      </button>
                      <button
                        onClick={handleCalmSpiritCooldown}
                        disabled={(activeChar.combatBuffs?.calmSpiritStacks ?? 0) < 3}
                        className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-teal-100 hover:bg-white/15 disabled:cursor-not-allowed disabled:text-slate-600"
                        title="消耗 3 枚：一个技能 CD -1"
                      >
                        CD
                      </button>
                      <button
                        onClick={handleCalmSpiritExtraTurn}
                        disabled={(activeChar.combatBuffs?.calmSpiritStacks ?? 0) < 4}
                        className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-teal-100 hover:bg-white/15 disabled:cursor-not-allowed disabled:text-slate-600"
                        title="消耗 4 枚：再次获得一个完整回合"
                      >
                        回合
                      </button>
                    </div>
                  )}
                <QiIndicator charClass={activeChar.charClass} level={activeChar.level} qi={activeChar.qi} compact />
                <button
                  onClick={handlePlayerEndTurn}
                  data-testid="player-end-turn"
                  disabled={!!pendingPlayerAction || !combatActive || !canControlPlayerTurn}
                  className="ml-auto flex items-center gap-1 rounded-lg bg-arcane-500/20 px-2 py-1 text-xs font-medium text-arcane-100 hover:bg-arcane-500/30"
                  title="结束回合：冷却 -1、行动点回满"
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
                {charPanel === 'inventory' && <MapInventoryPanel charId={activeChar.id} />}
                {charPanel === 'features' && (
                  <FeaturesTab
                    charId={activeChar.id}
                    isDM={isDM}
                    battleMode={combatActive}
                    allowUpgrade={false}
                    isPlayerTurn={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                    onActivateFeature={handleActivateFeature}
                  />
                )}
                {charPanel === 'spells' && (
                  <MapSpellsPanel
                    charId={activeChar.id}
                    onUseSkill={handleUseSkill}
                    onQiReduceSkill={sendPlayerQiReduceCooldownRequest}
                    canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                  />
                )}
                {charPanel === 'skills' &&
                  (isHeavyGunner(activeChar.charClass) ? (
                    <BulletMatchPanel
                      charId={activeChar.id}
                      canAct={
                        canControlPlayerTurn && activeChar.id === turnCharacter?.id
                      }
                    />
                  ) : (
                    <SkillBar
                      charId={activeChar.id}
                      hideTurnControls
                      scrollColumns
                      fillHeight
                      extraInfiniteActions={
                        canControlPlayerTurn && activeChar.id === turnCharacter?.id
                          ? ([
                              {
                                id: 'disengage',
                                name: '撤离',
                                icon: <Footprints className="h-4 w-4" />,
                                detail: '2 AP · 本回合移动不触发借机攻击',
                                disabled: activeChar.currentAP < 2,
                                used: disengagedCharIds.has(activeChar.id),
                                disabledLabel: '行动点不足',
                                usedLabel: '已撤离',
                                onUse: handleDisengage,
                              },
                            ] satisfies InfiniteAction[])
                          : []
                      }
                      onUseSkill={handleUseSkill}
                      onQiReduceSkill={sendPlayerQiReduceCooldownRequest}
                      canAct={canControlPlayerTurn && activeChar.id === turnCharacter?.id}
                    />
                  ))}
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

      {isDM && (
        <EnemyPoolPicker
          open={enemyPoolOpen}
          title={enemyPoolMode === 'add' ? '添加怪物' : '更换怪物'}
          hint={
            enemyPoolMode === 'add'
              ? '选择一种怪物放置到地图中央'
              : selectedToken
                ? `为「${selectedToken.label}」选择新种类`
                : undefined
          }
          onClose={() => setEnemyPoolOpen(false)}
          onPick={handleEnemyPoolPick}
        />
      )}
    </div>
  )
}
import { findOpportunityAttackersForMove } from '../lib/opportunityAttacks'
