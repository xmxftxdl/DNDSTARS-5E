/**
 * Host-authoritative SRD material classification for Flesh to Stone.
 *
 * The spell can select any creature, but only a creature whose body is made
 * of flesh makes the initial save. Unknown/custom creatures remain eligible
 * so this closed SRD classification does not silently disable homebrew play.
 */

const FLESH_BODIED_EXCEPTIONS = new Set([
  'flesh-golem',
  'ghast',
  'ghoul',
  'lich',
  'mummy',
  'mummy-lord',
  'ogre-zombie',
  'vampire',
  'vampire-spawn',
  'vampire-vampire',
  'wight',
  'zombie',
])

function srdStatBlockSlug(statBlockId: string | undefined): string | undefined {
  if (!statBlockId) return undefined
  const normalized = statBlockId.trim().toLocaleLowerCase()
  return normalized.startsWith('srd-5.1:') ? normalized.slice('srd-5.1:'.length) : normalized
}

function normalizedCreatureType(creatureType: string | undefined): string {
  return creatureType?.trim().toLocaleLowerCase() ?? ''
}

export function dnd5eFleshToStoneTargetHasFlesh(target: {
  statBlockId?: string
  creatureType?: string
}): boolean {
  const statBlockSlug = srdStatBlockSlug(target.statBlockId)
  if (statBlockSlug && FLESH_BODIED_EXCEPTIONS.has(statBlockSlug)) return true

  const creatureType = normalizedCreatureType(target.creatureType)
  const explicitlyNonFlesh = [
    'construct', '构装',
    'elemental', '元素',
    'ooze', '软泥',
    'plant', '植物',
    'undead', '亡灵', '不死',
  ].some((marker) => creatureType === marker || creatureType.includes(marker))
  return !explicitlyNonFlesh
}
