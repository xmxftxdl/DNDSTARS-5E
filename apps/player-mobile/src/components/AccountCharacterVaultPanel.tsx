import { Pressable, StyleSheet, Text, View } from 'react-native'
import type {
  MobileAccountCharacterRecord,
  MobileRoomRules,
} from '../../../../packages/mobile-protocol/src'
import { mobileCharacterCompatibilityForRoom } from '../services/mobileCharacterVault'
import { colors } from '../theme'

export function AccountCharacterVaultPanel({
  records, rules, attachedIds, busy, onAttach,
}: {
  records: MobileAccountCharacterRecord[]
  rules: MobileRoomRules | null
  attachedIds: ReadonlySet<string>
  busy: boolean
  onAttach: (record: MobileAccountCharacterRecord) => Promise<void>
}) {
  if (!records.length) return null
  return <View style={styles.panel}>
    <Text style={styles.title}>账号角色库</Text>
    <Text style={styles.help}>选择账号角色带入当前房间；规则、协议和扩展包会先进行 fail-closed 校验。</Text>
    <View style={styles.list}>{records.map((record) => {
      const compatibility = mobileCharacterCompatibilityForRoom(record, rules)
      const attached = attachedIds.has(record.id)
      const character = record.character
      return <View key={record.id} style={styles.entry}>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.name}>{record.name}</Text>
          <Text style={styles.meta}>{String(character.race ?? '未知种族')} · {String(character.charClass ?? '未知职业')} {Number(character.level) || 1}级</Text>
          <Text numberOfLines={2} style={[styles.status, !compatibility.compatible && styles.invalid]}>{attached ? '已在当前房间' : compatibility.compatible ? (compatibility.warnings[0] || '兼容性校验通过') : compatibility.errors[0]}</Text>
        </View>
        <Pressable disabled={busy || attached || !compatibility.compatible} style={[styles.button, (busy || attached || !compatibility.compatible) && styles.disabled]} onPress={() => void onAttach(record)}><Text style={styles.buttonText}>{attached ? '已带入' : '带入房间'}</Text></Pressable>
      </View>
    })}</View>
  </View>
}

const styles = StyleSheet.create({
  panel: { marginBottom: 12, borderWidth: 1, borderColor: '#195b67', backgroundColor: '#09212a', borderRadius: 16, padding: 13 },
  title: { color: '#a5f3fc', fontWeight: '900', fontSize: 14 },
  help: { color: '#93c5d1', fontSize: 9, lineHeight: 15, marginTop: 4 },
  list: { gap: 8, marginTop: 10 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#174b55', borderRadius: 12, backgroundColor: '#08171d', padding: 10 },
  flex: { flex: 1 }, name: { color: colors.text, fontWeight: '900', fontSize: 12 }, meta: { color: colors.muted, fontSize: 9, marginTop: 3 },
  status: { color: colors.teal, fontSize: 8, marginTop: 3 }, invalid: { color: colors.warning },
  button: { borderWidth: 1, borderColor: colors.teal, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#0b2929' },
  buttonText: { color: '#a7f3d0', fontSize: 9, fontWeight: '900' }, disabled: { opacity: .38 },
})
