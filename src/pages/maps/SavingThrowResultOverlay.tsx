import {
  combatPresentationSavingThrowAbilityLabel,
  type CombatPresentationSavingThrow,
} from '../../lib/combatPresentation'
import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'

export default function SavingThrowResultOverlay({
  savingThrow,
}: {
  savingThrow: CombatPresentationSavingThrow | null | undefined
}) {
  if (savingThrow?.phase !== 'result') return null
  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-[110] -translate-x-1/2">
      <div
        data-testid="saving-throw-result"
        data-saving-throw-ability={savingThrow.ability}
        className="min-w-72 rounded-2xl border border-rose-400/40 bg-void-950/85 px-6 py-2 text-center shadow-2xl backdrop-blur-sm"
      >
        <p className="text-xs text-slate-400">
          {combatPresentationSavingThrowAbilityLabel(savingThrow.ability)}
          {' -> '}
          {savingThrow.targetName}
        </p>
        <p
          className={[
            'mt-1 text-sm font-bold tabular-nums',
            savingThrow.success ? 'text-emerald-300' : 'text-rose-300',
          ].join(' ')}
        >
          {savingThrow.total} vs DC {savingThrow.dc}
          {' · '}
          {savingThrow.success ? '豁免成功' : '豁免失败'}
        </p>
        {savingThrow.damage != null ? (
          <p className="mt-1 text-xs font-semibold tabular-nums text-orange-200">
            最终受到 {savingThrow.damage} 点
            {savingThrow.damageType ? DND5E_DAMAGE_TYPE_LABELS[savingThrow.damageType] : ''}
            伤害
          </p>
        ) : null}
      </div>
    </div>
  )
}
