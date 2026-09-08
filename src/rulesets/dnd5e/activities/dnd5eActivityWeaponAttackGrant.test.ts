import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatEvent,
} from '../headlessCombatEngine'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { clearDnd5eActivityRegistryForTests, registerDnd5eActivityPackage } from './dnd5eActivityRegistry'
import { settleDnd5eActivityTriggerWindowsV1 } from './dnd5eActivityTriggerSettlement'

const PACKAGE_ID = 'local.test.feat-activity'
const activity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'follow-up',
  name: 'Follow-up weapon attack',
  activation: { kind: 'passive', timing: 'after attack' },
  invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice', retention: 'until-turn-end' },
  target: { kind: 'self' },
  requirements: [
    { kind: 'event-source', source: 'attack' },
    { kind: 'attack-mode', mode: 'melee' },
    { kind: 'attack-outcome', outcomes: ['critical-hit', 'target-dropped-to-zero'], match: 'any' },
    { kind: 'action-economy-available', economy: 'bonus-action' },
  ],
  outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{
    id: 'grant', kind: 'grant-weapon-attack', target: 'actor', grantId: 'follow-up',
    label: 'Follow-up', economy: 'bonus-action', expires: 'turn-end', weaponModes: ['melee'],
  }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
  legacySource: { kind: 'feat', id: 'follow-up-feat' },
}

const crossbowActivity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'crossbow-follow-up',
  name: 'Crossbow follow-up',
  activation: { kind: 'passive', timing: 'after a one-handed Attack action attack' },
  invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice', retention: 'until-turn-end' },
  target: { kind: 'self' },
  requirements: [
    { kind: 'event-source', source: 'attack' },
    { kind: 'attack-origin', origins: ['attack-action'] },
    { kind: 'attack-hands', hands: 1 },
    { kind: 'held-item', subject: 'actor', slot: 'either-hand', roles: ['weapon'], itemIds: ['dnd5e-hand-crossbow'] },
    { kind: 'free-hands', subject: 'actor', minimum: 1 },
    { kind: 'once-per-turn', key: 'crossbow-follow-up' },
    { kind: 'action-economy-available', economy: 'bonus-action' },
  ],
  outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{
    id: 'grant', kind: 'grant-weapon-attack', target: 'actor', grantId: 'crossbow-follow-up',
    label: 'Crossbow follow-up', economy: 'bonus-action', expires: 'turn-end',
    weaponModes: ['ranged'], weaponIds: ['dnd5e-hand-crossbow'], weaponSlots: ['main-hand', 'off-hand'],
  }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
  legacySource: { kind: 'feat', id: 'crossbow-expert-feat' },
}

const polearmActivity: Dnd5eActivityDefinitionV1 = {
  schemaVersion: 1,
  id: 'polearm-butt-attack',
  name: 'Polearm butt attack',
  activation: { kind: 'passive', timing: 'after a polearm Attack-action attack' },
  invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice', retention: 'until-turn-end' },
  target: { kind: 'self' },
  requirements: [
    { kind: 'event-source', source: 'attack' },
    { kind: 'attack-origin', origins: ['attack-action'] },
    { kind: 'attack-mode', mode: 'melee' },
    { kind: 'attack-weapon', weaponIds: ['dnd5e-quarterstaff'] },
    { kind: 'action-economy-available', economy: 'bonus-action' },
  ],
  outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{
    id: 'grant', kind: 'grant-weapon-attack', target: 'actor', grantId: 'polearm-butt-attack',
    label: 'Polearm butt attack', economy: 'bonus-action', expires: 'turn-end',
    weaponModes: ['melee'], weaponIds: ['dnd5e-quarterstaff'], proficient: true,
    damageDice: { count: 1, sides: 4 }, damageType: 'bludgeoning',
  }] }],
  automation: automationCapabilityFromLegacyStatus('full'),
  legacySource: { kind: 'feat', id: 'polearm-master' },
}

