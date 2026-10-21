import { expect, it } from 'vitest'
import { forceShellCrosses } from './forceShellGeometry'
import { forceShellOverlapsBody, forceShellSweptBoxOverlaps } from '../../shared/force-shell-geometry.mjs'
import type { BattleMap, Dnd5ePluginArea } from '../store/maps'
const map = { gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5 } as BattleMap
const area = (shape: 'hemisphere' | 'sphere') => ({ anchorCell: { col: 0, row: 0 },
  forceShell: { shape, radiusFeet: 10 }, vertical: { mode: 'volume', baseElevationFeet: shape === 'sphere' ? -10 : 0, heightFeet: shape === 'sphere' ? 20 : 10 } }) as Dnd5ePluginArea
it.each(['hemisphere','sphere'] as const)('%s blocks body-edge penetration while leaving its hollow interior clear',shape=>{
 const shell=area(shape)
 expect(forceShellOverlapsBody(shell,map,{x:25,y:25},1,2.1,5)).toBe(false)
 expect(forceShellOverlapsBody(shell,map,{x:225,y:25},1,2.1,5)).toBe(false)
 // All centerline heights remain inside; the body's outer edge intersects the shell.
 expect(forceShellCrosses(shell,map,{x:25,y:25},{x:95,y:25},6,6)).toBe(false)
 expect(forceShellOverlapsBody(shell,map,{x:95,y:25},1,2.1,5)).toBe(true)
})
it('preserves the open underside of a hemisphere for body placement',()=>{
 expect(forceShellOverlapsBody(area('hemisphere'),map,{x:25,y:25},-12,2.1,5)).toBe(false)
 expect(forceShellOverlapsBody(area('sphere'),map,{x:25,y:25},-12,2.1,5)).toBe(true)
})
it.each(['hemisphere','sphere'] as const)('%s checks a continuous box sweep including roof and hollow interior',shape=>{
 const shell=area(shape),from={x:25,y:25},to={x:50,y:25}
 expect(forceShellSweptBoxOverlaps(shell,map,from,to,1,1,25,5)).toBe(false)
 expect(forceShellSweptBoxOverlaps(shell,map,from,from,1,20,25,5)).toBe(true)
 expect(forceShellSweptBoxOverlaps(shell,map,from,to,20,20,25,5)).toBe(false)
 expect(forceShellSweptBoxOverlaps(shell,map,from,from,1,-20,25,5)).toBe(shape==='sphere')
 expect(forceShellSweptBoxOverlaps(shell,map,{x:-200,y:25},{x:200,y:25},1,1,25,5)).toBe(true)
})
it.each(['hemisphere', 'sphere'] as const)('%s allows interior motion but blocks side and roof crossings', shape => {
  const shell = area(shape)
  expect(forceShellCrosses(shell, map, { x: 25, y: 25 }, { x: 50, y: 25 }, 2, 2)).toBe(false)
  expect(forceShellCrosses(shell, map, { x: 25, y: 25 }, { x: 200, y: 25 }, 2, 2)).toBe(true)
  expect(forceShellCrosses(shell, map, { x: -200, y: 25 }, { x: 200, y: 25 }, 2, 2)).toBe(true)
  expect(forceShellCrosses(shell, map, { x: 25, y: 25 }, { x: 25, y: 25 }, 2, 20)).toBe(true)
  expect(forceShellCrosses(shell, map, { x: -200, y: 25 }, { x: 200, y: 25 }, 20, 20)).toBe(false)
})
it('keeps the dome underside open but closes the sphere below its center', () => {
  const from = { x: 25, y: 25 }, to = { x: 25, y: 25 }
  expect(forceShellCrosses(area('hemisphere'), map, from, to, 2, -20)).toBe(false)
  expect(forceShellCrosses(area('sphere'), map, from, to, 2, -20)).toBe(true)
})

it('uses the shell in public movement and spell line-of-effect checks', async () => {
  const { mapGeometryMovementBlocked, mapGeometryLineOfEffectBlocked } = await import('./mapGeometry')
  const shell = { ...area('sphere'), id: 'force', coreSpellId: 'wall-of-force',
    sourceKind: 'core-spell', cells: [{ col: 0, row: 0 }],
    blocking: { movement: true, movementMode: 'boundary', lineOfEffect: true, lineOfEffectMode: 'boundary' },
  } as Dnd5ePluginArea
  const scene = { ...map, id: 'map', width: 500, height: 500, tokens: [], dnd5ePluginAreas: [shell] } as BattleMap
  const walker = { id: 'walker', type: 'player', size: 1, x: 25, y: 25 } as import('../store/maps').Token
  expect(mapGeometryMovementBlocked({ map: scene, token: walker, to: { x: 50, y: 25 } }).blocked).toBe(false)
  expect(mapGeometryMovementBlocked({ map: scene, token: walker, to: { x: 200, y: 25 } }).blocked).toBe(true)
  expect(mapGeometryLineOfEffectBlocked({ map: scene, from: walker, to: { x: 50, y: 25 } })).toBe(false)
  expect(mapGeometryLineOfEffectBlocked({ map: scene, from: walker, to: { x: 200, y: 25 } })).toBe(true)
})
