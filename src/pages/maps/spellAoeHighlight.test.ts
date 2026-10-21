import { describe, expect, it } from 'vitest'
import type { Dnd5eSpellTargetingSession } from '../../presentation/maps/useCombatInteraction'
import type { BattleMap } from '../../store/maps'
import {
  buildGuessedSpellTargetHighlight,
  buildSpellOrSkillAoeHighlight,
  isGuessedSpellVisibleTargetCandidate,
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
  it('uses four 2.5-foot cells for a five-foot cube and the same scale for its outline/range', () => {
    const small={...map,feetPerCell:2.5,gridSize:25}
    const targeting={shape:'rect' as const,origin:'point' as const,widthFeet:5,heightFeet:5,gridAligned:true,placeRangeFeet:30}
    const preview=buildSpellOrSkillAoeHighlight({targeting,previewCell:{col:12,row:0},casterCell:{col:0,row:0},map:small,rectRotation:0,spellTargeting:null})!
    expect(preview.valid).toBe(true)
    expect(preview.cells).toHaveLength(4)
    expect(preview.areaPolygon).toEqual([310,20,360,20,360,70,310,70])
    expect(buildSpellOrSkillAoeHighlight({targeting,previewCell:{col:13,row:0},casterCell:{col:0,row:0},map:small,rectRotation:0,spellTargeting:null})!.valid).toBe(false)
  })
  it('previews a fortress footprint without enumerating a one-mile placement range', () => {
    const preview = buildSpellOrSkillAoeHighlight({
      targeting: { shape: 'rect', origin: 'point', widthFeet: 120, heightFeet: 120, gridAligned: true, placeRangeFeet: 5280 },
      previewCell: { col: 14, row: 14 }, casterCell: { col: 0, row: 0 },
      map: { ...map, width: 2000, height: 2000 }, rectRotation: 0, spellTargeting: null,
    })!
    expect(preview.valid).toBe(true)
    expect(preview.cells).toHaveLength(576)
    expect(preview.areaPolygon).toHaveLength(8)
    expect(preview.rangeCells).toBeUndefined()
  })

  it.each([5, 15, 20, 30])('aligns a %s-foot grid rectangle outline with its affected cells regardless of caster direction', (widthFeet) => {
    const polygons = [{ col: 0, row: 0 }, { col: 8, row: 3 }, { col: 3, row: 9 }].map((casterCell) => {
      const preview = buildSpellOrSkillAoeHighlight({
        targeting: { shape: 'rect', origin: 'point', widthFeet, heightFeet: 20, gridAligned: true, placeRangeFeet: 120 },
        previewCell: { col: 4, row: 4 }, casterCell, map, rectRotation: 3, spellTargeting: null,
      })!
      const left = map.gridOffsetX + Math.min(...preview.cells.map((cell) => cell.col)) * map.gridSize
      const top = map.gridOffsetY + Math.min(...preview.cells.map((cell) => cell.row)) * map.gridSize
      const right = map.gridOffsetX + (Math.max(...preview.cells.map((cell) => cell.col)) + 1) * map.gridSize
      const bottom = map.gridOffsetY + (Math.max(...preview.cells.map((cell) => cell.row)) + 1) * map.gridSize
      expect(preview.areaPolygon).toEqual([left, top, right, top, right, bottom, left, bottom])
      return preview.areaPolygon
    })
    expect(polygons[1]).toEqual(polygons[0])
    expect(polygons[2]).toEqual(polygons[0])
  })

  it('allows Sanctuary and Dispel Magic to select the caster in guessed-cell mode', () => {
    const candidate = {
      actorTokenId: 'cleric-token',
      candidateTokenId: 'cleric-token',
      candidateType: 'player',
      opposed: false,
    }

    expect(isGuessedSpellVisibleTargetCandidate({ ...candidate, spellId: 'sanctuary' })).toBe(true)
    expect(isGuessedSpellVisibleTargetCandidate({ ...candidate, spellId: 'dispel-magic' })).toBe(true)
    expect(isGuessedSpellVisibleTargetCandidate({ ...candidate, spellId: 'fire-bolt' })).toBe(false)
  })

  it('keeps guessed-cell targeting restricted to visible legal creature candidates', () => {
    const candidate = {
      spellId: 'sanctuary',
      actorTokenId: 'cleric-token',
      candidateTokenId: 'ally-token',
      candidateType: 'player',
      opposed: false,
    }

    expect(isGuessedSpellVisibleTargetCandidate(candidate)).toBe(true)
    expect(isGuessedSpellVisibleTargetCandidate({
      ...candidate,
      perceptionVisibility: 'detected-unseen',
    })).toBe(false)
    expect(isGuessedSpellVisibleTargetCandidate({
      ...candidate,
      candidateType: 'obstacle',
    })).toBe(false)
    expect(isGuessedSpellVisibleTargetCandidate({
      ...candidate,
      spellId: 'fire-bolt',
    })).toBe(false)
  })

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

  it('renders a 500-foot roar as one vector circle instead of thirty-thousand grid nodes', () => {
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: { shape: 'circle', origin: 'self', radiusFeet: 500 },
      previewCell: { col: 1, row: 1 },
      casterCell: { col: 1, row: 1 },
      map,
      rectRotation: 0,
      spellTargeting: null,
    })

    expect(highlight).toMatchObject({
      cells: [],
      valid: true,
      variant: 'range',
      areaCircle: { centerX: 85, centerY: 95, radiusPx: 5_000 },
    })
  })

  it('keeps a committed Prismatic Spray cone fixed while Sculpt Spells selects creatures', () => {
    const area = { shape: 'cone', origin: 'self', lengthFeet: 60 } as const
    const committedCell = { col: 7, row: 1 }
    const casterCell = { col: 1, row: 1 }
    const spellTargeting = {
      characterId: 'wizard', spellId: 'prismatic-spray', slotLevel: 7,
      maximumTargets: 256, allowDuplicateTargets: false, targetTokenIds: [],
      overchannel: false, empowered: false, draconicResistance: false, repellingBlast: false,
      canSculpt: true, maximumSculptedTargets: 8, sculptedTargetIds: [], sculpting: false,
      maximumCarefulTargets: 0, carefulTargetIds: [], carefulSelecting: false,
      heightenedSelecting: false, area, areaTargetSelected: true, areaTargetCell: committedCell,
    } satisfies Dnd5eSpellTargetingSession
    const frozen = buildSpellOrSkillAoeHighlight({
      targeting: area,
      // Simulate the pointer moving north after the east-facing cone was committed,
      // including the real transition where the modifier toggle can be momentarily off.
      previewCell: { col: 1, row: 7 },
      casterCell,
      map,
      rectRotation: 0,
      spellTargeting,
    })
    const committed = buildSpellOrSkillAoeHighlight({
      targeting: area,
      previewCell: committedCell,
      casterCell,
      map,
      rectRotation: 0,
      spellTargeting: null,
    })

    expect(frozen?.areaPolygon).toEqual(committed?.areaPolygon)
    expect(frozen?.cells).toEqual(committed?.cells)
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

  it('separates an adjustable 5-by-30-foot Wall of Fire from its selected 10-foot burning side and cast range', () => {
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
      wallOfFireLengthFeet: 30,
    } satisfies Dnd5eSpellTargetingSession
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: spellTargeting.area,
      previewCell: { col: 7, row: 5 },
      casterCell: { col: 3, row: 5 },
      map,
      rectRotation: 0,
      spellTargeting,
    })

    expect(highlight?.cells).toHaveLength(6)
    expect(highlight?.hazardCells).toHaveLength(12)
    expect(highlight?.rangeCells?.length).toBeGreaterThan(highlight?.cells.length ?? 0)
    expect(new Set(highlight?.cells.map((cell) => cell.row))).toEqual(new Set([5]))
    expect(new Set(highlight?.hazardCells?.map((cell) => cell.row))).toEqual(new Set([6, 7]))
  })

  it('previews ten contiguous Wall of Force panels using Host panel geometry', () => {
    const spellTargeting = {
      characterId: 'wizard',
      spellId: 'wall-of-force',
      slotLevel: 5,
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
      area: { shape: 'rect', origin: 'point', widthFeet: 100, heightFeet: 5, placeRangeFeet: 120, rotatable: true },
      areaTargetAngleDegrees: 0,
      areaTargetWidthFeet: 100,
      areaTargetCell: {col:10,row:5},
      areaTargetSelected: true,
      stoneWall: {mode:'thick',start:{col:10,row:5},angles:Array(10).fill(0)},
    } satisfies Dnd5eSpellTargetingSession
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: spellTargeting.area,
      previewCell: { col: 10, row: 5 },
      casterCell: { col: 10, row: 5 },
      map: { ...map, width: 2_000 },
      rectRotation: 0,
      spellTargeting,
    })

    expect(highlight?.forceWallPreview).toBe(true)
    expect(highlight?.stoneWallPanels).toHaveLength(10)
    expect(highlight?.stoneWallPanels?.[0].start).toEqual({col:10,row:5})
    expect(highlight?.stoneWallPanels?.[9].end).toEqual({col:30,row:5})
    expect(highlight?.cells).toEqual([])
    expect(highlight?.valid).toBe(true)
  })

  it('keeps Thunderwave freely rotatable while excluding edge-only cells', () => {
    const highlight = buildSpellOrSkillAoeHighlight({
      targeting: { shape: 'line', origin: 'self', widthFeet: 15, lengthFeet: 15, aimRangeFeet: 15 },
      previewCell: { col: 4, row: 3 },
      casterCell: { col: 1, row: 1 },
      map,
      rectRotation: 0,
      spellTargeting: null,
    })

    const polygon = highlight?.areaPolygon
    expect(polygon).toHaveLength(8)
    expect(polygon?.[2]).not.toBeCloseTo(polygon?.[0] ?? 0)
    expect(polygon?.[3]).not.toBeCloseTo(polygon?.[1] ?? 0)
    expect(polygon?.[0]).not.toBeCloseTo(polygon?.[6] ?? 0)
    expect(polygon?.[1]).not.toBeCloseTo(polygon?.[7] ?? 0)
    expect(highlight?.cells).not.toContainEqual({ col: 1, row: 1 })
  })
})

it('draws a point-origin cone from the selected point and selected angle', () => {
  const targeting = { shape: 'cone', origin: 'point', rotatable: true, lengthFeet: 60, placeRangeFeet: 60 } as const
  const preview = buildSpellOrSkillAoeHighlight({ targeting, previewCell:{col:4,row:4}, casterCell:{col:0,row:0}, map, rectRotation:0, rectAngleDegrees:90, spellTargeting:null })!
  expect(preview.cells).toContainEqual({col:8,row:4})
  expect(preview.areaPolygon?.slice(0,2)).toEqual([235,245])
})
