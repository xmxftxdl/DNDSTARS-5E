import { validCampaignRestSessions } from './campaign-rest-sessions.mjs'

export function validRestAreaSessionId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 && value.trim() === value
}

/** Resolve from the Host clock, never from a module-supplied session identity. */
export function activeRestAreaSession(clock, characterId, eventId) {
  if (!clock || !validCampaignRestSessions(clock.restSessions, clock.worldMinute, clock.advances)) return
  const sessions = (clock.restSessions ?? []).filter(session => session.status === 'active' &&
    session.startedAtWorldMinute === clock.worldMinute && session.characterIds.includes(characterId))
  if (sessions.length !== 1 || eventId !== `rest-start:${sessions[0].id}`) return
  return sessions[0]
}

/** Shared server/browser cleanup. Missing or invalid bindings fail closed. */
export function expireRestBoundAreas(map, clock) {
  if (!Array.isArray(map.dnd5ePluginAreas)) return map
  const removed = map.dnd5ePluginAreas.filter(area => area.restSessionId != null &&
    (!validRestAreaSessionId(area.restSessionId) || !activeRestAreaSession(clock, area.sourceCharacterId, `rest-start:${area.restSessionId}`)))
  if (!removed.length) return map
  const removedIds = new Set(removed.map(area => area.id))
  const removedTokens = new Set(removed.flatMap(area => area.anchorMode === 'effect-token' && area.anchorTokenId ? [area.anchorTokenId] : []))
  return { ...map, dnd5ePluginAreas: map.dnd5ePluginAreas.filter(area => !removedIds.has(area.id)),
    tokens: Array.isArray(map.tokens) ? map.tokens.filter(token => !removedTokens.has(token.id)) : map.tokens }
}
