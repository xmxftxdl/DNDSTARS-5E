import { useEffect, useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SKILLS, type AbilityKey } from '../../../../src/lib/dnd'
import {
  dnd5eClassAbilityPriority,
  dnd5eFlexibleRacialAbilityBonus,
  dnd5eRacialAbilityBonuses,
  recommendedHalfElfAbilityChoices,
} from '../../../../src/rulesets/dnd5e/characterSetup'
import { dnd5eClassChoiceLimit, dnd5eClassDefinition } from '../../../../src/rulesets/dnd5e/classes'
import { dnd5eCoreRaceMechanics } from '../../../../src/rulesets/dnd5e/coreRaceMechanics'
import { FIGHTER_FIGHTING_STYLE_OPTIONS } from '../../../../src/rulesets/dnd5e/fighter'
import {
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginRaceDefinition,
  registeredDnd5ePluginSubclasses,
} from '../../../../src/rulesets/dnd5e/pluginApi'
import { DND5E_DRAGONBORN_ANCESTRIES, type Dnd5eDragonbornAncestryId } from '../../../../src/rulesets/dnd5e/racialAutomation'
import {
  buildDnd5eSpellAdvancementPlanFromSelections,
  dnd5eSpellAdvancementSelectionsComplete,
} from '../../../../src/rulesets/dnd5e/spellAdvancement'
import {
  defaultDnd5eStartingEquipmentSelection,
  dnd5eStartingEquipmentPickerItems,
  dnd5eStartingEquipmentPickerKey,
  dnd5eStartingEquipmentPlan,
  normalizeDnd5eStartingEquipmentSelection,
  type Dnd5eStartingEquipmentPlan,
  type Dnd5eStartingEquipmentSelection,
} from '../../../../src/rulesets/dnd5e/startingEquipment'
import type { Dnd5eSpellAdvancementPlan } from '../../../../src/rulesets/dnd5e/spellAdvancement'
import type { Character, Dnd5eAdvancementSpellSelectionsV1 } from '../../../../src/types/character'
import {
  MOBILE_ABILITY_KEYS,
  MOBILE_CHARACTER_ALIGNMENT_OPTIONS,
  mobileCharacterCreationCatalog,
  type MobileAbilityGenerationMethod,
  type MobileAbilityRollInput,
  type MobileBaseAbilities,
  type MobileCharacterCreationInput,
  type MobileCharacterCreationOption,
} from '../character/createMobileCharacter'
import { colors } from '../theme'

