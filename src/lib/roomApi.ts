import { sharedLobbyApiCandidates } from './sharedApi'
import { getAccountSession } from './accountSession'
import type { JsonValue } from '../rulesets/dnd5e/pluginApi'
import {
  DND5E_2014_RULESET_ID,
  getRoomClientId,
  getRoomPlayerResumeIdentity,
  isRoomPlayerSlot,
  saveRoomSession,
  type RoomPlayerSlot,
  type RoomPluginMetadata,
  type RoomPluginRequirement,
  type RoomRole,
  type RoomRulesSnapshot,
  type RoomSession,
} from './roomSession'

interface RoomMemberResponse {
  memberId: string
  accountId?: string
  clientId: string
  role: RoomRole
  slot?: RoomPlayerSlot
  displayName: string
}

interface RoomResponse {
  roomId: string
  roomName: string
  rulesetId: typeof DND5E_2014_RULESET_ID
  createdAt: number
  hostOnline: boolean
  locked: boolean
  passwordRequired: boolean
  maxPlayers: number
  member: RoomMemberResponse
  rules: RoomRulesSnapshot
}

export interface RoomConnection {
  session: RoomSession
  rules: RoomRulesSnapshot
}

export interface RoomPreview {
  roomId: string
  roomName: string
  rulesetId: typeof DND5E_2014_RULESET_ID
  dmDisplayName: string
  hostOnline: boolean
  hostStatus: 'online' | 'grace' | 'offline' | 'closed'
  hostLastSeenAt: number
  hostGraceExpiresAt: number
  gameProtocolVersion: number
  locked: boolean
  passwordRequired: boolean
  playerCount: number
  maxPlayers: number
  plugins: RoomPluginMetadata[]
}

export interface RoomRosterMember {
  memberId: string
  accountId?: string
  displayName: string
  slot: RoomPlayerSlot
  joinedAt: number
  lastSeenAt: number
  online: boolean
  status: 'online' | 'temporarily-offline' | 'left' | 'removed'
  activeCharacterId: string | null
  activeCharacterName: string | null
  ready: boolean
  missing: RoomPluginRequirement[]
  mismatched: RoomPluginRequirement[]
}

export interface RoomRoster {
  roomId: string
  locked: boolean
  passwordRequired: boolean
  maxPlayers: number
  players: RoomRosterMember[]
}

export function onlineRoomRoster(roster: RoomRoster): RoomRoster {
  return { ...roster, players: roster.players.filter((player) => player.online) }
}

function normalizedRosterRequirement(value: unknown): RoomPluginRequirement | null {
  if (!value || typeof value !== 'object') return null
  const requirement = value as Partial<RoomPluginRequirement>
  if (
    typeof requirement.id !== 'string' ||
    typeof requirement.version !== 'string' ||
    typeof requirement.integrity !== 'string'
  ) return null
  return {
    id: requirement.id,
    version: requirement.version,
    integrity: requirement.integrity,
    stateSchemaVersion: Number.isInteger(requirement.stateSchemaVersion)
      ? Math.max(1, Number(requirement.stateSchemaVersion))
      : 1,
  }
}

/**
 * The room server can remain alive across Vite HMR updates. Such a process may
 * still return the pre-plugin roster shape without ready/missing/mismatched.
 * Treat the HTTP payload as untrusted and migrate that legacy shape here so a
 * stale server cannot crash the DM roster page.
 */
