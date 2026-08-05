import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  archiveCombatStatisticsLog,
  createCombatStatisticsSession,
} from '../lib/combatStatistics'
import { CampaignCombatLogArchiveView } from './CampaignCombatLogArchivePanel'

describe('CampaignCombatLogArchivePanel', () => {
  it('shows completed combats on the campaign overview with single and bulk export actions', () => {
    const session = archiveCombatStatisticsLog(createCombatStatisticsSession({
      combatId: 'combat-1',
      mapId: 'map-1',
      now: 1_000,
    }), {
      combatId: 'combat-1',
      mapId: 'map-1',
      mapName: '幽暗洞窟',
      endedAt: 2_000,
      lastRound: 3,
      entries: [{ id: 1, round: 1, text: '战斗开始', kind: 'system', time: '10:00' }],
    })
    const html = renderToStaticMarkup(createElement(CampaignCombatLogArchiveView, {
      sessions: [session],
      hydrated: true,
      maps: [],
      onDelete: async () => true,
    }))
    expect(html).toContain('历史战斗记录')
    expect(html).toContain('幽暗洞窟')
    expect(html).toContain('3 回合')
    expect(html).toContain('1 条记录')
    expect(html).toContain('导出 TXT')
    expect(html).toContain('导出全部')
    expect(html).toContain('删除')
    expect(html).toContain('删除 幽暗洞窟 的战斗 LOG')
  })

  it('explains that logs are archived automatically after a battle ends', () => {
    const html = renderToStaticMarkup(createElement(CampaignCombatLogArchiveView, {
      sessions: [],
      hydrated: true,
      maps: [],
    }))
    expect(html).toContain('还没有已归档的战斗记录')
    expect(html).toContain('战斗结束后')
  })
})
