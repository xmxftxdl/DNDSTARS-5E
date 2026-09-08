import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { DND5E_FLAME_BLADE_RELEASED_SUSPENSION } from './sustainedSpellControls'

const abilities = { str: 10, dex: 14, con: 16, int: 10, wis: 20, cha: 10 } as const

describe('Flame Blade Headless effect', () => {
  it('projects its 10-foot bright and additional 10-foot dim light on the authoritative effect', () => {
    const druid = createDnd5eCombatant({
      id: 'druid', name: 'Druid', controller: 'player', initiative: 20,
      classId: 'druid', level: 7, abilities, proficiencyBonus: 3,
      armorClass: 15, currentHp: 50, maxHp: 50, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      classSelections: { 'spell-prepared': ['flame-blade'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = createDnd5eCombatant({
      id: 'enemy', name: 'Enemy', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 10,
      currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 5, y: 0 }, concentrating: false,
    })

    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('flame-blade-light', [druid, enemy]),
      {
        type: 'cast-spell', actorId: druid.id, targetId: druid.id,
        spellId: 'flame-blade', slotLevel: 4, effectRolls: [],
      },
    )

    expect(cast.ok, cast.ok ? undefined : cast.reason).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants[druid.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        definitionId: 'srd-5.1:spell:flame-blade',
        potency: 4,
        modifiers: expect.objectContaining({
          emittedLight: {
            brightRadiusFeet: 10,
            dimRadiusFeet: 10,
            color: '#fb923c',
          },
        }),
      }),
    )
  })

  it('lets go without ending concentration and re-evokes with exactly one bonus action', () => {
    const druid = createDnd5eCombatant({
      id: 'druid-toggle', name: 'Druid', controller: 'player', initiative: 20,
      classId: 'druid', level: 7, abilities, proficiencyBonus: 3,
      armorClass: 15, currentHp: 50, maxHp: 50, temporaryHp: 0,
      speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      classSelections: { 'spell-prepared': ['flame-blade'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const enemy = createDnd5eCombatant({
      id: 'enemy-toggle', name: 'Enemy', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 10,
      currentHp: 30, maxHp: 30, temporaryHp: 0,
      speed: 30, position: { x: 5, y: 0 }, concentrating: false,
    })
    const cast = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('flame-blade-toggle', [druid, enemy]),
      {
        type: 'cast-spell', actorId: druid.id, targetId: druid.id,
        spellId: 'flame-blade', slotLevel: 4, effectRolls: [],
      },
    )
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    const effectId = cast.state.combatants[druid.id].classState.activeEffects?.find((effect) =>
      effect.definitionId === 'srd-5.1:spell:flame-blade')?.id
    expect(effectId).toBeTruthy()

    const released = resolveDnd5eHeadlessAction(cast.state, {
      type: 'set-flame-blade-manifestation', actorId: druid.id,
      effectId: effectId!, manifested: false,
    })
    expect(released.ok).toBe(true)
    if (!released.ok) return
    expect(released.state.combatants[druid.id].classState.concentrationSpellId).toBe('flame-blade')
    expect(released.state.combatants[druid.id].turn.actionAvailable).toBe(true)
    expect(released.state.combatants[druid.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({
        id: effectId,
        suspendedBy: [DND5E_FLAME_BLADE_RELEASED_SUSPENSION],
      }),
    )
    expect(resolveDnd5eHeadlessAction(released.state, {
      type: 'cast-spell', actorId: druid.id, targetId: enemy.id, targetIds: [enemy.id],
      spellId: 'flame-blade', slotLevel: 4, sustainedEffectAttack: 'flame-blade',
      d20: 20, effectRolls: [1, 1, 1, 1],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    released.state.combatants[druid.id].turn.bonusActionAvailable = true
    const evoked = resolveDnd5eHeadlessAction(released.state, {
      type: 'set-flame-blade-manifestation', actorId: druid.id,
      effectId: effectId!, manifested: true,
    })
    expect(evoked.ok).toBe(true)
    if (!evoked.ok) return
    expect(evoked.state.combatants[druid.id].turn).toMatchObject({
      actionAvailable: true,
      bonusActionAvailable: false,
    })
    expect(evoked.state.combatants[druid.id].classState.activeEffects).toContainEqual(
      expect.objectContaining({ id: effectId, suspendedBy: undefined }),
    )
    expect(evoked.state.combatants[druid.id].classState.concentrationSpellId).toBe('flame-blade')
  })
})
