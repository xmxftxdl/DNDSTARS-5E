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
  { id: 'battle-master', name: '战斗大师', summary: '使用卓越骰与战技控制战局。' },
  { id: 'eldritch-knight', name: '奥法骑士', summary: '将武器训练与法师法术结合。' },
]

export const FIGHTER_FIGHTING_STYLE_OPTIONS: readonly { id: FighterFightingStyleId; name: string; summary: string }[] = [
  { id: 'archery', name: '箭术', summary: '使用远程武器进行攻击检定时，攻击检定获得 +2 加值。' },
  { id: 'defense', name: '防御', summary: '穿着护甲时，护甲等级获得 +1 加值。' },
  { id: 'dueling', name: '决斗', summary: '单手持用一把近战武器且未持用其他武器时，该武器的伤害掷骰获得 +2 加值。' },
  { id: 'great-weapon-fighting', name: '巨武器战斗', summary: '双手持用具有双手或两用属性的近战武器发动攻击时，伤害骰掷出 1 或 2 可重掷，但必须采用新结果，即使新结果仍为 1 或 2。' },
  { id: 'protection', name: '防护', summary: '持用盾牌时，若你能看见的生物攻击距你 5 尺内、除你以外的目标，可用反应使该次攻击检定具有劣势。' },
  { id: 'two-weapon-fighting', name: '双武器战斗', summary: '进行双武器战斗时，可将相应属性调整值加入第二次攻击的伤害。' },
]

export const FIGHTER_MANEUVER_OPTIONS: readonly { id: FighterManeuverId; name: string; summary: string }[] = [
  { id: 'commanders-strike', name: '指挥官奇袭', summary: '在自己回合执行攻击动作时，放弃其中一次攻击、使用附赠动作并消耗 1 枚卓越骰；选择能看见或听见你的友方生物，使其立即用反应进行一次武器攻击，命中时将卓越骰加入伤害。' },
  { id: 'disarming-attack', name: '缴械攻击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；目标进行力量豁免，失败则掉落一件由你指定的持握物品，物品落在其脚边。' },
  { id: 'distracting-strike', name: '扰乱打击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；在你下回合开始前，除你以外的攻击者对该目标进行的下一次攻击检定具有优势。' },
  { id: 'evasive-footwork', name: '灵巧步法', summary: '移动时消耗并掷 1 枚卓越骰，将结果加入护甲等级，直至你停止此次移动。' },
  { id: 'feinting-attack', name: '诡诈攻击', summary: '在自己回合以附赠动作消耗 1 枚卓越骰，选择距你 5 尺内的生物；本回合对其进行的下一次攻击检定具有优势，若命中则将卓越骰加入伤害。' },
  { id: 'goading-attack', name: '挑衅攻击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；目标感知豁免失败，则在你下回合结束前，对除你以外目标的攻击检定具有劣势。' },
  { id: 'lunging-attack', name: '突刺攻击', summary: '在自己回合进行近战武器攻击时消耗 1 枚卓越骰，使该次攻击的触及范围增加 5 尺；若命中，将卓越骰加入伤害。' },
  { id: 'maneuvering-attack', name: '灵动攻击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；选择能看见或听见你的友方生物，使其立即用反应移动至多其速度一半，且不会引发本次受击目标的借机攻击。' },
  { id: 'menacing-attack', name: '恐吓攻击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；目标感知豁免失败，则对你陷入恐慌，直至你下回合结束。' },
  { id: 'parry', name: '格挡', summary: '其他生物以近战攻击对你造成伤害时，可用反应消耗并掷 1 枚卓越骰，使伤害减少“骰值＋你的敏捷调整值”。' },
  { id: 'precision-attack', name: '精准攻击', summary: '进行武器攻击检定时消耗 1 枚卓越骰并将结果加入攻击检定；可在掷骰前或后决定，但必须在该次攻击的效果生效前。' },
  { id: 'pushing-attack', name: '推撞攻击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；若目标体型为大型或更小，力量豁免失败则被向远离你的方向推动至多 15 尺。' },
  { id: 'rally', name: '重整旗鼓', summary: '在自己回合以附赠动作消耗 1 枚卓越骰，选择能看见或听见你的友方生物；其获得“卓越骰结果＋你的魅力调整值”的临时生命值。' },
  { id: 'riposte', name: '反击', summary: '生物以近战攻击对你未命中时，可用反应消耗 1 枚卓越骰并对其进行一次近战武器攻击；若命中，将卓越骰加入伤害。' },
  { id: 'sweeping-attack', name: '横扫攻击', summary: '近战武器攻击命中时消耗 1 枚卓越骰，选择距原目标 5 尺内且处于你触及范围内的另一生物；若原攻击检定也能命中它，则其受到等于卓越骰结果、且与原攻击同类型的伤害。' },
  { id: 'trip-attack', name: '摔绊攻击', summary: '武器攻击命中时消耗 1 枚卓越骰并将其加入伤害；若目标体型为大型或更小，力量豁免失败则倒地。' },
]

