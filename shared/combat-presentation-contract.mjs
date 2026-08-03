export const COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS = Object.freeze([
  'fire-bolt',
  'ray-of-frost',
  'eldritch-blast',
  'produce-flame',
  'acid-splash',
  'poison-spray',
  'vicious-mockery',
  'magic-missile',
  'scorching-ray',
  'guiding-bolt',
  'acid-arrow',
  'healing-word',
  'inflict-wounds',
  'chain-lightning',
  'disintegrate',
])

export const COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS = Object.freeze([
  'shocking-grasp',
  'guidance',
  'resistance',
  'sanctuary',
  'spare-the-dying',
  'cure-wounds',
  'hellish-rebuke',
  'blight',
  'finger-of-death',
  'power-word-stun',
  'power-word-kill',
  'false-life',
  'bless',
  'bane',
  'shield-of-faith',
  'mage-armor',
  'jump',
  'darkvision',
  'see-invisibility',
  'warding-bond',
  'fly',
  'heroism',
  'enlarge-reduce',
  'enhance-ability',
  'divine-favor',
  'hunters-mark',
  'magic-weapon',
  'flame-blade',
  'invisibility',
  'blur',
  'barkskin',
  'protection-from-poison',
  'longstrider',
  'protection-from-energy',
  'death-ward',
  'greater-invisibility',
  'charm-person',
  'hideous-laughter',
  'hold-person',
  'blindness-deafness',
])

export const COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS = Object.freeze({
  'burning-hands': Object.freeze({ shape: 'cone', lengthFeet: 15, widthFeet: 15 }),
  thunderwave: Object.freeze({ shape: 'line', lengthFeet: 15, widthFeet: 15 }),
  shatter: Object.freeze({ shape: 'circle', radiusFeet: 10 }),
  'lightning-bolt': Object.freeze({ shape: 'line', lengthFeet: 100, widthFeet: 5 }),
  'flame-strike': Object.freeze({ shape: 'circle', radiusFeet: 10 }),
  sunburst: Object.freeze({ shape: 'circle', radiusFeet: 60 }),
  'cone-of-cold': Object.freeze({ shape: 'cone', lengthFeet: 60, widthFeet: 60 }),
  'circle-of-death': Object.freeze({ shape: 'circle', radiusFeet: 60 }),
  'ice-storm': Object.freeze({ shape: 'circle', radiusFeet: 20 }),
  'freezing-sphere': Object.freeze({ shape: 'circle', radiusFeet: 60 }),
  'color-spray': Object.freeze({ shape: 'cone', lengthFeet: 15, widthFeet: 15 }),
  'faerie-fire': Object.freeze({ shape: 'rect', widthFeet: 20, heightFeet: 20 }),
  sleep: Object.freeze({ shape: 'circle', radiusFeet: 20 }),
  entangle: Object.freeze({ shape: 'rect', widthFeet: 20, heightFeet: 20 }),
  grease: Object.freeze({ shape: 'rect', widthFeet: 10, heightFeet: 10 }),
  darkness: Object.freeze({ shape: 'circle', radiusFeet: 15 }),
  'flaming-sphere': Object.freeze({ shape: 'circle', radiusFeet: 5 }),
  moonbeam: Object.freeze({ shape: 'circle', radiusFeet: 5 }),
  daylight: Object.freeze({ shape: 'circle', radiusFeet: 120 }),
  'black-tentacles': Object.freeze({ shape: 'rect', widthFeet: 20, heightFeet: 20 }),
  'spike-growth': Object.freeze({ shape: 'circle', radiusFeet: 20 }),
  'mage-hand': Object.freeze({ shape: 'circle', radiusFeet: 0 }),
  'spiritual-weapon': Object.freeze({ shape: 'circle', radiusFeet: 5 }),
  'spirit-guardians': Object.freeze({ shape: 'circle', radiusFeet: 15 }),
  'call-lightning': Object.freeze({ shape: 'circle', radiusFeet: 60 }),
  'call-lightning-strike': Object.freeze({ shape: 'circle', radiusFeet: 5 }),
  'insect-plague': Object.freeze({ shape: 'circle', radiusFeet: 20 }),
  'wall-of-fire': Object.freeze({ shape: 'rect', widthFeet: 60, heightFeet: 5 }),
  'blade-barrier': Object.freeze({ shape: 'rect', widthFeet: 100, heightFeet: 5 }),
})

const PROJECTILE_SPELL_IDS = new Set(COMBAT_PRESENTATION_PROJECTILE_SPELL_IDS)
const TARGET_EFFECT_SPELL_IDS = new Set(COMBAT_PRESENTATION_TARGET_EFFECT_SPELL_IDS)
const AREA_SPELL_IDS = new Set(Object.keys(COMBAT_PRESENTATION_AREA_SPELL_CONTRACTS))

export function isCombatPresentationProjectileSpellId(value) {
  return typeof value === 'string' && PROJECTILE_SPELL_IDS.has(value)
}

export function isCombatPresentationTargetEffectSpellId(value) {
  return typeof value === 'string' && TARGET_EFFECT_SPELL_IDS.has(value)
}

export function isCombatPresentationAreaSpellId(value) {
  return typeof value === 'string' && AREA_SPELL_IDS.has(value)
}
