import { useMemo, useState } from 'react'
import { Dices, Play, X } from 'lucide-react'
import type { Dnd5eCustomMonsterDraft } from '../../rulesets/dnd5e/customMonsterWorkshop'
import type { Dnd5eMonsterStatBlock } from '../../rulesets/dnd5e/monsters'
import {
  listDnd5eMonsterWorkshopSandboxActions,
  runDnd5eMonsterWorkshopSandbox,
  type Dnd5eMonsterWorkshopSandboxResult,
} from '../../rulesets/dnd5e/monsterWorkshopSandbox'

interface Props {
  draft: Dnd5eCustomMonsterDraft
  monsterCatalog: readonly Dnd5eMonsterStatBlock[]
  onClose: () => void
}

function inputClass(): string {
  return 'mt-1 w-full rounded-lg border border-white/10 bg-void-950/80 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400/60'
}

function numericValue(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function damageRollText(result: Dnd5eMonsterWorkshopSandboxResult): string {
  if (result.ok && result.kind === 'summon') {
    return result.rolls.summonCountRolls?.length
      ? `数量骰 [${result.rolls.summonCountRolls.join(', ')}]`
      : '固定数量（无需掷骰）'
  }
  if (!result.ok || result.rolls.damageRolls.length === 0) return '无伤害骰'
  if ((result.rolls.attacks?.length ?? 0) > 1) {
    return result.rolls.attacks!.map((attack, index) =>
      `${index + 1}. ${attack.actionName} d20=${attack.d20} [${attack.damageRolls.map((component) => component.join(', ')).join('] + [')}]`,
    ).join('；')
  }
  return result.rolls.damageRolls
    .map((component) => `[${component.join(', ')}]`)
    .join(' + ')
}

function actionKindLabel(kind: ReturnType<typeof listDnd5eMonsterWorkshopSandboxActions>[number]['kind']): string {
  if (kind === 'weapon-attack') return '攻击'
  if (kind === 'area-saving-throw') return '范围豁免'
  if (kind === 'summon') return '召唤'
  if (kind === 'multiattack') return '多重攻击'
  if (kind === 'legendary-action') return '传奇动作'
  if (kind === 'bonus-action') return '附赠动作'
  return '反应'
}

export default function Dnd5eMonsterHeadlessSandbox({ draft, monsterCatalog, onClose }: Props) {
  const actions = useMemo(() => listDnd5eMonsterWorkshopSandboxActions(draft), [draft])
  const [actionId, setActionId] = useState(() => actions[0]?.id ?? '')
  const [targetArmorClass, setTargetArmorClass] = useState('14')
  const [targetHitPoints, setTargetHitPoints] = useState('35')
  const [savingThrowBonus, setSavingThrowBonus] = useState('2')
  const [fixedD20, setFixedD20] = useState('10')
  const [lastRun, setLastRun] = useState<{
    draft: Dnd5eCustomMonsterDraft
    fingerprint: string
    result: Dnd5eMonsterWorkshopSandboxResult
  }>()
  const effectiveActionId = actions.some((action) => action.id === actionId)
    ? actionId
    : actions[0]?.id ?? ''
  const selectedAction = actions.find((action) => action.id === effectiveActionId)
  const fingerprint = JSON.stringify({
    actionId: effectiveActionId,
    monsterCatalogIds: monsterCatalog.map((monster) => monster.id),
    targetArmorClass,
    targetHitPoints,
    savingThrowBonus,
    fixedD20,
  })
  const result = lastRun?.draft === draft && lastRun.fingerprint === fingerprint
    ? lastRun.result
    : undefined

  const run = (randomD20: boolean) => {
    if (!effectiveActionId) return
    const nextResult = runDnd5eMonsterWorkshopSandbox({
      draft,
      monsterCatalog,
      actionId: effectiveActionId,
      targetArmorClass: numericValue(targetArmorClass, 14),
      targetHitPoints: numericValue(targetHitPoints, 35),
      targetSavingThrowBonus: numericValue(savingThrowBonus, 0),
      d20: randomD20 ? undefined : numericValue(fixedD20, 10),
    })
    setLastRun({ draft, fingerprint, result: nextResult })
  }

  return (
    <section
      data-testid="monster-headless-sandbox"
      className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.055] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Dices className="h-4 w-4 text-cyan-300" />
            <h3 className="text-sm font-semibold text-cyan-100">Headless 隔离沙盒</h3>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-cyan-100/60">
            调用与真实战斗相同的权威事务；临时目标、HP 和骰子结果不会写入房间，也不会修改怪物草稿。
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="关闭 Headless 沙盒" className="rounded-lg p-1.5 text-cyan-100/60 hover:bg-white/5 hover:text-cyan-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      {actions.length === 0 ? (
        <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-xs leading-5 text-amber-100">
          当前没有可试运行的 Headless 武器攻击、范围豁免或召唤动作。请先补齐顶部必填项，并把动作结算设为 Headless。
        </div>
      ) : (
        <>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <label className="text-xs text-slate-400 md:col-span-2">
              试运行动作
              <select data-testid="monster-headless-sandbox-action" value={effectiveActionId} onChange={(event) => setActionId(event.target.value)} className={inputClass()}>
                {actions.map((action) => (
                  <option key={action.id} value={action.id}>{action.name} · {actionKindLabel(action.kind)}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              目标 AC
              <input aria-label="沙盒目标 AC" type="number" min={1} max={100} value={targetArmorClass} onChange={(event) => setTargetArmorClass(event.target.value)} className={inputClass()} />
            </label>
            <label className="text-xs text-slate-400">
              目标 HP
              <input aria-label="沙盒目标 HP" type="number" min={1} max={1000000} value={targetHitPoints} onChange={(event) => setTargetHitPoints(event.target.value)} className={inputClass()} />
            </label>
            <label className="text-xs text-slate-400">
              豁免加值
              <input aria-label="沙盒目标豁免加值" type="number" min={-100} max={100} disabled={selectedAction?.kind !== 'area-saving-throw'} value={savingThrowBonus} onChange={(event) => setSavingThrowBonus(event.target.value)} className={`${inputClass()} disabled:cursor-not-allowed disabled:opacity-40`} />
            </label>
            <label className="text-xs text-slate-400">
              固定 d20（含后续豁免）
              <input aria-label="沙盒固定 d20" type="number" min={1} max={20} disabled={selectedAction?.kind === 'summon'} value={fixedD20} onChange={(event) => setFixedD20(event.target.value)} className={`${inputClass()} disabled:cursor-not-allowed disabled:opacity-40`} />
            </label>
          </div>
          {selectedAction?.kind === 'reaction' && (
            <p className="mt-2 rounded-lg border border-cyan-400/15 bg-cyan-500/[0.04] px-3 py-2 text-[11px] leading-5 text-cyan-100/65">
              沙盒会模拟该反应已经取得一次绑定触发凭据；真实战斗中必须先完成其绑定动作，Headless 才会签发并允许消费这次反应。
            </p>
          )}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => run(false)} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
              <Play className="h-3.5 w-3.5" />按当前 d20 复现
            </button>
            <button data-testid="monster-headless-sandbox-random-run" type="button" onClick={() => run(true)} className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-400">
              <Dices className="h-3.5 w-3.5" />随机试运行
            </button>
          </div>
        </>
      )}

      {result && !result.ok && (
        <div data-testid="monster-headless-sandbox-result" className="mt-4 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] p-3 text-xs text-rose-100">
          <p className="font-semibold">试运行被拒绝</p>
          <p className="mt-1 leading-5 text-rose-100/75">{result.reason}</p>
          {result.eventSummaries.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-rose-100/65">
              {result.eventSummaries.map((summary, index) => <li key={`${index}-${summary}`}>{summary}</li>)}
            </ul>
          )}
        </div>
      )}

      {result?.ok && (
        <div data-testid="monster-headless-sandbox-result" className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-emerald-100">权威事务已接受 · {result.actionName}</p>
              <p className="mt-1 text-[11px] text-emerald-100/60">{result.kind === 'summon'
                ? `已验证 ${result.summon.monsterId} × ${result.summon.count} 的召唤声明`
                : `目标 HP ${result.targetHitPointsBefore} → ${result.targetHitPointsAfter}，实际承受 ${result.damageApplied} 点伤害`}</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${result.kind === 'summon'
              ? 'border-violet-400/25 bg-violet-500/10 text-violet-100'
              : result.kind !== 'area-saving-throw'
              ? result.attacks.some((attack) => attack.hit) ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-100' : 'border-slate-400/20 bg-white/5 text-slate-300'
              : result.save.success ? 'border-sky-400/25 bg-sky-500/10 text-sky-100' : 'border-amber-400/25 bg-amber-500/10 text-amber-100'}`}
            >
              {result.kind === 'summon'
                ? `召唤 ${result.summon.count} 个`
                : result.kind !== 'area-saving-throw'
                ? result.attacks.length > 1
                  ? `${result.attacks.filter((attack) => attack.hit).length}/${result.attacks.length} 命中`
                  : result.attack.critical ? '暴击命中' : result.attack.hit ? '命中' : '未命中'
                : result.save.success ? '豁免成功' : '豁免失败'}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-slate-300">
              <span className="text-slate-500">预掷：</span>{result.kind !== 'summon' && result.rolls.attacks?.length === 1 ? `d20 = ${result.rolls.d20}；伤害骰 ` : ''}{damageRollText(result)}
            </div>
            <div className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-slate-300">
              {result.kind === 'summon'
                ? <>{result.summon.timing === 'immediate' ? '立即出现' : '召唤者下回合开始时出现'} · 出现后持续 {result.summon.durationRounds} 轮{result.summon.concentration ? result.summon.concentrationEndsOnAppearance ? ' · 出现前专注' : ' · 存在期间专注' : ''}</>
                : result.kind !== 'area-saving-throw'
                ? result.attacks.length > 1
                  ? <>共结算 {result.attacks.length} 次攻击，命中 {result.attacks.filter((attack) => attack.hit).length} 次</>
                  : <>攻击总值 {result.attack.total} 对 AC {result.attack.armorClass}</>
                : <>{result.save.ability.toUpperCase()} 豁免 {result.save.total} 对 DC {result.save.dc}（加值 {result.save.modifier >= 0 ? '+' : ''}{result.save.modifier}）</>}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Headless 事件链</p>
            <ol className="mt-1.5 space-y-1 text-[11px] leading-5 text-slate-300">
              {result.eventSummaries.map((summary, index) => (
                <li key={`${index}-${summary}`} className="rounded-lg border border-white/[0.07] bg-black/10 px-2.5 py-1.5">
                  <span className="mr-1.5 text-cyan-300/60">{index + 1}.</span>{summary}
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </section>
  )
}
