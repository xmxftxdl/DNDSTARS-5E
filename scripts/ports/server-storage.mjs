function assertMethods(value, label, methods) {
  if (!value || methods.some((method) => typeof value[method] !== 'function')) {
    throw new TypeError(`invalid ${label} port`)
  }
  return value
}

export const assertRoomRepositoryPort = (value) =>
  assertMethods(value, 'RoomRepository', ['read', 'write', 'remove', 'list'])

export const assertCampaignRepositoryPort = (value) =>
  assertMethods(value, 'CampaignRepository', ['read', 'write', 'remove', 'list'])

export const assertSharedStateRepositoryPort = (value) =>
  assertMethods(value, 'SharedStateRepository', ['read', 'write', 'remove', 'list'])

export const assertAssetStorePort = (value) =>
  assertMethods(value, 'AssetStore', ['read', 'write', 'remove', 'list'])

export const assertPluginBundleStorePort = (value) =>
  assertMethods(value, 'PluginBundleStore', ['read', 'write', 'remove', 'list'])

export const assertPresenceStorePort = (value) =>
  assertMethods(value, 'PresenceStore', ['touch', 'read', 'remove', 'list'])

export const assertSnapshotStorePort = (value) =>
  assertMethods(value, 'SnapshotStore', ['read', 'write', 'remove', 'list'])

export function assertServerStoragePorts(value) {
  if (!value || typeof value.scopeRoom !== 'function') throw new TypeError('invalid ServerStorage ports')
  assertRoomRepositoryPort(value.roomRepository)
  assertCampaignRepositoryPort(value.campaignRepository)
  assertSharedStateRepositoryPort(value.sharedStateRepository)
  assertAssetStorePort(value.assetStore)
  assertPluginBundleStorePort(value.pluginBundleStore)
  assertPresenceStorePort(value.presenceStore)
  assertSnapshotStorePort(value.snapshotStore)
  return value
}
