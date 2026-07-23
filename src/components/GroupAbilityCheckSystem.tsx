import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, ChevronRight, CircleDashed, Dices, History, ShieldQuestion, X, XCircle } from 'lucide-react'
import { ABILITIES, SKILLS } from '../lib/dnd'
import {
  groupAbilityCheckAggregate,
  groupAbilityCheckName,
  type GroupAbilityCheckMode,
  type GroupAbilityCheckTransaction,
} from '../lib/groupAbilityChecks'
import { loadRoomRoster, roomApiErrorMessage, type RoomRosterMember } from '../lib/roomApi'
import { getRoomSession } from '../lib/roomSession'
import { useCharacterStore } from '../store/characters'
import { useGroupAbilityChecksStore } from '../store/groupAbilityChecks'
import { useMapStore } from '../store/maps'

const modeLabels: Record<GroupAbilityCheckMode, string> = {
  normal: '正常', advantage: '优势', disadvantage: '劣势',
}

function mutationError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  const messages: Record<string, string> = {
    'group-check-already-open': '已有一个群体检定等待结算，请先完成或取消。',
    'invalid-group-check-participant': '参与角色归属或当前控制状态已经变化，请刷新玩家列表。',
    'group-check-responses-pending': '仍有玩家尚未响应。',
    'passive-fallback-disabled': '本次检定未开启被动值兜底，不能替未响应者自动结算。',
    'group-check-expired': '该群体检定已超时，请等待 DM 处理。',
    'participant-character-missing': '角色已不存在或归属发生变化。',
  }
  return messages[code] ?? code
}

function characterForPlayer(player: RoomRosterMember, characters: ReturnType<typeof useCharacterStore.getState>['characters']) {
  const owned = characters.filter((character) => character.roomMemberId === player.memberId)
  return owned.find((character) =>
    (
      character.id === player.activeCharacterId || (!player.activeCharacterId && character.name === player.activeCharacterName)
    )) ?? (owned.length === 1 && !player.activeCharacterId && !player.activeCharacterName ? owned[0] : undefined)
}

