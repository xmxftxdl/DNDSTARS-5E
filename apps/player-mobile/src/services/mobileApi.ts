import type {
  MobileAccountSession,
  MobileCampaignSummary,
  MobileMoveIntent,
  MobilePlayerSession,
  MobileRoomRules,
  MobileRoomSession,
  PlayerSceneDeltaBatch,
  PlayerSceneSnapshot,
} from '../../../../packages/mobile-protocol/src'

const PROTOCOL_VERSION = '5'

export interface RoomPreview {
  roomId: string
  roomName: string
  dmDisplayName: string
  hostOnline: boolean
  hostStatus: string
  locked: boolean
  passwordRequired: boolean
  playerCount: number
  maxPlayers: number
  plugins: Array<{ id: string; version: string; integrity: string; stateSchemaVersion: number; name: string; publisher: string; license: string }>
}

export interface MobileCredentials {
  serverUrl: string
  account: MobileAccountSession
  room: MobileRoomSession
}

export interface MobileAccountAuthConfig {
  channels: { email: boolean; phone: boolean }
  developmentDelivery: boolean
  passwordMinLength: number
}

export interface MobileVerificationChallenge {
  challengeId: string
  destinationLabel: string
  expiresAt: number
  debugCode?: string
}

function apiBase(serverUrl: string): string {
  return `${serverUrl.replace(/\/+$/, '').replace(/\/api$/, '')}/api`
}

function accountHeaders(account?: MobileAccountSession | null): Record<string, string> {
  return account ? { 'X-Stars-Account-Token': account.sessionToken } : {}
}

export function roomHeaders(credentials: MobileCredentials): Record<string, string> {
  return {
    ...accountHeaders(credentials.account),
    'X-Stars-Member': credentials.room.memberId,
    'X-Stars-Room-Token': credentials.room.roomToken,
    'X-Stars-Protocol': PROTOCOL_VERSION,
    'X-Stars-Writer': `player:${credentials.room.memberId}:${credentials.room.clientId}:mobile`,
  }
}

function roomUrl(credentials: MobileCredentials, path: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${apiBase(credentials.serverUrl)}${path}${separator}room=${encodeURIComponent(credentials.room.roomId)}`
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error || `http-${response.status}`)
  return body as T
}

export async function loginMobileAccount(serverUrl: string, identifier: string, password: string, clientId: string) {
  const body = await jsonRequest<{ session: MobileAccountSession }>(`${apiBase(serverUrl)}/accounts/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: identifier.trim(), password, clientId }),
  })
  return body.session
}

export async function fetchMobileAccountAuthConfig(serverUrl: string) {
  return jsonRequest<MobileAccountAuthConfig>(`${apiBase(serverUrl)}/accounts/auth/config`)
}

export async function requestMobileAccountVerification(
  serverUrl: string,
  channel: 'email' | 'phone',
  destination: string,
) {
  return jsonRequest<MobileVerificationChallenge>(`${apiBase(serverUrl)}/accounts/auth/verification`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channel, destination: destination.trim() }),
  })
}

export async function registerMobileAccount(input: {
  serverUrl: string
  challengeId: string
  verificationCode: string
  username: string
  password: string
  clientId: string
}) {
  const body = await jsonRequest<{ session: MobileAccountSession }>(`${apiBase(input.serverUrl)}/accounts/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      challengeId: input.challengeId,
      verificationCode: input.verificationCode.trim(),
      username: input.username.trim(),
      password: input.password,
      clientId: input.clientId,
    }),
  })
  return body.session
}

export async function logoutMobileAccount(serverUrl: string, account: MobileAccountSession) {
  await jsonRequest(`${apiBase(serverUrl)}/accounts/auth/logout`, {
    method: 'POST',
    headers: accountHeaders(account),
  })
}

export async function fetchMobileAccount(serverUrl: string, account: MobileAccountSession) {
  return jsonRequest<MobileAccountSession>(`${apiBase(serverUrl)}/accounts/me`, {
    headers: accountHeaders(account),
  })
}

export async function updateMobileAccountProfile(
  serverUrl: string,
  account: MobileAccountSession,
  input: { displayName: string; avatar?: string },
) {
  return jsonRequest<MobileAccountSession>(`${apiBase(serverUrl)}/accounts/me`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...accountHeaders(account) },
    body: JSON.stringify(input),
  })
}

export async function changeMobileAccountPassword(
  serverUrl: string,
  account: MobileAccountSession,
  input: { currentPassword: string; newPassword: string },
) {
  await jsonRequest(`${apiBase(serverUrl)}/accounts/me/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...accountHeaders(account) },
    body: JSON.stringify(input),
  })
}

