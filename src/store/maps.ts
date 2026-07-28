import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clampTokenPositionToMap,
  defaultTokenSizeForMap,
  realignTokensToGrid,
  snapTokenToGridCenter,
} from '../lib/gridCombat'
import { applyGridDetectPatch, type GridDetectResult } from '../lib/gridDetect'
import {
  enemyTemplateToTokenPatch,
  getEnemyVisualPresentation,
  type EnemyTemplate,
} from '../lib/enemyPool'
import { dnd5eEncounterGridOffset, dnd5eEncounterRoster, type Dnd5eEncounterEntry } from '../rulesets/dnd5e/encounterBuilder'
import { putImage, deleteImage, pruneOrphanImages } from '../lib/imageStore'
import {
  loadSharedResource,
  saveSharedResourceWithResult,
  type SharedResourceSaveResult,
} from '../lib/sharedApi'
import { canWriteSharedState, isPlayerPort } from '../lib/appMode'
import { getRoomSession } from '../lib/roomSession'
import { decideApply, type MonotonicState } from '../lib/monotonicGuard'
import type { Dnd5eTimedEffect } from '../rulesets/dnd5e/timedEffects'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'
import {
  applyDnd5eEffectiveVisionProfile,
  compileDnd5eEffectiveVisionProfile,
} from '../../shared/dnd5e-vision-profile.mjs'
import type { Dnd5eMonsterMechanicTriggerSnapshot } from '../rulesets/dnd5e/headlessCombatEngine'
import type {
  Dnd5eDamageType,
  Dnd5eMonsterBehaviorPreferenceV1,
  Dnd5eMonsterTargetingPreferenceV1,
} from '../rulesets/dnd5e/monsters'
import {
  normalizeDnd5eMonsterBehaviorPreference,
  normalizeDnd5eMonsterTargetingPreference,
} from '../rulesets/dnd5e/monsterAutomation'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'
import {
  normalizeDnd5ePersistentAreaLighting,
  normalizeDnd5ePersistentAreaVisual,
  normalizeDnd5ePersistentAreaTriggerSnapshot,
  type Dnd5ePersistentAreaAnchorMode,
  type Dnd5ePersistentAreaMovementDeclaration,
  type Dnd5ePersistentAreaLighting,
  type Dnd5ePersistentAreaSourceKind,
  type Dnd5ePersistentAreaVisual,
  type Dnd5ePersistentAreaTriggerReceipt,
  type Dnd5ePersistentAreaTriggerSnapshot,
} from '../rulesets/dnd5e/persistentAreaTypes'
import {
  creatureSizeToTokenSize,
  normalizeCreatureSize,
  normalizeCreatureTypes,
  sizeFromTokenSize,
  type CreatureSize,
  type CreatureType,
} from '../lib/monsterTypes'
import {
  normalizeTokenMovementAnimation,
  type TokenMovementAnimation,
} from '../lib/tokenMovementAnimation'
import { campaignLightIsActive, type CampaignLightSourceKind } from '../lib/campaignTime'
function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

let lastSharedMapsSnapshot = ''
let lastSharedMapsUpdatedAt = 0
let mapSaveSeq = 0
let lastLocalMapsWriteAt = 0
const LOCAL_TOKEN_HIT_POINT_EDIT_TTL_MS = 30000
const PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY = 'stars-map-token-hit-point-edits-v1'
type PendingLocalTokenHitPointEdit = {
  hp?: number
  maxHp?: number
  hasHp: boolean
  hasMaxHp: boolean
  updatedAt: number
}
const pendingLocalTokenHitPointEdits = new Map<string, PendingLocalTokenHitPointEdit>()
let pendingLocalTokenHitPointEditsHydrated = false

const pendingTokenKey = (mapId: string, tokenId: string) => `${mapId}:${tokenId}`

function pendingTokenEditStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function persistPendingLocalTokenHitPointEdits(): void {
  const storage = pendingTokenEditStorage()
  if (!storage) return
  try {
    if (pendingLocalTokenHitPointEdits.size === 0) {
      storage.removeItem(PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY)
      return
    }
    storage.setItem(
      PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(pendingLocalTokenHitPointEdits)),
    )
  } catch {
    // localStorage 不可用时仍保留内存保护。
  }
}

function hydratePendingLocalTokenHitPointEdits(): void {
  if (pendingLocalTokenHitPointEditsHydrated) return
  pendingLocalTokenHitPointEditsHydrated = true
  const storage = pendingTokenEditStorage()
  if (!storage) return
  try {
    const raw = storage.getItem(PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, Partial<PendingLocalTokenHitPointEdit>>
    for (const [key, pending] of Object.entries(parsed)) {
      const updatedAt = Number(pending.updatedAt)
      if (!key || !Number.isFinite(updatedAt)) continue
      pendingLocalTokenHitPointEdits.set(key, {
        hp: pending.hasHp && Number.isFinite(Number(pending.hp)) ? Number(pending.hp) : undefined,
        maxHp: pending.hasMaxHp && Number.isFinite(Number(pending.maxHp)) ? Number(pending.maxHp) : undefined,
        hasHp: pending.hasHp === true,
        hasMaxHp: pending.hasMaxHp === true,
        updatedAt,
      })
    }
  } catch {
    try {
      storage.removeItem(PENDING_LOCAL_TOKEN_HIT_POINT_EDITS_STORAGE_KEY)
    } catch {
      // Ignore storage implementations that reject reads and writes.
    }
  }
}

export function markPendingLocalTokenHitPointEdit(
  mapId: string,
  tokenId: string,
  patch: Pick<Partial<Token>, 'hp' | 'maxHp'>,
  now: number = Date.now(),
): void {
  const hasHp = Object.prototype.hasOwnProperty.call(patch, 'hp')
  const hasMaxHp = Object.prototype.hasOwnProperty.call(patch, 'maxHp')
  if (!hasHp && !hasMaxHp) return
  hydratePendingLocalTokenHitPointEdits()
  pendingLocalTokenHitPointEdits.set(pendingTokenKey(mapId, tokenId), {
    hp: patch.hp,
    maxHp: patch.maxHp,
    hasHp,
    hasMaxHp,
    updatedAt: now,
  })
  persistPendingLocalTokenHitPointEdits()
}

function clearPendingLocalTokenHitPointEdit(mapId: string, tokenId: string): void {
  if (!pendingLocalTokenHitPointEdits.delete(pendingTokenKey(mapId, tokenId))) return
  persistPendingLocalTokenHitPointEdits()
}

export function clearPendingLocalTokenHitPointEditsForTest(): void {
  pendingLocalTokenHitPointEdits.clear()
  pendingLocalTokenHitPointEditsHydrated = true
  persistPendingLocalTokenHitPointEdits()
}

export function resetPendingLocalTokenHitPointEditMemoryForTest(): void {
  pendingLocalTokenHitPointEdits.clear()
  pendingLocalTokenHitPointEditsHydrated = false
}

export function mergePendingLocalTokenHitPointEdits(
  sharedMaps: BattleMap[],
  now: number = Date.now(),
): BattleMap[] {
  hydratePendingLocalTokenHitPointEdits()
  let pendingChanged = false
  for (const [key, pending] of pendingLocalTokenHitPointEdits) {
    if (now - pending.updatedAt > LOCAL_TOKEN_HIT_POINT_EDIT_TTL_MS) {
      pendingLocalTokenHitPointEdits.delete(key)
      pendingChanged = true
    }
  }
  if (pendingLocalTokenHitPointEdits.size === 0) {
    if (pendingChanged) persistPendingLocalTokenHitPointEdits()
    return sharedMaps
  }
  const maps = sharedMaps.map((map) => ({
    ...map,
    tokens: map.tokens.map((token) => {
      const key = pendingTokenKey(map.id, token.id)
      const pending = pendingLocalTokenHitPointEdits.get(key)
      if (!pending) return token
      const acknowledged =
        (!pending.hasHp || token.hp === pending.hp) &&
        (!pending.hasMaxHp || token.maxHp === pending.maxHp)
      if (acknowledged) {
        pendingLocalTokenHitPointEdits.delete(key)
        pendingChanged = true
        return token
      }
      return {
        ...token,
        ...(pending.hasHp ? { hp: pending.hp } : {}),
        ...(pending.hasMaxHp ? { maxHp: pending.maxHp } : {}),
      }
    }),
  }))
  if (pendingChanged) persistPendingLocalTokenHitPointEdits()
  return maps
}

export interface SharedMapsState {
  maps: BattleMap[]
  selectedId: string | null
  updatedAt?: number
}

export async function saveMapsStateWithPendingHitPointRetry(input: {
  payload: SharedMapsState
  retryPendingHitPoints: boolean
  save: (payload: SharedMapsState) => Promise<SharedResourceSaveResult>
  load: () => Promise<SharedMapsState | null>
  now?: () => number
  maximumAttempts?: number
}): Promise<{ result: SharedResourceSaveResult; payload: SharedMapsState }> {
  const maximumAttempts = Math.max(1, Math.min(5, Math.floor(input.maximumAttempts ?? 3)))
  const now = input.now ?? Date.now
  let payload = input.payload
  let result: SharedResourceSaveResult = { status: 'failed' }

  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    result = await input.save(payload)
    if (result.status === 'saved') {
      if (input.retryPendingHitPoints) {
        // The authoritative server now contains these exact values. Clear the
        // temporary anti-bounce projection instead of keeping it alive for 30s.
        mergePendingLocalTokenHitPointEdits(payload.maps, payload.updatedAt ?? now())
      }
      return { result, payload }
    }
    if (
      !input.retryPendingHitPoints ||
      result.status !== 'conflict' ||
      attempt >= maximumAttempts - 1
    ) return { result, payload }

    const shared = await input.load()
    if (!shared?.maps) return { result, payload }
    const updatedAt = Math.max(
      now(),
      (payload.updatedAt ?? 0) + 1,
      (shared.updatedAt ?? 0) + 1,
    )
    payload = {
      maps: mergePendingLocalTokenHitPointEdits(shared.maps, updatedAt).map((map) => ({
        ...map,
        tokens: map.tokens.map(stripViewerControlProjection),
      })),
      selectedId: payload.selectedId ?? shared.selectedId,
      updatedAt,
    }
  }
  return { result, payload }
}

