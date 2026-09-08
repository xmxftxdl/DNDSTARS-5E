import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileCharacterView } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

export function CharacterVitalsEditor({ visible, character, combatActive, busy, onClose, onSave }: {
  visible: boolean
  character: MobileCharacterView
  combatActive: boolean
  busy?: boolean
  onClose: () => void
  onSave: (currentHp: number, temporaryHp: number) => Promise<void>
}) {
  const [currentHp, setCurrentHp] = useState(String(character.currentHp))
  const [temporaryHp, setTemporaryHp] = useState(String(character.tempHp))
  const [error, setError] = useState('')
  useEffect(() => {
    if (!visible) return
    setCurrentHp(String(character.currentHp))
    setTemporaryHp(String(character.tempHp))
    setError('')
  }, [character.currentHp, character.tempHp, visible])
  const save = async () => {
    const nextHp = Number(currentHp)
    const nextTemporaryHp = Number(temporaryHp)
    if (!Number.isSafeInteger(nextHp) || nextHp < 0 || nextHp > character.maxHp) {
      setError(`当前生命值必须是 0–${character.maxHp} 的整数。`)
      return
    }
    if (!Number.isSafeInteger(nextTemporaryHp) || nextTemporaryHp < 0 || nextTemporaryHp > 1_000_000) {
      setError('临时生命值必须是非负整数。')
      return
    }
    try { await onSave(nextHp, nextTemporaryHp) } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
    }
  }
  return <Modal visible={visible} transparent animationType="fade" supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}>
    <View style={styles.backdrop}><View style={styles.modal}>
      <View style={styles.header}><View><Text style={styles.title}>调整生命值</Text><Text style={styles.subtitle}>只修改自己的当前生命值与临时生命值，最大生命值仍由升级与规则决定。</Text></View><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
      <View style={styles.content}>
        {combatActive && <Text style={styles.warning}>战斗中必须通过 Headless 行动、物品或 DM 结算改变生命值。</Text>}
        <View style={styles.row}><Field label={`当前生命值（上限 ${character.maxHp}）`} value={currentHp} onChange={setCurrentHp} /><Field label="临时生命值" value={temporaryHp} onChange={setTemporaryHp} /></View>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
      <View style={styles.footer}><Pressable style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable disabled={busy || combatActive} style={[styles.save, (busy || combatActive) && styles.disabled]} onPress={() => void save()}><Text style={styles.saveText}>{busy ? '保存中…' : '保存生命值'}</Text></Pressable></View>
    </View></View>
  </Modal>
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput value={value} onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.muted} /></View>
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#02030ae8', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '86%', maxWidth: 620, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, overflow: 'hidden' },
  header: { paddingHorizontal: 19, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 10, marginTop: 3 }, close: { color: colors.muted, fontSize: 28, paddingHorizontal: 8 },
  content: { padding: 18, gap: 12 }, row: { flexDirection: 'row', gap: 12 }, field: { flex: 1 }, label: { color: colors.text, fontSize: 11, fontWeight: '800', marginBottom: 6 }, input: { minHeight: 44, color: colors.text, backgroundColor: '#090a17', borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12 },
  warning: { color: '#fde68a', borderWidth: 1, borderColor: '#7c641e', backgroundColor: '#2a230b', borderRadius: 11, padding: 10, fontSize: 11 }, error: { color: '#fecdd3', fontSize: 11 },
  footer: { padding: 14, flexDirection: 'row', justifyContent: 'flex-end', gap: 9, borderTopWidth: 1, borderTopColor: colors.border }, cancel: { borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 18, paddingVertical: 10 }, cancelText: { color: colors.text, fontWeight: '800' }, save: { backgroundColor: colors.primary, borderRadius: 11, paddingHorizontal: 20, paddingVertical: 10 }, saveText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: .4 },
})
