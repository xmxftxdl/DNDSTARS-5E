import { dnd5eEffectiveWalkingSpeed } from './classes'
import { describe, expect, it } from 'vitest'
import { normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict, createDnd5eConditionEffect, createDnd5eMechanicalEffect } from './activeEffects'
import { dnd5eFrightenedAttackDisadvantage, resolveDnd5eFeatherFallReaction, dnd5eCombatantPairKey, previewDnd5eSpellcastingSaves, commitDnd5eActivityExecution, dnd5eEffectiveWalkSpeed, dnd5eEffectiveFlySpeed, dnd5eEffectiveOptionalMovementSpeed, dnd5eEffectiveMovementPoolSpeed, dnd5eEffectiveSpeed, createDnd5eCombatant, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'
import { dnd5eSrdAuditedSpellActivityV1 } from './activities/dnd5eSrdAuditedSpellActivities'

const abilities = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 10 } as const

function combatant(id: string, initiative: number, patch = {}) {
  return createDnd5eCombatant({
    id, name: id, controller: 'player', initiative, abilities, proficiencyBonus: 2,
    armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
    position: { x: 0, y: 0 }, concentrating: false,
    ...patch,
  })
}

describe('ActiveEffectInstance Headless 生命周期', () => {
  it('ends dependent concentration in the same transaction as a different action, but not movement or a rejected action', () => {
    const maintenance = createDnd5eMechanicalEffect({
      definitionId: 'maintenance', label: 'Maintenance', targetId: 'source',
      source: { kind: 'spell', actorId: 'source', rulesId: 'linked-spell' },
      duration: { type: 'concentration', sourceActorId: 'source', concentrationId: 'linked-spell', remainingRounds: 10 },
      breakOn: ['spends-action-except-granted'],
    })
    const channel = createDnd5eMechanicalEffect({
      definitionId: 'channel', label: 'Channel', targetId: 'target',
      source: { kind: 'spell', actorId: 'source', rulesId: 'linked-spell' },
      duration: { type: 'concentration', sourceActorId: 'source', concentrationId: 'linked-spell', remainingRounds: 10 },
      removal: { sourceLink: { sourceRequiresEffect: 'maintenance' } },
    })
    const state = startDnd5eHeadlessCombat('maintenance', [
      combatant('source', 20, { concentrating: true, classState: {
        activeEffects: [maintenance], concentrationSpellId: 'linked-spell',
        concentrationTargetIds: ['target'], concentrationRoundsRemaining: 10,
      } }),
      combatant('target', 10, { classState: {
        activeEffects: [channel], concentrationEffectsBySource: { source: 'linked-spell' },
      } }),
    ])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'source', to: { x: 5, y: 0 }, distance: 5 })
    expect(moved.ok).toBe(true)
    expect(moved.state.combatants.source.concentrating).toBe(true)
    const deniedState = structuredClone(moved.state)
    deniedState.combatants.source.turn.actionAvailable = false
    const denied = resolveDnd5eHeadlessAction(deniedState, { type: 'dodge', actorId: 'source' })
    expect(denied.ok).toBe(false)
    expect(denied.state.combatants.source.concentrating).toBe(true)
    expect(denied.state.combatants.target.classState.activeEffects?.some(effect => effect.id === channel.id)).toBe(true)
    const ended = resolveDnd5eHeadlessAction(moved.state, { type: 'dodge', actorId: 'source' })
    expect(ended.ok).toBe(true)
    expect(ended.state.combatants.source.concentrating).toBe(false)
    expect(ended.state.combatants.target.classState.activeEffects?.some(effect => effect.id === channel.id) ?? false).toBe(false)
    expect(ended.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', effectId: maintenance.id, reason: 'spends-action-except-granted' }))
    expect(state.combatants.source.concentrating).toBe(true)
  })

  it.each([
    ['caster', 'source', 'player', false, false, 0, true],
    ['companion', 'attacker', 'player', false, false, 0, true],
    ['unrelated enemy', 'attacker', 'dm', false, false, 0, false],
    ['miss', 'source', 'player', true, false, 0, false],
    ['immune target', 'source', 'player', false, true, 0, false],
    ['temporary hit points', 'attacker', 'player', false, false, 10, true],
  ] as const)('ends Suggestion only after damage from its caster or companions: %s',
    (_label, attackerId, controller, miss, immune, temporaryHp, shouldEnd) => {
      const definition = dnd5eSrdAuditedSpellActivityV1('suggestion')!.effects!.find((effect) => effect.id === 'suggestion')!
      const effect = createDnd5eMechanicalEffect({
        definitionId: 'activity:suggestion:suggestion', label: definition.name, targetId: 'target',
        source: { kind: 'spell', actorId: 'source', rulesId: 'suggestion' },
        duration: { type: 'concentration', sourceActorId: 'source', concentrationId: 'suggestion', remainingRounds: 4800 },
        removal: { sourceLink: definition.sourceLink },
      })
      const source = combatant('source', attackerId === 'source' ? 30 : 10, {
        concentrating: true,
        classState: { concentrationSpellId: 'suggestion', concentrationTargetIds: ['target'], concentrationRoundsRemaining: 4800 },
      })
      const target = combatant('target', 5, {
        controller: 'dm', position: { x: 5, y: 0 }, temporaryHp,
        damageImmunities: immune ? ['fire'] : [],
        classState: { activeEffects: [effect], concentrationEffectsBySource: { source: 'suggestion' } },
      })
      const state = startDnd5eHeadlessCombat('suggestion-damage', [source, target,
        ...(attackerId === 'source' ? [] : [combatant(attackerId, 30, { controller })]),
      ])
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'attack', actorId: attackerId, targetId: 'target', attackModifier: 8, d20: miss ? 1 : 15,
        damage: { count: 1, sides: 4, bonus: 0, rolls: [2], type: 'fire' },
      })
      expect(result.ok, result.ok ? undefined : result.reason).toBe(true)
      if (!result.ok) return
      expect(result.state.combatants.target.classState.activeEffects?.some((entry) => entry.id === effect.id) ?? false).toBe(!shouldEnd)
      expect(result.state.combatants.source.concentrating).toBe(!shouldEnd)
      expect(result.events.some((event) => event.type === 'active-effect-removed' && event.effectId === effect.id)).toBe(shouldEnd)
      if (shouldEnd) {
        expect(result.state.combatants.source.classState.concentrationSpellId).toBeUndefined()
        expect(result.state.combatants.target.classState.concentrationEffectsBySource?.source).toBeUndefined()
      }
    })

  it('enforces charmed and frightened restrictions against their actual effect source', () => {
    const charmed = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'actor', source: { kind: 'spell', actorId: 'source', rulesId: 'charm-person' },
    })
    const frightened = createDnd5eConditionEffect({
      condition: 'frightened', targetId: 'actor', source: { kind: 'spell', actorId: 'source', rulesId: 'fear' },
    })
    const state = startDnd5eHeadlessCombat('condition-source', [
      combatant('actor', 20, {
        position: { x: 10, y: 0 },
        classState: { activeEffects: [charmed, frightened] },
      }),
      combatant('source', 10, { controller: 'dm', position: { x: 0, y: 0 } }),
      combatant('other', 5, { controller: 'dm', position: { x: 20, y: 0 } }),
    ])

    const sourceAttack = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'actor', targetId: 'source', attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4] },
    })
    expect(sourceAttack).toMatchObject({ ok: false, reason: 'invalid-target' })

    const towardSource = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'actor', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(towardSource).toMatchObject({ ok: false, reason: 'invalid-class-feature' })

    const awayFromSource = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'actor', to: { x: 15, y: 0 }, distance: 5,
    })
    expect(awayFromSource.ok).toBe(true)
  })

  it('restricts approach to the selected fear entity while retaining the effect author after persistence', () => {
    const frightened = createDnd5eConditionEffect({
      condition: 'frightened', targetId: 'actor', tags: ['condition-entity:other'],
      source: { kind: 'spell', actorId: 'source', rulesId: 'words-of-terror' },
    })
    const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([frightened])))
    const state = startDnd5eHeadlessCombat('selected-fear-source', [
      combatant('actor', 20, { position: { x: 10, y: 0 }, classState: { activeEffects: effects } }),
      combatant('source', 10, { controller: 'dm', position: { x: 0, y: 0 } }),
      combatant('other', 5, { controller: 'dm', position: { x: 20, y: 0 } }),
    ])
    expect(dnd5eFrightenedAttackDisadvantage(state, state.combatants.actor)).toBe(true)
    state.physicalLineOfSightBlockedByCombatantPair = { ['actor\u0000other']: true }
    expect(dnd5eFrightenedAttackDisadvantage(state, state.combatants.actor)).toBe(false)
    state.physicalLineOfSightBlockedByCombatantPair = { ['actor\u0000source']: true }
    expect(dnd5eFrightenedAttackDisadvantage(state, state.combatants.actor)).toBe(true)
    delete state.physicalLineOfSightBlockedByCombatantPair
    const snapshot = structuredClone(state)
    const towardAuthor = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'actor', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(towardAuthor.ok).toBe(true)
    const towardFearedCreature = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'actor', to: { x: 15, y: 0 }, distance: 5,
    })
    expect(towardFearedCreature).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    expect(towardAuthor.state.combatants.actor.classState.activeEffects?.[0].source.actorId).toBe('source')
    expect(state).toEqual(snapshot)
  })

  it('ticks a round duration only once at the same turn boundary', () => {
    const startEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'actor', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start' },
    })
    const state = startDnd5eHeadlessCombat('single-boundary-tick', [
      combatant('actor', 20, { classState: { activeEffects: [startEffect] } }),
      combatant('target', 10),
    ])
    const moved = resolveDnd5eHeadlessAction(state, {
      type: 'move', actorId: 'actor', to: { x: 5, y: 0 }, distance: 5,
    })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.actor.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'single-boundary-tick:1:actor' })

    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: 'actor' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.actor.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'single-boundary-tick:1:actor' })
  })

  it('does not run a creature turn-start boundary for an off-turn transaction', () => {
    const startEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'reactor', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start' },
    })
    const state = startDnd5eHeadlessCombat('off-turn-boundary', [
      combatant('actor', 20),
      combatant('reactor', 10, {
        concentrating: true,
        classState: { concentrationSpellId: 'bless', activeEffects: [startEffect] },
      }),
    ])
    const saved = resolveDnd5eHeadlessAction(state, {
      type: 'concentration-save', actorId: 'reactor', d20: 20, dc: 10,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.state.combatants.reactor.classState.activeEffects?.[0].duration)
      .toEqual({ type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start', lastTickTurnKey: undefined })
  })

  it('does not tick the next creature twice after authoritative turn advancement', () => {
    const startEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'target', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-start' },
    })
    const state = startDnd5eHeadlessCombat('turn-transition-boundary', [
      combatant('actor', 20),
      combatant('target', 10, { classState: { activeEffects: [startEffect] } }),
    ])
    const advanced = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'actor' })
    expect(advanced.ok).toBe(true)
    if (!advanced.ok) return
    expect(advanced.state.combatants.target.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'turn-transition-boundary:1:target' })

    const dashed = resolveDnd5eHeadlessAction(advanced.state, { type: 'dash', actorId: 'target' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.target.classState.activeEffects?.[0].duration)
      .toMatchObject({ remainingRounds: 2, lastTickTurnKey: 'turn-transition-boundary:1:target' })
  })

  it('removes effects on movement, attacking, being targeted, being hit and taking damage', () => {
    const moverEffect = createDnd5eConditionEffect({
      condition: 'charmed', targetId: 'actor', source: { kind: 'dm' }, breakOn: ['moves'],
    })
    let state = startDnd5eHeadlessCombat('events', [
      combatant('actor', 20, { classState: { activeEffects: [moverEffect] } }),
      combatant('target', 10, { position: { x: 10, y: 0 } }),
    ])
    const moved = resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'actor', to: { x: 5, y: 0 }, distance: 5 })
    expect(moved.ok).toBe(true)
    if (!moved.ok) return
    expect(moved.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(moved.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: 'moves' }))

    const attackBreak = createDnd5eConditionEffect({
      condition: 'invisible', targetId: 'actor', source: { kind: 'feature' }, breakOn: ['makes-attack'],
    })
    const targetBreaks = [
      createDnd5eConditionEffect({ condition: 'charmed', targetId: 'target', source: { kind: 'feature' }, breakOn: ['targeted-by-attack'] }),
      createDnd5eConditionEffect({ condition: 'deafened', targetId: 'target', source: { kind: 'feature' }, breakOn: ['hit-by-attack'] }),
      createDnd5eConditionEffect({ condition: 'poisoned', targetId: 'target', source: { kind: 'feature' }, breakOn: ['takes-damage'] }),
    ]
    state = startDnd5eHeadlessCombat('attack-events', [
      combatant('actor', 20, { classState: { activeEffects: [attackBreak] } }),
      combatant('target', 10, { position: { x: 5, y: 0 }, classState: { activeEffects: targetBreaks } }),
    ])
    const attacked = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 6, bonus: 2, rolls: [4] },
    })
    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    expect(attacked.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(attacked.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(attacked.events.filter((event) => event.type === 'active-effect-removed').map((event) => event.reason))
      .toEqual(expect.arrayContaining(['makes-attack', 'targeted-by-attack', 'hit-by-attack', 'takes-damage']))
  })

  it('ends a source-linked charm when its own source harms the target', () => {
    const friendshipCharm = createDnd5eConditionEffect({
      condition: 'charmed',
      targetId: 'target',
      source: { kind: 'spell', actorId: 'source', rulesId: 'animal-friendship' },
      removal: { sourceLink: { targetHarmedBySourceAlly: true } },
    })
    const state = startDnd5eHeadlessCombat('source-harms-linked-target', [
      combatant('source', 20),
      combatant('target', 10, {
        controller: 'dm',
        position: { x: 5, y: 0 },
        classState: { activeEffects: [friendshipCharm] },
      }),
    ])

    const attacked = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'source', targetId: 'target', attackModifier: 8, d20: 15,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })

    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    expect(attacked.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(attacked.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'target', reason: 'harmful-action',
    }))
  })

  it('keeps a source-linked charm when the source misses the target', () => {
    const friendshipCharm = createDnd5eConditionEffect({
      condition: 'charmed',
      targetId: 'target',
      source: { kind: 'spell', actorId: 'source', rulesId: 'animal-friendship' },
      removal: { sourceLink: { targetHarmedBySourceAlly: true } },
    })
    const state = startDnd5eHeadlessCombat('source-misses-linked-target', [
      combatant('source', 20),
      combatant('target', 10, {
        controller: 'dm',
        armorClass: 20,
        position: { x: 5, y: 0 },
        classState: { activeEffects: [friendshipCharm] },
      }),
    ])

    const missed = resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'source', targetId: 'target', attackModifier: 0, d20: 2,
      damage: { count: 1, sides: 4, bonus: 0, rolls: [2] },
    })

    expect(missed.ok).toBe(true)
    if (!missed.ok) return
    expect(missed.state.combatants.target.classState.activeEffects).toContainEqual(
      expect.objectContaining({ definitionId: 'condition:charmed' }),
    )
    expect(missed.events).not.toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'target', reason: 'harmful-action',
    }))
  })

  it('removes pre-existing effects when their actor spends an action', () => {
    const untilAction = createDnd5eConditionEffect({
      condition: 'invisible', targetId: 'actor', source: { kind: 'feature' },
      duration: { type: 'permanent' }, breakOn: ['spends-action'],
    })
    const state = startDnd5eHeadlessCombat('action-economy-break', [
      combatant('actor', 20, { classState: { activeEffects: [untilAction] } }),
      combatant('target', 10),
    ])
    const dashed = resolveDnd5eHeadlessAction(state, { type: 'dash', actorId: 'actor' })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) return
    expect(dashed.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(dashed.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'actor', reason: 'spends-action',
    }))
  })

  it('removes a casting-sensitive invisibility effect while preserving advantage for the first spell attack', () => {
    const invisibility = createDnd5eConditionEffect({
      condition: 'invisible', targetId: 'caster', source: { kind: 'spell', rulesId: 'invisibility' },
      breakOn: ['makes-attack', 'casts-spell'],
    })
    const state = startDnd5eHeadlessCombat('spell-break', [
      combatant('caster', 20, {
        classId: 'wizard', level: 1,
        classSelections: { 'spell-cantrips': ['fire-bolt'] },
        classState: { activeEffects: [invisibility] },
      }),
      combatant('target', 10, { controller: 'dm', position: { x: 30, y: 0 } }),
    ])
    const cast = resolveDnd5eHeadlessAction(state, {
      type: 'cast-spell', actorId: 'caster', targetId: 'target', spellId: 'fire-bolt', slotLevel: 0,
      d20: 2, d20Second: 18, effectRolls: [4],
    })
    expect(cast.ok).toBe(true)
    if (!cast.ok) return
    expect(cast.state.combatants.caster.classState.activeEffects).toBeUndefined()
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-removed', targetId: 'caster', reason: 'casts-spell',
    }))
    expect(cast.events).toContainEqual(expect.objectContaining({
      type: 'attack-resolved', actorId: 'caster', d20: 18,
    }))
  })

  it('ends concentration-linked effects when the source loses concentration', () => {
    const linked = createDnd5eConditionEffect({
      condition: 'restrained', targetId: 'target', source: { kind: 'spell', actorId: 'caster', rulesId: 'web' },
      duration: { type: 'concentration', sourceActorId: 'caster', concentrationId: 'web' },
    })
    const state = startDnd5eHeadlessCombat('concentration', [
      combatant('caster', 20, {
        concentrating: true,
        classState: { concentrationSpellId: 'web', concentrationTargetIds: ['target'], concentrationRoundsRemaining: 10 },
      }),
      combatant('target', 10, { classState: { activeEffects: [linked], concentrationEffectsBySource: { caster: 'web' } } }),
    ])
    const resolved = resolveDnd5eHeadlessAction(state, { type: 'concentration-save', actorId: 'caster', d20: 1, dc: 10 })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.caster.concentrating).toBe(false)
    expect(resolved.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'active-effect-removed', reason: 'concentration-ended' }))
  })

  it('resolves repeated end-of-turn saves and round expiry authoritatively', () => {
    const savedEffect = createDnd5eConditionEffect({
      condition: 'blinded', targetId: 'actor', source: { kind: 'spell', actorId: 'target' },
      duration: { type: 'rounds', remainingRounds: 3, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc: 12, timing: 'target-turn-end', onSuccess: 'remove' },
    })
    const expiredEffect = createDnd5eConditionEffect({
      condition: 'deafened', targetId: 'actor', source: { kind: 'dm' },
      duration: { type: 'rounds', remainingRounds: 1, tickOn: 'target-turn-end' },
    })
    const state = startDnd5eHeadlessCombat('turn-end', [
      combatant('actor', 20, { classState: { activeEffects: [savedEffect, expiredEffect] } }),
      combatant('target', 10),
    ])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn', actorId: 'actor',
      activeEffectSavingThrows: [{ effectId: savedEffect.id, d20: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.actor.classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({ type: 'active-effect-save-resolved', success: true }))
    expect(resolved.events.filter((event) => event.type === 'active-effect-removed').map((event) => event.reason))
      .toEqual(expect.arrayContaining(['save-succeeded', 'expired']))
  })

  it('grants Protection from Poison advantage on a poisoned repeat save', () => {
    const protection = createDnd5eMechanicalEffect({
      id: 'protection-from-poison',
      definitionId: 'srd-5.1:spell:protection-from-poison',
      label: 'Protection from Poison',
      kind: 'buff',
      source: { kind: 'spell', actorId: 'source', rulesId: 'protection-from-poison' },
      targetId: 'actor',
    })
    const poisoned = createDnd5eConditionEffect({
      id: 'quasit-poison',
      condition: 'poisoned',
      targetId: 'actor',
      source: { kind: 'monster', actorId: 'source', rulesId: 'monster:quasit:claw:poison' },
      duration: { type: 'rounds', remainingRounds: 10, tickOn: 'target-turn-end' },
      repeatSave: { ability: 'con', dc: 12, timing: 'target-turn-end', onSuccess: 'remove' },
    })
    const state = startDnd5eHeadlessCombat('poison-protection', [
      combatant('actor', 20, { classState: { activeEffects: [protection, poisoned] } }),
      combatant('source', 10, { controller: 'dm' }),
    ])

    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn',
      actorId: 'actor',
      activeEffectSavingThrows: [{ effectId: poisoned.id, d20: 1, d20Second: 20 }],
    })

    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'saving-throw-resolved',
      targetId: 'actor',
      d20: 20,
      d20Rolls: [1, 20],
      rollMode: 'advantage',
      success: true,
    }))
    expect(resolved.state.combatants.actor.conditions).not.toContain('poisoned')
    expect(resolved.state.combatants.actor.classState.activeEffects?.map((effect) => effect.id))
      .toEqual(['protection-from-poison'])
  })

  it('resolves the next creature repeated start-of-turn save during the authoritative turn transaction', () => {
    const startSave = createDnd5eConditionEffect({
      condition: 'restrained', targetId: 'target', source: { kind: 'spell', actorId: 'actor' },
      duration: { type: 'rounds', remainingRounds: 2, tickOn: 'target-turn-start' },
      repeatSave: { ability: 'str', dc: 12, timing: 'target-turn-start', onSuccess: 'remove' },
    })
    const state = startDnd5eHeadlessCombat('turn-start-save', [
      combatant('actor', 20),
      combatant('target', 10, { classState: { activeEffects: [startSave] } }),
    ])
    const resolved = resolveDnd5eHeadlessAction(state, {
      type: 'end-turn', actorId: 'actor',
      turnStartActiveEffectSavingThrows: [{ effectId: startSave.id, d20: 20 }],
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.state.combatants.target.classState.activeEffects).toBeUndefined()
    expect(resolved.events).toContainEqual(expect.objectContaining({
      type: 'active-effect-save-resolved', targetId: 'target', success: true,
    }))
  })
})


