import type { Dnd5eSpellWhisperEnvelope } from '../../lib/sharedCombatTypes'

export function Dnd5eSpellWhisperDialog(props: {
  whisper: Dnd5eSpellWhisperEnvelope
  onClose: () => void
}) {
  const { whisper } = props
  if (whisper.spellId !== 'sending' || whisper.direction !== 'sending-result' || !whisper.sending) {
    return null
  }

  return <div
    className="absolute inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label={`短讯术回执 · ${whisper.casterName} → ${whisper.targetName}`}
  >
    <section className="w-full max-w-md rounded-2xl border border-violet-300/30 bg-slate-950/95 p-5 shadow-2xl shadow-violet-950/50">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">短讯术 · 私密回执</p>
      <h2 className="mt-2 text-lg font-semibold text-slate-50">
        {whisper.casterName}向{whisper.targetName}施放短讯术
      </h2>
      <blockquote className="mt-4 whitespace-pre-wrap rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm leading-6 text-violet-50">
        “{whisper.text}”
      </blockquote>
      <div className="mt-3 space-y-2 text-xs">
        <p className={whisper.sending.delivered ? 'text-emerald-300' : 'text-amber-300'}>
          {whisper.sending.plane === 'same'
            ? '同一位面：讯息已送达。'
            : `不同位面：d100 = ${whisper.sending.crossPlaneRoll}，${whisper.sending.delivered ? '讯息已送达' : '1–5 触发联络失败'}。`}
        </p>
        {whisper.sending.delivered ? <p className="text-slate-300">
          目标{whisper.sending.targetIntelligenceAtLeastOne
            ? '智力至少为 1，理解讯息含义并认出熟悉的施法者。'
            : '智力为 0，听见讯息但无法理解含义。'}
        </p> : null}
        {whisper.sending.reply ? <blockquote className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-50">
          {whisper.targetName}立即回应：“{whisper.sending.reply}”
        </blockquote> : null}
      </div>
      <p className="mt-3 text-xs text-slate-400">
        完整送达结果只回执给施法者，并记录到其与 DM 的私密通讯。
      </p>
      <button
        type="button"
        onClick={props.onClose}
        className="mt-4 w-full rounded-xl bg-violet-500 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-400"
      >
        关闭
      </button>
    </section>
  </div>
}
