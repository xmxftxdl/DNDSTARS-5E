import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eRepeatedMeleeAttackMode,
  dnd5eMonsterSpellAttackMode, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat,
  type Dnd5eActionResult, type Dnd5eCombatant } from './headlessCombatEngine'

const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 18 } as const
function combatant(id: string, initiative: number, patch: Partial<Dnd5eCombatant> = {}) {
  return createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, creatureType: 'humanoid',
    proficiencyBonus: 2, armorClass: 10, currentHp: 1000, maxHp: 1000, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
}
function success(result: Dnd5eActionResult) {
  expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('authoritative source-bound attack effects without UI supplied roll modes', () => {
  it.each(['berserker', 'minotaur'])('%s grants incoming generic weapon advantage after explicit activation', slug => {
    const actor = combatant('reckless', 20, { controller: 'dm', statBlockId: `srd-5.1:${slug}` })
    const attacker = combatant('attacker', 10)
    const state = startDnd5eHeadlessCombat('generic-reckless', [actor, attacker])
    const activated = success(resolveDnd5eHeadlessAction(state, { type: 'monster-reckless', actorId: actor.id }))
    const turn = success(resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: actor.id }))
    const attack = { type: 'attack' as const, actorId: attacker.id, targetId: actor.id,
      attackModifier: 10, d20: 1, d20Second: 19,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'force' as const } }
    const resolved = success(resolveDnd5eHeadlessAction(turn.state, attack))
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 19, hit: true }))
    const cancelled = success(resolveDnd5eHeadlessAction(turn.state, { ...attack, mode: 'disadvantage' }))
    expect(cancelled.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 1, hit: false }))
  })

  it.each(['generic-weapon', 'monster-weapon', 'spell', 'spell-projectile', 'mode-projections'] as const)(
    'Chill Touch affects %s only against its caster', kind => {
      const caster = combatant('caster', 30, { classId: 'warlock', level: 1,
        classSelections: { 'spell-cantrips': ['chill-touch'] } })
      const undead = combatant('undead', 20, { controller: 'dm', creatureType: 'undead',
        statBlockId: kind === 'monster-weapon' ? 'srd-5.1:skeleton' : undefined,
        classId: kind === 'spell-projectile' ? 'warlock' : 'wizard', level: 1,
        classSelections: { 'spell-cantrips': kind === 'spell-projectile' ? ['eldritch-blast'] : ['ray-of-frost'] } })
      const other = combatant('other', 10)
      const state = startDnd5eHeadlessCombat(`chill-authority-${kind}`, [caster, undead, other])
      state.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(caster.id, undead.id)]: 30,
        [dnd5eCombatantPairKey(other.id, undead.id)]: 30,
      }
      const cast = success(resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: caster.id,
        targetId: undead.id, spellId: 'chill-touch', slotLevel: 0, d20: 15, effectRolls: [1] }))
      const turn = success(resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: caster.id }))
      for (const targetId of [caster.id, other.id]) {
        if (kind === 'mode-projections') {
          expect(dnd5eRepeatedMeleeAttackMode(turn.state, undead.id, targetId)).toBe(targetId === caster.id ? 'disadvantage' : 'normal')
          expect(dnd5eMonsterSpellAttackMode(turn.state, undead.id, targetId, 'ranged')).toBe(targetId === caster.id ? 'disadvantage' : 'normal')
          continue
        }
        const result = kind === 'generic-weapon'
          ? resolveDnd5eHeadlessAction(turn.state, { type: 'attack', actorId: undead.id, targetId,
            attackModifier: 10, d20: 19, d20Second: 1,
            damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'force' } })
          : kind === 'monster-weapon'
            ? resolveDnd5eHeadlessAction(turn.state, { type: 'monster-action', actorId: undead.id, actionId: 'shortbow',
              rolls: [{ targetId, d20: 19, d20Second: 1, damageRolls: [[2]] }] })
            : kind === 'spell-projectile'
              ? resolveDnd5eHeadlessAction(turn.state, { type: 'cast-spell', actorId: undead.id, targetId,
                spellId: 'eldritch-blast', slotLevel: 0, effectRolls: [], projectileTargetIds: [targetId],
                targetAttacks: [{ targetId, d20: 19, d20Second: 1, effectRolls: targetId === caster.id ? [] : [2] }] })
              : resolveDnd5eHeadlessAction(turn.state, { type: 'cast-spell', actorId: undead.id, targetId,
              spellId: 'ray-of-frost', slotLevel: 0, d20: 19, d20Second: 1, effectRolls: targetId === caster.id ? [] : [2] })
        const resolved = success(result)
        expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved',
          actorId: undead.id, targetId, d20: targetId === caster.id ? 1 : 19, hit: targetId !== caster.id }))
      }
    },
  )
})
