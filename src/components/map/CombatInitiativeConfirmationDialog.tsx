import { useState } from 'react'
import { ArrowDown, ArrowLeftRight, ArrowUp, Dices, Play, X } from 'lucide-react'
import type { InitiativeEntry } from './InitiativeTracker'
import {
  combatInitiativeEntryKey,
  moveInitiativeConfirmationEntry,
  swapInitiativeConfirmationEntries,
} from './combatInitiativeConfirmation'

interface CombatInitiativeConfirmationDialogProps {
  entries: InitiativeEntry[]
  surprisedCount: number
  submitting: boolean
  title?: string
  description?: string
  footerHint?: string
  confirmLabel?: string
  submittingLabel?: string
  cancelLabel?: string
  dismissible?: boolean
  onEntriesChange: (entries: InitiativeEntry[]) => void
  onCancel: () => void
  onConfirm: () => void
}

function initiativeBreakdown(entry: InitiativeEntry): string {
  const calculation = entry.initiativeCalculation
  if (!calculation) return `先攻 ${entry.roll}`
  const modifier = calculation.modifier >= 0 ? `+${calculation.modifier}` : String(calculation.modifier)
  if (calculation.mode === 'normal') return `d20 ${calculation.d20} ${modifier} = ${entry.roll}`
  const mode = calculation.mode === 'advantage' ? '优势取高' : '劣势取低'
  return `d20（${calculation.rolls.join('、')}，${mode} ${calculation.d20}）${modifier} = ${entry.roll}`
}

function extraTurnLabel(entry: InitiativeEntry): string | undefined {
  if (entry.turnKind === 'thief-reflexes') return '盗贼反射 · 首轮额外回合'
  if (entry.turnKind === 'source-companion') return '与施法者同轮行动'
  if (entry.turnKind === 'activity-extra-turn') return '能力额外回合'
  return undefined
}

export default function CombatInitiativeConfirmationDialog({
  entries,
  surprisedCount,
  submitting,
  title = '确认先攻顺序',
  description = '先攻已经掷出，但战斗尚未开始。DM 调整顺序时会同步交换先攻骰值，也可以选择两个单位直接互换；确认后才会启动第一回合。',
  footerHint = '确认前不会发布战斗状态，也不会触发首个单位的回合开始效果。',
  confirmLabel = '确认并开始第一回合',
  submittingLabel = '正在开始…',
  cancelLabel = '返回修改',
  dismissible = true,
  onEntriesChange,
  onCancel,
  onConfirm,
}: CombatInitiativeConfirmationDialogProps) {
  const [swapSourceKey, setSwapSourceKey] = useState<string>()
  const swapSource = swapSourceKey
    ? entries.find((entry) => combatInitiativeEntryKey(entry) === swapSourceKey)
    : undefined
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-300/25 bg-void-950 shadow-[0_24px_80px_rgba(0,0,0,0.7)]"
      >
        <div className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/25 bg-amber-400/10 text-amber-200">
            <Dices className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-amber-50">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {description}
            </p>
            {surprisedCount > 0 ? (
              <p className="mt-1 text-xs font-medium text-rose-300">{surprisedCount} 名单位处于受突袭状态</p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              aria-label="取消确认先攻"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white disabled:cursor-wait disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {entries.map((entry, index) => {
            const key = combatInitiativeEntryKey(entry)
            const extraLabel = extraTurnLabel(entry)
            return (
              <div
                key={key}
                data-testid={`initiative-confirm-entry-${key}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5"
              >
                <span className="w-7 shrink-0 text-center text-sm font-black tabular-nums text-amber-200">{index + 1}</span>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 bg-void-900 text-xl"
                  style={{ borderColor: entry.color }}
                >
                  {entry.portrait ? (
                    <img src={entry.portrait} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span aria-hidden="true">{entry.emoji || '◉'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-100">{entry.label}</span>
                    {extraLabel ? (
                      <span className="rounded-full bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-200">{extraLabel}</span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs tabular-nums text-slate-400">{initiativeBreakdown(entry)}</p>
                </div>
                <span className="flex min-w-10 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-400/10 px-2 py-1 text-base font-black tabular-nums text-amber-100">
                  {entry.roll}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    aria-label={swapSourceKey === key
                      ? `取消选择 ${entry.label}`
                      : swapSource
                        ? `将 ${entry.label} 与 ${swapSource.label} 的先攻互换`
                        : `选择 ${entry.label} 进行先攻互换`}
                    title={swapSourceKey === key
                      ? '取消互换'
                      : swapSource
                        ? `与 ${swapSource.label} 互换`
                        : '选择互换'}
                    disabled={submitting}
                    onClick={() => {
                      if (!swapSourceKey || swapSourceKey === key) {
                        setSwapSourceKey(swapSourceKey === key ? undefined : key)
                        return
                      }
                      onEntriesChange(swapInitiativeConfirmationEntries(entries, swapSourceKey, key))
                      setSwapSourceKey(undefined)
                    }}
                    className={`rounded-lg border p-1.5 disabled:cursor-not-allowed disabled:opacity-25 ${swapSourceKey === key
                      ? 'border-sky-300/60 bg-sky-400/15 text-sky-100'
                      : swapSource
                        ? 'border-sky-300/30 text-sky-200 hover:bg-sky-400/10'
                        : 'border-white/10 text-slate-300 hover:bg-white/10'}`}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`将 ${entry.label} 上移`}
                    title="上移"
                    disabled={submitting || index === 0}
                    onClick={() => {
                      setSwapSourceKey(undefined)
                      onEntriesChange(moveInitiativeConfirmationEntry(entries, key, -1))
                    }}
                    className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`将 ${entry.label} 下移`}
                    title="下移"
                    disabled={submitting || index === entries.length - 1}
                    onClick={() => {
                      setSwapSourceKey(undefined)
                      onEntriesChange(moveInitiativeConfirmationEntry(entries, key, 1))
                    }}
                    className="rounded-lg border border-white/10 p-1.5 text-slate-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-5 py-4">
          <p className="text-xs text-slate-500">{footerHint}</p>
          <div className="flex shrink-0 gap-2">
            {dismissible ? (
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5 disabled:cursor-wait disabled:opacity-40"
              >
                {cancelLabel}
              </button>
            ) : null}
            <button
              type="button"
              data-testid="initiative-confirm-submit"
              onClick={onConfirm}
              disabled={submitting || entries.length === 0}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 px-4 py-2 text-sm font-bold text-slate-950 shadow-lg hover:from-amber-300 hover:to-amber-500 disabled:cursor-wait disabled:opacity-45"
            >
              <Play className="h-4 w-4" />
              {submitting ? submittingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
