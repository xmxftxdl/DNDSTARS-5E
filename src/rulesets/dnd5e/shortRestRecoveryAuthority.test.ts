import { expect, it } from 'vitest'
import { settleDnd5eShortRestRecovery } from './shortRestRecoveryAuthority'
import { shortRestRecoveryFixture as fixture } from './shortRestRecovery.fixture'

it('atomically computes conditional healing and a durable replay receipt without mutating inputs', () => {
  const input = fixture()
  const initial = JSON.stringify(input)
  const result = settleDnd5eShortRestRecovery(input)
  expect(result.ok, JSON.stringify(result)).toBe(true)
  if (!result.ok) throw Error('failed')
  expect(result.character.currentHp).toBe(19)
  expect(result.character.hitPointDice?.[0].current).toBe(2)
  expect(JSON.stringify(input)).toBe(initial)
  const restored = JSON.parse(JSON.stringify({ ...input, characters: [result.character, input.characters[1]], journal: result.journal }))
  // Retry after clock advancement returns the receipt, not a second heal or debit.
  const replay = settleDnd5eShortRestRecovery({ ...restored, worldMinute: 121 })
  expect(replay).toMatchObject({ ok: true, deduplicated: true, character: { currentHp: 19 }, journal: { receipts: [result.receipt] } })
  const again = { ...restored, command: { ...input.command, id: 'second', expectedPoolCurrent: 2 } }
  expect(settleDnd5eShortRestRecovery(again)).toEqual({ ok: false, reason: 'song-of-rest-already-used' })
  const next = settleDnd5eShortRestRecovery({ ...again, command: { ...again.command, songOfRestBardId: undefined }, songOfRestRoll: undefined })
  expect(next).toMatchObject({ ok: true, character: { currentHp: 31, hitPointDice: [{ current: 1 }] } })
  expect(settleDnd5eShortRestRecovery({ ...restored, command: { ...input.command, tokenId: 'forged' } }))
    .toEqual({ ok: false, reason: 'command-id-conflict' })
})

it.each(['owner', 'map', 'token', 'pool', 'stale-time', 'not-beneficiary', 'combat', 'bard', 'bad-die'] as const)(
  'rejects an invalid authority request without spending resources: %s', mode => {
    const input = fixture()
    if (mode === 'owner') input.controlledCharacterIds = []
    if (mode === 'map') input.command.mapId = 'other'
    if (mode === 'token') input.map.tokens[0].characterId = 'someone-else'
    if (mode === 'pool') input.command.expectedPoolCurrent = 2
    if (mode === 'stale-time') input.worldMinute = 121
    if (mode === 'not-beneficiary') input.advances[0].beneficiaryCharacterIds = ['bard']
    if (mode === 'combat') input.combatActive = true
    if (mode === 'bard') input.songOfRestEligibleBardIds = []
    if (mode === 'bad-die') input.hitDieRoll = 11
    const before = JSON.stringify(input)
    expect(settleDnd5eShortRestRecovery(input).ok).toBe(false)
    expect(JSON.stringify(input)).toBe(before)
  },
)

it.each(['far', 'dismissed', 'expired'] as const)('does not maximize with an unavailable companion: %s', mode => {
  const input = fixture()
  const pet = input.map.tokens[1]
  if (mode === 'far') pet.x = 1525
  if (mode === 'dismissed') pet.dnd5eSummon!.dismissed = true
  if (mode === 'expired') pet.dnd5eSummon!.dismissAtWorldMinute = 120
  expect(settleDnd5eShortRestRecovery(input)).toMatchObject({ ok: true, character: { currentHp: 5 } })
})
