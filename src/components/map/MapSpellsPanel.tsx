import { useState } from 'react'
import { useCharacterStore } from '../../store/characters'
import { useSpellbookStore } from '../../store/spellbook'
import type { Dnd5eMetamagicId, Dnd5eSpellMetamagicPayload } from '../../lib/sharedCombatTypes'

import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import { DND5E_IMPLEMENTED_METAMAGIC_IDS, dnd5eCanEmpowerSpell, dnd5eCanOverchannelSpell, dnd5eClassDefinitionForCharacter, dnd5eClassProgression, dnd5eDraconicElementalResistanceType, dnd5eFreeSpellCastSource, dnd5eMetamagicAvailableForSpell, dnd5eMetamagicCost, dnd5eMetamagicLabel, dnd5ePactSlotLevel, dnd5eSelectedCombatSpellIds, dnd5eSelectedSpellIds, dnd5eSpellAreaLabel, dnd5eSpellbookEntries, dnd5eSpellbookEntryCastingTime, dnd5eSpellbookEntryDescription, getDnd5eSrdCombatSpell } from '../../rulesets/dnd5e'

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  acid: '强酸', cold: '冷冻', fire: '火焰', lightning: '闪电', poison: '毒素',
}

interface MapSpellsPanelProps {
  charId: string
  canAct?: boolean
  pending?: boolean
  targetingSpellId?: string
  targetingTargetCount?: number
  targetingMaximumTargets?: number
  targetingAllowsDuplicateTargets?: boolean
  targetingRequiresExactTargets?: boolean
  targetingCanSculpt?: boolean
  targetingSculptedCount?: number
  targetingMaximumSculptedTargets?: number
  targetingSculpting?: boolean
  targetingCanCareful?: boolean
  targetingCarefulCount?: number
  targetingMaximumCarefulTargets?: number
  targetingCarefulSelecting?: boolean
  targetingCanHeightened?: boolean
  targetingHeightenedSelected?: boolean
  targetingHeightenedSelecting?: boolean
  onCastSpell?: (spellId: string, slotLevel: number, options?: { overchannel?: boolean; metamagic?: Dnd5eSpellMetamagicPayload; empowered?: boolean; draconicResistance?: boolean; repellingBlast?: boolean }) => void
  onRequestAdjudication?: (spellId: string, slotLevel: number) => void
  onConfirmSpellTargets?: () => void
  onUndoSpellTarget?: () => void
  onToggleSculptSpellTargets?: () => void
  onToggleCarefulSpellTargets?: () => void
  onToggleHeightenedSpellTarget?: () => void
}

