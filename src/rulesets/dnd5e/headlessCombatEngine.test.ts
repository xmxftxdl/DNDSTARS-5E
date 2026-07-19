import { describe, expect, it } from 'vitest'
import { createDnd5eCombatant, dnd5eCombatantPairKey, dnd5eDarkOnesOwnLuckAvailable, dnd5eWeaponClassDamageDefinitions, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5eConditionsFromActiveEffects } from './activeEffects'
import { migrateLegacyDnd5eConditions } from './legacyActiveEffectMigration'

const abilities = { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 } as const

function fighter(id: string, initiative: number, patch = {}) {
  const combatant = createDnd5eCombatant({ id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2, armorClass: 16, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false, ...patch })
  const conditionLabels = (patch as { conditions?: string[] }).conditions
  if (conditionLabels?.length) {
    const activeEffects = migrateLegacyDnd5eConditions({ targetId: id, conditions: conditionLabels })
    combatant.classState.activeEffects = activeEffects
    combatant.conditions = dnd5eConditionsFromActiveEffects(activeEffects)
  }
  return combatant
}

describe('D&D 5e 2014 headless combat engine', () => {
  it('resolves Counterspell inside the Headless spell transaction and spends only declared resources', () => {
    const caster = fighter('caster', 20, {
      classId: 'wizard', level: 5, controller: 'player',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const reactor = fighter('reactor', 10, {
      classId: 'wizard', level: 5, controller: 'dm',
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['counterspell'] },
      classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('counterspell', [caster, reactor])
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'reactor')]: 30 }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'caster', targetId: 'reactor', spellId: 'fire-bolt', slotLevel: 0,
      d20: 20, effectRolls: [6, 6], counterspellReaction: { actorId: 'reactor', slotLevel: 3 },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.reactor.currentHp).toBe(20)
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'counterspell-resolved', actorId: 'reactor', casterId: 'caster', success: true,
    }))
  })

  it('lets a failed spell save consume Legendary Resistance before damage and conditions', () => {
    const caster = fighter('cleric', 20, {
      classId: 'cleric', level: 5, controller: 'player',
      abilities: { ...abilities, wis: 18 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const legendary = fighter('legendary', 10, {
      controller: 'dm', abilities: { ...abilities, dex: 8 },
      classState: { legendaryResistanceUses: 1 },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('legendary-resistance', [caster, legendary]), {
      type: 'cast-spell', actorId: 'cleric', targetId: 'legendary', spellId: 'sacred-flame', slotLevel: 0,
      savingThrowD20: 1, effectRolls: [], legendaryResistanceTargetIds: ['legendary'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.legendary.currentHp).toBe(20)
    expect(result.state.combatants.legendary.classState.legendaryResistanceUses).toBe(0)
    expect(result.events).toContainEqual({ type: 'legendary-resistance-used', targetId: 'legendary', remainingUses: 0 })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'saving-throw-resolved', success: true }))
  })

  it('spends movement independently from the action and supports Dash', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'a', to: { x: 20, y: 0 }, distance: 20 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.a.turn).toMatchObject({ actionAvailable: true, movementRemaining: 10 })
    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: 'a' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.a.turn).toMatchObject({ actionAvailable: false, movementRemaining: 40 })
  })

  it('resolves Lore Bard Peerless Skill as an authoritative ability-check resource spend', () => {
    const bard = fighter('bard', 20, {
      classId: 'bard', subclassId: 'lore', level: 14, proficiencyBonus: 5,
      abilities: { ...abilities, cha: 18 },
      skillProficiencies: ['performance'],
      classSelections: { expertise: ['performance'] },
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('peerless-skill', [bard, fighter('enemy', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'ability-check', actorId: 'bard', ability: 'cha', skill: 'performance',
      d20: 2, dc: 20, peerlessSkillRoll: 6,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration']).toEqual({ current: 1, max: 4 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 22, success: true, peerlessSkillApplied: 6,
    }))
  })

  it('allows an opposing Lore Bard to reduce an ability check with Cutting Words', () => {
    const checker = fighter('checker', 20, { controller: 'dm', abilities: { ...abilities, int: 14 } })
    const bard = fighter('bard', 10, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cutting-check', [checker, bard]),
      {
        type: 'ability-check', actorId: 'checker', ability: 'int', d20: 13, dc: 15,
        cuttingWords: { bardId: 'bard', roll: 4, distanceFeet: 30 },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 11, success: false, cuttingWordsApplied: 4,
    }))
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(1)
  })

  it("supports Dark One's Own Luck and Stroke of Luck on generic ability checks", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    let result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('check-luck', [warlock, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'warlock', ability: 'int', d20: 5, dc: 12, darkOnesOwnLuckRoll: 7 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 12, success: true, darkOnesOwnLuckApplied: 7,
    }))
    expect(result.state.combatants.warlock.classResources['dnd5e-dark-ones-own-luck'].current).toBe(0)

    const rogue = fighter('rogue', 20, {
      classId: 'rogue', subclassId: 'thief', level: 20, proficiencyBonus: 6,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stroke-check', [rogue, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'rogue', ability: 'wis', d20: 1, dc: 15, strokeOfLuck: true },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 20, total: 21, success: true, strokeOfLuckApplied: true,
    }))
    expect(result.state.combatants.rogue.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('applies Jack of All Trades, Reliable Talent, and Indomitable Might to generic checks', () => {
    const bard = fighter('bard', 20, { classId: 'bard', level: 5, proficiencyBonus: 3 })
    let result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('jack-check', [bard, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'bard', ability: 'wis', d20: 10 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'ability-check-resolved', total: 12 }))

    const rogue = fighter('rogue', 20, {
      classId: 'rogue', level: 11, proficiencyBonus: 4,
      skillProficiencies: ['stealth'], classSelections: { expertise: ['stealth'] },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('reliable-check', [rogue, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'rogue', ability: 'dex', skill: 'stealth', d20: 2 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 10, total: 20, reliableTalentApplied: true,
    }))

    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', level: 18, abilities: { ...abilities, str: 20 },
    })
    result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('might-check', [barbarian, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'barbarian', ability: 'str', d20: 1 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', total: 20, indomitableMightApplied: true,
    }))
  })

  it('grants a raging Barbarian advantage on Strength ability checks', () => {
    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', level: 5, classState: { raging: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('rage-strength-check', [barbarian, fighter('enemy', 10)]),
      { type: 'ability-check', actorId: 'barbarian', ability: 'str', d20: 4, d20Second: 17 },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'ability-check-resolved', d20: 17, mode: 'advantage', total: 20,
    }))
  })

  it('uses an action for an attack and SRD critical damage dice', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 20, damage: { count: 1, sides: 8, bonus: 3, rolls: [6, 4] } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.b.currentHp).toBe(7)
  })

  it('authoritatively reduces a ranged weapon hit with Deflect Missiles and spends the Monk reaction', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('deflect-missiles', [attacker, monk])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'monk', attackModifier: 10, d20: 10,
      deflectMissilesD10: 6,
      classDamageContext: {
        mode: 'ranged', finesse: false, strengthBased: false, weaponDamageSides: 8,
        damageType: 'piercing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'piercing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.currentHp).toBe(20)
    expect(result.state.combatants.monk.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.monk.classState).toMatchObject({
      deflectMissilesCatchSourceId: 'enemy',
      deflectMissilesCatchTurnKey: 'deflect-missiles:1:enemy',
      deflectMissilesCatchDamageType: 'piercing',
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-reduced', source: 'deflect-missiles', damageBefore: 11, damageAfter: 0, caught: true,
    }))

    const returned = resolveDnd5eHeadlessAction(result.state, {
      type: 'monk-deflect-missiles-return', actorId: 'monk', targetId: 'enemy', distanceFeet: 20,
      d20: 20, damageRolls: [4, 3],
    })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.monk.classResources['dnd5e-ki']).toEqual({ current: 1, max: 5 })
    expect(returned.state.combatants.monk.classState.deflectMissilesCatchSourceId).toBeUndefined()
    expect(returned.state.combatants.enemy.currentHp).toBe(11)
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'monk', targetId: 'enemy', hit: true, critical: true,
    }))
  })

  it('rejects Deflect Missiles for melee attacks and long-range return throws', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 2, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('invalid-deflect', [attacker, monk])
    const melee = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'monk', attackModifier: 10, d20: 10,
      deflectMissilesD10: 6,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'slashing' },
    })
    expect(melee).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const caughtState = startDnd5eHeadlessCombat('invalid-return', [attacker, monk])
    caughtState.combatants.monk.classState.deflectMissilesCatchSourceId = 'enemy'
    caughtState.combatants.monk.classState.deflectMissilesCatchTurnKey = 'invalid-return:1:enemy'
    caughtState.combatants.monk.classState.deflectMissilesCatchDamageType = 'piercing'
    expect(resolveDnd5eHeadlessAction(caughtState, {
      type: 'monk-deflect-missiles-return', actorId: 'monk', targetId: 'enemy', distanceFeet: 65,
      d20: 20, damageRolls: [4, 3],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('uses turn-slot identity for once-per-turn features on a Thief Reflexes turn', () => {
    const rogue = fighter('rogue', 20, { classId: 'rogue', subclassId: 'thief', level: 17 })
    const state = startDnd5eHeadlessCombat('reflexes', [rogue, fighter('enemy', 10)])
    state.turnSlotId = 'rogue:normal'
    state.combatants.rogue.classState.sneakAttackTurnKey = 'reflexes:1:rogue:normal'
    const context = {
      mode: 'ranged' as const, finesse: false, strengthBased: false, monkMartialArtsEligible: false,
      weaponDamageSides: 8, damageType: 'piercing' as const, adjacentEnemyOfTarget: true,
    }
    expect(dnd5eWeaponClassDamageDefinitions({
      state, actorId: 'rogue', targetId: 'enemy', context, effectiveMode: 'normal', critical: false,
    }).some((definition) => definition.source === 'sneak-attack')).toBe(false)
    state.turnSlotId = 'rogue:thief-reflexes'
    expect(dnd5eWeaponClassDamageDefinitions({
      state, actorId: 'rogue', targetId: 'enemy', context, effectiveMode: 'normal', critical: false,
    }).some((definition) => definition.source === 'sneak-attack')).toBe(true)
  })

  it('only turns a Champion natural 19 into a critical when the attack also hits', () => {
    const missed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('champion-miss', [fighter('a', 20), fighter('b', 10, { armorClass: 30 })]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, criticalThreshold: 19, d20: 19, damage: { count: 1, sides: 8, bonus: 0, rolls: [] } },
    )
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: false, critical: false }))
    expect(missed.state.combatants.b.currentHp).toBe(20)

    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('champion-hit', [fighter('a', 20), fighter('b', 10, { armorClass: 19 })]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, criticalThreshold: 19, d20: 19, damage: { count: 1, sides: 8, bonus: 0, rolls: [4, 5] } },
    )
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, critical: true }))
    expect(hit.state.combatants.b.currentHp).toBe(11)
  })

  it('applies invisibility to both sides of attack visibility', () => {
    const invisibleAttacker = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invisible-attacker', [
        fighter('a', 20, { conditions: ['invisible'] }), fighter('b', 10),
      ]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 2, d20Second: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] } },
    )
    expect(invisibleAttacker.ok).toBe(true)
    if (!invisibleAttacker.ok) return
    expect(invisibleAttacker.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 18, hit: true }))

    const invisibleTarget = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invisible-target', [
        fighter('a', 20), fighter('b', 10, { conditions: ['invisible'] }),
      ]),
      { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 18, d20Second: 2, damage: { count: 1, sides: 4, bonus: 0, rolls: [] } },
    )
    expect(invisibleTarget.ok).toBe(true)
    if (!invisibleTarget.ok) return
    expect(invisibleTarget.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('removes attack advantage against a conscious level-18 Rogue with Elusive', () => {
    const rogue = fighter('b', 10, { classId: 'rogue', level: 18 })
    const state = startDnd5eHeadlessCombat('combat', [fighter('a', 20), rogue])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5,
      mode: 'advantage', d20: 2, d20Second: 18,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.b.currentHp).toBe(20)
  })

  it('Dodge imposes disadvantage and opportunity attacks spend reactions', () => {
    const state = startDnd5eHeadlessCombat('combat', [fighter('b', 20), fighter('a', 10)])
    const dodged = resolveDnd5eHeadlessAction(state, { type: 'dodge', actorId: 'b' })
    expect(dodged.ok).toBe(true)
    if (!dodged.ok) return
    const ended = resolveDnd5eHeadlessAction(dodged.state, { type: 'end-turn', actorId: 'b' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const attack = resolveDnd5eHeadlessAction(ended.state, { type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 5, d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(attack.ok).toBe(true)
    if (!attack.ok) return
    expect(attack.state.combatants.b.currentHp).toBe(20)
    const reaction = resolveDnd5eHeadlessAction(attack.state, { type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 5, d20: 15, damage: { count: 1, sides: 8, bonus: 3, rolls: [5] } })
    expect(reaction.ok).toBe(true)
    if (!reaction.ok) return
    expect(reaction.state.combatants.b.turn.reactionAvailable).toBe(false)
  })

  it('authoritatively validates Protection and spends the shield bearer reaction', () => {
    const attacker = fighter('enemy', 20, { controller: 'dm' })
    const protector = fighter('protector', 10, {
      hasShield: true,
      classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const state = startDnd5eHeadlessCombat('protection', [attacker, protector, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
      protectionReactionActorId: 'protector', mode: 'disadvantage', d20: 18, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'protector', resource: 'reaction' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.protector.turn.reactionAvailable).toBe(false)

    const invalidState = startDnd5eHeadlessCombat('invalid-protection', [attacker, fighter('no-shield', 10, {
      classSelections: { 'fighting-style': ['protection'] },
    }), target])
    expect(resolveDnd5eHeadlessAction(invalidState, {
      type: 'attack', actorId: 'enemy', targetId: 'ally', attackModifier: 5,
      protectionReactionActorId: 'no-shield', mode: 'disadvantage', d20: 18, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('applies Protection to spell attack rolls as well as weapon attacks', () => {
    const caster = fighter('wizard', 20, {
      controller: 'dm', classId: 'wizard', level: 5,
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
      abilities: { ...abilities, int: 16 },
    })
    const protector = fighter('protector', 10, {
      hasShield: true, classSelections: { 'fighting-style': ['protection'] },
    })
    const target = fighter('ally', 5)
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('spell-protection', [caster, protector, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'ally', spellId: 'fire-bolt', slotLevel: 0,
      protectionReactionActorId: 'protector', mode: 'disadvantage', d20: 18, d20Second: 2, effectRolls: [],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'protector', resource: 'reaction' })
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
  })

  it('authoritatively applies Hunter Escape the Horde to opportunity attacks', () => {
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['escape-the-horde'] },
    })
    const state = startDnd5eHeadlessCombat('escape-the-horde', [fighter('enemy', 20), hunter])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', actorId: 'enemy', targetId: 'hunter', attackModifier: 5,
      d20: 20, d20Second: 2,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', d20: 2, hit: false }))
    expect(result.state.combatants.hunter.currentHp).toBe(20)
  })

  it('authoritatively validates the Berserker Retaliation reaction feature', () => {
    const berserker = fighter('berserker', 10, {
      classId: 'barbarian', subclassId: 'berserker', level: 14,
    })
    const state = startDnd5eHeadlessCombat('retaliation', [fighter('enemy', 20), berserker])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', reactionFeature: 'berserker-retaliation',
      actorId: 'berserker', targetId: 'enemy', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.berserker.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'berserker', targetId: 'enemy', amount: 8,
    }))

    const invalid = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('invalid-retaliation', [fighter('enemy', 20), fighter('fighter', 10)]),
      {
        type: 'opportunity-attack', reactionFeature: 'berserker-retaliation',
        actorId: 'fighter', targetId: 'enemy', attackModifier: 5, d20: 15,
        damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
      },
    )
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('authoritatively validates the Hunter Giant Killer reaction feature', () => {
    const hunter = fighter('hunter', 20, {
      classId: 'ranger', subclassId: 'hunter', level: 3,
      classSelections: { 'hunters-prey': ['giant-killer'] },
    })
    const state = startDnd5eHeadlessCombat('giant-killer', [hunter, fighter('giant', 10, { controller: 'dm' })])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'opportunity-attack', reactionFeature: 'hunter-giant-killer',
      actorId: 'hunter', targetId: 'giant', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.giant.currentHp).toBe(12)

    const invalid = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('invalid-giant-killer', [
      fighter('hunter', 20, { classId: 'ranger', subclassId: 'hunter', level: 3 }),
      fighter('giant', 10, { controller: 'dm' }),
    ]), {
      type: 'opportunity-attack', reactionFeature: 'hunter-giant-killer',
      actorId: 'hunter', targetId: 'giant', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(invalid).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('resolves Hunter Stand Against the Tide as an atomic repeated melee attack', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 15,
      classSelections: { 'superior-hunters-defense': ['stand-against-tide'] },
      classState: { hideInPlainSightPrepared: true },
    })
    const redirectedTarget = fighter('redirected', 5, { controller: 'dm', armorClass: 12 })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('stand-against-tide', [attacker, hunter, redirectedTarget]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'hunter', attackModifier: 5, d20: 2,
        classDamageContext: {
          mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
          damageType: 'slashing', adjacentEnemyOfTarget: false,
        },
        damage: { count: 1, sides: 8, bonus: 3, rolls: [], type: 'slashing' },
        standAgainstTide: {
          targetId: 'redirected', distanceFeet: 5, d20: 10,
          damageRolls: [[6]],
        },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.hunter.currentHp).toBe(20)
    expect(result.state.combatants.redirected.currentHp).toBe(11)
    expect(result.state.combatants.hunter.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.hunter.classState.hideInPlainSightPrepared).toBeUndefined()
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ actorId: 'attacker', targetId: 'hunter', hit: false }),
      expect.objectContaining({ actorId: 'attacker', targetId: 'redirected', hit: true }),
    ])
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'hunter', targetId: 'redirected',
      stateKey: 'stand-against-tide', active: true,
    }))
  })

  it('resolves Berserker Intimidating Presence, frightened penalties, and 24-hour immunity', () => {
    const berserker = fighter('berserker', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 10,
      abilities: { ...abilities, cha: 14 }, position: { x: 0, y: 0 },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', position: { x: 10, y: 0 }, savingThrowBonuses: { wis: 0 },
    })
    const state = startDnd5eHeadlessCombat('intimidating-presence', [berserker, enemy])
    const frightened = resolveDnd5eHeadlessAction(state, {
      type: 'barbarian-intimidating-presence', actorId: 'berserker', targetId: 'enemy', savingThrowD20: 2,
    })
    expect(frightened.ok).toBe(true)
    if (!frightened.ok) return
    expect(frightened.state.combatants.enemy.conditions).toContain('frightened')
    expect(frightened.state.combatants.enemy.classState).toMatchObject({
      intimidatingPresenceSourceId: 'berserker', intimidatingPresenceRoundsRemaining: 2,
    })

    const barbarianEnded = resolveDnd5eHeadlessAction(frightened.state, { type: 'end-turn', actorId: 'berserker' })
    expect(barbarianEnded.ok).toBe(true)
    if (!barbarianEnded.ok) return
    expect(barbarianEnded.state.combatants.enemy.classState.intimidatingPresenceRoundsRemaining).toBe(1)
    const cannotApproach = resolveDnd5eHeadlessAction(barbarianEnded.state, {
      type: 'move', actorId: 'enemy', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(cannotApproach).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const disadvantagedAttack = resolveDnd5eHeadlessAction(barbarianEnded.state, {
      type: 'attack', actorId: 'enemy', targetId: 'berserker', attackModifier: 5,
      d20: 18, d20Second: 2, damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(disadvantagedAttack.ok).toBe(true)
    if (!disadvantagedAttack.ok) return
    expect(disadvantagedAttack.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'enemy', d20: 2, hit: false,
    }))

    const immune = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('intimidating-immunity', [berserker, enemy]),
      { type: 'barbarian-intimidating-presence', actorId: 'berserker', targetId: 'enemy', savingThrowD20: 20 },
    )
    expect(immune.ok).toBe(true)
    if (!immune.ok) return
    expect(immune.state.combatants.enemy.classState.intimidatingPresenceImmunityRoundsBySource?.berserker).toBe(14_400)
    expect(immune.state.combatants.enemy.conditions).not.toContain('frightened')
  })

  it('spends the target reaction and halves one visible attack with Uncanny Dodge', () => {
    const rogue = fighter('rogue', 10, { classId: 'rogue', level: 5 })
    const state = startDnd5eHeadlessCombat('uncanny-dodge', [fighter('enemy', 20), rogue])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'rogue', attackModifier: 20, d20: 10,
      uncannyDodge: true,
      damage: { count: 1, sides: 8, bonus: 1, rolls: [8], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.rogue.currentHp).toBe(16)
    expect(result.state.combatants.rogue.turn.reactionAvailable).toBe(false)
    expect(result.events).toContainEqual({ type: 'turn-resource-spent', actorId: 'rogue', resource: 'reaction' })
  })

  it('uses Fighter Indomitable or Monk Diamond Soul only after a failed saving throw', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 5, abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-cantrips': ['sacred-flame'] },
    })
    const target = fighter('target', 10, {
      controller: 'dm', classId: 'fighter', level: 9,
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('indomitable', [cleric, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'target', spellId: 'sacred-flame', slotLevel: 0,
      savingThrowD20: 1, savingThrowRerollD20: 20, effectRolls: [],
    })
    expect(result.ok ? 'ok' : result.reason).toBe('ok')
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(20)
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'target', stateKey: 'indomitable-reroll', active: true,
    }))
  })

  it('settles death saves and concentration in the authoritative engine', () => {
    const dying = fighter('a', 20, { currentHp: 0, concentrating: true })
    const state = startDnd5eHeadlessCombat('combat', [dying, fighter('b', 10)])
    const deathSave = resolveDnd5eHeadlessAction(state, { type: 'death-save', actorId: 'a', d20: 20 })
    expect(deathSave.ok).toBe(true)
    if (!deathSave.ok) return
    expect(deathSave.state.combatants.a).toMatchObject({ currentHp: 1, deathSaves: { successes: 0, failures: 0 } })
    const concentrating = { ...deathSave.state, combatants: { ...deathSave.state.combatants, a: { ...deathSave.state.combatants.a, concentrating: true } } }
    const concentration = resolveDnd5eHeadlessAction(concentrating, { type: 'concentration-save', actorId: 'a', d20: 4, dc: 10 })
    expect(concentration.ok).toBe(true)
    if (!concentration.ok) return
    expect(concentration.state.combatants.a.concentrating).toBe(false)
  })

  it('applies unconscious and prone at 0 HP and enforces massive-damage instant death', () => {
    const dropped = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('drop-to-zero', [
        fighter('attacker', 20, { controller: 'dm' }),
        fighter('target', 10, { currentHp: 5 }),
      ]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 6, bonus: 0, rolls: [5], type: 'slashing' },
      },
    )
    expect(dropped.ok).toBe(true)
    if (!dropped.ok) return
    expect(dropped.state.combatants.target).toMatchObject({
      currentHp: 0,
      deathSaves: { successes: 0, failures: 0, stable: false, dead: false },
    })
    expect(dropped.state.combatants.target.conditions).toEqual(expect.arrayContaining(['unconscious', 'prone']))
    expect(dropped.state.combatants.target.classState.activeEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ standardCondition: 'unconscious', source: expect.objectContaining({ rulesId: 'zero-hit-points' }) }),
      expect.objectContaining({ standardCondition: 'prone', source: expect.objectContaining({ rulesId: 'zero-hit-points' }) }),
    ]))

    const killed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('massive-damage', [
        fighter('attacker', 20, { controller: 'dm' }),
        fighter('target', 10, { currentHp: 5, maxHp: 20 }),
      ]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 20, bonus: 15, rolls: [10], type: 'slashing' },
      },
    )
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.target.deathSaves).toMatchObject({ failures: 3, dead: true })
    expect(killed.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'attacker', targetId: 'target',
    }))
  })

  it('makes a hit against an unconscious creature within 5 feet critical and applies two death failures', () => {
    const nearby = startDnd5eHeadlessCombat('nearby-unconscious', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, conditions: ['unconscious', 'prone'] }),
    ])
    nearby.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 5 }
    const critical = resolveDnd5eHeadlessAction(nearby, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2, 3], type: 'slashing' },
    })
    expect(critical.ok).toBe(true)
    if (!critical.ok) return
    expect(critical.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', hit: true, critical: true,
    }))
    expect(critical.state.combatants.target.deathSaves.failures).toBe(2)

    const distant = startDnd5eHeadlessCombat('distant-unconscious', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('target', 10, { currentHp: 0, conditions: ['unconscious', 'prone'] }),
    ])
    distant.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('attacker', 'target')]: 10 }
    const ordinary = resolveDnd5eHeadlessAction(distant, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 20,
      d20: 2, d20Second: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(ordinary.ok).toBe(true)
    if (!ordinary.ok) return
    expect(ordinary.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', hit: true, critical: false,
    }))
    expect(ordinary.state.combatants.target.deathSaves.failures).toBe(1)
  })

  it('ends concentration immediately when an incapacitating condition is present', () => {
    const state = startDnd5eHeadlessCombat('incapacitated-concentration', [
      fighter('caster', 20, {
        concentrating: true,
        conditions: ['paralyzed'],
        classState: { concentrationSpellId: 'hold-person', concentrationTargetIds: ['target'] },
      }),
      fighter('target', 10),
    ])
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'caster' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.caster.concentrating).toBe(false)
    expect(result.state.combatants.caster.classState.concentrationSpellId).toBeUndefined()
  })

  it('resolves Zombie Undead Fortitude and bypasses it for radiant or critical damage', () => {
    const zombie = () => fighter('zombie', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:zombie', usesDeathSaves: false,
      abilities: { ...abilities, con: 16 }, currentHp: 3, maxHp: 22,
    })
    const pending = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('undead-fortitude', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'slashing' },
      },
    )
    expect(pending.ok).toBe(true)
    if (!pending.ok) return
    expect(pending.state.combatants.zombie).toMatchObject({
      currentHp: 0, deathSaves: { dead: false },
      classState: { undeadFortitudePending: { dc: 8, damage: 3, sourceId: 'attacker' } },
    })
    expect(pending.events).toContainEqual({
      type: 'undead-fortitude-save-required', targetId: 'zombie', dc: 8, damage: 3,
    })
    const survived = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save', actorId: 'zombie', d20: 10,
    })
    expect(survived.ok).toBe(true)
    if (!survived.ok) return
    expect(survived.state.combatants.zombie).toMatchObject({ currentHp: 1, deathSaves: { dead: false } })
    expect(survived.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const failed = resolveDnd5eHeadlessAction(pending.state, {
      type: 'monster-undead-fortitude-save', actorId: 'zombie', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.zombie).toMatchObject({ currentHp: 0, deathSaves: { dead: true } })
    expect(failed.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const radiant = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('radiant-zombie', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [3], type: 'radiant' },
      },
    )
    expect(radiant.ok).toBe(true)
    if (!radiant.ok) return
    expect(radiant.state.combatants.zombie.deathSaves.dead).toBe(true)
    expect(radiant.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()

    const critical = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('critical-zombie', [fighter('attacker', 20), zombie()]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'zombie', attackModifier: 20, d20: 20,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [1, 2], type: 'slashing' },
      },
    )
    expect(critical.ok).toBe(true)
    if (!critical.ok) return
    expect(critical.state.combatants.zombie.deathSaves.dead).toBe(true)
    expect(critical.state.combatants.zombie.classState.undeadFortitudePending).toBeUndefined()
  })

  it('resolves the Wolf bite Strength save and applies prone on failure', () => {
    const wolf = fighter('wolf', 20, {
      controller: 'dm', statBlockId: 'srd-5.1:wolf', usesDeathSaves: false,
      abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
      currentHp: 11, maxHp: 11,
    })
    const hit = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('wolf-bite', [wolf, fighter('target', 10)]),
      {
        type: 'monster-action', actorId: 'wolf', actionId: 'bite',
        rolls: [{ targetId: 'target', d20: 12, damageRolls: [[2, 3]] }],
      },
    )
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual({
      type: 'monster-on-hit-save-required', targetId: 'target', sourceId: 'wolf',
      actionId: 'bite', ability: 'str', dc: 11, condition: 'prone',
    })
    const failed = resolveDnd5eHeadlessAction(hit.state, {
      type: 'monster-on-hit-save', actorId: 'target', sourceId: 'wolf', actionId: 'bite', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.target.conditions).toContain('prone')
    expect(failed.state.combatants.target.classState.monsterOnHitSavePending).toBeUndefined()
  })

  it('applies active Bless and Bane effects to death saves and rejects forged d4 rolls', () => {
    const blessedDying = fighter('dying', 20, {
      currentHp: 0,
      classState: { concentrationEffectsBySource: { cleric: 'bless' } },
    })
    const cleric = fighter('cleric', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bless', concentrationTargetIds: ['dying'], concentrationRoundsRemaining: 10,
      },
    })
    const blessed = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('blessed-death-save', [blessedDying, cleric]),
      { type: 'death-save', actorId: 'dying', d20: 8, blessRoll: 2 },
    )
    expect(blessed.ok).toBe(true)
    if (!blessed.ok) return
    expect(blessed.state.combatants.dying.deathSaves).toMatchObject({ successes: 1, failures: 0 })

    const banedDying = fighter('dying', 20, {
      currentHp: 0,
      classState: { concentrationEffectsBySource: { bard: 'bane' } },
    })
    const bard = fighter('bard', 10, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bane', concentrationTargetIds: ['dying'], concentrationRoundsRemaining: 10,
      },
    })
    const baned = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('baned-death-save', [banedDying, bard]),
      { type: 'death-save', actorId: 'dying', d20: 10, baneRoll: 1 },
    )
    expect(baned.ok).toBe(true)
    if (!baned.ok) return
    expect(baned.state.combatants.dying.deathSaves).toMatchObject({ successes: 0, failures: 1 })

    const forged = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('forged-death-save', [fighter('dying', 20, { currentHp: 0 }), fighter('ally', 10)]),
      { type: 'death-save', actorId: 'dying', d20: 8, blessRoll: 4 },
    )
    expect(forged).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('resolves concentration saves off-turn from authoritative Constitution bonuses', () => {
    const state = startDnd5eHeadlessCombat('concentration', [
      fighter('attacker', 20),
      fighter('caster', 10, { concentrating: true, savingThrowBonuses: { con: 6 }, exhaustionLevel: 3 }),
    ])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'caster', d20: 18, d20Second: 2, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual({
      type: 'concentration-resolved', actorId: 'caster', d20: 2, total: 8, dc: 10, success: false,
    })
    expect(result.state.combatants.caster.concentrating).toBe(false)
  })

  it('lets Diamond Soul reroll a failed concentration save and consumes one Ki', () => {
    const monk = fighter('monk', 10, {
      classId: 'monk', level: 14, concentrating: true,
      classResources: { 'dnd5e-ki': { current: 1, max: 14 } },
      savingThrowBonuses: { con: 7 },
    })
    const state = startDnd5eHeadlessCombat('diamond-soul-concentration', [fighter('attacker', 20), monk])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'monk', d20: 1, rerollD20: 20, dc: 15,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.concentrating).toBe(true)
    expect(result.state.combatants.monk.classResources['dnd5e-ki']).toEqual({ current: 0, max: 14 })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'monk', stateKey: 'diamond-soul-reroll', active: true,
    }))
  })

  it('lets Indomitable replace a failed Stunning Strike save before the condition is applied', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', classId: 'fighter', level: 9,
      classResources: { fighterIndomitable: { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('indomitable-stunning-strike', [monk, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'monk', targetId: 'target', attackModifier: 20, d20: 10,
      stunningStrikeSaveD20: 1,
      stunningStrikeSaveRerollD20: 20,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false, stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.stunnedByActorId).toBeUndefined()
    expect(result.state.combatants.target.classResources.fighterIndomitable.current).toBe(0)
    expect(result.state.combatants.monk.classResources['dnd5e-ki'].current).toBe(0)
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'target', d20: 20, success: true,
    }))
  })

  it('applies Bane to a Stunning Strike Constitution save in Headless', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 5,
      classResources: { 'dnd5e-ki': { current: 1, max: 5 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm',
      classState: { concentrationEffectsBySource: { bard: 'bane' } },
    })
    const bard = fighter('bard', 1, {
      concentrating: true,
      classState: {
        concentrationSpellId: 'bane', concentrationTargetIds: ['target'], concentrationRoundsRemaining: 10,
      },
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('baned-stunning-strike', [monk, target, bard]), {
      type: 'attack', actorId: 'monk', targetId: 'target', attackModifier: 20, d20: 10,
      stunningStrikeSaveD20: 10, stunningStrikeSaveBaneRoll: 2,
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 6,
        damageType: 'bludgeoning', adjacentEnemyOfTarget: false, stunningStrike: true,
      },
      damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'bludgeoning' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.classState.stunnedByActorId).toBe('monk')
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'target', modifier: 0, total: 10, success: false,
    }))
  })

  it('spends SRD class resources and turn economy atomically without AP', () => {
    const barbarian = fighter('a', 20, { classResources: { 'dnd5e-rage': { current: 2, max: 2 } } })
    const state = startDnd5eHeadlessCombat('combat', [barbarian, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'class-resource-use', actorId: 'a', resourceKey: 'dnd5e-rage', turnResource: 'bonusAction',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.classResources['dnd5e-rage']).toEqual({ current: 1, max: 2 })
    expect(result.state.combatants.a.turn.bonusActionAvailable).toBe(false)
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'class-resource-spent', resourceKey: 'dnd5e-rage', current: 1 }))
    expect(JSON.stringify(result)).not.toMatch(/actionPoints|currentAP|ap-spent/)

    const legacy = resolveDnd5eHeadlessAction(state, {
      type: 'class-resource-use', actorId: 'a', resourceKey: 'legacy-ki', turnResource: 'bonusAction',
    })
    expect(legacy).toMatchObject({ ok: false, reason: 'class-resource-unavailable' })
  })

  it('resolves barbarian Rage, physical resistance, and its end condition in Headless', () => {
    const barbarian = fighter('a', 20, { classId: 'barbarian', classResources: { 'dnd5e-rage': { current: 2, max: 2 } } })
    const state = startDnd5eHeadlessCombat('combat', [barbarian, fighter('b', 10)])
    const raged = resolveDnd5eHeadlessAction(state, { type: 'barbarian-rage', actorId: 'a' })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    expect(raged.state.combatants.a).toMatchObject({ classState: { raging: true, rageTurnsRemaining: 10 }, turn: { bonusActionAvailable: false } })
    const hit = resolveDnd5eHeadlessAction(raged.state, {
      type: 'opportunity-attack', actorId: 'b', targetId: 'a', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [8], type: 'bludgeoning' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.a.currentHp).toBe(16)
    const ended = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState).toMatchObject({ raging: true, rageTurnsRemaining: 9, rageSustainedThisTurn: false })

    const fresh = startDnd5eHeadlessCombat('fresh', [barbarian, fighter('b', 10)])
    const unsustained = resolveDnd5eHeadlessAction(fresh, { type: 'barbarian-rage', actorId: 'a' })
    expect(unsustained.ok).toBe(true)
    if (!unsustained.ok) return
    const expired = resolveDnd5eHeadlessAction(unsustained.state, { type: 'end-turn', actorId: 'a' })
    expect(expired.ok).toBe(true)
    if (!expired.ok) return
    expect(expired.state.combatants.a.classState.raging).toBeUndefined()
  })

  it('keeps a level-15 Barbarian raging without attacking or taking damage', () => {
    const barbarian = fighter('a', 20, {
      classId: 'barbarian', level: 15,
      classResources: { 'dnd5e-rage': { current: 5, max: 5 } },
    })
    const state = startDnd5eHeadlessCombat('persistent-rage', [barbarian, fighter('b', 10)])
    const raged = resolveDnd5eHeadlessAction(state, { type: 'barbarian-rage', actorId: 'a' })
    expect(raged.ok).toBe(true)
    if (!raged.ok) return
    const ended = resolveDnd5eHeadlessAction(raged.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState).toMatchObject({ raging: true, rageTurnsRemaining: 9 })
  })

  it('ends Rage immediately at 0 HP and applies Frenzy exhaustion once', () => {
    const barbarian = fighter('barbarian', 10, {
      classId: 'barbarian', subclassId: 'berserker', level: 10, currentHp: 5,
      classState: { raging: true, rageTurnsRemaining: 10, frenzying: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('rage-unconscious', [fighter('enemy', 20, { controller: 'dm' }), barbarian]),
      {
        type: 'attack', actorId: 'enemy', targetId: 'barbarian', attackModifier: 20, d20: 10,
        damage: { count: 1, sides: 12, bonus: 0, rolls: [12], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.barbarian).toMatchObject({
      currentHp: 0, exhaustionLevel: 1,
      classState: { raging: undefined, frenzying: undefined, rageTurnsRemaining: undefined },
    })
    expect(result.events.filter((event) => event.type === 'exhaustion-gained')).toEqual([
      { type: 'exhaustion-gained', actorId: 'barbarian', level: 1 },
    ])
  })

  it('lets a Barbarian end an active Rage with a bonus action', () => {
    const barbarian = fighter('barbarian', 20, {
      classId: 'barbarian', subclassId: 'berserker', level: 3,
      classState: { raging: true, rageTurnsRemaining: 8, frenzying: true },
    })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('end-rage', [barbarian, fighter('enemy', 10)]),
      { type: 'barbarian-rage', actorId: 'barbarian', end: true },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.barbarian).toMatchObject({
      exhaustionLevel: 1,
      turn: { bonusActionAvailable: false },
      classState: { raging: undefined, frenzying: undefined, rageTurnsRemaining: undefined },
    })
    expect(result.events).toContainEqual({
      type: 'turn-resource-spent', actorId: 'barbarian', resource: 'bonusAction',
    })
  })

  it('grants bardic inspiration to another combatant using a bonus action', () => {
    const bard = fighter('a', 20, { level: 10, classId: 'bard', classResources: { 'dnd5e-bardic-inspiration': { current: 4, max: 4 } } })
    const state = startDnd5eHeadlessCombat('combat', [bard, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'bardic-inspiration', actorId: 'a', targetId: 'b' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.b.classState).toMatchObject({
      bardicInspirationDie: 10,
      bardicInspirationSourceId: 'a',
      bardicInspirationRoundsRemaining: 100,
    })
    expect(result.state.combatants.a.classResources['dnd5e-bardic-inspiration'].current).toBe(3)
  })

  it('lets a Lore Bard spend a reaction and inspiration die to reduce an attack roll', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 3, max: 4 } },
    })
    const target = fighter('target', 10)
    const state = startDnd5eHeadlessCombat('cutting-words', [attacker, bard, target])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'attacker', targetId: 'target', total: 13, hit: false,
    }))
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration']).toEqual({ current: 2, max: 4 })
    expect(result.state.combatants.target.currentHp).toBe(20)
  })

  it('applies Cutting Words to a damage roll before damage resistance', () => {
    const attacker = fighter('attacker', 20, { controller: 'dm' })
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 3 } },
    })
    const target = fighter('target', 10, { damageResistances: ['slashing'] })
    const result = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('cutting-damage', [attacker, bard, target]),
      {
        type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 15,
        cuttingWordsDamage: { bardId: 'bard', roll: 3, distanceFeet: 30 },
        damage: { count: 1, sides: 8, bonus: 3, rolls: [8], type: 'slashing' },
      },
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target.currentHp).toBe(16)
    expect(result.state.combatants.bard.turn.reactionAvailable).toBe(false)
    expect(result.state.combatants.bard.classResources['dnd5e-bardic-inspiration'].current).toBe(1)
  })

  it('does not let Cutting Words cancel a natural 20 or affect a creature that cannot hear it', () => {
    const bard = fighter('bard', 15, {
      classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const criticalState = startDnd5eHeadlessCombat('cutting-words-critical', [fighter('attacker', 20, { controller: 'dm' }), bard, fighter('target', 10)])
    const critical = resolveDnd5eHeadlessAction(criticalState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 20,
      cuttingWords: { bardId: 'bard', roll: 8, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4, 4] },
    })
    expect(critical.ok).toBe(true)
    if (critical.ok) expect(critical.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', hit: true, critical: true, total: 17 }))

    const deafState = startDnd5eHeadlessCombat('cutting-words-deaf', [
      fighter('attacker', 20, { controller: 'dm', conditions: ['耳聋'] }), bard, fighter('target', 10),
    ])
    expect(resolveDnd5eHeadlessAction(deafState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const silencedState = startDnd5eHeadlessCombat('cutting-words-silenced', [
      fighter('attacker', 20, { controller: 'dm' }),
      fighter('bard', 15, {
        classId: 'bard', subclassId: 'lore', level: 5, conditions: ['沉默'],
        classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
      }),
      fighter('target', 10),
    ])
    expect(resolveDnd5eHeadlessAction(silencedState, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('applies Cutting Words before Stroke of Luck turns the resulting miss into a hit', () => {
    const attacker = fighter('attacker', 20, {
      classId: 'rogue', level: 20,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    const bard = fighter('bard', 15, {
      controller: 'dm', classId: 'bard', subclassId: 'lore', level: 5,
      classResources: { 'dnd5e-bardic-inspiration': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('cutting-words-before-stroke', [attacker, bard, fighter('target', 10, { controller: 'dm' })])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'attacker', targetId: 'target', attackModifier: 5, d20: 11,
      cuttingWords: { bardId: 'bard', roll: 3, distanceFeet: 30 },
      strokeOfLuck: true,
      damage: { count: 1, sides: 8, bonus: 3, rolls: [4] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'attacker', targetId: 'target', total: 13, hit: true,
    }))
    expect(result.state.combatants.attacker.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('starts Countercharm with an action and keeps it through the end of the activation turn', () => {
    const bard = fighter('a', 20, { level: 6, classId: 'bard' })
    const state = startDnd5eHeadlessCombat('countercharm', [bard, fighter('b', 10)])
    const started = resolveDnd5eHeadlessAction(state, { type: 'bard-countercharm', actorId: 'a' })
    expect(started.ok).toBe(true)
    if (!started.ok) return
    expect(started.state.combatants.a).toMatchObject({
      turn: { actionAvailable: false }, classState: { countercharmRoundsRemaining: 2 },
    })
    const ended = resolveDnd5eHeadlessAction(started.state, { type: 'end-turn', actorId: 'a' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.a.classState.countercharmRoundsRemaining).toBe(1)

    const locked = resolveDnd5eHeadlessAction(
      startDnd5eHeadlessCombat('countercharm-locked', [fighter('a', 20, { level: 5, classId: 'bard' }), fighter('b', 10)]),
      { type: 'bard-countercharm', actorId: 'a' },
    )
    expect(locked).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('adds and consumes a held Bardic Inspiration die on an attack roll', () => {
    const inspired = fighter('a', 20, {
      classState: { bardicInspirationDie: 6, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 100 },
    })
    const state = startDnd5eHeadlessCombat('bardic-attack', [inspired, fighter('b', 12)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 2,
      d20: 9, bardicInspirationRoll: 5,
      damage: { count: 1, sides: 8, bonus: 2, rolls: [5], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', total: 16, hit: true,
    }))
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
    expect(result.state.combatants.a.classState.bardicInspirationSourceId).toBeUndefined()
    expect(result.state.combatants.b.currentHp).toBe(13)
  })

  it('adds and consumes Bardic Inspiration on saving throws before a class reroll', () => {
    const inspired = fighter('a', 20, {
      concentrating: true,
      classState: { bardicInspirationDie: 8, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 100 },
    })
    const state = startDnd5eHeadlessCombat('bardic-save', [inspired, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'a', d20: 5, bardicInspirationRoll: 3, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: 'a', total: 10, success: true,
    }))
    expect(result.state.combatants.a.concentrating).toBe(true)
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
  })

  it("adds the Fiend warlock's Dark One's Own Luck d10 to a saving throw and consumes its short-rest use", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6, concentrating: true,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('dark-ones-own-luck', [warlock, fighter('enemy', 10)])
    expect(dnd5eDarkOnesOwnLuckAvailable(state.combatants.warlock)).toBe(true)
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 3, dc: 10,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'concentration-resolved', actorId: 'warlock', total: 10, success: true,
    }))
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'warlock', stateKey: 'dark-ones-own-luck', active: true, value: 3,
    }))
    expect(result.state.combatants.warlock.classResources['dnd5e-dark-ones-own-luck'].current).toBe(0)
    expect(dnd5eDarkOnesOwnLuckAvailable(result.state.combatants.warlock)).toBe(false)
  })

  it("rejects Dark One's Own Luck when the subclass, resource, or d10 result is invalid", () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6, concentrating: true,
      classResources: { 'dnd5e-dark-ones-own-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('dark-ones-own-luck-invalid', [warlock, fighter('enemy', 10)])
    const invalidDie = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 11, dc: 10,
    })
    expect(invalidDie).toMatchObject({ ok: false, reason: 'invalid-dice' })

    state.combatants.warlock.subclassId = 'other'
    const invalidSubclass = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'warlock', d20: 5, darkOnesOwnLuckRoll: 3, dc: 10,
    })
    expect(invalidSubclass).toMatchObject({ ok: false, reason: 'invalid-dice' })
  })

  it('keeps Hurl Through Hell readied across a miss, then returns the hit target at the end of the warlock next turn', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 14,
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, { controller: 'dm', currentHp: 100, maxHp: 100 })
    const state = startDnd5eHeadlessCombat('hurl-through-hell', [warlock, target])
    const readied = resolveDnd5eHeadlessAction(state, {
      type: 'warlock-hurl-through-hell-ready', actorId: 'warlock', active: true,
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return

    const missed = resolveDnd5eHeadlessAction(readied.state, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 0, d20: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [] },
    })
    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.state.combatants.warlock.classState.hurlThroughHellReady).toBe(true)
    expect(missed.state.combatants.warlock.classResources['dnd5e-hurl-through-hell'].current).toBe(1)

    missed.state.combatants.warlock.turn.actionAvailable = true
    const hit = resolveDnd5eHeadlessAction(missed.state, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 20, d20: 10,
      hurlThroughHellDamageRolls: Array(10).fill(5),
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.warlock.classResources['dnd5e-hurl-through-hell'].current).toBe(0)
    expect(hit.state.combatants.target).toMatchObject({
      currentHp: 99,
      classState: { hurlThroughHellSourceId: 'warlock', hurlThroughHellDamage: 50 },
    })
    expect(hit.state.combatants.target.conditions).toContain('banished')

    const currentTurnEnded = resolveDnd5eHeadlessAction(hit.state, { type: 'end-turn', actorId: 'warlock' })
    expect(currentTurnEnded.ok).toBe(true)
    if (!currentTurnEnded.ok) return
    expect(currentTurnEnded.state.combatants.target.conditions).toContain('banished')

    const targetTurnEnded = resolveDnd5eHeadlessAction(currentTurnEnded.state, { type: 'end-turn', actorId: 'target' })
    expect(targetTurnEnded.ok).toBe(true)
    if (!targetTurnEnded.ok) return
    const returned = resolveDnd5eHeadlessAction(targetTurnEnded.state, { type: 'end-turn', actorId: 'warlock' })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.target.currentHp).toBe(49)
    expect(returned.state.combatants.target.conditions).not.toContain('banished')
    expect(returned.state.combatants.target.classState.hurlThroughHellSourceId).toBeUndefined()
    expect(returned.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'warlock', targetId: 'target', amount: 50,
    }))
  })

  it('triggers Hurl Through Hell on a spell attack but deals no return damage to a fiend', () => {
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 14,
      classSelections: { 'spell-cantrips': ['chill-touch'] },
      classResources: { 'dnd5e-hurl-through-hell': { current: 1, max: 1 } },
    })
    const fiend = fighter('fiend', 10, {
      controller: 'dm', currentHp: 100, maxHp: 100, creatureType: 'fiend', armorClass: 10,
    })
    const state = startDnd5eHeadlessCombat('hurl-through-hell-spell', [warlock, fiend])
    const readied = resolveDnd5eHeadlessAction(state, {
      type: 'warlock-hurl-through-hell-ready', actorId: 'warlock', active: true,
    })
    expect(readied.ok).toBe(true)
    if (!readied.ok) return
    const cast = resolveDnd5eHeadlessAction(readied.state, {
      type: 'cast-spell', actorId: 'warlock', targetId: 'fiend', spellId: 'chill-touch', slotLevel: 0,
      d20: 20, effectRolls: [1, 1, 1, 1, 1, 1], hurlThroughHellDamageRolls: Array(10).fill(10),
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    const hpAfterSpell = cast.state.combatants.fiend.currentHp
    const currentTurnEnded = resolveDnd5eHeadlessAction(cast.state, { type: 'end-turn', actorId: 'warlock' })
    expect(currentTurnEnded.ok).toBe(true)
    if (!currentTurnEnded.ok) return
    const fiendTurnEnded = resolveDnd5eHeadlessAction(currentTurnEnded.state, { type: 'end-turn', actorId: 'fiend' })
    expect(fiendTurnEnded.ok).toBe(true)
    if (!fiendTurnEnded.ok) return
    const returned = resolveDnd5eHeadlessAction(fiendTurnEnded.state, { type: 'end-turn', actorId: 'warlock' })
    expect(returned.ok).toBe(true)
    if (!returned.ok) return
    expect(returned.state.combatants.fiend.currentHp).toBe(hpAfterSpell)
    expect(returned.state.combatants.fiend.conditions).not.toContain('banished')
  })

  it('expires an unused Bardic Inspiration die after its remaining duration', () => {
    const inspired = fighter('a', 20, {
      classState: { bardicInspirationDie: 6, bardicInspirationSourceId: 'bard', bardicInspirationRoundsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('bardic-expiry', [inspired, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'a' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.a.classState.bardicInspirationDie).toBeUndefined()
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'a', stateKey: 'bardic-inspiration', active: false,
    }))
  })

  it('lets a level-20 Rogue turn a missed attack into a hit with Stroke of Luck', () => {
    const rogue = fighter('a', 20, {
      classId: 'rogue', level: 20,
      classResources: { 'dnd5e-stroke-of-luck': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('stroke-of-luck', [rogue, fighter('b', 10)])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0,
      d20: 1, strokeOfLuck: true,
      damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'piercing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', hit: true, critical: false,
    }))
    expect(result.state.combatants.b.currentHp).toBe(16)
    expect(result.state.combatants.a.classResources['dnd5e-stroke-of-luck'].current).toBe(0)
  })

  it('applies Foe Slayer once per turn against a selected favored enemy', () => {
    const ranger = fighter('a', 20, {
      classId: 'ranger', level: 20,
      classSelections: { 'favored-enemy': ['favored-亡灵'] },
    })
    const undead = fighter('b', 10, { armorClass: 11, creatureType: '亡灵' })
    const state = startDnd5eHeadlessCombat('foe-slayer', [ranger, undead])
    const context = {
      mode: 'melee' as const,
      finesse: false,
      strengthBased: true,
      weaponDamageSides: 8,
      damageType: 'slashing' as const,
      adjacentEnemyOfTarget: false,
      foeSlayer: 'attack' as const,
    }
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'a', targetId: 'b', attackModifier: 0, d20: 10,
      classDamageContext: context,
      classDamageRolls: [],
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'a', total: 11, hit: true,
    }))
    expect(result.state.combatants.a.classState.foeSlayerTurnKey).toBe('foe-slayer:1:a')
  })

  it('resolves Lay on Hands, Wholeness of Body, and Preserve Life with rule caps', () => {
    const paladin = fighter('p', 20, { classId: 'paladin', classResources: { 'dnd5e-lay-on-hands': { current: 25, max: 25 } } })
    const wounded = fighter('w', 10, { currentHp: 5 })
    const paladinState = startDnd5eHeadlessCombat('paladin', [paladin, wounded])
    const lay = resolveDnd5eHeadlessAction(paladinState, { type: 'paladin-lay-on-hands', actorId: 'p', targetId: 'w', amount: 7 })
    expect(lay.ok).toBe(true)
    if (!lay.ok) return
    expect(lay.state.combatants.w.currentHp).toBe(12)
    expect(lay.state.combatants.p.classResources['dnd5e-lay-on-hands'].current).toBe(18)

    const monk = fighter('m', 20, { level: 6, classId: 'monk', subclassId: 'open-hand', currentHp: 1, maxHp: 30, classResources: { 'dnd5e-wholeness-of-body': { current: 1, max: 1 } } })
    const monkState = startDnd5eHeadlessCombat('monk', [monk, fighter('x', 10)])
    const whole = resolveDnd5eHeadlessAction(monkState, { type: 'monk-wholeness-of-body', actorId: 'm' })
    expect(whole.ok).toBe(true)
    if (!whole.ok) return
    expect(whole.state.combatants.m.currentHp).toBe(19)

    const cleric = fighter('c', 20, { level: 5, classId: 'cleric', subclassId: 'life', classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } } })
    const ally = fighter('y', 10, { currentHp: 2, maxHp: 20 })
    const clericState = startDnd5eHeadlessCombat('cleric', [cleric, ally])
    const preserve = resolveDnd5eHeadlessAction(clericState, { type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'y', amount: 8 }] })
    expect(preserve.ok).toBe(true)
    if (!preserve.ok) return
    expect(preserve.state.combatants.y.currentHp).toBe(10)
    const overHalf = resolveDnd5eHeadlessAction(clericState, { type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'y', amount: 9 }] })
    expect(overHalf).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const undead = fighter('u', 10, { currentHp: 2, maxHp: 20, creatureType: '亡灵' })
    const undeadState = startDnd5eHeadlessCombat('cleric-undead', [cleric, undead])
    expect(resolveDnd5eHeadlessAction(undeadState, {
      type: 'cleric-preserve-life', actorId: 'c', allocations: [{ targetId: 'u', amount: 8 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('enforces Turn Undead movement, action, reaction, and damage-ending rules in Headless', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 2, abilities: { ...abilities, wis: 16 }, position: { x: 0, y: 0 },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const skeleton = fighter('skeleton', 10, {
      controller: 'dm', creatureType: '亡灵', challengeRating: 0.25,
      position: { x: 30, y: 0 }, savingThrowBonuses: { wis: -1 },
    })
    const state = startDnd5eHeadlessCombat('turn-undead', [cleric, skeleton])
    const turned = resolveDnd5eHeadlessAction(state, {
      type: 'cleric-turn-undead', actorId: 'cleric', targets: [{ targetId: 'skeleton', d20: 1 }],
    })
    expect(turned.ok).toBe(true)
    if (!turned.ok) return
    expect(turned.state.combatants.skeleton.classState).toMatchObject({
      turnedByClericId: 'cleric', turnedRoundsRemaining: 10,
    })
    expect(turned.state.combatants.skeleton.conditions).toContain('turned')
    expect(turned.state.combatants.cleric.classResources['dnd5e-channel-divinity'].current).toBe(0)

    const clericEnded = resolveDnd5eHeadlessAction(turned.state, { type: 'end-turn', actorId: 'cleric' })
    expect(clericEnded.ok).toBe(true)
    if (!clericEnded.ok) return
    expect(resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'attack', actorId: 'skeleton', targetId: 'cleric', attackModifier: 4, d20: 20,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [6, 6] },
    })).toMatchObject({ ok: false, reason: 'invalid-actor' })
    expect(resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'move', actorId: 'skeleton', to: { x: 20, y: 0 }, distance: 10,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const fled = resolveDnd5eHeadlessAction(clericEnded.state, {
      type: 'move', actorId: 'skeleton', to: { x: 50, y: 0 }, distance: 20,
    })
    expect(fled.ok).toBe(true)

    const damageState = startDnd5eHeadlessCombat('turn-undead-damage', [
      fighter('attacker', 20),
      fighter('undead', 10, {
        controller: 'dm', creatureType: '亡灵',
        classState: { turnedByClericId: 'cleric', turnedRoundsRemaining: 10 }, conditions: ['turned'],
      }),
    ])
    const damaged = resolveDnd5eHeadlessAction(damageState, {
      type: 'attack', actorId: 'attacker', targetId: 'undead', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.undead.classState.turnedByClericId).toBeUndefined()
    expect(damaged.state.combatants.undead.conditions).not.toContain('turned')
  })

  it('rejects a forged Turn Undead target that is not undead', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 2,
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const state = startDnd5eHeadlessCombat('forged-turn-undead', [cleric, fighter('humanoid', 10, { controller: 'dm' })])
    expect(resolveDnd5eHeadlessAction(state, {
      type: 'cleric-turn-undead', actorId: 'cleric', targets: [{ targetId: 'humanoid', d20: 1 }],
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('ends the caster concentration when Cleansing Touch removes its final affected target', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 14,
      classResources: { 'dnd5e-cleansing-touch': { current: 1, max: 1 } },
      classState: { concentrationEffectsBySource: { caster: 'shield-of-faith' } },
    })
    const caster = fighter('caster', 15, {
      classId: 'cleric', concentrating: true,
      classState: {
        concentrationSpellId: 'shield-of-faith',
        concentrationTargetIds: ['paladin'],
        concentrationRoundsRemaining: 100,
      },
    })
    const state = startDnd5eHeadlessCombat('cleansing-touch', [paladin, caster])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'paladin-cleansing-touch', actorId: 'paladin', targetId: 'paladin',
      sourceId: 'caster', spellId: 'shield-of-faith',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.paladin).toMatchObject({
      classResources: { 'dnd5e-cleansing-touch': { current: 0, max: 1 } },
      turn: { actionAvailable: false },
      classState: { concentrationEffectsBySource: undefined },
    })
    expect(result.state.combatants.caster).toMatchObject({
      concentrating: false,
      classState: { concentrationSpellId: undefined, concentrationTargetIds: undefined },
    })
  })

  it('spends five Lay on Hands points to cure disease or neutralize poison', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', level: 5,
      classResources: { 'dnd5e-lay-on-hands': { current: 10, max: 25 } },
    })
    const ally = fighter('ally', 10, { conditions: ['疾病', '中毒'] })
    const disease = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('lay-cure', [paladin, ally]), {
      type: 'paladin-lay-on-hands', actorId: 'paladin', targetId: 'ally', cure: 'disease',
    })
    expect(disease.ok).toBe(true)
    if (!disease.ok) return
    expect(disease.state.combatants.ally.conditions).toEqual(['中毒'])
    expect(disease.state.combatants.paladin.classResources['dnd5e-lay-on-hands'].current).toBe(5)
    expect(disease.events).toContainEqual({ type: 'condition-ended', targetId: 'ally', condition: '疾病' })

    const undead = fighter('undead', 10, { creatureType: '亡灵', conditions: ['中毒'] })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('lay-undead', [paladin, undead]), {
      type: 'paladin-lay-on-hands', actorId: 'paladin', targetId: 'undead', cure: 'poisoned',
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('turns fiends and undead with the Devotion Channel Divinity without Destroy Undead', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 5, abilities: { ...abilities, cha: 16 },
      classResources: { 'dnd5e-channel-divinity': { current: 1, max: 1 } },
    })
    const fiend = fighter('fiend', 10, { controller: 'dm', creatureType: '邪魔', challengeRating: 0.25 })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('turn-unholy', [paladin, fiend]), {
      type: 'paladin-turn-the-unholy', actorId: 'paladin', targets: [{ targetId: 'fiend', d20: 1 }],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.fiend).toMatchObject({
      currentHp: 20,
      classState: { turnedByClericId: 'paladin', turnedRoundsRemaining: 10 },
    })
    expect(result.events).toContainEqual({ type: 'unholy-turned', actorId: 'paladin', targetId: 'fiend', rounds: 10 })
  })

  it('resolves Divine Intervention chance, automatic success, and seven-day lockout', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', level: 10,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const success = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('intervention', [cleric, fighter('enemy', 10)]), {
      type: 'cleric-divine-intervention', actorId: 'cleric', d100: 10,
    })
    expect(success.ok).toBe(true)
    if (!success.ok) return
    expect(success.state.combatants.cleric.classState.divineInterventionCooldownDays).toBe(7)
    expect(success.events).toContainEqual({
      type: 'divine-intervention-resolved', actorId: 'cleric', d100: 10,
      success: true, automatic: false, cooldownDays: 7,
    })

    const highCleric = fighter('high-cleric', 20, {
      classId: 'cleric', level: 20,
      classResources: { 'dnd5e-divine-intervention': { current: 1, max: 1 } },
    })
    const automatic = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('intervention-20', [highCleric, fighter('enemy', 10)]), {
      type: 'cleric-divine-intervention', actorId: 'high-cleric',
    })
    expect(automatic.ok).toBe(true)
    if (!automatic.ok) return
    expect(automatic.events).toContainEqual({
      type: 'divine-intervention-resolved', actorId: 'high-cleric', d100: undefined,
      success: true, automatic: true, cooldownDays: 7,
    })
  })

  it('applies Holy Nimbus radiant damage at an enemy turn start and tracks duration', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 20,
      classResources: { 'dnd5e-holy-nimbus': { current: 1, max: 1 } },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm', holyNimbusSourceIds: ['paladin'] })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('holy-nimbus', [paladin, enemy]), {
      type: 'paladin-holy-nimbus', actorId: 'paladin',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    const ended = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'paladin' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.paladin.classState.holyNimbusRoundsRemaining).toBe(9)
    expect(ended.state.combatants.enemy.currentHp).toBe(10)
    expect(ended.events).toContainEqual(expect.objectContaining({
      type: 'damage-applied', sourceId: 'paladin', targetId: 'enemy', amount: 10,
    }))
  })

  it('toggles Draconic Wings as a bonus action and rejects unmodified armor', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 14,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('wings', [sorcerer, fighter('enemy', 10)]), {
      type: 'sorcerer-draconic-wings', actorId: 'sorcerer', active: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.sorcerer).toMatchObject({
      classState: { draconicWingsActive: true }, turn: { bonusActionAvailable: false },
    })

    const armored = fighter('armored', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 14, wearingArmor: true,
    })
    expect(resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('armored-wings', [armored, fighter('enemy', 10)]), {
      type: 'sorcerer-draconic-wings', actorId: 'armored', active: true,
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  })

  it('runs Draconic Presence saves at turn start and ends its conditions with concentration', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 18, proficiencyBonus: 6,
      abilities: { ...abilities, cha: 18 },
      classResources: { 'dnd5e-sorcery-points': { current: 18, max: 18 } },
    })
    const enemy = fighter('enemy', 10, {
      controller: 'dm', draconicPresenceSourceIds: ['sorcerer'], savingThrowBonuses: { wis: 0 },
    })
    const activated = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('presence', [sorcerer, enemy]), {
      type: 'sorcerer-draconic-presence', actorId: 'sorcerer', mode: 'fear',
    })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.state.combatants.sorcerer).toMatchObject({
      concentrating: true,
      classResources: { 'dnd5e-sorcery-points': { current: 13, max: 18 } },
      classState: { concentrationSpellId: 'class:draconic-presence:fear', concentrationRoundsRemaining: 10 },
    })
    const turnStarted = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(turnStarted.ok).toBe(true)
    if (!turnStarted.ok) return
    expect(turnStarted.events).toContainEqual({
      type: 'draconic-presence-save-required', targetId: 'enemy', sourceId: 'sorcerer', mode: 'fear', dc: 18,
    })
    const failed = resolveDnd5eHeadlessAction(turnStarted.state, {
      type: 'sorcerer-draconic-presence-save', actorId: 'enemy', sourceId: 'sorcerer', d20: 1,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.enemy.conditions).toContain('frightened')
    expect(failed.state.combatants.enemy.classState.concentrationEffectsBySource).toEqual({
      sorcerer: 'class:draconic-presence:fear',
    })

    const concentrationEnded = resolveDnd5eHeadlessAction(failed.state, {
      type: 'concentration-save', actorId: 'sorcerer', d20: 1, dc: 10,
    })
    expect(concentrationEnded.ok).toBe(true)
    if (!concentrationEnded.ok) return
    expect(concentrationEnded.state.combatants.sorcerer.concentrating).toBe(false)
    expect(concentrationEnded.state.combatants.enemy.conditions).not.toContain('frightened')
  })

  it('converts sorcery points and spell slots in both directions as bonus actions', () => {
    const sorcerer = fighter('s', 20, { classId: 'sorcerer', level: 5, classResources: {
      'dnd5e-sorcery-points': { current: 5, max: 5 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
    } })
    const state = startDnd5eHeadlessCombat('create', [sorcerer, fighter('x', 10)])
    const created = resolveDnd5eHeadlessAction(state, { type: 'sorcerer-create-spell-slot', actorId: 's', slotLevel: 2 })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.state.combatants.s.classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 2, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    })

    const convertSorcerer = fighter('s', 20, { classId: 'sorcerer', level: 5, classResources: {
      'dnd5e-sorcery-points': { current: 1, max: 5 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
    } })
    const convertState = startDnd5eHeadlessCombat('convert', [convertSorcerer, fighter('x', 10)])
    const converted = resolveDnd5eHeadlessAction(convertState, { type: 'sorcerer-convert-spell-slot', actorId: 's', slotLevel: 2 })
    expect(converted.ok).toBe(true)
    if (!converted.ok) return
    expect(converted.state.combatants.s.classResources).toMatchObject({
      'dnd5e-sorcery-points': { current: 3, max: 5 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
    })
  })

  it('keeps Hunter\'s Mark in concentration state and adds 1d6 to weapon hits', () => {
    const ranger = fighter('r', 20, {
      classId: 'ranger', level: 5,
      classSelections: { 'spell-known': ['hunters-mark'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 4, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('hunters-mark', [ranger, fighter('target', 10, { controller: 'dm' })])
    const marked = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'r', targetId: 'target', spellId: 'hunters-mark', slotLevel: 1,
      effectRolls: [],
    })
    expect(marked.ok).toBe(true)
    if (!marked.ok) return
    expect(marked.state.combatants.r).toMatchObject({
      concentrating: true,
      classState: { huntersMarkTargetId: 'target' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
      turn: { actionAvailable: true, bonusActionAvailable: false },
    })

    const hit = resolveDnd5eHeadlessAction(marked.state, {
      type: 'attack', actorId: 'r', targetId: 'target', attackModifier: 5, d20: 15,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'hunters-mark', rolls: [4] }],
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.state.combatants.target.currentHp).toBe(11)
    expect(hit.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'r', targetId: 'target', source: 'hunters-mark', amount: 4,
    })
  })

  it('moves Hunter\'s Mark from a defeated target without spending another spell slot', () => {
    const ranger = fighter('r', 20, {
      classId: 'ranger', level: 5, concentrating: true,
      classState: { huntersMarkTargetId: 'old' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('move-hunters-mark', [
      ranger,
      fighter('old', 10, { controller: 'dm', currentHp: 0 }),
      fighter('next', 5, { controller: 'dm' }),
    ])
    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'ranger-move-hunters-mark', actorId: 'r', targetId: 'next',
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.r).toMatchObject({
      concentrating: true,
      classState: { huntersMarkTargetId: 'next' },
      classResources: { 'dnd5e-spell-slot-1': { current: 3, max: 4 } },
      turn: { bonusActionAvailable: false },
    })
  })

  it('resolves Wild Shape as an authoritative dual-HP transformation', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 2, concentrating: true,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 16, cha: 10 },
      baseSavingThrowBonuses: { str: -1, dex: 2, con: 2, int: 3, wis: 5, cha: 0 },
      savingThrowBonuses: { str: -1, dex: 2, con: 2, int: 3, wis: 5, cha: 0 },
      savingThrowProficiencies: ['int', 'wis'],
      classResources: { 'dnd5e-wild-shape': { current: 2, max: 2 } },
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] },
    })
    const state = startDnd5eHeadlessCombat('wild-shape', [druid, fighter('enemy', 10)])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: 'druid', formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    expect(transformed.state.combatants.druid).toMatchObject({
      currentHp: 11,
      maxHp: 11,
      armorClass: 13,
      speed: 40,
      concentrating: true,
      statBlockId: 'srd-5.1:wolf',
      abilities: { str: 12, dex: 15, con: 12, int: 12, wis: 16, cha: 10 },
      savingThrowBonuses: { str: 1, dex: 2, con: 1, int: 3, wis: 5, cha: 0 },
      classState: {
        wildShapeFormId: 'srd-5.1:wolf',
        wildShapeCurrentHp: 11,
        wildShapeOriginalCurrentHp: 20,
        wildShapeOriginalMaxHp: 20,
        wildShapeRoundsRemaining: 600,
      },
      turn: { actionAvailable: false },
    })
    expect(transformed.state.combatants.druid.classResources['dnd5e-wild-shape'].current).toBe(1)

    const damaged = resolveDnd5eHeadlessAction(transformed.state, {
      type: 'opportunity-attack', actorId: 'enemy', targetId: 'druid', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 20, bonus: 0, rolls: [15], type: 'slashing' },
    })
    expect(damaged.ok).toBe(true)
    if (!damaged.ok) return
    expect(damaged.state.combatants.druid).toMatchObject({
      currentHp: 16,
      maxHp: 20,
      armorClass: 16,
      speed: 30,
      statBlockId: undefined,
      abilities: { str: 8, dex: 14, con: 14, int: 12, wis: 16, cha: 10 },
      classState: { wildShapeFormId: undefined },
    })
    expect(damaged.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', actorId: 'druid', stateKey: 'wild-shape', active: false,
    }))
  })

  it('uses a bonus action to end Wild Shape and grants Archdruid unlimited uses', () => {
    const druid = fighter('druid', 20, {
      classId: 'druid', level: 20,
      classSelections: { 'wild-shape-known-forms': ['srd-5.1:wolf'] },
    })
    const state = startDnd5eHeadlessCombat('archdruid', [druid, fighter('enemy', 10)])
    const transformed = resolveDnd5eHeadlessAction(state, {
      type: 'druid-wild-shape', actorId: 'druid', formId: 'srd-5.1:wolf',
    })
    expect(transformed.ok).toBe(true)
    if (!transformed.ok) return
    expect(transformed.state.combatants.druid.classResources['dnd5e-wild-shape']).toBeUndefined()
    const reverted = resolveDnd5eHeadlessAction(transformed.state, { type: 'druid-end-wild-shape', actorId: 'druid' })
    expect(reverted.ok).toBe(true)
    if (!reverted.ok) return
    expect(reverted.state.combatants.druid).toMatchObject({
      currentHp: 20,
      maxHp: 20,
      classState: { wildShapeFormId: undefined },
      turn: { bonusActionAvailable: false },
    })
  })

  it('applies deterministic SRD subclass passives in Headless', () => {
    const champion = fighter('champion', 10, {
      classId: 'fighter', subclassId: 'champion', level: 18, currentHp: 8, maxHp: 20,
    })
    const turnState = startDnd5eHeadlessCombat('survivor', [fighter('active', 20), champion])
    const nextTurn = resolveDnd5eHeadlessAction(turnState, { type: 'end-turn', actorId: 'active' })
    expect(nextTurn.ok).toBe(true)
    if (!nextTurn.ok) return
    expect(nextTurn.state.combatants.champion.currentHp).toBe(15)
    expect(nextTurn.events).toContainEqual({
      type: 'healing-applied', targetId: 'champion', amount: 7, hpBefore: 8, hpAfter: 15,
    })

    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 6,
      abilities: { ...abilities, cha: 18 },
    })
    const fiendState = startDnd5eHeadlessCombat('fiend', [warlock, fighter('target', 10, { controller: 'dm', currentHp: 5 })])
    const killed = resolveDnd5eHeadlessAction(fiendState, {
      type: 'attack', actorId: 'warlock', targetId: 'target', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [5], type: 'slashing' },
    })
    expect(killed.ok).toBe(true)
    if (!killed.ok) return
    expect(killed.state.combatants.warlock.temporaryHp).toBe(10)
    expect(killed.events).toContainEqual({
      type: 'temporary-hit-points-gained', actorId: 'warlock', amount: 10, current: 10,
    })
  })

  it('applies Life Domain healing and Divine Strike', () => {
    const cleric = fighter('cleric', 20, {
      classId: 'cleric', subclassId: 'life', level: 17, currentHp: 10,
      abilities: { ...abilities, wis: 16 },
      classSelections: { 'spell-prepared': ['cure-wounds'] },
      classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 4 } },
    })
    const state = startDnd5eHeadlessCombat('life-healing', [cleric, fighter('ally', 10, { currentHp: 1 })])
    const healed = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'cleric', targetId: 'ally', spellId: 'cure-wounds', slotLevel: 1, effectRolls: [1],
    })
    expect(healed.ok).toBe(true)
    if (!healed.ok) return
    expect(healed.state.combatants.ally.currentHp).toBe(15)
    expect(healed.state.combatants.cleric.currentHp).toBe(13)

    const striker = fighter('cleric', 20, { classId: 'cleric', subclassId: 'life', level: 14 })
    const strikeState = startDnd5eHeadlessCombat('divine-strike', [striker, fighter('enemy', 10, { controller: 'dm' })])
    const struck = resolveDnd5eHeadlessAction(strikeState, {
      type: 'attack', actorId: 'cleric', targetId: 'enemy', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'divine-strike', rolls: [3, 3] }],
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.enemy.currentHp).toBe(10)
    expect(struck.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'cleric', targetId: 'enemy', source: 'divine-strike', amount: 6,
    })
  })

  it('adds Draconic Affinity and Empowered Evocation once per spell damage roll', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 6,
      abilities: { ...abilities, cha: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'], 'dragon-ancestor': ['red-fire'] },
    })
    const sorcererState = startDnd5eHeadlessCombat('affinity', [sorcerer, fighter('target', 10, { controller: 'dm' })])
    const affinity = resolveDnd5eHeadlessAction(sorcererState, {
      type: 'cast-spell', actorId: 'sorcerer', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 10, effectRolls: [5, 5],
    })
    expect(affinity.ok).toBe(true)
    if (!affinity.ok) return
    expect(affinity.state.combatants.target.currentHp).toBe(6)

    const wizard = fighter('wizard', 20, {
      classId: 'wizard', subclassId: 'evocation', level: 10,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-cantrips': ['fire-bolt'] },
    })
    const wizardState = startDnd5eHeadlessCombat('empowered', [wizard, fighter('target', 10, { controller: 'dm' })])
    const empowered = resolveDnd5eHeadlessAction(wizardState, {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 10, effectRolls: [5, 5],
    })
    expect(empowered.ok).toBe(true)
    if (!empowered.ok) return
    expect(empowered.state.combatants.target.currentHp).toBe(6)
  })

  it('expires Draconic Elemental Affinity resistance after its last remaining turn', () => {
    const sorcerer = fighter('sorcerer', 20, {
      classId: 'sorcerer', subclassId: 'draconic', level: 6,
      classState: { draconicResistanceType: 'fire', draconicResistanceRoundsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('draconic-resistance-expiry', [sorcerer, fighter('enemy', 10)])
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'sorcerer' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.sorcerer.classState.draconicResistanceType).toBeUndefined()
    expect(ended.state.combatants.sorcerer.classState.draconicResistanceRoundsRemaining).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'class-state-changed', actorId: 'sorcerer', stateKey: 'draconic-resistance', active: false,
    })
  })

  it('expires Sacred Weapon after ten of the Paladin\'s turns', () => {
    const paladin = fighter('paladin', 20, {
      classId: 'paladin', subclassId: 'devotion', level: 3,
      classState: { sacredWeaponTurnsRemaining: 1 },
    })
    const state = startDnd5eHeadlessCombat('sacred-weapon', [paladin, fighter('enemy', 10)])
    const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'paladin' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.combatants.paladin.classState.sacredWeaponTurnsRemaining).toBeUndefined()
    expect(ended.events).toContainEqual({
      type: 'class-state-changed', actorId: 'paladin', stateKey: 'sacred-weapon', active: false,
    })
  })

  it('applies Hunter Multiattack Defense after the first hit from a creature', () => {
    const owlbear = fighter('owlbear', 20, {
      controller: 'dm', statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const hunter = fighter('hunter', 10, {
      classId: 'ranger', subclassId: 'hunter', level: 7,
      classSelections: { 'defensive-tactics': ['multiattack-defense'] },
    })
    const state = startDnd5eHeadlessCombat('multiattack-defense', [owlbear, hunter])
    const result = resolveDnd5eHeadlessAction(state, {
      type: 'monster-action', actorId: 'owlbear', actionId: 'multiattack',
      rolls: [
        { targetId: 'hunter', d20: 10, damageRolls: [[5]] },
        { targetId: 'hunter', d20: 10, damageRolls: [] },
      ],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events.filter((event) => event.type === 'attack-resolved')).toEqual([
      expect.objectContaining({ targetId: 'hunter', armorClass: 16, hit: true }),
      expect.objectContaining({ targetId: 'hunter', armorClass: 20, hit: false }),
    ])
    expect(result.state.combatants.hunter.currentHp).toBe(10)
  })

  it('resolves Empty Body invisibility and non-force resistance for a level-18 Monk', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', level: 18,
      classResources: { 'dnd5e-ki': { current: 18, max: 18 } },
    })
    const owlbear = fighter('owlbear', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:owlbear', currentHp: 59, maxHp: 59,
    })
    const state = startDnd5eHeadlessCombat('empty-body', [monk, owlbear])
    const activated = resolveDnd5eHeadlessAction(state, { type: 'monk-empty-body', actorId: 'monk' })
    expect(activated.ok).toBe(true)
    if (!activated.ok) return
    expect(activated.state.combatants.monk).toMatchObject({
      classResources: { 'dnd5e-ki': { current: 14, max: 18 } },
      classState: { emptyBodyRoundsRemaining: 10 },
      turn: { actionAvailable: false },
    })
    const ended = resolveDnd5eHeadlessAction(activated.state, { type: 'end-turn', actorId: 'monk' })
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    const hit = resolveDnd5eHeadlessAction(ended.state, {
      type: 'monster-action', actorId: 'owlbear', actionId: 'beak',
      rolls: [{ targetId: 'monk', d20: 20, d20Second: 20, mode: 'normal', damageRolls: [[5, 5]] }],
    })
    expect(hit.ok).toBe(true)
    if (!hit.ok) return
    expect(hit.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', targetId: 'monk', d20: 20, hit: true,
    }))
    expect(hit.state.combatants.monk.currentHp).toBe(13)
  })

  it('resolves Relentless Rage saves and raises the DC until a rest', () => {
    const barbarian = fighter('barbarian', 10, {
      controller: 'player', classId: 'barbarian', level: 11, currentHp: 5,
      classState: { raging: true, rageTurnsRemaining: 10 },
      savingThrowBonuses: { con: 2 },
    })
    const state = startDnd5eHeadlessCombat('relentless-rage', [
      fighter('enemy-1', 20, { controller: 'dm' }), barbarian,
      fighter('enemy-2', 5, { controller: 'dm' }), fighter('enemy-3', 1, { controller: 'dm' }),
    ])
    const firstDrop = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy-1', targetId: 'barbarian', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'slashing' },
    })
    expect(firstDrop.ok).toBe(true)
    if (!firstDrop.ok) return
    expect(firstDrop.events).toContainEqual({ type: 'relentless-rage-save-required', targetId: 'barbarian', dc: 10 })
    const firstSave = resolveDnd5eHeadlessAction(firstDrop.state, {
      type: 'barbarian-relentless-rage-save', actorId: 'barbarian', d20: 8, dc: 10,
    })
    expect(firstSave.ok).toBe(true)
    if (!firstSave.ok) return
    expect(firstSave.state.combatants.barbarian).toMatchObject({
      currentHp: 1, classState: { raging: true, relentlessRageDc: 15 },
    })

    const secondDrop = resolveDnd5eHeadlessAction(firstSave.state, {
      type: 'opportunity-attack', actorId: 'enemy-2', targetId: 'barbarian', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [2], type: 'slashing' },
    })
    expect(secondDrop.ok).toBe(true)
    if (!secondDrop.ok) return
    expect(secondDrop.events).toContainEqual({ type: 'relentless-rage-save-required', targetId: 'barbarian', dc: 15 })
    const failed = resolveDnd5eHeadlessAction(secondDrop.state, {
      type: 'barbarian-relentless-rage-save', actorId: 'barbarian', d20: 1, dc: 15,
    })
    expect(failed.ok).toBe(true)
    if (!failed.ok) return
    expect(failed.state.combatants.barbarian).toMatchObject({
      currentHp: 0, concentrating: false, classState: { raging: undefined },
    })
  })

  it('applies Fiendish Resilience and Lifedrinker for the selected Warlock build', () => {
    const enemy = fighter('enemy', 20, { controller: 'dm' })
    const warlock = fighter('warlock', 20, {
      classId: 'warlock', subclassId: 'fiend', level: 12,
      abilities: { ...abilities, cha: 18 },
      classSelections: {
        'fiendish-resilience': ['fire'],
        'pact-boon': ['blade'],
        'eldritch-invocations': ['lifedrinker'],
      },
    })
    const state = startDnd5eHeadlessCombat('fiendish-resilience', [enemy, warlock])
    const resisted = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'enemy', targetId: 'warlock', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'fire' },
    })
    expect(resisted.ok).toBe(true)
    if (!resisted.ok) return
    expect(resisted.state.combatants.warlock.currentHp).toBe(15)

    const warlockTurn = startDnd5eHeadlessCombat('lifedrinker', [warlock, enemy])
    const struck = resolveDnd5eHeadlessAction(warlockTurn, {
      type: 'attack', actorId: 'warlock', targetId: 'enemy', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 8, bonus: 0, rolls: [4], type: 'slashing' },
      classDamageContext: {
        mode: 'melee', finesse: false, strengthBased: true, weaponDamageSides: 8,
        damageType: 'slashing', adjacentEnemyOfTarget: false,
      },
      classDamageRolls: [{ source: 'lifedrinker', rolls: [] }],
    })
    expect(struck.ok).toBe(true)
    if (!struck.ok) return
    expect(struck.state.combatants.enemy.currentHp).toBe(12)
    expect(struck.events).toContainEqual({
      type: 'class-damage-applied', actorId: 'warlock', targetId: 'enemy', source: 'lifedrinker', amount: 4,
    })
  })

  it('uses Open Hand Tranquility as a Sanctuary save before a targeted attack', () => {
    const attacker = fighter('attacker', 20, { savingThrowBonuses: { wis: 1 } })
    const monk = fighter('monk', 10, {
      classId: 'monk', subclassId: 'open-hand', level: 11,
      abilities: { ...abilities, wis: 16 },
      proficiencyBonus: 4,
      classState: { tranquilityActive: true },
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-blocked', [attacker, monk]), {
      type: 'attack', actorId: 'attacker', targetId: 'monk', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.attacker.turn.actionAvailable).toBe(false)
    expect(blocked.state.combatants.monk.currentHp).toBe(20)
    expect(blocked.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'attacker', ability: 'wis', dc: 15, success: false,
    }))
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'attacker', targetId: 'monk', source: 'tranquility',
    })
    expect(blocked.events.some((event) => event.type === 'attack-resolved')).toBe(false)

    const passed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-passed', [attacker, monk]), {
      type: 'attack', actorId: 'attacker', targetId: 'monk', attackModifier: 20, d20: 10,
      tranquilitySave: { d20: 20 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [5] },
    })
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants.monk.currentHp).toBe(12)
    expect(passed.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'attacker', ability: 'wis', success: true,
    }))
  })

  it("uses the Land druid's Nature's Sanctuary only against beast or plant attacks", () => {
    const beast = fighter('beast', 20, {
      controller: 'dm', creatureType: '野兽', savingThrowBonuses: { wis: 1 },
    })
    const druid = fighter('druid', 10, {
      classId: 'druid', subclassId: 'land', level: 14,
      abilities: { ...abilities, wis: 16 }, proficiencyBonus: 4,
    })
    const blocked = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-blocked', [beast, druid]), {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 20,
      tranquilitySave: { d20: 5 },
      damage: { count: 1, sides: 8, bonus: 3, rolls: [8] },
    })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.combatants.druid.currentHp).toBe(20)
    expect(blocked.events).toContainEqual({
      type: 'hostile-targeting-prevented', actorId: 'beast', targetId: 'druid', source: 'nature-sanctuary',
    })

    const passed = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-passed', [beast, druid]), {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 10,
      spendAction: false, tranquilitySave: { d20: 20 },
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(passed.ok).toBe(true)
    if (!passed.ok) return
    expect(passed.state.combatants.beast.classState.natureSanctuaryImmunityRoundsByTarget?.druid).toBe(14_400)
    expect(passed.events).toContainEqual(expect.objectContaining({
      type: 'class-state-changed', stateKey: 'nature-sanctuary-immunity', active: true, value: 14_400,
    }))
    const immuneAttack = resolveDnd5eHeadlessAction(passed.state, {
      type: 'attack', actorId: 'beast', targetId: 'druid', attackModifier: 20, d20: 10,
      spendAction: false,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(immuneAttack.ok).toBe(true)
    if (!immuneAttack.ok) return
    expect(immuneAttack.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)

    const humanoid = fighter('humanoid', 20, { controller: 'dm', creatureType: '类人生物' })
    const ordinaryAttack = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('nature-sanctuary-ineligible', [humanoid, druid]), {
      type: 'attack', actorId: 'humanoid', targetId: 'druid', attackModifier: 20, d20: 10,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [1] },
    })
    expect(ordinaryAttack.ok).toBe(true)
    if (!ordinaryAttack.ok) return
    expect(ordinaryAttack.events.some((event) => event.type === 'saving-throw-resolved')).toBe(false)
  })

  it('ends the Open Hand Tranquility ward when the monk makes an attack', () => {
    const monk = fighter('monk', 20, {
      classId: 'monk', subclassId: 'open-hand', level: 11,
      classState: { tranquilityActive: true },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('tranquility-ends', [monk, enemy]), {
      type: 'attack', actorId: 'monk', targetId: 'enemy', attackModifier: 5, d20: 1,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.monk.classState.tranquilityActive).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'monk', stateKey: 'tranquility', active: false,
    })
  })

  it('grants advantage for an attack from hiding and then reveals the attacker', () => {
    const rogue = fighter('rogue', 20, {
      classId: 'rogue', subclassId: 'thief', level: 9,
      classState: { hiddenCheckTotal: 22 },
    })
    const enemy = fighter('enemy', 10, { controller: 'dm' })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('hidden-attack', [rogue, enemy]), {
      type: 'attack', actorId: 'rogue', targetId: 'enemy', attackModifier: 5,
      d20: 2, d20Second: 18,
      damage: { count: 1, sides: 6, bonus: 3, rolls: [4] },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'rogue', d20: 18, hit: true,
    }))
    expect(result.state.combatants.rogue.classState.hiddenCheckTotal).toBeUndefined()
    expect(result.events).toContainEqual({
      type: 'class-state-changed', actorId: 'rogue', stateKey: 'hidden', active: false,
    })
  })

  it('applies Blight immunity and the plant disadvantage/maximum-damage rule', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['blight'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const plant = fighter('plant', 10, { controller: 'dm', creatureType: '植物', currentHp: 100, maxHp: 100 })
    const plantResult = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blight-plant', [wizard, plant]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'plant', spellId: 'blight', slotLevel: 4,
      savingThrowD20: 20, savingThrowD20Second: 1, effectRolls: Array(8).fill(1),
    })
    expect(plantResult.ok).toBe(true)
    if (!plantResult.ok) return
    expect(plantResult.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved', targetId: 'plant', d20: 1, success: false,
    }))
    expect(plantResult.state.combatants.plant.currentHp).toBe(36)

    const secondWizard = fighter('wizard', 20, {
      classId: 'wizard', level: 7, proficiencyBonus: 3,
      abilities: { ...abilities, int: 16 },
      classSelections: { 'spell-prepared': ['blight'] },
      classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } },
    })
    const undead = fighter('undead', 10, { controller: 'dm', creatureType: '亡灵', currentHp: 80, maxHp: 80 })
    const immuneResult = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('blight-undead', [secondWizard, undead]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'undead', spellId: 'blight', slotLevel: 4,
      savingThrowD20: 1, effectRolls: Array(8).fill(8),
    })
    expect(immuneResult.ok).toBe(true)
    if (!immuneResult.ok) return
    expect(immuneResult.state.combatants.undead.currentHp).toBe(80)
  })

  it('marks a creature reduced to zero by Disintegrate as dead', () => {
    const wizard = fighter('wizard', 20, {
      classId: 'wizard', level: 11, proficiencyBonus: 4,
      abilities: { ...abilities, int: 18 },
      classSelections: { 'spell-prepared': ['disintegrate'] },
      classResources: { 'dnd5e-spell-slot-6': { current: 1, max: 1 } },
    })
    const target = fighter('target', 10, {
      controller: 'dm', statBlockId: 'srd-5.1:zombie', usesDeathSaves: false,
      currentHp: 30, maxHp: 30,
    })
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('disintegrate', [wizard, target]), {
      type: 'cast-spell', actorId: 'wizard', targetId: 'target', spellId: 'disintegrate', slotLevel: 6,
      savingThrowD20: 1, effectRolls: Array(10).fill(1),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.combatants.target).toMatchObject({
      currentHp: 0,
      deathSaves: { successes: 0, failures: 3, stable: false, dead: true },
    })
    expect(result.events).toContainEqual(expect.objectContaining({
      type: 'instant-death', sourceId: 'wizard', targetId: 'target',
    }))
    expect(result.events.some((event) => event.type === 'undead-fortitude-save-required')).toBe(false)
    expect(result.state.combatants.target.classState.undeadFortitudePending).toBeUndefined()
  })
})
