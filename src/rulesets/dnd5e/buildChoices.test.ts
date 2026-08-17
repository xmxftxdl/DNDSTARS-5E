import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import type { Dnd5eAdvancementDefinitionV1 } from './activities/dnd5eAdvancementContracts'
import {
  applyDnd5eContentBuildChoicesV1,
  dnd5eBuildChoiceRequirementsV1,
  dnd5eCharacterBuildProficienciesV1,
  dnd5eCharacterBuildFeatureIdsV1,
  dnd5eCharacterBuildSpellGrantsV1,
  dnd5eCharacterBuildTagsV1,
} from './buildChoices'

function character(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1', id: 'hero', name: 'Hero', player: 'Player',
    avatar: '', accent: '', race: '人类', charClass: '战士', level: 4, background: '士兵',
    experience: 0, reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    savingThrows: ['str', 'con'], skills: ['athletics'], maxHp: 40, currentHp: 40,
    tempHp: 0, hitDice: '4d10', ac: 16, speed: 30, initiativeBonus: 1, saveDC: 10,
    passivePerception: 10, inspiration: 0, conditions: [], notes: '', dmNotes: '',
    visibleToPlayers: true,
  }
}

const choices: readonly Dnd5eAdvancementDefinitionV1[] = [
  {
    schemaVersion: 1, id: 'fixed-grants', level: 1, kind: 'build-grant',
    grants: [
      { kind: 'proficiency', category: 'armor', id: 'medium' },
      { kind: 'tag', key: 'test.mode', value: 'enabled' },
      { kind: 'feature', featureId: 'local.test:chosen-feature' },
    ],
  },
  {
    schemaVersion: 1, id: 'ability', level: 1, kind: 'select', label: '属性', count: 1,
    options: [
      { id: 'str', label: '力量', grants: [{ kind: 'ability-score', ability: 'str', amount: 1, maximumScore: 20 }] },
      { id: 'dex', label: '敏捷', grants: [{ kind: 'ability-score', ability: 'dex', amount: 1, maximumScore: 20 }] },
    ],
  },
  {
    schemaVersion: 1, id: 'spell', level: 1, kind: 'select', label: '戏法', count: 1,
    options: [{
      id: 'fire-bolt', label: '火焰箭',
      grants: [{ kind: 'spell', spellId: 'fire-bolt', mode: 'cantrip', ability: 'int' }],
      requires: [{ advancementId: 'ability', optionIds: ['str'] }],
    }],
  },
]

describe('D&D 5e content build choices', () => {
  it('atomically resolves fixed, selected and dependent grants into a persistent receipt', () => {
    const result = applyDnd5eContentBuildChoicesV1({
      character: character(), contentId: 'local.test:feat', advancements: choices,
      selections: { ability: ['str'], spell: ['fire-bolt'] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.abilities.str).toBe(17)
    expect(dnd5eCharacterBuildProficienciesV1(result.character, 'armor').has('medium')).toBe(true)
    expect(dnd5eCharacterBuildTagsV1(result.character, 'test.mode')).toEqual(['enabled'])
    expect(dnd5eCharacterBuildFeatureIdsV1(result.character)).toEqual(['local.test:chosen-feature'])
    expect(dnd5eCharacterBuildSpellGrantsV1(result.character)).toEqual([
      expect.objectContaining({ spellId: 'fire-bolt', mode: 'cantrip', ability: 'int' }),
    ])
    expect(result.character.dnd5eContentChoices?.['local.test:feat'].selections)
      .toEqual({ ability: ['str'], spell: ['fire-bolt'] })
  })

  it('rejects missing, extra, dependent and over-maximum selections without mutating the character', () => {
    const original = character()
    expect(applyDnd5eContentBuildChoicesV1({
      character: original, contentId: 'test', advancements: choices,
      selections: { ability: ['str'] },
    })).toEqual({ ok: false, reason: 'missing-choice' })
    expect(applyDnd5eContentBuildChoicesV1({
      character: original, contentId: 'test', advancements: choices,
      selections: { ability: ['dex'], spell: ['fire-bolt'] },
    })).toEqual({ ok: false, reason: 'invalid-choice' })
    expect(applyDnd5eContentBuildChoicesV1({
      character: original, contentId: 'test', advancements: choices,
      selections: { ability: ['str'], spell: ['fire-bolt'], unknown: ['x'] },
    })).toEqual({ ok: false, reason: 'invalid-choice' })
    const capped = { ...original, abilities: { ...original.abilities, str: 20 } }
    expect(applyDnd5eContentBuildChoicesV1({
      character: capped, contentId: 'test', advancements: choices,
      selections: { ability: ['str'], spell: ['fire-bolt'] },
    })).toEqual({ ok: false, reason: 'ability-score-maximum' })
    expect(original.abilities.str).toBe(16)
    expect(original.dnd5eContentChoices).toBeUndefined()
  })

  it('expands a schema-driven spell selection from the chosen class list', () => {
    const advancements: readonly Dnd5eAdvancementDefinitionV1[] = [{
      schemaVersion: 1, id: 'source-class', level: 1, kind: 'select', label: '职业', count: 1,
      options: [
        { id: 'wizard', label: '法师', grants: [{ kind: 'tag', key: 'source-class', value: 'wizard' }] },
        { id: 'cleric', label: '牧师', grants: [{ kind: 'tag', key: 'source-class', value: 'cleric' }] },
      ],
    }, {
      schemaVersion: 1, id: 'cantrips', level: 1, kind: 'spell-select', label: '戏法', count: 1,
      mode: 'cantrip', levels: [0],
      classSelection: {
        advancementId: 'source-class',
        options: [
          { optionId: 'wizard', classId: 'wizard', ability: 'int' },
          { optionId: 'cleric', classId: 'cleric', ability: 'wis' },
        ],
      },
      additionalSpells: [{ id: 'local-cantrip', label: '本地戏法', level: 0, classes: ['wizard'] }],
    }]
    const requirements = dnd5eBuildChoiceRequirementsV1(advancements)
    const cantrips = requirements.find((requirement) => requirement.id === 'cantrips')!
    expect(cantrips.options).toContainEqual(expect.objectContaining({ id: 'spell-wizard-local-cantrip' }))
    expect(cantrips.options).not.toContainEqual(expect.objectContaining({ id: 'spell-cleric-local-cantrip' }))

    const result = applyDnd5eContentBuildChoicesV1({
      character: character(), contentId: 'local.test:magic', advancements,
      selections: { 'source-class': ['wizard'], cantrips: ['spell-wizard-local-cantrip'] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(dnd5eCharacterBuildSpellGrantsV1(result.character)).toEqual([
      { kind: 'spell', spellId: 'local-cantrip', mode: 'cantrip', ability: 'int' },
    ])
  })
})
