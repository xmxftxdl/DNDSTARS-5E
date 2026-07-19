import type { BattleMap, Token } from '../store/maps'

export const MAP_GEOMETRY_RESOURCE = 'map-geometry'
export const MAP_GEOMETRY_SCHEMA_VERSION = 1
export const MAP_GEOMETRY_MAX_ENTITIES = 4_096

export interface MapGeometryPoint {
  x: number
  y: number
}

export interface MapGeometryHeight {
  baseHeightFeet: number
  heightFeet: number
}

export interface MapGeometryBlocking {
  blocksVision: boolean
  blocksMovement: boolean
  blocksLineOfEffect: boolean
}

export interface MapGeometryWall extends MapGeometryHeight, MapGeometryBlocking {
  id: string
  kind: 'wall'
  label: string
  points: MapGeometryPoint[]
  createdAt: number
}

export type MapGeometryDoorState = 'open' | 'closed' | 'locked'

export interface MapGeometryDoorInteraction {
  lockPickDc: number
  breakDc: number
  secretDc: number
  keyItemId?: string
  requiresThievesTools: boolean
}

export interface MapGeometryDoor extends MapGeometryHeight, MapGeometryBlocking {
  id: string
  kind: 'door'
  label: string
  points: [MapGeometryPoint, MapGeometryPoint]
  state: MapGeometryDoorState
  secret: boolean
  interaction?: MapGeometryDoorInteraction
  /** Room member ids that may receive this secret door in their geometry projection. */
  revealedToMemberIds?: string[]
  createdAt: number
}

export type MapGeometryCover = 'none' | 'half' | 'three-quarters' | 'total'

export interface MapGeometryObstacle extends MapGeometryHeight, MapGeometryBlocking {
  id: string
  kind: 'obstacle'
  label: string
  points: MapGeometryPoint[]
  cover: MapGeometryCover
  terrainCostMultiplier?: number
  traversal?: 'ground' | 'climb' | 'swim'
  createdAt: number
}

export type MapGeometryEntity = MapGeometryWall | MapGeometryDoor | MapGeometryObstacle
export type MapGeometryTool = 'select' | 'wall' | 'door' | 'obstacle'
export type MapGeometryEntityPatch = Partial<MapGeometryHeight & MapGeometryBlocking> & {
  label?: string
  points?: MapGeometryPoint[]
  state?: MapGeometryDoorState
  secret?: boolean
  interaction?: MapGeometryDoorInteraction
  revealedToMemberIds?: string[]
  cover?: MapGeometryCover
  terrainCostMultiplier?: number
  traversal?: 'ground' | 'climb' | 'swim'
}

export interface MapGeometryVisionSettings {
  enabled: boolean
  defaultRangeFeet: number
  sharePartyVision: boolean
  ambientLight: 'bright' | 'dim' | 'darkness'
}

export interface MapGeometryState {
  mapId: string
  walls: MapGeometryWall[]
  doors: MapGeometryDoor[]
  obstacles: MapGeometryObstacle[]
  vision: MapGeometryVisionSettings
  updatedAt: number
}

export interface SharedMapGeometryState {
  schemaVersion: typeof MAP_GEOMETRY_SCHEMA_VERSION
  maps: MapGeometryState[]
  updatedAt: number
}

export interface MapGeometrySegment extends MapGeometryHeight, MapGeometryBlocking {
  entityId: string
  entityKind: MapGeometryEntity['kind']
  a: MapGeometryPoint
  b: MapGeometryPoint
}

export interface MapGeometryCoverResult {
  cover: MapGeometryCover
  armorClassBonus: 0 | 2 | 5
  blocksLineOfEffect: boolean
  sourceEntityId?: string
}

const DEFAULT_VISION: MapGeometryVisionSettings = {
  enabled: false,
  defaultRangeFeet: 60,
  sharePartyVision: true,
  ambientLight: 'bright',
}

