import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { dnd5eNextD20AdvantageApplies } from '../nextD20Advantage'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'

it('preserves an effect-based one-roll benefit independently of feature ownership, including suspension', () => {
  const effect = createDnd5eMechanicalEffect({ id: 'borrowed', definitionId: 'borrowed', label: 'Borrowed', targetId: 'actor',
    source: { kind: 'spell', rulesId: 'test', magical: true }, modifiers: { nextD20AdvantageRollKinds: ['attack', 'ability-check', 'saving-throw'] } })
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
  expect(validateDnd5eActiveEffectsStrict(effects).ok).toBe(true)
  expect(effects[0].modifiers?.nextD20AdvantageRollKinds).toEqual(['attack', 'ability-check', 'saving-throw'])
  for (const kind of ['attack', 'ability-check', 'saving-throw'] as const) {
    expect(dnd5eNextD20AdvantageApplies({ level: 1, classState: { activeEffects: effects } }, kind)).toBe(true)
    expect(dnd5eNextD20AdvantageApplies({ level: 1, classState: { activeEffects: effects.map(entry => ({ ...entry, suspendedBy: ['antimagic'] })) } }, kind)).toBe(false)
  }
})

it.each([[], ['attack', 'attack'], ['initiative'], 'attack'])('rejects malformed one-roll categories: %j', rollKinds => {
  const activity: Dnd5eActivityDefinitionV1 = {
    schemaVersion: 1, id: 'borrow', name: 'Borrow', activation: { kind: 'bonus-action' }, target: { kind: 'self' },
    automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'borrowed', name: 'Borrowed', stacking: 'replace', duration: { kind: 'rounds', rounds: 1, expiresAt: 'target-turn-start' },
      modifiers: [{ kind: 'next-d20-advantage', rollKinds: rollKinds as never }] }],
    outcomes: [{ id: 'borrow', when: { kind: 'always' }, operations: [{ id: 'borrow', kind: 'apply-effect', target: 'actor', effectId: 'borrowed' }] }],
  }
  expect(validateDnd5eActivityDefinitionV1(activity).some(error => error.includes('rollKinds'))).toBe(true)
  const effect = createDnd5eMechanicalEffect({ id: 'bad', definitionId: 'bad', label: 'Bad', targetId: 'actor', source: { kind: 'spell' } })
  expect(validateDnd5eActiveEffectsStrict([{ ...effect, modifiers: { nextD20AdvantageRollKinds: rollKinds } }]).ok).toBe(false)
})
