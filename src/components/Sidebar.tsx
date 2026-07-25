import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Check,
  Copy,
  Crown,
  LogOut,
  PackageOpen,
  PanelLeftClose,
  Settings,
  Sparkles,
} from 'lucide-react'
import type { AppMode } from '../lib/appMode'
import type { RoomSession } from '../lib/roomSession'
import { useRoomCommunicationsStore } from '../store/roomCommunications'
import CampaignTimeWidget from './CampaignTimeWidget'
import { sidebarNavItems } from './sidebarNavigation'

export default function Sidebar({
  onCollapse,
  mode,
  roomSession,
  connection = 'online',
  onLeaveRoom,
}: {
  onCollapse?: () => void
  mode?: AppMode
  roomSession?: RoomSession
  connection?: 'online' | 'reconnecting'
  onLeaveRoom?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const unreadHandouts = useRoomCommunicationsStore((state) => state.unreadHandoutIds.length)
  const items = sidebarNavItems(mode, roomSession?.role)
  const copyRoomCode = async () => {
    if (!roomSession) return
    await navigator.clipboard?.writeText(roomSession.roomId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  return (
    <aside className="glass flex w-64 shrink-0 flex-col border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="glow-arcane flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-arcane-500 to-arcane-600">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight text-gradient">星界</h1>
          <p className="text-xs text-slate-400">DND 跑团助手</p>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="收起侧边栏"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={`${label}:${to}`}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-arcane-500/15 text-arcane-200 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.3)]'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={[
                    'h-5 w-5 transition-colors',
                    isActive ? 'text-arcane-300' : 'text-slate-500 group-hover:text-slate-200',
                  ].join(' ')}
                />
                <span className="flex-1">{label}</span>
                {to === '/communications' && unreadHandouts > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                    {unreadHandouts}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {roomSession && (
        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-300">{roomSession.roomName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${connection === 'online' ? 'bg-emerald-400' : 'animate-pulse bg-amber-400'}`} />
                {connection === 'online' ? '房间已连接' : '正在重新连接'}
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-arcane-500/10 px-2 py-1 text-[10px] font-semibold text-arcane-200">
              {roomSession.role === 'dm' ? <Crown className="h-3 w-3" /> : null}
              {roomSession.role === 'dm' ? 'DM' : roomSession.role === 'spectator' ? '观战' : `玩家 ${roomSession.slot?.slice(-1) ?? '1'}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void copyRoomCode()}
            title="复制房间码"
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 transition hover:border-arcane-400/25 hover:bg-arcane-500/[0.06]"
          >
            <span className="font-mono text-base font-bold tracking-[0.18em] text-slate-100">{roomSession.roomId}</span>
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-slate-500" />}
          </button>
          <CampaignTimeWidget mode={mode} />
        </div>
      )}

      {/* Footer */}
      <div className="space-y-1 border-t border-white/10 p-3">
        {roomSession?.role !== 'spectator' && <NavLink
          to="/plugins"
          className={({ isActive }) => [
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
            isActive ? 'bg-arcane-500/15 text-arcane-200' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
          ].join(' ')}
        >
          <PackageOpen className="h-5 w-5 text-slate-500" />
          插件中心
        </NavLink>}
        {roomSession?.role !== 'spectator' && <NavLink
          to="/settings"
          className={({ isActive }) => [
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
            isActive ? 'bg-arcane-500/15 text-arcane-200' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
          ].join(' ')}
        >
          <Settings className="h-5 w-5 text-slate-500" />
          设置
        </NavLink>}
        {onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-red-500/10 hover:text-red-200"
          >
            <LogOut className="h-5 w-5" />
            {roomSession?.role === 'dm' ? '关闭并离开房间' : '离开房间'}
          </button>
        )}
      </div>
    </aside>
  )
}
