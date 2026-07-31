import { afterEach, describe, expect, it } from 'vitest'
import {
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterDraft,
  createDnd5eCustomMonsterMechanicDraft,
} from './customMonsterWorkshop'
import {
  createDnd5eCombatant,
  dnd5eCombatantCanSee,
  dnd5eCombatantPairKey,
  dnd5eMonsterMechanicSavingThrowKindForAction,
  dnd5ePendingMonsterMechanicResolutions,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster, setDnd5eRoomMonsterCatalog } from './monsters'
import { dnd5eReactionsPrevented } from './passiveDefenses'

const abilities = { str: 12, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }

function combatant(
  id: string,
  controller: 'dm' | 'player',
  initiative: number,
  patch: Partial<Dnd5eCombatant> = {},
): Dnd5eCombatant {
  return createDnd5eCombatant({
    id,
    name: id,
    controller,
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 16,
    currentHp: 30,
    maxHp: 30,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('custom monster authoritative trigger snapshots', () => {
  afterEach(() => setDnd5eRoomMonsterCatalog([]))

  it('classifies spell saves separately from physical saves', () => {
    expect(dnd5eMonsterMechanicSavingThrowKindForAction({ type: 'cast-spell' })).toBe('magic')
    expect(dnd5eMonsterMechanicSavingThrowKindForAction({ type: 'monster-core-spell' })).toBe('magic')
    expect(dnd5eMonsterMechanicSavingThrowKindForAction({ type: 'monster-on-hit-save' })).toBe('physical')
  })

  it('selects a hostile mover in range and resolves a reaction attack exactly once', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '守门角魔'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'intercept-charge',
      name: '截击',
      trigger: 'movement',
      triggerSubject: 'hostile-within',
      triggerRadiusFeet: 30,
      movementComparison: 'at-least',
      movementFeet: 20,
      effectKind: 'attack',
      effectTarget: 'selected-subject',
      attackToHit: 6,
      attackEconomy: 'reaction',
      healingDice: '1d6+2',
      damageType: 'piercing',
      hpPercentageAtOrBelow: undefined,
      limit: 'once-per-turn',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const mover = combatant('hero', 'player', 20)
    const guard = combatant('guard', 'dm', 10, { statBlockId: monster.id })
    const state = startDnd5eHeadlessCombat('combat', [mover, guard])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(mover.id, guard.id)]: 10 }

    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'move',
      actorId: mover.id,
      to: { x: 4, y: 0 },
      distance: 20,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const pending = moved.events.find((event) => event.type === 'monster-mechanic-trigger-pending')
    expect(pending).toMatchObject({
      snapshot: {
        mechanicOwnerId: guard.id,
        mechanicId: 'intercept-charge',
        subjectId: mover.id,
        movementDistanceFeet: 20,
      },
    })
    if (!pending || pending.type !== 'monster-mechanic-trigger-pending') return
    expect(dnd5ePendingMonsterMechanicResolutions(moved.state)).toMatchObject([{
      snapshot: { id: pending.snapshot.id },
      attacks: [{
        effectId: 'effect-0',
        targetId: mover.id,
        attackMode: 'melee',
        toHit: 6,
        damage: { count: 1, sides: 6, bonus: 2, type: 'piercing' },
        economy: 'reaction',
      }],
    }])

    const resolved = resolveDnd5eHeadlessAction(moved.state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: guard.id,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: guard.id,
        mechanicId: 'intercept-charge',
        targetId: mover.id,
        attackRolls: [{
          effectId: 'effect-0',
          targetId: mover.id,
          d20: 15,
          damageRolls: [4],
        }],
      },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[mover.id].currentHp).toBe(24)
    expect(resolved.events).toContainEqual({
      type: 'turn-resource-spent',
      actorId: guard.id,
      resource: 'reaction',
    })
    expect(resolved.state.pendingMonsterMechanicTriggers?.[pending.snapshot.id]).toBeUndefined()

    expect(resolveDnd5eHeadlessAction(resolved.state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: guard.id,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: guard.id,
        mechanicId: 'intercept-charge',
        targetId: mover.id,
        attackRolls: [],
      },
    })).toMatchObject({ ok: false })
  })

  it('routes a legacy mechanic melee attack through target AC and Parry after Host pre-rolls damage', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'legacy-intercept',
      name: 'Legacy Intercept',
      trigger: 'movement',
      triggerSubject: 'hostile-within',
      triggerRadiusFeet: 30,
      movementComparison: 'at-least',
      movementFeet: 5,
      effectKind: 'attack',
      effectTarget: 'selected-subject',
      attackMode: 'melee',
      attackToHit: 5,
      attackEconomy: 'none',
      healingDice: '1d6',
      damageType: 'slashing',
      hpPercentageAtOrBelow: undefined,
    }]
    const guardMonster = buildDnd5eCustomMonster(draft)
    const mechanic = guardMonster.headlessMechanics?.[0]
    if (!mechanic || mechanic.schemaVersion !== 2 || mechanic.effects[0]?.kind !== 'attack') {
      throw new Error('Expected a V2 attack mechanic')
    }
    delete (mechanic.effects[0] as { attackMode?: 'melee' | 'ranged' }).attackMode
    setDnd5eRoomMonsterCatalog([guardMonster])

    const nobleMonster = getDnd5eSrdMonster('srd-5.1:noble')
    if (!nobleMonster) throw new Error('Missing SRD noble')
    const noble = combatant('noble', 'player', 20, {
      statBlockId: nobleMonster.id,
      armorClass: nobleMonster.armorClass.value,
      currentHp: nobleMonster.hitPoints.average,
      maxHp: nobleMonster.hitPoints.average,
      position: { x: 5, y: 0 },
    })
    const guard = combatant('guard', 'dm', 10, { statBlockId: guardMonster.id })
    const state = startDnd5eHeadlessCombat('legacy-mechanic-parry', [noble, guard])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(noble.id, guard.id)]: 5,
    }

    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'move',
      actorId: noble.id,
      to: { x: 1, y: 0 },
      distance: 5,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const pending = moved.events.find((event) =>
      event.type === 'monster-mechanic-trigger-pending' &&
      event.snapshot.mechanicId === 'legacy-intercept',
    )
    if (!pending || pending.type !== 'monster-mechanic-trigger-pending') {
      throw new Error('Expected pending legacy mechanic')
    }
    expect(moved.state.combatants[noble.id].turn.reactionAvailable).toBe(true)
    expect(dnd5eReactionsPrevented(moved.state.combatants[noble.id])).toBe(false)
    expect(dnd5eCombatantCanSee(moved.state, noble.id, guard.id)).toBe(true)
    expect(getDnd5eSrdMonster(nobleMonster.id)?.reactions).toContainEqual(
      expect.objectContaining({
        id: 'parry',
        automation: 'headless',
        rule: expect.objectContaining({ kind: 'parry', armorClassBonus: 2 }),
      }),
    )
    expect(getDnd5eSrdMonster(nobleMonster.id)?.actions.some((action) =>
      action.attack != null && action.attack.mode !== 'ranged',
    )).toBe(true)
    expect(dnd5ePendingMonsterMechanicResolutions(moved.state)[0]?.attacks[0])
      .toMatchObject({ attackMode: 'melee' })

    const resolved = resolveDnd5eHeadlessAction(moved.state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: guard.id,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: guard.id,
        mechanicId: 'legacy-intercept',
        targetId: noble.id,
        attackRolls: [{
          effectId: 'effect-0',
          targetId: noble.id,
          d20: noble.armorClass - 5,
          damageRolls: [4],
        }],
      },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'monster-parry-used',
      actorId: noble.id,
      attackerId: guard.id,
    }))
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: guard.id,
      targetId: noble.id,
      armorClass: noble.armorClass + 2,
      hit: false,
    }))
    expect(resolved.state.combatants[noble.id].currentHp).toBe(noble.currentHp)
  })

  it('inherits the authoritative damage type after any dealt damage', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '背水斗士'
    draft.actions[0].damageType = 'slashing'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'desperate-damage',
      name: '不退斗志',
      trigger: 'after-dealt-damage',
      triggerSubject: 'self',
      hpPercentageAtOrBelow: undefined,
      hpBelow: 10,
      effectKind: 'damage',
      effectTarget: 'trigger-target',
      healingDice: '1d6',
      damageType: 'inherit-trigger',
      limit: 'once-per-turn',
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const attacker = combatant('attacker', 'dm', 20, {
      statBlockId: monster.id,
      currentHp: 9,
      maxHp: 20,
    })
    const hero = combatant('hero', 'player', 10)
    const state = startDnd5eHeadlessCombat('combat', [attacker, hero])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(attacker.id, hero.id)]: 5,
    }

    const attacked = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: attacker.id,
      actionId: monster.actions[0].id,
      rolls: [{ targetId: hero.id, d20: 18, damageRolls: [[3]] }],
    })
    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    const pending = attacked.events.find((event) =>
      event.type === 'monster-mechanic-trigger-pending' &&
      event.snapshot.mechanicId === 'desperate-damage',
    )
    expect(pending).toMatchObject({
      snapshot: {
        subjectId: attacker.id,
        triggerTargetId: hero.id,
        triggerDamageType: 'slashing',
      },
    })
    if (!pending || pending.type !== 'monster-mechanic-trigger-pending') return
    const resolved = resolveDnd5eHeadlessAction(attacked.state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: attacker.id,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: attacker.id,
        mechanicId: 'desperate-damage',
        effectRolls: [{ effectId: 'effect-0', rolls: [4] }],
      },
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[hero.id].currentHp).toBe(22)
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied',
      sourceId: attacker.id,
      targetId: hero.id,
      amount: 4,
      damageTypes: ['slashing'],
      suppressAfterDealtDamageTrigger: true,
    }))
    expect(dnd5ePendingMonsterMechanicResolutions(resolved.state)).toEqual([])
  })

  it('stores a nearby ally attack bonus and consumes it on only the next monster attack', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '战团祭司'
    draft.actions[0].toHit = 3
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'pack-encouragement',
      name: '战团鼓舞',
      trigger: 'movement',
      triggerSubject: 'ally-within',
      triggerRadiusFeet: 30,
      movementComparison: 'at-least',
      movementFeet: 5,
      effectKind: 'roll-modifier',
      effectTarget: 'selected-subject',
      modifierRoll: 'attack',
      modifierMode: 'bonus',
      modifierBonus: 2,
      hpPercentageAtOrBelow: undefined,
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const priest = combatant('priest', 'dm', 20, { statBlockId: monster.id })
    const ally = combatant('ally', 'dm', 15, { statBlockId: monster.id })
    const hero = combatant('hero', 'player', 10)
    const state = startDnd5eHeadlessCombat('combat', [priest, ally, hero])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(priest.id, ally.id)]: 10,
      [dnd5eCombatantPairKey(ally.id, hero.id)]: 5,
      [dnd5eCombatantPairKey(priest.id, hero.id)]: 10,
    }

    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: priest.id })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const moved = resolveDnd5eHeadlessAction(ended.state, {
      type: 'move',
      actorId: ally.id,
      to: { x: 1, y: 0 },
      distance: 5,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    const pending = moved.events.find((event) =>
      event.type === 'monster-mechanic-trigger-pending' &&
      event.snapshot.mechanicOwnerId === priest.id,
    )
    expect(pending).toBeDefined()
    if (!pending || pending.type !== 'monster-mechanic-trigger-pending') return
    const buffed = resolveDnd5eHeadlessAction(moved.state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: priest.id,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: priest.id,
        mechanicId: 'pack-encouragement',
        targetId: ally.id,
        effectRolls: [],
      },
    })
    expect(buffed.ok).toBe(true)
    if (!buffed.ok) return
    const actionId = monster.actions[0].id
    const attacked = resolveDnd5eHeadlessAction(buffed.state, {
      type: 'monster-action',
      actorId: ally.id,
      actionId,
      rolls: [{
        targetId: hero.id,
        d20: 11,
        damageRolls: [[3]],
      }],
    })
    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    expect(attacked.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      actorId: ally.id,
      targetId: hero.id,
      total: 16,
      hit: true,
    }))
    expect(attacked.state.combatants[ally.id].classState.monsterMechanicRollModifiers).toBeUndefined()
  })

  it('applies a when-hit saving-throw advantage to exactly one authoritative save', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '坚韧守卫'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'brace-for-magic',
      name: '强韧意志',
      trigger: 'when-hit',
      triggerSubject: 'self',
      effectKind: 'roll-modifier',
      effectTarget: 'self',
      modifierRoll: 'saving-throw',
      modifierMode: 'advantage',
      hpPercentageAtOrBelow: undefined,
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const hero = combatant('hero', 'player', 20)
    const guard = combatant('guard', 'dm', 10, { statBlockId: monster.id })
    const state = startDnd5eHeadlessCombat('combat', [hero, guard])

    const hit = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: hero.id,
      targetId: guard.id,
      attackModifier: 5,
      d20: 15,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    const pending = hit.events.find((event) =>
      event.type === 'monster-mechanic-trigger-pending' &&
      event.snapshot.mechanicId === 'brace-for-magic',
    )
    expect(pending).toBeDefined()
    if (!pending || pending.type !== 'monster-mechanic-trigger-pending') return
    const armed = resolveDnd5eHeadlessAction(hit.state, {
      type: 'resolve-monster-mechanic-trigger',
      actorId: guard.id,
      snapshotId: pending.snapshot.id,
      roll: {
        actorId: guard.id,
        mechanicId: 'brace-for-magic',
        effectRolls: [],
      },
    })
    expect(armed.ok).toBe(true)
    if (!armed.ok) return
    armed.state.combatants[guard.id].classState.monsterOnHitSavePending = {
      sourceId: hero.id,
      actionId: 'test-save',
      ability: 'con',
      dc: 15,
      condition: 'stunned',
    }
    const saved = resolveDnd5eHeadlessAction(armed.state, {
      type: 'monster-on-hit-save',
      actorId: guard.id,
      sourceId: hero.id,
      actionId: 'test-save',
      d20: 4,
      d20Second: 18,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: guard.id,
      d20: 18,
      success: true,
    }))
    expect(saved.state.combatants[guard.id].classState.monsterMechanicRollModifiers).toBeUndefined()
  })

  it('applies a physical-save trigger before the current save is rolled', () => {
    const draft = createDnd5eCustomMonsterDraft()
    draft.name = '即时抗性守卫'
    draft.headlessMechanics = [{
      ...createDnd5eCustomMonsterMechanicDraft(),
      id: 'physical-save-advantage',
      name: '物理抗性',
      trigger: 'saving-throw-physical',
      triggerSubject: 'self',
      effectKind: 'roll-modifier',
      effectTarget: 'self',
      modifierRoll: 'saving-throw',
      modifierMode: 'advantage',
      hpPercentageAtOrBelow: undefined,
    }]
    const monster = buildDnd5eCustomMonster(draft)
    setDnd5eRoomMonsterCatalog([monster])
    const hero = combatant('hero', 'player', 20)
    const guard = combatant('guard', 'dm', 10, {
      statBlockId: monster.id,
      classState: {
        monsterOnHitSavePending: {
          sourceId: hero.id,
          actionId: 'physical-save',
          ability: 'con',
          dc: 15,
          condition: 'stunned',
        },
      },
    })
    const state = startDnd5eHeadlessCombat('combat', [hero, guard])
    const saved = resolveDnd5eHeadlessAction(state, {
      type: 'monster-on-hit-save',
      actorId: guard.id,
      sourceId: hero.id,
      actionId: 'physical-save',
      d20: 4,
      d20Second: 18,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: guard.id,
      d20: 18,
      success: true,
    }))
    expect(saved.events).toContainEqual(expect.objectContaining({
      type: 'monster-mechanic-v2-triggered',
      mechanicId: 'physical-save-advantage',
      trigger: 'saving-throw-physical',
    }))
    expect(saved.events.some((event) => event.type === 'monster-mechanic-trigger-pending')).toBe(false)
  })
})
