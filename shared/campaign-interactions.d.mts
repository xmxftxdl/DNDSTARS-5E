export interface CampaignInteraction {
  id: string
  sourceId: string
  bearerId: string
  effectId: string
  packageId: string
  requiredRounds: number
  status: 'active' | 'interrupted' | 'completed'
  startedAtWorldMinute: number
  startedByMemberId: string
  createdAt: number
  completedAtWorldMinute?: number
  completionAdvanceId?: string
  interruptedAtWorldMinute?: number
  interruptionReason?: 'host-interrupted' | 'unverified-time-advance'
}
export type CampaignInteractionMutation =
  | { operation: 'start-interaction'; id: string; sourceId: string; bearerId: string; effectId: string; packageId: string; requiredRounds: number; expectedWorldMinute: number }
  | { operation: 'interrupt-interaction'; id: string; expectedWorldMinute: number }
export function validCampaignInteractions(value: unknown, worldMinute: number, advances?: unknown): value is CampaignInteraction[] | undefined
export function campaignInteractionReferenceIssue(request: unknown, entities: unknown): string | null
export function mutateCampaignInteraction<T extends { worldMinute: number; interactions?: readonly CampaignInteraction[]; updatedAt: number }>(base: T, mutation: CampaignInteractionMutation, now: number, memberId: string): { ok: true; changed: boolean; next: T } | { ok: false; status: number; error: string }
export function interruptCampaignInteractionsForTimeAdvance(rows: readonly CampaignInteraction[] | undefined, worldMinute: number): CampaignInteraction[] | undefined
