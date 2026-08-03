import { getRoomSession } from './roomSession'
import {
  CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH,
  isCharacterPortraitDataUrl,
} from './characterPortrait'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eConditionsFromActiveEffects,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'
import {
  DND5E_DECLARATIVE_DURATION_MAX_ROUNDS,
  DND5E_DECLARATIVE_LABEL_MAX_LENGTH,
  normalizeDnd5ePersistentAreaLighting,
  normalizeDnd5ePersistentAreaTriggerSnapshot,
  normalizeDnd5ePersistentAreaVerticalSnapshot,
  normalizeDnd5ePersistentAreaVisual,
} from '../rulesets/dnd5e/persistentAreaTypes'
import { MAP_FOG_RESOURCE, normalizeSharedMapFog } from './fogOfWar'
import { MAP_GEOMETRY_RESOURCE, normalizeSharedMapGeometry } from './mapGeometry'
import { MAP_EXPLORATION_RESOURCE, normalizeSharedMapExploration } from './mapExploration'
import { COMBAT_STATISTICS_RESOURCE, normalizeSharedCombatStatistics } from './combatStatistics'
import { normalizeTokenMovementAnimation } from './tokenMovementAnimation'
import {
  defaultCombatInterruptPhase,
  type CombatInterruptKind,
  type CombatInterruptPhase,
  type CombatInterruptStatus,
} from './combatInterruptQueue'
import { CAMPAIGN_TIME_RESOURCE, normalizeSharedCampaignTime, validateSharedCampaignTime } from './campaignTime'
import { isDnd5eEffectiveRulesContextV1 } from '../rulesets/dnd5e/effectiveRulesContext'
import { isDnd5eMonsterControlStateV1 } from './monsterControlState'
import { normalizeSharedCombatFlowPause } from './sharedCombatSync'
import { isDnd5eMonsterTurnProgressV1 } from './monsterTurnProgress'
import {
  SCENE_ORCHESTRATION_RESOURCE,
  validateSharedSceneOrchestration,
} from './sceneOrchestration'
import {
  SCENE_AUDIO_LIBRARY_RESOURCE,
  SCENE_AUDIO_PLAYBACK_RESOURCE,
  validateSharedSceneAudioLibrary,
  validateSharedSceneAudioPlayback,
} from './sceneAudioLibrary'

export const SHARED_RESOURCE_QUARANTINE_KEY = 'dndstars5e-shared-quarantine:v1'
export const SHARED_INTEGRITY_EVENT = 'dndstars5e-shared-integrity'

export interface SharedIntegrityIssue {
  id: string
  roomId: string
  resource: string
  reason: string
  detectedAt: number
  source: 'client' | 'server'
  quarantineId?: string
  sample?: string
}

export type SharedResourceValidation =
  | { status: 'valid'; value: Record<string, unknown> }
  | { status: 'migrated'; value: Record<string, unknown>; reasons: string[] }
  | { status: 'invalid'; reasons: string[] }

const REQUIRED_ARRAYS: Readonly<Record<string, string>> = {
  characters: 'characters',
  maps: 'maps',
  spellbook: 'spells',
  'custom-monsters': 'monsters',
  'combat-log': 'entries',
  'room-chat': 'messages',
  'room-journal': 'handouts',
  'dice-events': 'events',
  'combat-interrupts': 'interrupts',
  'player-action-requests': 'requests',
  'player-action-processed': 'actionIds',
  [MAP_FOG_RESOURCE]: 'maps',
  [MAP_GEOMETRY_RESOURCE]: 'maps',
  [MAP_EXPLORATION_RESOURCE]: 'maps',
  [COMBAT_STATISTICS_RESOURCE]: 'sessions',
  [SCENE_ORCHESTRATION_RESOURCE]: 'scenes',
  [SCENE_AUDIO_LIBRARY_RESOURCE]: 'assets',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function validTimedLightState(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.enabled !== 'boolean' ||
    !Number.isFinite(value.brightRadiusFeet) || Number(value.brightRadiusFeet) < 0 ||
    !Number.isFinite(value.dimRadiusFeet) || Number(value.dimRadiusFeet) < 0 ||
    typeof value.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(value.color) ||
    (value.sourceKind != null && !['permanent', 'torch', 'candle', 'lamp', 'hooded-lantern', 'spell', 'custom'].includes(String(value.sourceKind)))) return false
  const timing = [value.startedAtWorldMinute, value.durationMinutes, value.expiresAtWorldMinute]
  const hasTiming = timing.some((entry) => entry != null)
  if (!hasTiming) return !['torch', 'candle', 'lamp', 'hooded-lantern'].includes(String(value.sourceKind))
  return timing.every((entry) => Number.isSafeInteger(entry) && Number(entry) >= 0) &&
    Number(value.durationMinutes) > 0 && Number(value.durationMinutes) <= 365 * 24 * 60 &&
    Number(value.expiresAtWorldMinute) === Number(value.startedAtWorldMinute) + Number(value.durationMinutes)
}

