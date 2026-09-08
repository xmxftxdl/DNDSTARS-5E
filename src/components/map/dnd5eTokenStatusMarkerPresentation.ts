import type { Dnd5eConditionMarkerStyle } from './dnd5eConditionMarkers'
import { DND5E_CONDITION_MARKERS } from './dnd5eConditionMarkers'
import {
  dnd5eTokenStatusMarkerDefinition,
  type Dnd5eTokenStatusMarker,
  type Dnd5eTokenStatusMarkerId,
  type Dnd5eTacticalTokenStatusMarkerId,
} from '../../rulesets/dnd5e/tokenStatusMarkers'
import { DND5E_STANDARD_CONDITION_IDS } from '../../rulesets/dnd5e/conditions'
import type { TokenStatusTooltipContent } from './tokenStatusTooltip'

const STANDARD_CONDITION_IDS = new Set<string>(DND5E_STANDARD_CONDITION_IDS)

const TACTICAL_MARKER_STYLES: Readonly<Record<
  Dnd5eTacticalTokenStatusMarkerId,
  Dnd5eConditionMarkerStyle
>> = {
  burning: { glyph: '🔥', fill: '#7c2d12', stroke: '#fb923c', text: '#fff7ed' },
  bleeding: { glyph: '◆', fill: '#7f1d1d', stroke: '#fb7185', text: '#fff1f2' },
  diseased: { glyph: '☣', fill: '#365314', stroke: '#a3e635', text: '#f7fee7' },
  cursed: { glyph: '✦', fill: '#4c1d95', stroke: '#c084fc', text: '#faf5ff' },
  marked: { glyph: '◎', fill: '#1e3a8a', stroke: '#60a5fa', text: '#eff6ff' },
  concentrating: { glyph: '◈', fill: '#312e81', stroke: '#a78bfa', text: '#f5f3ff' },
  silenced: { glyph: '×', fill: '#334155', stroke: '#94a3b8', text: '#f8fafc' },
  slowed: { glyph: '∼', fill: '#164e63', stroke: '#67e8f9', text: '#ecfeff' },
  weakened: { glyph: '−', fill: '#713f12', stroke: '#facc15', text: '#fefce8' },
  protected: { glyph: '◇', fill: '#14532d', stroke: '#4ade80', text: '#f0fdf4' },
  exposed: { glyph: '!', fill: '#7c2d12', stroke: '#fdba74', text: '#fff7ed' },
  hidden: { glyph: '◐', fill: '#134e4a', stroke: '#5eead4', text: '#f0fdfa' },
  disguised: {
    glyph: '幻',
    icon: '/assets/icons/disguise-self-spell-action.png',
    fill: '#4c1d95',
    stroke: '#c4b5fd',
    text: '#faf5ff',
  },
  'fire-averse': { glyph: '火', icon: '/assets/icons/conditions/condition-fire-averse.svg', fill: '#581c87', stroke: '#f0abfc', text: '#fdf4ff' },
  attached: { glyph: '⛓', fill: '#3f3f46', stroke: '#d4d4d8', text: '#fafafa' },
  suffocating: { glyph: '◌', fill: '#164e63', stroke: '#a5f3fc', text: '#ecfeff' },
  'truth-bound': { glyph: '真', fill: '#1e3a8a', stroke: '#93c5fd', text: '#eff6ff' },
  imprisoned: {
    glyph: '禁',
    icon: '/assets/icons/imprisonment-spell-action.png',
    fill: '#312e81',
    stroke: '#c4b5fd',
    text: '#faf5ff',
  },
  'frozen-statue': {
    glyph: '冰',
    icon: '/assets/icons/cone-of-cold-spell-action.png',
    fill: '#0c4a6e',
    stroke: '#7dd3fc',
    text: '#f0f9ff',
  },
  nondetection: {
    glyph: '避',
    icon: '/assets/icons/nondetection-spell-action.png',
    fill: '#172554',
    stroke: '#60a5fa',
    text: '#eff6ff',
  },
  'plane-shifted': {
    glyph: '界',
    icon: '/assets/icons/plane-shift-spell-action.png',
    fill: '#312e81',
    stroke: '#a78bfa',
    text: '#f5f3ff',
  },
}

export function dnd5eTokenStatusMarkerStyle(
  statusId: Dnd5eTokenStatusMarkerId,
): Dnd5eConditionMarkerStyle {
  if (STANDARD_CONDITION_IDS.has(statusId)) {
    return DND5E_CONDITION_MARKERS[statusId as keyof typeof DND5E_CONDITION_MARKERS]
  }
  return TACTICAL_MARKER_STYLES[statusId as Dnd5eTacticalTokenStatusMarkerId] ?? {
    glyph: '自',
    fill: '#312e81',
    stroke: '#c4b5fd',
    text: '#f5f3ff',
  }
}

export function dnd5eTokenStatusMarkerTooltip(
  marker: Dnd5eTokenStatusMarker,
): TokenStatusTooltipContent {
  const definition = dnd5eTokenStatusMarkerDefinition(marker.statusId)
  return {
    title: marker.label ?? definition.label,
    description: marker.detailDescription ?? (marker.mechanical
      ? definition.description
      : `${definition.description} 该图标仅是 Token 标记，不会单独改变 Headless 规则。`),
  }
}
