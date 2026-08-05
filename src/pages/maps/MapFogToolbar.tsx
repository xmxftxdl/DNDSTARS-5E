import { CloudFog, Eye, Hand, Redo2, Undo2 } from 'lucide-react'
import type { FogTool, MapFogState } from '../../lib/fogOfWar'
import { showAppConfirm } from '../../lib/appDialog'

interface MapFogToolbarProps {
  mapId: string
  fog?: MapFogState
  redoCount: number
  editMode: boolean
  tool: FogTool
  previewAsPlayer: boolean
  onEditModeChange: (enabled: boolean) => void
  onToolChange: (tool: FogTool) => void
  onFill: (mapId: string) => void
  onClear: (mapId: string) => void
  onUndo: (mapId: string) => void
  onRedo: (mapId: string) => void
  onPreviewChange: (enabled: boolean) => void
  onStyleChange: (mapId: string, patch: Pick<Partial<MapFogState>, 'color' | 'opacity'>) => void
}

export default function MapFogToolbar({
  mapId,
  fog,
  redoCount,
  editMode,
  tool,
  previewAsPlayer,
  onEditModeChange,
  onToolChange,
  onFill,
  onClear,
  onUndo,
  onRedo,
  onPreviewChange,
  onStyleChange,
}: MapFogToolbarProps) {
  const shapeCount = fog?.shapes.length ?? 0

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-sky-400/15 bg-sky-500/[0.05] px-1 py-0.5"
      data-testid="map-fog-toolbar"
    >
      <button
        type="button"
        onClick={() => onEditModeChange(!editMode)}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${editMode ? 'bg-sky-500/25 text-sky-100' : 'text-slate-400 hover:bg-white/5'}`}
        title="编辑静态战争迷雾"
        aria-pressed={editMode}
      >
        <CloudFog className="h-3.5 w-3.5" />
        迷雾
      </button>
      {editMode && (
        <>
          <select
            value={tool}
            onChange={(event) => onToolChange(event.target.value as FogTool)}
            className="rounded-md border border-white/10 bg-void-900 px-1.5 py-1 text-[11px] text-slate-200 outline-none"
            title="迷雾绘制工具；多边形双击或按 Enter 完成"
            aria-label="迷雾绘制工具"
          >
            <option value="pan">移动地图</option>
            <option value="reveal-rect">矩形揭示</option>
            <option value="cover-rect">矩形遮盖</option>
            <option value="reveal-circle">圆形揭示</option>
            <option value="cover-circle">圆形遮盖</option>
            <option value="reveal-polygon">多边形揭示</option>
            <option value="cover-polygon">多边形遮盖</option>
            <option value="reveal-brush">画笔揭示</option>
            <option value="cover-brush">画笔遮盖</option>
          </select>
          {tool === 'pan' && <Hand className="h-3.5 w-3.5 text-sky-200" aria-label="移动地图" />}
          <button
            type="button"
            onClick={() => void (async () => {
              if (shapeCount === 0 || await showAppConfirm({
                message: '填满整张地图会清除现有迷雾笔画，继续吗？',
                tone: 'danger',
                confirmLabel: '清除并填满',
              })) onFill(mapId)
            })()}
            className="rounded-md px-1.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/15"
            title="填满全图并清除现有笔画"
          >
            全遮
          </button>
          <button
            type="button"
            onClick={() => void (async () => {
              if ((!fog?.filled && shapeCount === 0) || await showAppConfirm({
                message: '清空这张地图的全部战争迷雾吗？',
                tone: 'danger',
                confirmLabel: '清空',
              })) onClear(mapId)
            })()}
            className="rounded-md px-1.5 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/15"
            title="清空全图迷雾"
          >
            全显
          </button>
          <button
            type="button"
            disabled={shapeCount === 0}
            onClick={() => onUndo(mapId)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:opacity-30"
            title="撤销最后一笔"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={redoCount === 0}
            onClick={() => onRedo(mapId)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:opacity-30"
            title="重做"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPreviewChange(!previewAsPlayer)}
            className={`rounded-md p-1 ${previewAsPlayer ? 'bg-violet-500/25 text-violet-100' : 'text-slate-300 hover:bg-white/10'}`}
            title="预览玩家看到的不透明迷雾"
            aria-pressed={previewAsPlayer}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <input
            type="color"
            value={fog?.color ?? '#05070f'}
            onChange={(event) => onStyleChange(mapId, { color: event.target.value })}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            title="迷雾颜色"
            aria-label="迷雾颜色"
          />
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.02}
            value={fog?.opacity ?? 0.98}
            onChange={(event) => onStyleChange(mapId, { opacity: Number(event.target.value) })}
            className="w-10 accent-sky-400"
            title="DM 预览迷雾浓度（玩家端始终完全遮蔽）"
            aria-label="迷雾浓度"
          />
        </>
      )}
    </div>
  )
}
