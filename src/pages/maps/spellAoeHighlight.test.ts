import { describe, expect, it } from 'vitest'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import type { BattleMap } from '../../store/maps'
import {
  buildGuessedSpellTargetHighlight,
  buildSpellOrSkillAoeHighlight,
} from './spellAoeHighlight'

const map: BattleMap = {
  id: 'map-1',
  name: '测试地图',
  width: 800,
  height: 600,
  gridSize: 50,
  gridOffsetX: 10,
  gridOffsetY: 20,
  showGrid: true,
  feetPerCell: 5,
  tokens: [],
}

describe('spellAoeHighlight', () => {
  it('projects a point circle into stable grid and pixel highlights', () => {
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: { shape: 'circle', origin: 'point', radiusFeet: 10, placeRangeFeet: 30 },
      previewCell: { col: 3, row: 2 },
      casterCell: { col: 1, row: 1 },
      map,
      rectRotation: 0,
      spellTargeting: null,
    })

    expect(highlight).toMatchObject({
      valid: true,
      variant: 'attack',
      areaCircle: { centerX: 185, centerY: 145, radiusPx: 100 },
    })
    expect(highlight?.cells.length).toBeGreaterThan(1)
    expect(highlight?.rangeCells?.length).toBeGreaterThan(highlight?.cells.length ?? 0)
  })

  it('renders committed Meteor Swarm origins without expanding a one-mile range into millions of cells', () => {
    const spellTargeting = {
      characterId: 'wizard', spellId: 'meteor-swarm', slotLevel: 9,
      maximumTargets: 100, allowDuplicateTargets: false, targetTokenIds: [],
      overchannel: false, empowered: false, draconicResistance: false, repellingBlast: false,
      canSculpt: false, maximumSculptedTargets: 0, sculptedTargetIds: [], sculpting: false,
      maximumCarefulTargets: 0, carefulTargetIds: [], carefulSelecting: false, heightenedSelecting: false,
      area: { shape: 'circle', origin: 'point', radiusFeet: 40, placeRangeFeet: 5_280 },
      areaTargetCount: 4,
      areaTargetCells: [{ col: 2, row: 2 }, { col: 6, row: 2 }, { col: 10, row: 2 }],
    } satisfies Dnd5eSpellTargetingSession
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: spellTargeting.area,
      previewCell: { col: 13, row: 2 },
      casterCell: { col: 1, row: 1 },
      map,
      rectRotation: 0,
      spellTargeting,
    })

    expect(highlight?.valid).toBe(true)
    expect(highlight?.rangeCells).toBeUndefined()
    expect(highlight?.committedAreaCircles).toHaveLength(3)
    expect(highlight?.committedAreaCircles?.[0]).toMatchObject({ centerX: 135, centerY: 145, radiusPx: 400 })
  })

  it('uses the spell range when previewing a guessed target cell', () => {
    const targeting = {
      spellId: 'fire-bolt',
      guessedTargeting: true,
      area: undefined,
      areaTargetSelected: true,
    } as Dnd5eSpellTargetingSession
    const inRange = buildGuessedSpellTargetHighlight({
      targeting,
      previewCell: { col: 6, row: 1 },
      casterCell: { col: 1, row: 1 },
      map,
      spell: { id: 'fire-bolt', allowsGuessedTargetCell: true, rangeFeet: 30 },
    })
    const outOfRange = buildGuessedSpellTargetHighlight({
      targeting,
      previewCell: { col: 8, row: 1 },
      casterCell: { col: 1, row: 1 },
      map,
      spell: { id: 'fire-bolt', allowsGuessedTargetCell: true, rangeFeet: 30 },
    })

    expect(inRange?.valid).toBe(true)
    expect(outOfRange?.valid).toBe(false)
  })

  it('separates a 5-by-60-foot Wall of Fire from its selected 10-foot burning side and cast range', () => {
    const spellTargeting = {
      characterId: 'wizard',
      spellId: 'wall-of-fire',
      slotLevel: 4,
      maximumTargets: 1,
      allowDuplicateTargets: false,
      targetTokenIds: [],
      overchannel: false,
      empowered: false,
      draconicResistance: false,
      repellingBlast: false,
      canSculpt: false,
      maximumSculptedTargets: 0,
      sculptedTargetIds: [],
      sculpting: false,
      maximumCarefulTargets: 0,
      carefulTargetIds: [],
      carefulSelecting: false,
      heightenedSelecting: false,
      area: { shape: 'rect', origin: 'point', widthFeet: 60, heightFeet: 5, placeRangeFeet: 120, rotatable: true },
      wallOfFireShape: 'line',
      wallOfFireAngleDegrees: 0,
      wallOfFireDamagingSide: 'left',
    } satisfies Dnd5eSpellTargetingSession
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: spellTargeting.area,
      previewCell: { col: 7, row: 5 },
      casterCell: { col: 3, row: 5 },
      map,
      rectRotation: 0,
      spellTargeting,
    })

    expect(highlight?.cells).toHaveLength(12)
    expect(highlight?.hazardCells).toHaveLength(24)
    expect(highlight?.rangeCells?.length).toBeGreaterThan(highlight?.cells.length ?? 0)
    expect(new Set(highlight?.cells.map((cell) => cell.row))).toEqual(new Set([5]))
    expect(new Set(highlight?.hazardCells?.map((cell) => cell.row))).toEqual(new Set([6, 7]))
  })
})