function combatant(id: string, controller: 'dm' | 'player', initiative: number) {
  return createDnd5eCombatant({
    id, name: id, controller, initiative,
    abilities: { str: 16, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false,
    pluginFeatureIds: ['follow-up-feat'],
  })
}

describe('unified Activity weapon attack grants', () => {
  afterEach(() => clearDnd5eActivityRegistryForTests())

  it('correlates a target drop in the same event batch and consumes the grant through the normal weapon authority', async () => {
    registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [activity] })
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const initial = startDnd5eHeadlessCombat('activity-follow-up', [actor, target])
    const sourceEvents: Dnd5eCombatEvent[] = [{
      type: 'attack-resolved', actorId: actor.id, targetId: target.id,
      d20: 12, total: 17, armorClass: 12, hit: true, critical: false,
      attackMode: 'melee', weaponId: 'srd-5.1:greatsword', weaponProperties: ['heavy', 'two-handed'],
      proficient: true, damageType: 'slashing',
    }, {
      type: 'hit-points-reduced-to-zero', sourceId: actor.id, targetId: target.id, hpBefore: 5,
    }]

    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: initial,
      events: sourceEvents,
      eventBatchId: 'drop-batch',
      combatRevision: 1,
      confirm: async () => true,
      roll: async () => [],
    })
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      activityId: activity.id, status: 'resolved',
    }))
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants?.['follow-up']).toMatchObject({
      grantId: 'follow-up', economy: 'bonus-action', weaponModes: ['melee'],
    })

    const followUp = resolveDnd5eHeadlessAction(settled.state, {
      type: 'attack', actorId: actor.id, targetId: target.id,
      attackModifier: 5, d20: 10, spendAction: false, spendBonusAction: true,
      activityWeaponAttackGrantId: 'follow-up',
      damage: { count: 1, sides: 6, bonus: 3, rolls: [4], type: 'slashing' },
      classDamageContext: {
        weaponId: 'srd-5.1:longsword', weaponProperties: ['versatile'], proficient: true,
        mode: 'melee', finesse: false, strengthBased: true, damageType: 'slashing',
        weaponDamageSides: 8, adjacentEnemyOfTarget: false,
      },
    })
    expect(followUp.ok, followUp.ok ? undefined : followUp.reason).toBe(true)
    if (!followUp.ok) return
    expect(followUp.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(followUp.state.combatants.actor.classState.activityWeaponAttackGrants).toBeUndefined()
  })

  it('does not open the credential after an ordinary nonlethal hit', async () => {
    registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [activity] })
    const actor = combatant('actor', 'player', 20)
    const target = combatant('target', 'dm', 10)
    const initial = startDnd5eHeadlessCombat('activity-follow-up-miss', [actor, target])
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: initial,
      events: [{
        type: 'attack-resolved', actorId: actor.id, targetId: target.id,
        d20: 12, total: 17, armorClass: 12, hit: true, critical: false,
        attackMode: 'melee', weaponId: 'srd-5.1:longsword', proficient: true,
      }],
      eventBatchId: 'ordinary-hit', combatRevision: 1,
      confirm: async () => true, roll: async () => [],
    })
    expect(settled.diagnostics).toHaveLength(0)
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants).toBeUndefined()
  })

  it('grants a hand-crossbow bonus attack only after a one-handed Attack-action attack', async () => {
    registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [crossbowActivity] })
    const actor = combatant('actor', 'player', 20)
    actor.pluginFeatureIds = ['crossbow-expert-feat']
    actor.activityEquipment = {
      armorCategory: 'none',
      armorProficient: true,
      armorProficiencies: [],
      mainHand: {
        itemId: 'dnd5e-hand-crossbow',
        roles: ['weapon'],
        weaponMode: 'ranged',
        weaponProperties: ['ammunition', 'light', 'loading'],
        proficient: true,
      },
      freeHands: 1,
    }
    const target = combatant('target', 'dm', 10)
    const sourceEvent = (overrides: Partial<Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }>> = {}): Dnd5eCombatEvent => ({
      type: 'attack-resolved', actorId: actor.id, targetId: target.id,
      d20: 12, total: 17, armorClass: 12, hit: true, critical: false,
      attackMode: 'melee', attackOrigin: 'attack-action', handsUsed: 1,
      weaponId: 'srd-5.1:longsword', proficient: true,
      ...overrides,
    })

    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: startDnd5eHeadlessCombat('crossbow-follow-up-valid', [actor, target]),
      events: [sourceEvent()],
      eventBatchId: 'crossbow-valid', combatRevision: 1,
      confirm: async () => true, roll: async () => [],
    })
    expect(settled.diagnostics).toContainEqual(expect.objectContaining({
      activityId: crossbowActivity.id, status: 'resolved',
    }))
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants?.['crossbow-follow-up']).toMatchObject({
      weaponModes: ['ranged'],
      weaponIds: ['dnd5e-hand-crossbow'],
      weaponSlots: ['main-hand', 'off-hand'],
    })

    for (const [combatId, invalidEvent] of [
      ['crossbow-two-handed', sourceEvent({ handsUsed: 2 })],
      ['crossbow-reaction', sourceEvent({ attackOrigin: 'reaction' })],
    ] as const) {
      const rejected = await settleDnd5eActivityTriggerWindowsV1({
        state: startDnd5eHeadlessCombat(combatId, [actor, target]),
        events: [invalidEvent],
        eventBatchId: combatId, combatRevision: 1,
        confirm: async () => true, roll: async () => [],
      })
      expect(rejected.diagnostics).toHaveLength(0)
      expect(rejected.state.combatants.actor.classState.activityWeaponAttackGrants).toBeUndefined()
    }
  })

  it('binds a polearm follow-up credential to the triggering weapon and authoritative 1d4 bludgeoning dice', async () => {
    registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [polearmActivity] })
    const actor = combatant('actor', 'player', 20)
    actor.pluginFeatureIds = ['polearm-master']
    const target = combatant('target', 'dm', 10)
    const settled = await settleDnd5eActivityTriggerWindowsV1({
      state: startDnd5eHeadlessCombat('polearm-butt-attack', [actor, target]),
      events: [{
        type: 'attack-resolved', actorId: actor.id, targetId: target.id,
        d20: 12, total: 17, armorClass: 12, hit: true, critical: false,
        attackMode: 'melee', attackOrigin: 'attack-action', handsUsed: 1,
        weaponId: 'dnd5e-quarterstaff', proficient: true,
      }],
      eventBatchId: 'polearm-event', combatRevision: 1,
      confirm: async () => true, roll: async () => [],
    })
    const grant = settled.state.combatants.actor.classState.activityWeaponAttackGrants?.['polearm-butt-attack']
    expect(grant).toMatchObject({
      weaponIds: ['dnd5e-quarterstaff'], damageDice: { count: 1, sides: 4 }, damageType: 'bludgeoning',
    })
    const action = {
      type: 'attack' as const, actorId: actor.id, targetId: target.id,
      attackModifier: 5, d20: 10, spendAction: false, spendBonusAction: true,
      activityWeaponAttackGrantId: 'polearm-butt-attack',
      damage: { count: 1, sides: 4, bonus: 3, rolls: [4], type: 'bludgeoning' as const },
      classDamageContext: {
        weaponId: 'dnd5e-quarterstaff', weaponProperties: ['versatile'], proficient: true,
        mode: 'melee' as const, finesse: false, strengthBased: true, damageType: 'bludgeoning' as const,
        weaponDamageSides: 4, adjacentEnemyOfTarget: false,
      },
    }
    expect(resolveDnd5eHeadlessAction(settled.state, {
      ...action, damage: { ...action.damage, sides: 6, rolls: [4] },
    })).toMatchObject({ ok: false, reason: 'invalid-class-feature' })
    const resolved = resolveDnd5eHeadlessAction(settled.state, action)
    expect(resolved.ok, resolved.ok ? undefined : resolved.reason).toBe(true)
  })
})
