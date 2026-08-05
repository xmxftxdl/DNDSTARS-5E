import { describe, expect, it } from 'vitest'
import {
  dnd5eCustomSpellHeadlessRangePatch,
  dnd5eCustomSpellRangeSummary,
  inferDnd5eCustomSpellRangeFromText,
} from './dnd5eCustomSpellRangeModel'

describe('custom spell range authoring', () => {
  it('turns a self-centered radius into a zero-placement Headless area', () => {
    expect(dnd5eCustomSpellHeadlessRangePatch({
      rangeType: 'self',
      rangeFeet: 60,
      rangeShape: 'radius',
      rangeSizeFeet: 5,
      rangeWidthFeet: 60,
      rangeHeightFeet: 5,
      rangeRotatable: true,
      currentRangeFeet: 60,
      currentAreaWidthFeet: 5,
    })).toEqual({
      targetingKind: 'area',
      rangeFeet: 0,
      areaShape: 'circle',
      areaRadiusFeet: 5,
    })
  })

  it('keeps a distance line target and exposes a readable summary', () => {
    expect(dnd5eCustomSpellHeadlessRangePatch({
      rangeType: 'distance',
      rangeFeet: 120,
      rangeShape: 'line',
      rangeSizeFeet: 60,
      rangeWidthFeet: 60,
      rangeHeightFeet: 5,
      rangeRotatable: true,
      currentRangeFeet: 60,
      currentAreaWidthFeet: 5,
    })).toMatchObject({ targetingKind: 'area', rangeFeet: 120, areaShape: 'line', areaLengthFeet: 60 })
    expect(dnd5eCustomSpellRangeSummary({
      rangeType: 'distance', rangeFeet: 120, rangeShape: 'line', rangeSizeFeet: 60,
      rangeWidthFeet: 60, rangeHeightFeet: 5, rangeRotatable: true,
    })).toBe('120 尺（60 尺线形）')
  })

  it('turns a remote rectangular wall into a freely rotatable Headless template', () => {
    const input = {
      rangeType: 'distance' as const,
      rangeFeet: 120,
      rangeShape: 'rect' as const,
      rangeSizeFeet: 5,
      rangeWidthFeet: 60,
      rangeHeightFeet: 5,
      rangeRotatable: true,
      currentRangeFeet: 60,
      currentAreaWidthFeet: 5,
    }
    expect(dnd5eCustomSpellHeadlessRangePatch(input)).toEqual({
      targetingKind: 'area', rangeFeet: 120, areaShape: 'rect',
      areaWidthFeet: 60, areaHeightFeet: 5, areaRotatable: true,
    })
    expect(dnd5eCustomSpellRangeSummary(input)).toBe('120 尺（60×5 尺长方形，可旋转）')
  })

  it('recognizes a pasted self-centered five-foot radius', () => {
    expect(inferDnd5eCustomSpellRangeFromText([
      '施法时间: 1动作',
      '施法距离: 自身（5尺半径）',
      '持续时间: 立即',
    ].join('\n'))).toEqual({ rangeType: 'self', rangeShape: 'radius', rangeSizeFeet: 5 })
  })
})
