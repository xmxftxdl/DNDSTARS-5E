import type { BattleMap, Token } from '../../store/maps'
import {
  occupiedCells,
  tokenAnchorCellFromPixel,
  tokenCenterForAnchorCell,
  tokenFootprintDistanceCells,
  tokenOccupiedCellsAt,
  type GridCell,
} from '../../lib/gridCombat'
import { dnd5eMonsterMapSpeed, getDnd5eSrdMonster, type Dnd5eMonsterAction } from './monsters'
import { mapGeometryMovementBlocked, mapGeometryRuntimeForMap } from '../../lib/mapGeometry'

function monsterTraversalGeometry(mapId: string) {
  const geometry = mapGeometryRuntimeForMap(mapId)
  return geometry ? {
    ...geometry,
    doors: geometry.doors.map((door) => door.state === 'closed' ? { ...door, state: 'open' as const } : door),
  } : undefined
}

export interface Dnd5eMonsterTurnPlan {
  moved: boolean
  /** Turned undead use their action to Dash while fleeing. */
  dashed?: boolean
  moveApSpent?: number
  newPosition?: { x: number; y: number }
  attacked: boolean
  attackerTokenId?: string
  targetTokenId?: string
  actionIndex?: number
  attack?: {
    values: number[]
    sides: number
    bonus: number
    total: number
    label: string
    targetName: string
  }
  damageType?: 'physical'
  targetCharacterId?: string
  damage?: number
  message: string
}

function nearestTarget(enemy: Token, targets: readonly Token[], map: BattleMap): Token | undefined {
  return targets.reduce<Token | undefined>((nearest, target) => {
    if (!nearest) return target
    return tokenFootprintDistanceCells(enemy, target, map) < tokenFootprintDistanceCells(enemy, nearest, map)
      ? target
      : nearest
  }, undefined)
}

function moveToward(
  start: GridCell,
  target: Token,
  map: BattleMap,
  tokens: readonly Token[],
  enemy: Token,
  maxSteps: number,
): GridCell {
  const blocked = occupiedCells([...tokens], map, enemy.id)
  const columns = Math.max(1, Math.floor(map.width / map.gridSize))
  const rows = Math.max(1, Math.floor(map.height / map.gridSize))
  const footprintCells = Math.max(1, Math.round(Math.sqrt(tokenOccupiedCellsAt(enemy, map, enemy).length)))
  const directions = [-1, 0, 1].flatMap((dc) => [-1, 0, 1].flatMap((dr) =>
    dc === 0 && dr === 0 ? [] : [{ dc, dr }],
  ))
  const queue: Array<{ cell: GridCell; steps: number }> = [{ cell: start, steps: 0 }]
  const visited = new Set([`${start.col},${start.row}`])
  let best = start
  let bestDistance = tokenFootprintDistanceCells(enemy, target, map)

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const current = queue[queueIndex]
    if (current.steps >= maxSteps) continue
    for (const { dc, dr } of directions) {
      const next = { col: current.cell.col + dc, row: current.cell.row + dr }
      const key = `${next.col},${next.row}`
      if (visited.has(key)) continue
      visited.add(key)
      if (
        next.col < 0 || next.row < 0 ||
        next.col + footprintCells > columns || next.row + footprintCells > rows
      ) continue
      const position = tokenCenterForAnchorCell(next, enemy, map)
      const candidate = { ...enemy, ...position }
      if (tokenOccupiedCellsAt(candidate, map, candidate).some((cell) => blocked.has(`${cell.col},${cell.row}`))) continue
      const currentPosition = tokenCenterForAnchorCell(current.cell, enemy, map)
      if (mapGeometryMovementBlocked({
        geometry: monsterTraversalGeometry(map.id), map, token: { ...enemy, ...currentPosition }, to: position,
      }).blocked) continue
      const steps = current.steps + 1
      queue.push({ cell: next, steps })
      const distance = tokenFootprintDistanceCells(candidate, target, map)
      if (distance < bestDistance) {
        best = next
        bestDistance = distance
      }
    }
  }
  return best
}

