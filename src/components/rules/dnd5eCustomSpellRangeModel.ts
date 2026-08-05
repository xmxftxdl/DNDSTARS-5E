export type Dnd5eCustomSpellRangeType = 'self' | 'touch' | 'distance' | 'sight' | 'unlimited' | 'special'
export type Dnd5eCustomSpellRangeShape = 'none' | 'cone' | 'cube' | 'cylinder' | 'line' | 'radius' | 'rect' | 'sphere'

export interface Dnd5eCustomSpellHeadlessRangeInput {
  rangeType: Dnd5eCustomSpellRangeType
  rangeFeet: number
  rangeShape: Dnd5eCustomSpellRangeShape
  rangeSizeFeet: number
  rangeWidthFeet: number
  rangeHeightFeet: number
  rangeRotatable: boolean
  currentRangeFeet: number
  currentAreaWidthFeet: number
}

export interface Dnd5eCustomSpellHeadlessRangePatch {
  targetingKind: 'self' | 'single-creature' | 'area'
  rangeFeet: number
  areaShape?: 'circle' | 'cone' | 'line' | 'rect'
  areaRadiusFeet?: number
  areaWidthFeet?: number
  areaHeightFeet?: number
  areaLengthFeet?: number
  areaRotatable?: boolean
}

export interface Dnd5eInferredCustomSpellRange {
  rangeType: Dnd5eCustomSpellRangeType
  rangeFeet?: number
  rangeShape?: Dnd5eCustomSpellRangeShape
  rangeSizeFeet?: number
  rangeWidthFeet?: number
  rangeHeightFeet?: number
  rangeRotatable?: boolean
}

/** Reads common Chinese stat-block range lines without inventing missing data. */
export function inferDnd5eCustomSpellRangeFromText(text: string): Dnd5eInferredCustomSpellRange | undefined {
  const line = text.match(/(?:施法距离|施法射程|射程)\s*[:：]\s*([^\r\n]+)/i)?.[1]?.trim()
  if (!line) return undefined
  const rangeType: Dnd5eCustomSpellRangeType = /自身/.test(line)
    ? 'self'
    : /触及|接触/.test(line)
      ? 'touch'
      : /视线/.test(line)
        ? 'sight'
        : /无限/.test(line)
          ? 'unlimited'
          : /\d+\s*(?:尺|英尺|ft\.?)/i.test(line)
            ? 'distance'
            : 'special'
  const shape: Dnd5eCustomSpellRangeShape | undefined = /锥/.test(line)
    ? 'cone'
    : /长方形|矩形|墙/.test(line)
      ? 'rect'
    : /立方/.test(line)
      ? 'cube'
      : /圆柱/.test(line)
        ? 'cylinder'
        : /线形|直线/.test(line)
          ? 'line'
          : /球形|球状/.test(line)
            ? 'sphere'
            : /半径/.test(line)
              ? 'radius'
              : undefined
  const values = [...line.matchAll(/(\d+)\s*(?:尺|英尺|ft\.?)/gi)].map((match) => Number(match[1]))
  const firstFeet = values[0]
  const shapeFeet = rangeType === 'distance' && values.length > 1 ? values[values.length - 1] : firstFeet
  const rectDimensions = shape === 'rect' && values.length >= 2
    ? rangeType === 'distance' && values.length >= 3
      ? values.slice(-2)
      : values.slice(0, 2)
    : undefined
  return {
    rangeType,
    ...(rangeType === 'distance' && firstFeet ? { rangeFeet: firstFeet } : {}),
    ...(shape ? { rangeShape: shape, rangeSizeFeet: shapeFeet || 5 } : {}),
    ...(rectDimensions ? {
      rangeWidthFeet: rectDimensions[0] || 5,
      rangeHeightFeet: rectDimensions[1] || 5,
      rangeRotatable: rangeType !== 'self',
    } : {}),
  }
}

function placementRange(input: Dnd5eCustomSpellHeadlessRangeInput): number {
  if (input.rangeType === 'self') return 0
  if (input.rangeType === 'touch') return 5
  if (input.rangeType === 'distance') return input.rangeFeet
  if (input.rangeType === 'sight' || input.rangeType === 'unlimited') return 10_000
  return input.currentRangeFeet
}

/**
 * Makes spell range metadata the source of truth for the linked Headless action.
 * This prevents a self-centered area spell from silently retaining the editor's
 * legacy 60-foot single-target defaults.
 */
export function dnd5eCustomSpellHeadlessRangePatch(
  input: Dnd5eCustomSpellHeadlessRangeInput,
): Dnd5eCustomSpellHeadlessRangePatch {
  if (input.rangeShape === 'none') {
    if (input.rangeType === 'self') return { targetingKind: 'self', rangeFeet: 0 }
    return { targetingKind: 'single-creature', rangeFeet: placementRange(input) }
  }

  const size = Math.max(1, input.rangeSizeFeet)
  const common = { targetingKind: 'area' as const, rangeFeet: placementRange(input) }
  if (input.rangeShape === 'cone') return { ...common, areaShape: 'cone', areaLengthFeet: size }
  if (input.rangeShape === 'line') return {
    ...common,
    areaShape: 'line',
    areaLengthFeet: size,
    areaWidthFeet: Math.max(1, input.currentAreaWidthFeet),
  }
  if (input.rangeShape === 'cube') return {
    ...common,
    areaShape: 'rect',
    areaWidthFeet: size,
    areaHeightFeet: size,
  }
  if (input.rangeShape === 'rect') return {
    ...common,
    areaShape: 'rect',
    areaWidthFeet: Math.max(1, input.rangeWidthFeet),
    areaHeightFeet: Math.max(1, input.rangeHeightFeet),
    areaRotatable: input.rangeType !== 'self' && input.rangeRotatable,
  }
  return { ...common, areaShape: 'circle', areaRadiusFeet: size }
}

export function dnd5eCustomSpellRangeSummary(input: Pick<
  Dnd5eCustomSpellHeadlessRangeInput,
  'rangeType' | 'rangeFeet' | 'rangeShape' | 'rangeSizeFeet' | 'rangeWidthFeet' | 'rangeHeightFeet' | 'rangeRotatable'
>): string {
  const origin = input.rangeType === 'self'
    ? '自身'
    : input.rangeType === 'touch'
      ? '触及'
      : input.rangeType === 'distance'
        ? `${input.rangeFeet} 尺`
        : input.rangeType === 'sight'
          ? '视线'
          : input.rangeType === 'unlimited'
            ? '无限'
            : '特殊'
  if (input.rangeShape === 'none') return origin
  if (input.rangeShape === 'rect') {
    return `${origin}（${input.rangeWidthFeet}×${input.rangeHeightFeet} 尺长方形${input.rangeType !== 'self' && input.rangeRotatable ? '，可旋转' : ''}）`
  }
  const shape = {
    cone: '锥形', cube: '立方体', cylinder: '圆柱', line: '线形', radius: '半径', sphere: '球形',
  }[input.rangeShape]
  return `${origin}（${input.rangeSizeFeet} 尺${shape}）`
}