function validEntityArray(value: unknown, resource: string): boolean {
  if (!Array.isArray(value)) return false
  if (resource !== 'characters' && resource !== 'maps') return true
  return value.every((entity) => isPlainObject(entity) && typeof entity.id === 'string' && entity.id.length > 0)
}

function sameStringArray(left: unknown, right: readonly string[]): boolean {
  return Array.isArray(left) && left.length === right.length &&
    left.every((entry, index) => typeof entry === 'string' && entry === right[index])
}

function validateDnd5ePluginAreas(value: unknown, path: string): string[] {
  if (value == null) return []
  if (!Array.isArray(value) || value.length > 1_024) return [`${path} 必须是有限数组`]
  const issues: string[] = []
  const ids = new Set<string>()
  value.forEach((raw, index) => {
    const areaPath = `${path}[${index}]`
    if (!isPlainObject(raw)) {
      issues.push(`${areaPath} 必须是对象`)
      return
    }
    if (typeof raw.id !== 'string' || !raw.id || ids.has(raw.id)) issues.push(`${areaPath}.id 无效或重复`)
    else ids.add(raw.id)
    for (const key of ['pluginId', 'featureId', 'label', 'sourceCharacterId', 'sourceTokenId'] as const) {
      if (typeof raw[key] !== 'string' || !raw[key]) issues.push(`${areaPath}.${key} 无效`)
    }
    if (typeof raw.label === 'string' && raw.label.length > DND5E_DECLARATIVE_LABEL_MAX_LENGTH) {
      issues.push(`${areaPath}.label 过长`)
    }
    if (typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color)) issues.push(`${areaPath}.color 无效`)
    if (
      !Number.isInteger(raw.createdRound) || Number(raw.createdRound) < 0 ||
      !Number.isInteger(raw.expiresAfterRound) || Number(raw.expiresAfterRound) < Number(raw.createdRound) ||
      Number(raw.expiresAfterRound) - Number(raw.createdRound) + 1 > DND5E_DECLARATIVE_DURATION_MAX_ROUNDS
    ) issues.push(`${areaPath} 轮数无效`)
    if (
      raw.expiresAtSourceTurnEndAfterRound != null &&
      (
        !Number.isInteger(raw.expiresAtSourceTurnEndAfterRound) ||
        Number(raw.expiresAtSourceTurnEndAfterRound) < Number(raw.createdRound) ||
        Number(raw.expiresAtSourceTurnEndAfterRound) > Number(raw.expiresAfterRound)
      )
    ) issues.push(`${areaPath}.expiresAtSourceTurnEndAfterRound 无效`)
    if (raw.concentrationId != null && (typeof raw.concentrationId !== 'string' || !raw.concentrationId)) {
      issues.push(`${areaPath}.concentrationId 无效`)
    }
    if (raw.relation != null && !['any', 'ally', 'enemy'].includes(String(raw.relation))) {
      issues.push(`${areaPath}.relation 无效`)
    }
    if (raw.includeSelf != null && typeof raw.includeSelf !== 'boolean') {
      issues.push(`${areaPath}.includeSelf 无效`)
    }
    if (raw.visual != null && !normalizeDnd5ePersistentAreaVisual(raw.visual)) {
      issues.push(`${areaPath}.visual 无效`)
    }
    if (raw.lighting != null && !normalizeDnd5ePersistentAreaLighting(raw.lighting)) {
      issues.push(`${areaPath}.lighting 无效`)
    }
    if (raw.vertical != null && !normalizeDnd5ePersistentAreaVerticalSnapshot(raw.vertical)) {
      issues.push(`${areaPath}.vertical 无效`)
    }
    const triggerIds = new Set<string>()
    const receiptTriggerIds = new Set<string>()
    if (raw.triggers != null) {
      if (!Array.isArray(raw.triggers) || raw.triggers.length > 16) {
        issues.push(`${areaPath}.triggers 无效`)
      } else {
        raw.triggers.forEach((trigger, triggerIndex) => {
          const normalized = normalizeDnd5ePersistentAreaTriggerSnapshot(trigger)
          if (!normalized || triggerIds.has(normalized.id)) {
            issues.push(`${areaPath}.triggers[${triggerIndex}] 无效或重复`)
          } else {
            triggerIds.add(normalized.id)
            receiptTriggerIds.add(normalized.id)
            if (normalized.frequencyGroupId) receiptTriggerIds.add(normalized.frequencyGroupId)
          }
        })
      }
    }
    if (raw.triggerReceipts != null) {
      if (!Array.isArray(raw.triggerReceipts) || raw.triggerReceipts.length > 2_048) {
        issues.push(`${areaPath}.triggerReceipts 无效`)
      } else {
        const transactionIds = new Set<string>()
        raw.triggerReceipts.forEach((receipt, receiptIndex) => {
          const receiptPath = `${areaPath}.triggerReceipts[${receiptIndex}]`
          if (
            !isPlainObject(receipt) || !receiptTriggerIds.has(String(receipt.triggerId)) ||
            typeof receipt.targetTokenId !== 'string' || !receipt.targetTokenId ||
            !Number.isInteger(receipt.round) || Number(receipt.round) < 0 ||
            (receipt.turnKey != null && (typeof receipt.turnKey !== 'string' || !receipt.turnKey || receipt.turnKey.length > 160)) ||
            typeof receipt.transactionId !== 'string' || !receipt.transactionId ||
            transactionIds.has(receipt.transactionId)
          ) issues.push(`${receiptPath} 无效或重复`)
          else transactionIds.add(receipt.transactionId)
        })
      }
    }
    if (!Array.isArray(raw.cells) || raw.cells.length < 1 || raw.cells.length > 4_096) {
      issues.push(`${areaPath}.cells 无效`)
    } else if (raw.cells.some((cell) =>
      !isPlainObject(cell) || !Number.isInteger(cell.col) || !Number.isInteger(cell.row) ||
      Math.abs(Number(cell.col)) > 1_000_000 || Math.abs(Number(cell.row)) > 1_000_000
    )) issues.push(`${areaPath}.cells 包含无效格子`)
  })
  return issues
}

