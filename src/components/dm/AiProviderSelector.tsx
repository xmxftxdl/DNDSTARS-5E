import { useEffect, useState, useSyncExternalStore } from 'react'
import { Cloud, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, Unplug } from 'lucide-react'
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
  'astraltrace-cloud': Cloud,
  'external-account': KeyRound,
} as const

const SELECTABLE_AI_PROVIDER_CATALOG = BUILTIN_AI_PROVIDER_CATALOG.filter((provider) => provider.id !== 'local-bridge')

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
  taskProfile?: 'pdf-campaign' | 'resource-structuring'
}) {
  const selectedProvider = SELECTABLE_AI_PROVIDER_CATALOG.find((provider) => provider.id === value.providerId)
  const bridge = useSyncExternalStore(subscribeLocalAiBridge, localAiBridgeSnapshot, localAiBridgeSnapshot)
  const [pairingCode, setPairingCode] = useState('')
  const [bridgeBusy, setBridgeBusy] = useState(false)
  const [bridgeError, setBridgeError] = useState<string | null>(null)
  const bridgeProviderSelected = value.providerId === 'external-account'
  const modelSupportsProfile = (model: (typeof bridge.models)[number]) =>
    taskProfile !== 'resource-structuring' || (
      model.supportedTasks.includes('resource-structuring') &&
      model.capabilities.includes('structured-output')
    )
  const bridgeModels = bridge.models.filter((model) =>
    model.providerId === value.providerId && modelSupportsProfile(model))
  const pdfModelRouting = taskProfile === 'pdf-campaign'
    ? selectPdfAnalysisModelRouting(bridge.models, value)
    : null

  useEffect(() => {
    if (value.providerId !== 'local-bridge') return
    onChange({ ...value, providerId: 'external-account', modelId: undefined, allowPaidFallback: false })
  }, [onChange, value])

  useEffect(() => {
    if (!bridgeProviderSelected || bridge.status !== 'unknown') return
    void probeLocalAiBridge()
  }, [bridge.status, bridgeProviderSelected])

  useEffect(() => {
    if (!bridgeProviderSelected || bridge.status !== 'ready') return
    const first = bridgeModels[0]
    const currentStillAvailable = bridgeModels.some((model) => model.id === value.modelId)
    if (!currentStillAvailable && first) onChange({ ...value, modelId: first.id })
    else if (!currentStillAvailable && !first && value.modelId) onChange({ ...value, modelId: undefined })
  }, [bridge.status, bridgeModels, bridgeProviderSelected, onChange, value])

  const pairBridge = async () => {
    setBridgeBusy(true)
    setBridgeError(null)
    try {
      const next = await pairLocalAiBridge(pairingCode)
      const first = next.models.find((model) => model.providerId === value.providerId && modelSupportsProfile(model))
      onChange({ ...value, modelId: first?.id })
      setPairingCode('')
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : '本机 Bridge 配对失败。')
    } finally {
      setBridgeBusy(false)
    }
  }

  const reprobeBridge = async () => {
    setBridgeBusy(true)
    setBridgeError(null)
    try {
      await probeLocalAiBridge()
    } catch (error) {
      setBridgeError(error instanceof Error ? error.message : '检测失败。')
    } finally {
      setBridgeBusy(false)
    }
  }

  return (
    <section aria-labelledby="ai-provider-heading" className="rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="ai-provider-heading" className="text-sm font-semibold text-slate-100">AI 执行方式</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">DM 可以选择平台模型或自己的模型 API；本机 Bridge 必须先完成一次配对。</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-500/8 px-2 py-1 text-[10px] text-emerald-200">
          <ShieldCheck className="h-3 w-3" />Host 校验输出
        </span>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {SELECTABLE_AI_PROVIDER_CATALOG.map((provider) => {
          const Icon = PROVIDER_ICONS[provider.id as keyof typeof PROVIDER_ICONS] ?? Cloud
          const selected = provider.id === value.providerId
          const providerBridgeModels = bridge.models.filter((model) =>
            model.providerId === provider.id && modelSupportsProfile(model))
          const usesBridge = provider.id === 'external-account'
          const effectiveStatus = usesBridge
            ? bridge.status === 'ready' && providerBridgeModels.length > 0 ? 'ready'
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
                allowPaidFallback: false,
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
                {provider.dataBoundary === 'local-only' ? '资料留在本机' : '资料发送至所选云端模型'}
              </span>
            </button>
          )
        })}
      </div>

      {bridgeProviderSelected && (
        <div className="mt-3 rounded-xl border border-white/8 bg-black/15 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-200">
                模型 API Bridge 配对
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-600">
                在 DM 电脑的项目目录运行 <code className="text-slate-400">npm run local-ai-bridge</code>，然后输入终端显示的六位配对码。访问令牌只保存在当前浏览器。
              </p>
            </div>
            <button
              type="button"
              disabled={bridgeBusy}
              onClick={() => void reprobeBridge()}
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
                    <option value="">Bridge 未配置模型 API</option>
                  )}
                  {bridgeModels.map((model) => <option key={model.id} value={model.id}>{model.displayName}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => disconnectLocalAiBridge()}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-400/15 px-2.5 py-1.5 text-[10px] text-rose-200"
                >
                  <Unplug className="h-3 w-3" />断开配对
                </button>
              </div>
              {pdfModelRouting && (
                <div className="mt-2 rounded-lg border border-sky-400/12 bg-sky-500/[0.035] px-3 py-2 text-[10px] leading-4 text-slate-400">
                  <strong className="text-sky-200">PDF 自动模型路由：</strong>
                  分段提取使用 <span className="text-slate-200">{pdfModelRouting.extraction.displayName}</span>
                  {' → '}全书综合使用 <span className="text-slate-200">{pdfModelRouting.synthesis.displayName}</span>。
                </div>
              )}
            </div>
          ) : bridge.status === 'offline' ? (
            <p className="mt-3 text-xs text-amber-300">未检测到 DM 本机 Bridge。请先运行启动命令，再点击“重新检测”。</p>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                aria-label="本机 Bridge 六位配对码"
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

      {selectedProvider && (
        <p className="mt-3 text-[10px] leading-4 text-slate-600">
          当前选择：{selectedProvider.displayName}。
          {selectedProvider.id === 'astraltrace-cloud'
            ? '平台付费模型后端尚未启用，选择它不会自动扣费或发送资料。'
            : '规则文本会经 DM 本机 Bridge 发送给所配置的模型 API；费用由该模型账户承担。'}
        </p>
      )}
    </section>
  )
}
