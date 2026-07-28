import { useRef, useState } from 'react'
import { ClipboardPaste, Download, ImagePlus, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useCustomMonsterStore } from '../../store/customMonsters'
import {
  DND5E_DAMAGE_TYPES,
  buildDnd5eCustomMonster,
  createDnd5eCustomMonsterActionDraft,
  createDnd5eCustomMonsterMechanicDraft,
  createDnd5eCustomMonsterTraitDraft,
  createDnd5eCustomMonsterDraft,
  dnd5eCustomMonsterDraftFromStatBlock,
  type Dnd5eCustomMonsterDraft,
} from '../../rulesets/dnd5e/customMonsterWorkshop'
import type { AbilityKey } from '../../lib/dnd'
import type { Dnd5eMonsterSize } from '../../rulesets/dnd5e/monsters'
import type { Dnd5eMonsterStatBlock } from '../../rulesets/dnd5e/monsters'
import { parseDnd5eMonsterStatBlock } from '../../rulesets/dnd5e/monsterSchema'
import { DND5E_MONSTER_TARGET_PRIORITY_OPTIONS } from '../../rulesets/dnd5e/monsterAutomation'
import { DND5E_STANDARD_CONDITIONS } from '../../rulesets/dnd5e/conditions'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { DND5E_DAMAGE_TYPE_LABELS } from '../../rulesets/dnd5e/damageTypes'
import {
  parseDnd5ePastedMonster,
  type Dnd5ePastedMonsterParseResult,
} from '../../rulesets/dnd5e/monsterStatBlockPaste'
import { DND5E_SRD_SPELL_CATALOG } from '../../rulesets/dnd5e/spellCatalog'
import {
  parseDnd5eFeatureMechanicText,
  parseDnd5eSpellListText,
} from '../../rulesets/dnd5e/monsterContentAutoParser'

const ABILITY_LABELS: readonly [AbilityKey, string][] = [
  ['str', '力量'], ['dex', '敏捷'], ['con', '体质'], ['int', '智力'], ['wis', '感知'], ['cha', '魅力'],
]
const SIZES: Dnd5eMonsterSize[] = ['微型', '小型', '中型', '大型', '超大型', '巨型']
const SPELL_CATALOG_BY_ID = new Map(DND5E_SRD_SPELL_CATALOG.map((spell) => [spell.id, spell]))
const SPELL_CATALOG_BY_LEVEL = Array.from({ length: 10 }, (_, level) =>
  DND5E_SRD_SPELL_CATALOG.filter((spell) => spell.level === level))
