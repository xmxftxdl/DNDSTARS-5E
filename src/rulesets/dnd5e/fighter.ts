import type { Character } from '../../types/character'

export type FighterSubclassId = 'champion' | 'battle-master' | 'eldritch-knight'

export type FighterFightingStyleId =
  | 'archery'
  | 'defense'
  | 'dueling'
  | 'great-weapon-fighting'
  | 'protection'
  | 'two-weapon-fighting'

export type FighterManeuverId =
  | 'commanders-strike'
  | 'disarming-attack'
  | 'distracting-strike'
  | 'evasive-footwork'
  | 'feinting-attack'
  | 'goading-attack'
  | 'lunging-attack'
  | 'maneuvering-attack'
  | 'menacing-attack'
  | 'parry'
  | 'precision-attack'
  | 'pushing-attack'
  | 'rally'
  | 'riposte'
  | 'sweeping-attack'
  | 'trip-attack'

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

export const FIGHTER_RESOURCE_KEYS = {
  secondWind: 'fighterSecondWind',
  actionSurge: 'fighterActionSurge',
  indomitable: 'fighterIndomitable',
  superiorityDice: 'fighterSuperiorityDice',
} as const

export type FighterResourceKey = typeof FIGHTER_RESOURCE_KEYS[keyof typeof FIGHTER_RESOURCE_KEYS]

export const FIGHTER_SUBCLASS_OPTIONS: readonly { id: FighterSubclassId; name: string; summary: string }[] = [
  { id: 'champion', name: '勇士', summary: '强化重击、体能与持续作战能力。' },
  { id: 'battle-master', name: '战斗大师', summary: '使用优势骰与战技控制战局。' },
  { id: 'eldritch-knight', name: '奥法骑士', summary: '将武器训练与法师法术结合。' },
]

export const FIGHTER_FIGHTING_STYLE_OPTIONS: readonly { id: FighterFightingStyleId; name: string; summary: string }[] = [
  { id: 'archery', name: '箭术', summary: '使用远程武器进行攻击检定时获得 +2。' },
  { id: 'defense', name: '防御', summary: '穿着护甲时护甲等级获得 +1。' },
  { id: 'dueling', name: '决斗', summary: '单手持用一把近战武器且另一只手未持武器时，伤害获得 +2。' },
  { id: 'great-weapon-fighting', name: '巨武器战斗', summary: '双手近战武器伤害骰出现 1 或 2 时可重骰一次。' },
  { id: 'protection', name: '保护', summary: '持盾时可用反应干扰对相邻盟友的攻击。' },
  { id: 'two-weapon-fighting', name: '双武器战斗', summary: '双持时可将属性调整值加入副手攻击伤害。' },
]

export const FIGHTER_MANEUVER_OPTIONS: readonly { id: FighterManeuverId; name: string; summary: string }[] = [
  { id: 'commanders-strike', name: '指挥官打击', summary: '放弃一次攻击并使用附赠动作，让盟友以反应进行一次武器攻击。' },
  { id: 'disarming-attack', name: '缴械攻击', summary: '命中时追加优势骰伤害，并迫使目标进行力量豁免以免掉落物品。' },
  { id: 'distracting-strike', name: '扰乱攻击', summary: '命中时追加优势骰伤害，使下一名盟友对该目标的攻击获得优势。' },
  { id: 'evasive-footwork', name: '灵巧步法', summary: '移动时将优势骰加入护甲等级，效果持续到停止移动。' },
  { id: 'feinting-attack', name: '佯攻', summary: '以附赠动作选择邻近目标，使本回合下一次攻击获得优势并追加伤害。' },
  { id: 'goading-attack', name: '挑衅攻击', summary: '命中时追加伤害；目标豁免失败后，攻击其他生物时具有劣势。' },
  { id: 'lunging-attack', name: '突刺攻击', summary: '近战攻击时增加触及距离，并在命中后追加优势骰伤害。' },
  { id: 'maneuvering-attack', name: '机动攻击', summary: '命中时追加伤害，并让盟友用反应移动且不触发目标的借机攻击。' },
  { id: 'menacing-attack', name: '威吓攻击', summary: '命中时追加伤害；目标豁免失败后对你陷入恐慌。' },
  { id: 'parry', name: '招架', summary: '被近战攻击伤害时使用反应，减少优势骰加敏捷调整值的伤害。' },
  { id: 'precision-attack', name: '精准攻击', summary: '武器攻击检定时把优势骰加入命中结果。' },
  { id: 'pushing-attack', name: '推击', summary: '命中时追加伤害；目标豁免失败后被推离。' },
  { id: 'rally', name: '激励', summary: '使用附赠动作，让盟友获得优势骰加魅力调整值的临时生命值。' },
  { id: 'riposte', name: '还击', summary: '敌人近战攻击未命中时使用反应进行一次反击，命中后追加伤害。' },
  { id: 'sweeping-attack', name: '横扫攻击', summary: '近战命中时把优势骰伤害施加给相邻的第二个目标。' },
  { id: 'trip-attack', name: '绊摔攻击', summary: '命中时追加伤害；目标豁免失败后倒地。' },
]

