import type { Dnd5eDamageTraitReceipt } from '../../rulesets/dnd5e/damageTraitReport'
import { DND5E_DAMAGE_TYPE_LABELS, type Dnd5eDamageType } from '../../rulesets/dnd5e/damageTypes'

const names = (types: readonly Dnd5eDamageType[]) => types.map(type => DND5E_DAMAGE_TYPE_LABELS[type]).join('、') || '无'

export function DamageTraitReports({ reports }: { reports: readonly Dnd5eDamageTraitReceipt[] }) {
  return <>{reports.map(receipt => <div key={receipt.sourceActivityId} data-testid="damage-trait-report"
    className="rounded-lg border border-violet-300/20 bg-violet-500/5 p-2 text-xs text-violet-100">
    <div className="font-semibold">猎手感知 · {receipt.targetName ?? '所选生物'}</div>
    <div className="mt-1">免疫：{names(receipt.report.immunities)}</div>
    <div>抗性：{names(receipt.report.resistances)}</div>
    <div>易伤：{names(receipt.report.vulnerabilities)}</div>
    {receipt.report.conditional.map((rule, index) => {
      const conditions = [
        rule.delivery === 'weapon-attack' ? '武器攻击' : rule.delivery === 'spell' ? '法术' : rule.delivery === 'other' ? '其他来源' : '',
        rule.magical === true ? '魔法伤害' : rule.magical === false ? '非魔法伤害' : '',
        rule.attackOnly ? '仅攻击伤害' : '',
        rule.sourceCreatureProtection ? '按来源生物分别生效；对防护已失效的生物不适用' : '',
        rule.weaponMaterialNot === 'silvered' ? '非镀银武器' : rule.weaponMaterialNot === 'adamantine' ? '非精金武器' : '',
        rule.sourceMoralAlignment ? `来源阵营：${({ good: '善良', neutral: '中立', evil: '邪恶' })[rule.sourceMoralAlignment]}` : '',
      ].filter(Boolean)
      return <div key={index} className="mt-1">
        {({ immune: '免疫', resistant: '抗性', vulnerable: '易伤' })[rule.outcome]}：
        {rule.damageTypes ? names(rule.damageTypes) : '所有伤害'}
        {conditions.length ? `（${conditions.join('；')}）` : ''}
      </div>
    })}
    <div className="mt-1 text-[11px] text-slate-400">第 {receipt.round} 回合的感知结果，不随目标状态自动更新。</div>
  </div>)}</>
}