export function mergePlayerTokenCombatFields(localMaps: BattleMap[], sharedMaps: BattleMap[]): BattleMap[] {
  const sharedMapById = new Map(sharedMaps.map((map) => [map.id, map]))
  return localMaps.map((map) => {
    const sharedMap = sharedMapById.get(map.id)
    if (!sharedMap) return map
    const sharedTokenById = new Map(sharedMap.tokens.map((token) => [token.id, token]))
    return {
      ...map,
      // Item areas are DM-authoritative combat entities. A player-side map write
      // must never resurrect a cleared trap or erase a newly placed hazard.
      dnd5eItemAreas: sharedMap.dnd5eItemAreas,
      dnd5ePluginAreas: sharedMap.dnd5ePluginAreas,
      tokens: [
        ...map.tokens.flatMap((token) => {
        const sharedToken = sharedTokenById.get(token.id)
        if (!sharedToken) return token.type === 'player' ? [token] : []
        // Token positions are resolved by the DM authority, including player
        // tokens. Player movement uses action requests, so a stale local map
        // snapshot must never undo forced movement such as Thunderwave.
        const authoritativePosition = {
          x: sharedToken.x,
          y: sharedToken.y,
          elevationFeet: sharedToken.elevationFeet,
        }
        return [{
          ...token,
          ...authoritativePosition,
          hp: sharedToken.hp,
          maxHp: sharedToken.maxHp,
          creatureTypes: sharedToken.creatureTypes,
          creatureSize: sharedToken.creatureSize,
          size: sharedToken.size,
          viewerControlled: sharedToken.viewerControlled,
          dnd5eTargetingPreference: sharedToken.dnd5eTargetingPreference,
          dnd5eBehaviorPreference: sharedToken.dnd5eBehaviorPreference,
          visualVariantId: sharedToken.visualVariantId,
          dnd5eCombatState: sharedToken.dnd5eCombatState,
          dnd5eSummon: sharedToken.dnd5eSummon,
          dnd5eSpellEffect: sharedToken.dnd5eSpellEffect,
          movementAnimation: sharedToken.movementAnimation,
        }]
        }),
        ...sharedMap.tokens.filter((token) => !map.tokens.some((local) => local.id === token.id)),
      ],
    }
  })
}

function stripViewerControlProjection(token: Token): Omit<Token, 'viewerControlled'> {
  const { viewerControlled, ...persisted } = token
  void viewerControlled
  return persisted
}

function publishMapsState(
  state: Pick<MapState, 'maps' | 'selectedId'>,
  options: { retryPendingHitPoints?: boolean; requireSaved?: boolean } = {},
): Promise<void> {
  const seq = ++mapSaveSeq
  return (async () => {
    let maps = state.maps
    if (isPlayerPort()) {
      const shared = await loadSharedResource<SharedMapsState>('maps')
      if (seq !== mapSaveSeq) return
      if (shared?.maps) maps = mergePlayerTokenCombatFields(maps, shared.maps)
    }
    const persistedMaps = maps.map((map) => ({
      ...map,
      tokens: map.tokens.map(stripViewerControlProjection),
    }))
    const updatedAt = Math.max(Date.now(), lastSharedMapsUpdatedAt + 1, lastLocalMapsWriteAt + 1)
    const payload: SharedMapsState = { maps: persistedMaps, selectedId: state.selectedId, updatedAt }
    if (seq !== mapSaveSeq) return
    lastLocalMapsWriteAt = updatedAt
    const saved = await saveMapsStateWithPendingHitPointRetry({
      payload,
      retryPendingHitPoints: options.retryPendingHitPoints === true,
      save: (nextPayload) => saveSharedResourceWithResult('maps', nextPayload),
      load: () => loadSharedResource<SharedMapsState>('maps'),
    })
    const result = saved.result
    if (result.status !== 'saved') {
      if (seq === mapSaveSeq) lastLocalMapsWriteAt = lastSharedMapsUpdatedAt
      if (options.requireSaved) throw new Error(`maps-save-rejected:${result.status}`)
      return
    }
    if (seq !== mapSaveSeq) return
    lastLocalMapsWriteAt = saved.payload.updatedAt ?? lastLocalMapsWriteAt
    lastSharedMapsUpdatedAt = saved.payload.updatedAt ?? Date.now()
    lastSharedMapsSnapshot = JSON.stringify(saved.payload)
  })()
}

