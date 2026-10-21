import { expect, it } from 'vitest'
import example from '../../../examples/community-sdk/check-boon.json'
import { dnd5eRoomRuntimeProjectionBytes } from './roomRuntimeProjection'
import { parseDnd5eUnifiedContentBundleV1, encodeDnd5eUnifiedContentBundleV1 } from './unifiedContent'
import { DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER } from './contentPackageV2'

it('projects native mechanics without source prose and preserves the source bundle', () => {
  const source = parseDnd5eUnifiedContentBundleV1(JSON.stringify(example))!
  source.manifest.distributionPolicy = 'room-ephemeral'
  source.manifest.description = 'Private source description'
  source.definitions[0].description = 'Private rules text'
  source.definitions[0].source = { packageId: 'private.source', packageVersion: '1.0.0' }
  const before = structuredClone(source)
  const projected = parseDnd5eUnifiedContentBundleV1(dnd5eRoomRuntimeProjectionBytes(encodeDnd5eUnifiedContentBundleV1(source)))!
  expect(source).toEqual(before)
  expect(projected.runtimeProjection).toBe('room-runtime-mechanics')
  expect(projected.manifest.description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
  expect(projected.definitions[0].description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
  expect(projected.definitions[0].source).toBeUndefined()
  expect(projected.definitions[0].activities?.map(activity => activity.outcomes)).toEqual(source.definitions[0].activities?.map(activity => activity.outcomes))
  expect(JSON.stringify(projected)).not.toContain('Private')
  expect(dnd5eRoomRuntimeProjectionBytes(encodeDnd5eUnifiedContentBundleV1(projected))).toEqual(encodeDnd5eUnifiedContentBundleV1(projected))
  source.manifest.distributionPolicy = 'local-only'
  expect(() => dnd5eRoomRuntimeProjectionBytes(encodeDnd5eUnifiedContentBundleV1(source))).toThrow('Only room-ephemeral')
  expect(() => parseDnd5eUnifiedContentBundleV1(JSON.stringify({ ...projected, runtimeProjection: 'unknown' }))).toThrow()
})

it('retains explicitly shared spell display text in native room packages', () => {
  const source = parseDnd5eUnifiedContentBundleV1(JSON.stringify(example))!
  source.manifest.distributionPolicy = 'room-ephemeral'
  source.manifest.roomSpellText = 'include'
  source.definitions = [{ schemaVersion: 1, namespace: source.manifest.id, id: 'test-spell', version: '1.0.0',
    kind: 'spell', name: '测试法术', description: '中文说明', automation: source.definitions[0].automation,
    payload: { id: 'test-spell', name: '测试法术', level: 1, school: 'abjuration', ritual: false,
      castingTime: { value: 1, unit: 'action' }, range: { type: 'self' },
      components: { verbal: true, somatic: true, material: false }, duration: { type: 'instantaneous', concentration: false },
      classes: ['wizard'], description: '中文法术说明。'.repeat(100), higherLevels: '升环说明',
      automation: { mode: 'reference-only' } } }]
  const projected = parseDnd5eUnifiedContentBundleV1(dnd5eRoomRuntimeProjectionBytes(encodeDnd5eUnifiedContentBundleV1(source)))!
  expect(projected.definitions[0].description).toBe('中文说明')
  expect(projected.definitions[0].payload).toMatchObject({ description: '中文法术说明。'.repeat(100), higherLevels: '升环说明' })
  expect(projected.manifest.description).toBe(DND5E_ROOM_RUNTIME_PROSE_PLACEHOLDER)
})

it('retains feature display text in opted-in native packages and strips source metadata', () => {
  const source = parseDnd5eUnifiedContentBundleV1(JSON.stringify(example))!
  source.manifest.distributionPolicy = 'room-ephemeral'
  source.manifest.roomContentText = 'include'
  source.definitions[0].description = '特性中文说明。'.repeat(100)
  source.definitions[0].source = { packageId: 'private.source', packageVersion: '1.0.0' }
  const projected = parseDnd5eUnifiedContentBundleV1(dnd5eRoomRuntimeProjectionBytes(encodeDnd5eUnifiedContentBundleV1(source)))!
  expect(projected.definitions[0].description).toBe(source.definitions[0].description)
  expect(projected.definitions[0].payload).toEqual(source.definitions[0].payload)
  expect(projected.definitions[0].source).toBeUndefined()
})
