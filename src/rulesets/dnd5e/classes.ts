import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'
import { dnd5eEquippedEffectTotal } from './equipmentEffects'
import { dnd5eActiveSpeedBonus, dnd5eActiveSpeedPenalty } from './activeEffects'
import { fighterProgression, fighterRemarkableAthleteRunningLongJumpBonus } from './fighter'
import {
  registeredDeclarativeClassDefinitionV1,
  registeredDeclarativeClassesV1,
} from './declarativeClass'

export type Dnd5eClassId =
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'fighter'
  | 'monk'
  | 'paladin'
  | 'ranger'
  | 'rogue'
  | 'sorcerer'
  | 'warlock'
  | 'wizard'

export type Dnd5eSpellcastingKind =
  | 'full-known'
  | 'full-prepared'
  | 'half-known'
  | 'half-prepared'
  | 'one-third-known'
  | 'pact'

export interface Dnd5eClassFeatureDefinition {
  id: string
  level: number
  name: string
  description: string
  source: 'class' | 'subclass'
}

export interface Dnd5eClassChoiceOption {
  id: string
  name: string
  summary: string
  minimumClassLevel?: number
  requiresPactBoon?: 'blade' | 'chain' | 'tome'
  requiresKnownSpell?: string
}

export interface Dnd5eClassChoiceGroup {
  id: string
  level: number
  name: string
  description?: string
  maxSelections: number | ((level: number) => number)
  options: readonly Dnd5eClassChoiceOption[]
}

export interface Dnd5eSubclassDefinition {
  id: string
  name: string
  summary: string
  features: readonly Dnd5eClassFeatureDefinition[]
  choiceGroups?: readonly Dnd5eClassChoiceGroup[]
  spellLists?: readonly Dnd5eSubclassSpellList[]
}

export interface Dnd5eSubclassSpellList {
  id: string
  name: string
  mode: 'always-prepared' | 'expanded-list'
  /** 对应子职选择项，例如大地结社地域。 */
  choiceOptionId?: string
  entries: readonly { classLevel: number; spells: readonly string[] }[]
}

export interface Dnd5eSpellcastingDefinition {
  kind: Dnd5eSpellcastingKind
  ability: AbilityKey
  ritualCasting: boolean
  focus: string
  cantripsKnown?: readonly number[]
  spellsKnown?: readonly number[]
}

export interface Dnd5eClassDefinition {
  id: Dnd5eClassId
  name: string
  hitDie: 6 | 8 | 10 | 12
  primaryAbilities: readonly AbilityKey[]
  savingThrows: readonly [AbilityKey, AbilityKey]
  armorProficiencies: string
  weaponProficiencies: string
  skillChoiceCount: number
  /** 可用于本职业起始技能选择的技能 key；吟游诗人使用 "any"。 */
  skillProficiencies: readonly string[] | 'any'
  subclassLevel: number
  subclass: Dnd5eSubclassDefinition
  features: readonly Dnd5eClassFeatureDefinition[]
  choiceGroups?: readonly Dnd5eClassChoiceGroup[]
  spellcasting?: Dnd5eSpellcastingDefinition
}

export interface Dnd5eClassProgressionLevel {
  level: number
  proficiencyBonus: number
  features: readonly Dnd5eClassFeatureDefinition[]
  spellSlots: readonly number[]
  pactSlotLevel?: number
  cantripsKnown?: number
  spellsKnown?: number
}

const asiDescription = '将一项自选属性值提高 2，或将两项各提高 1；不能借此超过 20。'
const f = (id: string, level: number, name: string, description: string): Dnd5eClassFeatureDefinition => ({ id, level, name, description, source: 'class' })
const s = (id: string, level: number, name: string, description: string): Dnd5eClassFeatureDefinition => ({ id, level, name, description, source: 'subclass' })
const asi = (level: number) => f(`asi-${level}`, level, '属性值提升', asiDescription)

const FULL_CASTER_SLOTS: readonly (readonly number[])[] = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
]

const HALF_CASTER_SLOTS: readonly (readonly number[])[] = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2],
  [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2],
  [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
]

const BARD_CANTRIPS = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
const BARD_SPELLS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22]
const CLERIC_CANTRIPS = [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
const DRUID_CANTRIPS = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
const RANGER_SPELLS = [0, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11]
const SORCERER_CANTRIPS = [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6]
const SORCERER_SPELLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15]
const WARLOCK_CANTRIPS = [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]
const WARLOCK_SPELLS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
const WIZARD_CANTRIPS = [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]

const FIGHTING_STYLE_PALADIN: Dnd5eClassChoiceGroup = {
  id: 'fighting-style', level: 2, name: '战斗风格', maxSelections: 1,
  options: [
    { id: 'defense', name: '防御', summary: '穿着护甲时，AC +1。' },
    { id: 'dueling', name: '决斗', summary: '单手持近战武器且未持其他武器时，伤害 +2。' },
    { id: 'great-weapon-fighting', name: '巨武器战斗', summary: '双手或两用近战武器伤害骰掷出 1 或 2 时可重掷一次。' },
    { id: 'protection', name: '防护', summary: '持盾时可用反应使对 5 尺内盟友的攻击具有劣势。' },
  ],
}

const FIGHTING_STYLE_RANGER: Dnd5eClassChoiceGroup = {
  id: 'fighting-style', level: 2, name: '战斗风格', maxSelections: 1,
  options: [
    { id: 'archery', name: '箭术', summary: '使用远程武器的攻击检定 +2。' },
    { id: 'defense', name: '防御', summary: '穿着护甲时，AC +1。' },
    { id: 'dueling', name: '决斗', summary: '单手持近战武器且未持其他武器时，伤害 +2。' },
    { id: 'two-weapon-fighting', name: '双武器战斗', summary: '第二把武器的伤害可加入属性调整值。' },
  ],
}

const BERSERKER: Dnd5eSubclassDefinition = {
  id: 'berserker', name: '狂战士道途', summary: '以不受控制的狂怒投入战斗。',
  features: [
    s('berserker-frenzy', 3, '狂乱', '进入狂暴时可选择狂乱；狂暴期间每回合可用附赠动作进行一次近战武器攻击，狂暴结束时获得一级力竭。'),
    s('berserker-mindless-rage', 6, '无心狂暴', '狂暴期间免疫魅惑与恐慌；进入狂暴时暂停已有的这些效果。'),
    s('berserker-intimidating-presence', 10, '威吓姿态', '用动作迫使 30 尺内可见生物进行感知豁免，失败则恐慌；后续可用动作延长。'),
    s('berserker-retaliation', 14, '报复', '5 尺内生物对你造成伤害时，可用反应对其进行一次近战武器攻击。'),
  ],
}

const LORE: Dnd5eSubclassDefinition = {
  id: 'lore', name: '逸闻学院', summary: '广泛收集知识，并以言语和才艺扰乱敌人。',
  choiceGroups: [{
    id: 'lore-bonus-skills', level: 3, name: '额外熟练', maxSelections: 3,
    description: '选择任意三项技能，获得这些技能的熟练。',
    options: [
      ['acrobatics', '杂技'], ['animalHandling', '驯兽'], ['arcana', '奥秘'], ['athletics', '运动'],
      ['deception', '欺瞒'], ['history', '历史'], ['insight', '洞悉'], ['intimidation', '威吓'],
      ['investigation', '调查'], ['medicine', '医药'], ['nature', '自然'], ['perception', '察觉'],
      ['performance', '表演'], ['persuasion', '游说'], ['religion', '宗教'], ['sleightOfHand', '巧手'],
      ['stealth', '隐匿'], ['survival', '生存'],
    ].map(([id, name]) => ({ id, name, summary: '逸闻学院3级额外技能熟练。' })),
  }],
  features: [
    s('lore-bonus-proficiencies', 3, '额外熟练', '获得任意三项技能熟练。'),
    s('lore-cutting-words', 3, '尖刻言辞', '可用反应消耗一枚诗人激励骰，降低可见生物的攻击、属性检定或伤害掷骰。'),
    s('lore-additional-magical-secrets', 6, '额外魔法奥秘', '从任意职业法术表选择两个法术，视为吟游诗人法术且不计入已知法术数量。'),
    s('lore-peerless-skill', 14, '无双技艺', '进行属性检定时，可消耗一枚诗人激励骰并将结果加入检定。'),
  ],
}

const LIFE: Dnd5eSubclassDefinition = {
  id: 'life', name: '生命领域', summary: '专注于维系生命与强化治疗法术。',
  spellLists: [{ id: 'life-domain', name: '生命领域法术', mode: 'always-prepared', entries: [
    { classLevel: 1, spells: ['祝福术', '疗伤术'] },
    { classLevel: 3, spells: ['次级复原术', '灵体武器'] },
    { classLevel: 5, spells: ['希望信标', '回生术'] },
    { classLevel: 7, spells: ['防死结界', '信仰守卫'] },
    { classLevel: 9, spells: ['群体疗伤术', '死者复活'] },
  ] }],
  features: [
    s('life-domain-spells', 1, '领域法术', '按牧师等级获得始终准备且不占准备数量的生命领域法术。'),
    s('life-bonus-proficiency', 1, '额外熟练', '获得重甲熟练。'),
    s('life-disciple-of-life', 1, '生命门徒', '用 1 环或更高法术恢复生命时，额外恢复 2＋法术环级。'),
    s('life-preserve-life', 2, '引导神力：维持生命', '用动作分配等于牧师等级五倍的治疗量；不能把目标恢复到生命上限一半以上。'),
    s('life-blessed-healer', 6, '受佑医者', '用 1 环或更高法术治疗他人时，自身恢复 2＋法术环级。'),
    s('life-divine-strike', 8, '神圣打击', '每回合一次，武器命中时额外造成 1d8 光耀伤害；14级提高为 2d8。'),
    s('life-supreme-healing', 17, '至高治疗', '治疗法术的治疗骰直接取最大值。'),
  ],
}