export function CharacterCreateModal({
  visible,
  busy,
  onClose,
  onCreate,
  onRollAbilities,
}: {
  visible: boolean
  busy: boolean
  onClose: () => void
  onCreate: (input: MobileCharacterCreationInput) => Promise<void>
  onRollAbilities: () => Promise<{ commandId: string; rolls: MobileAbilityRollInput[] }>
}) {
  const [name, setName] = useState('')
  const [charClass, setCharClass] = useState<string>('战士')
  const [race, setRace] = useState<string>('人类')
  const [background, setBackground] = useState<string>('侍僧')
  const [alignment, setAlignment] = useState<string>('中立善良')
  const [targetLevel, setTargetLevel] = useState(1)
  const [abilityMethod, setAbilityMethod] = useState<MobileAbilityGenerationMethod>('standard-array')
  const [selectedAbility, setSelectedAbility] = useState<AbilityKey>('str')
  const [assignments, setAssignments] = useState<Record<AbilityKey, number | null>>(() => emptyAssignments())
  const [pointAbilities, setPointAbilities] = useState<MobileBaseAbilities>(() => allAbilities(8))
  const [abilityRolls, setAbilityRolls] = useState<MobileAbilityRollInput[]>([])
  const [hostAbilityRollCommandId, setHostAbilityRollCommandId] = useState('')
  const [rollingAbilities, setRollingAbilities] = useState(false)
  const [racialBonusChoices, setRacialBonusChoices] = useState<AbilityKey[]>([])
  const [racialSkillProficiencies, setRacialSkillProficiencies] = useState<string[]>([])
  const [classSkillProficiencies, setClassSkillProficiencies] = useState<string[]>([])
  const [fighterStyles, setFighterStyles] = useState<string[]>([])
  const [subclassId, setSubclassId] = useState('')
  const [initialSelections, setInitialSelections] = useState<Record<string, string[]>>({})
  const [initialSpellSelections, setInitialSpellSelections] = useState<Dnd5eAdvancementSpellSelectionsV1>()
  const [dragonbornAncestry, setDragonbornAncestry] = useState<Dnd5eDragonbornAncestryId>('black')
  const [startingEquipment, setStartingEquipment] = useState<Dnd5eStartingEquipmentSelection>(() => ({ optionIds: {}, equipmentIds: {} }))
  const [error, setError] = useState('')
  const catalog = useMemo(() => mobileCharacterCreationCatalog(), [visible])
  const definition = dnd5eClassDefinition(charClass)
  const raceDefinition = dnd5ePluginRaceDefinition(race)
  const coreRace = dnd5eCoreRaceMechanics(raceDefinition?.name ?? race, raceDefinition?.id)
  const backgroundDefinition = dnd5ePluginBackgroundDefinition(background)
  const classSkillOptions = definition?.skillProficiencies === 'any' ? SKILLS.map((skill) => skill.key) : definition?.skillProficiencies ?? []
  const racialSkillChoiceCount = raceDefinition?.skillProficiencyChoiceCount ?? coreRace?.skillProficiencyChoiceCount ?? 0
  const equipmentPlan = useMemo(() => dnd5eStartingEquipmentPlan(definition?.name ?? charClass, backgroundDefinition?.name ?? background), [background, backgroundDefinition?.name, charClass, definition?.name])
  const subclassOptions = definition?.subclassLevel === 1 ? [definition.subclass, ...registeredDnd5ePluginSubclasses(definition.id)] : []
  const initialChoiceGroups = definition?.id === 'fighter' ? [] : (definition?.choiceGroups ?? []).filter((group) => group.level <= 1)
  const initialSpellPlan = definition ? buildDnd5eSpellAdvancementPlanFromSelections({ classId: definition.id, fromClassLevel: 0, toClassLevel: 1, subclassId: subclassId || undefined, selections: {} }) : undefined
  const effectiveInitialSpellSelections = initialSpellPlan?.selectionRequired ? initialSpellSelections ?? initialSpellPlan.defaultSelections : undefined
  const method = catalog.abilityMethods.find((entry) => entry.id === abilityMethod)?.definition ?? catalog.abilityMethods[0]!.definition
  useEffect(() => {
    if (!visible) return setError('')
    if (!catalog.classes.some((entry) => entry.id === charClass)) setCharClass(catalog.classes[0]?.id ?? 'fighter')
    if (!catalog.races.some((entry) => entry.id === race)) setRace(catalog.races[0]?.id ?? '人类')
    if (!catalog.backgrounds.some((entry) => entry.id === background)) setBackground(catalog.backgrounds[0]?.id ?? '侍僧')
    if (!catalog.abilityMethods.some((entry) => entry.id === abilityMethod)) setAbilityMethod(catalog.abilityMethods[0]?.id ?? 'standard-array')
  }, [abilityMethod, background, catalog, charClass, race, visible])
  useEffect(() => {
    if (!visible) return
    setClassSkillProficiencies([])
    setFighterStyles([])
    setSubclassId('')
    setInitialSelections({})
    setInitialSpellSelections(undefined)
  }, [charClass, visible])
  useEffect(() => {
    if (!visible) return
    setRacialBonusChoices([])
    setRacialSkillProficiencies([])
    setDragonbornAncestry('black')
  }, [race, visible])
  useEffect(() => {
    if (!visible) return
    setStartingEquipment(defaultDnd5eStartingEquipmentSelection(equipmentPlan))
  }, [equipmentPlan, visible])

  const pool = method.kind === 'standard-array' ? [...method.scores] : abilityRolls.map((roll) => roll.total)
  const baseAbilities = useMemo<MobileBaseAbilities>(() => method.kind === 'point-buy'
    ? { ...pointAbilities }
    : Object.fromEntries(MOBILE_ABILITY_KEYS.map((ability) => [ability, assignments[ability] == null ? 0 : pool[assignments[ability]!]])) as MobileBaseAbilities,
  [assignments, method.kind, pointAbilities, pool.join(',')])
  const pointRemaining = method.kind === 'point-buy'
    ? method.budget - MOBILE_ABILITY_KEYS.reduce((spent, ability) => spent + (method.costs[pointAbilities[ability]] ?? Number.POSITIVE_INFINITY), 0)
    : 0
  const abilityReady = method.kind === 'point-buy'
    ? pointRemaining === 0
    : pool.length === 6 && MOBILE_ABILITY_KEYS.every((ability) => assignments[ability] != null)
  const raceLabel = catalog.races.find((entry) => entry.id === race)?.label ?? race
  const classLabel = catalog.classes.find((entry) => entry.id === charClass)?.label ?? charClass
  const flexible = dnd5eFlexibleRacialAbilityBonus(raceDefinition?.id ?? race)
  const recommendedFlexibleChoices = raceLabel === '半精灵'
    ? recommendedHalfElfAbilityChoices(classLabel)
    : flexible ? dnd5eClassAbilityPriority(classLabel).filter((ability) => !(flexible.exclude ?? []).includes(ability)).slice(0, flexible.count) : []
  const flexibleChoices = racialBonusChoices.length ? racialBonusChoices : recommendedFlexibleChoices
  const racialBonuses = dnd5eRacialAbilityBonuses(race, flexibleChoices)
  const classChoicesReady = !!definition && classSkillProficiencies.length === definition.skillChoiceCount &&
    (definition.id !== 'fighter' || fighterStyles.length === 1) &&
    (definition.subclassLevel !== 1 || !!subclassId) &&
    initialChoiceGroups.every((group) => (initialSelections[group.id] ?? []).length === dnd5eClassChoiceLimit(group, 1)) &&
    (!initialSpellPlan?.selectionRequired || dnd5eSpellAdvancementSelectionsComplete(initialSpellPlan, effectiveInitialSpellSelections))
  const racialChoicesReady = (!flexible || racialBonusChoices.length === flexible.count) && racialSkillProficiencies.length === racialSkillChoiceCount
  const creationReady = abilityReady && classChoicesReady && racialChoicesReady

  const submit = async () => {
    if (!name.trim()) return setError('请填写角色名称。')
    if (!abilityReady) return setError(method.kind === 'point-buy' ? `请用完 ${method.budget} 点购点预算。` : '请将六个属性值各分配一次。')
    if (!racialChoicesReady) return setError('种族属性或技能选择尚未完成。')
    if (!classChoicesReady || !definition) return setError('1级职业、子职、技能或法术选择尚未完成。')
    const initialClassChoices: Character['dnd5eClassChoices'] = definition.id === 'fighter'
      ? { fighter: { fightingStyles: [...fighterStyles] as NonNullable<NonNullable<Character['dnd5eClassChoices']>['fighter']>['fightingStyles'] } }
      : { classes: { [definition.id]: {
          ...(definition.subclassLevel === 1 && subclassId ? { subclass: subclassId } : {}),
          selections: {
            'class-skills': [...classSkillProficiencies],
            ...Object.fromEntries(Object.entries(initialSelections).map(([key, values]) => [key, [...values]])),
            ...(initialSpellPlan?.selectionRequired && effectiveInitialSpellSelections ? {
              [initialSpellPlan.cantripSelectionKey]: [...effectiveInitialSpellSelections.cantrips],
              ...(initialSpellPlan.targetKnownSpellCount == null ? {} : { [initialSpellPlan.spellSelectionKey]: [...(effectiveInitialSpellSelections.knownSpells ?? [])] }),
              ...(initialSpellPlan.targetWizardSpellbookCount == null ? {} : { 'wizard-spellbook': [...(effectiveInitialSpellSelections.wizardSpellbook ?? [])] }),
            } : {}),
          },
        } } }
    setError('')
    try { await onCreate({
      name, charClass, race, background, alignment, abilityMethod, baseAbilities, targetLevel,
      racialBonusChoices, racialSkillProficiencies, classSkillProficiencies,
      ...(coreRace?.id === 'dragonborn' ? { dragonbornAncestry } : {}),
      startingEquipment: normalizeDnd5eStartingEquipmentSelection(equipmentPlan, startingEquipment),
      initialClassChoices,
      ...(effectiveInitialSpellSelections ? { initialSpellSelections: effectiveInitialSpellSelections } : {}),
      ...(method.kind === 'roll' ? {
        hostAbilityRollCommandId,
        abilityRolls: abilityRolls.map((roll) => ({ dice: [...roll.dice], discardedIndices: [...roll.discardedIndices], total: roll.total })),
        rollAssignments: Object.fromEntries(MOBILE_ABILITY_KEYS.map((ability) => [ability, assignments[ability]!])),
      } : {}),
    }) } catch (cause) {
      setError(cause instanceof Error ? cause.message : '角色创建失败')
    }
  }

  return <Modal visible={visible} transparent animationType="fade" supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View style={styles.modal}>
        <View style={styles.header}><View><Text style={styles.title}>创建 D&D 5e 角色</Text><Text style={styles.subtitle}>先完成 1 级选择；高等级角色之后仍会逐级确认成长。</Text></View><Pressable disabled={busy} onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>角色名称</Text><TextInput value={name} onChangeText={setName} editable={!busy} maxLength={80} placeholder="输入角色名称" placeholderTextColor={colors.muted} style={styles.input} />
          <ChoiceSection label="职业" values={catalog.classes} selected={charClass} onSelect={setCharClass} disabled={busy} />
          <ChoiceSection label="种族" values={catalog.races} selected={race} onSelect={setRace} disabled={busy} />
          {flexible && <SelectionGroup title={`种族属性调整 · 选择 ${flexible.count} 项`} options={MOBILE_ABILITY_KEYS.filter((ability) => !(flexible.exclude ?? []).includes(ability)).map((ability) => ({ id: ability, label: ABILITY_LABELS[ability] }))} selected={racialBonusChoices} limit={flexible.count} onChange={(values) => setRacialBonusChoices(values as AbilityKey[])} />}
          {racialSkillChoiceCount > 0 && <SelectionGroup title={`种族技能熟练 · 选择 ${racialSkillChoiceCount} 项`} options={SKILLS.map((skill) => ({ id: skill.key, label: skill.label }))} selected={racialSkillProficiencies} limit={racialSkillChoiceCount} onChange={setRacialSkillProficiencies} />}
          {coreRace?.id === 'dragonborn' && <SelectionGroup title="龙裔血统" options={DND5E_DRAGONBORN_ANCESTRIES.map((entry) => ({ id: entry.id, label: `${entry.name} · ${entry.damageType}` }))} selected={[dragonbornAncestry]} limit={1} onChange={(values) => setDragonbornAncestry((values[0] || 'black') as Dnd5eDragonbornAncestryId)} />}
          <View style={styles.abilityPanel}>
            <Text style={styles.panelTitle}>属性生成与分配</Text>
            <View style={styles.methodRow}>{catalog.abilityMethods.map((entry) => <Pressable key={entry.id} disabled={busy} style={[styles.method, abilityMethod === entry.id && styles.methodActive]} onPress={() => { setAbilityMethod(entry.id); setAssignments(emptyAssignments()); setAbilityRolls([]); setHostAbilityRollCommandId(''); setPointAbilities(allAbilities(entry.definition.kind === 'point-buy' ? entry.definition.minimum : 8)); setSelectedAbility('str') }}><Text style={[styles.methodText, abilityMethod === entry.id && styles.methodTextActive]}>{entry.label}{entry.plugin ? ' · 扩展' : ''}</Text></Pressable>)}</View>
            {method.kind === 'point-buy'
              ? <><Text style={[styles.budget, pointRemaining < 0 && styles.budgetInvalid]}>剩余 {pointRemaining} / {method.budget} 点</Text><View style={styles.abilityGrid}>{MOBILE_ABILITY_KEYS.map((ability) => <AbilityScoreCard key={ability} ability={ability} score={pointAbilities[ability]} bonus={racialBonuses[ability]} onDecrease={() => setPointAbilities((current) => ({ ...current, [ability]: Math.max(method.minimum, current[ability] - 1) }))} onIncrease={() => setPointAbilities((current) => {
                const next = { ...current, [ability]: Math.min(method.maximum, current[ability] + 1) }
                const remaining = method.budget - MOBILE_ABILITY_KEYS.reduce((spent, key) => spent + (method.costs[next[key]] ?? Number.POSITIVE_INFINITY), 0)
                return remaining < 0 ? current : next
              })} />)}</View></>
              : <><View style={styles.assignmentHelp}><Text style={styles.assignmentHelpText}>先点选一项属性，再点下方数值。已使用的数值会与原位置交换。</Text>{method.kind === 'roll' && <Pressable disabled={busy || rollingAbilities || abilityRolls.length > 0} style={[styles.rollButton, (busy || rollingAbilities || abilityRolls.length > 0) && styles.disabled]} onPress={() => { setRollingAbilities(true); setError(''); void onRollAbilities().then((issued) => { setAbilityRolls(issued.rolls); setHostAbilityRollCommandId(issued.commandId); setAssignments(emptyAssignments()) }).catch((cause) => setError(cause instanceof Error ? cause.message : 'Host 属性骰投掷失败')).finally(() => setRollingAbilities(false)) }}><Text style={styles.rollButtonText}>{rollingAbilities ? 'Host 正在投掷…' : abilityRolls.length ? '六组结果已锁定' : '由 Host 投掷六组属性'}</Text></Pressable>}</View><View style={styles.abilityGrid}>{MOBILE_ABILITY_KEYS.map((ability) => <Pressable key={ability} style={[styles.assignCard, selectedAbility === ability && styles.assignCardActive]} onPress={() => setSelectedAbility(ability)}><Text style={styles.abilityName}>{ABILITY_LABELS[ability]}</Text><Text style={styles.abilityScore}>{baseAbilities[ability] || '—'}</Text><Text style={styles.finalScore}>种族 {signed(racialBonuses[ability])} · 最终 {baseAbilities[ability] ? baseAbilities[ability] + racialBonuses[ability] : '—'}</Text></Pressable>)}</View><View style={styles.poolRow}>{pool.length ? pool.map((score, index) => {
                const owner = MOBILE_ABILITY_KEYS.find((ability) => assignments[ability] === index)
                const detail = method.kind === 'roll' ? abilityRolls[index]?.dice.join('、') : ''
                return <Pressable key={`${index}-${score}`} style={[styles.poolChip, owner && styles.poolChipUsed]} onPress={() => assignPoolValue(selectedAbility, index, assignments, setAssignments)}><Text style={styles.poolScore}>{score}</Text>{!!owner && <Text style={styles.poolOwner}>{ABILITY_LABELS[owner]}</Text>}{detail && <Text style={styles.poolDice}>{detail}</Text>}</Pressable>
              }) : <Text style={styles.rollPrompt}>请先投掷六组 4d6。</Text>}</View></>}
          </View>
          <View style={styles.twoColumns}><View style={styles.column}><ChoiceSection label="背景" values={catalog.backgrounds} selected={background} onSelect={setBackground} disabled={busy} /></View><View style={styles.column}><ChoiceSection label="阵营" values={MOBILE_CHARACTER_ALIGNMENT_OPTIONS.map((label) => ({ id: label, label, plugin: false }))} selected={alignment} onSelect={setAlignment} disabled={busy} /></View></View>
          <Text style={styles.label}>起始等级</Text><View style={styles.levelRow}>{[1, 3, 5, 7, 10, 15, 20].map((level) => <Pressable key={level} style={[styles.levelChoice, targetLevel === level && styles.choiceSelected]} onPress={() => setTargetLevel(level)}><Text style={[styles.choiceText, targetLevel === level && styles.choiceTextSelected]}>{level}级</Text></Pressable>)}</View>
          {definition && <SelectionGroup title={`职业技能熟练 · 选择 ${definition.skillChoiceCount} 项`} options={classSkillOptions.map((skill) => ({ id: skill, label: SKILLS.find((entry) => entry.key === skill)?.label ?? skill }))} selected={classSkillProficiencies} limit={definition.skillChoiceCount} onChange={setClassSkillProficiencies} />}
          {definition?.id === 'fighter' && <SelectionGroup title="战斗风格 · 选择 1 项" options={FIGHTER_FIGHTING_STYLE_OPTIONS.map((entry) => ({ id: entry.id, label: entry.name }))} selected={fighterStyles} limit={1} onChange={setFighterStyles} />}
          {!!subclassOptions.length && <SelectionGroup title="1级子职" options={subclassOptions.map((entry) => ({ id: entry.id, label: entry.name }))} selected={subclassId ? [subclassId] : []} limit={1} onChange={(values) => { setSubclassId(values[0] ?? ''); setInitialSelections({}); setInitialSpellSelections(undefined) }} />}
          {initialChoiceGroups.map((group) => <SelectionGroup key={group.id} title={`${group.name} · 选择 ${dnd5eClassChoiceLimit(group, 1)} 项`} options={group.options.map((entry) => ({ id: entry.id, label: entry.name }))} selected={initialSelections[group.id] ?? []} limit={dnd5eClassChoiceLimit(group, 1)} onChange={(values) => setInitialSelections((current) => ({ ...current, [group.id]: values }))} />)}
          {initialSpellPlan?.selectionRequired && effectiveInitialSpellSelections && <InitialSpellChoices plan={initialSpellPlan} selections={effectiveInitialSpellSelections} onChange={setInitialSpellSelections} />}
          <StartingEquipmentChoices plan={equipmentPlan} selection={startingEquipment} onChange={setStartingEquipment} />
          <View style={styles.summary}><Text style={styles.summaryTitle}>规则确认</Text><Text style={styles.summaryText}>种族调整、职业技能、法术、子职和起始装备均按以上选择写入。若选择高等级，创建后会逐级弹出成长页面，不能跳级。</Text></View>
          {!!error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.footer}><Pressable disabled={busy} style={styles.cancel} onPress={onClose}><Text style={styles.cancelText}>取消</Text></Pressable><Pressable disabled={busy || !creationReady} style={[styles.submit, (busy || !creationReady) && styles.disabled]} onPress={() => void submit()}><Text style={styles.submitText}>{busy ? '正在写入房间…' : `创建 ${targetLevel} 级角色`}</Text></Pressable></View>
      </View>
    </View>
  </Modal>
}

