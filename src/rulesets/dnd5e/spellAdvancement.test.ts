import { describe, expect, it } from 'vitest'
import { syncCharacterClassResources } from '../../lib/classResources'
import type {
  Character,
  Dnd5eAdvancementSpellSelectionsV1,
  Dnd5eLevelAdvancementDecisionV1,
} from '../../types/character'
import { dnd5eClassDefinition, type Dnd5eClassId } from './classes'
import {
  applyDnd5eLevelAdvancement,
  buildDnd5eLevelAdvancementPlan,
  dnd5eAdvancementLockedChoiceKeys,
} from './levelAdvancement'
import {
  applyDnd5eSpellAdvancement,
  buildDnd5eSpellAdvancementPlan,
  buildDnd5eSpellAdvancementPlanFromSelections,
  dnd5eSpellAdvancementSelectionsComplete,
  type Dnd5eSpellAdvancementPlan,
} from './spellAdvancement'
import { dnd5eSelectedSpellIdsForClass } from './spells'

function caster(
  classId: Dnd5eClassId,
  level: number,
  selections: Record<string, readonly string[]>,
  subclass?: string,
): Character {
  const definition = dnd5eClassDefinition(classId)
  if (!definition) throw new Error(`missing class ${classId}`)
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: `${classId}-hero`,
    name: `测试${definition.name}`,
    player: '玩家',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: definition.name,
    dnd5eClassLevels: { [classId]: level },
    level,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 16, cha: 16 },
    savingThrows: [...definition.savingThrows],
    skills: ['arcana', 'history'],
    maxHp: 8,
    currentHp: 8,
    tempHp: 0,
    hitDice: `${level}d${definition.hitDie}`,
    hitPointMaximumMode: 'fixed',
    hitPointDice: [{ sides: definition.hitDie, current: level, max: level }],
    ac: 12,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 13,
    passivePerception: 13,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eClassChoices: {
      classes: {
        [classId]: {
          ...(subclass ? { subclass } : {}),
          selections: {
            ...(classId === 'sorcerer' ? { 'dragon-ancestor': ['red-fire'] } : {}),
            ...structuredClone(selections),
          },
        },
      },
    },
  }
}

function ids(
  plan: Dnd5eSpellAdvancementPlan,
  kind: 'cantrip' | 'spell',
  count: number,
  excluded: readonly string[] = [],
): string[] {
  const blocked = new Set(excluded)
  const options = kind === 'cantrip' ? plan.cantripOptions : plan.spellOptions
  return options.filter((spell) => !blocked.has(spell.id)).slice(0, count).map((spell) => spell.id)
}

function initialSelections(
  classId: Dnd5eClassId,
  subclassId?: string,
): { plan: Dnd5eSpellAdvancementPlan; value: Dnd5eAdvancementSpellSelectionsV1 } {
  const plan = buildDnd5eSpellAdvancementPlanFromSelections({
    classId,
    fromClassLevel: 0,
    toClassLevel: 1,
    subclassId,
    selections: {},
  })
  if (!plan) throw new Error(`missing initial spell plan for ${classId}`)
  return {
    plan,
    value: {
      cantrips: ids(plan, 'cantrip', plan.targetCantripCount),
      ...(plan.targetKnownSpellCount == null
        ? {}
        : { knownSpells: ids(plan, 'spell', plan.targetKnownSpellCount) }),
      ...(plan.targetWizardSpellbookCount == null
        ? {}
        : { wizardSpellbook: ids(plan, 'spell', plan.targetWizardSpellbookCount) }),
    },
  }
}

function levelDecision(
  classId: Dnd5eClassId,
  spellSelections: Dnd5eAdvancementSpellSelectionsV1,
  patch: Partial<Dnd5eLevelAdvancementDecisionV1> = {},
): Dnd5eLevelAdvancementDecisionV1 {
  return {
    schemaVersion: 1,
    classId,
    levelsGained: 1,
    hitPointMethod: 'fixed',
    hitPointRolls: [],
    asiChoices: [],
    spellSelections,
    ...patch,
  }
}

