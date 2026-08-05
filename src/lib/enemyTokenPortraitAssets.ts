import type { EnemyTemplate } from './enemyPool'
import { deleteImage, putImage } from './imageStore'

const EMBEDDED_IMAGE_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i

export interface EnemyTokenPortraitAssets {
  tokenPortraitImageId: string
  portraitImageId: string
  imageIds: readonly string[]
  shared: boolean
}

export interface EnemyTokenPortraitAssetPlan {
  tokenPortraitImageId: string
  portraitImageId: string
  imageIds: readonly string[]
  tokenSource: string
  initiativeSource: string
}

export interface EnemyTokenPortraitAssetPorts {
  put?: (id: string, blob: Blob) => Promise<boolean>
  remove?: (id: string) => Promise<void>
  decode?: (source: string) => Promise<Blob>
}

function embeddedImage(source: string | undefined): string | undefined {
  return source && EMBEDDED_IMAGE_PATTERN.test(source) ? source : undefined
}

async function decodeEmbeddedImage(source: string): Promise<Blob> {
  const response = await fetch(source)
  if (!response.ok) throw new Error('invalid-enemy-portrait-data-url')
  return response.blob()
}

function safeTokenImageStem(tokenId: string): string {
  const stem = tokenId.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80)
  return stem || 'monster'
}

function embeddedImageFingerprint(source: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}_${source.length.toString(36)}`
}

/**
 * Builds content-addressed room image ids. Changing or regenerating artwork
 * therefore changes the id stored on the map token, which makes connected
 * players reload the new blob instead of retaining an older id-bound image.
 */
export function planEnemyTokenPortraitAssets(
  tokenId: string,
  template: Pick<EnemyTemplate, 'tokenPortrait' | 'initiativePortrait'>,
): EnemyTokenPortraitAssetPlan | undefined {
  const tokenSource = embeddedImage(template.tokenPortrait) ?? embeddedImage(template.initiativePortrait)
  const initiativeSource = embeddedImage(template.initiativePortrait) ?? embeddedImage(template.tokenPortrait)
  if (!tokenSource || !initiativeSource) return undefined

  const stem = safeTokenImageStem(tokenId)
  if (tokenSource === initiativeSource) {
    const imageId = `monster_portrait_${stem}_${embeddedImageFingerprint(tokenSource)}`
    return {
      tokenPortraitImageId: imageId,
      portraitImageId: imageId,
      imageIds: [imageId],
      tokenSource,
      initiativeSource,
    }
  }

  const tokenPortraitImageId = `monster_token_${stem}_${embeddedImageFingerprint(tokenSource)}`
  const portraitImageId = `monster_initiative_${stem}_${embeddedImageFingerprint(initiativeSource)}`
  return {
    tokenPortraitImageId,
    portraitImageId,
    imageIds: [tokenPortraitImageId, portraitImageId],
    tokenSource,
    initiativeSource,
  }
}

/**
 * Copies workshop-only inline artwork into the room image channel. The map
 * snapshot stores only opaque image ids, so players receive the visuals
 * without receiving the DM's custom-monster source catalogue.
 */
export async function persistEnemyTokenPortraitAssets(
  tokenId: string,
  template: Pick<EnemyTemplate, 'tokenPortrait' | 'initiativePortrait'>,
  ports: EnemyTokenPortraitAssetPorts = {},
): Promise<EnemyTokenPortraitAssets | undefined> {
  const plan = planEnemyTokenPortraitAssets(tokenId, template)
  if (!plan) return undefined

  const write = ports.put ?? putImage
  const remove = ports.remove ?? deleteImage
  const decode = ports.decode ?? decodeEmbeddedImage
  const { tokenSource, initiativeSource } = plan

  if (tokenSource === initiativeSource) {
    const imageId = plan.portraitImageId
    const shared = await write(imageId, await decode(tokenSource))
    return {
      tokenPortraitImageId: imageId,
      portraitImageId: imageId,
      imageIds: [imageId],
      shared,
    }
  }

  const { tokenPortraitImageId, portraitImageId } = plan
  const written: string[] = []
  try {
    const tokenShared = await write(tokenPortraitImageId, await decode(tokenSource))
    written.push(tokenPortraitImageId)
    const initiativeShared = await write(portraitImageId, await decode(initiativeSource))
    written.push(portraitImageId)
    return {
      tokenPortraitImageId,
      portraitImageId,
      imageIds: written,
      shared: tokenShared && initiativeShared,
    }
  } catch (cause) {
    await Promise.allSettled(written.map((imageId) => remove(imageId)))
    throw cause
  }
}
