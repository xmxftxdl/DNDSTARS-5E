export type FighterSubclassId = 'champion' | 'battle-master' | 'eldritch-knight'

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
