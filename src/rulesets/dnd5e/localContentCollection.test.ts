import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  DND5E_LOCAL_CONTENT_COLLECTION_FORMAT,
  DND5E_LOCAL_CONTENT_COLLECTION_SCHEMA_VERSION,
  compileDnd5eLocalContentCollection,
} from './localContentCollection'
import { parseDnd5eContentPackageV2 } from './contentPackageV2'

const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

describe('本地房间内容合集', () => {
  it('compiles the checked-in rights-safe Battle Master collection', async () => {
    const collection = readFileSync(new URL(
      '../../../examples/battle-master-local-collection/collection.json',
      import.meta.url,
    ))
    const subclasses = readFileSync(new URL(
      '../../../examples/battle-master-local-collection/subclasses.json',
      import.meta.url,
    ))
    const result = await compileDnd5eLocalContentCollection([
      new File([collection], 'collection.json', { type: 'application/json' }),
      new File([subclasses], 'subclasses.json', { type: 'application/json' }),
    ])
    const parsed = parseDnd5eContentPackageV2(result.bytes)
    expect(result.audit.complete).toBe(true)
    expect(parsed?.manifest.id).toBe('local.doco.battle-master-2014')
    expect(parsed?.content.subclasses[0]).toMatchObject({
      id: 'battle-master-2014',
      classId: 'fighter',
      resources: [{
        id: 'superiority-dice',
        maximumByClassLevel: [
          { level: 7, maximum: 5 },
          { level: 15, maximum: 6 },
        ],
      }],
    })
    expect(parsed?.content.subclasses[0].choiceGroups?.[0].options).toHaveLength(16)
  })

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
