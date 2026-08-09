import { describe, expect, it } from 'vitest'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
} from './spellComponents'
import { DND5E_MACE, DND5E_QUARTERSTAFF, DND5E_SHIELD } from './equipment'
import { applyDnd5eInventoryMutation, normalizeDnd5eInventory } from './items'
import { normalizeCharacter } from '../../store/characters'

describe('D&D 5e spell component authority checks', () => {
  it('parses the reviewed SRD component text instead of treating every spell alike', () => {
    expect(dnd5eCoreSpellComponentRequirements('fireball')).toMatchObject({
      verbal: true,
      somatic: true,
      material: true,
    })
    expect(dnd5eCoreSpellComponentRequirements('true-strike')).toMatchObject({
      verbal: false,
      somatic: true,
    })
  })

  it('blocks verbal spells while silenced', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: ['沉默'],
    }, {
      verbal: true,
      somatic: true,
      material: false,
    }, 'wizard')
    expect(check.verbal).toBe('unavailable-silenced')
    expect(dnd5eSpellComponentsAvailable(check)).toBe(false)
  })

  it('does not let a wizard use a holy symbol as an arcane focus', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: [],
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'holy-symbol',
          templateId: 'srd-5.1:item:holy-symbol',
          item: {
            id: 'srd-5.1:item:holy-symbol',
            name: '圣徽',
            category: 'adventuring-gear',
            icon: 'generic',
            description: '',
            rulesText: '',
            stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          acquiredAt: 1,
        }],
      },
    }, {
      verbal: false,
      somatic: true,
      material: true,
    }, 'wizard')
    expect(check.material).toBe('missing-focus-or-pouch')
    expect(dnd5eSpellComponentsAvailable(check)).toBe(false)
  })

  it('keeps legacy characters without an inventory compatible while exposing the untracked state', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: [],
    }, {
      verbal: false,
      somatic: true,
      material: true,
    }, 'wizard')
    expect(check.material).toBe('inventory-untracked')
    expect(dnd5eSpellComponentsAvailable(check)).toBe(true)
  })

  it('requires an arcane focus to be held instead of merely present in the backpack', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: [],
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'focus',
          templateId: 'srd-5.1:item:arcane-focus',
          item: {
            id: 'srd-5.1:item:arcane-focus', name: '奥术法器', category: 'adventuring-gear',
            icon: 'magic-wand', description: '', rulesText: '', stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          acquiredAt: 1,
        }],
      },
    }, {
      verbal: true,
      somatic: true,
      material: true,
    }, 'wizard')

    expect(check.material).toBe('missing-focus-or-pouch')
    expect(dnd5eSpellComponentsAvailable(check)).toBe(false)
  })

  it('allows a rapier and off-hand focus for a spell with material and somatic components', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: {
        mainWeapon: { id: 'dnd5e-rapier', name: '刺剑', slot: 'mainWeapon' },
        offHand: { id: 'dnd5e-arcane-focus', name: '奥术法器', slot: 'mainWeapon' },
      },
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'focus',
          templateId: 'srd-5.1:item:arcane-focus',
          item: {
            id: 'srd-5.1:item:arcane-focus', name: '奥术法器', category: 'adventuring-gear',
            icon: 'magic-wand', description: '', rulesText: '', stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          equippedSlot: 'offHand',
          acquiredAt: 1,
        }],
      },
    }, {
      verbal: true,
      somatic: true,
      material: true,
    }, 'wizard')

    expect(check).toMatchObject({ somatic: 'available', material: 'focus-or-pouch' })
    expect(dnd5eSpellComponentsAvailable(check)).toBe(true)
  })

  it('requires a free hand for a somatic spell without material components', () => {
    const occupied = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: {
        mainWeapon: { id: 'dnd5e-rapier', name: '刺剑', slot: 'mainWeapon' },
        offHand: { id: 'dnd5e-arcane-focus', name: '奥术法器', slot: 'mainWeapon' },
      },
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'focus',
          templateId: 'srd-5.1:item:arcane-focus',
          item: {
            id: 'srd-5.1:item:arcane-focus', name: '奥术法器', category: 'adventuring-gear',
            icon: 'magic-wand', description: '', rulesText: '', stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          equippedSlot: 'offHand',
          acquiredAt: 1,
        }],
      },
    }, {
      verbal: true,
      somatic: true,
      material: false,
    }, 'wizard')
    const rapierOnly = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: {
        mainWeapon: { id: 'dnd5e-rapier', name: '刺剑', slot: 'mainWeapon' },
      },
      dnd5eInventory: { schemaVersion: 3, entries: [] },
    }, {
      verbal: true,
      somatic: true,
      material: false,
    }, 'wizard')

    expect(occupied.somatic).toBe('unavailable-hands-occupied')
    expect(dnd5eSpellComponentsAvailable(occupied)).toBe(false)
    expect(rapierOnly.somatic).toBe('available')
    expect(dnd5eSpellComponentsAvailable(rapierOnly)).toBe(true)
  })

  it('lets a free off hand access a component pouch while the main hand holds a rapier', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: {
        mainWeapon: { id: 'dnd5e-rapier', name: '刺剑', slot: 'mainWeapon' },
      },
      dnd5eInventory: {
        schemaVersion: 3,
        entries: [{
          instanceId: 'pouch',
          templateId: 'srd-5.1:item:component-pouch',
          item: {
            id: 'srd-5.1:item:component-pouch', name: '材料包', category: 'container',
            icon: 'generic', description: '', rulesText: '', stackable: false,
            source: { book: 'SRD 5.1', license: 'CC BY 4.0' },
          },
          quantity: 1,
          acquiredAt: 1,
        }],
      },
    }, {
      verbal: true,
      somatic: true,
      material: true,
    }, 'wizard')

    expect(check).toMatchObject({ somatic: 'available', material: 'focus-or-pouch' })
    expect(dnd5eSpellComponentsAvailable(check)).toBe(true)
  })

  it('uses only the DM-declared focus class on a held weapon', () => {
    const requirements = { verbal: true, somatic: true, material: true }
    const wizardFocusStaff = { ...DND5E_QUARTERSTAFF, spellcastingFocusClassIds: ['wizard'] }
    const unheldArcaneFocus = {
      instanceId: 'unheld-focus', templateId: 'srd-5.1:item:arcane-focus', quantity: 1, acquiredAt: 1,
      item: {
        id: 'srd-5.1:item:arcane-focus', name: '奥术法器', category: 'adventuring-gear' as const,
        icon: 'magic-wand' as const, description: '', rulesText: '', stackable: false,
        source: { book: 'SRD 5.1' as const, license: 'CC BY 4.0' as const },
      },
    }
    const designatedStaff = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: { mainWeapon: wizardFocusStaff },
      dnd5eInventory: { schemaVersion: 3, entries: [] },
    }, requirements, 'wizard')
    const ordinaryStaff = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: { mainWeapon: DND5E_QUARTERSTAFF },
      dnd5eInventory: { schemaVersion: 3, entries: [unheldArcaneFocus] },
    }, requirements, 'wizard')
    const wrongClass = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: { mainWeapon: wizardFocusStaff },
      dnd5eInventory: { schemaVersion: 3, entries: [] },
    }, requirements, 'druid')

    expect(designatedStaff).toMatchObject({ somatic: 'available', material: 'focus-or-pouch' })
    expect(dnd5eSpellComponentsAvailable(designatedStaff)).toBe(true)
    expect(ordinaryStaff.material).toBe('missing-focus-or-pouch')
    expect(wrongClass.material).toBe('missing-focus-or-pouch')
  })

  it('uses an explicitly declared cleric focus shield as the material and somatic hand', () => {
    const check = dnd5eSpellComponentCheck({
      conditions: [],
      equipment: {
        mainWeapon: DND5E_MACE,
        offHand: { ...DND5E_SHIELD, spellcastingFocusClassIds: ['cleric'] },
      },
      dnd5eInventory: { schemaVersion: 3, entries: [] },
    }, {
      verbal: true,
      somatic: true,
      material: true,
    }, 'cleric')

    expect(check).toMatchObject({ somatic: 'available', material: 'focus-or-pouch' })
    expect(dnd5eSpellComponentsAvailable(check)).toBe(true)
  })

  it('uses an actually equipped arcane focus for ordinary material components but not costly or consumed ones', () => {
    const wizard = normalizeCharacter({
      id: 'focus-integration',
      name: '法器测试法师',
      player: 'tester',
      charClass: '法师',
      maxHp: 8,
      currentHp: 8,
      equipment: {},
      dnd5eInventory: { schemaVersion: 3, entries: [] },
    })
    const granted = applyDnd5eInventoryMutation([wizard], {
      type: 'grant',
      characterId: wizard.id,
      templateId: 'srd-5.1:item:arcane-focus',
      quantity: 1,
    })
    const focus = normalizeDnd5eInventory(granted.characters[0]).entries.find(
      (entry) => entry.templateId === 'srd-5.1:item:arcane-focus',
    )!
    const equipped = applyDnd5eInventoryMutation(granted.characters, {
      type: 'equip',
      characterId: wizard.id,
      instanceId: focus.instanceId,
      slot: 'offHand',
    })
    expect(equipped.ok).toBe(true)
    expect(equipped.characters[0].equipment?.offHand).toMatchObject({
      spellcastingFocusClassIds: ['wizard', 'sorcerer', 'warlock'],
    })

    const ordinary = dnd5eSpellComponentCheck(equipped.characters[0], {
      verbal: true,
      somatic: true,
      material: true,
    }, 'wizard')
    const costly = dnd5eSpellComponentCheck(equipped.characters[0], {
      verbal: true,
      somatic: true,
      material: true,
      costlyMaterial: true,
    }, 'wizard')
    const consumed = dnd5eSpellComponentCheck(equipped.characters[0], {
      verbal: true,
      somatic: true,
      material: true,
      consumedMaterial: true,
    }, 'wizard')

    expect(ordinary).toMatchObject({ somatic: 'available', material: 'focus-or-pouch' })
    expect(dnd5eSpellComponentsAvailable(ordinary)).toBe(true)
    expect(costly.material).toBe('unsupported-costly-material')
    expect(consumed.material).toBe('unsupported-costly-material')
    expect(dnd5eSpellComponentsAvailable(costly)).toBe(false)
    expect(dnd5eSpellComponentsAvailable(consumed)).toBe(false)
  })
})
