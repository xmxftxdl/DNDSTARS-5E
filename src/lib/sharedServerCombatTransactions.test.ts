/// <reference types="node" />
import { commitD20ChoiceReroll } from '../pages/maps/commitD20ChoiceReroll'
import { createD20ChoiceRerollContribution, createD20ReplacementContribution, createD20RollConfirmationInterrupt } from './rollConfirmation'
import { registerDnd5eRulesPlugin } from '../rulesets/dnd5e/pluginApi'
import * as roomSessionModule from './roomSession'
import { runShortRestRecovery } from '../pages/maps/shortRestRecoveryController'
import { shortRestRecoveryFixture } from '../rulesets/dnd5e/shortRestRecovery.fixture'
import { publishDnd5eShortRestRecovery } from '../pages/maps/publishShortRestRecovery'
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { buildCombatMessageQueueReset } from './sharedCombatReset'
import {
  compactCombatCommandHistory,
  publishEventBestEffort,
} from '../../scripts/shared-server-core.mjs'
import { preflightPlayerActionAuthority } from './playerActionAuthorityRouter'
import { createDnd5eMechanicalEffect } from '../rulesets/dnd5e/activeEffects'
import { campaignInteractionFixture } from '../pages/maps/campaignInteractionCompletion.fixture'
import { planDnd5eCampaignInteractionCompletion } from '../pages/maps/campaignInteractionCompletion'
import { publishDnd5eCampaignInteractionCompletion } from '../pages/maps/publishCampaignInteractionCompletion'
import { loadCampaignInteractionChoices, runCampaignInteraction } from '../pages/maps/campaignInteractionController'
import * as browserResources from '../composition/browserSharedRoomResources'

const repoRoot = path.resolve(__dirname, '..', '..')
const serverScript = path.join(repoRoot, 'scripts', 'static-server.mjs')

let proc: ChildProcess
let sharedRoot = ''
const base = 'http://127.0.0.1:5492'

it.each(['command', 'transaction', 'put'].flatMap(entry => [0, -30, 15].map(ground => ({ entry, ground }))))('ends area conditions and fires without a DM page via $entry at ground $ground', async ({ entry, ground }) => {
  const { normalizeCharacter } = await import('../store/characters')
  const { createDnd5eConditionEffect } = await import('../rulesets/dnd5e/activeEffects')
  const { createEmptyMapGeometry } = await import('./mapGeometry')
  const room = await createRoom(), player = await joinRoom(room.roomId, 'Water Mage', 'water-mage-client')
  const query = `?room=${room.roomId}`
  const character = normalizeCharacter({ id: 'water-mage', name: 'Water Mage', roomId: room.roomId,
    roomMemberId: player.member.memberId, currentHp: 20, maxHp: 20, concentrating: true,
    dnd5eCombatState: { schemaVersion: 2, concentrationSpellId: 'watery-sphere' } })
  const held = { ...createDnd5eConditionEffect({ id: 'water-held', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'mage-token' }, tags: ['persistent-area:sphere'],
    duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
    repeatSave: { ability: 'str', dc: 15, timing: 'target-turn-end', onSuccess: 'remove' }, modifiers: { submerged: true } }),
    areaLifetime: { mapId: 'water-command', areaId: 'sphere', sourceActorId: 'mage-token' } }
  const unrelated = createDnd5eConditionEffect({ id: 'other-held', condition: 'restrained', targetId: 'victim',
    source: { kind: 'plugin', actorId: 'other-caster' }, duration: { type: 'permanent' } })
  const newer = { ...unrelated, id: 'newer-instance', source: { ...held.source }, tags: [...held.tags!],
    areaLifetime: { ...held.areaLifetime, generation: 1 } }
  const targetEffects = [held, unrelated, newer]
  const breathing = { schemaVersion: 1 as const, breathSeconds: 6, survivalSeconds: 6, collapsed: false, lastStepKey: 'held' }
  const victim = normalizeCharacter({ id: 'water-victim', name: 'Victim', currentHp: 20, maxHp: 20,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: targetEffects, submergedBreathing: breathing }, conditions: ['restrained'] })
  const source = { enabled: true, sourceKind: 'torch' as const, flame: true, brightRadiusFeet: 20, dimRadiusFeet: 20,
    color: '#ff8000', startedAtWorldMinute: 0, durationMinutes: 1440, expiresAtWorldMinute: 1440 }
  const map = { id: 'water-command', name: 'Water', width: 1000, height: 1000, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'mage-token', characterId: character.id, type: 'player', label: 'Mage', x: 325, y: 25, size: 1, color: '', emoji: '', lightSource: source },
      { id: 'victim-npc', type: 'npc', label: 'Victim', x: 25, y: 25, size: 1, color: '', emoji: '', dnd5eCombatState: { schemaVersion: 2, activeEffects: targetEffects, conditions: ['restrained'], submergedBreathing: breathing } },
      { id: 'victim-player', characterId: victim.id, type: 'player', label: 'Victim', x: 25, y: 25, size: 1, color: '', emoji: '' }],
    dnd5ePluginAreas: [{ id: 'sphere', label: 'Water', sourceTokenId: 'mage-token', sourceCharacterId: character.id,
      concentrationId: 'watery-sphere', createdRound: 1, expiresAfterRound: 10, anchorCell: { col: 0, row: 0 },
      cells: [{ col: 0, row: 0 }], endFlameExtinguishRadiusFeet: 30,
      triggers: [{ condition: { condition: 'restrained', endsWithArea: true, proneOnAreaEnd: true, groundOnAreaEnd: true } }] }] }
  Object.assign(map.tokens[0], { elevationFeet: ground })
  Object.assign(map.tokens[1], { elevationFeet: ground + 10, hp: 20, maxHp: 20 })
  Object.assign(map.tokens[2], { elevationFeet: ground + 10 })
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles = [{ id: 'terrain', kind: 'obstacle', label: 'Terrain',
    points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
    terrainRegion: true, terrainElevationFeet: ground, baseHeightFeet: ground, heightFeet: 0,
    cover: 'none', blocksMovement: false, blocksVision: false, blocksLineOfEffect: false, createdAt: 1 }]
  const remoteMap = { ...map, id: 'remote-water-target', dnd5ePluginAreas: [],
    tokens: [{ ...map.tokens[1], id: 'remote-npc' }] }
  const mapState = { maps: [map, remoteMap], selectedId: map.id, updatedAt: 1 }
  geometry.lights = [{ ...source, id: 'ordinary', kind: 'light', label: 'Fire', points: [{ x: 325, y: 25 }], elevationFeet: ground, createdAt: 1 }]
  const seed = await fetch(`${base}/api/state/transaction${query}`, { method: 'POST', headers: memberHeaders(room.member),
    body: JSON.stringify({ transactionId: 'water-command-seed', writes: [
      { name: 'maps', expectedRevision: 0, data: mapState },
      { name: 'characters', expectedRevision: 0, data: { characters: [character, victim], selectedId: character.id, updatedAt: 1 } },
      { name: 'map-geometry', expectedRevision: 0, data: { schemaVersion: 3, maps: [geometry], updatedAt: 1 } },
    ] }) })
  expect(seed.status, await seed.text()).toBe(200)
  const nextMaps = { ...mapState, maps: [{ ...map, dnd5ePluginAreas: [] }, remoteMap] }
  const command = entry === 'command'
    ? await fetch(`${base}/api/state/characters/command${query}`, { method: 'POST', headers: memberHeaders(player.member),
      body: JSON.stringify({ expectedRevision: 1, command: { type: 'end-concentration', commandId: 'water-dismiss', characterId: character.id } }) })
    : entry === 'put'
      ? await fetch(`${base}/api/state/maps${query}`, { method: 'PUT', headers: { ...memberHeaders(room.member), 'X-Stars-Expected-Revision': '1' }, body: JSON.stringify(nextMaps) })
      : await fetch(`${base}/api/state/transaction${query}`, { method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify({
        transactionId: 'area-expiry', writes: [{ name: 'maps', expectedRevision: 1, data: nextMaps }],
      }) })
  expect(command.status, await command.text()).toBe(entry === 'command' ? 201 : 200)
  const states = await Promise.all(['maps', 'map-geometry', 'characters'].map(async name => {
    const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
    expect(response.status).toBe(200)
    return response.json()
  }))
  expect(states.map(state => state._sync.revision)).toEqual([2, 2, 2])
  expect(states[0].maps[0].dnd5ePluginAreas ?? []).toEqual([])
  expect(states[0].maps[0].tokens[1].elevationFeet).toBe(ground)
  expect(states[0].maps[0].tokens[1].hp).toBe(20)
  expect(states[0].maps[0].tokens[2].elevationFeet).toBe(ground)
  expect(states[0].maps[1].tokens[0].elevationFeet).toBe(ground + 10)
  expect(states[2].characters[1].currentHp).toBe(20)
  expect(states[0].maps[0].tokens[0].lightSource).toBeUndefined()
  expect(states[1].maps[0].lights[0].enabled).toBe(false)
  expect(states[2].characters[0].concentrating).toBe(entry !== 'command')
  for (const state of [states[0].maps[0].tokens[1].dnd5eCombatState, states[0].maps[1].tokens[0].dnd5eCombatState, states[2].characters[1].dnd5eCombatState]) {
    expect(state.activeEffects.map((effect: { id: string }) => effect.id)).not.toContain('water-held')
    expect(state.activeEffects).toContainEqual(expect.objectContaining({ id: 'other-held' }))
    expect(state.activeEffects).toContainEqual(expect.objectContaining({ id: 'newer-instance' }))
    expect(state.activeEffects).toContainEqual(expect.objectContaining({ standardCondition: 'prone', duration: { type: 'permanent' } }))
    expect(state.activeEffects.some((effect: { modifiers?: { submerged?: boolean } }) => effect.modifiers?.submerged)).toBe(false)
    expect(state.submergedBreathing).toBeUndefined()
  }
})

it.each([false, true, 'put'] as const)('atomically extinguishes ended-area fires with geometry included=%s', async (includeGeometry) => {
  const { createEmptyMapGeometry } = await import('./mapGeometry')
  const room = await createRoom(), query = `?room=${room.roomId}`
  const post = (transactionId: string, writes: unknown[]) => fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify({ transactionId, writes }),
  })
  const read = async (name: string) => {
    const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
    expect(response.status).toBe(200)
    return response.json()
  }
  const source = { enabled: true, sourceKind: 'torch' as const, flame: true, brightRadiusFeet: 20, dimRadiusFeet: 20, color: '#ff8000', startedAtWorldMinute: 0, durationMinutes: 1440, expiresAtWorldMinute: 1440 }
  const map = { id: 'water-end', name: 'Water', width: 1000, height: 1000, gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'torch', type: 'npc', label: 'Torch', x: 325, y: 25, size: 1, color: '', emoji: '', lightSource: source }],
    dnd5ePluginAreas: [{ id: 'sphere', label: 'Water', createdRound: 1, expiresAfterRound: 10, anchorCell: { col: 0, row: 0 }, cells: [{ col: 0, row: 0 }], endFlameExtinguishRadiusFeet: 30 }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.lights = ['boundary', 'magic', 'outside'].map((id) => ({ ...source, id, kind: 'light', label: id, points: [{ x: id === 'outside' ? 326 : 325, y: 25 }], elevationFeet: 0, createdAt: 1,
    ...(id === 'magic' ? { sourceKind: 'spell' as const } : {}) }))
  const maps = { maps: [map], selectedId: map.id, updatedAt: 1 }
  const geometries = { schemaVersion: 3, maps: [geometry], updatedAt: 1 }
  const seed = await post('water-seed', [{ name: 'maps', expectedRevision: 0, data: maps }, { name: 'map-geometry', expectedRevision: 0, data: geometries }])
  expect(seed.status, await seed.text()).toBe(200)
  const before = await Promise.all(['maps', 'map-geometry'].map(read))
  const writes = [{ name: 'maps', expectedRevision: 1, data: { ...maps, maps: [{ ...map, dnd5ePluginAreas: [] }] } },
    ...(includeGeometry === true ? [{ name: 'map-geometry', expectedRevision: 1, data: { ...geometries, updatedAt: 2 } }] : [])]
  const save = (id: string, revision: number) => includeGeometry === 'put'
    ? fetch(`${base}/api/state/maps${query}`, { method: 'PUT', headers: { ...memberHeaders(room.member), 'X-Stars-Expected-Revision': String(revision) }, body: JSON.stringify(writes[0].data) })
    : post(id, writes.map(write => write.name === 'maps' ? { ...write, expectedRevision: revision } : write))
  const stale = await save('water-stale', 0)
  expect(stale.status).toBe(409)
  expect(await Promise.all(['maps', 'map-geometry'].map(read))).toEqual(before)
  const ended = await save('water-ended', 1)
  expect(ended.status, await ended.clone().text()).toBe(200)
  const ack = await ended.json()
  if (includeGeometry === 'put') expect(ack.revision).toBe(2)
  else expect(ack.revisions).toMatchObject({ maps: 2, 'map-geometry': 2 })
  const [savedMap, savedGeometry] = await Promise.all(['maps', 'map-geometry'].map(read))
  expect(savedMap.maps[0].tokens[0].lightSource).toBeUndefined()
  expect(savedGeometry.maps[0].lights.map((light: { enabled: boolean }) => light.enabled)).toEqual([false, true, true])
  expect(savedGeometry._sync.revision).toBe(2)
  if (includeGeometry === true) expect(savedGeometry.updatedAt).toBe(2)
  const replay = await save('water-ended', 1)
  expect(replay.status).toBe(409)
  expect(await Promise.all(['maps', 'map-geometry'].map(read))).toEqual([savedMap, savedGeometry])
  if (includeGeometry === 'put') {
    const undo = await fetch(`${base}/api/dm/undo${query}`, {
      method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify({}),
    })
    expect(undo.status, await undo.text()).toBe(200)
    const [restoredMaps, restoredGeometry] = await Promise.all(['maps', 'map-geometry'].map(read))
    expect(restoredMaps.maps[0].dnd5ePluginAreas).toHaveLength(1)
    expect(restoredMaps.maps[0].tokens[0].lightSource.enabled).toBe(true)
    expect(restoredGeometry.maps[0].lights.map((light: { enabled: boolean }) => light.enabled)).toEqual([true, true, true])
  }
})

