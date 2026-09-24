import time_stopIcon from './icons/condition-time-stop.svg'
import tiny_hutIcon from './icons/condition-tiny-hut.svg'
import tonguesIcon from './icons/condition-tongues.svg'
import true_seeingIcon from './icons/condition-true-seeing.svg'
import true_strikeIcon from './icons/condition-true-strike.svg'
import vampiric_touchIcon from './icons/condition-vampiric-touch.svg'
import teleportation_circleIcon from './icons/condition-teleportation-circle.svg'
import weakenedIcon from './icons/condition-weakened.svg'
import slowIcon from './icons/condition-slow.svg'
import stoneskinIcon from './icons/condition-stoneskin.svg'
import suggestionIcon from './icons/condition-suggestion.svg'
import telepathicBondIcon from './icons/condition-telepathic-bond.svg'
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
  'slow-spell': { glyph: '缓', icon: slowIcon, fill: '#312e81', stroke: '#c4b5fd', text: '#fff' },
  stoneskin: { glyph: '石', icon: stoneskinIcon, fill: '#334155', stroke: '#cbd5e1', text: '#f8fafc' },
  telekinesis: { glyph: '控', icon: '/assets/icons/telekinesis-spell-action.png', fill: '#312e81', stroke: '#a5b4fc', text: '#eef2ff' },
  suggestion: { glyph: '暗', icon: suggestionIcon, fill: '#4c1d95', stroke: '#c4b5fd', text: '#f5f3ff' },
  symbol: { glyph: '符', icon: '/assets/icons/symbol-spell-action.png', fill: '#4c1d95', stroke: '#c4b5fd', text: '#f5f3ff' },
  'telepathic-bond': { glyph: '联', icon: telepathicBondIcon, fill: '#164e63', stroke: '#67e8f9', text: '#ecfeff' },
  'time-stop': { glyph: '时', icon: time_stopIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'tiny-hut': { glyph: '小', icon: tiny_hutIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'tongues': { glyph: '巧', icon: tonguesIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'true-seeing': { glyph: '真', icon: true_seeingIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'true-strike': { glyph: '克', icon: true_strikeIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'vampiric-touch': { glyph: '吸', icon: vampiric_touchIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'teleportation-circle': { glyph: '传', icon: teleportation_circleIcon, fill: '#172554', stroke: '#67e8f9', text: '#ecfeff' },
  'water-breathing': { glyph: '息', icon: '/assets/icons/water-breathing-spell-action.png', fill: '#164e63', stroke: '#67e8f9', text: '#ecfeff' },
  weird: { glyph: '魇', icon: '/assets/icons/weird-spell-action.png', fill: '#4c1d95', stroke: '#c4b5fd', text: '#faf5ff' },
  web: { glyph: '网', icon: '/assets/icons/web-spell-action.png', fill: '#334155', stroke: '#e2e8f0', text: '#f8fafc' },
  'acid-arrow': { glyph: '酸', icon: '/assets/icons/acid-arrow-spell-action.png', fill: '#365314', stroke: '#bef264', text: '#f7fee7' },
  'alter-self': { glyph: '形', icon: '/assets/icons/alter-self-spell-action.png', fill: '#134e4a', stroke: '#5eead4', text: '#f0fdfa' },
  wish: { glyph: '愿', icon: '/assets/icons/wish-spell-action.png', fill: '#713f12', stroke: '#fde68a', text: '#fffbeb' },
  'faerie-fire': { glyph: '妖', icon: '/assets/icons/faerie-fire-spell-action.png', fill: '#581c87', stroke: '#e879f9', text: '#fdf4ff' },
  weakened: { glyph: '衰', icon: weakenedIcon, fill: '#713f12', stroke: '#facc15', text: '#fefce8' },
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
  sequester: {
    glyph: '隔', icon: '/assets/icons/sequester-spell-action.png',
    fill: '#172554', stroke: '#c4b5fd', text: '#f5f3ff',
  },
  extradimensional: {
    glyph: '异',
    icon: '/assets/icons/rope-trick-spell-action.png',
    fill: '#4c1d95',
    stroke: '#c4b5fd',
    text: '#faf5ff',
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
