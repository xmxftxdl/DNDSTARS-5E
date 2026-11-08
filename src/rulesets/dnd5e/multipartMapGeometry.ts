import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eMonsterAction } from './monsters'
import { tokenOccupiedCellsAt, cellKey, type GridCell } from '../../lib/gridCombat'

/** Geometry projections keep the parent's ID: they are never combatants or targets. */
export function multipartTokenHeadProjections(token: Token, map: Pick<BattleMap,'gridSize'|'feetPerCell'>): Token[] {
  const parts = token.dnd5eCombatState?.monsterMultipart
  if (!parts || token.multipartProjection) return []
  const units = map.gridSize / (map.feetPerCell ?? 5)
  return parts.heads.filter(head => head.alive).map(head => ({ ...token,
    x: token.x + (head.position.x-parts.body.x)*units,
    y: token.y + (head.position.y-parts.body.y)*units,
    elevationFeet: (token.elevationFeet ?? 0)+(head.position.z-parts.body.z),
    multipartProjection:true, size: 1, creatureSize: '中型',
  }))
}

export function multipartActionOriginToken(token: Token, map: BattleMap, action: Dnd5eMonsterAction): Token | undefined {
  if (!action.multipartHeadId) return token
  const state=token.dnd5eCombatState?.monsterMultipart
  if (!state) return /^head-[1-4]$/.test(action.multipartHeadId) ? {...token,size:1,creatureSize:'中型'} : undefined
  const index=state.heads.filter(head=>head.alive).findIndex(head=>head.id===action.multipartHeadId)
  return index<0 ? undefined : multipartTokenHeadProjections(token,map)[index]
}

/** Union footprint ensures any number of intersecting heads still selects one ID. */
export function multipartTokenOccupiedCells(token: Token, map: BattleMap): GridCell[] {
  const byKey = new Map(tokenOccupiedCellsAt(token, map, token).map(cell => [cellKey(cell), cell]))
  for (const head of multipartTokenHeadProjections(token, map)) {
    const steps = Math.max(1, Math.ceil(Math.hypot(head.x-token.x, head.y-token.y) / (map.gridSize/2)))
    for (let i=1;i<=steps;i++) {
      const point = {x:token.x+(head.x-token.x)*i/steps,y:token.y+(head.y-token.y)*i/steps}
      for (const cell of tokenOccupiedCellsAt(head, map, point)) byKey.set(cellKey(cell),cell)
    }
  }
  return [...byKey.values()]
}

/** Sample continuous necks at half-cell intervals, including their vertical coordinates. */
export function multipartTokenSurfaceProjections(token:Token,map:Pick<BattleMap,'gridSize'|'feetPerCell'>):Token[] {
  if(token.multipartProjection || !token.dnd5eCombatState?.monsterMultipart)return [token]
  const units=map.gridSize/(map.feetPerCell??5),parts=token.dnd5eCombatState.monsterMultipart
  const result:Token[]=[{...token,multipartProjection:true}]
  for(const head of parts.heads.filter(h=>h.alive)) {
    const dx=head.position.x-parts.body.x,dy=head.position.y-parts.body.y,dz=head.position.z-parts.body.z
    const steps=Math.min(240,Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/2.5)))
    for(let i=1;i<=steps;i++)result.push({...token,multipartProjection:true,size:1,creatureSize:'中型',
      x:token.x+dx*units*i/steps,y:token.y+dy*units*i/steps,elevationFeet:(token.elevationFeet??0)+dz*i/steps})
  }
  return result
}