export function normalizeRoomRosterPayload(value: unknown, expectedRoomId: string): RoomRoster {
  const payload = value && typeof value === 'object'
    ? value as { roomId?: unknown; locked?: unknown; passwordRequired?: unknown; maxPlayers?: unknown; players?: unknown }
    : {}
  const players = (Array.isArray(payload.players) ? payload.players : []).flatMap<RoomRosterMember>((value) => {
    if (!value || typeof value !== 'object') return []
    const player = value as Partial<RoomRosterMember>
    if (
      typeof player.memberId !== 'string' ||
      typeof player.displayName !== 'string' ||
      !isRoomPlayerSlot(player.slot)
    ) return []
    const missing = (Array.isArray(player.missing) ? player.missing : [])
      .map(normalizedRosterRequirement)
      .filter((requirement): requirement is RoomPluginRequirement => requirement !== null)
    const mismatched = (Array.isArray(player.mismatched) ? player.mismatched : [])
      .map(normalizedRosterRequirement)
      .filter((requirement): requirement is RoomPluginRequirement => requirement !== null)
    return [{
      memberId: player.memberId,
      ...(typeof player.accountId === 'string' ? { accountId: player.accountId } : {}),
      displayName: player.displayName,
      slot: player.slot,
      joinedAt: Number.isFinite(player.joinedAt) ? Number(player.joinedAt) : 0,
      lastSeenAt: Number.isFinite(player.lastSeenAt) ? Number(player.lastSeenAt) : 0,
      online: player.online === true,
      status: player.status === 'temporarily-offline' || player.status === 'left' || player.status === 'removed'
        ? player.status
        : player.online === true ? 'online' : 'temporarily-offline',
      activeCharacterId: typeof player.activeCharacterId === 'string' ? player.activeCharacterId : null,
      activeCharacterName: typeof player.activeCharacterName === 'string' ? player.activeCharacterName : null,
      ready: typeof player.ready === 'boolean' ? player.ready : missing.length === 0 && mismatched.length === 0,
      missing,
      mismatched,
    }]
  })
  return {
    roomId: typeof payload.roomId === 'string' ? payload.roomId : expectedRoomId,
    locked: payload.locked === true,
    passwordRequired: payload.passwordRequired === true,
    maxPlayers: Number.isInteger(payload.maxPlayers) ? Math.max(1, Math.min(8, Number(payload.maxPlayers))) : 3,
    players,
  }
}

export class RoomApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, status = 0) {
    super(code)
    this.name = 'RoomApiError'
    this.code = code
    this.status = status
  }
}

export function roomHeartbeatErrorIsTerminal(error: unknown): boolean {
  return error instanceof RoomApiError && [
    'room-closed',
    'room-not-found',
    'member-not-found',
    'member-removed',
    'invalid-account-session',
  ].includes(error.code)
}

async function roomRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const account = getAccountSession()
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(account ? { 'X-Stars-Account-Token': account.sessionToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      const body = await response.json().catch(() => ({})) as { error?: string }
      if (response.ok) return body as T
      throw new RoomApiError(body.error ?? 'request-failed', response.status)
    } catch (error) {
      if (error instanceof RoomApiError) throw error
      void error
    }
  }
  throw new RoomApiError(reachedServer ? 'request-failed' : 'server-unavailable', 0)
}

async function roomBinaryRequest(path: string, init?: RequestInit): Promise<Response> {
  const account = getAccountSession()
  let reachedServer = false
  for (const api of sharedLobbyApiCandidates()) {
    try {
      const response = await fetch(`${api}${path}`, {
        ...init,
        headers: {
          ...(account ? { 'X-Stars-Account-Token': account.sessionToken } : {}),
          ...(init?.headers ?? {}),
        },
      })
      reachedServer = true
      if (response.ok) return response
      const body = await response.json().catch(() => ({})) as { error?: string }
      throw new RoomApiError(body.error ?? 'request-failed', response.status)
    } catch (error) {
      if (error instanceof RoomApiError) throw error
      void error
    }
  }
  throw new RoomApiError(reachedServer ? 'request-failed' : 'server-unavailable', 0)
}

function responseToSession(response: RoomResponse): RoomSession {
  return {
    roomId: response.roomId,
    roomName: response.roomName,
    rulesetId: response.rulesetId,
    memberId: response.member.memberId,
    accountId: response.member.accountId,
    clientId: response.member.clientId,
    role: response.member.role,
    slot: response.member.slot,
    displayName: response.member.displayName,
    createdAt: response.createdAt,
  }
}

function exactRoomPluginRequirements(
  plugins: readonly { id: string; version: string; integrity?: string; stateSchemaVersion?: number }[],
): RoomPluginRequirement[] {
  return plugins.flatMap((plugin) => plugin.integrity ? [{
    id: plugin.id,
    version: plugin.version,
    integrity: plugin.integrity,
    stateSchemaVersion: Number.isInteger(plugin.stateSchemaVersion) ? Number(plugin.stateSchemaVersion) : 1,
  }] : [])
}

export async function createRoom(input: {
  roomName: string
  displayName: string
  password?: string
  maxPlayers?: number
  activePlugins?: readonly { id: string; version: string; integrity?: string; stateSchemaVersion?: number }[]
}): Promise<RoomConnection> {
  const account = getAccountSession()
  if (!account) throw new RoomApiError('account-required', 401)
  const response = await roomRequest<RoomResponse>('/rooms', {
    method: 'POST',
    body: JSON.stringify({
      roomName: input.roomName,
      displayName: input.displayName,
      rulesetId: DND5E_2014_RULESET_ID,
      clientId: getRoomClientId(),
      accountId: account.accountId,
      activePlugins: exactRoomPluginRequirements(input.activePlugins ?? []),
      password: input.password ?? '',
      maxPlayers: input.maxPlayers ?? 3,
    }),
  })
  return { session: responseToSession(response), rules: response.rules }
}

