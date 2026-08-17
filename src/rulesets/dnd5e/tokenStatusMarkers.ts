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
  'attached',
  'suffocating',
] as const

export type Dnd5eTacticalTokenStatusMarkerId =
  typeof DND5E_TACTICAL_TOKEN_STATUS_MARKER_IDS[number]

export type Dnd5eTokenStatusMarkerId =
  | Dnd5eStandardConditionId
  | Dnd5eTacticalTokenStatusMarkerId

export type Dnd5eTokenStatusMarkerSource = 'dm' | 'headless' | 'workshop'
export type Dnd5eTokenStatusMarkerGrantTarget = 'self' | 'other'
export type Dnd5eTokenStatusMarkerGrantApplication = 'marker' | 'active-effect'

export interface Dnd5eTokenStatusMarkerGrantDeclaration {
  statusId: Dnd5eTacticalTokenStatusMarkerId
  target: Dnd5eTokenStatusMarkerGrantTarget
  /**
   * `marker` is presentation-only. `active-effect` creates an authoritative
   * lifecycle instance which can be triggered by Headless or toggled by a DM.
   * Legacy workshop rows default to `marker`.
   */
  application?: Dnd5eTokenStatusMarkerGrantApplication
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
  /** ActiveEffect id when this badge is projected from an authoritative instance. */
  activeEffectId?: string
  sourceActorId?: string
  /** Human-readable source used by the read-only badge detail dialog. */
  sourceLabel?: string
  /** A derived monster trait/state is mechanical rather than a DM annotation. */
  mechanical?: boolean
  /** Exact rule summary for mechanical derived markers. */
  detailDescription?: string
  backgroundColor?: string
  borderColor?: string
  glowColor?: string
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
  targets?: readonly Dnd5eTokenStatusMarkerGrantTarget[]
  applications: readonly Dnd5eTokenStatusMarkerGrantApplication[]
  sourceTokenIds: readonly string[]
  sourceLabels: readonly string[]
}

interface Dnd5eTokenStatusMarkerCapableMonster {
  tokenStatusMarkerGrants?: readonly Dnd5eTokenStatusMarkerGrantDeclaration[]
  traits?: readonly {
    name?: string
    rule?: {
      kind?: string
      damageType?: string
      condition?: string
      initialCondition?: string
      failureCondition?: string
      suppressedByDamageTypes?: readonly string[]
    }
  }[]
  actions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  bonusActions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  reactions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  legendaryActions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  lairActions?: readonly Dnd5eTokenStatusMarkerCapableAction[]
  headlessMechanics?: readonly unknown[]
}

interface Dnd5eTokenStatusMarkerCapableAction {
  attack?: {
    onHitRule?: {
      condition?: string
    }
    onHitEffects?: readonly {
      kind?: string
      label?: string
      ailment?: string
      rootLegacyCondition?: string
      dependentLegacyConditions?: readonly string[]
      dependentLegacyConditionsWhenAttackHasAdvantage?: readonly {
        condition?: string
      }[]
      standardCondition?: string
    }[]
  }
  rule?: {
    kind?: string
    condition?: string
    initialCondition?: string
    failureCondition?: string
    activeEffectOnFailedSave?: {
      label?: string
      standardCondition?: string
      modifiers?: {
        speedMultiplier?: number
        strengthRollMode?: string
        preventHealing?: boolean
      }
    }
    effect?: {
      rootLegacyCondition?: string
      dependentLegacyConditions?: readonly string[]
    }
    variants?: readonly {
      activeEffectOnFailedSave?: {
        label?: string
        standardCondition?: string
        modifiers?: {
          speedMultiplier?: number
          strengthRollMode?: string
          preventHealing?: boolean
        }
      }
    }[]
  }
}

export type Dnd5eMonsterRuntimeStatusId =
  | 'monster-berserk'
  | 'monster-damage-aversion'
  | 'monster-regeneration-suppressed'

