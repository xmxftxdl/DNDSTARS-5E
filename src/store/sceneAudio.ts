import { create } from 'zustand'
import {
  emptySceneAudioLibrary,
  emptySceneAudioPlayback,
  normalizeSharedSceneAudioLibrary,
  normalizeSharedSceneAudioPlayback,
  SCENE_AUDIO_LIBRARY_RESOURCE,
  SCENE_AUDIO_MAX_ASSETS,
  SCENE_AUDIO_MAX_BYTES,
  SCENE_AUDIO_PLAYBACK_RESOURCE,
  type SceneAudioAsset,
  type SceneAudioKind,
  type SceneAudioPlaybackMutation,
  type SharedSceneAudioLibraryState,
  type SharedSceneAudioPlaybackState,
} from '../lib/sceneAudioLibrary'
import {
  deleteSharedImage,
  getSharedImage,
  loadSharedResource,
  mutateSharedRoomResource,
  putSharedImage,
  sampleSharedServerClock,
  saveSharedResourceWithResult,
} from '../composition/browserSharedRoomResources'
import { useSceneOrchestrationStore } from './sceneOrchestration'

interface SceneAudioStore {
  library: SharedSceneAudioLibraryState
  playback: SharedSceneAudioPlaybackState
  clockOffsetMs: number
  clockSampledAt: number
  loadLibrary: () => Promise<void>
  loadPlayback: () => Promise<void>
  refreshClock: () => Promise<void>
  upload: (file: File, input: { name: string; kind: SceneAudioKind }) => Promise<SceneAudioAsset>
  remove: (assetId: string) => Promise<void>
  control: (mutation: SceneAudioPlaybackMutation) => Promise<void>
  getBlob: (assetId: string) => Promise<Blob | undefined>
  reset: () => void
}

function audioMimeType(file: File): string {
  if (file.type.startsWith('audio/')) return file.type.toLowerCase()
  const extension = file.name.split('.').pop()?.toLowerCase()
  return extension === 'mp3' ? 'audio/mpeg'
    : extension === 'ogg' || extension === 'oga' ? 'audio/ogg'
      : extension === 'wav' ? 'audio/wav'
        : extension === 'm4a' || extension === 'mp4' ? 'audio/mp4'
          : extension === 'aac' ? 'audio/aac'
            : extension === 'webm' ? 'audio/webm'
              : ''
}

async function audioDurationSeconds(file: File): Promise<number> {
  if (typeof Audio === 'undefined' || typeof URL === 'undefined') throw new Error('当前环境无法读取音频时长。')
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise<number>((resolve, reject) => {
      const audio = new Audio()
      const timeout = window.setTimeout(() => reject(new Error('读取音频信息超时。')), 15_000)
      audio.preload = 'metadata'
      audio.onloadedmetadata = () => {
        window.clearTimeout(timeout)
        if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(audio.duration)
        else reject(new Error('无法识别音频时长。'))
      }
      audio.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error('浏览器无法解码该音频格式。'))
      }
      audio.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export const useSceneAudioStore = create<SceneAudioStore>((set, get) => ({
  library: emptySceneAudioLibrary(),
  playback: emptySceneAudioPlayback(),
  clockOffsetMs: 0,
  clockSampledAt: 0,
  loadLibrary: async () => {
    set({ library: normalizeSharedSceneAudioLibrary(await loadSharedResource(SCENE_AUDIO_LIBRARY_RESOURCE)) })
  },
  loadPlayback: async () => {
    const playback = normalizeSharedSceneAudioPlayback(await loadSharedResource(SCENE_AUDIO_PLAYBACK_RESOURCE))
    if (Date.now() - get().clockSampledAt > 60_000) await get().refreshClock()
    set({ playback })
  },
  refreshClock: async () => {
    const sample = await sampleSharedServerClock()
    if (sample) set({ clockOffsetMs: sample.offsetMs, clockSampledAt: sample.sampledAt })
  },
  upload: async (file, input) => {
    if (get().library.assets.length >= SCENE_AUDIO_MAX_ASSETS) throw new Error(`一个房间最多保存 ${SCENE_AUDIO_MAX_ASSETS} 个音频。`)
    if (file.size < 1 || file.size > SCENE_AUDIO_MAX_BYTES) throw new Error('音频必须小于 24 MiB。')
    const mimeType = audioMimeType(file)
    if (!mimeType) throw new Error('请选择 MP3、Ogg、WAV、M4A、AAC 或 WebM 音频。')
    const durationSeconds = await audioDurationSeconds(file)
    const id = `scene-audio-${crypto.randomUUID()}`
    const uploadBlob = file.type === mimeType ? file : new Blob([file], { type: mimeType })
    if (!await putSharedImage(id, uploadBlob, 'scene-audio')) throw new Error('音频上传失败。')
    const now = Date.now()
    const asset: SceneAudioAsset = {
      id,
      name: input.name.trim().slice(0, 160) || file.name.replace(/\.[^.]+$/, '').slice(0, 160),
      fileName: file.name.slice(0, 240),
      mimeType,
      sizeBytes: file.size,
      durationSeconds,
      kind: input.kind,
      createdAt: now,
    }
    const library = normalizeSharedSceneAudioLibrary({
      ...get().library,
      assets: [...get().library.assets, asset],
      updatedAt: now,
    })
    const result = await saveSharedResourceWithResult(SCENE_AUDIO_LIBRARY_RESOURCE, library)
    if (result.status !== 'saved') {
      await deleteSharedImage(id)
      await get().loadLibrary()
      throw new Error(result.status === 'conflict' ? '音频库同时被修改，请重试。' : '音频目录保存失败。')
    }
    set({ library })
    return asset
  },
  remove: async (assetId) => {
    if (get().playback.assetId === assetId) await get().control({ operation: 'stop' })
    const library = normalizeSharedSceneAudioLibrary({
      ...get().library,
      assets: get().library.assets.filter((asset) => asset.id !== assetId),
      updatedAt: Date.now(),
    })
    const result = await saveSharedResourceWithResult(SCENE_AUDIO_LIBRARY_RESOURCE, library)
    if (result.status !== 'saved') {
      await get().loadLibrary()
      throw new Error('音频目录保存失败，未删除音频。')
    }
    set({ library })
    useSceneOrchestrationStore.getState().removeAudioReferences(assetId)
    await deleteSharedImage(assetId)
  },
  control: async (mutation) => {
    const playback = await mutateSharedRoomResource<SharedSceneAudioPlaybackState>(
      SCENE_AUDIO_PLAYBACK_RESOURCE,
      '/state/scene-audio/playback',
      mutation,
    )
    set({ playback: normalizeSharedSceneAudioPlayback(playback) })
  },
  getBlob: (assetId) => getSharedImage(assetId),
  reset: () => set({
    library: emptySceneAudioLibrary(),
    playback: emptySceneAudioPlayback(),
    clockOffsetMs: 0,
    clockSampledAt: 0,
  }),
}))
