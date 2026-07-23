import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { dnd5eSpellActionIcon, dnd5eSystemActionIcon } from '../../lib/dnd5eActionIcons'
import Dnd5eActionIcon from './Dnd5eActionIcon'

describe('Dnd5eActionIcon', () => {
  it('渲染原创 SVG、环级和资源角标', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSpellActionIcon({ id: 'fireball', name: '火球术', level: 3, damageType: 'fire' }),
      level: 3,
      badge: 2,
      active: true,
    }))
    expect(html).toContain('<svg')
    expect(html).toContain('radialGradient')
    expect(html).toContain('ring-amber-300')
    expect(html).toContain('>3</span>')
    expect(html).toContain('>2</span>')
  })

  it('uses a distinct footsteps-and-path motif for the basic move action', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSystemActionIcon('move', 'move'),
    }))
    expect(html).toContain('data-icon-motif="move"')
    expect(html).toContain('stroke-dasharray="2 6"')
  })
})
