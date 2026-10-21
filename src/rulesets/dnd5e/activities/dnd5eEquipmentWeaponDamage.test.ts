import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../../store/characters'
import { automationCapabilityFromLegacyStatus } from '../../../domain/automation/automationCapability'
import { DND5E_LONGBOW, DND5E_SHORTBOW, dnd5eWeaponAttackProfile, dnd5eWeaponDamageSource } from '../equipment'
import { materializeDnd5eEquipmentWeaponDamage } from './dnd5eEquipmentWeaponDamage'
import { resolveDnd5eActivity } from './dnd5eActivityExecutor'
import type { Dnd5eActivityDefinitionV1 } from './dnd5eActivityContracts'
import { validateDnd5eActivityDefinitionV1 } from './dnd5eActivityValidation'
import { prepareDnd5eLocalContentJson } from '../localContentCollection'
import { registerDnd5eRulesPlugin } from '../pluginApi'
import { dnd5eRulesPluginFromContentPackageV2 } from '../contentPackageV2'
import { createDnd5eCombatant, startDnd5eHeadlessCombat } from '../headlessCombatEngine'
import { resolveRegisteredDnd5eActivityInCombatV1 } from './dnd5eActivityCombatAuthority'
import { collectDnd5eActivityFormulaRollDeclarationsV1 } from './dnd5eActivityHeadlessCompiler'
import { applyDnd5eInventoryMutation } from '../items'

const activity: Dnd5eActivityDefinitionV1 = { schemaVersion: 1, id: 'replacement', name: 'Replacement',
  activation: { kind: 'free' }, target: { kind: 'creature', relation: 'any', count: 1 },
  outcomes: [{ id: 'damage', when: { kind: 'always' }, operations: [{ id: 'weapon', kind: 'damage', target: 'target',
    amount: { kind: 'constant', value: 0 }, damageType: 'inherit-primary',
    equipmentWeaponDamage: { rollId: 'weapon', weaponBaseIds: ['dnd5e-longbow', 'dnd5e-shortbow'] } }] }],
  automation: automationCapabilityFromLegacyStatus('full') }

it.each([DND5E_LONGBOW, DND5E_SHORTBOW])('reads actual $name dice and ability bonus without an attack roll', weapon => {
  for (const dex of [8, 18]) {
    const character = normalizeCharacter({ id: 'archer', name: 'Archer', charClass: '战士', level: 3,
      abilities: { str: 10, dex, con: 10, int: 10, wis: 10, cha: 10 }, equipment: { mainWeapon: weapon } })
    const profile = dnd5eWeaponAttackProfile(character)!
    const snapshot = { profile, source: dnd5eWeaponDamageSource(weapon)! }
    expect(validateDnd5eActivityDefinitionV1(activity)).toEqual([])
    const bound = materializeDnd5eEquipmentWeaponDamage(activity, snapshot)
    expect(bound.outcomes[0].operations[0]).toMatchObject({ damageType: 'piercing', amount: { kind: 'add', values: [
      { kind: 'dice', count: 1, sides: weapon.id === 'dnd5e-longbow' ? 8 : 6 },
      { kind: 'constant', value: Math.floor((dex - 10) / 2) }, { kind: 'constant', value: 0 },
    ] } })
    const actor = { id: 'archer', name: 'Archer', controller: 'player', level: 3, proficiencyBonus: 2,
      abilities: character.abilities, armorClass: 10, currentHp: 20, maxHp: 20, conditions: [] }
    const input = { activity, actor, targets: [{ ...actor, id: 'target' }], rolls: { weapon: { values: [4] } } }
    expect(resolveDnd5eActivity(input).ok).toBe(false)
    const result = resolveDnd5eActivity({ ...input, equipmentWeaponDamage: snapshot })
    expect(result).toMatchObject({ ok: true, proposals: [expect.objectContaining({ kind: 'deal-damage', amount: 4 + Math.floor((dex - 10) / 2) })] })
    expect(activity.outcomes[0].operations[0]).toHaveProperty('equipmentWeaponDamage')
    expect(() => materializeDnd5eEquipmentWeaponDamage(activity, { ...snapshot, profile: { ...profile, baseWeaponId: 'dnd5e-dagger' } })).toThrow('ineligible')
  }
})

it.each([[1, 3, 10], [20, 3, 5], [20, 4, 5]])('imports combined damage on save %s with extra roll %s for %s damage', (save, extra, expectedDamage) => {
  return verifyImportedDamage(save, extra, expectedDamage)
})