export interface Dnd5eMonsterRuntimeStatusCapability {
  id: Dnd5eMonsterRuntimeStatusId
  label: string
  description: string
  glyph: string
  sourceLabel: string
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
  attached: { label: '附着', description: '地图标注：另一生物或效果正附着在目标身上。' },
  suffocating: { label: '窒息', description: '地图标注：目标当前无法呼吸。' },
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
  attached: 'attached',
  hidden: 'hidden',
  marked: 'marked',
  protected: 'protected',
  silenced: 'silenced',
  slowed: 'slowed',
  weakened: 'weakened',
  'unable-to-breathe': 'suffocating',
  '流血': 'bleeding',
  '燃烧': 'burning',
  '着火': 'burning',
  '诅咒': 'cursed',
  '疾病': 'diseased',
  '破绽': 'exposed',
  '畏火': 'fire-averse',
  '附着': 'attached',
  '隐藏': 'hidden',
  '标记': 'marked',
  '防护': 'protected',
  '沉默': 'silenced',
  '减速': 'slowed',
  '虚弱': 'weakened',
  '无法呼吸': 'suffocating',
  '窒息': 'suffocating',
}

interface Dnd5eTokenStatusMarkerActiveEffectProjection {
  id: string
  label?: string
  legacyCondition?: string
  suspendedBy?: readonly string[]
  source?: { actorId?: string; actorName?: string; label?: string; rulesId?: string }
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

export function dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(
  value: unknown,
): Dnd5eTacticalTokenStatusMarkerId | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()
  const exact = LEGACY_EFFECT_TOKEN_STATUS_MARKERS[normalized]
  if (exact) return exact
  if (/ignit|burn|燃烧|着火/.test(normalized)) return 'burning'
  if (/bleed|流血/.test(normalized)) return 'bleeding'
  if (/disease|diseased|疾病/.test(normalized)) return 'diseased'
  if (/curse|cursed|诅咒/.test(normalized)) return 'cursed'
  if (/silenc|沉默/.test(normalized)) return 'silenced'
  if (/slow|迟缓|减速/.test(normalized)) return 'slowed'
  if (/weaken|衰弱|虚弱/.test(normalized)) return 'weakened'
  if (/protect|ward|防护/.test(normalized)) return 'protected'
  if (/expos|破绽/.test(normalized)) return 'exposed'
  if (/invisib|hidden|隐藏|隐形/.test(normalized)) return 'hidden'
  if (/attach|附着/.test(normalized)) return 'attached'
  if (/unable-to-breathe|suffocat|无法呼吸|窒息/.test(normalized)) return 'suffocating'
  if (/mark|标记/.test(normalized)) return 'marked'
  return undefined
}

function tacticalMarkerIdFromAreaEffect(effect: {
  label?: string
  modifiers?: {
    speedMultiplier?: number
    strengthRollMode?: string
    preventHealing?: boolean
  }
} | undefined): Dnd5eTacticalTokenStatusMarkerId | undefined {
  if (!effect) return undefined
  return dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(effect.label) ??
    (typeof effect.modifiers?.speedMultiplier === 'number' && effect.modifiers.speedMultiplier < 1
      ? 'slowed'
      : effect.modifiers?.strengthRollMode === 'disadvantage'
        ? 'weakened'
        : effect.modifiers?.preventHealing === true
          ? 'weakened'
          : undefined)
}