function ChoiceSection({ label, values, selected, onSelect, disabled }: { label: string; values: readonly MobileCharacterCreationOption[]; selected: string; onSelect: (value: string) => void; disabled: boolean }) {
  return <View style={styles.section}><Text style={styles.label}>{label}</Text><View style={styles.choices}>{values.map((value) => <Pressable key={value.id} disabled={disabled} style={[styles.choice, selected === value.id && styles.choiceSelected]} onPress={() => onSelect(value.id)}><Text style={[styles.choiceText, selected === value.id && styles.choiceTextSelected]}>{value.label}{value.plugin ? ' · 扩展' : ''}</Text></Pressable>)}</View></View>
}

function SelectionGroup({ title, options, selected, limit, onChange }: {
  title: string
  options: readonly { id: string; label: string }[]
  selected: readonly string[]
  limit: number
  onChange: (values: string[]) => void
}) {
  return <View style={styles.selectionPanel}><Text style={styles.panelTitle}>{title} · {selected.length}/{limit}</Text><View style={styles.choices}>{options.map((option) => {
    const active = selected.includes(option.id)
    return <Pressable key={option.id} style={[styles.choice, active && styles.choiceSelected]} onPress={() => onChange(active ? selected.filter((id) => id !== option.id) : selected.length < limit ? [...selected, option.id] : [...selected])}><Text style={[styles.choiceText, active && styles.choiceTextSelected]}>{active ? '✓ ' : ''}{option.label}</Text></Pressable>
  })}</View></View>
}

