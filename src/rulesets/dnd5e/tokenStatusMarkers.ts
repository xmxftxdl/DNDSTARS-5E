import {
  DND5E_STANDARD_CONDITION_IDS,
  DND5E_STANDARD_CONDITIONS,
  type Dnd5eStandardConditionId,
} from './conditions'

export const DND5E_TOKEN_STATUS_MARKER_SCHEMA_VERSION = 1 as const

export const DND5E_TACTICAL_TOKEN_STATUS_MARKER_IDS = [
  'burning',
  'bleeding',
  'diseased',
  'cursed',
  'marked',
  'concentrating',
  'silenced',
  'slowed',
  'weakened',
  'protected',
  'exposed',
  'hidden',
  'fire-averse',
] as const

export type Dnd5eTacticalTokenStatusMarkerId =
  typeof DND5E_TACTICAL_TOKEN_STATUS_MARKER_IDS[number]

export type Dnd5eTokenStatusMarkerId =
  | Dnd5eStandardConditionId
  | Dnd5eTacticalTokenStatusMarkerId

export type Dnd5eTokenStatusMarkerSource = 'dm' | 'headless' | 'workshop'
export type Dnd5eTokenStatusMarkerGrantTarget = 'self' | 'other'

export interface Dnd5eTokenStatusMarkerGrantDeclaration {
  statusId: Dnd5eTacticalTokenStatusMarkerId
  target: Dnd5eTokenStatusMarkerGrantTarget
}

/**
 * A presentation-only marker rendered over a map Token.
 *
 * This deliberately does not grant a D&D condition, modifier, or action. A
 * mechanical condition remains an ActiveEffect and can independently project
 * a same-named badge. Keeping the two models separate lets a DM annotate the
 * battlefield without mutating Headless combat state.
 */
export interface Dnd5eTokenStatusMarker {
  schemaVersion: typeof DND5E_TOKEN_STATUS_MARKER_SCHEMA_VERSION
  id: string
  statusId: Dnd5eTokenStatusMarkerId
  source: Dnd5eTokenStatusMarkerSource
  /** Optional instance label; the catalogue label is used when omitted. */
  label?: string
}

export interface Dnd5eTokenStatusMarkerDefinition {
  id: Dnd5eTokenStatusMarkerId
  label: string
  description: string
}

export interface Dnd5eTokenStatusMarkerOption {
  definition: Dnd5eTokenStatusMarkerDefinition
  kind: 'base' | 'participant-grant'
  target?: Dnd5eTokenStatusMarkerGrantTarget
  sourceTokenIds: readonly string[]
  sourceLabels: readonly string[]
}

interface Dnd5eTokenStatusMarkerCapableMonster {
  tokenStatusMarkerGrants?: readonly Dnd5eTokenStatusMarkerGrantDeclaration[]
  traits?: readonly { rule?: { kind?: string; damageType?: string } }[]
  actions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  bonusActions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  reactions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  legendaryActions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  lairActions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
}

interface Dnd5eTokenStatusMarkerCapableAction {
  attack?: {
    onHitEffects?: readonly {
      kind?: string
      label?: string
      ailment?: string
      rootLegacyCondition?: string
      dependentLegacyConditions?: readonly string[]
    }[]
  }
}

export interface Dnd5eTokenStatusMarkerParticipant {
  tokenId: string
  label: string
  monster?: Dnd5eTokenStatusMarkerCapableMonster
}

const TACTICAL_DEFINITIONS: Readonly<Record<
  Dnd5eTacticalTokenStatusMarkerId,
  Omit<Dnd5eTokenStatusMarkerDefinition, 'id'>
