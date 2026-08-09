import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { compileGeometryCached, raycastGeometry } from '../shared/map-geometry-kernel.mjs'

function plainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

const MOVEMENT_LOCK_CONDITIONS = new Set([
  'grappled', 'paralyzed', 'petrified', 'restrained', 'stunned', 'unconscious',
  '擒抱', '麻痹', '石化', '束缚', '震慑', '昏迷',
])

function characterOwnedByRoomMember(character, member) {
  return character?.roomMemberId === member?.memberId || (
    typeof member?.accountId === 'string' && member.accountId && character?.ownerAccountId === member.accountId
  )
}

function movementLocked(character) {
  const conditions = [
    ...(Array.isArray(character?.conditions) ? character.conditions : []),
    ...(Array.isArray(character?.dnd5eCombatState?.conditions)
      ? character.dnd5eCombatState.conditions
      : []),
    ...(Array.isArray(character?.dnd5eCombatState?.activeEffects)
      ? character.dnd5eCombatState.activeEffects.map((effect) => effect?.standardCondition)
      : []),
  ]
  return conditions.some((condition) =>
    typeof condition === 'string' && MOVEMENT_LOCK_CONDITIONS.has(condition.trim().toLowerCase()))
}

function validPoint(point) {
  return plainObject(point) &&
    Number.isFinite(point.x) && Math.abs(point.x) <= 1_000_000 &&
    Number.isFinite(point.y) && Math.abs(point.y) <= 1_000_000
}

function samePoint(left, right, epsilon = 0.001) {
  return validPoint(left) && validPoint(right) &&
    Math.abs(left.x - right.x) <= epsilon && Math.abs(left.y - right.y) <= epsilon
}

function pointInPolygon(point, polygon) {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index]
    const previousPoint = polygon[previous]
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) /
        ((previousPoint.y - currentPoint.y) || 1e-9) + currentPoint.x
    ) inside = !inside
  }
  return inside
}

function terrainElevationAtPoint(geometry, point) {
  let elevation = 0
  for (const obstacle of geometry?.obstacles ?? []) {
    if (!Number.isFinite(obstacle?.terrainElevationFeet) || !Array.isArray(obstacle.points)) continue
    if (pointInPolygon(point, obstacle.points)) elevation = obstacle.terrainElevationFeet
  }
  return elevation
}

function tokenElevationFeet(geometry, token) {
  const terrain = terrainElevationAtPoint(geometry, token)
  return Number.isFinite(token?.elevationFeet) ? Math.max(terrain, token.elevationFeet) : terrain
}

function tokenHalfExtent(map, token) {
  return Math.max(1, Number(map?.gridSize) || 1) * Math.max(1, Number(token?.size) || 1) / 2
}

function clampTokenToMap(map, token) {
  const width = Math.max(1, Number(map?.width) || 1)
  const height = Math.max(1, Number(map?.height) || 1)
  const halfExtent = tokenHalfExtent(map, token)
  const clampAxis = (value, extent) => extent <= halfExtent * 2
    ? extent / 2
    : Math.max(halfExtent, Math.min(extent - halfExtent, Number(value)))
  return { ...token, x: clampAxis(token?.x, width), y: clampAxis(token?.y, height) }
}

function tokenPositionIsFree(map, movingToken, position) {
  const movingHalfExtent = tokenHalfExtent(map, movingToken)
  return (map?.tokens ?? []).every((token) => {
    if (!plainObject(token) || token.id === movingToken.id) return true
    const otherHalfExtent = tokenHalfExtent(map, token)
    return Math.abs(position.x - Number(token.x)) >= movingHalfExtent + otherHalfExtent - 0.001 ||
      Math.abs(position.y - Number(token.y)) >= movingHalfExtent + otherHalfExtent - 0.001
  })
}

