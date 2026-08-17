import { useMemo, useState, type ReactNode } from 'react'
import { Backpack, Footprints, PackageOpen, Shield, X } from 'lucide-react'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { getAc } from '../../lib/combatStats'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import {
  QUICK_CHARACTER_CURRENCIES,
  QUICK_CHARACTER_EQUIPMENT_SLOTS,
  quickCharacterAbilityRows,
  quickCharacterSkillRows,
  quickFormatModifier,
} from '../../lib/quickCharacterView'
import { dnd5eConditionLabel, dnd5eEffectiveWalkingSpeed, normalizeDnd5eInventory } from '../../rulesets/dnd5e'
import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import Dnd5eInventoryTile from '../character/Dnd5eInventoryTile'

export interface PlayerQuickCharacterSheetProps {
  character: Character
  onClose: () => void
}

export default function PlayerQuickCharacterSheet({ character, onClose }: PlayerQuickCharacterSheetProps) {
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | null>(null)
  const portrait = resolveMapTokenPortrait(character)
  const inventory = useMemo(() => normalizeDnd5eInventory(character), [character])
  const equippedBySlot = useMemo(() => new Map(
    inventory.entries
      .filter((entry) => !!entry.equippedSlot)
      .map((entry) => [entry.equippedSlot!, entry] as const),
  ), [inventory.entries])
  const carriedEntries = useMemo(
    () => inventory.entries.filter((entry) => !entry.equippedSlot),
    [inventory.entries],
  )
  const resourceRows = useMemo(() => classResourceDefinitions(character).flatMap((definition) => {
    const state = getClassResource(character, definition.key)
    return state ? [{ key: definition.key, label: definition.label, ...state }] : []
  }), [character])
  const abilities = useMemo(() => quickCharacterAbilityRows(character), [character])
  const skills = useMemo(() => quickCharacterSkillRows(character), [character])
  const speed = dnd5eEffectiveWalkingSpeed(character)
  const initiative = (character.abilities.dex == null ? 0 : Math.floor((character.abilities.dex - 10) / 2)) + character.initiativeBonus

  return (
    <div
      className="fixed inset-0 z-[1560] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-character-sheet-title"
        data-testid="quick-character-sheet"
        className="flex max-h-[92vh] w-[min(94vw,980px)] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-[#0a0b13]/[0.99] shadow-[0_32px_120px_rgba(0,0,0,0.85)]"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-violet-300/50 bg-violet-950">
            {portrait
              ? <img src={portrait} alt="" className="h-full w-full object-cover" />
              : <span className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl ${character.accent}`}>{character.avatar}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="quick-character-sheet-title" className="truncate text-base font-black text-white sm:text-lg">{character.name}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">{character.race} · {character.charClass} {character.level} 级 · {character.background}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">玩家：{character.player}</p>
          </div>
          <button type="button" aria-label="关闭快捷人物卡" onClick={onClose} className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div data-testid="quick-character-overview" className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Summary label="生命值" value={`${character.currentHp}/${character.maxHp}`} detail={character.tempHp > 0 ? `临时 ${character.tempHp}` : undefined} />
                <Summary icon={<Shield className="h-3.5 w-3.5" />} label="护甲等级" value={`${getAc(character)}`} />
                <Summary icon={<Footprints className="h-3.5 w-3.5" />} label="速度" value={`${speed} 尺`} />
                <Summary label="先攻" value={quickFormatModifier(initiative)} />
                <Summary label="被动察觉" value={`${character.passivePerception}`} />
                <Summary label="法术豁免 DC" value={`${character.saveDC}`} />
              </div>

              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-violet-200">属性与豁免</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {abilities.map((entry) => (
                    <div key={entry.key} className="rounded-xl border border-violet-300/15 bg-violet-400/[0.06] p-3 text-center">
                      <div className="text-xs font-bold text-slate-300">{entry.label}</div>
                      <div className="mt-1 text-xl font-black text-white">{entry.score}</div>
                      <div className="text-sm font-bold text-violet-200">{quickFormatModifier(entry.modifier)}</div>
                      <div className={`mt-1 text-[9px] ${entry.saveProficient ? 'text-emerald-300' : 'text-slate-600'}`}>豁免 {quickFormatModifier(entry.savingThrowModifier)}{entry.saveProficient ? ' · 熟练' : ''}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-sky-200">技能</h3>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                  {skills.map((entry) => (
                    <div key={entry.key} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${entry.expertise ? 'bg-amber-300' : entry.proficient ? 'bg-sky-300' : 'border border-slate-700'}`} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{entry.label}</span>
                      <strong className="text-xs tabular-nums text-white">{quickFormatModifier(entry.modifier)}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid items-start gap-3 lg:grid-cols-[minmax(220px,0.55fr)_minmax(0,1.45fr)]">
                <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <h3 className="mb-2 text-xs font-black text-slate-300">当前状态</h3>
                  <div className="flex min-h-6 flex-wrap items-center gap-1.5">
                    {character.conditions.length > 0 ? character.conditions.map((condition) => <span key={condition} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-100">{dnd5eConditionLabel(condition)}</span>) : null}
                    {character.concentrating ? <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-[10px] text-violet-100">专注中</span> : null}
                    {character.conditions.length === 0 && !character.concentrating ? <span className="text-xs text-slate-600">无状态效果</span> : null}
                  </div>
                </section>

                <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <h3 className="mb-2 text-xs font-black text-slate-300">法术位与职业资源</h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
                    {resourceRows.length > 0 ? resourceRows.map((resource) => <div key={resource.key} className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-2"><div className="min-w-0 truncate text-[10px] font-semibold text-slate-300">{resource.label}</div><strong className="shrink-0 text-xs tabular-nums text-white">{resource.current}/{resource.max}</strong></div>) : <span className="text-xs text-slate-600">当前没有可显示资源</span>}
                  </div>
                </section>
              </div>

              <section className="rounded-xl border border-amber-300/10 bg-amber-400/[0.025] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100"><Backpack className="h-3.5 w-3.5" />装备与背包</h3>
                    <p className="mt-1 text-[10px] text-slate-500">已装备 {equippedBySlot.size}/{QUICK_CHARACTER_EQUIPMENT_SLOTS.length} · 背包 {carriedEntries.length} 类物品</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {QUICK_CHARACTER_CURRENCIES.map((currency) => <span key={currency.key} className="rounded-md bg-black/30 px-2 py-1 text-[9px] text-slate-400">{currency.label} <strong className="ml-0.5 text-white">{inventory.currency?.[currency.key] ?? 0}</strong></span>)}
                  </div>
                </div>

                <div className="mt-3 border-t border-white/[0.06] pt-3">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100/60">已装备</div>
                  <div data-testid="quick-character-equipment-grid" className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                    {QUICK_CHARACTER_EQUIPMENT_SLOTS.map((slot) => (
                      <QuickEquipmentSlot
                        key={slot.key}
                        label={slot.label}
                        entry={equippedBySlot.get(slot.key)}
                        selected={selectedInventoryId === equippedBySlot.get(slot.key)?.instanceId}
                        onSelect={(entry) => setSelectedInventoryId((current) => current === entry.instanceId ? null : entry.instanceId)}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[0.06] pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">背包物品</span>
                    <span className="text-[10px] text-slate-600">点击查看详情</span>
                  </div>
                  {carriedEntries.length > 0 ? (
                    <div data-testid="quick-character-backpack-grid" className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
                      {carriedEntries.map((entry) => (
                        <Dnd5eInventoryTile
                          key={entry.instanceId}
                          entry={entry}
                          compact
                          selected={selectedInventoryId === entry.instanceId}
                          onSelect={() => setSelectedInventoryId((current) => current === entry.instanceId ? null : entry.instanceId)}
                        />
                      ))}
                    </div>
                  ) : <div className="rounded-xl border border-dashed border-white/10 py-5 text-center text-xs text-slate-600">背包为空</div>}
                </div>
                <p className="mt-3 border-t border-white/[0.06] pt-3 text-[10px] leading-4 text-slate-600">快捷人物卡为只读视图；装备、使用或转交物品请前往完整角色卡。</p>
              </section>
          </div>
        </div>
      </section>
    </div>
  )
}

function QuickEquipmentSlot({
  label,
  entry,
  selected,
  onSelect,
}: {
  label: string
  entry?: Dnd5eInventoryEntry
  selected: boolean
  onSelect: (entry: Dnd5eInventoryEntry) => void
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 truncate text-center text-[9px] font-semibold text-amber-100/65">{label}</div>
      {entry ? (
        <Dnd5eInventoryTile entry={entry} compact selected={selected} onSelect={() => onSelect(entry)} />
      ) : (
        <div className="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/15 px-1 text-slate-700">
          <PackageOpen className="h-6 w-6" />
          <span className="mt-2 text-[9px]">空槽位</span>
        </div>
      )}
    </div>
  )
}

function Summary({ icon, label, value, detail }: { icon?: ReactNode; label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5"><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{icon}{label}</div><strong className="mt-1 block text-sm text-white">{value}</strong>{detail ? <span className="text-[9px] text-cyan-300">{detail}</span> : null}</div>
}
