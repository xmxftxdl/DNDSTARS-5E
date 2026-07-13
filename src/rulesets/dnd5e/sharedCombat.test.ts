import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { publishDnd5eCombatState, shouldApplySharedDnd5eCombatState } from './sharedCombat'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

function combatant(id: string, initiative: number) {
  return createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2, armorClass: 10, currentHp: 10, maxHp: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
}

describe('shared D&D 5e combat state', () => {
  it('publishes authoritative turn economy without AP fields', () => {
    const headless = startDnd5eHeadlessCombat('combat-1', [combatant('a', 20), combatant('b', 10)])
    const shared = publishDnd5eCombatState(headless, { mapId: 'map-1', revision: 3, updatedAt: 100 })
    expect(shared.combatants.a.turn).toEqual({ actionAvailable: true, bonusActionAvailable: true, reactionAvailable: true, movementRemaining: 30 })
    expect(JSON.stringify(shared)).not.toMatch(/actionPoints|currentAP|enemyApByToken|apCost/)
  })

  it('rejects stale and cross-combat snapshots', () => {
    const headless = startDnd5eHeadlessCombat('combat-1', [combatant('a', 20), combatant('b', 10)])
    const incoming = publishDnd5eCombatState(headless, { mapId: 'map-1', revision: 2, updatedAt: 100 })
    expect(shouldApplySharedDnd5eCombatState({ incoming, mapId: 'map-1', combatId: 'combat-1', currentRevision: 3 })).toEqual({ status: 'ignored', reason: 'stale' })
    expect(shouldApplySharedDnd5eCombatState({ incoming, mapId: 'map-1', combatId: 'combat-2', currentRevision: 0 })).toEqual({ status: 'ignored', reason: 'wrong-combat' })
  })
})
