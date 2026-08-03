import { useState } from 'react'
import { Bot, CheckCircle2, ClipboardPaste, LoaderCircle, Sparkles } from 'lucide-react'
import AiProviderSelector from './AiProviderSelector'
import { AiProviderRegistryV1, DEFAULT_AI_PROVIDER_SELECTION } from '../../lib/aiProvider'
import {
  createExternalAiBridgeRuntime,
  createLocalAiBridgeRuntime,
  localAiBridgeSnapshot,
} from '../../lib/localAiBridgeApi'
import {
  dnd5eContentPackageAutomationCoverageV2,
  dnd5eLocalContentAiErrorMessage,
  generateDnd5eLocalContentAiDraft,
  prepareDnd5eLocalContentJson,
  type Dnd5eContentAutomationCoverageReportV2,
  type GeneratedDnd5eLocalContentAiDraftV1,
  type PreparedDnd5eLocalContentJson,
} from '../../rulesets/dnd5e'

export default function Dnd5eLocalRulesAiImporter({
  busy,
  onInstall,
}: {
  busy: boolean
  onInstall: (file: File) => Promise<void>
}) {
  const [source, setSource] = useState('')
  const [selection, setSelection] = useState(() => ({ ...DEFAULT_AI_PROVIDER_SELECTION }))
  const [aiBusy, setAiBusy] = useState(false)
  const [result, setResult] = useState<GeneratedDnd5eLocalContentAiDraftV1 | null>(null)
  const [draft, setDraft] = useState('')
  const [prepared, setPrepared] = useState<PreparedDnd5eLocalContentJson | null>(null)
  const [coverage, setCoverage] = useState<Dnd5eContentAutomationCoverageReportV2 | null>(null)
  const [error, setError] = useState<string | null>(null)

  const previewDraft = async (draftJson: string) => {
    setError(null)
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
  }

  const installPrepared = async (next: PreparedDnd5eLocalContentJson) => {
    if (next.audit && !next.audit.complete) {
      const accepted = window.confirm([
        '本地 JSON 缺口审计未通过，仍要导入吗？',
        `条目：${next.audit.totals.entries}`,
        `数量缺口：${next.audit.totals.countShortfall}`,
        `缺失稳定 ID：${next.audit.totals.missingIds}`,
        `缺失图片：${next.audit.totals.missingImages}`,
      ].join('\n'))
      if (!accepted) return
    }
    await onInstall(new File(
      [new Uint8Array(next.bytes)],
      next.fileName,
      { type: 'application/json' },
    ))
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
      if (selection.providerId === 'local-bridge') {
        registry.register(createLocalAiBridgeRuntime(bridge.models))
      } else if (selection.providerId === 'external-account') {
        registry.register(createExternalAiBridgeRuntime(bridge.models))
      } else {
        throw new Error('provider-runtime-missing')
      }
      const generated = await generateDnd5eLocalContentAiDraft({
        sourceText: source,
        registry,
        selection,
      })
      setResult(generated)
      setDraft(generated.draft.contentJson)
      await previewDraft(generated.draft.contentJson)
    } catch (reason) {
      setError(dnd5eLocalContentAiErrorMessage(reason))
    } finally {
      setAiBusy(false)
    }
  }

  const clear = () => {
    setSource('')
    setResult(null)
    setDraft('')
    setPrepared(null)
    setCoverage(null)
    setError(null)
  }

  const unavailable = busy || aiBusy

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
            粘贴自然语言规则、表格文本或现成 JSON。JSON 可直接校验；其他文本由本地模型或你配置的模型 API
            转换为可编辑草稿。只有通过 Host 校验并由 DM 确认后才会启用，粘贴内容不会被当作代码执行。
          </p>
          <textarea
            data-testid="local-room-json-paste-input"
            value={source}
            onChange={(event) => setSource(event.currentTarget.value)}
            placeholder={'示例：\n新增一个名为“霜火箭”的自定义法术……\n\n或粘贴：\n{\n  "name": "我的房间规则",\n  "spells": []\n}'}
            spellCheck={false}
            className="mt-4 min-h-56 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-xs leading-5 text-slate-200 outline-none focus:border-amber-300/35"
          />
          <div className="mt-4">
            <AiProviderSelector value={selection} onChange={setSelection} />
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
              onClick={clear}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-400 disabled:opacity-50"
            >
              清空
            </button>
          </div>

          {error && (
            <p data-testid="local-room-ai-error" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/8 px-3 py-2 text-xs leading-5 text-rose-200">
              {error}
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

              <textarea
                data-testid="local-room-ai-draft-json"
                value={draft}
                onChange={(event) => {
                  setDraft(event.currentTarget.value)
                  setPrepared(null)
                  setCoverage(null)
                  setError(null)
                }}
                spellCheck={false}
                className="mt-3 min-h-72 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-violet-400/40"
              />

              {prepared && coverage && (
                <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-500/[0.04] p-3">
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-5">
                    {[
                      ['种族', prepared.package.content.races.length],
                      ['背景', prepared.package.content.backgrounds.length],
                      ['法术', prepared.package.content.spells.length],
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
                <button
                  type="button"
                  data-testid="local-room-ai-confirm-import"
                  disabled={unavailable || !prepared}
                  onClick={() => prepared && void installPrepared(prepared)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />DM 确认并启用
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
