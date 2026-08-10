import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const COMBAT_RECOVERY_RESOURCES = new Set([
  'maps',
  'characters',
  'combat',
  'combat-interrupts',
  'combat-log',
  'combat-statistics',
  'map-geometry',
  'map-fog',
  'map-exploration',
])

// These append-only projections may advance through mutation routes which do
// not create a DM undo row. Full recovery replaces them; primary state still
// uses strict compare-and-swap checks.
const DERIVED_RECOVERY_RESOURCES = new Set([
  'combat-interrupts',
  'combat-log',
  'combat-statistics',
])

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function boundedText(value, maximum) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}

export function dmUndoAfterMetadata(resource, value) {
  if (resource !== 'combat' || !plainObject(value)) return null
  return {
    mapId: boundedText(value.mapId, 160),
    combatId: boundedText(value.combatId, 200),
    ...(Number.isInteger(value.round) ? { round: value.round } : {}),
    ...(Number.isInteger(value.initiativeIndex)
      ? { initiativeIndex: value.initiativeIndex }
      : {}),
  }
}

export function dmUndoPublicTransaction(transaction) {
  const combatChange = transaction.changes.find((change) => change.resource === 'combat')
  const beforeCombat = plainObject(combatChange?.before) ? combatChange.before : null
  const afterCombat = plainObject(combatChange?.after) ? combatChange.after : null
  return {
    transactionId: transaction.transactionId,
    label: transaction.label,
    status: transaction.status,
    resources: transaction.changes.map((change) => change.resource),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    combatRecoverable: transaction.changes.some((change) =>
      COMBAT_RECOVERY_RESOURCES.has(change.resource)),
    ...(beforeCombat || afterCombat ? {
      combat: {
        mapId: boundedText(afterCombat?.mapId ?? beforeCombat?.mapId, 160),
        combatId: boundedText(afterCombat?.combatId ?? beforeCombat?.combatId, 200),
        beforeRound: Number.isInteger(beforeCombat?.round) ? beforeCombat.round : undefined,
        afterRound: Number.isInteger(afterCombat?.round) ? afterCombat.round : undefined,
        beforeInitiativeIndex: Number.isInteger(beforeCombat?.initiativeIndex)
          ? beforeCombat.initiativeIndex
          : undefined,
        afterInitiativeIndex: Number.isInteger(afterCombat?.initiativeIndex)
          ? afterCombat.initiativeIndex
          : undefined,
      },
    } : {}),
    ...(Number.isFinite(transaction.undoneAt) ? { undoneAt: transaction.undoneAt } : {}),
  }
}