function validateDnd5eSummon(value: unknown, path: string): string[] {
  if (value == null) return []
  if (!isPlainObject(value)) return [`${path} 必须是对象`]
  const issues: string[] = []
  if (value.schemaVersion !== 1) issues.push(`${path}.schemaVersion 无效`)
  for (const key of ['pluginId', 'featureId', 'sourceCharacterId', 'sourceTokenId'] as const) {
    if (typeof value[key] !== 'string' || !value[key]) issues.push(`${path}.${key} 无效`)
  }
  if (
    !Number.isInteger(value.createdRound) || Number(value.createdRound) < 0 ||
    !Number.isInteger(value.expiresAfterRound) || Number(value.expiresAfterRound) < Number(value.createdRound) ||
    Number(value.expiresAfterRound) - Number(value.createdRound) + 1 > DND5E_DECLARATIVE_DURATION_MAX_ROUNDS
  ) issues.push(`${path} 轮数无效`)
  if (value.concentrationId != null && (typeof value.concentrationId !== 'string' || !value.concentrationId)) {
    issues.push(`${path}.concentrationId 无效`)
  }
  if (value.side !== 'player' && value.side !== 'enemy') issues.push(`${path}.side 无效`)
  return issues
}

function validateDnd5eSpellEffect(value: unknown, path: string): string[] {
  if (value == null) return []
  if (!isPlainObject(value)) return [`${path} 必须是对象`]
  const issues: string[] = []
  if (value.schemaVersion !== 1) issues.push(`${path}.schemaVersion 无效`)
  for (const key of ['spellId', 'sourceCharacterId', 'sourceTokenId'] as const) {
    if (typeof value[key] !== 'string' || !value[key]) issues.push(`${path}.${key} 无效`)
  }
  if (
    !Number.isInteger(value.createdRound) || Number(value.createdRound) < 0 ||
    !Number.isInteger(value.expiresAfterRound) || Number(value.expiresAfterRound) < Number(value.createdRound) ||
    Number(value.expiresAfterRound) - Number(value.createdRound) + 1 > DND5E_DECLARATIVE_DURATION_MAX_ROUNDS
  ) issues.push(`${path} 轮数无效`)
  if (value.concentrationId != null && (typeof value.concentrationId !== 'string' || !value.concentrationId)) {
    issues.push(`${path}.concentrationId 无效`)
  }
  return issues
}

