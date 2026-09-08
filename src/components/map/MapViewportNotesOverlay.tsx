import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { GripHorizontal, Image as ImageIcon, Loader2, Trash2, X } from 'lucide-react'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
import {
  createMapViewportImageNote,
  MAP_VIEWPORT_NOTE_LIMIT,
  MAP_VIEWPORT_NOTE_TEXT_LIMIT,
  type MapViewportNote,
} from '../../lib/mapViewportNotes'

interface MapViewportNotesOverlayProps {
  mapId: string
  notes: readonly MapViewportNote[]
  editable: boolean
  onChange: (notes: MapViewportNote[]) => void
  onError?: (message: string) => void
}

interface DragState {
  noteId: string
  pointerId: number
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  noteWidth: number
  noteHeight: number
  targetZIndex: number
  pendingOffsetX: number
  pendingOffsetY: number
  frameId: number | null
  moved: boolean
  element: HTMLElement | null
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

async function clipboardImageBlob(file: File): Promise<{
  blob: Blob
  width: number
  height: number
}> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 1_600 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('image-canvas-unavailable')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error('image-encoding-failed')),
        'image/webp',
        0.86,
      )
    })
    return { blob, width: bitmap.width, height: bitmap.height }
  } finally {
    bitmap.close()
  }
}

function SharedViewportImage({ imageId, imageName }: { imageId: string; imageName?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    let disposed = false
    let objectUrl = ''
    void browserSharedRoomService.getSharedImage(imageId).then((blob) => {
      if (disposed) return
      if (!blob) {
        setMissing(true)
        return
      }
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => {
      if (!disposed) setMissing(true)
    })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageId])
  if (url) return <img src={url} alt={imageName ?? '地图贴图'} draggable={false} className="h-full w-full select-none object-contain" />
  return (
    <div className="flex h-full w-full items-center justify-center gap-2 text-xs text-amber-100/60">
      <ImageIcon className="h-4 w-4" />
      {missing ? '图片无法载入' : '正在载入图片…'}
    </div>
  )
}

