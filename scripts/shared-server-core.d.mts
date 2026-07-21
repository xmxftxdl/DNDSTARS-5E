// shared-server-core.mjs 的类型声明（供 src/ 下 vitest 测试 import）。
export const STATE_MAX_BYTES: number
export const CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH: number
export const CHARACTER_PORTRAIT_MAX_TOTAL_DATA_URL_LENGTH: number
export const IMAGE_MAX_BYTES: number
export const EVENT_BACKLOG_LIMIT: number
export const EVENT_REPLAY_LIMIT: number
export const EVENT_CHANNEL_LIMIT: number
export const IMAGE_COUNT_LIMIT: number
export const ROOM_HOST_TTL_MS: number
export const ROOM_PLAYER_TTL_MS: number
export const ROOM_PRESENCE_ONLINE_MS: number
export const ROOM_PLAYER_SLOTS: readonly ['player1', 'player2', 'player3', 'player4', 'player5', 'player6', 'player7', 'player8']
export const DND5E_2014_RULESET_ID: 'dnd5e-2014-srd-5.1'
export const SHARED_PROTOCOL_VERSION: number
export const SHARED_MIN_CLIENT_PROTOCOL: number
export const SHARED_STATE_SCHEMA_VERSION: number
export const ACCOUNT_CHARACTER_SCHEMA_VERSION: number
export const ACCOUNT_SESSION_LIMIT: number
export const ACCOUNT_CHARACTER_LIMIT: number
export const CAMPAIGN_BUNDLE_FORMAT: 'dndstars5e-campaign'
export const CAMPAIGN_BUNDLE_SCHEMA_VERSION: number
export const CAMPAIGN_SNAPSHOT_LIMIT: number
export const CAMPAIGN_IMPORT_MAX_BYTES: number
export const CAMPAIGN_AUTO_SNAPSHOT_INTERVAL_MS: number

export function migrateLegacyApCombatLogText(text: unknown): string
export function normalizeDedicatedDnd5eSharedState<T>(name: string, value: T): T
export function validateSharedStateShape(
  name: string,
  value: unknown,
): { ok: true } | { ok: false; reason: string }
export function projectMapsForPlayer<T>(
  value: T,
  geometryState: unknown,
  activeCharacterId?: string | null,
  characterState?: unknown,
  viewerIdentity?: unknown,
  fogState?: unknown,
  worldMinute?: number | null,
): T
export function projectMapGeometryForPlayer<T>(value: T, memberId?: string | null, worldMinute?: number | null): T
export function projectMapExplorationForPlayer<T>(value: T, memberId?: string | null): T
export function fogPointState(fog: unknown, x: number, y: number): 'covered' | 'revealed' | 'neutral'

export interface ParsedRoomChatRollCommand {
  expression: string
  count: number
  sides: number
  modifier: number
  label?: string
}
export type RoomCommunicationMutationResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true
      changed: boolean
      next: Record<string, unknown>
      message?: Record<string, unknown>
    }
export function parseRoomChatRollCommand(value: unknown): ParsedRoomChatRollCommand | null
export function mutateRoomChatState(
  current: unknown,
  mutation: Record<string, unknown>,
  now: number,
  member: Record<string, unknown>,
  context?: Record<string, unknown>,
): RoomCommunicationMutationResult
export function projectRoomChatForMember(
  value: Record<string, unknown>,
  memberId: string,
  isDm?: boolean,
): Record<string, unknown> & { messages: Array<Record<string, unknown>> }
export function mutateRoomJournalState(
  current: unknown,
  mutation: Record<string, unknown>,
  now: number,
  member: Record<string, unknown>,
  context?: Record<string, unknown>,
): RoomCommunicationMutationResult
export function projectRoomJournalForMember(
  value: Record<string, unknown>,
  memberId: string,
  isDm?: boolean,
): Record<string, unknown> & {
  handouts: Array<Record<string, unknown>>
  campaignEntries: Array<Record<string, unknown>>
  sharedNotes: Array<Record<string, unknown>>
}
export function mutateGroupAbilityChecksState(
  current: unknown,
  mutation: Record<string, unknown>,
  now: number,
  member: Record<string, unknown>,
  context?: Record<string, unknown>,
): RoomCommunicationMutationResult
export function projectGroupAbilityChecksForMember(
  value: Record<string, unknown>,
  memberId: string,
  isDm?: boolean,
): Record<string, unknown> & { checks: Array<Record<string, unknown>> }
export function mutateCampaignTimeState(
  current: unknown,
  mutation: Record<string, unknown>,
  now: number,
  member: Record<string, unknown>,
  context?: Record<string, unknown>,
): RoomCommunicationMutationResult