function InitialSpellChoices({ plan, selections, onChange }: {
  plan: Dnd5eSpellAdvancementPlan
  selections: Dnd5eAdvancementSpellSelectionsV1
  onChange: (value: Dnd5eAdvancementSpellSelectionsV1) => void
}) {
  return <View style={styles.selectionPanel}><Text style={styles.panelTitle}>1级施法选择</Text>
    <SelectionGroup title="戏法" options={plan.cantripOptions.map((spell) => ({ id: spell.id, label: spell.name }))} selected={selections.cantrips} limit={plan.targetCantripCount} onChange={(values) => onChange({ ...selections, cantrips: values })} />
    {plan.targetKnownSpellCount != null && <SelectionGroup title="已知法术" options={plan.spellOptions.map((spell) => ({ id: spell.id, label: spell.name }))} selected={selections.knownSpells ?? []} limit={plan.targetKnownSpellCount} onChange={(values) => onChange({ ...selections, knownSpells: values })} />}
    {plan.targetWizardSpellbookCount != null && <SelectionGroup title="法师法术书" options={plan.spellOptions.map((spell) => ({ id: spell.id, label: spell.name }))} selected={selections.wizardSpellbook ?? []} limit={plan.targetWizardSpellbookCount} onChange={(values) => onChange({ ...selections, wizardSpellbook: values })} />}
  </View>
}

