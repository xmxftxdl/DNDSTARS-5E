import type { MobileCombatLogEntry, MobilePlayerActionAck } from '../../../../packages/mobile-protocol/src'

export function mobileActionAckKey(ack: MobilePlayerActionAck | null | undefined): string {
  return ack ? `${ack.id}:${ack.updatedAt}` : ''
}

export function mobileCombatLogKey(entry: MobileCombatLogEntry | null | undefined): string {
  return entry ? `${entry.id}:${entry.time}:${entry.text}` : ''
}

export function mobileActionAckMessage(ack: MobilePlayerActionAck, rejectionLabel: (reason?: string) => string): string {
  return ack.status === 'accepted'
    ? '行动已由 Host 接受并完成同步'
    : `行动被拒绝：${rejectionLabel(ack.reason)}`
}

export function mobileCombatLogMessage(entry: MobileCombatLogEntry): string {
  return `战斗日志：${entry.text}`
}
