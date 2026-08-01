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
    expect(html).toContain('--initiative-turn-color:#60A5FA')
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
})
