import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { normalizeCharacter } from '../../../store/characters'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, dnd5eLimitFlySpeed, validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { dnd5eEffectiveCharacterMovementProfile } from '../characterMovement'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, commitDnd5eActivityExecution, dnd5eEffectiveFlySpeed, dnd5eEffectiveSpeed, dnd5eEffectiveWalkSpeed, dnd5eEffectiveMovementPoolSpeed, endDnd5eConcentration, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1, id: 'flight-cap', name: 'Flight cap', activation: { kind: 'action' },
  target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 300 },
  effects: [{ schemaVersion: 1, id: 'cap', name: 'Cap', duration: { kind: 'concentration', maximumRounds: 10 }, stacking: 'replace', modifiers: [{ kind: 'flight-speed-limit', maximumFeet: 0 }] }],
  outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', effectId: 'cap', target: 'target' }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
}
const abilities = { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 }
const snapshot = { id: 'caster', controller: 'players' as const, level: 5, proficiencyBonus: 3, abilities, armorClass: 12, conditions: [], currentHp: 40, maxHp: 40 }
let effectIndex = 0
const effect = (modifiers: Parameters<typeof createDnd5eMechanicalEffect>[0]['modifiers'], magical = true) => createDnd5eMechanicalEffect({ id: `limit-${++effectIndex}`, definitionId: `test:flight-limit:${effectIndex}`, label: 'Limit', targetId: 'target', source: { kind: 'spell', magical }, duration: { type: 'permanent' }, modifiers })

