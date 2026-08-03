import { describe, expect, it, vi } from 'vitest'
import type { AiProviderRuntimeV1 } from '../../lib/aiProvider'
import { AiProviderRegistryV1 } from '../../lib/aiProvider'
import {
  generateDnd5eLocalContentAiDraft,
  validateDnd5eLocalContentAiDraft,
} from './localContentAiImport'
import { prepareDnd5eLocalContentJson } from './localContentCollection'

function runtime(output: unknown): AiProviderRuntimeV1 {
  return {
    descriptor: {
      schemaVersion: 1,
      id: 'local-test',
      displayName: 'Local Test',
      description: 'Synthetic local test runtime.',
      transport: 'local-bridge',
      status: 'ready',
      dataBoundary: 'local-only',
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
      pricing: {
        mode: 'free-local',
        creditsPerMillionInput: 0,
        creditsPerMillionOutput: 0,
        minimumCredits: 0,
      },
    },
    listModels: async () => [{
      schemaVersion: 1,
      providerId: 'local-test',
      id: 'local-test:model',
      displayName: 'Test Model',
      contextWindowTokens: 32_768,
      capabilities: ['text-generation', 'structured-output'],
      supportedTasks: ['resource-structuring'],
    }],
    generateStructured: vi.fn(async (request) => ({
      schemaVersion: 1 as const,
      jobId: request.jobId,
      providerId: 'local-test',
      modelId: 'local-test:model',
      output,
    })),
  }
}

const selection = {
  schemaVersion: 1 as const,
  providerId: 'local-test',
  modelId: 'local-test:model',
  allowPaidFallback: false,
  maxCreditsPerTask: 0,
}

describe('natural-language local content AI import', () => {
  it('returns a preview draft without installing or executing it', async () => {
    const registry = new AiProviderRegistryV1()
    const provider = runtime({
      schemaVersion: 1,
      contentJson: JSON.stringify({
        name: 'Draft',
        features: [{
          id: 'steady-focus', name: 'Steady Focus', summary: 'Summary',
          description: 'Concise paraphrase.', automation: 'manual',
        }],
      }),
      assumptions: ['Converted feet without changing the value.'],
      unsupported: ['An ambiguous reaction trigger needs DM review.'],
    })
    registry.register(provider)
    const result = await generateDnd5eLocalContentAiDraft({
      sourceText: 'Synthetic rule source.',
      registry,
      selection,
    })
    expect(result).toMatchObject({
      provider: { id: 'local-test', dataBoundary: 'local-only' },
      model: { id: 'local-test:model' },
      estimatedCredits: 0,
      fallback: false,
      draft: {
        assumptions: expect.any(Array),
        unsupported: expect.any(Array),
      },
    })
    expect(provider.generateStructured).toHaveBeenCalledOnce()
    const prepared = await prepareDnd5eLocalContentJson(result.draft.contentJson)
    expect(prepared.package.content.features).toContainEqual(expect.objectContaining({
      id: 'steady-focus',
      automation: 'manual',
    }))
  })

  it('rejects malformed model output before it reaches the package parser', async () => {
    const registry = new AiProviderRegistryV1()
    registry.register(runtime({ schemaVersion: 1, contentJson: '{}' }))
    await expect(generateDnd5eLocalContentAiDraft({
      sourceText: 'Synthetic rule source.',
      registry,
      selection,
    })).rejects.toThrow('provider-output-invalid')
  })

  it('bounds the draft envelope', () => {
    expect(validateDnd5eLocalContentAiDraft({
      schemaVersion: 1,
      contentJson: '{}',
      assumptions: [],
      unsupported: [],
    })).toBe(true)
    expect(validateDnd5eLocalContentAiDraft({
      schemaVersion: 1,
      contentJson: '{}',
      assumptions: new Array(101).fill('x'),
      unsupported: [],
    })).toBe(false)
  })
})
