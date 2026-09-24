import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { createDiceCheckCorrelation } from './diceCheckCorrelation'
import { createDiceCheckCueLedger } from './diceCheckCueLedger'
import type { Dnd5eCombatEvent } from '../../rulesets/dnd5e/headlessCombatEngine'
const preview = { id: 'preview', rollId: 'roll-A', values: [15], mode: 'normal' as const, kind: 'attack' as const, actorName: '法师', targetName: '目标', success: true, provisional: true }
const event: Dnd5eCombatEvent = { type: 'attack-resolved', actorId: 'caster', targetId: 'target', d20: 15, total: 19, armorClass: 13, hit: true, critical: false }
it('passes the actual attacking token through every character-backed attack preview', () => {
  const source = readFileSync('src/pages/MapsWorkspacePage.tsx', 'utf8')
  const contexts = [...source.matchAll(/const attackRollContext = \{([\s\S]*?)\n\s*\}/g)]
    .map(match => match[1]).filter(body => body.includes('rollerCharacterId:'))
  expect(contexts).toHaveLength(9)
  for (const context of contexts) {
    const actor = context.match(/rollerCharacterId: (\w+)\.actor\.id/)?.[1]
    expect(context).toContain('rollerTokenId:')
    if (actor) expect(context).toContain(`rollerTokenId: ${actor}.actorToken.id`)
  }
})
it('deduplicates copy damage settlement without confusing its subject with the attacking token', () => {
  const correlation = createDiceCheckCorrelation()
  const accept = createDiceCheckCueLedger()
  const copyPreview = { ...preview, actorName: '新冒险者·拟像' }
  correlation.record('map:copy-attack', 'copy-token', copyPreview)
  expect(accept(copyPreview)).toBe(true)
  const final = { ...copyPreview, id: 'damage', rollId: undefined, provisional: false }
  const linked = correlation.attach('map:copy-attack', { ...event, actorId: 'copy-token' }, final)
  expect(linked.rollId).toBe(preview.rollId)
  expect(accept(linked)).toBe(false)
  const casterFinal = correlation.attach('map:copy-attack', event, { ...final, id: 'caster-attack' })
  expect(casterFinal.rollId).toBeUndefined()
  expect(accept(casterFinal)).toBe(true)
})
it('retains preview correlation through refresh and repeated damage settlement without swallowing the next attack', () => {
  const saved = new Map<string, string>()
  const storage = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }
  const scope = 'map:transaction-A'
  const final = { ...preview, id: 'settlement', rollId: undefined, values: undefined, provisional: false }
  createDiceCheckCorrelation(storage).record(scope, 'caster', preview)
  createDiceCheckCueLedger(storage)(preview)
  const restored = createDiceCheckCorrelation(storage)
  const accept = createDiceCheckCueLedger(storage)
  expect(accept(restored.attach(scope, { ...event }, final))).toBe(false)
  expect(accept(createDiceCheckCorrelation(storage).attach(scope, { ...event }, { ...final, id: 'damage-settlement' }))).toBe(false)
  const next = { ...preview, id: 'preview-2', rollId: 'roll-B' }
  restored.record(scope, 'caster', next)
  expect(accept(next)).toBe(true)
  expect(restored.attach(scope, { ...event }, final).rollId).toBe('roll-B')
  expect(accept(restored.attach(scope, { ...event, hit: false }, { ...final, success: false }))).toBe(true)
})
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
  expect(correlation.attach('map:transaction-A', event, final)).toEqual(linked)
})
it('never suppresses an unrelated final just because display names match', () => {
  const accept = createDiceCheckCueLedger()
  accept(preview)
  expect(accept({ ...preview, id: 'other-final', rollId: 'roll-B', provisional: false })).toBe(true)
  expect(accept({ id: 'uncorrelated', kind: preview.kind, actorName: preview.actorName, targetName: preview.targetName, success: true })).toBe(true)
})
