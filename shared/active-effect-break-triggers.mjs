/** Persistence and browser execution must accept the same lifecycle vocabulary. */
export const ACTIVE_EFFECT_BREAK_TRIGGERS = Object.freeze([
  'takes-damage', 'targeted-by-spell', 'targeted-by-attack', 'hit-by-attack',
  'makes-attack', 'makes-weapon-attack', 'casts-spell', 'forces-saving-throw', 'deals-damage', 'moves',
  'spends-action', 'spends-action-except-granted', 'spends-bonus-action', 'spends-reaction', 'awakened',
  'magical-healing', 'short-rest-complete', 'long-rest-complete',
  'reduced-to-zero', 'source-dies', 'source-long-rest-complete',
  'attacked-by-source-or-ally', 'damaged-by-source-or-ally', 'forced-save-by-source-or-ally',
  'attacked-by-condition-entity', 'damaged-by-condition-entity', 'forced-save-by-condition-entity',
  'attacked-by-source', 'attacked-by-source-ally', 'damaged-by-source-ally', 'forced-save-by-source-ally',
  'witnesses-ally-attacked', 'witnesses-ally-damaged', 'witnesses-source-attack-ally', 'witnesses-source-damage-ally',
])


