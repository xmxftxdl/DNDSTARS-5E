import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, ClipboardPaste, FileJson, LoaderCircle, Pencil, Sparkles, Trash2 } from 'lucide-react'
import AiProviderSelector from './AiProviderSelector'
import { AiProviderRegistryV1, DEFAULT_AI_PROVIDER_SELECTION } from '../../lib/aiProvider'
import { showAppConfirm } from '../../lib/appDialog'
import {
  createExternalAiBridgeRuntime,
  localAiBridgeSnapshot,
} from '../../lib/localAiBridgeApi'
import {
  DND5E_LOCAL_CONTENT_AI_TARGETS,
  dnd5eContentPackageAutomationCoverageV2,
  dnd5eLocalContentAiTargetLabel,
  dnd5eLocalContentAiErrorMessage,
  generateDnd5eLocalContentAiDraft,
  prepareDnd5eLocalContentJson,
  type Dnd5eContentAutomationCoverageReportV2,
  type Dnd5eContentPackageV2,
  type Dnd5eLocalContentAiTargetKind,
  type GeneratedDnd5eLocalContentAiDraftV1,
  type PreparedDnd5eLocalContentJson,
} from '../../rulesets/dnd5e'
import type { Dnd5eMonsterWorkshopAiReview } from '../map/monsterWorkshopReview'

interface SavedLocalRulesAiDraftV1 {
  schemaVersion: 1
  source: string
  draft: string
  selection: typeof DEFAULT_AI_PROVIDER_SELECTION
  targetKind?: Dnd5eLocalContentAiTargetKind
}

export type Dnd5eLocalContentEditorTargetKind = Exclude<Dnd5eLocalContentAiTargetKind, 'auto'>

export interface Dnd5eLocalContentEditorRequest {
  targetKind: Dnd5eLocalContentEditorTargetKind
  package: Dnd5eContentPackageV2
  review?: Dnd5eMonsterWorkshopAiReview
}

const AI_DRAFT_STORAGE_KEY = 'dndstars5e:local-rules-ai-draft:v1'

function scopedAiDraftStorageKey(scope: string): string {
  return `${AI_DRAFT_STORAGE_KEY}:${encodeURIComponent(scope || 'local')}`
}

function readSavedAiDraft(storageKey: string): SavedLocalRulesAiDraftV1 | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as Partial<SavedLocalRulesAiDraftV1> | null
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.source !== 'string' || typeof parsed.draft !== 'string') return null
    return {
      schemaVersion: 1,
      source: parsed.source,
      draft: parsed.draft,
      selection: parsed.selection && typeof parsed.selection === 'object'
        ? { ...DEFAULT_AI_PROVIDER_SELECTION, ...parsed.selection }
        : { ...DEFAULT_AI_PROVIDER_SELECTION },
      targetKind: DND5E_LOCAL_CONTENT_AI_TARGETS.some((entry) => entry.id === parsed.targetKind)
        ? parsed.targetKind
        : 'auto',
    }
  } catch {
    return null
  }
}

function editableTargetInPreparedPackage(
  prepared: PreparedDnd5eLocalContentJson,
  requested: Dnd5eLocalContentAiTargetKind,
): Dnd5eLocalContentEditorTargetKind | null {
  const content = prepared.package.content
  const collections: readonly [Dnd5eLocalContentEditorTargetKind, readonly unknown[]][] = [
    ['monster', content.monsters],
    ['spell', content.spells],
    ['class', content.classes ?? []],
    ['subclass', content.subclasses],
    ['race', content.races],
    ['background', content.backgrounds],
    ['feat', content.feats],
    ['feature', content.features],
    ['item', content.items],
    ['ability-generation', content.abilityGenerationMethods],
  ]
  if (requested !== 'auto') {
    return collections.find(([kind, entries]) => kind === requested && entries.length > 0)?.[0] ?? null
  }
  const populated = collections.filter(([, entries]) => entries.length > 0)
  return populated.length === 1 ? populated[0][0] : null
}

