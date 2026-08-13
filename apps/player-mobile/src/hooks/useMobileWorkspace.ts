import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import type {
  MobileAccountSession,
  MobileCampaignSummary,
  MobilePlayerWorkspace,
  MobileRoomRules,
} from '../../../../packages/mobile-protocol/src'
import {
  answerCombatInterrupt,
  appendPlayerAction,
  fetchMobileAccount,
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
  saveRoomResourceSnapshot,
  sendRoomChat,
  submitExplorationMove,
  updateMobileAccountProfile,
  changeMobileAccountPassword,
  type MobileCredentials,
} from '../services/mobileApi'
import {
  clearMobileAccount,
  clearMobileRoom,
  loadMobileAuthState,
  mobileClientId,
  saveActiveCharacterId,
  saveMobileAccount,
  saveMobileRoom,
} from '../services/sessionStore'
import { buildMobileWorkspace } from '../services/workspaceAdapter'
import {
  subscribeMobileRoomEventStream,
  type MobileRoomEventStreamStatusV1,
} from '../services/roomEventStream'
import { buildMobileActionRegistry, prepareMobileRoomPlugins } from '../services/actionRegistry'
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

export function useMobileWorkspace() {
  const [serverUrl, setServerUrlState] = useState(defaultGameServerUrl)
  const [account, setAccount] = useState<MobileAccountSession | null>(null)
  const [campaigns, setCampaigns] = useState<MobileCampaignSummary[]>([])
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
  workspaceRef.current = workspace
  rulesRef.current = rules

  const setServerUrl = useCallback((value: string) => setServerUrlState(normalizeGameServerUrl(value)), [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(''), 4_000)
    return () => clearTimeout(timer)
  }, [notice])

  const refreshCampaigns = useCallback(async (server: string, session: MobileAccountSession) => {
    const next = await fetchMobileCampaigns(server, session)
    if (mounted.current) setCampaigns(next)
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
      setServerUrlState(server)
      setActiveCharacterIdState(stored.activeCharacterId)
      if (!stored.account) return setConnection('offline')
      try {
        const validAccount = await fetchMobileAccount(server, stored.account)
        setAccount(validAccount)
        await saveMobileAccount(server, validAccount)
        await refreshCampaigns(server, validAccount)
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
    return () => { mounted.current = false }
  }, [refreshCampaigns])

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
      const clientId = await mobileClientId()
      const next = await loginMobileAccount(serverUrl, identifier, password, clientId)
      await saveMobileAccount(serverUrl, next)
      setAccount(next)
      await refreshCampaigns(serverUrl, next)
      setConnection('offline')
    } catch (cause) {
      setConnection('error'); setError(cause instanceof Error ? cause.message : '登录失败')
    } finally { setBusy(false) }
  }, [refreshCampaigns, serverUrl])

  const acceptRegisteredAccount = useCallback(async (next: MobileAccountSession) => {
    await saveMobileAccount(serverUrl, next)
    setAccount(next)
    await refreshCampaigns(serverUrl, next)
    setConnection('offline')
  }, [refreshCampaigns, serverUrl])

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
    await clearMobileRoom()
    setCredentials(null); setRules(null); setWorkspace(null); setActiveCharacterIdState(null); setConnection('offline')
    if (account) await refreshCampaigns(serverUrl, account).catch(() => undefined)
  }, [account, credentials, refreshCampaigns, serverUrl])

  const logout = useCallback(async () => {
    if (account) await logoutMobileAccount(serverUrl, account).catch(() => undefined)
    await clearMobileAccount()
    setAccount(null); setCredentials(null); setRules(null); setWorkspace(null); setCampaigns([]); setConnection('offline')
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

  const mutateOwnedCharacter = useCallback(async (
    characterId: string,
    mutator: (character: Record<string, unknown>) => Record<string, unknown>,
    label: string,
  ) => {
    if (!credentials) throw new Error('room-session-required')
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
      characters[index] = mutator(current)
      try {
        await saveRoomResourceSnapshot(credentials, 'characters', {
          ...state,
          characters,
          selectedId: state.selectedId ?? characterId,
          updatedAt: Date.now(),
        }, snapshot.revision)
        setNotice(`${label}已保存`)
        await refreshWorkspace(credentials, characterId)
        return
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
    await mutateOwnedCharacter(characterId, (character) => {
      const classResources = copyRecord(character.classResources)
      const resource = copyRecord(classResources[resourceKey])
      const maximum = Math.max(0, Number(resource.max) || 0)
      classResources[resourceKey] = { ...resource, current: Math.max(0, Math.min(maximum, Math.floor(current))), max: maximum }
      return { ...character, classResources }
    }, '法术位')
  }, [mutateOwnedCharacter])

  const setSpellPrepared = useCallback(async (spellId: string, prepared: boolean) => {
    const spell = workspaceRef.current?.spells.find((candidate) => candidate.id === spellId)
    const characterId = workspaceRef.current?.activeCharacterId
    if (!spell?.preparationSelection || !characterId) throw new Error('spell-preparation-not-editable')
    await mutateOwnedCharacter(characterId, (character) => {
      const choices = copyRecord(character.dnd5eClassChoices)
      if (spell.preparationSelection!.owner === 'classes') {
        const classes = copyRecord(choices.classes)
        const definition = copyRecord(classes[spell.preparationSelection!.classId])
        const selections = copyRecord(definition.selections)
        const current = Array.isArray(selections[spell.preparationSelection!.key])
          ? [...new Set((selections[spell.preparationSelection!.key] as unknown[]).map(String))]
          : []
        selections[spell.preparationSelection!.key] = prepared
          ? [...new Set([...current, spellId])]
          : current.filter((id) => id !== spellId)
        classes[spell.preparationSelection!.classId] = { ...definition, selections }
        return { ...character, dnd5eClassChoices: { ...choices, classes } }
      }
      const fighter = copyRecord(choices.fighter)
      const extensionChoices = copyRecord(fighter.extensionChoices)
      const current = Array.isArray(extensionChoices[spell.preparationSelection!.key])
        ? [...new Set((extensionChoices[spell.preparationSelection!.key] as unknown[]).map(String))]
        : []
      extensionChoices[spell.preparationSelection!.key] = prepared
        ? [...new Set([...current, spellId])]
        : current.filter((id) => id !== spellId)
      return { ...character, dnd5eClassChoices: { ...choices, fighter: { ...fighter, extensionChoices } } }
    }, prepared ? '法术准备' : '取消准备')
  }, [mutateOwnedCharacter])

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

  const spendHitDie = useCallback(async (characterId: string, poolIndex: number, roll: number, healing: number) => {
    await mutateOwnedCharacter(characterId, (character) => {
      const hitPointDice = Array.isArray(character.hitPointDice)
        ? character.hitPointDice.map((pool) => copyRecord(pool))
        : []
      const pool = hitPointDice[poolIndex]
      const maxHp = Math.max(1, Number(character.maxHp) || 1)
      const currentHp = Math.max(0, Number(character.currentHp) || 0)
      if (!pool || Number(pool.current) < 1 || currentHp >= maxHp) throw new Error('hit-die-unavailable')
      pool.current = Math.max(0, Number(pool.current) - 1)
      return {
        ...character,
        currentHp: Math.min(maxHp, currentHp + Math.max(0, Math.floor(healing))),
        hitPointDice,
        dnd5eMobileLastHitDie: { poolIndex, roll, healing, updatedAt: Date.now() },
      }
    }, '生命骰恢复')
  }, [mutateOwnedCharacter])

  const recoverSpellSlot = useCallback(async (characterId: string, resourceKey: string, restAdvanceId: string) => {
    const currentView = workspaceRef.current?.characters.find((candidate) => candidate.id === characterId)
    if (!currentView) throw new Error('character-not-found')
    const featureKey = (currentView.classLevels?.wizard ?? 0) > 0 || currentView.charClass.includes('法师')
      ? 'dnd5e-arcane-recovery'
      : ((currentView.classLevels?.druid ?? 0) >= 2 || currentView.charClass.includes('德鲁伊')) &&
          currentView.dnd5eClassChoices?.classes?.druid?.subclass === 'land'
        ? 'dnd5e-natural-recovery'
        : ''
    const slotLevel = Number(resourceKey.match(/^dnd5e-spell-slot-([1-5])$/)?.[1])
    if (!featureKey || !slotLevel) throw new Error('rest-slot-recovery-unavailable')
    await mutateOwnedCharacter(characterId, (character) => {
      const resources = copyRecord(character.classResources)
      const feature = copyRecord(resources[featureKey])
      const slot = copyRecord(resources[resourceKey])
      const classLevels = copyRecord(character.dnd5eClassLevels)
      const classLevel = featureKey === 'dnd5e-arcane-recovery'
        ? Math.max(1, Number(classLevels.wizard) || (String(character.charClass).includes('法师') ? Number(character.level) : 0))
        : Math.max(2, Number(classLevels.druid) || (String(character.charClass).includes('德鲁伊') ? Number(character.level) : 0))
      const recoveryLimit = Math.max(1, Math.ceil(classLevel / 2))
      const recoveryMarker = copyRecord(character.dnd5eMobileRestSlotRecovery)
      const continuing = String(recoveryMarker.restAdvanceId ?? '') === restAdvanceId
      const spentLevels = continuing ? Math.max(0, Number(recoveryMarker.levelsRecovered) || 0) : 0
      if ((!continuing && Number(feature.current) < 1) || spentLevels + slotLevel > recoveryLimit) throw new Error('rest-slot-recovery-limit')
      if (Number(slot.current) >= Number(slot.max)) throw new Error('slot-already-full')
      resources[resourceKey] = { ...slot, current: Number(slot.current) + 1 }
      if (!continuing) resources[featureKey] = { ...feature, current: Math.max(0, Number(feature.current) - 1) }
      return {
        ...character,
        classResources: resources,
        dnd5eMobileRestSlotRecovery: { restAdvanceId, levelsRecovered: spentLevels + slotLevel, updatedAt: Date.now() },
      }
    }, featureKey === 'dnd5e-arcane-recovery' ? '奥术回想' : '自然回想')
  }, [mutateOwnedCharacter])

  return {
    serverUrl, setServerUrl, account, campaigns, credentials, rules, workspace,
    connection, roomEventStream, error, notice, busy, login, acceptRegisteredAccount, joinRoom, leaveRoom, logout,
    updateProfile, changePassword,
    refresh: () => refreshWorkspace(), selectCharacter, submitAction, moveControlledToken, sendChat, mutateSharedNote, answerInterrupt,
    interactWithPoint, setSpellSlot, setSpellPrepared, submitInventoryMutation, spendHitDie, recoverSpellSlot,
  }
}
