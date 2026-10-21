import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { syncCharacterClassResources } from '../../lib/classResources'
import { createD20ChoiceRerollContribution, createD20RollConfirmationInterrupt, settleD20RollConfirmation } from '../../lib/rollConfirmation'
import { dnd5eD20ChoiceRerollFeaturesForCharacter, registerDnd5eRulesPlugin } from './pluginApi'
import { validateDeclarativeSubclassAbilityV1, type DeclarativeSubclassAbilityV1 } from './declarativeSubclassAbility'

function ability(triggerD20Values?: readonly number[]): DeclarativeSubclassAbilityV1 {
  return { schemaVersion: 1, id: 'reroll', name: 'Reroll', description: 'Synthetic face-gated reroll', level: 1,
    trigger: { kind: 'after-d20-roll' }, cost: { economy: 'none', resources: [{ resourceId: 'uses', amount: 1 }] },
    targeting: { kind: 'self' }, effects: [], automation: 'full',
    mechanic: { kind: 'd20-choice-reroll', rollKinds: ['attack', 'ability-check', 'saving-throw'],
      scopes: ['self-roll', 'attack-against-self'], additionalDice: 1, selection: 'must-use-latest', triggerD20Values } }
}
function install(triggerD20Values?: readonly number[], free = false, declaration = ability(triggerD20Values)) {
  if (free) declaration.cost = { economy: 'none' }
  const dispose = registerDnd5eRulesPlugin({ manifest: { id: 'test.face-reroll', name: 'Face reroll', version: '1.0.0',
    apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0-1.0' }, setup(api) {
      api.registerFeat({ id: 'face-reroll', name: 'Face reroll', summary: 'Test', description: 'Test', automation: 'full',
        resources: free ? undefined : [{ id: 'uses', label: 'Uses', maximum: 3, resetOn: 'long-rest' }],
        declarativeAbility: JSON.parse(JSON.stringify(declaration)) })
    } })
  const owner = syncCharacterClassResources(normalizeCharacter({ id: 'hero', name: 'Hero', level: 3,
    charClass: '战士', rulesetId: 'dnd5e-2014-srd-5.1', dnd5eFeatIds: ['test.face-reroll:face-reroll'] }))
  return { owner, dispose }
}
it('restricts self and incoming attack rerolls to the actual adopted face, retaining ownership and resources', () => {
  const { owner, dispose } = install([1])
  try {
    for (const kind of ['attack', 'ability-check', 'saving-throw'] as const) {
      expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, kind, 'self-roll', 1)).toHaveLength(1)
      for (const face of [undefined, 0, 2, 20, 21, 1.5, NaN, Infinity]) {
        expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, kind, 'self-roll', face)).toEqual([])
      }
    }
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'attack', 'attack-against-self', 1)).toHaveLength(1)
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'saving-throw', 'attack-against-self', 1)).toEqual([])
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter({ ...owner, dnd5eFeatIds: [] }, 'attack', 'self-roll', 1)).toEqual([])
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter({ ...owner, classResources: {} }, 'attack', 'self-roll', 1)).toEqual([])
  } finally { dispose() }
})
it('keeps legacy unconditional declarations available without a roll context', () => {
  const { owner, dispose } = install()
  try { expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'attack', 'self-roll')).toHaveLength(1) }
  finally { dispose() }
})
it('offers an owned resource-free reroll only on its declared natural face and settles the Host policy', () => {
  const { owner, dispose } = install([1], true)
  try {
    const character = { ...owner, classResources: {} }
    const options = dnd5eD20ChoiceRerollFeaturesForCharacter(character, 'attack', 'self-roll', 1)
    expect(options).toHaveLength(1)
    expect(options[0].resourceCosts).toEqual([])
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter(character, 'attack', 'self-roll', 2)).toEqual([])
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter({ ...character, dnd5eFeatIds: [] }, 'attack', 'self-roll', 1)).toEqual([])
    const option = options[0]
    const prompt = createD20RollConfirmationInterrupt({ mapId: 'map', rollId: 'free', label: 'Free reroll', originalValue: 1,
      eligibleModifiers: [{ characterId: owner.id, featureId: option.feature.id, featureLabel: option.feature.name,
        modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: option.additionalDice,
        selectionPolicy: option.selectionPolicy, resourceCosts: option.resourceCosts }] })
    const contribution = createD20ChoiceRerollContribution({ interruptId: prompt.id, characterId: owner.id,
      characterName: owner.name, featureId: option.feature.id, featureLabel: option.feature.name, decision: 'use' })
    prompt.contributions = [contribution]
    prompt.payload.rollOptions = { contributionId: contribution.id, values: [1, 9] }
    expect(settleD20RollConfirmation(prompt, contribution.id)).toMatchObject({ finalValue: 9, choiceReroll: { resourceCosts: [] } })
  } finally { dispose() }
})
it('allows explicitly free declarations while rejecting invalid costs and action economy', () => {
  for (const cost of [{ economy: 'none' }, { economy: 'none', resources: [] }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability([1]), cost })).not.toThrow()
  }
  for (const cost of [undefined, { economy: 'reaction' }, { economy: 'none', resources: 'free' },
    { economy: 'none', resources: [{ resourceId: 'uses', amount: 0 }] }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...ability([1]), cost })).toThrow()
  }
})
it('uses the Host registered policy to require the replacement even if the player requests the original', () => {
  const { owner, dispose } = install([20])
  try {
    const option = dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'attack', 'self-roll', 20)[0]
    const interrupt = createD20RollConfirmationInterrupt({ mapId: 'map', rollId: 'roll', label: 'Reroll', originalValue: 20,
      eligibleModifiers: [{ characterId: owner.id, featureId: option.feature.id, featureLabel: option.feature.name,
        modifierKind: 'choice-reroll', rerollScope: 'self-roll', additionalDice: option.additionalDice,
        selectionPolicy: option.selectionPolicy, resourceCosts: option.resourceCosts }] })
    const use = createD20ChoiceRerollContribution({ interruptId: interrupt.id, characterId: owner.id, characterName: owner.name,
      featureId: option.feature.id, featureLabel: option.feature.name, decision: 'use', selectedIndex: 0 })
    const result = settleD20RollConfirmation({ ...interrupt, contributions: [use] }, use.id, 20, undefined, undefined, 2)
    expect(result.finalValue).toBe(2)
    expect(result.choiceReroll?.selectionPolicy).toBe('must-use-latest')
  } finally { dispose() }
})
it('rejects ambiguous, empty, repeated and out-of-range face declarations', () => {
  for (const faces of [[], [0], [21], [1, 1], [1.1], ['1'], '1', [NaN], Array(21).fill(1)]) {
    const invalid = ability()
    if (invalid.mechanic?.kind !== 'd20-choice-reroll') throw Error('fixture')
    Object.assign(invalid.mechanic, { triggerD20Values: faces })
    expect(() => validateDeclarativeSubclassAbilityV1(invalid)).toThrow('d20 choice reroll')
  }
  expect(() => validateDeclarativeSubclassAbilityV1(ability([1, 20]))).not.toThrow()
})

