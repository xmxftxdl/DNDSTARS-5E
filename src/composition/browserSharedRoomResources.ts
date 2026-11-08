import { browserSharedRoomService } from './browserSharedRoomService'

/**
 * Compatibility-shaped browser composition facade for Zustand stores.
 * Stores depend on the Application service while HTTP/SSE details remain in
 * the adapter. New orchestration should prefer a dedicated Controller.
 */
export const getSharedResourceRevisionWatermark = deferredRoomTransport('getSharedResourceRevisionWatermark')
export const loadSharedResource = deferredRoomTransport('loadSharedResource')
export const saveSharedResource = deferredRoomTransport('saveSharedResource')
export const saveSharedResourceWithResult = deferredRoomTransport('saveSharedResourceWithResult')
export const saveSharedResourcesAtomically = deferredRoomTransport('saveSharedResourcesAtomically')
export const mutateSharedRoomResource = deferredRoomTransport('mutateSharedRoomResource')
export const putSharedImage = deferredRoomTransport('putSharedImage')
export const getSharedImage = deferredRoomTransport('getSharedImage')
export const deleteSharedImage = deferredRoomTransport('deleteSharedImage')
export const sampleSharedServerClock = deferredRoomTransport('sampleSharedServerClock')

export type {
  SharedResourceSaveResult,
  SharedResourceTransactionResult,
  SharedResourceTransactionWrite,
  SharedResourceWriteOptions,
  SharedServerClockSample,
} from '../ports/sharedRoomGateway'

export const requestSharedMastermindWardAttack = deferredRoomTransport('requestSharedMastermindWardAttack')
export const requestSharedMastermindWardOriginal = deferredRoomTransport('requestSharedMastermindWardOriginal')
export const requestSharedMastermindWardSavingChoice = deferredRoomTransport('requestSharedMastermindWardSavingChoice')
export const loadBountifulActivityOriginalSource = deferredRoomTransport('loadBountifulActivityOriginalSource')
export const requestSharedStormFurySaving = deferredRoomTransport('requestSharedStormFurySaving')
export const requestSharedTempestuousLandingOriginal = deferredRoomTransport('requestSharedTempestuousLandingOriginal')
export const requestSharedTempestuousHostOriginal = deferredRoomTransport('requestSharedTempestuousHostOriginal')
export const loadDmUndoHistory = deferredRoomTransport('loadDmUndoHistory')
export const subscribeSharedResourceInvalidation = deferredRoomTransport('subscribeSharedResourceInvalidation')
export type{DmUndoTransactionSummary}from'../ports/sharedRoomGateway'

export const requestSharedBountifulInitiativeOriginal = deferredRoomTransport('requestSharedBountifulInitiativeOriginal')
export const requestSharedMastermindSpellWindow = deferredRoomTransport('requestSharedMastermindSpellWindow')
export const requestSharedMastermindNativeWardOriginal = deferredRoomTransport('requestSharedMastermindNativeWardOriginal')
export const requestSharedMastermindNativeWardBountiful = deferredRoomTransport('requestSharedMastermindNativeWardBountiful')

export const requestSharedMastermindNativeWardOutcome = deferredRoomTransport('requestSharedMastermindNativeWardOutcome')

export const loadBountifulPluginSpellAbilityOriginalSource = deferredRoomTransport('loadBountifulPluginSpellAbilityOriginalSource')
export const loadBountifulPluginSpellSavingOriginalSource = deferredRoomTransport('loadBountifulPluginSpellSavingOriginalSource')
export const loadBountifulPluginSpellCompoundPrimarySource = deferredRoomTransport('loadBountifulPluginSpellCompoundPrimarySource')

export const loadSpellcastingOriginalPreparation = deferredRoomTransport("loadSpellcastingOriginalPreparation")
export const requestSharedSpellcastingOriginalSaving = deferredRoomTransport("requestSharedSpellcastingOriginalSaving")

export const loadBountifulDeathRepeatSavingSource = deferredRoomTransport("loadBountifulDeathRepeatSavingSource")

// Lazy calls preserve the existing composition cycle without eager API reads.
export const requestSharedPluginTempestuousOriginal = (operation:'prepare'|'read'|'probe'|'publication'|'inputs-read'|'inputs-start'|'inputs-record'|'inputs-save-start'|'saving-read'|'saving-begin'|'saving-append'|'saving-answer'|'saving-complete'|'saving-material-read'|'saving-material',payload:unknown) => browserSharedRoomService.requestSharedPluginTempestuousOriginal(operation,payload)
export const requestSharedPluginTempestuousLandingOriginal = (operation:'prepare'|'inspect'|'read'|'dice',payload:unknown) => browserSharedRoomService.requestSharedPluginTempestuousLandingOriginal(operation,payload)

