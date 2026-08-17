import type { MapProjectile } from '../components/map/mapCanvasContracts'

export type VfxRendererKey =
  | 'projectile-arrow'
  | 'fire-projectile'
  | 'ray-of-frost'
  | 'eldritch-blast'
  | 'guidance'
  | 'resistance'
  | 'sanctuary'
  | 'new-spell'
  | 'status-spell'
  | 'sacred-flame'
  | 'acid-splash'
  | 'poison-spray'
  | 'magic-missile'
  | 'material-projectile'
  | 'material-target'
  | 'material-area'

export interface VfxAssetDefinition {
  id: string
  url: string
  format: 'image' | 'sprite-sheet'
  columns?: number
  rows?: number
  frameCount?: number
}

export interface VfxEffectSection {
  type: 'effect'
  id: string
  startMs: number
  durationMs: number
  renderer: VfxRendererKey
  assetId?: string
  waitUntilFinished: boolean
}

export interface VfxPersistentHandoffSection {
  type: 'persistent-handoff'
  id: string
  startMs: number
  areaId: string
}

export type VfxSequenceSection = VfxEffectSection | VfxPersistentHandoffSection

/**
 * Serializable visual plan. It deliberately contains no React components,
 * Konva nodes, callbacks, or rule settlement data, so the same plan can be
 * logged, replayed, and reconstructed by every client.
 */
export interface VfxSequenceDefinition {
  version: 1
  id: string
  seed: number
  issuedAt: number
  durationMs: number
  sections: VfxSequenceSection[]
}

interface VfxSpellDefinition {
  renderer: VfxRendererKey
  assetId?: string
}

const spriteAsset = (id: string, sourceUrl: string): VfxAssetDefinition => ({
  id,
  // Runtime playback always uses the optimized transparent WebP sibling.
  // Source PNGs stay in the art pack for lossless iteration and regeneration.
  url: sourceUrl.endsWith('.png') ? `${sourceUrl.slice(0, -4)}.webp` : sourceUrl,
  format: 'sprite-sheet',
  columns: 4,
  rows: 4,
  frameCount: 16,
})

const imageAsset = (id: string, url: string): VfxAssetDefinition => ({
  id,
  url,
  format: 'image',
})

