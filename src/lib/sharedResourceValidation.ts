import { getRoomSession } from './roomSession'
import {
  DND5E_COMBAT_STATE_SCHEMA_VERSION,
  dnd5eConditionsFromActiveEffects,
  validateDnd5eActiveEffectsStrict,
} from '../rulesets/dnd5e/activeEffects'
import { migrateDnd5eCombatStateEffects } from '../rulesets/dnd5e/legacyActiveEffectMigration'
import {
  defaultCombatInterruptPhase,
  type CombatInterruptKind,
  type CombatInterruptPhase,
  type CombatInterruptStatus,
} from './combatInterruptQueue'

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
  'combat-log': 'entries',
  'dice-events': 'events',
  'combat-interrupts': 'interrupts',
  'player-action-requests': 'requests',
  'player-action-processed': 'actionIds',
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

const COMBAT_INTERRUPT_KINDS = new Set<CombatInterruptKind>([
  'dodge', 'stable-mind', 'gale-combo', 'agile-leap', 'opportunity-attack', 'protection',
  'shield-spell', 'counterspell', 'uncanny-dodge', 'deflect-missiles', 'saving-throw-reroll',
  'legendary-resistance', 'bardic-inspiration', 'cutting-words', 'dark-ones-own-luck',
  'stroke-of-luck', 'empowered-spell', 'stand-against-tide', 'plugin-choice', 'dm-adjudication',
])
const COMBAT_INTERRUPT_STATUSES = new Set<CombatInterruptStatus>([
  'pending', 'waiting-for-dm', 'rolling', 'answered', 'done', 'rolled-back',
])
const COMBAT_INTERRUPT_PHASES = new Set<CombatInterruptPhase>([
  'before-action', 'before-hit', 'before-damage', 'after-save', 'before-condition',
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
    const characters = (input.characters as unknown[]).map((entry, index) =>
      isPlainObject(entry) ? migrateEntity(entry, `characters[${index}]`, true) : entry,
    )
    return { value: { ...input, characters }, issues, migrations }
  }
  const maps = (input.maps as unknown[]).map((entry, mapIndex) => {
    if (!isPlainObject(entry) || !Array.isArray(entry.tokens)) return entry
    return {
      ...entry,
      tokens: entry.tokens.map((token, tokenIndex) =>
        isPlainObject(token)
          ? migrateEntity(token, `maps[${mapIndex}].tokens[${tokenIndex}]`, false)
          : token,
      ),
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
  const requiredArray = REQUIRED_ARRAYS[name]
  if (requiredArray && !validEntityArray(input[requiredArray], name)) {
    reasons.push(`缺少或损坏数组字段 ${requiredArray}`)
  }
  if (input.updatedAt != null && (!Number.isFinite(input.updatedAt) || Number(input.updatedAt) < 0)) {
    reasons.push('updatedAt 不是有效时间戳')
  }
  if (name === 'combat' && input.active != null && typeof input.active !== 'boolean') {
    reasons.push('combat.active 不是布尔值')
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
