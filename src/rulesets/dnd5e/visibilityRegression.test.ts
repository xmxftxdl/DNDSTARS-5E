import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantCanSee,
  startDnd5eHeadlessCombat,
} from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, dnd5eConditionsFromActiveEffects } from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 } as const

describe('D&D 5e visibility regressions', () => {
  it('lets Faerie Fire suppress invisibility in the authoritative visibility check', () => {
    const bard = createDnd5eCombatant({
      id: 'bard', name: 'bard', controller: 'player', initiative: 20,
      abilities, proficiencyBonus: 3, armorClass: 14, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false,
      classId: 'bard', level: 5,
      classSelections: { 'spell-known': ['faerie-fire'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } },
    })
    const target = createDnd5eCombatant({
      id: 'target', name: 'target', controller: 'dm', initiative: 10,
      abilities, proficiencyBonus: 2, armorClass: 14, currentHp: 20, maxHp: 20,
      temporaryHp: 0, speed: 30, position: { x: 5, y: 0 }, concentrating: false,
    })
    const invisibleEffects = migrateLegacyDnd5eConditions({ targetId: target.id, conditions: ['invisible'] })
    target.classState.activeEffects = invisibleEffects
    target.conditions = dnd5eConditionsFromActiveEffects(invisibleEffects)

    const state = startDnd5eHeadlessCombat('faerie-fire-visibility', [bard, target])
    expect(dnd5eCombatantCanSee(state, bard.id, target.id)).toBe(false)

    state.combatants.target.classState.activeEffects = [
      ...(state.combatants.target.classState.activeEffects ?? []),
      createDnd5eMechanicalEffect({
        definitionId: 'srd-5.1:spell:faerie-fire', label: '妖火：显形', targetId: target.id,
        source: { kind: 'spell', actorId: bard.id, rulesId: 'srd-5.1:spell:faerie-fire' },
        duration: { type: 'concentration', sourceActorId: bard.id, concentrationId: 'faerie-fire' },
      }),
    ]

    expect(dnd5eCombatantCanSee(state, bard.id, target.id)).toBe(true)
  })
})
