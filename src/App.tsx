import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { PanelLeftOpen } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ServerCompatibilityBanner from './components/ServerCompatibilityBanner'
import SharedIntegrityBanner from './components/SharedIntegrityBanner'
import PageErrorBoundary from './components/PageErrorBoundary'
import { SharedSyncRecoveryBanner } from './components/SharedSyncStatus'
import { modeFromPort } from './lib/appMode'
import { heartbeatRoom, leaveRoom, roomApiErrorMessage, roomHeartbeatErrorIsTerminal } from './lib/roomApi'
import { clearRoomSession, getRoomSession, subscribeRoomSession } from './lib/roomSession'
import { setRoomPluginSyncError, setRoomRulesSnapshot } from './lib/roomRulesState'
import { synchronizeRoomPlugins } from './lib/roomPluginSync'
import { useCharacterStore } from './store/characters'
import { activeDnd5eRulesPluginRequirements } from './rulesets/dnd5e/pluginApi'
import { startDnd5eInventoryAuthoritySync } from './lib/inventoryAuthority'
import { getAssignedPlayerCharacterId, getPlayerCharacter } from './lib/playerView'
import { startAccountCharacterVaultSync } from './lib/accountCharacterVault'

const RoomLobbyPage = lazy(() => import('./pages/RoomLobbyPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MapsPage = lazy(() => import('./pages/MapsPage'))
const CharactersPage = lazy(() => import('./pages/CharactersPage'))
const RulesPluginsPage = lazy(() => import('./pages/RulesPluginsPage'))
const SpellbookPage = lazy(() => import('./pages/SpellbookPage'))
const CommunicationsPage = lazy(() => import('./pages/CommunicationsPage'))
const RoomHandoutNotification = lazy(() => import('./components/RoomHandoutNotification'))
const GroupAbilityCheckSystem = lazy(() => import('./components/GroupAbilityCheckSystem'))
const CampaignTimeSystem = lazy(() => import('./components/CampaignTimeSystem'))
const SceneAudioPlaybackSystem = lazy(() => import('./components/SceneAudioPlaybackSystem'))

function PageLoadingFallback() {
  return (
    <div className="flex min-h-48 items-center justify-center text-sm text-slate-400" role="status">
      正在加载界面…
    </div>
  )
}

function lazyPage(scope: string, content: ReactNode) {
  return (
    <PageErrorBoundary scope={scope}>
      <Suspense fallback={<PageLoadingFallback />}>{content}</Suspense>
    </PageErrorBoundary>
  )
}

export default function App() {
  const bypassRoomLobby = import.meta.env.VITE_BYPASS_ROOM_LOBBY === '1'
  const [collapsed, setCollapsed] = useState(false)
  const [roomSession, setRoomSession] = useState(() => getRoomSession())
  const [roomNotice, setRoomNotice] = useState<string | null>(null)
  const [connection, setConnection] = useState<'online' | 'reconnecting'>('online')
  const endpointMode = roomSession?.role === 'spectator' ? 'player' : roomSession?.role ?? modeFromPort()
  const isSpectator = roomSession?.role === 'spectator'
  const roomReady = !!roomSession || bypassRoomLobby
  useEffect(() => subscribeRoomSession(setRoomSession), [])

  useEffect(() => {
    if (!roomSession) return
    let disposed = false
    let pulsing = false
    const pulse = async () => {
      if (pulsing) return
      pulsing = true
      try {
        const characterState = useCharacterStore.getState()
        const assignedCharacterId = roomSession.role === 'player'
          ? getAssignedPlayerCharacterId(roomSession.slot)
          : roomSession.role === 'dm' ? characterState.selectedId : null
        const activeCharacter = roomSession.role === 'player'
          ? getPlayerCharacter(characterState.characters, {
              slot: roomSession.slot,
              assignedCharacterId,
            })
          : roomSession.role === 'dm' && assignedCharacterId
            ? characterState.characters.find((character) => character.id === assignedCharacterId)
            : undefined
        let rules = await heartbeatRoom(
          roomSession,
          activeDnd5eRulesPluginRequirements(),
          activeCharacter
            ? { activeCharacterId: activeCharacter.id, activeCharacterName: activeCharacter.name }
            : undefined,
        )
        if (!rules.member.ready) {
          try {
            rules = (await synchronizeRoomPlugins(roomSession, rules)).rules
            setRoomPluginSyncError(null)
          } catch (pluginError) {
            console.error('[房间规则包自动同步]', pluginError)
            setRoomPluginSyncError(pluginError instanceof Error ? pluginError.message : String(pluginError))
          }
        } else {
          setRoomPluginSyncError(null)
        }
        if (!disposed) setRoomRulesSnapshot(rules)
        if (!disposed) setConnection('online')
      } catch (error) {
        if (disposed) return
        const terminal = roomHeartbeatErrorIsTerminal(error)
        if (terminal) {
          clearRoomSession()
          setRoomRulesSnapshot(null)
          setRoomPluginSyncError(null)
          setRoomNotice(roomApiErrorMessage(error))
          return
        }
        setConnection('reconnecting')
      } finally {
        pulsing = false
      }
    }
    void pulse()
    const timer = window.setInterval(() => void pulse(), 5_000)
    const wake = () => void pulse()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void pulse()
    }
    window.addEventListener('focus', wake)
    window.addEventListener('online', wake)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('focus', wake)
      window.removeEventListener('online', wake)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [roomSession])

  useEffect(() => {
    if (!roomReady) return
    let disposed = false
    let stop: (() => void) | undefined
    void import('./lib/roomSharedStateSync').then(({ startRoomSharedStateSync }) => {
      if (disposed) return
      stop = startRoomSharedStateSync()
    })
    return () => {
      disposed = true
      stop?.()
    }
  }, [endpointMode, roomReady, roomSession])

  useEffect(() => {
    if (!roomReady || roomSession?.role === 'spectator') return
    const stopInventory = startDnd5eInventoryAuthoritySync()
    return () => stopInventory()
  }, [endpointMode, roomReady, roomSession])

  useEffect(() => {
    if (roomSession?.role !== 'player') return
    return startAccountCharacterVaultSync()
  }, [roomSession])

  if (!roomSession && !bypassRoomLobby) return (
    <>
      <ServerCompatibilityBanner mode={endpointMode} />
      <SharedIntegrityBanner />
      <SharedSyncRecoveryBanner />
      <Suspense fallback={<PageLoadingFallback />}>
        <RoomLobbyPage notice={roomNotice} />
      </Suspense>
    </>
  )

  const handleLeaveRoom = async () => {
    if (!roomSession) return
    if (roomSession.role === 'dm' && !window.confirm('关闭房间后，所有玩家都需要重新加入。确定离开吗？')) return
    try {
      await leaveRoom(roomSession)
    } catch {
      // 即使共享服务暂时不可达，也清除本机会话；房主心跳超时后房间会自动离线。
    }
    clearRoomSession()
    setRoomRulesSnapshot(null)
    setRoomPluginSyncError(null)
    window.location.assign('/')
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <ServerCompatibilityBanner mode={endpointMode} />
      <SharedIntegrityBanner />
      <SharedSyncRecoveryBanner />
      <Suspense fallback={null}>
        {!isSpectator && <RoomHandoutNotification />}
        {!isSpectator && <GroupAbilityCheckSystem />}
        <CampaignTimeSystem isDm={endpointMode !== 'player'} />
        <SceneAudioPlaybackSystem />
      </Suspense>
      <iframe
        title="D20 dice preloader"
        src="/dice-box-frame.html?badge=0"
        className="dice-box-preload-frame"
        sandbox="allow-scripts allow-same-origin"
        aria-hidden="true"
      />
      {!collapsed && (
        <Sidebar
          mode={endpointMode ?? undefined}
          roomSession={roomSession ?? undefined}
          connection={connection}
          onCollapse={() => setCollapsed(true)}
          onLeaveRoom={roomSession ? () => void handleLeaveRoom() : undefined}
        />
      )}
      <main className={`relative flex-1 overflow-y-auto py-6 pr-6 ${collapsed ? 'pl-16' : 'pl-6'}`}>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            title="展开侧边栏"
            className="glass absolute left-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:text-arcane-200"
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        )}
        <Routes>
          <Route path="/" element={endpointMode === 'player' ? <Navigate to="/maps" replace /> : lazyPage('战役总览', <Dashboard />)} />
          <Route path="/maps" element={lazyPage('地图与战斗', <MapsPage />)} />
          {!isSpectator && <Route path="/characters" element={lazyPage('角色页面', <CharactersPage />)} />}
          {!isSpectator && <Route path="/spellbook" element={lazyPage('法术书', <SpellbookPage />)} />}
          {!isSpectator && <Route path="/communications" element={lazyPage('通讯与日志', <CommunicationsPage />)} />}
          {!isSpectator && <Route path="/settings" element={lazyPage('设置页面', <RulesPluginsPage />)} />}
          {endpointMode === 'player' && <Route path="*" element={<Navigate to="/maps" replace />} />}
        </Routes>
      </main>
    </div>
  )
}
