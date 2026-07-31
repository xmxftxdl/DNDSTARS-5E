import type { Dispatch, SetStateAction } from 'react'
import type {
  SharedBardicInspirationPromptView,
  SharedCuttingWordsPromptView,
  SharedDarkOnesOwnLuckPromptView,
  SharedEmpoweredSpellPromptView,
  SharedPluginChoicePromptView,
  SharedStandAgainstTidePromptView,
  SharedStrokeOfLuckPromptView,
} from '../../lib/combatInterruptPrompts'

interface ClassFeatureInterruptPanelsProps {
  now: number
  pluginChoicePrompt: SharedPluginChoicePromptView | null
  bardicInspirationPrompt: SharedBardicInspirationPromptView | null
  cuttingWordsPrompt: SharedCuttingWordsPromptView | null
  darkOnesOwnLuckPrompt: SharedDarkOnesOwnLuckPromptView | null
  strokeOfLuckPrompt: SharedStrokeOfLuckPromptView | null
  empoweredSpellPrompt: SharedEmpoweredSpellPromptView | null
  empoweredSpellSelection: string[]
  standAgainstTidePrompt: SharedStandAgainstTidePromptView | null
  onPluginChoice: (optionId: string) => void | Promise<void>
  onBardicInspirationChoice: (use: boolean) => void
  onCuttingWordsChoice: (use: boolean) => void
  onDarkOnesOwnLuckChoice: (use: boolean) => void
  onStrokeOfLuckChoice: (use: boolean) => void
  setEmpoweredSpellSelection: Dispatch<SetStateAction<string[]>>
  onEmpoweredSpellChoice: (selection: string[]) => void
  onStandAgainstTideChoice: (targetTokenId?: string) => void
}

