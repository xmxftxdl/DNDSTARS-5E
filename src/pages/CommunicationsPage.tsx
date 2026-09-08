import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ArrowDownUp,
  AudioLines,
  BookMarked,
  BookOpenText,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  Filter,
  Image as ImageIcon,
  LayoutList,
  ListTree,
  LockKeyhole,
  MessageSquareText,
  PenLine,
  Plus,
  Search,
  ScrollText,
  Send,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import VoiceRoomPanel from '../components/VoiceRoomPanel'
import { combatantDamagePerTurn } from '../lib/combatStatistics'
import {
  dnd5eTelepathicBondNetworksForMap,
  type Dnd5eTelepathicBondNetwork,
} from '../lib/dnd5eTelepathicBondCommunications'
import { loadRoomRoster, roomApiErrorMessage, type RoomRosterMember } from '../lib/roomApi'
import {
  type RoomChatChannel,
  type CampaignJournalEntry,
  type RoomHandout,
  type RoomJournalMutation,
  type SharedNoteKind,
} from '../lib/roomCommunications'
import { getRoomSession } from '../lib/roomSession'
import { browserSharedRoomService } from '../composition/browserSharedRoomService'
import { useCombatStatisticsStore } from '../store/combatStatistics'
import { useCharacterStore } from '../store/characters'
import { useMapStore } from '../store/maps'
import { useRoomCommunicationsStore } from '../store/roomCommunications'

type CommunicationsTab = 'voice' | 'chat' | 'handouts' | 'journal' | 'notes'

const tabs: Array<{ id: CommunicationsTab; label: string; icon: typeof MessageSquareText }> = [
  { id: 'voice', label: '房间语音', icon: AudioLines },
  { id: 'chat', label: '文字聊天', icon: MessageSquareText },
  { id: 'handouts', label: '讲义', icon: ScrollText },
  { id: 'journal', label: '战役日志', icon: BookOpenText },
  { id: 'notes', label: '队伍手记', icon: ClipboardList },
]

const channelLabels: Record<RoomChatChannel, string> = {
  ic: 'IC · 角色内',
  ooc: 'OOC · 角色外',
  'dm-private': '私聊 DM',
  'telepathic-bond': '心灵联结',
}

const noteLabels: Record<SharedNoteKind, string> = {
  task: '任务',
  clue: '线索',
  note: '笔记',
}

function formatTime(value: number, includeDate = false): string {
  return new Intl.DateTimeFormat('zh-CN', includeDate
    ? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }).format(value)
}

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error)
  const messages: Record<string, string> = {
    'invalid-roll-command': '骰子指令无效。示例：/roll 2d6+3 搜索暗门',
    'invalid-private-recipient': '请选择当前房间内的私聊玩家。',
    'invalid-npc-persona': '所选 NPC 已不在地图上，请重新选择。',
    'telepathic-sender-not-linked': '当前角色不在这条心灵联结中，或联结已经结束。',
    'telepathic-network-unavailable': '心灵联结当前没有可接收讯息的参与者。',
    'empty-message': '消息不能为空。',
    'invalid-audience': '请至少选择一名讲义接收者。',
    'dm-only': '该操作仅限 DM。',
    'state-too-large': '房间通讯资料已达到容量上限，请先移除旧讲义或日志。',
  }
  return messages[code] ?? code
}

function SharedHandoutImage({ handout }: { handout: RoomHandout }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!handout.imageId) return
    let disposed = false
    let objectUrl = ''
    void browserSharedRoomService.getSharedImage(handout.imageId).then((blob) => {
      if (!blob || disposed) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [handout.imageId])
  if (!handout.imageId) return null
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-xl border border-white/10 bg-black/30">
      <img src={url} alt={handout.imageName ?? handout.title} className="max-h-[520px] w-full object-contain" />
    </a>
  ) : (
    <div className="mt-4 flex h-36 items-center justify-center rounded-xl border border-white/8 bg-black/20 text-sm text-slate-500">
      正在载入讲义图片…
    </div>
  )
}

