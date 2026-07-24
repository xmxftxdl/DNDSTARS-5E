export const ROOM_CHAT_RESOURCE = 'room-chat'
export const ROOM_JOURNAL_RESOURCE = 'room-journal'
export const ROOM_COMMUNICATIONS_SCHEMA_VERSION = 1
export const ROOM_CHAT_MESSAGE_LIMIT = 500
export const ROOM_HANDOUT_LIMIT = 100
export const ROOM_JOURNAL_ENTRY_LIMIT = 200
export const ROOM_SHARED_NOTE_LIMIT = 200

export type RoomChatChannel = 'ic' | 'ooc' | 'dm-private'

export interface RoomChatRoll {
  expression: string
  count: number
  sides: number
  modifier: number
  values: number[]
  total: number
  label?: string
}

export interface RoomChatPersona {
  kind: 'dm' | 'player' | 'character' | 'npc'
  name: string
  avatar: string
  sourceId?: string
}

export interface RoomChatMessage {
  id: string
  channel: RoomChatChannel
  createdAt: number
  senderMemberId: string
  senderRole: 'dm' | 'player'
  senderDisplayName: string
  recipientMemberId?: string
  persona: RoomChatPersona
  text: string
  roll?: RoomChatRoll
}

export interface SharedRoomChatState {
  schemaVersion: typeof ROOM_COMMUNICATIONS_SCHEMA_VERSION
  messages: RoomChatMessage[]
  updatedAt: number
}

export interface SendRoomChatInput {
  channel: RoomChatChannel
  text: string
  recipientMemberId?: string
  npcTokenId?: string
}

/** `dm` 表示尚未发布的讲义草稿，可由场景或地图互动在之后分发。 */
export type HandoutAudience = 'all' | 'dm' | string[]

export interface RoomHandout {
  id: string
  title: string
  body: string
  imageId?: string
  imageMimeType?: string
  imageName?: string
  audience: HandoutAudience
  authorMemberId: string
  authorName: string
  createdAt: number
  updatedAt: number
  authorityReceiptId?: string
}

export interface CampaignJournalEntry {
  id: string
  title: string
  body: string
  source: 'dm' | 'combat-summary'
  combatId?: string
  authorMemberId: string
  authorName: string
  createdAt: number
  updatedAt: number
}

export type SharedNoteKind = 'task' | 'clue' | 'note'
export type SharedNoteStatus = 'open' | 'done'

export interface RoomSharedNote {
  id: string
  kind: SharedNoteKind
  status: SharedNoteStatus
  title: string
  body: string
  authorMemberId: string
  authorName: string
  lastEditorMemberId: string
  lastEditorName: string
  createdAt: number
  updatedAt: number
  authorityReceiptId?: string
}

export interface SharedRoomJournalState {
  schemaVersion: typeof ROOM_COMMUNICATIONS_SCHEMA_VERSION
  handouts: RoomHandout[]
  campaignEntries: CampaignJournalEntry[]
  sharedNotes: RoomSharedNote[]
  /** DM 权威副作用的有界幂等收据；旧存档缺失时自动迁移为空数组。 */
  authorityMutationReceipts: string[]
  updatedAt: number
}

export type RoomJournalMutation =
  | {
      operation: 'add-handout'
      title: string
      body: string
      audience: HandoutAudience
      imageId?: string
      imageMimeType?: string
      imageName?: string
      authorityReceiptId?: string
    }
  | { operation: 'remove-handout'; id: string }
  | {
      operation: 'add-campaign-entry'
      title: string
      body: string
      source?: 'dm' | 'combat-summary'
      combatId?: string
    }
  | { operation: 'remove-campaign-entry'; id: string }
  | { operation: 'add-shared-note'; kind: SharedNoteKind; title: string; body: string; authorityReceiptId?: string }
  | {
      operation: 'update-shared-note'
      id: string
      kind?: SharedNoteKind
      status?: SharedNoteStatus
      title?: string
      body?: string
      authorityReceiptId?: string
    }
  | { operation: 'remove-shared-note'; id: string }

function plainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function timestamp(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}

function normalizeRoll(value: unknown): RoomChatRoll | undefined {
  if (!plainObject(value)) return undefined
  const count = Number(value.count)
  const sides = Number(value.sides)
  const modifier = Number(value.modifier)
  const values = Array.isArray(value.values)
    ? value.values.map(Number).filter((entry) => Number.isInteger(entry))
    : []
  const total = Number(value.total)
  if (
    !Number.isInteger(count) || count < 1 || count > 100 ||
    !Number.isInteger(sides) || sides < 2 || sides > 1_000 ||
    !Number.isInteger(modifier) || Math.abs(modifier) > 10_000 ||
    values.length !== count || values.some((entry) => entry < 1 || entry > sides) ||
    !Number.isInteger(total)
  ) return undefined
  return {
    expression: text(value.expression, 40),
    count,
    sides,
    modifier,
    values,
    total,
    label: text(value.label, 160) || undefined,
  }
}

function normalizeMessage(value: unknown): RoomChatMessage | null {
  if (!plainObject(value)) return null
  if (value.channel !== 'ic' && value.channel !== 'ooc' && value.channel !== 'dm-private') return null
  if (value.senderRole !== 'dm' && value.senderRole !== 'player') return null
  if (!plainObject(value.persona)) return null
  const personaKind = value.persona.kind
  if (personaKind !== 'dm' && personaKind !== 'player' && personaKind !== 'character' && personaKind !== 'npc') return null
  const id = text(value.id, 120)
  const senderMemberId = text(value.senderMemberId, 160)
  const senderDisplayName = text(value.senderDisplayName, 80)
  const messageText = text(value.text, 1_000)
  const personaName = text(value.persona.name, 80)
  if (!id || !senderMemberId || !senderDisplayName || (!messageText && !value.roll) || !personaName) return null
  const roll = normalizeRoll(value.roll)
  if (value.roll != null && !roll) return null
  return {
    id,
    channel: value.channel,
    createdAt: timestamp(value.createdAt),
    senderMemberId,
    senderRole: value.senderRole,
    senderDisplayName,
    recipientMemberId: text(value.recipientMemberId, 160) || undefined,
    persona: {
      kind: personaKind,
      name: personaName,
      avatar: text(value.persona.avatar, 12) || '💬',
      sourceId: text(value.persona.sourceId, 160) || undefined,
    },
    text: messageText,
    roll,
  }
}

export function normalizeSharedRoomChat(value: unknown): SharedRoomChatState {
  const source = plainObject(value) ? value : {}
  const messages = (Array.isArray(source.messages) ? source.messages : [])
    .map(normalizeMessage)
    .filter((message): message is RoomChatMessage => message !== null)
    .slice(-ROOM_CHAT_MESSAGE_LIMIT)
  return {
    schemaVersion: ROOM_COMMUNICATIONS_SCHEMA_VERSION,
    messages,
    updatedAt: timestamp(source.updatedAt),
  }
}

function normalizeAudience(value: unknown): HandoutAudience {
  if (value === 'all' || value === 'dm') return value
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((entry) => text(entry, 160)).filter(Boolean))].slice(0, 8)
}

function normalizeHandout(value: unknown): RoomHandout | null {
  if (!plainObject(value)) return null
  const id = text(value.id, 120)
  const title = text(value.title, 120)
  const authorMemberId = text(value.authorMemberId, 160)
  const authorName = text(value.authorName, 80)
  if (!id || !title || !authorMemberId || !authorName) return null
  return {
    id,
    title,
    body: text(value.body, 20_000),
    imageId: text(value.imageId, 160) || undefined,
    imageMimeType: text(value.imageMimeType, 120) || undefined,
    imageName: text(value.imageName, 240) || undefined,
    audience: normalizeAudience(value.audience),
    authorMemberId,
    authorName,
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
    authorityReceiptId: text(value.authorityReceiptId, 300) || undefined,
  }
}

