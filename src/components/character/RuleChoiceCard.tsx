import { Check } from 'lucide-react'

/** Reading a rule remains available when character choices are locked. */
export default function RuleChoiceCard({ name, summary, description, selected, disabled, onClick }: {
  name: string
  summary: string
  description?: string
  selected: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-3 ${selected ? 'border-arcane-400/50 bg-arcane-500/15' : 'border-white/8 bg-white/[0.03]'}`}>
      <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected}
        className="block w-full text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-slate-200">{name}</span>
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-arcane-300 bg-arcane-500 text-white' : 'border-slate-600'}`}>{selected && <Check className="h-3.5 w-3.5" />}</span>
        </span>
      </button>
      <p className="mt-1 text-xs leading-5 text-slate-400">{summary}</p>
      {description && (
        <details className="mt-2 border-t border-white/8 pt-2">
          <summary className="cursor-pointer text-xs font-semibold text-arcane-200">详细规则</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-6 text-slate-300">{description}</p>
        </details>
      )}
    </div>
  )
}
