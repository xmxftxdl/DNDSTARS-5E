import { useEffect, useRef, useState } from 'react'
import { Music2, Play, Volume2, VolumeX } from 'lucide-react'
import { sceneAudioPositionAt } from '../lib/sceneAudioLibrary'
import { useSceneAudioStore } from '../store/sceneAudio'

export default function SceneAudioPlaybackSystem() {
  const library = useSceneAudioStore((state) => state.library)
  const playback = useSceneAudioStore((state) => state.playback)
  const clockOffsetMs = useSceneAudioStore((state) => state.clockOffsetMs)
  const getBlob = useSceneAudioStore((state) => state.getBlob)
  const audioRef = useRef<HTMLAudioElement>(null)
  const startTimerRef = useRef<number | undefined>(undefined)
  const [source, setSource] = useState<{ assetId: string; url: string }>()
  const [blocked, setBlocked] = useState(false)
  const [locallyMuted, setLocallyMuted] = useState(false)
  const asset = library.assets.find((candidate) => candidate.id === playback.assetId)

  useEffect(() => {
    if (!playback.assetId) return
    let disposed = false
    let objectUrl: string | undefined
    void getBlob(playback.assetId).then((blob) => {
      if (!blob || disposed) return
      objectUrl = URL.createObjectURL(blob)
      setSource({ assetId: playback.assetId!, url: objectUrl })
    })
    return () => {
      disposed = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [getBlob, playback.assetId])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    window.clearTimeout(startTimerRef.current)
    audio.loop = playback.loop
    audio.volume = locallyMuted ? 0 : playback.volume
    if (playback.status === 'stopped' || !asset || source?.assetId !== asset.id) {
      audio.pause()
      if (playback.status === 'stopped') audio.removeAttribute('src')
      return
    }
    if (audio.src !== source.url) {
      audio.src = source.url
      audio.load()
    }
    const synchronize = async () => {
      if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
        await new Promise<void>((resolve) => audio.addEventListener('loadedmetadata', () => resolve(), { once: true }))
      }
      const serverNow = Date.now() + clockOffsetMs
      const target = sceneAudioPositionAt(playback, serverNow, asset.durationSeconds)
      if (Number.isFinite(target) && Math.abs(audio.currentTime - target) > 0.15) audio.currentTime = target
      if (playback.status === 'paused') {
        audio.pause()
        setBlocked(false)
        return
      }
      const delayMs = Math.max(0, playback.anchorServerMs - serverNow)
      const play = () => void audio.play().then(() => setBlocked(false)).catch(() => setBlocked(true))
      if (delayMs > 10) startTimerRef.current = window.setTimeout(play, delayMs)
      else play()
    }
    void synchronize()
    return () => window.clearTimeout(startTimerRef.current)
  }, [asset, clockOffsetMs, locallyMuted, playback, source])

  useEffect(() => {
    if (playback.status !== 'playing' || !asset) return
    const timer = window.setInterval(() => {
      const audio = audioRef.current
      if (!audio || audio.paused) return
      const expected = sceneAudioPositionAt(playback, Date.now() + clockOffsetMs, asset.durationSeconds)
      if (Math.abs(audio.currentTime - expected) > 0.4) audio.currentTime = expected
    }, 3_000)
    return () => window.clearInterval(timer)
  }, [asset, clockOffsetMs, playback])

  const active = playback.status !== 'stopped' && !!asset
  return (
    <>
      <audio ref={audioRef} preload="auto" aria-hidden="true" />
      {active && (
        <div className="fixed bottom-5 right-5 z-[135] flex max-w-sm items-center gap-3 rounded-2xl border border-violet-300/20 bg-void-950/94 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
          <span className="rounded-xl bg-violet-400/12 p-2 text-violet-200"><Music2 className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold text-slate-100">{asset.name}</span>
            <span className="block text-[10px] text-slate-500">{playback.status === 'paused' ? 'DM 已暂停' : playback.loop ? '房间同步循环播放' : '房间同步播放'}</span>
          </span>
          <button type="button" title={locallyMuted ? '恢复本机声音' : '仅在本机静音'} onClick={() => setLocallyMuted((value) => !value)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-200">
            {locallyMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}
      {active && blocked && playback.status === 'playing' && (
        <button
          type="button"
          onClick={() => void audioRef.current?.play().then(() => setBlocked(false))}
          className="fixed right-5 top-20 z-[140] flex items-center gap-2 rounded-xl border border-amber-300/30 bg-slate-950/95 px-4 py-3 text-xs font-bold text-amber-100 shadow-2xl"
        >
          <Play className="h-4 w-4" />启用场景音频
        </button>
      )}
    </>
  )
}
