import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, User, X } from 'lucide-react'
import { characterPortraitBlob, createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { deleteImage, putImage } from '../../lib/imageStore'

export interface NpcCreationDetails {
  label: string
  portraitImageId?: string
  tokenPortraitImageId?: string
}

export default function NpcCreateDialog({ onCreate, onClose }: {
  onCreate: (details: NpcCreationDetails) => string | null
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [portrait, setPortrait] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const choosePortrait = async (file: File) => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      const nextPortrait = await createCharacterPortraitDataUrl(file)
      if (mounted.current) setPortrait(nextPortrait)
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : '无法读取画像，请换一张图片。')
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (locked.current || !name.trim()) return
    locked.current = true
    setBusy(true)
    setMessage('')
    let imageId: string | undefined
    let created = false
    try {
      if (portrait) {
        imageId = `npc_portrait_${crypto.randomUUID()}`
        const blob = characterPortraitBlob(portrait)
        if (!await putImage(imageId, blob)) throw new Error('画像未能上传到房间，请重试。')
      }
      if (!mounted.current) throw new Error('已取消添加 NPC。')
      const tokenId = onCreate({ label: name.trim(), portraitImageId: imageId, tokenPortraitImageId: imageId })
      if (!tokenId) throw new Error('地图已不可用，未添加 NPC。')
      created = true
      onClose()
    } catch (error) {
      if (imageId && !created) void deleteImage(imageId).catch(() => undefined)
      if (mounted.current) setMessage(error instanceof Error ? error.message : '添加 NPC 失败，请重试。')
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/65 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="npc-create-title" onSubmit={(event) => { void submit(event) }}
        onKeyDown={(event) => { event.stopPropagation(); if (event.key === 'Escape' && !busy) onClose() }}
        className="w-full max-w-sm rounded-2xl border border-amber-300/20 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="npc-create-title" className="font-semibold">添加 NPC</h2>
          <button type="button" aria-label="关闭添加 NPC" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>
        <div className="my-4 flex justify-center">
          {portrait ? <img src={portrait} alt="NPC 画像预览" className="h-40 w-32 rounded-xl object-cover" />
            : <div className="flex h-40 w-32 items-center justify-center rounded-xl bg-amber-400/10"><User className="h-12 w-12 text-amber-200" /></div>}
        </div>
        <label className="block text-sm">名字
          <input autoFocus required maxLength={80} value={name} disabled={busy} onChange={(event) => setName(event.target.value)} placeholder="例如：酒馆老板艾琳"
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 outline-none focus:border-amber-300" />
        </label>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/5">
          <ImagePlus className="h-4 w-4" />{portrait ? '更换画像' : '上传画像（可选）'}
          <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传 NPC 画像" className="sr-only" disabled={busy}
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void choosePortrait(file) }} />
        </label>
        {portrait && <button type="button" disabled={busy} onClick={() => setPortrait('')} className="mt-2 text-xs text-slate-400 hover:text-slate-200">移除画像</button>}
        <p className="mt-2 text-xs text-slate-400">支持 JPG、PNG、WebP，最大 12 MB。</p>
        {message && <p role="alert" className="mt-3 text-sm text-rose-300">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-300 disabled:opacity-40">取消</button>
          <button type="submit" disabled={busy || !name.trim()} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{busy ? '正在处理…' : '添加到地图'}</button>
        </div>
      </form>
    </div>, document.body,
  )
}
