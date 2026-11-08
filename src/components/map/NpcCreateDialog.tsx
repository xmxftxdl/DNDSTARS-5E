import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { ImagePlus, Search, User, X } from 'lucide-react'
import { characterPortraitBlob, createCharacterPortraitDataUrl } from '../../lib/characterPortrait'
import { getImage, putImage } from '../../lib/imageStore'
import { getSharedImage } from '../../lib/sharedApi'
import { getAccountSession } from '../../lib/accountSession'
import { getRoomSession } from '../../lib/roomSession'
import { loadNpcLibrary, saveNpcLibraryEntry, type NpcLibraryEntry } from '../../lib/npcLibrary'
import { useMapStore } from '../../store/maps'

export interface NpcCreationDetails {
  label: string
  portraitImageId?: string
  tokenPortraitImageId?: string
  hp?: number
  maxHp?: number
}

export default function NpcCreateDialog({ onCreate, onClose }: {
  onCreate: (details: NpcCreationDetails) => string | null
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [portrait, setPortrait] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [owner] = useState(() => getAccountSession()?.accountId ?? 'local-dm')
  const [library, setLibrary] = useState<NpcLibraryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'library' | 'new'>('library')
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const locked = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    void loadNpcLibrary(owner).then(entries => {
      if (mounted.current) setLibrary(entries)
    }).catch(error => {
      if (mounted.current) setMessage(error instanceof Error ? error.message : 'NPC 库读取失败。')
    }).finally(() => { if (mounted.current) setLoading(false) })
    return () => { mounted.current = false }
  }, [owner])

  const importExisting = async () => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setMessage('')
    try {
      const entries = [...library]
      let added = 0
      for (const token of useMapStore.getState().maps.flatMap(map => map.tokens).filter(token => token.type === 'npc')) {
        const id = `import_${getRoomSession()?.roomId ?? 'local'}_${token.id}`
        if (entries.some(entry => entry.id === id)) continue
        const imageId = token.portraitImageId ?? token.tokenPortraitImageId
        const blob = imageId ? await getImage(imageId) : undefined
        if (imageId && !blob) throw new Error(`无法读取“${token.label}”的立绘，请稍后重试。`)
        const entry: NpcLibraryEntry = { id, label: token.label.trim().slice(0, 80) || '未命名 NPC',
          portrait: blob ? await createCharacterPortraitDataUrl(new File([blob], 'npc.webp', { type: blob.type })) : undefined,
          maxHp: token.maxHp, createdAt: Date.now() }
        await saveNpcLibraryEntry(owner, entry)
        entries.unshift(entry)
        added += 1
        if (mounted.current) setLibrary([...entries])
      }
      if (mounted.current) setMessage(added ? `已收录 ${added} 个 NPC。` : '没有尚未收录的地图 NPC。')
    } catch (error) {
      if (mounted.current) setMessage(error instanceof Error ? error.message : '收录 NPC 失败。')
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }

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
    try {
      const entry: NpcLibraryEntry | undefined = mode === 'library' ? library.find(row => row.id === selectedId) : {
        id: crypto.randomUUID(), label: name.trim(), portrait: portrait || undefined, createdAt: Date.now(),
      }
      if (!entry) throw new Error('请先从 NPC 库选择一个人物。')
      if (mode === 'new') {
        await saveNpcLibraryEntry(owner, entry)
        if (mounted.current) { setLibrary(current => [entry, ...current]); setSelectedId(entry.id); setMode('library') }
      }
      const imageId = entry.portrait ? `npc_library_portrait_${entry.id}` : undefined
      if (imageId && entry.portrait && !await getSharedImage(imageId)) {
        if (!await putImage(imageId, characterPortraitBlob(entry.portrait))) throw new Error('NPC 已保存在库中，但立绘未能同步到房间，请重试。')
      }
      if (!mounted.current) throw new Error('已取消添加 NPC。')
      const tokenId = onCreate({ label: entry.label, portraitImageId: imageId, tokenPortraitImageId: imageId,
        ...(entry.maxHp != null ? { hp: entry.maxHp, maxHp: entry.maxHp } : {}) })
      if (!tokenId) throw new Error('地图已不可用，未添加 NPC。')
      onClose()
    } catch (error) {
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
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-300/20 bg-slate-950 p-5 text-slate-100 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 id="npc-create-title" className="font-semibold">添加 NPC</h2>
          <button type="button" aria-label="关闭添加 NPC" disabled={busy} onClick={onClose} className="rounded-lg p-2 hover:bg-white/10 disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex gap-2" role="group" aria-label="NPC 来源">
          <button type="button" disabled={busy} aria-pressed={mode === 'library'} onClick={() => { setMode('library'); setMessage('') }} className="flex-1 rounded-lg border border-amber-300/30 px-3 py-2 text-sm aria-pressed:bg-amber-400/15">从 NPC 库选择 · {library.length}</button>
          <button type="button" disabled={busy} aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setSelectedId(''); setName(''); setPortrait(''); setMessage('') }} className="flex-1 rounded-lg border border-amber-300/30 px-3 py-2 text-sm aria-pressed:bg-amber-400/15">新建 NPC</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">NPC 库保存在当前浏览器，按账号区分，可在不同地图和房间重复使用。</p>
        {mode === 'library' ? <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2"><Search className="h-4 w-4" /><input aria-label="搜索 NPC" value={search} onChange={event => setSearch(event.target.value)} placeholder="按名字搜索" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
          {loading ? <p className="text-sm text-slate-400">正在读取 NPC 库…</p> : library.length === 0 ? <p className="rounded-xl bg-white/5 p-4 text-sm text-slate-300">还没有收藏的 NPC。新建一次即可保存，也可以收录地图中已有的人物。</p> : <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto">
            {library.filter(entry => entry.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).map(entry => <button type="button" key={entry.id} disabled={busy} aria-pressed={selectedId === entry.id} onClick={() => { setSelectedId(entry.id); setName(entry.label); setPortrait(entry.portrait ?? ''); setMessage('') }} className="flex items-center gap-3 rounded-xl border border-white/15 p-3 text-left aria-pressed:border-amber-300 aria-pressed:bg-amber-400/10">
              {entry.portrait ? <img src={entry.portrait} alt="" className="h-16 w-12 shrink-0 rounded-lg object-cover" /> : <User className="h-12 w-12 shrink-0 text-amber-200" />}<span className="min-w-0 break-words text-sm">{entry.label}</span>
            </button>)}
          </div>}
          <button type="button" disabled={busy || loading} onClick={() => { void importExisting() }} className="text-xs text-amber-200 underline disabled:opacity-40">收录当前战役地图中的 NPC</button>
        </div> : <>
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
        <p className="mt-2 text-xs text-amber-200">新建后自动保存到 NPC 库，下次可直接选择。</p>
        </>}
        {message && <p role="alert" className="mt-3 text-sm text-rose-300">{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-300 disabled:opacity-40">取消</button>
          <button type="submit" disabled={busy || loading || (mode === 'library' ? !selectedId : !name.trim())} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40">{busy ? '正在处理…' : mode === 'new' ? '保存并添加到地图' : '添加到地图'}</button>
        </div>
      </form>
    </div>, document.body,
  )
}
