import { useMemo, useState, type ReactNode } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MobileCharacterView } from '../../../../packages/mobile-protocol/src'
import {
  QUICK_CHARACTER_CURRENCIES,
  QUICK_CHARACTER_EQUIPMENT_SLOTS,
  quickCharacterAbilityRows,
  quickCharacterSkillRows,
  quickFormatModifier,
} from '../../../../src/lib/quickCharacterView'
import { colors } from '../theme'

type QuickCharacterTab = 'attributes' | 'equipment'

export function QuickCharacterSheet({
  visible,
  character,
  portraitSource,
  onClose,
}: {
  visible: boolean
  character?: MobileCharacterView
  portraitSource?: { uri: string; headers?: Record<string, string> }
  onClose: () => void
}) {
  const [tab, setTab] = useState<QuickCharacterTab>('attributes')
  const abilities = useMemo(() => character ? quickCharacterAbilityRows(character) : [], [character])
  const skills = useMemo(() => character ? quickCharacterSkillRows(character) : [], [character])
  const inventory = useMemo(() => character?.dnd5eInventory?.entries ?? [], [character])
  const equippedBySlot = useMemo(() => new Map(
    inventory.filter((entry) => entry.equippedSlot).map((entry) => [entry.equippedSlot, entry] as const),
  ), [inventory])

  if (!character) return null
  const portrait = portraitSource ?? (character.tokenPortrait || character.portrait ? { uri: character.tokenPortrait || character.portrait || '' } : undefined)
  const initiative = Math.floor((character.abilities.dex - 10) / 2) + character.initiativeBonus
  const load = character.inventoryLoad

  return <Modal visible={visible} transparent animationType="fade" supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}>
    <View style={styles.modalRoot}>
      <Pressable accessibilityLabel="关闭快捷人物卡" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.portrait}>
            {portrait ? <Image source={portrait} style={styles.portraitImage} /> : <Text style={styles.avatar}>{character.avatar}</Text>}
          </View>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.name}>{character.name}</Text>
            <Text numberOfLines={1} style={styles.meta}>{character.race} · {character.charClass} {character.level} 级</Text>
            <Text numberOfLines={1} style={styles.player}>玩家：{character.player}</Text>
          </View>
          <Pressable accessibilityLabel="关闭快捷人物卡" style={styles.close} onPress={onClose}><Text style={styles.closeText}>×</Text></Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'attributes' }} style={[styles.tab, tab === 'attributes' && styles.tabAttributesActive]} onPress={() => setTab('attributes')}><Text style={[styles.tabText, tab === 'attributes' && styles.tabTextActive]}>属性</Text></Pressable>
          <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === 'equipment' }} style={[styles.tab, tab === 'equipment' && styles.tabEquipmentActive]} onPress={() => setTab('equipment')}><Text style={[styles.tabText, tab === 'equipment' && styles.tabTextActive]}>装备</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {tab === 'attributes' ? <>
            <View style={styles.summaryGrid}>
              <Summary label="生命值" value={`${character.currentHp}/${character.maxHp}`} detail={character.tempHp > 0 ? `临时 ${character.tempHp}` : undefined} />
              <Summary label="护甲等级" value={`${character.ac}`} />
              <Summary label="速度" value={`${character.speed} 尺`} />
              <Summary label="先攻" value={quickFormatModifier(initiative)} />
              <Summary label="被动察觉" value={`${character.passivePerception}`} />
              <Summary label="法术 DC" value={`${character.saveDC}`} />
            </View>

            <View style={styles.combatStateGrid}>
              <CombatState label="激励" value={`${character.inspiration}`} tone={character.inspiration > 0 ? 'good' : undefined} />
              <CombatState label="力竭" value={`${character.exhaustionLevel} 级`} tone={character.exhaustionLevel > 0 ? 'danger' : undefined} />
              <CombatState label="死亡豁免" value={character.deathSaveStable ? '稳定' : `${character.deathSaveSuccesses} 成功 / ${character.deathSaveFailures} 失败`} tone={character.deathSaveFailures > 0 ? 'danger' : undefined} />
            </View>

            <SectionTitle>移动与负重</SectionTitle>
            <View style={styles.chips}>
              <Text style={styles.movementChip}>步行 {character.movementSpeeds?.walk ?? character.speed} 尺</Text>
              {character.movementSpeeds?.climb != null ? <Text style={styles.movementChip}>攀爬 {character.movementSpeeds.climb} 尺</Text> : null}
              {character.movementSpeeds?.swim != null ? <Text style={styles.movementChip}>游泳 {character.movementSpeeds.swim} 尺</Text> : null}
              {character.movementSpeeds?.fly != null ? <Text style={styles.movementChip}>飞行 {character.movementSpeeds.fly} 尺{character.movementSpeeds.hover ? ' · 悬浮' : ''}</Text> : null}
            </View>
            {load ? <View style={styles.loadCard}><View style={styles.loadHeader}><Text style={styles.loadTitle}>携带 {formatWeight(load.totalWeightLb)} / {formatWeight(load.carryingCapacityLb)} 磅</Text><Text style={[styles.loadStatus, load.status !== 'normal' && styles.loadWarning]}>{loadStatusLabel(load.status)}</Text></View><View style={styles.loadTrack}><View style={[styles.loadFill, { width: `${Math.min(100, load.carryingCapacityLb > 0 ? load.totalWeightLb / load.carryingCapacityLb * 100 : 0)}%` }]} /></View><Text style={styles.loadMeta}>可选负重阈值：{formatWeight(load.encumberedThresholdLb)} / {formatWeight(load.heavilyEncumberedThresholdLb)} 磅{load.speedPenaltyFeet ? ` · 速度可能 -${load.speedPenaltyFeet} 尺` : ''}；最终是否启用由房间规则与 Host 判定。</Text></View> : null}

            <SectionTitle>属性与豁免</SectionTitle>
            <View style={styles.abilityGrid}>{abilities.map((entry) => <View key={entry.key} style={styles.abilityCard}><Text style={styles.abilityLabel}>{entry.label}</Text><Text style={styles.abilityScore}>{entry.score}</Text><Text style={styles.abilityModifier}>{quickFormatModifier(entry.modifier)}</Text><Text style={[styles.save, entry.saveProficient && styles.saveProficient]}>豁免 {quickFormatModifier(entry.savingThrowModifier)}{entry.saveProficient ? ' · 熟练' : ''}</Text></View>)}</View>

            <SectionTitle>技能</SectionTitle>
            <View style={styles.skillGrid}>{skills.map((entry) => <View key={entry.key} style={styles.skillRow}><View style={[styles.skillDot, entry.proficient && styles.skillDotProficient, entry.expertise && styles.skillDotExpertise]} /><Text numberOfLines={1} style={styles.skillName}>{entry.label}</Text><Text style={styles.skillModifier}>{quickFormatModifier(entry.modifier)}</Text></View>)}</View>

            <SectionTitle>状态</SectionTitle>
            <View style={styles.chips}>{character.conditions.length ? character.conditions.map((condition) => <Text key={condition} style={styles.conditionChip}>{condition}</Text>) : <Text style={styles.emptyText}>当前没有状态效果</Text>}{character.concentrating ? <Text style={styles.concentrationChip}>专注中</Text> : null}</View>
            {!!character.activeEffects?.length && <View style={styles.effectList}>{character.activeEffects.map((effect) => <View key={effect.id} style={styles.effectEntry}>
              <View style={styles.effectTitleRow}><Text numberOfLines={1} style={styles.effectName}>{effect.label}</Text>{effect.suspended ? <Text style={styles.effectSuspended}>已暂停</Text> : null}</View>
              <Text style={styles.effectMeta}>{effect.source?.label || effect.source?.actorName ? `来源：${effect.source?.label ?? effect.source?.actorName}` : '来源：规则效果'} · {formatEffectDuration(effect.duration)}</Text>
              {effect.repeatSave ? <Text style={styles.effectSave}>重复豁免：{effect.repeatSave.ability.toUpperCase()} · DC {effect.repeatSave.dc} · {effect.repeatSave.timing === 'turn-start' ? '回合开始' : '回合结束'}</Text> : null}
            </View>)}</View>}

            <SectionTitle>职业资源</SectionTitle>
            <View style={styles.resourceGrid}>{Object.entries(character.classResources ?? {}).length ? Object.entries(character.classResources ?? {}).map(([key, value]) => <View key={key} style={styles.resourceCard}><Text numberOfLines={1} style={styles.resourceName}>{key}</Text><Text style={styles.resourceValue}>{value.current}/{value.max}</Text></View>) : <Text style={styles.emptyText}>当前没有可显示资源</Text>}</View>
          </> : <>
            <SectionTitle>穿戴栏位</SectionTitle>
            <View style={styles.equipmentGrid}>{QUICK_CHARACTER_EQUIPMENT_SLOTS.map((slot) => { const entry = equippedBySlot.get(slot.key); return <View key={slot.key} style={styles.equipmentSlot}><Text style={styles.equipmentSlotLabel}>{slot.label}</Text><Text numberOfLines={2} style={[styles.equipmentName, !entry && styles.emptyEquipment]}>{entry?.item.name ?? '空'}</Text></View> })}</View>

            <SectionTitle>背包 · {inventory.length}</SectionTitle>
            <View style={styles.inventoryList}>{inventory.map((entry) => <View key={entry.instanceId} style={styles.inventoryEntry}><View style={styles.itemIcon}><Text style={styles.itemIconText}>{entry.item.magicItem ? '✦' : '◆'}</Text></View><View style={styles.itemCopy}><Text numberOfLines={1} style={styles.itemName}>{entry.item.name}</Text><Text style={styles.itemMeta}>数量 {entry.quantity}{entry.equippedSlot ? ` · ${QUICK_CHARACTER_EQUIPMENT_SLOTS.find((slot) => slot.key === entry.equippedSlot)?.label ?? '已装备'}` : ''}{entry.attuned ? ' · 已同调' : ''}</Text>{Object.values(entry.resources ?? {}).map((resource) => <Text key={resource.id} style={styles.itemResource}>{resource.label} {resource.current}/{resource.maximum}</Text>)}</View></View>)}{inventory.length === 0 ? <Text style={styles.emptyPanel}>背包为空</Text> : null}</View>

            <SectionTitle>钱币</SectionTitle>
            <View style={styles.chips}>{QUICK_CHARACTER_CURRENCIES.map((currency) => <Text key={currency.key} style={styles.currencyChip}>{currency.label}  {character.dnd5eInventory?.currency?.[currency.key] ?? 0}</Text>)}</View>
            <Text style={styles.readOnly}>快捷人物卡为只读视图；装备、同调、使用、转交或丢弃物品请前往“角色”页。</Text>
          </>}
        </ScrollView>
      </View>
    </View>
  </Modal>
}

