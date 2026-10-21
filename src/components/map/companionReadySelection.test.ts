import { expect, it, vi } from 'vitest'
import { companionReadyOperations, requestCompanionReadySelections } from './companionReadySelection'
import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'

const operations = [{ id: 'ready', trigger: 'A visible signal' }]
it('prompts only for the selected customizable Ready branch', () => {
  const activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> = { outcomes: ['attack', 'move'].map(id => ({
    id, when: { kind: 'choice', choiceId: 'command', optionId: id },
    operations: [{ id, kind: 'command-owned-companion', target: 'target', sourceActivityId: 'summon',
      command: 'ready', allowsReadyTrigger: true, ready: { trigger: id, actionKind: 'move' } }],
  })) }
  expect(companionReadyOperations(activity, { command: 'move' })).toEqual([{ id: 'move', trigger: 'move' }])
  expect(companionReadyOperations(activity, { command: 'dodge' })).toEqual([])
  expect(companionReadyOperations(undefined, {})).toEqual([])
})
it('prompts with the package default and trims the custom trigger', async () => {
  const prompt = vi.fn(async () => '  The bell rings twice  ')
  expect(await requestCompanionReadySelections({ operations, prompt, isCurrent: () => true }))
    .toEqual({ ready: 'The bell rings twice' })
  expect(prompt).toHaveBeenCalledWith(expect.any(String), 'A visible signal')
})
it.each(['cancel', 'changed', 'already-stale'])('does not submit on %s', async reason => {
  let current = reason !== 'already-stale'
  const prompt = vi.fn(async () => {
    if (reason === 'changed') current = false
    return reason === 'cancel' ? null : 'Bell'
  })
  expect(await requestCompanionReadySelections({ operations, prompt, isCurrent: () => current })).toBeNull()
  if (reason === 'already-stale') expect(prompt).not.toHaveBeenCalled()
})
it.each([' ', 'x'.repeat(321)])('rejects invalid trigger text', async trigger => {
  await expect(requestCompanionReadySelections({ operations, prompt: async () => trigger, isCurrent: () => true }))
    .rejects.toThrow('invalid-companion-ready-trigger')
})
