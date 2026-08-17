import { useMemo, useState } from 'react'
import { FileSpreadsheet, LoaderCircle, ShieldCheck, Sparkles, WandSparkles, X } from 'lucide-react'
import { ABILITIES, SKILLS, type AbilityKey } from '../../lib/dnd'
import {
  enhanceCharacterExcelImportWithAi,
  enhanceCharacterExcelImportWithPlayerAi,
} from '../../lib/characterExcelAiImport'
import {
  AiProviderRegistryV1,
  DEFAULT_AI_PROVIDER_SELECTION,
} from '../../lib/aiProvider'
import {
  createExternalAiBridgeRuntime,
  localAiBridgeSnapshot,
  probeLocalAiBridge,
} from '../../lib/localAiBridgeApi'
import {
  compactCharacterExcelWorkbookText,
  type CharacterExcelImportDraft,
  type CharacterExcelWorkbook,
} from '../../lib/characterExcelImport'
import type { Character } from '../../types/character'
import {
  AI_MODEL_POLICY,
  creditCny,
  fixedBridgeModelIdForTask,
  reserveCredits,
  textCredits,
} from '../../../shared/ai-model-policy.mjs'
import { playerAiErrorMessage, PlayerAiApiError } from '../../lib/playerAiApi'

interface CharacterExcelImportDialogProps {
  workbook: CharacterExcelWorkbook
  initialDraft: CharacterExcelImportDraft
  portraitDataUrl?: string
  existingNames: readonly string[]
  onCancel: () => void
  onImport: (character: Partial<Character>) => void
  usePlayerAi?: boolean
}

const inputClassName = 'mt-1 w-full rounded-xl border border-white/10 bg-void-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-violet-400/60'

function numericValue(value: string, minimum: number, maximum: number, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback
}