export function dnd5eMonsterRuntimeStatusCapabilities(
  monster: Dnd5eTokenStatusMarkerCapableMonster | undefined,
): Dnd5eMonsterRuntimeStatusCapability[] {
  if (!monster) return []
  const result: Dnd5eMonsterRuntimeStatusCapability[] = []
  for (const trait of monster.traits ?? []) {
    if (trait.rule?.kind === 'berserk' && !result.some((entry) => entry.id === 'monster-berserk')) {
      result.push({
        id: 'monster-berserk',
        label: '狂暴',
        description: '按怪物的狂暴规则改变目标选择与攻击行为，直到规则或 DM 将其解除。',
        glyph: '怒',
        sourceLabel: trait.name?.trim() || '狂暴特质',
      })
    }
    if (trait.rule?.kind === 'damage-aversion' && !result.some((entry) => entry.id === 'monster-damage-aversion')) {
      result.push({
        id: 'monster-damage-aversion',
        label: '伤害畏避',
        description: `受到${trait.rule.damageType ?? '特定'}伤害后，按该特质承受对应的投骰劣势。`,
        glyph: '畏',
        sourceLabel: trait.name?.trim() || '伤害畏避特质',
      })
    }
    if (
      trait.rule?.kind === 'regeneration' &&
      (trait.rule.suppressedByDamageTypes?.length ?? 0) > 0 &&
      !result.some((entry) => entry.id === 'monster-regeneration-suppressed')
    ) {
      result.push({
        id: 'monster-regeneration-suppressed',
        label: '再生受抑',
        description: `受到${trait.rule.suppressedByDamageTypes?.join('／')}伤害后，本次回合开始时不会触发再生。`,
        glyph: '抑',
        sourceLabel: trait.name?.trim() || '再生特质',
      })
    }
  }
  return result
}

