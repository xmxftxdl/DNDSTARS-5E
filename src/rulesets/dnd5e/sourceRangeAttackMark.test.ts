import { expect, it } from 'vitest'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { prepareDnd5eLocalContentJson } from './localContentCollection'
import { parseDnd5eContentPackageV2, dnd5eRulesPluginFromContentPackageV2 } from './contentPackageV2'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { settleDnd5eActivityTriggerWindowsV1 } from './activities/dnd5eActivityTriggerSettlement'
import { dnd5eActivityTriggerContextsFromCombatEventV1 } from './activities/dnd5eActivityTriggerWindows'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, dnd5eCombatantPairKey,
  dnd5eSourceMarkedAttackDisadvantage, resolveDnd5eHeadlessAction } from './headlessCombatEngine'

function fixture(rangeFeet: number | undefined = 5) {
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative,
    controller: id === 'marked' ? 'dm' : 'player', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    proficiencyBonus: 2, armorClass: 12, currentHp: 30, maxHp: 30, temporaryHp: 0,
    speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const state = startDnd5eHeadlessCombat('range-mark', [make('marked', 30), make('source', 20), make('other', 10)])
  state.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey('source', 'marked')]: 5,
    [dnd5eCombatantPairKey('marked', 'other')]: 5 }
  state.combatants.marked.classState.activeEffects = [createDnd5eMechanicalEffect({
    definitionId: 'test:range-mark', label: 'Range mark', targetId: 'marked',
    source: { kind: 'feature', actorId: 'source', rulesId: 'range-mark' },
    duration: { type: 'permanent' }, modifiers: { attackDisadvantageAgainstOthersThanSource: true,
      attackDisadvantageAgainstOthersThanSourceRangeFeet: rangeFeet },
  })]
  return state
}

it.each([0, 5, 10])('uses source-to-bearer distance %s, including after JSON reload', distance => {
  const state = JSON.parse(JSON.stringify(fixture())) as ReturnType<typeof fixture>
  state.distanceFeetByCombatantPair![dnd5eCombatantPairKey('source', 'marked')] = distance
  expect(dnd5eSourceMarkedAttackDisadvantage(state.combatants.marked, state.combatants.other, state)).toBe(distance <= 5)
  expect(dnd5eSourceMarkedAttackDisadvantage(state.combatants.marked, state.combatants.source, state)).toBe(false)
  const result = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId: 'marked', targetId: 'other',
    attackModifier: 0, d20: 18, d20Second: 2, damage: { count: 1, sides: 6, bonus: 0, rolls: [4], type: 'slashing' } })
  expect(result.ok, JSON.stringify(result)).toBe(true)
  expect(result.state.combatants.other.currentHp).toBe(distance <= 5 ? 30 : 26)
})

it('does not apply a ranged mark without its source or authoritative spatial state', () => {
  const state = fixture()
  expect(dnd5eSourceMarkedAttackDisadvantage(state.combatants.marked, state.combatants.other)).toBe(false)
  delete state.combatants.source
  expect(dnd5eSourceMarkedAttackDisadvantage(state.combatants.marked, state.combatants.other, state)).toBe(false)
  const legacy = fixture()
  delete legacy.combatants.marked.classState.activeEffects![0].modifiers!.attackDisadvantageAgainstOthersThanSourceRangeFeet
  expect(dnd5eSourceMarkedAttackDisadvantage(legacy.combatants.marked, legacy.combatants.other)).toBe(true)
})

it('preserves the range in effect normalization and rejects malformed imported ranges', () => {
  const effects = fixture().combatants.marked.classState.activeEffects!
  expect(normalizeDnd5eActiveEffects(effects)[0].modifiers?.attackDisadvantageAgainstOthersThanSourceRangeFeet).toBe(5)
  for (const value of [-1, Infinity, '5', 10001]) {
    const invalid = structuredClone(effects)
    Object.assign(invalid[0].modifiers!, { attackDisadvantageAgainstOthersThanSourceRangeFeet: value })
    expect(validateDnd5eActiveEffectsStrict(invalid).ok).toBe(false)
  }
})