describe('absolute movement caps with conflicting effects', () => {
  it.each([
    [{ speedMinimumFeet: 30 }, 10],
    [{ speedOverrideFeet: 60 }, 10],
    [{ speedOverrideFeet: 0 }, 0],
    [{ speedBonusFeet: 30, speedMultiplier: 2 }, 10],
  ] as const)('keeps the upper bound for Headless and character sheets: %j', (other, expected) => {
    const activeEffects = [
      createDnd5eMechanicalEffect({ definitionId: 'cap', label: 'Cap', targetId: 'target', source: { kind: 'spell', actorId: 'source', rulesId: 'cap' }, modifiers: { speedMaximumFeet: 10 } }),
      createDnd5eMechanicalEffect({ definitionId: 'other', label: 'Other', targetId: 'target', source: { kind: 'spell', actorId: 'source', rulesId: 'other' }, modifiers: other }),
    ]
    const target = combatant('target', 10, { classState: { activeEffects } })
    expect(dnd5eEffectiveSpeed(target)).toBe(expected)
    expect(dnd5eEffectiveWalkingSpeed({ charClass: 'wizard', level: 15, speed: 30, equipment: [], dnd5eCombatState: { activeEffects } } as Parameters<typeof dnd5eEffectiveWalkingSpeed>[0])).toBe(expected)
  })
})


