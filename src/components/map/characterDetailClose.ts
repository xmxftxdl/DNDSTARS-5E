export interface CharacterDetailClosePointerEvent {
  isPrimary: boolean
  button: number
  preventDefault: () => void
  stopPropagation: () => void
}

export function closeCharacterDetailOnPrimaryPointerDown(
  event: CharacterDetailClosePointerEvent,
  onClose: () => void,
) {
  if (!event.isPrimary || event.button !== 0) return false
  event.preventDefault()
  event.stopPropagation()
  onClose()
  return true
}

export function shouldCloseCharacterDetailForKey(key: string) {
  return key === 'Escape'
}
