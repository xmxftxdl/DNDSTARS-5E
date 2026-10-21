import { dnd5eRoomRuntimeProjectionBytesV2, DND5E_ROOM_RUNTIME_PROJECTION,
  DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER, DND5E_ROOM_EPHEMERAL_PACKAGE_MAX_BYTES, replaceRoomRuntimeProse } from './contentPackageV2'
import { parseDnd5eUnifiedContentBundleV1, encodeDnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { roomSpellTextObjects } from '../../../shared/room-spell-text.mjs'

/** Project validated data only. Scripts cannot enter the ephemeral room path. */
export function dnd5eRoomRuntimeProjectionBytes(bytes: ArrayBuffer): ArrayBuffer {
  const native = parseDnd5eUnifiedContentBundleV1(bytes)
  if (!native) return dnd5eRoomRuntimeProjectionBytesV2(bytes)
  if (native.manifest.distributionPolicy !== 'room-ephemeral') throw new Error('Only room-ephemeral content packages can be projected for a room')
  native.runtimeProjection = DND5E_ROOM_RUNTIME_PROJECTION
  native.manifest.description = DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER
  for (const definition of native.definitions) delete definition.source
  replaceRoomRuntimeProse(native.definitions, roomSpellTextObjects(native))
  const projected = encodeDnd5eUnifiedContentBundleV1(native)
  if (projected.byteLength > DND5E_ROOM_EPHEMERAL_PACKAGE_MAX_BYTES) throw new Error('房间临时运行包超过 40 MiB；请减少图片数量或将图片压缩为 WebP')
  return projected
}
