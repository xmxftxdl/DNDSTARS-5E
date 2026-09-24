import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory, resolveDnd5eAttunementAfterShortRest, DND5E_SRD_ITEM_TEMPLATES } from './items'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { dnd5eAbilityCheckRollMode, startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { dnd5eSavingThrowMode } from './passiveDefenses'
import { validateAndNormalizeDnd5ePluginItemHeadlessProtocol } from './plugins/pluginItemHeadlessProtocol'

const hero = () => normalizeCharacter({ id: 'hero', name: 'hero', charClass: '战士', level: 3, currentHp: 30, maxHp: 30, equipment: {} })
const combatant = (character: ReturnType<typeof hero>) => createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20: 10, position: { x: 0, y: 0 } })
function grant(id: string) {
  const result = applyDnd5eInventoryMutation([hero()], { type: 'grant', characterId: 'hero', templateId: id, quantity: 1, identified: true })
  expect(result.ok).toBe(true)
  return result.characters
}
function drink(id: string) {
  const characters = grant(id)
  const instanceId = normalizeDnd5eInventory(characters[0]).entries[0].instanceId
  const used = applyDnd5eInventoryMutation(characters, { type: 'use', characterId: 'hero', instanceId })
  expect(used.ok).toBe(true)
  expect(normalizeDnd5eInventory(used.characters[0]).entries).toHaveLength(0)
  return combatant(used.characters[0])
}
describe('second item Headless batch', () => {
  it('limits antitoxin advantage to poison saves and excludes undead and constructs', () => {
    const actor = drink('srd-5.1:item:antitoxin-vial')
    expect(dnd5eSavingThrowMode(actor, 'con', { damageType: 'poison' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(actor, 'con', { condition: 'poisoned' })).toBe('advantage')
    expect(dnd5eSavingThrowMode(actor, 'con', { damageType: 'cold' })).toBe('normal')
    for (const creatureType of ['undead', 'construct']) expect(dnd5eSavingThrowMode({ ...actor, creatureType }, 'con', { damageType: 'poison' })).toBe('normal')
  })
  it('limits climbing advantage to climbing Athletics, including persisted effects', () => {
    const actor = drink('srd-5.1:magic-item:potion-of-climbing')
    expect(actor.classState.activeEffects?.[0].duration).toMatchObject({ remainingRounds: 600 })
    expect(actor.classState.activeEffects?.[0].modifiers?.climbSpeedEqualsWalking).toBe(true)
    expect(dnd5eAbilityCheckRollMode(actor, { ability: 'str', skill: 'athletics', context: 'climbing' })).toBe('advantage')
    expect(dnd5eAbilityCheckRollMode(actor, { ability: 'str', skill: 'athletics' })).toBe('normal')
    expect(dnd5eAbilityCheckRollMode(actor, { ability: 'dex', skill: 'acrobatics', context: 'climbing' })).toBe('normal')
  })
  it('blocks poison damage only while the periapt is worn', () => {
    let characters = grant('srd-5.1:magic-item:periapt-of-proof-against-poison')
    const instanceId = normalizeDnd5eInventory(characters[0]).entries[0].instanceId
    characters = applyDnd5eInventoryMutation(characters, { type: 'equip', characterId: 'hero', instanceId }).characters
    const actor = combatant(characters[0])
    expect(actor.classState.activeEffects?.[0].modifiers?.conditionImmunities).toContain('poisoned')
    const attacker = { ...combatant(hero()), id: 'attacker', initiative: 30 }
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('poison-item', [attacker, actor]), {
      type: 'attack', actorId: 'attacker', targetId: 'hero', d20: 15, attackModifier: 20,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'poison' },
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants.hero.currentHp).toBe(30)
    characters = applyDnd5eInventoryMutation(characters, { type: 'unequip', characterId: 'hero', instanceId }).characters
    expect(combatant(characters[0]).classState.activeEffects?.some(effect => effect.modifiers?.damageImmunity === 'poison')).toBeFalsy()
  })
  it('preserves base armor data and requires attunement for every resistance variant', () => {
    const armors = DND5E_SRD_ITEM_TEMPLATES.filter(item => item.id.startsWith('srd-5.1:magic-item:armor-of-resistance-'))
    expect(armors.length).toBeGreaterThanOrEqual(10)
    for (const armor of armors) {
      expect(armor.equipment?.dnd5e?.kind).toBe('armor')
      expect(armor.magicItem?.attunement).toBe('required')
    }
    let characters = grant(armors[0].id)
    const instanceId = normalizeDnd5eInventory(characters[0]).entries[0].instanceId
    characters = applyDnd5eInventoryMutation(characters, { type: 'equip', characterId: 'hero', instanceId }).characters
    expect(combatant(characters[0]).classState.activeEffects?.length ?? 0).toBe(0)
    characters = applyDnd5eInventoryMutation(characters, { type: 'prepare-attunement', characterId: 'hero', instanceId }).characters
    characters = [resolveDnd5eAttunementAfterShortRest(characters[0], Date.now())]
    expect(combatant(characters[0]).classState.activeEffects?.[0].modifiers?.damageResistance).toBe('acid')
  })
  it('validates all new declarations and keeps the wand reaction explicitly adjudicated', () => {
    for (const item of DND5E_SRD_ITEM_TEMPLATES.filter(item => /antitoxin-vial|potion-of-climbing|periapt-of-proof-against-poison|armor-of-resistance-|wand-of-binding/.test(item.id))) {
      expect(() => validateAndNormalizeDnd5ePluginItemHeadlessProtocol({ itemId: item.id, definition: item, hasEquipment: !!item.equipment })).not.toThrow()
    }
    const wand = DND5E_SRD_ITEM_TEMPLATES.find(item => item.id.endsWith(':wand-of-binding'))!
    expect(wand.useActions?.map(use => use.resourceCost?.amount)).toEqual([2, 5])
    expect(wand.useActions?.[0].effect).toMatchObject({ spellSaveDc: 17, spellId: 'hold-person' })
    expect(wand.magicItem?.automation).toBe('dm-adjudication')
  })
})
