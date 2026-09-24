import { createPlayerAiServiceFromPersistedConfig } from './player-ai-service.mjs'

/** Optional integrations must not prevent the shared tabletop from starting. */
export async function startOptionalPlayerAi({ load = createPlayerAiServiceFromPersistedConfig, warn = console.warn } = {}) {
  try { return await load() }
  catch {
    // A parsing exception can contain configuration text; never log the exception/secret.
    warn('Player AI disabled: saved configuration could not be loaded. Run npm run local-ai:configure to repair it.')
    return { service: null, files: { config: 'unavailable', playerUsage: 'unavailable' }, configurationError: true }
  }
}
