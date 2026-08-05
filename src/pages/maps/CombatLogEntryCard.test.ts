import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
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

const monsterToken = {
  id: 'monster-token',
  label: '怪物',
  type: 'enemy',
  poolId: 'srd-5.1:goblin',
  x: 0,
  y: 0,
  color: '#ef4444',
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
  it('reuses the initiative portrait flow with the resolved class color', () => {
    const html = renderToStaticMarkup(createElement(CombatLogEntryCard, {
      entry,
      tokens: [wizardToken],
      characters: [wizard],
    }))

    expect(html).toContain('initiative-active-ring')
    expect(html).toContain('combat-log-flow-only')
    expect(html).toContain('--initiative-turn-color:#3B82F6')
  })

  it('keeps the actor portrait when the log names a spell', () => {
    const html = renderToStaticMarkup(createElement(CombatLogEntryCard, {
      entry: { ...entry, text: 'Wizard casts Fireball.' },
      tokens: [wizardToken],
      characters: [wizard],
    }))

    expect(html).toContain('data-testid="combat-log-subject-token"')
    expect(html).toContain('data-subject-token-id="wizard-token"')
    expect(html).not.toContain('data-testid="combat-log-spell-token"')
    expect(html).not.toContain('/assets/icons/fireball-spell-action.png')
  })

  it('does not render a monster Token on a new-round boundary row', () => {
    const html = renderToStaticMarkup(createElement(CombatLogEntryCard, {
      entry: {
        ...entry,
        round: 2,
        text: '进入第 2 回合',
        kind: 'turn',
        actorTokenId: monsterToken.id,
      },
      tokens: [monsterToken, wizardToken],
      characters: [wizard],
      currentTurnTokenId: monsterToken.id,
    }))

    expect(html).toContain('进入第 2 回合')
    expect(html).not.toContain('data-testid="combat-log-subject-token"')
    expect(html).not.toContain('data-subject-token-id="monster-token"')
  })

  it('does not expose timeline rollback actions in the combat log', () => {
    const html = renderToStaticMarkup(createElement(CombatLogEntryCard, {
      entry,
      tokens: [wizardToken],
      characters: [wizard],
    }))

    expect(html).not.toContain('combat-log-rollback-23')
    expect(html).not.toContain('撤销至此')
  })
})
