import { expect, it, vi } from 'vitest'
import { chooseDnd5eAreaTargets } from './chooseDnd5eAreaTargets'
import { dnd5eAreaTargetSelectionValid } from '../../rulesets/dnd5e/activities/dnd5eAreaTargetSelection'
import { mapSpellTargetIdsForAuthoritySubmission } from '../../pages/maps/aoeTargetingSession'
import type { Dnd5eActivityTargetV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'

const target: Dnd5eActivityTargetV1 = { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 10,
  selection: 'choose-any', maximumTargets: 1 }
const candidates = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }]
it.each([undefined, null, 'a', ['outside'], ['a', 'a'], ['a', 'b']].map(value => ({ value })))('rejects malformed or over-cap intent: $value', ({ value }) => {
  expect(dnd5eAreaTargetSelectionValid(target, ['a', 'b'], value)).toBe(false)
})
it('preserves explicit zero and cancellation as different outcomes, without auto-selecting the first occupant', async () => {
  const invalid = vi.fn()
  expect(await chooseDnd5eAreaTargets({ target, candidates, invalid, choose: async selected => {
    expect(selected).toEqual([]); return []
  } })).toEqual([])
  expect(await chooseDnd5eAreaTargets({ target, candidates, invalid, choose: async () => null })).toBeUndefined()
  expect(invalid).not.toHaveBeenCalled()
  expect(mapSpellTargetIdsForAuthoritySubmission({ hasArea: true, targetKind: 'area', selectedTargetIds: ['b'], selectsAreaTargets: true })).toEqual(['b'])
})
it('re-prompts invalid counts instead of silently truncating, and keeps a valid later choice', async () => {
  const choose = vi.fn().mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['b'])
  const invalid = vi.fn()
  expect(await chooseDnd5eAreaTargets({ target, candidates, choose, invalid })).toEqual(['b'])
  expect(invalid).toHaveBeenCalledTimes(1)
  expect(dnd5eAreaTargetSelectionValid({ ...target, kind: 'area', minimumTargets: 1 }, ['a', 'b'], [])).toBe(false)
})
