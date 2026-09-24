import type { BattleMap, Dnd5ePluginArea } from '../src/store/maps'
export function stoneWallIntersects(area: Pick<Dnd5ePluginArea, 'stoneWall' | 'forceWall' | 'vertical'>,
  map: Pick<BattleMap, 'gridSize'> & Partial<Pick<BattleMap, 'gridOffsetX' | 'gridOffsetY' | 'feetPerCell'>>,
  from: { x: number; y: number }, to: { x: number; y: number }, fromZ: number, toZ: number,
  radiusFeet?: number, creatureHeightFeet?: number): boolean
