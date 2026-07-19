import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Cloud, LoaderCircle, RefreshCw } from 'lucide-react'
import {
  accountApiErrorMessage,
  characterCompatibilityForRoom,
  loadAccountCharacters,
  type AccountCharacterRecord,
} from '../../lib/accountApi'
import { getAccountSession } from '../../lib/accountSession'
import { getRoomRulesSnapshot, subscribeRoomRules } from '../../lib/roomRulesState'
import { getRoomSession } from '../../lib/roomSession'
import { setAssignedPlayerCharacterId } from '../../lib/playerView'
import { useCharacterStore } from '../../store/characters'

export default function AccountCharacterVaultPanel() {
  const account = useMemo(() => getAccountSession(), [])
  const room = useMemo(() => getRoomSession(), [])
  const characters = useCharacterStore((state) => state.characters)
  const attach = useCharacterStore((state) => state.attachAccountCharacter)
  const select = useCharacterStore((state) => state.select)
  const [records, setRecords] = useState<AccountCharacterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setRulesTick] = useState(0)

  const refresh = useCallback(async () => {
    if (!account || room?.role !== 'player') return
    setLoading(true)
    try {
      setRecords(await loadAccountCharacters())
      setError(null)
    } catch (cause) {
      setError(accountApiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [account, room])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const unsubscribe = subscribeRoomRules(() => setRulesTick((value) => value + 1))
    return () => {
      window.clearTimeout(initial)
      unsubscribe()
    }
  }, [refresh])

  if (!account || room?.role !== 'player') return null
  const roomCharacterIds = new Set(characters
    .filter((character) => character.roomId === room.roomId && character.roomMemberId === room.memberId)
    .map((character) => character.id))
  const rules = getRoomRulesSnapshot()

  return (
    <section className="glass mb-5 rounded-2xl p-4" data-testid="account-character-vault">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-300"><Cloud className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">账号角色库</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              角色归属于账号 {account.accountId}。带入房间前会核对 SRD 版本、游戏协议及角色所需插件。
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />刷新
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}
      {loading && records.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />正在读取账号角色…</p>
      ) : records.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500">角色库目前为空；你在本房间新建或导入的角色会自动保存到这里。</p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {records.map((record) => {
            const result = characterCompatibilityForRoom(record, rules)
            const attached = roomCharacterIds.has(record.id)
            return (
              <article key={record.id} className="rounded-xl border border-white/8 bg-black/15 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">{record.name}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {record.character.race} · {record.character.charClass} {record.character.level}级
                    </p>
                  </div>
                  {result.compatible
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                    : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />}
                </div>
                <p className={`mt-2 text-[11px] ${result.compatible ? 'text-emerald-300' : 'text-amber-200'}`}>
                  {result.compatible ? '规则、游戏协议与插件校验通过' : result.errors[0]}
                </p>
                {result.warnings.length > 0 && <p className="mt-1 text-[11px] text-slate-500">{result.warnings[0]}</p>}
                <button
                  type="button"
                  disabled={!result.compatible || attached}
                  onClick={() => {
                    const id = attach(record.character)
                    setAssignedPlayerCharacterId(id, room.slot)
                    select(id)
                  }}
                  className="mt-3 w-full rounded-lg border border-arcane-400/20 px-3 py-2 text-xs font-semibold text-arcane-200 hover:bg-arcane-500/10 disabled:cursor-not-allowed disabled:border-white/8 disabled:text-slate-600"
                >
                  {attached ? '已在当前房间' : result.compatible ? '带入当前房间' : '暂不可使用'}
                </button>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