export function dnd5eTokenStatusMarkerGrantsFromMonster(
  monster: Dnd5eTokenStatusMarkerCapableMonster | undefined,
): Dnd5eTokenStatusMarkerGrantDeclaration[] {
  if (!monster) return []
  const result: Dnd5eTokenStatusMarkerGrantDeclaration[] = []
  const seen = new Set<string>()
  const add = (
    statusId: Dnd5eTokenStatusMarkerId | undefined,
    target: Dnd5eTokenStatusMarkerGrantTarget,
    application: Dnd5eTokenStatusMarkerGrantApplication,
  ) => {
    if (!statusId || !TACTICAL_TOKEN_STATUS_MARKER_IDS.has(statusId)) return
    const key = `${statusId}:${target}:${application}`
    if (seen.has(key)) return
    result.push({ statusId: statusId as Dnd5eTacticalTokenStatusMarkerId, target, application })
    seen.add(key)
  }

  for (const declaration of monster.tokenStatusMarkerGrants ?? []) {
    add(declaration.statusId, declaration.target, declaration.application ?? 'marker')
  }
  for (const trait of monster.traits ?? []) {
    if (trait.rule?.kind === 'damage-aversion' && trait.rule.damageType === 'fire') {
      add('fire-averse', 'self', 'marker')
    }
    if (trait.rule?.kind === 'mucous-cloud' && trait.rule.condition === 'disease') {
      add('diseased', 'other', 'active-effect')
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
    add(
      dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(action.attack?.onHitRule?.condition),
      'other',
      'active-effect',
    )
    for (const effect of action.attack?.onHitEffects ?? []) {
      add(dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(effect.ailment), 'other', 'active-effect')
      add(dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(effect.label), 'other', 'active-effect')
      add(dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(effect.rootLegacyCondition), 'other', 'active-effect')
      for (const condition of effect.dependentLegacyConditions ?? []) {
        add(dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(condition), 'other', 'active-effect')
      }
      for (const condition of effect.dependentLegacyConditionsWhenAttackHasAdvantage ?? []) {
        add(dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(condition.condition), 'other', 'active-effect')
      }
    }
    add(
      dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(action.rule?.effect?.rootLegacyCondition),
      'other',
      'active-effect',
    )
    for (const condition of action.rule?.effect?.dependentLegacyConditions ?? []) {
      add(dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(condition), 'other', 'active-effect')
    }
    if (action.rule?.kind === 'invisibility') add('hidden', 'self', 'active-effect')
    const areaEffects = action.rule?.variants?.map((variant) => variant.activeEffectOnFailedSave) ??
      [action.rule?.activeEffectOnFailedSave]
    for (const effect of areaEffects) {
      add(tacticalMarkerIdFromAreaEffect(effect), 'other', 'active-effect')
    }
  }
  for (const mechanic of monster.headlessMechanics ?? []) {
    if (!isRecord(mechanic) || !Array.isArray(mechanic.effects)) continue
    for (const effect of mechanic.effects) {
      if (!isRecord(effect) || effect.kind !== 'tactical-status') continue
      add(
        effect.statusId as Dnd5eTokenStatusMarkerId,
        effect.target === 'self' ? 'self' : 'other',
        'active-effect',
      )
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
    (definition) => ({
      definition,
      kind: 'base',
      applications: ['marker', 'active-effect'],
      sourceTokenIds: [],
      sourceLabels: [],
    }),
  )
  const grants = new Map<Dnd5eTacticalTokenStatusMarkerId, {
    targets: Dnd5eTokenStatusMarkerGrantTarget[]
    applications: Dnd5eTokenStatusMarkerGrantApplication[]
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
        targets: [],
        applications: [],
        sourceTokenIds: [],
        sourceLabels: [],
      }
      if (!current.targets.includes(grant.target)) current.targets.push(grant.target)
      const application = grant.application ?? 'marker'
      if (!current.applications.includes(application)) current.applications.push(application)
      if (!current.sourceTokenIds.includes(participant.tokenId)) current.sourceTokenIds.push(participant.tokenId)
      if (!current.sourceLabels.includes(participant.label)) current.sourceLabels.push(participant.label)
      grants.set(grant.statusId, current)
    }
  }
  for (const definition of DND5E_TACTICAL_TOKEN_STATUS_MARKER_DEFINITIONS) {
    const grant = grants.get(definition.id as Dnd5eTacticalTokenStatusMarkerId)
    if (!grant) continue
    options.push({
      definition,
      kind: 'participant-grant',
      target: grant.targets.length === 1 ? grant.targets[0] : undefined,
      ...grant,
    })
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
  for (const effect of effects ?? []) {
    if ((effect.suspendedBy?.length ?? 0) > 0) continue
    const statusId = dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(effect.legacyCondition) ??
      dnd5eTacticalTokenStatusMarkerIdFromLegacyCondition(effect.label)
    if (!statusId) continue
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
      activeEffectId: effect.id,
      sourceActorId: effect.source?.actorId,
      sourceLabel: effect.source?.actorName ?? effect.source?.label ?? effect.source?.rulesId,
      mechanical: true,
    })
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

/**
 * A Token can keep authoritative effect instances and DM annotations separate,
 * while presenting only one HUD badge for the same semantic status. This
 * mirrors Foundry's Actor.statuses projection: instance data is not destroyed,
 * but duplicate status icons are collapsed for display.
 *
 * Derived/authoritative markers take precedence over presentation-only DM
 * markers, so an inherent monster trait cannot be visually replaced by an
 * annotation with the same status id.
 */
export function mergeDnd5eTokenStatusMarkersForDisplay(
  manualMarkers: readonly Dnd5eTokenStatusMarker[] | undefined,
  derivedMarkers: readonly Dnd5eTokenStatusMarker[] | undefined,
): Dnd5eTokenStatusMarker[] {
  const result: Dnd5eTokenStatusMarker[] = []
  const seenStatusIds = new Set<Dnd5eTokenStatusMarkerId>()
  const seenInstanceIds = new Set<string>()
  for (const marker of [...(derivedMarkers ?? []), ...(manualMarkers ?? [])]) {
    if (seenInstanceIds.has(marker.id) || seenStatusIds.has(marker.statusId)) continue
    seenInstanceIds.add(marker.id)
    seenStatusIds.add(marker.statusId)
    result.push(marker)
  }
  return result
}

/** Fail-closed normalization for per-Token hidden derived badge instances. */
export function normalizeDnd5eSuppressedTokenStatusMarkerIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const result: string[] = []
  const seen = new Set<string>()
  for (const raw of value.slice(0, 64)) {
    if (typeof raw !== 'string' || !/^[a-z0-9][a-z0-9:_-]{0,159}$/i.test(raw)) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    result.push(raw)
  }
  return result
}
