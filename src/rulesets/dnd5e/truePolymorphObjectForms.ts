import type { Dnd5eActiveEffectInstance } from './activeEffects'
import type { Dnd5eMonsterStatBlock } from './monsters'

export const DND5E_TRUE_POLYMORPH_OBJECT_FORM_TAG_PREFIX = 'true-polymorph-object-form:'

export interface Dnd5eTruePolymorphObjectFormProfile {
  id:
    | 'srd-5.1:true-polymorph-object:stone-statue'
    | 'srd-5.1:true-polymorph-object:granite-boulder'
    | 'srd-5.1:true-polymorph-object:wooden-chair'
  slug: 'stone-statue' | 'granite-boulder' | 'wooden-chair'
  label: string
  description: string
  sizeLabel: '中型' | '大型'
  armorClass: number
  maximumHitPoints: number
}

/** Closed UI/Host profiles used by the audited True Polymorph object mode. */
export const DND5E_TRUE_POLYMORPH_OBJECT_FORMS: readonly Dnd5eTruePolymorphObjectFormProfile[] = [
  {
    id: 'srd-5.1:true-polymorph-object:stone-statue',
    slug: 'stone-statue',
    label: '石制雕像',
    description: '中型坚韧石质物体；AC 17，生命值 18。',
    sizeLabel: '中型',
    armorClass: 17,
    maximumHitPoints: 18,
  },
  {
    id: 'srd-5.1:true-polymorph-object:granite-boulder',
    slug: 'granite-boulder',
    label: '花岗岩巨石',
    description: '大型坚韧石质物体；AC 17，生命值 27。',
    sizeLabel: '大型',
    armorClass: 17,
    maximumHitPoints: 27,
  },
  {
    id: 'srd-5.1:true-polymorph-object:wooden-chair',
    slug: 'wooden-chair',
    label: '木椅',
    description: '中型坚韧木质物体；AC 15，生命值 18。',
    sizeLabel: '中型',
    armorClass: 15,
    maximumHitPoints: 18,
  },
] as const

const TRUE_POLYMORPH_OBJECT_STAT_BLOCKS = new Map<string, Dnd5eMonsterStatBlock>(
  DND5E_TRUE_POLYMORPH_OBJECT_FORMS.map((form) => [form.id, {
    id: form.id,
    slug: form.slug,
    name: form.label,
    englishName: form.slug,
    source: 'SRD 5.1',
    size: form.sizeLabel,
    creatureType: '物体',
    alignment: '—',
    armorClass: { value: form.armorClass, note: '物体材质' },
    hitPoints: { average: form.maximumHitPoints, dice: `${form.maximumHitPoints}` },
    speed: { walk: 0 },
    // The engine requires a closed numeric snapshot. Object-mode UI suppresses
    // these placeholders because objects do not make creature ability checks.
    abilities: { str: 10, dex: 10, con: 10, int: 1, wis: 1, cha: 1 },
    senses: [],
    passivePerception: 5,
    languages: [],
    challenge: { rating: '0', xp: 0 },
    traits: [],
    actions: [],
    capabilities: {
      swarm: false,
      shapechanger: false,
      regeneration: false,
      spellcaster: false,
      legendary: false,
      hasFlySpeed: false,
      hasSwimSpeed: false,
    },
    description: form.description,
  } satisfies Dnd5eMonsterStatBlock]),
)

export function getDnd5eTruePolymorphObjectStatBlock(
  id: string,
): Dnd5eMonsterStatBlock | undefined {
  return TRUE_POLYMORPH_OBJECT_STAT_BLOCKS.get(id)
}

export function dnd5eTruePolymorphObjectFormTag(formId: string): string {
  return `${DND5E_TRUE_POLYMORPH_OBJECT_FORM_TAG_PREFIX}${formId}`
}

export function dnd5eTruePolymorphObjectFormFromEffects(
  effects: readonly Dnd5eActiveEffectInstance[] | undefined,
): { profile: Dnd5eTruePolymorphObjectFormProfile; permanent: boolean } | undefined {
  for (const effect of effects ?? []) {
    if (!effect.tags?.includes('object-form')) continue
    const formTag = effect.tags.find((tag) => tag.startsWith(DND5E_TRUE_POLYMORPH_OBJECT_FORM_TAG_PREFIX))
    const formId = formTag?.slice(DND5E_TRUE_POLYMORPH_OBJECT_FORM_TAG_PREFIX.length)
    const profile = DND5E_TRUE_POLYMORPH_OBJECT_FORMS.find((candidate) => candidate.id === formId)
    if (profile) return { profile, permanent: effect.duration.type === 'permanent' }
  }
  return undefined
}
