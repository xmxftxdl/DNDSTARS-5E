import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import type {
  MobileAdvancementAsiChoice,
  MobileAdvancementSpellSelections,
  MobileCharacterView,
  MobileLevelUpDecision,
  MobileLevelUpPlan,
} from '../../../../packages/mobile-protocol/src'
import { colors } from '../theme'

type AbilityKey = keyof MobileCharacterView['abilities']
type AsiDraft = { mode: 'single' | 'split' | 'feat'; first?: AbilityKey; second?: AbilityKey; featId?: string }

const abilityLabels: Record<AbilityKey, string> = {
  str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力',
}

interface Props {
  visible: boolean
  character: MobileCharacterView
  busy?: boolean
  onClose: () => void
  onRollHitPoints: (classId: string) => Promise<{ commandId: string; roll: number; hitDie: number }>
  onConfirm: (decision: MobileLevelUpDecision) => Promise<void>
}

export function CharacterLevelUpModal({ visible, character, busy, onClose, onRollHitPoints, onConfirm }: Props) {
  const plans = character.levelUpPlans ?? []
  const preferred = useMemo(() => plans.findIndex((plan) => (
    plan.eligible && (character.classLevels?.[plan.classId] ?? 0) > 0
  )), [character.classLevels, plans])
  const [planIndex, setPlanIndex] = useState(0)
  const [hpMethod, setHpMethod] = useState<'fixed' | 'rolled'>('fixed')
  const [hpRoll, setHpRoll] = useState<number | undefined>()
  const [hpRollCommandId, setHpRollCommandId] = useState('')
  const [hpRollBusy, setHpRollBusy] = useState(false)
  const [asiDrafts, setAsiDrafts] = useState<Record<number, AsiDraft>>({})
  const [classChoices, setClassChoices] = useState<Record<string, string[]>>({})
  const [fighterChoices, setFighterChoices] = useState<Record<string, string[]>>({})
  const [fighterStyles, setFighterStyles] = useState<string[]>([])
  const [spellSelections, setSpellSelections] = useState<MobileAdvancementSpellSelections>({ cantrips: [] })
  const [error, setError] = useState('')
  const plan = plans[planIndex]

  useEffect(() => {
    if (!visible || plans.length === 0) return
    setPlanIndex(preferred >= 0 ? preferred : Math.max(0, plans.findIndex((candidate) => candidate.eligible)))
  }, [preferred, plans, visible])

  useEffect(() => {
    if (!plan) return
    setHpMethod('fixed')
    setHpRoll(undefined)
    setHpRollCommandId('')
    setHpRollBusy(false)
    setAsiDrafts(Object.fromEntries(plan.asiLevels.map((level) => [level, { mode: 'single' as const }])))
    setClassChoices(Object.fromEntries(plan.choiceRequirements.filter((entry) => entry.kind === 'class').map((entry) => [entry.key, entry.replaceable ? [...entry.currentSelections] : []])))
    setFighterChoices(Object.fromEntries(plan.choiceRequirements.filter((entry) => entry.kind === 'fighter-subclass').map((entry) => [entry.key, []])))
    setFighterStyles([...(plan.fighterCurrentStyles ?? [])])
    setSpellSelections(structuredClone(plan.spellAdvancement?.defaultSelections ?? { cantrips: [] }))
    setError('')
  }, [plan])

  const toggleChoice = (requirement: MobileLevelUpPlan['choiceRequirements'][number], optionId: string) => {
    const setter = requirement.kind === 'class' ? setClassChoices : setFighterChoices
    const source = requirement.kind === 'class' ? classChoices : fighterChoices
    if (!requirement.replaceable && requirement.currentSelections.includes(optionId)) return
    const current = source[requirement.key] ?? []
    const active = current.includes(optionId)
    const maximum = requirement.replaceable
      ? requirement.targetLimit
      : Math.max(0, requirement.targetLimit - requirement.currentSelections.length)
    const next = active ? current.filter((id) => id !== optionId) : current.length < maximum ? [...current, optionId] : current
    setter((value) => ({ ...value, [requirement.key]: next }))
  }

  const toggleSpell = (kind: keyof MobileAdvancementSpellSelections, spellId: string, maximum: number, locked = false) => {
    if (locked) return
    setSpellSelections((current) => {
      const values = [...(current[kind] ?? [])]
      const next = values.includes(spellId)
        ? values.filter((id) => id !== spellId)
        : values.length < maximum ? [...values, spellId] : values
      return { ...current, [kind]: next }
    })
  }

  const buildDecision = (): MobileLevelUpDecision | undefined => {
    if (!plan?.eligible) { setError(plan?.disabledReason ?? '当前不能选择该职业。'); return }
    if (hpMethod === 'rolled' && (!Number.isInteger(hpRoll) || (hpRoll ?? 0) < 1 || (hpRoll ?? 0) > plan.hitDie)) {
      setError(`请先投掷 1d${plan.hitDie}。`); return
    }
    if (hpMethod === 'rolled' && !hpRollCommandId) { setError('缺少 Host 升级生命骰凭据，请重新投掷。'); return }
    const asiChoices: Array<{ classLevel: number; choice: MobileAdvancementAsiChoice }> = []
    for (const classLevel of plan.asiLevels) {
      const draft = asiDrafts[classLevel]
      if (draft?.mode === 'feat' && draft.featId) asiChoices.push({ classLevel, choice: { kind: 'feat', featId: draft.featId } })
      else if (draft?.mode === 'single' && draft.first) asiChoices.push({ classLevel, choice: { kind: 'ability-score', increases: { [draft.first]: 2 } } })
      else if (draft?.mode === 'split' && draft.first && draft.second && draft.first !== draft.second) asiChoices.push({ classLevel, choice: { kind: 'ability-score', increases: { [draft.first]: 1, [draft.second]: 1 } } })
      else { setError('还有属性值提升或专长尚未选择。'); return }
    }
    for (const requirement of plan.choiceRequirements) {
      const values = requirement.kind === 'class' ? classChoices[requirement.key] ?? [] : fighterChoices[requirement.key] ?? []
      const total = requirement.replaceable ? values.length : requirement.currentSelections.length + values.length
      if (total !== requirement.targetLimit) { setError(`${requirement.name}尚未选满。`); return }
    }
    if ((plan.fighterStyleTargetLimit ?? 0) !== fighterStyles.length) { setError('战斗风格尚未选满。'); return }
    const spellPlan = plan.spellAdvancement
    if (spellPlan?.selectionRequired) {
      if (spellSelections.cantrips.length !== spellPlan.targetCantripCount) { setError(`需要选择 ${spellPlan.targetCantripCount} 个戏法。`); return }
      if (spellPlan.targetKnownSpellCount != null && spellSelections.knownSpells?.length !== spellPlan.targetKnownSpellCount) { setError(`需要选择 ${spellPlan.targetKnownSpellCount} 个已知法术。`); return }
      if (spellPlan.targetWizardSpellbookCount != null && spellSelections.wizardSpellbook?.length !== spellPlan.targetWizardSpellbookCount) { setError(`法术书需要包含 ${spellPlan.targetWizardSpellbookCount} 个法术。`); return }
    }
    return {
      schemaVersion: 1,
      classId: plan.classId,
      levelsGained: 1,
      hitPointMethod: hpMethod,
      hitPointRolls: hpMethod === 'rolled' ? [hpRoll!] : [],
      ...(hpMethod === 'rolled' ? { hostHitPointRollCommandId: hpRollCommandId } : {}),
      subclassId: plan.proposedSubclassId,
      asiChoices,
      classChoiceSelections: classChoices,
      fighterFightingStyles: plan.classId === 'fighter' ? fighterStyles : undefined,
      fighterSubclassSelections: fighterChoices,
      spellSelections: spellPlan ? spellSelections : undefined,
    }
  }

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={styles.page}>
      <View style={styles.header}><View><Text style={styles.title}>角色升级</Text><Text style={styles.subtitle}>{character.name} · {character.level} → {Math.min(20, character.level + 1)}级</Text></View><Pressable style={styles.close} onPress={onClose}><Text style={styles.closeText}>关闭</Text></Pressable></View>
      <ScrollView contentContainerStyle={styles.content}>
        {!plans.length && <Text style={styles.warning}>该角色已达到等级上限，或当前规则包没有可用的升级定义。</Text>}
        <Text style={styles.section}>选择本次提升的职业</Text>
        <View style={styles.wrap}>{plans.map((candidate, index) => <Pressable key={`${candidate.classId}:${candidate.proposedSubclassId ?? 'base'}`} style={[styles.choice, index === planIndex && styles.choiceActive, !candidate.eligible && styles.disabled]} onPress={() => candidate.eligible && setPlanIndex(index)}><Text style={styles.choiceTitle}>{candidate.className}{candidate.proposedSubclassId ? ` · ${candidate.subclassOptions.find((entry) => entry.id === candidate.proposedSubclassId)?.name ?? candidate.proposedSubclassId}` : ''}</Text><Text style={styles.choiceMeta}>{candidate.fromClassLevel} → {candidate.toClassLevel}级{candidate.multiclass ? ' · 兼职' : ''}</Text>{candidate.disabledReason && <Text style={styles.choiceError}>{candidate.disabledReason}</Text>}</Pressable>)}</View>
        {plan && <>
          <Text style={styles.section}>本级固定获得</Text>
          <View style={styles.panel}>{plan.grantedFeatures.length ? plan.grantedFeatures.map((feature) => <View key={feature.id} style={styles.feature}><Text style={styles.featureTitle}>{feature.name}</Text><Text style={styles.body}>{feature.description}</Text></View>) : <Text style={styles.muted}>本级没有新的固定职业特性。</Text>}</View>

          <Text style={styles.section}>生命值成长</Text>
          <View style={styles.row}><ChoiceButton label={`固定值 ${Math.floor(plan.hitDie / 2) + 1}`} active={hpMethod === 'fixed'} onPress={() => setHpMethod('fixed')} /><ChoiceButton label={`投掷 d${plan.hitDie}`} active={hpMethod === 'rolled'} disabled={!plan.rolledHitPointsAllowed} onPress={() => setHpMethod('rolled')} />{hpMethod === 'rolled' && <Pressable disabled={hpRoll != null || hpRollBusy || busy} style={[styles.roll, (hpRoll != null || hpRollBusy || busy) && styles.disabled]} onPress={() => { setHpRollBusy(true); setError(''); void onRollHitPoints(plan.classId).then((issued) => { if (issued.hitDie !== plan.hitDie) throw new Error('Host 返回的生命骰与职业不一致。'); setHpRoll(issued.roll); setHpRollCommandId(issued.commandId) }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Host 生命骰投掷失败')).finally(() => setHpRollBusy(false)) }}><Text style={styles.rollText}>{hpRollBusy ? 'Host 正在投掷…' : hpRoll ? `结果 ${hpRoll} · 已锁定` : `由 Host 投掷 1d${plan.hitDie}`}</Text></Pressable>}</View>
          {hpMethod === 'rolled' && hpRoll != null && <Text style={styles.muted}>升级生命骰只能投掷一次，确认后不可重骰。</Text>}

          {plan.asiLevels.map((classLevel) => {
            const draft = asiDrafts[classLevel] ?? { mode: 'single' as const }
            return <View key={classLevel}><Text style={styles.section}>{classLevel}级 · 属性值提升或专长</Text><View style={styles.row}><ChoiceButton label="一项 +2" active={draft.mode === 'single'} onPress={() => setAsiDrafts((value) => ({ ...value, [classLevel]: { mode: 'single' } }))} /><ChoiceButton label="两项 +1" active={draft.mode === 'split'} onPress={() => setAsiDrafts((value) => ({ ...value, [classLevel]: { mode: 'split' } }))} /><ChoiceButton label="专长" active={draft.mode === 'feat'} onPress={() => setAsiDrafts((value) => ({ ...value, [classLevel]: { mode: 'feat' } }))} /></View>{draft.mode === 'feat' ? <View style={styles.wrap}>{plan.featOptions.map((feat) => <ChoiceButton key={feat.id} label={`${feat.name}${feat.disabledReason ? ` · ${feat.disabledReason}` : ''}`} active={draft.featId === feat.id} disabled={!feat.eligible} onPress={() => setAsiDrafts((value) => ({ ...value, [classLevel]: { mode: 'feat', featId: feat.id } }))} />)}</View> : <View style={styles.wrap}>{(Object.keys(abilityLabels) as AbilityKey[]).map((ability) => <ChoiceButton key={ability} label={`${abilityLabels[ability]} ${character.abilities[ability]}`} active={draft.first === ability || draft.second === ability} onPress={() => setAsiDrafts((value) => ({ ...value, [classLevel]: selectAbility(draft, ability) }))} />)}</View>}</View>
          })}

          {(plan.fighterStyleTargetLimit ?? 0) > 0 && <><Text style={styles.section}>战斗风格 · {fighterStyles.length}/{plan.fighterStyleTargetLimit}</Text><View style={styles.wrap}>{plan.fighterStyleOptions?.map((option) => <ChoiceButton key={option.id} label={option.name} active={fighterStyles.includes(option.id)} disabled={plan.fighterCurrentStyles?.includes(option.id)} onPress={() => setFighterStyles((current) => current.includes(option.id) ? current.filter((id) => id !== option.id) : current.length < (plan.fighterStyleTargetLimit ?? 0) ? [...current, option.id] : current)} />)}</View></>}

          {plan.choiceRequirements.map((requirement) => {
            const selected = requirement.kind === 'class' ? classChoices[requirement.key] ?? [] : fighterChoices[requirement.key] ?? []
            return <View key={`${requirement.kind}:${requirement.key}`}><Text style={styles.section}>{requirement.name}</Text>{requirement.description && <Text style={styles.muted}>{requirement.description}</Text>}<View style={styles.wrap}>{requirement.options.map((option) => <ChoiceButton key={option.id} label={option.name} active={selected.includes(option.id) || requirement.currentSelections.includes(option.id)} disabled={!requirement.replaceable && requirement.currentSelections.includes(option.id)} onPress={() => toggleChoice(requirement, option.id)} />)}</View></View>
          })}

          {plan.spellAdvancement?.selectionRequired && <SpellChoices plan={plan} selections={spellSelections} onToggle={toggleSpell} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable disabled={busy} style={[styles.confirm, busy && styles.disabled]} onPress={() => { const decision = buildDecision(); if (decision) void onConfirm(decision).catch((cause) => setError(cause instanceof Error ? levelUpError(cause.message) : '升级失败')) }}><Text style={styles.confirmText}>{busy ? '正在保存…' : `确认提升至 ${plan.toLevel} 级`}</Text></Pressable>
          <Text style={styles.lockNotice}>确认后玩家不能自行修改该次升级；DM 可在角色检视页修订。</Text>
        </>}
      </ScrollView>
    </View>
  </Modal>
}

function SpellChoices({ plan, selections, onToggle }: { plan: MobileLevelUpPlan; selections: MobileAdvancementSpellSelections; onToggle: (kind: keyof MobileAdvancementSpellSelections, spellId: string, maximum: number, locked?: boolean) => void }) {
  const spell = plan.spellAdvancement!
  return <View><Text style={styles.section}>施法成长</Text>
    <SpellGroup title={`戏法 ${selections.cantrips.length}/${spell.targetCantripCount}`} values={selections.cantrips} options={spell.cantripOptions} onToggle={(id) => onToggle('cantrips', id, spell.targetCantripCount)} />
    {spell.targetKnownSpellCount != null && <SpellGroup title={`已知法术 ${selections.knownSpells?.length ?? 0}/${spell.targetKnownSpellCount}`} values={selections.knownSpells ?? []} options={spell.spellOptions} onToggle={(id) => onToggle('knownSpells', id, spell.targetKnownSpellCount!)} />}
    {spell.targetWizardSpellbookCount != null && <SpellGroup title={`法师法术书 ${selections.wizardSpellbook?.length ?? 0}/${spell.targetWizardSpellbookCount}`} values={selections.wizardSpellbook ?? []} options={spell.spellOptions} locked={new Set(spell.previousWizardSpellbook)} onToggle={(id, locked) => onToggle('wizardSpellbook', id, spell.targetWizardSpellbookCount!, locked)} />}
  </View>
}

function SpellGroup({ title, values, options, locked = new Set<string>(), onToggle }: { title: string; values: string[]; options: Array<{ id: string; name: string; level: number }>; locked?: Set<string>; onToggle: (id: string, locked: boolean) => void }) {
  return <View style={styles.spellGroup}><Text style={styles.spellTitle}>{title}</Text><View style={styles.wrap}>{options.map((option) => <ChoiceButton key={option.id} label={`${option.name}${locked.has(option.id) ? ' · 已锁定' : ''}`} active={values.includes(option.id)} disabled={locked.has(option.id)} onPress={() => onToggle(option.id, locked.has(option.id))} />)}</View></View>
}

function selectAbility(draft: AsiDraft, ability: AbilityKey): AsiDraft {
  if (draft.mode === 'single') return { mode: 'single', first: ability }
  if (draft.mode !== 'split') return draft
  if (draft.first === ability) return { mode: 'split', second: draft.second }
  if (draft.second === ability) return { mode: 'split', first: draft.first }
  return draft.first ? { mode: 'split', first: draft.first, second: ability } : { mode: 'split', first: ability }
}

function ChoiceButton({ label, active, disabled, onPress }: { label: string; active?: boolean; disabled?: boolean; onPress: () => void }) {
  return <Pressable disabled={disabled} style={[styles.smallChoice, active && styles.smallChoiceActive, disabled && styles.disabled]} onPress={onPress}><Text style={styles.smallChoiceText}>{active ? '✓ ' : ''}{label}</Text></Pressable>
}

function levelUpError(message: string) {
  const reason = message.replace(/^level-up:/, '')
  return ({
    'multiclass-prerequisite': '不满足兼职职业的属性前提。', 'missing-asi-choice': '属性值提升或专长尚未选择。',
    'invalid-asi-choice': '属性值提升不合法或会超过 20。', 'invalid-feat': '专长不满足前提或规则包未安装。',
    'missing-class-choice': '职业或子职选项尚未选满。', 'invalid-class-choice': '职业或子职选项无效。',
    'missing-spell-choice': '法术选择尚未完成。', 'invalid-spell-choice': '法术选择不符合本级规则。',
    'class-content-version-mismatch': '角色绑定的职业规则包版本与当前房间不一致。',
  } as Record<string, string>)[reason] ?? message
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background }, header: { minHeight: 72, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { color: colors.text, fontSize: 20, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 11, marginTop: 3 }, close: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11 }, closeText: { color: colors.text, fontWeight: '800' }, content: { padding: 16, paddingBottom: 48 }, section: { color: '#ddd6fe', fontSize: 14, fontWeight: '900', marginTop: 18, marginBottom: 9 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { width: 180, minHeight: 66, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 14, padding: 11 }, choiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, choiceTitle: { color: colors.text, fontWeight: '900', fontSize: 12 }, choiceMeta: { color: colors.muted, fontSize: 9, marginTop: 4 }, choiceError: { color: colors.danger, fontSize: 8, marginTop: 4 }, panel: { borderWidth: 1, borderColor: colors.border, borderRadius: 15, overflow: 'hidden' }, feature: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, featureTitle: { color: colors.text, fontWeight: '900', fontSize: 12 }, body: { color: '#c9c4d2', fontSize: 10, lineHeight: 17, marginTop: 5 }, muted: { color: colors.muted, fontSize: 10, lineHeight: 17 }, row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, smallChoice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, smallChoiceActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, smallChoiceText: { color: colors.text, fontSize: 10, fontWeight: '800' }, roll: { borderRadius: 10, backgroundColor: '#164e63', paddingHorizontal: 13, paddingVertical: 9 }, rollText: { color: '#a5f3fc', fontWeight: '900', fontSize: 10 }, spellGroup: { marginBottom: 12, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13 }, spellTitle: { color: colors.teal, fontSize: 11, fontWeight: '900', marginBottom: 8 }, error: { marginTop: 16, color: '#fecdd3', backgroundColor: '#36131f', borderWidth: 1, borderColor: colors.danger, borderRadius: 12, padding: 11, fontSize: 11 }, warning: { color: '#fde68a', padding: 12 }, confirm: { marginTop: 20, borderRadius: 14, backgroundColor: colors.primary, padding: 15, alignItems: 'center' }, confirmText: { color: 'white', fontWeight: '900', fontSize: 14 }, lockNotice: { color: colors.muted, textAlign: 'center', fontSize: 9, marginTop: 9 }, disabled: { opacity: .38 },
})
