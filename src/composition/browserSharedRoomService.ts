import { sharedApiRoomGateway } from '../adapters/http/sharedApiRoomGateway'
import { SharedRoomService } from '../application/rooms/SharedRoomService'

/** Browser composition root; the UI receives an Application service, not HTTP/SSE functions. */
export const browserSharedRoomService = new SharedRoomService(sharedApiRoomGateway)
