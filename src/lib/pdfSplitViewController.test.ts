import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  closePdfSplitView,
  getPdfSplitViewRequest,
  requestPdfSplitView,
  subscribePdfSplitView,
} from './pdfSplitViewController'

describe('PDF split view controller', () => {
  afterEach(() => closePdfSplitView())

  it('publishes open requests and close state', () => {
    const listener = vi.fn()
    const unsubscribe = subscribePdfSplitView(listener)
    requestPdfSplitView({ documentId: 'pdf_a' })
    expect(getPdfSplitViewRequest()?.documentId).toBe('pdf_a')
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ documentId: 'pdf_a' }))
    closePdfSplitView()
    expect(getPdfSplitViewRequest()).toBeNull()
    expect(listener).toHaveBeenLastCalledWith(null)
    unsubscribe()
  })
})
