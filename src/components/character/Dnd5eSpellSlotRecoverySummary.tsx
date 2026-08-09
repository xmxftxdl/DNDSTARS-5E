import type { Character } from '../../types/character'
import {
  dnd5eSpellSlotRecoveryFeature,
  dnd5eSpellSlotRecoveryLimit,
} from '../../rulesets/dnd5e/restFeatures'

export default function Dnd5eSpellSlotRecoverySummary({ character }: { character: Character }) {
  const feature = dnd5eSpellSlotRecoveryFeature(character)
  if (!feature) return null
  const resourceKey = feature === 'arcane-recovery'
    ? 'dnd5e-arcane-recovery'
    : 'dnd5e-natural-recovery'
  const resource = character.classResources?.[resourceKey]
  const budget = dnd5eSpellSlotRecoveryLimit(character)
  const missingSlots = Array.from({ length: 5 }, (_, index) => {
    const level = index + 1
    const slot = character.classResources?.[`dnd5e-spell-slot-${level}`]
    const missing = slot ? Math.max(0, slot.max - slot.current) : 0
    return missing > 0 ? `${level}环×${missing}` : undefined
  }).filter((entry): entry is string => !!entry)
  const available = (resource?.current ?? 0) > 0
  const name = feature === 'arcane-recovery' ? '奥术回想' : '自然恢复'

  return <section data-testid="spell-slot-recovery-summary" className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold text-cyan-100">{name}</h4>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          只能在 DM 完成短休后的结算窗口使用，职业页面不会直接修改法术位。
        </p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${available ? 'bg-emerald-500/12 text-emerald-200' : 'bg-slate-700/50 text-slate-400'}`}>
        {available ? '今日可用' : '今日已使用'} · {resource?.current ?? 0}/{resource?.max ?? 1}
      </span>
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-white/8 bg-black/10 px-3 py-2">
        <div className="text-[10px] font-semibold text-slate-500">本次恢复额度</div>
        <div className="mt-1 text-sm font-semibold text-slate-200">总环级不超过 {budget} 环</div>
        <div className="mt-1 text-[10px] text-slate-500">不能恢复6环或更高法术位；未使用额度不会保留。</div>
      </div>
      <div className="rounded-lg border border-white/8 bg-black/10 px-3 py-2">
        <div className="text-[10px] font-semibold text-slate-500">当前缺失的可恢复法术位</div>
        <div className="mt-1 text-sm font-semibold text-slate-200">{missingSlots.join(' · ') || '1至5环法术位均已充满'}</div>
        <div className="mt-1 text-[10px] text-slate-500">短休结算时由玩家分配，系统校验总环级和每日次数。</div>
      </div>
    </div>
  </section>
}