it.each([false,true])('atomically expires fortress geometry and safely lowers residents with the campaign clock (inventory=%s)',async(withInventory)=>{
 const {withStructureExpiry}=await import('../composition/withStructureExpiry')
 const {createEmptyMapGeometry}=await import('./mapGeometry')
 const {normalizeSharedCampaignTime}=await import('./campaignTime')
 const {placeDnd5eMightyFortressKeep}=await import('../rulesets/dnd5e/mightyFortressStructure')
 const room=await createRoom(),query=`?room=${room.roomId}`
 const post=(body:unknown)=>fetch(`${base}/api/state/transaction${query}`,{method:'POST',headers:memberHeaders(room.member),body:JSON.stringify(body)})
 const revisions:Record<string,number>={}
 const read=async(name:string)=>{
  const response=await fetch(`${base}/api/state/${name}${query}`,{headers:memberHeaders(room.member)})
  if(response.status===404){revisions[name]=0;return null}
  expect(response.status).toBe(200)
  revisions[name]=Number(response.headers.get('X-Stars-State-Revision'))
  const data=await response.json()
  return {...data,_sync:{...data._sync,revision:revisions[name]}}
 }
 const map:import('../store/maps').BattleMap={id:'fortress',name:'Fortress',width:2000,height:2000,gridSize:50,feetPerCell:5,gridOffsetX:0,gridOffsetY:0,showGrid:true,
  tokens:[{id:'resident',type:'enemy',label:'Resident',color:'',emoji:'',size:1,x:600,y:600,elevationFeet:10.5,hp:12,maxHp:20}]}
 const geometry=placeDnd5eMightyFortressKeep({map,geometry:createEmptyMapGeometry(map.id,1),structureId:'keep',origin:{x:100,y:100},rotationDegrees:0,elevationFeet:0,
 createdAt:1,towerThicknessInches:12,floorThicknessInches:6,lifetime:{casterId:'caster',worldMinute:100}}).geometry
 const {normalizeCharacter}=await import('../store/characters')
 const {applyDnd5eInventoryGrantBundle,normalizeDnd5eInventory}=await import('../rulesets/dnd5e/items')
 const hero=normalizeCharacter({id:'fortress-owner',name:'Owner',charClass:'战士',equipment:{},maxHp:20,currentHp:20,dnd5eInventory:{schemaVersion:3,entries:[]}})
 const grant=applyDnd5eInventoryGrantBundle([hero],{characterId:hero.id,receiptId:'fortress-http-grant',grants:[
  {templateId:'srd-5.1:item:potion-of-healing',quantity:1,structureBinding:{schemaVersion:1,mapId:map.id,structureId:'keep'}},
  {templateId:'srd-5.1:item:potion-of-healing',quantity:2}]})
 expect(grant.ok).toBe(true)
 const resources=['maps','map-geometry','campaign-time',...(withInventory?['characters']:[])]
 const seed=await post({transactionId:'fortress-seed',writes:[
 {name:'maps',expectedRevision:0,data:{maps:[map],selectedId:map.id,updatedAt:1}},
 {name:'map-geometry',expectedRevision:0,data:{schemaVersion:3,maps:[geometry],updatedAt:1}},
 {name:'campaign-time',expectedRevision:0,data:normalizeSharedCampaignTime({worldMinute:10179})},
 ...(withInventory?[{name:'characters',expectedRevision:0,data:{characters:grant.characters,selectedId:hero.id,updatedAt:1}}]:[])]})
 expect(seed.status).toBe(200)
 const before=await Promise.all(resources.map(read))
 let stale=true,attempt=0
 const gateway=withStructureExpiry({getRevisionWatermark:(name:string)=>revisions[name]??0,loadResource:read,
 saveResourcesAtomically:async(writes:import('../ports/sharedRoomGateway').SharedResourceTransactionWrite[],options:any)=>{
  const response=await post({transactionId:`fortress-expire-${++attempt}`,writes:stale?writes.map(w=>w.name==='map-geometry'?{...w,expectedRevision:0}:w):writes,
   readRevisions:options?.readRevisions})
  if(response.status!==200){const failure=await response.json();throw Error(`transaction-status-${response.status}:${failure.error}:${failure.name}:${failure.reason}`)}
  return response.json()
 }} as unknown as import('../ports/sharedRoomGateway').SharedRoomGatewayPort)
 const clock=normalizeSharedCampaignTime({worldMinute:10180})
 await expect(gateway.saveResource('campaign-time',clock)).rejects.toThrow('transaction-status-409')
 expect(await Promise.all(resources.map(read))).toEqual(before)
 stale=false
 await gateway.saveResource('campaign-time',clock)
 const [maps,geometries,savedClock]=await Promise.all(['maps','map-geometry','campaign-time'].map(read))
 expect(maps.maps[0].tokens[0]).toMatchObject({hp:12,elevationFeet:0})
 expect(geometries.maps[0].obstacles).toEqual([])
 expect(geometries.maps[0].structureLifetimes).toEqual([])
 expect(savedClock.worldMinute).toBe(10180)
 expect([maps,geometries,savedClock].map(value=>value._sync.revision)).toEqual([2,2,2])
 if(withInventory){
  const roster=await read('characters'),entries=normalizeDnd5eInventory(roster.characters[0]).entries
  expect(roster._sync.revision).toBe(2)
  expect(entries).toHaveLength(1)
  expect(entries[0].quantity).toBe(2)
  expect(entries[0].structureBinding).toBeUndefined()
 }
})

it('commits object-launch map and wall damage together, rejects stale geometry, and recovers a repeated settlement', async () => {
  const { normalizeCharacter } = await import('../store/characters')
  const { createEmptyMapGeometry, setMapGeometryRuntime } = await import('./mapGeometry')
  const { applyDnd5eActivityMapHandoffsV1 } = await import('../rulesets/dnd5e/activities/dnd5eActivityMapInteraction')
  const { automationCapabilityFromLegacyStatus } = await import('../domain/automation/automationCapability')
  const room = await createRoom(), query = `?room=${room.roomId}`
  const post = (transactionId: string, writes: unknown[]) => fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify({ transactionId, writes }),
  })
  const read = async (name: string) => {
    const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
    expect(response.status).toBe(200)
    return { data: await response.json(), revision: Number(response.headers.get('X-Stars-State-Revision')) }
  }
  const map: import('../store/maps').BattleMap = { id: 'launch-map', name: 'Launch', width: 2000, height: 500,
    gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'caster', label: 'Caster', type: 'player', characterId: 'mage', x: 25, y: 225, size: 1, emoji: '', color: '' },
      { id: 'stone', label: 'Stone', type: 'obstacle', x: 125, y: 75, size: 1, emoji: '', color: '', hp: 20, maxHp: 20,
        dnd5eObjectState: { schemaVersion: 1, weightPounds: 5 } }] }
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 250, y: 0 }, { x: 250, y: 150 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    dnd5eDurability: { hitPoints: 30, maxHitPoints: 30, damageThreshold: 0 } })
  const maps = { maps: [map], selectedId: map.id, updatedAt: 1 }
  const mapGeometry = { schemaVersion: 3, maps: [geometry], updatedAt: 1 }
  const actors = { characters: [normalizeCharacter({ id: 'mage', name: 'Mage', classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } } })], selectedId: 'mage', updatedAt: 1 }
  const seed = await post('launch-seed', [
    { name: 'maps', expectedRevision: 0, data: maps }, { name: 'map-geometry', expectedRevision: 0, data: mapGeometry },
    { name: 'characters', expectedRevision: 0, data: actors },
  ])
  expect(seed.status, await seed.text()).toBe(200)
  try {
    setMapGeometryRuntime([geometry])
    const result = applyDnd5eActivityMapHandoffsV1({ map, characters: [], packageId: 'test.launch', actionId: 'launch-action', actorId: 'caster', round: 1,
      activity: { schemaVersion: 1, id: 'launch', name: 'Launch', activation: { kind: 'action' }, automation: automationCapabilityFromLegacyStatus('full'),
        target: { kind: 'area', origin: 'point', shape: 'rect', widthFeet: 5, lengthFeet: 5, rotatable: true, relation: 'any' }, outcomes: [] },
      handoffs: { movements: [], persistentAreas: [], summons: [], invocations: [], mapObjectLaunches: [{ kind: 'launch-map-object', operationId: 'launch', castLevel: 1,
        limits: { minimumWeightPounds: 1, maximumWeightPounds: 5, additionalWeightPoundsPerSlot: 5, baseSlotLevel: 1, distanceFeet: 90 }, amount: 6, damageType: 'bludgeoning' }] },
      selection: {}, areaSelection: { anchorCell: { col: 2, row: 1 }, cells: [{ col: 2, row: 1 }], targetIds: [],
        areaPlacement: { x: 125, y: 75, angleDegrees: 0, elevationFeet: 0 }, areaPlacementDistanceFeet: 20 } })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) return
    const nextGeometry = structuredClone(mapGeometry)
    Object.assign(nextGeometry.maps[0].walls[0], result.geometryEntityPatches![0].patch)
    const finalActors = structuredClone(actors); finalActors.characters[0].classResources!['dnd5e-spell-slot-1'].current = 1
    const writes = [
      { name: 'characters', expectedRevision: 1, data: finalActors },
      { name: 'maps', expectedRevision: 1, data: { ...maps, maps: [result.map] } },
      { name: 'map-geometry', expectedRevision: 0, data: nextGeometry },
      { name: 'player-action-ack', expectedRevision: 0, data: { id: 'launch-ack', actionId: 'launch-action', mapId: map.id, status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 2 } },
    ]
    const before = await Promise.all(['characters', 'maps', 'map-geometry'].map(read))
    expect((await post('player-action:launch-action', writes)).status).toBe(409)
    expect(await Promise.all(['characters', 'maps', 'map-geometry'].map(read))).toEqual(before)
    writes[2].expectedRevision = 1
    const first = await post('player-action:launch-action', writes)
    expect(first.status, await first.clone().text()).toBe(200)
    const committed = await Promise.all(['characters', 'maps', 'map-geometry'].map(read))
    expect(committed.map(item => item.revision)).toEqual([2, 2, 2])
    expect(committed[0].data.characters[0].classResources['dnd5e-spell-slot-1'].current).toBe(1)
    expect(committed[1].data.maps[0].tokens.find((token: { id: string }) => token.id === 'stone')).toMatchObject({ hp: 14, x: 250 })
    expect(committed[2].data.maps[0].walls[0].dnd5eDurability.hitPoints).toBe(24)
    const { publishPlayerActionAckWithSnapshots } = await import('./playerActionAckPublish')
    const publishAck = vi.fn(), sequentialWrite = vi.fn()
    // A request without a command receipt conflicts on repeat; the application
    // recovers from the already-durable ACK instead of spending a second time.
    await publishPlayerActionAckWithSnapshots({ ack: (await read('player-action-ack')).data,
      snapshots: { characters: finalActors.characters, maps: [result.map],
        mapGeometry: nextGeometry as import('./mapGeometry').SharedMapGeometryState, updatedAt: 2 },
      expectedRevisions: { characters: 1, maps: 1, 'map-geometry': 1, 'player-action-ack': 0 },
      saveSharedResource: sequentialWrite, publishAck,
      loadSharedResource: async name => (await read(name)).data,
      commitSharedResources: async repeatedWrites => {
        const retry = await post('player-action:launch-action', [...repeatedWrites])
        expect(retry.status).toBe(409)
        throw Error('shared-state-transaction-conflict:characters')
      },
    })
    expect(publishAck).toHaveBeenCalledTimes(1)
    expect(sequentialWrite).not.toHaveBeenCalled()
    expect(await Promise.all(['characters', 'maps', 'map-geometry'].map(read))).toEqual(committed)
  } finally { setMapGeometryRuntime([]) }
})

it('persists flight-arrival across scenes atomically and recovers without replaying impact', async () => {
  const { normalizeCharacter } = await import('../store/characters')
  const { createEmptyMapGeometry } = await import('./mapGeometry')
  const { captureDnd5eObjectFlightDeparture } = await import('../rulesets/dnd5e/mapObjectFlightDeparture')
  const { planDnd5eObjectFlightArrivalTransaction } = await import('../rulesets/dnd5e/mapObjectFlightArrivalSettlement')
  const { publishDnd5eObjectFlightArrival } = await import('../pages/maps/publishObjectFlightArrival')
  const { createDnd5eCombatant, startDnd5eHeadlessCombat } = await import('../rulesets/dnd5e/headlessCombatEngine')
  const room = await createRoom(), query = `?room=${room.roomId}`
  const post = (body: unknown) => fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify(body),
  })
  const read = async (name: string) => {
    const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
    expect(response.status).toBe(200)
    return { data: await response.json(), revision: Number(response.headers.get('X-Stars-State-Revision')) }
  }
  const source: import('../store/maps').BattleMap = { id: 'departure', name: 'Source', width: 500, height: 500,
    gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
    tokens: [{ id: 'stone', label: 'Stone', type: 'obstacle', x: 125, y: 75, size: 1, emoji: '', color: '', hp: 20, maxHp: 20,
      dnd5eObjectState: { schemaVersion: 1, weightPounds: 5 } }] }
  const receipt = captureDnd5eObjectFlightDeparture({ map: source, objectId: 'stone',
    limits: { minimumWeightPounds: 1, maximumWeightPounds: 5, additionalWeightPoundsPerSlot: 5, baseSlotLevel: 1, distanceFeet: 90 },
    slotLevel: 1, angleDegrees: 0, actionId: 'cast', operationId: 'launch', actorId: 'mage', packageId: 'test', activityId: 'catapult',
    saveDc: 15, saveAbility: 'dex', damage: 6, damageType: 'bludgeoning', successfulTargetIds: [] })!
  expect(receipt).toBeDefined()
  source.tokens = []; source.dnd5eObjectFlightDepartures = [receipt]
  const destination = { ...source, id: 'arrival', name: 'Destination', width: 2000, dnd5eObjectFlightDepartures: undefined }
  source.tokens = [{ id: 'mage', characterId: 'mage', type: 'player', label: 'Mage', x: 25, y: 225, size: 1, emoji: '', color: '' }]
  const geometry = createEmptyMapGeometry(destination.id, 1)
  geometry.walls.push({ id: 'wall', kind: 'wall', label: 'Wall', points: [{ x: 250, y: 0 }, { x: 250, y: 150 }],
    blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1,
    dnd5eDurability: { hitPoints: 30, maxHitPoints: 30, damageThreshold: 0 } })
  const characters = [normalizeCharacter({ id: 'mage', name: 'Mage', classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 2 } } })]
  const state = startDnd5eHeadlessCombat('flight', [createDnd5eCombatant({ id: 'mage', name: 'Mage', controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
    currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 25, y: 225 }, concentrating: false })])
  const completion = planDnd5eObjectFlightArrivalTransaction({ sourceMap: source, destinationMap: destination, receiptId: receipt.id,
    settlementId: 'arrival-once', geometry, point: { x: 75, y: 75, elevationFeet: 0 }, state, rolls: {}, characters, characterIdByCombatantId: {} })
  expect(completion.ok, JSON.stringify(completion)).toBe(true)
  if (!completion.ok) return
  const mapGeometry = { schemaVersion: 3 as const, maps: [geometry], updatedAt: 1 }
  const combat = { mapId: destination.id, combatId: 'flight', active: false, round: 1, initiativeIndex: 0, initiativeOrder: [], updatedAt: 1 }
  const seed = await post({ transactionId: 'arrival-seed', writes: [
    { name: 'maps', expectedRevision: 0, data: { maps: [source, destination], selectedId: source.id, updatedAt: 1 } },
    { name: 'characters', expectedRevision: 0, data: { characters, selectedId: 'mage', updatedAt: 1 } },
    { name: 'map-geometry', expectedRevision: 0, data: mapGeometry }, { name: 'combat', expectedRevision: 0, data: combat },
  ] })
  expect(seed.status, await seed.text()).toBe(200)
  let loseNextSuccess = false
  const gateway: Parameters<typeof publishDnd5eObjectFlightArrival>[0]['gateway'] = {
    saveResourcesAtomically: async (writes, options) => {
      const response = await post({ ...options, writes })
      const body = await response.json()
      if (!response.ok) throw Error(body.error)
      if (loseNextSuccess) { loseNextSuccess = false; throw Error('fetch failed') }
      return { status: 'committed', transactionId: options?.transactionId ?? '', revisions: body.revisions }
    },
    loadResource: async name => (await read(name)).data,
  }
  const input = { completion, maps: [source, destination], geometry: mapGeometry, updatedAt: 2,
    expectedRevisions: { maps: 1, characters: 1, 'map-geometry': 1, combat: 1 }, gateway }
  const snapshot = () => Promise.all(['maps', 'characters', 'map-geometry', 'combat'].map(read))
  const before = await snapshot()
  for (const name of ['maps', 'map-geometry', 'combat'] as const) {
    await expect(publishDnd5eObjectFlightArrival({ ...input, expectedRevisions: { ...input.expectedRevisions, [name]: 0 } })).rejects.toThrow(/conflict/)
    expect(await snapshot()).toEqual(before)
  }
  loseNextSuccess = true
  const readMock = vi.spyOn(browserResources, 'loadSharedResource').mockImplementation(async <T,>(name: string): Promise<T | null> => {
    const saved = await read(name)
    return { ...saved.data, _sync: { revision: saved.revision } } as T
  })
  const saveMock = vi.spyOn(browserResources, 'saveSharedResourcesAtomically').mockImplementation(gateway.saveResourcesAtomically)
  let resumed: Awaited<ReturnType<typeof import('../pages/maps/objectFlightArrivalController').runObjectFlightArrival>>
  try {
    const { runObjectFlightArrival } = await import('../pages/maps/objectFlightArrivalController')
    resumed = await runObjectFlightArrival({ sourceMapId: source.id, destinationMapId: destination.id, receiptId: receipt.id,
      point: { x: 75, y: 75, elevationFeet: 0 }, collectRolls: async request => {
        expect(request.targetIds).toEqual([])
        expect(request.entry.damage).toBe(6)
        return {}
      }, followups: {
        rollD20: async () => { throw Error('No target should roll') },
        rollD4: async () => { throw Error('No extra damage dice') },
        rollDice: async () => { throw Error('Fixed damage must not reroll') },
      } })
    expect(resumed.recovered).toBe(true)
    expect(saveMock).toHaveBeenCalledTimes(1)
  } finally { readMock.mockRestore(); saveMock.mockRestore() }
  const after = await snapshot()
  expect(after.map(item => item.revision)).toEqual([2, 2, 2, 1])
  expect(after[0].data.maps[0].dnd5eObjectFlightDepartures[0]).toMatchObject({ status: 'completed', settlementId: resumed!.completion.completedReceipt.settlementId })
  const landed = after[0].data.maps[1].tokens.find((token: { id: string }) => token.id === 'stone')
  expect(landed.hp).toBe(14)
  expect(landed.x).toBeCloseTo(250, 8)
  expect(after[2].data.maps[0].walls[0].dnd5eDurability.hitPoints).toBe(24)
  expect(after[1].data.characters[0].classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(await publishDnd5eObjectFlightArrival({ ...input, completion: resumed!.completion })).toEqual({ recovered: true })
  expect(await snapshot()).toEqual(after)
})

