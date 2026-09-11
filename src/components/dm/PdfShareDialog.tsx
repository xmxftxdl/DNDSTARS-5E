import { useEffect, useRef, useState } from 'react'
import { normalizedPdfCrop, cropPdfShare, type PdfCrop } from '../../lib/pdfReaderExperience'
import { getRoomSession } from '../../lib/roomSession'
import { loadRoomRoster, type RoomRosterMember } from '../../lib/roomApi'
import { browserSharedRoomService } from '../../composition/browserSharedRoomService'
import { useRoomCommunicationsStore } from '../../store/roomCommunications'

export default function PdfShareDialog({ image, onClose }: { image: string; onClose: () => void }) {
  const [crop, setCrop] = useState<PdfCrop | null>(null)
  const [cropping, setCropping] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [roster, setRoster] = useState<RoomRosterMember[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [all, setAll] = useState(true)
  const [title, setTitle] = useState('冒险线索')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const session = getRoomSession()
    if (session) void loadRoomRoster(session).then(value => { if (active) setRoster(value.players.filter(player => player.role === 'player' && player.status !== 'left' && player.status !== 'removed')) }).catch(() => { if (active) setError('无法读取玩家列表，请稍后重试。') })
    return () => { active = false }
  }, [])
  const send = async () => {
    if (getRoomSession()?.role !== 'dm') { setError('只有房间 DM 可以展示讲义。'); return }
    setBusy(true); setError('')
    let imageId: string | undefined
    try {
      const blob = await cropPdfShare(image, crop)
      imageId = `handout-image-${crypto.randomUUID()}`
      if (!await browserSharedRoomService.putSharedImage(imageId, new File([blob], '讲义.png', { type: 'image/png' }), 'handout')) throw new Error('讲义图片上传失败')
      await useRoomCommunicationsStore.getState().mutateJournal({ operation: 'add-handout', title: title.trim(), body, audience: all ? 'all' : selected, imageId, imageMimeType: 'image/png', imageName: '讲义.png' })
      onClose()
    } catch (cause) {
      if (imageId) await browserSharedRoomService.deleteSharedImage(imageId).catch(() => undefined)
      setError(cause instanceof Error ? cause.message : '展示失败，请重试。')
    } finally { setBusy(false) }
  }
  return <div role="dialog" aria-modal="true" aria-label="向玩家展示 PDF 内容" className="absolute inset-0 z-50 flex flex-col gap-3 overflow-auto bg-slate-950 p-4 text-xs text-slate-200">
    <h3 className="font-semibold">向玩家展示</h3>
    <p>只发送下方图片及填写的说明。框选后，框外内容不会发送。</p>
    <div className="flex gap-3"><button onClick={() => { setCropping(!cropping); setCrop(null) }}>{cropping ? '使用整页' : '框选区域'}</button><button disabled={busy} onClick={onClose}>取消</button></div>
    <div className="relative w-full shrink-0 self-center overflow-hidden" style={{ cursor: cropping ? 'crosshair' : 'default', touchAction: cropping ? 'none' : 'auto' }}
      onPointerDown={event => {
        if (!cropping || busy) return
        const rect = event.currentTarget.getBoundingClientRect()
        start.current = { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }
        event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault()
      }}
      onPointerMove={event => {
        if (!start.current) return
        const rect = event.currentTarget.getBoundingClientRect()
        setCrop(normalizedPdfCrop(start.current, { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height }))
      }}
      onPointerUp={() => { start.current = null }} onPointerCancel={() => { start.current = null }}>
      <img src={image} alt="待展示页面；可框选要发送的区域" draggable={false} className="block w-full select-none" />
      {crop && <div className="pointer-events-none absolute border-2 border-sky-500 bg-sky-300/10" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%`, boxShadow: '0 0 0 9999px #0008', clipPath: 'inset(-9999px)' }} />}
    </div>
    <label>讲义标题<input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded bg-slate-800 p-2" /></label>
    <label>说明<textarea maxLength={20000} value={body} onChange={e => setBody(e.target.value)} className="w-full rounded bg-slate-800 p-2" /></label>
    <label><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> 展示给全体玩家</label>
    {!all && roster.map(player => <label key={player.memberId}><input type="checkbox" checked={selected.includes(player.memberId)} onChange={e => setSelected(value => e.target.checked ? [...value, player.memberId] : value.filter(id => id !== player.memberId))} /> {player.displayName}</label>)}
    {error && <p role="alert" className="text-amber-200">{error}</p>}
    <button disabled={busy || !title.trim() || (!all && !selected.length) || (cropping && (!crop || crop.width < .005 || crop.height < .005))} onClick={() => void send()} className="rounded bg-sky-700 p-2 disabled:opacity-40">{busy ? '正在展示…' : '确认展示'}</button>
  </div>
}