describe('absolute caps apply independently to every movement mode', () => {
  it.each([5, 30])('caps a %s-foot walk without scaling it by the fastest mode', walk => {
    const activeEffects = [createDnd5eMechanicalEffect({ definitionId: 'cap', label: 'Cap', targetId: 'target', source: { kind: 'spell', actorId: 'source', rulesId: 'cap' }, modifiers: { speedMaximumFeet: 10 } })]
    const target = combatant('target', 10, { speed: 80, movementSpeeds: { walk, fly: 80, climb: 20, swim: 40 }, classState: { activeEffects } })
    expect(dnd5eEffectiveWalkSpeed(target)).toBe(Math.min(walk, 10))
    expect(dnd5eEffectiveFlySpeed(target)).toBe(10)
    expect(dnd5eEffectiveOptionalMovementSpeed(target, 'climb')).toBe(10)
    expect(dnd5eEffectiveOptionalMovementSpeed(target, 'swim')).toBe(10)
    expect(dnd5eEffectiveMovementPoolSpeed(target)).toBe(10)
  })
})


describe('spellcasting save persistence', () => {
  it('retains its own save separately from the save that ends the effect', () => {
    const effect = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'target', source: { kind: 'spell', actorId: 'source' }, spellcastingSave: { ability: 'con', dc: 18 }, repeatSave: { ability: 'con', dc: 18, timing: 'target-turn-end', onSuccess: 'remove' } })
    const restored = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect])))
    expect(restored[0].spellcastingSave).toEqual({ ability: 'con', dc: 18 })
    expect(restored[0].repeatSave).toEqual(effect.repeatSave)
    expect(validateDnd5eActiveEffectsStrict([{ ...effect, spellcastingSave: { ability: 'luck', dc: 18 } }]).ok).toBe(false)
  })
})


