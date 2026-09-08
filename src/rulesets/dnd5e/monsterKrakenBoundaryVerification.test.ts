import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { getDnd5eSrdMonster } from './monsters'

describe('Kraken Lightning Storm resolves three independent bolts', () => {
  it.each([false, true])('allows repeated targets and settles each bolt (legendary=%s)', legendary => {
    const monster = getDnd5eSrdMonster('srd-5.1:kraken')!
    const actor = createDnd5eCombatant({ id: 'actor', name: monster.name, controller: 'dm',
      statBlockId: monster.id, initiative: legendary ? 10 : 20, abilities: monster.abilities,
      proficiencyBonus: 7, armorClass: 18, maxHp: 472, currentHp: 472, temporaryHp: 0,
      speed: 20, position: { x: 0, y: 0 }, concentrating: false,
      classState: { monsterLegendaryActionPoints: 3, turnStartResolvedTurnKey: 'kraken-boundary:1:actor' } })
    const target = createDnd5eCombatant({ id: 'target', name: 'target', controller: 'player',
      initiative: legendary ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      savingThrowBonuses: { dex: 4 },
      proficiencyBonus: 2, armorClass: 10, maxHp: 100, currentHp: 100, temporaryHp: 0,
      speed: 30, position: { x: 5, y: 0 }, concentrating: false })
    const other = createDnd5eCombatant({ id: 'other', name: 'other', controller: 'player',
      initiative: 5, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, maxHp: 100, currentHp: 100, temporaryHp: 0,
      speed: 30, position: { x: 10, y: 0 }, concentrating: false })
    const state = startDnd5eHeadlessCombat('kraken-boundary', [actor, target, other])
    const actionId = legendary ? 'lightning-storm-costs-2-actions' : 'lightning-storm'
    const resolution = { schemaVersion: 1 as const, targetIds: ['target', 'target', 'other'],
      targetSavingThrows: [
        { targetId: 'target', d20: 1 },
        { targetId: 'target', d20: 20 },
        { targetId: 'other', d20: 1 },
      ],
      damageRolls: [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3] }
    const result = resolveDnd5eHeadlessAction(state, legendary
      ? { type: 'monster-area-action', actorId: 'actor', actionId, legendary: true, resolution }
      : { type: 'monster-area-action', actorId: 'actor', actionId, resolution })
    expect(result.ok, result.ok ? '' : result.reason).toBe(true)
    expect(result.state.combatants.target.currentHp).toBe(92)
    expect(result.state.combatants.other.currentHp).toBe(88)
    expect(result.events.filter(event => event.type === 'saving-throw-resolved'))
      .toHaveLength(3)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'monster-area-action-resolved',
      targetIds: ['target', 'target', 'other'],
      damage: 24,
    }))
    expect(result.state.combatants.actor.turn.actionAvailable).toBe(legendary)
    expect(result.state.combatants.actor.classState.monsterLegendaryActionPoints)
      .toBe(legendary ? 1 : 3)
    expect((legendary ? monster.legendaryActions : monster.actions)?.find(action => action.id === actionId))
      .toMatchObject({ automation: 'headless', rule: {
        minimumTargets: 3,
        maximumTargets: 3,
        allowRepeatedTargetSelections: true,
        damageRollsPerTargetSelection: true,
      } })
  })

  it.each([false, true])('rejects incomplete bolt payload without mutation (legendary=%s)', legendary => {
    const monster = getDnd5eSrdMonster('srd-5.1:kraken')!
    const actor = createDnd5eCombatant({ id: 'actor', name: monster.name, controller: 'dm',
      statBlockId: monster.id, initiative: legendary ? 10 : 20, abilities: monster.abilities,
      proficiencyBonus: 7, armorClass: 18, maxHp: 472, currentHp: 472, temporaryHp: 0,
      speed: 20, position: { x: 0, y: 0 }, concentrating: false,
      classState: { monsterLegendaryActionPoints: 3, turnStartResolvedTurnKey: 'kraken-boundary:1:actor' } })
    const target = createDnd5eCombatant({ id: 'target', name: 'target', controller: 'player',
      initiative: legendary ? 20 : 10, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2, armorClass: 10, maxHp: 100, currentHp: 100, temporaryHp: 0,
      speed: 30, position: { x: 5, y: 0 }, concentrating: false })
    const state = startDnd5eHeadlessCombat('kraken-boundary', [actor, target])
    const before = structuredClone(state)
    const resolution = { schemaVersion: 1 as const, targetIds: ['target', 'target'],
      targetSavingThrows: [{ targetId: 'target', d20: 1 }, { targetId: 'target', d20: 1 }],
      damageRolls: [1, 1, 1, 1, 1, 1, 1, 1] }
    const result = resolveDnd5eHeadlessAction(state, legendary
      ? { type: 'monster-area-action', actorId: 'actor', actionId: 'lightning-storm-costs-2-actions', legendary: true, resolution }
      : { type: 'monster-area-action', actorId: 'actor', actionId: 'lightning-storm', resolution })
    expect(result.ok).toBe(false)
    expect(result.state).toEqual(before)
  })
})