export async function fetchMobileCampaigns(serverUrl: string, account: MobileAccountSession) {
  const body = await jsonRequest<{ campaigns: MobileCampaignSummary[] }>(`${apiBase(serverUrl)}/accounts/me/campaigns`, {
    headers: accountHeaders(account),
  })
  return body.campaigns ?? []
}

export async function fetchRoomPreview(serverUrl: string, roomId: string, account?: MobileAccountSession | null) {
  return jsonRequest<RoomPreview>(`${apiBase(serverUrl)}/rooms/${encodeURIComponent(roomId.trim().toUpperCase())}/preview`, {
    headers: accountHeaders(account),
  })
}

function toRoomSession(response: Record<string, unknown>): MobileRoomSession {
  const member = response.member as Record<string, unknown>
  if (member.role !== 'player' && member.role !== 'spectator') throw new Error('移动端仅支持玩家或观战席位')
  return {
    roomId: String(response.roomId),
    ...(response.campaignId ? { campaignId: String(response.campaignId) } : {}),
    roomName: String(response.roomName),
    rulesetId: 'dnd5e-2014-srd-5.1',
    memberId: String(member.memberId),
    roomToken: String(member.roomToken),
    ...(member.accountId ? { accountId: String(member.accountId) } : {}),
    clientId: String(member.clientId),
    role: member.role,
    ...(member.slot ? { slot: member.slot as MobileRoomSession['slot'] } : {}),
    displayName: String(member.displayName),
    createdAt: Number(response.createdAt),
  }
}

export async function joinMobileRoom(input: {
  serverUrl: string
  account: MobileAccountSession
  roomId: string
  displayName: string
  clientId: string
  password?: string
  resumeMemberId?: string
  role?: 'player' | 'spectator'
}): Promise<{ room: MobileRoomSession; rules: MobileRoomRules }> {
  const preview = await fetchRoomPreview(input.serverUrl, input.roomId, input.account)
  const response = await jsonRequest<Record<string, unknown>>(
    `${apiBase(input.serverUrl)}/rooms/${encodeURIComponent(preview.roomId)}/join`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...accountHeaders(input.account) },
      body: JSON.stringify({
        displayName: input.displayName,
        clientId: input.clientId,
        accountId: input.account.accountId,
        ...(input.resumeMemberId ? { resumeMemberId: input.resumeMemberId } : {}),
        // A preview only describes what the room requires. The client must not
        // claim those packages are active until it has downloaded and verified
        // their immutable package bytes after receiving a room credential.
        activePlugins: [],
        password: input.password ?? '',
        role: input.role ?? 'player',
      }),
    },
  )
  return { room: toRoomSession(response), rules: response.rules as MobileRoomRules }
}