export default function Dnd5eLocalRulesAiImporter({
  busy,
  onInstall,
  onEditContent,
  draftStorageScope = 'local',
}: {
  busy: boolean
  onInstall: (file: File) => Promise<void>
  onEditContent?: (request: Dnd5eLocalContentEditorRequest) => void
  draftStorageScope?: string
}) {
  const [draftStorageKey] = useState(() => scopedAiDraftStorageKey(draftStorageScope))
  const [restoredDraft] = useState(() => readSavedAiDraft(draftStorageKey))
  const restoredPreviewStarted = useRef(false)
  const [source, setSource] = useState(() => restoredDraft?.source ?? '')
  const [selection, setSelection] = useState(() => restoredDraft?.selection ?? { ...DEFAULT_AI_PROVIDER_SELECTION })
  const [targetKind, setTargetKind] = useState<Dnd5eLocalContentAiTargetKind>(() => restoredDraft?.targetKind ?? 'auto')
  const [aiBusy, setAiBusy] = useState(false)
  const [installBusy, setInstallBusy] = useState(false)
  const [installNotice, setInstallNotice] = useState<string | null>(null)
  const [draftNotice, setDraftNotice] = useState<string | null>(() => restoredDraft
    ? '已自动恢复当前房间的 AI 转换草稿。'
    : null)
  const [result, setResult] = useState<GeneratedDnd5eLocalContentAiDraftV1 | null>(null)
  const [draft, setDraft] = useState(() => restoredDraft?.draft ?? '')
  const [prepared, setPrepared] = useState<PreparedDnd5eLocalContentJson | null>(null)
  const [coverage, setCoverage] = useState<Dnd5eContentAutomationCoverageReportV2 | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showJsonEditor, setShowJsonEditor] = useState(false)

  const previewDraft = useCallback(async (draftJson: string) => {
    setError(null)
    setInstallNotice(null)
    setPrepared(null)
    setCoverage(null)
    try {
      const next = await prepareDnd5eLocalContentJson(draftJson, 'dm-ai-rule-draft.json')
      setPrepared(next)
      setCoverage(dnd5eContentPackageAutomationCoverageV2(next.package))
      return next
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
      return null
    }
  }, [])

  useEffect(() => {
    try {
      if (!source.trim() && !draft.trim()) {
        localStorage.removeItem(draftStorageKey)
        return
      }
      const saved: SavedLocalRulesAiDraftV1 = {
        schemaVersion: 1,
        source,
        draft,
        selection,
        targetKind,
      }
      localStorage.setItem(draftStorageKey, JSON.stringify(saved))
    } catch {
      // 自动保存是尽力而为；显式校验／启用流程仍会报告可见错误。
    }
  }, [draft, draftStorageKey, selection, source, targetKind])

  useEffect(() => {
    if (restoredPreviewStarted.current) return
    restoredPreviewStarted.current = true
    if (!restoredDraft?.draft.trim()) return
    const timer = window.setTimeout(() => void previewDraft(restoredDraft.draft), 0)
    return () => window.clearTimeout(timer)
  }, [previewDraft, restoredDraft])

  const installPrepared = async (next: PreparedDnd5eLocalContentJson) => {
    if (installBusy) return
    setError(null)
    setInstallNotice(null)
    if (next.audit && !next.audit.complete) {
      const accepted = await showAppConfirm({
        title: '导入缺口未通过',
        message: [
          '本地 JSON 缺口审计未通过，仍要导入吗？',
          `条目：${next.audit.totals.entries}`,
          `数量缺口：${next.audit.totals.countShortfall}`,
          `缺失稳定 ID：${next.audit.totals.missingIds}`,
          `缺失图片：${next.audit.totals.missingImages}`,
        ].join('\n'),
        confirmLabel: '仍然导入',
      })
      if (!accepted) return
    }
    setInstallBusy(true)
    try {
      await onInstall(new File(
        [new Uint8Array(next.bytes)],
        next.fileName,
        { type: 'application/json' },
      ))
      setInstallNotice(`已启用 ${next.package.manifest.name} v${next.package.manifest.version}。`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setInstallBusy(false)
    }
  }

  const importSourceAsJson = async () => {
    if (!source.trim() || busy || aiBusy) return
    setAiBusy(true)
    setError(null)
    try {
      const next = await prepareDnd5eLocalContentJson(source, 'dm-pasted-rules.json')
      await installPrepared(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setAiBusy(false)
    }
  }

  const convertWithAi = async () => {
    if (!source.trim() || busy || aiBusy) return
    setAiBusy(true)
    setError(null)
    setResult(null)
    setDraft('')
    setPrepared(null)
    setCoverage(null)
    try {
      const bridge = localAiBridgeSnapshot()
      if (bridge.status !== 'ready') throw new Error('provider-unavailable')
      const registry = new AiProviderRegistryV1()
      if (selection.providerId === 'external-account') {
        registry.register(createExternalAiBridgeRuntime(bridge.models))
      } else {
        throw new Error('provider-runtime-missing')
      }
      const generated = await generateDnd5eLocalContentAiDraft({
        sourceText: source,
        registry,
        selection,
        targetKind,
      })
      setResult(generated)
      setDraft(generated.draft.contentJson)
      const next = await previewDraft(generated.draft.contentJson)
      const editorTarget = next ? editableTargetInPreparedPackage(next, generated.targetKind) : null
      if (next && editorTarget && onEditContent) {
        onEditContent({
          targetKind: editorTarget,
          package: next.package,
          review: {
            sourceText: source,
            assumptions: generated.draft.assumptions,
            unsupported: generated.draft.unsupported,
          },
        })
        setInstallNotice(`AI 已完成结构化，并把${dnd5eLocalContentAiTargetLabel(editorTarget)}载入对应工坊编辑器。`)
      }
    } catch (reason) {
      setError(dnd5eLocalContentAiErrorMessage(reason))
    } finally {
      setAiBusy(false)
    }
  }

  const clear = () => {
    localStorage.removeItem(draftStorageKey)
    setSource('')
    setResult(null)
    setDraft('')
    setPrepared(null)
    setCoverage(null)
    setError(null)
    setInstallNotice(null)
    setDraftNotice(null)
    setShowJsonEditor(false)
  }

  const deleteDraft = async () => {
    if (!await showAppConfirm({
      title: '删除 AI 转换草稿',
      message: '这会删除当前浏览器中本房间保存的原文与转换 JSON；已经启用的规则和已保存到结构化工坊的内容不会被删除。',
      confirmLabel: '确认删除草稿',
      tone: 'danger',
    })) return
    clear()
  }

  const unavailable = busy || aiBusy || installBusy
  const editableTarget = prepared
    ? editableTargetInPreparedPackage(prepared, result?.targetKind ?? targetKind)
    : null

  const editPreparedInWorkshop = () => {
    if (!prepared || !editableTarget || !onEditContent) return
    onEditContent({
      targetKind: editableTarget,
      package: prepared.package,
      review: {
        sourceText: source,
        assumptions: result?.draft.assumptions,
        unsupported: result?.draft.unsupported,
      },
    })
    setInstallNotice(`已将${dnd5eLocalContentAiTargetLabel(editableTarget)}载入对应工坊编辑器；可继续校对后保存。`)
  }

  return (
    <section
      data-testid="local-room-json-paste"
      className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-5"
    >
      <div className="flex items-start gap-3">
        <ClipboardPaste className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-amber-100">粘贴规则 → AI 转换 → DM 确认</h2>
          <p className="mt-1 text-xs leading-5 text-amber-100/60">
            粘贴自然语言规则、表格文本或现成 JSON。JSON 可直接校验；其他文本由你配置的模型 API
            转换为可编辑草稿。只有通过 Host 校验并由 DM 确认后才会启用，粘贴内容不会被当作代码执行。
          </p>
          <label className="mt-4 block max-w-md">
            <span className="mb-1.5 block text-xs font-semibold text-amber-100/75">AI 分析接口</span>
            <select
              data-testid="local-room-ai-target-kind"
              value={targetKind}
              onChange={(event) => {
                setTargetKind(event.currentTarget.value as Dnd5eLocalContentAiTargetKind)
                setResult(null)
                setDraft('')
                setPrepared(null)
                setCoverage(null)
                setError(null)
                setInstallNotice(null)
              }}
              className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-amber-300/35"
            >
              {DND5E_LOCAL_CONTENT_AI_TARGETS.map((target) => (
                <option key={target.id} value={target.id}>{target.label}</option>
              ))}
            </select>
            <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">
              {DND5E_LOCAL_CONTENT_AI_TARGETS.find((target) => target.id === targetKind)?.description}
            </span>
          </label>
          <textarea
            data-testid="local-room-json-paste-input"
            value={source}
            onChange={(event) => setSource(event.currentTarget.value)}
            placeholder={'示例：\n新增一个名为“霜火箭”的自定义法术……\n\n或粘贴：\n{\n  "name": "我的房间规则",\n  "spells": []\n}'}
            spellCheck={false}
            className="mt-4 min-h-56 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs leading-5 text-slate-200 outline-none focus:border-amber-300/35"
          />
          <div className="mt-4">
            <AiProviderSelector
              value={selection}
              onChange={setSelection}
              taskProfile="resource-structuring"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={unavailable || !source.trim()}
              onClick={() => void importSourceAsJson()}
              className="rounded-xl bg-amber-400/15 px-4 py-2 text-xs font-semibold text-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiBusy ? '正在校验…' : '作为 JSON 直接校验并启用'}
            </button>
            <button
              type="button"
              data-testid="local-room-ai-convert"
              disabled={unavailable || !source.trim()}
              onClick={() => void convertWithAi()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiBusy
                ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />AI 正在生成草稿…</>
                : <><Sparkles className="h-3.5 w-3.5" />AI 转换为待确认草稿</>}
            </button>
            <button
              type="button"
              disabled={unavailable || (!source && !draft)}
              onClick={() => void deleteDraft()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/20 px-4 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />删除 AI 草稿
            </button>
          </div>

          {draftNotice && (
            <p data-testid="local-room-ai-draft-restored" className="mt-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.04] px-3 py-2 text-xs leading-5 text-sky-100/75">
              {draftNotice}内容只保存在本浏览器，不会上传或随扩展分发。
            </p>
          )}

          {error && (
            <p data-testid="local-room-ai-error" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs leading-5 text-rose-200">
              {error}
            </p>
          )}

          {installNotice && (
            <p data-testid="local-room-ai-install-success" className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-2 text-xs leading-5 text-emerald-100">
              {installNotice}
            </p>
          )}

          {(result || draft) && (
            <section data-testid="local-room-ai-preview" className="mt-5 rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-violet-100">
                    <Bot className="h-4 w-4" />DM 预览：尚未导入
                  </h3>
                  <p className="mt-1 text-[11px] leading-5 text-violet-100/55">
                    {result
                      ? `由 ${result.provider.name}${result.model ? ` / ${result.model.name}` : ''} 生成。`
                      : '这是尚未导入的可编辑草稿。'}
                    修改 JSON 后必须重新校验，确认按钮才会恢复。
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${prepared
                  ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                  : 'border-amber-400/20 bg-amber-500/10 text-amber-200'}`}
                >
                  {prepared ? 'Host 校验通过' : '等待 Host 校验'}
                </span>
              </div>

              {result && (
                <div data-testid="local-room-ai-routing-result" className="mt-3 rounded-xl border border-sky-400/15 bg-sky-500/[0.04] px-3 py-2 text-[10px] leading-4 text-sky-100/70">
                  <strong className="text-sky-200">模型路由：</strong>
                  {result.routing.fallback ? (
                    result.routing.fallbackUsed
                      ? <>Luna 结果未通过 Host，已升级到 <span className="text-sky-100">{result.model?.name ?? result.routing.fallback.displayName}</span> 并重新生成。</>
                      : <><span className="text-sky-100">{result.model?.name ?? result.routing.primary.displayName}</span> 已通过 Host，未调用 Terra。</>
                  ) : (
                    <>当前使用单模型 <span className="text-sky-100">{result.model?.name ?? result.routing.primary.displayName}</span>；未发生付费升级重试。</>
                  )}
                </div>
              )}

              {result && (result.draft.assumptions.length > 0 || result.draft.unsupported.length > 0) && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.04] p-3">
                    <h4 className="text-[11px] font-semibold text-amber-100">模型假设</h4>
                    {result.draft.assumptions.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[10px] leading-4 text-amber-100/65">
                        {result.draft.assumptions.slice(0, 20).map((entry, index) => <li key={`${index}-${entry}`}>· {entry}</li>)}
                      </ul>
                    ) : <p className="mt-2 text-[10px] text-slate-600">无</p>}
                  </div>
                  <div className="rounded-xl border border-rose-400/15 bg-rose-500/[0.04] p-3">
                    <h4 className="text-[11px] font-semibold text-rose-100">未支持／需 DM 处理</h4>
                    {result.draft.unsupported.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-[10px] leading-4 text-rose-100/65">
                        {result.draft.unsupported.slice(0, 20).map((entry, index) => <li key={`${index}-${entry}`}>· {entry}</li>)}
                      </ul>
                    ) : <p className="mt-2 text-[10px] text-slate-600">无</p>}
                  </div>
                </div>
              )}

              <button
                type="button"
                aria-expanded={showJsonEditor}
                onClick={() => setShowJsonEditor((current) => !current)}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-[11px] font-semibold text-slate-400 hover:text-slate-200"
              >
                <FileJson className="h-3.5 w-3.5" />
                {showJsonEditor ? '收起高级 JSON 编辑器' : '高级：查看或编辑生成的 JSON'}
              </button>

              <textarea
                data-testid="local-room-ai-draft-json"
                value={draft}
                onChange={(event) => {
                  setDraft(event.currentTarget.value)
                  setPrepared(null)
                  setCoverage(null)
                  setError(null)
                  setInstallNotice(null)
                }}
                spellCheck={false}
                aria-hidden={!showJsonEditor}
                tabIndex={showJsonEditor ? 0 : -1}
                className={`${showJsonEditor ? 'block' : 'hidden'} mt-3 min-h-72 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40`}
              />

              {prepared && coverage && (
                <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-3">
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-3 lg:grid-cols-5">
                    {[
                      ['种族', prepared.package.content.races.length],
                      ['背景', prepared.package.content.backgrounds.length],
                      ['特性', prepared.package.content.features.length],
                      ['专长', prepared.package.content.feats.length],
                      ['法术', prepared.package.content.spells.length],
                      ['物品', prepared.package.content.items.length],
                      ['职业', prepared.package.content.classes?.length ?? 0],
                      ['Headless 动作', prepared.package.content.headlessActions.length],
                      ['子职', prepared.package.content.subclasses.length],
                      ['怪物', prepared.package.content.monsters.length],
                    ].map(([label, count]) => (
                      <div key={String(label)} className="rounded-lg bg-black/20 px-2 py-2 text-slate-400">
                        <span className="block text-base font-semibold text-slate-100">{count}</span>{label}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-emerald-100/65">
                    自动化覆盖：完整 {coverage.totals.full}、部分 {coverage.totals.partial}、
                    手动 {coverage.totals.manual}、仅资料 {coverage.totals.referenceOnly}。
                    Activity 迁移：通用 {coverage.activityMigration.adapted}、兼容回退 {coverage.activityMigration.legacyFallback}、
                    DM 裁定 {coverage.activityMigration.dmAdjudication}。
                    校验通过不代表规则语义一定正确，仍需 DM 阅读草稿。
                  </p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={unavailable || !draft.trim()}
                  onClick={() => void previewDraft(draft)}
                  className="rounded-xl border border-violet-400/25 bg-violet-500/10 px-4 py-2 text-xs font-semibold text-violet-100 disabled:opacity-50"
                >
                  重新校验预览
                </button>
                {editableTarget && onEditContent && (
                  <button
                    type="button"
                    data-testid="local-room-ai-edit-content"
                    disabled={unavailable}
                    onClick={editPreparedInWorkshop}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" />载入{dnd5eLocalContentAiTargetLabel(editableTarget)}编辑器
                  </button>
                )}
                <button
                  type="button"
                  data-testid="local-room-ai-confirm-import"
                  disabled={unavailable || !prepared}
                  onClick={() => prepared && void installPrepared(prepared)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {installBusy
                    ? <><LoaderCircle className="h-3.5 w-3.5 animate-spin" />正在启用…</>
                    : <><CheckCircle2 className="h-3.5 w-3.5" />{editableTarget ? '直接启用（跳过工坊）' : 'DM 确认并启用'}</>}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
