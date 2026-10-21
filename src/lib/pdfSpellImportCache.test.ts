import { describe, expect, it } from 'vitest'
import { PdfSpellImportCache, pdfSpellCacheIdentity, type PdfSpellBatch, type PdfSpellCacheStore } from './pdfSpellImportCache'

function store() {
  const records = new Map<string, unknown>()
  const adapter: PdfSpellCacheStore = {
    get: async (key) => structuredClone(records.get(key)),
    put: async (key, value) => { records.set(key, structuredClone(value)) },
    remove: async (key) => { records.delete(key) },
  }
  return { records, cache: new PdfSpellImportCache(adapter) }
}

async function batch(): Promise<PdfSpellBatch> {
  return {
    schemaVersion: 1, identity: await pdfSpellCacheIdentity(new Blob(['same PDF bytes'])),
    windows: [{ window: { id: 'window', documentName: 'source.pdf', startPage: 1, ownedEndPage: 1, pages: [{ page: 1, text: 'spell text.' }] }, done: true }],
    spells: [{ source: { id: 'spell', name: 'spell', documentName: 'source.pdf', startPage: 1, endPage: 1, text: 'spell text.' }, draft: { schemaVersion: 1, contentJson: '{}', assumptions: [], unsupported: [] } }],
  }
}