const LAND_TERRAINS: readonly Dnd5eClassChoiceOption[] = [
  { id: 'arctic', name: '极地', summary: '获得极地环法术。' },
  { id: 'coast', name: '海岸', summary: '获得海岸环法术。' },
  { id: 'desert', name: '沙漠', summary: '获得沙漠环法术。' },
  { id: 'forest', name: '森林', summary: '获得森林环法术。' },
  { id: 'grassland', name: '草原', summary: '获得草原环法术。' },
  { id: 'mountain', name: '山地', summary: '获得山地环法术。' },
  { id: 'swamp', name: '沼泽', summary: '获得沼泽环法术。' },
  { id: 'underdark', name: '幽暗地域', summary: '获得幽暗地域环法术。' },
]

const LAND: Dnd5eSubclassDefinition = {
  id: 'land', name: '大地结社', summary: '与特定地域的自然魔力相连。',
  choiceGroups: [{ id: 'land-terrain', level: 2, name: '地域', maxSelections: 1, options: LAND_TERRAINS }],
  spellLists: [
    ['arctic', '极地', [['人类定身术', '荆棘丛生'], ['雪雨暴', '缓慢术'], ['行动自如', '冰风暴'], ['问道自然', '寒冰锥']]],
    ['coast', '海岸', [['镜影术', '迷踪步'], ['水下呼吸', '水上行走'], ['操控水体', '行动自如'], ['召唤元素', '探知']]],
    ['desert', '沙漠', [['朦胧术', '沉默术'], ['造粮术', '防护能量'], ['枯萎术', '幻景'], ['疫病虫群', '石墙术']]],
    ['forest', '森林', [['树肤术', '蛛行术'], ['召雷术', '植物滋长'], ['预言术', '行动自如'], ['问道自然', '树跃术']]],
    ['grassland', '草原', [['隐形术', '行踪无迹'], ['昼明术', '加速术'], ['预言术', '行动自如'], ['梦境术', '疫病虫群']]],
    ['mountain', '山地', [['蛛行术', '荆棘丛生'], ['闪电束', '融身入石'], ['塑石术', '石肤术'], ['穿墙术', '石墙术']]],
    ['swamp', '沼泽', [['黑暗术', '强酸箭'], ['水上行走', '臭云术'], ['行动自如', '生物定位术'], ['疫病虫群', '探知']]],
    ['underdark', '幽暗地域', [['蛛行术', '蛛网术'], ['气化形体', '臭云术'], ['高等隐形术', '塑石术'], ['死云术', '疫病虫群']]],
  ].map(([id, name, rows]) => ({
    id: `land-${id}`,
    name: `${name}结社法术`,
    mode: 'always-prepared' as const,
    choiceOptionId: id as string,
    entries: (rows as string[][]).map((spells, index) => ({ classLevel: 3 + index * 2, spells })),
  })),
  features: [
    s('land-bonus-cantrip', 2, '额外戏法', '额外学会一个德鲁伊戏法。'),
    s('land-natural-recovery', 2, '自然恢复', '每天一次，在短休后恢复合计环级不超过德鲁伊等级一半（向上取整）的法术位，且不能恢复 6 环以上法术位。'),
    s('land-circle-spells', 3, '结社法术', '依所选地域在3、5、7、9级获得始终准备的结社法术。'),
    s('land-stride', 6, '大地行者', '穿过非魔法困难地形不消耗额外移动，并对魔法植物造成的阻碍具有优势。'),
    s('land-natures-ward', 10, '自然结界', '免疫毒素与疾病，且不能被元素或妖精生物魅惑或恐慌。'),
    s('land-natures-sanctuary', 14, '自然庇护', '野兽或植物生物攻击你时须先通过感知豁免，失败则必须改选目标或攻击落空。'),
  ],
}

const OPEN_HAND: Dnd5eSubclassDefinition = {
  id: 'open-hand', name: '散打宗', summary: '精通徒手格斗与气的攻防运用。',
  features: [
    s('open-hand-technique', 3, '散打技法', '疾风连击命中时，可使目标倒地、推开至多15尺，或令其直到你下一回合结束前不能进行反应。'),
    s('open-hand-wholeness', 6, '身心合一', '用动作恢复等于武僧等级三倍的生命值；每次长休一次。'),
    s('open-hand-tranquility', 11, '宁静心境', '长休结束后获得庇护术效果，持续至下一次长休或主动攻击。'),
    s('open-hand-quivering-palm', 17, '渗透劲', '命中时消耗3点气设置持续震动；之后可用动作迫使其体质豁免，失败降至0 HP，成功受10d10黯蚀伤害。'),
  ],
}

const DEVOTION: Dnd5eSubclassDefinition = {
  id: 'devotion', name: '奉献之誓', summary: '坚守诚实、勇气、同情、荣誉与责任。',
  spellLists: [{ id: 'devotion-oath', name: '奉献誓言法术', mode: 'always-prepared', entries: [
    { classLevel: 3, spells: ['防护善恶', '庇护术'] },
    { classLevel: 5, spells: ['次级复原术', '诚实之域'] },
    { classLevel: 9, spells: ['希望信标', '解除魔法'] },
    { classLevel: 13, spells: ['行动自如', '信仰守卫'] },
    { classLevel: 17, spells: ['通神术', '焰击术'] },
  ] }],
  features: [
    s('devotion-oath-spells', 3, '誓言法术', '按圣武士等级获得始终准备且不占准备数量的誓言法术。'),
    s('devotion-sacred-weapon', 3, '引导神力：神圣武器', '用动作使一把武器持续1分钟发光；攻击检定加入魅力调整值，且武器视为魔法武器。'),
    s('devotion-turn-unholy', 3, '引导神力：驱散亵渎', '用动作迫使30尺内可见邪魔与亡灵进行感知豁免，失败者被驱散1分钟。'),
    s('devotion-aura', 7, '奉献灵光', '自身及10尺内友军免疫魅惑；18级范围扩大至30尺。'),
    s('devotion-purity', 15, '纯净灵魂', '始终处于防护善恶法术效果下。'),
    s('devotion-holy-nimbus', 20, '神圣光轮', '用动作散发持续1分钟的30尺光辉：敌人在回合开始受到10点光耀伤害，且你对邪魔与亡灵法术豁免具有优势。'),
  ],
}

const HUNTER: Dnd5eSubclassDefinition = {
  id: 'hunter', name: '猎人', summary: '运用专门战术对抗巨兽、群敌和危险捕食者。',
  choiceGroups: [
    { id: 'hunters-prey', level: 3, name: '猎人猎物', maxSelections: 1, options: [
      { id: 'colossus-slayer', name: '巨像杀手', summary: '每回合一次，对生命未满目标命中时额外造成1d8伤害。' },
      { id: 'giant-killer', name: '巨人杀手', summary: '大型或更大生物在5尺内攻击你时，可用反应攻击它。' },
      { id: 'horde-breaker', name: '灭群者', summary: '每回合一次，可额外攻击原目标5尺内的另一生物。' },
    ] },
    { id: 'defensive-tactics', level: 7, name: '防御战术', maxSelections: 1, options: [
      { id: 'escape-the-horde', name: '逃离群攻', summary: '针对你的借机攻击具有劣势。' },
      { id: 'multiattack-defense', name: '多重攻击防御', summary: '同一生物命中你后，本回合后续对你的攻击使AC +4。' },
      { id: 'steel-will', name: '钢铁意志', summary: '对抗恐慌的豁免具有优势。' },
    ] },
    { id: 'multiattack', level: 11, name: '多重攻击', maxSelections: 1, options: [
      { id: 'volley', name: '万箭齐发', summary: '用动作对武器射程内一点10尺范围中的任意数量生物各进行一次远程攻击。' },
      { id: 'whirlwind-attack', name: '旋风攻击', summary: '用动作对5尺内任意数量生物各进行一次近战攻击。' },
    ] },
    { id: 'superior-hunters-defense', level: 15, name: '高级猎人防御', maxSelections: 1, options: [
      { id: 'evasion', name: '反射闪避', summary: '敏捷豁免成功不受伤，失败只受一半伤害。' },
      { id: 'stand-against-tide', name: '逆流反击', summary: '敌对生物近战攻击未命中你时，可用反应使其改攻另一生物。' },
      { id: 'uncanny-dodge', name: '直觉闪避', summary: '可用反应将一次可见攻击造成的伤害减半。' },
    ] },
  ],
  features: [
    s('hunter-prey-feature', 3, '猎人猎物', '选择巨像杀手、巨人杀手或灭群者。'),
    s('hunter-defensive-tactics-feature', 7, '防御战术', '选择逃离群攻、多重攻击防御或钢铁意志。'),
    s('hunter-multiattack-feature', 11, '多重攻击', '选择万箭齐发或旋风攻击。'),
    s('hunter-superior-defense-feature', 15, '高级猎人防御', '选择反射闪避、逆流反击或直觉闪避。'),
  ],
}

const THIEF: Dnd5eSubclassDefinition = {
  id: 'thief', name: '盗贼', summary: '专精潜入、攀爬和灵巧使用物品。',
  features: [
    s('thief-fast-hands', 3, '快手', '可用巧妙动作的附赠动作进行敏捷（巧手）检定、使用盗贼工具解除陷阱或开锁，或执行使用物品动作。'),
    s('thief-second-story-work', 3, '飞檐走壁', '攀爬不再消耗额外移动；助跑跳跃距离增加等于敏捷调整值的尺数。'),
    s('thief-supreme-sneak', 9, '高超潜行', '若本回合移动不超过速度一半，敏捷（隐匿）检定具有优势。'),
    s('thief-use-magic-device', 13, '使用魔法装置', '使用魔法物品时忽略职业、种族和等级要求。'),
    s('thief-reflexes', 17, '盗贼反射', '每场战斗首轮可进行两个回合；第二回合在先攻值减10时进行。'),
  ],
}

