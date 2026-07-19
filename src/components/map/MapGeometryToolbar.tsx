import { useRef } from 'react'
import {
  BrickWall, Copy, DoorClosed, Download, Eye, Grid3X3, LockKeyhole,
  MousePointer2, Package, Redo2, Trash2, Undo2, Upload,
} from 'lucide-react'
import { normalizeMapGeometry, type MapGeometryEntity, type MapGeometryState, type MapGeometryTool } from '../../lib/mapGeometry'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useMapStore, type Token } from '../../store/maps'

interface MapGeometryToolbarProps {
  mapId: string
  geometry: MapGeometryState
  selectedEntity?: MapGeometryEntity
  selectedToken?: Token | null
  editMode: boolean
  tool: MapGeometryTool
  previewAsPlayer: boolean
  snapToGrid: boolean
  onEditModeChange: (enabled: boolean) => void
  onToolChange: (tool: MapGeometryTool) => void
  onPreviewChange: (enabled: boolean) => void
  onSnapToGridChange: (enabled: boolean) => void
}

const TOOL_LABELS: Record<MapGeometryTool, string> = {
  select: '选择',
  wall: '墙',
  door: '门',
  obstacle: '障碍物',
}

function NumberField({
  label,
  value,
  min = -1_000,
  onChange,
}: {
  label: string
  value: number
  min?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-slate-400">
      {label}
      <input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-14 rounded border border-white/10 bg-void-900 px-1 py-0.5 text-slate-200 outline-none"
      />
    </label>
  )
}

