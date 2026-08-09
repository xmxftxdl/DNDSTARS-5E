import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Character } from '../../types/character'
import ClassResourceSummary from './ClassResourceSummary'
import Dnd5eClassProgressionPanel from './Dnd5eClassProgressionPanel'
import Dnd5eSpellSlotRecoverySummary from './Dnd5eSpellSlotRecoverySummary'

function character(patch: Partial<Character> = {}): Character {
  return {
    id: 'hero', name: '英雄', player: 'P1', avatar: '', accent: '', race: '人类', charClass: '法师', level: 13,
    background: '', experience: 0, reputation: 0, rulesetId: 'dnd5e-2014-srd-5.1',
    abilities: { str: 10, dex: 14, con: 14, int: 18, wis: 12, cha: 10 }, savingThrows: [], skills: [],
    maxHp: 60, currentHp: 60, tempHp: 0, hitDice: '13d6', ac: 12, speed: 30, initiativeBonus: 2,
    saveDC: 17, passivePerception: 11, inspiration: 0,
    conditions: [], notes: '', dmNotes: '', visibleToPlayers: true,
    classResources: {
      'dnd5e-arcane-recovery': { current: 1, max: 1 },
      'dnd5e-spell-slot-1': { current: 4, max: 4 },
      'dnd5e-spell-slot-2': { current: 2, max: 3 },
      'dnd5e-spell-slot-3': { current: 3, max: 3 },
      'dnd5e-spell-slot-4': { current: 2, max: 3 },
      'dnd5e-spell-slot-5': { current: 1, max: 2 },
    },
    ...patch,
  }
}

describe('职业资源详细说明', () => {
  it('将奥术回想显示为由 DM 短休结算触发的只读规则摘要', () => {
    const wizard = character()
    const summary = renderToStaticMarkup(createElement(Dnd5eSpellSlotRecoverySummary, { character: wizard }))

    expect(summary).toContain('奥术回想')
    expect(summary).not.toContain('每日上限')
    expect(summary).not.toContain('完成长休后恢复')
    expect(summary).toContain('只能在 DM 完成短休后的结算窗口使用')
    expect(summary).toContain('总环级不超过 7 环')
    expect(summary).toContain('2环×1')
    expect(summary).toContain('4环×1')
    expect(summary).not.toContain('<select')
    expect(summary).not.toContain('确认恢复法术位')

    const page = renderToStaticMarkup(createElement(Dnd5eClassProgressionPanel, {
      character: wizard,
      onChange: () => undefined,
    }))
    expect(page).toContain('只能在 DM 完成短休后的结算窗口使用')
    expect(page).not.toContain('确认恢复法术位')
  })

  it('区分今日已使用的奥术回想', () => {
    const wizard = character({
      classResources: {
        ...character().classResources,
        'dnd5e-arcane-recovery': { current: 0, max: 1 },
      },
    })
    const markup = renderToStaticMarkup(createElement(Dnd5eSpellSlotRecoverySummary, { character: wizard }))
    expect(markup).toContain('今日已使用')
    expect(markup).toContain('0/1')
  })

  it('为战士显示资源用途和当前次数，不重复展示恢复上限文案', () => {
    const fighter = character({
      charClass: '战士',
      level: 17,
      hitDice: '17d10',
      classResources: {
        fighterSecondWind: { current: 1, max: 1 },
        fighterActionSurge: { current: 1, max: 2 },
        fighterIndomitable: { current: 2, max: 3 },
      },
    })
    const markup = renderToStaticMarkup(createElement(ClassResourceSummary, { character: fighter }))

    expect(markup).toContain('可消耗资源与恢复')
    expect(markup).toContain('回气')
    expect(markup).toContain('1d10＋战士等级')
    expect(markup).toContain('当前 1 / 2')
    expect(markup).toContain('同一回合也只能使用一次')
    expect(markup).toContain('当前 2 / 3')
    expect(markup).not.toContain('完成短休或长休后全部恢复')
    expect(markup).not.toContain('每日上限')
  })
})