/** 地图战斗 · 法术栏（施法职业显示法术型技能） */
export default function MapSpellsPanel({
  charId, canAct = true, pending = false,
  targetingSpellId, targetingTargetCount = 0, targetingMaximumTargets = 1,
  targetingAllowsDuplicateTargets = false, targetingRequiresExactTargets = false, targetingCanSculpt = false,
  targetingSculptedCount = 0, targetingMaximumSculptedTargets = 0, targetingSculpting = false,
  targetingCanCareful = false, targetingCarefulCount = 0, targetingMaximumCarefulTargets = 0,
  targetingCarefulSelecting = false,
  targetingCanHeightened = false, targetingHeightenedSelected = false, targetingHeightenedSelecting = false,
  onCastSpell, onRequestAdjudication, onConfirmSpellTargets, onUndoSpellTarget, onToggleSculptSpellTargets,
  onToggleCarefulSpellTargets, onToggleHeightenedSpellTarget,
}: MapSpellsPanelProps) {
  const c = useCharacterStore((s) => s.characters.find((x) => x.id === charId))
  const importedSpells = useSpellbookStore((s) => s.spells)
  const [slotBySpell, setSlotBySpell] = useState<Record<string, number>>({})
  const [overchannelBySpell, setOverchannelBySpell] = useState<Record<string, boolean>>({})
  const [metamagicBySpell, setMetamagicBySpell] = useState<Record<string, Dnd5eMetamagicId | undefined>>({})
  const [empoweredBySpell, setEmpoweredBySpell] = useState<Record<string, boolean>>({})
  const [draconicResistanceBySpell, setDraconicResistanceBySpell] = useState<Record<string, boolean>>({})
  const [repellingBlastBySpell, setRepellingBlastBySpell] = useState<Record<string, boolean>>({})

  if (!c) return null

  if (c.rulesetId !== 'dnd5e-2014-srd-5.1') {
    return <p className="py-6 text-center text-sm text-slate-500">该角色不是当前 SRD 5.1 角色，请先完成存档迁移。</p>
  }

    const definition = dnd5eClassDefinitionForCharacter(c)
    if (!definition?.spellcasting) {
      return <p className="py-6 text-center text-sm text-slate-500">该职业在 SRD 5.1 中没有施法或契约魔法。</p>
    }
    const progression = dnd5eClassProgression(definition)[Math.max(0, Math.min(19, c.level - 1))]
    const slots = classResourceDefinitions(c)
      .filter((resource) => resource.key.startsWith('dnd5e-spell-slot-') || resource.key === 'dnd5e-pact-slot' || resource.key.startsWith('dnd5e-mystic-arcanum-'))
      .map((resource) => ({ resource, state: getClassResource(c, resource.key) }))
      .filter((entry) => entry.state && entry.state.max > 0)
    const selectedSpells = dnd5eSelectedCombatSpellIds(c)
      .map((id) => getDnd5eSrdCombatSpell(id))
      .filter((spell) => !!spell)
    const spellbookById = new Map(dnd5eSpellbookEntries(importedSpells).map((spell) => [spell.id, spell]))
    const adjudicatedSpells = dnd5eSelectedSpellIds(c)
      .map((id) => spellbookById.get(id))
      .filter((spell): spell is NonNullable<typeof spell> => !!spell && !spell.headless)
    const wildShapeBlocksSpellcasting = !!c.dnd5eCombatState?.wildShapeFormId && c.level < 18
    return (
      <div className="space-y-3 py-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-200">{definition.name}法术资源</h4>
          <p className="mt-1 text-xs text-slate-500">SRD 5.1 · {definition.spellcasting.kind === 'pact' ? '契约位在短休或长休后恢复' : '法术位在长休后恢复'}。</p>
        </div>
        {wildShapeBlocksSpellcasting ? <p className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200">
          荒野变形期间不能施法；18级“野兽施法”解锁后才可在野兽形态施放当前已接入且材料成分允许的法术。
        </p> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {slots.map(({ resource, state }) => (
            <div key={resource.key} className="rounded-xl border border-violet-400/20 bg-violet-500/5 px-3 py-2">
              <div className="text-xs text-slate-500">{resource.label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums text-violet-100">{state!.current}/{state!.max}</div>
            </div>
          ))}
        </div>
        {selectedSpells.length > 0 ? <div className="grid gap-2">
          {selectedSpells.map((spell) => {
            const pactLevel = definition.spellcasting!.kind === 'pact' ? dnd5ePactSlotLevel(c.level) : undefined
            const freeBaseCast = spell.level > 0 ? dnd5eFreeSpellCastSource({
              classId: definition.id,
              level: c.level,
              classSelections: c.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {},
              classResources: c.classResources ?? {},
            }, spell, spell.level) : undefined
            const slotLevels = spell.level === 0 ? [0] : pactLevel != null
              ? ((getClassResource(c, 'dnd5e-pact-slot')?.current ?? 0) > 0 && pactLevel >= spell.level ? [pactLevel] : [])
              : Array.from({ length: 9 - spell.level + 1 }, (_, index) => spell.level + index)
                .filter((level) => (getClassResource(c, `dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
            const availableLevels = [...new Set([
              ...(freeBaseCast ? [spell.level] : []),
              ...slotLevels,
            ])].sort((left, right) => left - right)
            const selectedSlot = availableLevels.includes(slotBySpell[spell.id]) ? slotBySpell[spell.id] : availableLevels[0]
            const canOverchannel = selectedSlot != null && dnd5eCanOverchannelSpell({
              classId: definition.id,
              subclassId: c.dnd5eClassChoices?.classes?.[definition.id]?.subclass,
              level: c.level,
            }, spell, selectedSlot)
            const overchannel = canOverchannel && overchannelBySpell[spell.id] === true
            const priorOverchannelUses = Math.max(0, Math.floor(c.dnd5eCombatState?.overchannelUsesSinceLongRest ?? 0))
            const backlashDice = overchannel && priorOverchannelUses > 0 && selectedSlot != null
              ? (priorOverchannelUses + 1) * selectedSlot
              : 0
            const learnedMetamagic = c.dnd5eClassChoices?.classes?.sorcerer?.selections?.metamagic ?? []
            const availableMetamagic = DND5E_IMPLEMENTED_METAMAGIC_IDS.filter((kind) =>
              learnedMetamagic.includes(kind) && selectedSlot != null && dnd5eMetamagicAvailableForSpell(kind, spell, selectedSlot),
            )
            const selectedMetamagic = availableMetamagic.includes(metamagicBySpell[spell.id] as typeof availableMetamagic[number])
              ? metamagicBySpell[spell.id] as typeof availableMetamagic[number]
              : undefined
            const sorceryPoints = getClassResource(c, 'dnd5e-sorcery-points')?.current ?? 0
            const metamagicCost = selectedMetamagic ? dnd5eMetamagicCost(selectedMetamagic, selectedSlot) : 0
            const canEmpower = selectedSlot != null && !overchannel && learnedMetamagic.includes('empowered') &&
              dnd5eCanEmpowerSpell(spell)
            const empowered = canEmpower && empoweredBySpell[spell.id] === true
            const draconicResistanceType = dnd5eDraconicElementalResistanceType({
              classId: definition.id,
              subclassId: c.dnd5eClassChoices?.classes?.[definition.id]?.subclass,
              level: c.level,
              classSelections: c.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {},
            }, spell)
            const draconicResistance = !!draconicResistanceType && draconicResistanceBySpell[spell.id] === true
            const invocations = c.dnd5eClassChoices?.classes?.warlock?.selections?.['eldritch-invocations'] ?? []
            const canRepellingBlast = spell.id === 'eldritch-blast' && invocations.includes('repelling-blast')
            const repellingBlast = canRepellingBlast && repellingBlastBySpell[spell.id] === true
            const effectiveRangeFeet = spell.id === 'eldritch-blast' && invocations.includes('eldritch-spear')
              ? 300
              : spell.rangeFeet
            const totalSorceryPointCost = metamagicCost + (empowered ? 1 : 0) + (draconicResistance ? 1 : 0)
            const areaLabel = dnd5eSpellAreaLabel(spell)
            const projectileUnit = spell.id === 'magic-missile' ? '枚飞弹' : '道射线'
            return <div key={spell.id} className="rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><div className="text-sm font-semibold text-violet-100">{spell.name}</div><div className="text-[10px] text-slate-500">{spell.englishName} · {spell.level === 0 ? '戏法' : `${spell.level}环`} · {spell.castingTime === 'bonus-action' ? '附赠动作' : spell.castingTime === 'reaction' ? '反应' : '动作'} · {effectiveRangeFeet}尺{spell.concentration ? ' · 专注' : ''}</div></div>
                {spell.level > 0 ? <select
                  value={selectedSlot ?? ''}
                  onChange={(event) => setSlotBySpell((current) => ({ ...current, [spell.id]: Number(event.target.value) }))}
                  className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-xs text-slate-200"
                >
                  {availableLevels.length === 0 ? <option value="">无法术位</option> : availableLevels.map((level) => <option key={level} value={level}>
                    {level}环{level === spell.level && freeBaseCast ? `（${freeBaseCast.kind === 'spell-mastery' ? '法术精通' : freeBaseCast.kind === 'mystic-arcanum' ? '秘法奥秘' : '招牌免费施放'}）` : '位'}
                  </option>)}
                </select> : null}
              </div>
              {areaLabel ? <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${targetingSpellId === spell.id ? 'border-amber-300/40 bg-amber-400/10 text-amber-100' : 'border-violet-300/15 bg-violet-400/[0.05] text-violet-200'}`}>
                <span className="font-semibold">攻击范围：</span>{areaLabel}
                {targetingSpellId === spell.id ? <span className="ml-1 text-amber-200/80">· 地图已显示模板，点击可重新定位</span> : null}
              </div> : null}
              <p className="mt-2 text-xs leading-5 text-slate-500">{spell.description}</p>
              {canOverchannel ? <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${overchannel ? 'border-fuchsia-300/35 bg-fuchsia-400/10 text-fuchsia-100' : 'border-white/8 bg-black/10 text-slate-400'}`}>
                <input
                  type="checkbox"
                  checked={overchannel}
                  onChange={(event) => setOverchannelBySpell((current) => ({ ...current, [spell.id]: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="block">超限导能 · 本次伤害骰取最大值</strong>
                  <span className="mt-0.5 block text-[10px] opacity-75">此前已用 {priorOverchannelUses} 次；{backlashDice > 0 ? `施法后承受 ${backlashDice}d12 不可减免的黯蚀伤害` : '长休后的首次使用不承受反噬'}</span>
                </span>
              </label> : null}
              {availableMetamagic.length > 0 ? <label className="mt-2 block rounded-lg border border-rose-400/15 bg-rose-500/[0.04] px-3 py-2 text-xs text-slate-400">
                超魔法
                <select
                  value={selectedMetamagic ?? ''}
                  onChange={(event) => setMetamagicBySpell((current) => ({
                    ...current,
                    [spell.id]: (event.target.value || undefined) as Dnd5eMetamagicId | undefined,
                  }))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-xs text-slate-200"
                >
                  <option value="">本次不使用</option>
                  {availableMetamagic.map((kind) => <option key={kind} value={kind}>
                    {dnd5eMetamagicLabel(kind)}（{dnd5eMetamagicCost(kind, selectedSlot)}术法点）
                  </option>)}
                </select>
                {selectedMetamagic ? <span className="mt-1 block text-[10px] text-rose-200/75">
                  当前术法点 {sorceryPoints}；本次由DM端重新核对已知超魔法、目标与消耗。
                </span> : null}
              </label> : null}
              {canEmpower ? <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${empowered ? 'border-rose-300/35 bg-rose-400/10 text-rose-100' : 'border-white/8 bg-black/10 text-slate-400'}`}>
                <input
                  type="checkbox"
                  checked={empowered}
                  onChange={(event) => setEmpoweredBySpell((current) => ({ ...current, [spell.id]: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="block">强化法术 · 伤害骰后选择重掷（1术法点）</strong>
                  <span className="mt-0.5 block text-[10px] opacity-75">
                    掷出伤害骰后，可选择至多魅力调整值枚骰重掷并采用新结果；可以与上方另一种超魔法同时使用。
                  </span>
                </span>
              </label> : null}
              {draconicResistanceType ? <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${draconicResistance ? 'border-orange-300/35 bg-orange-400/10 text-orange-100' : 'border-white/8 bg-black/10 text-slate-400'}`}>
                <input
                  type="checkbox"
                  checked={draconicResistance}
                  onChange={(event) => setDraconicResistanceBySpell((current) => ({ ...current, [spell.id]: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="block">元素亲和 · 消耗1术法点</strong>
                  <span className="mt-0.5 block text-[10px] opacity-75">
                    获得{DAMAGE_TYPE_LABELS[draconicResistanceType] ?? draconicResistanceType}抗性1小时
                    {c.dnd5eCombatState?.draconicResistanceType
                      ? `；当前${DAMAGE_TYPE_LABELS[c.dnd5eCombatState.draconicResistanceType] ?? c.dnd5eCombatState.draconicResistanceType}抗性剩余约${c.dnd5eCombatState.draconicResistanceRoundsRemaining ?? 0}轮`
                      : ''}
                  </span>
                </span>
              </label> : null}
              {canRepellingBlast ? <label className={`mt-2 flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs ${repellingBlast ? 'border-cyan-300/35 bg-cyan-400/10 text-cyan-100' : 'border-white/8 bg-black/10 text-slate-400'}`}>
                <input
                  type="checkbox"
                  checked={repellingBlast}
                  onChange={(event) => setRepellingBlastBySpell((current) => ({ ...current, [spell.id]: event.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  <strong className="block">斥力魔爆 · 命中后推开</strong>
                  <span className="mt-0.5 block text-[10px] opacity-75">每道命中的射线分别将目标沿远离你的方向推开至多10尺；地图边界或阻挡会截短位移。</span>
                </span>
              </label> : null}
              <button
                type="button"
                disabled={!canAct || pending || selectedSlot == null || wildShapeBlocksSpellcasting || spell.castingTime === 'reaction' || totalSorceryPointCost > sorceryPoints}
                onClick={() => selectedSlot != null && onCastSpell?.(spell.id, selectedSlot, {
                  overchannel,
                  metamagic: selectedMetamagic ? { kind: selectedMetamagic } : undefined,
                  empowered,
                  draconicResistance,
                  repellingBlast,
                })}
                className={`mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${targetingSpellId === spell.id ? 'bg-amber-400 text-void-950' : 'bg-violet-500/20 text-violet-100 hover:bg-violet-500/30'}`}
              >
                {targetingSpellId === spell.id
                  ? targetingHeightenedSelecting
                    ? `升阶法术（点击一个已选生物，使其第一次豁免具有劣势）`
                    : targetingCarefulSelecting
                    ? `谨慎法术 ${targetingCarefulCount}/${targetingMaximumCarefulTargets}（点击已选生物自动成功）`
                    : targetingSculpting
                    ? `法术塑形 ${targetingSculptedCount}/${targetingMaximumSculptedTargets}（点击已选生物保护）`
                    : targetingMaximumTargets > 1
                      ? targetingAllowsDuplicateTargets
                        ? `分配${projectileUnit} ${targetingTargetCount}/${targetingMaximumTargets}（点击目标继续分配）`
                        : spell.area
                          ? `已框选 ${targetingTargetCount} 个生物（在地图移动并点击范围）`
                          : `选择目标 ${targetingTargetCount}/${targetingMaximumTargets}（再次点击取消）`
                      : '请点击地图目标'
                  : spell.castingTime === 'reaction' ? '符合触发条件时自动询问' : '选择目标并施放'}
              </button>
              {targetingSpellId === spell.id && targetingMaximumTargets > 1 ? <>
                {targetingAllowsDuplicateTargets ? <button
                  type="button"
                  disabled={pending || targetingTargetCount < 1}
                  onClick={onUndoSpellTarget}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  撤销上一{projectileUnit}
                </button> : null}
                {targetingCanSculpt && targetingTargetCount > 0 ? <button
                  type="button"
                  disabled={pending}
                  onClick={onToggleSculptSpellTargets}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${targetingSculpting ? 'border-sky-300/40 bg-sky-400/15 text-sky-100' : 'border-sky-400/20 bg-sky-500/[0.06] text-sky-200 hover:bg-sky-500/10'}`}
                >
                  {targetingSculpting
                    ? `完成保护目标选择（已保护 ${targetingSculptedCount}/${targetingMaximumSculptedTargets}）`
                    : `法术塑形：选择保护目标（${targetingSculptedCount}/${targetingMaximumSculptedTargets}）`}
                </button> : null}
                {targetingCanCareful && targetingTargetCount > 0 ? <button
                  type="button"
                  disabled={pending}
                  onClick={onToggleCarefulSpellTargets}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${targetingCarefulSelecting ? 'border-rose-300/40 bg-rose-400/15 text-rose-100' : 'border-rose-400/20 bg-rose-500/[0.06] text-rose-200 hover:bg-rose-500/10'}`}
                >
                  {targetingCarefulSelecting
                    ? `完成谨慎法术目标选择（${targetingCarefulCount}/${targetingMaximumCarefulTargets}）`
                    : `谨慎法术：选择自动成功目标（${targetingCarefulCount}/${targetingMaximumCarefulTargets}）`}
                </button> : null}
                {targetingCanHeightened && targetingTargetCount > 0 ? <button
                  type="button"
                  disabled={pending}
                  onClick={onToggleHeightenedSpellTarget}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${targetingHeightenedSelecting ? 'border-fuchsia-300/40 bg-fuchsia-400/15 text-fuchsia-100' : 'border-fuchsia-400/20 bg-fuchsia-500/[0.06] text-fuchsia-200 hover:bg-fuchsia-500/10'}`}
                >
                  {targetingHeightenedSelecting
                    ? `完成升阶法术目标选择（${targetingHeightenedSelected ? '已指定' : '尚未指定'}）`
                    : `升阶法术：${targetingHeightenedSelected ? '已指定劣势目标' : '选择劣势目标'}`}
                </button> : null}
                <button
                  type="button"
                  disabled={pending || targetingTargetCount < 1 ||
                    ((targetingAllowsDuplicateTargets || targetingRequiresExactTargets) && targetingTargetCount !== targetingMaximumTargets) ||
                    (targetingCanCareful && targetingCarefulCount < 1) ||
                    (targetingCanHeightened && !targetingHeightenedSelected)}
                  onClick={onConfirmSpellTargets}
                  className="mt-2 w-full rounded-lg bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {targetingAllowsDuplicateTargets
                    ? `发射已分配的 ${targetingTargetCount} ${projectileUnit}`
                    : `施放到已选 ${targetingTargetCount} 个目标${targetingSculptedCount > 0 ? `，保护 ${targetingSculptedCount} 个` : ''}${targetingCarefulCount > 0 ? `，谨慎自动成功 ${targetingCarefulCount} 个` : ''}`}
                </button>
              </> : null}
            </div>
          })}
        </div> : <p className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-xs leading-5 text-slate-500">尚未在人物卡的职业页选择已接入 Headless 的战斗法术。</p>}
        {adjudicatedSpells.length > 0 ? <div className="space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.035] p-3">
          <div>
            <h4 className="text-sm font-semibold text-amber-100">需要 DM 裁定的法术</h4>
            <p className="mt-1 text-xs leading-5 text-amber-100/60">
              请求后不会立即扣除资源。DM 批准并提交裁定结果时，Headless 才会一次性消费动作与法术位；取消时不消费。
            </p>
          </div>
          <div className="grid gap-2">
            {adjudicatedSpells.map((spell) => {
              const castingTime = dnd5eSpellbookEntryCastingTime(spell)
              const pactLevel = definition.spellcasting!.kind === 'pact' ? dnd5ePactSlotLevel(c.level) : undefined
              const freeBaseCast = spell.level > 0 ? dnd5eFreeSpellCastSource({
                classId: definition.id,
                level: c.level,
                classSelections: c.dnd5eClassChoices?.classes?.[definition.id]?.selections ?? {},
                classResources: c.classResources ?? {},
              }, { id: spell.id, level: spell.level }, spell.level) : undefined
              const slotLevels = spell.level === 0 ? [0] : pactLevel != null && spell.level <= 5
                ? ((getClassResource(c, 'dnd5e-pact-slot')?.current ?? 0) > 0 && pactLevel >= spell.level ? [pactLevel] : [])
                : Array.from({ length: 9 - spell.level + 1 }, (_, index) => spell.level + index)
                  .filter((level) => (getClassResource(c, `dnd5e-spell-slot-${level}`)?.current ?? 0) > 0)
              const availableLevels = [...new Set([...(freeBaseCast ? [spell.level] : []), ...slotLevels])]
                .sort((left, right) => left - right)
              const selectedSlot = availableLevels.includes(slotBySpell[spell.id])
                ? slotBySpell[spell.id]
                : availableLevels[0]
              const unsupported = castingTime === 'reaction' || castingTime === 'unsupported'
              return <div key={spell.id} className="rounded-xl border border-amber-300/15 bg-black/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-amber-50">{spell.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {spell.englishName ? `${spell.englishName} · ` : ''}{spell.level === 0 ? '戏法' : `${spell.level}环`} · {
                        castingTime === 'bonus-action' ? '附赠动作' : castingTime === 'action' ? '动作' : castingTime === 'reaction' ? '反应' : '非战斗施法时间'
                      } · DM 裁定
                    </div>
                  </div>
                  {spell.level > 0 ? <select
                    value={selectedSlot ?? ''}
                    onChange={(event) => setSlotBySpell((current) => ({ ...current, [spell.id]: Number(event.target.value) }))}
                    className="rounded-lg border border-white/10 bg-void-950/70 px-2 py-1 text-xs text-slate-200"
                  >
                    {availableLevels.length === 0 ? <option value="">无法术位</option> : availableLevels.map((level) => <option key={level} value={level}>
                      {level}环{level === spell.level && freeBaseCast ? '（可免费施放）' : '位'}
                    </option>)}
                  </select> : null}
                </div>
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-5 text-slate-500">
                  {dnd5eSpellbookEntryDescription(spell) || '该房间法术没有规则正文，请 DM 根据已获授权的资料裁定。'}
                </p>
                <button
                  type="button"
                  disabled={!canAct || pending || selectedSlot == null || wildShapeBlocksSpellcasting || unsupported}
                  onClick={() => selectedSlot != null && onRequestAdjudication?.(spell.id, selectedSlot)}
                  className="mt-2 w-full rounded-lg bg-amber-500/20 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {castingTime === 'reaction'
                    ? '反应法术需由对应触发器接入'
                    : castingTime === 'unsupported'
                      ? '施法时间不适用于战斗动作'
                      : '请求 DM 裁定并施放'}
                </button>
              </div>
            })}
          </div>
        </div> : null}
        <p className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2 text-xs leading-5 text-slate-500">
          {progression.cantripsKnown != null ? `已知戏法 ${progression.cantripsKnown} 个。` : ''}
          {progression.spellsKnown != null ? ` 已知法术 ${progression.spellsKnown} 个。` : ' 准备法术数量按职业特性与施法属性计算。'}
          上述已选择法术会由 D&amp;D Headless 法术事务消费动作与对应法术位；未列出的 SRD 法术仍在继续接入。
        </p>
      </div>
    )
}
