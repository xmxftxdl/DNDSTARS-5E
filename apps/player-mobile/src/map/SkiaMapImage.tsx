import { useEffect, useState } from 'react'
import { Directory, File, Paths } from 'expo-file-system'
import { Platform } from 'react-native'
import { FilterMode, Image as SkiaImage, MipmapMode, useImage } from '@shopify/react-native-skia'
import type { CameraState, MapAssetManifest } from '../../../../packages/mobile-protocol/src'

function safeName(hash: string) {
  return `${hash.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 90) || 'map'}.img`
}

export function SkiaMapImage({ manifest, camera }: { manifest: MapAssetManifest; camera: CameraState }) {
  const source = manifest.singleImage
  const sourceUrl = source?.url ?? ''
  const sourceHeaders = JSON.stringify(source?.headers ?? {})
  const [uri, setUri] = useState<string | null>(null)

  useEffect(() => {
    if (!sourceUrl) return setUri(null)
    const controller = new AbortController()
    let objectUrl = ''
    void (async () => {
      if (Platform.OS !== 'web') {
        const root = new Directory(Paths.cache, 'stars-map-cache', 'single-images')
        root.create({ intermediates: true, idempotent: true })
        const cached = new File(root, safeName(manifest.assetHash))
        if (cached.exists && cached.size > 0) {
          setUri(cached.uri)
          return
        }
      }
      const response = await fetch(sourceUrl, { headers: JSON.parse(sourceHeaders) as Record<string, string>, signal: controller.signal })
      if (!response.ok) throw new Error(`map-image-http-${response.status}`)
      if (Platform.OS === 'web') {
        objectUrl = URL.createObjectURL(await response.blob())
        setUri(objectUrl)
        return
      }
      const root = new Directory(Paths.cache, 'stars-map-cache', 'single-images')
      root.create({ intermediates: true, idempotent: true })
      const file = new File(root, safeName(manifest.assetHash))
      const bytes = new Uint8Array(await response.arrayBuffer())
      file.create({ intermediates: true, overwrite: true })
      file.write(bytes)
      setUri(file.uri)
    })().catch(() => { if (!controller.signal.aborted) setUri(null) })
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [manifest.assetHash, sourceHeaders, sourceUrl])

  const image = useImage(uri)
  if (!image) return null
  return (
    <SkiaImage
      image={image}
      x={camera.x}
      y={camera.y}
      width={manifest.worldWidth * camera.scale}
      height={manifest.worldHeight * camera.scale}
      fit="fill"
      sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
    />
  )
}
