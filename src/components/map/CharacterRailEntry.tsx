import type { Character } from '../../types/character'
import { resolveInitiativePortrait } from '../../lib/portraitPresentation'

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
  // This button is the compact entry point for the character sheet, but it
  // represents the same combatant as the initiative rail.  Using the map-token
  // crop here made the two portraits visibly disagree whenever a character had
  // configured a dedicated initiative portrait.
  const portrait = resolveInitiativePortrait(character)
  return (
    <button
      type="button"
      data-testid={`character-rail-${character.id}`}
      onClick={onAvatarClick}
      title={`${character.name} · 查看角色详情`}
      aria-label={`查看${character.name}的角色详情`}
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