const baseFeatures: readonly FighterFeatureDefinition[] = [
  { id: 'fighting-style', level: 1, name: '战斗风格', description: '选择一种擅长的战斗风格。', source: 'fighter' },
  { id: 'second-wind', level: 1, name: '回气', description: '用附赠动作恢复 1d10＋战士等级的生命值；完成短休或长休后恢复使用。', source: 'fighter' },
  { id: 'action-surge-1', level: 2, name: '动作如潮（1次）', description: '在自己回合额外执行一个动作；完成短休或长休后恢复使用。', source: 'fighter' },
  { id: 'martial-archetype', level: 3, name: '武术范型', description: '选择勇士、战斗大师或奥法骑士。', source: 'fighter' },
  { id: 'asi-4', level: 4, name: '属性值提升', description: '一项属性 +2，或两项属性各 +1；也可使用已启用的专长规则。', source: 'fighter' },
  { id: 'extra-attack-2', level: 5, name: '额外攻击（2次）', description: '执行攻击动作时可以攻击两次。', source: 'fighter' },
  { id: 'asi-6', level: 6, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'archetype-7', level: 7, name: '武术范型特性', description: '获得所选子职的 7 级特性。', source: 'fighter' },
  { id: 'asi-8', level: 8, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'indomitable-1', level: 9, name: '不屈（1次）', description: '重骰一次失败的豁免并采用新结果；长休后恢复使用。', source: 'fighter' },
  { id: 'archetype-10', level: 10, name: '武术范型特性', description: '获得所选子职的 10 级特性。', source: 'fighter' },
  { id: 'extra-attack-3', level: 11, name: '额外攻击（3次）', description: '执行攻击动作时可以攻击三次。', source: 'fighter' },
  { id: 'asi-12', level: 12, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'indomitable-2', level: 13, name: '不屈（2次）', description: '每次长休之间可使用不屈两次。', source: 'fighter' },
  { id: 'asi-14', level: 14, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'archetype-15', level: 15, name: '武术范型特性', description: '获得所选子职的 15 级特性。', source: 'fighter' },
  { id: 'asi-16', level: 16, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'action-surge-2', level: 17, name: '动作如潮（2次）', description: '每次休息之间可使用两次，但同一回合只能使用一次。', source: 'fighter' },
  { id: 'indomitable-3', level: 17, name: '不屈（3次）', description: '每次长休之间可使用不屈三次。', source: 'fighter' },
  { id: 'archetype-18', level: 18, name: '武术范型特性', description: '获得所选子职的 18 级特性。', source: 'fighter' },
  { id: 'asi-19', level: 19, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'extra-attack-4', level: 20, name: '额外攻击（4次）', description: '执行攻击动作时可以攻击四次。', source: 'fighter' },
]

