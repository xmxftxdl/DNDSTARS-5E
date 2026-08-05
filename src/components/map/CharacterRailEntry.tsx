import type { Character } from '../../types/character'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'

interface CharacterRailEntryProps {
  character: Character
  isActive: boolean
  onAvatarClick: () => void
}

export default function CharacterRailEntry({
  character,
  isActive,
  onAvatarClick,
}: CharacterRailEntryProps) {
  const portrait = resolveMapTokenPortrait(character)
  return (
    <button
      type="button"
      data-testid={`character-rail-${character.id}`}
      onClick={onAvatarClick}
      title={`${character.name} · 打开底部行动栏`}
      aria-label={`${character.name}的行动栏`}
      className={[
        'flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xl shadow-lg transition-all',
        character.accent,
        isActive ? 'scale-105 ring-2 ring-white' : 'opacity-85 ring-1 ring-black/30 hover:opacity-100',
      ].join(' ')}
    >
      {portrait ? <img src={portrait} alt="" className="h-full w-full object-cover" /> : character.avatar}
    </button>
  )
}
