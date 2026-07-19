import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock3, RefreshCw, ShieldCheck, UserCog, UserRound, Users, Wifi, WifiOff } from 'lucide-react'
import { playerSlotLabel } from '../../lib/appMode'
import { roomCharactersOwnedByMembers } from '../../lib/playerView'
import { loadRoomRoster, roomApiErrorMessage, type RoomRosterMember } from '../../lib/roomApi'
import { getRoomSession } from '../../lib/roomSession'
import { useCharacterStore } from '../../store/characters'
import Dnd5eDmInventoryDistributor from './Dnd5eDmInventoryDistributor'

export default function DMRoster() {
  const roomSession = useMemo(() => getRoomSession(), [])
  const characters = useCharacterStore((state) => state.characters)
  const updateCharacter = useCharacterStore((state) => state.update)
  const [players, setPlayers] = useState<RoomRosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [repairTargets, setRepairTargets] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    if (!roomSession || roomSession.role !== 'dm') {
      setPlayers([])
      setError('当前没有有效的 DM 房间会话，请返回大厅重新进入房间。')
      setLoading(false)
      return
    }
    try {
      const roster = await loadRoomRoster(roomSession)
      setPlayers(roster.players)
      setError(null)
    } catch (cause) {
      setError(roomApiErrorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [roomSession])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [refresh])

  const currentPlayers = useMemo(
    () => players.filter((player) => player.status === 'online' || player.status === 'temporarily-offline'),
    [players],
  )
  const onlinePlayers = useMemo(() => currentPlayers.filter((player) => player.online), [currentPlayers])
  const currentMemberIds = useMemo(
    () => new Set(currentPlayers.map((player) => player.memberId)),
    [currentPlayers],
  )
  const currentRoomCharacters = useMemo(
    () => roomSession
      ? roomCharactersOwnedByMembers(characters, roomSession.roomId, currentMemberIds)
      : [],
    [characters, currentMemberIds, roomSession],
  )
  const pendingRecoveryCharacters = useMemo(() => roomSession
    ? characters.filter((character) =>
      character.visibleToPlayers !== false && character.roomId === roomSession.roomId &&
      (!character.roomMemberId || !currentMemberIds.has(character.roomMemberId)))
    : [], [characters, currentMemberIds, roomSession])
  const charactersByMember = useMemo(() => new Map(currentPlayers.map((player) => [
    player.memberId,
    currentRoomCharacters.filter((character) => character.roomMemberId === player.memberId),
  ])), [currentPlayers, currentRoomCharacters])

  const onlineCount = onlinePlayers.length

  const repairOwnership = (characterId: string, memberId: string) => {
    const player = currentPlayers.find((candidate) => candidate.memberId === memberId)
    if (!player) return
    updateCharacter(characterId, {
      roomMemberId: player.memberId,
      ...(player.accountId ? { ownerAccountId: player.accountId } : {}),
      player: player.displayName,
    })
  }

  const lastSeenLabel = (lastSeenAt: number) => {
    if (!Number.isFinite(lastSeenAt) || lastSeenAt <= 0) return '没有在线记录'
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(lastSeenAt)
  }

  return (
    <section className="glass rounded-2xl p-5" data-testid="dm-room-player-roster">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-arcane-300" />
            <h2 className="font-semibold text-slate-100">房间玩家</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">只读查看已加入本房间的玩家，以及他们创建的角色。</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-lg border border-white/8 bg-black/20 px-3 py-1.5 text-xs text-slate-400">
            {onlineCount}/{currentPlayers.length} 在线
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            title="刷新房间玩家"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <Dnd5eDmInventoryDistributor players={onlinePlayers} />

      {pendingRecoveryCharacters.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] p-4" data-testid="character-ownership-repair">
          <div className="flex items-start gap-3">
            <UserCog className="mt-0.5 h-5 w-5 text-amber-300" />
            <div>
              <p className="text-sm font-semibold text-amber-100">待恢复角色归属</p>
              <p className="mt-1 text-xs leading-5 text-slate-400">这些角色仍引用旧席位。DM 必须明确选择玩家；系统不会再通过同名自动转移角色。</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {pendingRecoveryCharacters.map((character) => {
              const recommended = currentPlayers.find((player) =>
                !!player.accountId && player.accountId === character.ownerAccountId)
              const target = repairTargets[character.id] ?? recommended?.memberId ?? ''
              return (
                <div key={character.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/8 bg-black/15 p-3">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-semibold text-slate-200">{character.name}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      原玩家：{character.player || '未知'}{recommended ? ` · 账号匹配 ${recommended.displayName}` : ' · 需要 DM 核对'}
                    </p>
                  </div>
                  <select
                    value={target}
                    onChange={(event) => setRepairTargets((current) => ({ ...current, [character.id]: event.target.value }))}
                    className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200"
                  >
                    <option value="">选择当前玩家…</option>
                    {currentPlayers.map((player) => <option key={player.memberId} value={player.memberId}>{player.displayName}</option>)}
                  </select>
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => repairOwnership(character.id, target)}
                    className="rounded-lg border border-amber-300/25 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-400/10 disabled:opacity-40"
                  >
                    确认归属
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading && currentPlayers.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          正在读取房间玩家…
        </div>
      ) : currentPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
          <Users className="h-9 w-9 text-slate-700" />
          <p className="mt-4 font-semibold text-slate-300">还没有玩家加入</p>
          <p className="mt-1 text-sm text-slate-600">把侧栏中的六位房间码发给玩家即可。</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {currentPlayers.map((player) => {
            const ownedCharacters = charactersByMember.get(player.memberId) ?? []
            const unresolvedPluginCount = (player.missing?.length ?? 0) + (player.mismatched?.length ?? 0)
            const pendingForPlayer = player.accountId
              ? pendingRecoveryCharacters.filter((character) => character.ownerAccountId === player.accountId)
              : []
            return (
              <article key={player.memberId} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-arcane-500/10 text-arcane-200">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-semibold text-slate-100">{player.displayName}</p>
                      <span className={`flex shrink-0 items-center gap-1 text-[11px] ${player.online ? 'text-emerald-300' : 'text-slate-600'}`}>
                        {player.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                        {player.online ? '在线' : '暂时断线'}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{playerSlotLabel(player.slot)}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />最后在线：{lastSeenLabel(player.lastSeenAt)}
                    </p>
                    <p className={`mt-1 flex items-center gap-1 text-[11px] ${player.ready ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {player.ready ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                      {player.ready ? '规则包已就绪' : `规则包待处理（${unresolvedPluginCount}）`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/6 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">当前控制</p>
                  <p className="mt-1 text-sm text-slate-300">{player.activeCharacterName ?? '未选择角色'}</p>
                  {pendingForPlayer.length > 0 && (
                    <p className="mt-2 text-xs text-amber-300">有 {pendingForPlayer.length} 个账号角色等待 DM 确认归属</p>
                  )}
                </div>

                <div className="mt-3 border-t border-white/6 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">创建的角色</p>
                  {ownedCharacters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ownedCharacters.map((character) => (
                        <span
                          key={character.id}
                          className="rounded-lg border border-arcane-400/15 bg-arcane-500/[0.07] px-2.5 py-1.5 text-xs text-slate-300"
                        >
                          {character.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">尚未创建角色</p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
