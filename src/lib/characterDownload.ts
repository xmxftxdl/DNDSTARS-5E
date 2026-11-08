import type { Character } from '../types/character'
import { characterExportFileName, makeCharacterExport } from './characterTransfer'

/** Download the same portable JSON format accepted by the character importer. */
export function downloadCharacterJson(character: Character): void {
  const blob = new Blob([JSON.stringify(makeCharacterExport(character), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = characterExportFileName(character)
    document.body.appendChild(link)
    link.click()
  } finally {
    link.remove()
    // Allow the browser to start reading the download before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  }
}
