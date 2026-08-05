import { cellKey, cellTopLeft } from '../../lib/gridCombat'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'
import { areaSeed, nextAreaRandom } from './deterministicAreaRandom'

export interface ToxicCloudPuff {
  x: number
  y: number
  radius: number
  phase: number
  speed: number
  drift: number
  color: string
}

export function toxicCloudPuffs(area: Dnd5ePluginArea, map: BattleMap): ToxicCloudPuff[] {
  const grid = Math.max(1, map.gridSize)
  const intensity = area.visual?.intensity ?? 'normal'
  const multiplier = intensity === 'subtle' ? 1.4 : intensity === 'strong' ? 3.2 : 2.2
  const count = Math.min(84, Math.max(8, Math.ceil(area.cells.length * multiplier)))
  const colors = [area.color, '#84cc16', '#4d7c0f', '#bef264', '#365314']
  let seed = areaSeed(`${area.id}:${area.cells.map(cellKey).join('|')}`)
  return Array.from({ length: count }, (_, index) => {
    let random
    ;[seed, random] = nextAreaRandom(seed)
    const cell = area.cells[Math.floor(random * area.cells.length)]
    const topLeft = cellTopLeft(cell, map)
    ;[seed, random] = nextAreaRandom(seed)
    const x = topLeft.x + grid * (0.16 + random * 0.68)
    ;[seed, random] = nextAreaRandom(seed)
    const y = topLeft.y + grid * (0.18 + random * 0.64)
    ;[seed, random] = nextAreaRandom(seed)
    const radius = grid * (0.13 + random * 0.17)
    ;[seed, random] = nextAreaRandom(seed)
    const phase = random * Math.PI * 2
    ;[seed, random] = nextAreaRandom(seed)
    const speed = 0.42 + random * 0.48
    ;[seed, random] = nextAreaRandom(seed)
    const drift = grid * (0.025 + random * 0.065)
    return { x, y, radius, phase, speed, drift, color: colors[index % colors.length] }
  })
}