>> = {
  burning: { label: '燃烧', description: '地图标注：目标正在燃烧或受到火焰影响。' },
  bleeding: { label: '流血', description: '地图标注：目标正在流血。' },
  diseased: { label: '疾病', description: '地图标注：目标受到疾病影响。' },
  cursed: { label: '诅咒', description: '地图标注：目标受到诅咒影响。' },
  marked: { label: '已标记', description: '地图标注：目标被某个能力或生物标记。' },
  concentrating: { label: '专注', description: '地图标注：目标正在维持专注。' },
  silenced: { label: '沉默', description: '地图标注：目标无法正常发声。' },
  slowed: { label: '减速', description: '地图标注：目标的移动受到限制。' },
  weakened: { label: '虚弱', description: '地图标注：目标当前处于虚弱状态。' },
  protected: { label: '防护', description: '地图标注：目标当前受到额外防护。' },
  exposed: { label: '破绽', description: '地图标注：目标已暴露破绽。' },
  hidden: { label: '隐藏', description: '地图标注：目标正在隐藏。' },
  'fire-averse': { label: '畏火', description: '地图标注：目标对火焰表现出畏惧或退避反应。' },
}

const TOKEN_STATUS_MARKER_IDS = new Set<string>([
  ...DND5E_STANDARD_CONDITION_IDS,
  ...DND5E_TACTICAL_TOKEN_STATUS_MARKER_IDS,
])
const TACTICAL_TOKEN_STATUS_MARKER_IDS = new Set<string>(DND5E_TACTICAL_TOKEN_STATUS_MARKER_IDS)

const TOKEN_STATUS_MARKER_SOURCES = new Set<Dnd5eTokenStatusMarkerSource>([
  'dm',
  'headless',
  'workshop',
])

export const DND5E_BASE_TOKEN_STATUS_MARKER_DEFINITIONS: readonly (
  Dnd5eTokenStatusMarkerDefinition & { id: Dnd5eStandardConditionId }
)[] = DND5E_STANDARD_CONDITION_IDS.map((id) => ({
    id,
    label: DND5E_STANDARD_CONDITIONS[id].label,
    description: `地图标注：${DND5E_STANDARD_CONDITIONS[id].label}。手动添加该标记不会赋予同名 Headless 状态。`,
  }))

export const DND5E_TACTICAL_TOKEN_STATUS_MARKER_DEFINITIONS: readonly (
  Dnd5eTokenStatusMarkerDefinition & { id: Dnd5eTacticalTokenStatusMarkerId }
)[] = DND5E_TACTICAL_TOKEN_STATUS_MARKER_IDS.map((id) => ({ id, ...TACTICAL_DEFINITIONS[id] }))

export const DND5E_TOKEN_STATUS_MARKER_DEFINITIONS: readonly Dnd5eTokenStatusMarkerDefinition[] = [
  ...DND5E_BASE_TOKEN_STATUS_MARKER_DEFINITIONS,
  ...DND5E_TACTICAL_TOKEN_STATUS_MARKER_DEFINITIONS,
]

const TOKEN_STATUS_MARKER_DEFINITION_BY_ID = new Map(
  DND5E_TOKEN_STATUS_MARKER_DEFINITIONS.map((definition) => [definition.id, definition]),
)

const LEGACY_EFFECT_TOKEN_STATUS_MARKERS: Readonly<Record<string, Dnd5eTacticalTokenStatusMarkerId>> = {
  bleeding: 'bleeding',
  burning: 'burning',
  ignited: 'burning',
  ignite: 'burning',
  curse: 'cursed',
  cursed: 'cursed',
  disease: 'diseased',
  diseased: 'diseased',
  exposed: 'exposed',
  'fire-averse': 'fire-averse',
  hidden: 'hidden',
  marked: 'marked',
  protected: 'protected',
  silenced: 'silenced',
  slowed: 'slowed',
  weakened: 'weakened',
  '流血': 'bleeding',
  '燃烧': 'burning',
  '着火': 'burning',
  '诅咒': 'cursed',
  '疾病': 'diseased',
  '破绽': 'exposed',
  '畏火': 'fire-averse',
  '隐藏': 'hidden',
  '标记': 'marked',
  '防护': 'protected',
  '沉默': 'silenced',
  '减速': 'slowed',
  '虚弱': 'weakened',
}

