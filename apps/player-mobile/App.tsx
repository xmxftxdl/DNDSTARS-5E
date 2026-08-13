import { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, SafeAreaView, StatusBar as NativeStatusBar, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import type { MobileRenderQuality, PlayerTokenView } from '../../packages/mobile-protocol/src'
import { AuthScreen } from './src/components/AuthScreen'
import { CharacterScreen } from './src/components/CharacterScreen'
import { CombatActionSheet, type ActionTab, type PendingMapTarget } from './src/components/CombatActionSheet'
import { CommunicationsScreen } from './src/components/CommunicationsScreen'
import { InterruptBanner } from './src/components/InterruptBanner'
import { PlayerHome } from './src/components/PlayerHome'
import { RoomLobbyScreen } from './src/components/RoomLobbyScreen'
import { RestRecoveryModal } from './src/components/RestRecoveryModal'
import { SettingsScreen } from './src/components/SettingsScreen'
import { VoiceRoomPanel } from './src/components/VoiceRoomPanel'
import { useMobileWorkspace } from './src/hooks/useMobileWorkspace'
import { MobileSkiaMap } from './src/map/MobileSkiaMap'
import { TileDiskCache } from './src/map/TileDiskCache'
import { colors } from './src/theme'

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
  const [quality, setQualityState] = useState<MobileRenderQuality>('standard')
  const [moving, setMoving] = useState(false)
  const [cacheStats, setCacheStats] = useState({ diskBytes: 0, gpuBytes: 0 })
  const [actionSheet, setActionSheet] = useState<{ visible: boolean; tab: ActionTab }>({ visible: false, tab: 'actions' })
  const [pendingTarget, setPendingTarget] = useState<PendingMapTarget | null>(null)
  const [localNotice, setLocalNotice] = useState('')
  const [dismissedRestId, setDismissedRestId] = useState('')
  const [restDismissalLoaded, setRestDismissalLoaded] = useState(false)
  const lastAckKey = useRef('')

  const roomId = mobile.workspace?.room.roomId ?? ''
  useEffect(() => {
    setDismissedRestId('')
    setRestDismissalLoaded(false)
    if (!roomId) return
    void AsyncStorage.getItem(`stars.mobile.rest.dismissed:${roomId}`).then((value) => {
      setDismissedRestId(value ?? '')
      setRestDismissalLoaded(true)
    })
  }, [roomId])

  useEffect(() => {
    void AsyncStorage.getItem('stars.mobile.quality').then((stored) => {
      if (stored === 'lite' || stored === 'standard' || stored === 'high') setQualityState(stored)
    })
  }, [])
  useEffect(() => {
    const message = localNotice || mobile.notice
    if (!message) return
    const timer = setTimeout(() => setLocalNotice(''), 4_000)
    return () => clearTimeout(timer)
  }, [localNotice, mobile.notice])

  useEffect(() => {
    const ack = mobile.workspace?.actionAck
    if (!ack) return
    const key = `${ack.id}:${ack.updatedAt}`
    if (!lastAckKey.current) {
      lastAckKey.current = key
      return
    }
    if (lastAckKey.current === key) return
    lastAckKey.current = key
    setLocalNotice(ack.status === 'accepted'
      ? '行动已由 Host 接受并完成同步'
      : `行动被拒绝：${actionRejectionLabel(ack.reason)}`)
  }, [mobile.workspace?.actionAck])

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

  return <View style={[styles.app, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{pageTitle(tab)}</Text>
        <Text style={styles.headerMeta}>{workspace.room.roomName} · {workspace.room.roomId} · {workspace.room.displayName}</Text>
      </View>
      <View style={styles.connection}><View style={[styles.connectionDot, { backgroundColor: connectionColor }]} /><Text style={styles.connectionText}>{realtimeOpen ? '实时同步' : connectionLabel(mobile.connection)}</Text></View>
    </View>
    <View style={styles.content}>
      {tab === 'home' && <PlayerHome
        workspace={workspace}
        onOpenMap={() => setTab('map')}
        onOpenActions={openActions}
        onEndTurn={() => void mobile.submitAction({ type: 'end-turn' }, '结束回合')}
        onDeathSave={() => void mobile.submitAction({ type: 'dnd5e-death-save', dnd5eDeathSave: {} }, '死亡豁免', !workspace.combat?.active)}
      />}
      {tab === 'map' && scene && <MobileSkiaMap
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
        onSetSpellSlot={mobile.setSpellSlot}
        onSetSpellPrepared={mobile.setSpellPrepared}
        onInventoryMutation={mobile.submitInventoryMutation}
        onSpendHitDie={mobile.spendHitDie}
        onRecoverSpellSlot={mobile.recoverSpellSlot}
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
      />}
      {!!interrupt && <InterruptBanner interrupt={interrupt} registry={workspace.interruptRegistry} activeCharacterId={workspace.activeCharacterId} onAnswer={(response) => mobile.answerInterrupt(interrupt.id, response)} />}
    </View>
    <RestRecoveryModal
      advance={restDismissalLoaded && latestRest?.id !== dismissedRestId ? latestRest : null}
      onDismiss={dismissLatestRest}
      onOpenCharacter={() => { dismissLatestRest(); setTab('character') }}
    />
    {!!notice && <View pointerEvents="none" style={styles.notice}><Text numberOfLines={2} style={styles.noticeText}>{notice}</Text></View>}
    {tab === 'map' && scene && !spectator && <View style={styles.actionRail}>
      <RailButton icon="✦" label={moving ? '取消' : '移动'} active={moving} onPress={() => { setPendingTarget(null); setMoving((value) => !value) }} />
      <RailButton icon="⚔" label="攻击" onPress={() => openActions('actions')} />
      <RailButton icon="✧" label="法术" onPress={() => openActions('spells')} />
      <RailButton icon="◈" label="物品" onPress={() => openActions('items')} />
      <RailButton icon="…" label="更多" onPress={() => openActions('features')} />
    </View>}
    {!!pendingTarget && <View style={styles.targetControls}>{pendingTarget.finish && <Pressable style={styles.finishTarget} onPress={() => void finishOptionalTargeting()}><Text style={styles.finishTargetText}>{pendingTarget.finishLabel || '完成选点'}</Text></Pressable>}<Pressable style={styles.cancelTarget} onPress={() => setPendingTarget(null)}><Text style={styles.cancelTargetText}>{pendingTarget.label} · 取消选点</Text></Pressable></View>}
    <View style={[styles.tabBar, { paddingBottom: Math.max(7, insets.bottom) }]}>
      {tabs.map((item) => <Pressable key={item.id} style={styles.tab} onPress={() => setTab(item.id)}><Text style={[styles.tabIcon, tab === item.id && styles.tabActive]}>{item.icon}</Text><Text style={[styles.tabLabel, tab === item.id && styles.tabActive]}>{item.label}</Text></Pressable>)}
    </View>
    <CombatActionSheet
      visible={actionSheet.visible}
      initialTab={actionSheet.tab}
      workspace={workspace}
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

function RailButton({ icon, label, active, onPress }: { icon: string; label: string; active?: boolean; onPress: () => void }) {
  return <Pressable style={[styles.railAction, active && styles.railActionActive]} onPress={onPress}><Text style={styles.railIcon}>{icon}</Text><Text style={styles.railLabel}>{label}</Text></Pressable>
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
  return <SafeAreaProvider><SafeAreaView style={styles.safe}><NativeStatusBar backgroundColor={colors.background} barStyle="light-content" /><StatusBar style="light" /><AppBody /></SafeAreaView></SafeAreaProvider>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, app: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 16, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { color: colors.text, fontSize: 17, fontWeight: '900' }, headerMeta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  connection: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 }, connectionDot: { width: 7, height: 7, borderRadius: 4 }, connectionText: { color: colors.muted, fontSize: 9, fontWeight: '800' },
  tabBar: { minHeight: 62, flexDirection: 'row', backgroundColor: '#0c0c16', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7 }, tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }, tabIcon: { color: colors.muted, fontSize: 19 }, tabLabel: { color: colors.muted, fontSize: 9, fontWeight: '700' }, tabActive: { color: '#b69cff' },
  actionRail: { position: 'absolute', right: 10, bottom: 80, gap: 6 }, railAction: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#11111df2', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, railActionActive: { borderColor: colors.teal, backgroundColor: '#123735f2' }, railIcon: { color: colors.primary, fontSize: 17, fontWeight: '900' }, railLabel: { color: colors.text, fontSize: 8, fontWeight: '800', marginTop: 1 },
  targetControls: { position: 'absolute', left: 12, right: 74, bottom: 84, flexDirection: 'row', gap: 7 }, cancelTarget: { flex: 1, alignItems: 'center', backgroundColor: '#30220df5', borderColor: colors.warning, borderWidth: 1, borderRadius: 13, padding: 11 }, cancelTargetText: { color: colors.warning, fontWeight: '900', fontSize: 10 }, finishTarget: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b2b2af5', borderColor: colors.teal, borderWidth: 1, borderRadius: 13, paddingHorizontal: 12 }, finishTargetText: { color: colors.teal, fontWeight: '900', fontSize: 10 },
  notice: { position: 'absolute', left: 12, right: 12, bottom: 72, alignItems: 'center' }, noticeText: { color: colors.text, backgroundColor: '#151322f4', borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, fontSize: 10, fontWeight: '800' },
  loading: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, brandMark: { width: 70, height: 70, borderRadius: 24, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, brandGlyph: { color: '#c4b5fd', fontSize: 34 }, brand: { color: colors.text, fontSize: 34, fontWeight: '900', marginTop: 15 }, loadingLabel: { color: colors.muted, marginTop: 8 }, error: { color: colors.danger, fontSize: 11, marginTop: 10, textAlign: 'center' }, secondaryButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, marginTop: 18 }, secondaryText: { color: colors.text, fontWeight: '800' },
  empty: { margin: 18, padding: 22, borderRadius: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }, emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '900' }, emptyText: { color: colors.muted, lineHeight: 21, marginTop: 8 },
})
