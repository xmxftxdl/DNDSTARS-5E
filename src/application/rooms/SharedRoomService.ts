import type {
  SharedCombatInterruptMutation,
  SharedResourceTransactionWrite,
  SharedResourceWriteOptions,
  SharedRoomGatewayPort,
} from '../../ports/sharedRoomGateway'

/** Application boundary for authoritative room transport and CAS persistence. */
export class SharedRoomService {
  private readonly gateway: SharedRoomGatewayPort

  constructor(gateway: SharedRoomGatewayPort) {
    this.gateway = gateway
  }

  readonly getSharedResourceRevisionWatermark = (name: string) => this.gateway.getRevisionWatermark(name)
  readonly loadSharedResource = <T>(name: string) => this.gateway.loadResource<T>(name)
  readonly saveSharedResource = <T>(name: string, data: T, options?: SharedResourceWriteOptions) =>
    this.gateway.saveResource(name, data, options)
  readonly saveSharedResourceWithResult = <T>(name: string, data: T, options?: SharedResourceWriteOptions) =>
    this.gateway.saveResourceWithResult(name, data, options)
  readonly saveSharedResourcesAtomically = (
    writes: readonly SharedResourceTransactionWrite[],
    options?: SharedResourceWriteOptions & { transactionId?: string },
  ) => this.gateway.saveResourcesAtomically(writes, options)
  readonly appendSharedPlayerActionRequest = <T>(action: T) => this.gateway.appendPlayerActionRequest(action)
  readonly loadDmUndoHistory = () => this.gateway.loadDmUndoHistory()
  readonly undoDmTransaction = (transactionId?: string) => this.gateway.undoDmTransaction(transactionId)
  readonly publishSharedEvent = <T>(channel: string, data: T) => this.gateway.publishEvent(channel, data)
  readonly clearSharedEventBacklog = (channels?: string[]) => this.gateway.clearEventBacklog(channels)
  readonly clearSharedResource = (name: string) => this.gateway.clearResource(name)
  readonly mutateSharedRoomResource = <T>(resourceName: string, endpoint: string, mutation: unknown) =>
    this.gateway.mutateResource<T>(resourceName, endpoint, mutation)
  readonly putSharedImage = (
    id: string,
    blob: Blob,
    purpose: 'general' | 'handout' | 'scene-audio' = 'general',
  ) => this.gateway.putImage(id, blob, purpose)
  readonly getSharedImage = (id: string) => this.gateway.getImage(id)
  readonly deleteSharedImage = (id: string) => this.gateway.deleteImage(id)
  readonly sampleSharedServerClock = (attempts?: number) => this.gateway.sampleServerClock(attempts)
  readonly mutateSharedCombatInterrupt = <T>(mutation: SharedCombatInterruptMutation) =>
    this.gateway.mutateCombatInterrupt<T>(mutation)
  readonly subscribeSharedEvent = <T>(channel: string, onMessage: (data: T) => void) =>
    this.gateway.subscribeEvent(channel, onMessage)
  readonly subscribeSharedResourceInvalidation = (
    name: string,
    refresh: () => void | Promise<void>,
    options?: Parameters<SharedRoomGatewayPort['subscribeResourceInvalidation']>[2],
  ) => this.gateway.subscribeResourceInvalidation(name, refresh, options)
}
