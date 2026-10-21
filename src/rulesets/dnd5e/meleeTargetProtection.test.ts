import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './activities/dnd5eActivityCombatAuthority'
import { createDnd5eCombatant, dnd5eCombatantPairKey, resolveDnd5eHeadlessAction, startDnd5eHeadlessCombat } from './headlessCombatEngine'

const combatant = (id: string, initiative: number) => createDnd5eCombatant({
  id, name: id, initiative, controller: 'player', abilities: { str: 16, dex: 16, con: 10, int: 16, wis: 10, cha: 10 },
  proficiencyBonus: 2, armorClass: 15, currentHp: 30, maxHp: 30, temporaryHp: 0, speed: 30,
  position: { x: 0, y: 0 }, concentrating: false,
})

it.each(['shocking-grasp', 'fire-bolt', 'unarmed', 'flurry', 'invalid-flurry'])('records native melee delivery, not ranged or failed transactions: %s', kind => {
  const state = startDnd5eHeadlessCombat('delivery', [combatant('actor', 20), combatant('target', 10)])
  const actor = state.combatants.actor
  state.combatants.target.controller = 'dm'
  actor.preventOpportunityAttacksFromMeleeAttackTargets = true
  actor.classId = 'wizard'; actor.level = 3
  actor.classSelections = { 'spell-cantrips': ['shocking-grasp', 'fire-bolt'] }
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
  actor.classLevels = { wizard: 1, monk: 2 }
  actor.classResources['dnd5e-ki'] = { current: 1, max: 1 }
  actor.classState.monkAttackActionTurnKey = 'delivery:1:actor'
  const before = structuredClone(state)
  const result = kind.includes('flurry') ? resolveDnd5eHeadlessAction(state, {
    type: 'monk-unarmed-bonus', actorId: 'actor', mode: 'flurry', attackModifier: 0,
    damage: { count: 1, sides: 4, bonus: 0 }, reachFeet: 5, damageType: 'bludgeoning',
    attacks: [{ targetId: 'target', d20: 1, damageRolls: [] },
      { targetId: kind === 'invalid-flurry' ? 'absent' : 'target', d20: 1, damageRolls: [] }],
  }) : kind === 'unarmed' ? resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
    attackModifier: 0, d20: 1, damage: { count: 1, sides: 4, bonus: 0, rolls: [] } })
    : resolveDnd5eHeadlessAction(state, { type: 'cast-spell', actorId: 'actor', targetId: 'target', spellId: kind,
      slotLevel: 0, castingClassId: 'wizard', d20: 1, effectRolls: [] })
  expect(result.ok, JSON.stringify(result)).toBe(kind !== 'invalid-flurry')
  expect(state).toEqual(before)
  expect(result.state.combatants.actor.classState.meleeAttackTargetIdsThisTurn)
    .toEqual(['fire-bolt', 'invalid-flurry'].includes(kind) ? undefined : ['target'])
  if (kind === 'shocking-grasp' || kind === 'fire-bolt') {
    expect(result.events.find(event => event.type === 'attack-resolved')).toMatchObject({
      attackMode: 'spell', attackDelivery: kind === 'shocking-grasp' ? 'melee' : 'ranged',
    })
  }
})

it.each(['melee', 'ranged'] as const)('preserves declared %s delivery through exported Activity entries', async delivery => {
  const namespace = `test.delivery-${delivery}`
  const activity = { schemaVersion: 1 as const, id: 'strike', name: 'Synthetic strike', activation: { kind: 'action' as const },
    legacySource: { kind: 'feature' as const, id: 'strike' },
    target: { kind: 'creature' as const, relation: 'any' as const, count: 1, rangeFeet: 30 },
    checks: [{ id: 'attack', kind: 'attack-roll' as const, rollId: 'attack', attackBonus: { kind: 'constant' as const, value: 0 },
      rollMode: 'normal' as const, delivery, scope: 'per-target' as const }],
    outcomes: [{ id: 'test', when: { kind: 'always' as const }, operations: [{ id: 'temp', kind: 'temporary-hit-points' as const,
      target: 'actor' as const, amount: { kind: 'constant' as const, value: 1 } }] }], automation: automationCapabilityFromLegacyStatus('full') }
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Delivery', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'strike', name: 'Strike',
      automation: activity.automation, activities: [activity], payload: { id: 'strike', name: 'Strike', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }] }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try { for (const entry of ['registered', 'compiled']) {
    const state = startDnd5eHeadlessCombat('delivery', [combatant('actor', 20), combatant('target', 10)])
    state.combatants.actor.preventOpportunityAttacksFromMeleeAttackTargets = true
    state.combatants.actor.pluginFeatureIds = [`${namespace}:strike`]
    state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('actor', 'target')]: 5 }
    const rolls = { 'attack:target': { values: [1], modifier: 0, total: 1 } }
    const registered = entry === 'registered' ? resolveRegisteredDnd5eActivityInCombatV1({ state, combatRevision: 1,
      authoritativeRolls: rolls, confirmedBy: 'actor', command: { schemaVersion: 1, commandId: 'strike', actorId: 'actor',
        packageId: namespace, packageVersion: '1.0.0', activityId: 'strike', targetIds: ['target'], expectedRevision: 1 } }) : undefined
    const result = registered ? (registered.phase === 'commit' ? registered.result : undefined)
      : resolveDnd5eHeadlessAction(state, { type: 'plugin', pluginId: namespace, actionId: 'strike', featureId: `${namespace}:strike`,
        actorId: 'actor', targetId: 'target', targetIds: ['target'], distanceFeet: 5, rolls, payload: {} })
    expect(result?.ok, JSON.stringify(registered ?? result)).toBe(true)
    expect(result?.state.combatants.actor.classState.meleeAttackTargetIdsThisTurn).toEqual(delivery === 'melee' ? ['target'] : undefined)
    expect(result?.events.find(event => event.type === 'attack-resolved')).toMatchObject({ attackDelivery: delivery })
  } } finally { dispose() }
})

