import { useMemo, useState } from 'react'
import { Award, Scale, Skull, SlidersHorizontal, Users } from 'lucide-react'
import {
  evenCombatExperienceAwards,
  type CombatExperienceAward,
  type CombatExperienceDistributionMode,
  type CombatExperienceDraft,
} from '../../lib/combatExperience'

interface DefeatedMonsterGroup {
  key: string
  name: string
  challengeRating?: string
  count: number
  xpEach: number
}

function groupDefeatedMonsters(draft: CombatExperienceDraft): DefeatedMonsterGroup[] {
  const groups = new Map<string, DefeatedMonsterGroup>()
  for (const monster of draft.defeatedMonsters) {
    const key = `${monster.monsterId ?? monster.name}:${monster.challengeRating ?? ''}:${monster.xp}`
    const current = groups.get(key)
    if (current) current.count += 1
    else groups.set(key, {
      key,
      name: monster.name,
      challengeRating: monster.challengeRating,
      count: 1,
      xpEach: monster.xp,
    })
  }
  return [...groups.values()]
}

export default function CombatExperienceSettlementDialog({
  draft,
  busy = false,
  onSettle,
}: {
  draft: CombatExperienceDraft
  busy?: boolean
  onSettle: (
    mode: CombatExperienceDistributionMode,
    awards: CombatExperienceAward[],
  ) => void | Promise<void>
}) {
  const evenAwards = useMemo(() => evenCombatExperienceAwards(draft), [draft])
  const [mode, setMode] = useState<'even' | 'manual'>('even')
  const [manualXp, setManualXp] = useState<Record<string, number>>(() =>
    Object.fromEntries(evenAwards.map((award) => [award.characterId, award.xp])),
  )

  const groups = groupDefeatedMonsters(draft)
  const awards = mode === 'even'
    ? evenAwards
    : draft.participants.map((participant) => ({
        characterId: participant.characterId,
        characterName: participant.name,
        xp: manualXp[participant.characterId] ?? 0,
      }))
  const allocated = awards.reduce((total, award) => total + award.xp, 0)
  const remaining = draft.totalXp - allocated
  const canAward = draft.participants.length > 0 && remaining === 0

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" data-testid="combat-experience-dialog">
      <div className="glass max-h-[min(820px,94vh)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-amber-300/15 shadow-2xl">
        <header className="border-b border-white/8 px-6 py-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
              <Award className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-white">战斗经验结算</h2>
              <p className="mt-1 text-sm text-slate-400">经验值来自本场已被击败且具有 SRD／CR 数据的敌人，由 DM 最终确认。</p>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-6">
          <section className="rounded-2xl border border-white/8 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Skull className="h-4 w-4 text-rose-300" />
                击败怪物
              </div>
              <div className="text-right">
                <p className="text-2xl font-black tabular-nums text-amber-200">{draft.totalXp.toLocaleString('zh-CN')} XP</p>
                <p className="text-[11px] text-slate-500">{draft.defeatedMonsters.length} 个敌方单位</p>
              </div>
            </div>
            <div className="mt-3 divide-y divide-white/6 rounded-xl border border-white/6 bg-void-950/35">
              {groups.map((group) => (
                <div key={group.key} className="flex items-center justify-between gap-4 px-3 py-2.5 text-xs">
                  <span className="font-medium text-slate-200">
                    {group.name}{group.challengeRating ? ` · CR ${group.challengeRating}` : ''}
                    {group.count > 1 ? ` ×${group.count}` : ''}
                  </span>
                  <span className="tabular-nums text-amber-200">{(group.xpEach * group.count).toLocaleString('zh-CN')} XP</span>
                </div>
              ))}
              {groups.length === 0 && <p className="px-3 py-5 text-center text-xs text-slate-500">本场没有可计入经验值的已败怪物。</p>}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Scale className="h-4 w-4 text-violet-300" />
              分配方式
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode('even')}
                className={`rounded-2xl border p-4 text-left transition ${mode === 'even' ? 'border-violet-400/45 bg-violet-500/15' : 'border-white/8 bg-white/[0.025] hover:border-white/15'}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100"><Users className="h-4 w-4" />平均分配</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">按参战角色平均分配；不能整除的余数按先攻参与顺序逐点发放。</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('manual')}
                className={`rounded-2xl border p-4 text-left transition ${mode === 'manual' ? 'border-violet-400/45 bg-violet-500/15' : 'border-white/8 bg-white/[0.025] hover:border-white/15'}`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-100"><SlidersHorizontal className="h-4 w-4" />自由分配</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-500">DM 逐个填写奖励；总和必须等于本场经验值，避免重复或凭空增加。</span>
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/8">
            <div className="grid grid-cols-[minmax(0,1fr)_130px_110px] gap-3 bg-white/[0.035] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>参战角色</span>
              <span className="text-right">当前经验</span>
              <span className="text-right">本场奖励</span>
            </div>
            {draft.participants.map((participant) => {
              const award = awards.find((candidate) => candidate.characterId === participant.characterId)?.xp ?? 0
              return (
                <div key={participant.characterId} className="grid grid-cols-[minmax(0,1fr)_130px_110px] items-center gap-3 border-t border-white/6 px-4 py-3 text-sm">
                  <span className="truncate font-semibold text-slate-100">{participant.name}</span>
                  <span className="text-right tabular-nums text-slate-400">{participant.experienceBefore.toLocaleString('zh-CN')} XP</span>
                  {mode === 'manual' ? (
                    <input
                      type="number"
                      min={0}
                      max={draft.totalXp}
                      step={1}
                      value={manualXp[participant.characterId] ?? 0}
                      onChange={(event) => setManualXp((current) => ({
                        ...current,
                        [participant.characterId]: Math.min(
                          draft.totalXp,
                          Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        ),
                      }))}
                      className="w-full rounded-lg border border-white/10 bg-void-950 px-2.5 py-1.5 text-right text-sm tabular-nums text-amber-100 outline-none focus:border-violet-400/50"
                    />
                  ) : (
                    <span className="text-right font-bold tabular-nums text-amber-200">+{award.toLocaleString('zh-CN')}</span>
                  )}
                </div>
              )
            })}
            {draft.participants.length === 0 && <p className="border-t border-white/6 px-4 py-6 text-center text-sm text-slate-500">先攻列表中没有可接收经验值的角色。</p>}
          </section>

          <div className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${remaining === 0 ? 'border-emerald-300/15 bg-emerald-500/8' : 'border-amber-300/15 bg-amber-500/8'}`}>
            <span className="text-slate-400">已分配 {allocated.toLocaleString('zh-CN')} XP</span>
            <span className={`font-bold tabular-nums ${remaining === 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
              {remaining === 0
                ? '分配完成'
                : remaining > 0
                  ? `剩余 ${remaining.toLocaleString('zh-CN')} XP`
                  : `超出 ${Math.abs(remaining).toLocaleString('zh-CN')} XP`}
            </span>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-white/8 pt-5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSettle('none', [])}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40"
            >
              本场不发放
            </button>
            <button
              type="button"
              disabled={busy || !canAward}
              onClick={() => void onSettle(mode, awards)}
              className="rounded-xl border border-amber-300/20 bg-amber-500/15 px-5 py-2.5 text-sm font-bold text-amber-100 hover:bg-amber-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? '正在写入…' : `确认发放 ${draft.totalXp.toLocaleString('zh-CN')} XP`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