function moveAway(
  start: GridCell,
  source: GridCell,
  map: BattleMap,
  tokens: readonly Token[],
  enemy: Token,
  maxSteps: number,
): GridCell {
  let current = start
  const blocked = occupiedCells([...tokens], map, enemy.id)
  const columns = Math.max(1, Math.floor(map.width / map.gridSize))
  const rows = Math.max(1, Math.floor(map.height / map.gridSize))
  const directions = [-1, 0, 1].flatMap((dc) => [-1, 0, 1].flatMap((dr) =>
    dc === 0 && dr === 0 ? [] : [{ dc, dr }],
  ))
  for (let index = 0; index < maxSteps; index += 1) {
    const currentDistance = (current.col - source.col) ** 2 + (current.row - source.row) ** 2
    const next = directions
      .map(({ dc, dr }) => ({ col: current.col + dc, row: current.row + dr }))
      .filter((candidate) => {
        if (candidate.col < 0 || candidate.row < 0 || candidate.col >= columns || candidate.row >= rows) return false
        const position = tokenCenterForAnchorCell(candidate, enemy, map)
        const placed = { ...enemy, ...position }
        if (tokenOccupiedCellsAt(placed, map, placed).some((cell) => blocked.has(`${cell.col},${cell.row}`))) return false
        const currentPosition = tokenCenterForAnchorCell(current, enemy, map)
        return !mapGeometryMovementBlocked({
          geometry: monsterTraversalGeometry(map.id), map, token: { ...enemy, ...currentPosition }, to: position,
        }).blocked
      })
      .sort((left, right) =>
        ((right.col - source.col) ** 2 + (right.row - source.row) ** 2) -
        ((left.col - source.col) ** 2 + (left.row - source.row) ** 2),
      )[0]
    if (!next) break
    const nextDistance = (next.col - source.col) ** 2 + (next.row - source.row) ** 2
    if (nextDistance <= currentDistance) break
    current = next
  }
  return current
}

function attackRangeFeet(action: Dnd5eMonsterAction): number {
  if (action.kind === 'multiattack') return 5
  return action.attack?.rangeFeet?.normal ?? action.attack?.reachFeet ?? 0
}

function selectAction(monsterId: string, distanceFeet: number): { action: Dnd5eMonsterAction; index: number } | undefined {
  const monster = getDnd5eSrdMonster(monsterId)
  if (!monster) return undefined
  const rangedIndex = monster.actions.findIndex((action) =>
    action.kind === 'weapon-attack' && action.attack?.rangeFeet && distanceFeet <= action.attack.rangeFeet.normal,
  )
  if (distanceFeet > 5 && rangedIndex >= 0) return { action: monster.actions[rangedIndex], index: rangedIndex }
  const multiattackIndex = monster.actions.findIndex((action) => action.kind === 'multiattack' && distanceFeet <= attackRangeFeet(action))
  if (multiattackIndex >= 0) return { action: monster.actions[multiattackIndex], index: multiattackIndex }
  const meleeIndex = monster.actions.findIndex((action) =>
    action.kind === 'weapon-attack' && (action.attack?.reachFeet ?? 0) >= distanceFeet,
  )
  if (meleeIndex >= 0) return { action: monster.actions[meleeIndex], index: meleeIndex }
  if (rangedIndex >= 0) return { action: monster.actions[rangedIndex], index: rangedIndex }
  return undefined
}

function attackPreview(action: Dnd5eMonsterAction, monsterId: string, target: Token, index: number, moved: boolean, position?: { x: number; y: number }): Dnd5eMonsterTurnPlan {
  const monster = getDnd5eSrdMonster(monsterId)!
  const firstAction = action.kind === 'multiattack'
    ? monster.actions.find((candidate) => candidate.id === action.sequence?.[0])
    : action
  const damage = firstAction?.attack?.damage[0]
  if (!damage) return { moved, newPosition: position, attacked: false, message: `${monster.name} 没有可结算的攻击。` }
  return {
    moved,
    newPosition: position,
    attacked: true,
    attackerTokenId: '',
    targetTokenId: target.id,
    actionIndex: index,
    attack: {
      values: [],
      sides: damage.sides,
      bonus: damage.bonus,
      total: damage.average,
      label: `${action.name} ${damage.count}d${damage.sides}${damage.bonus >= 0 ? '+' : ''}${damage.bonus}`,
      targetName: target.label,
    },
    damageType: 'physical',
    targetCharacterId: target.characterId,
    damage: damage.average,
    message: `${monster.name}${moved ? '移动后' : ''}使用${action.name}攻击 ${target.label}。`,
  }
}

