export interface SharedWriteTicket {
  sequence: number
  updatedAt: number
}

export interface SharedWriteWatermark {
  begin: (now?: number) => SharedWriteTicket
  settle: (ticket: SharedWriteTicket, accepted: boolean, revision?: number) => boolean
  shouldApplyRemote: (updatedAt: number, revision?: number) => boolean
  acceptRemote: (updatedAt: number, revision?: number) => void
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
  let acknowledgedRevision = -1
  let pending = false
  const validRevision = (value: number | undefined): value is number =>
    value != null && Number.isInteger(value) && value >= 0

  return {
    begin(now = Date.now()) {
      const ticket = {
        sequence: ++sequence,
        updatedAt: Math.max(now, acknowledgedAt + 1, localPendingAt + 1),
      }
      localPendingAt = ticket.updatedAt
      pending = true
      return ticket
    },
    settle(ticket, accepted, revision) {
      if (ticket.sequence !== sequence) return false
      pending = false
      if (accepted) acknowledgedAt = ticket.updatedAt
      else localPendingAt = acknowledgedAt
      if (accepted && validRevision(revision)) acknowledgedRevision = Math.max(acknowledgedRevision, revision)
      return true
    },
    shouldApplyRemote(updatedAt, revision) {
      if (!Number.isFinite(updatedAt)) return false
      // Undo/recovery restores old content timestamps under a NEW server
      // revision. Wall-clock ordering must not reject that authoritative state.
      if (validRevision(revision)) {
        if (revision < acknowledgedRevision) return false
        if (!pending) return true
      }
      return Number.isFinite(updatedAt) && updatedAt >= Math.max(acknowledgedAt, localPendingAt)
    },
    acceptRemote(updatedAt, revision) {
      if (!Number.isFinite(updatedAt)) return
      if (validRevision(revision) && !pending) {
        acknowledgedRevision = Math.max(acknowledgedRevision, revision)
        acknowledgedAt = localPendingAt = updatedAt
        return
      }
      acknowledgedAt = Math.max(acknowledgedAt, updatedAt)
      localPendingAt = Math.max(localPendingAt, updatedAt)
    },
  }
}
