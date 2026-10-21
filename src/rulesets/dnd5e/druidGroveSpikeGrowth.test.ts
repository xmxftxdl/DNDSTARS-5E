import { expect, it } from 'vitest'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import type { Character } from '../../types/character'
import { prepareDnd5eDruidGroveSpikeGrowth } from './druidGroveSpikeGrowth'
import { collectDnd5ePersistentAreaTriggers, dnd5ePersistentAreaDifficultTerrainMultiplierAt, expireDnd5ePluginAreasAtWorldMinute } from './pluginAreas'
import { prepareDnd5ePersistentAreaTrigger, resolvePreparedDnd5ePersistentAreaTrigger } from './pluginAreaTransactions'
function fixture() {
  const caster: Token = { id: 'caster', characterId: 'owner', label: 'Caster', type: 'player', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const target: Token = { ...caster, id: 'target', characterId: undefined, type: 'enemy', x: 125, y: 25 }
  const map: BattleMap = { id: 'grove', name: 'Grove', width: 1_000, height: 1_000, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [caster, target] }
  const geometry = createEmptyMapGeometry(map.id, 1); geometry.environment = 'outdoors'
  return { map, geometry, placement: { origin: { col: 0, row: 0 }, sideFeet: 30, fogCells: [], undergrowthCells: [{ col: 2, row: 0 }], guardianTreeIds: [] },
    baseElevationFeet: 0, qualifications: { structureObstacleIds: [] as string[], treeTokenIds: [] },
    source: { castId: 'cast-1', pluginId: 'test.grove', spellId: 'grove', characterId: 'owner', tokenId: 'caster', slotLevel: 6, saveDc: 17 }, round: 1, worldMinute: 100 }
}

const character = (patch: Partial<Character> = {}): Character => ({
  id: 'caster', name: 'caster', player: '', avatar: '', accent: '', race: '人类', charClass: '法师', level: 3,
  background: '', experience: 0, reputation: 0, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
  savingThrows: [], skills: [], maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '3d6', ac: 10, speed: 30,
  initiativeBonus: 0, saveDC: 12, passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
  visibleToPlayers: true, ...patch,
})



it.each([false, true])('settles actual movement damage with grove exemption=%s after reload', exempt => {
  const input = fixture()
  input.map.tokens[1] = { ...input.map.tokens[1], characterId: 'victim', type: 'player', x: 75, y: 75 }
  const projected = prepareDnd5eDruidGroveSpikeGrowth({ ...input, center: { col: 2, row: 2 }, exemptTokenIds: exempt ? ['target'] : [] })
  if (!projected.ok) throw Error(projected.reason)
  const map = migrateMapsState(JSON.parse(JSON.stringify({ maps: [{ ...input.map, dnd5ePluginAreas: projected.areas }] }))).maps[0]
  expect(map.dnd5ePluginAreas).toHaveLength(1)
  expect(map.dnd5ePluginAreas![0].concentrationId).toBeUndefined()
  const target = map.tokens[1]
  expect(dnd5ePersistentAreaDifficultTerrainMultiplierAt({ map, token: target, position: target })).toBe(exempt ? 1 : 2)
  const candidates = collectDnd5ePersistentAreaTriggers({ map, timing: 'on-move-distance', round: 2,
    movement: { token: target, to: { x: 175, y: 75 }, path: [{ x: 125, y: 75 }, { x: 175, y: 75 }] } })
  expect(candidates).toHaveLength(exempt ? 0 : 2)
  if (!exempt) {
    const prepared = prepareDnd5ePersistentAreaTrigger({ map, combatId: map.id, round: 2,
      characters: [character({ id: 'owner' }), character({ id: 'victim' })],
      initiativeOrder: map.tokens.map(t => ({ tokenId: t.id, roll: 10, label: t.label, emoji: '', color: '#fff', slotId: t.id })), candidate: candidates[0] })
    if (!prepared.ok) throw Error(JSON.stringify(prepared))
    const resolved = resolvePreparedDnd5ePersistentAreaTrigger({ prepared: prepared.prepared, damageRolls: [2, 3] })
    expect(resolved.result.ok, JSON.stringify(resolved.result)).toBe(true)
    expect(resolved.application?.characters.find(c => c.id === 'victim')?.currentHp).toBe(5)
  }
  expect(expireDnd5ePluginAreasAtWorldMinute(map, 1539).dnd5ePluginAreas).toHaveLength(1)
  expect(expireDnd5ePluginAreasAtWorldMinute(map, 1540).dnd5ePluginAreas).toHaveLength(0)
  expect(projected.areas[0].cells.every(c => c.col >= 0 && c.row >= 0 && c.col < 6 && c.row < 6)).toBe(true)
})

it('rejects a center outside the protected grove', () => {
  expect(prepareDnd5eDruidGroveSpikeGrowth({ ...fixture(), center: { col: 9, row: 9 } })).toEqual({ ok: false, reason: 'invalid-extra-effect-center' })
})


it('settles grove movement against Host continuation HP and spent reaction without rebuilding the room snapshot', () => {
 const input=fixture()
 input.map.tokens[1]={...input.map.tokens[1],characterId:'victim',type:'player',x:75,y:75}
 const projected=prepareDnd5eDruidGroveSpikeGrowth({...input,center:{col:2,row:2},exemptTokenIds:[]})
 if(!projected.ok)throw Error(projected.reason)
 const map={...input.map,dnd5ePluginAreas:projected.areas}
 const candidates=collectDnd5ePersistentAreaTriggers({map,timing:'on-move-distance',round:2,
  movement:{token:map.tokens[1],to:{x:175,y:75},path:[{x:125,y:75},{x:175,y:75}]}})
 const args={map,combatId:map.id,round:2,characters:[character({id:'owner'}),character({id:'victim'})],
  initiativeOrder:map.tokens.map(t=>({tokenId:t.id,roll:10,label:t.label,emoji:'',color:'#fff',slotId:t.id})),candidate:candidates[0]}
 const initial=prepareDnd5ePersistentAreaTrigger(args)
 if(!initial.ok)throw Error(initial.reason)
 const state=structuredClone(initial.prepared.state)
 state.combatants.target.currentHp=7
 state.combatants.target.turn.reactionAvailable=false
 state.combatants.target.turn.movementRemaining=0
 state.combatants.target.position={x:175,y:75}
 const before=structuredClone({args,state})
 const prepared=prepareDnd5ePersistentAreaTrigger(args,state)
 if(!prepared.ok)throw Error(prepared.reason)
 expect(prepared.prepared.map.tokens.find(t=>t.id==='target')).toMatchObject({x:175,y:75})
 const resolved=resolvePreparedDnd5ePersistentAreaTrigger({prepared:prepared.prepared,damageRolls:[2,3]})
 expect(resolved.result.ok).toBe(true)
 expect(resolved.result.state.combatants.target).toMatchObject({currentHp:2,position:{x:175,y:75},turn:{reactionAvailable:false,movementRemaining:0}})
 expect(resolved.application?.characters.find(c=>c.id==='victim')?.currentHp).toBe(2)
 expect({args,state}).toEqual(before)
 for(const patch of [{mapId:'other'},{combatId:'other'},{round:3}]){
  expect(prepareDnd5ePersistentAreaTrigger(args,{...state,...patch})).toEqual({ok:false,reason:'persistent-area-state-mismatch'})
 }
})
