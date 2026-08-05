import {
  DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES,
  validateDnd5ePluginImageAsset,
  type Dnd5ePluginImageAssetDefinition,
  type Dnd5ePluginImageMediaType,
} from '../../rulesets/dnd5e'

export type Dnd5eSpellWorkshopHeadlessStatus = 'full' | 'partial' | 'reference-only'

export interface Dnd5eSpellWorkshopHeadlessInput {
  enabled: boolean
  damageEnabled: boolean
  conditionEnabled: boolean
}

/** A spell is executable only when the editor can emit at least one effect. */
export function dnd5eSpellWorkshopHeadlessStatus(
  input: Dnd5eSpellWorkshopHeadlessInput,
): Dnd5eSpellWorkshopHeadlessStatus {
  if (!input.enabled) return 'reference-only'
  return input.damageEnabled || input.conditionEnabled ? 'full' : 'partial'
}

export function dnd5eSpellWorkshopHeadlessReady(
  input: Dnd5eSpellWorkshopHeadlessInput,
): boolean {
  return dnd5eSpellWorkshopHeadlessStatus(input) === 'full'
}

function localAssetId(spellId: string): string {
  const safe = spellId.trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 84) || 'custom-spell'
  return `spell-${safe}-icon`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

export async function dnd5eSpellIconAssetFromFile(
  spellId: string,
  file: Pick<File, 'type' | 'size' | 'arrayBuffer'>,
): Promise<Dnd5ePluginImageAssetDefinition> {
  const mediaType = file.type.toLowerCase() as Dnd5ePluginImageMediaType
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mediaType)) {
    throw new Error('法术图标只支持 PNG、JPG 或 WebP。')
  }
  if (file.size <= 0) throw new Error('法术图标文件为空。')
  if (file.size > DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES) {
    throw new Error('法术图标不能超过 384 KiB，请先压缩或缩小图片。')
  }
  const asset: Dnd5ePluginImageAssetDefinition = {
    id: localAssetId(spellId),
    mediaType,
    dataBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
  }
  const validated = validateDnd5ePluginImageAsset(asset)
  return { ...asset, dataBase64: validated.dataBase64 }
}

export function dnd5eSpellIconAssetDataUrl(
  asset: Dnd5ePluginImageAssetDefinition | undefined,
): string | undefined {
  return asset ? `data:${asset.mediaType};base64,${asset.dataBase64}` : undefined
}
