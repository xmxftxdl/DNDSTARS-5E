import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import { createDnd5eTurnEconomyCounts, normalizeDnd5eTurnEconomyCounts } from '../../rulesets/dnd5e/turnEconomy'
import { dnd5eMonsterTokenEffectiveSpeed } from './monsterMovementProjection'

it('caps the monster movement display and preserves movement already spent when the cap changes', () => {
  const cap = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'monster',
    source: { kind: 'spell' }, modifiers: { speedMaximumFeet: 10 } })
  const token = { dnd5eCombatState: { activeEffects: [cap] } }
  expect(dnd5eMonsterTokenEffectiveSpeed(token, 30)).toBe(10)
  expect(dnd5eMonsterTokenEffectiveSpeed(token, 5)).toBe(5)
  const economy = createDnd5eTurnEconomyCounts('turn', 30)
  economy.movement.current = 25
  const capped = normalizeDnd5eTurnEconomyCounts(economy, dnd5eMonsterTokenEffectiveSpeed(token, 30))
  expect(capped.movement).toMatchObject({ current: 5, max: 10, spent: 5 })
  expect(normalizeDnd5eTurnEconomyCounts(capped, dnd5eMonsterTokenEffectiveSpeed({}, 30)).movement)
    .toMatchObject({ current: 25, max: 30, spent: 5 })
})