const DRACONIC_ANCESTRY: Dnd5eClassChoiceGroup = {
  id: 'dragon-ancestor', level: 1, name: '龙族先祖', maxSelections: 1,
  options: [
    { id: 'black-acid', name: '黑龙／强酸', summary: '关联强酸伤害。' }, { id: 'blue-lightning', name: '蓝龙／闪电', summary: '关联闪电伤害。' },
    { id: 'brass-fire', name: '黄铜龙／火焰', summary: '关联火焰伤害。' }, { id: 'bronze-lightning', name: '青铜龙／闪电', summary: '关联闪电伤害。' },
    { id: 'copper-acid', name: '赤铜龙／强酸', summary: '关联强酸伤害。' }, { id: 'gold-fire', name: '金龙／火焰', summary: '关联火焰伤害。' },
    { id: 'green-poison', name: '绿龙／毒素', summary: '关联毒素伤害。' }, { id: 'red-fire', name: '红龙／火焰', summary: '关联火焰伤害。' },
    { id: 'silver-cold', name: '银龙／寒冷', summary: '关联寒冷伤害。' }, { id: 'white-cold', name: '白龙／寒冷', summary: '关联寒冷伤害。' },
  ],
}

const DRACONIC: Dnd5eSubclassDefinition = {
  id: 'draconic', name: '龙族血脉', summary: '魔力源于龙族血脉或与龙类相关的古老力量。',
  choiceGroups: [DRACONIC_ANCESTRY],
  features: [
    s('draconic-ancestor', 1, '龙族先祖', '选择一种龙族与其关联伤害类型；与龙类互动的魅力检定可将熟练加值翻倍。'),
    s('draconic-resilience', 1, '龙族韧性', '每个术士等级令生命上限额外 +1；未穿护甲时AC为13＋敏捷调整值。'),
    s('draconic-elemental-affinity', 6, '元素亲和', '施放造成关联伤害的法术时，可将魅力调整值加入一次伤害；可消耗1术法点获得该伤害抗性1小时。'),
    s('draconic-wings', 14, '龙翼', '可用附赠动作长出或收回龙翼，获得等同当前速度的飞行速度；部分护甲会妨碍使用。'),
    s('draconic-presence', 18, '龙威', '用动作消耗5术法点产生60尺敬畏或恐慌灵光，维持专注至多1分钟。'),
  ],
}

const FIEND: Dnd5eSubclassDefinition = {
  id: 'fiend', name: '邪魔宗主', summary: '与来自下层位面的邪魔缔结契约。',
  choiceGroups: [{
    id: 'fiendish-resilience', level: 10, name: '邪魔韧性', maxSelections: 1,
    description: '完成短休或长休后选择一种伤害类型；再次选择前获得该类型抗性。来自魔法武器或银质武器的物理伤害会绕过相应抗性。',
    options: [
      ['acid', '强酸'], ['bludgeoning', '钝击'], ['cold', '寒冷'], ['fire', '火焰'], ['force', '力场'],
      ['lightning', '闪电'], ['necrotic', '黯蚀'], ['piercing', '穿刺'], ['poison', '毒素'],
      ['psychic', '心灵'], ['radiant', '光耀'], ['slashing', '挥砍'], ['thunder', '雷鸣'],
    ].map(([id, name]) => ({ id, name, summary: `获得${name}伤害抗性。` })),
  }],
  spellLists: [{ id: 'fiend-expanded', name: '邪魔扩展法术', mode: 'expanded-list', entries: [
    { classLevel: 1, spells: ['燃烧之手', '命令术'] },
    { classLevel: 3, spells: ['目盲术／耳聋术', '灼热射线'] },
    { classLevel: 5, spells: ['火球术', '臭云术'] },
    { classLevel: 7, spells: ['火焰护盾', '火墙术'] },
    { classLevel: 9, spells: ['焰击术', '圣居'] },
  ] }],
  features: [
    s('fiend-expanded-spells', 1, '扩展法术列表', '邪魔宗主法术加入可供选择的邪术师法术列表。'),
    s('fiend-dark-ones-blessing', 1, '黑暗赐福', '将敌对生物降至0 HP时，获得魅力调整值＋邪术师等级的临时生命值。'),
    s('fiend-dark-ones-own-luck', 6, '黑暗之主的幸运', '进行属性检定或豁免时可额外加入1d10；每次短休或长休一次。'),
    s('fiendish-resilience', 10, '邪魔韧性', '短休或长休后选择一种伤害类型并获得抗性，直到重新选择；魔法武器或银质武器可绕过特定物理抗性。'),
    s('fiend-hurl-through-hell', 14, '坠入地狱', '每次命中可将目标送过下层位面；其在你下一回合结束时返回并受到10d10心灵伤害。每次长休一次。'),
  ],
}

const EVOCATION: Dnd5eSubclassDefinition = {
  id: 'evocation', name: '塑能学派', summary: '专精操控能量与塑造强力塑能法术。',
  features: [
    s('evocation-savant', 2, '塑能学者', '将塑能法术抄入法术书所需金币和时间减半。'),
    s('evocation-sculpt-spells', 2, '法术塑形', '施放影响其他可见生物的塑能法术时，可保护至多1＋法术环级名生物；其豁免自动成功且成功减半时不受伤害。'),
    s('evocation-potent-cantrip', 6, '强力戏法', '生物对伤害戏法豁免成功时仍承受一半伤害，但不受其他效果。'),
    s('evocation-empowered', 10, '强化塑能', '将智力调整值加入一次法师塑能法术的伤害掷骰。'),
    s('evocation-overchannel', 14, '超限导能', '施放1至5环伤害法术时可令伤害骰取最大；再次使用会承受递增且不可减免的黯蚀伤害。'),
  ],
}

const BARBARIAN_FEATURES = [
  f('rage', 1, '狂暴', '用附赠动作进入狂暴：力量检定与力量豁免具有优势，力量近战攻击获得狂暴伤害加值，并获得钝击、穿刺和挥砍抗性；持续1分钟。'),
  f('unarmored-defense', 1, '无甲防御', '未穿护甲时AC等于10＋敏捷调整值＋体质调整值；仍可使用盾牌。'),
  f('reckless-attack', 2, '鲁莽攻击', '回合中第一次用力量发动近战武器攻击时可获得本回合力量近战攻击优势，但直到下一回合前针对你的攻击也具有优势。'),
  f('danger-sense', 2, '危险感知', '对可见效果进行敏捷豁免时具有优势；不能处于目盲、耳聋或失能。'),
  f('primal-path', 3, '原始道途', '选择狂战士道途。'), asi(4),
  f('extra-attack', 5, '额外攻击', '执行攻击动作时可攻击两次。'),
  f('fast-movement', 5, '快速移动', '未穿重甲时速度提高10尺。'),
  f('feral-instinct', 7, '野性直觉', '先攻检定具有优势；受突袭时可通过立即进入狂暴来正常行动。'), asi(8),
  f('brutal-critical-1', 9, '凶蛮重击（1骰）', '近战武器重击时额外掷一枚武器伤害骰。'),
  f('relentless-rage', 11, '坚韧狂暴', '狂暴中降至0 HP且未立即死亡时，可进行DC10体质豁免，成功则改为1 HP；每次后续使用DC提高5，短休或长休后重置。'),
  asi(12), f('brutal-critical-2', 13, '凶蛮重击（2骰）', '凶蛮重击的额外武器伤害骰增加为两枚。'),
  asi(16), f('brutal-critical-3', 17, '凶蛮重击（3骰）', '凶蛮重击的额外武器伤害骰增加为三枚。'),
  f('indomitable-might', 18, '不屈力量', '力量检定总值若低于力量属性值，可改用力量属性值。'), asi(19),
  f('primal-champion', 20, '原始斗士', '力量与体质各提高4，且上限提高至24。'),
]

const BARD_FEATURES = [
  f('spellcasting', 1, '施法', '以魅力作为施法属性，使用吟游诗人法术表与已知法术机制。'),
  f('bardic-inspiration', 1, '诗人激励（d6）', '用附赠动作给予60尺内听得到你的生物一枚激励骰；10分钟内可将其加入一次属性检定、攻击或豁免。'),
  f('jack-of-all-trades', 2, '万事通', '未加入熟练加值的属性检定可加入一半熟练加值（向下取整）。'),
  f('song-of-rest-6', 2, '休憩曲（d6）', '短休中自身或盟友花费生命骰恢复时额外恢复1d6。'),
  f('bard-college', 3, '诗人学院', '选择逸闻学院。'), f('expertise-1', 3, '专精', '选择两项技能熟练，使其熟练加值翻倍。'), asi(4),
  f('bardic-inspiration-8', 5, '诗人激励（d8）', '激励骰提高为d8。'), f('font-of-inspiration', 5, '激励之源', '诗人激励使用次数在短休或长休后恢复。'),
  f('countercharm', 6, '反魅惑', '用动作开始演奏，直到下一回合结束；30尺内友军对抗恐慌或魅惑的豁免具有优势。'),
  asi(8), f('song-of-rest-8', 9, '休憩曲（d8）', '休憩曲提高为d8。'),
  f('bardic-inspiration-10', 10, '诗人激励（d10）', '激励骰提高为d10。'), f('expertise-2', 10, '专精（另两项）', '再选择两项技能熟练，使其熟练加值翻倍。'),
  f('magical-secrets-10', 10, '魔法奥秘', '从任意职业法术表选择两个法术，视为吟游诗人法术。'), asi(12),
  f('song-of-rest-10', 13, '休憩曲（d10）', '休憩曲提高为d10。'), f('magical-secrets-14', 14, '魔法奥秘', '再选择两个任意职业法术。'),
  f('bardic-inspiration-12', 15, '诗人激励（d12）', '激励骰提高为d12。'), asi(16),
  f('song-of-rest-12', 17, '休憩曲（d12）', '休憩曲提高为d12。'), f('magical-secrets-18', 18, '魔法奥秘', '再选择两个任意职业法术。'), asi(19),
  f('superior-inspiration', 20, '高等激励', '投先攻时若没有诗人激励次数，恢复一次。'),
]

