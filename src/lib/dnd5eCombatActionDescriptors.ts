import type { Dnd5eActionIconSpec } from './dnd5eActionIcons'
import { dnd5eSystemActionIcon } from './dnd5eActionIcons'

export const DND5E_COMBAT_ACTION_DESCRIPTOR_SCHEMA_VERSION = 1 as const

export type Dnd5eCombatActionSourceKind = 'system' | 'weapon' | 'feature' | 'spell' | 'item'
export type Dnd5eCombatActionEconomy = 'action' | 'bonus-action' | 'reaction' | 'movement' | 'none' | 'special'
export type Dnd5eCombatActionTargeting = 'none' | 'self' | 'creature' | 'area' | 'map-position' | 'configure'
export type Dnd5eCombatActionPanel = 'inventory' | 'features' | 'spells' | 'skills'

export type Dnd5eCombatActionCommand =
  | { kind: 'select-move' }
  | { kind: 'select-weapon-target' }
  | { kind: 'basic-action'; action: 'dash' | 'hide' }
  | { kind: 'dodge' }
  | { kind: 'disengage' }
  | { kind: 'open-panel'; panel: Dnd5eCombatActionPanel; focusId?: string }
  | { kind: 'use-item'; instanceId: string }
  | { kind: 'end-turn' }

export interface Dnd5eCombatActionResourceBadge {
  label: string
  current: number
  maximum?: number
}

/**
 * UI-only declarative action contract. It never grants authority to resolve an action:
 * command handlers must route back through the existing DM/Headless transaction entry points.
 */
export interface Dnd5eCombatActionDescriptorV1 {
  schemaVersion: typeof DND5E_COMBAT_ACTION_DESCRIPTOR_SCHEMA_VERSION
  id: string
  sourceKind: Dnd5eCombatActionSourceKind
  label: string
  description: string
  icon: Dnd5eActionIconSpec
  economy: Dnd5eCombatActionEconomy
  targeting: Dnd5eCombatActionTargeting
  resource?: Dnd5eCombatActionResourceBadge
  enabled: boolean
  disabledReason?: string
  command: Dnd5eCombatActionCommand
}

export function groupDnd5eCombatHotbarDescriptors(descriptors: readonly Dnd5eCombatActionDescriptorV1[]) {
  return {
    spells: descriptors.filter((entry) => entry.sourceKind === 'spell'),
    items: descriptors.filter((entry) => entry.sourceKind === 'item'),
    features: descriptors.filter((entry) => entry.sourceKind === 'feature'),
    basics: descriptors.filter((entry) => entry.sourceKind !== 'spell' && entry.sourceKind !== 'item' && entry.sourceKind !== 'feature'),
  }
}

export interface Dnd5eCombatActionSpellSource {
  id: string
  label: string
  description: string
  icon: Dnd5eActionIconSpec
  level: number
  castingTime: Dnd5eCombatActionEconomy
  targeting: Dnd5eCombatActionTargeting
  castingClassId: string
  available: boolean
  unavailableReason?: string
}

export interface Dnd5eCombatActionItemSource {
  instanceId: string
  label: string
  description: string
  icon: Dnd5eActionIconSpec
  economy: Dnd5eCombatActionEconomy
  targeting: Dnd5eCombatActionTargeting
  quantity: number
  resource?: Dnd5eCombatActionResourceBadge
  usable: boolean
  unavailableReason?: string
}

export interface BuildDnd5eCombatActionDescriptorsInput {
  canAct: boolean
  pending: boolean
  actionRemaining: number
  bonusActionRemaining: number
  movementRemaining: number
  weaponLabel?: string
  spells?: readonly Dnd5eCombatActionSpellSource[]
  items?: readonly Dnd5eCombatActionItemSource[]
}