export function createEmptyMapGeometry(mapId: string, now = Date.now()): MapGeometryState {
  return { mapId, walls: [], doors: [], obstacles: [], vision: { ...DEFAULT_VISION }, updatedAt: now }
}

function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function normalizePoint(value: unknown): MapGeometryPoint | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  return finite(raw.x, -1_000_000, 1_000_000) && finite(raw.y, -1_000_000, 1_000_000)
    ? { x: raw.x, y: raw.y }
    : undefined
}

function normalizePoints(value: unknown, minimum: number, maximum = 2_048): MapGeometryPoint[] | undefined {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return undefined
  const points = value.map(normalizePoint)
  return points.some((point) => !point) ? undefined : points as MapGeometryPoint[]
}

function normalizeCommon(raw: Record<string, unknown>) {
  if (
    typeof raw.id !== 'string' || !raw.id || raw.id.length > 160 ||
    typeof raw.label !== 'string' || raw.label.length > 120 ||
    typeof raw.blocksVision !== 'boolean' || typeof raw.blocksMovement !== 'boolean' ||
    typeof raw.blocksLineOfEffect !== 'boolean' ||
    !finite(raw.baseHeightFeet, -1_000, 10_000) || !finite(raw.heightFeet, 0, 10_000) ||
    !finite(raw.createdAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  return {
    id: raw.id,
    label: raw.label,
    blocksVision: raw.blocksVision,
    blocksMovement: raw.blocksMovement,
    blocksLineOfEffect: raw.blocksLineOfEffect,
    baseHeightFeet: raw.baseHeightFeet,
    heightFeet: raw.heightFeet,
    createdAt: raw.createdAt,
  }
}

export function normalizeMapGeometryEntity(value: unknown): MapGeometryEntity | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  const common = normalizeCommon(raw)
  if (!common) return undefined
  if (raw.kind === 'wall') {
    const points = normalizePoints(raw.points, 2)
    return points ? { ...common, kind: 'wall', points } : undefined
  }
  if (raw.kind === 'door') {
    const points = normalizePoints(raw.points, 2, 2)
    if (!points || !['open', 'closed', 'locked'].includes(String(raw.state)) || typeof raw.secret !== 'boolean') return undefined
    const interactionRaw = raw.interaction
    let interaction: MapGeometryDoorInteraction | undefined
    if (interactionRaw != null) {
      if (!interactionRaw || typeof interactionRaw !== 'object' || Array.isArray(interactionRaw)) return undefined
      const config = interactionRaw as Record<string, unknown>
      if (
        !finite(config.lockPickDc, 0, 100) || !finite(config.breakDc, 0, 100) ||
        !finite(config.secretDc, 0, 100) || typeof config.requiresThievesTools !== 'boolean' ||
        (config.keyItemId != null && (typeof config.keyItemId !== 'string' || config.keyItemId.length > 160))
      ) return undefined
      interaction = {
        lockPickDc: config.lockPickDc,
        breakDc: config.breakDc,
        secretDc: config.secretDc,
        requiresThievesTools: config.requiresThievesTools,
        ...(config.keyItemId ? { keyItemId: config.keyItemId } : {}),
      }
    }
    if (
      raw.revealedToMemberIds != null &&
      (!Array.isArray(raw.revealedToMemberIds) || raw.revealedToMemberIds.length > 64 ||
        raw.revealedToMemberIds.some((id) => typeof id !== 'string' || !id || id.length > 160))
    ) return undefined
    return {
      ...common,
      kind: 'door',
      points: [points[0], points[1]],
      state: raw.state as MapGeometryDoorState,
      secret: raw.secret,
      ...(interaction ? { interaction } : {}),
      ...(Array.isArray(raw.revealedToMemberIds)
        ? { revealedToMemberIds: [...new Set(raw.revealedToMemberIds as string[])] }
        : {}),
    }
  }
  if (raw.kind === 'obstacle') {
    const points = normalizePoints(raw.points, 3)
    if (!points || !['none', 'half', 'three-quarters', 'total'].includes(String(raw.cover)) ||
      (raw.terrainCostMultiplier != null && !finite(raw.terrainCostMultiplier, 1, 10)) ||
      (raw.traversal != null && !['ground', 'climb', 'swim'].includes(String(raw.traversal)))) return undefined
    return {
      ...common, kind: 'obstacle', points, cover: raw.cover as MapGeometryCover,
      ...(raw.terrainCostMultiplier != null ? { terrainCostMultiplier: raw.terrainCostMultiplier as number } : {}),
      ...(raw.traversal != null ? { traversal: raw.traversal as MapGeometryObstacle['traversal'] } : {}),
    }
  }
  return undefined
}

export function normalizeMapGeometry(value: unknown): MapGeometryState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    typeof raw.mapId !== 'string' || !raw.mapId || raw.mapId.length > 160 ||
    !Array.isArray(raw.walls) || !Array.isArray(raw.doors) || !Array.isArray(raw.obstacles) ||
    raw.walls.length + raw.doors.length + raw.obstacles.length > MAP_GEOMETRY_MAX_ENTITIES ||
    !raw.vision || typeof raw.vision !== 'object' || Array.isArray(raw.vision) ||
    !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const vision = raw.vision as Record<string, unknown>
  if (
    typeof vision.enabled !== 'boolean' || typeof vision.sharePartyVision !== 'boolean' ||
    (vision.ambientLight != null && !['bright', 'dim', 'darkness'].includes(String(vision.ambientLight))) ||
    !finite(vision.defaultRangeFeet, 0, 10_000)
  ) return undefined
  const walls = raw.walls.map(normalizeMapGeometryEntity)
  const doors = raw.doors.map(normalizeMapGeometryEntity)
  const obstacles = raw.obstacles.map(normalizeMapGeometryEntity)
  if (
    walls.some((entity) => entity?.kind !== 'wall') || doors.some((entity) => entity?.kind !== 'door') ||
    obstacles.some((entity) => entity?.kind !== 'obstacle')
  ) return undefined
  const entities = [...walls, ...doors, ...obstacles] as MapGeometryEntity[]
  if (new Set(entities.map((entity) => entity.id)).size !== entities.length) return undefined
  return {
    mapId: raw.mapId,
    walls: walls as MapGeometryWall[],
    doors: doors as MapGeometryDoor[],
    obstacles: obstacles as MapGeometryObstacle[],
    vision: {
      enabled: vision.enabled,
      defaultRangeFeet: vision.defaultRangeFeet,
      sharePartyVision: vision.sharePartyVision,
      ambientLight: (vision.ambientLight as MapGeometryVisionSettings['ambientLight'] | undefined) ?? 'bright',
    },
    updatedAt: raw.updatedAt,
  }
}

