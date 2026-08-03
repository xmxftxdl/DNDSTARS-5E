import type {
  CampaignTimeMutation,
  SharedCampaignTimeState,
} from '../lib/campaignTime'
import { useCampaignTimeStore } from './campaignTime'
import { useCharacterStore } from './characters'

interface CampaignLongRestTransaction {
  currentClock: SharedCampaignTimeState
  reason: string
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
  const nextClock = await transaction.mutate({
    operation: 'long-rest',
    reason: transaction.reason,
  })
  await transaction.reconcileCharacters(nextClock)
  return nextClock
}

export function completeDnd5eCampaignLongRest(reason: string): Promise<SharedCampaignTimeState> {
  const campaignTime = useCampaignTimeStore.getState()
  return runDnd5eCampaignLongRestTransaction({
    currentClock: campaignTime.state,
    reason,
    mutate: campaignTime.mutate,
    reconcileCharacters: (clock) =>
      useCharacterStore.getState().reconcileCampaignTimeAndSave(clock),
  })
}
