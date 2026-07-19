import type { ClassResourceDefinition } from '../../lib/classDefinitionTypes'
import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import { dnd5e2014Adapter as rules } from './dnd5e2014Adapter'

export type FighterSubclassId = string
export type FighterRulesTextSource = 'srd-5.1-translation' | 'third-party-plugin'

export type FighterFightingStyleId =
  | 'archery'
  | 'defense'
  | 'dueling'
  | 'great-weapon-fighting'
  | 'protection'
  | 'two-weapon-fighting'

export interface FighterFeatureDefinition {
  id: string
  level: number
  name: string
  description: string
  source: 'fighter' | FighterSubclassId
}

export interface FighterProgressionLevel {
  level: number
  proficiencyBonus: number
  features: readonly FighterFeatureDefinition[]
}

export interface FighterSubclassChoiceOption {
  id: string
  name: string
  summary: string
}

export interface FighterSubclassChoiceGroup {
  id: string
  name: string
  description?: string
  minLevel?: number
  maxSelections: number | ((character: Character) => number)
  options: readonly FighterSubclassChoiceOption[]
}

export interface FighterSubclassDefinition {
  /** Core IDs are short; plugin-owned IDs are namespaced by the plugin host. */
  id: FighterSubclassId
  name: string
  summary: string
  rulesTextSource: FighterRulesTextSource
  sourceLabel: string
  ownerPluginId?: string
  features: readonly FighterFeatureDefinition[]
  choiceGroups?: readonly FighterSubclassChoiceGroup[]
  resources?: readonly ClassResourceDefinition[]
  fightingStyleSelectionLimit?: (character: Character) => number
}

export const FIGHTER_RESOURCE_KEYS = {
  secondWind: 'fighterSecondWind',
  actionSurge: 'fighterActionSurge',
  indomitable: 'fighterIndomitable',
} as const

export type FighterResourceKey = typeof FIGHTER_RESOURCE_KEYS[keyof typeof FIGHTER_RESOURCE_KEYS]

export const FIGHTER_FIGHTING_STYLE_OPTIONS: readonly { id: FighterFightingStyleId; name: string; summary: string }[] = [
  { id: 'archery', name: '箭术', summary: '使用远程武器进行攻击检定时，攻击检定获得 +2 加值。' },
  { id: 'defense', name: '防御', summary: '穿着护甲时，护甲等级获得 +1 加值。' },
  { id: 'dueling', name: '决斗', summary: '单手持用一把近战武器且未持用其他武器时，该武器的伤害掷骰获得 +2 加值。' },
  { id: 'great-weapon-fighting', name: '巨武器战斗', summary: '双手持用具有双手或两用属性的近战武器发动攻击时，伤害骰掷出 1 或 2 可重掷，但必须采用新结果，即使新结果仍为 1 或 2。' },
  { id: 'protection', name: '防护', summary: '持用盾牌时，若你能看见的生物攻击距你 5 尺内、除你以外的目标，可用反应使该次攻击检定具有劣势。' },
  { id: 'two-weapon-fighting', name: '双武器战斗', summary: '进行双武器战斗时，可将相应属性调整值加入第二次攻击的伤害。' },
]

