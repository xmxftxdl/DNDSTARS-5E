import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { defaultTokenSizeForMap, realignTokensToGrid, snapTokenToGridCenter } from '../lib/gridCombat'
import { applyGridDetectPatch, type GridDetectResult } from '../lib/gridDetect'
import { enemyTemplateToTokenPatch, type EnemyTemplate } from '../lib/enemyPool'
import { putImage, deleteImage, pruneOrphanImages } from '../lib/imageStore'
import { loadSharedResource, saveSharedResource } from '../lib/sharedApi'
import { canWriteSharedState, isPlayerPort } from '../lib/appMode'
import { decideApply, type MonotonicState } from '../lib/monotonicGuard'
import type { Dnd5eTimedEffect } from '../rulesets/dnd5e/timedEffects'
import type { Dnd5eActiveEffectInstance } from '../rulesets/dnd5e/activeEffects'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'
import {
  creatureSizeToTokenSize,
  normalizeCreatureSize,
  normalizeCreatureTypes,
  sizeFromTokenSize,
  type CreatureSize,
  type CreatureType,
} from '../lib/monsterTypes'
function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

let lastSharedMapsSnapshot = ''
let lastSharedMapsUpdatedAt = 0
let mapSaveSeq = 0
let lastLocalMapsWriteAt = 0

interface SharedMapsState {
  maps: BattleMap[]
  selectedId: string | null
  updatedAt?: number
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
      tokens: map.tokens.map((token) => {
        const sharedToken = sharedTokenById.get(token.id)
        if (!sharedToken) return token
        const dmControlledPosition =
          token.type !== 'player'
            ? {
                x: sharedToken.x,
                y: sharedToken.y,
              }
            : {}
        return {
          ...token,
          ...dmControlledPosition,
          hp: sharedToken.hp,
          maxHp: sharedToken.maxHp,
          creatureTypes: sharedToken.creatureTypes,
          creatureSize: sharedToken.creatureSize,
          size: sharedToken.size,
          dnd5eCombatState: sharedToken.dnd5eCombatState,
        }
      }),
    }
  })
}

function publishMapsState(state: Pick<MapState, 'maps' | 'selectedId'>): void {
  const seq = ++mapSaveSeq
  void (async () => {
    let maps = state.maps
    if (isPlayerPort()) {
      const shared = await loadSharedResource<SharedMapsState>('maps')
      if (seq !== mapSaveSeq) return
      if (shared?.maps) maps = mergePlayerTokenCombatFields(maps, shared.maps)
    }
    const updatedAt = Math.max(Date.now(), lastSharedMapsUpdatedAt + 1, lastLocalMapsWriteAt + 1)
    const payload: SharedMapsState = { maps, selectedId: state.selectedId, updatedAt }
    if (seq !== mapSaveSeq) return
    lastLocalMapsWriteAt = updatedAt
    lastSharedMapsUpdatedAt = payload.updatedAt ?? Date.now()
    lastSharedMapsSnapshot = JSON.stringify(payload)
    await saveSharedResource('maps', payload)
  })()
}

export interface Token {
  id: string
  label: string
  x: number // 画布坐标（图片像素）
  y: number
  color: string // 边框/底色
  emoji: string
  size: number // 直径（格数的倍数，1 = 一格）
  type: 'player' | 'enemy' | 'npc' | 'obstacle'
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
      condition: 'blinded' | 'charmed' | 'deafened' | 'frightened' | 'grappled' | 'incapacitated' | 'invisible' | 'paralyzed' | 'petrified' | 'poisoned' | 'prone' | 'restrained' | 'stunned' | 'unconscious'
    }
    bardicInspirationDie?: number
    bardicInspirationSourceId?: string
    bardicInspirationRoundsRemaining?: number
    countercharmRoundsRemaining?: number
    intimidatingPresenceSourceId?: string
    intimidatingPresenceRoundsRemaining?: number
    intimidatingPresenceImmunityRoundsBySource?: Record<string, number>
    natureSanctuaryImmunityRoundsByTarget?: Record<string, number>
    turnedByClericId?: string
    turnedRoundsRemaining?: number
    holyNimbusRoundsRemaining?: number
    draconicPresenceImmunityRoundsBySource?: Record<string, number>
    conditions?: string[]
    stunnedByActorId?: string
    stunnedAppliedTurnKey?: string
    openHandNoReactionsAppliedTurnKeysBySource?: Record<string, string>
    quiveringPalmTargetId?: string
    tranquilityActive?: boolean
    hiddenCheckTotal?: number
    hideInPlainSightPrepared?: boolean
    concentrationSpellId?: string
    concentrationTargetIds?: string[]
    concentrationRoundsRemaining?: number
    concentrationEffectsBySource?: Record<string, string>
    viciousMockeryAttackDisadvantage?: boolean
    shieldSpellActive?: boolean
    legendaryResistanceUses?: number
    hurlThroughHellSourceId?: string
    hurlThroughHellDamage?: number
    hurlThroughHellAppliedTurnKey?: string
  }
  obstacleKind?: string
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

