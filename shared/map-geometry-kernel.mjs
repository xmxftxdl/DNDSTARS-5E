const EPSILON = 1e-7

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y)
}

export function projectPointToSegment(point, a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared > 1e-9
    ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
    : 0
  const projected = { x: a.x + dx * t, y: a.y + dy * t }
  return { point: projected, t, distance: Math.hypot(point.x - projected.x, point.y - projected.y) }
}

export function interpolatePoint(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function wallEdgeId(wall, segmentIndex) {
  const explicit = Array.isArray(wall?.edgeIds) ? wall.edgeIds[segmentIndex] : null
  return typeof explicit === 'string' && explicit ? explicit : `edge:${wall?.id ?? 'wall'}:${segmentIndex}`
}

export function doorOpenState(door) {
  if (door?.physicalState === 'destroyed') return 'open'
  if (door?.openState === 'open' || door?.openState === 'closed') return door.openState
  return door?.state === 'open' ? 'open' : 'closed'
}

export function doorLockState(door) {
  if (door?.physicalState === 'destroyed' || door?.physicalState === 'broken') return 'unlocked'
  if (['unlocked', 'locked', 'jammed'].includes(door?.lockState)) return door.lockState
  return door?.state === 'locked' ? 'locked' : 'unlocked'
}

export function doorPhysicalState(door) {
  return ['intact', 'broken', 'destroyed'].includes(door?.physicalState)
    ? door.physicalState
    : 'intact'
}

export function legacyDoorState(door) {
  if (doorOpenState(door) === 'open') return 'open'
  return doorLockState(door) === 'locked' ? 'locked' : 'closed'
}

export function openingIntervalOnWallSegment(opening, wall, segmentIndex) {
  const a = wall?.points?.[segmentIndex]
  const b = wall?.points?.[segmentIndex + 1]
  if (!finitePoint(a) || !finitePoint(b)) return null
  const edgeId = wallEdgeId(wall, segmentIndex)
  const stableAttachment = opening?.wallEdgeId === edgeId
  if (
    stableAttachment &&
    Number.isFinite(opening.startT) &&
    Number.isFinite(opening.endT)
  ) {
    const start = Math.max(0, Math.min(1, Math.min(opening.startT, opening.endT)))
    const end = Math.max(0, Math.min(1, Math.max(opening.startT, opening.endT)))
    return end - start > 0.0001 ? [start, end] : null
  }
  const legacyAttachment =
    opening?.parentWallId === wall?.id &&
    opening?.parentWallSegmentIndex === segmentIndex
  if (!legacyAttachment && opening?.wallEdgeId != null) return null
  const p0 = opening?.points?.[0]
  const p1 = opening?.points?.[1]
  if (!finitePoint(p0) || !finitePoint(p1)) return null
  const projectedA = projectPointToSegment(p0, a, b)
  const projectedB = projectPointToSegment(p1, a, b)
  if (!legacyAttachment && (opening?.parentWallId != null || projectedA.distance > 2 || projectedB.distance > 2)) {
    return null
  }
  const start = Math.min(projectedA.t, projectedB.t)
  const end = Math.max(projectedA.t, projectedB.t)
  return end - start > 0.0001 ? [start, end] : null
}

export function openingPoints(geometry, opening) {
  if (typeof opening?.wallEdgeId === 'string') {
    for (const wall of geometry?.walls ?? []) {
      for (let index = 0; index < (wall.points?.length ?? 0) - 1; index += 1) {
        if (wallEdgeId(wall, index) !== opening.wallEdgeId) continue
        const interval = openingIntervalOnWallSegment(opening, wall, index)
        if (!interval) break
        return [
          interpolatePoint(wall.points[index], wall.points[index + 1], interval[0]),
          interpolatePoint(wall.points[index], wall.points[index + 1], interval[1]),
        ]
      }
    }
  }
  return Array.isArray(opening?.points) ? opening.points : []
}

export function wallRenderSegments(geometry, wall) {
  const openings = [...(geometry?.doors ?? []), ...(geometry?.windows ?? [])]
  return (wall?.points ?? []).slice(0, -1).flatMap((a, segmentIndex) => {
    const b = wall.points[segmentIndex + 1]
    const intervals = openings
      .map((opening) => openingIntervalOnWallSegment(opening, wall, segmentIndex))
      .filter(Boolean)
      .sort((left, right) => left[0] - right[0])
    const merged = []
    for (const interval of intervals) {
      const previous = merged.at(-1)
      if (previous && interval[0] <= previous[1] + 0.0001) previous[1] = Math.max(previous[1], interval[1])
      else merged.push([...interval])
    }
    const result = []
    let cursor = 0
    for (const [start, end] of merged) {
      if (start > cursor + 0.0001) {
        result.push({
          wallId: wall.id,
          wallEdgeId: wallEdgeId(wall, segmentIndex),
          wallSegmentIndex: segmentIndex,
          a: interpolatePoint(a, b, cursor),
          b: interpolatePoint(a, b, start),
        })
      }
      cursor = Math.max(cursor, end)
    }
    if (cursor < 1 - 0.0001) {
      result.push({
        wallId: wall.id,
        wallEdgeId: wallEdgeId(wall, segmentIndex),
        wallSegmentIndex: segmentIndex,
        a: interpolatePoint(a, b, cursor),
        b,
      })
    }
    return result
  })
}

function obstacleSegments(obstacle) {
  return (obstacle?.points ?? []).map((a, index) => ({
    entityId: obstacle.id,
    entityKind: 'obstacle',
    a,
    b: obstacle.points[(index + 1) % obstacle.points.length],
    blocksVision: obstacle.blocksVision,
    blocksMovement: obstacle.blocksMovement,
    blocksLineOfEffect: obstacle.blocksLineOfEffect,
    baseHeightFeet: obstacle.baseHeightFeet,
    heightFeet: obstacle.heightFeet,
    cover: obstacle.cover,
  }))
}

export function effectiveGeometrySegments(geometry) {
  if (!geometry) return []
  const walls = (geometry.walls ?? []).flatMap((wall) =>
    wallRenderSegments(geometry, wall).map((segment) => ({
      entityId: wall.id,
      entityKind: 'wall',
      wallEdgeId: segment.wallEdgeId,
      a: segment.a,
      b: segment.b,
      blocksVision: wall.blocksVision,
      blocksMovement: wall.blocksMovement,
      blocksLineOfEffect: wall.blocksLineOfEffect,
      baseHeightFeet: wall.baseHeightFeet,
      heightFeet: wall.heightFeet,
    })),
  )
  const doors = (geometry.doors ?? []).flatMap((door) => {
    if (doorOpenState(door) === 'open') return []
    const points = openingPoints(geometry, door)
    if (points.length !== 2) return []
    return [{
      entityId: door.id,
      entityKind: 'door',
      a: points[0],
      b: points[1],
      blocksVision: door.blocksVision,
      blocksMovement: door.blocksMovement,
      blocksLineOfEffect: door.blocksLineOfEffect,
      baseHeightFeet: door.baseHeightFeet,
      heightFeet: door.heightFeet,
    }]
  })
  const windows = (geometry.windows ?? []).flatMap((window) => {
    const points = openingPoints(geometry, window)
    if (points.length !== 2) return []
    const open = window.windowState === 'open' || window.windowState === 'broken'
    return [{
      entityId: window.id,
      entityKind: 'window',
      a: points[0],
      b: points[1],
      blocksVision: open ? false : window.blocksVision,
      blocksMovement: window.blocksMovement,
      blocksLineOfEffect: open ? false : window.blocksLineOfEffect,
      baseHeightFeet: window.baseHeightFeet,
      heightFeet: window.heightFeet,
      cover: window.cover,
    }]
  })
  return [...walls, ...doors, ...windows, ...(geometry.obstacles ?? []).flatMap(obstacleSegments)]
}

function segmentBounds(segment) {
  return {
    minX: Math.min(segment.a.x, segment.b.x),
    minY: Math.min(segment.a.y, segment.b.y),
    maxX: Math.max(segment.a.x, segment.b.x),
    maxY: Math.max(segment.a.y, segment.b.y),
  }
}

export function createSegmentSpatialIndex(segments, bucketSize = 256) {
  const size = Math.max(16, Number(bucketSize) || 256)
  const buckets = new Map()
  for (const segment of segments) {
    const bounds = segmentBounds(segment)
    const minCol = Math.floor(bounds.minX / size)
    const maxCol = Math.floor(bounds.maxX / size)
    const minRow = Math.floor(bounds.minY / size)
    const maxRow = Math.floor(bounds.maxY / size)
    for (let col = minCol; col <= maxCol; col += 1) {
      for (let row = minRow; row <= maxRow; row += 1) {
        const key = `${col},${row}`
        const bucket = buckets.get(key)
        if (bucket) bucket.push(segment)
        else buckets.set(key, [segment])
      }
    }
  }
  return { bucketSize: size, buckets, segments }
}

export function querySegmentSpatialIndex(index, from, to) {
  return querySegmentSpatialIndexBounds(index, {
    minX: Math.min(from.x, to.x),
    minY: Math.min(from.y, to.y),
    maxX: Math.max(from.x, to.x),
    maxY: Math.max(from.y, to.y),
  })
}

export function querySegmentSpatialIndexBounds(index, bounds) {
  if (!index) return []
  const size = index.bucketSize
  const minCol = Math.floor(bounds.minX / size)
  const maxCol = Math.floor(bounds.maxX / size)
  const minRow = Math.floor(bounds.minY / size)
  const maxRow = Math.floor(bounds.maxY / size)
  const result = new Set()
  for (let col = minCol; col <= maxCol; col += 1) {
    for (let row = minRow; row <= maxRow; row += 1) {
      for (const segment of index.buckets.get(`${col},${row}`) ?? []) result.add(segment)
    }
  }
  return [...result]
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x
}

function subtract(a, b) {
  return { x: a.x - b.x, y: a.y - b.y }
}

export function segmentIntersectionParameter(from, to, a, b) {
  const r = subtract(to, from)
  const s = subtract(b, a)
  const denominator = cross(r, s)
  if (Math.abs(denominator) < 1e-8) return null
  const delta = subtract(a, from)
  const t = cross(delta, s) / denominator
  const u = cross(delta, r) / denominator
  return t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON ? t : null
}

export function raycastGeometry(input) {
  const candidates = input.compiled?.index
    ? querySegmentSpatialIndex(input.compiled.index, input.from, input.to)
    : input.compiled?.segments ?? effectiveGeometrySegments(input.geometry)
  let nearest = null
  for (const segment of candidates) {
    const blocks = input.purpose === 'movement'
      ? segment.blocksMovement
      : input.purpose === 'line-of-effect'
        ? segment.blocksLineOfEffect
        : segment.blocksVision
    if (!blocks) continue
    const t = segmentIntersectionParameter(input.from, input.to, segment.a, segment.b)
    if (t == null || t <= (input.ignoreStart ? 1e-5 : -EPSILON)) continue
    const fromElevation = input.fromElevationFeet ?? 0
    const toElevation = input.toElevationFeet ?? fromElevation
    const fromEye = fromElevation + (input.fromEyeHeightFeet ?? 0)
    const toEye = toElevation + (input.toEyeHeightFeet ?? 0)
    const height = fromEye + (toEye - fromEye) * t
    if (height < segment.baseHeightFeet || height >= segment.baseHeightFeet + segment.heightFeet) continue
    if (!nearest || t < nearest.t) nearest = { segment, t }
  }
  return nearest
}

export function compileGeometry(geometry, options = {}) {
  const segments = effectiveGeometrySegments(geometry)
  return {
    geometry,
    segments,
    index: createSegmentSpatialIndex(segments, options.bucketSize),
  }
}

const compiledGeometryCache = new WeakMap()

function geometryCacheSignature(geometry) {
  const walls = (geometry.walls ?? []).map((wall) =>
    `${wall.id}:${wall.blocksVision}:${wall.blocksMovement}:${wall.blocksLineOfEffect}:${wall.baseHeightFeet}:${wall.heightFeet}:` +
      `${wall.points?.length ?? 0}:${wall.points?.map((point) => `${point.x},${point.y}`).join(';') ?? ''}:` +
      `${wall.edgeIds?.join(';') ?? ''}`,
  ).join('|')
  const openings = [...(geometry.doors ?? []), ...(geometry.windows ?? [])].map((opening) =>
    `${opening.id}:${doorOpenState(opening)}:${opening.windowState ?? ''}:${opening.blocksVision}:${opening.blocksMovement}:` +
      `${opening.blocksLineOfEffect}:${opening.baseHeightFeet}:${opening.heightFeet}:${opening.wallEdgeId ?? ''}:${opening.startT ?? ''}:${opening.endT ?? ''}:` +
      `${opening.parentWallId ?? ''}:${opening.parentWallSegmentIndex ?? ''}:${opening.points?.map((point) => `${point.x},${point.y}`).join(';') ?? ''}`,
  ).join('|')
  const obstacles = (geometry.obstacles ?? []).map((obstacle) =>
    `${obstacle.id}:${obstacle.points?.map((point) => `${point.x},${point.y}`).join(';') ?? ''}:` +
      `${obstacle.blocksVision}:${obstacle.blocksMovement}:${obstacle.blocksLineOfEffect}:${obstacle.baseHeightFeet}:${obstacle.heightFeet}`,
  ).join('|')
  return `${geometry.updatedAt ?? ''}#${walls}#${openings}#${obstacles}`
}

export function compileGeometryCached(geometry, options = {}) {
  if (!geometry || typeof geometry !== 'object') return compileGeometry(geometry, options)
  const bucketSize = Math.max(16, Number(options.bucketSize) || 256)
  const revision = geometryCacheSignature(geometry)
  const cached = compiledGeometryCache.get(geometry)
  if (cached && cached.bucketSize === bucketSize && cached.revision === revision) return cached.compiled
  const compiled = compileGeometry(geometry, { bucketSize })
  compiledGeometryCache.set(geometry, { bucketSize, revision, compiled })
  return compiled
}

export function validateGeometryRelationships(geometry) {
  const issues = []
  const ids = new Set()
  for (const entity of [
    ...(geometry?.walls ?? []),
    ...(geometry?.doors ?? []),
    ...(geometry?.windows ?? []),
    ...(geometry?.obstacles ?? []),
    ...(geometry?.lights ?? []),
  ]) {
    if (ids.has(entity.id)) issues.push({ code: 'duplicate-entity-id', entityId: entity.id })
    ids.add(entity.id)
  }
  const edgeById = new Map()
  for (const wall of geometry?.walls ?? []) {
    const expected = Math.max(0, (wall.points?.length ?? 0) - 1)
    if (Array.isArray(wall.edgeIds) && wall.edgeIds.length !== expected) {
      issues.push({ code: 'wall-edge-count-mismatch', entityId: wall.id })
    }
    for (let index = 0; index < expected; index += 1) {
      const id = wallEdgeId(wall, index)
      if (edgeById.has(id)) issues.push({ code: 'duplicate-wall-edge-id', entityId: wall.id, wallEdgeId: id })
      edgeById.set(id, { wall, index })
    }
  }
  const intervalsByEdge = new Map()
  for (const opening of [...(geometry?.doors ?? []), ...(geometry?.windows ?? [])]) {
    const hasAttachment =
      typeof opening.wallEdgeId === 'string' ||
      typeof opening.parentWallId === 'string' ||
      Number.isInteger(opening.parentWallSegmentIndex)
    if (!hasAttachment) continue
    let edge
    if (typeof opening.wallEdgeId === 'string') edge = edgeById.get(opening.wallEdgeId)
    else if (typeof opening.parentWallId === 'string' && Number.isInteger(opening.parentWallSegmentIndex)) {
      const wall = (geometry?.walls ?? []).find((candidate) => candidate.id === opening.parentWallId)
      if (wall) edge = { wall, index: opening.parentWallSegmentIndex }
    }
    if (!edge) {
      issues.push({ code: 'opening-parent-missing', entityId: opening.id })
      continue
    }
    if (
      typeof opening.wallEdgeId === 'string' &&
      typeof opening.parentWallId === 'string' &&
      Number.isInteger(opening.parentWallSegmentIndex) &&
      (
        edge.wall.id !== opening.parentWallId ||
        edge.index !== opening.parentWallSegmentIndex
      )
    ) {
      issues.push({ code: 'opening-attachment-conflict', entityId: opening.id, wallEdgeId: opening.wallEdgeId })
    }
    const interval = openingIntervalOnWallSegment(opening, edge.wall, edge.index)
    if (!interval) {
      issues.push({ code: 'opening-attachment-invalid', entityId: opening.id })
      continue
    }
    const edgeId = wallEdgeId(edge.wall, edge.index)
    if (typeof opening.wallEdgeId === 'string' && Array.isArray(opening.points) && opening.points.length === 2) {
      const expectedStart = interpolatePoint(edge.wall.points[edge.index], edge.wall.points[edge.index + 1], interval[0])
      const expectedEnd = interpolatePoint(edge.wall.points[edge.index], edge.wall.points[edge.index + 1], interval[1])
      const direct = Math.hypot(opening.points[0].x - expectedStart.x, opening.points[0].y - expectedStart.y) +
        Math.hypot(opening.points[1].x - expectedEnd.x, opening.points[1].y - expectedEnd.y)
      const reversed = Math.hypot(opening.points[1].x - expectedStart.x, opening.points[1].y - expectedStart.y) +
        Math.hypot(opening.points[0].x - expectedEnd.x, opening.points[0].y - expectedEnd.y)
      if (Math.min(direct, reversed) > 0.02) {
        issues.push({ code: 'opening-points-mismatch', entityId: opening.id, wallEdgeId: edgeId })
      }
    }
    const previous = intervalsByEdge.get(edgeId) ?? []
    if (previous.some((candidate) => interval[0] < candidate.end - 0.0001 && interval[1] > candidate.start + 0.0001)) {
      issues.push({ code: 'opening-overlap', entityId: opening.id, wallEdgeId: edgeId })
    }
    previous.push({ start: interval[0], end: interval[1], entityId: opening.id })
    intervalsByEdge.set(edgeId, previous)
  }
  return issues
}

export function validateGeometryStructure(geometry) {
  const issues = []
  const pointValid = (point) => finitePoint(point) && Math.abs(point.x) <= 1_000_000 && Math.abs(point.y) <= 1_000_000
  const commonValid = (entity) =>
    entity && typeof entity.id === 'string' && entity.id.length > 0 && entity.id.length <= 160 &&
    typeof entity.label === 'string' && entity.label.length <= 120 &&
    Array.isArray(entity.points) && entity.points.every(pointValid) &&
    typeof entity.blocksVision === 'boolean' && typeof entity.blocksMovement === 'boolean' &&
    typeof entity.blocksLineOfEffect === 'boolean' &&
    Number.isFinite(entity.baseHeightFeet) && entity.baseHeightFeet >= -1_000 && entity.baseHeightFeet <= 10_000 &&
    Number.isFinite(entity.heightFeet) && entity.heightFeet >= 0 && entity.heightFeet <= 10_000 &&
    Number.isFinite(entity.createdAt) && entity.createdAt >= 0
  if (!geometry || typeof geometry.mapId !== 'string' || !geometry.mapId || geometry.mapId.length > 160) {
    issues.push({ code: 'invalid-map-id' })
    return issues
  }
  const collections = ['walls', 'doors', 'windows', 'obstacles', 'lights']
  if (collections.some((name) => !Array.isArray(geometry[name]))) {
    issues.push({ code: 'invalid-geometry-collections' })
    return issues
  }
  if (collections.reduce((count, name) => count + geometry[name].length, 0) > 4_096) {
    issues.push({ code: 'geometry-entity-limit' })
  }
  for (const wall of geometry.walls) {
    if (!commonValid(wall) || wall.kind !== 'wall' || wall.points.length < 2 || wall.points.length > 2_048 ||
      !['stone', 'brick', 'wood', 'metal', 'natural'].includes(wall.material ?? 'stone') ||
      (wall.edgeIds != null && (!Array.isArray(wall.edgeIds) || wall.edgeIds.length !== wall.points.length - 1 ||
        wall.edgeIds.some((id) => typeof id !== 'string' || !id || id.length > 200)))) {
      issues.push({ code: 'invalid-wall', entityId: wall?.id })
    }
  }
  for (const door of geometry.doors) {
    if (!commonValid(door) || door.kind !== 'door' || door.points.length !== 2 ||
      !['open', 'closed', 'locked'].includes(door.state) ||
      !['open', 'closed'].includes(door.openState) ||
      !['unlocked', 'locked', 'jammed'].includes(door.lockState) ||
      !['intact', 'broken', 'destroyed'].includes(door.physicalState) ||
      typeof door.secret !== 'boolean') {
      issues.push({ code: 'invalid-door', entityId: door?.id })
    } else if (legacyDoorState(door) !== door.state) {
      issues.push({ code: 'door-state-conflict', entityId: door.id })
    }
  }
  for (const window of geometry.windows) {
    if (!commonValid(window) || window.kind !== 'window' || window.points.length !== 2 ||
      !['glass', 'bars', 'shutters', 'opening'].includes(window.windowType) ||
      !['closed', 'open', 'broken'].includes(window.windowState ?? 'closed')) {
      issues.push({ code: 'invalid-window', entityId: window?.id })
    }
  }
  for (const obstacle of geometry.obstacles) {
    if (!commonValid(obstacle) || obstacle.kind !== 'obstacle' || obstacle.points.length < 3 || obstacle.points.length > 2_048) {
      issues.push({ code: 'invalid-obstacle', entityId: obstacle?.id })
    }
  }
  for (const light of geometry.lights) {
    if (!light || light.kind !== 'light' || typeof light.id !== 'string' || !light.id || light.id.length > 160 ||
      typeof light.label !== 'string' || light.label.length > 120 || !Array.isArray(light.points) ||
      light.points.length !== 1 || !light.points.every(pointValid) || typeof light.enabled !== 'boolean' ||
      !Number.isFinite(light.brightRadiusFeet) || light.brightRadiusFeet < 0 || light.brightRadiusFeet > 10_000 ||
      !Number.isFinite(light.dimRadiusFeet) || light.dimRadiusFeet < 0 || light.dimRadiusFeet > 10_000 ||
      typeof light.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(light.color)) {
      issues.push({ code: 'invalid-light', entityId: light?.id })
    }
  }
  return issues
}

export function deriveRoomGraph(input) {
  const cellSize = Math.max(4, input.cellSize ?? 32)
  const columns = Math.max(1, Math.ceil(input.width / cellSize))
  const rows = Math.max(1, Math.ceil(input.height / cellSize))
  const roomGeometry = {
    ...input.geometry,
    doors: (input.geometry?.doors ?? []).map((door) => ({
      ...door,
      state: 'closed',
      openState: 'closed',
      physicalState: 'intact',
    })),
  }
  const compiled = compileGeometry(roomGeometry, { bucketSize: cellSize * 4 })
  const key = (col, row) => `${col},${row}`
  const roomByCell = new Map()
  const rooms = []
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < columns; col += 1) {
      if (roomByCell.has(key(col, row))) continue
      const id = `room:${rooms.length}`
      const queue = [[col, row]]
      const cells = []
      roomByCell.set(key(col, row), id)
      let queueIndex = 0
      while (queueIndex < queue.length) {
        const [currentCol, currentRow] = queue[queueIndex]
        queueIndex += 1
        cells.push({ col: currentCol, row: currentRow })
        const from = {
          x: Math.min(input.width, (currentCol + 0.5) * cellSize),
          y: Math.min(input.height, (currentRow + 0.5) * cellSize),
        }
        for (const [dc, dr] of directions) {
          const nextCol = currentCol + dc
          const nextRow = currentRow + dr
          if (nextCol < 0 || nextRow < 0 || nextCol >= columns || nextRow >= rows) continue
          const nextKey = key(nextCol, nextRow)
          if (roomByCell.has(nextKey)) continue
          const to = {
            x: Math.min(input.width, (nextCol + 0.5) * cellSize),
            y: Math.min(input.height, (nextRow + 0.5) * cellSize),
          }
          const blocked = raycastGeometry({
            compiled,
            from,
            to,
            purpose: 'movement',
            fromElevationFeet: 0,
            toElevationFeet: 0,
            fromEyeHeightFeet: 2.5,
            toEyeHeightFeet: 2.5,
            ignoreStart: true,
          })
          if (blocked) continue
          roomByCell.set(nextKey, id)
          queue.push([nextCol, nextRow])
        }
      }
      rooms.push({ id, cells, touchesMapBoundary: cells.some((cell) =>
        cell.col === 0 || cell.row === 0 || cell.col === columns - 1 || cell.row === rows - 1,
      ) })
    }
  }
  const portals = (input.geometry?.doors ?? []).map((door) => {
    const points = openingPoints(input.geometry, door)
    if (points.length !== 2) return null
    const midpoint = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
    const dx = points[1].x - points[0].x
    const dy = points[1].y - points[0].y
    const length = Math.max(1, Math.hypot(dx, dy))
    const normal = { x: -dy / length * cellSize * 0.6, y: dx / length * cellSize * 0.6 }
    const roomAt = (point) => roomByCell.get(key(
      Math.max(0, Math.min(columns - 1, Math.floor(point.x / cellSize))),
      Math.max(0, Math.min(rows - 1, Math.floor(point.y / cellSize))),
    ))
    return {
      id: door.id,
      fromRoomId: roomAt({ x: midpoint.x + normal.x, y: midpoint.y + normal.y }) ?? null,
      toRoomId: roomAt({ x: midpoint.x - normal.x, y: midpoint.y - normal.y }) ?? null,
      open: doorOpenState(door) === 'open',
    }
  }).filter(Boolean)
  const reachableFromBoundary = new Set(rooms.filter((room) => room.touchesMapBoundary).map((room) => room.id))
  let changed = true
  while (changed) {
    changed = false
    for (const portal of portals) {
      if (!portal.open || !portal.fromRoomId || !portal.toRoomId) continue
      if (reachableFromBoundary.has(portal.fromRoomId) && !reachableFromBoundary.has(portal.toRoomId)) {
        reachableFromBoundary.add(portal.toRoomId)
        changed = true
      } else if (reachableFromBoundary.has(portal.toRoomId) && !reachableFromBoundary.has(portal.fromRoomId)) {
        reachableFromBoundary.add(portal.fromRoomId)
        changed = true
      }
    }
  }
  return {
    cellSize,
    columns,
    rows,
    rooms: rooms.map((room) => ({ ...room, sealed: !reachableFromBoundary.has(room.id) })),
    portals,
    roomByCell,
  }
}

