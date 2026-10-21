/// <reference types="node" />
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const repoRoot = path.resolve(__dirname, '..', '..')
const serverScript = path.join(repoRoot, 'scripts', 'static-server.mjs')
const host = '127.0.0.1'
const port = 5408

let processHandle: ChildProcess
let sharedRoot = ''
const base = `http://${host}:${port}`

beforeAll(async () => {
  sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-exploration-move-http-'))
  const distRoot = path.join(sharedRoot, 'dist')
  await mkdir(distRoot, { recursive: true })
  await writeFile(path.join(distRoot, 'index.html'), '<!doctype html><title>stars</title>')
  processHandle = spawn(
    process.execPath,
    [serverScript, '--host', host, '--port', String(port), '--root', distRoot],
    {
      env: {
        ...process.env,
        STARS_SHARED_ROOT: sharedRoot,
        STARS_SHARED_SECRET: '',
        ASTRALTRACE_LOCAL_AI_CONFIG_DIR: path.join(sharedRoot, 'local-ai-config'),
        ASTRALTRACE_LOCAL_VOICE_CONFIG_DIR: path.join(sharedRoot, 'local-voice-config'),
      },
      stdio: 'ignore',
    },
  )
  const deadline = Date.now() + 8_000
  for (;;) {
    try {
      await fetch(`${base}/api/state/__probe__`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('exploration movement test server did not start')
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}, 15_000)

afterAll(async () => {
  if (processHandle) {
    const exited = new Promise<void>((resolve) => processHandle.once('exit', () => resolve()))
    processHandle.kill('SIGTERM')
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 3_000))])
  }
  if (sharedRoot) await rm(sharedRoot, { recursive: true, force: true }).catch(() => undefined)
})

