import type { DragEvent } from 'react'
import Dnd5eInventoryGlyph from '../dnd5e/Dnd5eInventoryGlyph'
import Dnd5eActionIcon from '../map/Dnd5eActionIcon'
import { dnd5eItemActionIcon } from '../../lib/dnd5eActionIcons'
import { dnd5eInventoryEntryIsActive } from '../../rulesets/dnd5e/items'
import {
  DND5E_MAGIC_ITEM_KIND_LABELS,
  DND5E_MAGIC_ITEM_RARITY_LABELS,
} from '../../rulesets/dnd5e/magicItems'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import {
  DND5E_INVENTORY_CATEGORY_LABELS,
  displayDnd5eInventoryItemName,
} from './dnd5eInventoryTileModel'

export interface Dnd5eInventoryTileProps {
  entry: Dnd5eInventoryEntry
  selected?: boolean
  compact?: boolean
  combatQuickUse?: boolean
  draggable?: boolean
  dragging?: boolean
  onDragStart?: (event: DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
  onSelect?: () => void
  onActivate?: () => void
}

export default function Dnd5eInventoryTile({
  entry,
  selected = false,
  compact = false,
  combatQuickUse = false,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
  onSelect,
  onActivate,
}: Dnd5eInventoryTileProps) {
  const usable = !!entry.item.use && dnd5eInventoryEntryIsActive(entry)
  const primaryResource = Object.values(entry.resources ?? {})[0]
  const actionIcon = dnd5eItemActionIcon(entry.item)
  return (
    <button
      type="button"
      data-testid={`inventory-tile-${entry.instanceId}`}
      draggable={draggable}
      aria-grabbed={dragging}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => combatQuickUse && selected && usable ? onActivate?.() : onSelect?.()}
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
        <span className="absolute bottom-0 right-1/2 flex h-6 w-6 translate-x-8 items-center justify-center rounded-full border border-white/25 bg-void-950/95 shadow">
          <Dnd5eInventoryGlyph icon={actionIcon.inventoryIconId ?? entry.item.icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-center text-[11px] font-semibold leading-snug text-slate-100">{displayDnd5eInventoryItemName(entry)}</p>
      {!compact && <p className="mt-1 text-[10px] text-slate-600">{DND5E_INVENTORY_CATEGORY_LABELS[entry.item.category]}</p>}
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
        <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] text-slate-400">{DND5E_INVENTORY_CATEGORY_LABELS[item.category]}</span>
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
