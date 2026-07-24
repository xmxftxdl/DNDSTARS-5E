import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

test('Schema V3 persists stable openings and rejects dangling wall-edge relations', async ({ request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Map Geometry V3',
      displayName: 'DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `geometry-v3-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json() as {
    roomId: string
    member: { memberId: string; roomToken: string }
  }
  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: {
      displayName: 'Geometry Player',
      clientId: `geometry-v3-player-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as { member: { memberId: string; roomToken: string } }
  const url = `${DM}/api/state/map-geometry?room=${created.roomId}`
  const common = {
    label: '几何',
    blocksVision: true,
    blocksMovement: true,
    blocksLineOfEffect: true,
    baseHeightFeet: 0,
    heightFeet: 10,
    createdAt: 1,
  }
  const geometry = {
    schemaVersion: 3,
    maps: [{
      mapId: 'map-v3',
      walls: [{
        ...common,
        id: 'wall',
        kind: 'wall',
        material: 'stone',
        points: [{ x: 100, y: 0 }, { x: 100, y: 200 }],
        edgeIds: ['wall-edge'],
      }],
      doors: [{
        ...common,
        id: 'door',
        kind: 'door',
        points: [{ x: 100, y: 80 }, { x: 100, y: 120 }],
        wallEdgeId: 'wall-edge',
        startT: 0.4,
        endT: 0.6,
        state: 'locked',
        openState: 'closed',
        lockState: 'locked',
        physicalState: 'intact',
        secret: false,
      }],
      windows: [],
      obstacles: [],
      lights: [],
      vision: {
        enabled: true,
        defaultRangeFeet: 60,
        sharePartyVision: true,
        ambientLight: 'bright',
      },
      updatedAt: 1,
    }],
    updatedAt: 1,
  }
  const dmHeaders = {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Member': created.member.memberId,
    'X-Stars-Room-Token': created.member.roomToken,
    'X-Stars-Expected-Revision': '0',
  }
  const saved = await request.put(url, { headers: dmHeaders, data: geometry })
  expect(saved.ok(), await saved.text()).toBeTruthy()

  const playerResponse = await request.get(`${PLAYER}/api/state/map-geometry?room=${created.roomId}`, {
    headers: {
      'X-Stars-Protocol': '5',
      'X-Stars-Member': joined.member.memberId,
      'X-Stars-Room-Token': joined.member.roomToken,
    },
  })
  expect(playerResponse.ok()).toBeTruthy()
  expect(await playerResponse.json()).toMatchObject({
    schemaVersion: 3,
    maps: [{
      walls: [{ edgeIds: ['wall-edge'] }],
      doors: [{
        wallEdgeId: 'wall-edge',
        startT: 0.4,
        endT: 0.6,
        openState: 'closed',
        lockState: 'locked',
        physicalState: 'intact',
      }],
    }],
  })

  const invalid = structuredClone(geometry)
  invalid.updatedAt = 2
  invalid.maps[0].updatedAt = 2
  invalid.maps[0].doors[0].wallEdgeId = 'missing-edge'
  const rejected = await request.put(url, {
    headers: { ...dmHeaders, 'X-Stars-Expected-Revision': '1' },
    data: invalid,
  })
  expect(rejected.ok()).toBe(false)
  expect(await rejected.json()).toMatchObject({
    error: 'invalid-state',
    reason: 'invalid-map-geometry-relationships',
  })
})
