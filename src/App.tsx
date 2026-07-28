import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { PanelLeftOpen } from 'lucide-react'
import AccountAppShell from './components/AccountAppShell'
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
import { getAccountSession, subscribeAccountSession } from './lib/accountSession'

const AccountCampaignsPage = lazy(() => import('./pages/AccountCampaignsPage'))
const AccountProfilePage = lazy(() => import('./pages/AccountProfilePage'))
const PublicLandingPage = lazy(() => import('./pages/PublicLandingPage'))
const PublicCombatPage = lazy(() => import('./pages/PublicCombatPage'))
const PublicExtensionPage = lazy(() => import('./pages/PublicExtensionPage'))
const PublicBlogPage = lazy(() => import('./pages/PublicBlogPage'))
const PublicPricingPage = lazy(() => import('./pages/PublicPricingPage'))
const RoomLobbyPage = lazy(() => import('./pages/RoomLobbyPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CombatSimulationPage = lazy(() => import('./pages/CombatSimulationPage'))
const MapsPage = lazy(() => import('./pages/MapsPage'))
const CharactersPage = lazy(() => import('./pages/CharactersPage'))
const RulesPluginsPage = lazy(() => import('./pages/RulesPluginsPage'))
const PluginsPage = lazy(() => import('./pages/PluginsPage'))
const PluginPublisherPage = lazy(() => import('./pages/PluginPublisherPage'))
const PluginCatalogDetailPage = lazy(() => import('./pages/PluginCatalogDetailPage'))
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
  const location = useLocation()
  const navigate = useNavigate()
  const bypassRoomLobby = import.meta.env.VITE_BYPASS_ROOM_LOBBY === '1'
  const [collapsed, setCollapsed] = useState(false)
  const [account, setAccount] = useState(() => getAccountSession())
  const [roomSession, setRoomSession] = useState(() => getRoomSession())
  const [roomNotice, setRoomNotice] = useState<string | null>(null)
  const [connection, setConnection] = useState<'online' | 'reconnecting'>('online')
  const [roomTransition, setRoomTransition] = useState<'leave' | 'new-campaign' | null>(null)
  const endpointMode = roomSession?.role === 'spectator' ? 'player' : roomSession?.role ?? modeFromPort()
  const isSpectator = roomSession?.role === 'spectator'
  const roomReady = !!roomSession || bypassRoomLobby
  const campaignId = roomSession?.campaignId ?? roomSession?.roomId ?? 'local'
  const campaignBasePath = `/campaign/${encodeURIComponent(campaignId)}`
  const defaultCampaignPath = `${campaignBasePath}/${endpointMode === 'player' ? 'maps' : 'overview'}`
  const campaignRouteMatch = location.pathname.match(/^\/campaign\/([^/]+)(?:\/|$)/)
  const campaignSectionMatch = location.pathname.match(/^\/campaign\/[^/]+\/([^/]+)(?:\/|$)/)
  const publicWebsitePaths = new Set(['/', '/combat', '/extension', '/extensions', '/blog', '/pricing'])
  const publicWebsiteRequested = publicWebsitePaths.has(location.pathname) &&
    !(bypassRoomLobby && location.pathname === '/')
  const legacyWorkspacePaths = new Set([
    '/maps',
    '/characters',
    '/spellbook',
    '/communications',
    '/simulation',
    '/settings',
  ])
  const workspaceRequested = campaignRouteMatch != null ||
    legacyWorkspacePaths.has(location.pathname) ||
    (bypassRoomLobby && location.pathname === '/')

  useEffect(() => subscribeAccountSession(setAccount), [])
  useEffect(() => subscribeRoomSession(setRoomSession), [])

  useEffect(() => {
    if (publicWebsiteRequested || !roomSession) return
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
          navigate('/app', { replace: true })
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
  }, [navigate, publicWebsiteRequested, roomSession])

  useEffect(() => {
    if (publicWebsiteRequested || !roomReady) return
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
  }, [endpointMode, publicWebsiteRequested, roomReady, roomSession])

  useEffect(() => {
    if (publicWebsiteRequested || !roomReady || roomSession?.role === 'spectator') return
    const stopInventory = startDnd5eInventoryAuthoritySync()
    return () => stopInventory()
  }, [endpointMode, publicWebsiteRequested, roomReady, roomSession])

  useEffect(() => {
    if (publicWebsiteRequested || roomSession?.role !== 'player') return
    return startAccountCharacterVaultSync()
  }, [publicWebsiteRequested, roomSession])

  if (publicWebsiteRequested) {
    return (
      <Routes>
        <Route path="/" element={lazyPage('星痕产品网站', <PublicLandingPage />)} />
        <Route path="/combat" element={lazyPage('星痕战斗系统', <PublicCombatPage />)} />
        <Route path="/extension" element={lazyPage('星痕扩展中心', <PublicExtensionPage />)} />
        <Route path="/extensions" element={<Navigate to="/extension" replace />} />
        <Route path="/blog" element={lazyPage('星痕博客', <PublicBlogPage />)} />
        <Route path="/pricing" element={lazyPage('星痕价格', <PublicPricingPage />)} />
      </Routes>
    )
  }

  if (!workspaceRequested) {
    const activeCampaignPath = roomSession
      ? `/campaign/${encodeURIComponent(roomSession.campaignId ?? roomSession.roomId)}/${roomSession.role === 'player' || roomSession.role === 'spectator' ? 'maps' : 'overview'}`
      : undefined
    return (
      <>
        <ServerCompatibilityBanner mode={endpointMode} />
        <SharedIntegrityBanner />
        <SharedSyncRecoveryBanner />
        <AccountAppShell
          accountName={account?.username ?? account?.displayName}
          accountAvatar={account?.avatar}
          activeCampaignPath={activeCampaignPath}
        >
          <Routes>
            <Route
              path="/app"
              element={lazyPage('我的战役', <AccountCampaignsPage account={account} roomSession={roomSession} />)}
            />
            <Route
              path="/app/rooms"
              element={lazyPage('创建或加入房间', <RoomLobbyPage notice={roomNotice} embedded />)}
            />
            <Route path="/app/extensions" element={lazyPage('我的扩展', <PluginsPage />)} />
            <Route path="/app/profile" element={account
              ? lazyPage('个人资料', <AccountProfilePage />)
              : <Navigate to="/app?auth=login" replace />}
            />
            <Route
              path="/app/extensions/publishers/:publisherId"
              element={lazyPage('扩展发布者', <PluginPublisherPage />)}
            />
            <Route
              path="/app/extensions/catalog/:pluginId"
              element={lazyPage('扩展商品详情', <PluginCatalogDetailPage />)}
            />
            <Route path="/plugin" element={<Navigate to="/app/extensions" replace />} />
            <Route path="/plugins" element={<Navigate to="/app/extensions" replace />} />
            <Route
              path="/plugins/publishers/:publisherId"
              element={<Navigate to={`/app/extensions${location.pathname.slice('/plugins'.length)}`} replace />}
            />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </AccountAppShell>
      </>
    )
  }

  if (!roomReady) return (
    <>
      <ServerCompatibilityBanner mode={endpointMode} />
      <SharedIntegrityBanner />
      <SharedSyncRecoveryBanner />
      <Navigate to="/app" replace />
    </>
  )

  if (campaignRouteMatch && decodeURIComponent(campaignRouteMatch[1]) !== campaignId) {
    const bootstrapSection = decodeURIComponent(campaignRouteMatch[1]) === 'local'
      ? campaignSectionMatch?.[1]
      : undefined
    const compatibleBootstrapSections = new Set([
      'overview',
      'maps',
      'characters',
      'spellbook',
      'communications',
      'simulation',
      'extensions',
      'settings',
    ])
    return (
      <Navigate
        to={bootstrapSection && compatibleBootstrapSections.has(bootstrapSection)
          ? `${campaignBasePath}/${bootstrapSection}`
          : defaultCampaignPath}
        replace
      />
    )
  }

  const handleLeaveRoom = async (intent: 'leave' | 'new-campaign' = 'leave') => {
    if (!roomSession || roomTransition) return
    const confirmation = intent === 'new-campaign'
      ? '新建战役会关闭当前房间，房间内玩家将断开连接。当前战役的服务器数据不会被覆盖。确定继续吗？'
      : '关闭房间后，所有玩家都需要重新加入。确定离开吗？'
    if (roomSession.role === 'dm' && !window.confirm(confirmation)) return
    setRoomTransition(intent)
    try {
      await leaveRoom(roomSession)
    } catch {
      // 即使共享服务暂时不可达，也清除本机会话；房主心跳超时后房间会自动离线。
    }
    clearRoomSession()
    setRoomRulesSnapshot(null)
    setRoomPluginSyncError(null)
    if (intent === 'new-campaign') {
      navigate('/app/rooms?mode=create', { replace: true })
      setRoomTransition(null)
      return
    }
    navigate('/app', { replace: true })
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
          campaignBasePath={campaignBasePath}
          connection={connection}
          onCollapse={() => setCollapsed(true)}
          onLeaveRoom={roomSession ? () => void handleLeaveRoom('leave') : undefined}
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
          <Route
            path="/campaign/:campaignId/overview"
            element={endpointMode === 'player'
              ? <Navigate to={`${campaignBasePath}/maps`} replace />
              : lazyPage('战役总览', (
                  <Dashboard
                    onCreateCampaign={() => void handleLeaveRoom('new-campaign')}
                    creatingCampaign={roomTransition === 'new-campaign'}
                  />
                ))}
          />
          {endpointMode !== 'player' && (
            <Route
              path="/campaign/:campaignId/simulation"
              element={lazyPage('战斗 AI 模拟', <CombatSimulationPage />)}
            />
          )}
          <Route path="/campaign/:campaignId/maps" element={lazyPage('地图与战斗', <MapsPage />)} />
          {!isSpectator && <Route path="/campaign/:campaignId/characters" element={lazyPage('角色页面', <CharactersPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/spellbook" element={lazyPage('法术书', <SpellbookPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/communications" element={lazyPage('通讯与日志', <CommunicationsPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/extensions" element={lazyPage('规则与扩展', <PluginsPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/settings" element={lazyPage('设置页面', <RulesPluginsPage />)} />}
          <Route path="/campaign/:campaignId" element={<Navigate to={defaultCampaignPath} replace />} />
          <Route path="/" element={<Navigate to={defaultCampaignPath} replace />} />
          <Route path="/maps" element={<Navigate to={`${campaignBasePath}/maps`} replace />} />
          <Route path="/characters" element={<Navigate to={`${campaignBasePath}/characters`} replace />} />
          <Route path="/spellbook" element={<Navigate to={`${campaignBasePath}/spellbook`} replace />} />
          <Route path="/communications" element={<Navigate to={`${campaignBasePath}/communications`} replace />} />
          <Route path="/simulation" element={<Navigate to={`${campaignBasePath}/simulation`} replace />} />
          <Route path="/settings" element={<Navigate to={`${campaignBasePath}/settings`} replace />} />
          <Route path="*" element={<Navigate to={defaultCampaignPath} replace />} />
        </Routes>
      </main>
    </div>
  )
}
