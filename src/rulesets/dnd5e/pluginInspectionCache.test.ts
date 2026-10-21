import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as contentPackages from './contentPackageV2'
import { exposeDnd5eRulesPluginHost } from './pluginLoader'

const example = readFileSync(new URL('../../../examples/original-content-v2.dndstars5e', import.meta.url), 'utf8')

function host() {
  vi.stubGlobal('window', {
    crypto: globalThis.crypto,
    btoa: globalThis.btoa,
    localStorage: { getItem: () => null },
  })
  return exposeDnd5eRulesPluginHost()
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('plugin inspection summary reuse', () => {
  it('reuses exact bytes across different filenames without sharing mutable summaries', async () => {
    const inspect = host().inspectFile
    const coverage = vi.spyOn(contentPackages, 'dnd5eContentPackageAutomationCoverageV2')
    const first = await inspect(new File([example], 'first.dndstars5e'))
    const name = first.manifest.name
    first.manifest.name = 'caller mutation'
    const second = await inspect(new File([example], 'second.dndstars5e'))
    expect(coverage).toHaveBeenCalledOnce()
    expect(second.fileName).toBe('second.dndstars5e')
    expect(second.manifest.name).toBe(name)
    expect(second.integrity).toBe(first.integrity)
    expect(new TextDecoder().decode(second.bytes)).toBe(example)
  })

  it('rechecks a changed payload even when its plugin ID and version stay the same', async () => {
    const inspect = host().inspectFile
    const source = JSON.parse(example)
    source.manifest.id = 'local.example.inspection-change'
    const coverage = vi.spyOn(contentPackages, 'dnd5eContentPackageAutomationCoverageV2')
    const first = await inspect(new File([JSON.stringify(source)], 'same.dndstars5e'))
    source.manifest.name = 'Changed package'
    const second = await inspect(new File([JSON.stringify(source)], 'same.dndstars5e'))
    expect(coverage).toHaveBeenCalledTimes(2)
    expect(second.manifest.name).toBe('Changed package')
    expect(second.integrity).not.toBe(first.integrity)
  })
})
