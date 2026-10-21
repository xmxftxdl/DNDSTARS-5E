import type { Dnd5eActivityPatternV1 } from './dnd5eActivityPatterns'

/** Synthetic examples, checked against the same compiler as imported content.
 * Their numbers are illustrative and must never replace source rule values. */
export const DND5E_ACTIVITY_AUTHORING_EXAMPLES: readonly Dnd5eActivityPatternV1[] = [
  {
    schemaVersion: 1, id: 'example-hit-dice', name: 'Synthetic per-pool healing',
    source: { kind: 'feature', id: 'example-hit-dice' }, activation: { kind: 'free' }, target: { kind: 'self' },
    pattern: 'hit-dice-benefit', pools: [{ sides: 6, maximumCount: 4 }, { sides: 10, maximumCount: 4 }],
    abilityPerDie: 'con', minimumPerPoolAmount: 1, maximumTotalFraction: 0.5,
    result: { kind: 'healing', target: 'actor' },
  },
  {
    schemaVersion: 1, id: 'example-moving-terrain', name: 'Synthetic moving terrain',
    source: { kind: 'spell', id: 'example-terrain' }, activation: { kind: 'action' },
    target: { kind: 'area', relation: 'any', origin: 'self', shape: 'sphere', radiusFeet: 15,
      maximumTargets: 256, includeSelf: false },
    pattern: 'area', area: { label: 'Synthetic moving terrain', durationRounds: 5,
      concentration: true, anchorMode: 'source-token', movementCostMultiplier: 2,
      movementRequiresGroundedSource: true },
  },
  {
    schemaVersion: 1, id: 'example-controlled-summon', name: 'Synthetic controlled summon',
    source: { kind: 'spell', id: 'example-summon' }, activation: { kind: 'action' },
    choices: [{ id: 'creature', label: 'Summoned profile', optionsFrom: 'srd-monsters', options: [],
      monsterFilter: { creatureTypes: ['fiend'], subtype: 'demon', maximumChallengeRating: 1 } }],
    target: { kind: 'area', relation: 'any', origin: 'point', shape: 'cube',
      placeRangeFeet: 30, lengthFeet: 5, widthFeet: 5, heightFeet: 5, maximumTargets: 1,
      requiresLineOfSight: true },
    pattern: 'summon', summon: {
      monsterId: 'srd-5.1:dretch', count: { kind: 'constant', value: 1 },
      monsterChoiceId: 'creature',
      maximumChallengeRating: { kind: 'constant', value: 1 }, requiredCreatureSubtype: 'demon',
      timing: 'immediate', durationRounds: 20, concentration: true, side: 'ally',
      commandPolicy: 'turn-order', controlSave: { ability: 'cha',
        dc: { kind: 'reference', reference: { kind: 'actor-spell-save-dc' } }, lingerDieSides: 6 },
    },
  },
  {
    schemaVersion: 1, id: 'example-tiered', name: 'Synthetic tiered damage',
    source: { kind: 'spell', id: 'example-cantrip' }, activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    pattern: 'roll-effect', check: { kind: 'save', ability: 'wis' }, saveSuccess: 'none',
    result: { kind: 'damage', damageType: 'cold', amount: { kind: 'dice', rollId: 'damage', count: 1, sides: 6 } },
    scaling: [{ basis: 'custom-table', table: [{ level: 1, value: 0 }, { level: 5, value: 1 }, { level: 11, value: 2 }, { level: 17, value: 3 }], adjustments: [{ operationId: 'result', diceCountPerStep: 1 }] }],
  },
  {
    schemaVersion: 1, id: 'example-line', name: 'Synthetic line',
    source: { kind: 'spell', id: 'example-spell' }, activation: { kind: 'action' },
    target: { kind: 'area', shape: 'line', origin: 'self', lengthFeet: 20, widthFeet: 5, relation: 'any', rotatable: true, maximumTargets: 256 },
    pattern: 'roll-effect', check: { kind: 'save', ability: 'dex' }, saveSuccess: 'half',
    result: { kind: 'damage', damageType: 'fire', amount: { kind: 'dice', rollId: 'damage', count: 2, sides: 6 } },
    scaling: [{ basis: 'slot-level', baseLevel: 1, adjustments: [{ operationId: 'result', diceCountPerStep: 1 }, { operationId: 'saved-result', diceCountPerStep: 1 }] }],
  },
  {
    schemaVersion: 1, id: 'example-condition', name: 'Synthetic condition',
    source: { kind: 'spell', id: 'example-spell' }, activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    pattern: 'condition', check: { kind: 'save', ability: 'wis' }, condition: 'frightened',
    duration: { kind: 'concentration', maximumRounds: 10 }, concentration: true,
  },
  {
    schemaVersion: 1, id: 'example-delayed', name: 'Synthetic delayed damage',
    source: { kind: 'spell', id: 'example-spell' }, activation: { kind: 'action' },
    target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 },
    pattern: 'timed-effect', effect: {
      schemaVersion: 1, id: 'example-effect', name: 'Synthetic delayed effect',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-end' }, stacking: 'unique-by-source',
      periodicDamage: { timing: 'target-turn-end', count: 1, sides: 4, type: 'acid' },
    },
  },
]
