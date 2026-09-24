import { describe, expect, it } from 'vitest'
import { PackageRegistry } from './packageRegistry'
import { ImporterRegistry } from './importerRegistry'
import { packageFixture } from './packageTestFixture'
import type { StarModPackage } from './starmodArchive'

const fixture = (): StarModPackage => ({manifest:packageFixture(),entries:[],localizations:{},assets:{}})
describe('package services', () => {
  it('does not expose mutable package state and disposes precisely its registration', () => {
    const registry = new PackageRegistry(), value = fixture()
    const remove = registry.register(value)
    value.manifest.name='changed'
    expect(registry.list()[0].name).toBe('Example')
    expect(() => registry.register(fixture())).toThrow('duplicate')
    remove(); registry.register(fixture()); remove()
    expect(registry.list()).toHaveLength(1)
  })
  it('previews imports without installation and validates adapter results and cancellation', async () => {
    const importers = new ImporterRegistry()
    importers.register({id:'test',supportedExtensions:['.json'],import:async () => fixture()})
    const input = {fileName:'test.json',bytes:new ArrayBuffer(1)}
    expect((await importers.preview('test',input)).manifest.packageId).toBe('community.example')
    await expect(importers.preview('test',{...input,fileName:'test.exe'})).rejects.toThrow('input-invalid')
    const controller = new AbortController(); controller.abort()
    await expect(importers.preview('test',{...input,signal:controller.signal})).rejects.toThrow()
  })
})