function validateDnd5eSpellEffectLinks(map: Record<string, unknown>, path: string): string[] {
  if (!Array.isArray(map.tokens)) return []
  const issues: string[] = []
  const tokens = map.tokens.filter(isPlainObject)
  const areas = Array.isArray(map.dnd5ePluginAreas) ? map.dnd5ePluginAreas.filter(isPlainObject) : []
  for (const token of tokens) {
    if (token.dnd5eSpellEffect == null) continue
    if (token.type !== 'obstacle') issues.push(`${path}.tokens.${String(token.id)} 必须是 obstacle 效果 Token`)
    const effect = isPlainObject(token.dnd5eSpellEffect) ? token.dnd5eSpellEffect : undefined
    const linked = areas.find((area) =>
      area.sourceKind === 'core-spell' && area.anchorMode === 'effect-token' && area.anchorTokenId === token.id,
    )
    if (
      !effect || !linked || linked.coreSpellId !== effect.spellId ||
      linked.sourceCharacterId !== effect.sourceCharacterId || linked.sourceTokenId !== effect.sourceTokenId
    ) issues.push(`${path}.tokens.${String(token.id)} 缺少匹配的核心法术区域`)
  }
  for (const area of areas) {
    if (area.sourceKind !== 'core-spell' || area.anchorMode !== 'effect-token') continue
    if (!tokens.some((token) => token.id === area.anchorTokenId && token.dnd5eSpellEffect != null)) {
      issues.push(`${path}.dnd5ePluginAreas.${String(area.id)} 缺少效果 Token`)
    }
  }
  return issues
}

const COMBAT_INTERRUPT_KINDS = new Set<CombatInterruptKind>([
  'dodge', 'stable-mind', 'gale-combo', 'agile-leap', 'opportunity-attack', 'protection',
  'shield-spell', 'counterspell', 'uncanny-dodge', 'deflect-missiles', 'saving-throw-reroll',
  'legendary-resistance', 'bardic-inspiration', 'cutting-words', 'dark-ones-own-luck',
  'stroke-of-luck', 'empowered-spell', 'stand-against-tide', 'plugin-choice', 'dm-adjudication',
  'roll-confirmation',
])
const COMBAT_INTERRUPT_STATUSES = new Set<CombatInterruptStatus>([
  'pending', 'waiting-for-dm', 'rolling', 'answered', 'done', 'rolled-back',
])
const COMBAT_INTERRUPT_PHASES = new Set<CombatInterruptPhase>([
  'before-action', 'after-roll', 'before-hit', 'before-damage', 'after-save', 'before-condition',
])

