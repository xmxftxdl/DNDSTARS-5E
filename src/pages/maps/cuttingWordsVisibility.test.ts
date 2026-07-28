import { afterEach, describe, expect, it } from 'vitest'
import { createEmptyMapGeometry, setMapGeometryRuntime } from '../../lib/mapGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { dnd5eCuttingWordsCanSeeAttacker } from './cuttingWordsVisibility'

const token = (id: string, x: number, y: number): Token => ({
  id,
  label: id,
  x,
  y,
  color: '#fff',
  emoji: '',
  size: 1,
  type: id === 'attacker' ? 'enemy' : 'player',
  hp: 10,
  maxHp: 10,
})

const bard = token('bard', 25, 50)
const attacker = token('attacker', 125, 50)
const map: BattleMap = {
  id: 'cutting-words-visibility',
  name: 'Cutting Words visibility',
  width: 200,
  height: 100,
  gridSize: 10,
  gridOffsetX: 0,
  gridOffsetY: 0,
  feetPerCell: 5,
  showGrid: true,
  tokens: [bard, attacker],
}

describe('Cutting Words visibility', () => {
  afterEach(() => setMapGeometryRuntime([]))

  it('requires the bard to see the attacking creature', () => {
    const geometry = createEmptyMapGeometry(map.id, 1)
    geometry.vision = {
      enabled: true,
      defaultRangeFeet: 60,
      sharePartyVision: true,
      ambientLight: 'bright',
    }
    setMapGeometryRuntime([geometry])
    expect(dnd5eCuttingWordsCanSeeAttacker({ map, bardToken: bard, attackerToken: attacker })).toBe(true)

    geometry.walls = [{
      id: 'blocking-wall',
      kind: 'wall',
      label: 'Blocking wall',
      points: [{ x: 75, y: 0 }, { x: 75, y: 100 }],
      blocksVision: true,
      blocksMovement: true,
      blocksLineOfEffect: true,
      baseHeightFeet: 0,
      heightFeet: 10,
      createdAt: 1,
    }]
    setMapGeometryRuntime([geometry])
    expect(dnd5eCuttingWordsCanSeeAttacker({ map, bardToken: bard, attackerToken: attacker })).toBe(false)
  })
})