/** 地图存档 V4：旧 token 状态只在 normalizeToken 的迁移边界出现。 */
export const MAPS_PERSIST_VERSION = 4

const TOKEN_TYPES: ReadonlyArray<Token['type']> = ['player', 'enemy', 'npc', 'obstacle']

/** 将旧或残缺 token 规整为当前 D&D 5e Token。 */
function normalizeToken(raw: unknown): Token {
  const legacy = (raw ?? {}) as LegacyTokenSave
  const {
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
  void _burningTurns
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
    size: creatureSize ? creatureSizeToTokenSize(creatureSize) : rawSize,
    type,
    creatureTypes: creatureTypes.length > 0 ? creatureTypes : undefined,
    creatureSize,
    dnd5eCombatState: legacyCombatState && !invalidCurrentEffects
      ? {
          ...nativeCombatState,
          schemaVersion: migratedEffects!.schemaVersion,
          activeEffects: migratedEffects!.activeEffects,
          conditions: migratedEffects!.conditions.length > 0 ? migratedEffects!.conditions : undefined,
      }
      : invalidCurrentEffects
        ? { ...nativeCombatState, schemaVersion: DND5E_COMBAT_STATE_SCHEMA_VERSION, activeEffects: undefined, conditions: undefined }
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
  addObstacle: (mapId: string, kind: string) => void
  addEnemyFromPool: (mapId: string, template: EnemyTemplate) => string | null
  addCharacterToken: (
    mapId: string,
    payload: { characterId: string; name: string; emoji: string; type?: Token['type'] },
  ) => void
  updateToken: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  applyAuthorityTokenUpdate: (mapId: string, tokenId: string, patch: Partial<Token>) => void
  applyAuthorityMapUpdate: (mapId: string, patch: Partial<BattleMap>) => void
  removeToken: (mapId: string, tokenId: string) => void
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
        set({ maps: shared.maps, selectedId: shared.selectedId ?? shared.maps[0]?.id ?? null })
        // 玩家端在 maps 同步落地后 GC 孤儿图片（已删 map 的本地 IndexedDB 副本）。
        if (isPlayerPort()) void pruneOrphanImages(shared.maps.map((m) => m.id))
      },
      select: (id) => set({ selectedId: id }),

      addMap: async ({ name, width, height, blob, gridDetect }) => {
        const id = uid()
        await putImage(id, blob)
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
        void deleteImage(id)
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

      addObstacle: (mapId, kind) => {
        const map = get().maps.find((m) => m.id === mapId)
        if (!map) return
        const templates: Record<string, { label: string; emoji: string; size: number; color: string }> = {
          rock: { label: '石头', emoji: '🪨', size: 1, color: '#94a3b8' },
          chair: { label: '椅子', emoji: '🪑', size: 1, color: '#a16207' },
          pillar: { label: '石柱', emoji: '🏛️', size: 1, color: '#cbd5e1' },
          table: { label: '翻倒的桌子', emoji: '▰', size: 2, color: '#92400e' },
        }
        const tpl = templates[kind] ?? templates.rock
        const spawn = snapTokenToGridCenter(map.width / 2, map.height / 2, { size: tpl.size }, map)
        const token: Token = {
          id: uid(),
          label: tpl.label,
          x: spawn.x,
          y: spawn.y,
          color: tpl.color,
          emoji: tpl.emoji,
          size: tpl.size,
          type: 'obstacle',
          obstacleKind: kind,
          showHpOnToken: false,
          showDetailOnToken: false,
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
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId
              ? { ...m, tokens: m.tokens.map((t) => (t.id === tokenId ? { ...t, ...patch } : t)) }
              : m,
          ),
        }))
        publishMapsState(get())
      },

      applyAuthorityTokenUpdate: (mapId, tokenId, patch) => {
        set((state) => ({
          maps: state.maps.map((map) =>
            map.id === mapId
              ? {
                  ...map,
                  tokens: map.tokens.map((token) =>
                    token.id === tokenId ? { ...token, ...patch } : token,
                  ),
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

      removeToken: (mapId, tokenId) => {
        set((s) => ({
          maps: s.maps.map((m) =>
            m.id === mapId ? { ...m, tokens: m.tokens.filter((t) => t.id !== tokenId) } : m,
          ),
        }))
        publishMapsState(get())
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
