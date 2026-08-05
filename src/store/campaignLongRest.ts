import type {
  CampaignRestRecoveryReport,
  CampaignTimeMutation,
  SharedCampaignTimeState,
} from '../lib/campaignTime'
import { useCampaignTimeStore } from './campaignTime'
import { useCharacterStore } from './characters'
import { buildDnd5eRestRecoveryReports } from '../rulesets/dnd5e/campaignRestRecovery'

interface CampaignLongRestTransaction {
  currentClock: SharedCampaignTimeState
  reason: string
  restKind?: 'short-rest' | 'long-rest'
  beneficiaryCharacterIds?: readonly string[]
  ignoreLongRestCooldown?: boolean
  createRecoveryReports?: () => CampaignRestRecoveryReport[]
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
  await transaction.reconcileCharacters(transaction.currentClock)
  const restRecoveryReports = transaction.createRecoveryReports?.()
  const nextClock = await transaction.mutate({
    operation: transaction.restKind ?? 'long-rest',
    reason: transaction.reason,
    ...(transaction.beneficiaryCharacterIds
      ? { beneficiaryCharacterIds: [...transaction.beneficiaryCharacterIds] }
      : {}),
    ...(transaction.ignoreLongRestCooldown === true
      ? { ignoreLongRestCooldown: true }
      : {}),
    ...(restRecoveryReports ? { restRecoveryReports } : {}),
  })
  await transaction.reconcileCharacters(nextClock)
  return nextClock
}

function completeDnd5eCampaignRest(
  restKind: 'short-rest' | 'long-rest',
  reason: string,
  beneficiaryCharacterIds?: readonly string[],
  ignoreLongRestCooldown: boolean = false,
): Promise<SharedCampaignTimeState> {
  const campaignTime = useCampaignTimeStore.getState()
  return runDnd5eCampaignLongRestTransaction({
    currentClock: campaignTime.state,
    reason,
    restKind,
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
    mutate: campaignTime.mutate,
    reconcileCharacters: (clock) =>
      useCharacterStore.getState().reconcileCampaignTimeAndSave(clock),
  })
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
