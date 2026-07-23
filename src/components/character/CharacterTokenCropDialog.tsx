import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, RotateCcw, X } from 'lucide-react'
import {
  CHARACTER_INITIATIVE_PORTRAIT_HEIGHT,
  CHARACTER_INITIATIVE_PORTRAIT_WIDTH,
  DEFAULT_CHARACTER_INITIATIVE_CROP,
  DEFAULT_CHARACTER_TOKEN_CROP,
  clampCharacterTokenCrop,
  createCharacterInitiativePortraitDataUrl,
  createCharacterTokenPortraitDataUrl,
  drawCharacterPortraitCrop,
  type CharacterTokenCrop,
} from '../../lib/characterPortrait'

const TOKEN_PREVIEW_SIZE = 320

export default function CharacterPortraitCropDialog({
  portrait,
  name,
  mode,
  onCancel,
  onConfirm,
}: {
  portrait: string
  name: string
  mode: 'token' | 'initiative'
  onCancel: () => void
  onConfirm: (portrait: string) => void
}) {
  const initiativeMode = mode === 'initiative'
  const previewWidth = initiativeMode ? CHARACTER_INITIATIVE_PORTRAIT_WIDTH : TOKEN_PREVIEW_SIZE
  const previewHeight = initiativeMode ? CHARACTER_INITIATIVE_PORTRAIT_HEIGHT : TOKEN_PREVIEW_SIZE
  const defaultCrop = initiativeMode ? DEFAULT_CHARACTER_INITIATIVE_CROP : DEFAULT_CHARACTER_TOKEN_CROP
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [crop, setCrop] = useState<CharacterTokenCrop>(defaultCrop)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      setReady(true)
    }
    image.onerror = () => setError('无法读取这张人物立绘。')
    image.src = portrait
    return () => {
      imageRef.current = null
    }
  }, [portrait])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || !image || !ready) return
    drawCharacterPortraitCrop(context, image, crop, previewWidth, previewHeight)
  }, [crop, previewHeight, previewWidth, ready])

  const moveCrop = (dx: number, dy: number) => {
    const image = imageRef.current
    if (!image) return
    const coverScale = Math.max(previewWidth / image.naturalWidth, previewHeight / image.naturalHeight)
    const scale = coverScale * crop.zoom
    setCrop((current) => clampCharacterTokenCrop({
      ...current,
      centerX: current.centerX - dx / (image.naturalWidth * scale),
      centerY: current.centerY - dy / (image.naturalHeight * scale),
    }))
  }

  return createPortal(
    <div className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={initiativeMode ? '裁切先攻立绘' : '裁切地图 Token'}
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-void-950 p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-slate-100">{initiativeMode ? '裁切先攻立绘' : '裁切地图 Token'}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {initiativeMode
                ? `拖动完整立绘，选择 ${name || '角色'} 在先攻栏中显示的区域。滚轮或滑杆可以缩放。`
                : `拖动完整立绘，把 ${name || '角色'} 的头部或你想展示的部位置于圆圈内。滚轮或滑杆可以缩放。`}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="关闭">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          <div className={`relative max-w-full touch-none select-none overflow-hidden bg-black shadow-[0_0_0_10px_rgba(255,255,255,0.04)] ring-2 ring-arcane-300/80 ${initiativeMode ? 'h-[376px] w-72 rounded-lg' : 'h-80 w-80 rounded-full'}`}>
            <canvas
              ref={canvasRef}
              width={previewWidth}
              height={previewHeight}
              className="h-full w-full cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
              }}
              onPointerMove={(event) => {
                const drag = dragRef.current
                if (!drag || drag.pointerId !== event.pointerId) return
                moveCrop(event.clientX - drag.x, event.clientY - drag.y)
                dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
              }}
              onPointerUp={(event) => {
                if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
              }}
              onPointerCancel={() => { dragRef.current = null }}
              onWheel={(event) => {
                event.preventDefault()
                setCrop((current) => clampCharacterTokenCrop({
                  ...current,
                  zoom: current.zoom + (event.deltaY < 0 ? 0.1 : -0.1),
                }))
              }}
            />
            <div className={`pointer-events-none absolute inset-3 border border-dashed border-white/55 ${initiativeMode ? 'rounded-md' : 'rounded-full'}`} />
            {!ready && !error && <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">正在读取立绘…</div>}
          </div>
        </div>

        <label className="mt-5 block text-xs font-medium text-slate-400">
          缩放 {crop.zoom.toFixed(2)}×
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={crop.zoom}
            onChange={(event) => setCrop((current) => ({ ...current, zoom: Number(event.target.value) }))}
            className="mt-2 w-full accent-violet-500"
          />
        </label>
        {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={() => setCrop(defaultCrop)}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
          >
            <RotateCcw className="h-4 w-4" />重置
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">取消</button>
            <button
              type="button"
              disabled={!ready || !!error}
              onClick={() => {
                const image = imageRef.current
                if (!image) return
                try {
                  onConfirm(initiativeMode
                    ? createCharacterInitiativePortraitDataUrl(image, crop)
                    : createCharacterTokenPortraitDataUrl(image, crop))
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : `无法生成${initiativeMode ? '先攻立绘' : '地图 Token'}。`)
                }
              }}
              className="flex items-center gap-2 rounded-lg bg-arcane-500 px-4 py-2 text-sm font-semibold text-white hover:bg-arcane-400 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />使用此取景
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