function normalizeCampaignEntry(value: unknown): CampaignJournalEntry | null {
  if (!plainObject(value)) return null
  const id = text(value.id, 120)
  const title = text(value.title, 120)
  const authorMemberId = text(value.authorMemberId, 160)
  const authorName = text(value.authorName, 80)
  if (!id || !title || !authorMemberId || !authorName) return null
  return {
    id,
    title,
    body: text(value.body, 40_000),
    source: value.source === 'combat-summary' ? 'combat-summary' : 'dm',
    combatId: text(value.combatId, 160) || undefined,
    authorMemberId,
    authorName,
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
  }
}

function normalizeSharedNote(value: unknown): RoomSharedNote | null {
  if (!plainObject(value)) return null
  const id = text(value.id, 120)
  const title = text(value.title, 120)
  const authorMemberId = text(value.authorMemberId, 160)
  const authorName = text(value.authorName, 80)
  if (!id || !title || !authorMemberId || !authorName) return null
  return {
    id,
    kind: value.kind === 'task' || value.kind === 'clue' ? value.kind : 'note',
    status: value.status === 'done' ? 'done' : 'open',
    title,
    body: text(value.body, 20_000),
    authorMemberId,
    authorName,
    lastEditorMemberId: text(value.lastEditorMemberId, 160) || authorMemberId,
    lastEditorName: text(value.lastEditorName, 80) || authorName,
    createdAt: timestamp(value.createdAt),
    updatedAt: timestamp(value.updatedAt),
    authorityReceiptId: text(value.authorityReceiptId, 300) || undefined,
  }
}

export function normalizeSharedRoomJournal(value: unknown): SharedRoomJournalState {
  const source = plainObject(value) ? value : {}
  return {
    schemaVersion: ROOM_COMMUNICATIONS_SCHEMA_VERSION,
    handouts: (Array.isArray(source.handouts) ? source.handouts : [])
      .map(normalizeHandout)
      .filter((entry): entry is RoomHandout => entry !== null)
      .slice(-ROOM_HANDOUT_LIMIT),
    campaignEntries: (Array.isArray(source.campaignEntries) ? source.campaignEntries : [])
      .map(normalizeCampaignEntry)
      .filter((entry): entry is CampaignJournalEntry => entry !== null)
      .slice(-ROOM_JOURNAL_ENTRY_LIMIT),
    sharedNotes: (Array.isArray(source.sharedNotes) ? source.sharedNotes : [])
      .map(normalizeSharedNote)
      .filter((entry): entry is RoomSharedNote => entry !== null)
      .slice(-ROOM_SHARED_NOTE_LIMIT),
    authorityMutationReceipts: (Array.isArray(source.authorityMutationReceipts)
      ? source.authorityMutationReceipts
      : []
    )
      .map((entry) => text(entry, 300))
      .filter(Boolean)
      .slice(-512),
    updatedAt: timestamp(source.updatedAt),
  }
}

export interface ParsedRoomChatRollCommand {
  expression: string
  count: number
  sides: number
  modifier: number
  label?: string
}

export function parseRoomChatRollCommand(value: string): ParsedRoomChatRollCommand | null {
  const match = value.trim().match(/^\/roll\s+(?:(\d{0,3})d)?(\d{1,4})(?:\s*([+-])\s*(\d{1,5}))?(?:\s+(.+))?$/i)
  if (!match) return null
  const count = match[1] ? Number(match[1]) : 1
  const sides = Number(match[2])
  const unsignedModifier = Number(match[4] ?? 0)
  const modifier = match[3] === '-' ? -unsignedModifier : unsignedModifier
  if (count < 1 || count > 100 || sides < 2 || sides > 1_000 || Math.abs(modifier) > 10_000) return null
  const expression = `${count}d${sides}${modifier === 0 ? '' : modifier > 0 ? `+${modifier}` : modifier}`
  return { expression, count, sides, modifier, label: text(match[5], 160) || undefined }
}