/** Applies the only direct player map write: moving their own token outside combat. */
export function mutatePlayerExplorationMoveState(current, mutation, now, member, context = {}) {
  if (context.combatActive === true) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-combat-active' }
  }
  if (!plainObject(current) || !Array.isArray(current.maps)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-maps-unavailable' }
  }
  const mapId = boundedText(mutation?.mapId, 180)
  const tokenId = boundedText(mutation?.tokenId, 180)
  const characterId = boundedText(mutation?.characterId, 180)
  const expectedPosition = mutation?.expectedPosition
  const targetPosition = mutation?.targetPosition
  const pathPoints = Array.isArray(mutation?.path) ? mutation.path : []
  if (
    mutation?.operation !== 'move-owned-token' || !mapId || !tokenId || !characterId ||
    !validPoint(expectedPosition) || !validPoint(targetPosition) ||
    pathPoints.length < 2 || pathPoints.length > 4_096 || pathPoints.some((point) => !validPoint(point))
  ) return { ok: false, changed: false, status: 400, error: 'invalid-exploration-move' }

  const map = current.maps.find((candidate) => candidate?.id === mapId)
  const token = map?.tokens?.find((candidate) => candidate?.id === tokenId)
  const characters = Array.isArray(context.characterState?.characters) ? context.characterState.characters : []
  const character = characters.find((candidate) => candidate?.id === characterId)
  if (
    !plainObject(map) || !Array.isArray(map.tokens) ||
    !plainObject(token) || token.type !== 'player' || token.characterId !== characterId ||
    !plainObject(character) || character.rulesetId !== 'dnd5e-2014-srd-5.1' ||
    !characterOwnedByRoomMember(character, member)
  ) return { ok: false, changed: false, status: 403, error: 'exploration-move-token-forbidden' }
  if (!Number.isFinite(character.currentHp) || character.currentHp <= 0) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-actor-defeated' }
  }
  if (movementLocked(character)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-locked' }
  }
  if (!samePoint(token, expectedPosition)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-position-conflict' }
  }
  if (!samePoint(pathPoints[0], token) || !samePoint(pathPoints.at(-1), targetPosition)) {
    return { ok: false, changed: false, status: 400, error: 'invalid-exploration-move-path' }
  }
  if (!samePoint(clampTokenToMap(map, { ...token, ...targetPosition }), targetPosition)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-out-of-bounds' }
  }
  if (!tokenPositionIsFree(map, token, targetPosition)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-occupied' }
  }

  const geometry = Array.isArray(context.geometryState?.maps)
    ? context.geometryState.maps.find((candidate) => candidate?.mapId === mapId)
    : null
  const compiled = geometry ? compileGeometryCached(geometry) : null
  const sourceTerrainElevationFeet = terrainElevationAtPoint(geometry, token)
  const sourceElevationFeet = tokenElevationFeet(geometry, token)
  const heightAboveGroundFeet = Math.max(0, sourceElevationFeet - sourceTerrainElevationFeet)
  const routeElevationsFeet = pathPoints.map((point) =>
    terrainElevationAtPoint(geometry, point) + heightAboveGroundFeet)
  for (let index = 0; index < pathPoints.length; index += 1) {
    const point = pathPoints[index]
    if (!samePoint(clampTokenToMap(map, { ...token, ...point }), point)) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-path-out-of-bounds' }
    }
    if (!tokenPositionIsFree(map, token, point)) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-path-occupied' }
    }
    if (index === 0) continue
    if (Math.abs(routeElevationsFeet[index] - routeElevationsFeet[index - 1]) > 10.001) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-terrain-step' }
    }
    if (geometry && raycastGeometry({
      geometry,
      compiled,
      purpose: 'movement',
      from: pathPoints[index - 1],
      to: point,
      fromElevationFeet: routeElevationsFeet[index - 1],
      toElevationFeet: routeElevationsFeet[index],
      ignoreStart: true,
    })) return { ok: false, changed: false, status: 409, error: 'exploration-move-wall-blocked' }
  }

  const acceptedElevationFeet = routeElevationsFeet.at(-1) ?? sourceElevationFeet
  const changed = !samePoint(token, targetPosition) ||
    Number(token.elevationFeet ?? sourceElevationFeet) !== acceptedElevationFeet || token.movementAnimation != null
  const next = changed ? {
    ...current,
    maps: current.maps.map((candidate) => candidate?.id === mapId
      ? {
          ...candidate,
          tokens: candidate.tokens.map((candidateToken) => candidateToken?.id === tokenId
            ? {
                ...candidateToken,
                x: targetPosition.x,
                y: targetPosition.y,
                elevationFeet: acceptedElevationFeet,
                movementAnimation: undefined,
              }
            : candidateToken),
        }
      : candidate),
    updatedAt: now,
  } : current
  return {
    ok: true,
    changed,
    next,
    mapId,
    tokenId,
    characterId,
    acceptedPosition: { x: targetPosition.x, y: targetPosition.y },
    acceptedElevationFeet,
  }
}

