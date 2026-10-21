import { expect, it } from 'vitest'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import { planDnd5eMapObjectFlight } from './mapObjectFlight'
import { applyDnd5eActivityMapHandoffsV1 } from './activities/dnd5eActivityMapInteraction'
import type { Dnd5eActivityDefinitionV1 } from './activities/dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../store/characters'
import { createDnd5eConditionEffect } from './activeEffects'
import { bindDnd5eAreaRestraints } from './bindAreaRestraints'
import { normalizeDnd5eMapObjectStateV1 } from './mapObjectState'

const limits = { minimumWeightPounds: 1, maximumWeightPounds: 5, additionalWeightPoundsPerSlot: 5, baseSlotLevel: 1, distanceFeet: 90 }
const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'launch', name: 'Launch', activation: { kind: 'action' },
  automation: automationCapabilityFromLegacyStatus('full'),
  target: { kind: 'area', origin: 'point', shape: 'rect', widthFeet: 5, lengthFeet: 5, rotatable: true, relation: 'any' }, outcomes: [] }
const fixture = (spell = 'wall-of-stone'): BattleMap => ({ id: 'impact-map', name: 'Impact', width: 2000, height: 1000,
  gridSize: 50, feetPerCell: 5, gridOffsetX: 0, gridOffsetY: 0, showGrid: true,
  tokens: [{ id: 'caster', label: 'Caster', type: 'player', x: 25, y: 225, size: 1, emoji: '', color: '#fff' },
    { id: 'stone', label: 'Stone', type: 'obstacle', x: 25, y: 75, size: 1, emoji: '', color: '#fff', hp: 20, maxHp: 20,
      dnd5eObjectState: { schemaVersion: 1, weightPounds: 5 } }],
  dnd5ePluginAreas: [{ id: 'wall', label: 'Wall', color: '#fff', pluginId: 'test.wall', featureId: 'wall', sourceKind: 'core-spell', coreSpellId: spell,
    sourceCharacterId: 'caster', sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 100, anchorCell: { col: 4, row: 1 },
    cells: [{ col: 4, row: 1 }, { col: 8, row: 1 }], blocking: { movement: true, vision: true, lineOfEffect: true },
    vertical: { mode: 'volume', baseElevationFeet: 0, heightFeet: 10 },
    stoneWall: { mode: spell === 'wall-of-ice' ? 'ice' : 'thick', saveDc: 15, panels: [
      { id: 'far', start: { col: 8, row: 0 }, end: { col: 8, row: 2 }, cells: [{ col: 8, row: 1 }], hitPoints: 30, maxHitPoints: 30 },
      { id: 'near', start: { col: 4, row: 0 }, end: { col: 4, row: 2 }, cells: [{ col: 4, row: 1 }], hitPoints: 6, maxHitPoints: 30 },
    ] } } as Dnd5ePluginArea] })
const handoff = (map: BattleMap, amount = 6, characters: Parameters<typeof applyDnd5eActivityMapHandoffsV1>[0]['characters'] = [], pitch = 0) => applyDnd5eActivityMapHandoffsV1({ map, characters, activity, packageId: 'test.launch', actionId: 'launch-1', actorId: 'caster', round: 1,
  handoffs: { movements: [], persistentAreas: [], summons: [], invocations: [], mapObjectLaunches: [{ kind: 'launch-map-object', operationId: 'launch', limits, castLevel: 1, amount, damageType: 'bludgeoning' }] },
  selection: {}, areaSelection: { anchorCell: { col: 0, row: 1 }, cells: [{ col: 0, row: 1 }], targetIds: [],
    areaPlacement: { x: 25, y: 75, elevationFeet: 0, angleDegrees: 0, objectLaunchPitchDegrees: pitch }, areaPlacementDistanceFeet: 20 } })

it.each([0, 6, 30])('settles direct ground strikes and preserves the untracked surface receipt: %s', amount => {
  setMapGeometryRuntime([])
  const map = fixture(); map.dnd5ePluginAreas = []; map.tokens[1].elevationFeet = 20
  const before = structuredClone(map), result = handoff(map, amount, [], -90)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) {
    const stone = result.map.tokens.find(t => t.id === 'stone')!
    expect(stone).toMatchObject({ hp: Math.max(0, 20 - amount), y: 75, elevationFeet: 0 })
    expect(stone.x).toBeCloseTo(25)
    expect(stone.dnd5eObjectState?.groundImpact).toMatchObject({ actionId: 'launch-1', operationId: 'launch', damage: amount, elevationFeet: 0 })
    expect(normalizeDnd5eMapObjectStateV1(JSON.parse(JSON.stringify(stone.dnd5eObjectState)))?.groundImpact).toEqual(stone.dnd5eObjectState?.groundImpact)
    expect(result.geometryEntityPatches ?? []).toEqual([])
  }
  expect(map).toEqual(before)
})