export function normalizeSharedMapGeometry(value: unknown): SharedMapGeometryState | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as Record<string, unknown>
  if (
    raw.schemaVersion !== MAP_GEOMETRY_SCHEMA_VERSION || !Array.isArray(raw.maps) ||
    !finite(raw.updatedAt, 0, Number.MAX_SAFE_INTEGER)
  ) return undefined
  const maps = raw.maps.map(normalizeMapGeometry)
  if (maps.some((map) => !map)) return undefined
  const normalized = maps as MapGeometryState[]
  if (new Set(normalized.map((map) => map.mapId)).size !== normalized.length) return undefined
  return { schemaVersion: MAP_GEOMETRY_SCHEMA_VERSION, maps: normalized, updatedAt: raw.updatedAt }
}

function entitySegments(entity: MapGeometryWall | MapGeometryObstacle): MapGeometrySegment[] {
  const pairs = entity.kind === 'obstacle'
    ? entity.points.map((point, index) => [point, entity.points[(index + 1) % entity.points.length]] as const)
    : entity.points.slice(0, -1).map((point, index) => [point, entity.points[index + 1]] as const)
  return pairs.map(([a, b]) => ({
    entityId: entity.id,
    entityKind: entity.kind,
    a,
    b,
    blocksVision: entity.blocksVision,
    blocksMovement: entity.blocksMovement,
    blocksLineOfEffect: entity.blocksLineOfEffect,
    baseHeightFeet: entity.baseHeightFeet,
    heightFeet: entity.heightFeet,
  }))
}

