import { describe, expect, it } from 'vitest'
import type { Dnd5eActivityDefinitionV1 } from '../../rulesets/dnd5e/activities/dnd5eActivityContracts'
import type { Token } from '../../store/maps'
import { companionHelpOperationIds, companionHelpTargetOptions, companionHelpSelectionPayload, requestCompanionHelpSelections } from './companionHelpSelection'

describe('companion Help input selection', () => {
  it('collects explicit operation-keyed intent and cancels rather than selecting a default target', async () => {
    const options = [{ id: 'enemy', label: 'Enemy' }, { id: 'ally', label: 'Ally' }]
    const answers = ['attack', 'enemy', 'ability-check', 'ally']
    expect(await requestCompanionHelpSelections({ operationIds: ['one', 'two'], options,
      choose: async () => answers.shift() ?? null })).toEqual({
      one: { targetId: 'enemy', helpKind: 'attack' }, two: { targetId: 'ally', helpKind: 'ability-check' },
    })
    for (const replies of [[null], ['attack', null], ['attack', 'removed'], ['invalid']]) {
      expect(await requestCompanionHelpSelections({ operationIds: ['one'], options,
        choose: async () => replies.shift() ?? null })).toBeNull()
    }
    let prompted = false
    expect(await requestCompanionHelpSelections({ operationIds: ['one'], options: [],
      choose: async () => { prompted = true; return null } })).toBeNull()
    expect(prompted).toBe(false)
  })
  it('only requests Help parameters for a possible selected branch', () => {
    const activity: Pick<Dnd5eActivityDefinitionV1, 'outcomes'> = { outcomes: [
      { id: 'help', when: { kind: 'choice', choiceId: 'order', optionId: 'help' }, operations: [
        { id: 'help', kind: 'command-owned-companion', target: 'target', command: 'help', requiresHelpTarget: true },
      ] },
      { id: 'attack', when: { kind: 'choice', choiceId: 'order', optionId: 'attack' }, operations: [
        { id: 'attack', kind: 'command-owned-companion', target: 'target', command: 'attack' },
      ] },
    ] }
    expect(companionHelpOperationIds(activity, { order: 'help' })).toEqual(['help'])
    expect(companionHelpOperationIds(activity, { order: 'attack' })).toEqual([])
    expect(companionHelpOperationIds(undefined, {})).toEqual([])
  })

  it('excludes all commanded companions, dead creatures and obstacles', () => {
    const tokens = [
      { id: 'one', type: 'enemy', hp: 10 }, { id: 'two', type: 'enemy', hp: 10 },
      { id: 'dead', type: 'enemy', hp: 0 }, { id: 'wall', type: 'obstacle', hp: 20 },
      { id: 'ally', type: 'player' }, { id: 'enemy', type: 'enemy', hp: 10 },
    ] as Token[]
    expect(companionHelpTargetOptions(tokens, ['one', 'two']).map(token => token.id)).toEqual(['ally', 'enemy'])
  })

  it('requires every active selection and does not replace stale or removed targets', () => {
    const values = { first: { targetId: 'ally', helpKind: 'ability-check' as const },
      staleBranch: { targetId: 'enemy', helpKind: 'attack' as const } }
    expect(companionHelpSelectionPayload(['first'], [], values)).toBeUndefined()
    expect(companionHelpSelectionPayload(['first', 'second'], [{ id: 'ally' }], values)).toBeUndefined()
    const payload = companionHelpSelectionPayload(['first'], [{ id: 'ally' }], values)
    expect(payload).toEqual({ first: values.first })
    expect(payload!.first).not.toBe(values.first)
    expect(companionHelpSelectionPayload([], [], values)).toEqual({})
  })
})
