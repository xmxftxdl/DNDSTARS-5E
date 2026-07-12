import type { Character, Trait } from '../types/character'
import { isShadowDancer } from './characterClasses'
import { syncCharacterClassResources } from './classResources'
import { ARCHER_CLASS_FEATURE_DEFS } from '../classes/archer/featureDefinitions'

export { maxQiForLevel } from './classResourceRules'
export { piercingInsightExtraD4, piercingInsightHpThresholdPercent } from '../classes/archer/featureDefinitions'

/** 职业特性键（弓手 / 逐风者 / 影舞者） */
export const CLASS_FEATURE_KEYS = [
  // —— 弓手 ——
  'doubleArrow',
  'armorPiercingArrow',
  'stableMind',
  'eagleEye',
  'preciseStrike',
  'galeCombo',
  'agileLeap',
  'wildernessGuide',
  'piercingInsight',
  'silentDraw',
  // —— 逐风者 ——
  'animalMastery',
  'calmMind',
  'arcaneSurge',
  'huntingMark',
  'arcaneDevour',
  'calmSpirit',
  'trackingArrow',
  'explosiveArrow',
  'swiftShot',
  'huntingCombo',
  'swiftRecall',
  'vengeanceBlood',
  'runeArrow',
  'focusedSpirit',
  'shadowVeil',
  'stillWater',
  'finale',
  'arcaneDance',
  // —— 影舞者 ——
  'galeDancer',
  'takeoff',
  'comboFist',
  'multiStrike',
  'illusionDance',
  'flexibleBody',
  'waterWalk',
  'heavyFist',
  'critBlock',
  'fateShackle',
  'showtime',
  'windBlade',
  'transcendentSoul',
  // —— 已废弃（迁移用） ——
  'steadyDraw',
  'swiftStep',
  'natureWhisper',
  'flawObservation',
  'fatalChain',
  'calmingAura',
  'lastingControl',
] as const

export type BuiltinClassFeatureKey = (typeof CLASS_FEATURE_KEYS)[number]

/** 新职业可通过 module augmentation 扩展特性键，无需修改核心联合类型。 */
export interface ClassFeatureKeyExtensions {
  readonly __classFeatureKeyExtensionBrand?: never
}

export type ClassFeatureKey =
  | BuiltinClassFeatureKey
  | Exclude<Extract<keyof ClassFeatureKeyExtensions, string>, '__classFeatureKeyExtensionBrand'>

export type TraitUsage = 'perCombat' | 'perDay' | 'perLongRest' | 'passive' | 'unlimited'

export interface ClassFeatureDef {
  key: ClassFeatureKey
  name: string
  description: string
  usage: TraitUsage
  maxUsesAtRank?: (featureRank: number, charLevel?: number) => number
  rangeAtRank?: (featureRank: number) => number
  diceAtRank?: (featureRank: number) => number
  valueAtRank?: (featureRank: number) => number
  /** 不在抉择面板展示（仅兼容旧存档） */
  deprecated?: boolean
}

export type MetaChoiceKey =
  | 'knowledgeBoost'
  | 'abilityBoost'
  | 'proficiencyBoost'
  | 'featureUpgrade'
  | 'skillUpgrade'

export interface TraitChoiceOption {
  kind: 'feature' | 'meta'
  featureKey?: ClassFeatureKey
  metaKey?: MetaChoiceKey
  label: string
  description: string
}

export interface TraitChoiceGroup {
  id: string
  title: string
  hint: string
  minLevel: number
  pickCount: number
  autoGrant?: MetaChoiceKey[]
  autoGrantFeatures?: ClassFeatureKey[]
  options: TraitChoiceOption[]
  applies: (c: Character) => boolean
}

export const MAX_FEATURE_LEVEL = 4

export const FEATURE_RANK_THRESHOLDS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const