export function capEventChannels<T>(
  eventBacklog: Map<string, T>,
  limit?: number,
  protectedChannels?: Set<string> | null,
): string[]

export class LockTimeoutError extends Error {
  code: 'ELOCKTIMEOUT'
  statusCode: 503
}

export function withWriteLock<T>(filePath: string, fn: () => Promise<T>): Promise<T>
export function atomicWriteLocked(filePath: string, body: Buffer | Uint8Array | string): Promise<void>
export function atomicWriteJsonStateFreshLocked(
  filePath: string,
  body: Buffer | Uint8Array | string,
): Promise<boolean>
export function atomicWriteJsonStateCasLocked(
  filePath: string,
  incoming: Record<string, unknown>,
  options?: {
    expectedRevision?: number | null
    writerId?: string
    mergeIncoming?: (current: unknown, incoming: Record<string, unknown>) => Record<string, unknown>
    validateIncoming?: (incoming: Record<string, unknown>) => { ok: boolean; reason?: string }
  },
): Promise<
  | { ok: true; revision: number; value: Record<string, unknown>; writtenAt: number }
  | { ok: false; conflict?: boolean; stale?: boolean; invalid?: boolean; reason?: string; currentRevision: number; current: unknown }
>
export function mergePlayerCharactersStateForAuthority(
  currentState: { characters?: Array<Record<string, unknown>>; selectedId?: string | null } | null,
  incomingState: { characters?: Array<Record<string, unknown>>; selectedId?: string | null; [key: string]: unknown },
  memberId: string,
  options?: { combatActive?: boolean },
): { characters: Array<Record<string, unknown>>; selectedId: string | null; [key: string]: unknown }
export function atomicDeleteJsonStateCasLocked(
  filePath: string,
  options?: { expectedRevision?: number | null; writerId?: string },
): Promise<
  | { ok: true; revision: number; value: Record<string, unknown>; writtenAt: number }
  | { ok: false; conflict: true; currentRevision: number; current: unknown }
>
export function atomicWriteImageLocked(
  imagePath: string,
  metaPath: string,
  blob: Buffer | Uint8Array,
  metaBody: Buffer | Uint8Array | string,
): Promise<void>

export function handleSharedApi(
  req: import('node:http').IncomingMessage,
  res: import('node:http').ServerResponse,
  parsed: URL,
  ctx: {
    lobbyRoot?: string
    stateRoot: string
    imageRoot: string
    quarantineRoot: string
    snapshotRoot: string
    legacyStateRoot: string
    legacyImageRoot: string
    eventClients: Map<string, Set<import('node:http').ServerResponse>>
    eventBacklog: Map<string, unknown[]>
    eventSequences?: Map<string, number>
    serverInstanceId?: string
    rateLimits?: Map<string, { startedAt: number; count: number }>
    serverStartedAt?: number
    serverBuildId?: string
  },
): Promise<boolean>

export function safeName(value: unknown): string
export function normalizeLobbyRoomCode(value: unknown): string
export function roomHostIsOnline(room: unknown, now?: number): boolean
export function roomHostPresence(room: unknown, now?: number): 'online' | 'grace' | 'offline' | 'closed'
export function roomPlayerPresence(player: unknown, now?: number): 'online' | 'temporarily-offline' | 'left' | 'removed'
export function normalizeAccountRecoveryCode(value: unknown): { accountId: string; secret: string; formatted: string } | null
export interface RoomPluginRequirement {
  id: string
  version: string
  integrity: string
  stateSchemaVersion: number
}
export function normalizeRoomPluginRequirements(value: unknown): RoomPluginRequirement[] | null
export function roomPluginReadiness(
  required: readonly RoomPluginRequirement[],
  active: readonly RoomPluginRequirement[],
): {
  ready: boolean
  missing: RoomPluginRequirement[]
  mismatched: RoomPluginRequirement[]
}
export function assignRoomPlayer(
  room: Record<string, unknown>,
  input: {
    clientId: string
    displayName: string
    memberId: string
    accountId?: string
    activePlugins?: readonly RoomPluginRequirement[]
  },
  now?: number,
):
  | { ok: false; status: number; error: string }
  | {
      ok: true
      member: Record<string, unknown>
      next: Record<string, unknown>
    }

export function authorizeStateWrite(
  resourceName: string,
  providedSecret: string | null,
): { ok: true } | { ok: false; status: number }
export function extractSecret(req: { headers?: Record<string, unknown> }): string | null

export function enforceImageQuota(imageRoot: string): Promise<string[]>

export function replaySlice<T>(backlog: T[]): T[]
export function pushBacklog<T>(backlog: T[], payload: T): T[]