interface Dnd5eTokenStatusMarkerActiveEffectProjection {
  id: string
  label?: string
  legacyCondition?: string
  suspendedBy?: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function dnd5eTokenStatusMarkerDefinition(
  statusId: Dnd5eTokenStatusMarkerId,
): Dnd5eTokenStatusMarkerDefinition {
  return TOKEN_STATUS_MARKER_DEFINITION_BY_ID.get(statusId) ?? {
    id: statusId,
    label: statusId,
    description: '地图 Token 状态标记。',
  }
}

export function createDnd5eTokenStatusMarker(
  statusId: Dnd5eTokenStatusMarkerId,
  source: Dnd5eTokenStatusMarkerSource = 'dm',
): Dnd5eTokenStatusMarker {
  return {
    schemaVersion: DND5E_TOKEN_STATUS_MARKER_SCHEMA_VERSION,
    id: `${source}:${statusId}`,
    statusId,
    source,
  }
}

function tacticalMarkerIdFromLegacyCondition(value: unknown): Dnd5eTacticalTokenStatusMarkerId | undefined {
  if (typeof value !== 'string') return undefined
  return LEGACY_EFFECT_TOKEN_STATUS_MARKERS[value.trim().toLowerCase()]
}

export function dnd5eTokenStatusMarkerGrantsFromMonster(
  monster: Dnd5eTokenStatusMarkerCapableMonster | undefined,
): Dnd5eTokenStatusMarkerGrantDeclaration[] {
  if (!monster) return []
  const result: Dnd5eTokenStatusMarkerGrantDeclaration[] = []
  const seen = new Set<string>()
  const add = (statusId: Dnd5eTokenStatusMarkerId | undefined, target: Dnd5eTokenStatusMarkerGrantTarget) => {
    if (!statusId || !TACTICAL_TOKEN_STATUS_MARKER_IDS.has(statusId)) return
    const key = `${statusId}:${target}`
    if (seen.has(key)) return
    result.push({ statusId: statusId as Dnd5eTacticalTokenStatusMarkerId, target })
    seen.add(key)
  }

  for (const declaration of monster.tokenStatusMarkerGrants ?? []) {
    add(declaration.statusId, declaration.target)
  }
  for (const trait of monster.traits ?? []) {
    if (trait.rule?.kind === 'damage-aversion' && trait.rule.damageType === 'fire') {
      add('fire-averse', 'self')
    }
  }
  const actions = [
    ...(monster.actions ?? []),
    ...(monster.bonusActions ?? []),
    ...(monster.reactions ?? []),
    ...(monster.legendaryActions ?? []),
    ...(monster.lairActions ?? []),
  ]
  for (const action of actions) {
    for (const effect of action.attack?.onHitEffects ?? []) {
      add(tacticalMarkerIdFromLegacyCondition(effect.ailment), 'other')
      add(tacticalMarkerIdFromLegacyCondition(effect.label), 'other')
      add(tacticalMarkerIdFromLegacyCondition(effect.rootLegacyCondition), 'other')
      for (const condition of effect.dependentLegacyConditions ?? []) {
        add(tacticalMarkerIdFromLegacyCondition(condition), 'other')
      }
    }
  }
  return result
}

/**
 * Builds the DM picker for one Token from the current encounter roster.
 * Core conditions are always available. Tactical badges require a declaration
 * owned by a participating source, and self-only grants never leak to others.
 */
export function dnd5eTokenStatusMarkerOptionsForTarget(input: {
  targetTokenId: string
  participants: readonly Dnd5eTokenStatusMarkerParticipant[]
}): Dnd5eTokenStatusMarkerOption[] {
  const options: Dnd5eTokenStatusMarkerOption[] = DND5E_BASE_TOKEN_STATUS_MARKER_DEFINITIONS.map(
    (definition) => ({ definition, kind: 'base', sourceTokenIds: [], sourceLabels: [] }),
  )
  const grants = new Map<Dnd5eTacticalTokenStatusMarkerId, {
    target: Dnd5eTokenStatusMarkerGrantTarget
    sourceTokenIds: string[]
    sourceLabels: string[]
  }>()
  for (const participant of input.participants) {
    for (const grant of dnd5eTokenStatusMarkerGrantsFromMonster(participant.monster)) {
      const applies = grant.target === 'self'
        ? participant.tokenId === input.targetTokenId
        : participant.tokenId !== input.targetTokenId
      if (!applies) continue
      const current = grants.get(grant.statusId) ?? {
        target: grant.target,
        sourceTokenIds: [],
        sourceLabels: [],
      }
      if (!current.sourceTokenIds.includes(participant.tokenId)) current.sourceTokenIds.push(participant.tokenId)
      if (!current.sourceLabels.includes(participant.label)) current.sourceLabels.push(participant.label)
      grants.set(grant.statusId, current)
    }
  }
  for (const definition of DND5E_TACTICAL_TOKEN_STATUS_MARKER_DEFINITIONS) {
    const grant = grants.get(definition.id as Dnd5eTacticalTokenStatusMarkerId)
    if (!grant) continue
    options.push({ definition, kind: 'participant-grant', ...grant })
  }
  return options
}

/**
 * Projects non-standard authoritative ActiveEffects into presentation badges.
 * Standard conditions use the existing condition projection and are therefore
 * intentionally not duplicated here.
 */
export function dnd5eTokenStatusMarkersFromActiveEffects(
  effects: readonly Dnd5eTokenStatusMarkerActiveEffectProjection[] | undefined,
): Dnd5eTokenStatusMarker[] {
  const result: Dnd5eTokenStatusMarker[] = []
  const seenStatuses = new Set<Dnd5eTokenStatusMarkerId>()
  for (const effect of effects ?? []) {
    if ((effect.suspendedBy?.length ?? 0) > 0) continue
    const statusId = tacticalMarkerIdFromLegacyCondition(effect.legacyCondition) ??
      tacticalMarkerIdFromLegacyCondition(effect.label)
    if (!statusId || seenStatuses.has(statusId)) continue
    const safeEffectId = effect.id
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9:_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || statusId
    result.push({
      schemaVersion: DND5E_TOKEN_STATUS_MARKER_SCHEMA_VERSION,
      id: `headless:${safeEffectId}`,
      statusId,
      source: 'headless',
      label: effect.label?.trim().slice(0, 80) || undefined,
    })
    seenStatuses.add(statusId)
  }
  return result
}

/** Fail-closed normalization for map snapshots received from another client. */
export function normalizeDnd5eTokenStatusMarkers(value: unknown): Dnd5eTokenStatusMarker[] {
  if (!Array.isArray(value)) return []
  const result: Dnd5eTokenStatusMarker[] = []
  const seenIds = new Set<string>()
  const seenStatuses = new Set<string>()
  for (const raw of value.slice(0, 64)) {
    if (!isRecord(raw) || raw.schemaVersion !== DND5E_TOKEN_STATUS_MARKER_SCHEMA_VERSION) continue
    if (typeof raw.id !== 'string' || !/^[a-z0-9][a-z0-9:_-]{0,159}$/i.test(raw.id)) continue
    if (typeof raw.statusId !== 'string' || !TOKEN_STATUS_MARKER_IDS.has(raw.statusId)) continue
    if (!TOKEN_STATUS_MARKER_SOURCES.has(raw.source as Dnd5eTokenStatusMarkerSource)) continue
    if (seenIds.has(raw.id) || seenStatuses.has(raw.statusId)) continue
    const label = typeof raw.label === 'string' && raw.label.trim()
      ? raw.label.trim().slice(0, 80)
      : undefined
    result.push({
      schemaVersion: DND5E_TOKEN_STATUS_MARKER_SCHEMA_VERSION,
      id: raw.id,
      statusId: raw.statusId as Dnd5eTokenStatusMarkerId,
      source: raw.source as Dnd5eTokenStatusMarkerSource,
      label,
    })
    seenIds.add(raw.id)
    seenStatuses.add(raw.statusId)
  }
  return result
}