export async function heartbeatMobileRoom(
  credentials: MobileCredentials,
  activeCharacter?: { id: string; name: string } | null,
  activePlugins: MobileRoomRules['requiredPlugins'] = [],
) {
  const rules = await jsonRequest<MobileRoomRules | Record<string, unknown>>(
    `${apiBase(credentials.serverUrl)}/rooms/${encodeURIComponent(credentials.room.roomId)}/heartbeat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
      body: JSON.stringify({
        memberId: credentials.room.memberId,
        activePlugins,
        activeCharacterId: activeCharacter?.id ?? null,
        activeCharacterName: activeCharacter?.name ?? null,
      }),
    },
  )
  return ('rules' in rules ? rules.rules : rules) as MobileRoomRules
}

export async function fetchMobileRoomRules(credentials: MobileCredentials): Promise<MobileRoomRules> {
  return jsonRequest<MobileRoomRules>(
    `${apiBase(credentials.serverUrl)}/rooms/${encodeURIComponent(credentials.room.roomId)}/rules`,
    { cache: 'no-store', headers: roomHeaders(credentials) },
  )
}

export async function leaveMobileRoom(credentials: MobileCredentials) {
  await jsonRequest(`${apiBase(credentials.serverUrl)}/rooms/${encodeURIComponent(credentials.room.roomId)}/leave`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify({ memberId: credentials.room.memberId }),
  })
}

export async function fetchRoomResource<T>(credentials: MobileCredentials, name: string): Promise<T | null> {
  const snapshot = await fetchRoomResourceSnapshot<T>(credentials, name)
  return snapshot.value
}

export interface MobileResourceSnapshot<T> {
  value: T | null
  revision: number
}

export async function fetchRoomResourceSnapshot<T>(credentials: MobileCredentials, name: string): Promise<MobileResourceSnapshot<T>> {
  const response = await fetch(roomUrl(credentials, `/state/${encodeURIComponent(name)}`), {
    cache: 'no-store',
    headers: roomHeaders(credentials),
  })
  if (response.status === 404) return { value: null, revision: 0 }
  const body = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) throw new Error(body.error ?? `${name}:http-${response.status}`)
  const headerRevision = Number(response.headers.get('X-Stars-State-Revision'))
  const embeddedRevision = Number((body as Record<string, unknown>)._revision)
  const revision = Number.isInteger(headerRevision) && headerRevision >= 0
    ? headerRevision
    : Number.isInteger(embeddedRevision) && embeddedRevision >= 0 ? embeddedRevision : 0
  return { value: body as T, revision }
}

export async function downloadMobileRoomPlugin(
  credentials: MobileCredentials,
  requirement: MobileRoomRules['requiredPlugins'][number],
): Promise<unknown> {
  const response = await fetch(roomUrl(
    credentials,
    `/rooms/${encodeURIComponent(credentials.room.roomId)}/plugins/${encodeURIComponent(requirement.id)}`,
  ), { cache: 'no-store', headers: roomHeaders(credentials) })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `plugin-download-http-${response.status}`)
  }
  if (
    response.headers.get('X-Stars-Plugin-Version') !== requirement.version ||
    response.headers.get('X-Stars-Plugin-Integrity') !== requirement.integrity
  ) throw new Error('plugin-integrity-mismatch')
  return response.json().catch(() => { throw new Error('plugin-package-not-json') })
}

export async function saveRoomResourceSnapshot<T>(
  credentials: MobileCredentials,
  name: string,
  value: T,
  expectedRevision: number,
): Promise<{ revision: number }> {
  const response = await fetch(roomUrl(credentials, `/state/${encodeURIComponent(name)}`), {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...roomHeaders(credentials),
      'X-Stars-Expected-Revision': String(expectedRevision),
    },
    body: JSON.stringify(value),
  })
  const body = await response.json().catch(() => ({})) as { error?: string; currentRevision?: number }
  if (response.status === 409) {
    const conflict = new Error('shared-state-conflict') as Error & { currentRevision?: number }
    conflict.currentRevision = Number(body.currentRevision)
    throw conflict
  }
  if (!response.ok) throw new Error(body.error ?? `${name}:http-${response.status}`)
  const revision = Number(response.headers.get('X-Stars-State-Revision'))
  return { revision: Number.isInteger(revision) ? revision : expectedRevision + 1 }
}

export async function publishRoomEvent(
  credentials: MobileCredentials,
  channel: string,
  payload: Record<string, unknown>,
) {
  return jsonRequest<{ ok?: boolean }>(roomUrl(credentials, `/events/${encodeURIComponent(channel)}`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify(payload),
  })
}

export async function appendPlayerAction(credentials: MobileCredentials, action: Record<string, unknown>) {
  return jsonRequest<{ revision?: number }>(roomUrl(credentials, '/state/player-action-requests/append'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify({ action }),
  })
}

export async function submitExplorationMove(credentials: MobileCredentials, mutation: Record<string, unknown>) {
  return jsonRequest<Record<string, unknown>>(roomUrl(credentials, '/state/maps/player-exploration-move'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify(mutation),
  })
}

export async function sendRoomChat(credentials: MobileCredentials, input: Record<string, unknown>) {
  return jsonRequest<Record<string, unknown>>(roomUrl(credentials, '/state/room-chat/message'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify(input),
  })
}

export async function mutateRoomJournal(credentials: MobileCredentials, mutation: Record<string, unknown>) {
  return jsonRequest<Record<string, unknown>>(roomUrl(credentials, '/state/room-journal/mutation'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify(mutation),
  })
}

export async function answerCombatInterrupt(credentials: MobileCredentials, input: Record<string, unknown>) {
  return jsonRequest<Record<string, unknown>>(roomUrl(credentials, '/state/combat-interrupts/interrupt'), {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify(input),
  })
}

export async function fetchVoiceStatus(credentials: MobileCredentials) {
  return jsonRequest<Record<string, unknown>>(`${apiBase(credentials.serverUrl)}/rooms/${credentials.room.roomId}/voice`, {
    headers: roomHeaders(credentials),
  })
}

export async function fetchVoiceCredential(credentials: MobileCredentials) {
  return jsonRequest<{
    schemaVersion: 1
    enabled: true
    provider: 'livekit'
    serverUrl: string
    token: string
    expiresAt: number
    role: 'player' | 'spectator'
    canPublish: boolean
  }>(`${apiBase(credentials.serverUrl)}/rooms/${credentials.room.roomId}/voice/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...roomHeaders(credentials) },
    body: JSON.stringify({}),
  })
}

