import type{BountifulDeathAreaOriginalIdentity}from'../../ports/dnd5eDeathAreaOriginalTransport'
import type{BountifulPluginSpellSavingOriginalIdentity}from'../../ports/dnd5ePluginSpellSavingOriginalTransport'
import type{BountifulDeathFirstRepeatIdentity}from'../../ports/dnd5eDeathFirstRepeatTransport'
import type{BountifulDeathRepeatSavingIdentity}from'../../ports/dnd5eDeathRepeatSavingTransport'
import type{BountifulPluginSpellAbilityOriginalIdentity}from'../../ports/dnd5ePluginSpellAbilityOriginalTransport'
import type{BountifulActivityOriginalIdentity}from'../../ports/dnd5eActivityOriginalTransport'
import type {
  SharedCombatInterruptMutation,
  SharedResourceTransactionWrite,
  SharedResourceWriteOptions,
  SharedRoomGatewayPort,
} from '../../ports/sharedRoomGateway'

/** Application boundary for authoritative room transport and CAS persistence. */
export class SharedRoomService {
  private forwardTransport<K extends keyof SharedRoomGatewayPort>(name: K): NonNullable<SharedRoomGatewayPort[K]> {
    return ((...args: unknown[]) => {
      const handler = this.gateway[name]
      if (typeof handler !== 'function') throw new Error(String(name) + ':transport-unavailable')
      return Reflect.apply(handler, this.gateway, args)
    }) as NonNullable<SharedRoomGatewayPort[K]>
  }
  readonly submitSharedActivityDeathChoice = this.forwardTransport('submitSharedActivityDeathChoice')
  readonly submitSharedActivityDeathInitiativeRaw = this.forwardTransport('submitSharedActivityDeathInitiativeRaw')
  readonly requestSharedArcaneBasePrefix = this.forwardTransport('requestSharedArcaneBasePrefix')
  readonly requestSharedArcaneMovement = this.forwardTransport('requestSharedArcaneMovement')
  readonly requestSharedArcaneNative = this.forwardTransport('requestSharedArcaneNative')
  readonly requestSharedMastermindMagicTruth = this.forwardTransport('requestSharedMastermindMagicTruth')
  readonly requestSharedMastermindMisdirection = this.forwardTransport('requestSharedMastermindMisdirection')
  readonly readBountifulOpportunitySequenceBook = this.forwardTransport('readBountifulOpportunitySequenceBook')
  readonly requestSharedMastermindThoughtReading = this.forwardTransport('requestSharedMastermindThoughtReading')
  readonly requestSharedScBasePrefix = this.forwardTransport('requestSharedScBasePrefix')
  readonly requestSharedEffectEndConfirmedReceipt = this.forwardTransport('requestSharedEffectEndConfirmedReceipt')
  readonly loadBountifulMonsterDamageZeroOriginalSource = this.forwardTransport('loadBountifulMonsterDamageZeroOriginalSource')
  readonly probeBountifulMonsterDamageZeroOriginalParent = this.forwardTransport('probeBountifulMonsterDamageZeroOriginalParent')
  readonly loadBountifulMonsterDamageZeroOriginalParent = this.forwardTransport('loadBountifulMonsterDamageZeroOriginalParent')
  readonly currentBountifulMonsterDamageZeroOriginal = this.forwardTransport('currentBountifulMonsterDamageZeroOriginal')
  readonly readTempestuousBeforeOriginalPreparationBook = this.forwardTransport('readTempestuousBeforeOriginalPreparationBook')
  readonly inspectBountifulSpellDamageZeroOriginalParent = this.forwardTransport('inspectBountifulSpellDamageZeroOriginalParent')
  readonly readBountifulSpellDamageZeroOriginalBook = this.forwardTransport('readBountifulSpellDamageZeroOriginalBook')
  readonly readStormCastOriginalPreparationBook = this.forwardTransport('readStormCastOriginalPreparationBook')
  readonly inspectBountifulDamageZeroOriginalParent = this.forwardTransport('inspectBountifulDamageZeroOriginalParent')
  readonly readBountifulDamageZeroOriginalBook = this.forwardTransport('readBountifulDamageZeroOriginalBook')
  readonly submitSharedArmorNativeChoice = this.forwardTransport('submitSharedArmorNativeChoice')
  readonly submitSharedArmorNativeRaw = this.forwardTransport('submitSharedArmorNativeRaw')

  private readonly gateway: SharedRoomGatewayPort

  constructor(gateway: SharedRoomGatewayPort) {
    this.gateway = gateway
  }