function advantageAbility(): DeclarativeSubclassAbilityV1 {
  return { ...ability(), mechanic: { kind: 'd20-choice-reroll', rollKinds: ['attack'], scopes: ['self-roll'],
    additionalDice: 1, selection: 'highest', requiresAdvantage: true, attackAbilities: ['dex','int','wis','cha'] } }
}
it('requires the Host effective advantage mode and the actual attack ability for an extra die', () => {
  const { owner, dispose } = install(undefined, true, advantageAbility())
  try {
    for (const rollMode of ['normal', 'advantage', 'disadvantage', undefined] as const) {
      for (const attackAbility of ['str','dex','con','int','wis','cha',undefined] as const) {
        const offered = dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'attack', 'self-roll', 15, { rollMode, attackAbility })
        expect(offered).toHaveLength(rollMode === 'advantage' && attackAbility != null && ['dex','int','wis','cha'].includes(attackAbility) ? 1 : 0)
      }
    }
    const context = { rollMode: 'advantage' as const, attackAbility: 'dex' as const }
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'saving-throw', 'self-roll', 15, context)).toEqual([])
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter(owner, 'attack', 'attack-against-self', 15, context)).toEqual([])
    expect(dnd5eD20ChoiceRerollFeaturesForCharacter({ ...owner, dnd5eFeatIds: [] }, 'attack', 'self-roll', 15, context)).toEqual([])
  } finally { dispose() }
})
it('rejects unsupported advantage policies and malformed attack ability restrictions', () => {
  const declaration = advantageAbility()
  for (const changed of [{ requiresAdvantage: 'true' }, { selection: 'must-use-latest' }, { additionalDice: 2 },
    { scopes: ['attack-against-self'] }, { attackAbilities: [] }, { attackAbilities: ['dex','dex'] },
    { attackAbilities: ['luck'] }, { rollKinds: ['saving-throw'] }]) {
    expect(() => validateDeclarativeSubclassAbilityV1({ ...declaration, mechanic: { ...declaration.mechanic, ...changed } })).toThrow()
  }
  expect(() => validateDeclarativeSubclassAbilityV1(declaration)).not.toThrow()
})
