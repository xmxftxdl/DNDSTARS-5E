import { afterEach, describe, expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
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

it.each(['attack-action', 'bonus-action'] as const)('preserves %s origin for an independent free follow-up without paying twice', async origin => {
  const follow: Dnd5eActivityDefinitionV1 = { ...activity,
    invocation: { kind: 'triggered', event: 'attack-missed', confirmation: 'actor-choice', retention: 'single-event' },
    requirements: [{ kind: 'turn-owner', owner: 'actor' }, { kind: 'attack-category', category: 'weapon' },
      { kind: 'once-per-turn', key: 'free-follow-up' }],
    outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{
      id: 'grant', kind: 'grant-weapon-attack', target: 'actor', grantId: 'free-follow-up', label: 'Follow-up',
      economy: 'none', expires: 'turn-end', inheritTriggerAttackOrigin: true,
    }] }],
  }
  const registration = registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [follow] })
  try {
  const state = startDnd5eHeadlessCombat('free-follow', [
    combatant('actor', 'player', 20), combatant('target', 'dm', 10), combatant('other', 'dm', 5),
  ])
  const context = { weaponId: 'test-sword', mode: 'melee' as const, finesse: false, strengthBased: true,
    weaponDamageSides: 6, damageType: 'slashing' as const, adjacentEnemyOfTarget: false }
  const miss = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId: 'target',
    attackModifier: 5, d20: 1, spendAction: origin === 'attack-action', spendBonusAction: origin === 'bonus-action',
    damage: { count: 1, sides: 6, bonus: 0, rolls: [2], type: 'slashing' }, classDamageContext: context })
  expect(miss.ok).toBe(true)
  const settled = await settleDnd5eActivityTriggerWindowsV1({ state: miss.state, events: miss.events,
    eventBatchId: 'miss', combatRevision: 1, confirm: async () => true, roll: async () => [] })
  const restored = JSON.parse(JSON.stringify(settled.state))
  expect(restored.combatants.actor.classState.activityWeaponAttackGrants['free-follow-up'].inheritedAttackOrigin).toBe(origin)
  const before = { ...restored.combatants.actor.turn }
  const hit = resolveDnd5eHeadlessAction(restored, { type: 'attack', actorId: 'actor', targetId: 'other',
    attackModifier: 5, d20: 18, spendAction: false, activityWeaponAttackGrantId: 'free-follow-up',
    damage: { count: 1, sides: 6, bonus: 0, rolls: [3], type: 'slashing' }, classDamageContext: context })
  expect(hit.ok, hit.ok ? '' : hit.reason).toBe(true)
  expect(hit.state.combatants.other.currentHp).toBe(17)
  expect(hit.state.combatants.actor.turn.actionAvailable).toBe(before.actionAvailable)
  expect(hit.state.combatants.actor.turn.bonusActionAvailable).toBe(before.bonusActionAvailable)
  expect(hit.events.find(event => event.type === 'attack-resolved')).toMatchObject({ attackOrigin: origin })
  expect(hit.state.combatants.actor.classState.activityWeaponAttackGrants?.['free-follow-up']).toBeUndefined()
  const repeat = await settleDnd5eActivityTriggerWindowsV1({ state: hit.state, events: miss.events,
    eventBatchId: 'repeat', combatRevision: 2, confirm: async () => true, roll: async () => [] })
  expect(repeat.state.combatants.actor.classState.activityWeaponAttackGrants?.['free-follow-up']).toBeUndefined()
  } finally { registration.dispose() }
})

