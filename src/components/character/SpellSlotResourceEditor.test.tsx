import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import SpellSlotResourceEditor from './SpellSlotResourceEditor'
import { editableSpellSlotResources } from './spellSlotResourceEditorModel'

describe('SpellSlotResourceEditor', () => {
  const wizard = normalizeCharacter({
    id: 'wizard',
    name: '法师',
    charClass: '法师',
    level: 5,
    dnd5eClassLevels: { wizard: 5 },
    classResources: {
      'dnd5e-spell-slot-1': { current: 2, max: 4 },
      'dnd5e-spell-slot-2': { current: 1, max: 3 },
      'dnd5e-arcane-recovery': { current: 1, max: 1 },
    },
  })

  it('only exposes current spell slots and preserves the rules-derived maximum', () => {
    const resources = editableSpellSlotResources(wizard)
    expect(resources.some((resource) => resource.key === 'dnd5e-arcane-recovery')).toBe(false)
    expect(resources.find((resource) => resource.key === 'dnd5e-spell-slot-1')).toMatchObject({
      current: 2,
      max: 4,
    })

    const html = renderToStaticMarkup(createElement(SpellSlotResourceEditor, { character: wizard }))
    expect(html).toContain('当前法术位')
    expect(html).toContain('1环法术位当前数量')
    expect(html).not.toContain('奥术回想当前数量')
  })
})
