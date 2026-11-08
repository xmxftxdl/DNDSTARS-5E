import { expect, it } from 'vitest'
import { falseHydraSongConceals } from '../../../shared/false-hydra-song.mjs'
import { projectMapsForPlayer } from '../../../scripts/shared-server-core.mjs'
import { createMultipartCreature, endMultipartTurn, beginMultipartTurn } from './multipartCreature'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantCanSee, dnd5eCombatantCanDetect } from './headlessCombatEngine'
import { createEmptyMapGeometry, mapGeometryCanSeeToken } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'

function singing() {
  const state = createMultipartCreature({ x: 0, y: 0, z: 0 })
  state.heads[0].singingThroughTurn = state.turn + 1
  return state
}

it('uses only active deafness to bypass song, and ends on the next turn boundary', () => {
  const state = singing()
  expect(falseHydraSongConceals(state, { conditions: [] })).toBe(true)
  expect(falseHydraSongConceals(state, { conditions: ['耳聋'] })).toBe(false)
  expect(falseHydraSongConceals(state, { activeEffects: [{ standardCondition: 'deafened' }] })).toBe(false)
  expect(falseHydraSongConceals(state, { activeEffects: [{ legacyCondition: 'deafened', suspendedBy: ['antimagic'] }] })).toBe(true)
  endMultipartTurn(state)
  expect(falseHydraSongConceals(state)).toBe(true)
  beginMultipartTurn(state); endMultipartTurn(state)
  expect(falseHydraSongConceals(state)).toBe(false)
})

it('prevents Headless truesight and tremorsense from bypassing song', () => {
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const viewer = make('viewer'), hydra = make('hydra')
  viewer.specialSenses = [{ kind: 'truesight', rangeFeet: 300 }, { kind: 'tremorsense', rangeFeet: 300 }]
  hydra.classState.monsterMultipart = singing()
  const state = startDnd5eHeadlessCombat('song', [viewer, hydra])
  expect(dnd5eCombatantCanSee(state, 'viewer', 'hydra')).toBe(false)
  expect(dnd5eCombatantCanDetect(state, 'viewer', 'hydra')).toBe(false)
  state.combatants.viewer.conditions = [...state.combatants.viewer.conditions, 'deafened']
  expect(dnd5eCombatantCanSee(state, 'viewer', 'hydra')).toBe(true)
})

it('filters server map projection per player even with party vision sharing enabled', () => {
  const token = (id: string, patch: Partial<Token> = {}): Token => ({ id, label: id, x: 50, y: 50,
    size: 1, type: 'player', characterId: id, emoji: '', color: '#fff', ...patch })
  const hydra = token('hydra', { type: 'enemy', characterId: undefined, dnd5eCombatState: { monsterMultipart: singing() } })
  const hearing = token('hearing'), deaf = token('deaf', { dnd5eCombatState: { conditions: ['deafened'] } })
  const map: BattleMap = { id: 'map', name: 'Map', width: 500, height: 500, gridSize: 50, feetPerCell: 5,
    gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [hearing, deaf, hydra] }
  const geometry = createEmptyMapGeometry('map', 1)
  geometry.vision = { enabled: false, defaultRangeFeet: 60, sharePartyVision: true, ambientLight: 'bright' }
  const roster = { characters: [{ id: 'hearing', roomMemberId: 'h' }, { id: 'deaf', roomMemberId: 'd' }] }
  const visible = (id: string, memberId: string) => projectMapsForPlayer({ maps: [map] }, { maps: [geometry] }, id, roster, { memberId }).maps[0].tokens.some(t => t.id === 'hydra')
  expect(visible('hearing', 'h')).toBe(false)
  expect(visible('deaf', 'd')).toBe(true)
  hydra.dnd5eCombatState!.monsterMultipart!.consumed.push({targetId:'secret',name:'秘密受害者',minute:1,requiem:true,rewriteMinutesByActorId:{hearing:10}})
  const projected=projectMapsForPlayer({ maps: [map] }, { maps: [geometry] }, 'deaf', roster, { memberId:'d' }).maps[0].tokens.find(t=>t.id==='hydra')!
  expect(projected.dnd5eCombatState?.monsterMultipart?.consumed).toEqual([])
  expect(hydra.dnd5eCombatState!.monsterMultipart!.consumed).toHaveLength(1)

  expect(mapGeometryCanSeeToken({ map, geometry, viewer: hearing, target: hydra })).toBe(false)
  expect(mapGeometryCanSeeToken({ map, geometry, viewer: deaf, target: hydra })).toBe(true)
  hydra.dnd5eCombatState!.monsterMultipart!.heads[0].alive = false
  expect(visible('hearing', 'h')).toBe(true)
})
