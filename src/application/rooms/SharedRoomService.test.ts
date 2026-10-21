import { expect, it, vi } from 'vitest'
import { SharedRoomService } from './SharedRoomService'
import type { SharedRoomGatewayPort } from '../../ports/sharedRoomGateway'

it('forwards lease identity, cancellation and the original response exactly once', async () => {
  const result = { status: 409, body: { active: true } }
  const sendLongCastingOwnerCommand = vi.fn().mockResolvedValue(result)
  const service = new SharedRoomService({ sendLongCastingOwnerCommand } as unknown as SharedRoomGatewayPort)
  const signal = new AbortController().signal
  const command = { operation: 'status', binding: { sourceId: 'caster' } }
  const send = service.sendLongCastingOwnerCommand
  expect(await send('room', 'dm-member', command, signal)).toBe(result)
  expect(sendLongCastingOwnerCommand).toHaveBeenCalledExactlyOnceWith('room', 'dm-member', command, signal)
})

it('fails explicitly if an adapter does not support casting ownership leases', () => {
  const service = new SharedRoomService({} as SharedRoomGatewayPort)
  expect(() => service.sendLongCastingOwnerCommand('room', 'dm', {}, new AbortController().signal))
    .toThrow('casting-owner-transport-unavailable')
})