  readonly requestSharedMastermindWardAttack = <T>(operation:'issue'|'answer'|'project'|'list',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindWardAttack)throw Error('requestSharedMastermindWardAttack:transport-unavailable');return this.gateway.requestSharedMastermindWardAttack<T>(operation,input)}
  readonly requestSharedMastermindWardOriginal = <T>(operation:'register'|'request'|'raw'|'confirm'|'complete'|'abort-extra',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindWardOriginal)throw Error('requestSharedMastermindWardOriginal:transport-unavailable');return this.gateway.requestSharedMastermindWardOriginal<T>(operation,input)}
  readonly requestSharedMastermindWardSavingChoice = <T>(operation:'register'|'request'|'list'|'answer'|'raw'|'confirm'|'complete',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindWardSavingChoice)throw Error('requestSharedMastermindWardSavingChoice:transport-unavailable');return this.gateway.requestSharedMastermindWardSavingChoice<T>(operation,input)}
  readonly loadBountifulDeathFirstOriginalSource=(input:BountifulDeathFirstRepeatIdentity)=>{if(!this.gateway.loadBountifulDeathFirstOriginalSource)throw Error('death-first:transport-unavailable');return this.gateway.loadBountifulDeathFirstOriginalSource(input)}
  readonly inspectBountifulDeathFirstOriginal=(input:BountifulDeathFirstRepeatIdentity)=>{if(!this.gateway.inspectBountifulDeathFirstOriginal)throw Error('death-first:transport-unavailable');return this.gateway.inspectBountifulDeathFirstOriginal(input)}
  readonly loadBountifulDeathFirstRepeatSavingSource=(input:BountifulDeathFirstRepeatIdentity)=>{if(!this.gateway.loadBountifulDeathFirstRepeatSavingSource)throw Error('death-first:transport-unavailable');return this.gateway.loadBountifulDeathFirstRepeatSavingSource(input)}
  readonly loadBountifulDeathAreaOriginalSource=(input:BountifulDeathAreaOriginalIdentity)=>{if(!this.gateway.loadBountifulDeathAreaOriginalSource)throw Error('death-area-original:transport-unavailable');return this.gateway.loadBountifulDeathAreaOriginalSource(input)}
  readonly loadBountifulDeathRepeatSavingSource=(input:BountifulDeathRepeatSavingIdentity)=>{if(!this.gateway.loadBountifulDeathRepeatSavingSource)throw Error('death-repeat-saving:transport-unavailable');return this.gateway.loadBountifulDeathRepeatSavingSource(input)}
  readonly loadBountifulActivityOriginalSource = (input:BountifulActivityOriginalIdentity) => {if(!this.gateway.loadBountifulActivityOriginalSource)throw Error('activity-original:transport-unavailable');return this.gateway.loadBountifulActivityOriginalSource(input)}
  readonly loadBountifulPluginSpellAbilityOriginalSource = (input:BountifulPluginSpellAbilityOriginalIdentity) => {if(!this.gateway.loadBountifulPluginSpellAbilityOriginalSource)throw Error('activity-original:transport-unavailable');return this.gateway.loadBountifulPluginSpellAbilityOriginalSource(input)}
  readonly loadBountifulPluginSpellSavingOriginalSource = (input:BountifulPluginSpellSavingOriginalIdentity) => {if(!this.gateway.loadBountifulPluginSpellSavingOriginalSource)throw Error('plugin-spell-saving:transport-unavailable');return this.gateway.loadBountifulPluginSpellSavingOriginalSource(input)}
  readonly loadBountifulPluginSpellCompoundPrimarySource = (input:BountifulPluginSpellSavingOriginalIdentity) => {if(!this.gateway.loadBountifulPluginSpellCompoundPrimarySource)throw Error('plugin-spell-saving:transport-unavailable');return this.gateway.loadBountifulPluginSpellCompoundPrimarySource(input)}
  readonly loadSpellcastingOriginalPreparation=(input:{parentId:string;mapId:string;combatId:string;effectId:string})=>{if(!this.gateway.loadSpellcastingOriginalPreparation)throw Error('spellcasting-saving:transport-unavailable');return this.gateway.loadSpellcastingOriginalPreparation(input)}
  readonly requestSharedSpellcastingOriginalSaving=(operation:'prepare'|'inspect'|'dice'|'read'|'target-source'|'target-prepare'|'target-inspect'|'target-dice'|'target-read',payload:unknown)=>{if(!this.gateway.requestSharedSpellcastingOriginalSaving)throw Error('spellcasting-saving:transport-unavailable');return this.gateway.requestSharedSpellcastingOriginalSaving(operation,payload)}
  readonly requestSharedStormFurySaving = (operation:'prepare'|'inspect'|'dice'|'read',payload:unknown) => {if(!this.gateway.requestSharedStormFurySaving)throw Error('storm-fury:transport-unavailable');return this.gateway.requestSharedStormFurySaving(operation,payload)}
  readonly requestSharedTempestuousLandingOriginal = (operation:'prepare'|'inspect'|'dice'|'read',payload:unknown) => {if(!this.gateway.requestSharedTempestuousLandingOriginal)throw Error('tempestuous-landing:transport-unavailable');return this.gateway.requestSharedTempestuousLandingOriginal(operation,payload)}
  readonly requestSharedPluginTempestuousSavingOwned = (operation:'read'|'claim',payload:unknown) => {if(!this.gateway.requestSharedPluginTempestuousSavingOwned)throw Error('plugin-tempestuous:transport-unavailable');return this.gateway.requestSharedPluginTempestuousSavingOwned(operation,payload)}
  readonly requestSharedPluginTempestuousOriginal = (operation:'prepare'|'read'|'probe'|'publication'|'inputs-read'|'inputs-start'|'inputs-record'|'inputs-save-start'|'saving-read'|'saving-begin'|'saving-append'|'saving-answer'|'saving-complete'|'saving-material-read'|'saving-material',payload:unknown) => {if(!this.gateway.requestSharedPluginTempestuousOriginal)throw Error('plugin-tempestuous:transport-unavailable');return this.gateway.requestSharedPluginTempestuousOriginal(operation,payload)}
  readonly requestSharedPluginTempestuousLandingOriginal = (operation:'prepare'|'inspect'|'read'|'dice',payload:unknown) => {if(!this.gateway.requestSharedPluginTempestuousLandingOriginal)throw Error('plugin-tempestuous-landing:transport-unavailable');return this.gateway.requestSharedPluginTempestuousLandingOriginal(operation,payload)}
  readonly requestSharedTempestuousHostOriginal = (operation:'begin'|'read'|'cancel'|'spell-window-prefix',payload:unknown) => {if(!this.gateway.requestSharedTempestuousHostOriginal)throw Error('tempestuous-host:transport-unavailable');return this.gateway.requestSharedTempestuousHostOriginal(operation,payload)}
  readonly requestSharedBountifulInitiativeOriginal = <T>(operation:'begin'|'issue'|'qualify'|'answer'|'raw'|'confirm'|'replacement-raw'|'replacement-confirm'|'complete'|'project'|'list',input:unknown):Promise<T> => {if(!this.gateway.requestSharedBountifulInitiativeOriginal)throw Error('initiative-original:transport-unavailable');return this.gateway.requestSharedBountifulInitiativeOriginal<T>(operation,input)}
  readonly requestSharedMastermindSpellWindow = <T>(operation:'ward-choice-list'|'begin'|'register'|'ward-register'|'ward-complete'|'ward-bountiful-register'|'ward-bountiful-choice'|'ward-bountiful-raw'|'ward-bountiful-confirm'|'ward-bountiful-complete'|'ward-bountiful-project'|'ward-outcome-register'|'ward-outcome'|'ward-retarget-propose'|'ward-retarget-accept'|'ward-retarget-reject'|'issue'|'raw'|'confirm'|'complete'|'abort-extra'|'source'|'request',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindSpellWindow)throw Error('spell-window:transport-unavailable');return this.gateway.requestSharedMastermindSpellWindow<T>(operation,input)}
  readonly requestSharedMastermindNativeWardOriginal = <T>(operation:'register'|'request'|'raw'|'confirm'|'complete',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindNativeWardOriginal)throw Error('native-ward-original:transport-unavailable');return this.gateway.requestSharedMastermindNativeWardOriginal<T>(operation,input)}
  readonly requestSharedMastermindNativeWardBountiful = <T>(operation:'register'|'project'|'list'|'answer'|'raw'|'confirm',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindNativeWardBountiful)throw Error('native-ward-bountiful:transport-unavailable');return this.gateway.requestSharedMastermindNativeWardBountiful<T>(operation,input)}
  readonly requestSharedBountifulMonsterSavingLate = <T>(input:{parentId:string;mapId:string;combatId:string}):Promise<T> => {if(!this.gateway.requestSharedBountifulMonsterSavingLate)throw Error('monster-save-late:transport-unavailable');return this.gateway.requestSharedBountifulMonsterSavingLate<T>(input)}
  readonly requestSharedMastermindNativeWardOutcome = <T>(operation:'register'|'answer'|'project'|'list',input:unknown):Promise<T> => {if(!this.gateway.requestSharedMastermindNativeWardOutcome)throw Error('native-ward-outcome:transport-unavailable');return this.gateway.requestSharedMastermindNativeWardOutcome<T>(operation,input)}
  readonly sendLongCastingOwnerCommand = (
    roomId: string, memberId: string, command: unknown, signal: AbortSignal,
  ) => {
    if (!this.gateway.sendLongCastingOwnerCommand) throw new Error('casting-owner-transport-unavailable')
    return this.gateway.sendLongCastingOwnerCommand(roomId, memberId, command, signal)
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
  readonly submitPlayerCharacterCommand = (
    command: Record<string, unknown> & { commandId: string },
  ) => this.gateway.submitPlayerCharacterCommand(command)
  readonly loadDmUndoHistory = () => this.gateway.loadDmUndoHistory()
  readonly undoDmTransaction = (transactionId?: string) => this.gateway.undoDmTransaction(transactionId)
  readonly recoverDmCombatToTransaction = (transactionId: string) =>
    this.gateway.recoverDmCombatToTransaction(transactionId)
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