export async function applyDmAuthoritativeCombatRecovery(
  ctx,
  requestedTransactionId,
  actorMemberId,
  dependencies,
) {
  const {
    RoomProtocolError,
    dmUndoJournalFile,
    withWriteLock,
    sharedStateTransactionLockPath,
    recoverSharedStateTransaction,
    normalizeDmUndoJournal,
    safeName,
    sharedStateRevision,
    atomicDeleteJsonStateCasLocked,
    atomicWriteJsonStateCasLocked,
    validateSharedStateShape,
    atomicRename,
  } = dependencies
  if (!requestedTransactionId) {
    throw new RoomProtocolError(400, 'invalid-dm-combat-recovery-transaction')
  }
  const journalPath = dmUndoJournalFile(ctx)
  await mkdir(path.dirname(journalPath), { recursive: true })
  return withWriteLock(sharedStateTransactionLockPath(ctx), async () => {
    await recoverSharedStateTransaction(ctx)
    return withWriteLock(journalPath, async () => {
      let journal
      try {
        journal = normalizeDmUndoJournal(JSON.parse(await readFile(journalPath, 'utf8')))
      } catch {
        journal = normalizeDmUndoJournal(null)
      }
      const targetIndex = journal.transactions.findIndex((candidate) =>
        candidate.transactionId === requestedTransactionId &&
        candidate.status === 'applied' &&
        candidate.changes.some((change) => COMBAT_RECOVERY_RESOURCES.has(change.resource)))
      if (targetIndex < 0) {
        throw new RoomProtocolError(404, 'dm-combat-recovery-transaction-not-found')
      }

      const selectedTransactions = journal.transactions.slice(targetIndex).filter((candidate) =>
        candidate.status === 'applied' &&
        candidate.changes.some((change) => COMBAT_RECOVERY_RESOURCES.has(change.resource)))
      const selectedIds = new Set(selectedTransactions.map((candidate) => candidate.transactionId))
      const recoveryByResource = new Map()
      for (const transaction of selectedTransactions) {
        for (const change of transaction.changes) {
          const current = recoveryByResource.get(change.resource)
          if (current && current.afterRevision !== change.beforeRevision) {
            throw new RoomProtocolError(409, 'dm-undo-state-changed')
          }
          recoveryByResource.set(change.resource, current
            ? { ...current, afterRevision: change.afterRevision }
            : {
                resource: change.resource,
                before: change.before ?? null,
                beforeRevision: change.beforeRevision,
                afterRevision: change.afterRevision,
              })
        }
      }

      const currentValues = new Map()
      for (const recovery of recoveryByResource.values()) {
        const resourcePath = path.join(ctx.stateRoot, `${safeName(recovery.resource)}.json`)
        let current = null
        try {
          current = JSON.parse(await readFile(resourcePath, 'utf8'))
        } catch {}
        const currentRevision = sharedStateRevision(current)
        if (
          currentRevision !== recovery.afterRevision &&
          !DERIVED_RECOVERY_RESOURCES.has(recovery.resource)
        ) throw new RoomProtocolError(409, 'dm-undo-state-changed')
        currentValues.set(recovery.resource, current)
        recovery.currentRevision = currentRevision
      }

      const restored = []
      try {
        for (const recovery of recoveryByResource.values()) {
          const resourcePath = path.join(ctx.stateRoot, `${safeName(recovery.resource)}.json`)
          const current = currentValues.get(recovery.resource)
          const result = recovery.before == null
            ? await atomicDeleteJsonStateCasLocked(resourcePath, {
                expectedRevision: recovery.currentRevision,
                writerId: `dm-combat-recovery:${requestedTransactionId}`,
              })
            : await atomicWriteJsonStateCasLocked(resourcePath, recovery.before, {
                expectedRevision: recovery.currentRevision,
                writerId: `dm-combat-recovery:${requestedTransactionId}`,
                validateIncoming: (candidate) =>
                  validateSharedStateShape(recovery.resource, candidate),
              })
          if (!result.ok) throw new RoomProtocolError(409, 'dm-undo-state-changed')
          restored.push({ recovery, result, current })
        }
      } catch (error) {
        for (const entry of restored.reverse()) {
          const rollbackPath = path.join(ctx.stateRoot, `${safeName(entry.recovery.resource)}.json`)
          const options = {
            expectedRevision: entry.result.revision,
            writerId: `dm-combat-recovery-rollback:${requestedTransactionId}`,
          }
          if (entry.current == null) {
            await atomicDeleteJsonStateCasLocked(rollbackPath, options).catch(() => {})
          } else {
            await atomicWriteJsonStateCasLocked(rollbackPath, entry.current, {
              ...options,
              validateIncoming: (candidate) =>
                validateSharedStateShape(entry.recovery.resource, candidate),
            }).catch(() => {})
          }
        }
        throw error
      }

      const now = Date.now()
      const restoredByResource = new Map(restored.map((entry) => [entry.recovery.resource, entry]))
      const next = {
        ...journal,
        revision: journal.revision + 1,
        transactions: journal.transactions.map((candidate) => {
          if (selectedIds.has(candidate.transactionId)) {
            return {
              ...candidate,
              status: 'undone',
              undoneAt: now,
              undoneByMemberId: actorMemberId,
              updatedAt: now,
            }
          }
          if (candidate.status !== 'applied') return candidate
          let changed = false
          const changes = candidate.changes.map((change) => {
            const restoredEntry = restoredByResource.get(change.resource)
            if (restoredEntry && change.afterRevision === restoredEntry.recovery.beforeRevision) {
              changed = true
              return { ...change, afterRevision: restoredEntry.result.revision }
            }
            return change
          })
          return changed ? { ...candidate, changes, updatedAt: now } : candidate
        }),
        updatedAt: now,
      }
      await atomicRename(journalPath, JSON.stringify(next))
      return {
        transaction: next.transactions.find((candidate) =>
          candidate.transactionId === requestedTransactionId),
        transactions: next.transactions.filter((candidate) => selectedIds.has(candidate.transactionId)),
        restored: restored.map((entry) => ({
          resource: entry.recovery.resource,
          revision: entry.result.revision,
        })),
      }
    })
  })
}
