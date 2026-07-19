import { Clock3, Link2, ShieldAlert, X } from 'lucide-react'
import {
  dnd5eActiveEffectRemainingLabel,
  type Dnd5eActiveEffectInstance,
} from '../../rulesets/dnd5e/activeEffects'

const BREAK_LABELS = {
  'takes-damage': '受到伤害后解除',
  'targeted-by-attack': '成为攻击目标后解除',
  'hit-by-attack': '被攻击命中后解除',
  'makes-attack': '发动攻击后解除',
  'casts-spell': '施放法术后解除',
  moves: '移动后解除',
} as const

const ABILITY_LABELS = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' } as const

export default function Dnd5eActiveEffectDetailsDialog({
  targetName,
  effects,
  onClose,
}: {
  targetName: string
  effects: readonly Dnd5eActiveEffectInstance[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label={`${targetName}的状态详情`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="glass max-h-[min(720px,90vh)] w-full max-w-2xl overflow-hidden rounded-2xl border border-violet-300/20 shadow-2xl">
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <ShieldAlert className="h-5 w-5 text-violet-300" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-100">{targetName} · 状态详情</h2>
            <p className="text-xs text-slate-500">来源、剩余时间与自动解除条件均来自房间权威快照。</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" title="关闭"><X className="h-4 w-4" /></button>
        </header>
        <div className="max-h-[calc(min(720px,90vh)-76px)] space-y-3 overflow-y-auto p-5">
          {effects.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-slate-500">当前没有可显示的状态实例。</p> : effects.map((effect) => (
            <article key={effect.id} className="rounded-xl border border-white/10 bg-void-950/45 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-violet-100">{effect.label}</h3>
                <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{effect.definitionId}</span>
                {effect.visibility === 'dm-only' ? <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-200">仅 DM</span> : null}
              </div>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div><dt className="text-slate-500">来源</dt><dd className="mt-0.5 text-slate-200">{effect.source.actorName ?? effect.source.label ?? effect.source.rulesId ?? '旧数据 / 未注明'}</dd></div>
                <div><dt className="text-slate-500">持续</dt><dd className="mt-0.5 inline-flex items-center gap-1 text-slate-200"><Clock3 className="h-3.5 w-3.5 text-violet-300" />{dnd5eActiveEffectRemainingLabel(effect)}</dd></div>
                {effect.repeatSave ? <div><dt className="text-slate-500">重复豁免</dt><dd className="mt-0.5 text-slate-200">每个目标回合{effect.repeatSave.timing === 'target-turn-start' ? '开始' : '结束'}：{ABILITY_LABELS[effect.repeatSave.ability]} DC {effect.repeatSave.dc}</dd></div> : null}
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
