import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileActionDescriptorV1, MobilePlayerWorkspace, MobileSpellView, PlayerTokenView } from '../../../../packages/mobile-protocol/src'
import { DND5E_SRD_COMBAT_SPELLS } from '../../../../src/rulesets/dnd5e/spells'
import { cellsForAoe } from '../../../../src/lib/skillTargeting'
import { colors } from '../theme'
import { mobileAvailableSpellSlotLevels, mobileSpellBaseSlotLevel } from './mobileSpellCasting'

export type ActionTab = 'actions' | 'spells' | 'items' | 'features' | 'checks'

const mobileSkills = [
  ['acrobatics', '杂技', 'dex'], ['animalHandling', '驯兽', 'wis'], ['arcana', '奥秘', 'int'],
  ['athletics', '运动', 'str'], ['deception', '欺瞒', 'cha'], ['history', '历史', 'int'],
  ['insight', '洞悉', 'wis'], ['intimidation', '威吓', 'cha'], ['investigation', '调查', 'int'],
  ['medicine', '医药', 'wis'], ['nature', '自然', 'int'], ['perception', '察觉', 'wis'],
  ['performance', '表演', 'cha'], ['persuasion', '游说', 'cha'], ['religion', '宗教', 'int'],
  ['sleightOfHand', '巧手', 'dex'], ['stealth', '隐匿', 'dex'], ['survival', '生存', 'wis'],
] as const

export interface PendingMapTarget {
  kind: 'token' | 'area'
  label: string
  complete: (input: PlayerTokenView | { x: number; y: number }) => Promise<void>
  finishLabel?: string
  finish?: () => Promise<void>
}

