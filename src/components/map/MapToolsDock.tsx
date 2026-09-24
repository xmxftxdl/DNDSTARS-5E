import type { ReactNode } from 'react'
import { BrickWall, CloudFog, Map, MousePointer2, PencilLine, Ruler, UserPlus, X } from 'lucide-react'

export type MapToolPanel = 'drawing' | 'geometry' | 'fog' | 'units' | 'map' | 'ruler'
const tools = [
  { id: null, label: '选择', icon: MousePointer2 },
  { id: 'ruler', label: '测距', icon: Ruler },
  { id: 'drawing', label: '绘图', icon: PencilLine },
  { id: 'fog', label: '迷雾', icon: CloudFog },
  { id: 'geometry', label: '墙体与几何', icon: BrickWall },
  { id: 'units', label: '放置单位', icon: UserPlus },
  { id: 'map', label: '地图菜单', icon: Map },
] as const

export default function MapToolsDock({ panel, onChange, children }: {
  panel: MapToolPanel | null
  onChange: (panel: MapToolPanel | null) => void
  children: ReactNode
}) {
  return (
    <div className="map-tools-dock" data-testid="map-tools-dock">
      <nav className="map-tools-rail" aria-label="地图工具">
        {tools.map(({ id, label, icon: Icon }) => (
          <button key={id ?? 'select'} type="button" title={label} aria-label={label}
            aria-pressed={panel === id} aria-expanded={id ? panel === id : undefined}
            data-testid={id === 'map' ? 'map-tools-toggle' : `map-tool-${id ?? 'select'}`}
            onClick={() => onChange(panel === id ? null : id)}>
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </nav>
      {panel && <section className="map-tools-panel" data-testid="map-tools-drawer" data-tool-panel={panel} aria-label={tools.find(tool => tool.id === panel)?.label}>
        <header>
          <span>{tools.find(tool => tool.id === panel)?.label}</span>
          <button type="button" onClick={() => onChange(null)} aria-label="收起地图工具" title="收起地图工具"><X className="h-4 w-4" /></button>
        </header>
        <div className="map-tools-panel-content">{children}</div>
      </section>}
    </div>
  )
}
