import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { isPdfSplitViewFile } from '../../lib/pdfSplitViewFile'
import PdfContinuousDocumentRenderer, {
  pdfCanvasOutputScale,
  pdfPageAtScrollOffset,
} from './PdfContinuousDocumentRenderer'
import PdfSplitViewPanel from './PdfSplitViewPanel'

describe('PdfSplitViewPanel', () => {
  it('only accepts PDF files within the local reader limit', () => {
    expect(isPdfSplitViewFile(new File(['%PDF'], 'adventure.pdf', { type: 'application/pdf' }))).toBe(true)
    expect(isPdfSplitViewFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false)
  })

  it('renders as a left split panel with a PDF-only upload control', () => {
    const html = renderToStaticMarkup(
      <PdfSplitViewPanel request={{ requestId: 1 }} onClose={() => undefined} />,
    )
    expect(html).toContain('data-testid="pdf-split-view-panel"')
    expect(html).toContain('PDF 分屏阅读')
    expect(html).toContain('accept="application/pdf,.pdf"')
    expect(html).toContain('上传 PDF')
  })

  it('lays out the PDF as one independently scrollable continuous document', () => {
    const html = renderToStaticMarkup(
      <PdfContinuousDocumentRenderer
        file={new File(['%PDF'], 'adventure.pdf', { type: 'application/pdf' })}
        pageCount={3}
        pageNumber={1}
      />,
    )
    expect(html).toContain('data-continuous-pages="true"')
    expect(html).toContain('data-zoom-percent="100"')
    expect(html).toContain('cursor-grab')
    expect(html).toContain('overflow-auto')
    expect(html).toContain('overscroll-contain')
    expect(html).toContain('data-pdf-continuous-page="1"')
    expect(html).toContain('data-pdf-continuous-page="2"')
    expect(html).toContain('data-pdf-continuous-page="3"')
    expect(html).toContain('pdf-original-page pdf-continuous-page')
  })

  it('exposes PDF zoom without changing text-layer layout independently', () => {
    const html = renderToStaticMarkup(
      <PdfContinuousDocumentRenderer
        file={new File(['%PDF'], 'adventure.pdf', { type: 'application/pdf' })}
        pageCount={2}
        pageNumber={1}
        zoom={1.25}
      />,
    )
    expect(html).toContain('data-zoom-percent="125"')
  })

  it('finds the current continuous page with logarithmic page-offset reads', () => {
    let reads = 0
    const page = pdfPageAtScrollOffset(200, 54_250, (pageNumber) => {
      reads += 1
      return { top: (pageNumber - 1) * 1_100, height: 1_080 }
    }, 1)
    expect(page).toBe(50)
    expect(reads).toBeLessThan(12)
  })

  it('caps enlarged PDF canvases while preserving normal-width retina quality', () => {
    expect(pdfCanvasOutputScale(700, 990, 2)).toBe(2)
    expect(pdfCanvasOutputScale(1_400, 1_980, 2)).toBeLessThan(1.1)
  })

})