export default function CharacterExcelImportDialog({
  workbook,
  initialDraft,
  portraitDataUrl,
  existingNames,
  onCancel,
  onImport,
  usePlayerAi = false,
}: CharacterExcelImportDialogProps) {
  const [draft, setDraft] = useState(() => ({
    ...initialDraft,
    character: {
      ...initialDraft.character,
      ...(portraitDataUrl ? { portrait: portraitDataUrl } : {}),
    },
  }))
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [showSources, setShowSources] = useState(false)
  const character = draft.character
  const aiEstimate = useMemo(() => {
    const inputTokens = Math.max(1, Math.ceil(compactCharacterExcelWorkbookText(workbook).length / 2))
    const estimatedCredits = textCredits({
      modelId: AI_MODEL_POLICY.generalModelId,
      inputTokens,
      outputTokens: 4_096,
    })
    return {
      estimatedCredits,
      reservedCredits: reserveCredits(estimatedCredits),
    }
  }, [workbook])
  const duplicateName = useMemo(() => {
    const normalized = character.name?.trim().toLocaleLowerCase('zh-CN')
    return !!normalized && existingNames.some((name) => name.trim().toLocaleLowerCase('zh-CN') === normalized)
  }, [character.name, existingNames])

  const patchCharacter = (patch: Partial<Character>) => {
    setDraft((current) => ({ ...current, character: { ...current.character, ...patch } }))
  }

  const patchAbility = (ability: AbilityKey, raw: string) => {
    const abilities = character.abilities ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }
    patchCharacter({
      abilities: {
        ...abilities,
        [ability]: numericValue(raw, 1, 30, abilities[ability]),
      },
    })
  }

  const runAiEnhancement = async () => {
    if (aiBusy) return
    setAiBusy(true)
    setAiError(null)
    setAiNotice(null)
    try {
      if (usePlayerAi) {
        const result = await enhanceCharacterExcelImportWithPlayerAi({ workbook, draft })
        setDraft(result.draft)
        setAiNotice(result.addedFields.length
          ? `${result.providerName}${result.modelName ? ` / ${result.modelName}` : ''} 补全了 ${result.addedFields.length} 类字段。`
          : 'AI 已复核，没有覆盖本地高置信度字段。')
        return
      }
      let bridge = localAiBridgeSnapshot()
      if (bridge.status !== 'ready') bridge = await probeLocalAiBridge()
      if (bridge.status !== 'ready') throw new Error('AI Bridge 未连接；可以继续使用本地解析结果导入。')
      const registry = new AiProviderRegistryV1()
      registry.register(createExternalAiBridgeRuntime(bridge.models))
      const result = await enhanceCharacterExcelImportWithAi({
        workbook,
        draft,
        registry,
        selection: {
          ...DEFAULT_AI_PROVIDER_SELECTION,
          modelId: fixedBridgeModelIdForTask('resource-structuring'),
        },
      })
      setDraft(result.draft)
      setAiNotice(result.addedFields.length
        ? `${result.providerName}${result.modelName ? ` / ${result.modelName}` : ''} 补全了 ${result.addedFields.length} 类字段。`
        : 'AI 已复核，没有覆盖本地高置信度字段。')
    } catch (error) {
      setAiError(error instanceof PlayerAiApiError
        ? playerAiErrorMessage(error)
        : error instanceof Error ? error.message : 'AI 补全失败。')
    } finally {
      setAiBusy(false)
    }
  }

  const submit = () => {
    if (!character.name?.trim()) {
      setAiError('角色名不能为空。')
      return
    }
    onImport({
      ...character,
      name: character.name.trim(),
      currentHp: Math.min(character.maxHp ?? 10, Math.max(0, character.currentHp ?? character.maxHp ?? 10)),
    })
  }

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Excel AI 填卡预览"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}
    >
      <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-violet-400/25 bg-[#090812] shadow-2xl shadow-violet-950/40">
        <header className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-2.5 text-emerald-300">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-white">Excel / AI 填卡预览</h2>
              <p className="mt-1 truncate text-xs text-slate-400">{draft.sourceFileName}</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
            <aside>
              <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-violet-500/15 to-slate-950">
                {character.portrait ? (
                  <img src={character.portrait} alt="Excel 内嵌角色立绘" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-slate-500">
                    <Sparkles className="h-8 w-8 text-violet-400/60" />
                    <span className="text-xs">Excel 中没有可用立绘，导入后仍可上传或 AI 生成。</span>
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-xs leading-5 text-slate-400">
                <div className="flex items-center gap-2 font-semibold text-slate-200">
                  <ShieldCheck className="h-4 w-4 text-emerald-300" />本地安全解析
                </div>
                <p className="mt-1">{draft.workbookSummary.sheetNames.length} 张工作表 · {draft.workbookSummary.populatedCellCount.toLocaleString()} 个有效单元格 · {draft.workbookSummary.imageCount} 张位图</p>
                {draft.workbookSummary.recognizedTemplate && <p className="mt-1 text-emerald-300">已识别：{draft.workbookSummary.recognizedTemplate}</p>}
              </div>
            </aside>

            <main className="space-y-5">
              <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">核心资料</h3>
                    <p className="mt-1 text-xs text-slate-500">创建前可直接修正；确认后才会写入角色库。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runAiEnhancement()}
                    disabled={aiBusy}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/15 disabled:cursor-wait disabled:opacity-60"
                  >
                    {aiBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                    {aiBusy ? 'AI 正在复核…' : 'AI 补全未识别项'}
                  </button>
                </div>
                <p className="mb-3 text-[10px] leading-4 text-slate-500">
                  固定使用 {AI_MODEL_POLICY.generalModelId}；预计 {aiEstimate.estimatedCredits} 积分（约 ¥{creditCny(aiEstimate.estimatedCredits).toFixed(2)}），执行前预留 {aiEstimate.reservedCredits} 积分，完成后按实际 Token 结算。
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['角色名', 'name', character.name ?? ''],
                    ['玩家名', 'player', character.player ?? ''],
                    ['职业', 'charClass', character.charClass ?? ''],
                    ['种族', 'race', character.race ?? ''],
                    ['背景', 'background', character.background ?? ''],
                    ['阵营', 'alignment', character.alignment ?? ''],
                  ].map(([label, key, value]) => (
                    <label key={key} className="text-xs text-slate-400">
                      {label}
                      <input value={value} onChange={(event) => patchCharacter({ [key]: event.target.value } as Partial<Character>)} className={inputClassName} />
                    </label>
                  ))}
                  <label className="text-xs text-slate-400">等级
                    <input type="number" min={1} max={20} value={character.level ?? 1} onChange={(event) => patchCharacter({ level: numericValue(event.target.value, 1, 20, character.level ?? 1) })} className={inputClassName} />
                  </label>
                  <label className="text-xs text-slate-400">经验值
                    <input type="number" min={0} value={character.experience ?? 0} onChange={(event) => patchCharacter({ experience: numericValue(event.target.value, 0, 99_999_999, character.experience ?? 0) })} className={inputClassName} />
                  </label>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <h3 className="text-sm font-semibold text-slate-100">属性值</h3>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {ABILITIES.map((ability) => (
                      <label key={ability.key} className="text-center text-[11px] text-slate-500">
                        {ability.label}
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={character.abilities?.[ability.key] ?? 10}
                          onChange={(event) => patchAbility(ability.key, event.target.value)}
                          className={`${inputClassName} text-center text-base font-bold`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                  <h3 className="text-sm font-semibold text-slate-100">战斗数据</h3>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ['当前 HP', 'currentHp', character.currentHp ?? 10, 0, 9_999],
                      ['最大 HP', 'maxHp', character.maxHp ?? 10, 1, 9_999],
                      ['速度（尺）', 'speed', character.speed ?? 30, 0, 300],
                      ['法术 DC', 'saveDC', character.saveDC ?? 8, 1, 40],
                    ].map(([label, key, value, minimum, maximum]) => (
                      <label key={String(key)} className="text-[11px] text-slate-500">{label}
                        <input type="number" min={Number(minimum)} max={Number(maximum)} value={Number(value)} onChange={(event) => patchCharacter({
                          [key]: numericValue(event.target.value, Number(minimum), Number(maximum), Number(value)),
                        } as Partial<Character>)} className={inputClassName} />
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-100">规则映射</h3>
                  <span className="text-xs text-slate-500">{draft.importedSpellNames.length} 个法术已转换为稳定 ID</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {draft.importedSpellNames.length ? draft.importedSpellNames.map((name) => (
                    <span key={name} className="rounded-full border border-blue-400/20 bg-blue-500/8 px-2.5 py-1 text-xs text-blue-100">{name}</span>
                  )) : <span className="text-xs text-slate-500">未识别到可映射法术。</span>}
                </div>
                {!!character.skills?.length && (
                  <p className="mt-3 text-xs text-slate-400">技能熟练：{character.skills.map((key) => SKILLS.find((skill) => skill.key === key)?.label ?? key).join('、')}</p>
                )}
                {!!draft.detectedFeatureNames.length && (
                  <p className="mt-2 text-xs leading-5 text-slate-500">检测到的特性名称已保留在备注中：{draft.detectedFeatureNames.join('、')}</p>
                )}
              </section>

              {(aiError || aiNotice || draft.warnings.length > 0 || duplicateName) && (
                <section className="space-y-2">
                  {aiError && <p className="rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs text-rose-200">{aiError}</p>}
                  {aiNotice && <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-xs text-emerald-200">{aiNotice}</p>}
                  {duplicateName && <p className="rounded-xl border border-amber-400/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-200">已有同名角色；继续导入会创建独立副本，不会覆盖原角色。</p>}
                  {draft.warnings.map((warning) => <p key={warning} className="rounded-xl border border-amber-400/15 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/85">{warning}</p>)}
                </section>
              )}

              <button type="button" onClick={() => setShowSources((value) => !value)} className="text-xs font-semibold text-violet-300 hover:text-violet-200">
                {showSources ? '收起来源单元格' : `查看 ${draft.fieldSources.length} 项来源单元格`}
              </button>
              {showSources && (
                <div className="grid gap-2 rounded-2xl border border-white/8 bg-black/15 p-3 sm:grid-cols-2">
                  {draft.fieldSources.map((source) => (
                    <div key={`${source.field}:${source.cell}`} className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2 text-xs">
                      <div className="flex items-center justify-between gap-2 text-slate-300"><span>{source.label}</span><code className="text-violet-300">{source.sheet}!{source.cell}</code></div>
                      <p className="mt-1 truncate text-slate-500">{source.value}</p>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-5 py-4 sm:px-6">
          <p className="text-xs text-slate-500">公式、宏和外部链接均不会执行；AI 也不会覆盖本地高置信度字段。</p>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5">取消</button>
            <button type="button" onClick={submit} disabled={!character.name?.trim() || aiBusy} className="rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-950/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">确认创建角色</button>
          </div>
        </footer>
      </section>
    </div>
  )
}
