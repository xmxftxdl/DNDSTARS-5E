import { useRef, useState } from 'react'
import { Check, ChevronDown, ImagePlus, Sparkles, Trash2 } from 'lucide-react'
import { createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { normalizeCharacterAvatar } from '../../lib/characterAvatar'

const CHARACTER_AVATAR_PRESETS = [
  '🧝', '🧙', '🧟', '🧚', '🧔', '🧛',
  '🥷', '🦊', '🐉', '🐺', '🐱', '🛡️',
] as const

interface CharacterPortraitEditorProps {
  name: string
  avatar: string
  accent: string
  portrait?: string
  editable?: boolean
  onChange: (portrait?: string) => void
  onAvatarChange: (avatar: string) => void
}

export default function CharacterPortraitEditor({
  name,
  avatar,
  accent,
  portrait,
  editable = true,
  onChange,
  onAvatarChange,
}: CharacterPortraitEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [avatarDraft, setAvatarDraft] = useState(avatar)

  const applyAvatar = (value: string) => {
    const normalized = normalizeCharacterAvatar(value, avatar)
    setAvatarDraft(normalized)
    onAvatarChange(normalized)
  }

  const upload = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      onChange(await createCharacterPortraitDataUrl(file))
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
        {editable && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-3 pt-12">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/25 disabled:cursor-wait disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            {busy ? '正在处理…' : portrait ? '替换立绘' : '上传立绘'}
          </button>
        </div>}
      </div>
      {editable && <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled
          title="AI 立绘生成功能将在后续版本接入"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-violet-400/10 bg-violet-500/[0.06] px-2 py-2 text-[11px] font-semibold text-violet-300/45"
        >
          <Sparkles className="h-3.5 w-3.5" />AI 生成（稍后）
        </button>
        <button
          type="button"
          onClick={() => {
            setError('')
            onChange(undefined)
          }}
          disabled={!portrait || busy}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-[11px] font-semibold text-slate-400 hover:bg-white/[0.08] hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 className="h-3.5 w-3.5" />移除
        </button>
      </div>}
      {editable && <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.035] p-2">
        <button
          type="button"
          onClick={() => {
            if (!avatarPickerOpen) setAvatarDraft(avatar)
            setAvatarPickerOpen(!avatarPickerOpen)
          }}
          aria-expanded={avatarPickerOpen}
          data-testid="character-avatar-picker-toggle"
          className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.05]"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xl ${accent}`}
            aria-hidden="true"
          >
            {avatar}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold text-slate-200">设定角色头像</span>
            <span className="block truncate text-[10px] text-slate-500">同时用于战斗地图 Token</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${avatarPickerOpen ? 'rotate-180' : ''}`} />
        </button>
        {avatarPickerOpen && <div className="mt-2 border-t border-white/10 pt-2">
          <div className="grid grid-cols-6 gap-1" aria-label="预设角色头像">
            {CHARACTER_AVATAR_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyAvatar(preset)}
                aria-label={`使用头像 ${preset}`}
                aria-pressed={avatar === preset}
                className={`flex aspect-square items-center justify-center rounded-lg text-lg transition-colors ${
                  avatar === preset
                    ? 'bg-arcane-500/30 ring-1 ring-arcane-400/70'
                    : 'bg-white/[0.04] hover:bg-white/10'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <input
              value={avatarDraft}
              onChange={(event) => setAvatarDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  applyAvatar(avatarDraft)
                }
              }}
              maxLength={16}
              aria-label="自定义角色头像"
              placeholder="输入 Emoji"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-void-950/70 px-2 py-1.5 text-center text-sm text-slate-100 outline-none focus:border-arcane-400/60"
            />
            <button
              type="button"
              onClick={() => applyAvatar(avatarDraft)}
              aria-label="应用自定义角色头像"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-arcane-500/20 text-arcane-200 hover:bg-arcane-500/30"
            >
              <Check className="h-4 w-4" />
            </button>
          </div>
        </div>}
      </div>}
      <p className={`mt-2 text-[11px] leading-4 ${error ? 'text-rose-300' : 'text-slate-600'}`}>
        {error || (editable ? '自动居中裁切为 3:4 竖版，并压缩后随角色存档保存。' : '玩家同步到当前房间的人物立绘。')}
      </p>
    </div>
  )
}
