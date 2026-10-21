import { expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eDirectedCombatantPairKey } from './headlessCombatEngine'
import { dnd5eActivityAttackDefenses } from './activities/dnd5eActivityAttackDefenses'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'dm', initiative: 10,
  abilities: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 }, proficiencyBonus: 2,
  armorClass: 12, currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30, position: { x: 200, y: 50 }, concentrating: false })
const token = (id: string, x: number): Token => ({ id, label: id, x, y: 50, size: 1, color: '', emoji: '', type: 'enemy' })
it.each(['none', 'half', 'total'] as const)('selected rock supplies %s cover without replacing caster defenses', mode => {
  const state = startDnd5eHeadlessCombat('rock-origin', [make('actor'), make('target')])
  const geometry = createEmptyMapGeometry('map', 1)
  if (mode === 'half') geometry.obstacles = [{ id: 'crate', kind: 'obstacle', label: 'Crate',
    points: [{x:100,y:0},{x:120,y:0},{x:120,y:100},{x:100,y:100}], blocksVision: false,
    blocksMovement: true, blocksLineOfEffect: false, cover: 'half', baseHeightFeet: 0, heightFeet: 10, createdAt: 1 }]
  if (mode === 'total') geometry.walls = [{id:'wall',kind:'wall',label:'Wall',points:[{x:100,y:0},{x:100,y:100}],
    blocksVision:false,blocksMovement:true,blocksLineOfEffect:true,baseHeightFeet:0,heightFeet:10,createdAt:1}]
  const map: BattleMap = {id:'map',name:'Map',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,feetPerCell:5,showGrid:true,tokens:[token('actor',200),token('target',250)]}
  state.companionScene = {map,geometry,projectedTokenIds:['actor','target']}
  state.coverBonusByCombatantPair = {[dnd5eDirectedCombatantPairKey('actor','target')]:5}
  const rock={...token('rock',50),type:'obstacle' as const}
  const ordinary=dnd5eActivityAttackDefenses(state,'actor','target').spell
  expect(ordinary).toBe(17)
  const fromRock=dnd5eActivityAttackDefenses(state,'actor','target',rock).spell
  if(mode==='total')expect(fromRock).toBeGreaterThan(100)
  else expect(fromRock).toBe(mode==='half'?14:12)
  expect(dnd5eActivityAttackDefenses(state,'actor','target').spell).toBe(17)
})
