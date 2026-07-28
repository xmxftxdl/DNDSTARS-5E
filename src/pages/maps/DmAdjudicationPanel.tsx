import type { Dispatch, SetStateAction } from 'react'
import type {
  DmAdjudicationEffect,
  DmAdjudicationInterruptPayload,
} from '../../lib/combatInterruptProtocol'
import type { Token } from '../../store/maps'

export interface SharedDmAdjudicationPromptView {
  id: string
  actorCharId?: string
  payload: DmAdjudicationInterruptPayload
  expiresAt?: number
}

export interface DmAdjudicationEffectDraft {
  id: string
  targetTokenId: string
  operation: '' | NonNullable<DmAdjudicationEffect['operation']>
  amount: string
  addCondition: string
  removeCondition: string
}

function newDmAdjudicationEffectDraft(): DmAdjudicationEffectDraft {
  return {
    id: `adjudication-effect-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    targetTokenId: '',
    operation: '',
    amount: '',
    addCondition: '',
    removeCondition: '',
  }
}

interface DmAdjudicationPanelProps {
  isDm: boolean
  prompt: SharedDmAdjudicationPromptView | null
  tokens: readonly Token[]
  dc: string
  setDc: Dispatch<SetStateAction<string>>
  mapOverride: 'roll' | 'success' | 'failure'
  setMapOverride: Dispatch<SetStateAction<'roll' | 'success' | 'failure'>>
  saveOverride: 'unchanged' | 'success' | 'failure'
  setSaveOverride: Dispatch<SetStateAction<'unchanged' | 'success' | 'failure'>>
  effects: DmAdjudicationEffectDraft[]
  setEffects: Dispatch<SetStateAction<DmAdjudicationEffectDraft[]>>
  concentrationRounds: string
  setConcentrationRounds: Dispatch<SetStateAction<string>>
  note: string
  setNote: Dispatch<SetStateAction<string>>
  onDecision: (approved: boolean) => void | Promise<void>
}

export default function DmAdjudicationPanel(props: DmAdjudicationPanelProps) {
  const {
    isDm: isDM,
    prompt: sharedDmAdjudicationPrompt,
    tokens,
    dc: dmAdjudicationDc,
    setDc: setDmAdjudicationDc,
    mapOverride: dmAdjudicationMapOverride,
    setMapOverride: setDmAdjudicationMapOverride,
    saveOverride: dmAdjudicationSaveOverride,
    setSaveOverride: setDmAdjudicationSaveOverride,
    effects: dmAdjudicationEffects,
    setEffects: setDmAdjudicationEffects,
    concentrationRounds: dmAdjudicationConcentrationRounds,
    setConcentrationRounds: setDmAdjudicationConcentrationRounds,
    note: dmAdjudicationNote,
    setNote: setDmAdjudicationNote,
    onDecision: handleSharedDmAdjudicationChoice,
  } = props
  const contextKind = sharedDmAdjudicationPrompt?.payload.contextKind
  const isBasicActionAdjudication = contextKind === 'basic-action'
  const supportsDirectEffects = contextKind !== 'map-interaction' && !isBasicActionAdjudication

  return (
    <>
      {isDM && sharedDmAdjudicationPrompt && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shared-dm-adjudication-title"
            data-testid="dm-adjudication-dialog"
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-amber-400/35 bg-void-950 shadow-2xl"
          >
            <div className="border-b border-white/10 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="shared-dm-adjudication-title" className="text-lg font-semibold text-amber-100">
                    {sharedDmAdjudicationPrompt.payload.contextKind === 'persistent-area-trigger'
                      ? '区域触发中断'
                      : sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                        ? '地图交互中断'
                        : sharedDmAdjudicationPrompt.payload.contextKind === 'basic-action'
                          ? '其他行动裁定'
                        : 'DM 裁定'} · {sharedDmAdjudicationPrompt.payload.spellName}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {sharedDmAdjudicationPrompt.payload.casterName} · {sharedDmAdjudicationPrompt.payload.contextKind === 'persistent-area-trigger'
                      ? ({ 'on-create': '首次创建', 'on-enter': '进入区域', 'on-move-distance': '区域内移动', 'on-area-move-impact': '区域移动撞击', 'turn-start': '回合开始', 'turn-end': '回合结束' } as const)[sharedDmAdjudicationPrompt.payload.triggerTiming ?? 'on-enter']
                      : sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                        ? 'DM 权威地图事务'
                        : sharedDmAdjudicationPrompt.payload.contextKind === 'basic-action'
                          ? <>玩家声明 · {sharedDmAdjudicationPrompt.payload.castingTime === 'bonus-action' ? '附赠动作' : '动作'}</>
                      : <>{
                      sharedDmAdjudicationPrompt.payload.spellLevel === 0
                        ? '戏法'
                        : `${sharedDmAdjudicationPrompt.payload.spellLevel}环，以${sharedDmAdjudicationPrompt.payload.slotLevel}环位施放`
                    } · {sharedDmAdjudicationPrompt.payload.castingTime === 'bonus-action' ? '附赠动作' : '动作'}</>}
                  </p>
                </div>
                <span className="rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                  {isBasicActionAdjudication
                    ? `已经消耗${sharedDmAdjudicationPrompt.payload.castingTime === 'bonus-action' ? '附赠动作' : '动作'}`
                    : '未批准前：不消费资源'}
                </span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
                <section className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                  <h4 className="text-sm font-semibold text-slate-200">规则正文</h4>
                  <p className="mt-3 max-h-[48vh] overflow-y-auto whitespace-pre-line text-xs leading-6 text-slate-400">
                    {sharedDmAdjudicationPrompt.payload.description || '当前没有规则正文，请根据房间已获授权的资料裁定。'}
                  </p>
                </section>
                <section className="space-y-3">
                  <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.04] p-3 text-xs leading-5 text-sky-100/75">
                    {sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                      ? '批准后由 DM Host 使用当前角色与地图快照掷骰和结算。可调整 DC 或直接指定成功／失败；事务完成前玩家无法重复提交。'
                      : isBasicActionAdjudication
                        ? '该行动的动作或附赠动作已由 Host 权威扣除。请根据玩家声明确认是否允许，并在备注中记录检定、DC、结果或后续效果；无论批准或驳回，都不会返还行动资源。'
                        : '数值应填写完成命中、豁免、抗性、易伤等裁定后的最终值。玩家请求中不含效果；下列内容由 DM 提交后才进入 Headless。'}
                  </div>
                  {sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction' && (
                    <div className="grid gap-3 rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3 sm:grid-cols-2">
                      <label className="text-xs text-violet-100">
                        裁定 DC
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={dmAdjudicationDc}
                          onChange={(event) => setDmAdjudicationDc(event.target.value)}
                          disabled={sharedDmAdjudicationPrompt.payload.proposedDc == null}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                        />
                      </label>
                      <label className="text-xs text-violet-100">
                        结果处理
                        <select
                          value={dmAdjudicationMapOverride}
                          onChange={(event) => setDmAdjudicationMapOverride(event.target.value as typeof dmAdjudicationMapOverride)}
                          className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                        >
                          <option value="roll">按 Headless 骰值结算</option>
                          <option value="success">直接判定成功</option>
                          <option value="failure">直接判定失败</option>
                        </select>
                      </label>
                    </div>
                  )}
                  {sharedDmAdjudicationPrompt.payload.proposedSaveSuccess != null && (
                    <label className="block rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3 text-xs text-violet-100">
                      豁免结果调整
                      <select
                        value={dmAdjudicationSaveOverride}
                        onChange={(event) => setDmAdjudicationSaveOverride(event.target.value as typeof dmAdjudicationSaveOverride)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                      >
                        <option value="unchanged">保持自动结果（{sharedDmAdjudicationPrompt.payload.proposedSaveSuccess ? '成功' : '失败'}）</option>
                        <option value="success">改为成功</option>
                        <option value="failure">改为失败</option>
                      </select>
                    </label>
                  )}
                  {supportsDirectEffects && dmAdjudicationEffects.map((effect, index) => (
                    <div key={effect.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-xs font-semibold text-slate-300">效果 {index + 1}</h4>
                        <button
                          type="button"
                          onClick={() => setDmAdjudicationEffects((current) => current.filter((entry) => entry.id !== effect.id))}
                          className="rounded-md px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                        >
                          删除
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <label className="text-[11px] text-slate-400">
                          目标
                          <select
                            value={effect.targetTokenId}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, targetTokenId: event.target.value } : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="">选择地图单位</option>
                            {tokens.filter((token) => token.type !== 'obstacle').map((token) => (
                              <option key={token.id} value={token.id}>{token.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          HP 操作
                          <select
                            value={effect.operation}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id
                                ? { ...entry, operation: event.target.value as DmAdjudicationEffectDraft['operation'] }
                                : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          >
                            <option value="">无 HP 变化</option>
                            <option value="damage">最终伤害</option>
                            <option value="healing">治疗</option>
                            <option value="temporary-hit-points">临时 HP</option>
                          </select>
                        </label>
                        <label className="text-[11px] text-slate-400">
                          最终数值
                          <input
                            type="number"
                            min={0}
                            max={1_000_000}
                            step={1}
                            disabled={!effect.operation}
                            value={effect.amount}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, amount: event.target.value } : entry,
                            ))}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200 disabled:opacity-40"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          添加状态（可选）
                          <input
                            value={effect.addCondition}
                            maxLength={80}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, addCondition: event.target.value } : entry,
                            ))}
                            placeholder="例如：倒地"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400 sm:col-span-2">
                          移除状态（可选）
                          <input
                            value={effect.removeCondition}
                            maxLength={80}
                            onChange={(event) => setDmAdjudicationEffects((current) => current.map((entry) =>
                              entry.id === effect.id ? { ...entry, removeCondition: event.target.value } : entry,
                            ))}
                            placeholder="必须与当前状态名称一致"
                            className="mt-1 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {supportsDirectEffects && <button
                    type="button"
                    onClick={() => setDmAdjudicationEffects((current) => [...current, newDmAdjudicationEffectDraft()])}
                    className="w-full rounded-lg border border-dashed border-amber-400/25 bg-amber-500/[0.04] px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/10"
                  >
                    ＋ 添加目标效果
                  </button>}
                  {sharedDmAdjudicationPrompt.payload.concentration && (
                    <label className="block rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3 text-xs text-violet-100">
                      专注持续轮数
                      <input
                        type="number"
                        min={1}
                        max={14_400}
                        step={1}
                        value={dmAdjudicationConcentrationRounds}
                        onChange={(event) => setDmAdjudicationConcentrationRounds(event.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-void-900 px-2 py-2 text-xs text-slate-200"
                      />
                      <span className="mt-1 block text-[10px] text-violet-100/55">留空则本次只记录裁定效果，不建立 Headless 专注状态。</span>
                    </label>
                  )}
                  <label className="block text-xs text-slate-400">
                    DM 裁定备注（可选）
                    <textarea
                      value={dmAdjudicationNote}
                      maxLength={2_000}
                      onChange={(event) => setDmAdjudicationNote(event.target.value)}
                      rows={3}
                      className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-void-900 px-3 py-2 text-xs text-slate-200"
                      placeholder="记录豁免、命中、抗性、持续时间或需要后续手动跟踪的效果。"
                    />
                  </label>
                </section>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                type="button"
                onClick={() => void handleSharedDmAdjudicationChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                {sharedDmAdjudicationPrompt.payload.contextKind === 'persistent-area-trigger'
                  ? '跳过本次触发'
                  : sharedDmAdjudicationPrompt.payload.contextKind === 'map-interaction'
                    ? '拒绝交互'
                    : sharedDmAdjudicationPrompt.payload.contextKind === 'basic-action'
                      ? '驳回裁定（不返还）'
                    : '取消施法（不消费）'}
              </button>
              <button
                type="button"
                data-testid="dm-adjudication-approve"
                disabled={dmAdjudicationEffects.some((effect) =>
                  !effect.targetTokenId ||
                  (!effect.operation && !effect.addCondition.trim() && !effect.removeCondition.trim()) ||
                  (effect.operation && (!Number.isInteger(Number(effect.amount)) || Number(effect.amount) < 0))
                )}
                onClick={() => void handleSharedDmAdjudicationChoice(true)}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBasicActionAdjudication ? '确认裁定' : '批准并提交 Headless 事务'}
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
