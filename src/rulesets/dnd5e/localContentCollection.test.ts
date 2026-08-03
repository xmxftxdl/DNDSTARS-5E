import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
  DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
  compileDnd5eLocalContentCollection,
  prepareDnd5eLocalContentJson,
} from './localContentCollection'
import { parseDnd5eContentPackageV2 } from './contentPackageV2'

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='
const LOCAL_PHB_COLLECTION_DIRECTORY = fileURLToPath(new URL(
  '../../../local-content/phb-2014/',
  import.meta.url,
))

function localCollectionFiles(directory: string, base = directory): File[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return localCollectionFiles(fullPath, base)
    const relativePath = path.relative(base, fullPath).replace(/\\/g, '/')
    return [new File([readFileSync(fullPath)], relativePath)]
  })
}

describe('本地房间内容合集', () => {
  it('keeps the public single-file JSON example importable', async () => {
    const prepared = await prepareDnd5eLocalContentJson(readFileSync(
      new URL('../../../examples/local-room-rules-single-file.json', import.meta.url),
      'utf8',
    ))
    expect(prepared.sourceKind).toBe('content-shorthand')
    expect(prepared.package.content.features).toEqual([
      expect.objectContaining({ id: 'example-room-feature', automation: 'manual' }),
    ])
  })

  it('accepts a fenced shorthand JSON document and creates a stable ephemeral package', async () => {
    const source = {
      name: 'Portable room rules',
      races: [{
        id: 'swiftfolk',
        name: 'Swiftfolk',
        speedFeet: 35,
        size: 'medium',
        skillProficiencies: [],
        languages: [],
        traits: [],
      }],
    }
    const first = await prepareDnd5eLocalContentJson(
      `\`\`\`json\n${JSON.stringify(source)}\n\`\`\``,
    )
    const second = await prepareDnd5eLocalContentJson(JSON.stringify(source))
    expect(first.sourceKind).toBe('content-shorthand')
    expect(first.package.manifest).toMatchObject({
      id: second.package.manifest.id,
      name: 'Portable room rules',
      distributionPolicy: 'room-ephemeral',
    })
    expect(first.package.content.races).toEqual([
      expect.objectContaining({ id: 'swiftfolk', speedFeet: 35 }),
    ])
  })

  it('accepts a self-contained collection with an embedded AI-generated image', async () => {
    const prepared = await prepareDnd5eLocalContentJson(JSON.stringify({
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.portable-json',
        name: 'Portable JSON',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local test',
        license: 'Private local use',
        contentCategory: 'mixed',
      },
      content: {
        races: [{
          id: 'emberkin', name: 'Emberkin', speedFeet: 30, size: 'medium',
          skillProficiencies: [], languages: [], traits: [],
        }],
      },
      images: [{
        id: 'emberkin-icon',
        mediaType: 'image/png',
        dataBase64: ONE_PIXEL_PNG,
        origin: 'ai-generated',
        prompt: 'private generation prompt',
        targets: [{ category: 'race', id: 'emberkin', slot: 'icon' }],
      }],
    }))
    expect(prepared.sourceKind).toBe('local-collection')
    expect(prepared.audit?.complete).toBe(true)
    expect(prepared.package.content.races[0]).toMatchObject({
      id: 'emberkin',
      iconAssetId: 'emberkin-icon',
    })
    expect(prepared.package.assets).toEqual([
      expect.objectContaining({ id: 'emberkin-icon', mediaType: 'image/png' }),
    ])
    expect(new TextDecoder().decode(prepared.bytes)).not.toContain('private generation prompt')
  })

  it('accepts a previously compiled room-ephemeral V2 JSON as a single file', async () => {
    const compiled = await prepareDnd5eLocalContentJson(JSON.stringify({
      name: 'Round trip rules',
      races: [{
        id: 'round-trip-race', name: 'Round Trip', speedFeet: 30, size: 'medium',
        skillProficiencies: [], languages: [], traits: [],
      }],
    }))
    const prepared = await prepareDnd5eLocalContentJson(
      new TextDecoder().decode(compiled.bytes),
      'round-trip.json',
    )
    expect(prepared.sourceKind).toBe('content-package-v2')
    expect(prepared.fileName).toBe('round-trip.json')
    expect(prepared.package.manifest.id).toBe(compiled.package.manifest.id)
  })

  it('merges multiple local JSON tables for the same content category', async () => {
    const collection = {
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.split-subclasses',
        name: 'Split Subclass Collection',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local test',
        license: 'Private local use',
        contentCategory: 'subclasses',
      },
      json: {
        subclasses: [
          'subclasses/vanguard.json',
          'subclasses/warden.json',
        ],
      },
      expected: {
        subclasses: {
          count: 2,
          ids: ['vanguard', 'warden'],
        },
      },
    }
    const subclass = (id: string, name: string) => [{
      schemaVersion: 1,
      id,
      classId: 'fighter',
      name,
      summary: 'Synthetic local test fixture.',
      abilities: [{
        schemaVersion: 1,
        id: 'local-note',
        name: 'Local note',
        description: 'Synthetic local test fixture.',
        level: 3,
        trigger: { kind: 'active-use' },
        targeting: { kind: 'self' },
        effects: [{
          kind: 'temporary-hit-points',
          target: 'actor',
          amount: { kind: 'fixed', value: 0 },
        }],
        automation: 'manual',
      }],
    }]
    const result = await compileDnd5eLocalContentCollection([
      new File([JSON.stringify(collection)], 'collection.json', { type: 'application/json' }),
      new File([JSON.stringify(subclass('vanguard', 'Vanguard'))], 'subclasses/vanguard.json', { type: 'application/json' }),
      new File([JSON.stringify(subclass('warden', 'Warden'))], 'subclasses/warden.json', { type: 'application/json' }),
    ])
    const parsed = parseDnd5eContentPackageV2(result.bytes)
    expect(result.audit.complete).toBe(true)
    expect(parsed?.manifest.id).toBe('local.example.split-subclasses')
    expect(parsed?.content.subclasses.map((entry) => entry.id)).toEqual(['vanguard', 'warden'])
  })

  it.runIf(existsSync(LOCAL_PHB_COLLECTION_DIRECTORY))(
    'compiles the ignored private PHB directory through its single root manifest',
    async () => {
      const result = await compileDnd5eLocalContentCollection(
        localCollectionFiles(LOCAL_PHB_COLLECTION_DIRECTORY),
      )
      const parsed = parseDnd5eContentPackageV2(result.bytes)
      expect(result.audit.complete).toBe(true)
      expect(parsed?.manifest).toMatchObject({
        id: 'local.doco.phb-2014-room',
        distributionPolicy: 'room-ephemeral',
      })
      expect(parsed?.content).toMatchObject({
        races: expect.arrayContaining([
          expect.objectContaining({ id: 'hill-dwarf', coreRaceMechanicsId: 'dwarf' }),
          expect.objectContaining({ id: 'stout-halfling', naturalOneReroll: true }),
          expect.objectContaining({
            id: 'drow',
            coreRaceMechanicsId: 'elf',
            innateSpells: expect.arrayContaining([
              expect.objectContaining({ spellId: 'faerie-fire', minimumLevel: 3 }),
            ]),
          }),
          expect.objectContaining({
            id: 'forest-gnome',
            coreRaceMechanicsId: 'gnome',
            innateSpells: expect.arrayContaining([
              expect.objectContaining({ spellId: 'minor-illusion', minimumLevel: 1 }),
            ]),
          }),
        ]),
        backgrounds: expect.arrayContaining([expect.objectContaining({ id: 'soldier' })]),
        subclasses: expect.arrayContaining([
          expect.objectContaining({ id: 'battle-master-2014' }),
          expect.objectContaining({ id: 'eldritch-knight-2014' }),
          expect.objectContaining({ id: 'totem-warrior-2014' }),
        ]),
      })
    },
  )

  it('在浏览器内合并 CSV 并将 AI 图片绑定到稳定条目 ID', async () => {
    const collection = {
      format: DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
      schemaVersion: DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
      manifest: {
        id: 'local.example.csv-room',
        name: 'CSV Room Collection',
        version: '1.0.0',
        apiVersion: 2,
        rulesetId: 'dnd5e-2014-srd-5.1',
        publisher: 'Local DM',
        license: 'Private local use',
        contentCategory: 'mixed',
      },
      json: { feats: 'feats.json' },
      csv: { features: 'features.csv' },
      expected: {
        features: { ids: ['steady'], count: 1, imageRequired: true },
        feats: { ids: ['watchful'], count: 1, imageRequired: true },
      },
      images: [{
        id: 'steady-icon',
        file: 'images/steady.png',
        origin: 'ai-generated',
        prompt: 'This local prompt must never be copied into the package.',
        targets: [{ category: 'feature', id: 'steady', slot: 'icon' }],
      }],
    }
    const result = await compileDnd5eLocalContentCollection([
      new File([JSON.stringify(collection)], 'collection.json', { type: 'application/json' }),
      new File([
        'id,name,summary,description,automation\n' +
        'steady,Steady,Local summary,Local rules text,manual\n',
      ], 'features.csv', { type: 'text/csv' }),
      new File([JSON.stringify([{
        id: 'watchful',
        name: 'Watchful',
        summary: 'Local summary.',
        description: 'Local rules text.',
        automation: 'manual',
      }])], 'feats.json', { type: 'application/json' }),
      new File([Buffer.from(ONE_PIXEL_PNG, 'base64')], 'images/steady.png', { type: 'image/png' }),
    ])
    const parsed = parseDnd5eContentPackageV2(result.bytes)
    expect(parsed?.manifest.distributionPolicy).toBe('room-ephemeral')
    expect(parsed?.content.features[0]).toMatchObject({
      id: 'steady',
      iconAssetId: 'steady-icon',
    })
    expect(parsed?.assets[0].dataBase64).toBe(ONE_PIXEL_PNG)
    expect(new TextDecoder().decode(result.bytes)).not.toContain('This local prompt')
    expect(result.audit).toMatchObject({
      complete: false,
      totals: {
        entries: 2,
        expectedEntries: 2,
        countShortfall: 0,
        missingIds: 0,
        missingImages: 1,
      },
      privacy: {
        includesSourceText: false,
        includesImageData: false,
        includesImagePrompts: false,
      },
    })
    expect(result.audit.categories.feats.missingImageIds).toEqual(['watchful'])
  })

  it('keeps the checked-in local collection template empty and requires content before import', async () => {
    const names = [
      'collection.json',
      'races.json',
      'subclasses.json',
      'spells.json',
      'items.json',
      'monsters.json',
      'features.csv',
      'feats.csv',
    ]
    const files = names.map((name) => new File([
      readFileSync(new URL(`../../../examples/phb-local-collection-template/${name}`, import.meta.url)),
    ], name))
    await expect(compileDnd5eLocalContentCollection(files))
      .rejects
      .toThrow('请至少添加一种规则内容。')
  })
})