beforeAll(async () => {
  sharedRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-combat-transaction-'))
  const dist = path.join(sharedRoot, 'dist')
  await mkdir(dist, { recursive: true })
  await writeFile(path.join(dist, 'index.html'), '<!doctype html><title>stars</title>')
  proc = spawn(process.execPath, [serverScript, '--host', '127.0.0.1', '--port', '5492', '--root', dist], {
    env: {
      ...process.env,
      STARS_SHARED_ROOT: sharedRoot,
      STARS_SHARED_SECRET: '',
      ASTRALTRACE_LOCAL_AI_CONFIG_DIR: path.join(sharedRoot, 'local-ai-config'),
      ASTRALTRACE_LOCAL_VOICE_CONFIG_DIR: path.join(sharedRoot, 'local-voice-config'),
    },
    stdio: 'ignore',
  })
  const deadline = Date.now() + 8_000
  for (;;) {
    try {
      await fetch(`${base}/api/healthz`)
      break
    } catch {
      if (Date.now() > deadline) throw new Error('transaction test server did not start')
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
}, 15_000)

afterAll(async () => {
  if (proc) {
    const exited = new Promise<void>((resolve) => proc.once('exit', () => resolve()))
    proc.kill('SIGTERM')
    await Promise.race([exited, new Promise<void>((resolve) => setTimeout(resolve, 2_000))])
  }
  if (sharedRoot) await rm(sharedRoot, { recursive: true, force: true })
})

async function createRoom() {
  const response = await fetch(`${base}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: '权威事务测试',
      displayName: 'DM',
      rulesetId: 'dnd5e-2014-srd-5.1',
      clientId: 'transaction-dm-client',
      activePlugins: [],
    }),
  })
  expect(response.status).toBe(201)
  return await response.json() as {
    roomId: string
    member: { memberId: string; roomToken: string }
  }
}

function memberHeaders(member: { memberId: string; roomToken: string }) {
  return {
    'Content-Type': 'application/json',
    'X-Stars-Protocol': '5',
    'X-Stars-Member': member.memberId,
    'X-Stars-Room-Token': member.roomToken,
  }
}

async function joinRoom(roomId: string, displayName: string, clientId: string) {
  const response = await fetch(`${base}/api/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName, clientId, activePlugins: [] }),
  })
  expect(response.status).toBe(200)
  return await response.json() as { member: { memberId: string; roomToken: string } }
}

async function setActiveCharacter(
  roomId: string,
  member: { memberId: string; roomToken: string },
  characterId: string,
) {
  const response = await fetch(`${base}/api/rooms/${roomId}/heartbeat`, {
    method: 'POST',
    headers: memberHeaders(member),
    body: JSON.stringify({
      memberId: member.memberId,
      activePlugins: [],
      activeCharacterId: characterId,
      activeCharacterName: 'Hero',
    }),
  })
  expect(response.status).toBe(200)
}

async function seedCommandCombat(
  room: Awaited<ReturnType<typeof createRoom>>,
  player: Awaited<ReturnType<typeof joinRoom>>,
) {
  const query = `?room=${room.roomId}`
  const token = { id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero', x: 10, y: 20 }
  const writes = [
    {
      name: 'characters', expectedRevision: 0,
      data: { characters: [{ id: 'hero', name: 'Hero', roomMemberId: player.member.memberId }], selectedId: 'hero', updatedAt: 1 },
    },
    {
      name: 'maps', expectedRevision: 0,
      data: { maps: [{ id: 'map-command', name: 'Map', tokens: [token] }], selectedId: 'map-command', updatedAt: 1 },
    },
    {
      name: 'combat', expectedRevision: 0,
      data: {
        mapId: 'map-command', combatId: 'combat-command', active: true, round: 1, initiativeIndex: 0,
        initiativeOrder: [{ tokenId: token.id, slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20 }],
        updatedAt: 1,
      },
    },
  ]
  const response = await fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(room.member),
    body: JSON.stringify({ transactionId: `seed:${room.roomId}`, writes }),
  })
  expect(response.status).toBe(200)
}

function moveCommand(targetPosition = { x: 30, y: 20 }) {
  return {
    schemaVersion: 1,
    command: {
      schemaVersion: 1,
      commandId: 'move-command-1',
      issuedAt: 1_000,
      type: 'move-token',
      mapId: 'map-command',
      combatId: 'combat-command',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      expectedPosition: { x: 10, y: 20 },
      targetPosition,
      expectedElevationFeet: 0,
      targetElevationFeet: 5,
      dnd5eCarefulMovement: true,
      dnd5eStandFromProne: false,
      dnd5eTraversalMode: 'climb',
      expectedRevisions: { combat: 1, maps: 1 },
    },
  }
}

