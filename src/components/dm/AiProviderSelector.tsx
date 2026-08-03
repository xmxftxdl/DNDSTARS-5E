import { useEffect, useState, useSyncExternalStore } from 'react'
import { Cloud, Coins, Cpu, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Unplug } from 'lucide-react'
import type { AiProviderSelectionV1 } from '../../../shared/ai-provider.mjs'
import { BUILTIN_AI_PROVIDER_CATALOG } from '../../lib/aiProvider'
import {
  disconnectLocalAiBridge,
  localAiBridgeSnapshot,
  pairLocalAiBridge,
  probeLocalAiBridge,
  subscribeLocalAiBridge,
} from '../../lib/localAiBridgeApi'
import { selectPdfAnalysisModelRouting } from '../../lib/pdfCampaignAnalysis'

const PROVIDER_ICONS = {
  'local-bridge': Cpu,
  'astraltrace-cloud': Cloud,
  'external-account': KeyRound,
} as const

const STATUS_LABELS = {
  ready: '已连接',
  offline: '离线',
  unconfigured: '待配置',
  disabled: '已停用',
} as const

export default function AiProviderSelector({
  value,
  onChange,
  taskProfile,
}: {
  value: AiProviderSelectionV1
  onChange: (value: AiProviderSelectionV1) => void
  taskProfile?: 'pdf-campaign'
}) {
  const selectedProvider = BUILTIN_AI_PROVIDER_CATALOG.find((provider) => provider.id === value.providerId)
  const bridge = useSyncExternalStore(subscribeLocalAiBridge, localAiBridgeSnapshot, localAiBridgeSnapshot)
  const [pairingCode, setPairingCode] = useState('')
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const bridgeProviderSelected = value.providerId === 'local-bridge' || value.providerId === 'external-account'
  const bridgeModels = bridge.models.filter((model) => model.providerId === value.providerId)
  const pdfModelRouting = taskProfile === 'pdf-campaign'
    ? selectPdfAnalysisModelRouting(bridge.models, value)
    : null

  useEffect(() => {
    if (!bridgeProviderSelected || bridge.status !== 'unknown') return
    void probeLocalAiBridge()
  }, [bridge.status, bridgeProviderSelected])

  useEffect(() => {
    if (!bridgeProviderSelected || bridge.status !== 'ready' || value.modelId) return
    const first = bridgeModels[0]
    if (first) onChange({ ...value, modelId: first.id })
  }, [bridge.status, bridgeModels, bridgeProviderSelected, onChange, value])

  const pairBridge = async () => {
    setBridgeBusy(true)
    setBridgeError(null)
    try {
      const next = await pairLocalAiBridge(pairingCode)
      const first = next.models.find((model) => model.providerId === value.providerId)
      onChange({ ...value, modelId: first?.id })
      setPairingCode('')
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : '本地 Bridge 配对失败。')
    } finally {
      setBridgeBusy(false)
    }
  }

  return (
    <section aria-labelledby="ai-provider-heading" className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="ai-provider-heading" className="text-sm font-semibold text-slate-100">AI 执行方式</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">DM 可以按任务选择本地免费、平台付费或自己的模型账户。</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-500/8 px-2 py-1 text-[10px] text-emerald-200">
          <ShieldCheck className="h-3 w-3" />Host 校验输出
        </span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-3">
        {BUILTIN_AI_PROVIDER_CATALOG.map((provider) => {
          const Icon = PROVIDER_ICONS[provider.id as keyof typeof PROVIDER_ICONS] ?? Cloud
          const selected = provider.id === value.providerId
          const providerBridgeModels = bridge.models.filter((model) => model.providerId === provider.id)
          const effectiveStatus = provider.id === 'local-bridge' || provider.id === 'external-account'
            ? bridge.status === 'ready' && (provider.id === 'local-bridge' || providerBridgeModels.length > 0) ? 'ready'
              : bridge.status === 'offline' ? 'offline'
                : 'unconfigured'
            : provider.status
          return (
            <button
              key={provider.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({
                ...value,
                providerId: provider.id,
                modelId: undefined,
                ...(provider.pricing.mode === 'platform-credit' && value.maxCreditsPerTask === 0
                  ? { maxCreditsPerTask: 100 }
                  : {}),
              })}
              className={`rounded-xl border p-3 text-left transition ${selected
                ? 'border-violet-400/40 bg-violet-500/10'
                : 'border-white/8 bg-black/15 hover:border-white/15'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <Icon className="h-4 w-4 text-violet-300" />{provider.displayName}
                </span>
                <span className="rounded-full border border-white/8 px-2 py-0.5 text-[9px] text-slate-500">
                  {STATUS_LABELS[effectiveStatus]}
                </span>
              </span>
              <span className="mt-2 block text-[10px] leading-4 text-slate-500">{provider.description}</span>
              <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[9px] ${provider.dataBoundary === 'local-only'
                ? 'bg-emerald-500/10 text-emerald-200'
                : 'bg-sky-500/10 text-sky-200'}`}
              >
                {provider.dataBoundary === 'local-only' ? '资料留在本机' : '资料发送至云端'}
              </span>
            </button>
          )
        })}
      </div>

      {bridgeProviderSelected && (
        <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {value.providerId === 'local-bridge' ? 'Local AI Bridge' : '模型 API Bridge'}
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                {value.providerId === 'local-bridge' ? (
                  <>在 DM 电脑的项目目录运行 <code className="text-slate-400">npm run local-ai-bridge</code>，然后输入终端显示的六位配对码。</>
                ) : (
                  <>设置共享的 <code className="text-slate-400">ASTRALTRACE_MODEL_API_URL</code> 与 <code className="text-slate-400">ASTRALTRACE_MODEL_API_KEY</code>，再分别设置 <code className="text-slate-400">ASTRALTRACE_EXTRACTION_MODEL_ID</code> 和 <code className="text-slate-400">ASTRALTRACE_SYNTHESIS_MODEL_ID</code>。两个阶段也可各自覆盖 API URL 与 Key。密钥不会发给浏览器。</>
                )}
              </p>
              {value.providerId === 'external-account' && (
                <p className="mt-1.5 text-[10px] leading-4 text-slate-500">
                  如需在人物档案中直接生成立绘，再设置 <code className="text-slate-400">ASTRALTRACE_IMAGE_MODEL_ID=gpt-image-2</code>。
                  图片生成默认复用上方 API URL 与 Key，也可用 <code className="text-slate-400">ASTRALTRACE_IMAGE_MODEL_API_URL</code> 和 <code className="text-slate-400">ASTRALTRACE_IMAGE_MODEL_API_KEY</code> 单独配置。
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={bridgeBusy}
              onClick={() => {
                setBridgeBusy(true)
                setBridgeError(null)
                void probeLocalAiBridge()
                  .catch((error) => setBridgeError(error instanceof Error ? error.message : '检测失败'))
                  .finally(() => setBridgeBusy(false))
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300 disabled:opacity-50"
            >
              {bridgeBusy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}重新检测
            </button>
          </div>

          {bridge.status === 'ready' ? (
            <div className="mt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">已安全配对</span>
                <select
                  value={value.modelId ?? ''}
                  onChange={(event) => onChange({ ...value, modelId: event.currentTarget.value || undefined })}
                  className="min-w-56 rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-xs text-slate-200"
                >
                  {bridgeModels.length === 0 && (
                    <option value="">{value.providerId === 'local-bridge' ? '未发现 Ollama／llama.cpp 模型' : 'Bridge 未配置模型 API'}</option>
                  )}
                  {bridgeModels.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => disconnectLocalAiBridge()}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-[10px] text-rose-200"
                >
                  <Unplug className="h-3 w-3" />断开
                </button>
              </div>
              {pdfModelRouting && (
                <div className="mt-2 rounded-lg border border-sky-400/12 bg-sky-500/[0.035] px-3 py-2 text-[10px] leading-4 text-slate-400">
                  <strong className="text-sky-200">PDF 自动模型路由：</strong>
                  分段提取使用 <span className="text-slate-200">{pdfModelRouting.extraction.displayName}</span>
                  {' → '}全书综合使用 <span className="text-slate-200">{pdfModelRouting.synthesis.displayName}</span>。
                  {value.providerId === 'local-bridge' && !pdfModelRouting.extractionUsedPreferredSize && (
                    <span className="ml-1 text-amber-200">未发现 7–14B 模型，分段阶段暂时沿用现有模型。</span>
                  )}
                  {value.providerId === 'external-account' && !pdfModelRouting.automatic && (
                    <span className="ml-1 text-amber-200">尚未分别配置提取与综合模型，两个阶段会使用同一模型。</span>
                  )}
                </div>
              )}
            </div>
          ) : bridge.status === 'offline' ? (
            <p className="mt-3 text-xs text-amber-300">未检测到 DM 本机 Bridge。请先运行启动命令，再点击“重新检测”。</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={pairingCode}
                inputMode="numeric"
                maxLength={6}
                placeholder="六位配对码"
                onChange={(event) => setPairingCode(event.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                className="w-36 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs tracking-[0.25em] text-slate-200 outline-none focus:border-violet-400/40"
              />
              <button
                type="button"
                disabled={bridgeBusy || pairingCode.length !== 6}
                onClick={() => void pairBridge()}
                className="rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                配对 Bridge
              </button>
            </div>
          )}
          {bridgeError && <p className="mt-2 text-[10px] text-rose-300">{bridgeError}</p>}
        </div>
      )}

      <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
        <label className="flex items-start gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={value.allowPaidFallback}
            onChange={(event) => onChange({
              ...value,
              allowPaidFallback: event.currentTarget.checked,
              maxCreditsPerTask: event.currentTarget.checked && value.maxCreditsPerTask === 0 ? 100 : value.maxCreditsPerTask,
            })}
            className="mt-0.5 accent-violet-500"
          />
          <span>
            本地模型不可用时，允许改用 Astral Trace 付费模型
            <small className="mt-1 block text-[10px] leading-4 text-slate-600">默认关闭。未明确勾选时，系统只会暂停任务，不会自动扣除 AI Credit。</small>
          </span>
        </label>
        {value.allowPaidFallback && (
          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <Coins className="h-4 w-4 text-amber-300" />单次任务最多
            <input
              type="number"
              min={1}
              max={1_000_000}
              value={value.maxCreditsPerTask}
              onChange={(event) => onChange({
                ...value,
                maxCreditsPerTask: Math.min(1_000_000, Math.max(1, Number(event.currentTarget.value) || 1)),
              })}
              className="w-24 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-slate-200 outline-none focus:border-violet-400/40"
            />AI Credit
          </label>
        )}
      </div>

      {selectedProvider && (
        <p className="mt-3 text-[10px] leading-4 text-slate-600">
          当前选择：{selectedProvider.displayName}。
          {selectedProvider.id === 'astraltrace-cloud'
            ? '平台付费模型后端尚未启用，选择它不会自动扣费或发送资料。'
            : selectedProvider.id === 'external-account'
              ? '规则文本会经 DM 本机 Bridge 发送给所配置的模型 API；费用由该模型账户承担。'
              : '本地模型执行时规则文本不离开 DM 电脑。'}
        </p>
      )}
    </section>
  )
}
