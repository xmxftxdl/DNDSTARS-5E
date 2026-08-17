import { useEffect, useRef, useState } from 'react'
import { AppState, Image, Pressable, SafeAreaView, StatusBar as NativeStatusBar, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Device from 'expo-device'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MobileRenderQuality, PlayerTokenView } from '../../packages/mobile-protocol/src'
import { AuthScreen } from './src/components/AuthScreen'
import { CharacterScreen } from './src/components/CharacterScreen'
import { CharacterCreateModal } from './src/components/CharacterCreateModal'
import { CombatActionSheet, type ActionTab, type PendingMapTarget } from './src/components/CombatActionSheet'
import { CommunicationsScreen } from './src/components/CommunicationsScreen'
import { InterruptBanner } from './src/components/InterruptBanner'
import { PlayerHome } from './src/components/PlayerHome'
import { RoomLobbyScreen } from './src/components/RoomLobbyScreen'
import { RestRecoveryModal } from './src/components/RestRecoveryModal'
import { QuickCharacterSheet } from './src/components/QuickCharacterSheet'
import { SettingsScreen } from './src/components/SettingsScreen'
import { VoiceRoomPanel } from './src/components/VoiceRoomPanel'
import { MobileItemQuickbar } from './src/components/MobileItemQuickbar'
import { mobileActionAckKey, mobileActionAckMessage, mobileCombatLogKey, mobileCombatLogMessage } from './src/services/eventFeedbackModel'
import { useMobileWorkspace } from './src/hooks/useMobileWorkspace'
import { MobileSkiaMap } from './src/map/MobileSkiaMap'
import { TileDiskCache } from './src/map/TileDiskCache'
import { colors, loadMobileThemePreference, saveMobileThemePreference, type MobileThemePreference } from './src/theme'
import { installForegroundNotificationHandler } from './src/services/pushNotifications'

type Tab = 'home' | 'map' | 'character' | 'chat' | 'settings'

const tabs: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'home', icon: '✦', label: '冒险' },
  { id: 'map', icon: '◇', label: '地图' },
  { id: 'character', icon: '♙', label: '角色' },
  { id: 'chat', icon: '◌', label: '通讯' },
  { id: 'settings', icon: '⚙', label: '设置' },
]

