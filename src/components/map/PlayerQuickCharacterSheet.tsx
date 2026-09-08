import { useMemo, useState, type ReactNode } from 'react'
import { Backpack, Footprints, PackageOpen, Shield, X } from 'lucide-react'
import type { Character } from '../../types/character'
import type { Dnd5eInventoryEntry } from '../../types/inventory'
import { getEffectiveAc } from '../../lib/combatStats'
import { resolveMapTokenPortrait } from '../../lib/portraitPresentation'
import {
  QUICK_CHARACTER_CURRENCIES,
  QUICK_CHARACTER_EQUIPMENT_SLOTS,
  quickAbilityModifier,
  quickCharacterAbilityRows,
  quickCharacterSkillRows,
  quickCreatureFormAbilityRows,
  quickCreatureFormPassivePerception,
  quickCreatureFormSkillRows,
  quickFormatModifier,
} from '../../lib/quickCharacterView'
import {
  dnd5eActiveEffectRemainingLabel,
  dnd5eActiveFlySpeed,
  dnd5eActiveHitPointMaximumBonus,
  dnd5eConditionLabel,
  dnd5eEffectiveWalkingSpeed,
  dnd5eSpellSaveDc,
  getDnd5eSrdCombatSpell,
  getDnd5eSrdMonster,
  getDnd5eSrdSpellCatalogEntry,
  normalizeDnd5eActiveEffects,
  normalizeDnd5eInventory,
} from '../../rulesets/dnd5e'
import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import Dnd5eInventoryTile from '../character/Dnd5eInventoryTile'
import { dnd5eTruePolymorphObjectFormFromEffects } from '../../rulesets/dnd5e/truePolymorphObjectForms'

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
    return state ? [{
      key: definition.key,
      label: definition.label,
      ...state,
      unlimited: (definition.unlimited?.(character) ?? false) || Number(state.max) >= Number.MAX_SAFE_INTEGER,
    }] : []
  }), [character])
  const activeEffects = normalizeDnd5eActiveEffects(character.dnd5eCombatState?.activeEffects)
  const activeObjectForm = dnd5eTruePolymorphObjectFormFromEffects(activeEffects)
  const activeCreatureForm = character.dnd5eCombatState?.wildShapeFormId
    ? getDnd5eSrdMonster(character.dnd5eCombatState.wildShapeFormId)
    : undefined
  const creatureFormMode = character.dnd5eCombatState?.wildShapeMode
  const spellCreatureForm = !!activeCreatureForm && !activeObjectForm &&
    (creatureFormMode === 'polymorph' || creatureFormMode === 'true-polymorph' || creatureFormMode === 'animal-shapes')
  const shapechangeEquipmentDisposition = creatureFormMode === 'shapechange'
    ? character.dnd5eCombatState?.shapechangeEquipmentDisposition
    : undefined
  const creatureFormEquipmentUnavailable = !!activeObjectForm || spellCreatureForm ||
    (!!activeCreatureForm && creatureFormMode === 'shapechange' && shapechangeEquipmentDisposition !== 'wear')
  const creatureFormEquipmentTitle = activeObjectForm
    ? '装备与携带物已融入物体形态'
    : shapechangeEquipmentDisposition === 'drop'
    ? '装备已掉落在施法位置'
    : '装备已融入形态'
  const creatureFormLabel = creatureFormMode === 'true-polymorph'
    ? '完全变形术'
    : creatureFormMode === 'polymorph'
    ? '变形术'
    : creatureFormMode === 'animal-shapes'
      ? '动物形态'
      : creatureFormMode === 'shapechange'
        ? '形体变化'
        : '荒野形态'
  const abilities = useMemo(() => activeObjectForm
    ? []
    : activeCreatureForm
    ? quickCreatureFormAbilityRows(character, activeCreatureForm, character.dnd5eCombatState)
    : quickCharacterAbilityRows(character), [activeCreatureForm, activeObjectForm, character])
  const skills = useMemo(() => activeObjectForm
    ? []
    : activeCreatureForm
    ? quickCreatureFormSkillRows(character, activeCreatureForm, character.dnd5eCombatState)
    : quickCharacterSkillRows(character), [activeCreatureForm, activeObjectForm, character])
  const speed = activeObjectForm ? 0 : activeCreatureForm?.speed.walk ?? dnd5eEffectiveWalkingSpeed(character)
  const flySpeed = activeObjectForm
    ? undefined
    : Math.max(activeCreatureForm?.speed.fly ?? 0, dnd5eActiveFlySpeed(activeEffects) ?? 0) || undefined
  const spellSaveDc = dnd5eSpellSaveDc(character) ?? character.saveDC
  const concentrationSpellId = character.dnd5eCombatState?.concentrationSpellId
  const concentrationLabel = concentrationSpellId
    ? getDnd5eSrdSpellCatalogEntry(concentrationSpellId)?.name ??
      getDnd5eSrdCombatSpell(concentrationSpellId)?.name ??
      concentrationSpellId
    : undefined
  const concentrationRounds = character.dnd5eCombatState?.concentrationRoundsRemaining
  const activeEffectConditionLabels = new Set(activeEffects.flatMap((effect) => [
    effect.label,
    effect.legacyCondition,
    effect.standardCondition ? dnd5eConditionLabel(effect.standardCondition) : undefined,
  ]).flatMap((value) => value?.trim() ? [value.trim().toLocaleLowerCase()] : []))
  const standaloneConditions = [...new Set(character.conditions)].filter((condition) =>
    !activeEffectConditionLabels.has(condition.trim().toLocaleLowerCase()) &&
    !activeEffectConditionLabels.has(dnd5eConditionLabel(condition).trim().toLocaleLowerCase()),
  )
  const initiative = activeCreatureForm
    ? quickAbilityModifier(activeCreatureForm.abilities.dex)
    : (character.abilities.dex == null ? 0 : Math.floor((character.abilities.dex - 10) / 2)) + character.initiativeBonus
  const currentHp = activeCreatureForm
    ? character.dnd5eCombatState?.wildShapeCurrentHp ?? activeCreatureForm.hitPoints.average
    : character.currentHp
  const maximumHp = activeCreatureForm?.hitPoints.average ??
    character.maxHp + dnd5eActiveHitPointMaximumBonus(activeEffects)
  const armorClass = activeCreatureForm?.armorClass.value ?? getEffectiveAc(character)
  const passivePerception = activeCreatureForm
    ? quickCreatureFormPassivePerception(character.passivePerception, activeCreatureForm, character.dnd5eCombatState)
    : character.passivePerception

  return (
    <div
      className="quick-character-sheet-backdrop fixed inset-0 z-[1560] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-character-sheet-title"
        data-testid="quick-character-sheet"
        className="quick-character-sheet flex max-h-[92vh] w-[min(94vw,980px)] flex-col overflow-hidden rounded-2xl border border-violet-300/20 bg-[#0a0b13]/[0.99] shadow-[0_32px_120px_rgba(0,0,0,0.85)]"
      >
        <header className="quick-character-sheet__header flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-violet-300/50 bg-violet-950">
            {portrait
              ? <img src={portrait} alt="" className="h-full w-full object-cover" />
              : <span className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-2xl ${character.accent}`}>{character.avatar}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="quick-character-sheet-title" className="truncate text-base font-black text-white sm:text-lg">{character.name}</h2>
            <p className="mt-0.5 truncate text-xs text-slate-400">{character.race} · {character.charClass} {character.level} 级 · {character.background}</p>
            <p className="mt-0.5 truncate text-[10px] text-slate-500">玩家：{character.player}</p>
            {activeObjectForm
              ? <p className="mt-1 truncate text-[11px] font-bold text-amber-200">当前形态：{activeObjectForm.profile.label}（完全变形术{activeObjectForm.permanent ? ' · 永久' : ''}）</p>
              : activeCreatureForm ? <p className="mt-1 truncate text-[11px] font-bold text-emerald-200">当前形态：{activeCreatureForm.name}（{creatureFormLabel}{character.dnd5eCombatState?.wildShapePermanent === true ? ' · 永久' : ''}）</p> : null}
          </div>
          <button type="button" aria-label="关闭快捷人物卡" onClick={onClose} className="rounded-xl border border-white/10 p-2.5 text-slate-400 transition hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </header>

        <div className="quick-character-sheet__body min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div data-testid="quick-character-overview" className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Summary label={activeObjectForm ? '物体生命值' : activeCreatureForm ? '形态生命值' : '生命值'} value={`${currentHp}/${maximumHp}`} detail={activeCreatureForm ? `本体 ${character.currentHp}/${character.maxHp}` : character.tempHp > 0 ? `临时 ${character.tempHp}` : undefined} />
                <Summary icon={<Shield className="h-3.5 w-3.5" />} label="护甲等级" value={`${armorClass}`} />
                <Summary
                  icon={<Footprints className="h-3.5 w-3.5" />}
                  label="速度"
                  value={`${speed} 尺`}
                  detail={flySpeed ? `飞行 ${flySpeed} 尺` : undefined}
                />
                <Summary label="先攻" value={activeObjectForm ? '—' : quickFormatModifier(initiative)} />
                <Summary label="被动察觉" value={activeObjectForm ? '—' : `${passivePerception}`} />
                <Summary label="法术豁免 DC" value={spellCreatureForm || activeObjectForm ? '不可施法' : `${spellSaveDc ?? '—'}`} />
              </div>

              <section>
                <h3 className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-violet-200">属性与豁免</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  {activeObjectForm ? <p className="col-span-full rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-3 text-xs text-amber-100">物体没有生物属性或豁免；本体数据在法术结束前封存。</p> : abilities.map((entry) => (
                    <div key={entry.key} className="quick-character-sheet__ability rounded-xl border border-violet-300/15 bg-violet-400/[0.06] p-3 text-center">
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
                  {activeObjectForm ? <p className="col-span-full rounded-xl border border-amber-300/20 bg-amber-400/[0.05] p-3 text-xs text-amber-100">物体不能进行生物技能检定，也不能行动、说话或施法。</p> : skills.map((entry) => (
                    <div key={entry.key} className="quick-character-sheet__skill flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${entry.expertise ? 'bg-amber-300' : entry.proficient ? 'bg-sky-300' : 'border border-slate-700'}`} />
                      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{entry.label}</span>
                      <strong className="text-xs tabular-nums text-white">{quickFormatModifier(entry.modifier)}</strong>
                    </div>
                  ))}
                </div>
              </section>

              <div className="grid items-start gap-3 lg:grid-cols-[minmax(220px,0.55fr)_minmax(0,1.45fr)]">
                <section className="quick-character-sheet__section rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <h3 className="mb-2 text-xs font-black text-slate-300">当前状态</h3>
                  <div className="flex min-h-6 flex-wrap items-center gap-1.5">
                    {standaloneConditions.map((condition) => <span key={condition} className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2 py-1 text-[10px] text-rose-100">{dnd5eConditionLabel(condition)}</span>)}
                    {activeObjectForm
                      ? <span className="rounded-full border border-amber-300/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-100">完全变形术：{activeObjectForm.profile.label} · 物体生命 {currentHp}/{maximumHp}{activeObjectForm.permanent ? ' · 永久' : ''}</span>
                      : activeCreatureForm ? <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-100">{creatureFormLabel}：{activeCreatureForm.name} · 形态生命 {currentHp}/{maximumHp}{character.dnd5eCombatState?.wildShapePermanent === true ? ' · 永久' : ''}</span> : null}
                    {character.concentrating ? <span className="rounded-full border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-[10px] text-violet-100">专注中{concentrationLabel ? `：${concentrationLabel}` : '：未记录来源'}{concentrationRounds != null ? ` · 剩余 ${concentrationRounds} 轮` : ''}</span> : null}
                    {activeEffects.map((effect) => <span key={effect.id} className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-100">{effect.label} · {dnd5eActiveEffectRemainingLabel(effect)}</span>)}
                    {standaloneConditions.length === 0 && !character.concentrating && activeEffects.length === 0 ? <span className="text-xs text-slate-600">无状态效果</span> : null}
                  </div>
                </section>

                <section className="quick-character-sheet__section rounded-xl border border-white/10 bg-white/[0.025] p-3">
                  <h3 className="mb-2 text-xs font-black text-slate-300">法术位与职业资源</h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-1.5">
                    {spellCreatureForm || activeObjectForm
                      ? <span className="text-xs text-amber-200">当前{activeObjectForm ? '物体' : '法术'}形态无法使用本体法术位或职业资源。</span>
                      : resourceRows.length > 0 ? resourceRows.map((resource) => <div key={resource.key} className="quick-character-sheet__resource flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-2"><div className="min-w-0 truncate text-[10px] font-semibold text-slate-300">{resource.label}</div><strong className="shrink-0 text-xs tabular-nums text-white">{resource.unlimited ? '不限次数' : `${resource.current}/${resource.max}`}</strong></div>) : <span className="text-xs text-slate-600">当前没有可显示资源</span>}
                  </div>
                </section>
              </div>

              {creatureFormEquipmentUnavailable ? <section className="quick-character-sheet__equipment rounded-xl border border-amber-300/20 bg-amber-400/[0.04] p-4">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100"><Backpack className="h-3.5 w-3.5" />{creatureFormEquipmentTitle}</h3>
                <p className="mt-2 text-xs leading-5 text-amber-200/80">{activeObjectForm
                  ? '目标穿戴与携带的一切已一并成为该物体形态的一部分，当前不能使用、持握或从中获益。'
                  : shapechangeEquipmentDisposition === 'drop'
                  ? '形体变化期间，这些装备留在施法位置，当前无法从装备获得任何收益。'
                  : '变形期间无法启动、使用、持握装备，也无法从装备获得任何收益。'}</p>
              </section> : <section className="quick-character-sheet__equipment rounded-xl border border-amber-300/10 bg-amber-400/[0.025] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100"><Backpack className="h-3.5 w-3.5" />装备与背包</h3>
                    <p className="mt-1 text-[10px] text-slate-500">已装备 {equippedBySlot.size}/{QUICK_CHARACTER_EQUIPMENT_SLOTS.length} · 背包 {carriedEntries.length} 类物品</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {QUICK_CHARACTER_CURRENCIES.map((currency) => <span key={currency.key} className="quick-character-sheet__currency rounded-md bg-black/30 px-2 py-1 text-[9px] text-slate-400">{currency.label} <strong className="ml-0.5 text-white">{inventory.currency?.[currency.key] ?? 0}</strong></span>)}
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
              </section>}
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
        <div className="quick-character-sheet__empty-slot flex min-h-24 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/15 px-1 text-slate-700">
          <PackageOpen className="h-6 w-6" />
          <span className="mt-2 text-[9px]">空槽位</span>
        </div>
      )}
    </div>
  )
}

function Summary({ icon, label, value, detail }: { icon?: ReactNode; label: string; value: string; detail?: string }) {
  return <div className="quick-character-sheet__summary rounded-xl border border-white/[0.08] bg-white/[0.035] p-2.5"><div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{icon}{label}</div><strong className="mt-1 block text-sm text-white">{value}</strong>{detail ? <span className="text-[9px] text-cyan-300">{detail}</span> : null}</div>
}