function StartingEquipmentChoices({ plan, selection, onChange }: {
  plan: Dnd5eStartingEquipmentPlan
  selection: Dnd5eStartingEquipmentSelection
  onChange: (value: Dnd5eStartingEquipmentSelection) => void
}) {
  return <View style={styles.selectionPanel}><Text style={styles.panelTitle}>起始装备</Text>{plan.groups.map((group) => {
    const optionId = selection.optionIds[group.id] ?? group.options[0]?.id ?? ''
    const option = group.options.find((entry) => entry.id === optionId) ?? group.options[0]
    return <View key={group.id} style={styles.equipmentGroup}><Text style={styles.label}>{group.label}</Text><View style={styles.choices}>{group.options.map((entry) => <Pressable key={entry.id} style={[styles.choice, entry.id === optionId && styles.choiceSelected]} onPress={() => {
      const optionIds = { ...selection.optionIds, [group.id]: entry.id }
      const equipmentIds = { ...selection.equipmentIds }
      for (const picker of entry.pickers ?? []) equipmentIds[dnd5eStartingEquipmentPickerKey(group.id, picker.id)] = 'equipmentIds' in picker ? picker.defaultEquipmentId : picker.defaultTemplateId
      onChange({ optionIds, equipmentIds })
    }}><Text style={[styles.choiceText, entry.id === optionId && styles.choiceTextSelected]}>{entry.label}</Text></Pressable>)}</View>{option?.pickers?.map((picker) => {
      const key = dnd5eStartingEquipmentPickerKey(group.id, picker.id)
      const fallbackId = 'equipmentIds' in picker ? picker.defaultEquipmentId : picker.defaultTemplateId
      const selectedId = selection.equipmentIds[key] ?? fallbackId
      return <SelectionGroup key={key} title={picker.label} options={dnd5eStartingEquipmentPickerItems(picker).map((item) => ({ id: item.id, label: item.name }))} selected={[selectedId]} limit={1} onChange={(values) => onChange({ ...selection, equipmentIds: { ...selection.equipmentIds, [key]: values[0] ?? fallbackId } })} />
    })}</View>
  })}</View>
}

