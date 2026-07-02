import { Package, Sparkles, Wand2, Swords } from 'lucide-react'
import type { Character } from '../../types/character'
import type { CharDockPanel } from './characterRailConfig'

const DOCK_BUTTONS: { panel: CharDockPanel; icon: typeof Package; label: string; color: string }[] = [
  { panel: 'inventory', icon: Package, label: '装备', color: 'text-amber-300 hover:bg-amber-500/25' },
  { panel: 'features', icon: Sparkles, label: '特性', color: 'text-emerald-300 hover:bg-emerald-500/25' },
  { panel: 'spells', icon: Wand2, label: '法术', color: 'text-violet-300 hover:bg-violet-500/25' },
  { panel: 'skills', icon: Swords, label: '技能', color: 'text-rose-300 hover:bg-rose-500/25' },
]

interface CharacterRailEntryProps {
  character: Character
  isActive: boolean
  activePanel: CharDockPanel | null
  onAvatarClick: () => void
  onPanelClick: (panel: CharDockPanel) => void
}

export default function CharacterRailEntry({
  character,
  isActive,
  activePanel,
  onAvatarClick,
  onPanelClick,
}: CharacterRailEntryProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onAvatarClick}
        title={character.name}
        className={[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xl shadow-lg transition-all',
          character.accent,
          isActive ? 'scale-105 ring-2 ring-white' : 'opacity-85 ring-1 ring-black/30 hover:opacity-100',
        ].join(' ')}
      >
        {character.avatar}
      </button>

      <div className="flex flex-col gap-1">
        {DOCK_BUTTONS.map(({ panel, icon: Icon, label, color }) => {
          const open = isActive && activePanel === panel
          return (
            <button
              key={panel}
              type="button"
              onClick={() => onPanelClick(panel)}
              title={label}
              className={[
                'flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-void-950/90 shadow-md backdrop-blur-sm transition-all',
                color,
                open ? 'scale-110 border-white/30 ring-1 ring-white/40' : '',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
