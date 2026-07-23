export interface SharedWriteTicket {
  sequence: number
  updatedAt: number
}

export interface SharedWriteWatermark {
  begin: (now?: number) => SharedWriteTicket
  settle: (ticket: SharedWriteTicket, accepted: boolean) => boolean
  shouldApplyRemote: (updatedAt: number) => boolean
  acceptRemote: (updatedAt: number) => void
}

/**
 * Separates an in-flight local write from an authoritative server ACK.
 * Pending writes temporarily block older SSE snapshots, while rejected writes
 * release that guard so conflict recovery can apply the server's current state.
 */
export function createSharedWriteWatermark(initialUpdatedAt = 0): SharedWriteWatermark {
  let acknowledgedAt = initialUpdatedAt
  let localPendingAt = initialUpdatedAt
  let sequence = 0

  return {
    begin(now = Date.now()) {
      const ticket = {
        sequence: ++sequence,
        updatedAt: Math.max(now, acknowledgedAt + 1, localPendingAt + 1),
      }
      localPendingAt = ticket.updatedAt
      return ticket
    },
    settle(ticket, accepted) {
      if (ticket.sequence !== sequence) return false
      if (accepted) acknowledgedAt = ticket.updatedAt
      else localPendingAt = acknowledgedAt
      return true
    },
    shouldApplyRemote(updatedAt) {
      return Number.isFinite(updatedAt) && updatedAt >= Math.max(acknowledgedAt, localPendingAt)
    },
    acceptRemote(updatedAt) {
      if (!Number.isFinite(updatedAt)) return
      acknowledgedAt = Math.max(acknowledgedAt, updatedAt)
      localPendingAt = Math.max(localPendingAt, updatedAt)
    },
  }
}
