import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawn } from 'node:child_process'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { projectMapsForPlayer, validateSharedStateShape, projectSceneOrchestrationForPlayer } from './shared-server-core.mjs'

const ledger = { turnKey: 'combat:1:hidden', distanceByActor: { hidden: 25 } }
const scene = () => ({ id: 'scene', name: 'Scene', width: 500, height: 500, gridSize: 50,
  tokens: [{ id: 'hidden', type: 'enemy', visibilityMode: 'dm-only', x: 0, y: 0 }], dnd5eSkillCheckMovement: ledger })

test('player projection does not leak hidden creature IDs or travelled distance through the ledger', () => {
  const out = projectMapsForPlayer({ maps: [scene()] }, { maps: [] }, null, { characters: [] })
  assert.deepEqual(out.maps[0].tokens, [])
  assert.equal(out.maps[0].dnd5eSkillCheckMovement, undefined)
  assert.equal(JSON.stringify(out).includes('hidden'), false)
})

test('real player maps PUT cannot reset a ledger, while the DM can update it', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-skill-ledger-'))
  const dist = path.join(tempRoot, 'dist')
  await mkdir(dist)
  await writeFile(path.join(dist, 'index.html'), '<title>Ledger test</title>')
  const port = 5498, base = `http://127.0.0.1:${port}`
  const proc = spawn(process.execPath, ['scripts/static-server.mjs', '--host', '127.0.0.1', '--port', String(port), '--root', dist], {
    cwd: process.cwd(), env: { ...process.env, STARS_SHARED_ROOT: tempRoot }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  })
  let serverOutput = ''
  proc.stdout.on('data', chunk => { serverOutput += chunk.toString() })
  proc.stderr.on('data', chunk => { serverOutput += chunk.toString() })
  const headers = member => ({ 'Content-Type': 'application/json', 'X-Stars-Protocol': '5',
    'X-Stars-Member': member.memberId, 'X-Stars-Room-Token': member.roomToken })
  try {
    const deadline = Date.now() + 10000
    while (true) {
      try { await fetch(`${base}/api/state/__probe__`); break } catch {
        if (Date.now() > deadline) throw Error('test server unavailable: ' + serverOutput)
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    const created = await fetch(`${base}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomName: 'Skill ledger authority', displayName: 'DM', rulesetId: 'dnd5e-2014-srd-5.1', clientId: 'skill-ledger-dm', activePlugins: [] }) })
    assert.equal(created.status, 201)
    const room = await created.json()
    const joined = await fetch(`${base}/api/rooms/${room.roomId}/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Player', clientId: 'skill-ledger-player', activePlugins: [] }) })
    assert.equal(joined.status, 200)
    const player = await joined.json(), query = `?room=${room.roomId}`
    const put = async (member, body, revision) => fetch(`${base}/api/state/maps${query}`, { method: 'PUT',
      headers: { ...headers(member), 'X-Stars-Expected-Revision': String(revision) }, body: JSON.stringify(body) })
    let response = await put(room.member, { maps: [scene()], selectedId: 'scene' }, 0)
    assert.equal(response.status, 200)
    response = await put(player.member, { maps: [{ ...scene(), dnd5eSkillCheckMovement: { ...ledger, distanceByActor: {} } }], selectedId: 'scene' }, 1)
    assert.equal(response.status, 403)
    let stored = await (await fetch(`${base}/api/state/maps${query}`, { headers: headers(room.member) })).json()
    assert.deepEqual(stored.maps[0].dnd5eSkillCheckMovement, ledger)
    response = await put(room.member, { maps: [{ ...scene(), dnd5eSkillCheckMovement: { ...ledger, distanceByActor: { hidden: 30 } } }], selectedId: 'scene' }, 1)
    assert.equal(response.status, 200)
    stored = await (await fetch(`${base}/api/state/maps${query}`, { headers: headers(room.member) })).json()
    assert.equal(stored.maps[0].dnd5eSkillCheckMovement.distanceByActor.hidden, 30)
    const projected = await (await fetch(`${base}/api/state/maps${query}`, { headers: headers(player.member) })).json()
    assert.equal(projected.maps[0].dnd5eSkillCheckMovement, undefined)
  } finally {
    const exited = new Promise(resolve => proc.once('exit', resolve))
    proc.kill('SIGTERM')
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 3000))])
    const safe = path.resolve(tempRoot)
    if (!safe.startsWith(path.resolve(os.tmpdir()) + path.sep + 'stars-skill-ledger-')) throw Error('unsafe test cleanup')
    await rm(safe, { recursive: true, force: true })
  }
})

test('sensory surveys are validated and private in player scene orchestration', () => {
  const survey = { centerX: 0, centerY: 0, elevationFeet: 0, radiusFeet: 30, presences: [{ eastFeet: 5, northFeet: 0, elevationFeet: 0 }] }
  const state = { schemaVersion: 1, scenes: [{ id: 'scene', mapId: 'scene', name: 'Scene', description: '', environmentLabel: '', backgroundCue: 'none', boundHandoutIds: [], boundJournalEntryIds: [], interactionPoints: [], triggers: [], createdAt: 1, updatedAt: 1, sensoryDeceptionSurvey: survey }],
    runtime: { paused: false, pendingRuns: [], receipts: [], history: [] } }
  assert.equal(validateSharedStateShape('scene-orchestration', state).ok, true)
  assert.equal(validateSharedStateShape('scene-orchestration', { ...state, scenes: [{ ...state.scenes[0], sensoryDeceptionSurvey: { ...survey, radiusFeet: -1 } }] }).ok, false)
  const projected = projectSceneOrchestrationForPlayer(state)
  assert.equal(JSON.stringify(projected).includes('sensoryDeceptionSurvey'), false)
})

