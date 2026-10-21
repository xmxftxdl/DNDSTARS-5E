import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'
import { exportDnd5eStarMod, readDnd5eStarMod } from './starModAdapter'
import { dnd5eRulesPluginFromUnifiedContentBundleV1, type Dnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { cloneStaticCombatModifiers, registerDnd5eRulesPlugin } from './pluginApi'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { dnd5eEffectiveCharacterMovementProfile } from './characterMovement'
import { dnd5eEffectiveWalkSpeed, dnd5eEffectiveOptionalMovementSpeed, dnd5eEffectiveFlySpeed, dnd5eEffectiveMovementPoolSpeed, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction, replaceDnd5eCombatantActiveEffects } from './headlessCombatEngine'
import { createDnd5eMechanicalEffect, createDnd5eConditionEffect } from './activeEffects'
import { dnd5eInventoryLoad } from './items'

it('roundtrips existing-mode bonuses and agrees between character display and Host without granting missing modes', async () => {
  const namespace = 'test.existing-movement'
  const bundle: Dnd5eUnifiedContentBundleV1 = { format: 'dndstars5e-unified-content', schemaVersion: 1,
    manifest: { id: namespace, name: 'Movement', version: '1.0.0', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0-1.0', distributionPolicy: 'local-only', contentCategory: 'mixed' }, assets: [],
    definitions: [{ schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'ready', name: 'Ready',
      automation: automationCapabilityFromLegacyStatus('full'),
      payload: { id: 'ready', name: 'Ready', summary: 'Synthetic', description: 'Synthetic', automation: 'full', classRequirements: [{ classId: 'rogue', minimumLevel: 9 }] },
      effects: [{ schemaVersion: 1, id: 'movement-passive', name: 'Movement', duration: { kind: 'permanent' }, stacking: 'unique-by-source',
        modifiers: [{ kind: 'character-capability', capability: 'existingMovementSpeedBonuses', value: { walk: 10, climb: 10, swim: 10 } }] }],
    }] }
  bundle.definitions = [...bundle.definitions, {
    schemaVersion: 1, namespace, version: '1.0.0', kind: 'feature', id: 'stride', name: 'Stride',
    automation: automationCapabilityFromLegacyStatus('full'),
    payload: { id: 'stride', name: 'Stride', summary: 'Synthetic', description: 'Synthetic', automation: 'full' },
    effects: [{ schemaVersion: 1, id: 'stride-speed', name: 'Stride', duration: { kind: 'permanent' }, stacking: 'unique-by-source',
      modifiers: [{ kind: 'speed', mode: 'add', value: { kind: 'constant', value: 5 } }] }],
  }]
  const decoded = await readDnd5eStarMod(await exportDnd5eStarMod(bundle))
  const roundtrip = await readDnd5eStarMod(await exportDnd5eStarMod(decoded.bundle))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromUnifiedContentBundleV1(roundtrip.bundle))
  try {
    const hero = normalizeCharacter({ id: 'hero', charClass: '游荡者', level: 9, speed: 30, currentHp: 20, maxHp: 20, rulesetId: 'dnd5e-2014-srd-5.1',
      dnd5eClassLevels: { rogue: 9 }, dnd5ePluginFeatureIds: [`${namespace}:ready`],
      dnd5eMovementSpeeds: { climb: 20, swim: 15, fly: 60 },
      abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 } })
    const check = (character: typeof hero, expected: number[]) => {
      const restored = JSON.parse(JSON.stringify(character)) as typeof hero
      const before = structuredClone(restored)
      const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(restored), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
      expect(actor.turn.movementRemaining).toBe(expected[4])
      expect([dnd5eEffectiveWalkSpeed(actor), dnd5eEffectiveOptionalMovementSpeed(actor, 'climb') ?? 0,
        dnd5eEffectiveOptionalMovementSpeed(actor, 'swim') ?? 0, dnd5eEffectiveFlySpeed(actor) ?? 0, dnd5eEffectiveMovementPoolSpeed(actor)]).toEqual(expected)
      const display = dnd5eEffectiveCharacterMovementProfile(restored)
      expect([display.walkSpeed, display.climbSpeed ?? 0, display.swimSpeed ?? 0, display.flySpeed ?? 0, display.maximumSpeed]).toEqual(expected)
      expect(restored).toEqual(before)
      return actor
    }
    check(hero, [40, 30, 25, 60, 60])
    const combined = { ...hero, dnd5ePluginFeatureIds: [...hero.dnd5ePluginFeatureIds!, `${namespace}:stride`] }
    check(combined, [45, 30, 25, 60, 60])
    check({ ...combined, exhaustionLevel: 2 }, [22, 15, 12, 30, 30])
    check({ ...hero, exhaustionLevel: 2 }, [20, 15, 12, 30, 30])
    check({ ...hero, exhaustionLevel: 5 }, [0, 0, 0, 0, 0])
    check({ ...hero, dnd5eMovementSpeeds: {} }, [40, 0, 0, 0, 40])
    check({ ...hero, dnd5eMovementSpeeds: { climb: 0, swim: 0, fly: 0 } }, [40, 0, 0, 0, 40])
    check({ ...hero, dnd5ePluginFeatureIds: [] }, [30, 20, 15, 60, 60])
    check({ ...hero, dnd5ePluginFeatureIds: [], exhaustionLevel: 2 }, [15, 10, 7, 30, 30])
    check({ ...hero, level: 8, dnd5eClassLevels: { rogue: 8 } }, [30, 20, 15, 60, 60])
    const effect = (modifiers: Parameters<typeof createDnd5eMechanicalEffect>[0]['modifiers']) => createDnd5eMechanicalEffect({
      definitionId: 'test:movement', label: 'Movement', source: { kind: 'spell', rulesId: 'test:movement' }, targetId: 'hero', modifiers,
    })
    const overloaded = { ...combined, dnd5eInventory: { schemaVersion: 1 as const, entries: [], currency: { cp: 0, sp: 0, ep: 0, gp: 10000, pp: 0 } } }
    expect(dnd5eInventoryLoad(overloaded).status).toBe('over-capacity')
    check(overloaded, [0, 0, 0, 0, 0])
    check({ ...overloaded, dnd5eCombatState: { activeEffects: [effect({ speedBonusFeet: 10, speedMultiplier: 2 })] } }, [0, 0, 0, 0, 0])
    const strengthened = { ...overloaded, dnd5eCombatState: { activeEffects: [effect({ carryingCapacityMultiplier: 2 })] } }
    expect(dnd5eInventoryLoad(strengthened).carryingCapacityLb).toBe(300)
    expect(dnd5eInventoryLoad(strengthened).status).not.toBe('over-capacity')
    const carrier = check(strengthened, [45, 30, 25, 60, 60])
    replaceDnd5eCombatantActiveEffects(carrier, [])
    expect(dnd5eEffectiveMovementPoolSpeed(carrier)).toBe(0)
    expect(carrier.turn.movementRemaining).toBe(0)
    const blocked = startDnd5eHeadlessCombat('overloaded', [carrier, { ...structuredClone(carrier), id: 'opponent', controller: 'dm', initiative: 1 }])
    expect(resolveDnd5eHeadlessAction(blocked, { type: 'move', actorId: carrier.id, to: { x: 5, y: 0 }, distance: 5 }).ok).toBe(false)
    replaceDnd5eCombatantActiveEffects(carrier, strengthened.dnd5eCombatState.activeEffects)
    expect(dnd5eEffectiveMovementPoolSpeed(carrier)).toBe(60)
    expect(carrier.turn.movementRemaining).toBe(60)
    check({ ...hero, dnd5eCombatState: { activeEffects: [effect({ speedMultiplier: 2 })] } }, [80, 60, 50, 120, 120])
    check({ ...hero, exhaustionLevel: 2, dnd5eCombatState: { activeEffects: [effect({ speedMultiplier: 2 })] } }, [40, 30, 25, 60, 60])
    check({ ...hero, dnd5eCombatState: { activeEffects: [effect({ speedPenaltyFeet: 10, speedMultiplier: 0.5 })] } }, [15, 10, 7, 25, 25])
    check({ ...hero, dnd5eMovementSpeeds: {}, dnd5eCombatState: { activeEffects: [effect({ speedBonusFeet: 10 })] } }, [50, 0, 0, 0, 50])
    check({ ...hero, conditions: ['restrained'], dnd5eCombatState: { activeEffects: [createDnd5eConditionEffect({ condition: 'restrained', source: { kind: 'spell', rulesId: 'test:restraint' }, targetId: 'hero' })] } }, [0, 0, 0, 0, 0])
    check({ ...hero, dnd5eMovementSpeeds: {}, dnd5eCombatState: { activeEffects: [effect({ climbSpeedEqualsWalking: true, swimSpeedEqualsWalking: true })] } }, [40, 40, 40, 0, 40])
    check({ ...hero, dnd5eCombatState: { activeEffects: [effect({ speedOverrideFeet: 0 })] } }, [0, 0, 0, 0, 0])
    const walker = { ...hero, dnd5eMovementSpeeds: {} }
    const actor = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(walker), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
    const combat = startDnd5eHeadlessCombat('movement-test', [actor, { ...structuredClone(actor), id: 'opponent', controller: 'dm', initiative: 1, position: { x: 100, y: 100 } }])
    expect(combat.combatants[actor.id]!.turn.movementRemaining).toBe(40)
    const moved = resolveDnd5eHeadlessAction(combat, { type: 'move', actorId: actor.id, to: { x: 35, y: 0 }, distance: 35 })
    expect(moved.ok, moved.ok ? '' : moved.reason).toBe(true)
    if (!moved.ok) throw new Error('Movement failed')
    expect(moved.state.combatants[actor.id]!.turn.movementRemaining).toBe(5)
    const dashed = resolveDnd5eHeadlessAction(moved.state, { type: 'dash', actorId: actor.id })
    expect(dashed.ok).toBe(true)
    if (!dashed.ok) throw new Error('Dash failed')
    expect(dashed.state.combatants[actor.id]!.turn.movementRemaining).toBe(45)
    actor.exhaustionLevel = 2
    const fatigued = startDnd5eHeadlessCombat('fatigued', [actor, { ...structuredClone(actor), id: 'opponent', controller: 'dm', initiative: 1 }])
    expect(fatigued.combatants[actor.id]!.turn.movementRemaining).toBe(20)
    const fatigueDash = resolveDnd5eHeadlessAction(fatigued, { type: 'dash', actorId: actor.id })
    expect(fatigueDash.ok).toBe(true)
    if (!fatigueDash.ok) throw new Error('Fatigued Dash failed')
    expect(fatigueDash.state.combatants[actor.id]!.turn.movementRemaining).toBe(40)
    actor.exhaustionLevel = 0
    expect(dnd5eEffectiveMovementPoolSpeed(JSON.parse(JSON.stringify(actor)))).toBe(40)
    for (const mode of ['polymorph', 'true-polymorph', 'wild-shape', 'shapechange'] as const) {
      const transformed = { ...walker, charClass: '德鲁伊', level: 17, dnd5eClassLevels: { rogue: 9, druid: 8 },
        dnd5eClassChoices: { classes: { druid: { selections: { 'wild-shape-known-forms': ['srd-5.1:giant-eagle'] } } } },
        dnd5eCombatState: { wildShapeFormId: 'srd-5.1:giant-eagle', wildShapeMode: mode,
        wildShapeCurrentHp: 26, wildShapeRoundsRemaining: 10, wildShapeMaximumChallengeRating: 1,
        wildShapeOriginalCurrentHp: 20, wildShapeOriginalMaxHp: 20, wildShapeOriginalArmorClass: 12,
        wildShapeOriginalSpeed: 30, wildShapeOriginalMovementSpeeds: { walk: 30 }, wildShapeOriginalAbilities: { ...hero.abilities },
        wildShapeOriginalSavingThrowBonuses: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 } } }
      check(transformed, [mode === 'polymorph' || mode === 'true-polymorph' ? 10 : 20, 0, 0, 80, 80])
      const tiredForm = check({ ...transformed, exhaustionLevel: 2 }, [mode === 'polymorph' || mode === 'true-polymorph' ? 5 : 10, 0, 0, 40, 40])
      if (mode === 'wild-shape') {
        const formCombat = startDnd5eHeadlessCombat('restore-form', [tiredForm, { ...structuredClone(tiredForm), id: 'opponent', controller: 'dm', initiative: 1 }])
        formCombat.combatants[tiredForm.id]!.turn.movementSpent = 5
        formCombat.combatants[tiredForm.id]!.turn.movementRemaining = 35
        const reverted = resolveDnd5eHeadlessAction(formCombat, { type: 'druid-end-wild-shape', actorId: tiredForm.id })
        expect(reverted.ok).toBe(true)
        if (!reverted.ok) throw new Error('Reverting form failed')
        expect(reverted.state.combatants[tiredForm.id]!.turn.movementRemaining).toBe(15)
        expect(dnd5eEffectiveWalkSpeed(reverted.state.combatants[tiredForm.id]!)).toBe(20)
      }
    }
    check(walker, [40, 0, 0, 0, 40])
  } finally { dispose() }
})

it.each([{}, { burrow: 10 }, { walk: 0 }, { walk: -1 }, { fly: 1.5 }, { swim: 1001 }, []])('rejects invalid existing movement bonuses %j', value => {
  expect(() => cloneStaticCombatModifiers({ existingMovementSpeedBonuses: value } as never, 'test')).toThrow()
})

it('clones the movement bonus map', () => {
  const input = { existingMovementSpeedBonuses: { walk: 10 } }
  const cloned = cloneStaticCombatModifiers(input, 'test')!
  cloned.existingMovementSpeedBonuses!.walk = 20
  expect(input.existingMovementSpeedBonuses.walk).toBe(10)
})
