import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { dnd5eItemActionIcon, dnd5eSpellActionIcon, dnd5eSystemActionIcon } from '../../lib/dnd5eActionIcons'
import {
  DND5E_CLASS_BORDER_BLUR_STD_DEVIATION,
  DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY,
  DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH,
  DND5E_CLASS_BORDER_FLOW_DURATION,
  DND5E_CLASS_BORDER_FLOW_PERIOD_MS,
  DND5E_CLASS_BORDER_GRADIENT_STOPS,
  DND5E_CLASS_BORDER_TOP_STROKE_WIDTH,
  dnd5eClassBorderFlowBegin,
  dnd5eClassBorderGradientStopColor,
} from '../../lib/dnd5eClassBorderVisual'
import Dnd5eActionIcon from './Dnd5eActionIcon'
import { dnd5eActionIconBackdropImage } from './dnd5eActionIconBackdropImage'

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
    expect(html).toContain('data-class-border-flow="wizard"')
    expect(html).toContain('dnd5e-class-border-flow__paint')
    expect(html).not.toContain('attributeName="gradientTransform"')
    expect(html).not.toContain('<animateTransform')
    expect(html).not.toContain('attributeName="stroke-dashoffset"')
    expect(html).toContain('animation-duration:14s')
    expect(html).toMatch(/animation-delay:(?:0|-(?:[0-9]|1[0-3])(?:\.[0-9]{1,3})?)s/)
    expect(html).toContain('data-border-detail="arcane-gems" fill="#DBEAFE"')
    expect(html.match(/<rect class="dnd5e-class-border-line"[^>]+>/)?.[0])
      .not.toContain('stroke-dasharray')
  })

  it('uses the shared single-line class border visual parameters', () => {
    expect(DND5E_CLASS_BORDER_GRADIENT_STOPS).toEqual([
      { offset: '0', color: 'accent', opacity: '.7' },
      { offset: '.2', color: 'accent', opacity: '.74' },
      { offset: '.38', color: 'glow', opacity: '.86' },
      { offset: '.5', color: 'white' },
      { offset: '.62', color: 'glow', opacity: '.86' },
      { offset: '.8', color: 'accent', opacity: '.74' },
      { offset: '1', color: 'accent', opacity: '.7' },
    ])
    expect(DND5E_CLASS_BORDER_FLOW_DURATION).toBe('14s')
    expect(DND5E_CLASS_BORDER_FLOW_PERIOD_MS).toBe(14_000)
    expect(DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH).toBe(4.8)
    expect(DND5E_CLASS_BORDER_TOP_STROKE_WIDTH).toBe(3.1)
    expect(DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY).toBe(0.82)
    expect(DND5E_CLASS_BORDER_BLUR_STD_DEVIATION).toBe(0.8)

    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSpellActionIcon({ id: 'message', name: '传讯术', castingClassId: 'wizard' }),
    }))
    const deepLine = html.match(/<rect x="2\.75"[^>]+>/)?.[0] ?? ''
    const topLine = html.match(/<rect class="dnd5e-class-border-line"[^>]+>/)?.[0] ?? ''
    const borderGlow = html.match(/<filter id="[^"]+-border-glow"[^>]*>.*?<\/filter>/)?.[0] ?? ''

    expect(deepLine).toContain(`stroke-opacity="${DND5E_CLASS_BORDER_DEEP_STROKE_OPACITY}"`)
    expect(deepLine).toContain(`stroke-width="${DND5E_CLASS_BORDER_DEEP_STROKE_WIDTH}"`)
    expect(topLine).toContain(`stroke-width="${DND5E_CLASS_BORDER_TOP_STROKE_WIDTH}"`)
    expect(borderGlow).toContain(`stdDeviation="${DND5E_CLASS_BORDER_BLUR_STD_DEVIATION}"`)
    expect(html).toContain(`animation-duration:${DND5E_CLASS_BORDER_FLOW_DURATION}`)
    expect(html).toContain('--dnd5e-class-border-accent:#DBEAFE')
    expect(html).toContain('--dnd5e-class-border-glow:#60A5FA')
    expect(html).not.toContain('attributeName="gradientTransform"')
    expect(html).not.toContain('dnd5e-class-border-flow-line')
  })

  it('keeps the shared flow phase continuous and makes loop boundaries equivalent', () => {
    expect(dnd5eClassBorderFlowBegin(0)).toBe('0s')
    expect(dnd5eClassBorderFlowBegin(DND5E_CLASS_BORDER_FLOW_PERIOD_MS)).toBe('0s')
    expect(dnd5eClassBorderFlowBegin(DND5E_CLASS_BORDER_FLOW_PERIOD_MS * 3)).toBe('0s')
    expect(dnd5eClassBorderFlowBegin(1_250)).toBe('-1.25s')
    expect(dnd5eClassBorderFlowBegin(15_250)).toBe('-1.25s')
    expect(dnd5eClassBorderFlowBegin(-1)).toBe('-13.999s')
    expect(dnd5eClassBorderFlowBegin(Number.NaN)).toBe('0s')

    const palette = {
      background: '#3B82F6',
      backgroundDeep: '#071A38',
      accent: '#DBEAFE',
      glow: '#60A5FA',
    }
    expect(DND5E_CLASS_BORDER_GRADIENT_STOPS.map((stop) => (
      dnd5eClassBorderGradientStopColor(palette, stop)
    ))).toEqual([
      '#DBEAFE',
      '#DBEAFE',
      '#60A5FA',
      '#ffffff',
      '#60A5FA',
      '#DBEAFE',
      '#DBEAFE',
    ])
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

  it('renders bard music-note interiors in a pale white', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eSpellActionIcon({ id: 'message', name: '传讯术', castingClassId: 'bard' }),
    }))
    expect(html).toContain('data-backdrop-detail="resonant-song-filled-notes"')
    expect(html).toContain('fill="#FFF7FF"')
    expect(html).toContain('opacity=".9"')
  })

  it('reuses the existing class backdrop when rasterizing a status-token background', () => {
    const image = dnd5eActionIconBackdropImage({
      classId: 'bard',
      background: '#D946EF',
      backgroundDeep: '#26072C',
      accent: '#F9D5FF',
      glow: '#E879F9',
    })
    const svg = decodeURIComponent(image.slice(image.indexOf(',') + 1))
    expect(svg).toContain('data-class-backdrop="bard"')
    expect(svg).toContain('data-backdrop-detail="resonant-song"')
    expect(svg).toContain('data-backdrop-detail="resonant-song-filled-notes"')
    expect(svg).toContain('stop-color="#D946EF"')
    expect(svg).toContain('stop-color="#26072C"')
  })

  it('renders magic items with a subtle gradient and a simple rarity-colored border', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eActionIcon, {
      spec: dnd5eItemActionIcon({
        id: 'srd-5.1:magic-item:amulet-of-health',
        name: '健康护符',
        englishName: 'Amulet of Health',
        category: 'magic-item',
        icon: 'magic-wondrous',
        magicItem: { kind: 'wondrous-item', rarity: 'rare', attunement: 'required', automation: 'headless' },
      }),
    }))
    expect(html).toContain('data-rarity-border="rare"')
    expect(html).toContain('data-rarity-background="subtle-gradient"')
    expect(html).toContain('stop-opacity=".3"')
    expect(html).toContain('stroke="#60A5FA"')
    expect(html).not.toContain('data-rarity-detail=')
    expect(html).toContain('data-icon-detail="painted-amulet-of-health"')
  })
})
