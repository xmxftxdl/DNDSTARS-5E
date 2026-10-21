/** Finish a pass before retrying failures. Eligibility is reread after each
 * persisted result; callers own cancellation, task budgets and paid requests. */
export function* pdfImportAttemptOrder<T>(jobs: readonly T[], passes: number, eligible: (job: T) => boolean): Generator<T> {
  if (!Number.isSafeInteger(passes) || passes < 1 || passes > 3) throw new Error('invalid-pdf-import-pass-count')
  const ordered = [...jobs]
  for (let pass = 0; pass < passes; pass++) {
    let attempted = false
    for (const job of ordered) {
      if (!eligible(job)) continue
      attempted = true
      yield job
    }
    if (!attempted) return
  }
}