describe('PDF content-addressed cache', () => {
  it.each([false, true])('rechecks original boundaries and invalidates changed drafts on restore (source-only=%s)', async sourceOnly => {
    const { cache } = store(), value = await batch()
    const prefix = '星光学院 STARS\n星光学院特性\n诗人等级 特性\n3rd 星光馈赠\n6th 月光馈赠'
    const body = '星光馈赠 STAR GIFT\n获得能力。\n月光馈赠 MOON GIFT\n获得进阶能力。'
    const next = '日光学院 SUN\n日光学院特性\n诗人等级 特性\n3rd 日光馈赠\n日光馈赠 SUN GIFT\n另一能力。'
    value.windows.push({ window: { id: 'second', documentName: 'source.pdf', startPage: 2, ownedEndPage: 2,
      pages: [{ page: 2, text: prefix }, { page: 3, text: body + '\n' + next }] }, done: true })
    value.spells.push({ source: { id: 'stable-subclass-id', kind: 'subclass', name: '星光学院', documentName: 'source.pdf', startPage: 2, endPage: 2, text: prefix },
      draft: value.spells[0].draft, rejectedDraft: value.spells[0].draft })
    const current = value.identity!
    if (sourceOnly) value.identity = { ...current, recipeSha256: 'old-authoring' }
    const original = structuredClone(value)
    await cache.save('boundaries', value)
    const restored = await cache.load(current)
    expect(restored?.spells[1].source).toMatchObject({ id: 'stable-subclass-id', endPage: 3, text: prefix + '\n' + body })
    expect(restored?.spells[1].draft).toBeUndefined()
    expect(restored?.spells[1].rejectedDraft).toBeUndefined()
    expect(restored?.spells[1].error).toContain('原文边界已修正')
    expect(restored?.revisedSourceIds).toEqual(['stable-subclass-id'])
    expect(restored?.spells[0].draft).toEqual(sourceOnly ? undefined : value.spells[0].draft)
    expect(value).toEqual(original)
    expect(await cache.restore('boundaries')).toEqual(restored)
    await cache.save('boundaries', restored!)
    const again = await cache.restore('boundaries')
    expect(again?.spells).toEqual(restored?.spells)
    expect(again?.revisedSourceIds).toBeUndefined()
  })
  it.each(['forged', 'unowned', 'duplicate', 'unfinished', 'omitted'])('refuses stale completion without valid original inventory: %s', async fault => {
    const { cache } = store(), value = await batch()
    if (fault === 'forged') value.spells[0].source.text += ' invented rules'
    if (fault === 'unowned') value.spells[0].source.documentName = 'another.pdf'
    if (fault === 'duplicate') value.spells.push(structuredClone(value.spells[0]))
    if (fault === 'unfinished') value.windows[0].done = false
    if (fault === 'omitted') {
      value.windows[0].window.pages[0].text = '星光学院 STARS\n星光学院特性\n诗人等级 特性\n3rd 星光馈赠\n星光馈赠 STAR GIFT\n获得能力。'
      value.spells = []
    }
    await cache.save('bad-boundaries', value)
    expect(await cache.load(value.identity!)).toBeNull()
    expect(await cache.restore('bad-boundaries')).toBeNull()
  })
  it('retains rejected data for repair without promoting it to a successful draft', async () => {
    const { cache } = store(), value = await batch()
    value.spells[0].rejectedDraft = value.spells[0].draft
    delete value.spells[0].draft
    await cache.save('repair', value)
    const restored = await cache.restore('repair')
    expect(restored?.spells[0].rejectedDraft).toEqual(value.spells[0].rejectedDraft)
    expect(restored?.spells[0].draft).toBeUndefined()
  })
  it('reuses only source evidence after an authoring upgrade, with no old draft or error claims', async () => {
    const { cache } = store()
    const value = await batch()
    const current = value.identity!
    value.identity = { ...current, recipeSha256: 'previous-authoring-sdk' }
    value.spells[0].error = 'previous conversion error'
    value.spells[0].coverage = 'old claimed success'
    value.spells[0].rejectedDraft = value.spells[0].draft
    await cache.save('upgrade', value)
    const restored = await cache.load(current)
    expect(restored?.restoredSourceOnly).toBe(true)
    expect(restored?.windows[0].done).toBe(true)
    expect(restored?.spells).toEqual([{ source: value.spells[0].source }])
    expect(restored?.identity).toEqual(current)
    expect(await cache.restore('upgrade')).toEqual(restored)
  })
  it('does not reuse a source cache from a different extraction revision', async () => {
    const { cache } = store()
    const value = await batch()
    const current = value.identity!
    value.identity = { ...current, recipeSha256: 'old-authoring', sourceRecipeSha256: 'old-extractor' }
    await cache.save('old', value)
    expect(await cache.load(current)).toBeNull()
    expect(await cache.restore('old')).toBeNull()
  })
  it('separates explicitly excluded page scopes and preserves them on restore', async () => {
    const { cache } = store()
    const value = await batch()
    value.excludedPages = [2, 3]
    value.identity = await pdfSpellCacheIdentity(new Blob(['same PDF bytes']), [3, 2, 2])
    await cache.save('scoped', value)
    expect((await cache.restore('scoped'))?.excludedPages).toEqual([2, 3])
    expect(await cache.load(await pdfSpellCacheIdentity(new Blob(['same PDF bytes'])))).toBeNull()
  })
  it('reuses identical bytes across file names and rooms, including partial progress', async () => {
    const { cache } = store()
    const value = await batch()
    await cache.save('room-a', value)
    const renamed = await pdfSpellCacheIdentity(new File(['same PDF bytes'], 'renamed.pdf'))
    expect(renamed).toEqual(value.identity)
    const hit = await cache.load(renamed)
    expect(hit?.windows[0].done).toBe(true)
    expect(hit?.spells[0].draft).toEqual(value.spells[0].draft)
    await cache.save('room-b', hit!)
    expect((await cache.restore('room-b'))?.identity).toEqual(value.identity)
  })
  it('misses for changed bytes or a changed conversion recipe', async () => {
    const { cache } = store()
    const value = await batch()
    await cache.save('room', value)
    expect(await cache.load(await pdfSpellCacheIdentity(new Blob(['other PDF bytes'])))).toBeNull()
    expect(await cache.load({ ...value.identity!, recipeSha256: 'obsolete' })).toBeNull()
  })
  it('detects corrupted records and does not persist previous certification or coverage claims', async () => {
    const { cache, records } = store()
    const value = await batch()
    Object.assign(value.spells[0], { certified: true, coverage: '全部通过', validation: { passed: true } })
    await cache.save('room', value)
    const hit = await cache.load(value.identity!)
    expect(hit?.spells[0]).not.toHaveProperty('certified')
    expect(hit?.spells[0]).not.toHaveProperty('validation')
    expect(hit?.spells[0]).not.toHaveProperty('coverage')
    const key = [...records.keys()].find((key) => key.startsWith('pdf:'))!
    const record = records.get(key) as { json: string }
    record.json = record.json.replace('spell text.', 'changed text')
    expect(await cache.load(value.identity!)).toBeNull()
    expect(await cache.restore('room')).toBeNull()
  })
  it('removes the current PDF cache and checkpoint without deleting another PDF', async () => {
    const { cache } = store()
    const first = await batch()
    const second = { ...await batch(), identity: await pdfSpellCacheIdentity(new Blob(['second PDF'])) }
    await cache.save('a', first); await cache.save('b', second)
    await cache.clear('a', first.identity)
    expect(await cache.load(first.identity!)).toBeNull()
    expect(await cache.restore('a')).toBeNull()
    expect(await cache.load(second.identity!)).not.toBeNull()
  })
})


