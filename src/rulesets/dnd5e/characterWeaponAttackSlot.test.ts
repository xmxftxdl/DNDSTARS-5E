import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { registerDnd5eRulesPlugin } from './pluginApi'
import { dnd5eCharacterWeaponAttackSlot, dnd5eCharacterAttackTeleportRange } from './characterWeaponAttackSlot'

it('offers attack teleport only for an owned, eligible imported ability', () => {
  let id = ''
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: 'test.teleport-choice', name: 'Teleport', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
    setup(api) { id = api.registerFeature({ id: 'step', name: 'Step', description: 'Synthetic', summary: 'Synthetic',
      automation: 'full', minimumLevel: 11,
      declarativeAbility: { schemaVersion: 1, id: 'step', name: 'Step', description: 'Synthetic',
        level: 11, trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
        mechanic: { kind: 'attack-action-teleport', rangeFeet: 10 } } }) },
  })
  try {
    const character = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '游侠', level: 11, dnd5ePluginFeatureIds: [id] })
    expect(dnd5eCharacterAttackTeleportRange(character)).toBe(10)
    expect(dnd5eCharacterAttackTeleportRange({ ...character, dnd5ePluginFeatureIds: [] })).toBeUndefined()
    expect(dnd5eCharacterAttackTeleportRange(normalizeCharacter({ id: 'low', name: 'Low',
      charClass: '游侠', level: 10, dnd5ePluginFeatureIds: [id] }))).toBeUndefined()
  } finally { dispose() }
})

it('offers a distinct-target continuation and preserves the next ordinary action after consuming it', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: 'test.distinct-ui', name: 'Distinct', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
    setup(api) { featureId = api.registerFeature({ id: 'distinct', name: 'Distinct', description: 'Synthetic',
      summary: 'Synthetic', automation: 'full', declarativeAbility: { schemaVersion: 1, id: 'distinct',
        name: 'Distinct', description: 'Synthetic', level: 1, trigger: { kind: 'passive' },
        targeting: { kind: 'self' }, effects: [], automation: 'full',
        mechanic: { kind: 'distinct-target-bonus-attack', minimumDistinctTargets: 2 } } }) },
  })
  try {
    const turnKey = 'combat:1:hero'
    const character = normalizeCharacter({ id: 'hero', name: 'Hero', level: 5, charClass: '游侠',
      dnd5ePluginFeatureIds: [featureId], dnd5eCombatState: { attackActionHistory: {
        turnKey, actionOrdinal: 1, attacksTaken: 2, creatureTargetIds: ['a', 'b'], restricted: false,
      } } })
    const input = { character, turnKey, attacksUsed: 2, attacksPerAction: 2, actionCount: 2, extraWeaponEligible: true }
    expect(dnd5eCharacterWeaponAttackSlot(input)).toMatchObject({ spendsAction: false, distinctTargetBonusFeatureId: featureId })
    expect(dnd5eCharacterWeaponAttackSlot({ ...input, distinctTargetEligible: false })).toMatchObject({ spendsAction: true })
    expect(dnd5eCharacterWeaponAttackSlot({ ...input, turnKey: 'old', actionCount: 1 })).toBeUndefined()
    character.dnd5eCombatState!.attackActionHistory!.usedDistinctTargetBonusFeatureIds = [featureId]
    character.dnd5eCombatState!.attackActionHistory!.bonusAttacksTakenThisTurn = 1
    expect(dnd5eCharacterWeaponAttackSlot({ ...input, attacksUsed: 3 })).toMatchObject({ spendsAction: true })
    expect(dnd5eCharacterWeaponAttackSlot({ ...input, attacksUsed: 3, actionCount: 1 })).toBeUndefined()
    character.dnd5eCombatState!.attackActionHistory!.bonusAttacksTakenThisTurn = 4
    expect(dnd5eCharacterWeaponAttackSlot({ ...input, attacksUsed: 3 })).toBeUndefined()
  } finally { dispose() }
})

it('offers a granted weapon-only continuation without enabling replacements, expired grants or exhausted slots', () => {
  let featureId = ''
  const dispose = registerDnd5eRulesPlugin({
    manifest: { id: 'test.weapon-slot-ui', name: 'Slots', version: '1.0.0', apiVersion: 2,
      rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Tests', license: 'CC0' },
    setup(api) {
      featureId = api.registerFeature({ id: 'ambush', name: 'Ambush', description: 'Synthetic', summary: 'Synthetic',
        automation: 'full', minimumLevel: 3,
        declarativeAbility: { schemaVersion: 1, id: 'ambush', name: 'Ambush', description: 'Synthetic', level: 3,
          trigger: { kind: 'passive' }, targeting: { kind: 'self' }, effects: [], automation: 'full',
          mechanic: { kind: 'first-own-turn-extra-weapon-attack', damageDice: { count: 1, sides: 8 } } } })
    },
  })
  try {
    const turnKey = 'combat:1:hero'
    const character = normalizeCharacter({ id: 'hero', name: 'Hero', level: 5, charClass: '游侠',
      dnd5ePluginFeatureIds: [featureId], dnd5eCombatState: {
        firstOwnCombatTurn: { combatId: 'combat', turnKey },
        firstOwnTurnWeaponAttack: { featureId, turnKey },
      } })
    const base = { character, turnKey, attacksUsed: 2, attacksPerAction: 2, actionCount: 1, extraWeaponEligible: true }
    expect(dnd5eCharacterWeaponAttackSlot(base)).toMatchObject({ weaponOnly: true, spendsAction: false })
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, attacksUsed: 1 })).toMatchObject({ spendsAction: false })
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, attacksUsed: 3 })).toBeUndefined()
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, attacksUsed: 3, actionCount: 2 })).toMatchObject({ spendsAction: true })
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, extraWeaponEligible: false })).toBeUndefined()
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, loadingLimited: true, attacksPerAction: 1 })).toBeUndefined()
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, turnKey: 'combat:2:hero' })).toBeUndefined()
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, character: { ...character, dnd5ePluginFeatureIds: [] } })).toBeUndefined()
    for (const grant of [undefined, { featureId: 'forged', turnKey }, { featureId, turnKey: 'old' }]) {
      expect(dnd5eCharacterWeaponAttackSlot({ ...base, character: { ...character,
        dnd5eCombatState: { ...character.dnd5eCombatState, firstOwnTurnWeaponAttack: grant } } })).toBeUndefined()
    }
    expect(dnd5eCharacterWeaponAttackSlot({ ...base, character: { ...character, level: 2 } })).toBeUndefined()
  } finally { dispose() }
})
