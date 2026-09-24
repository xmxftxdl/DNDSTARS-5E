import { subscribePdfSplitView } from '../../lib/pdfSplitViewController'
import { BookOpenText, PanelLeftClose } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

type ReferenceTab = 'pdf' | 'unit'
const MapReferenceContext = createContext<{
  enabled: boolean
  host: HTMLDivElement | null
  setHost: (host: HTMLDivElement | null) => void
  unitKey: string | null
  registerUnit: (key: string | null) => void
  tab: ReferenceTab
  setTab: (tab: ReferenceTab) => void
} | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useMapReferencePanel() { return useContext(MapReferenceContext) }

export function MapReferenceProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [unitKey, setUnitKey] = useState<string | null>(null)
  const [tab, setTab] = useState<ReferenceTab>('pdf')
  const registerUnit = useCallback((key: string | null) => {
    setUnitKey(key)
  }, [])
  const value = useMemo(() => ({ enabled, host, setHost, unitKey, registerUnit, tab, setTab }),
    [enabled, host, unitKey, registerUnit, tab])
  return <MapReferenceContext.Provider value={value}>{children}</MapReferenceContext.Provider>
}

export default function MapReferencePanel({ children }: { children: ReactNode }) {
  const { enabled, unitKey, tab, setTab, setHost } = useMapReferencePanel()!
  const [minimized, setMinimized] = useState(false)
  const [width, setWidth] = useState(() => {
    try { return Math.max(320, Math.min(window.innerWidth * .7, Number(localStorage.getItem('pdf-panel-width')) || window.innerWidth * .42)) } catch { return 480 }
  })
  useEffect(() => subscribePdfSplitView(request => {
    if (request) { setMinimized(false); setTab('pdf') }
  }), [setTab])
  useEffect(() => {
    const fit = () => setWidth(previous => Math.max(280, Math.min(window.innerWidth * .75, previous)))
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  const resize = (next: number) => {
    const normalized = Math.max(280, Math.min(window.innerWidth * .75, next))
    setWidth(normalized)
    try { localStorage.setItem('pdf-panel-width', String(normalized)) } catch { /* optional preference */ }
  }
  const showUnit = enabled && tab === 'unit'
  return (
    <aside style={{ '--map-pdf-panel-width': `${width}px`, ...(minimized ? { flexBasis: '40px' } : {}) } as CSSProperties} className="map-reference-panel" data-tab={showUnit ? 'unit' : 'pdf'} aria-label="资料区">
      <button type="button" aria-label={minimized ? '展开资料区' : '收起资料区'} title={minimized ? '展开资料区' : '收起资料区'} className="shrink-0 p-2 text-xs text-sky-200" onClick={() => setMinimized(!minimized)}>{minimized ? <BookOpenText size={18} className="mx-auto" /> : <span className="flex items-center justify-center gap-2"><PanelLeftClose size={14} />收起资料区</span>}</button>
      {!minimized && <div role="separator" aria-label="调整资料区宽度" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={Math.round(typeof window === 'undefined' ? 900 : window.innerWidth * .75)} aria-valuenow={Math.round(width)} tabIndex={0} className="absolute right-0 top-0 z-[90] h-full w-1.5 cursor-col-resize hover:bg-sky-400/50" style={{ touchAction: 'none' }}
        onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); resize(width + (e.key === 'ArrowRight' ? 24 : -24)) } }}
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault() }}
        onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) resize(e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left) }}
        onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId) }} />}
      {enabled && !minimized && <nav className="map-reference-panel__tabs" aria-label="资料区页签">
        <button type="button" aria-pressed={!showUnit} onClick={() => setTab('pdf')}>PDF</button>
        <button type="button" aria-pressed={showUnit} onClick={() => setTab('unit')}>单位</button>
      </nav>}
      <div className="map-reference-panel__content" style={{ visibility: minimized ? 'hidden' : undefined }} inert={minimized}>
        {/* Keep both surfaces mounted and sized so PDF scroll/zoom and unit forms survive tab switches. */}
        <div className="map-reference-panel__surface map-reference-panel__pdf" style={{ visibility: showUnit || minimized ? 'hidden' : 'visible' }} inert={showUnit || minimized} aria-hidden={showUnit}>
          {children}
        </div>
        <div ref={setHost} className="map-reference-panel__surface map-reference-panel__unit" style={{ visibility: showUnit && !minimized ? 'visible' : 'hidden' }} inert={!showUnit} aria-hidden={!showUnit} />
        {showUnit && !unitKey && <div className="map-reference-panel__surface grid place-content-center gap-2 p-6 text-center text-sm text-slate-400" data-testid="unit-reference-empty">
          <p>尚未选择单位</p>
          <p className="text-xs text-slate-500">点击地图上的单位或先攻头像，在这里查看资料。</p>
        </div>}
      </div>
    </aside>
  )
}
