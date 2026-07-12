import type { ComponentType } from 'react'
import { Shield, Sword, Gem } from 'lucide-react'
import { useCharacterStore } from '../../store/characters'
import {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_SLOTS,
} from '../../lib/equipmentDefaults'
import { formatEquipmentStatLine, setEquipmentSlot } from '../../lib/combatStats'
import { equipmentCatalogForCharacter } from '../../lib/classDefinitionRegistry'
import type { Character } from '../../types/character'
import type { EquipmentItem, EquipmentSlot } from '../../types/equipment'

const SLOT_ICONS: Partial<Record<EquipmentSlot, ComponentType<{ className?: string }>>> = {
  mainWeapon: Sword,
  offHand: Sword,
  armor: Shield,
  ring: Gem,
  necklace: Gem,
}

function SlotCard({
  slot,
  item,
  editable,
  character,
  onEquip,
  onUnequip,
}: {
  slot: EquipmentSlot
  item?: EquipmentItem
  editable: boolean
  character: Character
  onEquip: (item: EquipmentItem) => void
  onUnequip: () => void
}) {
  const Icon = SLOT_ICONS[slot]
  const options = equipmentCatalogForCharacter(character).filter((option) => option.slot === slot)

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/8 bg-void-900/35 p-3">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-amber-300/80" /> : null}
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {EQUIPMENT_SLOT_LABELS[slot]}
        </span>
      </div>
      {item ? (
        <>
          <p className="text-sm font-semibold text-slate-100">{item.name}</p>
          <p className="text-[11px] leading-relaxed text-slate-500">{formatEquipmentStatLine(item)}</p>
          {editable ? (
            <button
              type="button"
              onClick={onUnequip}
              className="mt-1 self-start rounded-md px-2 py-0.5 text-[11px] text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
            >
              卸下
            </button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-slate-600">空</p>
      )}
      {editable && options.length > 0 ? (
        <select
          value={item?.id ?? ''}
          onChange={(e) => {
            const picked = options.find((o) => o.id === e.target.value)
            if (picked) onEquip(picked)
            else if (!e.target.value) onUnequip()
          }}
          className="mt-auto rounded-lg border border-white/10 bg-void-900/60 px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-arcane-500"
        >
          <option value="">选择装备…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}

export default function EquipmentTab({ charId, editable = true }: { charId: string; editable?: boolean }) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === charId))
  const update = useCharacterStore((s) => s.update)
  if (!c) return null

  const equipment = c.equipment ?? {}

  const patchSlot = (slot: EquipmentSlot, item: EquipmentItem | undefined) => {
    update(charId, { equipment: setEquipmentSlot(equipment, slot, item) })
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">装备栏</p>
        <p className="mb-4 text-xs text-slate-500">AC 由护甲提供，与防御力（减伤）独立计算。</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {EQUIPMENT_SLOTS.map((slot) => (
            <SlotCard
              key={slot}
              slot={slot}
              item={equipment[slot]}
              editable={editable}
              character={c}
              onEquip={(item) => patchSlot(slot, item)}
              onUnequip={() => patchSlot(slot, undefined)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