const CLERIC_FEATURES = [
  f('spellcasting', 1, '施法', '以感知作为施法属性；每天从牧师法术表准备感知调整值＋牧师等级个法术（至少1个）。'),
  f('divine-domain', 1, '神圣领域', '选择生命领域。'),
  f('channel-divinity-1', 2, '引导神力（1次）', '获得驱散亡灵与领域引导神力；短休或长休后恢复。'),
  f('turn-undead', 2, '驱散亡灵', '用动作展示圣徽，使30尺内亡灵进行感知豁免；失败者被驱散1分钟。'), asi(4),
  f('destroy-undead-half', 5, '摧毁亡灵（CR 1/2）', '驱散亡灵失败且挑战等级不高于1/2时立即被摧毁。'),
  f('channel-divinity-2', 6, '引导神力（2次）', '每次短休或长休之间可使用两次引导神力。'), asi(8),
  f('destroy-undead-1', 8, '摧毁亡灵（CR 1）', '摧毁亡灵上限提高至CR 1。'),
  f('divine-intervention', 10, '神圣干预', '用动作请求神明援助；百分骰不高于牧师等级时成功，成功后7天内不能再次使用。'),
  f('destroy-undead-2', 11, '摧毁亡灵（CR 2）', '摧毁亡灵上限提高至CR 2。'), asi(12),
  f('destroy-undead-3', 14, '摧毁亡灵（CR 3）', '摧毁亡灵上限提高至CR 3。'), asi(16),
  f('destroy-undead-4', 17, '摧毁亡灵（CR 4）', '摧毁亡灵上限提高至CR 4。'),
  f('channel-divinity-3', 18, '引导神力（3次）', '每次短休或长休之间可使用三次引导神力。'), asi(19),
  f('divine-intervention-improved', 20, '神圣干预改进', '神圣干预自动成功，无需投骰。'),
]

const DRUID_FEATURES = [
  f('druidic', 1, '德鲁伊语', '掌握德鲁伊之间的秘密语言，可用其留下隐藏信息。'),
  f('spellcasting', 1, '施法', '以感知作为施法属性；每天从德鲁伊法术表准备感知调整值＋德鲁伊等级个法术（至少1个）。'),
  f('wild-shape', 2, '荒野变形', '用动作变成见过的野兽；每次短休或长休恢复两次使用。'),
  f('druid-circle', 2, '德鲁伊结社', '选择大地结社。'), asi(4),
  f('wild-shape-4', 4, '荒野变形提升（CR 1/2）', '可变形成CR 1/2以内且没有飞行速度的野兽。'),
  f('wild-shape-8', 8, '荒野变形提升（CR 1）', '可变形成CR 1以内的野兽，不再受飞行速度限制。'), asi(8), asi(12), asi(16),
  f('timeless-body', 18, '不老身躯', '每经过10年，身体只衰老1年，且不能被魔法老化。'),
  f('beast-spells', 18, '野兽施法', '荒野变形时可完成德鲁伊法术的言语和姿势成分。'), asi(19),
  f('archdruid', 20, '大德鲁伊', '可无限次使用荒野变形，并可在变形时忽略多数法术成分。'),
]

const MONK_FEATURES = [
  f('unarmored-defense', 1, '无甲防御', '未穿护甲且未持盾时，AC等于10＋敏捷调整值＋感知调整值。'),
  f('martial-arts', 1, '武艺', '使用武僧武器或徒手攻击且未穿护甲/持盾时，可用敏捷，并获得武艺骰与附赠动作徒手攻击。'),
  f('ki', 2, '气', '气点等于武僧等级；短休或长休后恢复，可发动疾风连击、耐心防御与踏风步。'),
  f('unarmored-movement', 2, '无甲移动', '未穿护甲且未持盾时速度提高；随等级增长。'),
  f('monastic-tradition', 3, '武僧传统', '选择散打宗。'), f('deflect-missiles', 3, '拨挡飞矢', '受到远程武器攻击时可用反应减伤；减至0时可消耗1气掷回。'),
  asi(4), f('slow-fall', 4, '轻身坠', '坠落时可用反应令伤害减少武僧等级五倍。'),
  f('extra-attack', 5, '额外攻击', '执行攻击动作时可攻击两次。'), f('stunning-strike', 5, '震慑拳', '近战武器命中时消耗1气，迫使目标体质豁免；失败则震慑至下一回合结束。'),
  f('ki-empowered-strikes', 6, '真气驻拳', '徒手攻击视为魔法攻击，以克服非魔法攻击抗性与免疫。'),
  f('evasion', 7, '反射闪避', '敏捷豁免成功不受伤，失败只受一半伤害。'), f('stillness-of-mind', 7, '心如止水', '可用动作结束自身一个魅惑或恐慌效果。'),
  asi(8), f('unarmored-movement-9', 9, '无甲移动改进', '回合中可沿垂直表面和液体移动而不坠落。'),
  f('purity-of-body', 10, '百病不侵', '免疫疾病与毒素。'), asi(12),
  f('tongue-of-sun-and-moon', 13, '日月语', '能理解所有口语，且任何懂语言的生物都能理解你。'),
  f('diamond-soul', 14, '金刚魂', '获得所有豁免熟练；豁免失败时可消耗1气重掷并采用新结果。'),
  f('timeless-body', 15, '不老身躯', '不再承受衰老带来的虚弱，且无需食物和水。'), asi(16),
  f('empty-body', 18, '空灵体', '用动作消耗4气隐形1分钟并获得除力场外所有伤害抗性；也可消耗8气施放星界投影。'), asi(19),
  f('perfect-self', 20, '超凡入圣', '投先攻时若没有气点，恢复4点气。'),
]

const PALADIN_FEATURES = [
  f('divine-sense', 1, '神圣感知', '用动作感知60尺内未受全掩护的天界、邪魔与亡灵及被祝圣/亵渎区域；长休恢复1＋魅力调整值次。'),
  f('lay-on-hands', 1, '圣疗', '拥有等于圣武士等级五倍的治疗池；用动作接触生物分配治疗，或花5点治愈一种疾病/毒素。'),
  f('fighting-style', 2, '战斗风格', '选择一种圣武士战斗风格。'), f('spellcasting', 2, '施法', '以魅力作为施法属性；每天准备魅力调整值＋圣武士等级一半个法术（至少1个）。'),
  f('divine-smite', 2, '至圣斩', '近战武器命中时消耗法术位，额外造成2d8光耀伤害，每高一环再加1d8；对邪魔与亡灵再加1d8。'),
  f('divine-health', 3, '神佑', '免疫疾病。'), f('sacred-oath', 3, '神圣誓言', '选择奉献之誓。'), asi(4),
  f('extra-attack', 5, '额外攻击', '执行攻击动作时可攻击两次。'),
  f('aura-of-protection', 6, '守护灵光', '自身与10尺内友军豁免加入你的魅力调整值（至少+1）；18级扩大至30尺。'), asi(8),
  f('aura-of-courage', 10, '勇气灵光', '自身与10尺内友军免疫恐慌；18级扩大至30尺。'),
  f('improved-divine-smite', 11, '精通至圣斩', '每次近战武器命中额外造成1d8光耀伤害。'), asi(12),
  f('cleansing-touch', 14, '净化之触', '用动作结束自身或接触自愿生物身上的一个法术；长休恢复魅力调整值次（至少1次）。'), asi(16),
  f('aura-improvements', 18, '灵光改进', '守护灵光、勇气灵光与誓言灵光范围扩大至30尺。'), asi(19),
]

const RANGER_FEATURES = [
  f('favored-enemy', 1, '宿敌', '选择一类宿敌；追踪它们的感知（求生）与回忆相关信息的智力检定具有优势，并学习其一种语言。'),
  f('natural-explorer', 1, '自然探索者', '选择一种偏好地形；在该地形旅行、导航、追踪和觅食时获得多项优势。'),
  f('fighting-style', 2, '战斗风格', '选择一种游侠战斗风格。'), f('spellcasting', 2, '施法', '以感知作为施法属性，使用游侠已知法术机制。'),
  f('ranger-archetype', 3, '游侠范型', '选择猎人。'), f('primeval-awareness', 3, '原初感知', '消耗一个法术位，感知1英里内（偏好地形6英里）特定生物类型是否存在。'), asi(4),
  f('extra-attack', 5, '额外攻击', '执行攻击动作时可攻击两次。'),
  f('favored-enemy-improvement-6', 6, '宿敌改进', '再选择一种宿敌及其语言。'), f('natural-explorer-improvement-6', 6, '自然探索者改进', '再选择一种偏好地形。'),
  asi(8), f('lands-stride', 8, '大地行者', '穿过非魔法困难地形和植物不消耗额外移动，并对魔法植物阻碍具有优势。'),
  f('natural-explorer-improvement-10', 10, '自然探索者改进', '再选择一种偏好地形。'), f('hide-in-plain-sight', 10, '隐匿无踪', '花1分钟制作伪装，在保持不动时敏捷（隐匿）检定 +10。'),
  asi(12), f('favored-enemy-improvement-14', 14, '宿敌改进', '再选择一种宿敌及其语言。'), f('vanish', 14, '无踪步', '可用附赠动作躲藏，且不能被非魔法方式追踪，除非主动留下踪迹。'),
  asi(16), f('feral-senses', 18, '野性感官', '攻击看不见的生物时不会因此具有劣势，并能察觉30尺内未躲藏的隐形生物。'), asi(19),
  f('foe-slayer', 20, '屠灭众敌', '每回合一次，对宿敌的攻击或伤害掷骰可加入感知调整值。'),
]

