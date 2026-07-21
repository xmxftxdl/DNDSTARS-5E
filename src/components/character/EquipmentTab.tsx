import { useMemo, useState, type ComponentType } from 'react'
import {
  Backpack,
  BedDouble,
  Beef,
  Cable,
  CircleDot,
  Droplets,
  Flame,
  FlaskConical,
  Gem,
  HandHelping,
  PackageOpen,
  Shield,
  ShieldPlus,
  Skull,
  Sparkles,
  Sword,
  TentTree,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import { EQUIPMENT_SLOT_LABELS } from '../../lib/equipmentDefaults'
import { formatEquipmentStatLine } from '../../lib/combatStats'
import { submitDnd5eInventoryMutation } from '../../lib/inventoryAuthority'
import { normalizeDnd5eInventory } from '../../rulesets/dnd5e/items'
import {
  DND5E_MAGIC_ITEM_KIND_LABELS,
  DND5E_MAGIC_ITEM_RARITY_LABELS,
} from '../../rulesets/dnd5e/magicItems'
import type { Dnd5eInventoryEntry, Dnd5eInventoryIconId } from '../../types/inventory'
import type { EquipmentSlot } from '../../types/equipment'

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
  ring: Gem,
  necklace: Gem,
}

const DND5E_EQUIPMENT_SLOTS: EquipmentSlot[] = ['mainWeapon', 'offHand', 'armor']

const CATEGORY_LABELS = {
  equipment: '装备',
  'magic-item': '魔法物品',
  'adventuring-gear': '冒险用品',
  consumable: '消耗品',
  tool: '工具',
  container: '容器',
} as const

export interface EquipmentTabProps {
  charId: string
  editable?: boolean
  compact?: boolean
  pending?: boolean
  /** 战斗界面将“使用”接入当前战斗的 DM/Headless 行动事务。 */
  onUseItem?: (instanceId: string) => boolean | void
}

