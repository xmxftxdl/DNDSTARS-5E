import { describe, expect, it } from 'vitest'
import {
  createDnd5eConditionEffect,
  dnd5eActiveArmorClassBonus,
} from './activeEffects'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eEffectiveSizeRank,
  dnd5ePendingSwallowRegurgitationRequirements,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { getDnd5eSrdMonsterBySlug } from './monsters'
import { dnd5eSavingThrowMode } from './passiveDefenses'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function combatant(
  id: string,
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'player',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 10,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: id === 'target' ? 5 : 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function legendaryState(slug: string) {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  if (!monster) throw new Error(`Missing monster ${slug}`)
  const target = combatant('target', 20, {
    creatureType: 'humanoid',
    savingThrowBonuses: { con: 0 },
  })
  const actor = combatant(slug, 10, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
  })
  const state = startDnd5eHeadlessCombat(`legendary-area:${slug}`, [target, actor])
  state.combatants[slug]!.classState.monsterLegendaryActionPoints = 3
  return state
}

describe('remaining combat action Headless coverage batch', () => {
  it('embeds missing Vampire-form attacks while retaining safe local references', () => {
    const bat = getDnd5eSrdMonsterBySlug('vampire-bat')!
    const mist = getDnd5eSrdMonsterBySlug('vampire-mist')!

    expect(bat.legendaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'legendary-unarmed-strike',
        kind: 'weapon-attack',
        automation: 'headless',
        attack: expect.objectContaining({ toHit: 9 }),
      }),
      expect.objectContaining({
        id: 'legendary-bite-costs-2-actions',
        referencedActionId: 'bite',
        automation: 'headless',
      }),
    ]))
    expect(mist.legendaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'legendary-unarmed-strike',
        kind: 'weapon-attack',
        automation: 'headless',
        attack: expect.objectContaining({ toHit: 9 }),
      }),
      expect.objectContaining({
        id: 'legendary-bite-costs-2-actions',
        kind: 'weapon-attack',
        automation: 'headless',
        attack: expect.objectContaining({ toHit: 9 }),
      }),
    ]))
  })

  it('exposes every Druid quarterstaff damage branch without parsing prose', () => {
    const druid = getDnd5eSrdMonsterBySlug('druid')
    expect(druid?.actions.filter((action) => action.id.startsWith('quarterstaff')))
      .toMatchObject([
        { id: 'quarterstaff', automation: 'headless', attack: { toHit: 2, damage: [{ count: 1, sides: 6, bonus: 0 }] } },
        { id: 'quarterstaff-two-handed', automation: 'headless', attack: { toHit: 2, damage: [{ count: 1, sides: 8, bonus: 0 }] } },
        { id: 'quarterstaff-shillelagh', automation: 'headless', attack: { toHit: 4, damage: [{ count: 1, sides: 8, bonus: 2 }] } },
      ])
  })

  it('settles the Homunculus poison and margin-gated unconscious rider', () => {
    const monster = getDnd5eSrdMonsterBySlug('homunculus')!
    const actor = combatant('homunculus', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
    })
    const target = combatant('target', 10, { savingThrowBonuses: { con: 0 } })
    const state = startDnd5eHeadlessCombat('homunculus-bite', [actor, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'bite',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [[]],
        onHitEffectRolls: [{ effectId: 'bite-poisoned-unconscious', d20: 1 }],
      }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['poisoned', 'unconscious']),
    )
  })

  it('resolves Lich Disrupt Life as a three-point legendary area action', () => {
    const state = legendaryState('lich')
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'lich',
      actionId: 'disrupt-life-costs-3-actions',
      legendary: true,
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        targetSavingThrows: [{ targetId: 'target', d20: 1 }],
        damageRolls: [1, 1, 1, 1, 1, 1],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(94)
    expect(result.state.combatants.lich.classState.monsterLegendaryActionPoints).toBe(0)
    expect(result.state.combatants.lich.turn.actionAvailable).toBe(true)
  })

  it('settles Solar Searing Burst with fire and radiant defenses independently', () => {
    const state = legendaryState('solar')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('solar', 'target')]: 5,
    }
    state.combatants.target.savingThrowBonuses = { dex: 0 }
    state.combatants.target.damageResistances = ['fire']
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'solar',
      actionId: 'searing-burst-costs-2-actions',
      legendary: true,
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        targetSavingThrows: [{ targetId: 'target', d20: 1 }],
        damageRolls: [1, 1, 1, 1, 1, 1, 1, 1],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(94)
    expect(result.state.combatants.solar.classState.monsterLegendaryActionPoints).toBe(1)
  })

  it.each([
    ['blinding-dust', 'blinded', 1],
    ['blasphemous-word-costs-2-actions', 'stunned', 2],
  ] as const)(
    'resolves Mummy Lord %s and charges its declared legendary cost',
    (actionId, expectedCondition, expectedCost) => {
      const state = legendaryState('mummy-lord')
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-area-action',
        actorId: 'mummy-lord',
        actionId,
        legendary: true,
        resolution: {
          schemaVersion: 1,
          targetIds: ['target'],
          targetSavingThrows: [{ targetId: 'target', d20: 1 }],
          damageRolls: [],
        },
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants.target.conditions).toContain(expectedCondition)
      expect(result.state.combatants['mummy-lord'].classState.monsterLegendaryActionPoints)
        .toBe(3 - expectedCost)
      expect(result.state.combatants['mummy-lord'].turn.actionAvailable).toBe(true)
    },
  )

  it('settles Sea Hag Death Glare only against a frightened visible target', () => {
    const monster = getDnd5eSrdMonsterBySlug('sea-hag')!
    const actor = combatant('sea-hag', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
    })
    const frightened = createDnd5eConditionEffect({
      condition: 'frightened',
      targetId: 'target',
      source: { kind: 'system', rulesId: 'test:frightened' },
    })
    const target = combatant('target', 10, {
      classState: { activeEffects: [frightened] },
      conditions: ['frightened'],
      savingThrowBonuses: { wis: 0 },
    })
    const state = startDnd5eHeadlessCombat('sea-hag-death-glare', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'death-glare',
      targetId: target.id,
      d20: 1,
      damageRolls: [],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(0)
    expect(result.state.combatants.target.deathSaves.dead).toBe(false)
  })

  it('settles Will-o-Wisp Consume Life as a bonus action and heals only on death', () => {
    const monster = getDnd5eSrdMonsterBySlug('will-o-wisp')!
    const actor = combatant('will-o-wisp', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      currentHp: 10,
      maxHp: 22,
    })
    const target = combatant('target', 10, {
      currentHp: 0,
      maxHp: 20,
      savingThrowBonuses: { con: 0 },
    })
    const state = startDnd5eHeadlessCombat('consume-life', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'consume-life',
      targetId: target.id,
      d20: 1,
      damageRolls: [1, 1, 1],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.deathSaves.dead).toBe(true)
    expect(result.state.combatants['will-o-wisp'].currentHp).toBe(13)
    expect(result.state.combatants['will-o-wisp'].turn.actionAvailable).toBe(true)
    expect(result.state.combatants['will-o-wisp'].turn.bonusActionAvailable).toBe(false)
  })

  it('settles Unicorn Heal Self with legendary points and no normal action spend', () => {
    const state = legendaryState('unicorn')
    state.combatants.unicorn.currentHp = 30
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-legendary-special-action',
      actorId: 'unicorn',
      actionId: 'heal-self-costs-3-actions',
      damageRolls: [1, 1],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.unicorn.currentHp).toBe(34)
    expect(result.state.combatants.unicorn.classState.monsterLegendaryActionPoints).toBe(0)
    expect(result.state.combatants.unicorn.turn.actionAvailable).toBe(true)
  })

  it('settles Unicorn Shimmering Shield as a source-bound +2 AC effect', () => {
    const state = legendaryState('unicorn')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('unicorn', 'target')]: 30,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-legendary-special-action',
      actorId: 'unicorn',
      actionId: 'shimmering-shield-costs-2-actions',
      targetId: 'target',
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.activeEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: expect.objectContaining({ actorId: 'unicorn', magical: true }),
          duration: { type: 'until-turn-boundary', boundary: 'source-turn-end' },
          modifiers: expect.objectContaining({ armorClassBonus: 2 }),
        }),
      ]),
    )
    expect(result.state.combatants.unicorn.classState.monsterLegendaryActionPoints).toBe(1)
    expect(result.state.combatants.unicorn.turn.actionAvailable).toBe(true)
  })

  it('settles Otyugh Tentacle Slam against exactly every tentacle-held target', () => {
    const monster = getDnd5eSrdMonsterBySlug('otyugh')!
    const actor = combatant('otyugh', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const heldTargets = ['target', 'target-2'].map((id, index) => combatant(id, 10 - index, {
      position: { x: 5 + index, y: 0 },
      savingThrowBonuses: { con: 0 },
    }))
    let state = startDnd5eHeadlessCombat('otyugh-tentacle-slam', [actor, ...heldTargets])
    state.distanceFeetByCombatantPair = Object.fromEntries(heldTargets.map((target) => [
      dnd5eCombatantPairKey(actor.id, target.id),
      5,
    ]))
    for (const target of heldTargets) {
      const grabbed = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: actor.id,
        actionId: 'tentacle',
        rolls: [{
          targetId: target.id,
          d20: 10,
          damageRolls: [[1], [1]],
          onHitEffectRolls: [{ effectId: 'tentacle-grapple' }],
        }],
      })
      expect(grabbed.ok, grabbed.ok ? undefined : grabbed.reason).toBe(true)
      if (!grabbed.ok) return
      state = grabbed.state
      state.combatants[actor.id].turn.actionAvailable = true
    }
    expect(dnd5eSourceLinkedRelations(state, actor.id, 'tentacle').map(({ target }) => target.id))
      .toEqual(['target', 'target-2'])
    const hpBeforeSlam = Object.fromEntries(heldTargets.map((target) => [
      target.id,
      state.combatants[target.id].currentHp,
    ]))
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'tentacle-slam',
      resolution: {
        schemaVersion: 1,
        targetIds: heldTargets.map((target) => target.id),
        targetSavingThrows: heldTargets.map((target) => ({ targetId: target.id, d20: 1 })),
        damageRolls: [1, 1],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    for (const target of heldTargets) {
      expect(result.state.combatants[target.id].currentHp).toBe(hpBeforeSlam[target.id] - 5)
      expect(result.state.combatants[target.id].conditions).toContain('stunned')
    }
  })

  it('splits Mummy Lord Attack into executable fist and Dreadful Glare variants', () => {
    const monster = getDnd5eSrdMonsterBySlug('mummy-lord')!
    expect(monster.legendaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'attack-rotting-fist',
        referencedActionId: 'rotting-fist',
        automation: 'headless',
      }),
      expect.objectContaining({
        id: 'attack-dreadful-glare',
        automation: 'headless',
        rule: expect.objectContaining({ kind: 'saving-throw-condition' }),
      }),
    ]))
    const state = legendaryState('mummy-lord')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('mummy-lord', 'target')]: 30,
    }
    state.combatants.target.savingThrowBonuses = { wis: 0 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-legendary-special-action',
      actorId: 'mummy-lord',
      actionId: 'attack-dreadful-glare',
      targetId: 'target',
      d20: 1,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['frightened', 'paralyzed']),
    )
    expect(result.state.combatants['mummy-lord'].classState.monsterLegendaryActionPoints)
      .toBe(2)
  })

  it('settles Green Hag Invisible Passage as concentration invisibility', () => {
    const monster = getDnd5eSrdMonsterBySlug('green-hag')!
    const actor = combatant('green-hag', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const state = startDnd5eHeadlessCombat('green-hag-invisible-passage', [
      actor,
      combatant('target', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'invisible-passage',
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants['green-hag'].conditions).toContain('invisible')
    expect(result.state.combatants['green-hag'].concentrating).toBe(true)
  })

  it('settles Mummy Lord Channel Negative Energy through barriers without a client target list', () => {
    const state = legendaryState('mummy-lord')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('mummy-lord', 'target')]: 30,
    }
    state.lineOfEffectBlockedByCombatantPair = {
      ['mummy-lord\u0000target']: true,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-legendary-special-action',
      actorId: 'mummy-lord',
      actionId: 'channel-negative-energy-costs-2-actions',
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    for (const id of ['mummy-lord', 'target']) {
      expect(result.state.combatants[id].classState.activeEffects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: expect.objectContaining({ actorId: 'mummy-lord', magical: true }),
            duration: { type: 'until-turn-boundary', boundary: 'source-turn-end' },
            modifiers: expect.objectContaining({ preventHealing: true }),
          }),
        ]),
      )
    }
    expect(result.state.combatants['mummy-lord'].classState.monsterLegendaryActionPoints)
      .toBe(1)
  })

  it('settles Rug of Smothering Smother as an attached suffocating restraint', () => {
    const monster = getDnd5eSrdMonsterBySlug('rug-of-smothering')!
    const actor = combatant('rug-of-smothering', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const target = combatant('target', 10, { sizeRank: 2 })
    const other = combatant('other', 5, { sizeRank: 2, position: { x: 5, y: 0 } })
    const state = startDnd5eHeadlessCombat('rug-smother', [actor, target, other])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
      [dnd5eCombatantPairKey(actor.id, other.id)]: 5,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'smother',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [],
        onHitEffectRolls: [{ effectId: 'smother-attachment' }],
      }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return

    expect(result.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['grappled', 'restrained', 'blinded']),
    )
    expect(result.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({ legacyCondition: 'unable-to-breathe' }),
    )
    const relations = dnd5eSourceLinkedRelations(
      result.state,
      actor.id,
      'smother',
    )
    expect(relations).toHaveLength(1)
    expect(relations[0]?.effect.relation).toMatchObject({
      kind: 'grapple',
      movement: 'source-rides-target',
    })
    expect(relations[0]?.effect.periodicDamage).toMatchObject({
      timing: 'target-turn-start',
      count: 2,
      sides: 6,
      modifier: 3,
      type: 'bludgeoning',
    })

    result.state.combatants[actor.id].turn.actionAvailable = true
    expect(resolveDnd5eHeadlessAction(result.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'smother',
      rolls: [{
        targetId: other.id,
        d20: 10,
        damageRolls: [],
        onHitEffectRolls: [{ effectId: 'smother-attachment' }],
      }],
    })).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('settles Clay Golem Haste and gates its bonus-action Slam behind the buff', () => {
    const monster = getDnd5eSrdMonsterBySlug('clay-golem')!
    const actor = combatant('clay-golem', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
      armorClass: monster.armorClass.value,
      currentHp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const target = combatant('target', 10, {
      savingThrowBonuses: { con: 0 },
    })
    const state = startDnd5eHeadlessCombat('clay-golem-haste', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const bonusSlam = {
      type: 'monster-bonus-action' as const,
      actorId: actor.id,
      actionId: 'haste-slam-bonus-action',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [[1, 1]],
        onHitEffectRolls: [{
          effectId: 'slam-hit-point-maximum-reduction',
          d20: 20,
        }],
      }],
    }

    expect(resolveDnd5eHeadlessAction(state, bonusSlam)).toMatchObject({
      ok: false,
      reason: 'class-resource-unavailable',
    })

    const haste = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'haste',
    })
    expect(haste.ok, haste.ok ? undefined : haste.reason).toBe(true)
    if (!haste.ok) return
    const hasteEffect = haste.state.combatants[actor.id].classState.activeEffects?.find(
      (effect) => effect.definitionId ===
        `monster:${monster.id}:haste:self-combat-buff`,
    )
    expect(hasteEffect).toMatchObject({
      duration: { type: 'until-turn-boundary', boundary: 'source-turn-end' },
      modifiers: {
        armorClassBonus: 2,
        savingThrowAdvantages: ['dex'],
      },
    })
    expect(dnd5eActiveArmorClassBonus(
      haste.state.combatants[actor.id].classState.activeEffects,
    )).toBe(2)
    expect(dnd5eSavingThrowMode(
      haste.state.combatants[actor.id],
      'dex',
    )).toBe('advantage')
    expect(haste.state.combatants[actor.id].turn).toMatchObject({
      actionAvailable: false,
      bonusActionAvailable: true,
    })

    const slammed = resolveDnd5eHeadlessAction(haste.state, bonusSlam)
    expect(slammed.ok, slammed.ok ? undefined : slammed.reason).toBe(true)
    if (!slammed.ok) return
    expect(slammed.state.combatants.target.currentHp).toBe(93)
    expect(slammed.state.combatants[actor.id].turn).toMatchObject({
      actionAvailable: false,
      bonusActionAvailable: false,
    })
  })

  it('settles Duergar Enlarge and gates both normal and doubled-damage branches', () => {
    const monster = getDnd5eSrdMonsterBySlug('duergar')!
    const actor = combatant('duergar', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const target = combatant('target', 10)
    const state = startDnd5eHeadlessCombat('duergar-enlarge', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const enlargedAttack = {
      type: 'monster-action' as const,
      actorId: actor.id,
      actionId: 'war-pick-enlarged',
      rolls: [{ targetId: target.id, d20: 10, damageRolls: [[1, 1]] }],
    }
    expect(resolveDnd5eHeadlessAction(state, enlargedAttack)).toMatchObject({
      ok: false,
      reason: 'class-resource-unavailable',
    })

    const enlarged = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'enlarge',
    })
    expect(enlarged.ok, enlarged.ok ? undefined : enlarged.reason).toBe(true)
    if (!enlarged.ok) return
    expect(enlarged.state.combatants[actor.id].classState.activeEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          definitionId: `monster:${monster.id}:enlarge:self-combat-buff`,
          duration: {
            type: 'rounds',
            remainingRounds: 10,
            tickOn: 'target-turn-end',
          },
          modifiers: expect.objectContaining({
            sizeRankDelta: 1,
            strengthRollMode: 'advantage',
          }),
        }),
      ]),
    )
    expect(dnd5eEffectiveSizeRank(enlarged.state.combatants[actor.id])).toBe(3)
    expect(dnd5eSavingThrowMode(enlarged.state.combatants[actor.id], 'str'))
      .toBe('advantage')

    enlarged.state.combatants[actor.id].turn.actionAvailable = true
    expect(resolveDnd5eHeadlessAction(enlarged.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'war-pick',
      rolls: [{ targetId: target.id, d20: 10, damageRolls: [[1]] }],
    })).toMatchObject({ ok: false, reason: 'invalid-monster-action' })

    const attacked = resolveDnd5eHeadlessAction(enlarged.state, enlargedAttack)
    expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
    if (!attacked.ok) return
    expect(attacked.state.combatants.target.currentHp).toBe(96)
  })

  it.each([
    ['tarrasque', 20, true],
    ['vampire-vampire', 30, false],
    ['vampire-bat', 30, false],
    ['vampire-mist', 20, false],
  ] as const)(
    'settles %s legendary Move as bounded movement budget',
    (slug, expectedMovement, provokesOpportunityAttacks) => {
      const state = legendaryState(slug)
      const monster = getDnd5eSrdMonsterBySlug(slug)!
      state.combatants[slug].speed = monster.speed.walk ?? 0
      state.combatants[slug].movementSpeeds = { ...monster.speed }
      state.combatants[slug].turn.movementRemaining = 0
      state.combatants[slug].disengaged = false
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-legendary-special-action',
        actorId: slug,
        actionId: 'move',
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants[slug].turn.movementRemaining)
        .toBe(expectedMovement)
      expect(result.state.combatants[slug].disengaged)
        .toBe(!provokesOpportunityAttacks)
      expect(result.state.combatants[slug].classState.monsterLegendaryActionPoints)
        .toBe(2)
      expect(result.events).toContainEqual({
        type: 'movement-granted',
        actorId: slug,
        amount: expectedMovement,
      })
      expect(result.events.some((event) => event.type === 'disengage-granted'))
        .toBe(!provokesOpportunityAttacks)
    },
  )

  it('splits Tarrasque Chomp into executable Bite and Swallow legendary choices', () => {
    const monster = getDnd5eSrdMonsterBySlug('tarrasque')!
    expect(monster.legendaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'chomp-bite-costs-2-actions',
        referencedActionId: 'bite',
        automation: 'headless',
      }),
      expect.objectContaining({
        id: 'chomp-swallow-costs-2-actions',
        referencedActionId: 'swallow',
        automation: 'headless',
      }),
    ]))
    const state = legendaryState('tarrasque')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('tarrasque', 'target')]: 10,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-legendary-action',
      actorId: 'tarrasque',
      actionId: 'chomp-bite-costs-2-actions',
      rolls: [{
        targetId: 'target',
        d20: 10,
        damageRolls: [[1, 1, 1, 1]],
        onHitEffectRolls: [{ effectId: 'bite-grapple' }],
      }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(86)
    expect(result.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['grappled', 'restrained']),
    )
    expect(result.state.combatants.tarrasque.classState.monsterLegendaryActionPoints)
      .toBe(1)
  })

  it('splits Kraken Tentacle Attack or Fling into executable legendary choices', () => {
    const monster = getDnd5eSrdMonsterBySlug('kraken')!
    expect(monster.legendaryActions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'legendary-tentacle-attack',
        referencedActionId: 'tentacle',
        automation: 'headless',
      }),
      expect.objectContaining({
        id: 'legendary-fling',
        automation: 'headless',
        relationRequirement: {
          kind: 'target-linked-to-source',
          slotGroup: 'tentacle',
        },
        rule: expect.objectContaining({ kind: 'throw-linked-target' }),
      }),
    ]))
    const state = legendaryState('kraken')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('kraken', 'target')]: 30,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-legendary-action',
      actorId: 'kraken',
      actionId: 'legendary-tentacle-attack',
      rolls: [{
        targetId: 'target',
        d20: 10,
        damageRolls: [[1, 1, 1]],
        onHitEffectRolls: [{ effectId: 'tentacle-grapple' }],
      }],
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(87)
    expect(result.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['grappled', 'restrained']),
    )
    expect(result.state.combatants.kraken.classState.monsterLegendaryActionPoints)
      .toBe(2)
  })

  it('settles Vrock Spores through periodic damage and repeat-save effect lifecycle', () => {
    const monster = getDnd5eSrdMonsterBySlug('vrock')!
    const actor = combatant('vrock', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const target = combatant('target', 10, { savingThrowBonuses: { con: 0 } })
    const state = startDnd5eHeadlessCombat('vrock-spores', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 10,
    }
    const applied = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'spores',
      resolution: {
        schemaVersion: 1,
        targetIds: [target.id],
        targetSavingThrows: [{ targetId: target.id, d20: 1 }],
        damageRolls: [],
      },
    })
    expect(applied.ok, applied.ok ? undefined : applied.reason).toBe(true)
    if (!applied.ok) return
    const effect = applied.state.combatants.target.classState.activeEffects?.find(
      (candidate) => candidate.stackingKey === 'monster-area:vrock-spores',
    )
    expect(effect).toMatchObject({
      standardCondition: 'poisoned',
      repeatSave: {
        ability: 'con',
        dc: 14,
        timing: 'target-turn-end',
        onSuccess: 'remove',
      },
      periodicDamage: {
        timing: 'target-turn-start',
        count: 1,
        sides: 10,
        modifier: 0,
        type: 'poison',
      },
    })
    expect(applied.state.combatants.target.conditions).toContain('poisoned')

    const targetTurn = resolveDnd5eHeadlessAction(applied.state, {
      type: 'end-turn',
      actorId: actor.id,
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: effect!.id,
        targetId: target.id,
        rolls: [5],
      }],
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    expect(targetTurn.state.combatants.target.currentHp).toBe(95)

    const recovered = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn',
      actorId: target.id,
      activeEffectSavingThrows: [{
        effectId: effect!.id,
        targetId: target.id,
        d20: 20,
      }],
      nextMonsterRechargeRolls: [{
        actorId: actor.id,
        actionId: 'spores',
        roll: 1,
      }],
    })
    expect(recovered.ok, recovered.ok ? undefined : recovered.reason).toBe(true)
    if (!recovered.ok) return
    expect(recovered.state.combatants.target.conditions).not.toContain('poisoned')
    expect(recovered.state.combatants.target.classState.activeEffects ?? [])
      .not.toContainEqual(expect.objectContaining({ id: effect!.id }))
  })

  it('settles Ghost Horrifying Visage and enforces source-action immunity', () => {
    const monster = getDnd5eSrdMonsterBySlug('ghost')!
    const actor = combatant('ghost', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const target = combatant('target', 10, { savingThrowBonuses: { wis: 20 } })
    const state = startDnd5eHeadlessCombat('ghost-horrifying-visage', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 30,
    }
    const saved = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'horrifying-visage',
      resolution: {
        schemaVersion: 1,
        targetIds: [target.id],
        targetSavingThrows: [{ targetId: target.id, d20: 20 }],
        damageRolls: [],
      },
    })
    expect(saved.ok, saved.ok ? undefined : saved.reason).toBe(true)
    if (!saved.ok) return
    expect(saved.state.combatants.target.conditions).not.toContain('frightened')
    expect(saved.state.combatants.target.classState.monsterActionImmunityRoundsByKey)
      .toEqual({ 'source-action:ghost:horrifying-visage': 14_400 })

    saved.state.combatants.ghost.turn.actionAvailable = true
    const immune = resolveDnd5eHeadlessAction(saved.state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'horrifying-visage',
      resolution: {
        schemaVersion: 1,
        targetIds: [target.id],
        targetSavingThrows: [{ targetId: target.id, d20: 1 }],
        damageRolls: [],
      },
    })
    expect(immune).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(immune.state.combatants.ghost.turn.actionAvailable).toBe(true)
  })

  it('enforces the Androsphinx Roar sequence and resolves all three stages', () => {
    const monster = getDnd5eSrdMonsterBySlug('androsphinx')!
    const roar = monster.actions.find((candidate) => candidate.id === 'roar')
    expect(roar).toMatchObject({
      automation: 'headless',
      usage: { kind: 'per-day', max: 3 },
      rule: {
        kind: 'area-saving-throw',
        orderedVariantIds: ['first-roar', 'second-roar', 'third-roar'],
      },
    })
    const actor = combatant('androsphinx', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
      classState: {
        monsterActionUsesByActionId: { roar: { current: 3, max: 3 } },
      },
    })
    const firstTarget = combatant('first-target', 10, {
      savingThrowBonuses: { wis: 0 },
    })
    const thirdTarget = combatant('third-target', 5, {
      savingThrowBonuses: { con: 0 },
    })
    let state = startDnd5eHeadlessCombat('androsphinx-roar', [
      actor,
      firstTarget,
      thirdTarget,
    ])

    const first = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'roar',
      resolution: {
        schemaVersion: 1,
        variantId: 'first-roar',
        targetIds: [firstTarget.id],
        targetSavingThrows: [{ targetId: firstTarget.id, d20: 1 }],
        damageRolls: [],
      },
    })
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    if (!first.ok) return
    expect(first.state.combatants[firstTarget.id].conditions).toContain('frightened')
    expect(first.state.combatants[actor.id].classState
      .monsterActionUsesByActionId?.roar?.current).toBe(2)

    first.state.combatants[actor.id].turn.actionAvailable = true
    const skippedStage = resolveDnd5eHeadlessAction(first.state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'roar',
      resolution: {
        schemaVersion: 1,
        variantId: 'third-roar',
        targetIds: [thirdTarget.id],
        targetSavingThrows: [{ targetId: thirdTarget.id, d20: 1 }],
        damageRolls: Array(8).fill(1),
      },
    })
    expect(skippedStage).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(skippedStage.state.combatants[actor.id].classState
      .monsterActionUsesByActionId?.roar?.current).toBe(2)

    const second = resolveDnd5eHeadlessAction(skippedStage.state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'roar',
      resolution: {
        schemaVersion: 1,
        variantId: 'second-roar',
        targetIds: [firstTarget.id],
        targetSavingThrows: [{ targetId: firstTarget.id, d20: 1 }],
        damageRolls: [],
      },
    })
    expect(second.ok, second.ok ? undefined : second.reason).toBe(true)
    if (!second.ok) return
    expect(second.state.combatants[firstTarget.id].conditions).toEqual(
      expect.arrayContaining(['frightened', 'deafened', 'paralyzed']),
    )

    second.state.combatants[actor.id].turn.actionAvailable = true
    state = second.state
    const third = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'roar',
      resolution: {
        schemaVersion: 1,
        variantId: 'third-roar',
        targetIds: [thirdTarget.id],
        targetSavingThrows: [{ targetId: thirdTarget.id, d20: 1 }],
        damageRolls: Array(8).fill(1),
      },
    })
    expect(third.ok, third.ok ? undefined : third.reason).toBe(true)
    if (!third.ok) return
    expect(third.state.combatants[thirdTarget.id].currentHp).toBe(92)
    expect(third.state.combatants[thirdTarget.id].conditions).toContain('prone')
    expect(third.state.combatants[actor.id].classState
      .monsterActionUsesByActionId?.roar?.current).toBe(0)
  })

  it('limits Kraken Lightning Storm to three visible selected targets', () => {
    const monster = getDnd5eSrdMonsterBySlug('kraken')!
    const actor = combatant('kraken', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const targets = Array.from({ length: 4 }, (_, index) => combatant(`target-${index + 1}`, 10 - index, {
      position: { x: 10 + index * 5, y: 0 },
      savingThrowBonuses: { dex: 0 },
    }))
    const state = startDnd5eHeadlessCombat('kraken-lightning-storm', [actor, ...targets])
    state.distanceFeetByCombatantPair = Object.fromEntries(targets.map((target) => [
      dnd5eCombatantPairKey(actor.id, target.id),
      30,
    ]))
    const tooMany = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'lightning-storm',
      resolution: {
        schemaVersion: 1,
        targetIds: targets.map((target) => target.id),
        targetSavingThrows: targets.map((target) => ({ targetId: target.id, d20: 1 })),
        damageRolls: [1, 1, 1, 1],
      },
    })
    expect(tooMany).toMatchObject({ ok: false, reason: 'invalid-dice' })
    expect(tooMany.state.combatants.kraken.turn.actionAvailable).toBe(true)

    const selected = targets.slice(0, 3)
    const resolved = resolveDnd5eHeadlessAction(tooMany.state, {
      type: 'monster-area-action',
      actorId: actor.id,
      actionId: 'lightning-storm',
      resolution: {
        schemaVersion: 1,
        targetIds: selected.map((target) => target.id),
        targetSavingThrows: selected.map((target) => ({ targetId: target.id, d20: 1 })),
        damageRolls: [1, 1, 1, 1],
      },
    })
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    for (const target of selected) {
      expect(resolved.state.combatants[target.id].currentHp).toBe(96)
    }
    expect(resolved.state.combatants[targets[3].id].currentHp).toBe(100)
  })

  it('settles Kraken Lightning Storm as a two-point legendary area action', () => {
    const state = legendaryState('kraken')
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey('kraken', 'target')]: 30,
    }
    state.combatants.target.savingThrowBonuses = { dex: 0 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-area-action',
      actorId: 'kraken',
      actionId: 'lightning-storm-costs-2-actions',
      legendary: true,
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        targetSavingThrows: [{ targetId: 'target', d20: 1 }],
        damageRolls: [1, 1, 1, 1],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(96)
    expect(result.state.combatants.kraken.classState.monsterLegendaryActionPoints).toBe(1)
  })

  it.each([
    ['ettercap', 4, 11, 3],
    ['giant-spider', 5, 12, undefined],
  ] as const)('settles %s Web restraint and its action escape', (
    slug,
    toHit,
    escapeDc,
    targetMaxSizeRank,
  ) => {
    const monster = getDnd5eSrdMonsterBySlug(slug)!
    const action = monster.actions.find((candidate) => candidate.id === 'web')
    expect(action).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      usage: { kind: 'recharge', dieSides: 6, minimum: 5 },
      attack: expect.objectContaining({
        mode: 'ranged',
        toHit,
        rangeFeet: { normal: 30, long: 60 },
        ...(targetMaxSizeRank == null ? {} : { targetMaxSizeRank }),
      }),
    })
    const actor = combatant(slug, 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const target = combatant('target', 10, { sizeRank: 2 })
    const state = startDnd5eHeadlessCombat(`${slug}-web`, [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 20,
    }
    const hit = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'web',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [],
        onHitEffectRolls: [{ effectId: 'web-restraint' }],
      }],
    })
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    if (!hit.ok) return
    const effect = hit.state.combatants.target.classState.activeEffects?.find((candidate) =>
      candidate.source.rulesId === `monster:srd-5.1:${slug}:web:web-restraint`)
    expect(effect).toMatchObject({
      standardCondition: 'restrained',
      escapeCheck: { ability: 'str', dc: escapeDc, economy: 'action' },
    })
    expect(hit.state.combatants.target.conditions).toContain('restrained')

    const targetTurn = resolveDnd5eHeadlessAction(hit.state, {
      type: 'end-turn',
      actorId: actor.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok || !effect) return
    const escaped = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'escape-active-effect',
      actorId: target.id,
      effectId: effect.id,
      d20: 20,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    if (!escaped.ok) return
    expect(escaped.state.combatants.target.conditions).not.toContain('restrained')
  })

  it.each([
    ['behir', 'constrict', 'constrict', 2, 6, 6],
    ['giant-frog', 'bite', 'bite', 1, 2, 4],
    ['giant-toad', 'bite', 'bite', 2, 3, 6],
    ['remorhaz', 'bite', 'bite', 2, 6, 6],
  ] as const)('settles %s Swallow from the required grapple relation', (
    slug,
    grappleActionId,
    grappleSlotGroup,
    maximumTargetSizeRank,
    periodicCount,
    periodicSides,
  ) => {
    const monster = getDnd5eSrdMonsterBySlug(slug)!
    const grappleAction = monster.actions.find((candidate) =>
      candidate.id === grappleActionId)!
    const grappleEffect = grappleAction.attack?.onHitEffects?.find((effect) =>
      effect.kind === 'source-linked-condition')
    const swallow = monster.actions.find((candidate) => candidate.id === 'swallow')
    expect(swallow).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      relationRequirement: {
        kind: 'target-linked-to-source',
        slotGroup: grappleSlotGroup,
      },
      attack: expect.objectContaining({ targetMaxSizeRank: maximumTargetSizeRank }),
    })
    expect(grappleEffect).toBeDefined()
    const actor = combatant(slug, 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
      currentHp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const target = combatant('target', 10, {
      sizeRank: maximumTargetSizeRank,
      currentHp: 500,
      maxHp: 500,
    })
    const state = startDnd5eHeadlessCombat(`${slug}-swallow`, [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: grappleActionId,
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: grappleAction.attack!.damage.map((damage) =>
          Array.from({ length: damage.count }, () => 1)),
        onHitEffectRolls: [{ effectId: grappleEffect!.id }],
      }],
    })
    expect(grappled.ok, grappled.ok ? undefined : grappled.reason).toBe(true)
    if (!grappled.ok) return
    expect(dnd5eSourceLinkedRelations(grappled.state, actor.id, grappleSlotGroup))
      .toHaveLength(1)

    grappled.state.combatants[actor.id].turn.actionAvailable = true
    const swallowed = resolveDnd5eHeadlessAction(grappled.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'swallow',
      rolls: [{
        targetId: target.id,
        d20: 10,
        d20Second: 10,
        damageRolls: swallow!.attack!.damage.map((damage) =>
          Array.from({ length: damage.count }, () => 1)),
        onHitEffectRolls: [{ effectId: 'swallow' }],
      }],
    })
    expect(swallowed.ok, swallowed.ok ? undefined : swallowed.reason).toBe(true)
    if (!swallowed.ok) return
    expect(dnd5eSourceLinkedRelations(swallowed.state, actor.id, grappleSlotGroup))
      .toHaveLength(0)
    const relation = dnd5eSourceLinkedRelations(swallowed.state, actor.id, 'swallow')[0]
    expect(relation?.effect).toMatchObject({
      relation: {
        kind: 'swallowed',
        movement: 'carry-target',
      },
      periodicDamage: {
        timing: 'source-turn-start',
        count: periodicCount,
        sides: periodicSides,
        modifier: 0,
        type: 'acid',
      },
    })
    expect(swallowed.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['restrained', 'blinded']),
    )
  })

  it('tracks damage from inside a Behir and authoritatively regurgitates on a failed save', () => {
    const monster = getDnd5eSrdMonsterBySlug('behir')!
    const constrict = monster.actions.find((action) => action.id === 'constrict')!
    const swallow = monster.actions.find((action) => action.id === 'swallow')!
    const constrictEffect = constrict.attack!.onHitEffects!.find((effect) =>
      effect.kind === 'source-linked-condition')!
    const actor = combatant('behir', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
      armorClass: monster.armorClass.value,
      currentHp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
    })
    const target = combatant('target', 10, {
      sizeRank: 2,
      currentHp: 500,
      maxHp: 500,
    })
    const state = startDnd5eHeadlessCombat('behir-regurgitation', [actor, target])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
    }
    const grappled = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: constrict.id,
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: constrict.attack!.damage.map((damage) =>
          Array.from({ length: damage.count }, () => 1)),
        onHitEffectRolls: [{ effectId: constrictEffect.id }],
      }],
    })
    expect(grappled.ok, grappled.ok ? undefined : grappled.reason).toBe(true)
    if (!grappled.ok) return
    grappled.state.combatants.behir.turn.actionAvailable = true
    const swallowed = resolveDnd5eHeadlessAction(grappled.state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: swallow.id,
      rolls: [{
        targetId: target.id,
        d20: 10,
        d20Second: 10,
        damageRolls: swallow.attack!.damage.map((damage) =>
          Array.from({ length: damage.count }, () => 1)),
        onHitEffectRolls: [{ effectId: 'swallow' }],
      }],
    })
    expect(swallowed.ok, swallowed.ok ? undefined : swallowed.reason).toBe(true)
    if (!swallowed.ok) return
    const targetTurn = resolveDnd5eHeadlessAction(swallowed.state, {
      type: 'end-turn',
      actorId: actor.id,
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    const attacked = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'attack',
      actorId: target.id,
      targetId: actor.id,
      attackModifier: 100,
      d20: 10,
      d20Second: 10,
      damage: {
        count: 5,
        sides: 6,
        bonus: 0,
        rolls: [6, 6, 6, 6, 6],
        type: 'slashing',
      },
    })
    expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
    if (!attacked.ok) return
    expect(dnd5ePendingSwallowRegurgitationRequirements(
      attacked.state,
      target.id,
    )).toEqual([expect.objectContaining({
      sourceId: actor.id,
      triggeringTargetId: target.id,
      damageTaken: 30,
      dc: 14,
    })])

    const missingSave = resolveDnd5eHeadlessAction(attacked.state, {
      type: 'end-turn',
      actorId: target.id,
    })
    expect(missingSave).toMatchObject({ ok: false, reason: 'invalid-dice' })

    const regurgitated = resolveDnd5eHeadlessAction(attacked.state, {
      type: 'end-turn',
      actorId: target.id,
      swallowRegurgitationSavingThrows: [{
        sourceId: actor.id,
        triggeringTargetId: target.id,
        d20: 1,
      }],
    })
    expect(regurgitated.ok, regurgitated.ok ? undefined : regurgitated.reason).toBe(true)
    if (!regurgitated.ok) return
    expect(dnd5eSourceLinkedRelations(regurgitated.state, actor.id, 'swallow'))
      .toHaveLength(0)
    expect(regurgitated.state.combatants.target.conditions).toContain('prone')
    expect(regurgitated.events).toContainEqual(expect.objectContaining({
      type: 'monster-swallow-regurgitation-resolved',
      actorId: actor.id,
      triggeringTargetId: target.id,
      success: false,
      ejectedTargetIds: [target.id],
    }))
  })

  it('settles Succubus Charm with humanoid targeting, replacement, and immunity', () => {
    const monster = getDnd5eSrdMonsterBySlug('succubus-incubus')!
    const actor = combatant('succubus', 30, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const first = combatant('first', 20, { creatureType: 'humanoid' })
    const second = combatant('second', 10, { creatureType: 'humanoid' })
    const beast = combatant('beast', 5, { creatureType: 'beast' })
    const state = startDnd5eHeadlessCombat('succubus-charm', [actor, first, second, beast])
    state.distanceFeetByCombatantPair = Object.fromEntries([first, second, beast].map((target) => [
      dnd5eCombatantPairKey(actor.id, target.id),
      10,
    ]))

    const invalidCreature = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'charm',
      targetId: beast.id,
      d20: 1,
    })
    expect(invalidCreature).toMatchObject({ ok: false, reason: 'invalid-target' })
    expect(invalidCreature.state.combatants.succubus.turn.actionAvailable).toBe(true)

    const firstCharm = resolveDnd5eHeadlessAction(invalidCreature.state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'charm',
      targetId: first.id,
      d20: 1,
    })
    expect(firstCharm.ok, firstCharm.ok ? undefined : firstCharm.reason).toBe(true)
    if (!firstCharm.ok) return
    expect(firstCharm.state.combatants.first.conditions).toContain('charmed')
    expect(firstCharm.state.combatants.first.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'charmed',
        repeatSave: expect.objectContaining({
          timing: 'on-damage',
          onDamage: { mode: 'normal', sourceFilter: 'any' },
        }),
      }),
    )

    firstCharm.state.combatants.succubus.turn.actionAvailable = true
    const replacement = resolveDnd5eHeadlessAction(firstCharm.state, {
      type: 'monster-special-action',
      actorId: actor.id,
      actionId: 'charm',
      targetId: second.id,
      d20: 1,
    })
    expect(replacement.ok, replacement.ok ? undefined : replacement.reason).toBe(true)
    if (!replacement.ok) return
    expect(replacement.state.combatants.first.conditions).not.toContain('charmed')
    expect(replacement.state.combatants.first.classState.monsterActionImmunityRoundsByKey)
      .toEqual({ 'source-action:succubus:charm': 14_400 })
    expect(replacement.state.combatants.second.conditions).toContain('charmed')
  })

  it('keeps separate three-target humanoid and beast pools for Dryad Fey Charm', () => {
    const monster = getDnd5eSrdMonsterBySlug('dryad')!
    const dryad = combatant('dryad', 20, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const targets = [
      combatant('humanoid-1', 15, { creatureType: 'humanoid' }),
      combatant('humanoid-2', 14, { creatureType: 'humanoid' }),
      combatant('humanoid-3', 13, { creatureType: 'humanoid' }),
      combatant('beast-1', 12, { creatureType: 'beast' }),
      combatant('humanoid-4', 11, { creatureType: 'humanoid' }),
      combatant('undead-1', 10, { creatureType: 'undead' }),
    ]
    let state = startDnd5eHeadlessCombat('dryad-fey-charm', [dryad, ...targets])
    state.distanceFeetByCombatantPair = Object.fromEntries(targets.map((target) => [
      dnd5eCombatantPairKey(dryad.id, target.id),
      10,
    ]))
    const invalid = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: dryad.id,
      actionId: 'fey-charm',
      targetId: 'undead-1',
      d20: 1,
    })
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-target' })
    state = invalid.state

    for (const targetId of [
      'humanoid-1',
      'humanoid-2',
      'humanoid-3',
      'beast-1',
      'humanoid-4',
    ]) {
      state.combatants.dryad.turn.actionAvailable = true
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-special-action',
        actorId: dryad.id,
        actionId: 'fey-charm',
        targetId,
        d20: 1,
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      state = result.state
    }

    expect(state.combatants['humanoid-1'].conditions).not.toContain('charmed')
    expect(state.combatants['humanoid-1'].classState.monsterActionImmunityRoundsByKey)
      .toBeDefined()
    for (const targetId of [
      'humanoid-2',
      'humanoid-3',
      'humanoid-4',
      'beast-1',
    ]) {
      expect(state.combatants[targetId].conditions).toContain('charmed')
    }
  })

  it('only offers a Vampire Charm repeat save after harm from the vampire or its allies', () => {
    const monster = getDnd5eSrdMonsterBySlug('vampire-vampire')!
    const vampire = combatant('vampire', 40, {
      controller: 'dm',
      statBlockId: monster.id,
      creatureType: monster.creatureType,
      abilities: monster.abilities,
    })
    const ally = combatant('ally', 30, { controller: 'dm' })
    const outsider = combatant('outsider', 20, { controller: 'player' })
    const target = combatant('target', 10, {
      controller: 'player',
      creatureType: 'humanoid',
    })
    const state = startDnd5eHeadlessCombat('vampire-charm-damage-source', [
      vampire,
      ally,
      outsider,
      target,
    ])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(vampire.id, target.id)]: 10,
    }
    const charmed = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: vampire.id,
      actionId: 'charm',
      targetId: target.id,
      d20: 1,
    })
    expect(charmed.ok, charmed.ok ? undefined : charmed.reason).toBe(true)
    if (!charmed.ok) return
    const charmEffect = charmed.state.combatants.target.classState.activeEffects?.find((effect) =>
      effect.standardCondition === 'charmed' && effect.source.actorId === vampire.id)
    expect(charmEffect?.repeatSave?.onDamage).toEqual({
      mode: 'normal',
      sourceFilter: 'source-or-allies',
    })

    charmed.state.initiativeIndex = charmed.state.initiativeOrder.indexOf(outsider.id)
    const outsiderDamage = resolveDnd5eHeadlessAction(charmed.state, {
      type: 'attack',
      actorId: outsider.id,
      targetId: target.id,
      attackModifier: 20,
      d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
    })
    expect(outsiderDamage.ok, outsiderDamage.ok ? undefined : outsiderDamage.reason).toBe(true)
    if (!outsiderDamage.ok) return
    expect(outsiderDamage.state.combatants.target.classState.activeEffectDamageSavePendingIds)
      .toBeUndefined()

    outsiderDamage.state.initiativeIndex = outsiderDamage.state.initiativeOrder.indexOf(ally.id)
    const allyDamage = resolveDnd5eHeadlessAction(outsiderDamage.state, {
      type: 'attack',
      actorId: ally.id,
      targetId: target.id,
      attackModifier: 20,
      d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
    })
    expect(allyDamage.ok, allyDamage.ok ? undefined : allyDamage.reason).toBe(true)
    if (!allyDamage.ok || !charmEffect) return
    expect(allyDamage.state.combatants.target.classState.activeEffectDamageSavePendingIds)
      .toEqual([charmEffect.id])
    expect(allyDamage.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-required',
      targetId: target.id,
      effectId: charmEffect.id,
      timing: 'takes-damage',
      mode: 'normal',
    }))
  })
})
