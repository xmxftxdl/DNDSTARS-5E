import { expect, it } from 'vitest'
import { dnd5ePersistentAreaEffectMatchesOrigin } from './persistentAreaConditionEffects'

it('matches an exact structured origin without requiring a legacy tag', () => {
  const areaId = 'activity-area:' + 'a'.repeat(150)
  const effect = { areaLifetime: { areaId, mapId: 'map', sourceActorId: 'caster' } }
  expect(dnd5ePersistentAreaEffectMatchesOrigin(effect, areaId)).toBe(true)
  expect(dnd5ePersistentAreaEffectMatchesOrigin(effect, 'other', true)).toBe(false)
  expect(dnd5ePersistentAreaEffectMatchesOrigin({ ...effect, tags: ['persistent-area:other'] }, areaId)).toBe(false)
  expect(dnd5ePersistentAreaEffectMatchesOrigin({}, areaId)).toBe(false)
  expect(dnd5ePersistentAreaEffectMatchesOrigin({ tags: ['persistent-area:old'] }, 'old')).toBe(true)
})
