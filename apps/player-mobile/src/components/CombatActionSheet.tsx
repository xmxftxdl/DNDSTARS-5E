import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileActionDescriptorV1, MobilePlayerWorkspace, MobileSpellView, PlayerTokenView } from '../../../../packages/mobile-protocol/src'
import { dnd5eSpellActionIcon } from '../../../../src/lib/dnd5eActionIcons'
import { DND5E_SRD_COMBAT_SPELLS } from '../../../../src/rulesets/dnd5e/spells'
import { cellsForAoe } from '../../../../src/lib/skillTargeting'
import { colors } from '../theme'
import { SafeAreaView } from 'react-native-safe-area-context'
import { mobileAvailableSpellSlotLevels, mobileSpellBaseSlotLevel } from './mobileSpellCasting'
import type { Dnd5eBasicActionPayload, Dnd5eMetamagicId, Dnd5eWeaponAttackOptions } from '../../../../src/lib/sharedCombatTypes'
import { mobileItemUseCommand, mobileWeaponAttackCommand } from '../services/mobileActionCommands'
import { defaultSpellIntent, isMetamagicId, metamagicLabel, metamagicPayload, spellChoiceOptions, spellPayloadIntent, spellTargetCapacity, type MobileSpellIntent } from '../services/mobileSpellIntents'
import { mobileBasicActionDescriptors } from '../services/actionRegistry'

export type ActionTab = 'actions' | 'spells' | 'items' | 'features' | 'checks'

const mobileSkills = [
  ['acrobatics', '杂技', 'dex'], ['animalHandling', '驯兽', 'wis'], ['arcana', '奥秘', 'int'],
  ['athletics', '运动', 'str'], ['deception', '欺瞒', 'cha'], ['history', '历史', 'int'],
  ['insight', '洞悉', 'wis'], ['intimidation', '威吓', 'cha'], ['investigation', '调查', 'int'],
  ['medicine', '医药', 'wis'], ['nature', '自然', 'int'], ['perception', '察觉', 'wis'],
  ['performance', '表演', 'cha'], ['persuasion', '游说', 'cha'], ['religion', '宗教', 'int'],
  ['sleightOfHand', '巧手', 'dex'], ['stealth', '隐匿', 'dex'], ['survival', '生存', 'wis'],
] as const
const signed = (value: number) => value >= 0 ? `+${value}` : `${value}`

export interface PendingMapTarget {
  kind: 'token' | 'area'
  label: string
  complete: (input: PlayerTokenView | { x: number; y: number }) => Promise<void>
  finishLabel?: string
  finish?: () => Promise<void>
}

