import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation } from './items'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { createDnd5eMechanicalEffect, normalizeDnd5eActiveEffects, validateDnd5eActiveEffectsStrict } from './activeEffects'
import { dnd5eHeldSpellcastingFocus, dnd5eHeldSpellcastingFocusMatches, dnd5eSpellComponentCheck } from './spellComponents'
import { dnd5eActivityActorSnapshotFromCombatantV1 } from './activities/dnd5eActivityCombatAuthority'
import { resolveDnd5eAppliedEffectDefinitionV1 } from './activities/dnd5eActivityExecutor'
import { validateDnd5eEffectDefinitionV1 } from './activities/dnd5eActivityValidation'
import type { Dnd5eEffectDefinitionV1 } from './activities/dnd5eEffectContracts'

const definition: Dnd5eEffectDefinitionV1 = { schemaVersion: 1, id: 'weapon-focus', name: 'Weapon focus',
  stacking: 'replace', duration: { kind: 'rounds', rounds: 10, expiresAt: 'target-turn-end' },
  modifiers: [{ kind: 'weapon-enchantment', weaponSlot: 'main-hand',
    attackAndDamageBonus: { kind: 'constant', value: 0 }, spellcastingFocusClassIds: ['warlock'] }] }
const requirements = { verbal: true, somatic: true, material: true }
function fixture() {
  const initial = normalizeCharacter({ id: 'hero', name: 'Hero', charClass: '邪术师', level: 3,
    equipment: {}, dnd5eInventory: { schemaVersion: 3, entries: [] } })
  const granted = applyDnd5eInventoryMutation([initial], { type: 'grant', characterId: initial.id,
    templateId: 'srd-5.1:equipment:dnd5e-longsword', quantity: 1 })
  expect(granted.ok).toBe(true)
  const instanceId = granted.characters[0].dnd5eInventory!.entries[0].instanceId
  const equipped = applyDnd5eInventoryMutation(granted.characters, { type: 'equip', characterId: initial.id, instanceId, slot: 'mainWeapon' })
  expect(equipped.ok).toBe(true)
  const actor = equipped.characters[0]
  const combatant = createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(actor), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
  const snapshot = dnd5eActivityActorSnapshotFromCombatantV1(combatant)
  const resolved = resolveDnd5eAppliedEffectDefinitionV1(definition, { actor: snapshot, target: snapshot })
  const effect = createDnd5eMechanicalEffect({ definitionId: definition.id, label: definition.name,
    source: { kind: 'spell', actorId: actor.id }, targetId: actor.id, modifiers: resolved.modifierGroups![0] })
  actor.dnd5eCombatState = { ...actor.dnd5eCombatState, activeEffects: [effect] }
  return { actor, instanceId, snapshot, effect }
}
it('resolves the Host inventory binding, persists it, and supplies only the declared class focus', () => {
  expect(validateDnd5eEffectDefinitionV1(definition)).toEqual([])
  const { actor, instanceId } = fixture()
  actor.dnd5eCombatState!.activeEffects = normalizeDnd5eActiveEffects(JSON.parse(JSON.stringify(actor.dnd5eCombatState!.activeEffects)))
  expect(dnd5eHeldSpellcastingFocus(actor, 'warlock')?.instanceId).toBe(instanceId)
  expect(dnd5eHeldSpellcastingFocusMatches(actor, instanceId, 'warlock')).toBe(true)
  expect(dnd5eSpellComponentCheck(actor, requirements, 'warlock').material).toBe('focus-or-pouch')
  expect(dnd5eHeldSpellcastingFocus(actor, 'wizard')).toBeUndefined()
  expect(dnd5eSpellComponentCheck(actor, { ...requirements, costlyMaterial: true }, 'warlock').material).toBe('unsupported-costly-material')
  expect(dnd5eSpellComponentCheck(actor, { ...requirements, consumedMaterial: true }, 'warlock').material).toBe('unsupported-costly-material')
})
it('stops supplying the focus on suspension, removal, stowing, unidentified or replaced items', () => {
  for (const change of [
    (f: ReturnType<typeof fixture>) => { f.effect.suspendedBy = ['antimagic'] },
    (f: ReturnType<typeof fixture>) => { f.actor.dnd5eCombatState!.activeEffects = [] },
    (f: ReturnType<typeof fixture>) => { f.actor.dnd5eInventory!.entries[0].equippedSlot = undefined },
    (f: ReturnType<typeof fixture>) => { f.actor.dnd5eInventory!.entries[0].identified = false },
    (f: ReturnType<typeof fixture>) => { f.actor.dnd5eInventory!.entries[0].instanceId = 'different-copy' },
    (f: ReturnType<typeof fixture>) => { f.actor.dnd5eInventory!.entries = [] },
  ]) {
    const f = fixture(); change(f)
    expect(dnd5eHeldSpellcastingFocus(f.actor, 'warlock')).toBeUndefined()
  }
})
it('rejects malformed focus declarations and absent physical inventory identity', () => {
  for (const ids of [[], ['warlock', 'warlock'], ['*'], 'warlock']) {
    const bad = { ...definition, modifiers: [{ ...definition.modifiers![0], spellcastingFocusClassIds: ids }] } as Dnd5eEffectDefinitionV1
    expect(validateDnd5eEffectDefinitionV1(bad).length).toBeGreaterThan(0)
  }
  const { snapshot, effect } = fixture()
  delete snapshot.equipment!.mainHand!.inventoryInstanceId
  expect(() => resolveDnd5eAppliedEffectDefinitionV1(definition, { actor: snapshot, target: snapshot })).toThrow('concrete inventory weapon')
  delete effect.modifiers!.weaponEnchantment!.inventoryInstanceId
  expect(validateDnd5eActiveEffectsStrict([effect]).ok).toBe(false)
  expect(normalizeDnd5eActiveEffects([effect])[0]?.modifiers?.weaponEnchantment).toBeUndefined()
})
