import { expect, it } from 'vitest'
import { normalizeSharedSceneOrchestration } from './sceneOrchestration'
import { loadPlanarPortalAuthority } from './planarPortalAuthority'
import { projectCharactersForRoomMember, projectMapsForPlayer } from '../../scripts/shared-server-core.mjs'

it('uses the revision on the loaded scene and isolates the captured survey from later edits', async () => {
  const stored = { ...normalizeSharedSceneOrchestration({ scenes: [{
    id: 'scene', mapId: 'map', planarPortalSurvey: {
      centerX: 0, centerY: 0, elevationFeet: 0, radiusFeet: 6000, externalPortals: [],
    }, triggers: [],
  }] }), _sync: { revision: 8 } }
  const load = async <T>(name: string) => {
    expect(name).toBe('scene-orchestration')
    return stored as T
  }
  const captured = await loadPlanarPortalAuthority(load)
  stored._sync.revision = 9
  stored.scenes[0].planarPortalSurvey!.radiusFeet = 1
  expect(captured.revision).toBe(8)
  expect(captured.scenes[0].planarPortalSurvey!.radiusFeet).toBe(6000)
})

it('refuses unavailable, unversioned and malformed Host scene data', async () => {
  for (const value of [null, normalizeSharedSceneOrchestration({}),
    { ...normalizeSharedSceneOrchestration({}), _sync: { revision: -1 } },
    { schemaVersion: 1, scenes: 'bad', _sync: { revision: 2 } }]) {
    await expect(loadPlanarPortalAuthority(async <T>() => value as T | null))
      .rejects.toThrow('planar-portal-scene-unavailable')
  }
})

it('shows portal receipts only on the owning character, never in public token state', () => {
  const planarPortalReports = { detect: { mapId: 'map', sourceActivityId: 'detect',
    origin: { x: 0, y: 0, elevationFeet: 0 }, rangeFeet: 5280, round: 1,
    report: { status: 'found', distanceFeet: 100, bearingDegrees: 90, elevationDegrees: 0 } } }
  const characters = { characters: [
    { id: 'own', roomMemberId: 'player-a', dnd5eCombatState: { planarPortalReports } },
    { id: 'party', roomMemberId: 'player-b', dnd5eCombatState: { planarPortalReports } },
  ] }
  const view = projectCharactersForRoomMember(characters, { memberId: 'player-a' }) as typeof characters
  expect(view.characters[0].dnd5eCombatState.planarPortalReports).toEqual(planarPortalReports)
  expect(view.characters[1].dnd5eCombatState.planarPortalReports).toBeUndefined()
  const maps = { maps: [{ id: 'map', width: 100, height: 100, gridSize: 10, tokens: [
    { id: 'actor', characterId: 'own', type: 'player', x: 20, y: 20, size: 1,
      dnd5eCombatState: { planarPortalReports } },
  ] }] }
  const projected = projectMapsForPlayer(maps, { maps: [] }, 'own', characters)
  expect(JSON.stringify(projected)).not.toContain('planarPortalReports')
  expect(characters.characters[1].dnd5eCombatState.planarPortalReports).toEqual(planarPortalReports)
})