export function CombatActionSheet({ visible, initialTab = 'actions', workspace, onClose, onSubmit, onBeginMapTarget }: {
  visible: boolean
  initialTab?: ActionTab
  workspace: MobilePlayerWorkspace
  onClose: () => void
  onSubmit: (patch: Record<string, unknown>, label: string, omitCombatId?: boolean) => Promise<string>
  onBeginMapTarget: (target: PendingMapTarget) => void
}) {
  const [tab, setTab] = useState<ActionTab>(initialTab)
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [slotBySpell, setSlotBySpell] = useState<Record<string, number>>({})
  const [configuringSpellId, setConfiguringSpellId] = useState('')
  const [spellTargets, setSpellTargets] = useState<Record<string, string[]>>({})
  const [dc, setDc] = useState('10')
  const [ability, setAbility] = useState('str')
  const [skill, setSkill] = useState('')
  const [spendAction, setSpendAction] = useState(false)
  const [error, setError] = useState('')
  const longPressSpellRef = useRef<string | null>(null)
  useEffect(() => {
    if (visible) setTab(initialTab)
    else setConfiguringSpellId('')
  }, [initialTab, visible])
  const character = workspace.characters.find((candidate) => candidate.id === workspace.activeCharacterId) ?? workspace.characters[0]
  const actor = workspace.scene?.controlledTokens.find((token) => token.characterId === character?.id) ?? workspace.scene?.controlledTokens[0]
  // Keep self in the picker for healing, buffs, self-only item spells and touch actions.
  // Weapon/hostile self-target attempts remain fail-closed at the Host.
  const targets = useMemo(() => workspace.scene?.visibleTokens ?? [], [workspace.scene?.visibleTokens])
  const submit = async (patch: Record<string, unknown>, label: string, omitCombatId = false) => {
    setError('')
    try { await onSubmit(patch, label, omitCombatId); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '行动提交失败') }
  }
  const requireTarget = (label: string, fn: (token: PlayerTokenView) => Promise<void>) => {
    const selected = targets.find((token) => token.id === selectedTargetId)
    if (selected) return void fn(selected)
    onBeginMapTarget({ kind: 'token', label, complete: async (input) => fn(input as PlayerTokenView) }); onClose()
  }
  const runRegisteredAction = (descriptor: MobileActionDescriptorV1) => {
    if (descriptor.execution.kind !== 'host-command') return
    const command = JSON.parse(JSON.stringify(descriptor.execution.command)) as Record<string, unknown>
    const submitCommand = async (targetTokenId?: string, targetCell?: { col: number; row: number }) => {
      const payload: Record<string, unknown> = {
        ...command,
        ...(targetTokenId ? { targetTokenId } : {}),
        ...(targetCell ? { targetCell } : {}),
      }
      const basic = objectField(payload, 'dnd5eBasicAction')
      if (targetTokenId && Object.keys(basic).length) payload.dnd5eBasicAction = { ...basic, targetTokenId }
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
    const allocated = spellTargets[spell.id] ?? []
    const capacity = spellTargetCapacity(spell, effectiveSlotLevel, character.level)
    const selectedTargets = allocated.length ? allocated : selectedTargetId ? [selectedTargetId] : []
    const payload = (targetIds: string[], areaTargetCells?: Array<{ col: number; row: number }>) => ({
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
      } } : { dnd5eAdjudicatedSpell: { spellId: spell.id, slotLevel: effectiveSlotLevel, ...(!source && spell.castingClassId ? { castingClassId: spell.castingClassId } : {}) } }),
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
    const selfTarget = spell.target === 'ally' && !targets.length
    if (selfTarget && actor) void submit(payload([actor.id]), `施放${spell.name}`, omitCombatId)
    else if (capacity.projectiles && selectedTargets.length !== capacity.maximum) {
      setError(`${spell.name}需要分配 ${capacity.maximum} 次目标；可以重复选择同一生物。`)
    } else if (selectedTargets.length) {
      void submit(payload(selectedTargets), `施放${spell.name}`, omitCombatId)
    } else requireTarget(`为${spell.name}选择目标`, async (target) => { await onSubmit(payload([target.id]), `施放${spell.name}`, omitCombatId) })
  }
  if (!character) return null
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.backdrop}><View style={styles.sheet}>
    <View style={styles.head}><Text style={styles.title}>行动控制栏</Text><Pressable onPress={onClose}><Text style={styles.close}>×</Text></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{([['actions', '基础行动'], ['spells', '法术'], ['items', '物品'], ['features', '职业特性'], ['checks', '检定']] as const).map(([id, label]) => <Pressable key={id} style={[styles.tab, tab === id && styles.tabActive]} onPress={() => setTab(id)}><Text style={styles.tabText}>{label}</Text></Pressable>)}</ScrollView>
    <TargetPicker targets={targets} value={selectedTargetId} onChange={setSelectedTargetId} />
    <ScrollView style={styles.body} contentContainerStyle={styles.content}>
      {tab === 'actions' && <RegisteredActionGrid actions={workspace.actionRegistry.actions.filter((entry) => entry.group === 'actions')} onAction={runRegisteredAction} />}
      {tab === 'spells' && workspace.spells.length ? workspace.spells.map((spell) => {
        const baseSlot = mobileSpellBaseSlotLevel(spell, character)
        const capacity = spellTargetCapacity(spell, baseSlot, character.level)
        const assigned = spellTargets[spell.id] ?? []
        const canCast = spell.level === 0 || spell.prepared || spell.known || spell.racialInnate
        const configurable = mobileAvailableSpellSlotLevels(spell, character).some((level) => level > baseSlot)
        return <View key={spell.id} style={styles.entry}><Pressable style={{ flex: 1 }} disabled={!configurable} delayLongPress={420} onLongPress={() => openSpellConfiguration(spell)}><Text style={styles.entryTitle}>{spell.name}</Text><Text style={styles.entryMeta}>{spell.level === 0 ? '戏法' : `${spell.level}环`} · {spell.headless ? 'Headless' : 'DM 裁定'}{spell.racialInnate ? ' · 种族天生施法' : spell.prepared ? ' · 已准备' : spell.known ? ' · 已知' : ' · 未准备'}</Text>{spell.racialInnate && <Text style={styles.small}>固定按 {baseSlot} 环施放，不消耗职业法术位</Text>}{configurable && <Text style={styles.longPressHint}>长按打开升环配置</Text>}{capacity.maximum > 1 && !spell.area && <TargetAllocation spell={spell} maximum={capacity.maximum} assigned={assigned} selectedTargetId={selectedTargetId} targets={targets} onChange={(value) => setSpellTargets((state) => ({ ...state, [spell.id]: value }))} />}</Pressable><Pressable disabled={!canCast} delayLongPress={420} accessibilityHint={configurable ? '轻点按基础环位施放，长按配置升环施法' : '轻点施放法术'} style={[styles.use, !canCast && styles.disabled]} onPressIn={() => { longPressSpellRef.current = null }} onLongPress={() => { longPressSpellRef.current = spell.id; openSpellConfiguration(spell) }} onPress={() => { if (longPressSpellRef.current === spell.id) { longPressSpellRef.current = null; return } castSpell(spell, undefined, baseSlot) }}><Text style={styles.useText}>{canCast ? '施放' : '未准备'}</Text></Pressable></View>
      }) : tab === 'spells' && <Text style={styles.empty}>当前角色没有可用法术。</Text>}
      {tab === 'items' && (character.dnd5eInventory?.entries ?? []).map((entry) => {
        const actions = entry.item.useActions?.length ? entry.item.useActions : entry.item.use ? [{ id: 'default', label: '使用', ...entry.item.use }] : []
        return <View key={entry.instanceId} style={styles.entry}><Text style={styles.itemIcon}>{entry.item.icon || '◇'}</Text><View style={{ flex: 1 }}><Text style={styles.entryTitle}>{entry.item.name} ×{entry.quantity}</Text><Text style={styles.entryMeta} numberOfLines={3}>{entry.item.description || entry.item.rulesText}</Text><View style={styles.itemActions}>{actions.map((action) => <Pressable key={action.id} style={styles.miniUse} onPress={() => {
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
            return onSubmit({ type: 'dnd5e-item-use', dnd5eItemUse: { instanceId: entry.instanceId, ...(target ? { targetTokenId: target.id } : {}), ...(targetCell ? { targetCell } : {}) } }, `${action.label}${entry.item.name}`, !workspace.combat?.active)
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
      }} /><RegisteredActionGrid actions={workspace.actionRegistry.actions.filter((entry) => entry.group === 'features')} onAction={runRegisteredAction} emptyLabel="当前规则包没有可在移动端主动使用的扩展能力。" /></>}
      {tab === 'checks' && <View style={styles.checkCard}><Text style={styles.entryTitle}>属性 / 技能检定</Text><Text style={styles.small}>直接选属性，或选择一项技能；技能会自动关联正确属性。</Text><View style={styles.abilityRow}>{Object.entries({ str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }).map(([id, label]) => <Pressable key={id} style={[styles.ability, ability === id && !skill && styles.abilityActive]} onPress={() => { setAbility(id); setSkill('') }}><Text style={styles.abilityText}>{label}</Text></Pressable>)}</View><View style={styles.skillGrid}>{mobileSkills.map(([id, label, relatedAbility]) => <Pressable key={id} style={[styles.skill, skill === id && styles.abilityActive]} onPress={() => { setSkill(id); setAbility(relatedAbility) }}><Text style={styles.skillText}>{label} · {abilityShort(relatedAbility)}</Text></Pressable>)}</View><TextInput value={dc} onChangeText={setDc} keyboardType="number-pad" style={styles.input} placeholder="DC" placeholderTextColor={colors.muted} /><Pressable style={styles.toggle} onPress={() => setSpendAction((value) => !value)}><View style={[styles.box, spendAction && styles.boxChecked]} /><Text style={styles.small}>作为主动动作</Text></Pressable><Pressable style={styles.primary} onPress={() => void submit({ type: 'dnd5e-ability-check', dnd5eAbilityCheck: { ability, ...(skill ? { skill } : {}), dc: Number(dc) || 10, mode: 'normal', spendAction } }, `${skill ? mobileSkills.find(([id]) => id === skill)?.[1] : abilityShort(ability)}检定`, !workspace.combat?.active)}><Text style={styles.primaryText}>投掷检定</Text></Pressable></View>}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
    {!!configuringSpellId && (() => {
      const spell = workspace.spells.find((candidate) => candidate.id === configuringSpellId)
      if (!spell) return null
      const levels = mobileAvailableSpellSlotLevels(spell, character)
      const selectedSlot = levels.includes(slotBySpell[spell.id]) ? slotBySpell[spell.id] : levels[0]
      const capacity = spellTargetCapacity(spell, selectedSlot, character.level)
      const assigned = spellTargets[spell.id] ?? []
      return <View style={styles.spellConfigOverlay}>
        <View style={styles.spellConfigCard}>
          <View style={styles.head}><View><Text style={styles.dialogEyebrow}>长按施法配置</Text><Text style={styles.title}>{spell.name}</Text></View><Pressable onPress={() => setConfiguringSpellId('')}><Text style={styles.close}>×</Text></Pressable></View>
          <Text style={styles.configDescription}>普通点击始终使用 {mobileSpellBaseSlotLevel(spell, character)} 环；只有从这里确认才会升环施放。</Text>
          <Text style={styles.configLabel}>选择施法环位</Text>
          <View style={styles.slotChoices}>{levels.map((level) => <Pressable key={level} style={[styles.slotChoice, selectedSlot === level && styles.slotChoiceActive]} onPress={() => setSlotBySpell((state) => ({ ...state, [spell.id]: level }))}><Text style={[styles.slotChoiceText, selectedSlot === level && styles.slotChoiceTextActive]}>{level}环</Text></Pressable>)}</View>
          {capacity.maximum > 1 && !spell.area && <TargetAllocation spell={spell} maximum={capacity.maximum} assigned={assigned} selectedTargetId={selectedTargetId} targets={targets} onChange={(value) => setSpellTargets((state) => ({ ...state, [spell.id]: value }))} />}
          {!levels.length && <Text style={styles.error}>当前没有可用于施放该法术的法术位。</Text>}
          <Pressable disabled={!levels.length} style={[styles.configCast, !levels.length && styles.disabled]} onPress={() => { setConfiguringSpellId(''); castSpell(spell, undefined, selectedSlot) }}><Text style={styles.configCastText}>以 {selectedSlot} 环施放</Text></Pressable>
        </View>
      </View>
    })()}
  </View></View></Modal>

  function openSpellConfiguration(spell: MobileSpellView) {
    if (spell.level === 0 || spell.racialInnate) return
    const levels = mobileAvailableSpellSlotLevels(spell, character)
    const baseSlot = mobileSpellBaseSlotLevel(spell, character)
    setSlotBySpell((state) => ({ ...state, [spell.id]: levels.includes(state[spell.id]) ? state[spell.id] : levels.find((level) => level >= baseSlot) ?? baseSlot }))
    setConfiguringSpellId(spell.id)
  }
}

function TargetPicker({ targets, value, onChange }: { targets: PlayerTokenView[]; value: string; onChange: (id: string) => void }) { return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targets}>{targets.map((target) => <Pressable key={target.id} style={[styles.target, value === target.id && styles.targetActive]} onPress={() => onChange(target.id)}><View style={[styles.targetDot, { backgroundColor: target.portraitColor }]} /><Text numberOfLines={1} style={styles.targetText}>{target.name}</Text></Pressable>)}</ScrollView> }
function TargetAllocation({ spell, maximum, assigned, selectedTargetId, targets, onChange }: { spell: MobileSpellView; maximum: number; assigned: string[]; selectedTargetId: string; targets: PlayerTokenView[]; onChange: (value: string[]) => void }) {
  const names = assigned.map((id) => targets.find((target) => target.id === id)?.name ?? id)
  return <View style={styles.allocation}><Text numberOfLines={2} style={styles.allocationText}>{assigned.length}/{maximum} · {names.length ? names.join('、') : '尚未分配目标'}</Text><View style={styles.allocationButtons}><Pressable disabled={!selectedTargetId || assigned.length >= maximum || (!spell.allowDuplicateTargets && assigned.includes(selectedTargetId))} style={styles.allocate} onPress={() => onChange([...assigned, selectedTargetId])}><Text style={styles.allocateText}>加入当前目标</Text></Pressable>{assigned.length > 0 && <Pressable style={styles.allocate} onPress={() => onChange(assigned.slice(0, -1))}><Text style={styles.allocateText}>撤销</Text></Pressable>}</View></View>
}

function spellTargetCapacity(spell: MobileSpellView, slotLevel: number, characterLevel: number) {
  const upcast = Math.max(0, slotLevel - spell.level)
  if (spell.id === 'eldritch-blast') return { maximum: characterLevel >= 17 ? 4 : characterLevel >= 11 ? 3 : characterLevel >= 5 ? 2 : 1, projectiles: true }
  if (spell.baseProjectiles != null) return { maximum: spell.baseProjectiles + upcast * (spell.additionalProjectilesPerHigherSlot ?? 0), projectiles: true }
  const maximum = Math.max(1, (spell.maximumTargets ?? 1) + upcast * (spell.additionalTargetsPerHigherSlot ?? 0))
  return { maximum, projectiles: spell.allowDuplicateTargets === true }
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
    rangeFeet: spell.rangeFeet, target: spell.target, requiresVisibleTarget: spell.requiresVisibleTarget,
    area: spell.area ? { shape: spell.area.shape, origin: spell.area.origin, ...('radiusFeet' in spell.area ? { radiusFeet: spell.area.radiusFeet } : {}), ...('widthFeet' in spell.area ? { widthFeet: spell.area.widthFeet } : {}), ...('heightFeet' in spell.area ? { heightFeet: spell.area.heightFeet } : {}), ...('lengthFeet' in spell.area ? { lengthFeet: spell.area.lengthFeet } : {}), ...('placeRangeFeet' in spell.area ? { placeRangeFeet: spell.area.placeRangeFeet } : {}), ...('aimRangeFeet' in spell.area ? { aimRangeFeet: spell.area.aimRangeFeet } : {}) } : undefined,
    maximumTargets: spell.maximumTargets, additionalTargetsPerHigherSlot: spell.additionalTargetsPerHigherSlot,
    baseProjectiles: spell.baseProjectiles, additionalProjectilesPerHigherSlot: spell.additionalProjectilesPerHigherSlot,
    allowDuplicateTargets: spell.id === 'magic-missile' || spell.id === 'eldritch-blast' || spell.baseProjectiles != null,
    areaTargetCount: spell.areaTargetCount, minimumAreaTargetCount: spell.minimumAreaTargetCount,
    automationReason: `由物品以 ${castAtLevel || spell.level} 环施放`,
  }
}
function RegisteredActionGrid({ actions, onAction, emptyLabel }: {
  actions: MobileActionDescriptorV1[]
  onAction: (action: MobileActionDescriptorV1) => void
  emptyLabel?: string
}) {
  if (!actions.length) return <Text style={styles.empty}>{emptyLabel ?? '当前没有可用行动。'}</Text>
  return <View style={styles.grid}>{actions.map((entry) => <Pressable
    key={entry.id}
    accessibilityLabel={entry.label}
    accessibilityHint={`${entry.automation === 'full' ? '完整自动化' : '需要 Host 复核'} · ${entry.economy}`}
    style={styles.action}
    onPress={() => onAction(entry)}
  ><Text style={styles.actionIcon}>{entry.icon ?? (entry.source === 'plugin' ? '◇' : '✦')}</Text><Text numberOfLines={2} style={styles.actionText}>{entry.label}</Text>{entry.source === 'plugin' && <Text style={styles.registryMeta}>{entry.automation === 'full' ? 'Headless' : 'Host 复核'}</Text>}</Pressable>)}</View>
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
  const actions: Array<{ label: string; icon?: string; run: () => void }> = []
  const names: Record<string, string> = { fighter: '战士', barbarian: '野蛮人', rogue: '游荡者', bard: '吟游诗人', paladin: '圣武士', cleric: '牧师', monk: '武僧', ranger: '游侠', sorcerer: '术士', druid: '德鲁伊', warlock: '邪术师' }
  const levelOf = (id: string) => character.classLevels?.[id] ?? (character.charClass.toLowerCase().includes(id) || character.charClass.includes(names[id] ?? id) ? character.level : 0)
  const subclass = (id: string) => id === 'fighter' ? character.dnd5eClassChoices?.fighter?.subclass : character.dnd5eClassChoices?.classes?.[id]?.subclass
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
  add('barbarian', 1, '结束狂暴', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'barbarian-rage', end: true } })
  addTarget('barbarian', 10, '威吓慑人', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'barbarian-intimidating-presence', targetTokenId: target.id } }), 'berserker')
  for (const option of ['dash', 'disengage', 'hide'] as const) add('rogue', 2, `灵巧动作：${option === 'dash' ? '疾走' : option === 'disengage' ? '撤离' : '躲藏'}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'rogue-cunning-action', option } })
  for (const option of ['sleight-of-hand', 'thieves-tools', 'use-object'] as const) add('rogue', 3, `巧手：${option === 'sleight-of-hand' ? '巧手检定' : option === 'thieves-tools' ? '盗贼工具' : '使用物品'}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'rogue-fast-hands', option } }, 'thief')
  addTarget('bard', 1, '吟游激励', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'bardic-inspiration', targetTokenId: target.id } }))
  add('bard', 6, '反迷惑', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'bard-countercharm' } })
  addTarget('paladin', 1, `圣疗：${Math.max(1, Number(amount) || 1)} 点`, (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'paladin-lay-on-hands', targetTokenId: target.id, amount: Math.max(1, Number(amount) || 1) } }))
  add('paladin', 1, '神圣感知', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-divine-sense' } })
  add('paladin', 3, '神圣武器', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-sacred-weapon' } }, 'devotion')
  add('paladin', 3, '驱散邪魔', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-turn-the-unholy' } }, 'devotion')
  add('paladin', 20, '神圣光环', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'paladin-holy-nimbus' } }, 'devotion')
  add('cleric', 2, '驱散亡灵', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'cleric-turn-undead' } })
  addTarget('cleric', 2, `保全生命：${Math.max(1, Number(amount) || 1)} 点`, (target) => ({ type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'cleric-preserve-life', allocations: [{ targetTokenId: target.id, amount: Math.max(1, Number(amount) || 1) }] } }), 'life')
  add('cleric', 10, '神圣干预', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'cleric-divine-intervention' } })
  for (const option of ['dash', 'disengage'] as const) add('monk', 2, `疾风步：${option === 'dash' ? '疾走' : '撤离'}`, { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-step-of-the-wind', option } })
  add('monk', 2, '耐心防御', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-patient-defense' } })
  addTarget('monk', 1, '武艺徒手击', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, dnd5eClassFeature: { feature: 'monk-unarmed-bonus', mode: 'martial-arts', targetTokenIds: [target.id], ...(stunningStrike ? { stunningStrike: true } : {}) } }))
  addTarget('monk', 2, '疾风连击', (target) => ({ type: 'dnd5e-class-feature', targetTokenId: target.id, targetTokenIds: [target.id], dnd5eClassFeature: { feature: 'monk-unarmed-bonus', mode: 'flurry', targetTokenIds: [target.id, target.id], ...(stunningStrike ? { stunningStrike: true } : {}) } }))
  add('monk', 6, '身心合一', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-wholeness-of-body' } }, 'open-hand')
  add('monk', 7, '静心：结束魅惑', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-stillness-of-mind', condition: 'charmed' } })
  add('monk', 7, '静心：结束恐慌', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-stillness-of-mind', condition: 'frightened' } })
  add('monk', 18, '空灵体', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'monk-empty-body' } })
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
  add('druid', 2, '恢复原形', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'druid-end-wild-shape' } })
  add('warlock', 14, '坠入地狱：待命', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'warlock-hurl-through-hell-ready', active: true } }, 'fiend')
  add('warlock', 14, '坠入地狱：取消', { type: 'dnd5e-class-feature', dnd5eClassFeature: { feature: 'warlock-hurl-through-hell-ready', active: false } }, 'fiend')
  if (character.racialRules?.dragonbornAncestry && actor) actions.unshift({ label: `${character.racialRules.dragonbornAncestry.name}吐息`, icon: '◒', run: beginDragonbornBreath })
  return <View><View style={styles.featureConfig}><TextInput value={amount} onChangeText={setAmount} keyboardType="number-pad" style={styles.featureInput} placeholder="治疗/分配点数" placeholderTextColor={colors.muted} /><TextInput value={featureSlot} onChangeText={setFeatureSlot} keyboardType="number-pad" style={styles.featureInput} placeholder="选用环位 1–5" placeholderTextColor={colors.muted} />{levelOf('monk') >= 5 && <Pressable style={styles.toggle} onPress={() => setStunningStrike((value) => !value)}><View style={[styles.box, stunningStrike && styles.boxChecked]} /><Text style={styles.small}>徒手攻击预激活震慑拳</Text></Pressable>}</View><View style={styles.grid}>{actions.length ? actions.map((entry) => <Pressable key={entry.label} style={styles.action} onPress={entry.run}><Text style={styles.actionIcon}>{entry.icon ?? '✦'}</Text><Text numberOfLines={2} style={styles.actionText}>{entry.label}</Text></Pressable>) : <Text style={styles.empty}>当前角色没有移动端可声明的主动特性；被动与反应仍由 Host 自动触发。</Text>}</View></View>
}