describe('combat authority state transaction', () => {
  it.each(['complete', 'interrupt'] as const)('runs the Host interaction controller from persisted preparation through %s', async outcome => {
    const room = await createRoom(), player = await joinRoom(room.roomId, 'Interaction controller player', 'controller-player')
    const query = `?room=${room.roomId}`, source = campaignInteractionFixture()
    source.clock.interactions = []
    source.characters[0].roomMemberId = player.member.memberId
    const bearer = source.map.tokens.find(token => token.id === 'bearer')!
    bearer.type = 'player'
    bearer.characterId = 'target-hero'
    source.characters.push({ ...source.characters[0], id: 'target-hero', name: 'Target hero', dnd5eCombatState: bearer.dnd5eCombatState })
    const post = (endpoint: string, body: unknown, method = 'POST') => fetch(`${base}/api${endpoint}${query}`, {
      method, headers: memberHeaders(room.member), body: JSON.stringify(body),
    })
    const read = async <T,>(name: string): Promise<T | null> => {
      const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
      if (response.status === 404) return null
      expect(response.status).toBe(200)
      return response.json()
    }
    const seed = await post('/state/transaction', { transactionId: 'controller-seed', writes: [
      { name: 'characters', expectedRevision: 0, data: { characters: source.characters, selectedId: 'hero', updatedAt: 1 } },
      { name: 'maps', expectedRevision: 0, data: { maps: [source.map], selectedId: source.map.id, updatedAt: 1 } },
      { name: 'campaign-time', expectedRevision: 0, data: source.clock },
    ] })
    expect(seed.status, await seed.text()).toBe(200)
    if (outcome === 'complete') {
      const withoutPreparation = source.characters.map(character => character.id === 'target-hero'
        ? { ...character, dnd5eCombatState: { ...character.dnd5eCombatState, activeEffects: [] } } : character)
      expect((await post('/state/transaction', { transactionId: 'remove-real-preparation', writes: [
        { name: 'characters', expectedRevision: 1, data: { characters: withoutPreparation, selectedId: 'hero', updatedAt: 2 } },
      ] })).status).toBe(200)
      const staleMirror = await post('/state/campaign-time/mutation', { operation: 'start-interaction', id: 'stale-mirror',
        sourceId: 'source', bearerId: 'bearer', effectId: 'prepare', packageId: 'test.timed', requiredRounds: 10, expectedWorldMinute: 480 }, 'PATCH')
      expect(staleMirror.status).toBe(409)
      expect((await staleMirror.json()).error).toBe('interaction-effect-unavailable')
      expect((await post('/state/transaction', { transactionId: 'restore-real-preparation', writes: [
        { name: 'characters', expectedRevision: 2, data: { characters: source.characters, selectedId: 'hero', updatedAt: 3 } },
      ] })).status).toBe(200)
    }
    const readers = vi.spyOn(browserResources, 'loadSharedResource').mockImplementation(read)
    const mutate = vi.spyOn(browserResources, 'mutateSharedRoomResource').mockImplementation(async (_name, endpoint, mutation) => {
      const response = await post(endpoint, mutation, 'PATCH')
      if (!response.ok) throw Error(JSON.stringify(await response.json()))
      return response.json()
    })
    const save = vi.spyOn(browserResources, 'saveSharedResourcesAtomically').mockImplementation(async (writes, options) => {
      const response = await post('/state/transaction', { ...options, writes })
      if (!response.ok) throw Error(JSON.stringify(await response.json()))
      return response.json()
    })
    try {
      const initial = await loadCampaignInteractionChoices(source.map.id)
      expect(initial).toEqual([expect.objectContaining({ bearerId: 'bearer', effectId: 'prepare', issue: undefined, interactionId: undefined })])
      const baseInput = { mapId: source.map.id, bearerId: 'bearer', effectId: 'prepare' }
      await runCampaignInteraction({ ...baseInput, action: 'start' })
      const started = await loadCampaignInteractionChoices(source.map.id)
      const interactionId = started[0].interactionId
      expect(interactionId).toBeTruthy()
      if (outcome === 'interrupt') {
        await runCampaignInteraction({ ...baseInput, interactionId, action: 'interrupt' })
        expect(await loadCampaignInteractionChoices(source.map.id)).toEqual([])
        await expect(runCampaignInteraction({ ...baseInput, interactionId, action: 'complete', continuityConfirmed: true })).rejects.toThrow('interaction-not-active')
        expect(save).not.toHaveBeenCalled()
        expect(await read('campaign-time')).toMatchObject({ worldMinute: 480, interactions: [expect.objectContaining({ status: 'interrupted' })] })
        return
      }
      await expect(runCampaignInteraction({ ...baseInput, interactionId, action: 'complete' })).rejects.toThrow('continuity-confirmation-required')
      expect(save).not.toHaveBeenCalled()
      await runCampaignInteraction({ ...baseInput, interactionId, action: 'complete', continuityConfirmed: true })
      expect(await loadCampaignInteractionChoices(source.map.id)).toEqual([])
      expect(save).toHaveBeenCalledTimes(1)
      const response = await fetch(`${base}/api/state/characters${query}`, { headers: memberHeaders(player.member) })
      expect(response.status).toBe(200)
      const characters = (await response.json()).characters
      expect(characters.find((row: { id: string }) => row.id === 'hero').dnd5eCombatState.activeEffects).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'prepare:completed', grantedActivities: ['finish'], grantedActivityTargetIds: ['bearer'] }),
      ]))
      await expect(runCampaignInteraction({ ...baseInput, interactionId, action: 'complete', continuityConfirmed: true })).rejects.toThrow('interaction-not-active')
      expect(save).toHaveBeenCalledTimes(1)
    } finally { readers.mockRestore(); mutate.mockRestore(); save.mockRestore() }
  })

  it.each(['combat', 'map-geometry'])('checks the %s read dependency without writing it', async dependency => {
    const room = await createRoom(), query = `?room=${room.roomId}`
    const post = (id: string, writes: unknown[], readRevisions: unknown = {}) => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify({ transactionId: id, writes, readRevisions }),
    })
    const read = async (name: string) => {
      const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
      expect(response.status).toBe(200)
      return { data: await response.json(), revision: Number(response.headers.get('x-stars-state-revision')) }
    }
    const data = dependency === 'combat'
      ? { mapId: 'map', combatId: 'combat', active: false, round: 1, initiativeIndex: 0, initiativeOrder: [], updatedAt: 1 }
      : { schemaVersion: 3, maps: [], updatedAt: 1 }
    const seed = await post('seed-read-dependency', [
      { name: dependency, expectedRevision: 0, data },
      { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 1 } },
    ])
    expect(seed.status, await seed.text()).toBe(200)
    const original = await read(dependency), actors = await read('characters')
    const edit = await post('concurrent-dependency-edit', [{ name: dependency, expectedRevision: original.revision,
      data: { ...data, ...(dependency === 'combat' ? { active: true } : {}), updatedAt: 2 } }])
    expect(edit.status, await edit.text()).toBe(200)
    const changed = await read(dependency)
    const writes = [{ name: 'characters', expectedRevision: actors.revision, data: { ...actors.data, updatedAt: 3 } }]
    const stale = await post('stale-dependency', writes, { [dependency]: original.revision })
    expect(stale.status).toBe(409)
    expect((await stale.json()).conflicts).toEqual([{ name: dependency, expectedRevision: original.revision, currentRevision: changed.revision }])
    expect(await read('characters')).toEqual(actors)
    expect(await read(dependency)).toEqual(changed)
    for (const invalid of [[], { [dependency]: -1 }, { [dependency]: '2' }, { '../combat': 0 }, { characters: actors.revision }]) {
      expect((await post('invalid-read-dependency', writes, invalid)).status).toBe(400)
    }
    expect(await read('characters')).toEqual(actors)
    const valid = await post('current-dependency', writes, { [dependency]: changed.revision })
    expect(valid.status, await valid.clone().text()).toBe(200)
    expect((await valid.json()).revisions).not.toHaveProperty(dependency)
    expect(await read(dependency)).toEqual(changed)
    expect((await read('characters')).revision).toBe(actors.revision + 1)
  })

  it('checks private scene revisions as a read-only portal dependency over HTTP', async () => {
    const { normalizeSharedSceneOrchestration } = await import('./sceneOrchestration')
    const room = await createRoom(), query = `?room=${room.roomId}`
    const read = async (name: string) => {
      const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
      expect(response.status).toBe(200)
      return { data: await response.json(), revision: Number(response.headers.get('x-stars-state-revision')) }
    }
    const post = (id: string, writes: unknown[], readRevisions = {}) => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify({ transactionId: id, writes, readRevisions }),
    })
    const scene = normalizeSharedSceneOrchestration({ scenes: [{ id: 'survey', mapId: 'map', triggers: [],
      planarPortalSurvey: { centerX: 0, centerY: 0, elevationFeet: 0, radiusFeet: 6000, externalPortals: [] } }] })
    const putScene = (value: unknown, revision: number) => fetch(`${base}/api/state/scene-orchestration${query}`, {
      method: 'PUT', headers: { ...memberHeaders(room.member), 'X-Stars-Expected-Revision': String(revision) },
      body: JSON.stringify(value),
    })
    expect((await putScene(scene, 0)).status).toBe(200)
    expect((await post('portal-seed', [{ name: 'characters', expectedRevision: 0,
      data: { characters: [], selectedId: null, updatedAt: 1 } }])).status).toBe(200)
    const original = await read('scene-orchestration'), actors = await read('characters')
    scene.scenes[0].planarPortalSurvey!.radiusFeet = 3000
    expect((await putScene(scene, original.revision)).status).toBe(200)
    const changed = await read('scene-orchestration')
    const writes = [{ name: 'characters', expectedRevision: actors.revision, data: { ...actors.data, updatedAt: 2 } }]
    const stale = await post('portal-stale', writes, { 'scene-orchestration': original.revision })
    expect(stale.status, await stale.clone().text()).toBe(409)
    expect(await read('characters')).toEqual(actors)
    const accepted = await post('portal-fresh', writes, { 'scene-orchestration': changed.revision })
    expect(accepted.status, await accepted.clone().text()).toBe(200)
    expect((await accepted.json()).revisions).not.toHaveProperty('scene-orchestration')
    expect(await read('scene-orchestration')).toEqual(changed)
    expect((await post('portal-write-not-allowed', [{ name: 'scene-orchestration', data: scene }])).status).toBe(400)
  })

  it('commits continuous interaction completion atomically, rejects stale snapshots, and recovers a lost reply', async () => {
    const room = await createRoom(), player = await joinRoom(room.roomId, 'Interaction player', 'interaction-player')
    const query = `?room=${room.roomId}`
    const source = campaignInteractionFixture()
    source.characters[0].roomMemberId = player.member.memberId
    const completion = planDnd5eCampaignInteractionCompletion(source)
    if (!completion.ok) throw Error(completion.reason)
    const post = (transactionId: string, writes: unknown[], member = room.member, readRevisions = {}) => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ transactionId, writes, readRevisions }),
    })
    const read = async (name: string, member = room.member) => {
      const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(member) })
      expect(response.status).toBe(200)
      return { data: await response.json(), revision: Number(response.headers.get('x-stars-state-revision')) }
    }
    const initialData = {
      characters: { characters: source.characters, selectedId: 'hero', updatedAt: 1 },
      maps: { maps: [source.map], selectedId: source.map.id, updatedAt: 1 },
      'campaign-time': source.clock,
    }
    const seed = await post('interaction-seed', Object.entries(initialData).map(([name, data]) => ({ name, data, expectedRevision: 0 })))
    expect(seed.status, await seed.text()).toBe(200)
    const before = { characters: await read('characters'), maps: await read('maps'), clock: await read('campaign-time') }
    // A real concurrent map edit must prevent the clock and reward from committing.
    expect((await post('interaction-map-edit', [{ name: 'maps', expectedRevision: before.maps.revision,
      data: { ...initialData.maps, updatedAt: 9 } }])).status).toBe(200)
    const editedMap = await read('maps')
    let loseReply = false
    const input: Parameters<typeof publishDnd5eCampaignInteractionCompletion>[0] = {
      completion, maps: [source.map], updatedAt: 10, characterSelectedId: 'hero', mapSelectedId: source.map.id,
      expectedRevisions: { characters: before.characters.revision, maps: before.maps.revision, 'campaign-time': before.clock.revision },
      readRevisions: { combat: 0, 'map-geometry': 0 },
      gateway: {
        saveResourcesAtomically: async (writes, options) => {
          const response = await post(options?.transactionId ?? 'interaction', [...writes], room.member, options?.readRevisions)
          if (response.status === 409) throw Error('shared-state-transaction-conflict:maps')
          expect(response.status, await response.clone().text()).toBe(200)
          const result = await response.json()
          if (loseReply) throw Error('Failed to fetch')
          return result
        },
        loadResource: async name => (await read(name)).data,
      },
    }
    await expect(publishDnd5eCampaignInteractionCompletion(input)).rejects.toThrow('transaction-conflict')
    expect(await read('characters')).toEqual(before.characters)
    expect(await read('campaign-time')).toEqual(before.clock)
    expect(await read('maps')).toEqual(editedMap)
    // Raw player submission cannot forge a Host-completed clock/reward.
    const forged = await post('interaction-forged', [{ name: 'campaign-time', expectedRevision: before.clock.revision, data: completion.clock }], player.member)
    expect(forged.status).toBe(403)
    // Rebuild from the actual refreshed map snapshot before supplying its revision.
    const replanned = planDnd5eCampaignInteractionCompletion({ ...source, map: editedMap.data.maps[0] })
    if (!replanned.ok) throw Error(replanned.reason)
    input.completion = replanned
    input.maps = editedMap.data.maps
    input.expectedRevisions = { ...input.expectedRevisions, maps: editedMap.revision }
    loseReply = true
    expect(await publishDnd5eCampaignInteractionCompletion(input)).toEqual({ recovered: true })
    const committed = { characters: await read('characters'), maps: await read('maps'), clock: await read('campaign-time') }
    expect(committed.clock.data.worldMinute).toBe(481)
    expect(committed.clock.data.interactions[0].status).toBe('completed')
    const playerCharacters = await read('characters', player.member)
    expect(playerCharacters.data.characters[0].dnd5eCombatState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'prepare:completed', grantedActivityTargetIds: ['bearer'], grantedActivities: ['finish'] }),
    ]))
    expect(committed.maps.data.maps[0].tokens.find((row: { id: string }) => row.id === 'bearer').dnd5eCombatState.activeEffects?.some((row: { id: string }) => row.id === 'prepare') ?? false).toBe(false)
    expect(await publishDnd5eCampaignInteractionCompletion(input)).toEqual({ recovered: true })
    expect(await read('characters')).toEqual(committed.characters)
    expect(await read('maps')).toEqual(committed.maps)
    expect(await read('campaign-time')).toEqual(committed.clock)
  })

  it('publishes unresolved mandatory dice to players and rejects malformed updates atomically', async () => {
    const room=await createRoom(), player=await joinRoom(room.roomId,'Dice player','dice-player')
    const query=`?room=${room.roomId}`
    const effect=createDnd5eMechanicalEffect({id:'dynamic-die',definitionId:'test.dynamic-die',label:'Dynamic die',
      source:{kind:'plugin',pluginId:'test.dice'},targetId:'dice-hero',
      modifiers:{rollDiceModifiers:[{count:1,sides:6,direction:'subtract',appliesTo:['attack','ability-check','concentration-save']}]}})
    const data={characters:[{id:'dice-hero',name:'Dice hero',roomMemberId:player.member.memberId,dnd5eCombatState:{activeEffects:[effect]}}],selectedId:'dice-hero',updatedAt:1}
    const post=(id:string,value:unknown,revision:number)=>fetch(`${base}/api/state/transaction${query}`,{
      method:'POST',headers:memberHeaders(room.member),body:JSON.stringify({transactionId:id,writes:[{name:'characters',expectedRevision:revision,data:value}]}),
    })
    expect((await post('dice-seed',data,0)).status).toBe(200)
    const response=await fetch(`${base}/api/state/characters${query}`,{headers:memberHeaders(player.member)})
    expect(response.status).toBe(200)
    const saved=await response.json(), revision=Number(response.headers.get('x-stars-state-revision'))
    expect(saved.characters[0].dnd5eCombatState.activeEffects[0].modifiers.rollDiceModifiers).toEqual(effect.modifiers!.rollDiceModifiers)
    const invalid=structuredClone(data)
    invalid.characters[0].dnd5eCombatState.activeEffects[0].modifiers!.rollDiceModifiers=[{count:0,sides:6,direction:'subtract',appliesTo:['attack']}]
    expect((await post('dice-invalid',invalid,revision)).status).toBe(422)
    const unchanged=await fetch(`${base}/api/state/characters${query}`,{headers:memberHeaders(player.member)})
    expect(Number(unchanged.headers.get('x-stars-state-revision'))).toBe(revision)
    expect(await unchanged.json()).toEqual(saved)
  })

  it('atomically protects rest effects and receipts against a clock revision change and publishes them to the player', async () => {
    const room = await createRoom(), player = await joinRoom(room.roomId, 'Rest player', 'rest-player')
    const query = `?room=${room.roomId}`
    const clock = { schemaVersion: 2, worldMinute: 480, displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: [], updatedAt: 1 }
    const owner = { id: 'rest-hero', name: 'Rest hero', roomMemberId: player.member.memberId, currentHp: 20,
      dnd5eRestActivityWindow: { schemaVersion: 1, characterId: 'rest-hero', eventId: 'rest:long-rest-complete:480', event: 'long-rest-complete', completedWorldMinute: 480, receipts: {} } }
    const post = (transactionId: string, writes: unknown[], member = room.member) => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ transactionId, writes }),
    })
    const read = async (name: string, member = room.member) => {
      const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(member) })
      expect(response.status).toBe(200)
      return { data: await response.json(), revision: Number(response.headers.get('x-stars-state-revision')) }
    }
    expect((await post('rest-seed', [
      { name: 'characters', expectedRevision: 0, data: { characters: [owner], selectedId: owner.id, updatedAt: 1 } },
      { name: 'campaign-time', expectedRevision: 0, data: clock },
    ])).status).toBe(200)
    const initial = await read('characters'), initialClock = await read('campaign-time')
    const clockUpdate = await post('clock-update', [{ name: 'campaign-time', expectedRevision: initialClock.revision, data: { ...clock, updatedAt: 2 } }])
    expect(clockUpdate.status).toBe(200)
    const latestClock = await read('campaign-time')
    const effect = createDnd5eMechanicalEffect({ id: 'rest-bound-item', definitionId: 'test.rest:bound', label: 'Rest armor', source: { kind: 'plugin', pluginId: 'test.rest', actorId: owner.id, characterId: owner.id, lastLongRestWorldMinute: 480 }, targetId: owner.id, duration: { type: 'permanent' }, breakOn: ['source-long-rest-complete', 'source-dies', 'makes-weapon-attack'], modifiers: { armorClassBonus: 1 } })
    const settled = { ...owner, dnd5eRestActivityWindow: { ...owner.dnd5eRestActivityWindow, receipts: { '["test.rest","bless"]': 'used' } }, dnd5eCombatState: { activeEffects: [effect] } }
    const writes = [
      { name: 'characters', expectedRevision: initial.revision, data: { characters: [settled], selectedId: owner.id, updatedAt: 3 } },
      { name: 'campaign-time', expectedRevision: initialClock.revision, data: clock },
    ]
    const staleResponse = await post('stale-rest', writes)
    expect(staleResponse.status, await staleResponse.text()).toBe(409)
    expect(await read('characters')).toEqual(initial)
    expect(await read('campaign-time')).toEqual(latestClock)
    // A player cannot bypass Host settlement by publishing the final receipt.
    expect((await post('player-forged-rest', writes, player.member)).status).toBe(403)
    expect(await read('characters')).toEqual(initial)
    const currentWrites = [writes[0], { name: 'campaign-time', expectedRevision: latestClock.revision, data: latestClock.data }]
    const invalidWrites = [{ name: 'characters', expectedRevision: initial.revision, data: {
      characters: [{ ...settled, dnd5eCombatState: { activeEffects: [{ ...effect, breakOn: ['unknown-lifecycle'] }] } }],
      selectedId: owner.id, updatedAt: 3,
    } }, currentWrites[1]]
    expect((await post('invalid-rest-trigger', invalidWrites)).status).toBe(422)
    expect(await read('characters')).toEqual(initial)
    expect((await post('valid-rest', currentWrites)).status).toBe(200)
    const received = await read('characters', player.member)
    expect(received.data.characters[0].dnd5eRestActivityWindow.receipts).toEqual({ '["test.rest","bless"]': 'used' })
    expect(received.data.characters[0].dnd5eCombatState.activeEffects).toEqual([effect])
    expect(received.revision).toBe(initial.revision + 1)
  })

  it('keeps the main pending command paired while GC removes only old terminal conflicts', () => {
    const pendingCommand = { commandId: 'main-pending-command', payload: 'main' }
    const pendingReceipt = { commandId: pendingCommand.commandId, status: 'pending' }
    const terminalPairs = Array.from({ length: 1_100 }, (_, index) => ({
      command: { commandId: `overlap-conflict-${index}`, payload: `conflict-${index}` },
      receipt: { commandId: `overlap-conflict-${index}`, status: 'conflict' },
    }))
    const compacted = compactCombatCommandHistory(
      [pendingCommand, ...terminalPairs.map((entry) => entry.command)],
      [pendingReceipt, ...terminalPairs.map((entry) => entry.receipt)],
    )

    expect(compacted.commands).toHaveLength(1_025)
    expect(compacted.receipts).toHaveLength(1_025)
    expect(compacted.commands[0]).toEqual(pendingCommand)
    expect(compacted.receipts[0]).toEqual(pendingReceipt)
    expect(compacted.commands.some((entry) => entry.commandId === 'overlap-conflict-0')).toBe(false)
    expect(compacted.commands.some((entry) => entry.commandId === 'overlap-conflict-1099')).toBe(true)
    expect(compacted.commands.map((entry) => entry.commandId))
      .toEqual(compacted.receipts.map((entry) => entry.commandId))
  })

  it('contains event delivery failures after an authority commit', () => {
    expect(publishEventBestEffort({} as never, 'shared-state-changed', { name: 'combat' })).toBe(false)
  })

  it('allows cross-port combat command preflight and preserves open-default player origin semantics', async () => {
    const origin = 'http://127.0.0.1:6174'
    const commandId = 'open-player:move.1'
    const commandPath = `/api/combat/commands/${encodeURIComponent(commandId)}`
    const preflight = await fetch(`${base}${commandPath}`, {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type,idempotency-key,x-stars-command-id,x-stars-command-source,x-stars-writer',
      },
    })
    expect(preflight.status).toBe(204)
    const allowedHeaders = (preflight.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase()
    expect(allowedHeaders).toContain('idempotency-key')
    expect(allowedHeaders).toContain('x-stars-command-id')
    expect(allowedHeaders).toContain('x-stars-command-source')

    const seed = await fetch(`${base}/api/state/transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Stars-Protocol': '5' },
      body: JSON.stringify({
        transactionId: 'open-default.command-seed',
        writes: [
          {
            name: 'characters', expectedRevision: 0,
            data: { characters: [{ id: 'open-hero', name: 'Open Hero' }], selectedId: 'open-hero', updatedAt: 1 },
          },
          {
            name: 'maps', expectedRevision: 0,
            data: {
              maps: [{
                id: 'open-map', name: 'Open Map',
                tokens: [{ id: 'open-token', type: 'player', characterId: 'open-hero', x: 5, y: 5 }],
              }],
              selectedId: 'open-map', updatedAt: 1,
            },
          },
          {
            name: 'combat', expectedRevision: 0,
            data: {
              mapId: 'open-map', combatId: 'open-combat', active: true, round: 1, initiativeIndex: 0,
              initiativeOrder: [{ tokenId: 'open-token', slotId: 'open-slot', label: 'Open Hero', emoji: '', color: '', roll: 10 }],
              updatedAt: 1,
            },
          },
        ],
      }),
    })
    expect(seed.status).toBe(200)

    const command = {
      schemaVersion: 1,
      command: {
        schemaVersion: 1,
        commandId,
        issuedAt: 1_000,
        type: 'move-token',
        mapId: 'open-map',
        combatId: 'open-combat',
        actorTokenId: 'open-token',
        characterId: 'open-hero',
        round: 1,
        initiativeIndex: 0,
        seq: 1,
        expectedPosition: { x: 5, y: 5 },
        expectedElevationFeet: 0,
        targetPosition: { x: 10, y: 5 },
        expectedRevisions: { combat: 1, maps: 1 },
      },
    }
    const put = await fetch(`${base}${commandPath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        'Idempotency-Key': commandId,
        'X-Stars-Command-Id': commandId,
        'X-Stars-Command-Source': 'player',
        'X-Stars-Protocol': '5',
        'X-Stars-Writer': 'client:open-player-browser',
      },
      body: JSON.stringify(command),
    })
    expect(put.status).toBe(202)
    const queueResponse = await fetch(`${base}/api/state/player-action-requests`)
    expect(queueResponse.status).toBe(200)
    const openQueue = await queueResponse.json() as { requests: Array<Record<string, unknown>> }
    expect(openQueue).toMatchObject({
      requests: [{ id: commandId, sourceMode: 'player' }],
    })
    expect(openQueue.requests[0]).not.toHaveProperty('roomMemberId')
    expect(preflightPlayerActionAuthority(openQueue.requests[0] as never, {
      isDm: true,
      activeMap: {
        id: 'open-map', name: 'Open Map', imageUrl: '', gridSize: 50, gridOffsetX: 0, gridOffsetY: 0,
        tokens: [{ id: 'open-token', type: 'player', characterId: 'open-hero', x: 5, y: 5 }],
      } as never,
      combatId: 'open-combat',
      combatActive: true,
      round: 1,
      initiativeIndex: 0,
      currentTokenId: 'open-token',
      characters: [{ id: 'open-hero' }],
      allowUnownedLegacySession: true,
      processedActionIds: new Set(),
      seenActionIds: new Set(),
    })).toMatchObject({ status: 'accepted' })
  })

  it('resets every durable combat queue in one authority transaction', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const reset = buildCombatMessageQueueReset({
      mapId: 'map-reset',
      combatId: 'combat-reset',
      updatedAt: 100,
      clearCombatLog: true,
    })
    const writes = [
      { name: 'combat-interrupts', expectedRevision: 0, data: reset.interruptQueue },
      { name: 'dice-events', expectedRevision: 0, data: reset.diceEvents },
      { name: 'player-action', expectedRevision: 0, data: reset.playerAction },
      { name: 'player-action-requests', expectedRevision: 0, data: reset.playerActionRequests },
      { name: 'player-action-processed', expectedRevision: 0, data: reset.playerActionProcessed },
      { name: 'player-action-ack', expectedRevision: 0, data: reset.playerActionAck },
      { name: 'combat-log', expectedRevision: 0, data: reset.combatLog },
    ]
    const response = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId: 'combat:test:queue-reset', writes }),
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      revisions: Object.fromEntries(writes.map((write) => [write.name, 1])),
    })

    for (const write of writes) {
      const stored = await fetch(`${base}/api/state/${write.name}${query}`, { headers })
      expect(stored.status).toBe(200)
      expect(stored.headers.get('X-Stars-State-Revision')).toBe('1')
      expect(await stored.json()).toMatchObject(write.data ?? {})
    }
  })

  it('publishes reaction material, HP and slots together and rejects stale or player-authored writes', async () => {
    const { normalizeCharacter } = await import('../store/characters')
    const { applyDnd5eInventoryMutation } = await import('../rulesets/dnd5e/items')
    const { dnd5eSpellMaterialConsumptionPlan } = await import('../rulesets/dnd5e/spellMaterials')
    const { createDnd5eDamageReactionMaterialLedger } = await import('../rulesets/dnd5e/damageReactionMaterialLedger')
    const { mergeDnd5eReactionMaterialsIntoMapPlan } = await import('../rulesets/dnd5e/damageReactionMaterialApplication')
    const room = await createRoom(), player = await joinRoom(room.roomId, 'Material player', 'material-player')
    const query = `?room=${room.roomId}`
    const baseCharacter = { ...normalizeCharacter({ id: 'material-hero', name: 'Material hero', charClass: '法师', level: 3, currentHp: 20, maxHp: 20 }), roomMemberId: player.member.memberId }
    const granted = applyDnd5eInventoryMutation([baseCharacter], { type: 'grant', characterId: baseCharacter.id, templateId: 'srd-5.1:item:gold-dust-25gp', quantity: 1 })
    expect(granted.ok).toBe(true)
    const owner = granted.characters[0]
    const map = { id: 'material-map', name: 'Materials', width: 100, height: 100, gridSize: 10, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
      tokens: [{ id: 'material-token', type: 'player' as const, characterId: owner.id, label: owner.name, x: 0, y: 0, hp: 20, maxHp: 20, color: '', emoji: '', size: 1 }] }
    const post = (id: string, writes: unknown[], member = room.member) => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ transactionId: id, writes }),
    })
    const read = async (name: string, member = room.member) => {
      const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(member) })
      expect(response.status).toBe(200)
      return { data: await response.json(), revision: Number(response.headers.get('x-stars-state-revision')) }
    }
    const seed = [
      { name: 'characters', expectedRevision: 0, data: { characters: [owner], selectedId: owner.id, updatedAt: 1 } },
      { name: 'maps', expectedRevision: 0, data: { maps: [map], selectedId: map.id, updatedAt: 1 } },
    ]
    expect((await post('material-seed', seed)).status).toBe(200)
    const originalCharacters = await read('characters'), originalMaps = await read('maps')
    const ledger = createDnd5eDamageReactionMaterialLedger({ 'material-token': owner })
    const plan = dnd5eSpellMaterialConsumptionPlan(owner, { label: 'Dust', options: [{ label: 'Dust', components: [{ tag: 'gold-dust', label: 'Dust', quantity: 1, consumed: true }] }] })!
    ledger.settle('reaction', 'material-token', plan)
    const application = mergeDnd5eReactionMaterialsIntoMapPlan({ map: { ...map, tokens: map.tokens.map(token => ({ ...token, hp: 18 })) },
      characters: [{ ...owner, currentHp: 18, classResources: { 'dnd5e-spell-slot-1': { current: 0, max: 2 } } }],
      changedCharacterIds: [owner.id], changedTokenIds: ['material-token'] }, ledger.finish())
    const writes = [
      { name: 'characters', expectedRevision: originalCharacters.revision, data: { characters: application.characters, selectedId: owner.id, updatedAt: 2 } },
      { name: 'maps', expectedRevision: originalMaps.revision, data: { maps: [application.map], selectedId: map.id, updatedAt: 2 } },
    ]
    expect((await post('material-stale', [writes[0], { ...writes[1], expectedRevision: 0 }])).status).toBe(409)
    expect(await read('characters')).toEqual(originalCharacters)
    expect(await read('maps')).toEqual(originalMaps)
    expect((await post('material-player-forged', writes, player.member)).status).toBe(403)
    expect(await read('characters')).toEqual(originalCharacters)
    const committed = await post('material-commit', writes)
    expect(committed.status, await committed.text()).toBe(200)
    const received = await read('characters', player.member)
    const hero = received.data.characters.find((character: { id: string }) => character.id === owner.id)
    expect(hero.currentHp).toBe(18)
    expect(hero.classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(hero.dnd5eInventory.entries.some((entry: { instanceId: string }) => entry.instanceId === plan.allocations[0].instanceId)).toBe(false)
    expect((await read('maps')).data.maps[0].tokens[0].hp).toBe(18)
    expect((await post('material-stale-retry', writes)).status).toBe(409)
    expect(await read('characters', player.member)).toEqual(received)
  })

  it('commits coupled resources together and writes none when any revision conflicts', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const transaction = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:first',
        writes: [
          { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 10 } },
          { name: 'maps', expectedRevision: 0, data: { maps: [{ id: 'map-1', name: '原始地图', tokens: [] }], selectedId: 'map-1', updatedAt: 10 } },
          { name: 'combat', expectedRevision: 0, data: { mapId: 'map-1', active: true, round: 1, initiativeIndex: 0, initiativeOrder: [], updatedAt: 10 } },
          { name: 'player-action-ack', expectedRevision: 0, data: { id: 'ack-1', mapId: 'map-1', actionId: 'action-1', status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 10 } },
        ],
      }),
    })
    expect(transaction.status).toBe(200)
    expect(await transaction.json()).toMatchObject({
      revisions: { characters: 1, maps: 1, combat: 1, 'player-action-ack': 1 },
    })

    const conflict = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:conflict',
        writes: [
          { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 20 } },
          { name: 'maps', expectedRevision: 1, data: { maps: [{ id: 'map-1', name: '不应写入', tokens: [] }], selectedId: 'map-1', updatedAt: 20 } },
        ],
      }),
    })
    expect(conflict.status).toBe(409)
    const mapsResponse = await fetch(`${base}/api/state/maps${query}`, { headers })
    expect(mapsResponse.headers.get('X-Stars-State-Revision')).toBe('1')
    expect(await mapsResponse.json()).toMatchObject({ maps: [{ name: '原始地图' }] })
  })

  it('atomically appends concurrent requests from different players', async () => {
    const room = await createRoom()
    const join = async (displayName: string, clientId: string) => {
      const response = await fetch(`${base}/api/rooms/${room.roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, clientId, activePlugins: [] }),
      })
      expect(response.status).toBe(200)
      return await response.json() as { member: { memberId: string; roomToken: string } }
    }
    const [first, second] = await Promise.all([
      join('玩家一', 'transaction-player-1'),
      join('玩家二', 'transaction-player-2'),
    ])
    const action = (id: string) => ({
      id,
      mapId: 'map-1',
      combatId: 'combat-1',
      sourceMode: 'dm',
      status: 'pending',
      type: 'end-turn',
      actorTokenId: `${id}-token`,
      characterId: `${id}-character`,
      round: 1,
      initiativeIndex: 0,
      seq: 1,
      updatedAt: Date.now(),
    })
    const append = (member: typeof first.member, id: string) => fetch(
      `${base}/api/state/player-action-requests/append?room=${room.roomId}`,
      { method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ action: action(id) }) },
    )
    const responses = await Promise.all([append(first.member, 'action-1'), append(second.member, 'action-2')])
    expect(responses.map((response) => response.status)).toEqual([200, 200])

    const queueResponse = await fetch(`${base}/api/state/player-action-requests?room=${room.roomId}`, {
      headers: memberHeaders(room.member),
    })
    expect(queueResponse.status).toBe(200)
    const queue = await queueResponse.json() as { requests: Array<{ id: string; sourceMode: string; roomMemberId: string }> }
    expect(queue.requests.map((request) => request.id).sort()).toEqual(['action-1', 'action-2'])
    expect(queue.requests.every((request) => request.sourceMode === 'player' && request.roomMemberId)).toBe(true)
  })

  it('serializes a legacy healing append with combat-command intake and retains both requests', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-healing-race-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const roomStateRoot = path.join(sharedRoot, 'state', 'rooms', room.roomId)
    const transactionLockPath = path.join(roomStateRoot, '.state-transaction.lock')
    await writeFile(transactionLockPath, 'test-held-room-transaction-lock', { flag: 'wx' })

    const healingAction = {
      id: 'healing-action-concurrent-with-move',
      mapId: 'map-command',
      combatId: 'combat-command',
      sourceMode: 'player',
      status: 'pending',
      type: 'dnd5e-spell-cast',
      actorTokenId: 'hero-token',
      characterId: 'hero',
      round: 1,
      initiativeIndex: 0,
      seq: 2,
      updatedAt: Date.now(),
    }
    let healingSettled = false
    let commandSettled = false
    const healingRequest = fetch(`${base}/api/state/player-action-requests/append${query}`, {
      method: 'POST',
      headers: memberHeaders(player.member),
      body: JSON.stringify({ action: healingAction }),
    }).then((response) => {
      healingSettled = true
      return response
    })
    const commandRequest = fetch(`${base}/api/combat/commands/move-command-1${query}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(moveCommand()),
    }).then((response) => {
      commandSettled = true
      return response
    })

    await new Promise((resolve) => setTimeout(resolve, 250))
    const healingWaitedForRoomTransaction = !healingSettled
    const commandWaitedForRoomTransaction = !commandSettled
    await rm(transactionLockPath, { force: true })

    const [healingResponse, commandResponse] = await Promise.all([healingRequest, commandRequest])
    expect(healingWaitedForRoomTransaction).toBe(true)
    expect(commandWaitedForRoomTransaction).toBe(true)
    expect(healingResponse.status).toBe(200)
    expect(commandResponse.status).toBe(202)

    const queueResponse = await fetch(`${base}/api/state/player-action-requests${query}`, {
      headers: memberHeaders(room.member),
    })
    expect(queueResponse.status).toBe(200)
    const queue = await queueResponse.json() as { requests: Array<{ id: string; type: string }> }
    expect(queue.requests.map((request) => request.id).sort()).toEqual([
      'healing-action-concurrent-with-move',
      'move-command-1',
    ])
  })

  it('recovers a prepared crash journal before accepting the next authority transaction', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const initial = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:journal-initial',
        writes: [
          { name: 'characters', expectedRevision: 0, data: { characters: [], selectedId: null, updatedAt: 10 } },
        ],
      }),
    })
    expect(initial.status).toBe(200)

    const roomStateRoot = path.join(sharedRoot, 'state', 'rooms', room.roomId)
    const charactersPath = path.join(roomStateRoot, 'characters.json')
    const currentBody = await readFile(charactersPath, 'utf8')
    await writeFile(charactersPath, JSON.stringify({
      characters: [{ id: 'partial-write-must-disappear' }],
      selectedId: null,
      updatedAt: 99,
      _sync: { schemaVersion: 1, revision: 2, writerId: 'crashed', writtenAt: 99 },
    }))
    await writeFile(path.join(roomStateRoot, '.state-transaction-journal.json'), JSON.stringify({
      schemaVersion: 1,
      state: 'prepared',
      transactionId: 'combat:test:crashed',
      entries: [{ name: 'characters', currentBody }],
    }))

    const recovered = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'combat:test:after-recovery',
        writes: [
          { name: 'characters', expectedRevision: 1, data: { characters: [], selectedId: null, updatedAt: 20 } },
        ],
      }),
    })
    expect(recovered.status).toBe(200)
    expect(await recovered.json()).toMatchObject({ revisions: { characters: 2 } })
    const stored = await fetch(`${base}/api/state/characters${query}`, { headers })
    expect(await stored.json()).toMatchObject({ characters: [], updatedAt: 20 })
  })

  it('appends simultaneous public and hidden dice events without losing either event', async () => {
    const room = await createRoom()
    const joinResponse = await fetch(`${base}/api/rooms/${room.roomId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: 'Player', clientId: 'dice-event-player', activePlugins: [] }),
    })
    expect(joinResponse.status).toBe(200)
    const player = await joinResponse.json() as { member: { memberId: string; roomToken: string } }
    const query = `?room=${room.roomId}`
    const event = (id: string, visibility: 'public' | 'dm') => ({
      operation: 'append',
      mapId: 'map-1',
      event: {
        id,
        mapId: 'map-1',
        sourceMode: 'dm',
        visibility,
        status: 'result',
        kind: 'd20',
        values: [12],
        updatedAt: Date.now(),
      },
    })
    const append = (member: { memberId: string; roomToken: string }, body: unknown) => fetch(
      `${base}/api/state/dice-events/append${query}`,
      { method: 'PATCH', headers: memberHeaders(member), body: JSON.stringify(body) },
    )
    const responses = await Promise.all([
      append(room.member, event('dm-hidden', 'dm')),
      append(player.member, event('player-public', 'dm')),
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])

    const dmView = await fetch(`${base}/api/state/dice-events${query}`, { headers: memberHeaders(room.member) })
    const dmState = await dmView.json() as { events: Array<{ id: string; visibility: string; sourceMode: string }> }
    expect(dmState.events.map((candidate) => candidate.id).sort()).toEqual(['dm-hidden', 'player-public'])
    expect(dmState.events.find((candidate) => candidate.id === 'player-public')).toMatchObject({
      visibility: 'public',
      sourceMode: 'player',
    })

    const playerView = await fetch(`${base}/api/state/dice-events${query}`, { headers: memberHeaders(player.member) })
    const playerState = await playerView.json() as { events: Array<{ id: string }> }
    expect(playerState.events.map((candidate) => candidate.id)).toEqual(['player-public'])
  })

  it('commits interaction journal effects with authoritative combat snapshots or writes neither', async () => {
    const room = await createRoom()
    const query = `?room=${room.roomId}`
    const headers = memberHeaders(room.member)
    const writeCharacters = (expectedRevision: number, updatedAt: number, receipt: string) => fetch(
      `${base}/api/state/transaction${query}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transactionId: `interaction:${receipt}`,
          writes: [{
            name: 'characters',
            expectedRevision,
            data: { characters: [], selectedId: null, updatedAt },
          }],
          roomJournalMutations: [{
            operation: 'add-shared-note',
            kind: 'task',
            title: '打开密门',
            body: '',
            authorityReceiptId: receipt,
          }],
        }),
      },
    )

    const initial = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        transactionId: 'interaction:initial',
        writes: [{
          name: 'characters',
          expectedRevision: 0,
          data: { characters: [], selectedId: null, updatedAt: 1 },
        }],
      }),
    })
    expect(initial.status).toBe(200)

    const conflict = await writeCharacters(0, 2, 'interaction-receipt-conflict')
    expect(conflict.status).toBe(409)
    const absentJournal = await fetch(`${base}/api/state/room-journal${query}`, { headers })
    expect(absentJournal.status).toBe(404)

    const committed = await writeCharacters(1, 3, 'interaction-receipt-success')
    expect(committed.status).toBe(200)
    expect(await committed.json()).toMatchObject({
      revisions: { characters: 2, 'room-journal': 1 },
    })
    const journal = await fetch(`${base}/api/state/room-journal${query}`, { headers })
    expect(journal.status).toBe(200)
    expect(await journal.json()).toMatchObject({
      sharedNotes: [expect.objectContaining({
        title: '打开密门',
        authorityReceiptId: 'interaction-receipt-success',
      })],
      authorityMutationReceipts: ['interaction-receipt-success'],
    })
  })

  it('persists one pending receipt and one queued action for duplicate command submissions', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-player-${room.roomId}`)
    await seedCommandCombat(room, player)
    const url = `${base}/api/combat/commands/move-command-1?room=${room.roomId}`
    const submit = () => fetch(url, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(moveCommand()),
    })
    const first = await submit()
    expect(first.status).toBe(202)
    expect(await first.json()).toMatchObject({
      replayed: false,
      receipt: { receiptId: 'move-command-1', commandId: 'move-command-1', commandType: 'move-token', status: 'pending' },
    })
    const retry = await submit()
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ replayed: true, receipt: { status: 'pending' } })

    const dmOverlapBody = moveCommand({ x: 35, y: 20 })
    dmOverlapBody.command.commandId = 'dm-cross-member-overlap'
    dmOverlapBody.command.seq = 2
    dmOverlapBody.command.issuedAt = 1_001
    const dmOverlap = await fetch(
      `${base}/api/combat/commands/dm-cross-member-overlap?room=${room.roomId}`,
      { method: 'PUT', headers: memberHeaders(room.member), body: JSON.stringify(dmOverlapBody) },
    )
    expect(dmOverlap.status).toBe(409)
    expect(await dmOverlap.json()).toMatchObject({
      error: 'combat-command-pending-conflict',
      receipt: { commandId: 'dm-cross-member-overlap', status: 'conflict' },
    })

    const stranger = await joinRoom(room.roomId, 'Stranger', `pending-stranger-${room.roomId}`)
    const strangerBody = moveCommand({ x: 36, y: 20 })
    strangerBody.command.commandId = 'unauthorized-pending-overlap'
    const unauthorizedOverlap = await fetch(
      `${base}/api/combat/commands/unauthorized-pending-overlap?room=${room.roomId}`,
      { method: 'PUT', headers: memberHeaders(stranger.member), body: JSON.stringify(strangerBody) },
    )
    expect(unauthorizedOverlap.status).toBe(403)
    expect(await unauthorizedOverlap.json()).toEqual({ error: 'combat-command-character-forbidden' })

    const overlappingBody = moveCommand({ x: 40, y: 20 })
    overlappingBody.command.commandId = 'move-command-2'
    overlappingBody.command.seq = 2
    overlappingBody.command.issuedAt = 1_001
    const overlappingUrl = `${base}/api/combat/commands/move-command-2?room=${room.roomId}`
    const overlapping = await fetch(overlappingUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(overlappingBody),
    })
    expect(overlapping.status).toBe(409)
    expect(await overlapping.json()).toMatchObject({
      error: 'combat-command-pending-conflict',
      receipt: { commandId: 'move-command-2', status: 'conflict' },
    })
    const overlappingRetry = await fetch(overlappingUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(overlappingBody),
    })
    expect(overlappingRetry.status).toBe(200)
    expect(await overlappingRetry.json()).toMatchObject({ replayed: true, receipt: { status: 'conflict' } })

    const queueResponse = await fetch(`${base}/api/state/player-action-requests?room=${room.roomId}`, {
      headers: memberHeaders(room.member),
    })
    const queue = await queueResponse.json() as {
      requests: Array<{
        id: string
        targetElevationFeet?: number
        dnd5eCarefulMovement?: boolean
        dnd5eStandFromProne?: boolean
        dnd5eTraversalMode?: string
      }>
    }
    expect(queue.requests.map((action) => action.id)).toEqual(['move-command-1'])
    expect(queue.requests[0]).toMatchObject({
      targetElevationFeet: 5,
      dnd5eCarefulMovement: true,
      dnd5eStandFromProne: false,
      dnd5eTraversalMode: 'climb',
    })

    const receiptResponse = await fetch(url, { headers: memberHeaders(player.member) })
    expect(receiptResponse.status).toBe(200)
    expect(await receiptResponse.json()).toMatchObject({ receipt: { commandId: 'move-command-1', status: 'pending' } })
  })

  it('rejects a move command that omits its starting elevation CAS value', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `missing-elevation-${room.roomId}`)
    await seedCommandCombat(room, player)
    const body = moveCommand()
    delete (body.command as { expectedElevationFeet?: number }).expectedElevationFeet

    const response = await fetch(`${base}/api/combat/commands/move-command-1?room=${room.roomId}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(body),
    })
    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: 'invalid-combat-command' })
  })

  it.each([
    ['the actor token', 'hero-token'],
    ['an unrelated token', 'other-token'],
  ])('keeps a move pending after an HP-only edit to %s', async (_label, editedTokenId) => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `hp-before-move-${editedTokenId}-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const hero = {
      id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
      x: 10, y: 20, hp: 10, maxHp: 10,
    }
    const other = {
      id: 'other-token', type: 'enemy', label: 'Other',
      x: 90, y: 90, hp: 10, maxHp: 10,
    }
    const baseline = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: `hp-before-move-baseline:${editedTokenId}`,
        writes: [
          {
            name: 'characters', expectedRevision: 1,
            data: {
              characters: [{
                id: 'hero', name: 'Hero', roomMemberId: player.member.memberId,
                currentHp: 10, maxHp: 10,
              }],
              selectedId: 'hero', updatedAt: 2,
            },
          },
          {
            name: 'maps', expectedRevision: 1,
            data: {
              maps: [{ id: 'map-command', name: 'Map', tokens: [hero, other] }],
              selectedId: 'map-command', updatedAt: 2,
            },
          },
        ],
      }),
    })
    expect(baseline.status).toBe(200)

    const editedHero = editedTokenId === 'hero-token' ? { ...hero, hp: 5 } : hero
    const editedOther = editedTokenId === 'other-token' ? { ...other, hp: 5 } : other
    const hpWrites = [
      {
        name: 'maps', expectedRevision: 2,
        data: {
          maps: [{ id: 'map-command', name: 'Map', tokens: [editedHero, editedOther] }],
          selectedId: 'map-command', updatedAt: 3,
        },
      },
      ...(editedTokenId === 'hero-token'
        ? [{
            name: 'characters', expectedRevision: 2,
            data: {
              characters: [{
                id: 'hero', name: 'Hero', roomMemberId: player.member.memberId,
                currentHp: 5, maxHp: 10,
              }],
              selectedId: 'hero', updatedAt: 3,
            },
          }]
        : []),
    ]
    const hpEdit = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: `hp-before-move-edit:${editedTokenId}`,
        writes: hpWrites,
      }),
    })
    expect(hpEdit.status).toBe(200)

    const body = moveCommand()
    body.command.expectedRevisions.maps = 2
    const response = await fetch(`${base}/api/combat/commands/move-command-1${query}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(body),
    })
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({
      receipt: { commandId: 'move-command-1', status: 'pending' },
    })

    const mapsResponse = await fetch(`${base}/api/state/maps${query}`, {
      headers: memberHeaders(room.member),
    })
    const mapsState = await mapsResponse.json() as {
      maps: Array<{ tokens: Array<{ id: string; hp?: number }> }>
    }
    expect(mapsState.maps[0].tokens.find((token) => token.id === editedTokenId)?.hp).toBe(5)
  })

  it.each([
    ['position', { x: 11, y: 20, elevationFeet: 0 }],
    ['elevation', { x: 10, y: 20, elevationFeet: 10 }],
  ])('rejects move intake when the actor %s changed despite an unrelated maps watermark', async (_label, actorState) => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `actor-cas-${_label}-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const actorChanged = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: `actor-cas:${_label}`,
        writes: [{
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [{
                id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                ...actorState,
              }],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        }],
      }),
    })
    expect(actorChanged.status).toBe(200)

    const response = await fetch(`${base}/api/combat/commands/move-command-1${query}`, {
      method: 'PUT',
      headers: memberHeaders(player.member),
      body: JSON.stringify(moveCommand()),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      error: 'combat-command-position-conflict',
      receipt: { status: 'conflict', reason: 'combat-command-position-conflict' },
    })
  })

  it('rejects a combat-command ACK when its durable receipt is missing', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `missing-receipt-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const receiptPath = path.join(
      sharedRoot,
      'state',
      'rooms',
      room.roomId,
      'combat-command-receipts.json',
    )
    const stored = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown> & {
      receipts: unknown[]
    }
    await writeFile(receiptPath, JSON.stringify({ ...stored, receipts: [] }))

    const settlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'missing-command-receipt-must-not-apply',
        writes: [
          {
            name: 'maps', expectedRevision: 1,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [{
                  id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                  x: 30, y: 20, elevationFeet: 5,
                }],
              }],
              selectedId: 'map-command', updatedAt: 2,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'ack-without-command-receipt', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 2,
            },
          },
        ],
      }),
    })
    expect(settlement.status).toBe(409)
    expect(await settlement.json()).toMatchObject({
      error: 'combat-command-settlement-conflict',
      receipt: {
        commandId: 'move-command-1', status: 'conflict', reason: 'combat-command-receipt-missing',
      },
    })
    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(await maps.json()).toMatchObject({ maps: [{ tokens: [{ x: 10, y: 20 }] }] })
    const ack = await fetch(`${base}/api/state/player-action-ack${query}`, { headers: memberHeaders(room.member) })
    expect(ack.status).toBe(404)
  })

  it('rejects a combat-command ACK when its immutable command record is missing', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `missing-record-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const receiptPath = path.join(
      sharedRoot,
      'state',
      'rooms',
      room.roomId,
      'combat-command-receipts.json',
    )
    const stored = JSON.parse(await readFile(receiptPath, 'utf8')) as Record<string, unknown> & {
      commands: unknown[]
    }
    await writeFile(receiptPath, JSON.stringify({ ...stored, commands: [] }))

    const settlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'missing-command-record-must-not-apply',
        writes: [
          {
            name: 'maps', expectedRevision: 1,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [{
                  id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                  x: 30, y: 20, elevationFeet: 5,
                }],
              }],
              selectedId: 'map-command', updatedAt: 2,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'ack-without-command-record', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 2,
            },
          },
        ],
      }),
    })
    expect(settlement.status).toBe(409)
    expect(await settlement.json()).toMatchObject({
      error: 'combat-command-settlement-precondition-conflict',
      receipt: {
        commandId: 'move-command-1', status: 'conflict', reason: 'combat-command-record-missing',
      },
    })
    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(await maps.json()).toMatchObject({ maps: [{ tokens: [{ x: 10, y: 20 }] }] })
  })

  it('rejects command-id payload conflicts, stale combat identity, and another player acting for the current character', async () => {
    const room = await createRoom()
    const owner = await joinRoom(room.roomId, 'Owner', `command-owner-${room.roomId}`)
    const stranger = await joinRoom(room.roomId, 'Stranger', `command-stranger-${room.roomId}`)
    await seedCommandCombat(room, owner)
    await setActiveCharacter(room.roomId, stranger.member, 'hero')
    const forbiddenBody = moveCommand()
    forbiddenBody.command.commandId = 'forbidden-command'
    const forbiddenUrl = `${base}/api/combat/commands/forbidden-command?room=${room.roomId}`

    const forgedDmCommand = moveCommand()
    forgedDmCommand.command.commandId = 'dm-forged.actor'
    forgedDmCommand.command.characterId = 'forged-character'
    const forgedDm = await fetch(`${base}/api/combat/commands/dm-forged.actor?room=${room.roomId}`, {
      method: 'PUT', headers: memberHeaders(room.member), body: JSON.stringify(forgedDmCommand),
    })
    expect(forgedDm.status).toBe(409)
    expect(await forgedDm.json()).toMatchObject({
      error: 'combat-command-character-mismatch',
      receipt: { commandId: 'dm-forged.actor', status: 'conflict' },
    })

    const forbidden = await fetch(forbiddenUrl, {
      method: 'PUT', headers: memberHeaders(stranger.member), body: JSON.stringify(forbiddenBody),
    })
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toEqual({ error: 'combat-command-character-forbidden' })

    const staleBody = moveCommand()
    staleBody.command.commandId = 'stale-command'
    // A coarse revision mismatch is tolerated, but a different round is an
    // authoritative semantic conflict. The first terminal receipt must still
    // win even after unrelated combat state advances.
    staleBody.command.expectedRevisions.combat = 2
    staleBody.command.round = 2
    const staleUrl = `${base}/api/combat/commands/stale-command?room=${room.roomId}`
    const stale = await fetch(staleUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(staleBody),
    })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({
      error: 'combat-command-entity-conflict',
      receipt: { commandId: 'stale-command', commandType: 'move-token', status: 'conflict' },
    })
    const advanceCombat = await fetch(`${base}/api/state/transaction?room=${room.roomId}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'advance.combat-for-tombstone',
        writes: [{
          name: 'combat', expectedRevision: 1,
          data: {
            mapId: 'map-command', combatId: 'combat-command', active: true,
            round: 1, initiativeIndex: 0,
            initiativeOrder: [{ tokenId: 'hero-token', slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20 }],
            updatedAt: 2,
          },
        }],
      }),
    })
    expect(advanceCombat.status).toBe(200)
    const staleRetry = await fetch(staleUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(staleBody),
    })
    expect(staleRetry.status).toBe(200)
    expect(await staleRetry.json()).toMatchObject({ replayed: true, receipt: { status: 'conflict' } })
    const repairedSameId = moveCommand({ x: 35, y: 20 })
    repairedSameId.command.commandId = 'stale-command'
    repairedSameId.command.expectedRevisions.combat = 2
    const repaired = await fetch(staleUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(repairedSameId),
    })
    expect(repaired.status).toBe(409)
    expect(await repaired.json()).toMatchObject({ error: 'combat-command-idempotency-conflict' })

    const validBody = moveCommand()
    validBody.command.commandId = 'valid-command'
    validBody.command.expectedRevisions.combat = 999
    const validUrl = `${base}/api/combat/commands/valid-command?room=${room.roomId}`
    const accepted = await fetch(validUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(validBody),
    })
    expect(accepted.status).toBe(202)
    const changedBody = moveCommand({ x: 40, y: 20 })
    changedBody.command.commandId = 'valid-command'
    changedBody.command.expectedRevisions.combat = 2
    const changed = await fetch(validUrl, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(changedBody),
    })
    expect(changed.status).toBe(409)
    expect(await changed.json()).toMatchObject({
      error: 'combat-command-idempotency-conflict',
      receipt: { commandId: 'valid-command', status: 'conflict' },
    })
  })

  it('does not let an unauthorized player reserve a command id before its legitimate owner', async () => {
    const room = await createRoom()
    const owner = await joinRoom(room.roomId, 'Owner', `command-auth-owner-${room.roomId}`)
    const stranger = await joinRoom(room.roomId, 'Stranger', `command-auth-stranger-${room.roomId}`)
    await seedCommandCombat(room, owner)
    const commandId = 'owner-command-after-forbidden'
    const body = moveCommand()
    body.command.commandId = commandId
    const url = `${base}/api/combat/commands/${commandId}?room=${room.roomId}`

    const forbidden = await fetch(url, {
      method: 'PUT', headers: memberHeaders(stranger.member), body: JSON.stringify(body),
    })
    expect(forbidden.status).toBe(403)
    expect(await forbidden.json()).toEqual({ error: 'combat-command-character-forbidden' })

    const accepted = await fetch(url, {
      method: 'PUT', headers: memberHeaders(owner.member), body: JSON.stringify(body),
    })
    expect(accepted.status).toBe(202)
    expect(await accepted.json()).toMatchObject({
      replayed: false,
      receipt: { commandId, status: 'pending' },
    })
  })

  it('queues end-turn through the same idempotent receipt channel', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-end-turn-${room.roomId}`)
    await seedCommandCombat(room, player)
    const commandId = 'end-turn:command.1'
    const url = `${base}/api/combat/commands/${encodeURIComponent(commandId)}?room=${room.roomId}`
    const body = {
      schemaVersion: 1,
      command: {
        schemaVersion: 1,
        commandId,
        issuedAt: 2_000,
        type: 'end-turn',
        mapId: 'map-command',
        combatId: 'combat-command',
        actorTokenId: 'hero-token',
        characterId: 'hero',
        round: 1,
        initiativeIndex: 0,
        seq: 2,
        expectedRevisions: { combat: 1 },
      },
    }
    const first = await fetch(url, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(body),
    })
    expect(first.status).toBe(202)
    expect(await first.json()).toMatchObject({
      receipt: { receiptId: commandId, commandId, commandType: 'end-turn', status: 'pending' },
    })
    const retry = await fetch(url, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(body),
    })
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ replayed: true, receipt: { status: 'pending' } })
  })

  it('atomically settles a command receipt and replays the same DM transaction after a lost response', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-settle-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const charactersBeforeResponse = await fetch(`${base}/api/state/characters${query}`, { headers: memberHeaders(room.member) })
    expect(charactersBeforeResponse.status).toBe(200)
    const charactersRevision = Number(charactersBeforeResponse.headers.get('X-Stars-State-Revision'))
    const charactersBefore = await charactersBeforeResponse.json()
    const charactersAfter = { ...charactersBefore, characters: charactersBefore.characters.map((character: { id: string; dnd5eCombatState?: object }) =>
      character.id === 'hero' ? { ...character, dnd5eCombatState: { ...character.dnd5eCombatState,
        declarativeUsedTurnKeys: { 'synthetic-move-use': 'combat-command:1:hero-token' } } } : character) }

    const settlement = {
      transactionId: 'settle:move-command-1',
      writes: [
        { name: 'characters', expectedRevision: charactersRevision, data: charactersAfter },
        {
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [{
                id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                x: 30, y: 20, elevationFeet: 5,
              }],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        },
        {
          name: 'player-action-ack', expectedRevision: 0,
          data: {
            id: 'ack-move-command-1', mapId: 'map-command', combatId: 'combat-command',
            actionId: 'move-command-1', recipientMemberId: player.member.memberId,
            status: 'accepted', acceptedPosition: { x: 30, y: 20 }, acceptedElevationFeet: 5,
            round: 1, initiativeIndex: 0, updatedAt: 2,
          },
        },
      ],
    }
    const settle = () => fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member), body: JSON.stringify(settlement),
    })
    const first = await settle()
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({
      receipt: {
        commandId: 'move-command-1', commandType: 'move-token', status: 'committed',
        authoritative: {
          mapId: 'map-command', combatId: 'combat-command', acceptedPosition: { x: 30, y: 20 },
          acceptedElevationFeet: 5,
          revisions: { maps: 2, 'player-action-ack': 1 },
        },
      },
    })

    const retry = await settle()
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ replayed: true, revisions: { maps: 2, 'player-action-ack': 1 } })
    const playerCharacters = await fetch(`${base}/api/state/characters${query}`, { headers: memberHeaders(player.member) })
    expect(playerCharacters.status).toBe(200)
    expect(Number(playerCharacters.headers.get('X-Stars-State-Revision'))).toBe(charactersRevision + 1)
    expect((await playerCharacters.json()).characters.find((character: { id: string }) => character.id === 'hero'))
      .toMatchObject({ dnd5eCombatState: { declarativeUsedTurnKeys: { 'synthetic-move-use': 'combat-command:1:hero-token' } } })
    const commandRetry = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(commandRetry.status).toBe(200)
    expect(await commandRetry.json()).toMatchObject({
      replayed: true,
      receipt: { status: 'committed', authoritative: { revisions: { maps: 2, 'player-action-ack': 1 } } },
    })
    const terminalGet = await fetch(commandUrl, { headers: memberHeaders(player.member) })
    expect(terminalGet.status).toBe(200)
    expect(await terminalGet.json()).toMatchObject({ receipt: { status: 'committed' } })
    const continuationBody = moveCommand({ x: 40, y: 20 })
    continuationBody.command.commandId = 'move-command-continuation'
    continuationBody.command.issuedAt = 2_000
    continuationBody.command.seq = 2
    continuationBody.command.expectedPosition = { x: 30, y: 20 }
    continuationBody.command.expectedElevationFeet = 5
    continuationBody.command.expectedRevisions.maps = 2
    const continuation = await fetch(
      `${base}/api/combat/commands/move-command-continuation${query}`,
      { method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(continuationBody) },
    )
    expect(continuation.status).toBe(202)
    expect(await continuation.json()).toMatchObject({ receipt: { status: 'pending' } })
    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(maps.headers.get('X-Stars-State-Revision')).toBe('2')
    expect(await maps.json()).toMatchObject({ maps: [{ tokens: [{ x: 30, y: 20, elevationFeet: 5 }] }] })
  })

  it('terminalizes a settlement when only the authoritative elevation changed', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-stale-settle-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const movedByAnotherAuthority = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'move-before-command-settlement',
        writes: [{
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [{
                id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                x: 10, y: 20, elevationFeet: 10,
              }],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        }],
      }),
    })
    expect(movedByAnotherAuthority.status).toBe(200)

    const staleSettlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST',
      headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'stale-settlement-must-not-apply',
        writes: [
          {
            name: 'maps', expectedRevision: 2,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [{
                  id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                  x: 30, y: 20, elevationFeet: 5,
                }],
              }],
              selectedId: 'map-command', updatedAt: 3,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'stale-ack', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', acceptedPosition: { x: 30, y: 20 }, acceptedElevationFeet: 5,
              round: 1, initiativeIndex: 0, updatedAt: 3,
            },
          },
        ],
      }),
    })
    expect(staleSettlement.status).toBe(409)
    expect(await staleSettlement.json()).toMatchObject({
      error: 'combat-command-settlement-precondition-conflict',
      receipt: {
        commandId: 'move-command-1', status: 'conflict', reason: 'combat-command-position-conflict',
      },
    })

    const maps = await fetch(`${base}/api/state/maps${query}`, { headers: memberHeaders(room.member) })
    expect(maps.headers.get('X-Stars-State-Revision')).toBe('2')
    expect(await maps.json()).toMatchObject({
      maps: [{ tokens: [{ x: 10, y: 20, elevationFeet: 10 }] }],
    })
    const ack = await fetch(`${base}/api/state/player-action-ack${query}`, { headers: memberHeaders(room.member) })
    expect(ack.status).toBe(404)
    const queue = await fetch(`${base}/api/state/player-action-requests${query}`, {
      headers: memberHeaders(room.member),
    })
    expect(await queue.json()).toMatchObject({ requests: [] })
    const receipt = await fetch(commandUrl, { headers: memberHeaders(player.member) })
    expect(await receipt.json()).toMatchObject({
      receipt: { status: 'conflict', reason: 'combat-command-position-conflict' },
    })
  })

  it('does not reject settlement only because an unrelated map edit advanced the command revision', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-unrelated-edit-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandUrl = `${base}/api/combat/commands/move-command-1${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member), body: JSON.stringify(moveCommand()),
    })
    expect(submitted.status).toBe(202)

    const unrelatedEdit = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'unrelated-map-edit-before-settlement',
        writes: [{
          name: 'maps', expectedRevision: 1,
          data: {
            maps: [{
              id: 'map-command', name: 'Map',
              tokens: [
                { id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero', x: 10, y: 20 },
                { id: 'scenery-token', type: 'enemy', label: 'Scenery', x: 90, y: 90 },
              ],
            }],
            selectedId: 'map-command', updatedAt: 2,
          },
        }],
      }),
    })
    expect(unrelatedEdit.status).toBe(200)

    const settled = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'settle-after-unrelated-map-edit',
        writes: [
          {
            name: 'maps', expectedRevision: 2,
            data: {
              maps: [{
                id: 'map-command', name: 'Map',
                tokens: [
                  {
                    id: 'hero-token', type: 'player', characterId: 'hero', label: 'Hero',
                    x: 30, y: 20, elevationFeet: 5,
                  },
                  { id: 'scenery-token', type: 'enemy', label: 'Scenery', x: 90, y: 90 },
                ],
              }],
              selectedId: 'map-command', updatedAt: 3,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'ack-after-unrelated-edit', mapId: 'map-command', combatId: 'combat-command',
              actionId: 'move-command-1', recipientMemberId: player.member.memberId,
              status: 'accepted', round: 1, initiativeIndex: 0, updatedAt: 3,
            },
          },
        ],
      }),
    })
    expect(settled.status).toBe(200)
    expect(await settled.json()).toMatchObject({
      receipt: {
        status: 'committed',
        authoritative: {
          acceptedPosition: { x: 30, y: 20 },
          acceptedElevationFeet: 5,
        },
      },
    })
  })

  it('revalidates the active turn before settling an end-turn command', async () => {
    const room = await createRoom()
    const player = await joinRoom(room.roomId, 'Player', `command-stale-end-${room.roomId}`)
    await seedCommandCombat(room, player)
    const query = `?room=${room.roomId}`
    const commandId = 'stale-end-turn-command'
    const commandUrl = `${base}/api/combat/commands/${commandId}${query}`
    const submitted = await fetch(commandUrl, {
      method: 'PUT', headers: memberHeaders(player.member),
      body: JSON.stringify({
        schemaVersion: 1,
        command: {
          schemaVersion: 1, commandId, issuedAt: 1_000, type: 'end-turn',
          mapId: 'map-command', combatId: 'combat-command', actorTokenId: 'hero-token',
          characterId: 'hero', round: 1, initiativeIndex: 0, seq: 1,
          expectedRevisions: { combat: 1 },
        },
      }),
    })
    expect(submitted.status).toBe(202)

    const advanced = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'advance-before-end-turn-settlement',
        writes: [{
          name: 'combat', expectedRevision: 1,
          data: {
            mapId: 'map-command', combatId: 'combat-command', active: true,
            round: 2, initiativeIndex: 0,
            initiativeOrder: [{
              tokenId: 'hero-token', slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20,
            }],
            updatedAt: 2,
          },
        }],
      }),
    })
    expect(advanced.status).toBe(200)

    const staleSettlement = await fetch(`${base}/api/state/transaction${query}`, {
      method: 'POST', headers: memberHeaders(room.member),
      body: JSON.stringify({
        transactionId: 'stale-end-turn-settlement',
        writes: [
          {
            name: 'combat', expectedRevision: 2,
            data: {
              mapId: 'map-command', combatId: 'combat-command', active: true,
              round: 3, initiativeIndex: 0,
              initiativeOrder: [{
                tokenId: 'hero-token', slotId: 'slot-hero', label: 'Hero', emoji: '', color: '', roll: 20,
              }],
              updatedAt: 3,
            },
          },
          {
            name: 'player-action-ack', expectedRevision: 0,
            data: {
              id: 'stale-end-ack', mapId: 'map-command', combatId: 'combat-command',
              actionId: commandId, recipientMemberId: player.member.memberId,
              status: 'accepted', round: 3, initiativeIndex: 0, updatedAt: 3,
            },
          },
        ],
      }),
    })
    expect(staleSettlement.status).toBe(409)
    expect(await staleSettlement.json()).toMatchObject({
      error: 'combat-command-settlement-precondition-conflict',
      receipt: { status: 'conflict', reason: 'combat-command-entity-conflict' },
    })
    const combat = await fetch(`${base}/api/state/combat${query}`, { headers: memberHeaders(room.member) })
    expect(await combat.json()).toMatchObject({ round: 2, initiativeIndex: 0 })
    const queue = await fetch(`${base}/api/state/player-action-requests${query}`, {
      headers: memberHeaders(room.member),
    })
    expect(await queue.json()).toMatchObject({ requests: [] })
  })
})

