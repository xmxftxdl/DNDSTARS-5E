import { Clock3, Link2, ShieldAlert, Trash2, X } from 'lucide-react'
import {
  dnd5eActiveEffectRemainingLabel,
  type Dnd5eActiveEffectInstance,
} from '../../rulesets/dnd5e/activeEffects'
import { dnd5eConditionLabel } from '../../rulesets/dnd5e/conditions'
import type { MapTokenStatusInstance } from './mapTokenStatusInstance'

const BREAK_LABELS = {
  'takes-damage': '受到伤害后解除',
  'targeted-by-attack': '成为攻击目标后解除',
  'hit-by-attack': '被攻击命中后解除',
  'makes-attack': '发动攻击后解除',
  'casts-spell': '施放法术后解除',
  moves: '移动后解除',
  'spends-action': '消耗动作后解除',
  'spends-bonus-action': '消耗附赠动作后解除',
  'spends-reaction': '消耗反应后解除',
  awakened: '被唤醒后解除',
  'magical-healing': '接受魔法治疗后解除',
  'short-rest-complete': '完成短休后解除',
  'long-rest-complete': '完成长休后解除',
} as const

const ABILITY_LABELS = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' } as const
const DAMAGE_LABELS: Readonly<Record<string, string>> = {
  acid: '强酸',
  bludgeoning: '钝击',
  cold: '寒冷',
  fire: '火焰',
  force: '力场',
  lightning: '闪电',
  necrotic: '黯蚀',
  piercing: '穿刺',
  poison: '毒素',
  psychic: '心灵',
  radiant: '光耀',
  slashing: '挥砍',
  thunder: '雷鸣',
}

const INSTANCE_KIND_LABELS: Readonly<Record<MapTokenStatusInstance['kind'], string>> = {
  'active-effect': '状态实例',
  'spell-effect': '法术效果',
  concentration: '专注实例',
  flight: '地图高度',
  shillelagh: '武器强化',
  'token-marker': 'DM 标注',
  'monster-trait': '怪物特性',
  'monster-state': '怪物状态',
}

const INSTANCE_AUTHORITY_LABELS: Readonly<Record<MapTokenStatusInstance['authority'], string>> = {
  headless: 'Headless 权威规则',
  geometry: '地图几何状态',
  'dm-annotation': 'DM 地图标注',
}

