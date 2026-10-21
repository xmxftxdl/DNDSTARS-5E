import { afterEach, expect, it } from 'vitest'
import type { BattleMap, Token } from '../../../store/maps'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../../lib/mapGeometry'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from '../mapBridge'
import { dnd5eActivityMapMovementEvents, synchronizeDnd5eActivityMapMovement } from './dnd5eActivityMapMovementEvents'
import { createDnd5eConditionEffect } from '../activeEffects'
import { formatDnd5eCombatLogDetails } from '../../../lib/combatLogDetails'

afterEach(() => setMapGeometryRuntime([]))

it.each(['source','ally','outsider','helpful','stationary','carried','unconfirmed'] as const)('breaks source-linked charm only for committed harmful displacement: %s',mode=>{
 const {before,after,snapshot}=fixture()
 const state=snapshot.state
 state.combatants.origin={...structuredClone(state.combatants.source),id:'origin',controller:mode==='outsider'?'player':state.combatants.source.controller}
 before.tokens.push({...before.tokens[0],id:'origin',label:'Charmer'})
 after.tokens.push({...before.tokens[0],id:'origin',label:'Charmer'})
 const effect=createDnd5eConditionEffect({id:'charm',condition:'charmed',targetId:'target',
  source:{kind:'spell',actorId:mode==='source'?'source':'origin',actorName:'Charmer',magical:true},
  duration:{type:'rounds',remainingRounds:600,tickOn:'target-turn-start'},appliedAt:1,
  onEndAwareness:'charmed-by-source',removal:{sourceLink:{targetHarmedBySourceAlly:true}}})
 state.combatants.target.classState.activeEffects=[effect]
 state.combatants.target.conditions=['charmed']
 const finalMap=mode==='stationary'?before:after
 const events=synchronizeDnd5eActivityMapMovement({before,after:finalMap,state,actorId:'source',activityId:'move-test',
  movements:mode==='carried'?[]:[{kind:'move',operationId:'move',targetId:'target',mode:'forced',distanceFeet:5,
   ...(mode==='helpful'?{}:{harmful:true})}],carriedTargetIds:mode==='carried'?['target']:[],
   harmfulMovementTargetIds:['source','ally','outsider','helpful'].includes(mode)?['target']:[],events:[]})
 const ended=mode==='source'||mode==='ally'
 expect(state.combatants.target.classState.activeEffects?.some(e=>e.id==='charm')).toBe(!ended)
 expect(state.combatants.target.classState.activeEffects?.filter(e=>e.definitionId==='awareness:charmed-by-source')).toHaveLength(ended?1:0)
 const result=planDnd5eMapResultApplication({state,map:finalMap,characters:[],characterIdByCombatantId:snapshot.characterIdByCombatantId,events})
 expect(result.map.tokens.find(t=>t.id==='target')?.dnd5eCombatState?.activeEffects?.some(e=>e.id==='charm')).toBe(!ended)
 if(ended)expect(formatDnd5eCombatLogDetails(events)).toContainEqual(expect.stringContaining('知道自己曾被Charmer魅惑'))
 else expect(events.some(e=>e.type==='active-effect-removed')).toBe(false)
})
function fixture(elevationFeet?: number) {
  const token = (id: string, x: number): Token => ({ id, label: id, x, y: 25, size: 1, type: 'npc',
    color: '#fff', emoji: '', hp: 20, maxHp: 20, elevationFeet })
  const before: BattleMap = { id: 'raised-movement', name: 'Raised', width: 300, height: 100,
    gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true,
    tokens: [token('source', 25), token('target', 75)] }
  const geometry = createEmptyMapGeometry(before.id, 1)
  geometry.obstacles = [{ id: 'plateau', kind: 'obstacle', label: 'Plateau',
    points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 0, y: 100 }],
    blocksVision: false, blocksMovement: false, blocksLineOfEffect: false, cover: 'none',
    baseHeightFeet: 0, heightFeet: 0, terrainRegion: true, terrainElevationFeet: 20, createdAt: 1 }]
  setMapGeometryRuntime([geometry])
  const snapshot = createDnd5eMapCombatSnapshot({ combatId: 'raised', map: before, characters: [],
    initiativeOrder: before.tokens.map((token, i) => ({ tokenId: token.id, label: token.label, emoji: '', color: '', roll: 20 - i })) })
  const after = { ...before, tokens: before.tokens.map(token => token.id === 'target' ? { ...token, x: 125 } : token) }
  return { before, after, snapshot, geometry }
}

it.each([undefined, 0, 35])('preserves authoritative terrain/explicit elevation during carried synchronization: %s', elevation => {
  const { before, after, snapshot } = fixture(elevation)
  const expected = Math.max(20, elevation ?? 20)
  expect(snapshot.state.combatants.target.elevationFeet).toBe(expected)
  const events = synchronizeDnd5eActivityMapMovement({ before, after, state: snapshot.state,
    actorId: 'source', activityId: 'carry', movements: [], carriedTargetIds: ['target'], events: [] })
  expect(snapshot.state.combatants.target.elevationFeet).toBe(expected)
  expect(events).toContainEqual(expect.objectContaining({ type: 'moved', actorId: 'target', distance: 5,
    fromElevationFeet: expected, toElevationFeet: expected, movementKind: 'forced' }))
  const committed = planDnd5eMapResultApplication({ state: snapshot.state, map: after, characters: [],
    characterIdByCombatantId: snapshot.characterIdByCombatantId, events })
  expect(committed.map.tokens[1]).toMatchObject({ x: 125, elevationFeet: expected })
})

it('measures a height-changing accepted handoff using terrain height rather than absent token fields', () => {
  const { before, after, geometry } = fixture()
  geometry.obstacles[0].points = [{ x: 100, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 100, y: 100 }]
  setMapGeometryRuntime([geometry])
  const events = dnd5eActivityMapMovementEvents({ before, after, actorId: 'source', activityId: 'teleport',
    movements: [{ kind: 'move', operationId: 'jump', targetId: 'target', mode: 'teleport', distanceFeet: 30 }] })
  expect(events).toEqual([expect.objectContaining({ distance: 20, fromElevationFeet: 0, toElevationFeet: 20, movementKind: 'teleport' })])
})

it('validates every participant before updating any combatant', () => {
  const { before, after, snapshot } = fixture()
  const mapOnly = { ...before.tokens[1], id: 'missing-combatant', x: 175 }
  const prior = structuredClone(snapshot.state)
  expect(() => synchronizeDnd5eActivityMapMovement({ before: { ...before, tokens: [...before.tokens, mapOnly] },
    after: { ...after, tokens: [...after.tokens, { ...mapOnly, x: 225 }] }, state: snapshot.state,
    actorId: 'source', activityId: 'carry', movements: [], carriedTargetIds: ['target', mapOnly.id], events: [] }))
    .toThrow('activity-movement-combatant-missing')
  expect(snapshot.state).toEqual(prior)
})
