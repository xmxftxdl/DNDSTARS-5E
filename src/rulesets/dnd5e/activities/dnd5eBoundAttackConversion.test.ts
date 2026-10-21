import { expect, it } from 'vitest'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from '../starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from '../unifiedContent'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from '../headlessCombatEngine'
import { validateDnd5eActiveEffectsStrict } from '../activeEffects'
import { dnd5eCombatantPairKey } from '../headlessCombatPrimitives'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'

const cases = (['direct', 'compiled'] as const).flatMap(route => ['old-types-immune','force-resistant','force-immune'].flatMap(defense => [false,true].map(critical=>({route,defense,critical,consumeEffectOnHit:true,oncePerTurn:false,weaponSides:undefined as number | undefined}))))
it.each(cases)('converts the complete bound weapon hit before immunity/resistance (%j)', async ({ route, defense, critical, consumeEffectOnHit, oncePerTurn, weaponSides }) => {
  const namespace = 'test.on-hit-lifetime'
  const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'cast', name: 'Synthetic rider',
    activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1, rangeFeet: 30 }, legacySource: { kind: 'feature', id: 'rider' },
    automation: automationCapabilityFromLegacyStatus('full'),
    effects: [{ schemaVersion: 1, id: 'rider', name: 'Rider', stacking: 'replace', concentration: true,
      duration: { kind: 'concentration', maximumRounds: 10 }, modifiers: [{ kind: 'on-hit-bonus-damage',
        amount: weaponSides ? { kind: 'weapon-dice', count: 1 } : { kind: 'dice', rollId: 'extra', count: 1, sides: 6 }, damageType: 'fire', attackDamageTypeOverride: 'force',
        appliesTo: 'all-weapon-attacks', bindToSelectedTarget: true, oncePerTurn, ...(consumeEffectOnHit === undefined ? {} : { consumeEffectOnHit }),
      }] }],
    outcomes: [{ id: 'apply', when: { kind: 'always' }, operations: [{ id: 'apply', kind: 'apply-effect', target: 'actor', effectId: 'rider' }] }],
  }
  expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
  for (const patch of [
    { bindToSelectedTarget: false }, { bindToSelectedTarget: 'target' },
    { attackDamageTypeOverride: 'invalid' }, { consumeEffectOnHit: false },
    { bindToSelectedTarget: undefined },
  ]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0].modifiers![0], patch)
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error =>
      error.includes('bindToSelectedTarget') || error.includes('attackDamageTypeOverride'))).toBe(true)
  }
  if (weaponSides) for (const amount of [
    { kind: 'weapon-dice', count: 0 }, { kind: 'weapon-dice', count: 1001 },
    { kind: 'weapon-dice', count: 1.5 }, { kind: 'weapon-dice', count: 1, sides: 20 },
  ]) {
    const invalid = structuredClone(activity)
    Object.assign(invalid.effects![0].modifiers![0], { amount })
    expect(validateDnd5eActivityDefinitionV1(invalid).some(error => error.includes('weapon dice'))).toBe(true)
  }
  const malformed = structuredClone(activity)
  Object.assign(malformed.effects![0].modifiers![0], { consumeEffectOnHit: 'false' })
  expect(validateDnd5eActivityDefinitionV1(malformed).some(error => error.includes('consumeEffectOnHit'))).toBe(true)
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic rider', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1',
      publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'rider', name: 'Rider',
      automation: activity.automation, activities: [activity], payload: { id: 'rider', name: 'Rider', summary: 'Synthetic', description: 'Synthetic', automation: 'full' } }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  expect(decoded.bundle.definitions[0].activities).toEqual(bundle.definitions[0].activities)
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: id === 'actor' ? 'player' : 'dm',
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
      currentHp: 100, maxHp: 100, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor', 20), target = make('target', 10)
    actor.pluginFeatureIds = [`${namespace}:rider`]
    target.damageImmunities = defense==='old-types-immune'?['slashing','fire']:defense==='force-immune'?['force']:[]
    target.damageResistances = defense==='force-resistant'?['force']:[]
    const start = startDnd5eHeadlessCombat('rider-lifetime', [actor, target])
    start.distanceFeetByCombatantPair = { [dnd5eCombatantPairKey(actor.id, target.id)]: 5 }
    const applied = route === 'compiled' ? { phase: 'commit' as const, result: resolveDnd5eHeadlessAction(start, {
      type: 'plugin', pluginId: namespace, actionId: 'cast', featureId: `${namespace}:rider`, actorId: actor.id, targetId: target.id, distanceFeet: 5, rolls: {},
    }) } : resolveRegisteredDnd5eActivityInCombatV1({ state: start, combatRevision: 1, command: {
      schemaVersion: 1, commandId: 'cast', actorId: actor.id, packageId: namespace, packageVersion: '1.0.0', activityId: 'cast', targetIds: [target.id], expectedRevision: 1,
    }, authoritativeRolls: {}, confirmedBy: 'actor' })
    expect(applied.result.ok).toBe(true)
    if (applied.phase !== 'commit' || !applied.result.ok) throw Error('expected rider')
    let state: typeof applied.result.state = JSON.parse(JSON.stringify(applied.result.state))
    expect(state.combatants.actor.classState.activeEffects?.[0].modifiers?.onHitBonusDamage?.boundTargetId).toBe(target.id)
    state.combatants.other = make('other', 0)
    state.distanceFeetByCombatantPair = { ...state.distanceFeetByCombatantPair, [dnd5eCombatantPairKey(actor.id,'other')]: 5 }
    const effectId = state.combatants.actor.classState.activeEffects!.find(effect => effect.modifiers?.onHitBonusDamage)!.id
    let attackSides = weaponSides ?? 8
    let extraValue = weaponSides ? attackSides - 1 : 5
    expect(validateDnd5eActiveEffectsStrict(JSON.parse(JSON.stringify(state.combatants.actor.classState.activeEffects)))).toMatchObject({ ok: true })
    for (const patch of [{ boundTargetId: '' }, { boundTargetId: 42 }, { boundTargetId: undefined },
      { consumeEffectOnHit: false }, { attackDamageTypeOverride: 'invalid' }]) {
      const invalid = structuredClone(state.combatants.actor.classState.activeEffects!)
      Object.assign(invalid[0].modifiers!.onHitBonusDamage!, patch)
      expect(validateDnd5eActiveEffectsStrict(invalid).ok).toBe(false)
    }
    const attack = (d20: number, withRider: boolean, targetId = 'target', spellAttack = false) => resolveDnd5eHeadlessAction(state, {
      type: 'attack', actorId: 'actor', targetId, attackModifier: 5, d20, spendAction: false,
      classDamageContext: { spellAttack, mode: 'melee', weaponId: 'longsword', finesse: false, strengthBased: true, weaponDamageSides: attackSides, damageType: 'slashing', adjacentEnemyOfTarget: false },
      damage: { count: 1, sides: Math.max(2, attackSides), bonus: 0, rolls: d20 === 20 ? [2, 3] : [2], type: 'slashing' },
      classDamageRolls: withRider ? [{ source: 'activity-effect-rider', rollId: `activity-on-hit:${effectId}`, rolls: d20 === 20 ? [extraValue, extraValue + 1] : [extraValue] }] : [],
    })
    if (weaponSides) {
      const validSides = attackSides
      attackSides = 0
      const rejected = attack(15, true)
      expect(rejected.ok).toBe(false)
      expect(rejected.state.combatants.target.currentHp).toBe(100)
      expect(rejected.state.combatants.actor.classState.activeEffects).toEqual(state.combatants.actor.classState.activeEffects)
      attackSides = validSides
    }
    const miss = attack(1, false)
    expect(miss.ok, miss.ok ? undefined : miss.reason).toBe(true)
    expect(miss.state.combatants.actor.classState.activeEffects?.some(effect => effect.id === effectId)).toBe(true)
    state = miss.state
    const hit = attack(critical?20:15, true)
    expect(hit.ok, hit.ok ? undefined : hit.reason).toBe(true)
    const rawDamage=critical?16:7
    const expectedDamage=defense==='force-immune'?0:defense==='force-resistant'?Math.floor(rawDamage/2):rawDamage
    const hpAfterFirst = 100 - expectedDamage
    expect(hit.state.combatants.target.currentHp).toBe(hpAfterFirst)
    expect(hit.state.combatants.actor.classState.activeEffects?.some(effect => effect.id === effectId)??false).toBe(false)
    state=JSON.parse(JSON.stringify(hit.state))
    const next=attack(15,false)
    expect(next.ok).toBe(true)
    expect(next.state.combatants.target.currentHp).toBe(hpAfterFirst-(defense==='old-types-immune'?0:2))
  } finally { dispose() }
}, 20_000)