it('publishes short-rest dice, HP and receipts atomically and recovers a lost response', async () => {
  const room = await createRoom(), player = await joinRoom(room.roomId, 'Rest player', 'rest-player')
  const authority = shortRestRecoveryFixture()
  authority.characters[0].roomMemberId = player.member.memberId
  const query = `?room=${room.roomId}`
  const post = (transactionId: string, writes: unknown[], member = room.member, readRevisions = {}) => fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ transactionId, writes, readRevisions }),
  })
  const read = async (name: string) => {
    const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
    return { data: await response.json(), revision: Number(response.headers.get('X-Stars-State-Revision')) }
  }
  const initialWrites = [
    { name: 'characters', expectedRevision: 0, data: { characters: authority.characters, selectedId: 'hero', updatedAt: 1 } },
    { name: 'maps', expectedRevision: 0, data: { maps: [authority.map], selectedId: authority.map.id, updatedAt: 1 } },
    { name: 'dnd5e-rest-recovery', expectedRevision: 0, data: authority.journal },
    { name: 'campaign-time', expectedRevision: 0, data: { schemaVersion: 2, worldMinute: authority.worldMinute,
      displayMode: 'campaign-day', displayMinuteOffset: 0, timers: [], advances: authority.advances, updatedAt: 1 } },
  ]
  const seed = await post('rest-seed', initialWrites)
  expect(seed.status, await seed.clone().text()).toBe(200)
  const chars = await read('characters'), maps = await read('maps'), journal = await read('dnd5e-rest-recovery'), clock = await read('campaign-time')
  const publishInput: Parameters<typeof publishDnd5eShortRestRecovery>[0] = {
    authority, maps: [authority.map], updatedAt: 2,
    expectedRevisions: { characters: chars.revision, maps: maps.revision, 'dnd5e-rest-recovery': journal.revision },
    readRevisions: { 'campaign-time': clock.revision, combat: 0, 'map-geometry': 0 },
    gateway: { loadResource: async name => (await read(name)).data, saveResourcesAtomically: async (writes, options) => {
      const response = await post('rest-publish', [...writes], room.member, options?.readRevisions)
      if (response.status === 409) throw Error('shared-state-transaction-conflict:maps')
      expect(response.status, await response.clone().text()).toBe(200)
      throw Error('Failed to fetch')
    } },
  }
  const changed = await post('edit-map', [{ name: 'maps', expectedRevision: maps.revision, data: { ...maps.data, updatedAt: 2 } }])
  expect(changed.status).toBe(200)
  await expect(publishDnd5eShortRestRecovery(publishInput)).rejects.toThrow('transaction-conflict')
  expect(await read('characters')).toEqual(chars)
  expect(await read('dnd5e-rest-recovery')).toEqual(journal)
  // Re-plan from the actual new map snapshot, not just a newer revision watermark.
  const refreshed = await read('maps')
  publishInput.maps = refreshed.data.maps
  publishInput.authority = { ...authority, map: refreshed.data.maps[0] }
  publishInput.expectedRevisions = { ...publishInput.expectedRevisions, maps: refreshed.revision }
  const result = await publishDnd5eShortRestRecovery(publishInput)
  expect(result.recovered).toBe(true)
  const committed = await read('characters'), saved = await read('dnd5e-rest-recovery')
  expect(committed.data.characters[0]).toMatchObject({ currentHp: 19, hitPointDice: [{ current: 2 }] })
  expect((await read('maps')).data.maps[0].tokens[0].hp).toBe(19)
  expect(saved.data.receipts).toHaveLength(1)
  const forged = await post('forged-rest', [{ name: 'dnd5e-rest-recovery', expectedRevision: saved.revision, data: { schemaVersion: 1, receipts: [] } }], player.member)
  expect(forged.status).toBe(403)
  const corrupt = await post('corrupt-rest', [{ name: 'characters', expectedRevision: committed.revision, data: chars.data },
    { name: 'dnd5e-rest-recovery', expectedRevision: saved.revision, data: { schemaVersion: 1, receipts: [...saved.data.receipts, ...saved.data.receipts] } }])
  expect(corrupt.status).toBe(422)
  expect(await read('characters')).toEqual(committed)
  expect(await read('dnd5e-rest-recovery')).toEqual(saved)
  const roomSpy = vi.spyOn(roomSessionModule, 'getRoomSession').mockReturnValue({ roomId: room.roomId, role: 'dm' } as ReturnType<typeof roomSessionModule.getRoomSession>)
  const readSpy = vi.spyOn(browserResources, 'loadSharedResource').mockImplementation(async <T,>(name: string) => {
    if (name === 'combat' || name === 'map-geometry') return null
    return (await read(name)).data as T
  })
  const saveSpy = vi.spyOn(browserResources, 'saveSharedResourcesAtomically').mockImplementation(async (writes, options) => {
    const response = await post(options?.transactionId ?? 'controller-rest', [...writes], room.member, options?.readRevisions)
    expect(response.status, await response.clone().text()).toBe(200)
    return await response.json()
  })
  try {
    const command = { ...authority.command, id: 'controller-rest', expectedPoolCurrent: 2, songOfRestBardId: undefined }
    const roll = vi.fn(async () => 1), confirmSong = vi.fn(async () => true)
    await expect(runShortRestRecovery({ command, authenticatedMemberId: 'other-player', roll, confirmSong })).rejects.toThrow('character-owner-mismatch')
    expect(roll).not.toHaveBeenCalled()
    const accepted = await runShortRestRecovery({ command, authenticatedMemberId: player.member.memberId, roll, confirmSong })
    expect(accepted.settled).toMatchObject({ ok: true, character: { currentHp: 31 } })
    expect((await read('characters')).data.characters[0].hitPointDice[0].current).toBe(1)
    expect(roll).toHaveBeenCalledTimes(1)
    const replayed = await runShortRestRecovery({ command, authenticatedMemberId: player.member.memberId, roll, confirmSong })
    expect(replayed.settled).toMatchObject({ ok: true, deduplicated: true })
    expect(roll).toHaveBeenCalledTimes(1)
    expect(saveSpy).toHaveBeenCalledTimes(1)
  } finally { roomSpy.mockRestore(); readSpy.mockRestore(); saveSpy.mockRestore() }
})

