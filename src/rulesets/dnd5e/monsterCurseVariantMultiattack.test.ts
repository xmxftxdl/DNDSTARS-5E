import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eSourceLinkedRelations,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eMonsterActionRoll,
  type Dnd5eMonsterOnHitEffectRoll,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterOnHitEffect,
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
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogMonster(slug: string): Dnd5eMonsterStatBlock {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  if (!monster) throw new Error(`Missing SRD monster ${slug}`)
  return monster
}

function catalogAction(
  monster: Dnd5eMonsterStatBlock,
  actionId: string,
): Dnd5eMonsterAction {
  const action = monster.actions.find((candidate) => candidate.id === actionId)
  if (!action) throw new Error(`Missing ${monster.slug}/${actionId}`)
  return action
}

function persistentEffect(action: Dnd5eMonsterAction) {
  const effect = action.attack?.onHitEffects?.find((candidate) =>
    candidate.kind === 'persistent-effect')
  if (!effect) throw new Error(`Missing persistent effect on ${action.id}`)
  return effect
}

function minimumDamageRolls(action: Dnd5eMonsterAction): number[][] {
  if (!action.attack) throw new Error(`${action.id} is not a weapon attack`)
  return action.attack.damage.map((damage) => Array(damage.count).fill(1))
}

function onHitEffectRoll(
  effect: Dnd5eMonsterOnHitEffect,
  saveD20: number,
): Dnd5eMonsterOnHitEffectRoll {
  if (
    effect.kind === 'persistent-effect' &&
    effect.savingThrow
  ) {
    return { effectId: effect.id, d20: saveD20 }
  }
  return { effectId: effect.id }
}

function rollForChild(
  action: Dnd5eMonsterAction,
  targetId: string,
  saveD20: number,
): Dnd5eMonsterActionRoll {
  const effectRolls = (action.attack?.onHitEffects ?? [])
    .map((effect) => onHitEffectRoll(effect, saveD20))
  return {
    targetId,
    d20: 10,
    damageRolls: minimumDamageRolls(action),
    onHitEffectRolls: effectRolls.length > 0 ? effectRolls : undefined,
  }
}

function childActions(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
): Dnd5eMonsterAction[] {
  const actionIds = action.kind === 'multiattack'
    ? action.sequence ?? []
    : [action.id]
  return actionIds.map((actionId) => catalogAction(monster, actionId))
}

function resolveCatalogAction(input: {
  slug: string
  actionId: string
  saveD20?: number
  targetPatch?: Partial<Dnd5eCombatant>
}) {
  const monster = catalogMonster(input.slug)
  const action = catalogAction(monster, input.actionId)
  const actor = combatant(input.slug, 30, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
  })
  const target = combatant('target', 20, {
    creatureType: 'humanoid',
    position: { x: 5, y: 0 },
    savingThrowBonuses: { con: 0, wis: 0 },
    ...input.targetPatch,
  })
  const state = startDnd5eHeadlessCombat(
    `curse-variant:${input.slug}:${input.actionId}`,
    [actor, target],
  )
  state.distanceFeetByCombatantPair = {
    ...state.distanceFeetByCombatantPair,
    [dnd5eCombatantPairKey(actor.id, target.id)]: 5,
  }
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'monster-action',
    actorId: actor.id,
    actionId: action.id,
    rolls: childActions(monster, action).map((child) =>
      rollForChild(child, target.id, input.saveD20 ?? 1)),
  })
  return { action, actor, monster, result, target }
}

function curseEffects(combatantState: Dnd5eCombatant) {
  return (combatantState.classState.activeEffects ?? []).filter((effect) =>
    effect.legacyCondition === 'curse')
}