export async function joinRoom(input: {
  roomId: string
  displayName: string
  password?: string
  activePlugins?: readonly { id: string; version: string; integrity?: string; stateSchemaVersion?: number }[]
}): Promise<RoomConnection> {
  const account = getAccountSession()
  if (!account) throw new RoomApiError('account-required', 401)
  const roomId = input.roomId.trim().toUpperCase()
  const resumeIdentity = getRoomPlayerResumeIdentity(roomId)
  const response = await roomRequest<RoomResponse>(`/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    body: JSON.stringify({
      displayName: input.displayName,
      clientId: getRoomClientId(),
      accountId: account.accountId,
      ...(resumeIdentity ? { resumeMemberId: resumeIdentity.memberId } : {}),
      activePlugins: exactRoomPluginRequirements(input.activePlugins ?? []),
      password: input.password ?? '',
    }),
  })
  return { session: responseToSession(response), rules: response.rules }
}

export async function loadRoomPreview(roomCode: string): Promise<RoomPreview> {
  const roomId = roomCode.trim().toUpperCase()
  return roomRequest<RoomPreview>(`/rooms/${encodeURIComponent(roomId)}/preview`, { method: 'GET' })
}

export async function heartbeatRoom(
  session: RoomSession,
  activePlugins: readonly { id: string; version: string; integrity?: string; stateSchemaVersion?: number }[] = [],
  presence?: { activeCharacterId?: string | null; activeCharacterName?: string | null },
): Promise<RoomRulesSnapshot> {
  const response = await roomRequest<RoomResponse>(`/rooms/${encodeURIComponent(session.roomId)}/heartbeat`, {
    method: 'POST',
    body: JSON.stringify({
      memberId: session.memberId,
      activePlugins: exactRoomPluginRequirements(activePlugins),
      activeCharacterId: presence?.activeCharacterId ?? null,
      activeCharacterName: presence?.activeCharacterName ?? null,
    }),
  })
  if (response.member.role !== session.role || response.member.slot !== session.slot) {
    saveRoomSession(responseToSession(response))
  }
  return response.rules
}

async function updateRoomAdmin(
  session: RoomSession,
  operation: Record<string, unknown>,
): Promise<RoomConnection> {
  if (session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  const response = await roomRequest<RoomResponse>(`/rooms/${encodeURIComponent(session.roomId)}/admin`, {
    method: 'PATCH',
    body: JSON.stringify({ memberId: session.memberId, ...operation }),
  })
  return { session: responseToSession(response), rules: response.rules }
}

export async function setRoomLocked(session: RoomSession, locked: boolean): Promise<void> {
  await updateRoomAdmin(session, { operation: 'set-lock', locked })
}

export async function setRoomCapacity(session: RoomSession, maxPlayers: number): Promise<void> {
  await updateRoomAdmin(session, { operation: 'set-capacity', maxPlayers })
}

export async function setRoomPassword(session: RoomSession, password: string): Promise<void> {
  await updateRoomAdmin(session, { operation: 'set-password', password })
}

export async function kickRoomPlayer(session: RoomSession, targetMemberId: string): Promise<void> {
  await updateRoomAdmin(session, { operation: 'kick', targetMemberId })
}

export async function restoreRoomPlayer(session: RoomSession, targetMemberId: string): Promise<void> {
  await updateRoomAdmin(session, { operation: 'restore-member', targetMemberId })
}

export async function transferRoomDm(session: RoomSession, targetMemberId: string): Promise<RoomConnection> {
  const connection = await updateRoomAdmin(session, { operation: 'transfer-dm', targetMemberId })
  saveRoomSession(connection.session)
  return connection
}

export async function loadRoomRules(session: RoomSession): Promise<RoomRulesSnapshot> {
  return roomRequest<RoomRulesSnapshot>(`/rooms/${encodeURIComponent(session.roomId)}/rules`, {
    method: 'GET',
    headers: { 'X-Stars-Member': session.memberId },
  })
}

export async function updateRoomRules(
  session: RoomSession,
  requiredPlugins: readonly { id: string; version: string; integrity?: string; stateSchemaVersion?: number }[],
): Promise<RoomRulesSnapshot> {
  if (session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  return roomRequest<RoomRulesSnapshot>(`/rooms/${encodeURIComponent(session.roomId)}/rules`, {
    method: 'PUT',
    body: JSON.stringify({
      memberId: session.memberId,
      requiredPlugins: exactRoomPluginRequirements(requiredPlugins),
    }),
  })
}

export async function uploadRoomPlugin(input: {
  session: RoomSession
  id: string
  version: string
  integrity: string
  name: string
  publisher: string
  license: string
  fileName: string
  bytes: ArrayBuffer
}): Promise<RoomRulesSnapshot> {
  if (input.session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  const response = await roomBinaryRequest(
    `/rooms/${encodeURIComponent(input.session.roomId)}/plugins/${encodeURIComponent(input.id)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/javascript',
        'X-Stars-Member': input.session.memberId,
        'X-Stars-Plugin-Version': input.version,
        'X-Stars-Plugin-Integrity': input.integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(input.fileName),
        'X-Stars-Plugin-Name': encodeURIComponent(input.name),
        'X-Stars-Plugin-Publisher': encodeURIComponent(input.publisher),
        'X-Stars-Plugin-License': encodeURIComponent(input.license),
      },
      body: input.bytes,
    },
  )
  return response.json() as Promise<RoomRulesSnapshot>
}