const ROGUE_FEATURES = [
  f('expertise-1', 1, '专精', '选择两项技能熟练，或一项技能与盗贼工具，使熟练加值翻倍。'),
  f('sneak-attack', 1, '偷袭', '每回合一次，以灵巧或远程武器命中并满足优势/邻接条件时造成额外伤害，骰数随等级增长。'),
  f('thieves-cant', 1, '盗贼黑话', '掌握盗贼暗语、术语与隐秘记号。'),
  f('cunning-action', 2, '巧妙动作', '每回合可用附赠动作疾走、撤离或躲藏。'),
  f('roguish-archetype', 3, '游荡者范型', '选择盗贼。'), asi(4),
  f('uncanny-dodge', 5, '直觉闪避', '可见攻击者命中你时，可用反应将该次攻击伤害减半。'),
  f('expertise-2', 6, '专精（另两项）', '再选择两项技能或盗贼工具熟练，使熟练加值翻倍。'),
  f('evasion', 7, '反射闪避', '敏捷豁免成功不受伤，失败只受一半伤害。'), asi(8), asi(10),
  f('reliable-talent', 11, '可靠才能', '进行加入熟练加值的属性检定时，d20掷出9或更低按10计算。'), asi(12),
  f('blindsense', 14, '盲感', '能察觉10尺内未躲藏的隐形生物位置。'),
  f('slippery-mind', 15, '圆滑心智', '获得感知豁免熟练。'), asi(16),
  f('elusive', 18, '飘忽不定', '未失能时，任何针对你的攻击都不会因攻击者优势而具有优势。'), asi(19),
  f('stroke-of-luck', 20, '幸运一击', '攻击未命中时可改为命中，或属性检定可将d20视为20；短休或长休后恢复。'),
]

const METAMAGIC: Dnd5eClassChoiceGroup = {
  id: 'metamagic', level: 3, name: '超魔法',
  maxSelections: (level) => level >= 17 ? 4 : level >= 10 ? 3 : 2,
  options: [
    { id: 'careful', name: '谨慎法术', summary: '消耗1术法点，使部分目标自动通过法术豁免。' },
    { id: 'distant', name: '远距法术', summary: '消耗1术法点，使距离至少翻倍或将触及变为30尺。' },
    { id: 'empowered', name: '强效法术', summary: '消耗1术法点，重掷至多魅力调整值枚伤害骰。' },
    { id: 'extended', name: '延效法术', summary: '消耗1术法点，使持续至少1分钟的法术时长翻倍，最多24小时。' },
    { id: 'heightened', name: '升阶法术', summary: '消耗3术法点，使一个目标的第一次法术豁免具有劣势。' },
    { id: 'quickened', name: '瞬发法术', summary: '消耗2术法点，将施法时间为1动作的法术改为附赠动作。' },
    { id: 'subtle', name: '精妙法术', summary: '消耗1术法点，忽略言语和姿势成分。' },
    { id: 'twinned', name: '孪生法术', summary: '消耗等同法术环级的术法点（戏法1点），让单目标法术额外指定一个目标。' },
  ],
}

const SORCERER_FEATURES = [
  f('spellcasting', 1, '施法', '以魅力作为施法属性，使用术士已知法术机制。'), f('sorcerous-origin', 1, '术法起源', '选择龙族血脉。'),
  f('font-of-magic', 2, '魔力泉涌', '获得等于术士等级的术法点，可在术法点与法术位之间转换；长休恢复。'),
  f('metamagic', 3, '超魔法', '选择两种超魔法；10级和17级各再选择一种。'), asi(4), asi(8),
  f('metamagic-10', 10, '超魔法（第3种）', '再选择一种超魔法。'), asi(12), asi(16),
  f('metamagic-17', 17, '超魔法（第4种）', '再选择一种超魔法。'), asi(19),
  f('sorcerous-restoration', 20, '术法复苏', '完成短休时恢复4点术法点。'),
]

const PACT_BOON: Dnd5eClassChoiceGroup = {
  id: 'pact-boon', level: 3, name: '契约恩赐', maxSelections: 1,
  options: [
    { id: 'chain', name: '链之契约', summary: '学会寻找魔宠，并可选择特殊魔宠形态。' },
    { id: 'blade', name: '刃之契约', summary: '可用动作创造契约武器，并获得其熟练。' },
    { id: 'tome', name: '书之契约', summary: '获得影之书并从任意职业列表选择三个戏法。' },
  ],
}

const WARLOCK_FEATURES = [
  f('otherworldly-patron', 1, '异界宗主', '选择邪魔宗主。'), f('pact-magic', 1, '契约魔法', '以魅力施法；契约法术位均为同一环级，并在短休或长休后全部恢复。'),
  f('eldritch-invocations', 2, '魔能祈唤', '选择两种魔能祈唤；随等级提高获得更多，并可在升级时替换。'),
  f('pact-boon', 3, '契约恩赐', '选择链、刃或书之契约。'), asi(4), asi(8),
  f('mystic-arcanum-6', 11, '秘法奥秘（6环）', '选择一个6环邪术师法术；无需法术位每天施放一次。'), asi(12),
  f('mystic-arcanum-7', 13, '秘法奥秘（7环）', '选择一个7环邪术师法术；无需法术位每天施放一次。'),
  f('mystic-arcanum-8', 15, '秘法奥秘（8环）', '选择一个8环邪术师法术；无需法术位每天施放一次。'), asi(16),
  f('mystic-arcanum-9', 17, '秘法奥秘（9环）', '选择一个9环邪术师法术；无需法术位每天施放一次。'), asi(19),
  f('eldritch-master', 20, '魔能宗师', '花1分钟恳求宗主，恢复所有已消耗契约法术位；每次长休一次。'),
]

const WIZARD_FEATURES = [
  f('spellcasting', 1, '施法', '以智力作为施法属性；法术书初始记录六个1环法师法术，每天准备智力调整值＋法师等级个法术。'),
  f('arcane-recovery', 1, '奥术回想', '每天一次，短休结束时恢复合计环级不超过法师等级一半（向上取整）的法术位，且不能恢复6环以上法术位。'),
  f('arcane-tradition', 2, '奥术传承', '选择塑能学派。'), asi(4), asi(8), asi(12), asi(16),
  f('spell-mastery', 18, '法术精通', '选择一个1环与一个2环法师法术，可按最低环级随意施放而不消耗法术位。'), asi(19),
  f('signature-spells', 20, '招牌法术', '选择两个3环法师法术，始终准备；每个法术每次短休或长休可免法术位施放一次。'),
]

const ALL_SKILL_OPTIONS: readonly Dnd5eClassChoiceOption[] = [
  ['acrobatics', '杂技'], ['animalHandling', '驯兽'], ['arcana', '奥秘'], ['athletics', '运动'],
  ['deception', '欺瞒'], ['history', '历史'], ['insight', '洞悉'], ['intimidation', '威吓'],
  ['investigation', '调查'], ['medicine', '医药'], ['nature', '自然'], ['perception', '察觉'],
  ['performance', '表演'], ['persuasion', '游说'], ['religion', '宗教'], ['sleightOfHand', '巧手'],
  ['stealth', '隐匿'], ['survival', '生存'], ['thievesTools', '盗贼工具'],
].map(([id, name]) => ({ id, name, summary: '选择一项已有熟练，使其熟练加值翻倍。' }))

const BARD_EXPERTISE: Dnd5eClassChoiceGroup = {
  id: 'expertise', level: 3, name: '专精',
  description: '只能选择已有熟练的技能；10级时再选择两项。',
  maxSelections: (level) => level >= 10 ? 4 : 2,
  options: ALL_SKILL_OPTIONS.filter((option) => option.id !== 'thievesTools'),
}

const ROGUE_EXPERTISE: Dnd5eClassChoiceGroup = {
  id: 'expertise', level: 1, name: '专精',
  description: '只能选择已有熟练的技能或盗贼工具；6级时再选择两项。',
  maxSelections: (level) => level >= 6 ? 4 : 2,
  options: ALL_SKILL_OPTIONS,
}

const RANGER_FAVORED_ENEMY: Dnd5eClassChoiceGroup = {
  id: 'favored-enemy', level: 1, name: '宿敌',
  description: '1级选择一种，6级与14级各再选择一种；若选择类人生物，则在角色笔记中记录两个具体类人生物种族。',
  maxSelections: (level) => level >= 14 ? 3 : level >= 6 ? 2 : 1,
  options: [
    '异怪', '野兽', '天界生物', '构装生物', '龙类', '元素生物', '精类', '邪魔', '巨人', '怪兽', '泥怪', '植物', '亡灵', '两种类人生物种族',
  ].map((name) => ({ id: `favored-${name}`, name, summary: '追踪该类生物及回忆相关信息时获得宿敌加成。' })),
}

const RANGER_TERRAINS: Dnd5eClassChoiceGroup = {
  id: 'favored-terrain', level: 1, name: '偏好地形',
  description: '1级选择一种，6级与10级各再选择一种。',
  maxSelections: (level) => level >= 10 ? 3 : level >= 6 ? 2 : 1,
  options: ['极地', '海岸', '沙漠', '森林', '草原', '山地', '沼泽', '幽暗地域']
    .map((name) => ({ id: `terrain-${name}`, name, summary: '在该地形旅行、导航、追踪和觅食时获得自然探索者收益。' })),
}

