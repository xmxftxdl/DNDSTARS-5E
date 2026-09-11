import { browserSharedRoomService } from '../composition/browserSharedRoomService'
import { browserCombatController } from '../composition/browserCombatController'
import { browserRuntime } from '../adapters/browser/browserRuntime'
import { createBrowserCombatInterruptCoordinator } from '../composition/maps/createBrowserCombatInterruptCoordinator'
import { publishNamedActionPresentation as publishNamedActionPresentationWithRuntime, publishSingleTargetAttackPresentation as publishSingleTargetAttackPresentationWithRuntime } from '../presentation/maps/combatPresentationController'
export const loadEnemyPoolPicker = () => import('../components/map/EnemyPoolPicker')
export const {
  appendSharedPlayerActionRequest,
  clearSharedEventBacklog,
  clearSharedResource,
  getSharedResourceRevisionWatermark,
  loadSharedResource,
  mutateSharedCombatInterrupt,
  publishSharedEvent,
  saveSharedResource,
  saveSharedResourcesAtomically,
  saveSharedResourceWithResult,
  submitPlayerCharacterCommand,
  subscribeSharedEvent,
  subscribeSharedResourceInvalidation,
} = browserSharedRoomService
export const runtimeNow = browserRuntime.now
export const browserCombatInterruptCoordinator = createBrowserCombatInterruptCoordinator()
export const loadAuthorityCombatState = browserCombatController.loadAuthorityState
export const saveAuthorityCombatState = browserCombatController.saveAuthorityState
export const runtimeId = browserRuntime.create.bind(browserRuntime)
export const publishSingleTargetAttackPresentation = (
  input: Omit<Parameters<typeof publishSingleTargetAttackPresentationWithRuntime>[0], 'ids'>,
) => publishSingleTargetAttackPresentationWithRuntime({ ...input, ids: browserRuntime })
export const publishNamedActionPresentation = (
  input: Omit<Parameters<typeof publishNamedActionPresentationWithRuntime>[0], 'ids'>,
) => publishNamedActionPresentationWithRuntime({ ...input, ids: browserRuntime })
export const runtimeNumericId = browserRuntime.createNumeric.bind(browserRuntime)
export const randomDieValue = (sides: number) => browserRuntime.integer(1, sides)

