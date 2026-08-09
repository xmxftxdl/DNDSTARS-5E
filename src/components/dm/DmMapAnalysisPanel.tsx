import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Download,
  Eraser,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  ScanLine,
  Sparkles,
} from 'lucide-react'
import type { AiProviderSelectionV1 } from '../../../shared/ai-provider.mjs'
import {
  aiMapAnalysisWallCandidates,
  analyzeMapImageWithAi,
  mapImageAiAnalysisErrorMessage,
  type AiMapAnalysisV1,
} from '../../lib/mapImageAiAnalysis'
import {
  consolidateWallDetectionCandidates,
  detectWallsFromImageFile,
  rankWallDetectionCandidates,
  wallDetectionCandidatesToGeometry,
  type WallDetectionCandidate,
} from '../../lib/mapImageGeometryDetection'
import { createEmptyMapGeometry } from '../../lib/mapGeometry'
import { uvttDownloadBlob } from '../../lib/uvttExport'

type Notice = { kind: 'success' | 'error' | 'info'; text: string }

function fileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('image-read-failed'))
    reader.onerror = () => reject(reader.error ?? new Error('image-read-failed'))
    reader.readAsDataURL(file)
  })
}

function downloadName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim().replace(/[\\/:*?"<>|]+/g, '-') || 'battlemap'
  return `${base}.uvtt`
}

const MAP_TYPE_LABELS: Record<AiMapAnalysisV1['mapType'], string> = {
  battlemap: '战斗地图',
  'regional-map': '区域地图',
  illustration: '场景插画',
  unknown: '类型不确定',
}

export default function DmMapAnalysisPanel({
  aiProviderSelection,
}: {
  aiProviderSelection: AiProviderSelectionV1
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const [candidates, setCandidates] = useState<WallDetectionCandidate[]>([])
  const [edgeThreshold, setEdgeThreshold] = useState(22)
  const [minimumRunRatio, setMinimumRunRatio] = useState(0.025)
  const [focusOnDominant, setFocusOnDominant] = useState(false)
  const [pixelsPerGrid, setPixelsPerGrid] = useState(70)
  const [feetPerCell, setFeetPerCell] = useState(5)
  const [localBusy, setLocalBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [analysis, setAnalysis] = useState<AiMapAnalysisV1 | null>(null)
  const [analysisModel, setAnalysisModel] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const runLocalDetection = async (
    file = sourceFile,
    size = imageSize,
  ) => {
    if (!file || size.width <= 0 || size.height <= 0 || localBusy) return
    setLocalBusy(true)
    setNotice({ kind: 'info', text: '正在后台分析地图边缘与连续墙线……' })
    try {
      const detected = await detectWallsFromImageFile(file, size, {
        edgeThreshold,
        minimumRunRatio,
        focusMode: focusOnDominant ? 'dominant' : 'all',
      })
      setCandidates(detected)
      setNotice(detected.length > 0
        ? { kind: 'success', text: `已生成 ${detected.length} 条墙体候选。点击错误的青色线段可以删除。` }
        : { kind: 'error', text: '没有识别出可靠墙线；请降低边缘阈值或最短线比例后重算。' })
    } catch (error) {
      setNotice({ kind: 'error', text: `地图墙体识别失败：${error instanceof Error ? error.message : '图片无效'}` })
    } finally {
      setLocalBusy(false)
    }
  }

  const loadImage = async (file: File) => {
    setNotice(null)
    setAnalysis(null)
    setAnalysisModel('')
    setCandidates([])
    const nextUrl = URL.createObjectURL(file)
    setPreviewUrl(nextUrl)
    setSourceFile(file)
    try {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close()
      setImageSize(size)
      await runLocalDetection(file, size)
    } catch (error) {
      setNotice({ kind: 'error', text: `无法读取地图图片：${error instanceof Error ? error.message : '图片格式无效'}` })
    }
  }

  const runAiAnalysis = async () => {
    if (!sourceFile || aiBusy) return
    setAiBusy(true)
    setNotice({ kind: 'info', text: '视觉模型正在理解地图，并排除网格、家具和装饰边缘……' })
    try {
      const result = await analyzeMapImageWithAi({ file: sourceFile, selection: aiProviderSelection })
      const semanticCandidates = aiMapAnalysisWallCandidates(result.analysis, imageSize.width, imageSize.height)
      const merged = rankWallDetectionCandidates(consolidateWallDetectionCandidates(
        [...candidates, ...semanticCandidates],
        Math.max(4, Math.min(imageSize.width, imageSize.height) * 0.004),
      ))
      setAnalysis(result.analysis)
      setAnalysisModel(result.modelId)
      setCandidates(merged)
      if (result.analysis.grid.visible && result.analysis.grid.confidence >= 0.55 && result.analysis.grid.estimatedPixelsPerGrid >= 8) {
        setPixelsPerGrid(Math.round(result.analysis.grid.estimatedPixelsPerGrid))
      }
      setNotice({
        kind: 'success',
        text: `AI 判定为${MAP_TYPE_LABELS[result.analysis.mapType]}，新增或合并 ${semanticCandidates.length} 条语义墙线；仍需 DM 审核。`,
      })
    } catch (error) {
      setNotice({ kind: 'error', text: mapImageAiAnalysisErrorMessage(error) })
    } finally {
      setAiBusy(false)
    }
  }

  const exportUvtt = async () => {
    if (!sourceFile || imageSize.width <= 0 || imageSize.height <= 0 || candidates.length === 0 || exportBusy) return
    setExportBusy(true)
    try {
      const geometry = wallDetectionCandidatesToGeometry(
        createEmptyMapGeometry(`prep-map:${Date.now()}`),
        candidates,
      )
      const imageDataUrl = await fileDataUrl(sourceFile)
      const blob = uvttDownloadBlob(geometry, {
        width: imageSize.width,
        height: imageSize.height,
        pixelsPerGrid,
        feetPerCell,
        imageDataUrl,
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = downloadName(sourceFile.name)
      anchor.click()
      URL.revokeObjectURL(url)
      setNotice({ kind: 'success', text: `已导出 ${anchor.download}，包含原图和 ${candidates.length} 条审核后墙线。` })
    } catch (error) {
      setNotice({ kind: 'error', text: `UVTT 导出失败：${error instanceof Error ? error.message : '未知错误'}` })
    } finally {
      setExportBusy(false)
    }
  }

  return (
    <section aria-labelledby="map-ai-heading" className="mb-5 overflow-hidden rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.035]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 p-5">
        <div className="flex gap-3">
          <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-300"><ScanLine className="h-5 w-5" /></div>
          <div>
            <h2 id="map-ai-heading" className="font-semibold text-slate-100">地图智能识别与 UVTT 转换</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
              上传 PNG、JPEG 或 WebP，先由本地几何内核查找墙线，再可选用视觉模型做语义增强。候选不会自动写入战役，必须由 DM 审核后导出。
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">可测试</span>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {!sourceFile ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-300/25 bg-black/15 px-6 text-center hover:bg-cyan-500/[0.04]"
            >
              <ImagePlus className="h-9 w-9 text-cyan-300" />
              <strong className="mt-3 text-sm text-slate-200">选择一张地图图片</strong>
              <span className="mt-1 text-xs text-slate-500">图片只在浏览器和所选模型处理，不会直接改写战役地图</span>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img src={previewUrl} alt="待识别地图预览" className="block max-h-[68vh] w-full object-contain" />
              {imageSize.width > 0 && imageSize.height > 0 && (
                <svg
                  aria-label="墙体识别候选覆盖层"
                  viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
                  preserveAspectRatio="xMidYMid meet"
                  className="absolute inset-0 h-full w-full"
                >
                  {candidates.map((candidate, index) => (
                    <line
                      key={`${index}:${candidate.a.x}:${candidate.a.y}:${candidate.b.x}:${candidate.b.y}`}
                      x1={candidate.a.x}
                      y1={candidate.a.y}
                      x2={candidate.b.x}
                      y2={candidate.b.y}
                      vectorEffect="non-scaling-stroke"
                      stroke="rgb(34 211 238)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      opacity={Math.max(0.55, candidate.confidence)}
                      className="cursor-pointer hover:stroke-rose-400"
                      onClick={() => setCandidates((current) => current.filter((_, candidateIndex) => candidateIndex !== index))}
                    />
                  ))}
                </svg>
              )}
              <span className="pointer-events-none absolute bottom-2 left-2 rounded-lg border border-cyan-300/20 bg-black/75 px-2 py-1 text-[10px] text-cyan-100">
                青色：候选墙 · 点击线段删除
              </span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void loadImage(file)
            }}
          />
        </div>

        <aside className="min-w-0 space-y-3">
          <div className="rounded-xl border border-white/8 bg-black/15 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">识别结果</span>
              <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">{candidates.length} 条墙线</span>
            </div>
            {sourceFile && (
              <p className="mt-2 truncate text-[10px] text-slate-500" title={sourceFile.name}>
                {sourceFile.name} · {imageSize.width}×{imageSize.height}
              </p>
            )}
            {analysis && (
              <div className="mt-3 rounded-lg border border-violet-400/15 bg-violet-500/[0.05] p-2.5 text-[10px] leading-4 text-slate-400">
                <p><strong className="text-violet-200">{MAP_TYPE_LABELS[analysis.mapType]}</strong> · {analysis.summary}</p>
                <p className="mt-1">模型：{analysisModel} · 网格置信度 {Math.round(analysis.grid.confidence * 100)}%</p>
                {analysis.warnings.length > 0 && <p className="mt-1 text-amber-200/80">{analysis.warnings.join('；')}</p>}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-white/8 bg-black/15 p-3 text-[10px] text-slate-500">
            <label className="block">
              <span className="flex justify-between"><span>边缘敏感度</span><span>{edgeThreshold}</span></span>
              <input type="range" min={8} max={80} step={2} value={edgeThreshold} onChange={(event) => setEdgeThreshold(Number(event.currentTarget.value))} className="mt-1 w-full accent-cyan-400" />
            </label>
            <label className="block">
              <span className="flex justify-between"><span>最短墙线</span><span>{Math.round(minimumRunRatio * 1000) / 10}%</span></span>
              <input type="range" min={0.01} max={0.1} step={0.005} value={minimumRunRatio} onChange={(event) => setMinimumRunRatio(Number(event.currentTarget.value))} className="mt-1 w-full accent-cyan-400" />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={focusOnDominant} onChange={(event) => setFocusOnDominant(event.currentTarget.checked)} className="accent-cyan-400" />
              仅分析画面中央主体
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!sourceFile || localBusy} onClick={() => void runLocalDetection()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-300/15 bg-cyan-500/8 px-3 py-2.5 text-xs font-semibold text-cyan-100 disabled:opacity-40">
              {localBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}本地重算
            </button>
            <button type="button" disabled={!sourceFile || aiBusy} onClick={() => void runAiAnalysis()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-300/20 bg-violet-500/10 px-3 py-2.5 text-xs font-semibold text-violet-100 disabled:opacity-40">
              {aiBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}AI 增强
            </button>
            <button type="button" disabled={candidates.length === 0} onClick={() => setCandidates([])} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300/15 px-3 py-2.5 text-xs text-rose-200 disabled:opacity-40">
              <Eraser className="h-3.5 w-3.5" />清空墙线
            </button>
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-slate-300">
              <ImagePlus className="h-3.5 w-3.5" />更换图片
            </button>
          </div>

          <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.035] p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[10px] text-slate-500">
                每格像素
                <input aria-label="UVTT 每格像素" type="number" min={8} max={4096} value={pixelsPerGrid} onChange={(event) => setPixelsPerGrid(Math.max(8, Number(event.currentTarget.value) || 8))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-slate-100" />
              </label>
              <label className="text-[10px] text-slate-500">
                每格尺数
                <input aria-label="UVTT 每格尺数" type="number" min={1} max={100} value={feetPerCell} onChange={(event) => setFeetPerCell(Math.max(1, Number(event.currentTarget.value) || 5))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 text-xs text-slate-100" />
              </label>
            </div>
            <button type="button" disabled={!sourceFile || candidates.length === 0 || exportBusy} onClick={() => void exportUvtt()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-40">
              {exportBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}导出含原图的 UVTT
            </button>
          </div>

          {notice && (
            <p role="status" className={`rounded-xl border px-3 py-2 text-[10px] leading-4 ${notice.kind === 'success'
              ? 'border-emerald-400/15 bg-emerald-500/[0.05] text-emerald-200'
              : notice.kind === 'error'
                ? 'border-rose-400/15 bg-rose-500/[0.05] text-rose-200'
                : 'border-sky-400/15 bg-sky-500/[0.05] text-sky-200'}`}
            >
              {notice.text}
            </p>
          )}
          <p className="flex gap-1.5 text-[10px] leading-4 text-slate-600">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />AI 与本地识别都只生成候选；错误墙线必须先删除。当前自动转换不会猜测门、窗和光源。
          </p>
        </aside>
      </div>
    </section>
  )
}