export default function GroupAbilityCheckSystem() {
  const session = getRoomSession()
  const isDm = session?.role === 'dm'
  const shared = useGroupAbilityChecksStore((state) => state.state)
  const mutate = useGroupAbilityChecksStore((state) => state.mutate)
  const characters = useCharacterStore((state) => state.characters)
  const selectedMapId = useMapStore((state) => state.selectedId)
  const [open, setOpen] = useState(false)
  const [roster, setRoster] = useState<RoomRosterMember[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [selection, setSelection] = useState('skill:perception')
  const [label, setLabel] = useState('全队察觉检定')
  const [dc, setDc] = useState(12)
  const [mode, setMode] = useState<GroupAbilityCheckMode>('normal')
  const [passiveFallback, setPassiveFallback] = useState(true)
  const [excludedCharacterIds, setExcludedCharacterIds] = useState<Set<string>>(() => new Set())

  const openCheck = [...shared.checks].reverse().find((check) => check.status === 'open')
  const myCheck = !isDm && session
    ? [...shared.checks].reverse().find((check) => check.status === 'open' && check.participants.some((entry) => entry.memberId === session.memberId))
    : undefined
  const myResult = myCheck && session ? myCheck.results.find((entry) => entry.memberId === session.memberId) : undefined
  const shouldShowPlayerDialog = !!myCheck && !dismissed.has(myCheck.id)

  const refreshRoster = useCallback(async () => {
    if (!session || !isDm) return
    setLoadingRoster(true)
    try {
      const next = await loadRoomRoster(session)
      const current = next.players.filter((player) =>
        player.role === 'player' && (player.status === 'online' || player.status === 'temporarily-offline'))
      setRoster(current)
      setError(null)
    } catch (cause) {
      setError(roomApiErrorMessage(cause))
    } finally {
      setLoadingRoster(false)
    }
  }, [isDm, session])

  const selectedDefinition = useMemo(() => {
    const [kind, key] = selection.split(':')
    if (kind === 'skill') {
      const skill = SKILLS.find((entry) => entry.key === key) ?? SKILLS[0]
      return { ability: skill.ability, skill: skill.key, label: `${ABILITIES.find((entry) => entry.key === skill.ability)?.label}（${skill.label}）` }
    }
    const ability = ABILITIES.find((entry) => entry.key === key) ?? ABILITIES[0]
    return { ability: ability.key, label: ability.label }
  }, [selection])
  const selectedCharacterIds = useMemo(() => roster.flatMap((player) => {
    const character = characterForPlayer(player, characters)
    return character && !excludedCharacterIds.has(character.id) ? [character.id] : []
  }), [characters, excludedCharacterIds, roster])

  if (!session) return null

  const execute = async (operation: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await operation()
    } catch (cause) {
      setError(mutationError(cause))
    } finally {
      setBusy(false)
    }
  }

  const createCheck = () => execute(async () => {
    await mutate({
      operation: 'create', label, selection: selection as `ability:${typeof selectedDefinition.ability}` | `skill:${string}` | `save:${typeof selectedDefinition.ability}`,
      dc, mode, allowPassiveFallback: !selection.startsWith('save:') && passiveFallback,
      participantCharacterIds: selectedCharacterIds,
      ...(selectedMapId ? { mapId: selectedMapId } : {}),
    })
  })

  return (
    <>
      {isDm ? (
        <button
          type="button"
          onClick={() => { setOpen(true); void refreshRoster() }}
          className="fixed bottom-6 right-6 z-[110] flex items-center gap-2 rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-4 py-3 text-sm font-bold text-cyan-100 shadow-2xl shadow-black/40 backdrop-blur transition hover:border-cyan-300/45"
        >
          <Dices className="h-5 w-5" />
          群体检定
          {openCheck && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] text-slate-950">{openCheck.results.length}/{openCheck.participants.length}</span>}
        </button>
      ) : myCheck && dismissed.has(myCheck.id) ? (
        <button type="button" onClick={() => setDismissed((current) => { const next = new Set(current); next.delete(myCheck.id); return next })} className="fixed bottom-6 right-6 z-[110] flex items-center gap-2 rounded-2xl border border-cyan-300/25 bg-slate-950/95 px-4 py-3 text-sm font-bold text-cyan-100 shadow-2xl">
          <ShieldQuestion className="h-5 w-5" />{myResult ? '查看检定结果' : '待进行群体检定'}
        </button>
      ) : null}

      {isDm && open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="群体检定" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-cyan-300/20 bg-void-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="flex items-center gap-2 text-xl font-bold text-cyan-100"><Dices className="h-5 w-5" />群体检定</h2><p className="mt-1 text-sm text-slate-500">玩家分别响应，全部结果由 Host 计算；半数或更多成功时群体成功。</p></div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

            {openCheck ? (
              <GroupCheckSummary check={openCheck} busy={busy} onFinalize={(usePassiveForPending) => void execute(() => mutate({ operation: 'finalize', checkId: openCheck.id, usePassiveForPending }))} onCancel={() => void execute(() => mutate({ operation: 'cancel', checkId: openCheck.id }))} />
            ) : (
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <section className="space-y-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <label className="block text-xs text-slate-500">检定名称<input value={label} maxLength={160} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100" /></label>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_90px_120px]">
                    <label className="text-xs text-slate-500">检定项目<select value={selection} onChange={(event) => { const value = event.target.value; setSelection(value); const [kind, key] = value.split(':'); const nextName = kind === 'skill' ? SKILLS.find((entry) => entry.key === key)?.label : ABILITIES.find((entry) => entry.key === key)?.label; setLabel(`全队${nextName ?? '属性'}${kind === 'save' ? '豁免' : '检定'}`); if (kind === 'save') setPassiveFallback(false) }} className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-slate-200"><optgroup label="属性检定">{ABILITIES.map((ability) => <option key={ability.key} value={`ability:${ability.key}`}>{ability.label}</option>)}</optgroup><optgroup label="技能检定">{SKILLS.map((skill) => <option key={skill.key} value={`skill:${skill.key}`}>{skill.label}（{ABILITIES.find((ability) => ability.key === skill.ability)?.label}）</option>)}</optgroup><optgroup label="豁免检定">{ABILITIES.map((ability) => <option key={`save-${ability.key}`} value={`save:${ability.key}`}>{ability.label}豁免</option>)}</optgroup></select></label>
                    <label className="text-xs text-slate-500">DC<input type="number" min={0} max={100} value={dc} onChange={(event) => setDc(Math.min(100, Math.max(0, Math.floor(Number(event.target.value) || 0))))} className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-slate-200" /></label>
                    <label className="text-xs text-slate-500">方式<select value={mode} onChange={(event) => setMode(event.target.value as GroupAbilityCheckMode)} className="mt-1 w-full rounded-xl border border-white/10 bg-void-900 px-3 py-2.5 text-sm text-slate-200"><option value="normal">正常</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select></label>
                  </div>
                  <label className={`flex items-start gap-2 rounded-xl border border-violet-300/10 bg-violet-500/[0.04] p-3 text-sm text-slate-300 ${selection.startsWith('save:') ? 'opacity-45' : ''}`}><input type="checkbox" disabled={selection.startsWith('save:')} checked={!selection.startsWith('save:') && passiveFallback} onChange={(event) => setPassiveFallback(event.target.checked)} className="mt-1" /><span><span className="font-semibold text-violet-100">允许被动值兜底</span><span className="mt-1 block text-xs leading-5 text-slate-500">仅适用于属性／技能检定；豁免没有被动值。取掷骰总值与 10＋检定调整值中的较高者。</span></span></label>
                </section>
                <section className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-slate-200">参与角色</h3><button type="button" onClick={() => void refreshRoster()} className="text-xs text-cyan-300 hover:text-cyan-200">{loadingRoster ? '刷新中…' : '刷新玩家'}</button></div>
                  <div className="mt-3 space-y-2">
                    {roster.map((player) => {
                      const character = characterForPlayer(player, characters)
                      return <label key={player.memberId} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${character ? 'border-white/8 bg-black/20 text-slate-200' : 'border-white/5 text-slate-600'}`}><input type="checkbox" disabled={!character} checked={!!character && !excludedCharacterIds.has(character.id)} onChange={(event) => character && setExcludedCharacterIds((current) => { const next = new Set(current); if (event.target.checked) next.delete(character.id); else next.add(character.id); return next })} /><span className="text-xl">{character?.avatar ?? '👤'}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{character?.name ?? player.displayName}</span><span className="block truncate text-[11px] text-slate-600">{character ? player.displayName : '尚未选择当前角色'}</span></span></label>
                    })}
                    {!loadingRoster && roster.length === 0 && <p className="py-8 text-center text-sm text-slate-600">当前没有可响应的玩家</p>}
                  </div>
                </section>
                <button type="button" disabled={busy || !label.trim() || selectedCharacterIds.length < 1} onClick={createCheck} className="rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40 lg:col-span-2">向 {selectedCharacterIds.length} 名玩家发起 {selectedDefinition.label}检定</button>
              </div>
            )}

            <section className="mt-6 border-t border-white/8 pt-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-400"><History className="h-4 w-4" />最近检定</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {[...shared.checks].filter((check) => check.status !== 'open').reverse().slice(0, 6).map((check) => <div key={check.id} className="rounded-xl border border-white/6 bg-black/15 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-300">{check.label}</span><span className={`text-xs ${check.status === 'cancelled' ? 'text-slate-600' : check.aggregate?.groupSuccess ? 'text-emerald-300' : 'text-rose-300'}`}>{check.status === 'cancelled' ? '已取消' : check.aggregate?.groupSuccess ? '群体成功' : '群体失败'}</span></div><p className="mt-1 text-[11px] text-slate-600">{groupAbilityCheckName(check)} · DC {check.dc} · {check.aggregate?.successCount ?? 0}/{check.participants.length} 成功</p></div>)}
              </div>
            </section>
          </div>
        </div>
      )}

      {!isDm && shouldShowPlayerDialog && myCheck && (
        <div className="fixed inset-0 z-[145] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label="群体检定请求" className="w-full max-w-md rounded-3xl border border-cyan-300/25 bg-void-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-400">DM 发起群体检定</p><h2 className="mt-1 text-xl font-bold text-slate-100">{myCheck.label}</h2></div><button type="button" onClick={() => setDismissed((current) => new Set(current).add(myCheck.id))} className="rounded-xl p-2 text-slate-500 hover:bg-white/5"><X className="h-5 w-5" /></button></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-lg font-bold text-cyan-100">{groupAbilityCheckName(myCheck)}</p><p className="mt-1 text-[10px] text-slate-600">项目</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-lg font-bold text-amber-100">{myCheck.dc}</p><p className="mt-1 text-[10px] text-slate-600">DC</p></div><div className="rounded-xl bg-white/[0.04] p-3"><p className="text-lg font-bold text-violet-100">{modeLabels[myCheck.requestedMode]}</p><p className="mt-1 text-[10px] text-slate-600">DM 设定</p></div></div>
            {error && <p className="mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}
            {myResult ? <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">服务端权威结果</p><p className="mt-1 text-sm text-slate-300">{myResult.source === 'roll-passive-fallback' ? `掷骰 ${myResult.rolledTotal}，被动值 ${myResult.passiveTotal} 兜底` : `d20 ${myResult.d20} ${myResult.modifier >= 0 ? '+' : '−'} ${Math.abs(myResult.modifier)}`}</p></div><span className={`text-4xl font-black ${myResult.success ? 'text-emerald-300' : 'text-rose-300'}`}>{myResult.finalTotal}</span></div><p className="mt-3 text-center text-sm font-semibold text-slate-300">{myResult.success ? '检定成功' : '检定失败'} · 等待 DM 确认群体结果</p><button type="button" onClick={() => setDismissed((current) => new Set(current).add(myCheck.id))} className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-sm text-slate-300 hover:bg-white/5">关闭</button></div> : <><p className="mt-4 text-xs leading-5 text-slate-500">点击后由房间 Host 生成骰点并应用角色调整值、熟练／专精、力竭、可靠才能和体魄超凡。每名玩家只能提交一次。</p><button type="button" disabled={busy} onClick={() => void execute(() => mutate({ operation: 'roll', checkId: myCheck.id }))} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-black text-slate-950 disabled:opacity-40"><Dices className="h-5 w-5" />{busy ? 'Host 正在掷骰…' : '掷 D20'}</button></>}
          </div>
        </div>
      )}
    </>
  )
}

function GroupCheckSummary({ check, busy, onFinalize, onCancel }: { check: GroupAbilityCheckTransaction; busy: boolean; onFinalize: (usePassiveForPending: boolean) => void; onCancel: () => void }) {
  const aggregate = groupAbilityCheckAggregate(check)
  const results = new Map(check.results.map((result) => [result.memberId, result]))
  const pending = aggregate.participantCount - aggregate.resolvedCount
  return <div className="mt-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div><h3 className="font-bold text-slate-100">{check.label}</h3><p className="mt-1 text-xs text-slate-500">{groupAbilityCheckName(check)} · DC {check.dc} · {modeLabels[check.requestedMode]}{check.allowPassiveFallback ? ' · 被动值兜底' : ''}</p></div><div className="text-right"><p className="text-2xl font-black tabular-nums text-cyan-200">{aggregate.resolvedCount}/{aggregate.participantCount}</p><p className="text-[10px] text-slate-600">已响应</p></div></div>
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/8"><table className="w-full text-left text-sm"><thead className="bg-white/[0.04] text-xs text-slate-500"><tr><th className="px-4 py-3">角色</th><th className="px-4 py-3">骰点</th><th className="px-4 py-3">调整值</th><th className="px-4 py-3">总值</th><th className="px-4 py-3 text-right">结果</th></tr></thead><tbody>{check.participants.map((participant) => { const result = results.get(participant.memberId); return <tr key={participant.memberId} className="border-t border-white/6"><td className="px-4 py-3"><span className="mr-2 text-lg">{participant.avatar}</span><span className="font-semibold text-slate-200">{participant.characterName}</span><span className="ml-2 text-xs text-slate-600">{participant.memberName}</span></td><td className="px-4 py-3 tabular-nums text-slate-400">{result ? result.source === 'passive-only' ? '未掷骰' : result.rolls.join(' / ') : '—'}</td><td className="px-4 py-3 tabular-nums text-slate-400">{result ? `${result.modifier >= 0 ? '+' : ''}${result.modifier}` : '—'}</td><td className="px-4 py-3"><span className="font-bold tabular-nums text-slate-100">{result?.finalTotal ?? '—'}</span>{result?.source === 'roll-passive-fallback' && <span className="ml-2 text-[10px] text-violet-300">被动兜底</span>}{result?.source === 'passive-only' && <span className="ml-2 text-[10px] text-amber-300">被动代结</span>}</td><td className="px-4 py-3 text-right">{result ? result.success ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" />成功</span> : <span className="inline-flex items-center gap-1 text-rose-300"><XCircle className="h-4 w-4" />失败</span> : <span className="inline-flex items-center gap-1 text-slate-600"><CircleDashed className="h-4 w-4" />等待</span>}</td></tr> })}</tbody></table></div>
    <div className="mt-4 flex flex-wrap items-center gap-3"><p className="mr-auto text-sm text-slate-400">当前成功 <span className="font-bold text-emerald-300">{aggregate.successCount}</span> 人；至少需要 <span className="font-bold text-amber-200">{aggregate.requiredSuccesses}</span> 人成功。</p><button type="button" disabled={busy} onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-400 hover:bg-white/5">取消检定</button>{pending > 0 && check.allowPassiveFallback && <button type="button" disabled={busy} onClick={() => onFinalize(true)} className="rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/25">用被动值结算 {pending} 名未响应者</button>}<button type="button" disabled={busy || pending > 0} onClick={() => onFinalize(false)} className="flex items-center gap-1 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">确认群体结果<ChevronRight className="h-4 w-4" /></button></div>
  </div>
}
