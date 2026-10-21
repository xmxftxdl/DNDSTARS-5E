import { expect, it } from 'vitest'
import { validDnd5eInventoryExchangeSelection } from './inventoryExchangeSelection'
import { validateDnd5eExecuteActivityCommandV1, type Dnd5eExecuteActivityCommandV1 } from './activities/dnd5eActivityCommand'
const valid = () => ({ expectedInventoryRevision: 4, inputs: [{ instanceId: 'metal-1', quantity: 2 }], coins: [{ currency: 'gp', amount: 3 }], originalInstanceId: 'key-1' })
it.each([
  null, [], {}, { ...valid(), targetCell: { col: -1, row: 0 } },
  { ...valid(), targetCell: { col: 1.5, row: 0 } }, { ...valid(), targetCell: { col: 0, row: 0, rangeFeet: 500 } }, { ...valid(), policy: { maximumValueCp: 100000 } }, { ...valid(), output: { templateId: 'free' } },
  { ...valid(), expectedInventoryRevision: -1 }, { ...valid(), inputs: [{ instanceId: 'metal-1', quantity: 0 }] },
  { ...valid(), inputs: [{ instanceId: 'metal-1', quantity: 1.5 }] },
  { ...valid(), inputs: [{ instanceId: 'metal-1', quantity: 1, valueCp: 500 }] },
  { ...valid(), inputs: [{ instanceId: 'metal-1', quantity: 1 }, { instanceId: 'metal-1', quantity: 1 }] },
  { ...valid(), originalInstanceId: 'metal-1' }, { ...valid(), coins: [{ currency: '__proto__', amount: 1 }] },
  { ...valid(), coins: [{ currency: 'gp', amount: 1 }, { currency: 'gp', amount: 1 }] },
  { ...valid(), coins: [{ currency: 'gp', amount: 1_000_001 }] }, { ...valid(), inputs: [], coins: [] },
])('rejects malformed or rule-bearing inventory selection %#', value => {
  expect(validDnd5eInventoryExchangeSelection(value)).toBe(false)
})
it('validates JSON wire selection and rejects conflicting old inventory contexts', () => {
  const selection = JSON.parse(JSON.stringify(valid()))
  expect(validDnd5eInventoryExchangeSelection(selection)).toBe(true)
  const command: Dnd5eExecuteActivityCommandV1 = { schemaVersion: 1, commandId: 'exchange-1', actorId: 'actor',
    packageId: 'test', packageVersion: '1.0.0', activityId: 'exchange', targetIds: ['actor'], expectedRevision: 0, inventoryExchange: selection }
  expect(validateDnd5eExecuteActivityCommandV1(command)).toEqual([])
  expect(validateDnd5eExecuteActivityCommandV1({ ...command, inventoryInstanceId: 'other', expectedInventoryRevision: 4 })).toContain('invalid inventoryExchange')
  expect(validateDnd5eExecuteActivityCommandV1({ ...command, inventoryExchange: { ...selection, policy: {} } })).toContain('invalid inventoryExchange')
})
