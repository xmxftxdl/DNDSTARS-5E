import { describe, expect, it } from 'vitest'
import {
  AI_MODEL_POLICY,
  bridgeModelId,
  fixedBridgeModelIdForTask,
  reserveCredits,
  textCredits,
} from '../../shared/ai-model-policy.mjs'

describe('统一 AI 模型与积分策略', () => {
  it('仅 PDF 综合使用 Sol，其他文本任务统一使用 Luna', () => {
    expect(fixedBridgeModelIdForTask('pdf-extraction')).toBe('external:extraction:gpt-5.6-luna')
    expect(fixedBridgeModelIdForTask('campaign-analysis', 'pdf-synthesis')).toBe('external:synthesis:gpt-5.6-sol')
    expect(fixedBridgeModelIdForTask('resource-structuring')).toBe('external:gpt-5.6-luna')
    expect(fixedBridgeModelIdForTask('map-analysis')).toBe('external:gpt-5.6-luna')
    expect(bridgeModelId('general', AI_MODEL_POLICY.generalModelId)).toBe('external:gpt-5.6-luna')
  })

  it('按保守倍率估算，并把 1300 分预留到 1500 分', () => {
    expect(reserveCredits(1_300)).toBe(1_500)
    expect(textCredits({
      modelId: 'external:gpt-5.6-luna',
      inputTokens: 1_000_000,
      outputTokens: 0,
    })).toBe(1_250)
    expect(textCredits({
      modelId: 'external:gpt-5.6-luna',
      inputTokens: 1_000_000,
      outputTokens: 0,
      conservative: false,
    })).toBe(1_000)
  })
})
