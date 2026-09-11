import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Check,
  BookOpenText,
  ChevronDown,
  Copy,
  Crown,
  LibraryBig,
  LogOut,
  PackageOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  WandSparkles,
} from 'lucide-react'
import starMarkLogo from '../assets/starmark-logo.png'
import type { AppMode } from '../lib/appMode'
import type { RoomSession } from '../lib/roomSession'
import { useRoomCommunicationsStore } from '../store/roomCommunications'
import CampaignTimeWidget from './CampaignTimeWidget'
import { sidebarDmAssistantItems, sidebarNavItems } from './sidebarNavigation'
import { requestPdfSplitView } from '../lib/pdfSplitViewController'

export default function Sidebar({
  onCollapse,
  compact = false,
  onExpand,
  mode,
  roomSession,
  campaignBasePath = '',
  connection = 'online',
  onLeaveRoom,
}: {
  onCollapse?: () => void
  compact?: boolean
  onExpand?: () => void
  mode?: AppMode
  roomSession?: RoomSession
  campaignBasePath?: string
  connection?: 'online' | 'reconnecting'
  onLeaveRoom?: () => void
}) {
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const dmAssistantActive = location.pathname.includes('/dm-tools/')
  const [dmAssistantOpen, setDmAssistantOpen] = useState(dmAssistantActive)
  const unreadHandouts = useRoomCommunicationsStore((state) => state.unreadHandoutIds.length)
  const items = sidebarNavItems(mode, roomSession?.role, campaignBasePath)
  const dmTools = sidebarDmAssistantItems(campaignBasePath)
  const canUseDmAssistant = roomSession?.role === 'dm' || (!roomSession && mode === 'dm')
  const copyRoomCode = async () => {
    if (!roomSession) return
    await navigator.clipboard?.writeText(roomSession.roomId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }
  if (compact) {
    const shortcuts = [
      ...items,
      ...(canUseDmAssistant ? dmTools.map(item => ({ ...item, end: false })) : []),
    ]
    return (
      <aside aria-label="快捷导航" className="glass flex h-full w-14 shrink-0 flex-col items-center overflow-y-auto border-r border-white/10 py-3">
        <button type="button" onClick={onExpand} title="展开侧边栏" aria-label="展开侧边栏"
          className="mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-arcane-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-arcane-400">
          <PanelLeftOpen className="h-5 w-5" />
        </button>
        <nav aria-label="战役快捷入口" className="flex w-full flex-1 flex-col items-center gap-1">
          {shortcuts.map(({to, label, icon: Icon, ...item}) => (
            <NavLink key={to} to={to} end={item.end} title={label} aria-label={label}
              className={({isActive}) => `relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-arcane-400 ${isActive ? 'bg-arcane-500/20 text-arcane-200 ring-1 ring-inset ring-arcane-400/30' : 'text-slate-500 hover:bg-white/5 hover:text-slate-100'}`}>
              <Icon className="h-5 w-5" />
              {to.endsWith('/communications') && unreadHandouts > 0 && <span aria-label={`${unreadHandouts} 条未读`} className="absolute right-0 top-0 min-w-3 rounded-full bg-amber-400 px-1 text-[9px] font-bold text-slate-950">{unreadHandouts > 99 ? '99+' : unreadHandouts}</span>}
            </NavLink>
          ))}
          {canUseDmAssistant && <button type="button" onClick={() => requestPdfSplitView()} title="PDF 分屏" aria-label="PDF 分屏" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-100"><BookOpenText className="h-5 w-5" /></button>}
        </nav>
        <div className="mt-3 flex w-full flex-col items-center gap-1 border-t border-white/10 pt-2">
          <NavLink to="/app" title="战役列表" aria-label="战役列表" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-100"><LibraryBig className="h-5 w-5" /></NavLink>
          {roomSession?.role !== 'spectator' && <>
            <NavLink to={`${campaignBasePath}/extensions`} title="规则与扩展" aria-label="规则与扩展" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-100"><PackageOpen className="h-5 w-5" /></NavLink>
            <NavLink to={`${campaignBasePath}/settings`} title="设置" aria-label="设置" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-white/5 hover:text-slate-100"><Settings className="h-5 w-5" /></NavLink>
          </>}
          {onLeaveRoom && <button type="button" onClick={onLeaveRoom} title="离开房间" aria-label="离开房间" className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-red-500/10 hover:text-red-200"><LogOut className="h-5 w-5" /></button>}
        </div>
      </aside>
    )
  }
  return (
    <aside className="glass flex w-64 shrink-0 flex-col border-r border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="glow-arcane flex h-11 w-11 items-center justify-center">
          <img src={starMarkLogo} alt="" aria-hidden="true" className="h-11 w-11 object-contain" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold leading-tight text-gradient">星痕</h1>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-300">
            Astral Trace
          </p>
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
                {to.endsWith('/communications') && unreadHandouts > 0 && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                    {unreadHandouts}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
        {canUseDmAssistant && (
          <div className="pt-1">
            <button
              type="button"
              aria-expanded={dmAssistantOpen}
              onClick={() => setDmAssistantOpen((value) => !value)}
              className={[
                'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                dmAssistantActive
                  ? 'bg-arcane-500/10 text-arcane-200'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
              ].join(' ')}
            >
              <WandSparkles className={[
                'h-5 w-5 transition-colors',
                dmAssistantActive ? 'text-arcane-300' : 'text-slate-500 group-hover:text-slate-200',
              ].join(' ')} />
              <span className="flex-1 text-left">DM 助手</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${dmAssistantOpen ? 'rotate-180' : ''}`} />
            </button>
            {dmAssistantOpen && (
              <div className="ml-5 mt-1 space-y-1 border-l border-white/10 pl-2">
                {dmTools.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={`${label}:${to}`}
                    to={to}
                    className={({ isActive }) => [
                      'group flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
                      isActive
                        ? 'bg-arcane-500/15 text-arcane-100'
                        : 'text-slate-500 hover:bg-white/5 hover:text-slate-200',
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{label}</span>
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => requestPdfSplitView()}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition-all hover:bg-sky-500/10 hover:text-sky-100"
                >
                  <BookOpenText className="h-4 w-4" />
                  <span>PDF 分屏</span>
                </button>
              </div>
            )}
          </div>
        )}
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
      {!roomSession && (
        <div className="mx-3 mb-3">
          <CampaignTimeWidget mode={mode} />
        </div>
      )}

      {/* Footer */}
      <div className="space-y-1 border-t border-white/10 p-3">
        <NavLink
          to="/app"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-white/5 hover:text-slate-100"
        >
          <LibraryBig className="h-5 w-5 text-slate-500" />
          战役列表
        </NavLink>
        {roomSession?.role !== 'spectator' && <NavLink
          to={`${campaignBasePath}/extensions`}
          className={({ isActive }) => [
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
            isActive ? 'bg-arcane-500/15 text-arcane-200' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
          ].join(' ')}
        >
          <PackageOpen className="h-5 w-5 text-slate-500" />
          规则与扩展
        </NavLink>}
        {roomSession?.role !== 'spectator' && <NavLink
          to={`${campaignBasePath}/settings`}
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
            离开房间
          </button>
        )}
      </div>
    </aside>
  )
}
