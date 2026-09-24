/** Presentation may finish when hidden; this never confirms a rules result. */
export function onDiceDocumentHidden(finish: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined
  const handle = () => { if (document.hidden) finish() }
  document.addEventListener('visibilitychange', handle)
  handle()
  return () => document.removeEventListener('visibilitychange', handle)
}
