import { Suspense, type ReactNode } from 'react'

export function MapDetailPanelLoadingFallback() {
  return (
    <div
      data-testid="map-detail-panel-loading"
      className="pointer-events-none absolute bottom-4 left-4 z-40 rounded-xl border border-white/10 bg-void-950/90 px-4 py-2 text-sm text-slate-300 shadow-xl backdrop-blur"
    >
      正在打开详情面板…
    </div>
  )
}

export default function MapDetailPanelBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<MapDetailPanelLoadingFallback />}>{children}</Suspense>
}
