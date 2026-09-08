import { Directory, File, Paths } from 'expo-file-system'
import { Platform } from 'react-native'
import type { TileKey } from './tileMath'
import { mobileFetch } from '../services/mobileHttp'

const DEFAULT_MAX_DISK_BYTES = 96 * 1024 * 1024

function safeTileName(tile: TileKey): string {
  return `${tile.level}-${tile.x}-${tile.y}.png`
}

export class TileDiskCache {
  readonly root: Directory | null
  private accessOrder = new Map<string, number>()
  private readonly maxDiskBytes: number

  constructor(assetHash: string, maxDiskBytes = DEFAULT_MAX_DISK_BYTES) {
    this.maxDiskBytes = Math.max(16 * 1024 * 1024, maxDiskBytes)
    this.root = Platform.OS === 'web' ? null : new Directory(Paths.cache, 'stars-map-cache', assetHash)
    this.root?.create({ intermediates: true, idempotent: true })
  }

  async resolve(tile: TileKey, signal?: AbortSignal): Promise<string> {
    if (!this.root) {
      const response = await mobileFetch(tile.url, { signal }, { timeoutMs: 30_000, retries: 2 })
      if (!response.ok) throw new Error(`tile-http-${response.status}`)
      return tile.url
    }
    const file = new File(this.root, safeTileName(tile))
    const cacheKey = file.uri
    this.accessOrder.set(cacheKey, Date.now())
    if (file.exists && (file.size ?? 0) > 0) return file.uri
    const response = await mobileFetch(tile.url, { signal }, { timeoutMs: 30_000, retries: 2 })
    if (!response.ok) throw new Error(`tile-http-${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    file.create({ intermediates: true, overwrite: true })
    file.write(bytes)
    this.trim()
    return file.uri
  }

  sizeBytes(): number {
    return this.root?.list().reduce((total, entry) => total + (entry instanceof File ? entry.size ?? 0 : 0), 0) ?? 0
  }

  clear(): void {
    if (!this.root) return
    if (this.root.exists) this.root.delete()
    this.accessOrder.clear()
    this.root.create({ intermediates: true, idempotent: true })
  }

  private trim(): void {
    if (!this.root) return
    const files = this.root.list().filter((entry): entry is File => entry instanceof File)
    let bytes = files.reduce((total, file) => total + (file.size ?? 0), 0)
    if (bytes <= this.maxDiskBytes) return
    files.sort((a, b) => (this.accessOrder.get(a.uri) ?? 0) - (this.accessOrder.get(b.uri) ?? 0))
    for (const file of files) {
      if (bytes <= this.maxDiskBytes) break
      bytes -= file.size ?? 0
      this.accessOrder.delete(file.uri)
      file.delete()
    }
  }
}
