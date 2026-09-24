import { describe, expect, it } from 'vitest'
import { spellAreaSpatialTargets } from './spellAreaSpatialTargets'
import type { BattleMap, Token } from '../../store/maps'
import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import type { SkillAoeTargeting } from '../../lib/skillTargeting'
const source: Token = { id: 'caster', label: 'caster', type: 'player', characterId: 'wizard', size: 1, x: 25, y: 25, color: '', emoji: '' }
const ground: Token = { ...source, id: 'ground', type: 'enemy', characterId: undefined, x: 125, elevationFeet: 0 }
const air: Token = { ...ground, id: 'air', elevationFeet: 40 }
const map: BattleMap = { id: 'map', name: 'map', width: 1000, height: 1000, gridSize: 50,
  gridOffsetX: 0, gridOffsetY: 0, feetPerCell: 5, showGrid: true, tokens: [source, ground, air] }
function targets(spellId: string, area: SkillAoeTargeting, height?: number) {
  return spellAreaSpatialTargets({
    targeting: { spellId, area, targetElevationFeet: height } as Dnd5eSpellTargetingSession,
    map, source, casterCell: { col: 0, row: 0 }, anchor: { col: 2, row: 0 }, rotation: 0,
  }).map((token) => token.id)
}
describe('spell area spatial preview', () => {
  it.each(['fireball', 'shatter'])('%s separates stacked targets at the declared height', (id) => {
    const area = { shape: 'circle' as const, origin: 'point' as const, radiusFeet: 10 }
    expect(targets(id, area, 40)).toEqual(['air'])
    expect(targets(id, area)).toContain('ground')
    expect(targets(id, area)).not.toContain('air')
  })
  it('uses the rectangular column height for hypnotic pattern', () => {
    const area = { shape: 'rect' as const, origin: 'point' as const, widthFeet: 30, heightFeet: 30 }
    expect(targets('hypnotic-pattern', area, 40)).toEqual(['air'])
    expect(targets('hypnotic-pattern', area, 0)).not.toContain('air')
  })
  it('keeps ground effects attached to terrain', () => {
    expect(targets('grease', { shape: 'rect', origin: 'point', widthFeet: 10, heightFeet: 10 }))
      .toEqual(['ground'])
  })
  it('pitches a self-origin cone toward the chosen elevation', () => {
    const nearAir = { ...air, elevationFeet: 10 }
    const result = spellAreaSpatialTargets({
      targeting: { spellId: 'burning-hands', targetElevationFeet: 60,
        area: { shape: 'cone', origin: 'self', lengthFeet: 15 } } as Dnd5eSpellTargetingSession,
      map: { ...map, tokens: [ground, nearAir] }, source, casterCell: { col: 0, row: 0 },
      anchor: { col: 3, row: 0 }, rotation: 0,
    })
    expect(result.map((token) => token.id)).not.toContain('ground')
  })
})