export default function MapViewportNotesOverlay({
  mapId,
  notes,
  editable,
  onChange,
  onError,
}: MapViewportNotesOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const notesRef = useRef(notes)
  const [uploading, setUploading] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  const replaceNote = useCallback((noteId: string, patch: Partial<MapViewportNote>) => {
    if (!editable) return
    const now = Date.now()
    onChange(notesRef.current.map((note) => note.id === noteId
      ? { ...note, ...patch, id: note.id, kind: note.kind, updatedAt: now }
      : note))
  }, [editable, onChange])

  const bringToFront = useCallback((noteId: string) => {
    const note = notesRef.current.find((candidate) => candidate.id === noteId)
    if (!editable || !note) return
    const maximum = Math.max(0, ...notesRef.current.map((candidate) => candidate.zIndex))
    if (note.zIndex >= maximum) return
    if (maximum < 10_000) {
      replaceNote(noteId, { zIndex: maximum + 1 })
      return
    }
    const ordered = [...notesRef.current]
      .sort((left, right) => left.zIndex - right.zIndex)
      .filter((candidate) => candidate.id !== noteId)
    onChange([...ordered, note].map((candidate, index) => ({
      ...candidate,
      zIndex: index + 1,
      updatedAt: candidate.id === noteId ? Date.now() : candidate.updatedAt,
    })))
  }, [editable, onChange, replaceNote])

  const removeNote = useCallback((noteId: string) => {
    if (!editable) return
    const note = notesRef.current.find((candidate) => candidate.id === noteId)
    setSelectedNoteId((current) => current === noteId ? null : current)
    onChange(notesRef.current.filter((candidate) => candidate.id !== noteId))
    if (note?.imageId) void browserSharedRoomService.deleteSharedImage(note.imageId)
  }, [editable, onChange])

  useEffect(() => {
    if (!editable) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element) || !target.closest('[data-map-viewport-note]')) {
        setSelectedNoteId(null)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!selectedNoteId || (event.key !== 'Backspace' && event.key !== 'Delete')) return
      const target = event.target
      if (target instanceof Element && target.matches('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      removeNote(selectedNoteId)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [editable, removeNote, selectedNoteId])

  const pasteImage = useCallback(async (file: File) => {
    if (!editable || uploading) return
    if (notesRef.current.length >= MAP_VIEWPORT_NOTE_LIMIT) {
      onError?.(`当前地图最多保留 ${MAP_VIEWPORT_NOTE_LIMIT} 个便签或贴图。`)
      return
    }
    setUploading(true)
    let imageId = ''
    try {
      const prepared = await clipboardImageBlob(file)
      imageId = `map-note-image-${crypto.randomUUID()}`
      const saved = await browserSharedRoomService.putSharedImage(imageId, prepared.blob)
      if (!saved) throw new Error('shared-image-save-rejected')
      const next = createMapViewportImageNote(notesRef.current, {
        imageId,
        imageName: file.name || '剪贴板图片',
        width: prepared.width,
        height: prepared.height,
      })
      onChange([...notesRef.current, next])
    } catch (error) {
      if (imageId) void browserSharedRoomService.deleteSharedImage(imageId)
      console.error('地图贴图保存失败', error)
      onError?.('图片粘贴失败，请确认图片格式和房间连接后重试。')
    } finally {
      setUploading(false)
    }
  }, [editable, onChange, onError, uploading])

  useEffect(() => {
    if (!editable) return
    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      const editingOutsideOverlay = target?.matches('input, textarea, [contenteditable="true"]') &&
        !target.closest('[data-map-viewport-note]')
      if (editingOutsideOverlay) return
      const item = [...(event.clipboardData?.items ?? [])].find((candidate) => candidate.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return
      event.preventDefault()
      void pasteImage(file)
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editable, mapId, pasteImage])

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, note: MapViewportNote) => {
    if (!editable) return
    event.preventDefault()
    event.stopPropagation()
    setSelectedNoteId(note.id)
    event.currentTarget.setPointerCapture(event.pointerId)
    const element = event.currentTarget.closest<HTMLElement>('[data-map-viewport-note]')
    const maximumZIndex = Math.max(0, ...notesRef.current.map((candidate) => candidate.zIndex))
    const targetZIndex = note.zIndex >= maximumZIndex
      ? note.zIndex
      : Math.min(10_000, maximumZIndex + 1)
    if (element) {
      element.style.zIndex = String(targetZIndex)
      element.style.willChange = 'transform'
      element.style.backdropFilter = 'none'
    }
    dragRef.current = {
      noteId: note.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: note.x,
      startY: note.y,
      currentX: note.x,
      currentY: note.y,
      noteWidth: note.width,
      noteHeight: note.height,
      targetZIndex,
      pendingOffsetX: 0,
      pendingOffsetY: 0,
      frameId: null,
      moved: false,
      element,
    }
  }

  const continueDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    const bounds = overlayRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== event.pointerId || !bounds?.width || !bounds.height) return
    const x = clamp(
      drag.startX + (event.clientX - drag.startClientX) / bounds.width,
      drag.noteWidth / 2 / bounds.width,
      1 - drag.noteWidth / 2 / bounds.width,
    )
    const y = clamp(
      drag.startY + (event.clientY - drag.startClientY) / bounds.height,
      drag.noteHeight / 2 / bounds.height,
      1 - drag.noteHeight / 2 / bounds.height,
    )
    drag.currentX = x
    drag.currentY = y
    drag.moved ||= Math.abs(event.clientX - drag.startClientX) > 1 || Math.abs(event.clientY - drag.startClientY) > 1
    drag.pendingOffsetX = (x - drag.startX) * bounds.width
    drag.pendingOffsetY = (y - drag.startY) * bounds.height
    if (!drag.element || drag.frameId != null) return
    drag.frameId = window.requestAnimationFrame(() => {
      drag.frameId = null
      if (dragRef.current !== drag || !drag.element) return
      drag.element.style.transform = `translate3d(${drag.pendingOffsetX}px, ${drag.pendingOffsetY}px, 0)`
    })
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (drag.frameId != null) window.cancelAnimationFrame(drag.frameId)
    if (drag.element) {
      drag.element.style.transform = ''
      drag.element.style.willChange = ''
      drag.element.style.backdropFilter = ''
      drag.element.style.left = `calc(${drag.currentX * 100}% - ${drag.noteWidth / 2}px)`
      drag.element.style.top = `calc(${drag.currentY * 100}% - ${drag.noteHeight / 2}px)`
    }
    if (drag.moved || drag.targetZIndex !== notesRef.current.find((note) => note.id === drag.noteId)?.zIndex) {
      replaceNote(drag.noteId, {
        x: drag.currentX,
        y: drag.currentY,
        zIndex: drag.targetZIndex,
      })
    }
  }

  return (
    <div
      ref={overlayRef}
      data-testid="map-viewport-notes-overlay"
      className="pointer-events-none absolute inset-0 z-[58] overflow-hidden"
      aria-label="地图便签贴层"
    >
      {notes.map((note) => (
        <section
          key={note.id}
          data-map-viewport-note={note.id}
          data-selected={selectedNoteId === note.id ? 'true' : 'false'}
          data-testid={`map-viewport-note-${note.id}`}
          role="group"
          aria-label={note.kind === 'image' ? `地图贴图：${note.imageName ?? '剪贴板图片'}` : '地图文字便签'}
          tabIndex={editable ? 0 : undefined}
          className={`group absolute flex flex-col outline-none ${
            note.kind === 'text'
              ? 'overflow-hidden rounded-xl border border-amber-200/40 bg-amber-950/90 text-amber-50 shadow-2xl backdrop-blur-md'
              : 'cursor-grab touch-none overflow-visible bg-transparent text-slate-100 active:cursor-grabbing'
          } ${editable ? 'pointer-events-auto' : 'pointer-events-none'}`}
          style={{
            left: `calc(${note.x * 100}% - ${note.width / 2}px)`,
            top: `calc(${note.y * 100}% - ${note.height / 2}px)`,
            width: note.width,
            height: note.height,
            zIndex: note.zIndex,
          }}
          onFocus={() => setSelectedNoteId(note.id)}
          onPointerDown={(event) => {
            setSelectedNoteId(note.id)
            if (note.kind === 'image') beginDrag(event, note)
            else bringToFront(note.id)
          }}
          onPointerMove={note.kind === 'image' ? continueDrag : undefined}
          onPointerUp={note.kind === 'image' ? endDrag : undefined}
          onPointerCancel={note.kind === 'image' ? endDrag : undefined}
        >
          {editable && note.kind === 'text' ? (
            <div className="flex h-8 shrink-0 items-center gap-1 border-b border-white/10 bg-black/20 px-1.5">
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-grab touch-none items-center justify-center rounded py-1 text-amber-100/60 hover:bg-white/5 active:cursor-grabbing"
                title="拖动便签"
                onPointerDown={(event) => beginDrag(event, note)}
                onPointerMove={continueDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
              >
                <GripHorizontal className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => removeNote(note.id)}
                className="rounded p-1 text-rose-200/70 hover:bg-rose-500/15 hover:text-rose-100"
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {editable && note.kind === 'image' ? (
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => removeNote(note.id)}
              className={`absolute right-1 top-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-rose-600/85 focus:opacity-100 ${
                selectedNoteId === note.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
              }`}
              title="删除贴图"
              aria-label="删除贴图"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <div className={`min-h-0 flex-1 ${note.kind === 'image' ? 'overflow-hidden' : ''}`}>
            {note.kind === 'text' ? (
              editable ? (
                <textarea
                  autoFocus={!note.text}
                  value={note.text ?? ''}
                  maxLength={MAP_VIEWPORT_NOTE_TEXT_LIMIT}
                  placeholder="在这里输入便签；也可以 Ctrl+V 粘贴图片…"
                  onChange={(event) => replaceNote(note.id, { text: event.target.value })}
                  className="h-full w-full resize-none bg-transparent p-3 text-sm leading-6 text-amber-50 outline-none placeholder:text-amber-100/35"
                />
              ) : (
                <div className="h-full overflow-auto whitespace-pre-wrap p-3 text-sm leading-6">{note.text}</div>
              )
            ) : note.imageId ? (
              <SharedViewportImage imageId={note.imageId} imageName={note.imageName} />
            ) : null}
          </div>
        </section>
      ))}
      {editable && uploading ? (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[10010] flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-cyan-300/30 bg-slate-950/90 px-4 py-2 text-xs text-cyan-100 shadow-xl">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在粘贴图片…
          </div>
        </div>
      ) : null}
    </div>
  )
}
