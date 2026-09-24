import { describe, expect, it } from 'vitest'
import { zipSync, unzipSync, strToU8 } from 'fflate'
import { readStarModArchive, writeStarModArchive, type StarModPackage } from './starmodArchive'
import { resolveCompendiumEntry } from './compendium'
import { packageFixture } from './packageTestFixture'

function fixture(): StarModPackage {
  const manifest = packageFixture()
  manifest.localizations = ['zh-CN']
  return { manifest, assets: {}, localizations: { 'zh-CN': { 'spell.sample.name': '示例法术' } }, entries: [{
    id: 'sample', type: 'Spell', systemId: 'dnd5e', sourcePackageId: manifest.packageId, sourceEntryId: 'sample',
    version: '1.0.0', localizationKey: 'spell.sample', tags: [], rulesData: { level: 1 }, assetReferences: [],
  }] }
}
describe('starmod archives and immutable overrides', () => {
  it('rejects truncated directories and keeps automation in a separate validated file', async () => {
    const input = fixture()
    input.entries = input.entries.map(e => ({...e,automationData:{activities:[{id:'test'}]}}))
    const bytes = await writeStarModArchive(input)
    const files = unzipSync(new Uint8Array(bytes))
    expect(Object.keys(files)).toContain('automation/spell-sample.json')
    expect((await readStarModArchive(bytes)).entries).toEqual(input.entries)
    await expect(readStarModArchive(bytes.slice(0,-10))).rejects.toThrow('directory-invalid')
  })
  it('round trips text and mechanical data separately', async () => {
    const input = fixture()
    const result = await readStarModArchive(await writeStarModArchive(input))
    expect(result.entries).toEqual(input.entries)
    expect(result.localizations).toEqual(input.localizations)
    expect(result.manifest.files?.['compendium/entries.json']).toMatch(/^[a-f0-9]{64}$/)
  })
  it('rejects content changed after hashing and omitted files', async () => {
    const files = unzipSync(new Uint8Array(await writeStarModArchive(fixture())))
    files['compendium/entries.json'] = strToU8('[]')
    await expect(readStarModArchive(new Uint8Array(zipSync(files)).buffer)).rejects.toThrow('integrity')
    delete files['compendium/entries.json']
    await expect(readStarModArchive(new Uint8Array(zipSync(files)).buffer)).rejects.toThrow('missing')
  })
  it.each(['../evil.json', '/evil.json', 'assets\\evil.png', 'C:/evil.json'])(
    'rejects escaping archive path %s', async path => {
      await expect(readStarModArchive(new Uint8Array(zipSync({ [path]: strToU8('{}') })).buffer)).rejects.toThrow()
    })
  it('rejects oversized inflated entries before allocating the whole package', async () => {
    const bytes = zipSync({ 'compendium/bomb.json': new Uint8Array(9 * 1024 * 1024) })
    await expect(readStarModArchive(new Uint8Array(bytes).buffer)).rejects.toThrow('too-large')
  })
  it('does not mutate package files when resolving user edits and flags update conflicts', () => {
    const base = fixture().entries[0]
    const result = resolveCompendiumEntry(base, { packageId: base.sourcePackageId, entryId: base.id,
      entryType: base.type, baseVersion: '0.9.0', value: { ...base, rulesData: { level: 2 } } })
    expect(result.conflict).toBe(true)
    expect(result.entry.rulesData).toEqual({ level: 2 })
    expect(base.rulesData).toEqual({ level: 1 })
  })
})