function availability(input: BuildDnd5eCombatActionDescriptorsInput, economy: Dnd5eCombatActionEconomy, sourceAvailable = true, sourceReason?: string) {
  if (input.pending) return { enabled: false, disabledReason: '正在等待 DM 结算上一项操作。' }
  if (!input.canAct) return { enabled: false, disabledReason: '当前不是该角色的可行动回合。' }
  if (!sourceAvailable) return { enabled: false, disabledReason: sourceReason ?? '当前资源不足或不满足使用条件。' }
  if (economy === 'action' && input.actionRemaining <= 0) return { enabled: false, disabledReason: '本回合动作已用尽。' }
  if (economy === 'bonus-action' && input.bonusActionRemaining <= 0) return { enabled: false, disabledReason: '本回合附赠动作已用尽。' }
  if (economy === 'movement' && input.movementRemaining <= 0) return { enabled: false, disabledReason: '本回合移动力已用尽。' }
  return { enabled: true, disabledReason: undefined }
}

function descriptor(
  base: Omit<Dnd5eCombatActionDescriptorV1, 'schemaVersion' | 'enabled' | 'disabledReason'>,
  state: ReturnType<typeof availability>,
): Dnd5eCombatActionDescriptorV1 {
  return { schemaVersion: 1, ...base, ...state }
}

export function buildDnd5eCombatActionDescriptors(input: BuildDnd5eCombatActionDescriptorsInput): Dnd5eCombatActionDescriptorV1[] {
  const actions: Dnd5eCombatActionDescriptorV1[] = [
    descriptor({
      id: 'system:weapon-attack', sourceKind: 'weapon', label: input.weaponLabel ? `攻击：${input.weaponLabel}` : '武器攻击',
      description: '选择地图上的目标，由 Headless 校验武器、熟练、距离、掩护、弹药与本回合攻击次数。',
      icon: dnd5eSystemActionIcon('weapon-attack', 'weapon'), economy: 'action', targeting: 'creature',
      command: { kind: 'select-weapon-target' },
    }, availability(input, 'action')),
    descriptor({
      id: 'system:move', sourceKind: 'system', label: '移动', description: '显示本回合剩余移动范围，并在地图上选择合法落点。',
      icon: dnd5eSystemActionIcon('move', 'move'), economy: 'movement', targeting: 'map-position', command: { kind: 'select-move' },
      resource: { label: '尺', current: input.movementRemaining },
    }, availability(input, 'movement')),
    descriptor({
      id: 'system:dash', sourceKind: 'system', label: '疾走', description: '消耗一个动作，使本回合可用移动力增加等同于当前有效速度的数值。',
      icon: dnd5eSystemActionIcon('dash', 'movement'), economy: 'action', targeting: 'none', command: { kind: 'basic-action', action: 'dash' },
    }, availability(input, 'action')),
    descriptor({
      id: 'system:dodge', sourceKind: 'system', label: '闪避', description: '消耗一个动作；直到你的下一回合开始，针对你的可见攻击具有劣势，并使敏捷豁免具有优势。',
      icon: dnd5eSystemActionIcon('dodge', 'armor'), economy: 'action', targeting: 'self', command: { kind: 'dodge' },
    }, availability(input, 'action')),
    descriptor({
      id: 'system:disengage', sourceKind: 'system', label: '撤离', description: '消耗一个动作；你在本回合的移动不会触发借机攻击。',
      icon: dnd5eSystemActionIcon('disengage', 'movement'), economy: 'action', targeting: 'self', command: { kind: 'disengage' },
    }, availability(input, 'action')),
    descriptor({
      id: 'system:hide', sourceKind: 'system', label: '躲藏', description: '消耗一个动作并进行敏捷（隐匿）检定；Headless 会与敌人的被动察觉比较。',
      icon: dnd5eSystemActionIcon('hide', 'illusion'), economy: 'action', targeting: 'none', command: { kind: 'basic-action', action: 'hide' },
    }, availability(input, 'action')),
    descriptor({
      id: 'feature:class-actions', sourceKind: 'feature', label: '职业特性', description: '打开当前职业、子职与插件授予的 Headless 主动能力；被动能力仍由结算引擎自动应用。',
      icon: dnd5eSystemActionIcon('other-actions', 'control'), economy: 'special', targeting: 'configure', command: { kind: 'open-panel', panel: 'skills' },
    }, availability(input, 'none')),
    descriptor({
      id: 'system:other-actions', sourceKind: 'system', label: '更多基础行动', description: '打开擒抱、推撞、协助、准备动作与使用物件等完整控制面板。',
      icon: dnd5eSystemActionIcon('other-basic-actions', 'control'), economy: 'special', targeting: 'configure', command: { kind: 'open-panel', panel: 'skills' },
    }, availability(input, 'none')),
    descriptor({
      id: 'system:end-turn', sourceKind: 'system', label: '结束回合', description: '提交结束回合请求；下一回合将恢复行动经济。',
      icon: dnd5eSystemActionIcon('end-turn', 'arcane'), economy: 'none', targeting: 'none', command: { kind: 'end-turn' },
    }, availability(input, 'none')),
  ]

  for (const spell of input.spells ?? []) {
    actions.push(descriptor({
      id: `spell:${spell.castingClassId}:${spell.id}`,
      sourceKind: 'spell',
      label: spell.label,
      description: spell.description,
      icon: spell.icon,
      economy: spell.castingTime,
      targeting: 'configure',
      resource: { label: spell.level === 0 ? '戏法' : '环', current: spell.level },
      command: { kind: 'open-panel', panel: 'spells', focusId: spell.id },
    }, availability(input, spell.castingTime, spell.available, spell.unavailableReason)))
  }

  for (const item of input.items ?? []) {
    actions.push(descriptor({
      id: `item:${item.instanceId}`,
      sourceKind: 'item',
      label: item.label,
      description: item.description,
      icon: item.icon,
      economy: item.economy,
      targeting: item.targeting,
      resource: item.resource ?? { label: '数量', current: item.quantity },
      command: { kind: 'use-item', instanceId: item.instanceId },
    }, availability(input, item.economy, item.usable, item.unavailableReason)))
  }

  return actions
}

