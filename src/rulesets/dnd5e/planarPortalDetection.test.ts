import { expect, it } from 'vitest'
import { normalizeSharedSceneOrchestration, validateSharedSceneOrchestration } from '../../lib/sceneOrchestration'
import { validateSharedStateShape, projectSceneOrchestrationForPlayer } from '../../../scripts/shared-server-core.mjs'
import { detectDnd5ePlanarPortal } from './planarPortalDetection'

function fixture() {
  const map = { id: 'here', dnd5ePlane: 'material', gridSize: 5 }
  const scenes = normalizeSharedSceneOrchestration({ scenes: [{
    id: 'secret-scene', mapId: 'here', name: 'Secret',
    planarPortalSurvey: { centerX: 0, centerY: 0, elevationFeet: 0, radiusFeet: 5280, externalPortals: [] },
    triggers: [{ id: 'secret-trigger', name: 'Secret Gate', enabled: true,
      region: { kind: 'circle', x: 0, y: -100, radius: 5 }, events: ['enter'],
      actions: [{ id: 'portal', kind: 'teleport', enabled: true,
        isPortal: true, targetMapId: 'destination', x: 9000, y: 9000 }] }],
  }] }).scenes
  return { map, maps: [map, { ...map, id: 'destination', dnd5ePlane: 'feywild' }],
    scenes, origin: { x: 0, y: 0 }, rangeFeet: 5280 }
}

it('preserves an explicit portal through storage and reports only direction/distance', () => {
  const input = fixture()
  input.scenes = normalizeSharedSceneOrchestration(JSON.parse(JSON.stringify({ scenes: input.scenes }))).scenes
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'found', distanceFeet: 100, bearingDegrees: 0, elevationDegrees: 0 })
})

it('validates portal metadata on client and server without revealing private gates to players', () => {
  const state = normalizeSharedSceneOrchestration({ scenes: fixture().scenes })
  expect(validateSharedSceneOrchestration(state)).toBe(true)
  expect(validateSharedStateShape('scene-orchestration', state)).toEqual({ ok: true })
  expect(projectSceneOrchestrationForPlayer(state).scenes).toEqual([])
  Object.assign(state.scenes[0].triggers[0].actions[0], { isPortal: 'true' })
  expect(validateSharedSceneOrchestration(state)).toBe(false)
  expect(validateSharedStateShape('scene-orchestration', state).ok).toBe(false)
})

it('does not treat ordinary transport, same-plane gates or disabled portals as planar portals', () => {
  for (const variant of ['transport', 'same-plane', 'disabled-action', 'disabled-trigger']) {
    const input = fixture(), trigger = input.scenes[0].triggers[0], action = trigger.actions[0]
    if (action.kind !== 'teleport') throw Error('fixture')
    if (variant === 'transport') delete action.isPortal
    if (variant === 'same-plane') input.maps[1].dnd5ePlane = 'material'
    if (variant === 'disabled-action') action.enabled = false
    if (variant === 'disabled-trigger') trigger.enabled = false
    expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'none' })
  }
})

it('uses the nearest entrance and includes the exact range boundary', () => {
  const input = fixture(), first = input.scenes[0].triggers[0]
  first.region = { kind: 'circle', x: 5280, y: 0, radius: 10 }
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'found', distanceFeet: 5280, bearingDegrees: 90, elevationDegrees: 0 })
  first.region.x = 5281
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'none' })
  input.scenes[0].triggers.push({ ...structuredClone(first), id: 'near',
    region: { kind: 'rect', x: -110, y: -10, width: 20, height: 20 } })
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'found', distanceFeet: 100, bearingDegrees: 270, elevationDegrees: 0 })
})

it('does not claim absence or nearest when authoritative coverage or plane data is missing', () => {
  const input = fixture()
  expect(detectDnd5ePlanarPortal({ ...input, scenes: input.scenes.map(scene => ({ ...scene, planarPortalSurvey: undefined })) }))
    .toEqual({ status: 'unavailable', reason: 'incomplete-survey' })
  input.maps.pop()
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'unavailable', reason: 'unknown-destination-plane' })
})

