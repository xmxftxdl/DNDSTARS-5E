import { FilterMode, Image as SkiaImage, MipmapMode, useImage } from '@shopify/react-native-skia'
import type { ReadyTile } from './useTileScheduler'

export function SkiaTile({ tile, camera }: {
  tile: ReadyTile
  camera: { x: number; y: number; scale: number }
}) {
  const image = useImage(tile.localUri)
  if (!image) return null
  return (
    <SkiaImage
      image={image}
      x={camera.x + tile.worldX * camera.scale}
      y={camera.y + tile.worldY * camera.scale}
      width={tile.worldSize * camera.scale + 1}
      height={tile.worldSize * camera.scale + 1}
      fit="fill"
      sampling={{ filter: FilterMode.Linear, mipmap: MipmapMode.Linear }}
    />
  )
}
