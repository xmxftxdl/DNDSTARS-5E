import { useRef } from 'react'
import type { DmAdjudicationInterruptResponse } from '../../lib/combatInterruptProtocol'
import type { Dnd5ePostD20AdjustmentUse } from '../../application/combat/dnd5eCombatRules'

/**
 * Browser-only continuations for open Interrupt windows.
 *
 * These promises are deliberately not persisted: the shared Interrupt queue is
 * authoritative, while this registry only reconnects the current React host to
 * the callback that initiated a prompt. Keeping it outside MapsPage prevents
 * transport state from being mistaken for combat state.
 */
export function useCombatInterruptRegistry() {
  const pendingSharedOpportunityAttackRef = useRef<{
    id: string
    attackerCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedProtectionRef = useRef<{
    id: string
    protectorCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedShieldSpellRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedCounterspellRef = useRef<{
    id: string
    actorCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedUncannyDodgeRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedDeflectMissilesRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedSavingThrowRerollRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedBardicInspirationRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedCuttingWordsRef = useRef<{
    id: string
    bardCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedDarkOnesOwnLuckRef = useRef<{
    id: string
    targetCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedStrokeOfLuckRef = useRef<{
    id: string
    actorCharId: string
    resolve: (accepted: boolean) => void
  } | null>(null)
  const pendingSharedEmpoweredSpellRef = useRef<{
    id: string
    actorCharId: string
    resolve: (rerollKeys: string[]) => void
  } | null>(null)
  const pendingSharedStandAgainstTideRef = useRef<{
    id: string
    hunterCharId: string
    resolve: (targetTokenId: string | undefined) => void
  } | null>(null)
  const pendingSharedPluginChoiceRef = useRef<{
    id: string
    actionId: string
    resolve: (optionId: string) => void
  } | null>(null)
  const pendingSharedDmAdjudicationRef = useRef<{
    id: string
    actionId: string
    resolve: (response: DmAdjudicationInterruptResponse) => void
  } | null>(null)
  const pendingD20ConfirmationsRef = useRef(new Map<string, {
    originalValue: number
    resolve: (value: {
      value: number
      postD20Adjustment?: Dnd5ePostD20AdjustmentUse
    }) => void
  }>())

  const suppressedOpportunityAttackPromptIdsRef = useRef(new Set<string>())
  const suppressedProtectionPromptIdsRef = useRef(new Set<string>())
  const suppressedShieldSpellPromptIdsRef = useRef(new Set<string>())
  const suppressedCounterspellPromptIdsRef = useRef(new Set<string>())
  const suppressedUncannyDodgePromptIdsRef = useRef(new Set<string>())
  const suppressedDeflectMissilesPromptIdsRef = useRef(new Set<string>())
  const suppressedSavingThrowRerollPromptIdsRef = useRef(new Set<string>())
  const suppressedBardicInspirationPromptIdsRef = useRef(new Set<string>())
  const suppressedCuttingWordsPromptIdsRef = useRef(new Set<string>())
  const suppressedDarkOnesOwnLuckPromptIdsRef = useRef(new Set<string>())
  const suppressedStrokeOfLuckPromptIdsRef = useRef(new Set<string>())
  const suppressedEmpoweredSpellPromptIdsRef = useRef(new Set<string>())
  const suppressedStandAgainstTidePromptIdsRef = useRef(new Set<string>())
  const suppressedPluginChoicePromptIdsRef = useRef(new Set<string>())
  const suppressedDmAdjudicationPromptIdsRef = useRef(new Set<string>())
  const sharedDmAdjudicationPromptIdRef = useRef<string | null>(null)

  return {
    pendingSharedOpportunityAttackRef,
    pendingSharedProtectionRef,
    pendingSharedShieldSpellRef,
    pendingSharedCounterspellRef,
    pendingSharedUncannyDodgeRef,
    pendingSharedDeflectMissilesRef,
    pendingSharedSavingThrowRerollRef,
    pendingSharedBardicInspirationRef,
    pendingSharedCuttingWordsRef,
    pendingSharedDarkOnesOwnLuckRef,
    pendingSharedStrokeOfLuckRef,
    pendingSharedEmpoweredSpellRef,
    pendingSharedStandAgainstTideRef,
    pendingSharedPluginChoiceRef,
    pendingSharedDmAdjudicationRef,
    pendingD20ConfirmationsRef,
    suppressedOpportunityAttackPromptIdsRef,
    suppressedProtectionPromptIdsRef,
    suppressedShieldSpellPromptIdsRef,
    suppressedCounterspellPromptIdsRef,
    suppressedUncannyDodgePromptIdsRef,
    suppressedDeflectMissilesPromptIdsRef,
    suppressedSavingThrowRerollPromptIdsRef,
    suppressedBardicInspirationPromptIdsRef,
    suppressedCuttingWordsPromptIdsRef,
    suppressedDarkOnesOwnLuckPromptIdsRef,
    suppressedStrokeOfLuckPromptIdsRef,
    suppressedEmpoweredSpellPromptIdsRef,
    suppressedStandAgainstTidePromptIdsRef,
    suppressedPluginChoicePromptIdsRef,
    suppressedDmAdjudicationPromptIdsRef,
    sharedDmAdjudicationPromptIdRef,
  }
}