it('rejects malformed ground impact records instead of losing their damage silently', () => {
  const base = { schemaVersion: 1, weightPounds: 5, groundImpact: { actionId: 'a', operationId: 'o', surfaceId: 'ground', damage: 6, x: 1, y: 2, elevationFeet: 0 } }
  for (const invalid of [{ damage: -1 }, { damage: NaN }, { x: Infinity }, { surfaceId: '' }, { operationId: 1 }]) {
    expect(normalizeDnd5eMapObjectStateV1({ ...base, groundImpact: { ...base.groundImpact, ...invalid } })).toBeUndefined()
  }
})

it.each(['wall-of-stone', 'wall-of-ice'])('damages only the first %s panel and commits projectile damage/position without mutating inputs', spell => {
  setMapGeometryRuntime([])
  const map = fixture(spell), original = structuredClone(map)
  const flight = planDnd5eMapObjectFlight({ map, objectId: 'stone', slotLevel: 1, angleDegrees: 0, limits })
  expect(flight.ok && flight.plan.stop).toMatchObject({ id: 'wall', panelId: 'near' })
  const result = handoff(map)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  expect(result.map.dnd5ePluginAreas![0].stoneWall!.panels.map(panel => panel.hitPoints)).toEqual([30, 0])
  expect(result.map.tokens.find(token => token.id === 'stone')).toMatchObject({ hp: 14, x: spell === 'wall-of-ice' ? 220 : 222.5, y: 75 })
  if (spell === 'wall-of-ice') expect(result.map.dnd5ePluginAreas![0].triggers).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'wall-of-ice-frigid-air', cells: [{ col: 4, row: 1 }] })]))
  expect(map).toEqual(original)
})

it('removes the final stone panel while retaining the stopped projectile', () => {
  const map = fixture(); map.dnd5ePluginAreas![0].stoneWall!.panels.splice(0, 1)
  const result = handoff(map)
  expect(result.ok).toBe(true)
  if (result.ok) { expect(result.map.dnd5ePluginAreas).toEqual([]); expect(result.endedAreaIds).toEqual(['wall']); expect(result.map.tokens.find(t => t.id === 'stone')?.hp).toBe(14) }
})

it('force immunity prevents wall damage but not damage to the projectile', () => {
  const map = fixture('wall-of-force')
  delete map.dnd5ePluginAreas![0].stoneWall
  map.dnd5ePluginAreas![0].forceWall = { mode: 'thick', start: { col: 4, row: 0 }, angles: [90] }
  const before = structuredClone(map.dnd5ePluginAreas)
  const result = handoff(map)
  expect(result.ok).toBe(true)
  if (result.ok) { expect(result.map.dnd5ePluginAreas).toEqual(before); expect(result.map.tokens.find(t => t.id === 'stone')?.hp).toBe(14) }
})

it('commits entity destruction, debris and captive character cleanup together', () => {
  const map = fixture(), area = map.dnd5ePluginAreas![0]
  delete area.stoneWall
  area.coreSpellId = undefined
  area.pluginId = 'test'; area.featureId = 'pillar'
  area.permanent = true
  area.cells = [{ col: 4, row: 1 }]
  area.entityProfile = { armorClass: 5, hitPoints: 6, invisible: false, cannotAttack: true, destructionTerrain: { radiusFeet: 10, squareFeetPerMinute: 25 } }
  const effect = createDnd5eConditionEffect({ id: 'pinned', condition: 'restrained', targetId: 'captive',
    source: { kind: 'spell', actorId: 'caster', rulesId: 'test:pillar' }, duration: { type: 'permanent' } })
  effect.definitionId = 'activity:test:pillar:pinned'
  const captive = normalizeCharacter({ id: 'captive-character', name: 'Captive', maxHp: 20, currentHp: 20,
    dnd5eCombatState: { activeEffects: [effect] } })
  map.tokens.push({ id: 'captive', characterId: captive.id, type: 'player', label: 'Captive', x: 225, y: 75, elevationFeet: 15, size: 1, emoji: '', color: '' })
  const bound = bindDnd5eAreaRestraints({ map, characters: [captive], area, effectIds: ['pinned'] })
  expect(bound.changedCharacterIds).toEqual([captive.id])
  const original = structuredClone(bound)
  const result = handoff(bound.map, 6, bound.characters)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) {
    expect(result.endedAreaIds).toEqual(['wall'])
    expect(result.boundCharacterIds).toContain(captive.id)
    expect(result.boundCharacters![0].dnd5eCombatState?.activeEffects ?? []).toEqual([])
    expect(result.map.dnd5ePluginAreas!.some(candidate => candidate.id === 'wall')).toBe(false)
    expect(result.map.dnd5ePluginAreas!.length).toBe(1)
    expect(result.map.tokens.find(token => token.id === 'stone')?.hp).toBe(14)
  }
  expect(bound).toEqual(original)
})

