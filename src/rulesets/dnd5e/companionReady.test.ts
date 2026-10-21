import { expect, it } from 'vitest'
import { isDnd5eCompanionReady, isDnd5eCompanionReadyCommand } from './companionReady'

it.each([null, [], {}, { trigger: '', actionKind: 'attack' }, { trigger: ' '.repeat(4), actionKind: 'attack' },
  { trigger: 'x'.repeat(321), actionKind: 'attack' }, { trigger: 'approaches', actionKind: ['attack'] },
  { trigger: 'approaches', actionKind: 'spell' }, { trigger: 'approaches', actionKind: 'attack', damage: 99 }])('rejects malformed Ready declarations: %j', value => {
  expect(isDnd5eCompanionReady(value)).toBe(false)
  expect(isDnd5eCompanionReadyCommand({ command: 'ready', ready: value })).toBe(false)
})

it.each(['attack', 'move', 'interact-object', 'other'])('accepts the declared %s kind only for Ready commands', actionKind => {
  const ready = { trigger: 'When the signal is given', actionKind }
  expect(isDnd5eCompanionReadyCommand({ command: 'ready', ready })).toBe(true)
  expect(isDnd5eCompanionReadyCommand({ command: 'attack', ready })).toBe(false)
})