function migrateCombatInterruptEnvelope(input: Record<string, unknown>): {
  value: Record<string, unknown>
  issues: string[]
  migrations: string[]
} {
  if (!Array.isArray(input.interrupts)) return { value: input, issues: [], migrations: [] }
  const issues: string[] = []
  const migrations: string[] = []
  const ids = new Set<string>()
  const interrupts = input.interrupts.map((raw, index) => {
    const path = `interrupts[${index}]`
    if (!isPlainObject(raw)) {
      issues.push(`${path} 必须是对象`)
      return raw
    }
    const kind = raw.kind as CombatInterruptKind
    if (typeof raw.id !== 'string' || !raw.id || ids.has(raw.id)) issues.push(`${path}.id 无效或重复`)
    else ids.add(raw.id)
    if (typeof raw.mapId !== 'string' || !raw.mapId) issues.push(`${path}.mapId 无效`)
    if (!COMBAT_INTERRUPT_KINDS.has(kind)) issues.push(`${path}.kind 无效`)
    if (!COMBAT_INTERRUPT_STATUSES.has(raw.status as CombatInterruptStatus)) issues.push(`${path}.status 无效`)
    if (!isPlainObject(raw.payload)) issues.push(`${path}.payload 必须是对象`)
    if (raw.contributions != null) {
      if (!Array.isArray(raw.contributions) || raw.contributions.length > 32) {
        issues.push(`${path}.contributions 无效`)
      } else {
        raw.contributions.forEach((entry, contributionIndex) => {
          const contributionPath = `${path}.contributions[${contributionIndex}]`
          const contributionShapeValid = isPlainObject(entry) && (
            (entry.kind === 'replace-d20' && entry.dieIndex === 0 &&
              Number.isInteger(entry.replacementValue) &&
              Number(entry.replacementValue) >= 1 && Number(entry.replacementValue) <= 20) ||
            (entry.kind === 'adjust-d20' && typeof entry.featureId === 'string' && !!entry.featureId.trim() &&
              (entry.direction === 'add' || entry.direction === 'subtract'))
          )
          if (
            !isPlainObject(entry) || !contributionShapeValid ||
            typeof entry.id !== 'string' || !entry.id ||
            typeof entry.characterId !== 'string' || !entry.characterId ||
            typeof entry.characterName !== 'string' || !entry.characterName.trim() ||
            typeof entry.featureLabel !== 'string' || !entry.featureLabel.trim() ||
            !Number.isFinite(entry.createdAt)
          ) issues.push(`${contributionPath} 无效`)
        })
      }
    }
    if (!Number.isFinite(raw.createdAt) || !Number.isFinite(raw.updatedAt)) issues.push(`${path} 时间戳无效`)
    if (raw.expiresAt != null && !Number.isFinite(raw.expiresAt)) issues.push(`${path}.expiresAt 无效`)
    const transactionId = typeof raw.transactionId === 'string' && raw.transactionId ? raw.transactionId : raw.id
    const phase = COMBAT_INTERRUPT_PHASES.has(raw.phase as CombatInterruptPhase)
      ? raw.phase as CombatInterruptPhase
      : COMBAT_INTERRUPT_KINDS.has(kind) ? defaultCombatInterruptPhase(kind) : undefined
    const timeoutPolicy = raw.timeoutPolicy === 'wait-for-dm' ? 'wait-for-dm' : 'rollback'
    if (!transactionId || !phase) return raw
    if (raw.transactionId !== transactionId || raw.phase !== phase || raw.timeoutPolicy !== timeoutPolicy) {
      migrations.push(`${path} 已补齐 P1 事务元数据`)
      return { ...raw, transactionId, phase, timeoutPolicy }
    }
    return raw
  })
  const activeLocks = new Map<string, string>()
  for (const [index, raw] of interrupts.entries()) {
    if (!isPlainObject(raw) || raw.status === 'done' || raw.status === 'rolled-back') continue
    const transactionId = String(raw.transactionId ?? '')
    const previous = activeLocks.get(transactionId)
    if (previous) issues.push(`interrupts[${index}] 与 ${previous} 重复锁定事务 ${transactionId}`)
    else activeLocks.set(transactionId, `interrupts[${index}]`)
  }
  return { value: { ...input, interrupts }, issues, migrations }
}