it('commits the Activity cap without altering walking and restores native flight when concentration ends', () => {
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  const resolution = resolveDnd5eActivity({ activity, actor: snapshot, targets: [{ ...snapshot, id: 'target', controller: 'dm' }], rolls: {}, distanceFeetByTargetId: { target: 30 } })
  expect(resolution.ok).toBe(true)
  if (!resolution.ok) throw new Error(JSON.stringify(resolution))
  expect(resolution.proposals).toEqual(expect.arrayContaining([expect.objectContaining({ modifierGroups: [{ flySpeedLimitFeet: 0 }] })]))
  const make = (id: string) => createDnd5eCombatant({ ...snapshot, id, name: id, controller: 'dm', initiative: id === 'caster' ? 20 : 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const caster = make('caster'), target = make('target')
  target.movementSpeeds = { walk: 30, fly: 80 }
  const state = startDnd5eHeadlessCombat('flight-limit', [caster, target])
  const committed = commitDnd5eActivityExecution(state, { actorId: caster.id, activityId: activity.id, targetIds: [target.id], resolution, source: { kind: 'spell', id: activity.id } })
  expect(committed.ok).toBe(true)
  if (!committed.ok) throw new Error(committed.reason)
  const victim = committed.state.combatants.target
  expect(dnd5eEffectiveFlySpeed(victim)).toBeUndefined()
  expect(dnd5eEffectiveSpeed(victim)).toBe(30)
  expect(JSON.parse(JSON.stringify(victim.classState.activeEffects))).toEqual(expect.arrayContaining([expect.objectContaining({ modifiers: expect.objectContaining({ flySpeedLimitFeet: 0 }) })]))
  endDnd5eConcentration(committed.state, committed.state.combatants.caster, [])
  expect(dnd5eEffectiveFlySpeed(committed.state.combatants.target)).toBe(80)
})

it('preserves zero through normalization and applies caps after grants and bonuses', () => {
  const effects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify([effect({ flySpeedLimitFeet: 0 })])))
  expect(effects[0].modifiers?.flySpeedLimitFeet).toBe(0)
  expect(dnd5eLimitFlySpeed(effects, 180)).toBe(0)
  expect(dnd5eLimitFlySpeed([effect({ flySpeedLimitFeet: 40 }), effect({ flySpeedLimitFeet: 20 })], 80)).toBe(20)
  const creature = createDnd5eCombatant({ ...snapshot, name: 'target', controller: 'dm', initiative: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  creature.classState.activeEffects = [...effects, effect({ flySpeedFeet: 60, speedBonusFeet: 10, speedMultiplier: 2 })]
  expect(dnd5eEffectiveFlySpeed(creature)).toBeUndefined()
})

it('ignores suspended caps and bypasses only magical caps with freedom of movement', () => {
  expect(dnd5eLimitFlySpeed([{ ...effect({ flySpeedLimitFeet: 0 }), suspendedBy: ['antimagic'] }], 80)).toBe(80)
  const freedom = effect({ ignoreMagicalSpeedReductions: true })
  expect(dnd5eLimitFlySpeed([freedom, effect({ flySpeedLimitFeet: 0 })], 80)).toBe(80)
  expect(dnd5eLimitFlySpeed([freedom, effect({ flySpeedLimitFeet: 0 }, false)], 80)).toBe(0)
})

it('limits map movement in a flying form while preserving its walking speed', () => {
  const character = normalizeCharacter({ id: 'target', name: 'Target', speed: 30, dnd5eCombatState: { wildShapeFormId: 'srd-5.1:giant-eagle', wildShapeMode: 'polymorph', activeEffects: [effect({ flySpeedLimitFeet: 0 })] } })
  expect(dnd5eEffectiveCharacterMovementProfile(character)).toMatchObject({ walkSpeed: 10, flySpeed: undefined, maximumSpeed: 10 })
})

it('recomputes the legacy fastest-speed pool from remaining modes after flight is capped', () => {
  const creature = createDnd5eCombatant({ ...snapshot, name: 'Eagle', controller: 'dm', initiative: 10, temporaryHp: 0, speed: 80, position: { x: 0, y: 0 }, concentrating: false })
  creature.movementSpeeds = { walk: 10, fly: 80, swim: 20 }
  creature.classState.activeEffects = [effect({ flySpeedLimitFeet: 0 })]
  expect(dnd5eEffectiveWalkSpeed(creature)).toBe(10)
  expect(dnd5eEffectiveMovementPoolSpeed(creature)).toBe(20)
  creature.classState.activeEffects = [effect({ flySpeedLimitFeet: 40 })]
  expect(dnd5eEffectiveMovementPoolSpeed(creature)).toBe(40)
  creature.classState.activeEffects = []
  expect(dnd5eEffectiveMovementPoolSpeed(creature)).toBe(80)
})

it.each([-1, 1001, NaN])('rejects invalid cap %s at both input boundaries', maximumFeet => {
  const altered = structuredClone(activity)
  altered.effects![0].modifiers = [{ kind: 'flight-speed-limit', maximumFeet }]
  expect(validateDnd5eActivityDefinitionV1(altered).length).toBeGreaterThan(0)
  expect(validateDnd5eActiveEffectsStrict([effect({ flySpeedLimitFeet: maximumFeet })]).ok).toBe(false)
})

it.each([false, true])('forces safe descent through magical support only while flight is blocked (freedom=%s)', freedom => {
  const target = createDnd5eCombatant({ ...snapshot, id: 'target', name: 'Target', controller: 'dm', initiative: 10, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, elevationFeet: 100, groundElevationFeet: 0, concentrating: false })
  target.movementSpeeds = { walk: 30, fly: 80, hover: true }
  target.classState.activeEffects = [effect({ flySpeedLimitFeet: 0 }), effect({ flySpeedFeet: 60, hoverWhileFlying: true }), effect({ controlledDescent: { maximumFeetPerRound: 60, safeLanding: true, endsOnLanding: true, forceWhileFlightBlocked: true } }), ...(freedom ? [effect({ ignoreMagicalSpeedReductions: true })] : [])]
  const caster = createDnd5eCombatant({ ...snapshot, name: 'Caster', controller: 'player', initiative: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  let state = startDnd5eHeadlessCombat('descent', [caster, target])
  const first = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: caster.id })
  expect(first.ok, JSON.stringify(first)).toBe(true)
  expect(first.state.combatants.target).toMatchObject({ elevationFeet: freedom ? 100 : 40, currentHp: 40 })
  if (freedom) return
  state = first.state
  const between = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: target.id })
  const next = resolveDnd5eHeadlessAction(between.state, { type: 'end-turn', actorId: caster.id })
  expect(next.ok).toBe(true)
  expect(next.state.combatants.target).toMatchObject({ elevationFeet: 0, currentHp: 40, airborne: false })
  expect(dnd5eEffectiveFlySpeed(next.state.combatants.target)).toBeUndefined()
  expect(next.state.combatants.target.classState.activeEffects?.some(e => e.modifiers?.controlledDescent)).toBe(false)
})
