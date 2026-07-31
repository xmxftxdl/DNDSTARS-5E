export const DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES = 384 * 1024
export const DND5E_PLUGIN_IMAGE_ASSETS_MAX_TOTAL_BYTES = 6 * 1024 * 1024
export const DND5E_ROOM_EPHEMERAL_IMAGE_ASSETS_MAX_TOTAL_BYTES = 24 * 1024 * 1024

export type Dnd5ePluginImageMediaType = 'image/png' | 'image/jpeg' | 'image/webp'

export interface Dnd5ePluginImageAssetDefinition {
  id: string
  mediaType: Dnd5ePluginImageMediaType
  dataBase64: string
}

export interface RegisteredDnd5ePluginImageAsset {
  id: string
  ownerPluginId: string
  mediaType: Dnd5ePluginImageMediaType
  byteLength: number
  dataUrl: string
}

const ID = /^[a-z0-9][a-z0-9._-]{0,99}$/
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const assets = new Map<string, RegisteredDnd5ePluginImageAsset>()

function namespacedAssetId(pluginId: string, localId: string): string {
  if (!ID.test(pluginId) || !ID.test(localId)) throw new Error(`Invalid plugin image asset id: ${pluginId}:${localId}`)
  return `${pluginId}:${localId}`
}

function decodeBase64(value: string): Uint8Array {
  if (!value || !BASE64.test(value)) throw new Error('Invalid plugin image asset base64')
  const binary = globalThis.atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  return prefix.every((value, index) => bytes[index] === value)
}

function assertImageSignature(mediaType: Dnd5ePluginImageMediaType, bytes: Uint8Array): void {
  const valid = mediaType === 'image/png'
    ? hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    : mediaType === 'image/jpeg'
      ? hasPrefix(bytes, [0xff, 0xd8, 0xff])
      : hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        hasPrefix(bytes.subarray(8), [0x57, 0x45, 0x42, 0x50])
  if (!valid) throw new Error(`Plugin image asset bytes do not match ${mediaType}`)
}

export function validateDnd5ePluginImageAsset(
  definition: Dnd5ePluginImageAssetDefinition,
): { byteLength: number; dataBase64: string } {
  if (!definition || typeof definition !== 'object' || !ID.test(definition.id)) {
    throw new Error('Invalid plugin image asset definition')
  }
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(definition.mediaType)) {
    throw new Error(`Unsupported plugin image media type: ${String(definition.mediaType)}`)
  }
  if (typeof definition.dataBase64 !== 'string') throw new Error(`Invalid plugin image asset data: ${definition.id}`)
  const dataBase64 = definition.dataBase64.replace(/\s+/g, '')
  const bytes = decodeBase64(dataBase64)
  if (bytes.byteLength < 12 || bytes.byteLength > DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES) {
    throw new Error(`Plugin image asset size is outside the allowed range: ${definition.id}`)
  }
  assertImageSignature(definition.mediaType, bytes)
  return { byteLength: bytes.byteLength, dataBase64 }
}

export function registerDnd5ePluginImageAsset(
  pluginId: string,
  definition: Dnd5ePluginImageAssetDefinition,
): { id: string; dispose(): void } {
  const id = namespacedAssetId(pluginId, definition.id)
  if (assets.has(id)) throw new Error(`Plugin image asset already registered: ${id}`)
  const validated = validateDnd5ePluginImageAsset(definition)
  const registered: RegisteredDnd5ePluginImageAsset = Object.freeze({
    id,
    ownerPluginId: pluginId,
    mediaType: definition.mediaType,
    byteLength: validated.byteLength,
    dataUrl: `data:${definition.mediaType};base64,${validated.dataBase64}`,
  })
  assets.set(id, registered)
  return {
    id,
    dispose() {
      if (assets.get(id) === registered) assets.delete(id)
    },
  }
}

export function dnd5ePluginImageAsset(
  id: string,
): RegisteredDnd5ePluginImageAsset | undefined {
  const asset = assets.get(id)
  return asset ? { ...asset } : undefined
}

export function dnd5ePluginImageAssetUrl(id: string | undefined): string | undefined {
  return id ? assets.get(id)?.dataUrl : undefined
}

export function registeredDnd5ePluginImageAssets(): readonly RegisteredDnd5ePluginImageAsset[] {
  return [...assets.values()].map((asset) => ({ ...asset }))
}
