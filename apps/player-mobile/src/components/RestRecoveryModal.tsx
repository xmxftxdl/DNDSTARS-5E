import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MobileRestAdvance } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

export function RestRecoveryModal({ advance, onDismiss, onOpenCharacter }: {
  advance: MobileRestAdvance | null
  onDismiss: () => void
  onOpenCharacter: () => void
}) {
  if (!advance) return null
  const shortRest = advance.kind === 'short-rest'
  return <Modal transparent animationType="fade" visible statusBarTranslucent supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onDismiss}>
    <View style={styles.backdrop}>
      <View style={styles.dialog}>
        <Text style={styles.eyebrow}>{shortRest ? '短休完成' : '长休完成'}</Text>
        <Text style={styles.title}>你的角色已完成恢复结算</Text>
        <Text style={styles.meta}>战役分钟 {advance.toWorldMinute}{advance.reason ? ` · ${advance.reason}` : ''}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.reports}>
          {advance.recoveryReports.map((report) => <View key={report.characterId} style={styles.report}>
            <Text style={styles.character}>{report.characterName}</Text>
            {report.entries.map((entry, index) => <View key={`${entry.category}:${entry.label}:${index}`} style={styles.entry}>
              <View style={styles.flex}><Text style={styles.label}>{entry.label}</Text>{entry.detail && <Text style={styles.detail}>{entry.detail}</Text>}</View>
              <Text style={styles.value}>{recoveryValue(entry)}</Text>
            </View>)}
            {!report.entries.length && <Text style={styles.detail}>本次没有自动恢复的资源。</Text>}
          </View>)}
          {shortRest && <Text style={styles.hint}>生命骰与职业短休选择不会由客户端自动代投；请前往角色卡自行决定是否消耗。</Text>}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable style={styles.secondary} onPress={onDismiss}><Text style={styles.secondaryText}>稍后查看</Text></Pressable>
          <Pressable style={styles.primary} onPress={onOpenCharacter}><Text style={styles.primaryText}>打开角色卡</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>
}

function recoveryValue(entry: MobileRestAdvance['recoveryReports'][number]['entries'][number]) {
  if (entry.before != null && entry.after != null) return `${entry.before} → ${entry.after}${entry.maximum != null ? `/${entry.maximum}` : ''}`
  return ({ restored: '已恢复', cleared: '已解除', available: '可使用', unchanged: '无变化', blocked: '未恢复' } as const)[entry.outcome]
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#02030add', alignItems: 'center', justifyContent: 'center', padding: 18 },
  dialog: { width: '100%', maxWidth: 520, maxHeight: '82%', borderRadius: 22, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.elevated, padding: 18 },
  eyebrow: { color: colors.teal, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  meta: { color: colors.muted, fontSize: 10, marginTop: 5 },
  scroll: { marginTop: 14 }, reports: { gap: 10 }, report: { padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  character: { color: colors.text, fontSize: 14, fontWeight: '900', marginBottom: 7 }, entry: { flexDirection: 'row', gap: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, flex: { flex: 1 },
  label: { color: colors.text, fontSize: 11, fontWeight: '800' }, detail: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 2 }, value: { color: colors.teal, fontSize: 10, fontWeight: '900' }, hint: { color: colors.warning, fontSize: 10, lineHeight: 16 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 }, secondary: { flex: 1, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12 }, secondaryText: { color: colors.text, fontWeight: '800' }, primary: { flex: 1, alignItems: 'center', borderRadius: 12, backgroundColor: colors.primary, padding: 12 }, primaryText: { color: '#fff', fontWeight: '900' },
})
