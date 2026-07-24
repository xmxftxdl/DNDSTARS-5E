import { useRef, useState } from 'react'
import {
  BrickWall, Copy, DoorClosed, Download, Eye, Grid3X3, Lightbulb, LockKeyhole,
  Mountain, Package, Redo2, Square, Trash2, Undo2, Upload, WandSparkles,
} from 'lucide-react'
import {
  mapGeometryAbsoluteElevationAtPoint,
  mapGeometryDoorLockState,
  mapGeometryDoorOpenState,
  mapGeometryTerrainElevationAtPoint,
  mapGeometryTokenElevation,
  normalizeMapGeometry,
  type MapGeometryEntity,
  type MapGeometryState,
  type MapGeometryTool,
  type MapGeometryWallMaterial,
} from '../../lib/mapGeometry'
import { useMapGeometryStore } from '../../store/mapGeometry'
import { useMapStore, type Token } from '../../store/maps'
import {
  CAMPAIGN_LIGHT_PRESETS,
  campaignLightPresetPatch,
  campaignLightRemainingMinutes,
  formatCampaignDuration,
  type CampaignLightPreset,
} from '../../lib/campaignTime'
import { useCampaignTimeStore } from '../../store/campaignTime'
import { importUvttGeometry, uvttEmbeddedImageBlob } from '../../lib/uvttImport'
import {
  detectWallsFromImageFile,
  wallDetectionCandidatesToGeometry,
  type WallDetectionCandidate,
} from '../../lib/mapImageGeometryDetection'
import { deriveMapRoomGraph } from '../../lib/mapRooms'

interface MapGeometryToolbarProps {
  mapId: string
  geometry: MapGeometryState
  selectedEntity?: MapGeometryEntity
  selectedToken?: Token | null
  editMode: boolean
  tool: MapGeometryTool
  wallMaterial: MapGeometryWallMaterial
  previewAsPlayer: boolean
  snapToGrid: boolean
  terrainEditingLocked?: boolean
  diagnosticsEnabled: boolean
  diagnosticIssueCount: number
  diagnosticsTruncated: boolean
  detectionCandidates: readonly WallDetectionCandidate[]
  onEditModeChange: (enabled: boolean) => void
  onToolChange: (tool: MapGeometryTool) => void
  onWallMaterialChange: (material: MapGeometryWallMaterial) => void
  onPreviewChange: (enabled: boolean) => void
  onSnapToGridChange: (enabled: boolean) => void
  onDiagnosticsEnabledChange: (enabled: boolean) => void
  onDetectionCandidatesChange: (candidates: WallDetectionCandidate[]) => void
  onCreateMapFromUvtt: (input: {
    name: string
    blob: Blob
    width: number
    height: number
    pixelsPerGrid: number
    geometry: MapGeometryState
  }) => Promise<void>
}

const TOOL_LABELS: Record<Exclude<MapGeometryTool, 'select'>, string> = {
  wall: '墙',
  door: '门',
  window: '窗户',
  obstacle: '区域/障碍',
  elevation: '格子高度',
  light: '光源',
  delete: '删除',
}

const WALL_MATERIAL_LABELS: Record<MapGeometryWallMaterial, string> = {
  stone: '石墙',
  brick: '砖墙',
  wood: '木墙',
  metal: '金属墙',
  natural: '自然墙体',
}

const BLOCKING_FIELD_OPTIONS = [
  {
    field: 'blocksVision',
    label: '视线',
    help: '勾选后，这个立体区域会遮挡角色视线与玩家端 Token 可见性。',
  },
  {
    field: 'blocksMovement',
    label: '移动',
    help: '勾选后，海拔与该区域重叠的 Token 不能穿过。山坡和高台通常不要勾选，交给地形标高判断高差。',
  },
  {
    field: 'blocksLineOfEffect',
    label: '效果线',
    help: '勾选后，攻击、法术和范围效果不能直接穿过这个区域。',
  },
] as const

