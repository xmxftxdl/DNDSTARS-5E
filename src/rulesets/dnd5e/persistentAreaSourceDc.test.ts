import { expect, it } from 'vitest'
import { normalizeDnd5ePersistentAreaTriggerDeclaration, normalizeDnd5ePersistentAreaTriggerSnapshot, resolveDnd5ePersistentAreaTriggerSourceDc } from './persistentAreaTypes'
import { createDnd5eCombatant, startDnd5eHeadlessCombat, resolveDnd5ePersistentAreaTrigger, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { getRegisteredDnd5eActivity } from './activities/dnd5eActivityRegistry'
import { resolveDnd5eActivity } from './activities/dnd5eActivityExecutor'

const declaration = { id: 'trap-enter', label: 'Synthetic trap', timing: 'on-enter',
  capacity: { maximumUnits: 4, unitsBySizeRank: [1, 1, 1, 4, null, null], overflow: 'random-existing-until-fits',
    maximumOutsideDistanceFeet: 5, proneOnExpulsion: true },
  forcedMovement: { mode: 'nearest-outside-area', appliesOn: 'successful-save' },
  savingThrow: { ability: 'dex', dc: 'source-save-dc', onSuccess: 'none', automaticSuccessMinimumSizeRank: 4, allowWillingFailure: true },
  condition: { condition: 'restrained', duration: { expiresAt: 'target-turn-end-save', remainingRounds: 4800, saveAbility: 'dex', saveDc: 'source-save-dc' },
    escapeCheck: { ability: 'str', dc: 'source-save-dc', economy: 'action' } },
} as const

it('preserves repeat-save ejection and rejects declarations without the required lifetime',()=>{
 const condition={...declaration.condition,endsWithArea:true,ejectOnSuccessfulRepeatSave:true}
 expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,condition})?.condition?.ejectOnSuccessfulRepeatSave).toBe(true)
 for(const patch of [{endsWithArea:false},{condition:'prone'},{ejectOnSuccessfulRepeatSave:false},{duration:{expiresAt:'permanent'}}]){
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,condition:{...condition,...patch}})).toBeUndefined()
 }
})

it('allows magical support only on a restraint bound to the area lifetime',()=>{
 const condition={...declaration.condition,endsWithArea:true,modifiers:{magicallyHeldAloft:true}}
 expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,condition})?.condition?.modifiers?.magicallyHeldAloft).toBe(true)
 for(const patch of [{endsWithArea:false},{condition:'prone'},{modifiers:{magicallyHeldAloft:false}}]){
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({...declaration,condition:{...condition,...patch}})).toBeUndefined()
 }
})

it.each([
  { expiresAt: 'target-turn-end-save' },
  { expiresAt: 'target-turn-end-save', saveAbility: 'str' },
  { expiresAt: 'target-turn-end-save', saveDc: 'source-save-dc' },
])('rejects incomplete repeat-save declarations instead of silently dropping restraint: %j', duration => {
  const imported = { ...declaration, condition: { ...declaration.condition, duration } }
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration(imported)).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...imported, savingThrow: { ...declaration.savingThrow, dc: 17 } })).toBeUndefined()
})

it.each([
  { mode: 'nearest-outside-area', appliesOn: 'successful-save' },
  { mode: 'nearest-outside-area', appliesOn: 'successful-save', maximumOutsideDistanceFeet: 5 },
  { mode: 'push-from-source', distanceFeet: 10, appliesOn: 'failed-save' },
] as const)('retains nested source DC and %j through module export, installation and Activity execution', async forcedMovement => {
  const configured = { ...declaration, forcedMovement }
  const namespace = 'test.area-source-dc'
  const automation = automationCapabilityFromLegacyStatus('full')
  const bundle: Dnd5eUnifiedContentBundleV1 = {
    format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Synthetic trap module', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' },
    assets: [], definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'trap', name: 'Trap', automation,
      payload: { id: 'trap', name: 'Trap', summary: 'Synthetic', description: 'Synthetic fixture', automation: 'full' },
      activities: [{ schemaVersion: 1, id: 'trap', name: 'Trap', activation: { kind: 'action' }, automation,
        target: { kind: 'area', relation: 'any', origin: 'point', shape: 'sphere', radiusFeet: 5, placeRangeFeet: 30 },
        legacySource: { kind: 'feature', id: 'trap' },
        outcomes: [{ id: 'create', when: { kind: 'always' }, operations: [{ id: 'trap', kind: 'create-persistent-area',
          label: 'Synthetic trap', durationRounds: 4800, concentration: false,
          movement: { economy: 'action', maximumFeet: 30, carryRestrainedTargets: true }, triggers: [configured] }] }],
      }],
    }],
  }
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(decoded.bundle))
  try {
    const activity = getRegisteredDnd5eActivity(namespace, 'trap')!
    expect(activity).toBeDefined()
    const result = resolveDnd5eActivity({ activity, actor: { id: 'actor', controller: 'players', level: 5,
      proficiencyBonus: 3, abilities: { str: 10, dex: 10, con: 10, int: 18, wis: 10, cha: 10 },
      armorClass: 10, conditions: [], currentHp: 20, maxHp: 20 }, targets: [], rolls: {},
      areaPlacement: { x: 5, y: 5 }, areaPlacementDistanceFeet: 5 })
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error(result.reason)
    const proposal = result.proposals.find(proposal => proposal.kind === 'create-persistent-area')
    if (!proposal || proposal.kind !== 'create-persistent-area') throw Error('Missing area proposal')
    expect(proposal.triggers?.[0]).toMatchObject(configured)
    expect(proposal.movement).toEqual({ economy: 'action', maximumFeet: 30, carryRestrainedTargets: true })
    expect(resolveDnd5ePersistentAreaTriggerSourceDc(proposal.triggers![0], 17)).toMatchObject({
      savingThrow: { dc: 17 }, condition: { duration: { saveDc: 17 }, escapeCheck: { dc: 17 } },
    })
  } finally { dispose() }
  expect(getRegisteredDnd5eActivity(namespace, 'trap')).toBeUndefined()
})