export function detectWallCandidatesFromRgba(input) {
  const width = Math.max(1, Math.floor(input.width))
  const height = Math.max(1, Math.floor(input.height))
  const stride = Math.max(1, Math.floor(input.sampleStride ?? 2))
  const minimumRun = Math.max(4, Math.floor(input.minimumRun ?? 24))
  const region = input.region && typeof input.region === 'object' ? input.region : {}
  const left = Math.max(1, Math.min(width - 2, Math.floor(region.x ?? 1)))
  const top = Math.max(1, Math.min(height - 2, Math.floor(region.y ?? 1)))
  const right = Math.max(left + 1, Math.min(width - 1, Math.ceil((region.x ?? 0) + (region.width ?? width))))
  const bottom = Math.max(top + 1, Math.min(height - 1, Math.ceil((region.y ?? 0) + (region.height ?? height))))
  const pixelCount = width * height
  const luminance = new Float32Array(pixelCount)
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const index = pixel * 4
    const alpha = input.data[index + 3] / 255
    const value = input.data[index] * 0.2126 + input.data[index + 1] * 0.7152 + input.data[index + 2] * 0.0722
    luminance[pixel] = value * alpha + 255 * (1 - alpha)
  }
  const blurRadius = Math.max(2, Math.min(5, Math.round(Math.min(width, height) / 280)))
  const horizontal = new Float32Array(pixelCount)
  const blurred = new Float32Array(pixelCount)
  for (let y = 0; y < height; y += 1) {
    let sum = 0
    for (let x = -blurRadius; x <= blurRadius; x += 1) {
      sum += luminance[y * width + Math.max(0, Math.min(width - 1, x))]
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = sum / (blurRadius * 2 + 1)
      sum -= luminance[y * width + Math.max(0, x - blurRadius)]
      sum += luminance[y * width + Math.min(width - 1, x + blurRadius + 1)]
    }
  }
  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let y = -blurRadius; y <= blurRadius; y += 1) {
      sum += horizontal[Math.max(0, Math.min(height - 1, y)) * width + x]
    }
    for (let y = 0; y < height; y += 1) {
      blurred[y * width + x] = sum / (blurRadius * 2 + 1)
      sum -= horizontal[Math.max(0, y - blurRadius) * width + x]
      sum += horizontal[Math.min(height - 1, y + blurRadius + 1) * width + x]
    }
  }
  const gradients = []
  const magnitudeHistogram = new Uint32Array(256)
  for (let y = top; y < bottom; y += stride) {
    for (let x = left; x < right; x += stride) {
      const offset = y * width + x
      const gx =
        -blurred[offset - width - 1] + blurred[offset - width + 1] +
        -2 * blurred[offset - 1] + 2 * blurred[offset + 1] +
        -blurred[offset + width - 1] + blurred[offset + width + 1]
      const gy =
        -blurred[offset - width - 1] - 2 * blurred[offset - width] - blurred[offset - width + 1] +
        blurred[offset + width - 1] + 2 * blurred[offset + width] + blurred[offset + width + 1]
      const magnitude = Math.min(255, Math.hypot(gx, gy) / 4)
      magnitudeHistogram[Math.floor(magnitude)] += 1
      gradients.push({ x, y, gx, gy, magnitude })
    }
  }
  const gradientTotal = gradients.length
  const percentile = Math.max(0.78, Math.min(0.98, input.edgePercentile ?? 0.88))
  let cumulative = 0
  let adaptiveThreshold = 20
  for (let value = 255; value >= 0; value -= 1) {
    cumulative += magnitudeHistogram[value]
    if (cumulative >= gradientTotal * (1 - percentile)) {
      adaptiveThreshold = value
      break
    }
  }
  const requestedThreshold = Number.isFinite(input.edgeThreshold)
    ? input.edgeThreshold
    : Number.isFinite(input.darknessThreshold)
      ? input.darknessThreshold * 0.32
      : 22
  // Treat 22 as the neutral multiplier for the per-image adaptive threshold.
  // This preserves low-contrast sensitivity while making the tuning control
  // effective across maps with very different contrast distributions.
  const neutralThreshold = Math.max(12, Math.min(22, adaptiveThreshold))
  const edgeThreshold = Math.max(8, Math.min(120, neutralThreshold * requestedThreshold / 22))
  const angleBins = Math.max(12, Math.min(36, Math.floor(input.angleBins ?? 24)))
  const rhoStep = Math.max(1.5, stride)
  const buckets = Array.from({ length: angleBins }, () => new Map())
  const strongGradients = []
  for (const gradient of gradients) {
    if (gradient.magnitude < edgeThreshold) continue
    strongGradients.push(gradient)
    let normalAngle = Math.atan2(gradient.gy, gradient.gx)
    if (normalAngle < 0) normalAngle += Math.PI
    if (normalAngle >= Math.PI) normalAngle -= Math.PI
    const angleIndex = Math.round(normalAngle / Math.PI * angleBins) % angleBins
    const angle = angleIndex / angleBins * Math.PI
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const rho = Math.round((gradient.x * cos + gradient.y * sin) / rhoStep)
    const projection = -gradient.x * sin + gradient.y * cos
    const bucket = buckets[angleIndex].get(rho)
    if (bucket) {
      bucket.projections.push(projection)
      bucket.strength += gradient.magnitude
    } else {
      buckets[angleIndex].set(rho, {
        projections: [projection],
        strength: gradient.magnitude,
      })
    }
  }
  const segments = []
  const maximumGap = Math.max(stride * 3, Math.min(width, height) * 0.008)
  const minimumSamples = Math.max(3, Math.floor(minimumRun / Math.max(1, stride * 3)))
  for (let angleIndex = 0; angleIndex < angleBins; angleIndex += 1) {
    const angle = angleIndex / angleBins * Math.PI
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    for (const [rhoIndex, bucket] of buckets[angleIndex]) {
      if (bucket.projections.length < minimumSamples) continue
      bucket.projections.sort((a, b) => a - b)
      let start = 0
      for (let index = 1; index <= bucket.projections.length; index += 1) {
        const ended = index >= bucket.projections.length ||
          bucket.projections[index] - bucket.projections[index - 1] > maximumGap
        if (!ended) continue
        const count = index - start
        const projectionStart = bucket.projections[start]
        const projectionEnd = bucket.projections[index - 1]
        const length = projectionEnd - projectionStart
        const expectedSamples = Math.max(1, length / stride)
        const density = count / expectedSamples
        if (length >= minimumRun && count >= minimumSamples && density >= 0.18) {
          const rho = rhoIndex * rhoStep
          const confidence = Math.max(0, Math.min(1,
            0.2 + density * 0.55 + (bucket.strength / bucket.projections.length / 255) * 0.25,
          ))
          segments.push({
            a: { x: cos * rho - sin * projectionStart, y: sin * rho + cos * projectionStart },
            b: { x: cos * rho - sin * projectionEnd, y: sin * rho + cos * projectionEnd },
            confidence,
          })
        }
        start = index
      }
    }
  }
  // Curved walls do not stay in one global Hough bucket. Fit a local principal
  // direction inside small tiles so arcs become a manageable polyline instead
  // of disappearing or exploding into individual pixels.
  const tileSize = Math.max(16, Math.min(48, Math.round(minimumRun * 1.25)))
  const tiles = new Map()
  for (const gradient of strongGradients) {
    const key = `${Math.floor(gradient.x / tileSize)}:${Math.floor(gradient.y / tileSize)}`
    const tile = tiles.get(key)
    if (tile) tile.push(gradient)
    else tiles.set(key, [gradient])
  }
  const tileMinimumSamples = Math.max(6, Math.floor(tileSize / stride * 0.4))
  for (const points of tiles.values()) {
    if (points.length < tileMinimumSamples) continue
    const center = points.reduce((sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y,
    }), { x: 0, y: 0 })
    center.x /= points.length
    center.y /= points.length
    let xx = 0
    let xy = 0
    let yy = 0
    let strength = 0
    for (const point of points) {
      const dx = point.x - center.x
      const dy = point.y - center.y
      xx += dx * dx
      xy += dx * dy
      yy += dy * dy
      strength += point.magnitude
    }
    const trace = xx + yy
    const root = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy * xy))
    const major = (trace + root) / 2
    const minor = (trace - root) / 2
    if (major <= 0 || major / Math.max(1, minor) < 5) continue
    const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
    const ux = Math.cos(angle)
    const uy = Math.sin(angle)
    let start = Infinity
    let end = -Infinity
    for (const point of points) {
      const projection = (point.x - center.x) * ux + (point.y - center.y) * uy
      start = Math.min(start, projection)
      end = Math.max(end, projection)
    }
    const length = end - start
    const density = points.length / Math.max(1, length / stride)
    if (length < Math.max(8, minimumRun * 0.55) || density < 0.32) continue
    segments.push({
      a: { x: center.x + ux * start, y: center.y + uy * start },
      b: { x: center.x + ux * end, y: center.y + uy * end },
      confidence: Math.max(0, Math.min(1,
        0.18 + Math.min(1, major / Math.max(1, minor) / 12) * 0.35 +
        Math.min(1, density) * 0.3 + Math.min(1, strength / points.length / 128) * 0.17,
      )),
    })
  }
  return segments
}
