import { useRef, useState } from 'react'
import { Download, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useCustomMonsterStore } from '../../store/customMonsters'
import {
  DND5E_DAMAGE_TYPES,
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterActionDraft,
  createDnd5eCustomMonsterMechanicDraft,
  createDnd5eCustomMonsterDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
  type Dnd5eCustomMonsterDraft,
} from '../../rulesets/dnd5e/customMonsterWorkshop'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eMonsterSize } from '../../rulesets/dnd5e/monsters'
import { DND5E_MONSTER_TARGET_PRIORITY_OPTIONS } from '../../rulesets/dnd5e/monsterAutomation'
import { DND5E_STANDARD_CONDITIONS } from '../../rulesets/dnd5e/conditions'

const ABILITY_LABELS: readonly [AbilityKey, string][] = [
  ['str', '力量'], ['dex', '敏捷'], ['con', '体质'], ['int', '智力'], ['wis', '感知'], ['cha', '魅力'],
]
const SIZES: Dnd5eMonsterSize[] = ['微型', '小型', '中型', '大型', '超大型', '巨型']
const MECHANIC_TRIGGERS = [
  ['turn-start', '回合开始'], ['turn-end', '回合结束'], ['after-hit', '命中后'],
  ['after-damaged', '受到伤害后'], ['phase-transition', '阶段转换'],
] as const
const MECHANIC_EFFECTS = [
  ['healing', '恢复生命'], ['temporary-hit-points', '获得临时生命'], ['damage', '造成伤害'],
  ['standard-condition', '施加标准状态'], ['summon', '召唤生物'], ['area-attack', '范围攻击'],
] as const

function downloadJson(filename: string, value: unknown): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function inputClass(): string {
  return 'w-full rounded-lg border border-white/10 bg-void-950/80 px-2.5 py-2 text-sm text-slate-100 outline-none focus:border-arcane-500'
}