const META_LABELS: Record<MetaChoiceKey, { label: string; description: string }> = {
  knowledgeBoost: {
    label: '自选学识 +1',
    description: '任选一项学识熟练提升 1 级（由 DM 或玩家在角色卡上标注）。',
  },
  abilityBoost: {
    label: '属性值 +2',
    description: '获得 2 点属性值提升，可自由分配至任意属性（上限 100）。',
  },
  proficiencyBoost: {
    label: '自选熟练项 +1',
    description: '任选一项武器/工具/技能熟练提升 1 级。',
  },
  featureUpgrade: {
    label: '自选特性 +1',
    description: '消耗后立即获得 1 个特性升级点，用于提升已有职业特性等级。',
  },
  skillUpgrade: {
    label: '自选技能 +1',
    description: '任选一项已学弓手技能树技能提升 1 阶。',
  },
}

function metaOption(key: MetaChoiceKey): TraitChoiceOption {
  const m = META_LABELS[key]
  return { kind: 'meta', metaKey: key, label: m.label, description: m.description }
}

function feat(key: ClassFeatureKey, def: ClassFeatureDef): TraitChoiceOption {
  return {
    kind: 'feature',
    featureKey: key,
    label: def.name,
    description: formatFeatureDescription(def, 1),
  }
}

export const CLASS_FEATURE_DEFS = ARCHER_CLASS_FEATURE_DEFS

const FEATURE_MAP = new Map(CLASS_FEATURE_DEFS.map((d) => [d.key, d]))

const ACTIVE_FEATURE_KEYS = new Set(
  CLASS_FEATURE_DEFS.filter((d) => !d.deprecated).map((d) => d.key),
)

export function getClassFeatureDef(key: ClassFeatureKey): ClassFeatureDef | undefined {
  return FEATURE_MAP.get(key)
}

export function registeredClassFeatureDefs(): readonly ClassFeatureDef[] {
  return [...FEATURE_MAP.values()]
}

export function registerClassFeatureDef(definition: ClassFeatureDef): () => void {
  const previous = FEATURE_MAP.get(definition.key)
  FEATURE_MAP.set(definition.key, definition)
  return () => {
    if (FEATURE_MAP.get(definition.key) !== definition) return
    if (previous) FEATURE_MAP.set(definition.key, previous)
    else FEATURE_MAP.delete(definition.key)
  }
}

export function formatFeatureDescription(def: ClassFeatureDef, featureRank: number): string {
  const uses = def.maxUsesAtRank?.(featureRank)
  const range = def.rangeAtRank?.(featureRank)
  const dice = def.diceAtRank?.(featureRank)
  const value = def.valueAtRank?.(featureRank)
  return def.description
    .replace(/\{uses\}/g, uses != null ? String(uses) : '—')
    .replace(/\{rank\}/g, String(featureRank))
    .replace(/\{range\}/g, range != null ? String(range) : '—')
    .replace(/\{dice\}/g, dice != null ? String(dice) : '—')
    .replace(/\{value\}/g, value != null ? String(value) : '—')
}

export function usageLabel(usage: TraitUsage): string {
  switch (usage) {
    case 'perCombat':
      return '每场'
    case 'perDay':
      return '每长休'
    case 'perLongRest':
      return '每长休'
    case 'passive':
      return '被动'
    default:
      return ''
  }
}

export function isBaseArcher(charClass: string): boolean {
  return charClass.includes('弓手') && charClass !== '逐风者' && charClass !== '影舞者'
}

export function isWindrunner(charClass: string): boolean {
  return charClass === '逐风者'
}

function defOf(key: ClassFeatureKey): ClassFeatureDef {
  return FEATURE_MAP.get(key)!
}