export const VFX_ASSET_REGISTRY: Readonly<Record<string, VfxAssetDefinition>> = Object.freeze({
  'target.shocking-grasp.v1': spriteAsset('target.shocking-grasp.v1', '/assets/vfx/sequence-shocking-grasp-sprite-v1.png'),
  'target.spare-the-dying.v1': spriteAsset('target.spare-the-dying.v1', '/assets/vfx/sequence-spare-the-dying-sprite-v1.png'),
  'target.vicious-mockery.v1': spriteAsset('target.vicious-mockery.v1', '/assets/vfx/sequence-vicious-mockery-sprite-v1.png'),
  'target.chill-touch.v1': spriteAsset('target.chill-touch.v1', '/assets/vfx/sequence-chill-touch-sprite-v1.png'),
  'target.sacred-flame.v2': spriteAsset('target.sacred-flame.v2', '/assets/vfx/sacred-flame-sprite-v2.png'),
  'area.acid-splash.v2': spriteAsset('area.acid-splash.v2', '/assets/vfx/acid-splash-sprite-v2.png'),
  'projectile.poison-spray.v2': spriteAsset('projectile.poison-spray.v2', '/assets/vfx/poison-spray-sprite-v2.png'),
  'projectile.ray-of-frost.v2': spriteAsset('projectile.ray-of-frost.v2', '/assets/vfx/ray-of-frost-sprite-v2.png'),
  'projectile.eldritch-blast.v2': spriteAsset('projectile.eldritch-blast.v2', '/assets/vfx/eldritch-blast-sprite-v2.png'),
  'projectile.magic-missile.v1': imageAsset('projectile.magic-missile.v1', '/assets/vfx/magic-missile-fluid.png'),
  'projectile.fire-impact.v1': spriteAsset('projectile.fire-impact.v1', '/assets/vfx/sequence-fire-projectile-impact-sprite-v1.png'),
  'target.healing-bloom.v1': spriteAsset('target.healing-bloom.v1', '/assets/vfx/sequence-healing-bloom-sprite-v1.webp'),
  'target.dancing-lights.v1': spriteAsset('target.dancing-lights.v1', '/assets/vfx/sequence-dancing-lights-sprite-v1.webp'),
  'target.minor-illusion.v1': spriteAsset('target.minor-illusion.v1', '/assets/vfx/sequence-minor-illusion-sprite-v1.webp'),
  'target.thaumaturgy.v1': spriteAsset('target.thaumaturgy.v1', '/assets/vfx/sequence-thaumaturgy-sprite-v1.webp'),
  'target.shillelagh.v1': spriteAsset('target.shillelagh.v1', '/assets/vfx/sequence-shillelagh-sprite-v1.webp'),
  'projectile.scorching-ray.v2': spriteAsset('projectile.scorching-ray.v2', '/assets/vfx/scorching-ray-sprite-v2.png'),
  'projectile.guiding-bolt.v2': spriteAsset('projectile.guiding-bolt.v2', '/assets/vfx/guiding-bolt-sprite-v2.png'),
  'projectile.acid-arrow.v2': spriteAsset('projectile.acid-arrow.v2', '/assets/vfx/acid-arrow-sprite-v2.png'),
  'projectile.chain-lightning.v2': spriteAsset('projectile.chain-lightning.v2', '/assets/vfx/chain-lightning-sprite-v2.png'),
  'projectile.disintegrate.v2': spriteAsset('projectile.disintegrate.v2', '/assets/vfx/disintegrate-sprite-v2.png'),
  'projectile.healing-word.v2': spriteAsset('projectile.healing-word.v2', '/assets/vfx/healing-word-sprite-v2.png'),
  'projectile.inflict-wounds.v2': spriteAsset('projectile.inflict-wounds.v2', '/assets/vfx/inflict-wounds-sprite-v2.png'),
  'target.cure-wounds.v2': spriteAsset('target.cure-wounds.v2', '/assets/vfx/cure-wounds-sprite-v2.png'),
  'target.hellish-rebuke.v2': spriteAsset('target.hellish-rebuke.v2', '/assets/vfx/hellish-rebuke-sprite-v2.png'),
  'target.blight.v2': spriteAsset('target.blight.v2', '/assets/vfx/blight-sprite-v2.png'),
  'target.finger-of-death.v2': spriteAsset('target.finger-of-death.v2', '/assets/vfx/finger-of-death-sprite-v2.png'),
  'target.power-word-stun.v2': spriteAsset('target.power-word-stun.v2', '/assets/vfx/power-word-stun-sprite-v2.png'),
  'target.power-word-kill.v2': spriteAsset('target.power-word-kill.v2', '/assets/vfx/power-word-kill-sprite-v2.png'),
  'target.false-life.v2': spriteAsset('target.false-life.v2', '/assets/vfx/false-life-sprite-v2.png'),
  'target.hypnotic-pattern.v2': spriteAsset('target.hypnotic-pattern.v2', '/assets/vfx/hypnotic-pattern-sprite-v2.png'),
  'target.slow.v2': spriteAsset('target.slow.v2', '/assets/vfx/slow-sprite-v2.png'),
  'target.phantasmal-killer.v2': spriteAsset('target.phantasmal-killer.v2', '/assets/vfx/phantasmal-killer-sprite-v2.png'),
  'target.banishment.v2': spriteAsset('target.banishment.v2', '/assets/vfx/banishment-sprite-v2.png'),
  'target.misty-step.v2': spriteAsset('target.misty-step.v2', '/assets/vfx/misty-step-sprite-v2.png'),
  'target.hold-monster.v2': spriteAsset('target.hold-monster.v2', '/assets/vfx/hold-monster-sprite-v2.png'),
  'target.counterspell.v2': spriteAsset('target.counterspell.v2', '/assets/vfx/counterspell-sprite-v2.png'),
  'target.dispel-magic.v2': spriteAsset('target.dispel-magic.v2', '/assets/vfx/dispel-magic-sprite-v2.png'),
  'target.shield.v2': spriteAsset('target.shield.v2', '/assets/vfx/shield-sprite-v2.png'),
  'target.lesser-restoration.v2': spriteAsset('target.lesser-restoration.v2', '/assets/vfx/lesser-restoration-sprite-v2.png'),
  'area.burning-hands.v3': spriteAsset('area.burning-hands.v3', '/assets/vfx/sequence-flame-cone-sprite-v3.png'),
  'area.toxic-cloud.v3': spriteAsset('area.toxic-cloud.v3', '/assets/vfx/sequence-toxic-cloud-sprite-v3.png'),
  'area.fog-cloud.v1': spriteAsset('area.fog-cloud.v1', '/assets/vfx/sequence-fog-cloud-sprite-v1.png'),
  'area.sleet-storm.v1': spriteAsset('area.sleet-storm.v1', '/assets/vfx/sequence-sleet-storm-sprite-v1.png'),
  'area.wind-wall.v1': spriteAsset('area.wind-wall.v1', '/assets/vfx/sequence-wind-wall-sprite-v1.png'),
  'area.wall-of-force.v1': spriteAsset('area.wall-of-force.v1', '/assets/vfx/sequence-wall-of-force-sprite-v1.png'),
  'area.wall-of-stone.v1': spriteAsset('area.wall-of-stone.v1', '/assets/vfx/sequence-wall-of-stone-sprite-v1.png'),
  'area.wall-of-ice.v1': spriteAsset('area.wall-of-ice.v1', '/assets/vfx/sequence-wall-of-ice-sprite-v1.png'),
  'area.wall-of-thorns.v1': spriteAsset('area.wall-of-thorns.v1', '/assets/vfx/sequence-wall-of-thorns-sprite-v1.png'),
  'area.shatter.v2': spriteAsset('area.shatter.v2', '/assets/vfx/shatter-sprite-v2.png'),
  'area.flame-strike.v2': spriteAsset('area.flame-strike.v2', '/assets/vfx/flame-strike-sprite-v2.png'),
  'area.sunburst.v2': spriteAsset('area.sunburst.v2', '/assets/vfx/sunburst-sprite-v2.png'),
  'area.cone-of-cold.v2': spriteAsset('area.cone-of-cold.v2', '/assets/vfx/cone-of-cold-sprite-v2.png'),
  'area.circle-of-death.v2': spriteAsset('area.circle-of-death.v2', '/assets/vfx/circle-of-death-sprite-v2.png'),
  'area.ice-storm.v2': spriteAsset('area.ice-storm.v2', '/assets/vfx/ice-storm-sprite-v2.png'),
  'area.freezing-sphere.v2': spriteAsset('area.freezing-sphere.v2', '/assets/vfx/freezing-sphere-sprite-v2.png'),
  'area.color-spray.v2': spriteAsset('area.color-spray.v2', '/assets/vfx/color-spray-sprite-v2.png'),
  'area.faerie-fire.v2': spriteAsset('area.faerie-fire.v2', '/assets/vfx/faerie-fire-sprite-v2.png'),
  'area.sleep.v2': spriteAsset('area.sleep.v2', '/assets/vfx/sleep-sprite-v2.png'),
  'area.entangle.v2': spriteAsset('area.entangle.v2', '/assets/vfx/entangle-sprite-v2.png'),
  'area.grease.v2': spriteAsset('area.grease.v2', '/assets/vfx/grease-sprite-v2.png'),
  'area.darkness.v2': spriteAsset('area.darkness.v2', '/assets/vfx/darkness-sprite-v2.png'),
  'area.flaming-sphere.v2': spriteAsset('area.flaming-sphere.v2', '/assets/vfx/flaming-sphere-sprite-v2.png'),
  'area.moonbeam.v2': spriteAsset('area.moonbeam.v2', '/assets/vfx/moonbeam-sprite-v2.png'),
  'area.daylight.v2': spriteAsset('area.daylight.v2', '/assets/vfx/daylight-sprite-v2.png'),
  'area.black-tentacles.v2': spriteAsset('area.black-tentacles.v2', '/assets/vfx/black-tentacles-sprite-v2.png'),
  'area.spike-growth.v2': spriteAsset('area.spike-growth.v2', '/assets/vfx/spike-growth-sprite-v2.png'),
  'area.mage-hand.v2': spriteAsset('area.mage-hand.v2', '/assets/vfx/mage-hand-sprite-v2.png'),
  'area.spiritual-weapon.v2': spriteAsset('area.spiritual-weapon.v2', '/assets/vfx/spiritual-weapon-sprite-v2.png'),
  'area.spirit-guardians.v2': spriteAsset('area.spirit-guardians.v2', '/assets/vfx/spirit-guardians-sprite-v2.png'),
  'area.call-lightning.v2': spriteAsset('area.call-lightning.v2', '/assets/vfx/call-lightning-sprite-v2.png'),
  'area.call-lightning-strike.v2': spriteAsset('area.call-lightning-strike.v2', '/assets/vfx/call-lightning-strike-sprite-v2.png'),
  'area.insect-plague.v2': spriteAsset('area.insect-plague.v2', '/assets/vfx/insect-plague-sprite-v2.png'),
  'area.wall-of-fire.v2': spriteAsset('area.wall-of-fire.v2', '/assets/vfx/wall-of-fire-sprite-v2.png'),
  'area.blade-barrier.v2': spriteAsset('area.blade-barrier.v2', '/assets/vfx/blade-barrier-sprite-v2.png'),
  'area.lightning-bolt.v2': spriteAsset('area.lightning-bolt.v2', '/assets/vfx/lightning-bolt-sprite-v2.png'),
  'area.thunderwave.v2': {
    id: 'area.thunderwave.v2',
    url: '/assets/vfx/thunderwave-fluid.webp',
    format: 'image',
  },
})

