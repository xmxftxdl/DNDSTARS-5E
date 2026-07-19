import { CircleGauge, Wind } from 'lucide-react'
import type { Character } from '../../types/character'
import { classResourceDefinitions, getClassResource } from '../../lib/classResources'

export default function ClassResourceIndicators({
  character,
  compact = false,
}: {
  character: Character
  compact?: boolean
}) {
  const resources = classResourceDefinitions(character)
    .map((definition) => ({
      definition,
      value: getClassResource(character, definition.key),
    }))
    .filter((entry) => !!entry.value)
  if (resources.length === 0) return null

  return (
    <>
      {resources.map(({ definition, value }) => {
        const Icon = definition.key === 'dnd5e-ki' ? Wind : CircleGauge
        return (
          <div
            key={definition.key}
            className={[
              'flex items-center gap-1.5 rounded-lg bg-violet-500/10',
              compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1.5 text-sm',
            ].join(' ')}
          >
            <Icon className={compact ? 'h-3 w-3 text-violet-300' : 'h-4 w-4 text-violet-300'} />
            <span className="text-slate-300">{definition.shortLabel ?? definition.label}</span>
            <span className="font-bold tabular-nums text-violet-100">
              {definition.unlimited?.(character) ? '∞' : value!.current}
              <span className="text-slate-500">/{definition.unlimited?.(character) ? '∞' : value!.max}</span>
            </span>
          </div>
        )
      })}
    </>
  )
}