const ABILITY_LABELS: Record<AbilityKey, string> = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }

function allAbilities(score: number): MobileBaseAbilities {
  return { str: score, dex: score, con: score, int: score, wis: score, cha: score }
}

function emptyAssignments(): Record<AbilityKey, number | null> {
  return { str: null, dex: null, con: null, int: null, wis: null, cha: null }
}

function signed(value: number) {
  return value >= 0 ? `+${value}` : String(value)
}

function assignPoolValue(
  ability: AbilityKey,
  index: number,
  assignments: Record<AbilityKey, number | null>,
  setAssignments: (value: Record<AbilityKey, number | null>) => void,
) {
  const next = { ...assignments }
  const formerIndex = next[ability]
  const formerOwner = MOBILE_ABILITY_KEYS.find((candidate) => candidate !== ability && next[candidate] === index)
  next[ability] = index
  if (formerOwner) next[formerOwner] = formerIndex
  setAssignments(next)
}

function AbilityScoreCard({ ability, score, bonus, onDecrease, onIncrease }: {
  ability: AbilityKey
  score: number
  bonus: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return <View style={styles.pointCard}><Text style={styles.abilityName}>{ABILITY_LABELS[ability]}</Text><View style={styles.stepper}><Pressable style={styles.stepButton} onPress={onDecrease}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.abilityScore}>{score}</Text><Pressable style={styles.stepButton} onPress={onIncrease}><Text style={styles.stepText}>＋</Text></Pressable></View><Text style={styles.finalScore}>种族 {signed(bonus)} · 最终 {score + bonus}</Text></View>
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#02030ad9', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modal: { width: '94%', maxWidth: 1040, maxHeight: '92%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, overflow: 'hidden' },
  header: { paddingHorizontal: 22, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 22, fontWeight: '900' }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 4 }, close: { color: colors.muted, fontSize: 30, paddingHorizontal: 8 },
  content: { padding: 22, gap: 10 }, label: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 7 },
  input: { color: colors.text, backgroundColor: '#090a17', borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  section: { marginTop: 4 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#090a17', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  choiceSelected: { borderColor: colors.primary, backgroundColor: '#342064' }, choiceText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, choiceTextSelected: { color: '#fff' },
  abilityPanel: { marginTop: 8, borderWidth: 1, borderColor: '#4c3b72', backgroundColor: '#0b0b17', borderRadius: 16, padding: 14 }, panelTitle: { color: colors.text, fontSize: 15, fontWeight: '900' }, methodRow: { flexDirection: 'row', gap: 7, marginTop: 10 }, method: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 9, backgroundColor: '#10101d' }, methodActive: { borderColor: colors.primary, backgroundColor: '#342064' }, methodText: { color: colors.muted, fontSize: 10, fontWeight: '800' }, methodTextActive: { color: '#fff' }, budget: { color: colors.teal, fontSize: 11, fontWeight: '900', marginTop: 10 }, budgetInvalid: { color: colors.danger }, abilityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, assignCard: { width: '15.3%', minWidth: 92, borderWidth: 1, borderColor: colors.border, backgroundColor: '#11111f', borderRadius: 12, padding: 9, alignItems: 'center' }, assignCardActive: { borderColor: colors.warning, backgroundColor: '#30230f' }, pointCard: { width: '15.3%', minWidth: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: '#11111f', borderRadius: 12, padding: 9, alignItems: 'center' }, abilityName: { color: colors.muted, fontSize: 10, fontWeight: '800' }, abilityScore: { color: colors.text, fontSize: 20, fontWeight: '900', minWidth: 28, textAlign: 'center', marginTop: 3 }, finalScore: { color: '#b9a7e7', fontSize: 8, fontWeight: '700', marginTop: 4 }, stepper: { flexDirection: 'row', alignItems: 'center', gap: 5 }, stepButton: { width: 25, height: 25, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 3 }, stepText: { color: '#d8ccff', fontSize: 15, fontWeight: '900' }, assignmentHelp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }, assignmentHelpText: { flex: 1, color: colors.muted, fontSize: 9, lineHeight: 14 }, rollButton: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 }, rollButtonText: { color: '#ded5ff', fontSize: 9, fontWeight: '900' }, poolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 }, poolChip: { minWidth: 68, borderWidth: 1, borderColor: colors.primary, backgroundColor: '#171329', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, alignItems: 'center' }, poolChipUsed: { borderColor: colors.teal, backgroundColor: '#0b2929' }, poolScore: { color: colors.text, fontSize: 16, fontWeight: '900' }, poolOwner: { color: colors.teal, fontSize: 8, fontWeight: '900' }, poolDice: { color: colors.muted, fontSize: 7, marginTop: 2 }, rollPrompt: { color: colors.warning, fontSize: 10, fontWeight: '800' },
  twoColumns: { flexDirection: 'row', gap: 18 }, column: { flex: 1 }, summary: { marginTop: 7, borderWidth: 1, borderColor: '#155e75', backgroundColor: '#06202b', borderRadius: 12, padding: 12 }, summaryTitle: { color: '#67e8f9', fontWeight: '900', fontSize: 12 }, summaryText: { color: '#bae6fd', fontSize: 11, lineHeight: 18, marginTop: 4 },
  selectionPanel: { marginTop: 9, borderWidth: 1, borderColor: '#312a48', backgroundColor: '#0b0b17', borderRadius: 15, padding: 13, gap: 9 }, equipmentGroup: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10, gap: 7 }, levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, levelChoice: { minWidth: 56, alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: '#090a17', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  error: { color: colors.danger, fontSize: 12, fontWeight: '700' }, footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancel: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 11 }, cancelText: { color: colors.text, fontWeight: '800' },
  submit: { backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 11 }, submitText: { color: '#fff', fontWeight: '900' }, disabled: { opacity: .5 },
})
