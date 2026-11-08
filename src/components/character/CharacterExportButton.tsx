import { Download } from 'lucide-react'
import type { Character } from '../../types/character'
import { downloadCharacterJson } from '../../lib/characterDownload'

export default function CharacterExportButton({ character }: { character: Character }) {
  return (
    <button
      type="button"
      onClick={() => downloadCharacterJson(character)}
      aria-label={`导出角色 JSON：${character.name}`}
      title={`导出角色 JSON：${character.name}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-arcane-400/20 bg-arcane-500/[0.07] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-arcane-300/40 hover:bg-arcane-500/15 hover:text-white"
    >
      <Download className="h-3.5 w-3.5" />
      导出 JSON
    </button>
  )
}
