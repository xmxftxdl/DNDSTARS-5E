import { describe, expect, it } from 'vitest'
import { auditDnd5eMonsterHeadlessCoverage } from './monsterHeadlessCoverage'
import {
  DND5E_SRD_MONSTERS,
  dnd5eMonsterAreaSavingThrowVariants,
  type Dnd5eMonsterStatBlock,
} from './monsters'

const ACTION_BASELINE = {
  total: 1055,
  headlessMinimum: 877,
  dmAdjudicationMaximum: 32,
  unstructuredMaximum: 146,
  blockedByChildMaximum: 0,
  multiattackTotal: 240,
  multiattackHeadlessMinimum: 240,
  multiattackIncompleteMaximum: 0,
  unparsedMultiattackMaximum: 0,
} as const

const SPELL_OCCURRENCE_BASELINE = {
  total: 313,
  fullMinimum: 40,
  // A prose-only definition is still forward progress from a missing spell,
  // even though it must remain manual until its map choices are structured.
  // Ratchet the combined defined set so missing -> manual -> full is monotonic.
  definedMinimum: 147,
  missingMaximum: 166,
} as const

const TRAIT_BASELINE = {
  total: 551,
  // Relentless, Petrifying Gaze, Blood Frenzy, Surprise Attack,
  // Doppelganger Ambusher, Reckless and Marilith Reactive are authoritative.
  headlessWithRuleMinimum: 104,
  dmAdjudicationMaximum: 447,
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
    expect(report.actions.summary.multiattack).toEqual({
      total: ACTION_BASELINE.multiattackTotal,
      headless: ACTION_BASELINE.multiattackHeadlessMinimum,
      incomplete: ACTION_BASELINE.multiattackIncompleteMaximum,
      unparsed: ACTION_BASELINE.unparsedMultiattackMaximum,
    })

    expect(spells.total).toBe(SPELL_OCCURRENCE_BASELINE.total)
    expect(spells.full + spells.manual + spells.missing).toBe(spells.total)
    expect(spells.full).toBeGreaterThanOrEqual(SPELL_OCCURRENCE_BASELINE.fullMinimum)
    expect(spells.full + spells.manual)
      .toBeGreaterThanOrEqual(SPELL_OCCURRENCE_BASELINE.definedMinimum)
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

  it('keeps every metallic composite breath weapon on one shared Headless recharge action', () => {
    const slugs = [
      'bronze-dragon-wyrmling',
      'young-bronze-dragon',
      'adult-bronze-dragon',
      'ancient-bronze-dragon',
      'copper-dragon-wyrmling',
      'young-copper-dragon',
      'adult-copper-dragon',
      'ancient-copper-dragon',
      'gold-dragon-wyrmling',
      'young-gold-dragon',
      'adult-gold-dragon',
      'ancient-gold-dragon',
    ] as const
    const expectedVariantIds = (slug: string) =>
      slug.includes('bronze')
        ? ['lightning-breath', 'repulsion-breath']
        : slug.includes('copper')
          ? ['acid-breath', 'slowing-breath']
          : ['fire-breath', 'weakening-breath']
    const reportRows = new Map(
      auditDnd5eMonsterHeadlessCoverage().actions.rows
        .map((row) => [`${row.slug}:${row.actionId}`, row]),
    )

    for (const slug of slugs) {
      const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.slug === slug)
      const breathWeapons = monster?.actions.find((action) => action.id === 'breath-weapons')
      expect(breathWeapons, slug).toBeDefined()
      expect(breathWeapons?.automation, slug).toBe('headless')
      expect(breathWeapons?.usage, slug).toEqual({
        kind: 'recharge',
        dieSides: 6,
        minimum: 5,
      })
      expect(dnd5eMonsterAreaSavingThrowVariants(breathWeapons!)
        .map((variant) => variant.id), slug).toEqual(expectedVariantIds(slug))
      expect(reportRows.get(`${slug}:breath-weapons`), slug).toMatchObject({
        effectiveAutomation: 'headless',
        reasonCodes: [],
      })
    }
  })

  it('counts reviewed composite special children through the composite transaction', () => {
    const dragonSlugs = DND5E_SRD_MONSTERS
      .filter((monster) =>
        /^(?:adult|ancient)-.+-dragon$/.test(monster.slug))
      .map((monster) => monster.slug)
    const rows = new Map(
      auditDnd5eMonsterHeadlessCoverage().actions.rows
        .map((row) => [`${row.slug}:${row.actionId}`, row]),
    )

    expect(dragonSlugs).toHaveLength(20)
    for (const slug of dragonSlugs) {
      expect(rows.get(`${slug}:multiattack`), slug).toMatchObject({
        effectiveAutomation: 'headless',
        blockedChildIds: [],
        reasonCodes: [],
      })
      expect(rows.get(`${slug}:multiattack-weapons-only`), slug).toMatchObject({
        effectiveAutomation: 'headless',
        blockedChildIds: [],
        reasonCodes: [],
      })
    }
  })

  it('reports both Barbed Devil Multiattack alternatives as complete Headless actions', () => {
    const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.slug === 'barbed-devil')
    expect(monster?.actions.find((action) => action.id === 'multiattack')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['tail', 'claw', 'claw'],
      sequenceAttackMode: 'melee',
    })
    expect(monster?.actions.find((action) => action.id === 'multiattack-hurl-flame')).toMatchObject({
      kind: 'multiattack',
      automation: 'headless',
      sequence: ['hurl-flame', 'hurl-flame'],
      sequenceAttackMode: 'ranged',
    })

    const rows = new Map(
      auditDnd5eMonsterHeadlessCoverage().actions.rows
        .filter((row) => row.slug === 'barbed-devil')
        .map((row) => [row.actionId, row]),
    )
    for (const actionId of ['multiattack', 'multiattack-hurl-flame', 'hurl-flame']) {
      expect(rows.get(actionId), actionId).toMatchObject({
        effectiveAutomation: 'headless',
        blockedChildIds: [],
        reasonCodes: [],
      })
    }
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

  it('reports every SRD Relentless trait as structured Headless coverage', () => {
    const expected = new Map([
      ['boar', 7],
      ['giant-boar', 10],
      ['wereboar-boar', 14],
      ['wereboar-human', 14],
      ['wereboar-hybrid', 14],
    ])
    const reportRows = new Map(
      auditDnd5eMonsterHeadlessCoverage().traits.rows
        .filter((row) => expected.has(row.slug))
        .map((row) => [row.slug, row]),
    )

    for (const [slug, maximumDamage] of expected) {
      const monster = DND5E_SRD_MONSTERS.find((candidate) => candidate.slug === slug)!
      expect(monster.traits.find((trait) => trait.rule?.kind === 'relentless')).toMatchObject({
        automation: 'headless',
        rule: { kind: 'relentless', maximumDamage },
      })
      expect(reportRows.get(slug), slug).toMatchObject({
        declaredAutomation: 'headless',
        hasRule: true,
        effectiveAutomation: 'headless-with-rule',
      })
    }
  })

  it('attributes Assassin Sneak Attack coverage to the canonical trait, not Evasion', () => {
    const rows = auditDnd5eMonsterHeadlessCoverage().traits.rows
      .filter((row) => row.slug === 'assassin')
    const sneakAttack = rows.find((row) => row.traitName === '偷袭（每回合 1 次）')
    const evasion = rows.find((row) => row.traitName === '闪避')

    expect(sneakAttack).toMatchObject({
      traitIndex: 2,
      declaredAutomation: 'headless',
      hasRule: true,
      effectiveAutomation: 'headless-with-rule',
    })
    expect(evasion).toMatchObject({
      traitIndex: 1,
      declaredAutomation: 'dm-adjudication',
      hasRule: false,
      effectiveAutomation: 'dm-adjudication',
    })
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