export function mapGeometrySegments(geometry: MapGeometryState | undefined): MapGeometrySegment[] {
  if (!geometry) return []
  return [
    ...geometry.walls.flatMap(entitySegments),
    ...geometry.doors.flatMap((door) => door.state === 'open' ? [] : [{
      entityId: door.id,
      entityKind: door.kind,
      a: door.points[0],
      b: door.points[1],
      blocksVision: door.blocksVision,
      blocksMovement: door.blocksMovement,
      blocksLineOfEffect: door.blocksLineOfEffect,
      baseHeightFeet: door.baseHeightFeet,
      heightFeet: door.heightFeet,
    }]),
    ...geometry.obstacles.flatMap(entitySegments),
  ]
}

function cross(a: MapGeometryPoint, b: MapGeometryPoint): number {
  return a.x * b.y - a.y * b.x
}

function subtract(a: MapGeometryPoint, b: MapGeometryPoint): MapGeometryPoint {
  return { x: a.x - b.x, y: a.y - b.y }
}

function intersectionParameter(
  from: MapGeometryPoint,
  to: MapGeometryPoint,
  a: MapGeometryPoint,
  b: MapGeometryPoint,
): number | undefined {
  const r = subtract(to, from)
  const s = subtract(b, a)
  const denominator = cross(r, s)
  if (Math.abs(denominator) < 1e-8) return undefined
  const delta = subtract(a, from)
  const t = cross(delta, s) / denominator
  const u = cross(delta, r) / denominator
  return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7 ? t : undefined
}

export function mapGeometrySegmentsIntersect(
  from: MapGeometryPoint,
  to: MapGeometryPoint,
  a: MapGeometryPoint,
  b: MapGeometryPoint,
  ignoreStart = false,
): boolean {
  const t = intersectionParameter(from, to, a, b)
  return t != null && (!ignoreStart || t > 1e-5)
}

export function mapGeometryPointInPolygon(point: MapGeometryPoint, polygon: readonly MapGeometryPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < (pj.x - pi.x) * (point.y - pi.y) / ((pj.y - pi.y) || 1e-9) + pi.x
    ) inside = !inside
  }
  return inside
}

function overlapsHeight(baseHeightFeet: number, heightFeet: number, elevationFeet: number, creatureHeightFeet = 5): boolean {
  const top = baseHeightFeet + heightFeet
  return elevationFeet < top && elevationFeet + creatureHeightFeet > baseHeightFeet
}

function tokenElevation(token: Token): number {
  return Number.isFinite(token.elevationFeet) ? Math.max(-1_000, token.elevationFeet!) : 0
}

export function mapGeometryMovementBlocked(input: {
  geometry?: MapGeometryState
  map: BattleMap
  token: Token
  to: MapGeometryPoint
}): { blocked: boolean; entityId?: string } {
  const { geometry, token, to } = input
  if (!geometry) return { blocked: false }
  const from = { x: token.x, y: token.y }
  const radius = Math.max(0, input.map.gridSize * Math.max(1, token.size) * 0.42)
  const offsets = radius > 0
    ? [{ x: 0, y: 0 }, { x: radius, y: 0 }, { x: -radius, y: 0 }, { x: 0, y: radius }, { x: 0, y: -radius }]
    : [{ x: 0, y: 0 }]
  const elevation = tokenElevation(token)
  for (const obstacle of geometry.obstacles) {
    if (
      obstacle.blocksMovement && overlapsHeight(obstacle.baseHeightFeet, obstacle.heightFeet, elevation) &&
      mapGeometryPointInPolygon(to, obstacle.points)
    ) return { blocked: true, entityId: obstacle.id }
  }
  for (const segment of mapGeometrySegments(geometry)) {
    if (!segment.blocksMovement || !overlapsHeight(segment.baseHeightFeet, segment.heightFeet, elevation)) continue
    if (offsets.some((offset) => mapGeometrySegmentsIntersect(
      { x: from.x + offset.x, y: from.y + offset.y },
      { x: to.x + offset.x, y: to.y + offset.y },
      segment.a,
      segment.b,
      true,
    ))) return { blocked: true, entityId: segment.entityId }
  }
  return { blocked: false }
}

