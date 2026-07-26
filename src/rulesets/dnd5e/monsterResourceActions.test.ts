import { afterEach, describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster, setDnd5eRoomMonsterCatalog } from './monsters'
import { createDnd5eConditionEffect } from './activeEffects'
import { dnd5eMonsterActionAutomation } from './monsterSchema'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function combatant(id: string, initiative: number, patch: Record<string, unknown> = {}) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: 'dm',
    initiative,
    abilities,
    proficiencyBonus: 2,
    armorClass: 12,
    currentHp: 100,
    maxHp: 100,
    temporaryHp: 0,
    speed: 30,
    position: { x: 0, y: 0 },
    concentrating: false,
    ...patch,
  })
}

describe('D&D 5e monster resource actions', () => {
  afterEach(() => setDnd5eRoomMonsterCatalog([]))

  it('spends legendary action points for an off-turn structured attack', () => {
    const hero = combatant('hero', 20, { controller: 'player', position: { x: 5, y: 0 } })
    const dragon = combatant('dragon', 10, {
      statBlockId: 'srd-5.1:adult-black-dragon',
      classState: { monsterLegendaryActionPoints: 3 },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('legendary', [hero, dragon]), {
      type: 'monster-legendary-action',
      actorId: 'dragon',
      actionId: 'tail-attack',
      rolls: [{ targetId: 'hero', d20: 15, damageRolls: [[5, 6]] }],
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.dragon.classState.monsterLegendaryActionPoints).toBe(2)
    expect(result.events).toContainEqual({
      type: 'monster-legendary-action-used', actorId: 'dragon', actionId: 'tail-attack', cost: 1, remaining: 2,
    })
  })

  it('declares every SRD 5.1 aboleth action as Headless and keeps Tail Swipe linked to Tail', () => {
    const aboleth = getDnd5eSrdMonster('srd-5.1:aboleth')!
    expect([
      ...aboleth.actions,
      ...(aboleth.legendaryActions ?? []),
    ].map((action) => [action.id, dnd5eMonsterActionAutomation(action)])).toEqual([
      ['multiattack', 'headless'],
      ['tentacle', 'headless'],
      ['tail', 'headless'],
      ['enslave', 'headless'],
      ['detect', 'headless'],
      ['tail-swipe', 'headless'],
      ['psychic-drain-costs-2-actions', 'headless'],
    ])
    expect(aboleth.legendaryActionPoints).toBe(3)
    expect(aboleth.legendaryActions?.find((action) => action.id === 'tail-swipe'))
      .toMatchObject({ referencedActionId: 'tail', legendaryCost: 1 })
    expect(aboleth.actions.find((action) => action.id === 'enslave'))
      .toMatchObject({ usage: { kind: 'per-day', max: 3 } })
  })

  it('resolves aboleth Enslave with its source-bound damage repeat save and reaction lock', () => {
    const hero = combatant('hero', 10, {
      controller: 'player',
      position: { x: 30, y: 0 },
      turn: { actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true, movementRemaining: 30 },
    })
    const aboleth = combatant('aboleth', 20, {
      statBlockId: 'srd-5.1:aboleth',
      position: { x: 0, y: 0 },
      classState: {
        monsterActionUsesByActionId: { enslave: { current: 3, max: 3 } },
        monsterLegendaryActionPoints: 3,
      },
    })
    const state = startDnd5eHeadlessCombat('aboleth-enslave', [aboleth, hero])
    state.distanceFeetByCombatantPair = { ['aboleth\u0000hero']: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-special-action',
      actorId: 'aboleth',
      actionId: 'enslave',
      targetId: 'hero',
      d20: 1,
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.hero.conditions).toContain('charmed')
    expect(result.state.combatants.hero.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({
        standardCondition: 'charmed',
        source: expect.objectContaining({ actorId: 'aboleth' }),
        repeatSave: expect.objectContaining({
          ability: 'wis',
          dc: 14,
          timing: 'on-damage',
          onDamage: { mode: 'normal' },
        }),
      }),
      expect.objectContaining({
        modifiers: expect.objectContaining({ preventReactions: true }),
      }),
    ]))
    expect(result.state.combatants.hero.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.aboleth.classState.monsterActionUsesByActionId?.enslave.current).toBe(2)

    result.state.initiativeIndex = 1
    const drained = resolveDnd5eHeadlessAction(result.state, {
      type: 'monster-legendary-special-action',
      actorId: 'aboleth',
      actionId: 'psychic-drain-costs-2-actions',
      targetId: 'hero',
      damageRolls: [2, 2, 2],
    })
    expect(drained.ok, drained.ok ? undefined : drained.reason).toBe(true)
    const pendingId = drained.state.combatants.hero.classState.activeEffectDamageSavePendingIds?.[0]
    expect(pendingId).toBeTruthy()
    const escaped = resolveDnd5eHeadlessAction(drained.state, {
      type: 'active-effect-damage-save',
      actorId: 'hero',
      effectId: pendingId!,
      d20: 20,
    })
    expect(escaped.ok, escaped.ok ? undefined : escaped.reason).toBe(true)
    expect(escaped.state.combatants.hero.conditions).not.toContain('charmed')
    expect(escaped.state.combatants.hero.classState.activeEffects?.some((effect) =>
      effect.source.rulesId === 'monster:srd-5.1:aboleth:enslave') ?? false).toBe(false)
  })

  it('resolves all three aboleth legendary options through Headless', () => {
    const hero = combatant('hero', 20, {
      controller: 'player',
      currentHp: 100,
      maxHp: 100,
      position: { x: 5, y: 0 },
      classState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'charmed',
          targetId: 'hero',
          source: {
            kind: 'monster',
            actorId: 'aboleth',
            rulesId: 'monster:srd-5.1:aboleth:enslave',
          },
        })],
      },
    })
    const aboleth = combatant('aboleth', 10, {
      statBlockId: 'srd-5.1:aboleth',
      currentHp: 100,
      maxHp: 135,
      position: { x: 0, y: 0 },
      classState: { monsterLegendaryActionPoints: 3 },
    })
    const detectState = startDnd5eHeadlessCombat('aboleth-detect', [hero, aboleth])
    const detect = resolveDnd5eHeadlessAction(detectState, {
      type: 'monster-legendary-special-action',
      actorId: 'aboleth',
      actionId: 'detect',
      d20: 12,
    })
    expect(detect.ok, detect.ok ? undefined : detect.reason).toBe(true)
    expect(detect.events).toContainEqual(expect.objectContaining({
      type: 'monster-legendary-detect-resolved',
      total: 22,
    }))

    const tailState = startDnd5eHeadlessCombat('aboleth-tail-swipe', [hero, aboleth])
    tailState.distanceFeetByCombatantPair = { ['aboleth\u0000hero']: 10 }
    const tail = resolveDnd5eHeadlessAction(tailState, {
      type: 'monster-legendary-action',
      actorId: 'aboleth',
      actionId: 'tail-swipe',
      rolls: [{ targetId: 'hero', d20: 15, damageRolls: [[3, 4, 5]] }],
    })
    expect(tail.ok, tail.ok ? undefined : tail.reason).toBe(true)
    expect(tail.state.combatants.hero.currentHp).toBe(83)

    const drainState = startDnd5eHeadlessCombat('aboleth-psychic-drain', [hero, aboleth])
    const drain = resolveDnd5eHeadlessAction(drainState, {
      type: 'monster-legendary-special-action',
      actorId: 'aboleth',
      actionId: 'psychic-drain-costs-2-actions',
      targetId: 'hero',
      damageRolls: [3, 3, 4],
    })
    expect(drain.ok, drain.ok ? undefined : drain.reason).toBe(true)
    expect(drain.state.combatants.hero.currentHp).toBe(90)
    expect(drain.state.combatants.aboleth.currentHp).toBe(110)
    expect(drain.state.combatants.aboleth.classState.monsterLegendaryActionPoints).toBe(1)
    expect(drain.events).toContainEqual(expect.objectContaining({
      type: 'monster-special-action-resolved',
      actionId: 'psychic-drain-costs-2-actions',
      damage: 10,
      healing: 10,
    }))
  })

  it('tracks spell slots and innate per-day uses independently', () => {
    const target = combatant('target', 10, { controller: 'player' })
    const mage = combatant('mage', 20, {
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 3: { current: 2, max: 3 } } },
    })
    const spell = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('monster-spell', [mage, target]), {
      type: 'monster-spell', actorId: 'mage', spellId: 'fireball', slotLevel: 3,
      effects: [{ targetId: 'target', operation: 'damage', amount: 12, damageType: 'fire' }],
    })
    expect(spell.ok).toBe(true)
    expect(spell.state.combatants.mage.classState.monsterSpellSlots?.['3'].current).toBe(1)
    expect(spell.state.combatants.target.currentHp).toBe(88)

    const giant = combatant('giant', 20, {
      statBlockId: 'srd-5.1:cloud-giant',
      classState: { monsterSpellUsesBySpellId: { fly: { current: 3, max: 3 } } },
    })
    const innate = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('innate-spell', [giant, target]), {
      type: 'monster-spell', actorId: 'giant', spellId: 'fly', slotLevel: 3, effects: [],
    })
    expect(innate.ok).toBe(true)
    expect(innate.state.combatants.giant.classState.monsterSpellUsesBySpellId?.fly.current).toBe(2)
  })

  it('rejects a legacy monster spell result whose operation contradicts the SRD spell', () => {
    const mage = combatant('mage', 20, {
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 1: { current: 1, max: 1 } } },
    })
    const swarm = combatant('swarm', 10, {
      statBlockId: 'srd-5.1:swarm-of-rats', currentHp: 10, maxHp: 24,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('swarm-resources', [mage, swarm]), {
      type: 'monster-spell', actorId: 'mage', spellId: 'magic-missile', slotLevel: 1,
      effects: [
        { targetId: 'swarm', operation: 'healing', amount: 10 },
        { targetId: 'swarm', operation: 'temporary-hit-points', amount: 10 },
      ],
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })

  it('resolves a monster spell attack from SRD dice and the stat block attack bonus', () => {
    const target = combatant('target', 10, { controller: 'player', currentHp: 30, maxHp: 30 })
    const mage = combatant('mage', 20, { statBlockId: 'srd-5.1:mage' })
    const state = startDnd5eHeadlessCombat('monster-core-spell', [mage, target])
    state.distanceFeetByCombatantPair = { ['mage\u0000target']: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-core-spell',
      actorId: 'mage',
      spellId: 'fire-bolt',
      slotLevel: 0,
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        d20: 15,
        effectRolls: [[5, 6]],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(19)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-core-spell-resolved',
      actorId: 'mage',
      spellId: 'fire-bolt',
    }))
  })

  it('resolves monster Magic Missile projectiles and lets Shield negate every projectile on its target', () => {
    const shielded = combatant('shielded', 15, {
      controller: 'player',
      currentHp: 30,
      maxHp: 30,
      classId: 'wizard',
      classLevels: { wizard: 1 },
      level: 1,
      classSelections: { 'spell-prepared': ['shield'] },
      classSelectionsByClass: { wizard: { 'spell-prepared': ['shield'] } },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const unshielded = combatant('unshielded', 10, {
      controller: 'player',
      currentHp: 30,
      maxHp: 30,
    })
    const mage = combatant('mage', 20, {
      statBlockId: 'srd-5.1:mage',
      classState: { monsterSpellSlots: { 1: { current: 1, max: 1 } } },
    })
    const state = startDnd5eHeadlessCombat('monster-magic-missile', [mage, shielded, unshielded])
    state.distanceFeetByCombatantPair = {
      ['mage\u0000shielded']: 30,
      ['mage\u0000unshielded']: 30,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-core-spell',
      actorId: 'mage',
      spellId: 'magic-missile',
      slotLevel: 1,
      resolution: {
        schemaVersion: 1,
        targetIds: ['shielded', 'unshielded'],
        projectileTargetIds: ['shielded', 'shielded', 'unshielded'],
        shieldSpellReactionTargetIds: ['shielded'],
        effectRolls: [[4], [3], [2]],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.shielded.currentHp).toBe(30)
    expect(result.state.combatants.unshielded.currentHp).toBe(27)
    expect(result.state.combatants.mage.classState.monsterSpellSlots?.['1'].current).toBe(0)
    expect(result.state.combatants.shielded.classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(result.state.combatants.shielded.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed',
      actorId: 'shielded',
      stateKey: 'shield-spell',
      active: true,
    }))

    const invalidState = startDnd5eHeadlessCombat(
      'monster-magic-missile-invalid-target',
      [mage, shielded, unshielded],
    )
    invalidState.distanceFeetByCombatantPair = {
      ['mage\u0000shielded']: 30,
      ['mage\u0000unshielded']: 30,
    }
    const spoofedTarget = resolveDnd5eHeadlessAction(invalidState, {
        type: 'monster-core-spell',
        actorId: 'mage',
        spellId: 'magic-missile',
        slotLevel: 1,
        resolution: {
          schemaVersion: 1,
          targetIds: ['shielded'],
          projectileTargetIds: ['shielded', 'shielded', 'unshielded'],
          effectRolls: [[4], [3], [2]],
        },
      })
    expect(spoofedTarget).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('rejects a monster core spell through total cover', () => {
    const target = combatant('target', 10, { controller: 'player', currentHp: 30, maxHp: 30 })
    const mage = combatant('mage', 20, { statBlockId: 'srd-5.1:mage' })
    const state = startDnd5eHeadlessCombat('monster-core-spell-cover', [mage, target])
    state.distanceFeetByCombatantPair = { ['mage\u0000target']: 30 }
    state.lineOfEffectBlockedByCombatantPair = { ['mage\u0000target']: true }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-core-spell',
      actorId: 'mage',
      spellId: 'fire-bolt',
      slotLevel: 0,
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        d20: 15,
        effectRolls: [[5, 6]],
      },
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-target' })
  })

  it('spends both committed resources when a player counterspells a monster spell', () => {
    const target = combatant('target', 10, { controller: 'player', currentHp: 30, maxHp: 30 })
    const cultist = combatant('cultist', 20, {
      statBlockId: 'srd-5.1:cult-fanatic',
      classState: { monsterSpellSlots: { 1: { current: 2, max: 2 } } },
    })
    const wizard = combatant('wizard', 15, {
      controller: 'player',
      classId: 'wizard',
      classLevels: { wizard: 5 },
      level: 5,
      classSelections: { 'spell-prepared': ['counterspell'] },
      classSelectionsByClass: { wizard: { 'spell-prepared': ['counterspell'] } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('monster-core-spell-counterspell', [cultist, wizard, target])
    state.distanceFeetByCombatantPair = {
      ['cultist\u0000target']: 5,
      ['cultist\u0000wizard']: 30,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-core-spell',
      actorId: 'cultist',
      spellId: 'inflict-wounds',
      slotLevel: 1,
      counterspellReaction: { actorId: 'wizard', slotLevel: 3 },
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        d20: 18,
        effectRolls: [[5, 5, 5]],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(30)
    expect(result.state.combatants.cultist.classState.monsterSpellSlots?.['1'].current).toBe(1)
    expect(result.state.combatants.wizard.classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(result.state.combatants.wizard.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'counterspell-resolved',
      actorId: 'wizard',
      success: true,
    }))
    expect(result.events.some((event) => event.type === 'monster-core-spell-resolved')).toBe(false)
  })

  it('requires the counterspeller to see the monster caster', () => {
    const target = combatant('target', 10, { controller: 'player' })
    const cultist = combatant('cultist', 20, {
      statBlockId: 'srd-5.1:cult-fanatic',
      classState: { monsterSpellSlots: { 1: { current: 2, max: 2 } } },
    })
    const wizard = combatant('wizard', 15, {
      controller: 'player',
      classId: 'wizard',
      classLevels: { wizard: 5 },
      level: 5,
      classSelections: { 'spell-prepared': ['counterspell'] },
      classSelectionsByClass: { wizard: { 'spell-prepared': ['counterspell'] } },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('monster-counterspell-sight', [cultist, wizard, target])
    state.distanceFeetByCombatantPair = {
      ['cultist\u0000target']: 5,
      ['cultist\u0000wizard']: 30,
    }
    state.lineOfSightBlockedByCombatantPair = {
      ['wizard\u0000cultist']: true,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-core-spell',
      actorId: 'cultist',
      spellId: 'inflict-wounds',
      slotLevel: 1,
      counterspellReaction: { actorId: 'wizard', slotLevel: 3 },
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        d20: 18,
        effectRolls: [[5, 5, 5]],
      },
    })
    expect(result).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('makes a monster spell attack critical against a paralyzed target within 5 feet', () => {
    const target = combatant('target', 10, {
      controller: 'player',
      currentHp: 30,
      maxHp: 30,
      classState: {
        activeEffects: [createDnd5eConditionEffect({
          condition: 'paralyzed',
          source: { kind: 'spell', actorId: 'mage', rulesId: 'hold-person' },
          targetId: 'target',
        })],
      },
    })
    const mage = combatant('mage', 20, { statBlockId: 'srd-5.1:mage' })
    const state = startDnd5eHeadlessCombat('monster-spell-auto-critical', [mage, target])
    state.distanceFeetByCombatantPair = { ['mage\u0000target']: 5 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-core-spell',
      actorId: 'mage',
      spellId: 'fire-bolt',
      slotLevel: 0,
      resolution: {
        schemaVersion: 1,
        targetIds: ['target'],
        d20: 10,
        d20Second: 10,
        effectRolls: [[2, 3, 4, 5]],
      },
    })
    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(16)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved',
      critical: true,
    }))
  })

  it('resolves legendary Detect and the full dragon Wing Attack save package', () => {
    const hero = combatant('hero', 20, {
      controller: 'player',
      position: { x: 5, y: 0 },
      currentHp: 100,
      maxHp: 100,
    })
    const dragon = combatant('dragon', 10, {
      statBlockId: 'srd-5.1:adult-black-dragon',
      classState: { monsterLegendaryActionPoints: 3 },
      position: { x: 0, y: 0 },
    })
    const detect = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('legendary-detect', [hero, dragon]), {
      type: 'monster-adjudicated-action',
      actorId: 'dragon',
      actionId: 'detect',
      legendary: true,
      effects: [],
      d20: 12,
    })
    expect(detect.ok).toBe(true)
    expect(detect.events).toContainEqual(expect.objectContaining({
      type: 'monster-legendary-detect-resolved',
      d20: 12,
    }))

    const wingState = startDnd5eHeadlessCombat('legendary-wing', [hero, dragon])
    wingState.distanceFeetByCombatantPair = { ['dragon\u0000hero']: 5 }
    const wing = resolveDnd5eHeadlessAction(wingState, {
      type: 'monster-adjudicated-action',
      actorId: 'dragon',
      actionId: 'wing-attack-costs-2-actions',
      legendary: true,
      effects: [],
      targetSavingThrows: [{ targetId: 'hero', d20: 1 }],
      damageRolls: [3, 4],
    })
    expect(wing.ok, wing.ok ? undefined : wing.reason).toBe(true)
    expect(wing.state.combatants.hero.currentHp).toBe(87)
    expect(wing.state.combatants.hero.conditions).toContain('prone')
    expect(wing.state.combatants.dragon.turn.movementRemaining).toBe(70)
  })

  it('supports authoritative vampire alternate forms and forced return to true form', () => {
    const vampire = combatant('vampire', 20, {
      statBlockId: 'srd-5.1:vampire-vampire',
      shapechanger: true,
    })
    const hero = combatant('hero', 10, { controller: 'player' })
    const changed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('shapechange', [vampire, hero]), {
      type: 'monster-shapechange',
      actorId: 'vampire',
      formId: 'srd-5.1:vampire-bat',
    })
    expect(changed.ok, changed.ok ? undefined : changed.reason).toBe(true)
    expect(changed.state.combatants.vampire.statBlockId).toBe('srd-5.1:vampire-bat')
    expect(changed.state.combatants.vampire.movementSpeeds?.fly).toBe(30)
    expect(changed.state.combatants.vampire.classState.monsterShapechangeOriginalStatBlockId)
      .toBe('srd-5.1:vampire-vampire')
  })

  it('limits room monster lair effects to one use per round', () => {
    const base = getDnd5eSrdMonster('srd-5.1:wolf')!
    setDnd5eRoomMonsterCatalog([{
      ...base,
      id: 'room-monster:lair-wolf',
      slug: 'lair-wolf',
      source: 'DM 自定义',
      lairInitiative: 20,
      lairActions: [{
        id: 'burning-ground',
        name: '燃烧地面',
        description: '巢穴中的地面燃烧。',
        kind: 'other',
        automation: 'dm-adjudication',
      }],
    }])
    const hero = combatant('hero', 20, { controller: 'player' })
    const monster = combatant('lair-wolf', 10, { statBlockId: 'room-monster:lair-wolf' })
    const state = startDnd5eHeadlessCombat('lair', [hero, monster])
    const first = resolveDnd5eHeadlessAction(state, {
      type: 'monster-lair-action',
      actorId: 'lair-wolf',
      actionId: 'burning-ground',
      effects: [{ targetId: 'hero', operation: 'damage', amount: 5, damageType: 'fire' }],
    })
    expect(first.ok, first.ok ? undefined : first.reason).toBe(true)
    expect(first.state.combatants.hero.currentHp).toBe(95)
    const repeated = resolveDnd5eHeadlessAction(first.state, {
      type: 'monster-lair-action',
      actorId: 'lair-wolf',
      actionId: 'burning-ground',
      effects: [],
    })
    expect(repeated).toMatchObject({ ok: false, reason: 'invalid-monster-action' })
  })
})