function AppBody() {
  const insets = useSafeAreaInsets()
  const mobile = useMobileWorkspace()
  const [tab, setTab] = useState<Tab>('home')
  const [mapDockMode, setMapDockMode] = useState<'actions' | 'navigation'>('actions')
  const [quality, setQualityState] = useState<MobileRenderQuality>('standard')
  const [mapMemoryEpoch, setMapMemoryEpoch] = useState(0)
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active')
  const [theme, setTheme] = useState<MobileThemePreference>('dark')
  const [moving, setMoving] = useState(false)
  const [cacheStats, setCacheStats] = useState({ diskBytes: 0, gpuBytes: 0 })
  const [actionSheet, setActionSheet] = useState<{ visible: boolean; tab: ActionTab }>({ visible: false, tab: 'actions' })
  const [pendingTarget, setPendingTarget] = useState<PendingMapTarget | null>(null)
  const [localNotice, setLocalNotice] = useState('')
  const [dismissedRestId, setDismissedRestId] = useState('')
  const [quickCharacterOpen, setQuickCharacterOpen] = useState(false)
  const [characterCreateOpen, setCharacterCreateOpen] = useState(false)
  const [characterCreateBusy, setCharacterCreateBusy] = useState(false)
  const [restDismissalLoaded, setRestDismissalLoaded] = useState(false)
  const lastAckKey = useRef('')
  const lastCombatLogKey = useRef('')

  const roomId = mobile.workspace?.room.roomId ?? ''
  useEffect(() => {
    setDismissedRestId('')
    setRestDismissalLoaded(false)
    const ack = mobile.workspace?.actionAck
    lastAckKey.current = mobileActionAckKey(ack) || `ready:${roomId}`
    const latestLog = mobile.workspace?.combatLog.at(-1)
    lastCombatLogKey.current = mobileCombatLogKey(latestLog) || `ready:${roomId}`
    if (!roomId) return
    void AsyncStorage.getItem(`stars.mobile.rest.dismissed:${roomId}`).then((value) => {
      setDismissedRestId(value ?? '')
      setRestDismissalLoaded(true)
    })
  }, [roomId])

  useEffect(() => {
    void AsyncStorage.getItem('stars.mobile.quality').then((stored) => {
      if (stored === 'lite' || stored === 'standard' || stored === 'high') {
        setQualityState(stored)
        return
      }
      const totalMemory = Number(Device.totalMemory ?? 0)
      setQualityState(totalMemory > 0 && totalMemory < 4.5 * 1024 ** 3 ? 'lite' : 'standard')
    })
  }, [])
  useEffect(() => {
    let previous = AppState.currentState
    const subscription = AppState.addEventListener('change', (next) => {
      const becameActive = previous !== 'active' && next === 'active'
      previous = next
      setAppIsActive(next === 'active')
      if (becameActive) setMapMemoryEpoch((value) => value + 1)
    })
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    const memoryWarning = AppState.addEventListener('memoryWarning', () => {
      setQualityState('lite')
      setMapMemoryEpoch((value) => value + 1)
      setCacheStats((current) => ({ ...current, gpuBytes: 0 }))
      setLocalNotice('设备内存紧张，已释放地图纹理并切换到流畅画质')
    })
    return () => memoryWarning.remove()
  }, [])
  useEffect(() => { void loadMobileThemePreference().then(setTheme) }, [])
  useEffect(() => {
    const message = localNotice || mobile.notice
    if (!message) return
    const timer = setTimeout(() => setLocalNotice(''), 4_000)
    return () => clearTimeout(timer)
  }, [localNotice, mobile.notice])

  useEffect(() => {
    const ack = mobile.workspace?.actionAck
    if (!ack) return
    const key = mobileActionAckKey(ack)
    if (lastAckKey.current === key) return
    lastAckKey.current = key
    setLocalNotice(mobileActionAckMessage(ack, actionRejectionLabel))
  }, [mobile.workspace?.actionAck])

  useEffect(() => {
    const latest = mobile.workspace?.combatLog.at(-1)
    if (!latest) return
    const key = mobileCombatLogKey(latest)
    if (!lastCombatLogKey.current) lastCombatLogKey.current = `ready:${roomId}`
    if (lastCombatLogKey.current === key) return
    lastCombatLogKey.current = key
    if (tab !== 'chat') setLocalNotice(mobileCombatLogMessage(latest))
  }, [mobile.workspace?.combatLog, roomId, tab])

  const setQuality = (value: MobileRenderQuality) => {
    setQualityState(value)
    void AsyncStorage.setItem('stars.mobile.quality', value)
  }

  if (!mobile.account) {
    if (mobile.connection === 'restoring') return <LoadingScreen label="正在恢复账号…" />
    return <AuthScreen
      serverUrl={mobile.serverUrl}
      onServerUrlChange={mobile.setServerUrl}
      busy={mobile.busy}
      error={mobile.error}
      onLogin={mobile.login}
      onRegistered={mobile.acceptRegisteredAccount}
    />
  }

  if (!mobile.credentials) {
    return <RoomLobbyScreen
      account={mobile.account}
      campaigns={mobile.campaigns}
      busy={mobile.busy}
      error={mobile.error}
      onJoin={mobile.joinRoom}
      onLogout={mobile.logout}
    />
  }

  if (!mobile.workspace) {
    return <LoadingScreen
      label={mobile.connection === 'error' ? '房间恢复失败' : '正在读取玩家投影…'}
      detail={mobile.error}
      actionLabel="离开房间"
      onAction={() => void mobile.leaveRoom()}
    />
  }

  const workspace = mobile.workspace
  const latestRest = workspace.restAdvances[0] ?? null
  const scene = workspace.scene
  const interrupt = workspace.interrupts.find((entry) => entry.status === 'open' || entry.status === 'pending' || entry.status === 'rolling')
  const spectator = workspace.room.role === 'spectator'
  const openActions = (initialTab: ActionTab) => {
    if (spectator) return setLocalNotice('观战席为只读模式')
    if (!scene) return setLocalNotice('当前没有可操作地图')
    setActionSheet({ visible: true, tab: initialTab })
  }
  const finishTarget = async (input: PlayerTokenView | { x: number; y: number }) => {
    const target = pendingTarget
    if (!target) return
    setPendingTarget(null)
    try { await target.complete(input) } catch (cause) {
      setLocalNotice(cause instanceof Error ? cause.message : '行动提交失败')
    }
  }
  const finishOptionalTargeting = async () => {
    const target = pendingTarget
    if (!target?.finish) return
    setPendingTarget(null)
    try { await target.finish() } catch (cause) { setLocalNotice(cause instanceof Error ? cause.message : '行动提交失败') }
  }
  const notice = localNotice || mobile.notice
  const realtimeOpen = mobile.roomEventStream.state === 'open'
  const connectionColor = mobile.connection === 'error' ? colors.danger : realtimeOpen ? colors.success : colors.warning
  const quickCharacter = workspace.characters.find((entry) => entry.id === workspace.activeCharacterId)
  const quickToken = scene?.controlledTokens.find((entry) => entry.characterId === quickCharacter?.id)
  const quickPortrait = quickToken?.portraitSource ?? (quickCharacter?.tokenPortrait || quickCharacter?.portrait ? { uri: quickCharacter.tokenPortrait || quickCharacter.portrait || '' } : undefined)

  return <View style={[styles.app, { paddingTop: insets.top }]}>
    {tab !== 'map' && <View style={styles.header}>
      <Text style={styles.headerTitle}>{pageTitle(tab)}</Text>
      <View style={styles.connection}><View style={[styles.connectionDot, { backgroundColor: connectionColor }]} /><Text style={styles.connectionText}>{realtimeOpen ? '实时同步' : connectionLabel(mobile.connection)}</Text></View>
    </View>}
    <View style={styles.content}>
      {tab === 'home' && <PlayerHome
        workspace={workspace}
        onOpenMap={() => setTab('map')}
        onOpenActions={openActions}
        onEndTurn={() => void mobile.submitAction({ type: 'end-turn' }, '结束回合')}
        onDeathSave={() => void mobile.submitAction({ type: 'dnd5e-death-save', dnd5eDeathSave: {} }, '死亡豁免', !workspace.combat?.active)}
      />}
      {tab === 'map' && scene && appIsActive && <MobileSkiaMap
        key={`${scene.sceneId}:${mapMemoryEpoch}`}
        snapshot={scene}
        quality={quality}
        moving={moving}
        onMovingChange={setMoving}
        onMove={mobile.moveControlledToken}
        onCacheStats={setCacheStats}
        targeting={pendingTarget?.kind ?? null}
        onTargetToken={(token) => void finishTarget(token)}
        onTargetPoint={(point) => void finishTarget(point)}
        interactionPoints={workspace.interactionPoints}
        onInteract={mobile.interactWithPoint}
      />}
      {tab === 'map' && !scene && <EmptyState title="当前没有地图" body="DM 切换地图后，玩家可见场景会自动同步。" />}
      {tab === 'character' && <CharacterScreen
        workspace={workspace}
        onSelectCharacter={mobile.selectCharacter}
        onOpenCreate={() => setCharacterCreateOpen(true)}
        onSetSpellSlot={mobile.setSpellSlot}
        onSetSpellPrepared={mobile.setSpellPrepared}
        onLevelUp={mobile.levelUpCharacter}
        onRollLevelHitPoints={mobile.rollLevelHitPoints}
        onUpdateProfile={mobile.updateCharacterProfile}
        onInventoryMutation={mobile.submitInventoryMutation}
        onSpendHitDie={mobile.spendHitDie}
        onRecoverSpellSlot={mobile.recoverSpellSlot}
        accountCharacters={mobile.accountCharacters}
        onAttachAccountCharacter={async (record) => { await mobile.attachAccountCharacter(record) }}
      />}
      {tab === 'chat' && <CommunicationsScreen
        workspace={workspace}
        onSendChat={mobile.sendChat}
        onMutateJournal={mobile.mutateSharedNote}
        voicePanel={<VoiceRoomPanel credentials={mobile.credentials} enabled={workspace.voice.enabled} reason={workspace.voice.reason} />}
      />}
      {tab === 'settings' && <SettingsScreen
        account={mobile.account}
        workspace={workspace}
        connection={mobile.connection}
        roomEventStream={mobile.roomEventStream}
        quality={quality}
        onQualityChange={setQuality}
        theme={theme}
        onThemeChange={(value) => { setTheme(value); void saveMobileThemePreference(value) }}
        serverUrl={mobile.serverUrl}
        onServerUrlChange={mobile.setServerUrl}
        cacheBytes={cacheStats.diskBytes}
        gpuBytes={cacheStats.gpuBytes}
        onClearCache={() => {
          if (scene) void new TileDiskCache(scene.mapManifest.assetHash).clear()
          setCacheStats({ diskBytes: 0, gpuBytes: 0 })
        }}
        onReconnect={() => void mobile.refresh()}
        onLeaveRoom={mobile.leaveRoom}
        onLogout={mobile.logout}
        onUpdateProfile={mobile.updateProfile}
        onChangePassword={mobile.changePassword}
        onDeleteAccount={mobile.deleteAccount}
        pushPermission={mobile.pushPermission}
        onEnablePush={mobile.enablePushNotifications}
        onDisablePush={mobile.disablePushNotifications}
      />}
      {!!interrupt && <InterruptBanner interrupt={interrupt} registry={workspace.interruptRegistry} activeCharacterId={workspace.activeCharacterId} onAnswer={(response) => mobile.answerInterrupt(interrupt.id, response)} />}
    </View>
    <RestRecoveryModal
      advance={restDismissalLoaded && latestRest?.id !== dismissedRestId ? latestRest : null}
      onDismiss={dismissLatestRest}
      onOpenCharacter={() => { dismissLatestRest(); setTab('character') }}
    />
    <QuickCharacterSheet visible={quickCharacterOpen} character={quickCharacter} portraitSource={quickPortrait} onClose={() => setQuickCharacterOpen(false)} />
    <CharacterCreateModal
      visible={characterCreateOpen}
      busy={characterCreateBusy}
      onClose={() => { if (!characterCreateBusy) setCharacterCreateOpen(false) }}
      onCreate={async (input) => {
        setCharacterCreateBusy(true)
        try {
          await mobile.createCharacter(input)
          setCharacterCreateOpen(false)
        } finally {
          setCharacterCreateBusy(false)
        }
      }}
      onRollAbilities={mobile.rollCharacterAbilities}
    />
    {!!notice && <View pointerEvents="none" style={styles.notice}><Text numberOfLines={2} style={styles.noticeText}>{notice}</Text></View>}
    {tab === 'map' && scene && quickCharacter ? <Pressable accessibilityLabel={`快速查看${quickCharacter.name}的人物卡`} style={styles.quickCharacterButton} onPress={() => setQuickCharacterOpen(true)}>
      {quickPortrait ? <Image source={quickPortrait} style={styles.quickCharacterImage} /> : <Text style={styles.quickCharacterAvatar}>{quickCharacter.avatar}</Text>}
      <View style={styles.quickCharacterBadge}><Text style={styles.quickCharacterBadgeText}>角色卡</Text></View>
    </Pressable> : null}
    {tab === 'map' && scene && quickCharacter && !spectator ? <MobileItemQuickbar
      characterId={quickCharacter.id}
      entries={quickCharacter.dnd5eInventory?.entries ?? []}
      assetBaseUrl={mobile.serverUrl}
      onOpenBag={() => openActions('items')}
      onUse={(entry) => {
        const useActions = entry.item.useActions?.length
          ? entry.item.useActions
          : entry.item.use ? [{ id: 'default', label: '使用', ...entry.item.use }] : []
        const action = useActions[0]
        const targeting = action && typeof action.targeting === 'object' && action.targeting ? action.targeting as Record<string, unknown> : {}
        const effect = action && typeof action.effect === 'object' && action.effect ? action.effect as Record<string, unknown> : {}
        if (!action || useActions.length > 1 || targeting.kind === 'creature' || targeting.kind === 'map-area' || effect.kind === 'spell-cast') {
          openActions('items')
          return
        }
        void mobile.submitAction({ type: 'dnd5e-item-use', dnd5eItemUse: { instanceId: entry.instanceId } }, `使用${entry.item.name}`, !workspace.combat?.active)
          .catch((cause) => setLocalNotice(cause instanceof Error ? cause.message : '物品使用失败'))
      }}
    /> : null}
    {!!pendingTarget && <View style={styles.targetControls}>{pendingTarget.finish && <Pressable style={styles.finishTarget} onPress={() => void finishOptionalTargeting()}><Text style={styles.finishTargetText}>{pendingTarget.finishLabel || '完成选点'}</Text></Pressable>}<Pressable style={styles.cancelTarget} onPress={() => setPendingTarget(null)}><Text style={styles.cancelTargetText}>{pendingTarget.label} · 取消选点</Text></Pressable></View>}
    {tab === 'map'
      ? <View style={[styles.mapDock, { paddingBottom: Math.max(5, insets.bottom) }]}>
        {mapDockMode === 'navigation'
          ? <>
            {tabs.map((item) => <Pressable testID={`tab-${item.id}`} accessibilityRole="button" accessibilityLabel={item.label} key={item.id} style={styles.tab} onPress={() => setTab(item.id)}><Text style={[styles.tabIcon, item.id === 'map' && styles.tabActive]}>{item.icon}</Text><Text style={[styles.tabLabel, item.id === 'map' && styles.tabActive]}>{item.label}</Text></Pressable>)}
            <DockSwitch label="行动" icon="⚔" onPress={() => setMapDockMode('actions')} />
          </>
          : <>
            {!spectator && <>
              <RailButton assetPath="/assets/icons/move-action.png" assetBaseUrl={mobile.serverUrl} fallback="✦" label={moving ? '取消' : '移动'} active={moving} onPress={() => { setPendingTarget(null); setMoving((value) => !value) }} />
              <RailButton assetPath="/assets/icons/melee-attack-action.png" assetBaseUrl={mobile.serverUrl} fallback="⚔" label="攻击" onPress={() => openActions('actions')} />
              <RailButton assetPath="/assets/icons/magic-missile-spell-action.png" assetBaseUrl={mobile.serverUrl} fallback="✧" label="法术" onPress={() => openActions('spells')} />
              <RailButton assetPath="/assets/icons/bag-of-holding-item-action.png" assetBaseUrl={mobile.serverUrl} fallback="◈" label="物品" onPress={() => openActions('items')} />
              <RailButton assetPath="/assets/icons/fighter-action-surge-feature-action.png" assetBaseUrl={mobile.serverUrl} fallback="…" label="特性" onPress={() => openActions('features')} />
            </>}
            <DockSwitch label="导航" icon="☰" onPress={() => setMapDockMode('navigation')} />
          </>}
      </View>
      : <View style={[styles.tabBar, { paddingBottom: Math.max(7, insets.bottom) }]}>
        {tabs.map((item) => <Pressable testID={`tab-${item.id}`} accessibilityRole="button" accessibilityLabel={item.label} key={item.id} style={styles.tab} onPress={() => setTab(item.id)}><Text style={[styles.tabIcon, tab === item.id && styles.tabActive]}>{item.icon}</Text><Text style={[styles.tabLabel, tab === item.id && styles.tabActive]}>{item.label}</Text></Pressable>)}
      </View>}
    <CombatActionSheet
      visible={actionSheet.visible}
      initialTab={actionSheet.tab}
      workspace={workspace}
      assetBaseUrl={mobile.serverUrl}
      onClose={() => setActionSheet((state) => ({ ...state, visible: false }))}
      onSubmit={mobile.submitAction}
      onBeginMapTarget={(target) => { setPendingTarget(target); setTab('map') }}
    />
  </View>

  function dismissLatestRest() {
    if (!latestRest) return
    setDismissedRestId(latestRest.id)
    void AsyncStorage.setItem(`stars.mobile.rest.dismissed:${workspace.room.roomId}`, latestRest.id)
  }
}

