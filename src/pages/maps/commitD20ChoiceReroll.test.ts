import { beforeEach, expect, it, vi } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { createD20ChoiceRerollContribution, createD20ReplacementContribution, createD20RollConfirmationInterrupt } from '../../lib/rollConfirmation'
import { registerDnd5eRulesPlugin } from '../../rulesets/dnd5e/pluginApi'
import { commitD20ChoiceReroll } from './commitD20ChoiceReroll'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'
const session = vi.hoisted(() => ({ current: { roomId: 'room', memberId: 'dm', role: 'dm' } }))
vi.mock('../../lib/roomSession', () => ({ getRoomSession: () => session.current }))
beforeEach(() => { session.current = { roomId: 'room', memberId: 'dm', role: 'dm' } })

function fixture(costs = [{ resourceKey: 'dnd5e-spell-slot-1', amount: 1 }]) {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '法师', level: 5,
    classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } }, inspiration: 1 })
  const prompt = createD20RollConfirmationInterrupt({ mapId: 'map', rollId: 'roll', label: 'Reroll', originalValue: 4,
    eligibleModifiers: [{ characterId: 'hero', featureId: 'feat', featureLabel: 'Feat', modifierKind: 'choice-reroll',
      rerollScope: 'self-roll', additionalDice: 1, selectionPolicy: 'must-use-latest', resourceCosts: costs }] })
  const contribution = createD20ChoiceRerollContribution({ interruptId: prompt.id, characterId: 'hero', characterName: 'Hero',
    featureId: 'feat', featureLabel: 'Feat', decision: 'use' })
  prompt.contributions = [contribution]
  prompt.payload.rollOptions = { contributionId: contribution.id, values: [4, 17] }
  let data: Record<string, any> = {
    characters: { characters: [hero], selectedId: hero.id, _sync: { revision: 5 } },
    'combat-interrupts': { mapId: 'map', interrupts: [prompt], updatedAt: 1, _sync: { revision: 9 } },
  }
  let lostReply = false
  const gateway: Pick<SharedRoomGatewayPort, 'loadResource' | 'saveResourcesAtomically'> = {
    loadResource: async <T>(name: string) => structuredClone(data[name]) as T,
    saveResourcesAtomically: vi.fn<SharedRoomGatewayPort['saveResourcesAtomically']>(async (writes, options) => {
      if (writes.some(write => write.expectedRevision !== data[write.name]._sync.revision)) throw Error('state-transaction-conflict')
      const next = structuredClone(data)
      for (const write of writes) next[write.name] = { ...structuredClone(write.data as object), _sync: { revision: data[write.name]._sync.revision + 1 } }
      data = next
      if (lostReply) throw Error('Failed to fetch')
      return { status: 'committed', transactionId: options?.transactionId ?? '', revisions: {} }
    }),
  }
  return { gateway, input: { mapId: 'map', interruptId: prompt.id, acceptedContributionId: contribution.id, now: Date.now() },
    data: () => data, loseReply: () => { lostReply = true } }
}
it('atomically commits the persisted result and resources and resumes after a new invocation without spending again', async () => {
  const f = fixture()
  const result = await commitD20ChoiceReroll(f.input, f.gateway)
  expect(result.finalValue).toBe(17)
  expect(f.data().characters.characters[0].classResources['dnd5e-spell-slot-1'].current).toBe(2)
  expect(f.data()['combat-interrupts'].interrupts[0]).toMatchObject({ status: 'done', response: result })
  const reloadedGateway = { ...f.gateway, loadResource: async <T>(name: string) => JSON.parse(JSON.stringify(f.data()[name])) as T }
  expect(await commitD20ChoiceReroll(f.input, reloadedGateway)).toEqual(result)
  expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
  expect(vi.mocked(f.gateway.saveResourcesAtomically).mock.calls[0][0].map(row => row.name)).toEqual(['characters', 'combat-interrupts'])
})
it('recovers an actually committed lost acknowledgement from the exact completed response', async () => {
  const f = fixture(); f.loseReply()
  expect((await commitD20ChoiceReroll(f.input, f.gateway)).finalValue).toBe(17)
  expect(f.data().characters.characters[0].classResources['dnd5e-spell-slot-1'].current).toBe(2)
  await commitD20ChoiceReroll(f.input, f.gateway)
  expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
})
it('persists a resource-free reroll exactly once without changing any character resources', async () => {
  const f = fixture([])
  const original = structuredClone(f.data().characters.characters[0])
  f.loseReply()
  const response = await commitD20ChoiceReroll(f.input, f.gateway)
  expect(response.finalValue).toBe(17)
  expect(response.choiceReroll?.resourceCosts).toEqual([])
  expect(f.data().characters.characters[0]).toEqual(original)
  expect(await commitD20ChoiceReroll(f.input, { ...f.gateway })).toEqual(response)
  expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
})
it('rejects a stale snapshot without a partial resource debit or completion', async () => {
  const f = fixture()
  const original = f.gateway.saveResourcesAtomically
  f.gateway.saveResourcesAtomically = async (writes, options) => {
    f.data()['combat-interrupts']._sync.revision++
    return original(writes, options)
  }
  await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('conflict')
  expect(f.data().characters.characters[0].classResources['dnd5e-spell-slot-1'].current).toBe(3)
  expect(f.data()['combat-interrupts'].interrupts[0].status).not.toBe('done')
})
it('rejects unavailable mixed costs without consuming inspiration or the earlier resource', async () => {
  const f = fixture([{ resourceKey: 'dnd5e-core-inspiration', amount: 1 }, { resourceKey: 'missing', amount: 1 }])
  await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('resources-unavailable')
  expect(f.data().characters.characters[0].inspiration).toBe(1)
  expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})