it('activates a deferred weapon grant only on the next own turn and never carries it into another turn', async () => {
  const delayed: Dnd5eActivityDefinitionV1 = { ...activity, requirements: [],
    outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'grant-weapon-attack',
      target: 'actor', grantId: 'delayed', label: 'Next turn', economy: 'bonus-action', expires: 'turn-end',
      available: 'next-own-turn', bindTriggerTarget: true, attackAdvantage: true, weaponModes: ['melee'],
      attackResourceCost: { resourceId: 'mark-uses', amount: 1 },
      damageBonus: { kind: 'floor', value: { kind: 'multiply', values: [
        { kind: 'reference', reference: { kind: 'actor-class-level', classId: 'fighter' } }, { kind: 'constant', value: 0.5 }] } } }] }] }
  const registration = registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [delayed] })
  try {
    const initial = startDnd5eHeadlessCombat('delayed-grant', [combatant('actor', 'player', 20), combatant('target', 'dm', 10)])
    initial.combatants.actor.classLevels = { fighter: 13 }
    initial.combatants.actor.classResources['mark-uses'] = { current: 1, max: 3 }
    const settled = await settleDnd5eActivityTriggerWindowsV1({ state: initial, combatRevision: 1,
      eventBatchId: 'delayed', events: [{ type: 'attack-resolved', actorId: 'actor', targetId: 'target',
        d20: 18, total: 23, armorClass: 12, hit: true, critical: false, attackMode: 'melee' }],
      confirm: async () => true, roll: async () => [] })
    const attack = (state: typeof initial, targetId = 'target') => resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'actor', targetId,
      attackModifier: 5, d20: 2, d20Second: 18, spendAction: false, spendBonusAction: true, activityWeaponAttackGrantId: 'delayed',
      damage: { count: 1, sides: 6, bonus: 9, rolls: [4], type: 'slashing' },
      classDamageContext: { weaponId: 'srd-5.1:longsword', mode: 'melee', finesse: false, strengthBased: true,
        weaponDamageSides: 8, damageType: 'slashing', adjacentEnemyOfTarget: false } })
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants?.delayed.pendingNextOwnTurn, JSON.stringify(settled.diagnostics)).toBe(true)
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants?.delayed.damageBonus).toBe(6)
    expect(settled.state.combatants.actor.classResources['mark-uses'].current).toBe(1)
    expect(attack(JSON.parse(JSON.stringify(settled.state))).ok).toBe(false)
    const enemyTurn = resolveDnd5eHeadlessAction(settled.state, { type: 'end-turn', actorId: 'actor' })
    expect(enemyTurn.ok).toBe(true)
    expect(attack(enemyTurn.state).ok).toBe(false)
    const ownTurn = resolveDnd5eHeadlessAction(JSON.parse(JSON.stringify(enemyTurn.state)), { type: 'end-turn', actorId: 'target' })
    expect(ownTurn.ok).toBe(true)
    expect(ownTurn.state.combatants.actor.classState.activityWeaponAttackGrants?.delayed.pendingNextOwnTurn).toBeUndefined()
    expect(ownTurn.state.combatants.actor.classState.activityWeaponAttackGrants?.delayed.requiredTargetId).toBe('target')
    const wrongTarget = structuredClone(ownTurn.state)
    wrongTarget.combatants.other = combatant('other', 'dm', 0)
    const rejected = attack(wrongTarget, 'other')
    expect(rejected.ok).toBe(false)
    expect(rejected.state.combatants.actor.turn.bonusActionAvailable).toBe(true)
    expect(rejected.state.combatants.actor.classState.activityWeaponAttackGrants?.delayed).toBeDefined()
    expect(rejected.state.combatants.actor.classResources['mark-uses'].current).toBe(1)
    const exhausted = structuredClone(ownTurn.state)
    exhausted.combatants.actor.classResources['mark-uses'].current = 0
    expect(attack(exhausted).ok).toBe(false)
    expect(exhausted.combatants.actor.turn.bonusActionAvailable).toBe(true)
    const used = attack(ownTurn.state)
    expect(used.ok, JSON.stringify(used)).toBe(true)
    expect(used.state.combatants.target.currentHp).toBe(7)
    expect(used.state.combatants.actor.classResources['mark-uses'].current).toBe(0)
    expect(used.events.filter(event => event.type === 'class-resource-spent')).toHaveLength(1)
    expect(used.events).toContainEqual(expect.objectContaining({ type: 'attack-resolved', rollMode: 'advantage', d20: 18 }))
    expect(used.state.combatants.actor.turn.bonusActionAvailable).toBe(false)
    expect(used.state.combatants.actor.classState.activityWeaponAttackGrants).toBeUndefined()
    expect(attack(used.state).ok).toBe(false)
    const expired = resolveDnd5eHeadlessAction(ownTurn.state, { type: 'end-turn', actorId: 'actor' })
    expect(attack(expired.state).ok).toBe(false)
    const next = resolveDnd5eHeadlessAction(expired.state, { type: 'end-turn', actorId: 'target' })
    expect(next.state.combatants.actor.classState.activityWeaponAttackGrants).toBeUndefined()
  } finally { registration.dispose() }
})

