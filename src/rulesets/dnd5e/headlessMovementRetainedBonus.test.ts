import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eDeferredMovementRepeatSaves, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { normalizeDnd5ePendingMovementCompletions } from './pendingMovementCompletion'

it.each((['marked', 'other', 'low', 'skip', 'twice', 'second-other'] as const).flatMap(mode =>
  (['deferred', 'move'] as const).map(path => ({ mode, path }))))('settles a saved movement choice with its true source: $mode / $path', ({ mode, path }) => {
  const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: id === 'hero' ? 20 : 10,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
    armorClass: 10, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const hero = make('hero'), source = make('source')
  hero.classLevels = { ranger: mode === 'low' ? 6 : 7 }
  hero.classState.activeEffects = [
    createDnd5eMechanicalEffect({ id: 'prey', definitionId: 'test:prey', label: 'Prey', targetId: 'hero',
      source: { kind: 'feature', actorId: 'hero' }, modifiers: {
        onHitBonusDamage: { count: 1, sides: 6, bonus: 0, damageType: 'inherit-primary', appliesTo: 'all-weapon-attacks',
          doubleDiceOnCritical: true, oncePerTurn: true, consumeEffectOnHit: false, boundTargetId: mode === 'other' ? 'other' : 'source' },
        optionalBonusDie: { sides: 6, appliesTo: ['saving-throw'], consumeOnUse: false,
          boundTargetSource: { classId: 'ranger', minimumLevel: 7 } },
      } }),
    createDnd5eMechanicalEffect({ id: 'compulsion', definitionId: 'test:move-save', label: 'Compulsion', targetId: 'hero',
      source: { kind: 'spell', actorId: 'source' },
      repeatSave: { ability: 'wis', dc: 15, timing: 'after-movement', onSuccess: 'remove' } }),
  ]
  if (mode === 'twice' || mode === 'second-other') {
    hero.classState.activeEffects.push(createDnd5eMechanicalEffect({
      id: 'second', definitionId: 'test:second-save', label: 'Second', targetId: 'hero',
      source: { kind: 'spell', actorId: mode === 'second-other' ? 'other' : 'source' },
      repeatSave: { ability: 'wis', dc: 15, timing: 'after-movement', onSuccess: 'remove' },
    }))
  }
  const state = startDnd5eHeadlessCombat('movement', [hero, source]), before = structuredClone(state)
  const rolls = JSON.parse(JSON.stringify([{ effectId: 'compulsion', d20: 10,
    ...(mode === 'skip' ? {} : { optionalBonusDice: [{ effectId: 'prey', targetId: 'hero', rollKind: 'saving-throw', roll: 6 }] }) }]))
  if (mode === 'twice' || mode === 'second-other') rolls.push({
    effectId: 'second', d20: 10,
    optionalBonusDice: [{ effectId: 'prey', targetId: 'hero', rollKind: 'saving-throw', roll: 5 }],
  })
  const restored = normalizeDnd5ePendingMovementCompletions([{ id: 'move', actorTokenId: 'hero', rolls }])[0]
  expect(restored.rolls).toEqual(rolls)
  const result = path === 'deferred'
    ? resolveDnd5eDeferredMovementRepeatSaves(state, 'hero', true, restored.rolls)
    : resolveDnd5eHeadlessAction(state, { type: 'move', actorId: 'hero', to: { x: 5, y: 0 }, distance: 5,
        movementRepeatSavingThrows: restored.rolls })
  expect(result.ok).toBe(mode === 'marked' || mode === 'skip' || mode === 'twice')
  expect(state).toEqual(before)
  expect(result.state.combatants.hero.classState.activeEffects?.some(effect => effect.id === 'prey')).toBe(true)
  expect(result.state.combatants.hero.classState.activeEffects?.some(effect => effect.id === 'compulsion')).toBe(mode !== 'marked' && mode !== 'twice')
  if (mode === 'marked') expect(result.events).toContainEqual(expect.objectContaining({ type: 'optional-bonus-die-used', roll: 6 }))
  if (!result.ok) expect(result.state.combatants.hero.position).toEqual(before.combatants.hero.position)
  if (mode === 'twice') {
    expect(result.state.combatants.hero.classState.activeEffects?.some(effect => effect.id === 'second')).toBe(false)
    expect(result.events.filter(event => event.type === 'optional-bonus-die-used').map(event => event.roll)).toEqual([6, 5])
  }
  if (mode === 'second-other') {
    expect(result.state).toEqual(before)
    expect(result.events).toEqual([])
  }
})