export interface Token {
  id: string
  label: string
  x: number // 画布坐标（图片像素）
  y: number
  color: string // 边框/底色
  emoji: string
  /** 仅供渲染投影使用：关联角色的完整立绘，不写入地图存档。 */
  portrait?: string
  /** 仅供渲染投影使用：关联角色手动裁切后的地图 Token。 */
  tokenPortrait?: string
  /** 怪物/NPC 立绘存放于共享图片通道，地图状态只保存引用。 */
  portraitImageId?: string
  size: number // 直径（格数的倍数，1 = 一格）
  type: 'player' | 'enemy' | 'npc' | 'obstacle'
  /** 玩家读取地图时由服务端临时投影；不会作为 DM 地图数据持久化。 */
  viewerControlled?: boolean
  creatureTypes?: CreatureType[]
  creatureSize?: CreatureSize
  characterId?: string // 关联的角色（点击 token 即可调出其技能栏）
  hp?: number // 生命值（用于未关联角色的敌人/NPC）
  maxHp?: number
  /** 玩家端是否在 Token 上方显示血量条（DM 始终显示；默认对玩家可见） */
  showHpOnToken?: boolean
  /** 玩家端点击时是否显示怪物详情（DM 始终显示；默认对玩家可见） */
  showDetailOnToken?: boolean
  /** 来自怪物池的模板 id */
  poolId?: string
  /** 内置怪物外观变体；只持久化短 ID，图片由客户端静态资源解析。 */
  visualVariantId?: string
  /** DM 对单个怪物实例设置的自动攻击目标偏好。 */
  dnd5eTargetingPreference?: Dnd5eMonsterTargetingPreferenceV1
  /** DM 对单个怪物实例设置的确定性战术行为风格。 */
  dnd5eBehaviorPreference?: Dnd5eMonsterBehaviorPreferenceV1
  /** 由声明式 Headless 事务创建的召唤物；Token 仍由 DM 操作，side 只表示战斗阵营。 */
  dnd5eSummon?: {
    schemaVersion: 1
    pluginId: string
    featureId: string
    sourceCharacterId: string
    sourceTokenId: string
    createdRound: number
    expiresAfterRound: number
    concentrationId?: string
    side: 'player' | 'enemy'
  }
  /** 无战斗属性的核心法术实体；位置与生命周期只由 DM Headless 区域事务控制。 */
  dnd5eSpellEffect?: {
    schemaVersion: 1
    spellId: string
    sourceCharacterId: string
    sourceTokenId: string
    createdRound: number
    expiresAfterRound: number
    concentrationId?: string
  }
  /** 未关联角色的生物在 5e Headless 战斗中的持久状态。 */
  dnd5eCombatState?: {
    schemaVersion?: typeof DND5E_COMBAT_STATE_SCHEMA_VERSION
    /** 权威状态实例；由 DM/Headless 写入并通过房间资源同步。 */
    activeEffects?: Dnd5eActiveEffectInstance[]
    caltropsSpeedPenaltyFeet?: number
    temporaryHp?: number
    undeadFortitudePending?: { dc: number; damage: number; sourceId?: string }
    monsterOnHitSavePending?: {
      sourceId: string
      actionId: string
      ability: 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha'
      dc: number
      condition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious' | 'disease'
    }
    activeEffectDamageSavePendingIds?: string[]
    /** 当前临时生命值若由英雄气概提供，记录来源以便法术结束时精确撤销。 */
    temporaryHitPointsSource?: { actorId: string; rulesId: 'heroism' | 'enhance-ability' }
    bardicInspirationDie?: number
    bardicInspirationSourceId?: string
    bardicInspirationRoundsRemaining?: number
    surprisedCombatId?: string
    surpriseResolvedCombatId?: string
    countercharmRoundsRemaining?: number
    intimidatingPresenceSourceId?: string
    intimidatingPresenceRoundsRemaining?: number
    intimidatingPresenceImmunityRoundsBySource?: Record<string, number>
    natureSanctuaryImmunityRoundsByTarget?: Record<string, number>
    turnedByClericId?: string
    turnedRoundsRemaining?: number
    holyNimbusRoundsRemaining?: number
    draconicPresenceImmunityRoundsBySource?: Record<string, number>
    monsterFrightfulPresenceImmunityRoundsBySource?: Record<string, number>
    conditions?: string[]
    stunnedByActorId?: string
    stunnedAppliedTurnKey?: string
    openHandNoReactionsAppliedTurnKeysBySource?: Record<string, string>
    quiveringPalmTargetId?: string
    tranquilityActive?: boolean
    declarativeUsedTurnKeys?: Record<string, string>
    declarativeTransactionIds?: string[]
    monsterMechanicRollModifiers?: Array<{
      id: string
      mechanicOwnerId: string
      mechanicId: string
      roll: 'attack' | 'damage' | 'saving-throw'
      mode: 'bonus' | 'advantage' | 'disadvantage'
      bonus?: number
    }>
    pendingMonsterMechanicTriggers?: Record<string, Dnd5eMonsterMechanicTriggerSnapshot>
    monsterMechanicTriggerSequence?: number
    hiddenCheckTotal?: number
    hideInPlainSightPrepared?: boolean
    concentrationSpellId?: string
    concentrationSpellLevel?: number
    concentrationTargetIds?: string[]
    concentrationRoundsRemaining?: number
    concentrationEffectsBySource?: Record<string, string>
    viciousMockeryAttackDisadvantage?: boolean
    helpedAttackSourceId?: string
    helpedAttackSourceTurnKey?: string
    shieldSpellActive?: boolean
    legendaryResistanceUses?: number
    monsterLegendaryActionPoints?: number
    monsterLairActionRoundUsed?: number
    monsterLairActionLastId?: string
    monsterRechargeReadyByActionId?: Record<string, boolean>
    monsterActionUsesByActionId?: Record<string, { current: number; max: number }>
    monsterSpellSlots?: Record<string, { current: number; max: number }>
    monsterSpellUsesBySpellId?: Record<string, { current: number; max: number }>
    monsterShapechangeOriginalStatBlockId?: string
    monsterShapechangeFormId?: string
    monsterRegenerationSuppressedDamageTypes?: Dnd5eDamageType[]
    monsterRegenerationPendingAtZero?: boolean
    /** 由 Headless 按有效承伤累计；DM 可在怪物面板中调整。 */
    monsterThreatByTargetId?: Record<string, number>
    hurlThroughHellSourceId?: string
    hurlThroughHellDamage?: number
    hurlThroughHellAppliedTurnKey?: string
  }
  obstacleKind?: string
  /** Token 底部相对地图地面的高度；用于墙体跨越、视线和效果线。 */
  elevationFeet?: number
  /** 覆盖地图几何中的默认视野半径。 */
  visionRangeFeet?: number
  /** 2014 规则中的黑暗视觉距离；0 或缺失表示没有黑暗视觉。 */
  darkvisionRangeFeet?: number
  /** Sees normally in nonmagical darkness, such as Devil's Sight. */
  darknessSightRangeFeet?: number
  /** Sees normally through magical darkness, such as Devil's Sight. */
  magicalDarknessSightRangeFeet?: number
  /** 特殊感官由地图快照投影到 Headless；距离外仍按普通视线判定。 */
  blindsightRangeFeet?: number
  tremorsenseRangeFeet?: number
  truesightRangeFeet?: number
  /** 魔鬼视界等明确能力；普通黑暗视觉不会设置此字段。 */
  canSeeMagicalDarkness?: boolean
  /** Token 携带的火把、法术或物品光源。 */
  lightSource?: {
    enabled: boolean
    brightRadiusFeet: number
    dimRadiusFeet: number
    color: string
    sourceKind?: CampaignLightSourceKind
    startedAtWorldMinute?: number
    durationMinutes?: number
    expiresAtWorldMinute?: number
  }
  /** 玩家端可见性：动态视野、始终显示，或仅 DM 可见。 */
  visibilityMode?: 'line-of-sight' | 'always' | 'dm-only'
  /** 服务端安全投影：知道其位置，但尚未真正看见该生物。 */
  perceptionVisibility?: 'detected-unseen'
  /** DM 权威路径；各端只按路径做本地插值，最终坐标仍以 x/y 为准。 */
  movementAnimation?: TokenMovementAnimation
}

type LegacyTokenSave = Omit<Partial<Token>, 'dnd5eCombatState'> & {
  burningTurns?: number
  igniteTurns?: number
  poisonTurns?: number
  knockbackTurns?: number
  stunTurns?: number
  restrainedTurns?: number
  vulnerableTurns?: number
  noMoveTurns?: number
  illusionDanceTurns?: number
  huntingMarkStacks?: number
  dnd5eCombatState?: NonNullable<Token['dnd5eCombatState']> & {
    timedEffects?: Dnd5eTimedEffect[]
  }
}

export interface BattleMap {
  id: string
  name: string
  width: number
  height: number
  gridSize: number // 每格像素（1 格 = 5 尺）
  gridOffsetX: number
  gridOffsetY: number
  showGrid: boolean
  /** 上传时识别到底图自带网格 */
  builtinGridDetected?: boolean
  feetPerCell?: number
  /** 叠加网格颜色 #RRGGBB */
  gridColor?: string
  /** 叠加网格不透明度 0–1 */
  gridOpacity?: number
  /** 显示地图格子的 X/Y 坐标轴 */
  showCoordinates?: boolean
  /** 勾选后敌人/NPC 拖放时吸附到格心 */
  snapMonstersToGrid?: boolean
  /** 由 D&D 5e Headless 物品事务创建的持久地图区域。 */
  dnd5eItemAreas?: Dnd5eItemArea[]
  /** 由规则包声明、DM Headless 事务创建的持续范围实体。 */
  dnd5ePluginAreas?: Dnd5ePluginArea[]
  tokens: Token[]
}

export type Dnd5eItemAreaKind = 'ball-bearings' | 'caltrops' | 'hunting-trap'

