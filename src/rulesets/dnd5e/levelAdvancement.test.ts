import { describe, expect, it } from 'vitest'
import type {
  Character,
  Dnd5eAdvancementAsiChoice,
  Dnd5eLevelAdvancementDecisionV1,
} from '../../types/character'
import {
  applyDnd5eLevelAdvancement,
  buildDnd5eLevelAdvancementPlan,
  reviseDnd5eLevelAdvancement,
  reviseLatestDnd5eLevelAdvancement,
} from './levelAdvancement'

function fighter(patch: Partial<Character> = {}): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'hero',
    name: '测试战士',
    player: '玩家',
    avatar: '',
    accent: '',
    race: '人类',
    charClass: '战士',
    dnd5eClassLevels: { fighter: 1 },
    level: 1,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 14 },
    savingThrows: ['str', 'con'],
    skills: ['athletics'],
    maxHp: 12,
    currentHp: 12,
    tempHp: 0,
    hitDice: '1d10',
    hitPointMaximumMode: 'fixed',
    hitPointDice: [{ sides: 10, current: 1, max: 1 }],
    ac: 16,
    speed: 30,
    initiativeBonus: 0,
    saveDC: 10,
    passivePerception: 10,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
    dnd5eClassChoices: {
      fighter: { fightingStyles: ['archery'] },
    },
    ...patch,
  }
}

function fighterDecision(
  nextClassLevel: number,
  asiChoice?: Dnd5eAdvancementAsiChoice,
  patch: Partial<Dnd5eLevelAdvancementDecisionV1> = {},
): Dnd5eLevelAdvancementDecisionV1 {
  return {
    schemaVersion: 1,
    classId: 'fighter',
    levelsGained: 1,
    hitPointMethod: 'fixed',
    hitPointRolls: [],
    ...(nextClassLevel >= 3 ? { subclassId: 'champion' } : {}),
    asiChoices: asiChoice ? [{ classLevel: nextClassLevel, choice: asiChoice }] : [],
    fighterFightingStyles: ['archery'],
    ...patch,
  }
}

function advanceFighter(
  input: Character,
  targetClassLevel: number,
  asiChoices: Partial<Record<number, Dnd5eAdvancementAsiChoice>> = {},
): Character {
  let character = input
  for (let nextLevel = (character.dnd5eClassLevels?.fighter ?? 1) + 1; nextLevel <= targetClassLevel; nextLevel += 1) {
    const result = applyDnd5eLevelAdvancement(
      character,
      fighterDecision(nextLevel, asiChoices[nextLevel]),
      { completedAt: nextLevel * 1_000, recordId: `adv-level-${nextLevel}` },
    )
    if (!result.ok) throw new Error(`advance failed: ${result.reason}`)
    character = result.character
  }
  return character
}