export default function MapGeometryToolbar({
  mapId,
  geometry,
  selectedEntity,
  selectedToken,
  editMode,
  tool,
  previewAsPlayer,
  snapToGrid,
  onEditModeChange,
  onToolChange,
  onPreviewChange,
  onSnapToGridChange,
}: MapGeometryToolbarProps) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const updateEntity = useMapGeometryStore((state) => state.updateEntity)
  const removeEntity = useMapGeometryStore((state) => state.removeEntity)
  const setDoorState = useMapGeometryStore((state) => state.setDoorState)
  const setVision = useMapGeometryStore((state) => state.setVision)
  const clearMap = useMapGeometryStore((state) => state.clearMap)
  const duplicateEntity = useMapGeometryStore((state) => state.duplicateEntity)
  const replaceMap = useMapGeometryStore((state) => state.replaceMap)
  const undo = useMapGeometryStore((state) => state.undo)
  const redo = useMapGeometryStore((state) => state.redo)
  const canUndo = useMapGeometryStore((state) => (state.historyByMapId[mapId]?.length ?? 0) > 0)
  const canRedo = useMapGeometryStore((state) => (state.futureByMapId[mapId]?.length ?? 0) > 0)
  const updateToken = useMapStore((state) => state.updateToken)
  const count = geometry.walls.length + geometry.doors.length + geometry.obstacles.length

  return (
    <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-violet-400/15 bg-violet-500/[0.05] px-1 py-0.5">
      <button
        type="button"
        onClick={() => onEditModeChange(!editMode)}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${editMode ? 'bg-violet-500/25 text-violet-100' : 'text-slate-400 hover:bg-white/5'}`}
        title="编辑阻挡视线、移动和效果线的地图几何"
      >
        <BrickWall className="h-3.5 w-3.5" />
        几何
      </button>

      {editMode && (
        <>
          <select
            value={tool}
            onChange={(event) => onToolChange(event.target.value as MapGeometryTool)}
            className="rounded-md border border-white/10 bg-void-900 px-1.5 py-1 text-[11px] text-slate-200 outline-none"
            title="按住并拖动绘制；选择工具可检视已有实体"
          >
            {Object.entries(TOOL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          {tool === 'select' && <MousePointer2 className="h-3.5 w-3.5 text-violet-200" />}
          {tool === 'door' && <DoorClosed className="h-3.5 w-3.5 text-amber-200" />}
          {tool === 'obstacle' && <Package className="h-3.5 w-3.5 text-orange-200" />}

          <label className="flex items-center gap-1 text-[10px] text-slate-300" title="启用动态视野和服务端 Token 可见性过滤">
            <input
              type="checkbox"
              checked={geometry.vision.enabled}
              onChange={(event) => setVision(mapId, { enabled: event.target.checked })}
            />
            动态视野
          </label>
          <NumberField
            label="默认尺"
            min={0}
            value={geometry.vision.defaultRangeFeet}
            onChange={(defaultRangeFeet) => setVision(mapId, { defaultRangeFeet })}
          />
          <label className="flex items-center gap-1 text-[10px] text-slate-300" title="玩家共享所有队友的视野；关闭后只使用当前控制角色">
            <input
              type="checkbox"
              checked={geometry.vision.sharePartyVision}
              onChange={(event) => setVision(mapId, { sharePartyVision: event.target.checked })}
            />
            共享视野
          </label>
          <button
            type="button"
            onClick={() => onPreviewChange(!previewAsPlayer)}
            className={`rounded-md p-1 ${previewAsPlayer ? 'bg-sky-500/25 text-sky-100' : 'text-slate-300 hover:bg-white/10'}`}
            title="预览玩家动态视野"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canUndo}
            onClick={() => undo(mapId)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:opacity-30"
            title="撤销几何编辑"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={() => redo(mapId)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:opacity-30"
            title="重做几何编辑"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onSnapToGridChange(!snapToGrid)}
            className={`rounded-md p-1 ${snapToGrid ? 'bg-violet-500/25 text-violet-100' : 'text-slate-300 hover:bg-white/10'}`}
            title="绘制时吸附到地图网格"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = new Blob([JSON.stringify(geometry, null, 2)], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const anchor = document.createElement('a')
              anchor.href = url
              anchor.download = `${geometry.mapId}.map-geometry.json`
              anchor.click()
              URL.revokeObjectURL(url)
            }}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10"
            title="导出当前地图几何 JSON"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10"
            title="导入地图几何 JSON"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              if (!file) return
              void file.text().then((text) => {
                try {
                  const parsed = normalizeMapGeometry(JSON.parse(text))
                  if (!parsed) throw new Error('结构不符合地图几何 schema')
                  if (!replaceMap(mapId, { ...parsed, mapId })) throw new Error('地图标识不一致')
                } catch (error) {
                  alert(`无法导入地图几何：${error instanceof Error ? error.message : '文件无效'}`)
                }
              })
            }}
          />
          <span className="text-[10px] text-slate-500">{count} 项</span>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              if (confirm('清除当前地图的全部墙、门和障碍物吗？')) clearMap(mapId)
            }}
            className="rounded-md p-1 text-rose-300 hover:bg-rose-500/15 disabled:opacity-30"
            title="清空地图几何"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {editMode && selectedEntity && (
        <div className="ml-1 flex flex-wrap items-center gap-1 border-l border-white/10 pl-2">
          <input
            value={selectedEntity.label}
            onChange={(event) => updateEntity(mapId, selectedEntity.id, { label: event.target.value.slice(0, 120) })}
            className="w-20 rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200 outline-none"
            aria-label="几何名称"
          />
          {(['blocksVision', 'blocksMovement', 'blocksLineOfEffect'] as const).map((field, index) => (
            <label key={field} className="flex items-center gap-0.5 text-[10px] text-slate-300">
              <input
                type="checkbox"
                checked={selectedEntity[field]}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { [field]: event.target.checked })}
              />
              {['视线', '移动', '效果线'][index]}
            </label>
          ))}
          <NumberField
            label="底高"
            value={selectedEntity.baseHeightFeet}
            onChange={(baseHeightFeet) => updateEntity(mapId, selectedEntity.id, { baseHeightFeet })}
          />
          <NumberField
            label="高度"
            min={0}
            value={selectedEntity.heightFeet}
            onChange={(heightFeet) => updateEntity(mapId, selectedEntity.id, { heightFeet })}
          />
          {selectedEntity.kind === 'door' && (
            <>
              <select
                value={selectedEntity.state}
                onChange={(event) => setDoorState(mapId, selectedEntity.id, event.target.value as 'open' | 'closed' | 'locked')}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
              >
                <option value="open">打开</option>
                <option value="closed">关闭</option>
                <option value="locked">上锁</option>
              </select>
              <label className="flex items-center gap-0.5 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedEntity.secret}
                  onChange={(event) => updateEntity(mapId, selectedEntity.id, { secret: event.target.checked })}
                />
                暗门
              </label>
              {selectedEntity.state === 'locked' && <LockKeyhole className="h-3.5 w-3.5 text-rose-300" />}
            </>
          )}
          {selectedEntity.kind === 'obstacle' && (
            <select
              value={selectedEntity.cover}
              onChange={(event) => updateEntity(mapId, selectedEntity.id, { cover: event.target.value as 'none' | 'half' | 'three-quarters' | 'total' })}
              className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
              title="D&D 5e 掩护等级"
            >
              <option value="none">无掩护</option>
              <option value="half">半身 +2 AC</option>
              <option value="three-quarters">四分之三 +5 AC</option>
              <option value="total">全身掩护</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => duplicateEntity(mapId, selectedEntity.id)}
            className="rounded p-1 text-slate-300 hover:bg-white/10"
            title="复制选中几何"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => removeEntity(mapId, selectedEntity.id)}
            className="rounded p-1 text-rose-300 hover:bg-rose-500/15"
            title="删除选中几何"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {editMode && selectedToken && (
        <div className="ml-1 flex flex-wrap items-center gap-1 border-l border-white/10 pl-2">
          <span className="max-w-20 truncate text-[10px] text-slate-300">{selectedToken.label}</span>
          <select
            value={selectedToken.visibilityMode ?? 'line-of-sight'}
            onChange={(event) => updateToken(mapId, selectedToken.id, { visibilityMode: event.target.value as Token['visibilityMode'] })}
            className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
            title="玩家端 Token 可见性"
          >
            <option value="line-of-sight">按视线</option>
            <option value="always">始终可见</option>
            <option value="dm-only">仅 DM</option>
          </select>
          <NumberField
            label="海拔"
            value={selectedToken.elevationFeet ?? 0}
            onChange={(elevationFeet) => updateToken(mapId, selectedToken.id, { elevationFeet })}
          />
          {selectedToken.type === 'player' && (
            <NumberField
              label="视野"
              min={0}
              value={selectedToken.visionRangeFeet ?? geometry.vision.defaultRangeFeet}
              onChange={(visionRangeFeet) => updateToken(mapId, selectedToken.id, { visionRangeFeet })}
            />
          )}
        </div>
      )}
    </div>
  )
}