const subclassFeatures: Record<FighterSubclassId, readonly FighterFeatureDefinition[]> = {
  champion: [
    { id: 'champion-improved-critical', level: 3, name: '精通重击', description: '武器攻击掷出 19–20 时造成重击。', source: 'champion' },
    { id: 'champion-remarkable-athlete', level: 7, name: '运动健将', description: '未加入熟练加值的力量、敏捷和体质检定可加入一半熟练加值（向上取整）。', source: 'champion' },
    { id: 'champion-additional-style', level: 10, name: '额外战斗风格', description: '选择第二种不同的战斗风格。', source: 'champion' },
    { id: 'champion-superior-critical', level: 15, name: '卓越重击', description: '武器攻击掷出 18–20 时造成重击。', source: 'champion' },
    { id: 'champion-survivor', level: 18, name: '生存者', description: '回合开始时，若生命值不高于上限一半且不为 0，恢复 5＋体质调整值生命值。', source: 'champion' },
  ],
  'battle-master': [
    { id: 'battle-master-superiority', level: 3, name: '战斗卓越', description: '获得 4 枚 d8 优势骰并选择 3 项战技；完成短休或长休后恢复优势骰。', source: 'battle-master' },
    { id: 'battle-master-student-of-war', level: 3, name: '战争学徒', description: '获得一种自选工匠工具的熟练。', source: 'battle-master' },
    { id: 'battle-master-know-your-enemy', level: 7, name: '知己知彼', description: '观察战斗外的生物后，可比较若干战斗能力；优势骰增至 5 枚并掌握更多战技。', source: 'battle-master' },
    { id: 'battle-master-improved-superiority-10', level: 10, name: '精通战斗卓越（d10）', description: '优势骰提升为 d10，并继续增加已掌握战技。', source: 'battle-master' },
    { id: 'battle-master-relentless', level: 15, name: '坚韧不拔', description: '投先攻且没有优势骰时恢复 1 枚；优势骰总数增至 6 枚。', source: 'battle-master' },
    { id: 'battle-master-improved-superiority-18', level: 18, name: '精通战斗卓越（d12）', description: '优势骰提升为 d12。', source: 'battle-master' },
  ],
  'eldritch-knight': [
    { id: 'eldritch-knight-spellcasting', level: 3, name: '施法', description: '使用智力施展法师法术，并按奥法骑士法术进度获得戏法、法术和法术位。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-weapon-bond', level: 3, name: '武器联结', description: '与至多两把武器建立联结，避免被缴械，并可用附赠动作召唤。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-war-magic', level: 7, name: '战争魔法', description: '用动作施展戏法后，可用附赠动作进行一次武器攻击。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-eldritch-strike', level: 10, name: '奥法打击', description: '武器攻击命中后，目标对你下一次法术的豁免具有劣势，持续到你下回合结束。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-arcane-charge', level: 15, name: '奥术冲锋', description: '使用动作如潮时，可在额外动作前后传送至多 30 尺。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-improved-war-magic', level: 18, name: '精通战争魔法', description: '用动作施展法术后，可用附赠动作进行一次武器攻击。', source: 'eldritch-knight' },
  ],
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

export function fighterSuperiorityDiceMax(level: number): number {
  const current = clampLevel(level)
  if (current >= 15) return 6
  if (current >= 7) return 5
  return current >= 3 ? 4 : 0
}

export function fighterFightingStyleSelectionLimit(character: Pick<Character, 'level' | 'dnd5eClassChoices'>): number {
  return character.level >= 10 && character.dnd5eClassChoices?.fighter?.subclass === 'champion' ? 2 : 1
}

export function fighterSelectedFightingStyles(
  character: Pick<Character, 'level' | 'dnd5eClassChoices'>,
): FighterFightingStyleId[] {
  const allowed = new Set(FIGHTER_FIGHTING_STYLE_OPTIONS.map((option) => option.id))
  const unique = [...new Set(character.dnd5eClassChoices?.fighter?.fightingStyles ?? [])]
    .filter((style): style is FighterFightingStyleId => allowed.has(style))
  return unique.slice(0, fighterFightingStyleSelectionLimit(character))
}

export function fighterManeuversKnown(level: number): number {
  const current = clampLevel(level)
  if (current >= 15) return 9
  if (current >= 10) return 7
  if (current >= 7) return 5
  return current >= 3 ? 3 : 0
}

export function fighterSuperiorityDieSides(level: number): number {
  const current = clampLevel(level)
  if (current >= 18) return 12
  if (current >= 10) return 10
  return 8
}

export function fighterSelectedManeuvers(
  character: Pick<Character, 'level' | 'dnd5eClassChoices'>,
): FighterManeuverId[] {
  if (character.dnd5eClassChoices?.fighter?.subclass !== 'battle-master') return []
  const allowed = new Set(FIGHTER_MANEUVER_OPTIONS.map((option) => option.id))
  const unique = [...new Set(character.dnd5eClassChoices?.fighter?.maneuvers ?? [])]
    .filter((maneuver): maneuver is FighterManeuverId => allowed.has(maneuver))
  return unique.slice(0, fighterManeuversKnown(character.level))
}

export function fighterManeuverSaveDc(character: Pick<Character, 'level' | 'abilities' | 'dnd5eClassChoices'>): number {
  const ability = character.dnd5eClassChoices?.fighter?.maneuverAbility ?? 'str'
  const score = ability === 'dex' ? character.abilities.dex : character.abilities.str
  return 8 + 2 + Math.floor((Math.min(20, Math.max(1, character.level)) - 1) / 4) + Math.floor((score - 10) / 2)
}

export function fighterResourceMax(character: Pick<Character, 'level' | 'dnd5eClassChoices'>, key: FighterResourceKey): number {
  if (key === FIGHTER_RESOURCE_KEYS.secondWind) return 1
  if (key === FIGHTER_RESOURCE_KEYS.actionSurge) return fighterActionSurgeUses(character.level)
  if (key === FIGHTER_RESOURCE_KEYS.indomitable) return fighterIndomitableUses(character.level)
  return character.dnd5eClassChoices?.fighter?.subclass === 'battle-master'
    ? fighterSuperiorityDiceMax(character.level)
    : 0
}

export function fighterResourceState(
  character: Pick<Character, 'level' | 'dnd5eClassChoices' | 'classResources'>,
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

export function fighterFeaturesAtLevel(level: number, subclass?: FighterSubclassId): readonly FighterFeatureDefinition[] {
  const current = clampLevel(level)
  const base = baseFeatures.filter((feature) => feature.level === current && !feature.id.startsWith('archetype-'))
  const archetypePlaceholder = baseFeatures.filter((feature) => feature.level === current && feature.id.startsWith('archetype-'))
  const selected = subclass ? subclassFeatures[subclass].filter((feature) => feature.level === current) : []
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
  return FIGHTER_SUBCLASS_OPTIONS.find((option) => option.id === subclass)?.name ?? '尚未选择'
}

export function fighterFightingStyleName(style?: FighterFightingStyleId): string {
  return FIGHTER_FIGHTING_STYLE_OPTIONS.find((option) => option.id === style)?.name ?? '尚未选择'
}