const MECHANIC_TRIGGERS = [
  ['turn-start', '回合开始'], ['turn-end', '回合结束'], ['after-hit', '攻击命中后'],
  ['after-miss', '攻击未命中时'], ['when-hit', '被命中时'], ['after-damaged', '受到伤害后'],
  ['after-dealt-damage', '造成伤害后（攻击／法术／其他伤害）'],
  ['saving-throw-magic', '对抗魔法的豁免时'], ['saving-throw-physical', '对抗物理的豁免时'],
  ['movement', '移动指定距离时'], ['phase-transition', '阶段转换'],
] as const
const MECHANIC_EFFECTS = [
  ['healing', '恢复生命'], ['temporary-hit-points', '获得临时生命'], ['damage', '造成伤害'],
  ['roll-modifier', '获得加值／优势／劣势'], ['attack', '发动一次攻击'],
  ['standard-condition', '施加标准状态'], ['remove-standard-condition', '移除标准状态'],
  ['summon', '召唤生物'], ['area-attack', '范围攻击'],
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

interface Props {
  open: boolean
  onClose: () => void
  /** 传入后进入插件受控模式；未传入时沿用房间共享怪物目录。 */
  monsters?: readonly Dnd5eMonsterStatBlock[]
  onMonstersChange?: (monsters: Dnd5eMonsterStatBlock[]) => void
  context?: 'room' | 'plugin'
}

export default function Dnd5eMonsterWorkshopDialog({
  open,
  onClose,
  monsters: controlledMonsters,
  onMonstersChange,
  context = 'room',
}: Props) {
  const roomMonsters = useCustomMonsterStore((state) => state.monsters)
  const upsertRoomMonster = useCustomMonsterStore((state) => state.upsertMonster)
  const importRoomMonsters = useCustomMonsterStore((state) => state.importMonsters)
  const removeRoomMonster = useCustomMonsterStore((state) => state.removeMonster)
  const monsters = controlledMonsters ? [...controlledMonsters] : roomMonsters
  const pluginMode = context === 'plugin' && !!onMonstersChange
  const [draft, setDraft] = useState<Dnd5eCustomMonsterDraft>(() => createDnd5eCustomMonsterDraft())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [pasteResult, setPasteResult] = useState<Dnd5ePastedMonsterParseResult>()
  const [pasteError, setPasteError] = useState<string>()
  const [featureParseText, setFeatureParseText] = useState('')
  const [spellParseText, setSpellParseText] = useState('')
  const importRef = useRef<HTMLInputElement>(null)
  const tokenPortraitRef = useRef<HTMLInputElement>(null)
  const initiativePortraitRef = useRef<HTMLInputElement>(null)
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

  const uploadPortrait = async (kind: 'tokenPortrait' | 'initiativePortrait', file?: File) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      patchDraft(kind, await createCharacterPortraitDataUrl(file))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
      if (kind === 'tokenPortrait' && tokenPortraitRef.current) tokenPortraitRef.current.value = ''
      if (kind === 'initiativePortrait' && initiativePortraitRef.current) initiativePortraitRef.current.value = ''
    }
  }

  const analyzePastedMonster = () => {
    setPasteError(undefined)
    try {
      setPasteResult(parseDnd5ePastedMonster(pastedText))
    } catch (error) {
      setPasteResult(undefined)
      setPasteError(error instanceof Error ? error.message : String(error))
    }
  }

  const applyPastedMonster = () => {
    if (!pasteResult) return
    setSelectedId(null)
    setDraft(pasteResult.draft)
    setMessage(`已自动填写 ${pasteResult.recognizedFields.length} 类字段；保存前请核对标记为手动裁定的复杂能力。`)
    setPasteOpen(false)
    setPasteResult(undefined)
    setPasteError(undefined)
  }

  const parseFeature = () => {
    const result = parseDnd5eFeatureMechanicText(featureParseText)
    if (!result.mechanic) {
      setMessage(result.warnings.join('；'))
      return
    }
    patchDraft('headlessMechanics', [...draft.headlessMechanics, result.mechanic])
    setFeatureParseText('')
    setMessage(result.warnings.length > 0
      ? `已解析特性，但仍需核对：${result.warnings.join('；')}`
      : `已将“${result.mechanic.name}”转换为 Headless 机制。`)
  }

  const parseSpells = () => {
    const result = parseDnd5eSpellListText(spellParseText)
    if (result.spells.length === 0) {
      setMessage(result.unknown.length > 0 ? `未在 SRD 5.1 中识别：${result.unknown.join('、')}` : '请先粘贴法术名称。')
      return
    }
    const byId = new Map(draft.spells.map((spell) => [spell.id, spell]))
    for (const spell of result.spells) byId.set(spell.id, spell)
    patchDraft('spells', [...byId.values()])
    patchDraft('spellcastingEnabled', true)
    setSpellParseText('')
    setMessage(`已识别 ${result.spells.length} 个 SRD 5.1 法术${result.unknown.length > 0 ? `；未识别：${result.unknown.join('、')}` : ''}。`)
  }

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const monster = buildDnd5eCustomMonster(draft)
      if (pluginMode) {
        const nextMonsters = [
          ...monsters.filter((entry) => entry.id !== monster.id && entry.slug !== monster.slug),
          monster,
        ].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
        if (nextMonsters.length > 128) throw new Error('单个扩展最多包含 128 个怪物模板。')
        onMonstersChange(nextMonsters)
      } else {
        await upsertRoomMonster(monster)
      }
      setSelectedId(monster.id)
      setDraft(dnd5eCustomMonsterDraftFromStatBlock(monster))
      setMessage(pluginMode
        ? `已将“${monster.name}”加入扩展草稿。`
        : `已保存“${monster.name}”，房间内玩家会自动同步。`)
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
      if (pluginMode) {
        const parsedEntries = entries.map((entry) => {
          const parsed = parseDnd5eMonsterStatBlock(entry)
          if (!parsed.ok || parsed.value.source !== 'DM 自定义') {
            throw new Error(parsed.ok ? '插件怪物必须标记为 DM 自定义' : parsed.issues[0]?.message ?? '怪物格式无效')
          }
          return parsed.value
        })
        const byId = new Map(monsters.map((monster) => [monster.id, monster]))
        let added = 0
        let replaced = 0
        for (const monster of parsedEntries) {
          if (byId.has(monster.id)) replaced += 1
          else added += 1
          byId.set(monster.id, monster)
        }
        if (byId.size > 128) throw new Error('单个扩展最多包含 128 个怪物模板。')
        onMonstersChange([...byId.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')))
        setMessage(`导入完成：新增 ${added}，替换 ${replaced}。`)
      } else {
        const result = await importRoomMonsters(entries)
        setMessage(`导入完成：新增 ${result.added}，替换 ${result.replaced}。`)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div
        data-testid="monster-workshop-dialog"
        className="glass grid h-[94vh] max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl grid-cols-[240px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-black/15">
          <div className="border-b border-white/10 p-3">
            <p className="font-semibold text-slate-100">{pluginMode ? '扩展怪物' : '房间怪物'}</p>
            <p className="mt-1 text-xs text-slate-500">{monsters.length} / {pluginMode ? 128 : 512} 个自定义模板</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {monsters.length === 0 ? (
              <p className="px-2 py-8 text-center text-xs leading-relaxed text-slate-500">
                {pluginMode ? '尚无扩展怪物。保存后会进入当前插件草稿。' : '尚无自定义怪物。保存后会同步给本房间玩家。'}
              </p>
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
              <button type="button" disabled={monsters.length === 0} onClick={() => downloadJson(pluginMode ? 'dndstars-plugin-monsters.json' : 'dndstars-room-monsters.json', { schemaVersion: 1, monsters })} className="flex items-center justify-center gap-1 rounded-lg bg-white/5 px-2 py-2 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40"><Download className="h-3.5 w-3.5" /> 导出</button>
            </div>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-100">怪物工坊</h2>
              <p className="text-xs text-slate-500">表单会生成结构化 stat block，并通过 monsterSchema 后才能{pluginMode ? '写入扩展' : '写入房间'}。</p>
            </div>
            <button
              type="button"
              onClick={() => setPasteOpen((current) => !current)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              粘贴自动填写
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
          </header>

          <div
            data-testid="monster-workshop-scroll-region"
            className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-5 [scrollbar-gutter:stable]"
          >
            {pasteOpen && (
              <section
                data-testid="monster-stat-block-paste"
                className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.05] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-cyan-100">粘贴 D&D 5e 怪物属性块</h3>
                    <p className="mt-1 text-xs leading-5 text-cyan-100/60">
                      支持 monsterSchema JSON，以及常见中英文属性块。解析只会生成声明式数据，不会执行粘贴内容中的代码。
                    </p>
                  </div>
                  <button type="button" onClick={() => setPasteOpen(false)} className="rounded-lg p-1.5 text-cyan-100/60 hover:bg-white/5 hover:text-cyan-100"><X className="h-4 w-4" /></button>
                </div>
                <textarea
                  data-testid="monster-stat-block-paste-input"
                  rows={12}
                  value={pastedText}
                  onChange={(event) => {
                    setPastedText(event.target.value)
                    setPasteResult(undefined)
                    setPasteError(undefined)
                  }}
                  placeholder={'例如：\nGoblin\nSmall humanoid (goblinoid), neutral evil\nArmor Class 15\nHit Points 7 (2d6)\nSpeed 30 ft.\n…'}
                  className={`mt-3 resize-y font-mono text-xs leading-5 ${inputClass()}`}
                />
                {pasteError && <p className="mt-2 text-xs text-rose-300">{pasteError}</p>}
                {pasteResult && (
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-xs">
                    <p className="font-semibold text-emerald-200">
                      已识别：{pasteResult.recognizedFields.join('、') || '无'}
                    </p>
                    <p className="mt-1 text-slate-400">
                      预览：{pasteResult.draft.name} · AC {pasteResult.draft.armorClass} · HP {pasteResult.draft.hitPointsAverage}
                      {' '}· CR {pasteResult.draft.challengeRating} · {pasteResult.draft.actions.length} 个动作
                    </p>
                    {pasteResult.warnings.length > 0 && (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-200">
                        {pasteResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    )}
                  </div>
                )}
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" onClick={analyzePastedMonster} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
                    分析并预览
                  </button>
                  <button
                    type="button"
                    disabled={!pasteResult}
                    onClick={applyPastedMonster}
                    className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    覆盖当前表单
                  </button>
                </div>
              </section>
            )}
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
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {([
                  ['tokenPortrait', '地图 Token', tokenPortraitRef],
                  ['initiativePortrait', '先攻立绘', initiativePortraitRef],
                ] as const).map(([key, label, ref]) => (
                  <div key={key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                    <div className={`overflow-hidden border border-white/10 bg-void-950 ${key === 'tokenPortrait' ? 'h-20 w-20 rounded-full' : 'h-24 w-20 rounded-lg'}`}>
                      {draft[key] ? <img src={draft[key]} alt={label} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-600"><ImagePlus className="h-5 w-5" /></div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-200">{label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">PNG、JPG 或 WebP，保存时压缩并随房间同步。</p>
                      <div className="mt-2 flex gap-2">
                        <button type="button" disabled={busy} onClick={() => ref.current?.click()} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10">上传</button>
                        {draft[key] && <button type="button" onClick={() => patchDraft(key, undefined)} className="rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10">移除</button>}
                      </div>
                      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void uploadPortrait(key, event.target.files?.[0])} />
                    </div>
                  </div>
                ))}
              </div>
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

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">防御、豁免、技能与感官</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <label className="text-xs text-slate-400">护甲说明<input value={draft.armorClassNote} onChange={(event) => patchDraft('armorClassNote', event.target.value)} placeholder="天然护甲、链甲与盾牌" className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">传奇抗性（每日）<input type="number" min={0} max={99} value={draft.legendaryResistanceUses} onChange={(event) => patchDraft('legendaryResistanceUses', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">传奇动作点<input type="number" min={0} max={99} value={draft.legendaryActionPoints} onChange={(event) => patchDraft('legendaryActionPoints', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                <label className="text-xs text-slate-400">巢穴动作先攻值<input type="number" min={0} max={99} value={draft.lairInitiative} onChange={(event) => patchDraft('lairInitiative', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
              </div>
              <p className="mt-3 text-[11px] font-semibold text-slate-500">豁免加值（留空表示不熟练）</p>
              <div className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-6">
                {ABILITY_LABELS.map(([key, label]) => <label key={key} className="text-xs text-slate-400">{label}<input type="number" value={draft.savingThrows[key] ?? ''} onChange={(event) => patchDraft('savingThrows', { ...draft.savingThrows, [key]: event.target.value === '' ? undefined : Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>)}
              </div>
              {([
                ['damageVulnerabilities', '伤害易伤'],
                ['damageResistances', '伤害抗性'],
                ['damageImmunities', '伤害免疫'],
              ] as const).map(([key, label]) => (
                <div key={key} className="mt-3">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {DND5E_DAMAGE_TYPES.map((type) => {
                      const checked = draft[key].includes(type)
                      return <button key={type} type="button" onClick={() => patchDraft(key, checked ? draft[key].filter((entry) => entry !== type) : [...draft[key], type])} className={`rounded-full border px-2 py-1 text-[11px] ${checked ? 'border-arcane-400/40 bg-arcane-500/15 text-arcane-100' : 'border-white/10 text-slate-500 hover:bg-white/5'}`}>{DND5E_DAMAGE_TYPE_LABELS[type]}</button>
                    })}
                  </div>
                </div>
              ))}
              <div className="mt-3">
                <p className="text-[11px] font-semibold text-slate-500">状态免疫</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => {
                    const checked = draft.conditionImmunities.includes(condition.id)
                    return <button key={condition.id} type="button" onClick={() => patchDraft('conditionImmunities', checked ? draft.conditionImmunities.filter((entry) => entry !== condition.id) : [...draft.conditionImmunities, condition.id])} className={`rounded-full border px-2 py-1 text-[11px] ${checked ? 'border-arcane-400/40 bg-arcane-500/15 text-arcane-100' : 'border-white/10 text-slate-500 hover:bg-white/5'}`}>{condition.label}</button>
                  })}
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-300">技能</p><button type="button" onClick={() => patchDraft('skills', [...draft.skills, { id: `skill-${Date.now()}`, key: '', name: '', bonus: 0 }])} className="text-xs text-arcane-200">+ 添加</button></div>
                  <div className="mt-2 space-y-2">{draft.skills.map((skill, index) => <div key={skill.id} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2"><input value={skill.key} onChange={(event) => patchDraft('skills', draft.skills.map((entry, i) => i === index ? { ...entry, key: event.target.value } : entry))} placeholder="stealth" className={inputClass()} /><input value={skill.name} onChange={(event) => patchDraft('skills', draft.skills.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} placeholder="隐匿" className={inputClass()} /><input type="number" value={skill.bonus} onChange={(event) => patchDraft('skills', draft.skills.map((entry, i) => i === index ? { ...entry, bonus: Number(event.target.value) } : entry))} className={inputClass()} /><button type="button" onClick={() => patchDraft('skills', draft.skills.filter((_, i) => i !== index))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
                </div>
                <div>
                  <div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-300">特殊感官</p><button type="button" onClick={() => patchDraft('senses', [...draft.senses, { id: `sense-${Date.now()}`, name: '黑暗视觉', distanceFeet: 60 }])} className="text-xs text-arcane-200">+ 添加</button></div>
                  <div className="mt-2 space-y-2">{draft.senses.map((sense, index) => <div key={sense.id} className="grid grid-cols-[1fr_100px_auto] gap-2"><input value={sense.name} onChange={(event) => patchDraft('senses', draft.senses.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} placeholder="黑暗视觉" className={inputClass()} /><input type="number" min={0} value={sense.distanceFeet ?? ''} onChange={(event) => patchDraft('senses', draft.senses.map((entry, i) => i === index ? { ...entry, distanceFeet: event.target.value === '' ? undefined : Number(event.target.value) } : entry))} placeholder="尺" className={inputClass()} /><button type="button" onClick={() => patchDraft('senses', draft.senses.filter((_, i) => i !== index))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">装备与武器</h3><p className="mt-1 text-[11px] text-slate-500">武器可关联到一个结构化攻击动作；护甲信息会保留在 Stat Block 中。</p></div><button type="button" onClick={() => patchDraft('equipment', [...draft.equipment, { id: `equipment-${Date.now()}`, name: '', category: 'weapon', quantity: 1, description: '', linkedActionId: '' }])} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300"><Plus className="h-3 w-3" /> 添加装备</button></div>
              <div className="mt-3 space-y-2">{draft.equipment.map((item, index) => {
                const update = (patch: Partial<typeof item>) => patchDraft('equipment', draft.equipment.map((entry, i) => i === index ? { ...entry, ...patch } : entry))
                return <div key={item.id} className="rounded-xl border border-white/10 bg-black/10 p-3"><div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_150px_90px_110px_1fr_auto]"><input value={item.name} onChange={(event) => update({ name: event.target.value })} placeholder="长剑" className={inputClass()} /><select value={item.category} onChange={(event) => update({ category: event.target.value as typeof item.category })} className={inputClass()}><option value="weapon">武器</option><option value="armor">护甲</option><option value="shield">盾牌</option><option value="gear">装备</option><option value="consumable">消耗品</option><option value="other">其他</option></select><input type="number" min={1} value={item.quantity} onChange={(event) => update({ quantity: Number(event.target.value) })} title="数量" className={inputClass()} /><input type="number" min={0} value={item.armorClass ?? ''} onChange={(event) => update({ armorClass: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="AC" className={inputClass()} /><select value={item.linkedActionId} onChange={(event) => update({ linkedActionId: event.target.value })} className={inputClass()}><option value="">不关联动作</option>{draft.actions.filter((action) => action.category === 'action').map((action) => <option key={action.id} value={action.id}>{action.name || action.id}</option>)}</select><button type="button" onClick={() => patchDraft('equipment', draft.equipment.filter((_, i) => i !== index))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div><textarea value={item.description} onChange={(event) => update({ description: event.target.value })} rows={1} placeholder="装备说明、魔法加值或特殊用途" className={`mt-2 resize-y ${inputClass()}`} /></div>
              })}</div>
            </section>

            <section className="rounded-xl border border-sky-400/15 bg-sky-500/[0.035] p-4">
              <div className="flex items-center justify-between gap-3"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-sky-200">施法</h3><p className="mt-1 text-[11px] text-slate-500">可配置法术位、随意法术和每日法术；具体法术能否 Headless 仍由法术目录兼容性决定。</p></div><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={draft.spellcastingEnabled} onChange={(event) => patchDraft('spellcastingEnabled', event.target.checked)} />启用施法</label></div>
              {draft.spellcastingEnabled && <>
                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-5">
                  <label className="text-xs text-slate-400">施法者等级<input type="number" min={1} max={30} value={draft.spellcastingCasterLevel} onChange={(event) => patchDraft('spellcastingCasterLevel', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                  <label className="text-xs text-slate-400">施法属性<select value={draft.spellcastingAbility} onChange={(event) => patchDraft('spellcastingAbility', event.target.value as AbilityKey)} className={`mt-1 ${inputClass()}`}>{ABILITY_LABELS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className="text-xs text-slate-400">法术豁免 DC<input type="number" min={1} value={draft.spellcastingSaveDc} onChange={(event) => patchDraft('spellcastingSaveDc', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                  <label className="text-xs text-slate-400">法术攻击加值<input type="number" value={draft.spellcastingAttackBonus} onChange={(event) => patchDraft('spellcastingAttackBonus', Number(event.target.value))} className={`mt-1 ${inputClass()}`} /></label>
                  <label className="text-xs text-slate-400">期望自动化<select value={draft.spellcastingAutomation} onChange={(event) => patchDraft('spellcastingAutomation', event.target.value as typeof draft.spellcastingAutomation)} className={`mt-1 ${inputClass()}`}><option value="headless">Headless</option><option value="dm-adjudication">DM 裁定</option></select></label>
                </div>
                <label className="mt-2 block text-xs text-slate-400">施法说明<textarea rows={2} value={draft.spellcastingDescription} onChange={(event) => patchDraft('spellcastingDescription', event.target.value)} className={`mt-1 resize-y ${inputClass()}`} /></label>
                <p className="mt-3 text-[11px] font-semibold text-slate-500">1–9 环法术位</p>
                <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-9">{Array.from({ length: 9 }, (_, index) => String(index + 1)).map((level) => <label key={level} className="text-center text-[10px] text-slate-500">{level} 环<input type="number" min={0} max={99} value={draft.spellSlots[level] ?? 0} onChange={(event) => patchDraft('spellSlots', { ...draft.spellSlots, [level]: Number(event.target.value) })} className={`mt-1 text-center ${inputClass()}`} /></label>)}</div>
                <div className="mt-3 rounded-xl border border-sky-400/10 bg-black/10 p-3">
                  <p className="text-xs font-semibold text-sky-100">粘贴法术名称自动识别</p>
                  <p className="mt-1 text-[11px] text-slate-500">支持中文名、英文名或 ID，以逗号、顿号或换行分隔；只会导入 SRD 5.1 目录中可确认的法术。</p>
                  <div className="mt-2 flex gap-2">
                    <textarea value={spellParseText} onChange={(event) => setSpellParseText(event.target.value)} rows={2} placeholder="例如：火球术、护盾术、Fire Bolt" className={`resize-y ${inputClass()}`} />
                    <button type="button" onClick={parseSpells} className="shrink-0 rounded-lg bg-sky-500/15 px-3 text-xs font-semibold text-sky-100 hover:bg-sky-500/25">识别并加入</button>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-300">法术列表</p><p className="mt-0.5 text-[11px] text-slate-500">从 SRD 5.1 法术目录选择，名称和环级会自动填写。</p></div><button type="button" onClick={() => patchDraft('spells', [...draft.spells, { id: '', name: '', level: 0, usageKind: 'slots', usageMax: 1 }])} className="text-xs text-sky-200">+ 添加法术</button></div>
                <div className="mt-2 space-y-2">{draft.spells.map((spell, index) => {
                  const update = (patch: Partial<typeof spell>) => patchDraft('spells', draft.spells.map((entry, i) => i === index ? { ...entry, ...patch } : entry))
                  const catalogSpell = SPELL_CATALOG_BY_ID.get(spell.id)
                  return <div key={`${spell.id}:${index}`} className="grid grid-cols-2 gap-2 rounded-xl border border-white/8 bg-black/10 p-2 lg:grid-cols-[minmax(260px,2fr)_minmax(140px,1fr)_140px_100px_auto]">
                    <select
                      aria-label={`法术选择 ${index + 1}`}
                      value={spell.id}
                      onChange={(event) => {
                        const selected = SPELL_CATALOG_BY_ID.get(event.target.value)
                        update(selected
                          ? { id: selected.id, name: selected.name, level: selected.level }
                          : { id: '', name: '', level: 0 })
                      }}
                      className={inputClass()}
                    >
                      <option value="">选择法术…</option>
                      {spell.id && !catalogSpell && <option value={spell.id}>自定义／插件：{spell.name || spell.id}</option>}
                      {SPELL_CATALOG_BY_LEVEL.map((spells, level) => (
                        <optgroup key={level} label={level === 0 ? '戏法' : `${level} 环法术`}>
                          {spells.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.name} · {entry.englishName}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div className="flex items-center rounded-lg border border-white/8 bg-void-950/50 px-3 text-xs text-slate-400">
                      {catalogSpell ? `${catalogSpell.name} · ${catalogSpell.level === 0 ? '戏法' : `${catalogSpell.level} 环`}` : spell.name || '尚未选择'}
                    </div>
                    <select aria-label={`法术使用方式 ${index + 1}`} value={spell.usageKind} onChange={(event) => update({ usageKind: event.target.value as typeof spell.usageKind })} className={inputClass()}><option value="slots">消耗法术位</option><option value="at-will">随意</option><option value="per-day">每日 N 次</option></select>
                    {spell.usageKind === 'per-day' ? <input aria-label={`每日次数 ${index + 1}`} type="number" min={1} max={99} value={spell.usageMax} onChange={(event) => update({ usageMax: Number(event.target.value) })} title="每日次数" className={inputClass()} /> : <div />}
                    <button type="button" aria-label={`删除法术 ${index + 1}`} onClick={() => patchDraft('spells', draft.spells.filter((_, i) => i !== index))} className="text-rose-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                })}</div>
              </>}
            </section>

            <section className="rounded-xl border border-violet-400/15 bg-violet-500/[0.04] p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-violet-200">自定义特性链与 Headless 机制</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">已有特性模板在下方“特性”中选择；这里创建“监听对象 → 触发时机 → 条件 → 效果 → 数值”的自定义规则。Host 会重新校验目标、骰子和次数，尚无权威事件的组合会明确降级为半自动。</p>
                </div>
                <button type="button" onClick={() => patchDraft('headlessMechanics', [...draft.headlessMechanics, createDnd5eCustomMonsterMechanicDraft()])} className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-500/15 px-2 py-1 text-xs text-violet-100 hover:bg-violet-500/25"><Plus className="h-3 w-3" /> 添加自定义特性</button>
              </div>
              <div className="mb-3 rounded-xl border border-violet-400/10 bg-black/10 p-3">
                <p className="text-xs font-semibold text-violet-100">粘贴特性自动解析</p>
                <p className="mt-1 text-[11px] text-slate-500">目前可靠支持固定生命阈值、造成／受到伤害后、额外伤害骰与继承伤害类型；无法确定的规则不会被静默自动化。</p>
                <div className="mt-2 flex gap-2">
                  <textarea value={featureParseText} onChange={(event) => setFeatureParseText(event.target.value)} rows={3} placeholder="不退斗志：当他的血量低于 10 时，他造成的所有伤害获得额外 1d6 的加值。" className={`resize-y ${inputClass()}`} />
                  <button type="button" onClick={parseFeature} className="shrink-0 rounded-lg bg-violet-500/15 px-3 text-xs font-semibold text-violet-100 hover:bg-violet-500/25">解析为机制</button>
                </div>
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
                    ...(mechanic.trigger === 'phase-transition' ? ['阶段即时切换仍需要阈值穿越事务'] : []),
                    ...(mechanic.effectKind === 'summon' ? ['需要 DM 指定合法召唤落点'] : []),
                    ...(mechanic.effectKind === 'area-attack' ? ['需要 DM 确认方向、范围格与目标'] : []),
                    ...(['damage', 'standard-condition', 'remove-standard-condition', 'roll-modifier', 'attack'].includes(mechanic.effectKind) && mechanic.effectTarget === 'trigger-target' && !['after-hit', 'after-miss', 'when-hit', 'after-dealt-damage'].includes(mechanic.trigger) ? ['该触发时机没有可绑定的目标'] : []),
                    ...(['damage', 'standard-condition', 'remove-standard-condition', 'roll-modifier', 'attack'].includes(mechanic.effectKind) && mechanic.effectTarget === 'damage-source' && mechanic.trigger !== 'after-damaged' ? ['伤害来源只存在于受到伤害后的事件'] : []),
                    ...preservedCompatibilityReasons,
                  ]
                  const validationErrors = [
                    ...(!mechanic.name.trim() ? ['机制名称不能为空'] : []),
                    ...(mechanic.hpPercentageAtOrBelow != null && (mechanic.hpPercentageAtOrBelow < 0 || mechanic.hpPercentageAtOrBelow > 100) ? ['HP 上限阈值必须是 0–100'] : []),
                    ...(mechanic.hpPercentageAtOrAbove != null && (mechanic.hpPercentageAtOrAbove < 0 || mechanic.hpPercentageAtOrAbove > 100) ? ['HP 下限阈值必须是 0–100'] : []),
                    ...(mechanic.hpPercentageAtOrBelow != null && mechanic.hpPercentageAtOrAbove != null && mechanic.hpPercentageAtOrAbove > mechanic.hpPercentageAtOrBelow ? ['HP 下限不能高于上限'] : []),
                    ...(mechanic.damageType === 'inherit-trigger' && !['after-dealt-damage', 'after-damaged'].includes(mechanic.trigger) ? ['继承伤害类型只能用于造成伤害后或受到伤害后'] : []),
                    ...(mechanic.triggerSubject !== 'self' && (!Number.isFinite(mechanic.triggerRadiusFeet) || mechanic.triggerRadiusFeet < 5) ? ['监听半径至少为 5 尺'] : []),
                    ...(mechanic.triggerSubject === 'self' && mechanic.effectTarget === 'selected-subject' ? ['监听自身时请将效果目标直接选择为“怪物自身”'] : []),
                    ...(mechanic.trigger === 'movement' && (!Number.isFinite(mechanic.movementFeet) || mechanic.movementFeet < 0) ? ['移动距离不能小于 0 尺'] : []),
                    ...((['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind) || (mechanic.effectKind === 'attack' && mechanic.attackDamageMode === 'dice')) && !/^\d+d\d+(?:\s*[+\-−]\s*\d+)?$/i.test(mechanic.healingDice) ? ['效果骰格式应为 2d6 或 1d8+2'] : []),
                    ...(mechanic.effectKind === 'attack' && mechanic.attackDamageMode === 'fixed' && (!Number.isFinite(mechanic.attackFixedDamage) || mechanic.attackFixedDamage < 0) ? ['固定伤害不能小于 0'] : []),
                    ...(mechanic.effectKind === 'standard-condition' && mechanic.durationKind === 'rounds' && mechanic.durationRounds < 1 ? ['状态持续轮数至少为 1'] : []),
                    ...(mechanic.effectKind === 'summon' && !/^(?:srd-5\.1|room-monster):[a-z0-9][a-z0-9-]{0,95}$/.test(mechanic.summonMonsterId) ? ['召唤怪物 ID 必须使用合法命名空间'] : []),
                    ...(mechanic.effectKind === 'summon' && (mechanic.summonCount < 1 || mechanic.summonCount > 20 || mechanic.summonDurationRounds < 1) ? ['召唤数量或持续轮数无效'] : []),
                    ...(mechanic.effectKind === 'area-attack' && (mechanic.areaRangeFeet < 0 || mechanic.areaSizeFeet < 5) ? ['范围距离或尺寸无效'] : []),
                  ]
                  const effectiveAutomation = mechanic.automation === 'manual'
                    ? 'manual'
                    : compatibilityReasons.length > 0 || mechanic.automation === 'partial' ? 'partial' : 'full'
                  return <div key={mechanic.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(150px,1fr),140px,140px,105px,105px,150px,130px,auto]">
                      <label className="text-xs text-slate-400">机制名称<input value={mechanic.name} onChange={(event) => update({ name: event.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">监听对象<select value={mechanic.triggerSubject} onChange={(event) => update({ triggerSubject: event.target.value as typeof mechanic.triggerSubject })} className={`mt-1 ${inputClass()}`}><option value="self">自身</option><option value="ally-within">指定范围内友方</option><option value="hostile-within">指定范围内敌方</option></select></label>
                      <label className="text-xs text-slate-400">触发时机<select value={mechanic.trigger} onChange={(event) => update({ trigger: event.target.value as typeof mechanic.trigger })} className={`mt-1 ${inputClass()}`}>{MECHANIC_TRIGGERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="text-xs text-slate-400">HP ≤（%）<input type="number" min={0} max={100} value={mechanic.hpPercentageAtOrBelow ?? ''} onChange={(event) => update({ hpPercentageAtOrBelow: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="不限" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">HP ≥（%）<input type="number" min={0} max={100} value={mechanic.hpPercentageAtOrAbove ?? ''} onChange={(event) => update({ hpPercentageAtOrAbove: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="不限" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">当前 HP ＜<input type="number" min={0} value={mechanic.hpBelow ?? ''} onChange={(event) => update({ hpBelow: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="不限" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">当前 HP ≤<input type="number" min={0} value={mechanic.hpAtOrBelow ?? ''} onChange={(event) => update({ hpAtOrBelow: event.target.value === '' ? undefined : Number(event.target.value) })} placeholder="不限" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">效果<select value={mechanic.effectKind} onChange={(event) => update({ effectKind: event.target.value as typeof mechanic.effectKind })} className={`mt-1 ${inputClass()}`}>{MECHANIC_EFFECTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                      <label className="text-xs text-slate-400">期望自动化<select value={mechanic.automation} onChange={(event) => update({ automation: event.target.value as typeof mechanic.automation })} className={`mt-1 ${inputClass()}`}><option value="full">完全自动</option><option value="partial">半自动</option><option value="manual">DM 裁定</option></select></label>
                      <button type="button" title="删除机制" onClick={() => patchDraft('headlessMechanics', draft.headlessMechanics.filter((_, entryIndex) => entryIndex !== index))} className="self-end rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                      {mechanic.triggerSubject !== 'self' && <label className="text-xs text-slate-400">监听半径（尺）<input type="number" min={5} step={5} value={mechanic.triggerRadiusFeet} onChange={(event) => update({ triggerRadiusFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}
                      {mechanic.trigger === 'movement' && <><label className="text-xs text-slate-400">移动条件<select value={mechanic.movementComparison} onChange={(event) => update({ movementComparison: event.target.value as typeof mechanic.movementComparison })} className={`mt-1 ${inputClass()}`}><option value="at-least">至少</option><option value="at-most">至多</option></select></label><label className="text-xs text-slate-400">移动距离（尺）<input type="number" min={0} step={5} value={mechanic.movementFeet} onChange={(event) => update({ movementFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label></>}
                      {mechanic.effectKind === 'attack' && <label className="text-xs text-slate-400">伤害填写方式<select value={mechanic.attackDamageMode} onChange={(event) => update({ attackDamageMode: event.target.value as typeof mechanic.attackDamageMode })} className={`mt-1 ${inputClass()}`}><option value="dice">伤害骰</option><option value="fixed">固定点数</option></select></label>}
                      {(['healing', 'temporary-hit-points', 'damage', 'area-attack'].includes(mechanic.effectKind) || (mechanic.effectKind === 'attack' && mechanic.attackDamageMode === 'dice')) && <label className="text-xs text-slate-400">{mechanic.effectKind === 'attack' ? '攻击伤害骰' : '效果骰'}<input value={mechanic.healingDice} onChange={(event) => update({ healingDice: event.target.value })} placeholder="2d6" className={`mt-1 ${inputClass()}`} /></label>}
                      {mechanic.effectKind === 'attack' && mechanic.attackDamageMode === 'fixed' && <label className="text-xs text-slate-400">固定伤害点数<input type="number" min={0} value={mechanic.attackFixedDamage} onChange={(event) => update({ attackFixedDamage: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}
                      {['damage', 'standard-condition', 'remove-standard-condition', 'roll-modifier', 'attack'].includes(mechanic.effectKind) && <label className="text-xs text-slate-400">效果目标<select value={mechanic.effectTarget} onChange={(event) => update({ effectTarget: event.target.value as typeof mechanic.effectTarget })} className={`mt-1 ${inputClass()}`}><option value="selected-subject">前一步监听到的对象</option><option value="self">怪物自身</option><option value="trigger-target">命中／触发目标</option><option value="damage-source">伤害来源</option></select></label>}
                      {['damage', 'area-attack', 'attack'].includes(mechanic.effectKind) && <label className="text-xs text-slate-400">伤害类型<select value={mechanic.damageType} onChange={(event) => update({ damageType: event.target.value as typeof mechanic.damageType })} className={`mt-1 ${inputClass()}`}>{mechanic.effectKind === 'damage' && <option value="inherit-trigger">继承本次伤害类型</option>}{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{DND5E_DAMAGE_TYPE_LABELS[type]}</option>)}</select></label>}
                      {mechanic.effectKind === 'roll-modifier' && <><label className="text-xs text-slate-400">修正投骰<select value={mechanic.modifierRoll} onChange={(event) => update({ modifierRoll: event.target.value as typeof mechanic.modifierRoll })} className={`mt-1 ${inputClass()}`}><option value="attack">攻击投骰</option><option value="damage">伤害投骰</option><option value="saving-throw">豁免检定</option></select></label><label className="text-xs text-slate-400">修正方式<select value={mechanic.modifierMode} onChange={(event) => update({ modifierMode: event.target.value as typeof mechanic.modifierMode })} className={`mt-1 ${inputClass()}`}><option value="bonus">数值加值</option><option value="advantage">优势</option><option value="disadvantage">劣势</option></select></label>{mechanic.modifierMode === 'bonus' && <label className="text-xs text-slate-400">加值<input type="number" value={mechanic.modifierBonus} onChange={(event) => update({ modifierBonus: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}</>}
                      {mechanic.effectKind === 'attack' && <><label className="text-xs text-slate-400">攻击加值<input type="number" value={mechanic.attackToHit} onChange={(event) => update({ attackToHit: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">动作资源<select value={mechanic.attackEconomy} onChange={(event) => update({ attackEconomy: event.target.value as typeof mechanic.attackEconomy })} className={`mt-1 ${inputClass()}`}><option value="reaction">消耗反应</option><option value="none">不消耗动作资源</option></select></label></>}
                      {mechanic.effectKind === 'standard-condition' && <><label className="text-xs text-slate-400">标准状态<select value={mechanic.condition} onChange={(event) => update({ condition: event.target.value as typeof mechanic.condition })} className={`mt-1 ${inputClass()}`}>{Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => <option key={condition.id} value={condition.id}>{condition.label}</option>)}</select></label><label className="text-xs text-slate-400">持续时间<select value={mechanic.durationKind} onChange={(event) => update({ durationKind: event.target.value as typeof mechanic.durationKind })} className={`mt-1 ${inputClass()}`}><option value="rounds">固定轮数</option><option value="until-target-turn-start">至目标回合开始</option><option value="until-source-turn-start">至来源回合开始</option><option value="permanent">永久</option></select></label>{mechanic.durationKind === 'rounds' && <label className="text-xs text-slate-400">轮数<input type="number" min={1} value={mechanic.durationRounds} onChange={(event) => update({ durationRounds: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}</>}
                      {mechanic.effectKind === 'remove-standard-condition' && <label className="text-xs text-slate-400">移除状态<select value={mechanic.condition} onChange={(event) => update({ condition: event.target.value as typeof mechanic.condition })} className={`mt-1 ${inputClass()}`}>{Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => <option key={condition.id} value={condition.id}>{condition.label}</option>)}</select></label>}
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
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">特性</h3><p className="mt-1 text-[11px] text-slate-500">常见规则可选择 Headless 预设；其余特性保留完整描述并明确交给 DM 裁定。</p></div><button type="button" onClick={() => patchDraft('traits', [...draft.traits, createDnd5eCustomMonsterTraitDraft()])} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"><Plus className="h-3 w-3" /> 添加</button></div>
              <div className="space-y-2">
                {draft.traits.map((trait, index) => {
                  const update = (patch: Partial<typeof trait>) => patchDraft('traits', draft.traits.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
                  const headlessPreset = ['regeneration', 'undead-fortitude', 'nimble-escape', 'swarm', 'magic-resistance', 'limited-magic-immunity', 'magic-weapons', 'conditional-target-bonus'].includes(trait.ruleKind)
                  return <div key={index} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_220px_150px_auto]"><input value={trait.name} onChange={(event) => update({ name: event.target.value })} placeholder="特性名称" className={inputClass()} /><select value={trait.ruleKind} onChange={(event) => {
                      const ruleKind = event.target.value as typeof trait.ruleKind
                      update({
                        ruleKind,
                        automation: ['regeneration', 'undead-fortitude', 'nimble-escape', 'swarm', 'magic-resistance', 'limited-magic-immunity', 'magic-weapons', 'conditional-target-bonus'].includes(ruleKind)
                          ? 'headless'
                          : 'dm-adjudication',
                      })
                    }} className={inputClass()}><option value="none">自定义规则（DM 裁定）</option><option value="regeneration">再生</option><option value="undead-fortitude">不死坚韧</option><option value="nimble-escape">灵巧逃脱</option><option value="swarm">集群规则</option><option value="magic-resistance">魔法抗性</option><option value="limited-magic-immunity">有限魔法免疫</option><option value="magic-weapons">魔法武器</option><option value="conditional-target-bonus">按目标状态获得攻击/伤害加值</option><option value="keen-sense">灵敏感官＋盲视</option><option value="ambusher">伏击手（突袭先攻优势）</option><option value="charge-damage">冲锋/袭掠追加伤害</option></select><select value={headlessPreset ? 'headless' : 'dm-adjudication'} disabled className={inputClass()}><option value="headless">Headless</option><option value="dm-adjudication">结构化／DM 裁定</option></select><button type="button" onClick={() => patchDraft('traits', draft.traits.filter((_, entryIndex) => entryIndex !== index))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>
                    {(trait.ruleKind === 'regeneration' || trait.ruleKind === 'undead-fortitude') && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {trait.ruleKind === 'regeneration' ? <label className="text-xs text-slate-400">每回合恢复<input type="number" min={1} value={trait.amount} onChange={(event) => update({ amount: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label> : <label className="text-xs text-slate-400">DC 基数<input type="number" min={1} value={trait.dcBase} onChange={(event) => update({ dcBase: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}
                      <label className="col-span-2 text-xs text-slate-400">{trait.ruleKind === 'regeneration' ? '压制再生的伤害类型' : '不能触发的伤害类型'}<div className="mt-1 flex flex-wrap gap-1">{DND5E_DAMAGE_TYPES.map((type) => <button key={type} type="button" onClick={() => update({ damageTypes: trait.damageTypes.includes(type) ? trait.damageTypes.filter((entry) => entry !== type) : [...trait.damageTypes, type] })} className={`rounded-full border px-2 py-1 text-[10px] ${trait.damageTypes.includes(type) ? 'border-violet-400/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-slate-500'}`}>{DND5E_DAMAGE_TYPE_LABELS[type]}</button>)}</div></label>
                      {trait.ruleKind === 'regeneration' ? <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={trait.requiresPositiveHp} onChange={(event) => update({ requiresPositiveHp: event.target.checked })} />仅 HP 大于 0</label> : <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={trait.excludedOnCritical} onChange={(event) => update({ excludedOnCritical: event.target.checked })} />重击时不触发</label>}
                    </div>}
                    {trait.ruleKind === 'keen-sense' && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <label className="text-xs text-slate-400">感官<select value={trait.keenSense} onChange={(event) => update({ keenSense: event.target.value as typeof trait.keenSense })} className={`mt-1 ${inputClass()}`}><option value="smell">嗅觉</option><option value="hearing">听觉</option><option value="sight">视觉</option></select></label>
                      <label className="text-xs text-slate-400">关联技能<input value={trait.keenSenseSkillKey} onChange={(event) => update({ keenSenseSkillKey: event.target.value })} placeholder="perception" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">相关检定加值<input type="number" min={-100} max={100} value={trait.keenSenseCheckBonus} onChange={(event) => update({ keenSenseCheckBonus: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">附带盲视（尺）<input type="number" min={0} value={trait.keenSenseBlindsightFeet} onChange={(event) => update({ keenSenseBlindsightFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                    </div>}
                    {trait.ruleKind === 'ambusher' && <p className="mt-2 rounded-lg border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-100">仅在该怪物实际发动突袭时获得先攻优势；当前由 DM 确认突袭成立，结构会完整写入 Stat Block。</p>}
                    {trait.ruleKind === 'charge-damage' && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <label className="text-xs text-slate-400">至少直线移动（尺）<input type="number" min={5} value={trait.chargeMinimumFeet} onChange={(event) => update({ chargeMinimumFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">随后命中的攻击<select value={trait.chargeActionId} onChange={(event) => update({ chargeActionId: event.target.value })} className={`mt-1 ${inputClass()}`}><option value="">请选择攻击</option>{draft.actions.filter((action) => action.category === 'action' && action.kind === 'weapon-attack').map((action) => <option key={action.id} value={action.id}>{action.name || action.id}</option>)}</select></label>
                      <label className="text-xs text-slate-400">追加伤害骰<input value={trait.chargeDamageDice} onChange={(event) => update({ chargeDamageDice: event.target.value })} placeholder="2d10" className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">追加伤害类型<select value={trait.chargeDamageType} onChange={(event) => update({ chargeDamageType: event.target.value as typeof trait.chargeDamageType })} className={`mt-1 ${inputClass()}`}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{DND5E_DAMAGE_TYPE_LABELS[type]}</option>)}</select></label>
                      <p className="col-span-2 text-[11px] leading-relaxed text-amber-200 lg:col-span-4">Headless 尚未持久化整段移动路径，无法可靠证明“直线移动后立即攻击”；基础攻击仍自动结算，追加伤害保持结构化并交由 DM 确认。</p>
                    </div>}
                    {trait.ruleKind === 'magic-resistance' && <p className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">对抗法术和标记为魔法来源的效果时，Headless 豁免自动获得优势。</p>}
                    {trait.ruleKind === 'limited-magic-immunity' && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-3">
                      <label className="text-xs text-slate-400">自动免疫至法术环级<input type="number" min={0} max={9} value={trait.limitedMagicImmunityMaximumSpellLevel} onChange={(event) => update({ limitedMagicImmunityMaximumSpellLevel: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={trait.limitedMagicImmunityAdvantageAboveMaximum} onChange={(event) => update({ limitedMagicImmunityAdvantageAboveMaximum: event.target.checked })} />更高环级豁免优势</label>
                      <label className="flex items-end gap-2 pb-2 text-xs text-slate-400"><input type="checkbox" checked={trait.limitedMagicImmunityAllowsWilling} onChange={(event) => update({ limitedMagicImmunityAllowsWilling: event.target.checked })} />允许自愿受影响</label>
                    </div>}
                    {trait.ruleKind === 'magic-weapons' && <p className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-100">该怪物的武器攻击在伤害免疫与抗性判定中视为魔法攻击。</p>}
                    {trait.ruleKind === 'conditional-target-bonus' && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <label className="col-span-2 text-xs text-slate-400">目标满足任一状态<div className="mt-1 flex flex-wrap gap-1">{Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => <button key={condition.id} type="button" onClick={() => update({ targetBonusConditions: trait.targetBonusConditions.includes(condition.id) ? trait.targetBonusConditions.filter((entry) => entry !== condition.id) : [...trait.targetBonusConditions, condition.id] })} className={`rounded-full border px-2 py-1 text-[10px] ${trait.targetBonusConditions.includes(condition.id) ? 'border-violet-400/40 bg-violet-500/15 text-violet-100' : 'border-white/10 text-slate-500'}`}>{condition.label}</button>)}</div></label>
                      <label className="text-xs text-slate-400">攻击投骰加值<input type="number" min={-100} max={100} value={trait.targetAttackBonus} onChange={(event) => update({ targetAttackBonus: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">每次命中总伤害加值<input type="number" value={trait.targetDamageBonus} onChange={(event) => update({ targetDamageBonus: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                    </div>}
                    <textarea rows={2} value={trait.description} onChange={(event) => update({ description: event.target.value })} placeholder="完整规则描述" className={`mt-2 ${inputClass()} resize-y`} />
                  </div>
                })}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between"><div><h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">动作</h3><p className="mt-1 text-[11px] text-slate-500">只有纯命中＋伤害动作应选择 Headless；带附加规则的动作请选择 DM 裁定。</p></div><button type="button" onClick={() => patchDraft('actions', [...draft.actions, createDnd5eCustomMonsterActionDraft()])} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300 hover:bg-white/10"><Plus className="h-3 w-3" /> 添加</button></div>
              <div className="space-y-3">
                {draft.actions.map((action, index) => {
                  const update = (patch: Partial<typeof action>) => patchDraft('actions', draft.actions.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry))
                  return <div key={action.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
                      <label className="text-xs text-slate-400">名称<input value={action.name} onChange={(event) => update({ name: event.target.value })} className={`mt-1 ${inputClass()}`} /></label>
                      <label className="text-xs text-slate-400">动作经济<select value={action.category} onChange={(event) => update({ category: event.target.value as typeof action.category })} className={`mt-1 ${inputClass()}`}><option value="action">动作</option><option value="bonus-action">附赠动作</option><option value="reaction">反应</option><option value="legendary">传奇动作</option><option value="lair">巢穴动作</option></select></label>
                      <label className="text-xs text-slate-400">类型<select value={action.kind} onChange={(event) => update({ kind: event.target.value as typeof action.kind, automation: event.target.value === 'other' || event.target.value === 'movement' ? 'dm-adjudication' : action.automation })} className={`mt-1 ${inputClass()}`}><option value="weapon-attack">武器攻击</option><option value="movement">定向移动</option><option value="other">其他动作</option></select></label>
                      <label className="text-xs text-slate-400">结算<select value={action.kind === 'other' || action.kind === 'movement' ? 'dm-adjudication' : action.automation} disabled={action.kind === 'other' || action.kind === 'movement' || action.category === 'bonus-action' || action.category === 'reaction' || action.category === 'lair'} onChange={(event) => update({ automation: event.target.value as typeof action.automation })} className={`mt-1 ${inputClass()}`}><option value="headless">Headless</option><option value="dm-adjudication">DM 裁定</option></select></label>
                      <label className="text-xs text-slate-400">使用限制<select value={action.usageKind} onChange={(event) => update({ usageKind: event.target.value as typeof action.usageKind })} className={`mt-1 ${inputClass()}`}><option value="at-will">随意</option><option value="per-day">每日 N 次</option><option value="recharge">充能 N–骰面</option></select></label>
                      {action.category === 'legendary' ? <label className="text-xs text-slate-400">传奇动作点消耗<input type="number" min={1} max={10} value={action.legendaryCost} onChange={(event) => update({ legendaryCost: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label> : <div />}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-6">
                      {action.usageKind === 'per-day' && <label className="text-xs text-slate-400">每日次数<input type="number" min={1} max={99} value={action.usageMax} onChange={(event) => update({ usageMax: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}
                      {action.usageKind === 'recharge' && <><label className="text-xs text-slate-400">充能成功下限<input type="number" min={1} value={action.rechargeMinimum} onChange={(event) => update({ rechargeMinimum: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">充能骰面<input type="number" min={2} value={action.rechargeDieSides} onChange={(event) => update({ rechargeDieSides: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label></>}
                      {action.category === 'legendary' && <label className="col-span-2 text-xs text-slate-400">引用普通动作<select value={action.referencedActionId} onChange={(event) => update({ referencedActionId: event.target.value })} className={`mt-1 ${inputClass()}`}><option value="">不引用，使用本动作数据</option>{draft.actions.filter((candidate) => candidate.category === 'action' && candidate.kind === 'weapon-attack').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.id}</option>)}</select></label>}
                      {action.category === 'reaction' && <label className="col-span-2 text-xs text-slate-400">触发于动作完成后<select value={action.reactionTriggerActionId} onChange={(event) => update({ reactionTriggerActionId: event.target.value })} className={`mt-1 ${inputClass()}`}><option value="">不绑定触发动作</option>{draft.actions.filter((candidate) => candidate.id !== action.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.id}</option>)}</select></label>}
                      {action.kind === 'weapon-attack' && <><label className="text-xs text-slate-400">攻击方式<select value={action.mode} onChange={(event) => update({ mode: event.target.value as typeof action.mode })} className={`mt-1 ${inputClass()}`}><option value="melee">近战</option><option value="ranged">远程</option><option value="melee-or-ranged">近战或远程</option></select></label>{action.category === 'action' && <label className="text-xs text-slate-400">每动作次数<input type="number" min={1} max={10} value={action.attacksPerAction} onChange={(event) => update({ attacksPerAction: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>}</>}
                    </div>
                    {action.kind === 'movement' && <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                      <label className="text-xs text-slate-400">最大速度比例<input type="number" min={0.05} max={1} step={0.05} value={action.movementSpeedFraction} onChange={(event) => update({ movementSpeedFraction: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label>
                      <p className="col-span-1 flex items-end pb-2 text-xs text-slate-400 lg:col-span-3">目标固定为可见敌人，移动方式固定为朝目标直线移动；Host/DM 负责选择目标和落点。</p>
                    </div>}
                    {action.kind === 'weapon-attack' && <div className="mt-2 grid grid-cols-3 gap-2 lg:grid-cols-8"><label className="text-xs text-slate-400">命中加值<input type="number" value={action.toHit} onChange={(event) => update({ toHit: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">重击阈值<input type="number" min={2} max={20} value={action.criticalThreshold} onChange={(event) => update({ criticalThreshold: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">触及<input type="number" min={0} value={action.reachFeet} onChange={(event) => update({ reachFeet: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">正常射程<input type="number" min={0} value={action.rangeNormal} onChange={(event) => update({ rangeNormal: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">最远射程<input type="number" min={0} value={action.rangeLong} onChange={(event) => update({ rangeLong: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="text-xs text-slate-400">伤害骰<input value={action.damageDice} onChange={(event) => update({ damageDice: event.target.value })} className={`mt-1 ${inputClass()}`} /></label><label className="col-span-2 text-xs text-slate-400">伤害类型<select value={action.damageType} onChange={(event) => update({ damageType: event.target.value as typeof action.damageType })} className={`mt-1 ${inputClass()}`}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{DND5E_DAMAGE_TYPE_LABELS[type]}</option>)}</select></label></div>}
                    {action.kind === 'weapon-attack' && <div className="mt-2 rounded-lg border border-white/8 bg-black/10 p-2">
                      <div className="flex items-center justify-between"><p className="text-[11px] font-semibold text-slate-500">附加伤害组件</p><button type="button" onClick={() => update({ additionalDamage: [...action.additionalDamage, { id: `damage-${Date.now()}`, dice: '1d6', damageType: 'fire' }] })} className="text-[11px] text-arcane-200">+ 添加</button></div>
                      <div className="mt-1 space-y-1">{action.additionalDamage.map((component, damageIndex) => <div key={component.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input value={component.dice} onChange={(event) => update({ additionalDamage: action.additionalDamage.map((entry, i) => i === damageIndex ? { ...entry, dice: event.target.value } : entry) })} placeholder="1d6" className={inputClass()} /><select value={component.damageType} onChange={(event) => update({ additionalDamage: action.additionalDamage.map((entry, i) => i === damageIndex ? { ...entry, damageType: event.target.value as typeof component.damageType } : entry) })} className={inputClass()}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{DND5E_DAMAGE_TYPE_LABELS[type]}</option>)}</select><button type="button" onClick={() => update({ additionalDamage: action.additionalDamage.filter((_, i) => i !== damageIndex) })} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
                      <div className="mt-2 flex items-center justify-between"><p className="text-[11px] font-semibold text-slate-500">仅重击追加伤害（不会再次翻倍）</p><button type="button" onClick={() => update({ criticalExtraDamage: [...action.criticalExtraDamage, { id: `critical-damage-${Date.now()}`, dice: '1d6', damageType: 'slashing' }] })} className="text-[11px] text-arcane-200">+ 添加</button></div>
                      <div className="mt-1 space-y-1">{action.criticalExtraDamage.map((component, damageIndex) => <div key={component.id} className="grid grid-cols-[1fr_1fr_auto] gap-2"><input value={component.dice} onChange={(event) => update({ criticalExtraDamage: action.criticalExtraDamage.map((entry, i) => i === damageIndex ? { ...entry, dice: event.target.value } : entry) })} placeholder="1d6" className={inputClass()} /><select value={component.damageType} onChange={(event) => update({ criticalExtraDamage: action.criticalExtraDamage.map((entry, i) => i === damageIndex ? { ...entry, damageType: event.target.value as typeof component.damageType } : entry) })} className={inputClass()}>{DND5E_DAMAGE_TYPES.map((type) => <option key={type} value={type}>{DND5E_DAMAGE_TYPE_LABELS[type]}</option>)}</select><button type="button" onClick={() => update({ criticalExtraDamage: action.criticalExtraDamage.filter((_, i) => i !== damageIndex) })} className="text-rose-300"><Trash2 className="h-4 w-4" /></button></div>)}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-5">
                        <label className="flex items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={action.onHitSaveEnabled} onChange={(event) => update({ onHitSaveEnabled: event.target.checked })} />命中后要求豁免</label>
                        {action.onHitSaveEnabled && <><label className="text-xs text-slate-400">豁免属性<select value={action.onHitSaveAbility} onChange={(event) => update({ onHitSaveAbility: event.target.value as AbilityKey })} className={`mt-1 ${inputClass()}`}>{ABILITY_LABELS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs text-slate-400">DC<input type="number" min={1} value={action.onHitSaveDc} onChange={(event) => update({ onHitSaveDc: Number(event.target.value) })} className={`mt-1 ${inputClass()}`} /></label><label className="col-span-2 text-xs text-slate-400">失败施加状态<select value={action.onHitCondition} onChange={(event) => update({ onHitCondition: event.target.value as typeof action.onHitCondition })} className={`mt-1 ${inputClass()}`}>{Object.values(DND5E_STANDARD_CONDITIONS).map((condition) => <option key={condition.id} value={condition.id}>{condition.label}</option>)}</select></label></>}
                      </div>
                    </div>}
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr),auto] gap-2"><textarea rows={2} value={action.description} onChange={(event) => update({ description: event.target.value })} placeholder={action.kind === 'weapon-attack' ? '可留空，系统会生成基础攻击描述；附带效果必须完整填写。' : '填写完整规则描述'} className={`${inputClass()} resize-y`} /><button type="button" onClick={() => patchDraft('actions', draft.actions.filter((_, entryIndex) => entryIndex !== index))} className="rounded-lg p-2 text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>
                  </div>
                })}
              </div>
            </section>
          </div>

          <footer className="flex items-center gap-3 border-t border-white/10 px-5 py-3">
            <p className={`min-w-0 flex-1 truncate text-xs ${message?.includes('已保存') || message?.includes('导入完成') ? 'text-emerald-300' : 'text-amber-300'}`}>{message ?? '高级施法、传奇动作、变形与再生可通过 JSON 导入保留；当前自动结算边界会明确标注。'}</p>
            {selectedId && <button type="button" disabled={busy} onClick={() => {
              if (!window.confirm(pluginMode ? '从扩展草稿中删除这个怪物模板？' : '删除此房间怪物模板？地图上已存在的 Token 将保留，但失去 stat block。')) return
              if (pluginMode) {
                onMonstersChange(monsters.filter((monster) => monster.id !== selectedId))
                setSelectedId(null)
                setDraft(createDnd5eCustomMonsterDraft())
                setMessage('已从扩展草稿删除怪物模板。')
              } else {
                void removeRoomMonster(selectedId).then(() => {
                  setSelectedId(null)
                  setDraft(createDnd5eCustomMonsterDraft())
                  setMessage('已删除怪物模板。')
                })
              }
            }} className="flex items-center gap-1 rounded-lg bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25"><Trash2 className="h-3.5 w-3.5" /> 删除</button>}
            <button type="button" disabled={busy} onClick={() => void save()} className="flex items-center gap-2 rounded-lg bg-arcane-500 px-4 py-2 text-sm font-semibold text-white hover:bg-arcane-400 disabled:opacity-50"><Save className="h-4 w-4" />{busy ? '处理中…' : '校验并保存'}</button>
          </footer>
        </main>
      </div>
    </div>
  )
}
