import { describe, expect, it } from 'vitest'
import {
  dnd5eCoreSpellComponentRequirements,
  dnd5eSpellComponentCheck,
  dnd5eSpellComponentsAvailable,
} from './spellComponents'

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
})
