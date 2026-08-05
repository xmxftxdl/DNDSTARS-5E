export interface JsonRepositoryPort {
  read(id: string): Promise<unknown | undefined>
  write(id: string, value: unknown): Promise<void>
  remove(id: string): Promise<void>
  list(): Promise<string[]>
}

export interface BinaryStorePort {
  read(id: string): Promise<{ bytes: Buffer; metadata?: unknown } | undefined>
  write(id: string, bytes: Uint8Array, metadata?: unknown): Promise<void>
  remove(id: string): Promise<void>
  list(): Promise<string[]>
}

export interface PresenceStorePort {
  touch(id: string, value: unknown, ttlMs?: number): void
  read(id: string): unknown | undefined
  remove(id: string): void
  list(): Array<{ id: string; value: unknown; expiresAt: number }>
}

export interface ServerStoragePorts {
  roomRepository: JsonRepositoryPort
  campaignRepository: JsonRepositoryPort
  sharedStateRepository: JsonRepositoryPort
  assetStore: BinaryStorePort
  pluginBundleStore: BinaryStorePort
  presenceStore: PresenceStorePort
  snapshotStore: JsonRepositoryPort
  scopeRoom(roomId: string): ServerStoragePorts
}

export function assertRoomRepositoryPort<T>(value: T): T
export function assertCampaignRepositoryPort<T>(value: T): T
export function assertSharedStateRepositoryPort<T>(value: T): T
export function assertAssetStorePort<T>(value: T): T
export function assertPluginBundleStorePort<T>(value: T): T
export function assertPresenceStorePort<T>(value: T): T
export function assertSnapshotStorePort<T>(value: T): T
export function assertServerStoragePorts<T>(value: T): T