export default function CommunicationsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const session = useMemo(() => getRoomSession(), [])
  const isDm = session?.role === 'dm'
  const requestedTab = searchParams.get('tab')
  const tab: CommunicationsTab = (
    session?.role === 'spectator'
      ? 'voice'
      : requestedTab === 'voice' || requestedTab === 'handouts' || requestedTab === 'journal' || requestedTab === 'notes'
        ? requestedTab
        : 'chat'
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [roster, setRoster] = useState<RoomRosterMember[]>([])
  const chat = useRoomCommunicationsStore((state) => state.chat)
  const journal = useRoomCommunicationsStore((state) => state.journal)
  const unreadHandoutIds = useRoomCommunicationsStore((state) => state.unreadHandoutIds)
  const sendMessage = useRoomCommunicationsStore((state) => state.sendMessage)
  const mutateJournal = useRoomCommunicationsStore((state) => state.mutateJournal)
  const markHandoutsRead = useRoomCommunicationsStore((state) => state.markHandoutsRead)
  const maps = useMapStore((state) => state.maps)
  const selectedMapId = useMapStore((state) => state.selectedId)
  const characters = useCharacterStore((state) => state.characters)
  const sessions = useCombatStatisticsStore((state) => state.sessions)
  const telepathicNetworks = useMemo(() => dnd5eTelepathicBondNetworksForMap(
    characters,
    maps.find((map) => map.id === selectedMapId),
  ), [characters, maps, selectedMapId])

  const selectTab = (nextTab: CommunicationsTab) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (nextTab === 'chat') nextSearchParams.delete('tab')
    else nextSearchParams.set('tab', nextTab)
    setSearchParams(nextSearchParams, { replace: true })
  }

  useEffect(() => {
    if (!session || !isDm) return
    let disposed = false
    const load = async () => {
      try {
        const next = await loadRoomRoster(session)
        if (!disposed) setRoster(next.players.filter((entry) =>
          entry.role === 'player' && entry.status !== 'removed' && entry.status !== 'left'))
      } catch (cause) {
        if (!disposed) setError(roomApiErrorMessage(cause))
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 10_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [isDm, session])

  useEffect(() => {
    if (tab === 'handouts') markHandoutsRead()
  }, [markHandoutsRead, tab])

  if (!session) return null

  return (
    <div className="mx-auto w-full max-w-[1800px]">
      <PageHeader
        title="通讯与日志"
        description="房间语音、文字聊天、秘密纸条、讲义、战役记录与队伍共享手记。"
      />

      <div className="mb-5 flex flex-wrap gap-2 rounded-2xl border border-white/8 bg-slate-950/45 p-2">
        {tabs.filter(({ id }) => session.role !== 'spectator' || id === 'voice').map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => selectTab(id)}
            className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              tab === id ? 'bg-arcane-500/20 text-arcane-100' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {id === 'handouts' && unreadHandoutIds.length > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-950">
                {unreadHandoutIds.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {tab === 'voice' && <VoiceRoomPanel />}
      {tab === 'chat' && (
        <ChatPanel
          isDm={isDm}
          memberId={session.memberId}
          messages={chat.messages}
          roster={roster}
          maps={maps}
          telepathicNetworks={telepathicNetworks}
          busy={busy}
          onSend={async (input) => {
            setBusy(true)
            setError(null)
            try {
              await sendMessage(input)
            } catch (cause) {
              setError(errorMessage(cause))
              throw cause
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {tab === 'handouts' && (
        <HandoutsPanel
          isDm={isDm}
          handouts={journal.handouts}
          roster={roster}
          busy={busy}
          onMutate={async (mutation) => {
            setBusy(true)
            setError(null)
            try {
              await mutateJournal(mutation)
            } catch (cause) {
              setError(errorMessage(cause))
              throw cause
            } finally {
              setBusy(false)
            }
          }}
        />
      )}
      {tab === 'journal' && (
        <CampaignJournalPanel
          isDm={isDm}
          entries={journal.campaignEntries}
          sessions={sessions}
          maps={maps}
          busy={busy}
          onMutate={async (mutation) => {
            setBusy(true)
            setError(null)
            try { await mutateJournal(mutation) } catch (cause) { setError(errorMessage(cause)); throw cause } finally { setBusy(false) }
          }}
        />
      )}
      {tab === 'notes' && (
        <SharedNotesPanel
          isDm={isDm}
          memberId={session.memberId}
          notes={journal.sharedNotes}
          busy={busy}
          onMutate={async (mutation) => {
            setBusy(true)
            setError(null)
            try { await mutateJournal(mutation) } catch (cause) { setError(errorMessage(cause)); throw cause } finally { setBusy(false) }
          }}
        />
      )}
    </div>
  )
}

function ChatPanel({ isDm, memberId, messages, roster, maps, telepathicNetworks, busy, onSend }: {
  isDm: boolean
  memberId: string
  messages: ReturnType<typeof useRoomCommunicationsStore.getState>['chat']['messages']
  roster: RoomRosterMember[]
  maps: ReturnType<typeof useMapStore.getState>['maps']
  telepathicNetworks: Dnd5eTelepathicBondNetwork[]
  busy: boolean
  onSend: (input: {
    channel: RoomChatChannel
    text: string
    recipientMemberId?: string
    npcTokenId?: string
    telepathicNetworkKey?: string
    telepathicSenderCharacterId?: string
  }) => Promise<void>
}) {
  const [channel, setChannel] = useState<RoomChatChannel>('ic')
  const [text, setText] = useState('')
  const [recipientMemberId, setRecipientMemberId] = useState('')
  const [npcTokenId, setNpcTokenId] = useState('')
  const [telepathicNetworkKey, setTelepathicNetworkKey] = useState('')
  const endRef = useRef<HTMLDivElement | null>(null)
  const npcTokens = useMemo(() => maps.flatMap((map) => map.tokens)
    .filter((token) => token.type === 'npc' || token.type === 'enemy'), [maps])
  const activeTelepathicNetwork = telepathicNetworks.find((network) => network.key === telepathicNetworkKey)
  const telepathicSenderCharacter = activeTelepathicNetwork?.participants.find(
    (participant) => participant.roomMemberId === memberId,
  )
  const visibleMessages = messages.filter((message) =>
    message.channel === channel && (
      channel !== 'telepathic-bond' || message.telepathicNetworkKey === telepathicNetworkKey
    ))

  useEffect(() => {
    if (telepathicNetworks.some((network) => network.key === telepathicNetworkKey)) return
    const first = telepathicNetworks[0]
    setTelepathicNetworkKey(first?.key ?? '')
    if (!first && channel === 'telepathic-bond') setChannel('ic')
  }, [channel, telepathicNetworkKey, telepathicNetworks])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, channel])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!text.trim()) return
    await onSend({
      channel,
      text,
      ...(isDm && channel === 'dm-private' ? { recipientMemberId } : {}),
      ...(isDm && channel === 'ic' && npcTokenId ? { npcTokenId } : {}),
      ...(channel === 'telepathic-bond' && activeTelepathicNetwork && telepathicSenderCharacter ? {
        telepathicNetworkKey: activeTelepathicNetwork.key,
        telepathicSenderCharacterId: telepathicSenderCharacter.id,
      } : {}),
    })
    setText('')
  }

  return (
    <section className="grid min-h-[650px] gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-white/8 bg-slate-950/45 p-3">
        <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600">频道</p>
        {(Object.keys(channelLabels) as RoomChatChannel[]).filter((id) => id !== 'telepathic-bond').map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setChannel(id)
              if (id !== 'ic') setNpcTokenId('')
            }}
            className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
              channel === id ? 'bg-arcane-500/15 text-arcane-100' : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            {id === 'dm-private' ? <LockKeyhole className="h-4 w-4" /> : <MessageSquareText className="h-4 w-4" />}
            {channelLabels[id]}
          </button>
        ))}
        {telepathicNetworks.map((network) => (
          <button
            key={network.key}
            type="button"
            onClick={() => {
              setChannel('telepathic-bond')
              setTelepathicNetworkKey(network.key)
              setNpcTokenId('')
            }}
            className={`mb-1 flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition ${
              channel === 'telepathic-bond' && telepathicNetworkKey === network.key
                ? 'bg-cyan-500/15 text-cyan-100'
                : 'text-slate-400 hover:bg-white/5'
            }`}
          >
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="block font-semibold">心灵联结</strong>
              <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">
                {network.participants.map((participant) => participant.name).join('、')}
              </span>
            </span>
          </button>
        ))}
        <div className="mt-4 rounded-xl border border-white/6 bg-black/20 p-3 text-xs leading-5 text-slate-500">
          输入 <code className="text-arcane-300">/roll 2d6+3</code> 掷骰。骰点由房间服务端生成，公共频道结果同时进入战斗日志。
        </div>
      </aside>

      <div className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-slate-950/45">
        <div className="border-b border-white/8 px-5 py-4">
          <h3 className="font-semibold text-slate-100">
            {channel === 'telepathic-bond' && activeTelepathicNetwork
              ? `心灵联结 · ${activeTelepathicNetwork.participants.map((participant) => participant.name).join('、')}`
              : channelLabels[channel]}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {channel === 'ic' ? '以当前角色身份发言；DM 可以选择地图上的 NPC 代言。' :
              channel === 'ooc' ? '玩家身份的场外讨论。' :
                channel === 'telepathic-bond'
                  ? '同一存在位面内不受距离与共同语言限制；只有当前联结参与者与 DM 可见。'
                  : '只有相关玩家与 DM 能看到这些消息。'}
          </p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {visibleMessages.length === 0 && (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-center text-slate-600">
              <MessageSquareText className="h-9 w-9" />
              <p className="mt-3 text-sm">这个频道还没有消息</p>
            </div>
          )}
          {visibleMessages.map((message) => {
            const own = message.senderMemberId === memberId
            const privatePeer = isDm
              ? roster.find((entry) => entry.memberId === (message.senderRole === 'dm' ? message.recipientMemberId : message.senderMemberId))?.displayName
              : 'DM'
            return (
              <article key={message.id} className={`flex gap-3 ${own ? 'flex-row-reverse' : ''}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-arcane-500/12 text-xl">
                  {message.persona.avatar}
                </div>
                <div className={`max-w-[80%] rounded-2xl border px-4 py-3 ${own ? 'border-arcane-400/20 bg-arcane-500/10' : 'border-white/8 bg-white/[0.035]'}`}>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-200">{message.persona.name}</span>
                    {message.persona.kind === 'npc' && <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-amber-200">NPC</span>}
                    {channel === 'dm-private' && <span className="text-violet-300">与 {privatePeer ?? '玩家'} 的纸条</span>}
                    {channel === 'telepathic-bond' && <span className="text-cyan-300">心灵感应</span>}
                    <span className="text-slate-600">{formatTime(message.createdAt)}</span>
                  </div>
                  {message.roll ? (
                    <div className="mt-2 rounded-xl border border-violet-300/15 bg-violet-500/10 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-mono text-sm text-violet-200">{message.roll.expression}</span>
                        <span className="text-2xl font-black tabular-nums text-amber-200">{message.roll.total}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        骰面 {message.roll.values.join(' + ')}{message.roll.modifier ? ` ${message.roll.modifier > 0 ? '+' : '−'} ${Math.abs(message.roll.modifier)}` : ''}
                      </p>
                      {message.roll.label && <p className="mt-2 text-sm text-slate-200">{message.roll.label}</p>}
                    </div>
                  ) : <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{message.text}</p>}
                </div>
              </article>
            )
          })}
          <div ref={endRef} />
        </div>

        <form onSubmit={(event) => void submit(event).catch(() => {})} className="border-t border-white/8 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {isDm && channel === 'ic' && (
              <select value={npcTokenId} onChange={(event) => setNpcTokenId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                <option value="">以 DM 身份发言</option>
                {npcTokens.map((token) => <option key={token.id} value={token.id}>{token.emoji} {token.label}</option>)}
              </select>
            )}
            {isDm && channel === 'dm-private' && (
              <select required value={recipientMemberId} onChange={(event) => setRecipientMemberId(event.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300">
                <option value="">选择收件玩家…</option>
                {roster.map((player) => <option key={player.memberId} value={player.memberId}>{player.displayName}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              maxLength={1_000}
              rows={2}
              disabled={channel === 'telepathic-bond' && !telepathicSenderCharacter}
              placeholder={channel === 'dm-private'
                ? '写一张只有 DM 与你能看到的纸条…'
                : channel === 'telepathic-bond'
                  ? telepathicSenderCharacter
                    ? `以 ${telepathicSenderCharacter.name} 发送心灵讯息…`
                    : 'DM 可旁观此权威联结，但必须由联结中的角色发送。'
                  : '输入消息，Shift + Enter 换行…'}
              className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-arcane-400/40"
            />
            <button disabled={
              busy || !text.trim() ||
              (isDm && channel === 'dm-private' && !recipientMemberId) ||
              (channel === 'telepathic-bond' && !telepathicSenderCharacter)
            } className="flex w-12 items-center justify-center rounded-xl bg-arcane-500 text-white transition hover:bg-arcane-400 disabled:cursor-not-allowed disabled:opacity-40">
              <Send className="h-5 w-5" />
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}

function HandoutsPanel({ isDm, handouts, roster, busy, onMutate }: {
  isDm: boolean
  handouts: RoomHandout[]
  roster: RoomRosterMember[]
  busy: boolean
  onMutate: (mutation: RoomJournalMutation) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [audienceMode, setAudienceMode] = useState<'all' | 'selected' | 'dm'>('all')
  const [audience, setAudience] = useState<string[]>([])
  const [image, setImage] = useState<File | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || (!body.trim() && !image)) return
    let imageId: string | undefined
    if (image) {
      imageId = `handout-image-${crypto.randomUUID()}`
      if (!await browserSharedRoomService.putSharedImage(imageId, image, 'handout')) throw new Error('讲义图片上传失败')
    }
    try {
      await onMutate({
        operation: 'add-handout',
        title,
        body,
        audience: audienceMode === 'all' ? 'all' : audienceMode === 'dm' ? 'dm' : audience,
        ...(imageId && image ? { imageId, imageMimeType: image.type, imageName: image.name } : {}),
      })
      setTitle('')
      setBody('')
      setImage(null)
    } catch (cause) {
      if (imageId) await browserSharedRoomService.deleteSharedImage(imageId)
      throw cause
    }
  }

  const playerNames = new Map(roster.map((entry) => [entry.memberId, entry.displayName]))
  return (
    <div className="space-y-5">
      {isDm && (
        <form onSubmit={(event) => void submit(event).catch(() => {})} className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.035] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-400/10 p-2 text-amber-200"><Upload className="h-5 w-5" /></div>
            <div><h3 className="font-semibold text-slate-100">分发新讲义</h3><p className="text-xs text-slate-500">文字与图片只会投影给指定玩家。</p></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="讲义标题" className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100" />
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-400 hover:border-arcane-400/30">
              <ImageIcon className="h-4 w-4" />
              <span className="truncate">{image?.name ?? '选择图片（可选）'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
            </label>
          </div>
          <textarea maxLength={20_000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} placeholder="信件正文、线索说明或符号描述…" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100" />
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <select value={audienceMode} onChange={(event) => setAudienceMode(event.target.value as typeof audienceMode)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-slate-300">
              <option value="all">立即分发给全体玩家</option>
              <option value="selected">立即分发给指定玩家</option>
              <option value="dm">保存为 DM 讲义草稿</option>
            </select>
            {audienceMode === 'selected' && roster.map((player) => (
              <label key={player.memberId} className="flex items-center gap-2 text-slate-400">
                <input type="checkbox" checked={audience.includes(player.memberId)} onChange={(event) => setAudience((current) => event.target.checked ? [...current, player.memberId] : current.filter((id) => id !== player.memberId))} />
                {player.displayName}
              </label>
            ))}
            <button disabled={busy || (!body.trim() && !image) || (audienceMode === 'selected' && audience.length === 0)} className="ml-auto rounded-xl bg-amber-400/15 px-4 py-2 font-semibold text-amber-100 hover:bg-amber-400/25 disabled:opacity-40">
              {audienceMode === 'dm' ? '保存草稿' : '分发讲义'}
            </button>
          </div>
        </form>
      )}

      {handouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/8 py-20 text-center text-slate-600"><ScrollText className="mx-auto h-10 w-10" /><p className="mt-3">尚未分发讲义</p></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {[...handouts].reverse().map((handout) => (
            <article key={handout.id} className="rounded-2xl border border-white/8 bg-slate-950/45 p-5">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-bold text-slate-100">{handout.title}</h3><p className="mt-1 text-xs text-slate-600">{formatTime(handout.createdAt, true)} · {handout.authorName}</p></div>
                {isDm && <button type="button" onClick={() => void onMutate({ operation: 'remove-handout', id: handout.id }).then(() => handout.imageId ? browserSharedRoomService.deleteSharedImage(handout.imageId) : undefined)} className="rounded-lg p-2 text-slate-600 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>}
              </div>
              {handout.body && <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{handout.body}</p>}
              <SharedHandoutImage handout={handout} />
              {isDm && <p className="mt-4 text-xs text-violet-300">接收者：{
                handout.audience === 'all'
                  ? '全体玩家'
                  : handout.audience === 'dm'
                    ? 'DM 草稿（尚未发布）'
                    : handout.audience.map((id) => playerNames.get(id) ?? '已离开玩家').join('、')
              }</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

type CampaignJournalView = 'timeline' | 'catalog'

function formatJournalDate(value: number): string {
  const date = new Date(value)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function journalChapterLabel(entry: CampaignJournalEntry): string {
  const explicit = entry.title.match(/^((?:第?[一二三四五六七八九十百零〇0-9]+[幕章卷]|序章|终章))\s*[·:：—-]/)?.[1]
  if (explicit) return explicit
  return entry.source === 'combat-summary' ? '战斗纪要' : '冒险篇章'
}

function journalExcerpt(body: string, maximum = 220): string {
  const compact = body.replace(/\s+/g, ' ').trim()
  return compact.length > maximum ? `${compact.slice(0, maximum)}…` : compact
}

function journalVolume(value: number): string {
  return String(value).padStart(2, '0')
}

export function CampaignJournalPanel({ isDm, entries, sessions, maps, busy, onMutate }: {
  isDm: boolean
  entries: readonly CampaignJournalEntry[]
  sessions: ReturnType<typeof useCombatStatisticsStore.getState>['sessions']
  maps: ReturnType<typeof useMapStore.getState>['maps']
  busy: boolean
  onMutate: (mutation: RoomJournalMutation) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [chapterFilter, setChapterFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [newestFirst, setNewestFirst] = useState(true)
  const [view, setView] = useState<CampaignJournalView>('timeline')
  const [expandedEntryId, setExpandedEntryId] = useState<string>()
  const orderedSessions = [...sessions].sort((left, right) => right.updatedAt - left.updatedAt)
  const latest = orderedSessions[0]
  const mapName = latest ? maps.find((map) => map.id === latest.mapId)?.name ?? '未命名地图' : ''
  const volumeById = useMemo(() => new Map(
    [...entries]
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
      .map((entry, index) => [entry.id, index + 1]),
  ), [entries])
  const availableChapters = useMemo(() => [...new Set(entries.map(journalChapterLabel))], [entries])
  const visibleEntries = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('zh-CN')
    return [...entries]
      .filter((entry) => chapterFilter === 'all' || journalChapterLabel(entry) === chapterFilter)
      .filter((entry) => !dateFilter || formatJournalDate(entry.createdAt) === dateFilter)
      .filter((entry) => !search || `${entry.title}\n${entry.body}\n${entry.authorName}`.toLocaleLowerCase('zh-CN').includes(search))
      .sort((left, right) => newestFirst
        ? right.createdAt - left.createdAt || right.id.localeCompare(left.id)
        : left.createdAt - right.createdAt || left.id.localeCompare(right.id))
  }, [chapterFilter, dateFilter, entries, newestFirst, query])
  const chapterGroups = useMemo(() => {
    const groups = new Map<string, CampaignJournalEntry[]>()
    for (const entry of visibleEntries) {
      const chapter = journalChapterLabel(entry)
      groups.set(chapter, [...(groups.get(chapter) ?? []), entry])
    }
    return [...groups.entries()]
  }, [visibleEntries])

  const useCombatSummary = () => {
    if (!latest) return
    const startOfToday = new Date().setHours(0, 0, 0, 0)
    const selectedSessions = orderedSessions.filter((entry) => entry.startedAt >= startOfToday)
    const source = selectedSessions.length > 0 ? [...selectedSessions].reverse() : [latest]
    setTitle(selectedSessions.length > 1 ? `${new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(Date.now())} · 团务战斗纪要` : `${mapName} · 战斗纪要`)
    setBody(source.flatMap((combat, index) => {
      const combatMapName = maps.find((map) => map.id === combat.mapId)?.name ?? '未命名地图'
      const combatants = Object.values(combat.combatants).sort((a, b) => b.damageDealt - a.damageDealt)
      const settlement = combat.experienceSettlement
      return [
        ...(index > 0 ? ['', '---', ''] : []),
        `${combatMapName} · ${formatTime(combat.startedAt, true)}`,
        `战斗轮数：${combat.lastRound}`,
        settlement ? `经验结算：${settlement.awardedXp}/${settlement.totalXp} XP` : '经验结算：尚未结算',
        '参战统计：',
        ...combatants.map((entry) => `- ${entry.name}：每回合伤害 ${combatantDamagePerTurn(entry).toFixed(1)}，有效伤害 ${entry.damageDealt}，承伤 ${entry.damageTaken}，治疗 ${entry.healingDone}，减伤 ${entry.damagePrevented}，击倒/击杀 ${entry.knockouts}/${entry.kills}`),
      ]
    }).join('\n'))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onMutate({ operation: 'add-campaign-entry', title, body, source: title.endsWith('战斗纪要') ? 'combat-summary' : 'dm', ...(latest && title.endsWith('战斗纪要') ? { combatId: latest.combatId } : {}) })
    setTitle('')
    setBody('')
    setComposerOpen(false)
  }

  const deleteEntryButton = (entry: CampaignJournalEntry) => isDm ? (
    <button
      type="button"
      onClick={() => void onMutate({ operation: 'remove-campaign-entry', id: entry.id })}
      className="rounded-lg border border-transparent p-2 text-slate-600 transition hover:border-red-400/20 hover:bg-red-500/10 hover:text-red-300"
      aria-label={`删除篇章：${entry.title}`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  ) : null

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-500/[0.08] via-slate-950/55 to-slate-950/75">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-xl border border-amber-300/20 bg-amber-500/10 p-2.5 text-amber-300">
            <BookMarked className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-serif text-2xl font-black tracking-wide text-slate-100">战报篇章</h2>
              <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] font-semibold text-slate-500">共 {entries.length} 篇</span>
            </div>
            <p className="mt-1 text-sm italic text-slate-500">在命运的卷册上，记录每一次掷骰、抉择与未竟之事。</p>
          </div>
        </div>
        {isDm ? (
          <button
            type="button"
            aria-expanded={composerOpen}
            onClick={() => setComposerOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/10 px-4 py-2.5 text-sm font-bold text-amber-100 shadow-lg shadow-black/20 transition hover:bg-amber-400/20"
          >
            {composerOpen ? <X className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
            {composerOpen ? '收起编辑器' : '撰写新篇章'}
          </button>
        ) : null}
      </div>

      {isDm && composerOpen ? (
        <form onSubmit={(event) => void submit(event).catch(() => {})} className="border-t border-amber-300/10 bg-black/15 px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-100">记录本次团务</h3>
              <p className="mt-1 text-xs text-slate-500">标题可使用“第三幕·失落矿坑”格式，章节目录会自动归类。</p>
            </div>
            {latest ? (
              <button type="button" onClick={useCombatSummary} className="flex items-center gap-2 rounded-xl border border-violet-300/15 bg-violet-500/10 px-3 py-2 text-sm text-violet-200 transition hover:bg-violet-500/20">
                <Sparkles className="h-4 w-4" />生成战斗摘要
              </button>
            ) : null}
          </div>
          <input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题，例如：第三幕·失落矿坑" className="mt-4 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-amber-300/35" />
          <textarea required maxLength={40_000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder="剧情记录、重要决定、人物变化、未解决线索与待续事件…" className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm leading-7 text-slate-100 outline-none transition focus:border-amber-300/35" />
          <div className="mt-3 flex justify-end"><button disabled={busy || !title.trim() || !body.trim()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40">保存篇章</button></div>
        </form>
      ) : null}
    </section>

    <section aria-label="战役日志筛选" className="rounded-2xl border border-white/8 bg-slate-950/50 p-3 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-2 lg:flex-row">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索战报标题、正文或记录者…"
            className="w-full rounded-xl border border-white/8 bg-black/20 py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-amber-300/25"
          />
        </label>
        <label className="relative flex items-center rounded-xl border border-white/8 bg-black/20 text-sm text-slate-400">
          <Filter className="pointer-events-none ml-3 h-4 w-4 text-slate-600" />
          <select aria-label="筛选章节" value={chapterFilter} onChange={(event) => setChapterFilter(event.target.value)} className="appearance-none bg-transparent py-2.5 pl-2 pr-9 outline-none">
            <option value="all">全部章节</option>
            {availableChapters.map((chapter) => <option key={chapter} value={chapter}>{chapter}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-600" />
        </label>
        <label className="relative flex items-center rounded-xl border border-white/8 bg-black/20 text-sm text-slate-400">
          <CalendarDays className="pointer-events-none ml-3 h-4 w-4 text-slate-600" />
          <input aria-label="筛选日期" type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="min-w-[9.5rem] bg-transparent py-2.5 pl-2 pr-3 text-slate-400 outline-none [color-scheme:dark]" />
          {dateFilter ? <button type="button" aria-label="清除日期筛选" onClick={() => setDateFilter('')} className="mr-2 rounded p-1 text-slate-600 transition hover:bg-white/5 hover:text-slate-300"><X className="h-3.5 w-3.5" /></button> : null}
        </label>
        <button type="button" onClick={() => setNewestFirst((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5 text-sm text-slate-400 transition hover:border-amber-300/20 hover:text-amber-200">
          <ArrowDownUp className="h-4 w-4" />{newestFirst ? '最新优先' : '最早优先'}
        </button>
      </div>
    </section>

    <div role="tablist" aria-label="战役日志视图" className="mx-auto flex w-fit rounded-xl border border-white/8 bg-slate-950/50 p-1">
      <button type="button" role="tab" aria-selected={view === 'timeline'} onClick={() => setView('timeline')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${view === 'timeline' ? 'bg-amber-400/12 text-amber-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
        <ListTree className="h-4 w-4" />剧情时间轴
      </button>
      <button type="button" role="tab" aria-selected={view === 'catalog'} onClick={() => setView('catalog')} className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${view === 'catalog' ? 'bg-amber-400/12 text-amber-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
        <LayoutList className="h-4 w-4" />章节目录
      </button>
    </div>

    {visibleEntries.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-white/8 py-20 text-center text-slate-600">
        <FileText className="mx-auto h-10 w-10" />
        <p className="mt-3 font-semibold text-slate-400">{entries.length === 0 ? '还没有战役日志' : '没有符合筛选条件的篇章'}</p>
        <p className="mt-1 text-xs">{entries.length === 0 ? '下一次冒险结束后，从这里写下第一篇战报。' : '尝试清除搜索内容或切换篇章类型。'}</p>
      </div>
    ) : view === 'timeline' ? (
      <div role="tabpanel" aria-label="剧情时间轴" className="relative space-y-4 pl-5 before:absolute before:bottom-6 before:left-[7px] before:top-6 before:w-px before:bg-gradient-to-b before:from-amber-400/60 before:via-amber-400/20 before:to-transparent sm:pl-8">
        {visibleEntries.map((entry) => {
          const expanded = expandedEntryId === entry.id
          const volume = volumeById.get(entry.id) ?? 1
          const excerpt = journalExcerpt(entry.body)
          return (
            <div key={entry.id} className="relative">
              <span className="absolute -left-[18px] top-7 h-3 w-3 rounded-full border-2 border-void-950 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.65)] sm:-left-[27px]" />
              <article className="overflow-hidden rounded-2xl border border-white/9 bg-slate-950/55 shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:border-amber-300/20">
                <div className="flex flex-col sm:flex-row">
                <div className="flex shrink-0 items-center justify-between border-b border-white/8 bg-gradient-to-br from-black/70 to-amber-950/30 px-4 py-3 sm:w-24 sm:flex-col sm:justify-center sm:border-b-0 sm:border-r sm:px-3 sm:py-5">
                  <span className="text-[9px] font-black tracking-[0.28em] text-slate-600">VOL</span>
                  <strong className="font-serif text-2xl text-amber-300 sm:mt-1 sm:text-3xl">{journalVolume(volume)}</strong>
                </div>
                <div className="min-w-0 flex-1 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-serif text-lg font-bold text-slate-100">{entry.title}</h3>
                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${entry.source === 'combat-summary' ? 'bg-violet-400/10 text-violet-200' : 'bg-amber-400/10 text-amber-200'}`}>{entry.source === 'combat-summary' ? '战斗纪要' : 'DM 手记'}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-amber-400/70" />{formatJournalDate(entry.createdAt)}</span>
                        <span>{journalChapterLabel(entry)}</span>
                        <span>{entry.authorName}</span>
                      </div>
                    </div>
                    {deleteEntryButton(entry)}
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{expanded ? entry.body : excerpt}</p>
                  {entry.body.replace(/\s+/g, ' ').trim().length > 220 ? (
                    <button type="button" onClick={() => setExpandedEntryId(expanded ? undefined : entry.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-300/80 transition hover:text-amber-200">
                      {expanded ? '收起篇章' : '阅读全文'}<ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  ) : null}
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </div>
    ) : (
      <div role="tabpanel" aria-label="章节目录" className="space-y-4">
        {chapterGroups.map(([chapter, chapterEntries]) => (
          <section key={chapter} className="overflow-hidden rounded-2xl border border-white/9 bg-slate-950/55 shadow-xl shadow-black/10">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.025] px-4 py-3 sm:px-5">
              <h3 className="flex items-center gap-2 font-serif font-bold text-slate-200"><BookMarked className="h-4 w-4 text-amber-300" />{chapter}</h3>
              <span className="rounded-full border border-white/8 bg-black/20 px-2.5 py-1 text-[10px] text-slate-500">{chapterEntries.length} 篇记录</span>
            </div>
            <div className="divide-y divide-white/[0.06] px-3 sm:px-4">
              {chapterEntries.map((entry) => {
                const expanded = expandedEntryId === entry.id
                return <div key={entry.id} className="py-1">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setExpandedEntryId(expanded ? undefined : entry.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-white/[0.025]">
                      <span className="shrink-0 rounded bg-white/5 px-2 py-1 font-mono text-[10px] font-bold text-amber-300/75">#{journalVolume(volumeById.get(entry.id) ?? 1)}</span>
                      <span className="truncate text-sm font-semibold text-slate-300">{entry.title}</span>
                      <span className="min-w-6 flex-1 border-b border-dotted border-white/10" />
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-600">{formatJournalDate(entry.createdAt)}</span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-600 transition ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {deleteEntryButton(entry)}
                  </div>
                  {expanded ? <div className="mx-2 mb-3 rounded-xl border border-amber-300/10 bg-amber-500/[0.035] px-4 py-3"><p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{entry.body}</p><p className="mt-3 text-[10px] text-slate-600">{entry.authorName} · {formatTime(entry.createdAt, true)}</p></div> : null}
                </div>
              })}
            </div>
          </section>
        ))}
      </div>
    )}
  </div>
}

function SharedNotesPanel({ isDm, memberId, notes, busy, onMutate }: {
  isDm: boolean
  memberId: string
  notes: ReturnType<typeof useRoomCommunicationsStore.getState>['journal']['sharedNotes']
  busy: boolean
  onMutate: (mutation: RoomJournalMutation) => Promise<void>
}) {
  const [kind, setKind] = useState<SharedNoteKind>('task')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await onMutate({ operation: 'add-shared-note', kind, title, body })
    setTitle('')
    setBody('')
  }
  return <div className="space-y-5">
    <form onSubmit={(event) => void submit(event).catch(() => {})} className="rounded-2xl border border-white/8 bg-slate-950/45 p-5">
      <div className="flex items-center gap-2"><select value={kind} onChange={(event) => setKind(event.target.value as SharedNoteKind)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-slate-300"><option value="task">任务</option><option value="clue">线索</option><option value="note">笔记</option></select><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="标题" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100" /><button disabled={busy || !title.trim()} className="flex items-center gap-2 rounded-xl bg-arcane-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"><Plus className="h-4 w-4" />添加</button></div>
      <textarea maxLength={20_000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="补充说明（可选）" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-slate-100" />
    </form>
    {notes.length === 0 ? <div className="rounded-2xl border border-dashed border-white/8 py-20 text-center text-slate-600"><Users className="mx-auto h-10 w-10" /><p className="mt-3">队伍共享板还是空的</p></div> : <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{[...notes].sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.updatedAt - a.updatedAt).map((note) => <article key={note.id} className={`rounded-2xl border p-4 ${note.status === 'done' ? 'border-emerald-300/10 bg-emerald-500/[0.03] opacity-70' : 'border-white/8 bg-slate-950/45'}`}><div className="flex items-start gap-3"><button type="button" onClick={() => void onMutate({ operation: 'update-shared-note', id: note.id, status: note.status === 'done' ? 'open' : 'done' })} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${note.status === 'done' ? 'border-emerald-300/30 bg-emerald-400/15 text-emerald-200' : 'border-white/15 text-transparent hover:text-slate-400'}`}><Check className="h-4 w-4" /></button><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">{noteLabels[note.kind]}</span><h3 className={`font-semibold text-slate-100 ${note.status === 'done' ? 'line-through' : ''}`}>{note.title}</h3></div>{note.body && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-400">{note.body}</p>}<p className="mt-3 text-[11px] text-slate-600">{note.lastEditorName} · {formatTime(note.updatedAt, true)}</p></div>{(isDm || note.authorMemberId === memberId) && <button type="button" onClick={() => void onMutate({ operation: 'remove-shared-note', id: note.id })} className="rounded-lg p-1.5 text-slate-600 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>}</div></article>)}</div>}
  </div>
}