const spellDefinitions = new Map<string, VfxSpellDefinition>()
const register = (
  renderer: VfxRendererKey,
  kinds: readonly string[],
  assets: Readonly<Record<string, string>> = {},
) => {
  kinds.forEach((kind) => spellDefinitions.set(kind, {
    renderer,
    assetId: assets[kind],
  }))
}

register('fire-projectile', ['fireball', 'fire-bolt', 'produce-flame'], {
  fireball: 'projectile.fire-impact.v1',
  'fire-bolt': 'projectile.fire-impact.v1',
  'produce-flame': 'projectile.fire-impact.v1',
})
register('ray-of-frost', ['ray-of-frost'], {
  'ray-of-frost': 'projectile.ray-of-frost.v2',
})
register('eldritch-blast', ['eldritch-blast'], {
  'eldritch-blast': 'projectile.eldritch-blast.v2',
})
register('guidance', ['guidance'])
register('resistance', ['resistance'])
register('sanctuary', ['sanctuary'])
register('new-spell', [
  'heal', 'mass-cure-wounds', 'mass-heal', 'mass-healing-word',
  'prayer-of-healing', 'dancing-lights', 'minor-illusion', 'thaumaturgy', 'shillelagh',
], {
  heal: 'target.healing-bloom.v1',
  'mass-cure-wounds': 'target.healing-bloom.v1',
  'mass-heal': 'target.healing-bloom.v1',
  'mass-healing-word': 'target.healing-bloom.v1',
  'prayer-of-healing': 'target.healing-bloom.v1',
  'dancing-lights': 'target.dancing-lights.v1',
  'minor-illusion': 'target.minor-illusion.v1',
  thaumaturgy: 'target.thaumaturgy.v1',
  shillelagh: 'target.shillelagh.v1',
})
register('status-spell', [
  'bless', 'bane', 'shield-of-faith', 'mage-armor', 'jump', 'darkvision',
  'see-invisibility', 'warding-bond', 'fly', 'heroism', 'enlarge-reduce',
  'enhance-ability', 'divine-favor', 'hunters-mark', 'magic-weapon', 'flame-blade',
  'invisibility', 'blur', 'barkskin', 'protection-from-poison', 'longstrider',
  'protection-from-energy', 'death-ward', 'greater-invisibility', 'charm-person',
  'hideous-laughter', 'hold-person', 'blindness-deafness',
])
register('sacred-flame', ['sacred-flame'], {
  'sacred-flame': 'target.sacred-flame.v2',
})
register('acid-splash', ['acid-splash'], {
  'acid-splash': 'area.acid-splash.v2',
})
register('poison-spray', ['poison-spray'], {
  'poison-spray': 'projectile.poison-spray.v2',
})
register('magic-missile', ['magic-missile'], {
  'magic-missile': 'projectile.magic-missile.v1',
})
register('material-projectile', [
  'scorching-ray', 'guiding-bolt', 'acid-arrow', 'chain-lightning',
  'disintegrate', 'healing-word', 'inflict-wounds',
], {
  'scorching-ray': 'projectile.scorching-ray.v2',
  'guiding-bolt': 'projectile.guiding-bolt.v2',
  'acid-arrow': 'projectile.acid-arrow.v2',
  'chain-lightning': 'projectile.chain-lightning.v2',
  disintegrate: 'projectile.disintegrate.v2',
  'healing-word': 'projectile.healing-word.v2',
  'inflict-wounds': 'projectile.inflict-wounds.v2',
})
register('material-target', [
  'cure-wounds', 'hellish-rebuke', 'blight', 'finger-of-death',
  'power-word-stun', 'power-word-kill', 'false-life', 'hypnotic-pattern', 'slow',
  'phantasmal-killer', 'banishment', 'misty-step', 'hold-monster', 'counterspell',
  'dispel-magic', 'shield', 'lesser-restoration', 'shocking-grasp',
  'spare-the-dying', 'vicious-mockery', 'chill-touch',
], {
  'cure-wounds': 'target.cure-wounds.v2',
  'hellish-rebuke': 'target.hellish-rebuke.v2',
  blight: 'target.blight.v2',
  'finger-of-death': 'target.finger-of-death.v2',
  'power-word-stun': 'target.power-word-stun.v2',
  'power-word-kill': 'target.power-word-kill.v2',
  'false-life': 'target.false-life.v2',
  'hypnotic-pattern': 'target.hypnotic-pattern.v2',
  slow: 'target.slow.v2',
  'phantasmal-killer': 'target.phantasmal-killer.v2',
  banishment: 'target.banishment.v2',
  'misty-step': 'target.misty-step.v2',
  'hold-monster': 'target.hold-monster.v2',
  counterspell: 'target.counterspell.v2',
  'dispel-magic': 'target.dispel-magic.v2',
  shield: 'target.shield.v2',
  'lesser-restoration': 'target.lesser-restoration.v2',
  'shocking-grasp': 'target.shocking-grasp.v1',
  'spare-the-dying': 'target.spare-the-dying.v1',
  'vicious-mockery': 'target.vicious-mockery.v1',
  'chill-touch': 'target.chill-touch.v1',
})
register('material-area', [
  'burning-hands', 'thunderwave', 'shatter', 'lightning-bolt', 'flame-strike',
  'sunburst', 'cone-of-cold', 'circle-of-death', 'ice-storm', 'freezing-sphere',
  'meteor-swarm', 'color-spray', 'faerie-fire', 'sleep', 'entangle', 'web',
  'grease', 'darkness', 'flaming-sphere', 'moonbeam', 'daylight', 'black-tentacles',
  'spike-growth', 'mage-hand', 'spiritual-weapon', 'spirit-guardians',
  'call-lightning', 'call-lightning-strike', 'insect-plague', 'stinking-cloud',
  'cloudkill', 'wall-of-fire', 'blade-barrier',
  'fog-cloud', 'silence', 'sleet-storm', 'wind-wall',
  'wall-of-force', 'wall-of-stone', 'wall-of-ice', 'wall-of-thorns',
], {
  'burning-hands': 'area.burning-hands.v3',
  thunderwave: 'area.thunderwave.v2',
  shatter: 'area.shatter.v2',
  'lightning-bolt': 'area.lightning-bolt.v2',
  'flame-strike': 'area.flame-strike.v2',
  sunburst: 'area.sunburst.v2',
  'cone-of-cold': 'area.cone-of-cold.v2',
  'circle-of-death': 'area.circle-of-death.v2',
  'ice-storm': 'area.ice-storm.v2',
  'freezing-sphere': 'area.freezing-sphere.v2',
  'meteor-swarm': 'area.flame-strike.v2',
  'color-spray': 'area.color-spray.v2',
  'faerie-fire': 'area.faerie-fire.v2',
  sleep: 'area.sleep.v2',
  entangle: 'area.entangle.v2',
  grease: 'area.grease.v2',
  darkness: 'area.darkness.v2',
  'flaming-sphere': 'area.flaming-sphere.v2',
  moonbeam: 'area.moonbeam.v2',
  daylight: 'area.daylight.v2',
  'black-tentacles': 'area.black-tentacles.v2',
  'spike-growth': 'area.spike-growth.v2',
  'mage-hand': 'area.mage-hand.v2',
  'spiritual-weapon': 'area.spiritual-weapon.v2',
  'spirit-guardians': 'area.spirit-guardians.v2',
  'call-lightning': 'area.call-lightning.v2',
  'call-lightning-strike': 'area.call-lightning-strike.v2',
  'insect-plague': 'area.insect-plague.v2',
  'stinking-cloud': 'area.toxic-cloud.v3',
  cloudkill: 'area.toxic-cloud.v3',
  'fog-cloud': 'area.fog-cloud.v1',
  'sleet-storm': 'area.sleet-storm.v1',
  'wind-wall': 'area.wind-wall.v1',
  'wall-of-force': 'area.wall-of-force.v1',
  'wall-of-stone': 'area.wall-of-stone.v1',
  'wall-of-ice': 'area.wall-of-ice.v1',
  'wall-of-thorns': 'area.wall-of-thorns.v1',
  'wall-of-fire': 'area.wall-of-fire.v2',
  'blade-barrier': 'area.blade-barrier.v2',
})