it('imports a melee-hit mark with optional use, replacement and source-linked expiry', async () => {
  const activity = { schemaVersion: 1, id: 'hit-mark', name: 'Hit mark', activation: { kind: 'free' },
    invocation: { kind: 'triggered', event: 'attack-hit', confirmation: 'actor-choice', retention: 'single-event' },
    target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 100 },
    requirements: [{ kind: 'attack-mode', mode: 'melee' }],
    legacySource: { kind: 'feature', id: 'hit-mark' }, automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'mark', name: 'Mark', stacking: 'replace', exclusiveGroup: 'hit-mark', exclusiveGroupScope: 'bearer',
      duration: { kind: 'rounds', rounds: 1, expiresAt: 'source-turn-end' },
      sourceLink: { sourceMustNotBeIncapacitated: true },
      modifiers: [{ kind: 'attack-target-lock', attacksAgainstOthersThanSource: 'disadvantage', sourceRangeFeet: 5, notifySourceOnDamage: true }] }],
    outcomes: [{ id: 'mark', when: { kind: 'always' }, operations: [{ id: 'mark', kind: 'apply-effect', target: 'target', effectId: 'mark' }] }],
  }
  const retaliation = { schemaVersion: 1, id: 'mark-retaliation', name: 'Mark retaliation', activation: { kind: 'free' },
    invocation: { kind: 'triggered', event: 'marked-creature-damaged-other', confirmation: 'automatic' },
    target: { kind: 'self' }, legacySource: { kind: 'feature', id: 'hit-mark' }, automation: automationCapabilityFromLegacyStatus('full'),
    outcomes: [{ id: 'grant', when: { kind: 'always' }, operations: [{ id: 'grant', kind: 'grant-weapon-attack', target: 'actor',
      grantId: 'retaliate', label: 'Retaliate', economy: 'bonus-action', expires: 'turn-end', available: 'next-own-turn',
      bindTriggerTarget: true, separateByTarget: true, attackAdvantage: true, weaponModes: ['melee'] }] }] }
  const imported = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Hit mark fixture', version: '1.0.0',
    features: [{ id: 'hit-mark', name: 'Hit mark', summary: 'Synthetic fixture', description: 'Synthetic fixture', automation: 'full' }], activities: [activity, retaliation] }))
  const pkg = parseDnd5eContentPackageV2(new TextEncoder().encode(JSON.stringify(imported.package)).buffer)!
  expect(pkg.content.activities?.[0].effects?.[0].modifiers).toEqual(activity.effects[0].modifiers)
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const initial = fixture()
    initial.combatants.marked.classState.activeEffects = []
    for (const id of ['source', 'other']) initial.combatants[id].pluginFeatureIds = [`${pkg.manifest.id}:hit-mark`]
    let batch = 0
    const apply = async (state: typeof initial, actorId = 'source', accepted = true, mode: 'melee' | 'ranged' = 'melee', d20 = 18) => {
      state = structuredClone(state)
      state.initiativeIndex = state.initiativeOrder.indexOf(actorId)
      const attack = resolveDnd5eHeadlessAction(state, { type: 'attack', actorId, targetId: 'marked', d20,
        attackModifier: 0, damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' },
        classDamageContext: { mode, finesse: false, strengthBased: true, weaponDamageSides: 4,
          damageType: 'slashing', adjacentEnemyOfTarget: false } })
      expect(attack.ok, JSON.stringify(attack)).toBe(true)
      let prompts = 0
      const settled = await settleDnd5eActivityTriggerWindowsV1({ state: attack.state, events: attack.events,
        eventBatchId: `mark-${++batch}`, combatRevision: batch,
        confirm: async () => { prompts++; return accepted }, roll: async () => [] })
      expect(prompts).toBe(mode === 'melee' && d20 !== 1 ? 1 : 0)
      return settled.state
    }
    for (const [accepted, mode, d20] of [[false, 'melee', 18], [true, 'ranged', 18], [true, 'melee', 1]] as const) {
      const rejected = await apply(initial, 'source', accepted, mode, d20)
      expect(rejected.combatants.marked.classState.activeEffects ?? []).toHaveLength(0)
    }
    const marked = await apply(initial)
    expect(marked.combatants.marked.classState.activeEffects).toHaveLength(1)
    expect(dnd5eSourceMarkedAttackDisadvantage(marked.combatants.marked, marked.combatants.other, marked)).toBe(true)
    for (const victim of ['source', 'other'] as const) {
      const beforeDamage = JSON.parse(JSON.stringify(marked)) as typeof marked
      beforeDamage.initiativeIndex = 0
      // This notification is independent of the five-foot disadvantage radius.
      beforeDamage.distanceFeetByCombatantPair![dnd5eCombatantPairKey('source', 'marked')] = 15
      const hit = resolveDnd5eHeadlessAction(beforeDamage, { type: 'attack', actorId: 'marked', targetId: victim,
        attackModifier: 5, d20: 18, damage: { count: 1, sides: 4, bonus: 0, rolls: [1], type: 'slashing' } })
      expect(hit.ok, JSON.stringify(hit)).toBe(true)
      const triggered = await settleDnd5eActivityTriggerWindowsV1({ state: hit.state, events: hit.events,
        eventBatchId: `retaliation-${victim}`, combatRevision: 10, confirm: async () => false, roll: async () => [] })
      const grant = Object.values(triggered.state.combatants.source.classState.activityWeaponAttackGrants ?? {}).find(grant => grant.requiredTargetId === 'marked')
      if (victim === 'source') expect(grant).toBeUndefined()
      else {
        expect(grant, JSON.stringify(triggered.diagnostics)).toMatchObject({ requiredTargetId: 'marked', pendingNextOwnTurn: true, attackAdvantage: true })
        const damage = hit.events.find(event => event.type === 'damage-applied')!
        if (damage.type !== 'damage-applied') throw Error('Expected real damage event')
        const contexts = (state: typeof hit.state, event = damage) => dnd5eActivityTriggerContextsFromCombatEventV1(state, event, 0, 'damage-check')
          .filter(context => context.event === 'marked-creature-damaged-other')
        expect(contexts(hit.state)).toHaveLength(1)
        expect(contexts(hit.state, { ...damage, amount: 0 })).toHaveLength(0)
        expect(contexts(hit.state, { ...damage, suppressAfterDealtDamageTrigger: true })).toHaveLength(0)
        for (const invalid of ['dead-source', 'object-victim', 'removed-mark'] as const) {
          const changed = structuredClone(hit.state)
          if (invalid === 'dead-source') changed.combatants.source.deathSaves.dead = true
          if (invalid === 'object-victim') changed.combatants.other.objectInteractionOnly = true
          if (invalid === 'removed-mark') changed.combatants.marked.classState.activeEffects = []
          expect(contexts(changed)).toHaveLength(0)
        }
        const duplicate = structuredClone(hit.state)
        duplicate.combatants.marked.classState.activeEffects!.push({ ...duplicate.combatants.marked.classState.activeEffects![0], id: 'duplicate' })
        expect(contexts(duplicate)).toHaveLength(1)
      }
    }
    const replaced = await apply(marked, 'other')
    expect(replaced.combatants.marked.classState.activeEffects).toHaveLength(1)
    expect(replaced.combatants.marked.classState.activeEffects![0].source.actorId).toBe('other')
    let ticking = JSON.parse(JSON.stringify(marked)) as typeof marked
    for (const id of ['source', 'other', 'marked']) {
      const next = resolveDnd5eHeadlessAction(ticking, { type: 'end-turn', actorId: id })
      expect(next.ok, JSON.stringify(next)).toBe(true)
      ticking = next.state
      expect(ticking.combatants.marked.classState.activeEffects).toHaveLength(1)
    }
    const expired = resolveDnd5eHeadlessAction(ticking, { type: 'end-turn', actorId: 'source' })
    expect(expired.ok).toBe(true)
    expect(expired.state.combatants.marked.classState.activeEffects ?? []).toHaveLength(0)
    for (const condition of ['incapacitated', 'unconscious'] as const) {
      const disabled = structuredClone(marked)
      disabled.combatants.source.classState.activeEffects = [createDnd5eConditionEffect({ condition,
        targetId: 'source', source: { kind: 'system' } })]
      disabled.initiativeIndex = 0
      const reconciled = resolveDnd5eHeadlessAction(disabled, { type: 'ability-check', actorId: 'marked', ability: 'int', d20: 10, dc: 5 })
      expect(reconciled.ok).toBe(true)
      expect(reconciled.state.combatants.marked.classState.activeEffects ?? []).toHaveLength(0)
    }
  } finally { dispose() }
})
