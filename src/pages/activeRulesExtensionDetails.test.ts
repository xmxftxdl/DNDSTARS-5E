import { describe, expect, it, vi } from 'vitest'
import { loadActiveExtensionDetails } from './activeRulesExtensionDetails'
import type { Dnd5eRulesPluginHost, InstalledDnd5eRulesPlugin } from '../rulesets/dnd5e/pluginLoader'

const manifest = { id: 'local.test-details', version: '1.0.0' }
const installed = {
  id: manifest.id, source: 'file', fileName: 'test.dndstars5e', integrity: 'sha256-one', enabled: true,
} satisfies InstalledDnd5eRulesPlugin
function detailsHost() {
  const readBytes = vi.fn(async () => new Uint8Array([1]).buffer)
  const inspectFile = vi.fn<Dnd5eRulesPluginHost['inspectFile']>().mockResolvedValue({
    manifest: { ...manifest, name: 'Test', apiVersion: 2, rulesetId: 'dnd5e-2014-srd-5.1', publisher: 'Test', license: 'CC0' },
    integrity: installed.integrity, bytes: new Uint8Array([1]).buffer, fileName: installed.fileName,
  })
  return { readBytes, inspectFile }
}

describe('active extension detail loading', () => {
  it('shares one read and inspection across concurrent effects, refreshes and remounts', async () => {
    const host = detailsHost()
    await Promise.all([
      loadActiveExtensionDetails(host, manifest, installed),
      loadActiveExtensionDetails(host, manifest, installed),
    ])
    await loadActiveExtensionDetails(host, manifest, installed)
    expect(host.readBytes).toHaveBeenCalledOnce()
    expect(host.inspectFile).toHaveBeenCalledOnce()
  })

  it('reloads after a pin, version or Host generation changes', async () => {
    const host = detailsHost()
    await loadActiveExtensionDetails(host, manifest, installed)
    await loadActiveExtensionDetails(host, manifest, { ...installed, integrity: 'sha256-two' })
    await loadActiveExtensionDetails(host, { ...manifest, version: '2.0.0' }, installed)
    const replacement = detailsHost()
    await loadActiveExtensionDetails(replacement, manifest, installed)
    expect(host.inspectFile).toHaveBeenCalledTimes(3)
    expect(replacement.inspectFile).toHaveBeenCalledOnce()
  })

  it('allows retrying a failed read', async () => {
    const host = detailsHost()
    host.readBytes.mockRejectedValueOnce(new Error('temporarily unavailable'))
    await expect(loadActiveExtensionDetails(host, manifest, installed)).rejects.toThrow('temporarily unavailable')
    await expect(loadActiveExtensionDetails(host, manifest, installed)).resolves.toEqual({ summary: undefined, coverage: undefined })
    expect(host.readBytes).toHaveBeenCalledTimes(2)
  })
})
