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
  'fire-averse': { glyph: '↓', fill: '#581c87', stroke: '#f0abfc', text: '#fdf4ff' },
}

export function dnd5eTokenStatusMarkerStyle(
  statusId: Dnd5eTokenStatusMarkerId,
): Dnd5eConditionMarkerStyle {
  if (STANDARD_CONDITION_IDS.has(statusId)) {
    return DND5E_CONDITION_MARKERS[statusId as keyof typeof DND5E_CONDITION_MARKERS]
  }
  return TACTICAL_MARKER_STYLES[statusId as Dnd5eTacticalTokenStatusMarkerId]
}

export function dnd5eTokenStatusMarkerTooltip(
  marker: Dnd5eTokenStatusMarker,
): TokenStatusTooltipContent {
  const definition = dnd5eTokenStatusMarkerDefinition(marker.statusId)
  return {
    title: marker.label ?? definition.label,
    description: `${definition.description} 该图标仅是 Token 标记，不会单独改变 Headless 规则。`,
  }
}