function rayBlocked(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
  purpose: 'vision' | 'line-of-effect'
}): string | undefined {
  for (const segment of mapGeometrySegments(input.geometry)) {
    const blocks = input.purpose === 'vision' ? segment.blocksVision : segment.blocksLineOfEffect
    if (!blocks) continue
    const t = intersectionParameter(input.from, input.to, segment.a, segment.b)
    if (t == null || t <= 1e-5) continue
    const fromElevation = input.fromElevationFeet ?? input.elevationFeet ?? 0
    const toElevation = input.toElevationFeet ?? input.elevationFeet ?? fromElevation
    const rayHeight = fromElevation + 2.5 + (toElevation - fromElevation) * t
    if (rayHeight >= segment.baseHeightFeet && rayHeight < segment.baseHeightFeet + segment.heightFeet) {
      return segment.entityId
    }
  }
  return undefined
}

export function mapGeometryCoverFromPoint(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
}): MapGeometryCoverResult {
  const geometry = input.geometry
  if (!geometry) return { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
  const { from, to } = input
  const fromElevation = input.fromElevationFeet ?? input.elevationFeet ?? 0
  const toElevation = input.toElevationFeet ?? input.elevationFeet ?? fromElevation
  const lineBlocker = rayBlocked({
    geometry, from, to, fromElevationFeet: fromElevation, toElevationFeet: toElevation,
    purpose: 'line-of-effect',
  })
  if (lineBlocker) return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true, sourceEntityId: lineBlocker }
  const rank: Record<MapGeometryCover, number> = { none: 0, half: 1, 'three-quarters': 2, total: 3 }
  let cover: MapGeometryCover = 'none'
  let sourceEntityId: string | undefined
  for (const obstacle of geometry.obstacles) {
    if (obstacle.cover === 'none') continue
    const intersects = entitySegments(obstacle).some((segment) => {
      const t = intersectionParameter(from, to, segment.a, segment.b)
      if (t == null || t <= 1e-5) return false
      const rayHeight = fromElevation + 2.5 + (toElevation - fromElevation) * t
      return rayHeight >= obstacle.baseHeightFeet && rayHeight < obstacle.baseHeightFeet + obstacle.heightFeet
    })
    if (intersects && rank[obstacle.cover] > rank[cover]) {
      cover = obstacle.cover
      sourceEntityId = obstacle.id
    }
  }
  return {
    cover,
    armorClassBonus: cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0,
    blocksLineOfEffect: cover === 'total',
    sourceEntityId,
  }
}

export function mapGeometryCoverBetween(
  geometry: MapGeometryState | undefined,
  attacker: Token,
  target: Token,
  map?: Pick<BattleMap, 'gridSize'>,
): MapGeometryCoverResult {
  const radius = Math.max(1, (map?.gridSize ?? 50) * Math.max(1, target.size) * 0.4)
  const samples = [
    { x: target.x - radius, y: target.y - radius },
    { x: target.x + radius, y: target.y - radius },
    { x: target.x + radius, y: target.y + radius },
    { x: target.x - radius, y: target.y + radius },
  ].map((to) => mapGeometryCoverFromPoint({
    geometry,
    from: attacker,
    to,
    fromElevationFeet: tokenElevation(attacker),
    toElevationFeet: tokenElevation(target),
  }))
  const totalCount = samples.filter((sample) => sample.blocksLineOfEffect || sample.cover === 'total').length
  const threeQuarterCount = samples.filter((sample) => sample.cover === 'three-quarters').length
  const affectedCount = samples.filter((sample) => sample.cover !== 'none').length
  const sourceEntityId = samples.find((sample) => sample.sourceEntityId)?.sourceEntityId
  if (totalCount === samples.length) return { cover: 'total', armorClassBonus: 0, blocksLineOfEffect: true, sourceEntityId }
  if (totalCount + threeQuarterCount >= 3) {
    return { cover: 'three-quarters', armorClassBonus: 5, blocksLineOfEffect: false, sourceEntityId }
  }
  if (affectedCount > 0) return { cover: 'half', armorClassBonus: 2, blocksLineOfEffect: false, sourceEntityId }
  return { cover: 'none', armorClassBonus: 0, blocksLineOfEffect: false }
}

