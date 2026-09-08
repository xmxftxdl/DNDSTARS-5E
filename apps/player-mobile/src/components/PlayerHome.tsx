import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MobilePlayerWorkspace } from '../../../../packages/mobile-protocol/src'
import type { ActionTab } from './CombatActionSheet'
import { colors } from '../theme'

export function PlayerHome({ workspace, onOpenMap, onOpenActions, onEndTurn, onDeathSave }: {
  workspace: MobilePlayerWorkspace
  onOpenMap: () => void
  onOpenActions: (tab: ActionTab) => void
  onEndTurn: () => void
  onDeathSave: () => void
}) {
  const character = workspace.characters.find((entry) => entry.id === workspace.activeCharacterId) ?? workspace.characters[0]
  const token = workspace.scene?.controlledTokens.find((entry) => entry.characterId === character?.id) ?? workspace.scene?.controlledTokens[0]
  const combat = workspace.combat
  const current = combat?.initiativeOrder.find((entry) => entry.tokenId === combat.currentTokenId)
  const economy = token ? combat?.turnEconomy?.[token.id] : null
  const isTurn = Boolean(combat?.active && token?.id === combat.currentTokenId)
  const slots = character ? Object.entries(character.classResources ?? {}).filter(([id]) => id.startsWith('dnd5e-spell-slot-')) : []
  const deathSaveResolved = !!character && (character.deathSaveStable || character.deathSaveFailures >= 3)
  const deathSaveLabel = !character
    ? ''
    : character.deathSaveFailures >= 3
      ? '死亡豁免失败 3 次'
      : character.deathSaveStable
        ? '伤势稳定，无需继续进行死亡豁免'
        : `成功 ${character.deathSaveSuccesses}/3 · 失败 ${character.deathSaveFailures}/3`

  return <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.clock}><View><Text style={styles.clockEyebrow}>战役时间</Text><Text style={styles.clockValue}>{workspace.campaignTime.formatted}</Text></View><Text style={styles.clockMeta}>{workspace.campaignTime.activeTimers.length ? `${workspace.campaignTime.activeTimers.length} 个提醒进行中` : '由 DM 权威推进'}</Text></View>
    <View style={styles.hero}>
      <View style={styles.identity}><Portrait source={token?.portraitSource} fallback={character?.avatar || '🧝'} /><View style={{ flex: 1 }}><Text style={styles.eyebrow}>当前冒险者</Text><Text style={styles.title}>{character?.name ?? '尚未绑定角色'}</Text><Text style={styles.meta}>{character ? `${character.charClass} ${character.level}级 · ${character.race}` : '请前往角色页创建或带入角色'}</Text>{character?.concentrating && <Text style={styles.concentration}>◉ 正在专注</Text>}{!!character?.conditions.length && <Text numberOfLines={2} style={styles.conditions}>{character.conditions.join(' · ')}</Text>}</View></View>
      <View style={styles.vitals}><Metric label="HP" value={`${token?.hp ?? character?.currentHp ?? 0}/${token?.maxHp ?? character?.maxHp ?? 0}`} detail={character?.tempHp ? `临时 ${character.tempHp}` : undefined} tone="health" /><Metric label="AC" value={`${character?.ac ?? 0}`} /><Metric label="速度" value={`${character?.speed ?? 0}尺`} /><Metric label="被动察觉" value={`${character?.passivePerception ?? 0}`} /></View>
      {character && (character.inspiration > 0 || character.exhaustionLevel > 0) && <View style={styles.stateSummary}>{character.inspiration > 0 && <Text style={styles.inspiration}>激励 {character.inspiration}</Text>}{character.exhaustionLevel > 0 && <Text style={styles.exhaustion}>力竭 {character.exhaustionLevel} 级</Text>}</View>}
      {!!slots.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slots}>{slots.map(([id, slot]) => <View key={id} style={styles.slot}><Text style={styles.slotLevel}>{id.replace('dnd5e-spell-slot-', '')}环</Text><Text style={styles.slotValue}>{slot.current}/{slot.max}</Text></View>)}</ScrollView>}
      <Pressable style={styles.primary} onPress={onOpenMap}><Text style={styles.primaryText}>{workspace.scene ? '进入当前地图' : '查看地图状态'}</Text></Pressable>
    </View>

    {combat?.active && <View style={[styles.turnCard, isTurn && styles.myTurn]}><View><Text style={styles.turnEyebrow}>第 {combat.round} 轮</Text><Text style={styles.turnTitle}>{isTurn ? '现在是你的回合' : `正在行动：${current?.label || '等待 Host'}`}</Text></View>{isTurn && <Pressable style={styles.endTurn} onPress={onEndTurn}><Text style={styles.endTurnText}>结束回合</Text></Pressable>}
      {isTurn && <View style={styles.economy}><Economy label="动作" value={economy?.action?.current} /><Economy label="附赠" value={economy?.bonusAction?.current} /><Economy label="反应" value={economy?.reaction?.current} /><Economy label="移动" value={economy?.movement?.current} suffix="尺" /></View>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.initiative}>{combat.initiativeOrder.map((entry) => <View key={entry.tokenId} style={[styles.initiativeItem, entry.tokenId === combat.currentTokenId && styles.initiativeCurrent]}>{entry.portraitSource ? <Image source={entry.portraitSource} style={styles.initiativePortrait} /> : <View style={[styles.initiativePortrait, { backgroundColor: entry.color || colors.surface }]}><Text style={styles.initiativeFallback}>{entry.label.slice(0, 1)}</Text></View>}<Text style={styles.initiativeRoll}>{entry.roll}</Text></View>)}</ScrollView>
    </View>}

    {character && character.currentHp <= 0 && <Pressable disabled={deathSaveResolved} style={[styles.deathSave, deathSaveResolved && styles.deathSaveResolved]} onPress={onDeathSave}><Text style={styles.deathSaveTitle}>{deathSaveResolved ? '死亡豁免已结算' : '进行死亡豁免'}</Text><Text style={styles.deathSaveMeta}>{deathSaveLabel}</Text></Pressable>}

    <Text style={styles.sectionTitle}>玩家操作</Text>
    <View style={styles.grid}>
      <Action icon="⚔" label="基础行动" onPress={() => onOpenActions('actions')} />
      <Action icon="✧" label="法术" onPress={() => onOpenActions('spells')} />
      <Action icon="◈" label="物品" onPress={() => onOpenActions('items')} />
      <Action icon="✦" label="职业特性" onPress={() => onOpenActions('features')} />
      <Action icon="⚄" label="检定" onPress={() => onOpenActions('checks')} />
      <Action icon="◎" label="地图与移动" onPress={onOpenMap} />
    </View>

    <View style={styles.card}><Text style={styles.cardTitle}>权威玩家投影</Text><Text style={styles.cardText}>所有攻击、法术、道具、移动、检定与反应都只提交意图；目标、距离、资源与结果由房间 Host 重新校验。</Text></View>
  </ScrollView>
}