const ELDRITCH_INVOCATIONS: Dnd5eClassChoiceGroup = {
  id: 'eldritch-invocations', level: 2, name: '魔能祈唤',
  description: '必须满足祈唤标明的等级、戏法或契约恩赐前提；升级时可替换一个已知祈唤。',
  maxSelections: (level) => level >= 18 ? 8 : level >= 15 ? 7 : level >= 12 ? 6 : level >= 9 ? 5 : level >= 7 ? 4 : level >= 5 ? 3 : 2,
  options: [
    ['agonizing-blast', '苦痛魔爆', '需要魔能爆；伤害加入魅力调整值。'],
    ['armor-of-shadows', '暗影护甲', '可随意对自己施放法师护甲。'],
    ['ascendant-step', '升华步伐', '需要9级；可随意对自己施放浮空术。'],
    ['beast-speech', '野兽之语', '可随意施放动物交谈。'],
    ['beguiling-influence', '迷人影响', '获得欺瞒与游说熟练。'],
    ['bewitching-whispers', '迷魂低语', '需要7级；消耗邪术师法术位施放强迫术，每次长休一次。'],
    ['book-of-ancient-secrets', '远古秘密之书', '需要书之契约；可在影之书中记录仪式法术。'],
    ['chains-of-carceri', '卡瑟利之链', '需要15级与链之契约；可对天界、邪魔或元素生物施放怪物定身。'],
    ['devils-sight', '魔鬼视界', '可在120尺内正常看穿魔法与非魔法黑暗。'],
    ['dreadful-word', '恐惧魔言', '需要7级；消耗邪术师法术位施放困惑术，每次长休一次。'],
    ['eldritch-sight', '魔能视界', '可随意施放侦测魔法。'],
    ['eldritch-spear', '魔能长枪', '需要魔能爆；射程提高至300尺。'],
    ['eyes-of-rune-keeper', '符文守护者之眼', '可以阅读所有文字。'],
    ['fiendish-vigor', '邪魔活力', '可随意以1环施放虚假生命。'],
    ['gaze-of-two-minds', '双生视界', '用动作触碰自愿类人生物并通过其感官感知。'],
    ['lifedrinker', '饮命者', '需要12级与刃之契约；契约武器命中额外造成魅力调整值的黯蚀伤害。'],
    ['mask-of-many-faces', '千面之颜', '可随意施放易容术。'],
    ['master-of-myriad-forms', '万形之主', '需要15级；可随意施放变身术。'],
    ['minions-of-chaos', '混沌仆从', '需要9级；消耗邪术师法术位施放召唤元素，每次长休一次。'],
    ['mire-the-mind', '心灵泥沼', '需要5级；消耗邪术师法术位施放缓慢术，每次长休一次。'],
    ['misty-visions', '迷雾幻象', '可随意施放无声幻影。'],
    ['one-with-shadows', '融入暗影', '需要5级；昏暗或黑暗中可用动作隐形，直到移动或采取动作/反应。'],
    ['otherworldly-leap', '异界跳跃', '需要9级；可随意对自己施放跳跃术。'],
    ['repelling-blast', '斥力魔爆', '需要魔能爆；命中时可将目标推开至多10尺。'],
    ['sculptor-of-flesh', '血肉塑形者', '需要7级；消耗邪术师法术位施放变形术，每次长休一次。'],
    ['sign-of-ill-omen', '凶兆之印', '需要5级；消耗邪术师法术位施放降咒，每次长休一次。'],
    ['thief-of-five-fates', '五命窃贼', '消耗邪术师法术位施放灾祸术，每次长休一次。'],
    ['thirsting-blade', '饥渴魔刃', '需要5级与刃之契约；用契约武器执行攻击动作时可攻击两次。'],
    ['visions-of-distant-realms', '遥远国度之视', '需要15级；可随意施放秘法眼。'],
    ['voice-of-chain-master', '链主之声', '需要链之契约；可跨位面通过魔宠感官感知并借其说话。'],
    ['whispers-of-the-grave', '坟墓低语', '需要9级；可随意施放死者交谈。'],
    ['witch-sight', '巫术视界', '需要15级；可看见30尺内变形者或幻术隐藏生物的真实形态。'],
  ].map(([id, name, summary]) => {
    const requirements: Record<string, Pick<Dnd5eClassChoiceOption, 'minimumClassLevel' | 'requiresPactBoon' | 'requiresKnownSpell'>> = {
      'agonizing-blast': { requiresKnownSpell: 'eldritch-blast' },
      'ascendant-step': { minimumClassLevel: 9 },
      'bewitching-whispers': { minimumClassLevel: 7 },
      'book-of-ancient-secrets': { requiresPactBoon: 'tome' },
      'chains-of-carceri': { minimumClassLevel: 15, requiresPactBoon: 'chain' },
      'dreadful-word': { minimumClassLevel: 7 },
      'eldritch-spear': { requiresKnownSpell: 'eldritch-blast' },
      lifedrinker: { minimumClassLevel: 12, requiresPactBoon: 'blade' },
      'master-of-myriad-forms': { minimumClassLevel: 15 },
      'minions-of-chaos': { minimumClassLevel: 9 },
      'mire-the-mind': { minimumClassLevel: 5 },
      'one-with-shadows': { minimumClassLevel: 5 },
      'otherworldly-leap': { minimumClassLevel: 9 },
      'repelling-blast': { requiresKnownSpell: 'eldritch-blast' },
      'sculptor-of-flesh': { minimumClassLevel: 7 },
      'sign-of-ill-omen': { minimumClassLevel: 5 },
      'thirsting-blade': { minimumClassLevel: 5, requiresPactBoon: 'blade' },
      'visions-of-distant-realms': { minimumClassLevel: 15 },
      'voice-of-chain-master': { requiresPactBoon: 'chain' },
      'whispers-of-the-grave': { minimumClassLevel: 9 },
      'witch-sight': { minimumClassLevel: 15 },
    }
    return { id, name, summary, ...requirements[id] }
  }),
}

export const DND5E_SRD_CLASS_DEFINITIONS: readonly Dnd5eClassDefinition[] = [
  { id: 'barbarian', name: '野蛮人', hitDie: 12, primaryAbilities: ['str'], savingThrows: ['str', 'con'], armorProficiencies: '轻甲、中甲、盾牌', weaponProficiencies: '简易武器、军用武器', skillChoiceCount: 2, skillProficiencies: ['animalHandling', 'athletics', 'intimidation', 'nature', 'perception', 'survival'], subclassLevel: 3, subclass: BERSERKER, features: BARBARIAN_FEATURES },
  { id: 'bard', name: '吟游诗人', hitDie: 8, primaryAbilities: ['cha'], savingThrows: ['dex', 'cha'], armorProficiencies: '轻甲', weaponProficiencies: '简易武器、手弩、长剑、刺剑、短剑', skillChoiceCount: 3, skillProficiencies: 'any', subclassLevel: 3, subclass: LORE, features: BARD_FEATURES, choiceGroups: [BARD_EXPERTISE], spellcasting: { kind: 'full-known', ability: 'cha', ritualCasting: true, focus: '乐器', cantripsKnown: BARD_CANTRIPS, spellsKnown: BARD_SPELLS } },
  { id: 'cleric', name: '牧师', hitDie: 8, primaryAbilities: ['wis'], savingThrows: ['wis', 'cha'], armorProficiencies: '轻甲、中甲、盾牌', weaponProficiencies: '简易武器', skillChoiceCount: 2, skillProficiencies: ['history', 'insight', 'medicine', 'persuasion', 'religion'], subclassLevel: 1, subclass: LIFE, features: CLERIC_FEATURES, spellcasting: { kind: 'full-prepared', ability: 'wis', ritualCasting: true, focus: '圣徽', cantripsKnown: CLERIC_CANTRIPS } },
  { id: 'druid', name: '德鲁伊', hitDie: 8, primaryAbilities: ['wis'], savingThrows: ['int', 'wis'], armorProficiencies: '轻甲、中甲、盾牌（不使用金属制品）', weaponProficiencies: '棍棒、匕首、飞镖、标枪、硬头锤、长棍、弯刀、镰刀、投石索、矛', skillChoiceCount: 2, skillProficiencies: ['arcana', 'animalHandling', 'insight', 'medicine', 'nature', 'perception', 'religion', 'survival'], subclassLevel: 2, subclass: LAND, features: DRUID_FEATURES, spellcasting: { kind: 'full-prepared', ability: 'wis', ritualCasting: true, focus: '德鲁伊法器', cantripsKnown: DRUID_CANTRIPS } },
  { id: 'fighter', name: '战士', hitDie: 10, primaryAbilities: ['str', 'dex'], savingThrows: ['str', 'con'], armorProficiencies: '所有护甲、盾牌', weaponProficiencies: '简易武器、军用武器', skillChoiceCount: 2, skillProficiencies: ['acrobatics', 'animalHandling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival'], subclassLevel: 3, subclass: { id: 'champion', name: '勇士', summary: '专注纯粹体能、精准重击与持久生存。', features: [] }, features: [] },
  { id: 'monk', name: '武僧', hitDie: 8, primaryAbilities: ['dex', 'wis'], savingThrows: ['str', 'dex'], armorProficiencies: '无', weaponProficiencies: '简易武器、短剑', skillChoiceCount: 2, skillProficiencies: ['acrobatics', 'athletics', 'history', 'insight', 'religion', 'stealth'], subclassLevel: 3, subclass: OPEN_HAND, features: MONK_FEATURES },
  { id: 'paladin', name: '圣武士', hitDie: 10, primaryAbilities: ['str', 'cha'], savingThrows: ['wis', 'cha'], armorProficiencies: '所有护甲、盾牌', weaponProficiencies: '简易武器、军用武器', skillChoiceCount: 2, skillProficiencies: ['athletics', 'insight', 'intimidation', 'medicine', 'persuasion', 'religion'], subclassLevel: 3, subclass: DEVOTION, features: PALADIN_FEATURES, choiceGroups: [FIGHTING_STYLE_PALADIN], spellcasting: { kind: 'half-prepared', ability: 'cha', ritualCasting: false, focus: '圣徽' } },
  { id: 'ranger', name: '游侠', hitDie: 10, primaryAbilities: ['dex', 'wis'], savingThrows: ['str', 'dex'], armorProficiencies: '轻甲、中甲、盾牌', weaponProficiencies: '简易武器、军用武器', skillChoiceCount: 3, skillProficiencies: ['animalHandling', 'athletics', 'insight', 'investigation', 'nature', 'perception', 'stealth', 'survival'], subclassLevel: 3, subclass: HUNTER, features: RANGER_FEATURES, choiceGroups: [RANGER_FAVORED_ENEMY, RANGER_TERRAINS, FIGHTING_STYLE_RANGER], spellcasting: { kind: 'half-known', ability: 'wis', ritualCasting: false, focus: '无', spellsKnown: RANGER_SPELLS } },
  { id: 'rogue', name: '游荡者', hitDie: 8, primaryAbilities: ['dex'], savingThrows: ['dex', 'int'], armorProficiencies: '轻甲', weaponProficiencies: '简易武器、手弩、长剑、刺剑、短剑', skillChoiceCount: 4, skillProficiencies: ['acrobatics', 'athletics', 'deception', 'insight', 'intimidation', 'investigation', 'perception', 'performance', 'persuasion', 'sleightOfHand', 'stealth'], subclassLevel: 3, subclass: THIEF, features: ROGUE_FEATURES, choiceGroups: [ROGUE_EXPERTISE] },
  { id: 'sorcerer', name: '术士', hitDie: 6, primaryAbilities: ['cha'], savingThrows: ['con', 'cha'], armorProficiencies: '无', weaponProficiencies: '匕首、飞镖、投石索、长棍、轻弩', skillChoiceCount: 2, skillProficiencies: ['arcana', 'deception', 'insight', 'intimidation', 'persuasion', 'religion'], subclassLevel: 1, subclass: DRACONIC, features: SORCERER_FEATURES, choiceGroups: [METAMAGIC], spellcasting: { kind: 'full-known', ability: 'cha', ritualCasting: false, focus: '奥术法器', cantripsKnown: SORCERER_CANTRIPS, spellsKnown: SORCERER_SPELLS } },
  { id: 'warlock', name: '邪术师', hitDie: 8, primaryAbilities: ['cha'], savingThrows: ['wis', 'cha'], armorProficiencies: '轻甲', weaponProficiencies: '简易武器', skillChoiceCount: 2, skillProficiencies: ['arcana', 'deception', 'history', 'intimidation', 'investigation', 'nature', 'religion'], subclassLevel: 1, subclass: FIEND, features: WARLOCK_FEATURES, choiceGroups: [ELDRITCH_INVOCATIONS, PACT_BOON], spellcasting: { kind: 'pact', ability: 'cha', ritualCasting: false, focus: '奥术法器', cantripsKnown: WARLOCK_CANTRIPS, spellsKnown: WARLOCK_SPELLS } },
  { id: 'wizard', name: '法师', hitDie: 6, primaryAbilities: ['int'], savingThrows: ['int', 'wis'], armorProficiencies: '无', weaponProficiencies: '匕首、飞镖、投石索、长棍、轻弩', skillChoiceCount: 2, skillProficiencies: ['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'], subclassLevel: 2, subclass: EVOCATION, features: WIZARD_FEATURES, spellcasting: { kind: 'full-prepared', ability: 'int', ritualCasting: true, focus: '奥术法器', cantripsKnown: WIZARD_CANTRIPS } },
]