const baseFeatures: readonly FighterFeatureDefinition[] = [
  { id: 'fighting-style', level: 1, name: '战斗风格', description: '选择一种战斗风格；即使以后再次获得选择机会，也不能重复选择同一种风格。', source: 'fighter' },
  { id: 'second-wind', level: 1, name: '回气', description: '用附赠动作恢复 1d10＋战士等级的生命值；完成短休或长休后恢复使用。', source: 'fighter' },
  { id: 'action-surge-1', level: 2, name: '动作如潮（1次）', description: '在自己回合除常规动作和可能的附赠动作外，额外执行一个动作；完成短休或长休后恢复使用。', source: 'fighter' },
  { id: 'martial-archetype', level: 3, name: '武术范型', description: '选择勇士、战斗大师或奥法骑士；所选范型在 3、7、10、15、18 级提供特性。', source: 'fighter' },
  { id: 'asi-4', level: 4, name: '属性值提升', description: '一项属性值提高 2，或两项属性值各提高 1；不能以此将属性值提高至 20 以上。若启用专长可选规则，可改为选择一项专长。', source: 'fighter' },
  { id: 'extra-attack-2', level: 5, name: '额外攻击', description: '在自己回合执行攻击动作时，可攻击两次而非一次。', source: 'fighter' },
  { id: 'asi-6', level: 6, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'archetype-7', level: 7, name: '武术范型特性', description: '获得所选子职的 7 级特性。', source: 'fighter' },
  { id: 'asi-8', level: 8, name: '属性值提升', description: '再次获得属性值提升。', source: 'fighter' },
  { id: 'indomitable-1', level: 9, name: '不屈（1次）', description: '重骰一次失败的豁免并采用新结果；长休后恢复使用。', source: 'fighter' },
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

const subclassFeatures: Record<FighterSubclassId, readonly FighterFeatureDefinition[]> = {
  champion: [
    { id: 'champion-improved-critical', level: 3, name: '精通重击', description: '武器攻击的 d20 自然掷出 19 或 20 时造成重击。', source: 'champion' },
    { id: 'champion-remarkable-athlete', level: 7, name: '运动健将', description: '未加入熟练加值的力量、敏捷或体质检定，可加入一半熟练加值（向上取整）；进行助跑跳远时，跳跃距离额外增加等于力量调整值的尺数。', source: 'champion' },
    { id: 'champion-additional-style', level: 10, name: '额外战斗风格', description: '从战斗风格中选择第二种不同的风格，不能与已有风格重复。', source: 'champion' },
    { id: 'champion-superior-critical', level: 15, name: '卓越重击', description: '武器攻击的 d20 自然掷出 18、19 或 20 时造成重击。', source: 'champion' },
    { id: 'champion-survivor', level: 18, name: '生存者', description: '回合开始时，若生命值不高于上限一半且不为 0，恢复 5＋体质调整值生命值。', source: 'champion' },
  ],
  'battle-master': [
    { id: 'battle-master-superiority', level: 3, name: '卓越战技', description: '学会 3 项战技并获得 4 枚 d8 卓越骰；每次攻击只能应用一项战技，消耗的卓越骰在完成短休或长休后全部恢复。战技豁免 DC＝8＋熟练加值＋自选的力量或敏捷调整值。7、10、15 级各学会 2 项新战技，并可在每次学会新战技时替换 1 项已知战技；卓越骰在 7、15 级各增加 1 枚。', source: 'battle-master' },
    { id: 'battle-master-student-of-war', level: 3, name: '战争学徒', description: '获得一种自选工匠工具的熟练。', source: 'battle-master' },
    { id: 'battle-master-know-your-enemy', level: 7, name: '知己知彼', description: '在战斗外观察一个生物或与其互动至少 1 分钟后，从力量、敏捷、体质、护甲等级、当前生命值、总职业等级和战士等级中选择两项；DM 告知你在所选项目上强于、弱于或相当于该生物。', source: 'battle-master' },
    { id: 'battle-master-improved-superiority-10', level: 10, name: '精通卓越战技（d10）', description: '你的卓越骰变为 d10。', source: 'battle-master' },
    { id: 'battle-master-relentless', level: 15, name: '坚韧', description: '投掷先攻时若没有可用的卓越骰，则获得 1 枚卓越骰。', source: 'battle-master' },
    { id: 'battle-master-improved-superiority-18', level: 18, name: '精通卓越战技（d12）', description: '你的卓越骰变为 d12。', source: 'battle-master' },
  ],
  'eldritch-knight': [
    { id: 'eldritch-knight-spellcasting', level: 3, name: '施法', description: '使用智力施展法师法术。3 级学会 2 个法师戏法和 3 个 1 环法师法术，其中 2 个必须属于防护或塑能学派；法术位、戏法和已知法术按奥法骑士进度成长，通常新增法术须来自防护或塑能学派，但 3 级的另 1 个以及 8、14、20 级新增的法术可来自任意学派。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-weapon-bond', level: 3, name: '武器联结', description: '以 1 小时仪式与一把武器建立联结，可同时联结至多两把。未陷入失能时不会被解除联结武器；若武器与你在同一位面，可用附赠动作将其中一把传送到手中。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-war-magic', level: 7, name: '战争魔法', description: '用动作施展戏法后，可用附赠动作进行一次武器攻击。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-eldritch-strike', level: 10, name: '奥法打击', description: '武器攻击命中生物后，该生物对你在下回合结束前施展的法术所进行的下一次豁免具有劣势。', source: 'eldritch-knight' },
    { id: 'eldritch-knight-arcane-charge', level: 15, name: '奥术冲锋', description: '使用动作如潮时，可在额外动作之前或之后传送至多 30 尺，到达一个你能看见且未被占据的空间。', source: 'eldritch-knight' },
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