export function createPlayerExplorationMoveApi(deps) {
  return async function handlePlayerExplorationMoveApi(input) {
    const { req, res, parsed, ctx, authenticatedRoomMember, accessRole } = input
    if (parsed.pathname !== '/api/state/maps/player-exploration-move' || req.method !== 'PATCH') return false
    if (!authenticatedRoomMember || accessRole !== 'player') {
      deps.writeJson(res, 403, { error: 'player-membership-required' })
      return true
    }
    await mkdir(ctx.stateRoot, { recursive: true })
    let mutation
    try {
      mutation = JSON.parse((await deps.readBody(req)).toString('utf8'))
    } catch {
      deps.writeJson(res, 400, { error: 'invalid-json' })
      return true
    }
    const requestId = boundedText(mutation?.requestId, 220)
    if (!requestId || !/^[a-zA-Z0-9:._-]+$/.test(requestId)) {
      deps.writeJson(res, 400, { error: 'invalid-exploration-move-request-id' })
      return true
    }
    const now = Date.now()
    const outcome = await deps.withWriteLock(deps.transactionLockPath(ctx), async () => {
      await deps.recoverTransaction(ctx)
      const [combatState, characterState, geometryState] = await Promise.all([
        deps.readState(ctx, 'combat'),
        deps.readState(ctx, 'characters'),
        deps.readState(ctx, 'map-geometry'),
      ])
      const mapsResult = await deps.atomicMutate(
        path.join(ctx.stateRoot, 'maps.json'),
        (current) => mutatePlayerExplorationMoveState(current, mutation, now, authenticatedRoomMember, {
          combatActive: combatState.value?.active === true,
          characterState: characterState.value,
          geometryState: geometryState.value,
        }),
      )
      if (!mapsResult?.ok) return { mapsResult, queueResult: null }
      const queueResult = await deps.atomicMutate(
        path.join(ctx.stateRoot, 'player-action-requests.json'),
        (current) => {
          const requests = Array.isArray(current?.requests) ? current.requests : []
          const remaining = requests.filter((action) => !(
            action?.type === 'move-token' && action?.combatId == null && action?.status === 'pending' &&
            action?.sourceMode === 'player' && action?.roomMemberId === authenticatedRoomMember.memberId &&
            action?.actorTokenId === mapsResult.tokenId && action?.characterId === mapsResult.characterId
          ))
          return remaining.length === requests.length
            ? { ok: true, changed: false, next: current }
            : {
                ok: true,
                changed: true,
                next: { ...(plainObject(current) ? current : {}), requests: remaining, updatedAt: now },
              }
        },
      )
      return { mapsResult, queueResult }
    })
    const result = outcome.mapsResult
    if (!result?.ok) {
      deps.writeJson(res, result?.status ?? 400, { error: result?.error ?? 'exploration-move-failed' })
      return true
    }
    const revision = deps.stateRevision(result.next)
    if (result.changed) deps.publishEvent(ctx, 'shared-state-changed', {
      id: `player-exploration-move:${requestId}:${now}`,
      name: 'maps',
      updatedAt: now,
    })
    if (outcome.queueResult?.changed) deps.publishEvent(ctx, 'shared-state-changed', {
      id: `player-exploration-move-queue:${requestId}:${now}`,
      name: 'player-action-requests',
      updatedAt: now,
    })
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Stars-State-Revision': String(revision),
    })
    res.end(JSON.stringify({
      ok: true,
      requestId,
      mapId: result.mapId,
      tokenId: result.tokenId,
      characterId: result.characterId,
      position: result.acceptedPosition,
      elevationFeet: result.acceptedElevationFeet,
      revision,
    }))
    return true
  }
}
