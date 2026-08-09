import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CampaignJournalEntry } from '../lib/roomCommunications'
import { CampaignJournalPanel } from './CommunicationsPage'

const entries: CampaignJournalEntry[] = [
  {
    id: 'entry-1',
    title: '第一幕·迷雾中的来客',
    body: '冒险者穿过迷雾，抵达了一座陌生村庄。',
    source: 'dm',
    authorMemberId: 'dm',
    authorName: '守密人',
    createdAt: new Date('2026-01-01T12:00:00Z').getTime(),
    updatedAt: new Date('2026-01-01T12:00:00Z').getTime(),
  },
  {
    id: 'entry-2',
    title: '古堡大厅 · 战斗纪要',
    body: '队伍在第三回合击败了守卫，并找到通往地下室的钥匙。',
    source: 'combat-summary',
    combatId: 'combat-1',
    authorMemberId: 'dm',
    authorName: '守密人',
    createdAt: new Date('2026-01-02T12:00:00Z').getTime(),
    updatedAt: new Date('2026-01-02T12:00:00Z').getTime(),
  },
]

describe('CampaignJournalPanel', () => {
  it('renders a DiceHub-inspired campaign chapter timeline in the local dark theme', () => {
    const html = renderToStaticMarkup(createElement(CampaignJournalPanel, {
      isDm: true,
      entries,
      sessions: [],
      maps: [],
      busy: false,
      onMutate: async () => undefined,
    }))

    expect(html).toContain('战报篇章')
    expect(html).toContain('撰写新篇章')
    expect(html).toContain('搜索战报标题、正文或记录者')
    expect(html).toContain('全部章节')
    expect(html).toContain('筛选日期')
    expect(html).toContain('最新优先')
    expect(html).toContain('剧情时间轴')
    expect(html).toContain('章节目录')
    expect(html).toContain('VOL')
    expect(html).toContain('02')
    expect(html).toContain('古堡大厅 · 战斗纪要')
    expect(html).toContain('战斗纪要')
    expect(html).toContain('删除篇章：古堡大厅 · 战斗纪要')
    expect(html).not.toContain('保存篇章')
  })

  it('hides DM-only authoring and deletion controls from players', () => {
    const html = renderToStaticMarkup(createElement(CampaignJournalPanel, {
      isDm: false,
      entries,
      sessions: [],
      maps: [],
      busy: false,
      onMutate: async () => undefined,
    }))

    expect(html).not.toContain('撰写新篇章')
    expect(html).not.toContain('删除篇章：')
    expect(html).toContain('第一幕')
  })
})