it.each([1, 18])('enforces per-target own-turn protection after a melee attack (d20=%s)', d20 => {
  let state = startDnd5eHeadlessCombat('protection', [combatant('mover', 20), combatant('first', 15), combatant('other', 10)])
  state.combatants.mover.preventOpportunityAttacksFromMeleeAttackTargets = true
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('mover', 'first')]: 5, [dnd5eCombatantPairKey('mover', 'other')]: 5 }
  const attack = (targetId: string) => ({ type: 'attack' as const, actorId: 'mover', targetId, attackModifier: 5, d20,
    spendAction: false, classDamageContext: { weaponId: 'shortsword', weaponProperties: ['finesse', 'light'], mode: 'melee' as const,
      reachFeet: 5, finesse: true, strengthBased: false, weaponDamageSides: 6, damageType: 'piercing' as const, adjacentEnemyOfTarget: false },
    damage: { count: 1, sides: 6, bonus: 0, rolls: d20 === 1 ? [] : [2], type: 'piercing' as const } })
  const first = resolveDnd5eHeadlessAction(state, attack('first'))
  expect(first.ok).toBe(true)
  state = JSON.parse(JSON.stringify(first.state))
  expect(state.combatants.mover.classState.meleeAttackTargetIdsThisTurn).toEqual(['first'])
  const opportunity = (actorId: string) => ({ type: 'opportunity-attack' as const, actorId, targetId: 'mover',
    attackModifier: 5, d20: 15, damage: { count: 1, sides: 4, bonus: 0, rolls: [2] } })
  const before = structuredClone(state)
  const refused = resolveDnd5eHeadlessAction(state, opportunity('first'))
  expect(refused).toMatchObject({ ok: false, reason: 'invalid-target' })
  expect(refused.state.combatants.first.turn.reactionAvailable).toBe(true)
  expect(refused.state.combatants.mover.currentHp).toBe(30)
  expect(state).toEqual(before)
  expect(resolveDnd5eHeadlessAction(state, opportunity('other')).ok).toBe(true)
  const second = resolveDnd5eHeadlessAction(state, attack('other'))
  expect(second.ok).toBe(true)
  state = second.state
  expect(state.combatants.mover.classState.meleeAttackTargetIdsThisTurn).toEqual(['first', 'other'])
  expect(resolveDnd5eHeadlessAction(state, opportunity('other')).ok).toBe(false)
  const wizard = structuredClone(state)
  Object.assign(wizard.combatants.first, { classId: 'wizard', level: 5, controller: 'dm',
    classSelections: { 'spell-cantrips': ['fire-bolt'] }, opportunityAttackSpellReplacement: true })
  expect(resolveDnd5eHeadlessAction(wizard, { type: 'cast-spell', actorId: 'first', targetId: 'mover', targetIds: ['mover'],
    castingClassId: 'wizard', spellId: 'fire-bolt', slotLevel: 0, opportunityAttackSpell: true,
    d20: 15, effectRolls: [6, 5] })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
  const retaliation = structuredClone(state)
  Object.assign(retaliation.combatants.first, { classId: 'barbarian', subclassId: 'berserker', level: 14 })
  retaliation.combatants.first.classState.berserkerRetaliationTrigger = { sourceId: 'mover', round: 1 }
  expect(resolveDnd5eHeadlessAction(retaliation, { ...opportunity('first'), reactionFeature: 'berserker-retaliation' }).ok).toBe(true)
  const ended = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId: 'mover' })
  expect(ended.ok).toBe(true)
  expect(ended.state.combatants.mover.classState.meleeAttackTargetIdsThisTurn).toBeUndefined()
  expect(resolveDnd5eHeadlessAction(ended.state, opportunity('first')).ok).toBe(true)
  const offTurn = structuredClone(state)
  offTurn.initiativeIndex = 1
  offTurn.combatants.mover.classState.meleeAttackTargetIdsThisTurn = undefined
  const reaction = resolveDnd5eHeadlessAction(offTurn, { ...opportunity('mover'), targetId: 'first' })
  expect(reaction.ok).toBe(true)
  expect(reaction.state.combatants.mover.classState.meleeAttackTargetIdsThisTurn).toBeUndefined()
})