function Action({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) { return <Pressable style={styles.action} onPress={onPress}><Text style={styles.actionIcon}>{icon}</Text><Text style={styles.actionLabel}>{label}</Text></Pressable> }
function Portrait({ source, fallback }: { source?: { uri: string; headers?: Record<string, string> }; fallback: string }) { return <View style={styles.avatar}>{source ? <Image source={source} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{fallback}</Text>}</View> }
function Metric({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'health' }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={[styles.metricValue, tone === 'health' && styles.health]}>{value}</Text>{detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}</View> }
function Economy({ label, value, suffix = '' }: { label: string; value?: number; suffix?: string }) { return <View style={styles.economyItem}><Text style={styles.economyLabel}>{label}</Text><Text style={styles.economyValue}>{value ?? '—'}{typeof value === 'number' ? suffix : ''}</Text></View> }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 45, gap: 14 }, clock: { minHeight: 54, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, clockEyebrow: { color: colors.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 }, clockValue: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 3 }, clockMeta: { color: colors.teal, fontSize: 9, fontWeight: '800' }, hero: { padding: 18, borderRadius: 22, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }, identity: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 60, height: 60, borderRadius: 30, overflow: 'hidden', backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarImage: { width: '100%', height: '100%' }, avatarText: { fontSize: 31 }, eyebrow: { color: colors.teal, fontSize: 9, fontWeight: '900', letterSpacing: 1 }, title: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 3 }, meta: { color: colors.muted, marginTop: 3, fontSize: 10 }, concentration: { color: colors.warning, fontSize: 9, fontWeight: '900', marginTop: 5 }, conditions: { color: colors.danger, fontSize: 9, marginTop: 3 },
  vitals: { flexDirection: 'row', gap: 7, marginTop: 15 }, metric: { flex: 1, minHeight: 54, paddingVertical: 9, alignItems: 'center', borderRadius: 11, backgroundColor: colors.surface }, metricLabel: { color: colors.muted, fontSize: 8 }, metricValue: { color: colors.text, fontSize: 13, fontWeight: '900', marginTop: 2 }, metricDetail: { color: colors.teal, fontSize: 7, fontWeight: '800', marginTop: 1 }, health: { color: colors.success }, stateSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 }, inspiration: { color: '#fde68a', backgroundColor: '#713f1238', borderColor: '#f59e0b55', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900' }, exhaustion: { color: '#fecaca', backgroundColor: '#7f1d1d38', borderColor: '#ef444455', borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '900' }, slots: { gap: 7, paddingTop: 11 }, slot: { minWidth: 48, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: colors.primary, padding: 7 }, slotLevel: { color: colors.muted, fontSize: 8 }, slotValue: { color: '#d8ccff', fontWeight: '900', fontSize: 11, marginTop: 2 },
  primary: { backgroundColor: colors.primary, borderRadius: 13, paddingVertical: 12, alignItems: 'center', marginTop: 14 }, primaryText: { color: '#fff', fontWeight: '900' },
  turnCard: { padding: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, myTurn: { borderColor: colors.warning, backgroundColor: '#211a0d' }, turnEyebrow: { color: colors.warning, fontSize: 9, fontWeight: '900' }, turnTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 3 }, endTurn: { position: 'absolute', right: 12, top: 12, backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }, endTurnText: { color: '#fff', fontSize: 9, fontWeight: '900' }, economy: { flexDirection: 'row', gap: 6, marginTop: 12 }, economyItem: { flex: 1, alignItems: 'center', backgroundColor: colors.background, borderRadius: 9, padding: 7 }, economyLabel: { color: colors.muted, fontSize: 8 }, economyValue: { color: colors.text, fontWeight: '900', fontSize: 11, marginTop: 2 }, initiative: { gap: 7, paddingTop: 12 }, initiativeItem: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.background }, initiativeCurrent: { borderColor: colors.warning, borderWidth: 2 }, initiativePortrait: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, initiativeFallback: { color: colors.text, fontWeight: '900' }, initiativeRoll: { position: 'absolute', right: 1, top: 1, minWidth: 15, textAlign: 'center', color: '#111', backgroundColor: colors.warning, borderRadius: 8, fontSize: 8, fontWeight: '900' },
  deathSave: { borderWidth: 1, borderColor: colors.danger, backgroundColor: '#2b111a', padding: 14, borderRadius: 16 }, deathSaveResolved: { opacity: 0.7, borderColor: colors.muted }, deathSaveTitle: { color: colors.danger, fontWeight: '900' }, deathSaveMeta: { color: colors.muted, fontSize: 9, marginTop: 4 }, sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 3 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, action: { width: '48.5%', height: 88, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, justifyContent: 'center', alignItems: 'center' }, actionIcon: { color: colors.primary, fontSize: 22 }, actionLabel: { color: colors.text, fontWeight: '800', marginTop: 7, fontSize: 10 }, card: { backgroundColor: '#0b2424', borderColor: '#185b54', borderWidth: 1, borderRadius: 17, padding: 15 }, cardTitle: { color: colors.teal, fontWeight: '900' }, cardText: { color: '#b8d8d3', lineHeight: 19, marginTop: 6, fontSize: 11 },
})