const byId = new Map(DND5E_SRD_CLASS_DEFINITIONS.map((definition) => [definition.id, definition]))
const byName = new Map(DND5E_SRD_CLASS_DEFINITIONS.map((definition) => [definition.name, definition]))

export function dnd5eClassDefinition(idOrName: Dnd5eClassId | string): Dnd5eClassDefinition | undefined {
  return byId.get(idOrName as Dnd5eClassId) ?? byName.get(idOrName) ?? registeredDeclarativeClassDefinitionV1(idOrName)
}

export function dnd5eClassDefinitionForCharacter(character: Pick<Character, 'charClass'>): Dnd5eClassDefinition | undefined {
  return byName.get(character.charClass) ?? registeredDeclarativeClassDefinitionV1(character.charClass)
}

export function availableDnd5eClassDefinitions(): readonly Dnd5eClassDefinition[] {
  return [
    ...DND5E_SRD_CLASS_DEFINITIONS,
    ...registeredDeclarativeClassesV1().map((entry) => entry.definition),
  ]
}

function classLevel(character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels'>, classId: Dnd5eClassId): number {
  const stored = character.dnd5eClassLevels?.[classId]
  if (stored != null) return Math.max(0, Math.min(20, Math.floor(stored)))
  return dnd5eClassDefinition(character.charClass)?.id === classId
    ? Math.max(1, Math.min(20, Math.floor(character.level)))
    : 0
}

export function dnd5eClassChoiceLimit(group: Dnd5eClassChoiceGroup, level: number): number {
  const value = typeof group.maxSelections === 'function' ? group.maxSelections(level) : group.maxSelections
  return Math.max(0, Math.floor(value))
}

export function dnd5eClassChoiceOptionAvailable(
  character: Pick<Character, 'level' | 'dnd5eClassChoices'>,
  classId: Dnd5eClassId,
  option: Dnd5eClassChoiceOption,
): boolean {
  if ((option.minimumClassLevel ?? 1) > character.level) return false
  const selections = character.dnd5eClassChoices?.classes?.[classId]?.selections ?? {}
  if (option.requiresPactBoon && !selections['pact-boon']?.includes(option.requiresPactBoon)) return false
  if (option.requiresKnownSpell && !selections['spell-cantrips']?.includes(option.requiresKnownSpell) &&
    !selections['spell-known']?.includes(option.requiresKnownSpell)) return false
  return true
}

export function dnd5eAllClassChoiceGroups(definition: Dnd5eClassDefinition): readonly Dnd5eClassChoiceGroup[] {
  return [...(definition.choiceGroups ?? []), ...(definition.subclass.choiceGroups ?? [])]
}

export function dnd5eClassSpellSlots(definition: Dnd5eClassDefinition, level: number): readonly number[] {
  const current = Math.min(20, Math.max(1, Math.floor(level)))
  if (!definition.spellcasting) return []
  if (definition.spellcasting.kind === 'full-known' || definition.spellcasting.kind === 'full-prepared') return FULL_CASTER_SLOTS[current - 1]
  if (definition.spellcasting.kind === 'half-known' || definition.spellcasting.kind === 'half-prepared') return HALF_CASTER_SLOTS[current - 1]
  if (definition.spellcasting.kind === 'one-third-known') {
    // The single-class Eldritch Knight/Arcane Trickster table advances at
    // levels 3, 4, 7, 10, ...; multiclass slot contribution still rounds down.
    const casterLevel = current < 3 ? 0 : Math.ceil(current / 3)
    return casterLevel > 0 ? FULL_CASTER_SLOTS[casterLevel - 1] : []
  }
  const slots = current >= 17 ? 4 : current >= 11 ? 3 : current >= 2 ? 2 : 1
  return [slots]
}

export function dnd5ePactSlotLevel(level: number): number {
  const current = Math.min(20, Math.max(1, Math.floor(level)))
  if (current >= 9) return 5
  if (current >= 7) return 4
  if (current >= 5) return 3
  if (current >= 3) return 2
  return 1
}

export function dnd5eClassProgression(definition: Dnd5eClassDefinition): readonly Dnd5eClassProgressionLevel[] {
  if (definition.id === 'fighter' && !definition.spellcasting) {
    return fighterProgression('champion').map((entry) => ({
      ...entry,
      features: entry.features.map((feature) => ({ ...feature, source: feature.source === 'fighter' ? 'class' as const : 'subclass' as const })),
      spellSlots: [],
    }))
  }
  return Array.from({ length: 20 }, (_, index) => {
    const level = index + 1
    const spellcasting = definition.spellcasting
    return {
      level,
      proficiencyBonus: 2 + Math.floor((level - 1) / 4),
      features: [
        ...definition.features.filter((feature) => feature.level === level),
        ...definition.subclass.features.filter((feature) => feature.level === level),
      ],
      spellSlots: dnd5eClassSpellSlots(definition, level),
      pactSlotLevel: spellcasting?.kind === 'pact' ? dnd5ePactSlotLevel(level) : undefined,
      cantripsKnown: spellcasting?.cantripsKnown?.[index],
      spellsKnown: spellcasting?.spellsKnown?.[index],
    }
  })
}

export function dnd5eBarbarianRageUses(level: number): number {
  const current = Math.min(20, Math.max(1, Math.floor(level)))
  if (current >= 20) return Number.POSITIVE_INFINITY
  if (current >= 17) return 6
  if (current >= 12) return 5
  if (current >= 6) return 4
  if (current >= 3) return 3
  return 2
}

export function dnd5eBarbarianRageDamage(level: number): number {
  if (level >= 16) return 4
  if (level >= 9) return 3
  return 2
}

export function dnd5eBarbarianBrutalCriticalDice(level: number): number {
  if (level >= 17) return 3
  if (level >= 13) return 2
  if (level >= 9) return 1
  return 0
}

export function dnd5eBardicInspirationDie(level: number): number {
  if (level >= 15) return 12
  if (level >= 10) return 10
  if (level >= 5) return 8
  return 6
}

export function dnd5eBardSongOfRestDie(level: number): number {
  if (level < 2) return 0
  if (level >= 17) return 12
  if (level >= 13) return 10
  if (level >= 9) return 8
  return 6
}

export function dnd5eClericDestroyUndeadCr(level: number): string | undefined {
  if (level >= 17) return '4'
  if (level >= 14) return '3'
  if (level >= 11) return '2'
  if (level >= 8) return '1'
  if (level >= 5) return '1/2'
  return undefined
}

export function dnd5eDruidWildShapeLimits(level: number): { maxChallengeRating: string; swim: boolean; fly: boolean } {
  if (level >= 8) return { maxChallengeRating: '1', swim: true, fly: true }
  if (level >= 4) return { maxChallengeRating: '1/2', swim: true, fly: false }
  return { maxChallengeRating: '1/4', swim: false, fly: false }
}

export function dnd5eMonkMartialArtsDie(level: number): number {
  if (level >= 17) return 10
  if (level >= 11) return 8
  if (level >= 5) return 6
  return 4
}

export function dnd5eMonkUnarmoredMovementBonus(level: number): number {
  if (level < 2) return 0
  if (level >= 18) return 30
  if (level >= 14) return 25
  if (level >= 10) return 20
  if (level >= 6) return 15
  return 10
}

export function dnd5ePaladinAuraRadius(level: number): number {
  return level >= 18 ? 30 : 10
}

export function dnd5eRogueSneakAttackDice(level: number): number {
  return Math.ceil(Math.min(20, Math.max(1, Math.floor(level))) / 2)
}