export function CombatActionSheet({ visible, initialTab = 'actions', workspace, assetBaseUrl, onClose, onSubmit, onBeginMapTarget }: {
  visible: boolean
  initialTab?: ActionTab
  workspace: MobilePlayerWorkspace
  assetBaseUrl: string
  onClose: () => void
  onSubmit: (patch: Record<string, unknown>, label: string, omitCombatId?: boolean) => Promise<string>
  onBeginMapTarget: (target: PendingMapTarget) => void
}) {
  const [tab, setTab] = useState<ActionTab>(initialTab)
  const [slotBySpell, setSlotBySpell] = useState<Record<string, number>>({})
  const [configuringSpellId, setConfiguringSpellId] = useState('')
  const [spellIntents, setSpellIntents] = useState<Record<string, MobileSpellIntent>>({})
  const [dc, setDc] = useState('10')
  const [ability, setAbility] = useState('str')
  const [skill, setSkill] = useState('')
  const [checkMode, setCheckMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal')
  const [checkContext, setCheckContext] = useState<'' | 'push-pull-lift-break' | 'interact-with-dragons'>('')
  const [spendAction, setSpendAction] = useState(false)
  const [readyTrigger, setReadyTrigger] = useState('')
  const [readyActionKind, setReadyActionKind] = useState<'attack' | 'move' | 'interact-object' | 'other'>('attack')
  const [objectInteraction, setObjectInteraction] = useState('')
  const [attackOptions, setAttackOptions] = useState<Dnd5eWeaponAttackOptions>({})
  const [actionChoices, setActionChoices] = useState<Record<string, Record<string, string>>>({})
  const [error, setError] = useState('')
  const longPressSpellRef = useRef<string | null>(null)
  useEffect(() => {
    if (visible) {
      setTab(initialTab)
    }
    else setConfiguringSpellId('')
  }, [initialTab, visible])
  const character = workspace.characters.find((candidate) => candidate.id === workspace.activeCharacterId) ?? workspace.characters[0]
  const actor = workspace.scene?.controlledTokens.find((token) => token.characterId === character?.id) ?? workspace.scene?.controlledTokens[0]
  // Keep self in the picker for healing, buffs, self-only item spells and touch actions.
  // Weapon/hostile self-target attempts remain fail-closed at the Host.
  const targets = useMemo(() => workspace.scene?.visibleTokens ?? [], [workspace.scene?.visibleTokens])
  const basicActions = useMemo(() => mobileBasicActionDescriptors(workspace.actionRegistry), [workspace.actionRegistry])
  const submit = async (patch: Record<string, unknown>, label: string, omitCombatId = false) => {
    setError('')
    try { await onSubmit(patch, label, omitCombatId); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '行动提交失败') }
  }
  const requireTarget = (label: string, fn: (token: PlayerTokenView) => Promise<void>) => {
    onBeginMapTarget({ kind: 'token', label, complete: async (input) => fn(input as PlayerTokenView) }); onClose()
  }
  const runRegisteredAction = (descriptor: MobileActionDescriptorV1) => {
    if (descriptor.execution.kind !== 'host-command') return
    const command = JSON.parse(JSON.stringify(descriptor.execution.command)) as Record<string, unknown>
    const submitCommand = async (targetTokenId?: string, targetCell?: { col: number; row: number }) => {
      const configuredCommand = command.type === 'dnd5e-weapon-attack'
        ? mobileWeaponAttackCommand(command, attackOptions)
        : command
      const payload: Record<string, unknown> = {
        ...configuredCommand,
        ...(targetTokenId ? { targetTokenId } : {}),
        ...(targetCell ? { targetCell } : {}),
      }
      const basic = objectField(payload, 'dnd5eBasicAction')
      if (targetTokenId && Object.keys(basic).length) payload.dnd5eBasicAction = { ...basic, targetTokenId }
      const persistentMove = objectField(payload, 'dnd5ePersistentAreaMove')
      if (targetCell && Object.keys(persistentMove).length) {
        payload.dnd5ePersistentAreaMove = { ...persistentMove, targetCell }
      }
      const spellCast = objectField(payload, 'dnd5eSpellCast')
      if (Object.keys(spellCast).length) {
        payload.dnd5eSpellCast = {
          ...spellCast,
          ...(targetTokenId ? { targetTokenId, targetTokenIds: [targetTokenId] } : {}),
          ...(targetCell ? { areaTargetCell: targetCell } : {}),
        }
      }
      const pluginAction = objectField(payload, 'dnd5ePluginAction')
      if (Object.keys(pluginAction).length && descriptor.choices?.length) {
        const selected = actionChoices[descriptor.id] ?? {}
        payload.dnd5ePluginAction = {
          ...pluginAction,
          payload: {
            ...objectField(pluginAction, 'payload'),
            activityChoices: Object.fromEntries(descriptor.choices.map((choice) => [
              choice.id,
              selected[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id ?? '',
            ])),
          },
        }
      }
      const classFeature = objectField(payload, 'dnd5eClassFeature')
      if (targetCell && classFeature.feature === 'feature-extra-action-teleport') {
        payload.dnd5eClassFeature = { ...classFeature, targetCell }
      }
      await onSubmit(payload, descriptor.label, !workspace.combat?.active)
    }
    if (descriptor.targeting.kind === 'self') return void submitCommand(actor?.id)
    if (descriptor.targeting.kind === 'single-creature') {
      return requireTarget(`为${descriptor.label}选择目标`, async (target) => submitCommand(target.id))
    }
    if (descriptor.targeting.kind === 'area') {
      onBeginMapTarget({ kind: 'area', label: `${descriptor.label} · 选择范围`, complete: async (input) => {
        const point = input as { x: number; y: number }
        const grid = workspace.scene?.mapManifest.grid
        const targetCell = {
          col: Math.round((point.x - (grid?.offsetX ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5),
          row: Math.round((point.y - (grid?.offsetY ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5),
        }
        await submitCommand(undefined, targetCell)
      } })
      onClose()
      return
    }
    void submitCommand()
  }
  const castSpell = (
    spell: MobileSpellView,
    source?: { itemInstanceId: string; itemUseActionId: string; fixedSlotLevel?: number },
    requestedSlotLevel?: number,
  ) => {
    // Mobile has no right click: an ordinary tap must always retain the spell's
    // base slot. Only the explicit long-press configuration may supply a higher
    // slot. Pact magic remains fixed to the Host-defined pact slot level.
    const effectiveSlotLevel = source?.fixedSlotLevel
      ?? requestedSlotLevel
      ?? mobileSpellBaseSlotLevel(spell, character)
    const intent = { ...defaultSpellIntent(spell, effectiveSlotLevel), ...(spellIntents[spell.id] ?? {}) }
    const capacity = spellTargetCapacity(spell, effectiveSlotLevel, character.level, intent)
    const payload = (targetIds: string[], areaTargetCells?: Array<{ col: number; row: number }>, guessedTargetCell?: { col: number; row: number }) => ({
      type: spell.headless ? 'dnd5e-spell-cast' : 'dnd5e-adjudicated-spell',
      ...(targetIds[0] ? { targetTokenId: targetIds[0] } : {}),
      ...(targetIds.length ? { targetTokenIds: [...new Set(targetIds)] } : {}),
      ...(spell.headless ? { dnd5eSpellCast: {
        spellId: spell.id,
        slotLevel: effectiveSlotLevel,
        ...(targetIds[0] ? { targetTokenId: targetIds[0] } : {}),
        ...(targetIds.length ? { targetTokenIds: [...new Set(targetIds)] } : {}),
        ...(spell.allowDuplicateTargets || capacity.projectiles ? { projectileTargetIds: targetIds } : {}),
        ...(spell.racialInnate ? { racialInnate: true } : {}),
        ...(!source && spell.castingClassId ? { castingClassId: spell.castingClassId } : {}),
        ...(source ? { itemInstanceId: source.itemInstanceId, itemUseActionId: source.itemUseActionId } : {}),
        ...(areaTargetCells?.[0] ? { areaTargetCell: areaTargetCells[0] } : {}),
        ...(areaTargetCells && areaTargetCells.length > 1 ? { areaTargetCells } : {}),
        ...(guessedTargetCell ? { guessedTargetCell } : {}),
        ...spellPayloadIntent(intent),
      } } : { dnd5eAdjudicatedSpell: { spellId: spell.id, slotLevel: effectiveSlotLevel, ...(!source && spell.castingClassId ? { castingClassId: spell.castingClassId } : {}) } }),
      ...(Number.isFinite(intent.targetElevationFeet) ? { targetElevationFeet: intent.targetElevationFeet } : {}),
    })
    const omitCombatId = !workspace.combat?.active
    if (spell.area) {
      const requiredPoints = Math.max(1, spell.areaTargetCount ?? 1)
      const minimumPoints = Math.max(1, Math.min(requiredPoints, spell.minimumAreaTargetCount ?? requiredPoints))
      const cells: Array<{ col: number; row: number }> = []
      const submitCells = async () => {
        const action = payload([], cells) as Record<string, unknown>
        await onSubmit({ ...action, targetCell: cells[0] }, `施放${spell.name}`, omitCombatId)
      }
      const askForPoint = (): void => onBeginMapTarget({ kind: 'area', label: `${spell.name} · 落点 ${cells.length + 1}/${requiredPoints}`, ...(cells.length >= minimumPoints ? { finishLabel: `使用 ${cells.length} 个落点`, finish: submitCells } : {}), complete: async (input): Promise<void> => {
        const point = input as { x: number; y: number }
        const grid = workspace.scene?.mapManifest.grid
        cells.push({ col: Math.round((point.x - (grid?.offsetX ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5), row: Math.round((point.y - (grid?.offsetY ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5) })
        if (cells.length < requiredPoints) { askForPoint(); return }
        await submitCells()
      } })
      askForPoint(); onClose(); return
    }
    if (intent.blindTargetCell && spell.requiresVisibleTarget === false) {
      onBeginMapTarget({ kind: 'area', label: `${spell.name} · 选择猜测格`, complete: async (input) => {
        const point = input as { x: number; y: number }
        const grid = workspace.scene?.mapManifest.grid
        const cell = {
          col: Math.round((point.x - (grid?.offsetX ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5),
          row: Math.round((point.y - (grid?.offsetY ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5),
        }
        await onSubmit({ ...payload([], undefined, cell), targetCell: cell }, `施放${spell.name}（盲猜格点）`, omitCombatId)
      } })
      onClose()
      return
    }
    const selfTarget = spell.target === 'ally' && !targets.length
    if (selfTarget && actor) void submit(payload([actor.id]), `施放${spell.name}`, omitCombatId)
    else if (capacity.projectiles) {
      const targetIds: string[] = []
      const askForProjectileTarget = (): void => onBeginMapTarget({
        kind: 'token',
        label: `${spell.name} · 选择第 ${targetIds.length + 1}/${capacity.maximum} 个目标`,
        complete: async (input) => {
          const target = input as PlayerTokenView
          if (!spell.allowDuplicateTargets && targetIds.includes(target.id)) {
            askForProjectileTarget()
            throw new Error(`${spell.name}的每次目标不能重复，请选择另一目标。`)
          }
          targetIds.push(target.id)
          if (targetIds.length < capacity.maximum) { askForProjectileTarget(); return }
          await onSubmit(payload(targetIds), `施放${spell.name}`, omitCombatId)
        },
      })
      askForProjectileTarget()
      onClose()
    } else requireTarget(`为${spell.name}选择目标`, async (target) => { await onSubmit(payload([target.id]), `施放${spell.name}`, omitCombatId) })
  }
  if (!character) return <Modal visible={visible} animationType="slide" transparent supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}><SafeAreaView style={styles.backdrop} edges={['top', 'right', 'bottom', 'left']}><View style={styles.sheet}>
    <View style={styles.head}><Text style={styles.title}>行动控制栏</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
    <ScrollView style={styles.body} contentContainerStyle={styles.content}>
      <View style={styles.missingCharacter}><Text style={styles.entryTitle}>当前角色资料仍在同步</Text><Text style={styles.small}>基础行动仍可提交并由 Host 校验；法术、物品与职业特性会在角色资料同步后显示。</Text></View>
      <RegisteredActionGrid actions={basicActions} assetBaseUrl={assetBaseUrl} onAction={runRegisteredAction} />
    </ScrollView>
  </View></SafeAreaView></Modal>
  return <Modal visible={visible} animationType="slide" transparent supportedOrientations={['landscape-left', 'landscape-right']} onRequestClose={onClose}><SafeAreaView style={styles.backdrop} edges={['top', 'right', 'bottom', 'left']}><View style={styles.sheet}>
    <View style={styles.head}><Text style={styles.title}>行动控制栏</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{([['actions', '行动'], ['spells', '法术'], ['items', '物品'], ['features', '特性'], ['checks', '检定']] as const).map(([id, label]) => <Pressable key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}><Text style={styles.tabText}>{label}</Text></Pressable>)}</ScrollView>
    <ScrollView style={styles.body} contentContainerStyle={styles.content}>
      {tab === 'actions' && <><AttackIntentControls character={character} combat={workspace.combat} actor={actor} value={attackOptions} onChange={setAttackOptions} /><RegisteredActionGrid actions={basicActions} assetBaseUrl={assetBaseUrl} onAction={runRegisteredAction} choices={actionChoices} onChoice={(actionId, choiceId, optionId) => setActionChoices((current) => ({ ...current, [actionId]: { ...(current[actionId] ?? {}), [choiceId]: optionId } }))} /><DeclaredBasicActions readyTrigger={readyTrigger} setReadyTrigger={setReadyTrigger} readyActionKind={readyActionKind} setReadyActionKind={setReadyActionKind} objectInteraction={objectInteraction} setObjectInteraction={setObjectInteraction} onSubmit={(payload, label) => submit({ type: 'dnd5e-basic-action', dnd5eBasicAction: payload }, label, !workspace.combat?.active)} /></>}
      {tab === 'spells' && workspace.spells.length ? workspace.spells.map((spell) => {
        const baseSlot = mobileSpellBaseSlotLevel(spell, character)
        const canCast = spell.level === 0 || spell.prepared || spell.known || spell.racialInnate
        const configurable = mobileAvailableSpellSlotLevels(spell, character).some((level) => level > baseSlot)
        return <View key={spell.id} style={styles.entry}><ActionArtwork assetBaseUrl={assetBaseUrl} assetPath={spellArtwork(spell)} fallback="✧" badge={spell.level === 0 ? '戏' : spell.level} /><Pressable style={{ flex: 1 }} disabled={!configurable} delayLongPress={420} onLongPress={() => openSpellConfiguration(spell)}><Text style={styles.entryTitle}>{spell.name}</Text><Text style={styles.entryMeta}>{spell.level === 0 ? '戏法' : `${spell.level}环`} · {spell.headless ? 'Headless' : 'DM 裁定'}{spell.racialInnate ? ' · 种族天生施法' : spell.prepared ? ' · 已准备' : spell.known ? ' · 已知' : ' · 未准备'}</Text>{spell.racialInnate && <Text style={styles.small}>固定按 {baseSlot} 环施放，不消耗职业法术位</Text>}{configurable && <Text style={styles.longPressHint}>长按打开升环配置</Text>}</Pressable><Pressable disabled={!canCast} delayLongPress={420} accessibilityHint={configurable ? '轻点按基础环位施放，长按配置升环施法' : '轻点施放法术'} style={[styles.use, !canCast && styles.disabled]} onPressIn={() => { longPressSpellRef.current = null }} onLongPress={() => { longPressSpellRef.current = spell.id; openSpellConfiguration(spell) }} onPress={() => { if (longPressSpellRef.current === spell.id) { longPressSpellRef.current = null; return } castSpell(spell, undefined, baseSlot) }}><Text style={styles.useText}>{canCast ? '施放' : '未准备'}</Text></Pressable></View>
      }) : tab === 'spells' && <Text style={styles.empty}>当前角色没有可用法术。</Text>}
      {tab === 'items' && (character.dnd5eInventory?.entries ?? []).map((entry) => {
        const actions = entry.item.useActions?.length ? entry.item.useActions : entry.item.use ? [{ id: 'default', label: '使用', ...entry.item.use }] : []
        return <View key={entry.instanceId} style={styles.entry}><ActionArtwork assetBaseUrl={assetBaseUrl} fallback={itemGlyph(entry.item.icon)} badge={entry.quantity} /><View style={{ flex: 1 }}><Text style={styles.entryTitle}>{entry.item.name} ×{entry.quantity}</Text><Text style={styles.entryMeta} numberOfLines={3}>{entry.item.description || entry.item.rulesText}</Text><View style={styles.itemActions}>{actions.map((action) => <Pressable key={action.id} style={styles.miniUse} onPress={() => {
          const effect = objectField(action, 'effect')
          if (effect.kind === 'spell-cast' && typeof effect.spellId === 'string') {
            const spell = mobileSpellForItem(effect.spellId, Number(effect.castAtLevel) || 0)
            if (!spell) return setError(`物品法术 ${effect.spellId} 尚未进入安全法术目录。`)
            return castSpell(spell, { itemInstanceId: entry.instanceId, itemUseActionId: action.id, fixedSlotLevel: Number(effect.castAtLevel) || spell.level })
          }
          const targeting = objectField(action, 'targeting')
          const run = async (target?: PlayerTokenView, point?: { x: number; y: number }) => {
            const grid = workspace.scene?.mapManifest.grid
            const targetCell = point ? { col: Math.round((point.x - (grid?.offsetX ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5), row: Math.round((point.y - (grid?.offsetY ?? 0)) / Math.max(1, grid?.sizeWorldUnits ?? 70) - .5) } : undefined
            return onSubmit(mobileItemUseCommand({
              instanceId: entry.instanceId,
              useActionId: action.id,
              ...(target ? { targetTokenId: target.id } : {}),
              ...(targetCell ? { targetCell } : {}),
            }), `${action.label}${entry.item.name}`, !workspace.combat?.active)
          }
          if (targeting.kind === 'creature') return requireTarget(`为${entry.item.name}选择目标`, async (target) => { await run(target) })
          if (targeting.kind === 'map-area') { onBeginMapTarget({ kind: 'area', label: `${entry.item.name}落点`, complete: async (input) => { await run(undefined, input as { x: number; y: number }) } }); onClose(); return }
          void run()
        }}><Text style={styles.miniUseText}>{String(action.label || '使用')}</Text></Pressable>)}</View></View>{!actions.length && <Text style={styles.unusable}>仅携带</Text>}</View>
      })}
      {tab === 'features' && <><FeatureActions character={character} actor={actor} workspace={workspace} submit={submit} requireTarget={requireTarget} beginDragonbornBreath={() => {
        const ancestry = character.racialRules?.dragonbornAncestry
        if (!ancestry || !actor || !workspace.scene) return setError('当前角色没有可用的龙裔吐息。')
        onBeginMapTarget({ kind: 'area', label: `${ancestry.name}龙裔吐息 · 选择方向`, complete: async (input) => {
          const point = input as { x: number; y: number }
          const grid = workspace.scene!.mapManifest.grid
          const size = Math.max(1, grid?.sizeWorldUnits ?? 70)
          const cellOf = (token: PlayerTokenView) => ({
            col: Math.round((token.x - (grid?.offsetX ?? 0)) / size - (token.footprintCells ?? 1) / 2),
            row: Math.round((token.y - (grid?.offsetY ?? 0)) / size - (token.footprintCells ?? 1) / 2),
          })
          const targetCell = { col: Math.round((point.x - (grid?.offsetX ?? 0)) / size - .5), row: Math.round((point.y - (grid?.offsetY ?? 0)) / size - .5) }
          const casterCell = cellOf(actor)
          const area = ancestry.area.shape === 'line'
            ? { shape: 'line' as const, origin: 'self' as const, lengthFeet: ancestry.area.lengthFeet, widthFeet: ancestry.area.widthFeet ?? 5 }
            : { shape: 'cone' as const, origin: 'self' as const, lengthFeet: ancestry.area.lengthFeet }
          const affected = new Set(cellsForAoe(area, casterCell, targetCell).map((cell) => `${cell.col}:${cell.row}`))
          const targetTokenIds = workspace.scene!.visibleTokens.filter((token) => token.id !== actor.id && tokenOccupiedKeys(token, cellOf).some((key) => affected.has(key)) && !lineBlocked(actor, token, workspace.scene!.opaqueSegments)).map((token) => token.id)
          await onSubmit({ type: 'dnd5e-racial-action', targetCell, targetTokenIds, dnd5eRacialAction: { feature: 'dragonborn-breath' } }, `${ancestry.name}龙裔吐息`)
        } })
        onClose()
      }} /><RegisteredActionGrid actions={workspace.actionRegistry.actions.filter((entry) => entry.group === 'features')} assetBaseUrl={assetBaseUrl} onAction={runRegisteredAction} choices={actionChoices} onChoice={(actionId, choiceId, optionId) => setActionChoices((current) => ({ ...current, [actionId]: { ...(current[actionId] ?? {}), [choiceId]: optionId } }))} emptyLabel="当前规则包没有可在移动端主动使用的扩展能力。" /></>}
      {tab === 'checks' && <View style={styles.checkCard}><Text style={styles.entryTitle}>属性 / 技能检定</Text><Text style={styles.small}>直接选属性，或选择一项技能；技能会自动关联正确属性。</Text><View style={styles.abilityRow}>{Object.entries({ str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }).map(([id, label]) => <Pressable key={id} style={[styles.ability, ability === id && !skill && styles.abilityActive]} onPress={() => { setAbility(id); setSkill('') }}><Text style={styles.abilityText}>{label}</Text></Pressable>)}</View><View style={styles.skillGrid}>{mobileSkills.map(([id, label, relatedAbility]) => <Pressable key={id} style={[styles.skill, skill === id && styles.abilityActive]} onPress={() => { setSkill(id); setAbility(relatedAbility) }}><Text style={styles.skillText}>{label} · {abilityShort(relatedAbility)}</Text></Pressable>)}</View><TextInput value={dc} onChangeText={setDc} keyboardType="number-pad" style={styles.input} placeholder="DC" placeholderTextColor={colors.muted} /><Text style={styles.small}>掷骰方式</Text><View style={styles.abilityRow}>{([['normal', '正常'], ['advantage', '优势'], ['disadvantage', '劣势']] as const).map(([id, label]) => <Pressable key={id} style={[styles.ability, checkMode === id && styles.abilityActive]} onPress={() => setCheckMode(id)}><Text style={styles.abilityText}>{label}</Text></Pressable>)}</View><Text style={styles.small}>规则情境（Host 会复核是否适用）</Text><View style={styles.abilityRow}>{([['', '普通'], ['push-pull-lift-break', '推／拉／举／破坏'], ['interact-with-dragons', '与龙互动']] as const).map(([id, label]) => <Pressable key={id || 'none'} style={[styles.ability, checkContext === id && styles.abilityActive]} onPress={() => setCheckContext(id)}><Text style={styles.abilityText}>{label}</Text></Pressable>)}</View><Pressable style={styles.toggle} onPress={() => setSpendAction((value) => !value)}><View style={[styles.box, spendAction && styles.boxChecked]} /><Text style={styles.small}>作为主动动作</Text></Pressable><Pressable style={styles.primary} onPress={() => void submit({ type: 'dnd5e-ability-check', dnd5eAbilityCheck: { ability, ...(skill ? { skill } : {}), ...(checkContext ? { context: checkContext } : {}), dc: Number(dc) || 10, mode: checkMode, spendAction } }, `${skill ? mobileSkills.find(([id]) => id === skill)?.[1] : abilityShort(ability)}检定`, !workspace.combat?.active)}><Text style={styles.primaryText}>投掷检定</Text></Pressable></View>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    {!!configuringSpellId && (() => {
      const spell = workspace.spells.find((candidate) => candidate.id === configuringSpellId)
      if (!spell) return null
      const levels = mobileAvailableSpellSlotLevels(spell, character)
      const selectedSlot = levels.includes(slotBySpell[spell.id]) ? slotBySpell[spell.id] : levels[0]
      const intent = { ...defaultSpellIntent(spell, selectedSlot), ...(spellIntents[spell.id] ?? {}) }
      return <View style={styles.spellConfigOverlay}>
        <View style={styles.spellConfigCard}>
          <View style={styles.head}><View><Text style={styles.dialogEyebrow}>长按施法配置</Text><Text style={styles.title}>{spell.name}</Text></View><Pressable onPress={() => setConfiguringSpellId('')}><Text style={styles.close}>×</Text></Pressable></View>
          <Text style={styles.configDescription}>普通点击始终使用 {mobileSpellBaseSlotLevel(spell, character)} 环；只有从这里确认才会升环施放。</Text>
          <Text style={styles.configLabel}>选择施法环位</Text>
          <View style={styles.slotChoices}>{levels.map((level) => <Pressable key={level} style={[styles.slotChoice, selectedSlot === level && styles.slotChoiceActive]} onPress={() => setSlotBySpell((state) => ({ ...state, [spell.id]: level }))}><Text style={[styles.slotChoiceText, selectedSlot === level && styles.slotChoiceTextActive]}>{level}环</Text></Pressable>)}</View>
          <SpellIntentControls spell={spell} slotLevel={selectedSlot} character={character} targets={targets} spellOriginAreas={workspace.scene?.spellOriginAreas ?? []} value={intent} onChange={(value) => setSpellIntents((state) => ({ ...state, [spell.id]: value }))} />
          {!levels.length && <Text style={styles.error}>当前没有可用于施放该法术的法术位。</Text>}
          <Pressable disabled={!levels.length} style={[styles.configCast, !levels.length && styles.disabled]} onPress={() => { setConfiguringSpellId(''); castSpell(spell, undefined, selectedSlot) }}><Text style={styles.configCastText}>以 {selectedSlot} 环施放</Text></Pressable>
        </View>
      </View>
    })()}
  </View></SafeAreaView></Modal>

  function openSpellConfiguration(spell: MobileSpellView) {
    if (spell.level === 0 || spell.racialInnate) return
    const levels = mobileAvailableSpellSlotLevels(spell, character)
    const baseSlot = mobileSpellBaseSlotLevel(spell, character)
    setSlotBySpell((state) => ({ ...state, [spell.id]: levels.includes(state[spell.id]) ? state[spell.id] : levels.find((level) => level >= baseSlot) ?? baseSlot }))
    setConfiguringSpellId(spell.id)
  }
}

function SpellIntentControls({ spell, slotLevel, character, targets, spellOriginAreas, value, onChange }: {
  spell: MobileSpellView
  slotLevel: number
  character: MobilePlayerWorkspace['characters'][number]
  targets: PlayerTokenView[]
  spellOriginAreas: Array<{ id: string; label: string }>
  value: MobileSpellIntent
  onChange: (value: MobileSpellIntent) => void
}) {
  const choices = spellChoiceOptions(spell, slotLevel)
  const metamagic = character.classSelections?.metamagic ?? []
  const wizardSubclass = character.dnd5eClassChoices?.classes?.wizard?.subclass
  const sorcererSubclass = character.dnd5eClassChoices?.classes?.sorcerer?.subclass
  const invocations = character.classSelections?.['eldritch-invocations'] ?? []
  const hasSculpt = spell.area && (character.classLevels?.wizard ?? 0) >= 2 && wizardSubclass === 'evocation'
  const hasOverchannel = (character.classLevels?.wizard ?? 0) >= 14 && wizardSubclass === 'evocation' && slotLevel >= 1 && slotLevel <= 5
  const hasDraconicResistance = (character.classLevels?.sorcerer ?? 0) >= 6 && sorcererSubclass === 'draconic'
  const hasRepellingBlast = spell.id === 'eldritch-blast' && invocations.includes('repelling-blast')
  const primaryMetamagic = metamagic.filter((id): id is Exclude<Dnd5eMetamagicId, 'empowered'> => id !== 'empowered' && isMetamagicId(id))
  const toggleId = (field: 'sculptedTargetIds' | 'excludedAreaTargetIds', id: string) => {
    const current = value[field] ?? []
    onChange({ ...value, [field]: current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id] })
  }
  const toggle = (field: 'overchannel' | 'empowered' | 'draconicResistance' | 'repellingBlast' | 'blindTargetCell') =>
    onChange({ ...value, [field]: value[field] ? undefined : true })
  const hasWallOfFireGeometry = spell.id === 'wall-of-fire'
  const hasBladeBarrierGeometry = spell.id === 'blade-barrier'
  const hasSpiritGuardianExclusions = spell.id === 'spirit-guardians'
  const hasHealingAllocations = spell.id === 'mass-heal'
  const damageMaximization = (character.spellModifierIntents ?? []).filter((modifier) =>
    modifier.operation === 'declarative-damage-maximization' && modifier.featureId &&
    (!modifier.compatibleDamageTypes?.length || !!spell.damageType && modifier.compatibleDamageTypes.includes(spell.damageType)),
  )
  const wallOfFireSides: ReadonlyArray<NonNullable<MobileSpellIntent['wallOfFireDamagingSide']>> =
    (value.wallOfFireShape ?? 'line') === 'ring' ? ['inside', 'outside'] : ['left', 'right']
  const numericIntent = (field: keyof MobileSpellIntent, raw: string) => onChange({
    ...value,
    [field]: raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : undefined,
  })
  const setHealingAllocation = (targetTokenId: string, raw: string) => {
    const amount = Math.max(0, Math.floor(Number(raw) || 0))
    const current = value.healingAllocations ?? []
    const next = current.filter((entry) => entry.targetTokenId !== targetTokenId)
    if (amount > 0) next.push({ targetTokenId, amount })
    onChange({ ...value, healingAllocations: next.length ? next : undefined })
  }
  if (!choices.length && !hasSculpt && !hasOverchannel && !hasDraconicResistance && !hasRepellingBlast && !primaryMetamagic.length && !metamagic.includes('empowered') && spell.requiresVisibleTarget !== false && !spell.area && !hasHealingAllocations && !spellOriginAreas.length && !damageMaximization.length) return null
  return <ScrollView style={styles.intentScroll} contentContainerStyle={styles.intentCard} nestedScrollEnabled>
    <Text style={styles.configLabelInline}>影响结算的施法选项</Text>
    {!!spellOriginAreas.length && <View style={styles.intentGroup}><Text style={styles.small}>施法起点</Text><View style={styles.attackToggleRow}><Pressable style={[styles.attackChoice, !value.spellOriginAreaId && styles.attackChoiceActive]} onPress={() => onChange({ ...value, spellOriginAreaId: undefined })}><Text style={styles.attackChoiceText}>施法者</Text></Pressable>{spellOriginAreas.map((origin) => <Pressable key={origin.id} style={[styles.attackChoice, value.spellOriginAreaId === origin.id && styles.attackChoiceActive]} onPress={() => onChange({ ...value, spellOriginAreaId: origin.id })}><Text style={styles.attackChoiceText}>{origin.label}</Text></Pressable>)}</View></View>}
    {choices.map((choice) => <View key={choice.field} style={styles.intentGroup}><Text style={styles.small}>{choice.label}</Text><View style={styles.attackToggleRow}>{choice.options.map((option) => <Pressable key={option.id} style={[styles.attackChoice, value[choice.field] === option.id && styles.attackChoiceActive]} onPress={() => onChange({ ...value, [choice.field]: option.id })}><Text style={styles.attackChoiceText}>{option.label}</Text></Pressable>)}</View></View>)}
    {spell.area && <View style={styles.intentGroup}><Text style={styles.small}>范围朝向</Text><View style={styles.attackToggleRow}>{([0, 1, 2, 3] as const).map((orientation) => <Pressable key={orientation} style={[styles.attackChoice, (value.areaTargetOrientation ?? 0) === orientation && styles.attackChoiceActive]} onPress={() => onChange({ ...value, areaTargetOrientation: orientation })}><Text style={styles.attackChoiceText}>{orientation * 90}°</Text></Pressable>)}</View></View>}
    {hasWallOfFireGeometry && <View style={styles.intentGroup}>
      <Text style={styles.small}>火墙形状与伤害侧（Host 将按 5 尺增量复核）</Text>
      <View style={styles.attackToggleRow}>{(['line', 'ring'] as const).map((shape) => <Pressable key={shape} style={[styles.attackChoice, (value.wallOfFireShape ?? 'line') === shape && styles.attackChoiceActive]} onPress={() => onChange({ ...value, wallOfFireShape: shape, wallOfFireDamagingSide: shape === 'ring' ? 'outside' : 'right' })}><Text style={styles.attackChoiceText}>{shape === 'line' ? '直线墙' : '环形墙'}</Text></Pressable>)}</View>
      <View style={styles.attackToggleRow}>{wallOfFireSides.map((side) => <Pressable key={side} style={[styles.attackChoice, value.wallOfFireDamagingSide === side && styles.attackChoiceActive]} onPress={() => onChange({ ...value, wallOfFireDamagingSide: side })}><Text style={styles.attackChoiceText}>{({ left: '左侧', right: '右侧', inside: '内侧', outside: '外侧' } as const)[side]}</Text></Pressable>)}</View>
      <View style={styles.inlineInputs}><TextInput value={value.wallOfFireAngleDegrees == null ? '' : String(value.wallOfFireAngleDegrees)} onChangeText={(raw) => numericIntent('wallOfFireAngleDegrees', raw)} keyboardType="number-pad" style={styles.featureInput} placeholder="角度 0–359" placeholderTextColor={colors.muted} />{(value.wallOfFireShape ?? 'line') === 'line' ? <TextInput value={value.wallOfFireLengthFeet == null ? '' : String(value.wallOfFireLengthFeet)} onChangeText={(raw) => numericIntent('wallOfFireLengthFeet', raw)} keyboardType="number-pad" style={styles.featureInput} placeholder="长度 ≤60尺" placeholderTextColor={colors.muted} /> : <TextInput value={value.wallOfFireDiameterFeet == null ? '' : String(value.wallOfFireDiameterFeet)} onChangeText={(raw) => numericIntent('wallOfFireDiameterFeet', raw)} keyboardType="number-pad" style={styles.featureInput} placeholder="直径 ≤20尺" placeholderTextColor={colors.muted} />}</View>
    </View>}
    {hasBladeBarrierGeometry && <View style={styles.intentGroup}>
      <Text style={styles.small}>剑刃护壁形状（Host 重新建立覆盖格）</Text>
      <View style={styles.attackToggleRow}>{(['line', 'ring'] as const).map((shape) => <Pressable key={shape} style={[styles.attackChoice, (value.bladeBarrierShape ?? 'line') === shape && styles.attackChoiceActive]} onPress={() => onChange({ ...value, bladeBarrierShape: shape })}><Text style={styles.attackChoiceText}>{shape === 'line' ? '直线墙' : '环形墙'}</Text></Pressable>)}</View>
      <View style={styles.inlineInputs}><TextInput value={value.bladeBarrierAngleDegrees == null ? '' : String(value.bladeBarrierAngleDegrees)} onChangeText={(raw) => numericIntent('bladeBarrierAngleDegrees', raw)} keyboardType="number-pad" style={styles.featureInput} placeholder="角度 0–359" placeholderTextColor={colors.muted} />{(value.bladeBarrierShape ?? 'line') === 'line' ? <TextInput value={value.bladeBarrierLengthFeet == null ? '' : String(value.bladeBarrierLengthFeet)} onChangeText={(raw) => numericIntent('bladeBarrierLengthFeet', raw)} keyboardType="number-pad" style={styles.featureInput} placeholder="长度 ≤100尺" placeholderTextColor={colors.muted} /> : <TextInput value={value.bladeBarrierDiameterFeet == null ? '' : String(value.bladeBarrierDiameterFeet)} onChangeText={(raw) => numericIntent('bladeBarrierDiameterFeet', raw)} keyboardType="number-pad" style={styles.featureInput} placeholder="直径 ≤60尺" placeholderTextColor={colors.muted} />}</View>
    </View>}
    <View style={styles.intentGroup}><Text style={styles.small}>目标/区域海拔（尺，可留空）</Text><TextInput value={value.targetElevationFeet == null ? '' : String(value.targetElevationFeet)} onChangeText={(raw) => onChange({ ...value, targetElevationFeet: raw.trim() && Number.isFinite(Number(raw)) ? Number(raw) : undefined })} keyboardType="numbers-and-punctuation" style={styles.featureInput} placeholder="由 Host 按地形推断" placeholderTextColor={colors.muted} /></View>
    {spell.requiresVisibleTarget === false && !spell.area && <Pressable style={styles.toggle} onPress={() => toggle('blindTargetCell')}><View style={[styles.box, value.blindTargetCell && styles.boxChecked]} /><Text style={styles.small}>不选择可见 Token，改为在地图选择猜测格</Text></Pressable>}
    {hasSculpt && <View style={styles.intentGroup}><Text style={styles.small}>法术塑形：选择受保护生物</Text><View style={styles.attackToggleRow}>{targets.map((target) => <Pressable key={target.id} style={[styles.attackChoice, value.sculptedTargetIds?.includes(target.id) && styles.attackChoiceActive]} onPress={() => toggleId('sculptedTargetIds', target.id)}><Text style={styles.attackChoiceText}>{target.name}</Text></Pressable>)}</View></View>}
    {hasSpiritGuardianExclusions && <View style={styles.intentGroup}><Text style={styles.small}>灵体卫士：选择不受影响的生物</Text><View style={styles.attackToggleRow}>{targets.map((target) => <Pressable key={target.id} style={[styles.attackChoice, value.excludedAreaTargetIds?.includes(target.id) && styles.attackChoiceActive]} onPress={() => toggleId('excludedAreaTargetIds', target.id)}><Text style={styles.attackChoiceText}>{target.name}</Text></Pressable>)}</View></View>}
    {hasHealingAllocations && <View style={styles.intentGroup}><Text style={styles.small}>群体医疗术：逐目标分配，合计最多 700 点</Text>{targets.map((target) => <View key={target.id} style={styles.allocationEntry}><Text numberOfLines={1} style={styles.allocationTarget}>{target.name}</Text><TextInput value={String(value.healingAllocations?.find((entry) => entry.targetTokenId === target.id)?.amount ?? '')} onChangeText={(raw) => setHealingAllocation(target.id, raw)} keyboardType="number-pad" style={styles.allocationInput} placeholder="0" placeholderTextColor={colors.muted} /></View>)}</View>}
    {!!primaryMetamagic.length && <View style={styles.intentGroup}><Text style={styles.small}>主超魔法（一次只能选择一种）</Text><View style={styles.attackToggleRow}><Pressable style={[styles.attackChoice, !value.metamagic && styles.attackChoiceActive]} onPress={() => onChange({ ...value, metamagic: undefined })}><Text style={styles.attackChoiceText}>不用</Text></Pressable>{primaryMetamagic.map((kind) => <Pressable key={kind} style={[styles.attackChoice, value.metamagic?.kind === kind && styles.attackChoiceActive]} onPress={() => onChange({ ...value, metamagic: value.metamagic?.kind === kind ? undefined : metamagicPayload(kind, targets[0]?.id) })}><Text style={styles.attackChoiceText}>{metamagicLabel(kind)}</Text></Pressable>)}</View>
      {value.metamagic?.kind === 'careful' && <View style={styles.attackToggleRow}>{targets.map((target) => <Pressable key={target.id} style={[styles.attackChoice, value.metamagic?.carefulTargetIds?.includes(target.id) && styles.attackChoiceActive]} onPress={() => { const current = value.metamagic?.carefulTargetIds ?? []; onChange({ ...value, metamagic: { kind: 'careful', carefulTargetIds: current.includes(target.id) ? current.filter((id) => id !== target.id) : [...current, target.id] } }) }}><Text style={styles.attackChoiceText}>保护 {target.name}</Text></Pressable>)}</View>}
      {value.metamagic?.kind === 'heightened' && <View style={styles.attackToggleRow}>{targets.map((target) => <Pressable key={target.id} style={[styles.attackChoice, value.metamagic?.heightenedTargetId === target.id && styles.attackChoiceActive]} onPress={() => onChange({ ...value, metamagic: { kind: 'heightened', heightenedTargetId: target.id } })}><Text style={styles.attackChoiceText}>{target.name}</Text></Pressable>)}</View>}
    </View>}
    <View style={styles.attackToggleRow}>
      {metamagic.includes('empowered') && <Pressable style={[styles.attackChoice, value.empowered && styles.attackChoiceActive]} onPress={() => toggle('empowered')}><Text style={styles.attackChoiceText}>强效法术</Text></Pressable>}
      {hasOverchannel && <Pressable style={[styles.attackChoice, value.overchannel && styles.attackChoiceActive]} onPress={() => toggle('overchannel')}><Text style={styles.attackChoiceText}>超限导能</Text></Pressable>}
      {hasDraconicResistance && <Pressable style={[styles.attackChoice, value.draconicResistance && styles.attackChoiceActive]} onPress={() => toggle('draconicResistance')}><Text style={styles.attackChoiceText}>元素抗性</Text></Pressable>}
      {hasRepellingBlast && <Pressable style={[styles.attackChoice, value.repellingBlast && styles.attackChoiceActive]} onPress={() => toggle('repellingBlast')}><Text style={styles.attackChoiceText}>斥力魔爆</Text></Pressable>}
      {damageMaximization.map((modifier) => <Pressable key={modifier.id} disabled={!modifier.available} style={[styles.attackChoice, value.damageMaximizationFeatureId === modifier.featureId && styles.attackChoiceActive, !modifier.available && styles.disabled]} onPress={() => onChange({ ...value, damageMaximizationFeatureId: value.damageMaximizationFeatureId === modifier.featureId ? undefined : modifier.featureId })}><Text style={styles.attackChoiceText}>{modifier.label}{modifier.resource ? ` · ${modifier.resource.current}/${modifier.resource.maximum ?? '?'}` : ''}</Text></Pressable>)}
    </View>
    <Text style={styles.attackConfigHint}>选项只声明玩家意图；资格、目标、资源、距离和效果由 Host 重新验证。</Text>
  </ScrollView>
}

function tokenOccupiedKeys(token: PlayerTokenView, anchorFor: (token: PlayerTokenView) => { col: number; row: number }) {
  const anchor = anchorFor(token)
  const footprint = Math.max(1, token.footprintCells ?? 1)
  const keys: string[] = []
  for (let row = anchor.row; row < anchor.row + footprint; row += 1) {
    for (let col = anchor.col; col < anchor.col + footprint; col += 1) keys.push(`${col}:${row}`)
  }
  return keys
}

function lineBlocked(from: PlayerTokenView, to: PlayerTokenView, segments: MobilePlayerWorkspace['scene'] extends infer _ ? NonNullable<MobilePlayerWorkspace['scene']>['opaqueSegments'] : never) {
  const intersects = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, d: { x: number; y: number }) => {
    const cross = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }) =>
      (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
    const first = cross(a, b, c)
    const second = cross(a, b, d)
    const third = cross(c, d, a)
    const fourth = cross(c, d, b)
    return first * second < 0 && third * fourth < 0
  }
  return segments.some((segment) => !segment.open && intersects(from, to, { x: segment.ax, y: segment.ay }, { x: segment.bx, y: segment.by }))
}

function objectField(value: unknown, key: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') return {}
  const field = (value as Record<string, unknown>)[key]
  return field && typeof field === 'object' ? field as Record<string, unknown> : {}
}

function abilityShort(ability: string) {
  return ({ str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' } as Record<string, string>)[ability] ?? ability
}

function mobileSpellForItem(spellId: string, castAtLevel: number): MobileSpellView | null {
  const spell = DND5E_SRD_COMBAT_SPELLS.find((candidate) => candidate.id === spellId)
  if (!spell) return null
  return {
    id: spell.id, name: spell.name, englishName: spell.englishName, level: spell.level,
    classes: [...spell.classes], headless: true, automationLevel: 'full', catalogOnly: false,
    prepared: true, known: true, inSpellbook: false, castingTime: spell.castingTime,
    rangeFeet: spell.rangeFeet, damageType: spell.damageType, target: spell.target, requiresVisibleTarget: spell.requiresVisibleTarget,
    area: spell.area ? { shape: spell.area.shape, origin: spell.area.origin, ...('radiusFeet' in spell.area ? { radiusFeet: spell.area.radiusFeet } : {}), ...('widthFeet' in spell.area ? { widthFeet: spell.area.widthFeet } : {}), ...('heightFeet' in spell.area ? { heightFeet: spell.area.heightFeet } : {}), ...('lengthFeet' in spell.area ? { lengthFeet: spell.area.lengthFeet } : {}), ...('placeRangeFeet' in spell.area ? { placeRangeFeet: spell.area.placeRangeFeet } : {}), ...('aimRangeFeet' in spell.area ? { aimRangeFeet: spell.area.aimRangeFeet } : {}) } : undefined,
    maximumTargets: spell.maximumTargets, additionalTargetsPerHigherSlot: spell.additionalTargetsPerHigherSlot,
    baseProjectiles: spell.baseProjectiles, additionalProjectilesPerHigherSlot: spell.additionalProjectilesPerHigherSlot,
    allowDuplicateTargets: spell.id === 'magic-missile' || spell.id === 'eldritch-blast' || spell.baseProjectiles != null,
    areaTargetCount: spell.areaTargetCount, minimumAreaTargetCount: spell.minimumAreaTargetCount,
    automationReason: `由物品以 ${castAtLevel || spell.level} 环施放`,
  }
}

const coreActionArtwork: Record<string, string> = {
  'core.weapon-attack': '/assets/icons/melee-attack-action.png',
  'core.dash': '/assets/icons/dash-action.png',
  'core.disengage': '/assets/icons/disengage-action.png',
  'core.dodge': '/assets/icons/dodge-action.png',
}

function absoluteAssetUrl(baseUrl: string, assetPath?: string) {
  if (!assetPath) return ''
  if (/^https?:\/\//i.test(assetPath)) return assetPath
  return `${baseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`
}

function spellArtwork(spell: MobileSpellView) {
  return dnd5eSpellActionIcon({
    id: spell.id,
    name: spell.name,
    englishName: spell.englishName,
    level: spell.level,
    school: spell.school,
    castingClassId: spell.castingClassId,
  }).asset
}

function itemGlyph(icon: string) {
  if (/potion|healing|药/.test(icon)) return '✚'
  if (/weapon|sword|bow|武器/.test(icon)) return '⚔'
  if (/armor|shield|护甲|盾/.test(icon)) return '⛨'
  if (/wand|staff|scroll|focus|magic|法/.test(icon)) return '✧'
  return '◇'
}

function ActionArtwork({ assetBaseUrl, assetPath, fallback, badge }: {
  assetBaseUrl: string
  assetPath?: string
  fallback: string
  badge?: string | number
}) {
  const uri = absoluteAssetUrl(assetBaseUrl, assetPath)
  return <View style={styles.artwork}>
    {uri ? <Image source={{ uri }} resizeMode="cover" style={styles.artworkImage} /> : <Text style={styles.artworkFallback}>{fallback}</Text>}
    {badge !== undefined && <View style={styles.artworkBadge}><Text style={styles.artworkBadgeText}>{badge}</Text></View>}
  </View>
}

function RegisteredActionGrid({ actions, assetBaseUrl, onAction, choices, onChoice, emptyLabel }: {
  actions: MobileActionDescriptorV1[]
  assetBaseUrl: string
  onAction: (action: MobileActionDescriptorV1) => void
  choices?: Record<string, Record<string, string>>
  onChoice?: (actionId: string, choiceId: string, optionId: string) => void
  emptyLabel?: string
}) {
  if (!actions.length) return <Text style={styles.empty}>{emptyLabel ?? '当前没有可用行动。'}</Text>
  return <View style={styles.grid}>{actions.map((entry) => <View key={entry.id} style={[styles.action, entry.choices?.length ? styles.actionWithChoices : undefined]}>
    <Pressable
      accessibilityLabel={entry.label}
      accessibilityHint={`${entry.automation === 'full' ? '完整自动化' : '需要 Host 复核'} · ${entry.economy}`}
      style={styles.actionMain}
      onPress={() => onAction(entry)}
    ><ActionArtwork assetBaseUrl={assetBaseUrl} assetPath={coreActionArtwork[entry.id]} fallback={entry.icon ?? (entry.source === 'plugin' ? '◇' : '✦')} /><Text numberOfLines={2} style={styles.actionText}>{entry.label}</Text>{entry.source === 'plugin' && <Text style={styles.registryMeta}>{entry.automation === 'full' ? 'Headless' : 'Host 复核'}</Text>}</Pressable>
    {entry.choices?.map((choice) => <View key={choice.id} style={styles.registryChoice}>
      <Text style={styles.registryChoiceLabel}>{choice.label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>{choice.options.map((option) => {
        const selected = choices?.[entry.id]?.[choice.id] ?? choice.defaultOptionId ?? choice.options[0]?.id
        return <Pressable key={option.id} style={[styles.registryChoiceOption, selected === option.id && styles.registryChoiceOptionActive]} onPress={() => onChoice?.(entry.id, choice.id, option.id)}><Text style={styles.registryChoiceOptionText}>{option.label}</Text></Pressable>
      })}</ScrollView>
    </View>)}
  </View>)}</View>
}

function DeclaredBasicActions({
  readyTrigger,
  setReadyTrigger,
  readyActionKind,
  setReadyActionKind,
  objectInteraction,
  setObjectInteraction,
  onSubmit,
}: {
  readyTrigger: string
  setReadyTrigger: (value: string) => void
  readyActionKind: 'attack' | 'move' | 'interact-object' | 'other'
  setReadyActionKind: (value: 'attack' | 'move' | 'interact-object' | 'other') => void
  objectInteraction: string
  setObjectInteraction: (value: string) => void
  onSubmit: (payload: Dnd5eBasicActionPayload, label: string) => void
}) {
  const trigger = readyTrigger.trim()
  const interaction = objectInteraction.trim()
  return <View style={styles.declaredActions}>
    <View style={styles.checkCard}>
      <Text style={styles.entryTitle}>准备动作</Text>
      <Text style={styles.small}>登记可感知的触发条件；触发时的反应、目标和最终结算仍由 Host 校验。</Text>
      <TextInput
        value={readyTrigger}
        onChangeText={setReadyTrigger}
        maxLength={320}
        style={styles.input}
        placeholder="例如：敌人进入门口时"
        placeholderTextColor={colors.muted}
      />
      <View style={styles.abilityRow}>{([
        ['attack', '攻击'], ['move', '移动'], ['interact-object', '物件交互'], ['other', '其他'],
      ] as const).map(([id, label]) => <Pressable key={id} style={[styles.ability, readyActionKind === id && styles.abilityActive]} onPress={() => setReadyActionKind(id)}><Text style={styles.abilityText}>{label}</Text></Pressable>)}</View>
      <Pressable disabled={!trigger} style={[styles.primary, !trigger && styles.disabled]} onPress={() => onSubmit({ kind: 'ready', trigger, actionKind: readyActionKind }, '准备动作')}><Text style={styles.primaryText}>登记准备动作</Text></Pressable>
    </View>
    <View style={styles.checkCard}>
      <Text style={styles.entryTitle}>使用物件</Text>
      <Text style={styles.small}>背包内已机械化的道具请直接在“物品”页使用；这里用于声明其他物件交互。</Text>
      <TextInput
        value={objectInteraction}
        onChangeText={setObjectInteraction}
        maxLength={320}
        style={styles.input}
        placeholder="例如：拉下墙上的拉杆"
        placeholderTextColor={colors.muted}
      />
      <Pressable disabled={!interaction} style={[styles.primary, !interaction && styles.disabled]} onPress={() => onSubmit({ kind: 'use-object', interactionId: interaction }, '使用物件')}><Text style={styles.primaryText}>提交物件交互</Text></Pressable>
    </View>
  </View>
}

function AttackIntentControls({ character, combat, actor, value, onChange }: {
  character: MobilePlayerWorkspace['characters'][number]
  combat: MobilePlayerWorkspace['combat']
  actor?: PlayerTokenView
  value: Dnd5eWeaponAttackOptions
  onChange: (value: Dnd5eWeaponAttackOptions) => void
}) {
  const levels = character.classLevels ?? {}
  const melee = character.weaponProfile?.mode === 'melee'
  const strengthMelee = melee && character.weaponProfile?.attackAbility === 'str'
  const economy = actor ? combat?.turnEconomy?.[actor.id] : undefined
  const slots = Array.from({ length: 9 }, (_, index) => index + 1).filter((level) =>
    (character.classResources?.[`dnd5e-spell-slot-${level}`]?.current ?? 0) > 0)
  const showSmite = (levels.paladin ?? 0) >= 2 && melee
  const showReckless = (levels.barbarian ?? 0) >= 2 && strengthMelee
  const showStunning = (levels.monk ?? 0) >= 5 && melee
  const showFoeSlayer = (levels.ranger ?? 0) >= 20 &&
    character.combatState?.foeSlayerTurnKey !== economy?.turnKey
  const showShillelagh = melee && character.shillelaghAttackChoice != null
  if (!showSmite && !showReckless && !showStunning && !showFoeSlayer && !showShillelagh) return null
  const toggle = (key: 'recklessAttack' | 'stunningStrike') => onChange({ ...value, [key]: value[key] ? undefined : true })
  return <View style={styles.attackConfig}>
    <Text style={styles.attackConfigTitle}>本次攻击预激活</Text>
    {showSmite && <View><Text style={styles.small}>命中时至圣斩（只在命中后消耗法术位）</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attackChoices}>{[0, ...slots].map((level) => <Pressable key={level} style={[styles.attackChoice, (value.divineSmiteSlotLevel ?? 0) === level && styles.attackChoiceActive]} onPress={() => onChange({ ...value, divineSmiteSlotLevel: level || undefined })}><Text style={styles.attackChoiceText}>{level ? `${level} 环` : '不用'}</Text></Pressable>)}</ScrollView></View>}
    {showShillelagh && character.shillelaghAttackChoice && <View><Text style={styles.small}>橡棍术：选择本次攻击与伤害使用的属性</Text><View style={styles.attackToggleRow}>{([['str', `力量（${signed(character.shillelaghAttackChoice.strengthModifier)}）`], ['spellcasting', `${abilityShort(character.shillelaghAttackChoice.spellcastingAbility)}（${signed(character.shillelaghAttackChoice.spellcastingModifier)}）`]] as const).map(([id, label]) => <Pressable key={id} style={[styles.attackChoice, value.shillelaghAbility === id && styles.attackChoiceActive]} onPress={() => onChange({ ...value, shillelaghAbility: id })}><Text style={styles.attackChoiceText}>{label}</Text></Pressable>)}</View></View>}
    <View style={styles.attackToggleRow}>
      {showReckless && <Pressable style={[styles.attackChoice, value.recklessAttack && styles.attackChoiceActive]} onPress={() => toggle('recklessAttack')}><Text style={styles.attackChoiceText}>鲁莽攻击</Text></Pressable>}
      {showStunning && <Pressable style={[styles.attackChoice, value.stunningStrike && styles.attackChoiceActive]} onPress={() => toggle('stunningStrike')}><Text style={styles.attackChoiceText}>震慑拳</Text></Pressable>}
      {showFoeSlayer && (['attack', 'damage'] as const).map((mode) => <Pressable key={mode} style={[styles.attackChoice, value.foeSlayer === mode && styles.attackChoiceActive]} onPress={() => onChange({ ...value, foeSlayer: value.foeSlayer === mode ? undefined : mode })}><Text style={styles.attackChoiceText}>屠灭众敌·{mode === 'attack' ? '命中' : '伤害'}</Text></Pressable>)}
    </View>
    <Text style={styles.attackConfigHint}>这里只声明意图；职业资格、时机、资源和实际效果均由 Host 重算。</Text>
  </View>
}
function FeatureActions({ character, actor, workspace, submit, requireTarget, beginDragonbornBreath }: {
  character: MobilePlayerWorkspace['characters'][number]
  actor?: PlayerTokenView
  workspace: MobilePlayerWorkspace
  submit: (patch: Record<string, unknown>, label: string) => Promise<unknown>
  requireTarget: (label: string, fn: (target: PlayerTokenView) => Promise<void>) => void
  beginDragonbornBreath: () => void
}) {
  const [amount, setAmount] = useState('1')
  const [featureSlot, setFeatureSlot] = useState('1')
  const [stunningStrike, setStunningStrike] = useState(false)
  const [openHandTechniques, setOpenHandTechniques] = useState<Array<'prone' | 'push' | 'no-reactions' | undefined>>([undefined, undefined])
  const [quiveringPalmAttackIndex, setQuiveringPalmAttackIndex] = useState<number | undefined>()
  const [preserveLifeAllocations, setPreserveLifeAllocations] = useState<Record<string, string>>({})
  const [flurryTargetIds, setFlurryTargetIds] = useState<[string, string]>(['', ''])
  const actions: Array<{ label: string; icon?: string; run: () => void }> = []
  const names: Record<string, string> = { fighter: '战士', barbarian: '野蛮人', rogue: '游荡者', bard: '吟游诗人', paladin: '圣武士', cleric: '牧师', monk: '武僧', ranger: '游侠', sorcerer: '术士', druid: '德鲁伊', warlock: '邪术师' }
  const levelOf = (id: string) => character.classLevels?.[id] ?? (character.charClass.toLowerCase().includes(id) || character.charClass.includes(names[id] ?? id) ? character.level : 0)
  const subclass = (id: string) => id === 'fighter' ? character.dnd5eClassChoices?.fighter?.subclass : character.dnd5eClassChoices?.classes?.[id]?.subclass
  const visibleTargets = workspace.scene?.visibleTokens ?? []
  const add = (classId: string, minimumLevel: number, label: string, patch: Record<string, unknown>, requiredSubclass?: string) => {
    if (levelOf(classId) < minimumLevel || requiredSubclass && subclass(classId) !== requiredSubclass) return
    actions.push({ label, run: () => void submit(patch, label) })
  }
  const addTarget = (classId: string, minimumLevel: number, label: string, build: (target: PlayerTokenView) => Record<string, unknown>, requiredSubclass?: string) => {
    if (levelOf(classId) < minimumLevel || requiredSubclass && subclass(classId) !== requiredSubclass) return
    actions.push({ label, run: () => requireTarget(`为${label}选择目标`, async (target) => { await submit(build(target), label) }) })
  }
  add('fighter', 1, '回气', { type: 'dnd5e-fighter-feature', dnd5eFighterFeature: 'second-wind' })
  add('fighter', 2, '动作如潮', { type: 'dnd5e-fighter-feature', dnd5eFighterFeature: 'action-surge' })
  add('barbarian', 1, '开始狂暴', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'barbarian-rage' } })
  add('barbarian', 3, '开始狂暴（狂乱）', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'barbarian-rage', frenzy: true } }, 'berserker')
  add('barbarian', 1, '结束狂暴', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'barbarian-rage', end: true } })
  if (character.combatState?.raging && character.combatState.rageFeatureOperations?.includes('rage-mobile-defense')) {
    actions.push({ label: '狂暴特性疾走', run: () => void submit({ type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'feature-rage-bonus-dash' } }, '狂暴特性疾走') })
  }
  if (character.combatState?.rageFeatureOperations?.includes('bonus-prone-on-hit') && character.combatState.bonusProneEligibleTargetIds?.length) {
    actions.push({ label: '狂暴特性击倒', run: () => requireTarget('选择本回合已被近战命中的合格目标', async (target) => { await submit({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'feature-rage-bonus-prone', targetTokenId: target.id } }, '狂暴特性击倒') }) })
  }
  addTarget('barbarian', 10, '威吓慑人', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'barbarian-intimidating-presence', targetTokenId: target.id } }), 'berserker')
  for (const option of ['dash', 'disengage', 'hide'] as const) add('rogue', 2, `灵巧动作：${option === 'dash' ? '疾走' : option === 'disengage' ? '撤离' : '躲藏'}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'rogue-cunning-action', option } })
  for (const option of ['sleight-of-hand', 'thieves-tools', 'use-object'] as const) add('rogue', 3, `巧手：${option === 'sleight-of-hand' ? '巧手检定' : option === 'thieves-tools' ? '盗贼工具' : '使用物品'}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'rogue-fast-hands', option } }, 'thief')
  addTarget('bard', 1, '吟游激励', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'bardic-inspiration', targetTokenId: target.id } }))
  add('bard', 6, '反迷惑', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'bard-countercharm' } })
  addTarget('paladin', 1, `圣疗：${Math.max(1, Number(amount) || 1)} 点`, (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'paladin-lay-on-hands', targetTokenId: target.id, amount: Math.max(1, Number(amount) || 1) } }))
  addTarget('paladin', 1, '圣疗：治愈疾病', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'paladin-lay-on-hands', targetTokenId: target.id, cure: 'disease' } }))
  addTarget('paladin', 1, '圣疗：移除中毒', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'paladin-lay-on-hands', targetTokenId: target.id, cure: 'poisoned' } }))
  if (levelOf('paladin') >= 14) for (const target of workspace.scene?.visibleTokens ?? []) for (const effect of target.activeEffects ?? []) {
    const spellId = effect.source?.rulesId
    const sourceTokenId = workspace.scene?.visibleTokens.find((candidate) => candidate.characterId === effect.source?.actorId)?.id
    if (!spellId || !sourceTokenId || effect.suspended) continue
    actions.push({
      label: `净化之触：${target.name} · ${effect.label}`,
      run: () => void submit({
        type: 'dnd5e-class-feature', targetTokenId: target.id,
        dnd5eClassFeature: { feature: 'paladin-cleansing-touch', targetTokenId: target.id, sourceTokenId, spellId },
      }, `净化之触：${effect.label}`),
    })
  }
  add('paladin', 1, '神圣感知', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-divine-sense' } })
  add('paladin', 3, '神圣武器', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-sacred-weapon' } }, 'devotion')
  add('paladin', 3, '驱散邪魔', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-turn-the-unholy' } }, 'devotion')
  add('paladin', 20, '神圣光环', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-holy-nimbus' } }, 'devotion')
  add('cleric', 2, '驱散亡灵', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'cleric-turn-undead' } })
  const preserveLifeLimit = levelOf('cleric') * 5
  const preserveLifeEntries = Object.entries(preserveLifeAllocations)
    .map(([targetTokenId, raw]) => ({ targetTokenId, amount: Math.max(0, Math.floor(Number(raw) || 0)) }))
    .filter((entry) => entry.amount > 0)
  const preserveLifeTotal = preserveLifeEntries.reduce((total, entry) => total + entry.amount, 0)
  if (levelOf('cleric') >= 2 && subclass('cleric') === 'life' && preserveLifeEntries.length > 0) actions.push({
    label: `保全生命：分配 ${preserveLifeTotal}/${preserveLifeLimit}`,
    run: () => void submit({
      type: 'dnd5e-class-feature',
      dnd5eClassFeature: { feature: 'cleric-preserve-life', allocations: preserveLifeEntries },
    }, '保全生命'),
  })
  add('cleric', 10, '神圣干预', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'cleric-divine-intervention' } })
  for (const option of ['dash', 'disengage'] as const) add('monk', 2, `疾风步：${option === 'dash' ? '疾走' : '撤离'}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-step-of-the-wind', option } })
  add('monk', 2, '耐心防御', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-patient-defense' } })
  addTarget('monk', 1, '武艺徒手击', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: [target.id], ...(stunningStrike ? { stunningStrike: true } : {}), ...(quiveringPalmAttackIndex === 0 ? { quiveringPalmAttackIndex: 0 } : {}) } }))
  if (levelOf('monk') >= 2) actions.push({ label: '疾风连击', run: () => {
    const submitFlurry = (fallbackTargetId: string) => {
      const targetTokenIds = flurryTargetIds.map((id) => id || fallbackTargetId)
      return submit({
        type: 'dnd5e-class-feature', targetTokenId: targetTokenIds[0], targetTokenIds: [...new Set(targetTokenIds)],
        dnd5eClassFeature: {
          feature: 'monk-unarmed-bonus', mode: 'flurry', targetTokenIds,
          ...(stunningStrike ? { stunningStrike: true } : {}),
          ...(subclass('monk') === 'open-hand' && levelOf('monk') >= 3 ? { openHandTechniques } : {}),
          ...(quiveringPalmAttackIndex != null ? { quiveringPalmAttackIndex } : {}),
        },
      }, '疾风连击')
    }
    const fallbackTargetId = flurryTargetIds.find(Boolean)
    if (flurryTargetIds.every(Boolean) && fallbackTargetId) return void submitFlurry(fallbackTargetId)
    requireTarget('为疾风连击选择未指定的攻击目标', async (target) => { await submitFlurry(target.id) })
  } })
  add('monk', 6, '身心合一', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-wholeness-of-body' } }, 'open-hand')
  add('monk', 7, '静心：结束魅惑', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-stillness-of-mind', condition: 'charmed' } })
  add('monk', 7, '静心：结束恐慌', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-stillness-of-mind', condition: 'frightened' } })
  add('monk', 18, '空灵体', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-empty-body' } })
  addTarget('monk', 17, '发动渗透劲', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'monk-quivering-palm-release', targetTokenId: target.id } }), 'open-hand')
  add('monk', 17, '结束渗透劲', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-quivering-palm-end' } }, 'open-hand')
  addTarget('ranger', 2, '转移猎人印记', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'ranger-move-hunters-mark', targetTokenId: target.id } }))
  add('ranger', 3, `原初感知（${Math.min(5, Math.max(1, Number(featureSlot) || 1))}环）`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'ranger-primeval-awareness', slotLevel: Math.min(5, Math.max(1, Number(featureSlot) || 1)) } })
  add('ranger', 10, '藏身于众目睽睽', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'ranger-hide-in-plain-sight' } })
  add('ranger', 14, '消失无踪', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'ranger-vanish' } })
  const flexSlot = Math.min(5, Math.max(1, Number(featureSlot) || 1))
  add('sorcerer', 2, `创造 ${flexSlot} 环法术位`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'sorcerer-create-spell-slot', slotLevel: flexSlot } })
  add('sorcerer', 2, `将 ${flexSlot} 环位转术法点`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'sorcerer-convert-spell-slot', slotLevel: flexSlot } })
  add('sorcerer', 14, '龙翼：展开', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'sorcerer-draconic-wings', active: true } }, 'draconic')
  add('sorcerer', 14, '龙翼：收起', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'sorcerer-draconic-wings', active: false } }, 'draconic')
  add('sorcerer', 18, '龙威：敬畏', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'sorcerer-draconic-presence', mode: 'awe' } }, 'draconic')
  add('sorcerer', 18, '龙威：恐惧', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'sorcerer-draconic-presence', mode: 'fear' } }, 'draconic')
  for (const formId of character.classSelections?.['wild-shape-known-forms'] ?? []) add('druid', 2, `荒野变形：${shortFeatureId(formId)}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'druid-wild-shape', formId } })
  if (character.combatState?.wildShapeFormId) add('druid', 18, `自然恢复：消耗 ${Math.min(9, Math.max(1, Number(featureSlot) || 1))} 环位`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'druid-creature-form-heal', slotLevel: Math.min(9, Math.max(1, Number(featureSlot) || 1)) } })
  add('druid', 2, '恢复原形', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'druid-end-wild-shape' } })
  add('warlock', 14, '坠入地狱：待命', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'warlock-hurl-through-hell-ready', active: true } }, 'fiend')
  add('warlock', 14, '坠入地狱：取消', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'warlock-hurl-through-hell-ready', active: false } }, 'fiend')
  if (character.racialRules?.dragonbornAncestry && actor) actions.unshift({ label: `${character.racialRules.dragonbornAncestry.name}吐息`, icon: '◒', run: beginDragonbornBreath })
  const openHand = subclass('monk') === 'open-hand' && levelOf('monk') >= 3
  const techniqueLabel: Record<'prone' | 'push' | 'no-reactions', string> = { prone: '击倒', push: '推离', 'no-reactions': '无法反应' }
  return <View><View style={styles.featureConfig}><TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={styles.featureInput} placeholder="治疗点数" placeholderTextColor={colors.muted} /><TextInput value={featureSlot} onChangeText={setFeatureSlot} keyboardType="number-pad" style={styles.featureInput} placeholder="选用环位 1–5" placeholderTextColor={colors.muted} />{levelOf('monk') >= 5 && <Pressable style={styles.toggle} onPress={() => setStunningStrike((value) => !value)}><View style={[styles.box, stunningStrike && styles.boxChecked]} /><Text style={styles.small}>徒手攻击预激活震慑拳</Text></Pressable>}
    {levelOf('cleric') >= 2 && subclass('cleric') === 'life' && <View style={styles.intentGroup}><Text style={styles.configLabelInline}>保全生命：逐目标分配（合计 {preserveLifeTotal}/{preserveLifeLimit}）</Text><Text style={styles.attackConfigHint}>Host 会复核总额度、30 尺范围、目标资格与“不超过生命上限一半”的限制。</Text>{visibleTargets.map((target) => <View key={target.id} style={styles.allocationEntry}><Text numberOfLines={1} style={styles.allocationTarget}>{target.name}</Text><TextInput value={preserveLifeAllocations[target.id] ?? ''} onChangeText={(raw) => setPreserveLifeAllocations((current) => ({ ...current, [target.id]: raw.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" style={styles.allocationInput} placeholder="0" placeholderTextColor={colors.muted} /></View>)}</View>}
    {levelOf('monk') >= 2 && <View style={styles.intentGroup}><Text style={styles.configLabelInline}>疾风连击：两次攻击可分别指定目标</Text>{[0, 1].map((index) => <View key={index} style={styles.intentGroup}><Text style={styles.small}>第 {index + 1} 击 · {visibleTargets.find((target) => target.id === flurryTargetIds[index])?.name ?? '未指定'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attackChoices}>{visibleTargets.map((target) => <Pressable key={target.id} style={[styles.attackChoice, flurryTargetIds[index] === target.id && styles.attackChoiceActive]} onPress={() => setFlurryTargetIds((current) => current.map((id, currentIndex) => currentIndex === index ? target.id : id) as [string, string])}><Text style={styles.attackChoiceText}>{target.name}</Text></Pressable>)}</ScrollView></View>)}</View>}
    {openHand && <View style={styles.intentGroup}><Text style={styles.small}>散打宗疾风连击：分别设置两击的命中后效果</Text>{[0, 1].map((index) => <View key={index} style={styles.attackToggleRow}><Text style={styles.small}>第 {index + 1} 击</Text>{([undefined, 'prone', 'push', 'no-reactions'] as const).map((technique) => <Pressable key={technique ?? 'none'} style={[styles.attackChoice, openHandTechniques[index] === technique && styles.attackChoiceActive]} onPress={() => setOpenHandTechniques((current) => current.map((entry, currentIndex) => currentIndex === index ? technique : entry))}><Text style={styles.attackChoiceText}>{technique ? techniqueLabel[technique] : '不用'}</Text></Pressable>)}</View>)}</View>}
    {openHand && levelOf('monk') >= 17 && <View style={styles.intentGroup}><Text style={styles.small}>渗透劲：选择命中后尝试植入的徒手攻击</Text><View style={styles.attackToggleRow}>{[undefined, 0, 1].map((index) => <Pressable key={index == null ? 'none' : index} style={[styles.attackChoice, quiveringPalmAttackIndex === index && styles.attackChoiceActive]} onPress={() => setQuiveringPalmAttackIndex(index)}><Text style={styles.attackChoiceText}>{index == null ? '不用' : `第 ${index + 1} 击`}</Text></Pressable>)}</View></View>}
  </View><View style={styles.grid}>{actions.length ? actions.map((entry) => <Pressable key={entry.label} style={styles.action} onPress={entry.run}><Text style={styles.actionIcon}>{entry.icon ?? '✦'}</Text><Text numberOfLines={2} style={styles.actionText}>{entry.label}</Text></Pressable>) : <Text style={styles.empty}>当前角色没有移动端可声明的主动特性；被动与反应仍由 Host 自动触发。</Text>}</View></View>
}

function shortFeatureId(value: string) {
  return value.split(':').pop()?.replaceAll('-', ' ') || value
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }, sheet: { height: '82%', backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: colors.border }, head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }, title: { color: colors.text, fontSize: 15, fontWeight: '900' }, close: { color: colors.muted, fontSize: 23 }, missingCharacter: { margin: 12, padding: 12, gap: 6, borderWidth: 1, borderColor: colors.warning, borderRadius: 12, backgroundColor: colors.surface }, tabs: { gap: 5, paddingHorizontal: 10, paddingBottom: 6 }, tab: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border }, tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, tabText: { color: colors.text, fontWeight: '800', fontSize: 9 }, targets: { gap: 7, paddingHorizontal: 12, paddingBottom: 9 }, target: { width: 74, padding: 7, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12 }, targetActive: { borderColor: colors.warning }, targetDot: { width: 30, height: 30, borderRadius: 15 }, targetText: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 4 }, body: { flex: 1 }, content: { padding: 9, paddingBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, action: { width: '23.5%', minHeight: 78, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 6 }, actionWithChoices: { width: '48%', minHeight: 132, alignItems: 'stretch' }, actionMain: { alignItems: 'center', justifyContent: 'center' }, actionIcon: { color: colors.primary, fontSize: 18 }, actionText: { color: colors.text, fontWeight: '800', fontSize: 9, textAlign: 'center', marginTop: 4 }, registryMeta: { color: colors.teal, fontSize: 7, fontWeight: '800', marginTop: 3 }, registryChoice: { marginTop: 6, gap: 3 }, registryChoiceLabel: { color: colors.muted, fontSize: 8, fontWeight: '800' }, registryChoiceOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 5, marginRight: 5 }, registryChoiceOptionActive: { borderColor: colors.teal, backgroundColor: '#0b2b2a' }, registryChoiceOptionText: { color: colors.text, fontSize: 8, fontWeight: '800' },
  artwork: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#7857cf', backgroundColor: '#24183f', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }, artworkImage: { width: 37, height: 37, borderRadius: 8 }, artworkFallback: { color: '#e9ddff', fontSize: 20, fontWeight: '900' }, artworkBadge: { position: 'absolute', right: -4, bottom: -4, minWidth: 17, height: 17, paddingHorizontal: 3, borderRadius: 9, borderWidth: 1, borderColor: '#d8ccff', backgroundColor: '#171222', alignItems: 'center', justifyContent: 'center' }, artworkBadgeText: { color: '#fff', fontSize: 7, fontWeight: '900' },
  featureConfig: { gap: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface }, featureInput: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 8 },
  intentScroll: { maxHeight: 255, marginHorizontal: 15, marginTop: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface }, intentCard: { gap: 10, padding: 10 }, intentGroup: { gap: 6 }, inlineInputs: { flexDirection: 'row', gap: 6 }, allocationEntry: { flexDirection: 'row', alignItems: 'center', gap: 8 }, allocationTarget: { flex: 1, color: colors.text, fontSize: 10, fontWeight: '800' }, allocationInput: { width: 88, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.background, paddingHorizontal: 9, paddingVertical: 7 }, configLabelInline: { color: colors.text, fontSize: 11, fontWeight: '900' },
  attackConfig: { gap: 8, marginBottom: 10, padding: 10, borderWidth: 1, borderColor: '#fbbf2440', borderRadius: 13, backgroundColor: '#2b210b66' }, attackConfigTitle: { color: colors.warning, fontWeight: '900', fontSize: 11 }, attackChoices: { gap: 6, paddingTop: 7 }, attackToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, attackChoice: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.background }, attackChoiceActive: { borderColor: colors.warning, backgroundColor: '#4a330d' }, attackChoiceText: { color: colors.text, fontSize: 9, fontWeight: '800' }, attackConfigHint: { color: colors.muted, fontSize: 8, lineHeight: 12 },
  entry: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 }, entryTitle: { color: colors.text, fontWeight: '900', fontSize: 13 }, entryMeta: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, itemIcon: { fontSize: 22 }, use: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }, useText: { color: '#d8ccff', fontWeight: '900', fontSize: 10 }, small: { color: colors.muted, fontSize: 10 }, longPressHint: { color: colors.warning, fontSize: 9, fontWeight: '800', marginTop: 5 },
  allocation: { marginTop: 7, padding: 7, borderRadius: 9, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }, allocationText: { color: colors.muted, fontSize: 9, lineHeight: 13 }, allocationButtons: { flexDirection: 'row', gap: 6, marginTop: 6 }, allocate: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: colors.primary }, allocateText: { color: '#d8ccff', fontSize: 8, fontWeight: '800' }, itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }, miniUse: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }, miniUseText: { color: '#d8ccff', fontSize: 9, fontWeight: '900' }, unusable: { color: colors.muted, fontSize: 9 },
  declaredActions: { gap: 10, marginTop: 12 }, checkCard: { gap: 10, padding: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface }, abilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, ability: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 9 }, abilityActive: { borderColor: colors.teal, backgroundColor: '#0b2b2a' }, abilityText: { color: colors.text, fontSize: 10, fontWeight: '800' }, skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, skill: { width: '31%', paddingHorizontal: 7, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 9 }, skillText: { color: colors.text, fontSize: 9, fontWeight: '700' }, input: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, padding: 10 }, toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, box: { width: 17, height: 17, borderRadius: 5, borderWidth: 1, borderColor: colors.border }, boxChecked: { backgroundColor: colors.teal }, primary: { backgroundColor: colors.primary, borderRadius: 11, padding: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '900' }, empty: { color: colors.muted, fontSize: 11, lineHeight: 18 }, error: { color: colors.danger, marginTop: 10 }, disabled: { opacity: .42 },
  spellConfigOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end', backgroundColor: '#000b' }, spellConfigCard: { maxHeight: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.background, paddingBottom: 18 }, dialogEyebrow: { color: colors.warning, fontSize: 9, fontWeight: '900', marginBottom: 3 }, configDescription: { color: colors.muted, fontSize: 10, lineHeight: 16, paddingHorizontal: 15 }, configLabel: { color: colors.text, fontSize: 11, fontWeight: '900', paddingHorizontal: 15, marginTop: 14 }, slotChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 15, paddingTop: 9 }, slotChoice: { minWidth: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }, slotChoiceActive: { borderColor: colors.warning, backgroundColor: '#33230b' }, slotChoiceText: { color: colors.muted, fontWeight: '800' }, slotChoiceTextActive: { color: colors.warning }, configCast: { marginHorizontal: 15, marginTop: 15, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 12 }, configCastText: { color: '#fff', fontWeight: '900' },
})
