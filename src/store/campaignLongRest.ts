import type {
  CampaignRestRecoveryReport,
  CampaignRestFeatureD20Roll,
  CampaignTimeMutation,
  SharedCampaignTimeState,
} from '../lib/campaignTime'
import { useCampaignTimeStore } from './campaignTime'
import { useCharacterStore } from './characters'
import { buildDnd5eRestRecoveryReports } from '../rulesets/dnd5e/campaignRestRecovery'
import { dnd5eStoredD20ReplacementFeaturesForCharacter } from '../rulesets/dnd5e/pluginApi'

interface CampaignLongRestTransaction {
  currentClock: SharedCampaignTimeState
  reason: string
  restKind?: 'short-rest' | 'long-rest'
  restSessionId?: string
  beneficiaryCharacterIds?: readonly string[]
  ignoreLongRestCooldown?: boolean
  createRecoveryReports?: () => CampaignRestRecoveryReport[]
  createRestFeatureD20Rolls?: () => CampaignRestFeatureD20Roll[]
  mutate: (mutation: CampaignTimeMutation) => Promise<SharedCampaignTimeState>
  reconcileCharacters: (clock: SharedCampaignTimeState) => Promise<unknown>
}

/**
 * A character that has never observed the campaign clock must establish its
 * migration baseline before the long-rest advance is written. Otherwise its
 * first reconciliation deliberately treats that new advance as old history
 * and skips the rest benefits, including restored spell slots.
 */
export async function runDnd5eCampaignLongRestTransaction(
  transaction: CampaignLongRestTransaction,
): Promise<SharedCampaignTimeState> {
  const session=transaction.restSessionId ? transaction.currentClock.restSessions?.find(row=>row.id===transaction.restSessionId) : undefined
  if(transaction.restSessionId && (!session || session.status==='interrupted'))throw Error('rest-session-not-active')
  if(session && ((transaction.restKind && transaction.restKind!==session.kind) ||
    (transaction.beneficiaryCharacterIds && JSON.stringify([...transaction.beneficiaryCharacterIds].sort())!==JSON.stringify([...session.characterIds].sort()))))throw Error('rest-session-participant-mismatch')
  const restKind=session?.kind??transaction.restKind??'long-rest'
  await transaction.reconcileCharacters(transaction.currentClock)
  const restRecoveryReports = transaction.createRecoveryReports?.()
  const restFeatureD20Rolls = restKind === 'long-rest'
    ? transaction.createRestFeatureD20Rolls?.()
    : undefined
  const nextClock = await transaction.mutate({
    ...(session ? {operation:'complete-rest-session' as const,id:session.id,expectedWorldMinute:transaction.currentClock.worldMinute} : {operation:restKind}),
    reason: transaction.reason,
    ...(!session && transaction.beneficiaryCharacterIds
      ? { beneficiaryCharacterIds: [...transaction.beneficiaryCharacterIds] }
      : {}),
    ...(transaction.ignoreLongRestCooldown === true
      ? { ignoreLongRestCooldown: true }
      : {}),
    ...(restRecoveryReports ? { restRecoveryReports } : {}),
    ...(restFeatureD20Rolls?.length ? { restFeatureD20Rolls } : {}),
  })
  await transaction.reconcileCharacters(nextClock)
  return nextClock
}

function secureD20(): number {
  const crypto = globalThis.crypto
  if (!crypto?.getRandomValues) throw new Error('secure-random-unavailable')
  const sample = new Uint32Array(1)
  const maximumAccepted = Math.floor(0x1_0000_0000 / 20) * 20
  do crypto.getRandomValues(sample)
  while (sample[0] >= maximumAccepted)
  return sample[0] % 20 + 1
}

function createLongRestFeatureD20Rolls(
  beneficiaryCharacterIds?: readonly string[],
): CampaignRestFeatureD20Roll[] {
  const beneficiaries = beneficiaryCharacterIds ? new Set(beneficiaryCharacterIds) : undefined
  return useCharacterStore.getState().characters.flatMap((character) => {
    if (beneficiaries && !beneficiaries.has(character.id)) return []
    return dnd5eStoredD20ReplacementFeaturesForCharacter(character).map(({ feature, count }) => ({
      characterId: character.id,
      featureId: feature.id,
      values: Array.from({ length: count }, secureD20),
    }))
  })
}

function completeDnd5eCampaignRest(
  restKind: 'short-rest' | 'long-rest',
  reason: string,
  beneficiaryCharacterIds?: readonly string[],
  ignoreLongRestCooldown: boolean = false,
  restSessionId?: string,
): Promise<SharedCampaignTimeState> {
  const campaignTime = useCampaignTimeStore.getState()
  return runDnd5eCampaignLongRestTransaction({
    currentClock: campaignTime.state,
    reason,
    restKind,
    restSessionId,
    beneficiaryCharacterIds,
    ignoreLongRestCooldown,
    createRecoveryReports: () => buildDnd5eRestRecoveryReports({
      characters: useCharacterStore.getState().characters,
      restKind,
      beneficiaryCharacterIds: beneficiaryCharacterIds ?? useCharacterStore.getState().characters.map((character) => character.id),
      currentWorldMinute: campaignTime.state.worldMinute,
      completionWorldMinute: campaignTime.state.worldMinute + (restKind === 'long-rest' ? 8 * 60 : 60),
      ignoreLongRestCooldown,
    }),
    createRestFeatureD20Rolls: () => createLongRestFeatureD20Rolls(beneficiaryCharacterIds),
    mutate: campaignTime.mutate,
    reconcileCharacters: (clock) =>
      useCharacterStore.getState().reconcileCampaignTimeAndSave(clock),
  })
}

export function completeDnd5eCampaignRestSession(id:string):Promise<SharedCampaignTimeState>{
  const session=useCampaignTimeStore.getState().state.restSessions?.find(row=>row.id===id)
  if(!session)return Promise.reject(Error('rest-session-not-found'))
  return completeDnd5eCampaignRest(session.kind,'完成休息会话',session.characterIds,false,id)
}

export function completeDnd5eCampaignLongRest(
  reason: string,
  beneficiaryCharacterIds?: readonly string[],
  ignoreLongRestCooldown: boolean = false,
): Promise<SharedCampaignTimeState> {
  return completeDnd5eCampaignRest(
    'long-rest',
    reason,
    beneficiaryCharacterIds,
    ignoreLongRestCooldown,
  )
}

export function completeDnd5eCampaignShortRest(
  reason: string,
  beneficiaryCharacterIds?: readonly string[],
): Promise<SharedCampaignTimeState> {
  return completeDnd5eCampaignRest('short-rest', reason, beneficiaryCharacterIds)
}
