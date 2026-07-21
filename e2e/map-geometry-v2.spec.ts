import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'
const PLAYER = 'http://127.0.0.1:6174'

test('Schema V2 geometry synchronizes doors and windows while preserving DM authority', async ({ request }) => {
  const createdResponse = await request.post(`${DM}/api/rooms`, {
    data: {
      roomName: 'Map Geometry V2',
      displayName: 'Geometry DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: `geometry-v2-dm-${Date.now()}`,
      activePlugins: [],
    },
  })
  expect(createdResponse.status()).toBe(201)
  const created = await createdResponse.json() as { roomId: string; member: { memberId: string; roomToken: string } }
  const joinedResponse = await request.post(`${PLAYER}/api/rooms/${created.roomId}/join`, {
    data: { displayName: 'Geometry Player', clientId: `geometry-v2-player-${Date.now()}`, activePlugins: [] },
  })
  expect(joinedResponse.ok()).toBeTruthy()
  const joined = await joinedResponse.json() as { member: { memberId: string; roomToken: string } }
  const resourceUrl = `${DM}/api/state/map-geometry?room=${created.roomId}`
  const common = {
    label: '石制结构', blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
    baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
  }
  const geometry = {
    schemaVersion: 2,
    updatedAt: 1,
    maps: [{
      mapId: 'v2-map',
      walls: [{
        ...common, id: 'wall', kind: 'wall', material: 'stone',
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }],
      }],
      doors: [{
        ...common, id: 'door', kind: 'door', state: 'closed', secret: false,
        hinge: 'end', swing: 'counterclockwise', parentWallId: 'wall', parentWallSegmentIndex: 0,
        points: [{ x: 40, y: 0 }, { x: 80, y: 0 }],
      }],
      windows: [{
        ...common, id: 'window', kind: 'window', windowType: 'bars', windowState: 'closed',
        cover: 'three-quarters', blocksVision: false, blocksLineOfEffect: false,
        parentWallId: 'wall', parentWallSegmentIndex: 0,
        points: [{ x: 120, y: 0 }, { x: 160, y: 0 }],
      }],
      obstacles: [],
      lights: [],
      vision: { enabled: true, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' },
      updatedAt: 1,
    }],
  }
  const dmHeaders = {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Expected-Revision': '0',
    'X-Stars-Member': created.member.memberId,
    'X-Stars-Room-Token': created.member.roomToken,
  }
  expect((await request.put(resourceUrl, { headers: dmHeaders, data: geometry })).ok()).toBeTruthy()

  const playerHeaders = {
    'X-Stars-Member': joined.member.memberId,
    'X-Stars-Room-Token': joined.member.roomToken,
  }
  const playerResponse = await request.get(`${PLAYER}/api/state/map-geometry?room=${created.roomId}`, { headers: playerHeaders })
  expect(playerResponse.ok()).toBeTruthy()
  expect(await playerResponse.json()).toMatchObject({
    schemaVersion: 2,
    maps: [{
      doors: [{ id: 'door', hinge: 'end', swing: 'counterclockwise' }],
      windows: [{ id: 'window', windowState: 'closed', cover: 'three-quarters' }],
    }],
  })

  const denied = await request.put(`${PLAYER}/api/state/map-geometry?room=${created.roomId}`, {
    headers: { ...playerHeaders, 'Content-Type': 'application/json', 'X-Stars-Protocol': '5' },
    data: geometry,
  })
  expect(denied.status()).toBe(403)

  geometry.maps[0].doors[0].state = 'open'
  geometry.updatedAt = 2
  geometry.maps[0].updatedAt = 2
  expect((await request.put(resourceUrl, {
    headers: { ...dmHeaders, 'X-Stars-Expected-Revision': '1' }, data: geometry,
  })).ok()).toBeTruthy()
  await expect.poll(async () => {
    const response = await request.get(`${PLAYER}/api/state/map-geometry?room=${created.roomId}`, { headers: playerHeaders })
    const state = await response.json() as { maps: Array<{ doors: Array<{ state: string }> }> }
    return state.maps[0].doors[0].state
  }).toBe('open')
})
