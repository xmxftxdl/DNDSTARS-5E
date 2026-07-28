import { describe, expect, it } from 'vitest'
import {
  applyDnd5eActiveEffect,
  createDnd5eConditionEffect,
  createDnd5eMechanicalEffect,
  dnd5eActiveAbilityCheckAdvantages,
  dnd5eActiveArmorClassBonus,
  dnd5eActiveCarryingCapacityMultiplier,
  dnd5eActiveConditionImmunities,
  dnd5eActiveDarkvisionRangeFeet,
  dnd5eActiveEffectsPreventReactions,
  dnd5eActiveEffectsSeeInvisible,
  dnd5eActiveFlySpeed,
  dnd5eActiveJumpDistanceMultiplier,
  dnd5eActiveResistanceToAllDamage,
  dnd5eActiveSavingThrowBonus,
  dnd5eActiveSizeRankDelta,
  dnd5eActiveSafeFallFeet,
  dnd5eActiveSpeedPenalty,
  dnd5eActiveStrengthRollFlags,
  dnd5eActiveWeaponDamageD4Mode,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
  removeDnd5eActiveEffectsForEvent,
  validateDnd5eActiveEffectsStrict,
} from './activeEffects'
import {
  activeEffectFromDnd5eTimedEffect,
  migrateDnd5eCombatStateEffects,
  migrateDnd5eTimedEffects,
  migrateLegacyDnd5eConditions,
} from './legacyActiveEffectMigration'

