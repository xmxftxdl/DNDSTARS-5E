import { describe, expect, it } from 'vitest'
import type { AiModelDescriptorV1, AiProviderSelectionV1 } from '../../shared/ai-provider.mjs'
import { selectResourceStructuringModelRouting } from './resourceStructuringModelRouting'

function model(
  id: string,
  displayName: string,
  providerId = 'external-account',
): AiModelDescriptorV1 {
  return {
    schemaVersion: 1,
    providerId,
    id,
    displayName,
    contextWindowTokens: 128_000,
    capabilities: ['text-generation', 'structured-output'],
    supportedTasks: ['resource-structuring'],
  }
}

const selection: AiProviderSelectionV1 = {
  schemaVersion: 1,
  providerId: 'external-account',
  modelId: 'external:synthesis:gpt-5.6-terra',
  allowPaidFallback: false,
  maxCreditsPerTask: 0,
}

describe('resource structuring model routing', () => {
  it('routes external resource extraction through Luna with Terra as the conditional fallback', () => {
    expect(selectResourceStructuringModelRouting([
      model('external:gpt-5.6-luna', 'GPT-5.6 Luna'),
      model('external:synthesis:gpt-5.6-terra', 'GPT-5.6 Terra'),
    ], selection)).toEqual({
      schemaVersion: 1,
      providerId: 'external-account',
      primary: { modelId: 'external:gpt-5.6-luna', displayName: 'GPT-5.6 Luna', tier: 'luna' },
      fallback: { modelId: 'external:synthesis:gpt-5.6-terra', displayName: 'GPT-5.6 Terra', tier: 'terra' },
      automatic: true,
    })
  })

  it('keeps a single custom model and does not invent a paid fallback', () => {
    expect(selectResourceStructuringModelRouting([
      model('external:custom-cheap', 'Custom Cheap'),
    ], { ...selection, modelId: 'external:custom-cheap' })).toMatchObject({
      primary: { modelId: 'external:custom-cheap', tier: 'custom' },
      automatic: false,
    })
  })

  it('does not override the explicit model for non-external providers', () => {
    expect(selectResourceStructuringModelRouting([
      model('local:gpt-5.6-luna', 'Local Luna', 'local-test'),
      model('local:gpt-5.6-terra', 'Local Terra', 'local-test'),
    ], { ...selection, providerId: 'local-test', modelId: 'local:gpt-5.6-terra' })).toMatchObject({
      primary: { modelId: 'local:gpt-5.6-terra' },
      automatic: false,
    })
  })
})
