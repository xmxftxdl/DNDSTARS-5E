/** Coalesce transient room conflicts without relying on another store update. */
export function createCampaignTimeReconciliationRetry() {
  let timer: ReturnType<typeof setTimeout> | undefined
  return {
    schedule(reconcile: () => void) {
      if (timer !== undefined) return
      timer = setTimeout(() => { timer = undefined; reconcile() }, 500)
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
  }
}
