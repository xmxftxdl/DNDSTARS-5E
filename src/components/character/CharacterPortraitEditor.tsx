import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Crop, ImagePlus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import CharacterPortraitCropDialog from './CharacterTokenCropDialog'

interface CharacterPortraitEditorProps {
  name: string
  avatar: string
  accent: string
  portrait?: string
  initiativePortrait?: string
  tokenPortrait?: string
  editable?: boolean
  onChange: (portrait?: string) => void
  onInitiativePortraitChange: (initiativePortrait?: string) => void
  onTokenPortraitChange: (tokenPortrait?: string) => void
}

export default function CharacterPortraitEditor({
  name,
  avatar,
  accent,
  portrait,
  initiativePortrait,
  tokenPortrait,
  editable = true,
  onChange,
  onInitiativePortraitChange,
  onTokenPortraitChange,
}: CharacterPortraitEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [cropMode, setCropMode] = useState<'token' | 'initiative' | null>(null)

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      const next = await createCharacterPortraitDataUrl(file)
      onChange(next)
      onTokenPortraitChange(undefined)
      onInitiativePortraitChange(undefined)
      setEditorOpen(false)
      setCropMode('token')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '立绘上传失败。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full shrink-0 lg:w-56" data-testid="character-portrait-editor">
      {editable && <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-label="上传人物立绘"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file) void upload(file)
          event.currentTarget.value = ''
        }}
      />}
      <div className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10 bg-void-950/70 shadow-xl">
        {portrait ? (
          <img src={portrait} alt={`${name}的人物立绘`} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${accent}`}>
            <span className="text-7xl drop-shadow-lg">{avatar}</span>
            <span className="mt-4 px-4 text-center text-sm font-semibold text-white/85">{name}</span>
          </div>
        )}
        {editable && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-12">
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              disabled={busy}
              aria-haspopup="dialog"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25 disabled:cursor-wait disabled:opacity-50"
            >
              <ImagePlus className="h-4 w-4" />
              {busy ? '正在处理…' : '编辑立绘'}
            </button>
          </div>
        )}
      </div>

      <p className={`mt-2 text-[11px] leading-4 ${error ? 'text-rose-300' : 'text-slate-600'}`}>
        {error || (editable
          ? '人物卡、先攻栏与地图 Token 的图像均在“编辑立绘”中设置。'
          : '玩家已将人物立绘同步到当前房间。')}
      </p>

      {editorOpen && editable && createPortal(
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setEditorOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="编辑人物立绘"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-void-950 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-slate-100">编辑人物立绘</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  在一个位置管理人物卡立绘、先攻立绘和战斗地图 Token。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-3">
              <div className="aspect-[3/4] h-24 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                {portrait ? (
                  <img src={portrait} alt={`${name}的人物立绘预览`} className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br text-4xl ${accent}`}>{avatar}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{name || '未命名角色'}</p>
                <div className="mt-3 flex items-end gap-4 text-[10px] text-slate-400">
                  <span className="flex flex-col items-center gap-1">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xl ring-1 ring-white/15 ${accent}`}>
                      {tokenPortrait ? <img src={tokenPortrait} alt="地图 Token 预览" className="h-full w-full object-cover" /> : avatar}
                    </span>
                    地图 Token
                  </span>
                  <span className="flex flex-col items-center gap-1">
                    <span className={`flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-gradient-to-br text-lg ring-1 ring-white/15 ${accent}`}>
                      {initiativePortrait || portrait ? <img src={initiativePortrait || portrait} alt="先攻立绘预览" className="h-full w-full object-cover" /> : avatar}
                    </span>
                    先攻栏
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl border border-arcane-400/25 bg-arcane-500/10 px-3 py-3 text-sm font-semibold text-arcane-100 hover:bg-arcane-500/20 disabled:cursor-wait disabled:opacity-50"
              >
                <ImagePlus className="h-4 w-4" />
                {portrait ? '替换完整立绘' : '上传完整立绘'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false)
                  setCropMode('token')
                }}
                disabled={!portrait}
                data-testid="character-token-crop-toggle"
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Crop className="h-4 w-4" />调整地图 Token
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false)
                  setCropMode('initiative')
                }}
                disabled={!portrait || busy}
                data-testid="character-initiative-crop-toggle"
                className="flex items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-500/[0.08] px-3 py-3 text-sm font-semibold text-amber-100 hover:bg-amber-500/15 disabled:cursor-wait disabled:opacity-50"
              >
                <Crop className="h-4 w-4" />
                {initiativePortrait ? '调整先攻取景' : '设置先攻取景'}
              </button>
              <button
                type="button"
                onClick={() => onInitiativePortraitChange(undefined)}
                disabled={!initiativePortrait || busy}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <RotateCcw className="h-4 w-4" />跟随完整立绘
              </button>
              <button
                type="button"
                disabled
                title="AI 立绘生成功能将在后续版本接入"
                className="flex items-center justify-center gap-2 rounded-xl border border-violet-400/10 bg-violet-500/[0.06] px-3 py-3 text-sm font-semibold text-violet-300/45"
              >
                <Sparkles className="h-4 w-4" />AI 生成（稍后）
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('')
                  onChange(undefined)
                  onInitiativePortraitChange(undefined)
                  onTokenPortraitChange(undefined)
                  setEditorOpen(false)
                }}
                disabled={(!portrait && !initiativePortrait && !tokenPortrait) || busy}
                className="flex items-center justify-center gap-2 rounded-xl border border-rose-400/15 bg-rose-500/[0.06] px-3 py-3 text-sm font-semibold text-rose-200 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Trash2 className="h-4 w-4" />移除立绘
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {cropMode && portrait && (
        <CharacterPortraitCropDialog
          key={cropMode}
          portrait={portrait}
          name={name}
          mode={cropMode}
          onCancel={() => {
            setCropMode(null)
            setEditorOpen(true)
          }}
          onConfirm={(next) => {
            if (cropMode === 'initiative') onInitiativePortraitChange(next)
            else onTokenPortraitChange(next)
            setCropMode(null)
            setEditorOpen(true)
          }}
        />
      )}
    </div>
  )
}
