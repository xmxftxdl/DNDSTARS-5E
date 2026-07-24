import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  KILL_STREAK_BANNER_DURATION_MS,
  KILL_STREAK_EFFECT_DURATION_MS,
} from '../../lib/combatPresentation'
import KillStreakPresentation from './KillStreakPresentation'

const base = {
  id: 'streak-1',
  actorName: '星辉法师',
  classId: 'wizard',
  killCount: 3 as const,
  createdAt: 1_000,
  bannerStartsAt: 1_650,
  expiresAt: 5_800,
}

describe('KillStreakPresentation', () => {
  it('renders the arcane explosion and wide folded banner', () => {
    const html = renderToStaticMarkup(createElement(KillStreakPresentation, {
      presentation: { ...base, style: 'arcane' },
    }))
    expect(html).toContain('data-kill-streak="arcane"')
    expect(html).toContain('kill-streak-fireball__core')
    expect(html).toContain('kill-streak-fireball__blast')
    expect(html).toContain('kill-streak-fireball__flash')
    expect(html).toContain('kill-streak-fireball__ember')
    expect(html).toContain('kill-streak-fireball__spark')
    expect(html).toContain(`--kill-streak-effect-duration:${KILL_STREAK_EFFECT_DURATION_MS}ms`)
    expect(html).toContain(`--kill-streak-banner-duration:${KILL_STREAK_BANNER_DURATION_MS}ms`)
    expect(html).toContain('kill-streak-banner__tail--left')
    expect(html).toContain('data-combat-class-backdrop="wizard"')
    expect(html).toContain('data-backdrop-detail="arcane-circle"')
    expect(html).toContain('癫狂杀戮')
    expect(html).toContain('星辉法师')
    expect(html).toContain('--streak-class:#3B82F6')
    expect(html).toContain('kill-streak-banner__title')
    expect(html).toContain('data-stamp-text="癫狂杀戮"')
  })

  it('renders the same fireball explosion for martial classes', () => {
    const html = renderToStaticMarkup(createElement(KillStreakPresentation, {
      presentation: { ...base, actorName: '铁卫', classId: 'fighter', style: 'martial' },
    }))
    expect(html).toContain('data-kill-streak="martial"')
    expect(html).toContain('kill-streak-fireball__core')
    expect(html).toContain('kill-streak-fireball__blast')
    expect(html).not.toContain('kill-streak-sword')
  })
})
