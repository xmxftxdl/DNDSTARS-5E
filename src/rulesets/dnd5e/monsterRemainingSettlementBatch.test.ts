import { describe, expect, it } from 'vitest'
import { createDnd5eConditionEffect } from './activeEffects'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eHeadlessCombatState,
  type Dnd5eMonsterActionRoll,
} from './headlessCombatEngine'
import {
  getDnd5eSrdMonsterBySlug,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterOnHitEffect,
} from './monsters'

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
    armorClass: 1,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: id === 'target' ? 5 : 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

function catalogAction(slug: string, actionId: string): Dnd5eMonsterAction {
  const action = getDnd5eSrdMonsterBySlug(slug)?.actions.find((candidate) =>
    candidate.id === actionId)
  if (!action) throw new Error(`Missing ${slug}/${actionId}`)
  return action
}

function catalogActor(slug: string, patch: Partial<Dnd5eCombatant> = {}): Dnd5eCombatant {
  const monster = getDnd5eSrdMonsterBySlug(slug)
  if (!monster) throw new Error(`Missing ${slug}`)
  return combatant(slug, 20, {
    controller: 'dm',
    statBlockId: monster.id,
    creatureType: monster.creatureType,
    abilities: monster.abilities,
    armorClass: monster.armorClass.value,
    currentHp: monster.hitPoints.average,
    maxHp: monster.hitPoints.average,
    ...patch,
  })
}

function effectOfKind<Kind extends Dnd5eMonsterOnHitEffect['kind']>(
  action: Dnd5eMonsterAction,
  kind: Kind,
): Extract<Dnd5eMonsterOnHitEffect, { kind: Kind }> {
  const effect = action.attack?.onHitEffects?.find((candidate) => candidate.kind === kind)
  if (!effect || effect.kind !== kind) throw new Error(`Missing ${kind} on ${action.id}`)
  return effect as Extract<Dnd5eMonsterOnHitEffect, { kind: Kind }>
}

function minimumDamageRolls(action: Dnd5eMonsterAction): number[][] {
  return (action.attack?.damage ?? []).map((damage) => Array(damage.count).fill(1))
}

function attackState(input: {
  slug: string
  actionId: string
  actorPatch?: Partial<Dnd5eCombatant>
  targetPatch?: Partial<Dnd5eCombatant>
  rollPatch?: Partial<Dnd5eMonsterActionRoll>
}): { state: Dnd5eHeadlessCombatState; result: ReturnType<typeof resolveDnd5eHeadlessAction> } {
  const action = catalogAction(input.slug, input.actionId)
  const actor = catalogActor(input.slug, input.actorPatch)
  const target = combatant('target', 10, input.targetPatch)
  const state = startDnd5eHeadlessCombat(`remaining:${input.slug}`, [actor, target])
  const result = resolveDnd5eHeadlessAction(state, {
    type: 'monster-action',
    actorId: actor.id,
    actionId: input.actionId,
    rolls: [{
      targetId: target.id,
      d20: 10,
      damageRolls: minimumDamageRolls(action),
      ...input.rollPatch,
    }],
  })
  return { state, result }
}