export const TRAIT_CHOICE_GROUPS: TraitChoiceGroup[] = [
  {
    id: 'archer-lv1',
    title: '弓手 · LV1 职业特性',
    hint: '请选择 1 项：双箭、穿甲箭。',
    minLevel: 1,
    pickCount: 1,
    applies: (c) => isBaseArcher(c.charClass),
    options: ['doubleArrow', 'armorPiercingArrow'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'archer-lv3',
    title: '弓手 · LV3 职业特性',
    hint: '请选择 1 项：残影脱身、鹰眼。',
    minLevel: 3,
    pickCount: 1,
    applies: (c) => isBaseArcher(c.charClass),
    options: ['stableMind', 'eagleEye'].map((k) => feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey))),
  },
  {
    id: 'archer-lv5',
    title: '弓手 · LV5 职业特性',
    hint: '请选择 1 项：精准打击、疾风连击。',
    minLevel: 5,
    pickCount: 1,
    applies: (c) => isBaseArcher(c.charClass),
    options: ['preciseStrike', 'galeCombo'].map((k) => feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey))),
  },
  {
    id: 'archer-lv8',
    title: '弓手 · LV8 职业特性',
    hint: '请选择 1 项：灵巧跳跃、荒野指引者。',
    minLevel: 8,
    pickCount: 1,
    applies: (c) => isBaseArcher(c.charClass),
    options: ['agileLeap', 'wildernessGuide'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'archer-lv12',
    title: '弓手 · LV12 职业特性',
    hint: '请选择 1 项：看破！、无声起弦。',
    minLevel: 12,
    pickCount: 1,
    applies: (c) => isBaseArcher(c.charClass),
    options: ['piercingInsight', 'silentDraw'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'windrunner-lv15',
    title: '逐风者 · LV15 职业特性',
    hint: '请选择 1 项：动物学专精、静心、魔法浪涌。',
    minLevel: 15,
    pickCount: 1,
    applies: (c) => isWindrunner(c.charClass),
    options: ['animalMastery', 'calmMind', 'arcaneSurge'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'windrunner-lv20',
    title: '逐风者 · LV20 职业特性',
    hint: '请选择 1 项：狩猎印记、魔能吞噬、安定心神。',
    minLevel: 20,
    pickCount: 1,
    applies: (c) => isWindrunner(c.charClass),
    options: ['huntingMark', 'arcaneDevour', 'calmSpirit'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'windrunner-lv25',
    title: '逐风者 · LV25 职业特性',
    hint: '请选择 1 项：追踪箭、爆裂箭矢、符文箭。',
    minLevel: 25,
    pickCount: 1,
    applies: (c) => isWindrunner(c.charClass),
    options: ['trackingArrow', 'explosiveArrow', 'runeArrow'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'windrunner-lv30',
    title: '逐风者 · LV30 职业特性',
    hint: '请选择 1 项：波澜不惊、狩猎连击、迅捷回溯。',
    minLevel: 30,
    pickCount: 1,
    applies: (c) => isWindrunner(c.charClass),
    options: ['swiftShot', 'huntingCombo', 'swiftRecall'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'windrunner-lv35',
    title: '逐风者 · LV35 职业特性',
    hint: '请选择 1 项：集中精神、影遁之术。',
    minLevel: 35,
    pickCount: 1,
    applies: (c) => isWindrunner(c.charClass),
    options: ['focusedSpirit', 'shadowVeil'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'windrunner-lv40',
    title: '逐风者 · LV40 职业特性',
    hint: '请选择 1 项：心如止水、曲终、魔能狂舞。',
    minLevel: 40,
    pickCount: 1,
    applies: (c) => isWindrunner(c.charClass),
    options: ['stillWater', 'finale', 'arcaneDance'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'shadowdancer-lv15',
    title: '影舞者 · LV15 职业特性',
    hint: '请选择 1 项：疾风舞者、起飞。',
    minLevel: 15,
    pickCount: 1,
    applies: (c) => isShadowDancer(c.charClass),
    options: ['galeDancer', 'takeoff'].map((k) => feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey))),
  },
  {
    id: 'shadowdancer-lv20',
    title: '影舞者 · LV20 职业特性',
    hint: '请选择 1 项：连续拳、多重打击。',
    minLevel: 20,
    pickCount: 1,
    applies: (c) => isShadowDancer(c.charClass),
    options: ['comboFist', 'multiStrike'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'shadowdancer-lv25',
    title: '影舞者 · LV25 职业特性',
    hint: '请选择 1 项：迷幻舞步、灵活身躯。',
    minLevel: 25,
    pickCount: 1,
    applies: (c) => isShadowDancer(c.charClass),
    options: ['illusionDance', 'flexibleBody'].map((k) =>
      feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey)),
    ),
  },
  {
    id: 'shadowdancer-lv30',
    title: '影舞者 · LV30 职业特性',
    hint: '请选择 1 项：凌波微步、重拳。',
    minLevel: 30,
    pickCount: 1,
    applies: (c) => isShadowDancer(c.charClass),
    options: ['waterWalk', 'heavyFist'].map((k) => feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey))),
  },
  {
    id: 'shadowdancer-lv35',
    title: '影舞者 · LV35 职业特性',
    hint: '请选择 1 项：重击封锁、命运枷锁，或自选特性 +1。',
    minLevel: 35,
    pickCount: 1,
    applies: (c) => isShadowDancer(c.charClass),
    options: [
      feat('critBlock', defOf('critBlock')),
      feat('fateShackle', defOf('fateShackle')),
      metaOption('featureUpgrade'),
    ],
  },
  {
    id: 'shadowdancer-lv40',
    title: '影舞者 · LV40 职业特性',
    hint: '请选择 1 项：演出时间、风刃乱舞。',
    minLevel: 40,
    pickCount: 1,
    applies: (c) => isShadowDancer(c.charClass),
    options: ['showtime', 'windBlade'].map((k) => feat(k as ClassFeatureKey, defOf(k as ClassFeatureKey))),
  },
  {
    id: 'shadowdancer-lv45',
    title: '影舞者 · LV45 里程碑',
    hint: '获得特性：超凡魂。',
    minLevel: 45,
    pickCount: 0,
    autoGrantFeatures: ['transcendentSoul'],
    applies: (c) => isShadowDancer(c.charClass),
    options: [],
  },
]

export function getTraitChoiceGroup(groupId: string): TraitChoiceGroup | undefined {
  return TRAIT_CHOICE_GROUPS.find((group) => group.id === groupId)
}

export function registerTraitChoiceGroup(group: TraitChoiceGroup): () => void {
  const previousIndex = TRAIT_CHOICE_GROUPS.findIndex((item) => item.id === group.id)
  const previous = previousIndex >= 0 ? TRAIT_CHOICE_GROUPS[previousIndex] : undefined
  if (previousIndex >= 0) TRAIT_CHOICE_GROUPS[previousIndex] = group
  else TRAIT_CHOICE_GROUPS.push(group)
  return () => {
    const currentIndex = TRAIT_CHOICE_GROUPS.findIndex((item) => item.id === group.id)
    if (currentIndex < 0 || TRAIT_CHOICE_GROUPS[currentIndex] !== group) return
    if (previous) TRAIT_CHOICE_GROUPS[currentIndex] = previous
    else TRAIT_CHOICE_GROUPS.splice(currentIndex, 1)
  }
}

export function getTraitChoicesDone(c: Character): Record<string, boolean> {
  return c.traitChoicesDone ?? {}
}

export function isChoiceGroupDone(c: Character, groupId: string): boolean {
  if (getTraitChoicesDone(c)[groupId]) return true
  if (groupId === 'archer-lv1' && c.archerLv1ChoiceDone) return true
  if (groupId === 'archer-lv3' && c.archerLv3ChoiceDone) return true
  return false
}

export function pendingTraitChoices(c: Character): TraitChoiceGroup[] {
  return TRAIT_CHOICE_GROUPS.filter(
    (g) => c.level >= g.minLevel && g.applies(c) && !isChoiceGroupDone(c, g.id),
  )
}

export function createClassTrait(key: ClassFeatureKey, charLevel = 1): Trait {
  void charLevel
  const def = getClassFeatureDef(key)!
  const featureRank = 1
  const maxUses = def.maxUsesAtRank?.(featureRank) ?? 0
  return {
    id: `feat-${key}`,
    name: def.name,
    level: featureRank,
    uses: maxUses,
    maxUses,
    description: formatFeatureDescription(def, featureRank),
    featureKey: key,
  }
}

export function applyTraitFeatureRank(trait: Trait, featureRank: number): Trait {
  if (!trait.featureKey) return trait
  const def = getClassFeatureDef(trait.featureKey)
  if (!def) return trait
  const cappedRank = Math.min(MAX_FEATURE_LEVEL, Math.max(1, featureRank))
  const maxUses = def.maxUsesAtRank?.(cappedRank) ?? 0
  const uses = maxUses > 0 ? Math.min(trait.uses, maxUses) : trait.uses
  return {
    ...trait,
    name: def.name,
    level: cappedRank,
    maxUses,
    uses: maxUses > trait.maxUses ? maxUses : uses,
    description: formatFeatureDescription(def, cappedRank),
  }
}

export function syncClassTraitUses(c: Character): Character {
  let traits = c.traits
  for (const def of registeredClassFeatureDefs()) {
    if (def.deprecated) continue
    const t = traits.find((x) => x.featureKey === def.key)
    if (!t) continue
    traits = traits.map((x) => {
      if (x.featureKey !== def.key) return x
      return applyTraitFeatureRank(x, x.level)
    })
  }
  return { ...c, traits }
}

export function isArcherLineFeatureKey(key: ClassFeatureKey | undefined): boolean {
  return !!key && ACTIVE_FEATURE_KEYS.has(key)
}

export function stripArcherLineTraits(traits: Trait[]): Trait[] {
  return traits.filter((t) => !t.featureKey || ACTIVE_FEATURE_KEYS.has(t.featureKey))
}

/** @deprecated 使用 syncCharacterClassResources。 */
export function syncQiForCharacter(c: Character): Character {
  return syncCharacterClassResources(c)
}

export function metaChoiceLabel(key: MetaChoiceKey): string {
  return META_LABELS[key].label
}

export function metaChoiceDescription(key: MetaChoiceKey): string {
  return META_LABELS[key].description
}

const DEPRECATED_KEY_MAP: Partial<Record<ClassFeatureKey, ClassFeatureKey>> = {
  steadyDraw: 'stableMind',
  flawObservation: 'piercingInsight',
  lastingControl: 'fateShackle',
  fatalChain: 'heavyFist',
  calmingAura: 'calmSpirit',
}

export function migrateTraitKey(key: ClassFeatureKey): ClassFeatureKey {
  return DEPRECATED_KEY_MAP[key] ?? key
}

export function migrateCharacterTraits(c: Character): Character {
  const seen = new Set<ClassFeatureKey>()
  const traits: Trait[] = []
  for (const t of c.traits) {
    if (!t.featureKey) {
      traits.push(t)
      continue
    }
    const mapped = migrateTraitKey(t.featureKey)
    const def = getClassFeatureDef(mapped)
    if (!def || def.deprecated) continue
    if (seen.has(mapped)) continue
    seen.add(mapped)
    const base = t.featureKey === mapped ? t : createClassTrait(mapped, c.level)
    traits.push(
      applyTraitFeatureRank(
        { ...base, level: t.level, uses: t.uses, maxUses: t.maxUses },
        t.level,
      ),
    )
  }
  return syncClassTraitUses({ ...c, traits })
}

export function resetCombatTraitUses(c: Character): Character {
  let traits = c.traits
  for (const def of registeredClassFeatureDefs()) {
    if (def.deprecated || def.usage !== 'perCombat' || !def.maxUsesAtRank) continue
    traits = traits.map((t) => {
      if (t.featureKey !== def.key) return t
      const maxUses = def.maxUsesAtRank!(t.level)
      return { ...t, uses: maxUses, maxUses }
    })
  }
  return {
    ...syncQiForCharacter(c),
    traits,
    combatBuffs: {
      ...c.combatBuffs,
      doubleArrowReady: undefined,
      preciseStrikeReady: undefined,
      steadyDrawUsedThisTurn: undefined,
      silentDrawUsed: undefined,
      calmSpiritStacks: undefined,
      calmSpiritCritBonusPercent: undefined,
      calmSpiritMoveFeet: undefined,
      movedFeetThisTurn: undefined,
      tookDamageThisTurn: undefined,
      outOfBreathTurns: undefined,
      galeComboReady: undefined,
      agileLeapMoveFeet: undefined,
      freeMoveFeet: undefined,
      burstKickExtraD6: undefined,
      windKickTreatKnockbackTargetId: undefined,
      wildernessGuideBoost: undefined,
    },
  }
}
