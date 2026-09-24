import { expect, it } from 'vitest'
import { createCombatPresentationReplayFilter } from './combatBannerReplay'
function storage() {
 const items = new Map<string, string>()
 return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => { items.set(key, value) } }
}
for (const scope of ['published', 'received'] as const) it(`${scope}: same spell banner and projectile do not replay after reload`, () => {
 const backend = storage()
 const initial = createCombatPresentationReplayFilter(() => backend, scope)
 for (const type of ['spell-banner', 'spell-projectile']) {
  const event = { type, id: `cast-1:${type}`, mapId: 'map-1', createdAt: 10 }
  expect(initial(event)).toBe(true)
  for (let i = 0; i < 3; i++) expect(createCombatPresentationReplayFilter(() => backend, scope)({ ...event, createdAt: 100 + i })).toBe(false)
  expect(initial({ ...event, id: `cast-2:${type}` })).toBe(true)
 }
})
it('does not hide persistent effects or saving throw updates on restoration', () => {
 const accept = createCombatPresentationReplayFilter(() => storage(), 'received')
 for (const type of ['spell-persistent-target-effect', 'saving-throw-status']) {
  const event = { type, id: 'persistent-1', mapId: 'map-1' }
  expect(accept(event)).toBe(true)
  expect(accept(event)).toBe(true)
 }
})
it('keeps publishing and receiving independent, and handles unavailable storage', () => {
 const backend = storage(), event = { type: 'spell-banner', id: 'cast', mapId: 'map' }
 expect(createCombatPresentationReplayFilter(() => backend, 'published')(event)).toBe(true)
 expect(createCombatPresentationReplayFilter(() => backend, 'received')(event)).toBe(true)
 const fallback = createCombatPresentationReplayFilter(() => { throw Error() }, 'received')
 expect(fallback(event)).toBe(true)
 expect(fallback(event)).toBe(false)
})
