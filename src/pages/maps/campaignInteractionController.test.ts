import { afterEach, expect, it } from 'vitest'
import { readCampaignInteractionContext } from './campaignInteractionController'
import { campaignInteractionFixture } from './campaignInteractionCompletion.fixture'
import { setMapGeometryRuntime, type MapGeometryState } from '../../lib/mapGeometry'
import { planDnd5eMapResultApplication } from '../../rulesets/dnd5e/mapBridge'

afterEach(() => setMapGeometryRuntime([]))

function fixture() {
  const source = campaignInteractionFixture()
  const data: Record<string, unknown> = {
    characters: { characters: source.characters, _sync: { revision: 7 } },
    maps: { maps: [source.map], _sync: { revision: 8 } },
    'campaign-time': { ...source.clock, _sync: { revision: 9 } },
    combat: { active: false, _sync: { revision: 10 } },
    'map-geometry': null,
  }
  const read = async <T,>(name: string): Promise<T | null> => structuredClone(data[name]) as T | null
  const wall: MapGeometryState = { mapId: source.map.id, walls: [{ id: 'wall', kind: 'wall', label: 'Wall',
    points: [{ x: 50, y: 0 }, { x: 50, y: 500 }], baseHeightFeet: 0, heightFeet: 30,
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, createdAt: 1 }], doors: [], obstacles: [],
    vision: { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }, updatedAt: 1 }
  return { data, read, wall, mapId: source.map.id }
}

it('binds revisions to the returned snapshots and preserves authoritative combat activity', async () => {
  const input = fixture()
  const context = await readCampaignInteractionContext(input.mapId, input.read)
  expect(context.expectedRevisions).toEqual({ characters: 7, maps: 8, 'campaign-time': 9 })
  expect(context.readRevisions).toEqual({ combat: 10, 'map-geometry': 0 })
  expect(context.state.active).toBe(false)
  input.data.combat = { active: true, _sync: { revision: 11 } }
  expect((await readCampaignInteractionContext(input.mapId, input.read)).state.active).toBe(true)
})

it.each([true, false])('uses explicit geometry through result mapping, ignoring conflicting runtime geometry (%s)', async freshHasWall => {
  const input = fixture()
  setMapGeometryRuntime(freshHasWall ? [] : [input.wall])
  if (freshHasWall) input.data['map-geometry'] = { schemaVersion: 3, maps: [input.wall], updatedAt: 1, _sync: { revision: 12 } }
  const context = await readCampaignInteractionContext(input.mapId, input.read)
  const blocked = () => Object.values(context.state.lineOfEffectBlockedByCombatantPair ?? {}).some(Boolean)
  expect(blocked()).toBe(freshHasWall)
  planDnd5eMapResultApplication({ ...context, events: [] })
  expect(blocked()).toBe(freshHasWall)
})

it.each(['characters', 'maps', 'campaign-time', 'combat', 'map-geometry'])('refuses an unversioned %s snapshot', async name => {
  const input = fixture()
  input.data[name] = { ...(input.data[name] as object ?? {}), _sync: undefined }
  await expect(readCampaignInteractionContext(input.mapId, input.read)).rejects.toThrow(`interaction-snapshot-revision-required:${name}`)
})