export function mapImageUrl(credentials: MobileCredentials, mapId: string): string {
  return roomUrl(credentials, `/images/${encodeURIComponent(mapId)}`)
}

export function sharedImageUrl(credentials: MobileCredentials, imageId: string): string {
  return roomUrl(credentials, `/images/${encodeURIComponent(imageId)}`)
}

export async function createDemoSession(baseUrl: string): Promise<MobilePlayerSession> {
  return jsonRequest(`${baseUrl}/api/mobile-player/demo/session`, { method: 'POST' })
}

export async function fetchDemoSnapshot(baseUrl: string, sessionId: string): Promise<PlayerSceneSnapshot> {
  return jsonRequest(`${baseUrl}/api/mobile-player/demo/snapshot`, {
    headers: { 'x-stars-mobile-session': sessionId },
  })
}

export async function fetchDemoDeltas(
  baseUrl: string,
  sessionId: string,
  afterRevision: number,
): Promise<PlayerSceneDeltaBatch> {
  return jsonRequest(`${baseUrl}/api/mobile-player/demo/deltas?after=${afterRevision}`, {
    headers: { 'x-stars-mobile-session': sessionId },
  })
}

export async function submitDemoMove(baseUrl: string, sessionId: string, intent: MobileMoveIntent) {
  return jsonRequest<{ accepted: true; delta: PlayerSceneDeltaBatch['deltas'][number] }>(
    `${baseUrl}/api/mobile-player/demo/move`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-stars-mobile-session': sessionId },
      body: JSON.stringify(intent),
    },
  )
}