it('does not let a farther unresolved destination hide a known nearest portal', () => {
  const input = fixture(), trigger = structuredClone(input.scenes[0].triggers[0])
  trigger.id = 'unknown'
  trigger.region = { kind: 'circle', x: 200, y: 0, radius: 5 }
  if (trigger.actions[0].kind !== 'teleport') throw Error('fixture')
  trigger.actions[0].targetMapId = 'unloaded'
  input.scenes[0].triggers.push(trigger)
  expect(detectDnd5ePlanarPortal(input).status).toBe('found')
  trigger.region.x = 50
  expect(detectDnd5ePlanarPortal(input).status).toBe('unavailable')
})

it('measures entrance height, including vertical range and above/below direction', () => {
  const input = fixture(), trigger = input.scenes[0].triggers[0]
  trigger.region = { kind: 'circle', x: 0, y: 0, radius: 5 }
  Object.assign(trigger.actions[0], { portalElevationFeet: 5280 })
  expect(detectDnd5ePlanarPortal(input)).toMatchObject({
    status: 'found', distanceFeet: 5280, elevationDegrees: 90,
  })
  Object.assign(trigger.actions[0], { portalElevationFeet: 5281 })
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'none' })
  Object.assign(trigger.actions[0], { portalElevationFeet: -100 })
  expect(detectDnd5ePlanarPortal(input)).toMatchObject({
    status: 'found', distanceFeet: 100, elevationDegrees: -90,
  })
})

it('persists finite entrance height and rejects malformed authored height', () => {
  const state = normalizeSharedSceneOrchestration({ scenes: fixture().scenes })
  Object.assign(state.scenes[0].triggers[0].actions[0], { portalElevationFeet: 120 })
  const saved = normalizeSharedSceneOrchestration(JSON.parse(JSON.stringify(state)))
  expect(saved.scenes[0].triggers[0].actions[0]).toMatchObject({ portalElevationFeet: 120 })
  expect(validateSharedStateShape('scene-orchestration', saved)).toEqual({ ok: true })
  for (const value of ['120', Infinity, NaN]) {
    Object.assign(state.scenes[0].triggers[0].actions[0], { portalElevationFeet: value })
    expect(validateSharedSceneOrchestration(state)).toBe(false)
    expect(validateSharedStateShape('scene-orchestration', state).ok).toBe(false)
  }
})

it('requires the entire sphere around the actor to fit the DM survey after movement', () => {
  const input = fixture()
  expect(detectDnd5ePlanarPortal(input).status).toBe('found')
  input.origin.x = 1
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'unavailable', reason: 'incomplete-survey' })
  input.scenes[0].planarPortalSurvey!.radiusFeet = 5281
  expect(detectDnd5ePlanarPortal(input).status).toBe('found')
  const elevated = { ...input, origin: { x: 0, y: 0, elevationFeet: 2 } }
  expect(detectDnd5ePlanarPortal(elevated).status).toBe('unavailable')
})

it('detects authored world portals outside the battle map without exposing destinations', () => {
  const input = fixture()
  input.scenes[0].triggers = []
  input.scenes[0].planarPortalSurvey!.externalPortals = [{
    eastFeet: 0, northFeet: 5000, elevationFeet: 0, destinationPlane: 'feywild', enabled: true,
  }]
  expect(detectDnd5ePlanarPortal(input)).toEqual({
    status: 'found', distanceFeet: 5000, bearingDegrees: 0, elevationDegrees: 0,
  })
  input.scenes[0].planarPortalSurvey!.externalPortals[0].destinationPlane = 'material'
  expect(detectDnd5ePlanarPortal(input)).toEqual({ status: 'none' })
})

it('keeps coverage and world portal details private and validates them on both sides', () => {
  const state = normalizeSharedSceneOrchestration({ scenes: fixture().scenes })
  expect(validateSharedSceneOrchestration(state)).toBe(true)
  expect(validateSharedStateShape('scene-orchestration', state)).toEqual({ ok: true })
  expect(JSON.stringify(projectSceneOrchestrationForPlayer(state))).not.toContain('planarPortalSurvey')
  const restored = normalizeSharedSceneOrchestration(JSON.parse(JSON.stringify(state)))
  expect(restored.scenes[0].planarPortalSurvey).toEqual(state.scenes[0].planarPortalSurvey)
  state.scenes[0].planarPortalSurvey!.radiusFeet = -1
  expect(validateSharedSceneOrchestration(state)).toBe(false)
  expect(validateSharedStateShape('scene-orchestration', state).ok).toBe(false)
  expect(detectDnd5ePlanarPortal({ ...fixture(), scenes: state.scenes }).status).toBe('unavailable')
})
