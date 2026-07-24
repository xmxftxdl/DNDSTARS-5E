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
    expect(html).toContain('href="/assets/icons/fireball-spell-action.png"')
    expect(html).toContain('ring-amber-300')
    expect(html).toContain('>3</span>')
    expect(html).toContain('>2</span>')
  })

  it('uses the painted movement asset for the basic move action', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSystemActionIcon('move', 'move'),
    }))
    expect(html).toContain('data-icon-motif="move"')
    expect(html).toContain('data-icon-detail="painted-move"')
    expect(html).toContain('href="/assets/icons/move-action.png"')
    expect(html).toContain('width="88"')
    expect(html).not.toContain('painted-clarity')
  })

  it('uses the painted melee attack asset for the basic weapon attack', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSystemActionIcon('weapon-attack', 'melee-attack'),
    }))
    expect(html).toContain('data-icon-motif="melee-attack"')
    expect(html).toContain('data-icon-detail="painted-melee-attack"')
    expect(html).toContain('href="/assets/icons/melee-attack-action.png"')
  })

  it('uses a separate painted sprint asset for Dash', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSystemActionIcon('dash', 'dash'),
    }))
    expect(html).toContain('data-icon-motif="dash"')
    expect(html).toContain('data-icon-detail="painted-dash"')
    expect(html).toContain('href="/assets/icons/dash-action.png"')
  })

  it('uses a separate painted blade-and-escape asset for Disengage', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSystemActionIcon('disengage', 'disengage'),
    }))
    expect(html).toContain('data-icon-motif="disengage"')
    expect(html).toContain('data-icon-detail="painted-disengage"')
    expect(html).toContain('href="/assets/icons/disengage-action.png"')
  })

  it('uses a separate painted attack-miss asset for Dodge', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSystemActionIcon('dodge', 'dodge'),
    }))
    expect(html).toContain('data-icon-motif="dodge"')
    expect(html).toContain('data-icon-detail="painted-dodge"')
    expect(html).toContain('href="/assets/icons/dodge-action.png"')
  })

  it('renders Message artwork above its casting-class background', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSpellActionIcon({ id: 'message', name: '传讯术', castingClassId: 'wizard' }),
    }))
    expect(html).toContain('data-icon-detail="painted-message"')
    expect(html).toContain('href="/assets/icons/message-spell-action.png"')
    expect(html).toContain('stop-color="#3B82F6"')
    expect(html).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(html).toContain('data-class-backdrop="wizard"')
    expect(html).toContain('data-backdrop-detail="arcane-circle"')
    expect(html).toContain('data-class-border="wizard"')
    expect(html).toContain('data-border-detail="arcane-gems"')
    expect(html).toContain('dnd5e-class-border-line')
    expect(html).toContain('attributeName="gradientTransform"')
    expect(html).toContain('type="rotate"')
    expect(html).toContain('dur="8s"')
    expect(html.match(/<stop[^>]+stop-color="#ffffff"/g)).toHaveLength(1)
    expect(html.match(/<rect class="dnd5e-class-border-line"[^>]+>/)?.[0])
      .not.toContain('stroke-dasharray')
  })

  it('gives every class a distinct semantic Message backdrop', () => {
    const expected = {
      barbarian: 'cracked-rage',
      bard: 'resonant-song',
      cleric: 'divine-halo',
      druid: 'living-leaves',
      fighter: 'tempered-steel',
      monk: 'flowing-chi',
      paladin: 'oath-shield',
      ranger: 'forest-trail',
      rogue: 'cut-shadow',
      sorcerer: 'draconic-bloodline',
      warlock: 'eldritch-eye',
      wizard: 'arcane-circle',
    }
    for (const [castingClassId, detail] of Object.entries(expected)) {
      const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
        spec: dnd5eSpellActionIcon({ id: 'message', name: '传讯术', castingClassId }),
      }))
      expect(html).toContain(`data-class-backdrop="${castingClassId}"`)
      expect(html).toContain(`data-backdrop-detail="${detail}"`)
    }
  })
})
