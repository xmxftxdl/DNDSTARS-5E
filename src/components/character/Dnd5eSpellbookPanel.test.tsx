import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import Dnd5eSpellbookPanel from './Dnd5eSpellbookPanel'

const spellbookPanelSource = readFileSync(new URL('./Dnd5eSpellbookPanel.tsx', import.meta.url), 'utf8')
const dmRosterSource = readFileSync(new URL('./DMRoster.tsx', import.meta.url), 'utf8')

function highLevelWizard(): Character {
  return {
    rulesetId: 'dnd5e-2014-srd-5.1',
    id: 'spellbook-performance-wizard',
    name: '法术书性能测试法师',
    player: '测试玩家',
    avatar: '🧙',
    accent: 'from-violet-600 to-indigo-700',
    race: '人类',
    charClass: '法师',
    dnd5eClassLevels: { wizard: 20 },
    level: 20,
    background: '侍僧',
    experience: 0,
    reputation: 0,
    abilities: { str: 8, dex: 14, con: 14, int: 20, wis: 12, cha: 10 },
    savingThrows: ['int', 'wis'],
    skills: [],
    maxHp: 122,
    currentHp: 122,
    tempHp: 0,
    hitDice: '20d6',
    ac: 12,
    speed: 30,
    initiativeBonus: 2,
    saveDC: 19,
    passivePerception: 11,
    inspiration: 0,
    conditions: [],
    notes: '',
    dmNotes: '',
    visibleToPlayers: true,
  }
}

describe('Dnd5eSpellbookPanel performance boundaries', () => {
  it('renders only the first candidate page with compact non-animated icons', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eSpellbookPanel, {
      character: highLevelWizard(),
    }))

    expect((html.match(/data-spellbook-choice=/g) ?? []).length).toBe(24)
    expect(html).toContain('继续显示 24 个法术')
    expect(html).not.toContain('data-class-border-flow')
    expect(html).not.toContain('<feGaussianBlur')
  })

  it('marks the panel as DM-authoritative when the DM edits a player spellbook', () => {
    const html = renderToStaticMarkup(createElement(Dnd5eSpellbookPanel, {
      character: highLevelWizard(),
      isDM: true,
    }))

    expect(html).toContain('data-dm-spellbook-editor="true"')
    expect(html).toContain('DM 可直接调整玩家选择的戏法、已知／准备法术和法师法术书')
  })

  it('renders nested spell dialogs above the DM character inspector', () => {
    expect(dmRosterSource).toContain('fixed inset-0 z-[120]')
    expect(spellbookPanelSource).toContain('data-character-spell-detail-dialog className="fixed inset-0 z-[140]')
    expect(spellbookPanelSource).toContain('data-character-spell-icon-preview className="fixed inset-0 z-[150]')
  })
})
