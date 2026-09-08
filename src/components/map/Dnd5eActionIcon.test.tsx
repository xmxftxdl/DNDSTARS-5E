import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { dnd5eSpellActionIcon } from '../../lib/dnd5eActionIcons'
import Dnd5eActionIcon from './Dnd5eActionIcon'

describe('Dnd5eActionIcon presentation', () => {
  it('removes animated borders and SVG blur filters from compact list icons', () => {
    const spec = dnd5eSpellActionIcon({
      id: 'srd-5.1:spell:fireball',
      name: '火球术',
      englishName: 'Fireball',
      level: 3,
      school: '塑能',
      effect: 'damage',
      damageType: 'fire',
      castingClassId: 'wizard',
    })
    const full = renderToStaticMarkup(createElement(Dnd5eActionIcon, { spec }))
    const compact = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec,
      presentation: 'compact',
    }))

    expect(full).toContain('data-class-border-flow="wizard"')
    expect(full).toContain('<feGaussianBlur')
    expect(compact).not.toContain('data-class-border-flow')
    expect(compact).not.toContain('<feGaussianBlur')
    expect(compact).not.toContain('data-class-backdrop')
    expect(compact).toContain('data-class-border="wizard"')
  })
})