export const loadBountifulDeathFirstOriginalSource = deferredRoomTransport("loadBountifulDeathFirstOriginalSource")
export const inspectBountifulDeathFirstOriginal = deferredRoomTransport("inspectBountifulDeathFirstOriginal")
export const loadBountifulDeathFirstRepeatSavingSource = deferredRoomTransport("loadBountifulDeathFirstRepeatSavingSource")

export const requestSharedPluginTempestuousSavingOwned = (operation:'read'|'claim',payload:unknown) => browserSharedRoomService.requestSharedPluginTempestuousSavingOwned(operation,payload)

export const requestSharedBountifulMonsterSavingLate=<T>(input:{parentId:string;mapId:string;combatId:string}):Promise<T>=>browserSharedRoomService.requestSharedBountifulMonsterSavingLate<T>(input)

export const loadBountifulDeathAreaOriginalSource:typeof browserSharedRoomService.loadBountifulDeathAreaOriginalSource=(input)=>browserSharedRoomService.loadBountifulDeathAreaOriginalSource(input)

// Keep transport reads lazy across the browser composition graph.
function deferredRoomTransport<K extends keyof typeof browserSharedRoomService>(name: K): (typeof browserSharedRoomService)[K] {
  return ((...args: unknown[]) => Reflect.apply(browserSharedRoomService[name] as (...values: unknown[]) => unknown, browserSharedRoomService, args)) as (typeof browserSharedRoomService)[K]
}
export const submitSharedActivityDeathChoice = deferredRoomTransport('submitSharedActivityDeathChoice')
export const submitSharedActivityDeathInitiativeRaw = deferredRoomTransport('submitSharedActivityDeathInitiativeRaw')
export const requestSharedArcaneBasePrefix = deferredRoomTransport('requestSharedArcaneBasePrefix')
export const requestSharedArcaneMovement = deferredRoomTransport('requestSharedArcaneMovement')
export const requestSharedArcaneNative = deferredRoomTransport('requestSharedArcaneNative')
export const requestSharedMastermindMagicTruth = deferredRoomTransport('requestSharedMastermindMagicTruth')
export const requestSharedMastermindMisdirection = deferredRoomTransport('requestSharedMastermindMisdirection')
export const readBountifulOpportunitySequenceBook = deferredRoomTransport('readBountifulOpportunitySequenceBook')
export const publishSharedEvent = deferredRoomTransport('publishSharedEvent')
export const requestSharedMastermindThoughtReading = deferredRoomTransport('requestSharedMastermindThoughtReading')
export const requestSharedScBasePrefix = deferredRoomTransport('requestSharedScBasePrefix')
export const mutateSharedCombatInterrupt = deferredRoomTransport('mutateSharedCombatInterrupt')
export const requestSharedEffectEndConfirmedReceipt = deferredRoomTransport('requestSharedEffectEndConfirmedReceipt')
export const loadBountifulMonsterDamageZeroOriginalSource = deferredRoomTransport('loadBountifulMonsterDamageZeroOriginalSource')
export const probeBountifulMonsterDamageZeroOriginalParent = deferredRoomTransport('probeBountifulMonsterDamageZeroOriginalParent')
export const loadBountifulMonsterDamageZeroOriginalParent = deferredRoomTransport('loadBountifulMonsterDamageZeroOriginalParent')
export const currentBountifulMonsterDamageZeroOriginal = deferredRoomTransport('currentBountifulMonsterDamageZeroOriginal')
export const readTempestuousBeforeOriginalPreparationBook = deferredRoomTransport('readTempestuousBeforeOriginalPreparationBook')
export const inspectBountifulSpellDamageZeroOriginalParent = deferredRoomTransport('inspectBountifulSpellDamageZeroOriginalParent')
export const readBountifulSpellDamageZeroOriginalBook = deferredRoomTransport('readBountifulSpellDamageZeroOriginalBook')
export const readStormCastOriginalPreparationBook = deferredRoomTransport('readStormCastOriginalPreparationBook')
export const inspectBountifulDamageZeroOriginalParent = deferredRoomTransport('inspectBountifulDamageZeroOriginalParent')
export const readBountifulDamageZeroOriginalBook = deferredRoomTransport('readBountifulDamageZeroOriginalBook')
export const submitSharedArmorNativeChoice = deferredRoomTransport('submitSharedArmorNativeChoice')
export const submitSharedArmorNativeRaw = deferredRoomTransport('submitSharedArmorNativeRaw')
