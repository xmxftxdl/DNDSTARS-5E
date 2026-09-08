import { StickyNote } from 'lucide-react'
import {
  createMapViewportTextNote,
  MAP_VIEWPORT_NOTE_LIMIT,
  type MapViewportNote,
} from '../../lib/mapViewportNotes'

export default function MapViewportNoteButton({
  notes,
  onChange,
}: {
  notes: readonly MapViewportNote[]
  onChange: (notes: MapViewportNote[]) => void
}) {
  const disabled = notes.length >= MAP_VIEWPORT_NOTE_LIMIT
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (disabled) return
        onChange([...notes, createMapViewportTextNote(notes)])
      }}
      className="relative rounded-md p-1.5 text-amber-200 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-35"
      title="添加屏幕便签；也可在地图上直接 Ctrl+V 粘贴图片。便签不会随地图平移或缩放"
    >
      <StickyNote className="h-3.5 w-3.5" />
      {notes.length > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-3 rounded-full bg-amber-300 px-0.5 text-center text-[8px] font-black leading-3 text-slate-950">
          {Math.min(99, notes.length)}
        </span>
      ) : null}
    </button>
  )
}