export const DND5E_COMBAT_HOTBAR_SCHEMA_VERSION = 1 as const
export const DND5E_COMBAT_HOTBAR_PAGE_SIZE = 10

export interface Dnd5eCombatHotbarPreferenceV1 {
  schemaVersion: typeof DND5E_COMBAT_HOTBAR_SCHEMA_VERSION
  actionIds: string[]
  activePage: number
}

export function reconcileDnd5eCombatHotbarPreference(
  preference: Dnd5eCombatHotbarPreferenceV1 | undefined,
  descriptors: readonly Dnd5eCombatActionDescriptorV1[],
): Dnd5eCombatHotbarPreferenceV1 {
  const availableIds = new Set(descriptors.map((entry) => entry.id))
  const saved = preference?.actionIds.filter((id, index, values) => availableIds.has(id) && values.indexOf(id) === index) ?? []
  const savedSet = new Set(saved)
  const actionIds = [...saved, ...descriptors.map((entry) => entry.id).filter((id) => !savedSet.has(id))]
  const pageCount = Math.max(1, Math.ceil(actionIds.length / DND5E_COMBAT_HOTBAR_PAGE_SIZE))
  return {
    schemaVersion: DND5E_COMBAT_HOTBAR_SCHEMA_VERSION,
    actionIds,
    activePage: Math.min(pageCount - 1, Math.max(0, Math.floor(preference?.activePage ?? 0))),
  }
}

export function moveDnd5eCombatHotbarAction(actionIds: readonly string[], sourceId: string, targetId: string): string[] {
  const sourceIndex = actionIds.indexOf(sourceId)
  const targetIndex = actionIds.indexOf(targetId)
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return [...actionIds]
  const next = [...actionIds]
  const [moved] = next.splice(sourceIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next
}
