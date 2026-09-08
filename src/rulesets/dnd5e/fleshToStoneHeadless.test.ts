import { describe, expect, it } from 'vitest'
import { ensureDnd5eCoreSpellActivitiesRegisteredV1 } from './activities/dnd5eCoreSpellActivities'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'

const abilities = { str: 10, dex: 14, con: 15, int: 10, wis: 10, cha: 10 } as const

describe('Flesh to Stone headless spell boundary', () => {
  it('spends the cast on a skeleton without rolling or starting empty concentration', () => {
    ensureDnd5eCoreSpellActivitiesRegisteredV1()
    const caster = createDnd5eCombatant({
      id: 'flesh-to-stone-caster', name: 'Wizard', controller: 'player', initiative: 20,
      abilities: { ...abilities, int: 20 }, proficiencyBonus: 6, armorClass: 16,
      currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30,
      position: { x: 0, y: 0 }, concentrating: false,
      classId: 'wizard', level: 20, classLevels: { wizard: 20 }, saveDc: 19,
      classSelections: { 'spell-prepared': ['flesh-to-stone'] },
      classSelectionsByClass: { wizard: { 'spell-prepared': ['flesh-to-stone'] } },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const skeleton = createDnd5eCombatant({
      id: 'skeleton-target', name: 'Skeleton', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 13,
      currentHp: 25, maxHp: 25, temporaryHp: 0, speed: 30,
      position: { x: 5, y: 0 }, concentrating: false,
      statBlockId: 'srd-5.1:skeleton', creatureType: '亡灵',
    })
    const state = startDnd5eHeadlessCombat('activity-flesh-to-stone-skeleton', [caster, skeleton])
    state.distanceFeetByCombatantPair = {
      [dnd5eCombatantPairKey(caster.id, skeleton.id)]: 5,
    }
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'plugin-spell-activity', actorId: caster.id,
      pluginAction: {
        type: 'plugin', pluginId: 'srd-5.1', actionId: 'spell:flesh-to-stone',
        transactionId: 'flesh-to-stone-skeleton-cast', actorId: caster.id,
        targetId: skeleton.id, targetIds: [skeleton.id], distanceFeet: 5,
        castLevel: 6, rolls: {},
      },
      spell: {
        castingClassId: 'wizard', spellId: 'flesh-to-stone', spellName: '石化术',
        spellLevel: 6, slotLevel: 6, castingTime: 'action',
        declaredTargetIds: [skeleton.id], concentrationRounds: 10,
        concentrationTargetIds: [skeleton.id], spellSchool: 'transmutation',
      },
    })

    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants[caster.id]).toMatchObject({
      concentrating: false,
      turn: { actionAvailable: false },
      classResources: { 'dnd5e-spell-slot-6': { current: 0, max: 1 } },
    })
    expect(resolved.state.combatants[skeleton.id]).toMatchObject({
      conditions: [],
      classState: { activeEffects: undefined, concentrationEffectsBySource: undefined },
    })
    expect(resolved.events).not.toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
    }))
    expect(resolved.events).not.toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'concentration', active: true,
    }))
  })
})
