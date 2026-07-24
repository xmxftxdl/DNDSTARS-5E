import { afterEach, describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { getDnd5eSrdMonster, setDnd5eRoomMonsterCatalog } from './monsters'

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
