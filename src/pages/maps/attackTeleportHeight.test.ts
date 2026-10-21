import { expect, it, vi } from 'vitest'
import { chooseAttackTeleportHeight } from './attackTeleportHeight'

it('distinguishes terrain, absolute zero, altitude and cancellation', async () => {
  expect(await chooseAttackTeleportHeight(async () => '')).toEqual({})
  expect(await chooseAttackTeleportHeight(async () => '0')).toEqual({ elevationFeet: 0 })
  expect(await chooseAttackTeleportHeight(async () => '10')).toEqual({ elevationFeet: 10 })
  expect(await chooseAttackTeleportHeight(async () => null)).toBeNull()
})

it('does not submit non-finite or malformed heights', async () => {
  const prompt = vi.fn().mockResolvedValueOnce('Infinity').mockResolvedValueOnce('abc').mockResolvedValueOnce('-5')
  expect(await chooseAttackTeleportHeight(prompt)).toEqual({ elevationFeet: -5 })
  expect(prompt).toHaveBeenCalledTimes(3)
})
