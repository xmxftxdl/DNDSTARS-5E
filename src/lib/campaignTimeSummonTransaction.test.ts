import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { atomicMutateCampaignTimeAndMaps, mutateCampaignTimeState } from '../../scripts/shared-server-core.mjs'

describe('campaign clock and summon expiry transaction', () => {
  let stateRoot: string
  const host = { role: 'dm', memberId: 'host' }
  const maps = { maps: [{ id: 'map', tokens: [
    { id: 'linger', hp: 10, dnd5eSummon: { dismissAtWorldMinute: 489, lingerRolls: [2, 3, 4] } },
    { id: 'other', hp: 10 },
  ] }] }
  const read = async (name: string) => JSON.parse(await readFile(path.join(stateRoot, `${name}.json`), 'utf8'))
  const advance = (minutes: number, member = host) => atomicMutateCampaignTimeAndMaps(
    { stateRoot }, current => mutateCampaignTimeState(current, { operation: 'advance', minutes }, 10, member, { host }), host.memberId,
  )
  beforeEach(async () => {
    stateRoot = await mkdtemp(path.join(os.tmpdir(), 'stars-clock-summon-'))
    await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify(maps))
  })
  afterEach(async () => { await rm(stateRoot, { recursive: true, force: true }) })

  it('expires at the stored absolute deadline without a browser or new dice roll', async () => {
    expect(await advance(8)).toMatchObject({ ok: true, next: { worldMinute: 488 } })
    expect(await read('maps')).toEqual(maps)
    expect(await advance(1)).toMatchObject({ ok: true, next: { worldMinute: 489 }, mapsMutation: {
      previous: maps, next: { maps: [{ tokens: [{ id: 'other' }] }] },
    } })
    const savedMaps = await read('maps')
    expect(savedMaps.maps[0].tokens).toEqual([{ id: 'other', hp: 10 }])
    expect((await read('campaign-time')).worldMinute).toBe(489)
    const noChange = await atomicMutateCampaignTimeAndMaps({ stateRoot }, current => ({ ok: true, changed: false, next: current }), 'host')
    expect(noChange).toMatchObject({ ok: true, changed: false })
    expect(await read('maps')).toEqual(savedMaps)
    expect(await advance(1)).toMatchObject({ ok: true })
    expect(await read('maps')).toEqual(savedMaps)
  })

  it('serializes concurrent advances and removes the summon only once', async () => {
    const results = await Promise.all([advance(5), advance(5)])
    expect(results.every(result => result.ok)).toBe(true)
    expect((await read('campaign-time')).worldMinute).toBe(490)
    expect((await read('maps'))._sync.revision).toBe(1)
    expect((await read('maps')).maps[0].tokens).toEqual([{ id: 'other', hp: 10 }])
  })

  it('atomically saves carried possessions at expiry and cannot duplicate them on another advance', async () => {
    const withItems = { maps: [{ id: 'map', tokens: [
      { ...maps.maps[0].tokens[0], x: 125, y: 175, elevationFeet: 10,
        dnd5eCarriedObjects: [{ id: 'arrows', pickupReceipt: 'pickup-arrows', label: 'Three arrows',
          objectState: { schemaVersion: 1, wornOrCarried: true, inventoryItem: {
            templateId: 'srd-5.1:item:arrows', quantity: 3, receiptId: 'pickup-arrows' } } }] },
      maps.maps[0].tokens[1],
    ] }] }
    await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify(withItems))
    expect(await advance(8)).toMatchObject({ ok: true })
    expect(await read('maps')).toEqual(withItems)
    const result = await advance(1)
    expect(result).toMatchObject({ ok: true, next: { worldMinute: 489 } })
    const saved = await read('maps')
    expect(saved.maps[0].tokens).toEqual([
      { id: 'carried:arrows', type: 'obstacle', label: 'Three arrows', size: 1, x: 125, y: 175, elevationFeet: 10, color: '', emoji: '',
        dnd5eObjectState: { schemaVersion: 1, wornOrCarried: false, inventoryItem: {
          templateId: 'srd-5.1:item:arrows', quantity: 3, receiptId: 'carried:arrows' } } },
      maps.maps[0].tokens[1],
    ])
    expect((await read('campaign-time')).worldMinute).toBe(489)
    expect(await advance(1)).toMatchObject({ ok: true })
    expect(await read('maps')).toEqual(saved)
  })

  it('leaves both persisted resources unchanged on a possession collision, then permits retry', async () => {
    await advance(8)
    const clock = await read('campaign-time')
    const withConflict = { maps: [{ id: 'map', tokens: [
      { ...maps.maps[0].tokens[0], x: 25, y: 25, dnd5eCarriedObjects: [{ id: 'arrows', label: 'Arrows', pickupReceipt: 'arrows',
        objectState: { schemaVersion: 1, inventoryItem: { templateId: 'srd-5.1:item:arrows', quantity: 1, receiptId: 'arrows' } } }] },
      { ...maps.maps[0].tokens[1], id: 'carried:arrows' },
    ] }] }
    await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify(withConflict))
    await expect(advance(1)).rejects.toThrow('carried-object-drop-conflict')
    expect(await read('maps')).toEqual(withConflict)
    expect(await read('campaign-time')).toEqual(clock)
    await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify({ maps: [{ id: 'map', tokens: [withConflict.maps[0].tokens[0]] }] }))
    expect(await advance(1)).toMatchObject({ ok: true, next: { worldMinute: 489 } })
    expect((await read('maps')).maps[0].tokens).toHaveLength(1)
    expect((await read('maps')).maps[0].tokens[0].id).toBe('carried:arrows')
  })

  it('does not write either resource when authority or clock validation fails', async () => {
    expect(await advance(20, { role: 'player', memberId: 'player' })).toMatchObject({ ok: false, error: 'dm-authority-required' })
    expect(await atomicMutateCampaignTimeAndMaps({ stateRoot }, () => ({ ok: true, changed: true, next: { worldMinute: -1 } }), 'host'))
      .toMatchObject({ ok: false, error: 'invalid-campaign-time-result' })
    expect(await read('maps')).toEqual(maps)
    await expect(read('campaign-time')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects an invalid map result before committing the clock', async () => {
    const invalidMaps = { ...maps, updatedAt: -1 }
    await writeFile(path.join(stateRoot, 'maps.json'), JSON.stringify(invalidMaps))
    expect(await advance(10)).toMatchObject({ ok: false, error: 'invalid-campaign-time-map-result' })
    expect(await read('maps')).toEqual(invalidMaps)
    await expect(read('campaign-time')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