export interface Dnd5eItemArea {
  id: string
  kind: Dnd5eItemAreaKind
  sourceCharacterId: string
  sourceTokenId: string
  sourceItemTemplateId: string
  sourceItemName: string
  cells: Array<{ col: number; row: number }>
  createdAt: number
  /** 捕猎陷阱触发后解除武装，并记录当前被困 token。 */
  armed: boolean
  triggeredTokenId?: string
}

export interface Dnd5ePluginArea {
  id: string
  pluginId: string
  featureId: string
  /** 旧存档缺省为 plugin-feature；核心 SRD 法术使用 core-spell。 */
  sourceKind?: Dnd5ePersistentAreaSourceKind
  coreSpellId?: string
  slotLevel?: number
  label: string
  color: string
  sourceCharacterId: string
  sourceTokenId: string
  cells: Array<{ col: number; row: number }>
  createdRound: number
  expiresAfterRound: number
  concentrationId?: string
  /** fixed 保持落点；source-token 跟随施法者；effect-token 跟随独立法术实体。 */
  anchorMode?: Dnd5ePersistentAreaAnchorMode
  anchorTokenId?: string
  anchorCell?: { col: number; row: number }
  movement?: Dnd5ePersistentAreaMovementDeclaration
  /** 区域内移动成本倍数；例如灵体卫士为 2。 */
  movementCostMultiplier?: number
  relation?: 'any' | 'ally' | 'enemy'
  includeSelf?: boolean
  /** 隐蔽区域只投影给来源角色与 DM，直到 DM 将其揭示。 */
  hiddenFromPlayers?: boolean
  /** 与权威视线判定共享的声明式光照/魔法黑暗。 */
  lighting?: Dnd5ePersistentAreaLighting
  visual?: Dnd5ePersistentAreaVisual
  triggers?: Dnd5ePersistentAreaTriggerSnapshot[]
  triggerReceipts?: Dnd5ePersistentAreaTriggerReceipt[]
}

/** 地图存档 V15：持续区域增加经白名单校验的法术光照声明。 */
export const MAPS_PERSIST_VERSION = 15

const TOKEN_TYPES: ReadonlyArray<Token['type']> = ['player', 'enemy', 'npc', 'obstacle']

