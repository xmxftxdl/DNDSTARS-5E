import { isFlameLight } from '../shared/flame-light-concealment.mjs'
import { stoneWallIntersects } from '../shared/stone-wall-geometry.mjs'
import { pillarBlocksMovement } from '../shared/pillar-movement.mjs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { compileGeometryCached, raycastGeometry } from '../shared/map-geometry-kernel.mjs'
import { structureStairStepElevation, structureSupportingElevation } from '../shared/structure-support.mjs'
import { structureStairBodyHit } from '../shared/structure-stair-path.mjs'
import { structureSolidBodyBlocked } from '../shared/structure-solid-collision.mjs'
import { geometryEntityDestroyed } from '../shared/map-geometry-durability.mjs'
import { structureObjectOutsideBoundary } from '../shared/structure-object-boundary.mjs'
import { expireStructureInventoryItems } from '../shared/structure-inventory-cleanup.mjs'

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

function tokenPositionIsFree(map, movingToken, position, geometry, elevationFeet) {
  const movingHalfExtent = tokenHalfExtent(map, movingToken)
  const movingBase = elevationFeet ?? (terrainElevationAtPoint(geometry, position) + Math.max(0,
    tokenElevationFeet(geometry, movingToken) - terrainElevationAtPoint(geometry, movingToken)))
  const movingHeight = Math.max(5, (movingToken.size ?? 1) * 5)
  return (map?.tokens ?? []).every((token) => {
    if (!plainObject(token) || token.id === movingToken.id) return true
    const otherBase = tokenElevationFeet(geometry, token)
    const otherHeight = Math.max(5, (token.size ?? 1) * 5)
    if (movingBase >= otherBase + otherHeight || movingBase + movingHeight <= otherBase) return true
    const otherHalfExtent = tokenHalfExtent(map, token)
    return Math.abs(position.x - Number(token.x)) >= movingHalfExtent + otherHalfExtent - 0.001 ||
      Math.abs(position.y - Number(token.y)) >= movingHalfExtent + otherHalfExtent - 0.001
  })
}

/** Sweep the moving footprint through each segment, independent of client sampling. */
function tokenSegmentIsFree(map, movingToken, from, to, fromElevation, toElevation, geometry) {
  const movingHalf = tokenHalfExtent(map, movingToken)
  const movingHeight = Math.max(5, (movingToken.size ?? 1) * 5)
  return (map.tokens ?? []).every(token => {
    if (!plainObject(token) || token.id === movingToken.id) return true
    const half = movingHalf + tokenHalfExtent(map, token) - 0.001
    const base = tokenElevationFeet(geometry, token)
    const height = Math.max(5, (token.size ?? 1) * 5)
    const axes = [
      [from.x, to.x, Number(token.x) - half, Number(token.x) + half],
      [from.y, to.y, Number(token.y) - half, Number(token.y) + half],
      [fromElevation, toElevation, base - movingHeight + 0.0001, base + height - 0.0001],
    ]
    let enter = 0, leave = 1
    for (const [start, end, low, high] of axes) {
      const delta = end - start
      if (Math.abs(delta) < 1e-9) {
        if (start <= low || start >= high) return true
      } else {
        const a = (low - start) / delta, b = (high - start) / delta
        enter = Math.max(enter, Math.min(a, b))
        leave = Math.min(leave, Math.max(a, b))
        if (enter >= leave) return true
      }
    }
    return false
  })
}

