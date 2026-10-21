import type { BattleMap, Token } from '../store/maps'
import { occupiedCells } from './gridCombat'
import { mapGeometryTokenElevation, type MapGeometryState } from './mapGeometry'

/** Match the body volume used by map geometry, cover and movement. */
export const mapTokenBodyHeight = (token: Token): number => Math.max(5, Math.max(1, token.size) * 5)

/** Continuous body sweep for authored stair segments, including between endpoint cells. */
export function mapTokenSweepBlocked(input: {
  map: BattleMap; geometry?: MapGeometryState; mover: Token;
  from: {x:number;y:number}; to: {x:number;y:number}; fromElevationFeet:number; toElevationFeet:number;
  ignoreTokens?:boolean; excludedIds?:readonly string[];
}): boolean {
  if(input.ignoreTokens)return false
  const excluded=new Set([input.mover.id,...input.excludedIds??[]])
  const half=input.mover.size*input.map.gridSize/2,height=mapTokenBodyHeight(input.mover)
  return input.map.tokens.some(other=>{
    if(excluded.has(other.id)||other.dnd5eSpellEffect||(other.type==='obstacle'&&other.obstacleKind==='marker'))return false
    const otherHalf=other.size*input.map.gridSize/2,base=mapGeometryTokenElevation(input.geometry,other)
    let enter=0,exit=1
    const axis=(start:number,end:number,low:number,high:number)=>{
      const delta=end-start
      if(Math.abs(delta)<1e-9)return start>low+1e-7&&start<high-1e-7
      const a=(low-start)/delta,b=(high-start)/delta
      enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b))
      return exit-enter>1e-7
    }
    return axis(input.from.x,input.to.x,other.x-otherHalf-half,other.x+otherHalf+half)&&
      axis(input.from.y,input.to.y,other.y-otherHalf-half,other.y+otherHalf+half)&&
      axis(input.fromElevationFeet,input.toElevationFeet,base-height,base+mapTokenBodyHeight(other))&&exit-enter>1e-7
  })
}

/** Half-open vertical intervals: touching feet/ceiling boundaries do not overlap. */
export function createMapTokenOccupancy(
  map: BattleMap, geometry: MapGeometryState | undefined, mover: Token,
  ignoreTokens = false, excludedIds: readonly string[] = [],
) {
  const excluded = new Set([mover.id, ...excludedIds])
  const bodies = ignoreTokens ? [] : map.tokens.filter(token => !excluded.has(token.id) && !token.dnd5eSpellEffect && !(token.type === 'obstacle' && token.obstacleKind === 'marker'))
    .map(token => ({ token, base: mapGeometryTokenElevation(geometry, token), height: mapTokenBodyHeight(token) }))
  const cache = new Map<string, Set<string>>()
  return (base: number, top = base + mapTokenBodyHeight(mover)): Set<string> => {
    const key = `${base}:${top}`
    if (!cache.has(key)) cache.set(key, occupiedCells(bodies.filter(body =>
      base < body.base + body.height && top > body.base).map(body => body.token), map, mover.id))
    return cache.get(key)!
  }
}
