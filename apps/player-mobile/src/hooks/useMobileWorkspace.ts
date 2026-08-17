import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type {
  MobileAccountSession,
  MobileAccountCharacterRecord,
  MobileCampaignSummary,
  MobileLevelUpDecision,
  MobilePlayerWorkspace,
  MobileRoomRules,
} from '../../../../packages/mobile-protocol/src'
import { applyDnd5eLevelAdvancement } from '../../../../src/rulesets/dnd5e/levelAdvancement'
import type { Dnd5eLevelAdvancementDecisionV1, Character } from '../../../../src/types/character'
import {
  answerCombatInterrupt,
  appendPlayerAction,
  fetchMobileAccount,
  fetchMobileAccountCharacters,
  fetchMobileCampaigns,
  fetchMobileRoomRules,
  fetchRoomResource,
  fetchRoomResourceSnapshot,
  fetchVoiceStatus,
  heartbeatMobileRoom,
  joinMobileRoom,
  leaveMobileRoom,
  loginMobileAccount,
  logoutMobileAccount,
  mutateRoomJournal,
  publishRoomEvent,
  registerMobilePushSubscription,
  saveRoomResourceSnapshot,
  saveMobileAccountCharacter,
  sendRoomChat,
  submitExplorationMove,
  submitPlayerCharacterCommand,
  unregisterMobilePushSubscription,
  updateMobileAccountProfile,
  changeMobileAccountPassword,
  deleteMobileAccount,
  type MobileCredentials,
} from '../services/mobileApi'
import { mobilePushPermissionState, requestMobilePushToken, type MobilePushPermissionState } from '../services/pushNotifications'
import { createMobileDnd5eCharacter, type MobileCharacterCreationInput } from '../character/createMobileCharacter'
import {
  clearMobileAccount,
  clearMobileRoom,
  loadMobileAuthState,
  mobileClientId,
  saveActiveCharacterId,
  saveMobileAccount,
  saveMobileServerUrl,
  saveMobileRoom,
} from '../services/sessionStore'
import { buildMobileWorkspace } from '../services/workspaceAdapter'
import {
  subscribeMobileRoomEventStream,
  type MobileRoomEventStreamStatusV1,
} from '../services/roomEventStream'
import { buildMobileActionRegistry, prepareMobileRoomPlugins } from '../services/actionRegistry'
import { clearMobileRoomPluginRuntime } from '../services/mobileRoomPluginRuntime'
import { mobileCharacterCompatibilityForRoom } from '../services/mobileCharacterVault'
import { defaultGameServerUrl, normalizeGameServerUrl } from '../config'

export type MobileConnectionState = 'restoring' | 'offline' | 'connecting' | 'online' | 'error'

const RESOURCE_NAMES = [
  'maps', 'characters', 'map-geometry', 'map-exploration', 'spellbook', 'combat',
  'combat-log', 'room-chat', 'room-journal', 'combat-interrupts', 'player-action-ack',
  'dice', 'dice-events', 'scene-orchestration', 'campaign-time',
] as const
type MobileWorkspaceResourceName = typeof RESOURCE_NAMES[number]
const RESOURCE_NAME_SET = new Set<string>(RESOURCE_NAMES)
const EVENT_REFRESH_DEBOUNCE_MS = 45
const EVENT_STREAM_RECOVERY_MS = 30_000

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

type RawCharacterState = { characters?: Array<Record<string, unknown>>; selectedId?: string | null; updatedAt?: number }

function copyRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function locallyUnreadyRules(rules: MobileRoomRules): MobileRoomRules {
  return {
    ...rules,
    member: {
      ...rules.member,
      ready: false,
      missing: rules.requiredPlugins.map((plugin) => ({ ...plugin })),
    },
  }
}

