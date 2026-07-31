import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import {
  dnd5eMonsterActionAutomation,
  validateDnd5eMonsterCatalog,
} from './monsterSchema'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterStatBlock,
} from './monsters'

const abilities = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 10,
  cha: 10,
} as const

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
    armorClass: 1,
    currentHp: 200,
    maxHp: 200,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function monster(slug: string): Dnd5eMonsterStatBlock {
  const result = getDnd5eSrdMonsterBySlug(slug)
  if (!result) throw new Error(`Missing SRD monster ${slug}`)
  return result
}

function action(
  statBlock: Dnd5eMonsterStatBlock,
  actionId: string,
): Dnd5eMonsterAction {
  const result = statBlock.actions.find((candidate) =>
    candidate.id === actionId)
  if (!result) throw new Error(`Missing ${statBlock.slug}/${actionId}`)
  return result
}

function encounter(slug: string) {
  const statBlock = monster(slug)
  const source = combatant(slug, 20, {
    controller: 'dm',
    statBlockId: statBlock.id,
    creatureType: statBlock.creatureType,
    abilities: statBlock.abilities,
    armorClass: statBlock.armorClass.value,
    currentHp: statBlock.hitPoints.average,
    maxHp: statBlock.hitPoints.average,
  })
  const target = combatant('target', 10, {
    creatureType: 'humanoid',
    position: { x: 5, y: 0 },
    savingThrowBonuses: { con: 0, wis: 0 },
  })
  const state = startDnd5eHeadlessCombat(
    `mummy-rot:${slug}`,
    [source, target],
  )
  state.distanceFeetByCombatantPair = {
    [dnd5eCombatantPairKey(source.id, target.id)]: 5,
  }
  return { source, state, statBlock, target }
}

function rottingFistRoll(
  statBlock: Dnd5eMonsterStatBlock,
  saveD20 = 1,
) {
  const fist = action(statBlock, 'rotting-fist')
  if (!fist.attack) throw new Error('Rotting Fist is not an attack')
  const effect = fist.attack.onHitEffects?.find((candidate) =>
    candidate.kind === 'persistent-effect')
  if (!effect) throw new Error('Rotting Fist is missing Mummy Rot')
  return {
    targetId: 'target',
    d20: 10,
    damageRolls: fist.attack.damage.map((damage) =>
      Array(damage.count).fill(1)),
    onHitEffectRolls: [{ effectId: effect.id, d20: saveD20 }],
  }
}

const cases = [
  {
    slug: 'mummy',
    toHit: 5,
    damage: [
      { average: 10, count: 2, sides: 6, bonus: 3, type: 'bludgeoning' },
      { average: 10, count: 3, sides: 6, bonus: 0, type: 'necrotic' },
    ],
    dc: 12,
    minimumDamage: 8,
  },
  {
    slug: 'mummy-lord',
    toHit: 9,
    damage: [
      { average: 14, count: 3, sides: 6, bonus: 4, type: 'bludgeoning' },
      { average: 21, count: 6, sides: 6, bonus: 0, type: 'necrotic' },
    ],
    dc: 16,
    minimumDamage: 13,
  },
] as const

