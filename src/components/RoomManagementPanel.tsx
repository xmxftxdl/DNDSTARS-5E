import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, Copy, Crown, KeyRound, LoaderCircle, Lock, LockOpen, RotateCcw, Shield, UserMinus } from 'lucide-react'
import Card from './Card'
import {
  kickRoomPlayer,
  loadRoomRoster,
  restoreRoomPlayer,
  roomApiErrorMessage,
  setRoomCapacity,
  setRoomLocked,
  setRoomPassword,
  transferRoomDm,
  type RoomRoster,
} from '../lib/roomApi'
import { getRoomSession } from '../lib/roomSession'
import { playerSlotLabel } from '../lib/appMode'

export default function RoomManagementPanel() {
  const session = useMemo(() => getRoomSession(), [])
  const [roster, setRoster] = useState<RoomRoster | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!session || session.role !== 'dm') return
    try {
      setRoster(await loadRoomRoster(session))
    } catch (error) {
      setNotice(roomApiErrorMessage(error))
    }
  }, [session])

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0)
    const timer = window.setInterval(() => void refresh(), 5_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(timer)
    }
  }, [refresh])

  if (!session || session.role !== 'dm') return null

  const currentPlayers = roster?.players.filter((player) =>
    player.status === 'online' || player.status === 'temporarily-offline') ?? []
  const historyPlayers = roster?.players.filter((player) =>
    player.status === 'left' || player.status === 'removed') ?? []

  const lastSeenLabel = (value: number) => value > 0
    ? new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(value)
    : '无记录'

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key)
    setNotice(null)
    try {
      await action()
      setNotice(success)
      await refresh()
    } catch (error) {
      setNotice(roomApiErrorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const copyInvite = async () => {
    const url = `${window.location.origin}/?join=${encodeURIComponent(session.roomId)}`
    await navigator.clipboard?.writeText(url)
    setNotice('邀请链接已复制；若房间设置了密码，请单独告知玩家。')
  }

  return (
    <Card className="mt-8" data-testid="room-management-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <div className="rounded-xl bg-arcane-500/15 p-3 text-arcane-300"><Shield className="h-6 w-6" /></div>
          <div>
            <h3 className="font-semibold text-slate-100">房间管理</h3>
            <p className="mt-1 text-sm text-slate-500">邀请、人数、加入保护和 DM 权限都由房间服务端执行。</p>
          </div>
        </div>
        <button type="button" onClick={() => void copyInvite()} className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
          <Copy className="h-4 w-4" />复制邀请链接
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <button
          type="button"
          data-testid="room-lock-toggle"
          disabled={!roster || busy !== null}
          onClick={() => void run('lock', () => setRoomLocked(session, !(roster?.locked ?? false)), roster?.locked ? '房间已解锁。' : '房间已锁定，新玩家暂时不能加入。')}
          className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-slate-200 disabled:opacity-50"
        >
          <span className="flex items-center gap-2">{roster?.locked ? <Lock className="h-4 w-4 text-amber-300" /> : <LockOpen className="h-4 w-4 text-emerald-300" />}{roster?.locked ? '房间已锁定' : '房间开放加入'}</span>
          <span className="text-xs text-slate-500">切换</span>
        </button>
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/30 px-4 py-2">
          <span className="text-sm text-slate-300">玩家上限</span>
          <select
            data-testid="room-capacity-select"
            value={roster?.maxPlayers ?? 3}
            disabled={!roster || busy !== null}
            onChange={(event) => void run('capacity', () => setRoomCapacity(session, Number(event.target.value)), `玩家上限已改为 ${event.target.value}。`)}
            className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-sm text-slate-200"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count} disabled={count < currentPlayers.length}>{count}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/30 p-2">
          <KeyRound className="ml-2 h-4 w-4 text-slate-500" />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={64}
            placeholder={roster?.passwordRequired ? '输入新密码' : '设置加入密码'}
            className="min-w-0 flex-1 bg-transparent px-1 text-sm text-slate-200 outline-none"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run('password', async () => {
              await setRoomPassword(session, password)
              setPassword('')
            }, password ? '加入密码已更新。' : '加入密码已清除。')}
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            {password ? '保存' : roster?.passwordRequired ? '清除' : '设置'}
          </button>
        </div>
      </div>

      {notice && <div className="mt-4 rounded-lg border border-white/8 bg-slate-950/30 px-3 py-2 text-sm text-slate-400">{notice}</div>}
      {busy && <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />正在更新房间…</p>}

      <div className="mt-5 border-t border-white/8 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">权限与成员</p>
        {currentPlayers.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {currentPlayers.map((player) => (
              <div key={player.memberId} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-slate-950/25 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-200">{player.displayName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{playerSlotLabel(player.slot)} · {player.online ? '在线' : '暂时断线'} · {player.ready ? '规则就绪' : '规则未就绪'}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-600"><Clock3 className="h-3 w-3" />最后在线 {lastSeenLabel(player.lastSeenAt)} · 当前角色 {player.activeCharacterName ?? '未选择'}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    data-testid={`room-transfer-${player.memberId}`}
                    disabled={busy !== null || !player.ready || !player.online}
                    title={!player.online ? '玩家必须在线才能接管 DM' : player.ready ? '转让 DM' : '规则包未就绪，不能接管 DM'}
                    onClick={() => {
                      if (!window.confirm(`确定把 DM 权限转让给「${player.displayName}」吗？你会变为 ${playerSlotLabel(player.slot)}。`)) return
                      void run(`transfer:${player.memberId}`, async () => {
                        await transferRoomDm(session, player.memberId)
                        window.location.assign('/maps')
                      }, 'DM 权限已转让。')
                    }}
                    className="rounded-lg border border-arcane-400/20 p-2 text-arcane-300 hover:bg-arcane-500/10 disabled:opacity-30"
                  >
                    <Crown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    data-testid={`room-kick-${player.memberId}`}
                    disabled={busy !== null}
                    title="移出房间"
                    onClick={() => {
                      if (!window.confirm(`确定将「${player.displayName}」移出房间吗？`)) return
                      void run(`kick:${player.memberId}`, () => kickRoomPlayer(session, player.memberId), `${player.displayName} 已被移出房间。`)
                    }}
                    className="rounded-lg border border-rose-400/20 p-2 text-rose-300 hover:bg-rose-500/10 disabled:opacity-30"
                  >
                    <UserMinus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-600">当前没有玩家。</p>}
      </div>

      {historyPlayers.length > 0 && (
        <div className="mt-5 border-t border-white/8 pt-4" data-testid="room-member-history">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">已离开与已移除</p>
          <div className="grid gap-2 md:grid-cols-2">
            {historyPlayers.map((player) => (
              <div key={player.memberId} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-slate-950/20 px-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-400">{player.displayName}</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {player.status === 'removed' ? '已被 DM 移除' : '已主动离开'} · 最后在线 {lastSeenLabel(player.lastSeenAt)}
                  </p>
                </div>
                {player.status === 'removed' && (
                  <button
                    type="button"
                    disabled={busy !== null}
                    title="恢复加入资格"
                    onClick={() => void run(`restore:${player.memberId}`, () => restoreRoomPlayer(session, player.memberId), `${player.displayName} 已恢复加入资格。`)}
                    className="rounded-lg border border-emerald-400/20 p-2 text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-30"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
