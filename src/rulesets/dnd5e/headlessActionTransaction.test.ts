import { describe, expect, it } from 'vitest'
import { createCombatTransaction } from '../../lib/combatTransaction'
import { createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { getDnd5eSrdMonster } from './monsters'

function combatant(id: string, initiative: number) {
  return createDnd5eCombatant({
    id,
    name: id,
    controller: id === 'actor' ? 'player' : 'dm',
    initiative,
    abilities: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 },
    armorClass: 12,
    proficiencyBonus: 2,
    currentHp: 20,
    maxHp: 20,
    temporaryHp: 0,
    speed: 30,
    concentrating: false,
    position: { x: 0, y: 0 },
  })
}

describe('D&D 5e root action transactions', () => {
  it('commits a successful core attack and records attack and damage dice once', () => {
    const state = { ...startDnd5eHeadlessCombat('combat', [combatant('actor', 20), combatant('target', 10)]), mapId: 'map' }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: 'actor',
      targetId: 'target',
      attackModifier: 5,
      d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [6], type: 'slashing' },
    }, { transactionId: 'action-1', now: 100 })

    expect(result.ok).toBe(true)
    expect(result.transaction).toMatchObject({
      id: 'action-1',
      mapId: 'map',
      combatId: 'combat',
      actorId: 'actor',
      actionKind: 'attack',
      status: 'committed',
    })
    expect(result.transaction?.rollLedger.entries.filter((entry) => entry.kind === 'attack')).toHaveLength(1)
    expect(result.transaction?.rollLedger.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'attack', dice: { sides: 20, values: [15] } }),
      expect.objectContaining({ kind: 'damage', dice: { sides: 8, values: [6] }, modifier: 3 }),
    ]))
  })

  it('rolls back failed actions without mutating the authoritative source state', () => {
    const state = { ...startDnd5eHeadlessCombat('combat', [combatant('actor', 20), combatant('target', 10)]), mapId: 'map' }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack',
      actorId: 'actor',
      targetId: 'missing',
      attackModifier: 5,
      d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [6], type: 'slashing' },
    }, { transactionId: 'action-2', now: 200 })

    expect(result.ok).toBe(false)
    expect(result.transaction).toMatchObject({ status: 'rolled-back', rollbackReason: 'invalid-target' })
    expect(state.combatants.target.currentHp).toBe(20)
  })

  it('continues an existing equipment interrupt transaction instead of creating a second transaction', () => {
    const state = { ...startDnd5eHeadlessCombat('combat', [combatant('actor', 20), combatant('target', 10)]), mapId: 'map' }
    const transaction = createCombatTransaction({
      id: 'equipment-action', mapId: 'map', combatId: 'combat', actorId: 'actor',
      actionId: 'equipment-action', actionKind: 'weapon-attack', now: 300,
    })
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4], type: 'slashing' },
    }, { transaction, now: 301 })

    expect(result.transaction).toMatchObject({ id: 'equipment-action', actionKind: 'weapon-attack', status: 'committed' })
  })

  it('does not fabricate dice ledger entries for a source-linked on-hit condition', () => {
    const ankheg = getDnd5eSrdMonster('srd-5.1:ankheg')
    if (!ankheg) throw new Error('missing SRD ankheg')
    const actor = createDnd5eCombatant({
      id: 'actor',
      name: ankheg.name,
      controller: 'dm',
      initiative: 20,
      statBlockId: ankheg.id,
      creatureType: ankheg.creatureType,
      abilities: ankheg.abilities,
      armorClass: ankheg.armorClass.value,
      proficiencyBonus: 2,
      currentHp: ankheg.hitPoints.average,
      maxHp: ankheg.hitPoints.average,
      temporaryHp: 0,
      speed: 30,
      concentrating: false,
      position: { x: 0, y: 0 },
    })
    const target = combatant('target', 10)
    const state = {
      ...startDnd5eHeadlessCombat('combat', [actor, target]),
      mapId: 'map',
    }

    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action',
      actorId: actor.id,
      actionId: 'bite',
      rolls: [{
        targetId: target.id,
        d20: 10,
        damageRolls: [[1, 1], [1]],
        onHitEffectRolls: [{ effectId: 'bite-grapple' }],
      }],
    }, { transactionId: 'ankheg-bite', now: 400 })

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
    expect(result.transaction?.rollLedger.entries.some((entry) =>
      entry.id.includes(':on-hit:'),
    )).toBe(false)
    expect(result.transaction?.rollLedger.entries.filter((entry) =>
      entry.kind === 'damage',
    )).toHaveLength(2)
  })
})