describe('spellcasting save costs and outcome', () => {
  it.each([1, 20, undefined])('uses explicit save %s before native spell effects', d20 => {
    const effect = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'caster', source: { kind: 'spell', actorId: 'target' }, spellcastingSave: { ability: 'con', dc: 18 } })
    const caster = combatant('caster', 20, { classId: 'wizard', level: 5, proficiencyBonus: 3, classSelections: { 'spell-prepared': ['magic-missile'] }, classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } }, classState: { activeEffects: [effect] } })
    const state = startDnd5eHeadlessCombat('pain-cast', [caster, combatant('target', 10, { controller: 'dm', position: { x: 5, y: 0 } })])
    const before = JSON.stringify(state)
    expect(previewDnd5eSpellcastingSaves(state, 'caster', d20 == null ? undefined : [{effectId: effect.id, d20}])).toBe(d20 == null ? undefined : d20 === 20)
    expect(JSON.stringify(state)).toBe(before)
    const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'target', targetIds: ['target'], projectileTargetIds: ['target','target','target'], spellId: 'magic-missile', slotLevel: 1, effectRolls: [4,3,2], spellcastingSavingThrows: d20 == null ? undefined : [{ effectId: effect.id, d20 }] })
    expect(result.ok, result.ok ? '' : result.reason).toBe(d20 != null)
    expect(JSON.stringify(state)).toBe(before)
    if (!result.ok) { expect(result.reason).toBe('invalid-dice'); return }
    expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
    expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
    expect(result.state.combatants.target.currentHp).toBe(d20 === 20 ? 8 : 20)
    expect(result.state.combatants.caster.classState.activeEffects?.some(e => e.id === effect.id)).toBe(true)
    expect(result.events.filter(e => e.type === 'saving-throw-resolved')).toHaveLength(1)
  })
})


