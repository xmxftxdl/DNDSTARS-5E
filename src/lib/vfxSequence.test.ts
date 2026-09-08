import { describe, expect, it, vi } from 'vitest'
import {
  activeVfxSequenceSections,
  compileMapProjectileVfxSequence,
  preloadVfxSequenceAssets,
  vfxAssetUrlForProjectileKind,
} from './vfxSequence'

describe('VFX sequence compiler', () => {
  it('compiles a projectile into a JSON-serializable deterministic plan', () => {
    const input = {
      id: 'spell:burning-hands:42',
      kind: 'burning-hands' as const,
      from: { x: 10, y: 20 },
      to: { x: 90, y: 20 },
      issuedAt: 1_000,
      durationMs: 1_150,
    }
    const first = compileMapProjectileVfxSequence(input)
    const second = compileMapProjectileVfxSequence(input)

    expect(first).toEqual(second)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expect(first.sections[0]).toMatchObject({
      type: 'effect',
      renderer: 'material-area',
      assetId: 'area.burning-hands.v3',
      waitUntilFinished: true,
    })
  })

  it('separates the entrance from a persistent-area handoff', () => {
    const sequence = compileMapProjectileVfxSequence({
      id: 'spell:stinking-cloud:1',
      kind: 'stinking-cloud',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 },
      issuedAt: 5_000,
      durationMs: 1_400,
      handoffAreaId: 'core-spell-area:tx-1',
    })

    expect(activeVfxSequenceSections(sequence, 5_700)).toHaveLength(1)
    expect(activeVfxSequenceSections(sequence, 6_400)).toEqual([
      expect.objectContaining({
        type: 'persistent-handoff',
        areaId: 'core-spell-area:tx-1',
      }),
    ])
  })

  it('preloads each referenced asset only once', async () => {
    const load = vi.fn(async () => undefined)
    const sequence = compileMapProjectileVfxSequence({
      id: 'spell:cloudkill:1',
      kind: 'cloudkill',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 },
      durationMs: 1_400,
    })
    await preloadVfxSequenceAssets(sequence, load)
    expect(load).toHaveBeenCalledOnce()
    expect(load).toHaveBeenCalledWith('/assets/vfx/sequence-toxic-cloud-sprite-v3.webp')
    expect(vfxAssetUrlForProjectileKind('web')).toBeUndefined()
  })

  it('routes the new persistent-area entrances through the material registry', () => {
    expect(vfxAssetUrlForProjectileKind('fog-cloud'))
      .toBe('/assets/vfx/sequence-fog-cloud-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('sleet-storm'))
      .toBe('/assets/vfx/sequence-sleet-storm-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('wind-wall'))
      .toBe('/assets/vfx/sequence-wind-wall-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('wall-of-force'))
      .toBe('/assets/vfx/sequence-wall-of-force-sprite-v1.webp')
    expect(compileMapProjectileVfxSequence({
      id: 'spell:silence:1',
      kind: 'silence',
      from: { x: 0, y: 0 },
      to: { x: 80, y: 80 },
    }).sections[0]).toMatchObject({ renderer: 'material-area', assetId: undefined })
  })

  it('routes Prismatic Spray through the rainbow cone atlas', () => {
    expect(vfxAssetUrlForProjectileKind('prismatic-spray'))
      .toBe('/assets/vfx/color-spray-sprite-v2.webp')
    expect(compileMapProjectileVfxSequence({
      id: 'spell:prismatic-spray:1',
      kind: 'prismatic-spray',
      from: { x: 20, y: 20 },
      to: { x: 620, y: 20 },
      areaWidthPx: 600,
      durationMs: 1_500,
    }).sections[0]).toMatchObject({
      renderer: 'material-area',
      assetId: 'area.color-spray.v2',
      durationMs: 1_500,
    })
  })

  it('routes every fire projectile through one combined launch-flight-impact atlas', () => {
    for (const kind of ['fireball', 'fire-bolt', 'produce-flame'] as const) {
      expect(vfxAssetUrlForProjectileKind(kind))
        .toBe('/assets/vfx/sequence-fire-projectile-impact-sprite-v1.webp')
      expect(compileMapProjectileVfxSequence({
        id: `spell:${kind}:1`,
        kind,
        from: { x: 10, y: 10 },
        to: { x: 80, y: 40 },
      }).sections[0]).toMatchObject({
        renderer: 'fire-projectile',
        assetId: 'projectile.fire-impact.v1',
      })
    }
  })

  it('uses sprite atlases for the migrated cantrip target effects', () => {
    const expected = {
      'shocking-grasp': '/assets/vfx/sequence-shocking-grasp-sprite-v1.webp',
      'spare-the-dying': '/assets/vfx/sequence-spare-the-dying-sprite-v1.webp',
      'vicious-mockery': '/assets/vfx/sequence-vicious-mockery-sprite-v1.webp',
      'chill-touch': '/assets/vfx/sequence-chill-touch-sprite-v1.webp',
    } as const
    for (const [kind, url] of Object.entries(expected)) {
      expect(vfxAssetUrlForProjectileKind(kind as keyof typeof expected)).toBe(url)
      expect(compileMapProjectileVfxSequence({
        id: `spell:${kind}:1`,
        kind: kind as keyof typeof expected,
        from: { x: 10, y: 10 },
        to: { x: 80, y: 40 },
      }).sections[0]).toMatchObject({ renderer: 'material-target' })
    }
  })

  it('uses compressed sprite atlases for healing and utility manifestations', () => {
    expect(vfxAssetUrlForProjectileKind('heal'))
      .toBe('/assets/vfx/sequence-healing-bloom-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('mass-heal'))
      .toBe('/assets/vfx/sequence-healing-bloom-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('dancing-lights'))
      .toBe('/assets/vfx/sequence-dancing-lights-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('minor-illusion'))
      .toBe('/assets/vfx/sequence-minor-illusion-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('thaumaturgy'))
      .toBe('/assets/vfx/sequence-thaumaturgy-sprite-v1.webp')
    expect(vfxAssetUrlForProjectileKind('shillelagh'))
      .toBe('/assets/vfx/sequence-shillelagh-sprite-v1.webp')
  })
})