function migrateDnd5eStateEnvelope(
  name: string,
  input: Record<string, unknown>,
): { value: Record<string, unknown>; issues: string[]; migrations: string[] } {
  if (name !== 'characters' && name !== 'maps') return { value: input, issues: [], migrations: [] }
  const issues: string[] = []
  const migrations: string[] = []

  const migrateEntity = (
    entity: Record<string, unknown>,
    path: string,
    conditionsAtEntity: boolean,
  ): Record<string, unknown> => {
    const rawState = entity.dnd5eCombatState
    const state = isPlainObject(rawState) ? rawState : undefined
    const rawConditions = conditionsAtEntity ? entity.conditions : state?.conditions
    if (!state && !Array.isArray(rawConditions)) return entity
    if (!state && Array.isArray(rawConditions) && rawConditions.length === 0) return entity
    if (state?.activeEffects != null) {
      const validation = validateDnd5eActiveEffectsStrict(state.activeEffects)
      if (!validation.ok) {
        issues.push(...validation.issues.map((issue) => `${path}.${issue}`))
        return entity
      }
    }
    const isV2 = state?.schemaVersion === DND5E_COMBAT_STATE_SCHEMA_VERSION
    if (isV2) {
      if (state?.timedEffects != null) issues.push(`${path}.timedEffects 不允许出现在 schema v2`)
      const projected = dnd5eConditionsFromActiveEffects(
        validateDnd5eActiveEffectsStrict(state?.activeEffects).effects,
      )
      if (!sameStringArray(rawConditions ?? [], projected)) {
        issues.push(`${path}.conditions 与 activeEffects 投影不一致`)
      }
      return entity
    }
    const migrated = migrateDnd5eCombatStateEffects({
      targetId: typeof entity.id === 'string' ? entity.id : path,
      state: state as Parameters<typeof migrateDnd5eCombatStateEffects>[0]['state'],
      conditions: Array.isArray(rawConditions)
        ? rawConditions.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
    })
    migrations.push(`${path} 已升级为 ActiveEffect schema v2`)
    const { timedEffects: _legacyTimedEffects, ...nativeState } = state ?? {}
    void _legacyTimedEffects
    const nextState = {
      ...nativeState,
      schemaVersion: migrated.schemaVersion,
      activeEffects: migrated.activeEffects,
      ...(conditionsAtEntity
        ? {}
        : { conditions: migrated.conditions.length > 0 ? migrated.conditions : undefined }),
    }
    return {
      ...entity,
      ...(conditionsAtEntity ? { conditions: migrated.conditions } : {}),
      dnd5eCombatState: nextState,
    }
  }

  if (name === 'characters') {
    let portraitLength = 0
    const characters = (input.characters as unknown[]).map((entry, index) =>
      isPlainObject(entry)
        ? (() => {
            if (entry.portrait != null) {
              if (!isCharacterPortraitDataUrl(entry.portrait)) {
                issues.push(`characters[${index}].portrait 不是有效且受限的人物立绘`)
              } else portraitLength += entry.portrait.length
            }
            if (entry.initiativePortrait != null) {
              if (!isCharacterPortraitDataUrl(entry.initiativePortrait)) {
                issues.push(`characters[${index}].initiativePortrait 不是有效且受限的先攻立绘`)
              } else portraitLength += entry.initiativePortrait.length
            }
            if (entry.tokenPortrait != null) {
              if (!isCharacterPortraitDataUrl(entry.tokenPortrait)) {
                issues.push(`characters[${index}].tokenPortrait 不是有效且受限的地图 Token 图片`)
              } else portraitLength += entry.tokenPortrait.length
            }
            return migrateEntity(entry, `characters[${index}]`, true)
          })()
        : entry,
    )
    if (portraitLength > CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH) {
      issues.push('人物立绘总量超过房间同步上限，请移除部分立绘或重新压缩')
    }
    return { value: { ...input, characters }, issues, migrations }
  }
  const maps = (input.maps as unknown[]).map((entry, mapIndex) => {
    if (!isPlainObject(entry)) return entry
    issues.push(...validateDnd5ePluginAreas(entry.dnd5ePluginAreas, `maps[${mapIndex}].dnd5ePluginAreas`))
    issues.push(...validateDnd5eSpellEffectLinks(entry, `maps[${mapIndex}]`))
    if (!Array.isArray(entry.tokens)) return entry
    return {
      ...entry,
      tokens: entry.tokens.map((token, tokenIndex) => {
        if (!isPlainObject(token)) return token
        const path = `maps[${mapIndex}].tokens[${tokenIndex}]`
        if (token.lightSource != null && !validTimedLightState(token.lightSource)) {
          issues.push(`${path}.lightSource 不是有效的限时光源`)
        }
        issues.push(...validateDnd5eSummon(token.dnd5eSummon, `${path}.dnd5eSummon`))
        issues.push(...validateDnd5eSpellEffect(token.dnd5eSpellEffect, `${path}.dnd5eSpellEffect`))
        const migrated = migrateEntity(token, path, false)
        if (token.movementAnimation == null) return migrated
        const movementAnimation = normalizeTokenMovementAnimation(token.movementAnimation)
        if (!movementAnimation) {
          issues.push(`${path}.movementAnimation 不是有效的权威移动路径`)
          return migrated
        }
        return { ...migrated, movementAnimation }
      }),
    }
  })
  return { value: { ...input, maps }, issues, migrations }
}