export default function EquipmentTab({
  charId,
  editable = true,
  compact = false,
  pending = false,
  onUseItem,
}: EquipmentTabProps) {
  const character = useCharacterStore((state) => state.characters.find((candidate) => candidate.id === charId))
  const characters = useCharacterStore((state) => state.characters)
  const [group, setGroup] = useState<'equipment' | 'items'>('equipment')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [transferTargetId, setTransferTargetId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notice, setNotice] = useState('')
  const combatManagementLocked = !!onUseItem

  const inventory = useMemo(() => character ? normalizeDnd5eInventory(character) : null, [character])
  if (!character || !inventory) return null

  const entries = inventory.entries.filter((entry) => group === 'equipment'
    ? entry.item.category === 'equipment'
    : entry.item.category !== 'equipment')
  const selected = inventory.entries.find((entry) => entry.instanceId === selectedId)
  const transferTargets = characters.filter((candidate) =>
    candidate.id !== character.id &&
    candidate.visibleToPlayers !== false &&
    (!character.roomId || !candidate.roomId || candidate.roomId === character.roomId),
  )
  const totalWeight = inventory.entries.reduce((sum, entry) => sum + (entry.item.weightLb ?? 0) * entry.quantity, 0)

  const run = (mutation: Parameters<typeof submitDnd5eInventoryMutation>[0]) => {
    const result = submitDnd5eInventoryMutation(mutation)
    setNotice(result.message)
    if (result.status !== 'rejected') {
      setQuantity(1)
      if (mutation.type === 'discard' || mutation.type === 'transfer' || mutation.type === 'use') setSelectedId(null)
    }
  }

  const useSelected = () => {
    if (!selected) return
    if (onUseItem) {
      const submitted = onUseItem(selected.instanceId)
      setNotice(submitted === false ? '当前战斗中不能使用该物品。' : '已提交给 DM/Headless 进行战斗结算。')
      return
    }
    run({ type: 'use', characterId: character.id, instanceId: selected.instanceId })
  }

  return (
    <div className="space-y-4" data-testid="dnd5e-inventory">
      <section className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">物品栏</p>
            <p className="mt-1 text-xs text-slate-500">{inventory.entries.length} 个物品栏位 · 约 {formatWeight(totalWeight)} 磅</p>
          </div>
          <div className="flex rounded-xl border border-white/8 bg-black/20 p-1">
            <GroupButton active={group === 'equipment'} onClick={() => { setGroup('equipment'); setSelectedId(null) }} icon={Shield}>装备</GroupButton>
            <GroupButton active={group === 'items'} onClick={() => { setGroup('items'); setSelectedId(null) }} icon={Backpack}>道具</GroupButton>
          </div>
        </div>

        {group === 'equipment' && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {DND5E_EQUIPMENT_SLOTS.map((slot) => {
              const item = character.equipment?.[slot]
              const entry = inventory.entries.find((candidate) => candidate.equippedSlot === slot)
              const Icon = SLOT_ICONS[slot] ?? Shield
              return (
                <div key={slot} className="rounded-xl border border-white/8 bg-void-900/35 p-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <Icon className="h-4 w-4 text-amber-300/80" />
                    {EQUIPMENT_SLOT_LABELS[slot]}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{item?.name ?? '空'}</p>
                  {item && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{formatEquipmentStatLine(item)}</p>}
                  {editable && entry && (
                    <button
                      type="button"
                      onClick={() => run({ type: 'unequip', characterId: character.id, instanceId: entry.instanceId })}
                      disabled={pending || combatManagementLocked}
                      className="mt-2 rounded-lg border border-white/8 px-2 py-1 text-[11px] text-slate-400 hover:bg-white/5 hover:text-slate-200 disabled:opacity-40"
                    >
                      卸下
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-3 sm:grid-cols-5 lg:grid-cols-7' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6'}`}>
          {entries.map((entry) => (
            <InventoryTile
              key={entry.instanceId}
              entry={entry}
              selected={entry.instanceId === selectedId}
              onSelect={() => {
                setSelectedId(entry.instanceId === selectedId ? null : entry.instanceId)
                setQuantity(1)
              }}
            />
          ))}
        </div>
        {entries.length === 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-white/10 px-4 py-10 text-center">
            <PackageOpen className="mx-auto h-8 w-8 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">这个分类目前是空的</p>
            <p className="mt-1 text-xs text-slate-600">DM 可以从房间玩家页分发 SRD 物品。</p>
          </div>
        )}
      </section>

      {selected && (
        <section className="glass rounded-2xl p-4" data-testid="inventory-item-actions">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-100">{selected.item.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                持有 {selected.quantity}{inventoryResourceSummary(selected) ? ` · ${inventoryResourceSummary(selected)}` : ''} · {selected.item.englishName ?? CATEGORY_LABELS[selected.item.category]}
              </p>
            </div>
            {editable && <div className="flex flex-wrap gap-2">
              {selected.item.equipment && !selected.equippedSlot && (
                <ActionButton icon={Shield} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'equip', characterId: character.id, instanceId: selected.instanceId })}>装备</ActionButton>
              )}
              {selected.equippedSlot && (
                <ActionButton icon={Shield} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'unequip', characterId: character.id, instanceId: selected.instanceId })}>卸下</ActionButton>
              )}
              {selected.item.magicItem?.attunement === 'required' && !selected.attuned && !selected.attunementPending && (
                <ActionButton
                  icon={Sparkles}
                  disabled={pending || combatManagementLocked}
                  onClick={() => {
                    const requirement = selected.item.magicItem?.attunementRequirement
                    const prerequisiteConfirmed = !requirement || window.confirm(`确认角色满足同调条件：${requirement}？\n确认后将在下一次短休完成同调。`)
                    if (prerequisiteConfirmed) run({ type: 'prepare-attunement', characterId: character.id, instanceId: selected.instanceId, prerequisiteConfirmed })
                  }}
                >准备同调</ActionButton>
              )}
              {selected.attunementPending && (
                <ActionButton icon={Sparkles} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'cancel-attunement', characterId: character.id, instanceId: selected.instanceId })}>取消准备</ActionButton>
              )}
              {selected.attuned && (
                <ActionButton icon={Sparkles} disabled={pending || combatManagementLocked} onClick={() => run({ type: 'end-attunement', characterId: character.id, instanceId: selected.instanceId })}>结束同调</ActionButton>
              )}
              {selected.item.use && (
                <ActionButton icon={HandHelping} disabled={pending} onClick={useSelected}>使用</ActionButton>
              )}
            </div>}
          </div>

          <div className="mt-4 space-y-3">
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
            {selected.item.magicItem?.attunement === 'required' && (
              <div className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-500/[0.055] p-3 text-xs text-fuchsia-100/85">
                <span className="font-semibold">同调状态：</span>
                {selected.attuned ? '已同调，规则效果已启用。' : selected.attunementPending ? '等待下一次短休完成。' : '未同调，需同调效果不会进入 Headless。'}
                {selected.item.magicItem.attunementRequirement ? ` 条件：${selected.item.magicItem.attunementRequirement}。` : ''}
              </div>
            )}
          </div>

          {editable && <div className="mt-4 grid gap-3 lg:grid-cols-[110px_minmax(0,1fr)_auto]">
            <label className="space-y-1 text-xs text-slate-500">
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
            <label className="space-y-1 text-xs text-slate-500">
              <span>转交给</span>
              <select
                value={transferTargetId}
                onChange={(event) => setTransferTargetId(event.target.value)}
                className="w-full rounded-lg border border-white/10 bg-void-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-arcane-500"
              >
                <option value="">选择同房间角色…</option>
                {transferTargets.map((target) => <option key={target.id} value={target.id}>{target.name}（{target.player || '未填写玩家'}）</option>)}
              </select>
            </label>
            <div className="flex items-end gap-2">
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
                onClick={() => {
                  if (window.confirm(`确定丢弃 ${selected.item.name} ×${quantity} 吗？`)) {
                    run({ type: 'discard', characterId: character.id, instanceId: selected.instanceId, quantity })
                  }
                }}
              >
                丢弃
              </ActionButton>
            </div>
          </div>}
          {combatManagementLocked && (
            <p className="mt-3 text-[11px] text-amber-300/80">战斗中仅开放已接入行动经济的“使用物品”；换装、丢弃和转交需在角色页处理，直至物品交互事务接入 Headless。</p>
          )}
        </section>
      )}

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

function InventoryTile({ entry, selected, onSelect }: { entry: Dnd5eInventoryEntry; selected: boolean; onSelect: () => void }) {
  const Icon = ICONS[entry.item.icon] ?? PackageOpen
  const usable = !!entry.item.use
  const primaryResource = Object.values(entry.resources ?? {})[0]
  return (
    <button
      type="button"
      onClick={onSelect}
      title={`${entry.item.name}\n${entry.item.rulesText}`}
      className={`group relative min-h-28 rounded-2xl border p-3 text-left transition ${selected
        ? 'border-arcane-400/60 bg-arcane-500/15 shadow-[0_0_22px_rgba(124,92,255,0.16)]'
        : 'border-white/8 bg-gradient-to-b from-white/[0.045] to-black/20 hover:-translate-y-0.5 hover:border-white/20'}`}
    >
      <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${usable
        ? 'border-emerald-300/20 bg-emerald-500/10 text-emerald-200'
        : 'border-amber-300/15 bg-amber-500/10 text-amber-200'}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-semibold leading-snug text-slate-100">{entry.item.name}</p>
      <p className="mt-1 text-[10px] text-slate-600">{CATEGORY_LABELS[entry.item.category]}</p>
      {entry.quantity > 1 && (
        <span className={`absolute right-2 ${primaryResource ? 'top-8' : 'top-2'} min-w-6 rounded-full border border-white/10 bg-void-950/90 px-1.5 py-0.5 text-center text-[10px] font-bold text-slate-200`}>×{entry.quantity}</span>
      )}
      {primaryResource && (
        <span className={`absolute right-2 top-2 min-w-6 rounded-full border px-1.5 py-0.5 text-center text-[10px] font-bold ${primaryResource.current > 0 ? 'border-emerald-300/15 bg-emerald-500/15 text-emerald-100' : 'border-slate-400/15 bg-slate-500/10 text-slate-400'}`}>{primaryResource.current}/{primaryResource.maximum}</span>
      )}
      {entry.equippedSlot && (
        <span className="absolute bottom-2 right-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-200">已装备</span>
      )}
      {entry.attuned && (
        <span className="absolute bottom-2 left-2 rounded-md bg-fuchsia-500/20 px-1.5 py-0.5 text-[9px] text-fuchsia-100">已同调</span>
      )}
      {entry.attunementPending && !entry.attuned && (
        <span className="absolute bottom-2 left-2 rounded-md bg-sky-500/20 px-1.5 py-0.5 text-[9px] text-sky-100">短休同调</span>
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
  return (
    <span className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-0 z-[100] w-80 translate-y-1 rounded-xl border border-white/15 bg-void-950/95 p-4 text-left opacity-0 shadow-2xl backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-semibold text-white">{item.name}</span>
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

function GroupButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: ComponentType<{ className?: string }>; children: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${active ? 'bg-arcane-500/25 text-arcane-100' : 'text-slate-500 hover:text-slate-200'}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  )
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