describe('unified Activity weapon attack grants', () => {
  afterEach(() => clearDnd5eActivityRegistryForTests())

  it('keeps different target grants and an active/next-turn pair without accumulating duplicate qualifications', async () => {
    const perTarget: Dnd5eActivityDefinitionV1 = { ...activity, requirements: [],
      outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'grant-weapon-attack',
        target: 'actor', grantId: 'marked', label: 'Marked', economy: 'bonus-action', expires: 'turn-end',
        available: 'next-own-turn', bindTriggerTarget: true, separateByTarget: true, weaponModes: ['melee'] }] }] }
    registerDnd5eActivityPackage({ packageId: PACKAGE_ID, packageVersion: '1.0.0', activities: [perTarget] })
    const initial = startDnd5eHeadlessCombat('multi-target-grants', [combatant('actor', 'player', 20), combatant('target', 'dm', 10)])
    initial.combatants.second = combatant('second', 'dm', 0)
    let batch = 0
    const qualify = async (state: typeof initial, targetId: string) => (await settleDnd5eActivityTriggerWindowsV1({
      state, events: [{ type: 'attack-resolved', actorId: 'actor', targetId, d20: 18, total: 23,
        armorClass: 12, hit: true, critical: false, attackMode: 'melee' }], eventBatchId: `qualification-${++batch}`,
      combatRevision: batch, confirm: async () => true, roll: async () => [],
    })).state
    const pending = await qualify(await qualify(await qualify(initial, 'target'), 'second'), 'target')
    expect(Object.values(pending.combatants.actor.classState.activityWeaponAttackGrants ?? {})).toHaveLength(2)
    expect(Object.values(pending.combatants.actor.classState.activityWeaponAttackGrants ?? {}).map(grant => grant.requiredTargetId).sort()).toEqual(['second', 'target'])
    const advance = (state: typeof initial, actorId: string) => {
      const result = resolveDnd5eHeadlessAction(state, { type: 'end-turn', actorId })
      expect(result.ok, JSON.stringify(result)).toBe(true)
      return result.state
    }
    const active = advance(advance(JSON.parse(JSON.stringify(pending)), 'actor'), 'target')
    expect(Object.values(active.combatants.actor.classState.activityWeaponAttackGrants ?? {}).every(grant => !grant.pendingNextOwnTurn)).toBe(true)
    const queued = await qualify(active, 'target')
    const grants = Object.values(queued.combatants.actor.classState.activityWeaponAttackGrants ?? {})
    expect(grants).toHaveLength(3)
    expect(grants.filter(grant => grant.requiredTargetId === 'target').map(grant => !!grant.pendingNextOwnTurn).sort()).toEqual([false, true])
    const next = advance(advance(queued, 'actor'), 'target')
    const remaining = Object.values(next.combatants.actor.classState.activityWeaponAttackGrants ?? {})
    expect(remaining).toHaveLength(1)
    expect(remaining[0]).toMatchObject({ requiredTargetId: 'target', grantId: 'marked:target:target' })
    expect(remaining[0].pendingNextOwnTurn).toBeUndefined()
  })

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

  it('binds follow-up targets to the Host event target and rejects its reuse or a distant target', async () => {
    const restricted: Dnd5eActivityDefinitionV1 = {...activity,
      invocation:{kind:'triggered',event:'attack-missed',confirmation:'actor-choice',retention:'until-turn-end'},
      requirements: [{kind:'event-source',source:'attack'}],
      outcomes: [{id:'grant',when:{kind:'always'},operations:[{id:'grant',kind:'grant-weapon-attack',target:'actor',
        grantId:'follow-up',label:'Redirect',economy:'bonus-action',expires:'turn-end',differentTargetWithinFeetOfEventTarget:60,reuseMissedProjectile:true}]}]}
    registerDnd5eActivityPackage({packageId:PACKAGE_ID,packageVersion:'1.0.0',activities:[restricted]})
    const actor=combatant('actor','player',20), original=combatant('original','dm',10), near=combatant('near','dm',9), far=combatant('far','dm',8)
    const initial=startDnd5eHeadlessCombat('redirect-test',[actor,original,near,far])
    const settled=await settleDnd5eActivityTriggerWindowsV1({state:initial,events:[{
      type:'attack-resolved',actorId:'actor',targetId:'original',d20:1,total:6,armorClass:12,hit:false,critical:false,
      attackMode:'ranged',weaponId:'srd-5.1:longbow',weaponProperties:['ammunition'],proficient:true,
      projectileAttackSnapshot:{attackModifier:5,damage:{count:1,sides:6,bonus:3,type:'piercing'}},
    }],eventBatchId:'miss',combatRevision:1,confirm:async()=>true,roll:async()=>[]})
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants?.['follow-up']?.reusedProjectileWeaponId).toBe('srd-5.1:longbow')
    expect(settled.state.combatants.actor.classState.activityWeaponAttackGrants?.['follow-up']?.targetRestriction, JSON.stringify(settled.diagnostics))
      .toEqual({originTargetId:'original',maximumFeet:60})
    settled.state.distanceFeetByCombatantPair={
      [dnd5eCombatantPairKey('original','near')]:60,
      [dnd5eCombatantPairKey('original','far')]:61,
    }
    const before=JSON.stringify(settled.state)
    for(const targetId of ['original','far','near']){
      const result=resolveDnd5eHeadlessAction(settled.state,{
        type:'attack',actorId:'actor',targetId,attackModifier:5,d20:10,spendAction:false,spendBonusAction:true,
        activityWeaponAttackGrantId:'follow-up',damage:{count:1,sides:6,bonus:3,rolls:[4],type:'piercing'},
        classDamageContext:{weaponId:'srd-5.1:longbow',weaponProperties:[],proficient:true,mode:'ranged',finesse:false,
          strengthBased:false,damageType:'piercing',weaponDamageSides:6,adjacentEnemyOfTarget:false},
      })
      expect(result.ok, targetId).toBe(targetId==='near')
      expect(JSON.stringify(settled.state)).toBe(before)
    }
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