describe('D&D 5e ActiveEffectInstance', () => {
  it('normalizes reusable AC, saving throw, and all-damage resistance modifiers', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:warding-bond',
      label: '守护之链',
      source: { kind: 'spell', actorId: 'cleric' },
      targetId: 'ally',
      modifiers: {
        armorClassBonus: 1,
        savingThrowBonus: 1,
        resistanceToAllDamage: true,
      },
    })
    expect(dnd5eActiveArmorClassBonus([effect])).toBe(1)
    expect(dnd5eActiveSavingThrowBonus([effect])).toBe(1)
    expect(dnd5eActiveResistanceToAllDamage([effect])).toBe(true)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { armorClassBonus: 21, savingThrowBonus: Number.NaN, resistanceToAllDamage: 'yes' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([
        expect.stringContaining('armorClassBonus'),
        expect.stringContaining('savingThrowBonus'),
        expect.stringContaining('resistanceToAllDamage'),
      ]),
    })
  })

  it('normalizes the reusable see-invisible sight modifier', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:see-invisibility',
      label: '识破隐形',
      source: { kind: 'spell', actorId: 'wizard' },
      targetId: 'wizard',
      modifiers: { seeInvisible: true },
    })
    expect(dnd5eActiveEffectsSeeInvisible([effect])).toBe(true)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { seeInvisible: 'yes' },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('seeInvisible')]),
    })
  })

  it('normalizes reusable Enhance Ability modifiers and rejects malformed values', () => {
    const effect = createDnd5eMechanicalEffect({
      definitionId: 'test:enhance-ability',
      label: '强化属性',
      source: { kind: 'spell', actorId: 'caster' },
      targetId: 'target',
      modifiers: {
        abilityCheckAdvantages: ['dex', 'dex'],
        carryingCapacityMultiplier: 2,
        safeFallFeet: 20,
      },
    })
    expect(dnd5eActiveAbilityCheckAdvantages([effect])).toEqual(['dex'])
    expect(dnd5eActiveCarryingCapacityMultiplier([effect])).toBe(2)
    expect(dnd5eActiveSafeFallFeet([effect])).toBe(20)
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { ...effect.modifiers, abilityCheckAdvantages: ['luck'] },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('abilityCheckAdvantages')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      modifiers: { ...effect.modifiers, safeFallFeet: 2_000 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('safeFallFeet')]),
    })
  })

  it('deterministically migrates legacy standard and plugin condition strings', () => {
    const first = migrateLegacyDnd5eConditions({ targetId: 'hero', conditions: ['目盲', 'plugin:marked', 'blinded'] })
    const second = migrateLegacyDnd5eConditions({ targetId: 'hero', conditions: ['目盲', 'plugin:marked', 'blinded'] })
    expect(first).toEqual(second)
    expect(first).toHaveLength(2)
    expect(first[0]).toMatchObject({ standardCondition: 'blinded', appliedAt: 0 })
    expect(dnd5eConditionsFromActiveEffects(first)).toEqual(['目盲', 'plugin:marked'])
  })

  it('rejects immunities and refreshes duplicate duration', () => {
    const existing = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'target', source: { kind: 'spell', actorId: 'caster' },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' }, appliedAt: 1,
    })
    const incoming = { ...existing, id: 'new-id', duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' } as const }
    expect(applyDnd5eActiveEffect({ effects: [], incoming, conditionImmunities: ['blinded'] }).status)
      .toBe('rejected-immune')
    const refreshed = applyDnd5eActiveEffect({ effects: [existing], incoming })
    expect(refreshed.status).toBe('refreshed')
    expect(refreshed.effects).toEqual([expect.objectContaining({ id: existing.id, duration: incoming.duration })])
  })

  it('removes matching break triggers without touching other effects', () => {
    const damage = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'target', source: { kind: 'feature' }, breakOn: ['takes-damage'],
    })
    const move = createDnd5eConditionEffect({
      condition: 'grappled', targetId: 'target', source: { kind: 'feature' }, breakOn: ['moves'],
    })
    const resolved = removeDnd5eActiveEffectsForEvent({ effects: [damage, move], trigger: 'takes-damage' })
    expect(resolved.removed.map((effect) => effect.standardCondition)).toEqual(['charmed'])
    expect(resolved.effects.map((effect) => effect.standardCondition)).toEqual(['grappled'])
  })

  it('mirrors and removes stale legacy timed effects', () => {
    const timed = {
      id: 'ray:caster:target', sourceActorId: 'caster', sourceSpellId: 'ray-of-frost',
      kind: 'speed-penalty' as const, amount: 10, expiresAt: 'source-next-turn-start' as const,
    }
    const mirrored = activeEffectFromDnd5eTimedEffect(timed, 'target')
    expect(mirrored).toMatchObject({ legacyTimedEffectId: timed.id, source: { actorId: 'caster' } })
    expect(migrateDnd5eTimedEffects({ targetId: 'target', timedEffects: [], activeEffects: [mirrored] })).toEqual([])
  })

  it('drops malformed shared/plugin lifecycle values at the runtime boundary', () => {
    expect(normalizeDnd5eActiveEffects([{
      schemaVersion: 1, id: 'bad', definitionId: 'condition:blinded', label: '坏状态', kind: 'condition',
      source: { kind: 'network' }, duration: { type: 'forever-and-ever' },
      stackingKey: 'bad', stackingPolicy: 'overwrite-everything',
    }])).toEqual([])
  })

  it('normalizes the whitelisted Jump and Heroism mechanical modifiers', () => {
    const jump = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:jump', label: '跳跃术', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'jump' },
      modifiers: { jumpDistanceMultiplier: 3 },
    })
    const heroism = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:heroism', label: '英雄气概', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'heroism' },
      modifiers: { conditionImmunities: ['frightened'] },
    })
    expect(dnd5eActiveJumpDistanceMultiplier([jump, heroism])).toBe(3)
    expect(dnd5eActiveConditionImmunities([jump, heroism])).toEqual(['frightened'])
    expect(validateDnd5eActiveEffectsStrict([jump, heroism])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...jump, modifiers: { jumpDistanceMultiplier: 0 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('jumpDistanceMultiplier')]),
    })
  })

  it('normalizes Darkvision as a maximum-range mechanical modifier', () => {
    const darkvision = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:darkvision',
      label: '黑暗视觉',
      targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'darkvision' },
      modifiers: { darkvisionRangeFeet: 60 },
    })
    expect(dnd5eActiveDarkvisionRangeFeet([darkvision])).toBe(60)
    expect(validateDnd5eActiveEffectsStrict([darkvision])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...darkvision,
      modifiers: { darkvisionRangeFeet: -1 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('darkvisionRangeFeet')]),
    })
  })

  it('normalizes Shillelagh weapon and spellcasting metadata but rejects forged values', () => {
    const shillelagh = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:shillelagh',
      label: '橡棍术',
      targetId: 'druid',
      source: { kind: 'spell', actorId: 'druid', rulesId: 'shillelagh' },
      modifiers: {
        shillelagh: {
          weaponId: 'dnd5e-club',
          spellcastingAbility: 'wis',
          spellcastingModifier: 4,
        },
      },
    })
    expect(validateDnd5eActiveEffectsStrict([shillelagh])).toMatchObject({ ok: true })
    expect(normalizeDnd5eActiveEffects([shillelagh])[0].modifiers?.shillelagh).toEqual({
      weaponId: 'dnd5e-club',
      spellcastingAbility: 'wis',
      spellcastingModifier: 4,
    })
    expect(validateDnd5eActiveEffectsStrict([{
      ...shillelagh,
      modifiers: {
        shillelagh: {
          weaponId: '',
          spellcastingAbility: 'luck',
          spellcastingModifier: 99,
        },
      },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('shillelagh')]),
    })
  })

  it('normalizes a granted flying speed and rejects unsafe values', () => {
    const flight = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:fly', label: '飞行术', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'fly' },
      modifiers: { flySpeedFeet: 60 },
    })
    expect(dnd5eActiveFlySpeed([flight])).toBe(60)
    expect(validateDnd5eActiveEffectsStrict([flight])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...flight,
      modifiers: { flySpeedFeet: -1 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('flySpeedFeet')]),
    })
  })

  it('normalizes the whitelisted Enlarge/Reduce mechanical modifiers', () => {
    const enlarge = createDnd5eMechanicalEffect({
      definitionId: 'srd-5.1:spell:enlarge-reduce', label: '变巨', targetId: 'target',
      source: { kind: 'spell', actorId: 'caster', rulesId: 'enlarge-reduce' },
      modifiers: {
        sizeRankDelta: 1,
        strengthRollMode: 'advantage',
        weaponDamageD4: 'add',
      },
    })
    expect(dnd5eActiveSizeRankDelta([enlarge])).toBe(1)
    expect(dnd5eActiveStrengthRollFlags([enlarge])).toEqual({ advantage: true, disadvantage: false })
    expect(dnd5eActiveWeaponDamageD4Mode([enlarge])).toBe('add')
    expect(validateDnd5eActiveEffectsStrict([enlarge])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...enlarge,
      modifiers: { ...enlarge.modifiers, sizeRankDelta: 2 },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('sizeRankDelta')]),
    })
  })

  it('strictly rejects malformed remote values instead of silently repairing them', () => {
    const effect = createDnd5eConditionEffect({
      id: 'blind', condition: 'blinded', targetId: 'target', source: { kind: 'dm' },
    })
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      duration: { type: 'rounds', remainingRounds: 0, tickOn: 'target-turn-end' },
    }])).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining('remainingRounds')]) })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end', lastTickTurnKey: '' },
    }])).toMatchObject({ ok: false, issues: expect.arrayContaining([expect.stringContaining('lastTickTurnKey')]) })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, potency: 'lots' }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('potency')]),
    })
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, potency: Number.POSITIVE_INFINITY }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('potency')]),
    })
  })

  it('preserves bounded failed-save damage and alternative escape ability declarations', () => {
    const effect = createDnd5eConditionEffect({
      id: 'phantasm',
      condition: 'frightened',
      targetId: 'target',
      source: { kind: 'spell', actorId: 'wizard', rulesId: 'phantasmal-killer' },
      duration: {
        type: 'concentration',
        sourceActorId: 'wizard',
        concentrationId: 'phantasmal-killer',
        remainingRounds: 10,
      },
      repeatSave: {
        ability: 'wis',
        dc: 16,
        timing: 'target-turn-end',
        damageOnFailure: { count: 5, sides: 10, modifier: 0, type: 'psychic' },
        onSuccess: 'remove',
      },
      escapeCheck: {
        ability: 'str',
        alternativeAbility: 'dex',
        dc: 16,
        economy: 'action',
      },
    })
    expect(normalizeDnd5eActiveEffects([effect])).toEqual([effect])
    expect(validateDnd5eActiveEffectsStrict([effect])).toMatchObject({ ok: true })
    expect(validateDnd5eActiveEffectsStrict([{
      ...effect,
      repeatSave: {
        ...effect.repeatSave!,
        damageOnFailure: { count: 5, sides: 10, modifier: 0, type: 'not-damage' },
      },
    }])).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('repeatSave')]),
    })
  })

  it('migrates old timed mechanics once and then treats them as native active effects', () => {
    const migrated = migrateDnd5eCombatStateEffects({
      targetId: 'target',
      conditions: ['blinded'],
      state: {
        timedEffects: [
          { id: 'slow', sourceActorId: 'caster', sourceSpellId: 'ray-of-frost', kind: 'speed-penalty', amount: 10, expiresAt: 'source-next-turn-start' },
          { id: 'shock', sourceActorId: 'caster', sourceSpellId: 'shocking-grasp', kind: 'reaction-lock', expiresAt: 'target-next-turn-start' },
        ],
      },
    })
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.conditions).toEqual(['blinded'])
    expect(dnd5eActiveSpeedPenalty(migrated.activeEffects)).toBe(10)
    expect(dnd5eActiveEffectsPreventReactions(migrated.activeEffects)).toBe(true)
    const second = migrateDnd5eCombatStateEffects({
      targetId: 'target', state: { schemaVersion: 2, activeEffects: migrated.activeEffects },
      conditions: migrated.conditions,
    })
    expect(second).toEqual(migrated)
  })
})
