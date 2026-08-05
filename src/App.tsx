import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { PanelLeftOpen } from 'lucide-react'
import AccountAppShell from './components/AccountAppShell'
import ServerCompatibilityBanner from './components/ServerCompatibilityBanner'
import SharedIntegrityBanner from './components/SharedIntegrityBanner'
import PageErrorBoundary from './components/PageErrorBoundary'
import { SharedSyncRecoveryBanner } from './components/SharedSyncStatus'
import { modeFromPort } from './lib/appMode'
import { closeRoom, heartbeatRoom, leaveRoom, roomApiErrorMessage, roomHeartbeatErrorIsTerminal } from './lib/roomApi'
import { clearRoomSession, getRoomSession, subscribeRoomSession } from './lib/roomSession'
import { setRoomPluginSyncError, setRoomRulesSnapshot } from './lib/roomRulesState'
import { getAssignedPlayerCharacterId, getPlayerCharacter } from './lib/playerView'
import { getAccountSession, subscribeAccountSession } from './lib/accountSession'
import { nextCampaignRoomPath } from './lib/campaignNavigation'
import { showAppConfirm } from './lib/appDialog'

const AccountCampaignsPage = lazy(() => import('./pages/AccountCampaignsPage'))
const Sidebar = lazy(() => import('./components/Sidebar'))
const AccountProfilePage = lazy(() => import('./pages/AccountProfilePage'))
const PublicLandingPage = lazy(() => import('./pages/PublicLandingPage'))
const PublicCombatPage = lazy(() => import('./pages/PublicCombatPage'))
const PublicExtensionPage = lazy(() => import('./pages/PublicExtensionPage'))
const PublicBlogPage = lazy(() => import('./pages/PublicBlogPage'))
const PublicPricingPage = lazy(() => import('./pages/PublicPricingPage'))
const RoomLobbyPage = lazy(() => import('./pages/RoomLobbyPage'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CombatSimulationPage = lazy(() => import('./pages/CombatSimulationPage'))
const DmPrepAssistantPage = lazy(() => import('./pages/DmPrepAssistantPage'))
const DmWorkshopPage = lazy(() => import('./pages/DmWorkshopPage'))
const ActiveRulesExtensionsPage = lazy(() => import('./pages/ActiveRulesExtensionsPage'))
const MapsPage = lazy(() => import('./pages/MapsPage'))
const CharactersPage = lazy(() => import('./pages/CharactersPage'))
const CampaignSettingsPage = lazy(() => import('./pages/CampaignSettingsPage'))
const PluginsPage = lazy(() => import('./pages/PluginsPage'))
const PluginPublisherPage = lazy(() => import('./pages/PluginPublisherPage'))
const PluginCatalogDetailPage = lazy(() => import('./pages/PluginCatalogDetailPage'))
const SpellbookPage = lazy(() => import('./pages/SpellbookPage'))
const CommunicationsPage = lazy(() => import('./pages/CommunicationsPage'))
const RoomHandoutNotification = lazy(() => import('./components/RoomHandoutNotification'))
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
  const [roomTransition, setRoomTransition] = useState<'leave' | 'new-room' | null>(null)
  const endpointMode = roomSession?.role === 'spectator' ? 'player' : roomSession?.role ?? modeFromPort()
  const isSpectator = roomSession?.role === 'spectator'
  const dmToolsAvailable = roomSession?.role === 'dm' || (!roomSession && endpointMode === 'dm')
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
        const [
          { useCharacterStore },
          { roomActiveDnd5eRulesPluginRequirements },
          { ensureDnd5eRulesPluginHost },
        ] = await Promise.all([
          import('./store/characters'),
          import('./rulesets/dnd5e/plugins/pluginRequirementProjection'),
          import('./rulesets/dnd5e/pluginLoader'),
        ])
        // A user can log in on the public landing page and enter the campaign
        // through BrowserRouter without a document reload. In that path
        // main.tsx intentionally did not load the rules runtime, so initialize
        // it here before reporting active room plugins to the server.
        await ensureDnd5eRulesPluginHost()
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
          roomActiveDnd5eRulesPluginRequirements(),
          activeCharacter
            ? { activeCharacterId: activeCharacter.id, activeCharacterName: activeCharacter.name }
            : undefined,
        )
        if (!rules.member.ready) {
          try {
            const { synchronizeRoomPlugins } = await import('./lib/roomPluginSync')
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
          await window.DNDSTARS_5E_RULES_PLUGINS?.clearEphemeral()
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
    let disposed = false
    let stopInventory: (() => void) | undefined
    void import('./lib/inventoryAuthority').then(({ startDnd5eInventoryAuthoritySync }) => {
      if (disposed) return
      stopInventory = startDnd5eInventoryAuthoritySync()
    })
    return () => {
      disposed = true
      stopInventory?.()
    }
  }, [endpointMode, publicWebsiteRequested, roomReady, roomSession])

  useEffect(() => {
    if (publicWebsiteRequested || roomSession?.role !== 'player') return
    let disposed = false
    let stopVault: (() => void) | undefined
    void import('./lib/accountCharacterVault').then(({ startAccountCharacterVaultSync }) => {
      if (disposed) return
      stopVault = startAccountCharacterVaultSync()
    })
    return () => {
      disposed = true
      stopVault?.()
    }
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
      'dm-tools',
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

  const handleLeaveRoom = async (intent: 'leave' | 'new-room' = 'leave') => {
    if (!roomSession || roomTransition) return
    const nextRoomPath = intent === 'new-room' ? nextCampaignRoomPath(campaignId) : null
    if (intent === 'new-room' && !nextRoomPath) {
      setRoomNotice('当前房间没有绑定账号级战役，无法建立下一场房间。请先从战役列表进入该战役。')
      return
    }
    const confirmation = intent === 'new-room'
      ? '建立下一场房间会结束当前临时房间，但地图、角色、讲义和战役总览数据会继续保留在当前战役中。确定继续吗？'
      : '离开后房间不会关闭；下次可从战役列表恢复并继续使用。确定离开吗？'
    if (roomSession.role === 'dm' && !(await showAppConfirm(confirmation))) return
    setRoomTransition(intent)
    try {
      if (intent === 'new-room') await closeRoom(roomSession)
      else await leaveRoom(roomSession)
    } catch (error) {
      if (intent === 'new-room') {
        setRoomNotice(`当前房间未能结束：${roomApiErrorMessage(error)}`)
        setRoomTransition(null)
        return
      }
      // 即使共享服务暂时不可达，也清除本机会话；房主心跳超时后房间会自动离线。
    }
    try {
      await window.DNDSTARS_5E_RULES_PLUGINS?.clearEphemeral()
    } catch {
      // 房间状态已经由服务端提交；本地插件清理失败不能阻止离开或进入下一场。
    }
    clearRoomSession()
    setRoomRulesSnapshot(null)
    setRoomPluginSyncError(null)
    if (intent === 'new-room') {
      navigate(nextRoomPath!, { replace: true })
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
        <Suspense fallback={null}>
          <Sidebar
            mode={endpointMode ?? undefined}
            roomSession={roomSession ?? undefined}
            campaignBasePath={campaignBasePath}
            connection={connection}
            onCollapse={() => setCollapsed(true)}
            onLeaveRoom={roomSession ? () => void handleLeaveRoom('leave') : undefined}
          />
        </Suspense>
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
                    onCreateCampaign={() => void handleLeaveRoom('new-room')}
                    creatingCampaign={roomTransition === 'new-room'}
                  />
                ))}
          />
          {dmToolsAvailable && <>
            <Route
              path="/campaign/:campaignId/dm-tools/simulation"
              element={lazyPage('战斗 AI 模拟', <CombatSimulationPage />)}
            />
            <Route
              path="/campaign/:campaignId/dm-tools/workshop"
              element={lazyPage('自定义工坊', <DmWorkshopPage />)}
            />
            <Route
              path="/campaign/:campaignId/dm-tools/prep"
              element={lazyPage('备团助手', <DmPrepAssistantPage />)}
            />
            <Route
              path="/campaign/:campaignId/dm-tools"
              element={<Navigate to={`${campaignBasePath}/dm-tools/workshop`} replace />}
            />
            <Route
              path="/campaign/:campaignId/simulation"
              element={<Navigate to={`${campaignBasePath}/dm-tools/simulation`} replace />}
            />
          </>}
          <Route path="/campaign/:campaignId/maps" element={lazyPage('地图与战斗', <MapsPage />)} />
          {!isSpectator && <Route path="/campaign/:campaignId/characters" element={lazyPage('角色页面', <CharactersPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/spellbook" element={lazyPage('法术书', <SpellbookPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/communications" element={lazyPage('通讯与日志', <CommunicationsPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/extensions" element={lazyPage('规则与扩展', <ActiveRulesExtensionsPage />)} />}
          {!isSpectator && <Route path="/campaign/:campaignId/settings" element={lazyPage('设置页面', <CampaignSettingsPage />)} />}
          <Route path="/campaign/:campaignId" element={<Navigate to={defaultCampaignPath} replace />} />
          <Route path="/" element={<Navigate to={defaultCampaignPath} replace />} />
          <Route path="/maps" element={<Navigate to={`${campaignBasePath}/maps`} replace />} />
          <Route path="/characters" element={<Navigate to={`${campaignBasePath}/characters`} replace />} />
          <Route path="/spellbook" element={<Navigate to={`${campaignBasePath}/spellbook`} replace />} />
          <Route path="/communications" element={<Navigate to={`${campaignBasePath}/communications`} replace />} />
          <Route path="/simulation" element={<Navigate to={`${campaignBasePath}/dm-tools/simulation`} replace />} />
          <Route path="/settings" element={<Navigate to={`${campaignBasePath}/settings`} replace />} />
          <Route path="*" element={<Navigate to={defaultCampaignPath} replace />} />
        </Routes>
      </main>
    </div>
  )
}