it.each([1, 20, undefined])('Activity casting save %s consumes costs without applying a failed spell', d20 => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'caster', source: { kind: 'spell', actorId: 'target' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = combatant('caster', 20, { classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } }, classState: { activeEffects: [effect] } })
  const state = startDnd5eHeadlessCombat('pain-activity', [caster, combatant('target', 10)])
  const result = commitDnd5eActivityExecution(state, { actorId: 'caster', activityId: 'test-spell', castLevel: 1, targetIds: ['target'], source: { kind: 'spell', id: 'test-spell', packageId: 'local.test' }, spellcastingSavingThrows: d20 == null ? undefined : [{ effectId: effect.id, d20 }], resolution: { ok: true, status: 'resolved', checks: [], consumptions: [{ kind: 'spell-slot', minimumLevel: 1, level: 'selected', amount: 1, consumeOn: 'resolve' }, { kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }], proposals: [{ kind: 'adjust-exhaustion', operationId: 'fatigue', targetId: 'target', amount: 1 }] } })
  expect(result.ok, result.ok ? '' : result.reason).toBe(d20 != null)
  if (!result.ok) { expect(result.state).toEqual(state); return }
  expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
  expect(result.state.combatants.target.exhaustionLevel ?? 0).toBe(d20 === 20 ? 1 : 0)
  expect(result.state.combatants.caster.classState.activeEffects?.some(e => e.id === effect.id)).toBe(true)
})