function RailButton({ assetPath, assetBaseUrl, fallback, label, active, onPress }: { assetPath: string; assetBaseUrl: string; fallback: string; label: string; active?: boolean; onPress: () => void }) {
  const [imageFailed, setImageFailed] = useState(false)
  const assetUrl = assetBaseUrl ? `${assetBaseUrl.replace(/\/$/, '')}${assetPath}` : ''
  return <Pressable accessibilityRole="button" accessibilityLabel={label} style={[styles.railAction, active && styles.railActionActive]} onPress={onPress}>
    {assetUrl && !imageFailed
      ? <Image source={{ uri: assetUrl }} style={styles.railArtwork} resizeMode="cover" onError={() => setImageFailed(true)} />
      : <Text style={styles.railIcon}>{fallback}</Text>}
    <Text style={styles.railLabel}>{label}</Text>
  </Pressable>
}

function DockSwitch({ label, icon, onPress }: { label: string; icon: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}栏`} style={styles.dockSwitch} onPress={onPress}><Text style={styles.dockSwitchIcon}>{icon}</Text><Text style={styles.dockSwitchLabel}>{label}</Text></Pressable>
}

function LoadingScreen({ label, detail, actionLabel, onAction }: { label: string; detail?: string; actionLabel?: string; onAction?: () => void }) {
  return <View style={styles.loading}><View style={styles.brandMark}><Text style={styles.brandGlyph}>✦</Text></View><Text style={styles.brand}>星痕</Text><Text style={styles.loadingLabel}>{label}</Text>{!!detail && <Text style={styles.error}>{detail}</Text>}{actionLabel && onAction && <Pressable style={styles.secondaryButton} onPress={onAction}><Text style={styles.secondaryText}>{actionLabel}</Text></Pressable>}</View>
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{body}</Text></View>
}

function pageTitle(tab: Tab) {
  return ({ home: '玩家工作台', map: '战斗地图', character: '角色卡', chat: '通讯与日志', settings: '设置' } as const)[tab]
}

function connectionLabel(value: ReturnType<typeof useMobileWorkspace>['connection']) {
  return ({ restoring: '恢复中', offline: '离线', connecting: '连接中', online: '已同步', error: '异常' } as const)[value]
}

function actionRejectionLabel(reason?: string) {
  if (!reason) return 'Host 未提供具体原因'
  const labels: Record<string, string> = {
    'not-your-turn': '当前不是你的回合',
    'invalid-target': '目标不符合行动规则或已不可用',
    'out-of-range': '目标超出有效距离',
    'insufficient-action-economy': '本回合对应行动已用尽',
    'insufficient-resource': '法术位、充能或特性次数不足',
    'feature-unavailable': '角色未拥有该能力或尚未达到所需等级',
    'plugin-not-ready': '房间插件尚未同步完成',
    'stale-revision': '房间状态已更新，请重试本次行动',
  }
  return labels[reason] ?? reason
}

export default function App() {
  useEffect(() => { installForegroundNotificationHandler() }, [])
  return <GestureHandlerRootView style={styles.safe}><SafeAreaProvider><SafeAreaView style={styles.safe}><NativeStatusBar backgroundColor={colors.background} /><StatusBar style="auto" /><AppBody /></SafeAreaView></SafeAreaProvider></GestureHandlerRootView>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, app: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 },
  header: { minHeight: 58, paddingHorizontal: 16, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, connectionDot: { width: 7, height: 7, borderRadius: 4 }, connectionText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  tabBar: { minHeight: 62, flexDirection: 'row', backgroundColor: '#0c0c16', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7 }, tab: { flex: 1, minWidth: 48, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIcon: { color: colors.muted, fontSize: 19 }, tabLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' }, tabActive: { color: '#b69cff' },
  mapDock: { minHeight: 62, flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#0a0a13f7', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 5, paddingHorizontal: 5, gap: 4 }, railAction: { flex: 1, minWidth: 54, borderRadius: 12, backgroundColor: '#11111df2', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, railActionActive: { borderColor: colors.teal, backgroundColor: '#123735f2' }, railArtwork: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: '#ffffff24' }, railIcon: { color: colors.primary, fontSize: 17, fontWeight: '900' }, railLabel: { color: colors.text, fontSize: 8, fontWeight: '800', marginTop: 1 }, dockSwitch: { flex: 1, minWidth: 54, borderRadius: 12, borderWidth: 1, borderColor: '#6f54aa', backgroundColor: '#211936', alignItems: 'center', justifyContent: 'center' }, dockSwitchIcon: { color: '#c4b5fd', fontSize: 18, fontWeight: '900' }, dockSwitchLabel: { color: '#d8ccff', fontSize: 8, fontWeight: '900', marginTop: 2 },
  quickCharacterButton: { position: 'absolute', left: 12, bottom: 80, width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#c4b5fd', backgroundColor: colors.primarySoft, overflow: 'visible', alignItems: 'center', justifyContent: 'center', shadowColor: '#8b5cf6', shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 12 }, quickCharacterImage: { width: 52, height: 52, borderRadius: 26 }, quickCharacterAvatar: { fontSize: 27 }, quickCharacterBadge: { position: 'absolute', bottom: -8, backgroundColor: '#191628f5', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }, quickCharacterBadgeText: { color: '#ddd6fe', fontSize: 7, fontWeight: '900' },
  targetControls: { position: 'absolute', left: 12, right: 74, bottom: 84, flexDirection: 'row', gap: 7 }, cancelTarget: { flex: 1, alignItems: 'center', backgroundColor: '#30220df5', borderColor: colors.warning, borderWidth: 1, borderRadius: 13, padding: 11 }, cancelTargetText: { color: colors.warning, fontWeight: '900', fontSize: 10 }, finishTarget: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b2b2af5', borderColor: colors.teal, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12 }, finishTargetText: { color: colors.teal, fontWeight: '900', fontSize: 10 },
  notice: { position: 'absolute', left: 12, right: 12, bottom: 72, alignItems: 'center' }, noticeText: { color: colors.text, backgroundColor: '#151322f4', borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, fontSize: 10, fontWeight: '800' },
  loading: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, brandMark: { width: 70, height: 70, borderRadius: 24, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, brandGlyph: { color: '#c4b5fd', fontSize: 34 }, brand: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 15 }, loadingLabel: { color: colors.muted, marginTop: 8 }, error: { color: colors.danger, fontSize: 11, marginTop: 10, textAlign: 'center' }, secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 18 }, secondaryText: { color: colors.text, fontWeight: '800' },
  empty: { margin: 18, padding: 22, borderRadius: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }, emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '900' }, emptyText: { color: colors.muted, lineHeight: 21, marginTop: 8 },
})
