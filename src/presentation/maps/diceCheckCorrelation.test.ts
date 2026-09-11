import { expect, it } from 'vitest'
import { createDiceCheckCorrelation } from './diceCheckCorrelation'
import { createDiceCheckCueLedger } from './diceCheckCueLedger'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'
const preview = { id: 'preview', rollId: 'roll-A', values: [15], mode: 'normal' as const, kind: 'attack' as const, actorName: '法师', targetName: '目标', success: true, provisional: true }
const event: Dnd5eCombatEvent = { type: 'attack-resolved', actorId: 'caster', targetId: 'target', d20: 15, total: 19, armorClass: 13, hit: true, critical: false }
it('correlates final presentation only inside the same transaction and actor', () => {
  const correlation = createDiceCheckCorrelation()
  const final = { id: 'final', kind: preview.kind, actorName: preview.actorName, targetName: preview.targetName, success: true }
  correlation.record('map:transaction-A', 'caster', preview)
  expect(correlation.attach('map:transaction-B', event, final)).toEqual(final)
  expect(correlation.attach('map:transaction-A', { ...event, actorId: 'same-name-other-character' }, final)).toEqual(final)
  const linked = correlation.attach('map:transaction-A', event, final)
  expect(linked.rollId).toBe('roll-A')
  const accept = createDiceCheckCueLedger()
  expect(accept(preview)).toBe(true)
  expect(accept(linked)).toBe(false)
  expect(correlation.attach('map:transaction-A', event, final)).toEqual(final)
})
it('never suppresses an unrelated final just because display names match', () => {
  const accept = createDiceCheckCueLedger()
  accept(preview)
  expect(accept({ ...preview, id: 'other-final', rollId: 'roll-B', provisional: false })).toBe(true)
  expect(accept({ id: 'uncorrelated', kind: preview.kind, actorName: preview.actorName, targetName: preview.targetName, success: true })).toBe(true)
})
