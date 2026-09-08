import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileCharacterView } from '../../../../packages/mobile-protocol/src'
import { MOBILE_CHARACTER_ALIGNMENT_OPTIONS } from '../character/createMobileCharacter'
import { colors } from '../theme'

export interface MobileCharacterProfilePatch {
  name?: string
  avatar?: string
  portrait?: string
  tokenPortrait?: string
  alignment?: string
  backstory?: string
  notes?: string
}

export function CharacterProfileEditor({ visible, character, busy, onClose, onSave }: {
  visible: boolean
  character: MobileCharacterView
  busy?: boolean
  onClose: () => void
  onSave: (patch: MobileCharacterProfilePatch) => Promise<void>
}) {
  const [draft, setDraft] = useState<Required<MobileCharacterProfilePatch>>({ name: '', avatar: '', portrait: '', tokenPortrait: '', alignment: '', backstory: '', notes: '' })
  const [error, setError] = useState('')
  useEffect(() => {
    if (!visible) return
    setDraft({ name: character.name, avatar: character.avatar, portrait: character.portrait ?? '', tokenPortrait: character.tokenPortrait ?? '', alignment: character.alignment ?? '', backstory: character.backstory ?? '', notes: character.notes ?? '' })
    setError('')
  }, [character, visible])
  const field = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }))
  return <Modal visible={visible} transparent animationType="fade" supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.modal}>
    <View style={styles.header}><View><Text style={styles.title}>编辑人物卡资料</Text><Text style={styles.subtitle}>规则数值与升级收据不会在这里被绕过。</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.row}><Field label="角色名称" value={draft.name} onChange={(value) => field('name', value)} /><Field label="头像字符" value={draft.avatar} onChange={(value) => field('avatar', value)} /></View>
      <Text style={styles.label}>阵营</Text><View style={styles.wrap}>{MOBILE_CHARACTER_ALIGNMENT_OPTIONS.map((alignment) => <Pressable key={alignment} style={[styles.chip, draft.alignment === alignment && styles.chipActive]} onPress={() => field('alignment', alignment)}><Text style={styles.chipText}>{alignment}</Text></Pressable>)}</View>
      <Field label="完整立绘 URL / data URL" value={draft.portrait} onChange={(value) => field('portrait', value)} />
      <Field label="地图 Token 裁切 URL / data URL" value={draft.tokenPortrait} onChange={(value) => field('tokenPortrait', value)} />
      <Field label="背景故事" value={draft.backstory} onChange={(value) => field('backstory', value)} multiline />
      <Field label="角色笔记" value={draft.notes} onChange={(value) => field('notes', value)} multiline />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    <View style={styles.footer}><Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable disabled={busy} style={[styles.save, busy && styles.disabled]} onPress={() => void onSave(draft).catch((cause) => setError(cause instanceof Error ? cause.message : '保存失败'))}><Text style={styles.saveText}>{busy ? '保存中…' : '保存资料'}</Text></Pressable></View>
  </View></View></Modal>
}

function Field({ label, value, onChange, multiline }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={onChange} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[styles.input, multiline && styles.multiline]} placeholderTextColor={colors.muted} /></View>
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#02030ae8', alignItems: 'center', justifyContent: 'center', padding: 20 }, modal: { width: '92%', maxWidth: 960, maxHeight: '90%', borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, overflow: 'hidden' }, header: { paddingHorizontal: 19, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, title: { color: colors.text, fontSize: 20, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 10, marginTop: 3 }, close: { color: colors.muted, fontSize: 28, paddingHorizontal: 8 }, content: { padding: 18, gap: 12 }, row: { flexDirection: 'row', gap: 12 }, field: { flex: 1 }, label: { color: colors.text, fontSize: 11, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 42, color: colors.text, backgroundColor: '#090a17', borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9 }, multiline: { minHeight: 92 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7 }, chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, chipText: { color: colors.text, fontSize: 10, fontWeight: '700' }, footer: { padding: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 9, borderTopWidth: 1, borderTopColor: colors.border }, cancel: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 10 }, cancelText: { color: colors.text, fontWeight: '800' }, save: { backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 20, paddingVertical: 10 }, saveText: { color: '#fff', fontWeight: '900' }, error: { color: '#fecdd3', fontSize: 11 }, disabled: { opacity: .45 },
})
