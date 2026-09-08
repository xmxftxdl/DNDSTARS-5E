import { describe, expect, it } from 'vitest'
import { dnd5ePluginSpellDefinition } from '../pluginApi'
import { dnd5ePluginSpellActivity } from '../pluginSpellTransaction'
import { dnd5eActivityOutcomeAllowsChoicesV1 } from './dnd5eActivityChoices'

describe('D&D 5e Activity choice UI requirements', () => {
  it('does not request inventory input for the mapped Purify Food and Drink branch', () => {
    const spell = dnd5ePluginSpellDefinition('purify-food-and-drink')!
    const activity = dnd5ePluginSpellActivity(spell)!
    const mappedOutcomes = activity.outcomes.filter((outcome) =>
      dnd5eActivityOutcomeAllowsChoicesV1(outcome, { mode: 'mapped-consumables' }),
    )

    expect(mappedOutcomes.some((outcome) => outcome.operations.some((operation) =>
      operation.kind === 'purify-map-consumables'))).toBe(true)
    expect(mappedOutcomes.some((outcome) => outcome.operations.some((operation) =>
      operation.kind === 'purify-inventory-item'))).toBe(false)
  })
})
