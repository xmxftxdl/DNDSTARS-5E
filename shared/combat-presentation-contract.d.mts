export type CombatPresentationProjectileSpellId =
  | 'fire-bolt'
  | 'ray-of-frost'
  | 'eldritch-blast'
  | 'produce-flame'
  | 'acid-splash'
  | 'poison-spray'
  | 'vicious-mockery'
  | 'magic-missile'
  | 'scorching-ray'
  | 'guiding-bolt'
  | 'acid-arrow'
  | 'healing-word'
  | 'inflict-wounds'
  | 'chain-lightning'
  | 'disintegrate'

export type CombatPresentationTargetEffectSpellId =
  | 'shocking-grasp'
  | 'guidance'
  | 'resistance'
  | 'sanctuary'
  | 'spare-the-dying'
  | 'cure-wounds'
  | 'hellish-rebuke'
  | 'blight'
  | 'finger-of-death'
  | 'power-word-stun'
  | 'power-word-kill'
  | 'false-life'
  | 'bless'
  | 'bane'
  | 'shield-of-faith'
  | 'mage-armor'
  | 'jump'
  | 'darkvision'
  | 'see-invisibility'
  | 'warding-bond'
  | 'fly'
  | 'heroism'
  | 'enlarge-reduce'
  | 'enhance-ability'
  | 'divine-favor'
  | 'hunters-mark'
  | 'magic-weapon'
  | 'flame-blade'
  | 'invisibility'
  | 'blur'
  | 'barkskin'
  | 'protection-from-poison'
  | 'longstrider'
  | 'protection-from-energy'
  | 'death-ward'
  | 'greater-invisibility'
  | 'charm-person'
  | 'hideous-laughter'
  | 'hold-person'
  | 'blindness-deafness'

export type CombatPresentationAreaSpellId =
  | 'burning-hands'
  | 'thunderwave'
  | 'shatter'
  | 'lightning-bolt'
  | 'flame-strike'
  | 'sunburst'
  | 'cone-of-cold'
  | 'circle-of-death'
  | 'ice-storm'
  | 'freezing-sphere'
  | 'color-spray'
  | 'faerie-fire'
  | 'sleep'
  | 'entangle'
  | 'grease'
  | 'darkness'
  | 'flaming-sphere'
  | 'moonbeam'
  | 'daylight'
  | 'black-tentacles'
  | 'spike-growth'
  | 'mage-hand'
  | 'spiritual-weapon'
  | 'spirit-guardians'
  | 'call-lightning'
  | 'call-lightning-strike'
  | 'insect-plague'
  | 'wall-of-fire'
  | 'blade-barrier'

export interface CombatPresentationAreaSpellContract {
  readonly shape: 'cone' | 'line' | 'circle' | 'rect'
  readonly lengthFeet?: number
  readonly widthFeet?: number
  readonly heightFeet?: number
  readonly radiusFeet?: number
}

export const COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS:
  readonly CombatPresentationProjectileSpellId[]
export const COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS:
  readonly CombatPresentationTargetEffectSpellId[]
export const COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS:
  Readonly<Record<CombatPresentationAreaSpellId, CombatPresentationAreaSpellContract>>

export function isCombatPresentationProjectileSpellId(
  value: unknown,
): value is CombatPresentationProjectileSpellId
export function isCombatPresentationTargetEffectSpellId(
  value: unknown,
): value is CombatPresentationTargetEffectSpellId
export function isCombatPresentationAreaSpellId(
  value: unknown,
): value is CombatPresentationAreaSpellId
