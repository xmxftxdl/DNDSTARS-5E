import { sharedApiRoomGateway } from '../adapters/http/sharedApiRoomGateway'
import { SharedRoomService } from '../application/rooms/SharedRoomService'
import { withCombatRoundClock } from './withCombatRoundClock'
import { withStructureExpiry } from './withStructureExpiry'
import { withStructureObjectBoundary } from './withStructureObjectBoundary'
import {settleBrowserTempleExpiry} from './browserTempleExpiry'
import { withEtherealClock } from './withEtherealClock'

/** Browser composition root; the UI receives an Application service, not HTTP/SSE functions. */
export const browserSharedRoomService = new SharedRoomService(withCombatRoundClock(withEtherealClock(withStructureExpiry(withStructureObjectBoundary(sharedApiRoomGateway),settleBrowserTempleExpiry))))
