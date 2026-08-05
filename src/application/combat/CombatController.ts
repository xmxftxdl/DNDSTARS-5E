import { requireCommandAcknowledgement, type CommandOutcome } from '../commands/commandOutcome'
import { executeCommandWithOutcome } from '../commands/commandOutcome'
import type { SharedRoomService } from '../rooms/SharedRoomService'
import type { SharedResourceWriteOptions } from '../../ports/sharedRoomGateway'

/**
 * Application coordinator for the authoritative combat resource. It hides the
 * resource name, transport errors and player-action transport from React.
 */
export class CombatController {
  private readonly rooms: SharedRoomService

  constructor(rooms: SharedRoomService) {
    this.rooms = rooms
  }

  loadAuthorityState = <State>() => this.rooms.loadSharedResource<State>('combat')

  saveAuthorityState = <State>(state: State, options?: SharedResourceWriteOptions) =>
    requireCommandAcknowledgement(() => this.rooms.saveSharedResource('combat', state, options))

  saveAuthorityStateWithOutcome = <State>(state: State, options?: SharedResourceWriteOptions): Promise<CommandOutcome<void>> =>
    executeCommandWithOutcome(() => this.rooms.saveSharedResource('combat', state, options))

  submitPlayerAction = <Action>(action: Action) =>
    requireCommandAcknowledgement(() => this.rooms.appendSharedPlayerActionRequest(action))
}