describe('remaining structured monster weapon attacks', () => {
  it.each([
    ['azer', 'warhammer'],
    ['black-pudding', 'pseudopod'],
    ['darkmantle', 'crush'],
    ['dryad', 'club'],
    ['duergar', 'war-pick'],
    ['duergar', 'javelin'],
    ['giant-rat-diseased', 'bite'],
    ['gray-ooze', 'pseudopod'],
    ['magmin', 'touch'],
    ['mimic', 'pseudopod'],
    ['shadow', 'strength-drain'],
    ['solar', 'slaying-longbow'],
    ['stirge', 'blood-drain'],
    ['swarm-of-centipedes', 'bites'],
    ['vampire-bat', 'bite'],
  ] as const)('marks %s/%s Headless', (slug, actionId) => {
    expect(catalogAction(slug, actionId).automation).toBe('headless')
  })

  it.each([
    ['azer', 'warhammer-two-handed', 'headless'],
    ['dryad', 'club-shillelagh', 'headless'],
    ['duergar', 'war-pick-enlarged', 'headless'],
    ['duergar', 'javelin-enlarged', 'headless'],
    ['mimic', 'pseudopod-adhesive-object-form', 'headless'],
  ] as const)('exposes %s/%s as a stable legal branch', (slug, actionId, automation) => {
    expect(catalogAction(slug, actionId)).toMatchObject({
      kind: 'weapon-attack',
      automation,
    })
  })

  it('corrodes one concrete nonmagical armor instance', () => {
    const action = catalogAction('black-pudding', 'pseudopod')
    const effect = effectOfKind(action, 'equipment-corrosion')
    const { result } = attackState({
      slug: 'black-pudding',
      actionId: 'pseudopod',
      targetPatch: {
        armorClass: 15,
        wearingArmor: true,
        equippedArmor: {
          instanceId: 'armor:chain',
          equipmentId: 'chain-mail',
          magical: false,
          metal: true,
          baseProvidedArmorClass: 16,
          armorClassPenalty: 0,
          unarmoredArmorClass: 10,
          destroyed: false,
        },
      },
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.equippedArmor).toMatchObject({
      instanceId: 'armor:chain',
      armorClassPenalty: 1,
      destroyed: false,
    })
    expect(result.state.combatants.target.armorClass).toBe(14)
  })

  it('applies Darkmantle head wrapping only on an advantaged hit', () => {
    const action = catalogAction('darkmantle', 'crush')
    const effect = effectOfKind(action, 'source-linked-condition')
    const prone = createDnd5eConditionEffect({
      condition: 'prone',
      targetId: 'target',
      source: { kind: 'system', rulesId: 'test:prone' },
    })
    const { result } = attackState({
      slug: 'darkmantle',
      actionId: 'crush',
      targetPatch: { sizeRank: 2, conditions: ['prone'], classState: { activeEffects: [prone] } },
      rollPatch: {
        mode: 'advantage',
        d20Second: 9,
        onHitEffectRolls: [{ effectId: effect.id }],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.conditions).toContain('blinded')
    expect(result.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({ legacyCondition: 'unable-to-breathe' }),
    )
  })

  it('persists the diseased rat bite after a failed save and blocks ordinary healing', () => {
    const action = catalogAction('giant-rat-diseased', 'bite')
    const effect = effectOfKind(action, 'persistent-effect')
    const { result } = attackState({
      slug: 'giant-rat-diseased',
      actionId: 'bite',
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id, d20: 1 }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: effect.definitionId,
        modifiers: expect.objectContaining({ preventNonmagicalHealing: true }),
        removal: expect.objectContaining({ onMagicalHealing: true }),
      }),
    )
  })

  it('uses the explicit Mimic adhesive branch to create an authoritative grapple', () => {
    const action = catalogAction('mimic', 'pseudopod-adhesive-object-form')
    const effect = effectOfKind(action, 'source-linked-condition')
    const { result } = attackState({
      slug: 'mimic',
      actionId: action.id,
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.conditions).toContain('grappled')
    expect(result.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({
        standardCondition: 'grappled',
        relation: expect.objectContaining({ kind: 'grapple', slotGroup: 'adhesive' }),
      }),
    )
  })

  it('ticks Magmin ignition at the affected target turn end', () => {
    const action = catalogAction('magmin', 'touch')
    const effect = effectOfKind(action, 'persistent-effect')
    const attacked = attackState({
      slug: 'magmin',
      actionId: 'touch',
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id }] },
    }).result
    expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
    if (!attacked.ok) return
    const targetHp = attacked.state.combatants.target.currentHp
    const afterMagmin = resolveDnd5eHeadlessAction(attacked.state, {
      type: 'end-turn', actorId: 'magmin',
    })
    expect(afterMagmin.ok, afterMagmin.ok ? undefined : afterMagmin.reason).toBe(true)
    if (!afterMagmin.ok) return
    const persisted = afterMagmin.state.combatants.target.classState.activeEffects
      ?.find((candidate) => candidate.definitionId === effect.definitionId)
    expect(persisted).toBeDefined()
    const afterTarget = resolveDnd5eHeadlessAction(afterMagmin.state, {
      type: 'end-turn',
      actorId: 'target',
      activeEffectPeriodicDamageRolls: [{
        effectId: persisted!.id,
        targetId: 'target',
        rolls: [6],
      }],
    })
    expect(afterTarget.ok, afterTarget.ok ? undefined : afterTarget.reason).toBe(true)
    if (!afterTarget.ok) return
    expect(afterTarget.state.combatants.target.currentHp).toBe(targetHp - 6)
  })

  it('kills a creature whose Strength Drain reaches zero', () => {
    const action = catalogAction('shadow', 'strength-drain')
    const effect = effectOfKind(action, 'ability-score-reduction')
    const { result } = attackState({
      slug: 'shadow',
      actionId: 'strength-drain',
      targetPatch: { abilities: { ...abilities, str: 4 } },
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id, damageRolls: [[4]] }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.abilities.str).toBe(0)
    expect(result.state.combatants.target.deathSaves.dead).toBe(true)
  })

  it('resolves Solar slaying after damage and honors the failed save', () => {
    const action = catalogAction('solar', 'slaying-longbow')
    const effect = effectOfKind(action, 'saving-throw-instant-death')
    const { result } = attackState({
      slug: 'solar',
      actionId: 'slaying-longbow',
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id, d20: 1 }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.deathSaves.dead).toBe(true)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'instant-death' }))
  })

  it('ticks an attached Stirge at its turn start and prevents another Blood Drain', () => {
    const action = catalogAction('stirge', 'blood-drain')
    const effect = effectOfKind(action, 'source-linked-condition')
    const attacked = attackState({
      slug: 'stirge',
      actionId: 'blood-drain',
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id }] },
    }).result
    expect(attacked.ok, attacked.ok ? undefined : attacked.reason).toBe(true)
    if (!attacked.ok) return
    const attachment = attacked.state.combatants.target.classState.activeEffects?.find(
      (candidate) => candidate.relation?.slotGroup === 'blood-drain',
    )
    expect(attachment).toBeDefined()
    const hpAfterAttack = attacked.state.combatants.target.currentHp
    const targetTurn = resolveDnd5eHeadlessAction(attacked.state, {
      type: 'end-turn',
      actorId: 'stirge',
    })
    expect(targetTurn.ok, targetTurn.ok ? undefined : targetTurn.reason).toBe(true)
    if (!targetTurn.ok) return
    const stirgeTurn = resolveDnd5eHeadlessAction(targetTurn.state, {
      type: 'end-turn',
      actorId: 'target',
      turnStartActiveEffectPeriodicDamageRolls: [{
        effectId: attachment!.id,
        targetId: 'target',
        rolls: [1],
      }],
    })
    expect(stirgeTurn.ok, stirgeTurn.ok ? undefined : stirgeTurn.reason).toBe(true)
    if (!stirgeTurn.ok) return
    expect(stirgeTurn.state.combatants.target.currentHp).toBe(hpAfterAttack - 4)
    const blocked = resolveDnd5eHeadlessAction(stirgeTurn.state, {
      type: 'monster-action',
      actorId: 'stirge',
      actionId: 'blood-drain',
      rolls: [{
        targetId: 'target',
        d20: 10,
        damageRolls: minimumDamageRolls(action),
        onHitEffectRolls: [{ effectId: effect.id }],
      }],
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.reason).toBe('invalid-target')
  })

  it('reduces maximum hit points and heals the Vampire Bat from necrotic bite damage', () => {
    const action = catalogAction('vampire-bat', 'bite')
    const effect = effectOfKind(action, 'hit-point-maximum-reduction')
    const restrained = createDnd5eConditionEffect({
      condition: 'restrained',
      targetId: 'target',
      source: { kind: 'system', rulesId: 'test:restrained' },
    })
    const { result } = attackState({
      slug: 'vampire-bat',
      actionId: 'bite',
      actorPatch: { currentHp: 20, maxHp: 100 },
      targetPatch: {
        maxHp: 100,
        currentHp: 100,
        conditions: ['restrained'],
        classState: { activeEffects: [restrained] },
      },
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.maxHp).toBe(97)
    expect(result.state.combatants['vampire-bat'].currentHp).toBe(23)
  })

  it('stabilizes and incapacitates a target reduced to zero by centipedes', () => {
    const action = catalogAction('swarm-of-centipedes', 'bites')
    const effect = effectOfKind(action, 'zero-hit-point-outcome')
    const { result } = attackState({
      slug: 'swarm-of-centipedes',
      actionId: 'bites',
      targetPatch: { currentHp: 4, maxHp: 4 },
      rollPatch: { onHitEffectRolls: [{ effectId: effect.id }] },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.deathSaves.stable).toBe(true)
    expect(result.state.combatants.target.conditions).toEqual(
      expect.arrayContaining(['poisoned', 'paralyzed']),
    )
  })
})
