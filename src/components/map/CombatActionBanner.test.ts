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

  it('按标题长度提供自适应字号参数，长怪物动作保持单行', () => {
    const shortTitle = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'monster',
      attackName: '咆哮',
      attackKind: 'action',
    }))
    const stagedRoar = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'monster',
      attackName: '咆哮：第一次咆哮',
      attackKind: 'action',
    }))
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

    expect(shortTitle).toContain('data-banner-title-glyphs="2"')
    expect(stagedRoar).toContain('data-banner-title-glyphs="8"')
    expect(shortTitle).toContain('--combat-banner-title-fit:56px')
    expect(stagedRoar).toContain('--combat-banner-title-fit:53.75px')
    expect(css).toMatch(/\.combat-action-banner__copy\s*{[^}]*min-width:\s*170px;[^}]*max-width:\s*min\(470px,/s)
    expect(css).toMatch(/\.combat-action-banner--turn \.combat-action-banner__copy\s*{[^}]*text-align:\s*center;/s)
    expect(css).toMatch(/\.combat-action-banner__copy strong\s*{[^}]*var\(--combat-banner-title-fit[^}]*white-space:\s*nowrap;/s)
    expect(css).toMatch(/\.kill-streak-banner__center \.combat-action-banner__copy strong\s*{[^}]*var\(--combat-banner-title-fit[^}]*var\(--combat-banner-title-tracking/s)
  })

  it('战士横幅在主背景左右显示银灰色双剑纹章', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'fighter',
      attackName: '疾走',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-fighter-sword="left"')
    expect(html).toContain('data-combat-fighter-sword="right"')
    expect(html).not.toContain('data-banner-sword=')
  })

  it('狂战士横幅使用半露兽颅图腾和两侧双刃战斧', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'barbarian',
      attackName: '狂暴',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-barbarian-center="horned-skull"')
    expect(html).toContain('data-combat-barbarian-axe="left"')
    expect(html).toContain('data-combat-barbarian-axe="right"')
  })

  it('德鲁伊横幅在主背景左右显示树苗纹章', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'druid',
      attackName: '荒野形态',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-druid-sapling="left"')
    expect(html).toContain('data-combat-druid-sapling="right"')
  })

  it('术士横幅在主背景左右显示涌动的魔法浪', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'sorcerer',
      attackName: '超魔法',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-sorcerer-wave="left"')
    expect(html).toContain('data-combat-sorcerer-wave="right"')
  })

  it('邪术师横幅在主背景左右显示翻动的契约魔法书', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'warlock',
      attackName: '魔能爆',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-warlock-book="left"')
    expect(html).toContain('data-combat-warlock-book="right"')
  })

  it('游侠横幅显示猎人长弓与中央罗盘纹章', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'ranger',
      attackName: '猎人印记',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-ranger-bow="left"')
    expect(html).toContain('data-combat-ranger-bow="right"')
    expect(html).toContain('data-combat-ranger-center="hunter-compass"')
  })

  it('游荡者横幅使用中央警戒之眼和两侧开锁工具', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'rogue',
      attackName: '偷袭',
      attackKind: 'action',
    }))

    expect(html).toContain('data-combat-rogue-center="watchful-eye"')
    expect(html).toContain('data-combat-rogue-tool="left"')
    expect(html).toContain('data-combat-rogue-tool="right"')
    expect(html).not.toContain('data-combat-rogue-dagger=')
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

  it('keeps banners, transient controls, initiative, and player actions in a stable stacking order', () => {
    const mapsPageSource = readFileSync(new URL('../../pages/MapsWorkspacePage.tsx', import.meta.url), 'utf8')
    const playerHotbarSource = readFileSync(new URL('./PlayerMapSpellHotbar.tsx', import.meta.url), 'utf8')
    const wallOfFireSource = readFileSync(new URL('../../pages/maps/WallOfFireTargetingControls.tsx', import.meta.url), 'utf8')
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')

    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-0 top-[3%] z-[130] flex justify-center px-4',
    )
    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-0 top-5 z-[110] flex justify-center',
    )
    expect(mapsPageSource).toContain(
      'absolute left-1/2 top-14 z-[110] flex -translate-x-1/2 items-center gap-3',
    )
    expect(mapsPageSource).toMatch(
      /data-testid="dnd5e-spell-targeting-overlay"[\s\S]*?className="absolute left-1\/2 top-14 z-\[110\]/,
    )
    expect(wallOfFireSource).toContain(
      'data-testid="wall-of-fire-targeting-controls" className="absolute left-1/2 top-14 z-[110]',
    )
    expect(wallOfFireSource).toContain('current?.area && !current.areaTargetSelected')
    expect(wallOfFireSource).toContain('aria-label={`减小法术范围${control.label}`}')
    expect(wallOfFireSource).toContain('aria-label={`增大法术范围${control.label}`}')
    expect(mapsPageSource).toContain(
      'pointer-events-none absolute inset-x-2 top-2 z-[80] flex flex-col items-center gap-2',
    )
    expect(playerHotbarSource).toContain(
      'pointer-events-none absolute bottom-3 left-28 right-3 z-40 flex flex-col items-center',
    )
    expect(css).toMatch(/\.kill-streak-presentation\s*{[^}]*z-index:\s*130;/s)
  })
})
