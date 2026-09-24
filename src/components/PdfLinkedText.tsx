import { Fragment } from 'react'
import { parsePdfPageLink } from '../lib/pdfReaderExperience'
import { requestPdfSplitView } from '../lib/pdfSplitViewController'

/** Only PDF references become controls; ordinary prose is never interpreted as HTML. */
export default function PdfLinkedText({ text }: { text: string }) {
  const pieces = text.split(/(https?:\/\/[^\s<>"）]+#pdf=[^\s<>"）]+)/g)
  return <>{pieces.map((piece, index) => {
    let target: ReturnType<typeof parsePdfPageLink> = null
    try { const url = new URL(piece); target = parsePdfPageLink(url.hash) } catch { /* plain text */ }
    return target ? <button key={index} type="button" className="inline text-sky-300 underline underline-offset-2" title={piece} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); requestPdfSplitView(target!) }}>查看 PDF 第 {target.page} 页</button> : <Fragment key={index}>{piece}</Fragment>
  })}</>
}
