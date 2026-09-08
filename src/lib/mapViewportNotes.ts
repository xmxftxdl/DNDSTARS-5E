export const MAP_VIEWPORT_NOTE_LIMIT = 64
export const MAP_VIEWPORT_NOTE_TEXT_LIMIT = 10_000

export type MapViewportNoteKind = 'text' | 'image'

/**
 * A DOM-overlay note anchored to the visible map viewport. `x` and `y` are
 * normalized viewport coordinates, not battle-map/world coordinates, so map
 * pan and zoom never move the note.
 */
export interface MapViewportNote {
  id: string
  kind: MapViewportNoteKind
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  text?: string
  imageId?: string
  imageName?: string
  createdAt: number
  updatedAt: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function normalizeMapViewportNotes(value: unknown): MapViewportNote[] {
  if (!Array.isArray(value)) return []
  const ids = new Set<string>()
  return value.flatMap((candidate): MapViewportNote[] => {
    if (!candidate || typeof candidate !== 'object') return []
    const raw = candidate as Partial<MapViewportNote>
    if (
      typeof raw.id !== 'string' || !/^[a-z0-9:_-]{1,160}$/i.test(raw.id) || ids.has(raw.id) ||
      (raw.kind !== 'text' && raw.kind !== 'image')
    ) return []
    const imageId = typeof raw.imageId === 'string' && /^[a-z0-9_-]{1,160}$/i.test(raw.imageId)
      ? raw.imageId
      : undefined
    if (raw.kind === 'image' && !imageId) return []
    ids.add(raw.id)
    const createdAt = Math.max(0, finiteNumber(raw.createdAt, Date.now()))
    const updatedAt = Math.max(createdAt, finiteNumber(raw.updatedAt, createdAt))
    return [{
      id: raw.id,
      kind: raw.kind,
      x: clamp(finiteNumber(raw.x, 0.5), 0, 1),
      y: clamp(finiteNumber(raw.y, 0.4), 0, 1),
      width: clamp(finiteNumber(raw.width, raw.kind === 'image' ? 320 : 260), 140, 720),
      height: clamp(finiteNumber(raw.height, raw.kind === 'image' ? 240 : 180), 90, 720),
      zIndex: Math.max(1, Math.min(10_000, Math.round(finiteNumber(raw.zIndex, 1)))),
      text: raw.kind === 'text'
        ? String(raw.text ?? '').slice(0, MAP_VIEWPORT_NOTE_TEXT_LIMIT)
        : undefined,
      imageId,
      imageName: imageId && typeof raw.imageName === 'string'
        ? raw.imageName.slice(0, 240)
        : undefined,
      createdAt,
      updatedAt,
    }]
  }).slice(0, MAP_VIEWPORT_NOTE_LIMIT)
}

export function createMapViewportTextNote(
  notes: readonly MapViewportNote[],
  now = Date.now(),
): MapViewportNote {
  return {
    id: `viewport-note:${crypto.randomUUID()}`,
    kind: 'text',
    x: 0.5,
    y: 0.36,
    width: 280,
    height: 190,
    zIndex: Math.min(10_000, Math.max(0, ...notes.map((note) => note.zIndex)) + 1),
    text: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function createMapViewportImageNote(
  notes: readonly MapViewportNote[],
  image: { imageId: string; imageName?: string; width?: number; height?: number },
  now = Date.now(),
): MapViewportNote {
  const sourceWidth = Math.max(1, image.width ?? 320)
  const sourceHeight = Math.max(1, image.height ?? 240)
  const width = clamp(sourceWidth, 180, 420)
  const height = clamp(width * sourceHeight / sourceWidth, 120, 420)
  return {
    id: `viewport-note:${crypto.randomUUID()}`,
    kind: 'image',
    x: 0.5,
    y: 0.42,
    width,
    height,
    zIndex: Math.min(10_000, Math.max(0, ...notes.map((note) => note.zIndex)) + 1),
    imageId: image.imageId,
    imageName: image.imageName?.slice(0, 240),
    createdAt: now,
    updatedAt: now,
  }
}