describe('player exploration movement HTTP authority', () => {
  it.each([[false,false],[true,false],[true,true]])('persists movement and atomically removes fortress items (bound=%s, return=%s)', async (withFortressItems,returnsInside) => {
    const createResponse = await fetch(`${base}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomName: 'Exploration movement',
        displayName: 'DM',
        rulesetId: 'dnd5e-2014-srd-5.1',
        clientId: 'exploration-move-dm',
        activePlugins: [],
      }),
    })
    expect(createResponse.status).toBe(201)
    const created = await createResponse.json() as {
      roomId: string
      member: { memberId: string; roomToken: string }
    }
    const joinResponse = await fetch(`${base}/api/rooms/${created.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Player',
        clientId: 'exploration-move-player',
        activePlugins: [],
      }),
    })
    expect(joinResponse.status).toBe(200)
    const joined = await joinResponse.json() as {
      member: { memberId: string; roomToken: string }
    }
    const query = `?room=${created.roomId}`
    const headersFor = (member: { memberId: string; roomToken: string }) => ({
      'Content-Type': 'application/json',
      'X-Stars-Protocol': '5',
      'X-Stars-Member': member.memberId,
      'X-Stars-Room-Token': member.roomToken,
    })
    const dmHeaders = headersFor(created.member)
    const playerHeaders = headersFor(joined.member)
    const put = (name: string, data: unknown) => fetch(`${base}/api/state/${name}${query}`, {
      method: 'PUT',
      headers: { ...dmHeaders, 'X-Stars-Expected-Revision': '0' },
      body: JSON.stringify(data),
    })
    expect((await put('combat', { active: false, updatedAt: 1 })).status).toBe(200)
    const {normalizeCharacter}=await import('../store/characters')
    const {applyDnd5eInventoryGrantBundle}=await import('../rulesets/dnd5e/items')
    const hero=normalizeCharacter({id:'hero',name:'Hero',charClass:'战士',equipment:{},maxHp:12,currentHp:12,dnd5eInventory:{schemaVersion:3,entries:[]}})
    const grant=applyDnd5eInventoryGrantBundle([hero],{characterId:'hero',receiptId:'exploration-fortress',grants:[
      {templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:{schemaVersion:1,mapId:'map-1',structureId:'keep'}},
      {templateId:'srd-5.1:item:potion-of-healing',quantity:2}]})
    expect(grant.ok).toBe(true)
    if(withFortressItems){
      const {createEmptyMapGeometry}=await import('./mapGeometry')
      expect((await put('map-geometry',{schemaVersion:3,maps:[{...createEmptyMapGeometry('map-1',1),structureLifetimes:[{
        id:'keep',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:10080,entityIds:['wall'],
        objectBoundary:{points:[{x:0,y:0},{x:125,y:0},{x:125,y:125},{x:0,y:125}],bottomFeet:0,topFeet:30}}]}],updatedAt:1})).status).toBe(200)
    }
    expect((await put('characters', {
      characters: [{
        id: 'hero',
        name: 'Hero',
        roomMemberId: joined.member.memberId,
        rulesetId: 'dnd5e-2014-srd-5.1',
        currentHp: 12,
        maxHp: 12,
        conditions: [],
        ...(withFortressItems?{dnd5eInventory:grant.characters[0].dnd5eInventory}:{}),
      }],
      selectedId: 'hero',
      updatedAt: 1,
    })).status).toBe(200)
    expect((await put('maps', {
      maps: [{
        id: 'map-1',
        name: 'Map',
        width: 500,
        height: 500,
        gridSize: 50,
        gridOffsetX: 0,
        gridOffsetY: 0,
        showGrid: true,
        tokens: [{
          id: 'hero-token',
          characterId: 'hero',
          type: 'player',
          label: 'Hero',
          x: 50,
          y: 50,
          size: 1,
        }],
      }],
      selectedId: 'map-1',
      updatedAt: 1,
    })).status).toBe(200)

    const move = (
      requestId: string,
      expectedPosition: { x: number; y: number },
      targetPosition: { x: number; y: number },
      route = [expectedPosition,targetPosition],
    ) => fetch(`${base}/api/state/maps/player-exploration-move${query}`, {
      method: 'PATCH',
      headers: playerHeaders,
      body: JSON.stringify({
        operation: 'move-owned-token',
        requestId,
        mapId: 'map-1',
        tokenId: 'hero-token',
        characterId: 'hero',
        expectedPosition,
        targetPosition,
        path: route,
      }),
    })
    const first = await move('exploration:test:move-1', { x: 50, y: 50 }, { x: 100, y: 50 })
    expect(first.status).toBe(200)
    await expect(first.json()).resolves.toMatchObject({
      position: { x: 100, y: 50 },
      revision: 2,
    })
    const readRoster=()=>fetch(`${base}/api/state/characters${query}`,{headers:dmHeaders}).then(response=>response.json())
    const beforeExit=await readRoster()
    if(withFortressItems)expect(beforeExit.characters[0].dnd5eInventory.entries).toHaveLength(2)
    const stale=await move('exploration:stale',{x:50,y:50},{x:150,y:100})
    expect(stale.status).toBe(409)
    expect(await readRoster()).toEqual(beforeExit)
    const finalPosition=returnsInside?{x:100,y:50}:{x:150,y:100}
    const second = await move('exploration:test:move-2', { x: 100, y: 50 }, finalPosition,
      returnsInside?[{x:100,y:50},{x:150,y:100},{x:100,y:50}]:undefined)
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toMatchObject({
      position: finalPosition,
      revision: returnsInside?2:3,
    })

    const refreshed = await fetch(`${base}/api/state/maps${query}`, {
      headers: playerHeaders,
      cache: 'no-store',
    }).then((response) => response.json()) as {
      maps: Array<{ tokens: Array<{ id: string; x: number; y: number }> }>
    }
    expect(refreshed.maps[0].tokens.find((token) => token.id === 'hero-token')).toMatchObject(finalPosition)
    const afterExit=await readRoster()
    if(withFortressItems){
      expect(afterExit._sync.revision).toBe(2)
      expect(afterExit.characters[0].dnd5eInventory.entries).toHaveLength(1)
      expect(afterExit.characters[0].dnd5eInventory.entries[0].quantity).toBe(2)
      expect(afterExit.characters[0].dnd5eInventory.entries[0].structureBinding).toBeUndefined()
    }else expect(afterExit).toEqual(beforeExit)
  })
})
