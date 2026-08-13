export const MOBILE_PLAYER_PROTOCOL_VERSION = 1

export function publicMobilePlayerSession(input) {
  return {
    schemaVersion: 1,
    protocolVersion: MOBILE_PLAYER_PROTOCOL_VERSION,
    sessionType: 'mobile-player',
    sessionId: String(input.sessionId),
    roomId: String(input.roomId),
    campaignId: String(input.campaignId),
    userId: String(input.userId),
    playerId: String(input.playerId),
    controlledTokenIds: [...input.controlledTokenIds].map(String),
    permissions: {
      viewScene: true,
      moveControlledTokens: true,
      submitActions: true,
      editScene: false,
      controlMonsters: false,
    },
    expiresAt: String(input.expiresAt),
  }
}

export function validateMobileMoveIntent(input, session) {
  if (!input || input.schemaVersion !== 1) return { ok: false, reason: 'invalid-schema' }
  if (!session || session.sessionType !== 'mobile-player') return { ok: false, reason: 'invalid-session' }
  if (!session.controlledTokenIds.includes(String(input.tokenId))) return { ok: false, reason: 'token-not-controlled' }
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) return { ok: false, reason: 'invalid-revision' }
  const x = Number(input.destination?.x)
  const y = Number(input.destination?.y)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, reason: 'invalid-destination' }
  return { ok: true, value: { ...input, destination: { x, y } } }
}

