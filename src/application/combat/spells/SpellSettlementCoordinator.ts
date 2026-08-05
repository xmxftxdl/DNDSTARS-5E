export type SpellResolutionValidation =
  | { ok: true }
  | { ok: false; reason: string }

export interface SpellSettlementCoordinatorInput<TResolved, TApplication, TSettled> {
  resolved: TResolved
  application: (resolved: TResolved) => TApplication | undefined
  validate: (resolved: TResolved) => SpellResolutionValidation
  beforeSettlement?: (resolved: TResolved, application: TApplication) => void | Promise<void>
  settle: (resolved: TResolved, application: TApplication) => Promise<TSettled>
}

export type SpellSettlementCoordinatorResult<TSettled> =
  | { ok: true; settled: TSettled }
  | { ok: false; reason: string }

/**
 * Shared ordering boundary for core and plugin spell settlement. It prevents a
 * caller from applying an absent/failed Headless application or running
 * concentration settlement before authoritative resolution observers.
 */
export async function coordinateResolvedSpellSettlement<
  TResolved,
  TApplication,
  TSettled,
>(
  input: SpellSettlementCoordinatorInput<TResolved, TApplication, TSettled>,
): Promise<SpellSettlementCoordinatorResult<TSettled>> {
  const validation = input.validate(input.resolved)
  if (!validation.ok) return validation
  const application = input.application(input.resolved)
  if (!application) return { ok: false, reason: 'missing-application' }
  await input.beforeSettlement?.(input.resolved, application)
  return {
    ok: true,
    settled: await input.settle(input.resolved, application),
  }
}