it.each([1, 20, undefined])('adjudicated spell casting save %s preserves costs and blocks effects', d20 => {
  const effect = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'caster', source: { kind: 'spell', actorId: 'target' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = combatant('caster', 20, { classId: 'wizard', level: 5, classSelections: { 'spell-prepared': ['magic-missile'] }, classResources: { 'dnd5e-spell-slot-1': { current: 1, max: 1 } }, classState: { activeEffects: [effect] } })
  const state = startDnd5eHeadlessCombat('pain-adjudicated', [caster, combatant('target', 10, { controller: 'dm' })])
  const result = resolveDnd5eHeadlessAction(state, { type: 'adjudicated-spell', actorId: 'caster', spellId: 'magic-missile', spellName: 'Magic Missile', spellLevel: 1, slotLevel: 1, castingTime: 'action', effects: [{ targetId: 'target', operation: 'damage', amount: 12 }], spellcastingSavingThrows: d20 == null ? undefined : [{ effectId: effect.id, d20 }] })
  expect(result.ok, result.ok ? '' : result.reason).toBe(d20 != null)
  if (!result.ok) { expect(result.reason).toBe('invalid-dice'); return }
  expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
  expect(result.state.combatants.target.currentHp).toBe(d20 === 20 ? 8 : 20)
  expect(result.events.filter(e=>e.type==='saving-throw-resolved')).toHaveLength(1)
})


it.each([1,20])('Counterspell casting save %s spends the reaction even when casting fails', d20 => {
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'reactor',source:{kind:'spell',actorId:'caster'},spellcastingSave:{ability:'con',dc:18}})
  const caster=combatant('caster',20,{classId:'wizard',level:5,classSelections:{'spell-cantrips':['fire-bolt']}})
  const reactor=combatant('reactor',10,{controller:'dm',classId:'wizard',level:5,position:{x:5,y:0},classSelections:{'spell-prepared':['counterspell']},classResources:{'dnd5e-spell-slot-3':{current:1,max:1}},classState:{activeEffects:[pain]}})
  const state=startDnd5eHeadlessCombat('pain-counterspell',[caster,reactor])
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('caster','reactor')]:5}
  const result=resolveDnd5eHeadlessAction(state,{type:'cast-spell',actorId:'caster',targetId:'reactor',spellId:'fire-bolt',slotLevel:0,d20:15,effectRolls:[6,6],counterspellReaction:{actorId:'reactor',slotLevel:3,spellcastingSavingThrows:[{effectId:pain.id,d20}]}})
  expect(result.ok,result.ok?'':result.reason).toBe(true)
  if(!result.ok)return
  expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
  expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.reactor.currentHp).toBe(d20===20?20:8)
  expect(result.events).toContainEqual(expect.objectContaining({type:'counterspell-resolved',success:d20===20}))
})


