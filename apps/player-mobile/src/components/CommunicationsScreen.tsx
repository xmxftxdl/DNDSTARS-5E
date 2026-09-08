import { type ReactNode, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobilePlayerWorkspace } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

export function CommunicationsScreen({ workspace, onSendChat, onMutateJournal, voicePanel }: {
  workspace: MobilePlayerWorkspace
  onSendChat: (channel: 'ic' | 'ooc' | 'dm-private', text: string) => Promise<void>
  onMutateJournal: (mutation: Record<string, unknown>) => Promise<void>
  voicePanel?: ReactNode
}) {
  const [tab, setTab] = useState<'chat' | 'log' | 'campaign' | 'journal'>('chat')
  const [channel, setChannel] = useState<'ic' | 'ooc' | 'dm-private'>('ic')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [diceCount, setDiceCount] = useState('1')
  const [diceModifier, setDiceModifier] = useState('0')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [noteKind, setNoteKind] = useState<'task' | 'clue' | 'note'>('note')
  const [editingNoteId, setEditingNoteId] = useState('')
  const [expandedCampaignEntry, setExpandedCampaignEntry] = useState('')
  const messages = useMemo(() => workspace.chat.filter((message) => message.channel === channel).slice(-100), [channel, workspace.chat])
  const send = async () => {
    if (!text.trim()) return
    setSending(true)
    try { await onSendChat(channel, text); setText('') } finally { setSending(false) }
  }
  return <View style={styles.page}>
    <View style={styles.tabs}>{([['chat', '聊天'], ['log', '战斗'], ['campaign', '战役篇章'], ['journal', '讲义笔记']] as const).map(([id, label]) => <Pressable key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}><Text style={styles.tabText}>{label}</Text></Pressable>)}</View>
    {tab === 'chat' && <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.chatContent}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
    >
      {voicePanel}
      <View style={styles.dicePanel}><View style={styles.diceHead}><Text style={styles.diceTitle}>自由投骰</Text><View style={styles.diceInputs}><TextInput value={diceCount} onChangeText={setDiceCount} keyboardType="number-pad" style={styles.diceInput} /><Text style={styles.diceSign}>枚</Text><TextInput value={diceModifier} onChangeText={setDiceModifier} keyboardType="numbers-and-punctuation" style={styles.diceInput} /><Text style={styles.diceSign}>调整值</Text></View></View><ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.diceButtons}>{[4, 6, 8, 10, 12, 20, 100].map((sides) => <Pressable key={sides} style={styles.dieButton} onPress={() => void sendDice(sides)}><Text style={styles.dieButtonText}>d{sides}</Text></Pressable>)}</ScrollView></View>
      <View style={styles.channels}>{([['ic', '角色内'], ['ooc', '角色外'], ['dm-private', '私聊 DM']] as const).map(([id, label]) => <Pressable key={id} style={[styles.channel, channel === id && styles.channelActive]} onPress={() => setChannel(id)}><Text style={styles.channelText}>{label}</Text></Pressable>)}</View>
      <View style={styles.list}>{messages.map((message) => <View key={message.id} style={[styles.message, message.senderMemberId === workspace.room.memberId && styles.own]}><View style={styles.messageHead}><Text style={styles.sender}>{message.persona?.name || message.senderDisplayName}</Text><Text style={styles.time}>{new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text></View><Text style={styles.body}>{message.text}</Text>{message.roll && <Text style={styles.roll}>🎲 {message.roll.expression} = {message.roll.total}（{message.roll.values.join('、')}）</Text>}</View>)}</View>
      <View style={styles.compose}><TextInput value={text} onChangeText={setText} placeholder="输入消息；支持 /roll 2d6+3" placeholderTextColor={colors.muted} multiline style={styles.input} /><Pressable disabled={sending || !text.trim()} style={[styles.send, (sending || !text.trim()) && styles.disabled]} onPress={() => void send()}><Text style={styles.sendText}>发送</Text></Pressable></View>
    </ScrollView>}
    {tab === 'log' && <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>{workspace.combatLog.slice().reverse().map((entry) => <View key={entry.id} style={styles.log}><Text style={styles.logHead}>R{entry.round} · {entry.time}</Text><Text style={styles.logText}>{entry.text}</Text>{entry.details?.map((detail, index) => <Text key={index} style={styles.detail}>• {detail}</Text>)}</View>)}</ScrollView>}
    {tab === 'campaign' && <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>{workspace.campaignJournal.map((entry) => { const expanded = entry.id === expandedCampaignEntry; return <Pressable key={entry.id} style={styles.chapter} onPress={() => setExpandedCampaignEntry(expanded ? '' : entry.id)}><View style={styles.chapterHead}><View style={styles.flex}><Text style={styles.chapterTitle}>{entry.title}</Text><Text style={styles.chapterMeta}>{entry.source === 'combat-summary' ? '战斗纪要' : '团务手记'}{entry.authorName ? ` · ${entry.authorName}` : ''} · {new Date(entry.createdAt).toLocaleDateString('zh-CN')}</Text></View><Text style={styles.chapterChevron}>{expanded ? '⌃' : '⌄'}</Text></View><Text numberOfLines={expanded ? undefined : 4} style={styles.chapterBody}>{entry.body}</Text></Pressable> })}{!workspace.campaignJournal.length && <Text style={styles.empty}>DM 尚未发布战役篇章。</Text>}</ScrollView>}
    {tab === 'journal' && <ScrollView style={styles.scroll} contentContainerStyle={styles.list}><View style={styles.noteComposer}><Text style={styles.handoutTitle}>{editingNoteId ? '编辑我的共享笔记' : '新增队伍共享笔记'}</Text><View style={styles.noteKinds}>{([['note', '笔记'], ['task', '任务'], ['clue', '线索']] as const).map(([id, label]) => <Pressable key={id} style={[styles.noteKind, noteKind === id && styles.noteKindActive]} onPress={() => setNoteKind(id)}><Text style={styles.noteKindText}>{label}</Text></Pressable>)}</View><TextInput value={noteTitle} onChangeText={setNoteTitle} placeholder="标题" placeholderTextColor={colors.muted} style={styles.input} /><TextInput value={noteBody} onChangeText={setNoteBody} placeholder="内容（可留空）" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.noteBodyInput]} /><View style={styles.noteActions}><Pressable disabled={!noteTitle.trim() || sending} style={[styles.send, (!noteTitle.trim() || sending) && styles.disabled]} onPress={() => void saveNote()}><Text style={styles.sendText}>{editingNoteId ? '保存修改' : '添加笔记'}</Text></Pressable>{editingNoteId && <Pressable style={styles.cancelEdit} onPress={clearNoteDraft}><Text style={styles.cancelEditText}>取消编辑</Text></Pressable>}</View></View>{workspace.handouts.map((entry) => <View key={entry.id} style={styles.handout}>{entry.imageSource && <Image source={entry.imageSource} resizeMode="contain" style={styles.handoutImage} />}<Text style={styles.handoutTitle}>{entry.title}</Text><Text style={styles.handoutBody}>{entry.body}</Text><Text style={styles.noteMeta}>DM 讲义</Text></View>)}{workspace.sharedNotes.map((entry) => { const owned = entry.authorMemberId === workspace.room.memberId; return <View key={entry.id} style={[styles.handout, entry.status === 'done' && styles.noteDone]}><Text style={styles.handoutTitle}>{entry.status === 'done' ? '✓ ' : ''}{entry.title}</Text><Text style={styles.handoutBody}>{entry.body}</Text><Text style={styles.noteMeta}>{noteKindLabel(entry.kind)} · {entry.status === 'done' ? '已完成' : '进行中'}{entry.authorName ? ` · ${entry.authorName}` : ''}</Text>{owned && <View style={styles.noteActions}><Pressable style={styles.noteButton} onPress={() => void propsMutate({ operation: 'update-shared-note', id: entry.id, status: entry.status === 'done' ? 'open' : 'done' })}><Text style={styles.noteButtonText}>{entry.status === 'done' ? '重新打开' : '标记完成'}</Text></Pressable><Pressable style={styles.noteButton} onPress={() => { setEditingNoteId(entry.id); setNoteTitle(entry.title); setNoteBody(entry.body); setNoteKind(entry.kind) }}><Text style={styles.noteButtonText}>编辑</Text></Pressable><Pressable style={[styles.noteButton, styles.deleteNote]} onPress={() => void propsMutate({ operation: 'remove-shared-note', id: entry.id })}><Text style={styles.deleteText}>删除</Text></Pressable></View>}</View> })}{!workspace.handouts.length && !workspace.sharedNotes.length && <Text style={styles.empty}>DM 尚未分发讲义；你可以先建立队伍共享笔记。</Text>}</ScrollView>}
  </View>

  async function sendDice(sides: number) {
    const count = Math.max(1, Math.min(100, Math.floor(Number(diceCount) || 1)))
    const modifier = Math.max(-999, Math.min(999, Math.floor(Number(diceModifier) || 0)))
    setSending(true)
    try { await onSendChat(channel, `/roll ${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? modifier : ''}`) } finally { setSending(false) }
  }

  function clearNoteDraft() { setEditingNoteId(''); setNoteTitle(''); setNoteBody(''); setNoteKind('note') }
  async function propsMutate(mutation: Record<string, unknown>) {
    setSending(true)
    try { await onMutateJournal(mutation) } finally { setSending(false) }
  }
  async function saveNote() {
    if (!noteTitle.trim()) return
    await propsMutate(editingNoteId
      ? { operation: 'update-shared-note', id: editingNoteId, kind: noteKind, title: noteTitle.trim(), body: noteBody.trim() }
      : { operation: 'add-shared-note', kind: noteKind, title: noteTitle.trim(), body: noteBody.trim() })
    clearNoteDraft()
  }
}