it.each([3, 18])('requests and resolves only scaled extra dice at level %s', level => {
  const character = normalizeCharacter({ id: 'archer', name: 'Archer', charClass: '战士', level,
    abilities: { str: 10, dex: 18, con: 10, int: 16, wis: 10, cha: 10 }, equipment: { mainWeapon: DND5E_LONGBOW } })
  const snapshot = { profile: dnd5eWeaponAttackProfile(character)!, source: dnd5eWeaponDamageSource(DND5E_LONGBOW)! }
  const actor = { id: 'archer', name: 'Archer', controller: 'player', level, classLevels: { fighter: level }, proficiencyBonus: 2,
    abilities: character.abilities, armorClass: 10, currentHp: 20, maxHp: 20, conditions: [] }
  const op = activity.outcomes[0].operations[0]
  if (op.kind !== 'damage') throw Error('fixture')
  const scaledActivity: Dnd5eActivityDefinitionV1 = { ...activity,
    scaling: [{ basis: 'custom-table', classId: 'fighter', table: [{ level: 3, value: 0 }, { level: 18, value: 1 }],
      adjustments: [{ operationId: 'weapon', diceCountPerStep: 1 }] }],
    outcomes: [{ ...activity.outcomes[0], operations: [{ ...op, amount: { kind: 'dice', rollId: 'extra', count: 1, sides: 6 } }] }],
  }
  const count = level === 18 ? 2 : 1
  const recipe = collectDnd5eActivityFormulaRollDeclarationsV1(scaledActivity, false, { actor }, undefined, snapshot)
  expect(recipe).toEqual(expect.arrayContaining([{ id: 'weapon', count: 1, sides: 8 }, { id: 'extra', count, sides: 6 }]))
  expect(recipe).toHaveLength(2)
  const result = resolveDnd5eActivity({ activity: scaledActivity, actor, targets: [{ ...actor, id: 'target' }],
    equipmentWeaponDamage: snapshot, rolls: Object.fromEntries(recipe.map(roll => [roll.id, { values: Array(roll.count).fill(3) }])) })
  expect(result).toMatchObject({ ok: true, proposals: [expect.objectContaining({ kind: 'deal-damage', amount: 7 + count * 3 })] })
})

it.each([
  { attacksUsed: 0, actionAvailable: true, accepted: true },
  { attacksUsed: 1, actionAvailable: false, accepted: true },
  { attacksUsed: 2, actionAvailable: true, accepted: false },
  { attacksUsed: 0, actionAvailable: false, accepted: false },
  { attacksUsed: 0, actionAvailable: true, accepted: false, resource: 0 },
  { attacksUsed: 0, actionAvailable: true, accepted: false, ammunition: 0 },
])('commits replacement attack budget $attacksUsed with action $actionAvailable', budget =>
  verifyImportedDamage(1, 3, 10, budget))

