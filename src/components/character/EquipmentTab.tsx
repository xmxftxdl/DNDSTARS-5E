import { useMemo, useState, useSyncExternalStore, type ComponentType, type DragEvent } from 'react'
import {
  Backpack,
  BedDouble,
  Beef,
  Cable,
  CircleDot,
  ChevronDown,
  Crown,
  Droplets,
  Flame,
  FlaskConical,
  Footprints,
  Gem,
  HandHelping,
  PackageOpen,
  Search,
  Shield,
  ShieldPlus,
  Skull,
  Sparkles,
  Sword,
  TentTree,
  Trash2,
  TriangleAlert,
  Weight,
  X,
} from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import Dnd5eActionIcon from '../map/Dnd5eActionIcon'
import { EQUIPMENT_SLOT_LABELS } from '../../lib/equipmentDefaults'
import { dnd5eItemActionIcon } from '../../lib/dnd5eActionIcons'
import { modeFromPort } from '../../lib/appMode'
import { showAppConfirm } from '../../lib/appDialog'
import { getRoomSession } from '../../lib/roomSession'
import {
  getRoomRulesSnapshot,
  subscribeRoomRules,
} from '../../lib/roomRulesState'
import { mutateRoomCharacterInventory } from '../../store/roomCommands'
import {
  dnd5eAttunementRequirementDecision,
  dnd5eInventoryEntryIsActive,
  dnd5eInventoryLoad,
  normalizeDnd5eInventory,
} from '../../rulesets/dnd5e/items'
import { planDnd5eInventoryUse } from '../../rulesets/dnd5e/inventoryUsePlanning'
import {
  DND5E_MAGIC_ITEM_KIND_LABELS,
  DND5E_MAGIC_ITEM_RARITY_LABELS,
} from '../../rulesets/dnd5e/magicItems'
import { dnd5eArmorProficient, dnd5eWeaponProficient } from '../../rulesets/dnd5e/equipment'
import { dnd5eMartialSpellSynergyForCharacter } from '../../rulesets/dnd5e/martialSpellSynergy'
import { getDnd5eSrdCombatSpell } from '../../rulesets/dnd5e/spells'
import {
  DND5E_EDITABLE_CURRENCIES,
  DND5E_EDITABLE_CURRENCY_LABELS,
} from '../../types/inventory'
import type { Dnd5eInventoryEntry, Dnd5eInventoryIconId } from '../../types/inventory'
import type { Dnd5eInventoryCategory } from '../../types/inventory'
import type { EquipmentItem, EquipmentSlot } from '../../types/equipment'
import type { Character } from '../../types/character'
import {
  dnd5eInventoryBrowserEntries,
  type Dnd5eInventoryCategoryFilter,
  type Dnd5eInventorySort,
} from './inventoryBrowserModel'
import {
  DND5E_INVENTORY_DRAG_MIME,
  dnd5eInventoryDropDecision,
} from './inventoryDragModel'

const ICONS: Record<Dnd5eInventoryIconId, ComponentType<{ className?: string }>> = {
  weapon: Sword,
  armor: Shield,
  shield: Shield,
  backpack: Backpack,
  bedroll: BedDouble,
  rope: Cable,
  torch: Flame,
  tinderbox: Sparkles,
  waterskin: Droplets,
  rations: Beef,
  'healers-kit': ShieldPlus,
  'ball-bearings': CircleDot,
  caltrops: TriangleAlert,
  'hunting-trap': TentTree,
  acid: FlaskConical,
  'alchemists-fire': Flame,
  'holy-water': Droplets,
  antitoxin: FlaskConical,
  poison: Skull,
  'healing-potion': FlaskConical,
  'spellcasting-focus': Sparkles,
  'magic-ring': Gem,
  'magic-wand': Sparkles,
  'magic-staff': Sword,
  'magic-scroll': PackageOpen,
  'magic-wondrous': Sparkles,
  generic: PackageOpen,
}

const SLOT_ICONS: Partial<Record<EquipmentSlot, ComponentType<{ className?: string }>>> = {
  mainWeapon: Sword,
  offHand: Sword,
  armor: Shield,
  helmet: Crown,
  shoes: Footprints,
  ring: Gem,
  ring2: Gem,
  belt: Cable,
  necklace: Gem,
}

const LEFT_EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'helmet',
  'armor',
  'belt',
  'shoes',
  'mainWeapon',
]

const RIGHT_EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'necklace',
  'ring',
  'ring2',
  'offHand',
]

function isHandEquipmentSlot(slot: EquipmentSlot | undefined): boolean {
  return slot === 'mainWeapon' || slot === 'offHand'
}

function equipmentCanBeHeldInHand(item: EquipmentItem | undefined): boolean {
  if (!item) return false
  return isHandEquipmentSlot(item.slot) || item.allowedSlots?.some(isHandEquipmentSlot) === true
}

const CATEGORY_LABELS = {
  equipment: '装备',
  'magic-item': '魔法物品',
  'adventuring-gear': '冒险用品',
  consumable: '消耗品',
  tool: '工具',
  container: '容器',
} as const

const INVENTORY_CATEGORY_FILTERS: readonly [Dnd5eInventoryCategoryFilter, string][] = [
  ['all', '全部'],
  ['equipment', '装备'],
  ['magic-item', '魔法物品'],
  ['consumable', '消耗品'],
  ['adventuring-gear', '冒险用品'],
  ['tool', '工具'],
  ['container', '容器'],
]

const INVENTORY_SORTS: readonly [Dnd5eInventorySort, string][] = [
  ['name', '名称'],
  ['category', '类型'],
  ['weight', '重量'],
  ['newest', '最近获得'],
]

export interface EquipmentTabProps {
  charId: string
  editable?: boolean
  compact?: boolean
  pending?: boolean
  /** 战斗界面将“使用”接入当前战斗的 DM/Headless 行动事务。 */
  onUseItem?: (instanceId: string, useActionId?: string) => boolean | void
  /** 战斗快捷栏只保存实例 ID；物品本体与数量始终以权威库存为准。 */
  quickbarSlots?: readonly (string | null)[]
  onAssignQuickbarSlot?: (instanceId: string, slotIndex: number) => void
  onClearQuickbarSlot?: (slotIndex: number) => void
}