function shortFeatureId(value: string) {
  return value.split(':').pop()?.replaceAll('-', ' ') || value
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#0008' }, sheet: { height: '82%', backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border }, head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 }, title: { color: colors.text, fontSize: 18, fontWeight: '900' }, close: { color: colors.muted, fontSize: 26 }, tabs: { gap: 7, paddingHorizontal: 12, paddingBottom: 9 }, tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border }, tabActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, tabText: { color: colors.text, fontWeight: '800', fontSize: 10 }, targets: { gap: 7, paddingHorizontal: 12, paddingBottom: 9 }, target: { width: 74, padding: 7, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 12 }, targetActive: { borderColor: colors.warning }, targetDot: { width: 30, height: 30, borderRadius: 15 }, targetText: { color: colors.text, fontSize: 9, fontWeight: '800', marginTop: 4 }, body: { flex: 1 }, content: { padding: 12, paddingBottom: 40 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, action: { width: '31%', minHeight: 82, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 15, alignItems: 'center', justifyContent: 'center', padding: 8 }, actionIcon: { color: colors.primary, fontSize: 21 }, actionText: { color: colors.text, fontWeight: '800', fontSize: 10, textAlign: 'center', marginTop: 6 }, registryMeta: { color: colors.teal, fontSize: 8, fontWeight: '800', marginTop: 4 },
  featureConfig: { gap: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface }, featureInput: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.background, paddingHorizontal: 10, paddingVertical: 8 },
  entry: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 11, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: 8 }, entryTitle: { color: colors.text, fontWeight: '900', fontSize: 13 }, entryMeta: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 3 }, itemIcon: { fontSize: 22 }, use: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 }, useText: { color: '#d8ccff', fontWeight: '900', fontSize: 10 }, small: { color: colors.muted, fontSize: 10 }, longPressHint: { color: colors.warning, fontSize: 9, fontWeight: '800', marginTop: 5 },
  allocation: { marginTop: 7, padding: 7, borderRadius: 9, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }, allocationText: { color: colors.muted, fontSize: 9, lineHeight: 13 }, allocationButtons: { flexDirection: 'row', gap: 6, marginTop: 6 }, allocate: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, borderWidth: 1, borderColor: colors.primary }, allocateText: { color: '#d8ccff', fontSize: 8, fontWeight: '800' }, itemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 7 }, miniUse: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 }, miniUseText: { color: '#d8ccff', fontSize: 9, fontWeight: '900' }, unusable: { color: colors.muted, fontSize: 9 },
  checkCard: { gap: 10, padding: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 15, backgroundColor: colors.surface }, abilityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, ability: { paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 9 }, abilityActive: { borderColor: colors.teal, backgroundColor: '#0b2b2a' }, abilityText: { color: colors.text, fontSize: 10, fontWeight: '800' }, skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, skill: { width: '31%', paddingHorizontal: 7, paddingVertical: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 9 }, skillText: { color: colors.text, fontSize: 9, fontWeight: '700' }, input: { color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.background, padding: 10 }, toggle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, box: { width: 17, height: 17, borderRadius: 5, borderWidth: 1, borderColor: colors.border }, boxChecked: { backgroundColor: colors.teal }, primary: { backgroundColor: colors.primary, borderRadius: 11, padding: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '900' }, empty: { color: colors.muted, fontSize: 11, lineHeight: 18 }, error: { color: colors.danger, marginTop: 10 }, disabled: { opacity: .42 },
  spellConfigOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: 'flex-end', backgroundColor: '#000b' }, spellConfigCard: { maxHeight: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.background, paddingBottom: 18 }, dialogEyebrow: { color: colors.warning, fontSize: 9, fontWeight: '900', marginBottom: 3 }, configDescription: { color: colors.muted, fontSize: 10, lineHeight: 16, paddingHorizontal: 15 }, configLabel: { color: colors.text, fontSize: 11, fontWeight: '900', paddingHorizontal: 15, marginTop: 14 }, slotChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 15, paddingTop: 9 }, slotChoice: { minWidth: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' }, slotChoiceActive: { borderColor: colors.warning, backgroundColor: '#33230b' }, slotChoiceText: { color: colors.muted, fontWeight: '800' }, slotChoiceTextActive: { color: colors.warning }, configCast: { marginHorizontal: 15, marginTop: 15, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', paddingVertical: 12 }, configCastText: { color: '#fff', fontWeight: '900' },
})
