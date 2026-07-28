import { describe, expect, it } from 'vitest'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import { DND5E_SRD_MONSTERS, type Dnd5eMonsterStatBlock } from './monsters'

const ACTION_BASELINE = {
  total: 952,
  headlessMinimum: 605,
  dmAdjudicationMaximum: 102,
  unstructuredMaximum: 216,
  blockedByChildMaximum: 29,
} as const

const SPELL_OCCURRENCE_BASELINE = {
  total: 313,
  fullMinimum: 40,
  manualMaximum: 94,
  missingMaximum: 179,
} as const

const TRAIT_BASELINE = {
  total: 551,
  headlessWithRuleMinimum: 86,
  dmAdjudicationMaximum: 465,
} as const

describe('D&D 5e monster Headless coverage audit', () => {
  it('keeps the complete SRD catalog on a monotonic Headless coverage ratchet', () => {
    const report = auditDnd5eMonsterHeadlessCoverage()
    const effective = report.actions.summary.effective
    const spells = report.spells.summary

    expect(report.monsterCount).toBe(334)
    expect(report.actions.summary.total).toBe(ACTION_BASELINE.total)
    expect(
      effective.headless +
      effective.dmAdjudication +
      effective.unstructured +
      effective.blockedByChild +
      effective.invalid,
    ).toBe(report.actions.summary.total)
    expect(effective.headless).toBeGreaterThanOrEqual(ACTION_BASELINE.headlessMinimum)
    expect(effective.dmAdjudication).toBeLessThanOrEqual(ACTION_BASELINE.dmAdjudicationMaximum)
    expect(effective.unstructured).toBeLessThanOrEqual(ACTION_BASELINE.unstructuredMaximum)
    expect(effective.blockedByChild).toBeLessThanOrEqual(ACTION_BASELINE.blockedByChildMaximum)
    expect(effective.invalid).toBe(0)
    expect(report.actions.rows
      .filter((row) => row.effectiveAutomation === 'headless')
      .every((row) => row.blockedChildIds.length === 0 && row.reasonCodes.length === 0))
      .toBe(true)

    expect(spells.total).toBe(SPELL_OCCURRENCE_BASELINE.total)
    expect(spells.full + spells.manual + spells.missing).toBe(spells.total)
    expect(spells.full).toBeGreaterThanOrEqual(SPELL_OCCURRENCE_BASELINE.fullMinimum)
    expect(spells.manual).toBeLessThanOrEqual(SPELL_OCCURRENCE_BASELINE.manualMaximum)
    expect(spells.missing).toBeLessThanOrEqual(SPELL_OCCURRENCE_BASELINE.missingMaximum)
    expect(spells.compatibilityRate).toBe(spells.full / spells.total)

    expect(report.traits.summary.total).toBe(TRAIT_BASELINE.total)
    expect(report.traits.summary.headlessWithRule)
      .toBeGreaterThanOrEqual(TRAIT_BASELINE.headlessWithRuleMinimum)
    expect(report.traits.summary.dmAdjudication)
      .toBeLessThanOrEqual(TRAIT_BASELINE.dmAdjudicationMaximum)
    expect(report.traits.summary.headlessWithoutRule).toBe(0)

    expect(report.damageDefenses.summary).toEqual({
      monstersWithConditionalRules: 70,
      conditionalRuleCount: 72,
      monstersWithUnparsedClauses: 0,
      unparsedClauseCount: 0,
    })
  })

  it('retains every canonical conditional defense and structures key bypass clauses', () => {
    const report = auditDnd5eMonsterHeadlessCoverage()
    const rows = new Map(report.damageDefenses.rows.map((row) => [row.slug, row]))
    for (const slug of [
      'werebear-bear', 'werebear-human', 'werebear-hybrid',
      'wereboar-boar', 'wereboar-human', 'wereboar-hybrid',
      'wererat-human', 'wererat-hybrid', 'wererat-rat',
      'weretiger-human', 'weretiger-hybrid', 'weretiger-tiger',
      'werewolf-human', 'werewolf-hybrid', 'werewolf-wolf',
      'wight', 'wraith',
    ]) {
      expect(rows.get(slug)?.conditionalRuleCount, slug).toBeGreaterThan(0)
    }

    const rakshasa = DND5E_SRD_MONSTERS.find((monster) => monster.slug === 'rakshasa')!
    expect(rakshasa.damageDefenseRules).toEqual(expect.arrayContaining([
      {
        outcome: 'immune',
        damageTypes: ['bludgeoning', 'piercing', 'slashing'],
        delivery: 'weapon-attack',
        magical: false,
      },
      {
        outcome: 'vulnerable',
        damageTypes: ['piercing'],
        delivery: 'weapon-attack',
        magical: true,
        sourceMoralAlignment: 'good',
      },
    ]))
  })

  it('reports every catalog Magic Resistance trait as structured Headless coverage', () => {
    const namePattern = /^(?:Magic Resistance|\u9b54\u6cd5\u6297\u6027)$/i
    const catalogTraits = DND5E_SRD_MONSTERS.flatMap((monster) =>
      monster.traits.flatMap((trait, traitIndex) =>
        namePattern.test(trait.name.trim())
          ? [{ slug: monster.slug, traitIndex }]
          : []))
    const rows = auditDnd5eMonsterHeadlessCoverage().traits.rows
      .filter((row) => namePattern.test(row.traitName.trim()))

    expect(catalogTraits.length).toBeGreaterThan(0)
    expect(rows).toHaveLength(catalogTraits.length)
    expect(rows.map((row) => [row.slug, row.traitIndex])).toEqual(
      catalogTraits.map((trait) => [trait.slug, trait.traitIndex]),
    )
    expect(rows.every((row) =>
      row.declaredAutomation === 'headless' &&
      row.hasRule &&
      row.effectiveAutomation === 'headless-with-rule')).toBe(true)
  })

  it('separates explicit DM actions, missing rules, invalid claims and child-blocked Multiattack', () => {
    const base = structuredClone(DND5E_SRD_MONSTERS.find((monster) => monster.slug === 'goblin')!)
    const damage = { average: 4, count: 1, sides: 6, bonus: 1, type: 'slashing' as const }
    const headlessChild = {
      id: 'headless-child',
      name: 'Headless Child',
      description: 'A complete weapon attack.',
      kind: 'weapon-attack' as const,
      automation: 'headless' as const,
      attack: { mode: 'melee' as const, toHit: 4, target: 'one target', reachFeet: 5, damage: [damage] },
    }
    const dmChild = {
      ...headlessChild,
      id: 'dm-child',
      name: 'DM Child',
      automation: 'dm-adjudication' as const,
    }
    const monster: Dnd5eMonsterStatBlock = {
      ...base,
      actions: [
        headlessChild,
        dmChild,
        {
          id: 'blocked-parent',
          name: 'Blocked Parent',
          description: 'Uses both child attacks.',
          kind: 'multiattack',
          automation: 'headless',
          sequence: ['headless-child', 'dm-child'],
        },
        {
          id: 'unstructured',
          name: 'Unstructured',
          description: 'Requires a ruling.',
          kind: 'other',
          automation: 'dm-adjudication',
        },
        {
          id: 'structured-dm',
          name: 'Structured DM',
          description: 'Has data but remains under DM control.',
          kind: 'other',
          automation: 'dm-adjudication',
          rule: { kind: 'ability-check', ability: 'wis' },
        },
        {
          id: 'invalid-headless-claim',
          name: 'Invalid Headless Claim',
          description: 'Claims automation without a rule.',
          kind: 'other',
          automation: 'headless',
        },
      ],
    }

    const rows = new Map(
      auditDnd5eMonsterHeadlessCoverage([monster]).actions.rows
        .map((row) => [row.actionId, row]),
    )
    expect(rows.get('headless-child')).toMatchObject({
      effectiveAutomation: 'headless',
      structure: 'weapon',
      reasonCodes: [],
    })
    expect(rows.get('dm-child')).toMatchObject({
      effectiveAutomation: 'dm-adjudication',
      structure: 'weapon',
      reasonCodes: ['explicit-dm-adjudication'],
    })
    expect(rows.get('blocked-parent')).toMatchObject({
      effectiveAutomation: 'blocked-by-child',
      structure: 'multiattack',
      blockedChildIds: ['dm-child'],
      reasonCodes: ['multiattack-child-not-headless'],
    })
    expect(rows.get('unstructured')).toMatchObject({
      effectiveAutomation: 'unstructured',
      structure: 'none',
      reasonCodes: ['no-structured-rule'],
    })
    expect(rows.get('structured-dm')).toMatchObject({
      effectiveAutomation: 'dm-adjudication',
      structure: 'rule',
    })
    expect(rows.get('invalid-headless-claim')).toMatchObject({
      effectiveAutomation: 'invalid',
      reasonCodes: ['invalid-action'],
    })
  })

  it('classifies every listed spell occurrence independently of the parent spellcasting label', () => {
    const base = structuredClone(DND5E_SRD_MONSTERS.find((monster) => monster.slug === 'acolyte')!)
    const monster: Dnd5eMonsterStatBlock = {
      ...base,
      spellcasting: {
        ...base.spellcasting!,
        automation: 'headless',
        spells: [
          { id: 'fireball', name: 'Fireball', level: 3 },
          { id: 'blight', name: 'Blight', level: 4 },
          { id: 'not-a-core-spell', name: 'Unknown', level: 1 },
        ],
      },
      traits: [
        {
          name: 'Headless Without Rule',
          description: 'This must remain visible to the audit.',
          automation: 'headless',
        },
      ],
    }

    const report = auditDnd5eMonsterHeadlessCoverage([monster])
    expect(report.spells.summary).toMatchObject({ total: 3, full: 1, manual: 1, missing: 1 })
    expect(report.spells.occurrences.map((row) => [row.spellId, row.compatibility])).toEqual([
      ['fireball', 'full'],
      ['blight', 'manual'],
      ['not-a-core-spell', 'missing'],
    ])
    expect(report.spells.occurrences.every((row) => row.declaredAutomation === 'headless')).toBe(true)
    expect(report.traits.summary.headlessWithoutRule).toBe(1)
    expect(report.traits.rows[0]).toMatchObject({
      effectiveAutomation: 'headless-without-rule',
      hasRule: false,
    })
  })
})