const baseFeatures: readonly FighterFeatureDefinition[] = [
  { id: 'fighting-style', level: 1, name: '战斗风格', description: '你将一种特定战斗方式作为专长。从战斗风格选项中选择一项；即使以后再次获得选择机会，也不能重复选择同一种战斗风格。', source: 'fighter' },
  { id: 'second-wind', level: 1, name: '回气', description: '你拥有一份有限的体力储备，可用来保护自己免受伤害。在你的回合，你可以使用一个附赠动作，恢复等于 1d10＋战士等级的生命值。使用后必须完成一次短休或长休才能再次使用。', source: 'fighter' },
  { id: 'action-surge-1', level: 2, name: '动作如潮（1次）', description: '你可以暂时突破自身极限。在你的回合，你可以在自己的常规动作和可能的附赠动作之外，额外执行一个动作。使用后必须完成一次短休或长休才能再次使用。', source: 'fighter' },
  { id: 'martial-archetype', level: 3, name: '武术范型', description: '你选择一种希望在战斗风格与技法上效仿的范型。所选范型会在 3 级赋予你特性，并在 7、10、15 和 18 级赋予更多特性。', source: 'fighter' },
  { id: 'asi-4', level: 4, name: '属性值提升', description: '你可以使一项自选属性值提高 2，或使两项自选属性值各提高 1。你不能以此将一项属性值提高到 20 以上。', source: 'fighter' },
  { id: 'extra-attack-2', level: 5, name: '额外攻击', description: '在自己回合执行攻击动作时，可攻击两次而非一次。', source: 'fighter' },
  { id: 'asi-6', level: 6, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'archetype-7', level: 7, name: '武术范型特性', description: '获得所选子职的 7 级特性。', source: 'fighter' },
  { id: 'asi-8', level: 8, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'indomitable-1', level: 9, name: '不屈（1次）', description: '你可以重掷一次失败的豁免检定；若如此做，必须采用新的结果。使用后必须完成一次长休才能再次使用。', source: 'fighter' },
  { id: 'archetype-10', level: 10, name: '武术范型特性', description: '获得所选子职的 10 级特性。', source: 'fighter' },
  { id: 'extra-attack-3', level: 11, name: '额外攻击（2）', description: '在自己回合执行攻击动作时，可总共攻击三次。', source: 'fighter' },
  { id: 'asi-12', level: 12, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'indomitable-2', level: 13, name: '不屈（2次）', description: '每次长休之间可使用不屈两次。', source: 'fighter' },
  { id: 'asi-14', level: 14, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'archetype-15', level: 15, name: '武术范型特性', description: '获得所选子职的 15 级特性。', source: 'fighter' },
  { id: 'asi-16', level: 16, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'action-surge-2', level: 17, name: '动作如潮（2次）', description: '每次短休或长休之间可使用两次，但同一回合只能使用一次。', source: 'fighter' },
  { id: 'indomitable-3', level: 17, name: '不屈（3次）', description: '每次长休之间可使用不屈三次。', source: 'fighter' },
  { id: 'archetype-18', level: 18, name: '武术范型特性', description: '获得所选子职的 18 级特性。', source: 'fighter' },
  { id: 'asi-19', level: 19, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'extra-attack-4', level: 20, name: '额外攻击（3）', description: '在自己回合执行攻击动作时，可总共攻击四次。', source: 'fighter' },
]

const CHAMPION_SUBCLASS: FighterSubclassDefinition = {
  id: 'champion',
  name: '勇士',
  summary: '典型的勇士专注于发展经致命磨炼的纯粹肉体力量。效仿此范型者将严格训练与卓越体能结合，打出毁灭性的攻击。',
  rulesTextSource: 'srd-5.1-translation',
  sourceLabel: 'SRD 5.1 中文翻译',
  features: [
    { id: 'champion-improved-critical', level: 3, name: '精通重击', description: '武器攻击的 d20 自然掷出 19 或 20 时造成重击。', source: 'champion' },
    { id: 'champion-remarkable-athlete', level: 7, name: '运动健将', description: '未加入熟练加值的力量、敏捷或体质检定，可加入一半熟练加值（向上取整）；进行助跑跳远时，跳跃距离额外增加等于力量调整值的尺数。', source: 'champion' },
    { id: 'champion-additional-style', level: 10, name: '额外战斗风格', description: '从战斗风格中选择第二种不同的风格，不能与已有风格重复。', source: 'champion' },
    { id: 'champion-superior-critical', level: 15, name: '卓越重击', description: '武器攻击的 d20 自然掷出 18、19 或 20 时造成重击。', source: 'champion' },
    { id: 'champion-survivor', level: 18, name: '生存者', description: '回合开始时，若生命值不高于上限一半且不为 0，恢复 5＋体质调整值生命值。', source: 'champion' },
  ],
  fightingStyleSelectionLimit: (character) => character.level >= 10 ? 2 : 1,
}

