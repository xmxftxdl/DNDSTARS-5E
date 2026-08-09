import { Suspense, type ReactNode } from 'react'

export function MapLazyOverlayLoadingFallback({ label }: { label: string }) {
  return (
    <div
      data-testid="map-lazy-overlay-loading"
      className="pointer-events-none absolute bottom-4 left-1/2 z-[90] -translate-x-1/2 rounded-xl border border-white/10 bg-void-950/90 px-4 py-2 text-sm text-slate-200 shadow-xl backdrop-blur"
      role="status"
    >
      {label}
    </div>
  )
}

export default function MapLazyOverlayBoundary({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <Suspense fallback={<MapLazyOverlayLoadingFallback label={label} />}>
      {children}
    </Suspense>
  )
}
