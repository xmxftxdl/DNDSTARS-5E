import { useEffect, useMemo, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type { MobileAccountCharacterRecord, MobileCharacterView, MobileLevelUpDecision, MobilePlayerWorkspace, MobileRestAdvance } from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'
import { CharacterAdvancementHistory, CharacterFeaturesPanel } from './CharacterFeaturesPanel'
import { CharacterLevelUpModal } from './CharacterLevelUpModal'
import { AccountCharacterVaultPanel } from './AccountCharacterVaultPanel'
import { CharacterProfileEditor, type MobileCharacterProfilePatch } from './CharacterProfileEditor'
import { CharacterVitalsEditor } from './CharacterVitalsEditor'

type InventoryMutation = Record<string, unknown>

interface CharacterScreenProps {
  workspace: MobilePlayerWorkspace
  onSelectCharacter: (id: string) => void
  onOpenCreate: () => void
  onSetSpellSlot: (characterId: string, resourceKey: string, current: number) => Promise<void>
  onSetSpellPrepared: (spellId: string, prepared: boolean) => Promise<void>
  onInventoryMutation: (mutation: InventoryMutation) => Promise<void>
  onSpendHitDie: (characterId: string, poolIndex: number) => Promise<void>
  onRecoverSpellSlot: (characterId: string, resourceKey: string, restAdvanceId: string) => Promise<void>
  onLevelUp: (characterId: string, decision: MobileLevelUpDecision) => Promise<void>
  onRollLevelHitPoints: (characterId: string, classId: string) => Promise<{ commandId: string; roll: number; hitDie: number }>
  onUpdateProfile: (characterId: string, patch: MobileCharacterProfilePatch) => Promise<void>
  onSetHitPoints: (characterId: string, currentHp: number, temporaryHp: number) => Promise<void>
  accountCharacters: MobileAccountCharacterRecord[]
  onAttachAccountCharacter: (record: MobileAccountCharacterRecord) => Promise<void>
}

const abilityLabels: Record<string, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`
const modifier = (score: number) => Math.floor((score - 10) / 2)
type CharacterTab = 'overview' | 'features' | 'advancement' | 'spells' | 'equipment'
const characterTabs: Array<{ id: CharacterTab; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'features', label: '特性' },
  { id: 'advancement', label: '升级' },
  { id: 'spells', label: '法术' },
  { id: 'equipment', label: '装备' },
]

export function CharacterScreen(props: CharacterScreenProps) {
  const { workspace, onSelectCharacter } = props
  const character = workspace.characters.find((candidate) => candidate.id === workspace.activeCharacterId) ?? workspace.characters[0]
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [expandedItem, setExpandedItem] = useState('')
  const [expandedSpell, setExpandedSpell] = useState('')
  const [levelUpOpen, setLevelUpOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [vitalsOpen, setVitalsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<CharacterTab>('overview')
  const latestRest = useMemo(() => workspace.restAdvances.find((advance) =>
    advance.recoveryReports.some((report) => report.characterId === character?.id)), [character?.id, workspace.restAdvances])
  useEffect(() => {
    if (character?.creationTargetLevel && character.level < character.creationTargetLevel) {
      setActiveTab('advancement')
      setLevelUpOpen(true)
    }
  }, [character?.creationTargetLevel, character?.level])
  if (!character) return <ScrollView contentContainerStyle={styles.content}><View style={styles.empty}><Text style={styles.emptyTitle}>选择或创建角色</Text><Text style={styles.muted}>可以从账号角色库带入兼容角色，也可以在移动端创建新的 D&D 5e 2014 角色。</Text><Pressable style={styles.createButton} onPress={props.onOpenCreate}><Text style={styles.createButtonText}>＋ 创建角色</Text></Pressable></View><AccountCharacterVaultPanel records={props.accountCharacters} rules={workspace.rules} attachedIds={new Set(workspace.characters.map((entry) => entry.id))} busy={!!busy} onAttach={props.onAttachAccountCharacter} /></ScrollView>

  const run = async (id: string, task: () => Promise<void>, rethrow = false) => {
    if (busy) return
    setBusy(id); setError('')
    try { await task() } catch (cause) {
      setError(errorLabel(cause))
      if (rethrow) throw cause
    } finally { setBusy('') }
  }

  return <><ScrollView contentContainerStyle={styles.content}>
    <AccountCharacterVaultPanel records={props.accountCharacters.filter((record) => !workspace.characters.some((entry) => entry.id === record.id))} rules={workspace.rules} attachedIds={new Set(workspace.characters.map((entry) => entry.id))} busy={!!busy} onAttach={props.onAttachAccountCharacter} />
    <View style={styles.topActions}><Pressable style={styles.createSecondary} onPress={() => setProfileOpen(true)}><Text style={styles.createSecondaryText}>编辑资料</Text></Pressable><Pressable style={styles.createSecondary} onPress={props.onOpenCreate}><Text style={styles.createSecondaryText}>＋ 新建角色</Text></Pressable><Pressable disabled={character.level >= 20 || !(character.levelUpPlans?.some((plan) => plan.eligible))} style={[styles.levelButton, (character.level >= 20 || !(character.levelUpPlans?.some((plan) => plan.eligible))) && styles.disabled]} onPress={() => { setActiveTab('advancement'); setLevelUpOpen(true) }}><Text style={styles.levelButtonText}>提升等级</Text></Pressable></View>
    {workspace.characters.length > 1 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characterList}>{workspace.characters.map((entry) => <Pressable key={entry.id} style={[styles.characterChip, entry.id === character.id && styles.characterChipActive]} onPress={() => onSelectCharacter(entry.id)}><Text style={styles.characterChipText}>{entry.name}</Text></Pressable>)}</ScrollView>}
    <View style={styles.hero}>{character.portrait ? <Image source={{ uri: character.portrait }} resizeMode="cover" style={styles.avatarImage} /> : <View style={styles.avatar}><Text style={styles.avatarText}>{character.avatar || '🧙'}</Text></View>}<View style={styles.flex}><Text style={styles.name}>{character.name}</Text><Text style={styles.meta}>{character.race} · {character.charClass} {character.level}级 · {character.background}</Text><Text style={styles.meta}>{character.alignment ?? '未选择阵营'} · {character.experience} XP</Text></View></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{characterTabs.map((tab) => <Pressable key={tab.id} style={[styles.tab, activeTab === tab.id && styles.tabActive]} onPress={() => setActiveTab(tab.id)}><Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text></Pressable>)}</ScrollView>
    {!!error && <Text style={styles.error}>{error}</Text>}

    {activeTab === 'overview' && <><View style={styles.stats}><Stat label="生命" value={`${character.currentHp}${character.tempHp ? ` +${character.tempHp}` : ''}/${character.maxHp}`} /><Stat label="护甲等级" value={`${character.ac}`} /><Stat label="速度" value={`${character.speed}尺`} /><Stat label="法术 DC" value={`${character.saveDC}`} /></View>
    <View style={styles.vitalState}><View style={styles.flex}><Text style={styles.rowName}>结算状态</Text><Text style={styles.itemMeta}>激励 {character.inspiration} · 力竭 {character.exhaustionLevel} 级{character.currentHp <= 0 ? ` · 死亡豁免 ${character.deathSaveSuccesses} 成功 / ${character.deathSaveFailures} 失败${character.deathSaveStable ? ' · 已稳定' : ''}` : ''}</Text></View><Pressable disabled={!!workspace.combat?.active} style={[styles.adjustVitals, workspace.combat?.active && styles.disabled]} onPress={() => setVitalsOpen(true)}><Text style={styles.adjustVitalsText}>{workspace.combat?.active ? '战斗中由结算修改' : '调整生命'}</Text></Pressable></View>
    {!!latestRest && <RestCard advance={latestRest} character={character} busy={busy} onSpend={(poolIndex) => run(`hit-die:${poolIndex}`, () => props.onSpendHitDie(character.id, poolIndex))} onRecoverSlot={(resourceKey) => run(`recovery:${resourceKey}`, () => props.onRecoverSpellSlot(character.id, resourceKey, latestRest.id))} />}

    <SectionTitle>属性与豁免</SectionTitle><View style={styles.abilities}>{Object.entries(character.abilities).map(([key, score]) => <View key={key} style={styles.ability}><Text style={styles.abilityLabel}>{abilityLabels[key]}</Text><Text style={styles.abilityScore}>{score}</Text><Text style={styles.abilityMod}>{signed(modifier(score))}{character.savingThrows.includes(key) ? ' · 熟练' : ''}</Text></View>)}</View>
    <SectionTitle>状态</SectionTitle><View style={styles.wrap}>{character.conditions.length ? character.conditions.map((condition) => <Tag key={condition} label={condition} tone="danger" />) : <Text style={styles.muted}>没有状态效果</Text>}</View>
    {!!character.backstory && <><SectionTitle>背景故事</SectionTitle><Text style={styles.prose}>{character.backstory}</Text></>}
    {!!character.notes && <><SectionTitle>角色笔记</SectionTitle><Text style={styles.prose}>{character.notes}</Text></>}</>}

    {activeTab === 'features' && <><SectionTitle>职业资源与法术位</SectionTitle><View style={styles.card}>{Object.entries(character.classResources ?? {}).length ? Object.entries(character.classResources ?? {}).map(([id, resource]) => {
      const editableSlot = id === 'dnd5e-pact-slot' || /^dnd5e-spell-slot-[1-9]$/.test(id)
      return <View key={id} style={styles.resourceRow}><View style={styles.flex}><Text style={styles.rowName}>{resourceLabel(id)}</Text><Text style={styles.itemMeta}>{resource.current}/{resource.max}</Text></View>{editableSlot && <View style={styles.stepper}><Step label="−" disabled={busy !== '' || resource.current <= 0} onPress={() => run(`slot:${id}`, () => props.onSetSpellSlot(character.id, id, resource.current - 1))} /><Text style={styles.stepValue}>{resource.current}</Text><Step label="＋" disabled={busy !== '' || resource.current >= resource.max} onPress={() => run(`slot:${id}`, () => props.onSetSpellSlot(character.id, id, resource.current + 1))} /></View>}</View>
    }) : <Text style={styles.cardMuted}>没有可消耗资源</Text>}</View>
    <SectionTitle>职业、种族、背景、专长与扩展特性</SectionTitle><CharacterFeaturesPanel character={character} /></>}

    {activeTab === 'spells' && <><SectionTitle>法术书</SectionTitle>{renderSpells(workspace, busy, expandedSpell, setExpandedSpell, (spellId, prepared) => run(`spell:${spellId}`, () => props.onSetSpellPrepared(spellId, prepared)))}</>}

    {activeTab === 'equipment' && <><SectionTitle>背包与装备</SectionTitle>{!!character.dnd5eInventory?.currency && <View style={styles.currency}>{Object.entries(character.dnd5eInventory.currency).map(([id, amount]) => <View key={id} style={styles.currencyEntry}><Text style={styles.currencyText}>{currencyLabel(id)} {amount}</Text>{amount > 0 && <Pressable disabled={!!busy} onPress={() => run(`currency:${id}`, () => props.onInventoryMutation({ type: 'adjust-currency', characterId: character.id, currency: id, delta: -1 }))}><Text style={styles.currencySpend}>花费 1</Text></Pressable>}</View>)}</View>}<View style={styles.inventory}>{character.dnd5eInventory?.entries.length ? character.dnd5eInventory.entries.map((entry) => {
      const expanded = expandedItem === entry.instanceId
      const requiresAttunement = entry.item.magicItem?.attunement === 'required'
      const canEquip = entry.item.category === 'equipment' || entry.item.magicItem?.kind === 'weapon' || entry.item.magicItem?.kind === 'armor'
      const containers = character.dnd5eInventory?.entries.filter((candidate) => candidate.item.category === 'container' && candidate.instanceId !== entry.instanceId) ?? []
      const transferTargets = [...new Map((workspace.scene?.visibleTokens ?? []).filter((token) => token.characterId && token.characterId !== character.id && token.friendly).map((token) => [token.characterId, { id: token.characterId!, name: token.name }])).values()]
      return <View key={entry.instanceId} style={styles.item}><Pressable style={styles.itemHeader} onPress={() => setExpandedItem(expanded ? '' : entry.instanceId)}><Text style={styles.itemIcon}>{entry.item.icon || '◇'}</Text><View style={styles.flex}><Text style={styles.itemName}>{entry.item.name}</Text><Text style={styles.itemMeta}>{entry.item.category} · 数量 {entry.quantity}{entry.equippedSlot ? ` · 已装备 ${entry.equippedSlot}` : ''}{entry.attuned ? ' · 已同调' : entry.attunementPending ? ' · 短休后同调' : ''}{entry.containerInstanceId ? ' · 已收纳' : ''}</Text>{entry.resources && Object.values(entry.resources).map((resource) => <Text key={resource.id} style={styles.resource}>{resource.label} {resource.current}/{resource.maximum}</Text>)}</View><Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text></Pressable>{expanded && <View style={styles.itemDetail}><Text style={styles.proseCompact}>{entry.item.description || entry.item.rulesText || '没有额外说明。'}</Text>{entry.item.rulesText && entry.item.description !== entry.item.rulesText && <Text style={styles.rulesText}>{entry.item.rulesText}</Text>}<Text style={styles.itemMeta}>{entry.item.weightLb != null ? `重量 ${entry.item.weightLb} 磅 · ` : ''}{entry.identified === false ? '尚未鉴定' : '已鉴定'}{entry.item.magicItem ? ` · ${entry.item.magicItem.rarity}` : ''}</Text><View style={styles.itemButtons}>{canEquip && <ActionButton label={entry.equippedSlot ? '卸下' : '装备'} disabled={!!busy} onPress={() => run(`inventory:${entry.instanceId}`, () => props.onInventoryMutation({ type: entry.equippedSlot ? 'unequip' : 'equip', characterId: character.id, instanceId: entry.instanceId }))} />}{requiresAttunement && <ActionButton label={entry.attuned ? '结束同调' : entry.attunementPending ? '取消同调准备' : '准备同调'} disabled={!!busy} onPress={() => run(`inventory:${entry.instanceId}`, () => props.onInventoryMutation({ type: entry.attuned ? 'end-attunement' : entry.attunementPending ? 'cancel-attunement' : 'prepare-attunement', characterId: character.id, instanceId: entry.instanceId }))} />}{entry.containerInstanceId && <ActionButton label="从容器取出" disabled={!!busy} onPress={() => run(`inventory:${entry.instanceId}`, () => props.onInventoryMutation({ type: 'set-container', characterId: character.id, instanceId: entry.instanceId }))} />}<ActionButton label="丢弃 1 件" danger disabled={!!busy} onPress={() => run(`inventory:${entry.instanceId}`, () => props.onInventoryMutation({ type: 'discard', characterId: character.id, instanceId: entry.instanceId, quantity: 1 }))} /></View>{!entry.containerInstanceId && containers.length > 0 && <View style={styles.subsection}><Text style={styles.subsectionTitle}>放入容器</Text><View style={styles.itemButtons}>{containers.map((container) => <ActionButton key={container.instanceId} label={container.item.name} disabled={!!busy} onPress={() => run(`container:${entry.instanceId}`, () => props.onInventoryMutation({ type: 'set-container', characterId: character.id, instanceId: entry.instanceId, containerInstanceId: container.instanceId }))} />)}</View></View>}{transferTargets.length > 0 && <View style={styles.subsection}><Text style={styles.subsectionTitle}>转交 1 件</Text><View style={styles.itemButtons}>{transferTargets.map((target) => <ActionButton key={target.id} label={target.name} disabled={!!busy} onPress={() => run(`transfer:${entry.instanceId}`, () => props.onInventoryMutation({ type: 'transfer', characterId: character.id, targetCharacterId: target.id, instanceId: entry.instanceId, quantity: 1 }))} />)}</View></View>}</View>}</View>
    }) : <Text style={styles.muted}>背包为空</Text>}</View></>}

    {activeTab === 'advancement' && <><View style={styles.advancementHeader}><View style={styles.flex}><SectionTitle>角色成长</SectionTitle><Text style={styles.muted}>每次只能提升 1 级；职业资格、生命值、子职、属性／专长与法术选择均由 Host 重新验证。</Text></View><Pressable disabled={character.level >= 20 || !(character.levelUpPlans?.some((plan) => plan.eligible))} style={[styles.levelButton, (character.level >= 20 || !(character.levelUpPlans?.some((plan) => plan.eligible))) && styles.disabled]} onPress={() => setLevelUpOpen(true)}><Text style={styles.levelButtonText}>提升到 {Math.min(20, character.level + 1)} 级</Text></Pressable></View><SectionTitle>升级记录</SectionTitle><CharacterAdvancementHistory character={character} /></>}
  </ScrollView><CharacterLevelUpModal visible={levelUpOpen} character={character} busy={!!busy} onClose={() => setLevelUpOpen(false)} onRollHitPoints={(classId) => props.onRollLevelHitPoints(character.id, classId)} onConfirm={async (decision) => { await run('level-up', () => props.onLevelUp(character.id, decision), true); setLevelUpOpen(false) }} /><CharacterProfileEditor visible={profileOpen} character={character} busy={!!busy} onClose={() => setProfileOpen(false)} onSave={async (patch) => { await run('profile', () => props.onUpdateProfile(character.id, patch), true); setProfileOpen(false) }} /><CharacterVitalsEditor visible={vitalsOpen} character={character} combatActive={!!workspace.combat?.active} busy={!!busy} onClose={() => setVitalsOpen(false)} onSave={async (currentHp, temporaryHp) => { await run('hit-points', () => props.onSetHitPoints(character.id, currentHp, temporaryHp), true); setVitalsOpen(false) }} /></>
}

function RestCard({ advance, character, busy, onSpend, onRecoverSlot }: { advance: MobileRestAdvance; character: MobileCharacterView; busy: string; onSpend: (poolIndex: number) => void; onRecoverSlot: (resourceKey: string) => void }) {
  const report = advance.recoveryReports.find((entry) => entry.characterId === character.id)
  const recoveryFeature = (character.classLevels?.wizard ?? 0) > 0 || character.charClass.includes('法师')
    ? '奥术回想'
    : (((character.classLevels?.druid ?? 0) >= 2 || character.charClass.includes('德鲁伊')) && character.dnd5eClassChoices?.classes?.druid?.subclass === 'land') ? '自然回想' : ''
  const recoverableSlots = Object.entries(character.classResources ?? {}).filter(([key, value]) => /^dnd5e-spell-slot-[1-5]$/.test(key) && value.current < value.max)
  return <View style={styles.restCard}><View style={styles.restHeader}><Text style={styles.restTitle}>{advance.kind === 'long-rest' ? '☾ 长休恢复完成' : '☕ 短休恢复'}</Text><Text style={styles.restTime}>战役分钟 {advance.toWorldMinute}</Text></View>{report?.entries.map((entry, index) => <View key={`${entry.category}:${entry.label}:${index}`} style={styles.restEntry}><Text style={styles.rowName}>{entry.label}</Text><Text style={styles.restOutcome}>{recoveryValue(entry)}</Text></View>)}{advance.kind === 'short-rest' && (character.hitPointDice ?? []).map((pool, poolIndex) => <View key={`${pool.sides}:${poolIndex}`} style={styles.hitDie}><Text style={styles.rowName}>d{pool.sides} 生命骰 · {pool.current}/{pool.max}</Text><ActionButton label={`由 Host 投掷 1d${pool.sides}`} disabled={!!busy || pool.current < 1 || character.currentHp >= character.maxHp} onPress={() => onSpend(poolIndex)} /></View>)}{advance.kind === 'short-rest' && recoveryFeature && recoverableSlots.length > 0 && <View style={styles.restFeature}><Text style={styles.rowName}>{recoveryFeature} · 选择要恢复的法术位</Text><View style={styles.itemButtons}>{recoverableSlots.map(([key]) => <ActionButton key={key} label={`${key.replace('dnd5e-spell-slot-', '')}环 +1`} disabled={!!busy} onPress={() => onRecoverSlot(key)} />)}</View></View>}</View>
}

function renderSpells(workspace: MobilePlayerWorkspace, busy: string, expandedSpell: string, setExpandedSpell: (id: string) => void, toggle: (spellId: string, prepared: boolean) => void) {
  if (!workspace.spells.length) return <Text style={styles.muted}>当前角色没有已知、已准备或法术书内法术。</Text>
  const groups = new Map<number, typeof workspace.spells>()
  for (const spell of workspace.spells) groups.set(spell.level, [...(groups.get(spell.level) ?? []), spell])
  return [...groups].sort(([a], [b]) => a - b).map(([level, spells]) => <View key={level} style={styles.spellGroup}><Text style={styles.spellLevel}>{level === 0 ? '戏法' : `${level}环`}</Text>{spells.map((spell) => {
    const expanded = expandedSpell === spell.id
    return <View key={spell.id} style={styles.spellWrap}><View style={styles.spell}><Pressable style={styles.flex} onPress={() => setExpandedSpell(expanded ? '' : spell.id)}><Text style={styles.spellName}>{spell.prepared ? '✓ ' : ''}{spell.name}</Text><Text style={styles.itemMeta}>{spell.school ? `${spell.school} · ` : ''}{spell.headless ? 'Headless' : 'DM 裁定'} · {spell.known ? '已知' : spell.inSpellbook ? '法术书' : '已选'}</Text></Pressable>{spell.preparationSelection && <Pressable disabled={!!busy} style={[styles.prepare, spell.prepared && styles.prepareActive]} onPress={() => toggle(spell.id, !spell.prepared)}><Text style={styles.prepareText}>{spell.prepared ? '取消准备' : '准备'}</Text></Pressable>}</View>{expanded && <View style={styles.spellDetail}><View style={styles.wrap}><Tag label={castingTimeLabel(spell.castingTime)} /><Tag label={spell.rangeFeet != null ? `${spell.rangeFeet}尺` : '特殊距离'} />{spell.duration?.concentration && <Tag label="专注" tone="danger" />}{spell.ritual && <Tag label="仪式" />}</View>{spell.components && <Text style={styles.itemMeta}>成分：{componentLabel(spell.components)}</Text>}<Text style={styles.proseCompact}>{spell.description || spell.automationReason || '当前仅收录目录与自动化信息。'}</Text>{spell.higherLevels && <Text style={styles.rulesText}>升环：{spell.higherLevels}</Text>}</View>}</View>
  })}</View>)
}

function recoveryValue(entry: MobileRestAdvance['recoveryReports'][number]['entries'][number]) {
  if (entry.before != null && entry.after != null) return `${entry.before} → ${entry.after}${entry.maximum != null ? `/${entry.maximum}` : ''}`
  return ({ restored: '已恢复', cleared: '已解除', available: '可使用', unchanged: '无变化', blocked: '未恢复' } as const)[entry.outcome]
}
function castingTimeLabel(value?: MobilePlayerWorkspace['spells'][number]['castingTime']) { return ({ action: '动作', 'bonus-action': '附赠动作', reaction: '反应' } as Record<string, string>)[value ?? ''] ?? '特殊施法时间' }
function componentLabel(value: NonNullable<MobilePlayerWorkspace['spells'][number]['components']>) { return [value.verbal && '言语', value.somatic && '姿势', value.material && `材料${value.materialText ? `（${value.materialText}）` : ''}`].filter(Boolean).join('、') || '无' }
function currencyLabel(value: string) { return ({ cp: '铜币', sp: '银币', ep: '琥珀金币', gp: '金币', pp: '铂金币' } as Record<string, string>)[value] ?? value }
function errorLabel(cause: unknown) {
  if (!(cause instanceof Error)) return '操作失败，请重试。'
  return ({ 'shared-state-conflict': '角色数据刚刚在另一端更新，请重试。', 'hit-die-unavailable': '该生命骰目前不可用。', 'spell-preparation-not-editable': '该法术不使用准备机制。' } as Record<string, string>)[cause.message] ?? cause.message
}
function Stat({ label, value }: { label: string; value: string }) { return <View style={styles.stat}><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View> }
function Tag({ label, tone }: { label: string; tone?: 'danger' }) { return <View style={[styles.tag, tone === 'danger' && styles.tagDanger]}><Text style={styles.tagText}>{label}</Text></View> }
function SectionTitle({ children }: { children: string }) { return <Text style={styles.section}>{children}</Text> }
function Step({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} style={[styles.step, disabled && styles.disabled]} onPress={onPress}><Text style={styles.stepText}>{label}</Text></Pressable> }
function ActionButton({ label, onPress, disabled, danger }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) { return <Pressable disabled={disabled} style={[styles.actionButton, danger && styles.actionDanger, disabled && styles.disabled]} onPress={onPress}><Text style={[styles.actionText, danger && styles.actionDangerText]}>{label}</Text></Pressable> }
function resourceLabel(id: string) { const slot = id.match(/^dnd5e-spell-slot-(\d)$/); if (slot) return `${slot[1]}环法术位`; if (id === 'dnd5e-pact-slot') return '契约法术位'; return id.replace(/^dnd5e-/, '').replace(/-/g, ' ') }

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { padding: 16, paddingBottom: 48 }, empty: { margin: 18, padding: 22, borderWidth: 1, borderColor: colors.border, borderRadius: 18 }, emptyTitle: { color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 8 }, muted: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  createButton: { alignSelf: 'flex-start', marginTop: 18, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 }, createButtonText: { color: '#fff', fontWeight: '900' },
  topActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }, createSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#151126', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 }, createSecondaryText: { color: colors.text, fontSize: 12, fontWeight: '800' }, levelButton: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 8 }, levelButtonText: { color: '#ddd6fe', fontSize: 12, fontWeight: '900' },
  tabs: { gap: 7, paddingVertical: 12 }, tab: { minWidth: 72, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }, tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, tabText: { color: colors.muted, fontSize: 11, fontWeight: '800' }, tabTextActive: { color: '#ddd6fe' }, advancementHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-end', marginTop: 4 },
  characterList: { gap: 8, paddingBottom: 12 }, characterChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border }, characterChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, characterChipText: { color: colors.text, fontWeight: '800', fontSize: 11 },
  hero: { flexDirection: 'row', gap: 13, alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, avatarImage: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft }, avatarText: { fontSize: 32 }, name: { color: colors.text, fontSize: 23, fontWeight: '900' }, meta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, stat: { width: '48%', padding: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 }, statLabel: { color: colors.muted, fontSize: 10 }, statValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 }, section: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 20, marginBottom: 9 }, error: { marginTop: 10, color: '#fecdd3', borderWidth: 1, borderColor: colors.danger, backgroundColor: '#31151e', borderRadius: 12, padding: 10, fontSize: 11 },
  vitalState: { marginTop: 8, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface }, adjustVitals: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, adjustVitalsText: { color: '#ddd6fe', fontSize: 10, fontWeight: '900' },
  abilities: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, ability: { width: '31.7%', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 10, alignItems: 'center' }, abilityLabel: { color: colors.muted, fontSize: 10 }, abilityScore: { color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 3 }, abilityMod: { color: colors.teal, fontSize: 9, marginTop: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, tag: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface }, tagDanger: { borderColor: colors.danger, backgroundColor: '#31151e' }, tagText: { color: colors.text, fontSize: 10, fontWeight: '800' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }, cardMuted: { padding: 13, color: colors.muted, fontSize: 12 }, resourceRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', padding: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, rowName: { color: colors.text, fontSize: 12, fontWeight: '700' }, stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 }, step: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.elevated }, stepText: { color: colors.text, fontWeight: '900', fontSize: 17 }, stepValue: { minWidth: 24, textAlign: 'center', color: colors.teal, fontWeight: '900' }, disabled: { opacity: .38 },
  spellGroup: { marginBottom: 8, borderRadius: 15, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }, spellLevel: { color: '#c4b5fd', fontWeight: '900', padding: 10, backgroundColor: colors.primarySoft }, spellWrap: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, spell: { minHeight: 58, flexDirection: 'row', alignItems: 'center', padding: 11 }, spellName: { color: colors.text, fontWeight: '800', fontSize: 12 }, spellDetail: { padding: 11, paddingTop: 0, gap: 8 }, prepare: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }, prepareActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, prepareText: { color: colors.text, fontWeight: '800', fontSize: 9 },
  currency: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 9 }, currencyEntry: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: '#66521c', backgroundColor: '#241f0c' }, currencyText: { color: '#fde68a', fontSize: 10, fontWeight: '900' }, currencySpend: { color: colors.muted, fontSize: 8 }, inventory: { gap: 8 }, item: { borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, overflow: 'hidden' }, itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11 }, itemIcon: { fontSize: 23 }, itemName: { color: colors.text, fontWeight: '900' }, itemMeta: { color: colors.muted, fontSize: 10, marginTop: 3 }, resource: { color: colors.teal, fontSize: 10, marginTop: 3 }, chevron: { color: colors.muted, fontSize: 17 }, itemDetail: { padding: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, proseCompact: { color: '#d8d4e3', lineHeight: 18, fontSize: 11 }, rulesText: { color: '#b8b2c5', lineHeight: 18, fontSize: 10, marginTop: 8 }, subsection: { marginTop: 11, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, subsectionTitle: { color: colors.muted, fontSize: 9, fontWeight: '800' }, itemButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, actionButton: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }, actionText: { color: colors.text, fontSize: 10, fontWeight: '900' }, actionDanger: { borderColor: colors.danger, backgroundColor: '#31151e' }, actionDangerText: { color: '#fecdd3' },
  restCard: { marginTop: 11, borderWidth: 1, borderColor: '#315f68', backgroundColor: '#0c2428', borderRadius: 17, padding: 13 }, restHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, restTitle: { color: '#a7f3d0', fontWeight: '900', fontSize: 13 }, restTime: { color: '#6ee7b7', fontSize: 9 }, restEntry: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#315f68', paddingVertical: 8 }, restOutcome: { color: '#a7f3d0', fontSize: 10, fontWeight: '800' }, hitDie: { marginTop: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#315f68', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  restFeature: { marginTop: 8, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#315f68' },
  prose: { color: '#d8d4e3', lineHeight: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 13 },
})