function Summary({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <View style={styles.summary}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text>{detail ? <Text style={styles.summaryDetail}>{detail}</Text> : null}</View>
}

function CombatState({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'danger' }) {
  return <View style={[styles.combatState, tone === 'good' && styles.combatStateGood, tone === 'danger' && styles.combatStateDanger]}><Text style={styles.combatStateLabel}>{label}</Text><Text style={styles.combatStateValue}>{value}</Text></View>
}

function formatWeight(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function loadStatusLabel(status: NonNullable<MobileCharacterView['inventoryLoad']>['status']) {
  if (status === 'encumbered') return '负重'
  if (status === 'heavily-encumbered') return '重度负重'
  if (status === 'over-capacity') return '超过携带上限'
  return '正常'
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function formatEffectDuration(duration: NonNullable<MobileCharacterView['activeEffects']>[number]['duration']) {
  if (duration.type === 'permanent') return '永久'
  if (duration.type === 'concentration') return duration.remainingRounds == null ? '专注' : `专注 · 剩余 ${duration.remainingRounds} 轮`
  if (duration.type === 'rounds') return `剩余 ${duration.remainingRounds ?? 0} 轮`
  return duration.boundary === 'turn-start' ? '直到回合开始' : '直到回合结束'
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000b8' },
  sheet: { maxHeight: '86%', minHeight: '68%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border, backgroundColor: '#0a0a14' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  portrait: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: '#a78bfa', backgroundColor: colors.primarySoft, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, portraitImage: { width: '100%', height: '100%' }, avatar: { fontSize: 26 },
  headerCopy: { flex: 1 }, name: { color: colors.text, fontSize: 18, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 11, marginTop: 2 }, player: { color: '#6f6a82', fontSize: 9, marginTop: 2 },
  close: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, closeText: { color: colors.muted, fontSize: 24, lineHeight: 25 },
  tabs: { flexDirection: 'row', gap: 4, padding: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: '#07070e' }, tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }, tabAttributesActive: { backgroundColor: '#4c1d954d' }, tabEquipmentActive: { backgroundColor: '#78350f45' }, tabText: { color: colors.muted, fontSize: 12, fontWeight: '800' }, tabTextActive: { color: colors.text },
  scrollContent: { padding: 14, paddingBottom: 32 }, summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, summary: { width: '31.5%', minHeight: 62, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 9 }, summaryLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' }, summaryValue: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: 5 }, summaryDetail: { color: colors.teal, fontSize: 8, marginTop: 1 },
  combatStateGrid: { flexDirection: 'row', gap: 7, marginTop: 8 }, combatState: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: '#ffffff08', paddingHorizontal: 9, paddingVertical: 8 }, combatStateGood: { borderColor: '#22c55e55', backgroundColor: '#14532d33' }, combatStateDanger: { borderColor: '#ef444455', backgroundColor: '#7f1d1d33' }, combatStateLabel: { color: colors.muted, fontSize: 8 }, combatStateValue: { color: colors.text, fontSize: 10, fontWeight: '900', marginTop: 3 },
  sectionTitle: { color: '#ddd6fe', fontSize: 10, fontWeight: '900', letterSpacing: 1.3, marginTop: 18, marginBottom: 8 }, movementChip: { color: '#bae6fd', backgroundColor: '#07598533', borderWidth: 1, borderColor: '#38bdf833', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9 }, loadCard: { marginTop: 8, borderRadius: 11, borderWidth: 1, borderColor: '#ffffff14', backgroundColor: colors.surface, padding: 10 }, loadHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, loadTitle: { color: colors.text, fontSize: 10, fontWeight: '900' }, loadStatus: { color: colors.success, fontSize: 9, fontWeight: '900' }, loadWarning: { color: colors.warning }, loadTrack: { height: 5, backgroundColor: '#ffffff12', borderRadius: 999, overflow: 'hidden', marginTop: 7 }, loadFill: { height: '100%', backgroundColor: colors.teal, borderRadius: 999 }, loadMeta: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 6 }, abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, abilityCard: { width: '31.5%', borderRadius: 12, borderWidth: 1, borderColor: '#6d5a9a55', backgroundColor: '#261c4733', alignItems: 'center', paddingVertical: 10 }, abilityLabel: { color: '#d7d1e5', fontSize: 10, fontWeight: '800' }, abilityScore: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 2 }, abilityModifier: { color: '#c4b5fd', fontSize: 12, fontWeight: '800' }, save: { color: '#615b71', fontSize: 7, marginTop: 3 }, saveProficient: { color: colors.success },
  skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, skillRow: { width: '48.9%', flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 10, borderWidth: 1, borderColor: '#ffffff12', backgroundColor: '#ffffff08', paddingHorizontal: 9, paddingVertical: 8 }, skillDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: '#4f4961' }, skillDotProficient: { borderWidth: 0, backgroundColor: '#7dd3fc' }, skillDotExpertise: { backgroundColor: '#fcd34d' }, skillName: { flex: 1, color: '#c9c4d5', fontSize: 10 }, skillModifier: { color: colors.text, fontSize: 11, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, conditionChip: { color: '#fecdd3', backgroundColor: '#9f123933', borderWidth: 1, borderColor: '#fb718533', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9 }, concentrationChip: { color: '#ddd6fe', backgroundColor: '#6d28d933', borderWidth: 1, borderColor: '#a78bfa33', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9 }, resourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, resourceCard: { width: '48.8%', borderRadius: 10, backgroundColor: colors.surface, padding: 9 }, resourceName: { color: colors.muted, fontSize: 8 }, resourceValue: { color: colors.text, fontSize: 11, fontWeight: '900', marginTop: 3 }, emptyText: { color: '#625c73', fontSize: 10 },
  effectList: { gap: 6, marginTop: 8 }, effectEntry: { borderRadius: 10, borderWidth: 1, borderColor: '#38bdf82b', backgroundColor: '#082f4933', paddingHorizontal: 10, paddingVertical: 8 }, effectTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, effectName: { flex: 1, color: '#dbeafe', fontSize: 10, fontWeight: '900' }, effectSuspended: { color: '#fde68a', fontSize: 8 }, effectMeta: { color: '#94a3b8', fontSize: 8, marginTop: 3 }, effectSave: { color: '#7dd3fc', fontSize: 8, marginTop: 3 },
  equipmentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, equipmentSlot: { width: '31.5%', minHeight: 67, borderRadius: 12, borderWidth: 1, borderColor: '#fbbf2430', backgroundColor: '#78350f22', padding: 9 }, equipmentSlotLabel: { color: '#d6a94c', fontSize: 8, fontWeight: '800' }, equipmentName: { color: '#fff4ce', fontSize: 10, fontWeight: '800', marginTop: 7 }, emptyEquipment: { color: '#5e5749' }, inventoryList: { gap: 7 }, inventoryEntry: { flexDirection: 'row', gap: 10, borderRadius: 12, borderWidth: 1, borderColor: '#ffffff14', backgroundColor: colors.surface, padding: 10 }, itemIcon: { width: 38, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: '#06060c', alignItems: 'center', justifyContent: 'center' }, itemIconText: { color: '#fcd34d', fontSize: 17 }, itemCopy: { flex: 1 }, itemName: { color: colors.text, fontSize: 11, fontWeight: '900' }, itemMeta: { color: colors.muted, fontSize: 8, marginTop: 3 }, itemResource: { color: '#c4b5fd', fontSize: 8, marginTop: 3 }, emptyPanel: { color: '#625c73', fontSize: 11, textAlign: 'center', paddingVertical: 24, borderWidth: 1, borderColor: '#ffffff12', borderStyle: 'dashed', borderRadius: 12 }, currencyChip: { color: '#d8d2e4', backgroundColor: '#ffffff0a', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, fontSize: 9 }, readOnly: { color: '#625c73', textAlign: 'center', fontSize: 8, marginTop: 18 },
})