async function verifyImportedDamage(save: number, extra: number, expectedDamage: number,
  budget?: { attacksUsed: number; actionAvailable: boolean; accepted: boolean; resource?: number; ammunition?: number }) {
  const operation = activity.outcomes[0].operations[0]
  if (operation.kind !== 'damage') throw Error('fixture')
  const saveActivity: Dnd5eActivityDefinitionV1 = { ...activity,
    consumption: budget ? [{ kind: 'resource', resourceId: 'dnd5e-arcane-shot', amount: { kind: 'constant', value: 1 }, consumeOn: 'resolve' }] : undefined,
    checks: [{ id: 'save', rollId: 'save', kind: 'saving-throw', ability: 'dex', dc: { kind: 'constant', value: 12 }, scope: 'per-target', rollMode: 'normal' }],
    outcomes: (['failure', 'success'] as const).map(result => ({ id: result,
      when: { kind: 'check', checkId: 'save', result }, operations: [{ ...operation, id: `damage-${result}`,
        amount: { kind: 'dice', rollId: 'extra', count: 1, sides: 6 },
        equipmentWeaponDamage: { ...operation.equipmentWeaponDamage!, multiplier: result === 'success' ? 0.5 : 1 },
      }] })),
  }
  const { package: pkg } = await prepareDnd5eLocalContentJson(JSON.stringify({ name: 'Equipment replacement', version: '1.0.0',
    features: [{ id: 'replacement', name: 'Replacement', description: 'Test', summary: 'Test', automation: 'full' }],
    activities: [{ ...saveActivity, legacySource: { kind: 'feature', id: 'replacement' } }],
  }))
  const dispose = registerDnd5eRulesPlugin(dnd5eRulesPluginFromContentPackageV2(pkg))
  try {
    const make = (id: string) => createDnd5eCombatant({ id, name: id, controller: 'player', initiative: id === 'actor' ? 20 : 10,
      abilities: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 }, proficiencyBonus: 2,
      armorClass: 10, currentHp: 20, maxHp: 20, temporaryHp: 0, speed: 30, position: { x: 0, y: 0 }, concentrating: false })
    const actor = make('actor'), target = make('target')
    actor.pluginFeatureIds = [`${pkg.manifest.id}:replacement`]
    const state = startDnd5eHeadlessCombat('replacement', [actor, target])
    if (budget) {
      state.combatants.actor.turn.actionAvailable = budget.actionAvailable
      state.combatants.actor.classResources['dnd5e-arcane-shot'] = { current: budget.resource ?? 1, max: 2 }
    }
    let character = normalizeCharacter({ id: 'actor', name: 'Archer', charClass: '战士', level: 3,
      abilities: actor.abilities, equipment: { mainWeapon: DND5E_LONGBOW }, dnd5eInventory: { schemaVersion: 1, entries: [] } })
    if (budget && budget.ammunition !== 0) character = applyDnd5eInventoryMutation([character], {
      type: 'grant', characterId: 'actor', templateId: 'srd-5.1:item:arrows', quantity: 2,
    }).characters[0]
    const originalInventory = JSON.stringify(character.dnd5eInventory)
    const equipmentWeaponDamage = { profile: dnd5eWeaponAttackProfile(character)!, source: dnd5eWeaponDamageSource(DND5E_LONGBOW)! }
    const command = { schemaVersion: 1 as const, commandId: 'replacement', actorId: 'actor', targetIds: ['target'],
      packageId: pkg.manifest.id, packageVersion: pkg.manifest.version, activityId: 'replacement', expectedRevision: 1,
      equipmentWeaponDamage }
    const input = { state, command, combatRevision: 1, authoritativeRolls: {
      weapon: { values: [3] }, extra: { values: [extra] }, 'save:target': { values: [save] },
    }, confirmedBy: 'actor' as const }
    expect(resolveRegisteredDnd5eActivityInCombatV1(input).result.ok).toBe(false)
    const result = resolveRegisteredDnd5eActivityInCombatV1({ ...input, equipmentWeaponDamage,
      inventoryOwner: budget ? character : undefined,
      equipmentAttackBudget: budget && { attacksPerAction: 2, actionCount: 1, attacksUsed: budget.attacksUsed },
    }).result
    if (budget && !budget.accepted) {
      expect(result.ok).toBe(false)
      expect(state.combatants.target.currentHp).toBe(20)
      expect(state.combatants.actor.turn.actionAvailable).toBe(budget.actionAvailable)
      expect(state.combatants.actor.classResources['dnd5e-arcane-shot'].current).toBe(budget.resource ?? 1)
      expect(JSON.stringify(character.dnd5eInventory)).toBe(originalInventory)
      expect(result).not.toHaveProperty('inventoryOwner')
      return
    }
    expect(result.ok, JSON.stringify(result)).toBe(true)
    if (!result.ok) throw Error('Expected committed weapon damage')
    // (3 weapon + 4 ability + 3 extra) / 2 = 5, not floor(7/2)+floor(3/2)=4.
    expect(result.state.combatants.target.currentHp).toBe(20 - expectedDamage)
    expect(result.events.filter(e => e.type === 'damage-applied')).toHaveLength(1)
    expect(result.events.some(e => e.type === 'attack-resolved')).toBe(false)
    expect(state.combatants.target.currentHp).toBe(20)
    if (budget) {
      expect(result).toMatchObject({ equipmentAttackSlot: { attackNumber: budget.attacksUsed + 1, attacksAllowed: 2,
        spendsAction: budget.attacksUsed === 0 } })
      expect(result.state.combatants.actor.turn.actionAvailable).toBe(false)
      if (budget.attacksUsed === 0) {
        expect(result.state.combatants.actor.classState.attackActionHistory).toMatchObject({
          actionOrdinal: 1, attacksTaken: 1, creatureTargetIds: [],
        })
      }
      expect(result.state.combatants.actor.classResources['dnd5e-arcane-shot'].current).toBe(0)
      expect(result.events.filter(event => event.type === 'turn-resource-spent' && event.resource === 'action'))
        .toHaveLength(budget.attacksUsed === 0 ? 1 : 0)
      expect(state.combatants.actor.turn.actionAvailable).toBe(budget.actionAvailable)
      expect(result).toMatchObject({ inventoryOwner: { dnd5eInventory: { entries: expect.arrayContaining([
        expect.objectContaining({ quantity: 1, item: expect.objectContaining({ ammunitionKind: 'arrow' }) }),
      ]) } } })
      expect(JSON.stringify(character.dnd5eInventory)).toBe(originalInventory)
    }
  } finally { dispose() }
}
