import type { Page } from '@playwright/test'

const NAVIGATION_RETRY_PATTERN = /execution context was destroyed|cannot find context|navigation/i

/**
 * Publishes an action through the real player transport while tolerating the single
 * route transition that can still be in flight immediately after opening a seeded map.
 */
export async function submitPlayerActionFromPage(
  page: Page,
  action: Record<string, unknown>,
): Promise<void> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.evaluate(async (payload) => {
        const [{ publishPlayerActionRequest }, sharedApi] = await Promise.all([
          import('/src/lib/playerActionSync.ts'),
          import('/src/lib/sharedApi.ts'),
        ])
        await publishPlayerActionRequest({
          action: payload as never,
          loadQueue: () => sharedApi.loadSharedResource('player-action-requests'),
          saveQueue: (queue) => sharedApi.saveSharedResource('player-action-requests', queue),
          publishAction: (eventAction) =>
            sharedApi.publishSharedEvent('player-action-player-to-dm', eventAction),
        })
      }, action)
      return
    } catch (error) {
      lastError = error
      if (!NAVIGATION_RETRY_PATTERN.test(String(error)) || attempt === 2) throw error
      await page.waitForLoadState('domcontentloaded').catch(() => undefined)
      await page.waitForTimeout(100)
    }
  }
  throw lastError
}