function equipmentProficiency(
  character: Character,
  item: EquipmentItem,
  spellcastingPrerequisitesEnabled = true,
): {
  category: string
  proficient: boolean
  consequence: string
} | undefined {
  const rules = item.dnd5e
  if (!rules) return undefined
  if (rules.kind === 'weapon') {
    return {
      category: rules.category === 'simple' ? '简易武器' : '军用武器',
      proficient: dnd5eWeaponProficient(character, item),
      consequence: '未熟练武器的攻击检定不加入熟练加值；伤害仍加入适用的属性调整值。',
    }
  }
  return {
    category: rules.kind === 'shield'
      ? '盾牌'
      : rules.category === 'light' ? '轻甲' : rules.category === 'medium' ? '中甲' : '重甲',
    proficient: dnd5eArmorProficient(character, item),
    consequence: `穿戴未熟练护甲或持用未熟练盾牌时，涉及力量或敏捷的检定、豁免与攻击具有劣势${
      spellcastingPrerequisitesEnabled ? '，并且不能施法' : ''
    }；AC 仍按该装备计算。`,
  }
}

function spellcastingFocusClassLabel(classId: string): string {
  const labels: Readonly<Record<string, string>> = {
    bard: '吟游诗人', cleric: '牧师', druid: '德鲁伊', paladin: '圣武士', ranger: '游侠',
    sorcerer: '术士', warlock: '邪术师', wizard: '法师',
  }
  return labels[classId] ?? classId
}