const subclassDefinitions = new Map<FighterSubclassId, FighterSubclassDefinition>([
  [CHAMPION_SUBCLASS.id, CHAMPION_SUBCLASS],
])
const subclassListeners = new Set<() => void>()
let subclassRevision = 0

function publishSubclassRegistryChange(): void {
  subclassRevision += 1
  for (const listener of subclassListeners) listener()
}

export function registerFighterSubclassDefinition(definition: FighterSubclassDefinition): () => void {
  if (!/^[a-z0-9][a-z0-9._:-]*$/.test(definition.id)) {
    throw new Error(`Invalid fighter subclass id: ${definition.id}`)
  }
  if (subclassDefinitions.has(definition.id)) {
    throw new Error(`Fighter subclass already registered: ${definition.id}`)
  }
  subclassDefinitions.set(definition.id, definition)
  publishSubclassRegistryChange()
  return () => {
    if (subclassDefinitions.get(definition.id) !== definition) return
    subclassDefinitions.delete(definition.id)
    publishSubclassRegistryChange()
  }
}

export function registeredFighterSubclasses(): readonly FighterSubclassDefinition[] {
  return [...subclassDefinitions.values()]
}

export function fighterSubclassDefinition(subclass?: FighterSubclassId): FighterSubclassDefinition | undefined {
  return subclass ? subclassDefinitions.get(subclass) : undefined
}

export function subscribeFighterSubclassRegistry(listener: () => void): () => void {
  subclassListeners.add(listener)
  return () => subclassListeners.delete(listener)
}

export function fighterSubclassRegistrySnapshot(): number {
  return subclassRevision
}

export function fighterSubclassChoiceKey(subclassId: string, groupId: string): string {
  return `${subclassId}/${groupId}`
}

export function fighterSubclassChoiceLimit(group: FighterSubclassChoiceGroup, character: Character): number {
  const requested = typeof group.maxSelections === 'function' ? group.maxSelections(character) : group.maxSelections
  return Math.max(0, Math.floor(requested))
}

export function fighterSelectedSubclassChoices(
  character: Character,
  subclassId: string,
  group: FighterSubclassChoiceGroup,
): string[] {
  const allowed = new Set(group.options.map((option) => option.id))
  const key = fighterSubclassChoiceKey(subclassId, group.id)
  const unique = [...new Set(character.dnd5eClassChoices?.fighter?.extensionChoices?.[key] ?? [])]
    .filter((choice) => allowed.has(choice))
  return unique.slice(0, fighterSubclassChoiceLimit(group, character))
}

export function fighterSubclassResourceDefinitions(character: Character): readonly ClassResourceDefinition[] {
  return fighterSubclassDefinition(character.dnd5eClassChoices?.fighter?.subclass)?.resources ?? []
}

function clampLevel(level: number): number {
  return Math.min(20, Math.max(1, Math.floor(level)))
}

export function fighterAttacksPerAttackAction(level: number): number {
  const current = clampLevel(level)
  if (current >= 20) return 4
  if (current >= 11) return 3
  if (current >= 5) return 2
  return 1
}

export function fighterActionSurgeUses(level: number): number {
  const current = clampLevel(level)
  if (current >= 17) return 2
  return current >= 2 ? 1 : 0
}

export function fighterIndomitableUses(level: number): number {
  const current = clampLevel(level)
  if (current >= 17) return 3
  if (current >= 13) return 2
  return current >= 9 ? 1 : 0
}

export function fighterFightingStyleSelectionLimit(character: Character): number {
  return Math.max(1, fighterSubclassDefinition(character.dnd5eClassChoices?.fighter?.subclass)?.fightingStyleSelectionLimit?.(character) ?? 1)
}

export function fighterSelectedFightingStyles(character: Character): FighterFightingStyleId[] {
  const allowed = new Set(FIGHTER_FIGHTING_STYLE_OPTIONS.map((option) => option.id))
  const unique = [...new Set(character.dnd5eClassChoices?.fighter?.fightingStyles ?? [])]
    .filter((style): style is FighterFightingStyleId => allowed.has(style as FighterFightingStyleId))
  return unique.slice(0, fighterFightingStyleSelectionLimit(character))
}