function NumberField({
  label,
  value,
  min = -1_000,
  disabled = false,
  help,
  onChange,
}: {
  label: string
  value: number
  min?: number
  disabled?: boolean
  help?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-slate-400" title={help}>
      {label}
      <input
        type="number"
        min={min}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="w-14 rounded border border-white/10 bg-void-900 px-1 py-0.5 text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-45"
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
  wallMaterial,
  previewAsPlayer,
  snapToGrid,
  terrainEditingLocked = false,
  diagnosticsEnabled,
  diagnosticIssueCount,
  diagnosticsTruncated,
  detectionCandidates,
  onEditModeChange,
  onToolChange,
  onWallMaterialChange,
  onPreviewChange,
  onSnapToGridChange,
  onDiagnosticsEnabledChange,
  onDetectionCandidatesChange,
  onCreateMapFromUvtt,
}: MapGeometryToolbarProps) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const imageDetectionInputRef = useRef<HTMLInputElement>(null)
  const [roomSummary, setRoomSummary] = useState<{ rooms: number; sealed: number } | null>(null)
  const [detectionSourceFile, setDetectionSourceFile] = useState<File | null>(null)
  const [detectionDarkness, setDetectionDarkness] = useState(68)
  const [detectionMinimumRatio, setDetectionMinimumRatio] = useState(0.025)
  const [showRegionHelp, setShowRegionHelp] = useState(false)
  const updateEntity = useMapGeometryStore((state) => state.updateEntity)
  const removeEntity = useMapGeometryStore((state) => state.removeEntity)
  const setVision = useMapGeometryStore((state) => state.setVision)
  const setEnvironment = useMapGeometryStore((state) => state.setEnvironment)
  const clearMap = useMapGeometryStore((state) => state.clearMap)
  const duplicateEntity = useMapGeometryStore((state) => state.duplicateEntity)
  const replaceMap = useMapGeometryStore((state) => state.replaceMap)
  const undo = useMapGeometryStore((state) => state.undo)
  const redo = useMapGeometryStore((state) => state.redo)
  const canUndo = useMapGeometryStore((state) => (state.historyByMapId[mapId]?.length ?? 0) > 0)
  const canRedo = useMapGeometryStore((state) => (state.futureByMapId[mapId]?.length ?? 0) > 0)
  const updateToken = useMapStore((state) => state.updateToken)
  const activeMap = useMapStore((state) => state.maps.find((map) => map.id === mapId))
  const worldMinute = useCampaignTimeStore((state) => state.state.worldMinute)
  const count = geometry.walls.length + geometry.doors.length + (geometry.windows?.length ?? 0) + geometry.obstacles.length + (geometry.lights?.length ?? 0)
  const selectedTerrainRegion = selectedEntity?.kind === 'obstacle' && selectedEntity.terrainRegion === true
  const selectedTerrainRegionLocked = terrainEditingLocked && selectedEntity?.kind === 'obstacle' && (
    selectedEntity.terrainRegion === true || (selectedEntity.terrainElevationFeet ?? 0) !== 0
  )
  const selectedLightGroundElevation = selectedEntity?.kind === 'light'
    ? mapGeometryTerrainElevationAtPoint(geometry, selectedEntity.points[0])
    : 0
  const selectedLightElevation = selectedEntity?.kind === 'light'
    ? mapGeometryAbsoluteElevationAtPoint(geometry, selectedEntity.points[0], selectedEntity.elevationFeet)
    : 0
  const selectedLightHeightAboveGround = selectedEntity?.kind === 'light'
    ? selectedLightElevation - selectedLightGroundElevation
    : 0
  const runWallDetection = (file: File) => {
    if (!activeMap) return
    void detectWallsFromImageFile(file, activeMap, {
      darknessThreshold: detectionDarkness,
      minimumRunRatio: detectionMinimumRatio,
    }).then((candidates) => {
      if (candidates.length === 0) {
        alert('没有识别到可靠的墙线候选。')
        return
      }
      onDetectionCandidatesChange(candidates)
      onDiagnosticsEnabledChange(true)
    }).catch((error) => {
      alert(`无法识别地图墙体：${error instanceof Error ? error.message : '图像无效'}`)
    })
  }
  const selectedTokenGroundElevation = selectedToken
    ? mapGeometryTerrainElevationAtPoint(geometry, selectedToken)
    : 0
  const selectedTokenElevation = selectedToken
    ? mapGeometryTokenElevation(geometry, selectedToken)
    : 0
  const selectedTokenHeightAboveGround = Math.max(0, selectedTokenElevation - selectedTokenGroundElevation)

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
            title="按住并拖动绘制；门窗工具下从空白地图拖动仍可平移视角"
          >
            {Object.entries(TOOL_LABELS).map(([value, label]) => (
              <option key={value} value={value} disabled={terrainEditingLocked && value === 'elevation'}>{label}</option>
            ))}
          </select>
          {tool === 'door' && <DoorClosed className="h-3.5 w-3.5 text-amber-200" />}
          {tool === 'window' && <Square className="h-3.5 w-3.5 text-sky-200" />}
          {(tool === 'door' || tool === 'window') && (
            <span className="text-[10px] text-slate-400" title="贴近墙段拖动创建门窗；从空白区域拖动则正常平移地图">
              沿墙创建／空白平移
            </span>
          )}
          {tool === 'obstacle' && <Package className="h-3.5 w-3.5 text-orange-200" />}
          {tool === 'elevation' && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-200" title="单击选择一格，按住拖动可连续选择地图格；松开后只保留选区外边界">
              <Mountain className="h-3.5 w-3.5" />
              点击／拖动选格
            </span>
          )}
          {terrainEditingLocked && (
            <span className="text-[10px] text-amber-300">战斗中高度区域已锁定</span>
          )}
          {tool === 'light' && (
            <span className="flex items-center gap-1 text-[10px] text-amber-200" title="点击地图放置默认光源；从中心向外拖动可直接设置明亮半径">
              <Lightbulb className="h-3.5 w-3.5" />
              点击定中心／拖动定半径
            </span>
          )}
          {tool === 'delete' && <Trash2 className="h-3.5 w-3.5 text-rose-300" />}
          {tool === 'wall' && (
            <>
              <select
                value={wallMaterial}
                onChange={(event) => onWallMaterialChange(event.target.value as MapGeometryWallMaterial)}
                className="rounded-md border border-white/10 bg-void-900 px-1.5 py-1 text-[11px] text-slate-200 outline-none"
                title="新绘制墙体的材质"
              >
                {Object.entries(WALL_MATERIAL_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400" title="从同材质墙体末端继续绘制会自动合并为连续墙体">
                末端续画
              </span>
            </>
          )}

          <label className="flex items-center gap-1 text-[10px] text-slate-300" title="启用墙体遮挡视线和服务端 Token 可见性过滤；地图黑幕由战争迷雾层单独控制">
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
          <select
            value={geometry.vision.ambientLight}
            onChange={(event) => setVision(mapId, { ambientLight: event.target.value as MapGeometryState['vision']['ambientLight'] })}
            className="rounded-md border border-white/10 bg-void-900 px-1.5 py-1 text-[11px] text-slate-200 outline-none"
            title="场景环境光照"
            aria-label="场景环境光照"
          >
            <option value="bright">明亮光照</option>
            <option value="dim">微光</option>
            <option value="darkness">黑暗</option>
          </select>
          <select
            value={geometry.environment ?? 'normal'}
            onChange={(event) => setEnvironment(mapId, event.target.value as 'normal' | 'underwater')}
            className="rounded-md border border-white/10 bg-void-900 px-1.5 py-1 text-[11px] text-slate-200 outline-none"
            title="环境规则与地图亮度无关；水下规则会应用 SRD 水下武器攻击限制"
            aria-label="地图环境规则"
          >
            <option value="normal">地表规则</option>
            <option value="underwater">水下规则</option>
          </select>
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
            disabled={!canUndo || terrainEditingLocked}
            onClick={() => undo(mapId)}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:opacity-30"
            title="撤销几何编辑"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canRedo || terrainEditingLocked}
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
            disabled={terrainEditingLocked}
            onClick={() => importInputRef.current?.click()}
            className="rounded-md p-1 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
            title="导入地图几何 JSON 或 UVTT/DD2VTT"
          >
            <Upload className="h-3.5 w-3.5" />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json,.uvtt,.dd2vtt,.df2vtt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.currentTarget.value = ''
              if (terrainEditingLocked) return
              if (!file) return
              void file.text().then(async (text) => {
                try {
                  const raw = JSON.parse(text) as unknown
                  const isUvtt = /\.(?:uvtt|dd2vtt|df2vtt)$/i.test(file.name) ||
                    !!raw && typeof raw === 'object' && 'resolution' in raw && 'line_of_sight' in raw
                  let imported = isUvtt
                    ? importUvttGeometry(raw, {
                        mapId,
                        targetWidth: activeMap?.width,
                        targetHeight: activeMap?.height,
                        feetPerCell: activeMap?.feetPerCell,
                      })
                    : undefined
                  if (
                    imported?.embeddedImageDataUrl &&
                    confirm('该 UVTT 包含地图背景图片。是否创建一张新地图并同时导入网格、墙、门和光源？')
                  ) {
                    imported = importUvttGeometry(raw, { mapId: 'uvtt-pending' })
                    await onCreateMapFromUvtt({
                      name: file.name.replace(/\.(?:uvtt|dd2vtt|df2vtt)$/i, ''),
                      blob: uvttEmbeddedImageBlob(imported.embeddedImageDataUrl!),
                      width: imported.sourceWidth,
                      height: imported.sourceHeight,
                      pixelsPerGrid: imported.pixelsPerGrid,
                      geometry: imported.geometry,
                    })
                    return
                  }
                  const parsed = imported?.geometry ?? normalizeMapGeometry(raw)
                  if (!parsed) throw new Error('结构不符合地图几何 schema')
                  if (!replaceMap(mapId, { ...parsed, mapId })) throw new Error('地图标识不一致')
                  if (imported && imported.warnings.length > 0) {
                    alert(`UVTT 已导入，但有以下提示：\n${imported.warnings.join('\n')}`)
                  }
                } catch (error) {
                  alert(`无法导入地图几何：${error instanceof Error ? error.message : '文件无效'}`)
                }
              })
            }}
          />
          <button
            type="button"
            disabled={terrainEditingLocked || !activeMap}
            onClick={() => imageDetectionInputRef.current?.click()}
            className="rounded-md p-1 text-cyan-200 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-30"
            title="从地图图片识别候选墙；确认后才写入权威几何"
          >
            <WandSparkles className="h-3.5 w-3.5" />
          </button>
          <input
            ref={imageDetectionInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
             onChange={(event) => {
               const file = event.target.files?.[0]
               event.currentTarget.value = ''
               if (!file || !activeMap || terrainEditingLocked) return
               setDetectionSourceFile(file)
               runWallDetection(file)
             }}
           />
           {detectionCandidates.length > 0 && (
             <span
               className="flex flex-wrap items-center gap-1 rounded border border-cyan-400/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-100"
               title="候选线尚未写入权威几何；可点击地图上的青色候选线逐条删除"
             >
               候选 {detectionCandidates.length}
               <label className="flex items-center gap-0.5">
                 暗度
                 <input
                   type="range"
                   min={24}
                   max={128}
                   step={4}
                   value={detectionDarkness}
                   onChange={(event) => setDetectionDarkness(Number(event.target.value))}
                   className="w-14 accent-cyan-400"
                 />
                 {detectionDarkness}
               </label>
               <label className="flex items-center gap-0.5">
                 最短
                 <input
                   type="range"
                   min={0.01}
                   max={0.1}
                   step={0.005}
                   value={detectionMinimumRatio}
                   onChange={(event) => setDetectionMinimumRatio(Number(event.target.value))}
                   className="w-14 accent-cyan-400"
                 />
                 {Math.round(detectionMinimumRatio * 100)}%
               </label>
               <button
                 type="button"
                 disabled={!detectionSourceFile}
                 onClick={() => {
                   if (detectionSourceFile) runWallDetection(detectionSourceFile)
                 }}
                 className="rounded bg-cyan-500/20 px-1 text-cyan-50 hover:bg-cyan-500/30 disabled:opacity-40"
               >
                 重算
               </button>
               <button
                 type="button"
                 onClick={() => {
                   if (replaceMap(mapId, wallDetectionCandidatesToGeometry(geometry, [...detectionCandidates]))) {
                     onDetectionCandidatesChange([])
                     setDetectionSourceFile(null)
                   }
                 }}
                 className="rounded bg-emerald-500/20 px-1 text-emerald-100 hover:bg-emerald-500/30"
              >
                接受
              </button>
               <button
                 type="button"
                 onClick={() => {
                   onDetectionCandidatesChange([])
                   setDetectionSourceFile(null)
                 }}
                 className="rounded bg-rose-500/20 px-1 text-rose-100 hover:bg-rose-500/30"
               >
                放弃
              </button>
            </span>
          )}
          <button
            type="button"
            disabled={!activeMap}
            onClick={() => {
              if (!activeMap) return
              const graph = deriveMapRoomGraph({
                geometry,
                width: activeMap.width,
                height: activeMap.height,
                cellSize: Math.max(8, activeMap.gridSize / 2),
              })
              setRoomSummary({
                rooms: graph.rooms.filter((room) => !room.touchesMapBoundary).length,
                sealed: graph.rooms.filter((room) => room.sealed).length,
              })
              onDiagnosticsEnabledChange(!diagnosticsEnabled)
            }}
            className={`rounded-md p-1 hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-30 ${
              diagnosticsEnabled ? 'bg-violet-500/25 text-violet-100' : 'text-violet-200'
            }`}
            title="重新分析由墙和门派生的房间图"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          {roomSummary && (
            <span className="text-[10px] text-violet-200" title="派生房间不会单独写入共享状态">
              房间 {roomSummary.rooms} · 密闭 {roomSummary.sealed}
            </span>
          )}
          {diagnosticsEnabled && diagnosticIssueCount > 0 && (
            <span className="rounded bg-rose-500/15 px-1 text-[10px] text-rose-200">
              关系问题 {diagnosticIssueCount}
            </span>
          )}
          {diagnosticsEnabled && diagnosticsTruncated && (
            <span className="text-[10px] text-amber-200">覆盖层已限流</span>
          )}
          <span className="text-[10px] text-slate-500">{count} 项</span>
          <button
            type="button"
            disabled={count === 0 || terrainEditingLocked}
            onClick={() => {
              if (confirm('清除当前地图的全部墙、门、窗户、障碍物和场景光源吗？')) clearMap(mapId)
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
            disabled={selectedTerrainRegionLocked}
            onChange={(event) => updateEntity(mapId, selectedEntity.id, { label: event.target.value.slice(0, 120) })}
            className="w-20 rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200 outline-none disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="几何名称"
          />
          {selectedEntity.kind !== 'light' && !selectedTerrainRegion && BLOCKING_FIELD_OPTIONS.map(({ field, label, help }) => (
            <label
              key={field}
              className="flex items-center gap-0.5 text-[10px] text-slate-300"
              title={help}
            >
              <input
                type="checkbox"
                disabled={selectedTerrainRegionLocked}
                checked={selectedEntity[field]}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { [field]: event.target.checked })}
              />
              {label}
            </label>
          ))}
          {selectedEntity.kind !== 'light' && !selectedTerrainRegion && <NumberField
            label="底高"
            help="阻挡体积下沿的绝对海拔。例如底高 0、高度 5 表示占据海拔 0—5 尺。"
            disabled={selectedTerrainRegionLocked}
            value={selectedEntity.baseHeightFeet}
            onChange={(baseHeightFeet) => updateEntity(mapId, selectedEntity.id, { baseHeightFeet })}
          />}
          {selectedEntity.kind !== 'light' && !selectedTerrainRegion && <NumberField
            label="高度"
            help="从底高向上的实体高度；它决定哪些海拔的视线、移动和效果线会与区域相交。"
            min={0}
            disabled={selectedTerrainRegionLocked}
            value={selectedEntity.heightFeet}
            onChange={(heightFeet) => updateEntity(mapId, selectedEntity.id, { heightFeet })}
          />}
          {selectedEntity.kind === 'wall' && (
            <select
              value={selectedEntity.material ?? 'stone'}
              onChange={(event) => updateEntity(mapId, selectedEntity.id, { material: event.target.value as MapGeometryWallMaterial })}
              className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
              title="墙体材质；嵌入的门窗会沿用该材质的墙框"
            >
              {Object.entries(WALL_MATERIAL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          )}
          {selectedEntity.kind === 'door' && (
            <>
              <select
                value={mapGeometryDoorOpenState(selectedEntity)}
                onChange={(event) => {
                  const openState = event.target.value as 'open' | 'closed'
                  const lockState = mapGeometryDoorLockState(selectedEntity)
                  updateEntity(mapId, selectedEntity.id, {
                    openState,
                    state: openState === 'open' ? 'open' : lockState === 'locked' ? 'locked' : 'closed',
                  })
                }}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                aria-label="门开关状态"
              >
                <option value="open">打开</option>
                <option value="closed">关闭</option>
              </select>
              <select
                value={mapGeometryDoorLockState(selectedEntity)}
                onChange={(event) => {
                  const lockState = event.target.value as 'unlocked' | 'locked' | 'jammed'
                  const openState = mapGeometryDoorOpenState(selectedEntity)
                  updateEntity(mapId, selectedEntity.id, {
                    lockState,
                    state: openState === 'open' ? 'open' : lockState === 'locked' ? 'locked' : 'closed',
                  })
                }}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                aria-label="门锁状态"
              >
                <option value="unlocked">未上锁</option>
                <option value="locked">已上锁</option>
                <option value="jammed">卡死</option>
              </select>
              <select
                value={selectedEntity.physicalState ?? 'intact'}
                onChange={(event) => {
                  const physicalState = event.target.value as 'intact' | 'broken' | 'destroyed'
                  updateEntity(mapId, selectedEntity.id, {
                    physicalState,
                    ...(physicalState === 'destroyed'
                      ? { openState: 'open', lockState: 'unlocked', state: 'open' }
                      : physicalState === 'broken'
                        ? { lockState: 'unlocked' }
                        : {}),
                  })
                }}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                aria-label="门完整状态"
              >
                <option value="intact">完好</option>
                <option value="broken">已破坏</option>
                <option value="destroyed">已摧毁</option>
              </select>
              <select
                value={selectedEntity.hinge ?? 'start'}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { hinge: event.target.value as 'start' | 'end' })}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="门轴位于墙洞哪一端"
              >
                <option value="start">起点门轴</option>
                <option value="end">终点门轴</option>
              </select>
              <select
                value={selectedEntity.swing ?? 'clockwise'}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { swing: event.target.value as 'clockwise' | 'counterclockwise' })}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="门打开时的旋转方向"
              >
                <option value="clockwise">顺时针开</option>
                <option value="counterclockwise">逆时针开</option>
              </select>
              <label className="flex items-center gap-0.5 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedEntity.secret}
                  onChange={(event) => updateEntity(mapId, selectedEntity.id, { secret: event.target.checked })}
                />
                暗门
              </label>
              {mapGeometryDoorLockState(selectedEntity) !== 'unlocked' && <LockKeyhole className="h-3.5 w-3.5 text-rose-300" />}
              <NumberField
                label="开锁 DC"
                min={0}
                value={selectedEntity.interaction?.lockPickDc ?? 15}
                onChange={(lockPickDc) => updateEntity(mapId, selectedEntity.id, {
                  interaction: {
                    lockPickDc,
                    breakDc: selectedEntity.interaction?.breakDc ?? 15,
                    secretDc: selectedEntity.interaction?.secretDc ?? 15,
                    requiresThievesTools: selectedEntity.interaction?.requiresThievesTools ?? true,
                    ...(selectedEntity.interaction?.keyItemId ? { keyItemId: selectedEntity.interaction.keyItemId } : {}),
                  },
                })}
              />
              <NumberField
                label="破门 DC"
                min={0}
                value={selectedEntity.interaction?.breakDc ?? 15}
                onChange={(breakDc) => updateEntity(mapId, selectedEntity.id, {
                  interaction: {
                    lockPickDc: selectedEntity.interaction?.lockPickDc ?? 15,
                    breakDc,
                    secretDc: selectedEntity.interaction?.secretDc ?? 15,
                    requiresThievesTools: selectedEntity.interaction?.requiresThievesTools ?? true,
                    ...(selectedEntity.interaction?.keyItemId ? { keyItemId: selectedEntity.interaction.keyItemId } : {}),
                  },
                })}
              />
              <NumberField
                label="暗门 DC"
                min={0}
                value={selectedEntity.interaction?.secretDc ?? 15}
                onChange={(secretDc) => updateEntity(mapId, selectedEntity.id, {
                  interaction: {
                    lockPickDc: selectedEntity.interaction?.lockPickDc ?? 15,
                    breakDc: selectedEntity.interaction?.breakDc ?? 15,
                    secretDc,
                    requiresThievesTools: selectedEntity.interaction?.requiresThievesTools ?? true,
                    ...(selectedEntity.interaction?.keyItemId ? { keyItemId: selectedEntity.interaction.keyItemId } : {}),
                  },
                })}
              />
              <label className="flex items-center gap-0.5 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedEntity.interaction?.requiresThievesTools ?? true}
                  onChange={(event) => updateEntity(mapId, selectedEntity.id, {
                    interaction: {
                      lockPickDc: selectedEntity.interaction?.lockPickDc ?? 15,
                      breakDc: selectedEntity.interaction?.breakDc ?? 15,
                      secretDc: selectedEntity.interaction?.secretDc ?? 15,
                      requiresThievesTools: event.target.checked,
                      ...(selectedEntity.interaction?.keyItemId ? { keyItemId: selectedEntity.interaction.keyItemId } : {}),
                    },
                  })}
                />
                需盗贼工具
              </label>
            </>
          )}
          {selectedEntity.kind === 'window' && (
            <>
              <select
                value={selectedEntity.windowType}
                onChange={(event) => {
                  const windowType = event.target.value as typeof selectedEntity.windowType
                  const defaults = windowType === 'shutters'
                    ? { blocksVision: true, blocksMovement: true, blocksLineOfEffect: true, cover: 'total' as const }
                    : windowType === 'glass'
                      ? { blocksVision: false, blocksMovement: true, blocksLineOfEffect: true, cover: 'total' as const }
                      : windowType === 'bars'
                        ? { blocksVision: false, blocksMovement: true, blocksLineOfEffect: false, cover: 'three-quarters' as const }
                        : { blocksVision: false, blocksMovement: true, blocksLineOfEffect: false, cover: 'half' as const }
                  updateEntity(mapId, selectedEntity.id, { windowType, ...defaults })
                }}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="窗户类型会设置默认阻挡，之后仍可单独调整"
              >
                <option value="glass">玻璃窗</option>
                <option value="bars">铁栏窗</option>
                <option value="shutters">封闭窗板</option>
                <option value="opening">开放窗口</option>
              </select>
              <select
                value={selectedEntity.windowState ?? 'closed'}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { windowState: event.target.value as 'closed' | 'open' | 'broken' })}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="打开或破损后不再阻挡视线和效果线"
              >
                <option value="closed">关闭</option>
                <option value="open">打开</option>
                <option value="broken">破损</option>
              </select>
              <select
                value={selectedEntity.cover ?? 'total'}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { cover: event.target.value as 'none' | 'half' | 'three-quarters' | 'total' })}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="穿过窗洞攻击时提供的 D&D 5e 掩护"
              >
                <option value="none">无掩护</option>
                <option value="half">半身掩护</option>
                <option value="three-quarters">四分之三掩护</option>
                <option value="total">全身掩护</option>
              </select>
            </>
          )}
          {(selectedEntity.kind === 'door' || selectedEntity.kind === 'window') && (
            <span className="text-[10px] text-slate-400">
              {selectedEntity.parentWallId
                ? `嵌入：${geometry.walls.find((wall) => wall.id === selectedEntity.parentWallId)?.label ?? '墙体'}`
                : '旧式独立几何'}
              {' · 拖动端点调整宽度，拖动中点沿墙移动'}
            </span>
          )}
          {selectedEntity.kind === 'obstacle' && (
            selectedTerrainRegion ? (
              <>
                <NumberField
                  label="区域高度"
                  help="所选地图格内地面的绝对高度；地图只显示选区外边界。"
                  disabled={selectedTerrainRegionLocked}
                  value={selectedEntity.terrainElevationFeet ?? 0}
                  onChange={(terrainElevationFeet) => updateEntity(mapId, selectedEntity.id, {
                    terrainElevationFeet: Math.max(-1_000, Math.min(10_000, terrainElevationFeet)),
                  })}
                />
                <span className="text-[10px] text-amber-200">
                  高度区始终只显示外边界；重新选格可建立新的高度区
                </span>
              </>
            ) : (
              <>
                <select
                  value={selectedEntity.cover}
                  onChange={(event) => updateEntity(mapId, selectedEntity.id, { cover: event.target.value as 'none' | 'half' | 'three-quarters' | 'total' })}
                  className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                  title="从攻击者到目标的射线穿过该区域时提供的 D&D 5e 掩护；半身 +2 AC，四分之三 +5 AC，全身掩护禁止直接命中。"
                >
                  <option value="none">无掩护</option>
                  <option value="half">半身 +2 AC</option>
                  <option value="three-quarters">四分之三 +5 AC</option>
                  <option value="total">全身掩护</option>
                </select>
                <NumberField
                  label="地形倍率"
                  help="进入并经过区域时的移动消耗倍率。1 为正常，2 为困难地形，3 表示每走 1 尺消耗 3 尺移动力。"
                  min={1}
                  value={selectedEntity.terrainCostMultiplier ?? 1}
                  onChange={(terrainCostMultiplier) => updateEntity(mapId, selectedEntity.id, {
                    terrainCostMultiplier: Math.max(1, terrainCostMultiplier),
                  })}
                />
                <NumberField
                  label="地形标高"
                  help="区域内可站立地面的绝对海拔，会生成等高线并参与高差、坠落和三维寻路；它与阻挡体积的底高不同。"
                  disabled={terrainEditingLocked}
                  value={selectedEntity.terrainElevationFeet ?? 0}
                  onChange={(terrainElevationFeet) => updateEntity(mapId, selectedEntity.id, {
                    terrainElevationFeet: Math.max(-1_000, Math.min(10_000, terrainElevationFeet)),
                  })}
                />
                <select
                  value={selectedEntity.traversal ?? 'ground'}
                  onChange={(event) => updateEntity(mapId, selectedEntity.id, {
                    traversal: event.target.value as 'ground' | 'climb' | 'swim',
                  })}
                  className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                  title="地面使用正常移动；攀爬或游泳会读取对应速度，没有对应速度时按双倍移动消耗。"
                >
                  <option value="ground">地面</option>
                  <option value="climb">攀爬</option>
                  <option value="swim">游泳</option>
                </select>
                <label className="flex items-center gap-0.5 text-[10px] text-violet-200" title="区域压制普通光源；黑暗视觉不能看穿，魔鬼视界、盲视与真视可以">
                  <input
                    type="checkbox"
                    checked={selectedEntity.magicalDarkness === true}
                    onChange={(event) => updateEntity(mapId, selectedEntity.id, {
                      magicalDarkness: event.target.checked,
                      darknessSpellLevel: event.target.checked ? selectedEntity.darknessSpellLevel ?? 2 : undefined,
                    })}
                  />
                  魔法黑暗
                </label>
                {selectedEntity.magicalDarkness && <NumberField label="环级" min={0} value={selectedEntity.darknessSpellLevel ?? 2} onChange={(darknessSpellLevel) => updateEntity(mapId, selectedEntity.id, { darknessSpellLevel: Math.min(9, darknessSpellLevel) })} />}
              </>
            )
          )}
          {selectedEntity.kind === 'obstacle' && (
            <button
              type="button"
              aria-expanded={showRegionHelp}
              onClick={() => setShowRegionHelp((current) => !current)}
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                showRegionHelp
                  ? 'bg-sky-500/20 text-sky-100'
                  : 'text-sky-300 hover:bg-sky-500/10'
              }`}
              title="查看区域地形和障碍物的使用方法"
            >
              {showRegionHelp ? '收起说明' : '如何使用？'}
            </button>
          )}
          {selectedEntity.kind === 'light' && (
            <>
              <select
                value={CAMPAIGN_LIGHT_PRESETS.some((preset) => preset.id === selectedEntity.sourceKind) ? selectedEntity.sourceKind : 'permanent'}
                onChange={(event) => updateEntity(
                  mapId,
                  selectedEntity.id,
                  campaignLightPresetPatch(event.target.value as CampaignLightPreset['id'], worldMinute),
                )}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="选择光源与燃烧时长"
              >
                {CAMPAIGN_LIGHT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
              <label className="flex items-center gap-0.5 text-[10px] text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedEntity.enabled}
                  onChange={(event) => {
                    const preset = CAMPAIGN_LIGHT_PRESETS.find((entry) => entry.id === selectedEntity.sourceKind)
                    updateEntity(mapId, selectedEntity.id,
                      event.target.checked && preset?.durationMinutes && campaignLightRemainingMinutes(selectedEntity, worldMinute) === 0
                        ? campaignLightPresetPatch(preset.id, worldMinute)
                        : { enabled: event.target.checked })
                  }}
                />
                开启
              </label>
              <NumberField label="明亮" min={0} value={selectedEntity.brightRadiusFeet} onChange={(brightRadiusFeet) => updateEntity(mapId, selectedEntity.id, { brightRadiusFeet })} />
              <NumberField label="微光" min={0} value={selectedEntity.dimRadiusFeet} onChange={(dimRadiusFeet) => updateEntity(mapId, selectedEntity.id, { dimRadiusFeet })} />
              <NumberField
                label="离地"
                min={0}
                value={selectedLightHeightAboveGround}
                onChange={(heightAboveGround) => updateEntity(mapId, selectedEntity.id, {
                  elevationFeet: selectedLightGroundElevation + heightAboveGround,
                })}
              />
              <span className="text-[10px] text-slate-500">
                海拔 {selectedLightElevation > 0 ? '+' : ''}{selectedLightElevation} 尺
              </span>
              <span className="text-[10px] text-slate-500">拖动地图中心点可改位置</span>
              <input
                type="color"
                value={selectedEntity.color}
                onChange={(event) => updateEntity(mapId, selectedEntity.id, { color: event.target.value })}
                className="h-5 w-6 rounded border border-white/10 bg-transparent"
                title="场景光源颜色"
              />
              {campaignLightRemainingMinutes(selectedEntity, worldMinute) != null && (
                <span className="text-[10px] text-amber-300">
                  剩余 {formatCampaignDuration(campaignLightRemainingMinutes(selectedEntity, worldMinute) ?? 0)}
                </span>
              )}
            </>
          )}
          {selectedEntity.kind !== 'door' && selectedEntity.kind !== 'window' && <button
            type="button"
            disabled={selectedTerrainRegionLocked}
            onClick={() => duplicateEntity(mapId, selectedEntity.id)}
            className="rounded p-1 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            title="复制选中几何"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>}
          <button
            type="button"
            disabled={selectedTerrainRegionLocked}
            onClick={() => removeEntity(mapId, selectedEntity.id)}
            className="rounded p-1 text-rose-300 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"
            title="删除选中几何"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {editMode && showRegionHelp && selectedEntity?.kind === 'obstacle' && (
        <section className="basis-full rounded-md border border-sky-400/20 bg-sky-500/[0.07] px-2.5 py-2 text-[10px] leading-5 text-slate-300">
          <div className="font-semibold text-sky-100">区域地形／障碍物使用方法</div>
          <ol className="mt-1 grid list-decimal gap-x-5 pl-4 md:grid-cols-3">
            <li>在“几何”下拉菜单选择“区域／障碍物”，按住鼠标拖出区域。</li>
            <li>切回“选择”，点击区域；上方这一排参数会编辑当前选中的区域。</li>
            <li>完成后可切换“预览玩家视野”检查遮挡、移动与光照结果。</li>
          </ol>
          <div className="mt-1 grid gap-x-5 gap-y-1 border-t border-white/10 pt-1 md:grid-cols-2 xl:grid-cols-3">
            <span><b className="text-slate-100">底高＋高度：</b>定义障碍物的立体体积，例如 0＋5 尺的桌子。</span>
            <span><b className="text-slate-100">地形标高：</b>定义脚下地面的绝对海拔，并显示等高线；它不是障碍物高度。</span>
            <span><b className="text-slate-100">地形倍率：</b>1 为正常，2 为困难地形；攀爬／游泳还会读取相应移动速度。</span>
            <span><b className="text-slate-100">掩护：</b>只在攻击射线确实穿过区域时生效，不会无条件提高目标 AC。</span>
            <span><b className="text-slate-100">魔法黑暗：</b>压制普通光源；环级用于法术光照与黑暗互相解除的判定。</span>
            <span><b className="text-slate-100">纯山坡／高台：</b>使用“格子高度”单击或拖动选择地图格；完成后仅显示合并选区的外边界。</span>
          </div>
        </section>
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
            label={selectedToken.type === 'player' ? '海拔' : '离地'}
            min={selectedToken.type === 'player' ? -1_000 : 0}
            disabled={selectedToken.type === 'player'}
            value={selectedToken.type === 'player' ? selectedTokenElevation : selectedTokenHeightAboveGround}
            onChange={(value) => updateToken(mapId, selectedToken.id, {
              elevationFeet: selectedToken.type === 'player'
                ? selectedTokenElevation
                : selectedTokenGroundElevation + value,
            })}
          />
          <span className="text-[10px] text-slate-500">
            地面 {selectedTokenGroundElevation > 0 ? '+' : ''}{selectedTokenGroundElevation} 尺
            {selectedToken.type !== 'player' && ` · 海拔 ${selectedTokenElevation > 0 ? '+' : ''}${selectedTokenElevation} 尺`}
          </span>
          {selectedToken.type === 'player' && (
            <>
              <NumberField
                label="视野"
                min={0}
                value={selectedToken.visionRangeFeet ?? geometry.vision.defaultRangeFeet}
                onChange={(visionRangeFeet) => updateToken(mapId, selectedToken.id, { visionRangeFeet })}
              />
              <NumberField
                label="黑暗视觉"
                min={0}
                value={selectedToken.darkvisionRangeFeet ?? 0}
                onChange={(darkvisionRangeFeet) => updateToken(mapId, selectedToken.id, { darkvisionRangeFeet })}
              />
              <NumberField label="盲视" min={0} value={selectedToken.blindsightRangeFeet ?? 0} onChange={(blindsightRangeFeet) => updateToken(mapId, selectedToken.id, { blindsightRangeFeet })} />
              <NumberField label="震颤" min={0} value={selectedToken.tremorsenseRangeFeet ?? 0} onChange={(tremorsenseRangeFeet) => updateToken(mapId, selectedToken.id, { tremorsenseRangeFeet })} />
              <NumberField label="真视" min={0} value={selectedToken.truesightRangeFeet ?? 0} onChange={(truesightRangeFeet) => updateToken(mapId, selectedToken.id, { truesightRangeFeet })} />
              <label className="flex items-center gap-0.5 text-[10px] text-violet-200">
                <input type="checkbox" checked={selectedToken.canSeeMagicalDarkness === true} onChange={(event) => updateToken(mapId, selectedToken.id, { canSeeMagicalDarkness: event.target.checked || undefined })} />
                魔法黑暗视界
              </label>
            </>
          )}
          <label className="flex items-center gap-0.5 text-[10px] text-slate-300">
            <input
              type="checkbox"
              checked={selectedToken.lightSource?.enabled ?? false}
              onChange={(event) => {
                const existing = selectedToken.lightSource
                const preset = CAMPAIGN_LIGHT_PRESETS.find((entry) => entry.id === existing?.sourceKind)
                updateToken(mapId, selectedToken.id, {
                  lightSource: event.target.checked && preset?.durationMinutes && campaignLightRemainingMinutes(existing, worldMinute) === 0
                    ? campaignLightPresetPatch(preset.id, worldMinute)
                    : {
                        ...existing,
                        enabled: event.target.checked,
                        brightRadiusFeet: existing?.brightRadiusFeet ?? 20,
                        dimRadiusFeet: existing?.dimRadiusFeet ?? 20,
                        color: existing?.color ?? '#fbbf24',
                      },
                })
              }}
            />
            光源
          </label>
          {selectedToken.lightSource?.enabled && (
            <>
              <select
                value={CAMPAIGN_LIGHT_PRESETS.some((preset) => preset.id === selectedToken.lightSource?.sourceKind) ? selectedToken.lightSource.sourceKind : 'permanent'}
                onChange={(event) => updateToken(mapId, selectedToken.id, {
                  lightSource: campaignLightPresetPatch(event.target.value as CampaignLightPreset['id'], worldMinute),
                })}
                className="rounded border border-white/10 bg-void-900 px-1 py-0.5 text-[10px] text-slate-200"
                title="选择携带光源与燃烧时长"
              >
                {CAMPAIGN_LIGHT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
              </select>
              <NumberField
                label="明亮"
                min={0}
                value={selectedToken.lightSource.brightRadiusFeet}
                onChange={(brightRadiusFeet) => updateToken(mapId, selectedToken.id, {
                  lightSource: { ...selectedToken.lightSource!, brightRadiusFeet },
                })}
              />
              <NumberField
                label="微光"
                min={0}
                value={selectedToken.lightSource.dimRadiusFeet}
                onChange={(dimRadiusFeet) => updateToken(mapId, selectedToken.id, {
                  lightSource: { ...selectedToken.lightSource!, dimRadiusFeet },
                })}
              />
              <input
                type="color"
                value={selectedToken.lightSource.color}
                onChange={(event) => updateToken(mapId, selectedToken.id, {
                  lightSource: { ...selectedToken.lightSource!, color: event.target.value },
                })}
                className="h-5 w-6 rounded border border-white/10 bg-transparent"
                title="光源颜色"
              />
              {campaignLightRemainingMinutes(selectedToken.lightSource, worldMinute) != null && (
                <span className="text-[10px] text-amber-300">
                  剩余 {formatCampaignDuration(campaignLightRemainingMinutes(selectedToken.lightSource, worldMinute) ?? 0)}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
