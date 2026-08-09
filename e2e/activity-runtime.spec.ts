import { expect, test } from '@playwright/test'

const DM = 'http://127.0.0.1:6173'

test('unified Activity executes active and light-weapon trigger paths in the browser runtime', async ({ page }) => {
  await page.goto(`${DM}/`, { waitUntil: 'domcontentloaded' })
  const result = await page.evaluate(async () => {
    const dndModulePath = '/src/rulesets/dnd5e/index.ts'
    const automationModulePath = '/src/domain/automation/automationCapability.ts'
    const dnd = await import(/* @vite-ignore */ dndModulePath)
    const { automationCapabilityFromLegacyStatus } = await import(/* @vite-ignore */ automationModulePath)
    const automation = automationCapabilityFromLegacyStatus('full')
    const packageId = 'e2e.browser-activity-runtime'
    const packageVersion = '1.0.0'
    const registration = dnd.registerDnd5eActivityPackage({
      packageId,
      packageVersion,
      activities: [{
        schemaVersion: 1,
        id: 'browser-pulse',
        name: 'Browser pulse',
        activation: { kind: 'action', cost: 1 },
        invocation: { kind: 'active', confirmation: 'actor-choice' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 30 },
        consumption: [{ kind: 'action-economy', economy: 'action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
          id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 3 }, damageType: 'force',
        }] }],
        automation,
        legacySource: { kind: 'feature', id: 'browser-pulse' },
      }, {
        schemaVersion: 1,
        id: 'browser-light-follow-up',
        name: 'Browser light follow-up',
        activation: { kind: 'bonus-action', cost: 1 },
        invocation: { kind: 'triggered', event: 'attack-resolved', confirmation: 'actor-choice' },
        target: { kind: 'creature', relation: 'enemy', count: 1, rangeFeet: 5 },
        requirements: [{ kind: 'weapon-property', property: 'light', present: true }],
        consumption: [{ kind: 'action-economy', economy: 'bonus-action', amount: 1, consumeOn: 'resolve' }],
        outcomes: [{ id: 'resolve', when: { kind: 'always' }, operations: [{
          id: 'damage', kind: 'damage', target: 'target', amount: { kind: 'constant', value: 2 }, damageType: 'slashing',
        }] }],
        automation,
        legacySource: { kind: 'feature', id: 'browser-light-follow-up' },
      }],
    })
    try {
      const abilities = { str: 14, dex: 14, con: 12, int: 10, wis: 10, cha: 10 }
      const makeCombatant = (id: string, controller: 'player' | 'dm', initiative: number) =>
        dnd.createDnd5eCombatant({
          id, name: id, controller, initiative, abilities, proficiencyBonus: 2,
          armorClass: 12, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30,
          position: { x: 0, y: 0 }, concentrating: false,
          pluginFeatureIds: id === 'actor' ? ['browser-pulse', 'browser-light-follow-up'] : [],
          ...(id === 'target' ? { pluginFeaturePassiveEffects: [{
            featureId: 'browser-stone-guard', featureName: 'Browser Stone Guard', effectId: 'reduction',
            effect: {
              schemaVersion: 1, id: 'reduction', kind: 'damage-reduction', trigger: 'before-damage',
              amount: 3, damageTypes: ['slashing'], oncePerTurn: true,
            },
          }] } : {}),
        })
      const makeState = () => {
        const state = dnd.startDnd5eHeadlessCombat('browser-activity-e2e', [
          makeCombatant('actor', 'player', 20), makeCombatant('target', 'dm', 10),
        ])
        state.distanceFeetByCombatantPair = { [dnd.dnd5eCombatantPairKey('actor', 'target')]: 5 }
        return state
      }

      const active = dnd.resolveRegisteredDnd5eActivityInCombatV1({
        state: makeState(),
        combatRevision: 1,
        command: {
          schemaVersion: 1, commandId: 'browser-active-command', actorId: 'actor',
          packageId, packageVersion, activityId: 'browser-pulse', targetIds: ['target'], expectedRevision: 1,
        },
        authoritativeRolls: {},
        confirmedBy: 'actor',
      })
      if (active.phase !== 'commit' || !active.result.ok) return { active, attack: null, followUp: null }

      const attack = dnd.resolveDnd5eHeadlessAction(makeState(), {
        type: 'attack', actorId: 'actor', targetId: 'target', attackModifier: 4, d20: 18,
        damage: { count: 1, sides: 6, bonus: 2, rolls: [4], type: 'slashing' },
        classDamageContext: {
          weaponId: 'shortsword', weaponProperties: ['light'], mode: 'melee', finesse: true,
          strengthBased: false, weaponDamageSides: 6, damageType: 'slashing', adjacentEnemyOfTarget: false,
        },
        classDamageRolls: [],
      })
      if (!attack.ok) return { active: active.result, attack, followUp: null }
      const window = dnd.listDnd5eActivityTriggerWindowsV1({
        state: attack.state, events: attack.events, eventBatchId: 'browser-revision-2',
      }).find((candidate: { available: { activity: { id: string } }[] }) =>
        candidate.available.some((entry) => entry.activity.id === 'browser-light-follow-up'))
      if (!window) return { active: active.result, attack, followUp: null }
      const followUp = dnd.resolveRegisteredDnd5eActivityInCombatV1({
        state: attack.state,
        combatRevision: 2,
        command: {
          schemaVersion: 1, commandId: 'browser-follow-up-command', actorId: 'actor',
          packageId, packageVersion, activityId: 'browser-light-follow-up', targetIds: ['target'],
          expectedRevision: 2, triggerEventId: window.triggerContext.eventId,
        },
        authoritativeRolls: {},
        triggerContext: window.triggerContext,
        confirmedBy: 'actor',
      })
      return {
        active: {
          ok: active.result.ok,
          actorActionAvailable: active.result.state.combatants.actor.turn.actionAvailable,
          targetHp: active.result.state.combatants.target.currentHp,
        },
        attack: {
          ok: attack.ok,
          hasLightMetadata: attack.events.some((event: { type: string; weaponProperties?: string[] }) =>
            event.type === 'attack-resolved' && event.weaponProperties?.includes('light')),
          hasPassiveReduction: attack.events.some((event: { type: string; featureId?: string }) =>
            event.type === 'plugin-feature-passive-effect-applied' && event.featureId === 'browser-stone-guard'),
        },
        followUp: followUp.phase === 'commit' && followUp.result.ok ? {
          ok: true,
          actorBonusActionAvailable: followUp.result.state.combatants.actor.turn.bonusActionAvailable,
          targetHp: followUp.result.state.combatants.target.currentHp,
        } : followUp,
      }
    } finally {
      registration.dispose()
    }
  })

  expect(result).toEqual({
    active: { ok: true, actorActionAvailable: false, targetHp: 17 },
    attack: { ok: true, hasLightMetadata: true, hasPassiveReduction: true },
    followUp: { ok: true, actorBonusActionAvailable: false, targetHp: 15 },
  })
})
