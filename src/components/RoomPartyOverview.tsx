import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ChevronRight,
  Clock3,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { roomCharactersOwnedByMembers } from '../lib/playerView'
import { loadRoomRoster, roomApiErrorMessage, roomRosterMemberLabel, type RoomRosterMember } from '../lib/roomApi'
import { getRoomSession } from '../lib/roomSession'
import { useCharacterStore } from '../store/characters'
import { resolveMapTokenPortrait } from '../lib/portraitPresentation'

function lastSeenLabel(lastSeenAt: number): string {
  if (!Number.isFinite(lastSeenAt) || lastSeenAt <= 0) return '没有在线记录'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(lastSeenAt)
}

export default function RoomPartyOverview() {
  const roomSession = useMemo(() => getRoomSession(), [])
  const characters = useCharacterStore((state) => state.characters)
  const [players, setPlayers] = useState<RoomRosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const currentMemberIds = useMemo(
    () => new Set(currentPlayers.filter((player) => player.role === 'player').map((player) => player.memberId)),
    [currentPlayers],
  )
  const currentRoomCharacters = useMemo(
    () => roomSession
      ? roomCharactersOwnedByMembers(characters, roomSession.roomId, currentMemberIds)
      : [],
    [characters, currentMemberIds, roomSession],
  )
  const charactersByMember = useMemo(() => new Map(currentPlayers.map((player) => [
    player.memberId,
    currentRoomCharacters.filter((character) => character.roomMemberId === player.memberId),
  ])), [currentPlayers, currentRoomCharacters])
  const onlineCount = currentPlayers.filter((player) => player.online).length

  return (
    <section className="glass overflow-hidden rounded-2xl" data-testid="dashboard-room-party-overview">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-arcane-300" />
            <h3 className="font-semibold text-slate-100">房间玩家与角色</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {roomSession ? `${roomSession.roomName} · 房间 ${roomSession.roomId}` : '当前房间的队伍概览'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-white/8 bg-black/20 px-3 py-1.5 text-xs text-slate-400">
            {onlineCount}/{currentPlayers.length} 在线 · {currentRoomCharacters.length} 名角色
          </span>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            aria-label="刷新玩家与角色概览"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to={roomSession
              ? `/campaign/${encodeURIComponent(roomSession.campaignId ?? roomSession.roomId)}/characters`
              : '/characters'}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-arcane-300 transition hover:bg-arcane-500/10 hover:text-arcane-200"
          >
            查看角色页
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="m-4 flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && currentPlayers.length === 0 ? (
        <div className="flex items-center justify-center gap-2 px-4 py-14 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          正在读取房间成员…
        </div>
      ) : currentPlayers.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
          <Users className="h-9 w-9 text-slate-700" />
          <p className="mt-4 font-semibold text-slate-300">还没有玩家加入房间</p>
          <p className="mt-1 text-sm text-slate-600">玩家加入后，其在线状态和房间角色会显示在这里。</p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 lg:grid-cols-2">
          {currentPlayers.map((player) => {
            const ownedCharacters = charactersByMember.get(player.memberId) ?? []
            return (
              <article key={player.memberId} className="rounded-2xl border border-white/8 bg-black/15 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-arcane-500/10 text-arcane-200">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="truncate font-semibold text-slate-100">{player.displayName}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{roomRosterMemberLabel(player)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-[11px] ${player.ready ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {player.ready ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                          {player.ready ? '规则就绪' : '规则未就绪'}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-[11px] ${player.online ? 'text-emerald-300' : 'text-slate-500'}`}>
                          {player.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                          {player.online ? '在线' : '暂时断线'}
                        </span>
                      </div>
                    </div>
                    {!player.online && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
                        <Clock3 className="h-3 w-3" />最后在线：{lastSeenLabel(player.lastSeenAt)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t border-white/6 pt-3">
                  {ownedCharacters.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/8 px-3 py-4 text-center text-sm text-slate-600">
                      {player.activeCharacterName ? `当前控制：${player.activeCharacterName}` : '尚未创建或选择角色'}
                    </div>
                  ) : ownedCharacters.map((character) => {
                    const maximumHp = Math.max(1, character.maxHp)
                    const hpRatio = Math.max(0, Math.min(1, character.currentHp / maximumHp))
                    const portrait = resolveMapTokenPortrait(character)
                    const active = player.activeCharacterId === character.id || (
                      !player.activeCharacterId && player.activeCharacterName === character.name
                    )
                    return (
                      <div key={character.id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.025] p-2.5">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-arcane-500/10 text-xl">
                          {portrait
                            ? <img src={portrait} alt="" className="h-full w-full object-cover" />
                            : character.avatar || '🧙'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-200">{character.name}</p>
                            {active && (
                              <span className="shrink-0 rounded-full bg-arcane-500/15 px-2 py-0.5 text-[10px] font-semibold text-arcane-200">
                                当前控制
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {character.level}级 · {character.race} · {character.charClass}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/30">
                              <div className="h-full rounded-full bg-emerald-400/70" style={{ width: `${hpRatio * 100}%` }} />
                            </div>
                            <span className="text-[11px] tabular-nums text-slate-500">
                              HP {character.currentHp}/{maximumHp}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