/**
 * Every state read and write crosses this registry. Known envelopes get their
 * required collections checked; future plugin resources still have to be a
 * JSON object so an accidental scalar can never poison the shared store.
 */
export function validateAndMigrateSharedResource(name: string, input: unknown): SharedResourceValidation {
  if (!isPlainObject(input)) return { status: 'invalid', reasons: ['共享状态必须是对象'] }
  const reasons: string[] = []
  if (name === MAP_FOG_RESOURCE && !normalizeSharedMapFog(input)) {
    reasons.push('战争迷雾资源结构损坏')
  }
  if (name === MAP_GEOMETRY_RESOURCE && !normalizeSharedMapGeometry(input)) {
    reasons.push('地图几何资源结构损坏')
  }
  if (name === MAP_EXPLORATION_RESOURCE && !normalizeSharedMapExploration(input)) {
    reasons.push('地图探索记忆结构损坏')
  }
  if (name === COMBAT_STATISTICS_RESOURCE && !normalizeSharedCombatStatistics(input)) {
    reasons.push('进阶数据资源结构损坏')
  }
  if (name === CAMPAIGN_TIME_RESOURCE && !validateSharedCampaignTime(input)) {
    reasons.push('战役时间资源结构损坏')
  }
  if (name === SCENE_ORCHESTRATION_RESOURCE && !validateSharedSceneOrchestration(input)) {
    reasons.push('场景编排资源结构损坏')
  }
  if (name === SCENE_AUDIO_LIBRARY_RESOURCE && !validateSharedSceneAudioLibrary(input)) {
    reasons.push('场景音频目录结构损坏')
  }
  if (name === SCENE_AUDIO_PLAYBACK_RESOURCE && !validateSharedSceneAudioPlayback(input)) {
    reasons.push('场景音频播放状态损坏')
  }
  const requiredArray = REQUIRED_ARRAYS[name]
  if (requiredArray && !validEntityArray(input[requiredArray], name)) {
    reasons.push(`缺少或损坏数组字段 ${requiredArray}`)
  }
  if (name === 'room-journal' && (!Array.isArray(input.campaignEntries) || !Array.isArray(input.sharedNotes))) {
    reasons.push('讲义资源缺少 campaignEntries 或 sharedNotes 数组')
  }
  if (
    name === 'room-journal' &&
    input.authorityMutationReceipts != null &&
    (
      !Array.isArray(input.authorityMutationReceipts) ||
      input.authorityMutationReceipts.length > 512 ||
      input.authorityMutationReceipts.some((receipt) =>
        typeof receipt !== 'string' || !receipt.trim() || receipt.length > 300)
    )
  ) {
    reasons.push('讲义权威事务收据损坏')
  }
  if (input.updatedAt != null && (!Number.isFinite(input.updatedAt) || Number(input.updatedAt) < 0)) {
    reasons.push('updatedAt 不是有效时间戳')
  }
  if (name === 'combat' && input.active != null && typeof input.active !== 'boolean') {
    reasons.push('combat.active 不是布尔值')
  }
  if (name === 'combat' && input.effectiveRules != null && !isDnd5eEffectiveRulesContextV1(input.effectiveRules)) {
    reasons.push('combat.effectiveRules 规则快照损坏')
  }
  if (name === 'combat' && input.monsterControl != null && !isDnd5eMonsterControlStateV1(input.monsterControl)) {
    reasons.push('combat.monsterControl 怪物控制状态损坏')
  }
  if (name === 'combat' && input.flowPause != null && !normalizeSharedCombatFlowPause(input.flowPause)) {
    reasons.push('combat.flowPause 战斗暂停状态损坏')
  }
  if (
    name === 'combat' &&
    input.monsterTurnProgress != null &&
    !isDnd5eMonsterTurnProgressV1(input.monsterTurnProgress)
  ) {
    reasons.push('combat.monsterTurnProgress is invalid')
  }
  if (name === 'dm-authority-ready' && typeof input.ready !== 'boolean') {
    reasons.push('dm-authority-ready.ready 不是布尔值')
  }
  if (input._sync != null) {
    const sync = input._sync
    if (
      !isPlainObject(sync) ||
      sync.schemaVersion !== 1 ||
      !Number.isInteger(sync.revision) ||
      Number(sync.revision) < 0 ||
      typeof sync.writerId !== 'string' ||
      !Number.isFinite(sync.writtenAt)
    ) reasons.push('_sync 版本元数据损坏')
  }
  if (reasons.length > 0) return { status: 'invalid', reasons }

  if (name === 'combat-interrupts') {
    const interrupts = migrateCombatInterruptEnvelope(input)
    if (interrupts.issues.length > 0) return { status: 'invalid', reasons: interrupts.issues }
    return interrupts.migrations.length > 0
      ? { status: 'migrated', value: interrupts.value, reasons: interrupts.migrations }
      : { status: 'valid', value: interrupts.value }
  }

  const dnd5e = migrateDnd5eStateEnvelope(name, input)
  if (dnd5e.issues.length > 0) return { status: 'invalid', reasons: dnd5e.issues }
  let value = dnd5e.value
  const migrationReasons = [...dnd5e.migrations]

  if (name === CAMPAIGN_TIME_RESOURCE && input.schemaVersion === 1) {
    value = normalizeSharedCampaignTime(input) as unknown as Record<string, unknown>
    migrationReasons.push('战役时间已迁移至可配置历法 V2')
  }

  if (name === 'combat' && Object.hasOwn(value, 'enemyApByToken')) {
    const migrated = { ...value }
    delete migrated.enemyApByToken
    value = migrated
    migrationReasons.push('已移除旧 AP 战斗字段')
  }
  return migrationReasons.length > 0
    ? { status: 'migrated', value, reasons: migrationReasons }
    : { status: 'valid', value }
}