/** 将旧或残缺 token 规整为当前 D&D 5e Token。 */
function normalizeToken(raw: unknown): Token {
  const legacy = (raw ?? {}) as LegacyTokenSave
  const {
    portrait: _projectedPortrait,
    tokenPortrait: _projectedTokenPortrait,
    viewerControlled: _projectedViewerControlled,
    burningTurns: _burningTurns,
    igniteTurns: _igniteTurns,
    poisonTurns: _poisonTurns,
    knockbackTurns: _knockbackTurns,
    stunTurns: _stunTurns,
    restrainedTurns: _restrainedTurns,
    vulnerableTurns: _vulnerableTurns,
    noMoveTurns: _noMoveTurns,
    illusionDanceTurns: _illusionDanceTurns,
    huntingMarkStacks: _huntingMarkStacks,
    dnd5eCombatState: legacyCombatState,
    ...t
  } = legacy
  const type = TOKEN_TYPES.includes(t.type as Token['type']) ? (t.type as Token['type']) : 'enemy'
  const preset = TOKEN_PRESETS[type]
  const rawSize = Number.isFinite(t.size) && (t.size as number) > 0 ? (t.size as number) : 1
  const creatureSize =
    normalizeCreatureSize(t.creatureSize) ?? (type === 'enemy' || type === 'npc' ? sizeFromTokenSize(rawSize) : undefined)
  const creatureTypes = normalizeCreatureTypes(t.creatureTypes)
  const rawSummon = t.dnd5eSummon
  const dnd5eSummon = rawSummon && typeof rawSummon === 'object' &&
    rawSummon.schemaVersion === 1 &&
    typeof rawSummon.pluginId === 'string' && !!rawSummon.pluginId &&
    typeof rawSummon.featureId === 'string' && !!rawSummon.featureId &&
    typeof rawSummon.sourceCharacterId === 'string' && !!rawSummon.sourceCharacterId &&
    typeof rawSummon.sourceTokenId === 'string' && !!rawSummon.sourceTokenId &&
    Number.isInteger(rawSummon.createdRound) && Number(rawSummon.createdRound) >= 0 &&
    Number.isInteger(rawSummon.expiresAfterRound) && Number(rawSummon.expiresAfterRound) >= Number(rawSummon.createdRound) &&
    Number(rawSummon.expiresAfterRound) - Number(rawSummon.createdRound) + 1 <= 14_400 &&
    (rawSummon.concentrationId == null || (typeof rawSummon.concentrationId === 'string' && !!rawSummon.concentrationId)) &&
    (rawSummon.side === 'player' || rawSummon.side === 'enemy')
    ? {
        schemaVersion: 1 as const,
        pluginId: rawSummon.pluginId,
        featureId: rawSummon.featureId,
        sourceCharacterId: rawSummon.sourceCharacterId,
        sourceTokenId: rawSummon.sourceTokenId,
        createdRound: rawSummon.createdRound,
        expiresAfterRound: rawSummon.expiresAfterRound,
        concentrationId: rawSummon.concentrationId,
        side: rawSummon.side,
      }
    : undefined
  const rawSpellEffect = t.dnd5eSpellEffect
  const dnd5eSpellEffect = rawSpellEffect && typeof rawSpellEffect === 'object' &&
    t.type === 'obstacle' &&
    rawSpellEffect.schemaVersion === 1 &&
    typeof rawSpellEffect.spellId === 'string' && !!rawSpellEffect.spellId &&
    typeof rawSpellEffect.sourceCharacterId === 'string' && !!rawSpellEffect.sourceCharacterId &&
    typeof rawSpellEffect.sourceTokenId === 'string' && !!rawSpellEffect.sourceTokenId &&
    Number.isInteger(rawSpellEffect.createdRound) && Number(rawSpellEffect.createdRound) >= 0 &&
    Number.isInteger(rawSpellEffect.expiresAfterRound) &&
    Number(rawSpellEffect.expiresAfterRound) >= Number(rawSpellEffect.createdRound) &&
    Number(rawSpellEffect.expiresAfterRound) - Number(rawSpellEffect.createdRound) + 1 <= 14_400 &&
    (rawSpellEffect.concentrationId == null ||
      (typeof rawSpellEffect.concentrationId === 'string' && !!rawSpellEffect.concentrationId))
    ? {
        schemaVersion: 1 as const,
        spellId: rawSpellEffect.spellId,
        sourceCharacterId: rawSpellEffect.sourceCharacterId,
        sourceTokenId: rawSpellEffect.sourceTokenId,
        createdRound: rawSpellEffect.createdRound,
        expiresAfterRound: rawSpellEffect.expiresAfterRound,
        concentrationId: rawSpellEffect.concentrationId,
      }
    : undefined
  const invalidCurrentEffects = legacyCombatState?.schemaVersion === DND5E_COMBAT_STATE_SCHEMA_VERSION &&
    !validateDnd5eActiveEffectsStrict(legacyCombatState.activeEffects).ok
  const migratedEffects = legacyCombatState && !invalidCurrentEffects
    ? migrateDnd5eCombatStateEffects({
        targetId: typeof t.id === 'string' && t.id ? t.id : 'legacy-token',
        state: legacyCombatState,
        conditions: legacyCombatState.conditions,
      })
    : undefined
  const { timedEffects: _legacyTimedEffects, ...nativeCombatState } = legacyCombatState ?? {}
  const monsterThreatByTargetId = legacyCombatState?.monsterThreatByTargetId &&
    typeof legacyCombatState.monsterThreatByTargetId === 'object'
    ? Object.fromEntries(Object.entries(legacyCombatState.monsterThreatByTargetId).flatMap(([targetId, value]) =>
        targetId.length > 0 && targetId.length <= 160 && Number.isFinite(value) && Number(value) >= 0
          ? [[targetId, Math.min(1_000_000_000, Math.floor(Number(value)))]]
          : [],
      ))
    : undefined
  void _burningTurns
  void _projectedPortrait
  void _projectedTokenPortrait
  void _projectedViewerControlled
  void _igniteTurns
  void _poisonTurns
  void _knockbackTurns
  void _stunTurns
  void _restrainedTurns
  void _vulnerableTurns
  void _noMoveTurns
  void _illusionDanceTurns
  void _huntingMarkStacks
  void _legacyTimedEffects
  return {
    ...t,
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    label: typeof t.label === 'string' ? t.label : '',
    x: Number.isFinite(t.x) ? (t.x as number) : 0,
    y: Number.isFinite(t.y) ? (t.y as number) : 0,
    color: typeof t.color === 'string' && t.color ? t.color : preset.color,
    emoji: typeof t.emoji === 'string' && t.emoji ? t.emoji : preset.emoji,
    portraitImageId: typeof t.portraitImageId === 'string' && /^[a-z0-9_-]{1,160}$/i.test(t.portraitImageId)
      ? t.portraitImageId
      : undefined,
    visualVariantId: typeof t.visualVariantId === 'string' && /^[a-z0-9_-]{1,80}$/i.test(t.visualVariantId)
      ? t.visualVariantId
      : undefined,
    size: creatureSize ? creatureSizeToTokenSize(creatureSize) : rawSize,
    type,
    creatureTypes: creatureTypes.length > 0 ? creatureTypes : undefined,
    creatureSize,
    dnd5eTargetingPreference: normalizeDnd5eMonsterTargetingPreference(t.dnd5eTargetingPreference),
    dnd5eBehaviorPreference: normalizeDnd5eMonsterBehaviorPreference(t.dnd5eBehaviorPreference),
    dnd5eSummon,
    dnd5eSpellEffect,
    elevationFeet: Number.isFinite(t.elevationFeet) ? Math.max(-1_000, Math.min(10_000, t.elevationFeet as number)) : undefined,
    visionRangeFeet: Number.isFinite(t.visionRangeFeet) ? Math.max(0, Math.min(10_000, t.visionRangeFeet as number)) : undefined,
    darkvisionRangeFeet: Number.isFinite(t.darkvisionRangeFeet) ? Math.max(0, Math.min(10_000, t.darkvisionRangeFeet as number)) : undefined,
    darknessSightRangeFeet: Number.isFinite(t.darknessSightRangeFeet) ? Math.max(0, Math.min(10_000, t.darknessSightRangeFeet as number)) : undefined,
    magicalDarknessSightRangeFeet: Number.isFinite(t.magicalDarknessSightRangeFeet) ? Math.max(0, Math.min(10_000, t.magicalDarknessSightRangeFeet as number)) : undefined,
    blindsightRangeFeet: Number.isFinite(t.blindsightRangeFeet) ? Math.max(0, Math.min(10_000, t.blindsightRangeFeet as number)) : undefined,
    tremorsenseRangeFeet: Number.isFinite(t.tremorsenseRangeFeet) ? Math.max(0, Math.min(10_000, t.tremorsenseRangeFeet as number)) : undefined,
    truesightRangeFeet: Number.isFinite(t.truesightRangeFeet) ? Math.max(0, Math.min(10_000, t.truesightRangeFeet as number)) : undefined,
    canSeeMagicalDarkness: t.canSeeMagicalDarkness === true ? true : undefined,
    lightSource: t.lightSource && typeof t.lightSource === 'object' &&
      Number.isFinite(t.lightSource.brightRadiusFeet) && Number.isFinite(t.lightSource.dimRadiusFeet) &&
      typeof t.lightSource.enabled === 'boolean' && typeof t.lightSource.color === 'string'
      ? {
          enabled: t.lightSource.enabled,
          brightRadiusFeet: Math.max(0, Math.min(10_000, t.lightSource.brightRadiusFeet)),
          dimRadiusFeet: Math.max(0, Math.min(10_000, t.lightSource.dimRadiusFeet)),
          color: /^#[0-9a-f]{6}$/i.test(t.lightSource.color) ? t.lightSource.color : '#fbbf24',
          sourceKind: ['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(String(t.lightSource.sourceKind))
            ? t.lightSource.sourceKind as CampaignLightSourceKind
            : undefined,
          startedAtWorldMinute: Number.isSafeInteger(t.lightSource.startedAtWorldMinute) && Number(t.lightSource.startedAtWorldMinute) >= 0
            ? Number(t.lightSource.startedAtWorldMinute)
            : undefined,
          durationMinutes: Number.isSafeInteger(t.lightSource.durationMinutes) && Number(t.lightSource.durationMinutes) > 0
            ? Number(t.lightSource.durationMinutes)
            : undefined,
          expiresAtWorldMinute: Number.isSafeInteger(t.lightSource.expiresAtWorldMinute) && Number(t.lightSource.expiresAtWorldMinute) >= 0
            ? Number(t.lightSource.expiresAtWorldMinute)
            : undefined,
        }
      : undefined,
    visibilityMode: t.visibilityMode === 'always' || t.visibilityMode === 'dm-only' || t.visibilityMode === 'line-of-sight'
      ? t.visibilityMode
      : undefined,
    perceptionVisibility: t.perceptionVisibility === 'detected-unseen' ? t.perceptionVisibility : undefined,
    movementAnimation: normalizeTokenMovementAnimation(t.movementAnimation),
    dnd5eCombatState: legacyCombatState && !invalidCurrentEffects
      ? {
          ...nativeCombatState,
          monsterThreatByTargetId,
          schemaVersion: migratedEffects!.schemaVersion,
          activeEffects: migratedEffects!.activeEffects,
          conditions: migratedEffects!.conditions.length > 0 ? migratedEffects!.conditions : undefined,
      }
      : invalidCurrentEffects
        ? { ...nativeCombatState, monsterThreatByTargetId, schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION, activeEffects: undefined, conditions: undefined }
        : undefined,
  }
}

/** 把任意旧形状的单张地图规整为当前 BattleMap 形状（缺字段填默认，tokens 逐个规整）。 */
function normalizeMap(raw: unknown): BattleMap {
  const m = (raw ?? {}) as Partial<BattleMap>
  const tokens = Array.isArray(m.tokens) ? m.tokens.map(normalizeToken) : []
  const dnd5eItemAreas = Array.isArray(m.dnd5eItemAreas)
    ? m.dnd5eItemAreas.flatMap((rawArea) => {
        const area = (rawArea ?? {}) as Partial<Dnd5eItemArea>
        if (
          typeof area.id !== 'string' || !area.id ||
          !['ball-bearings', 'caltrops', 'hunting-trap'].includes(area.kind ?? '')
        ) return []
        const cells = Array.isArray(area.cells)
          ? area.cells.flatMap((cell) => Number.isInteger(cell?.col) && Number.isInteger(cell?.row)
              ? [{ col: cell!.col, row: cell!.row }]
              : [])
          : []
        if (cells.length < 1) return []
        return [{
          id: area.id,
          kind: area.kind as Dnd5eItemAreaKind,
          sourceCharacterId: typeof area.sourceCharacterId === 'string' ? area.sourceCharacterId : '',
          sourceTokenId: typeof area.sourceTokenId === 'string' ? area.sourceTokenId : '',
          sourceItemTemplateId: typeof area.sourceItemTemplateId === 'string' ? area.sourceItemTemplateId : '',
          sourceItemName: typeof area.sourceItemName === 'string' ? area.sourceItemName : '物品区域',
          cells,
          createdAt: Number.isFinite(area.createdAt) ? area.createdAt! : 0,
          armed: area.armed !== false,
          triggeredTokenId: typeof area.triggeredTokenId === 'string' ? area.triggeredTokenId : undefined,
        } satisfies Dnd5eItemArea]
      })
    : []
  const dnd5ePluginAreas = Array.isArray(m.dnd5ePluginAreas)
    ? m.dnd5ePluginAreas.flatMap((rawArea) => {
      const area = (rawArea ?? {}) as Partial<Dnd5ePluginArea>
        const cells = Array.isArray(area.cells)
          ? area.cells.flatMap((cell) => Number.isInteger(cell?.col) && Number.isInteger(cell?.row)
              ? [{ col: cell!.col, row: cell!.row }]
              : [])
          : []
        if (
          typeof area.id !== 'string' || !area.id || typeof area.pluginId !== 'string' || !area.pluginId ||
          typeof area.featureId !== 'string' || !area.featureId || cells.length < 1 ||
          !Number.isInteger(area.createdRound) || !Number.isInteger(area.expiresAfterRound) ||
          area.createdRound! < 0 || area.expiresAfterRound! < area.createdRound! ||
          area.expiresAfterRound! - area.createdRound! + 1 > 14_400
        ) return []
        const triggers = Array.isArray(area.triggers)
          ? area.triggers.flatMap((trigger) => {
              const normalized = normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)
              return normalized ? [normalized] : []
            })
          : []
        const triggerIds = new Set(triggers.flatMap((trigger) => [
          trigger.id,
          ...(trigger.frequencyGroupId ? [trigger.frequencyGroupId] : []),
        ]))
        const triggerReceipts = Array.isArray(area.triggerReceipts)
          ? area.triggerReceipts.flatMap((receipt) =>
              receipt && triggerIds.has(receipt.triggerId) && typeof receipt.targetTokenId === 'string' &&
              receipt.targetTokenId && Number.isInteger(receipt.round) && receipt.round >= 0 &&
              (receipt.turnKey == null || (typeof receipt.turnKey === 'string' && !!receipt.turnKey && receipt.turnKey.length <= 160)) &&
              typeof receipt.transactionId === 'string' && receipt.transactionId
                ? [{
                    triggerId: receipt.triggerId,
                    targetTokenId: receipt.targetTokenId,
                    round: receipt.round,
                    turnKey: receipt.turnKey,
                    transactionId: receipt.transactionId,
                  }]
                : [],
            ).slice(-2_048)
          : []
        const sourceKind: Dnd5ePersistentAreaSourceKind = area.sourceKind === 'core-spell'
          ? 'core-spell'
          : 'plugin-feature'
        const coreSpellId = sourceKind === 'core-spell' && typeof area.coreSpellId === 'string' && area.coreSpellId
          ? area.coreSpellId
          : undefined
        if (sourceKind === 'core-spell' && !coreSpellId) return []
        const anchorMode: Dnd5ePersistentAreaAnchorMode =
          area.anchorMode === 'source-token' || area.anchorMode === 'effect-token'
            ? area.anchorMode
            : 'fixed'
        const anchorCell = area.anchorCell && Number.isInteger(area.anchorCell.col) && Number.isInteger(area.anchorCell.row)
          ? { col: area.anchorCell.col, row: area.anchorCell.row }
          : { ...cells[0] }
        const movement = area.movement &&
          (area.movement.economy === 'action' || area.movement.economy === 'bonus-action') &&
          Number.isFinite(area.movement.maximumFeet) && area.movement.maximumFeet > 0 && area.movement.maximumFeet <= 1_000
          ? {
              economy: area.movement.economy,
              maximumFeet: Math.floor(area.movement.maximumFeet),
            }
          : undefined
        const lighting = area.lighting ? normalizeDnd5ePersistentAreaLighting(area.lighting) : undefined
        if (area.lighting != null && !lighting) return []
        return [{
          id: area.id,
          pluginId: area.pluginId,
          featureId: area.featureId,
          sourceKind,
          coreSpellId,
          slotLevel: Number.isInteger(area.slotLevel) && Number(area.slotLevel) >= 0 && Number(area.slotLevel) <= 9
            ? Number(area.slotLevel)
            : undefined,
          label: typeof area.label === 'string' && area.label && area.label.length <= 120 ? area.label : '扩展规则区域',
          color: typeof area.color === 'string' && /^#[0-9a-f]{6}$/i.test(area.color) ? area.color : '#8b5cf6',
          sourceCharacterId: typeof area.sourceCharacterId === 'string' ? area.sourceCharacterId : '',
          sourceTokenId: typeof area.sourceTokenId === 'string' ? area.sourceTokenId : '',
          cells,
          createdRound: area.createdRound!,
          expiresAfterRound: area.expiresAfterRound!,
          concentrationId: typeof area.concentrationId === 'string' ? area.concentrationId : undefined,
          anchorMode,
          anchorTokenId: typeof area.anchorTokenId === 'string' && area.anchorTokenId
            ? area.anchorTokenId
            : anchorMode === 'source-token' ? area.sourceTokenId : undefined,
          anchorCell,
          movement,
          movementCostMultiplier: Number.isFinite(area.movementCostMultiplier) &&
            Number(area.movementCostMultiplier) >= 1 && Number(area.movementCostMultiplier) <= 10
            ? Number(area.movementCostMultiplier)
            : undefined,
          relation: area.relation === 'ally' || area.relation === 'enemy' ? area.relation : 'any',
          includeSelf: area.includeSelf === true,
          hiddenFromPlayers: area.hiddenFromPlayers === true,
          lighting,
          visual: area.visual ? normalizeDnd5ePersistentAreaVisual(area.visual) : undefined,
          triggers: triggers.length > 0 ? triggers : undefined,
          triggerReceipts: triggerReceipts.length > 0 ? triggerReceipts : undefined,
        } satisfies Dnd5ePluginArea]
      })
    : []
  return {
    ...m,
    id: typeof m.id === 'string' && m.id ? m.id : uid(),
    name: typeof m.name === 'string' ? m.name : '未命名地图',
    width: Number.isFinite(m.width) ? (m.width as number) : 0,
    height: Number.isFinite(m.height) ? (m.height as number) : 0,
    gridSize: Number.isFinite(m.gridSize) && (m.gridSize as number) > 0 ? (m.gridSize as number) : 70,
    gridOffsetX: Number.isFinite(m.gridOffsetX) ? (m.gridOffsetX as number) : 0,
    gridOffsetY: Number.isFinite(m.gridOffsetY) ? (m.gridOffsetY as number) : 0,
    showGrid: typeof m.showGrid === 'boolean' ? m.showGrid : true,
    dnd5eItemAreas,
    dnd5ePluginAreas,
    tokens,
  }
}