function EquipmentProficiencyNotice({
  character,
  item,
  spellcastingPrerequisitesEnabled,
}: {
  character: Character
  item: EquipmentItem
  spellcastingPrerequisitesEnabled: boolean
}) {
  const result = equipmentProficiency(character, item, spellcastingPrerequisitesEnabled)
  if (!result) return null
  return (
    <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${
      result.proficient
        ? 'border-emerald-400/15 bg-emerald-500/[0.055] text-emerald-100/85'
        : 'border-amber-400/20 bg-amber-500/10 text-amber-100'
    }`}>
      <span className="font-semibold">{result.category} · {result.proficient ? '角色具有熟练' : '角色不具有熟练'}</span>
      {!result.proficient && <span>。{result.consequence}</span>}
    </div>
  )
}

export default function EquipmentTab({
  charId,
  editable = true,
  compact = false,
  pending = false,
  onUseItem,
  quickbarSlots,
  onAssignQuickbarSlot,
  onClearQuickbarSlot,
}: EquipmentTabProps) {
  const character = useCharacterStore((state) => state.characters.find((candidate) => candidate.id === charId))
  const characters = useCharacterStore((state) => state.characters)
  const updateCharacter = useCharacterStore((state) => state.update)
  const [categoryFilter, setCategoryFilter] = useState<Dnd5eInventoryCategoryFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Dnd5eInventorySort>('name')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState('')
  const [draggedInstanceId, setDraggedInstanceId] = useState<string | null>(null)
  const roomRules = useSyncExternalStore(
    subscribeRoomRules,
    getRoomRulesSnapshot,
    getRoomRulesSnapshot,
  )
  const encumbranceEnabled = roomRules?.houseRules.encumbranceEnabled !== false
  const spellcastingPrerequisitesEnabled =
    roomRules?.houseRules.spellcastingPrerequisitesEnabled !== false
  const combatManagementLocked = !!onUseItem
  const isDm = (getRoomSession()?.role ?? modeFromPort()) === 'dm'
  const canIdentify = isDm

  const inventory = useMemo(() => character ? normalizeDnd5eInventory(character) : null, [character])
  if (!character || !inventory) return null

  const entries = dnd5eInventoryBrowserEntries(inventory.entries, {
    query,
    category: categoryFilter,
    sort,
  })
  const selected = inventory.entries.find((entry) => entry.instanceId === selectedId)
  const attunementDecision = selected
    ? dnd5eAttunementRequirementDecision(character, selected)
    : 'met'
  const transferTargets = characters.filter((candidate) =>
    candidate.id !== character.id &&
    candidate.visibleToPlayers !== false &&
    (!character.roomId || !candidate.roomId || candidate.roomId === character.roomId),
  )
  const load = encumbranceEnabled ? dnd5eInventoryLoad(character) : null
  const containers = inventory.entries.filter((entry) => entry.item.containerCapacityWeightLb != null && entry.instanceId !== selected?.instanceId)
  const linkedEquipmentFeature = dnd5eMartialSpellSynergyForCharacter(character, 'linked-equipment')
  const linkedEquipmentLimit = linkedEquipmentFeature?.mechanic.linkedEquipmentLimit ?? 0
  const linkedEquipmentIds = character.dnd5eCombatState?.linkedEquipmentIds ?? []

  const toggleLinkedEquipment = async (weaponId: string, weaponName: string) => {
    const alreadyLinked = linkedEquipmentIds.includes(weaponId)
    if (!alreadyLinked && linkedEquipmentIds.length >= linkedEquipmentLimit) {
      setNotice(`该特性最多登记 ${linkedEquipmentLimit} 件联结武器；请先解除一件现有联结。`)
      return
    }
    if (!alreadyLinked && !await showAppConfirm({
      title: '登记联结武器',
      message: `确认已完成联结仪式，并将“${weaponName}”登记为联结武器吗？`,
      confirmLabel: '确认登记',
    })) return
    const nextLinked = alreadyLinked
      ? linkedEquipmentIds.filter((id) => id !== weaponId)
      : [...linkedEquipmentIds, weaponId]
    updateCharacter(character.id, {
      dnd5eCombatState: {
        ...character.dnd5eCombatState,
        linkedEquipmentIds: nextLinked.length > 0 ? nextLinked : undefined,
      },
    })
    setNotice(alreadyLinked ? `已解除“${weaponName}”的武器联结。` : `已登记“${weaponName}”为联结武器。`)
  }

  const run = (mutation: Parameters<typeof mutateRoomCharacterInventory>[0]) => {
    void mutateRoomCharacterInventory(mutation).then((result) => {
      setNotice(result.message ?? (result.status === 'rejected' ? '物品操作未能完成。' : '物品变更已完成。'))
      if (result.status !== 'rejected') {
        setQuantity(1)
        if (mutation.type === 'discard' || mutation.type === 'transfer' || mutation.type === 'use') setSelectedId(null)
      }
    }).catch((error) => {
      setNotice(error instanceof Error ? error.message : '物品操作未能完成。')
    })
  }

  const activateEntry = (entry: Dnd5eInventoryEntry) => {
    if (onUseItem) {
      if (entry.item.useActions?.length) {
        setNotice('请在物品详情中选择要使用的法术或能力。')
        return
      }
      const submitted = onUseItem(entry.instanceId)
      setNotice(submitted === false ? '当前战斗中不能使用该物品。' : '已提交给 DM/Headless 进行战斗结算。')
      return
    }
    if (entry.item.use?.effect.kind === 'spell-cast') {
      setNotice('物品施法需要从地图操作栏发起，以便选择目标并由 Headless 完成权威结算。')
      return
    }
    const usePlan = planDnd5eInventoryUse(character, entry)
    if (!usePlan.ok) {
      setNotice(`没有可由 ${entry.item.name} 恢复的已消耗法术位。`)
      return
    }
    run({ type: 'use', characterId: character.id, instanceId: entry.instanceId, spellSlotLevel: usePlan.spellSlotLevel })
  }

  const useSelected = () => selected && activateEntry(selected)

  const beginInventoryDrag = (event: DragEvent<HTMLElement>, entry: Dnd5eInventoryEntry) => {
    if (!editable || pending) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'copyMove'
    event.dataTransfer.setData(DND5E_INVENTORY_DRAG_MIME, entry.instanceId)
    event.dataTransfer.setData('text/plain', entry.instanceId)
    setDraggedInstanceId(entry.instanceId)
    setSelectedId(entry.instanceId)
    setQuantity(1)
  }

  const droppedInstanceId = (event: DragEvent<HTMLElement>): string => (
    event.dataTransfer.getData(DND5E_INVENTORY_DRAG_MIME) ||
    event.dataTransfer.getData('text/plain')
  ).trim()

  const dropOnEquipmentSlot = (event: DragEvent<HTMLElement>, slot: EquipmentSlot) => {
    event.preventDefault()
    const instanceId = droppedInstanceId(event)
    const entry = inventory.entries.find((candidate) => candidate.instanceId === instanceId)
    const combatSlotLocked = combatManagementLocked && !isHandEquipmentSlot(slot)
    if (!editable || pending || combatSlotLocked) {
      setNotice(combatSlotLocked ? '战斗中只能切换主手或副手物品；护甲与其他穿戴槽保持锁定。' : '当前不能更换装备。')
      setDraggedInstanceId(null)
      return
    }
    const decision = dnd5eInventoryDropDecision(entry, { kind: 'equipment', slot })
    if (!decision.accepted) {
      setNotice(decision.reason)
      setDraggedInstanceId(null)
      return
    }
    setSelectedId(instanceId)
    run({ type: 'equip', characterId: character.id, instanceId, slot })
    setDraggedInstanceId(null)
  }

  const dropOnQuickbarSlot = (event: DragEvent<HTMLElement>, slotIndex: number) => {
    event.preventDefault()
    const instanceId = droppedInstanceId(event)
    const entry = inventory.entries.find((candidate) => candidate.instanceId === instanceId)
    const decision = dnd5eInventoryDropDecision(entry, { kind: 'quickbar', slotIndex })
    if (!decision.accepted || !onAssignQuickbarSlot) {
      setNotice(decision.accepted ? '当前页面没有可编辑的战斗快捷栏。' : decision.reason)
      setDraggedInstanceId(null)
      return
    }
    onAssignQuickbarSlot(instanceId, slotIndex)
    setSelectedId(instanceId)
    setNotice(`已将 ${entry ? displayItemName(entry) : '物品'} 放入快捷栏 ${slotIndex + 1}。`)
    setDraggedInstanceId(null)
  }

  const renderEquipmentSlot = (slot: EquipmentSlot) => {
    const item = character.equipment?.[slot]
    const entry = inventory.entries.find((candidate) => candidate.equippedSlot === slot)
    const Icon = SLOT_ICONS[slot] ?? Shield
    const decision = draggedInstanceId
      ? dnd5eInventoryDropDecision(
          inventory.entries.find((candidate) => candidate.instanceId === draggedInstanceId),
          { kind: 'equipment', slot },
        )
      : undefined
    const combatSlotLocked = combatManagementLocked && !isHandEquipmentSlot(slot)
    const canDrop = decision?.accepted === true && editable && !pending && !combatSlotLocked
    return (
      <div
        key={slot}
        data-testid={`inventory-equipment-slot-${slot}`}
        onDragOver={(event) => {
          if (draggedInstanceId && editable) {
            event.preventDefault()
            event.dataTransfer.dropEffect = canDrop ? 'move' : 'none'
          }
        }}
        onDrop={(event) => dropOnEquipmentSlot(event, slot)}
        className={`group/slot relative flex min-h-[72px] flex-1 items-center justify-center rounded-xl border p-1.5 transition sm:min-h-0 ${canDrop
          ? 'border-emerald-300/65 bg-emerald-400/12 ring-2 ring-emerald-300/15'
          : draggedInstanceId && decision && !decision.accepted
            ? 'border-rose-400/20 bg-rose-500/[0.035]'
            : 'border-white/8 bg-void-950/55 shadow-[inset_0_0_18px_rgba(0,0,0,0.3)]'}`}
      >
        <button
          type="button"
          onClick={() => entry && setSelectedId(entry.instanceId)}
          className="flex w-full min-w-0 flex-col items-center text-center"
          aria-label={`${EQUIPMENT_SLOT_LABELS[slot]}：${item?.name ?? '空'}`}
        >
          {entry ? (
            <Dnd5eActionIcon
              spec={dnd5eItemActionIcon(entry.item)}
              disabled={entry.identified === false}
              className="h-10 w-10 sm:h-11 sm:w-11"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/10 text-slate-700 sm:h-11 sm:w-11">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <span className="mt-1 block max-w-full truncate text-[8px] font-semibold uppercase tracking-wide text-amber-100/65 sm:text-[9px]">{EQUIPMENT_SLOT_LABELS[slot]}</span>
          <span className="mt-0.5 block max-w-full truncate text-[9px] text-slate-300 sm:text-[10px]">{item?.name ?? '拖入装备'}</span>
        </button>
        {editable && entry && (
          <button
            type="button"
            aria-label={`卸下${item?.name ?? '装备'}`}
            onClick={() => run({ type: 'unequip', characterId: character.id, instanceId: entry.instanceId })}
            disabled={pending || combatSlotLocked}
            className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-void-950 text-slate-500 hover:text-rose-200 disabled:opacity-40 group-hover/slot:flex"
          ><X className="h-3 w-3" /></button>
        )}
        {canDrop && <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded bg-emerald-500/20 py-0.5 text-center text-[8px] font-bold text-emerald-100">松开放入</span>}
      </div>
    )
  }

  return (
    <div className="space-y-4" data-testid="dnd5e-inventory">
      <div className={`grid items-start gap-4 ${compact
        ? 'xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)]'
        : '2xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]'}`}>
      <section className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{compact ? '战斗物品快捷栏' : '物品栏'}</p>
            <p className="mt-1 text-xs text-slate-500">{compact
              ? '点击图标查看；再次点击已选中的可用道具即可选择目标或提交结算。'
              : load
                ? `${inventory.entries.length} 个物品栏位 · ${formatWeight(load.totalWeightLb)} / ${load.carryingCapacityLb} 磅`
                : `${inventory.entries.length} 个物品栏位`}</p>
          </div>
          <span className="rounded-lg border border-white/8 bg-black/20 px-2.5 py-1.5 text-[11px] text-slate-400">全部物品统一浏览</span>
        </div>

        <div className="mt-4 rounded-xl border border-white/8 bg-black/15 p-3" data-testid="inventory-browser-toolbar">
          <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_150px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                aria-label="搜索物品"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索名称、说明或规则效果"
                className="w-full rounded-lg border border-white/10 bg-void-950/70 py-2 pl-9 pr-3 text-xs text-slate-100 outline-none focus:border-amber-300/40"
              />
            </label>
            <select
              aria-label="物品排序"
              value={sort}
              onChange={(event) => setSort(event.target.value as Dnd5eInventorySort)}
              className="rounded-lg border border-white/10 bg-void-950/70 px-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-300/40"
            >
              {INVENTORY_SORTS.map(([value, label]) => <option key={value} value={value}>按{label}排序</option>)}
            </select>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {INVENTORY_CATEGORY_FILTERS.map(([value, label]) => {
              const count = value === 'all'
                ? inventory.entries.length
                : inventory.entries.filter((entry) => entry.item.category === value as Dnd5eInventoryCategory).length
              return <button
                key={value}
                type="button"
                aria-pressed={categoryFilter === value}
                onClick={() => setCategoryFilter(value)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${categoryFilter === value
                  ? 'border-amber-300/35 bg-amber-400/12 text-amber-100'
                  : 'border-white/8 bg-white/[0.025] text-slate-500 hover:text-slate-200'}`}
              >{label} <span className="ml-1 text-[9px] opacity-60">{count}</span></button>
            })}
          </div>
        </div>

        {quickbarSlots && (
          <div
            data-testid="inventory-quickbar-editor"
            className="mt-4 rounded-xl border border-amber-300/15 bg-amber-500/[0.045] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-amber-100">战斗快捷栏</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  先选择下方任意物品，再点击 1–7 号槽位。物品已在快捷栏时会交换槽位；右上角可移出快捷栏。
                </p>
              </div>
              {selected && (
                <span className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[11px] text-amber-100">
                  待放入：{displayItemName(selected)}
                </span>
              )}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {quickbarSlots.map((instanceId, slotIndex) => {
                const entry = instanceId
                  ? inventory.entries.find((candidate) => candidate.instanceId === instanceId)
                  : undefined
                const primaryResource = entry ? Object.values(entry.resources ?? {})[0] : undefined
                return (
                  <div key={`quickbar-slot-${slotIndex}`} className="relative">
                    <button
                      type="button"
                      data-testid={`inventory-quickbar-slot-${slotIndex + 1}`}
                      aria-label={entry
                        ? `快捷栏 ${slotIndex + 1}：${displayItemName(entry)}`
                        : `快捷栏 ${slotIndex + 1}：空`}
                      onClick={() => {
                        if (selected) {
                          onAssignQuickbarSlot?.(selected.instanceId, slotIndex)
                        } else if (entry) {
                          setSelectedId(entry.instanceId)
                          setQuantity(1)
                        }
                      }}
                      onDragOver={(event) => {
                        if (onAssignQuickbarSlot && draggedInstanceId) {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'copy'
                        }
                      }}
                      onDrop={(event) => dropOnQuickbarSlot(event, slotIndex)}
                      className={[
                        'relative flex aspect-square w-full items-center justify-center rounded-xl border p-1 transition',
                        draggedInstanceId && onAssignQuickbarSlot
                          ? 'border-amber-200/60 bg-amber-400/15 ring-1 ring-amber-200/20'
                          : selected
                          ? 'border-amber-300/35 bg-amber-400/10 hover:border-amber-200/70 hover:bg-amber-400/20'
                          : entry
                            ? 'border-white/10 bg-black/20 hover:border-white/25'
                            : 'border-dashed border-white/10 bg-black/10',
                      ].join(' ')}
                    >
                      {entry ? (
                        <Dnd5eActionIcon
                          spec={dnd5eItemActionIcon(entry.item)}
                          disabled={entry.identified === false}
                          badge={primaryResource ? primaryResource.current : entry.quantity > 1 ? entry.quantity : undefined}
                          className="w-full"
                        />
                      ) : (
                        <span className="text-xs font-bold text-slate-700">{slotIndex + 1}</span>
                      )}
                      <span className="absolute left-1 top-0.5 text-[8px] font-black text-amber-100/70">
                        {slotIndex + 1}
                      </span>
                    </button>
                    {entry && onClearQuickbarSlot && (
                      <button
                        type="button"
                        aria-label={`将${displayItemName(entry)}移出快捷栏`}
                        onClick={() => onClearQuickbarSlot(slotIndex)}
                        className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-white/15 bg-void-950 text-slate-400 shadow hover:border-rose-300/40 hover:text-rose-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!compact && <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/8 bg-black/15 p-3">
            {DND5E_EDITABLE_CURRENCIES.map((currency) => (
              <label key={`${currency}:${inventory.currency?.[currency] ?? 0}`} className="space-y-1 text-[10px] text-slate-500">
                <span>{DND5E_EDITABLE_CURRENCY_LABELS[currency]}</span>
                <input
                  type="number"
                  min={0}
                  max={isDm ? undefined : inventory.currency?.[currency] ?? 0}
                  step={1}
                  defaultValue={inventory.currency?.[currency] ?? 0}
                  disabled={!editable || pending || combatManagementLocked}
                  onBlur={(event) => {
                    const current = inventory.currency?.[currency] ?? 0
                    const requested = Math.max(0, Math.floor(Number(event.target.value) || 0))
                    const next = isDm ? requested : Math.min(current, requested)
                    event.target.value = String(next)
                    if (next !== current) run({ type: 'adjust-currency', characterId: character.id, currency, delta: next - current })
                  }}
                  className="w-full rounded-lg border border-white/10 bg-void-900/70 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-arcane-500 disabled:opacity-50"
                />
              </label>
            ))}
          </div>
          {load && <div className={`rounded-xl border p-3 ${load.status === 'normal' ? 'border-emerald-300/10 bg-emerald-500/[0.035]' : 'border-amber-300/15 bg-amber-500/[0.05]'}`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200"><Weight className="h-4 w-4" />负重</div>
            <p className="mt-1.5 text-xs text-slate-400">物品 {formatWeight(load.itemWeightLb)} 磅 · 钱币 {formatWeight(load.currencyWeightLb)} 磅 · 总计 {formatWeight(load.totalWeightLb)} 磅</p>
            <p className="mt-1 text-[11px] text-slate-500">可选负重阈值 {load.encumberedThresholdLb} / {load.heavilyEncumberedThresholdLb} 磅 · 携带上限 {load.carryingCapacityLb} 磅</p>
            {load.status !== 'normal' && <p className="mt-1 text-[11px] text-amber-200">{load.status === 'encumbered' ? '负重：速度 -10 尺。' : load.status === 'heavily-encumbered' ? '重度负重：速度 -20 尺，并承受相应检定与豁免劣势。' : '超过携带上限，通常无法继续携带或移动。'}</p>}
          </div>}
        </div>}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(500px,0.95fr)_minmax(0,1.3fr)]">
          <aside className="overflow-hidden rounded-2xl border border-amber-300/12 bg-[radial-gradient(circle_at_50%_42%,rgba(124,58,237,0.12),transparent_48%),linear-gradient(to_bottom,rgba(245,158,11,0.045),rgba(0,0,0,0.22))] p-3" data-testid="inventory-equipment-rail">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-[88px_minmax(250px,1fr)_88px] sm:items-stretch">
              <div className="order-2 flex flex-col gap-2 sm:order-none sm:col-start-1 sm:row-start-1">
                {LEFT_EQUIPMENT_SLOTS.map(renderEquipmentSlot)}
              </div>

              <div className="relative order-1 col-span-2 min-h-[330px] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-violet-700/20 via-void-900/45 to-void-950 shadow-[inset_0_0_50px_rgba(0,0,0,0.48),0_14px_34px_rgba(0,0,0,0.28)] sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:min-h-[420px]">
                {character.portrait ? (
                  <>
                    <img src={character.portrait} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-15 blur-xl" />
                    <img src={character.portrait} alt={`${character.name}的人物立绘`} className="relative z-[1] h-full w-full object-cover object-top drop-shadow-[0_18px_22px_rgba(0,0,0,0.62)]" />
                  </>
                ) : (
                  <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-3">
                    <span className="text-8xl drop-shadow-lg">{character.avatar}</span>
                    <span className="text-sm font-semibold text-slate-300">{character.name}</span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black via-black/68 to-transparent px-4 pb-3 pt-16">
                  <p className="truncate text-base font-bold text-white drop-shadow">{character.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-200">{character.charClass} · Lv.{character.level} · HP {character.currentHp}/{character.maxHp}</p>
                </div>
              </div>

              <div className="order-3 flex flex-col gap-2 sm:col-start-3 sm:row-start-1">
                {RIGHT_EQUIPMENT_SLOTS.map(renderEquipmentSlot)}
              </div>
            </div>
            {combatManagementLocked && <p className="mt-2 text-center text-[10px] leading-4 text-amber-300/65">战斗中可切换主手／副手物品；护甲与其他穿戴槽保持锁定。</p>}
            {!combatManagementLocked && linkedEquipmentFeature && (
              <p className="mt-2 text-center text-[10px] leading-4 text-cyan-200/65">武器联结仍可在右侧物品详情中管理。</p>
            )}
          </aside>

          <div className="min-w-0">
            <div className={`grid gap-2 ${compact
              ? 'grid-cols-[repeat(auto-fill,minmax(76px,1fr))]'
              : 'grid-cols-[repeat(auto-fill,minmax(88px,1fr))]'}`}>
              {entries.map((entry) => (
                <InventoryTile
                  key={entry.instanceId}
                  entry={entry}
                  selected={entry.instanceId === selectedId}
                  compact={compact}
                  combatQuickUse={compact && !!onUseItem}
                  draggable={editable && !pending}
                  dragging={entry.instanceId === draggedInstanceId}
                  onDragStart={(event) => beginInventoryDrag(event, entry)}
                  onDragEnd={() => setDraggedInstanceId(null)}
                  onSelect={() => {
                    setSelectedId(entry.instanceId === selectedId ? null : entry.instanceId)
                    setQuantity(1)
                  }}
                  onActivate={() => activateEntry(entry)}
                />
              ))}
            </div>
            {entries.length === 0 && (
              <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
                <PackageOpen className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-3 text-sm text-slate-500">没有符合筛选条件的物品</p>
                <p className="mt-1 text-xs text-slate-600">清除搜索或切换分类；DM 也可以从房间玩家页分发 SRD 物品。</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {selected && (
        <section className="glass min-w-0 max-h-[76vh] overflow-x-hidden overflow-y-auto rounded-2xl p-4 xl:sticky xl:top-3" data-testid="inventory-item-actions">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">{displayItemName(selected)}</p>
              <p className="mt-1 text-xs text-slate-500">
                持有 {selected.quantity}{inventoryResourceSummary(selected) ? ` · ${inventoryResourceSummary(selected)}` : ''} · {selected.identified === false ? '未鉴定魔法物品' : selected.item.englishName ?? CATEGORY_LABELS[selected.item.category]}
              </p>
            </div>
            {editable && <div className="flex flex-wrap gap-2">
              {selected.item.equipment && !selected.equippedSlot && selected.identified !== false && (
                <ActionButton
                  icon={Shield}
                  disabled={pending || (combatManagementLocked && !equipmentCanBeHeldInHand(selected.item.equipment))}
                  onClick={() => run({ type: 'equip', characterId: character.id, instanceId: selected.instanceId })}
                >装备</ActionButton>
              )}
              {selected.equippedSlot && (
                <ActionButton
                  icon={Shield}
                  disabled={pending || (combatManagementLocked && !isHandEquipmentSlot(selected.equippedSlot))}
                  onClick={() => run({ type: 'unequip', characterId: character.id, instanceId: selected.instanceId })}
                >卸下</ActionButton>
              )}
              {linkedEquipmentFeature && selected.item.equipment?.dnd5e?.kind === 'weapon' && (
                <ActionButton
                  icon={Cable}
                  disabled={
                    pending || combatManagementLocked ||
                    (!linkedEquipmentIds.includes(selected.item.equipment.id) && linkedEquipmentIds.length >= linkedEquipmentLimit)
                  }
                  onClick={() => void toggleLinkedEquipment(selected.item.equipment!.id, selected.item.equipment!.name)}
                >
                  {linkedEquipmentIds.includes(selected.item.equipment.id) ? '解除联结' : '武器联结'}
                </ActionButton>
              )}
              {selected.item.magicItem?.attunement === 'required' && !selected.attuned && !selected.attunementPending && (
                <ActionButton
                  icon={Sparkles}
                  disabled={
                    pending || combatManagementLocked || attunementDecision === 'unmet' ||
                    (!isDm && attunementDecision === 'dm-confirmation-required')
                  }
                  onClick={async () => {
                    const requirement = selected.item.magicItem?.attunementRequirement
                    const dmPrerequisiteConfirmed = attunementDecision !== 'dm-confirmation-required' ||
                      (isDm && await showAppConfirm({
                        title: '确认同调条件',
                        message: `确认当前环境满足同调条件：${requirement}？\n该确认只允许由 DM 权威端完成。`,
                        confirmLabel: '确认满足',
                      }))
                    if (dmPrerequisiteConfirmed) run({
                      type: 'prepare-attunement',
                      characterId: character.id,
                      instanceId: selected.instanceId,
                      dmPrerequisiteConfirmed,
                    })
                  }}
                >准备同调</ActionButton>
              )}
              {selected.attunementPending && (
                <ActionButton icon={Sparkles} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'cancel-attunement', characterId: character.id, instanceId: selected.instanceId })}>取消准备</ActionButton>
              )}
              {selected.attuned && (
                <ActionButton icon={Sparkles} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'end-attunement', characterId: character.id, instanceId: selected.instanceId })}>结束同调</ActionButton>
              )}
              {selected.item.use && dnd5eInventoryEntryIsActive(selected) && (
                <ActionButton icon={HandHelping} disabled={pending} onClick={useSelected}>使用</ActionButton>
              )}
              {selected.item.magicItem && selected.identified === false && canIdentify && (
                <ActionButton icon={Sparkles} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'identify', characterId: character.id, instanceId: selected.instanceId })}>完成鉴定</ActionButton>
              )}
            </div>}
          </div>

          {selected.item.magicItem?.attunement === 'required' && attunementDecision === 'unmet' && (
            <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              当前角色不满足同调条件：{selected.item.magicItem.attunementRequirement}。
            </p>
          )}
          {selected.item.magicItem?.attunement === 'required' && attunementDecision === 'dm-confirmation-required' && !isDm && (
            <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              该同调条件需要 DM 核对当前环境：{selected.item.magicItem.attunementRequirement}。请由 DM 打开此角色卡完成确认。
            </p>
          )}
          {selected.identified !== false && selected.item.equipment && (
            <EquipmentProficiencyNotice
              character={character}
              item={selected.item.equipment}
              spellcastingPrerequisitesEnabled={spellcastingPrerequisitesEnabled}
            />
          )}
          {selected.identified !== false && (selected.item.equipment?.spellcastingFocusClassIds?.length ?? 0) > 0 && (
            <p className="mt-3 rounded-xl border border-violet-400/20 bg-violet-500/[0.07] px-3 py-2 text-xs text-violet-100">
              施法法器：装备在主手或副手时，可供{selected.item.equipment?.spellcastingFocusClassIds?.map(spellcastingFocusClassLabel).join('、') ?? ''}替代未标价且不会被消耗的材料（M）成分；标价或会被消耗的材料仍须实际提供。
            </p>
          )}

          {selected.identified === false ? (
            <div className="mt-4 rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.055] p-4 text-sm text-fuchsia-100/85">
              该魔法物品尚未鉴定。名称、稀有度、规则正文与 Headless 效果由 DM 权威端隐藏；完成鉴定后才可使用、装备或同调。
            </div>
          ) : <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-violet-300/15 bg-violet-500/[0.055] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-200/70">完整规则效果</p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-200">{selected.item.rulesText}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/15 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">物品简介</p>
              <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-300">{selected.item.description}</p>
            </div>
            {selected.item.use?.effect.kind === 'dm-adjudication' && (
              <div className="rounded-xl border border-amber-300/12 bg-amber-500/[0.045] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200/70">平台结算边界</p>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-amber-50/80">{selected.item.use.effect.adjudication}</p>
              </div>
            )}
            {selected.item.use?.effect.kind === 'spell-cast' && (() => {
              const effect = selected.item.use.effect
              const spell = getDnd5eSrdCombatSpell(effect.spellId)
              return <div className="rounded-xl border border-cyan-300/12 bg-cyan-500/[0.045] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Headless 物品施法</p>
                <p className="mt-1.5 text-xs leading-5 text-cyan-50/85">
                  {spell?.name ?? effect.spellId} · {effect.castAtLevel} 环
                  {effect.spellAttackBonus != null ? ` · 固定命中 ${effect.spellAttackBonus >= 0 ? '+' : ''}${effect.spellAttackBonus}` : ''}
                  {effect.spellSaveDc != null ? ` · 固定 DC ${effect.spellSaveDc}` : ''}
                  {effect.targeting === 'self-only' ? ' · 仅限自身' : ''}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">从地图操作栏使用；目标、距离、视线、豁免、伤害、专注与物品资源由 Host 一次结算。</p>
              </div>
            })()}
            {selected.item.useActions?.length ? (
              <div className="rounded-xl border border-cyan-300/12 bg-cyan-500/[0.045] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-200/70">Headless 物品能力</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {selected.item.useActions.map((use) => {
                    const spell = use.effect.kind === 'spell-cast' ? getDnd5eSrdCombatSpell(use.effect.spellId) : undefined
                    const resource = use.resourceCost ? selected.resources?.[use.resourceCost.resourceId] : undefined
                    const disabled = pending || !onUseItem || (use.resourceCost != null && (resource?.current ?? 0) < use.resourceCost.amount)
                    return <button
                      key={use.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onUseItem?.(selected.instanceId, use.id)}
                      className="rounded-lg border border-cyan-300/15 bg-cyan-400/5 px-3 py-2 text-left text-xs text-cyan-50 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span className="block font-semibold">{use.label}</span>
                      <span className="mt-1 block text-[10px] text-slate-400">
                        {spell ? `${spell.name} · ${use.effect.kind === 'spell-cast' ? use.effect.castAtLevel : ''} 环` : '物品能力'}
                        {use.resourceCost ? ` · 消耗 ${use.resourceCost.amount} ${resource?.label ?? '充能'}` : ''}
                      </span>
                    </button>
                  })}
                </div>
              </div>
            ) : null}
            {selected.item.magicItem?.attunement === 'required' && (
              <div className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.055] p-3 text-xs text-fuchsia-100/85">
                <span className="font-semibold">同调状态：</span>
                {selected.attuned ? '已同调，规则效果已启用。' : selected.attunementPending ? '等待下一次短休完成。' : '未同调，需同调效果不会进入 Headless。'}
                {selected.item.magicItem.attunementRequirement ? ` 条件：${selected.item.magicItem.attunementRequirement}。` : ''}
              </div>
            )}
          </div>}

          {editable && <div className="mt-4 min-w-0 space-y-3 rounded-xl border border-white/8 bg-black/10 p-3">
            <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-3">
              <label className="min-w-0 space-y-1 text-xs text-slate-500">
                <span>数量</span>
                <input
                  type="number"
                  min={1}
                  max={selected.quantity}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.min(selected.quantity, Math.max(1, Math.floor(Number(event.target.value) || 1))))}
                  className="w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-arcane-500"
                />
              </label>
              <label className="min-w-0 space-y-1 text-xs text-slate-500">
                <span>存放于</span>
                <span className="relative block min-w-0">
                  <select
                    aria-label="物品存放容器"
                    value={selected.containerInstanceId ?? ''}
                    onChange={(event) => run({ type: 'set-container', characterId: character.id, instanceId: selected.instanceId, containerInstanceId: event.target.value || undefined })}
                    disabled={pending || combatManagementLocked}
                    className="w-full min-w-0 appearance-none truncate rounded-lg border border-white/10 bg-void-900/90 py-2 pl-3 pr-9 text-sm text-slate-100 outline-none focus:border-arcane-500 disabled:opacity-50"
                  >
                    <option value="">随身携带</option>
                    {containers.map((container) => <option key={container.instanceId} value={container.instanceId}>{displayItemName(container)}（{container.item.containerCapacityWeightLb} 磅）</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>
            </div>
            <label className="block min-w-0 space-y-1 text-xs text-slate-500">
              <span>转交给其他角色</span>
              <span className="relative block min-w-0">
                <select
                  aria-label="转交目标角色"
                  value={transferTargetId}
                  onChange={(event) => setTransferTargetId(event.target.value)}
                  className="w-full min-w-0 appearance-none truncate rounded-lg border border-white/10 bg-void-900/90 py-2 pl-3 pr-9 text-sm text-slate-100 outline-none focus:border-arcane-500"
                >
                  <option value="">选择同房间角色…</option>
                  {transferTargets.map((target) => <option key={target.id} value={target.id}>{target.name}（{target.player || '未填写玩家'}）</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </span>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton
                icon={HandHelping}
                disabled={pending || combatManagementLocked || !transferTargetId}
                onClick={() => run({ type: 'transfer', characterId: character.id, targetCharacterId: transferTargetId, instanceId: selected.instanceId, quantity })}
              >
                转交
              </ActionButton>
              <ActionButton
                icon={Trash2}
                tone="danger"
                disabled={pending || combatManagementLocked}
                onClick={async () => {
                  if (await showAppConfirm({
                    title: '丢弃物品',
                    message: `确定丢弃 ${displayItemName(selected)} ×${quantity} 吗？`,
                    confirmLabel: '确认丢弃',
                    tone: 'danger',
                  })) {
                    run({ type: 'discard', characterId: character.id, instanceId: selected.instanceId, quantity })
                  }
                }}
              >
                丢弃
              </ActionButton>
            </div>
          </div>}
          {combatManagementLocked && (
            <p className="mt-3 text-[11px] text-amber-300/80">战斗中可切换主手／副手物品并使用已接入行动经济的物品；护甲、其他穿戴槽、丢弃和转交仍保持锁定。</p>
          )}
        </section>
      )}

      {!selected && (
        <aside className="glass hidden min-h-64 rounded-2xl border border-dashed border-white/10 p-6 text-center text-slate-600 xl:flex xl:flex-col xl:items-center xl:justify-center">
          <PackageOpen className="h-9 w-9" />
          <p className="mt-3 text-sm font-semibold text-slate-400">选择一个物品查看详情</p>
          <p className="mt-1 max-w-56 text-xs leading-5">这里会显示规则正文、重量、同调、装备与使用操作。</p>
        </aside>
      )}
      </div>

      {notice && (
        <p className={`rounded-xl border px-3 py-2 text-xs ${notice.includes('不能') || notice.includes('未能')
          ? 'border-red-400/20 bg-red-500/10 text-red-200'
          : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'}`}
        >
          {notice}
        </p>
      )}
    </div>
  )
}

function InventoryTile({
  entry,
  selected,
  compact,
  combatQuickUse,
  draggable,
  dragging,
  onDragStart,
  onDragEnd,
  onSelect,
  onActivate,
}: {
  entry: Dnd5eInventoryEntry
  selected: boolean
  compact?: boolean
  combatQuickUse?: boolean
  draggable?: boolean
  dragging?: boolean
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  onSelect: () => void
  onActivate?: () => void
}) {
  const Icon = ICONS[entry.item.icon] ?? PackageOpen
  const usable = !!entry.item.use && dnd5eInventoryEntryIsActive(entry)
  const primaryResource = Object.values(entry.resources ?? {})[0]
  const actionIcon = dnd5eItemActionIcon(entry.item)
  return (
    <button
      type="button"
      draggable={draggable}
      aria-grabbed={dragging}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => combatQuickUse && selected && usable ? onActivate?.() : onSelect()}
      title={entry.identified === false ? '未鉴定魔法物品' : `${entry.item.name}\n${entry.item.rulesText}${combatQuickUse && usable ? '\n再次点击使用' : ''}`}
      className={`group relative rounded-2xl border p-2 text-left transition ${compact ? 'min-h-24' : 'min-h-28'} ${dragging ? 'scale-95 opacity-45' : ''} ${selected
        ? 'border-arcane-400/60 bg-arcane-500/15 shadow-[0_0_22px_rgba(124,92,255,0.16)]'
        : 'border-white/8 bg-gradient-to-b from-white/[0.045] to-black/20 hover:-translate-y-0.5 hover:border-white/20'}`}
    >
      <div className="relative w-full">
        <Dnd5eActionIcon
          spec={actionIcon}
          active={selected}
          disabled={!dnd5eInventoryEntryIsActive(entry) || (primaryResource != null && primaryResource.current <= 0)}
          badge={primaryResource ? primaryResource.current : entry.quantity > 1 ? entry.quantity : undefined}
          className={`mx-auto ${compact ? 'h-14 w-14' : 'h-16 w-16'}`}
        />
        <span className="absolute bottom-0 right-1/2 flex h-5 w-5 translate-x-8 items-center justify-center rounded-full border border-white/20 bg-void-950/90 text-slate-200 shadow">
          <Icon className="h-3 w-3" />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-center text-[11px] font-semibold leading-snug text-slate-100">{displayItemName(entry)}</p>
      {!compact && <p className="mt-1 text-[10px] text-slate-600">{CATEGORY_LABELS[entry.item.category]}</p>}
      {entry.equippedSlot && (
        <span className="absolute bottom-2 right-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-200">已装备</span>
      )}
      {entry.attuned && (
        <span className="absolute bottom-2 left-2 rounded-md bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] text-fuchsia-100">已同调</span>
      )}
      {entry.attunementPending && !entry.attuned && (
        <span className="absolute bottom-2 left-2 rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[9px] text-sky-100">短休同调</span>
      )}
      {entry.identified === false && (
        <span className="absolute bottom-2 left-2 rounded-md bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] text-fuchsia-100">未鉴定</span>
      )}
      {entry.item.magicItem && !entry.equippedSlot && (
        <span className={`absolute bottom-2 right-2 rounded-md px-1.5 py-0.5 text-[9px] ${entry.item.magicItem.automation === 'headless' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-violet-500/15 text-violet-200'}`}>
          {entry.item.magicItem.automation === 'headless' ? 'Headless' : 'DM 裁定'}
        </span>
      )}
      <ItemTooltip entry={entry} />
    </button>
  )
}

function ItemTooltip({ entry }: { entry: Dnd5eInventoryEntry }) {
  const item = entry.item
  if (entry.identified === false) {
    return (
      <span className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-0 z-[100] w-72 translate-y-1 rounded-xl border border-fuchsia-300/15 bg-void-950/95 p-4 text-left opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
        <span className="block text-sm font-semibold text-slate-100">未鉴定魔法物品</span>
        <span className="mt-2 block text-xs leading-relaxed text-slate-300">需由 DM 权威端完成鉴定后，才公开物品身份和规则效果。</span>
      </span>
    )
  }
  return (
    <span className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-0 z-[100] w-80 translate-y-1 rounded-xl border border-white/15 bg-void-950/95 p-4 text-left opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-slate-100">{item.name}</span>
          {item.englishName && <span className="mt-0.5 block text-[11px] text-slate-500">{item.englishName}</span>}
        </span>
        <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-400">{CATEGORY_LABELS[item.category]}</span>
      </span>
      <span className="mt-3 block text-xs leading-relaxed text-slate-300">{item.rulesText}</span>
      <span className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
        {item.magicItem && <span>{DND5E_MAGIC_ITEM_RARITY_LABELS[item.magicItem.rarity]} · {DND5E_MAGIC_ITEM_KIND_LABELS[item.magicItem.kind]}</span>}
        {item.magicItem?.attunement === 'required' && <span>需要同调{item.magicItem.attunementRequirement ? `（${item.magicItem.attunementRequirement}）` : ''}</span>}
        {item.magicItem && <span>{item.magicItem.automation === 'headless' ? 'Headless 已接入' : 'DM 裁定'}</span>}
        {item.weightLb != null && <span>{item.weightLb} 磅</span>}
        {item.cost && <span>{item.cost.amount} {item.cost.currency}</span>}
        {item.use && <span>{item.use.economy === 'action' ? '动作' : item.use.economy === 'bonusAction' ? '附赠动作' : '无需行动'}</span>}
        {Object.values(entry.resources ?? {}).map((resource) => <span key={resource.id}>{resource.label} {resource.current}/{resource.maximum}</span>)}
      </span>
      <span className="mt-3 block border-t border-white/8 pt-2 text-[10px] text-slate-600">{item.source.book} · {item.source.license}</span>
    </span>
  )
}

function inventoryResourceSummary(entry: Dnd5eInventoryEntry): string {
  return Object.values(entry.resources ?? {}).map((resource) => `${resource.label} ${resource.current}/${resource.maximum}`).join(' · ')
}

function displayItemName(entry: Dnd5eInventoryEntry): string {
  return entry.item.magicItem && entry.identified === false ? '未鉴定魔法物品' : entry.item.name
}

function ActionButton({ icon: Icon, children, onClick, disabled, tone = 'normal' }: { icon: ComponentType<{ className?: string }>; children: string; onClick: () => void; disabled?: boolean; tone?: 'normal' | 'danger' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${tone === 'danger'
        ? 'border-red-400/15 bg-red-500/10 text-red-200 hover:bg-red-500/20'
        : 'border-white/10 bg-white/5 text-slate-200 hover:border-arcane-400/30 hover:bg-arcane-500/10'}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
}

function formatWeight(weight: number): string {
  return Number.isInteger(weight) ? String(weight) : weight.toFixed(1)
}
