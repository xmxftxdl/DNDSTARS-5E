import type {
  SharedCounterspellPromptView,
  SharedDeflectMissilesPromptView,
  SharedOpportunityAttackPromptView,
  SharedProtectionPromptView,
  SharedSavingThrowRerollPromptView,
  SharedShieldSpellPromptView,
  SharedUncannyDodgePromptView,
} from '../../lib/combatInterruptPrompts'

interface ReactionInterruptPanelsProps {
  now: number
  savingThrowRerollPrompt: SharedSavingThrowRerollPromptView | null
  protectionPrompt: SharedProtectionPromptView | null
  shieldSpellPrompt: SharedShieldSpellPromptView | null
  counterspellPrompt: SharedCounterspellPromptView | null
  uncannyDodgePrompt: SharedUncannyDodgePromptView | null
  deflectMissilesPrompt: SharedDeflectMissilesPromptView | null
  opportunityAttackPrompt: SharedOpportunityAttackPromptView | null
  onSavingThrowRerollChoice: (use: boolean) => void
  onProtectionChoice: (use: boolean) => void
  onShieldSpellChoice: (use: boolean) => void
  onCounterspellChoice: (use: boolean) => void
  onUncannyDodgeChoice: (use: boolean) => void
  onDeflectMissilesChoice: (use: boolean) => void
  onOpportunityAttackChoice: (use: boolean) => void
}