describe('D&D 5e spell advancement', () => {
  it('adds two wizard spells to the spellbook without preparing them automatically', () => {
    const initial = initialSelections('wizard')
    const wizard = caster('wizard', 1, {
      [initial.plan.cantripSelectionKey]: initial.value.cantrips,
      'wizard-spellbook': initial.value.wizardSpellbook ?? [],
      'spell-prepared': [initial.value.wizardSpellbook?.[0] ?? ''],
    })
    const plan = buildDnd5eLevelAdvancementPlan(wizard, 'wizard', 1, 'evocation')
    expect(plan?.spellAdvancement).toMatchObject({
      targetWizardSpellbookCount: 8,
      highestSpellLevel: 1,
    })
    if (!plan?.spellAdvancement) return
    const additions = ids(
      plan.spellAdvancement,
      'spell',
      2,
      initial.value.wizardSpellbook,
    )
    const spellSelections = {
      cantrips: [...initial.value.cantrips],
      wizardSpellbook: [...(initial.value.wizardSpellbook ?? []), ...additions],
    }
    const result = applyDnd5eLevelAdvancement(
      wizard,
      levelDecision('wizard', spellSelections, { subclassId: 'evocation' }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.dnd5eClassChoices?.classes?.wizard?.selections?.['wizard-spellbook'])
      .toEqual(spellSelections.wizardSpellbook)
    expect(result.character.dnd5eClassChoices?.classes?.wizard?.selections?.['spell-prepared'])
      .toEqual([initial.value.wizardSpellbook?.[0]])
    expect(dnd5eSelectedSpellIdsForClass(result.character, 'wizard'))
      .not.toEqual(expect.arrayContaining(additions))
    const locked = dnd5eAdvancementLockedChoiceKeys(result.character)
    expect(locked.has('wizard:class:spell-cantrips')).toBe(true)
    expect(locked.has('wizard:class:wizard-spellbook')).toBe(true)
  })

  it('adds and replaces one known spell, then exposes the result to the combat hotbar selector', () => {
    const initial = initialSelections('sorcerer', 'draconic')
    const sorcerer = caster('sorcerer', 1, {
      [initial.plan.cantripSelectionKey]: initial.value.cantrips,
      [initial.plan.spellSelectionKey]: initial.value.knownSpells ?? [],
    }, 'draconic')
    const plan = buildDnd5eLevelAdvancementPlan(sorcerer, 'sorcerer', 1)
    if (!plan?.spellAdvancement) throw new Error('missing sorcerer spell plan')
    const previous = initial.value.knownSpells ?? []
    const replacements = ids(plan.spellAdvancement, 'spell', 2, previous)
    const selected = {
      cantrips: [...initial.value.cantrips],
      knownSpells: [previous[1], ...replacements],
    }
    const result = applyDnd5eLevelAdvancement(
      sorcerer,
      levelDecision('sorcerer', selected),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.dnd5eClassChoices?.classes?.sorcerer?.selections?.['spell-known'])
      .toEqual(selected.knownSpells)
    expect(dnd5eSelectedSpellIdsForClass(result.character, 'sorcerer'))
      .toEqual(expect.arrayContaining([...selected.cantrips, ...selected.knownSpells]))
    expect(dnd5eSelectedSpellIdsForClass(result.character, 'sorcerer')).not.toContain(previous[0])
  })

  it('permits at most one cantrip replacement while learning a newly granted cantrip', () => {
    const initial = initialSelections('sorcerer', 'draconic')
    const sorcerer = caster('sorcerer', 3, {
      [initial.plan.cantripSelectionKey]: initial.value.cantrips,
      [initial.plan.spellSelectionKey]: initial.value.knownSpells ?? [],
    }, 'draconic')
    const plan = buildDnd5eSpellAdvancementPlan(sorcerer, 'sorcerer', 3, 4, 'draconic')
    if (!plan) throw new Error('missing level four spell plan')
    const newCantrips = ids(plan, 'cantrip', 2, initial.value.cantrips)
    const valid = {
      cantrips: [...initial.value.cantrips.slice(1), ...newCantrips],
      knownSpells: [
        ...(initial.value.knownSpells ?? []),
        ...ids(plan, 'spell', plan.targetKnownSpellCount! - (initial.value.knownSpells?.length ?? 0), initial.value.knownSpells),
      ],
    }
    expect(dnd5eSpellAdvancementSelectionsComplete(plan, valid)).toBe(true)
    expect(dnd5eSpellAdvancementSelectionsComplete(plan, {
      ...valid,
      cantrips: [
        ...initial.value.cantrips.slice(2),
        ...ids(plan, 'cantrip', 3, initial.value.cantrips),
      ],
    })).toBe(false)
  })

  it('reports newly unlocked spell levels and synchronizes the new slot resource', () => {
    const initial = initialSelections('wizard')
    const levelTwoBook = [
      ...(initial.value.wizardSpellbook ?? []),
      ...ids(initial.plan, 'spell', 2, initial.value.wizardSpellbook),
    ]
    const wizard = caster('wizard', 2, {
      [initial.plan.cantripSelectionKey]: initial.value.cantrips,
      'wizard-spellbook': levelTwoBook,
      'spell-prepared': [levelTwoBook[0]],
    }, 'evocation')
    const plan = buildDnd5eLevelAdvancementPlan(wizard, 'wizard', 1)
    expect(plan?.spellAdvancement?.newlyUnlockedSpellLevels).toEqual([2])
    if (!plan?.spellAdvancement) return
    const newBookSpells = ids(plan.spellAdvancement, 'spell', 2, levelTwoBook)
    const result = applyDnd5eLevelAdvancement(
      wizard,
      levelDecision('wizard', {
        cantrips: [...initial.value.cantrips],
        wizardSpellbook: [...levelTwoBook, ...newBookSpells],
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const synced = syncCharacterClassResources(result.character)
    expect(synced.classResources?.['dnd5e-spell-slot-2']).toEqual({ current: 2, max: 2 })
  })

  it('selects a pact boon and safely replaces one invocation in the same warlock upgrade', () => {
    const initial = initialSelections('warlock', 'fiend')
    const levelTwoPlan = buildDnd5eSpellAdvancementPlanFromSelections({
      classId: 'warlock',
      fromClassLevel: 1,
      toClassLevel: 2,
      subclassId: 'fiend',
      selections: {
        [initial.plan.cantripSelectionKey]: initial.value.cantrips,
        [initial.plan.spellSelectionKey]: initial.value.knownSpells ?? [],
      },
    })
    if (!levelTwoPlan) throw new Error('missing warlock level two plan')
    const levelTwoKnown = [
      ...(initial.value.knownSpells ?? []),
      ...ids(levelTwoPlan, 'spell', 1, initial.value.knownSpells),
    ]
    const cantrips = initial.value.cantrips.includes('eldritch-blast')
      ? initial.value.cantrips
      : ['eldritch-blast', ...initial.value.cantrips.slice(1)]
    const warlock = caster('warlock', 2, {
      'spell-cantrips': cantrips,
      'spell-known': levelTwoKnown,
      'eldritch-invocations': ['agonizing-blast', 'armor-of-shadows'],
    }, 'fiend')
    const plan = buildDnd5eLevelAdvancementPlan(warlock, 'warlock', 1)
    expect(plan?.choiceRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'pact-boon', targetLimit: 1 }),
      expect.objectContaining({ key: 'eldritch-invocations', replaceable: true }),
    ]))
    if (!plan?.spellAdvancement) return
    const nextKnown = [
      ...levelTwoKnown,
      ...ids(plan.spellAdvancement, 'spell', 1, levelTwoKnown),
    ]
    const result = applyDnd5eLevelAdvancement(
      warlock,
      levelDecision('warlock', {
        cantrips: [...cantrips],
        knownSpells: nextKnown,
      }, {
        classChoiceSelections: {
          'pact-boon': ['tome'],
          'eldritch-invocations': ['agonizing-blast', 'book-of-ancient-secrets'],
        },
      }),
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.character.dnd5eClassChoices?.classes?.warlock?.selections).toMatchObject({
      'pact-boon': ['tome'],
      'eldritch-invocations': ['agonizing-blast', 'book-of-ancient-secrets'],
    })
  })

  it('rejects forged off-list spells and more than one known-spell replacement', () => {
    const initial = initialSelections('sorcerer', 'draconic')
    const sorcerer = caster('sorcerer', 1, {
      [initial.plan.cantripSelectionKey]: initial.value.cantrips,
      [initial.plan.spellSelectionKey]: initial.value.knownSpells ?? [],
    }, 'draconic')
    const plan = buildDnd5eSpellAdvancementPlan(sorcerer, 'sorcerer', 1, 2, 'draconic')
    if (!plan) throw new Error('missing sorcerer spell plan')
    const invalid = applyDnd5eSpellAdvancement(sorcerer, plan, {
      cantrips: [...initial.value.cantrips],
      knownSpells: ['not-a-real-spell', ...ids(plan, 'spell', 2, initial.value.knownSpells)],
    }, 'draconic')
    expect(invalid).toEqual({ ok: false, reason: 'invalid-spell-choice' })

    const completelyReplaced = ids(plan, 'spell', plan.targetKnownSpellCount ?? 0, initial.value.knownSpells)
    expect(dnd5eSpellAdvancementSelectionsComplete(plan, {
      cantrips: [...initial.value.cantrips],
      knownSpells: completelyReplaced,
    })).toBe(false)
  })
})