it('does not commit an unmodeled mapped surface impact or a projectile with unknown durability', () => {
  const map = fixture(), geometry = createEmptyMapGeometry(map.id, 1)
  geometry.walls.push({ id: 'physical-wall', kind: 'wall', label: 'Unknown durability', points: [{ x: 150, y: 0 }, { x: 150, y: 150 }], blocksMovement: true, blocksVision: true, blocksLineOfEffect: true, baseHeightFeet: 0, heightFeet: 10, createdAt: 1 })
  const original = structuredClone(map)
  try { setMapGeometryRuntime([geometry]); expect(handoff(map).ok).toBe(false); expect(map).toEqual(original) }
  finally { setMapGeometryRuntime([]) }
  delete map.tokens[1].hp; delete map.tokens[1].maxHp
  const unknown = structuredClone(map)
  expect(handoff(map).ok).toBe(false)
  expect(map).toEqual(unknown)
})

it.each([false,true])('settles impact against a temple force shell without damaging it (authored HP=%s)',hasHp=>{
 const map=fixture(),geometry=createEmptyMapGeometry(map.id,1)
 geometry.walls=[{id:'temple-wall',kind:'wall',label:'Force',points:[{x:150,y:0},{x:150,y:150}],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,
  baseHeightFeet:0,heightFeet:10,createdAt:1,...(hasHp?{dnd5eDurability:{hitPoints:6,maxHitPoints:6,damageThreshold:0}}:{})}]
 geometry.structureLifetimes=[{id:'temple',casterId:'caster',createdWorldMinute:0,expiresWorldMinute:1440,entityIds:['temple-wall'],replacementGroup:'temple-of-the-gods',siteKey:'site',
  objectBoundary:{points:[{x:150,y:0},{x:300,y:0},{x:300,y:150},{x:150,y:150}],bottomFeet:0,topFeet:10},
  templeWard:{hostileCreatureTypes:['fiend'],saveDc:18,healingBonus:5,lighting:'none'}}]
 const before=structuredClone({map,geometry})
 try{
  setMapGeometryRuntime([geometry])
  const result=handoff(map)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok){
   expect(result.geometryEntityPatches).toEqual([])
   expect(result.map.tokens.find(t=>t.id==='stone')).toMatchObject({x:150,hp:14})
   expect(result.map.dnd5ePluginAreas).toEqual(map.dnd5ePluginAreas)
  }
  expect({map,geometry}).toEqual(before)
 }finally{setMapGeometryRuntime([])}
})

it.each([0, 7])('returns a Host geometry durability patch and still damages the projectile with threshold %s', damageThreshold => {
  const map=fixture(), geometry=createEmptyMapGeometry(map.id,1)
  geometry.walls=[{id:'mapped-wall',kind:'wall',label:'Wall',points:[{x:150,y:0},{x:150,y:150}],blocksMovement:true,blocksVision:true,blocksLineOfEffect:true,
    baseHeightFeet:0,heightFeet:10,createdAt:1,dnd5eDurability:{hitPoints:6,maxHitPoints:6,damageThreshold}}]
  const before=structuredClone(geometry)
  try {
    setMapGeometryRuntime([geometry])
    const result=handoff(map)
    expect(result.ok,JSON.stringify(result)).toBe(true)
    if(result.ok){
      expect(result.geometryEntityPatches).toEqual([{entityId:'mapped-wall',patch:{dnd5eDurability:{hitPoints:damageThreshold===0?0:6,maxHitPoints:6,damageThreshold}}}])
      expect(result.map.tokens.find(t=>t.id==='stone')).toMatchObject({x:150,hp:14})
      expect(result.map.dnd5ePluginAreas).toEqual(map.dnd5ePluginAreas)
    }
    expect(geometry).toEqual(before)
  } finally {setMapGeometryRuntime([])}
})