/** Applies the only direct player map write: moving their own token outside combat. */
export function mutatePlayerExplorationMoveState(current, mutation, now, member, context = {}) {
  if (context.combatActive === true && (!context.combatMapId || context.combatMapId === mutation?.mapId)) {
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
  // Player projections can omit hidden hazards. Never let a direct coordinate
  // write bypass movement triggers merely because that client cannot see them.
  // Delegate the whole movement to Host, without returning hazard locations.
  if ((map.dnd5ePluginAreas ?? []).some(area => area.triggers?.some(trigger =>
    ['on-enter', 'on-move-distance', 'on-area-move-impact'].includes(trigger.timing)))) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-requires-area-authority' }
  }
  if ((token.lightSource?.enabled === true && token.lightSource.flame !== false &&
    isFlameLight(token.lightSource) &&
    (map.dnd5ePluginAreas ?? []).some(area => area.extinguishesUnprotectedFlames || area.strongWind || (area.sourceKind === 'core-spell' && area.coreSpellId === 'gust-of-wind'))) ||
    (map.dnd5ePluginAreas ?? []).some(area => area.extinguishesUnprotectedFlames &&
      area.anchorMode === 'source-token' && (area.anchorTokenId ?? area.sourceTokenId) === token.id)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-requires-flame-authority' }
  }
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
  const geometry = Array.isArray(context.geometryState?.maps)
    ? context.geometryState.maps.find((candidate) => candidate?.mapId === mapId)
    : null
  // Temple saves and existing denial effects require Headless creature types,
  // effect dice and resource settlement. The direct coordinate writer cannot
  // decide these, including when player projections hide the ward geometry.
  if (geometry?.structureLifetimes?.some(record => record.templeWard)) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-requires-temple-authority' }
  }
  const compiled = geometry ? compileGeometryCached(geometry) : null
  const sourceTerrainElevationFeet = terrainElevationAtPoint(geometry, token)
  const sourceElevationFeet = tokenElevationFeet(geometry, token)
  const creatureWidthFeet=(token.size??1)*(map.feetPerCell??5)
  const supportContext={map,geometry,creatureWidthFeet}
  const sourceSupport=structureSupportingElevation({...supportContext,position:token,elevationFeet:sourceElevationFeet,terrainElevationFeet:sourceTerrainElevationFeet})
  const heightAboveGroundFeet = Math.max(0, sourceElevationFeet - sourceSupport)
  const routeElevationsFeet=[sourceElevationFeet]
  const stairSteps=new Set()
  for(let index=1;index<pathPoints.length;index++){
    const prior=routeElevationsFeet[index-1],point=pathPoints[index]
    const stair=structureStairStepElevation({...supportContext,from:pathPoints[index-1],to:point,fromElevationFeet:prior})
    if(stair!=null){routeElevationsFeet.push(stair);stairSteps.add(index)}
    else routeElevationsFeet.push(structureSupportingElevation({...supportContext,position:point,elevationFeet:prior-heightAboveGroundFeet,
      terrainElevationFeet:terrainElevationAtPoint(geometry,point)})+heightAboveGroundFeet)
  }
  if (!tokenPositionIsFree(map, token, targetPosition, geometry,routeElevationsFeet.at(-1))) {
    return { ok: false, changed: false, status: 409, error: 'exploration-move-occupied' }
  }
  for (let index = 0; index < pathPoints.length; index += 1) {
    const point = pathPoints[index]
    if (!samePoint(clampTokenToMap(map, { ...token, ...point }), point)) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-path-out-of-bounds' }
    }
    if (!tokenPositionIsFree(map, token, point, geometry,routeElevationsFeet[index])) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-path-occupied' }
    }
    if (index === 0) continue
    if (!tokenSegmentIsFree(map, token, pathPoints[index - 1], point,
      routeElevationsFeet[index - 1], routeElevationsFeet[index], geometry)) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-path-occupied' }
    }
    if (!stairSteps.has(index) && Math.abs(routeElevationsFeet[index] - routeElevationsFeet[index - 1]) > 10.001) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-terrain-step' }
    }
    if ((map.dnd5ePluginAreas ?? []).some(area => pillarBlocksMovement(area, map, token,
      pathPoints[index - 1], point, routeElevationsFeet[index - 1], routeElevationsFeet[index]))) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-wall-blocked' }
    }
    if ((map.dnd5ePluginAreas ?? []).some(area => (area?.stoneWall || area?.forceWall) && stoneWallIntersects(area, map,
      pathPoints[index - 1], point, routeElevationsFeet[index - 1], routeElevationsFeet[index],
      (map.feetPerCell ?? 5) * Math.max(1, token.size ?? 1) * .42, Math.max(5, (token.size ?? 1) * 5)))) {
      return { ok: false, changed: false, status: 409, error: 'exploration-move-wall-blocked' }
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
    if((geometry?.obstacles??[]).some(obstacle=>obstacle.blocksMovement&&!obstacle.stairPath&&!geometryEntityDestroyed(obstacle)&&
      structureSolidBodyBlocked(obstacle,
        {...pathPoints[index-1],elevationFeet:routeElevationsFeet[index-1]}, {...point,elevationFeet:routeElevationsFeet[index]},
        tokenHalfExtent(map,token),Math.max(5,(token.size??1)*5))))return {ok:false,changed:false,status:409,error:'exploration-move-wall-blocked'}
    if((geometry?.obstacles??[]).some(obstacle=>obstacle.blocksMovement&&obstacle.stairPath&&!geometryEntityDestroyed(obstacle)&&
      structureStairBodyHit(obstacle.stairPath,map.gridSize/(map.feetPerCell??5),
        {...pathPoints[index-1],elevationFeet:routeElevationsFeet[index-1]}, {...point,elevationFeet:routeElevationsFeet[index]},
        tokenHalfExtent(map,token),Math.max(5,(token.size??1)*5))!=null))return {ok:false,changed:false,status:409,error:'exploration-move-wall-blocked'}
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
                dnd5eTraversalMode: 'walk',
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
    acceptedPath: pathPoints.map((point,index)=>({...point,elevationFeet:routeElevationsFeet[index]})),
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
      const [combatState, characterState, geometryState, clockState] = await Promise.all([
        deps.readState(ctx, 'combat'),
        deps.readState(ctx, 'characters'),
        deps.readState(ctx, 'map-geometry'),
        deps.readState(ctx, 'campaign-time'),
      ])
      const mapsState = await deps.readState(ctx, 'maps')
      const mapsResult = mutatePlayerExplorationMoveState(mapsState.value, mutation, now, authenticatedRoomMember, {
        combatActive: combatState.value?.active === true,
        combatMapId: combatState.value?.mapId,
        characterState: characterState.value,
        geometryState: geometryState.value,
      })
      if (!mapsResult?.ok) return { mapsResult, queueResult: null }
      const map = mapsResult.next.maps.find(map => map.id === mapsResult.mapId)
      const actor = map.tokens.find(token => token.id === mapsResult.tokenId)
      const character = characterState.value?.characters?.find(character => character.id === mapsResult.characterId)
      const inventory = character?.dnd5eInventory
      const bindings = [...inventory?.entries ?? [], ...inventory?.releasedObjects ?? [],
        ...inventory?.spellMaterialEscrows?.flatMap(record => record.entries) ?? []].flatMap(entry => entry.structureBinding ? [entry.structureBinding] : [])
      const outside = binding => mapsResult.acceptedPath.some(position=>structureObjectOutsideBoundary({
        binding, geometry: geometryState.value ?? {maps:[]}, mapId: map.id, position }))
      let nextCharacter, carried
      try {
        nextCharacter = character ? expireStructureInventoryItems(character, bindings.filter(outside)) : character
        carried = actor.dnd5eCarriedObjects?.filter(item => {
          const binding = item.objectState?.structureBinding ?? item.objectState?.inventoryItem?.instance?.structureBinding
          return !binding || !outside(binding)
        })
      } catch {
        return {mapsResult:{ok:false,status:409,error:'structure-object-boundary-unavailable'},queueResult:null}
      }
      if (carried?.length !== actor.dnd5eCarriedObjects?.length) {
        mapsResult.next = {...mapsResult.next,maps:mapsResult.next.maps.map(scene => scene.id !== map.id ? scene : {...scene,
          tokens:scene.tokens.map(token => token.id !== actor.id ? token : {...token,dnd5eCarriedObjects:carried?.length ? carried : undefined})})}
        mapsResult.changed = true
      }
      const baseCharacters = characterState.value.characters.map(candidate => candidate.id === character.id ? nextCharacter : candidate)
      const observed = deps.recordMovementSightings({
        map: mapsResult.next.maps.find(scene => scene.id === map.id), characters: baseCharacters,
        path: mapsResult.acceptedPath, actorId: actor.id, clock: clockState.value ? { ...clockState.value, worldSecondRemainder: clockState.value.worldSecondRemainder ?? 0 } : undefined,
        geometry: geometryState.value?.maps?.find(geometry => geometry.mapId === map.id),
      })
      if (observed.map.tokens.some((token, index) => token !== map.tokens[index])) {
        mapsResult.next = { ...mapsResult.next, maps: mapsResult.next.maps.map(scene => scene.id === map.id ? observed.map : scene) }
        mapsResult.changed = true
      }
      const charactersChanged = observed.characters.some((candidate, index) => candidate !== characterState.value.characters[index])
      const queueState = await deps.readState(ctx, 'player-action-requests')
      const requests = Array.isArray(queueState.value?.requests) ? queueState.value.requests : []
      const remaining = requests.filter(action => !(
        action?.type === 'move-token' && action?.combatId == null && action?.status === 'pending' &&
        action?.sourceMode === 'player' && action?.roomMemberId === authenticatedRoomMember.memberId &&
        action?.actorTokenId === mapsResult.tokenId && action?.characterId === mapsResult.characterId))
      const queueResult = {changed:remaining.length !== requests.length}
      const writes = []
      if (mapsResult.changed) writes.push({name:'maps',expectedRevision:deps.stateRevision(mapsState.value),data:mapsResult.next})
      if (charactersChanged) writes.push({name:'characters',expectedRevision:deps.stateRevision(characterState.value),data:{...characterState.value,
        characters:observed.characters,updatedAt:now}})
      if (queueResult.changed) writes.push({name:'player-action-requests',expectedRevision:deps.stateRevision(queueState.value),
        data:{...(queueState.value??{}),requests:remaining,updatedAt:now}})
      if (writes.length) {
        const saved = await deps.commit(ctx,writes,authenticatedRoomMember.memberId,`exploration:${requestId}`)
        if (!saved.ok) return {mapsResult:{ok:false,status:409,error:'exploration-move-conflict'},queueResult:null}
        mapsResult.next = saved.entries.find(entry => entry.name === 'maps')?.next ?? mapsResult.next
      }
      return {mapsResult,queueResult,charactersChanged}
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
    if (outcome.charactersChanged) deps.publishEvent(ctx, 'shared-state-changed', {
      id: `player-exploration-inventory:${requestId}:${now}`, name: 'characters', updatedAt: now,
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
