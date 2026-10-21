import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import type { Dnd5eAdvancementDefinitionV1 } from './activities/dnd5eAdvancementContracts'
import { validateDnd5eAdvancementDefinitionV1 } from './activities/dnd5eAdvancementContracts'
import {
  applyDnd5eContentBuildChoicesV1,
  dnd5eBuildChoiceRequirementsV1,
  dnd5eBuildChoiceOptionAvailableV1,
  dnd5eBuildChoiceCharacterBeforeContentV1,
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
  const fallback: Dnd5eAdvancementDefinitionV1 = {
    schemaVersion: 1, id: 'save-training', level: 7, kind: 'select', label: 'Save training', count: 1,
    options: (['wis', 'int', 'cha'] as const).map(ability => ({
      id: ability, label: ability,
      requiresSavingThrowProficiency: [{ ability: 'wis', proficient: ability !== 'wis' }],
      grants: [{ kind: 'proficiency', category: 'saving-throw', id: ability }],
    })),
  }

  it.each([false, true])('enforces permanent save training fallback before granting (already proficient: %s)', already => {
    const original = character()
    if (already) original.savingThrows.push('wis')
    const before = structuredClone(original)
    const requirements = dnd5eBuildChoiceRequirementsV1([fallback])
    expect(validateDnd5eAdvancementDefinitionV1(fallback)).toEqual([])
    for (const option of requirements[0].options) {
      const available = already ? option.id !== 'wis' : option.id === 'wis'
      expect(dnd5eBuildChoiceOptionAvailableV1(option, {}, original)).toBe(available)
      const result = applyDnd5eContentBuildChoicesV1({ character: original, contentId: 'test:fallback',
        advancements: [fallback], selections: { 'save-training': [option.id] } })
      expect(result.ok).toBe(available)
      if (!result.ok) {
        expect(result.reason).toBe('invalid-choice')
        continue
      }
      const restored = JSON.parse(JSON.stringify(result.character)) as Character
      const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(restored),
        controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
      expect(actor.savingThrowProficiencies).toContain(option.id)
      expect(actor.savingThrowBonuses[option.id as 'wis' | 'int' | 'cha']).toBe(actor.proficiencyBonus)
    }
    expect(original).toEqual(before)
  })

  it('does not let fixed or selected grants satisfy their own pre-grant prerequisite', () => {
    const fixed: Dnd5eAdvancementDefinitionV1 = { schemaVersion: 1, id: 'fixed-save', level: 7, kind: 'build-grant',
      grants: [{ kind: 'proficiency', category: 'saving-throw', id: 'wis' }] }
    expect(applyDnd5eContentBuildChoicesV1({ character: character(), contentId: 'test:fallback',
      advancements: [fixed, fallback], selections: { 'save-training': ['int'] } }))
      .toEqual({ ok: false, reason: 'invalid-choice' })
    const option = { ...fallback.options[1], requires: [{ advancementId: 'path', optionIds: ['trained'] }] }
    const trained = { ...character(), savingThrows: ['wis' as const] }
    expect(dnd5eBuildChoiceOptionAvailableV1(option, {}, trained)).toBe(false)
    expect(dnd5eBuildChoiceOptionAvailableV1(option, { path: ['trained'] }, trained)).toBe(true)
    const original = character()
    const sequence = [{ contentId: 'first', advancements: [fixed] }, { contentId: 'second', advancements: [fallback] }]
    expect(dnd5eBuildChoiceCharacterBeforeContentV1(original, 'first', sequence, {})).toBe(original)
    const preview = dnd5eBuildChoiceCharacterBeforeContentV1(original, 'second', sequence, {})
    expect(dnd5eBuildChoiceOptionAvailableV1(fallback.options[1], {}, preview)).toBe(true)
    expect(original.savingThrows).not.toContain('wis')
  })

  it.each([[], {}, [null], [{ ability: 'luck', proficient: true }], [{ ability: 'wis', proficient: 'true' }],
    [{ ability: 'wis', proficient: true, unknown: 1 }],
    [{ ability: 'wis', proficient: true }, { ability: 'wis', proficient: false }]])('rejects malformed save proficiency conditions: %j', invalid => {
    const input = { ...fallback, options: [{ ...fallback.options[0], requiresSavingThrowProficiency: invalid }] }
    expect(validateDnd5eAdvancementDefinitionV1(input as unknown as Dnd5eAdvancementDefinitionV1).join())
      .toContain('requiresSavingThrowProficiency')
  })

  it('requires proficiency and retains fixed expertise without allowing duplicate expertise choices', () => {
    const grant = { kind: 'tag' as const, key: 'skill-expertise', value: 'arcana' }
    const apply = (hero: Character, grants: Dnd5eAdvancementDefinitionV1[]) => applyDnd5eContentBuildChoicesV1({ character: hero, contentId: 'test:expert', advancements: grants })
    const choices: Dnd5eAdvancementDefinitionV1[] = [{ schemaVersion: 1, id: 'expertise', level: 1, kind: 'build-grant', grants: [grant] }]
    expect(apply(character(), choices)).toMatchObject({ ok: false, reason: 'invalid-choice' })
    const proficient = { ...character(), skills: ['arcana'] }
    expect(apply(proficient, choices).ok).toBe(true)
    const expert = { ...proficient, dnd5eClassChoices: { classes: { rogue: { selections: { expertise: ['arcana'] } } } } }
    expect(apply(expert, choices).ok).toBe(true)
    const together: Dnd5eAdvancementDefinitionV1[] = [{ schemaVersion: 1, id: 'both', level: 1, kind: 'build-grant', grants: [{ kind: 'proficiency', category: 'skill', id: 'arcana' }, grant] }]
    expect(apply(character(), together).ok).toBe(true)
    const fixedTwice = apply(proficient, [...choices, { schemaVersion: 1, id: 'again', level: 1, kind: 'build-grant', grants: [grant] }])
    expect(fixedTwice.ok).toBe(true)
    if (fixedTwice.ok) {
      expect(dnd5eCharacterBuildTagsV1(fixedTwice.character, 'skill-expertise')).toEqual(['arcana'])
      const restored = JSON.parse(JSON.stringify(fixedTwice.character)) as Character
      const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(restored),
        controller: 'player', initiativeD20: 20, position: { x: 0, y: 0 } })
      const enemy = { ...structuredClone(actor), id: 'enemy', controller: 'dm' as const, initiative: 1 }
      const state = startDnd5eHeadlessCombat('fixed-training', [actor, enemy])
      const checked = resolveDnd5eHeadlessAction(state, { type: 'ability-check', actorId: actor.id,
        ability: 'int', skill: 'arcana', d20: 10, spendAction: false })
      expect(checked.ok).toBe(true)
      expect(checked.events.find(event => event.type === 'ability-check-resolved')).toMatchObject({ total: 14 })
    }
    const selection: Dnd5eAdvancementDefinitionV1 = { schemaVersion: 1, id: 'choose', level: 1, kind: 'select', label: 'Expertise', count: 1,
      options: [{ id: 'arcana', label: 'Arcana', grants: [grant] }] }
    for (const [hero, advancements] of [[expert, [selection]], [proficient, [...choices, selection]]] as const) {
      expect(applyDnd5eContentBuildChoicesV1({ character: hero, contentId: 'test:expert', advancements, selections: { choose: ['arcana'] } }))
        .toMatchObject({ ok: false, reason: 'invalid-choice' })
    }
  })
  it('executes proficiency advancements and rejects choices outside the declared catalog', () => {
    const advancements: Dnd5eAdvancementDefinitionV1[] = [{ schemaVersion: 1, id: 'skill', level: 1, kind: 'proficiency', category: 'skill', count: 1, choices: ['arcana', 'history'] }]
    expect(dnd5eBuildChoiceRequirementsV1(advancements)[0].options.map(option => option.id)).toEqual(['arcana', 'history'])
    const original = character()
    const result = applyDnd5eContentBuildChoicesV1({ character: original, contentId: 'test:learned', advancements, selections: { skill: ['arcana'] } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.character.skills).toContain('arcana')
      expect(result.receipt.resolvedGrants).toEqual([{ kind: 'proficiency', category: 'skill', id: 'arcana' }])
      expect(original.skills).not.toContain('arcana')
    }
    expect(applyDnd5eContentBuildChoicesV1({ character: original, contentId: 'test:learned', advancements })).toEqual({ ok: false, reason: 'missing-choice' })
    expect(applyDnd5eContentBuildChoicesV1({ character: original, contentId: 'test:learned', advancements, selections: { skill: ['stealth'] } })).toEqual({ ok: false, reason: 'invalid-choice' })
  })
  it.each(['at-will', 'once-per-short-rest', 'once-per-long-rest'] as const)('requires explicit independent casting metadata for %s', (mode) => {
    const grant = { kind: 'spell' as const, spellId: 'levitate', mode, ability: 'cha' as const, castAtLevel: 2 }
    const validate = (candidate: unknown) => validateDnd5eAdvancementDefinitionV1({ schemaVersion: 1, id: 'spell', level: 1, kind: 'build-grant', grants: [candidate] } as Dnd5eAdvancementDefinitionV1)
    expect(validate(grant)).toEqual([])
    expect(validate({ ...grant, targetRestriction: 'self' })).toEqual([])
    expect(validate({ ...grant, targetRestriction: 'ally' }).join()).toContain('targetRestriction')
    expect(validate({ ...grant, mode: 'known', targetRestriction: 'self' }).join()).toContain('targetRestriction')
    expect(validate({ ...grant, castAtLevel: undefined }).join()).toContain('castAtLevel')
    expect(validate({ ...grant, ability: undefined }).join()).toContain('ability')
    expect(validate({ ...grant, castAtLevel: 0 }).join()).toContain('castAtLevel')
  })
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

  it.each([19, 20, 22])('keeps fixed non-score benefits when a score of %s reaches its maximum', (con) => {
    const original = { ...character(), abilities: { ...character().abilities, con } }
    const result = applyDnd5eContentBuildChoicesV1({
      character: original, contentId: 'test:fixed-cap', advancements: [{
        schemaVersion: 1, id: 'fixed', level: 1, kind: 'build-grant', grants: [
          { kind: 'ability-score', ability: 'con', amount: 2, maximumScore: 20 },
          { kind: 'proficiency', category: 'skill', id: 'arcana' },
        ],
      }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.abilities.con).toBe(Math.max(con, 20))
    expect(result.character.skills).toContain('arcana')
    expect(original.abilities.con).toBe(con)
    expect(original.skills).not.toContain('arcana')
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

describe('declared custom tag choices', () => {
  const language: Extract<Dnd5eAdvancementDefinitionV1, {kind:'select'}> = {
    schemaVersion:1,id:'training',level:3,kind:'select',label:'Skill or language',count:1,
    customTag:{key:'language',label:'自定义语言'},
    options:[{id:'history',label:'历史',grants:[{kind:'proficiency',category:'skill',id:'history'}]}],
  }
  it('grants only the declared tag and replaces it atomically when a fixed choice is selected', () => {
    expect(validateDnd5eAdvancementDefinitionV1(language)).toEqual([])
    expect(dnd5eBuildChoiceRequirementsV1([language])[0].customTag).toEqual(language.customTag)
    const original=character()
    const result=applyDnd5eContentBuildChoicesV1({character:original,contentId:'test:language',advancements:[language],selections:{training:['$custom:  星港手语  ']}})
    expect(result.ok).toBe(true);if(!result.ok)return
    const reloaded=JSON.parse(JSON.stringify(result.character))
    expect(dnd5eCharacterBuildTagsV1(reloaded,'language')).toEqual(['星港手语'])
    expect(reloaded.skills).toEqual(original.skills)
    const replaced=applyDnd5eContentBuildChoicesV1({character:reloaded,contentId:'test:language',advancements:[language],selections:{training:['history']}})
    expect(replaced.ok).toBe(true);if(!replaced.ok)return
    expect(dnd5eCharacterBuildTagsV1(replaced.character,'language')).toEqual([])
    expect(replaced.character.skills).toContain('history')
    expect(original.dnd5eContentChoices).toBeUndefined()
  })
  it.each(['$custom:','$custom:   ','$custom:line\nbreak','$custom:'+ 'x'.repeat(81)])('rejects invalid custom value %s', value => {
    expect(applyDnd5eContentBuildChoicesV1({character:character(),contentId:'test:language',advancements:[language],selections:{training:[value]}}).ok).toBe(false)
  })
  it('requires an explicit declaration and preserves the total selection count', () => {
    const {customTag,...closed}=language
    expect(applyDnd5eContentBuildChoicesV1({character:character(),contentId:'test:language',advancements:[closed],selections:{training:['$custom:星港手语']}}).ok).toBe(false)
    expect(applyDnd5eContentBuildChoicesV1({character:character(),contentId:'test:language',advancements:[language],selections:{training:['history','$custom:星港手语']}}).ok).toBe(false)
    expect(applyDnd5eContentBuildChoicesV1({character:character(),contentId:'test:language',advancements:[{...language,count:2}],selections:{training:['$custom:one','$custom:two']}}).ok).toBe(false)
    expect(validateDnd5eAdvancementDefinitionV1({...language,options:[]})).toEqual([])
    expect(validateDnd5eAdvancementDefinitionV1({...language,customTag:{key:'',label:'X'}})).not.toEqual([])
  })
})
