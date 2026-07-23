import { publishSharedEvent, sampleSharedServerClock } from './sharedApi'

export const COMBAT_PRESENTATION_CHANNEL = 'combat-presentation'
export const FIRE_BOLT_ANIMATION_DURATION_MS = 980
export const COMBAT_PRESENTATION_EVENT_TTL_MS = 1_600

let combatPresentationClockOffsetMs = 0
let combatPresentationClockSampledAt = 0
let combatPresentationClockPromise: Promise<number> | null = null

export function combatPresentationServerNow(localNow = Date.now()): number {
  return localNow + combatPresentationClockOffsetMs
}

export async function refreshCombatPresentationClock(force = false): Promise<number> {
  if (!force && Date.now() - combatPresentationClockSampledAt < 60_000) {
    return combatPresentationClockOffsetMs
  }
  if (combatPresentationClockPromise) return combatPresentationClockPromise
  combatPresentationClockPromise = sampleSharedServerClock(2)
    .then((sample) => {
      if (sample) {
        combatPresentationClockOffsetMs = sample.offsetMs
        combatPresentationClockSampledAt = sample.sampledAt
      }
      return combatPresentationClockOffsetMs
    })
    .finally(() => {
      combatPresentationClockPromise = null
    })
  return combatPresentationClockPromise
}

export interface CombatPresentationSpellProjectileEventV1 {
  schemaVersion: 1
  id: string
  type: 'spell-projectile'
  mapId: string
  transactionId: string
  spellId: 'fire-bolt'
  sourceTokenId: string
  targetTokenId: string
  outcome: 'hit' | 'miss'
  createdAt: number
  expiresAt: number
}

export interface CombatPresentationState {
  spellProjectiles: CombatPresentationSpellProjectileEventV1[]
}

export interface CombatPresentationMapProjectile {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind: 'fire-bolt'
  hit: boolean
  issuedAt: number
  durationMs: number
}

interface PresentationMap {
  id: string
  gridSize: number
  tokens: readonly {
    id: string
    x: number
    y: number
    size?: number
  }[]
}

export const EMPTY_COMBAT_PRESENTATION_STATE: CombatPresentationState = {
  spellProjectiles: [],
}

function boundedId(value: unknown, maximum = 200): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= maximum
}

export function parseCombatPresentationEvent(
  value: unknown,
): CombatPresentationSpellProjectileEventV1 | null {
  if (!value || typeof value !== 'object') return null
  const event = value as Partial<CombatPresentationSpellProjectileEventV1>
  if (
    event.schemaVersion !== 1 || event.type !== 'spell-projectile' ||
    !boundedId(event.id) || !boundedId(event.mapId, 160) ||
    !boundedId(event.transactionId) || event.spellId !== 'fire-bolt' ||
    !boundedId(event.sourceTokenId, 160) || !boundedId(event.targetTokenId, 160) ||
    (event.outcome !== 'hit' && event.outcome !== 'miss') ||
    !Number.isFinite(event.createdAt) || !Number.isFinite(event.expiresAt) ||
    Number(event.createdAt) < 0 || Number(event.expiresAt) <= Number(event.createdAt) ||
    Number(event.expiresAt) - Number(event.createdAt) > 5_000
  ) return null
  return event as CombatPresentationSpellProjectileEventV1
}

export function reduceCombatPresentationState(
  current: CombatPresentationState,
  value: unknown,
  now = Date.now(),
): CombatPresentationState {
  const retained = current.spellProjectiles.filter((event) => event.expiresAt > now)
  const event = parseCombatPresentationEvent(value)
  if (!event || event.expiresAt <= now || retained.some((candidate) => candidate.id === event.id)) {
    return retained.length === current.spellProjectiles.length
      ? current
      : { spellProjectiles: retained }
  }
  return { spellProjectiles: [...retained, event].slice(-32) }
}

function stableDirection(id: string): number {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = ((hash * 31) + id.charCodeAt(index)) | 0
  return (hash & 1) === 0 ? 1 : -1
}

export function combatPresentationProjectilesForMap(
  state: CombatPresentationState,
  map: PresentationMap,
  now = Date.now(),
): CombatPresentationMapProjectile[] {
  return state.spellProjectiles.flatMap((event) => {
    if (
      event.mapId !== map.id ||
      event.createdAt + FIRE_BOLT_ANIMATION_DURATION_MS <= now
    ) return []
    const source = map.tokens.find((token) => token.id === event.sourceTokenId)
    const target = map.tokens.find((token) => token.id === event.targetTokenId)
    // Missing tokens generally mean the server projection has hidden them from
    // this viewer. Never turn a presentation event into a position side channel.
    if (!source || !target) return []
    const dx = target.x - source.x
    const dy = target.y - source.y
    const distance = Math.max(1, Math.hypot(dx, dy))
    const ux = dx / distance
    const uy = dy / distance
    const gridSize = Math.max(1, map.gridSize)
    const sourceRadius = gridSize * Math.max(1, source.size ?? 1) * 0.34
    const from = {
      x: source.x + ux * sourceRadius,
      y: source.y + uy * sourceRadius,
    }
    const hit = event.outcome === 'hit'
    const missSide = stableDirection(event.id)
    const missOffset = Math.max(gridSize * 0.52, gridSize * Math.max(1, target.size ?? 1) * 0.42)
    const to = hit
      ? { x: target.x, y: target.y }
      : {
          x: target.x + (-uy * missOffset * missSide) + ux * gridSize * 0.18,
          y: target.y + (ux * missOffset * missSide) + uy * gridSize * 0.18,
        }
    return [{
      id: event.id,
      from,
      to,
      kind: 'fire-bolt' as const,
      hit,
      issuedAt: event.createdAt,
      durationMs: FIRE_BOLT_ANIMATION_DURATION_MS,
    }]
  })
}

export async function publishFireBoltPresentation(input: {
  id: string
  mapId: string
  transactionId: string
  sourceTokenId: string
  targetTokenId: string
  outcome: 'hit' | 'miss'
}): Promise<void> {
  await refreshCombatPresentationClock()
  const createdAt = combatPresentationServerNow()
  await publishSharedEvent(COMBAT_PRESENTATION_CHANNEL, {
    schemaVersion: 1,
    type: 'spell-projectile',
    spellId: 'fire-bolt',
    ...input,
    createdAt,
    expiresAt: createdAt + COMBAT_PRESENTATION_EVENT_TTL_MS,
  })
}