interface PersistedMapState {
  maps?: unknown
  selectedId?: unknown
}

/**
 * 纯函数：把任意持久化快照（含 version 0 = 无版本的旧形状）迁移到当前形状。
 * 单独导出以便 T13 在不挂载组件、不碰 localStorage 的前提下单测。
 * 任何旧 `stars-maps` blob 都应被这里规整为可直接渲染、不崩溃的当前 MapState。
 */
export function migrateMapsState(persisted: unknown): Pick<MapState, 'maps' | 'selectedId'> {
  const p = (persisted ?? {}) as PersistedMapState
  const maps = Array.isArray(p.maps) ? p.maps.map(normalizeMap) : []
  const selectedId =
    typeof p.selectedId === 'string' && maps.some((m) => m.id === p.selectedId)
      ? (p.selectedId as string)
      : (maps[0]?.id ?? null)
  return { maps, selectedId }
}

/**
 * 角色 → token.hp 单向镜像的唯一真相源。
 * `Character.currentHp` 是关联 token 血量的权威；token.hp 只是它的镜像（玩家端合并/阵亡判定用）。
 * 所有改血路径（普通伤害 / DOT 每回合 / 静水回血 / 魔法浪涌）改完 character 后，
 * 都用本 helper 算出要写回 token 的 patch，保证 `token.hp === character.currentHp`、不被任何路径绕过。
 * 纯函数，便于单测：post-change 断言 patch.hp === character.currentHp。
 */
export function characterHpTokenPatch(char: {
  currentHp: number
  maxHp: number
}): Pick<Token, 'hp' | 'maxHp'> {
  return { hp: char.currentHp, maxHp: char.maxHp }
}

type CharacterTokenPresentation = {
  id: string
  name: string
  avatar: string
  portrait?: string
  tokenPortrait?: string
  race?: string
  dnd5eRaceId?: string
  dnd5eClassChoices?: unknown
  dnd5eCombatState?: {
    activeEffects?: Dnd5eActiveEffectInstance[]
  }
}

function projectTokenEffectiveVision(
  token: Token,
  character?: CharacterTokenPresentation,
): Token {
  const profile = compileDnd5eEffectiveVisionProfile({ token, character })
  if (
    (token.darkvisionRangeFeet ?? 0) === profile.darkvisionRangeFeet &&
    (token.darknessSightRangeFeet ?? 0) === profile.darknessSightRangeFeet &&
    (token.magicalDarknessSightRangeFeet ?? 0) === profile.magicalDarknessSightRangeFeet &&
    (token.blindsightRangeFeet ?? 0) === profile.blindsightRangeFeet &&
    (token.tremorsenseRangeFeet ?? 0) === profile.tremorsenseRangeFeet &&
    (token.truesightRangeFeet ?? 0) === profile.truesightRangeFeet
  ) return token
  return applyDnd5eEffectiveVisionProfile(token, profile)
}