export default function ReactionInterruptPanels(props: ReactionInterruptPanelsProps) {
  const {
    savingThrowRerollPrompt: sharedSavingThrowRerollPrompt,
    protectionPrompt: sharedProtectionPrompt,
    shieldSpellPrompt: sharedShieldSpellPrompt,
    counterspellPrompt: sharedCounterspellPrompt,
    uncannyDodgePrompt: sharedUncannyDodgePrompt,
    deflectMissilesPrompt: sharedDeflectMissilesPrompt,
    opportunityAttackPrompt: sharedOpportunityAttackPrompt,
    onSavingThrowRerollChoice: handleSharedSavingThrowRerollChoice,
    onProtectionChoice: handleSharedProtectionChoice,
    onShieldSpellChoice: handleSharedShieldSpellChoice,
    onCounterspellChoice: handleSharedCounterspellChoice,
    onUncannyDodgeChoice: handleSharedUncannyDodgeChoice,
    onDeflectMissilesChoice: handleSharedDeflectMissilesChoice,
    onOpportunityAttackChoice: handleSharedOpportunityAttackChoice,
    now: sharedDodgeNow,
  } = props

  return (
    <>
      {sharedSavingThrowRerollPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-saving-throw-reroll-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedSavingThrowRerollPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                {Math.max(0, Math.ceil((sharedSavingThrowRerollPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-saving-throw-reroll-prompt-title" className="text-lg font-semibold text-violet-100">
              {sharedSavingThrowRerollPrompt.featureName}
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {`${sharedSavingThrowRerollPrompt.targetChar.name} 的豁免结果 ${sharedSavingThrowRerollPrompt.total} 未达到 DC ${sharedSavingThrowRerollPrompt.dc}。\n\n是否消耗一次${sharedSavingThrowRerollPrompt.featureName}重掷？重掷后必须采用新结果。`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedSavingThrowRerollChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留资源
              </button>
              <button
                type="button"
                data-testid="shared-saving-throw-reroll-use"
                data-saving-throw-reroll-id={sharedSavingThrowRerollPrompt.id}
                onClick={() => handleSharedSavingThrowRerollChoice(true)}
                className="rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35"
              >
                使用{sharedSavingThrowRerollPrompt.featureName}
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedProtectionPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-protection-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-sky-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedProtectionPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-sky-300/40 bg-sky-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-100">
                {Math.max(0, Math.ceil((sharedProtectionPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-protection-prompt-title" className="text-lg font-semibold text-sky-100">
              防护战斗风格
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {`${sharedProtectionPrompt.attackerName} 正以${sharedProtectionPrompt.attackName}攻击 ${sharedProtectionPrompt.targetName}。\n\n${sharedProtectionPrompt.protectorChar.name} 是否消耗反应，使这次攻击检定具有劣势？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedProtectionChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留反应
              </button>
              <button
                type="button"
                data-testid="shared-protection-use"
                data-protection-id={sharedProtectionPrompt.id}
                onClick={() => handleSharedProtectionChoice(true)}
                className="rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/35"
              >
                使用防护
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedShieldSpellPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-shield-spell-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedShieldSpellPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                {Math.max(0, Math.ceil((sharedShieldSpellPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-shield-spell-prompt-title" className="text-lg font-semibold text-violet-100">
              护盾术
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {sharedShieldSpellPrompt.magicMissile
                ? `${sharedShieldSpellPrompt.attackerName} 的魔法飞弹指定了 ${sharedShieldSpellPrompt.targetChar.name}。\n\n是否消耗反应和当前最低可用法术位，使自己免疫这些飞弹并获得 +5 AC？`
                : `${sharedShieldSpellPrompt.attackerName} 的${sharedShieldSpellPrompt.attackName}以 ${sharedShieldSpellPrompt.attackTotal ?? '—'} 命中 ${sharedShieldSpellPrompt.targetChar.name}（AC ${sharedShieldSpellPrompt.armorClass ?? '—'}）。\n\n是否消耗反应和当前最低可用法术位，使 AC 获得 +5？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedShieldSpellChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留反应
              </button>
              <button
                type="button"
                data-testid="shared-shield-spell-use"
                data-shield-spell-id={sharedShieldSpellPrompt.id}
                onClick={() => handleSharedShieldSpellChoice(true)}
                className="rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35"
              >
                施放护盾术
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedCounterspellPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-counterspell-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-violet-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedCounterspellPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-violet-300/40 bg-violet-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-100">
                {Math.max(0, Math.ceil((sharedCounterspellPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-counterspell-prompt-title" className="text-lg font-semibold text-violet-100">法术反制</h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {`${sharedCounterspellPrompt.casterName} 正在施放${sharedCounterspellPrompt.spellName}（${sharedCounterspellPrompt.spellLevel} 环）。\n\n${sharedCounterspellPrompt.reactorChar.name} 是否消耗反应和 ${sharedCounterspellPrompt.counterspellSlotLevel} 环法术位进行反制？${sharedCounterspellPrompt.abilityCheckDc ? `\n需要进行 DC ${sharedCounterspellPrompt.abilityCheckDc} 的施法属性检定。` : ''}`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => handleSharedCounterspellChoice(false)} className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80">保留反应</button>
              <button type="button" data-testid="shared-counterspell-use" onClick={() => handleSharedCounterspellChoice(true)} className="rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-semibold text-violet-100 hover:bg-violet-500/35">施放法术反制</button>
            </div>
          </div>
        </div>
      )}

      {sharedUncannyDodgePrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-uncanny-dodge-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-sky-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedUncannyDodgePrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-sky-300/40 bg-sky-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-100">
                {Math.max(0, Math.ceil((sharedUncannyDodgePrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-uncanny-dodge-prompt-title" className="text-lg font-semibold text-sky-100">
              直觉闪避
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {`${sharedUncannyDodgePrompt.attackerName} 的${sharedUncannyDodgePrompt.attackName}命中了 ${sharedUncannyDodgePrompt.targetChar.name}。\n\n是否消耗反应，将这次攻击造成的伤害减半？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedUncannyDodgeChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                保留反应
              </button>
              <button
                type="button"
                data-testid="shared-uncanny-dodge-use"
                data-uncanny-dodge-id={sharedUncannyDodgePrompt.id}
                onClick={() => handleSharedUncannyDodgeChoice(true)}
                className="rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/35"
              >
                发动直觉闪避
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedDeflectMissilesPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-deflect-missiles-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-sky-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedDeflectMissilesPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-sky-300/40 bg-sky-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-sky-100">
                {Math.max(0, Math.ceil((sharedDeflectMissilesPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-deflect-missiles-prompt-title" className="text-lg font-semibold text-sky-100">
              拨挡飞弹
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {sharedDeflectMissilesPrompt.phase === 'return'
                ? `${sharedDeflectMissilesPrompt.targetChar.name} 已接住 ${sharedDeflectMissilesPrompt.attackerName} 的飞弹。\n\n是否消耗 1 点气，将飞弹掷回攻击者？（当前气：${sharedDeflectMissilesPrompt.kiCurrent ?? 0}）`
                : `${sharedDeflectMissilesPrompt.attackerName} 的${sharedDeflectMissilesPrompt.attackName}命中了 ${sharedDeflectMissilesPrompt.targetChar.name}。\n\n是否消耗反应，令伤害减少 1d10＋敏捷调整值＋武僧等级？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedDeflectMissilesChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                {sharedDeflectMissilesPrompt.phase === 'return' ? '不掷回' : '保留反应'}
              </button>
              <button
                type="button"
                data-testid="shared-deflect-missiles-use"
                data-deflect-missiles-id={sharedDeflectMissilesPrompt.id}
                onClick={() => handleSharedDeflectMissilesChoice(true)}
                className="rounded-lg bg-sky-500/25 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/35"
              >
                {sharedDeflectMissilesPrompt.phase === 'return' ? '消耗 1 气掷回' : '发动拨挡飞弹'}
              </button>
            </div>
          </div>
        </div>
      )}

      {sharedOpportunityAttackPrompt && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm">
          <div
            role="dialog"
            aria-labelledby="shared-opportunity-attack-prompt-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-amber-400/35 bg-void-950/95 p-5 shadow-2xl"
          >
            {sharedOpportunityAttackPrompt.expiresAt != null && (
              <div className="absolute right-5 top-5 rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-100">
                {Math.max(0, Math.ceil((sharedOpportunityAttackPrompt.expiresAt - sharedDodgeNow) / 1000))}s
              </div>
            )}
            <h3 id="shared-opportunity-attack-prompt-title" className="text-lg font-semibold text-amber-100">
              {sharedOpportunityAttackPrompt.trigger === 'berserker-retaliation'
                ? '报复'
                : sharedOpportunityAttackPrompt.trigger === 'hunter-giant-killer'
                  ? '巨人杀手'
                  : '借机攻击'}
            </h3>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
              {sharedOpportunityAttackPrompt.trigger === 'berserker-retaliation'
                ? `${sharedOpportunityAttackPrompt.targetName} 在 5 尺内对 ${sharedOpportunityAttackPrompt.attackerChar.name} 造成了伤害。\n\n是否消耗反应，发动报复并进行一次近战武器攻击？`
                : sharedOpportunityAttackPrompt.trigger === 'hunter-giant-killer'
                  ? `${sharedOpportunityAttackPrompt.targetName} 在 5 尺内对 ${sharedOpportunityAttackPrompt.attackerChar.name} 完成了一次攻击。\n\n是否消耗反应，发动巨人杀手并进行一次近战武器攻击？`
                  : `${sharedOpportunityAttackPrompt.attackerChar.name} 对 ${sharedOpportunityAttackPrompt.targetName} 触发借机攻击。\n\n是否消耗反应，进行一次近战命中判定？`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSharedOpportunityAttackChoice(false)}
                className="rounded-lg border border-slate-600/60 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700/80"
              >
                {sharedOpportunityAttackPrompt.trigger === 'movement' ? '放过' : '保留反应'}
              </button>
              <button
                type="button"
                data-testid="shared-opportunity-attack-use"
                data-opportunity-attack-id={sharedOpportunityAttackPrompt.id}
                onClick={() => handleSharedOpportunityAttackChoice(true)}
                className="rounded-lg bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35"
              >
                {sharedOpportunityAttackPrompt.trigger === 'berserker-retaliation'
                  ? '发动报复'
                  : sharedOpportunityAttackPrompt.trigger === 'hunter-giant-killer'
                    ? '发动巨人杀手'
                    : '发动借机'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