export function dnd5eAttacksPerAttackAction(character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>): number {
  const fighterLevel = classLevel(character, 'fighter')
  let attacks = fighterLevel >= 20 ? 4 : fighterLevel >= 11 ? 3 : fighterLevel >= 5 ? 2 : 1
  if ((['barbarian', 'monk', 'paladin', 'ranger'] as Dnd5eClassId[]).some((id) => classLevel(character, id) >= 5)) attacks = Math.max(attacks, 2)
  const invocations = character.dnd5eClassChoices?.classes?.warlock?.selections?.['eldritch-invocations'] ?? []
  const pact = character.dnd5eClassChoices?.classes?.warlock?.selections?.['pact-boon'] ?? []
  if (classLevel(character, 'warlock') >= 5 && invocations.includes('thirsting-blade') && pact.includes('blade')) attacks = Math.max(attacks, 2)
  return attacks
}

export function dnd5eSpellSaveDc(character: Pick<Character, 'charClass' | 'level' | 'abilities'>): number | undefined {
  const definition = dnd5eClassDefinitionForCharacter(character)
  if (!definition?.spellcasting) return undefined
  const modifier = Math.floor((character.abilities[definition.spellcasting.ability] - 10) / 2)
  return 8 + 2 + Math.floor((Math.min(20, Math.max(1, character.level)) - 1) / 4) + modifier
}

export function dnd5eUnproficientAbilityCheckBonus(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>,
  ability: AbilityKey,
  alreadyProficient = false,
): number {
  if (alreadyProficient) return 0
  const proficiency = 2 + Math.floor((Math.min(20, Math.max(1, character.level)) - 1) / 4)
  const bardBonus = classLevel(character, 'bard') >= 2 ? Math.floor(proficiency / 2) : 0
  const championBonus = classLevel(character, 'fighter') >= 7 &&
    character.dnd5eClassChoices?.fighter?.subclass === 'champion' &&
    (['str', 'dex', 'con'] as AbilityKey[]).includes(ability)
    ? Math.ceil(proficiency / 2)
    : 0
  return Math.max(bardBonus, championBonus)
}

export function dnd5eEffectiveSavingThrowProficiencies(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'savingThrows'>,
): readonly AbilityKey[] {
  if (classLevel(character, 'monk') >= 14) return ['str', 'dex', 'con', 'int', 'wis', 'cha']
  if (classLevel(character, 'rogue') >= 15) return [...new Set([...character.savingThrows, 'wis' as const])]
  return character.savingThrows
}

export function dnd5eSelfSavingThrowAuraBonus(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities'>,
): number {
  if (classLevel(character, 'paladin') < 6) return 0
  return Math.max(1, Math.floor((character.abilities.cha - 10) / 2))
}

export function dnd5eSpellAttackModifier(character: Pick<Character, 'charClass' | 'level' | 'abilities'>): number | undefined {
  const dc = dnd5eSpellSaveDc(character)
  return dc == null ? undefined : dc - 8
}

export function dnd5ePreparedSpellCount(character: Pick<Character, 'charClass' | 'level' | 'abilities'>): number | undefined {
  const definition = dnd5eClassDefinitionForCharacter(character)
  const spellcasting = definition?.spellcasting
  if (!spellcasting || (spellcasting.kind !== 'full-prepared' && spellcasting.kind !== 'half-prepared')) return undefined
  const modifier = Math.floor((character.abilities[spellcasting.ability] - 10) / 2)
  const classLevels = spellcasting.kind === 'half-prepared' ? Math.floor(character.level / 2) : character.level
  return Math.max(1, classLevels + modifier)
}

export function dnd5eWizardArcaneRecoveryLevels(level: number): number {
  return Math.ceil(Math.min(20, Math.max(1, Math.floor(level))) / 2)
}

/** 以角色存档中的种族基础速度为基准，应用职业带来的步行速度修正。 */
export function dnd5eWalkingSpeed(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'speed' | 'equipment' | 'dnd5eInventory' | 'exhaustionLevel'> &
    Partial<Pick<Character, 'abilities' | 'race' | 'dnd5eRaceId'>>,
): number {
  const base = Math.max(0, Math.floor(character.speed))
  const armor = character.equipment?.armor?.dnd5e
  const hasArmor = armor?.kind === 'armor' || !!character.equipment?.armor
  const hasShield = character.equipment?.offHand?.dnd5e?.kind === 'shield'
  const wearingHeavyArmor = armor?.kind === 'armor' && armor.category === 'heavy'
  let speed = base
  const barbarianLevel = classLevel(character, 'barbarian')
  const monkLevel = classLevel(character, 'monk')
  if (barbarianLevel >= 5 && !wearingHeavyArmor) speed += 10
  if (monkLevel >= 2 && !hasArmor && !hasShield) {
    speed += dnd5eMonkUnarmoredMovementBonus(monkLevel)
  }
  const dwarvenSpeed = [character.race, character.dnd5eRaceId]
    .filter((value): value is string => typeof value === 'string')
    .some((value) => /矮人|dwarf/i.test(value))
  if (
    wearingHeavyArmor &&
    armor.kind === 'armor' &&
    armor.strengthRequirement != null &&
    (character.abilities?.str ?? 10) < armor.strengthRequirement &&
    !dwarvenSpeed
  ) {
    speed -= 10
  }
  speed += dnd5eEquippedEffectTotal(character, 'speedBonusFeet')
  speed = Math.max(0, speed)
  if (character.abilities) {
    const itemWeight = character.dnd5eInventory?.entries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.item.weightLb) || 0) * Math.max(1, Number(entry.quantity) || 1),
      0,
    ) ?? 0
    const coinCount = Object.values(character.dnd5eInventory?.currency ?? {}).reduce((sum, amount) => sum + Math.max(0, Number(amount) || 0), 0)
    if (itemWeight + coinCount / 50 > Math.max(1, character.abilities.str) * 15) return 0
  }
  const exhaustion = Math.min(6, Math.max(0, Math.floor(character.exhaustionLevel ?? 0)))
  if (exhaustion >= 5) return 0
  return exhaustion >= 2 ? Math.floor(speed / 2) : speed
}

/** 角色面板与地图回合资源使用的当前有效速度；基础速度仍由 dnd5eWalkingSpeed 提供给 Headless。 */
export function dnd5eEffectiveWalkingSpeed(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'speed' | 'equipment' | 'dnd5eInventory' | 'exhaustionLevel' | 'dnd5eCombatState'>,
): number {
  return Math.max(
    0,
    dnd5eWalkingSpeed(character) -
      dnd5eActiveSpeedPenalty(character.dnd5eCombatState?.activeEffects) -
      Math.max(0, character.dnd5eCombatState?.caltropsSpeedPenaltyFeet ?? 0) +
      dnd5eActiveSpeedBonus(character.dnd5eCombatState?.activeEffects),
  )
}

function isSrdThief(character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>, minimumLevel: number): boolean {
  return classLevel(character, 'rogue') >= minimumLevel &&
    character.dnd5eClassChoices?.classes?.rogue?.subclass === 'thief'
}

/** 飞檐走壁：普通攀爬每尺消耗 2 尺移动，3级盗贼子职改为 1:1。 */
export function dnd5eClimbingMovementCost(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>,
  climbedFeet: number,
): number {
  const distance = Math.max(0, Math.floor(climbedFeet))
  return distance * (isSrdThief(character, 3) ? 1 : 2)
}

/** 职业特性带来的助跑跳跃额外距离：勇士“运动健将”或盗贼“飞檐走壁”。 */
export function dnd5eRunningJumpBonusFeet(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'abilities' | 'dnd5eClassChoices'>,
): number {
  if (isSrdThief(character, 3)) return Math.max(0, Math.floor((character.abilities.dex - 10) / 2))
  return fighterRemarkableAthleteRunningLongJumpBonus({ ...character, level: classLevel(character, 'fighter') })
}

/** 使用魔法装置：13级盗贼忽略魔法物品的职业、种族与等级要求。 */
export function dnd5eIgnoresMagicItemRequirements(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>,
): boolean {
  return isSrdThief(character, 13)
}

/** 盗贼反射的第二先攻值；实际额外回合由战斗调度器消费。 */
export function dnd5eThiefReflexesInitiative(
  character: Pick<Character, 'charClass' | 'level' | 'dnd5eClassLevels' | 'dnd5eClassChoices'>,
  initiative: number,
  surprised = false,
): number | undefined {
  return isSrdThief(character, 17) && !surprised ? initiative - 10 : undefined
}

function restoreDnd5eResource(character: Character, key: string, amount: number): Character {
  const resource = character.classResources?.[key]
  if (!resource || amount <= 0 || resource.current >= resource.max) return character
  return {
    ...character,
    classResources: {
      ...character.classResources,
      [key]: { ...resource, current: Math.min(resource.max, resource.current + amount) },
    },
  }
}

/** SRD 5.1 在投先攻时触发的 20 级职业资源兜底。 */
export function applyDnd5eInitiativeResourceFeatures(character: Character): Character {
  if (character.rulesetId !== 'dnd5e-2014-srd-5.1') return character
  if (classLevel(character, 'bard') >= 20 && character.classResources?.['dnd5e-bardic-inspiration']?.current === 0) {
    return restoreDnd5eResource(character, 'dnd5e-bardic-inspiration', 1)
  }
  if (classLevel(character, 'monk') >= 20 && character.classResources?.['dnd5e-ki']?.current === 0) {
    return restoreDnd5eResource(character, 'dnd5e-ki', 4)
  }
  return character
}

/** SRD 5.1 术士 20 级“术法复苏”：每次短休恢复 4 点术法点。 */
export function applyDnd5eShortRestResourceFeatures(character: Character): Character {
  if (
    character.rulesetId !== 'dnd5e-2014-srd-5.1' ||
    classLevel(character, 'sorcerer') < 20
  ) return character
  return restoreDnd5eResource(character, 'dnd5e-sorcery-points', 4)
}
