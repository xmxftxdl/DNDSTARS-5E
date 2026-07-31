import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import CombatLogEntryCard from './CombatLogEntryCard'

const wizard = {
  id: 'wizard-character',
  name: '法师',
  avatar: '🧙',
  charClass: 'wizard',
  dnd5eClassLevels: { wizard: 5 },
} as Character

const wizardToken = {
  id: 'wizard-token',
  label: '新冒险者',
  type: 'player',
  characterId: wizard.id,
  x: 0,
  y: 0,
  color: '#94a3b8',
  emoji: '',
  size: 1,
} as Token

const entry: CombatLogEntry = {
  id: 23,
  round: 1,
  text: '新冒险者施放魔法飞弹。',
  kind: 'attack',
  time: '10:21',
  actorTokenId: wizardToken.id,
}

describe('CombatLogEntryCard identity border', () => {
  it('keeps the resolved class color and opts into the perimeter-flow class', () => {
    const html = renderToStaticMarkup(createElement(CombatLogEntryCard, {
      entry,
      tokens: [wizardToken],
      characters: [wizard],
    }))

    expect(html).toContain('combat-log-entry-card')
    expect(html).toContain('--combat-log-subject-color:#60A5FA')
    expect(html).toContain('border-color:#60A5FA')
  })

  it('defines an animated edge-only highlight with a reduced-motion fallback', () => {
    const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8')
      .replace(/\r\n?/g, '\n')
    const flowRuleStart = css.indexOf('.combat-log-entry-card::before')
    const reducedMotionStart = css.indexOf(
      '@media (prefers-reduced-motion: reduce)',
      flowRuleStart,
    )
    const reducedMotionEnd = css.indexOf('@keyframes combat-banner-open', reducedMotionStart)
    const flowRules = css.slice(flowRuleStart, reducedMotionEnd)

    expect(flowRuleStart).toBeGreaterThan(-1)
    expect(flowRules).toContain('mask-composite: exclude')
    expect(flowRules).toContain('animation: combat-log-border-flow 5.5s linear infinite')
    expect(flowRules).toContain('.combat-log-entry-card::before {\n    animation: none')
  })
})
