import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import PdfSplitViewPanel from '../../src/components/dm/PdfSplitViewPanel'
import MapReferencePanel, { MapReferenceProvider } from '../../src/presentation/maps/MapReferencePanel'
import { normalizedPdfCrop, cropPdfShare } from '../../src/lib/pdfReaderExperience'
import '../../src/index.css'
function App() {
  const [open, setOpen] = useState(true)
  return <div className="flex h-screen bg-slate-800"><MapReferenceProvider enabled>{open && <MapReferencePanel><PdfSplitViewPanel request={{ requestId: 1 }} onClose={() => setOpen(false)} embedded /></MapReferencePanel>}</MapReferenceProvider><main className="relative flex-1 p-8 text-white"><h1>战斗地图测试区</h1><button onClick={() => setOpen(true)}>打开资料</button></main></div>
}
Object.assign(window, { testCrop: async () => {
 const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300
 const ctx = canvas.getContext('2d')!; ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 200, 300); ctx.fillStyle = 'blue'; ctx.fillRect(200, 0, 200, 300)
 const blob = await cropPdfShare(canvas.toDataURL(), normalizedPdfCrop({ x: .5, y: 0 }, { x: 1, y: 1 }))
 const bitmap = await createImageBitmap(blob); ctx.clearRect(0, 0, 400, 300); ctx.drawImage(bitmap, 0, 0)
 return { width: bitmap.width, height: bitmap.height, pixel: Array.from(ctx.getImageData(0, 0, 1, 1).data) }
} })
createRoot(document.getElementById('root')!).render(<App />)
