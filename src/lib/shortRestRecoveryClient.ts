import { SHORT_REST_RECOVERY_RESOURCE, validShortRestRecoveryJournal } from '../../shared/short-rest-recovery.mjs'
import type { Dnd5eShortRestRecoveryCommand, Dnd5eShortRestRecoveryReceipt } from '../rulesets/dnd5e/shortRestRecoveryAuthority'
import type { SharedPlayerActionState, SharedPlayerActionAckState } from './sharedCombatTypes'
import { appendSharedPlayerActionRequest, loadSharedResource } from './sharedApi'
import { getRoomSession } from './roomSession'

export interface ShortRestClientPorts {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  identity(): { roomId: string; memberId: string } | undefined
  read(name: string): Promise<unknown>
  append(action: SharedPlayerActionState): Promise<void>
  id(): string
  now(): number
  wait(): Promise<void>
  timeoutMs: number
}
const defaults = (): ShortRestClientPorts => ({ storage: localStorage,
  identity: () => { const room = getRoomSession(); return room?.role === 'player' ? { roomId: room.roomId, memberId: room.memberId } : undefined },
  read: loadSharedResource, append: appendSharedPlayerActionRequest, id: () => crypto.randomUUID(), now: Date.now,
  wait: () => new Promise(resolve => setTimeout(resolve, 1000)), timeoutMs: 60000,
})

/** Keep the same command across reloads/timeouts. Only a terminal receipt/rejection clears it. */
export async function requestShortRestRecovery(
  requested: Omit<Dnd5eShortRestRecoveryCommand, 'id'>,
  ports = defaults(),
): Promise<Dnd5eShortRestRecoveryReceipt> {
  const identity = ports.identity()
  if (!identity) throw Error('请在玩家房间中提交短休请求。')
  const key = `stars-short-rest-pending:${identity.roomId}:${identity.memberId}:${requested.characterId}:${requested.advanceId}`
  const guard = () => {
    const current = ports.identity()
    if (current?.roomId !== identity.roomId || current.memberId !== identity.memberId) throw Error('房间已切换，请返回原房间查看结算。')
  }
  const stored = ports.storage.getItem(key)
  let command: Dnd5eShortRestRecoveryCommand
  try { command = stored ? JSON.parse(stored) : { ...requested, id: ports.id() } }
  catch { throw Error('待处理短休请求记录损坏，尚未重新提交。') }
  const probe = { schemaVersion: 1, receipts: [{ command, hitDiceHealing: 0, songOfRestHealing: 0, healingApplied: 0 }] }
  if (!validShortRestRecoveryJournal(probe)) throw Error('短休请求格式无效。')
  const receipt = async () => {
    const raw = await ports.read(SHORT_REST_RECOVERY_RESOURCE)
    guard()
    if (raw == null) return undefined
    if (!validShortRestRecoveryJournal(raw)) throw Error('短休结算记录损坏。')
    const saved = raw.receipts.find(row => row.command.id === command.id)
    if (saved && (Object.keys(command) as (keyof Dnd5eShortRestRecoveryCommand)[]).some(field => saved.command[field] !== command[field])) throw Error('短休请求编号冲突。')
    return saved
  }
  const existing = await receipt()
  if (existing) { ports.storage.removeItem(key); return existing }
  if (stored && (['advanceId', 'characterId', 'mapId', 'tokenId', 'poolIndex', 'expectedPoolCurrent', 'songOfRestBardId'] as const).some(field => command[field] !== requested[field])) {
    throw Error('上一笔短休请求尚未确认，请用原选项重试。')
  }
  ports.storage.setItem(key, JSON.stringify(command))
  guard()
  const action: SharedPlayerActionState = { id: command.id, mapId: command.mapId, actorTokenId: command.tokenId,
    characterId: command.characterId, roomMemberId: identity.memberId, sourceMode: 'player', status: 'pending',
    type: 'dnd5e-short-rest-recovery', round: 1, initiativeIndex: 0, seq: ports.now(), updatedAt: ports.now(),
    dnd5eShortRestRecovery: { advanceId: command.advanceId, poolIndex: command.poolIndex,
      expectedPoolCurrent: command.expectedPoolCurrent, songOfRestBardId: command.songOfRestBardId } }
  await ports.append(action)
  const deadline = ports.now() + ports.timeoutMs
  while (ports.now() <= deadline) {
    guard()
    const saved = await receipt()
    if (saved) { ports.storage.removeItem(key); return saved }
    const ack = await ports.read('player-action-ack') as SharedPlayerActionAckState | null
    guard()
    if (ack?.actionId === command.id && ack.mapId === command.mapId &&
      (ack.recipientMemberId == null || ack.recipientMemberId === identity.memberId) && ack.status === 'rejected') {
      ports.storage.removeItem(key)
      throw Error(`DM 未能结算短休：${ack.reason ?? '请求被拒绝'}`)
    }
    await ports.wait()
  }
  throw Error('仍在等待 DM 结算。可稍后重试同一选项，不会重复消耗生命骰。')
}
