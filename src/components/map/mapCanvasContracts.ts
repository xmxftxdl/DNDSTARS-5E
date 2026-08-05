import type { GridCell } from '../../lib/gridCombat'
import type { Dnd5eStandardConditionId } from '../../rulesets/dnd5e/conditions'
import type { MapSpellStatusId } from './tokenStatusTooltip'

export interface AoeHighlight {
  cells: GridCell[]
  /** Secondary harmful band, used by Wall of Fire to identify its chosen burning side. */
  hazardCells?: GridCell[]
  rangeCells?: GridCell[]
  valid: boolean
  /** Dark red original area outline (circle). */
  areaCircle?: {
    centerX: number
    centerY: number
    radiusPx: number
  }
  /** Already committed origins of a multi-area spell. */
  committedAreaCircles?: {
    centerX: number
    centerY: number
    radiusPx: number
  }[]
  /** Dark red original area outline (polygon/line). */
  areaPolygon?: number[]
  /** range：蓝色可选区；attack：黄色受击区。 */
  variant?: 'attack' | 'range'
}

export interface MapProjectile {
  id: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind?: 'heal' | 'mass-cure-wounds' | 'mass-heal' | 'mass-healing-word' | 'prayer-of-healing' | 'dancing-lights' | 'minor-illusion' | 'thaumaturgy' | 'shillelagh' | 'arrow' | 'focus' | 'fire-bolt' | 'fireball' | 'shocking-grasp' | 'chill-touch' | 'ray-of-frost' | 'eldritch-blast' | 'produce-flame' | 'guidance' | 'resistance' | 'sanctuary' | 'sacred-flame' | 'spare-the-dying' | 'acid-splash' | 'poison-spray' | 'vicious-mockery' | 'magic-missile' | 'scorching-ray' | 'guiding-bolt' | 'acid-arrow' | 'chain-lightning' | 'disintegrate' | 'cure-wounds' | 'healing-word' | 'inflict-wounds' | 'hellish-rebuke' | 'blight' | 'finger-of-death' | 'power-word-stun' | 'power-word-kill' | 'false-life' | 'burning-hands' | 'thunderwave' | 'shatter' | 'lightning-bolt' | 'flame-strike' | 'sunburst' | 'cone-of-cold' | 'circle-of-death' | 'ice-storm' | 'freezing-sphere' | 'meteor-swarm' | 'color-spray' | 'faerie-fire' | 'sleep' | 'entangle' | 'grease' | 'darkness' | 'flaming-sphere' | 'moonbeam' | 'daylight' | 'black-tentacles' | 'spike-growth' | 'mage-hand' | 'spiritual-weapon' | 'spirit-guardians' | 'call-lightning' | 'call-lightning-strike' | 'insect-plague' | 'wall-of-fire' | 'blade-barrier' | 'bless' | 'bane' | 'shield-of-faith' | 'mage-armor' | 'jump' | 'darkvision' | 'see-invisibility' | 'warding-bond' | 'fly' | 'heroism' | 'enlarge-reduce' | 'enhance-ability' | 'divine-favor' | 'hunters-mark' | 'magic-weapon' | 'flame-blade' | 'invisibility' | 'blur' | 'barkskin' | 'protection-from-poison' | 'longstrider' | 'protection-from-energy' | 'death-ward' | 'greater-invisibility' | 'charm-person' | 'hideous-laughter' | 'hold-person' | 'blindness-deafness' | 'hypnotic-pattern' | 'slow' | 'phantasmal-killer' | 'banishment' | 'misty-step' | 'hold-monster' | 'counterspell' | 'dispel-magic' | 'shield' | 'lesser-restoration' | 'cloudkill'
  hit?: boolean
  issuedAt?: number
  durationMs?: number
  radiusPx?: number
  areaWidthPx?: number
  areaHeightPx?: number
  accentColor?: string
  glowColor?: string
  /** Persistent area whose painted visual releases this entrance projectile. */
  handoffAreaId?: string
  areaShape?: 'line' | 'ring'
}

export interface SpellStatusTokenMark {
  tokenId: string
  statusId: MapSpellStatusId
  backgroundHighlightColor: string
  backgroundColor: string
  borderColor: string
  glowColor: string
  classId?: string
}

export interface StandardConditionTokenMark {
  tokenId: string
  condition: Dnd5eStandardConditionId
  backgroundColor: string
  borderColor: string
  glowColor: string
}

export interface DeleteSelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): DeleteSelectionRect {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}
