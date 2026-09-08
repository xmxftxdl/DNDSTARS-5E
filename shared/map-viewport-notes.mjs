export const MAP_VIEWPORT_NOTE_LIMIT = 64

const plainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

/** Returns a stable server-boundary rejection code, or null for a valid list. */
export function validateMapViewportNotes(value) {
  if (value == null) return null
  if (!Array.isArray(value) || value.length > MAP_VIEWPORT_NOTE_LIMIT) return 'invalid-map-viewport-notes'
  const noteIds = new Set()
  let totalTextLength = 0
  for (const note of value) {
    if (
      !plainObject(note) ||
      typeof note.id !== 'string' || !/^[a-z0-9:_-]{1,160}$/i.test(note.id) || noteIds.has(note.id) ||
      !['text', 'image'].includes(note.kind) ||
      !Number.isFinite(note.x) || note.x < 0 || note.x > 1 ||
      !Number.isFinite(note.y) || note.y < 0 || note.y > 1 ||
      !Number.isFinite(note.width) || note.width < 140 || note.width > 720 ||
      !Number.isFinite(note.height) || note.height < 90 || note.height > 720 ||
      !Number.isInteger(note.zIndex) || note.zIndex < 1 || note.zIndex > 10_000 ||
      !Number.isFinite(note.createdAt) || note.createdAt < 0 ||
      !Number.isFinite(note.updatedAt) || note.updatedAt < note.createdAt ||
      (note.kind === 'text' && (typeof note.text !== 'string' || note.text.length > 10_000)) ||
      (note.kind === 'image' && (
        typeof note.imageId !== 'string' || !/^[a-z0-9_-]{1,160}$/i.test(note.imageId)
      )) ||
      (note.imageName != null && (typeof note.imageName !== 'string' || note.imageName.length > 240))
    ) return 'invalid-map-viewport-note'
    noteIds.add(note.id)
    totalTextLength += typeof note.text === 'string' ? note.text.length : 0
  }
  return totalTextLength > 100_000 ? 'map-viewport-notes-too-large' : null
}