export default function Dnd5eActiveEffectDetailsDialog({
  targetName,
  effects,
  instance,
  onRemove,
  onClose,
}: {
  targetName: string
  effects: readonly Dnd5eActiveEffectInstance[]
  instance?: MapTokenStatusInstance
  onRemove?: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label={`${targetName}的状态详情`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="glass max-h-[min(720px,90vh)] w-full max-w-2xl overflow-hidden rounded-2xl border border-violet-300/20 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <ShieldAlert className="h-5 w-5 text-violet-300" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-100">{targetName} · {instance?.title ?? '状态详情'}</h2>
            <p className="text-xs text-slate-500">每个地图状态 Token 对应一个独立实例；权威效果会显示来源、剩余时间与解除条件。</p>
          </div>
          {onRemove ? (
            <button
              type="button"
              onClick={onRemove}
              data-testid="dnd5e-token-status-instance-remove"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-100 transition-colors hover:bg-rose-500/20"
              title="移除当前状态实例"
            >
              <Trash2 className="h-3.5 w-3.5" />
              移除状态
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="关闭"><X className="h-4 w-4" /></button>
        </header>
        <div className="max-h-[calc(min(720px,90vh)-76px)] space-y-3 overflow-y-auto p-5">
          {effects.length === 0 && instance ? (
            <article className="rounded-xl border border-violet-300/15 bg-void-950/45 p-4" data-testid="dnd5e-token-status-instance-details">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-violet-100">{instance.title}</h3>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{INSTANCE_KIND_LABELS[instance.kind]}</span>
                <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">{INSTANCE_AUTHORITY_LABELS[instance.authority]}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">{instance.description}</p>
              <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">来源</dt><dd className="mt-0.5 text-slate-200">{instance.sourceLabel ?? '未注明'}</dd></div>
                <div><dt className="text-slate-500">实例 ID</dt><dd className="mt-0.5 break-all font-mono text-[11px] text-slate-300">{instance.id}</dd></div>
                {instance.statusId ? <div><dt className="text-slate-500">规则 ID</dt><dd className="mt-0.5 break-all font-mono text-[11px] text-slate-300">{instance.statusId}</dd></div> : null}
              </dl>
              {instance.authority === 'dm-annotation' ? <p className="mt-3 rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">此实例仅用于地图标注，不会自行改变 Headless 规则。</p> : null}
              {instance.kind === 'monster-trait' ? <p className="mt-3 rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">移除只隐藏这枚地图状态标记，不会删除怪物图鉴中的固有特性，也不会停用 Headless 规则。</p> : null}
              {instance.kind === 'monster-state' ? <p className="mt-3 rounded bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-100">移除会结束当前触发的怪物运行状态；怪物图鉴中的固有特性仍会保留，并可在满足条件后再次触发。</p> : null}
            </article>
          ) : effects.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">当前没有可显示的状态实例。</p> : effects.map((effect) => (
            <article key={effect.id} className="rounded-xl border border-white/10 bg-void-950/45 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-violet-100">{effect.label}</h3>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{effect.definitionId}</span>
                {effect.visibility === 'dm-only' ? <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">仅 DM</span> : null}
                <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">独立实例</span>
              </div>
              {instance?.description ? <p className="mt-3 text-sm leading-6 text-slate-200">{instance.description}</p> : null}
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">来源</dt><dd className="mt-0.5 text-slate-200">{effect.source.actorName ?? effect.source.label ?? effect.source.rulesId ?? '旧数据 / 未注明'}</dd></div>
                <div><dt className="text-slate-500">持续</dt><dd className="mt-0.5 inline-flex items-center gap-1 text-slate-200"><Clock3 className="h-3.5 w-3.5 text-violet-300" />{dnd5eActiveEffectRemainingLabel(effect)}</dd></div>
                {effect.repeatSave ? <div><dt className="text-slate-500">重复豁免</dt><dd className="mt-0.5 text-slate-200">每个目标回合{effect.repeatSave.timing === 'target-turn-start' ? '开始' : '结束'}：{ABILITY_LABELS[effect.repeatSave.ability]} DC {effect.repeatSave.dc}</dd></div> : null}
                {effect.repeatSave?.damageOnFailure ? <div><dt className="text-slate-500">豁免失败</dt><dd className="mt-0.5 text-slate-200">{effect.repeatSave.damageOnFailure.count}d{effect.repeatSave.damageOnFailure.sides}{effect.repeatSave.damageOnFailure.modifier ? `${effect.repeatSave.damageOnFailure.modifier > 0 ? '+' : ''}${effect.repeatSave.damageOnFailure.modifier}` : ''} {DAMAGE_LABELS[effect.repeatSave.damageOnFailure.type] ?? effect.repeatSave.damageOnFailure.type}伤害</dd></div> : null}
                {effect.repeatSave?.onFailureTransition ? <div><dt className="text-slate-500">复检失败</dt><dd className="mt-0.5 text-slate-200">转为{dnd5eConditionLabel(effect.repeatSave.onFailureTransition.replaceWithCondition)}（永久）</dd></div> : null}
                {effect.escapeCheck ? <div><dt className="text-slate-500">挣脱</dt><dd className="mt-0.5 text-slate-200">消耗动作，{ABILITY_LABELS[effect.escapeCheck.ability]}{effect.escapeCheck.alternativeAbility ? `或${ABILITY_LABELS[effect.escapeCheck.alternativeAbility]}` : ''}检定 DC {effect.escapeCheck.dc}</dd></div> : null}
                {effect.periodicDamage ? <div><dt className="text-slate-500">回合开始</dt><dd className="mt-0.5 text-slate-200">{effect.periodicDamage.count}d{effect.periodicDamage.sides}{effect.periodicDamage.modifier ? `${effect.periodicDamage.modifier > 0 ? '+' : ''}${effect.periodicDamage.modifier}` : ''} {effect.periodicDamage.type ? `${DAMAGE_LABELS[effect.periodicDamage.type] ?? effect.periodicDamage.type}伤害` : '生命值损失'}</dd></div> : null}
                {effect.removal?.action ? <div><dt className="text-slate-500">主动解除</dt><dd className="mt-0.5 text-slate-200">{effect.removal.action.label}（动作{effect.removal.action.abilityCheck ? `，${ABILITY_LABELS[effect.removal.action.abilityCheck.ability]}${effect.removal.action.abilityCheck.skill === 'medicine' ? '（医药）' : ''} DC ${effect.removal.action.abilityCheck.dc}` : ''}）</dd></div> : null}
                {effect.removal?.onMagicalHealing ? <div><dt className="text-slate-500">魔法治疗</dt><dd className="mt-0.5 text-slate-200">接受魔法治疗时自动解除</dd></div> : null}
                {effect.modifiers?.flySpeedFeet ? <div><dt className="text-slate-500">飞行速度</dt><dd className="mt-0.5 text-slate-200">{effect.modifiers.flySpeedFeet} 尺</dd></div> : null}
                {effect.modifiers?.preventHealing ? <div><dt className="text-slate-500">治疗</dt><dd className="mt-0.5 text-rose-200">无法恢复生命值</dd></div> : null}
                <div><dt className="text-slate-500">重复规则</dt><dd className="mt-0.5 text-slate-200">{effect.stackingPolicy}</dd></div>
              </dl>
              {effect.duration.type === 'concentration' ? <p className="mt-3 inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-1 text-[11px] text-sky-200"><Link2 className="h-3.5 w-3.5" />来源失去专注时自动解除</p> : null}
              {effect.breakOn?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{effect.breakOn.map((trigger) => <span key={trigger} className="rounded-full border border-rose-300/15 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-200">{BREAK_LABELS[trigger]}</span>)}</div> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
