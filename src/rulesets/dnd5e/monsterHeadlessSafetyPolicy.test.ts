import { describe, expect, it } from 'vitest'
import safetyDecisions from './generated/monsterHeadlessSafetyDecisions.generated.json'
import { DND5E_SRD_MONSTERS, getDnd5eSrdMonster } from './monsters'

describe('monster Headless semantic safety policy', () => {
  it('preserves the source of copied legendary special actions after safety review', () => {
    const fling = getDnd5eSrdMonster('srd-5.1:kraken')?.legendaryActions?.find(action => action.id === 'legendary-fling')
    expect(fling).toMatchObject({
      referencedActionId: 'fling',
      automation: 'headless',
      rule: { kind: 'throw-linked-target' },
    })
  })

  it('does not re-downgrade the complete Kraken Tentacle/Fling family or Purple Worm Tail Stinger', () => {
    for (const decisionKey of [
      'kraken:actions:tentacle',
      'kraken:actions:fling',
      'purple-worm:actions:tail-stinger',
    ]) expect(safetyDecisions.actionGaps).not.toContain(decisionKey)

    const kraken = getDnd5eSrdMonster('srd-5.1:kraken')!
    for (const actionId of [
      'tentacle',
      'fling',
      'multiattack',
      'multiattack-two-tentacles-and-fling',
      'multiattack-tentacle-and-two-flings',
      'multiattack-flings',
    ]) {
      expect(kraken.actions.find((action) => action.id === actionId), actionId)
        .toMatchObject({ automation: 'headless' })
    }
    for (const actionId of ['legendary-tentacle-attack', 'legendary-fling']) {
      expect(kraken.legendaryActions?.find((action) => action.id === actionId), actionId)
        .toMatchObject({ automation: 'headless' })
    }

    expect(getDnd5eSrdMonster('srd-5.1:purple-worm')?.actions
      .find((action) => action.id === 'tail-stinger'))
      .toMatchObject({ automation: 'headless' })
  })

  it('keeps legendary spell selectors Headless while each selected spell retains its own safety boundary', () => {
    for (const decisionKey of [
      'lich:legendaryActions:cantrip',
      'androsphinx:legendaryActions:cast-a-spell-costs-3-actions',
      'gynosphinx:legendaryActions:cast-a-spell-costs-3-actions',
    ]) expect(safetyDecisions.actionGaps).not.toContain(decisionKey)

    expect(getDnd5eSrdMonster('srd-5.1:lich')?.legendaryActions
      ?.find((action) => action.id === 'cantrip'))
      .toMatchObject({ automation: 'headless', legendaryCost: 1 })
    for (const slug of ['androsphinx', 'gynosphinx']) {
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.legendaryActions
        ?.find((action) => action.id === 'cast-a-spell-costs-3-actions'))
        .toMatchObject({ automation: 'headless', legendaryCost: 3 })
    }
  })

  it('publishes versatile monster weapons as explicit one-handed, thrown, and two-handed Headless branches', () => {
    const cases = [
      ['half-red-dragon-veteran', 'longsword', 'longsword-two-handed'],
      ['veteran', 'longsword', 'longsword-two-handed'],
      ['hobgoblin', 'longsword', 'longsword-two-handed'],
      ['gnoll', 'spear', 'spear-two-handed-melee'],
      ['guard', 'spear', 'spear-two-handed-melee'],
      ['tribal-warrior', 'spear', 'spear-two-handed-melee'],
    ] as const
    for (const [slug, sourceActionId, variantActionId] of cases) {
      expect(safetyDecisions.actionGaps)
        .not.toContain(`${slug}:actions:${sourceActionId}`)
      const actions = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions ?? []
      expect(actions.find((action) => action.id === sourceActionId), `${slug}:source`)
        .toMatchObject({ automation: 'headless', kind: 'weapon-attack' })
      expect(actions.find((action) => action.id === variantActionId), `${slug}:variant`)
        .toMatchObject({ automation: 'headless', kind: 'weapon-attack' })
    }

    for (const slug of ['half-red-dragon-veteran', 'veteran']) {
      const actions = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions ?? []
      expect(actions.find((action) => action.id === 'multiattack')?.sequence)
        .toEqual(['longsword', 'longsword', 'shortsword'])
      expect(actions.find((action) =>
        action.id === 'multiattack-two-handed-longswords-only')?.sequence)
        .toEqual(['longsword-two-handed', 'longsword-two-handed'])
      expect(actions.find((action) =>
        action.id === 'multiattack-two-handed-with-shortsword')?.sequence)
        .toEqual(['longsword-two-handed', 'longsword-two-handed', 'shortsword'])
    }
  })

  it('does not re-downgrade complete self-only Etherealness toggles', () => {
    for (const slug of ['ghost', 'succubus-incubus']) {
      expect(safetyDecisions.actionGaps).not.toContain(`${slug}:actions:etherealness`)
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'etherealness')).toMatchObject({
        automation: 'headless',
        rule: { kind: 'toggle-planar-phase', target: 'self', plane: 'ethereal' },
      })
    }
  })

  it('does not re-downgrade the complete Succubus/Incubus Draining Kiss transaction', () => {
    expect(safetyDecisions.actionGaps)
      .not.toContain('succubus-incubus:actions:draining-kiss')
    expect(getDnd5eSrdMonster('srd-5.1:succubus-incubus')?.actions
      .find((action) => action.id === 'draining-kiss')).toMatchObject({
      automation: 'headless',
      rule: {
        kind: 'saving-throw-damage-and-max-hp-reduction',
        allowWillingTarget: true,
        damageOnSuccessfulSave: 'half',
        maximumHitPointReduction: {
          basis: 'damage-taken', recovery: 'long-rest', deathAtZero: true,
        },
      },
    })
  })

  it('keeps Shillelagh weapon branches gated by the live spell effect', () => {
    for (const [slug, actionId] of [
      ['druid', 'quarterstaff-shillelagh'],
      ['dryad', 'club-shillelagh'],
    ] as const) {
      expect(safetyDecisions.actionGaps).not.toContain(`${slug}:actions:${actionId}`)
      expect(getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === actionId)).toMatchObject({
        automation: 'headless',
        requiredActiveEffectDefinitionId: 'srd-5.1:spell:shillelagh',
      })
    }
  })

  it('downgrades every audited action gap and any composite parent that depends on it', () => {
    const bySlug = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.slug, monster]))
    for (const decisionKey of safetyDecisions.actionGaps) {
      const [slug, section, actionId] = decisionKey.split(':')
      const monster = bySlug.get(slug)
      expect(monster, decisionKey).toBeDefined()
      const actions = section === 'actions'
        ? monster?.actions
        : section === 'bonusActions'
          ? monster?.bonusActions
          : section === 'reactions'
            ? monster?.reactions
            : section === 'legendaryActions'
              ? monster?.legendaryActions
              : monster?.lairActions
      const action = actions?.find((candidate) => candidate.id === actionId)
      expect(action, decisionKey).toMatchObject({
        automation: 'dm-adjudication',
        automationReason: expect.any(String),
      })
    }

    for (const monster of DND5E_SRD_MONSTERS) {
      const allActions = [
        ...monster.actions,
        ...(monster.bonusActions ?? []),
        ...(monster.reactions ?? []),
        ...(monster.legendaryActions ?? []),
        ...(monster.lairActions ?? []),
      ]
      const byId = new Map(allActions.map((action) => [action.id, action]))
      for (const action of allActions) {
        const childIds = [
          ...(action.referencedActionId ? [action.referencedActionId] : []),
          ...(action.sequence ?? []),
          ...(action.randomRepeat ? [action.randomRepeat.actionId] : []),
        ]
        if (childIds.some((childId) => byId.get(childId)?.automation === 'dm-adjudication')) {
          expect(action.automation, `${monster.slug}:${action.id}`)
            .toBe('dm-adjudication')
        }
      }
    }
  })

  it('labels both combat and exploration trait gaps as DM adjudication', () => {
    const bySlug = new Map(DND5E_SRD_MONSTERS.map((monster) => [monster.slug, monster]))
    for (const decisionKey of [
      ...safetyDecisions.traitGaps,
      ...safetyDecisions.explorationTraitGaps,
    ]) {
      const [slug, rawIndex] = decisionKey.split(':')
      const trait = bySlug.get(slug)?.traits[Number(rawIndex)]
      expect(trait, decisionKey).toMatchObject({
        automation: 'dm-adjudication',
        automationReason: expect.any(String),
      })
    }
  })

  it('keeps the remaining long-form abilities semi-automatic instead of partially mutating state', () => {
    const cases = [
      ['ghost', 'horrifying-visage', '年龄增长'],
    ] as const
    for (const [slug, actionId, reasonFragment] of cases) {
      const action = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((candidate) => candidate.id === actionId)
      expect(action, `${slug}:${actionId}`).toMatchObject({
        automation: 'dm-adjudication',
        automationReason: expect.stringContaining(reasonFragment),
      })
    }
  })

  it('does not re-downgrade the structured aboleth Tentacle transaction', () => {
    expect(safetyDecisions.actionGaps).not.toContain('aboleth:actions:tentacle')
    expect(getDnd5eSrdMonster('srd-5.1:aboleth')?.actions
      .find((candidate) => candidate.id === 'tentacle')).toMatchObject({
        automation: 'headless',
        attack: {
          onHitEffects: [expect.objectContaining({
            id: 'tentacle-disease',
            kind: 'persistent-effect',
          })],
        },
      })
  })

  it('does not re-downgrade the complete Homunculus Bite transaction', () => {
    expect(safetyDecisions.actionGaps).not.toContain('homunculus:actions:bite')
    expect(getDnd5eSrdMonster('srd-5.1:homunculus')?.actions
      .find((candidate) => candidate.id === 'bite')).toMatchObject({
        automation: 'headless',
        attack: {
          onHitEffects: [expect.objectContaining({
            id: 'bite-poisoned-unconscious',
            sharedDurationOnFailureMargin: {
              minimumFailureMargin: 5,
              count: 1,
              sides: 10,
              bonus: 0,
              roundsPerUnit: 10,
            },
          })],
        },
      })
  })

  it('declares Death Dog and Otyugh repeat saves and linked maximum-HP recovery as executable data', () => {
    const cases = [
      ['death-dog', 12, 'retain'],
      ['otyugh', 15, 'remove'],
    ] as const
    for (const [slug, dc, onSuccess] of cases) {
      const bite = getDnd5eSrdMonster(`srd-5.1:${slug}`)?.actions
        .find((action) => action.id === 'bite')
      const disease = bite?.attack?.onHitEffects?.find((effect) =>
        effect.kind === 'persistent-effect')
      expect(bite, slug).toMatchObject({ automation: 'headless' })
      expect(disease, slug).toMatchObject({
        ailment: 'disease',
        standardCondition: 'poisoned',
        calendarRepeatSave: {
          intervalMinutes: 1_440,
          ability: 'con',
          dc,
          onSuccess,
          maximumHitPointReductionOnFailure: {
            count: 1,
            sides: 10,
            recovery: 'when-effect-removed',
          },
        },
      })
    }
  })
})