it.each(['impact','end-of-flight'])('commits the landing elevation of an airborne projectile after %s', mode=>{
  const map=fixture();map.tokens[1].elevationFeet=20
  if(mode==='impact')map.dnd5ePluginAreas![0].vertical={mode:'volume',baseElevationFeet:20,heightFeet:10}
  else map.dnd5ePluginAreas=[]
  const original=structuredClone(map),result=handoff(map)
  expect(result.ok,JSON.stringify(result)).toBe(true)
  if(result.ok){
    expect(result.map.tokens.find(t=>t.id==='stone')).toMatchObject({elevationFeet:0,hp:14})
    expect(!!result.map.tokens.find(t=>t.id==='stone')?.dnd5eObjectState?.groundImpact).toBe(mode === 'end-of-flight')
    expect(result.changedTokenIds).toContain('stone')
  }
  expect(map).toEqual(original)
})

it.each([6, 30])('damages the first landing object once after unobstructed flight: %s', hp => {
  setMapGeometryRuntime([])
  const map = fixture(); map.dnd5ePluginAreas = []; map.tokens[1].elevationFeet = 20
  map.tokens.push({ id: 'crate', label: 'Crate', type: 'obstacle', x: 925, y: 75, size: 1, emoji: '', color: '', hp, maxHp: hp })
  const before = structuredClone(map), result = handoff(map)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (result.ok) {
    expect(result.map.tokens.find(t => t.id === 'crate')?.hp).toBe(hp - 6)
    expect(result.map.tokens.find(t => t.id === 'stone')).toMatchObject({ hp: 14, x: 925, elevationFeet: hp === 6 ? 0 : 5 })
    expect(result.map.tokens.find(t => t.id === 'stone')?.dnd5eObjectState?.groundImpact).toBeUndefined()
  }
  expect(map).toEqual(before)
})

it.each(['wall-of-stone', 'wall-of-ice', 'wall-of-force'])('resolves the exact %s landing panel after flying over the wall', spell => {
  setMapGeometryRuntime([])
  const map = fixture(spell); map.tokens[1].elevationFeet = 20
  const area = map.dnd5ePluginAreas![0], panel = area.stoneWall!.panels[1]
  panel.start = { col: 18, row: 0 }; panel.end = { col: 18, row: 2 }; panel.cells = [{ col: 18, row: 1 }]
  area.cells = [...area.stoneWall!.panels[0].cells, ...panel.cells]
  const before = structuredClone(map), result = handoff(map)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) return
  expect(result.map.dnd5ePluginAreas![0].stoneWall!.panels.map(p => p.hitPoints)).toEqual([30, spell === 'wall-of-force' ? 6 : 0])
  const stone = result.map.tokens.find(t => t.id === 'stone')!
  expect(stone).toMatchObject({ x: 925, hp: 14 })
  expect(stone.elevationFeet).toBeCloseTo(spell === 'wall-of-force' ? 10 : 0, 4)
  expect(stone.dnd5eObjectState?.groundImpact).toBeUndefined()
  expect(map).toEqual(before)
})

it.each([6, 30])('damages a landing platform before computing its final support height: %s', hp => {
  const map = fixture(); map.dnd5ePluginAreas = []; map.tokens[1].elevationFeet = 20
  const geometry = createEmptyMapGeometry(map.id, 1)
  geometry.obstacles.push({ id: 'floor', kind: 'obstacle', label: 'Floor',
    points: [{ x: 900, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 150 }, { x: 900, y: 150 }],
    baseHeightFeet: 5, heightFeet: 1, blocksMovement: true, blocksVision: true, blocksLineOfEffect: true,
    cover: 'total', createdAt: 1, dnd5eDurability: { hitPoints: hp, maxHitPoints: hp, damageThreshold: 0 } })
  const before = structuredClone(geometry)
  try {
    setMapGeometryRuntime([geometry])
    const result = handoff(map)
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (result.ok) {
      expect(result.geometryEntityPatches?.[0]).toMatchObject({ entityId: 'floor', patch: { dnd5eDurability: { hitPoints: hp - 6 } } })
      const stone = result.map.tokens.find(t => t.id === 'stone')!
      expect(stone.hp).toBe(14)
      expect(stone.elevationFeet).toBeCloseTo(hp === 6 ? 0 : 6)
      expect(stone.dnd5eObjectState?.groundImpact).toBeUndefined()
    }
    expect(geometry).toEqual(before)
  } finally { setMapGeometryRuntime([]) }
})
