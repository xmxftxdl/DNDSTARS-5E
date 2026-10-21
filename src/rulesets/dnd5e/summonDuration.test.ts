import { expect, it } from 'vitest'
import { dnd5eSummonDurationExpired } from '../../../shared/summon-linger.mjs'
import type { Token } from '../../store/maps'

const timed: NonNullable<Token['dnd5eSummon']> = {
  schemaVersion: 1, pluginId: 'test', featureId: 'summon', sourceCharacterId: 'owner',
  sourceTokenId: 'caster', createdRound: 1, expiresAfterRound: 600,
  createdWorldMinute: 100, side: 'enemy',
}

it('expires on either clock without requiring combat rounds to advance', () => {
  expect(dnd5eSummonDurationExpired(timed, 2, 159)).toBe(false)
  expect(dnd5eSummonDurationExpired(timed, 2, 160)).toBe(true)
  expect(dnd5eSummonDurationExpired(timed, 601, 100)).toBe(true)
  expect(dnd5eSummonDurationExpired({ ...timed, createdWorldMinute: undefined }, 600, 999)).toBe(false)
  expect(dnd5eSummonDurationExpired({ ...timed, persistent: true }, 999, 999)).toBe(false)
})

it('uses the detached deadline when uncontrolled lingering outlives the spell', () => {
  const detached = { ...timed, controlEnded: true as const, dismissAtWorldMinute: 168 }
  expect(dnd5eSummonDurationExpired(detached, 2, 167)).toBe(false)
  expect(dnd5eSummonDurationExpired(detached, 2, 168)).toBe(true)
})