export interface RoomPluginMigrationState {
  installed: boolean
  hasState: boolean
  rulesRevision: number
  active?: RoomPluginRequirement
  stateSchemaVersion: number
  data: JsonValue
}

export async function stageRoomPlugin(input: {
  session: RoomSession
  id: string
  version: string
  stateSchemaVersion: number
  integrity: string
  name: string
  publisher: string
  license: string
  fileName: string
  bytes: ArrayBuffer
}): Promise<RoomRulesSnapshot> {
  if (input.session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  const response = await roomBinaryRequest(
    `/rooms/${encodeURIComponent(input.session.roomId)}/plugins/${encodeURIComponent(input.id)}/stage`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/javascript',
        'X-Stars-Member': input.session.memberId,
        'X-Stars-Plugin-Version': input.version,
        'X-Stars-Plugin-State-Schema': String(input.stateSchemaVersion),
        'X-Stars-Plugin-Integrity': input.integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(input.fileName),
        'X-Stars-Plugin-Name': encodeURIComponent(input.name),
        'X-Stars-Plugin-Publisher': encodeURIComponent(input.publisher),
        'X-Stars-Plugin-License': encodeURIComponent(input.license),
      },
      body: input.bytes,
    },
  )
  return response.json() as Promise<RoomRulesSnapshot>
}

