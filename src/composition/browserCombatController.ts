import { CombatController } from '../application/combat/CombatController'
import { browserSharedRoomService } from './browserSharedRoomService'

export const browserCombatController = new CombatController(browserSharedRoomService)
