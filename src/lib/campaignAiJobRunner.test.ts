import { describe, expect, it } from 'vitest'
import type { PublicAiJobV2 } from './aiJobApi'
import { canAutoResumeCampaignPdfAnalysisJob } from './campaignAiJobRunner'

function job(overrides: Partial<PublicAiJobV2> = {}): PublicAiJobV2 {
  return {
    taskKind: 'campaign-analysis',
    executionMode: 'local-runner',
    status: 'running',
    lease: { runnerId: 'browser-current', acquiredAt: 100, expiresAt: 10_000 },
    ...overrides,
  } as PublicAiJobV2
}

describe('campaign AI job refresh recovery', () => {
  it('同一浏览器刷新后可以立即接回仍有效的自有租约', () => {
    expect(canAutoResumeCampaignPdfAnalysisJob(job(), 'browser-current', 1_000)).toBe(true)
  })

  it('只允许接管已过期的其他执行器租约', () => {
    expect(canAutoResumeCampaignPdfAnalysisJob(job(), 'browser-other', 1_000)).toBe(false)
    expect(canAutoResumeCampaignPdfAnalysisJob(job(), 'browser-other', 10_001)).toBe(true)
  })

  it('不会自动重跑失败任务或非 PDF 战役分析任务', () => {
    expect(canAutoResumeCampaignPdfAnalysisJob(job({ status: 'failed' }), 'browser-current', 1_000)).toBe(false)
    expect(canAutoResumeCampaignPdfAnalysisJob(job({ taskKind: 'map-analysis' }), 'browser-current', 1_000)).toBe(false)
  })
})
