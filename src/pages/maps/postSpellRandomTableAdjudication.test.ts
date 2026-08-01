import { describe, expect, it } from 'vitest'
import { buildPostSpellRandomTableAdjudicationPresentation } from './postSpellRandomTableAdjudication'

describe('post-spell random-table adjudication presentation', () => {
  it('projects the display name supplied by the active room extension', () => {
    expect(buildPostSpellRandomTableAdjudicationPresentation({
      actorName: '测试角色',
      featureName: ' 本地随机效果 ',
      tableRoll: 50,
    })).toEqual({
      featureLabel: '本地随机效果',
      resultLabel: '本地随机效果 · 结果 50',
      logMessage: '测试角色 的本地随机效果掷出 50；当前结果未接入 Headless，战斗结算已暂停，等待 DM 裁定。',
    })
  })

  it('uses a generic label when the extension is unavailable', () => {
    expect(buildPostSpellRandomTableAdjudicationPresentation({
      actorName: '测试角色',
      tableRoll: 12,
    }).resultLabel).toBe('施法后随机表 · 结果 12')
  })
})