function stableSeed(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function vfxSpellDefinitionForKind(kind: MapProjectile['kind']): VfxSpellDefinition {
  return spellDefinitions.get(String(kind)) ?? { renderer: 'projectile-arrow' }
}

export function vfxAssetForId(assetId: string | undefined): VfxAssetDefinition | undefined {
  return assetId ? VFX_ASSET_REGISTRY[assetId] : undefined
}

export function vfxAssetUrlForProjectileKind(kind: MapProjectile['kind']): string | undefined {
  return vfxAssetForId(vfxSpellDefinitionForKind(kind).assetId)?.url
}

export function compileMapProjectileVfxSequence(
  projectile: MapProjectile,
): VfxSequenceDefinition {
  const definition = vfxSpellDefinitionForKind(projectile.kind)
  const durationMs = Math.max(1, projectile.durationMs ?? 650)
  const sections: VfxSequenceSection[] = [{
    type: 'effect',
    id: `${projectile.id}:effect`,
    startMs: 0,
    durationMs,
    renderer: definition.renderer,
    assetId: definition.assetId,
    waitUntilFinished: true,
  }]
  if (projectile.handoffAreaId) {
    sections.push({
      type: 'persistent-handoff',
      id: `${projectile.id}:persistent-handoff`,
      startMs: durationMs,
      areaId: projectile.handoffAreaId,
    })
  }
  return {
    version: 1,
    id: projectile.id,
    seed: stableSeed(projectile.id),
    issuedAt: projectile.issuedAt ?? Date.now(),
    durationMs,
    sections,
  }
}

export function activeVfxSequenceSections(
  sequence: VfxSequenceDefinition,
  now: number,
): VfxSequenceSection[] {
  const elapsed = Math.max(0, now - sequence.issuedAt)
  return sequence.sections.filter((section) => {
    if (section.type === 'persistent-handoff') return elapsed >= section.startMs
    return elapsed >= section.startMs && elapsed < section.startMs + section.durationMs
  })
}

export function vfxSequenceAssetUrls(sequence: VfxSequenceDefinition): string[] {
  return [...new Set(sequence.sections.flatMap((section) => {
    if (section.type !== 'effect') return []
    const url = vfxAssetForId(section.assetId)?.url
    return url ? [url] : []
  }))]
}

export async function preloadVfxSequenceAssets(
  sequence: VfxSequenceDefinition,
  load: (url: string) => Promise<unknown>,
): Promise<void> {
  await Promise.all(vfxSequenceAssetUrls(sequence).map((url) => load(url)))
}