it('captures nested area DC declarations and refuses missing Host values or unresolved saved state', () => {
  const normalized = normalizeDnd5ePersistentAreaTriggerDeclaration(declaration)
  expect(normalized).toMatchObject(declaration)
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(declaration)).toBeUndefined()
  if (!normalized) throw Error('Missing declaration')
  for (const dc of [undefined, Number.NaN, 0, 15.5, 41]) expect(resolveDnd5ePersistentAreaTriggerSourceDc(normalized, dc)).toBeUndefined()
  const captured = resolveDnd5ePersistentAreaTriggerSourceDc(normalized, 17)!
  expect(captured).toMatchObject({ savingThrow: { dc: 17 }, condition: { duration: { saveDc: 17 }, escapeCheck: { dc: 17 } } })
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot(JSON.parse(JSON.stringify(captured)))).toEqual(captured)
  expect(normalized).toMatchObject(declaration)
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration({ ...declaration, condition: { ...declaration.condition,
    duration: { ...declaration.condition.duration, saveDc: 'invented' } } })).toBeUndefined()
})

it('uses the captured repeat-save DC after caster changes and removes restraint only on a successful later save', () => {
  const trigger = resolveDnd5ePersistentAreaTriggerSourceDc(declaration, 17)!
  const make = (id: string, initiative: number) => createDnd5eCombatant({ id, name: id, initiative, controller: 'dm',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2, armorClass: 10,
    currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
  const actor = make('actor', 10), target = make('target', 20)
  actor.saveDc = 30
  const state = startDnd5eHeadlessCombat('trap-dc', [target, actor])
  const applied = resolveDnd5ePersistentAreaTrigger(state, { areaId: 'trap', sourceId: 'actor', targetId: 'target', trigger, d20: 1 })
  expect(applied.ok).toBe(true)
  const effect = applied.state.combatants.target.classState.activeEffects!.find(effect => effect.standardCondition === 'restrained')!
  expect(effect).toMatchObject({ repeatSave: { dc: 17, ability: 'dex' }, escapeCheck: { dc: 17 }, source: { spellSaveDc: 17 } })
  const restored = JSON.parse(JSON.stringify(applied.state)) as typeof state
  const fail = resolveDnd5eHeadlessAction(restored, { type: 'end-turn', actorId: 'target', activeEffectSavingThrows: [{ effectId: effect.id, d20: 20, d20Second: 16 }] })
  expect(fail.ok, fail.ok ? '' : fail.reason).toBe(true)
  expect(fail.state.combatants.target.classState.activeEffects?.some(candidate => candidate.id === effect.id)).toBe(true)
  const success = resolveDnd5eHeadlessAction(restored, { type: 'end-turn', actorId: 'target', activeEffectSavingThrows: [{ effectId: effect.id, d20: 20, d20Second: 17 }] })
  expect(success.ok).toBe(true)
  expect(success.state.combatants.target.classState.activeEffects?.some(candidate => candidate.id === effect.id)).toBeFalsy()
})

it.each([-1, 6, 3.5, null, '4'])('rejects an invalid automatic size save threshold: %j', threshold => {
  const malformed = { ...declaration, savingThrow: { ...declaration.savingThrow, automaticSuccessMinimumSizeRank: threshold } }
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration(malformed)).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...malformed, savingThrow: { ...malformed.savingThrow, dc: 17 } })).toBeUndefined()
})

it.each([null, 1, 'true'])('rejects malformed willing failure permission: %j', allowWillingFailure => {
  const malformed = { ...declaration, savingThrow: { ...declaration.savingThrow, allowWillingFailure } }
  expect(normalizeDnd5ePersistentAreaTriggerDeclaration(malformed)).toBeUndefined()
  expect(normalizeDnd5ePersistentAreaTriggerSnapshot({ ...malformed, savingThrow: { ...malformed.savingThrow, dc: 17 } })).toBeUndefined()
})
