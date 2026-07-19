import {
  DND5E_STANDARD_CONDITIONS,
  type Dnd5eStandardConditionId,
} from '../../rulesets/dnd5e/conditions'

export interface Dnd5eConditionMarkerStyle {
  glyph: string
  fill: string
  stroke: string
  text: string
}

/** 地图 Token 使用的紧凑矢量徽标；正文名称仍来自 SRD 标准状态表。 */
export const DND5E_CONDITION_MARKERS: Readonly<Record<Dnd5eStandardConditionId, Dnd5eConditionMarkerStyle>> = {
  blinded: { glyph: '◉', fill: '#312e81', stroke: '#a5b4fc', text: '#eef2ff' },
  charmed: { glyph: '♥', fill: '#831843', stroke: '#f9a8d4', text: '#fdf2f8' },
  deafened: { glyph: '♪', fill: '#164e63', stroke: '#67e8f9', text: '#ecfeff' },
  frightened: { glyph: '!', fill: '#581c87', stroke: '#d8b4fe', text: '#faf5ff' },
  grappled: { glyph: '⌁', fill: '#7c2d12', stroke: '#fdba74', text: '#fff7ed' },
  incapacitated: { glyph: '×', fill: '#334155', stroke: '#cbd5e1', text: '#f8fafc' },
  invisible: { glyph: '◇', fill: '#134e4a', stroke: '#5eead4', text: '#f0fdfa' },
  paralyzed: { glyph: 'ϟ', fill: '#4c1d95', stroke: '#c4b5fd', text: '#f5f3ff' },
  petrified: { glyph: '◆', fill: '#3f3f46', stroke: '#d4d4d8', text: '#fafafa' },
  poisoned: { glyph: '☠', fill: '#14532d', stroke: '#86efac', text: '#f0fdf4' },
  prone: { glyph: '↘', fill: '#713f12', stroke: '#fde047', text: '#fefce8' },
  restrained: { glyph: '#', fill: '#7f1d1d', stroke: '#fca5a5', text: '#fef2f2' },
  stunned: { glyph: '✦', fill: '#713f12', stroke: '#facc15', text: '#fefce8' },
  unconscious: { glyph: '☾', fill: '#1e1b4b', stroke: '#a5b4fc', text: '#eef2ff' },
}

export function dnd5eConditionMarkerTitle(condition: Dnd5eStandardConditionId): string {
  return DND5E_STANDARD_CONDITIONS[condition].label
}
