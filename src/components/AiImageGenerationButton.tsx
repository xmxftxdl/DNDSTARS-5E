import { useState } from 'react'
import { createPortal } from 'react-dom'
import { LoaderCircle, Sparkles, X } from 'lucide-react'
import {
  generateLocalAiPortrait,
  LocalAiBridgeError,
  localAiPortraitErrorMessage,
  type LocalAiPortraitGenerationInput,
  type LocalAiPortraitGenerationResult,
} from '../lib/localAiBridgeApi'

interface AiImageGenerationButtonProps {
  defaultPrompt: string
  onGenerated: (result: LocalAiPortraitGenerationResult) => void | Promise<void>
  aspect?: NonNullable<LocalAiPortraitGenerationInput['aspect']>
  background?: NonNullable<LocalAiPortraitGenerationInput['background']>
  label?: string
  title?: string
  description?: string
  disabled?: boolean
  className?: string
}

export default function AiImageGenerationButton({
  defaultPrompt,
  onGenerated,
  aspect = 'portrait-3:4',
  background,
  label = 'AI 生成',
  title = 'AI 生成图片',
  description = '可以先修改提示词。生成结果确认写入后，仍可用本地图片替换。',
  disabled = false,
  className = '',
}: AiImageGenerationButtonProps) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const generate = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await generateLocalAiPortrait({ prompt, aspect, quality: 'low', background })
      await onGenerated(result)
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof LocalAiBridgeError
        ? localAiPortraitErrorMessage(cause)
        : cause instanceof Error ? cause.message : 'AI 图片生成失败。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPrompt(defaultPrompt)
          setError('')
          setOpen(true)
        }}
        disabled={disabled || busy}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => { if (!busy) setOpen(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-xl rounded-2xl border border-violet-400/20 bg-void-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-violet-500/10 p-2 text-violet-200"><Sparkles className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-100">{title}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="关闭 AI 图片生成" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-300">生成提示词</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                minLength={20}
                maxLength={4_000}
                rows={8}
                disabled={busy}
                className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm leading-6 text-slate-100 outline-none focus:border-violet-400/50 disabled:opacity-60"
              />
            </label>
            <p className="mt-3 text-[10px] leading-4 text-slate-500">固定使用低成本标准品质（low），不会请求 medium 或 high 品质。</p>
            {error && <p role="alert" className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-40">取消</button>
              <button type="button" disabled={busy || prompt.trim().length < 20} onClick={() => void generate()} className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? '正在生成…' : '生成并使用'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