/** 只规划 SRD 怪物的 5e 回合：移动不消耗动作，每回合至多执行一个动作。 */
export function planDnd5eMonsterTurn(map: BattleMap, enemy: Token): Dnd5eMonsterTurnPlan {
  const monster = enemy.poolId ? getDnd5eSrdMonster(enemy.poolId) : undefined
  if (!monster) return { moved: false, attacked: false, message: `${enemy.label} 缺少 SRD 5.1 stat block。` }
  if (enemy.dnd5eCombatState?.turnedByClericId) {
    const source = map.tokens.find((token) => token.id === enemy.dnd5eCombatState?.turnedByClericId)
    if (!source) {
      return { moved: false, attacked: false, message: `${enemy.label} 处于被驱散状态，本回合不能攻击或进行反应。` }
    }
    const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
    const start = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
    const sourceCell = tokenAnchorCellFromPixel(source.x, source.y, source, map)
    const movementCells = Math.max(0, Math.floor(dnd5eMonsterMapSpeed(monster) * 2 / feetPerCell))
    const end = moveAway(start, sourceCell, map, map.tokens, enemy, movementCells)
    const moved = end.col !== start.col || end.row !== start.row
    const position = moved ? tokenCenterForAnchorCell(end, enemy, map) : undefined
    return {
      moved,
      dashed: moved,
      newPosition: position,
      attacked: false,
      attackerTokenId: enemy.id,
      message: moved
        ? `${enemy.label} 受驱散影响，使用疾走尽可能远离 ${source.label}。`
        : `${enemy.label} 无法继续远离 ${source.label}，本回合采取防御且不能进行反应。`,
    }
  }
  const targets = map.tokens.filter((token) =>
    token.id !== enemy.id && token.type !== 'enemy' && token.type !== 'obstacle' && (token.hp ?? 1) > 0,
  )
  const target = nearestTarget(enemy, targets, map)
  if (!target) return { moved: false, attacked: false, message: `${enemy.label} 找不到可攻击目标。` }

  const feetPerCell = Math.max(1, map.feetPerCell ?? 5)
  const startDistanceFeet = tokenFootprintDistanceCells(enemy, target, map) * feetPerCell
  const immediate = selectAction(monster.id, startDistanceFeet)
  if (immediate) {
    return { ...attackPreview(immediate.action, monster.id, target, immediate.index, false), attackerTokenId: enemy.id }
  }

  const start = tokenAnchorCellFromPixel(enemy.x, enemy.y, enemy, map)
  const movementSpeed = dnd5eMonsterMapSpeed(monster)
  const movementCells = Math.max(0, Math.floor(movementSpeed / feetPerCell))
  const end = moveToward(start, target, map, map.tokens, enemy, movementCells)
  const moved = end.col !== start.col || end.row !== start.row
  const position = moved ? tokenCenterForAnchorCell(end, enemy, map) : undefined
  const afterMoveEnemy = position ? { ...enemy, ...position } : enemy
  const distanceFeet = tokenFootprintDistanceCells(afterMoveEnemy, target, map) * feetPerCell
  const selected = selectAction(monster.id, distanceFeet)
  if (!selected) {
    return {
      moved,
      newPosition: position,
      attacked: false,
      message: moved ? `${enemy.label} 移动 ${movementSpeed} 尺以内，但仍无法攻击。` : `${enemy.label} 无法接近目标。`,
    }
  }
  return { ...attackPreview(selected.action, monster.id, target, selected.index, moved, position), attackerTokenId: enemy.id }
}
