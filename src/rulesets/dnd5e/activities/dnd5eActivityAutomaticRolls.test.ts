import { describe, expect, it } from 'vitest'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { planDnd5eAutomaticAlliedSavingThrowRolls } from './dnd5eActivityAutomaticRolls'

const activity = {
  checks: [{
    id: 'polymorph-save', kind: 'saving-throw', rollId: 'spell-save-d20',
    ability: 'wis', dc: { kind: 'constant', value: 15 },
    rollMode: 'host-derived', scope: 'per-target', automaticFailureIfAllied: true,
  }],
} as unknown as Dnd5eActivityDefinitionV1

describe('automatic allied Activity saving throws', () => {
  it('suppresses the willing allied roll while retaining a hostile target roll', () => {
    const planned = planDnd5eAutomaticAlliedSavingThrowRolls({
      activity,
      actor: { id: 'caster', controller: 'players' },
      targets: [
        { id: 'ally', controller: 'players' },
        { id: 'enemy', controller: 'dm' },
      ],
      declarations: [
        { id: 'spell-save-d20:ally', label: 'ally', count: 2, sides: 20 },
        { id: 'spell-save-d20:enemy', label: 'enemy', count: 2, sides: 20 },
      ],
    })

    expect(planned.declarations.map((roll) => roll.id)).toEqual(['spell-save-d20:enemy'])
    expect(planned.automaticRolls['spell-save-d20:ally']).toEqual({
      values: [1, 1], modifier: 0, total: 2,
    })
  })
})
