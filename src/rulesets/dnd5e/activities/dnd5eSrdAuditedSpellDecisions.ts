import decisionsFile from '../generated/srdSpellHeadlessDecisions.generated.json'

export type Dnd5eSrdAuditedSpellTargetV1 = 'full' | 'partial' | 'manual'

type DecisionTuple = readonly [Dnd5eSrdAuditedSpellTargetV1, ...string[]]

export const DND5E_SRD_AUDITED_SPELL_DECISIONS_V1 =
  decisionsFile.decisions as unknown as Readonly<Record<string, DecisionTuple>>

/** Lightweight audit metadata lookup with no Activity/runtime dependencies. */
export function dnd5eSrdAuditedSpellDecisionV1(
  spellId: string,
): { target: Dnd5eSrdAuditedSpellTargetV1; codes: readonly string[] } | undefined {
  const decision = DND5E_SRD_AUDITED_SPELL_DECISIONS_V1[spellId]
  return decision ? { target: decision[0], codes: [...decision.slice(1)] } : undefined
}

export function dnd5eSrdAuditedSpellDecisionTupleV1(spellId: string): DecisionTuple | undefined {
  return DND5E_SRD_AUDITED_SPELL_DECISIONS_V1[spellId]
}