/** 角色资料与内置怪物素材只在渲染时投影，不写入地图存档。 */
export function projectCharacterTokenPresentations(
  tokens: Token[],
  characters: readonly CharacterTokenPresentation[],
): Token[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  let changed = false
  const projected = tokens.map((token) => {
    if (!token.characterId) {
      const visionToken = projectTokenEffectiveVision(token)
      const presentation = token.poolId
        ? getEnemyVisualPresentation(token.poolId, token.visualVariantId)
        : undefined
      if (!presentation) {
        if (visionToken !== token) changed = true
        return visionToken
      }

      // A room-specific upload always overrides the bundled monster artwork.
      if (token.portraitImageId) {
        if (!token.portrait && !token.tokenPortrait) {
          if (visionToken !== token) changed = true
          return visionToken
        }
        changed = true
        return { ...visionToken, portrait: undefined, tokenPortrait: undefined }
      }

      if (
        token.portrait === presentation.initiativePortrait &&
        token.tokenPortrait === presentation.tokenPortrait &&
        visionToken === token
      ) return token
      changed = true
      return {
        ...visionToken,
        portrait: presentation.initiativePortrait,
        tokenPortrait: presentation.tokenPortrait,
      }
    }
    const character = charactersById.get(token.characterId)
    if (!character) return token
    const emoji = character.avatar || token.emoji
    const label = character.name || token.label
    const portrait = character.portrait
    const tokenPortrait = character.tokenPortrait
    const visionToken = projectTokenEffectiveVision(token, character)
    if (
      emoji === token.emoji &&
      label === token.label &&
      portrait === token.portrait &&
      tokenPortrait === token.tokenPortrait &&
      visionToken === token
    ) return token
    changed = true
    return {
      ...visionToken,
      emoji,
      label,
      portrait,
      tokenPortrait,
    }
  })
  return changed ? projected : tokens
}

const TOKEN_PRESETS = {
  player: { color: '#34d399', emoji: '🛡️' },
  enemy: { color: '#f87171', emoji: '👹' },
  npc: { color: '#fbbf24', emoji: '🧑' },
  obstacle: { color: '#94a3b8', emoji: '🪨' },
}

interface MapState {
  maps: BattleMap[]
  selectedId: string | null
  loadShared: () => Promise<void>
  saveSharedNow: () => Promise<void>
  select: (id: string | null) => void
  addMap: (meta: {
    name: string
    width: number
    height: number
    blob: Blob
    gridDetect?: GridDetectResult
  }) => Promise<string>
  updateMap: (id: string, patch: Partial<BattleMap>) => void
  removeMap: (id: string) => void
  addToken: (mapId: string, type: Token['type']) => void
  addEnemyFromPool: (mapId: string, template: EnemyTemplate) => string | null
  addEncounterFromPool: (mapId: string, entries: readonly Dnd5eEncounterEntry[]) => string[]
  addCharacterToken: (
    mapId: string,
    payload: { characterId: string; name: string; emoji: string; type?: Token['type'] },
  ) => void
  updateToken: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  applyAuthorityTokenUpdate: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  applyAuthorityMapUpdate: (mapId: string, patch: Partial<BattleMap>) => void
  expireTimedLights: (worldMinute: number) => number
  removeToken: (mapId: string, tokenId: string) => void
  transferToken: (fromMapId: string, toMapId: string, tokenId: string, position: { x: number; y: number }) => boolean
}