export function useMobileWorkspace() {
  const [serverUrl, setServerUrlState] = useState(defaultGameServerUrl)
  const [account, setAccount] = useState<MobileAccountSession | null>(null)
  const [campaigns, setCampaigns] = useState<MobileCampaignSummary[]>([])
  const [accountCharacters, setAccountCharacters] = useState<MobileAccountCharacterRecord[]>([])
  const [pushPermission, setPushPermission] = useState<MobilePushPermissionState>('unknown')
  const [credentials, setCredentials] = useState<MobileCredentials | null>(null)
  const [rules, setRules] = useState<MobileRoomRules | null>(null)
  const [workspace, setWorkspace] = useState<MobilePlayerWorkspace | null>(null)
  const [activeCharacterId, setActiveCharacterIdState] = useState<string | null>(null)
  const [connection, setConnection] = useState<MobileConnectionState>('restoring')
  const [roomEventStream, setRoomEventStream] = useState<MobileRoomEventStreamStatusV1>({
    schemaVersion: 1,
    state: 'closed',
    attempt: 0,
    sequence: 0,
  })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const seq = useRef(0)
  const mounted = useRef(true)
  const workspaceRef = useRef(workspace)
  const rulesRef = useRef(rules)
  const resourceValuesRef = useRef<Record<string, unknown>>({})
  const resourceRevisionsRef = useRef<Record<string, number>>({})
  const serverUrlEditedRef = useRef(false)
  const serverUrlSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  workspaceRef.current = workspace
  rulesRef.current = rules

  const setServerUrl = useCallback((value: string) => {
    // Keep the draft untouched while the user is typing. Normalizing every
    // keystroke removes a trailing slash, which makes `https://` impossible to
    // enter on iOS. Persist the draft so a development-client refresh does not
    // restore the previous endpoint over the active form.
    serverUrlEditedRef.current = true
    setServerUrlState(value)
    if (serverUrlSaveTimerRef.current != null) clearTimeout(serverUrlSaveTimerRef.current)
    serverUrlSaveTimerRef.current = setTimeout(() => {
      serverUrlSaveTimerRef.current = null
      void saveMobileServerUrl(value)
    }, 250)
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4_000)
    return () => clearTimeout(timer)
  }, [notice])

  const refreshCampaigns = useCallback(async (server: string, session: MobileAccountSession) => {
    const next = await fetchMobileCampaigns(server, session)
    if (mounted.current) setCampaigns(next)
  }, [])

  const refreshAccountCharacters = useCallback(async (server: string, session: MobileAccountSession) => {
    const next = await fetchMobileAccountCharacters(server, session)
    if (mounted.current) setAccountCharacters(next)
    return next
  }, [])

  const refreshWorkspace = useCallback(async (
    session = credentials,
    preferredCharacterId = activeCharacterId,
    requestedNames?: readonly MobileWorkspaceResourceName[],
    deletedNames: ReadonlySet<string> = new Set(),
  ) => {
    if (!session) return
    try {
      const fullRefresh = !requestedNames || Object.keys(resourceValuesRef.current).length === 0
      const names = fullRefresh ? RESOURCE_NAMES : [...new Set(requestedNames)]
      for (const name of deletedNames) {
        delete resourceValuesRef.current[name]
        delete resourceRevisionsRef.current[name]
      }
      const snapshots = await Promise.all(names.map(async (name) => ({
        name,
        snapshot: await fetchRoomResourceSnapshot<unknown>(session, name).catch(() => null),
      })))
      for (const entry of snapshots) {
        if (!entry.snapshot || deletedNames.has(entry.name)) continue
        const previousRevision = resourceRevisionsRef.current[entry.name] ?? -1
        if (deletedNames.has(entry.name) || entry.snapshot.revision >= previousRevision) {
          resourceValuesRef.current[entry.name] = entry.snapshot.value
          resourceRevisionsRef.current[entry.name] = entry.snapshot.revision
        }
      }
      const resources = { ...resourceValuesRef.current }
      const voice = fullRefresh
        ? await fetchVoiceStatus(session).catch(() => null)
        : workspaceRef.current?.voice ?? null
      let next = buildMobileWorkspace({
        credentials: session,
        rules: rulesRef.current,
        activeCharacterId: preferredCharacterId,
        resources,
        voice,
      })
      const selected = next.characters.find((candidate) => candidate.id === preferredCharacterId) ?? next.characters[0] ?? null
      if (selected && selected.id !== preferredCharacterId) {
        setActiveCharacterIdState(selected.id)
        await saveActiveCharacterId(selected.id)
        const activePlugins = rulesRef.current?.member.ready === true ? rulesRef.current.requiredPlugins : []
        const nextRules = await heartbeatMobileRoom(session, selected, activePlugins)
        rulesRef.current = nextRules
        setRules(nextRules)
        next = buildMobileWorkspace({ credentials: session, rules: nextRules, activeCharacterId: selected.id, resources, voice })
      }
      next = {
        ...next,
        actionRegistry: await buildMobileActionRegistry({
          workspace: next,
          credentials: session,
          rules: next.rules,
        }),
      }
      if (!mounted.current) return
      setWorkspace(next)
      setConnection('online')
      setError('')
    } catch (cause) {
      if (!mounted.current) return
      setConnection('offline')
      setError(cause instanceof Error ? cause.message : '房间同步失败')
    }
  }, [activeCharacterId, credentials])

  useEffect(() => {
    mounted.current = true
    void (async () => {
      const stored = await loadMobileAuthState()
      const server = normalizeGameServerUrl(stored.serverUrl || defaultGameServerUrl)
      if (!serverUrlEditedRef.current) setServerUrlState(server)
      setActiveCharacterIdState(stored.activeCharacterId)
      if (!stored.account) return setConnection('offline')
      try {
        const validAccount = await fetchMobileAccount(server, stored.account)
        setAccount(validAccount)
        await saveMobileAccount(server, validAccount)
        await refreshCampaigns(server, validAccount)
        await refreshAccountCharacters(server, validAccount)
        if (stored.room) {
          const restored = { serverUrl: server, account: validAccount, room: stored.room }
          setCredentials(restored)
          setConnection('connecting')
        } else setConnection('offline')
      } catch {
        await clearMobileAccount()
        setConnection('offline')
      }
    })()
    return () => {
      mounted.current = false
      if (serverUrlSaveTimerRef.current != null) clearTimeout(serverUrlSaveTimerRef.current)
    }
  }, [refreshAccountCharacters, refreshCampaigns])

  useEffect(() => {
    if (!credentials) return
    // Never let a restored/new room inherit cached projections or revisions
    // from a previous room identity.
    resourceValuesRef.current = {}
    resourceRevisionsRef.current = {}
    void refreshWorkspace(credentials, activeCharacterId)
    const pendingNames = new Set<MobileWorkspaceResourceName>()
    const deletedNames = new Set<string>()
    let pendingFullRecovery = false
    let refreshingRules = false
    let rulesRefreshQueued = false
    let flushTimer: ReturnType<typeof setTimeout> | null = null
    const flush = () => {
      flushTimer = null
      const names = [...pendingNames]
      const deleted = new Set(deletedNames)
      pendingNames.clear()
      deletedNames.clear()
      const full = pendingFullRecovery
      pendingFullRecovery = false
      void refreshWorkspace(credentials, activeCharacterId, full ? undefined : names, deleted)
    }
    const schedule = () => {
      if (flushTimer != null) return
      flushTimer = setTimeout(flush, EVENT_REFRESH_DEBOUNCE_MS)
    }
    const refreshRules = async () => {
      if (refreshingRules) {
        rulesRefreshQueued = true
        return
      }
      refreshingRules = true
      try {
        const observedRules = await fetchMobileRoomRules(credentials)
        let nextRules = observedRules
        try {
          await prepareMobileRoomPlugins(credentials, observedRules)
          const active = workspaceRef.current?.characters.find((candidate) => candidate.id === activeCharacterId) ?? null
          nextRules = await heartbeatMobileRoom(credentials, active, observedRules.requiredPlugins)
        } catch (cause) {
          nextRules = locallyUnreadyRules(observedRules)
          if (mounted.current) setNotice(`规则包尚未就绪：${cause instanceof Error ? cause.message : '下载或校验失败'}`)
        }
        rulesRef.current = nextRules
        if (mounted.current) setRules(nextRules)
        pendingFullRecovery = true
        schedule()
      } catch (cause) {
        if (mounted.current) setNotice(`房间规则同步失败：${cause instanceof Error ? cause.message : '未知错误'}`)
      } finally {
        refreshingRules = false
        if (rulesRefreshQueued) {
          rulesRefreshQueued = false
          void refreshRules()
        }
      }
    }
    const stopEventStream = subscribeMobileRoomEventStream(credentials, {
      onStateChanged: (event) => {
        if (event.name === '*') pendingFullRecovery = true
        else if (event.name === 'room-rules') {
          void refreshRules()
          return
        }
        else if (RESOURCE_NAME_SET.has(event.name)) {
          pendingNames.add(event.name as MobileWorkspaceResourceName)
          if (event.deleted) deletedNames.add(event.name)
        } else return
        schedule()
      },
      onRecoveryRequired: () => {
        pendingFullRecovery = true
        schedule()
      },
      onStatus: (status) => {
        if (mounted.current) setRoomEventStream(status)
      },
    })
    // A restored session may not have a current rules snapshot in memory. Fetch
    // it immediately, verify all required JSON packages, and only then report
    // the package set as active to the Host.
    void refreshRules()
    // SSE is authoritative for freshness; this slower poll only repairs a
    // suspended mobile network stack or a process that missed the replay window.
    const poll = setInterval(() => void refreshWorkspace(credentials, activeCharacterId), EVENT_STREAM_RECOVERY_MS)
    const heartbeat = setInterval(() => {
      const currentRules = rulesRef.current
      if (!currentRules || currentRules.member.ready !== true) {
        void refreshRules()
        return
      }
      const active = workspaceRef.current?.characters.find((candidate) => candidate.id === activeCharacterId) ?? null
      void heartbeatMobileRoom(credentials, active, currentRules.requiredPlugins)
        .then((next) => {
          rulesRef.current = next
          if (mounted.current) setRules(next)
        })
        .catch(() => undefined)
    }, 12_000)
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshWorkspace(credentials, activeCharacterId)
    })
    return () => {
      if (flushTimer != null) clearTimeout(flushTimer)
      stopEventStream()
      clearInterval(poll)
      clearInterval(heartbeat)
      appState.remove()
    }
  }, [activeCharacterId, credentials, refreshWorkspace])

  const login = useCallback(async (identifier: string, password: string) => {
    setBusy(true); setError(''); setConnection('connecting')
    try {
      const server = normalizeGameServerUrl(serverUrl)
      if (!/^https?:\/\/[^/]+/i.test(server)) throw new Error('请输入完整服务器地址，例如 https://astraltracevtt.com')
      setServerUrlState(server)
      await saveMobileServerUrl(server)
      const clientId = await mobileClientId()
      const next = await loginMobileAccount(server, identifier, password, clientId)
      await saveMobileAccount(server, next)
      setAccount(next)
      await refreshCampaigns(server, next)
      await refreshAccountCharacters(server, next)
      setConnection('offline')
    } catch (cause) {
      setConnection('error'); setError(cause instanceof Error ? cause.message : '登录失败')
    } finally { setBusy(false) }
  }, [refreshAccountCharacters, refreshCampaigns, serverUrl])

  const acceptRegisteredAccount = useCallback(async (next: MobileAccountSession) => {
    const server = normalizeGameServerUrl(serverUrl)
    setServerUrlState(server)
    await saveMobileAccount(server, next)
    setAccount(next)
    await refreshCampaigns(server, next)
    await refreshAccountCharacters(server, next)
    setConnection('offline')
  }, [refreshAccountCharacters, refreshCampaigns, serverUrl])

  const joinRoom = useCallback(async (roomId: string, password = '', role: 'player' | 'spectator' = 'player') => {
    if (!account) return
    setBusy(true); setError(''); setConnection('connecting')
    try {
      const clientId = await mobileClientId()
      const joined = await joinMobileRoom({
        serverUrl, account, roomId, password, role, clientId,
        displayName: account.displayName || account.username || '玩家',
        resumeMemberId: credentials?.room.roomId === roomId.toUpperCase() ? credentials.room.memberId : undefined,
      })
      const nextCredentials = { serverUrl, account, room: joined.room }
      let nextRules = joined.rules
      try {
        await prepareMobileRoomPlugins(nextCredentials, joined.rules)
        nextRules = await heartbeatMobileRoom(nextCredentials, null, joined.rules.requiredPlugins)
      } catch (cause) {
        nextRules = locallyUnreadyRules(joined.rules)
        setNotice(`规则包尚未就绪：${cause instanceof Error ? cause.message : '下载或校验失败'}`)
      }
      await saveMobileRoom(joined.room)
      rulesRef.current = nextRules
      setRules(nextRules)
      setCredentials(nextCredentials)
      await refreshWorkspace(nextCredentials, activeCharacterId)
    } catch (cause) {
      setConnection('error'); setError(cause instanceof Error ? cause.message : '加入房间失败')
    } finally { setBusy(false) }
  }, [account, activeCharacterId, credentials, refreshWorkspace, serverUrl])

  const leaveRoom = useCallback(async () => {
    if (credentials) await leaveMobileRoom(credentials).catch(() => undefined)
    clearMobileRoomPluginRuntime()
    await clearMobileRoom()
    setCredentials(null); setRules(null); setWorkspace(null); setActiveCharacterIdState(null); setConnection('offline')
    if (account) await refreshCampaigns(serverUrl, account).catch(() => undefined)
  }, [account, credentials, refreshCampaigns, serverUrl])

  const logout = useCallback(async () => {
    if (account) await logoutMobileAccount(serverUrl, account).catch(() => undefined)
    clearMobileRoomPluginRuntime()
    await clearMobileAccount()
    setAccount(null); setCredentials(null); setRules(null); setWorkspace(null); setCampaigns([]); setAccountCharacters([]); setConnection('offline')
  }, [account, serverUrl])

  const updateProfile = useCallback(async (input: { displayName: string; avatar?: string }) => {
    if (!account) throw new Error('account-session-required')
    const updated = await updateMobileAccountProfile(serverUrl, account, input)
    const next = { ...account, ...updated, sessionToken: account.sessionToken }
    setAccount(next)
    await saveMobileAccount(serverUrl, next)
    setNotice('个人资料已保存')
  }, [account, serverUrl])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!account) throw new Error('account-session-required')
    await changeMobileAccountPassword(serverUrl, account, { currentPassword, newPassword })
    setNotice('密码已更新；其他设备的旧会话可能需要重新登录')
  }, [account, serverUrl])

  const enablePushNotifications = useCallback(async () => {
    if (!account) throw new Error('account-session-required')
    const registration = await requestMobilePushToken()
    const deviceId = await mobileClientId()
    await registerMobilePushSubscription(serverUrl, account, { deviceId, ...registration })
    setPushPermission('enabled')
    setNotice('房间事件通知已开启')
  }, [account, serverUrl])

  const disablePushNotifications = useCallback(async () => {
    if (!account) throw new Error('account-session-required')
    const deviceId = await mobileClientId()
    await unregisterMobilePushSubscription(serverUrl, account, deviceId)
    setPushPermission(await mobilePushPermissionState())
    setNotice('服务器已停止向此设备发送房间通知')
  }, [account, serverUrl])

  useEffect(() => {
    if (!account) return
    void mobilePushPermissionState().then(setPushPermission).catch(() => setPushPermission('unsupported'))
  }, [account])

  const deleteAccount = useCallback(async (currentPassword: string) => {
    if (!account) throw new Error('account-session-required')
    await deleteMobileAccount(serverUrl, account, currentPassword)
    clearMobileRoomPluginRuntime()
    await Promise.all([clearMobileAccount(), clearMobileRoom()])
    setAccount(null)
    setCredentials(null)
    setRules(null)
    setWorkspace(null)
    setCampaigns([])
    setAccountCharacters([])
    setConnection('offline')
  }, [account, serverUrl])

  const selectCharacter = useCallback(async (id: string) => {
    setActiveCharacterIdState(id); await saveActiveCharacterId(id)
    if (!credentials) return
    const character = workspaceRef.current?.characters.find((candidate) => candidate.id === id) ?? null
    const activePlugins = rulesRef.current?.member.ready === true ? rulesRef.current.requiredPlugins : []
    const nextRules = await heartbeatMobileRoom(credentials, character, activePlugins)
    rulesRef.current = nextRules
    setRules(nextRules)
    await refreshWorkspace(credentials, id)
  }, [credentials, refreshWorkspace])

  const submitAction = useCallback(async (patch: Record<string, unknown>, label: string, omitCombatId = false) => {
    const current = workspaceRef.current
    if (!credentials || !current?.scene || !current.activeCharacterId) throw new Error('player-workspace-not-ready')
    if (credentials.room.role === 'spectator') throw new Error('spectator-read-only')
    const actor = current.scene.controlledTokens.find((token) => token.characterId === current.activeCharacterId) ?? current.scene.controlledTokens[0]
    if (!actor) throw new Error('active-character-token-not-found')
    seq.current += 1
    const action = {
      id: uid('mobile-action'), mapId: current.scene.sceneId,
      ...(!omitCombatId && current.combat?.combatId ? { combatId: current.combat.combatId } : {}),
      sourceMode: 'player', status: 'pending', actorTokenId: actor.id, characterId: current.activeCharacterId,
      round: omitCombatId ? 1 : current.combat?.round ?? 1,
      initiativeIndex: omitCombatId ? 0 : current.combat?.initiativeIndex ?? 0,
      seq: seq.current, updatedAt: Date.now(), ...patch,
    }
    await appendPlayerAction(credentials, action)
    setNotice(`${label}已提交，等待 Host 结算`)
    await refreshWorkspace(credentials, current.activeCharacterId)
    return action.id
  }, [credentials, refreshWorkspace])

  const moveControlledToken = useCallback(async (tokenId: string, x: number, y: number) => {
    const current = workspaceRef.current
    const token = current?.scene?.controlledTokens.find((candidate) => candidate.id === tokenId)
    if (!credentials || !current?.scene || !token || !current.activeCharacterId) throw new Error('movement-not-ready')
    if (current.combat?.active) {
      await submitAction({ type: 'move-token', targetPosition: { x, y } }, '移动')
      return
    }
    const grid = current.scene.mapManifest.grid
    const toCell = (point: { x: number; y: number }) => ({
      col: Math.round((point.x - (grid?.offsetX ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - 0.5),
      row: Math.round((point.y - (grid?.offsetY ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - 0.5),
    })
    await submitExplorationMove(credentials, {
      mapId: current.scene.sceneId, tokenId, characterId: current.activeCharacterId,
      expectedPosition: { x: token.x, y: token.y }, targetPosition: { x, y },
      path: [toCell(token), toCell({ x, y })], updatedAt: Date.now(),
    })
    setNotice('非战斗移动已由 Host 接收')
    await refreshWorkspace(credentials, current.activeCharacterId)
  }, [credentials, refreshWorkspace, submitAction])

  const sendChat = useCallback(async (channel: 'ic' | 'ooc' | 'dm-private', text: string) => {
    if (!credentials || !text.trim()) return
    await sendRoomChat(credentials, { channel, text: text.trim() })
    await refreshWorkspace(credentials, activeCharacterId)
  }, [activeCharacterId, credentials, refreshWorkspace])

  const mutateSharedNote = useCallback(async (mutation: Record<string, unknown>) => {
    if (!credentials) throw new Error('room-session-required')
    if (credentials.room.role !== 'player') throw new Error('player-role-required')
    await mutateRoomJournal(credentials, mutation)
    setNotice('共享笔记已同步')
    await refreshWorkspace(credentials, activeCharacterId)
  }, [activeCharacterId, credentials, refreshWorkspace])

  const answerInterrupt = useCallback(async (interruptId: string, response: Record<string, unknown>) => {
    const interrupt = workspaceRef.current?.interrupts.find((candidate) => candidate.id === interruptId)
    if (!credentials || !interrupt) return
    let mutation: Record<string, unknown> = { operation: 'answer', mapId: interrupt.mapId, id: interrupt.id, response }
    if (interrupt.kind === 'roll-confirmation' && response.operation === 'contribute') {
      const character = workspaceRef.current?.characters.find((candidate) => candidate.id === workspaceRef.current?.activeCharacterId)
      if (!character) throw new Error('active-character-required')
      const draft = typeof response.contribution === 'object' && response.contribution ? response.contribution as Record<string, unknown> : {}
      const eligible = Array.isArray(interrupt.payload.eligibleModifiers)
        ? interrupt.payload.eligibleModifiers.find((entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).characterId === character.id && (draft.decline === true || (entry as Record<string, unknown>).featureId === draft.featureId)) as Record<string, unknown> | undefined
        : undefined
      if (!eligible) throw new Error('roll-modifier-not-eligible')
      const kind = draft.decline === true ? 'decline-d20' : String(eligible.modifierKind || 'replace-d20')
      const contribution = {
        id: kind === 'choice-reroll' ? `${interrupt.id}:${character.id}:choice-reroll` : kind === 'decline-d20' ? `${interrupt.id}:${character.id}:decline` : `${interrupt.id}:${character.id}`,
        kind, characterId: character.id, characterName: character.name,
        featureLabel: kind === 'decline-d20' ? '不使用投骰修改' : String(eligible.featureLabel || draft.featureLabel || ''),
        ...(kind !== 'decline-d20' ? { featureId: String(eligible.featureId || draft.featureId || '') } : {}),
        ...(kind === 'replace-d20' ? { dieIndex: 0, replacementValue: Number(draft.replacementValue) } : {}),
        ...(kind === 'adjust-d20' ? { direction: eligible.direction === 'subtract' ? 'subtract' : 'add' } : {}),
        ...(kind === 'choice-reroll' ? { decision: draft.choiceDecision === 'decline' ? 'decline' : 'use', ...(Number.isInteger(draft.selectedIndex) ? { selectedIndex: draft.selectedIndex } : {}) } : {}),
        createdAt: Date.now(),
      }
      mutation = { operation: 'contribute', mapId: interrupt.mapId, id: interrupt.id, contribution }
    }
    await answerCombatInterrupt(credentials, mutation)
    setNotice('反应选择已提交')
    await refreshWorkspace(credentials, activeCharacterId)
  }, [activeCharacterId, credentials, refreshWorkspace])

  const interactWithPoint = useCallback(async (interactionPointId: string) => {
    await submitAction({
      type: 'dnd5e-map-interaction',
      dnd5eMapInteraction: { operation: 'interact-point', interactionPointId },
    }, '地图互动', !workspaceRef.current?.combat?.active)
  }, [submitAction])

  const submitOwnedCharacterCommand = useCallback(async (
    command: Record<string, unknown>,
    label: string,
  ) => {
    if (!credentials) throw new Error('room-session-required')
    if (credentials.room.role !== 'player') throw new Error('player-role-required')
    const commandId = uid('mobile-character-command')
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await fetchRoomResourceSnapshot<RawCharacterState>(credentials, 'characters')
      try {
        const response = await submitPlayerCharacterCommand(credentials, snapshot.revision, {
          ...command,
          commandId,
        })
        setNotice(`${label}已保存`)
        const resultCharacter = copyRecord(response.result.character)
        await refreshWorkspace(credentials, String(command.characterId ?? resultCharacter.id ?? ''))
        return response.result
      } catch (cause) {
        lastError = cause
        if (!(cause instanceof Error) || !['shared-state-conflict', 'state-revision-conflict'].includes(cause.message)) throw cause
      }
    }
    throw lastError instanceof Error ? lastError : new Error('shared-state-conflict')
  }, [credentials, refreshWorkspace])

  const updateCharacterProfile = useCallback(async (characterId: string, patch: {
    name?: string
    avatar?: string
    portrait?: string
    tokenPortrait?: string
    alignment?: string
    backstory?: string
    notes?: string
  }) => {
    await submitOwnedCharacterCommand({ type: 'profile', characterId, patch }, '角色资料')
  }, [submitOwnedCharacterCommand])

  const createCharacter = useCallback(async (input: MobileCharacterCreationInput) => {
    if (!credentials || !rulesRef.current) throw new Error('room-session-required')
    if (credentials.room.role !== 'player') throw new Error('player-role-required')
    const character = createMobileDnd5eCharacter(input, {
      roomId: credentials.room.roomId,
      roomMemberId: credentials.room.memberId,
      ownerAccountId: credentials.account.accountId,
      player: credentials.room.displayName,
    })
    const result = await submitOwnedCharacterCommand({
      type: 'create',
      character,
      ...(input.hostAbilityRollCommandId ? { abilityRollCommandId: input.hostAbilityRollCommandId } : {}),
    }, '角色创建')
    const authoritative = copyRecord(result.character ?? character as unknown as Record<string, unknown>)
    const authoritativeId = String(authoritative.id ?? character.id)
    const authoritativeName = String(authoritative.name ?? character.name)
    const updatedAt = Date.now()
    const vaultSaved = await saveMobileAccountCharacter(credentials.serverUrl, credentials.account, {
      id: authoritativeId,
      name: authoritativeName,
      updatedAt,
      character: Object.fromEntries(Object.entries(authoritative).filter(([key]) => key !== 'roomId' && key !== 'roomMemberId')),
      compatibility: {
        rulesetId: 'dnd5e-2014-srd-5.1',
        characterSchemaVersion: 1,
        minimumGameProtocolVersion: 5,
        lastSavedGameProtocolVersion: 5,
        requiredPlugins: rulesRef.current.requiredPlugins.map((plugin) => ({ ...plugin })),
      },
    }).then(() => true).catch(() => false)
    setActiveCharacterIdState(authoritativeId)
    await saveActiveCharacterId(authoritativeId)
    const activePlugins = rulesRef.current.member.ready === true ? rulesRef.current.requiredPlugins : []
    const nextRules = await heartbeatMobileRoom(credentials, {
      ...authoritative,
      id: authoritativeId,
      name: authoritativeName,
    }, activePlugins)
    rulesRef.current = nextRules
    setRules(nextRules)
    setNotice(vaultSaved
      ? `${authoritativeName}已由 Host 创建并保存到账号角色库`
      : `${authoritativeName}已由 Host 创建；账号角色库将在下次同步时重试`)
    await refreshWorkspace(credentials, authoritativeId)
    await refreshAccountCharacters(credentials.serverUrl, credentials.account).catch(() => undefined)
    return authoritativeId
  }, [credentials, refreshAccountCharacters, refreshWorkspace, submitOwnedCharacterCommand])

  const rollCharacterAbilities = useCallback(async () => {
    const result = await submitOwnedCharacterCommand({ type: 'roll-abilities' }, '属性骰')
    const commandId = String(result.commandId ?? '')
    const rolls = Array.isArray(result.rolls) ? result.rolls.map((raw) => {
      const roll = copyRecord(raw)
      return {
        dice: Array.isArray(roll.dice) ? roll.dice.map(Number) : [],
        discardedIndices: Array.isArray(roll.discardedIndices) ? roll.discardedIndices.map(Number) : [Number(roll.discardedIndex)],
        total: Number(roll.total),
      }
    }) : []
    if (!commandId || rolls.length !== 6) throw new Error('invalid-host-ability-roll')
    return { commandId, rolls }
  }, [submitOwnedCharacterCommand])

  const attachAccountCharacter = useCallback(async (record: MobileAccountCharacterRecord) => {
    if (!credentials || !rulesRef.current) throw new Error('room-session-required')
    if (credentials.room.role !== 'player') throw new Error('player-role-required')
    const compatibility = mobileCharacterCompatibilityForRoom(record, rulesRef.current)
    if (!compatibility.compatible) throw new Error(compatibility.errors[0] || 'character-incompatible')
    const source = copyRecord(record.character)
    if (String(source.ownerAccountId ?? credentials.account.accountId) !== credentials.account.accountId) {
      throw new Error('account-character-owner-mismatch')
    }
    const attached = {
      ...source,
      id: record.id,
      name: record.name || String(source.name ?? '新冒险者'),
      ownerAccountId: credentials.account.accountId,
      roomId: credentials.room.roomId,
      roomMemberId: credentials.room.memberId,
      player: credentials.room.displayName,
      visibleToPlayers: true,
    }
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await fetchRoomResourceSnapshot<RawCharacterState>(credentials, 'characters')
      const state = copyRecord(snapshot.value)
      const characters = Array.isArray(state.characters) ? state.characters.map(copyRecord) : []
      const conflicting = characters.find((candidate) => String(candidate.id ?? '') === record.id)
      if (conflicting && String(conflicting.ownerAccountId ?? '') !== credentials.account.accountId) {
        throw new Error('character-id-conflict')
      }
      try {
        await saveRoomResourceSnapshot(credentials, 'characters', {
          ...state,
          characters: [...characters.filter((candidate) => String(candidate.id ?? '') !== record.id), attached],
          selectedId: record.id,
          updatedAt: Date.now(),
        }, snapshot.revision)
        setActiveCharacterIdState(record.id)
        await saveActiveCharacterId(record.id)
        const activePlugins = rulesRef.current.member.ready === true ? rulesRef.current.requiredPlugins : []
        const nextRules = await heartbeatMobileRoom(credentials, attached, activePlugins)
        rulesRef.current = nextRules
        setRules(nextRules)
        setNotice(`${record.name}已从账号角色库带入房间`)
        await refreshWorkspace(credentials, record.id)
        return record.id
      } catch (cause) {
        lastError = cause
        if (!(cause instanceof Error) || cause.message !== 'shared-state-conflict') throw cause
      }
    }
    throw lastError instanceof Error ? lastError : new Error('shared-state-conflict')
  }, [credentials, refreshWorkspace])

  const setSpellSlot = useCallback(async (characterId: string, resourceKey: string, current: number) => {
    if (!/^dnd5e-spell-slot-[1-9]$/.test(resourceKey) && resourceKey !== 'dnd5e-pact-slot') {
      throw new Error('invalid-spell-slot-resource')
    }
    await submitOwnedCharacterCommand({ type: 'spell-slot', characterId, resourceKey, current }, '法术位')
  }, [submitOwnedCharacterCommand])

  const setSpellPrepared = useCallback(async (spellId: string, prepared: boolean) => {
    const spell = workspaceRef.current?.spells.find((candidate) => candidate.id === spellId)
    const characterId = workspaceRef.current?.activeCharacterId
    if (!spell?.preparationSelection || !characterId) throw new Error('spell-preparation-not-editable')
    await submitOwnedCharacterCommand({
      type: 'spell-preparation',
      characterId,
      owner: spell.preparationSelection.owner,
      classId: spell.preparationSelection.classId,
      selectionKey: spell.preparationSelection.key,
      spellId,
      prepared,
    }, prepared ? '法术准备' : '取消准备')
  }, [submitOwnedCharacterCommand])

  const levelUpCharacter = useCallback(async (characterId: string, decision: MobileLevelUpDecision) => {
    if (!credentials || !rulesRef.current) throw new Error('room-session-required')
    if (credentials.room.role !== 'player') throw new Error('player-role-required')
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const snapshot = await fetchRoomResourceSnapshot<RawCharacterState>(credentials, 'characters')
      const state = copyRecord(snapshot.value)
      const characters = Array.isArray(state.characters) ? state.characters.map(copyRecord) : []
      const index = characters.findIndex((candidate) => String(candidate.id ?? '') === characterId)
      if (index < 0) throw new Error('character-not-found')
      const current = characters[index]
      if (
        String(current.roomMemberId ?? '') !== credentials.room.memberId &&
        String(current.ownerAccountId ?? '') !== credentials.account.accountId
      ) throw new Error('character-owner-mismatch')
      const result = applyDnd5eLevelAdvancement(
        current as unknown as Character,
        decision as unknown as Dnd5eLevelAdvancementDecisionV1,
        { completedBy: 'player' },
      )
      if (!result.ok) throw new Error(`level-up:${result.reason}`)
      if ((result.character.dnd5eCreationTargetLevel ?? 0) <= result.character.level) {
        result.character.dnd5eCreationTargetLevel = undefined
      }
      try {
        const response = await submitPlayerCharacterCommand(credentials, snapshot.revision, {
          commandId: uid('mobile-level-up'),
          type: 'level-up',
          characterId,
          character: result.character as unknown as Record<string, unknown>,
          ...(decision.hostHitPointRollCommandId ? { hitPointRollCommandId: decision.hostHitPointRollCommandId } : {}),
        })
        const authoritative = copyRecord(response.result.character ?? result.character as unknown as Record<string, unknown>)
        const updatedAt = Date.now()
        await saveMobileAccountCharacter(credentials.serverUrl, credentials.account, {
          id: String(authoritative.id ?? result.character.id),
          name: String(authoritative.name ?? result.character.name),
          updatedAt,
          character: Object.fromEntries(Object.entries(authoritative).filter(([key]) => key !== 'roomId' && key !== 'roomMemberId')),
          compatibility: {
            rulesetId: 'dnd5e-2014-srd-5.1',
            characterSchemaVersion: 1,
            minimumGameProtocolVersion: 5,
            lastSavedGameProtocolVersion: 5,
            requiredPlugins: rulesRef.current.requiredPlugins.map((plugin) => ({ ...plugin })),
          },
        })
        setNotice(`${String(authoritative.name ?? result.character.name)}已由 Host 提升至 ${Number(authoritative.level ?? result.character.level)} 级`)
        await refreshWorkspace(credentials, characterId)
        return
      } catch (cause) {
        lastError = cause
        if (!(cause instanceof Error) || !['shared-state-conflict', 'state-revision-conflict'].includes(cause.message)) throw cause
      }
    }
    throw lastError instanceof Error ? lastError : new Error('shared-state-conflict')
  }, [credentials, refreshWorkspace])

  const rollLevelHitPoints = useCallback(async (characterId: string, classId: string) => {
    const result = await submitOwnedCharacterCommand({ type: 'roll-level-hit-points', characterId, classId }, '升级生命骰')
    const commandId = String(result.commandId ?? '')
    const roll = Number(result.roll)
    const hitDie = Number(result.hitDie)
    if (!commandId || !Number.isSafeInteger(roll) || roll < 1 || roll > hitDie) throw new Error('invalid-host-hit-point-roll')
    return { commandId, roll, hitDie }
  }, [submitOwnedCharacterCommand])

  const submitInventoryMutation = useCallback(async (mutation: Record<string, unknown>) => {
    if (!credentials) throw new Error('room-session-required')
    const requestId = uid('mobile-inventory')
    await publishRoomEvent(credentials, 'dnd5e-inventory-player-to-dm', {
      id: requestId,
      roomId: credentials.room.roomId,
      memberId: credentials.room.memberId,
      sourceMode: 'player',
      mutation,
      updatedAt: Date.now(),
    })
    setNotice('库存操作已提交给 DM 权威端')
    setTimeout(() => void refreshWorkspace(credentials, workspaceRef.current?.activeCharacterId ?? null), 350)
  }, [credentials, refreshWorkspace])

  const spendHitDie = useCallback(async (characterId: string, poolIndex: number) => {
    await submitOwnedCharacterCommand({ type: 'spend-hit-die', characterId, poolIndex }, '生命骰恢复')
  }, [submitOwnedCharacterCommand])

  const recoverSpellSlot = useCallback(async (characterId: string, resourceKey: string, restAdvanceId: string) => {
    await submitOwnedCharacterCommand({ type: 'recover-spell-slot', characterId, resourceKey, restAdvanceId }, '休息法术位恢复')
  }, [submitOwnedCharacterCommand])

  return {
    serverUrl, setServerUrl, account, campaigns, accountCharacters, credentials, rules, workspace,
    connection, roomEventStream, error, notice, busy, login, acceptRegisteredAccount, joinRoom, leaveRoom, logout,
    updateProfile, changePassword, deleteAccount, pushPermission, enablePushNotifications, disablePushNotifications,
    refresh: () => refreshWorkspace(), selectCharacter, submitAction, moveControlledToken, sendChat, mutateSharedNote, answerInterrupt,
    interactWithPoint, setSpellSlot, setSpellPrepared, levelUpCharacter, rollLevelHitPoints, updateCharacterProfile, submitInventoryMutation, spendHitDie, recoverSpellSlot,
    createCharacter, rollCharacterAbilities, attachAccountCharacter,
  }
}
