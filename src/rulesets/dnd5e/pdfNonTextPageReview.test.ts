import { describe, expect, it, vi } from 'vitest'
import { AiProviderRegistryV1, DEFAULT_AI_PROVIDER_SELECTION } from '../../lib/aiProvider'
import { reviewPdfNonTextPages } from './pdfNonTextPageReview'

const fake = vi.hoisted(() => ({ output: {} as unknown, calls: 0 }))
vi.mock('../../lib/aiProvider', async importOriginal => ({
  ...await importOriginal<typeof import('../../lib/aiProvider')>(),
  executeStructuredAiTask: async (input: { validateOutput: (value: unknown) => boolean }) => {
    fake.calls++
    return input.validateOutput(fake.output) ? { ok: true, output: fake.output } : { ok: false, error: 'invalid-output' }
  },
}))

const input = () => ({
  registry: new AiProviderRegistryV1(), selection: DEFAULT_AI_PROVIDER_SELECTION,
  pages: [1, 2].map(page => ({ page, mimeType: 'image/png' as const, dataUrl: 'data:image/png;base64,AA==' })),
})

describe('non-text page review audit', () => {
  it('preserves text and uncertain classifications instead of silently excluding OCR failures', async () => {
    fake.output = { pages: [
      { page: 1, classification: 'contains-text-or-rules', reason: 'A table is visible.' },
      { page: 2, classification: 'uncertain', reason: 'Small labels cannot be read.' },
    ] }
    expect(await reviewPdfNonTextPages(input())).toEqual((fake.output as { pages: unknown[] }).pages)
  })
  it('accepts explicit blank/illustration evidence but rejects missing, duplicate and invented page numbers', async () => {
    const pages = [
      { page: 1, classification: 'blank', reason: 'Only a folio.' },
      { page: 2, classification: 'illustration-only', reason: 'Painting without text or diagrams.' },
    ]
    fake.output = { pages }
    expect(await reviewPdfNonTextPages(input())).toEqual(pages)
    for (const invalid of [pages.slice(0, 1), [pages[0], pages[0]], [pages[0], { ...pages[1], page: 3 }], [pages[0], { ...pages[1], reason: '' }]]) {
      fake.output = { pages: invalid }
      await expect(reviewPdfNonTextPages(input())).rejects.toThrow('pdf-page-review-failed')
    }
  })
  it('refuses an oversized or duplicate request before using the provider', async () => {
    fake.calls = 0
    const request = input()
    await expect(reviewPdfNonTextPages({ ...request, pages: [...request.pages, ...request.pages] })).rejects.toThrow('batch-invalid')
    await expect(reviewPdfNonTextPages({ ...request, pages: Array.from({ length: 5 }, (_, i) => ({ ...request.pages[0], page: i + 1 })) })).rejects.toThrow('batch-invalid')
    expect(fake.calls).toBe(0)
  })
})
