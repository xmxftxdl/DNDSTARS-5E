import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory, resolveDnd5eAttunementAfterShortRest, dnd5eInventoryItemTemplate } from './items'
import { createDnd5eConditionEffect, projectDnd5eActiveEffectState } from './activeEffects'
import { healDnd5eInventoryTarget } from './inventoryHealing'
import { createCombatantFromDnd5eCharacter, migrateCharacterToDnd5e } from './character'
import { startDnd5eHeadlessCombat, resolveDnd5eHeadlessAction } from './headlessCombatEngine'
import { validateAndNormalizeDnd5ePluginItemHeadlessProtocol } from './plugins/pluginItemHeadlessProtocol'

const hero = () => normalizeCharacter({ id: 'hero', name: 'hero', charClass: '战士', level: 3, currentHp: 20, maxHp: 20, equipment: {} })
const asCombatant = (character: ReturnType<typeof hero>, initiativeD20 = 10) => createCombatantFromDnd5eCharacter({ character: migrateCharacterToDnd5e(character), controller: 'player', initiativeD20, position: { x: 0, y: 0 } })

describe('item Headless integration', () => {
  it('revives a dying character and removes only the zero-HP unconscious effect', () => {
    const effects = ['zero-hit-points', 'sleep'].map(rulesId => createDnd5eConditionEffect({
      id: rulesId, condition: 'unconscious', targetId: 'hero', source: { kind: 'system', rulesId }, duration: { type: 'permanent' },
    }))
    const target = { ...hero(), currentHp: 0, deathSaveSuccesses: 1, deathSaveFailures: 2, deathSaveStable: true,
      conditions: projectDnd5eActiveEffectState(effects).conditions, dnd5eCombatState: { activeEffects: effects } }
    const healed = healDnd5eInventoryTarget(target, 7)
    expect(healed.character).toMatchObject({ currentHp: 7, deathSaveSuccesses: 0, deathSaveFailures: 0, deathSaveStable: false })
    expect(healed.character.dnd5eCombatState?.activeEffects?.map(effect => effect.id)).toEqual(['sleep'])
    expect(healed.character.conditions).toContain('unconscious')
    const onlyZero = healDnd5eInventoryTarget({ ...target, dnd5eCombatState: { activeEffects: [effects[0]] } }, 7)
    expect(onlyZero.character.conditions).not.toContain('unconscious')
  })
  it('leaves a player dying after overkill rather than fabricating three failed saves', () => {
    const attacker = asCombatant({ ...hero(), id: 'attacker' }, 20)
    const target = asCombatant({ ...hero(), id: 'target', currentHp: 1 }, 1)
    const result = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('overkill-player', [attacker, target]), {
      type: 'attack', actorId: attacker.id, targetId: target.id, d20: 15, attackModifier: 20,
      damage: { count: 4, sides: 10, bonus: 0, rolls: [10, 10, 10, 10], type: 'slashing' },
    })
    expect(result.ok).toBe(true)
    expect(result.state.combatants[target.id]).toMatchObject({ currentHp: 0, deathSaves: { failures: 0, dead: false } })
  })
  it('consumes an invisibility potion and grants a non-concentration effect with attack/cast breaks', () => {
    const granted = applyDnd5eInventoryMutation([hero()], { type: 'grant', characterId: 'hero', templateId: 'srd-5.1:magic-item:potion-of-invisibility', quantity: 1, identified: true })
    const entry = normalizeDnd5eInventory(granted.characters[0]).entries[0]
    const used = applyDnd5eInventoryMutation(granted.characters, { type: 'use', characterId: 'hero', instanceId: entry.instanceId })
    expect(used.ok).toBe(true)
    expect(used.characters[0].conditions).toContain('invisible')
    expect(used.characters[0].dnd5eCombatState?.activeEffects).toEqual(expect.arrayContaining([expect.objectContaining({
      duration: { type: 'rounds', remainingRounds: 600, tickOn: 'target-turn-end' }, breakOn: ['makes-attack', 'casts-spell'],
    })]))
    expect(normalizeDnd5eInventory(used.characters[0]).entries).toHaveLength(0)
  })
  it('requires attunement and equipment for a resistance ring, then removes its effect on unequip', () => {
    let characters = applyDnd5eInventoryMutation([hero()], { type: 'grant', characterId: 'hero', templateId: 'srd-5.1:magic-item:ring-of-resistance-fire', quantity: 1, identified: true }).characters
    const instanceId = normalizeDnd5eInventory(characters[0]).entries[0].instanceId
    characters = applyDnd5eInventoryMutation(characters, { type: 'equip', characterId: 'hero', instanceId }).characters
    expect(asCombatant(characters[0]).classState.activeEffects?.some(effect => effect.modifiers?.damageResistance === 'fire')).toBeFalsy()
    characters = applyDnd5eInventoryMutation(characters, { type: 'prepare-attunement', characterId: 'hero', instanceId }).characters
    characters = [resolveDnd5eAttunementAfterShortRest(characters[0], 100)]
    expect(asCombatant(characters[0]).classState.activeEffects?.some(effect => effect.modifiers?.damageResistance === 'fire')).toBe(true)
    const attacker = asCombatant({ ...hero(), id: 'attacker' }, 20)
    const protectedHero = asCombatant(characters[0], 1)
    const hit = resolveDnd5eHeadlessAction(startDnd5eHeadlessCombat('ring-resistance', [attacker, protectedHero]), {
      type: 'attack', actorId: 'attacker', targetId: 'hero', d20: 15, attackModifier: 20,
      damage: { count: 1, sides: 10, bonus: 0, rolls: [10], type: 'fire' },
    })
    expect(hit.ok).toBe(true)
    expect(hit.state.combatants.hero.currentHp).toBe(15)
    characters = applyDnd5eInventoryMutation(characters, { type: 'unequip', characterId: 'hero', instanceId }).characters
    expect(asCombatant(characters[0]).classState.activeEffects?.some(effect => effect.modifiers?.damageResistance === 'fire')).toBeFalsy()
  })
  it('validates newly connected item declarations', () => {
    for (const slug of ['wand-of-fireballs', 'wand-of-lightning-bolts', 'potion-of-invisibility', 'potion-of-water-breathing', 'ring-of-free-action', 'ring-of-feather-falling', 'ring-of-water-walking', 'ring-of-resistance-fire', 'potion-of-resistance-fire']) {
      const item = dnd5eInventoryItemTemplate(`srd-5.1:magic-item:${slug}`)!
      expect(() => validateAndNormalizeDnd5ePluginItemHeadlessProtocol({ itemId: slug, definition: item, hasEquipment: !!item.equipment })).not.toThrow()
    }
  })
})