describe('Mummy Rotting Fist Multiattacks', () => {
  it.each(cases)(
    'declares $slug Rotting Fist and its campaign-only maximum-HP reduction',
    ({ slug, toHit, damage, dc }) => {
      const statBlock = monster(slug)
      const fist = action(statBlock, 'rotting-fist')
      const effect = fist.attack?.onHitEffects?.find((candidate) =>
        candidate.kind === 'persistent-effect')

      expect(fist).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: { mode: 'melee', toHit, reachFeet: 5, damage },
      })
      expect(effect).toMatchObject({
        kind: 'persistent-effect',
        magical: true,
        savingThrow: { ability: 'con', dc, magical: true },
        ailment: 'curse',
        modifiers: { preventHealing: true },
        campaignPeriodicHitPointMaximumReduction: {
          intervalHours: 24,
          reduction: {
            average: 10,
            count: 3,
            sides: 6,
            bonus: 0,
          },
          execution: 'campaign-time-only',
          recovery: 'when-effect-removed',
        },
      })
      expect(effect).not.toHaveProperty('periodicDamage')
      expect(dnd5eMonsterActionAutomation(
        action(statBlock, 'multiattack'),
      )).toBe('headless')
      expect(dnd5eMonsterActionAutomation(
        action(statBlock, 'multiattack-rotting-fist-only'),
      )).toBe('headless')
      expect(validateDnd5eMonsterCatalog([statBlock])).toEqual([])
    },
  )

  it.each(cases)(
    'executes $slug Rotting Fist-only without turning 24 hours into a combat tick',
    ({ slug, minimumDamage }) => {
      const { source, state, statBlock, target } = encounter(slug)
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-action',
        actorId: source.id,
        actionId: 'multiattack-rotting-fist-only',
        rolls: [rottingFistRoll(statBlock)],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return

      const afflicted = result.state.combatants[target.id]
      const mummyRot = afflicted.classState.activeEffects?.find((effect) =>
        effect.definitionId === 'srd-5.1:monster:mummy:mummy-rot')
      expect(afflicted.currentHp).toBe(200 - minimumDamage)
      expect(afflicted.maxHp).toBe(200)
      expect(mummyRot).toMatchObject({
        legacyCondition: 'curse',
        duration: { type: 'permanent' },
        source: { kind: 'monster', actorId: slug, magical: true },
        modifiers: { preventHealing: true },
      })
      expect(mummyRot?.periodicDamage).toBeUndefined()

      const sourceEnd = resolveDnd5eHeadlessAction(result.state, {
        type: 'end-turn',
        actorId: source.id,
      })
      expect(sourceEnd.ok, sourceEnd.ok ? undefined : sourceEnd.reason).toBe(true)
      if (!sourceEnd.ok) return
      const hpAfterAttack = sourceEnd.state.combatants[target.id].currentHp
      const targetEnd = resolveDnd5eHeadlessAction(sourceEnd.state, {
        type: 'end-turn',
        actorId: target.id,
      })
      expect(targetEnd.ok, targetEnd.ok ? undefined : targetEnd.reason).toBe(true)
      if (!targetEnd.ok) return
      expect(targetEnd.state.combatants[target.id]).toMatchObject({
        currentHp: hpAfterAttack,
        maxHp: 200,
      })
    },
  )

  it.each(cases)(
    'executes $slug Dreadful Glare plus Rotting Fist as one composite action',
    ({ slug }) => {
      const { source, state, statBlock, target } = encounter(slug)
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-multiattack-composite',
        schemaVersion: 1,
        actorId: source.id,
        actionId: 'multiattack',
        steps: [
          {
            kind: 'special',
            actionId: 'dreadful-glare',
            targetId: target.id,
            d20: 20,
          },
          {
            kind: 'weapon',
            actionId: 'rotting-fist',
            roll: rottingFistRoll(statBlock),
          },
        ],
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.events).toContainEqual({
        type: 'monster-multiattack-composite-resolved',
        actorId: source.id,
        actionId: 'multiattack',
        resolvedActionIds: ['dreadful-glare', 'rotting-fist'],
        skippedActionIds: [],
      })
      expect(result.events.filter((event) =>
        event.type === 'turn-resource-spent' &&
        event.actorId === source.id &&
        event.resource === 'action')).toHaveLength(1)
      expect(result.state.combatants[target.id].classState.activeEffects)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({
            definitionId: 'srd-5.1:monster:mummy:mummy-rot',
          }),
        ]))
    },
  )

  it('strictly rejects malformed campaign-period metadata', () => {
    const statBlock = structuredClone(monster('mummy'))
    const fist = action(statBlock, 'rotting-fist')
    const effect = fist.attack?.onHitEffects?.find((candidate) =>
      candidate.kind === 'persistent-effect')
    if (!effect?.campaignPeriodicHitPointMaximumReduction) {
      throw new Error('Missing campaign periodic declaration')
    }
    effect.campaignPeriodicHitPointMaximumReduction.intervalHours = 0
    expect(validateDnd5eMonsterCatalog([statBlock])).toContainEqual(
      expect.objectContaining({
        monsterId: statBlock.id,
        actionId: fist.id,
        code: 'invalid-stat-block',
      }),
    )
  })
})
