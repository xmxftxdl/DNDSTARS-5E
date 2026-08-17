import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MobileCharacterFeatureView, MobileCharacterView } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

const sourceLabels: Record<MobileCharacterFeatureView['source'], string> = {
  class: '职业', subclass: '子职', race: '种族', background: '背景', feat: '专长', plugin: '扩展',
}
const automationLabels = { full: '完整 Headless', partial: '部分 Headless', manual: 'DM 裁定' }

export function CharacterFeaturesPanel({ character }: { character: MobileCharacterView }) {
  const [expanded, setExpanded] = useState('')
  const features = character.features ?? []
  if (!features.length) return <View style={styles.empty}><Text style={styles.emptyTitle}>尚无可展示的结构化特性</Text><Text style={styles.muted}>若角色使用扩展规则包，请确认房间规则包已下载并激活；未载入能力不会被静默结算。</Text></View>
  const groups = new Map<string, MobileCharacterFeatureView[]>()
  for (const feature of features) groups.set(feature.sourceLabel, [...(groups.get(feature.sourceLabel) ?? []), feature])
  return <View style={styles.groups}>{[...groups].map(([label, entries]) => <View key={label} style={styles.group}><Text style={styles.groupTitle}>{label}</Text>{entries.map((feature) => {
    const open = expanded === feature.id
    return <Pressable key={feature.id} style={styles.feature} onPress={() => setExpanded(open ? '' : feature.id)}><View style={styles.heading}><View style={styles.flex}><Text style={styles.name}>{feature.name}</Text><Text style={styles.meta}>{sourceLabels[feature.source]}{feature.level ? ` · ${feature.level}级` : ''}{feature.automation ? ` · ${automationLabels[feature.automation]}` : ''}</Text></View><Text style={styles.chevron}>{open ? '⌃' : '⌄'}</Text></View>{open && <View style={styles.detail}><Text style={styles.description}>{feature.description}</Text>{feature.automationReasons?.map((reason) => <Text key={reason} style={styles.reason}>• {reason}</Text>)}</View>}</Pressable>
  })}</View>)}</View>
}

export function CharacterAdvancementHistory({ character }: { character: MobileCharacterView }) {
  const records = character.levelAdvancements ?? []
  if (!records.length) return <View style={styles.empty}><Text style={styles.muted}>该角色还没有逐级升级记录；后续每次升级会保存职业、生命值、选择和授予特性的审计收据。</Text></View>
  return <View style={styles.groups}>{records.map((record) => <View key={record.id} style={styles.record}><View style={styles.heading}><Text style={styles.name}>{record.fromLevel} → {record.toLevel}级</Text><Text style={styles.meta}>{record.completedBy === 'dm' ? 'DM 修订' : '玩家确认'} · {new Date(record.completedAt).toLocaleDateString('zh-CN')}</Text></View><Text style={styles.recordClass}>{record.className} {record.fromClassLevel} → {record.toClassLevel}级</Text>{record.grantedFeatures.length > 0 && <Text style={styles.muted}>获得：{record.grantedFeatures.map((feature) => feature.name).join('、')}</Text>}</View>)}</View>
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, groups: { gap: 10 }, group: { borderWidth: 1, borderColor: colors.border, borderRadius: 15, overflow: 'hidden', backgroundColor: colors.surface }, groupTitle: { color: '#c4b5fd', fontWeight: '900', paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.primarySoft }, feature: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, padding: 12 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, name: { color: colors.text, fontWeight: '900', fontSize: 12 }, meta: { color: colors.muted, fontSize: 9, marginTop: 3 }, chevron: { color: colors.muted, fontSize: 17 }, detail: { marginTop: 9, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, description: { color: '#d8d4e3', fontSize: 11, lineHeight: 18 }, reason: { color: '#fbbf24', fontSize: 9, lineHeight: 15, marginTop: 4 }, empty: { borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface, padding: 13 }, emptyTitle: { color: colors.text, fontWeight: '900', marginBottom: 5 }, muted: { color: colors.muted, fontSize: 10, lineHeight: 17 }, record: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface, padding: 12 }, recordClass: { color: colors.teal, fontSize: 10, fontWeight: '800', marginVertical: 6 },
})
