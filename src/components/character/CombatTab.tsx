import { useCharacterStore } from '../../store/characters'
import {
  formatCritDamagePercent,
  getAc,
  getDefense,
  getMagicAttack,
  getMagicDefense,
  getMaxHp,
  getPhysicalAttack,
} from '../../lib/combatStats'
import SkillBar from './SkillBar'

const FORMULA_ROWS = [
  ['攻击力', '武器攻击力 + 敏捷 × 2'],
  ['防御力', '护甲防御力 + 体质 × 1.5'],
  ['魔法攻击力', '魔法武器攻击力 + 智力 × 2'],
  ['魔法防御力', '装备魔防 + 感知 × 1.5'],
  ['生命值', '6 + 等级 × 体质调整值 + 装备生命值'],
  ['暴击伤害', '125% + 装备暴伤 + 敏捷 × 1.5%'],
] as const

function StatField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-lg bg-void-900/40 px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-20 rounded-md border border-white/10 bg-void-900/60 px-2 py-1 text-right text-sm font-semibold text-slate-100 outline-none focus:border-arcane-500"
      />
    </label>
  )
}

function DerivedStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-void-900/40 px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-arcane-200">{value}</span>
      {hint ? <span className="text-right text-[10px] text-slate-500">{hint}</span> : null}
    </div>
  )
}

export default function CombatTab({ charId }: { charId: string }) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === charId))
  const update = useCharacterStore((s) => s.update)
  if (!c) return null

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">计算公式</p>
        <div className="mb-4 overflow-hidden rounded-xl border border-white/10 bg-void-950/35">
          {FORMULA_ROWS.map(([label, formula]) => (
            <div
              key={label}
              className="grid grid-cols-[6.5rem_1fr] border-b border-white/6 last:border-b-0"
            >
              <div className="bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-300">
                {label}
              </div>
              <div className="px-3 py-2 text-xs text-slate-200">{formula}</div>
            </div>
          ))}
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">派生战斗属性</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <DerivedStat label="攻击力" value={getPhysicalAttack(c)} hint="武器 + 敏捷×2" />
          <DerivedStat label="AC" value={getAc(c)} hint="来自护甲装备" />
          <DerivedStat label="防御力" value={Math.round(getDefense(c))} hint="护甲物防 + 体质×1.5" />
          <DerivedStat label="魔法攻击" value={getMagicAttack(c)} hint="魔武 + 智力×2" />
          <DerivedStat label="魔法防御" value={Math.round(getMagicDefense(c))} hint="魔防 + 感知×1.5" />
          <DerivedStat label="生命上限" value={getMaxHp(c)} hint="6 + 等级×体质调整值 + 装备生命" />
          <DerivedStat label="暴击伤害" value={formatCritDamagePercent(c)} hint="125% + 装备暴伤 + 敏捷×1.5%" />
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">战斗资源</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          <StatField label="当前生命值" value={c.currentHp} onChange={(v) => update(charId, { currentHp: v })} />
          <StatField label="豁免 DC" value={c.saveDC} onChange={(v) => update(charId, { saveDC: v })} />
          <StatField label="被动感知" value={c.passivePerception} onChange={(v) => update(charId, { passivePerception: v })} />
          <StatField label="激励骰" value={c.inspiration} onChange={(v) => update(charId, { inspiration: v })} />
        </div>
      </div>

      <SkillBar charId={charId} />
    </div>
  )
}