function safeSample(value: unknown): string {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value)
    return serialized.length > 64_000 ? `${serialized.slice(0, 64_000)}…` : serialized
  } catch {
    return '[无法序列化的状态]'
  }
}

function storedIssues(): SharedIntegrityIssue[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SHARED_RESOURCE_QUARANTINE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isSharedIntegrityIssue) : []
  } catch {
    return []
  }
}

function isSharedIntegrityIssue(value: unknown): value is SharedIntegrityIssue {
  return isPlainObject(value) && typeof value.id === 'string' && typeof value.resource === 'string' &&
    typeof value.reason === 'string' && typeof value.detectedAt === 'number'
}

export function reportSharedIntegrityIssue(input: {
  resource: string
  reason: string
  value?: unknown
  source?: 'client' | 'server'
  quarantineId?: string
}): SharedIntegrityIssue {
  const issue: SharedIntegrityIssue = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    roomId: getRoomSession()?.roomId ?? 'default',
    resource: input.resource,
    reason: input.reason,
    detectedAt: Date.now(),
    source: input.source ?? 'client',
    quarantineId: input.quarantineId,
    ...(input.value === undefined ? {} : { sample: safeSample(input.value) }),
  }
  if (typeof window !== 'undefined') {
    const next = [issue, ...storedIssues()].slice(0, 12)
    try {
      window.localStorage.setItem(SHARED_RESOURCE_QUARANTINE_KEY, JSON.stringify(next))
    } catch {
      // The in-memory event still surfaces the failure if storage is full.
    }
    window.dispatchEvent(new CustomEvent<SharedIntegrityIssue>(SHARED_INTEGRITY_EVENT, { detail: issue }))
  }
  return issue
}

export function latestSharedIntegrityIssue(): SharedIntegrityIssue | null {
  return storedIssues()[0] ?? null
}

export function clearSharedIntegrityIssues(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SHARED_RESOURCE_QUARANTINE_KEY)
  window.dispatchEvent(new CustomEvent(SHARED_INTEGRITY_EVENT))
}
