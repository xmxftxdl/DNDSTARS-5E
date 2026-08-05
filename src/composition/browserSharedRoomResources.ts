import { browserSharedRoomService } from './browserSharedRoomService'

/**
 * Compatibility-shaped browser composition facade for Zustand stores.
 * Stores depend on the Application service while HTTP/SSE details remain in
 * the adapter. New orchestration should prefer a dedicated Controller.
 */
export const getSharedResourceRevisionWatermark = browserSharedRoomService.getSharedResourceRevisionWatermark
export const loadSharedResource = browserSharedRoomService.loadSharedResource
export const saveSharedResource = browserSharedRoomService.saveSharedResource
export const saveSharedResourceWithResult = browserSharedRoomService.saveSharedResourceWithResult
export const saveSharedResourcesAtomically = browserSharedRoomService.saveSharedResourcesAtomically
export const mutateSharedRoomResource = browserSharedRoomService.mutateSharedRoomResource
export const putSharedImage = browserSharedRoomService.putSharedImage
export const getSharedImage = browserSharedRoomService.getSharedImage
export const deleteSharedImage = browserSharedRoomService.deleteSharedImage
export const sampleSharedServerClock = browserSharedRoomService.sampleSharedServerClock

export type {
  SharedResourceSaveResult,
  SharedResourceTransactionResult,
  SharedResourceTransactionWrite,
  SharedResourceWriteOptions,
  SharedServerClockSample,
} from '../ports/sharedRoomGateway'