it.each([1,20,undefined])('Feather Fall casting save %s does not grant protection on failure',d20=>{
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'caster',source:{kind:'spell',actorId:'target'},spellcastingSave:{ability:'con',dc:18}})
  const caster=combatant('caster',20,{classId:'wizard',level:5,classSelections:{'spell-prepared':['feather-fall']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}},classState:{activeEffects:[pain]}})
  const state=startDnd5eHeadlessCombat('pain-feather',[caster,combatant('target',10)])
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('caster','target')]:5}
  const result=resolveDnd5eFeatherFallReaction(state,{casterId:'caster',falls:[{combatantId:'target',fromElevationFeet:30,groundElevationFeet:0,fallDistanceFeet:30,fallingDamageDice:3}],spellcastingSavingThrows:d20==null?undefined:[{effectId:pain.id,d20}]})
  expect(result.ok,result.ok?'':result.reason).toBe(d20!=null)
  if(!result.ok){expect(result.state).toEqual(state);return}
  expect(result.state.combatants.caster.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.caster.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(result.state.combatants.target.classState.activeEffects?.some(e=>e.source.rulesId==='feather-fall')??false).toBe(d20===20)
})


it.each([1,20])('Hellish Rebuke casting save %s precedes target saves and damage',d20=>{
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'caster',source:{kind:'spell',actorId:'target'},spellcastingSave:{ability:'con',dc:18}})
  const caster=combatant('caster',20,{classId:'warlock',level:3,classSelections:{'spell-known':['hellish-rebuke']},classResources:{'dnd5e-pact-slot':{current:1,max:2}},classState:{activeEffects:[pain]}})
  const state=startDnd5eHeadlessCombat('pain-rebuke',[caster,combatant('target',10,{controller:'dm'})])
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('caster','target')]:5}
  const result=resolveDnd5eHeadlessAction(state,{type:'hellish-rebuke',actorId:'caster',targetId:'target',slotLevel:2,triggerDamageAmount:1,spellcastingSavingThrows:[{effectId:pain.id,d20}],savingThrowD20:d20===20?1:0,effectRolls:d20===20?[2,2,2]:[]})
  expect(result.ok,result.ok?'':result.reason).toBe(true)
  if(!result.ok)return
  expect(result.state.combatants.caster.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.caster.classResources['dnd5e-pact-slot'].current).toBe(0)
  expect(result.state.combatants.target.currentHp).toBe(d20===20?14:20)
  expect(result.events.filter(e=>e.type==='saving-throw-resolved'&&e.targetId==='target')).toHaveLength(d20===20?1:0)
})


it.each([1,20,undefined])('Shield casting save %s consumes the attempt without granting failed protection',d20=>{
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'reactor',source:{kind:'spell',actorId:'caster'},spellcastingSave:{ability:'con',dc:18}})
  const caster=combatant('caster',20,{classId:'wizard',level:5,classSelections:{'spell-prepared':['magic-missile']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}}})
  const reactor=combatant('reactor',10,{controller:'dm',classId:'wizard',level:5,classSelections:{'spell-prepared':['shield']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}},classState:{activeEffects:[pain]}})
  const state=startDnd5eHeadlessCombat('pain-shield',[caster,reactor])
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('caster','reactor')]:5}
  const result=resolveDnd5eHeadlessAction(state,{type:'cast-spell',actorId:'caster',targetId:'reactor',spellId:'magic-missile',slotLevel:1,effectRolls:[4,3,2],projectileTargetIds:['reactor','reactor','reactor'],shieldSpellReactionTargetIds:['reactor'],shieldSpellcastingSavingThrows:d20==null?undefined:{reactor:[{effectId:pain.id,d20}]}})
  expect(result.ok,result.ok?'':result.reason).toBe(d20!=null)
  if(!result.ok)return
  expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(result.state.combatants.reactor.classState.shieldSpellActive??false).toBe(d20===20)
  expect(result.state.combatants.reactor.currentHp).toBe(d20===20?20:8)
})

it.each([1,20,undefined])('Shield casting save %s reevaluates the triggering weapon attack',d20=>{
  const pain=createDnd5eMechanicalEffect({definitionId:'pain',label:'Pain',targetId:'reactor',source:{kind:'spell',actorId:'caster'},spellcastingSave:{ability:'con',dc:18}})
  const caster=combatant('caster',20,{classId:'wizard',level:5,classSelections:{'spell-prepared':['magic-missile']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}}})
  const reactor=combatant('reactor',10,{controller:'dm',classId:'wizard',level:5,classSelections:{'spell-prepared':['shield']},classResources:{'dnd5e-spell-slot-1':{current:1,max:1}},classState:{activeEffects:[pain]}})
  const state=startDnd5eHeadlessCombat('pain-shield',[caster,reactor])
  state.distanceFeetByCombatantPair = {[dnd5eCombatantPairKey('caster','reactor')]:5}
  const result=resolveDnd5eHeadlessAction(state,{type:'attack',actorId:'caster',targetId:'reactor',attackModifier:2,d20:12,shieldSpellReaction:true,damage:{count:1,sides:6,bonus:0,rolls:[4]},shieldSpellcastingSavingThrows:d20==null?undefined:{reactor:[{effectId:pain.id,d20}]}})
  expect(result.ok,result.ok?'':result.reason).toBe(d20!=null)
  if(!result.ok)return
  expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
  expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-1'].current).toBe(0)
  expect(result.state.combatants.reactor.classState.shieldSpellActive??false).toBe(d20===20)
  expect(result.state.combatants.reactor.currentHp).toBe(d20===20?20:16)
})

