import { describe, expect, it } from 'vitest'
import {
  createDnd5eCombatant,
  dnd5eCombatantPairKey,
  dnd5eTurnStartGazeRequirements,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eTurnStartGazeResolution,
} from './headlessCombatEngine'
import {
  dnd5ePluginFeatureDefinition,
  registerDnd5eRulesPlugin,
} from './pluginApi'

const sourceAbilities = { str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 18 } as const
const targetAbilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } as const

describe('generic turn-start saving throw aura', () => {
  it('activates from an Activity effect, applies the failed-save condition, and remembers source-bound immunity', () => {
    let featureId = ''
    const pluginId = 'test.turn-start-saving-throw-aura'
    const dispose = registerDnd5eRulesPlugin({
      manifest: {
        id: pluginId, name: 'Turn Start Aura Test', version: '1.0.0', apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'Test only',
      },
      setup(api) {
        api.registerDeclarativeSubclass({
          schemaVersion: 1, id: 'aura-subclass', classId: 'fighter',
          name: '灵光子职', summary: '测试。',
          abilities: [{
            schemaVersion: 1, id: 'menacing-aura', name: '威慑灵光', description: '测试。', level: 1,
            trigger: { kind: 'active-use' }, cost: { economy: 'action' }, targeting: { kind: 'self' },
            effects: [{ kind: 'activity-effect', target: 'actor', effectId: 'aura-form' }],
            activityEffects: [{
              schemaVersion: 1, id: 'aura-form', name: '灵光形态',
              duration: { kind: 'rounds', rounds: 10, expiresAt: 'source-turn-end' },
              stacking: 'refresh-duration',
            }],
            mechanic: {
              kind: 'turn-start-saving-throw-aura', radiusFeet: 30, relation: 'enemy',
              ability: 'wis', dcAbility: 'cha', condition: 'frightened', durationRounds: 10,
              breakOnDamage: true, magical: true, requiresMutualSight: false,
              successfulSaveImmunityRounds: 10, requiredEffectId: 'aura-form',
            },
            automation: 'full',
          }],
        })
        featureId = `${pluginId}:aura-subclass.menacing-aura`
      },
    })
    try {
      const source = createDnd5eCombatant({
        id: 'source', name: 'source', controller: 'player', initiative: 20,
        abilities: sourceAbilities, proficiencyBonus: 3, armorClass: 15,
        currentHp: 40, maxHp: 40, temporaryHp: 0, speed: 30,
        position: { x: 0, y: 0 }, concentrating: false,
        classId: 'fighter', classLevels: { fighter: 20 }, level: 20,
        subclassIds: { fighter: `${pluginId}:aura-subclass` },
        pluginFeatureIds: [featureId],
      })
      const target = createDnd5eCombatant({
        id: 'target', name: 'target', controller: 'dm', initiative: 10,
        abilities: targetAbilities, proficiencyBonus: 2, armorClass: 12,
        currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
        position: { x: 5, y: 0 }, concentrating: false,
      })
      const baseState = startDnd5eHeadlessCombat('generic-aura', [source, target])
      baseState.distanceFeetByCombatantPair = {
        [dnd5eCombatantPairKey(source.id, target.id)]: 15,
      }
      const action = dnd5ePluginFeatureDefinition(featureId)?.action
      expect(action).toBeDefined()
      if (!action) return
      const activated = resolveDnd5eHeadlessAction(baseState, {
        type: 'plugin', pluginId, actionId: action.id, featureId,
        transactionId: 'activate-aura', actorId: source.id, targetId: source.id,
        targetIds: [source.id], distanceFeet: 0, rolls: {},
      })
      expect(activated.ok ? 'ok' : activated.reason).toBe('ok')
      if (!activated.ok) return
      expect(activated.state.combatants.source.classState.activeEffects).toContainEqual(
        expect.objectContaining({ definitionId: expect.stringContaining(':aura-form') }),
      )
      expect(dnd5eTurnStartGazeRequirements(activated.state, target.id)).toEqual([
        expect.objectContaining({
          sourceId: source.id, targetId: target.id, ruleId: featureId,
          featureName: '威慑灵光', ability: 'wis', dc: 15, magical: true,
          canAvertEyes: false,
        }),
      ])

      const failedSave: Dnd5eTurnStartGazeResolution = {
        sourceId: source.id, targetId: target.id, ruleId: featureId,
        sourceUsesGaze: true, choice: 'face-gaze', save: { d20: 1 },
      }
      const failed = resolveDnd5eHeadlessAction(activated.state, {
        type: 'end-turn', actorId: source.id, turnStartGazeResolutions: [failedSave],
      })
      expect(failed.ok ? 'ok' : failed.reason).toBe('ok')
      if (!failed.ok) return
      expect(failed.state.combatants.target.conditions).toContain('frightened')
      expect(failed.state.combatants.target.classState.activeEffects).toContainEqual(
        expect.objectContaining({ breakOn: ['takes-damage'], source: expect.objectContaining({ actorId: source.id }) }),
      )

      const successState = startDnd5eHeadlessCombat('generic-aura-success', [source, target])
      successState.distanceFeetByCombatantPair = baseState.distanceFeetByCombatantPair
      const reactivated = resolveDnd5eHeadlessAction(successState, {
        type: 'plugin', pluginId, actionId: action.id, featureId,
        transactionId: 'activate-aura-success', actorId: source.id, targetId: source.id,
        targetIds: [source.id], distanceFeet: 0, rolls: {},
      })
      expect(reactivated.ok).toBe(true)
      if (!reactivated.ok) return
      const successful = resolveDnd5eHeadlessAction(reactivated.state, {
        type: 'end-turn', actorId: source.id,
        turnStartGazeResolutions: [{
          sourceId: source.id, targetId: target.id, ruleId: featureId,
          sourceUsesGaze: true, choice: 'face-gaze', save: { d20: 20 },
        }],
      })
      expect(successful.ok ? 'ok' : successful.reason).toBe('ok')
      if (!successful.ok) return
      expect(successful.state.combatants.target.conditions).not.toContain('frightened')
      expect(successful.state.combatants.target.classState.activeEffects).toContainEqual(
        expect.objectContaining({ definitionId: expect.stringContaining('plugin-aura-immunity:') }),
      )
      expect(dnd5eTurnStartGazeRequirements(successful.state, target.id)).toEqual([])
    } finally {
      dispose()
    }
  })
})