it.each(['choice-reroll', 'stored-d20'] as const)('commits %s costs and completion in one real HTTP transaction and recovers lost replies', async (mode) => {
  const room = await createRoom(), player = await joinRoom(room.roomId, 'Reroll player', 'reroll-player')
  const hero = shortRestRecoveryFixture().characters[0]
  hero.roomMemberId = player.member.memberId
  hero.inspiration = 1
  const prompt = createD20RollConfirmationInterrupt({ mapId: 'map', rollId: 'http-reroll', label: 'Reroll', originalValue: 4,
    eligibleModifiers: [{ characterId: hero.id, featureId: 'inspiration', featureLabel: 'Inspiration', modifierKind: 'choice-reroll',
      rerollScope: 'self-roll', additionalDice: 1, selectionPolicy: 'highest', resourceCosts: [{ resourceKey: 'dnd5e-core-inspiration', amount: 1 }] }] })
  let contribution = createD20ChoiceRerollContribution({ interruptId: prompt.id, characterId: hero.id, characterName: hero.name,
    featureId: 'inspiration', featureLabel: 'Inspiration', decision: 'use' })
  prompt.contributions = [contribution]
  prompt.payload.rollOptions = { contributionId: contribution.id, values: [4, 17] }
  const pluginId = 'test.http-stored', subclassId = `${pluginId}:diviner`, featureId = `${subclassId}.portent`
  if (mode === 'stored-d20') {
    hero.charClass = '法师'
    hero.level = 5
    hero.dnd5eClassLevels = { wizard: 5 }
    hero.dnd5eClassChoices = { classes: { wizard: { subclass: subclassId } } }
    hero.dnd5eCombatState = { ...hero.dnd5eCombatState, declarativeStoredD20ByFeatureId: { [featureId]: [7, 7, 12] } }
    prompt.payload.eligibleModifiers = [{ characterId: hero.id, featureId, featureLabel: 'Stored die', modifierKind: 'replace-d20', replacementValues: [7, 7, 12] }]
    delete prompt.payload.rollOptions
    contribution = createD20ReplacementContribution({ interruptId: prompt.id, characterId: hero.id, characterName: hero.name,
      featureId, featureLabel: 'Stored die', replacementValue: 7 })
    prompt.contributions = [contribution]
  }
  const query = `?room=${room.roomId}`
  const post = (transactionId: string, writes: unknown[], member = room.member) => fetch(`${base}/api/state/transaction${query}`, {
    method: 'POST', headers: memberHeaders(member), body: JSON.stringify({ transactionId, writes }),
  })
  const read = async <T,>(name: string): Promise<T> => {
    const response = await fetch(`${base}/api/state/${name}${query}`, { headers: memberHeaders(room.member) })
    expect(response.status).toBe(200)
    return await response.json() as T
  }
  const seeded = await post('reroll-seed', [
    { name: 'characters', expectedRevision: 0, data: { characters: [hero], selectedId: hero.id, updatedAt: 1 } },
    { name: 'combat-interrupts', expectedRevision: 0, data: { mapId: 'map', interrupts: [prompt], updatedAt: 1 } },
  ])
  expect(seeded.status, await seeded.clone().text()).toBe(200)
  const roomSpy = vi.spyOn(roomSessionModule, 'getRoomSession').mockReturnValue({ roomId: room.roomId, memberId: room.member.memberId, role: 'dm' } as ReturnType<typeof roomSessionModule.getRoomSession>)
  let conflict = true
  let saves = 0
  const gateway: NonNullable<Parameters<typeof commitD20ChoiceReroll>[1]> = { loadResource: read,
    saveResourcesAtomically: async (writes, options) => {
      saves++
      if (conflict) {
        const before = await read<any>('characters')
        const bumped = await post('reroll-concurrent-edit', [{ name: 'characters', expectedRevision: before._sync.revision,
          data: { ...before, updatedAt: Date.now() } }])
        expect(bumped.status).toBe(200)
      }
      const response = await post(options!.transactionId!, [...writes])
      if (response.status === 409) throw Error('state-transaction-conflict')
      expect(response.status, await response.clone().text()).toBe(200)
      throw Error('Failed to fetch')
    } }
  const input = { mapId: 'map', interruptId: prompt.id, acceptedContributionId: contribution.id }
  const dispose = mode === 'stored-d20' ? registerDnd5eRulesPlugin({ manifest: { id: pluginId, name: 'Stored d20 HTTP fixture', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'diviner', classId: 'wizard', name: 'Diviner', summary: 'Synthetic', abilities: [{
      schemaVersion: 1, id: 'portent', name: 'Stored die', description: 'Synthetic', level: 2,
      trigger: { kind: 'long-rest-complete' }, targeting: { kind: 'self' }, effects: [],
      mechanic: { kind: 'stored-d20-replacement', count: 3 }, canModifyEnemyD20: true, automation: 'full',
    }] })
  } }) : () => {}
  const expectResources = (actor: typeof hero, consumed: boolean) => {
    expect(actor.inspiration).toBe(mode === 'choice-reroll' && consumed ? 0 : 1)
    if (mode === 'stored-d20') expect(actor.dnd5eCombatState?.declarativeStoredD20ByFeatureId?.[featureId]).toEqual(consumed ? [7, 12] : [7, 7, 12])
  }
  try {
    await expect(commitD20ChoiceReroll(input, gateway)).rejects.toThrow('conflict')
    expectResources((await read<any>('characters')).characters[0], false)
    expect((await read<any>('combat-interrupts')).interrupts[0].status).not.toBe('done')
    conflict = false
    const result = await commitD20ChoiceReroll(input, gateway)
    expect(result.finalValue).toBe(mode === 'stored-d20' ? 7 : 17)
    const committedCharacters = await read<any>('characters'), committedQueue = await read<any>('combat-interrupts')
    expectResources(committedCharacters.characters[0], true)
    const serializedResult = JSON.parse(JSON.stringify(result))
    expect(committedQueue.interrupts[0]).toMatchObject({ status: 'done', response: serializedResult })
    expect(await commitD20ChoiceReroll(input, { ...gateway })).toEqual(serializedResult)
    expect(saves).toBe(2)
    const forged = await post('player-forged-completion', [
      { name: 'characters', expectedRevision: committedCharacters._sync.revision, data: committedCharacters },
      { name: 'combat-interrupts', expectedRevision: committedQueue._sync.revision, data: committedQueue },
    ], player.member)
    expect(forged.status).toBe(403)
    expectResources((await read<any>('characters')).characters[0], true)
  } finally { roomSpy.mockRestore(); dispose() }
})



