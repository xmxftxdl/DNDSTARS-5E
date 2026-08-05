import { useRef, useState } from 'react'
import { Crop, ImagePlus, LoaderCircle, Sparkles, Trash2, X } from 'lucide-react'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { generateLocalAiPortrait, localAiPortraitErrorMessage } from '../../lib/localAiBridgeApi'
import CharacterPortraitCropDialog from '../character/CharacterTokenCropDialog'
import { buildDnd5eMonsterPortraitPrompt } from './dnd5eMonsterPortraitPrompt'

interface Props {
  name: string
  englishName: string
  size: string
  creatureType: string
  alignment: string
  description: string
  portrait?: string
  tokenPortrait?: string
  initiativePortrait?: string
  onPortraitChange: (portrait?: string) => void
  onTokenPortraitChange: (portrait?: string) => void
  onInitiativePortraitChange: (portrait?: string) => void
}

async function generatedDataUrlToPortrait(dataUrl: string, name: string): Promise<string> {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const extension = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
  return await createCharacterPortraitDataUrl(new File(
    [blob],
    `${name.trim() || 'monster'}-portrait.${extension}`,
    { type: blob.type || 'image/png' },
  ))
}

export default function Dnd5eMonsterPortraitStudio({
  name,
  englishName,
  size,
  creatureType,
  alignment,
  description,
  portrait,
  tokenPortrait,
  initiativePortrait,
  onPortraitChange,
  onTokenPortraitChange,
  onInitiativePortraitChange,
}: Props) {
  const uploadRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState<string>()
  const [cropMode, setCropMode] = useState<'token' | 'initiative' | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const generatedPrompt = buildDnd5eMonsterPortraitPrompt({ name, englishName, size, creatureType, alignment, description })
  const prompt = customPrompt ?? generatedPrompt

  const applyMasterPortrait = (next: string, noticeText: string) => {
    onPortraitChange(next)
    onTokenPortraitChange(undefined)
    onInitiativePortraitChange(undefined)
    setNotice(`${noticeText}。接下来依次选择地图 Token 与先攻立绘取景。`)
    setCropMode('token')
  }

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      applyMasterPortrait(await createCharacterPortraitDataUrl(file), '完整立绘已写入草稿')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法处理这张怪物立绘。')
    } finally {
      setBusy(false)
    }
  }

  const generate = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const generated = await generateLocalAiPortrait({ prompt, aspect: 'portrait-3:4' })
      const next = await generatedDataUrlToPortrait(generated.dataUrl, name)
      applyMasterPortrait(next, `AI 立绘已生成（${generated.modelId}）`)
      setAiOpen(false)
    } catch (cause) {
      setError(localAiPortraitErrorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-3 rounded-2xl border border-violet-400/15 bg-violet-500/[0.025] p-3" data-testid="monster-portrait-studio">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">怪物立绘资产</h4>
          <p className="mt-1 text-[11px] leading-5 text-slate-400">先上传或由 AI 生成完整立绘，再从同一张图分别选择地图 Token 和先攻立绘取景。</p>
        </div>
        {portrait && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onPortraitChange(undefined)
              onTokenPortraitChange(undefined)
              onInitiativePortraitChange(undefined)
              setNotice('')
              setError('')
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-rose-300 hover:bg-rose-500/10 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />移除全部立绘
          </button>
        )}
      </div>

      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void upload(file)
          event.currentTarget.value = ''
        }}
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(250px,0.9fr)_minmax(0,1.4fr)]">
        <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <div className="aspect-[3/4] h-36 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-void-950">
            {portrait
              ? <img src={portrait} alt={`${name || '怪物'}完整立绘`} className="h-full w-full object-cover" />
              : <div className="flex h-full w-full items-center justify-center text-slate-600"><ImagePlus className="h-6 w-6" /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-slate-200">完整立绘</p>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">房间草稿会保存压缩后的 3:4 原图，之后可随时重新取景。</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-40">
                <ImagePlus className="h-3.5 w-3.5" />{portrait ? '替换立绘' : '上传立绘'}
              </button>
              <button type="button" disabled={busy} onClick={() => setAiOpen((current) => !current)} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-2 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/20 disabled:opacity-40">
                <Sparkles className="h-3.5 w-3.5" />AI 生成立绘
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {([
            {
              key: 'token' as const,
              label: '地图 Token',
              value: tokenPortrait,
              frame: 'h-24 w-24 rounded-full',
              hint: '圆形头像，用于地图棋子。',
            },
            {
              key: 'initiative' as const,
              label: '先攻立绘',
              value: initiativePortrait,
              frame: 'h-28 w-[5.4rem] rounded-lg',
              hint: '窄幅立绘，用于先攻栏。',
            },
          ]).map((entry) => (
            <div key={entry.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className={`shrink-0 overflow-hidden border border-white/10 bg-void-950 ${entry.frame}`}>
                {entry.value
                  ? <img src={entry.value} alt={entry.label} className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-slate-600"><Crop className="h-5 w-5" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200">{entry.label}</p>
                <p className="mt-1 text-[10px] leading-4 text-slate-500">{entry.hint}</p>
                <button
                  type="button"
                  disabled={!portrait || busy}
                  onClick={() => setCropMode(entry.key)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <Crop className="h-3.5 w-3.5" />{entry.value ? '重新取景' : '从立绘取景'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {aiOpen && (
        <div className="mt-3 rounded-xl border border-violet-400/15 bg-black/15 p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs font-semibold text-violet-100" htmlFor="monster-ai-portrait-prompt">AI 立绘提示词</label>
            <button type="button" onClick={() => setAiOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-white" aria-label="关闭 AI 立绘设置"><X className="h-3.5 w-3.5" /></button>
          </div>
          <textarea
            id="monster-ai-portrait-prompt"
            rows={5}
            value={prompt}
            maxLength={4_000}
            onChange={(event) => setCustomPrompt(event.target.value)}
            className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-void-950/80 px-3 py-2 text-xs leading-5 text-slate-200 outline-none focus:border-violet-400"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">只发送上方提示词给当前 Local AI Bridge 图片模型，不会发送完整怪物 JSON；生成前可删去不希望提交的描述。</p>
            <div className="flex gap-2">
              <button type="button" disabled={busy || customPrompt == null} onClick={() => setCustomPrompt(undefined)} className="rounded-lg px-2.5 py-1.5 text-[10px] text-slate-300 hover:bg-white/[0.06] disabled:opacity-40">按当前资料重置</button>
              <button type="button" disabled={busy || prompt.trim().length < 20} onClick={() => void generate()} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-400 disabled:opacity-40">
                {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {busy ? '生成中…' : '生成并开始取景'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(notice || error) && <p className={`mt-3 text-[11px] leading-5 ${error ? 'text-rose-300' : 'text-emerald-300'}`}>{error || notice}</p>}

      {cropMode && portrait && (
        <CharacterPortraitCropDialog
          key={cropMode}
          portrait={portrait}
          name={name || '怪物'}
          mode={cropMode}
          onCancel={() => setCropMode(null)}
          onConfirm={(next) => {
            if (cropMode === 'token') {
              onTokenPortraitChange(next)
              setNotice('地图 Token 已保存；现在选择先攻立绘取景。')
              setCropMode('initiative')
            } else {
              onInitiativePortraitChange(next)
              setNotice('地图 Token 与先攻立绘均已从完整立绘生成并写入草稿。')
              setCropMode(null)
            }
          }}
        />
      )}
    </section>
  )
}