it.each([1, 20])('spends one failed or successful Shield attempt across three rays: %s', d20 => {
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'reactor',
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = combatant('caster', 20, { classId: 'wizard', level: 5,
    classSelections: { 'spell-prepared': ['scorching-ray'] },
    classResources: { 'dnd5e-spell-slot-2': { current: 1, max: 1 } } })
  const reactor = combatant('reactor', 10, { controller: 'dm', classId: 'wizard', level: 5,
    classSelections: { 'spell-prepared': ['shield'] },
    classResources: { 'dnd5e-spell-slot-1': { current: 2, max: 2 } }, classState: { activeEffects: [pain] } })
  const state = startDnd5eHeadlessCombat('pain-rays', [caster, reactor])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'reactor')]: 5 }
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster',
    targetId: 'reactor', spellId: 'scorching-ray', slotLevel: 2, effectRolls: [],
    projectileTargetIds: ['reactor', 'reactor', 'reactor'],
    targetAttacks: [0, 1, 2].map(index => ({ targetId: 'reactor', d20: 12, d20Second: 12,
      shieldSpellReaction: index === 0, effectRolls: d20 === 20 ? [] : [2, 2] })),
    shieldSpellcastingSavingThrows: { reactor: [{ effectId: pain.id, d20 }] } })
  expect(result.ok, result.ok ? '' : result.reason).toBe(true)
  if (!result.ok) return
  expect(result.state.combatants.reactor.currentHp).toBe(d20 === 20 ? 20 : 8)
  expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-1'].current).toBe(1)
  expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
  expect(result.events.filter(e => e.type === 'spell-cast' && e.spellId === 'shield')).toHaveLength(1)
  expect(result.events.filter(e => e.type === 'saving-throw-resolved' && e.targetId === 'reactor')).toHaveLength(1)
})

it.each([{ save: 1, check: undefined, valid: true, countered: false },
  { save: 20, check: 18, valid: true, countered: true },
  { save: 20, check: undefined, valid: false, countered: false }])('checks Counterspell only after casting succeeds: $save/$check', ({ save, check, valid, countered }) => {
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'reactor',
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = combatant('caster', 20, { classId: 'wizard', level: 7,
    classSelections: { 'spell-prepared': ['magic-missile'] }, classResources: { 'dnd5e-spell-slot-4': { current: 1, max: 1 } } })
  const reactor = combatant('reactor', 10, { controller: 'dm', classId: 'wizard', level: 5,
    classSelections: { 'spell-prepared': ['counterspell'] }, classResources: { 'dnd5e-spell-slot-3': { current: 1, max: 1 } },
    classState: { activeEffects: [pain] } })
  const state = startDnd5eHeadlessCombat('pain-counterspell-high', [caster, reactor])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('caster', 'reactor')]: 30 }
  const result = resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'caster', targetId: 'reactor',
    spellId: 'magic-missile', slotLevel: 4, projectileTargetIds: Array(6).fill('reactor'), effectRolls: Array(6).fill(1),
    counterspellReaction: { actorId: 'reactor', slotLevel: 3, abilityCheckTotal: check,
      spellcastingSavingThrows: [{ effectId: pain.id, d20: save }] } })
  expect(result.ok, result.ok ? '' : result.reason).toBe(valid)
  if (!result.ok) {
    expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-3'].current).toBe(1)
    return
  }
  expect(result.state.combatants.reactor.currentHp).toBe(countered ? 20 : 8)
  expect(result.state.combatants.reactor.classResources['dnd5e-spell-slot-3'].current).toBe(0)
  expect(result.state.combatants.reactor.turn.reactionAvailable).toBe(false)
  expect(result.events).toContainEqual(expect.objectContaining({ type: 'counterspell-resolved', success: countered }))
})
it.each([1, 20, undefined])('checks manually adjudicated monster spell casting: %s', d20 => {
  const pain = createDnd5eMechanicalEffect({ definitionId: 'pain', label: 'Pain', targetId: 'caster',
    source: { kind: 'spell' }, spellcastingSave: { ability: 'con', dc: 18 } })
  const caster = combatant('caster', 20, { statBlockId: 'srd-5.1:mage',
    classState: { activeEffects: [pain], monsterSpellSlots: { 1: { current: 1, max: 1 } } } })
  const target = combatant('target', 10, { controller: 'dm' })
  const state = startDnd5eHeadlessCombat('manual-pain', [caster, target])
  const result = resolveDnd5eHeadlessAction(state, { type: 'monster-spell', actorId: 'caster', spellId: 'magic-missile', slotLevel: 1,
    effects: [{ targetId: 'target', operation: 'damage', amount: 6 }],
    spellcastingSavingThrows: d20 == null ? undefined : [{ effectId: pain.id, d20 }] })
  expect(result.ok, result.ok ? '' : result.reason).toBe(d20 != null)
  if (!result.ok) {
    expect(result.state.combatants.caster.classState.monsterSpellSlots?.[1].current).toBe(1)
    return
  }
  expect(result.state.combatants.target.currentHp).toBe(d20 === 20 ? 14 : 20)
  expect(result.state.combatants.caster.classState.monsterSpellSlots?.[1].current).toBe(0)
  expect(result.state.combatants.caster.turn.actionAvailable).toBe(false)
  expect(result.events.filter(e => e.type === 'spellcasting-prevented')).toHaveLength(d20 === 20 ? 0 : 1)
})