it('does not recreate a retired request, settle a changed contribution or bypass Host ownership', async () => {
  const f = fixture()
  await expect(commitD20ChoiceReroll({ ...f.input, acceptedContributionId: 'foreign' }, f.gateway)).rejects.toThrow('contribution-mismatch')
  f.data()['combat-interrupts'].interrupts = []
  await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('interrupt-missing')
  session.current.role = 'player'
  await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('host-room-required')
  expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})
it('stops when the room changes during reads', async () => {
  const f = fixture()
  const read = f.gateway.loadResource
  f.gateway.loadResource = async <T>(name: string) => {
    const value = await read<T>(name)
    session.current = { ...session.current, roomId: 'other' }
    return value
  }
  await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('host-room-required')
  expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
})

function storedFixture() {
  const f = fixture()
  const pluginId = 'test.atomic-stored', subclassId = `${pluginId}:diviner`, featureId = `${subclassId}.portent`
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: pluginId, name: 'Stored d20', version: '1.0.0', apiVersion: 2,
    rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' }, setup(api) {
    api.registerDeclarativeSubclass({ schemaVersion: 1, id: 'diviner', classId: 'wizard', name: 'Diviner', summary: 'Synthetic', abilities: [{
      schemaVersion: 1, id: 'portent', name: 'Portent', description: 'Synthetic', level: 2,
      trigger: { kind: 'long-rest-complete' }, targeting: { kind: 'self' }, effects: [],
      mechanic: { kind: 'stored-d20-replacement', count: 3 }, canModifyEnemyD20: true, automation: 'full',
    }] })
  } })
  const hero = f.data().characters.characters[0]
  hero.dnd5eClassLevels = { wizard: 5 }
  hero.dnd5eClassChoices = { classes: { wizard: { subclass: subclassId } } }
  hero.dnd5eCombatState = { ...hero.dnd5eCombatState, declarativeStoredD20ByFeatureId: { [featureId]: [7, 7, 12] } }
  const prompt = f.data()['combat-interrupts'].interrupts[0]
  prompt.payload.eligibleModifiers = [{ characterId: hero.id, featureId, featureLabel: 'Portent', modifierKind: 'replace-d20', replacementValues: [7, 7, 12] }]
  delete prompt.payload.rollOptions
  const contribution = createD20ReplacementContribution({ interruptId: prompt.id, characterId: hero.id, characterName: hero.name,
    featureId, featureLabel: 'Portent', replacementValue: 7 })
  prompt.contributions = [contribution]
  f.input.acceptedContributionId = contribution.id
  return { ...f, dispose, featureId }
}
it('atomically consumes one duplicate stored die and never consumes its equal-valued sibling on replay', async () => {
  const f = storedFixture()
  try {
    f.loseReply()
    const response = await commitD20ChoiceReroll(f.input, f.gateway)
    expect(response.finalValue).toBe(7)
    expect(f.data().characters.characters[0].dnd5eCombatState.declarativeStoredD20ByFeatureId[f.featureId]).toEqual([7, 12])
    expect(await commitD20ChoiceReroll(f.input, { ...f.gateway })).toEqual(response)
    expect(f.data().characters.characters[0].dnd5eCombatState.declarativeStoredD20ByFeatureId[f.featureId]).toEqual([7, 12])
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
  } finally { f.dispose() }
})
it('requires the current stored pool and actual ownership, not just an old offer', async () => {
  for (const missing of ['pool', 'feature']) {
    const f = storedFixture()
    try {
      const hero = f.data().characters.characters[0]
      if (missing === 'pool') hero.dnd5eCombatState.declarativeStoredD20ByFeatureId[f.featureId] = [12]
      else hero.dnd5eClassChoices = {}
      await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('stored-d20-replacement-unavailable')
      expect(f.gateway.saveResourcesAtomically).not.toHaveBeenCalled()
    } finally { f.dispose() }
  }
})
it('rejects changed stored-die contributions after completion instead of reporting another result as applied', async () => {
  const f = storedFixture()
  try {
    await commitD20ChoiceReroll(f.input, f.gateway)
    f.data()['combat-interrupts'].interrupts[0].contributions[0].replacementValue = 12
    await expect(commitD20ChoiceReroll(f.input, f.gateway)).rejects.toThrow('completed-response-mismatch')
    expect(f.gateway.saveResourcesAtomically).toHaveBeenCalledTimes(1)
  } finally { f.dispose() }
})
