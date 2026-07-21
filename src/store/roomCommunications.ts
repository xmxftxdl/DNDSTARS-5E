import { create } from 'zustand'
import {
  normalizeSharedRoomChat,
  normalizeSharedRoomJournal,
  ROOM_CHAT_RESOURCE,
  ROOM_JOURNAL_RESOURCE,
  type RoomJournalMutation,
  type SendRoomChatInput,
  type SharedRoomChatState,
  type SharedRoomJournalState,
} from '../lib/roomCommunications'
import { getRoomSession } from '../lib/roomSession'
import { loadSharedResource, mutateSharedRoomResource } from '../lib/sharedApi'

interface RoomCommunicationsState {
  chat: SharedRoomChatState
  journal: SharedRoomJournalState
  unreadHandoutIds: string[]
  loadChat: () => Promise<void>
  loadJournal: () => Promise<void>
  sendMessage: (input: SendRoomChatInput) => Promise<void>
  mutateJournal: (mutation: RoomJournalMutation) => Promise<void>
  markHandoutsRead: (ids?: readonly string[]) => void
  reset: () => void
}

const emptyChat = normalizeSharedRoomChat(null)
const emptyJournal = normalizeSharedRoomJournal(null)

function seenStorageKey(): string | null {
  const session = getRoomSession()
  return session ? `dndstars-room-handouts-seen:v1:${session.roomId}:${session.memberId}` : null
}

function readSeenHandoutIds(): Set<string> {
  const key = seenStorageKey()
  if (!key || typeof window === 'undefined') return new Set()
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
  } catch {
    return new Set()
  }
}

function writeSeenHandoutIds(ids: ReadonlySet<string>): void {
  const key = seenStorageKey()
  if (!key || typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify([...ids].slice(-500)))
  } catch {
    // Private browsing and full storage can reject writes; unread state remains in memory.
  }
}

function unreadHandouts(journal: SharedRoomJournalState): string[] {
  const session = getRoomSession()
  if (!session || session.role === 'dm') return []
  const seen = readSeenHandoutIds()
  return journal.handouts.filter((entry) => !seen.has(entry.id)).map((entry) => entry.id)
}

export const useRoomCommunicationsStore = create<RoomCommunicationsState>((set, get) => ({
  chat: emptyChat,
  journal: emptyJournal,
  unreadHandoutIds: [],
  loadChat: async () => {
    const chat = normalizeSharedRoomChat(await loadSharedResource(ROOM_CHAT_RESOURCE))
    set({ chat })
  },
  loadJournal: async () => {
    const journal = normalizeSharedRoomJournal(await loadSharedResource(ROOM_JOURNAL_RESOURCE))
    set({ journal, unreadHandoutIds: unreadHandouts(journal) })
  },
  sendMessage: async (input) => {
    const result = await mutateSharedRoomResource<SharedRoomChatState>(
      ROOM_CHAT_RESOURCE,
      '/state/room-chat/message',
      input,
    )
    set({ chat: normalizeSharedRoomChat(result) })
  },
  mutateJournal: async (mutation) => {
    const result = await mutateSharedRoomResource<SharedRoomJournalState>(
      ROOM_JOURNAL_RESOURCE,
      '/state/room-journal/mutation',
      mutation,
    )
    const journal = normalizeSharedRoomJournal(result)
    set({ journal, unreadHandoutIds: unreadHandouts(journal) })
  },
  markHandoutsRead: (ids) => {
    const seen = readSeenHandoutIds()
    const target = ids ?? get().journal.handouts.map((entry) => entry.id)
    for (const id of target) seen.add(id)
    writeSeenHandoutIds(seen)
    set({ unreadHandoutIds: unreadHandouts(get().journal) })
  },
  reset: () => set({ chat: emptyChat, journal: emptyJournal, unreadHandoutIds: [] }),
}))
