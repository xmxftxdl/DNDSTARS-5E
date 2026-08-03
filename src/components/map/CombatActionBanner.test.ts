import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import CombatActionBanner from './CombatActionBanner'

describe('CombatActionBanner', () => {
  it('renders a private turn announcement without spell copy', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'turn',
      classId: 'wizard',
    }))
    expect(html).toContain('data-combat-banner="turn"')
    expect(html).toContain('你的回合')
    expect(html).not.toContain('combat-action-banner__turn-sigil')
    expect(html).not.toContain('施放法术')
    expect(html).not.toContain('准备行动')
    expect(html).toContain('kill-streak-banner__tail--left')
    expect(html).toContain('data-ribbon-layer="rear"')
    expect(html).toContain('transform="translate(0 7)"')
    expect(html).toContain('data-combat-class-backdrop="wizard"')
    expect(html).toContain('data-backdrop-detail="arcane-circle"')
    expect(html).toContain('data-combat-mini-sigil="left"')
    expect(html).toContain('data-combat-mini-sigil="right"')
    expect(html).not.toContain('data-combat-mini-sigil="left-inner"')
    expect(html).not.toContain('data-combat-mini-sigil="right-inner"')
    expect(html).toContain('--streak-class:#3B82F6')
  })

  it('renders the shared spell identity, caster, and class-styled icon', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'spell',
      classId: 'wizard',
      casterName: '星辉法师',
      spellId: 'fireball',
      spellName: '火球术',
    }))
    expect(html).toContain('data-combat-banner="spell"')
    expect(html).toContain('火球术')
    expect(html).not.toContain('以太正在汇聚')
    expect(html).toContain('data-class-backdrop="wizard"')
    expect(html).toContain('data-icon-motif="fire"')
    expect(html).toContain('kill-streak-banner__gold-line--top')
  })

  it('renders two gently animated notes on each side for bard banners', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'spell',
      classId: 'bard',
      spellId: 'shatter',
      spellName: '粉碎音波',
    }))
    expect(html).toContain('data-combat-class-backdrop="bard"')
    expect(html.match(/combat-banner-class-backdrop__bard-note--left-/g)).toHaveLength(2)
    expect(html.match(/combat-banner-class-backdrop__bard-note--right-/g)).toHaveLength(2)
    expect(html.match(/🎵/g)).toHaveLength(2)
    expect(html.match(/♪/g)).toHaveLength(2)
    expect(html).toContain('combat-banner-class-backdrop__main--bard')
  })

  it('怪物横幅使用与敌方回合流光一致的暗血红配色，并区别于野蛮人', () => {
    const monster = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'monster',
      attackName: '撕咬',
      attackKind: 'melee',
    }))
    const barbarian = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'barbarian',
      attackName: '巨斧',
      attackKind: 'melee',
    }))

    expect(monster).toContain('--combat-banner-color:#7F1D1D')
    expect(monster).toContain('--combat-banner-deep:#170506')
    expect(monster).toContain('--combat-banner-glow:#EF4444')
    expect(monster).toContain('data-icon-motif="monster-attack"')
    expect(monster).toContain('data-icon-detail="monster-claw-attack"')
    expect(monster).not.toContain('--combat-banner-color:#E5484D')
    expect(barbarian).toContain('--combat-banner-color:#E5484D')
    expect(barbarian).toContain('--combat-banner-glow:#FF6B6B')
  })

  it('renders the Thunderwave spell banner with its dedicated artwork', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'spell',
      classId: 'bard',
      spellId: 'thunderwave',
      spellName: 'Thunderwave',
    }))
    expect(html).toContain('data-combat-banner="spell"')
    expect(html).toContain('Thunderwave')
    expect(html).toContain('href="/assets/icons/thunderwave-spell-action.png"')
  })

  it('keeps action and kill-streak banners above the combat toolbar stacking layer', () => {
    const mapsPageSource = readFileSync(new URL('../../pages/MapsPage.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-0 top-[3%] z-[130] flex justify-center px-4',
    )
    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-0 top-5 z-[130] flex justify-center',
    )
    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-2 top-2 z-[80] flex flex-col items-center gap-2',
    )
    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-2',
    )
    expect(css).toMatch(/\.kill-streak-presentation\s*{[^}]*z-index:\s*130;/s)
  })
})