function noteKindLabel(value: 'task' | 'clue' | 'note') { return ({ task: '任务', clue: '线索', note: '笔记' } as const)[value] }

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, tabs: { flexDirection: 'row', gap: 5, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border }, tab: { flex: 1, alignItems: 'center', paddingHorizontal: 4, paddingVertical: 9, borderRadius: 10 }, tabActive: { backgroundColor: colors.primarySoft }, tabText: { color: colors.text, fontSize: 9, fontWeight: '900' }, channels: { flexDirection: 'row', gap: 7, paddingTop: 8 }, channel: { paddingHorizontal: 11, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 999 }, channelActive: { borderColor: colors.teal, backgroundColor: '#0b2b2a' }, channelText: { color: colors.text, fontSize: 9, fontWeight: '800' }, scroll: { flex: 1 }, chatContent: { padding: 10, paddingBottom: 30 }, list: { paddingVertical: 10, gap: 8 },
  dicePanel: { marginTop: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 10 }, diceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, diceTitle: { color: colors.text, fontSize: 11, fontWeight: '900' }, diceInputs: { flexDirection: 'row', alignItems: 'center', gap: 5 }, diceInput: { minWidth: 42, color: colors.text, textAlign: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 5 }, diceSign: { color: colors.muted, fontSize: 8 }, diceButtons: { gap: 6, paddingTop: 9 }, dieButton: { minWidth: 40, alignItems: 'center', borderWidth: 1, borderColor: colors.teal, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 7 }, dieButtonText: { color: colors.teal, fontWeight: '900', fontSize: 10 },
  message: { maxWidth: '88%', alignSelf: 'flex-start', padding: 11, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, own: { alignSelf: 'flex-end', borderColor: colors.primary, backgroundColor: colors.primarySoft }, messageHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 14 }, sender: { color: colors.text, fontWeight: '900', fontSize: 11 }, time: { color: colors.muted, fontSize: 9 }, body: { color: '#e8e4f0', fontSize: 12, lineHeight: 18, marginTop: 5 }, roll: { color: colors.teal, fontWeight: '900', marginTop: 6, fontSize: 11 },
  compose: { flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: colors.border }, input: { flex: 1, maxHeight: 88, minHeight: 42, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 }, send: { alignSelf: 'flex-end', backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 15, paddingVertical: 12 }, sendText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: .4 },
  log: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 11 }, logHead: { color: colors.primary, fontSize: 9, fontWeight: '900' }, logText: { color: colors.text, fontWeight: '800', fontSize: 12, lineHeight: 18, marginTop: 4 }, detail: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 3 }, handout: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 15, padding: 13 }, handoutImage: { width: '100%', height: 220, borderRadius: 11, backgroundColor: '#070711', marginBottom: 11 }, handoutTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, handoutBody: { color: '#d9d5e5', fontSize: 12, lineHeight: 19, marginTop: 7 }, noteMeta: { color: colors.teal, fontSize: 9, marginTop: 7 }, empty: { color: colors.muted, padding: 20, textAlign: 'center' },
  noteComposer: { borderWidth: 1, borderColor: colors.teal, backgroundColor: '#0b2424', borderRadius: 15, padding: 13, gap: 9 }, noteKinds: { flexDirection: 'row', gap: 7 }, noteKind: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, noteKindActive: { borderColor: colors.teal, backgroundColor: '#123735' }, noteKindText: { color: colors.text, fontSize: 9, fontWeight: '800' }, noteBodyInput: { minHeight: 72, textAlignVertical: 'top' }, noteActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 9 }, noteButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6 }, noteButtonText: { color: colors.text, fontSize: 9, fontWeight: '800' }, cancelEdit: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 }, cancelEditText: { color: colors.muted, fontWeight: '800', fontSize: 9 }, deleteNote: { borderColor: colors.danger }, deleteText: { color: colors.danger, fontSize: 9, fontWeight: '900' }, noteDone: { opacity: .72 },
  chapter: { borderWidth: 1, borderColor: '#7157a8', backgroundColor: colors.surface, borderRadius: 15, padding: 13 }, chapterHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 }, chapterTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, chapterMeta: { color: colors.warning, fontSize: 9, marginTop: 4 }, chapterChevron: { color: colors.primary, fontSize: 17 }, chapterBody: { color: '#d9d5e5', fontSize: 12, lineHeight: 20, marginTop: 10 },
})