export default function ClassFeatureInterruptPanels(props: ClassFeatureInterruptPanelsProps) {
  const {
    pluginChoicePrompt: sharedPluginChoicePrompt,
    bardicInspirationPrompt: sharedBardicInspirationPrompt,
    cuttingWordsPrompt: sharedCuttingWordsPrompt,
    darkOnesOwnLuckPrompt: sharedDarkOnesOwnLuckPrompt,
    strokeOfLuckPrompt: sharedStrokeOfLuckPrompt,
    empoweredSpellPrompt: sharedEmpoweredSpellPrompt,
    empoweredSpellSelection: sharedEmpoweredSpellSelection,
    standAgainstTidePrompt: sharedStandAgainstTidePrompt,
    onPluginChoice: handleSharedPluginChoice,
    onBardicInspirationChoice: handleSharedBardicInspirationChoice,
    onCuttingWordsChoice: handleSharedCuttingWordsChoice,
    onDarkOnesOwnLuckChoice: handleSharedDarkOnesOwnLuckChoice,
    onStrokeOfLuckChoice: handleSharedStrokeOfLuckChoice,
    setEmpoweredSpellSelection: setSharedEmpoweredSpellSelection,
    onEmpoweredSpellChoice: handleSharedEmpoweredSpellChoice,
    onStandAgainstTideChoice: handleSharedStandAgainstTideChoice,
    now: sharedDodgeNow,
  } = props

  return (
    <>
      {sharedPluginChoicePrompt && (
        <div className="absolute inset-0 z-[62] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-plugin-choice-title"
            className="relative my-auto flex max-h-[calc(100%-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedPluginChoicePrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                {Math.max(0, Math.ceil((sharedPluginChoicePrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <div className="pr-16">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300/70">
                扩展规则 · Headless Interrupt
              </p>
              <h3 id="shared-plugin-choice-title" className="mt-1 text-lg font-semibold text-violet-100">
                {sharedPluginChoicePrompt.payload.featureName}
              </h3>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {sharedPluginChoicePrompt.payload.prompt}
            </p>
            <div
              data-testid="shared-plugin-choice-options"
              className="mt-5 grid min-h-0 gap-2 overflow-y-auto pr-1"
            >
              {sharedPluginChoicePrompt.payload.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  data-testid={`shared-plugin-choice-${option.id}`}
                  onClick={() => void handleSharedPluginChoice(option.id)}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:border-violet-400/35 hover:bg-violet-500/10"
                >
                  <span className="block text-sm font-semibold text-slate-100">{option.label}</span>
                  {option.description && (
                    <span className="mt-1 block text-xs leading-5 text-slate-400">{option.description}</span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-500">
              超时将采用“{
                sharedPluginChoicePrompt.payload.options.find((option) =>
                  option.id === sharedPluginChoicePrompt.payload.defaultOptionId
                )?.label ?? sharedPluginChoicePrompt.payload.defaultOptionId
              }”，事务锁定期间不会重复结算。
            </p>
          </div>
        </div>
      )}

      {sharedBardicInspirationPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-bardic-inspiration-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-amber-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedBardicInspirationPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-100">
                {Math.max(0, Math.ceil((sharedBardicInspirationPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-bardic-inspiration-prompt-title" className="text-lg font-semibold text-amber-100">
              {sharedBardicInspirationPrompt.source === 'active-effect'
                ? sharedBardicInspirationPrompt.sourceLabel ?? '奖励骰'
                : sharedBardicInspirationPrompt.source === 'peerless-skill'
                  ? '超凡技艺'
                  : '吟游激励'}
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {`${sharedBardicInspirationPrompt.targetChar.name} 的${sharedBardicInspirationPrompt.rollType}当前结果为 ${sharedBardicInspirationPrompt.total}，目标值为 ${sharedBardicInspirationPrompt.targetNumber}。\n\n是否使用${sharedBardicInspirationPrompt.source === 'active-effect' ? `“${sharedBardicInspirationPrompt.sourceLabel ?? '奖励骰'}”的` : '一枚'} d${sharedBardicInspirationPrompt.dieSides}${sharedBardicInspirationPrompt.source === 'peerless-skill' ? ' 吟游激励骰发动超凡技艺' : sharedBardicInspirationPrompt.source === 'held-inspiration' || sharedBardicInspirationPrompt.source == null ? ' 吟游激励骰' : ' 奖励骰'}并加入结果？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedBardicInspirationChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                暂不使用
              </button>
              <button
                type="button"
                data-testid="shared-bardic-inspiration-use"
                data-bardic-inspiration-id={sharedBardicInspirationPrompt.id}
                onClick={() => handleSharedBardicInspirationChoice(true)}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35"
              >
                使用 d{sharedBardicInspirationPrompt.dieSides}
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedCuttingWordsPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-cutting-words-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedCuttingWordsPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                {Math.max(0, Math.ceil((sharedCuttingWordsPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-cutting-words-prompt-title" className="text-lg font-semibold text-violet-100">
              尖刻言辞
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {sharedCuttingWordsPrompt.phase === 'ability-check'
                ? `${sharedCuttingWordsPrompt.attackerName} 正在进行${sharedCuttingWordsPrompt.attackName}，检定总值 ${sharedCuttingWordsPrompt.total}${sharedCuttingWordsPrompt.targetNumber == null ? '' : ` vs DC ${sharedCuttingWordsPrompt.targetNumber}`}。\n\n${sharedCuttingWordsPrompt.bardChar.name} 是否消耗反应和一枚 d${sharedCuttingWordsPrompt.dieSides} 吟游激励骰？`
                : `${sharedCuttingWordsPrompt.attackerName} 正以${sharedCuttingWordsPrompt.attackName}攻击 ${sharedCuttingWordsPrompt.targetName}，${sharedCuttingWordsPrompt.phase === 'attack' ? `攻击总值 ${sharedCuttingWordsPrompt.total}${sharedCuttingWordsPrompt.targetNumber == null ? '' : ` vs AC ${sharedCuttingWordsPrompt.targetNumber}`}` : `伤害总值 ${sharedCuttingWordsPrompt.total}`}。\n\n${sharedCuttingWordsPrompt.bardChar.name} 是否消耗反应和一枚 d${sharedCuttingWordsPrompt.dieSides} 吟游激励骰？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedCuttingWordsChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留反应
              </button>
              <button
                type="button"
                data-testid="shared-cutting-words-use"
                data-cutting-words-id={sharedCuttingWordsPrompt.id}
                onClick={() => handleSharedCuttingWordsChoice(true)}
                className="rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35"
              >
                使用 d{sharedCuttingWordsPrompt.dieSides}
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedDarkOnesOwnLuckPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-dark-ones-own-luck-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedDarkOnesOwnLuckPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                {Math.max(0, Math.ceil((sharedDarkOnesOwnLuckPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-dark-ones-own-luck-prompt-title" className="text-lg font-semibold text-violet-100">
              黑暗之主的幸运
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {`${sharedDarkOnesOwnLuckPrompt.targetChar.name} 的${sharedDarkOnesOwnLuckPrompt.rollType}当前结果为 ${sharedDarkOnesOwnLuckPrompt.total}${sharedDarkOnesOwnLuckPrompt.targetNumber == null ? '' : `，目标值为 ${sharedDarkOnesOwnLuckPrompt.targetNumber}`}。\n\n是否消耗一次黑暗之主的幸运，并把 1d10 加入结果？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedDarkOnesOwnLuckChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留次数
              </button>
              <button
                type="button"
                data-testid="shared-dark-ones-own-luck-use"
                data-dark-ones-own-luck-id={sharedDarkOnesOwnLuckPrompt.id}
                onClick={() => handleSharedDarkOnesOwnLuckChoice(true)}
                className="rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35"
              >
                使用 1d10
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedStrokeOfLuckPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-stroke-of-luck-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-amber-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedStrokeOfLuckPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-100">
                {Math.max(0, Math.ceil((sharedStrokeOfLuckPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-stroke-of-luck-prompt-title" className="text-lg font-semibold text-amber-100">
              幸运一击
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {sharedStrokeOfLuckPrompt.rollType === 'ability-check'
                ? `${sharedStrokeOfLuckPrompt.actorChar.name} 的${sharedStrokeOfLuckPrompt.attackName}结果为 ${sharedStrokeOfLuckPrompt.total}，未达到 DC ${sharedStrokeOfLuckPrompt.armorClass}。\n\n是否消耗一次幸运一击，将本次 d20 视为 20？`
                : `${sharedStrokeOfLuckPrompt.actorChar.name} 的${sharedStrokeOfLuckPrompt.attackName}未命中 ${sharedStrokeOfLuckPrompt.targetName}（${sharedStrokeOfLuckPrompt.total} vs AC ${sharedStrokeOfLuckPrompt.armorClass}）。\n\n是否消耗一次幸运一击，将这次未命中改为命中？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedStrokeOfLuckChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留次数
              </button>
              <button
                type="button"
                data-testid="shared-stroke-of-luck-use"
                data-stroke-of-luck-id={sharedStrokeOfLuckPrompt.id}
                onClick={() => handleSharedStrokeOfLuckChoice(true)}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35"
              >
                使用幸运一击
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedEmpoweredSpellPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-empowered-spell-prompt-title"
            className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-rose-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedEmpoweredSpellPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-rose-300/40 bg-rose-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-rose-100">
                {Math.max(0, Math.ceil((sharedEmpoweredSpellPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-empowered-spell-prompt-title" className="pr-14 text-lg font-semibold text-rose-100">
              强化法术 · {sharedEmpoweredSpellPrompt.spellName}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              伤害骰已经掷出。选择至多 {sharedEmpoweredSpellPrompt.maximumDice} 枚骰重掷；新结果必须采用。
              当前已选 {sharedEmpoweredSpellSelection.length}/{sharedEmpoweredSpellPrompt.maximumDice}。
            </p>
            <div className="mt-4 space-y-3">
              {sharedEmpoweredSpellPrompt.groups.map((group) => (
                <div key={group.key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold text-slate-300">{group.label} · d{group.sides}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {group.rolls.map((value, dieIndex) => {
                      const key = `${group.key}:${dieIndex}`
                      const selected = sharedEmpoweredSpellSelection.includes(key)
                      return <button
                        key={key}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSharedEmpoweredSpellSelection((current) => {
                          if (current.includes(key)) return current.filter((entry) => entry !== key)
                          if (current.length >= sharedEmpoweredSpellPrompt.maximumDice) return current
                          return [...current, key]
                        })}
                        className={`min-w-11 rounded-lg border px-3 py-2 text-sm font-bold tabular-nums ${selected ? 'border-rose-300 bg-rose-400/20 text-rose-50' : 'border-white/10 bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]'}`}
                      >
                        {value}
                      </button>
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedEmpoweredSpellChoice([])}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                不使用
              </button>
              <button
                type="button"
                data-testid="shared-empowered-spell-use"
                data-empowered-spell-id={sharedEmpoweredSpellPrompt.id}
                disabled={sharedEmpoweredSpellSelection.length < 1}
                onClick={() => handleSharedEmpoweredSpellChoice(sharedEmpoweredSpellSelection)}
                className="rounded-lg bg-rose-500/25 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                消耗1术法点并重掷
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedStandAgainstTidePrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-stand-against-tide-prompt-title"
            className="relative mx-4 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-emerald-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedStandAgainstTidePrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-100">
                {Math.max(0, Math.ceil((sharedStandAgainstTidePrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-stand-against-tide-prompt-title" className="pr-14 text-lg font-semibold text-emerald-100">
              逆流反击
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {sharedStandAgainstTidePrompt.attackerName} 的{sharedStandAgainstTidePrompt.attackName}未命中
              {' '}{sharedStandAgainstTidePrompt.hunterChar.name}。可消耗反应，迫使攻击者以同一攻击改攻其触及范围内的另一生物。
            </p>
            <div className="mt-4 grid gap-2">
              {sharedStandAgainstTidePrompt.candidates.map((candidate) => (
                <button
                  key={candidate.tokenId}
                  type="button"
                  data-testid="shared-stand-against-tide-target"
                  data-target-token-id={candidate.tokenId}
                  onClick={() => handleSharedStandAgainstTideChoice(candidate.tokenId)}
                  className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-left text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20"
                >
                  改攻 {candidate.label}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => handleSharedStandAgainstTideChoice()}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留反应
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  )
}