export function fighterResourceMax(character: Pick<Character, 'level'>, key: FighterResourceKey): number {
  if (key === FIGHTER_RESOURCE_KEYS.secondWind) return 1
  if (key === FIGHTER_RESOURCE_KEYS.actionSurge) return fighterActionSurgeUses(character.level)
  return fighterIndomitableUses(character.level)
}

export function fighterResourceState(
  character: Pick<Character, 'level' | 'classResources'>,
  key: FighterResourceKey,
): { current: number; max: number } {
  const max = fighterResourceMax(character, key)
  const stored = character.classResources?.[key]
  return {
    current: Math.min(max, Math.max(0, stored?.current ?? max)),
    max,
  }
}

export function fighterCriticalThreshold(character: Pick<Character, 'level' | 'dnd5eClassChoices'>): number {
  if (character.dnd5eClassChoices?.fighter?.subclass !== 'champion') return 20
  return clampLevel(character.level) >= 15 ? 18 : clampLevel(character.level) >= 3 ? 19 : 20
}

/** 运动健将：仅对尚未加入熟练加值的力量、敏捷或体质检定生效。 */
export function fighterRemarkableAthleteBonus(
  character: Pick<Character, 'level' | 'dnd5eClassChoices'>,
  ability: AbilityKey,
  alreadyProficient: boolean,
): number {
  if (
    character.level < 7 ||
    character.dnd5eClassChoices?.fighter?.subclass !== 'champion' ||
    alreadyProficient ||
    !(['str', 'dex', 'con'] as AbilityKey[]).includes(ability)
  ) return 0
  return Math.ceil(rules.proficiencyBonus(character.level) / 2)
}

export function fighterRemarkableAthleteRunningLongJumpBonus(
  character: Pick<Character, 'level' | 'dnd5eClassChoices' | 'abilities'>,
): number {
  if (character.level < 7 || character.dnd5eClassChoices?.fighter?.subclass !== 'champion') return 0
  return Math.max(0, rules.abilityModifier(character.abilities.str))
}

/** 生存者在回合开始时应恢复的生命值；0 表示当前不满足触发条件。 */
export function fighterSurvivorHealing(
  character: Pick<Character, 'level' | 'dnd5eClassChoices' | 'currentHp' | 'maxHp' | 'abilities'>,
): number {
  if (
    character.level < 18 ||
    character.dnd5eClassChoices?.fighter?.subclass !== 'champion' ||
    character.currentHp <= 0 ||
    character.currentHp > character.maxHp / 2
  ) return 0
  const amount = Math.max(0, 5 + rules.abilityModifier(character.abilities.con))
  return Math.min(amount, character.maxHp - character.currentHp)
}

export function fighterFeaturesAtLevel(level: number, subclass?: FighterSubclassId): readonly FighterFeatureDefinition[] {
  const current = clampLevel(level)
  const base = baseFeatures.filter((feature) => feature.level === current && !feature.id.startsWith('archetype-'))
  const archetypePlaceholder = baseFeatures.filter((feature) => feature.level === current && feature.id.startsWith('archetype-'))
  const selected = fighterSubclassDefinition(subclass)?.features.filter((feature) => feature.level === current) ?? []
  return [...base, ...(selected.length > 0 ? selected : archetypePlaceholder)]
}

export function fighterProgression(subclass?: FighterSubclassId): readonly FighterProgressionLevel[] {
  return Array.from({ length: 20 }, (_, index) => {
    const level = index + 1
    return {
      level,
      proficiencyBonus: 2 + Math.floor((level - 1) / 4),
      features: fighterFeaturesAtLevel(level, subclass),
    }
  })
}

export function fighterSubclassName(subclass?: FighterSubclassId): string {
  if (!subclass) return '尚未选择'
  return fighterSubclassDefinition(subclass)?.name ?? '插件未安装'
}

export function fighterFightingStyleName(style?: FighterFightingStyleId): string {
  return FIGHTER_FIGHTING_STYLE_OPTIONS.find((option) => option.id === style)?.name ?? '尚未选择'
}