export function mapGeometryLineOfEffectBlocked(input: {
  geometry?: MapGeometryState
  from: MapGeometryPoint
  to: MapGeometryPoint
  elevationFeet?: number
  fromElevationFeet?: number
  toElevationFeet?: number
}): boolean {
  return mapGeometryCoverFromPoint(input).blocksLineOfEffect
}

export function mapGeometryCanSeeToken(input: {
  geometry?: MapGeometryState
  map: BattleMap
  viewer: Token
  target: Token
}): boolean {
  const geometry = input.geometry
  if (!geometry?.vision.enabled) return true
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const normalRangeFeet = Number.isFinite(input.viewer.visionRangeFeet)
    ? Math.max(0, input.viewer.visionRangeFeet!)
    : geometry.vision.defaultRangeFeet
  const darkvisionRangeFeet = Number.isFinite(input.viewer.darkvisionRangeFeet)
    ? Math.max(0, input.viewer.darkvisionRangeFeet!)
    : 0
  const carriedLightRangeFeet = input.viewer.lightSource?.enabled
    ? input.viewer.lightSource.brightRadiusFeet + input.viewer.lightSource.dimRadiusFeet
    : 0
  const rangeFeet = Math.max(normalRangeFeet, darkvisionRangeFeet, carriedLightRangeFeet)
  const rangePx = rangeFeet / feetPerCell * Math.max(1, input.map.gridSize)
  const distancePx = Math.hypot(input.target.x - input.viewer.x, input.target.y - input.viewer.y)
  if (distancePx > rangePx) return false
  const illumination = mapGeometryIlluminationAtPoint({
    geometry,
    map: input.map,
    tokens: input.map.tokens,
    point: input.target,
  })
  const distanceFeet = distancePx / Math.max(1, input.map.gridSize) * feetPerCell
  if (illumination === 'darkness' && distanceFeet > darkvisionRangeFeet) return false
  return !rayBlocked({
    geometry,
    from: input.viewer,
    to: input.target,
    fromElevationFeet: tokenElevation(input.viewer),
    toElevationFeet: tokenElevation(input.target),
    purpose: 'vision',
  })
}

export type MapGeometryIllumination = 'bright' | 'dim' | 'darkness'

export function mapGeometryIlluminationAtPoint(input: {
  geometry?: MapGeometryState
  map: BattleMap
  tokens?: readonly Token[]
  point: MapGeometryPoint
}): MapGeometryIllumination {
  const ambient = input.geometry?.vision.ambientLight ?? 'bright'
  if (ambient === 'bright') return 'bright'
  let result: MapGeometryIllumination = ambient
  const gridSize = Math.max(1, input.map.gridSize)
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  for (const source of input.tokens ?? input.map.tokens) {
    const light = source.lightSource
    if (!light?.enabled) continue
    const distanceFeet = Math.hypot(input.point.x - source.x, input.point.y - source.y) / gridSize * feetPerCell
    const brightRadius = Math.max(0, light.brightRadiusFeet)
    const dimRadius = brightRadius + Math.max(0, light.dimRadiusFeet)
    if (distanceFeet > dimRadius) continue
    if (rayBlocked({ geometry: input.geometry, from: source, to: input.point, purpose: 'vision' })) continue
    if (distanceFeet <= brightRadius) return 'bright'
    result = 'dim'
  }
  return result
}

