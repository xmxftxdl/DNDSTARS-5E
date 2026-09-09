import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

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
  const showUnit = enabled && tab === 'unit'
  return (
    <aside className="map-reference-panel" data-tab={showUnit ? 'unit' : 'pdf'} aria-label="资料区">
      {enabled && <nav className="map-reference-panel__tabs" aria-label="资料区页签">
        <button type="button" aria-pressed={!showUnit} onClick={() => setTab('pdf')}>PDF</button>
        <button type="button" aria-pressed={showUnit} onClick={() => setTab('unit')}>单位</button>
      </nav>}
      <div className="map-reference-panel__content">
        {/* Keep both surfaces mounted and sized so PDF scroll/zoom and unit forms survive tab switches. */}
        <div className="map-reference-panel__surface map-reference-panel__pdf" style={{ visibility: showUnit ? 'hidden' : 'visible' }} inert={showUnit} aria-hidden={showUnit}>
          {children}
        </div>
        <div ref={setHost} className="map-reference-panel__surface map-reference-panel__unit" style={{ visibility: showUnit ? 'visible' : 'hidden' }} inert={!showUnit} aria-hidden={!showUnit} />
        {showUnit && !unitKey && <div className="map-reference-panel__surface grid place-content-center gap-2 p-6 text-center text-sm text-slate-400" data-testid="unit-reference-empty">
          <p>尚未选择单位</p>
          <p className="text-xs text-slate-500">点击地图上的单位或先攻头像，在这里查看资料。</p>
        </div>}
      </div>
    </aside>
  )
}