describe('curse-bearing and grapple-branch Multiattacks', () => {
  it('resolves Lamia Claws + Intoxicating Touch and keeps the one-hour curse modifiers', () => {
    const monster = catalogMonster('lamia')
    const touch = catalogAction(monster, 'intoxicating-touch')
    const effect = persistentEffect(touch)

    expect(touch).toMatchObject({
      kind: 'weapon-attack',
      automation: 'headless',
      attack: {
        mode: 'melee',
        toHit: 5,
        damage: [],
      },
    })
    expect(effect).toMatchObject({
      ailment: 'curse',
      stacking: 'refresh',
      modifiers: {
        abilityCheckDisadvantages: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
        savingThrowDisadvantages: ['wis'],
      },
    })

    const { result, target } = resolveCatalogAction({
      slug: 'lamia',
      actionId: 'multiattack-claws-and-intoxicating-touch',
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return

    const curses = curseEffects(result.state.combatants[target.id])
    expect(curses).toHaveLength(1)
    expect(curses[0]).toMatchObject({
      definitionId: effect.definitionId,
      source: { kind: 'monster', magical: true },
      duration: {
        type: 'rounds',
        remainingRounds: 600,
        tickOn: 'target-turn-end',
      },
      modifiers: {
        abilityCheckDisadvantages: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
        savingThrowDisadvantages: ['wis'],
      },
    })
  })

  it('refreshes Rakshasa Claw curse to one stable permanent marker across both attacks', () => {
    const monster = catalogMonster('rakshasa')
    const claw = catalogAction(monster, 'claw')
    const effect = persistentEffect(claw)
    expect(claw.automation).toBe('headless')
    expect(effect).toMatchObject({
      ailment: 'curse',
      stacking: 'refresh',
    })

    const { result, target } = resolveCatalogAction({
      slug: 'rakshasa',
      actionId: 'multiattack',
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return

    const curses = curseEffects(result.state.combatants[target.id])
      .filter((candidate) => candidate.definitionId === effect.definitionId)
    expect(curses).toHaveLength(1)
    expect(curses[0]).toMatchObject({
      duration: { type: 'permanent' },
      stackingPolicy: 'refresh-duration',
      source: { kind: 'monster', actorId: 'rakshasa', magical: true },
    })
  })

  it.each([
    {
      slug: 'wereboar-hybrid',
      actionId: 'multiattack-maul-and-tusks',
      attackId: 'tusks',
      dc: 12,
      definitionId: 'srd-5.1:monster:wereboar:lycanthropy',
    },
    {
      slug: 'wererat-hybrid',
      actionId: 'multiattack-shortsword-and-bite',
      attackId: 'bite',
      dc: 11,
      definitionId: 'srd-5.1:monster:wererat:lycanthropy',
    },
    {
      slug: 'werewolf-hybrid',
      actionId: 'multiattack',
      attackId: 'bite',
      dc: 12,
      definitionId: 'srd-5.1:monster:werewolf:lycanthropy',
    },
  ])(
    'applies $slug lycanthropy after its Multiattack bite/tusks save fails',
    ({ slug, actionId, attackId, dc, definitionId }) => {
      const monster = catalogMonster(slug)
      const effect = persistentEffect(catalogAction(monster, attackId))
      expect(effect).toMatchObject({
        ailment: 'curse',
        definitionId,
        savingThrow: { ability: 'con', dc },
        targetCreatureTypeRequirements: ['humanoid'],
        stacking: 'refresh',
      })

      const { result, target } = resolveCatalogAction({
        slug,
        actionId,
        saveD20: 1,
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(curseEffects(result.state.combatants[target.id])).toContainEqual(
        expect.objectContaining({
          definitionId,
          duration: { type: 'permanent' },
        }),
      )
    },
  )

  it('does not apply lycanthropy when the Constitution save succeeds', () => {
    const { result, target } = resolveCatalogAction({
      slug: 'werewolf-hybrid',
      actionId: 'multiattack',
      saveD20: 20,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(curseEffects(result.state.combatants[target.id])).toHaveLength(0)
  })

  it.each([
    {
      slug: 'vampire-spawn',
      damageActionId: 'claws',
      escapeDc: 13,
    },
    {
      slug: 'vampire-vampire',
      damageActionId: 'unarmed-strike',
      escapeDc: 18,
    },
  ])(
    'keeps $slug damage and grapple-instead-of-damage as distinct legal siblings',
    ({ slug, damageActionId, escapeDc }) => {
      const monster = catalogMonster(slug)
      const damageAction = catalogAction(monster, damageActionId)
      const grappleAction = monster.actions.find((candidate) =>
        candidate.id !== damageActionId &&
        candidate.attack?.damage.length === 0 &&
        candidate.attack.onHitEffects?.some((effect) =>
          effect.kind === 'source-linked-condition'))
      expect(damageAction).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
      })
      expect(damageAction.attack?.damage.length).toBeGreaterThan(0)
      expect(grappleAction).toBeDefined()
      if (!grappleAction) return

      const grapple = grappleAction.attack?.onHitEffects?.find((effect) =>
        effect.kind === 'source-linked-condition')
      expect(grappleAction).toMatchObject({
        kind: 'weapon-attack',
        automation: 'headless',
        attack: { damage: [] },
      })
      expect(grapple).toMatchObject({
        escapeDc,
        conditions: [{ condition: 'grappled' }],
      })
      if (!grapple || grapple.kind !== 'source-linked-condition') return

      const multiattack = monster.actions.find((candidate) =>
        candidate.kind === 'multiattack' &&
        candidate.automation === 'headless' &&
        candidate.sequence?.includes(grappleAction.id))
      expect(multiattack).toBeDefined()
      if (!multiattack) return

      const { actor, result, target } = resolveCatalogAction({
        slug,
        actionId: multiattack.id,
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(
        dnd5eSourceLinkedRelations(
          result.state,
          actor.id,
          grapple.relation.slotGroup,
        ).map((link) => link.target.id),
      ).toContain(target.id)
    },
  )
})