export const useMapStore = create<MapState>()(
  persist(
    (set, get) => ({
      maps: [],
      selectedId: null,
      loadShared: async () => {
        const shared = await loadSharedResource<SharedMapsState>('maps')
        if (!shared?.maps) {
          if (canWriteSharedState()) publishMapsState(get())
          return
        }
        // 单调 guard：丢弃 updatedAt 严格更旧的乱序/陈旧快照。
        // 旧实现仅在 !isPlayerPort() 时做此检查 —— 玩家端裸接受任意顺序的快照，乱序写会回退状态。
        // 现在 DM 与玩家两端都走同一纯 guard（decideApply），相等时落内容 equality 短路。
        const prevGuard: MonotonicState = {
          lastUpdatedAt: lastSharedMapsUpdatedAt,
          lastSnapshot: lastSharedMapsSnapshot,
        }
        const decision = decideApply(prevGuard, shared.updatedAt ?? 0, JSON.stringify(shared))
        if (!decision.apply) return
        lastSharedMapsUpdatedAt = decision.next.lastUpdatedAt
        lastSharedMapsSnapshot = decision.next.lastSnapshot
        const protectedMaps = mergePendingLocalTokenHitPointEdits(shared.maps)
        set({ maps: protectedMaps, selectedId: shared.selectedId ?? shared.maps[0]?.id ?? null })
        // 玩家端在 maps 同步落地后 GC 孤儿图片（已删 map 的本地 IndexedDB 副本）。
        if (isPlayerPort()) void pruneOrphanImages(shared.maps.flatMap((map) => [
          map.id,
          ...map.tokens.flatMap((token) => token.portraitImageId ? [token.portraitImageId] : []),
        ]))
      },
      saveSharedNow: () => publishMapsState(get(), { requireSaved: true }),
      select: (id) => set({ selectedId: id }),

      addMap: async ({ name, width, height, blob, gridDetect }) => {
        const id = uid()
        const sharedImageSaved = await putImage(id, blob)
        if (getRoomSession() && !sharedImageSaved) {
          await deleteImage(id)
          throw new Error('地图图片未能上传到房间主机；已取消创建地图，请确认 DM 服务在线后重试。')
        }
        const gridPatch = gridDetect ? applyGridDetectPatch(gridDetect) : { builtinGridDetected: false }
        const map: BattleMap = {
          id,
          name,
          width,
          height,
          gridSize: gridPatch.gridSize ?? 70,
          gridOffsetX: gridPatch.gridOffsetX ?? 0,
          gridOffsetY: gridPatch.gridOffsetY ?? 0,
          showGrid: gridPatch.showGrid ?? true,
          builtinGridDetected: gridPatch.builtinGridDetected,
          feetPerCell: 5,
          gridColor: '#c4b5fd',
          gridOpacity: 0.28,
          showCoordinates: true,
          snapMonstersToGrid: true,
          dnd5eItemAreas: [],
          dnd5ePluginAreas: [],
          tokens: [],
        }
        set((s) => ({ maps: [...s.maps, map], selectedId: id }))
        publishMapsState(get())
        return id
      },

      updateMap: (id, patch) => {
        set((s) => ({
          maps: s.maps.map((m) => {
            if (m.id !== id) return m
            const next = { ...m, ...patch }
            const gridChanged =
              (patch.gridSize != null && patch.gridSize !== m.gridSize) ||
              (patch.gridOffsetX != null && patch.gridOffsetX !== m.gridOffsetX) ||
              (patch.gridOffsetY != null && patch.gridOffsetY !== m.gridOffsetY)
            if (gridChanged) {
              next.tokens = realignTokensToGrid(next.tokens, next)
            }
            return next
          }),
        }))
        publishMapsState(get())
      },

      removeMap: (id) => {
        const removedMap = get().maps.find((map) => map.id === id)
        void deleteImage(id)
        for (const imageId of removedMap?.tokens.flatMap((token) => token.portraitImageId ? [token.portraitImageId] : []) ?? []) {
          void deleteImage(imageId)
        }
        set((s) => {
          const maps = s.maps.filter((m) => m.id !== id)
          return { maps, selectedId: s.selectedId === id ? (maps[0]?.id ?? null) : s.selectedId }
        })
        publishMapsState(get())
      },

      addToken: (mapId, type) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return
        const preset = TOKEN_PRESETS[type]
        const defaultHp = type === 'enemy' ? 20 : type === 'npc' ? 12 : undefined
        const tokenSize = defaultTokenSizeForMap(map)
        const creatureSize = type === 'enemy' || type === 'npc' ? '中型' : undefined
        const spawn = snapTokenToGridCenter(map.width / 2, map.height / 2, { size: tokenSize, creatureSize }, map)
        const token: Token = {
          id: uid(),
          label: type === 'player' ? '玩家' : type === 'enemy' ? '敌人' : 'NPC',
          x: spawn.x,
          y: spawn.y,
          color: preset.color,
          emoji: preset.emoji,
          size: tokenSize,
          type,
          creatureTypes: type === 'enemy' ? ['魔物'] : undefined,
          creatureSize,
          hp: defaultHp,
          maxHp: defaultHp,
        }
        set((s) => ({
          maps: s.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m)),
        }))
        publishMapsState(get())
      },

      addEnemyFromPool: (mapId, template) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return null
        const patch = enemyTemplateToTokenPatch(template)
        const spawn = snapTokenToGridCenter(
          map.width / 2,
          map.height / 2,
          { size: patch.size ?? defaultTokenSizeForMap(map), creatureSize: patch.creatureSize },
          map,
        )
        const token: Token = {
          id: uid(),
          label: patch.label ?? template.name,
          x: spawn.x,
          y: spawn.y,
          color: patch.color ?? '#f87171',
          emoji: patch.emoji ?? '👹',
          size: patch.size ?? defaultTokenSizeForMap(map),
          type: 'enemy',
          hp: patch.hp,
          maxHp: patch.maxHp,
          poolId: patch.poolId,
          visualVariantId: patch.visualVariantId,
          creatureTypes: patch.creatureTypes,
          creatureSize: patch.creatureSize,
          showHpOnToken: patch.showHpOnToken ?? true,
          showDetailOnToken: patch.showDetailOnToken ?? true,
        }
        set((s) => ({
          maps: s.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m)),
        }))
        publishMapsState(get())
        return token.id
      },
      addEncounterFromPool: (mapId, entries) => {
        const map = get().maps.find((candidate) => candidate.id === mapId)
        if (!map) return []
        const roster = dnd5eEncounterRoster(entries)
        if (roster.length === 0) return []
        const tokens = roster.map((template, index): Token => {
          const patch = enemyTemplateToTokenPatch(template)
          const offset = dnd5eEncounterGridOffset(index, roster.length)
          const spacing = Math.max(1, map.gridSize * 2)
          const spawn = snapTokenToGridCenter(
            map.width / 2 + offset.column * spacing,
            map.height / 2 + offset.row * spacing,
            { size: patch.size ?? defaultTokenSizeForMap(map), creatureSize: patch.creatureSize },
            map,
          )
          return {
            id: uid(), label: patch.label ?? template.name, x: spawn.x, y: spawn.y,
            color: patch.color ?? '#f87171', emoji: patch.emoji ?? '👾',
            size: patch.size ?? defaultTokenSizeForMap(map), type: 'enemy',
            hp: patch.hp, maxHp: patch.maxHp, poolId: patch.poolId,
            visualVariantId: patch.visualVariantId,
            creatureTypes: patch.creatureTypes, creatureSize: patch.creatureSize,
            showHpOnToken: patch.showHpOnToken ?? true,
            showDetailOnToken: patch.showDetailOnToken ?? true,
          }
        })
        set((state) => ({
          maps: state.maps.map((candidate) => candidate.id === mapId
            ? { ...candidate, tokens: [...candidate.tokens, ...tokens] }
            : candidate),
        }))
        publishMapsState(get())
        return tokens.map((token) => token.id)
      },
      addCharacterToken: (mapId, { characterId, name, emoji, type = 'player' }) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return
        const preset = TOKEN_PRESETS[type]
        const tokenSize = defaultTokenSizeForMap(map)
        const spawn = snapTokenToGridCenter(map.width / 2, map.height / 2, { size: tokenSize }, map)
        const token: Token = {
          id: uid(),
          label: name,
          x: spawn.x,
          y: spawn.y,
          color: preset.color,
          emoji,
          size: tokenSize,
          type,
          characterId,
        }
        set((s) => ({
          maps: s.maps.map((m) => (m.id === mapId ? { ...m, tokens: [...m.tokens, token] } : m)),
        }))
        publishMapsState(get())
      },

      updateToken: (mapId, tokenId, patch) => {
        const updatesHitPoints =
          Object.prototype.hasOwnProperty.call(patch, 'hp') ||
          Object.prototype.hasOwnProperty.call(patch, 'maxHp')
        markPendingLocalTokenHitPointEdit(mapId, tokenId, patch)
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId
              ? {
                  ...m,
                  tokens: m.tokens.map((t) => {
                    if (t.id !== tokenId) return t
                    const next = { ...t, ...patch }
                    const position = clampTokenPositionToMap(next, next, m)
                    return { ...next, ...position }
                  }),
                }
              : m,
          ),
        }))
        publishMapsState(get(), { retryPendingHitPoints: updatesHitPoints })
      },

      applyAuthorityTokenUpdate: (mapId, tokenId, patch) => {
        if (
          Object.prototype.hasOwnProperty.call(patch, 'hp') ||
          Object.prototype.hasOwnProperty.call(patch, 'maxHp')
        ) clearPendingLocalTokenHitPointEdit(mapId, tokenId)
        set((state) => ({
          maps: state.maps.map((map) =>
            map.id === mapId
              ? {
                  ...map,
                  tokens: map.tokens.map((token) => {
                    if (token.id !== tokenId) return token
                    const next = { ...token, ...patch }
                    const position = clampTokenPositionToMap(next, next, map)
                    return { ...next, ...position }
                  }),
                }
              : map,
          ),
        }))
      },

      applyAuthorityMapUpdate: (mapId, patch) => {
        set((state) => ({
          maps: state.maps.map((map) => map.id === mapId ? { ...map, ...patch } : map),
        }))
      },

      expireTimedLights: (worldMinute) => {
        let expired = 0
        const maps = get().maps.map((map) => ({
            ...map,
            tokens: map.tokens.map((token) => {
              if (!token.lightSource?.enabled || campaignLightIsActive(token.lightSource, worldMinute)) return token
              expired += 1
              return { ...token, lightSource: { ...token.lightSource, enabled: false } }
            }),
          }))
        if (expired > 0) {
          set({ maps })
          publishMapsState(get())
        }
        return expired
      },

      removeToken: (mapId, tokenId) => {
        const portraitImageId = get().maps
          .find((map) => map.id === mapId)
          ?.tokens.find((token) => token.id === tokenId)
          ?.portraitImageId
        if (portraitImageId) void deleteImage(portraitImageId)
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId ? { ...m, tokens: m.tokens.filter((t) => t.id !== tokenId) } : m,
          ),
        }))
        publishMapsState(get())
      },
      transferToken: (fromMapId, toMapId, tokenId, position) => {
        if (fromMapId === toMapId) {
          const currentMap = get().maps.find((map) => map.id === fromMapId)
          const currentToken = currentMap?.tokens.find((token) => token.id === tokenId)
          if (!currentMap || !currentToken) return false
          const boundedPosition = clampTokenPositionToMap(position, currentToken, currentMap)
          set((state) => ({
            maps: state.maps.map((map) => map.id === fromMapId ? {
              ...map,
              tokens: map.tokens.map((token) => token.id === tokenId
                ? { ...token, ...boundedPosition, movementAnimation: undefined }
                : token),
            } : map),
          }))
          publishMapsState(get())
          return true
        }
        const sourceMap = get().maps.find((map) => map.id === fromMapId)
        const targetMap = get().maps.find((map) => map.id === toMapId)
        const token = sourceMap?.tokens.find((candidate) => candidate.id === tokenId)
        if (!sourceMap || !targetMap || !token || targetMap.tokens.some((candidate) => candidate.id === tokenId)) return false
        const boundedPosition = clampTokenPositionToMap(position, token, targetMap)
        const moved = { ...token, ...boundedPosition, movementAnimation: undefined }
        set((state) => ({
          maps: state.maps.map((map) => map.id === fromMapId
            ? { ...map, tokens: map.tokens.filter((candidate) => candidate.id !== tokenId) }
            : map.id === toMapId
              ? { ...map, tokens: [...map.tokens, moved] }
              : map),
          selectedId: toMapId,
        }))
        publishMapsState(get())
        return true
      },
    }),
    {
      name: 'stars-maps',
      version: MAPS_PERSIST_VERSION,
      // 旧形状（version 0 = 此前无版本）经此迁移到当前形状，避免渲染期崩溃。
      migrate: (persisted) => migrateMapsState(persisted) as MapState,
    },
  ),
)