function nearestRayPoint(
  origin: MapGeometryPoint,
  angle: number,
  radius: number,
  segments: readonly MapGeometrySegment[],
): MapGeometryPoint {
  const far = { x: origin.x + Math.cos(angle) * radius, y: origin.y + Math.sin(angle) * radius }
  let nearestT = 1
  for (const segment of segments) {
    if (!segment.blocksVision) continue
    const t = intersectionParameter(origin, far, segment.a, segment.b)
    if (t != null && t > 1e-5 && t < nearestT) nearestT = t
  }
  return { x: origin.x + (far.x - origin.x) * nearestT, y: origin.y + (far.y - origin.y) * nearestT }
}

export function mapGeometryVisibilityPolygon(input: {
  geometry?: MapGeometryState
  map: BattleMap
  viewer: Token
}): MapGeometryPoint[] {
  const geometry = input.geometry
  if (!geometry?.vision.enabled) return []
  const origin = { x: input.viewer.x, y: input.viewer.y }
  const feetPerCell = Math.max(1, input.map.feetPerCell ?? 5)
  const normalRangeFeet = Number.isFinite(input.viewer.visionRangeFeet)
    ? Math.max(0, input.viewer.visionRangeFeet!)
    : geometry.vision.defaultRangeFeet
  const darkvisionRangeFeet = Number.isFinite(input.viewer.darkvisionRangeFeet)
    ? Math.max(0, input.viewer.darkvisionRangeFeet!)
    : 0
  const lightRangeFeet = input.viewer.lightSource?.enabled
    ? input.viewer.lightSource.brightRadiusFeet + input.viewer.lightSource.dimRadiusFeet
    : 0
  const ambientVisionRangeFeet = geometry.vision.ambientLight === 'darkness' ? 0 : normalRangeFeet
  const rangeFeet = Math.max(ambientVisionRangeFeet, darkvisionRangeFeet, lightRangeFeet)
  const radius = Math.max(1, rangeFeet / feetPerCell * Math.max(1, input.map.gridSize))
  const elevation = tokenElevation(input.viewer)
  const blockers = mapGeometrySegments(geometry).filter((segment) =>
    segment.blocksVision && elevation + 2.5 >= segment.baseHeightFeet &&
      elevation + 2.5 < segment.baseHeightFeet + segment.heightFeet,
  )
  const bounds: MapGeometrySegment[] = [
    [{ x: 0, y: 0 }, { x: input.map.width, y: 0 }],
    [{ x: input.map.width, y: 0 }, { x: input.map.width, y: input.map.height }],
    [{ x: input.map.width, y: input.map.height }, { x: 0, y: input.map.height }],
    [{ x: 0, y: input.map.height }, { x: 0, y: 0 }],
  ].map(([a, b], index) => ({
    entityId: `map-boundary-${index}`, entityKind: 'wall', a, b,
    blocksVision: true, blocksMovement: false, blocksLineOfEffect: false,
    baseHeightFeet: -1_000, heightFeet: 11_000,
  }))
  const angles = new Set<number>()
  for (let index = 0; index < 96; index += 1) angles.add(index / 96 * Math.PI * 2)
  for (const segment of blockers) {
    for (const point of [segment.a, segment.b]) {
      const angle = Math.atan2(point.y - origin.y, point.x - origin.x)
      angles.add(angle - 1e-5)
      angles.add(angle)
      angles.add(angle + 1e-5)
    }
  }
  return [...angles]
    .sort((left, right) => left - right)
    .map((angle) => nearestRayPoint(origin, angle, radius, [...blockers, ...bounds]))
}

let runtimeGeometryByMapId = new Map<string, MapGeometryState>()

export function setMapGeometryRuntime(maps: readonly MapGeometryState[]): void {
  runtimeGeometryByMapId = new Map(maps.map((map) => [map.mapId, map]))
}

export function mapGeometryRuntimeForMap(mapId: string): MapGeometryState | undefined {
  return runtimeGeometryByMapId.get(mapId)
}