export async function loadRoomPluginMigrationState(
  session: RoomSession,
  pluginId: string,
): Promise<RoomPluginMigrationState> {
  if (session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  return roomRequest<RoomPluginMigrationState>(
    `/rooms/${encodeURIComponent(session.roomId)}/plugins/${encodeURIComponent(pluginId)}/migration-state`,
    { method: 'GET', headers: { 'X-Stars-Member': session.memberId } },
  )
}

export async function activateStagedRoomPlugin(input: {
  session: RoomSession
  pluginId: string
  expectedRulesRevision: number
  expectedActive?: RoomPluginRequirement
  stagedVersion: string
  stagedIntegrity: string
  stateSchemaVersion: number
  data: JsonValue
}): Promise<RoomRulesSnapshot> {
  if (input.session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  return roomRequest<RoomRulesSnapshot>(
    `/rooms/${encodeURIComponent(input.session.roomId)}/plugins/${encodeURIComponent(input.pluginId)}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({
        memberId: input.session.memberId,
        expectedRulesRevision: input.expectedRulesRevision,
        expectedActive: input.expectedActive ?? null,
        stagedVersion: input.stagedVersion,
        stagedIntegrity: input.stagedIntegrity,
        stateSchemaVersion: input.stateSchemaVersion,
        data: input.data,
      }),
    },
  )
}

export async function downloadRoomPlugin(input: {
  session: RoomSession
  requirement: RoomPluginRequirement
}): Promise<{ bytes: ArrayBuffer; fileName: string }> {
  const response = await roomBinaryRequest(
    `/rooms/${encodeURIComponent(input.session.roomId)}/plugins/${encodeURIComponent(input.requirement.id)}`,
    { headers: { 'X-Stars-Member': input.session.memberId } },
  )
  const integrity = response.headers.get('X-Stars-Plugin-Integrity')
  const version = response.headers.get('X-Stars-Plugin-Version')
  const stateSchemaVersion = Number(response.headers.get('X-Stars-Plugin-State-Schema') ?? 1)
  if (
    integrity !== input.requirement.integrity || version !== input.requirement.version ||
    stateSchemaVersion !== input.requirement.stateSchemaVersion
  ) {
    throw new RoomApiError('plugin-integrity-mismatch', 409)
  }
  const encodedName = response.headers.get('X-Stars-Plugin-Filename') ?? ''
  let fileName = `${input.requirement.id}.dndstars5e`
  try {
    fileName = decodeURIComponent(encodedName) || fileName
  } catch {
    // 文件名只用于本机展示；无效值回退到插件 ID。
  }
  return { bytes: await response.arrayBuffer(), fileName }
}

export async function deleteRoomPlugin(
  session: RoomSession,
  pluginId: string,
): Promise<RoomRulesSnapshot> {
  if (session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  const response = await roomBinaryRequest(
    `/rooms/${encodeURIComponent(session.roomId)}/plugins/${encodeURIComponent(pluginId)}`,
    { method: 'DELETE', headers: { 'X-Stars-Member': session.memberId } },
  )
  return response.json() as Promise<RoomRulesSnapshot>
}

export async function loadRoomRoster(session: RoomSession): Promise<RoomRoster> {
  if (session.role !== 'dm') throw new RoomApiError('forbidden', 403)
  const payload = await roomRequest<unknown>(`/rooms/${encodeURIComponent(session.roomId)}/roster`, {
    method: 'GET',
    headers: { 'X-Stars-Member': session.memberId },
  })
  return normalizeRoomRosterPayload(payload, session.roomId)
}

export async function leaveRoom(session: RoomSession): Promise<void> {
  await roomRequest<{ ok: true }>(`/rooms/${encodeURIComponent(session.roomId)}/leave`, {
    method: 'POST',
    body: JSON.stringify({ memberId: session.memberId }),
  })
}

export function roomApiErrorMessage(error: unknown): string {
  const code = error instanceof RoomApiError ? error.code : 'request-failed'
  const messages: Record<string, string> = {
    'account-required': '请先创建账号身份或使用恢复码登录，再创建或加入房间。',
    'invalid-account-session': '账号会话已经失效，请返回大厅使用恢复码重新登录。',
    'member-removed': '你已被 DM 移出这个房间；需要 DM 恢复席位后才能重新加入。',
    'server-unavailable': '无法连接共享服务。请确认 DM 服务端口 5273 已启动。',
    'room-not-found': '没有找到这个房间，请检查房间码。',
    'room-offline': '房间创建者当前不在线，暂时无法加入。',
    'room-closed': '这个房间已经关闭。',
    'room-full': '房间的玩家席位已满。',
    'room-locked': '房间当前已锁定，暂不接受新玩家。',
    'member-not-found': '当前房间席位已失效，请重新加入。',
    forbidden: '只有房间创建者可以查看房间玩家名册。',
    'invalid-room-code': '房间码格式不正确。',
    'invalid-client': '当前浏览器身份无效，请刷新后重试。',
    'invalid-resume-member': '无法恢复这个房间中的旧玩家身份，请重新打开邀请链接后再试。',
    'invalid-display-name': '请输入 1～24 个字符的称呼。',
    'invalid-room-name': '请输入 1～40 个字符的房间名称。',
    'invalid-room-password': '房间密码不正确，或超过 64 个字符。',
    'invalid-room-capacity': '房间人数必须为 1～8，且不能少于当前玩家数。',
    'target-plugins-not-ready': '该玩家的规则包尚未就绪，不能接管 DM。',
    'invalid-room-operation': '房间管理操作无效。',
    'invalid-ruleset': '该规则目前不可用。',
    'invalid-plugin-manifest': '规则包清单无效；房间只接受带版本和 SHA-256 的规则包。',
    'plugin-file-empty': '规则包文件为空。',
    'plugin-file-missing': '该规则包尚未由 DM 上传到房间。',
    'plugin-file-not-found': '房间中没有找到该规则包文件。',
    'plugin-integrity-mismatch': '规则包文件与房间记录的 SHA-256 不一致，已拒绝执行。',
    'request-failed': '房间操作失败，请稍后重试。',
  }
  return messages[code] ?? messages['request-failed']
}
