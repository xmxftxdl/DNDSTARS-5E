import { useEffect, useState } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { PanelLeftOpen } from 'lucide-react'
import Sidebar from './components/Sidebar'
import ServerCompatibilityBanner from './components/ServerCompatibilityBanner'
import SharedIntegrityBanner from './components/SharedIntegrityBanner'
import PageErrorBoundary from './components/PageErrorBoundary'
import { SharedSyncRecoveryBanner } from './components/SharedSyncStatus'
import RoomLobbyPage from './pages/RoomLobbyPage'
import Dashboard from './pages/Dashboard'
import MapsPage from './pages/MapsPage'
import CharactersPage from './pages/CharactersPage'
import RulesPluginsPage from './pages/RulesPluginsPage'
import SpellbookPage from './pages/SpellbookPage'
import { modeFromPort } from './lib/appMode'
import { heartbeatRoom, leaveRoom, roomApiErrorMessage, roomHeartbeatErrorIsTerminal } from './lib/roomApi'
import { clearRoomSession, getRoomSession, subscribeRoomSession } from './lib/roomSession'
import { setRoomPluginSyncError, setRoomRulesSnapshot } from './lib/roomRulesState'
import { synchronizeRoomPlugins } from './lib/roomPluginSync'
import { subscribeSharedResourceInvalidation } from './lib/sharedApi'
import { useMapStore } from './store/maps'
import { useFogStore } from './store/fog'
import { useMapGeometryStore } from './store/mapGeometry'
import { useMapExplorationStore } from './store/mapExploration'
import { useCharacterStore } from './store/characters'
import { SHARED_SPELLBOOK_RESOURCE, useSpellbookStore } from './store/spellbook'
import { activeDnd5eRulesPluginRequirements } from './rulesets/dnd5e'
import { startDnd5eInventoryAuthoritySync } from './lib/inventoryAuthority'
import { getAssignedPlayerCharacterId } from './lib/playerView'
import { MAP_FOG_RESOURCE } from './lib/fogOfWar'
import { MAP_GEOMETRY_RESOURCE } from './lib/mapGeometry'
import { MAP_EXPLORATION_RESOURCE } from './lib/mapExploration'
import { startAccountCharacterVaultSync } from './lib/accountCharacterVault'

export default function App() {
  const bypassRoomLobby = import.meta.env.VITE_BYPASS_ROOM_LOBBY === '1'
  const [collapsed, setCollapsed] = useState(false)
  const [roomSession, setRoomSession] = useState(() => getRoomSession())
  const [roomNotice, setRoomNotice] = useState<string | null>(null)
  const [connection, setConnection] = useState<'online' | 'reconnecting'>('online')
  const endpointMode = roomSession?.role ?? modeFromPort()
  const roomReady = !!roomSession || bypassRoomLobby
  const loadSharedMaps = useMapStore((s) => s.loadShared)
  const loadSharedFog = useFogStore((s) => s.loadShared)
  const loadSharedMapGeometry = useMapGeometryStore((s) => s.loadShared)
  const loadSharedMapExploration = useMapExplorationStore((s) => s.loadShared)
  const loadSharedCharacters = useCharacterStore((s) => s.loadShared)
  const loadSharedSpellbook = useSpellbookStore((s) => s.loadShared)

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
        const activeCharacterId = roomSession.role === 'player'
          ? getAssignedPlayerCharacterId(roomSession.slot)
          : characterState.selectedId
        const activeCharacter = activeCharacterId
          ? characterState.characters.find((character) => character.id === activeCharacterId)
          : undefined
        let rules = await heartbeatRoom(roomSession, activeDnd5eRulesPluginRequirements(), {
          activeCharacterId: activeCharacter?.id ?? null,
          activeCharacterName: activeCharacter?.name ?? null,
        })
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
    void Promise.all([loadSharedMaps(), loadSharedCharacters(), loadSharedSpellbook(), loadSharedFog(), loadSharedMapGeometry(), loadSharedMapExploration()])
    const stopMaps = subscribeSharedResourceInvalidation('maps', loadSharedMaps)
    const stopCharacters = subscribeSharedResourceInvalidation('characters', loadSharedCharacters)
    const stopSpellbook = subscribeSharedResourceInvalidation(SHARED_SPELLBOOK_RESOURCE, loadSharedSpellbook)
    const stopFog = subscribeSharedResourceInvalidation(MAP_FOG_RESOURCE, loadSharedFog)
    const stopMapGeometry = subscribeSharedResourceInvalidation(MAP_GEOMETRY_RESOURCE, async () => {
      await loadSharedMapGeometry()
      // Geometry changes can make tokens newly visible or hidden without changing the map resource.
      // Re-fetch the server-side player projection immediately instead of waiting for recovery polling.
      await loadSharedMaps()
    })
    const stopMapExploration = subscribeSharedResourceInvalidation(MAP_EXPLORATION_RESOURCE, loadSharedMapExploration)
    return () => {
      stopMaps()
      stopCharacters()
      stopSpellbook()
      stopFog()
      stopMapGeometry()
      stopMapExploration()
    }
  }, [endpointMode, loadSharedCharacters, loadSharedFog, loadSharedMapExploration, loadSharedMapGeometry, loadSharedMaps, loadSharedSpellbook, roomReady, roomSession])

  useEffect(() => {
    if (!roomReady) return
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
      <RoomLobbyPage notice={roomNotice} />
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
          <Route path="/" element={endpointMode === 'player' ? <Navigate to="/maps" replace /> : <PageErrorBoundary scope="战役总览"><Dashboard /></PageErrorBoundary>} />
          <Route path="/maps" element={<PageErrorBoundary scope="地图与战斗"><MapsPage /></PageErrorBoundary>} />
          <Route path="/characters" element={<PageErrorBoundary scope="角色页面"><CharactersPage /></PageErrorBoundary>} />
          <Route path="/spellbook" element={<PageErrorBoundary scope="法术书"><SpellbookPage /></PageErrorBoundary>} />
          <Route path="/settings" element={<PageErrorBoundary scope="规则包页面"><RulesPluginsPage /></PageErrorBoundary>} />
          {endpointMode === 'player' && <Route path="*" element={<Navigate to="/maps" replace />} />}
        </Routes>
      </main>
    </div>
  )
}
