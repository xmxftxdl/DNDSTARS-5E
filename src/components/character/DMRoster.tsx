import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Clock3, Eye, MoonStar, RefreshCw, ShieldCheck, UserRound, Users, Wifi, WifiOff, X } from 'lucide-react'
import { roomCharactersOwnedByMembers } from '../../lib/playerView'
import { loadRoomRoster, roomApiErrorMessage, roomRosterMemberLabel, type RoomRosterMember } from '../../lib/roomApi'
import { getRoomSession } from '../../lib/roomSession'
import { useCampaignTimeStore } from '../../store/campaignTime'
import { useCharacterStore } from '../../store/characters'
import Dnd5eDmInventoryDistributor from './Dnd5eDmInventoryDistributor'
import CharacterSheet from './CharacterSheet'

export default function DMRoster() {
  const roomSession = useMemo(() => getRoomSession(), [])
  const characters = useCharacterStore((state) => state.characters)
  const [players, setPlayers] = useState<RoomRosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inspectedCharacterId, setInspectedCharacterId] = useState<string | null>(null)
  const [longRestBusy, setLongRestBusy] = useState(false)
  const [longRestMessage, setLongRestMessage] = useState('')
  const mutateCampaignTime = useCampaignTimeStore((state) => state.mutate)

  const completeLongRest = async () => {
    if (longRestBusy) return
    setLongRestBusy(true)
    setLongRestMessage('')
    try {
      await mutateCampaignTime({ operation: 'long-rest', reason: 'DM 在角色栏发起全队长休' })
      setLongRestMessage('长休结算完成：已推进 8 小时，并恢复符合条件角色的生命值、法术位和长休资源。')
    } catch (cause) {
      setLongRestMessage(cause instanceof Error ? cause.message : '长休结算失败，请稍后重试。')
    } finally {
      setLongRestBusy(false)
    }
  }

  const refresh = useCallback(async () => {
    if (!roomSession || roomSession.role !== 'dm') {
      setPlayers([])
      setError('当前没有有效的 DM 房间会话，请返回大厅重新进入房间。')
      setLoading(false)
      return
    }
    try {
      const roster = await loadRoomRoster(roomSession)
      setPlayers(roster.players.filter((member) => member.role === 'player'))
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
  const charactersByMember = useMemo(() => new Map(currentPlayers.map((player) => [
    player.memberId,
    currentRoomCharacters.filter((character) => character.roomMemberId === player.memberId),
  ])), [currentPlayers, currentRoomCharacters])
  const inspectedCharacter = inspectedCharacterId
    ? currentRoomCharacters.find((character) => character.id === inspectedCharacterId) ?? null
    : null

  const onlineCount = onlinePlayers.length

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
          <button
            type="button"
            onClick={() => void completeLongRest()}
            disabled={longRestBusy || !roomSession}
            className="flex items-center gap-2 rounded-lg border border-indigo-300/20 bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-100 transition hover:border-indigo-300/35 hover:bg-indigo-500/20 disabled:opacity-50"
          >
            <MoonStar className="h-3.5 w-3.5" />
            {longRestBusy ? '正在长休…' : '一键长休 · 恢复法术位'}
          </button>
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
      {longRestMessage && (
        <div className="mt-4 rounded-xl border border-indigo-300/15 bg-indigo-500/[0.07] px-4 py-3 text-sm text-indigo-100">
          {longRestMessage}
        </div>
      )}

      <Dnd5eDmInventoryDistributor players={onlinePlayers} />

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
                    <p className="mt-0.5 text-xs text-slate-500">{roomRosterMemberLabel(player)}</p>
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
                </div>

                <div className="mt-3 border-t border-white/6 pt-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">创建的角色</p>
                  {ownedCharacters.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ownedCharacters.map((character) => (
                        <button
                          type="button"
                          key={character.id}
                          onClick={() => setInspectedCharacterId(character.id)}
                          aria-label={`查看角色卡：${character.name}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-arcane-400/15 bg-arcane-500/[0.07] px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-arcane-300/35 hover:bg-arcane-500/15 hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {character.name}
                        </button>
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
      {inspectedCharacter && (
        <DmCharacterInspector
          characterId={inspectedCharacter.id}
          characterName={inspectedCharacter.name}
          onClose={() => setInspectedCharacterId(null)}
        />
      )}
    </section>
  )
}

function DmCharacterInspector({
  characterId,
  characterName,
  onClose,
}: {
  characterId: string
  characterName: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${characterName}的角色卡详情`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="my-auto w-full max-w-7xl rounded-2xl border border-white/10 bg-void-950 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 rounded-t-2xl border-b border-white/10 bg-void-950/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">DM 只读检视</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-100">{characterName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭角色卡详情"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <CharacterSheet id={characterId} isDM readOnly />
        </div>
      </div>
    </div>,
    document.body,
  )
}