describe('D&D 5e level advancement transaction', () => {
  it('only builds one-level plans and rejects batch advancement', () => {
    expect(buildDnd5eLevelAdvancementPlan(fighter(), 'fighter', 6)).toBeUndefined()

    const plan = buildDnd5eLevelAdvancementPlan(fighter(), 'fighter', 1)
    expect(plan).toMatchObject({
      fromLevel: 1,
      toLevel: 2,
      fromClassLevel: 1,
      toClassLevel: 2,
      gainedClassLevels: [2],
      hitDie: 10,
    })
  })

  it('creates a level-seven character through six immutable one-level receipts', () => {
    const character = advanceFighter(fighter(), 7, {
      4: { kind: 'ability-score', increases: { str: 2 } },
      6: { kind: 'ability-score', increases: { con: 2 } },
    })

    expect(character).toMatchObject({
      level: 7,
      dnd5eClassLevels: { fighter: 7 },
      abilities: { str: 18, con: 16 },
      hitPointMaximumMode: 'fixed',
      maxHp: 67,
      currentHp: 67,
      dnd5eClassChoices: {
        fighter: { subclass: 'champion', fightingStyles: ['archery'] },
      },
    })
    expect(character.dnd5eLevelAdvancements).toHaveLength(6)
    expect(character.dnd5eLevelAdvancements?.every((record) =>
      record.toLevel === record.fromLevel + 1 &&
      record.decision.levelsGained === 1)).toBe(true)
  })

  it('requires exactly one valid HP roll for a rolled one-level gain', () => {
    const result = applyDnd5eLevelAdvancement(
      fighter(),
      fighterDecision(2, undefined, {
        hitPointMethod: 'rolled',
        hitPointRolls: [7, 8],
      }),
    )
    expect(result).toEqual({ ok: false, reason: 'invalid-hit-point-rolls' })
  })

  it('rejects an ability score increase that exceeds 20', () => {
    const levelThree = advanceFighter(
      fighter({ abilities: { str: 19, dex: 12, con: 14, int: 10, wis: 10, cha: 14 } }),
      3,
    )
    const result = applyDnd5eLevelAdvancement(
      levelThree,
      fighterDecision(4, { kind: 'ability-score', increases: { str: 2 } }),
    )
    expect(result).toEqual({ ok: false, reason: 'invalid-asi-choice' })
  })

  it('lets the DM revise an advancement without entering a reason', () => {
    const levelFour = advanceFighter(fighter(), 4, {
      4: { kind: 'ability-score', increases: { str: 2 } },
    })
    const record = levelFour.dnd5eLevelAdvancements?.at(-1)
    expect(record).toBeDefined()
    if (!record) return

    const revised = reviseLatestDnd5eLevelAdvancement(
      levelFour,
      record.id,
      fighterDecision(4, { kind: 'ability-score', increases: { con: 2 } }),
      undefined,
      9_000,
    )

    expect(revised.ok).toBe(true)
    if (!revised.ok) return
    expect(revised.character.abilities).toMatchObject({ str: 16, con: 16 })
    expect(revised.record.completedBy).toBe('dm')
    expect(revised.record.revisions).toEqual([
      expect.objectContaining({
        revisedAt: 9_000,
        revisedBy: 'dm',
        previousDecision: record.decision,
      }),
    ])
    expect(revised.record.revisions?.[0]).not.toHaveProperty('reason')
  })

  it('enforces multiclass prerequisites and fixed HP for multiclass gains', () => {
    const base = fighter()
    const rolled = applyDnd5eLevelAdvancement(base, {
      schemaVersion: 1,
      classId: 'paladin',
      levelsGained: 1,
      hitPointMethod: 'rolled',
      hitPointRolls: [8],
      asiChoices: [],
    })
    expect(rolled).toEqual({
      ok: false,
      reason: 'rolled-hit-points-not-supported-for-multiclass',
    })

    const fixed = applyDnd5eLevelAdvancement(base, {
      schemaVersion: 1,
      classId: 'paladin',
      levelsGained: 1,
      hitPointMethod: 'fixed',
      hitPointRolls: [],
      asiChoices: [],
    })
    expect(fixed.ok).toBe(true)
    if (fixed.ok) {
      expect(fixed.character.dnd5eClassLevels).toMatchObject({ fighter: 1, paladin: 1 })
      expect(fixed.character.level).toBe(2)
    }
  })

  it('requires and applies the SRD multiclass skill choice for bard, ranger and rogue', () => {
    const base = fighter({ abilities: { str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 14 } })
    const plan = buildDnd5eLevelAdvancementPlan(base, 'rogue', 1)
    expect(plan?.choiceRequirements).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'class-skills',
        targetLimit: 1,
        additionalRequired: 1,
      }),
    ]))

    const missing = applyDnd5eLevelAdvancement(base, {
      schemaVersion: 1,
      classId: 'rogue',
      levelsGained: 1,
      hitPointMethod: 'fixed',
      hitPointRolls: [],
      asiChoices: [],
    })
    expect(missing).toEqual({ ok: false, reason: 'missing-class-choice' })

    const applied = applyDnd5eLevelAdvancement(base, {
      schemaVersion: 1,
      classId: 'rogue',
      levelsGained: 1,
      hitPointMethod: 'fixed',
      hitPointRolls: [],
      asiChoices: [],
      classChoiceSelections: {
        'class-skills': ['perception'],
        expertise: ['athletics', 'perception'],
      },
    })
    expect(applied.ok).toBe(true)
    if (applied.ok) expect(applied.character.skills).toContain('perception')
  })

  it('lets the DM revise an earlier one-level record and atomically replays later advancements', () => {
    const levelSix = advanceFighter(fighter(), 6, {
      4: { kind: 'ability-score', increases: { str: 2 } },
      6: { kind: 'ability-score', increases: { con: 2 } },
    })
    const levelFourRecord = levelSix.dnd5eLevelAdvancements?.find((record) => record.toClassLevel === 4)
    expect(levelFourRecord).toBeDefined()
    if (!levelFourRecord) return

    const revised = reviseDnd5eLevelAdvancement(
      levelSix,
      levelFourRecord.id,
      fighterDecision(4, { kind: 'ability-score', increases: { dex: 2 } }),
      undefined,
      10_000,
    )
    expect(revised.ok).toBe(true)
    if (!revised.ok) return
    expect(revised.character.level).toBe(6)
    expect(revised.character.abilities).toMatchObject({ str: 16, dex: 14, con: 16 })
    expect(revised.character.dnd5eLevelAdvancements?.map((record) => record.id))
      .toEqual(['adv-level-2', 'adv-level-3', 'adv-level-4', 'adv-level-5', 'adv-level-6'])
  })

  it('rejects an earlier DM revision when it would invalidate a later feat', () => {
    const levelSix = advanceFighter(
      fighter({ abilities: { str: 11, dex: 12, con: 14, int: 10, wis: 10, cha: 14 } }),
      6,
      {
        4: { kind: 'ability-score', increases: { str: 2 } },
        6: { kind: 'feat', featId: 'srd5.1:grappler' },
      },
    )
    const levelFourRecord = levelSix.dnd5eLevelAdvancements?.find((record) => record.toClassLevel === 4)
    expect(levelFourRecord).toBeDefined()
    if (!levelFourRecord) return

    const rejected = reviseDnd5eLevelAdvancement(
      levelSix,
      levelFourRecord.id,
      fighterDecision(4, { kind: 'ability-score', increases: { dex: 2 } }),
      undefined,
      11_000,
    )
    expect(rejected).toEqual({ ok: false, reason: 'dependent-advancement-invalid' })
    expect(levelSix.abilities.str).toBe(13)
    expect(levelSix.dnd5eFeatIds).toContain('srd5.1:grappler')
  })
})