export default function Dnd5eMonsterWorkshopDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const monsters = useCustomMonsterStore((state) => state.monsters)
  const upsertMonster = useCustomMonsterStore((state) => state.upsertMonster)
  const importMonsters = useCustomMonsterStore((state) => state.importMonsters)
  const removeMonster = useCustomMonsterStore((state) => state.removeMonster)
  const [draft, setDraft] = useState<Dnd5eCustomMonsterDraft>(() => createDnd5eCustomMonsterDraft())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const preservesAdvancedFields = !!draft.preservedStatBlock && (
    !!draft.preservedStatBlock.savingThrows || !!draft.preservedStatBlock.skills?.length ||
    !!draft.preservedStatBlock.senses.length || !!draft.preservedStatBlock.damageResistances?.length ||
    !!draft.preservedStatBlock.damageImmunities?.length || !!draft.preservedStatBlock.conditionImmunities?.length ||
    !!draft.preservedStatBlock.reactions?.length || !!draft.preservedStatBlock.legendaryActions?.length ||
    !!draft.preservedStatBlock.lairActions?.length || !!draft.preservedStatBlock.spellcasting ||
    draft.preservedStatBlock.actions.some((action) => action.kind === 'multiattack' || (action.attack?.damage.length ?? 0) > 1)
  )

  if (!open) return null

  const patchDraft = <K extends keyof Dnd5eCustomMonsterDraft>(key: K, value: Dnd5eCustomMonsterDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const monster = buildDnd5eCustomMonster(draft)
      await upsertMonster(monster)
      setSelectedId(monster.id)
      setDraft(dnd5eCustomMonsterDraftFromStatBlock(monster))
      setMessage(`已保存“${monster.name}”，房间内玩家会自动同步。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  const selectMonster = (id: string) => {
    const monster = monsters.find((entry) => entry.id === id)
    if (!monster) return
    setSelectedId(id)
    setDraft(dnd5eCustomMonsterDraftFromStatBlock(monster))
    setMessage(null)
  }

  const importFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const raw = JSON.parse(await file.text()) as unknown
      const entries = Array.isArray(raw)
        ? raw
        : raw && typeof raw === 'object' && Array.isArray((raw as { monsters?: unknown }).monsters)
          ? (raw as { monsters: unknown[] }).monsters
          : null
      if (!entries) throw new Error('导入文件必须是怪物数组，或包含 monsters 数组的对象')
      const result = await importMonsters(entries)
      setMessage(`导入完成：新增 ${result.added}，替换 ${result.replaced}。`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="glass grid max-h-[94vh] w-full max-w-6xl grid-cols-[240px,minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-black/15">
          <div className="border-b border-white/10 p-3">
            <p className="font-semibold text-slate-100">房间怪物</p>
            <p className="mt-1 text-xs text-slate-500">{monsters.length} / 512 个自定义模板</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {monsters.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs leading-relaxed text-slate-500">尚无自定义怪物。保存后会同步给本房间玩家。</p>
            ) : monsters.map((monster) => (
              <button
                key={monster.id}
                type="button"
                onClick={() => selectMonster(monster.id)}
                className={`mb-1 w-full rounded-lg px-3 py-2 text-left ${selectedId === monster.id ? 'bg-arcane-500/20 text-arcane-100' : 'text-slate-300 hover:bg-white/5'}`}
              >
                <span className="block truncate text-sm font-medium">{monster.name}</span>
                <span className="block text-[11px] text-slate-500">CR {monster.challenge.rating} · AC {monster.armorClass.value} · HP {monster.hitPoints.average}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2 border-t border-white/10 p-3">
            <button type="button" onClick={() => { setSelectedId(null); setDraft(createDnd5eCustomMonsterDraft()); setMessage(null) }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-arcane-500/20 px-3 py-2 text-xs font-semibold text-arcane-100 hover:bg-arcane-500/30">
              <Plus className="h-3.5 w-3.5" /> 新建怪物
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => importRef.current?.click()} className="flex items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-2 text-xs text-slate-300 hover:bg-white/10"><Upload className="h-3.5 w-3.5" /> 导入</button>
              <button type="button" disabled={monsters.length === 0} onClick={() => downloadJson('dndstars-room-monsters.json', { schemaVersion: 1, monsters })} className="flex items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-2 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> 导出</button>
            </div>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-100">怪物工坊</h2>
              <p className="text-xs text-slate-500">表单会生成结构化 stat block，并通过 monsterSchema 后才能写入房间。</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
            {preservesAdvancedFields && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                此怪物含表单未直接展示的高级字段（如豁免、技能、感官、抗性、多段伤害、反应、传奇动作或施法）。保存时这些字段会原样保留；如需修改，请导出 JSON 后编辑并重新导入。
              </div>
            )}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">基本资料</h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <label className="text-xs text-slate-400">中文名称<input value={draft.name} onChange={(event) => patchDraft('name', event.target.value)} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">英文名称<input value={draft.englishName} onChange={(event) => patchDraft('englishName', event.target.value)} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">体型<select value={draft.size} onChange={(event) => patchDraft('size', event.target.value as Dnd5eMonsterSize)} className={`mt-1 ${inputClass()}`}>{SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
                <label className="text-xs text-slate-400">生物类型<input value={draft.creatureType} onChange={(event) => patchDraft('creatureType', event.target.value)} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">阵营<input value={draft.alignment} onChange={(event) => patchDraft('alignment', event.target.value)} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">AC<input type="number" min={1} value={draft.armorClass} onChange={(event) => patchDraft('armorClass', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">平均 HP<input type="number" min={1} value={draft.hitPointsAverage} onChange={(event) => patchDraft('hitPointsAverage', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">生命骰<input value={draft.hitPointsDice} onChange={(event) => patchDraft('hitPointsDice', event.target.value)} placeholder="2d8+2" className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">CR<input value={draft.challengeRating} onChange={(event) => patchDraft('challengeRating', event.target.value)} placeholder="1/4" className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">击杀 XP<input type="number" min={0} value={draft.xp} onChange={(event) => patchDraft('xp', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">被动察觉<input type="number" min={0} value={draft.passivePerception} onChange={(event) => patchDraft('passivePerception', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">语言<input value={draft.languages} onChange={(event) => patchDraft('languages', event.target.value)} placeholder="通用语、地精语" className={`mt-1 ${inputClass()}`} /></label>
              </div>
              <label className="mt-3 block text-xs text-slate-400">简介<textarea rows={2} value={draft.description} onChange={(event) => patchDraft('description', event.target.value)} className={`mt-1 resize-y ${inputClass()}`} /></label>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">属性与速度</h3>
              <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
                {ABILITY_LABELS.map(([key, label]) => <label key={key} className="text-xs text-slate-400">{label}<input type="number" min={1} max={30} value={draft.abilities[key]} onChange={(event) => patchDraft('abilities', { ...draft.abilities, [key]: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>)}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 lg:grid-cols-6">
                {([['walk', '步行'], ['fly', '飞行'], ['swim', '游泳'], ['climb', '攀爬'], ['burrow', '掘穴']] as const).map(([key, label]) => <label key={key} className="text-xs text-slate-400">{label}（尺）<input type="number" min={0} value={draft[key]} onChange={(event) => patchDraft(key, Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>)}
                <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={draft.hover} onChange={(event) => patchDraft('hover', event.target.checked)} className="accent-arcane-500" />悬浮</label>
              </div>
            </section>

            <section className="rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-200">自动攻击偏好与 Headless 机制</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">偏好只决定自动回合推荐目标；机制由 Host 重新校验触发条件、目标、骰子和次数。无法安全自动化的组合会明确降级为半自动或 DM 裁定。</p>
                </div>
                <button type="button" onClick={() => patchDraft('headlessMechanics', [...draft.headlessMechanics, createDnd5eCustomMonsterMechanicDraft()])} className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/25"><Plus className="h-3 w-3" /> 添加机制</button>
              </div>
              <label className="block max-w-sm text-xs text-slate-400">
                模板默认攻击目标
                <select value={draft.targetingPriority} onChange={(event) => patchDraft('targetingPriority', event.target.value as typeof draft.targetingPriority)} className={`mt-1 ${inputClass()}`}>
                  {DND5E_MONSTER_TARGET_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <span className="mt-1 block text-[11px] text-slate-500">{DND5E_MONSTER_TARGET_PRIORITY_OPTIONS.find((option) => option.value === draft.targetingPriority)?.description}</span>
              </label>
              <div className="mt-3 space-y-2">
                {draft.headlessMechanics.map((mechanic, index) => {
                  const update = (patch: Partial<typeof mechanic>) => patchDraft('headlessMechanics', draft.headlessMechanics.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
                  const preservedCompatibilityReasons = (mechanic.preservedEffects?.slice(1) ?? []).flatMap((effect) => [
                    ...(effect.kind === 'summon' ? ['高级 JSON 效果包含需要地图落点的召唤'] : []),
                    ...(effect.kind === 'area-attack' ? ['高级 JSON 效果包含需要确认覆盖范围的范围攻击'] : []),
                    ...((effect.kind === 'damage' || effect.kind === 'standard-condition') && effect.target === 'damage-source' ? ['高级 JSON 效果依赖伤害来源目标'] : []),
                    ...((effect.kind === 'damage' || effect.kind === 'standard-condition') && effect.target === 'trigger-target' && mechanic.trigger !== 'after-hit' ? ['高级 JSON 效果依赖当前触发时机没有提供的目标'] : []),
                  ])
                  const compatibilityReasons = [
                    ...(mechanic.trigger === 'after-damaged' ? ['受到伤害后的反应队列尚未覆盖所有伤害来源'] : []),
                    ...(mechanic.trigger === 'phase-transition' ? ['阶段即时切换仍需要阈值穿越事务'] : []),
                    ...(mechanic.trigger === 'after-hit' && mechanic.limit === 'unlimited' ? ['命中后无限触发需要逐次命中的独立次数账本'] : []),
                    ...(mechanic.effectKind === 'summon' ? ['需要 DM 指定合法召唤落点'] : []),
                    ...(mechanic.effectKind === 'area-attack' ? ['需要 DM 确认方向、范围格与目标'] : []),
                    ...(['damage', 'standard-condition'].includes(mechanic.effectKind) && mechanic.effectTarget === 'trigger-target' && mechanic.trigger !== 'after-hit' ? ['触发目标当前只在命中后事务中可用'] : []),
                    ...(['damage', 'standard-condition'].includes(mechanic.effectKind) && mechanic.effectTarget === 'damage-source' ? ['伤害来源目标依赖受到伤害后的反应事务'] : []),
                    ...preservedCompatibilityReasons,
                  ]
                  const validationErrors = [
                    ...(!mechanic.name.trim() ? ['机制名称不能为空'] : []),
                    ...(mechanic.hpPercentageAtOrBelow != null && (mechanic.hpPercentageAtOrBelow < 0 || mechanic.hpPercentageAtOrBelow > 100) ? ['HP 上限阈值必须是 0–100'] : []),
                    ...(mechanic.hpPercentageAtOrAbove != null && (mechanic.hpPercentageAtOrAbove < 0 || mechanic.hpPercentageAtOrAbove > 100) ? ['HP 下限阈值必须是 0–100'] : []),
                    ...(mechanic.hpPercentageAtOrBelow != null && mechanic.hpPercentageAtOrAbove != null && mechanic.hpPercentageAtOrAbove > mechanic.hpPercentageAtOrBelow ? ['HP 下限不能高于上限'] : []),
                    ...(['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind) && !/^\d+d\d+(?:\s*[+\-−]\s*\d+)?$/i.test(mechanic.healingDice) ? ['效果骰格式应为 2d6 或 1d8+2'] : []),
                    ...(mechanic.effectKind === 'standard-condition' && mechanic.durationKind === 'rounds' && mechanic.durationRounds < 1 ? ['状态持续轮数至少为 1'] : []),
                    ...(mechanic.effectKind === 'summon' && !/^(?:srd-5\.1|room-monster):[a-z0-9][a-z0-9-]{0,95}$/.test(mechanic.summonMonsterId) ? ['召唤怪物 ID 必须使用合法命名空间'] : []),
                    ...(mechanic.effectKind === 'summon' && (mechanic.summonCount < 1 || mechanic.summonCount > 20 || mechanic.summonDurationRounds < 1) ? ['召唤数量或持续轮数无效'] : []),
                    ...(mechanic.effectKind === 'area-attack' && (mechanic.areaRangeFeet < 0 || mechanic.areaSizeFeet < 5) ? ['范围距离或尺寸无效'] : []),
                  ]
                  const effectiveAutomation = mechanic.automation === 'manual'
                    ? 'manual'
                    : compatibilityReasons.length > 0 || mechanic.automation === 'partial' ? 'partial' : 'full'
                  return <div key={mechanic.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(150px,1fr),140px,105px,105px,150px,130px,auto]">
                      <label className="text-xs text-slate-400">机制名称<input value={mechanic.name} onChange={(event) => update({ name: event.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">触发时机<select value={mechanic.trigger} onChange={(event) => update({ trigger: event.target.value as typeof mechanic.trigger })} className={`mt-1 ${inputClass()}`}>{MECHANIC_TRIGGERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="text-xs text-slate-400">HP ≤（%）<input type="number" min={0} max={100} value={mechanic.hpPercentageAtOrBelow ?? ''} onChange={(event) => update({ hpPercentageAtOrBelow: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="不限" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">HP ≥（%）<input type="number" min={0} max={100} value={mechanic.hpPercentageAtOrAbove ?? ''} onChange={(event) => update({ hpPercentageAtOrAbove: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="不限" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">效果<select value={mechanic.effectKind} onChange={(event) => update({ effectKind: event.target.value as typeof mechanic.effectKind })} className={`mt-1 ${inputClass()}`}>{MECHANIC_EFFECTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="text-xs text-slate-400">期望自动化<select value={mechanic.automation} onChange={(event) => update({ automation: event.target.value as typeof mechanic.automation })} className={`mt-1 ${inputClass()}`}><option value="full">完全自动</option><option value="partial">半自动</option><option value="manual">DM 裁定</option></select></label>
                      <button type="button" title="删除机制" onClick={() => patchDraft('headlessMechanics', draft.headlessMechanics.filter((_, entryIndex) => entryIndex !== index))} className="self-end rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                      {['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind) && <label className="text-xs text-slate-400">效果骰<input value={mechanic.healingDice} onChange={(event) => update({ healingDice: event.target.value })} placeholder="2d6" className={`mt-1 ${inputClass()}`} /></label>}
                      {['damage', 'standard-condition'].includes(mechanic.effectKind) && <label className="text-xs text-slate-400">效果目标<select value={mechanic.effectTarget} onChange={(event) => update({ effectTarget: event.target.value as typeof mechanic.effectTarget })} className={`mt-1 ${inputClass()}`}><option value="self">自身</option><option value="trigger-target">命中／触发目标</option><option value="damage-source">伤害来源</option></select></label>}
                      {['damage', 'area-attack'].includes(mechanic.effectKind) && <label className="text-xs text-slate-400">伤害类型<select value={mechanic.damageType} onChange={(event) => update({ damageType: event.target.value as typeof mechanic.damageType })} className={`mt-1 ${inputClass()}`}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>}
                      {mechanic.effectKind === 'standard-condition' && <><label className="text-xs text-slate-400">标准状态<select value={mechanic.condition} onChange={(event) => update({ condition: event.target.value as typeof mechanic.condition })} className={`mt-1 ${inputClass()}`}>{Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => <option key={condition.id} value={condition.id}>{condition.label}</option>)}</select></label><label className="text-xs text-slate-400">持续时间<select value={mechanic.durationKind} onChange={(event) => update({ durationKind: event.target.value as typeof mechanic.durationKind })} className={`mt-1 ${inputClass()}`}><option value="rounds">固定轮数</option><option value="until-target-turn-start">至目标回合开始</option><option value="until-source-turn-start">至来源回合开始</option><option value="permanent">永久</option></select></label>{mechanic.durationKind === 'rounds' && <label className="text-xs text-slate-400">轮数<input type="number" min={1} value={mechanic.durationRounds} onChange={(event) => update({ durationRounds: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}</>}
                      {mechanic.effectKind === 'summon' && <><label className="text-xs text-slate-400">怪物 ID<input value={mechanic.summonMonsterId} onChange={(event) => update({ summonMonsterId: event.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">数量<input type="number" min={1} max={20} value={mechanic.summonCount} onChange={(event) => update({ summonCount: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">持续轮数<input type="number" min={1} value={mechanic.summonDurationRounds} onChange={(event) => update({ summonDurationRounds: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label></>}
                      {mechanic.effectKind === 'area-attack' && <><label className="text-xs text-slate-400">范围形状<select value={mechanic.areaShape} onChange={(event) => update({ areaShape: event.target.value as typeof mechanic.areaShape })} className={`mt-1 ${inputClass()}`}><option value="circle">圆形</option><option value="cone">锥形</option><option value="line">线形</option></select></label><label className="text-xs text-slate-400">施放距离<input type="number" min={0} value={mechanic.areaRangeFeet} onChange={(event) => update({ areaRangeFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">范围尺寸<input type="number" min={5} value={mechanic.areaSizeFeet} onChange={(event) => update({ areaSizeFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label></>}
                      <label className="text-xs text-slate-400">使用限制<select value={mechanic.limit} onChange={(event) => update({ limit: event.target.value as typeof mechanic.limit })} className={`mt-1 ${inputClass()}`}><option value="once-per-turn">每回合一次</option><option value="once-per-combat">每场战斗一次</option><option value="unlimited">满足条件即触发</option></select></label>
                      <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={mechanic.requiresPositiveHp} onChange={(event) => update({ requiresPositiveHp: event.target.checked })} className="accent-arcane-500" />仅生命值大于 0 时触发</label>
                    </div>
                    <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[11px] ${validationErrors.length > 0 ? 'border-rose-400/20 bg-rose-500/5 text-rose-200' : effectiveAutomation === 'full' ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-200' : effectiveAutomation === 'partial' ? 'border-amber-400/20 bg-amber-500/5 text-amber-200' : 'border-slate-400/15 bg-white/[0.03] text-slate-400'}`}>
                      兼容报告：{validationErrors.length > 0 ? `不能保存；${validationErrors.join('；')}` : effectiveAutomation === 'full' ? '完全 Headless 自动化' : effectiveAutomation === 'partial' ? `半自动化；${compatibilityReasons.join('；') || '内容作者要求半自动处理'}` : '由 DM 手动裁定'}
                      {(mechanic.preservedEffects?.length ?? 0) > 1 && `；高级 JSON 中另有 ${(mechanic.preservedEffects?.length ?? 1) - 1} 个效果会原样保留`}
                    </div>
                  </div>
                })}
                {draft.headlessMechanics.length === 0 && <p className="rounded-lg border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">没有自定义触发机制。点击“添加机制”可建立“生命值 50% 以下时恢复 2d6”等规则。</p>}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">特性（默认 DM 裁定）</h3><button type="button" onClick={() => patchDraft('traits', [...draft.traits, { name: '', description: '' }])} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"><Plus className="h-3 w-3" /> 添加</button></div>
              <div className="space-y-2">
                {draft.traits.map((trait, index) => <div key={index} className="grid grid-cols-[180px,minmax(0,1fr),auto] gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2"><input value={trait.name} onChange={(event) => patchDraft('traits', draft.traits.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} placeholder="特性名称" className={inputClass()} /><textarea rows={2} value={trait.description} onChange={(event) => patchDraft('traits', draft.traits.map((entry, entryIndex) => entryIndex === index ? { ...entry, description: event.target.value } : entry))} placeholder="完整规则描述" className={`${inputClass()} resize-y`} /><button type="button" onClick={() => patchDraft('traits', draft.traits.filter((_, entryIndex) => entryIndex !== index))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>)}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">动作</h3><p className="mt-1 text-[11px] text-slate-500">只有纯命中＋伤害动作应选择 Headless；带附加规则的动作请选择 DM 裁定。</p></div><button type="button" onClick={() => patchDraft('actions', [...draft.actions, createDnd5eCustomMonsterActionDraft()])} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"><Plus className="h-3 w-3" /> 添加</button></div>
              <div className="space-y-3">
                {draft.actions.map((action, index) => {
                  const update = (patch: Partial<typeof action>) => patchDraft('actions', draft.actions.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
                  return <div key={action.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5"><label className="text-xs text-slate-400">名称<input value={action.name} onChange={(event) => update({ name: event.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">类型<select value={action.kind} onChange={(event) => update({ kind: event.target.value as typeof action.kind, automation: event.target.value === 'other' ? 'dm-adjudication' : action.automation })} className={`mt-1 ${inputClass()}`}><option value="weapon-attack">武器攻击</option><option value="other">其他动作</option></select></label><label className="text-xs text-slate-400">结算<select value={action.kind === 'other' ? 'dm-adjudication' : action.automation} disabled={action.kind === 'other'} onChange={(event) => update({ automation: event.target.value as typeof action.automation })} className={`mt-1 ${inputClass()}`}><option value="headless">Headless</option><option value="dm-adjudication">DM 裁定</option></select></label>{action.kind === 'weapon-attack' && <><label className="text-xs text-slate-400">攻击方式<select value={action.mode} onChange={(event) => update({ mode: event.target.value as typeof action.mode })} className={`mt-1 ${inputClass()}`}><option value="melee">近战</option><option value="ranged">远程</option><option value="melee-or-ranged">近战或远程</option></select></label><label className="text-xs text-slate-400">每动作次数<input type="number" min={1} max={10} value={action.attacksPerAction} onChange={(event) => update({ attacksPerAction: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label></>}</div>
                    {action.kind === 'weapon-attack' && <div className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-7"><label className="text-xs text-slate-400">命中加值<input type="number" value={action.toHit} onChange={(event) => update({ toHit: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">触及<input type="number" min={0} value={action.reachFeet} onChange={(event) => update({ reachFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">正常射程<input type="number" min={0} value={action.rangeNormal} onChange={(event) => update({ rangeNormal: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">最远射程<input type="number" min={0} value={action.rangeLong} onChange={(event) => update({ rangeLong: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">伤害骰<input value={action.damageDice} onChange={(event) => update({ damageDice: event.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="col-span-2 text-xs text-slate-400">伤害类型<select value={action.damageType} onChange={(event) => update({ damageType: event.target.value as typeof action.damageType })} className={`mt-1 ${inputClass()}`}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label></div>}
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr),auto] gap-2"><textarea rows={2} value={action.description} onChange={(event) => update({ description: event.target.value })} placeholder={action.kind === 'weapon-attack' ? '可留空，系统会生成基础攻击描述；附带效果必须完整填写。' : '填写完整规则描述'} className={`${inputClass()} resize-y`} /><button type="button" onClick={() => patchDraft('actions', draft.actions.filter((_, entryIndex) => entryIndex !== index))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>
                  </div>
                })}
              </div>
            </section>
          </div>

          <footer className="flex items-center gap-3 border-t border-white/10 px-5 py-3">
            <p className={`min-w-0 flex-1 truncate text-xs ${message?.includes('已保存') || message?.includes('导入完成') ? 'text-emerald-300' : 'text-amber-300'}`}>{message ?? '高级施法、传奇动作、变形与再生可通过 JSON 导入保留；当前自动结算边界会明确标注。'}</p>
            {selectedId && <button type="button" disabled={busy} onClick={() => { if (!window.confirm('删除此房间怪物模板？地图上已存在的 Token 将保留，但失去 stat block。')) return; void removeMonster(selectedId).then(() => { setSelectedId(null); setDraft(createDnd5eCustomMonsterDraft()); setMessage('已删除怪物模板。') }) }} className="flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"><Trash2 className="h-3.5 w-3.5" /> 删除</button>}
            <button type="button" disabled={busy} onClick={() => void save()} className="flex items-center gap-2 rounded-lg bg-arcane-500 px-4 py-2 text-sm font-semibold text-white hover:bg-arcane-400 disabled:opacity-50"><Save className="h-4 w-4" />{busy ? '处理中…' : '校验并保存'}</button>
          </footer>
        </main>
      </div>
    </div>
  )
}
